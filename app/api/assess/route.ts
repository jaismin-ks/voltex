import { NextResponse } from "next/server";
import { handleApiCorsPreflight } from "@/lib/cors";
import { geocode } from "@/lib/geocode";
import { fetchWeather } from "@/lib/weather";
import { score } from "@/lib/scoring";
import { generateNarrative } from "@/lib/llm";
import { getHexForCoords, loadDatasets, lookupWeatherHistory } from "@/lib/datasets";
import type { AssessResponse } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS(req: Request) {
  return handleApiCorsPreflight(req);
}

export async function POST(req: Request) {
  let body: { location?: string };
  try {
    body = (await req.json()) as { location?: string };
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const location = body.location?.trim();
  if (!location) {
    return NextResponse.json({ error: "location is required" }, { status: 400 });
  }

  try {
    const geo = await geocode(location);
    const weather = await fetchWeather(geo.coordinates);
    const scored = await score(geo.coordinates, weather, geo.fsa);

    // Look up zone context for this location
    const hexIndex = getHexForCoords(geo.coordinates.lat, geo.coordinates.lng);
    const { weatherHistory, hexGrid } = await loadDatasets();
    const wxHistory = lookupWeatherHistory(weatherHistory, hexIndex);
    const hexMeta = hexGrid?.hexes.find((h) => h.h3Index === hexIndex);

    const narrative = await generateNarrative({
      location: geo.displayName,
      risk_score: scored.risk_score,
      risk_tier: scored.risk_tier,
      storm_context: scored.storm_context,
      factors: scored.factors,
      zoneHistory: wxHistory ?? undefined,
    });

    const response: AssessResponse = {
      location: geo.displayName,
      coordinates: geo.coordinates,
      fsa: geo.fsa,
      risk_score: scored.risk_score,
      risk_tier: scored.risk_tier,
      factors: scored.factors,
      storm_context: scored.storm_context,
      llm_narrative: narrative.text,
      llm_source: narrative.source,
      weather,
      generated_at: new Date().toISOString(),
      zone: {
        h3Index: hexIndex,
        zone_risk_score: scored.risk_score,
        zone_risk_tier: scored.risk_tier,
        region: hexMeta?.region ?? "Unknown",
      },
    };
    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "assessment failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
