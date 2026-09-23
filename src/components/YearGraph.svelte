<script>
  import { getDateAngle, formatDateShort, formatDuration, getDaysInYear, getWinterSolstice, getSummerSolstice, getMarchEquinox, getSeptemberEquinox, getDayOfYear, getSeasonName } from '../lib/solar.js';
  import { calendarDateInTimezone } from '../lib/utils.js';
  import ChartCard from './ChartCard.svelte';
  import DayTooltip from './DayTooltip.svelte';
  
  let { selectedDate, yearData, oppositeDate, latitude = 0, longitude = 0, timezone = null, hoveredDate = null, onHoverDate = null, onDateSelect = null } = $props();
  
  // Tooltip screen position (hoveredDate comes from prop for cross-component sync)
  let tooltipX = $state(0);
  let tooltipY = $state(0);
  let isHovering = $state(false); // Track if mouse is over this component (for tooltip visibility)
  
  // SVG dimensions - viewBox includes small padding so labels are never cropped (equinox labels stacked on two lines)
  const size = 480;
  const padding = 28;
  const viewBoxSize = size + 2 * padding;
  const center = size / 2;
  const outerRadius = 160;
  const innerRadius = 95;
  
  // Get date at SVG-relative position (x, y from center), or null if outside ring
  function getDateAtPosition(svg, clientX, clientY) {
    if (!selectedDate) return null;
    const rect = svg.getBoundingClientRect();
    const scaleX = viewBoxSize / rect.width;
    const scaleY = viewBoxSize / rect.height;
    const x = (clientX - rect.left) * scaleX - padding - center;
    const y = (clientY - rect.top) * scaleY - padding - center;
    const distance = Math.sqrt(x * x + y * y);
    if (distance < innerRadius - 10 || distance > outerRadius + 30) return null;
    let angle = Math.atan2(x, -y) * 180 / Math.PI;
    if (!isClockwise) angle = -angle;
    if (angle < 0) angle += 360;
    const year = selectedDate.getFullYear();
    const daysInYear = getDaysInYear(year);
    const winterSolsticeDOY = getDayOfYear(getWinterSolstice(year));
    const daysFromWS = Math.round((angle / 360) * daysInYear);
    let targetDOY = winterSolsticeDOY + daysFromWS;
    if (targetDOY > daysInYear) targetDOY -= daysInYear;
    if (targetDOY < 1) targetDOY += daysInYear;
    return new Date(year, 0, targetDOY);
  }
  
  function handleRingClick(event) {
    if (!onDateSelect || !selectedDate) return;
    const date = getDateAtPosition(event.currentTarget, event.clientX, event.clientY);
    if (date) onDateSelect(date);
    onHoverDate?.(null);
  }
  
  function handleRingMouseMove(event) {
    const date = getDateAtPosition(event.currentTarget, event.clientX, event.clientY);
    onHoverDate?.(date);
    isHovering = true;
    if (date) {
      tooltipX = event.clientX;
      tooltipY = event.clientY;
    }
  }
  
  function handleRingMouseLeave() {
    onHoverDate?.(null);
    isHovering = false;
  }
  
  // Load from localStorage; default counter-clockwise (winter solstice on top, the year runs left)
  let isClockwise = $state(false);
  
  // Initialize from localStorage on mount
  $effect(() => {
    const stored = localStorage.getItem('daylight-tracker-clockwise');
    if (stored !== null) {
      isClockwise = stored === 'true';
    }
  });
  
  // Save to localStorage when changed
  function handleClockwiseChange(e) {
    isClockwise = e.target.checked;
    localStorage.setItem('daylight-tracker-clockwise', String(isClockwise));
  }

  // Clear hover/tooltip on scroll or touchmove so it doesn't stick on mobile
  $effect(() => {
    const clear = () => { onHoverDate?.(null); isHovering = false; };
    window.addEventListener('scroll', clear, true);
    window.addEventListener('touchmove', clear, true);
    return () => {
      window.removeEventListener('scroll', clear, true);
      window.removeEventListener('touchmove', clear, true);
    };
  });

  // Convert angle to SVG coordinates
  function polarToCartesian(angle, radius) {
    const directedAngle = isClockwise ? angle : -angle;
    const radians = (directedAngle - 90) * Math.PI / 180;
    return {
      x: center + radius * Math.cos(radians),
      y: center + radius * Math.sin(radians)
    };
  }
  
  // Calculate current date angle
  let currentAngle = $derived(selectedDate ? getDateAngle(selectedDate, selectedDate.getFullYear()) : 0);
  
  // Calculate opposite date angle
  let oppositeAngle = $derived(oppositeDate ? getDateAngle(oppositeDate.date, oppositeDate.date.getFullYear()) : null);
  
  // Current date position on the ring
  let currentPosition = $derived(polarToCartesian(currentAngle, (outerRadius + innerRadius) / 2));
  
  // Opposite date position
  let oppositePosition = $derived(
    oppositeAngle !== null 
      ? polarToCartesian(oppositeAngle, (outerRadius + innerRadius) / 2)
      : null
  );
  
  // Hover date angle and position (for cross-component hover sync)
  let hoverAngle = $derived(hoveredDate && selectedDate ? getDateAngle(hoveredDate, selectedDate.getFullYear()) : null);
  let hoverPosition = $derived(
    hoverAngle !== null
      ? polarToCartesian(hoverAngle, (outerRadius + innerRadius) / 2)
      : null
  );
  
  // Generate the ring segments (one per day)
  let ringSegments = $derived.by(() => {
    if (!yearData || yearData.length === 0) return [];
    
    const year = selectedDate?.getFullYear() || new Date().getFullYear();
    const daysInYear = getDaysInYear(year);
    const winterSolsticeDOY = getDayOfYear(getWinterSolstice(year));
    
    return yearData.map((data, i) => {
      // Offset angle so winter solstice is at 0 degrees (top)
      // yearData index 0 = Jan 1 (day 1), so i+1 gives day of year
      let daysFromWS = (i + 1) - winterSolsticeDOY;
      if (daysFromWS < 0) daysFromWS += daysInYear;
      
      const startAngle = (daysFromWS / daysInYear) * 360;
      const endAngle = ((daysFromWS + 1) / daysInYear) * 360;
      
      // Shade by hours of daylight on an absolute 0–24h scale (same as the calendar), so
      // locations compare honestly: the equator is an even ring, the Arctic goes dark
      return {
        startAngle,
        endAngle,
        // Opaque mix with the card surface, so overlapping day slices don't show seams
        fill: `color-mix(in srgb, var(--color-sun) ${Math.round(8 + 82 * ((data.daylightHours ?? 0) / 24))}%, var(--color-halo))`,
        data
      };
    });
  });
  
  // Create arc path
  function describeArc(startAngle, endAngle, innerR, outerR) {
    const start1 = polarToCartesian(startAngle, outerR);
    const end1 = polarToCartesian(endAngle, outerR);
    const start2 = polarToCartesian(endAngle, innerR);
    const end2 = polarToCartesian(startAngle, innerR);
    
    const angleDiff = Math.abs(endAngle - startAngle);
    const largeArcFlag = angleDiff > 180 ? 1 : 0;
    
    const outerSweep = isClockwise ? 1 : 0;
    const innerSweep = isClockwise ? 0 : 1;
    
    return [
      'M', start1.x, start1.y,
      'A', outerR, outerR, 0, largeArcFlag, outerSweep, end1.x, end1.y,
      'L', start2.x, start2.y,
      'A', innerR, innerR, 0, largeArcFlag, innerSweep, end2.x, end2.y,
      'Z'
    ].join(' ');
  }
  
  // Month markers
  let monthMarkers = $derived.by(() => {
    if (!selectedDate) return [];
    
    const year = selectedDate.getFullYear();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const winterSolstice = getWinterSolstice(year);
    const winterSolsticeDOY = getDayOfYear(winterSolstice);
    const daysInYear = getDaysInYear(year);
    
    return months.map((name, i) => {
      const monthStart = new Date(year, i, 1);
      const dayOfYear = getDayOfYear(monthStart);
      
      let daysFromWS = dayOfYear - winterSolsticeDOY;
      if (daysFromWS < 0) daysFromWS += daysInYear;
      
      const angle = (daysFromWS / daysInYear) * 360;
      
      const innerPos = polarToCartesian(angle, innerRadius);
      const outerPos = polarToCartesian(angle, outerRadius);
      
      const midMonthStart = new Date(year, i, 15);
      const midDayOfYear = getDayOfYear(midMonthStart);
      let midDaysFromWS = midDayOfYear - winterSolsticeDOY;
      if (midDaysFromWS < 0) midDaysFromWS += daysInYear;
      const midAngle = (midDaysFromWS / daysInYear) * 360;
      const labelPos = polarToCartesian(midAngle, outerRadius + 20);
      
      return { name, angle, lineStart: innerPos, lineEnd: outerPos, labelPos };
    });
  });
  
  // Solstice and Equinox markers - with hemisphere-appropriate names
  let astronomicalMarkers = $derived.by(() => {
    if (!selectedDate) return [];
    
    const year = selectedDate.getFullYear();
    const daysInYear = getDaysInYear(year);
    const winterSolsticeDOY = getDayOfYear(getWinterSolstice(year));
    
    // Northern hemisphere names - will be swapped for southern hemisphere
    // id is used for positioning (e.g., March equinox needs y-offset regardless of name)
    // Dates are the calendar day each event falls on in the selected timezone
    const events = [
      { id: 'dec-solstice', northernName: 'Winter Solstice', date: calendarDateInTimezone(getWinterSolstice(year), timezone), angle: 0 },
      { id: 'mar-equinox', northernName: 'Spring Equinox', date: calendarDateInTimezone(getMarchEquinox(year), timezone), angle: null },
      { id: 'jun-solstice', northernName: 'Summer Solstice', date: calendarDateInTimezone(getSummerSolstice(year), timezone), angle: 180 },
      { id: 'sep-equinox', northernName: 'Autumn Equinox', date: calendarDateInTimezone(getSeptemberEquinox(year), timezone), angle: null },
    ];
    
    return events.map(event => {
      const dayOfYear = getDayOfYear(event.date);
      let daysFromWS = dayOfYear - winterSolsticeDOY;
      if (daysFromWS < 0) daysFromWS += daysInYear;
      const angle = event.angle !== null ? event.angle : (daysFromWS / daysInYear) * 360;
      
      const markerPos = polarToCartesian(angle, outerRadius + 8);
      const labelPos = polarToCartesian(angle, outerRadius + 44);
      
      const name = getSeasonName(event.northernName, latitude);
      const isEquinox = event.id === 'mar-equinox' || event.id === 'sep-equinox';
      const line1 = isEquinox ? name.replace(/\s+Equinox$/, '') : name; // "Spring" or "Autumn"
      const line2 = isEquinox ? 'Equinox' : null;
      
      return {
        id: event.id,
        name,
        line1,
        line2,
        date: event.date,
        calculatedAngle: angle,
        markerPos,
        labelPos,
        dateStr: `${event.date.getDate()}/${event.date.getMonth() + 1}`
      };
    });
  });
</script>

<ChartCard id="year-overview" title="Year overview" subtitle="The year as a wheel from the winter solstice. Brighter means more daylight." class="h-full">
  {#snippet actions()}
    <label class="flex cursor-pointer items-center gap-2">
      <input
        type="checkbox"
        checked={isClockwise}
        onchange={handleClockwiseChange}
        class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
      />
      <span>Clockwise</span>
    </label>
  {/snippet}

  <div class="flex flex-1 min-h-0 min-w-0 w-full overflow-hidden">
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <svg 
      viewBox="0 0 {viewBoxSize} {viewBoxSize}" 
      class="min-w-0 min-h-0 w-full h-full max-w-full cursor-pointer outline-none aspect-square object-contain"
      preserveAspectRatio="xMidYMid meet"
      onclick={handleRingClick}
      onmousemove={handleRingMouseMove}
      onmouseleave={handleRingMouseLeave}
      role="img"
      aria-label="Year graph showing daylight throughout the year. Click to select a date."
    >
      <g transform="translate({padding}, {padding})">
      <!-- Ring segments (daylight visualization) -->
      {#each ringSegments as segment}
        <path
          d={describeArc(segment.startAngle, segment.endAngle + 0.5, innerRadius, outerRadius)}
          style="fill: {segment.fill}"
          stroke="none"
        />
      {/each}
      
      <!-- Month marker lines -->
      {#each monthMarkers as marker}
        <line
          x1={marker.lineStart.x}
          y1={marker.lineStart.y}
          x2={marker.lineEnd.x}
          y2={marker.lineEnd.y}
          stroke="var(--color-halo)"
          stroke-width="2"
        />
      {/each}
      
      <!-- Inner circle (background) -->
      <circle 
        cx={center} 
        cy={center} 
        r={innerRadius - 2} 
        class="fill-white dark:fill-gray-800"
      />
      
      <!-- Month labels -->
      {#each monthMarkers as marker}
        <text
          x={marker.labelPos.x}
          y={marker.labelPos.y}
          text-anchor="middle"
          dominant-baseline="middle"
          class="fill-gray-600 dark:fill-gray-400 font-medium"
          font-size="13"
        >
          {marker.name}
        </text>
      {/each}
      
      <!-- Solstice and Equinox markers (clickable to select that date); equinox = two stacked lines -->
      {#each astronomicalMarkers as marker}
        {@const yOffset = marker.id === 'mar-equinox' ? 20 : 0}
        <g
          role="button"
          tabindex="0"
          aria-label="Select {marker.name} ({marker.dateStr})"
          class="cursor-pointer hover:opacity-80 outline-none focus:outline-none focus:ring-0"
          onclick={(e) => { e.stopPropagation(); hoveredDate = null; onDateSelect?.(marker.date); }}
          onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onDateSelect?.(marker.date); } }}
        >
          <title>Select {marker.name} ({marker.dateStr})</title>
          <!-- Diamond marker -->
          <g transform="translate({marker.markerPos.x}, {marker.markerPos.y})">
            <!-- Solstice: filled diamond; equinox: hollow -->
            <rect
              x="-5" y="-5"
              width="10" height="10"
              transform="rotate(45)"
              fill={marker.name.includes('Solstice') ? 'var(--color-ink)' : 'var(--color-halo)'}
              stroke="var(--color-ink)"
              stroke-width="2"
              rx="1"
            />
          </g>
          {#if marker.line2}
            <!-- Equinox: "Spring"/"Autumn" on first line, "Equinox" on second -->
            <text
              x={marker.labelPos.x}
              y={marker.labelPos.y - 14 + yOffset}
              text-anchor="middle"
              class="fill-gray-700 dark:fill-gray-300 font-semibold"
              font-size="12"
            >
              {marker.line1}
            </text>
            <text
              x={marker.labelPos.x}
              y={marker.labelPos.y + yOffset}
              text-anchor="middle"
              class="fill-gray-700 dark:fill-gray-300 font-semibold"
              font-size="12"
            >
              {marker.line2}
            </text>
            <text
              x={marker.labelPos.x}
              y={marker.labelPos.y + 16 + yOffset}
              text-anchor="middle"
              class="fill-gray-500 dark:fill-gray-400"
              font-size="11"
            >
              {marker.dateStr}
            </text>
          {:else}
            <!-- Solstice: single line -->
            <text
              x={marker.labelPos.x}
              y={marker.labelPos.y - 8 + yOffset}
              text-anchor="middle"
              class="fill-gray-700 dark:fill-gray-300 font-semibold"
              font-size="13"
            >
              {marker.line1}
            </text>
            <text
              x={marker.labelPos.x}
              y={marker.labelPos.y + 8 + yOffset}
              text-anchor="middle"
              class="fill-gray-500 dark:fill-gray-400"
              font-size="12"
            >
              {marker.dateStr}
            </text>
          {/if}
        </g>
      {/each}
      
      <!-- Hover date marker (for cross-component hover sync) -->
      {#if hoverPosition}
        <g transform="translate({hoverPosition.x}, {hoverPosition.y})">
          <circle r="7" fill="var(--color-ink-muted)" stroke="var(--color-halo)" stroke-width="2" />
        </g>
      {/if}
      
      <!-- Opposite date marker -->
      {#if oppositePosition}
        <g transform="translate({oppositePosition.x}, {oppositePosition.y})">
          <circle r="9" fill="var(--color-halo)" fill-opacity="0.85" />
          <circle r="7" fill="none" stroke="var(--color-ink)" stroke-width="2" stroke-dasharray="3 2.5" />
        </g>
      {/if}
      
      <!-- Current date marker -->
      <g transform="translate({currentPosition.x}, {currentPosition.y})">
        <circle r="10" fill="var(--color-ink)" stroke="var(--color-halo)" stroke-width="3" />
      </g>
      
      <!-- Center text - current date info -->
      <text
        x={center}
        y={center - 20}
        text-anchor="middle"
        class="fill-gray-900 dark:fill-gray-100 font-bold"
        font-size="16"
      >
        {selectedDate ? formatDateShort(selectedDate) : ''}
      </text>
      
      {#if yearData && selectedDate}
        {@const currentDayData = yearData[getDayOfYear(selectedDate) - 1]}
        {#if currentDayData}
          <text
            x={center}
            y={center + 2}
            text-anchor="middle"
            class="fill-gray-700 dark:fill-gray-300"
            font-size="14"
          >
            {formatDuration(currentDayData.daylight)}
          </text>
        {/if}
      {/if}
      
      {#if oppositeDate}
        <g
          role="button"
          tabindex="0"
          class="cursor-pointer hover:opacity-80 outline-none focus:outline-none focus:ring-0"
          onclick={(e) => { e.stopPropagation(); hoveredDate = null; onDateSelect?.(oppositeDate.date); }}
          onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onDateSelect?.(oppositeDate.date); } }}
          style="cursor: pointer;"
        >
          <text
            x={center}
            y={center + 24}
            text-anchor="middle"
            class="fill-gray-500 underline decoration-dotted dark:fill-gray-400"
            font-size="12"
          >
            Mirror date: {formatDateShort(oppositeDate.date)}
          </text>
        </g>
      {/if}
      </g>
    </svg>
  </div>
  
  <!-- Hover tooltip: day stats (only show when hovering directly on this component) -->
  {#if hoveredDate && isHovering}
    <DayTooltip x={tooltipX} y={tooltipY} date={hoveredDate} {latitude} {longitude} {timezone} />
  {/if}

  {#snippet legend()}
    <span class="flex items-center gap-1.5">
      <span class="inline-block h-3 w-16 rounded-sm" style="background: linear-gradient(to right, color-mix(in srgb, var(--color-sun) 8%, transparent), var(--color-sun))"></span>
      0–24h daylight
    </span>
    <span class="flex items-center gap-1.5"><span class="inline-block h-3 w-3 rounded-full bg-gray-900 dark:bg-white"></span>Selected date</span>
    <span class="flex items-center gap-1.5"><span class="inline-block h-3 w-3 rounded-full border-2 border-dashed border-gray-900 dark:border-white"></span>Mirror date</span>
    <span class="flex items-center gap-1.5"><span class="inline-block h-2.5 w-2.5 rotate-45 rounded-[1px] bg-gray-900 dark:bg-white"></span>Solstice</span>
    <span class="flex items-center gap-1.5"><span class="inline-block h-2.5 w-2.5 rotate-45 rounded-[1px] border-2 border-gray-900 dark:border-white"></span>Equinox</span>
  {/snippet}
</ChartCard>
