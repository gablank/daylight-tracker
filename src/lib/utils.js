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
 * Preset locations with their latitudes, longitudes, and timezones
 */
export const PRESET_LOCATIONS = [
  { name: 'Equator (Pacific)', latitude: 0, longitude: -90, timezone: 'Pacific/Galapagos' },
  { name: 'Tropic of Cancer (India)', latitude: 23.4, longitude: 77, timezone: 'Asia/Kolkata' },
  { name: 'Tropic of Capricorn (Brazil)', latitude: -23.4, longitude: -46, timezone: 'America/Sao_Paulo' },
  { name: 'Oslo, Norway', latitude: 59.9, longitude: 10.7, timezone: 'Europe/Oslo' },
  { name: 'Tromsø, Norway', latitude: 69.7, longitude: 19.0, timezone: 'Europe/Oslo' },
  { name: 'Longyearbyen, Svalbard', latitude: 78.2, longitude: 15.6, timezone: 'Arctic/Longyearbyen' },
  { name: 'Stockholm, Sweden', latitude: 59.3, longitude: 18.1, timezone: 'Europe/Stockholm' },
  { name: 'Helsinki, Finland', latitude: 60.2, longitude: 24.9, timezone: 'Europe/Helsinki' },
  { name: 'Reykjavik, Iceland', latitude: 64.1, longitude: -21.9, timezone: 'Atlantic/Reykjavik' },
  { name: 'London, UK', latitude: 51.5, longitude: -0.1, timezone: 'Europe/London' },
  { name: 'Paris, France', latitude: 48.9, longitude: 2.3, timezone: 'Europe/Paris' },
  { name: 'Berlin, Germany', latitude: 52.5, longitude: 13.4, timezone: 'Europe/Berlin' },
  { name: 'Moscow, Russia', latitude: 55.8, longitude: 37.6, timezone: 'Europe/Moscow' },
  { name: 'New York, USA', latitude: 40.7, longitude: -74.0, timezone: 'America/New_York' },
  { name: 'Los Angeles, USA', latitude: 34.1, longitude: -118.2, timezone: 'America/Los_Angeles' },
  { name: 'Chicago, USA', latitude: 41.9, longitude: -87.6, timezone: 'America/Chicago' },
  { name: 'Anchorage, USA', latitude: 61.2, longitude: -149.9, timezone: 'America/Anchorage' },
  { name: 'Tokyo, Japan', latitude: 35.7, longitude: 139.7, timezone: 'Asia/Tokyo' },
  { name: 'Sydney, Australia', latitude: -33.9, longitude: 151.2, timezone: 'Australia/Sydney' },
  { name: 'Auckland, New Zealand', latitude: -36.8, longitude: 174.8, timezone: 'Pacific/Auckland' },
  { name: 'Cape Town, South Africa', latitude: -33.9, longitude: 18.4, timezone: 'Africa/Johannesburg' },
  { name: 'Buenos Aires, Argentina', latitude: -34.6, longitude: -58.4, timezone: 'America/Argentina/Buenos_Aires' },
  { name: 'Arctic Circle (Norway)', latitude: 66.5, longitude: 15.0, timezone: 'Europe/Oslo' },
  { name: 'Antarctic Circle', latitude: -66.5, longitude: 110.5, timezone: 'Antarctica/Casey' },
  { name: 'North Pole', latitude: 90, longitude: 0, timezone: 'UTC' },
  { name: 'South Pole', latitude: -90, longitude: 0, timezone: 'Antarctica/South_Pole' },
];

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
