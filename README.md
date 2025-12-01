# Traffic Tracker

A Cloudflare Worker that collects travel time estimates between two locations using the Google Maps Directions API. It runs on a 15-minute cron schedule during configurable hours and provides a web dashboard for visualizing traffic patterns.

## Features

- Collects travel time data for both directions every 15 minutes
- Stores data in Cloudflare D1 (SQLite at the edge)
- Web dashboard with Chart.js visualizations
- REST API for data access and CSV export
- Holiday detection (excludes US federal holidays from analysis)
- Configurable collection window (default: 6am-9pm ET)

## Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Cloudflare account](https://dash.cloudflare.com/sign-up)
- Google Maps API key with Directions API enabled (see [Google Maps Setup](#google-maps-setup) below)

## Google Maps Setup

### 1. Create a Google Cloud project

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Click the project dropdown and select **New Project**
3. Name your project and click **Create**

### 2. Enable the Directions API

1. Go to **APIs & Services** → **Library**
2. Search for "Directions API"
3. Click on it and click **Enable**

### 3. Create an API key

1. Go to **APIs & Services** → **Credentials**
2. Click **+ Create Credentials** → **API Key**
3. Copy the generated key

### 4. Restrict the API key (recommended)

1. Click on the API key you just created
2. Under **API restrictions**, select **Restrict key**
3. Choose **Directions API** from the list
4. Click **Save**

### Pricing

As of March 2025, Google Maps uses [free usage caps](https://developers.google.com/maps/billing-and-pricing/march-2025#free-usage-caps) instead of the previous $200 monthly credit. The Directions API is classified as a "Legacy" service.

This worker makes ~4 API calls per hour (2 directions every 15 minutes) during a 15-hour collection window, totaling ~1,800 requests/month. Check the [Google Maps pricing page](https://developers.google.com/maps/billing-and-pricing/pricing) for current free tier limits and costs.

## Setup

### 1. Clone and install dependencies

```bash
git clone https://github.com/yourusername/traffic-tracker.git
cd traffic-tracker
npm install
```

### 2. Create the D1 database

```bash
npx wrangler d1 create traffic-tracker
```

Copy the `database_id` from the output and update `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "traffic-tracker"
database_id = "your-database-id-here"
```

### 3. Run the database migration

```bash
npx wrangler d1 execute traffic-tracker --file=schema.sql --remote
```

### 4. Configure secrets

Set the required secrets for your worker:

```bash
# Google Maps API key (required for Directions API)
npx wrangler secret put GOOGLE_MAPS_API_KEY

# API access key (Bearer token for protected endpoints)
# Generate a secure key with: openssl rand -base64 32
npx wrangler secret put API_ACCESS_KEY

# Origin address (e.g., "123 Main St, Brooklyn, NY 11201")
npx wrangler secret put ORIGIN

# Destination address (e.g., "456 Oak Ave, Westport, CT 06880")
npx wrangler secret put DESTINATION

# Optional: Custom labels for dashboard display (defaults to "Origin"/"Destination")
npx wrangler secret put ORIGIN_LABEL
npx wrangler secret put DESTINATION_LABEL
```

### 5. Configure variables (optional)

Edit `wrangler.toml` to customize the collection window:

```toml
[vars]
START_HOUR = "6"      # Start collecting at 6am local time
END_HOUR = "21"       # Stop collecting at 9pm local time
TIMEZONE = "America/New_York"
```

### 6. Deploy

```bash
npm run deploy
```

## Usage

### Dashboard

Visit your worker URL (e.g., `https://traffic-tracker.your-subdomain.workers.dev/`) to see the traffic dashboard.

### API Endpoints

| Endpoint | Auth | Description |
|----------|------|-------------|
| `GET /` | No | Web dashboard |
| `GET /api/health` | No | Health check and stats |
| `GET /api/current` | No | Current travel estimates |
| `GET /api/data` | Yes | Aggregated traffic data (JSON) |
| `GET /api/export` | Yes | Export all data (CSV) |

#### Authentication

Protected endpoints require a Bearer token:

```bash
curl -H "Authorization: Bearer YOUR_API_ACCESS_KEY" \
  https://traffic-tracker.your-subdomain.workers.dev/api/data
```

#### Query Parameters

The `/api/data` and `/api/export` endpoints support filters:

| Parameter | Description | Example |
|-----------|-------------|---------|
| `startDate` | Filter from date (ISO 8601) | `2024-01-01` |
| `endDate` | Filter to date (ISO 8601) | `2024-12-31` |
| `direction` | Filter by direction | `outbound` or `inbound` |
| `excludeHolidays` | Exclude US federal holidays | `true` |

Example:
```bash
curl -H "Authorization: Bearer YOUR_KEY" \
  "https://your-worker.workers.dev/api/data?startDate=2024-06-01&excludeHolidays=true"
```

## Development

```bash
# Start local dev server
npm run dev
```

Note: Local development requires setting up a local D1 database. For most use cases, deploying directly to Cloudflare is recommended.

## Architecture

```
src/
├── index.ts        # Entry point: scheduled (cron) and fetch (HTTP) handlers
├── scheduled.ts    # Cron handler for data collection
├── api.ts          # REST API routes
├── dashboard.ts    # Server-rendered HTML dashboard
├── queries.ts      # D1 query builders
├── maps-api.ts     # Google Maps Directions API client
├── holidays.ts     # US federal holiday detection
└── types.ts        # TypeScript interfaces
```

## Data Collection

The worker runs every 15 minutes and:

1. Checks if current time is within the collection window (6am-9pm ET by default)
2. Fetches travel estimates from Google Maps for both directions
3. Stores results in the `trips` table with metadata (day of week, hour, holiday flag)
4. Logs collection status to `collection_log` table

## License

MIT
