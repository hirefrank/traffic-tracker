/**
 * Web Dashboard HTML Generation
 */

import type { Env, QueryFilters } from './types';
import {
  getTotalSamples,
  getHourlyData,
  getDayHourData,
  getRouteData,
  getRecentTrips,
  getBestWorstSlots,
  getDateRange,
} from './queries';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatTime(hour: number): string {
  if (hour === 0) return '12am';
  if (hour === 12) return '12pm';
  if (hour < 12) return `${hour}am`;
  return `${hour - 12}pm`;
}

function formatDuration(minutes: number): string {
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hrs > 0) {
    return `${hrs}h ${mins}m`;
  }
  return `${mins}m`;
}

function formatDirection(direction: string, originLabel: string, destLabel: string): string {
  return direction === 'outbound' ? `${originLabel} → ${destLabel}` : `${destLabel} → ${originLabel}`;
}

export async function generateDashboard(env: Env, filters: QueryFilters): Promise<string> {
  // Get labels from env vars with defaults
  const originLabel = env.ORIGIN_LABEL || 'Origin';
  const destLabel = env.DESTINATION_LABEL || 'Destination';
  const originShort = originLabel.substring(0, 10);
  const destShort = destLabel.substring(0, 10);

  // Fetch all data
  const [totalSamples, hourly, dayHour, byRoute, recent, bestWorst, dateRange] = await Promise.all([
    getTotalSamples(env.DB, filters),
    getHourlyData(env.DB, filters),
    getDayHourData(env.DB, filters),
    getRouteData(env.DB, filters),
    getRecentTrips(env.DB, filters),
    getBestWorstSlots(env.DB, filters),
    getDateRange(env.DB),
  ]);

  // Prepare chart data
  const hourlyChartData = JSON.stringify(hourly);
  const dayHourChartData = JSON.stringify(dayHour);
  const routeChartData = JSON.stringify(byRoute);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Traffic Tracker - ${originLabel} ↔ ${destLabel}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    .heatmap-cell {
      transition: transform 0.1s ease-in-out;
    }
    .heatmap-cell:hover {
      transform: scale(1.1);
      z-index: 10;
    }
  </style>
</head>
<body class="bg-gray-100 min-h-screen">
  <div class="container mx-auto px-4 py-8 max-w-7xl">
    <!-- Header -->
    <header class="mb-8">
      <h1 class="text-3xl font-bold text-gray-800">Traffic Tracker</h1>
      <p class="text-gray-600">${originLabel} ↔ ${destLabel} Travel Times</p>
      <p class="text-sm text-gray-500 mt-1">All times displayed in Eastern Time (ET)</p>
    </header>

    <!-- Filters -->
    <div class="bg-white rounded-lg shadow p-4 mb-6">
      <form id="filterForm" class="flex flex-wrap gap-4 items-end">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
          <input type="date" name="startDate" id="startDate"
            value="${filters.startDate || ''}"
            min="${dateRange.min || ''}"
            max="${dateRange.max || ''}"
            class="border rounded px-3 py-2 text-sm">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">End Date</label>
          <input type="date" name="endDate" id="endDate"
            value="${filters.endDate || ''}"
            min="${dateRange.min || ''}"
            max="${dateRange.max || ''}"
            class="border rounded px-3 py-2 text-sm">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Direction</label>
          <select name="direction" id="direction" class="border rounded px-3 py-2 text-sm">
            <option value="">Both</option>
            <option value="outbound" ${filters.direction === 'outbound' ? 'selected' : ''}>${originShort} → ${destShort}</option>
            <option value="inbound" ${filters.direction === 'inbound' ? 'selected' : ''}>${destShort} → ${originShort}</option>
          </select>
        </div>
        <div class="flex items-center">
          <input type="checkbox" name="excludeHolidays" id="excludeHolidays"
            ${filters.excludeHolidays ? 'checked' : ''}
            class="mr-2">
          <label for="excludeHolidays" class="text-sm text-gray-700">Exclude Holidays</label>
        </div>
        <div class="flex gap-2">
          <button type="submit" class="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">
            Apply
          </button>
          <button type="button" onclick="resetFilters()" class="bg-gray-200 px-4 py-2 rounded text-sm hover:bg-gray-300">
            Reset
          </button>
        </div>
        <div class="flex gap-2 ml-auto">
          <button type="button" onclick="setQuickFilter('week')" class="text-sm text-blue-600 hover:underline">This Week</button>
          <button type="button" onclick="setQuickFilter('month')" class="text-sm text-blue-600 hover:underline">This Month</button>
          <button type="button" onclick="setQuickFilter('weekdays')" class="text-sm text-blue-600 hover:underline">Weekdays Only</button>
        </div>
      </form>
    </div>

    <!-- Summary Cards -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <!-- Current Estimate -->
      <div class="bg-white rounded-lg shadow p-4">
        <h3 class="text-sm font-medium text-gray-500 mb-2">Current Estimate</h3>
        <div id="currentEstimate" class="text-2xl font-bold text-gray-800">
          <span class="animate-pulse">Loading...</span>
        </div>
      </div>

      <!-- Best Times -->
      <div class="bg-white rounded-lg shadow p-4">
        <h3 class="text-sm font-medium text-gray-500 mb-2">Best Times (Fastest)</h3>
        ${
          bestWorst.best.length > 0
            ? `<ul class="space-y-1">
            ${bestWorst.best
              .map(
                (slot) => `
              <li class="text-sm">
                <span class="font-medium text-green-600">${formatDuration(slot.avg_minutes)}</span>
                <span class="text-gray-600">- ${DAY_NAMES[slot.day_of_week]} ${formatTime(slot.hour)}</span>
                <span class="text-gray-400 text-xs">(${formatDirection(slot.direction, originShort, destShort)})</span>
              </li>
            `
              )
              .join('')}
          </ul>`
            : '<p class="text-gray-400 text-sm">Not enough data yet</p>'
        }
      </div>

      <!-- Worst Times -->
      <div class="bg-white rounded-lg shadow p-4">
        <h3 class="text-sm font-medium text-gray-500 mb-2">Worst Times (Slowest)</h3>
        ${
          bestWorst.worst.length > 0
            ? `<ul class="space-y-1">
            ${bestWorst.worst
              .map(
                (slot) => `
              <li class="text-sm">
                <span class="font-medium text-red-600">${formatDuration(slot.avg_minutes)}</span>
                <span class="text-gray-600">- ${DAY_NAMES[slot.day_of_week]} ${formatTime(slot.hour)}</span>
                <span class="text-gray-400 text-xs">(${formatDirection(slot.direction, originShort, destShort)})</span>
              </li>
            `
              )
              .join('')}
          </ul>`
            : '<p class="text-gray-400 text-sm">Not enough data yet</p>'
        }
      </div>
    </div>

    <!-- Stats -->
    <div class="bg-white rounded-lg shadow p-4 mb-6">
      <p class="text-sm text-gray-600">
        <span class="font-medium">${totalSamples.toLocaleString()}</span> measurements collected
        ${dateRange.min && dateRange.max ? ` from ${dateRange.min} to ${dateRange.max}` : ''}
      </p>
    </div>

    <!-- Charts -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      <!-- Hourly Average Chart -->
      <div class="bg-white rounded-lg shadow p-4">
        <h3 class="text-lg font-medium text-gray-800 mb-4">Average Duration by Hour</h3>
        <div class="h-64">
          <canvas id="hourlyChart"></canvas>
        </div>
      </div>

      <!-- Route Breakdown Chart -->
      <div class="bg-white rounded-lg shadow p-4">
        <h3 class="text-lg font-medium text-gray-800 mb-4">By Route</h3>
        <div class="h-64">
          <canvas id="routeChart"></canvas>
        </div>
      </div>
    </div>

    <!-- Heatmap -->
    <div class="bg-white rounded-lg shadow p-4 mb-6">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-lg font-medium text-gray-800">Day/Hour Heatmap</h3>
        <div class="flex gap-2">
          <button onclick="switchHeatmap('outbound')" id="heatmapBtnOutbound"
            class="px-3 py-1 text-sm rounded bg-blue-600 text-white">${originShort} → ${destShort}</button>
          <button onclick="switchHeatmap('inbound')" id="heatmapBtnInbound"
            class="px-3 py-1 text-sm rounded bg-gray-200">${destShort} → ${originShort}</button>
        </div>
      </div>
      <div id="heatmapContainer" class="overflow-x-auto">
        <div id="heatmap" class="min-w-max"></div>
      </div>
      <div class="flex justify-center items-center gap-2 mt-4 text-xs text-gray-500">
        <span>Faster</span>
        <div class="w-4 h-4 bg-green-500 rounded"></div>
        <div class="w-4 h-4 bg-green-300 rounded"></div>
        <div class="w-4 h-4 bg-yellow-300 rounded"></div>
        <div class="w-4 h-4 bg-orange-400 rounded"></div>
        <div class="w-4 h-4 bg-red-500 rounded"></div>
        <span>Slower</span>
      </div>
    </div>

    <!-- Recent Measurements Table -->
    <div class="bg-white rounded-lg shadow p-4">
      <h3 class="text-lg font-medium text-gray-800 mb-4">Recent Measurements</h3>
      ${
        recent.length > 0
          ? `
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead>
            <tr>
              <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Time (ET)</th>
              <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Direction</th>
              <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
              <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Route</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200">
            ${recent
              .map(
                (trip) => `
              <tr class="hover:bg-gray-50">
                <td class="px-4 py-2 text-sm text-gray-900">${formatLocalTime(trip.measured_at_local)}</td>
                <td class="px-4 py-2 text-sm text-gray-600">${formatDirection(trip.direction, originShort, destShort)}</td>
                <td class="px-4 py-2 text-sm font-medium">${formatDuration(trip.duration_in_traffic_seconds / 60)}</td>
                <td class="px-4 py-2 text-sm text-gray-600">${trip.route_summary || '-'}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      </div>
      `
          : '<p class="text-gray-400 text-sm">No measurements yet</p>'
      }
    </div>

    <!-- Footer -->
    <footer class="mt-8 pt-4 border-t border-gray-200 text-center text-sm text-gray-500">
      <a href="https://github.com/hirefrank/traffic-tracker" target="_blank" rel="noopener noreferrer" class="hover:text-gray-700">View on GitHub</a>
    </footer>
  </div>

  <script>
    // Data from server
    const hourlyData = ${hourlyChartData};
    const dayHourData = ${dayHourChartData};
    const routeData = ${routeChartData};
    const originLabel = '${originShort}';
    const destLabel = '${destShort}';

    // Initialize hourly chart
    function initHourlyChart() {
      const ctx = document.getElementById('hourlyChart').getContext('2d');

      const hours = [...new Set(hourlyData.map(d => d.hour))].sort((a, b) => a - b);
      const outboundData = hours.map(h => {
        const item = hourlyData.find(d => d.hour === h && d.direction === 'outbound');
        return item ? item.avg_minutes : null;
      });
      const inboundData = hours.map(h => {
        const item = hourlyData.find(d => d.hour === h && d.direction === 'inbound');
        return item ? item.avg_minutes : null;
      });

      new Chart(ctx, {
        type: 'line',
        data: {
          labels: hours.map(h => formatHour(h)),
          datasets: [
            {
              label: originLabel + ' → ' + destLabel,
              data: outboundData,
              borderColor: '#3b82f6',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              tension: 0.3,
              fill: true,
            },
            {
              label: destLabel + ' → ' + originLabel,
              data: inboundData,
              borderColor: '#10b981',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              tension: 0.3,
              fill: true,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom' },
          },
          scales: {
            y: {
              beginAtZero: false,
              title: { display: true, text: 'Minutes' },
            },
          },
        },
      });
    }

    // Initialize route chart
    function initRouteChart() {
      const ctx = document.getElementById('routeChart').getContext('2d');

      const routes = [...new Set(routeData.map(d => d.route_summary))];
      const outboundRouteData = routes.map(r => {
        const item = routeData.find(d => d.route_summary === r && d.direction === 'outbound');
        return item ? item.avg_minutes : 0;
      });
      const inboundRouteData = routes.map(r => {
        const item = routeData.find(d => d.route_summary === r && d.direction === 'inbound');
        return item ? item.avg_minutes : 0;
      });

      new Chart(ctx, {
        type: 'bar',
        data: {
          labels: routes,
          datasets: [
            {
              label: originLabel + ' → ' + destLabel,
              data: outboundRouteData,
              backgroundColor: '#3b82f6',
            },
            {
              label: destLabel + ' → ' + originLabel,
              data: inboundRouteData,
              backgroundColor: '#10b981',
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom' },
          },
          scales: {
            y: {
              beginAtZero: false,
              title: { display: true, text: 'Minutes' },
            },
          },
        },
      });
    }

    // Initialize heatmap
    let currentHeatmapDirection = 'outbound';

    function initHeatmap(direction) {
      const container = document.getElementById('heatmap');
      const data = dayHourData.filter(d => d.direction === direction);

      if (data.length === 0) {
        container.innerHTML = '<p class="text-gray-400 text-sm py-8 text-center">Not enough data for heatmap</p>';
        return;
      }

      const days = [0, 1, 2, 3, 4, 5, 6];
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const hours = [...new Set(data.map(d => d.hour))].sort((a, b) => a - b);

      // Calculate quartiles for coloring
      const allValues = data.map(d => d.avg_minutes).sort((a, b) => a - b);
      const q1 = allValues[Math.floor(allValues.length * 0.25)] || 0;
      const q2 = allValues[Math.floor(allValues.length * 0.5)] || 0;
      const q3 = allValues[Math.floor(allValues.length * 0.75)] || 0;

      function getColor(value) {
        if (value <= q1) return 'bg-green-500';
        if (value <= q2) return 'bg-green-300';
        if (value <= q3) return 'bg-yellow-300';
        if (value <= q3 + (q3 - q2)) return 'bg-orange-400';
        return 'bg-red-500';
      }

      let html = '<div class="grid gap-1" style="grid-template-columns: 50px repeat(7, 1fr);">';

      // Header row
      html += '<div class="text-xs text-gray-500"></div>';
      for (const day of days) {
        html += \`<div class="text-xs text-gray-500 text-center font-medium">\${dayNames[day]}</div>\`;
      }

      // Data rows
      for (const hour of hours) {
        html += \`<div class="text-xs text-gray-500 text-right pr-2">\${formatHour(hour)}</div>\`;
        for (const day of days) {
          const item = data.find(d => d.day_of_week === day && d.hour === hour);
          if (item) {
            const color = getColor(item.avg_minutes);
            const mins = Math.round(item.avg_minutes);
            html += \`<div class="heatmap-cell \${color} rounded text-center text-xs py-1 cursor-pointer relative"
              title="\${dayNames[day]} \${formatHour(hour)}: \${mins}min (\${item.sample_count} samples)">
              \${mins}
            </div>\`;
          } else {
            html += '<div class="bg-gray-100 rounded text-center text-xs py-1 text-gray-400">-</div>';
          }
        }
      }

      html += '</div>';
      container.innerHTML = html;
    }

    function switchHeatmap(direction) {
      currentHeatmapDirection = direction;
      initHeatmap(direction);

      // Update button styles
      const btnOutbound = document.getElementById('heatmapBtnOutbound');
      const btnInbound = document.getElementById('heatmapBtnInbound');

      if (direction === 'outbound') {
        btnOutbound.className = 'px-3 py-1 text-sm rounded bg-blue-600 text-white';
        btnInbound.className = 'px-3 py-1 text-sm rounded bg-gray-200';
      } else {
        btnOutbound.className = 'px-3 py-1 text-sm rounded bg-gray-200';
        btnInbound.className = 'px-3 py-1 text-sm rounded bg-blue-600 text-white';
      }
    }

    // Load current estimate
    async function loadCurrentEstimate() {
      const container = document.getElementById('currentEstimate');
      try {
        const res = await fetch('/api/current');
        const data = await res.json();

        if (data.error) {
          container.innerHTML = '<span class="text-red-500 text-sm">Unable to load</span>';
          return;
        }

        container.innerHTML = \`
          <div class="space-y-1">
            <div class="flex justify-between items-center">
              <span class="text-sm text-gray-500">\${originLabel} → \${destLabel}:</span>
              <span class="text-lg font-bold text-blue-600">\${data.outbound ? data.outbound.duration_minutes + 'min' : 'N/A'}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-sm text-gray-500">\${destLabel} → \${originLabel}:</span>
              <span class="text-lg font-bold text-green-600">\${data.inbound ? data.inbound.duration_minutes + 'min' : 'N/A'}</span>
            </div>
          </div>
        \`;
      } catch (e) {
        container.innerHTML = '<span class="text-red-500 text-sm">Unable to load</span>';
      }
    }

    // Utility functions
    function formatHour(hour) {
      if (hour === 0) return '12am';
      if (hour === 12) return '12pm';
      if (hour < 12) return hour + 'am';
      return (hour - 12) + 'pm';
    }

    // Filter handling
    document.getElementById('filterForm').addEventListener('submit', function(e) {
      e.preventDefault();
      applyFilters();
    });

    function applyFilters() {
      const params = new URLSearchParams();
      const startDate = document.getElementById('startDate').value;
      const endDate = document.getElementById('endDate').value;
      const direction = document.getElementById('direction').value;
      const excludeHolidays = document.getElementById('excludeHolidays').checked;

      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (direction) params.set('direction', direction);
      if (excludeHolidays) params.set('excludeHolidays', 'true');

      window.location.href = '/?' + params.toString();
    }

    function resetFilters() {
      window.location.href = '/';
    }

    function setQuickFilter(type) {
      const now = new Date();
      const params = new URLSearchParams(window.location.search);

      if (type === 'week') {
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        params.set('startDate', weekAgo.toISOString().split('T')[0]);
        params.delete('endDate');
      } else if (type === 'month') {
        const monthAgo = new Date(now);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        params.set('startDate', monthAgo.toISOString().split('T')[0]);
        params.delete('endDate');
      } else if (type === 'weekdays') {
        params.set('excludeHolidays', 'true');
      }

      window.location.href = '/?' + params.toString();
    }

    // Initialize on load
    document.addEventListener('DOMContentLoaded', function() {
      initHourlyChart();
      initRouteChart();
      initHeatmap('outbound');
      loadCurrentEstimate();
    });
  </script>
</body>
</html>`;
}

function formatLocalTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}
