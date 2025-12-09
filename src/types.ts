// Environment bindings
export interface Env {
  DB: D1Database;
  GOOGLE_MAPS_API_KEY: string;
  API_ACCESS_KEY: string;
  ORIGIN: string;
  ROUTES: string;  // JSON string of Route[]
  START_HOUR: string;
  END_HOUR: string;
  TIMEZONE: string;
  // Optional labels for UI (defaults to "Origin" if not set)
  ORIGIN_LABEL?: string;
}

// Direction type
export type Direction = 'outbound' | 'inbound';

// Route configuration
export interface Route {
  id: string;
  label: string;
  destination: string;
  active?: boolean;  // defaults to true if not specified
}

// Database models
export interface Trip {
  id: number;
  measured_at: string;
  measured_at_local: string;
  direction: Direction;
  duration_seconds: number;
  duration_in_traffic_seconds: number;
  distance_meters: number | null;
  route_summary: string | null;
  day_of_week: number;
  hour_local: number;
  is_holiday: number;
  route_id: string;
}

export interface CollectionLog {
  id: number;
  timestamp: string;
  status: 'success' | 'error';
  error_message: string | null;
  api_calls_made: number;
}

// Google Maps API response types
export interface GoogleMapsDirectionsResponse {
  status: string;
  routes: GoogleMapsRoute[];
  error_message?: string;
}

export interface GoogleMapsRoute {
  summary: string;
  legs: GoogleMapsLeg[];
}

export interface GoogleMapsLeg {
  duration: GoogleMapsDuration;
  duration_in_traffic?: GoogleMapsDuration;
  distance: GoogleMapsDistance;
}

export interface GoogleMapsDuration {
  value: number; // seconds
  text: string;
}

export interface GoogleMapsDistance {
  value: number; // meters
  text: string;
}

// API response types
export interface ApiDataResponse {
  meta: {
    generated_at: string;
    filters: {
      startDate: string | null;
      endDate: string | null;
      direction: string | null;
      excludeHolidays: boolean;
      weekdaysOnly: boolean;
    };
    total_samples: number;
  };
  hourly: HourlyData[];
  day_hour: DayHourData[];
  by_route: RouteData[];
  recent: RecentTrip[];
  best_worst: {
    best: BestWorstSlot[];
    worst: BestWorstSlot[];
  };
}

export interface HourlyData {
  hour: number;
  direction: Direction;
  avg_minutes: number;
  sample_count: number;
}

export interface IntervalData {
  hour: number;
  minute: number;
  direction: Direction;
  avg_minutes: number;
  sample_count: number;
}

export interface DayHourData {
  day_of_week: number;
  hour: number;
  direction: Direction;
  avg_minutes: number;
  sample_count: number;
}

export interface DayIntervalData {
  day_of_week: number;
  hour: number;
  minute: number;
  direction: Direction;
  avg_minutes: number;
  sample_count: number;
}

export interface RouteData {
  route_summary: string;
  direction: Direction;
  avg_minutes: number;
  sample_count: number;
}

export interface RecentTrip {
  measured_at_local: string;
  direction: Direction;
  duration_in_traffic_seconds: number;
  route_summary: string | null;
}

export interface PairedMeasurement {
  measured_at_local: string;
  outbound_seconds: number | null;
  inbound_seconds: number | null;
  outbound_route: string | null;
  inbound_route: string | null;
}

export interface BestWorstSlot {
  day_of_week: number;
  hour: number;
  direction: Direction;
  avg_minutes: number;
  sample_count: number;
}

export interface HealthResponse {
  status: 'healthy' | 'unhealthy';
  last_collection: string | null;
  last_24h_samples: number;
  last_error: string | null;
}

// Query parameters
export interface QueryFilters {
  startDate: string | null;
  endDate: string | null;
  direction: Direction;  // Always set, defaults to 'outbound'
  routeId: string | null;
  excludeHolidays: boolean;
  weekdaysOnly: boolean;
}

// Advanced analytics
export interface StatisticalSummary {
  direction: Direction;
  sample_count: number;
  mean_minutes: number;
  median_minutes: number;
  p75_minutes: number;
  p90_minutes: number;
  p95_minutes: number;
  std_dev_minutes: number;
  min_minutes: number;
  max_minutes: number;
  coefficient_of_variation: number;
}

export interface HourlyVariance {
  hour: number;
  direction: Direction;
  avg_minutes: number;
  std_dev_minutes: number;
  coefficient_of_variation: number;
  sample_count: number;
}

export interface PredictionAccuracy {
  direction: Direction;
  day_of_week: number;
  hour_local: number;
  prediction_count: number;
  avg_predicted_minutes: number;
  avg_actual_minutes: number;
  avg_error_minutes: number;
  avg_bias_minutes: number;
  rmse_minutes: number;
}

export interface TrafficPattern {
  pattern_type: 'very_fast' | 'fast' | 'moderate' | 'slow' | 'very_slow';
  min_threshold_minutes: number;
  max_threshold_minutes: number;
  occurrence_count: number;
  percentage: number;
}
