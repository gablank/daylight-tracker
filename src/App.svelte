<script>
  import { computeYearData, getSunData, findOppositeDate, formatDateShort, formatDuration } from './lib/solar.js';
  import { getToday, getLocalTimezone, formatTimeInTimezone, formatDateISO } from './lib/utils.js';
  
  import LatitudeSelector from './components/LatitudeSelector.svelte';
  import DatePicker from './components/DatePicker.svelte';
  import YearGraph from './components/YearGraph.svelte';
  import DaylightChart from './components/DaylightChart.svelte';
  import SunPathChart from './components/SunPathChart.svelte';
  import SunAzimuthChart from './components/SunAzimuthChart.svelte';
  import TwilightChart from './components/TwilightChart.svelte';
  import StatsTable from './components/StatsTable.svelte';
  import UpcomingDates from './components/UpcomingDates.svelte';
  
  const STORAGE_KEY = 'daylight-tracker-settings';
  
  // State - Default to Oslo
  let latitude = $state(59.9);
  let longitude = $state(10.7);
  let timezone = $state('Europe/Oslo');
  let selectedDate = $state(getToday());
  let derivativeCount = $state(1);
  let settingsExpanded = $state(true);
  let settingsLoaded = $state(false);
  
  // Global hover state - shared across YearGraph, DaylightChart, and other components
  let globalHoveredDate = $state(null);
  // Shared hour state between SunAzimuthChart and SunPathChart
  let globalHoveredHour = $state(null);
  let sunAzimuthSelectedHour = $state(12);
  
  // Load settings from localStorage on mount (selectedDate always defaults to today)
  $effect(() => {
    if (settingsLoaded) return;
    
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const settings = JSON.parse(stored);
        if (settings.latitude !== undefined) latitude = settings.latitude;
        if (settings.longitude !== undefined) longitude = settings.longitude;
        if (settings.timezone) timezone = settings.timezone;
        if (settings.derivativeCount !== undefined) derivativeCount = Math.max(1, Math.min(5, settings.derivativeCount));
        if (settings.settingsExpanded !== undefined) settingsExpanded = settings.settingsExpanded;
        // Note: selectedDate is NOT restored - always use current date on page load
        settingsLoaded = true;
      } catch {
        // Invalid stored settings, will use defaults
        settingsLoaded = true;
      }
    } else {
      // No stored settings - try geolocation
      settingsLoaded = true;
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            latitude = Math.round(position.coords.latitude * 10) / 10;
            longitude = Math.round(position.coords.longitude * 10) / 10;
            timezone = getLocalTimezone();
          },
          () => {
            // Silently fail, keep default
          },
          { enableHighAccuracy: false, timeout: 5000, maximumAge: 300000 }
        );
      }
    }
  });
  
  // Save settings when they change (excluding selectedDate)
  $effect(() => {
    if (!settingsLoaded) return;
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      latitude,
      longitude,
      timezone,
      derivativeCount,
      settingsExpanded
    }));
  });
  
  // Computed year data (recomputes when latitude or year changes)
  let yearData = $derived.by(() => {
    const year = selectedDate.getFullYear();
    return computeYearData(latitude, year);
  });
  
  // Current day's sun data (uses actual longitude for accurate times)
  let sunData = $derived(getSunData(selectedDate, latitude, longitude));
  
  // Mirror date: the date with the same amount of daylight on the other half of the year
  // Uses fixed latitude (45°) so the mirror date is consistent regardless of user location
  let oppositeDate = $derived(findOppositeDate(selectedDate));
  
  let isToday = $derived(formatDateISO(selectedDate) === formatDateISO(getToday()));
</script>

<div class="min-h-screen bg-gray-100 dark:bg-gray-900">
  <!-- Sticky bar: selected day summary + settings toggle -->
  <div
    class="sticky top-0 z-50 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm"
    role="banner"
  >
    <div class="max-w-7xl mx-auto px-4 py-3">
      <div class="flex flex-nowrap items-center justify-between gap-2 sm:gap-3 min-w-0">
        <div class="flex flex-wrap items-center gap-2 sm:gap-4 md:gap-6 min-w-0 flex-1">
          <h1 class="text-lg font-bold text-gray-900 dark:text-gray-100 shrink-0">
            Daylight Tracker
          </h1>
          {#if sunData}
            <div class="flex flex-wrap items-center gap-2 sm:gap-3 md:gap-5 text-sm min-w-0">
              <span class="font-medium text-gray-700 dark:text-gray-300 shrink-0">
                {formatDateShort(selectedDate)}
              </span>
              <!-- Sunrise: icon below md, "Sunrise" label from md when there's room -->
              <span
                class="flex items-center gap-1 shrink-0"
                title="Sunrise"
                aria-label="Sunrise: {sunData.isPolarNight ? '—' : sunData.isPolarDay ? 'Always up' : formatTimeInTimezone(sunData.sunrise, timezone)}"
              >
                <span class="md:hidden text-gray-500 dark:text-gray-400" aria-hidden="true">
                  <svg class="w-4 h-4 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                  </svg>
                </span>
                <span class="hidden md:inline text-gray-500 dark:text-gray-400">Sunrise</span>
                <span class="font-medium text-gray-900 dark:text-gray-100">
                  {#if sunData.isPolarNight}—
                  {:else if sunData.isPolarDay}Always up
                  {:else}{formatTimeInTimezone(sunData.sunrise, timezone)}{/if}
                </span>
              </span>
              <!-- Sunset: icon below md, "Sunset" label from md when there's room -->
              <span
                class="flex items-center gap-1 shrink-0"
                title="Sunset"
                aria-label="Sunset: {sunData.isPolarNight ? '—' : sunData.isPolarDay ? 'Never sets' : formatTimeInTimezone(sunData.sunset, timezone)}"
              >
                <span class="md:hidden text-gray-500 dark:text-gray-400" aria-hidden="true">
                  <svg class="w-4 h-4 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </span>
                <span class="hidden md:inline text-gray-500 dark:text-gray-400">Sunset</span>
                <span class="font-medium text-gray-900 dark:text-gray-100">
                  {#if sunData.isPolarNight}—
                  {:else if sunData.isPolarDay}Never sets
                  {:else}{formatTimeInTimezone(sunData.sunset, timezone)}{/if}
                </span>
              </span>
              <!-- Daylight: icon below md, "Daylight" label from md when there's room -->
              <span
                class="flex items-center gap-1 shrink-0"
                title="Daylight"
                aria-label="Daylight: {sunData.isPolarNight ? '0h 0m' : sunData.isPolarDay ? '24h 0m' : formatDuration(sunData.daylight)}"
              >
                <span class="md:hidden text-gray-500 dark:text-gray-400" aria-hidden="true">
                  <svg class="w-4 h-4 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </span>
                <span class="hidden md:inline text-gray-500 dark:text-gray-400">Daylight</span>
                <span class="font-medium text-gray-900 dark:text-gray-100">
                  {#if sunData.isPolarNight}0h 0m
                  {:else if sunData.isPolarDay}24h 0m
                  {:else}{formatDuration(sunData.daylight)}{/if}
                </span>
              </span>
            </div>
          {/if}
        </div>
        <button
          type="button"
          disabled={isToday}
          class="px-3 py-2 rounded-md text-sm font-medium bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 shrink-0"
          onclick={() => selectedDate = getToday()}
          aria-label={isToday ? 'Selected date is today' : 'Reset to today'}
        >
          Today
        </button>
        <button
          type="button"
          class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 shrink-0"
          onclick={() => settingsExpanded = !settingsExpanded}
          aria-expanded={settingsExpanded}
          aria-label={settingsExpanded ? 'Close settings' : 'Open settings'}
        >
          <svg class="w-5 h-5 shrink-0 transition-transform {settingsExpanded ? 'rotate-90' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span class="hidden md:inline">{settingsExpanded ? 'Close settings' : 'Settings'}</span>
        </button>
      </div>
    </div>
    <!-- Settings panel (collapsible, below bar when expanded) -->
    {#if settingsExpanded}
      <div class="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80 px-4 py-4">
        <div class="max-w-7xl mx-auto space-y-4">
          <LatitudeSelector bind:latitude bind:longitude bind:timezone />
          <hr class="border-gray-200 dark:border-gray-700" />
          <DatePicker bind:selectedDate {latitude} {longitude} {timezone} />
        </div>
      </div>
    {/if}
  </div>

  <div class="max-w-7xl mx-auto px-4 py-8">
    <!-- Row 1: Year overview | Daylight through the year + Twilight zones -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      <YearGraph 
        {selectedDate} 
        {yearData} 
        {oppositeDate} 
        {latitude} 
        {longitude} 
        {timezone} 
        hoveredDate={globalHoveredDate}
        onHoverDate={(date) => globalHoveredDate = date}
        onDateSelect={(date) => selectedDate = date}
      />
      <div class="flex flex-col gap-6 h-full">
        <div class="flex-1 min-h-0">
          <DaylightChart 
            bind:derivativeCount
            {yearData} 
            {selectedDate} 
            {latitude}
            {longitude}
            {timezone}
            hoveredDate={globalHoveredDate}
            onHoverDate={(date) => globalHoveredDate = date}
            onDateSelect={(date) => selectedDate = date}
          />
        </div>
        <div class="flex-1 min-h-0">
          <TwilightChart
            {yearData}
            {selectedDate}
            {latitude}
            {longitude}
            {timezone}
            {derivativeCount}
            hoveredDate={globalHoveredDate}
            onHoverDate={(date) => globalHoveredDate = date}
            onDateSelect={(date) => selectedDate = date}
          />
        </div>
      </div>
    </div>
    
    <!-- Row 2: Sun position by date | Sun path -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      <SunAzimuthChart
        {yearData}
        {selectedDate}
        {latitude}
        {longitude}
        {timezone}
        hoveredDate={globalHoveredDate}
        onHoverDate={(date) => globalHoveredDate = date}
        onDateSelect={(date) => selectedDate = date}
        hoveredHour={globalHoveredHour}
        onHoverHour={(h) => globalHoveredHour = h}
        bind:selectedHour={sunAzimuthSelectedHour}
      />
      <SunPathChart
        {selectedDate}
        {latitude}
        {longitude}
        {timezone}
        highlightHour={sunAzimuthSelectedHour}
        onHoverHour={(h) => globalHoveredHour = h}
      />
    </div>
    
    <!-- Bottom section: Stats and Upcoming Dates side by side -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <StatsTable {selectedDate} {yearData} {latitude} {longitude} {oppositeDate} {timezone} onDateSelect={(date) => selectedDate = date} onHoverDate={(date) => globalHoveredDate = date} />
      <UpcomingDates {selectedDate} {yearData} {latitude} {longitude} {timezone} onDateSelect={(date) => selectedDate = date} onHoverDate={(date) => globalHoveredDate = date} />
    </div>
    
    <!-- Footer -->
    <footer class="mt-12 text-center text-sm text-gray-500 dark:text-gray-400">
      <p>
        Calculations powered by <a href="https://github.com/mourner/suncalc" class="text-blue-600 dark:text-blue-400 hover:underline" target="_blank" rel="noopener">SunCalc</a>.
        Atmospheric refraction is included in sunrise/sunset times.
        <a href="THIRD-PARTY-LICENSES.md" class="text-blue-600 dark:text-blue-400 hover:underline" target="_blank" rel="noopener">Third-party licenses</a>.
      </p>
    </footer>
  </div>
</div>
