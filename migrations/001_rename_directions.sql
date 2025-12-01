-- Migration: Rename direction values from location-specific to generic
-- SQLite doesn't support modifying CHECK constraints, so we need to recreate the table

-- Step 1: Create new table with updated constraint
CREATE TABLE trips_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  measured_at TEXT NOT NULL,
  measured_at_local TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('outbound', 'inbound')),
  duration_seconds INTEGER NOT NULL CHECK (duration_seconds > 0),
  duration_in_traffic_seconds INTEGER NOT NULL CHECK (duration_in_traffic_seconds > 0),
  distance_meters INTEGER CHECK (distance_meters IS NULL OR distance_meters > 0),
  route_summary TEXT,
  day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6),
  hour_local INTEGER CHECK (hour_local >= 0 AND hour_local <= 23),
  is_holiday INTEGER DEFAULT 0 CHECK (is_holiday IN (0, 1))
);

-- Step 2: Copy data with transformed direction values
INSERT INTO trips_new (id, measured_at, measured_at_local, direction, duration_seconds, duration_in_traffic_seconds, distance_meters, route_summary, day_of_week, hour_local, is_holiday)
SELECT
  id,
  measured_at,
  measured_at_local,
  CASE direction
    WHEN 'bk_to_westport' THEN 'outbound'
    WHEN 'westport_to_bk' THEN 'inbound'
    ELSE direction
  END,
  duration_seconds,
  duration_in_traffic_seconds,
  distance_meters,
  route_summary,
  day_of_week,
  hour_local,
  is_holiday
FROM trips;

-- Step 3: Drop old table
DROP TABLE trips;

-- Step 4: Rename new table
ALTER TABLE trips_new RENAME TO trips;

-- Step 5: Recreate indexes
CREATE INDEX idx_measured_at ON trips(measured_at);
CREATE INDEX idx_direction ON trips(direction);
CREATE INDEX idx_day_hour ON trips(day_of_week, hour_local);
CREATE INDEX idx_route ON trips(route_summary);
CREATE UNIQUE INDEX idx_unique_measurement ON trips(measured_at, direction);
