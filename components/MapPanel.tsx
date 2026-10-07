"use client";

import { useEffect, useRef } from "react";
import type { Coordinates, RiskTier } from "@/lib/types";

const TIER_COLORS: Record<RiskTier, string> = {
  Low: "#34d399",
  Medium: "#fbbf24",
  High: "#f87171",
};

interface MapPanelProps {
  coordinates: Coordinates;
  tier: RiskTier;
  location: string;
}

export default function MapPanel({ coordinates, tier, location }: MapPanelProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = await import("leaflet");
      if (cancelled || !containerRef.current) return;
      const map = L.map(containerRef.current, {
        zoomControl: false,
        attributionControl: false,
        scrollWheelZoom: false,
      }).setView([coordinates.lat, coordinates.lng], 11);
      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        {
          maxZoom: 19,
          subdomains: "abcd",
        },
      ).addTo(map);

      const color = TIER_COLORS[tier];
      L.circle([coordinates.lat, coordinates.lng], {
        radius: 3500,
        color,
        weight: 1.5,
        fillColor: color,
        fillOpacity: 0.18,
      })
        .addTo(map)
        .bindTooltip(location, { permanent: false, direction: "top" });
      L.circleMarker([coordinates.lat, coordinates.lng], {
        radius: 4,
        color,
        fillColor: color,
        fillOpacity: 1,
        weight: 2,
      }).addTo(map);

      mapRef.current = map;
    })();
    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [coordinates.lat, coordinates.lng, tier, location]);

  return (
    <div className="gg-card-strong overflow-hidden">
      <div ref={containerRef} className="h-72 w-full" />
    </div>
  );
}
