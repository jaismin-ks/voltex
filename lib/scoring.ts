import {
  isInsideTorontoGrid,
  loadDatasets,
  lookupCanopyDensity,
  lookupFloodExposure,
  lookupOutageCount,
  lookupProvincialOutageCount,
  lookupProvincialVegetation,
  getHexForCoords,
  lookupWeatherHistory,
} from "./datasets";
import type {
  Coordinates,
  FactorScore,
  RiskFactors,
  RiskTier,
  WeatherSnapshot,
} from "./types";

const WEIGHTS = { wind: 0.25, canopy: 0.20, flood: 0.15, history: 0.20, weatherHistory: 0.20 };

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function tierFor(score: number): RiskTier {
  if (score >= 0.7) return "High";
  if (score >= 0.4) return "Medium";
  return "Low";
}

function buildFactor(
  label: string,
  raw: number | string | null,
  normalized: number,
  weight: number,
  detail: string,
): FactorScore {
  const n = clamp01(normalized);
  return {
    label,
    raw,
    normalized: n,
    weight,
    contribution: n * weight,
    detail,
  };
}

export interface ScoringResult {
  risk_score: number;
  risk_tier: RiskTier;
  factors: RiskFactors;
  storm_context: string;
}

/**
 * Build the weather history factor for any coordinate pair.
 * Looks up the H3 hex and its historical severe weather data.
 */
async function buildWeatherHistoryFactor(
  lat: number,
  lng: number,
  hexIndexOverride?: string,
) {
  const { weatherHistory } = await loadDatasets();
  const hexIndex = hexIndexOverride ?? getHexForCoords(lat, lng);
  const entry = lookupWeatherHistory(weatherHistory, hexIndex);
  const maxComposite = weatherHistory?.maxComposite ?? 1;

  if (!entry || entry.composite === 0) {
    return buildFactor(
      "Severe weather history",
      0,
      0,
      WEIGHTS.weatherHistory,
      "no historical severe weather data for this zone",
    );
  }

  const normalized = maxComposite > 0 ? entry.composite / maxComposite : 0;
  const parts: string[] = [];
  if (entry.tornado_events > 0) parts.push(`${entry.tornado_events} tornado events`);
  if (entry.ice_storm_events > 0) parts.push(`${entry.ice_storm_events} ice storms`);
  if (entry.high_wind_events > 0) parts.push(`${entry.high_wind_events} high-wind events`);
  if (entry.severe_thunderstorm_events > 0) parts.push(`${entry.severe_thunderstorm_events} severe thunderstorms`);
  if (entry.derecho_exposure) parts.push("derecho corridor");

  const detail = parts.length > 0
    ? `20-yr zone history: ${parts.join(", ")}`
    : "minimal historical severe weather";

  return buildFactor(
    "Severe weather history",
    entry.composite,
    normalized,
    WEIGHTS.weatherHistory,
    detail,
  );
}

export async function score(
  coords: Coordinates,
  weather: WeatherSnapshot,
  fsa?: string,
): Promise<ScoringResult> {
  const { outages, canopy, floods, provincialVegetation, provincialOutages } = await loadDatasets();

  // Wind: normalize against 100km/h (sustained gale = ceiling).
  const wind = weather.windSpeedKmh ?? 0;
  const gust = weather.windGustKmh ?? 0;
  const windAnchor = Math.max(wind, gust * 0.85);
  const windNormalized = windAnchor / 100;
  const windDetail = `${Math.round(wind)} km/h sustained${
    gust ? `, ${Math.round(gust)} km/h gust` : ""
  }${weather.conditions ? ` — ${weather.conditions}` : ""}`;

  // Canopy: normalize using the 5x5 neighborhood vs the dataset's max cell density.
  // Falls back to provincial vegetation density when outside the Toronto grid.
  const insideToronto = isInsideTorontoGrid(canopy, coords.lat, coords.lng);
  const canopyLookup = lookupCanopyDensity(canopy, coords.lat, coords.lng);
  let canopyNormalized: number;
  let canopyDetail: string;
  let canopyRaw: number | string | null;

  if (insideToronto && canopyLookup.neighborhoodTrees > 0) {
    // Toronto high-resolution street tree data.
    const cellMax = canopy?.maxCell ?? 1;
    const neighborhoodMax = cellMax * 25; // 5x5 cells
    canopyNormalized = neighborhoodMax > 0
      ? canopyLookup.neighborhoodTrees / (neighborhoodMax * 0.4)
      : 0;
    canopyDetail = `${canopyLookup.cellTrees} city trees in cell, ${canopyLookup.neighborhoodTrees} within ~1 km²`;
    canopyRaw = canopyLookup.neighborhoodTrees;
  } else {
    // Provincial fallback: coarse vegetation density grid (~11 km cells).
    const provLookup = lookupProvincialVegetation(provincialVegetation, coords.lat, coords.lng);
    const provMax = provincialVegetation?.maxCell ?? 1;
    // 3x3 neighborhood at provincial scale, normalize against a reasonable ceiling.
    const provNeighborhoodMax = provMax * 9;
    canopyNormalized = provNeighborhoodMax > 0
      ? provLookup.neighborhoodDensity / (provNeighborhoodMax * 0.4)
      : 0;
    if (provLookup.neighborhoodDensity > 0) {
      canopyDetail = `vegetation density ${provLookup.cellDensity} in cell, ${provLookup.neighborhoodDensity} within ~30 km² (provincial estimate)`;
      canopyRaw = provLookup.neighborhoodDensity;
    } else {
      canopyDetail = "vegetation index unavailable for this area";
      canopyRaw = 0;
    }
  }

  // Flood: 1.0 if inside a footprint, decays with distance otherwise.
  const floodLookup = lookupFloodExposure(floods, coords.lat, coords.lng);
  let floodNormalized = 0;
  let floodDetail = "no historical flood footprint nearby";
  if (floodLookup.insideFootprint) {
    floodNormalized = 1;
    floodDetail = "inside NRCan historical flood footprint";
  } else if (floodLookup.nearestKm < 50) {
    floodNormalized = 1 - floodLookup.nearestKm / 50;
    floodDetail = `nearest NRCan flood footprint ${floodLookup.nearestKm.toFixed(
      1,
    )} km away`;
  }

  // History: 311 storm-related counts at this FSA.
  // Falls back to provincial outage estimates for non-Toronto FSAs.
  const torontoOutageCount = lookupOutageCount(outages, fsa);
  let outageCount: number;
  let outageMax: number;
  let historyDetail: string;

  if (torontoOutageCount > 0) {
    // Toronto 311 data available for this FSA.
    outageCount = torontoOutageCount;
    outageMax = outages?.maxCount ?? 1;
    historyDetail = fsa
      ? `${outageCount} storm-related 311 events recorded in ${fsa} (recent years)`
      : "no FSA resolved — outage history unavailable";
  } else {
    // Provincial fallback.
    const provOutageCount = lookupProvincialOutageCount(provincialOutages, fsa);
    if (provOutageCount > 0) {
      outageCount = provOutageCount;
      outageMax = provincialOutages?.maxCount ?? 1;
      historyDetail = `${outageCount} estimated storm-related events in ${fsa} (provincial reliability data)`;
    } else {
      outageCount = 0;
      outageMax = 1;
      historyDetail = fsa
        ? `no outage records found for ${fsa}`
        : "no FSA resolved — outage history unavailable";
    }
  }

  const historyNormalized = outageMax > 0 ? outageCount / outageMax : 0;

  // Weather history: historical severe weather frequency for this zone.
  const weatherHistoryFactor = await buildWeatherHistoryFactor(coords.lat, coords.lng);

  const factors: RiskFactors = {
    wind: buildFactor("Wind", `${Math.round(wind)} km/h`, windNormalized, WEIGHTS.wind, windDetail),
    canopy: buildFactor(
      "Canopy",
      canopyRaw,
      canopyNormalized,
      WEIGHTS.canopy,
      canopyDetail,
    ),
    flood: buildFactor(
      "Flood",
      floodLookup.insideFootprint ? "inside footprint" : `${floodLookup.nearestKm.toFixed(1)} km`,
      floodNormalized,
      WEIGHTS.flood,
      floodDetail,
    ),
    history: buildFactor("Outage history", outageCount, historyNormalized, WEIGHTS.history, historyDetail),
    weatherHistory: weatherHistoryFactor,
  };

  const risk_score = clamp01(
    factors.wind.contribution +
      factors.canopy.contribution +
      factors.flood.contribution +
      factors.history.contribution +
      factors.weatherHistory.contribution,
  );

  const storm_context = buildStormContext(weather);

  return {
    risk_score: Math.round(risk_score * 100) / 100,
    risk_tier: tierFor(risk_score),
    factors,
    storm_context,
  };
}

/**
 * Score a zone directly by H3 index. Similar to score() but skips FSA lookup
 * and uses the hex index directly for weather history.
 */
export async function scoreZone(
  hexIndex: string,
  center: Coordinates,
  weather: WeatherSnapshot,
): Promise<ScoringResult> {
  const { outages, canopy, floods, provincialVegetation, provincialOutages } = await loadDatasets();

  // Wind
  const wind = weather.windSpeedKmh ?? 0;
  const gust = weather.windGustKmh ?? 0;
  const windAnchor = Math.max(wind, gust * 0.85);
  const windNormalized = windAnchor / 100;
  const windDetail = `${Math.round(wind)} km/h sustained${
    gust ? `, ${Math.round(gust)} km/h gust` : ""
  }${weather.conditions ? ` — ${weather.conditions}` : ""}`;

  // Canopy
  const insideToronto = isInsideTorontoGrid(canopy, center.lat, center.lng);
  const canopyLookup = lookupCanopyDensity(canopy, center.lat, center.lng);
  let canopyNormalized: number;
  let canopyDetail: string;
  let canopyRaw: number | string | null;

  if (insideToronto && canopyLookup.neighborhoodTrees > 0) {
    const cellMax = canopy?.maxCell ?? 1;
    const neighborhoodMax = cellMax * 25;
    canopyNormalized = neighborhoodMax > 0
      ? canopyLookup.neighborhoodTrees / (neighborhoodMax * 0.4) : 0;
    canopyDetail = `${canopyLookup.cellTrees} trees in cell, ${canopyLookup.neighborhoodTrees} within ~1 km²`;
    canopyRaw = canopyLookup.neighborhoodTrees;
  } else {
    const provLookup = lookupProvincialVegetation(provincialVegetation, center.lat, center.lng);
    const provMax = provincialVegetation?.maxCell ?? 1;
    const provNeighborhoodMax = provMax * 9;
    canopyNormalized = provNeighborhoodMax > 0
      ? provLookup.neighborhoodDensity / (provNeighborhoodMax * 0.4) : 0;
    canopyDetail = provLookup.neighborhoodDensity > 0
      ? `vegetation density ${provLookup.neighborhoodDensity} (provincial)`
      : "vegetation index unavailable";
    canopyRaw = provLookup.neighborhoodDensity || 0;
  }

  // Flood
  const floodLookup = lookupFloodExposure(floods, center.lat, center.lng);
  let floodNormalized = 0;
  let floodDetail = "no historical flood footprint nearby";
  if (floodLookup.insideFootprint) {
    floodNormalized = 1;
    floodDetail = "inside NRCan historical flood footprint";
  } else if (floodLookup.nearestKm < 50) {
    floodNormalized = 1 - floodLookup.nearestKm / 50;
    floodDetail = `nearest flood footprint ${floodLookup.nearestKm.toFixed(1)} km`;
  }

  // History: use provincial outage estimates (no FSA for zones)
  const provOutageCount = lookupProvincialOutageCount(provincialOutages);
  const outageCount = provOutageCount > 0 ? provOutageCount : 0;
  const outageMax = provincialOutages?.maxCount ?? 1;
  const historyNormalized = outageMax > 0 ? outageCount / outageMax : 0;
  const historyDetail = outageCount > 0
    ? `${outageCount} estimated storm-related events (provincial)`
    : "zone-level outage history not available";

  // Weather history: direct hex lookup
  const weatherHistoryFactor = await buildWeatherHistoryFactor(center.lat, center.lng, hexIndex);

  const factors: RiskFactors = {
    wind: buildFactor("Wind", `${Math.round(wind)} km/h`, windNormalized, WEIGHTS.wind, windDetail),
    canopy: buildFactor("Canopy", canopyRaw, canopyNormalized, WEIGHTS.canopy, canopyDetail),
    flood: buildFactor(
      "Flood",
      floodLookup.insideFootprint ? "inside footprint" : `${floodLookup.nearestKm.toFixed(1)} km`,
      floodNormalized,
      WEIGHTS.flood,
      floodDetail,
    ),
    history: buildFactor("Outage history", outageCount, historyNormalized, WEIGHTS.history, historyDetail),
    weatherHistory: weatherHistoryFactor,
  };

  const risk_score = clamp01(
    factors.wind.contribution +
      factors.canopy.contribution +
      factors.flood.contribution +
      factors.history.contribution +
      factors.weatherHistory.contribution,
  );

  return {
    risk_score: Math.round(risk_score * 100) / 100,
    risk_tier: tierFor(risk_score),
    factors,
    storm_context: buildStormContext(weather),
  };
}

function buildStormContext(weather: WeatherSnapshot): string {
  const parts: string[] = [];
  if (weather.conditions) parts.push(weather.conditions);
  if (weather.temperatureC !== undefined) parts.push(`${Math.round(weather.temperatureC)}°C`);
  if (weather.windSpeedKmh) parts.push(`winds ${Math.round(weather.windSpeedKmh)} km/h`);
  if (weather.windGustKmh) parts.push(`gusts ${Math.round(weather.windGustKmh)} km/h`);
  if (weather.alerts.length) parts.push(`alerts: ${weather.alerts.join(", ")}`);
  if (!parts.length) return "no live weather signal";
  return parts.join(" · ");
}
