import { NextResponse } from "next/server";
import { handleApiCorsPreflight } from "@/lib/cors";
import { generateNarrative } from "@/lib/llm";
import type { RiskFactors, RiskTier } from "@/lib/types";
import type { WeatherHistoryEntry } from "@/lib/datasets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS(req: Request) {
  return handleApiCorsPreflight(req);
}

interface NarrativeBody {
  location?: string;
  risk_score?: number;
  risk_tier?: RiskTier;
  storm_context?: string;
  factors?: RiskFactors;
  zoneHistory?: WeatherHistoryEntry;
  neighboringZones?: Array<{ label: string; tier: string }>;
}

export async function POST(req: Request) {
  let body: NarrativeBody;
  try {
    body = (await req.json()) as NarrativeBody;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { location, risk_score, risk_tier, storm_context, factors, zoneHistory, neighboringZones } = body;
  if (!location || risk_score === undefined || !risk_tier || !storm_context || !factors) {
    return NextResponse.json(
      { error: "location, risk_score, risk_tier, storm_context, and factors are required" },
      { status: 400 },
    );
  }

  try {
    const narrative = await generateNarrative({
      location,
      risk_score,
      risk_tier,
      storm_context,
      factors,
      zoneHistory,
      neighboringZones,
    });
    return NextResponse.json({
      text: narrative.text,
      source: narrative.source,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "narrative generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
