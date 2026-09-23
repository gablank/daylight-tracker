import SunCalc from 'suncalc';
import { cachedSunCalcTimes } from './solar.js';
import { dateAtLocalInTimezone } from './utils.js';

// SunCalc uses -0.833° for sunrise/sunset (refraction + disc)
const THRESH_SUNRISE = -0.833;
const THRESH_CIVIL = -6;
const THRESH_NAUTICAL = -12;
const THRESH_ASTRONOMICAL = -18;

// Convert a Date to fractional hour relative to a reference midnight (unclamped)
function toHourRelative(t, refMidnight) {
  if (!t || isNaN(t.getTime())) return null;
  return (t.getTime() - refMidnight.getTime()) / 3600000;
}

/**
 * Resolve a zone into bands in "natural" (solar) timezone.
 * Since we compute in the natural tz, events are well-behaved: rise < set, both near [0,24].
 * Returns { bands: [{morning, evening}, ...] } — empty array if zone isn't visible.
 */
function resolveZone(morningTime, eveningTime, threshold, refMidnight, refNoon, lat, lng) {
  const mRaw = toHourRelative(morningTime, refMidnight);
  const eRaw = toHourRelative(eveningTime, refMidnight);

  // Helper: noon altitude for fallback when events are NaN
  function noonAlt() {
    return SunCalc.getPosition(refNoon, lat, lng).altitude * 180 / Math.PI;
  }

  if (mRaw !== null && eRaw !== null) {
    // Normal: rise then set — clamp to [0, 24]
    const m = Math.max(0, Math.min(24, mRaw));
    const e = Math.max(0, Math.min(24, eRaw));
    if (m < e) return { bands: [{ morning: m, evening: e }] };
    // Events collapsed after clamping — use noon altitude
    return noonAlt() > threshold
      ? { bands: [{ morning: 0, evening: 24 }] }
      : { bands: [] };
  }

  // Only rise event (no set — sun rises and stays up)
  if (mRaw !== null && eRaw === null) {
    if (noonAlt() > threshold) {
      const m = Math.max(0, Math.min(24, mRaw));
      return m < 24 ? { bands: [{ morning: m, evening: 24 }] } : { bands: [] };
    }
    return { bands: [] };
  }

  // Only set event (no rise — sun was up, then sets)
  if (mRaw === null && eRaw !== null) {
    if (noonAlt() > threshold) {
      const e = Math.max(0, Math.min(24, eRaw));
      return e > 0 ? { bands: [{ morning: 0, evening: e }] } : { bands: [] };
    }
    return { bands: [] };
  }

  // Both events NaN: entirely on or entirely off based on noon altitude
  return noonAlt() > threshold
    ? { bands: [{ morning: 0, evening: 24 }] }
    : { bands: [] };
}

/**
 * Rotate bands by `shift` hours, wrapping around [0, 24].
 * Like a register rotate — what falls off one end appears at the other.
 */
function rotateBands(bands, shift) {
  if (Math.abs(shift) < 0.001) return bands;
  const result = [];
  for (const b of bands) {
    const m = b.morning + shift;
    const e = b.evening + shift;
    if (m >= 0 && e <= 24) {
      // Entirely within [0, 24]
      result.push({ morning: m, evening: e });
    } else if (m < 0 && e <= 24) {
      // Morning wraps backwards past midnight
      if (e > 0) result.push({ morning: 0, evening: e });
      if (m + 24 < 24) result.push({ morning: m + 24, evening: 24 });
    } else if (m >= 0 && e > 24) {
      // Evening wraps forward past midnight
      if (m < 24) result.push({ morning: m, evening: 24 });
      if (e - 24 > 0) result.push({ morning: 0, evening: e - 24 });
    } else {
      // Both wrap — covers entire day
      result.push({ morning: 0, evening: 24 });
    }
  }
  return result.filter(b => b.evening > b.morning);
}

/**
 * Twilight boundary bands for every day of a year, in the location's clock time.
 * Strategy: compute in the "natural" solar timezone (UTC + longitude/15) where
 * SunCalc events are well-behaved, then rotate to the selected timezone.
 * @param {Array} yearData - computeYearData() output (one entry per day, for the dates)
 * @param {number} latitude
 * @param {number} longitude
 * @param {string|null} timezone - IANA timezone; the browser's if omitted
 * @returns {Array<{daylight: {bands}, civil: {bands}, nautical: {bands}, astronomical: {bands}}>}
 *   each zone's bands are [{morning, evening}] in hours after local midnight (0–24); a zone
 *   includes the brighter zones inside it (civil spans from dawn to dusk)
 */
export function computeTwilightBands(yearData, latitude, longitude, timezone) {
  if (!yearData || yearData.length === 0) return [];

  // Natural timezone offset in hours (constant, no DST)
  const naturalOffsetHours = longitude / 15;
  const naturalOffsetMs = naturalOffsetHours * 3600000;

  const result = [];
  for (let i = 0; i < yearData.length; i++) {
    const d = yearData[i].date;
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const day = d.getDate();

    // Midnight and noon in the natural solar timezone
    const utcMidnightMs = Date.UTC(year, month - 1, day);
    const naturalMidnight = new Date(utcMidnightMs - naturalOffsetMs);
    const naturalNoon = new Date(naturalMidnight.getTime() + 12 * 3600000);

    // SunCalc times computed from natural noon — events are centered and well-behaved
    const times = cachedSunCalcTimes(naturalNoon, latitude, longitude);

    // Resolve zones in natural solar time
    const daylight = resolveZone(times.sunrise, times.sunset, THRESH_SUNRISE, naturalMidnight, naturalNoon, latitude, longitude);
    const civil = resolveZone(times.dawn, times.dusk, THRESH_CIVIL, naturalMidnight, naturalNoon, latitude, longitude);
    const nautical = resolveZone(times.nauticalDawn, times.nauticalDusk, THRESH_NAUTICAL, naturalMidnight, naturalNoon, latitude, longitude);
    const astronomical = resolveZone(times.nightEnd, times.night, THRESH_ASTRONOMICAL, naturalMidnight, naturalNoon, latitude, longitude);

    // Compute rotation: shift from natural time to selected timezone
    let selectedMidnight;
    if (timezone) {
      selectedMidnight = dateAtLocalInTimezone(year, month, day, 0, 0, timezone);
    } else {
      selectedMidnight = new Date(year, month - 1, day);
    }
    const shift = (naturalMidnight.getTime() - selectedMidnight.getTime()) / 3600000;

    // Rotate all zone bands from natural solar time → selected timezone
    result.push({
      daylight:      { bands: rotateBands(daylight.bands, shift) },
      civil:         { bands: rotateBands(civil.bands, shift) },
      nautical:      { bands: rotateBands(nautical.bands, shift) },
      astronomical:  { bands: rotateBands(astronomical.bands, shift) },
    });
  }
  return result;
}

/**
 * How long each sky state lasts on a day, in hours, from computeTwilightBands() output
 * @param {{daylight: {bands}, civil: {bands}, nautical: {bands}, astronomical: {bands}}} day
 * @returns {{daylight: number, civil: number, nautical: number, astronomical: number, night: number}}
 */
export function twilightDurations(day) {
  const sum = (zone) => zone.bands.reduce((s, b) => s + (b.evening - b.morning), 0);
  const daylight = sum(day.daylight);
  const civil = sum(day.civil);
  const nautical = sum(day.nautical);
  const astronomical = sum(day.astronomical);
  return {
    daylight,
    civil: Math.max(0, civil - daylight),
    nautical: Math.max(0, nautical - civil),
    astronomical: Math.max(0, astronomical - nautical),
    night: Math.max(0, 24 - astronomical),
  };
}
