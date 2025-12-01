// Environment bindings
export interface Env {
  DB: D1Database;
  GOOGLE_MAPS_API_KEY: string;
  API_ACCESS_KEY: string;
  ORIGIN: string;
  DESTINATION: string;
  START_HOUR: string;
  END_HOUR: string;
  TIMEZONE: string;
}

// Direction type
export type Direction = 'bk_to_westport' | 'westport_to_bk';

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

export interface DayHourData {
  day_of_week: number;
  hour: number;
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
  direction: Direction | null;
  excludeHolidays: boolean;
}
