<script>
  import { computeYearData, getSunData, getDayOfYear, getDaysInYear, formatDuration, formatDateShort } from '../lib/solar.js';
  import { PRESET_LOCATIONS, formatTimeInTimezone, formatDurationChange, findPresetLocation, formatLatitude } from '../lib/utils.js';
  import ChartCard from './ChartCard.svelte';
  import ChartTooltip from './ChartTooltip.svelte';
  import PresetPicker from './PresetPicker.svelte';

  let {
    selectedDate, latitude, longitude, timezone,
    compareName = $bindable(null),
    hoveredDate = null, onHoverDate = null, onDateSelect = null
  } = $props();

  let tooltipX = $state(0);
  let tooltipY = $state(0);
  let isHovering = $state(false);

  const width = 600;
  const height = 250;
  const padding = { top: 16, right: 84, bottom: 30, left: 40 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const hereColor = 'var(--color-sun)';
  const otherColor = 'var(--color-compare)';

  let other = $derived(PRESET_LOCATIONS.find((p) => p.name === compareName) ?? null);
  let year = $derived(selectedDate.getFullYear());
  let hereYear = $derived(computeYearData(latitude, year));
  let otherYear = $derived(other ? computeYearData(other.latitude, year) : null);

  let herePreset = $derived(findPresetLocation(latitude, longitude));
  let hereName = $derived(herePreset ? herePreset.name.split(',')[0] : 'Here');
  let otherName = $derived(other ? other.name.split(',')[0] : '');

  // Suggestions when nothing is chosen: somewhere contrasting with here
  let suggestions = $derived(
    [latitude > 0 ? 'Sydney, Australia' : 'London, UK', 'Equator', Math.abs(latitude) < 60 ? 'Longyearbyen, Svalbard' : 'Singapore']
      .map((name) => PRESET_LOCATIONS.find((p) => p.name === name))
      .filter((p) => p && p !== herePreset)
  );

  // Difference strip: here minus there, in hours, on a symmetric scale
  const diffHeight = 70;
  let diffMax = $derived(otherYear ? Math.max(1, ...hereYear.map((d, i) => Math.abs(d.daylightHours - otherYear[i].daylightHours))) : 1);
  let diffY = $derived((h) => diffHeight / 2 - (h / diffMax) * (diffHeight / 2 - 4));
  function diffArea(clamp) {
    if (!otherYear) return '';
    const pts = hereYear.map((d, i) => `${i ? 'L' : 'M'}${xScale(i)},${diffY(clamp(d.daylightHours - otherYear[i].daylightHours))}`).join(' ');
    return `${pts} L${xScale(hereYear.length - 1)},${diffHeight / 2} L${xScale(0)},${diffHeight / 2} Z`;
  }
  let moreArea = $derived(diffArea((v) => Math.max(0, v)));
  let lessArea = $derived(diffArea((v) => Math.min(0, v)));

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
        diff: formatDurationChange(here.daylight - there.daylight).replace('-', '−'),
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
    <PresetPicker bind:value={compareName} placeholder="Compare with…" label="Compare with" />
  {/snippet}
  {#if other}
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions, a11y_no_noninteractive_element_interactions -->
    <div class="cursor-crosshair" onclick={handleClick} onmousemove={handleMouseMove} onmouseleave={handleMouseLeave}>
      <svg viewBox="0 0 {width} {height}" class="w-full" role="img" aria-label="Daylight through the year in {hereName} and {otherName}. Click to select a date.">
        {#each [0, 6, 12, 18, 24] as hours}
          <line x1={padding.left} y1={yScale(hours)} x2={width - padding.right} y2={yScale(hours)} stroke="currentColor" class="text-gray-300 dark:text-gray-600" stroke-opacity="0.6" stroke-dasharray="2 3" />
          <text x={padding.left - 8} y={yScale(hours) + 4} text-anchor="end" class="fill-gray-500 text-[11px] dark:fill-gray-400">{hours}h</text>
        {/each}
        {#each monthTicks as { x, label }}
          <text x={x + chartWidth / 24} y={height - 8} text-anchor="middle" class="fill-gray-500 text-[11px] dark:fill-gray-400">{label}</text>
        {/each}
        <path d={linePath(otherYear)} fill="none" stroke={otherColor} stroke-width="2.5" stroke-linejoin="round" />
        <path d={linePath(hereYear)} fill="none" stroke={hereColor} stroke-width="2.5" stroke-linejoin="round" />
        <!-- Direct labels at the line ends -->
        <text x={width - padding.right + 6} y={yScale(hereYear.at(-1).daylightHours) + (hereYear.at(-1).daylightHours >= otherYear.at(-1).daylightHours ? -2 : 10)} class="fill-gray-700 text-[11px] font-medium dark:fill-gray-200">{hereName}</text>
        <text x={width - padding.right + 6} y={yScale(otherYear.at(-1).daylightHours) + (hereYear.at(-1).daylightHours >= otherYear.at(-1).daylightHours ? 10 : -2)} class="fill-gray-700 text-[11px] font-medium dark:fill-gray-200">{otherName}</text>
        {#if hoveredIndex != null}
          <line x1={xScale(hoveredIndex)} y1={padding.top} x2={xScale(hoveredIndex)} y2={padding.top + chartHeight} stroke="var(--color-ink-muted)" stroke-width="1.5" />
        {/if}
        {#if selectedIndex != null}
          <line x1={xScale(selectedIndex)} y1={padding.top} x2={xScale(selectedIndex)} y2={padding.top + chartHeight} stroke="var(--color-halo)" stroke-width="4" />
          <line x1={xScale(selectedIndex)} y1={padding.top} x2={xScale(selectedIndex)} y2={padding.top + chartHeight} stroke="var(--color-ink)" stroke-width="2" />
        {/if}
      </svg>
      <!-- Difference: here minus there -->
      <p class="mt-1 text-xs font-medium text-gray-700 dark:text-gray-300">Difference ({hereName} − {otherName})</p>
      <svg viewBox="0 0 {width} {diffHeight}" class="w-full" aria-hidden="true">
        <path d={moreArea} fill="var(--color-gain)" fill-opacity="0.55" />
        <path d={lessArea} fill="var(--color-loss)" fill-opacity="0.55" />
        <line x1={padding.left} x2={width - padding.right} y1={diffHeight / 2} y2={diffHeight / 2} stroke="var(--color-ink-muted)" stroke-opacity="0.6" />
        <text x={padding.left - 8} y={diffY(diffMax) + 4} text-anchor="end" class="fill-gray-500 text-[11px] dark:fill-gray-400">+{Math.round(diffMax)}h</text>
        <text x={padding.left - 8} y={diffY(-diffMax) + 4} text-anchor="end" class="fill-gray-500 text-[11px] dark:fill-gray-400">−{Math.round(diffMax)}h</text>
        <text x={width - padding.right + 6} y={diffY(diffMax / 2) + 4} class="fill-gray-500 text-[10px] dark:fill-gray-400">more here</text>
        <text x={width - padding.right + 6} y={diffY(-diffMax / 2) + 4} class="fill-gray-500 text-[10px] dark:fill-gray-400">less here</text>
        {#if selectedIndex != null}
          <line x1={xScale(selectedIndex)} y1="0" x2={xScale(selectedIndex)} y2={diffHeight} stroke="var(--color-halo)" stroke-width="4" />
          <line x1={xScale(selectedIndex)} y1="0" x2={xScale(selectedIndex)} y2={diffHeight} stroke="var(--color-ink)" stroke-width="2" />
        {/if}
      </svg>
    </div>

    <div class="mt-4 overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-gray-200 dark:border-gray-700">
            <th class="py-2 pr-3 text-left font-medium text-gray-600 dark:text-gray-400">{formatDateShort(selectedDate)}</th>
            <th class="py-2 pr-3 text-left font-medium text-gray-600 dark:text-gray-400"><span class="mr-1.5 inline-block h-0.5 w-3 align-middle" style="background: {hereColor}"></span>{hereName}</th>
            <th class="py-2 pr-3 text-left font-medium text-gray-600 dark:text-gray-400"><span class="mr-1.5 inline-block h-0.5 w-3 align-middle" style="background: {otherColor}"></span>{otherName}</th>
            <th class="py-2 text-right font-medium text-gray-600 dark:text-gray-400">Difference</th>
          </tr>
        </thead>
        <tbody>
          {#each rows as row}
            <tr class="border-b border-gray-100 dark:border-gray-700/50">
              <td class="py-1.5 pr-3 text-gray-600 dark:text-gray-400">{row.label}</td>
              <td class="py-1.5 pr-3 font-medium tabular-nums text-gray-900 dark:text-gray-100">{row.here}</td>
              <td class="py-1.5 pr-3 font-medium tabular-nums text-gray-900 dark:text-gray-100">{row.there}</td>
              <td class="py-1.5 text-right font-medium tabular-nums text-gray-700 dark:text-gray-300">{row.diff}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
      Times are local to each location. {hereName} has more daylight on {moreDaylightDays} of {hereYear.length} days in {year}.
    </p>

    {#if hoveredIndex != null && isHovering}
      <ChartTooltip x={tooltipX} y={tooltipY} title={formatDateShort(hereYear[hoveredIndex].date)} rows={[
        { label: hereName, value: formatDuration(hereYear[hoveredIndex].daylight), swatch: hereColor },
        { label: otherName, value: formatDuration(otherYear[hoveredIndex].daylight), swatch: otherColor }
      ]} />
    {/if}
  {:else}
    <div class="flex flex-wrap items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
      <span>Pick a place above, or try:</span>
      {#each suggestions as s}
        <button
          type="button"
          class="rounded-full px-3 py-1 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-gray-200 dark:ring-gray-600 dark:hover:bg-gray-700"
          onclick={() => compareName = s.name}
        >{s.name.split(',')[0]} <span class="font-normal text-gray-500 dark:text-gray-400">{formatLatitude(s.latitude)}</span></button>
      {/each}
    </div>
  {/if}
</ChartCard>
