<script>
  import SunCalc from 'suncalc';
  import { WORLD_LAND_PATHS } from '../lib/world-land.js';
  import { dateAtLocalInTimezone } from '../lib/utils.js';

  let {
    latitude = $bindable(0),
    longitude = $bindable(0),
    selectedDate = new Date(),
    timezone = null,
    displayHour = 12
  } = $props();

  let hoverLat = $state(null);
  let hoverLon = $state(null);
  let svgEl = $state(null);

  // SVG dimensions and projection
  // viewBox: x=-180 y=-90 w=360 h=180 → equirectangular
  // In SVG, y increases downward, so y = -latitude (north = top)
  const vbX = -180, vbY = -90, vbW = 360, vbH = 180;

  // Compute the day/night terminator path for the selected date
  let terminatorPath = $derived.by(() => {
    if (!selectedDate) return '';

    // Reference time: displayHour in the selected timezone on the selected date
    const hour = displayHour ?? 12;
    let refTime;
    if (timezone) {
      const y = selectedDate.getFullYear();
      const m = selectedDate.getMonth() + 1;
      const d = selectedDate.getDate();
      const midnight = dateAtLocalInTimezone(y, m, d, 0, 0, timezone);
      refTime = new Date(midnight.getTime() + hour * 3600000);
    } else {
      const wholeH = Math.floor(hour);
      const mins = Math.round((hour - wholeH) * 60);
      refTime = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), wholeH, mins, 0);
    }

    // Subsolar longitude: the meridian where the sun is directly overhead right now
    const utcHours = refTime.getUTCHours() + refTime.getUTCMinutes() / 60 + refTime.getUTCSeconds() / 3600;
    const sunLon = (12 - utcHours) * 15; // degrees

    // Solar declination: at the pole, sun altitude = declination exactly
    // (sin(alt) = sin(dec)*sin(90°) = sin(dec) → alt = dec)
    const sunAtPole = SunCalc.getPosition(refTime, 89.99, sunLon);
    const declination = sunAtPole.altitude; // radians

    // Build terminator: for each longitude, the terminator latitude is where sun altitude = 0
    // Formula: lat_t = atan(-cos(lon - sunLon) / tan(declination))
    // This comes from the spherical geometry of the subsolar point.
    const tanDec = Math.tan(declination);
    const points = [];
    const step = 2; // degrees

    if (Math.abs(tanDec) < 1e-10) {
      // Near equinox: terminator is a vertical line (meridian ±90° from sun)
      // Night is the hemisphere away from the sun
      // Simplified: just draw terminator at sunLon ± 90
      for (let lon = -180; lon <= 180; lon += step) {
        points.push([lon, 0]); // terminator is at latitude 0
      }
    } else {
      for (let lon = -180; lon <= 180; lon += step) {
        const lonRad = (lon - sunLon) * Math.PI / 180;
        const latRad = Math.atan(-Math.cos(lonRad) / tanDec);
        const lat = latRad * 180 / Math.PI;
        points.push([lon, lat]);
      }
    }

    // Build night polygon: terminator curve + one polar edge
    // If declination > 0 (northern summer), the north pole has sun, south pole is dark
    // Night is the side opposite to the sun — below the terminator when dec > 0
    const nightPole = declination >= 0 ? -90 : 90;

    // SVG path: terminator from left to right, then close via the dark pole
    let d = '';
    for (let i = 0; i < points.length; i++) {
      const x = points[i][0];
      const y = -points[i][1]; // SVG y = -latitude
      d += (i === 0 ? 'M' : 'L') + `${x} ${y}`;
    }
    // Close via the night pole
    d += `L180 ${-nightPole}L-180 ${-nightPole}Z`;

    return d;
  });

  // Convert client coordinates to lat/lon
  function clientToLatLon(event) {
    if (!svgEl) return null;
    const rect = svgEl.getBoundingClientRect();
    // Map client coordinates to SVG viewBox coordinates
    const fracX = (event.clientX - rect.left) / rect.width;
    const fracY = (event.clientY - rect.top) / rect.height;
    const svgX = vbX + fracX * vbW;
    const svgY = vbY + fracY * vbH;
    // SVG x = longitude, SVG y = -latitude
    const lon = svgX;
    const lat = -svgY;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
    return { lat: Math.round(lat * 10) / 10, lon: Math.round(lon * 10) / 10 };
  }

  function handleMouseMove(event) {
    const pos = clientToLatLon(event);
    if (pos) {
      hoverLat = pos.lat;
      hoverLon = pos.lon;
    } else {
      hoverLat = null;
      hoverLon = null;
    }
  }

  function handleMouseLeave() {
    hoverLat = null;
    hoverLon = null;
  }

  function handleClick(event) {
    const pos = clientToLatLon(event);
    if (pos) {
      latitude = pos.lat;
      longitude = pos.lon;
    }
  }

  // Time label for display
  let timeLabel = $derived.by(() => {
    const hr = displayHour ?? 12;
    const h = Math.floor(hr);
    const m = Math.round((hr - h) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  });

  // Format coordinate for display
  function formatCoord(lat, lon) {
    const latDir = lat >= 0 ? 'N' : 'S';
    const lonDir = lon >= 0 ? 'E' : 'W';
    return `${Math.abs(lat).toFixed(1)}°${latDir}, ${Math.abs(lon).toFixed(1)}°${lonDir}`;
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions a11y_no_noninteractive_element_interactions -->
<svg
  bind:this={svgEl}
  viewBox="{vbX} {vbY} {vbW} {vbH}"
  class="w-full cursor-crosshair select-none"
  preserveAspectRatio="xMidYMid meet"
  onmousemove={handleMouseMove}
  onmouseleave={handleMouseLeave}
  onclick={handleClick}
  role="img"
  aria-label="World map. Click to select a location."
>
  <!-- Ocean background -->
  <rect x={vbX} y={vbY} width={vbW} height={vbH} fill="rgb(30, 58, 90)" />

  <!-- Grid lines -->
  {#each [-60, -30, 0, 30, 60] as lat}
    <line x1={-180} y1={-lat} x2={180} y2={-lat} stroke="white" stroke-opacity="0.1" stroke-width="0.3" />
  {/each}
  {#each [-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150] as lon}
    <line x1={lon} y1={-90} x2={lon} y2={90} stroke="white" stroke-opacity="0.1" stroke-width="0.3" />
  {/each}

  <!-- Land masses -->
  {#each WORLD_LAND_PATHS as d}
    <path {d} fill="rgb(120, 140, 110)" stroke="rgb(90, 110, 80)" stroke-width="0.2" />
  {/each}

  <!-- Night overlay (terminator) -->
  {#if terminatorPath}
    <path d={terminatorPath} fill="rgba(0, 0, 0, 0.4)" stroke="none" />
  {/if}

  <!-- Equator -->
  <line x1={-180} y1={0} x2={180} y2={0} stroke="white" stroke-opacity="0.2" stroke-width="0.4" stroke-dasharray="2 2" />

  <!-- Tropics and polar circles -->
  {#each [23.44, -23.44, 66.56, -66.56] as lat}
    <line x1={-180} y1={-lat} x2={180} y2={-lat} stroke="white" stroke-opacity="0.08" stroke-width="0.3" stroke-dasharray="1 3" />
  {/each}

  <!-- Hover marker -->
  {#if hoverLat !== null && hoverLon !== null}
    <circle cx={hoverLon} cy={-hoverLat} r="2" fill="rgb(59, 130, 246)" fill-opacity="0.8" stroke="white" stroke-width="0.5" />
    <!-- Crosshair lines -->
    <line x1={hoverLon} y1={-90} x2={hoverLon} y2={90} stroke="rgb(59, 130, 246)" stroke-opacity="0.3" stroke-width="0.3" />
    <line x1={-180} y1={-hoverLat} x2={180} y2={-hoverLat} stroke="rgb(59, 130, 246)" stroke-opacity="0.3" stroke-width="0.3" />
    <!-- Coordinate label -->
    {@const labelX = hoverLon > 120 ? hoverLon - 5 : hoverLon + 5}
    {@const labelAnchor = hoverLon > 120 ? 'end' : 'start'}
    {@const labelY = -hoverLat < -60 ? -hoverLat + 8 : -hoverLat - 4}
    <text
      x={labelX}
      y={labelY}
      text-anchor={labelAnchor}
      class="text-[5px] fill-white"
      style="text-shadow: 0 0 3px rgba(0,0,0,0.8);"
    >
      {formatCoord(hoverLat, hoverLon)}
    </text>
  {/if}

  <!-- Selected position marker -->
  <circle cx={longitude} cy={-latitude} r="2.5" fill="none" stroke="rgb(234, 88, 12)" stroke-width="0.8" />
  <circle cx={longitude} cy={-latitude} r="0.8" fill="rgb(234, 88, 12)" />

  <!-- Time label -->
  <text
    x={176}
    y={-84}
    text-anchor="end"
    class="text-[5px] fill-white"
    fill-opacity="0.6"
  >
    {timeLabel}
  </text>
</svg>
