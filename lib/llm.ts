import type { AssessResponse } from "./types";
import type { WeatherHistoryEntry } from "./datasets";
import { fetchWithTimeout } from "./fetchWithTimeout";

const ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

const SYSTEM_PROMPT = `You are a utility grid operations analyst writing an outage-risk situation report for an Ontario distribution utility control room.

Output a SITREP for the control-room supervisor. Use these four labeled blocks, in this exact order, each on its own line:

POSTURE: one sentence stating the risk tier and the single most important driver. Reference the location by name.
DRIVERS:
- bullet naming a top contributing factor with its numeric value (e.g., wind 48 km/h, canopy 1.2 trees/cell)
- bullet naming the second factor with its numeric value
- bullet naming the third factor with its numeric value (optional)
ACTIONS:
- concrete operational step appropriate to the tier (crews, feeders, alerts, monitoring)
- second concrete operational step
- third concrete operational step (optional)
WATCH: one sentence naming a specific threshold or change in the next 6 hours that would escalate or de-escalate posture.

Rules:
- Every bullet line MUST start with "- " (hyphen + space). No other bullet characters.
- Use plain text only. NEVER use markdown formatting (no **, no #, no backticks, no italics).
- The block labels POSTURE, DRIVERS, ACTIONS, WATCH must appear exactly as written, uppercase, followed by a colon.
- Each ACTION must be specific. Do NOT write filler like "continue monitoring" or "maintain posture" without a target — name the feeder type, the crew action, the alert audience, or the metric.
- If historical severe weather data is provided for the zone, reference it in DRIVERS or WATCH when relevant (e.g., "this zone has a history of ice storms" or "derecho corridor — maintain elevated watch").
- Total length under 180 words. No preamble. No closing remarks.`;

interface NarrativePayload {
  location: string;
  risk_score: number;
  risk_tier: AssessResponse["risk_tier"];
  storm_context: string;
  factors: AssessResponse["factors"];
  zoneHistory?: WeatherHistoryEntry;
  neighboringZones?: Array<{ label: string; tier: string }>;
}

export interface NarrativeResult {
  text: string;
  source: "gemini" | "local";
}

export async function generateNarrative(payload: NarrativePayload): Promise<NarrativeResult> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { text: localNarrative(payload), source: "local" };

  const promptData: Record<string, unknown> = {
    location: payload.location,
    risk_score: payload.risk_score,
    risk_tier: payload.risk_tier,
    storm_event: payload.storm_context,
    factors: {
      wind_speed: payload.factors.wind.detail,
      canopy: payload.factors.canopy.detail,
      flood: payload.factors.flood.detail,
      outage_history: payload.factors.history.detail,
      severe_weather_history: payload.factors.weatherHistory.detail,
    },
  };

  if (payload.zoneHistory) {
    promptData.zone_severe_weather_history = {
      tornado_events: payload.zoneHistory.tornado_events,
      ice_storm_events: payload.zoneHistory.ice_storm_events,
      high_wind_events: payload.zoneHistory.high_wind_events,
      severe_thunderstorm_events: payload.zoneHistory.severe_thunderstorm_events,
      derecho_corridor: payload.zoneHistory.derecho_exposure,
    };
  }

  if (payload.neighboringZones?.length) {
    promptData.neighboring_zones = payload.neighboringZones;
  }

  const userPrompt = JSON.stringify(promptData, null, 2);

  try {
    const res = await fetchWithTimeout(
      `${ENDPOINT}?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 800,
            // gemini-2.5-flash is a thinking model and counts reasoning tokens
            // against maxOutputTokens. Disabling the thinking budget keeps the
            // response from being truncated mid-sentence.
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      },
      12_000,
    );
    if (!res.ok) throw new Error(`Gemini ${res.status}`);
    const body = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ?? "";
    const trimmed = text.trim();
    if (!trimmed) return { text: localNarrative(payload), source: "local" };
    return { text: trimmed, source: "gemini" };
  } catch {
    return { text: localNarrative(payload), source: "local" };
  }
}

function localNarrative(payload: NarrativePayload): string {
  const { location, risk_tier, factors, storm_context } = payload;
  const drivers = [
    { name: "wind", c: factors.wind.contribution, detail: factors.wind.detail },
    { name: "canopy", c: factors.canopy.contribution, detail: factors.canopy.detail },
    { name: "flood exposure", c: factors.flood.contribution, detail: factors.flood.detail },
    { name: "outage history", c: factors.history.contribution, detail: factors.history.detail },
    { name: "severe weather history", c: factors.weatherHistory.contribution, detail: factors.weatherHistory.detail },
  ].sort((a, b) => b.c - a.c);

  const top = drivers.slice(0, 3);
  const actions =
    risk_tier === "High"
      ? "Pre-position repair crews near the affected feeders, issue proactive public alerts within the next 2 hours, and monitor substation load for early anomaly detection."
      : risk_tier === "Medium"
        ? "Place on-call crews on standby, brief dispatch on the storm context, and verify backup feeder readiness."
        : "Maintain normal posture, but keep a watch on the wind forecast and any active alerts.";

  const historyNote = factors.weatherHistory.contribution > 0.05
    ? ` This zone has elevated historical severe weather risk (${factors.weatherHistory.detail}).`
    : "";

  return [
    `${location} is currently rated ${risk_tier} Risk.`,
    `Top drivers: ${top.map((d) => `${d.name} (${d.detail})`).join("; ")}.`,
    `Storm context: ${storm_context}.`,
    actions,
    historyNote,
  ].filter(Boolean).join(" ");
}
