export type RiskTier = "Low" | "Medium" | "High";

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface GeocodeResult {
  displayName: string;
  coordinates: Coordinates;
  postcode?: string;
  fsa?: string;
}

export interface WeatherSnapshot {
  stationName?: string;
  windSpeedKmh: number;
  windGustKmh?: number;
  temperatureC?: number;
  conditions?: string;
  alerts: string[];
  forecastSummary?: string;
  source: string;
}

export interface FactorScore {
  raw: number | string | null;
  normalized: number;
  weight: number;
  contribution: number;
  label: string;
  detail: string;
}

export interface RiskFactors {
  wind: FactorScore;
  canopy: FactorScore;
  flood: FactorScore;
  history: FactorScore;
  weatherHistory: FactorScore;
}

/** Hex zone geometry for map rendering. */
export interface HexZone {
  h3Index: string;
  center: Coordinates;
  boundary: [number, number][];
  region: string;
}

export interface AssessResponse {
  location: string;
  coordinates: Coordinates;
  fsa?: string;
  risk_score: number;
  risk_tier: RiskTier;
  factors: RiskFactors;
  storm_context: string;
  llm_narrative: string;
  llm_source: "gemini" | "local";
  weather: WeatherSnapshot;
  generated_at: string;
  zone?: {
    h3Index: string;
    zone_risk_score: number;
    zone_risk_tier: RiskTier;
    region: string;
  };
}

/**
 * Lightweight per-city result returned by /api/assess-batch.
 * Does not include the LLM narrative — that is fetched lazily by the
 * detail panel via the full /api/assess endpoint.
 */
export interface SlimAssessResult {
  name: string;
  label: string;
  coordinates: Coordinates;
  risk_score: number;
  risk_tier: RiskTier;
  factors: RiskFactors;
  storm_context: string;
  weather: WeatherSnapshot;
  generated_at: string;
}

export interface BatchAssessResponse {
  results: SlimAssessResult[];
  errors: { name: string; message: string }[];
  generated_at: string;
}

/** Per-zone risk result returned by /api/assess-zones. */
export interface ZoneRiskResult {
  h3Index: string;
  center: Coordinates;
  boundary: [number, number][];
  risk_score: number;
  risk_tier: RiskTier;
  factors: RiskFactors;
  storm_context: string;
  region: string;
  zone_label: string;
}

export interface ZoneBatchResponse {
  zones: ZoneRiskResult[];
  summary: {
    high_count: number;
    medium_count: number;
    low_count: number;
    peak_zone: string;
    peak_score: number;
  };
  generated_at: string;
}
