/**
 * Add days to a date
 * @param {Date} date - The starting date
 * @param {number} days - Number of days to add (can be negative)
 * @returns {Date} New date
 */
export function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Add months to a date
 * @param {Date} date - The starting date
 * @param {number} months - Number of months to add (can be negative)
 * @returns {Date} New date
 */
export function addMonths(date, months) {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

/**
 * Check if two dates are the same day
 * @param {Date} date1 
 * @param {Date} date2 
 * @returns {boolean}
 */
export function isSameDay(date1, date2) {
  if (!date1 || !date2) return false;
  return date1.getFullYear() === date2.getFullYear() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getDate() === date2.getDate();
}

/**
 * Format a date as YYYY-MM-DD (for input[type=date])
 * @param {Date} date 
 * @returns {string}
 */
export function formatDateISO(date) {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parse a YYYY-MM-DD string to a Date
 * @param {string} str 
 * @returns {Date}
 */
export function parseDateISO(str) {
  const [year, month, day] = str.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Get today's date at midnight (local time)
 * @returns {Date}
 */
export function getToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * Preset location: name, latitude, longitude (0 if latitudeOnly), timezone, optional latitudeOnly
 * @typedef {{ name: string, latitude: number, longitude: number, timezone: string, latitudeOnly?: boolean }} PresetLocation
 */

/**
 * Preset locations grouped by continent. Non-continent-specific (Equator, circles, poles) go in Other.
 * "Other" entries use longitude 0 and latitudeOnly: true (display shows latitude only).
 */
export const PRESET_LOCATION_GROUPS = [
  {
    label: 'Europe',
    locations: [
      { name: 'Longyearbyen, Svalbard', latitude: 78.2, longitude: 15.6, timezone: 'Arctic/Longyearbyen' },
      { name: 'Tromsø, Norway', latitude: 69.7, longitude: 19.0, timezone: 'Europe/Oslo' },
      { name: 'Reykjavik, Iceland', latitude: 64.1, longitude: -21.9, timezone: 'Atlantic/Reykjavik' },
      { name: 'Oslo, Norway', latitude: 59.9, longitude: 10.7, timezone: 'Europe/Oslo' },
      { name: 'Berlin, Germany', latitude: 52.5, longitude: 13.4, timezone: 'Europe/Berlin' },
      { name: 'London, UK', latitude: 51.5, longitude: -0.1, timezone: 'Europe/London' },
      { name: 'Madrid, Spain', latitude: 40.4, longitude: -3.7, timezone: 'Europe/Madrid' },
      { name: 'Athens, Greece', latitude: 37.9, longitude: 23.7, timezone: 'Europe/Athens' },
    ]
  },
  {
    label: 'Americas',
    locations: [
      { name: 'Anchorage, USA', latitude: 61.2, longitude: -149.9, timezone: 'America/Anchorage' },
      { name: 'Seattle, USA', latitude: 47.6, longitude: -122.3, timezone: 'America/Los_Angeles' },
      { name: 'Denver, USA', latitude: 39.7, longitude: -104.9, timezone: 'America/Denver' },
      { name: 'Miami, USA', latitude: 25.8, longitude: -80.2, timezone: 'America/New_York' },
      { name: 'Mexico City, Mexico', latitude: 19.4, longitude: -99.1, timezone: 'America/Mexico_City' },
      { name: 'Lima, Peru', latitude: -12.0, longitude: -77.0, timezone: 'America/Lima' },
      { name: 'Rio de Janeiro, Brazil', latitude: -22.9, longitude: -43.2, timezone: 'America/Sao_Paulo' },
      { name: 'Buenos Aires, Argentina', latitude: -34.6, longitude: -58.4, timezone: 'America/Argentina/Buenos_Aires' },
      { name: 'Ushuaia, Argentina', latitude: -54.8, longitude: -68.3, timezone: 'America/Argentina/Ushuaia' },
    ]
  },
  {
    label: 'Asia',
    locations: [
      { name: 'Yakutsk, Russia', latitude: 62.0, longitude: 129.7, timezone: 'Asia/Yakutsk' },
      { name: 'Seoul, South Korea', latitude: 37.6, longitude: 127.0, timezone: 'Asia/Seoul' },
      { name: 'Tokyo, Japan', latitude: 35.7, longitude: 139.7, timezone: 'Asia/Tokyo' },
      { name: 'Mumbai, India', latitude: 19.1, longitude: 72.9, timezone: 'Asia/Kolkata' },
      { name: 'Bangkok, Thailand', latitude: 13.8, longitude: 100.5, timezone: 'Asia/Bangkok' },
      { name: 'Singapore', latitude: 1.3, longitude: 103.8, timezone: 'Asia/Singapore' },
    ]
  },
  {
    label: 'Africa',
    locations: [
      { name: 'Cairo, Egypt', latitude: 30.0, longitude: 31.2, timezone: 'Africa/Cairo' },
      { name: 'Lagos, Nigeria', latitude: 6.5, longitude: 3.4, timezone: 'Africa/Lagos' },
      { name: 'Nairobi, Kenya', latitude: -1.3, longitude: 36.8, timezone: 'Africa/Nairobi' },
      { name: 'Johannesburg, South Africa', latitude: -26.2, longitude: 28.0, timezone: 'Africa/Johannesburg' },
      { name: 'Cape Town, South Africa', latitude: -33.9, longitude: 18.4, timezone: 'Africa/Johannesburg' },
    ]
  },
  {
    label: 'Oceania',
    locations: [
      { name: 'Port Moresby, Papua New Guinea', latitude: -9.5, longitude: 147.2, timezone: 'Pacific/Port_Moresby' },
      { name: 'Darwin, Australia', latitude: -12.5, longitude: 130.8, timezone: 'Australia/Darwin' },
      { name: 'Brisbane, Australia', latitude: -27.5, longitude: 153.0, timezone: 'Australia/Brisbane' },
      { name: 'Sydney, Australia', latitude: -33.9, longitude: 151.2, timezone: 'Australia/Sydney' },
      { name: 'Auckland, New Zealand', latitude: -36.8, longitude: 174.8, timezone: 'Pacific/Auckland' },
      { name: 'Melbourne, Australia', latitude: -37.8, longitude: 144.9, timezone: 'Australia/Melbourne' },
      { name: 'Hobart, Australia', latitude: -42.9, longitude: 147.3, timezone: 'Australia/Hobart' },
    ]
  },
  {
    label: 'Other',
    locations: [
      { name: 'Equator', latitude: 0, longitude: 0, timezone: 'UTC', latitudeOnly: true },
      { name: 'Tropic of Cancer', latitude: 23.4, longitude: 0, timezone: 'UTC', latitudeOnly: true },
      { name: 'Tropic of Capricorn', latitude: -23.4, longitude: 0, timezone: 'UTC', latitudeOnly: true },
      { name: 'Arctic Circle', latitude: 66.5, longitude: 0, timezone: 'UTC', latitudeOnly: true },
      { name: 'Antarctic Circle', latitude: -66.5, longitude: 0, timezone: 'UTC', latitudeOnly: true },
      { name: 'North Pole', latitude: 90, longitude: 0, timezone: 'UTC', latitudeOnly: true },
      { name: 'South Pole', latitude: -90, longitude: 0, timezone: 'Antarctica/South_Pole', latitudeOnly: true },
    ]
  },
];

/** Flat list of all preset locations (for lookup by name) */
export const PRESET_LOCATIONS = PRESET_LOCATION_GROUPS.flatMap((g) => g.locations);

/**
 * Common timezones grouped by region
 */
export const TIMEZONE_GROUPS = [
  {
    label: 'UTC',
    timezones: [
      { name: 'UTC', offset: '+0:00' },
    ]
  },
  {
    label: 'Europe',
    timezones: [
      { name: 'Europe/London', offset: '+0:00/+1:00' },
      { name: 'Europe/Paris', offset: '+1:00/+2:00' },
      { name: 'Europe/Berlin', offset: '+1:00/+2:00' },
      { name: 'Europe/Oslo', offset: '+1:00/+2:00' },
      { name: 'Europe/Stockholm', offset: '+1:00/+2:00' },
      { name: 'Europe/Helsinki', offset: '+2:00/+3:00' },
      { name: 'Europe/Moscow', offset: '+3:00' },
    ]
  },
  {
    label: 'Americas',
    timezones: [
      { name: 'America/New_York', offset: '-5:00/-4:00' },
      { name: 'America/Chicago', offset: '-6:00/-5:00' },
      { name: 'America/Denver', offset: '-7:00/-6:00' },
      { name: 'America/Los_Angeles', offset: '-8:00/-7:00' },
      { name: 'America/Anchorage', offset: '-9:00/-8:00' },
      { name: 'America/Sao_Paulo', offset: '-3:00' },
      { name: 'America/Argentina/Buenos_Aires', offset: '-3:00' },
    ]
  },
  {
    label: 'Asia & Pacific',
    timezones: [
      { name: 'Asia/Tokyo', offset: '+9:00' },
      { name: 'Asia/Shanghai', offset: '+8:00' },
      { name: 'Asia/Kolkata', offset: '+5:30' },
      { name: 'Asia/Dubai', offset: '+4:00' },
      { name: 'Australia/Sydney', offset: '+10:00/+11:00' },
      { name: 'Pacific/Auckland', offset: '+12:00/+13:00' },
    ]
  },
  {
    label: 'Africa',
    timezones: [
      { name: 'Africa/Johannesburg', offset: '+2:00' },
      { name: 'Africa/Cairo', offset: '+2:00' },
      { name: 'Africa/Lagos', offset: '+1:00' },
    ]
  },
];

/**
 * Get a flat list of all timezones
 */
export function getAllTimezones() {
  const all = [];
  for (const group of TIMEZONE_GROUPS) {
    for (const tz of group.timezones) {
      all.push(tz);
    }
  }
  return all;
}

/**
 * Format a duration change (can be positive or negative)
 * @param {number} ms - Duration change in milliseconds
 * @returns {string} Formatted string like "+1h 32m" or "-45m"
 */
export function formatDurationChange(ms) {
  const sign = ms >= 0 ? '+' : '-';
  const absMs = Math.abs(ms);
  
  const hours = Math.floor(absMs / (1000 * 60 * 60));
  const minutes = Math.floor((absMs % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours === 0) {
    return `${sign}${minutes}m`;
  }
  
  return `${sign}${hours}h ${minutes}m`;
}

/**
 * Format a duration change with minutes and seconds (e.g. "+2m 30s", "-1m 15s")
 * @param {number} ms - Duration change in milliseconds
 * @returns {string} Formatted string like "+2m 30s" or "-1m 15s"
 */
export function formatDurationChangeMinutesSeconds(ms) {
  const sign = ms >= 0 ? '+' : '-';
  const absMs = Math.abs(ms);
  const minutes = Math.floor(absMs / (1000 * 60));
  const seconds = Math.floor((absMs % (1000 * 60)) / 1000);
  return `${sign}${minutes}m ${seconds}s`;
}

/**
 * Format a time in a specific timezone
 * @param {Date} date - The date/time to format
 * @param {string} timezone - The IANA timezone name
 * @returns {string} Formatted time string (HH:MM)
 */
export function formatTimeInTimezone(date, timezone) {
  if (!date || isNaN(date.getTime())) return '--:--';
  
  try {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    return formatter.format(date);
  } catch (e) {
    // Fallback if timezone is invalid
    const hours = date.getUTCHours().toString().padStart(2, '0');
    const minutes = date.getUTCMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }
}

/**
 * Get the user's local timezone
 * @returns {string} IANA timezone name
 */
export function getLocalTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Get calendar day (year, month, day) of a date in a specific timezone
 * @param {Date} date
 * @param {string} timezone - IANA timezone name
 * @returns {{ year: number, month: number, day: number }} month 1-12, day 1-31
 */
export function getCalendarDayInTimezone(date, timezone) {
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' });
  const parts = formatter.formatToParts(date);
  const get = (type) => parseInt(parts.find((p) => p.type === type).value, 10);
  return { year: get('year'), month: get('month'), day: get('day') };
}

/**
 * Get fractional hour (0-24) of a date in a specific timezone, as elapsed time since midnight in that zone.
 * Uses actual UTC difference so DST is correct (avoids Intl format quirks that can cause ~1h shift).
 * @param {Date} date
 * @param {string} timezone - IANA timezone name
 * @returns {number}
 */
export function getHourInTimezone(date, timezone) {
  const { year, month, day } = getCalendarDayInTimezone(date, timezone);
  const midnight = dateAtLocalInTimezone(year, month, day, 0, 0, timezone);
  return (date.getTime() - midnight.getTime()) / 3600000;
}

/**
 * Create a Date for a given local (year, month, day, hour, min) in a timezone
 * @param {number} year
 * @param {number} month - 1-12
 * @param {number} day
 * @param {number} hour
 * @param {number} min
 * @param {string} timezone - IANA timezone name
 * @returns {Date}
 */
export function dateAtLocalInTimezone(year, month, day, hour, min, timezone) {
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  // Find midnight on (year, month, day) in timezone first; start from noon UTC that day
  let M = Date.UTC(year, month - 1, day, 12, 0, 0);
  for (let i = 0; i < 15; i++) {
    const parts = formatter.formatToParts(M);
    const get = (type) => parseInt(parts.find((p) => p.type === type)?.value ?? '0', 10);
    const y0 = get('year'), m0 = get('month'), d0 = get('day'), h0 = get('hour'), min0 = get('minute');
    if (y0 === year && m0 === month && d0 === day && h0 === 0 && min0 === 0) {
      return new Date(M + hour * 3600000 + min * 60000);
    }
    if (y0 === year && m0 === month && d0 === day) {
      M -= h0 * 3600000 + min0 * 60000;
    } else if (y0 < year || (y0 === year && m0 < month) || (y0 === year && m0 === month && d0 < day)) {
      M += 24 * 3600000;
    } else {
      M -= 24 * 3600000;
    }
  }
  return new Date(M + hour * 3600000 + min * 60000);
}
