import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/Logo";

export const metadata: Metadata = {
  title: "Methodology — Voltex",
  description:
    "How Voltex scores storm outage risk: the formula, the data sources, what the LLM briefing does, and where the model falls short.",
};

const PIPELINE = [
  {
    n: "01",
    title: "Resolve",
    body: "An Ontario address, postal code or city pin is resolved to lat/lng + a Forward Sortation Area (FSA) via Nominatim. Monitored cities skip this step.",
  },
  {
    n: "02",
    title: "Enrich",
    body: "Live weather from Environment Canada's MSC GeoMet at the nearest station joins a fixed snapshot of canopy, flood, and storm-call layers cached locally.",
  },
  {
    n: "03",
    title: "Score",
    body: "Four signals are normalized to 0–1, multiplied by their published weights, and summed into a single risk score with a Low / Medium / High tier.",
  },
  {
    n: "04",
    title: "Brief",
    body: "On request, Gemini 2.5 Flash turns the structured payload into a four-section briefing: posture, drivers, actions, and what would change the posture.",
  },
];

const FORMULA = [
  ["Wind", 30, "Live sustained wind and gusts vs a 100 km/h ceiling.", "var(--signal)"],
  ["Canopy", 25, "Indexed street-tree density in the surrounding ~1 km².", "var(--risk-low)"],
  ["Flood", 20, "Inside a NRCan flood footprint, or proximity to one.", "var(--risk-medium)"],
  ["History", 25, "Recent storm-related 311 service requests in the FSA.", "var(--risk-high)"],
] as const;

const DATA = [
  {
    layer: "Live weather",
    source: "Environment Canada · MSC GeoMet",
    cadence: "On-demand at request",
    notes: "Sustained wind, gust, temperature, conditions, and any active alerts.",
  },
  {
    layer: "Tree canopy",
    source: "City of Toronto Open Data",
    cadence: "Built locally at deploy time",
    notes: "689,000 street trees indexed into a regular cell grid for fast lookup.",
  },
  {
    layer: "Flood exposure",
    source: "Natural Resources Canada (NRCan)",
    cadence: "Built locally at deploy time",
    notes: "Federal historical flood footprints, distance-weighted within 50 km.",
  },
  {
    layer: "Storm-call history",
    source: "Toronto 311",
    cadence: "Built locally at deploy time",
    notes: "Storm-related service request volume by FSA used as an outage proxy.",
  },
];

const LIMITATIONS = [
  "Outage history is a public proxy (storm-related 311 calls), not utility-owned feeder outage events.",
  "Canopy density currently uses the City of Toronto inventory; coverage outside Toronto is approximated by nearest-cell.",
  "No proprietary feeder GIS, asset condition, or load telemetry — those would come from the utility in production.",
  "The LLM briefing is grounded in the structured score payload but is still generated text; treat it as supervisor-grade copy, not a control directive.",
];

export default function AboutPage() {
  return (
    <div className="relative min-h-screen bg-[var(--background)] pb-24">
      {/* Slim nav-like header */}
      <header className="border-b border-[var(--border)] bg-[var(--background)]/85 backdrop-blur">
        <div className="mx-auto flex max-w-[1100px] items-center justify-between gap-4 px-6 py-3">
          <Link href="/" className="gg-press inline-flex items-center gap-3 text-[var(--paper)]">
            <Logo size={24} withWordmark />
          </Link>
          <Link
            href="/"
            className="gg-press inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs uppercase tracking-[0.16em] text-[var(--paper-dim)] hover:border-[var(--border-strong)] hover:text-[var(--paper)]"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M19 12H5" strokeLinecap="round" />
              <path d="m11 6-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back to dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto flex max-w-[1100px] flex-col gap-16 px-6 pt-14">
        {/* HERO */}
        <section className="grid items-center gap-10 md:grid-cols-[1.1fr_0.9fr]">
          <div>
            <span className="gg-chip gg-chip-signal">
              <span
                aria-hidden
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: "var(--signal)", boxShadow: "0 0 12px var(--signal)" }}
              />
              Methodology · v0.1
            </span>
            <h1 className="mt-5 text-balance text-5xl font-semibold leading-[1.05] tracking-tight text-[var(--paper)]">
              How Voltex reads a storm.
            </h1>
            <p className="mt-5 max-w-xl text-[15px] leading-7 text-[var(--paper-dim)]">
              Voltex is a transparent storm outage risk dashboard for Ontario
              distribution operators. Every number you see on the dashboard comes from a
              public source, every weight is published, and every briefing is generated
              from the same structured payload an operator can inspect on screen. This
              page documents exactly how that pipeline works.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link href="/" className="gg-btn gg-btn-primary">
                Open the dashboard
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14" strokeLinecap="round" />
                  <path d="m13 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
              <a href="#formula" className="gg-btn gg-btn-ghost">
                Skip to the formula
              </a>
            </div>
          </div>

          <div className="gg-hero-portrait relative aspect-square w-full max-w-md justify-self-end overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-stormwatch.png"
              alt="Voltex storm-front mark"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between text-[10px] uppercase tracking-[0.22em] text-[var(--paper-dim)]/80">
              <span>The mark</span>
              <span className="font-mono">No. 01</span>
            </div>
          </div>
        </section>

        {/* MISSION */}
        <section className="grid gap-8 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-8 md:grid-cols-[0.5fr_1.5fr] md:p-10">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--muted)]">Why this exists</p>
            <h2 className="mt-3 text-2xl font-semibold leading-tight tracking-tight text-[var(--paper)]">
              Outages are quietly a public-safety event.
            </h2>
          </div>
          <div className="space-y-4 text-sm leading-7 text-[var(--paper-dim)]">
            <p>
              Long outages cut heat in January, A/C in July, dialysis schedules, medical
              refrigeration, and emergency communications. Restoration crews can&apos;t be
              everywhere at once — the operational question on every storm day is{" "}
              <em>where to pre-position</em> before the front lands.
            </p>
            <p>
              Voltex takes that question seriously by making the answer auditable. The
              dashboard surfaces a coloured pin per monitored city the moment the page
              loads. Clicking any pin reveals the same structured factors the operator
              briefing was built from. Nothing is hidden behind a black-box score.
            </p>
          </div>
        </section>

        {/* PIPELINE */}
        <section id="pipeline">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--muted)]">Pipeline</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--paper)] sm:text-3xl">
                Four steps, one round-trip.
              </h2>
            </div>
            <span className="font-mono text-[11px] text-[var(--muted)]">~3–5s for 16 cities</span>
          </div>
          <div className="grid gap-4 md:grid-cols-4">
            {PIPELINE.map((step) => (
              <div key={step.n} className="gg-card relative p-5">
                <span className="font-mono text-[11px] tracking-[0.18em] text-[var(--muted)]">{step.n}</span>
                <h3 className="mt-4 text-base font-medium text-[var(--paper)]">{step.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-[var(--paper-dim)]">{step.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* FORMULA */}
        <section id="formula" className="grid gap-8 md:grid-cols-[0.95fr_1.05fr]">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--muted)]">The formula</p>
            <h2 className="mt-2 text-2xl font-semibold leading-tight tracking-tight text-[var(--paper)] sm:text-3xl">
              Weighted, normalized, and shown back.
            </h2>
            <p className="mt-4 text-sm leading-7 text-[var(--paper-dim)]">
              Four signals are normalized to a 0–1 scale, multiplied by their published
              weights, and summed. Tiers map directly from the score:{" "}
              <span className="gg-tier-low">Low &lt; 0.35</span>{" "}
              <span className="text-[var(--muted)]">·</span>{" "}
              <span className="gg-tier-medium">Medium 0.35–0.65</span>{" "}
              <span className="text-[var(--muted)]">·</span>{" "}
              <span className="gg-tier-high">High &gt; 0.65</span>.
            </p>
            <pre className="mt-6 overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--background-elev)] p-5 font-mono text-[12px] leading-relaxed text-[var(--paper-dim)]">
              <code>{`risk_score =
    0.30 × wind
  + 0.25 × canopy
  + 0.20 × flood
  + 0.25 × outage_history`}</code>
            </pre>
          </div>

          <div className="gg-card-strong p-6">
            <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--muted)]">Weights</p>
            <div className="mt-5 space-y-5">
              {FORMULA.map(([label, weight, detail, color]) => (
                <div key={label}>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-sm text-[var(--paper)]">{label}</span>
                    <span className="font-mono text-xs text-[var(--muted)]">{weight}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface)]">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${weight}%`, background: color }}
                    />
                  </div>
                  <p className="mt-2 text-[12px] leading-relaxed text-[var(--paper-dim)]">{detail}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* DATA */}
        <section id="data">
          <div className="mb-6">
            <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--muted)]">Data provenance</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--paper)] sm:text-3xl">
              Public sources, indexed locally for speed.
            </h2>
          </div>
          <div className="overflow-hidden rounded-2xl border border-[var(--border)]">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-[var(--surface)]">
                <tr className="text-left text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
                  <th className="px-5 py-3 font-medium">Layer</th>
                  <th className="px-5 py-3 font-medium">Source</th>
                  <th className="px-5 py-3 font-medium">Cadence</th>
                  <th className="px-5 py-3 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody>
                {DATA.map((row) => (
                  <tr
                    key={row.layer}
                    className="border-t border-[var(--border)] text-[var(--paper-dim)]"
                  >
                    <td className="px-5 py-4 align-top text-[var(--paper)]">{row.layer}</td>
                    <td className="px-5 py-4 align-top font-mono text-[12px] text-[var(--paper-dim)]">
                      {row.source}
                    </td>
                    <td className="px-5 py-4 align-top text-[var(--paper-dim)]">{row.cadence}</td>
                    <td className="px-5 py-4 align-top text-[12px] leading-relaxed">
                      {row.notes}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* BRIEFING */}
        <section id="briefing" className="grid gap-8 md:grid-cols-[1fr_1fr]">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--muted)]">The operator briefing</p>
            <h2 className="mt-2 text-2xl font-semibold leading-tight tracking-tight text-[var(--paper)] sm:text-3xl">
              Structured input, four-section output.
            </h2>
            <p className="mt-4 text-sm leading-7 text-[var(--paper-dim)]">
              When an operator opens a city panel and asks for a briefing, the same
              structured score payload that drives the gauge is handed to Gemini 2.5
              Flash with a strict system prompt. The model is constrained to a fixed
              four-section format so dispatch can scan a column of briefings without
              re-reading prose.
            </p>
            <p className="mt-3 text-sm leading-7 text-[var(--paper-dim)]">
              The briefing is generated lazily — never on dashboard load. A briefing
              call burns ~94 input tokens and ~75 output tokens, finishing in under two
              seconds.
            </p>
          </div>
          <div className="gg-card-strong p-5 font-mono text-[12px] leading-relaxed text-[var(--paper)]">
            <p className="mb-3 text-[10px] uppercase tracking-[0.22em] text-[var(--muted)]">
              Briefing schema
            </p>
            <p>
              <span className="gg-text-signal">POSTURE</span> — risk tier + single most important driver.
            </p>
            <p className="mt-2">
              <span className="gg-text-signal">DRIVERS</span> — 2–3 short bullets naming the top contributing factors with their values.
            </p>
            <p className="mt-2">
              <span className="gg-text-signal">ACTIONS</span> — 2–3 short bullets with operational steps appropriate to the tier.
            </p>
            <p className="mt-2">
              <span className="gg-text-signal">WATCH</span> — one sentence on what would change this posture in the next 6 hours.
            </p>
            <p className="mt-4 text-[11px] text-[var(--muted)]">
              If no API key is present the same structure is generated from a local
              template using the score factors directly — so the panel never breaks.
            </p>
          </div>
        </section>

        {/* LIMITATIONS */}
        <section className="grid gap-6 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-8 md:grid-cols-[0.45fr_1.55fr] md:p-10">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--muted)]">Limitations</p>
            <h2 className="mt-3 text-2xl font-semibold leading-tight tracking-tight text-[var(--paper)]">
              What this model is not.
            </h2>
          </div>
          <ul className="space-y-3 text-sm leading-7 text-[var(--paper-dim)]">
            {LIMITATIONS.map((line) => (
              <li key={line} className="flex gap-3">
                <span
                  aria-hidden
                  className="mt-2.5 inline-block h-1 w-3 shrink-0"
                  style={{ background: "var(--signal)" }}
                />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* FOOTER CTA */}
        <section className="flex flex-col items-center gap-5 py-6 text-center">
          <Logo size={28} />
          <h2 className="text-xl text-[var(--paper-dim)]">
            Ready to read the board?
          </h2>
          <Link href="/" className="gg-btn gg-btn-signal">
            Open the dashboard
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14" strokeLinecap="round" />
              <path d="m13 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </section>
      </main>
    </div>
  );
}
