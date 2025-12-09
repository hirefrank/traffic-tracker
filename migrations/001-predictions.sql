-- Predictions table to track Google's predicted traffic vs actual measurements
CREATE TABLE IF NOT EXISTS predictions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  predicted_at DATETIME NOT NULL,              -- When the prediction was made
  predicted_at_local TEXT NOT NULL,            -- Local time when prediction was made
  predicted_for DATETIME NOT NULL,             -- What time the prediction is for
  predicted_for_local TEXT NOT NULL,           -- Local time for prediction target
  direction TEXT NOT NULL CHECK (direction IN ('outbound', 'inbound')),
  route_id TEXT NOT NULL,

  -- Prediction values
  predicted_duration_seconds INTEGER NOT NULL,
  traffic_model TEXT NOT NULL CHECK (traffic_model IN ('best_guess', 'pessimistic', 'optimistic')),

  -- Actual measurement (joined later)
  actual_trip_id INTEGER,

  -- Metadata
  day_of_week INTEGER NOT NULL,
  hour_local INTEGER NOT NULL,
  is_holiday INTEGER NOT NULL DEFAULT 0,

  FOREIGN KEY (actual_trip_id) REFERENCES trips(id)
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_predictions_predicted_for ON predictions(predicted_for, direction, route_id);
CREATE INDEX IF NOT EXISTS idx_predictions_route_time ON predictions(route_id, predicted_for_local);
CREATE INDEX IF NOT EXISTS idx_predictions_model ON predictions(traffic_model, direction);

-- Prediction accuracy metrics view (calculated on demand)
-- This compares predictions made 1+ hours ahead with actual measurements
CREATE VIEW IF NOT EXISTS prediction_accuracy AS
SELECT
  p.route_id,
  p.direction,
  p.traffic_model,
  p.day_of_week,
  p.hour_local,
  COUNT(*) as prediction_count,
  AVG(p.predicted_duration_seconds) as avg_predicted_seconds,
  AVG(t.duration_in_traffic_seconds) as avg_actual_seconds,
  AVG(ABS(p.predicted_duration_seconds - t.duration_in_traffic_seconds)) as avg_error_seconds,
  AVG(p.predicted_duration_seconds - t.duration_in_traffic_seconds) as avg_bias_seconds,
  SQRT(AVG((p.predicted_duration_seconds - t.duration_in_traffic_seconds) *
           (p.predicted_duration_seconds - t.duration_in_traffic_seconds))) as rmse_seconds
FROM predictions p
JOIN trips t ON p.actual_trip_id = t.id
WHERE p.predicted_at < p.predicted_for  -- Only predictions made in advance
GROUP BY p.route_id, p.direction, p.traffic_model, p.day_of_week, p.hour_local;
