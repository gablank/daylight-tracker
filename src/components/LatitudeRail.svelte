<script>
  import { formatLatitude } from '../lib/utils.js';

  let { latitude = $bindable(59.9) } = $props();

  const MARKS = [
    { lat: -66.5, label: 'Antarctic Circle' },
    { lat: -23.4, label: 'Tropic of Capricorn' },
    { lat: 0, label: 'Equator' },
    { lat: 23.4, label: 'Tropic of Cancer' },
    { lat: 66.5, label: 'Arctic Circle' }
  ];

  // Percentage along the track; the track is inset by half the thumb width so it lines up with the thumb's centre
  const pct = (lat) => ((lat + 90) / 180) * 100;

  // Polar / temperate / tropical bands with hard edges at the circles and tropics
  const polar = 'rgb(147 197 253 / 0.7)';
  const temperate = 'rgb(156 163 175 / 0.35)';
  const tropical = 'rgb(252 211 77 / 0.8)';
  const bands = [
    [polar, -90, -66.5], [temperate, -66.5, -23.4], [tropical, -23.4, 23.4], [temperate, 23.4, 66.5], [polar, 66.5, 90]
  ];
  const trackGradient = `linear-gradient(to right, ${bands.map(([c, a, b]) => `${c} ${pct(a)}% ${pct(b)}%`).join(', ')})`;
</script>

<div class="flex items-center gap-3">
  <label for="lat-rail" class="shrink-0 text-xs text-gray-500 dark:text-gray-400" title="← → to adjust (Shift for 5°)">Latitude</label>
  <div class="relative flex-1 min-w-0">
    <div class="relative h-5">
      <!-- Track -->
      <div class="pointer-events-none absolute inset-x-2 top-1/2 h-1.5 -translate-y-1/2 rounded-full" style="background: {trackGradient}"></div>
      <!-- Ticks at the tropics, circles and equator -->
      <div class="pointer-events-none absolute inset-x-2 inset-y-0">
        {#each MARKS as mark}
          <span class="absolute top-1/2 h-3 w-px -translate-y-1/2 bg-gray-400 dark:bg-gray-500" style="left: {pct(mark.lat)}%"></span>
        {/each}
      </div>
      <input
        type="range"
        id="lat-rail"
        min="-90"
        max="90"
        step="0.5"
        bind:value={latitude}
        aria-valuetext={formatLatitude(latitude)}
        class="rail absolute inset-0 h-full w-full"
      />
    </div>
    <!-- Labels (hidden when too narrow to read) -->
    <div class="pointer-events-none relative mx-2 hidden h-3.5 md:block" aria-hidden="true">
      {#each MARKS as mark}
        <span class="absolute -translate-x-1/2 whitespace-nowrap text-[10px] leading-none text-gray-400 dark:text-gray-500" style="left: {pct(mark.lat)}%">{mark.label}</span>
      {/each}
    </div>
  </div>
  <span class="w-12 shrink-0 text-right text-xs font-semibold tabular-nums text-gray-800 dark:text-gray-200">{formatLatitude(latitude)}</span>
</div>

<style>
  .rail {
    appearance: none;
    background: transparent;
    cursor: pointer;
    margin: 0;
  }
  .rail:focus {
    outline: none;
  }
  .rail::-webkit-slider-runnable-track {
    height: 100%;
    background: transparent;
  }
  .rail::-moz-range-track {
    background: transparent;
  }
  .rail::-webkit-slider-thumb {
    appearance: none;
    width: 16px;
    height: 16px;
    margin-top: 2px;
    border-radius: 9999px;
    background: white;
    border: 2px solid #2563eb;
    box-shadow: 0 1px 3px rgb(0 0 0 / 0.3);
    transition: transform 0.1s;
  }
  .rail::-moz-range-thumb {
    width: 12px;
    height: 12px;
    border-radius: 9999px;
    background: white;
    border: 2px solid #2563eb;
    box-shadow: 0 1px 3px rgb(0 0 0 / 0.3);
  }
  .rail:active::-webkit-slider-thumb {
    transform: scale(1.15);
  }
  .rail:focus-visible::-webkit-slider-thumb {
    box-shadow: 0 0 0 3px rgb(59 130 246 / 0.5);
  }
  .rail:focus-visible::-moz-range-thumb {
    box-shadow: 0 0 0 3px rgb(59 130 246 / 0.5);
  }
</style>
