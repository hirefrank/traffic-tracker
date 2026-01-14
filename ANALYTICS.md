# Traffic Tracker - Advanced Analytics & Predictions

## Overview

Traffic Tracker now includes advanced analytics and prediction features that answer the key question: **"Is collecting actual data worth it, or can we rely on Google's predictions?"**

**Note on URLs:** All examples use `/traffic/api/*` as the base path. If you're using a different environment, replace `/traffic` with your environment's `BASE_PATH` (e.g., `/user1-traffic/api/*` or `/user2-traffic/api/*`).

## New Features

### 1. **Instant Heatmap Generation** 🚀

Generate a complete week's traffic heatmap for a **brand new route** without collecting any data.

**How it works:**
- Uses Google Maps `departure_time` parameter to query predictions for every hour/day combination
- Creates 7 days × 16 hours × 2 directions = **224 predictions** per route
- Provides instant visualization while you wait for actual data to accumulate

**API Usage:**
```bash
# Generate week of predictions for a new route
curl -X GET "https://yourdomain.com/traffic/api/predictions/generate?routeId=work&type=week" \
  -H "Authorization: Bearer YOUR_API_KEY"

# Response:
{
  "success": true,
  "predictions_generated": 224,
  "route_id": "work",
  "type": "week"
}

# View the instant heatmap
curl "https://yourdomain.com/traffic/api/predictions/heatmap?routeId=work&model=best_guess"
```

**Cost Analysis:**
- Week generation: ~224 API calls (one-time)
- Within Google's 40,000/month free tier
- Compare to 15-min actual collection: 672 calls/week

### 2. **Prediction Accuracy Tracking** 📊

Track how accurate Google's predictions are compared to reality.

**Metrics Provided:**
- **Average Error**: Mean absolute difference between predicted and actual
- **Bias**: Whether Google tends to over/under-estimate
- **RMSE**: Root mean squared error for statistical rigor
- **Breakdown**: By day, hour, direction, and traffic model

**API Usage:**
```bash
# Get prediction accuracy for a route
curl "https://yourdomain.com/traffic/api/predictions/accuracy?routeId=work&model=best_guess" \
  -H "Authorization: Bearer YOUR_API_KEY"

# Response includes:
{
  "route_id": "work",
  "traffic_model": "best_guess",
  "predictions_linked": 142,
  "accuracy_data": [
    {
      "direction": "outbound",
      "day_of_week": 1,
      "hour_local": 8,
      "prediction_count": 4,
      "avg_predicted_minutes": 115.5,
      "avg_actual_minutes": 122.3,
      "avg_error_minutes": 8.2,
      "avg_bias_minutes": -6.8,
      "rmse_minutes": 9.1
    }
  ]
}
```

### 3. **Traffic Model Variations** 🎯

Google provides three traffic models for predictions:

- **best_guess** (default): Most likely scenario
- **pessimistic**: Upper bound estimate (worst-case)
- **optimistic**: Lower bound estimate (best-case)

**Use Case:**
Generate predictions with all three models to understand the range of possibilities.

```bash
# Generate daily predictions with all models (next 24 hours)
curl -X GET "https://yourdomain.com/traffic/api/predictions/generate?routeId=work&type=daily" \
  -H "Authorization: Bearer YOUR_API_KEY"

# This creates 24 hours × 2 directions × 3 models = 144 predictions
# Useful for understanding confidence intervals
```

### 4. **Advanced Statistical Analysis** 📈

Deep dive into your actual traffic data with comprehensive statistics.

**Metrics Included:**

#### Statistical Summary
- Mean, Median (P50)
- P75, P90, P95 percentiles
- Standard deviation
- Coefficient of variation (reliability indicator)
- Min/Max values

#### Hourly Variance
- Identifies which time slots are most unpredictable
- Calculates standard deviation per hour
- Ranks hours by coefficient of variation

#### Traffic Pattern Classification
- **Free Flow**: Below average - σ/2
- **Moderate**: Average ± σ/2
- **Heavy**: Average + σ/2 to + 1.5σ
- **Gridlock**: Above average + 1.5σ

#### Reliability Metrics
- "X% of trips complete in Y minutes"
- Confidence levels: 50%, 75%, 80%, 90%, 95%

**API Usage:**
```bash
curl "https://yourdomain.com/traffic/api/analytics?routeId=work&excludeHolidays=true" \
  -H "Authorization: Bearer YOUR_API_KEY"

# Response:
{
  "statistical_summary": [
    {
      "direction": "outbound",
      "sample_count": 801,
      "mean_minutes": 119.5,
      "median_minutes": 117.2,
      "p75_minutes": 132.8,
      "p90_minutes": 148.5,
      "p95_minutes": 165.3,
      "std_dev_minutes": 28.4,
      "min_minutes": 64.0,
      "max_minutes": 221.0,
      "coefficient_of_variation": 0.238
    }
  ],
  "hourly_variance": [...],
  "traffic_patterns": [
    {
      "pattern_type": "free_flow",
      "min_threshold_minutes": 0,
      "max_threshold_minutes": 105,
      "occurrence_count": 234,
      "percentage": 29.2
    }
  ],
  "reliability_metrics": [
    {
      "direction": "outbound",
      "confidence_level": 95,
      "duration_minutes": 165
    }
  ]
}
```

## Database Schema

### New Table: `predictions`

```sql
CREATE TABLE predictions (
  id INTEGER PRIMARY KEY,
  predicted_at DATETIME,           -- When prediction was made
  predicted_for DATETIME,          -- What time it's predicting
  direction TEXT,
  route_id TEXT,
  predicted_duration_seconds INT,
  traffic_model TEXT,              -- best_guess, pessimistic, optimistic
  actual_trip_id INTEGER,          -- Linked to actual measurement
  day_of_week INTEGER,
  hour_local INTEGER,
  is_holiday INTEGER
);
```

### View: `prediction_accuracy`

Pre-calculated accuracy metrics joining predictions with actual trips.

## Answering Your Key Question

### "Is actual data collection worth it?"

**After 1 week of data (1,602 samples), here's what you can do:**

1. **Run Accuracy Analysis**
   ```bash
   # Generate predictions for the past week
   curl -X GET "https://yourdomain.com/traffic/api/predictions/generate?routeId=work&type=week"

   # Compare to actual data
   curl "https://yourdomain.com/traffic/api/predictions/accuracy?routeId=work"
   ```

2. **Calculate ROI Metrics**
   - If Google's predictions are within 5-10 min error: **Predictions might be sufficient**
   - If error > 15 min or high variance: **Actual collection adds value**
   - If bias is consistent: You can **calibrate** predictions and stop collecting

3. **Hybrid Approach**
   - Use predictions for instant heatmap
   - Collect actuals for 2-4 weeks to validate
   - If accuracy is good: switch to weekly/monthly spot checks
   - If accuracy is poor: continue 15-min collection

## Usage Workflow

### For a New Route

```bash
# Step 1: Generate instant heatmap
curl -X GET "https://yourdomain.com/traffic/api/predictions/generate?routeId=new-gym&type=week" \
  -H "Authorization: Bearer YOUR_API_KEY"

# Step 2: View predictions immediately
curl "https://yourdomain.com/traffic/api/predictions/heatmap?routeId=new-gym"

# Step 3: Enable actual collection in routes.yaml
# Set active: true for the route

# Step 4: After 1-2 weeks, check accuracy
curl "https://yourdomain.com/traffic/api/predictions/accuracy?routeId=new-gym" \
  -H "Authorization: Bearer YOUR_API_KEY"

# Step 5: Decide whether to continue collection
```

### For Existing Routes

```bash
# Get comprehensive analytics
curl "https://yourdomain.com/traffic/api/analytics?routeId=work&startDate=2025-12-01" \
  -H "Authorization: Bearer YOUR_API_KEY"

# Check if patterns are stable or changing
# High variance = keep collecting
# Low variance = consider reducing frequency
```

## Cost Optimization Strategies

### Current Costs (15-min intervals)
- **API calls**: 96/day = ~2,880/month per route
- **Free tier**: 40,000/month
- **Max routes at 15-min**: ~13 routes

### Option 1: Predictions Only
- **Initial cost**: 224 calls (one-time)
- **Validation**: 96 calls/week for spot checks
- **~10x cost reduction**

### Option 2: Hybrid (Recommended)
- **Predictions**: Instant heatmap (224 calls)
- **Actual collection**: 2 weeks at 15-min (1,344 calls)
- **Accuracy check**: Validate predictions
- **Decision**: Continue or reduce based on accuracy

### Option 3: Dynamic Sampling
- **Rush hours** (6-9am, 3-6pm): 15-min intervals
- **Off-peak**: 30-min or 60-min intervals
- **Weekends**: Hourly sampling
- **Saves ~50-70% of API calls**

## Next Steps

1. **Run Migration**: `pnpm run db:init` to create predictions table
2. **Generate Predictions**: Test with your existing routes
3. **Compare Accuracy**: Run for 1 week alongside actual collection
4. **Make Decision**: Keep actual, use predictions, or hybrid approach

## API Reference

All new endpoints require `Authorization: Bearer YOUR_API_KEY` header (except heatmap view).

### Endpoints

- `POST /api/predictions/generate?routeId=X&type=week|daily` - Generate predictions
- `GET /api/predictions/heatmap?routeId=X&model=best_guess` - View prediction heatmap
- `GET /api/predictions/accuracy?routeId=X&model=best_guess` - Get accuracy metrics
- `GET /api/analytics?routeId=X&startDate=YYYY-MM-DD` - Advanced statistics

### Query Parameters

All endpoints support standard filters:
- `routeId` - Required for predictions
- `startDate`, `endDate` - Date range filters
- `direction` - outbound/inbound
- `excludeHolidays` - true/false
- `model` - best_guess/pessimistic/optimistic (predictions only)
- `type` - week/daily (generation only)
