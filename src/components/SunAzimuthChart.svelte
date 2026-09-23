<script>
  import { getDayOfYear, getSunPosition, formatDateShort } from '../lib/solar.js';
  import { dateAtLocalInTimezone } from '../lib/utils.js';
  import ChartCard from './ChartCard.svelte';
  import ChartTooltip from './ChartTooltip.svelte';

  /**
   * The analemma: where the sun is at one clock time on every day of the year.
   * Degrees of direction and height get the same scale so the figure keeps its true shape,
   * and the view is fitted to the figure rather than the whole sky.
   */
  let {
    yearData, selectedDate, oppositeDate = null, latitude = 0, longitude = 0, timezone = null,
    hour = 12, hoveredHour = null, hoveredDate = null, onHoverDate = null, onDateSelect = null
  } = $props();

  const width = 600;
  const height = 380;
  const pad = { top: 16, right: 16, bottom: 34, left: 44 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  let shownHour = $derived(hoveredHour ?? hour);
  const clock = (h) => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;

  const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const norm = (deg) => ((deg % 360) + 360) % 360;
  const compass = (bearing) => COMPASS[Math.round(norm(bearing) / 22.5) % 16];

  // Sun position at the shown clock time for each day; bearings are unwrapped so a figure
  // straddling north doesn't split across 0°/360°
  let points = $derived.by(() => {
    const h = Math.floor(shownHour);
    const m = Math.round((shownHour - h) * 60);
    let prev = null;
    return yearData.map((day, i) => {
      const d = day.date;
      const at = timezone
        ? dateAtLocalInTimezone(d.getFullYear(), d.getMonth() + 1, d.getDate(), h, m, timezone)
        : new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m);
      const pos = getSunPosition(at, latitude, longitude);
      let bearing = (pos.azimuth + 180) % 360;
      if (prev != null) bearing += Math.round((prev - bearing) / 360) * 360;
      prev = bearing;
      return { date: d, index: i, altitude: pos.altitude, bearing };
    });
  });

  // Fit: same degrees-per-pixel on both axes, with a margin and a minimum span
  let view = $derived.by(() => {
    const bs = points.map((p) => p.bearing);
    const as = points.map((p) => p.altitude);
    const bMid = (Math.min(...bs) + Math.max(...bs)) / 2;
    const aMid = (Math.min(...as) + Math.max(...as)) / 2;
    const bSpan = Math.max(8, (Math.max(...bs) - Math.min(...bs)) * 1.25);
    const aSpan = Math.max(8, (Math.max(...as) - Math.min(...as)) * 1.25);
    const scale = Math.min(plotW / bSpan, plotH / aSpan);
    return { bMid, aMid, scale };
  });
  let x = $derived((bearing) => pad.left + plotW / 2 + (bearing - view.bMid) * view.scale);
  let y = $derived((altitude) => pad.top + plotH / 2 - (altitude - view.aMid) * view.scale);

  // A grid line every ~60px, on a round number of degrees
  let step = $derived([1, 2, 5, 10, 15, 30, 45].find((s) => s >= 60 / view.scale) ?? 90);
  function ticksBetween(lo, hi) {
    const ticks = [];
    for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(v);
    return ticks;
  }
  let bearingTicks = $derived(ticksBetween(view.bMid - plotW / 2 / view.scale, view.bMid + plotW / 2 / view.scale));
  let altitudeTicks = $derived(ticksBetween(view.aMid - plotH / 2 / view.scale, view.aMid + plotH / 2 / view.scale));
  let horizonVisible = $derived(y(0) > pad.top && y(0) < pad.top + plotH);

  // The clock jumps an hour at DST changes, which jumps the sun too: break the line there
  let loop = $derived.by(() => {
    const px = points.map((p) => [x(p.bearing), y(p.altitude)]);
    const gaps = px.slice(1).map(([a, b], i) => Math.hypot(a - px[i][0], b - px[i][1]));
    const typical = [...gaps].sort((a, b) => a - b)[Math.floor(gaps.length / 2)] || 1;
    const jump = (i) => gaps[i - 1] > Math.max(6, typical * 6);
    let d = px.map(([a, b], i) => `${i === 0 || jump(i) ? 'M' : 'L'}${a.toFixed(1)},${b.toFixed(1)}`).join(' ');
    // Close the loop from Dec 31 back to Jan 1 unless that is a jump too
    const last = px.at(-1);
    if (Math.hypot(last[0] - px[0][0], last[1] - px[0][1]) <= Math.max(6, typical * 6)) d += ` L${px[0][0].toFixed(1)},${px[0][1].toFixed(1)}`;
    return d;
  });
  let monthMarks = $derived(points.filter((p) => p.date.getDate() === 1));

  const pointFor = (date) => (date && date.getFullYear() === points[0]?.date.getFullYear() ? points[getDayOfYear(date) - 1] : null);
  let selectedPoint = $derived(pointFor(selectedDate));
  let mirrorPoint = $derived(pointFor(oppositeDate?.date));
  let hoveredPoint = $derived(pointFor(hoveredDate));

  // Hover: nearest day within reach
  let pointer = $state(null);
  function nearest(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / rect.width) * width;
    const sy = ((e.clientY - rect.top) / rect.height) * height;
    let best = null;
    let bestD = 30 ** 2;
    for (const p of points) {
      const d = (x(p.bearing) - sx) ** 2 + (y(p.altitude) - sy) ** 2;
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  }
  function handleMove(e) {
    const p = nearest(e);
    pointer = p ? { x: e.clientX, y: e.clientY } : null;
    onHoverDate?.(p?.date ?? null);
  }
  function handleLeave() {
    pointer = null;
    onHoverDate?.(null);
  }
  function handleClick(e) {
    const p = nearest(e);
    if (p) { onDateSelect?.(p.date); onHoverDate?.(null); }
  }
</script>

<ChartCard id="sun-position" title="Sun at {clock(shownHour)} through the year" subtitle="Where the sun is at the same clock time on every day. The figure-eight is the analemma; clock changes split it in two." class="h-full">
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
  <svg
    viewBox="0 0 {width} {height}"
    class="w-full cursor-crosshair select-none"
    role="img"
    aria-label="Sun direction and height at {clock(shownHour)} for each day of the year. Click a day to select it."
    onmousemove={handleMove}
    onmouseleave={handleLeave}
    onclick={handleClick}
  >
    <!-- Grid -->
    {#each bearingTicks as b}
      <line x1={x(b)} x2={x(b)} y1={pad.top} y2={pad.top + plotH} stroke="currentColor" class="text-gray-300 dark:text-gray-600" stroke-opacity="0.6" stroke-dasharray="2 3" />
      <text x={x(b)} y={height - 14} text-anchor="middle" class="fill-gray-500 text-[11px] dark:fill-gray-400">{Math.round(norm(b))}° {compass(b)}</text>
    {/each}
    {#each altitudeTicks as a}
      <line x1={pad.left} x2={pad.left + plotW} y1={y(a)} y2={y(a)} stroke="currentColor" class="text-gray-300 dark:text-gray-600" stroke-opacity="0.6" stroke-dasharray="2 3" />
      <text x={pad.left - 8} y={y(a) + 4} text-anchor="end" class="fill-gray-500 text-[11px] dark:fill-gray-400">{a}°</text>
    {/each}
    {#if horizonVisible}
      <line x1={pad.left} x2={pad.left + plotW} y1={y(0)} y2={y(0)} stroke="var(--color-ink-muted)" stroke-width="1.5" />
      <text x={pad.left + plotW - 4} y={y(0) - 5} text-anchor="end" class="fill-gray-500 text-[10px] dark:fill-gray-400">Horizon</text>
    {/if}

    <!-- The figure, with the first of each month marked -->
    <path d={loop} fill="none" stroke="var(--color-sun)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />
    {#each monthMarks as p}
      <circle cx={x(p.bearing)} cy={y(p.altitude)} r="3" fill="var(--color-halo)" stroke="var(--color-sun)" stroke-width="1.5" />
      <text x={x(p.bearing) + 7} y={y(p.altitude) + 3} class="fill-gray-500 text-[10px] dark:fill-gray-400">{formatDateShort(p.date).split(' ')[0]}</text>
    {/each}

    <!-- Mirror, hovered and selected days -->
    {#if mirrorPoint && mirrorPoint !== selectedPoint}
      <circle cx={x(mirrorPoint.bearing)} cy={y(mirrorPoint.altitude)} r="7" fill="none" stroke="var(--color-ink)" stroke-width="2" stroke-dasharray="3 2.5" />
    {/if}
    {#if hoveredPoint}
      <circle cx={x(hoveredPoint.bearing)} cy={y(hoveredPoint.altitude)} r="5" fill="var(--color-ink-muted)" stroke="var(--color-halo)" stroke-width="2" />
    {/if}
    {#if selectedPoint}
      <circle cx={x(selectedPoint.bearing)} cy={y(selectedPoint.altitude)} r="7" fill="var(--color-ink)" stroke="var(--color-halo)" stroke-width="3" />
    {/if}
  </svg>

  {#snippet legend()}
    <span class="flex items-center gap-1.5"><span class="inline-block h-3 w-3 rounded-full bg-gray-900 ring-2 ring-white dark:bg-white dark:ring-gray-800"></span>Selected date</span>
    <span class="flex items-center gap-1.5"><span class="inline-block h-3 w-3 rounded-full border-2 border-dashed border-gray-900 dark:border-white"></span>Mirror date</span>
    <span class="flex items-center gap-1.5"><span class="inline-block h-2.5 w-2.5 rounded-full border-[1.5px] bg-white dark:bg-gray-800" style="border-color: var(--color-sun)"></span>First of the month</span>
  {/snippet}

  {#if pointer && hoveredPoint}
    <ChartTooltip x={pointer.x} y={pointer.y} title={formatDateShort(hoveredPoint.date)} rows={[
      { label: 'Height', value: `${hoveredPoint.altitude.toFixed(1)}°` },
      { label: 'Direction', value: `${compass(hoveredPoint.bearing)} ${Math.round(norm(hoveredPoint.bearing))}°` }
    ]} />
  {/if}
</ChartCard>
