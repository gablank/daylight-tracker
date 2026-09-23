<script>
  import { getMoonPhase, getMoonRiseSet, findNextMoonPhases } from '../lib/moon.js';
  import { formatDateShort } from '../lib/solar.js';
  import { dateAtLocalInTimezone, formatTimeInTimezone, calendarDateInTimezone } from '../lib/utils.js';
  import SectionLink from './SectionLink.svelte';

  let { selectedDate, latitude, longitude, timezone, onDateSelect = null } = $props();

  // Phase and upcoming phases are taken from noon on the selected day, in the location's timezone
  let noon = $derived(dateAtLocalInTimezone(selectedDate.getFullYear(), selectedDate.getMonth() + 1, selectedDate.getDate(), 12, 0, timezone));
  let phase = $derived(getMoonPhase(noon));
  let riseSet = $derived(getMoonRiseSet(selectedDate, latitude, longitude, timezone));
  let nextPhases = $derived(
    findNextMoonPhases(noon).map((p) => ({ ...p, day: calendarDateInTimezone(p.date, timezone) }))
  );

  // Moon disc: the lit limb is on the right while waxing (seen from the northern hemisphere);
  // the terminator is a half-ellipse whose width follows the phase. Mirrored in the south.
  const R = 40;
  let litPath = $derived.by(() => {
    const p = phase.phase;
    const waxing = p < 0.5;
    const rx = Math.abs(Math.cos(2 * Math.PI * p)) * R;
    const limbSweep = waxing ? 1 : 0;
    const terminatorSweep = waxing ? (p < 0.25 ? 0 : 1) : (p < 0.75 ? 0 : 1);
    return `M 0 ${-R} A ${R} ${R} 0 0 ${limbSweep} 0 ${R} A ${rx} ${R} 0 0 ${terminatorSweep} 0 ${-R} Z`;
  });

  function formatRiseSet(time) {
    return time ? formatTimeInTimezone(time, timezone) : 'None today';
  }
</script>

<div class="h-full bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm flex flex-col">
  <div class="flex items-center gap-0.5 mb-3">
    <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300">Moon</h3>
    <SectionLink id="moon" />
  </div>

  <div class="flex flex-wrap items-center gap-6">
    <!-- Phase -->
    <div class="flex items-center gap-4">
      <svg viewBox="-44 -44 88 88" class="w-24 h-24 shrink-0" role="img" aria-label="{phase.name}, {Math.round(phase.fraction * 100)}% illuminated">
        <circle r={R} class="fill-gray-300 dark:fill-gray-700" />
        <path d={litPath} class="fill-amber-50" transform={latitude < 0 ? 'scale(-1, 1)' : ''} />
        <circle r={R} fill="none" class="stroke-gray-400 dark:stroke-gray-500" stroke-width="1" />
      </svg>
      <div>
        <p class="text-base font-semibold text-gray-900 dark:text-gray-100">{phase.name}</p>
        <p class="text-sm text-gray-600 dark:text-gray-400">{Math.round(phase.fraction * 100)}% illuminated</p>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">{formatDateShort(selectedDate)}, 12:00</p>
      </div>
    </div>

    <!-- Rise/set -->
    <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
      {#if riseSet.alwaysUp}
        <dt class="text-gray-600 dark:text-gray-400">Moon</dt>
        <dd class="font-medium text-gray-900 dark:text-gray-100">Up all day</dd>
      {:else if riseSet.alwaysDown}
        <dt class="text-gray-600 dark:text-gray-400">Moon</dt>
        <dd class="font-medium text-gray-900 dark:text-gray-100">Below the horizon all day</dd>
      {:else}
        <dt class="text-gray-600 dark:text-gray-400">Moonrise</dt>
        <dd class="font-medium text-gray-900 dark:text-gray-100">{formatRiseSet(riseSet.rise)}</dd>
        <dt class="text-gray-600 dark:text-gray-400">Moonset</dt>
        <dd class="font-medium text-gray-900 dark:text-gray-100">{formatRiseSet(riseSet.set)}</dd>
      {/if}
    </dl>
  </div>

  <!-- Upcoming primary phases -->
  <h4 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mt-5 mb-2">Next phases</h4>
  <table class="w-full text-sm">
    <tbody>
      {#each nextPhases as p}
        <tr class="border-b border-gray-100 dark:border-gray-700/50">
          <td class="py-1.5 pr-3 text-gray-900 dark:text-gray-100">{p.name}</td>
          <td class="py-1.5 text-gray-600 dark:text-gray-400">
            <button
              type="button"
              class="cursor-pointer hover:underline focus:outline-none focus:ring-2 focus:ring-orange-400 rounded px-0.5 -mx-0.5"
              onclick={() => onDateSelect?.(p.day)}
            >
              {formatDateShort(p.day)}
            </button>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
  <p class="text-[11px] text-gray-500 dark:text-gray-400 mt-2">Phase times are approximate (within a few hours).</p>
</div>
