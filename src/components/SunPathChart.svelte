<script>
  import { getSunPathForDay, getSunData, getSunPosition } from '../lib/solar.js';
  import { formatTimeInTimezone, getHourInTimezone } from '../lib/utils.js';

  let { selectedDate, latitude, longitude, timezone, highlightHour = null, onHoverHour = null } = $props();

  const size = 280;
  const center = size / 2;
  const horizonRadius = size / 2 - 34;

  // Tooltip: { time, altitude, azimuth } or null
  let tooltip = $state(null);
  let tooltipX = $state(0);
  let tooltipY = $state(0);

  // Diagram angle: 0°=N (top), 90°=E (right), 180°=S (bottom), 270°=W (left) — matches tick marks
  // SunCalc azimuth: 0=S, 90=W, 180=N, 270=E → diagramAngle = (azimuth + 180) % 360
  function azimuthToDiagramAngle(azimuth) {
    return (azimuth + 180) % 360;
  }
  function formatDirection(diagramAngle) {
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const i = Math.round(((diagramAngle % 360) / 360) * 8) % 8;
    return dirs[i];
  }

  // Sun path points for the selected day (in selected timezone so polar and altitude chart align)
  let pathPoints = $derived.by(() => {
    if (!selectedDate) return [];
    return getSunPathForDay(selectedDate, latitude, longitude, timezone);
  });

  // Polar: North up. SunCalc azimuth: 0° = South, 90° = West, 180° = North, 270° = East (from south to west).
  // We want angle 0 = North (top), 90° = East (right), 180° = South (bottom), 270° = West (left).
  // So angle = azimuth - 180.
  function altAzToXY(altitude, azimuth) {
    const radius = altitude >= 90 ? 0 : ((90 - altitude) / 90) * horizonRadius;
    const angleDeg = azimuth - 180;
    const angleRad = (angleDeg * Math.PI) / 180;
    return {
      x: center + radius * Math.sin(angleRad),
      y: center - radius * Math.cos(angleRad)
    };
  }

  // Full path (above + below horizon) for polar; below-horizon segment drawn with same altAzToXY (SVG overflow clips)
  let pathDAbove = $derived.by(() => {
    const pts = pathPoints.filter((p) => p.altitude >= -0.5);
    if (pts.length < 2) return '';
    return pts
      .map((p, i) => {
        const { x, y } = altAzToXY(p.altitude, p.azimuth);
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ');
  });
  // Below-horizon path split into evening (after sunset) and morning (before sunrise) so we don't draw a line across
  let pathDBelowEvening = $derived.by(() => {
    const pts = pathPoints.filter((p) => p.altitude < -0.5 && getHourInTimezone(p.time, timezone) >= 12);
    if (pts.length < 2) return '';
    return pts
      .map((p, i) => {
        const { x, y } = altAzToXY(p.altitude, p.azimuth);
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ');
  });
  let pathDBelowMorning = $derived.by(() => {
    const pts = pathPoints.filter((p) => p.altitude < -0.5 && getHourInTimezone(p.time, timezone) < 12);
    if (pts.length < 2) return '';
    return pts
      .map((p, i) => {
        const { x, y } = altAzToXY(p.altitude, p.azimuth);
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ');
  });

  let sunData = $derived(getSunData(selectedDate, latitude, longitude));

  // Altitude vs time chart (to the right of polar)
  const altChartWidth = 260;
  const altChartHeight = 220;
  const altChartPadding = { top: 12, right: 12, bottom: 24, left: 28 };
  const altChartPlotWidth = altChartWidth - altChartPadding.left - altChartPadding.right;
  const altChartPlotHeight = altChartHeight - altChartPadding.top - altChartPadding.bottom;

  // Y scale: -90° to 90° (nadir to zenith)
  const altMin = -90;
  const altMax = 90;
  const altRange = altMax - altMin;
  let altitudePathD = $derived.by(() => {
    if (!pathPoints.length) return '';
    return pathPoints
      .map((p, i) => {
        const hour = getHourInTimezone(p.time, timezone);
        const x = altChartPadding.left + (hour / 24) * altChartPlotWidth;
        const altClamp = Math.max(altMin, Math.min(altMax, p.altitude));
        const y = altChartPadding.top + altChartPlotHeight - ((altClamp - altMin) / altRange) * altChartPlotHeight;
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ');
  });

  // Hover marker position: polar (x,y) and altitude chart (x,y) when tooltip is set
  let tooltipPolarPos = $derived.by(() => {
    if (!tooltip) return null;
    return altAzToXY(tooltip.altitude, tooltip.azimuth);
  });
  let tooltipAltPos = $derived.by(() => {
    if (!tooltip) return null;
    const hour = getHourInTimezone(tooltip.time, timezone);
    const x = altChartPadding.left + (hour / 24) * altChartPlotWidth;
    const altClamp = Math.max(altMin, Math.min(altMax, tooltip.altitude));
    const y = altChartPadding.top + altChartPlotHeight - ((altClamp - altMin) / altRange) * altChartPlotHeight;
    return { x, y };
  });

  // Highlight marker: show position at highlightHour (from SunAzimuthChart's slider)
  let highlightPoint = $derived.by(() => {
    if (highlightHour == null || !pathPoints.length) return null;
    // Find the path point closest to the highlight hour
    let best = null;
    let bestDiff = Infinity;
    for (const p of pathPoints) {
      const h = getHourInTimezone(p.time, timezone);
      const diff = Math.abs(h - highlightHour);
      if (diff < bestDiff) { bestDiff = diff; best = p; }
    }
    if (!best || bestDiff > 0.5) return null; // within ~30 min
    return best;
  });

  let highlightPolarPos = $derived.by(() => {
    if (!highlightPoint) return null;
    return altAzToXY(highlightPoint.altitude, highlightPoint.azimuth);
  });

  let highlightAltPos = $derived.by(() => {
    if (!highlightPoint) return null;
    const hour = getHourInTimezone(highlightPoint.time, timezone);
    const x = altChartPadding.left + (hour / 24) * altChartPlotWidth;
    const altClamp = Math.max(altMin, Math.min(altMax, highlightPoint.altitude));
    const y = altChartPadding.top + altChartPlotHeight - ((altClamp - altMin) / altRange) * altChartPlotHeight;
    return { x, y };
  });

  // Mark sunrise, solar noon, sunset if available
  let markers = $derived.by(() => {
    const m = [];
    if (!sunData.sunrise || !sunData.sunset) return m;
    const noon = sunData.solarNoon;
    const risePos = getSunPosition(sunData.sunrise, latitude, longitude);
    const setPos = getSunPosition(sunData.sunset, latitude, longitude);
    const noonPos = getSunPosition(noon, latitude, longitude);
    // Clamp sunrise/sunset altitude to 0: SunCalc's getPosition returns geometric altitude (~-0.833°)
    // but sunrise/sunset are defined at the apparent horizon (0° after refraction correction)
    m.push({ label: 'Sunrise', alt: 0, az: risePos.azimuth, time: sunData.sunrise });
    m.push({ label: 'Noon', alt: noonPos.altitude, az: noonPos.azimuth, time: noon });
    m.push({ label: 'Sunset', alt: 0, az: setPos.azimuth, time: sunData.sunset });
    return m;
  });

  // Polar: find nearest path point or marker to (svgX, svgY)
  function handlePolarMouseMove(event) {
    if (!pathPoints.length) return;
    const svg = event.currentTarget;
    const rect = svg.getBoundingClientRect();
    const scaleX = size / rect.width;
    const scaleY = size / rect.height;
    const svgX = (event.clientX - rect.left) * scaleX;
    const svgY = (event.clientY - rect.top) * scaleY;
    // Check markers first (sunrise/sunset/noon) - they have priority within close range
    let best = null;
    let bestD2 = Infinity;
    for (const m of markers) {
      const { x, y } = altAzToXY(m.alt, m.az);
      const d2 = (x - svgX) ** 2 + (y - svgY) ** 2;
      if (d2 < bestD2 && d2 < 45) { bestD2 = d2; best = { time: m.time, altitude: m.alt, azimuth: m.az }; }
    }
    // Fall back to path points
    if (!best) {
      for (const p of pathPoints) {
        const { x, y } = altAzToXY(p.altitude, p.azimuth);
        const d2 = (x - svgX) ** 2 + (y - svgY) ** 2;
        if (d2 < bestD2) { bestD2 = d2; best = p; }
      }
    }
    if (best) {
      tooltip = { time: best.time, altitude: best.altitude, azimuth: best.azimuth };
      tooltipX = event.clientX;
      tooltipY = event.clientY;
      onHoverHour?.(getHourInTimezone(best.time, timezone));
    }
  }
  function handlePolarMouseLeave() {
    tooltip = null;
    onHoverHour?.(null);
  }

  // Altitude chart: get point from x only. Check markers first for snapping.
  function handleAltChartMouseMove(event) {
    if (!pathPoints.length) return;
    const svg = event.currentTarget;
    const rect = svg.getBoundingClientRect();
    const scaleX = altChartWidth / rect.width;
    const svgX = (event.clientX - rect.left) * scaleX;
    const svgY = (event.clientY - rect.top) * (altChartHeight / rect.height);
    const frac = (svgX - altChartPadding.left) / altChartPlotWidth;
    if (frac < 0 || frac > 1) return;
    // Check markers first (sunrise/sunset/noon snap)
    let best = null;
    let bestD2 = Infinity;
    for (const m of markers) {
      const hour = getHourInTimezone(m.time, timezone);
      const mx = altChartPadding.left + (hour / 24) * altChartPlotWidth;
      const altClamp = Math.max(altMin, Math.min(altMax, m.alt));
      const my = altChartPadding.top + altChartPlotHeight - ((altClamp - altMin) / altRange) * altChartPlotHeight;
      const d2 = (mx - svgX) ** 2 + (my - svgY) ** 2;
      if (d2 < bestD2 && d2 < 45) { bestD2 = d2; best = { time: m.time, altitude: m.alt, azimuth: m.az }; }
    }
    // Fall back to path point by x position
    if (!best) {
      const index = Math.max(0, Math.min(pathPoints.length - 1, Math.round(frac * (pathPoints.length - 1))));
      best = pathPoints[index];
    }
    tooltip = { time: best.time, altitude: best.altitude, azimuth: best.azimuth };
    tooltipX = event.clientX;
    tooltipY = event.clientY;
    onHoverHour?.(getHourInTimezone(best.time, timezone));
  }
  function handleAltChartMouseLeave() {
    tooltip = null;
    onHoverHour?.(null);
  }

  // Clear tooltip on scroll or touchmove so it doesn't stick on mobile
  $effect(() => {
    const clear = () => { tooltip = null; onHoverHour?.(null); };
    window.addEventListener('scroll', clear, true);
    window.addEventListener('touchmove', clear, true);
    return () => {
      window.removeEventListener('scroll', clear, true);
      window.removeEventListener('touchmove', clear, true);
    };
  });
</script>

<div class="min-h-0 bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm flex flex-col">
  <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 shrink-0">Sun path</h3>
  <div class="flex flex-wrap items-start justify-center gap-4 min-h-0">
    <!-- Polar sun path -->
    <div class="flex flex-col shrink-0 w-full max-w-[280px] overflow-visible">
      <p class="text-[10px] text-gray-500 dark:text-gray-400 mb-1 text-center min-h-[1.25rem] flex items-center justify-center">Direction and altitude</p>
      <svg
        viewBox="0 0 {size} {size}"
        class="w-full max-w-[280px] aspect-square overflow-hidden"
        role="img"
        aria-label="Sun path for selected date"
        onmousemove={handlePolarMouseMove}
        onmouseleave={handlePolarMouseLeave}
      >
        <!-- Horizon circle -->
        <circle
          cx={center}
          cy={center}
          r={horizonRadius}
          fill="none"
          stroke="currentColor"
          stroke-opacity="0.2"
          stroke-width="1"
        />
        <!-- Dotted N–S meridian (solar noon reference) -->
        <line
          x1={center}
          y1={center - horizonRadius}
          x2={center}
          y2={center + horizonRadius}
          stroke="currentColor"
          stroke-opacity="0.35"
          stroke-width="1"
          stroke-dasharray="4,4"
        />
        <!-- Dotted W–E line -->
        <line
          x1={center - horizonRadius}
          y1={center}
          x2={center + horizonRadius}
          y2={center}
          stroke="currentColor"
          stroke-opacity="0.35"
          stroke-width="1"
          stroke-dasharray="4,4"
        />
      <!-- Labels every 30° (angle in our coords: 0=N, 90=E, 180=S, 270=W) -->
      {#each [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330] as angleDeg}
        {@const angleRad = (angleDeg * Math.PI) / 180}
        {@const labelRadius = horizonRadius + 12}
        {@const x = center + labelRadius * Math.sin(angleRad)}
        {@const y = center - labelRadius * Math.cos(angleRad)}
        {@const label = angleDeg === 0 ? 'N' : angleDeg === 90 ? 'E' : angleDeg === 180 ? 'S' : angleDeg === 270 ? 'W' : `${angleDeg}°`}
        <text
          x={x}
          y={y + 4}
          text-anchor="middle"
          class="fill-gray-400 dark:fill-gray-500 text-[9px]"
        >{label}</text>
      {/each}
      <!-- Sun path below horizon: evening (after sunset) and morning (before sunrise), no line between them -->
      {#if pathDBelowEvening}
        <path
          d={pathDBelowEvening}
          fill="none"
          stroke="rgb(245, 158, 11)"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-opacity="0.5"
          stroke-dasharray="4,4"
        />
      {/if}
      {#if pathDBelowMorning}
        <path
          d={pathDBelowMorning}
          fill="none"
          stroke="rgb(245, 158, 11)"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-opacity="0.5"
          stroke-dasharray="4,4"
        />
      {/if}
      <!-- Sun path above horizon -->
      <path
        d={pathDAbove}
        fill="none"
        stroke="rgb(245, 158, 11)"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <!-- Sunrise, noon, sunset markers -->
      {#each markers as m}
        {@const { x, y } = altAzToXY(m.alt, m.az)}
        <circle cx={x} cy={y} r={4} fill="rgb(234, 88, 12)" stroke="white" stroke-width="1" />
        <text
          x={x}
          y={y - 8}
          text-anchor="middle"
          class="fill-orange-600 dark:fill-orange-400 text-[9px]"
        >
          {m.label} {formatTimeInTimezone(m.time, timezone)}
        </text>
      {/each}
      <!-- Highlight marker from SunAzimuthChart hour (blue) -->
      {#if highlightPolarPos && !tooltipPolarPos}
        <circle
          cx={highlightPolarPos.x}
          cy={highlightPolarPos.y}
          r="5"
          fill="rgb(59, 130, 246)"
          fill-opacity="0.8"
          stroke="white"
          stroke-width="1"
        />
      {/if}
      <!-- Hover marker on polar plot -->
      {#if tooltipPolarPos}
        <circle
          cx={tooltipPolarPos.x}
          cy={tooltipPolarPos.y}
          r="6"
          fill="none"
          stroke="rgb(234, 88, 12)"
          stroke-width="2"
        />
      {/if}
      </svg>
    </div>
    <!-- Altitude chart -->
    <div class="min-w-[200px] max-w-[280px] w-full flex flex-col shrink-0">
      <p class="text-[10px] text-gray-500 dark:text-gray-400 mb-1 text-center min-h-[1.25rem] flex items-center justify-center">Solar height (°)</p>
      <svg
        viewBox="0 0 {altChartWidth} {altChartHeight}"
        class="w-full aspect-auto overflow-visible"
        style="min-height: 200px;"
        role="img"
        aria-label="Solar altitude through the day"
        onmousemove={handleAltChartMouseMove}
        onmouseleave={handleAltChartMouseLeave}
      >
        <!-- Y-axis grid and labels (-90° to 90°, horizon at 0°) -->
        {#each [-90, -60, -30, 0, 30, 60, 90] as deg}
          {@const y = altChartPadding.top + altChartPlotHeight - ((deg - altMin) / altRange) * altChartPlotHeight}
          {@const isHorizon = deg === 0}
          <line x1={altChartPadding.left} x2={altChartWidth - altChartPadding.right} y1={y} y2={y} stroke="currentColor" stroke-opacity={isHorizon ? '0.35' : '0.15'} stroke-width={isHorizon ? '1' : '0.5'} stroke-dasharray={isHorizon ? '4,4' : 'none'} />
          <text x={altChartPadding.left - 4} y={y + 3} text-anchor="end" class="fill-gray-500 dark:fill-gray-400 text-[9px]">{deg}°</text>
        {/each}
        <!-- X-axis grid and labels (time) -->
        {#each [0, 6, 12, 18, 24] as hour}
          {@const x = altChartPadding.left + (hour / 24) * altChartPlotWidth}
          <line y1={altChartPadding.top} y2={altChartPadding.top + altChartPlotHeight} x1={x} x2={x} stroke="currentColor" stroke-opacity="0.15" stroke-width="0.5" />
          <text x={x} y={altChartHeight - 4} text-anchor="middle" class="fill-gray-500 dark:fill-gray-400 text-[9px]">{hour === 24 ? '24' : hour}:00</text>
        {/each}
        <!-- Altitude curve -->
        <path
          d={altitudePathD}
          fill="none"
          stroke="rgb(245, 158, 11)"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <!-- Highlight marker from SunAzimuthChart hour (blue) -->
        {#if highlightAltPos && !tooltipAltPos}
          <line
            x1={highlightAltPos.x}
            y1={altChartPadding.top}
            x2={highlightAltPos.x}
            y2={altChartPadding.top + altChartPlotHeight}
            stroke="rgb(59, 130, 246)"
            stroke-width="1"
            stroke-dasharray="2,2"
            stroke-opacity="0.6"
          />
          <circle
            cx={highlightAltPos.x}
            cy={highlightAltPos.y}
            r="4"
            fill="rgb(59, 130, 246)"
            stroke="white"
            stroke-width="1"
          />
        {/if}
        <!-- Hover marker on altitude chart -->
        {#if tooltipAltPos}
          <line
            x1={tooltipAltPos.x}
            y1={altChartPadding.top}
            x2={tooltipAltPos.x}
            y2={altChartPadding.top + altChartPlotHeight}
            stroke="rgb(234, 88, 12)"
            stroke-width="1"
            stroke-dasharray="2,2"
            stroke-opacity="0.8"
          />
          <circle
            cx={tooltipAltPos.x}
            cy={tooltipAltPos.y}
            r="5"
            fill="rgb(234, 88, 12)"
            stroke="white"
            stroke-width="1"
          />
        {/if}
      </svg>
    </div>
  </div>
  <!-- Tooltip: Time, solar height, direction (diagram angle: 0°=N, 90°=E, 180°=S, 270°=W) -->
  {#if tooltip}
    {@const diagramAngle = azimuthToDiagramAngle(tooltip.azimuth)}
    <div
      class="fixed z-50 px-2 py-1.5 text-xs rounded shadow-lg bg-gray-800 text-gray-100 dark:bg-gray-700 dark:text-gray-200 pointer-events-none"
      style="left: {tooltipX + 12}px; top: {tooltipY + 8}px;"
    >
      <div>Time: {formatTimeInTimezone(tooltip.time, timezone)}</div>
      <div>Solar height: {tooltip.altitude.toFixed(1)}°</div>
      <div>Direction: {formatDirection(diagramAngle)} ({Math.round(diagramAngle)}°)</div>
    </div>
  {/if}
</div>
