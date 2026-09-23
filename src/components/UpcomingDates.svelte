<script>
  import ChartCard from './ChartCard.svelte';
  import DayTooltip from './DayTooltip.svelte';
  import { 
    formatDateShort, 
    getUpcomingAstronomicalEvents, 
    findUpcomingDaylightMilestones,
    findUpcomingSunriseMilestones,
    findUpcomingSunsetMilestones,
    findUpcomingDSTChanges,
    findSunTimeExtremes
  } from '../lib/solar.js';
  
  import { PRESET_LOCATIONS, calendarSlug } from '../lib/utils.js';

  let { selectedDate, yearData, latitude, longitude, timezone, onDateSelect = null, onHoverDate = null } = $props();

  // Subscribable calendar (generated at build time for each preset location)
  let calendarPreset = $derived(
    PRESET_LOCATIONS.find((p) =>
      Math.abs(p.latitude - latitude) < 0.1 && Math.abs(p.longitude - longitude) < 0.1 && p.timezone === timezone
    ) ?? null
  );
  let calendarUrl = $derived(
    calendarPreset
      ? new URL(`calendars/${calendarSlug(calendarPreset.name)}.ics`, window.location.origin + import.meta.env.BASE_URL).href
      : null
  );
  let googleCalendarUrl = $derived(
    calendarUrl ? `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(calendarUrl.replace(/^https?:/, 'webcal:'))}` : null
  );
  let calendarUrlCopied = $state(false);

  async function copyCalendarUrl() {
    try {
      await navigator.clipboard.writeText(calendarUrl);
      calendarUrlCopied = true;
      setTimeout(() => { calendarUrlCopied = false; }, 1500);
    } catch {
      // clipboard may be blocked in some contexts
    }
  }

  let hoveredGroup = $state(null);
  let tooltipX = $state(0);
  let tooltipY = $state(0);
  
  // Helper to set both local and global hover state
  function setHoveredGroup(group) {
    hoveredGroup = group;
    onHoverDate?.(group?.date ?? null);
  }
  
  // Priority values for sub-sorting within same date (lower = appears first)
  const PRIORITY = {
    DST: 0,
    ASTRONOMICAL: 1,  // Equinox/solstice appear first after DST
    SUNRISE: 2,
    SUNSET: 3,
    DAYLIGHT: 4
  };
  
  // Helper to get date key for grouping (YYYY-MM-DD format)
  function getDateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
  
  // Collect all noteworthy upcoming dates and sort them
  let upcomingDates = $derived.by(() => {
    if (!selectedDate || !yearData) return [];
    
    const events = [];
    
    // Add DST changes (priority 0) - pass latitude/longitude for sun times
    const dstChanges = findUpcomingDSTChanges(selectedDate, timezone, latitude, longitude, 2);
    const dstDateKeys = new Set(dstChanges.map(d => getDateKey(d.date)));
    
    for (const change of dstChanges) {
      // Add DST event itself
      events.push({
        date: change.date,
        dateKey: getDateKey(change.date),
        description: change.description,
        priority: PRIORITY.DST,
        type: 'dst'
      });
      
      // Add exact sunrise time for DST date
      if (change.sunriseTime) {
        events.push({
          date: change.date,
          dateKey: getDateKey(change.date),
          description: `Sunrise at ${change.sunriseTime}`,
          priority: PRIORITY.SUNRISE,
          type: 'sunrise'
        });
      }
      
      // Add exact sunset time for DST date
      if (change.sunsetTime) {
        events.push({
          date: change.date,
          dateKey: getDateKey(change.date),
          description: `Sunset at ${change.sunsetTime}`,
          priority: PRIORITY.SUNSET,
          type: 'sunset'
        });
      }
    }
    
    // Add sunrise milestones (priority 1) - skip DST dates
    // Deduplicate: keep only earliest sunrise time per date
    const sunriseMilestones = findUpcomingSunriseMilestones(selectedDate, latitude, longitude, timezone, 10);
    const sunriseByDate = new Map();
    for (const milestone of sunriseMilestones) {
      const dateKey = getDateKey(milestone.date);
      if (!dstDateKeys.has(dateKey)) {
        // Extract hour from description (e.g. "Sunrise at 06:00" -> 6)
        const hourMatch = milestone.description.match(/(\d{2}):/);
        const hour = hourMatch ? parseInt(hourMatch[1]) : 12;
        const existing = sunriseByDate.get(dateKey);
        // Keep earliest sunrise (lower hour value)
        if (!existing || hour < existing.hour) {
          sunriseByDate.set(dateKey, { ...milestone, hour });
        }
      }
    }
    // Add deduplicated sunrise events
    for (const milestone of sunriseByDate.values()) {
      events.push({
        date: milestone.date,
        dateKey: getDateKey(milestone.date),
        description: milestone.description,
        priority: PRIORITY.SUNRISE,
        type: 'sunrise'
      });
    }
    
    // Add sunset milestones (priority 2) - skip DST dates
    // Deduplicate: keep only latest sunset time per date
    const sunsetMilestones = findUpcomingSunsetMilestones(selectedDate, latitude, longitude, timezone, 10);
    const sunsetByDate = new Map();
    for (const milestone of sunsetMilestones) {
      const dateKey = getDateKey(milestone.date);
      if (!dstDateKeys.has(dateKey)) {
        // Extract hour from description (e.g. "Sunset at 19:00" -> 19)
        const hourMatch = milestone.description.match(/(\d{2}):/);
        const hour = hourMatch ? parseInt(hourMatch[1]) : 12;
        const existing = sunsetByDate.get(dateKey);
        // Keep latest sunset (higher hour value)
        if (!existing || hour > existing.hour) {
          sunsetByDate.set(dateKey, { ...milestone, hour });
        }
      }
    }
    // Add deduplicated sunset events
    for (const milestone of sunsetByDate.values()) {
      events.push({
        date: milestone.date,
        dateKey: getDateKey(milestone.date),
        description: milestone.description,
        priority: PRIORITY.SUNSET,
        type: 'sunset'
      });
    }
    
    // Add earliest/latest sunrise and sunset of the year
    for (const extreme of findSunTimeExtremes(selectedDate, latitude, longitude, timezone)) {
      events.push({
        date: extreme.date,
        dateKey: getDateKey(extreme.date),
        description: extreme.description,
        priority: extreme.type === 'sunrise' ? PRIORITY.SUNRISE : PRIORITY.SUNSET,
        type: extreme.type
      });
    }

    // Add daylight milestones (priority 3)
    // Deduplicate same-day events - keep only the "biggest" (highest hour value)
    const daylightMilestones = findUpcomingDaylightMilestones(selectedDate, yearData, latitude, 10);
    const daylightByDate = new Map();
    for (const milestone of daylightMilestones) {
      const key = getDateKey(milestone.date);
      // Extract hour value from description (e.g. "More than 12h of daylight" -> 12)
      const hourMatch = milestone.description.match(/(\d+)h/);
      const hours = hourMatch ? parseInt(hourMatch[1]) : 0;
      const existing = daylightByDate.get(key);
      if (!existing || hours > existing.hours) {
        daylightByDate.set(key, { ...milestone, hours });
      }
    }
    // Add the deduplicated daylight events
    for (const milestone of daylightByDate.values()) {
      events.push({
        date: milestone.date,
        dateKey: getDateKey(milestone.date),
        description: milestone.description,
        priority: PRIORITY.DAYLIGHT,
        type: 'daylight'
      });
    }
    
    // Add astronomical events (priority 4) - with hemisphere-appropriate names
    const astroEvents = getUpcomingAstronomicalEvents(selectedDate, latitude, 6, timezone);
    for (const event of astroEvents) {
      events.push({
        date: event.date,
        dateKey: getDateKey(event.date),
        description: event.name,
        priority: PRIORITY.ASTRONOMICAL,
        type: 'astronomical'
      });
    }
    
    // Sort by: (1) date, (2) priority within same date
    events.sort((a, b) => {
      const dateCompare = a.date.getTime() - b.date.getTime();
      if (dateCompare !== 0) return dateCompare;
      return a.priority - b.priority;
    });
    
    // Return first 25 events
    return events.slice(0, 25);
  });
  
  // Group events by date for display
  let groupedEvents = $derived.by(() => {
    const groups = [];
    let currentDateKey = null;
    
    for (const event of upcomingDates) {
      if (event.dateKey !== currentDateKey) {
        // Start a new group
        groups.push({
          dateKey: event.dateKey,
          date: event.date,
          events: [event],
          isFirstOfDate: true
        });
        currentDateKey = event.dateKey;
      } else {
        // Add to existing group
        groups[groups.length - 1].events.push(event);
      }
    }
    
    return groups;
  });

  // Clear hover/tooltip on scroll or touchmove so it doesn't stick on mobile
  $effect(() => {
    const clear = () => { setHoveredGroup(null); };
    window.addEventListener('scroll', clear, true);
    window.addEventListener('touchmove', clear, true);
    return () => {
      window.removeEventListener('scroll', clear, true);
      window.removeEventListener('touchmove', clear, true);
    };
  });
</script>

<ChartCard id="upcoming" title="Noteworthy upcoming dates" subtitle="Solstices, clock changes and round-number sunrises, sunsets and day lengths.">
  
  {#if groupedEvents.length > 0}
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-gray-200 dark:border-gray-700">
            <th class="text-left py-2 pr-4 font-medium text-gray-600 dark:text-gray-400 w-20">Date</th>
            <th class="text-left py-2 font-medium text-gray-600 dark:text-gray-400">Event</th>
          </tr>
        </thead>
        <tbody>
          {#each groupedEvents as group, groupIdx}
            {#each group.events as event, eventIdx}
              <tr
                class="{groupIdx > 0 && eventIdx === 0 ? 'border-t border-gray-300 dark:border-gray-600' : ''}"
                onmouseenter={() => setHoveredGroup(group)}
                onmousemove={(e) => { tooltipX = e.clientX; tooltipY = e.clientY; }}
                onmouseleave={() => setHoveredGroup(null)}
              >
                <td class="py-1.5 pr-4 text-gray-900 dark:text-gray-100 whitespace-nowrap align-top">
                  {#if eventIdx === 0}
                    <button
                      type="button"
                      class="font-medium text-left cursor-pointer hover:underline focus:outline-none focus:ring-2 focus:ring-orange-400 rounded px-0.5 -mx-0.5"
                      onclick={() => { setHoveredGroup(null); onDateSelect?.(group.date); }}
                    >
                      {formatDateShort(group.date)}
                    </button>
                  {/if}
                </td>
                <td class="py-1.5 text-gray-600 dark:text-gray-400">
                  {#if event.type === 'astronomical'}
                    <span class="font-medium text-amber-600 dark:text-amber-400">{event.description}</span>
                  {:else if event.type === 'dst'}
                    <span class="font-medium text-green-600 dark:text-green-400">{event.description}</span>
                  {:else if event.type === 'sunrise'}
                    <span class="text-orange-600 dark:text-orange-400">{event.description}</span>
                  {:else if event.type === 'sunset'}
                    <span class="text-purple-600 dark:text-purple-400">{event.description}</span>
                  {:else}
                    <span class="text-blue-600 dark:text-blue-400">{event.description}</span>
                  {/if}
                </td>
              </tr>
            {/each}
          {/each}
        </tbody>
      </table>
    </div>
  {:else}
    <p class="text-gray-500 dark:text-gray-400 text-sm">Loading upcoming dates...</p>
  {/if}
  <div class="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-400">
    {#if calendarPreset}
      <p class="mb-1.5">
        Subscribe to a calendar for {calendarPreset.name}: daily sunrise/sunset plus these dates, updated weekly.
      </p>
      <div class="flex flex-wrap gap-2">
        <a
          href={googleCalendarUrl}
          target="_blank"
          rel="noopener"
          class="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-blue-600 dark:text-blue-400"
        >
          Add to Google Calendar
        </a>
        <button
          type="button"
          onclick={copyCalendarUrl}
          class="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          {calendarUrlCopied ? 'Copied!' : 'Copy calendar URL (other apps)'}
        </button>
      </div>
    {:else}
      <p>Subscribable calendars are available for the preset locations (pick one from the location search).</p>
    {/if}
  </div>
  {#if hoveredGroup}
    <DayTooltip x={tooltipX} y={tooltipY} date={hoveredGroup.date} {latitude} {longitude} {timezone} />
  {/if}
</ChartCard>
