<script>
  import ChartTooltip from './ChartTooltip.svelte';
  import MoonDisc from './MoonDisc.svelte';
  import { getMoonPhase } from '../lib/moon.js';
  import {
    getSunData, getSunPathForDay, getSolsticeProgress, getGoldenBlueHours, formatDuration, timeOnDay
  } from '../lib/solar.js';
  import {
    addDays, isSameDay, getToday, formatTimeInTimezone, formatDurationChangeMinutesSeconds, formatDurationChange,
    clockHoursInTimezone, getHourInTimezone, findPresetLocation, formatLatitude, formatLongitude
  } from '../lib/utils.js';

  /**
   * "Your day": the selected date at a glance. Headline numbers, the sun's height over
   * the 24 hours with the sky state underneath, key times, and the moon.
   */
  let {
    selectedDate, latitude, longitude, timezone,
    displayHour = 12,
    onHoverHour = null,
    onSelectHour = null
  } = $props();

  let sun = $derived(getSunData(selectedDate, latitude, longitude, timezone));
  let yesterday = $derived(getSunData(addDays(selectedDate, -1), latitude, longitude, timezone));
  let change = $derived(sun.daylight - yesterday.daylight);
  let solstice = $derived(getSolsticeProgress(selectedDate, latitude, timezone));
  let daysToSolstice = $derived(Math.round((solstice.next.date - new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate())) / 86400000));
  let solsticeChange = $derived(solstice.next.daylight - solstice.daylight);
  let golden = $derived(getGoldenBlueHours(selectedDate, latitude, longitude, timezone).golden);
  let moonPhase = $derived(getMoonPhase(timeOnDay(selectedDate, displayHour ?? 12, timezone)));

  let preset = $derived(findPresetLocation(latitude, longitude));
  let place = $derived(preset ? preset.name.split(',')[0] : `${formatLatitude(latitude)} ${formatLongitude(longitude)}`);
  const dateFormat = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

  // Sky state for a sun altitude, using the same boundaries as the twilight charts
  const SKY = [
    { min: -0.833, key: 'day', label: 'Daylight' },
    { min: -6, key: 'civil', label: 'Civil twilight' },
    { min: -12, key: 'nautical', label: 'Nautical twilight' },
    { min: -18, key: 'astro', label: 'Astronomical twilight' },
    { min: -Infinity, key: 'night', label: 'Night' }
  ];
  const skyFor = (altitude) => SKY.find((s) => altitude >= s.min);

  // 5-minute samples from local midnight; x is clock time so the axis reads 00–24
  let samples = $derived(
    getSunPathForDay(selectedDate, latitude, longitude, timezone).map((p, i) => ({ ...p, hour: (i * 5) / 60 }))
  );

  // Runs of the same sky state, for the bar under the curve
  let skyRuns = $derived.by(() => {
    const runs = [];
    for (const s of samples) {
      const key = skyFor(s.altitude).key;
      const last = runs.at(-1);
      if (last && last.key === key) last.end = s.hour + 5 / 60;
      else runs.push({ key, start: s.hour, end: s.hour + 5 / 60 });
    }
    return runs;
  });

  // Curve geometry in a 0–100 box stretched to fit (non-scaling strokes keep lines crisp)
  let yDomain = $derived.by(() => {
    const alts = samples.map((s) => s.altitude);
    const hi = Math.max(10, ...alts) + 4;
    const lo = Math.min(-10, ...alts) - 4;
    return [lo, hi];
  });
  const xPct = (hour) => (hour / 24) * 100;
  let yPct = $derived((alt) => 100 - ((alt - yDomain[0]) / (yDomain[1] - yDomain[0])) * 100);
  let curve = $derived(samples.map((s, i) => `${i ? 'L' : 'M'}${xPct(s.hour).toFixed(2)},${yPct(s.altitude).toFixed(2)}`).join(' '));
  let horizonY = $derived(yPct(0));

  let noonHour = $derived(clockHoursInTimezone(sun.solarNoon, timezone));
  let marks = $derived([
    sun.sunrise && { hour: clockHoursInTimezone(sun.sunrise, timezone), label: formatTimeInTimezone(sun.sunrise, timezone), kind: 'rise' },
    sun.sunset && { hour: clockHoursInTimezone(sun.sunset, timezone), label: formatTimeInTimezone(sun.sunset, timezone), kind: 'set' }
  ].filter(Boolean));

  let isToday = $derived(isSameDay(selectedDate, getToday()));
  let nowHour = $state(0);
  $effect(() => {
    const id = setInterval(() => { nowHour = clockHoursInTimezone(new Date(), timezone); }, 60000);
    nowHour = clockHoursInTimezone(new Date(), timezone);
    return () => clearInterval(id);
  });

  // Hover: nearest sample under the pointer
  let hovered = $state(null);
  let pointer = $state({ x: 0, y: 0 });
  function sampleAt(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const hour = Math.max(0, Math.min(24, ((e.clientX - rect.left) / rect.width) * 24));
    return samples[Math.min(samples.length - 1, Math.round(hour * 12))];
  }
  function handleMove(e) {
    hovered = sampleAt(e);
    pointer = { x: e.clientX, y: e.clientY };
    onHoverHour?.(getHourInTimezone(hovered.time, timezone));
  }
  function handleLeave() {
    hovered = null;
    onHoverHour?.(null);
  }
  function handleClick(e) {
    onSelectHour?.(getHourInTimezone(sampleAt(e).time, timezone));
  }
  // The hour chosen elsewhere (sun position slider), shown as a faint marker
  let selectedHourX = $derived(displayHour != null ? xPct(displayHour) : null);

  const period = (range) => range[0] && range[1]
    ? `${formatTimeInTimezone(range[0], timezone)}–${formatTimeInTimezone(range[1], timezone)}`
    : null;
  let goldenText = $derived([period(golden.morning), period(golden.evening)].filter(Boolean).join(' and ') || 'None');

  let daylightLabel = $derived(sun.isPolarDay ? 'Midnight sun' : sun.isPolarNight ? 'Polar night' : 'of daylight');
</script>

<section id="today" class="scroll-mt-32 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-200/70 dark:bg-gray-800 dark:ring-gray-700/60">
  <div class="flex flex-wrap items-start justify-between gap-x-6 gap-y-4 p-5 sm:p-6">
    <div class="min-w-0">
      <p class="text-sm font-medium text-gray-500 dark:text-gray-400">
        {dateFormat.format(selectedDate)} · {place}
      </p>
      <div class="mt-3 flex flex-wrap items-end gap-x-10 gap-y-4">
        <div>
          <p class="text-4xl font-semibold tracking-tight tabular-nums text-gray-900 sm:text-5xl dark:text-white">{formatDuration(sun.daylight)}</p>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{daylightLabel}</p>
        </div>
        <div>
          <p class="text-2xl font-semibold tabular-nums text-gray-900 dark:text-white">
            {change === 0 ? 'Same' : formatDurationChangeMinutesSeconds(change).replace('-', '−')}
          </p>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">vs yesterday</p>
        </div>
        <div>
          <p class="text-2xl font-semibold tabular-nums text-gray-900 dark:text-white">{daysToSolstice} {daysToSolstice === 1 ? 'day' : 'days'}</p>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
            to the {solstice.next.name.toLowerCase()}{#if solsticeChange !== 0}, {formatDurationChange(solsticeChange).replace('-', '−')} to go{/if}
          </p>
        </div>
      </div>
    </div>
    <div class="flex items-center gap-3">
      <MoonDisc instant={timeOnDay(selectedDate, displayHour ?? 12, timezone)} {latitude} {longitude} class="h-12 w-12" />
      <div class="text-sm">
        <p class="font-medium text-gray-900 dark:text-gray-100">{moonPhase.name}</p>
        <p class="text-gray-500 dark:text-gray-400">{Math.round(moonPhase.fraction * 100)}% lit</p>
      </div>
    </div>
  </div>

  <!-- The day: sun height over 24 hours, sky state underneath -->
  <div class="px-5 pb-5 sm:px-6">
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions a11y_no_noninteractive_element_interactions -->
    <div
      class="relative cursor-crosshair select-none"
      onmousemove={handleMove}
      onmouseleave={handleLeave}
      onclick={handleClick}
      role="img"
      aria-label="Sun height over the day: sunrise {marks[0]?.label ?? 'none'}, sunset {marks[1]?.label ?? 'none'}"
    >
      <div class="relative h-28 sm:h-32">
        <svg class="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <clipPath id="hero-above-horizon"><rect x="0" y="0" width="100" height={horizonY} /></clipPath>
          </defs>
          <!-- Daylight area under the curve, above the horizon -->
          <path d="{curve} L100,{horizonY} L0,{horizonY} Z" fill="var(--color-sun)" fill-opacity="0.18" clip-path="url(#hero-above-horizon)" />
          <line x1="0" x2="100" y1={horizonY} y2={horizonY} stroke="var(--color-ink-muted)" stroke-opacity="0.5" stroke-dasharray="3 3" vector-effect="non-scaling-stroke" />
          <path d={curve} fill="none" stroke="var(--color-sun)" stroke-width="2.5" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
          {#if selectedHourX != null}
            <line x1={selectedHourX} x2={selectedHourX} y1="0" y2="100" stroke="var(--color-ink-muted)" stroke-opacity="0.5" vector-effect="non-scaling-stroke" />
          {/if}
          {#if isToday}
            <line x1={xPct(nowHour)} x2={xPct(nowHour)} y1="0" y2="100" stroke="var(--color-halo)" stroke-width="4" vector-effect="non-scaling-stroke" />
            <line x1={xPct(nowHour)} x2={xPct(nowHour)} y1="0" y2="100" stroke="var(--color-ink)" stroke-width="1.5" vector-effect="non-scaling-stroke" />
          {/if}
          {#if hovered}
            <line x1={xPct(hovered.hour)} x2={xPct(hovered.hour)} y1="0" y2="100" stroke="var(--color-ink-muted)" stroke-dasharray="2 2" vector-effect="non-scaling-stroke" />
          {/if}
        </svg>
        <!-- Point markers in HTML so they stay round at any width -->
        {#if !sun.isPolarNight}
          <span
            class="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white dark:ring-gray-800"
            style="left: {xPct(noonHour)}%; top: {yPct(sun.maxAltitude)}%; background: var(--color-sun)"
          ></span>
          <span class="absolute -translate-x-1/2 whitespace-nowrap text-[11px] font-medium tabular-nums text-gray-600 dark:text-gray-300" style="left: {xPct(noonHour)}%; top: calc({yPct(sun.maxAltitude)}% - 22px)">
            {formatTimeInTimezone(sun.solarNoon, timezone)} · {sun.maxAltitude.toFixed(1)}°
          </span>
        {/if}
        {#if hovered}
          <span
            class="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white dark:ring-gray-800"
            style="left: {xPct(hovered.hour)}%; top: {yPct(hovered.altitude)}%; background: var(--color-ink)"
          ></span>
        {/if}
        {#if isToday}
          <span class="absolute bottom-1 -translate-x-1/2 rounded bg-gray-900 px-1 text-[10px] font-semibold uppercase tracking-wide text-white dark:bg-white dark:text-gray-900" style="left: {xPct(nowHour)}%">Now</span>
        {/if}
      </div>
      <!-- Sky state bar -->
      <div class="relative mt-1.5 h-3 overflow-hidden rounded-full">
        {#each skyRuns as run}
          <div class="absolute inset-y-0" style="left: {xPct(run.start)}%; width: {xPct(run.end - run.start)}%; background: var(--color-{run.key})"></div>
        {/each}
        {#each marks as mark}
          <div class="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white/80" style="left: {xPct(mark.hour)}%"></div>
        {/each}
      </div>
      <!-- Hour axis -->
      <div class="relative mt-1 h-4 text-[11px] tabular-nums text-gray-400 dark:text-gray-500">
        {#each [0, 3, 6, 9, 12, 15, 18, 21, 24] as h}
          <span class="absolute {h === 0 ? '' : h === 24 ? '-translate-x-full' : '-translate-x-1/2'} {h % 6 ? 'hidden sm:inline' : ''}" style="left: {xPct(h)}%">{String(h).padStart(2, '0')}</span>
        {/each}
      </div>
    </div>

    <!-- Key times -->
    <dl class="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
      <div>
        <dt class="text-gray-500 dark:text-gray-400">Sunrise</dt>
        <dd class="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{sun.sunrise ? formatTimeInTimezone(sun.sunrise, timezone) : sun.isPolarDay ? 'Sun stays up' : 'Sun stays down'}</dd>
      </div>
      <div>
        <dt class="text-gray-500 dark:text-gray-400">Sunset</dt>
        <dd class="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{sun.sunset ? formatTimeInTimezone(sun.sunset, timezone) : sun.isPolarDay ? 'Sun stays up' : 'Sun stays down'}</dd>
      </div>
      <div>
        <dt class="text-gray-500 dark:text-gray-400">Highest</dt>
        <dd class="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{sun.maxAltitude.toFixed(1)}° at {formatTimeInTimezone(sun.solarNoon, timezone)}</dd>
      </div>
      <div>
        <dt class="text-gray-500 dark:text-gray-400">Golden hour</dt>
        <dd class="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{goldenText}</dd>
      </div>
    </dl>

    <!-- Sky state key -->
    <div class="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
      {#each SKY as s}
        <span class="flex items-center gap-1.5">
          <span class="inline-block h-2.5 w-2.5 rounded-sm ring-1 ring-black/10 dark:ring-white/15" style="background: var(--color-{s.key})"></span>
          {s.label}
        </span>
      {/each}
    </div>
  </div>

  {#if hovered}
    <ChartTooltip x={pointer.x} y={pointer.y} title={formatTimeInTimezone(hovered.time, timezone)} rows={[
      { label: 'Sun height', value: `${hovered.altitude.toFixed(1)}°` },
      { label: 'Sky', value: skyFor(hovered.altitude).label, swatch: `var(--color-${skyFor(hovered.altitude).key})` }
    ]} />
  {/if}
</section>
