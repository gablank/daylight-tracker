<script>
  import { getContext } from 'svelte';
  import Popover from './Popover.svelte';

  let {
    open = $bindable(false),
    precomputeProgress = null,
    precomputeDone = false,
    onPrecompute
  } = $props();

  const getShareUrl = getContext('getShareUrl');
  let copied = $state(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(getShareUrl(null, false));
      copied = true;
      setTimeout(() => { copied = false; }, 1500);
    } catch {
      // clipboard may be blocked in some contexts
    }
  }

  const SHORTCUTS = [
    [['←', '→'], 'Latitude ±0.5°', 'Shift: ±5°'],
    [['↓', '↑'], 'Previous / next day', 'Shift: ±1 week'],
    [['L'], 'Choose location'],
    [['D'], 'Choose date'],
    [['T'], 'Jump to today'],
    [['?'], 'Open this menu']
  ];

  const itemClass = `flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-sm text-gray-700 dark:text-gray-200
    hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500`;
</script>

<Popover bind:open label="Menu" align="right" panelClass="sm:w-80">
  {#snippet trigger()}
    <button
      type="button"
      class="rounded-lg p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100
             {open ? 'bg-gray-100 dark:bg-gray-700' : ''} focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      onclick={() => open = !open}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-label="More options"
      title="More (?)"
    >
      <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="5" cy="12" r="1.75" /><circle cx="12" cy="12" r="1.75" /><circle cx="19" cy="12" r="1.75" />
      </svg>
    </button>
  {/snippet}

  <div class="p-1.5">
    <button type="button" class={itemClass} onclick={copyLink} data-autofocus>
      {#if copied}
        <svg class="h-4 w-4 shrink-0 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
        Link copied
      {:else}
        <svg class="h-4 w-4 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.172 13.828a4 4 0 005.656 0l4-4a4 4 0 10-5.656-5.656l-1.102 1.101" />
        </svg>
        Copy link to this view
      {/if}
    </button>

    <button
      type="button"
      class={itemClass}
      onclick={onPrecompute}
      disabled={precomputeProgress !== null || precomputeDone}
    >
      <svg class="h-4 w-4 shrink-0 {precomputeDone ? 'text-emerald-500' : 'text-gray-400'}" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
      <span class="min-w-0 flex-1">
        <span class="block">
          {#if precomputeProgress !== null}
            Precomputing… {Math.round(precomputeProgress * 100)}%
          {:else if precomputeDone}
            All latitudes cached
          {:else}
            Precompute all latitudes
          {/if}
        </span>
        {#if precomputeProgress !== null}
          <span class="mt-1.5 block h-1 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-600">
            <span class="block h-full rounded-full bg-blue-500 transition-all duration-75" style="width: {precomputeProgress * 100}%"></span>
          </span>
        {:else}
          <span class="block text-xs text-gray-400 dark:text-gray-500">Makes the latitude slider instant</span>
        {/if}
      </span>
    </button>
  </div>

  <div class="border-t border-gray-200 dark:border-gray-700 px-4 py-3">
    <h4 class="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Keyboard shortcuts</h4>
    <dl class="space-y-1.5 text-xs">
      {#each SHORTCUTS as [keys, action, hint]}
        <div class="flex items-center gap-2">
          <dt class="flex w-14 shrink-0 gap-1">
            {#each keys as key}
              <kbd class="min-w-[1.5rem] rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/50 px-1 py-0.5 text-center font-sans text-[11px] text-gray-700 dark:text-gray-200">{key}</kbd>
            {/each}
          </dt>
          <dd class="text-gray-700 dark:text-gray-200">
            {action}
            {#if hint}<span class="text-gray-400 dark:text-gray-500"> · {hint}</span>{/if}
          </dd>
        </div>
      {/each}
    </dl>
  </div>
</Popover>
