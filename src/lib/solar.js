import SunCalc from 'suncalc';

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
  const diff = date - start;
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor(diff / oneDay);
}

/**
 * Get the winter solstice date for a given year (Northern Hemisphere)
 * Approximately December 21-22
 */
export function getWinterSolstice(year) {
  // Winter solstice is typically Dec 21 or 22
  // We'll calculate it more precisely by finding the day with minimum daylight
  // For simplicity, use Dec 21 as approximation
  return new Date(year, 11, 21);
}

/**
 * Get the summer solstice date for a given year (Northern Hemisphere)
 * Approximately June 20-21
 */
export function getSummerSolstice(year) {
  return new Date(year, 5, 21);
}

/**
 * Calculate sun data for a specific date and location
 * @param {Date} date - The date to calculate for
 * @param {number} latitude - The latitude (-90 to 90)
 * @param {number} longitude - The longitude (-180 to 180), defaults to 0
 * @returns {Object} Sun data including sunrise, sunset, daylight duration, etc.
 */
export function getSunData(date, latitude, longitude = 0) {
  const times = SunCalc.getTimes(date, latitude, longitude);
  
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
 * Find the opposite date - a date with the same daylight duration on the other half of the year
 * @param {Date} currentDate - The current date
 * @param {Array} yearData - The precomputed year data
 * @param {number} latitude - The latitude (to determine hemisphere)
 * @returns {Object|null} The opposite date data or null if not found
 */
/**
 * Find the opposite date (mirror date) - purely geometric calculation.
 * The mirror date is the same number of days from winter solstice on the opposite side.
 * This is latitude-independent.
 * @param {Date} currentDate - The current date
 * @returns {Object} Object with date property for the opposite date
 */
export function findOppositeDate(currentDate) {
  const currentDayOfYear = getDayOfYear(currentDate);
  const year = currentDate.getFullYear();
  const winterSolstice = getWinterSolstice(year);
  const winterSolsticeDOY = getDayOfYear(winterSolstice);
  const daysInYear = getDaysInYear(year);
  
  // Calculate distance from winter solstice
  let daysFromWinterSolstice = currentDayOfYear - winterSolsticeDOY;
  
  // Handle year wrap (winter solstice is near end of year)
  if (daysFromWinterSolstice < -daysInYear / 2) {
    daysFromWinterSolstice += daysInYear;
  } else if (daysFromWinterSolstice > daysInYear / 2) {
    daysFromWinterSolstice -= daysInYear;
  }
  
  // The mirror date is at the same distance but on the other side of winter solstice
  let oppositeDOY = winterSolsticeDOY - daysFromWinterSolstice;
  
  // Wrap around year
  if (oppositeDOY <= 0) {
    oppositeDOY += daysInYear;
  } else if (oppositeDOY > daysInYear) {
    oppositeDOY -= daysInYear;
  }
  
  // Create the date object from day of year
  const oppositeDate = new Date(year, 0, oppositeDOY);
  
  return { date: oppositeDate };
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
  
  // Define all events for current year and next year (northern hemisphere names)
  const allEvents = [
    { northernName: 'Spring Equinox', date: new Date(year, 2, 20) },
    { northernName: 'Summer Solstice', date: new Date(year, 5, 21) },
    { northernName: 'Autumn Equinox', date: new Date(year, 8, 22) },
    { northernName: 'Winter Solstice', date: new Date(year, 11, 21) },
    { northernName: 'Spring Equinox', date: new Date(year + 1, 2, 20) },
    { northernName: 'Summer Solstice', date: new Date(year + 1, 5, 21) },
    { northernName: 'Autumn Equinox', date: new Date(year + 1, 8, 22) },
    { northernName: 'Winter Solstice', date: new Date(year + 1, 11, 21) },
  ];
  
  // Filter to only future events, with hemisphere-appropriate names
  for (const event of allEvents) {
    if (event.date > currentDate && events.length < count) {
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
  const POLAR_NIGHT_THRESHOLD = isExtremeLatitude ? 1.0 : 0.1;  // 1h vs 6 min
  const MIDNIGHT_SUN_THRESHOLD = isExtremeLatitude ? 23.0 : 23.9; // 23h vs 23h54m
  const SUPPRESSION_WINDOW = isExtremeLatitude ? 60 : 30; // Wider window for polar regions
  
  // Helper to get daylight hours for an offset from current date
  const getHoursAtOffset = (offset) => {
    let doy = currentDOY + offset;
    if (doy > yearData.length) doy -= yearData.length;
    if (doy < 1) doy += yearData.length;
    const data = yearData[doy - 1];
    return data ? data.daylight / (1000 * 60 * 60) : null;
  };
  
  // FIRST PASS: Pre-scan the entire year for extreme events
  const extremeEvents = [];
  for (let offset = 1; offset < yearData.length; offset++) {
    const prevHours = getHoursAtOffset(offset - 1);
    const currHours = getHoursAtOffset(offset);
    if (prevHours === null || currHours === null) continue;
    
    // Polar night begins (daylight drops to ~0)
    if (prevHours >= POLAR_NIGHT_THRESHOLD && currHours < POLAR_NIGHT_THRESHOLD) {
      extremeEvents.push({ type: 'polar_night_begin', offset, direction: 'decreasing' });
    }
    // Polar night ends (daylight rises from ~0)
    if (prevHours < POLAR_NIGHT_THRESHOLD && currHours >= POLAR_NIGHT_THRESHOLD) {
      extremeEvents.push({ type: 'polar_night_end', offset, direction: 'increasing' });
    }
    // Midnight sun begins (daylight reaches 24h)
    if (prevHours <= MIDNIGHT_SUN_THRESHOLD && currHours > MIDNIGHT_SUN_THRESHOLD) {
      extremeEvents.push({ type: 'midnight_sun_begin', offset, direction: 'increasing' });
    }
    // Midnight sun ends (daylight drops from 24h)
    if (prevHours > MIDNIGHT_SUN_THRESHOLD && currHours <= MIDNIGHT_SUN_THRESHOLD) {
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
      
      // Suppress BEFORE an extreme event
      if (daysUntilExtreme > 0 && daysUntilExtreme <= SUPPRESSION_WINDOW) {
        // Suppress "Less than Xh" crossings before polar night begins
        if (isDecreasing && event.type === 'polar_night_begin') return true;
        // Suppress "More than Xh" crossings before midnight sun begins
        if (!isDecreasing && event.type === 'midnight_sun_begin') return true;
      }
      
      // Suppress briefly AFTER an extreme event (only during rapid transition, ~7 days)
      // Don't use full SUPPRESSION_WINDOW here as it would hide too many milestones
      if (daysSinceExtreme > 0 && daysSinceExtreme <= 7) {
        // After midnight sun ends, briefly suppress "Less than Xh"
        if (isDecreasing && event.type === 'midnight_sun_end') return true;
        // After polar night ends, briefly suppress "More than Xh"
        if (!isDecreasing && event.type === 'polar_night_end') return true;
      }
    }
    return false;
  };
  
  // SECOND PASS: Collect milestones
  const milestones = [];
  const foundCrossings = new Set();
  
  for (let offset = 1; offset < yearData.length && milestones.length < count; offset++) {
    const prevHours = getHoursAtOffset(offset - 1);
    const currHours = getHoursAtOffset(offset);
    if (prevHours === null || currHours === null) continue;
    
    const actualDate = new Date(currentDate);
    actualDate.setDate(actualDate.getDate() + offset);
    
    // Add extreme events (these are never suppressed)
    // Polar night begins
    if (prevHours >= POLAR_NIGHT_THRESHOLD && currHours < POLAR_NIGHT_THRESHOLD) {
      if (!foundCrossings.has('polar_night_begin')) {
        foundCrossings.add('polar_night_begin');
        milestones.push({ date: new Date(actualDate), description: 'Polar night begins (0h daylight)' });
      }
    }
    // Polar night ends
    if (prevHours < POLAR_NIGHT_THRESHOLD && currHours >= POLAR_NIGHT_THRESHOLD) {
      if (!foundCrossings.has('polar_night_end')) {
        foundCrossings.add('polar_night_end');
        milestones.push({ date: new Date(actualDate), description: 'Polar night ends' });
      }
    }
    // Midnight sun begins
    if (prevHours <= MIDNIGHT_SUN_THRESHOLD && currHours > MIDNIGHT_SUN_THRESHOLD) {
      if (!foundCrossings.has('midnight_sun_begin')) {
        foundCrossings.add('midnight_sun_begin');
        milestones.push({ date: new Date(actualDate), description: 'Midnight sun begins (24h daylight)' });
      }
    }
    // Midnight sun ends
    if (prevHours > MIDNIGHT_SUN_THRESHOLD && currHours <= MIDNIGHT_SUN_THRESHOLD) {
      if (!foundCrossings.has('midnight_sun_end')) {
        foundCrossings.add('midnight_sun_end');
        milestones.push({ date: new Date(actualDate), description: 'Midnight sun ends' });
      }
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
  
  let prevSunData = getSunData(currentDate, latitude, longitude);
  let prevHours = getSunriseDecimalHours(prevSunData, timezone);
  
  // Search up to 365 days forward
  for (let offset = 1; offset <= 365 && milestones.length < count; offset++) {
    const date = new Date(currentDate);
    date.setDate(date.getDate() + offset);
    
    const sunData = getSunData(date, latitude, longitude);
    const currHours = getSunriseDecimalHours(sunData, timezone);
    
    if (prevHours !== null && currHours !== null) {
      // Check for crossings of each integer hour (4-12 range is typical for sunrise)
      for (let h = 3; h <= 12; h++) {
        // Crossing below (sunrise getting earlier): prev >= h > curr
        if (prevHours >= h && currHours < h) {
          milestones.push({
            date: date,
            description: `Sunrise at ${String(h).padStart(2, '0')}:00`
          });
        }
        // Crossing above (sunrise getting later): prev < h <= curr
        if (prevHours < h && currHours >= h) {
          milestones.push({
            date: date,
            description: `Sunrise at ${String(h).padStart(2, '0')}:00`
          });
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
  
  let prevSunData = getSunData(currentDate, latitude, longitude);
  let prevHours = getSunsetDecimalHours(prevSunData, timezone);
  
  // Search up to 365 days forward
  for (let offset = 1; offset <= 365 && milestones.length < count; offset++) {
    const date = new Date(currentDate);
    date.setDate(date.getDate() + offset);
    
    const sunData = getSunData(date, latitude, longitude);
    const currHours = getSunsetDecimalHours(sunData, timezone);
    
    if (prevHours !== null && currHours !== null) {
      // Check for crossings of each integer hour (15-22 range is typical for sunset)
      for (let h = 15; h <= 22; h++) {
        // Crossing above (sunset getting later): prev < h <= curr
        if (prevHours < h && currHours >= h) {
          milestones.push({
            date: date,
            description: `Sunset at ${String(h).padStart(2, '0')}:00`
          });
        }
        // Crossing below (sunset getting earlier): prev >= h > curr
        if (prevHours >= h && currHours < h) {
          milestones.push({
            date: date,
            description: `Sunset at ${String(h).padStart(2, '0')}:00`
          });
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
  
  let prevOffset = getTimezoneOffset(currentDate, timezone);
  
  // Search up to 400 days forward (to catch at least one full year)
  for (let offset = 1; offset <= 400 && transitions.length < count; offset++) {
    const date = new Date(currentDate);
    date.setDate(date.getDate() + offset);
    
    const currOffset = getTimezoneOffset(date, timezone);
    
    if (prevOffset !== null && currOffset !== null && prevOffset !== currOffset) {
      const offsetChange = currOffset - prevOffset;
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
    
    prevOffset = currOffset;
  }
  
  return transitions;
}
