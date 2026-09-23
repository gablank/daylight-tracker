<script>
  import ChartTooltip from './ChartTooltip.svelte';
  import { getDayStatsForTooltip } from '../lib/solar.js';

  /** Tooltip with a day's sunrise, sunset and daylight, shown wherever a date is hovered */
  let { x, y, date, latitude, longitude, timezone, children } = $props();

  let stats = $derived(getDayStatsForTooltip(date, latitude, longitude, timezone));
</script>

<ChartTooltip {x} {y} title={stats.dateLabel} rows={[
  { label: 'Sunrise', value: stats.sunrise },
  { label: 'Sunset', value: stats.sunset },
  { label: 'Daylight', value: stats.daylight }
]}>
  {@render children?.()}
</ChartTooltip>
