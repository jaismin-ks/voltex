import { NextResponse } from "next/server";
import { handleApiCorsPreflight } from "@/lib/cors";
import { fetchWeather } from "@/lib/weather";
import { score } from "@/lib/scoring";
import type { BatchAssessResponse, SlimAssessResult } from "@/lib/types";

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

const BATCH_CONCURRENCY = 6;

interface CityInput {
  name: string;
  label?: string;
  lat: number;
  lng: number;
  fsa?: string;
}

interface BatchBody {
  cities?: CityInput[];
}

export async function POST(req: Request) {
  let body: BatchBody;
  try {
    body = (await req.json()) as BatchBody;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const cities = body.cities;
  if (!Array.isArray(cities) || cities.length === 0) {
    return NextResponse.json({ error: "cities array is required" }, { status: 400 });
  }

  const tasks = cities.map((city) => async (): Promise<SlimAssessResult> => {
    const coords = { lat: city.lat, lng: city.lng };
    const weather = await fetchWeather(coords);
    const scored = await score(coords, weather, city.fsa);
    return {
      name: city.name,
      label: city.label ?? city.name,
      coordinates: coords,
      risk_score: scored.risk_score,
      risk_tier: scored.risk_tier,
      factors: scored.factors,
      storm_context: scored.storm_context,
      weather,
      generated_at: new Date().toISOString(),
    };
  });

  const settled = await limitConcurrency(tasks, BATCH_CONCURRENCY);

  const results: SlimAssessResult[] = [];
  const errors: { name: string; message: string }[] = [];
  settled.forEach((r, i) => {
    if (r.status === "fulfilled") {
      results.push(r.value);
    } else {
      const message = r.reason instanceof Error ? r.reason.message : String(r.reason);
      errors.push({ name: cities[i].name, message });
    }
  });

  const response: BatchAssessResponse = {
    results,
    errors,
    generated_at: new Date().toISOString(),
  };
  return NextResponse.json(response);
}
