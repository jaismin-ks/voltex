import type { GeocodeResult } from "./types";
import { fetchWithTimeout } from "./fetchWithTimeout";

const NOMINATIM = "https://nominatim.openstreetmap.org/search";

export async function geocode(query: string): Promise<GeocodeResult> {
  const url = new URL(NOMINATIM);
  url.searchParams.set("q", `${query}, Ontario, Canada`);
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "ca");

  const res = await fetchWithTimeout(url, {
    headers: {
      "User-Agent": "Voltex/0.1 (demo; storm outage risk predictor)",
      "Accept-Language": "en",
    },
    cache: "no-store",
  }, 8_000);

  if (!res.ok) throw new Error(`Geocoding failed (${res.status})`);
  const body = (await res.json()) as Array<{
    lat: string;
    lon: string;
    display_name: string;
    address?: { postcode?: string };
  }>;
  if (!body.length) throw new Error(`No match for "${query}" in Ontario`);

  const hit = body[0];
  const postcode = hit.address?.postcode?.toUpperCase();
  const fsa = postcode ? postcode.replace(/\s+/g, "").slice(0, 3) : undefined;
  return {
    displayName: hit.display_name,
    coordinates: { lat: parseFloat(hit.lat), lng: parseFloat(hit.lon) },
    postcode,
    fsa,
  };
}
