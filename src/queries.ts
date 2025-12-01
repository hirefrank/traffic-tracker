/**
 * Database Queries and Data Aggregation
 */

import type {
  QueryFilters,
  HourlyData,
  IntervalData,
  DayHourData,
  DayIntervalData,
  RouteData,
  RecentTrip,
  PairedMeasurement,
  BestWorstSlot,
  HealthResponse,
  Trip,
} from "./types";

/**
 * Build WHERE clause and bindings from filters
 */
function buildWhereClause(filters: QueryFilters): {
  clause: string;
  bindings: unknown[];
} {
  const conditions: string[] = [];
  const bindings: unknown[] = [];

  if (filters.startDate) {
    conditions.push("measured_at_local >= ?");
    bindings.push(`${filters.startDate}T00:00:00`);
  }

  if (filters.endDate) {
    conditions.push("measured_at_local <= ?");
    bindings.push(`${filters.endDate}T23:59:59`);
  }

  if (filters.direction) {
    conditions.push("direction = ?");
    bindings.push(filters.direction);
  }

  if (filters.excludeHolidays) {
    conditions.push("is_holiday = 0");
  }

  const clause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  return { clause, bindings };
}

/**
 * Get total sample count
 */
export async function getTotalSamples(
  db: D1Database,
  filters: QueryFilters,
): Promise<number> {
  const { clause, bindings } = buildWhereClause(filters);
  const query = `SELECT COUNT(*) as count FROM trips ${clause}`;

  const result = await db
    .prepare(query)
    .bind(...bindings)
    .first<{ count: number }>();

  return result?.count ?? 0;
}

/**
 * Get hourly averages
 */
export async function getHourlyData(
  db: D1Database,
  filters: QueryFilters,
): Promise<HourlyData[]> {
  const { clause, bindings } = buildWhereClause(filters);

  const query = `
    SELECT
      hour_local as hour,
      direction,
      ROUND(AVG(duration_in_traffic_seconds) / 60.0, 1) as avg_minutes,
      COUNT(*) as sample_count
    FROM trips
    ${clause}
    GROUP BY hour_local, direction
    ORDER BY hour_local, direction
  `;

  const result = await db
    .prepare(query)
    .bind(...bindings)
    .all<HourlyData>();

  return result.results ?? [];
}

/**
 * Get 15-minute interval averages
 */
export async function getIntervalData(
  db: D1Database,
  filters: QueryFilters,
): Promise<IntervalData[]> {
  const { clause, bindings } = buildWhereClause(filters);

  const query = `
    SELECT
      hour_local as hour,
      (CAST(substr(measured_at_local, 15, 2) AS INTEGER) / 15) * 15 as minute,
      direction,
      ROUND(AVG(duration_in_traffic_seconds) / 60.0, 1) as avg_minutes,
      COUNT(*) as sample_count
    FROM trips
    ${clause}
    GROUP BY hour_local, minute, direction
    ORDER BY hour_local, minute, direction
  `;

  const result = await db
    .prepare(query)
    .bind(...bindings)
    .all<IntervalData>();

  return result.results ?? [];
}

/**
 * Get day/hour breakdown
 */
export async function getDayHourData(
  db: D1Database,
  filters: QueryFilters,
): Promise<DayHourData[]> {
  const { clause, bindings } = buildWhereClause(filters);

  const query = `
    SELECT
      day_of_week,
      hour_local as hour,
      direction,
      ROUND(AVG(duration_in_traffic_seconds) / 60.0, 1) as avg_minutes,
      COUNT(*) as sample_count
    FROM trips
    ${clause}
    GROUP BY day_of_week, hour_local, direction
    ORDER BY day_of_week, hour_local, direction
  `;

  const result = await db
    .prepare(query)
    .bind(...bindings)
    .all<DayHourData>();

  return result.results ?? [];
}

/**
 * Get day/30-minute interval breakdown
 */
export async function getDayIntervalData(
  db: D1Database,
  filters: QueryFilters,
): Promise<DayIntervalData[]> {
  const { clause, bindings } = buildWhereClause(filters);

  const query = `
    SELECT
      day_of_week,
      hour_local as hour,
      (CAST(substr(measured_at_local, 15, 2) AS INTEGER) / 30) * 30 as minute,
      direction,
      ROUND(AVG(duration_in_traffic_seconds) / 60.0, 1) as avg_minutes,
      COUNT(*) as sample_count
    FROM trips
    ${clause}
    GROUP BY day_of_week, hour_local, minute, direction
    ORDER BY day_of_week, hour_local, minute, direction
  `;

  const result = await db
    .prepare(query)
    .bind(...bindings)
    .all<DayIntervalData>();

  return result.results ?? [];
}

/**
 * Get route breakdown
 */
export async function getRouteData(
  db: D1Database,
  filters: QueryFilters,
): Promise<RouteData[]> {
  const { clause, bindings } = buildWhereClause(filters);

  const query = `
    SELECT
      route_summary,
      direction,
      ROUND(AVG(duration_in_traffic_seconds) / 60.0, 1) as avg_minutes,
      COUNT(*) as sample_count
    FROM trips
    ${clause}
    GROUP BY route_summary, direction
    ORDER BY direction, avg_minutes
  `;

  const result = await db
    .prepare(query)
    .bind(...bindings)
    .all<RouteData>();

  return result.results ?? [];
}

/**
 * Get recent trips
 */
export async function getRecentTrips(
  db: D1Database,
  filters: QueryFilters,
  limit = 20,
): Promise<RecentTrip[]> {
  const { clause, bindings } = buildWhereClause(filters);

  const query = `
    SELECT
      measured_at_local,
      direction,
      duration_in_traffic_seconds,
      route_summary
    FROM trips
    ${clause}
    ORDER BY measured_at DESC
    LIMIT ?
  `;

  const result = await db
    .prepare(query)
    .bind(...bindings, limit)
    .all<RecentTrip>();

  return result.results ?? [];
}

/**
 * Get recent paired measurements (both directions per timestamp)
 */
export async function getRecentPairedMeasurements(
  db: D1Database,
  filters: QueryFilters,
  limit = 6,
): Promise<PairedMeasurement[]> {
  // Build WHERE clause without direction filter for pairing
  const pairFilters = { ...filters, direction: null };
  const { clause, bindings } = buildWhereClause(pairFilters);

  const query = `
    SELECT
      substr(measured_at_local, 1, 16) as measured_at_local,
      MAX(CASE WHEN direction = 'outbound' THEN duration_in_traffic_seconds END) as outbound_seconds,
      MAX(CASE WHEN direction = 'inbound' THEN duration_in_traffic_seconds END) as inbound_seconds,
      MAX(CASE WHEN direction = 'outbound' THEN route_summary END) as outbound_route,
      MAX(CASE WHEN direction = 'inbound' THEN route_summary END) as inbound_route
    FROM trips
    ${clause}
    GROUP BY substr(measured_at_local, 1, 16)
    ORDER BY measured_at_local DESC
    LIMIT ?
  `;

  const result = await db
    .prepare(query)
    .bind(...bindings, limit)
    .all<PairedMeasurement>();

  return result.results ?? [];
}

/**
 * Get best and worst time slots
 */
export async function getBestWorstSlots(
  db: D1Database,
  filters: QueryFilters,
  minSamples = 5,
): Promise<{ best: BestWorstSlot[]; worst: BestWorstSlot[] }> {
  const { clause, bindings } = buildWhereClause(filters);

  // We need day_of_week and hour combinations with minimum sample count
  const baseQuery = `
    SELECT
      day_of_week,
      hour_local as hour,
      direction,
      ROUND(AVG(duration_in_traffic_seconds) / 60.0, 1) as avg_minutes,
      COUNT(*) as sample_count
    FROM trips
    ${clause}
    GROUP BY day_of_week, hour_local, direction
    HAVING COUNT(*) >= ?
  `;

  // Get best slots (lowest avg duration)
  const bestQuery = `${baseQuery} ORDER BY avg_minutes ASC LIMIT 3`;
  const bestResult = await db
    .prepare(bestQuery)
    .bind(...bindings, minSamples)
    .all<BestWorstSlot>();

  // Get worst slots (highest avg duration)
  const worstQuery = `${baseQuery} ORDER BY avg_minutes DESC LIMIT 3`;
  const worstResult = await db
    .prepare(worstQuery)
    .bind(...bindings, minSamples)
    .all<BestWorstSlot>();

  return {
    best: bestResult.results ?? [],
    worst: worstResult.results ?? [],
  };
}

/**
 * Get all trips for CSV export
 */
export async function getAllTrips(
  db: D1Database,
  filters: QueryFilters,
): Promise<Trip[]> {
  const { clause, bindings } = buildWhereClause(filters);

  const query = `
    SELECT *
    FROM trips
    ${clause}
    ORDER BY measured_at DESC
  `;

  const result = await db
    .prepare(query)
    .bind(...bindings)
    .all<Trip>();

  return result.results ?? [];
}

/**
 * Get health status
 */
export async function getHealthStatus(db: D1Database): Promise<HealthResponse> {
  // Get last successful collection
  const lastCollection = await db
    .prepare(
      `SELECT timestamp FROM collection_log
       WHERE status = 'success'
       ORDER BY timestamp DESC
       LIMIT 1`,
    )
    .first<{ timestamp: string }>();

  // Get sample count in last 24 hours
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const sampleCount = await db
    .prepare(`SELECT COUNT(*) as count FROM trips WHERE measured_at >= ?`)
    .bind(oneDayAgo)
    .first<{ count: number }>();

  // Get last error
  const lastError = await db
    .prepare(
      `SELECT error_message FROM collection_log
       WHERE status = 'error'
       ORDER BY timestamp DESC
       LIMIT 1`,
    )
    .first<{ error_message: string }>();

  // Determine health status
  // Unhealthy if no collections in last 2 hours during expected collection time
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const isHealthy =
    !lastCollection || new Date(lastCollection.timestamp) > twoHoursAgo
      ? "healthy"
      : "unhealthy";

  return {
    status: isHealthy,
    last_collection: lastCollection?.timestamp ?? null,
    last_24h_samples: sampleCount?.count ?? 0,
    last_error: lastError?.error_message ?? null,
  };
}

/**
 * Get date range of available data
 */
export async function getDateRange(
  db: D1Database,
): Promise<{ min: string | null; max: string | null }> {
  const result = await db
    .prepare(
      `SELECT
        MIN(date(measured_at_local)) as min_date,
        MAX(date(measured_at_local)) as max_date
       FROM trips`,
    )
    .first<{ min_date: string; max_date: string }>();

  return {
    min: result?.min_date ?? null,
    max: result?.max_date ?? null,
  };
}
