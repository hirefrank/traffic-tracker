/**
 * Traffic Tracker - Cloudflare Worker
 *
 * Collects travel time estimates between Brooklyn and Westport, CT
 * using the Google Maps Directions API and displays patterns via a web dashboard.
 */

import type { Env, QueryFilters, Direction } from './types';
import { handleScheduled } from './scheduled';
import { handleApiData, handleApiExport, handleApiHealth, handleApiCurrent, parseFilters } from './api';
import { generateDashboard } from './dashboard';

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

    try {
      // API routes
      if (path === '/api/data') {
        return await handleApiData(request, env);
      }

      if (path === '/api/export') {
        return await handleApiExport(request, env);
      }

      if (path === '/api/health') {
        return await handleApiHealth(env);
      }

      if (path === '/api/current') {
        return await handleApiCurrent(env);
      }

      // Dashboard route
      if (path === '/' || path === '/index.html') {
        const filters = parseFilters(url);
        const html = await generateDashboard(env, filters);
        return new Response(html, {
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-cache',
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
