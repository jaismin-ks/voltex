import { promises as fs } from "node:fs";
import { createReadStream } from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { parse } from "csv-parse/sync";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1")), "..");
const DATA = path.join(ROOT, "datasets");
const OUT = path.join(DATA, "derived");

// Toronto-bounded coarse grid for tree density:
//   0.005 deg ≈ ~400m. Tunable.
const GRID_STEP = 0.005;
const TORONTO_BBOX = { minLat: 43.55, maxLat: 43.86, minLng: -79.7, maxLng: -79.1 };

// Recent years only; older years are uninteresting for a demo
// and quadruple build time.
const SR_YEARS = ["2023", "2024", "2025", "2026"];

// SR types that proxy storm / outage stress.
const STORM_KEYWORDS = [
  "tree",
  "branch",
  "limb",
  "storm",
  "flood",
  "water main",
  "basement",
  "sewer",
  "catch basin",
  "hydro",
  "down",
  "power",
  "fallen",
  "pole",
  "wire",
];

function isStormRelated(srType) {
  if (!srType) return false;
  const t = srType.toLowerCase();
  return STORM_KEYWORDS.some((k) => t.includes(k));
}

async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

async function build311() {
  console.log("[311] aggregating storm-relevant SRs by FSA");
  const fsaCounts = {};
  const typeCounts = {};
  let totalRows = 0;
  let stormRows = 0;
  for (const year of SR_YEARS) {
    const file = path.join(
      DATA,
      "outages",
      "311-service-requests-customer-initiated",
      "csv",
      year,
      `SR${year}.csv`,
    );
    try {
      await fs.access(file);
    } catch {
      console.log(`[311]   skip ${year} (missing)`);
      continue;
    }
    console.log(`[311]   reading ${path.basename(file)}`);
    const stream = createReadStream(file, { encoding: "utf8" });
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
    let header = null;
    let idxFsa = -1;
    let idxType = -1;
    for await (const line of rl) {
      if (!header) {
        header = line.split(",").map((c) => c.replace(/^\s*"|"$/g, "").trim());
        idxFsa = header.indexOf("First 3 Chars of Postal Code");
        idxType = header.indexOf("Service Request Type");
        if (idxFsa < 0 || idxType < 0) {
          throw new Error(`Unexpected header in ${file}: ${header.join("|")}`);
        }
        continue;
      }
      totalRows++;
      // The dataset rows can contain commas in fields. Use csv-parse per row
      // only if quoting is detected. The columns we need are not quoted in
      // practice but we guard anyway.
      let row;
      if (line.includes('"')) {
        try {
          row = parse(line, { skip_empty_lines: true })[0];
        } catch {
          continue;
        }
      } else {
        row = line.split(",");
      }
      const fsa = (row[idxFsa] || "").trim();
      const type = (row[idxType] || "").trim();
      if (!fsa || !type) continue;
      if (!isStormRelated(type)) continue;
      stormRows++;
      fsaCounts[fsa] = (fsaCounts[fsa] || 0) + 1;
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    }
  }
  const counts = Object.values(fsaCounts);
  const maxCount = counts.length ? Math.max(...counts) : 0;
  const out = {
    source: "Toronto Open Data — 311 Service Requests (Customer Initiated)",
    years: SR_YEARS,
    storm_request_types: STORM_KEYWORDS,
    totalRows,
    stormRows,
    maxCount,
    countsByFsa: fsaCounts,
    topTypes: Object.entries(typeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20),
  };
  const outPath = path.join(OUT, "outage-history-by-fsa.json");
  await fs.writeFile(outPath, JSON.stringify(out));
  console.log(`[311] wrote ${outPath} (storm rows: ${stormRows}, FSAs: ${Object.keys(fsaCounts).length})`);
}

async function buildCanopyGrid() {
  console.log("[canopy] building density grid from street-tree GeoJSON");
  const file = path.join(DATA, "geo", "toronto-street-tree-data-4326.geojson");
  const grid = {};
  let trees = 0;

  // Stream the file, hold a small carry-over tail between chunks, and regex
  // out Point coordinates. This is ~100x faster than per-feature JSON.parse
  // because the property bag is irrelevant for canopy density.
  const stream = createReadStream(file, { encoding: "utf8", highWaterMark: 1 << 20 });
  // Trees are stored as MultiPoint with nested coordinates: [ [ lng, lat ] ].
  // Allow whitespace between brackets at any nesting depth.
  const re = /"coordinates":(?:\s*\[)+\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/g;
  let tail = "";
  let progressMark = 0;
  let bytes = 0;

  await new Promise((resolve, reject) => {
    stream.on("data", (chunk) => {
      bytes += Buffer.byteLength(chunk, "utf8");
      const buf = tail + chunk;
      re.lastIndex = 0;
      let match;
      let lastEnd = 0;
      while ((match = re.exec(buf)) !== null) {
        const lng = parseFloat(match[1]);
        const lat = parseFloat(match[2]);
        lastEnd = re.lastIndex;
        if (
          lat >= TORONTO_BBOX.minLat &&
          lat <= TORONTO_BBOX.maxLat &&
          lng >= TORONTO_BBOX.minLng &&
          lng <= TORONTO_BBOX.maxLng
        ) {
          const cy = Math.floor((lat - TORONTO_BBOX.minLat) / GRID_STEP);
          const cx = Math.floor((lng - TORONTO_BBOX.minLng) / GRID_STEP);
          const key = `${cy}_${cx}`;
          grid[key] = (grid[key] || 0) + 1;
          trees++;
        }
      }
      // Keep last 64 chars as carry-over to avoid splitting a match.
      tail = buf.slice(Math.max(lastEnd, buf.length - 64));
      if (bytes - progressMark > 50 * 1024 * 1024) {
        progressMark = bytes;
        console.log(
          `[canopy]   ${(bytes / (1024 * 1024)).toFixed(0)} MB streamed · ${trees} points indexed`,
        );
      }
    });
    stream.on("end", resolve);
    stream.on("error", reject);
  });

  const cellValues = Object.values(grid);
  const maxCell = cellValues.length ? Math.max(...cellValues) : 0;
  const out = {
    source: "Toronto Open Data — Street Tree Data (WGS84)",
    bbox: TORONTO_BBOX,
    step: GRID_STEP,
    maxCell,
    trees,
    grid,
  };
  const outPath = path.join(OUT, "tree-canopy-grid.json");
  await fs.writeFile(outPath, JSON.stringify(out));
  console.log(`[canopy] wrote ${outPath} (trees indexed: ${trees}, cells: ${cellValues.length}, max/cell: ${maxCell})`);
}

async function combineFlood() {
  console.log("[flood] combining NRCan Ontario footprints");
  const files = [
    "nrcan-floods-current-ontario-footprints.geojson",
    "nrcan-floods-archive-ontario-footprints.geojson",
  ];
  const features = [];
  for (const name of files) {
    const file = path.join(DATA, "geo", name);
    try {
      const txt = await fs.readFile(file, "utf8");
      const gj = JSON.parse(txt);
      if (gj && Array.isArray(gj.features)) features.push(...gj.features);
    } catch (e) {
      console.log(`[flood] skip ${name}: ${e.message}`);
    }
  }
  const out = { type: "FeatureCollection", features };
  const outPath = path.join(OUT, "flood-footprints-ontario.geojson");
  await fs.writeFile(outPath, JSON.stringify(out));
  console.log(`[flood] wrote ${outPath} (features: ${features.length})`);
}

async function main() {
  await ensureDir(OUT);
  await build311();
  await buildCanopyGrid();
  await combineFlood();

  // Zone-based hex grid and historical weather datasets
  const { buildHexGrid } = await import("./build-hex-grid.mjs");
  await buildHexGrid();
  const { buildWeatherHistory } = await import("./build-weather-history.mjs");
  await buildWeatherHistory();

  console.log("DONE");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
