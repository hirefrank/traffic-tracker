# Traffic Tracker

A Cloudflare Worker that collects travel time estimates between two locations using the Google Maps Directions API. It runs on a 15-minute cron schedule during configurable hours and provides a web dashboard for visualizing traffic patterns.

**[View live demo →](https://hirefrank.com/traffic)**

## Features

- Collects travel time data for both directions every 15 minutes
- Stores data in Cloudflare D1 (SQLite at the edge)
- Web dashboard with Chart.js visualizations and heatmaps
- Advanced analytics (percentiles, variance, reliability metrics, traffic patterns)
- Google Maps predictions integration for instant heatmaps (see [ANALYTICS.md](ANALYTICS.md))
- REST API for data access and CSV export
- Holiday detection (excludes US federal holidays from analysis)
- Configurable collection window (default: 6am-8pm, 14 hours)
- Multi-route support with YAML configuration

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

| Routes | Calls/Hour | Calls/Day (14h) | Calls/Week | Calls/Month | Free Tier? |
|--------|------------|-----------------|------------|-------------|------------|
| 1      | 8          | 112             | 784        | ~3,360      | ✅ Yes |
| 2      | 16         | 224             | 1,568      | ~6,720      | ✅ Yes |
| 3      | 24         | 336             | 2,352      | ~10,080     | ✅ Yes (~$0.40/mo) |
| 4      | 32         | 448             | 3,136      | ~13,440     | ❌ No (~$17/mo) |

**Formula:** `routes × 2 directions × 4 per hour × hours/day × 30 days`

**Example (3 routes, 14 hours/day):**
- 3 routes × 2 directions = 6 API calls per collection
- 4 collections/hour × 14 hours = 336 calls/day
- 336 × 30 = **10,080 calls/month**
- Free tier: 10,000 calls/month
- Overage: 80 calls × $0.005 = **~$0.40/month**

**Tips to stay under the free tier:**
- Default configuration: 6am-8pm (14 hours) keeps 3 routes within free tier
- Set `active: false` on routes you don't need real-time data for
- Use predictions feature (see [ANALYTICS.md](ANALYTICS.md)) for less-critical routes

## Setup

### 1. Clone and install dependencies

```bash
git clone https://github.com/hirefrank/traffic-tracker.git
cd traffic-tracker
pnpm install
```

### 2. Configure wrangler

Copy the example configuration and customize it:

```bash
cp wrangler.example.toml wrangler.toml
```

Edit `wrangler.toml` and update:
- `account_id` (optional, defaults to your account)
- Domain routes (if using custom domain)
- Timezone and collection hours

### 3. Create the D1 database

```bash
npx wrangler d1 create traffic-tracker
```

Copy the `database_id` from the output and update it in `wrangler.toml`.

### 4. Initialize the database

```bash
pnpm run db:init
```

### 5. Configure secrets

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
END_HOUR = "20"       # Stop collecting at 8pm local time (14 hours keeps 3 routes in free tier)
TIMEZONE = "America/New_York"
BASE_PATH = "/traffic"  # URL base path
```

### 7. Deploy

```bash
pnpm run deploy
```

## Usage

### Dashboard

Visit your worker URL to see the traffic dashboard:

**Default environment:**
- `yourdomain.com/traffic` - Redirects to the first route
- `yourdomain.com/traffic/route/{id}` - Dashboard for a specific route (e.g., `/traffic/route/work`)

**Other environments use their BASE_PATH:**
- `yourdomain.com/user1-traffic` - User 1's dashboard
- `yourdomain.com/user2-traffic` - User 2's dashboard

Each route has its own dashboard with:
- Real-time travel time estimates
- 15-minute interval line chart
- Day/hour heatmap with actual data and predictions toggle
- Advanced analytics (load on demand)
- Best/worst time slots
- Filter controls (date ranges, weekdays, holidays)

### API Endpoints

All API endpoints are prefixed with the environment's `BASE_PATH` (e.g., `/traffic/api/*` for default, `/user1-traffic/api/*` for other users).

| Endpoint | Auth | Description |
|----------|------|-------------|
| `GET {BASE_PATH}` | No | Redirects to first route dashboard |
| `GET {BASE_PATH}/route/{id}` | No | Dashboard for a specific route |
| `GET {BASE_PATH}/api/routes` | No | List of configured routes |
| `GET {BASE_PATH}/api/health` | No | Health check and stats |
| `GET {BASE_PATH}/api/current?routeId=xxx` | No | Current travel estimates for a route |
| `GET {BASE_PATH}/api/analytics?routeId=xxx` | No | Advanced analytics (percentiles, variance, patterns) |
| `GET {BASE_PATH}/api/data?routeId=xxx` | Yes | Aggregated traffic data (JSON) |
| `GET {BASE_PATH}/api/export?routeId=xxx` | Yes | Export route data (CSV) |
| `POST {BASE_PATH}/api/predictions/generate?routeId=xxx` | Yes | Generate prediction heatmap from Google Maps |
| `GET {BASE_PATH}/api/predictions/heatmap?routeId=xxx` | No | Get prediction-based heatmap data |
| `GET {BASE_PATH}/api/predictions/accuracy?routeId=xxx` | Yes | Get prediction accuracy stats |

#### Authentication

Protected endpoints require a Bearer token:

```bash
curl -H "Authorization: Bearer YOUR_API_ACCESS_KEY" \
  https://yourdomain.com/traffic/api/data
```

#### Query Parameters

The `/api/data`, `/api/export`, and `/api/analytics` endpoints support filters:

| Parameter | Description | Example |
|-----------|-------------|---------|
| `routeId` | Filter by route ID | `work` |
| `startDate` | Filter from date (ISO 8601) | `2024-01-01` |
| `endDate` | Filter to date (ISO 8601) | `2024-12-31` |
| `direction` | Filter by direction | `outbound` or `inbound` |
| `excludeHolidays` | Exclude US federal holidays | `true` |
| `weekdaysOnly` | Only include Mon-Fri | `true` |

Example:
```bash
curl -H "Authorization: Bearer YOUR_KEY" \
  "https://yourdomain.com/traffic/api/data?routeId=work&startDate=2024-06-01&weekdaysOnly=true"
```

For detailed analytics documentation, see [ANALYTICS.md](ANALYTICS.md).

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
├── dashboard.ts    # Server-rendered HTML dashboard with Chart.js
├── queries.ts      # D1 query builders with filter support
├── analytics.ts    # Advanced statistics (percentiles, variance, patterns)
├── predictions.ts  # Google Maps predictions and accuracy tracking
├── maps-api.ts     # Google Maps Directions API client
├── holidays.ts     # US federal holiday detection
└── types.ts        # TypeScript interfaces
```

## Data Collection

The worker runs every 15 minutes and:

1. Checks if current time is within the collection window (6am-8pm by default, 14 hours)
2. Fetches travel estimates from Google Maps for both directions
3. Stores results in the `trips` table with metadata (day of week, hour, holiday flag)
4. Logs collection status to `collection_log` table

## Multi-Environment Deployment

This project supports **multiple independent deployments** from a single codebase using Wrangler environments. This is useful when multiple people want to track their own routes without forking the repository.

### How It Works

Each environment has:
- Its own Worker deployment
- Separate D1 database
- Independent routes configuration
- Isolated secrets
- Custom URL base path (e.g., `/traffic`, `/user1-traffic`, `/user2-traffic`)
- Timezone settings

All environments share:
- The same codebase
- The same cron schedule (every 15 minutes)
- The same deployment workflow

### Adding a New Environment

**Example:** Adding a deployment for "Alice"

1. **Add environment to `wrangler.toml`:**

```toml
[env.alice]
name = "alice-traffic-tracker"
workers_dev = true
routes = [
  { pattern = "yourdomain.com/alice-traffic*", zone_name = "yourdomain.com" }
]

[[env.alice.d1_databases]]
binding = "DB"
database_name = "alice-traffic-tracker"
database_id = "placeholder-until-created"

[env.alice.vars]
START_HOUR = "6"
END_HOUR = "20"
TIMEZONE = "America/Chicago"
BASE_PATH = "/alice-traffic"
```

2. **Add deployment scripts to `package.json`:**

```json
{
  "scripts": {
    "deploy:alice": "wrangler deploy --env alice",
    "db:create:alice": "wrangler d1 create alice-traffic-tracker",
    "db:init:alice": "wrangler d1 execute alice-traffic-tracker --remote --file=migrations/000-initial.sql",
    "db:migrate:alice": "wrangler d1 execute alice-traffic-tracker --remote --file=migrations/001-predictions.sql",
    "routes:push:alice": "ENV=alice node scripts/push-routes.js"
  }
}
```

3. **Create D1 database and initialize:**

```bash
pnpm run db:create:alice
# Copy the database_id from output and update wrangler.toml

pnpm run db:init:alice
pnpm run db:migrate:alice
```

4. **Create routes configuration:**

Create `routes.alice.yaml`:

```yaml
origin:
  address: 123 Alice Street, Chicago, IL 60601
  label: Home

routes:
  - id: work
    label: Office
    destination: 456 Work Ave, Chicago, IL 60602
    active: true
```

5. **Set secrets:**

```bash
# Use the same Google Maps API key (can be shared)
wrangler secret put GOOGLE_MAPS_API_KEY --env alice

# Generate a new API access key for Alice
openssl rand -base64 32 | wrangler secret put API_ACCESS_KEY --env alice

# Push routes configuration
pnpm run routes:push:alice
```

6. **Deploy:**

```bash
pnpm run deploy:alice
```

Alice's deployment will be accessible at `yourdomain.com/alice-traffic`.

## Deploying Your Own Instance

If you fork this repo to track your own route, follow the setup steps above. The key files to customize:

1. **`wrangler.toml`** - Copy from `wrangler.example.toml` and update with your database ID and domain
2. **`routes.yaml`** - Copy from `routes.example.yaml` and add your addresses
3. **Secrets** - Set `GOOGLE_MAPS_API_KEY` and `API_ACCESS_KEY` via `wrangler secret put`

All deployment-specific configuration is gitignored, so your personal data stays private.

## License

MIT
