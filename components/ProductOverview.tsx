"use client";

const PIPELINE = [
  {
    label: "Geocode",
    detail: "Nominatim resolves the typed Ontario location into lat/lng and FSA context.",
  },
  {
    label: "Enrich",
    detail: "Environment Canada, Toronto Open Data and NRCan layers are joined around the point.",
  },
  {
    label: "Score",
    detail: "Four transparent factors produce a 0.00-1.00 risk score and tier.",
  },
  {
    label: "Brief",
    detail: "Gemini turns the structured payload into a supervisor-ready response.",
  },
];

const DATASETS = [
  ["Live weather", "Environment Canada", "Wind, gusts, condition, alerts"],
  ["Tree canopy", "Toronto Open Data", "689k street trees indexed locally"],
  ["Outage proxy", "Toronto 311", "Storm-related requests by FSA"],
  ["Flood exposure", "NRCan", "Ontario flood product footprints"],
];

const ACTIONS = [
  "Pre-position crews near high-risk corridors",
  "Issue proactive alerts before storm onset",
  "Monitor feeder load and trouble-call clusters",
];

function FlowIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M4 7h10a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h11" strokeLinecap="round" />
      <path d="m17 16 3 3-3 3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DatasetIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5">
      <ellipse cx="12" cy="5" rx="7" ry="3" />
      <path d="M5 5v7c0 1.7 3.1 3 7 3s7-1.3 7-3V5" />
      <path d="M5 12v7c0 1.7 3.1 3 7 3s7-1.3 7-3v-7" />
    </svg>
  );
}

function ScoreIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M4 19V5" strokeLinecap="round" />
      <path d="M4 19h16" strokeLinecap="round" />
      <path d="m7 15 3-4 3 2 5-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ProductOverview() {
  return (
    <section className="w-full max-w-6xl space-y-8">
      <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
        <div className="gg-card-strong gg-enter gg-enter-1 p-5 sm:p-6">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-white/40">
            <FlowIcon />
            Assessment pipeline
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-4">
            {PIPELINE.map((item, index) => (
              <div key={item.label} className="relative rounded-2xl border border-white/10 bg-black/20 p-4">
                <span className="font-mono text-xs text-white/35">0{index + 1}</span>
                <h3 className="mt-3 text-sm font-medium text-white">{item.label}</h3>
                <p className="mt-2 text-xs leading-relaxed text-white/50">{item.detail}</p>
                {index < PIPELINE.length - 1 && (
                  <div className="absolute -right-2 top-1/2 hidden h-px w-4 bg-white/15 sm:block" />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="gg-card-strong gg-enter gg-enter-2 overflow-hidden p-5 sm:p-6">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-white/40">
            <ScoreIcon />
            Transparent formula
          </div>
          <div className="mt-5 space-y-3">
            {[
              ["Wind", 30, "var(--signal)"],
              ["Canopy", 25, "var(--risk-low)"],
              ["Flood", 20, "var(--risk-medium)"],
              ["History", 25, "var(--risk-high)"],
            ].map(([label, weight, color]) => (
              <div key={label as string}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-white/70">{label}</span>
                  <span className="font-mono text-white/35">{weight}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                  <div className="h-full rounded-full" style={{ width: `${weight}%`, background: color as string }} />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-5 text-xs leading-relaxed text-white/50">
            The model is intentionally explainable: each normalized factor shows its raw signal,
            weight and contribution to the final tier.
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="gg-card gg-enter gg-enter-3 p-5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-white/40">
            <DatasetIcon />
            Local data store
          </div>
          <div className="mt-4 divide-y divide-white/10">
            {DATASETS.map(([name, source, detail]) => (
              <div key={name} className="grid grid-cols-[0.8fr_1fr] gap-3 py-3 first:pt-0 last:pb-0">
                <div>
                  <p className="text-sm font-medium text-white">{name}</p>
                  <p className="mt-0.5 text-[11px] text-white/35">{source}</p>
                </div>
                <p className="text-xs leading-relaxed text-white/50">{detail}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="gg-card gg-enter gg-enter-4 p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-white/40">Operator workflow</p>
          <h2 className="mt-3 max-w-xl text-2xl font-semibold tracking-tight text-white">
            From public signals to dispatch posture in one request.
          </h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {ACTIONS.map((action, index) => (
              <div key={action} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <span className="font-mono text-xs text-white/35">Action {index + 1}</span>
                <p className="mt-3 text-sm leading-relaxed text-white/70">{action}</p>
              </div>
            ))}
          </div>
          <p className="mt-5 text-xs leading-relaxed text-white/45">
            This remains a demo model: no proprietary feeder GIS is used, and outage history is
            represented by storm-adjacent 311 service requests rather than utility event logs.
          </p>
        </div>
      </div>
    </section>
  );
}
