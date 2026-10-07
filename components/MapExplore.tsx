"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ONTARIO_CITIES, ONTARIO_REGIONS, type OntarioCity } from "@/lib/cities";

export { ONTARIO_CITIES };
export type { OntarioCity };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LeafletMap = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LeafletMarker = any;

const REGIONS = ONTARIO_REGIONS;

interface MapExploreProps {
  onSelect: (cityName: string) => void;
  disabled?: boolean;
}

export default function MapExplore({ onSelect, disabled }: MapExploreProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [map, setMap] = useState<LeafletMap | null>(null);
  const markersRef = useRef<LeafletMarker[]>([]);
  const [hovered, setHovered] = useState<OntarioCity | null>(null);
  const [region, setRegion] = useState<OntarioCity["region"] | "All">("All");

  const visibleCities = useMemo(() => {
    if (region === "All") return ONTARIO_CITIES;
    return ONTARIO_CITIES.filter((c) => c.region === region);
  }, [region]);

  /* Create the map exactly once. */
  useEffect(() => {
    let cancelled = false;
    let createdMap: LeafletMap | null = null;
    (async () => {
      const L = await import("leaflet");
      if (cancelled || !containerRef.current) return;

      createdMap = L.map(containerRef.current, {
        zoomControl: false,
        attributionControl: false,
        scrollWheelZoom: false,
        dragging: true,
        doubleClickZoom: false,
        zoomSnap: 0.25,
        minZoom: 5,
        maxZoom: 9,
        maxBounds: [
          [41.0, -96.0],
          [57.5, -73.0],
        ],
        maxBoundsViscosity: 0.85,
      });

      /* Frame on the dense southern-Ontario corridor. Outliers (Sudbury,
       * Thunder Bay) remain reachable via the side list / panning. */
      createdMap.fitBounds(
        [
          [42.45, -83.4],
          [45.7, -74.8],
        ],
        { padding: [16, 16] },
      );

      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png", {
        maxZoom: 11,
        minZoom: 4,
        subdomains: "abcd",
      }).addTo(createdMap);

      setMap(createdMap);
    })();

    return () => {
      cancelled = true;
      if (createdMap) {
        createdMap.remove();
      }
    };
  }, []);

  /* Re-render pins whenever the map is ready or the filter changes. */
  useEffect(() => {
    if (!map) return;
    let cancelled = false;
    (async () => {
      const L = await import("leaflet");
      if (cancelled) return;

      for (const m of markersRef.current) m.remove();
      markersRef.current = [];

      for (const city of visibleCities) {
        const icon = L.divIcon({
          className: "gg-pin",
          html: `<span class="gg-pin-ring"></span><span class="gg-pin-dot"></span><span class="gg-pin-label">${city.label}</span>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });
        const marker = L.marker([city.lat, city.lng], { icon, keyboard: false });
        marker.on("click", () => {
          if (!disabled) onSelect(city.name);
        });
        marker.on("mouseover", () => setHovered(city));
        marker.on("mouseout", () => setHovered(null));
        marker.addTo(map);
        markersRef.current.push(marker);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [map, visibleCities, disabled, onSelect]);

  return (
    <section id="explore" className="w-full max-w-6xl">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">
            Explore Ontario
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--paper)] sm:text-3xl">
            Pick a city. Run the full pipeline instantly.
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--paper-dim)]/80">
            Pins are sized to population. Filter by region or hover a pin to see context
            before running an assessment.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {(["All", ...REGIONS] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRegion(r)}
              className={`gg-press rounded-full border px-3 py-1 text-xs uppercase tracking-[0.14em] transition-colors ${
                region === r
                  ? "border-[var(--signal-strong)] bg-[var(--signal-soft)] text-[var(--signal)]"
                  : "border-[var(--border)] bg-transparent text-[var(--paper-dim)] hover:border-[var(--border-strong)] hover:text-[var(--paper)]"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.5fr_0.5fr]">
        <div className="gg-card-strong relative overflow-hidden">
          <div ref={containerRef} className="h-[440px] w-full" />

          {/* Top legend overlay */}
          <div className="pointer-events-none absolute left-4 top-4 flex items-center gap-2 rounded-lg border border-[var(--border)] bg-black/55 px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-[var(--paper-dim)] backdrop-blur">
            <span
              aria-hidden
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ background: "var(--signal)", boxShadow: "0 0 10px var(--signal)" }}
            />
            {visibleCities.length} cities · click any pin
          </div>

          {/* Bottom gradient + attribution chip */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[var(--background)]/95 via-[var(--background)]/40 to-transparent" />
          <div className="pointer-events-none absolute bottom-3 right-3 font-mono text-[10px] tracking-[0.12em] text-[var(--muted)]">
            tiles · carto · openstreetmap
          </div>

          {hovered && (
            <div className="pointer-events-none absolute right-4 top-4 rounded-xl border border-[var(--border-strong)] bg-black/75 px-3 py-2 text-xs text-[var(--paper)] backdrop-blur">
              <span className="font-medium">{hovered.label}</span>
              <span className="ml-2 text-[var(--muted-strong)]">{hovered.region}</span>
              <span className="ml-2 font-mono text-[var(--muted)]">{hovered.population}</span>
            </div>
          )}
        </div>

        <div className="gg-card overflow-hidden">
          <div className="border-b border-[var(--border)] px-4 py-3 text-[10px] uppercase tracking-[0.22em] text-[var(--muted)]">
            {region === "All" ? "All regions" : region}
          </div>
          <ul className="max-h-[400px] overflow-y-auto">
            {visibleCities.map((city, i) => {
              const active = hovered?.name === city.name;
              return (
                <li key={city.name}>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onSelect(city.name)}
                    onMouseEnter={() => setHovered(city)}
                    onMouseLeave={() => setHovered(null)}
                    className={`gg-press group flex w-full items-center justify-between gap-3 border-b border-[var(--border)]/60 px-4 py-3 text-left text-sm transition-colors hover:bg-[var(--surface)] disabled:cursor-not-allowed disabled:opacity-50 ${
                      active ? "bg-[var(--surface-strong)]" : ""
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <span className="font-mono text-[10px] text-[var(--muted)]">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="text-[var(--paper)]">{city.label}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-[var(--muted)]">
                        {city.population}
                      </span>
                      <span
                        aria-hidden
                        className={`h-1.5 w-1.5 rounded-full transition-colors ${
                          active ? "bg-[var(--signal)]" : "bg-[var(--border-strong)]"
                        }`}
                        style={
                          active
                            ? { boxShadow: "0 0 10px var(--signal)" }
                            : undefined
                        }
                      />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
