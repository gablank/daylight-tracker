<script>
  import { getDateAngle, formatDateShort, formatDuration, getDaysInYear, getWinterSolstice, getDayOfYear, getSeasonName } from '../lib/solar.js';
  
  let { selectedDate, yearData, oppositeDate, latitude = 0, onDateSelect = null } = $props();
  
  // SVG dimensions - increased to accommodate labels
  const size = 480;
  const center = size / 2;
  const outerRadius = 160;
  const innerRadius = 95;
  
  // Handle click on the ring to select a date
  function handleRingClick(event) {
    if (!onDateSelect || !selectedDate) return;
    
    // Get click position relative to SVG center
    const svg = event.currentTarget;
    const rect = svg.getBoundingClientRect();
    const scaleX = size / rect.width;
    const scaleY = size / rect.height;
    const x = (event.clientX - rect.left) * scaleX - center;
    const y = (event.clientY - rect.top) * scaleY - center;
    
    // Check if click is within the ring area
    const distance = Math.sqrt(x * x + y * y);
    if (distance < innerRadius - 10 || distance > outerRadius + 30) return;
    
    // Convert to angle (0 = top, clockwise)
    let angle = Math.atan2(x, -y) * 180 / Math.PI;
    if (!isClockwise) angle = -angle;
    if (angle < 0) angle += 360;
    
    // Convert angle to day of year
    const year = selectedDate.getFullYear();
    const daysInYear = getDaysInYear(year);
    const winterSolsticeDOY = getDayOfYear(getWinterSolstice(year));
    
    // Angle 0 = winter solstice, so calculate day from there
    const daysFromWS = Math.round((angle / 360) * daysInYear);
    let targetDOY = winterSolsticeDOY + daysFromWS;
    if (targetDOY > daysInYear) targetDOY -= daysInYear;
    if (targetDOY < 1) targetDOY += daysInYear;
    
    // Create the new date
    const newDate = new Date(year, 0, targetDOY);
    onDateSelect(newDate);
  }
  
  // Load from localStorage, default to clockwise (true)
  let isClockwise = $state(true);
  
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
  
  // Generate the ring segments (one per day)
  let ringSegments = $derived.by(() => {
    if (!yearData || yearData.length === 0) return [];
    
    const year = selectedDate?.getFullYear() || new Date().getFullYear();
    const daysInYear = getDaysInYear(year);
    const winterSolsticeDOY = getDayOfYear(getWinterSolstice(year));
    
    // Find min and max daylight for normalization
    const daylights = yearData.map(d => d.daylight).filter(d => !isNaN(d));
    const minDaylight = Math.min(...daylights);
    const maxDaylight = Math.max(...daylights);
    const range = maxDaylight - minDaylight;
    
    return yearData.map((data, i) => {
      // Offset angle so winter solstice is at 0 degrees (top)
      // yearData index 0 = Jan 1 (day 1), so i+1 gives day of year
      let daysFromWS = (i + 1) - winterSolsticeDOY;
      if (daysFromWS < 0) daysFromWS += daysInYear;
      
      const startAngle = (daysFromWS / daysInYear) * 360;
      const endAngle = ((daysFromWS + 1) / daysInYear) * 360;
      
      // Calculate brightness based on actual daylight data
      let brightness = range > 0 ? (data.daylight - minDaylight) / range : 0.5;
      
      // Handle polar conditions
      if (data.isPolarDay) brightness = 1;
      else if (data.isPolarNight) brightness = 0;
      
      const hue = 200 + brightness * 15;
      const saturation = 50 + brightness * 40;
      const lightness = 20 + brightness * 50;
      
      return {
        startAngle,
        endAngle,
        color: `hsl(${hue}, ${saturation}%, ${lightness}%)`,
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
    const events = [
      { id: 'dec-solstice', northernName: 'Winter Solstice', date: new Date(year, 11, 21), angle: 0 },
      { id: 'mar-equinox', northernName: 'Spring Equinox', date: new Date(year, 2, 20), angle: null },
      { id: 'jun-solstice', northernName: 'Summer Solstice', date: new Date(year, 5, 21), angle: 180 },
      { id: 'sep-equinox', northernName: 'Autumn Equinox', date: new Date(year, 8, 22), angle: null },
    ];
    
    return events.map(event => {
      const dayOfYear = getDayOfYear(event.date);
      let daysFromWS = dayOfYear - winterSolsticeDOY;
      if (daysFromWS < 0) daysFromWS += daysInYear;
      const angle = event.angle !== null ? event.angle : (daysFromWS / daysInYear) * 360;
      
      const markerPos = polarToCartesian(angle, outerRadius + 8);
      const labelPos = polarToCartesian(angle, outerRadius + 52);
      
      return {
        id: event.id,
        name: getSeasonName(event.northernName, latitude),
        date: event.date,
        calculatedAngle: angle,
        markerPos,
        labelPos,
        dateStr: `${event.date.getDate()}/${event.date.getMonth() + 1}`
      };
    });
  });
</script>

<div class="h-full bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm flex flex-col">
  <div class="flex items-center justify-between mb-3">
    <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300">Year Overview</h3>
    
    <!-- Direction toggle -->
    <label class="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 cursor-pointer">
      <input 
        type="checkbox" 
        checked={isClockwise}
        onchange={handleClockwiseChange}
        class="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
      />
      <span>Clockwise</span>
    </label>
  </div>
  
  <div class="flex flex-1 min-h-0 justify-center">
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <svg 
      viewBox="0 0 {size} {size}" 
      class="w-full max-w-xl cursor-pointer outline-none"
      style="max-height: 520px;"
      onclick={handleRingClick}
      role="img"
      aria-label="Year graph showing daylight throughout the year. Click to select a date."
    >
      <!-- Ring segments (daylight visualization) -->
      {#each ringSegments as segment}
        <path
          d={describeArc(segment.startAngle, segment.endAngle + 0.5, innerRadius, outerRadius)}
          fill={segment.color}
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
          stroke="white"
          stroke-width="1"
          opacity="0.5"
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
      
      <!-- Solstice and Equinox markers (clickable to select that date) -->
      {#each astronomicalMarkers as marker}
        {@const yOffset = marker.id === 'mar-equinox' ? 30 : 0}
        <g
          role="button"
          tabindex="0"
          class="cursor-pointer hover:opacity-80 outline-none focus:outline-none focus:ring-0"
          onclick={(e) => { e.stopPropagation(); onDateSelect?.(marker.date); }}
          onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onDateSelect?.(marker.date); } }}
          title="Select {marker.name} ({marker.dateStr})"
        >
          <!-- Diamond marker -->
          <g transform="translate({marker.markerPos.x}, {marker.markerPos.y})">
            <rect 
              x="-6" y="-6" 
              width="12" height="12" 
              transform="rotate(45)"
              class="{marker.name.includes('Solstice') ? 'fill-amber-500' : 'fill-emerald-500'}"
              rx="1"
            />
          </g>
          <text
            x={marker.labelPos.x}
            y={marker.labelPos.y - 8 + yOffset}
            text-anchor="middle"
            class="fill-gray-700 dark:fill-gray-300 font-semibold"
            font-size="13"
          >
            {marker.name}
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
        </g>
      {/each}
      
      <!-- Opposite date marker -->
      {#if oppositePosition}
        <g transform="translate({oppositePosition.x}, {oppositePosition.y})">
          <circle r="10" class="fill-white dark:fill-gray-800" />
          <circle r="8" class="fill-orange-400 dark:fill-orange-500" />
          <circle r="4" class="fill-white dark:fill-gray-800" />
        </g>
      {/if}
      
      <!-- Current date marker -->
      <g transform="translate({currentPosition.x}, {currentPosition.y})">
        <circle r="12" class="fill-white dark:fill-gray-800" />
        <circle r="10" class="fill-red-500 dark:fill-red-500" />
        <circle r="5" class="fill-white dark:fill-gray-800" />
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
        <text
          x={center}
          y={center + 24}
          text-anchor="middle"
          class="fill-orange-500 dark:fill-orange-400"
          font-size="12"
        >
          Mirror: {formatDateShort(oppositeDate.date)}
        </text>
      {/if}
    </svg>
  </div>
  
  <!-- Legend -->
  <div class="mt-4 flex flex-wrap justify-center gap-4 text-xs">
    <div class="flex items-center gap-2">
      <div class="w-4 h-4 rounded-full bg-red-500 border-2 border-white shadow-sm"></div>
      <span class="text-gray-600 dark:text-gray-400">Selected date</span>
    </div>
    <div class="flex items-center gap-2">
      <div class="w-4 h-4 rounded-full bg-orange-400 border-2 border-white shadow-sm"></div>
      <span class="text-gray-600 dark:text-gray-400">Mirror date</span>
    </div>
    <div class="flex items-center gap-2">
      <div class="w-3 h-3 bg-amber-500 rotate-45 rounded-sm"></div>
      <span class="text-gray-600 dark:text-gray-400">Solstice</span>
    </div>
    <div class="flex items-center gap-2">
      <div class="w-3 h-3 bg-emerald-500 rotate-45 rounded-sm"></div>
      <span class="text-gray-600 dark:text-gray-400">Equinox</span>
    </div>
  </div>
</div>
