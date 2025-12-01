/**
 * API Routes
 */

import type { Env, QueryFilters, ApiDataResponse, Direction, Trip } from './types';
import {
  getTotalSamples,
  getHourlyData,
  getDayHourData,
  getRouteData,
  getRecentTrips,
  getBestWorstSlots,
  getAllTrips,
  getHealthStatus,
} from './queries';

/**
 * Parse query parameters into filters
 */
export function parseFilters(url: URL): QueryFilters {
  const startDate = url.searchParams.get('startDate');
  const endDate = url.searchParams.get('endDate');
  const direction = url.searchParams.get('direction') as Direction | null;
  const excludeHolidays = url.searchParams.get('excludeHolidays') === 'true';

  return {
    startDate,
    endDate,
    direction,
    excludeHolidays,
  };
}

/**
 * Verify API authentication
 */
export function verifyAuth(request: Request, apiAccessKey: string): boolean {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return false;

  const [type, token] = authHeader.split(' ');
  if (type !== 'Bearer') return false;

  return token === apiAccessKey;
}

/**
 * Handle /api/data endpoint
 */
export async function handleApiData(request: Request, env: Env): Promise<Response> {
  if (!verifyAuth(request, env.API_ACCESS_KEY)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(request.url);
  const filters = parseFilters(url);

  const [totalSamples, hourly, dayHour, byRoute, recent, bestWorst] = await Promise.all([
    getTotalSamples(env.DB, filters),
    getHourlyData(env.DB, filters),
    getDayHourData(env.DB, filters),
    getRouteData(env.DB, filters),
    getRecentTrips(env.DB, filters),
    getBestWorstSlots(env.DB, filters),
  ]);

  const response: ApiDataResponse = {
    meta: {
      generated_at: new Date().toISOString(),
      filters: {
        startDate: filters.startDate,
        endDate: filters.endDate,
        direction: filters.direction,
        excludeHolidays: filters.excludeHolidays,
      },
      total_samples: totalSamples,
    },
    hourly,
    day_hour: dayHour,
    by_route: byRoute,
    recent,
    best_worst: bestWorst,
  };

  return new Response(JSON.stringify(response, null, 2), {
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Handle /api/export endpoint (CSV)
 */
export async function handleApiExport(request: Request, env: Env): Promise<Response> {
  if (!verifyAuth(request, env.API_ACCESS_KEY)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(request.url);
  const filters = parseFilters(url);

  const trips = await getAllTrips(env.DB, filters);

  // Generate CSV
  const headers = [
    'id',
    'measured_at',
    'measured_at_local',
    'direction',
    'duration_seconds',
    'duration_in_traffic_seconds',
    'distance_meters',
    'route_summary',
    'day_of_week',
    'hour_local',
    'is_holiday',
  ];

  const rows = trips.map((trip) =>
    [
      trip.id,
      trip.measured_at,
      trip.measured_at_local,
      trip.direction,
      trip.duration_seconds,
      trip.duration_in_traffic_seconds,
      trip.distance_meters ?? '',
      `"${(trip.route_summary ?? '').replace(/"/g, '""')}"`,
      trip.day_of_week,
      trip.hour_local,
      trip.is_holiday,
    ].join(',')
  );

  const csv = [headers.join(','), ...rows].join('\n');

  const filename = `traffic-data-${new Date().toISOString().split('T')[0]}.csv`;

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

/**
 * Handle /api/health endpoint
 */
export async function handleApiHealth(env: Env): Promise<Response> {
  const health = await getHealthStatus(env.DB);

  return new Response(JSON.stringify(health, null, 2), {
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Handle /api/current endpoint - get live estimate
 */
export async function handleApiCurrent(env: Env): Promise<Response> {
  const { fetchDirectionsWithRetry } = await import('./maps-api');

  try {
    const [bkToWestport, westportToBk] = await Promise.all([
      fetchDirectionsWithRetry(env.ORIGIN, env.DESTINATION, env.GOOGLE_MAPS_API_KEY),
      fetchDirectionsWithRetry(env.DESTINATION, env.ORIGIN, env.GOOGLE_MAPS_API_KEY),
    ]);

    return new Response(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        bk_to_westport: {
          duration_minutes: Math.round(bkToWestport.duration_in_traffic_seconds / 60),
          route: bkToWestport.route_summary,
        },
        westport_to_bk: {
          duration_minutes: Math.round(westportToBk.duration_in_traffic_seconds / 60),
          route: westportToBk.route_summary,
        },
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: 'Failed to fetch current estimates',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
