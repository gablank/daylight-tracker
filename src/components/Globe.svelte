<script module>
  import { geoArea } from 'd3-geo';
  import { WORLD_LAND_PATHS } from '../lib/world-land.js';

  // Rebuild GeoJSON from the equirectangular SVG paths (x = lon, y = -lat).
  // Rings are wound so d3 treats the smaller side as the interior.
  function landFromPaths(paths) {
    const polygons = [];
    for (const d of paths) {
      for (const sub of d.split('M').filter(Boolean)) {
        const nums = sub.replace(/[LZ]/g, ' ').trim().split(/\s+/).map(Number);
        const ring = [];
        for (let i = 0; i + 1 < nums.length; i += 2) ring.push([nums[i], -nums[i + 1]]);
        ring.push(ring[0]);
        if (geoArea({ type: 'Polygon', coordinates: [ring] }) > 2 * Math.PI) ring.reverse();
        polygons.push([ring]);
      }
    }
    return { type: 'MultiPolygon', coordinates: polygons };
  }

  const LAND = landFromPaths(WORLD_LAND_PATHS);
</script>

<script>
  import { untrack } from 'svelte';
  import { geoOrthographic, geoPath, geoGraticule, geoCircle, geoDistance, geoInterpolate } from 'd3-geo';
  import { timeOnDay, getSubsolarPoint } from '../lib/solar.js';

  let {
    latitude = $bindable(0),
    longitude = $bindable(0),
    selectedDate = new Date(),
    timezone = null,
    displayHour = 12
  } = $props();

  const SIZE = 400;
  const RADIUS = 190;
  // Night layers: sun below 0°, -6°, -12° and -18° lies within 90°, 84°, 78° and 72°
  // of the antisolar point. Stacked, they shade civil, nautical and astronomical
  // twilight progressively darker.
  const SHADE_RADII = [90, 84, 78, 72];

  const graticule = geoGraticule().step([30, 30])();

  // Globe center as [lon, lat]; follows the selected location
  let center = $state([longitude, latitude]);
  let svgEl = $state(null);
  let hover = $state(null);
  let drag = $state(null);
  let animationFrame = null;

  let projection = $derived(
    geoOrthographic()
      .scale(RADIUS)
      .translate([SIZE / 2, SIZE / 2])
      .rotate([-center[0], -center[1]])
  );
  let path = $derived(geoPath(projection));

  let sun = $derived(getSubsolarPoint(timeOnDay(selectedDate, displayHour ?? 12, timezone)));

  let shadePaths = $derived.by(() => {
    const antisolar = [sun.longitude + 180, -sun.latitude];
    return SHADE_RADII.map((r) => path(geoCircle().center(antisolar).radius(r)()));
  });

  function isVisible(lon, lat) {
    return geoDistance([lon, lat], center) < Math.PI / 2;
  }

  // Rotate to the selected location whenever it changes
  $effect(() => {
    const target = [longitude, latitude];
    untrack(() => rotateTo(target));
  });

  function rotateTo(target) {
    cancelAnimationFrame(animationFrame);
    const interpolate = geoInterpolate(center, target);
    const duration = 500;
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      center = interpolate(eased);
      if (t < 1) animationFrame = requestAnimationFrame(step);
    };
    animationFrame = requestAnimationFrame(step);
  }

  // Client coordinates → SVG viewBox coordinates
  function toSvg(event) {
    const rect = svgEl.getBoundingClientRect();
    return [
      (event.clientX - rect.left) * SIZE / rect.width,
      (event.clientY - rect.top) * SIZE / rect.height
    ];
  }

  function toLatLon(event) {
    const [x, y] = toSvg(event);
    if (Math.hypot(x - SIZE / 2, y - SIZE / 2) > RADIUS) return null;
    const [lon, lat] = projection.invert([x, y]);
    return { lat: Math.round(lat * 10) / 10, lon: Math.round(lon * 10) / 10 };
  }

  function handlePointerDown(event) {
    cancelAnimationFrame(animationFrame);
    const [x, y] = toSvg(event);
    drag = { x, y, center, moved: false };
    svgEl.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event) {
    if (!drag) {
      const pos = toLatLon(event);
      hover = pos;
      return;
    }
    const [x, y] = toSvg(event);
    const dx = x - drag.x;
    const dy = y - drag.y;
    if (Math.hypot(dx, dy) > 3) drag.moved = true;
    if (!drag.moved) return;
    // Degrees per SVG unit at the globe's center
    const k = 180 / (Math.PI * RADIUS);
    const lat = Math.max(-90, Math.min(90, drag.center[1] + dy * k));
    const lon = ((drag.center[0] - dx * k + 540) % 360) - 180;
    center = [lon, lat];
    hover = null;
  }

  function handlePointerUp(event) {
    if (drag && !drag.moved) {
      const pos = toLatLon(event);
      if (pos) {
        latitude = pos.lat;
        longitude = pos.lon;
      }
    }
    drag = null;
  }

  function formatCoord(lat, lon) {
    const latDir = lat >= 0 ? 'N' : 'S';
    const lonDir = lon >= 0 ? 'E' : 'W';
    return `${Math.abs(lat).toFixed(1)}°${latDir}, ${Math.abs(lon).toFixed(1)}°${lonDir}`;
  }

  let timeLabel = $derived.by(() => {
    const hr = displayHour ?? 12;
    const h = Math.floor(hr);
    const m = Math.round((hr - h) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  });

  let selectedPoint = $derived(isVisible(longitude, latitude) ? projection([longitude, latitude]) : null);
  let sunPoint = $derived(isVisible(sun.longitude, sun.latitude) ? projection([sun.longitude, sun.latitude]) : null);
  let hoverPoint = $derived(hover ? projection([hover.lon, hover.lat]) : null);
</script>

<div class="flex flex-col items-center gap-2">
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <svg
    bind:this={svgEl}
    viewBox="0 0 {SIZE} {SIZE}"
    class="w-full max-w-md select-none touch-none {drag?.moved ? 'cursor-grabbing' : 'cursor-crosshair'}"
    onpointerdown={handlePointerDown}
    onpointermove={handlePointerMove}
    onpointerup={handlePointerUp}
    onpointercancel={() => drag = null}
    onpointerleave={() => hover = null}
    role="img"
    aria-label="Globe. Drag to rotate, click to select a location."
  >
    <!-- Ocean -->
    <path d={path({ type: 'Sphere' })} fill="rgb(30, 58, 90)" />

    <!-- Grid lines -->
    <path d={path(graticule)} fill="none" stroke="white" stroke-opacity="0.1" stroke-width="0.6" />

    <!-- Land masses -->
    <path d={path(LAND)} fill="rgb(120, 140, 110)" stroke="rgb(90, 110, 80)" stroke-width="0.4" />

    <!-- Equator -->
    <path
      d={path({ type: 'LineString', coordinates: [[-180, 0], [-90, 0], [0, 0], [90, 0], [180, 0]] })}
      fill="none" stroke="white" stroke-opacity="0.2" stroke-width="0.8" stroke-dasharray="4 4"
    />

    <!-- Night and twilight -->
    {#each shadePaths as d}
      <path {d} fill="rgb(0, 0, 0)" fill-opacity="0.12" />
    {/each}

    <!-- Subsolar point -->
    {#if sunPoint}
      <circle cx={sunPoint[0]} cy={sunPoint[1]} r="5" fill="rgb(250, 204, 21)" stroke="white" stroke-width="1" />
    {/if}

    <!-- Hover marker -->
    {#if hoverPoint}
      <circle cx={hoverPoint[0]} cy={hoverPoint[1]} r="4" fill="var(--color-ink-muted)" fill-opacity="0.8" stroke="var(--color-halo)" stroke-width="1" />
    {/if}

    <!-- Selected position marker -->
    {#if selectedPoint}
      <circle cx={selectedPoint[0]} cy={selectedPoint[1]} r="5" fill="none" stroke="var(--color-ink)" stroke-width="1.6" />
      <circle cx={selectedPoint[0]} cy={selectedPoint[1]} r="1.6" fill="var(--color-ink)" />
    {/if}

    <!-- Globe outline -->
    <path d={path({ type: 'Sphere' })} fill="none" stroke="rgb(90, 110, 130)" stroke-width="1" />
  </svg>

  <div class="flex w-full max-w-md justify-between text-xs text-gray-500 dark:text-gray-400">
    <span>{hover ? formatCoord(hover.lat, hover.lon) : 'Drag to rotate'}</span>
    <span>{timeLabel}</span>
  </div>
</div>
