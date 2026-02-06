<script>
  import SunCalc from 'suncalc';
  import { getDayOfYear, getDaysInYear, getDayStatsForTooltip } from '../lib/solar.js';
  import { dateAtLocalInTimezone } from '../lib/utils.js';

  let { yearData, selectedDate, oppositeDate = null, latitude = 0, longitude = 0, timezone = null, hoveredDate = null, onHoverDate = null, onDateSelect = null, derivativeCount = 1 } = $props();

  let tooltipX = $state(0);
  let tooltipY = $state(0);
  let isHovering = $state(false);

  const width = 600;
  const height = 300;
  // Match DaylightChart padding so chart areas align exactly
  const rightEdgePadding = 54;
  const axisWidth = 28;
  const padding = $derived((() => {
    const count = Math.max(1, Math.min(5, derivativeCount));
    return {
      top: 20,
      right: rightEdgePadding + (count - 1) * axisWidth,
      bottom: 40,
      left: 45
    };
  })());
  const chartWidth = $derived(width - padding.left - padding.right);
  const chartHeight = $derived(height - padding.top - padding.bottom);

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Zone colors (back to front layering)
  const colors = {
    night:         'rgb(15, 23, 42)',    // slate-900 (very dark)
    astronomical:  'rgb(30, 58, 138)',   // blue-900 (deep blue, almost night)
    nautical:      'rgb(56, 114, 203)',  // medium blue (noticeably lighter)
    civil:         'rgb(120, 170, 230)', // light blue (approaching dawn/dusk)
    daylight:      'rgb(253, 224, 71)',  // yellow-300
  };

  // SunCalc uses -0.833° for sunrise/sunset (refraction + disc)
  const THRESH_SUNRISE = -0.833;
  const THRESH_CIVIL = -6;
  const THRESH_NAUTICAL = -12;
  const THRESH_ASTRONOMICAL = -18;

  // Convert a Date to fractional hour relative to a reference midnight, clamped to [0, 24]
  function toHourRelative(t, refMidnight) {
    if (!t || isNaN(t.getTime())) return null;
    const h = (t.getTime() - refMidnight.getTime()) / 3600000;
    return Math.max(0, Math.min(24, h));
  }

  // Resolve a boundary pair: if times are NaN or inverted (midnight crossover), use noonAlt
  function resolveZone(morningTime, eveningTime, noonAlt, threshold, refMidnight) {
    const mh = toHourRelative(morningTime, refMidnight);
    const eh = toHourRelative(eveningTime, refMidnight);
    if (mh !== null && eh !== null && mh <= eh) {
      return { morning: mh, evening: eh };
    }
    // NaN times or inverted (midnight crossover): determine from noon altitude
    if (noonAlt > threshold) {
      // Sun is above threshold at noon → zone exists
      // If we have valid but inverted times, the evening crossed midnight → extend to edges
      if (mh !== null && eh !== null) {
        return { morning: 0, evening: 24 };
      }
      return { morning: 0, evening: 24 };
    } else {
      // Sun never reaches above threshold → zone has zero width
      return { morning: 12, evening: 12 };
    }
  }

  // Compute twilight boundary hours for every day of the year
  let twilightData = $derived.by(() => {
    if (!yearData || yearData.length === 0) return [];
    const result = [];
    for (let i = 0; i < yearData.length; i++) {
      const d = yearData[i].date;

      // Compute reference midnight and noon in the configured timezone
      let refMidnight, refNoon;
      if (timezone) {
        refMidnight = dateAtLocalInTimezone(d.getFullYear(), d.getMonth() + 1, d.getDate(), 0, 0, timezone);
        refNoon = new Date(refMidnight.getTime() + 12 * 3600000);
      } else {
        refMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        refNoon = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0);
      }

      const times = SunCalc.getTimes(refNoon, latitude, longitude);
      const noonPosition = SunCalc.getPosition(times.solarNoon, latitude, longitude);
      const noonAlt = noonPosition.altitude * 180 / Math.PI;

      const daylight = resolveZone(times.sunrise, times.sunset, noonAlt, THRESH_SUNRISE, refMidnight);
      const civil = resolveZone(times.dawn, times.dusk, noonAlt, THRESH_CIVIL, refMidnight);
      const nautical = resolveZone(times.nauticalDawn, times.nauticalDusk, noonAlt, THRESH_NAUTICAL, refMidnight);
      const astronomical = resolveZone(times.nightEnd, times.night, noonAlt, THRESH_ASTRONOMICAL, refMidnight);

      result.push({ daylight, civil, nautical, astronomical });
    }
    return result;
  });

  // Scale helpers
  function xScale(dayIndex) {
    const n = yearData?.length ?? 365;
    return padding.left + (dayIndex / Math.max(n - 1, 1)) * chartWidth;
  }

  function yScale(hour) {
    return padding.top + (hour / 24) * chartHeight;
  }

  // Build area path between morning and evening boundary lines
  function buildAreaPath(data, zone) {
    if (data.length === 0) return '';
    const n = data.length;
    // Forward: morning boundary (top of zone)
    let path = `M ${xScale(0)} ${yScale(data[0][zone].morning)}`;
    for (let i = 1; i < n; i++) {
      path += ` L ${xScale(i)} ${yScale(data[i][zone].morning)}`;
    }
    // Backward: evening boundary (bottom of zone)
    for (let i = n - 1; i >= 0; i--) {
      path += ` L ${xScale(i)} ${yScale(data[i][zone].evening)}`;
    }
    path += ' Z';
    return path;
  }

  let astronomicalPath = $derived(buildAreaPath(twilightData, 'astronomical'));
  let nauticalPath = $derived(buildAreaPath(twilightData, 'nautical'));
  let civilPath = $derived(buildAreaPath(twilightData, 'civil'));
  let daylightPath = $derived(buildAreaPath(twilightData, 'daylight'));

  // Month tick positions
  let monthTicks = $derived.by(() => {
    if (!yearData || yearData.length === 0) return [];
    const year = selectedDate?.getFullYear() ?? new Date().getFullYear();
    const daysInYear = getDaysInYear(year);
    return months.map((label, monthIndex) => {
      const date = new Date(year, monthIndex, 1);
      const doy = getDayOfYear(date);
      const x = padding.left + ((doy - 1) / Math.max(daysInYear - 1, 1)) * chartWidth;
      return { x, label };
    });
  });

  // Hour ticks for Y axis
  const hourTicks = [0, 3, 6, 9, 12, 15, 18, 21, 24];

  // Selected/hovered date X positions
  let selectedDateX = $derived.by(() => {
    if (!selectedDate || !yearData || yearData.length === 0) return null;
    const doy = getDayOfYear(selectedDate);
    const daysInYear = getDaysInYear(selectedDate.getFullYear());
    return padding.left + ((doy - 1) / Math.max(daysInYear - 1, 1)) * chartWidth;
  });

  let oppositeDateX = $derived.by(() => {
    if (!oppositeDate?.date || !yearData || yearData.length === 0) return null;
    const doy = getDayOfYear(oppositeDate.date);
    const daysInYear = getDaysInYear(selectedDate.getFullYear());
    return padding.left + ((doy - 1) / Math.max(daysInYear - 1, 1)) * chartWidth;
  });

  let hoveredDateX = $derived.by(() => {
    if (!hoveredDate || !selectedDate || !yearData || yearData.length === 0) return null;
    const doy = getDayOfYear(hoveredDate);
    const daysInYear = getDaysInYear(selectedDate.getFullYear());
    return padding.left + ((doy - 1) / Math.max(daysInYear - 1, 1)) * chartWidth;
  });

  // Interaction: get date from X position
  function getDateAtX(svg, clientX) {
    if (!selectedDate || !yearData?.length) return null;
    const rect = svg.getBoundingClientRect();
    const scale = Math.min(rect.width / width, rect.height / height);
    const offsetX = (rect.width - width * scale) / 2;
    const svgX = (clientX - rect.left - offsetX) / scale;
    const clickX = svgX - padding.left;
    if (clickX < 0 || clickX > chartWidth) return null;
    const year = selectedDate.getFullYear();
    const daysInYear = getDaysInYear(year);
    const dayOfYear = Math.round((clickX / chartWidth) * (daysInYear - 1)) + 1;
    return new Date(year, 0, dayOfYear);
  }

  function handleChartClick(event) {
    if (!onDateSelect || !selectedDate || !yearData?.length) return;
    const newDate = getDateAtX(event.currentTarget, event.clientX);
    if (newDate) onDateSelect(newDate);
    onHoverDate?.(null);
  }

  function handleChartMouseMove(event) {
    const date = getDateAtX(event.currentTarget, event.clientX);
    onHoverDate?.(date);
    isHovering = true;
    if (date) {
      tooltipX = event.clientX;
      tooltipY = event.clientY;
    }
  }

  function handleChartMouseLeave() {
    onHoverDate?.(null);
    isHovering = false;
  }

  // Compute twilight zone durations for the hovered date
  function formatHours(h) {
    if (h <= 0) return '0m';
    const hours = Math.floor(h);
    const minutes = Math.round((h - hours) * 60);
    if (hours === 0) return `${minutes}m`;
    if (minutes === 0) return `${hours}h`;
    return `${hours}h ${minutes}m`;
  }

  let hoveredTwilightStats = $derived.by(() => {
    if (!hoveredDate || !yearData || yearData.length === 0 || twilightData.length === 0) return null;
    const doy = getDayOfYear(hoveredDate);
    const idx = Math.max(0, Math.min(twilightData.length - 1, doy - 1));
    const t = twilightData[idx];

    const daylightH = t.daylight.evening - t.daylight.morning;
    const civilH = (t.civil.evening - t.civil.morning) - daylightH;
    const nauticalH = (t.nautical.evening - t.nautical.morning) - (t.civil.evening - t.civil.morning);
    const astronomicalH = (t.astronomical.evening - t.astronomical.morning) - (t.nautical.evening - t.nautical.morning);
    const nightH = 24 - (t.astronomical.evening - t.astronomical.morning);

    return {
      daylight: formatHours(daylightH),
      civil: formatHours(Math.max(0, civilH)),
      nautical: formatHours(Math.max(0, nauticalH)),
      astronomical: formatHours(Math.max(0, astronomicalH)),
      night: formatHours(Math.max(0, nightH)),
    };
  });

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

<div class="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm grid h-full" style="grid-template-rows: auto 1fr auto;">
  <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Twilight Zones Through the Year</h3>
  <div class="min-h-0">
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions a11y_no_noninteractive_element_interactions -->
  <svg
    viewBox="0 0 {width} {height}"
    class="w-full cursor-pointer outline-none"
    onclick={handleChartClick}
    onmousemove={handleChartMouseMove}
    onmouseleave={handleChartMouseLeave}
    role="img"
    aria-label="Twilight zones through the year showing daylight, civil, nautical, and astronomical twilight bands. Click to select a date."
  >
    <!-- Night background -->
    <rect
      x={padding.left}
      y={padding.top}
      width={chartWidth}
      height={chartHeight}
      fill={colors.night}
    />

    <!-- Astronomical twilight band -->
    {#if astronomicalPath}
      <path d={astronomicalPath} fill={colors.astronomical} />
    {/if}

    <!-- Nautical twilight band -->
    {#if nauticalPath}
      <path d={nauticalPath} fill={colors.nautical} />
    {/if}

    <!-- Civil twilight band -->
    {#if civilPath}
      <path d={civilPath} fill={colors.civil} />
    {/if}

    <!-- Daylight band -->
    {#if daylightPath}
      <path d={daylightPath} fill={colors.daylight} />
    {/if}

    <!-- Y-axis: hour grid lines and labels -->
    {#each hourTicks as hour}
      {@const y = yScale(hour)}
      <line
        x1={padding.left}
        y1={y}
        x2={width - padding.right}
        y2={y}
        stroke="white"
        stroke-opacity="0.15"
        stroke-width="0.5"
      />
      <text
        x={padding.left - 8}
        y={y + 4}
        text-anchor="end"
        class="fill-gray-500 dark:fill-gray-400 text-xs"
      >
        {hour}:00
      </text>
    {/each}

    <!-- X-axis: month ticks and labels -->
    {#each monthTicks as { x, label }}
      <line
        x1={x}
        y1={padding.top + chartHeight}
        x2={x}
        y2={padding.top + chartHeight + 6}
        stroke="currentColor"
        class="stroke-gray-400 dark:stroke-gray-500"
      />
      <text
        x={x}
        y={height - 8}
        text-anchor="middle"
        class="fill-gray-500 dark:fill-gray-400 text-xs"
      >
        {label}
      </text>
    {/each}

    <!-- Mirror date vertical line -->
    {#if oppositeDateX !== null}
      <line
        x1={oppositeDateX}
        y1={padding.top}
        x2={oppositeDateX}
        y2={padding.top + chartHeight}
        stroke="rgb(16, 185, 129)"
        stroke-width="1.5"
        stroke-opacity="0.7"
        stroke-dasharray="4 3"
      />
    {/if}

    <!-- Hovered date vertical line -->
    {#if hoveredDateX !== null}
      <line
        x1={hoveredDateX}
        y1={padding.top}
        x2={hoveredDateX}
        y2={padding.top + chartHeight}
        stroke="white"
        stroke-width="1.5"
        stroke-opacity="0.6"
      />
    {/if}

    <!-- Selected date vertical line -->
    {#if selectedDateX !== null}
      <line
        x1={selectedDateX}
        y1={padding.top}
        x2={selectedDateX}
        y2={padding.top + chartHeight}
        stroke="rgb(234, 88, 12)"
        stroke-width="2"
        stroke-opacity="0.9"
      />
    {/if}
  </svg>
  </div>

  <!-- Legend -->
  <div class="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2 text-[10px] text-gray-500 dark:text-gray-400">
    <span class="flex items-center gap-1">
      <span class="inline-block w-3 h-2 rounded-sm" style="background: {colors.daylight}"></span>
      Daylight
    </span>
    <span class="flex items-center gap-1">
      <span class="inline-block w-3 h-2 rounded-sm" style="background: {colors.civil}"></span>
      Civil twilight
    </span>
    <span class="flex items-center gap-1">
      <span class="inline-block w-3 h-2 rounded-sm" style="background: {colors.nautical}"></span>
      Nautical twilight
    </span>
    <span class="flex items-center gap-1">
      <span class="inline-block w-3 h-2 rounded-sm" style="background: {colors.astronomical}"></span>
      Astronomical twilight
    </span>
    <span class="flex items-center gap-1">
      <span class="inline-block w-3 h-2 rounded-sm" style="background: {colors.night}; border: 1px solid rgb(100,116,139);"></span>
      Night
    </span>
  </div>

  <!-- Tooltip -->
  {#if hoveredDate && isHovering}
    {@const stats = getDayStatsForTooltip(hoveredDate, latitude, longitude, timezone)}
    <div
      class="fixed z-50 px-2 py-1.5 text-xs rounded shadow-lg bg-gray-800 text-gray-100 dark:bg-gray-700 dark:text-gray-200 pointer-events-none"
      style="left: {tooltipX + 12}px; top: {tooltipY + 8}px;"
    >
      <div class="font-medium">{stats.dateLabel}</div>
      <div>Sunrise: {stats.sunrise} · Sunset: {stats.sunset}</div>
      {#if hoveredTwilightStats}
        <div class="mt-1 space-y-px">
          <div><span class="inline-block w-2 h-2 rounded-sm mr-1" style="background: {colors.daylight}"></span>Daylight: {hoveredTwilightStats.daylight}</div>
          <div><span class="inline-block w-2 h-2 rounded-sm mr-1" style="background: {colors.civil}"></span>Civil: {hoveredTwilightStats.civil}</div>
          <div><span class="inline-block w-2 h-2 rounded-sm mr-1" style="background: {colors.nautical}"></span>Nautical: {hoveredTwilightStats.nautical}</div>
          <div><span class="inline-block w-2 h-2 rounded-sm mr-1" style="background: {colors.astronomical}"></span>Astronomical: {hoveredTwilightStats.astronomical}</div>
          <div><span class="inline-block w-2 h-2 rounded-sm mr-1" style="background: {colors.night}; border: 1px solid rgb(100,116,139);"></span>Night: {hoveredTwilightStats.night}</div>
        </div>
      {/if}
    </div>
  {/if}
</div>
