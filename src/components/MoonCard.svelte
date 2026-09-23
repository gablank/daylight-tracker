<script>
  import { getMoonPhase, getMoonRiseSet, findNextMoonPhases, getMoonOrientation } from '../lib/moon.js';
  import { formatDateShort, timeOnDay } from '../lib/solar.js';
  import { dateAtLocalInTimezone, formatTimeInTimezone, calendarDateInTimezone } from '../lib/utils.js';
  import ChartCard from './ChartCard.svelte';
  import MoonDisc from './MoonDisc.svelte';

  let { selectedDate, latitude, longitude, timezone, displayHour = 12, onDateSelect = null } = $props();

  // Phase and orientation are shown at the selected hour; upcoming phases are searched from noon
  let instant = $derived(timeOnDay(selectedDate, displayHour ?? 12, timezone));
  let noon = $derived(dateAtLocalInTimezone(selectedDate.getFullYear(), selectedDate.getMonth() + 1, selectedDate.getDate(), 12, 0, timezone));
  let phase = $derived(getMoonPhase(instant));
  let orientation = $derived(getMoonOrientation(instant, latitude, longitude));
  let riseSet = $derived(getMoonRiseSet(selectedDate, latitude, longitude, timezone));
  let nextPhases = $derived(
    findNextMoonPhases(noon).map((p) => ({ ...p, day: calendarDateInTimezone(p.date, timezone) }))
  );

  function formatRiseSet(time) {
    return time ? formatTimeInTimezone(time, timezone) : 'None today';
  }
</script>

<ChartCard id="moon" title="Moon" subtitle="Phase and rise/set times, drawn as it looks from here at the selected time." class="h-full">

  <div class="flex flex-wrap items-center gap-6">
    <!-- Phase -->
    <div class="flex items-center gap-4">
      <MoonDisc {instant} {latitude} {longitude} />
      <div>
        <p class="text-base font-semibold text-gray-900 dark:text-gray-100">{phase.name}</p>
        <p class="text-sm text-gray-600 dark:text-gray-400">{Math.round(phase.fraction * 100)}% illuminated</p>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">{formatDateShort(selectedDate)}, {formatTimeInTimezone(instant, timezone)}</p>
        {#if orientation.altitude < 0}
          <p class="text-xs text-gray-500 dark:text-gray-400">Below the horizon</p>
        {/if}
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
</ChartCard>
