/**
 * Advanced Statistical Analysis for Traffic Data
 */

import type {
  QueryFilters,
  StatisticalSummary,
  HourlyVariance,
  TrafficPattern,
  Direction,
} from './types';

function buildWhereClause(filters: QueryFilters): {
  clause: string;
  bindings: unknown[];
} {
  const conditions: string[] = [];
  const bindings: unknown[] = [];

  if (filters.startDate) {
    conditions.push('measured_at_local >= ?');
    bindings.push(`${filters.startDate}T00:00:00`);
  }

  if (filters.endDate) {
    conditions.push('measured_at_local <= ?');
    bindings.push(`${filters.endDate}T23:59:59`);
  }

  if (filters.direction) {
    conditions.push('direction = ?');
    bindings.push(filters.direction);
  }

  if (filters.excludeHolidays) {
    conditions.push('is_holiday = 0');
  }

  if (filters.routeId) {
    conditions.push('route_id = ?');
    bindings.push(filters.routeId);
  }

  const clause =
    conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return { clause, bindings };
}

/**
 * Calculate comprehensive statistical summary
 * Includes percentiles, standard deviation, and coefficient of variation
 */
export async function getStatisticalSummary(
  db: D1Database,
  filters: QueryFilters
): Promise<StatisticalSummary[]> {
  const { clause, bindings } = buildWhereClause(filters);

  // Get all durations for percentile calculation
  const query = `
    SELECT
      direction,
      duration_in_traffic_seconds / 60.0 as minutes
    FROM trips
    ${clause}
    ORDER BY direction, minutes
  `;

  const result = await db
    .prepare(query)
    .bind(...bindings)
    .all<{ direction: Direction; minutes: number }>();

  const data = result.results ?? [];

  // Group by direction
  const byDirection = new Map<Direction, number[]>();
  for (const row of data) {
    if (!byDirection.has(row.direction)) {
      byDirection.set(row.direction, []);
    }
    byDirection.get(row.direction)!.push(row.minutes);
  }

  const summaries: StatisticalSummary[] = [];

  for (const [direction, values] of byDirection) {
    if (values.length === 0) continue;

    const sorted = values.sort((a, b) => a - b);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance =
      values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      values.length;
    const stdDev = Math.sqrt(variance);

    summaries.push({
      direction,
      sample_count: values.length,
      mean_minutes: Math.round(mean * 10) / 10,
      median_minutes: Math.round(percentile(sorted, 50) * 10) / 10,
      p75_minutes: Math.round(percentile(sorted, 75) * 10) / 10,
      p90_minutes: Math.round(percentile(sorted, 90) * 10) / 10,
      p95_minutes: Math.round(percentile(sorted, 95) * 10) / 10,
      std_dev_minutes: Math.round(stdDev * 10) / 10,
      min_minutes: Math.round(sorted[0] * 10) / 10,
      max_minutes: Math.round(sorted[sorted.length - 1] * 10) / 10,
      coefficient_of_variation: Math.round((stdDev / mean) * 1000) / 1000,
    });
  }

  return summaries;
}

/**
 * Calculate hourly variance to identify most unpredictable time slots
 */
export async function getHourlyVariance(
  db: D1Database,
  filters: QueryFilters
): Promise<HourlyVariance[]> {
  const { clause, bindings } = buildWhereClause(filters);

  // SQLite doesn't have native STDDEV, so we calculate it manually
  const query = `
    WITH hourly_stats AS (
      SELECT
        hour_local,
        direction,
        AVG(duration_in_traffic_seconds / 60.0) as avg_minutes,
        COUNT(*) as sample_count
      FROM trips
      ${clause}
      GROUP BY hour_local, direction
    ),
    hourly_variance AS (
      SELECT
        t.hour_local,
        t.direction,
        AVG((t.duration_in_traffic_seconds / 60.0 - hs.avg_minutes) *
            (t.duration_in_traffic_seconds / 60.0 - hs.avg_minutes)) as variance,
        hs.avg_minutes,
        hs.sample_count
      FROM trips t
      JOIN hourly_stats hs ON t.hour_local = hs.hour_local AND t.direction = hs.direction
      ${clause.replace(/\b(direction|route_id|measured_at_local|is_holiday)\b/g, 't.$1')}
      GROUP BY t.hour_local, t.direction
    )
    SELECT
      hv.hour_local as hour,
      hv.direction,
      ROUND(hv.avg_minutes, 1) as avg_minutes,
      ROUND(SQRT(hv.variance), 1) as std_dev_minutes,
      ROUND(SQRT(hv.variance) / hv.avg_minutes, 3) as coefficient_of_variation,
      hv.sample_count
    FROM hourly_variance hv
    ORDER BY coefficient_of_variation DESC
  `;

  const result = await db
    .prepare(query)
    .bind(...bindings, ...bindings)
    .all<HourlyVariance>();

  return result.results ?? [];
}

/**
 * Classify trips into traffic pattern categories
 */
export async function getTrafficPatterns(
  db: D1Database,
  filters: QueryFilters
): Promise<TrafficPattern[]> {
  const { clause, bindings } = buildWhereClause(filters);

  // First, get the data distribution to set thresholds
  const stats = await getStatisticalSummary(db, filters);
  if (stats.length === 0) return [];

  // Use combined stats across both directions for thresholds
  const allMeans = stats.map((s) => s.mean_minutes);
  const allStdDevs = stats.map((s) => s.std_dev_minutes);
  const overallMean = allMeans.reduce((a, b) => a + b, 0) / allMeans.length;
  const overallStdDev =
    allStdDevs.reduce((a, b) => a + b, 0) / allStdDevs.length;

  // Define thresholds for 5 categories matching heatmap colors
  // green → cyan → yellow → orange → red
  const veryFastMax = overallMean - 0.5 * overallStdDev;
  const fastMax = overallMean;
  const moderateMax = overallMean + 0.5 * overallStdDev;
  const slowMax = overallMean + 1.5 * overallStdDev;

  const query = `
    SELECT
      CASE
        WHEN duration_in_traffic_seconds / 60.0 <= ? THEN 'very_fast'
        WHEN duration_in_traffic_seconds / 60.0 <= ? THEN 'fast'
        WHEN duration_in_traffic_seconds / 60.0 <= ? THEN 'moderate'
        WHEN duration_in_traffic_seconds / 60.0 <= ? THEN 'slow'
        ELSE 'very_slow'
      END as pattern_type,
      COUNT(*) as occurrence_count
    FROM trips
    ${clause}
    GROUP BY pattern_type
  `;

  const result = await db
    .prepare(query)
    .bind(veryFastMax, fastMax, moderateMax, slowMax, ...bindings)
    .all<{ pattern_type: string; occurrence_count: number }>();

  const data = result.results ?? [];
  const total = data.reduce((sum, row) => sum + row.occurrence_count, 0);

  const patterns: TrafficPattern[] = [
    {
      pattern_type: 'very_fast',
      min_threshold_minutes: 0,
      max_threshold_minutes: Math.round(veryFastMax),
      occurrence_count: 0,
      percentage: 0,
    },
    {
      pattern_type: 'fast',
      min_threshold_minutes: Math.round(veryFastMax),
      max_threshold_minutes: Math.round(fastMax),
      occurrence_count: 0,
      percentage: 0,
    },
    {
      pattern_type: 'moderate',
      min_threshold_minutes: Math.round(fastMax),
      max_threshold_minutes: Math.round(moderateMax),
      occurrence_count: 0,
      percentage: 0,
    },
    {
      pattern_type: 'slow',
      min_threshold_minutes: Math.round(moderateMax),
      max_threshold_minutes: Math.round(slowMax),
      occurrence_count: 0,
      percentage: 0,
    },
    {
      pattern_type: 'very_slow',
      min_threshold_minutes: Math.round(slowMax),
      max_threshold_minutes: 999,
      occurrence_count: 0,
      percentage: 0,
    },
  ];

  for (const row of data) {
    const pattern = patterns.find((p) => p.pattern_type === row.pattern_type);
    if (pattern) {
      pattern.occurrence_count = row.occurrence_count;
      pattern.percentage = Math.round((row.occurrence_count / total) * 1000) / 10;
    }
  }

  return patterns;
}

/**
 * Calculate reliability metric: "X% of trips complete in Y minutes"
 */
export async function getReliabilityMetrics(
  db: D1Database,
  filters: QueryFilters,
  confidenceLevels = [50, 75, 80, 90, 95]
): Promise<
  Array<{ direction: Direction; confidence_level: number; duration_minutes: number }>
> {
  const { clause, bindings } = buildWhereClause(filters);

  const query = `
    SELECT
      direction,
      duration_in_traffic_seconds / 60.0 as minutes
    FROM trips
    ${clause}
    ORDER BY direction, minutes
  `;

  const result = await db
    .prepare(query)
    .bind(...bindings)
    .all<{ direction: Direction; minutes: number }>();

  const data = result.results ?? [];

  // Group by direction
  const byDirection = new Map<Direction, number[]>();
  for (const row of data) {
    if (!byDirection.has(row.direction)) {
      byDirection.set(row.direction, []);
    }
    byDirection.get(row.direction)!.push(row.minutes);
  }

  const metrics: Array<{
    direction: Direction;
    confidence_level: number;
    duration_minutes: number;
  }> = [];

  for (const [direction, values] of byDirection) {
    const sorted = values.sort((a, b) => a - b);
    for (const level of confidenceLevels) {
      metrics.push({
        direction,
        confidence_level: level,
        duration_minutes: Math.round(percentile(sorted, level)),
      });
    }
  }

  return metrics;
}

/**
 * Helper function to calculate percentile
 */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  if (lower === upper) return sorted[lower];
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}
