# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Traffic Tracker is a Cloudflare Worker that collects travel time estimates between two configurable locations using the Google Maps Directions API. It runs on a 15-minute cron schedule during configurable hours (default 6am-9pm ET) and provides a web dashboard for visualizing traffic patterns.

## Commands

```bash
# Development
pnpm run dev              # Start local dev server with wrangler

# Deployment
pnpm run deploy           # Deploy to Cloudflare Workers

# Database
pnpm run db:create        # Create D1 database (first time only)
pnpm run db:migrate       # Run schema.sql on remote D1
```

## Architecture

**Cloudflare Worker with D1 Database**

- `src/index.ts` - Entry point: exports `scheduled` (cron) and `fetch` (HTTP) handlers
- `src/scheduled.ts` - Cron handler that collects travel data for both directions every 15 min
- `src/api.ts` - HTTP API routes (`/api/data`, `/api/export`, `/api/health`, `/api/current`)
- `src/dashboard.ts` - Server-rendered HTML dashboard with Chart.js visualizations
- `src/queries.ts` - D1 query builders with filter support (date range, direction, holidays)
- `src/maps-api.ts` - Google Maps Directions API client with retry logic
- `src/holidays.ts` - US federal holiday detection (computed dynamically, cached per year)
- `src/types.ts` - TypeScript interfaces for Env bindings, DB models, and API responses

**Data Flow**
1. Scheduled trigger → `handleScheduled()` → fetches both directions from Google Maps → inserts to `trips` table
2. Dashboard request → `generateDashboard()` → queries aggregated data → renders HTML with embedded Chart.js
3. API requests require Bearer token auth (except `/api/health` and `/api/current`)

**Database Tables** (schema.sql)
- `trips` - Travel measurements with timestamps, duration, route, day/hour metadata
- `collection_log` - Tracks collection runs and errors

## Environment Configuration

Secrets (set via `wrangler secret put`):
- `GOOGLE_MAPS_API_KEY` - Google Maps Directions API key
- `API_ACCESS_KEY` - Bearer token for protected API endpoints
- `ORIGIN` / `DESTINATION` - Address strings for the route
- `ORIGIN_LABEL` / `DESTINATION_LABEL` - Optional display labels for dashboard (defaults to "Origin"/"Destination")

Variables (in wrangler.toml):
- `START_HOUR` / `END_HOUR` - Collection window (local time)
- `TIMEZONE` - Default: America/New_York
