<script>
  import { tick, untrack } from 'svelte';
  import Popover from './Popover.svelte';
  import { addDays, addMonths, isSameDay, getToday, formatDateISO, calendarDateInTimezone } from '../lib/utils.js';
  import {
    computeYearData, getDayOfYear, getDayStatsForTooltip, formatDateShort,
    getMarchEquinox, getSummerSolstice, getSeptemberEquinox, getWinterSolstice
  } from '../lib/solar.js';

  let {
    selectedDate = $bindable(getToday()),
    latitude = 0,
    longitude = 0,
    timezone = null,
    oppositeDate = null,
    open = $bindable(false)
  } = $props();

  const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);

  let viewMonth = $state(startOfMonth(getToday()));
  let focusedDate = $state(getToday());
  let hoveredDay = $state(null);
  let gridEl = $state();

  // Each time the calendar opens, show the selected date's month
  $effect(() => {
    if (!open) return;
    untrack(() => {
      viewMonth = startOfMonth(selectedDate);
      focusedDate = selectedDate;
      hoveredDay = null;
    });
  });

  let isToday = $derived(isSameDay(selectedDate, getToday()));

  const longLabel = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const shortLabel = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  const monthLabel = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' });
  const dayLabel = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  // First day of the week from the browser locale (0 = Sunday); Monday if unknown
  const weekStart = (() => {
    try {
      const locale = new Intl.Locale(navigator.language);
      const info = locale.getWeekInfo?.() ?? locale.weekInfo;
      if (info?.firstDay) return info.firstDay % 7;
    } catch {
      // Intl.Locale unsupported
    }
    return 1;
  })();

  const weekdayFormat = new Intl.DateTimeFormat(undefined, { weekday: 'short' });
  // 2023-01-01 was a Sunday
  const weekdays = Array.from({ length: 7 }, (_, i) => weekdayFormat.format(new Date(2023, 0, 1 + ((weekStart + i) % 7))));

  // Always six weeks so the popover doesn't change height between months
  let days = $derived.by(() => {
    const offset = (viewMonth.getDay() - weekStart + 7) % 7;
    const start = addDays(viewMonth, -offset);
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  });

  function daylightFraction(date) {
    const day = computeYearData(latitude, date.getFullYear())[getDayOfYear(date) - 1];
    return day ? day.daylightHours / 24 : 0;
  }

  let inView = (d) => d.getFullYear() === viewMonth.getFullYear() && d.getMonth() === viewMonth.getMonth();
  // The one cell reachable with Tab (roving tabindex)
  let tabbableIso = $derived(formatDateISO(inView(focusedDate) ? focusedDate : viewMonth));

  let previewDay = $derived(hoveredDay ?? focusedDate);
  let previewStats = $derived(getDayStatsForTooltip(previewDay, latitude, longitude, timezone));

  // Next equinox/solstice after the selected date, as calendar days at the location
  let quickJumps = $derived.by(() => {
    const year = selectedDate.getFullYear();
    const next = (fns) => {
      for (const y of [year, year + 1]) {
        for (const fn of fns) {
          const d = calendarDateInTimezone(fn(y), timezone);
          if (d > selectedDate) return d;
        }
      }
      return null;
    };
    return [
      { label: 'Equinox', date: next([getMarchEquinox, getSeptemberEquinox]), title: 'Next equinox' },
      { label: 'Solstice', date: next([getSummerSolstice, getWinterSolstice]), title: 'Next solstice' },
      oppositeDate && { label: 'Mirror', date: oppositeDate.date, title: 'Mirror date: same amount of daylight on the other side of the solstice' }
    ].filter((j) => j?.date);
  });

  function select(date, close) {
    selectedDate = date;
    close?.();
  }

  async function moveFocus(date) {
    focusedDate = date;
    if (!inView(date)) viewMonth = startOfMonth(date);
    await tick();
    gridEl?.querySelector(`[data-date="${formatDateISO(date)}"]`)?.focus();
  }

  function handleGridKeydown(e) {
    const steps = {
      ArrowLeft: () => addDays(focusedDate, -1),
      ArrowRight: () => addDays(focusedDate, 1),
      ArrowUp: () => addDays(focusedDate, -7),
      ArrowDown: () => addDays(focusedDate, 7),
      PageUp: () => addMonths(focusedDate, e.shiftKey ? -12 : -1),
      PageDown: () => addMonths(focusedDate, e.shiftKey ? 12 : 1),
      Home: () => addDays(focusedDate, -((focusedDate.getDay() - weekStart + 7) % 7)),
      End: () => addDays(focusedDate, 6 - ((focusedDate.getDay() - weekStart + 7) % 7))
    };
    const step = steps[e.key];
    if (!step) return;
    e.preventDefault();
    moveFocus(step());
  }

  const stepButtonClass = `flex h-full items-center px-1.5 text-gray-500 dark:text-gray-400
    hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100 transition-colors
    focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500`;
</script>

<div class="flex shrink-0 items-center gap-2">
  <div class="flex h-[34px] items-stretch rounded-lg border {open ? 'border-blue-500' : 'border-gray-300 dark:border-gray-600'}">
    <button type="button" class="{stepButtonClass} rounded-l-lg" onclick={() => selectedDate = addDays(selectedDate, -1)} aria-label="Previous day" title="Previous day (↓)">
      <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
      </svg>
    </button>
    <Popover bind:open label="Choose date" panelClass="sm:w-80">
      {#snippet trigger()}
        <button
          type="button"
          class="h-full border-x px-2.5 text-sm font-medium tabular-nums transition-colors
                 {open
                   ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                   : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'}
                 text-gray-900 dark:text-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
          onclick={() => open = !open}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label="Selected date: {dayLabel.format(selectedDate)}. Change date"
          title="Change date (D)"
        >
          <span class="hidden sm:inline">{longLabel.format(selectedDate)}</span>
          <span class="sm:hidden">{shortLabel.format(selectedDate)}</span>
        </button>
      {/snippet}

      {#snippet children({ close })}
        <div class="p-3">
          <!-- Month navigation -->
          <div class="mb-2 flex items-center justify-between">
            <button type="button" class="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700" onclick={() => viewMonth = addMonths(viewMonth, -1)} aria-label="Previous month">
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span class="text-sm font-semibold text-gray-900 dark:text-gray-100" aria-live="polite">{monthLabel.format(viewMonth)}</span>
            <button type="button" class="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700" onclick={() => viewMonth = addMonths(viewMonth, 1)} aria-label="Next month">
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <!-- Day grid, each day shaded by its hours of daylight -->
          <div class="grid grid-cols-7 gap-0.5 text-center" aria-hidden="true">
            {#each weekdays as wd}
              <span class="pb-1 text-[11px] font-medium text-gray-400 dark:text-gray-500">{wd}</span>
            {/each}
          </div>
          <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
          <div
            class="grid grid-cols-7 gap-0.5"
            role="group"
            aria-label={monthLabel.format(viewMonth)}
            bind:this={gridEl}
            onkeydown={handleGridKeydown}
            onmouseleave={() => hoveredDay = null}
          >
            {#each days as day (formatDateISO(day))}
              {@const iso = formatDateISO(day)}
              {@const selected = isSameDay(day, selectedDate)}
              {@const today = isSameDay(day, getToday())}
              <button
                type="button"
                data-date={iso}
                data-autofocus={iso === tabbableIso ? true : undefined}
                tabindex={iso === tabbableIso ? 0 : -1}
                aria-label={dayLabel.format(day)}
                aria-pressed={selected}
                class="relative flex aspect-square items-center justify-center rounded-md text-sm tabular-nums transition-shadow
                       focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
                       {selected ? 'ring-2 ring-blue-600 dark:ring-blue-400 font-semibold' : 'hover:ring-1 hover:ring-gray-400 dark:hover:ring-gray-500'}
                       {inView(day) ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500 opacity-60'}"
                style="background-color: rgb(245 158 11 / {(0.05 + 0.6 * daylightFraction(day)).toFixed(3)})"
                onclick={() => select(day, close)}
                onmouseenter={() => hoveredDay = day}
                onfocus={() => focusedDate = day}
              >
                {day.getDate()}
                {#if today}
                  <span class="absolute bottom-1 h-1 w-1 rounded-full bg-blue-600 dark:bg-blue-400" aria-hidden="true"></span>
                {/if}
              </button>
            {/each}
          </div>

          <!-- Preview of the hovered/focused day -->
          <div class="mt-3 flex items-center justify-between gap-2 rounded-md bg-gray-50 dark:bg-gray-900/50 px-2.5 py-1.5 text-xs text-gray-600 dark:text-gray-300" aria-live="polite">
            <span class="font-medium text-gray-900 dark:text-gray-100">{previewStats.dateLabel}</span>
            {#if previewStats.isPolarDay}
              <span>Midnight sun</span>
            {:else if previewStats.isPolarNight}
              <span>Polar night</span>
            {:else}
              <span class="tabular-nums">↑ {previewStats.sunrise} · ↓ {previewStats.sunset}</span>
            {/if}
            <span class="tabular-nums font-medium">{previewStats.daylight}</span>
          </div>
        </div>

        <!-- Quick jumps -->
        <div class="flex flex-wrap gap-1.5 border-t border-gray-200 dark:border-gray-700 px-3 py-2.5">
          <button
            type="button"
            disabled={isToday}
            class="rounded-full border border-gray-300 dark:border-gray-600 px-2.5 py-1 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:hover:bg-transparent"
            onclick={() => select(getToday(), close)}
          >Today</button>
          {#each quickJumps as jump}
            <button
              type="button"
              class="rounded-full border border-gray-300 dark:border-gray-600 px-2.5 py-1 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
              title={jump.title}
              onclick={() => select(jump.date, close)}
            >
              <span class="font-medium">{jump.label}</span>
              <span class="text-gray-500 dark:text-gray-400">{formatDateShort(jump.date)}</span>
            </button>
          {/each}
        </div>
      {/snippet}
    </Popover>
    <button type="button" class="{stepButtonClass} rounded-r-lg" onclick={() => selectedDate = addDays(selectedDate, 1)} aria-label="Next day" title="Next day (↑)">
      <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
      </svg>
    </button>
  </div>
  {#if !isToday}
    <button
      type="button"
      class="rounded-lg px-2.5 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30
             focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      onclick={() => selectedDate = getToday()}
      title="Jump to today (T)"
    >Today</button>
  {/if}
</div>
