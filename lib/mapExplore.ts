import type { OntarioRegion } from "./cities";
import { ONTARIO_CITIES } from "./cities";
import type { RiskTier } from "./types";

export interface MapBounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

export interface MapViewport {
  zoom: number;
  center: { lat: number; lng: number };
  bounds: MapBounds;
  moving: boolean;
}

const CITY_REGION = new Map(ONTARIO_CITIES.map((c) => [c.name, c.region]));

const REGION_LABEL: Record<OntarioRegion, string> = {
  GTA: "Greater Toronto",
  Eastern: "Eastern Ontario",
  Southwestern: "Southwestern Ontario",
  Central: "Central Ontario",
  Northern: "Northern Ontario",
};

export function regionLabel(region: OntarioRegion | "Mixed" | "Provincial"): string {
  if (region === "Mixed") return "Mixed regions";
  if (region === "Provincial") return "Provincial overview";
  return REGION_LABEL[region];
}

export function pinInBounds(lat: number, lng: number, bounds: MapBounds): boolean {
  return (
    lat >= bounds.south &&
    lat <= bounds.north &&
    lng >= bounds.west &&
    lng <= bounds.east
  );
}

export function dominantRegion(visibleCityNames: string[]): OntarioRegion | "Mixed" | null {
  if (visibleCityNames.length === 0) return null;

  const counts = new Map<OntarioRegion, number>();
  for (const name of visibleCityNames) {
    const r = CITY_REGION.get(name);
    if (r) counts.set(r, (counts.get(r) ?? 0) + 1);
  }
  if (counts.size === 0) return "Mixed";

  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (sorted.length > 1 && sorted[0][1] === sorted[1][1]) return "Mixed";
  return sorted[0][0];
}

export interface RiskPinSummary {
  label: string;
  risk_score: number;
  risk_tier: RiskTier;
}

export function highestRiskInView<T extends RiskPinSummary>(items: T[]): T | null {
  if (items.length === 0) return null;
  return items.reduce((best, item) => (item.risk_score > best.risk_score ? item : best));
}

export function tierCountsInView<T extends { risk_tier: RiskTier }>(
  items: T[],
): Record<RiskTier, number> {
  const counts: Record<RiskTier, number> = { High: 0, Medium: 0, Low: 0 };
  for (const item of items) counts[item.risk_tier] += 1;
  return counts;
}
