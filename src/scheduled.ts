/**
 * Scheduled Handler - Data Collection
 *
 * Runs every 15 minutes to collect travel time estimates from Google Maps.
 */

import type { Env, Direction } from './types';
import { fetchDirectionsWithRetry, MapsApiError } from './maps-api';
import { isHoliday } from './holidays';
import { parseRoutes, getActiveRoutes } from './routes';

interface CollectionResult {
  success: boolean;
  direction: Direction;
  routeId: string;
  error?: string;
}

/**
 * Get current time in the configured timezone
 */
function getLocalTime(timezone: string): Date {
  const now = new Date();
  const localString = now.toLocaleString('en-US', { timeZone: timezone });
  return new Date(localString);
}

/**
 * Format a date as ISO 8601 string in UTC
 */
function formatUtcTimestamp(date: Date): string {
  return date.toISOString();
}

/**
 * Format a date as ISO 8601 string in local timezone
 */
function formatLocalTimestamp(date: Date, timezone: string): string {
  const year = date.toLocaleString('en-US', { timeZone: timezone, year: 'numeric' });
  const month = date.toLocaleString('en-US', { timeZone: timezone, month: '2-digit' });
  const day = date.toLocaleString('en-US', { timeZone: timezone, day: '2-digit' });
  const hour = date.toLocaleString('en-US', { timeZone: timezone, hour: '2-digit', hour12: false });
  const minute = date.toLocaleString('en-US', { timeZone: timezone, minute: '2-digit' });
  const second = date.toLocaleString('en-US', { timeZone: timezone, second: '2-digit' });

  return `${year}-${month}-${day}T${hour.padStart(2, '0')}:${minute.padStart(2, '0')}:${second.padStart(2, '0')}`;
}

/**
 * Check if current time is within collection hours
 */
function isWithinCollectionHours(localTime: Date, startHour: number, endHour: number): boolean {
  const hour = localTime.getHours();
  return hour >= startHour && hour < endHour;
}

/**
 * Collect travel time for a single direction
 */
async function collectDirection(
  env: Env,
  direction: Direction,
  origin: string,
  destination: string,
  routeId: string,
  now: Date,
  localTime: Date,
  timezone: string
): Promise<CollectionResult> {
  try {
    const result = await fetchDirectionsWithRetry(origin, destination, env.GOOGLE_MAPS_API_KEY);

    const measuredAt = formatUtcTimestamp(now);
    const measuredAtLocal = formatLocalTimestamp(now, timezone);
    const dayOfWeek = localTime.getDay();
    const hourLocal = localTime.getHours();
    const holiday = isHoliday(localTime) ? 1 : 0;

    await env.DB.prepare(
      `INSERT INTO trips (
        measured_at, measured_at_local, direction, duration_seconds,
        duration_in_traffic_seconds, distance_meters, route_summary,
        day_of_week, hour_local, is_holiday, route_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        measuredAt,
        measuredAtLocal,
        direction,
        result.duration_seconds,
        result.duration_in_traffic_seconds,
        result.distance_meters,
        result.route_summary,
        dayOfWeek,
        hourLocal,
        holiday,
        routeId
      )
      .run();

    return { success: true, direction, routeId };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, direction, routeId, error: errorMessage };
  }
}

/**
 * Log collection result to collection_log table
 */
async function logCollection(
  db: D1Database,
  status: 'success' | 'error',
  errorMessage: string | null,
  apiCallsMade: number
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO collection_log (timestamp, status, error_message, api_calls_made)
       VALUES (?, ?, ?, ?)`
    )
    .bind(new Date().toISOString(), status, errorMessage, apiCallsMade)
    .run();
}

/**
 * Main scheduled handler
 */
export async function handleScheduled(env: Env): Promise<void> {
  const timezone = env.TIMEZONE || 'America/New_York';
  const startHour = parseInt(env.START_HOUR || '6', 10);
  const endHour = parseInt(env.END_HOUR || '21', 10);

  const now = new Date();
  const localTime = getLocalTime(timezone);

  // Check if within collection hours
  if (!isWithinCollectionHours(localTime, startHour, endHour)) {
    console.log(
      `Outside collection hours (${startHour}-${endHour}), current hour: ${localTime.getHours()}`
    );
    return;
  }

  // Parse and get active routes
  const routes = parseRoutes(env.ROUTES);
  const activeRoutes = getActiveRoutes(routes);

  // Use D1 batch for atomic operations
  let apiCallsMade = 0;
  const results: CollectionResult[] = [];

  try {
    // Collect data from Google Maps API first (outside transaction)
    for (const route of activeRoutes) {
      // Outbound: ORIGIN → route.destination
      apiCallsMade++;
      const outboundResult = await collectDirection(
        env,
        'outbound',
        env.ORIGIN,
        route.destination,
        route.id,
        now,
        localTime,
        timezone
      );
      results.push(outboundResult);

      // Inbound: route.destination → ORIGIN
      apiCallsMade++;
      const inboundResult = await collectDirection(
        env,
        'inbound',
        route.destination,
        env.ORIGIN,
        route.id,
        now,
        localTime,
        timezone
      );
      results.push(inboundResult);
    }

    // Determine overall status
    const errors = results.filter((r) => !r.success);
    const status = errors.length === 0 ? 'success' : 'error';
    const errorMessage = errors.length > 0 ? errors.map((e) => `${e.routeId}/${e.direction}: ${e.error}`).join('; ') : null;

    // Log the collection
    await logCollection(env.DB, status, errorMessage, apiCallsMade);

    console.log(`Collection completed: ${status}`, {
      apiCallsMade,
      errors: errors.length,
      localTime: localTime.toISOString(),
    });
  } catch (error) {
    // Log error if something unexpected happens
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await logCollection(env.DB, 'error', errorMessage, apiCallsMade);
    console.error('Collection failed:', error);
  }
}
