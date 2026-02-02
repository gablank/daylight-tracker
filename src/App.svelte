<script>
  import { computeYearData, getSunData, findOppositeDate } from './lib/solar.js';
  import { getToday, getLocalTimezone } from './lib/utils.js';
  
  import LatitudeSelector from './components/LatitudeSelector.svelte';
  import DatePicker from './components/DatePicker.svelte';
  import TodaySun from './components/TodaySun.svelte';
  import YearGraph from './components/YearGraph.svelte';
  import DaylightChart from './components/DaylightChart.svelte';
  import StatsTable from './components/StatsTable.svelte';
  import UpcomingDates from './components/UpcomingDates.svelte';
  
  const STORAGE_KEY = 'daylight-tracker-settings';
  
  // State - Default to Oslo
  let latitude = $state(59.9);
  let longitude = $state(10.7);
  let timezone = $state('Europe/Oslo');
  let selectedDate = $state(getToday());
  let settingsLoaded = $state(false);
  
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
      timezone
    }));
  });
  
  // Computed year data (recomputes when latitude or year changes)
  let yearData = $derived.by(() => {
    const year = selectedDate.getFullYear();
    return computeYearData(latitude, year);
  });
  
  // Current day's sun data (uses actual longitude for accurate times)
  let sunData = $derived(getSunData(selectedDate, latitude, longitude));
  
  // Opposite date (geometric calculation, latitude-independent)
  let oppositeDate = $derived(findOppositeDate(selectedDate));
</script>

<div class="min-h-screen bg-gray-100 dark:bg-gray-900 py-8 px-4">
  <div class="max-w-7xl mx-auto">
    <!-- Header -->
    <header class="text-center mb-8">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
        Daylight Tracker
      </h1>
      <p class="text-gray-600 dark:text-gray-400">
        Explore how daylight changes throughout the year at your location
      </p>
    </header>
    
    <!-- Sun Today (full width, horizontal) -->
    <div class="mb-6">
      <TodaySun {sunData} {timezone} />
    </div>
    
    <!-- Top section: Controls (1/3) + Graph (2/3) -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
      <!-- Left column: Combined Location & Date -->
      <div class="lg:col-span-1">
        <div class="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm space-y-4">
          <LatitudeSelector bind:latitude bind:longitude bind:timezone />
          <hr class="border-gray-200 dark:border-gray-700" />
          <DatePicker bind:selectedDate />
        </div>
      </div>
      
      <!-- Right column: Year Graph + Linear Chart (2/3 width) -->
      <div class="lg:col-span-2">
        <YearGraph 
          {selectedDate} 
          {yearData} 
          {oppositeDate} 
          {latitude} 
          onDateSelect={(date) => selectedDate = date}
        />
        <DaylightChart 
          {yearData} 
          {selectedDate} 
          onDateSelect={(date) => selectedDate = date}
        />
      </div>
    </div>
    
    <!-- Bottom section: Stats and Upcoming Dates side by side -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <StatsTable {selectedDate} {yearData} {latitude} {longitude} {oppositeDate} />
      <UpcomingDates {selectedDate} {yearData} {latitude} {longitude} {timezone} />
    </div>
    
    <!-- Footer -->
    <footer class="mt-12 text-center text-sm text-gray-500 dark:text-gray-400">
      <p>
        Calculations powered by <a href="https://github.com/mourner/suncalc" class="text-blue-600 dark:text-blue-400 hover:underline" target="_blank" rel="noopener">SunCalc</a>. 
        Atmospheric refraction is included in sunrise/sunset times.
      </p>
    </footer>
  </div>
</div>
