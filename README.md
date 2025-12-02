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

### Pricing & API Usage

Google Maps provides **10,000 free Directions API requests per month**. After that, it's [$5 per 1,000 requests](https://developers.google.com/maps/billing-and-pricing/pricing).

#### Usage Calculator

Each route requires 2 API calls per collection (outbound + inbound), collected every 15 minutes during your configured hours.

| Routes | Calls/Hour | Calls/Day (15h) | Calls/Week | Calls/Month | Free Tier? |
|--------|------------|-----------------|------------|-------------|------------|
| 1      | 8          | 120             | 840        | ~3,600      | Yes |
| 2      | 16         | 240             | 1,680      | ~7,200      | Yes |
| 3      | 24         | 360             | 2,520      | ~10,800     | ~Borderline |
| 4      | 32         | 480             | 3,360      | ~14,400     | No (~$22/mo) |

**Formula:** `routes × 2 directions × 4 per hour × hours/day × 30 days`

**Example (4 destinations):**
- 4 routes × 2 directions = 8 API calls per collection
- 4 collections/hour × 15 hours = 480 calls/day
- 480 × 30 = **14,400 calls/month**
- Overage: 4,400 calls × $0.005 = **~$22/month**

**Tips to reduce usage:**
- Reduce collection hours (`START_HOUR`/`END_HOUR` in wrangler.toml)
- Set `active: false` on routes you don't need real-time data for

## Setup

### 1. Clone and install dependencies

```bash
git clone https://github.com/hirefrank/traffic-tracker.git
cd traffic-tracker
pnpm install
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

### 3. Initialize the database

```bash
pnpm run db:init
```

### 4. Configure secrets

```bash
# Google Maps API key (required for Directions API)
npx wrangler secret put GOOGLE_MAPS_API_KEY

# API access key (Bearer token for protected endpoints)
# Generate a secure key with: openssl rand -base64 32
npx wrangler secret put API_ACCESS_KEY
```

### 5. Configure routes

Copy the example routes file and customize:

```bash
cp routes.example.yaml routes.yaml
```

Edit `routes.yaml` with your locations:

```yaml
origin:
  address: 123 Main St, Brooklyn, NY 11201
  label: Home

routes:
  - id: work
    label: Office
    destination: 456 Oak Ave, Manhattan, NY 10001
    active: true

  - id: gym
    label: Gym
    destination: 789 Fitness Blvd, Brooklyn, NY 11215
    active: true
```

Push routes to Cloudflare:

```bash
pnpm run routes:push
```

This pushes `ORIGIN`, `ORIGIN_LABEL`, and `ROUTES` secrets in one command.

### 6. Configure variables (optional)

Edit `wrangler.toml` to customize the collection window:

```toml
[vars]
START_HOUR = "6"      # Start collecting at 6am local time
END_HOUR = "21"       # Stop collecting at 9pm local time
TIMEZONE = "America/New_York"
```

### 7. Deploy

```bash
pnpm run deploy
```

## Usage

### Dashboard

Visit your worker URL to see the traffic dashboard:

- `/` - Redirects to the first route
- `/route/{id}` - Dashboard for a specific route (e.g., `/route/work`)

Each route has its own dashboard with travel time charts, heatmaps, and statistics.

### API Endpoints

| Endpoint | Auth | Description |
|----------|------|-------------|
| `GET /` | No | Redirects to first route dashboard |
| `GET /route/{id}` | No | Dashboard for a specific route |
| `GET /api/routes` | No | List of configured routes |
| `GET /api/health` | No | Health check and stats |
| `GET /api/current?routeId=xxx` | No | Current travel estimates for a route |
| `GET /api/data?routeId=xxx` | Yes | Aggregated traffic data (JSON) |
| `GET /api/export?routeId=xxx` | Yes | Export route data (CSV) |

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
pnpm run dev
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

## Deploying Your Own Instance

If you fork this repo to track your own route, you'll need to update the following:

### 1. Update `wrangler.toml`

Remove or replace these project-specific values:

```toml
# Remove this line (you'll set your own after creating the database)
database_id = "..."

# Remove this line (uses your default account, or set your own)
account_id = "..."

# Remove or update the routes section for your domain
[[routes]]
pattern = "yourdomain.com/traffic*"
zone_name = "yourdomain.com"
```

### 2. Create your D1 database

```bash
npx wrangler d1 create traffic-tracker
```

Copy the new `database_id` into your `wrangler.toml`.

### 3. Initialize the database

```bash
pnpm run db:init
```

### 4. Set your secrets

```bash
# Required
npx wrangler secret put GOOGLE_MAPS_API_KEY
npx wrangler secret put API_ACCESS_KEY        # Generate with: openssl rand -base64 32
```

### 5. Configure routes

```bash
cp routes.example.yaml routes.yaml
# Edit routes.yaml with your addresses
pnpm run routes:push
```

### 6. Customize collection window (optional)

Edit the `[vars]` section in `wrangler.toml`:

```toml
[vars]
START_HOUR = "6"              # Start collecting at 6am
END_HOUR = "21"               # Stop at 9pm
TIMEZONE = "America/New_York" # Your timezone
```

### 7. Deploy

```bash
pnpm run deploy
```

## License

MIT
