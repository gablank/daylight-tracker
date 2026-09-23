<script>
  import { tick } from 'svelte';
  import Popover from './Popover.svelte';
  import { PRESET_LOCATION_GROUPS, formatLatitude } from '../lib/utils.js';

  /** Searchable picker for one of the preset places; value is the preset name or null */
  let { value = $bindable(null), placeholder = 'Choose a place', label = 'Choose a place' } = $props();

  let open = $state(false);
  let query = $state('');
  let activeIndex = $state(0);
  let listEl = $state();

  const normalize = (s) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ø/gi, 'o').toLowerCase();

  let options = $derived.by(() => {
    const q = normalize(query.trim());
    return PRESET_LOCATION_GROUPS.flatMap((group) =>
      group.locations
        .filter((p) => !q || normalize(p.name).includes(q))
        .map((preset, i) => ({ preset, heading: i === 0 ? (group.label === 'Other' ? 'Special latitudes' : group.label) : null }))
    );
  });

  $effect(() => {
    if (open) { query = ''; activeIndex = 0; }
  });

  function choose(preset) {
    value = preset.name;
    open = false;
  }

  async function handleKeydown(e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!options.length) return;
      activeIndex = (activeIndex + (e.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
      await tick();
      listEl?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter' && options[activeIndex]) {
      e.preventDefault();
      choose(options[activeIndex].preset);
    }
  }
</script>

<Popover bind:open {label} align="right" panelClass="sm:w-72">
  {#snippet trigger()}
    <button
      type="button"
      class="flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-sm transition-colors
             {open ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' : 'border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700'}
             text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-gray-100"
      onclick={() => open = !open}
      aria-haspopup="dialog"
      aria-expanded={open}
    >
      <span class="max-w-44 truncate {value ? 'font-medium' : 'text-gray-500 dark:text-gray-400'}">{value ? value.split(',')[0] : placeholder}</span>
      <svg class="h-4 w-4 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  {/snippet}

  <div class="p-2">
    <input
      data-autofocus
      type="text"
      role="combobox"
      aria-expanded="true"
      aria-controls="preset-options"
      aria-activedescendant={options[activeIndex] ? `preset-${activeIndex}` : undefined}
      aria-label="Search places"
      placeholder="Search places"
      autocomplete="off"
      bind:value={query}
      oninput={() => { activeIndex = 0; }}
      onkeydown={handleKeydown}
      class="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900/50 dark:text-gray-100"
    />
  </div>
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <ul id="preset-options" role="listbox" aria-label="Places" bind:this={listEl} class="max-h-[50vh] overflow-y-auto px-2 pb-2 sm:max-h-72">
    {#each options as opt, i (opt.preset.name)}
      {#if opt.heading}
        <li role="presentation" class="px-2 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">{opt.heading}</li>
      {/if}
      <li
        id="preset-{i}"
        role="option"
        aria-selected={i === activeIndex}
        class="flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm {i === activeIndex ? 'bg-blue-50 dark:bg-blue-900/40' : ''}"
        onmousemove={() => { activeIndex = i; }}
        onclick={() => choose(opt.preset)}
      >
        <span class="truncate text-gray-900 dark:text-gray-100">{opt.preset.name}</span>
        <span class="shrink-0 text-xs tabular-nums text-gray-500 dark:text-gray-400">{formatLatitude(opt.preset.latitude)}</span>
      </li>
    {:else}
      <li role="presentation" class="px-2 py-6 text-center text-sm text-gray-500 dark:text-gray-400">No matching places</li>
    {/each}
  </ul>
  {#if value}
    <div class="border-t border-gray-200 p-2 dark:border-gray-700">
      <button type="button" class="w-full rounded-md px-2 py-1.5 text-left text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700" onclick={() => { value = null; open = false; }}>
        Stop comparing
      </button>
    </div>
  {/if}
</Popover>
