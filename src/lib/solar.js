import SunCalc from 'suncalc';
import { getCalendarDayInTimezone, dateAtLocalInTimezone, formatTimeInTimezone } from './utils.js';

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
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor(diff / oneDay);
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
 * Calculate sun data for a specific date and location
 * @param {Date} date - The date to calculate for
 * @param {number} latitude - The latitude (-90 to 90)
 * @param {number} longitude - The longitude (-180 to 180), defaults to 0
 * @returns {Object} Sun data including sunrise, sunset, daylight duration, etc.
 */
export function getSunData(date, latitude, longitude = 0) {
  // Use noon local for the calendar day so SunCalc (UTC-based) gets the correct day;
  // midnight local can be the previous UTC day in positive-offset timezones.
  const noon = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0);
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
  
  return {
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
}

/**
 * Get sun position (altitude and azimuth) at a specific time
 * @param {Date} date - The date/time
 * @param {number} latitude - Latitude
 * @param {number} longitude - Longitude
 * @returns {{altitude: number, azimuth: number}} altitude and azimuth in degrees
 */
export function getSunPosition(date, latitude, longitude = 0) {
  const pos = SunCalc.getPosition(date, latitude, longitude);
  let azimuth = pos.azimuth * 180 / Math.PI;
  if (azimuth < 0) azimuth += 360;
  return {
    altitude: pos.altitude * 180 / Math.PI,
    azimuth
  };
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
export function computeYearData(latitude, year) {
  const daysInYear = getDaysInYear(year);
  const data = [];
  for (let dayOfYear = 1; dayOfYear <= daysInYear; dayOfYear++) {
    const date = new Date(year, 0, dayOfYear);
    const sunData = getSunData(date, latitude);
    data.push(sunData);
  }
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
  const currentDOY = getDayOfYear(currentDate);
  const currentData = yearData[currentDOY - 1];
  if (!currentData) return null;

  const summerSolsticeDOY = getDayOfYear(getSummerSolstice(year));

  // Other half = opposite side of summer solstice (same-daylight pairs are symmetric around it).
  // Before solstice (Jan–June 20): search after solstice (June 22–Dec 31).
  // After solstice (June 22–Dec 31): search before solstice (Jan 1–June 21).
  const isBeforeOrOnSolstice = currentDOY <= summerSolsticeDOY;
  const otherHalfStart = isBeforeOrOnSolstice ? summerSolsticeDOY + 1 : 1;
  const otherHalfEnd = isBeforeOrOnSolstice ? daysInYear : summerSolsticeDOY - 1;

  let bestDOY = null;
  let bestDiff = Infinity;

  for (let doy = otherHalfStart; doy <= otherHalfEnd; doy++) {
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
  const data = getSunData(date, latitude, longitude);
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
 * @returns {Array} Array of upcoming events with date and name
 */
export function getUpcomingAstronomicalEvents(currentDate, latitude = 0, count = 4) {
  const events = [];
  const year = currentDate.getFullYear();
  const eventDefs = [
    { northernName: 'Spring Equinox', getDate: (y) => getMarchEquinox(y) },
    { northernName: 'Summer Solstice', getDate: (y) => getSummerSolstice(y) },
    { northernName: 'Autumn Equinox', getDate: (y) => getSeptemberEquinox(y) },
    { northernName: 'Winter Solstice', getDate: (y) => getWinterSolstice(y) },
  ];
  const allEvents = [
    ...eventDefs.map((e) => ({ northernName: e.northernName, date: e.getDate(year) })),
    ...eventDefs.map((e) => ({ northernName: e.northernName, date: e.getDate(year + 1) })),
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
    const hasMissing = milestones.some(m => m.description.toLowerCase().includes(missingType));
    
    if (hasExisting && !hasMissing) {
      const event = extremeEvents.find(e => e.type === missingType.replace(' ', '_'));
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

/**
 * Helper to get sunrise time in decimal hours for a given timezone
 */
function getSunriseDecimalHours(sunData, timezone) {
  if (!sunData.sunrise) return null;
  try {
    const hourFormatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false
    });
    const minFormatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      minute: 'numeric'
    });
    const hour = parseInt(hourFormatter.format(sunData.sunrise));
    const min = parseInt(minFormatter.format(sunData.sunrise));
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
export function findUpcomingSunriseMilestones(currentDate, latitude, longitude, timezone, count = 8) {
  const milestones = [];
  const isExtremeLatitude = Math.abs(latitude) > 66.5;
  
  // Start from day before selected date so events on the selected date (e.g. today) are included
  const dayBefore = new Date(currentDate);
  dayBefore.setDate(dayBefore.getDate() - 1);
  const initialSunData = getSunData(dayBefore, latitude, longitude);
  let prevHours = getSunriseDecimalHours(initialSunData, timezone);
  
  // Search from selected date (offset 0) up to 365 days forward
  for (let offset = 0; offset <= 365 && milestones.length < count; offset++) {
    const calendarDate = new Date(currentDate);
    calendarDate.setDate(calendarDate.getDate() + offset);
    
    const sunData = getSunData(calendarDate, latitude, longitude);
    const currHours = getSunriseDecimalHours(sunData, timezone);
    
    if (prevHours !== null && currHours !== null && sunData.sunrise) {
      // Skip hour checks when there's a midnight wrap-around
      // This avoids false positives during polar transitions
      const isWrapAround = (prevHours > 20 && currHours < 4) || (prevHours < 4 && currHours > 20);
      
      if (!isWrapAround) {
        // Use actual sunrise date (may differ from calendar date at extreme latitudes)
        const eventDate = new Date(sunData.sunrise);
        eventDate.setHours(0, 0, 0, 0);
        
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
  
  return milestones;
}

/**
 * Helper to get sunset time in decimal hours for a given timezone
 */
function getSunsetDecimalHours(sunData, timezone) {
  if (!sunData.sunset) return null;
  try {
    const hourFormatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false
    });
    const minFormatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      minute: 'numeric'
    });
    const hour = parseInt(hourFormatter.format(sunData.sunset));
    const min = parseInt(minFormatter.format(sunData.sunset));
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
export function findUpcomingSunsetMilestones(currentDate, latitude, longitude, timezone, count = 8) {
  const milestones = [];
  const isExtremeLatitude = Math.abs(latitude) > 66.5;
  
  // Start from day before selected date so events on the selected date (e.g. today) are included
  const dayBefore = new Date(currentDate);
  dayBefore.setDate(dayBefore.getDate() - 1);
  const initialSunData = getSunData(dayBefore, latitude, longitude);
  let prevHours = getSunsetDecimalHours(initialSunData, timezone);
  
  // Search from selected date (offset 0) up to 365 days forward
  for (let offset = 0; offset <= 365 && milestones.length < count; offset++) {
    const calendarDate = new Date(currentDate);
    calendarDate.setDate(calendarDate.getDate() + offset);
    
    const sunData = getSunData(calendarDate, latitude, longitude);
    const currHours = getSunsetDecimalHours(sunData, timezone);
    
    if (prevHours !== null && currHours !== null && sunData.sunset) {
      // Skip hour checks when there's a midnight wrap-around (sunset going from ~23:xx to ~00:xx or vice versa)
      // This avoids false positives like "Sunset before 23:00" when sunset is actually after midnight
      const isWrapAround = (prevHours > 20 && currHours < 4) || (prevHours < 4 && currHours > 20);
      
      if (!isWrapAround) {
        // Use actual sunset date (may differ from calendar date at extreme latitudes)
        const eventDate = new Date(sunData.sunset);
        eventDate.setHours(0, 0, 0, 0);
        
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
  
  return milestones;
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
export function findUpcomingDSTChanges(currentDate, timezone, latitude, longitude, count = 2) {
  const transitions = [];
  
  // Get noon offset for the day before we start searching
  const startDate = new Date(currentDate);
  startDate.setDate(startDate.getDate() - 1);
  let prevNoon = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 12, 0, 0);
  let prevNoonOffset = getTimezoneOffset(prevNoon, timezone);
  
  // Search up to 400 days forward (to catch at least one full year)
  for (let offset = 0; offset <= 400 && transitions.length < count; offset++) {
    const date = new Date(currentDate);
    date.setDate(date.getDate() + offset);
    
    // Check offset at noon - safely after any early-morning DST change
    // (DST changes universally happen in early morning: 01:00-03:00)
    const noon = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0);
    const noonOffset = getTimezoneOffset(noon, timezone);
    
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
      const sunData = getSunData(date, latitude, longitude);
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
  
  return transitions;
}
