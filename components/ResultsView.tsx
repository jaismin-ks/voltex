"use client";

import dynamic from "next/dynamic";
import type { AssessResponse } from "@/lib/types";
import { RiskGauge } from "./RiskGauge";
import { FactorBreakdown } from "./FactorBreakdown";

const MapPanel = dynamic(() => import("./MapPanel"), {
  ssr: false,
  loading: () => <div className="gg-card-strong h-72 gg-shimmer" />,
});

interface ResultsViewProps {
  data: AssessResponse;
  onReset: () => void;
}

export function ResultsView({ data, onReset }: ResultsViewProps) {
  const factorValues = Object.values(data.factors);
  const topDriver = factorValues.reduce((top, item) =>
    item.contribution > top.contribution ? item : top,
  );

  return (
    <div className="flex w-full max-w-5xl flex-col gap-8">
      <header className="flex items-start justify-between gap-4">
        <div className="gg-enter">
          <p className="text-xs uppercase tracking-[0.18em] text-white/40">
            Assessed location
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{data.location}</h1>
          <p className="mt-1 font-mono text-xs text-white/40">
            {data.coordinates.lat.toFixed(4)}, {data.coordinates.lng.toFixed(4)}
            {data.fsa ? ` · FSA ${data.fsa}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="gg-press rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70 hover:border-white/20 hover:text-white"
        >
          New assessment
        </button>
      </header>

      <section className="gg-card-strong gg-enter gg-enter-1 p-6">
        <RiskGauge score={data.risk_score} tier={data.risk_tier} />
        <p className="mt-6 text-xs uppercase tracking-[0.18em] text-white/40">
          Storm context
        </p>
        <p className="mt-1 text-sm text-white/80">{data.storm_context}</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {[
            ["Top driver", topDriver.label],
            ["Weather station", data.weather.stationName ?? "nearest available"],
            ["Model mode", "transparent weighted score"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-white/10 bg-black/20 p-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-white/35">{label}</p>
              <p className="mt-1 truncate text-sm text-white/75">{value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs uppercase tracking-[0.18em] text-white/40">
          Factor breakdown
        </h2>
        <FactorBreakdown factors={data.factors} />
      </section>

      <section className="gg-card-strong gg-enter gg-enter-3 p-6">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-white/40">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: "var(--accent)", boxShadow: "0 0 12px var(--accent)" }}
          />
          Operations recommendation
        </div>
        <p className="mt-3 text-sm leading-relaxed text-white/85 whitespace-pre-wrap">
          {data.llm_narrative}
        </p>
      </section>

      <section className="gg-enter gg-enter-4 flex flex-col gap-3">
        <h2 className="text-xs uppercase tracking-[0.18em] text-white/40">
          Zone map
        </h2>
        <MapPanel
          coordinates={data.coordinates}
          tier={data.risk_tier}
          location={data.location}
        />
      </section>

      <section className="gg-card gg-enter gg-enter-5 grid gap-4 p-5 md:grid-cols-[0.8fr_1.2fr]">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-white/40">
            Confidence notes
          </p>
          <h2 className="mt-2 text-lg font-semibold text-white">What this score means</h2>
        </div>
        <div className="grid gap-3 text-xs leading-relaxed text-white/55 sm:grid-cols-2">
          <p>
            Weather is live from Environment Canada. Static risk signals are preloaded from
            public datasets and normalized locally for the demo.
          </p>
          <p>
            Outage history is a public proxy using storm-related Toronto 311 requests, not
            utility-owned feeder outage events or proprietary GIS.
          </p>
        </div>
      </section>

      <footer className="text-[11px] text-white/30">
        Generated {new Date(data.generated_at).toLocaleString()} · Weather via{" "}
        {data.weather.source}
      </footer>
    </div>
  );
}
