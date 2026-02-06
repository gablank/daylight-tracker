<script>
  import SunCalc from 'suncalc';
  import { getDayOfYear, getDaysInYear, getDayStatsForTooltip, cachedSunCalcTimes } from '../lib/solar.js';
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

  // Convert a Date to fractional hour relative to a reference midnight (unclamped)
  function toHourRelative(t, refMidnight) {
    if (!t || isNaN(t.getTime())) return null;
    return (t.getTime() - refMidnight.getTime()) / 3600000;
  }

  /**
   * Resolve a zone into bands in "natural" (solar) timezone.
   * Since we compute in the natural tz, events are well-behaved: rise < set, both near [0,24].
   * Returns { bands: [{morning, evening}, ...] } — empty array if zone isn't visible.
   */
  function resolveZone(morningTime, eveningTime, threshold, refMidnight, refNoon, lat, lng) {
    const mRaw = toHourRelative(morningTime, refMidnight);
    const eRaw = toHourRelative(eveningTime, refMidnight);

    // Helper: noon altitude for fallback when events are NaN
    function noonAlt() {
      return SunCalc.getPosition(refNoon, lat, lng).altitude * 180 / Math.PI;
    }

    if (mRaw !== null && eRaw !== null) {
      // Normal: rise then set — clamp to [0, 24]
      const m = Math.max(0, Math.min(24, mRaw));
      const e = Math.max(0, Math.min(24, eRaw));
      if (m < e) return { bands: [{ morning: m, evening: e }] };
      // Events collapsed after clamping — use noon altitude
      return noonAlt() > threshold
        ? { bands: [{ morning: 0, evening: 24 }] }
        : { bands: [] };
    }

    // Only rise event (no set — sun rises and stays up)
    if (mRaw !== null && eRaw === null) {
      if (noonAlt() > threshold) {
        const m = Math.max(0, Math.min(24, mRaw));
        return m < 24 ? { bands: [{ morning: m, evening: 24 }] } : { bands: [] };
      }
      return { bands: [] };
    }

    // Only set event (no rise — sun was up, then sets)
    if (mRaw === null && eRaw !== null) {
      if (noonAlt() > threshold) {
        const e = Math.max(0, Math.min(24, eRaw));
        return e > 0 ? { bands: [{ morning: 0, evening: e }] } : { bands: [] };
      }
      return { bands: [] };
    }

    // Both events NaN: entirely on or entirely off based on noon altitude
    return noonAlt() > threshold
      ? { bands: [{ morning: 0, evening: 24 }] }
      : { bands: [] };
  }

  /**
   * Rotate bands by `shift` hours, wrapping around [0, 24].
   * Like a register rotate — what falls off one end appears at the other.
   */
  function rotateBands(bands, shift) {
    if (Math.abs(shift) < 0.001) return bands;
    const result = [];
    for (const b of bands) {
      const m = b.morning + shift;
      const e = b.evening + shift;
      if (m >= 0 && e <= 24) {
        // Entirely within [0, 24]
        result.push({ morning: m, evening: e });
      } else if (m < 0 && e <= 24) {
        // Morning wraps backwards past midnight
        if (e > 0) result.push({ morning: 0, evening: e });
        if (m + 24 < 24) result.push({ morning: m + 24, evening: 24 });
      } else if (m >= 0 && e > 24) {
        // Evening wraps forward past midnight
        if (m < 24) result.push({ morning: m, evening: 24 });
        if (e - 24 > 0) result.push({ morning: 0, evening: e - 24 });
      } else {
        // Both wrap — covers entire day
        result.push({ morning: 0, evening: 24 });
      }
    }
    return result.filter(b => b.evening > b.morning);
  }

  // Compute twilight boundary bands for every day of the year.
  // Strategy: compute in the "natural" solar timezone (UTC + longitude/15) where
  // SunCalc events are well-behaved, then rotate to the selected timezone.
  let twilightData = $derived.by(() => {
    if (!yearData || yearData.length === 0) return [];

    // Natural timezone offset in hours (constant, no DST)
    const naturalOffsetHours = longitude / 15;
    const naturalOffsetMs = naturalOffsetHours * 3600000;

    const result = [];
    for (let i = 0; i < yearData.length; i++) {
      const d = yearData[i].date;
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const day = d.getDate();

      // Midnight and noon in the natural solar timezone
      const utcMidnightMs = Date.UTC(year, month - 1, day);
      const naturalMidnight = new Date(utcMidnightMs - naturalOffsetMs);
      const naturalNoon = new Date(naturalMidnight.getTime() + 12 * 3600000);

      // SunCalc times computed from natural noon — events are centered and well-behaved
      const times = cachedSunCalcTimes(naturalNoon, latitude, longitude);

      // Resolve zones in natural solar time
      const daylight = resolveZone(times.sunrise, times.sunset, THRESH_SUNRISE, naturalMidnight, naturalNoon, latitude, longitude);
      const civil = resolveZone(times.dawn, times.dusk, THRESH_CIVIL, naturalMidnight, naturalNoon, latitude, longitude);
      const nautical = resolveZone(times.nauticalDawn, times.nauticalDusk, THRESH_NAUTICAL, naturalMidnight, naturalNoon, latitude, longitude);
      const astronomical = resolveZone(times.nightEnd, times.night, THRESH_ASTRONOMICAL, naturalMidnight, naturalNoon, latitude, longitude);

      // Compute rotation: shift from natural time to selected timezone
      let selectedMidnight;
      if (timezone) {
        selectedMidnight = dateAtLocalInTimezone(year, month, day, 0, 0, timezone);
      } else {
        selectedMidnight = new Date(year, month - 1, day);
      }
      const shift = (naturalMidnight.getTime() - selectedMidnight.getTime()) / 3600000;

      // Rotate all zone bands from natural solar time → selected timezone
      result.push({
        daylight:      { bands: rotateBands(daylight.bands, shift) },
        civil:         { bands: rotateBands(civil.bands, shift) },
        nautical:      { bands: rotateBands(nautical.bands, shift) },
        astronomical:  { bands: rotateBands(astronomical.bands, shift) },
      });
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

  // Build rects for a zone: one rect per band per day
  function buildZoneRects(data, zone) {
    if (data.length === 0) return [];
    const n = data.length;
    const colW = chartWidth / n;
    const rects = [];
    for (let i = 0; i < n; i++) {
      const bands = data[i][zone].bands;
      const x = padding.left + (i / n) * chartWidth;
      for (const b of bands) {
        const y = yScale(b.morning);
        const h = yScale(b.evening) - y;
        if (h > 0) rects.push({ x, y, w: Math.ceil(colW + 0.5), h });
      }
    }
    return rects;
  }

  let astronomicalRects = $derived(buildZoneRects(twilightData, 'astronomical'));
  let nauticalRects = $derived(buildZoneRects(twilightData, 'nautical'));
  let civilRects = $derived(buildZoneRects(twilightData, 'civil'));
  let daylightRects = $derived(buildZoneRects(twilightData, 'daylight'));

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

    const sumBands = (zone) => zone.bands.reduce((s, b) => s + (b.evening - b.morning), 0);
    const daylightH = sumBands(t.daylight);
    const civilTotal = sumBands(t.civil);
    const nauticalTotal = sumBands(t.nautical);
    const astronomicalTotal = sumBands(t.astronomical);
    const civilH = civilTotal - daylightH;
    const nauticalH = nauticalTotal - civilTotal;
    const astronomicalH = astronomicalTotal - nauticalTotal;
    const nightH = 24 - astronomicalTotal;

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

<div class="h-full flex flex-col">
  <div class="flex-1 min-h-0">
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
    {#each astronomicalRects as r}
      <rect x={r.x} y={r.y} width={r.w} height={r.h} fill={colors.astronomical} />
    {/each}

    <!-- Nautical twilight band -->
    {#each nauticalRects as r}
      <rect x={r.x} y={r.y} width={r.w} height={r.h} fill={colors.nautical} />
    {/each}

    <!-- Civil twilight band -->
    {#each civilRects as r}
      <rect x={r.x} y={r.y} width={r.w} height={r.h} fill={colors.civil} />
    {/each}

    <!-- Daylight band -->
    {#each daylightRects as r}
      <rect x={r.x} y={r.y} width={r.w} height={r.h} fill={colors.daylight} />
    {/each}

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
