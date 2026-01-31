<script>
  import { formatDuration } from '../lib/solar.js';
  import { formatTimeInTimezone } from '../lib/utils.js';
  
  let { sunData, timezone = 'UTC' } = $props();
  
  function formatAngle(degrees) {
    if (degrees === null || degrees === undefined || isNaN(degrees)) return '--°';
    return `${degrees.toFixed(1)}°`;
  }
  
  // Format time using the selected timezone
  function formatTime(date) {
    return formatTimeInTimezone(date, timezone);
  }
</script>

<div class="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
  {#if sunData}
    <div class="flex flex-wrap items-center justify-between gap-4">
      <!-- Title -->
      <div class="flex items-center gap-2">
        <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300">Sun Today</h3>
        <span class="text-xs text-gray-500 dark:text-gray-400">
          ({timezone.replace(/_/g, ' ')})
        </span>
      </div>
      
      <!-- Stats in a horizontal row -->
      <div class="flex flex-wrap items-center gap-6">
        <!-- Sunrise -->
        <div class="flex items-center gap-2">
          <span class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Sunrise</span>
          <span class="text-base font-semibold text-gray-900 dark:text-gray-100">
            {#if sunData.isPolarNight}
              <span class="text-gray-400 dark:text-gray-500">--</span>
            {:else if sunData.isPolarDay}
              <span class="text-amber-500">Always up</span>
            {:else}
              {formatTime(sunData.sunrise)}
            {/if}
          </span>
        </div>
        
        <!-- Sunset -->
        <div class="flex items-center gap-2">
          <span class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Sunset</span>
          <span class="text-base font-semibold text-gray-900 dark:text-gray-100">
            {#if sunData.isPolarNight}
              <span class="text-gray-400 dark:text-gray-500">--</span>
            {:else if sunData.isPolarDay}
              <span class="text-amber-500">Never sets</span>
            {:else}
              {formatTime(sunData.sunset)}
            {/if}
          </span>
        </div>
        
        <!-- Daylight Duration -->
        <div class="flex items-center gap-2">
          <span class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Daylight</span>
          <span class="text-base font-semibold text-gray-900 dark:text-gray-100">
            {#if sunData.isPolarNight}
              <span class="text-blue-400">0h 0m</span>
            {:else if sunData.isPolarDay}
              <span class="text-amber-500">24h 0m</span>
            {:else}
              {formatDuration(sunData.daylight)}
            {/if}
          </span>
        </div>
        
        <!-- Solar Noon -->
        <div class="flex items-center gap-2">
          <span class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Solar Noon</span>
          <span class="text-base font-semibold text-gray-900 dark:text-gray-100">
            {formatTime(sunData.solarNoon)}
          </span>
        </div>
        
        <!-- Max Sun Angle -->
        <div class="flex items-center gap-2">
          <span class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Max Elevation</span>
          <span class="text-base font-semibold text-gray-900 dark:text-gray-100">
            {formatAngle(sunData.maxAltitude)}
            {#if sunData.maxAltitude < 0}
              <span class="text-xs font-normal text-gray-500 dark:text-gray-400">(below)</span>
            {/if}
          </span>
        </div>
      </div>
    </div>
    
    <!-- Polar condition indicator -->
    {#if sunData.isPolarDay}
      <div class="mt-3 p-2 bg-amber-50 dark:bg-amber-900/20 rounded-md">
        <p class="text-sm text-amber-700 dark:text-amber-300">
          <strong>Midnight Sun:</strong> The sun does not set today at this latitude.
        </p>
      </div>
    {:else if sunData.isPolarNight}
      <div class="mt-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-md">
        <p class="text-sm text-blue-700 dark:text-blue-300">
          <strong>Polar Night:</strong> The sun does not rise today at this latitude.
        </p>
      </div>
    {/if}
  {:else}
    <p class="text-gray-500 dark:text-gray-400">Loading sun data...</p>
  {/if}
</div>
