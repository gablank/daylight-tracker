<script>
  import { setContext } from 'svelte';
  import { computeYearData, getSunData, findOppositeDate, formatDuration, findUpcomingSunriseMilestones, findUpcomingSunsetMilestones, findUpcomingDSTChanges, findUpcomingDaylightMilestones } from './lib/solar.js';
  import { getToday, getLocalTimezone, formatTimeInTimezone, formatDateISO, parseDateISO, isValidTimezone } from './lib/utils.js';
  
  import LocationPicker from './components/LocationPicker.svelte';
  import DateControl from './components/DateControl.svelte';
  import LatitudeRail from './components/LatitudeRail.svelte';
  import AppMenu from './components/AppMenu.svelte';
  import YearGraph from './components/YearGraph.svelte';
  import YearStack from './components/YearStack.svelte';
  import SunPathChart from './components/SunPathChart.svelte';
  import SunAzimuthChart from './components/SunAzimuthChart.svelte';
  import WorldMap from './components/WorldMap.svelte';
  import Globe from './components/Globe.svelte';
  import SectionLink from './components/SectionLink.svelte';
  import StatsTable from './components/StatsTable.svelte';
  import UpcomingDates from './components/UpcomingDates.svelte';
  import MoonCard from './components/MoonCard.svelte';
  import CompareCard from './components/CompareCard.svelte';
  import ChartCard from './components/ChartCard.svelte';
  import Chapter from './components/Chapter.svelte';
  import DayHero from './components/DayHero.svelte';
  
  const STORAGE_KEY = 'daylight-tracker-settings';
  
  // Parse URL params (for deep linking / sharing)
  const initParams = new URLSearchParams(window.location.search);
  const urlHasState = initParams.has('lat') || initParams.has('lon') || initParams.has('tz') || initParams.has('date');
  let soloSection = $state(initParams.get('view'));
  // A shared link shows someone else's settings — don't let it overwrite the visitor's saved ones
  const openedFromSharedLink = urlHasState || initParams.has('view');
  
  // State - Default to Oslo
  let latitude = $state(59.9);
  let longitude = $state(10.7);
  let timezone = $state('Europe/Oslo');
  let selectedDate = $state(getToday());
  // Which header popover is open: 'location', 'date', 'menu' or null
  let openPopover = $state(null);
  let mapExpanded = $state(true);
  let mapView = $state('map'); // 'map' or 'globe'
  let compareName = $state(null); // preset name of the location to compare with
  let settingsLoaded = $state(false);
  
  // Global hover state - shared across YearGraph, the year charts, and other components
  let globalHoveredDate = $state(null);
  // Shared hour state between SunAzimuthChart and SunPathChart
  let globalHoveredHour = $state(null);
  let sunAzimuthSelectedHour = $state(12);
  
  // Load settings: URL params (highest priority) > localStorage > geolocation > defaults
  $effect(() => {
    if (settingsLoaded) return;

    // Stored settings are the base; URL params (if any) override individual values below
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const settings = JSON.parse(stored);
        if (settings.latitude !== undefined) latitude = settings.latitude;
        if (settings.longitude !== undefined) longitude = settings.longitude;
        if (isValidTimezone(settings.timezone)) timezone = settings.timezone;
        if (settings.mapExpanded !== undefined) mapExpanded = settings.mapExpanded;
        if (settings.mapView === 'map' || settings.mapView === 'globe') mapView = settings.mapView;
        if (typeof settings.compareName === 'string') compareName = settings.compareName;
        // Note: selectedDate is NOT restored - always use current date on page load
      } catch {
        // Invalid stored settings, will use defaults
      }
    }

    if (openedFromSharedLink) {
      // Shared link: its params override stored settings
      const lat = parseFloat(initParams.get('lat'));
      const lon = parseFloat(initParams.get('lon'));
      const tz = initParams.get('tz');
      const dateStr = initParams.get('date');
      if (!isNaN(lat) && lat >= -90 && lat <= 90) latitude = lat;
      if (!isNaN(lon) && lon >= -180 && lon <= 180) longitude = lon;
      if (isValidTimezone(tz)) timezone = tz;
      if (dateStr) {
        const d = parseDateISO(dateStr);
        if (d && !isNaN(d.getTime())) selectedDate = d;
      }
      settingsLoaded = true;
    } else {
      settingsLoaded = true;
      if (!stored) {
        // No stored settings - try geolocation
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
    }
  });
  
  // Save settings when they change (excluding selectedDate)
  $effect(() => {
    if (!settingsLoaded || openedFromSharedLink) return;
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      latitude,
      longitude,
      timezone,
      mapExpanded,
      mapView,
      compareName
    }));
  });
  
  // Share-URL builder (provided to SectionLink components via context)
  setContext('getShareUrl', (sectionId, solo) => {
    const url = new URL(window.location.href);
    url.search = '';
    url.hash = '';
    url.searchParams.set('lat', latitude.toFixed(1));
    url.searchParams.set('lon', longitude.toFixed(1));
    url.searchParams.set('tz', timezone);
    url.searchParams.set('date', formatDateISO(selectedDate));
    if (solo) {
      url.searchParams.set('view', sectionId);
    } else if (sectionId) {
      url.hash = sectionId;
    }
    return url.toString();
  });
  
  function shouldShow(id) {
    return !soloSection || soloSection === id;
  }
  
  function showAllSections() {
    soloSection = null;
    const url = new URL(window.location.href);
    url.searchParams.delete('view');
    window.history.pushState({}, '', url.toString());
  }
  
  // Navigate to solo view for a section (updates URL + state)
  setContext('navigateToSection', (sectionId) => {
    soloSection = sectionId;
    const url = new URL(window.location.href);
    url.search = '';
    url.hash = '';
    url.searchParams.set('lat', latitude.toFixed(1));
    url.searchParams.set('lon', longitude.toFixed(1));
    url.searchParams.set('tz', timezone);
    url.searchParams.set('date', formatDateISO(selectedDate));
    url.searchParams.set('view', sectionId);
    window.history.pushState({}, '', url.toString());
  });
  
  setContext('showAllSections', () => showAllSections());
  setContext('getSoloSection', () => soloSection);
  
  // Scroll to hash target after content renders
  $effect(() => {
    if (!settingsLoaded) return;
    if (window.location.hash) {
      requestAnimationFrame(() => {
        const el = document.getElementById(window.location.hash.slice(1));
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      });
    }
  });
  
  // Computed year data (recomputes when latitude or year changes)
  let yearData = $derived.by(() => {
    const year = selectedDate.getFullYear();
    return computeYearData(latitude, year);
  });
  
  // Current day's sun data (uses actual longitude for accurate times)
  let sunData = $derived(getSunData(selectedDate, latitude, longitude, timezone));
  
  // Mirror date: the date with the same amount of daylight on the other half of the year
  // Uses fixed latitude (45°) so the mirror date is consistent regardless of user location
  let oppositeDate = $derived(findOppositeDate(selectedDate));
  
  // Precompute state
  let precomputeProgress = $state(null); // null = idle, 0-1 = in progress
  let precomputedKey = $state(null); // tracks what was precomputed: "date:lng:tz"
  let precomputeDone = $derived(
    precomputedKey !== null &&
    precomputedKey === `${formatDateISO(selectedDate)}:${longitude}:${timezone}`
  );
  
  async function precomputeAllLatitudes() {
    const year = selectedDate.getFullYear();
    const date = selectedDate;
    const lng = longitude;
    const tz = timezone;
    const t0 = performance.now();
    
    // All multiples of 0.5 from -90 to 90 = 361 latitudes
    const latitudes = [];
    for (let i = -180; i <= 180; i++) {
      latitudes.push(i / 2);
    }
    const total = latitudes.length;
    precomputeProgress = 0;
    
    for (let i = 0; i < total; i++) {
      const lat = latitudes[i];
      // Warm yearData cache (365 getSunData calls at lng=0)
      const yd = computeYearData(lat, year);
      // Warm getSunData cache for actual longitude (used by milestone functions)
      for (let doy = 1; doy <= yd.length; doy++) {
        getSunData(new Date(year, 0, doy), lat, lng, tz);
      }
      // Warm milestone function caches
      findUpcomingSunriseMilestones(date, lat, lng, tz);
      findUpcomingSunsetMilestones(date, lat, lng, tz);
      findUpcomingDaylightMilestones(date, yd, lat);
      findUpcomingDSTChanges(date, tz, lat, lng);
      
      precomputeProgress = (i + 1) / total;
      // Yield to UI every few items
      if (i % 2 === 0) await new Promise((r) => setTimeout(r, 0));
    }
    const elapsed = ((performance.now() - t0) / 1000).toFixed(1);
    precomputeProgress = null;
    precomputedKey = `${formatDateISO(date)}:${lng}:${tz}`;
    console.log(`Precomputed ${total} latitudes (-90° to 90°, step 0.5°) for year ${year} in ${elapsed}s`);
  }
  
  // Global keyboard shortcuts (listed in the header menu)
  // Latitude steps snap to the 0.5° grid so all values are precomputable
  function handleGlobalKeydown(e) {
    // Skip if user is typing in an input, textarea, select, or contenteditable
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || document.activeElement?.isContentEditable) return;
    // Popovers handle their own keys
    if (openPopover || document.activeElement?.closest('[role="dialog"]')) return;
    // Leave browser/OS shortcuts alone (e.g. Alt+Left = back); Shift is ours (bigger steps)
    if (e.altKey || e.ctrlKey || e.metaKey) return;

    const popoverKeys = { l: 'location', d: 'date', '?': 'menu' };
    const popover = popoverKeys[e.key.toLowerCase()];
    if (popover) {
      e.preventDefault();
      openPopover = popover;
    } else if (e.key.toLowerCase() === 't') {
      e.preventDefault();
      selectedDate = getToday();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      if (e.shiftKey) {
        // Jump to next 5° boundary
        latitude = Math.min(90, Math.ceil((latitude + 0.01) / 5) * 5);
      } else {
        // Snap to next 0.5° boundary above
        latitude = Math.min(90, Math.ceil((latitude + 0.01) * 2) / 2);
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      if (e.shiftKey) {
        // Jump to previous 5° boundary
        latitude = Math.max(-90, Math.floor((latitude - 0.01) / 5) * 5);
      } else {
        // Snap to next 0.5° boundary below
        latitude = Math.max(-90, Math.floor((latitude - 0.01) * 2) / 2);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const d = new Date(selectedDate);
      d.setDate(d.getDate() + (e.shiftKey ? 7 : 1));
      selectedDate = d;
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const d = new Date(selectedDate);
      d.setDate(d.getDate() - (e.shiftKey ? 7 : 1));
      selectedDate = d;
    }
  }
</script>

<svelte:window onkeydown={handleGlobalKeydown} onpopstate={() => {
  const params = new URLSearchParams(window.location.search);
  soloSection = params.get('view');
}} />

<div class="min-h-screen bg-gray-100 dark:bg-gray-900">
  <!-- Sticky header: location, date and latitude controls + selected day summary -->
  <header class="sticky top-0 z-50 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
    <div class="max-w-7xl mx-auto px-4 pt-2.5 pb-2 space-y-2">
      <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
        <a
          href="/"
          class="order-1 flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-gray-100 shrink-0 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          onclick={(e) => { e.preventDefault(); showAllSections(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          aria-label="Daylight Tracker"
        >
          <svg class="w-6 h-6 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <span class="hidden md:inline">Daylight Tracker</span>
        </a>
        <!-- Controls: own row on phones, inline from sm -->
        <div class="order-3 sm:order-2 flex w-full sm:w-auto min-w-0 items-center gap-2">
          <div class="min-w-0 flex-1 sm:flex-none sm:max-w-64">
            <LocationPicker
              bind:latitude
              bind:longitude
              bind:timezone
              bind:open={() => openPopover === 'location', (v) => openPopover = v ? 'location' : openPopover === 'location' ? null : openPopover}
            />
          </div>
          <DateControl
            bind:selectedDate
            {latitude}
            {longitude}
            {timezone}
            {oppositeDate}
            bind:open={() => openPopover === 'date', (v) => openPopover = v ? 'date' : openPopover === 'date' ? null : openPopover}
          />
        </div>
        <div class="order-2 sm:order-3 ml-auto flex items-center gap-2 min-w-0">
      {#if sunData}
        <div class="flex items-center gap-2.5 sm:gap-3 lg:gap-5 text-sm min-w-0">
          <!-- Sunrise: icon below xl, "Sunrise" label from xl when there's room -->
          <span
            class="flex items-center gap-1 shrink-0"
            title="Sunrise"
            aria-label="Sunrise: {sunData.isPolarNight ? '—' : sunData.isPolarDay ? 'Always up' : formatTimeInTimezone(sunData.sunrise, timezone)}"
          >
            <span class="xl:hidden text-gray-500 dark:text-gray-400" aria-hidden="true">
              <svg class="w-4 h-4 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
              </svg>
            </span>
            <span class="hidden xl:inline text-gray-500 dark:text-gray-400">Sunrise</span>
            <span class="font-medium text-gray-900 dark:text-gray-100">
              {#if sunData.isPolarNight}—
              {:else if sunData.isPolarDay}Always up
              {:else}{formatTimeInTimezone(sunData.sunrise, timezone)}{/if}
            </span>
          </span>
          <!-- Sunset: icon below xl, "Sunset" label from xl when there's room -->
          <span
            class="flex items-center gap-1 shrink-0"
            title="Sunset"
            aria-label="Sunset: {sunData.isPolarNight ? '—' : sunData.isPolarDay ? 'Never sets' : formatTimeInTimezone(sunData.sunset, timezone)}"
          >
            <span class="xl:hidden text-gray-500 dark:text-gray-400" aria-hidden="true">
              <svg class="w-4 h-4 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </span>
            <span class="hidden xl:inline text-gray-500 dark:text-gray-400">Sunset</span>
            <span class="font-medium text-gray-900 dark:text-gray-100">
              {#if sunData.isPolarNight}—
              {:else if sunData.isPolarDay}Never sets
              {:else}{formatTimeInTimezone(sunData.sunset, timezone)}{/if}
            </span>
          </span>
          <!-- Daylight: icon below xl, "Daylight" label from xl when there's room -->
          <span
            class="flex items-center gap-1 shrink-0"
            title="Daylight"
            aria-label="Daylight: {sunData.isPolarNight ? '0h 0m' : sunData.isPolarDay ? '24h 0m' : formatDuration(sunData.daylight)}"
          >
            <span class="xl:hidden text-gray-500 dark:text-gray-400" aria-hidden="true">
              <svg class="w-4 h-4 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </span>
            <span class="hidden xl:inline text-gray-500 dark:text-gray-400">Daylight</span>
            <span class="font-medium text-gray-900 dark:text-gray-100">
              {#if sunData.isPolarNight}0h 0m
              {:else if sunData.isPolarDay}24h 0m
              {:else}{formatDuration(sunData.daylight)}{/if}
            </span>
          </span>
        </div>
      {/if}
          <AppMenu
            bind:open={() => openPopover === 'menu', (v) => openPopover = v ? 'menu' : openPopover === 'menu' ? null : openPopover}
            {precomputeProgress}
            {precomputeDone}
            onPrecompute={precomputeAllLatitudes}
          />
        </div>
      </div>
      <LatitudeRail bind:latitude />
    </div>
  </header>

  {#snippet sectionToday()}
    <DayHero
      {selectedDate}
      {latitude}
      {longitude}
      {timezone}
      displayHour={sunAzimuthSelectedHour}
      onHoverHour={(h) => globalHoveredHour = h}
      onSelectHour={(h) => sunAzimuthSelectedHour = h}
    />
  {/snippet}

  {#snippet sectionMap()}
    <ChartCard id="map" title="World map" subtitle="Where it's day and night at the selected time. Click to move there.">
      {#snippet actions()}
        <div class="flex overflow-hidden rounded-md border border-gray-300 dark:border-gray-600" role="group" aria-label="Map view">
          {#each [['map', 'Map'], ['globe', 'Globe']] as [value, label]}
            <button
              type="button"
              class="px-2.5 py-1 transition-colors {mapView === value
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}"
              aria-pressed={mapView === value}
              onclick={() => { mapView = value; mapExpanded = true; }}
            >{label}</button>
          {/each}
        </div>
        <button
          type="button"
          class="rounded p-1 text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
          onclick={() => mapExpanded = !mapExpanded}
          aria-expanded={mapExpanded}
          aria-label={mapExpanded ? 'Collapse map' : 'Expand map'}
        >
          <svg class="h-4 w-4 transition-transform {mapExpanded ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      {/snippet}
      {#if mapExpanded}
        {#if mapView === 'globe'}
          <Globe bind:latitude bind:longitude selectedDate={globalHoveredDate ?? selectedDate} {timezone} displayHour={globalHoveredHour ?? sunAzimuthSelectedHour} />
        {:else}
          <WorldMap bind:latitude bind:longitude selectedDate={globalHoveredDate ?? selectedDate} {timezone} displayHour={globalHoveredHour ?? sunAzimuthSelectedHour} />
        {/if}
      {/if}
    </ChartCard>
  {/snippet}

  {#snippet sectionYearOverview()}
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
  {/snippet}

  {#snippet sectionDaylight()}
    <YearStack
      {yearData}
      {selectedDate}
      {oppositeDate}
      {latitude}
      {longitude}
      {timezone}
      hoveredDate={globalHoveredDate}
      onHoverDate={(date) => globalHoveredDate = date}
      onDateSelect={(date) => selectedDate = date}
    />
  {/snippet}

  {#snippet sectionSunPosition()}
    <SunAzimuthChart
      {yearData}
      {selectedDate}
      {oppositeDate}
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
  {/snippet}

  {#snippet sectionSunPath()}
    <SunPathChart
      {selectedDate}
      {latitude}
      {longitude}
      {timezone}
      highlightHour={sunAzimuthSelectedHour}
      onHoverHour={(h) => globalHoveredHour = h}
    />
  {/snippet}

  {#snippet sectionStats()}
    <StatsTable {selectedDate} {yearData} {latitude} {longitude} {oppositeDate} {timezone} onDateSelect={(date) => selectedDate = date} onHoverDate={(date) => globalHoveredDate = date} />
  {/snippet}

  {#snippet sectionUpcoming()}
    <UpcomingDates {selectedDate} {yearData} {latitude} {longitude} {timezone} onDateSelect={(date) => selectedDate = date} onHoverDate={(date) => globalHoveredDate = date} />
  {/snippet}

  {#snippet sectionMoon()}
    <MoonCard {selectedDate} {latitude} {longitude} {timezone} displayHour={globalHoveredHour ?? sunAzimuthSelectedHour} onDateSelect={(date) => selectedDate = date} />
  {/snippet}

  {#snippet sectionCompare()}
    <CompareCard
      {selectedDate}
      {latitude}
      {longitude}
      {timezone}
      bind:compareName
      hoveredDate={globalHoveredDate}
      onHoverDate={(date) => globalHoveredDate = date}
      onDateSelect={(date) => selectedDate = date}
    />
  {/snippet}


  <main class="max-w-7xl mx-auto px-4 py-8">
    {#if soloSection}
      <!-- Solo mode: show only the selected section -->
      {@const sections = {
        today: sectionToday,
        map: sectionMap,
        'year-overview': sectionYearOverview,
        daylight: sectionDaylight,
        'sun-position': sectionSunPosition,
        'sun-path': sectionSunPath,
        stats: sectionStats,
        upcoming: sectionUpcoming,
        // Solar noon is now a strip in the year chart; keep old shared links working
        'solar-noon': sectionDaylight,
        moon: sectionMoon,
        compare: sectionCompare
      }}
      <div class="mb-4">
        <button
          type="button"
          class="inline-flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 hover:underline"
          onclick={showAllSections}
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
          Show all sections
        </button>
      </div>
      {@render sections[soloSection]?.()}
    {:else}
      <div class="space-y-12">
        {@render sectionToday()}

        <Chapter id="year" title="Through the year" description="How daylight grows and shrinks, day by day.">
          <div class="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            {@render sectionYearOverview()}
            {@render sectionDaylight()}
          </div>
        </Chapter>

        <Chapter id="sky" title="The sky" description="Where the sun and moon are, and when.">
          <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {@render sectionSunPath()}
            {@render sectionSunPosition()}
            {@render sectionMoon()}
          </div>
        </Chapter>

        <Chapter id="coming-up" title="Coming up" description="Milestones in the weeks and months ahead.">
          <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {@render sectionUpcoming()}
            {@render sectionStats()}
          </div>
        </Chapter>

        <Chapter id="elsewhere" title="Elsewhere" description="Day and night around the world, and how another place compares.">
          <div class="space-y-6">
            {@render sectionMap()}
            {@render sectionCompare()}
          </div>
        </Chapter>
      </div>
    {/if}

    <!-- Footer -->
    <footer class="mt-12 text-center text-sm text-gray-500 dark:text-gray-400">
      <p>
        Calculations powered by <a href="https://github.com/mourner/suncalc" class="text-blue-600 dark:text-blue-400 hover:underline" target="_blank" rel="noopener">SunCalc</a>.
        Atmospheric refraction is included in sunrise/sunset times.
        <a href="THIRD-PARTY-LICENSES.md" class="text-blue-600 dark:text-blue-400 hover:underline" target="_blank" rel="noopener">Third-party licenses</a>.
      </p>
    </footer>
  </main>
</div>
