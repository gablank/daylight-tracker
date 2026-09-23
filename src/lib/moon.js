import SunCalc from 'suncalc';
import { dateAtLocalInTimezone } from './utils.js';
import { LRUCache, CACHE_MAX_SMALL } from './cache.js';

const PHASE_NAMES = [
  'New Moon', 'Waxing Crescent', 'First Quarter', 'Waxing Gibbous',
  'Full Moon', 'Waning Gibbous', 'Last Quarter', 'Waning Crescent',
];

// Moon's altitude at rise/set: SunCalc's value (accounts for parallax and refraction)
const MOON_HORIZON = 0.133;

/**
 * Moon phase at an instant.
 * @param {Date} date
 * @returns {{ phase: number, fraction: number, name: string }}
 *   phase: 0 = new, 0.25 = first quarter, 0.5 = full, 0.75 = last quarter;
 *   fraction: illuminated fraction of the disc (0–1)
 */
export function getMoonPhase(date) {
  const { phase, fraction } = SunCalc.getMoonIllumination(date);
  return { phase, fraction, name: PHASE_NAMES[Math.round(phase * 8) % 8] };
}

/**
 * Moonrise and moonset on a calendar day in the location's timezone.
 * (SunCalc.getMoonTimes searches from midnight in the browser's timezone, so it can
 * return another day's times for a distant location; this scans the location's own day.)
 * @param {Date} date - Calendar day (only year/month/day are used)
 * @param {number} latitude
 * @param {number} longitude
 * @param {string} timezone - IANA timezone of the location
 * @returns {{ rise: Date|null, set: Date|null, alwaysUp: boolean, alwaysDown: boolean }}
 */
const _moonTimesCache = new LRUCache(CACHE_MAX_SMALL);
export function getMoonRiseSet(date, latitude, longitude, timezone) {
  const y = date.getFullYear(), m = date.getMonth() + 1, d = date.getDate();
  const key = `${y}-${m}-${d}:${latitude}:${longitude}:${timezone}`;
  const cached = _moonTimesCache.get(key);
  if (cached) return cached;

  const start = dateAtLocalInTimezone(y, m, d, 0, 0, timezone).getTime();
  const next = new Date(y, m - 1, d + 1); // next calendar day (handles month/year rollover)
  const end = dateAtLocalInTimezone(next.getFullYear(), next.getMonth() + 1, next.getDate(), 0, 0, timezone).getTime();
  const step = 10 * 60000;
  const altitude = (t) => SunCalc.getMoonPosition(new Date(t), latitude, longitude).altitude * 180 / Math.PI - MOON_HORIZON;

  let rise = null, set = null;
  let anyUp = false, anyDown = false;
  let prevT = start, prevAlt = altitude(start);
  for (let t = start + step; t <= end; t += step) {
    const alt = altitude(t);
    // Linear interpolation of the crossing between samples
    const crossing = () => new Date(prevT + (t - prevT) * (prevAlt / (prevAlt - alt)));
    if (prevAlt < 0 && alt >= 0 && !rise) rise = crossing();
    if (prevAlt >= 0 && alt < 0 && !set) set = crossing();
    if (alt >= 0) anyUp = true; else anyDown = true;
    prevT = t;
    prevAlt = alt;
  }

  const result = { rise, set, alwaysUp: anyUp && !anyDown, alwaysDown: anyDown && !anyUp };
  _moonTimesCache.set(key, result);
  return result;
}

/**
 * The next new moon, first quarter, full moon and last quarter after an instant, in date order.
 * Found by sampling SunCalc's phase every 6 hours and bisecting each crossing.
 * @param {Date} from
 * @returns {Array<{ name: string, date: Date }>}
 */
export function findNextMoonPhases(from) {
  const targets = [
    { name: 'New Moon', phase: 0 },
    { name: 'First Quarter', phase: 0.25 },
    { name: 'Full Moon', phase: 0.5 },
    { name: 'Last Quarter', phase: 0.75 },
  ];
  // Signed distance from the target phase, wrapped to [-0.5, 0.5)
  const offset = (t, target) => ((SunCalc.getMoonIllumination(new Date(t)).phase - target + 1.5) % 1) - 0.5;
  const step = 6 * 3600000;

  return targets
    .map(({ name, phase }) => {
      let prevT = from.getTime();
      let prev = offset(prevT, phase);
      for (let t = prevT + step; t <= prevT + 31 * 86400000; t += step) {
        const cur = offset(t, phase);
        if (prev < 0 && cur >= 0) {
          let lo = t - step, hi = t;
          for (let i = 0; i < 20; i++) {
            const mid = (lo + hi) / 2;
            if (offset(mid, phase) < 0) lo = mid; else hi = mid;
          }
          return { name, date: new Date(hi) };
        }
        prev = cur;
      }
      return null;
    })
    .filter(Boolean)
    .sort((a, b) => a.date - b.date);
}
