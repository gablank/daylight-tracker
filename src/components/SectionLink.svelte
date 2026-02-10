<script>
  import { getContext } from 'svelte';

  let { id } = $props();
  let open = $state(false);
  let copied = $state(false);
  let containerEl;

  const getShareUrl = getContext('getShareUrl');
  const navigateToSection = getContext('navigateToSection');
  const showAllSections = getContext('showAllSections');
  const getSoloSection = getContext('getSoloSection');

  let isSolo = $derived(getSoloSection() === id);

  async function copyUrl(solo) {
    try {
      await navigator.clipboard.writeText(getShareUrl(id, solo));
      copied = true;
      open = false;
      setTimeout(() => { copied = false; }, 1500);
    } catch {
      // clipboard may be blocked in some contexts
    }
  }

  function toggleSolo() {
    open = false;
    if (isSolo) {
      showAllSections();
    } else {
      navigateToSection(id);
    }
  }
</script>

<svelte:window onclick={(e) => {
  if (open && containerEl && !containerEl.contains(e.target)) {
    open = false;
  }
}} />

<span class="relative inline-flex items-center gap-0.5 ml-1.5" bind:this={containerEl}>
  <!-- Toggle solo view -->
  <button
    type="button"
    class="p-0.5 rounded transition-colors {isSolo ? 'text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300' : 'text-gray-300 hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-400'}"
    onclick={toggleSolo}
    title={isSolo ? 'Show all sections' : 'View only this section'}
  >
    {#if isSolo}
      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 9V4.5M9 9H4.5M9 9L3.5 3.5M9 15v4.5M9 15H4.5M9 15l-5.5 5.5M15 9h4.5M15 9V4.5M15 9l5.5-5.5M15 15h4.5M15 15v4.5m0-4.5l5.5 5.5" />
      </svg>
    {:else}
      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
      </svg>
    {/if}
  </button>
  <!-- Share menu -->
  <button
    type="button"
    class="p-0.5 rounded transition-colors {open ? 'text-gray-500 dark:text-gray-400' : 'text-gray-300 hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-400'}"
    onclick={() => open = !open}
    title="Share link to this section"
  >
    {#if copied}
      <svg class="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
      </svg>
    {:else}
      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.172 13.828a4 4 0 005.656 0l4-4a4 4 0 10-5.656-5.656l-1.102 1.101" />
      </svg>
    {/if}
  </button>
  {#if open}
    <div class="absolute left-0 top-full mt-1 z-50 bg-white dark:bg-gray-700 rounded-md shadow-lg border border-gray-200 dark:border-gray-600 py-1 min-w-[210px]">
      <button
        type="button"
        class="w-full text-left px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
        onclick={() => copyUrl(false)}
      >
        Copy link to this section
      </button>
      <button
        type="button"
        class="w-full text-left px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
        onclick={() => copyUrl(true)}
      >
        Copy link (only this section)
      </button>
    </div>
  {/if}
</span>
