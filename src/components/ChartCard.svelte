<script>
  import SectionLink from './SectionLink.svelte';

  /**
   * The frame every section sits in: title (with share/solo links), a one-line
   * explanation of what the section shows, optional controls, body and legend.
   */
  let {
    id = null,
    title,
    subtitle = null,
    class: className = '',
    actions,
    legend,
    children
  } = $props();
</script>

<section
  {id}
  class="flex scroll-mt-32 flex-col rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200/70 sm:p-5 dark:bg-gray-800 dark:ring-gray-700/60 {className}"
>
  <header class="mb-3 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
    <div class="min-w-0">
      <div class="flex items-center gap-0.5">
        <h3 class="text-[15px] font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
        {#if id}<SectionLink {id} />{/if}
      </div>
      {#if subtitle}
        <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
          {#if typeof subtitle === 'function'}{@render subtitle()}{:else}{subtitle}{/if}
        </p>
      {/if}
    </div>
    {#if actions}
      <div class="flex shrink-0 flex-wrap items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
        {@render actions()}
      </div>
    {/if}
  </header>
  <div class="min-h-0 flex-1">
    {@render children()}
  </div>
  {#if legend}
    <footer class="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-400">
      {@render legend()}
    </footer>
  {/if}
</section>
