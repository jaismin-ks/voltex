import { promises as fs } from "node:fs";
import path from "node:path";
import h3 from "h3-js";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1")), "..");
const OUT = path.join(ROOT, "datasets", "derived");

const RESOLUTION = 4; // ~22 km hexes

/**
 * Coarse province ring in GeoJSON ordering ([lng, lat]).
 *
 * We intentionally use a single contiguous outline and then let H3 polyfill
 * decide membership, which avoids visible holes from coarse bbox sampling.
 */
const ONTARIO_RING_GEOJSON = [
  [-95.2, 49.0],
  [-94.7, 50.0],
  [-93.9, 51.1],
  [-93.0, 52.0],
  [-91.8, 53.0],
  [-90.4, 54.0],
  [-88.7, 55.0],
  [-86.6, 55.9],
  [-84.2, 56.4],
  [-82.0, 56.0],
  [-80.3, 55.1],
  [-79.4, 54.0],
  [-79.1, 52.6],
  [-79.3, 50.8],
  [-79.2, 49.1],
  [-78.6, 47.7],
  [-77.8, 46.8],
  [-76.8, 46.1],
  [-75.6, 45.4],
  [-74.6, 44.9],
  [-74.2, 44.1],
  [-74.4, 43.6],
  [-75.4, 43.2],
  [-76.8, 43.4],
  [-78.3, 43.5],
  [-79.6, 43.2],
  [-79.9, 42.6],
  [-81.4, 42.2],
  [-82.8, 42.0],
  [-83.3, 41.7],
  [-84.2, 41.8],
  [-85.0, 42.7],
  [-85.9, 44.0],
  [-87.2, 45.1],
  [-88.6, 46.1],
  [-90.0, 47.0],
  [-91.6, 47.8],
  [-93.1, 48.4],
  [-94.1, 48.8],
  [-95.2, 49.0],
];

/**
 * Assign an Ontario region based on lat/lng ranges.
 */
function assignRegion(lat, lng) {
  if (lat >= 43.4 && lat < 44.0 && lng >= -80.0 && lng <= -79.0) return "GTA";
  if (lat >= 44.0 && lat < 46.0 && lng >= -77.0 && lng <= -74.3) return "Eastern";
  if (lat >= 41.6 && lat < 44.0 && lng >= -84.0 && lng <= -79.0) return "Southwestern";
  if (lat >= 44.0 && lat < 46.0 && lng >= -80.5 && lng < -77.0) return "Central";
  return "Northern";
}

export async function buildHexGrid() {
  console.log("[hex-grid] generating H3 hex grid at resolution", RESOLUTION);
  const h3Indexes = h3.polygonToCells([ONTARIO_RING_GEOJSON], RESOLUTION, true);
  const hexes = h3Indexes
    .map((h3Index) => {
      const [cLat, cLng] = h3.cellToLatLng(h3Index);
      const boundary = h3.cellToBoundary(h3Index); // [[lat, lng], ...]
      const region = assignRegion(cLat, cLng);
      return {
        h3Index,
        center: { lat: cLat, lng: cLng },
        boundary,
        region,
      };
    })
    .sort((a, b) => a.h3Index.localeCompare(b.h3Index));

  const out = {
    resolution: RESOLUTION,
    count: hexes.length,
    hexes,
  };

  await fs.mkdir(OUT, { recursive: true });
  const outPath = path.join(OUT, "ontario-hex-grid.json");
  await fs.writeFile(outPath, JSON.stringify(out));
  console.log(`[hex-grid] wrote ${outPath} (${hexes.length} hexes)`);
  return out;
}

// Run standalone if executed directly
const isMain = process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1"));

if (isMain) {
  buildHexGrid().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
