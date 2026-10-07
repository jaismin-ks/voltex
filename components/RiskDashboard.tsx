"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ONTARIO_CITIES } from "@/lib/cities";
import {
  dominantRegion,
  highestRiskInView,
  pinInBounds,
  regionLabel,
  tierCountsInView,
  type MapViewport,
} from "@/lib/mapExplore";
import { apiUrl } from "@/lib/api";
import type {
  AssessResponse,
  BatchAssessResponse,
  RiskTier,
  SlimAssessResult,
  ZoneRiskResult,
  ZoneBatchResponse,
} from "@/lib/types";
import { RiskGauge } from "./RiskGauge";
import { FactorBreakdown } from "./FactorBreakdown";
import { BriefingReport } from "./BriefingReport";
import { ZoneLayer } from "./ZoneLayer";
import { ZoneLegend } from "./ZoneLegend";
import { ZoneDetailPanel } from "./ZoneDetailPanel";

interface BriefingEntry {
  text: string;
  source: "gemini" | "local";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LeafletMap = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LeafletMarker = any;

interface PinEntry {
  key: string;
  label: string;
  /** Either a monitored city result or a custom search assessment. */
  result: SlimAssessResult;
  custom?: boolean;
}

function tileUrlForTheme(theme: string | null | undefined): string {
  const tile = theme === "light" ? "light_nolabels" : "dark_nolabels";
  return `https://{s}.basemaps.cartocdn.com/${tile}/{z}/{x}/{y}{r}.png`;
}

const TIER_CLASS: Record<RiskTier, string> = {
  High: "gg-risk-pin-high",
  Medium: "gg-risk-pin-medium",
  Low: "gg-risk-pin-low",
};

const TIER_LABEL_COLOR: Record<RiskTier, string> = {
  High: "gg-tier-high",
  Medium: "gg-tier-medium",
  Low: "gg-tier-low",
};

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function RiskDashboard() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [map, setMap] = useState<LeafletMap | null>(null);
  const markersRef = useRef<Map<string, LeafletMarker>>(new Map());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tileLayerRef = useRef<any>(null);

  const [pins, setPins] = useState<PinEntry[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [batchLoading, setBatchLoading] = useState(true);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const [searchValue, setSearchValue] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [briefings, setBriefings] = useState<Record<string, BriefingEntry>>({});
  const [briefingLoading, setBriefingLoading] = useState<string | null>(null);
  const [briefingError, setBriefingError] = useState<Record<string, string>>({});

  const [viewport, setViewport] = useState<MapViewport | null>(null);

  // Zone state
  const [zoneResults, setZoneResults] = useState<ZoneRiskResult[]>([]);
  const [selectedZone, setSelectedZone] = useState<ZoneRiskResult | null>(null);
  const [zoneBriefing, setZoneBriefing] = useState<{ text: string; source: string } | null>(null);
  const [zoneBriefingLoading, setZoneBriefingLoading] = useState(false);
  const [layerMode, setLayerMode] = useState<'both' | 'zones' | 'cities'>('both');
  const [zonesLoading, setZonesLoading] = useState(true);
  const [zonesError, setZonesError] = useState<string | null>(null);

  const selected = useMemo(
    () => pins.find((p) => p.key === selectedKey) ?? null,
    [pins, selectedKey],
  );

  const tierCounts = useMemo(() => {
    const counts: Record<RiskTier, number> = { High: 0, Medium: 0, Low: 0 };
    for (const p of pins) counts[p.result.risk_tier] += 1;
    return counts;
  }, [pins]);

  const explore = useMemo(() => {
    if (!viewport || pins.length === 0) return null;

    const visiblePins = pins.filter((p) =>
      pinInBounds(
        p.result.coordinates.lat,
        p.result.coordinates.lng,
        viewport.bounds,
      ),
    );
    const visibleResults = visiblePins.map((p) => p.result);
    const visibleCityNames = visiblePins.filter((p) => !p.custom).map((p) => p.result.name);
    const allVisible = visiblePins.length === pins.length;
    const region = allVisible
      ? ("Provincial" as const)
      : dominantRegion(visibleCityNames);

    return {
      visibleCount: visiblePins.length,
      totalCount: pins.length,
      region,
      regionText: region ? regionLabel(region) : "Off map",
      peak: highestRiskInView(visibleResults),
      counts: tierCountsInView(visibleResults),
      allVisible,
    };
  }, [viewport, pins]);

  const legendCounts = explore && !explore.allVisible ? explore.counts : tierCounts;
  const legendScope = explore && !explore.allVisible ? "in view" : "province";

  /* ---------------------------------------------------------- batch load */
  const runBatch = useCallback(async () => {
    setBatchLoading(true);
    setBatchError(null);
    try {
      const res = await fetch(apiUrl("/api/assess-batch"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cities: ONTARIO_CITIES.map((c) => ({
            name: c.name,
            label: c.label,
            lat: c.lat,
            lng: c.lng,
          })),
        }),
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(b.error ?? `Request failed (${res.status})`);
      }
      const body = (await res.json()) as BatchAssessResponse;

      // Preserve any custom (searched) pins, replace city pins.
      setPins((prev) => {
        const customs = prev.filter((p) => p.custom);
        const cityPins: PinEntry[] = body.results.map((r) => ({
          key: r.name,
          label: r.label,
          result: r,
        }));
        return [...cityPins, ...customs];
      });
      setLastUpdated(body.generated_at);
    } catch (err) {
      setBatchError(err instanceof Error ? err.message : "Failed to load risk board");
    } finally {
      setBatchLoading(false);
    }
  }, []);

  /* ---------------------------------------------------------- zone load */
  const loadZones = useCallback(async () => {
    setZonesLoading(true);
    setZonesError(null);
    try {
      const res = await fetch(apiUrl("/api/assess-zones"), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(b.error ?? `Zone request failed (${res.status})`);
      }
      const data = (await res.json()) as ZoneBatchResponse & { error?: string };
      if (!data.zones?.length) {
        throw new Error(data.error ?? "No H3 zones returned from API");
      }
      setZoneResults(data.zones);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Zone load failed";
      setZonesError(message);
      console.error("Zone load failed:", e);
    } finally {
      setZonesLoading(false);
    }
  }, []);

  useEffect(() => {
    // Mount-only initial load; runBatch sets internal loading state but is
    // the entire purpose of this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void runBatch();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadZones();
  }, [runBatch, loadZones]);

  /* ---------------------------------------------------------- zone click */
  const handleZoneClick = useCallback((zone: ZoneRiskResult) => {
    setSelectedZone(zone);
    setSelectedKey(null);
    setZoneBriefing(null);
  }, []);

  const getCitiesInZone = useCallback((zone: ZoneRiskResult): SlimAssessResult[] => {
    return pins
      .map((p) => p.result)
      .filter((r) => {
        const dLat = (r.coordinates.lat - zone.center.lat) * 111;
        const dLng = (r.coordinates.lng - zone.center.lng) * 111 * Math.cos((zone.center.lat * Math.PI) / 180);
        return Math.sqrt(dLat * dLat + dLng * dLng) < 15;
      });
  }, [pins]);

  const requestZoneBriefing = useCallback(async () => {
    if (!selectedZone || zoneBriefingLoading) return;
    setZoneBriefingLoading(true);
    try {
      const res = await fetch(apiUrl("/api/narrative"), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: selectedZone.zone_label,
          risk_score: selectedZone.risk_score,
          risk_tier: selectedZone.risk_tier,
          storm_context: selectedZone.storm_context,
          factors: selectedZone.factors,
        }),
      });
      if (!res.ok) throw new Error(`Briefing failed (${res.status})`);
      const data = (await res.json()) as { text: string; source: string };
      setZoneBriefing(data);
    } catch (e) {
      console.error('Zone briefing failed:', e);
    } finally {
      setZoneBriefingLoading(false);
    }
  }, [selectedZone, zoneBriefingLoading]);

  /* ---------------------------------------------------------- create map */
  useEffect(() => {
    let cancelled = false;
    let createdMap: LeafletMap | null = null;
    (async () => {
      const L = await import("leaflet");
      if (cancelled || !containerRef.current) return;

      createdMap = L.map(containerRef.current, {
        zoomControl: true,
        attributionControl: false,
        scrollWheelZoom: true,
        dragging: true,
        doubleClickZoom: true,
        zoomSnap: 0.25,
        minZoom: 5,
        maxZoom: 11,
        maxBounds: [
          [40.5, -97.0],
          [58.0, -72.5],
        ],
        maxBoundsViscosity: 0.85,
      });

      createdMap.fitBounds(
        [
          [42.0, -84.0],
          [46.5, -74.5],
        ],
        { padding: [20, 20] },
      );

      const initialTheme = document.documentElement.getAttribute("data-theme");
      const layer = L.tileLayer(tileUrlForTheme(initialTheme), {
        maxZoom: 12,
        minZoom: 4,
        subdomains: "abcd",
      }).addTo(createdMap);
      tileLayerRef.current = layer;

      createdMap.zoomControl.setPosition("topright");

      setMap(createdMap);
    })();

    return () => {
      cancelled = true;
      if (createdMap) {
        createdMap.remove();
      }
      tileLayerRef.current = null;
    };
  }, []);

  /* ------------------------------------------------ theme-reactive tiles */
  useEffect(() => {
    if (!map) return;
    let active = true;

    const swap = async (theme: string | null | undefined) => {
      const L = await import("leaflet");
      if (!active) return;
      if (tileLayerRef.current) {
        map.removeLayer(tileLayerRef.current);
      }
      const layer = L.tileLayer(tileUrlForTheme(theme), {
        maxZoom: 12,
        minZoom: 4,
        subdomains: "abcd",
      }).addTo(map);
      tileLayerRef.current = layer;
    };

    const onChange = (event: Event) => {
      const theme = (event as CustomEvent<string>).detail;
      void swap(theme);
    };

    window.addEventListener("vx-theme-change", onChange);
    return () => {
      active = false;
      window.removeEventListener("vx-theme-change", onChange);
    };
  }, [map]);

  /* ------------------------------------------- sync viewport on explore */
  useEffect(() => {
    if (!map) return;

    const sync = () => {
      const bounds = map.getBounds();
      const center = map.getCenter();
      setViewport({
        zoom: map.getZoom(),
        center: { lat: center.lat, lng: center.lng },
        bounds: {
          south: bounds.getSouth(),
          west: bounds.getWest(),
          north: bounds.getNorth(),
          east: bounds.getEast(),
        },
        moving: false,
      });
    };

    const onStart = () => {
      setViewport((prev) => (prev ? { ...prev, moving: true } : prev));
    };

    map.on("movestart", onStart);
    map.on("zoomstart", onStart);
    map.on("moveend", sync);
    map.on("zoomend", sync);
    sync();

    return () => {
      map.off("movestart", onStart);
      map.off("zoomstart", onStart);
      map.off("moveend", sync);
      map.off("zoomend", sync);
    };
  }, [map]);

  /* ---------------------------------------------------------- render pins */
  useEffect(() => {
    if (!map) return;
    let cancelled = false;
    (async () => {
      const L = await import("leaflet");
      if (cancelled) return;

      const existing = markersRef.current;
      const nextKeys = new Set(pins.map((p) => p.key));

      // Remove markers no longer in pins.
      for (const [key, marker] of existing) {
        if (!nextKeys.has(key)) {
          marker.remove();
          existing.delete(key);
        }
      }

      for (const pin of pins) {
        const tierClass = pin.custom ? "gg-risk-pin-custom" : TIER_CLASS[pin.result.risk_tier];
        const inView = viewport
          ? pinInBounds(
              pin.result.coordinates.lat,
              pin.result.coordinates.lng,
              viewport.bounds,
            )
          : true;
        const isActive = pin.key === selectedKey;
        const isDimmed = viewport && !inView && !isActive;
        const stateClass = `${isActive ? " is-active" : ""}${isDimmed ? " is-dimmed" : ""}`;
        const html = `<span class="gg-risk-ring"></span><span class="gg-risk-dot"></span><span class="gg-risk-label">${pin.label}</span>`;
        const icon = L.divIcon({
          className: `gg-risk-pin ${tierClass}${stateClass}`,
          html,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        });

        const zIndex = isActive ? 500 : 0;

        const current = existing.get(pin.key);
        if (current) {
          current.setIcon(icon);
          current.setLatLng([pin.result.coordinates.lat, pin.result.coordinates.lng]);
          current.setZIndexOffset(zIndex);
        } else {
          const marker = L.marker(
            [pin.result.coordinates.lat, pin.result.coordinates.lng],
            { icon, keyboard: false, zIndexOffset: zIndex },
          );
          marker.on("click", () => {
            setSelectedKey(pin.key);
          });
          marker.addTo(map);
          existing.set(pin.key, marker);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [map, pins, selectedKey, viewport]);

  /* ---------------------------------------------------------- search */
  const handleSearchSubmit = useCallback(
    async (raw: string) => {
      const location = raw.trim();
      if (!location || searchLoading) return;
      setSearchLoading(true);
      setSearchError(null);
      try {
        const res = await fetch(apiUrl("/api/assess"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ location }),
        });
        if (!res.ok) {
          const b = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(b.error ?? `Request failed (${res.status})`);
        }
        const data = (await res.json()) as AssessResponse;
        const key = `custom:${data.location}`;
        const slim: SlimAssessResult = {
          name: data.location,
          label: data.location.split(",")[0],
          coordinates: data.coordinates,
          risk_score: data.risk_score,
          risk_tier: data.risk_tier,
          factors: data.factors,
          storm_context: data.storm_context,
          weather: data.weather,
          generated_at: data.generated_at,
        };
        setPins((prev) => {
          const others = prev.filter((p) => p.key !== key);
          return [
            ...others,
            { key, label: slim.label, result: slim, custom: true },
          ];
        });
        if (data.llm_narrative) {
          setBriefings((prev) => ({
            ...prev,
            [key]: { text: data.llm_narrative, source: data.llm_source ?? "gemini" },
          }));
        }
        setSelectedKey(key);
        setSearchValue("");
        // Pan/zoom to the new pin.
        if (map) {
          map.flyTo([data.coordinates.lat, data.coordinates.lng], 8, {
            duration: 0.6,
          });
        }
      } catch (err) {
        setSearchError(err instanceof Error ? err.message : "Search failed");
      } finally {
        setSearchLoading(false);
      }
    },
    [map, searchLoading],
  );

  /* ---------------------------------------------------------- briefing */
  const fetchBriefing = useCallback(
    async (pin: PinEntry) => {
      if (briefings[pin.key] || briefingLoading === pin.key) return;
      setBriefingLoading(pin.key);
      setBriefingError((prev) => {
        if (!(pin.key in prev)) return prev;
        const next = { ...prev };
        delete next[pin.key];
        return next;
      });
      try {
        // Use the dedicated /api/narrative endpoint which only generates
        // the LLM briefing from already-scored data, avoiding redundant
        // geocoding, weather fetching, and re-scoring.
        const res = await fetch(apiUrl("/api/narrative"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location: pin.result.name,
            risk_score: pin.result.risk_score,
            risk_tier: pin.result.risk_tier,
            storm_context: pin.result.storm_context,
            factors: pin.result.factors,
          }),
        });
        if (!res.ok) {
          const b = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(b.error ?? `Request failed (${res.status})`);
        }
        const data = (await res.json()) as { text: string; source: "gemini" | "local" };
        setBriefings((prev) => ({
          ...prev,
          [pin.key]: { text: data.text, source: data.source },
        }));
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Briefing failed";
        setBriefingError((prev) => ({ ...prev, [pin.key]: msg }));
      } finally {
        setBriefingLoading(null);
      }
    },
    [briefings, briefingLoading],
  );

  /* ---------- auto-fire briefing whenever a pin is selected ------------ */
  useEffect(() => {
    if (!selectedKey) return;
    const pin = pins.find((p) => p.key === selectedKey);
    if (!pin) return;
    if (briefings[selectedKey] || briefingLoading === selectedKey) return;
    void fetchBriefing(pin);
  }, [selectedKey, pins, briefings, briefingLoading, fetchBriefing]);

  /* ---------------------------------------------------------- render */
  const mapActive = viewport?.moving ?? false;

  return (
    <div
      className={`relative h-full w-full overflow-hidden bg-[var(--background)]${mapActive ? " gg-map-active" : ""}`}
    >
      {/* Map layer */}
      <div ref={containerRef} className="gg-map-canvas absolute inset-0 z-0" />
      <div aria-hidden className="gg-map-vignette absolute inset-0 z-[5]" />

      {/* Zone choropleth layer */}
      <ZoneLayer
        map={map}
        zones={zoneResults}
        selectedZone={selectedZone?.h3Index ?? null}
        onZoneClick={handleZoneClick}
        visible={layerMode === 'both' || layerMode === 'zones'}
      />
      <ZoneLegend visible={(layerMode === 'both' || layerMode === 'zones') && zoneResults.length > 0} />

      {/* Layer mode toggle */}
      <div className="pointer-events-auto absolute left-4 top-[72px] z-20 gg-layer-toggle">
        {(['zones', 'both', 'cities'] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setLayerMode(mode)}
            className={layerMode === mode ? 'active' : ''}
          >
            {mode === 'both' ? 'Both' : mode === 'zones' ? 'Zones' : 'Cities'}
          </button>
        ))}
      </div>

      {/* Explore HUD — reacts to pan/zoom */}
      {explore && viewport && (
        <ExploreHud explore={explore} viewport={viewport} moving={mapActive} />
      )}

      {/* Top legend — switches to in-view counts when zoomed in */}
      <div
        key={legendScope}
        className="pointer-events-none absolute left-4 top-4 z-20 flex flex-col gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--overlay)] px-3 py-2 backdrop-blur gg-explore-hud"
      >
        <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.18em] text-[var(--paper-dim)]">
          <LegendChip color="var(--risk-high)" label={`${legendCounts.High} high`} />
          <span className="text-[var(--border-strong)]">·</span>
          <LegendChip color="var(--risk-medium)" label={`${legendCounts.Medium} medium`} />
          <span className="text-[var(--border-strong)]">·</span>
          <LegendChip color="var(--risk-low)" label={`${legendCounts.Low} low`} />
        </div>
        {explore && !explore.allVisible && (
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">
            {legendScope} · {explore.visibleCount}/{explore.totalCount} cities
          </span>
        )}
      </div>

      {/* Batch loading overlay */}
      {batchLoading && pins.length === 0 && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <div className="rounded-2xl border border-[var(--border-strong)] bg-[var(--overlay)] px-5 py-4 backdrop-blur">
            <div className="flex items-center gap-3">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-[var(--signal)] border-t-transparent" />
              <span className="text-sm text-[var(--paper)]">
                Scoring {ONTARIO_CITIES.length} Ontario cities…
              </span>
            </div>
            <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">
              live weather · canopy · flood · 311 history · severe weather zones
            </p>
          </div>
        </div>
      )}

      {batchError && (
        <div className="absolute left-1/2 top-20 z-20 -translate-x-1/2 rounded-xl border border-[var(--risk-high)]/40 bg-[var(--overlay-strong)] px-4 py-2 text-sm text-[var(--risk-high)] backdrop-blur">
          {batchError}
          <button
            type="button"
            onClick={runBatch}
            className="ml-3 underline-offset-2 hover:underline"
          >
            retry
          </button>
        </div>
      )}

      {zonesError && (
        <div className="absolute left-1/2 top-32 z-20 max-w-md -translate-x-1/2 rounded-xl border border-[var(--risk-high)]/40 bg-[var(--overlay-strong)] px-4 py-2 text-sm text-[var(--risk-high)] backdrop-blur">
          {zonesError}
          <button
            type="button"
            onClick={() => void loadZones()}
            className="ml-3 underline-offset-2 hover:underline"
          >
            retry
          </button>
        </div>
      )}

      {/* Detail panel (pin or zone) */}
      {selectedZone && (
        <ZoneDetailPanel
          zone={selectedZone}
          citiesInZone={getCitiesInZone(selectedZone)}
          onClose={() => setSelectedZone(null)}
          onRequestBriefing={requestZoneBriefing}
          briefing={zoneBriefing}
          briefingLoading={zoneBriefingLoading}
        />
      )}
      {selected && !selectedZone && (
        <DetailPanel
          pin={selected}
          briefing={briefings[selected.key]}
          briefingLoading={briefingLoading === selected.key}
          briefingError={briefingError[selected.key]}
          onClose={() => setSelectedKey(null)}
          onRetryBriefing={() => fetchBriefing(selected)}
        />
      )}

      {/* Bottom bar */}
      <BottomBar
        onSubmit={handleSearchSubmit}
        value={searchValue}
        onChange={setSearchValue}
        loading={searchLoading}
        error={searchError}
        counts={tierCounts}
        lastUpdated={lastUpdated}
        refreshing={batchLoading || zonesLoading}
        onRefresh={() => { void runBatch(); void loadZones(); }}
        attribution="Carto · OpenStreetMap"
      />
    </div>
  );
}

/* --------------------------------------------------- subcomponents */

interface ExploreHudProps {
  explore: {
    visibleCount: number;
    totalCount: number;
    regionText: string;
    peak: { label: string; risk_tier: RiskTier; risk_score: number } | null;
    allVisible: boolean;
  };
  viewport: MapViewport;
  moving: boolean;
}

function ExploreHud({ explore, viewport, moving }: ExploreHudProps) {
  return (
    <div
      className="pointer-events-none absolute right-16 top-4 z-20 w-[min(100%,240px)] gg-explore-hud"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="rounded-xl border border-[var(--border)] bg-[var(--overlay)] px-3 py-2.5 backdrop-blur">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--muted)]">
            {moving ? "Scanning…" : "Viewing"}
          </span>
          <span className="font-mono text-[10px] tabular-nums text-[var(--paper-dim)]">
            z{viewport.zoom.toFixed(1)}
          </span>
        </div>
        <p className="gg-explore-stat mt-1 text-sm font-medium text-[var(--paper)]">
          {explore.regionText}
        </p>
        <div className="gg-explore-stat mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] uppercase tracking-[0.16em] text-[var(--paper-dim)]">
          <span>
            {explore.visibleCount}/{explore.totalCount} monitored
          </span>
          {explore.peak && !explore.allVisible && (
            <>
              <span className="text-[var(--border-strong)]">·</span>
              <span className={TIER_LABEL_COLOR[explore.peak.risk_tier]}>
                Peak: {explore.peak.label.split(",")[0]} ({explore.peak.risk_tier})
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function LegendChip({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ background: color, boxShadow: `0 0 8px ${color}` }}
      />
      {label}
    </span>
  );
}

interface BottomBarProps {
  onSubmit: (value: string) => void;
  value: string;
  onChange: (value: string) => void;
  loading: boolean;
  error: string | null;
  counts: Record<RiskTier, number>;
  lastUpdated: string | null;
  refreshing: boolean;
  onRefresh: () => void;
  attribution: string;
}

function BottomBar({
  onSubmit,
  value,
  onChange,
  loading,
  error,
  counts,
  lastUpdated,
  refreshing,
  onRefresh,
  attribution,
}: BottomBarProps) {
  return (
    <div className="absolute inset-x-0 bottom-0 z-20">
      <div className="pointer-events-none h-24 bg-gradient-to-t from-[var(--background)] via-[var(--background)]/80 to-transparent" />
      <div className="pointer-events-auto border-t border-[var(--border)] bg-[var(--background)]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3 px-4 py-3 sm:gap-5 sm:px-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onSubmit(value);
            }}
            className="flex min-w-[260px] flex-1 items-center gap-2 rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-1.5"
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden
              className="h-4 w-4 shrink-0 text-[var(--muted)]"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" strokeLinecap="round" />
            </svg>
            <input
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="Add any Ontario address, neighbourhood, or postal code…"
              disabled={loading}
              className="flex-1 bg-transparent py-1 text-sm text-[var(--paper)] placeholder:text-[var(--muted)] focus:outline-none disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={loading || !value.trim()}
              className="gg-press inline-flex items-center gap-1.5 rounded-lg border border-[var(--signal-strong)] bg-[var(--signal-soft)] px-3 py-1 text-xs uppercase tracking-[0.14em] text-[var(--signal)] disabled:opacity-40"
            >
              {loading ? (
                <>
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-[var(--signal)] border-t-transparent" />
                  Assessing
                </>
              ) : (
                "Add to map"
              )}
            </button>
          </form>

          <div className="flex flex-wrap items-center gap-4 text-[11px] uppercase tracking-[0.18em] text-[var(--paper-dim)]">
            <TierStat color="var(--risk-high)" count={counts.High} label="high" />
            <TierStat color="var(--risk-medium)" count={counts.Medium} label="medium" />
            <TierStat color="var(--risk-low)" count={counts.Low} label="low" />
            <span className="text-[var(--border-strong)]">·</span>
            <span className="font-mono text-[var(--muted)]">
              updated {fmtTime(lastUpdated)}
            </span>
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              className="gg-press inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] px-2 py-1 text-[var(--paper-dim)] hover:border-[var(--border-strong)] hover:text-[var(--paper)] disabled:opacity-40"
            >
              <svg
                viewBox="0 0 24 24"
                className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path d="M3 12a9 9 0 0 1 15-6.7L21 8" strokeLinecap="round" />
                <path d="M21 3v5h-5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M21 12a9 9 0 0 1-15 6.7L3 16" strokeLinecap="round" />
                <path d="M3 21v-5h5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              refresh
            </button>
            <span className="hidden font-mono text-[10px] text-[var(--muted)] md:inline">
              {attribution}
            </span>
          </div>
        </div>
        {error && (
          <div className="border-t border-[var(--risk-high)]/30 bg-[var(--risk-high)]/10 px-6 py-2 text-xs text-[var(--risk-high)]">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

function TierStat({
  color,
  count,
  label,
}: {
  color: string;
  count: number;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden
        className="inline-block h-2 w-2 rounded-full"
        style={{ background: color, boxShadow: `0 0 8px ${color}` }}
      />
      <span className="font-mono text-sm font-semibold tracking-tight text-[var(--paper)]">
        {count}
      </span>
      <span>{label}</span>
    </span>
  );
}

interface DetailPanelProps {
  pin: PinEntry;
  briefing: BriefingEntry | undefined;
  briefingLoading: boolean;
  briefingError: string | undefined;
  onClose: () => void;
  onRetryBriefing: () => void;
}

function DetailPanel({
  pin,
  briefing,
  briefingLoading,
  briefingError,
  onClose,
  onRetryBriefing,
}: DetailPanelProps) {
  const { result } = pin;
  const topDriver = useMemo(() => {
    const values = Object.values(result.factors);
    return values.reduce((top, item) =>
      item.contribution > top.contribution ? item : top,
    );
  }, [result.factors]);

  return (
    <aside
      key={pin.key}
      className="gg-panel absolute right-0 top-0 z-30 flex h-[calc(100%-72px)] w-full flex-col border-l border-[var(--border-strong)] bg-[var(--background)]/95 backdrop-blur-md sm:w-[440px]"
    >
      <header className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-5 pb-4 pt-5">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--muted)]">
            {pin.custom ? "Custom assessment" : "Monitored city"}
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-[var(--paper)]">
            {pin.label}
          </h2>
          <p className="mt-1 font-mono text-[11px] text-[var(--muted)]">
            {result.coordinates.lat.toFixed(4)}, {result.coordinates.lng.toFixed(4)}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close panel"
          className="gg-press rounded-lg border border-[var(--border)] bg-transparent p-1.5 text-[var(--paper-dim)] hover:border-[var(--border-strong)] hover:text-[var(--paper)]"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="m6 6 12 12M6 18 18 6" strokeLinecap="round" />
          </svg>
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        {/* Score */}
        <div className="gg-card-strong p-5">
          <RiskGauge score={result.risk_score} tier={result.risk_tier} />
          <div className="mt-5 grid gap-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="uppercase tracking-[0.16em] text-[var(--muted)]">
                Top driver
              </span>
              <span className={`font-medium ${TIER_LABEL_COLOR[result.risk_tier]}`}>
                {topDriver.label}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="uppercase tracking-[0.16em] text-[var(--muted)]">
                Storm context
              </span>
              <span className="max-w-[60%] truncate text-right text-[var(--paper-dim)]">
                {result.storm_context}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="uppercase tracking-[0.16em] text-[var(--muted)]">
                Station
              </span>
              <span className="max-w-[60%] truncate text-right text-[var(--paper-dim)]">
                {result.weather.stationName ?? "nearest"}
              </span>
            </div>
          </div>
        </div>

        {/* Factors */}
        <h3 className="mt-6 mb-3 text-[10px] uppercase tracking-[0.22em] text-[var(--muted)]">
          Factor breakdown
        </h3>
        <FactorBreakdown factors={result.factors} />

        {/* Briefing */}
        <h3 className="mt-6 mb-3 text-[10px] uppercase tracking-[0.22em] text-[var(--muted)]">
          Operator briefing
        </h3>
        {briefing ? (
          <BriefingReport
            briefing={briefing.text}
            location={result.name}
            tier={result.risk_tier}
            score={result.risk_score}
            generatedAt={result.generated_at}
            source={briefing.source}
          />
        ) : briefingError ? (
          <div className="rounded-2xl border border-[var(--risk-high)]/40 bg-[var(--risk-high)]/10 p-4 text-sm text-[var(--risk-high)]">
            <p className="font-medium">Briefing unavailable.</p>
            <p className="mt-1 text-xs text-[var(--paper-dim)]">{briefingError}</p>
            <button
              type="button"
              onClick={onRetryBriefing}
              disabled={briefingLoading}
              className="gg-press mt-3 inline-flex items-center gap-1.5 rounded-md border border-[var(--border-strong)] px-2.5 py-1 text-xs uppercase tracking-[0.16em] text-[var(--paper)] hover:bg-[var(--surface)] disabled:opacity-40"
            >
              {briefingLoading ? "Retrying…" : "Retry"}
            </button>
          </div>
        ) : (
          <BriefingSkeleton />
        )}

        <p className="mt-6 text-[11px] leading-relaxed text-[var(--muted)]">
          Toronto uses 311 storm-related requests as an outage proxy. Other regions
          use provincial reliability estimates (IESO/Hydro One patterns). Vegetation
          density uses Toronto street tree data (GTA) or NRCan land cover zones
          (province-wide). Live weather is sourced from Environment Canada.
        </p>
      </div>
    </aside>
  );
}

function BriefingSkeleton() {
  return (
    <div
      role="status"
      aria-label="Generating operator briefing"
      className="overflow-hidden rounded-2xl border border-[var(--border-strong)] bg-[var(--background-elev)]"
    >
      <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface)]/60 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[var(--border-strong)] bg-[var(--background-deep)] font-mono text-[10px] tracking-[0.18em] text-[var(--paper-dim)]">
            VX
          </span>
          <div className="flex flex-col gap-1">
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--paper-dim)]">
              Voltex · SITREP
            </span>
            <span className="gg-shimmer h-3 w-32 rounded" />
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-strong)] bg-[var(--background)] px-2 py-0.5">
          <span className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-[var(--signal)] border-t-transparent" />
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--paper-dim)]">
            Filing
          </span>
        </span>
      </div>
      <div className="flex flex-col gap-4 px-4 py-4">
        {["01", "02", "03", "04"].map((id) => (
          <div key={id}>
            <div className="mb-2 flex items-center gap-2">
              <span className="font-mono text-[10px] tracking-[0.22em] text-[var(--accent)]">§ {id}</span>
              <span className="gg-shimmer h-2 w-24 rounded" />
              <span aria-hidden className="ml-1 h-px flex-1 bg-[var(--border)]" />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="gg-shimmer h-3 w-full rounded" />
              <span className="gg-shimmer h-3 w-[88%] rounded" />
              {id !== "04" && <span className="gg-shimmer h-3 w-[72%] rounded" />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
