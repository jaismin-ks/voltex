"use client";

import type { ReactNode } from "react";
import type { RiskFactors } from "@/lib/types";

interface FactorBreakdownProps {
  factors: RiskFactors;
}

const ICONS: Record<string, ReactNode> = {
  wind: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M3 8h12a3 3 0 1 0-3-3" />
      <path d="M3 12h18" />
      <path d="M3 16h9a3 3 0 1 1-3 3" />
    </svg>
  ),
  canopy: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22V12" />
      <path d="M7 12a5 5 0 1 1 10 0" />
      <path d="M5 16a4 4 0 0 0 4 4h6a4 4 0 0 0 4-4" />
    </svg>
  ),
  flood: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 17c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2" />
      <path d="M3 12c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2" />
      <path d="M3 7c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2" />
    </svg>
  ),
  history: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 8v4l3 2" />
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
    </svg>
  ),
  weatherHistory: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  ),
};

function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

export function FactorBreakdown({ factors }: FactorBreakdownProps) {
  const items = [
    { key: "wind", factor: factors.wind },
    { key: "canopy", factor: factors.canopy },
    { key: "flood", factor: factors.flood },
    { key: "history", factor: factors.history },
    { key: "weatherHistory", factor: factors.weatherHistory },
  ];
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" style={{ gridTemplateRows: "auto auto auto" }}>
      {items.map((item, i) => (
        <div
          key={item.key}
          className={`gg-card gg-enter gg-enter-${i + 1} p-4${i === 4 ? " sm:col-span-2" : ""}`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-[var(--paper-dim)]">
              <span className="text-[var(--muted)]">{ICONS[item.key]}</span>
              {item.factor.label}
            </div>
            <span className="font-mono text-xs text-[var(--muted)]">
              w {pct(item.factor.weight)}
            </span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="font-mono text-2xl tabular-nums text-[var(--paper)]">
              {item.factor.normalized.toFixed(2)}
            </span>
            <span className="font-mono text-xs text-[var(--muted)]">
              +{item.factor.contribution.toFixed(2)} to score
            </span>
          </div>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface)]">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max(2, item.factor.normalized * 100)}%`,
                background:
                  item.factor.normalized > 0.7
                    ? "var(--risk-high)"
                    : item.factor.normalized > 0.4
                      ? "var(--risk-medium)"
                      : "var(--risk-low)",
                transition: "width 600ms var(--ease-out)",
              }}
            />
          </div>
          <p className="mt-3 text-xs leading-relaxed text-[var(--paper-dim)]">{item.factor.detail}</p>
        </div>
      ))}
    </div>
  );
}
