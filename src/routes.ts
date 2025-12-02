/**
 * Route Parsing Utilities
 */

import type { Route } from './types';

/**
 * Parse and validate ROUTES JSON from environment
 */
export function parseRoutes(routesJson: string): Route[] {
  try {
    const routes = JSON.parse(routesJson) as Route[];

    if (!Array.isArray(routes) || routes.length === 0) {
      throw new Error('ROUTES must be a non-empty array');
    }

    for (const route of routes) {
      if (!route.id || typeof route.id !== 'string') {
        throw new Error('Each route must have a string "id"');
      }
      if (!route.label || typeof route.label !== 'string') {
        throw new Error('Each route must have a string "label"');
      }
      if (!route.destination || typeof route.destination !== 'string') {
        throw new Error('Each route must have a string "destination"');
      }
      // Validate id is URL-safe (alphanumeric, hyphens, underscores)
      if (!/^[a-zA-Z0-9_-]+$/.test(route.id)) {
        throw new Error(`Route id "${route.id}" must be URL-safe (alphanumeric, hyphens, underscores only)`);
      }
    }

    return routes;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('ROUTES is not valid JSON');
    }
    throw error;
  }
}

/**
 * Get a route by its ID
 */
export function getRouteById(routes: Route[], id: string): Route | undefined {
  return routes.find(route => route.id === id);
}

/**
 * Get the default (first) route
 */
export function getDefaultRoute(routes: Route[]): Route {
  return routes[0];
}

/**
 * Get only active routes (for data collection)
 * Routes are active by default if `active` is not specified
 */
export function getActiveRoutes(routes: Route[]): Route[] {
  return routes.filter(route => route.active !== false);
}
