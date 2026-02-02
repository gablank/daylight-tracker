<script>
  import { formatDateISO, parseDateISO, getToday } from '../lib/utils.js';
  import { getDayStatsForTooltip } from '../lib/solar.js';
  
  let { selectedDate = $bindable(getToday()), onchange, latitude = 0, longitude = 0, timezone = null } = $props();

  let showTooltip = $state(false);
  let tooltipX = $state(0);
  let tooltipY = $state(0);
  
  function handleDateChange(e) {
    const newDate = parseDateISO(e.target.value);
    selectedDate = newDate;
    onchange?.(selectedDate);
  }
  
  function setToday() {
    selectedDate = getToday();
    onchange?.(selectedDate);
  }
  
  let dateString = $derived(formatDateISO(selectedDate));
  let isToday = $derived(formatDateISO(selectedDate) === formatDateISO(getToday()));
  
  // Format date in user's locale
  let localeDateString = $derived(
    selectedDate 
      ? new Intl.DateTimeFormat(undefined, { 
          weekday: 'short',
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        }).format(selectedDate)
      : ''
  );
</script>

<div>
  <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Date</h3>
  
  <div class="flex flex-col gap-3">
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="flex items-center gap-2"
      role="group"
      aria-label="Select date"
      onmouseenter={(e) => { showTooltip = true; tooltipX = e.clientX; tooltipY = e.clientY; }}
      onmousemove={(e) => { tooltipX = e.clientX; tooltipY = e.clientY; }}
      onmouseleave={() => showTooltip = false}
    >
      <label for="date" class="text-sm text-gray-600 dark:text-gray-400 w-16">Date:</label>
      <input
        type="date"
        id="date"
        value={dateString}
        onchange={handleDateChange}
        class="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
               bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
               focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
    
    {#if localeDateString}
      <p class="text-sm text-gray-600 dark:text-gray-400 pl-[72px]">{localeDateString}</p>
    {/if}
    
    <button
      onclick={setToday}
      disabled={isToday}
      class="flex items-center justify-center gap-2 px-4 py-2 
             bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400
             dark:bg-gray-700 dark:hover:bg-gray-600 dark:disabled:bg-gray-800 dark:disabled:text-gray-500
             text-gray-700 dark:text-gray-200 font-medium rounded-md transition-colors
             focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
    >
      <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
      <span>Reset to today</span>
    </button>
  </div>
  {#if showTooltip && selectedDate}
    {@const stats = getDayStatsForTooltip(selectedDate, latitude, longitude, timezone)}
    <div
      class="fixed z-50 px-2 py-1.5 text-xs rounded shadow-lg bg-gray-800 text-gray-100 dark:bg-gray-700 dark:text-gray-200 pointer-events-none"
      style="left: {tooltipX + 12}px; top: {tooltipY + 8}px;"
    >
      <div class="font-medium">{stats.dateLabel}</div>
      <div>Sunrise: {stats.sunrise}</div>
      <div>Sunset: {stats.sunset}</div>
      <div>Daylight: {stats.daylight}</div>
    </div>
  {/if}
</div>
