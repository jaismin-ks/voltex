# Voltex — Storm Outage Risk Predictor
### Project Spec v1.0

---

## Overview

Voltex is a demo web application that allows a utility operator (or any user) to enter a location in Ontario and receive a real-time outage risk assessment for that area. The tool ingests live weather data, cross-references pre-loaded static datasets, computes a risk score, and uses an LLM to generate a plain-language utility response recommendation.

Built in response to **Seneca Polytechnic x Industry Challenge — Theme 2, Problem Statement 1:**
> *Storms, heatwaves, and ice events are becoming more frequent and severe. Utilities struggle to anticipate where outages will occur, leading to reactive responses and longer restoration times.*

---

## Goals

- Demonstrate a working end-to-end prediction pipeline from a single location input
- Surface actionable, human-readable risk output powered by an LLM
- Show how open public datasets can be combined into a meaningful infrastructure tool
- Serve as a portfolio-grade demo tying together backend data engineering, API integration, and AI-augmented output

Theme 2: Smart Grid, Resilience and Electrification
Extreme weather, rising demand, and electrification of transportation and buildings are
putting unprecedented pressure on electrical grids. Utilities must strengthen resilience,
predict outages, and plan for future load growth. This theme focuses on climate risk,
infrastructure vulnerability, and electrification challenges.
Problem Statement 1:
Storms, heatwaves, and ice events are becoming more frequent and severe. Utilities
struggle to anticipate where outages will occur, leading to reactive responses and longer
restoration times.
Possible solution(s):
• Outage Prediction Model: Build a simple model that uses weather, vegetation, and
infrastructure data to predict outage hotspots.
• Storm Impact Dashboard: Design a dashboard that visualizes likely outage zones
and risk levels.
• Proactive Response Workflow: Outline a workflow that utilities can use to prepare
for storms.
Datasets Needed:
Weather, flood zones, temperature, wind, vegetation, feeder locations.
Public Dataset Sources (Examples):
• Environment Canada Weather: https://weather.gc.ca/
• Living Atlas – Real-Time Weather: https://livingatlas.arcgis.com
• NRCan Flood Hazard Maps: https://open.canada.ca
• Toronto Tree Canopy: https://open.toronto.ca/
• Peel Region Environmental Layers: https://opendata.peelregion.ca/

---

## User Flow

```
User enters location (e.g. "Scarborough, Ontario")
        ↓
Geocode location → lat/lng bounding box
        ↓
Parallel data fetch:
  ├── Live weather (Environment Canada API)
  ├── Flood zone score (pre-loaded NRCan CSV)
  ├── Tree canopy density (pre-loaded Toronto Open Data GeoJSON)
  └── Historical outage frequency (pre-loaded Toronto Open Data CSV)
        ↓
Risk scoring engine → weighted formula → 0.0–1.0 score + tier (High / Medium / Low)
        ↓
LLM API call (Gemini) → plain-language summary + recommended utility actions
        ↓
Frontend renders:
  ├── Risk tier badge + score
  ├── Factor breakdown (what's driving the score)
  ├── LLM-generated narrative
  └── Map view with zone highlighted
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Tailwind CSS |
| Backend | Javascript on Next |
| Geocoding | Nominatim (OpenStreetMap, free) |
| Data storage | SQLite + flat CSV/GeoJSON files |
| Weather (live) | Environment Canada weather.gc.ca |
| LLM | Gemini API |
| Map rendering | Leaflet.js or ArcGIS JS SDK |
| Deployment | Railway (backend) + Vercel (frontend) |

---

## Data Sources

### Static (pre-loaded at startup, stored locally)

| Dataset | Source | Format | Used For |
|---|---|---|---|
| Historical outage events | Toronto Open Data | CSV | Outage history score per zone |
| Tree canopy density | Toronto Open Data | GeoJSON | Vegetation risk near feeders |
| Flood hazard zones | NRCan / open.canada.ca | GeoJSON | Flood exposure score |
| Peel Region env. layers | opendata.peelregion.ca | GeoJSON | Coverage outside Toronto |

### Live (fetched per request)

| Dataset | Source | How |
|---|---|---|
| Current weather + forecast | Environment Canada | REST API (weather.gc.ca) |
| Location coordinates | Nominatim OSM | Geocoding API |

---

## Risk Scoring Model

Each input location is scored against four weighted factors. Weights are tunable.

```
risk_score = (
  wind_weight       * normalize(wind_speed_kmh)       +   # 0.30
  canopy_weight     * canopy_density_score             +   # 0.25
  flood_weight      * flood_zone_score                 +   # 0.20
  history_weight    * outage_frequency_score           +   # 0.25
)
```

**Score → Tier mapping:**
- `0.00 – 0.39` → Low Risk (Green)
- `0.40 – 0.69` → Medium Risk (Amber)
- `0.70 – 1.00` → High Risk (Red)

All input features are normalized to 0–1 before weighting. Model is intentionally transparent and explainable — no black box.

---

## LLM Integration

After scoring, a structured payload is sent to the Gemini API

### System Prompt
```
You are a utility grid operations assistant. You will receive a structured outage 
risk assessment for a specific zone in Ontario, Canada. Generate a concise, 
professional plain-language summary (3–5 sentences) describing the risk level, 
the primary contributing factors, and 2–3 specific recommended utility actions. 
Write for a utility operations supervisor, not a general audience.
```

### User Prompt (injected per request)
```json
{
  "location": "Scarborough, Ontario",
  "risk_score": 0.82,
  "risk_tier": "High",
  "storm_event": "Ice storm forecast — -8°C, 40mm freezing rain, winds 87km/h",
  "factors": {
    "wind_speed_kmh": 87,
    "canopy_density": "High — dense urban tree cover near feeder corridors",
    "flood_zone": "Moderate — partial overlap with NRCan Zone B",
    "outage_history": "3 recorded outage events in past 24 months"
  }
}
```

### Expected Output (example)
> "Scarborough East is currently rated High Risk ahead of the incoming ice storm. The primary drivers are sustained wind speeds of 87km/h combined with dense tree canopy adjacent to feeder corridors, which historically correlates with downed lines. Pre-positioning repair crews at the Markham Road and Ellesmere staging areas is recommended. Proactive public alerts for the Kingston Road corridor should be issued within the next 2 hours. Monitor feeder load at substations 14 and 17 for early anomaly detection."

---

## Frontend Screens

### 1. Search Screen
- Single centered search bar: `Enter a location in Ontario...`
- Submit triggers the full pipeline
- Loading state with step indicators ("Fetching weather...", "Scoring risk...", "Generating report...")

### 2. Results Screen
- **Header:** Location name + risk tier badge (colour-coded)
- **Score card:** Numeric score (e.g. 0.82 / 1.0) with visual gauge
- **Factor breakdown:** 4 factor cards showing each input value and its contribution
- **LLM Narrative:** Plain-language recommendation block with utility action bullets
- **Map panel:** Leaflet map with the queried zone highlighted in risk colour
- **Search again** CTA

---

## API Endpoints (FastAPI)

```
POST /api/assess
  Body: { "location": "Scarborough, Ontario" }
  Returns: {
    "location": string,
    "coordinates": { lat, lng },
    "risk_score": float,
    "risk_tier": "High" | "Medium" | "Low",
    "factors": { ... },
    "storm_context": string,
    "llm_narrative": string
  }
```

---

## Out of Scope (for demo)

- Real feeder-level GIS data (utility proprietary — simulated or approximated from public zones)
- User authentication
- Multi-location batch processing
- Historical trend views
- Mobile-optimized layout (desktop demo only)

---

## Stretch Goals

- Toggle between storm types (ice storm / heatwave / high wind) to show how risk profile shifts
- Exportable PDF report per location
- Side-by-side comparison of two zones
- Confidence interval displayed alongside score

---

## Alignment to Challenge Criteria

| Criterion | How Voltex addresses it |
|---|---|
| Uses public datasets | Environment Canada, NRCan, Toronto Open Data, Peel Open Data |
| Addresses utility pain point | Reactive outage response → proactive risk scoring |
| GIS / spatial component | Leaflet map, GeoJSON flood + canopy layers, geocoded zones |
| Data-driven insights | Weighted scoring model with explainable factor breakdown |
| Actionable output | LLM-generated utility recommendations, not just raw scores |
| Feasibility | All data sources are public and free; stack is fully deployable |