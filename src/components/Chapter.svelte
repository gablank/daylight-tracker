<script>
  /** A titled group of sections on the page ("Through the year", "The sky", …) */
  let { id, title, description, children } = $props();
</script>

<section {id} class="scroll-mt-32" aria-labelledby="{id}-title">
  <div class="mb-4 flex items-baseline gap-3 border-b border-gray-200 pb-2 dark:border-gray-700/70">
    <h2 id="{id}-title" class="text-lg font-semibold tracking-tight text-gray-900 dark:text-gray-100">{title}</h2>
    <p class="hidden text-sm text-gray-500 sm:block dark:text-gray-400">{description}</p>
  </div>
  {@render children()}
</section>
