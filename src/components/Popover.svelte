<script>
  import { tick } from 'svelte';

  /**
   * Anchored popover on wide screens, bottom sheet on narrow ones.
   * Closes on outside click and Escape (returning focus to where it came from);
   * focuses the first [data-autofocus] element inside when opened.
   */
  let {
    open = $bindable(false),
    label,
    align = 'left',
    panelClass = 'sm:w-80',
    trigger,
    children
  } = $props();

  let root = $state();
  let returnFocus = null;

  $effect(() => {
    if (!open) return;
    returnFocus = document.activeElement;
    tick().then(() => root?.querySelector('[data-autofocus]')?.focus());
  });

  function close() {
    open = false;
    if (returnFocus instanceof HTMLElement) returnFocus.focus();
  }
</script>

<svelte:window
  onpointerdown={(e) => { if (open && root && !root.contains(e.target)) open = false; }}
  onkeydown={(e) => { if (open && e.key === 'Escape') { e.preventDefault(); close(); } }}
/>

<div class="relative" bind:this={root}>
  {@render trigger()}
  {#if open}
    <!-- Backdrop for the bottom sheet on narrow screens -->
    <div class="fixed inset-0 z-40 bg-black/30 sm:hidden" aria-hidden="true" onclick={() => open = false}></div>
    <div
      role="dialog"
      aria-label={label}
      class="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-2xl pb-[env(safe-area-inset-bottom)]
             bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl text-left
             sm:absolute sm:inset-x-auto sm:bottom-auto sm:top-full sm:mt-2 sm:max-h-[75vh] sm:rounded-xl sm:pb-0
             {align === 'right' ? 'sm:right-0' : 'sm:left-0'} {panelClass}"
    >
      <div class="mx-auto mt-2 h-1 w-10 rounded-full bg-gray-300 dark:bg-gray-600 sm:hidden" aria-hidden="true"></div>
      {@render children({ close })}
    </div>
  {/if}
</div>
