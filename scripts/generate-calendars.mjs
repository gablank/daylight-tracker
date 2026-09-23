// Generates one subscribable iCalendar (.ics) file per preset location, covering the past
// week and the next ~13 months: a daily all-day event with sunrise/sunset and daylight, plus
// noteworthy dates. Run after `vite build`; a scheduled CI run keeps the window moving.
//
// Usage: node scripts/generate-calendars.mjs [outDir]   (default: dist/calendars)

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  getSunData, computeYearData, formatDuration, getGoldenBlueHours, getTwilightInfo,
  getUpcomingAstronomicalEvents, findUpcomingDSTChanges, findUpcomingDaylightMilestones,
  findUpcomingSunriseMilestones, findUpcomingSunsetMilestones, findSunTimeExtremes,
} from '../src/lib/solar.js';
import { findNextMoonPhases } from '../src/lib/moon.js';
import {
  PRESET_LOCATIONS, calendarSlug, formatTimeInTimezone, formatDurationChange, getCalendarDayInTimezone,
} from '../src/lib/utils.js';

const outDir = process.argv[2] ?? 'dist/calendars';
const DAYS_BACK = 7;
const DAYS_AHEAD = 400;
const SITE_URL = 'https://gablank.github.io/daylight-tracker/';

// --- iCalendar formatting (RFC 5545) ---

function escapeText(text) {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

// Lines longer than 75 octets are folded: CRLF followed by a space
function foldLine(line) {
  const bytes = Buffer.from(line, 'utf8');
  if (bytes.length <= 75) return line;
  const parts = [];
  let current = '';
  let currentBytes = 0;
  for (const char of line) {
    const size = Buffer.byteLength(char, 'utf8');
    const limit = parts.length === 0 ? 75 : 74; // continuation lines start with a space
    if (currentBytes + size > limit) {
      parts.push(current);
      current = '';
      currentBytes = 0;
    }
    current += char;
    currentBytes += size;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

const ymd = (date) =>
  `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
const addDays = (date, days) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
const utcStamp = (date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

// Short stable hash for event UIDs, so a regenerated event replaces the old one
function hash(text) {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h * 33) ^ text.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

function allDayEvent({ uid, date, summary, description, stamp }) {
  return [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${ymd(date)}`,
    `DTEND;VALUE=DATE:${ymd(addDays(date, 1))}`,
    `SUMMARY:${escapeText(summary)}`,
    ...(description ? [`DESCRIPTION:${escapeText(description)}`] : []),
    'TRANSP:TRANSPARENT', // shows as free, doesn't block time
    'END:VEVENT',
  ];
}

// --- Event content ---

function dailySummary(sun, previous, timezone) {
  if (sun.isPolarDay) return '☀ Midnight sun (24h daylight)';
  if (sun.isPolarNight) return '☀ Polar night (no sunrise)';
  const times = `${formatTimeInTimezone(sun.sunrise, timezone)}–${formatTimeInTimezone(sun.sunset, timezone)}`;
  const change = previous ? ` (${formatDurationChange(sun.daylight - previous.daylight)})` : '';
  return `☀ ${times} · ${formatDuration(sun.daylight)}${change}`;
}

function dailyDescription(date, sun, location) {
  const { latitude, longitude, timezone } = location;
  const time = (d) => formatTimeInTimezone(d, timezone);
  const period = ([start, end]) => (start && end ? `${time(start)}–${time(end)}` : null);
  const golden = getGoldenBlueHours(date, latitude, longitude, timezone).golden;
  const twilight = getTwilightInfo(date, latitude, longitude, timezone);
  const civil = twilight.evening.civil;
  const lines = [
    `Solar noon: ${time(sun.solarNoon)} (sun ${sun.maxAltitude.toFixed(1)}° up)`,
    `Golden hour: ${[period(golden.morning), period(golden.evening)].filter(Boolean).join(' and ') || '—'}`,
    `Evening civil twilight: ${typeof civil === 'number' ? formatDuration(civil) : civil ?? '—'}`,
    `True night: ${twilight.night > 0 ? formatDuration(twilight.night) : 'none'}`,
    '',
    `${SITE_URL}?lat=${latitude}&lon=${longitude}&tz=${encodeURIComponent(timezone)}&date=${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
  ];
  return lines.join('\n');
}

function noteworthyEvents(location, start, end) {
  const { latitude, longitude, timezone } = location;
  const events = [];
  const add = (date, summary) => {
    if (date >= start && date < end) events.push({ date, summary });
  };

  for (const e of getUpcomingAstronomicalEvents(start, latitude, 14, timezone)) add(e.date, `🌍 ${e.name}`);
  for (const e of findUpcomingDSTChanges(start, timezone, latitude, longitude, 4)) add(e.date, `🕑 ${e.description}`);
  for (const e of findSunTimeExtremes(start, latitude, longitude, timezone)) add(e.date, `☀ ${e.description}`);
  for (const e of findUpcomingSunriseMilestones(start, latitude, longitude, timezone, 30)) add(e.date, `🌅 ${e.description}`);
  for (const e of findUpcomingSunsetMilestones(start, latitude, longitude, timezone, 30)) add(e.date, `🌇 ${e.description}`);
  const yearData = computeYearData(latitude, start.getFullYear());
  for (const e of findUpcomingDaylightMilestones(start, yearData, latitude, 60)) add(e.date, `☀ ${e.description}`);

  // Full and new moons through the window
  let from = start;
  while (from < end) {
    const phases = findNextMoonPhases(from);
    if (phases.length === 0) break;
    for (const p of phases) {
      if (p.name !== 'Full Moon' && p.name !== 'New Moon') continue;
      const { year, month, day } = getCalendarDayInTimezone(p.date, timezone);
      add(new Date(year, month - 1, day), p.name === 'Full Moon' ? '🌕 Full moon' : '🌑 New moon');
    }
    from = new Date(phases[phases.length - 1].date.getTime() + 3600000);
  }

  // The same milestone can be found twice (e.g. near the start of the window); keep one
  const seen = new Set();
  return events.filter((e) => {
    const key = `${ymd(e.date)}:${e.summary}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildCalendar(location, today, stamp) {
  const slug = calendarSlug(location.name);
  const start = addDays(today, -DAYS_BACK);
  const end = addDays(today, DAYS_AHEAD);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Daylight Tracker//Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(`Daylight – ${location.name}`)}`,
    `X-WR-CALDESC:${escapeText(`Sunrise, sunset and daylight for ${location.name}, from ${SITE_URL}`)}`,
    `X-WR-TIMEZONE:${location.timezone}`,
    'REFRESH-INTERVAL;VALUE=DURATION:P1D',
    'X-PUBLISHED-TTL:P1D',
  ];

  let previous = getSunData(addDays(start, -1), location.latitude, location.longitude, location.timezone);
  for (let date = start; date < end; date = addDays(date, 1)) {
    const sun = getSunData(date, location.latitude, location.longitude, location.timezone);
    lines.push(...allDayEvent({
      uid: `${slug}-${ymd(date)}-sun@daylight-tracker`,
      date,
      summary: dailySummary(sun, previous, location.timezone),
      description: dailyDescription(date, sun, location),
      stamp,
    }));
    previous = sun;
  }

  for (const event of noteworthyEvents(location, start, end)) {
    lines.push(...allDayEvent({
      uid: `${slug}-${ymd(event.date)}-${hash(event.summary)}@daylight-tracker`,
      date: event.date,
      summary: event.summary,
      stamp,
    }));
  }

  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}

// --- Main ---

const now = new Date();
const stamp = utcStamp(now);
mkdirSync(outDir, { recursive: true });
for (const location of PRESET_LOCATIONS) {
  // "Today" in the location's own timezone
  const { year, month, day } = getCalendarDayInTimezone(now, location.timezone);
  const today = new Date(year, month - 1, day);
  const file = join(outDir, `${calendarSlug(location.name)}.ics`);
  writeFileSync(file, buildCalendar(location, today, stamp));
}
console.log(`Wrote ${PRESET_LOCATIONS.length} calendars to ${outDir}`);
