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
  const excludeHolidays = url.searchParams.get('excludeHolidays') === 'true';

  // Validate direction parameter at runtime
  const directionParam = url.searchParams.get('direction');
  const direction: Direction | null =
    directionParam === 'outbound' || directionParam === 'inbound'
      ? directionParam
      : null;

  return {
    startDate,
    endDate,
    direction,
    excludeHolidays,
  };
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Verify API authentication
 */
export function verifyAuth(request: Request, apiAccessKey: string): boolean {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return false;

  const [type, token] = authHeader.split(' ');
  if (type !== 'Bearer') return false;

  return timingSafeEqual(token, apiAccessKey);
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
 * Handle /api/current endpoint - get most recent estimates from database
 */
export async function handleApiCurrent(env: Env): Promise<Response> {
  try {
    // Query most recent trip data for each direction (collected every 15 min)
    const recent = await env.DB.prepare(`
      SELECT direction, duration_in_traffic_seconds, route_summary, measured_at_local
      FROM trips
      WHERE measured_at >= datetime('now', '-30 minutes')
      ORDER BY measured_at DESC
    `).all<{
      direction: string;
      duration_in_traffic_seconds: number;
      route_summary: string | null;
      measured_at_local: string;
    }>();

    const outbound = recent.results?.find(r => r.direction === 'outbound');
    const inbound = recent.results?.find(r => r.direction === 'inbound');

    if (!outbound && !inbound) {
      return new Response(
        JSON.stringify({
          error: 'No recent data available',
          message: 'Traffic data is collected every 15 minutes. Please try again later.',
        }),
        {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        data_from: outbound?.measured_at_local || inbound?.measured_at_local,
        outbound: outbound ? {
          duration_minutes: Math.round(outbound.duration_in_traffic_seconds / 60),
          route: outbound.route_summary,
        } : null,
        inbound: inbound ? {
          duration_minutes: Math.round(inbound.duration_in_traffic_seconds / 60),
          route: inbound.route_summary,
        } : null,
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
