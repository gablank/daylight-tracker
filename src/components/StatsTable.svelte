<script>
  import { formatDuration, formatDateShort, getSunData, findDateWithGain, getDayOfYear, getDayStatsForTooltip, getSolsticeProgress, getTwilightInfo } from '../lib/solar.js';
  import { addDays, formatDurationChange, formatTimeInTimezone } from '../lib/utils.js';
  import SectionLink from './SectionLink.svelte';
  
  let { selectedDate, yearData, latitude, oppositeDate, longitude = 0, timezone = null, onDateSelect = null, onHoverDate = null } = $props();

  let hoveredDate = $state(null);
  let tooltipX = $state(0);
  let tooltipY = $state(0);
  
  // Sync local hover with global hover for cross-component markers
  function setHovered(date) {
    hoveredDate = date;
    onHoverDate?.(date);
  }
  
  // Section 0: Mirror/Opposite date info
  let mirrorDateInfo = $derived.by(() => {
    if (!oppositeDate || !selectedDate || !yearData) return null;
    
    const currentData = yearData[getDayOfYear(selectedDate) - 1];
    if (!currentData) return null;
    
    // Look up the opposite date's daylight from yearData
    const oppositeDOY = getDayOfYear(oppositeDate.date);
    const oppositeData = yearData[oppositeDOY - 1];
    if (!oppositeData) return null;
    
    return {
      date: formatDateShort(oppositeDate.date),
      dateObj: oppositeDate.date,
      daylight: formatDuration(oppositeData.daylight),
      currentDaylight: formatDuration(currentData.daylight),
      diff: Math.abs(oppositeData.daylight - currentData.daylight)
    };
  });
  
  // Section 1: Future daylight (1w through 10w)
  let futureDaylight = $derived.by(() => {
    if (!yearData || !selectedDate) return [];
    
    const currentData = getSunData(selectedDate, latitude);
    const weeks = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    
    return weeks.map(w => {
      const date = addDays(selectedDate, w * 7);
      const futureData = getSunData(date, latitude);
      const change = futureData.daylight - currentData.daylight;
      
      return {
        label: `+${w}w`,
        date: formatDateShort(date),
        dateObj: date,
        daylight: formatDuration(futureData.daylight),
        change: formatDurationChange(change),
        isGain: change >= 0
      };
    });
  });
  
  // Section 2: Daylight changes - gains and losses
  let daylightChanges = $derived.by(() => {
    if (!yearData || !selectedDate) return [];
    
    // Define changes: positive = gain, negative = loss
    // Values in hours (use fractions for minutes: 1/60 = 1 minute)
    const changes = [
      { value: 1/60, label: '+1m' },
      { value: 1, label: '+1h' },
      { value: 2, label: '+2h' },
      { value: 3, label: '+3h' },
      { value: 4, label: '+4h' },
      { value: -1/60, label: '-1m' },
      { value: -1, label: '-1h' },
      { value: -2, label: '-2h' },
      { value: -3, label: '-3h' },
      { value: -4, label: '-4h' },
    ];
    
    return changes.map(({ value, label }) => {
      const result = findDateWithGain(selectedDate, yearData, value);
      return {
        label,
        date: result ? formatDateShort(result.date) : 'N/A',
        dateObj: result ? result.date : null,
        daylight: result ? formatDuration(result.daylight) : '--',
        isGain: value > 0
      };
    });
  });

  // Section 3: Daylight change since the last solstice / until the next one
  let solsticeProgress = $derived(selectedDate ? getSolsticeProgress(selectedDate, latitude, timezone) : null);

  // Section 4: Twilight phase lengths on the selected day
  let twilight = $derived(selectedDate ? getTwilightInfo(selectedDate, latitude, longitude, timezone) : null);
  const twilightPhases = [
    { key: 'civil', label: 'Civil', range: '0° to −6°' },
    { key: 'nautical', label: 'Nautical', range: '−6° to −12°' },
    { key: 'astronomical', label: 'Astronomical', range: '−12° to −18°' },
  ];

  function formatPhase(value) {
    if (typeof value === 'number') return formatDuration(value);
    if (value === 'all night') return 'All night';
    return '—';
  }

  // Clear hover/tooltip on scroll or touchmove so it doesn't stick on mobile
  $effect(() => {
    const clear = () => { setHovered(null); };
    window.addEventListener('scroll', clear, true);
    window.addEventListener('touchmove', clear, true);
    return () => {
      window.removeEventListener('scroll', clear, true);
      window.removeEventListener('touchmove', clear, true);
    };
  });
</script>

<div class="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
  <div class="flex items-center gap-0.5 mb-4">
    <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300">Daylight statistics</h3>
    <SectionLink id="stats" />
  </div>
  
  <!-- Mirror Date section (full width) -->
  {#if mirrorDateInfo}
    <div class="mb-6">
      <h4 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
        Mirror Date
      </h4>
      <div class="bg-orange-50 dark:bg-orange-900/20 rounded-md p-3">
        <p class="text-sm text-gray-700 dark:text-gray-300">
          <button
            type="button"
            class="font-semibold text-orange-600 dark:text-orange-400 cursor-pointer hover:underline focus:outline-none focus:ring-2 focus:ring-orange-400 rounded px-0.5 -mx-0.5"
            onclick={() => { setHovered(null); onDateSelect?.(mirrorDateInfo.dateObj); }}
            onmouseenter={(e) => { setHovered(mirrorDateInfo.dateObj); tooltipX = e.clientX; tooltipY = e.clientY; }}
            onmousemove={(e) => { tooltipX = e.clientX; tooltipY = e.clientY; }}
            onmouseleave={() => setHovered(null)}
          >
            {mirrorDateInfo.date}
          </button>
          has the same amount of daylight ({mirrorDateInfo.daylight}) as the selected date, 
          but on the opposite side of the nearest solstice.
        </p>
      </div>
    </div>
  {/if}
  
  <!-- Two tables side by side -->
  <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
    <!-- Future Daylight -->
    <div>
      <h4 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
        Future Daylight
      </h4>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-200 dark:border-gray-700">
              <th class="text-left py-2 pr-3 font-medium text-gray-600 dark:text-gray-400">Period</th>
              <th class="text-left py-2 pr-3 font-medium text-gray-600 dark:text-gray-400">Date</th>
              <th class="text-left py-2 pr-3 font-medium text-gray-600 dark:text-gray-400">Daylight</th>
              <th class="text-left py-2 font-medium text-gray-600 dark:text-gray-400">Change</th>
            </tr>
          </thead>
          <tbody>
            {#each futureDaylight as row}
              <tr
                class="border-b border-gray-100 dark:border-gray-700/50"
                onmouseenter={(e) => { setHovered(row.dateObj); tooltipX = e.clientX; tooltipY = e.clientY; }}
                onmousemove={(e) => { tooltipX = e.clientX; tooltipY = e.clientY; }}
                onmouseleave={() => setHovered(null)}
              >
                <td class="py-1.5 pr-3 text-gray-900 dark:text-gray-100">{row.label}</td>
                <td class="py-1.5 pr-3 text-gray-600 dark:text-gray-400 text-xs">
                  <button
                    type="button"
                    class="cursor-pointer hover:underline focus:outline-none focus:ring-2 focus:ring-orange-400 rounded px-0.5 -mx-0.5 text-left"
                    onclick={() => { setHovered(null); onDateSelect?.(row.dateObj); }}
                  >
                    {row.date}
                  </button>
                </td>
                <td class="py-1.5 pr-3 text-gray-900 dark:text-gray-100 font-medium">{row.daylight}</td>
                <td class="py-1.5 font-medium {row.isGain ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}">
                  {row.change}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
    
    <!-- Daylight Changes -->
    <div>
      <h4 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
        Daylight Changes
      </h4>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-200 dark:border-gray-700">
              <th class="text-left py-2 pr-3 font-medium text-gray-600 dark:text-gray-400">Change</th>
              <th class="text-left py-2 pr-3 font-medium text-gray-600 dark:text-gray-400">Date</th>
              <th class="text-left py-2 font-medium text-gray-600 dark:text-gray-400">Total</th>
            </tr>
          </thead>
          <tbody>
            {#each daylightChanges as row}
              <tr
                class="border-b border-gray-100 dark:border-gray-700/50"
                onmouseenter={(e) => { if (row.dateObj) { setHovered(row.dateObj); tooltipX = e.clientX; tooltipY = e.clientY; } }}
                onmousemove={(e) => { if (row.dateObj) { tooltipX = e.clientX; tooltipY = e.clientY; } }}
                onmouseleave={() => setHovered(null)}
              >
                <td class="py-1.5 pr-3 font-medium {row.isGain ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}">{row.label}</td>
                <td class="py-1.5 pr-3 text-gray-600 dark:text-gray-400">
                  {#if row.dateObj}
                    <button
                      type="button"
                      class="cursor-pointer hover:underline focus:outline-none focus:ring-2 focus:ring-orange-400 rounded px-0.5 -mx-0.5 text-left"
                      onclick={() => { setHovered(null); onDateSelect?.(row.dateObj); }}
                    >
                      {row.date}
                    </button>
                  {:else}
                    {row.date}
                  {/if}
                </td>
                <td class="py-1.5 text-gray-900 dark:text-gray-100 font-medium">{row.daylight}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
    <!-- Solstice progress -->
    {#if solsticeProgress}
      {@const sinceLast = solsticeProgress.daylight - solsticeProgress.last.daylight}
      {@const untilNext = solsticeProgress.next.daylight - solsticeProgress.daylight}
      <div>
        <h4 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
          Solstice Progress
        </h4>
        <div class="bg-gray-50 dark:bg-gray-700/30 rounded-md p-3 space-y-2 text-sm text-gray-700 dark:text-gray-300">
          {#each [
            { value: sinceLast, text: 'since the', solstice: solsticeProgress.last },
            { value: untilNext, text: 'to go until the', solstice: solsticeProgress.next },
          ] as row}
            <p>
              <span class="font-semibold {row.value >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}">
                {formatDurationChange(row.value)}
              </span>
              {row.text} {row.solstice.name}
              (<button
                type="button"
                class="cursor-pointer hover:underline focus:outline-none focus:ring-2 focus:ring-orange-400 rounded px-0.5 -mx-0.5"
                onclick={() => { setHovered(null); onDateSelect?.(row.solstice.date); }}
                onmouseenter={(e) => { setHovered(row.solstice.date); tooltipX = e.clientX; tooltipY = e.clientY; }}
                onmousemove={(e) => { tooltipX = e.clientX; tooltipY = e.clientY; }}
                onmouseleave={() => setHovered(null)}
              >{formatDateShort(row.solstice.date)}</button>)
            </p>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Twilight lengths -->
    {#if twilight}
      <div>
        <h4 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
          Twilight on {formatDateShort(selectedDate)}
        </h4>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-gray-200 dark:border-gray-700">
                <th class="text-left py-2 pr-3 font-medium text-gray-600 dark:text-gray-400">Phase</th>
                <th class="text-left py-2 pr-3 font-medium text-gray-600 dark:text-gray-400">Morning</th>
                <th class="text-left py-2 font-medium text-gray-600 dark:text-gray-400">Evening</th>
              </tr>
            </thead>
            <tbody>
              {#each twilightPhases as phase}
                <tr class="border-b border-gray-100 dark:border-gray-700/50">
                  <td class="py-1.5 pr-3 text-gray-900 dark:text-gray-100">
                    {phase.label} <span class="text-xs text-gray-500 dark:text-gray-400">({phase.range})</span>
                  </td>
                  {#if twilight.morning[phase.key] === 'all day'}
                    <td colspan="2" class="py-1.5 text-gray-900 dark:text-gray-100 font-medium">All day</td>
                  {:else}
                    <td class="py-1.5 pr-3 text-gray-900 dark:text-gray-100 font-medium">{formatPhase(twilight.morning[phase.key])}</td>
                    <td class="py-1.5 text-gray-900 dark:text-gray-100 font-medium">{formatPhase(twilight.evening[phase.key])}</td>
                  {/if}
                </tr>
              {/each}
              <tr class="border-b border-gray-100 dark:border-gray-700/50">
                <td class="py-1.5 pr-3 text-gray-900 dark:text-gray-100">
                  True night <span class="text-xs text-gray-500 dark:text-gray-400">(below −18°)</span>
                </td>
                <td colspan="2" class="py-1.5 text-gray-900 dark:text-gray-100 font-medium">
                  {twilight.night > 0 ? formatDuration(twilight.night) : 'None'}
                </td>
              </tr>
              <tr>
                <td class="py-1.5 pr-3 text-gray-900 dark:text-gray-100">Lowest sun</td>
                <td colspan="2" class="py-1.5 text-gray-900 dark:text-gray-100 font-medium">
                  {twilight.lowestAltitude.toFixed(1)}° at {formatTimeInTimezone(twilight.lowestAt, timezone)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    {/if}
  </div>
  {#if hoveredDate}
    {@const stats = getDayStatsForTooltip(hoveredDate, latitude, longitude, timezone)}
    <div
      class="fixed z-50 px-2 py-1.5 text-xs rounded shadow-lg bg-gray-800 text-gray-100 dark:bg-gray-700 dark:text-gray-200 pointer-events-none"
      style="left: {tooltipX + 12}px; top: {tooltipY + 8}px;"
    >
      <div class="font-medium">{stats.dateLabel}</div>
      <div>Sunrise: {stats.sunrise}</div>
      <div>Sunset: {stats.sunset}</div>
      <div>Daylight: {stats.daylight}</div>
    </div>
  {/if}
</div>
