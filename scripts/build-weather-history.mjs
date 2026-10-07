import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1")), "..");
const OUT = path.join(ROOT, "datasets", "derived");

// ── Known severe weather corridors / hotspots ──────────────────────────
// Each hotspot defines a center, influence radius (km), and the type of
// weather severity it contributes to.

const HOTSPOTS = [
  // Southwestern Ontario tornado alley (Windsor-London-Hamilton)
  { lat: 42.3, lng: -83.0, radiusKm: 80, type: "tornado", intensity: 1.0, label: "Windsor tornado corridor" },
  { lat: 42.98, lng: -81.25, radiusKm: 70, type: "tornado", intensity: 0.9, label: "London tornado corridor" },
  { lat: 43.25, lng: -79.87, radiusKm: 50, type: "tornado", intensity: 0.6, label: "Hamilton tornado corridor" },

  // GTA ice storm corridor
  { lat: 43.65, lng: -79.38, radiusKm: 60, type: "ice_storm", intensity: 1.0, label: "Toronto ice storm zone" },
  { lat: 43.9, lng: -78.9, radiusKm: 50, type: "ice_storm", intensity: 0.8, label: "Durham ice storm zone" },
  { lat: 43.55, lng: -79.66, radiusKm: 40, type: "ice_storm", intensity: 0.7, label: "Mississauga ice storm zone" },

  // Ottawa Valley derecho corridor (May 2022 derecho path)
  { lat: 45.42, lng: -75.69, radiusKm: 80, type: "derecho", intensity: 1.0, label: "Ottawa derecho corridor" },
  { lat: 44.9, lng: -76.5, radiusKm: 60, type: "derecho", intensity: 0.8, label: "Smiths Falls derecho corridor" },
  { lat: 45.3, lng: -74.8, radiusKm: 50, type: "derecho", intensity: 0.7, label: "Eastern Ontario derecho" },

  // Lake Huron / Georgian Bay wind belt
  { lat: 44.5, lng: -81.4, radiusKm: 70, type: "high_wind", intensity: 1.0, label: "Lake Huron wind belt" },
  { lat: 44.75, lng: -80.3, radiusKm: 60, type: "high_wind", intensity: 0.9, label: "Georgian Bay wind zone" },
  { lat: 44.3, lng: -81.7, radiusKm: 50, type: "high_wind", intensity: 0.8, label: "Goderich wind zone" },

  // Great Lakes lake-effect zones
  { lat: 42.9, lng: -79.2, radiusKm: 40, type: "high_wind", intensity: 0.7, label: "Niagara lake-effect" },
  { lat: 46.5, lng: -81.0, radiusKm: 60, type: "high_wind", intensity: 0.6, label: "Lake Superior wind zone" },

  // Northern Ontario severe thunderstorm zones
  { lat: 48.5, lng: -89.2, radiusKm: 100, type: "severe_thunderstorm", intensity: 1.0, label: "Thunder Bay storm zone" },
  { lat: 46.5, lng: -81.0, radiusKm: 80, type: "severe_thunderstorm", intensity: 0.9, label: "Sudbury storm zone" },
  { lat: 49.0, lng: -85.0, radiusKm: 100, type: "severe_thunderstorm", intensity: 0.7, label: "Northern interior storms" },
  { lat: 51.0, lng: -85.0, radiusKm: 120, type: "severe_thunderstorm", intensity: 0.6, label: "Far north storm zone" },

  // General regional severe thunderstorm background
  { lat: 43.5, lng: -80.5, radiusKm: 80, type: "severe_thunderstorm", intensity: 0.5, label: "SW Ontario storms" },
  { lat: 44.5, lng: -76.5, radiusKm: 70, type: "severe_thunderstorm", intensity: 0.5, label: "Eastern Ontario storms" },

  // Southwestern wind (Great Lakes fetch)
  { lat: 42.3, lng: -82.9, radiusKm: 60, type: "high_wind", intensity: 0.8, label: "Windsor wind zone" },
];

/**
 * Haversine distance in km between two lat/lng points.
 */
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Compute influence factor (0-1) from distance to hotspot.
 * Gaussian falloff centred at the hotspot.
 */
function influence(distKm, radiusKm) {
  if (distKm > radiusKm * 2) return 0;
  // sigma = radius so that at 1 radius the influence is ~0.61
  const sigma = radiusKm;
  return Math.exp(-0.5 * (distKm / sigma) ** 2);
}

/**
 * Deterministic pseudo-random based on h3 index string.
 * Returns a value in [0, 1).
 */
function pseudoRandom(h3Index, seed = 0) {
  let hash = seed;
  for (let i = 0; i < h3Index.length; i++) {
    hash = (hash * 31 + h3Index.charCodeAt(i)) & 0x7fffffff;
  }
  return (hash % 10000) / 10000;
}

/**
 * Convert a continuous influence score to a realistic integer event count.
 */
function toEventCount(influenceScore, maxEvents, h3Index, typeSeed) {
  const jitter = 0.7 + pseudoRandom(h3Index, typeSeed) * 0.6; // 0.7-1.3
  const raw = influenceScore * maxEvents * jitter;
  return Math.round(raw);
}

export async function buildWeatherHistory() {
  console.log("[weather-history] generating synthetic severe weather dataset");

  const gridPath = path.join(OUT, "ontario-hex-grid.json");
  const gridTxt = await fs.readFile(gridPath, "utf8");
  const grid = JSON.parse(gridTxt);

  const byHex = {};
  let maxComposite = 0;

  for (const hex of grid.hexes) {
    const { h3Index, center } = hex;
    const { lat, lng } = center;

    // Accumulate influence from each hotspot, grouped by type
    let tornadoInfluence = 0;
    let iceStormInfluence = 0;
    let highWindInfluence = 0;
    let severeThunderstormInfluence = 0;
    let derechoInfluence = 0;

    for (const hs of HOTSPOTS) {
      const dist = haversineKm(lat, lng, hs.lat, hs.lng);
      const inf = influence(dist, hs.radiusKm) * hs.intensity;
      switch (hs.type) {
        case "tornado":
          tornadoInfluence = Math.max(tornadoInfluence, inf);
          break;
        case "ice_storm":
          iceStormInfluence = Math.max(iceStormInfluence, inf);
          break;
        case "high_wind":
          highWindInfluence = Math.max(highWindInfluence, inf);
          break;
        case "severe_thunderstorm":
          severeThunderstormInfluence = Math.max(severeThunderstormInfluence, inf);
          break;
        case "derecho":
          derechoInfluence = Math.max(derechoInfluence, inf);
          break;
      }
    }

    // Add a small baseline everywhere (Ontario does get storms)
    severeThunderstormInfluence = Math.max(severeThunderstormInfluence, 0.05);
    highWindInfluence = Math.max(highWindInfluence, 0.03);

    // Convert to realistic 20-year event counts
    // Max tornado events in SW Ontario over 20 years: ~8
    const tornado_events = toEventCount(tornadoInfluence, 8, h3Index, 1);
    // Max ice storm events over 20 years: ~6
    const ice_storm_events = toEventCount(iceStormInfluence, 6, h3Index, 2);
    // Max high wind events over 20 years: ~20
    const high_wind_events = toEventCount(highWindInfluence, 20, h3Index, 3);
    // Max severe thunderstorm events over 20 years: ~15
    const severe_thunderstorm_events = toEventCount(severeThunderstormInfluence, 15, h3Index, 4);
    // Derecho exposure: boolean, significant if influence > 0.3
    const derecho_exposure = derechoInfluence > 0.3;

    // Composite severity score (0-1):
    // Weighted combination normalized against maximum plausible values
    const composite =
      (tornado_events / 8) * 0.30 +
      (ice_storm_events / 6) * 0.20 +
      (high_wind_events / 20) * 0.20 +
      (severe_thunderstorm_events / 15) * 0.15 +
      (derecho_exposure ? 1 : 0) * 0.15;

    const clampedComposite = Math.min(1, Math.round(composite * 100) / 100);

    if (clampedComposite > maxComposite) maxComposite = clampedComposite;

    byHex[h3Index] = {
      tornado_events,
      ice_storm_events,
      high_wind_events,
      severe_thunderstorm_events,
      derecho_exposure,
      composite: clampedComposite,
    };
  }

  maxComposite = Math.round(maxComposite * 100) / 100;

  const out = {
    source:
      "Synthetic estimates based on Environment Canada climate normals and historical storm patterns",
    period: "2004-2024 (20-year proxy)",
    maxComposite,
    byHex,
  };

  await fs.mkdir(OUT, { recursive: true });
  const outPath = path.join(OUT, "historical-severe-weather.json");
  await fs.writeFile(outPath, JSON.stringify(out));

  const hexCount = Object.keys(byHex).length;
  const derechoCount = Object.values(byHex).filter((v) => v.derecho_exposure).length;
  console.log(
    `[weather-history] wrote ${outPath} (${hexCount} hexes, maxComposite: ${maxComposite}, derecho-exposed: ${derechoCount})`,
  );
  return out;
}

// Run standalone if executed directly
const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.resolve(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1"));

if (isMain) {
  buildWeatherHistory().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
