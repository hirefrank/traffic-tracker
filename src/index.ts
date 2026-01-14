/**
 * Traffic Tracker - Cloudflare Worker
 *
 * Collects travel time estimates between Brooklyn and Westport, CT
 * using the Google Maps Directions API and displays patterns via a web dashboard.
 */

import type { Env, QueryFilters, Direction } from './types';
import { handleScheduled } from './scheduled';
import {
  handleApiData,
  handleApiExport,
  handleApiHealth,
  handleApiCurrent,
  handleApiRoutes,
  handleApiAnalytics,
  handleApiPredictionsGenerate,
  handleApiPredictionsAccuracy,
  handleApiPredictionsHeatmap,
  parseFilters,
} from './api';
import { generateDashboard } from './dashboard';
import { parseRoutes, getRouteById, getDefaultRoute } from './routes';

export default {
  /**
   * Scheduled handler - runs every 15 minutes to collect travel time data
   */
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(handleScheduled(env));
  },

  /**
   * Fetch handler - serves web dashboard and API endpoints
   */
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const base = env.BASE_PATH;

    try {
      // API routes
      if (path === `${base}/api/routes`) {
        return await handleApiRoutes(env);
      }

      if (path === `${base}/api/data`) {
        return await handleApiData(request, env);
      }

      if (path === `${base}/api/export`) {
        return await handleApiExport(request, env);
      }

      if (path === `${base}/api/health`) {
        return await handleApiHealth(env);
      }

      if (path === `${base}/api/current`) {
        const routeId = url.searchParams.get('routeId');
        return await handleApiCurrent(env, routeId);
      }

      if (path === `${base}/api/analytics`) {
        return await handleApiAnalytics(request, env);
      }

      if (path === `${base}/api/predictions/generate`) {
        return await handleApiPredictionsGenerate(request, env);
      }

      if (path === `${base}/api/predictions/accuracy`) {
        return await handleApiPredictionsAccuracy(request, env);
      }

      if (path === `${base}/api/predictions/heatmap`) {
        return await handleApiPredictionsHeatmap(request, env);
      }

      // Redirect root to base path (for workers.dev convenience)
      if (path === '/' || path === '/index.html') {
        return Response.redirect(`${url.origin}${base}${url.search}`, 302);
      }

      // Root redirect to first route
      if (path === base || path === `${base}/` || path === `${base}/index.html`) {
        const routes = parseRoutes(env.ROUTES);
        const defaultRoute = getDefaultRoute(routes);
        return Response.redirect(`${url.origin}${base}/route/${defaultRoute.id}${url.search}`, 302);
      }

      // Route-specific dashboard
      if (path.startsWith(`${base}/route/`)) {
        const routeId = path.replace(`${base}/route/`, '').split('/')[0];

        if (!routeId) {
          return new Response('Route ID required', { status: 400 });
        }

        const routes = parseRoutes(env.ROUTES);
        const route = getRouteById(routes, routeId);

        if (!route) {
          return new Response('Route not found', { status: 404 });
        }

        const filters = parseFilters(url);
        filters.routeId = routeId;
        const html = await generateDashboard(env, filters, route, routes);
        return new Response(html, {
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'public, max-age=60, s-maxage=60',
          },
        });
      }

      // 404 for unknown routes
      return new Response('Not Found', { status: 404 });
    } catch (error) {
      console.error('Error handling request:', error);

      const message = error instanceof Error ? error.message : 'Internal Server Error';
      return new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
};
