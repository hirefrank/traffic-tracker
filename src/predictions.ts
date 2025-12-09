/**
 * Traffic Prediction Generation and Analysis
 */

import type { Env, Direction } from './types';
import { fetchDirectionsWithRetry } from './maps-api';

/**
 * Format a date as ISO 8601 string in local timezone
 */
function formatLocalTimestamp(date: Date, timezone: string): string {
  const year = date.toLocaleString('en-US', { timeZone: timezone, year: 'numeric' });
  const month = date.toLocaleString('en-US', { timeZone: timezone, month: '2-digit' });
  const day = date.toLocaleString('en-US', { timeZone: timezone, day: '2-digit' });
  const hour = date.toLocaleString('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    hour12: false,
  });
  const minute = date.toLocaleString('en-US', { timeZone: timezone, minute: '2-digit' });
  const second = date.toLocaleString('en-US', { timeZone: timezone, second: '2-digit' });

  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

interface PredictionResult {
  predicted_for: Date;
  predicted_for_local: string;
  direction: Direction;
  route_id: string;
  predicted_duration_seconds: number;
  traffic_model: 'best_guess' | 'pessimistic' | 'optimistic';
}

/**
 * Generate a full week of predictions for a new route
 * This creates an instant heatmap from Google's predictions
 */
export async function generateWeekPredictions(
  origin: string,
  destination: string,
  routeId: string,
  apiKey: string,
  timezone: string
): Promise<PredictionResult[]> {
  const predictions: PredictionResult[] = [];
  const now = new Date();

  // Generate predictions for each day of the week
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() + dayOffset);

    // For each hour of the day (6am to 9pm)
    for (let hour = 6; hour <= 21; hour++) {
      targetDate.setHours(hour, 0, 0, 0);
      const departureTime = Math.floor(targetDate.getTime() / 1000);

      // Fetch predictions for both directions using best_guess model
      try {
        const [outbound, inbound] = await Promise.all([
          fetchDirectionsWithRetry(origin, destination, apiKey, {
            departureTime,
            trafficModel: 'best_guess',
          }),
          fetchDirectionsWithRetry(destination, origin, apiKey, {
            departureTime,
            trafficModel: 'best_guess',
          }),
        ]);

        const localTimeStr = formatLocalTimestamp(targetDate, timezone);

        predictions.push({
          predicted_for: targetDate,
          predicted_for_local: localTimeStr,
          direction: 'outbound',
          route_id: routeId,
          predicted_duration_seconds: outbound.duration_in_traffic_seconds,
          traffic_model: 'best_guess',
        });

        predictions.push({
          predicted_for: targetDate,
          predicted_for_local: localTimeStr,
          direction: 'inbound',
          route_id: routeId,
          predicted_duration_seconds: inbound.duration_in_traffic_seconds,
          traffic_model: 'best_guess',
        });

        // Rate limiting - wait 100ms between requests to avoid hitting quota
        await sleep(100);
      } catch (error) {
        console.error(`Failed to fetch prediction for ${routeId} at ${targetDate}:`, error);
        // Continue with next time slot even if one fails
      }
    }
  }

  return predictions;
}

/**
 * Generate hourly predictions for next 24 hours with all traffic models
 * Used for comparing optimistic/pessimistic bounds
 */
export async function generateDailyPredictions(
  origin: string,
  destination: string,
  routeId: string,
  apiKey: string,
  timezone: string
): Promise<PredictionResult[]> {
  const predictions: PredictionResult[] = [];
  const now = new Date();

  // Generate predictions for next 24 hours
  for (let hourOffset = 1; hourOffset <= 24; hourOffset++) {
    const targetTime = new Date(now);
    targetTime.setHours(targetTime.getHours() + hourOffset, 0, 0, 0);
    const departureTime = Math.floor(targetTime.getTime() / 1000);

    const models: Array<'best_guess' | 'pessimistic' | 'optimistic'> = [
      'best_guess',
      'pessimistic',
      'optimistic',
    ];

    for (const model of models) {
      try {
        const [outbound, inbound] = await Promise.all([
          fetchDirectionsWithRetry(origin, destination, apiKey, {
            departureTime,
            trafficModel: model,
          }),
          fetchDirectionsWithRetry(destination, origin, apiKey, {
            departureTime,
            trafficModel: model,
          }),
        ]);

        const localTimeStr = formatLocalTimestamp(targetTime, timezone);

        predictions.push({
          predicted_for: targetTime,
          predicted_for_local: localTimeStr,
          direction: 'outbound',
          route_id: routeId,
          predicted_duration_seconds: outbound.duration_in_traffic_seconds,
          traffic_model: model,
        });

        predictions.push({
          predicted_for: targetTime,
          predicted_for_local: localTimeStr,
          direction: 'inbound',
          route_id: routeId,
          predicted_duration_seconds: inbound.duration_in_traffic_seconds,
          traffic_model: model,
        });

        await sleep(100);
      } catch (error) {
        console.error(`Failed to fetch ${model} prediction for ${routeId} at ${targetTime}:`, error);
      }
    }
  }

  return predictions;
}

/**
 * Store predictions in database
 */
export async function storePredictions(
  db: D1Database,
  predictions: PredictionResult[],
  predictedAt: Date,
  timezone: string
): Promise<void> {
  const predictedAtLocalStr = formatLocalTimestamp(predictedAt, timezone);

  for (const pred of predictions) {
    const localTime = new Date(pred.predicted_for_local);
    const dayOfWeek = localTime.getDay();
    const hourLocal = localTime.getHours();

    await db
      .prepare(
        `INSERT INTO predictions (
          predicted_at, predicted_at_local, predicted_for, predicted_for_local,
          direction, route_id, predicted_duration_seconds, traffic_model,
          day_of_week, hour_local, is_holiday
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`
      )
      .bind(
        predictedAt.toISOString(),
        predictedAtLocalStr,
        pred.predicted_for.toISOString(),
        pred.predicted_for_local,
        pred.direction,
        pred.route_id,
        pred.predicted_duration_seconds,
        pred.traffic_model,
        dayOfWeek,
        hourLocal
      )
      .run();
  }
}

/**
 * Link predictions to actual measurements for accuracy tracking
 * Finds the closest actual measurement within a 30-minute window
 */
export async function linkPredictionsToActuals(db: D1Database, routeId: string): Promise<number> {
  const result = await db
    .prepare(
      `UPDATE predictions
       SET actual_trip_id = (
         SELECT t.id
         FROM trips t
         WHERE t.route_id = predictions.route_id
           AND t.direction = predictions.direction
           AND ABS((julianday(t.measured_at) - julianday(predictions.predicted_for)) * 24 * 60) <= 30
         ORDER BY ABS((julianday(t.measured_at) - julianday(predictions.predicted_for)) * 24 * 60)
         LIMIT 1
       )
       WHERE route_id = ?
         AND actual_trip_id IS NULL
         AND predicted_for < datetime('now')`
    )
    .bind(routeId)
    .run();

  return result.meta.changes;
}

/**
 * Get prediction accuracy statistics
 */
export async function getPredictionAccuracy(
  db: D1Database,
  routeId: string,
  trafficModel: 'best_guess' | 'pessimistic' | 'optimistic' = 'best_guess'
) {
  const result = await db
    .prepare(
      `SELECT
        direction,
        day_of_week,
        hour_local,
        prediction_count,
        ROUND(avg_predicted_seconds / 60.0, 1) as avg_predicted_minutes,
        ROUND(avg_actual_seconds / 60.0, 1) as avg_actual_minutes,
        ROUND(avg_error_seconds / 60.0, 1) as avg_error_minutes,
        ROUND(avg_bias_seconds / 60.0, 1) as avg_bias_minutes,
        ROUND(rmse_seconds / 60.0, 1) as rmse_minutes
       FROM prediction_accuracy
       WHERE route_id = ? AND traffic_model = ?
       ORDER BY day_of_week, hour_local, direction`
    )
    .bind(routeId, trafficModel)
    .all();

  return result.results ?? [];
}

/**
 * Get heatmap data from predictions (for instant visualization)
 */
export async function getPredictionHeatmap(
  db: D1Database,
  routeId: string,
  trafficModel: 'best_guess' | 'pessimistic' | 'optimistic' = 'best_guess'
) {
  const result = await db
    .prepare(
      `SELECT
        day_of_week,
        hour_local,
        direction,
        ROUND(AVG(predicted_duration_seconds) / 60.0, 1) as avg_minutes,
        COUNT(*) as sample_count
       FROM predictions
       WHERE route_id = ? AND traffic_model = ?
       GROUP BY day_of_week, hour_local, direction
       ORDER BY day_of_week, hour_local, direction`
    )
    .bind(routeId, trafficModel)
    .all();

  return result.results ?? [];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
