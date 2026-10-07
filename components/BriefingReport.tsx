"use client";

import type { RiskTier } from "@/lib/types";

interface BriefingReportProps {
  briefing: string;
  location: string;
  tier: RiskTier;
  score: number;
  generatedAt: string;
  source: "gemini" | "local";
}

interface ParsedBriefing {
  posture: string;
  drivers: string[];
  actions: string[];
  watch: string;
}

const EMPTY: ParsedBriefing = { posture: "", drivers: [], actions: [], watch: "" };

/**
 * Parses the SITREP plain text Gemini (or the local fallback) returns.
 * Tolerates leading markdown asterisks/whitespace so we don't lose content
 * if the model decorates its output despite instructions.
 */
export function parseBriefing(raw: string): ParsedBriefing {
  if (!raw) return EMPTY;
  const clean = raw.replace(/\*+/g, "").replace(/\r/g, "");
  const lines = clean.split("\n").map((l) => l.trim()).filter(Boolean);

  let current: "posture" | "drivers" | "actions" | "watch" | null = null;
  const out: ParsedBriefing = { posture: "", drivers: [], actions: [], watch: "" };

  for (const line of lines) {
    const labelMatch = line.match(/^(POSTURE|DRIVERS|ACTIONS|WATCH)\s*:?\s*(.*)$/i);
    if (labelMatch) {
      const label = labelMatch[1].toLowerCase() as keyof ParsedBriefing;
      const rest = labelMatch[2]?.trim() ?? "";
      if (label === "posture") {
        current = "posture";
        if (rest) out.posture = rest;
      } else if (label === "drivers") {
        current = "drivers";
        if (rest) out.drivers.push(rest);
      } else if (label === "actions") {
        current = "actions";
        if (rest) out.actions.push(rest);
      } else if (label === "watch") {
        current = "watch";
        if (rest) out.watch = rest;
      }
      continue;
    }

    const bullet = line.match(/^[-•▸·]\s*(.+)$/);
    if (bullet && (current === "drivers" || current === "actions")) {
      out[current].push(bullet[1].trim());
      continue;
    }

    // Continuation lines append to the active block.
    if (current === "posture") out.posture = `${out.posture} ${line}`.trim();
    else if (current === "watch") out.watch = `${out.watch} ${line}`.trim();
    else if (current === "drivers" && out.drivers.length)
      out.drivers[out.drivers.length - 1] = `${out.drivers[out.drivers.length - 1]} ${line}`.trim();
    else if (current === "actions" && out.actions.length)
      out.actions[out.actions.length - 1] = `${out.actions[out.actions.length - 1]} ${line}`.trim();
  }
  return out;
}

const TIER_COLOR: Record<RiskTier, string> = {
  High: "var(--risk-high)",
  Medium: "var(--risk-medium)",
  Low: "var(--risk-low)",
};

function fmtClock(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-CA", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "short",
      hour12: false,
    });
  } catch {
    return iso;
  }
}

export function BriefingReport({
  briefing,
  location,
  tier,
  score,
  generatedAt,
  source,
}: BriefingReportProps) {
  const parsed = parseBriefing(briefing);
  const tierColor = TIER_COLOR[tier];

  // Reference identifier: deterministic per-location, per-hour. Looks like an
  // ops ticket — gives the report grounded "control-room" flavor.
  const refId = makeRefId(location, generatedAt);

  return (
    <article className="gg-sitrep relative overflow-hidden rounded-2xl border border-[var(--border-strong)] bg-[var(--background-elev)]">
      {/* report letterhead */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface)]/60 px-4 py-3">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="relative inline-flex h-7 w-7 items-center justify-center rounded-md border border-[var(--border-strong)] bg-[var(--background-deep)] font-mono text-[10px] tracking-[0.18em] text-[var(--paper-dim)]"
          >
            VX
          </span>
          <div className="flex flex-col">
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--paper-dim)]">
              Voltex · SITREP
            </span>
            <span className="text-[13px] font-semibold text-[var(--paper)]">
              {location}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.18em]"
            style={{
              borderColor: tierColor,
              color: tierColor,
              background: "color-mix(in srgb, var(--background-elev) 70%, transparent)",
            }}
          >
            <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: tierColor }} />
            {tier} · {score}
          </span>
        </div>
      </header>

      {/* report metadata strip */}
      <div className="grid grid-cols-3 gap-px border-b border-[var(--border)] bg-[var(--border)] font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--paper-dim)]">
        <MetaCell label="Ref" value={refId} />
        <MetaCell label="Filed" value={fmtClock(generatedAt)} />
        <MetaCell label="Source" value={source === "gemini" ? "Gemini · 2.5-flash" : "Local fallback"} />
      </div>

      <div className="flex flex-col gap-4 px-4 py-4">
        <Section index="01" title="Posture">
          {parsed.posture ? (
            <p className="text-[13px] leading-relaxed text-[var(--paper)]">{parsed.posture}</p>
          ) : (
            <Placeholder>Awaiting briefing posture line.</Placeholder>
          )}
        </Section>

        <Section index="02" title="Drivers" count={parsed.drivers.length}>
          {parsed.drivers.length > 0 ? (
            <ul className="flex flex-col gap-1.5">
              {parsed.drivers.map((d, i) => (
                <BulletRow key={i} text={d} />
              ))}
            </ul>
          ) : (
            <Placeholder>No drivers reported.</Placeholder>
          )}
        </Section>

        <Section index="03" title="Recommended actions" count={parsed.actions.length}>
          {parsed.actions.length > 0 ? (
            <ul className="flex flex-col gap-1.5">
              {parsed.actions.map((a, i) => (
                <BulletRow key={i} text={a} accent />
              ))}
            </ul>
          ) : (
            <Placeholder>No actions reported.</Placeholder>
          )}
        </Section>

        <Section index="04" title="Watch for">
          {parsed.watch ? (
            <p className="text-[13px] leading-relaxed text-[var(--paper)]">{parsed.watch}</p>
          ) : (
            <Placeholder>No escalation criteria reported.</Placeholder>
          )}
        </Section>
      </div>

      <footer className="flex items-center justify-between border-t border-[var(--border)] bg-[var(--surface)]/40 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--paper-dim)]">
        <span>— end of report —</span>
        <span>auto-generated · not for public release</span>
      </footer>
    </article>
  );
}

function Section({
  index,
  title,
  count,
  children,
}: {
  index: string;
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <span className="font-mono text-[10px] tracking-[0.22em] text-[var(--accent)]">§ {index}</span>
        <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--paper-dim)]">
          {title}
        </span>
        {typeof count === "number" && count > 0 && (
          <span className="font-mono text-[10px] text-[var(--muted)]">·{count.toString().padStart(2, "0")}</span>
        )}
        <span aria-hidden className="ml-1 h-px flex-1 bg-[var(--border)]" />
      </div>
      {children}
    </section>
  );
}

function BulletRow({ text, accent = false }: { text: string; accent?: boolean }) {
  return (
    <li className="flex items-start gap-2">
      <span
        aria-hidden
        className="mt-[7px] inline-block h-1 w-3 flex-shrink-0 rounded-full"
        style={{ background: accent ? "var(--accent)" : "var(--paper-dim)" }}
      />
      <span className="text-[13px] leading-relaxed text-[var(--paper)]">{text}</span>
    </li>
  );
}

function MetaCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 bg-[var(--background-elev)] px-3 py-2">
      <span className="text-[9px] text-[var(--muted)]">{label}</span>
      <span className="truncate text-[11px] normal-case tracking-normal text-[var(--paper)]">{value}</span>
    </div>
  );
}

function Placeholder({ children }: { children: React.ReactNode }) {
  return <p className="text-[12px] italic text-[var(--muted)]">{children}</p>;
}

function makeRefId(location: string, iso: string): string {
  let h = 0;
  for (const ch of location) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const d = new Date(iso);
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  return `VX-${yy}${mm}${dd}-${hh}-${(h % 9000 + 1000).toString()}`;
}
