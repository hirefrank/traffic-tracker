/**
 * Web Dashboard HTML Generation
 */

import type { Env, QueryFilters } from './types';
import {
  getTotalSamples,
  getHourlyData,
  getDayHourData,
  getRouteData,
  getRecentPairedMeasurements,
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
  const [totalSamples, hourly, dayHour, byRoute, recentPaired, bestWorst, dateRange] = await Promise.all([
    getTotalSamples(env.DB, filters),
    getHourlyData(env.DB, filters),
    getDayHourData(env.DB, filters),
    getRouteData(env.DB, filters),
    getRecentPairedMeasurements(env.DB, filters),
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
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          fontFamily: {
            sans: ['DM Sans', 'system-ui', 'sans-serif'],
            mono: ['JetBrains Mono', 'monospace']
          }
        }
      }
    }
  </script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    /* Heatmap cell interactions */
    .heatmap-cell {
      transition: transform 0.15s ease-out, box-shadow 0.15s ease-out;
    }
    .heatmap-cell:hover, .heatmap-cell:focus {
      transform: scale(1.1);
      z-index: 10;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    }

    /* Scroll shadow indicators */
    .scroll-shadow {
      background:
        linear-gradient(to right, white 30%, transparent),
        linear-gradient(to left, white 30%, transparent),
        linear-gradient(to right, rgba(0,0,0,0.08), transparent),
        linear-gradient(to left, rgba(0,0,0,0.08), transparent);
      background-position: left, right, left, right;
      background-size: 30px 100%, 30px 100%, 15px 100%, 15px 100%;
      background-repeat: no-repeat;
      background-attachment: local, local, scroll, scroll;
    }

    /* Skeleton animation */
    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
    .skeleton {
      background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
    }

    /* Fade in animation for table rows */
    @keyframes fadeSlideIn {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .animate-row {
      animation: fadeSlideIn 0.3s ease-out forwards;
      opacity: 0;
    }

    /* Live pulse */
    @keyframes pulse-ring {
      0% { transform: scale(0.8); opacity: 1; }
      100% { transform: scale(2); opacity: 0; }
    }
    .pulse-ring {
      animation: pulse-ring 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    }
  </style>
</head>
<body class="min-h-screen bg-gradient-to-br from-slate-50 via-white to-sky-50/30 font-sans">
  <div class="container mx-auto px-4 py-6 sm:py-8 max-w-7xl">
    <!-- Header -->
    <header class="mb-6 sm:mb-8">
      <h1 class="text-2xl sm:text-3xl font-bold text-slate-800">Traffic Tracker</h1>
      <p class="text-slate-600">${originLabel} ↔ ${destLabel} Travel Times</p>
      <p class="text-sm text-slate-500 mt-1">All times displayed in Eastern Time (ET)</p>
    </header>

    <!-- Filters -->
    <div class="bg-white rounded-xl shadow-sm ring-1 ring-slate-200/50 p-4 mb-6 transition-shadow hover:shadow-md">
      <form id="filterForm" class="space-y-4 md:space-y-0 md:flex md:flex-wrap md:gap-4 md:items-end">
        <div class="grid grid-cols-2 gap-4 md:contents">
          <div>
            <label for="startDate" class="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
            <input type="date" name="startDate" id="startDate"
              value="${filters.startDate || ''}"
              min="${dateRange.min || ''}"
              max="${dateRange.max || ''}"
              class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm
                     focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20
                     transition-colors">
          </div>
          <div>
            <label for="endDate" class="block text-sm font-medium text-slate-700 mb-1">End Date</label>
            <input type="date" name="endDate" id="endDate"
              value="${filters.endDate || ''}"
              min="${dateRange.min || ''}"
              max="${dateRange.max || ''}"
              class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm
                     focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20
                     transition-colors">
          </div>
        </div>
        <div>
          <label for="direction" class="block text-sm font-medium text-slate-700 mb-1">Direction</label>
          <select name="direction" id="direction"
            class="w-full md:w-auto border border-slate-300 rounded-lg px-3 py-2 text-sm
                   focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20
                   transition-colors">
            <option value="">Both</option>
            <option value="outbound" ${filters.direction === 'outbound' ? 'selected' : ''}>${originShort} → ${destShort}</option>
            <option value="inbound" ${filters.direction === 'inbound' ? 'selected' : ''}>${destShort} → ${originShort}</option>
          </select>
        </div>
        <div class="flex items-center">
          <input type="checkbox" name="excludeHolidays" id="excludeHolidays"
            ${filters.excludeHolidays ? 'checked' : ''}
            class="w-4 h-4 rounded border-slate-300 text-blue-600
                   focus:ring-2 focus:ring-blue-500/20 focus:ring-offset-0
                   transition-colors cursor-pointer">
          <label for="excludeHolidays" class="ml-2 text-sm text-slate-700 cursor-pointer">Exclude Holidays</label>
        </div>
        <div class="flex gap-2">
          <button type="submit"
            class="flex-1 md:flex-none bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium
                   transition-all duration-150 ease-out
                   hover:bg-blue-700 hover:shadow-md
                   active:scale-[0.98] active:shadow-sm
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
            Apply
          </button>
          <button type="button" onclick="resetFilters()"
            class="flex-1 md:flex-none bg-slate-100 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium
                   transition-all duration-150 ease-out
                   hover:bg-slate-200
                   active:scale-[0.98]
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2">
            Reset
          </button>
        </div>
        <div class="flex flex-wrap gap-2 pt-3 border-t border-slate-100 md:border-0 md:pt-0 md:ml-auto">
          <button type="button" onclick="setQuickFilter('week')"
            class="px-3 py-1.5 rounded-full text-sm bg-slate-100 text-slate-600
                   transition-all duration-150
                   hover:bg-slate-200 hover:text-slate-800
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2">
            This Week
          </button>
          <button type="button" onclick="setQuickFilter('month')"
            class="px-3 py-1.5 rounded-full text-sm bg-slate-100 text-slate-600
                   transition-all duration-150
                   hover:bg-slate-200 hover:text-slate-800
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2">
            This Month
          </button>
          <button type="button" onclick="setQuickFilter('weekdays')"
            class="px-3 py-1.5 rounded-full text-sm bg-slate-100 text-slate-600
                   transition-all duration-150
                   hover:bg-slate-200 hover:text-slate-800
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2">
            Weekdays Only
          </button>
        </div>
      </form>
    </div>

    <!-- Summary Cards -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <!-- Current Estimate -->
      <div class="bg-white rounded-xl shadow-sm ring-1 ring-slate-200/50 p-4 sm:p-5
                  transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
        <h3 class="text-sm font-medium text-slate-500 mb-2">Current Estimate</h3>
        <div id="currentEstimate">
          <div class="space-y-2">
            <div class="flex justify-between items-center">
              <div class="h-4 w-24 skeleton rounded"></div>
              <div class="h-6 w-16 skeleton rounded"></div>
            </div>
            <div class="flex justify-between items-center">
              <div class="h-4 w-24 skeleton rounded"></div>
              <div class="h-6 w-16 skeleton rounded"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Best Times -->
      <div class="bg-white rounded-xl shadow-sm ring-1 ring-slate-200/50 p-4 sm:p-5
                  transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
        <h3 class="text-sm font-medium text-slate-500 mb-2">Best Times (Fastest)</h3>
        ${
          bestWorst.best.length > 0
            ? `<ul class="space-y-1">
            ${bestWorst.best
              .map(
                (slot) => `
              <li class="text-sm">
                <span class="font-semibold text-emerald-600">${formatDuration(slot.avg_minutes)}</span>
                <span class="text-slate-600">- ${DAY_NAMES[slot.day_of_week]} ${formatTime(slot.hour)}</span>
                <span class="text-slate-500 text-xs">(${formatDirection(slot.direction, originShort, destShort)})</span>
              </li>
            `
              )
              .join('')}
          </ul>`
            : '<p class="text-slate-500 text-sm">Not enough data yet</p>'
        }
      </div>

      <!-- Worst Times -->
      <div class="bg-white rounded-xl shadow-sm ring-1 ring-slate-200/50 p-4 sm:p-5
                  transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
        <h3 class="text-sm font-medium text-slate-500 mb-2">Worst Times (Slowest)</h3>
        ${
          bestWorst.worst.length > 0
            ? `<ul class="space-y-1">
            ${bestWorst.worst
              .map(
                (slot) => `
              <li class="text-sm">
                <span class="font-semibold text-red-600">${formatDuration(slot.avg_minutes)}</span>
                <span class="text-slate-600">- ${DAY_NAMES[slot.day_of_week]} ${formatTime(slot.hour)}</span>
                <span class="text-slate-500 text-xs">(${formatDirection(slot.direction, originShort, destShort)})</span>
              </li>
            `
              )
              .join('')}
          </ul>`
            : '<p class="text-slate-500 text-sm">Not enough data yet</p>'
        }
      </div>
    </div>

    <!-- Charts -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      <!-- Hourly Average Chart -->
      <div class="bg-white rounded-xl shadow-sm ring-1 ring-slate-200/50 p-4 sm:p-5">
        <h3 class="text-lg font-semibold text-slate-800 mb-4">Average Duration by Hour</h3>
        <div class="h-48 sm:h-64 lg:h-72" role="img" aria-label="Line chart showing average travel duration by hour of day">
          <canvas id="hourlyChart"></canvas>
        </div>
      </div>

      <!-- Route Breakdown Chart -->
      <div class="bg-white rounded-xl shadow-sm ring-1 ring-slate-200/50 p-4 sm:p-5">
        <h3 class="text-lg font-semibold text-slate-800 mb-4">By Route</h3>
        <div class="h-48 sm:h-64 lg:h-72" role="img" aria-label="Bar chart comparing travel times by route">
          <canvas id="routeChart"></canvas>
        </div>
      </div>
    </div>

    <!-- Heatmap -->
    <div class="bg-white rounded-xl shadow-sm ring-1 ring-slate-200/50 p-4 sm:p-5 mb-6">
      <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
        <h3 class="text-lg font-semibold text-slate-800">Day/Hour Heatmap</h3>
        <div class="flex gap-2" role="tablist" aria-label="Select direction for heatmap">
          <button onclick="switchHeatmap('outbound')" id="heatmapBtnOutbound" role="tab" aria-selected="true"
            class="px-3 py-1.5 text-sm rounded-lg font-medium bg-blue-600 text-white
                   transition-all duration-150
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
            ${originShort} → ${destShort}
          </button>
          <button onclick="switchHeatmap('inbound')" id="heatmapBtnInbound" role="tab" aria-selected="false"
            class="px-3 py-1.5 text-sm rounded-lg font-medium bg-slate-100 text-slate-600
                   transition-all duration-150
                   hover:bg-slate-200
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2">
            ${destShort} → ${originShort}
          </button>
        </div>
      </div>
      <div id="heatmapContainer" class="overflow-x-auto scroll-shadow -mx-4 px-4 sm:mx-0 sm:px-0">
        <div id="heatmap" class="min-w-max transition-opacity duration-200" role="grid" aria-label="Heatmap showing travel times by day and hour"></div>
      </div>
      <div class="flex justify-center items-center gap-2 mt-4 text-xs text-slate-500">
        <span>Faster</span>
        <div class="w-4 h-4 bg-emerald-500 rounded"></div>
        <div class="w-4 h-4 bg-emerald-300 rounded"></div>
        <div class="w-4 h-4 bg-yellow-300 rounded"></div>
        <div class="w-4 h-4 bg-orange-400 rounded"></div>
        <div class="w-4 h-4 bg-red-500 rounded"></div>
        <span>Slower</span>
      </div>
    </div>

    <!-- Recent Measurements -->
    <div class="bg-white rounded-xl shadow-sm ring-1 ring-slate-200/50 p-4 sm:p-5">
      <h3 class="text-lg font-semibold text-slate-800 mb-3">Recent Measurements</h3>
      ${
        recentPaired.length > 0
          ? `
      <!-- Desktop table -->
      <div class="hidden sm:block overflow-x-auto">
        <table class="w-full">
          <thead>
            <tr class="text-xs text-slate-500 border-b border-slate-200">
              <th class="text-left py-2 font-medium">Time (ET)</th>
              <th class="text-right py-2 font-medium">${originShort} → ${destShort}</th>
              <th class="text-right py-2 font-medium">${destShort} → ${originShort}</th>
            </tr>
          </thead>
          <tbody class="text-sm">
            ${recentPaired
              .map(
                (m, i) => `
              <tr class="border-b border-slate-100 animate-row" style="animation-delay: ${i * 30}ms">
                <td class="py-2 text-slate-600">${formatLocalTime(m.measured_at_local)}</td>
                <td class="py-2 text-right">
                  <span class="font-semibold text-blue-600 font-mono">${m.outbound_seconds ? Math.round(m.outbound_seconds / 60) + 'm' : '-'}</span>
                  ${m.outbound_route ? `<span class="text-xs text-slate-500 ml-1.5">${m.outbound_route}</span>` : ''}
                </td>
                <td class="py-2 text-right">
                  <span class="font-semibold text-emerald-600 font-mono">${m.inbound_seconds ? Math.round(m.inbound_seconds / 60) + 'm' : '-'}</span>
                  ${m.inbound_route ? `<span class="text-xs text-slate-500 ml-1.5">${m.inbound_route}</span>` : ''}
                </td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      </div>

      <!-- Mobile cards -->
      <div class="sm:hidden space-y-3">
        ${recentPaired
          .map(
            (m, i) => `
          <div class="bg-slate-50 rounded-lg p-3 animate-row" style="animation-delay: ${i * 30}ms">
            <div class="text-sm font-medium text-slate-600 mb-2">${formatLocalTime(m.measured_at_local)}</div>
            <div class="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span class="text-slate-500 text-xs block">${originShort} → ${destShort}</span>
                <span class="font-semibold text-blue-600 font-mono">${m.outbound_seconds ? Math.round(m.outbound_seconds / 60) + 'm' : '-'}</span>
                ${m.outbound_route ? `<span class="text-xs text-slate-500 ml-1">${m.outbound_route}</span>` : ''}
              </div>
              <div>
                <span class="text-slate-500 text-xs block">${destShort} → ${originShort}</span>
                <span class="font-semibold text-emerald-600 font-mono">${m.inbound_seconds ? Math.round(m.inbound_seconds / 60) + 'm' : '-'}</span>
                ${m.inbound_route ? `<span class="text-xs text-slate-500 ml-1">${m.inbound_route}</span>` : ''}
              </div>
            </div>
          </div>
        `
          )
          .join('')}
      </div>
      `
          : '<p class="text-slate-500 text-sm">No measurements yet</p>'
      }
    </div>

    <!-- Footer -->
    <footer class="mt-8 pt-4 border-t border-slate-200 text-center text-sm text-slate-500">
      ${totalSamples.toLocaleString()} measurements ${formatDateRange(dateRange.min, dateRange.max)} &middot;
      <a href="https://github.com/hirefrank/traffic-tracker" target="_blank" rel="noopener noreferrer"
         class="text-slate-600 hover:text-slate-800 transition-colors
                focus-visible:outline-none focus-visible:underline">
        View on GitHub
      </a>
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
        container.innerHTML = '<p class="text-slate-500 text-sm py-8 text-center">Not enough data for heatmap</p>';
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

      function getColorClasses(value) {
        if (value <= q1) return { bg: 'bg-emerald-500', text: 'text-white' };
        if (value <= q2) return { bg: 'bg-emerald-300', text: 'text-slate-800' };
        if (value <= q3) return { bg: 'bg-yellow-300', text: 'text-slate-800' };
        if (value <= q3 + (q3 - q2)) return { bg: 'bg-orange-400', text: 'text-white' };
        return { bg: 'bg-red-500', text: 'text-white' };
      }

      let html = '<div class="grid gap-1" style="grid-template-columns: 50px repeat(7, minmax(36px, 1fr));">';

      // Header row
      html += '<div class="text-xs text-slate-500"></div>';
      for (const day of days) {
        html += \`<div class="text-xs text-slate-500 text-center font-medium py-1">\${dayNames[day]}</div>\`;
      }

      // Data rows
      for (const hour of hours) {
        html += \`<div class="text-xs text-slate-500 text-right pr-2 py-1">\${formatHour(hour)}</div>\`;
        for (const day of days) {
          const item = data.find(d => d.day_of_week === day && d.hour === hour);
          if (item) {
            const colors = getColorClasses(item.avg_minutes);
            const mins = Math.round(item.avg_minutes);
            html += \`<button type="button"
              class="heatmap-cell \${colors.bg} \${colors.text} rounded text-center text-xs py-1.5 font-medium
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
              aria-label="\${dayNames[day]} at \${formatHour(hour)}: \${mins} minutes average, \${item.sample_count} samples">
              \${mins}
            </button>\`;
          } else {
            html += '<div class="bg-slate-100 rounded text-center text-xs py-1.5 text-slate-400">-</div>';
          }
        }
      }

      html += '</div>';
      container.innerHTML = html;
    }

    function switchHeatmap(direction) {
      const container = document.getElementById('heatmap');
      const btnOutbound = document.getElementById('heatmapBtnOutbound');
      const btnInbound = document.getElementById('heatmapBtnInbound');

      // Fade out
      container.style.opacity = '0';

      setTimeout(() => {
        currentHeatmapDirection = direction;
        initHeatmap(direction);

        // Update button styles and ARIA
        if (direction === 'outbound') {
          btnOutbound.className = 'px-3 py-1.5 text-sm rounded-lg font-medium bg-blue-600 text-white transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2';
          btnOutbound.setAttribute('aria-selected', 'true');
          btnInbound.className = 'px-3 py-1.5 text-sm rounded-lg font-medium bg-slate-100 text-slate-600 transition-all duration-150 hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2';
          btnInbound.setAttribute('aria-selected', 'false');
        } else {
          btnOutbound.className = 'px-3 py-1.5 text-sm rounded-lg font-medium bg-slate-100 text-slate-600 transition-all duration-150 hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2';
          btnOutbound.setAttribute('aria-selected', 'false');
          btnInbound.className = 'px-3 py-1.5 text-sm rounded-lg font-medium bg-blue-600 text-white transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2';
          btnInbound.setAttribute('aria-selected', 'true');
        }

        // Fade in
        container.style.opacity = '1';
      }, 150);
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
          <div class="space-y-2">
            <div class="flex items-center gap-2 mb-3">
              <span class="relative flex h-2.5 w-2.5">
                <span class="pulse-ring absolute inline-flex h-full w-full rounded-full bg-emerald-400"></span>
                <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span class="text-xs text-emerald-600 font-medium">Live</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-sm text-slate-500">\${originLabel} → \${destLabel}</span>
              <span class="text-lg font-bold text-blue-600 font-mono">\${data.outbound ? data.outbound.duration_minutes + 'm' : 'N/A'}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-sm text-slate-500">\${destLabel} → \${originLabel}</span>
              <span class="text-lg font-bold text-emerald-600 font-mono">\${data.inbound ? data.inbound.duration_minutes + 'm' : 'N/A'}</span>
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

function formatDateRange(min: string | null, max: string | null): string {
  if (!min || !max) return '';

  const formatDate = (d: string) => {
    const date = new Date(d + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (min === max) {
    return `since ${formatDate(min)}`;
  }
  return `from ${formatDate(min)} to ${formatDate(max)}`;
}
