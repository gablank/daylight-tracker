<script>
  import { getSunPathForDay, getSunData, getSunPosition, getGoldenBlueHours, getSummerSolstice, getWinterSolstice } from '../lib/solar.js';
  import { formatTimeInTimezone, getHourInTimezone, calendarDateInTimezone } from '../lib/utils.js';
  import ChartCard from './ChartCard.svelte';
  import ChartTooltip from './ChartTooltip.svelte';

  /**
   * The sky seen from above: horizon at the rim, zenith in the middle, north up.
   * Shows the selected day's track against the two solstice tracks, and the sun
   * (with the shadow it casts) at the selected hour.
   */
  let { selectedDate, latitude, longitude, timezone, hour = 12, hoveredHour = null, onHoverHour = null, onSelectHour = null } = $props();

  const size = 360;
  const center = size / 2;
  const R = 140; // horizon radius

  // SunCalc azimuth is measured from south, clockwise towards west; compass bearing from north
  const bearingOf = (azimuth) => (azimuth + 180) % 360;
  const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const compass = (bearing) => COMPASS[Math.round((bearing % 360) / 22.5) % 16];
  const direction = (azimuth) => `${compass(bearingOf(azimuth))} ${Math.round(bearingOf(azimuth))}°`;

  // Zenith in the centre, horizon on the rim; north up, east right
  function xy(altitude, azimuth) {
    const r = (Math.max(0, 90 - altitude) / 90) * R;
    const a = (bearingOf(azimuth) * Math.PI) / 180;
    return { x: center + r * Math.sin(a), y: center - r * Math.cos(a) };
  }

  // Path segments above the horizon (a day can have several at high latitudes)
  function trackPath(points) {
    let d = '';
    let pen = false;
    for (const p of points) {
      if (p.altitude < -0.5) { pen = false; continue; }
      const { x, y } = xy(p.altitude, p.azimuth);
      d += `${pen ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)} `;
      pen = true;
    }
    return d;
  }

  let points = $derived(getSunPathForDay(selectedDate, latitude, longitude, timezone));
  let today = $derived(trackPath(points));
  let year = $derived(selectedDate.getFullYear());
  let references = $derived([
    { label: 'Jun', date: calendarDateInTimezone(getSummerSolstice(year), timezone) },
    { label: 'Dec', date: calendarDateInTimezone(getWinterSolstice(year), timezone) }
  ].map((r) => {
    const pts = getSunPathForDay(r.date, latitude, longitude, timezone);
    const top = pts.reduce((a, b) => (b.altitude > a.altitude ? b : a));
    return { ...r, d: trackPath(pts), top: top.altitude > 0 ? xy(top.altitude, top.azimuth) : null };
  }));

  let sun = $derived(getSunData(selectedDate, latitude, longitude, timezone));
  let noon = $derived(getSunPosition(sun.solarNoon, latitude, longitude));
  let rise = $derived(sun.sunrise ? getSunPosition(sun.sunrise, latitude, longitude) : null);
  let set = $derived(sun.sunset ? getSunPosition(sun.sunset, latitude, longitude) : null);
  let everUp = $derived(points.some((p) => p.altitude >= -0.5));

  // Sun at the shown hour (hovered anywhere on the page, else the selected hour)
  let shownHour = $derived(hoveredHour ?? hour);
  let atHour = $derived.by(() => {
    let best = points[0];
    for (const p of points) {
      if (Math.abs(getHourInTimezone(p.time, timezone) - shownHour) < Math.abs(getHourInTimezone(best.time, timezone) - shownHour)) best = p;
    }
    return best;
  });
  let sunAtHour = $derived(atHour.altitude > 0 ? xy(atHour.altitude, atHour.azimuth) : null);
  const shadowRatio = (altitude) => 1 / Math.tan((altitude * Math.PI) / 180);
  // Shadow of a vertical pole at the centre, pointing away from the sun; drawn up to 3× its height
  let shadowEnd = $derived.by(() => {
    if (atHour.altitude <= 0) return null;
    const len = (Math.min(3, shadowRatio(atHour.altitude)) / 3) * R * 0.6;
    const a = ((bearingOf(atHour.azimuth) + 180) * Math.PI) / 180;
    return { x: center + len * Math.sin(a), y: center - len * Math.cos(a) };
  });
  function describeShadow(altitude, azimuth) {
    if (altitude <= 0) return 'None (sun below the horizon)';
    const ratio = shadowRatio(altitude);
    const length = ratio >= 100 ? '100+' : ratio >= 10 ? ratio.toFixed(0) : ratio.toFixed(1);
    return `${length}× height, towards ${compass((bearingOf(azimuth) + 180) % 360)}`;
  }

  const clock = (h) => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;

  let goldenBlue = $derived(getGoldenBlueHours(selectedDate, latitude, longitude, timezone));
  function formatPeriods(periods) {
    const t = (d) => formatTimeInTimezone(d, timezone);
    const text = periods.map(([a, b]) => (a && b ? `${t(a)}–${t(b)}` : a ? `from ${t(a)}` : b ? `until ${t(b)}` : null)).filter(Boolean);
    return text.length ? text.join(', ') : 'None';
  }

  // Label for a point on the horizon, pushed outside the rim
  function rimLabel(azimuth, offset = 16) {
    const a = (bearingOf(azimuth) * Math.PI) / 180;
    return { x: center + (R + offset) * Math.sin(a), y: center - (R + offset) * Math.cos(a) + 4 };
  }

  // Hover: nearest point of the day's track
  let hovered = $state(null);
  let pointer = $state({ x: 0, y: 0 });
  function nearest(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / rect.width) * size;
    const sy = ((e.clientY - rect.top) / rect.height) * size;
    let best = null;
    let bestD = 400;
    for (const p of points) {
      if (p.altitude < -0.5) continue;
      const { x, y } = xy(p.altitude, p.azimuth);
      const d = (x - sx) ** 2 + (y - sy) ** 2;
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  }
  function handleMove(e) {
    hovered = nearest(e);
    pointer = { x: e.clientX, y: e.clientY };
    onHoverHour?.(hovered ? getHourInTimezone(hovered.time, timezone) : null);
  }
  function handleLeave() {
    hovered = null;
    onHoverHour?.(null);
  }
  function handleClick(e) {
    const p = nearest(e);
    if (p) onSelectHour?.(getHourInTimezone(p.time, timezone));
  }
</script>

<ChartCard id="sun-path" title="Sun path" subtitle="The sky from above: horizon at the rim, straight up in the middle, north at the top." class="h-full">
  <div class="flex flex-wrap items-start gap-x-6 gap-y-4">
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
    <svg
      viewBox="0 0 {size} {size}"
      class="mx-auto w-full max-w-[22rem] shrink-0 cursor-crosshair select-none"
      role="img"
      aria-label="Sun path on the selected date: rises {rise ? direction(rise.azimuth) : 'not at all'}, highest {noon.altitude.toFixed(0)}°, sets {set ? direction(set.azimuth) : 'not at all'}"
      onmousemove={handleMove}
      onmouseleave={handleLeave}
      onclick={handleClick}
    >
      <!-- Sky disc, altitude rings and compass -->
      <circle cx={center} cy={center} r={R} class="fill-gray-50 dark:fill-gray-900/40" stroke="currentColor" stroke-opacity="0.35" />
      {#each [30, 60] as alt}
        <circle cx={center} cy={center} r={((90 - alt) / 90) * R} fill="none" stroke="currentColor" stroke-opacity="0.12" />
        <text x={center + 3} y={center - ((90 - alt) / 90) * R - 3} class="fill-gray-400 text-[9px] dark:fill-gray-500">{alt}°</text>
      {/each}
      <line x1={center} x2={center} y1={center - R} y2={center + R} stroke="currentColor" stroke-opacity="0.12" />
      <line x1={center - R} x2={center + R} y1={center} y2={center} stroke="currentColor" stroke-opacity="0.12" />
      {#each ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as label, i}
        {@const a = (i * 45 * Math.PI) / 180}
        <text
          x={center + (R + 14) * Math.sin(a)}
          y={center - (R + 14) * Math.cos(a) + 4}
          text-anchor="middle"
          class="{label.length === 1 ? 'fill-gray-600 font-semibold text-[12px] dark:fill-gray-300' : 'fill-gray-400 text-[10px] dark:fill-gray-500'}"
        >{label}</text>
      {/each}

      <!-- Solstice tracks for reference -->
      {#each references as ref}
        <path d={ref.d} fill="none" stroke="var(--color-ink-muted)" stroke-opacity="0.7" stroke-width="1.25" stroke-dasharray="4 3" />
        {#if ref.top}
          <text x={ref.top.x} y={ref.top.y + 13} text-anchor="middle" class="fill-gray-500 text-[9px] dark:fill-gray-400">{ref.label} {ref.date.getDate()}</text>
        {/if}
      {/each}

      <!-- The selected day -->
      <path d={today} fill="none" stroke="var(--color-sun)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
      {#if rise}
        {@const p = xy(0, rise.azimuth)}
        {@const l = rimLabel(rise.azimuth, -24)}
        <circle cx={p.x} cy={p.y} r="4" fill="var(--color-sun)" stroke="var(--color-halo)" stroke-width="2" />
        <text x={l.x} y={l.y - 8} text-anchor="middle" class="fill-gray-700 text-[10px] font-medium dark:fill-gray-200">↑ {formatTimeInTimezone(sun.sunrise, timezone)}</text>
      {/if}
      {#if set}
        {@const p = xy(0, set.azimuth)}
        {@const l = rimLabel(set.azimuth, -24)}
        <circle cx={p.x} cy={p.y} r="4" fill="var(--color-sun)" stroke="var(--color-halo)" stroke-width="2" />
        <text x={l.x} y={l.y - 8} text-anchor="middle" class="fill-gray-700 text-[10px] font-medium dark:fill-gray-200">↓ {formatTimeInTimezone(sun.sunset, timezone)}</text>
      {/if}
      {#if noon.altitude > 0}
        {@const p = xy(noon.altitude, noon.azimuth)}
        <circle cx={p.x} cy={p.y} r="3.5" fill="var(--color-sun)" stroke="var(--color-halo)" stroke-width="2" />
        <text x={p.x} y={p.y - 9} text-anchor="middle" class="fill-gray-700 text-[10px] font-medium dark:fill-gray-200">{noon.altitude.toFixed(0)}° at {formatTimeInTimezone(sun.solarNoon, timezone)}</text>
      {/if}

      <!-- Observer, their shadow, and the sun at the shown hour -->
      {#if shadowEnd}
        <line x1={center} y1={center} x2={shadowEnd.x} y2={shadowEnd.y} stroke="var(--color-ink)" stroke-opacity="0.45" stroke-width="3" stroke-linecap="round" />
      {/if}
      <circle cx={center} cy={center} r="3" fill="var(--color-ink)" />
      {#if sunAtHour}
        <circle cx={sunAtHour.x} cy={sunAtHour.y} r="7" fill="var(--color-ink)" stroke="var(--color-halo)" stroke-width="3" />
      {/if}
      {#if !everUp}
        <text x={center} y={center + 22} text-anchor="middle" class="fill-gray-500 text-[12px] dark:fill-gray-400">The sun stays below the horizon</text>
      {/if}
    </svg>

    <dl class="grid min-w-[13rem] flex-1 grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
      <dt class="text-gray-500 dark:text-gray-400">Rises</dt>
      <dd class="font-medium tabular-nums text-gray-900 dark:text-gray-100">{rise ? `${formatTimeInTimezone(sun.sunrise, timezone)} · ${direction(rise.azimuth)}` : sun.isPolarDay ? 'Stays up' : 'Stays down'}</dd>
      <dt class="text-gray-500 dark:text-gray-400">Highest</dt>
      <dd class="font-medium tabular-nums text-gray-900 dark:text-gray-100">{noon.altitude.toFixed(1)}° at {formatTimeInTimezone(sun.solarNoon, timezone)} · {compass(bearingOf(noon.azimuth))}</dd>
      <dt class="text-gray-500 dark:text-gray-400">Sets</dt>
      <dd class="font-medium tabular-nums text-gray-900 dark:text-gray-100">{set ? `${formatTimeInTimezone(sun.sunset, timezone)} · ${direction(set.azimuth)}` : sun.isPolarDay ? 'Stays up' : 'Stays down'}</dd>
      <dt class="text-gray-500 dark:text-gray-400">Golden hour</dt>
      <dd class="font-medium tabular-nums text-gray-900 dark:text-gray-100">{formatPeriods([goldenBlue.golden.morning, goldenBlue.golden.evening])}</dd>
      <dt class="text-gray-500 dark:text-gray-400">Blue hour</dt>
      <dd class="font-medium tabular-nums text-gray-900 dark:text-gray-100">{formatPeriods([goldenBlue.blue.morning, goldenBlue.blue.evening])}</dd>
      <dt class="border-t border-gray-200 pt-2 text-gray-500 dark:border-gray-700 dark:text-gray-400">At {clock(shownHour)}</dt>
      <dd class="border-t border-gray-200 pt-2 font-medium tabular-nums text-gray-900 dark:border-gray-700 dark:text-gray-100">
        {atHour.altitude.toFixed(1)}° high, {direction(atHour.azimuth)}
      </dd>
      <dt class="text-gray-500 dark:text-gray-400">Shadow</dt>
      <dd class="font-medium tabular-nums text-gray-900 dark:text-gray-100">{describeShadow(atHour.altitude, atHour.azimuth)}</dd>
    </dl>
  </div>

  {#snippet legend()}
    <span class="flex items-center gap-1.5"><span class="inline-block w-4 border-t-[3px]" style="border-color: var(--color-sun)"></span>Selected date</span>
    <span class="flex items-center gap-1.5"><span class="inline-block w-4 border-t-2 border-dashed border-gray-400"></span>Solstices</span>
    <span class="flex items-center gap-1.5"><span class="inline-block h-3 w-3 rounded-full bg-gray-900 ring-2 ring-white dark:bg-white dark:ring-gray-800"></span>Sun at {clock(shownHour)}</span>
    <span class="flex items-center gap-1.5"><span class="inline-block h-1 w-4 rounded-full bg-gray-900/45 dark:bg-white/45"></span>Shadow</span>
  {/snippet}

  {#if hovered}
    <ChartTooltip x={pointer.x} y={pointer.y} title={formatTimeInTimezone(hovered.time, timezone)} rows={[
      { label: 'Height', value: `${hovered.altitude.toFixed(1)}°` },
      { label: 'Direction', value: direction(hovered.azimuth) },
      { label: 'Shadow', value: describeShadow(hovered.altitude, hovered.azimuth) }
    ]} />
  {/if}
</ChartCard>
