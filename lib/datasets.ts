import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { latLngToCell } from "h3-js";

interface OutageIndex {
  maxCount: number;
  countsByFsa: Record<string, number>;
}

interface CanopyGrid {
  bbox: { minLat: number; maxLat: number; minLng: number; maxLng: number };
  step: number;
  maxCell: number;
  grid: Record<string, number>;
}

interface FloodFeature {
  type: "Feature";
  geometry: { type: string; coordinates: unknown };
  properties: Record<string, unknown>;
}

interface FloodIndex {
  type: "FeatureCollection";
  features: FloodFeature[];
}

/** Province-wide vegetation density at coarse resolution (0.1° ≈ 11 km cells). */
interface ProvincialVegetation {
  bbox: { minLat: number; maxLat: number; minLng: number; maxLng: number };
  step: number;
  maxCell: number;
  grid: Record<string, number>;
}

/** Province-wide outage estimates by FSA (non-Toronto). */
interface ProvincialOutages {
  maxCount: number;
  countsByFsa: Record<string, number>;
}

/** H3 hex grid covering Ontario. */
export interface HexGridIndex {
  resolution: number;
  count: number;
  hexes: Array<{
    h3Index: string;
    center: { lat: number; lng: number };
    boundary: [number, number][];
    region: string;
  }>;
}

/** Historical severe weather data per hex. */
export interface WeatherHistoryEntry {
  tornado_events: number;
  ice_storm_events: number;
  high_wind_events: number;
  severe_thunderstorm_events: number;
  derecho_exposure: boolean;
  composite: number;
}

export interface WeatherHistoryIndex {
  source: string;
  period: string;
  maxComposite: number;
  byHex: Record<string, WeatherHistoryEntry>;
}

interface DatasetBundle {
  outages: OutageIndex | null;
  canopy: CanopyGrid | null;
  floods: FloodIndex | null;
  provincialVegetation: ProvincialVegetation | null;
  provincialOutages: ProvincialOutages | null;
  hexGrid: HexGridIndex | null;
  weatherHistory: WeatherHistoryIndex | null;
}

const DERIVED = path.join(process.cwd(), "datasets", "derived");

let cached: Promise<DatasetBundle> | null = null;

async function readJson<T>(file: string): Promise<T | null> {
  try {
    const txt = await fs.readFile(file, "utf8");
    return JSON.parse(txt) as T;
  } catch {
    return null;
  }
}

export function loadDatasets(): Promise<DatasetBundle> {
  if (!cached) {
    cached = (async () => {
      const [outages, canopy, floods, provincialVegetation, provincialOutages, hexGrid, weatherHistory] = await Promise.all([
        readJson<OutageIndex>(path.join(DERIVED, "outage-history-by-fsa.json")),
        readJson<CanopyGrid>(path.join(DERIVED, "tree-canopy-grid.json")),
        readJson<FloodIndex>(path.join(DERIVED, "flood-footprints-ontario.geojson")),
        readJson<ProvincialVegetation>(path.join(DERIVED, "provincial-vegetation-density.json")),
        readJson<ProvincialOutages>(path.join(DERIVED, "provincial-outage-estimates.json")),
        readJson<HexGridIndex>(path.join(DERIVED, "ontario-hex-grid.json")),
        readJson<WeatherHistoryIndex>(path.join(DERIVED, "historical-severe-weather.json")),
      ]);
      return { outages, canopy, floods, provincialVegetation, provincialOutages, hexGrid, weatherHistory };
    })();
  }
  return cached;
}

export function lookupOutageCount(outages: OutageIndex | null, fsa?: string): number {
  if (!outages || !fsa) return 0;
  return outages.countsByFsa[fsa] ?? 0;
}

export function lookupCanopyDensity(canopy: CanopyGrid | null, lat: number, lng: number): {
  cellTrees: number;
  neighborhoodTrees: number;
  cellsSampled: number;
} {
  if (!canopy) return { cellTrees: 0, neighborhoodTrees: 0, cellsSampled: 0 };
  const { bbox, step, grid } = canopy;
  if (lat < bbox.minLat || lat > bbox.maxLat || lng < bbox.minLng || lng > bbox.maxLng) {
    return { cellTrees: 0, neighborhoodTrees: 0, cellsSampled: 0 };
  }
  const cy = Math.floor((lat - bbox.minLat) / step);
  const cx = Math.floor((lng - bbox.minLng) / step);
  let neighborhoodTrees = 0;
  let cellsSampled = 0;
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const key = `${cy + dy}_${cx + dx}`;
      const v = grid[key];
      if (v) neighborhoodTrees += v;
      cellsSampled++;
    }
  }
  const cellTrees = grid[`${cy}_${cx}`] ?? 0;
  return { cellTrees, neighborhoodTrees, cellsSampled };
}

/** Provincial-scale vegetation density lookup (coarse 0.1° grid, ~11 km cells). */
export function lookupProvincialVegetation(provincial: ProvincialVegetation | null, lat: number, lng: number): {
  cellDensity: number;
  neighborhoodDensity: number;
} {
  if (!provincial) return { cellDensity: 0, neighborhoodDensity: 0 };
  const { bbox, step, grid } = provincial;
  if (lat < bbox.minLat || lat > bbox.maxLat || lng < bbox.minLng || lng > bbox.maxLng) {
    return { cellDensity: 0, neighborhoodDensity: 0 };
  }
  const cy = Math.floor((lat - bbox.minLat) / step);
  const cx = Math.floor((lng - bbox.minLng) / step);
  let neighborhoodDensity = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const key = `${cy + dy}_${cx + dx}`;
      const v = grid[key];
      if (v) neighborhoodDensity += v;
    }
  }
  const cellDensity = grid[`${cy}_${cx}`] ?? 0;
  return { cellDensity, neighborhoodDensity };
}

/** Provincial outage estimate lookup for FSAs not covered by Toronto 311 data. */
export function lookupProvincialOutageCount(provincial: ProvincialOutages | null, fsa?: string): number {
  if (!provincial || !fsa) return 0;
  return provincial.countsByFsa[fsa] ?? 0;
}

/** Returns true if the given point falls within the Toronto-specific canopy grid bbox. */
export function isInsideTorontoGrid(canopy: CanopyGrid | null, lat: number, lng: number): boolean {
  if (!canopy) return false;
  const { bbox } = canopy;
  return lat >= bbox.minLat && lat <= bbox.maxLat && lng >= bbox.minLng && lng <= bbox.maxLng;
}

function pointInRing(lat: number, lng: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersect =
      yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function lookupFloodExposure(floods: FloodIndex | null, lat: number, lng: number): {
  insideFootprint: boolean;
  nearestKm: number;
  recentFeature?: FloodFeature;
} {
  if (!floods || !floods.features.length) {
    return { insideFootprint: false, nearestKm: Infinity };
  }
  let insideFootprint = false;
  let nearestKm = Infinity;
  let recentFeature: FloodFeature | undefined;

  for (const feat of floods.features) {
    const geom = feat.geometry;
    if (!geom) continue;
    const polygons: number[][][][] =
      geom.type === "Polygon"
        ? [geom.coordinates as number[][][]]
        : geom.type === "MultiPolygon"
          ? (geom.coordinates as number[][][][])
          : [];
    for (const poly of polygons) {
      const outer = poly[0];
      if (!outer) continue;
      if (pointInRing(lat, lng, outer)) {
        insideFootprint = true;
        recentFeature = feat;
      }
      let cx = 0;
      let cy = 0;
      for (const [px, py] of outer) {
        cx += px;
        cy += py;
      }
      cx /= outer.length;
      cy /= outer.length;
      const dLat = (lat - cy) * 111;
      const dLng = (lng - cx) * 111 * Math.cos((lat * Math.PI) / 180);
      const km = Math.sqrt(dLat * dLat + dLng * dLng);
      if (km < nearestKm) {
        nearestKm = km;
        if (!recentFeature) recentFeature = feat;
      }
    }
  }
  return { insideFootprint, nearestKm, recentFeature };
}

// ── Zone / Hex Grid helpers ──────────────────────────────────────────────

/** Look up the H3 hex index for a coordinate pair (resolution 4). */
export function getHexForCoords(lat: number, lng: number): string {
  return latLngToCell(lat, lng, 4);
}

/** Look up historical severe weather data for a given hex. */
export function lookupWeatherHistory(
  weatherHistory: WeatherHistoryIndex | null,
  hexIndex: string,
): WeatherHistoryEntry | null {
  if (!weatherHistory) return null;
  return weatherHistory.byHex[hexIndex] ?? null;
}

/** Return all hex zones with geometry for frontend rendering. */
export function getAllHexZones(hexGrid: HexGridIndex | null) {
  if (!hexGrid) return [];
  return hexGrid.hexes;
}
