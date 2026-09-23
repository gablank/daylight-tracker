<script>
  import { computeYearData, getSunData, getDayOfYear, getDaysInYear, formatDuration, formatDateShort } from '../lib/solar.js';
  import { PRESET_LOCATION_GROUPS, PRESET_LOCATIONS, formatTimeInTimezone, formatDurationChange } from '../lib/utils.js';
  import ChartCard from './ChartCard.svelte';
  import ChartTooltip from './ChartTooltip.svelte';

  let {
    selectedDate, latitude, longitude, timezone,
    compareName = $bindable(null),
    hoveredDate = null, onHoverDate = null, onDateSelect = null
  } = $props();

  let tooltipX = $state(0);
  let tooltipY = $state(0);
  let isHovering = $state(false);

  const width = 600;
  const height = 240;
  const padding = { top: 16, right: 20, bottom: 40, left: 45 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const hereColor = 'var(--color-sun)';
  const otherColor = 'var(--color-compare)';

  let other = $derived(PRESET_LOCATIONS.find((p) => p.name === compareName) ?? null);
  let year = $derived(selectedDate.getFullYear());
  let hereYear = $derived(computeYearData(latitude, year));
  let otherYear = $derived(other ? computeYearData(other.latitude, year) : null);

  let hereLabel = $derived(`Here (${latitude.toFixed(1)}°, ${longitude.toFixed(1)}°)`);

  let moreDaylightDays = $derived(
    otherYear ? hereYear.filter((d, i) => d.daylight > otherYear[i].daylight).length : 0
  );

  function xScale(i) {
    return padding.left + (i / Math.max(hereYear.length - 1, 1)) * chartWidth;
  }
  function yScale(hours) {
    return padding.top + chartHeight - (hours / 24) * chartHeight;
  }
  function linePath(data) {
    return data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(d.daylightHours)}`).join(' ');
  }

  let monthTicks = $derived(months.map((label, m) => ({ label, x: xScale(getDayOfYear(new Date(year, m, 1)) - 1) })));

  function indexOf(date) {
    return date && date.getFullYear() === year ? getDayOfYear(date) - 1 : null;
  }
  let selectedIndex = $derived(indexOf(selectedDate));
  let hoveredIndex = $derived(indexOf(hoveredDate));

  // Side-by-side values for the selected date, each location's times in its own timezone
  let rows = $derived.by(() => {
    if (!other) return [];
    const here = getSunData(selectedDate, latitude, longitude, timezone);
    const there = getSunData(selectedDate, other.latitude, other.longitude, other.timezone);
    const time = (data, key, tz) =>
      data.isPolarDay ? 'Up all day' : data.isPolarNight ? 'Down all day' : formatTimeInTimezone(data[key], tz);
    return [
      { label: 'Sunrise', here: time(here, 'sunrise', timezone), there: time(there, 'sunrise', other.timezone), diff: '' },
      { label: 'Sunset', here: time(here, 'sunset', timezone), there: time(there, 'sunset', other.timezone), diff: '' },
      {
        label: 'Daylight',
        here: formatDuration(here.daylight),
        there: formatDuration(there.daylight),
        diff: formatDurationChange(here.daylight - there.daylight),
        gain: here.daylight >= there.daylight,
      },
    ];
  });

  function getDateAtX(svg, clientX) {
    const rect = svg.getBoundingClientRect();
    const scale = Math.min(rect.width / width, rect.height / height);
    const offsetX = (rect.width - width * scale) / 2;
    const clickX = (clientX - rect.left - offsetX) / scale - padding.left;
    if (clickX < 0 || clickX > chartWidth) return null;
    return new Date(year, 0, Math.round((clickX / chartWidth) * (getDaysInYear(year) - 1)) + 1);
  }

  function handleClick(event) {
    const date = getDateAtX(event.currentTarget, event.clientX);
    if (date) onDateSelect?.(date);
    onHoverDate?.(null);
  }

  function handleMouseMove(event) {
    onHoverDate?.(getDateAtX(event.currentTarget, event.clientX));
    isHovering = true;
    tooltipX = event.clientX;
    tooltipY = event.clientY;
  }

  function handleMouseLeave() {
    onHoverDate?.(null);
    isHovering = false;
  }

  // Clear hover/tooltip on scroll or touchmove so it doesn't stick on mobile
  $effect(() => {
    const clear = () => { onHoverDate?.(null); isHovering = false; };
    window.addEventListener('scroll', clear, true);
    window.addEventListener('touchmove', clear, true);
    return () => {
      window.removeEventListener('scroll', clear, true);
      window.removeEventListener('touchmove', clear, true);
    };
  });
</script>

<ChartCard id="compare" title="Compare locations" subtitle="Daylight through the year here and somewhere else.">
  {#snippet actions()}
    <label class="flex items-center gap-2">
      <span>Compare with:</span>
      <select
        value={compareName ?? ''}
        onchange={(e) => compareName = e.currentTarget.value || null}
        class="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">Select a location...</option>
        {#each PRESET_LOCATION_GROUPS as group}
          <optgroup label={group.label}>
            {#each group.locations as preset}
              <option value={preset.name}>{preset.name}</option>
            {/each}
          </optgroup>
        {/each}
      </select>
    </label>
  {/snippet}

  {#if other}
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions a11y_no_noninteractive_element_interactions -->
    <svg
      viewBox="0 0 {width} {height}"
      class="w-full cursor-pointer outline-none"
      onclick={handleClick}
      onmousemove={handleMouseMove}
      onmouseleave={handleMouseLeave}
      role="img"
      aria-label="Daylight through the year at both locations. Click to select a date."
    >
      {#each [0, 6, 12, 18, 24] as hours}
        <line x1={padding.left} y1={yScale(hours)} x2={width - padding.right} y2={yScale(hours)} stroke="currentColor" stroke-opacity="0.15" stroke-dasharray="2,2" />
        <text x={padding.left - 8} y={yScale(hours) + 4} text-anchor="end" class="fill-gray-500 dark:fill-gray-400 text-xs">{hours}h</text>
      {/each}
      {#each monthTicks as { x, label }}
        <line x1={x} y1={padding.top + chartHeight} x2={x} y2={padding.top + chartHeight + 6} stroke="currentColor" class="stroke-gray-400 dark:stroke-gray-500" />
        <text x={x} y={height - 8} text-anchor="middle" class="fill-gray-500 dark:fill-gray-400 text-xs">{label}</text>
      {/each}

      <path d={linePath(otherYear)} fill="none" stroke={otherColor} stroke-width="2" stroke-linejoin="round" />
      <path d={linePath(hereYear)} fill="none" stroke={hereColor} stroke-width="2" stroke-linejoin="round" />

      {#if hoveredIndex != null}
        <line x1={xScale(hoveredIndex)} y1={padding.top} x2={xScale(hoveredIndex)} y2={padding.top + chartHeight} stroke="var(--color-ink-muted)" stroke-width="2" stroke-opacity="0.6" />
      {/if}
      {#if selectedIndex != null}
        <line x1={xScale(selectedIndex)} y1={padding.top} x2={xScale(selectedIndex)} y2={padding.top + chartHeight} stroke="var(--color-ink)" stroke-width="2" stroke-opacity="0.9" />
      {/if}
    </svg>

    <div class="mt-2 flex flex-wrap justify-center gap-4 text-xs text-gray-600 dark:text-gray-400">
      <div class="flex items-center gap-2"><div class="w-4 h-0.5" style="background: {hereColor}"></div><span>{hereLabel}</span></div>
      <div class="flex items-center gap-2"><div class="w-4 h-0.5" style="background: {otherColor}"></div><span>{other.name}</span></div>
    </div>

    <div class="overflow-x-auto mt-4">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-gray-200 dark:border-gray-700">
            <th class="text-left py-2 pr-3 font-medium text-gray-600 dark:text-gray-400">{formatDateShort(selectedDate)}</th>
            <th class="text-left py-2 pr-3 font-medium text-gray-600 dark:text-gray-400">Here</th>
            <th class="text-left py-2 pr-3 font-medium text-gray-600 dark:text-gray-400">{other.name}</th>
            <th class="text-left py-2 font-medium text-gray-600 dark:text-gray-400">Difference</th>
          </tr>
        </thead>
        <tbody>
          {#each rows as row}
            <tr class="border-b border-gray-100 dark:border-gray-700/50">
              <td class="py-1.5 pr-3 text-gray-900 dark:text-gray-100">{row.label}</td>
              <td class="py-1.5 pr-3 text-gray-900 dark:text-gray-100 font-medium">{row.here}</td>
              <td class="py-1.5 pr-3 text-gray-900 dark:text-gray-100 font-medium">{row.there}</td>
              <td class="py-1.5 font-medium {row.gain ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}">{row.diff}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">
      Times are local to each location. Here has more daylight on {moreDaylightDays} of {hereYear.length} days in {year}.
    </p>

    {#if hoveredIndex != null && isHovering}
      <ChartTooltip x={tooltipX} y={tooltipY} title={formatDateShort(hereYear[hoveredIndex].date)} rows={[
        { label: 'Here', value: formatDuration(hereYear[hoveredIndex].daylight), swatch: hereColor },
        { label: other.name, value: formatDuration(otherYear[hoveredIndex].daylight), swatch: otherColor }
      ]} />
    {/if}
  {:else}
    <p class="text-sm text-gray-500 dark:text-gray-400">Pick a location to compare daylight through the year.</p>
  {/if}
</ChartCard>
