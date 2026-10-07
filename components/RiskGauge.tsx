"use client";

import { useEffect, useState } from "react";
import type { RiskTier } from "@/lib/types";

const TIER_COLORS: Record<RiskTier, string> = {
  Low: "var(--risk-low)",
  Medium: "var(--risk-medium)",
  High: "var(--risk-high)",
};

interface RiskGaugeProps {
  score: number;
  tier: RiskTier;
}

export function RiskGauge({ score, tier }: RiskGaugeProps) {
  const [animated, setAnimated] = useState(0);
  useEffect(() => {
    const target = Math.max(0, Math.min(1, score));
    let raf = 0;
    const start = performance.now();
    const dur = 700;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      setAnimated(target * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [score]);

  const color = TIER_COLORS[tier];
  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - animated);

  return (
    <div className="flex items-center gap-6">
      <div className="relative h-40 w-40">
        <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90">
          <circle
            cx="80"
            cy="80"
            r={radius}
            stroke="var(--surface-strong)"
            strokeWidth="12"
            fill="none"
          />
          <circle
            cx="80"
            cy="80"
            r={radius}
            stroke={color}
            strokeWidth="12"
            strokeLinecap="round"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: "stroke 240ms var(--ease-out)" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-3xl font-semibold tracking-tight">
            {animated.toFixed(2)}
          </span>
          <span className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">/ 1.00</span>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Risk tier</span>
        <span
          className="inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium"
          style={{ borderColor: color, color }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: color, boxShadow: `0 0 12px ${color}` }}
          />
          {tier}
        </span>
        <p className="mt-2 max-w-xs text-sm text-[var(--paper-dim)]">
          Weighted score across wind, canopy, flood exposure and recent outage history.
        </p>
      </div>
    </div>
  );
}
