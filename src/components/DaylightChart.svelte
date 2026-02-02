<script>
  import { getDayOfYear, getDaysInYear, getDayStatsForTooltip } from '../lib/solar.js';
  import { formatDurationChangeMinutesSeconds } from '../lib/utils.js';

  let { yearData, selectedDate, latitude = 0, longitude = 0, timezone = null, onDateSelect = null, derivativeCount = $bindable(1) } = $props();

  let hoveredDate = $state(null);
  let tooltipX = $state(0);
  let tooltipY = $state(0);

  const width = 600;
  const height = 300;
  // Right edge: space for rightmost axis labels (e.g. "Δ min/day") so they don't get cropped
  const rightEdgePadding = 54;
  // Per-axis step between derivative axes (enough to avoid overlap)
  const axisWidth = 28;
  const padding = $derived((() => {
    const count = Math.max(1, Math.min(5, derivativeCount));
    return {
      top: 20,
      right: rightEdgePadding + (count - 1) * axisWidth,
      bottom: 40,
      left: 45
    };
  })());
  const chartWidth = $derived(width - padding.left - padding.right);
  const chartHeight = $derived(height - padding.top - padding.bottom);

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

  // Derivatives: array of { path, maxAbs, ticks } for orders 1..derivativeCount
  const derivativeColors = [
    'rgb(16, 185, 129)',   // 1st: emerald
    'rgb(139, 92, 246)',   // 2nd: violet
    'rgb(245, 158, 11)',   // 3rd: amber
    'rgb(244, 63, 94)',    // 4th: rose
    'rgb(14, 165, 233)'    // 5th: sky
  ];

  let derivativesArray = $derived.by(() => {
    if (!yearData || yearData.length < 2) return [];
    const count = Math.max(1, Math.min(5, derivativeCount));
    const result = [];
    let values = yearData.map((d) => d.daylight / (1000 * 60));
    const n = yearData.length;

    for (let order = 1; order <= count; order++) {
      if (values.length < 2) break;
      const nextValues = [];
      for (let i = 1; i < values.length; i++) {
        nextValues.push(values[i] - values[i - 1]);
      }
      values = nextValues;
      const maxAbs = Math.max(0.01, ...values.map((d) => Math.abs(d)));
      const path = values
        .map((deriv, i) => {
          const dayIndex = i + order * 0.5;
          const x = padding.left + (dayIndex / Math.max(n - 1, 1)) * chartWidth;
          const y = padding.top + chartHeight / 2 - (deriv / maxAbs) * (chartHeight / 2);
          return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
        })
        .join(' ');
      const tickStep = maxAbs <= 0.5 ? 0.1 : maxAbs <= 2 ? 0.5 : maxAbs <= 5 ? 1 : Math.ceil(maxAbs / 5);
      const ticks = [];
      for (let t = -maxAbs; t <= maxAbs + 0.01; t += tickStep) {
        ticks.push(Math.round(t * 100) / 100);
      }
      if (ticks.length === 0) ticks.push(0);
      result.push({ path, maxAbs, ticks, order });
    }
    return result;
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

  // Rate of change at selected day: centered difference (tomorrow - yesterday)/2 so solstice shows ~0
  let daylightChangeLabel = $derived.by(() => {
    if (!selectedDate || !yearData || yearData.length === 0) return null;
    const doy = getDayOfYear(selectedDate);
    const daysInYear = yearData.length;
    const prevData = doy > 1 ? yearData[doy - 2] : null;
    const nextData = doy < daysInYear ? yearData[doy] : null;
    let changeMs;
    if (prevData && nextData) {
      changeMs = (nextData.daylight - prevData.daylight) / 2;
    } else if (nextData) {
      changeMs = nextData.daylight - yearData[doy - 1].daylight;
    } else if (prevData) {
      changeMs = yearData[doy - 1].daylight - prevData.daylight;
    } else {
      return null;
    }
    return formatDurationChangeMinutesSeconds(changeMs);
  });

  function getDateAtX(svg, clientX) {
    if (!selectedDate || !yearData?.length) return null;
    const rect = svg.getBoundingClientRect();
    const scale = Math.min(rect.width / width, rect.height / height);
    const offsetX = (rect.width - width * scale) / 2;
    const svgX = (clientX - rect.left - offsetX) / scale;
    const clickX = svgX - padding.left;
    if (clickX < 0 || clickX > chartWidth) return null;
    const year = selectedDate.getFullYear();
    const daysInYear = getDaysInYear(year);
    const dayOfYear = Math.round((clickX / chartWidth) * (daysInYear - 1)) + 1;
    return new Date(year, 0, dayOfYear);
  }

  function handleChartClick(event) {
    if (!onDateSelect || !selectedDate || !yearData?.length) return;
    const newDate = getDateAtX(event.currentTarget, event.clientX);
    if (newDate) onDateSelect(newDate);
    hoveredDate = null;
  }

  function handleChartMouseMove(event) {
    const date = getDateAtX(event.currentTarget, event.clientX);
    hoveredDate = date;
    if (date) {
      tooltipX = event.clientX;
      tooltipY = event.clientY;
    }
  }

  function handleChartMouseLeave() {
    hoveredDate = null;
  }

  // Clear hover/tooltip on scroll or touchmove so it doesn't stick on mobile
  $effect(() => {
    const clear = () => { hoveredDate = null; };
    window.addEventListener('scroll', clear, true);
    window.addEventListener('touchmove', clear, true);
    return () => {
      window.removeEventListener('scroll', clear, true);
      window.removeEventListener('touchmove', clear, true);
    };
  });
</script>

<div class="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm flex flex-col">
  <div class="flex items-center justify-between mb-3">
    <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300">Daylight Through the Year</h3>
    <label class="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
      <span>Derivatives:</span>
      <input
        type="number"
        min="1"
        max="5"
        value={derivativeCount}
        oninput={(e) => {
          const v = parseInt(e.currentTarget.value, 10);
          if (!isNaN(v)) derivativeCount = Math.max(1, Math.min(5, v));
        }}
        class="w-14 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-gray-900 dark:text-gray-100 text-center focus:outline-none focus:ring-0"
      />
    </label>
  </div>
  <div class="min-h-0">
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions a11y_no_noninteractive_element_interactions -->
  <svg
    viewBox="0 0 {width} {height}"
    class="w-full max-w-3xl cursor-pointer outline-none"
    style="max-height: 320px;"
    onclick={handleChartClick}
    onmousemove={handleChartMouseMove}
    onmouseleave={handleChartMouseLeave}
    role="img"
    aria-label="Daylight hours through the year. Click to select a date."
  >
    <defs>
      <linearGradient id="daylightChartGradient" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="rgb(59, 130, 246)" stop-opacity="0.4" />
        <stop offset="100%" stop-color="rgb(59, 130, 246)" stop-opacity="0.05" />
      </linearGradient>
    </defs>

    <!-- Left Y-axis: hour ticks and labels -->
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

    <!-- Zero line for derivatives (horizontal at middle) -->
    {#if derivativesArray.length > 0}
      <line
        x1={padding.left}
        y1={padding.top + chartHeight / 2}
        x2={width - padding.right}
        y2={padding.top + chartHeight / 2}
        stroke="currentColor"
        stroke-opacity="0.2"
        stroke-dasharray="4,4"
      />
    {/if}

    <!-- Right Y-axes: one per derivative; rightmost axis stays at fixed x so it doesn't shift left -->
    {#each derivativesArray as deriv, idx}
      {@const axisX = width - rightEdgePadding - (derivativesArray.length - 1 - idx) * axisWidth}
      {#each deriv.ticks as tick}
        {@const y = padding.top + chartHeight / 2 - (tick / deriv.maxAbs) * (chartHeight / 2)}
        <text
          x={axisX + 8}
          y={y + 4}
          text-anchor="start"
          class="text-xs"
          style="fill: {derivativeColors[idx]}"
        >
          {tick >= 0 ? '+' : ''}{tick}
        </text>
      {/each}
      <text
        x={axisX - 4}
        y={padding.top - 4}
        text-anchor="end"
        class="text-[10px]"
        style="fill: {derivativeColors[idx]}"
      >
        {deriv.order === 1 ? 'Δ min/day' : `Δ${deriv.order}`}
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

    <!-- Derivative lines (each with own y-axis) -->
    {#each derivativesArray as deriv, idx}
      {#if deriv.path}
        <path
          d={deriv.path}
          fill="none"
          stroke={derivativeColors[idx]}
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-opacity="0.9"
        />
      {/if}
    {/each}

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
      <!-- Label: rate of change at this day (centered difference) -->
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
  {#if hoveredDate}
    {@const stats = getDayStatsForTooltip(hoveredDate, latitude, longitude, timezone)}
    <div
      class="fixed z-50 px-2 py-1.5 text-xs rounded shadow-lg bg-gray-800 text-gray-100 dark:bg-gray-700 dark:text-gray-200 pointer-events-none"
      style="left: {tooltipX + 12}px; top: {tooltipY + 8}px;"
    >
      <div class="font-medium">{stats.dateLabel}</div>
      <div>Sunrise: {stats.sunrise}</div>
      <div>Sunset: {stats.sunset}</div>
      <div>Daylight: {stats.daylight}</div>
    </div>
  {/if}
</div>
