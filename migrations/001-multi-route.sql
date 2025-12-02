-- Migration: Add multi-route support
--
-- IMPORTANT: Before running this migration, replace 'FIRST_ROUTE_ID' below
-- with your actual route ID (e.g., 'work', 'office', 'commute').
-- This ID must match the 'id' field in your ROUTES secret.

-- Step 1: Add route_id column with temporary default
ALTER TABLE trips ADD COLUMN route_id TEXT DEFAULT '_pending';

-- Step 2: Backfill existing data to first route
-- ⚠️  REPLACE 'FIRST_ROUTE_ID' with your actual route ID before running!
UPDATE trips SET route_id = 'westport' WHERE route_id = '_pending';

-- Step 3: Drop old unique constraint and recreate with route_id
DROP INDEX IF EXISTS idx_unique_measurement;
CREATE UNIQUE INDEX idx_unique_measurement ON trips(measured_at, direction, route_id);

-- Step 4: Add index for route_id queries
CREATE INDEX IF NOT EXISTS idx_route_id ON trips(route_id);
