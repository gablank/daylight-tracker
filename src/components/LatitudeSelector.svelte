<script>
  import { PRESET_LOCATION_GROUPS, PRESET_LOCATIONS, TIMEZONE_GROUPS, getLocalTimezone } from '../lib/utils.js';
  
  let { 
    latitude = $bindable(59.9), 
    longitude = $bindable(10.7),
    timezone = $bindable('Europe/Oslo'), 
    onchange 
  } = $props();
  
  let isLocating = $state(false);
  let locationError = $state('');
  
  function handleLatitudeInput(e) {
    const value = parseFloat(e.target.value);
    if (!isNaN(value) && value >= -90 && value <= 90) {
      latitude = value;
      onchange?.({ latitude, longitude, timezone });
    }
  }
  
  function handleLongitudeInput(e) {
    const value = parseFloat(e.target.value);
    if (!isNaN(value) && value >= -180 && value <= 180) {
      longitude = value;
      onchange?.({ latitude, longitude, timezone });
    }
  }
  
  function handlePresetChange(e) {
    const value = e.target.value;
    if (value === '') return;
    
    const preset = PRESET_LOCATIONS.find(p => p.name === value);
    if (preset) {
      latitude = preset.latitude;
      longitude = preset.longitude ?? 0;
      timezone = preset.timezone;
      onchange?.({ latitude, longitude, timezone });
    }
  }
  
  function handleTimezoneChange(e) {
    timezone = e.target.value;
    onchange?.({ latitude, longitude, timezone });
  }
  
  async function useMyLocation() {
    if (!navigator.geolocation) {
      locationError = 'Geolocation is not supported by your browser';
      return;
    }
    
    isLocating = true;
    locationError = '';
    
    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 300000
        });
      });
      
      latitude = Math.round(position.coords.latitude * 10) / 10;
      longitude = Math.round(position.coords.longitude * 10) / 10;
      timezone = getLocalTimezone();
      onchange?.({ latitude, longitude, timezone });
    } catch (err) {
      switch (err.code) {
        case err.PERMISSION_DENIED:
          locationError = 'Location permission denied';
          break;
        case err.POSITION_UNAVAILABLE:
          locationError = 'Location information unavailable';
          break;
        case err.TIMEOUT:
          locationError = 'Location request timed out';
          break;
        default:
          locationError = 'An error occurred getting location';
      }
    } finally {
      isLocating = false;
    }
  }
  
  // Find current preset (if any); latitudeOnly presets match by latitude only
  let currentPreset = $derived(
    PRESET_LOCATIONS.find(p =>
      Math.abs(p.latitude - latitude) < 0.1 &&
      (p.latitudeOnly || Math.abs((p.longitude ?? 0) - longitude) < 0.1)
    )?.name || ''
  );
</script>

<div>
  <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Location</h3>
  
  <div class="flex flex-col gap-3">
    <!-- Grid layout for aligned inputs -->
    <div class="grid grid-cols-[80px_1fr] gap-2 items-center">
      <label for="latitude" class="text-sm text-gray-600 dark:text-gray-400">Latitude:</label>
      <div class="flex items-center gap-2">
        <input
          type="number"
          id="latitude"
          value={latitude}
          oninput={handleLatitudeInput}
          min="-90"
          max="90"
          step="0.1"
          class="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <span class="text-sm text-gray-500 dark:text-gray-400 w-4">°</span>
      </div>
    </div>
    
    <div class="grid grid-cols-[80px_1fr] gap-2 items-center">
      <label for="longitude" class="text-sm text-gray-600 dark:text-gray-400">Longitude:</label>
      <div class="flex items-center gap-2">
        <input
          type="number"
          id="longitude"
          value={longitude}
          oninput={handleLongitudeInput}
          min="-180"
          max="180"
          step="0.1"
          class="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <span class="text-sm text-gray-500 dark:text-gray-400 w-4">°</span>
      </div>
    </div>
    
    <div class="grid grid-cols-[80px_1fr] gap-2 items-center">
      <label for="preset" class="text-sm text-gray-600 dark:text-gray-400">Preset:</label>
      <select
        id="preset"
        value={currentPreset}
        onchange={handlePresetChange}
        class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
               bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
               focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">Select a location...</option>
        {#each PRESET_LOCATION_GROUPS as group}
          <optgroup label={group.label}>
            {#each group.locations as preset}
              <option value={preset.name}>
                {preset.name} ({preset.latitude > 0 ? '+' : ''}{preset.latitude}°)
              </option>
            {/each}
          </optgroup>
        {/each}
      </select>
    </div>
    
    <div class="grid grid-cols-[80px_1fr] gap-2 items-center">
      <label for="timezone" class="text-sm text-gray-600 dark:text-gray-400">Timezone:</label>
      <select
        id="timezone"
        value={timezone}
        onchange={handleTimezoneChange}
        class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
               bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
               focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {#each TIMEZONE_GROUPS as group}
          <optgroup label={group.label}>
            {#each group.timezones as tz}
              <option value={tz.name}>
                {tz.name.replace(/_/g, ' ')} ({tz.offset})
              </option>
            {/each}
          </optgroup>
        {/each}
      </select>
    </div>
    
    <!-- Use my location button -->
    <button
      onclick={useMyLocation}
      disabled={isLocating}
      class="flex items-center justify-center gap-2 px-4 py-2 mt-1
             bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400
             text-white font-medium rounded-md transition-colors
             focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
    >
      {#if isLocating}
        <svg class="animate-spin h-4 w-4" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <span>Getting location...</span>
      {:else}
        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span>Use my location</span>
      {/if}
    </button>
    
    {#if locationError}
      <p class="text-sm text-red-600 dark:text-red-400">{locationError}</p>
    {/if}
    
    <!-- Latitude info -->
    <p class="text-xs text-gray-500 dark:text-gray-400">
      {#if latitude > 66.5}
        Arctic region — expect polar day/night periods
      {:else if latitude < -66.5}
        Antarctic region — expect polar day/night periods
      {:else if latitude > 0}
        Northern Hemisphere
      {:else if latitude < 0}
        Southern Hemisphere
      {:else}
        Equator — nearly equal day and night year-round
      {/if}
    </p>
  </div>
</div>
