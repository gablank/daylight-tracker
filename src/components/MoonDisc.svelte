<script>
  import { getMoonPhase, getMoonOrientation } from '../lib/moon.js';

  /** The moon's lit shape at an instant, rotated the way the observer sees it */
  let { instant, latitude, longitude, class: className = 'h-24 w-24' } = $props();

  let phase = $derived(getMoonPhase(instant));
  let orientation = $derived(getMoonOrientation(instant, latitude, longitude));

  // Moon disc drawn with the lit limb on the right; the terminator is a half-ellipse whose
  // width follows the illuminated fraction. The whole shape is then rotated so the lit limb
  // points where the observer sees it (SVG rotation is clockwise, the zenith angle is not).
  const R = 40;
  let litPath = $derived.by(() => {
    const rx = Math.abs(1 - 2 * phase.fraction) * R;
    const terminatorSweep = phase.fraction < 0.5 ? 0 : 1;
    return `M 0 ${-R} A ${R} ${R} 0 0 1 0 ${R} A ${rx} ${R} 0 0 ${terminatorSweep} 0 ${-R} Z`;
  });
  let litRotation = $derived(-orientation.zenithAngle - 90);
</script>

<svg viewBox="-44 -44 88 88" class="shrink-0 {className}" role="img" aria-label="{phase.name}, {Math.round(phase.fraction * 100)}% illuminated">
  <circle r={R} class="fill-gray-300 dark:fill-gray-700" />
  <path d={litPath} class="fill-amber-50" transform="rotate({litRotation})" />
  <circle r={R} fill="none" class="stroke-gray-400 dark:stroke-gray-500" stroke-width="1" />
</svg>
