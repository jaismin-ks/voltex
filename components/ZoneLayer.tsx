'use client';

import { useEffect, useRef } from 'react';
import type { ZoneRiskResult } from '@/lib/types';

interface ZoneLayerProps {
  map: L.Map | null;
  zones: ZoneRiskResult[];
  selectedZone: string | null;
  onZoneClick: (zone: ZoneRiskResult) => void;
  visible: boolean;
}

function zoneColor(score: number): string {
  if (score < 0.40) {
    // Green range: #4a7c59 → #8ba585
    const t = score / 0.40;
    return lerpHex('#4a7c59', '#8ba585', t);
  } else if (score < 0.70) {
    // Amber range: #d6a878 → #e0a458
    const t = (score - 0.40) / 0.30;
    return lerpHex('#d6a878', '#e0a458', t);
  } else {
    // Red range: #b85651 → #dd4444
    const t = (score - 0.70) / 0.30;
    return lerpHex('#b85651', '#dd4444', Math.min(t, 1));
  }
}

function lerpHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `rgb(${r},${g},${bl})`;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function darken(color: string, factor = 0.75): string {
  const match = color.match(/rgb\((\d+),(\d+),(\d+)\)/);
  if (!match) return color;
  const r = Math.round(Number(match[1]) * factor);
  const g = Math.round(Number(match[2]) * factor);
  const b = Math.round(Number(match[3]) * factor);
  return `rgb(${r},${g},${b})`;
}

function topDriverLabel(zone: ZoneRiskResult): string {
  const entries = Object.values(zone.factors);
  const top = entries.reduce((best, f) =>
    f.contribution > best.contribution ? f : best,
  );
  return top.label;
}

export function ZoneLayer({ map, zones, selectedZone, onZoneClick, visible }: ZoneLayerProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const layerGroupRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const polygonsRef = useRef<Map<string, any>>(new Map());
  const selectedZoneRef = useRef<string | null>(selectedZone);
  const suppressHoverRef = useRef(false);

  const closeAllTooltips = () => {
    for (const poly of polygonsRef.current.values()) {
      poly.closeTooltip?.();
    }
  };

  useEffect(() => {
    selectedZoneRef.current = selectedZone;
  }, [selectedZone]);

  // Close tooltips and block hover while panning/zooming the map
  useEffect(() => {
    if (!map) return;

    const onMoveStart = () => {
      suppressHoverRef.current = true;
      closeAllTooltips();
    };
    const onMoveEnd = () => {
      suppressHoverRef.current = false;
    };

    map.on("dragstart", onMoveStart);
    map.on("movestart", onMoveStart);
    map.on("zoomstart", onMoveStart);
    map.on("dragend", onMoveEnd);
    map.on("moveend", onMoveEnd);
    map.on("zoomend", onMoveEnd);

    return () => {
      map.off("dragstart", onMoveStart);
      map.off("movestart", onMoveStart);
      map.off("zoomstart", onMoveStart);
      map.off("dragend", onMoveEnd);
      map.off("moveend", onMoveEnd);
      map.off("zoomend", onMoveEnd);
    };
  }, [map]);

  // Create / tear down layer group
  useEffect(() => {
    if (!map) return;
    let cancelled = false;
    const polygons = polygonsRef.current;

    (async () => {
      const L = await import('leaflet');
      if (cancelled) return;

      const group = L.layerGroup();
      group.addTo(map);
      layerGroupRef.current = group;
    })();

    return () => {
      cancelled = true;
      if (layerGroupRef.current) {
        layerGroupRef.current.clearLayers();
        layerGroupRef.current.remove();
        layerGroupRef.current = null;
      }
      polygons.clear();
    };
  }, [map]);

  // Render / update polygons
  useEffect(() => {
    if (!map || !layerGroupRef.current) return;
    let cancelled = false;

    (async () => {
      const L = await import('leaflet');
      if (cancelled) return;

      const group = layerGroupRef.current;
      if (!group) return;

      const existing = polygonsRef.current;
      const nextKeys = new Set(zones.map((z) => z.h3Index));

      const getZoneStyle = (zone: ZoneRiskResult, state: 'base' | 'hover'): L.PathOptions => {
        const fill = zoneColor(zone.risk_score);
        const stroke = darken(fill, 0.7);
        const baseOpacity = 0.15 + zone.risk_score * 0.45;
        const isSelected = zone.h3Index === selectedZone;
        const isHover = state === 'hover' && !isSelected;
        return {
          fillColor: fill,
          fillOpacity: isHover ? Math.min(baseOpacity + 0.12, 0.8) : baseOpacity,
          color: isSelected ? '#fff' : isHover ? darken(fill, 0.45) : stroke,
          weight: isSelected ? 2.5 : isHover ? 2 : 1,
          opacity: isSelected ? 0.95 : isHover ? 0.92 : 0.6,
          className: 'gg-zone-polygon',
        };
      };

      // Remove polygons no longer needed
      for (const [key, poly] of existing) {
        if (!nextKeys.has(key)) {
          group.removeLayer(poly);
          existing.delete(key);
        }
      }

      for (const zone of zones) {
        const style = getZoneStyle(zone, 'base');
        const isSelected = zone.h3Index === selectedZone;

        const existingPoly = existing.get(zone.h3Index);
        if (existingPoly) {
          existingPoly.setStyle(style);
          if (isSelected) {
            existingPoly.bringToFront();
          }
        } else {
          const poly = L.polygon(zone.boundary as L.LatLngExpression[], style);

          const tooltipContent = `
            <div style="line-height:1.5">
              <strong>${zone.zone_label}</strong><br/>
              <span style="opacity:0.8">Score:</span> ${zone.risk_score.toFixed(2)} · ${zone.risk_tier}<br/>
              <span style="opacity:0.8">Driver:</span> ${topDriverLabel(zone)}
            </div>
          `;

          poly.bindTooltip(tooltipContent, {
            sticky: false,
            interactive: false,
            className: 'gg-zone-tooltip',
            direction: 'top',
            offset: [0, -8],
          });

          poly.on('mouseover', () => {
            if (suppressHoverRef.current) return;
            closeAllTooltips();
            poly.openTooltip();
            if (zone.h3Index !== selectedZoneRef.current) {
              poly.setStyle(getZoneStyle(zone, 'hover'));
              poly.bringToFront();
            }
          });

          poly.on('mouseout', () => {
            poly.closeTooltip();
            poly.setStyle(getZoneStyle(zone, 'base'));
          });

          poly.on('click', () => {
            onZoneClick(zone);
          });

          poly.addTo(group);
          existing.set(zone.h3Index, poly);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [map, zones, selectedZone, onZoneClick]);

  // Show / hide
  useEffect(() => {
    if (!map || !layerGroupRef.current) return;
    if (visible) {
      if (!map.hasLayer(layerGroupRef.current)) {
        layerGroupRef.current.addTo(map);
      }
    } else {
      if (map.hasLayer(layerGroupRef.current)) {
        map.removeLayer(layerGroupRef.current);
      }
    }
  }, [map, visible]);

  return null;
}
