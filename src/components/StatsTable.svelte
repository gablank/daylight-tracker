<script>
  import { formatDuration, formatDateShort, getSunData, findDateWithGain, getDayOfYear } from '../lib/solar.js';
  import { addDays, formatDurationChange } from '../lib/utils.js';
  
  let { selectedDate, yearData, latitude, oppositeDate, longitude = 0 } = $props();
  
  // Section 0: Mirror/Opposite date info
  let mirrorDateInfo = $derived.by(() => {
    if (!oppositeDate || !selectedDate || !yearData) return null;
    
    const currentData = yearData[getDayOfYear(selectedDate) - 1];
    if (!currentData) return null;
    
    // Look up the opposite date's daylight from yearData
    const oppositeDOY = getDayOfYear(oppositeDate.date);
    const oppositeData = yearData[oppositeDOY - 1];
    if (!oppositeData) return null;
    
    return {
      date: formatDateShort(oppositeDate.date),
      daylight: formatDuration(oppositeData.daylight),
      currentDaylight: formatDuration(currentData.daylight),
      diff: Math.abs(oppositeData.daylight - currentData.daylight)
    };
  });
  
  // Section 1: Future daylight (1w through 10w)
  let futureDaylight = $derived.by(() => {
    if (!yearData || !selectedDate) return [];
    
    const currentData = getSunData(selectedDate, latitude);
    const weeks = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    
    return weeks.map(w => {
      const date = addDays(selectedDate, w * 7);
      const futureData = getSunData(date, latitude);
      const change = futureData.daylight - currentData.daylight;
      
      return {
        label: `+${w}w`,
        date: formatDateShort(date),
        daylight: formatDuration(futureData.daylight),
        change: formatDurationChange(change),
        isGain: change >= 0
      };
    });
  });
  
  // Section 2: Daylight changes - gains and losses
  let daylightChanges = $derived.by(() => {
    if (!yearData || !selectedDate) return [];
    
    // Define changes: positive = gain, negative = loss
    // Values in hours (use fractions for minutes: 1/60 = 1 minute)
    const changes = [
      { value: 1/60, label: '+1m' },
      { value: 1, label: '+1h' },
      { value: 2, label: '+2h' },
      { value: 3, label: '+3h' },
      { value: 4, label: '+4h' },
      { value: -1/60, label: '-1m' },
      { value: -1, label: '-1h' },
      { value: -2, label: '-2h' },
      { value: -3, label: '-3h' },
      { value: -4, label: '-4h' },
    ];
    
    return changes.map(({ value, label }) => {
      const result = findDateWithGain(selectedDate, yearData, value);
      return {
        label,
        date: result ? formatDateShort(result.date) : 'N/A',
        daylight: result ? formatDuration(result.daylight) : '--',
        isGain: value > 0
      };
    });
  });
</script>

<div class="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
  <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">Daylight Statistics</h3>
  
  <!-- Mirror Date section (full width) -->
  {#if mirrorDateInfo}
    <div class="mb-6">
      <h4 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
        Mirror Date
      </h4>
      <div class="bg-orange-50 dark:bg-orange-900/20 rounded-md p-3">
        <p class="text-sm text-gray-700 dark:text-gray-300">
          <span class="font-semibold text-orange-600 dark:text-orange-400">{mirrorDateInfo.date}</span>
          has the same amount of daylight ({mirrorDateInfo.daylight}) as the selected date, 
          but on the opposite side of the winter solstice.
        </p>
      </div>
    </div>
  {/if}
  
  <!-- Two tables side by side -->
  <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
    <!-- Future Daylight -->
    <div>
      <h4 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
        Future Daylight
      </h4>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-200 dark:border-gray-700">
              <th class="text-left py-2 pr-3 font-medium text-gray-600 dark:text-gray-400">Period</th>
              <th class="text-left py-2 pr-3 font-medium text-gray-600 dark:text-gray-400">Date</th>
              <th class="text-left py-2 pr-3 font-medium text-gray-600 dark:text-gray-400">Daylight</th>
              <th class="text-left py-2 font-medium text-gray-600 dark:text-gray-400">Change</th>
            </tr>
          </thead>
          <tbody>
            {#each futureDaylight as row}
              <tr class="border-b border-gray-100 dark:border-gray-700/50">
                <td class="py-1.5 pr-3 text-gray-900 dark:text-gray-100">{row.label}</td>
                <td class="py-1.5 pr-3 text-gray-600 dark:text-gray-400 text-xs">{row.date}</td>
                <td class="py-1.5 pr-3 text-gray-900 dark:text-gray-100 font-medium">{row.daylight}</td>
                <td class="py-1.5 font-medium {row.isGain ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}">
                  {row.change}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
    
    <!-- Daylight Changes -->
    <div>
      <h4 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
        Daylight Changes
      </h4>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-200 dark:border-gray-700">
              <th class="text-left py-2 pr-3 font-medium text-gray-600 dark:text-gray-400">Change</th>
              <th class="text-left py-2 pr-3 font-medium text-gray-600 dark:text-gray-400">Date</th>
              <th class="text-left py-2 font-medium text-gray-600 dark:text-gray-400">Total</th>
            </tr>
          </thead>
          <tbody>
            {#each daylightChanges as row}
              <tr class="border-b border-gray-100 dark:border-gray-700/50">
                <td class="py-1.5 pr-3 font-medium {row.isGain ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}">{row.label}</td>
                <td class="py-1.5 pr-3 text-gray-600 dark:text-gray-400">{row.date}</td>
                <td class="py-1.5 text-gray-900 dark:text-gray-100 font-medium">{row.daylight}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  </div>
</div>
