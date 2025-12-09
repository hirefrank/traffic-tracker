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
pnpm run db:init          # Initialize schema on remote D1 (first time only)

# Routes Configuration
pnpm run routes:push      # Push routes.yaml to Cloudflare secrets
```

## Architecture

**Cloudflare Worker with D1 Database**

- `src/index.ts` - Entry point: exports `scheduled` (cron) and `fetch` (HTTP) handlers
- `src/scheduled.ts` - Cron handler that collects travel data for both directions every 15 min
- `src/api.ts` - HTTP API routes (`/api/data`, `/api/export`, `/api/health`, `/api/current`, `/api/analytics`, `/api/predictions/*`)
- `src/dashboard.ts` - Server-rendered HTML dashboard with Chart.js visualizations
- `src/queries.ts` - D1 query builders with filter support (date range, direction, holidays)
- `src/analytics.ts` - Advanced statistical analysis (percentiles, variance, traffic patterns, reliability metrics)
- `src/predictions.ts` - Google Maps prediction generation and accuracy tracking
- `src/maps-api.ts` - Google Maps Directions API client with retry logic and prediction support
- `src/holidays.ts` - US federal holiday detection (computed dynamically, cached per year)
- `src/types.ts` - TypeScript interfaces for Env bindings, DB models, and API responses

**Data Flow**
1. Scheduled trigger → `handleScheduled()` → fetches both directions from Google Maps → inserts to `trips` table
2. Dashboard request → `generateDashboard()` → queries aggregated data → renders HTML with embedded Chart.js
3. API requests require Bearer token auth (except `/api/health` and `/api/current`)

**Database Tables**
- `trips` (migrations/000-initial.sql) - Travel measurements with timestamps, duration, route, day/hour metadata
- `collection_log` (migrations/000-initial.sql) - Tracks collection runs and errors
- `predictions` (migrations/001-predictions.sql) - Google Maps predictions for accuracy tracking and instant heatmaps
- `prediction_accuracy` (view) - Pre-calculated accuracy metrics joining predictions with actuals

## Advanced Features

See [ANALYTICS.md](ANALYTICS.md) for comprehensive documentation on:
- **Instant Heatmap Generation** - Create full week visualization for new routes without waiting for data
- **Prediction Accuracy Tracking** - Compare Google's predictions vs actual measurements
- **Advanced Statistical Analysis** - Percentiles, variance, traffic patterns, reliability metrics
- **Traffic Model Variations** - Optimistic/pessimistic bounds for confidence intervals
- **Cost Optimization** - Determine if actual collection is worth it vs using predictions

## Environment Configuration

### Routes Configuration (routes.yaml)

All location configuration is managed via `routes.yaml`. Copy from `routes.example.yaml` and customize:

```yaml
# Your starting point
origin:
  address: 123 Home Street, Brooklyn, NY 11201
  label: Home  # Optional (defaults to "Origin")

# Destinations to track
routes:
  - id: work
    label: Office
    destination: 456 Main St, New York, NY 10001
    active: true

  - id: gym
    label: Gym
    destination: 789 Fitness Ave, Brooklyn, NY 11215
    active: true
```

Run `pnpm run routes:push` to push configuration to Cloudflare secrets.

- `id` - URL-safe identifier (alphanumeric, hyphens, underscores)
- `label` - Display name shown in the dashboard
- `destination` - Full address for Google Maps API
- `active` - Set to `false` to stop collecting data (display historical only)

### Other Secrets

Set manually via `wrangler secret put`:
- `GOOGLE_MAPS_API_KEY` - Google Maps Directions API key
- `API_ACCESS_KEY` - Bearer token for protected API endpoints

### URL Structure

- `/` - Redirects to the first route's dashboard
- `/route/{id}` - Dashboard for a specific route (e.g., `/route/work`)
- `/api/routes` - Returns list of configured routes (public)

### Variables (in wrangler.toml)

- `START_HOUR` / `END_HOUR` - Collection window (local time)
- `TIMEZONE` - Default: America/New_York
