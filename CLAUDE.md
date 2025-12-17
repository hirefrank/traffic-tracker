# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Traffic Tracker is a Cloudflare Worker that collects travel time estimates between two configurable locations using the Google Maps Directions API. It runs on a 15-minute cron schedule during configurable hours (default 6am-9pm ET) and provides a web dashboard for visualizing traffic patterns.

## Commands

```bash
# Development
pnpm run dev              # Start local dev server with wrangler

# Deployment
pnpm run deploy           # Deploy to Cloudflare Workers (auto-runs predeploy hook)

# CSS Development
pnpm run css:build        # Compile Tailwind CSS and inline into dashboard.ts
pnpm run css:watch        # Watch CSS for changes during development

# Database
pnpm run db:create        # Create D1 database (first time only)
pnpm run db:init          # Initialize schema on remote D1 (first time only)
pnpm run db:migrate       # Run predictions migration (001-predictions.sql)

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

## UI Design System (Brutalist)

The dashboard uses a brutalist design system with consistent patterns:

### Color Palette
- **Yellow (`#FFFF00`)** - Active states, highlights, emphasis
- **Black (`#000`)** - Borders, text, backgrounds
- **White** - Backgrounds, inactive states
- **Green/Cyan/Orange/Red** - Heatmap gradient (fast → slow)

### Active State Pattern
All interactive controls use **yellow background** to indicate active/selected state:
- Filter pills: `bg-brutal-yellow` when active, `bg-white` when inactive
- Toggle buttons: Yellow = currently selected option
- APPLY button: Yellow only when custom filters are set (not quick filters)

Example:
```typescript
class="${isActive ? 'bg-brutal-yellow' : 'bg-white'}"
```

### CSS Classes
- `brutal-card` - Main card container with black border
- `brutal-btn` - Button base (black border, hover states)
- `brutal-btn-active` - Active button variant (yellow background)
- `brutal-pill` - Pill-shaped button for filters/toggles
- `brutal-label` - Uppercase, bold, monospace labels
- `brutal-input` - Form input with black border

### Dashboard Structure
1. **Sticky Toolbar** - Route selector, direction toggle (outbound/inbound)
2. **Filter Form** - Date ranges, excludeHolidays checkbox, quick filters (THIS WEEK, THIS MONTH, WEEKDAYS)
3. **Summary Cards** - Current estimate, analytics (load on demand)
4. **Charts** - Line chart (15-min intervals), heatmap (day/hour with 30-min slots)
5. **Data Source Toggle** - Dual-button for actual data vs predictions

### Filter Behavior
- Quick filters (week/month/weekdays) are **mutually exclusive**
- Manual filters (APPLY form) clear quick filters when used
- Direction toggle preserves all other filters
- Yellow background shows which filtering method is active

## CSS Architecture

The dashboard uses **compiled Tailwind CSS v3** (not CDN). The build process:

1. **Source**: `src/styles/input.css` contains Tailwind directives
2. **Compilation**: PostCSS compiles to `src/styles/output.css` (~23KB minified)
3. **Inlining**: `scripts/inline-css.js` escapes backslashes and embeds CSS into `src/dashboard.ts`
4. **Auto-build**: `predeploy` and `prebuild` hooks automatically run `css:build`

**Critical**: CSS class names like `.md\:grid-cols-3` require proper escaping in JavaScript template literals. The inline script doubles backslashes (`\` → `\\`) to prevent Wrangler's bundler from stripping them.

**Custom CSS Classes**: All `.brutal-*` classes are defined at the end of the `<style>` tag in `dashboard.ts` (after Tailwind utilities). The `.brutal-label` class does **not** hardcode `color` to allow Tailwind utilities (`text-white`, `text-black`) to override it.

**To modify UI styles**:
1. Edit Tailwind classes in `dashboard.ts` HTML, OR
2. Edit custom `.brutal-*` CSS rules in `dashboard.ts` `<style>` section
3. Run `pnpm run css:build` to rebuild and inline
4. For live CSS development, use `pnpm run css:watch` in parallel with `pnpm run dev`
