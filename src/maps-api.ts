/**
 * Google Maps Directions API Client
 */

import type { GoogleMapsDirectionsResponse } from './types';

const DIRECTIONS_API_URL = 'https://maps.googleapis.com/maps/api/directions/json';

export interface DirectionsResult {
  duration_seconds: number;
  duration_in_traffic_seconds: number;
  distance_meters: number;
  route_summary: string;
}

export class MapsApiError extends Error {
  constructor(
    message: string,
    public status: string,
    public isRetryable: boolean
  ) {
    super(message);
    this.name = 'MapsApiError';
  }
}

export interface DirectionsOptions {
  departureTime?: number | 'now'; // Unix timestamp or 'now'
  trafficModel?: 'best_guess' | 'pessimistic' | 'optimistic';
}

/**
 * Fetch directions from Google Maps API
 * @param origin - Origin address
 * @param destination - Destination address
 * @param apiKey - Google Maps API key
 * @param options - Optional parameters for predictions and traffic models
 * @returns Directions result with duration and distance
 */
export async function fetchDirections(
  origin: string,
  destination: string,
  apiKey: string,
  options: DirectionsOptions = {}
): Promise<DirectionsResult> {
  const params = new URLSearchParams({
    origin,
    destination,
    departure_time: options.departureTime?.toString() ?? 'now',
    key: apiKey,
  });

  if (options.trafficModel) {
    params.set('traffic_model', options.trafficModel);
  }

  const url = `${DIRECTIONS_API_URL}?${params.toString()}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new MapsApiError(
      `HTTP error: ${response.status} ${response.statusText}`,
      'HTTP_ERROR',
      response.status >= 500 || response.status === 429
    );
  }

  const data = (await response.json()) as GoogleMapsDirectionsResponse;

  // Check API-level status
  if (data.status !== 'OK') {
    const isRetryable = ['OVER_QUERY_LIMIT', 'UNKNOWN_ERROR'].includes(data.status);
    throw new MapsApiError(
      data.error_message || `API returned status: ${data.status}`,
      data.status,
      isRetryable
    );
  }

  // Validate response structure
  if (!data.routes || data.routes.length === 0) {
    throw new MapsApiError('No routes returned', 'NO_ROUTES', false);
  }

  const route = data.routes[0];
  if (!route.legs || route.legs.length === 0) {
    throw new MapsApiError('No legs in route', 'NO_LEGS', false);
  }

  const leg = route.legs[0];

  return {
    duration_seconds: leg.duration.value,
    duration_in_traffic_seconds: leg.duration_in_traffic?.value ?? leg.duration.value,
    distance_meters: leg.distance.value,
    route_summary: route.summary,
  };
}

/**
 * Fetch directions with retry logic
 * @param origin - Origin address
 * @param destination - Destination address
 * @param apiKey - Google Maps API key
 * @param options - Optional parameters for predictions and traffic models
 * @param maxRetries - Maximum number of retries (default: 1)
 * @param retryDelayMs - Delay between retries in ms (default: 2000)
 * @returns Directions result
 */
export async function fetchDirectionsWithRetry(
  origin: string,
  destination: string,
  apiKey: string,
  options: DirectionsOptions = {},
  maxRetries = 1,
  retryDelayMs = 2000
): Promise<DirectionsResult> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fetchDirections(origin, destination, apiKey, options);
    } catch (error) {
      lastError = error as Error;

      // Don't retry if it's not a retryable error
      if (error instanceof MapsApiError && !error.isRetryable) {
        throw error;
      }

      // Don't wait after the last attempt
      if (attempt < maxRetries) {
        await sleep(retryDelayMs);
      }
    }
  }

  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
