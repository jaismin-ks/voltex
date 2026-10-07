import { NextResponse } from "next/server";
import { handleApiCorsPreflight, withCors } from "@/lib/cors";
import { fetchWeather } from "@/lib/weather";
import { scoreZone } from "@/lib/scoring";
import { loadDatasets, getAllHexZones } from "@/lib/datasets";
import type { WeatherSnapshot, ZoneBatchResponse, ZoneRiskResult } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS(req: Request) {
  return handleApiCorsPreflight(req);
}

function limitConcurrency<T>(tasks: (() => Promise<T>)[], concurrency: number): Promise<PromiseSettledResult<T>[]> {
  return new Promise((resolve) => {
    const results: PromiseSettledResult<T>[] = new Array(tasks.length);
    let next = 0;
    let completed = 0;

    function runNext() {
      if (next >= tasks.length) return;
      const idx = next++;
      tasks[idx]()
        .then((value) => {
          results[idx] = { status: "fulfilled", value };
        })
        .catch((reason) => {
          results[idx] = { status: "rejected", reason };
        })
        .finally(() => {
          completed++;
          if (completed === tasks.length) {
            resolve(results);
          } else {
            runNext();
          }
        });
    }

    const initial = Math.min(concurrency, tasks.length);
    for (let i = 0; i < initial; i++) runNext();
  });
}

const BATCH_CONCURRENCY = 24;

interface ZoneBody {
  region?: string;
}

/** One live weather sample per region — avoids hundreds of EC API calls per request. */
async function weatherByRegion(
  hexes: Array<{ region: string; center: { lat: number; lng: number } }>,
): Promise<Map<string, WeatherSnapshot>> {
  const cache = new Map<string, WeatherSnapshot>();
  const regions = [...new Set(hexes.map((h) => h.region))];
  await Promise.all(
    regions.map(async (region) => {
      const sample = hexes.find((h) => h.region === region);
      if (!sample) return;
      try {
        const weather = await fetchWeather(sample.center);
        cache.set(region, weather);
      } catch {
        cache.set(region, {
          windSpeedKmh: 20,
          windGustKmh: 30,
          alerts: [],
          source: "fallback",
        });
      }
    }),
  );
  return cache;
}

export async function POST(req: Request) {
  let body: ZoneBody;
  try {
    body = (await req.json()) as ZoneBody;
  } catch {
    body = {};
  }

  const { hexGrid } = await loadDatasets();
  let hexes = getAllHexZones(hexGrid);

  if (body.region) {
    hexes = hexes.filter((h) => h.region === body.region);
  }

  if (hexes.length === 0) {
    return withCors(
      req,
      NextResponse.json(
        {
          error:
            "H3 hex grid unavailable. Run npm run build:deploy-data before deploy or commit datasets/derived/*.json.",
          zones: [],
          summary: { high_count: 0, medium_count: 0, low_count: 0, peak_zone: "", peak_score: 0 },
          generated_at: new Date().toISOString(),
        },
        { status: 503 },
      ),
    );
  }

  const regionWeather = await weatherByRegion(hexes);

  const tasks = hexes.map((hex) => async (): Promise<ZoneRiskResult> => {
    const center = { lat: hex.center.lat, lng: hex.center.lng };
    const weather =
      regionWeather.get(hex.region) ?? {
        windSpeedKmh: 20,
        windGustKmh: 30,
        alerts: [],
        source: "fallback",
      };
    const scored = await scoreZone(hex.h3Index, center, weather);
    return {
      h3Index: hex.h3Index,
      center,
      boundary: hex.boundary,
      risk_score: scored.risk_score,
      risk_tier: scored.risk_tier,
      factors: scored.factors,
      storm_context: scored.storm_context,
      region: hex.region,
      zone_label: `Zone ${hex.h3Index.slice(-6).toUpperCase()} · ${hex.region}`,
    };
  });

  const settled = await limitConcurrency(tasks, BATCH_CONCURRENCY);

  const zones: ZoneRiskResult[] = [];
  for (const r of settled) {
    if (r.status === "fulfilled") {
      zones.push(r.value);
    }
  }

  let peakZone = "";
  let peakScore = 0;
  let high = 0;
  let medium = 0;
  let low = 0;
  for (const z of zones) {
    if (z.risk_score > peakScore) {
      peakScore = z.risk_score;
      peakZone = z.zone_label;
    }
    if (z.risk_tier === "High") high++;
    else if (z.risk_tier === "Medium") medium++;
    else low++;
  }

  const response: ZoneBatchResponse = {
    zones,
    summary: {
      high_count: high,
      medium_count: medium,
      low_count: low,
      peak_zone: peakZone,
      peak_score: peakScore,
    },
    generated_at: new Date().toISOString(),
  };
  return withCors(req, NextResponse.json(response));
}
