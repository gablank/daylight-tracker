import SunCalc from 'suncalc';
import { getCalendarDayInTimezone, dateAtLocalInTimezone, formatTimeInTimezone, calendarDateInTimezone, clockHoursInTimezone } from './utils.js';
import { LRUCache, CACHE_MAX_LARGE, CACHE_MAX_SMALL } from './cache.js';

// Sun at -4°: the boundary between blue hour (-6° to -4°) and golden hour (-4° to +6°).
// Adds times.blueHourEnd (morning) and times.blueHourStart (evening) to SunCalc.getTimes.
SunCalc.addTime(-4, 'blueHourEnd', 'blueHourStart');

/**
 * The instant at a fractional hour of the selected calendar day, in the given
 * timezone (or the browser's when timezone is null).
 */
export function timeOnDay(date, hour, timezone = null) {
  if (timezone) {
    const midnight = dateAtLocalInTimezone(date.getFullYear(), date.getMonth() + 1, date.getDate(), 0, 0, timezone);
    return new Date(midnight.getTime() + hour * 3600000);
  }
  const wholeH = Math.floor(hour);
  const mins = Math.round((hour - wholeH) * 60);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), wholeH, mins, 0);
}

/**
 * The point on Earth where the sun is directly overhead at the given instant.
 * @returns {{ latitude: number, longitude: number }} degrees
 */
export function getSubsolarPoint(time) {
  // Subsolar longitude: the meridian where the sun is directly overhead right now
  const utcHours = time.getUTCHours() + time.getUTCMinutes() / 60 + time.getUTCSeconds() / 3600;
  const longitude = (12 - utcHours) * 15;

  // Solar declination: at the pole, sun altitude = declination exactly
  // (sin(alt) = sin(dec)*sin(90°) = sin(dec) → alt = dec)
  const declination = SunCalc.getPosition(time, 89.99, longitude).altitude;
  return { latitude: declination * 180 / Math.PI, longitude };
}

/**
 * Check if a year is a leap year
 */
export function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

/**
 * Get the number of days in a year
 */
export function getDaysInYear(year) {
  return isLeapYear(year) ? 366 : 365;
}

/**
 * Get the day of year (0-indexed) for a date
 */
export function getDayOfYear(date) {
  // Compare calendar days in UTC so DST shifts in the local timezone don't skew the count
  const day = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const start = Date.UTC(date.getFullYear(), 0, 0);
  return Math.round((day - start) / (1000 * 60 * 60 * 24));
}

/**
 * Julian date (UTC) for a given Date (fractional days since J2000 epoch).
 */
function julianDate(date) {
  const ms = date.getTime();
  return ms / 86400000 + 2440587.5;
}

/**
 * Sun's ecliptic longitude in degrees (0–360) for a given Julian date.
 * Simplified formula from Meeus "Astronomical Algorithms" (Ch 25).
 */
function sunEclipticLongitude(jd) {
  const n = jd - 2451545.0;
  const L = 280.466 + 0.9856474 * n;
  const g = (357.528 + 0.9856003 * n) * (Math.PI / 180);
  let lambda = L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g);
  lambda = ((lambda % 360) + 360) % 360;
  return lambda;
}

/**
 * Equation of time in minutes: apparent solar time minus mean solar time
 * (positive = the sun is ahead, so solar noon comes before mean noon).
 * Low-precision Meeus formulas; accurate to within a few seconds.
 * @param {Date} date
 * @returns {number}
 */
export function equationOfTime(date) {
  const rad = Math.PI / 180;
  const jd = julianDate(date);
  const n = jd - 2451545.0;
  const meanLongitude = 280.466 + 0.9856474 * n;
  const lambda = sunEclipticLongitude(jd) * rad;
  const obliquity = (23.439 - 0.0000004 * n) * rad;
  const rightAscension = Math.atan2(Math.cos(obliquity) * Math.sin(lambda), Math.cos(lambda)) / rad;
  const diff = ((((meanLongitude - rightAscension) % 360) + 540) % 360) - 180; // wrap to ±180°
  return diff * 4; // 1° = 4 minutes
}

/**
 * Find the UTC moment when the Sun's ecliptic longitude equals the target (0, 90, 180, or 270).
 * Search window is centered on the approximate calendar date for that event.
 */
function findSolsticeEquinoxMoment(year, targetLongitude) {
  const approxMonth = [2, 5, 8, 11][targetLongitude / 90]; // Mar, Jun, Sep, Dec
  const approxDay = [20, 21, 22, 21][targetLongitude / 90];
  let low = new Date(Date.UTC(year, approxMonth, approxDay - 5, 0, 0, 0));
  let high = new Date(Date.UTC(year, approxMonth, approxDay + 5, 0, 0, 0));
  for (let i = 0; i < 30; i++) {
    const mid = new Date((low.getTime() + high.getTime()) / 2);
    const lambda = sunEclipticLongitude(julianDate(mid));
    let diff = lambda - targetLongitude;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    if (Math.abs(diff) < 0.0001) return mid;
    if (diff < 0) low = mid;
    else high = mid;
  }
  return new Date((low.getTime() + high.getTime()) / 2);
}

/**
 * Get the winter solstice moment for a given year (Northern Hemisphere).
 * Returns the exact UTC Date when the Sun's ecliptic longitude is 270°.
 */
export function getWinterSolstice(year) {
  return findSolsticeEquinoxMoment(year, 270);
}

/**
 * Get the summer solstice moment for a given year (Northern Hemisphere).
 * Returns the exact UTC Date when the Sun's ecliptic longitude is 90°.
 */
export function getSummerSolstice(year) {
  return findSolsticeEquinoxMoment(year, 90);
}

/**
 * Get the March (vernal/spring) equinox moment for a given year.
 * Returns the exact UTC Date when the Sun's ecliptic longitude is 0°.
 */
export function getMarchEquinox(year) {
  return findSolsticeEquinoxMoment(year, 0);
}

/**
 * Get the September (autumnal) equinox moment for a given year.
 * Returns the exact UTC Date when the Sun's ecliptic longitude is 180°.
 */
export function getSeptemberEquinox(year) {
  return findSolsticeEquinoxMoment(year, 180);
}

/**
 * Earth's perihelion (closest to the Sun) or aphelion (farthest) in a given year.
 * Meeus "Astronomical Algorithms" (Ch 38), including the corrections for the Moon's pull
 * on Earth; accurate to a few hours.
 * @param {number} year
 * @param {boolean} aphelion - true for aphelion, false for perihelion
 * @returns {Date} The UTC moment of the event
 */
function getEarthApsis(year, aphelion) {
  let k = Math.round(0.99997 * (year - 2000.01));
  if (aphelion) k += 0.5;
  const rad = Math.PI / 180;
  const A = [
    328.41 + 132.788585 * k,
    316.13 + 584.903153 * k,
    346.20 + 450.380738 * k,
    136.95 + 659.306737 * k,
    249.52 + 329.653368 * k,
  ].map((a) => Math.sin(a * rad));
  const coefficients = aphelion
    ? [-1.352, 0.061, 0.062, 0.029, 0.031]
    : [1.278, -0.055, -0.091, -0.056, -0.045];
  const correction = coefficients.reduce((sum, c, i) => sum + c * A[i], 0);
  const jde = 2451547.507 + 365.2596358 * k + 0.0000000156 * k * k + correction;
  return new Date((jde - 2440587.5) * 86400000);
}

/** Earth's perihelion (closest to the Sun, early January) for a given year */
export function getPerihelion(year) {
  return getEarthApsis(year, false);
}

/** Earth's aphelion (farthest from the Sun, early July) for a given year */
export function getAphelion(year) {
  return getEarthApsis(year, true);
}

/**
 * Noon on a calendar day at a location, as an instant. SunCalc picks the solar transit
 * nearest to the instant it's given, so this decides which day's sunrise/sunset we get.
 * Uses civil noon in the timezone if given, otherwise mean solar noon at the longitude —
 * never the browser's timezone, which may be far from the location.
 * @param {Date} date - Calendar day (only year/month/day are used)
 * @param {number} longitude
 * @param {string|null} timezone - IANA timezone
 * @returns {Date}
 */
function noonOnDay(date, longitude, timezone) {
  const y = date.getFullYear(), m = date.getMonth(), d = date.getDate();
  if (timezone) return dateAtLocalInTimezone(y, m + 1, d, 12, 0, timezone);
  return new Date(Date.UTC(y, m, d, 12) - longitude * 240000); // 4 min per degree
}

/**
 * Calculate sun data for a specific date and location
 * @param {Date} date - The calendar day to calculate for (only year/month/day are used)
 * @param {number} latitude - The latitude (-90 to 90)
 * @param {number} longitude - The longitude (-180 to 180), defaults to 0
 * @param {string|null} [timezone] - IANA timezone of the location; the calendar day is interpreted in it
 * @returns {Object} Sun data including sunrise, sunset, daylight duration, etc.
 */
const _sunDataCache = new LRUCache(CACHE_MAX_LARGE);
export function getSunData(date, latitude, longitude = 0, timezone = null) {
  const cacheKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}:${latitude}:${longitude}:${timezone}`;
  const cached = _sunDataCache.get(cacheKey);
  if (cached) return cached;

  const noon = noonOnDay(date, longitude, timezone);
  const times = SunCalc.getTimes(noon, latitude, longitude);
  
  const sunrise = times.sunrise;
  const sunset = times.sunset;
  const solarNoon = times.solarNoon;
  
  // Calculate daylight duration in milliseconds
  let daylight;
  let isPolarDay = false;
  let isPolarNight = false;
  
  if (isNaN(sunrise.getTime()) || isNaN(sunset.getTime())) {
    // Polar day or polar night
    const noonPosition = SunCalc.getPosition(solarNoon, latitude, longitude);
    if (noonPosition.altitude > 0) {
      // Sun is above horizon at noon - polar day (midnight sun)
      isPolarDay = true;
      daylight = 24 * 60 * 60 * 1000; // 24 hours
    } else {
      // Sun is below horizon even at noon - polar night
      isPolarNight = true;
      daylight = 0;
    }
  } else {
    daylight = sunset.getTime() - sunrise.getTime();
  }
  
  // Get sun position at solar noon for max altitude
  const noonPosition = SunCalc.getPosition(solarNoon, latitude, longitude);
  const maxAltitude = noonPosition.altitude * 180 / Math.PI; // Convert radians to degrees
  
  const result = {
    date,
    sunrise: isPolarNight ? null : (isPolarDay ? null : sunrise),
    sunset: isPolarNight ? null : (isPolarDay ? null : sunset),
    solarNoon,
    daylight, // in milliseconds
    daylightHours: daylight / (1000 * 60 * 60), // in hours
    maxAltitude,
    isPolarDay,
    isPolarNight
  };
  _sunDataCache.set(cacheKey, result);
  return result;
}

/**
 * Length of each twilight phase on a given day, plus how long true (astronomical) night lasts.
 * A phase is a duration in ms, 'all night' if the sun never gets past the phase's deeper
 * boundary (e.g. nautical twilight lasting until dawn at high latitudes in summer),
 * 'all day' if the sun never gets past its shallower boundary (e.g. civil twilight around
 * midday during polar night), or null if the phase doesn't happen at all.
 * @param {Date} date - Calendar day
 * @param {number} latitude
 * @param {number} longitude
 * @param {string|null} timezone - IANA timezone of the location
 * @returns {{ morning: Object, evening: Object, night: number, lowestAltitude: number, lowestAt: Date }}
 *   morning/evening have civil, nautical, astronomical; night is ms of darkness below -18°
 */
export function getTwilightInfo(date, latitude, longitude = 0, timezone = null) {
  const t = SunCalc.getTimes(noonOnDay(date, longitude, timezone), latitude, longitude);
  const ok = (d) => d && !isNaN(d.getTime());

  // Phase between a shallower boundary (e.g. sunset) and a deeper one (e.g. dusk)
  const phase = (shallow, deep) => {
    if (ok(shallow) && ok(deep)) return Math.abs(deep.getTime() - shallow.getTime());
    if (ok(shallow)) return 'all night';
    if (ok(deep)) return 'all day';
    return null;
  };

  const lowestAltitude = SunCalc.getPosition(t.nadir, latitude, longitude).altitude * 180 / Math.PI;
  const highestAltitude = SunCalc.getPosition(t.solarNoon, latitude, longitude).altitude * 180 / Math.PI;
  let night;
  if (ok(t.night) && ok(t.nightEnd)) night = 24 * 3600000 - (t.night.getTime() - t.nightEnd.getTime());
  else night = highestAltitude < -18 ? 24 * 3600000 : 0; // dark all day, or never dark enough

  return {
    morning: {
      civil: phase(t.sunrise, t.dawn),
      nautical: phase(t.dawn, t.nauticalDawn),
      astronomical: phase(t.nauticalDawn, t.nightEnd),
    },
    evening: {
      civil: phase(t.sunset, t.dusk),
      nautical: phase(t.dusk, t.nauticalDusk),
      astronomical: phase(t.nauticalDusk, t.night),
    },
    night,
    lowestAltitude,
    lowestAt: t.nadir,
  };
}

/**
 * How much daylight has changed since the most recent solstice, and how much will change
 * until the next one. Uses longitude 0 like computeYearData, so values match the year charts.
 * @param {Date} date - Calendar day
 * @param {number} latitude
 * @param {string|null} timezone - IANA timezone; solstice dates are calendar days there
 * @returns {{ daylight: number, last: {name: string, date: Date, daylight: number}, next: {name: string, date: Date, daylight: number} }}
 */
export function getSolsticeProgress(date, latitude, timezone = null) {
  const year = date.getFullYear();
  const day = new Date(year, date.getMonth(), date.getDate());
  const solstices = [];
  for (const y of [year - 1, year, year + 1]) {
    solstices.push({ northernName: 'Summer Solstice', date: calendarDateInTimezone(getSummerSolstice(y), timezone) });
    solstices.push({ northernName: 'Winter Solstice', date: calendarDateInTimezone(getWinterSolstice(y), timezone) });
  }
  solstices.sort((a, b) => a.date - b.date);
  const nextIdx = solstices.findIndex((s) => s.date > day);
  const withDaylight = (s) => ({
    name: getSeasonName(s.northernName, latitude),
    date: s.date,
    daylight: getSunData(s.date, latitude).daylight,
  });
  return {
    daylight: getSunData(day, latitude).daylight,
    last: withDaylight(solstices[nextIdx - 1]),
    next: withDaylight(solstices[nextIdx]),
  };
}

/**
 * Cached wrapper around SunCalc.getTimes for arbitrary reference timestamps.
 * Unlike getTwilightTimes, this takes the exact timestamp to pass to SunCalc.
 */
const _sunCalcTimesCache = new LRUCache(CACHE_MAX_LARGE);
export function cachedSunCalcTimes(refDate, latitude, longitude) {
  const key = `${refDate.getTime()}:${latitude}:${longitude}`;
  const cached = _sunCalcTimesCache.get(key);
  if (cached) return cached;
  const times = SunCalc.getTimes(refDate, latitude, longitude);
  _sunCalcTimesCache.set(key, times);
  return times;
}

/**
 * Get sun position (altitude and azimuth) at a specific time
 * @param {Date} date - The date/time
 * @param {number} latitude - Latitude
 * @param {number} longitude - Longitude
 * @returns {{altitude: number, azimuth: number}} altitude and azimuth in degrees
 */
const _sunPosCache = new LRUCache(CACHE_MAX_LARGE);
export function getSunPosition(date, latitude, longitude = 0) {
  const cacheKey = `${date.getTime()}:${latitude}:${longitude}`;
  const cached = _sunPosCache.get(cacheKey);
  if (cached) return cached;

  const pos = SunCalc.getPosition(date, latitude, longitude);
  let azimuth = pos.azimuth * 180 / Math.PI;
  if (azimuth < 0) azimuth += 360;
  const result = {
    altitude: pos.altitude * 180 / Math.PI,
    azimuth
  };
  _sunPosCache.set(cacheKey, result);
  return result;
}

/**
 * Get sun path (altitude and azimuth) for each 5 minutes on a given date
 * @param {Date} date - The date
 * @param {number} latitude - Latitude
 * @param {number} longitude - Longitude
 * @param {string} [timezone] - IANA timezone; if provided, times are for midnight–midnight in this zone (avoids 1h offset vs polar markers)
 * @returns {Array<{time: Date, altitude: number, azimuth: number}>} altitude/azimuth in degrees
 */
export function getSunPathForDay(date, latitude, longitude = 0, timezone = null) {
  const cal = timezone ? getCalendarDayInTimezone(date, timezone) : { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() };
  const { year, month, day } = cal;
  const points = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let min = 0; min < 60; min += 5) {
      const d = timezone ? dateAtLocalInTimezone(year, month, day, hour, min, timezone) : new Date(year, month - 1, day, hour, min, 0);
      const pos = SunCalc.getPosition(d, latitude, longitude);
      const altitude = pos.altitude * 180 / Math.PI;
      let azimuth = pos.azimuth * 180 / Math.PI;
      if (azimuth < 0) azimuth += 360;
      points.push({ time: d, altitude, azimuth });
    }
  }
  return points;
}

/**
 * Compute sun data for all days in a year
 * @param {number} latitude - The latitude (-90 to 90)
 * @param {number} year - The year to compute
 * @returns {Array} Array of sun data for each day
 */
const _yearDataCache = new LRUCache(CACHE_MAX_SMALL);

export function computeYearData(latitude, year) {
  const key = `${latitude}:${year}`;
  const cached = _yearDataCache.get(key);
  if (cached) return cached;

  const daysInYear = getDaysInYear(year);
  const data = [];
  for (let dayOfYear = 1; dayOfYear <= daysInYear; dayOfYear++) {
    const date = new Date(year, 0, dayOfYear);
    const sunData = getSunData(date, latitude);
    data.push(sunData);
  }

  _yearDataCache.set(key, data);
  return data;
}

/**
 * Find the opposite date (mirror date) - the date with the same amount of daylight
 * as the selected date, on the other half of the year.
 * Uses a fixed latitude (45°) so the mirror date is consistent regardless of user location.
 * @param {Date} currentDate - The current date
 * @returns {Object|null} Object with date property for the mirror date, or null if not found
 */
export function findOppositeDate(currentDate) {
  const year = currentDate.getFullYear();
  
  // Use fixed latitude of 45° for consistent mirror dates across all locations
  const MIRROR_LATITUDE = 45;
  const yearData = computeYearData(MIRROR_LATITUDE, year);
  
  if (!yearData || yearData.length === 0) return null;

  const daysInYear = yearData.length;
  // getDayOfYear is 1-based: Jan 1 = 1, Dec 31 = 365 (or 366)
  const currentDOY = getDayOfYear(currentDate);
  const currentData = yearData[currentDOY - 1];
  if (!currentData) return null;

  const summerSolsticeDOY = getDayOfYear(getSummerSolstice(year));
  const winterSolsticeDOY = getDayOfYear(getWinterSolstice(year));

  // Mirror across the NEAREST solstice. Daylight is symmetric around each solstice,
  // so Dec 25 mirrors to ~Dec 17 (both near winter solstice), and
  // Mar 1 mirrors to ~Oct 12 (both equidistant from summer solstice).
  
  // Calculate distance to each solstice (handling year wrap for winter solstice)
  const distToSummer = Math.min(
    Math.abs(currentDOY - summerSolsticeDOY),
    daysInYear - Math.abs(currentDOY - summerSolsticeDOY)
  );
  const distToWinter = Math.min(
    Math.abs(currentDOY - winterSolsticeDOY),
    daysInYear - Math.abs(currentDOY - winterSolsticeDOY)
  );
  
  // Reflect across the nearest solstice
  const nearestSolsticeDOY = distToWinter <= distToSummer ? winterSolsticeDOY : summerSolsticeDOY;
  
  // Calculate the reflected DOY
  let mirrorDOY = 2 * nearestSolsticeDOY - currentDOY;
  // Wrap around the year
  if (mirrorDOY < 1) mirrorDOY += daysInYear;
  if (mirrorDOY > daysInYear) mirrorDOY -= daysInYear;
  
  // Search a window around the reflected DOY for the best daylight match
  // (the reflection is approximate because the daylight curve isn't perfectly symmetric)
  const SEARCH_WINDOW = 15;
  let bestDOY = null;
  let bestDiff = Infinity;
  
  for (let offset = -SEARCH_WINDOW; offset <= SEARCH_WINDOW; offset++) {
    let doy = mirrorDOY + offset;
    if (doy < 1) doy += daysInYear;
    if (doy > daysInYear) doy -= daysInYear;
    if (doy === currentDOY) continue; // never pick the same day as its own mirror
    const data = yearData[doy - 1];
    if (!data) continue;
    const diff = Math.abs(data.daylight - currentData.daylight);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestDOY = doy;
    }
  }

  if (bestDOY == null) return null;
  return { date: new Date(year, 0, bestDOY) };
}

/**
 * Find the date when daylight reaches a certain duration
 * @param {Array} yearData - The precomputed year data
 * @param {number} targetHours - The target daylight hours
 * @returns {Array} Array of dates (up to 2) when this duration is reached
 */
export function findDatesWithDaylight(yearData, targetHours) {
  const targetMs = targetHours * 60 * 60 * 1000;
  const threshold = 15 * 60 * 1000; // 15 minutes tolerance
  
  const results = [];
  let lastDaylight = null;
  
  for (let i = 0; i < yearData.length; i++) {
    const data = yearData[i];
    const daylight = data.daylight;
    
    // Check if we crossed the target
    if (lastDaylight !== null) {
      if ((lastDaylight < targetMs && daylight >= targetMs) ||
          (lastDaylight > targetMs && daylight <= targetMs)) {
        // We crossed the target, find the closer one
        const prevDiff = Math.abs(lastDaylight - targetMs);
        const currDiff = Math.abs(daylight - targetMs);
        
        if (currDiff <= prevDiff) {
          results.push(data);
        } else {
          results.push(yearData[i - 1]);
        }
      }
    }
    
    lastDaylight = daylight;
  }
  
  // Remove duplicates and limit to 2 results
  const unique = [];
  for (const r of results) {
    if (!unique.some(u => Math.abs(getDayOfYear(u.date) - getDayOfYear(r.date)) < 5)) {
      unique.push(r);
    }
  }
  
  return unique.slice(0, 2);
}

/**
 * Find the date when we gain a certain amount of daylight from the current date
 * @param {Date} currentDate - The starting date
 * @param {Array} yearData - The precomputed year data
 * @param {number} gainHours - The hours of daylight to gain
 * @returns {Object|null} The date data when this is reached, or null
 */
export function findDateWithGain(currentDate, yearData, gainHours) {
  const currentDOY = getDayOfYear(currentDate);
  const currentData = yearData[currentDOY - 1];
  if (!currentData) return null;
  
  const targetDaylight = currentData.daylight + (gainHours * 60 * 60 * 1000);
  const threshold = 5 * 60 * 1000; // 5 minutes tolerance
  const isGain = gainHours > 0;
  const currentDaylight = currentData.daylight;
  
  // Search forward from current date
  for (let offset = 1; offset < yearData.length; offset++) {
    let searchDOY = currentDOY + offset;
    if (searchDOY > yearData.length) searchDOY -= yearData.length;
    
    const data = yearData[searchDOY - 1];
    if (!data) continue;
    
    // Ensure we're actually moving in the expected direction
    // For gains: daylight must be more than current
    // For losses: daylight must be less than current
    const movingCorrectDirection = isGain 
      ? data.daylight > currentDaylight 
      : data.daylight < currentDaylight;
    
    if (!movingCorrectDirection) continue;
    
    // For gains, find when daylight reaches or exceeds target
    // For losses, find when daylight falls to or below target
    const withinThreshold = Math.abs(data.daylight - targetDaylight) <= threshold;
    const reachedTarget = isGain 
      ? data.daylight >= targetDaylight 
      : data.daylight <= targetDaylight;
    
    if (withinThreshold || reachedTarget) {
      return data;
    }
  }
  
  return null;
}

/**
 * Format a duration in milliseconds to a human-readable string
 * @param {number} ms - Duration in milliseconds
 * @returns {string} Formatted string like "8h 32m"
 */
export function formatDuration(ms) {
  if (ms === 0) return '0h 0m';
  if (ms >= 24 * 60 * 60 * 1000) return '24h 0m';
  
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  
  return `${hours}h ${minutes}m`;
}

/**
 * Format a time to HH:MM
 * @param {Date} date - The date/time to format
 * @returns {string} Formatted time string
 */
export function formatTime(date) {
  if (!date || isNaN(date.getTime())) return '--:--';
  
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  
  return `${hours}:${minutes}`;
}

/**
 * Format a date to a short string (e.g., "Jan 15")
 * @param {Date} date - The date to format
 * @returns {string} Formatted date string
 */
export function formatDateShort(date) {
  if (!date) return '--';
  
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  return `${months[date.getMonth()]} ${date.getDate()}`;
}

/**
 * Get day stats for tooltip (date label, sunrise, sunset, daylight; handles polar day/night).
 * @param {Date} date
 * @param {number} latitude
 * @param {number} longitude
 * @param {string} [timezone] - IANA timezone for formatting times; if omitted uses formatTime (local)
 * @returns {{ dateLabel: string, sunrise: string, sunset: string, daylight: string, isPolarDay: boolean, isPolarNight: boolean }}
 */
export function getDayStatsForTooltip(date, latitude, longitude, timezone = null) {
  if (!date) return { dateLabel: '--', sunrise: '--', sunset: '--', daylight: '--', isPolarDay: false, isPolarNight: false };
  const data = getSunData(date, latitude, longitude, timezone);
  const dateLabel = formatDateShort(date);
  const fmtTime = timezone
    ? (d) => formatTimeInTimezone(d, timezone)
    : (d) => (d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0'));
  let sunrise = '--';
  let sunset = '--';
  if (data.isPolarDay) {
    sunrise = 'Polar day';
    sunset = 'Polar day';
  } else if (data.isPolarNight) {
    sunrise = 'Polar night';
    sunset = 'Polar night';
  } else {
    if (data.sunrise) sunrise = fmtTime(data.sunrise);
    if (data.sunset) sunset = fmtTime(data.sunset);
  }
  const daylight = formatDuration(data.daylight ?? 0);
  return { dateLabel, sunrise, sunset, daylight, isPolarDay: data.isPolarDay, isPolarNight: data.isPolarNight };
}

/**
 * Calculate the angle on the circular year graph for a given date
 * 0 degrees is at the top (winter solstice), 180 degrees at bottom (summer solstice)
 * @param {Date} date - The date
 * @param {number} year - The year
 * @returns {number} Angle in degrees (0-360)
 */
export function getDateAngle(date, year) {
  const daysInYear = getDaysInYear(year);
  const winterSolstice = getWinterSolstice(year);
  const winterSolsticeDOY = getDayOfYear(winterSolstice);
  const dateDOY = getDayOfYear(date);
  
  // Calculate days from winter solstice
  let daysFromWS = dateDOY - winterSolsticeDOY;
  
  // Handle wrap around year boundary
  if (daysFromWS < 0) {
    daysFromWS += daysInYear;
  }
  
  // Convert to angle (0 at top, clockwise)
  const angle = (daysFromWS / daysInYear) * 360;
  
  return angle;
}

/**
 * Get the season name adjusted for hemisphere
 * In the southern hemisphere, seasons are opposite
 * @param {string} northernName - The name from northern hemisphere perspective
 * @param {number} latitude - The latitude (negative for southern hemisphere)
 * @returns {string} The hemisphere-appropriate season name
 */
export function getSeasonName(northernName, latitude) {
  if (latitude >= 0) return northernName;
  
  // Southern hemisphere - swap the names
  const swaps = {
    'Winter Solstice': 'Summer Solstice',
    'Summer Solstice': 'Winter Solstice',
    'Spring Equinox': 'Autumn Equinox',
    'Autumn Equinox': 'Spring Equinox'
  };
  return swaps[northernName] || northernName;
}

/**
 * Get upcoming astronomical events (equinoxes and solstices)
 * @param {Date} currentDate - The current date
 * @param {number} latitude - The latitude (for hemisphere-appropriate names)
 * @param {number} count - Number of events to return
 * @param {string|null} [timezone] - IANA timezone; event dates are the calendar day the event falls on there
 * @returns {Array} Array of upcoming events with date (calendar day) and name
 */
export function getUpcomingAstronomicalEvents(currentDate, latitude = 0, count = 4, timezone = null) {
  const events = [];
  const year = currentDate.getFullYear();
  const eventDefs = [
    { northernName: 'Spring Equinox', getDate: (y) => getMarchEquinox(y) },
    { northernName: 'Summer Solstice', getDate: (y) => getSummerSolstice(y) },
    { northernName: 'Autumn Equinox', getDate: (y) => getSeptemberEquinox(y) },
    { northernName: 'Winter Solstice', getDate: (y) => getWinterSolstice(y) },
    { northernName: 'Perihelion (Earth closest to the Sun)', getDate: (y) => getPerihelion(y) },
    { northernName: 'Aphelion (Earth farthest from the Sun)', getDate: (y) => getAphelion(y) },
  ];
  const allEvents = [
    ...eventDefs.map((e) => ({ northernName: e.northernName, date: calendarDateInTimezone(e.getDate(year), timezone) })),
    ...eventDefs.map((e) => ({ northernName: e.northernName, date: calendarDateInTimezone(e.getDate(year + 1), timezone) })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  const startOfSelectedDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
  for (const event of allEvents) {
    if (event.date >= startOfSelectedDay && events.length < count) {
      events.push({
        name: getSeasonName(event.northernName, latitude),
        date: event.date
      });
    }
  }
  return events;
}

/**
 * Find upcoming dates when daylight crosses integer hour thresholds
 * Shows "More than Xh of daylight" when crossing above X hours, "Less than Xh of daylight" when crossing below
 * Special handling for polar night and midnight sun events at extreme latitudes
 * @param {Date} currentDate - The current date
 * @param {Array} yearData - The precomputed year data  
 * @param {number} latitude - The latitude
 * @param {number} count - Number of milestones to find
 * @returns {Array} Array of milestones with date and crossing description
 */
export function findUpcomingDaylightMilestones(currentDate, yearData, latitude, count = 10) {
  const currentDOY = getDayOfYear(currentDate);
  
  // Use latitude-dependent thresholds for extreme regions
  // At the poles, SunCalc may report values that don't quite reach 0 or 24 due to refraction
  const isExtremeLatitude = Math.abs(latitude) > 66.5; // Arctic/Antarctic circle
  // Polar night threshold: daylight below this triggers polar night events
  // At extreme latitudes, SunCalc may report small daylight values even during polar night
  const POLAR_NIGHT_THRESHOLD = isExtremeLatitude ? 0.5 : 0.1;  // 30 min vs 6 min
  // Midnight sun threshold: daylight above this triggers midnight sun events  
  // The day before true polar day (24h) typically has ~23.9h of daylight
  // Using 23.9 ensures we catch the actual polar day transition, not just "long days"
  const MIDNIGHT_SUN_THRESHOLD = isExtremeLatitude ? 23.9 : 23.9; // 23h54m for both
  const SUPPRESSION_WINDOW = isExtremeLatitude ? 60 : 30; // Wider window for polar regions
  
  // Helper to get daylight hours for an offset from current date
  const getHoursAtOffset = (offset) => {
    let doy = currentDOY + offset;
    if (doy > yearData.length) doy -= yearData.length;
    if (doy < 1) doy += yearData.length;
    const data = yearData[doy - 1];
    return data ? data.daylight / (1000 * 60 * 60) : null;
  };
  
  // Helper to get yearData entry for an offset
  const getDataAtOffset = (offset) => {
    let doy = currentDOY + offset;
    if (doy > yearData.length) doy -= yearData.length;
    if (doy < 1) doy += yearData.length;
    return yearData[doy - 1] || null;
  };
  
  // FIRST PASS: Pre-scan the entire year for extreme events
  // Use both threshold-based detection AND isPolarDay/isPolarNight flags for reliability
  // Start at offset 0 so transitions on the selected date (e.g. today) are included
  const extremeEvents = [];
  for (let offset = 0; offset < yearData.length; offset++) {
    const prevData = getDataAtOffset(offset - 1);
    const currData = getDataAtOffset(offset);
    if (!prevData || !currData) continue;
    
    const prevHours = prevData.daylight / (1000 * 60 * 60);
    const currHours = currData.daylight / (1000 * 60 * 60);
    
    // Polar night begins: transition from having daylight to isPolarNight
    // Use flag-based detection for reliability at extreme latitudes
    if (!prevData.isPolarNight && currData.isPolarNight) {
      extremeEvents.push({ type: 'polar_night_begin', offset, direction: 'decreasing' });
    }
    // Also catch threshold-based for non-extreme latitudes or SunCalc edge cases
    else if (prevHours >= POLAR_NIGHT_THRESHOLD && currHours < POLAR_NIGHT_THRESHOLD) {
      extremeEvents.push({ type: 'polar_night_begin', offset, direction: 'decreasing' });
    }
    
    // Polar night ends: transition from isPolarNight to having daylight
    if (prevData.isPolarNight && !currData.isPolarNight) {
      extremeEvents.push({ type: 'polar_night_end', offset, direction: 'increasing' });
    }
    // Also catch threshold-based
    else if (prevHours < POLAR_NIGHT_THRESHOLD && currHours >= POLAR_NIGHT_THRESHOLD) {
      extremeEvents.push({ type: 'polar_night_end', offset, direction: 'increasing' });
    }
    
    // Midnight sun begins: transition to isPolarDay (24h daylight)
    if (!prevData.isPolarDay && currData.isPolarDay) {
      extremeEvents.push({ type: 'midnight_sun_begin', offset, direction: 'increasing' });
    }
    // Also catch threshold-based for near-polar-day conditions
    else if (prevHours <= MIDNIGHT_SUN_THRESHOLD && currHours > MIDNIGHT_SUN_THRESHOLD) {
      extremeEvents.push({ type: 'midnight_sun_begin', offset, direction: 'increasing' });
    }
    
    // Midnight sun ends: transition from isPolarDay to normal
    if (prevData.isPolarDay && !currData.isPolarDay) {
      extremeEvents.push({ type: 'midnight_sun_end', offset, direction: 'decreasing' });
    }
    // Also catch threshold-based
    else if (prevHours > MIDNIGHT_SUN_THRESHOLD && currHours <= MIDNIGHT_SUN_THRESHOLD) {
      extremeEvents.push({ type: 'midnight_sun_end', offset, direction: 'decreasing' });
    }
  }
  
  // Sort extreme events by offset
  extremeEvents.sort((a, b) => a.offset - b.offset);
  
  // Helper to check if an offset is in a transition period where we should suppress hour crossings
  const shouldSuppressHourCrossing = (offset, isDecreasing) => {
    for (const event of extremeEvents) {
      const daysUntilExtreme = event.offset - offset;
      const daysSinceExtreme = offset - event.offset;
      
      // Suppress ON and BEFORE an extreme event
      // Using >= 0 to also suppress on the same day as the extreme event itself
      if (daysUntilExtreme >= 0 && daysUntilExtreme <= SUPPRESSION_WINDOW) {
        // On/before polar night begins, suppress "Less than Xh" crossings
        if (isDecreasing && event.type === 'polar_night_begin') return true;
        // On/before midnight sun begins, suppress "More than Xh" crossings
        if (!isDecreasing && event.type === 'midnight_sun_begin') return true;
      }
      
      // Suppress ON and briefly AFTER an extreme event (only during rapid transition, ~7 days)
      // Using >= 0 to also suppress on the same day as the extreme event itself
      // Don't use full SUPPRESSION_WINDOW here as it would hide too many milestones
      if (daysSinceExtreme >= 0 && daysSinceExtreme <= 7) {
        // On/after midnight sun ends, briefly suppress "Less than Xh"
        if (isDecreasing && event.type === 'midnight_sun_end') return true;
        // On/after polar night ends, briefly suppress "More than Xh"
        if (!isDecreasing && event.type === 'polar_night_end') return true;
      }
    }
    return false;
  };
  
  // SECOND PASS: Collect milestones (offset 0 = selected date, e.g. today)
  const milestones = [];
  const foundCrossings = new Set();
  
  for (let offset = 0; offset < yearData.length && milestones.length < count; offset++) {
    const prevData = getDataAtOffset(offset - 1);
    const currData = getDataAtOffset(offset);
    if (!prevData || !currData) continue;
    
    const prevHours = prevData.daylight / (1000 * 60 * 60);
    const currHours = currData.daylight / (1000 * 60 * 60);
    
    const actualDate = new Date(currentDate);
    actualDate.setDate(actualDate.getDate() + offset);
    
    // Add extreme events (these are never suppressed)
    // Use flag-based detection for reliability, with threshold fallback
    
    // Polar night begins
    const polarNightBegins = (!prevData.isPolarNight && currData.isPolarNight) ||
      (prevHours >= POLAR_NIGHT_THRESHOLD && currHours < POLAR_NIGHT_THRESHOLD);
    if (polarNightBegins && !foundCrossings.has('polar_night_begin')) {
      foundCrossings.add('polar_night_begin');
      milestones.push({ date: new Date(actualDate), description: 'Polar night begins (0h daylight)' });
    }
    
    // Polar night ends
    const polarNightEnds = (prevData.isPolarNight && !currData.isPolarNight) ||
      (prevHours < POLAR_NIGHT_THRESHOLD && currHours >= POLAR_NIGHT_THRESHOLD);
    if (polarNightEnds && !foundCrossings.has('polar_night_end')) {
      foundCrossings.add('polar_night_end');
      milestones.push({ date: new Date(actualDate), description: 'Polar night ends' });
    }
    
    // Midnight sun begins
    const midnightSunBegins = (!prevData.isPolarDay && currData.isPolarDay) ||
      (prevHours <= MIDNIGHT_SUN_THRESHOLD && currHours > MIDNIGHT_SUN_THRESHOLD);
    if (midnightSunBegins && !foundCrossings.has('midnight_sun_begin')) {
      foundCrossings.add('midnight_sun_begin');
      milestones.push({ date: new Date(actualDate), description: 'Midnight sun begins (24h daylight)' });
    }
    
    // Midnight sun ends
    const midnightSunEnds = (prevData.isPolarDay && !currData.isPolarDay) ||
      (prevHours > MIDNIGHT_SUN_THRESHOLD && currHours <= MIDNIGHT_SUN_THRESHOLD);
    if (midnightSunEnds && !foundCrossings.has('midnight_sun_end')) {
      foundCrossings.add('midnight_sun_end');
      milestones.push({ date: new Date(actualDate), description: 'Midnight sun ends' });
    }
    
    // Check for crossings of each integer hour (1-23)
    for (let h = 1; h <= 23; h++) {
      // Crossing above: prev < h <= curr (daylight increasing)
      if (prevHours < h && currHours >= h) {
        const key = `above:${h}`;
        if (!foundCrossings.has(key)) {
          // Check if we should suppress this crossing
          if (!shouldSuppressHourCrossing(offset, false)) {
            foundCrossings.add(key);
            milestones.push({ date: new Date(actualDate), description: `More than ${h}h of daylight` });
          }
        }
      }
      // Crossing below: prev >= h > curr (daylight decreasing)
      if (prevHours >= h && currHours < h) {
        const key = `below:${h}`;
        if (!foundCrossings.has(key)) {
          // Check if we should suppress this crossing
          if (!shouldSuppressHourCrossing(offset, true)) {
            foundCrossings.add(key);
            milestones.push({ date: new Date(actualDate), description: `Less than ${h}h of daylight` });
          }
        }
      }
    }
  }
  
  // THIRD PASS: Ensure paired extreme events are included
  // At the poles, when one extreme ends, the opposite begins - ensure both are shown
  const addMissingExtremeEvent = (existingType, missingType, missingDesc) => {
    const hasExisting = milestones.some(m => m.description.toLowerCase().includes(existingType));
    const hasMissing = milestones.some(m => m.description === missingDesc);

    if (hasExisting && !hasMissing) {
      const event = extremeEvents.find(e => e.type === missingType);
      if (event) {
        const date = new Date(currentDate);
        date.setDate(date.getDate() + event.offset);
        milestones.push({ date, description: missingDesc });
      }
    }
  };
  
  // Ensure paired events: if we have "begins" add "ends" and vice versa
  addMissingExtremeEvent('midnight sun begins', 'midnight_sun_end', 'Midnight sun ends');
  addMissingExtremeEvent('midnight sun ends', 'midnight_sun_begin', 'Midnight sun begins (24h daylight)');
  addMissingExtremeEvent('polar night begins', 'polar_night_end', 'Polar night ends');
  addMissingExtremeEvent('polar night ends', 'polar_night_begin', 'Polar night begins (0h daylight)');
  
  // At extreme latitudes, also ensure the complementary event is shown
  // (e.g., if midnight sun ends, polar night should begin soon after at the poles)
  if (isExtremeLatitude) {
    const hasMidnightSunEnd = milestones.some(m => m.description.includes('Midnight sun ends'));
    const hasPolarNightBegin = milestones.some(m => m.description.includes('Polar night begins'));
    const hasPolarNightEnd = milestones.some(m => m.description.includes('Polar night ends'));
    const hasMidnightSunBegin = milestones.some(m => m.description.includes('Midnight sun begins'));
    
    // If midnight sun ends but no polar night begins, add it
    if (hasMidnightSunEnd && !hasPolarNightBegin) {
      const event = extremeEvents.find(e => e.type === 'polar_night_begin');
      if (event) {
        const date = new Date(currentDate);
        date.setDate(date.getDate() + event.offset);
        milestones.push({ date, description: 'Polar night begins (0h daylight)' });
      }
    }
    // If polar night ends but no midnight sun begins, add it
    if (hasPolarNightEnd && !hasMidnightSunBegin) {
      const event = extremeEvents.find(e => e.type === 'midnight_sun_begin');
      if (event) {
        const date = new Date(currentDate);
        date.setDate(date.getDate() + event.offset);
        milestones.push({ date, description: 'Midnight sun begins (24h daylight)' });
      }
    }
  }
  
  // Sort by date
  milestones.sort((a, b) => a.date.getTime() - b.date.getTime());
  
  return milestones;
}

// Cached formatters for decimal hour extraction (avoids recreating Intl objects per call)
const _hourFormatters = new Map();
const _minFormatters = new Map();
function _getHourFormatter(timezone) {
  let fmt = _hourFormatters.get(timezone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: 'numeric', hour12: false });
    _hourFormatters.set(timezone, fmt);
  }
  return fmt;
}
function _getMinFormatter(timezone) {
  let fmt = _minFormatters.get(timezone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, minute: 'numeric' });
    _minFormatters.set(timezone, fmt);
  }
  return fmt;
}

/**
 * Helper to get sunrise time in decimal hours for a given timezone
 */
function getSunriseDecimalHours(sunData, timezone) {
  if (!sunData.sunrise) return null;
  try {
    const hour = parseInt(_getHourFormatter(timezone).format(sunData.sunrise));
    const min = parseInt(_getMinFormatter(timezone).format(sunData.sunrise));
    return hour + min / 60;
  } catch {
    return sunData.sunrise.getUTCHours() + sunData.sunrise.getUTCMinutes() / 60;
  }
}

/**
 * Find upcoming dates when sunrise crosses integer hour thresholds
 * Shows "Sunrise before 08:00" when sunrise becomes earlier than 8, "Sunrise after 08:00" when later
 * @param {Date} currentDate - The current date
 * @param {number} latitude - The latitude
 * @param {number} longitude - The longitude
 * @param {string} timezone - The timezone
 * @param {number} count - Number of milestones to find
 * @returns {Array} Array of milestones with date and crossing description
 */
const _sunriseMilestonesCache = new LRUCache(CACHE_MAX_SMALL);
export function findUpcomingSunriseMilestones(currentDate, latitude, longitude, timezone, count = 8) {
  const key = `${currentDate.getFullYear()}-${currentDate.getMonth()}-${currentDate.getDate()}:${latitude}:${longitude}:${timezone}:${count}`;
  const cached = _sunriseMilestonesCache.get(key);
  if (cached) return cached;

  const milestones = [];
  const isExtremeLatitude = Math.abs(latitude) > 66.5;
  
  // Start from day before selected date so events on the selected date (e.g. today) are included
  const dayBefore = new Date(currentDate);
  dayBefore.setDate(dayBefore.getDate() - 1);
  const initialSunData = getSunData(dayBefore, latitude, longitude, timezone);
  let prevHours = getSunriseDecimalHours(initialSunData, timezone);
  
  // Search from selected date (offset 0) up to 365 days forward
  for (let offset = 0; offset <= 365 && milestones.length < count; offset++) {
    const calendarDate = new Date(currentDate);
    calendarDate.setDate(calendarDate.getDate() + offset);
    
    const sunData = getSunData(calendarDate, latitude, longitude, timezone);
    const currHours = getSunriseDecimalHours(sunData, timezone);
    
    if (prevHours !== null && currHours !== null && sunData.sunrise) {
      // Skip hour checks when there's a midnight wrap-around
      // This avoids false positives during polar transitions
      const isWrapAround = (prevHours > 20 && currHours < 4) || (prevHours < 4 && currHours > 20);
      
      if (!isWrapAround) {
        // Use actual sunrise date (may differ from calendar date at extreme latitudes)
        const eventDate = calendarDateInTimezone(sunData.sunrise, timezone);
        
        // Hour range to check
        const minHour = isExtremeLatitude ? 0 : 3;
        const maxHour = 12;
        
        for (let h = minHour; h <= maxHour; h++) {
          // Getting earlier (sunrise before this hour): prev >= h > curr
          if (prevHours >= h && currHours < h) {
            milestones.push({
              date: eventDate,
              description: `Sunrise before ${String(h).padStart(2, '0')}:00`
            });
          }
          // Getting later (sunrise after this hour): prev < h <= curr
          if (prevHours < h && currHours >= h) {
            milestones.push({
              date: eventDate,
              description: `Sunrise after ${String(h).padStart(2, '0')}:00`
            });
          }
        }
      }
    }
    
    prevHours = currHours;
  }
  
  _sunriseMilestonesCache.set(key, milestones);
  return milestones;
}

/**
 * Helper to get sunset time in decimal hours for a given timezone
 */
function getSunsetDecimalHours(sunData, timezone) {
  if (!sunData.sunset) return null;
  try {
    const hour = parseInt(_getHourFormatter(timezone).format(sunData.sunset));
    const min = parseInt(_getMinFormatter(timezone).format(sunData.sunset));
    return hour + min / 60;
  } catch {
    return sunData.sunset.getUTCHours() + sunData.sunset.getUTCMinutes() / 60;
  }
}

/**
 * Find upcoming dates when sunset crosses integer hour thresholds
 * Shows "Sunset after 17:00" when sunset becomes later than 5pm, "Sunset before 17:00" when earlier
 * @param {Date} currentDate - The current date
 * @param {number} latitude - The latitude
 * @param {number} longitude - The longitude
 * @param {string} timezone - The timezone
 * @param {number} count - Number of milestones to find
 * @returns {Array} Array of milestones with date and crossing description
 */
const _sunsetMilestonesCache = new LRUCache(CACHE_MAX_SMALL);
export function findUpcomingSunsetMilestones(currentDate, latitude, longitude, timezone, count = 8) {
  const key = `${currentDate.getFullYear()}-${currentDate.getMonth()}-${currentDate.getDate()}:${latitude}:${longitude}:${timezone}:${count}`;
  const cached = _sunsetMilestonesCache.get(key);
  if (cached) return cached;

  const milestones = [];
  const isExtremeLatitude = Math.abs(latitude) > 66.5;
  
  // Start from day before selected date so events on the selected date (e.g. today) are included
  const dayBefore = new Date(currentDate);
  dayBefore.setDate(dayBefore.getDate() - 1);
  const initialSunData = getSunData(dayBefore, latitude, longitude, timezone);
  let prevHours = getSunsetDecimalHours(initialSunData, timezone);
  
  // Search from selected date (offset 0) up to 365 days forward
  for (let offset = 0; offset <= 365 && milestones.length < count; offset++) {
    const calendarDate = new Date(currentDate);
    calendarDate.setDate(calendarDate.getDate() + offset);
    
    const sunData = getSunData(calendarDate, latitude, longitude, timezone);
    const currHours = getSunsetDecimalHours(sunData, timezone);
    
    if (prevHours !== null && currHours !== null && sunData.sunset) {
      // Skip hour checks when there's a midnight wrap-around (sunset going from ~23:xx to ~00:xx or vice versa)
      // This avoids false positives like "Sunset before 23:00" when sunset is actually after midnight
      const isWrapAround = (prevHours > 20 && currHours < 4) || (prevHours < 4 && currHours > 20);
      
      if (!isWrapAround) {
        // Use actual sunset date (may differ from calendar date at extreme latitudes)
        const eventDate = calendarDateInTimezone(sunData.sunset, timezone);
        
        // Hour range to check
        const minHour = 15;
        const maxHour = isExtremeLatitude ? 23 : 22;
        
        for (let h = minHour; h <= maxHour; h++) {
          // Getting later (sunset after this hour): prev < h <= curr
          if (prevHours < h && currHours >= h) {
            milestones.push({
              date: eventDate,
              description: `Sunset after ${String(h).padStart(2, '0')}:00`
            });
          }
          // Getting earlier (sunset before this hour): prev >= h > curr
          if (prevHours >= h && currHours < h) {
            milestones.push({
              date: eventDate,
              description: `Sunset before ${String(h).padStart(2, '0')}:00`
            });
          }
        }
      }
    }
    
    prevHours = currHours;
  }
  
  _sunsetMilestonesCache.set(key, milestones);
  return milestones;
}

/**
 * Earliest/latest sunrise and sunset by clock time over the 12 months from the selected date.
 * By clock time, these don't fall on the solstices (the equation of time shifts them by
 * up to a few weeks), and DST can move them too.
 * Days where sunrise/sunset falls on a different calendar day (near polar day/night)
 * are skipped, since their clock time would wrap around midnight.
 * @param {Date} currentDate - Calendar day to start from
 * @param {number} latitude
 * @param {number} longitude
 * @param {string} timezone - IANA timezone of the location
 * @returns {Array<{date: Date, description: string, type: 'sunrise'|'sunset'}>} Sorted by date
 */
const _sunTimeExtremesCache = new LRUCache(CACHE_MAX_SMALL);
export function findSunTimeExtremes(currentDate, latitude, longitude, timezone) {
  const key = `${currentDate.getFullYear()}-${currentDate.getMonth()}-${currentDate.getDate()}:${latitude}:${longitude}:${timezone}`;
  const cached = _sunTimeExtremesCache.get(key);
  if (cached) return cached;

  const extremes = {
    earliestSunrise: null, latestSunrise: null,
    earliestSunset: null, latestSunset: null,
  };
  const consider = (name, better, day, time) => {
    const hours = clockHoursInTimezone(time, timezone);
    if (!extremes[name] || better(hours, extremes[name].hours)) {
      extremes[name] = { date: day, time, hours };
    }
  };
  const isSameDay = (time, day) => {
    const cal = getCalendarDayInTimezone(time, timezone);
    return cal.year === day.getFullYear() && cal.month === day.getMonth() + 1 && cal.day === day.getDate();
  };
  const earlier = (a, b) => a < b;
  const later = (a, b) => a > b;

  for (let offset = 0; offset < 366; offset++) {
    const day = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + offset);
    const sunData = getSunData(day, latitude, longitude, timezone);
    if (sunData.sunrise && isSameDay(sunData.sunrise, day)) {
      consider('earliestSunrise', earlier, day, sunData.sunrise);
      consider('latestSunrise', later, day, sunData.sunrise);
    }
    if (sunData.sunset && isSameDay(sunData.sunset, day)) {
      consider('earliestSunset', earlier, day, sunData.sunset);
      consider('latestSunset', later, day, sunData.sunset);
    }
  }

  const labels = [
    ['earliestSunrise', 'Earliest sunrise of the year', 'sunrise'],
    ['latestSunrise', 'Latest sunrise of the year', 'sunrise'],
    ['earliestSunset', 'Earliest sunset of the year', 'sunset'],
    ['latestSunset', 'Latest sunset of the year', 'sunset'],
  ];
  const result = labels
    .filter(([name]) => extremes[name])
    .map(([name, label, type]) => ({
      date: extremes[name].date,
      description: `${label} (${formatTimeInTimezone(extremes[name].time, timezone)})`,
      type,
    }))
    .sort((a, b) => a.date - b.date);
  _sunTimeExtremesCache.set(key, result);
  return result;
}

/**
 * Golden hour (sun between -4° and +6°) and blue hour (sun between -6° and -4°)
 * on a given day. Each period is [start, end]; either end is null if the sun doesn't
 * cross that boundary that day (e.g. golden light lasting all day in winter at high latitudes).
 * @param {Date} date - Calendar day
 * @param {number} latitude
 * @param {number} longitude
 * @param {string|null} timezone - IANA timezone of the location
 * @returns {{ golden: {morning: Array, evening: Array}, blue: {morning: Array, evening: Array} }}
 */
export function getGoldenBlueHours(date, latitude, longitude = 0, timezone = null) {
  const t = SunCalc.getTimes(noonOnDay(date, longitude, timezone), latitude, longitude);
  const valid = (d) => (d && !isNaN(d.getTime()) ? d : null);
  return {
    golden: {
      morning: [valid(t.blueHourEnd), valid(t.goldenHourEnd)],
      evening: [valid(t.goldenHour), valid(t.blueHourStart)],
    },
    blue: {
      morning: [valid(t.dawn), valid(t.blueHourEnd)],
      evening: [valid(t.blueHourStart), valid(t.dusk)],
    },
  };
}

/**
 * Solar noon for every day of a year, with the equation of time: how far solar noon is
 * from mean solar noon at the longitude (positive = sun is ahead, solar noon comes earlier).
 * solarNoon comes from SunCalc so it matches the rest of the app; equationOfTime uses the
 * more accurate equationOfTime() (SunCalc's solar noon runs about 1–1.5 min late).
 * @param {number} year
 * @param {number} latitude
 * @param {number} longitude
 * @param {string} timezone - IANA timezone of the location
 * @returns {Array<{date: Date, solarNoon: Date, clockHours: number, equationOfTime: number}>}
 *   clockHours is solar noon on the local clock; equationOfTime is in minutes
 */
const _solarNoonCache = new LRUCache(CACHE_MAX_SMALL);
export function computeSolarNoonYear(year, latitude, longitude, timezone) {
  const key = `${year}:${latitude}:${longitude}:${timezone}`;
  const cached = _solarNoonCache.get(key);
  if (cached) return cached;

  const result = [];
  for (let doy = 1; doy <= getDaysInYear(year); doy++) {
    const date = new Date(year, 0, doy);
    const { solarNoon } = getSunData(date, latitude, longitude, timezone);
    result.push({
      date,
      solarNoon,
      clockHours: clockHoursInTimezone(solarNoon, timezone),
      equationOfTime: equationOfTime(solarNoon),
    });
  }
  _solarNoonCache.set(key, result);
  return result;
}

/**
 * Get the UTC offset in minutes for a date in a specific timezone
 */
function getTimezoneOffset(date, timezone) {
  try {
    // Get the time string in the timezone
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      timeZoneName: 'shortOffset'
    });
    const parts = formatter.formatToParts(date);
    const offsetPart = parts.find(p => p.type === 'timeZoneName');
    if (!offsetPart) return null;
    
    // Parse offset like "GMT+1" or "GMT-5" or "GMT+5:30"
    const match = offsetPart.value.match(/GMT([+-])(\d+)(?::(\d+))?/);
    if (!match) return 0; // GMT with no offset
    
    const sign = match[1] === '+' ? 1 : -1;
    const hours = parseInt(match[2]) || 0;
    const minutes = parseInt(match[3]) || 0;
    return sign * (hours * 60 + minutes);
  } catch {
    return null;
  }
}

/**
 * Format time in a specific timezone as HH:MM
 */
function formatTimeInTz(date, timezone) {
  if (!date || isNaN(date.getTime())) return null;
  try {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    return formatter.format(date);
  } catch {
    return null;
  }
}

/**
 * Find upcoming DST (Daylight Saving Time) transitions
 * @param {Date} currentDate - The current date
 * @param {string} timezone - The timezone to check
 * @param {number} latitude - The latitude for sun calculations
 * @param {number} longitude - The longitude for sun calculations
 * @param {number} count - Number of transitions to find
 * @returns {Array} Array of DST transitions with date, description, and sun times
 */
const _dstCache = new LRUCache(CACHE_MAX_SMALL);
export function findUpcomingDSTChanges(currentDate, timezone, latitude, longitude, count = 2) {
  const key = `${currentDate.getFullYear()}-${currentDate.getMonth()}-${currentDate.getDate()}:${timezone}:${latitude}:${longitude}:${count}`;
  const cached = _dstCache.get(key);
  if (cached) return cached;

  const transitions = [];
  
  // Get noon offset for the day before we start searching
  const startDate = new Date(currentDate);
  startDate.setDate(startDate.getDate() - 1);
  let prevNoonOffset = getTimezoneOffset(noonOnDay(startDate, 0, timezone), timezone);
  
  // Search up to 400 days forward (to catch at least one full year)
  for (let offset = 0; offset <= 400 && transitions.length < count; offset++) {
    const date = new Date(currentDate);
    date.setDate(date.getDate() + offset);
    
    // Check offset at noon - safely after any early-morning DST change
    // (DST changes universally happen in early morning: 01:00-03:00)
    const noonOffset = getTimezoneOffset(noonOnDay(date, 0, timezone), timezone);
    
    if (prevNoonOffset !== null && noonOffset !== null && prevNoonOffset !== noonOffset) {
      // Offset changed between yesterday noon and today noon → DST changed today
      const offsetChange = noonOffset - prevNoonOffset;
      let description;
      
      if (offsetChange > 0) {
        // Clocks move forward (spring forward)
        description = `DST begins (clocks +${offsetChange / 60}h)`;
      } else {
        // Clocks move backward (fall back)
        description = `DST ends (clocks ${offsetChange / 60}h)`;
      }
      
      // Get sunrise/sunset times for DST date
      const sunData = getSunData(date, latitude, longitude, timezone);
      const sunriseTime = formatTimeInTz(sunData.sunrise, timezone);
      const sunsetTime = formatTimeInTz(sunData.sunset, timezone);
      
      transitions.push({
        date: date,
        description: description,
        sunriseTime: sunriseTime,
        sunsetTime: sunsetTime
      });
    }
    
    prevNoonOffset = noonOffset;
  }
  
  _dstCache.set(key, transitions);
  return transitions;
}
