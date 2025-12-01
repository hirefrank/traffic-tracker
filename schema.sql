-- Traffic Tracker Database Schema

CREATE TABLE IF NOT EXISTS trips (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  measured_at TEXT NOT NULL,           -- ISO 8601 UTC timestamp
  measured_at_local TEXT NOT NULL,     -- ISO 8601 local (Eastern) timestamp
  direction TEXT NOT NULL,             -- 'bk_to_westport' | 'westport_to_bk'
  duration_seconds INTEGER NOT NULL,   -- baseline (no traffic)
  duration_in_traffic_seconds INTEGER NOT NULL,
  distance_meters INTEGER,
  route_summary TEXT,                  -- e.g., "I-95 N" or "Hutchinson River Pkwy"
  day_of_week INTEGER,                 -- 0=Sun, 6=Sat (computed from local time)
  hour_local INTEGER,                  -- 0-23 (computed from local time)
  is_holiday INTEGER DEFAULT 0         -- 1 if federal/major holiday
);

CREATE INDEX IF NOT EXISTS idx_measured_at ON trips(measured_at);
CREATE INDEX IF NOT EXISTS idx_direction ON trips(direction);
CREATE INDEX IF NOT EXISTS idx_day_hour ON trips(day_of_week, hour_local);
CREATE INDEX IF NOT EXISTS idx_route ON trips(route_summary);

CREATE TABLE IF NOT EXISTS collection_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  status TEXT NOT NULL,                -- 'success' | 'error'
  error_message TEXT,
  api_calls_made INTEGER
);
