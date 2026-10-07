export type OntarioRegion =
  | "GTA"
  | "Eastern"
  | "Southwestern"
  | "Central"
  | "Northern";

export interface OntarioCity {
  name: string;
  label: string;
  region: OntarioRegion;
  lat: number;
  lng: number;
  population: string;
}

/**
 * Monitored Ontario cities. These are scored on dashboard mount via the
 * /api/assess-batch endpoint. Coordinates come from public gazetteers;
 * populations are most-recent Statistics Canada CMA / municipal estimates,
 * rounded for chip display.
 */
export const ONTARIO_CITIES: OntarioCity[] = [
  // GTA
  { name: "Toronto, Ontario", label: "Toronto", region: "GTA", lat: 43.6532, lng: -79.3832, population: "2.93M" },
  { name: "Mississauga, Ontario", label: "Mississauga", region: "GTA", lat: 43.589, lng: -79.6441, population: "717k" },
  { name: "Brampton, Ontario", label: "Brampton", region: "GTA", lat: 43.7315, lng: -79.7624, population: "656k" },
  { name: "Vaughan, Ontario", label: "Vaughan", region: "GTA", lat: 43.8361, lng: -79.4983, population: "323k" },
  { name: "Scarborough, Toronto, Ontario", label: "Scarborough", region: "GTA", lat: 43.7731, lng: -79.2578, population: "632k" },
  { name: "Oshawa, Ontario", label: "Oshawa", region: "GTA", lat: 43.8971, lng: -78.8658, population: "175k" },
  { name: "Markham, Ontario", label: "Markham", region: "GTA", lat: 43.8561, lng: -79.337, population: "338k" },

  // Eastern
  { name: "Ottawa, Ontario", label: "Ottawa", region: "Eastern", lat: 45.4215, lng: -75.6972, population: "1.02M" },
  { name: "Kingston, Ontario", label: "Kingston", region: "Eastern", lat: 44.2312, lng: -76.486, population: "132k" },

  // Southwestern
  { name: "Hamilton, Ontario", label: "Hamilton", region: "Southwestern", lat: 43.2557, lng: -79.8711, population: "569k" },
  { name: "London, Ontario", label: "London", region: "Southwestern", lat: 42.9849, lng: -81.2453, population: "423k" },
  { name: "Kitchener, Ontario", label: "Kitchener", region: "Southwestern", lat: 43.4516, lng: -80.4925, population: "256k" },
  { name: "Guelph, Ontario", label: "Guelph", region: "Southwestern", lat: 43.5448, lng: -80.2482, population: "144k" },
  { name: "Windsor, Ontario", label: "Windsor", region: "Southwestern", lat: 42.3149, lng: -83.0364, population: "229k" },
  { name: "Niagara Falls, Ontario", label: "Niagara Falls", region: "Southwestern", lat: 43.0896, lng: -79.0849, population: "94k" },

  // Central
  { name: "Barrie, Ontario", label: "Barrie", region: "Central", lat: 44.3894, lng: -79.6903, population: "150k" },
  { name: "Peterborough, Ontario", label: "Peterborough", region: "Central", lat: 44.3091, lng: -78.3197, population: "84k" },

  // Northern (extended)
  { name: "Sudbury, Ontario", label: "Sudbury", region: "Northern", lat: 46.4917, lng: -80.993, population: "166k" },
  { name: "North Bay, Ontario", label: "North Bay", region: "Northern", lat: 46.3091, lng: -79.4608, population: "52k" },
  { name: "Sault Ste. Marie, Ontario", label: "Sault Ste. Marie", region: "Northern", lat: 46.5136, lng: -84.3358, population: "73k" },
  { name: "Thunder Bay, Ontario", label: "Thunder Bay", region: "Northern", lat: 48.3809, lng: -89.2477, population: "108k" },
  { name: "Timmins, Ontario", label: "Timmins", region: "Northern", lat: 48.4758, lng: -81.3304, population: "41k" },
  { name: "Kenora, Ontario", label: "Kenora", region: "Northern", lat: 49.7669, lng: -94.4889, population: "15k" },
  { name: "Moosonee, Ontario", label: "Moosonee", region: "Northern", lat: 51.275, lng: -80.6442, population: "3k" },
];

export const ONTARIO_REGIONS: OntarioRegion[] = [
  "GTA",
  "Eastern",
  "Southwestern",
  "Central",
  "Northern",
];
