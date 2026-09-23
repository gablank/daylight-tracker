<script>
  /**
   * Cursor-following tooltip shared by all charts. Flips to the other side of the
   * cursor near the viewport's right/bottom edge so it never runs off screen.
   * rows: [{ label, value, swatch? }] — swatch is a CSS colour for a small key square.
   */
  let { x, y, title = null, rows = [], children } = $props();

  let width = $state(0);
  let height = $state(0);

  const OFFSET = 14;
  let left = $derived(x + OFFSET + width > window.innerWidth - 8 ? x - OFFSET - width : x + OFFSET);
  let top = $derived(y + OFFSET + height > window.innerHeight - 8 ? y - OFFSET - height : y + OFFSET);
</script>

<div
  class="pointer-events-none fixed z-50 min-w-36 rounded-lg bg-gray-900/95 px-2.5 py-2 text-xs text-gray-100 shadow-lg ring-1 ring-white/10"
  style="left: {left}px; top: {top}px;"
  bind:clientWidth={width}
  bind:clientHeight={height}
  role="tooltip"
>
  {#if title}
    <div class="mb-1 font-semibold text-white">{title}</div>
  {/if}
  {#if rows.length}
    <dl class="grid grid-cols-[auto_auto] gap-x-3 gap-y-0.5">
      {#each rows as row}
        <dt class="flex items-center gap-1.5 text-gray-400">
          {#if row.swatch}
            <span class="inline-block h-2 w-2 shrink-0 rounded-sm ring-1 ring-white/20" style="background: {row.swatch}"></span>
          {/if}
          {row.label}
        </dt>
        <dd class="text-right font-medium tabular-nums">{row.value}</dd>
      {/each}
    </dl>
  {/if}
  {@render children?.()}
</div>
