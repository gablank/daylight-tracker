<script>
  import { computeSolarNoonYear, getDayOfYear, getDaysInYear, formatDateShort } from '../lib/solar.js';
  import { clockHoursInTimezone, formatTimeInTimezone, formatDurationChangeMinutesSeconds } from '../lib/utils.js';
  import ChartCard from './ChartCard.svelte';
  import ChartTooltip from './ChartTooltip.svelte';

  let { selectedDate, latitude, longitude, timezone, hoveredDate = null, onHoverDate = null, onDateSelect = null } = $props();

  let tooltipX = $state(0);
  let tooltipY = $state(0);
  let isHovering = $state(false);

  const width = 600;
  const height = 260;
  const padding = { top: 24, right: 20, bottom: 40, left: 52 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  let year = $derived(selectedDate.getFullYear());
  let noonData = $derived(computeSolarNoonYear(year, latitude, longitude, timezone));

  // Mean solar noon on the local clock (no equation of time) — the reference the sun drifts around
  let meanNoonHours = $derived(
    noonData.map((d, i) => clockHoursInTimezone(new Date(Date.UTC(year, 0, i + 1, 12) - longitude * 240000), timezone))
  );

  // Y range: all values, padded and rounded out to 15 minutes
  let yRange = $derived.by(() => {
    const values = [...noonData.map((d) => d.clockHours), ...meanNoonHours];
    const quarter = 0.25;
    return {
      min: Math.floor((Math.min(...values) - 0.05) / quarter) * quarter,
      max: Math.ceil((Math.max(...values) + 0.05) / quarter) * quarter,
    };
  });

  let yTicks = $derived.by(() => {
    const span = yRange.max - yRange.min;
    const step = span > 2 ? 0.5 : 0.25;
    const ticks = [];
    for (let v = Math.ceil(yRange.min / step) * step; v <= yRange.max + 1e-9; v += step) ticks.push(v);
    return ticks;
  });

  function xScale(dayIndex) {
    return padding.left + (dayIndex / Math.max(noonData.length - 1, 1)) * chartWidth;
  }

  function yScale(hours) {
    return padding.top + chartHeight - ((hours - yRange.min) / (yRange.max - yRange.min)) * chartHeight;
  }

  function formatClock(hours) {
    const totalMinutes = Math.round(hours * 60);
    return `${String(Math.floor(totalMinutes / 60) % 24).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`;
  }

  // Break lines where the clock jumps (DST changes) instead of drawing a steep connecting segment
  function linePath(values) {
    return values
      .map((v, i) => {
        const jump = i > 0 && Math.abs(v - values[i - 1]) > 0.25;
        return `${i === 0 || jump ? 'M' : 'L'} ${xScale(i)} ${yScale(v)}`;
      })
      .join(' ');
  }

  let solarNoonPath = $derived(linePath(noonData.map((d) => d.clockHours)));
  let meanNoonPath = $derived(linePath(meanNoonHours));

  let monthTicks = $derived(
    months.map((label, monthIndex) => ({
      label,
      x: xScale(getDayOfYear(new Date(year, monthIndex, 1)) - 1),
    }))
  );

  function dayIndexOf(date) {
    if (!date || date.getFullYear() !== year) return null;
    return getDayOfYear(date) - 1;
  }

  let selectedIndex = $derived(dayIndexOf(selectedDate));
  let hoveredIndex = $derived(dayIndexOf(hoveredDate));
  let selectedDay = $derived(selectedIndex != null ? noonData[selectedIndex] : null);

  function getDateAtX(svg, clientX) {
    const rect = svg.getBoundingClientRect();
    const scale = Math.min(rect.width / width, rect.height / height);
    const offsetX = (rect.width - width * scale) / 2;
    const svgX = (clientX - rect.left - offsetX) / scale;
    const clickX = svgX - padding.left;
    if (clickX < 0 || clickX > chartWidth) return null;
    const dayOfYear = Math.round((clickX / chartWidth) * (getDaysInYear(year) - 1)) + 1;
    return new Date(year, 0, dayOfYear);
  }

  function handleClick(event) {
    const date = getDateAtX(event.currentTarget, event.clientX);
    if (date) onDateSelect?.(date);
    onHoverDate?.(null);
  }

  function handleMouseMove(event) {
    const date = getDateAtX(event.currentTarget, event.clientX);
    onHoverDate?.(date);
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

<ChartCard id="solar-noon" title="Solar noon" class="h-full">
  {#snippet subtitle()}
    {#if selectedDay}
        {formatDateShort(selectedDate)}: solar noon at
        <span class="font-medium text-gray-900 dark:text-gray-100">{formatTimeInTimezone(selectedDay.solarNoon, timezone)}</span>,
        sun
        <span class="font-medium text-gray-900 dark:text-gray-100">{formatDurationChangeMinutesSeconds(Math.abs(selectedDay.equationOfTime) * 60000).slice(1)}</span>
        {selectedDay.equationOfTime >= 0 ? 'ahead of' : 'behind'} the clock average
    {:else}
      When the sun is highest, by the clock.
    {/if}
  {/snippet}

  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions a11y_no_noninteractive_element_interactions -->
  <svg
    viewBox="0 0 {width} {height}"
    class="w-full cursor-pointer outline-none"
    onclick={handleClick}
    onmousemove={handleMouseMove}
    onmouseleave={handleMouseLeave}
    role="img"
    aria-label="Clock time of solar noon through the year. Click to select a date."
  >
    <!-- Y axis: clock time -->
    {#each yTicks as tick}
      {@const y = yScale(tick)}
      <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="currentColor" stroke-opacity="0.15" stroke-dasharray="2,2" />
      <text x={padding.left - 8} y={y + 4} text-anchor="end" class="fill-gray-500 dark:fill-gray-400 text-xs">{formatClock(tick)}</text>
    {/each}

    <!-- X axis: months -->
    {#each monthTicks as { x, label }}
      <line x1={x} y1={padding.top + chartHeight} x2={x} y2={padding.top + chartHeight + 6} stroke="currentColor" class="stroke-gray-400 dark:stroke-gray-500" />
      <text x={x} y={height - 8} text-anchor="middle" class="fill-gray-500 dark:fill-gray-400 text-xs">{label}</text>
    {/each}

    <!-- Mean solar noon (reference) and actual solar noon -->
    <path d={meanNoonPath} fill="none" stroke="currentColor" stroke-opacity="0.35" stroke-width="1.5" stroke-dasharray="4,4" />
    <path d={solarNoonPath} fill="none" stroke="rgb(245, 158, 11)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />

    <!-- Hovered date -->
    {#if hoveredIndex != null}
      <line x1={xScale(hoveredIndex)} y1={padding.top} x2={xScale(hoveredIndex)} y2={padding.top + chartHeight} stroke="var(--color-ink-muted)" stroke-width="2" stroke-opacity="0.6" />
    {/if}

    <!-- Selected date -->
    {#if selectedIndex != null}
      <line x1={xScale(selectedIndex)} y1={padding.top} x2={xScale(selectedIndex)} y2={padding.top + chartHeight} stroke="var(--color-ink)" stroke-width="2" stroke-opacity="0.9" />
      <circle cx={xScale(selectedIndex)} cy={yScale(noonData[selectedIndex].clockHours)} r="4" fill="var(--color-ink)" stroke="var(--color-halo)" stroke-width="2" />
    {/if}
  </svg>

  {#snippet legend()}
    <div class="flex items-center gap-2">
      <div class="w-4 h-0.5 bg-amber-500"></div>
      <span>Solar noon</span>
    </div>
    <div class="flex items-center gap-2">
      <div class="w-4 border-t-2 border-dashed border-gray-400"></div>
      <span>Mean solar noon (clock average)</span>
    </div>
  {/snippet}

  <!-- Hover tooltip -->
  {#if hoveredIndex != null && isHovering}
    {@const day = noonData[hoveredIndex]}
    <ChartTooltip x={tooltipX} y={tooltipY} title={formatDateShort(day.date)} rows={[
      { label: 'Solar noon', value: formatTimeInTimezone(day.solarNoon, timezone) },
      { label: 'Equation of time', value: formatDurationChangeMinutesSeconds(day.equationOfTime * 60000) }
    ]} />
  {/if}
</ChartCard>
