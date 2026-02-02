<script>
  import { getDayOfYear, getDaysInYear } from '../lib/solar.js';
  import { formatDurationChangeMinutesSeconds } from '../lib/utils.js';

  let { yearData, selectedDate, onDateSelect = null } = $props();

  const width = 600;
  const height = 300;
  const padding = { top: 20, right: 20, bottom: 40, left: 45 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Path for the daylight line
  let pathData = $derived.by(() => {
    if (!yearData || yearData.length === 0) return '';
    const n = yearData.length;
    return yearData
      .map((day, i) => {
        const x = padding.left + (i / Math.max(n - 1, 1)) * chartWidth;
        const hours = day.daylightHours ?? 0;
        const y = padding.top + chartHeight - (hours / 24) * chartHeight;
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ');
  });

  // Area fill (line + bottom edge)
  let areaData = $derived.by(() => {
    if (!pathData) return '';
    const n = yearData?.length ?? 0;
    if (n === 0) return '';
    const xEnd = padding.left + chartWidth;
    const yBottom = padding.top + chartHeight;
    return `${pathData} L ${xEnd} ${yBottom} L ${padding.left} ${yBottom} Z`;
  });

  // Month tick positions (day 1 of each month)
  let monthTicks = $derived.by(() => {
    if (!yearData || yearData.length === 0) return [];
    const year = selectedDate?.getFullYear() ?? new Date().getFullYear();
    const daysInYear = getDaysInYear(year);
    return months.map((label, monthIndex) => {
      const date = new Date(year, monthIndex, 1);
      const doy = getDayOfYear(date);
      const x = padding.left + ((doy - 1) / Math.max(daysInYear - 1, 1)) * chartWidth;
      return { x, label };
    });
  });

  // Selected date vertical line position
  let selectedDateX = $derived.by(() => {
    if (!selectedDate || !yearData || yearData.length === 0) return null;
    const doy = getDayOfYear(selectedDate);
    const year = selectedDate.getFullYear();
    const daysInYear = getDaysInYear(year);
    return padding.left + ((doy - 1) / Math.max(daysInYear - 1, 1)) * chartWidth;
  });

  // Daylight change from previous day (for label)
  let daylightChangeLabel = $derived.by(() => {
    if (!selectedDate || !yearData || yearData.length === 0) return null;
    const doy = getDayOfYear(selectedDate);
    const todayData = yearData[doy - 1];
    const prevData = doy > 1 ? yearData[doy - 2] : null;
    if (!todayData || !prevData) return null;
    const changeMs = todayData.daylight - prevData.daylight;
    return formatDurationChangeMinutesSeconds(changeMs);
  });

  function handleChartClick(event) {
    if (!onDateSelect || !selectedDate || !yearData?.length) return;
    const svg = event.currentTarget;
    const rect = svg.getBoundingClientRect();
    // SVG viewBox scales uniformly (preserveAspectRatio default: xMidYMid meet)
    const scale = Math.min(rect.width / width, rect.height / height);
    const offsetX = (rect.width - width * scale) / 2;
    const svgX = (event.clientX - rect.left - offsetX) / scale;
    const clickX = svgX - padding.left;
    if (clickX < 0 || clickX > chartWidth) return;
    const year = selectedDate.getFullYear();
    const daysInYear = getDaysInYear(year);
    const dayOfYear = Math.round((clickX / chartWidth) * (daysInYear - 1)) + 1;
    const newDate = new Date(year, 0, dayOfYear);
    onDateSelect(newDate);
  }
</script>

<div class="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm mt-4">
  <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Daylight Through the Year</h3>
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
  <svg
    viewBox="0 0 {width} {height}"
    class="w-full max-w-3xl cursor-pointer outline-none"
    style="max-height: 320px;"
    onclick={handleChartClick}
    role="img"
    aria-label="Daylight hours through the year. Click to select a date."
  >
    <defs>
      <linearGradient id="daylightChartGradient" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="rgb(59, 130, 246)" stop-opacity="0.4" />
        <stop offset="100%" stop-color="rgb(59, 130, 246)" stop-opacity="0.05" />
      </linearGradient>
    </defs>

    <!-- Y-axis: hour ticks and labels -->
    {#each [0, 6, 12, 18, 24] as hours}
      {@const y = padding.top + chartHeight - (hours / 24) * chartHeight}
      <line
        x1={padding.left}
        y1={y}
        x2={width - padding.right}
        y2={y}
        stroke="currentColor"
        stroke-opacity="0.15"
        stroke-dasharray="2,2"
      />
      <text
        x={padding.left - 8}
        y={y + 4}
        text-anchor="end"
        class="fill-gray-500 dark:fill-gray-400 text-xs"
      >
        {hours}h
      </text>
    {/each}

    <!-- X-axis: month ticks and labels -->
    {#each monthTicks as { x, label }}
      <line
        x1={x}
        y1={padding.top + chartHeight}
        x2={x}
        y2={padding.top + chartHeight + 6}
        stroke="currentColor"
        class="stroke-gray-400 dark:stroke-gray-500"
      />
      <text
        x={x}
        y={height - 8}
        text-anchor="middle"
        class="fill-gray-500 dark:fill-gray-400 text-xs"
      >
        {label}
      </text>
    {/each}

    <!-- Area fill under line -->
    <path
      d={areaData}
      fill="url(#daylightChartGradient)"
    />

    <!-- Daylight line -->
    <path
      d={pathData}
      fill="none"
      stroke="rgb(59, 130, 246)"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    />

    <!-- Selected date vertical line -->
    {#if selectedDateX !== null}
      <line
        x1={selectedDateX}
        y1={padding.top}
        x2={selectedDateX}
        y2={padding.top + chartHeight}
        stroke="rgb(234, 88, 12)"
        stroke-width="2"
        stroke-opacity="0.9"
      />
      <!-- Label: change from previous day -->
      {#if daylightChangeLabel !== null}
        <text
          x={selectedDateX}
          y={padding.top - 6}
          text-anchor="middle"
          class="fill-orange-600 dark:fill-orange-400 text-xs font-medium"
        >
          {daylightChangeLabel}
        </text>
      {/if}
    {/if}
  </svg>
</div>
