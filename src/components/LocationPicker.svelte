<script>
  import { tick, untrack } from 'svelte';
  import Popover from './Popover.svelte';
  import {
    PRESET_LOCATION_GROUPS, TIMEZONE_GROUPS, getLocalTimezone, calendarSlug,
    findPresetLocation, formatLatitude, formatLongitude
  } from '../lib/utils.js';

  let {
    latitude = $bindable(59.9),
    longitude = $bindable(10.7),
    timezone = $bindable('Europe/Oslo'),
    open = $bindable(false)
  } = $props();

  let query = $state('');
  let activeIndex = $state(0);
  let isLocating = $state(false);
  let locationError = $state('');
  let listEl = $state();

  let currentPreset = $derived(findPresetLocation(latitude, longitude));

  // Presets, geolocation and shared links can set timezones outside the curated list
  let isListedTimezone = $derived(
    TIMEZONE_GROUPS.some((g) => g.timezones.some((tz) => tz.name === timezone))
  );

  const normalize = (s) => s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/ø/gi, 'o').toLowerCase();

  /**
   * Parse typed coordinates: "59.9, 10.7", "-33.9 18.4", "33.9S 18.4E"
   * @param {string} text
   * @returns {{ latitude: number, longitude: number } | null}
   */
  function parseCoordinates(text) {
    const m = text.trim().match(/^(-?\d+(?:\.\d+)?)\s*°?\s*([NS])?\s*[,;\s]\s*(-?\d+(?:\.\d+)?)\s*°?\s*([EW])?$/i);
    if (!m) return null;
    let lat = parseFloat(m[1]);
    let lon = parseFloat(m[3]);
    if (m[2]?.toUpperCase() === 'S') lat = -Math.abs(lat);
    if (m[4]?.toUpperCase() === 'W') lon = -Math.abs(lon);
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
    return { latitude: Math.round(lat * 10) / 10, longitude: Math.round(lon * 10) / 10 };
  }

  // Flat list of selectable options (so arrow keys can walk it), with group headings attached
  let options = $derived.by(() => {
    const q = normalize(query.trim());
    const opts = [];
    const coords = parseCoordinates(query);
    if (coords) opts.push({ kind: 'coords', id: 'loc-coords', ...coords });
    if (!q) opts.push({ kind: 'geo', id: 'loc-geo' });
    for (const group of PRESET_LOCATION_GROUPS) {
      const matches = group.locations.filter((p) => !q || normalize(p.name).includes(q));
      matches.forEach((preset, i) => opts.push({
        kind: 'preset',
        id: `loc-${calendarSlug(preset.name)}`,
        preset,
        heading: i === 0 ? (group.label === 'Other' ? 'Special latitudes' : group.label) : null
      }));
    }
    return opts;
  });

  // Reset the search each time the picker opens, starting at the current location
  $effect(() => {
    if (!open) return;
    untrack(() => {
      query = '';
      locationError = '';
      const i = options.findIndex((o) => o.preset && o.preset === currentPreset);
      activeIndex = Math.max(0, i);
      scrollActiveIntoView();
    });
  });

  async function scrollActiveIntoView() {
    await tick();
    listEl?.querySelector(`[aria-selected="true"]`)?.scrollIntoView({ block: 'nearest' });
  }

  function handleSearchKeydown(e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const n = options.length;
      if (!n) return;
      activeIndex = (activeIndex + (e.key === 'ArrowDown' ? 1 : -1) + n) % n;
      scrollActiveIntoView();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (options[activeIndex]) choose(options[activeIndex]);
    }
  }

  function choose(opt) {
    if (opt.kind === 'preset') {
      latitude = opt.preset.latitude;
      longitude = opt.preset.longitude ?? 0;
      timezone = opt.preset.timezone;
      open = false;
    } else if (opt.kind === 'coords') {
      latitude = opt.latitude;
      longitude = opt.longitude;
      open = false;
    } else if (opt.kind === 'geo') {
      useMyLocation();
    }
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
      open = false;
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

  function handleLatitudeInput(e) {
    const value = parseFloat(e.currentTarget.value);
    if (!isNaN(value) && value >= -90 && value <= 90) latitude = value;
  }

  function handleLongitudeInput(e) {
    const value = parseFloat(e.currentTarget.value);
    if (!isNaN(value) && value >= -180 && value <= 180) longitude = value;
  }

  // "Oslo, Norway" → ["Oslo", ", Norway"]
  function splitName(name) {
    const i = name.indexOf(',');
    return i === -1 ? [name, ''] : [name.slice(0, i), name.slice(i)];
  }

  const inputClass = `w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md
    bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
    focus:outline-none focus:ring-2 focus:ring-blue-500`;
</script>

<Popover bind:open label="Choose location" panelClass="sm:w-[22rem]">
  {#snippet trigger()}
    <button
      type="button"
      class="flex w-full min-w-0 items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm transition-colors
             {open
               ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
               : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'}
             focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      onclick={() => open = !open}
      aria-haspopup="dialog"
      aria-expanded={open}
      title="Change location (L)"
    >
      <svg class="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
      {#if currentPreset}
        <span class="truncate font-medium text-gray-900 dark:text-gray-100">{splitName(currentPreset.name)[0]}</span>
        <span class="hidden lg:inline shrink-0 text-gray-500 dark:text-gray-400 tabular-nums">
          {formatLatitude(latitude)}{currentPreset.latitudeOnly ? '' : ` ${formatLongitude(longitude)}`}
        </span>
      {:else}
        <span class="truncate font-medium text-gray-900 dark:text-gray-100 tabular-nums">
          {formatLatitude(latitude)} {formatLongitude(longitude)}
        </span>
      {/if}
      <svg class="ml-auto h-4 w-4 shrink-0 text-gray-400 transition-transform {open ? 'rotate-180' : ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  {/snippet}

  <div class="p-2">
    <div class="relative">
      <svg class="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
      </svg>
      <input
        data-autofocus
        type="text"
        role="combobox"
        aria-expanded="true"
        aria-controls="location-options"
        aria-activedescendant={options[activeIndex]?.id}
        aria-label="Search places or enter coordinates"
        placeholder="Search places or type “lat, lon”"
        autocomplete="off"
        spellcheck="false"
        bind:value={query}
        oninput={() => { activeIndex = 0; }}
        onkeydown={handleSearchKeydown}
        class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/50 py-2 pl-8 pr-3 text-sm
               text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  </div>

  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <ul
    id="location-options"
    role="listbox"
    aria-label="Places"
    bind:this={listEl}
    class="max-h-[50vh] sm:max-h-80 overflow-y-auto px-2 pb-2"
  >
    {#each options as opt, i (opt.id)}
      {#if opt.heading}
        <li role="presentation" class="px-2 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
          {opt.heading}
        </li>
      {/if}
      <li
        id={opt.id}
        role="option"
        aria-selected={i === activeIndex}
        class="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm
               {i === activeIndex ? 'bg-blue-50 dark:bg-blue-900/40' : ''}"
        onmousemove={() => { activeIndex = i; }}
        onclick={() => choose(opt)}
      >
        {#if opt.kind === 'geo'}
          <svg class="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400 {isLocating ? 'animate-pulse' : ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <circle cx="12" cy="12" r="3" stroke-width="2" />
            <path stroke-linecap="round" stroke-width="2" d="M12 2v3m0 14v3M2 12h3m14 0h3M19 12a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span class="font-medium text-blue-700 dark:text-blue-300">{isLocating ? 'Finding your location…' : 'Use my location'}</span>
        {:else if opt.kind === 'coords'}
          <svg class="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
          <span class="text-gray-900 dark:text-gray-100">
            Go to <span class="font-medium tabular-nums">{formatLatitude(opt.latitude)} {formatLongitude(opt.longitude)}</span>
          </span>
        {:else}
          {@const [place, region] = splitName(opt.preset.name)}
          <span class="min-w-0 flex-1 truncate">
            <span class="text-gray-900 dark:text-gray-100">{place}</span><span class="text-gray-400 dark:text-gray-500">{region}</span>
          </span>
          <span class="shrink-0 text-xs tabular-nums text-gray-500 dark:text-gray-400">{formatLatitude(opt.preset.latitude)}</span>
          <svg class="h-4 w-4 shrink-0 {opt.preset === currentPreset ? 'text-blue-600 dark:text-blue-400' : 'invisible'}" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
          </svg>
        {/if}
      </li>
    {:else}
      <li role="presentation" class="px-2 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
        No matching places. Try coordinates like <span class="font-mono">48.9, 2.3</span>
      </li>
    {/each}
  </ul>

  {#if locationError}
    <p class="px-4 pb-2 text-sm text-red-600 dark:text-red-400">{locationError}</p>
  {/if}

  <details class="group border-t border-gray-200 dark:border-gray-700">
    <summary class="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50">
      <svg class="h-3.5 w-3.5 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
      </svg>
      Coordinates &amp; timezone
      <span class="ml-auto truncate text-xs text-gray-400 dark:text-gray-500">{timezone.replace(/_/g, ' ')}</span>
    </summary>
    <div class="grid grid-cols-2 gap-2 px-4 pb-4 pt-1">
      <label class="text-xs text-gray-500 dark:text-gray-400">
        Latitude
        <input type="number" min="-90" max="90" step="0.1" value={latitude} oninput={handleLatitudeInput} class="mt-1 {inputClass}" />
      </label>
      <label class="text-xs text-gray-500 dark:text-gray-400">
        Longitude
        <input type="number" min="-180" max="180" step="0.1" value={longitude} oninput={handleLongitudeInput} class="mt-1 {inputClass}" />
      </label>
      <label class="col-span-2 text-xs text-gray-500 dark:text-gray-400">
        Timezone
        <select value={timezone} onchange={(e) => timezone = e.currentTarget.value} class="mt-1 {inputClass}">
          {#if !isListedTimezone}
            <option value={timezone}>{timezone.replace(/_/g, ' ')}</option>
          {/if}
          {#each TIMEZONE_GROUPS as group}
            <optgroup label={group.label}>
              {#each group.timezones as tz}
                <option value={tz.name}>{tz.name.replace(/_/g, ' ')} ({tz.offset})</option>
              {/each}
            </optgroup>
          {/each}
        </select>
      </label>
      <p class="col-span-2 text-xs text-gray-400 dark:text-gray-500">
        Clicking the map changes coordinates only; times stay in this timezone.
      </p>
    </div>
  </details>
</Popover>
