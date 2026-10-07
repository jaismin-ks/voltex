import type { Coordinates, WeatherSnapshot } from "./types";
import { fetchWithTimeout } from "./fetchWithTimeout";

const ENDPOINT = "https://api.weather.gc.ca/collections/citypageweather-realtime/items";

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const CACHE_PRECISION = 1; // 1 decimal place ≈ 11 km grid

interface CacheEntry {
  data: WeatherSnapshot;
  expiry: number;
}

const weatherCache = new Map<string, CacheEntry>();

function cacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(CACHE_PRECISION)}_${lng.toFixed(CACHE_PRECISION)}`;
}

// Many leaf fields in the MSC GeoMet response are localized as { en, fr }.
type LocalizedString = { en?: string | number; fr?: string | number } | undefined;
type LocalizedNumber = { en?: number | string; fr?: number | string } | undefined;

interface MeasurementBlock {
  value?: LocalizedNumber;
  units?: LocalizedString;
}

interface WeatherProps {
  name?: LocalizedString;
  region?: LocalizedString;
  currentConditions?: {
    condition?: LocalizedString;
    temperature?: MeasurementBlock;
    wind?: {
      speed?: MeasurementBlock;
      gust?: MeasurementBlock;
    };
    station?: { value?: LocalizedString };
  };
  forecastGroup?: {
    forecast?: Array<{
      period?: LocalizedString;
      textSummary?: LocalizedString;
    }>;
  };
  warnings?: Array<{ event?: LocalizedString; type?: string }>;
}

interface CityPageFeature {
  properties?: WeatherProps;
  geometry?: { coordinates: [number, number] };
}

function localizedString(v: LocalizedString): string | undefined {
  if (!v) return undefined;
  const en = v.en;
  if (en === undefined || en === null || en === "") return undefined;
  return String(en);
}

function num(v: LocalizedNumber | undefined): number | undefined {
  if (!v) return undefined;
  const raw = v.en;
  if (raw === undefined || raw === null || raw === "") return undefined;
  const n = typeof raw === "number" ? raw : parseFloat(String(raw));
  return Number.isFinite(n) ? n : undefined;
}

export async function fetchWeather(coords: Coordinates): Promise<WeatherSnapshot> {
  const key = cacheKey(coords.lat, coords.lng);
  const cached = weatherCache.get(key);
  if (cached && cached.expiry > Date.now()) {
    return cached.data;
  }

  const half = 0.5;
  const bbox = [
    coords.lng - half,
    coords.lat - half,
    coords.lng + half,
    coords.lat + half,
  ].join(",");
  const url = new URL(ENDPOINT);
  url.searchParams.set("bbox", bbox);
  url.searchParams.set("f", "json");
  url.searchParams.set("limit", "10");

  const snapshot: WeatherSnapshot = {
    windSpeedKmh: 0,
    alerts: [],
    source: "Environment Canada (MSC GeoMet citypageweather)",
  };

  try {
    const res = await fetchWithTimeout(url, { cache: "no-store" }, 8_000);
    if (!res.ok) throw new Error(`Weather request failed (${res.status})`);
    const body = (await res.json()) as { features?: CityPageFeature[] };
    const features = body.features ?? [];
    if (!features.length) {
      weatherCache.set(key, { data: snapshot, expiry: Date.now() + CACHE_TTL_MS });
      return snapshot;
    }

    let nearest = features[0];
    let nearestDist = Infinity;
    for (const f of features) {
      const c = f.geometry?.coordinates;
      if (!c) continue;
      const [lng, lat] = c;
      const d = (lat - coords.lat) ** 2 + (lng - coords.lng) ** 2;
      if (d < nearestDist) {
        nearest = f;
        nearestDist = d;
      }
    }

    const props = nearest.properties ?? {};
    const cc = props.currentConditions ?? {};
    const wind = cc.wind ?? {};
    const forecasts = props.forecastGroup?.forecast ?? [];
    const stationName =
      localizedString(cc.station?.value) ??
      localizedString(props.name) ??
      localizedString(props.region);

    snapshot.stationName = stationName;
    snapshot.windSpeedKmh = num(wind.speed?.value) ?? 0;
    snapshot.windGustKmh = num(wind.gust?.value);
    snapshot.temperatureC = num(cc.temperature?.value);
    snapshot.conditions = localizedString(cc.condition);
    snapshot.forecastSummary = localizedString(forecasts[0]?.textSummary);
    snapshot.alerts = (props.warnings ?? [])
      .map((w) => localizedString(w.event) ?? w.type)
      .filter((s): s is string => Boolean(s));
  } catch (err) {
    snapshot.alerts.push(`weather unavailable: ${(err as Error).message}`);
  }

  weatherCache.set(key, { data: snapshot, expiry: Date.now() + CACHE_TTL_MS });
  return snapshot;
}
