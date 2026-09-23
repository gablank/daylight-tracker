<script>
  import ChartCard from './ChartCard.svelte';
  import ChartTooltip from './ChartTooltip.svelte';
  import { computeSolarNoonYear, getDayOfYear, getDayStatsForTooltip, formatDuration } from '../lib/solar.js';
  import { computeTwilightBands } from '../lib/twilight.js';
  import { clockHoursInTimezone, formatTimeInTimezone, formatDurationChangeMinutesSeconds } from '../lib/utils.js';

  /**
   * The year as four strips sharing one date axis: day length, change per day,
   * sunrise/sunset with twilight, and solar noon. One crosshair and tooltip for all.
   */
  let {
    yearData, selectedDate, oppositeDate = null, latitude, longitude, timezone,
    hoveredDate = null, onHoverDate = null, onDateSelect = null
  } = $props();

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  let year = $derived(selectedDate.getFullYear());
  let n = $derived(yearData.length);

  // x in percent of the plot width; each day owns a column, lines go through its centre
  let xOf = $derived((i) => ((i + 0.5) / n) * 100);
  const indexOf = (date) => (date && date.getFullYear() === year ? getDayOfYear(date) - 1 : null);

  let selectedIndex = $derived(indexOf(selectedDate));
  let mirrorIndex = $derived(indexOf(oppositeDate?.date));
  let hoveredIndex = $derived(indexOf(hoveredDate));

  let monthStarts = $derived(months.map((label, m) => ({ label, x: (getDayOfYear(new Date(year, m, 1)) - 1) / n * 100 })));

  // --- Day length (0–24 h) ---
  const dayY = (hours) => 100 - (hours / 24) * 100;
  let dayPath = $derived(yearData.map((d, i) => `${i ? 'L' : 'M'}${xOf(i).toFixed(3)},${dayY(d.daylightHours).toFixed(3)}`).join(' '));
  let dayArea = $derived(`${dayPath} L${xOf(n - 1)},100 L${xOf(0)},100 Z`);
  const dayTicks = [0, 6, 12, 18, 24].map((h) => ({ y: dayY(h), label: `${h}h` }));

  // --- Change per day, minutes (centred difference so the solstices read ~0) ---
  let rates = $derived(yearData.map((d, i) => {
    const prev = yearData[Math.max(0, i - 1)];
    const next = yearData[Math.min(n - 1, i + 1)];
    const span = Math.min(n - 1, i + 1) - Math.max(0, i - 1);
    return (next.daylight - prev.daylight) / span / 60000;
  }));
  let rateMax = $derived.by(() => {
    const m = Math.max(0.5, ...rates.map(Math.abs));
    const step = m > 10 ? 5 : m > 4 ? 2 : m > 2 ? 1 : 0.5;
    return Math.ceil(m / step) * step;
  });
  let rateY = $derived((v) => 50 - (v / rateMax) * 50);
  let ratePath = (clamp) => rates.map((v, i) => `${i ? 'L' : 'M'}${xOf(i).toFixed(3)},${rateY(clamp(v)).toFixed(3)}`).join(' ') + ` L${xOf(n - 1)},50 L${xOf(0)},50 Z`;
  let gainArea = $derived(ratePath((v) => Math.max(0, v)));
  let lossArea = $derived(ratePath((v) => Math.min(0, v)));
  let rateTicks = $derived([rateMax, 0, -rateMax].map((v) => ({ y: rateY(v), label: v === 0 ? '0' : `${v > 0 ? '+' : '−'}${Math.abs(v)}m` })));

  // --- Sunrise & sunset through the twilights (clock time, midnight at the top) ---
  let twilight = $derived(computeTwilightBands(yearData, latitude, longitude, timezone));
  const ZONES = [
    { key: 'astronomical', color: 'var(--color-astro)' },
    { key: 'nautical', color: 'var(--color-nautical)' },
    { key: 'civil', color: 'var(--color-civil)' },
    { key: 'daylight', color: 'var(--color-day)' }
  ];
  let zoneRects = $derived(ZONES.map((z) => ({
    color: z.color,
    rects: twilight.flatMap((day, i) => day[z.key].bands.map((b) => ({ x: (i / n) * 100, y: (b.morning / 24) * 100, h: ((b.evening - b.morning) / 24) * 100 })))
  })));
  const hourTicks = [0, 6, 12, 18, 24].map((h) => ({ y: (h / 24) * 100, label: `${String(h).padStart(2, '0')}:00` }));

  // --- Solar noon on the clock, with mean solar noon for reference ---
  let noonData = $derived(computeSolarNoonYear(year, latitude, longitude, timezone));
  let meanNoon = $derived(noonData.map((d, i) => clockHoursInTimezone(new Date(Date.UTC(year, 0, i + 1, 12) - longitude * 240000), timezone)));
  let noonRange = $derived.by(() => {
    const values = [...noonData.map((d) => d.clockHours), ...meanNoon];
    return { min: Math.floor((Math.min(...values) - 0.05) * 4) / 4, max: Math.ceil((Math.max(...values) + 0.05) * 4) / 4 };
  });
  let noonY = $derived((h) => 100 - ((h - noonRange.min) / (noonRange.max - noonRange.min)) * 100);
  // Break the line at clock changes instead of drawing a vertical jump
  let noonLine = (values) => values.map((v, i) => `${i === 0 || Math.abs(v - values[i - 1]) > 0.25 ? 'M' : 'L'}${xOf(i).toFixed(3)},${noonY(v).toFixed(3)}`).join(' ');
  let noonPath = $derived(noonLine(noonData.map((d) => d.clockHours)));
  let meanNoonPath = $derived(noonLine(meanNoon));
  const formatClock = (hours) => {
    const total = Math.round(hours * 60);
    return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  };
  // Ticks on whole (or half) hours inside the range
  let noonTicks = $derived.by(() => {
    const step = noonRange.max - noonRange.min > 1.5 ? 1 : 0.5;
    const ticks = [];
    for (let h = Math.ceil(noonRange.min / step) * step; h <= noonRange.max + 1e-9; h += step) ticks.push({ y: noonY(h), label: formatClock(h) });
    return ticks;
  });

  // --- Values for the selected date, shown in each strip's header ---
  let sel = $derived(selectedIndex != null ? {
    daylight: formatDuration(yearData[selectedIndex].daylight),
    rate: `${formatDurationChangeMinutesSeconds(rates[selectedIndex] * 60000).replace('-', '−')} a day`,
    stats: getDayStatsForTooltip(selectedDate, latitude, longitude, timezone),
    noon: noonData[selectedIndex]
  } : null);
  // Short form on phones, with the equation of time added when there's room
  let noonNote = $derived(sel ? {
    short: formatTimeInTimezone(sel.noon.solarNoon, timezone),
    extra: ` · sun ${formatDurationChangeMinutesSeconds(Math.abs(sel.noon.equationOfTime) * 60000).slice(1)} ${sel.noon.equationOfTime >= 0 ? 'ahead of' : 'behind'} the clock average`
  } : '');

  // --- Interaction: every strip maps x to a day the same way ---
  let pointer = $state(null);
  function dateAt(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const i = Math.max(0, Math.min(n - 1, Math.floor(((e.clientX - rect.left) / rect.width) * n)));
    return new Date(year, 0, i + 1);
  }
  function handleMove(e) {
    pointer = { x: e.clientX, y: e.clientY };
    onHoverDate?.(dateAt(e));
  }
  function handleLeave() {
    pointer = null;
    onHoverDate?.(null);
  }
  function handleClick(e) {
    onDateSelect?.(dateAt(e));
    onHoverDate?.(null);
  }

  // Clear hover on scroll or touchmove so it doesn't stick on mobile
  $effect(() => {
    const clear = () => { if (pointer) handleLeave(); };
    window.addEventListener('scroll', clear, true);
    window.addEventListener('touchmove', clear, true);
    return () => {
      window.removeEventListener('scroll', clear, true);
      window.removeEventListener('touchmove', clear, true);
    };
  });

  let tooltipRows = $derived.by(() => {
    if (hoveredIndex == null) return [];
    const stats = getDayStatsForTooltip(hoveredDate, latitude, longitude, timezone);
    return [
      { label: 'Daylight', value: formatDuration(yearData[hoveredIndex].daylight) },
      { label: 'Change', value: `${formatDurationChangeMinutesSeconds(rates[hoveredIndex] * 60000).replace('-', '−')} /day` },
      { label: 'Sunrise', value: stats.sunrise },
      { label: 'Sunset', value: stats.sunset },
      { label: 'Solar noon', value: formatTimeInTimezone(noonData[hoveredIndex].solarNoon, timezone) }
    ];
  });
</script>

<!-- One strip: title + selected value, y labels in a gutter, plot with shared annotations -->
{#snippet strip(title, value, heightClass, ticks, plot)}
  <div>
    <div class="flex items-baseline justify-between gap-3 pl-14 text-xs">
      <span class="font-medium text-gray-700 dark:text-gray-300">{title}</span>
      <span class="truncate text-right font-semibold tabular-nums text-gray-900 dark:text-gray-100">
        {#if typeof value === 'object'}{value.short}<span class="hidden font-normal text-gray-500 sm:inline dark:text-gray-400">{value.extra}</span>{:else}{value}{/if}
      </span>
    </div>
    <div class="mt-1 grid grid-cols-[3.5rem_1fr]">
      <div class="relative {heightClass}" aria-hidden="true">
        {#each ticks as t}
          <span class="absolute right-2 -translate-y-1/2 text-[10px] tabular-nums text-gray-400 dark:text-gray-500" style="top: {t.y}%">{t.label}</span>
        {/each}
      </div>
      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
      <div class="relative cursor-crosshair {heightClass}" onmousemove={handleMove} onmouseleave={handleLeave} onclick={handleClick}>
        <svg class="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {#each ticks as t}
            <line x1="0" x2="100" y1={t.y} y2={t.y} stroke="currentColor" class="text-gray-300 dark:text-gray-600" stroke-opacity="0.6" stroke-dasharray="2 3" vector-effect="non-scaling-stroke" />
          {/each}
          {@render plot()}
          {#each monthStarts.slice(1) as m}
            <line x1={m.x} x2={m.x} y1="0" y2="100" stroke="currentColor" class="text-gray-400 dark:text-gray-500" stroke-opacity="0.25" vector-effect="non-scaling-stroke" />
          {/each}
          {#if mirrorIndex != null}
            <line x1={xOf(mirrorIndex)} x2={xOf(mirrorIndex)} y1="0" y2="100" stroke="var(--color-halo)" stroke-width="3" stroke-opacity="0.6" vector-effect="non-scaling-stroke" />
            <line x1={xOf(mirrorIndex)} x2={xOf(mirrorIndex)} y1="0" y2="100" stroke="var(--color-ink)" stroke-width="1.5" stroke-dasharray="4 3" vector-effect="non-scaling-stroke" />
          {/if}
          {#if hoveredIndex != null}
            <line x1={xOf(hoveredIndex)} x2={xOf(hoveredIndex)} y1="0" y2="100" stroke="var(--color-ink-muted)" stroke-width="1.5" vector-effect="non-scaling-stroke" />
          {/if}
          {#if selectedIndex != null}
            <line x1={xOf(selectedIndex)} x2={xOf(selectedIndex)} y1="0" y2="100" stroke="var(--color-halo)" stroke-width="4" vector-effect="non-scaling-stroke" />
            <line x1={xOf(selectedIndex)} x2={xOf(selectedIndex)} y1="0" y2="100" stroke="var(--color-ink)" stroke-width="2" vector-effect="non-scaling-stroke" />
          {/if}
        </svg>
      </div>
    </div>
  </div>
{/snippet}

{#snippet dayPlot()}
  <path d={dayArea} fill="var(--color-sun)" fill-opacity="0.18" />
  <path d={dayPath} fill="none" stroke="var(--color-sun)" stroke-width="2" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
{/snippet}

{#snippet ratePlot()}
  <path d={gainArea} fill="var(--color-gain)" fill-opacity="0.55" />
  <path d={lossArea} fill="var(--color-loss)" fill-opacity="0.55" />
  <line x1="0" x2="100" y1="50" y2="50" stroke="var(--color-ink-muted)" stroke-opacity="0.6" vector-effect="non-scaling-stroke" />
{/snippet}

{#snippet twilightPlot()}
  <rect x="0" y="0" width="100" height="100" fill="var(--color-night)" />
  {#each zoneRects as zone}
    {#each zone.rects as r}
      <rect x={r.x} y={r.y} width={100 / n + 0.05} height={r.h} fill={zone.color} shape-rendering="crispEdges" />
    {/each}
  {/each}
{/snippet}

{#snippet noonPlot()}
  <path d={meanNoonPath} fill="none" stroke="var(--color-ink-muted)" stroke-opacity="0.7" stroke-width="1.5" stroke-dasharray="4 4" vector-effect="non-scaling-stroke" />
  <path d={noonPath} fill="none" stroke="var(--color-sun)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" />
{/snippet}

<ChartCard id="daylight" title="Daylight through the year" subtitle="Hover to compare any day; click to select it." class="h-full">
  <div class="space-y-4" role="group" aria-label="Daylight through the year for {year}. Click a day to select it.">
    {@render strip('Day length', sel?.daylight ?? '', 'h-28', dayTicks, dayPlot)}
    {@render strip('Change per day', sel?.rate ?? '', 'h-16', rateTicks, ratePlot)}
    {@render strip('Sunrise and sunset', sel ? `${sel.stats.sunrise} – ${sel.stats.sunset}` : '', 'h-36', hourTicks, twilightPlot)}
    {@render strip('Solar noon', noonNote, 'h-20', noonTicks, noonPlot)}

    <!-- Shared month axis -->
    <div class="grid grid-cols-[3.5rem_1fr]" aria-hidden="true">
      <div></div>
      <div class="relative h-4 text-[11px] text-gray-500 dark:text-gray-400">
        {#each monthStarts as m, i}
          <span class="absolute -translate-x-1/2" style="left: {m.x + 100 / 24}%"><span class="sm:hidden">{m.label[0]}</span><span class="hidden sm:inline">{m.label}</span></span>
        {/each}
      </div>
    </div>
  </div>

  {#snippet legend()}
    {#each [['var(--color-day)', 'Daylight'], ['var(--color-civil)', 'Civil'], ['var(--color-nautical)', 'Nautical'], ['var(--color-astro)', 'Astronomical twilight'], ['var(--color-night)', 'Night']] as [color, label]}
      <span class="flex items-center gap-1.5"><span class="inline-block h-2.5 w-2.5 rounded-sm ring-1 ring-black/10 dark:ring-white/15" style="background: {color}"></span>{label}</span>
    {/each}
    <span class="flex items-center gap-1.5"><span class="inline-block h-3 w-0.5 bg-gray-900 dark:bg-white"></span>Selected date</span>
    <span class="flex items-center gap-1.5"><svg class="h-3 w-1 text-gray-900 dark:text-white" viewBox="0 0 2 12" aria-hidden="true"><line x1="1" x2="1" y1="0" y2="12" stroke="currentColor" stroke-width="2" stroke-dasharray="3 2" /></svg>Mirror date</span>
    <span class="flex items-center gap-1.5"><span class="inline-block w-4 border-t-2 border-dashed border-gray-400"></span>Mean solar noon</span>
  {/snippet}
</ChartCard>

{#if pointer && hoveredIndex != null}
  <ChartTooltip x={pointer.x} y={pointer.y} title={getDayStatsForTooltip(hoveredDate, latitude, longitude, timezone).dateLabel} rows={tooltipRows} />
{/if}
