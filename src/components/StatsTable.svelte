<script>
  import { formatDuration, formatDateShort, getSunData, findDateWithGain, getDayOfYear, getSolsticeProgress, getTwilightInfo } from '../lib/solar.js';
  import { addDays, formatDurationChange, formatTimeInTimezone } from '../lib/utils.js';
  import ChartCard from './ChartCard.svelte';
  import DayTooltip from './DayTooltip.svelte';
  
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
        fraction: futureData.daylight / 86400000,
        change: formatDurationChange(change).replace('-', '−'),
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
    { key: 'civil', label: 'Civil', range: '0° to −6°', color: 'var(--color-civil)' },
    { key: 'nautical', label: 'Nautical', range: '−6° to −12°', color: 'var(--color-nautical)' },
    { key: 'astronomical', label: 'Astronomical', range: '−12° to −18°', color: 'var(--color-astro)' },
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

<ChartCard id="stats" title="Daylight statistics" subtitle="How daylight will change over the coming weeks, and when it reaches each amount.">
  <div class="@container">
  
  <!-- Mirror Date section (full width) -->
  {#if mirrorDateInfo}
    <div class="mb-6">
      <h4 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
        Mirror date
      </h4>
      <div class="flex items-start gap-3 rounded-lg bg-gray-50 p-3 dark:bg-gray-900/40">
        <span class="mt-0.5 inline-block h-4 w-4 shrink-0 rounded-full border-2 border-dashed border-gray-900 dark:border-white" aria-hidden="true"></span>
        <p class="text-sm text-gray-700 dark:text-gray-300">
          <button
            type="button"
            class="-mx-0.5 cursor-pointer rounded px-0.5 font-semibold text-gray-900 underline decoration-dotted underline-offset-2 hover:decoration-solid focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-white"
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
  <div class="grid grid-cols-1 @2xl:grid-cols-2 gap-6">
    <!-- Future Daylight -->
    <div>
      <h4 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
        Future daylight
      </h4>
      <div class="overflow-x-auto">
        <table class="w-full whitespace-nowrap text-sm">
          <thead>
            <tr class="border-b border-gray-200 dark:border-gray-700">
              <th class="text-left py-2 pr-3 font-medium text-gray-600 dark:text-gray-400">Period</th>
              <th class="text-left py-2 pr-3 font-medium text-gray-600 dark:text-gray-400">Date</th>
              <th class="text-left py-2 pr-3 font-medium text-gray-600 dark:text-gray-400">Daylight</th>
              <th class="text-right py-2 font-medium text-gray-600 dark:text-gray-400">Change</th>
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
                    class="cursor-pointer hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded px-0.5 -mx-0.5 text-left"
                    onclick={() => { setHovered(null); onDateSelect?.(row.dateObj); }}
                  >
                    {row.date}
                  </button>
                </td>
                <td class="py-1.5 pr-3">
                  <span class="flex items-center gap-2">
                    <span class="relative h-1.5 w-12 shrink-0 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700" aria-hidden="true">
                      <span class="absolute inset-y-0 left-0 rounded-full" style="width: {row.fraction * 100}%; background: var(--color-sun)"></span>
                    </span>
                    <span class="font-medium tabular-nums text-gray-900 dark:text-gray-100">{row.daylight}</span>
                  </span>
                </td>
                <td class="py-1.5 text-right font-medium tabular-nums text-gray-700 dark:text-gray-300">{row.change}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
    
    <!-- Daylight Changes -->
    <div>
      <h4 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
        Daylight changes
      </h4>
      <div class="overflow-x-auto">
        <table class="w-full whitespace-nowrap text-sm">
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
                <td class="py-1.5 pr-3 font-medium tabular-nums text-gray-900 dark:text-gray-100">{row.label.replace('-', '−')}</td>
                <td class="py-1.5 pr-3 text-gray-600 dark:text-gray-400">
                  {#if row.dateObj}
                    <button
                      type="button"
                      class="cursor-pointer hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded px-0.5 -mx-0.5 text-left"
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

  <div class="grid grid-cols-1 @2xl:grid-cols-2 gap-6 mt-6">
    <!-- Solstice progress -->
    {#if solsticeProgress}
      {@const sinceLast = solsticeProgress.daylight - solsticeProgress.last.daylight}
      {@const untilNext = solsticeProgress.next.daylight - solsticeProgress.daylight}
      <div>
        <h4 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
          Solstice progress
        </h4>
        <div class="bg-gray-50 dark:bg-gray-700/30 rounded-md p-3 space-y-2 text-sm text-gray-700 dark:text-gray-300">
          {#each [
            { value: sinceLast, text: 'since the', solstice: solsticeProgress.last },
            { value: untilNext, text: 'to go until the', solstice: solsticeProgress.next },
          ] as row}
            <p>
              <span class="font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                {formatDurationChange(row.value).replace('-', '−')}
              </span>
              {row.text} {row.solstice.name}
              <span class="whitespace-nowrap">(<button
                type="button"
                class="cursor-pointer hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded px-0.5 -mx-0.5"
                onclick={() => { setHovered(null); onDateSelect?.(row.solstice.date); }}
                onmouseenter={(e) => { setHovered(row.solstice.date); tooltipX = e.clientX; tooltipY = e.clientY; }}
                onmousemove={(e) => { tooltipX = e.clientX; tooltipY = e.clientY; }}
                onmouseleave={() => setHovered(null)}
              >{formatDateShort(row.solstice.date)}</button>)</span>
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
          <table class="w-full whitespace-nowrap text-sm">
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
                    <span class="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm ring-1 ring-black/10 dark:ring-white/15" style="background: {phase.color}" aria-hidden="true"></span>{phase.label} <span class="block pl-4 text-xs text-gray-500 sm:inline sm:pl-0 dark:text-gray-400">({phase.range})</span>
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
                  <span class="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm ring-1 ring-black/10 dark:ring-white/15" style="background: var(--color-night)" aria-hidden="true"></span>True night <span class="block pl-4 text-xs text-gray-500 sm:inline sm:pl-0 dark:text-gray-400">(below −18°)</span>
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
  </div>
  {#if hoveredDate}
    <DayTooltip x={tooltipX} y={tooltipY} date={hoveredDate} {latitude} {longitude} {timezone} />
  {/if}
</ChartCard>
