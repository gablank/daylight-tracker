<script>
  import { getDayOfYear, getSunPosition, formatDateShort } from '../lib/solar.js';
  import { dateAtLocalInTimezone } from '../lib/utils.js';

  let { yearData, selectedDate, oppositeDate = null, latitude = 0, longitude = 0, timezone = null, hoveredDate = null, onHoverDate = null, onDateSelect = null, hoveredHour = null, onHoverHour = null, selectedHour = $bindable(12) } = $props();

  let tooltipX = $state(0);
  let tooltipY = $state(0);
  let isHovering = $state(false);

  // Use hoveredHour (from SunPathChart) when available, otherwise selectedHour (slider)
  let displayedHour = $derived(hoveredHour != null ? hoveredHour : selectedHour);

  const width = 600;
  const height = 300;
  const padding = { top: 20, right: 40, bottom: 40, left: 45 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  function formatDirection(compassAz) {
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const i = Math.round(((compassAz % 360) / 360) * 8) % 8;
    return dirs[i];
  }

  // Compute sun position at displayedHour for each day
  let scatterData = $derived.by(() => {
    if (!yearData || yearData.length === 0 || !selectedDate) return [];
    const hour = Math.floor(displayedHour);
    const min = Math.round((displayedHour - hour) * 60);
    const result = [];

    for (let i = 0; i < yearData.length; i++) {
      const d = yearData[i].date;

      // Construct date at the displayed local hour
      let dateAtHour;
      if (timezone) {
        dateAtHour = dateAtLocalInTimezone(d.getFullYear(), d.getMonth() + 1, d.getDate(), hour, min, timezone);
      } else {
        dateAtHour = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour, min, 0);
      }

      const pos = getSunPosition(dateAtHour, latitude, longitude);
      // Convert SunCalc azimuth (0=South) to compass bearing (0=North)
      const compassAzimuth = (pos.azimuth + 180) % 360;

      result.push({
        date: d,
        altitude: pos.altitude,
        compassAzimuth,
        dayIndex: i
      });
    }
    return result;
  });

  // Static Y-axis based on theoretical min/max sun altitude for this latitude
  // Max: solar noon at summer solstice; Min: solar midnight at winter solstice
  const OBLIQUITY = 23.44; // Earth's axial tilt in degrees
  let altRange = $derived.by(() => {
    const absLat = Math.abs(latitude);
    // Maximum altitude: noon at summer solstice
    const theoreticalMax = Math.min(90, 90 - absLat + OBLIQUITY);
    // Minimum altitude: midnight at winter solstice
    const theoreticalMin = Math.max(-90, -(90 - Math.abs(absLat - OBLIQUITY)));
    // Round outward to nice multiples of 10 with a small margin
    const max = Math.ceil((theoreticalMax + 3) / 10) * 10;
    const min = Math.floor((theoreticalMin - 3) / 10) * 10;
    return { min, max };
  });

  function xScale(compassAz) {
    return padding.left + (compassAz / 360) * chartWidth;
  }

  function yScale(alt) {
    return padding.top + chartHeight - ((alt - altRange.min) / (altRange.max - altRange.min)) * chartHeight;
  }

  // Find dot for selectedDate
  let selectedDot = $derived.by(() => {
    if (!selectedDate || scatterData.length === 0) return null;
    const doy = getDayOfYear(selectedDate);
    const idx = doy - 1; // getDayOfYear is 1-based
    if (idx >= 0 && idx < scatterData.length) return scatterData[idx];
    return null;
  });

  // Find dot for oppositeDate (mirror date)
  let oppositeDot = $derived.by(() => {
    if (!oppositeDate?.date || scatterData.length === 0) return null;
    const doy = getDayOfYear(oppositeDate.date);
    const idx = doy - 1;
    if (idx >= 0 && idx < scatterData.length) return scatterData[idx];
    return null;
  });

  // Find dot for hoveredDate
  let hoveredDot = $derived.by(() => {
    if (!hoveredDate || scatterData.length === 0) return null;
    const doy = getDayOfYear(hoveredDate);
    const idx = doy - 1;
    if (idx >= 0 && idx < scatterData.length) return scatterData[idx];
    return null;
  });

  // Altitude grid ticks
  let altTicks = $derived.by(() => {
    const { min, max } = altRange;
    const range = max - min;
    let step;
    if (range <= 30) step = 5;
    else if (range <= 60) step = 10;
    else if (range <= 120) step = 15;
    else step = 30;

    const ticks = [];
    const first = Math.ceil(min / step) * step;
    for (let v = first; v <= max; v += step) {
      ticks.push(v);
    }
    return ticks;
  });

  // Azimuth axis ticks (cardinal + intercardinal)
  const azTicks = [
    { deg: 0, label: 'N' },
    { deg: 90, label: 'E' },
    { deg: 180, label: 'S' },
    { deg: 270, label: 'W' },
    { deg: 360, label: 'N' }
  ];

  // Nearest-dot search
  function findNearestPoint(svgX, svgY) {
    if (scatterData.length === 0) return null;
    let best = null;
    let bestD2 = Infinity;
    for (const p of scatterData) {
      const px = xScale(p.compassAzimuth);
      const py = yScale(p.altitude);
      const d2 = (px - svgX) ** 2 + (py - svgY) ** 2;
      if (d2 < bestD2) { bestD2 = d2; best = p; }
    }
    if (bestD2 > 400) return null; // within 20 SVG units
    return best;
  }

  function getSvgCoords(event) {
    const svg = event.currentTarget;
    const rect = svg.getBoundingClientRect();
    const scaleX = width / rect.width;
    const scaleY = height / rect.height;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY
    };
  }

  function handleMouseMove(event) {
    const { x, y } = getSvgCoords(event);
    const nearest = findNearestPoint(x, y);
    isHovering = true;
    if (nearest) {
      onHoverDate?.(nearest.date);
      onHoverHour?.(selectedHour);
      tooltipX = event.clientX;
      tooltipY = event.clientY;
    } else {
      onHoverDate?.(null);
      onHoverHour?.(null);
    }
  }

  function handleMouseLeave() {
    onHoverDate?.(null);
    onHoverHour?.(null);
    isHovering = false;
  }

  function handleClick(event) {
    if (!onDateSelect) return;
    const { x, y } = getSvgCoords(event);
    const nearest = findNearestPoint(x, y);
    if (nearest) {
      onDateSelect(nearest.date);
      onHoverDate?.(null);
      onHoverHour?.(null);
    }
  }

  // Clear hover on scroll/touchmove
  $effect(() => {
    const clear = () => { onHoverDate?.(null); onHoverHour?.(null); isHovering = false; };
    window.addEventListener('scroll', clear, true);
    window.addEventListener('touchmove', clear, true);
    return () => {
      window.removeEventListener('scroll', clear, true);
      window.removeEventListener('touchmove', clear, true);
    };
  });
</script>

<div class="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm flex flex-col">
  <div class="flex items-center justify-between mb-3">
    <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300">Sun Position by Date</h3>
    <label class="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
      <span>Hour:</span>
      <input
        type="range"
        min="0"
        max="23"
        value={Math.round(displayedHour)}
        oninput={(e) => selectedHour = parseInt(e.currentTarget.value, 10)}
        class="w-20 accent-blue-600"
      />
      <span class="w-12 text-center font-mono text-gray-900 dark:text-gray-100">{String(Math.floor(displayedHour)).padStart(2, '0')}:{String(Math.round((displayedHour % 1) * 60)).padStart(2, '0')}</span>
    </label>
  </div>
  <div class="min-h-0">
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions a11y_no_noninteractive_element_interactions -->
  <svg
    viewBox="0 0 {width} {height}"
    class="w-full max-w-3xl cursor-pointer outline-none"
    style="max-height: 320px;"
    onclick={handleClick}
    onmousemove={handleMouseMove}
    onmouseleave={handleMouseLeave}
    role="img"
    aria-label="Sun azimuth and altitude at {Math.floor(displayedHour)}:{String(Math.round((displayedHour % 1) * 60)).padStart(2, '0')} for each day of the year. Click to select a date."
  >
    <!-- Altitude grid lines and labels -->
    {#each altTicks as deg}
      {@const y = yScale(deg)}
      {@const isHorizon = deg === 0}
      <line
        x1={padding.left}
        y1={y}
        x2={width - padding.right}
        y2={y}
        stroke="currentColor"
        stroke-opacity={isHorizon ? '0.4' : '0.12'}
        stroke-width={isHorizon ? '1.5' : '0.5'}
        stroke-dasharray={isHorizon ? '6,3' : 'none'}
      />
      <text
        x={padding.left - 8}
        y={y + 4}
        text-anchor="end"
        class="fill-gray-500 dark:fill-gray-400 text-xs"
      >
        {deg}°
      </text>
    {/each}

    <!-- Azimuth grid lines and labels -->
    {#each azTicks as { deg, label }}
      {@const x = xScale(deg)}
      <line
        x1={x}
        y1={padding.top}
        x2={x}
        y2={padding.top + chartHeight}
        stroke="currentColor"
        stroke-opacity="0.12"
        stroke-width="0.5"
      />
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
        class="fill-gray-500 dark:fill-gray-400 text-xs font-medium"
      >
        {label} ({deg}°)
      </text>
    {/each}

    <!-- Scatter dots (one per day) -->
    {#each scatterData as p}
      <circle
        cx={xScale(p.compassAzimuth)}
        cy={yScale(p.altitude)}
        r="2.5"
        fill="rgb(245, 158, 11)"
        fill-opacity="0.7"
      />
    {/each}

    <!-- Mirror date marker (ring, dashed) -->
    {#if oppositeDot && (!selectedDot || oppositeDot.dayIndex !== selectedDot.dayIndex)}
      <circle
        cx={xScale(oppositeDot.compassAzimuth)}
        cy={yScale(oppositeDot.altitude)}
        r="7"
        fill="none"
        stroke="rgb(16, 185, 129)"
        stroke-width="2"
        stroke-dasharray="3 2"
      />
    {/if}

    <!-- Hovered date marker (ring) -->
    {#if hoveredDot && (!selectedDot || hoveredDot.dayIndex !== selectedDot.dayIndex)}
      <circle
        cx={xScale(hoveredDot.compassAzimuth)}
        cy={yScale(hoveredDot.altitude)}
        r="7"
        fill="none"
        stroke="rgb(59, 130, 246)"
        stroke-width="2"
      />
    {/if}

    <!-- Selected date marker (filled dot) -->
    {#if selectedDot}
      <circle
        cx={xScale(selectedDot.compassAzimuth)}
        cy={yScale(selectedDot.altitude)}
        r="5"
        fill="rgb(234, 88, 12)"
        stroke="white"
        stroke-width="1.5"
      />
    {/if}
  </svg>
  </div>

  <!-- Tooltip -->
  {#if hoveredDot && isHovering}
    <div
      class="fixed z-50 px-2 py-1.5 text-xs rounded shadow-lg bg-gray-800 text-gray-100 dark:bg-gray-700 dark:text-gray-200 pointer-events-none"
      style="left: {tooltipX + 12}px; top: {tooltipY + 8}px;"
    >
      <div class="font-medium">{formatDateShort(hoveredDot.date)}</div>
      <div>Altitude: {hoveredDot.altitude.toFixed(1)}°</div>
      <div>Direction: {formatDirection(hoveredDot.compassAzimuth)} ({Math.round(hoveredDot.compassAzimuth)}°)</div>
    </div>
  {/if}
</div>
