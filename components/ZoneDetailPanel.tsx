'use client';

import { useMemo } from 'react';
import type { ZoneRiskResult, SlimAssessResult, RiskTier } from '@/lib/types';
import { RiskGauge } from './RiskGauge';
import { FactorBreakdown } from './FactorBreakdown';
import { BriefingReport } from './BriefingReport';

interface ZoneDetailPanelProps {
  zone: ZoneRiskResult;
  citiesInZone: SlimAssessResult[];
  onClose: () => void;
  onRequestBriefing: () => void;
  briefing: { text: string; source: string } | null;
  briefingLoading: boolean;
}

const TIER_LABEL_COLOR: Record<RiskTier, string> = {
  High: 'gg-tier-high',
  Medium: 'gg-tier-medium',
  Low: 'gg-tier-low',
};

const TIER_COLOR: Record<RiskTier, string> = {
  High: 'var(--risk-high)',
  Medium: 'var(--risk-medium)',
  Low: 'var(--risk-low)',
};

interface WeatherHistoryStats {
  tornado: number;
  iceStorm: number;
  highWind: number;
  thunderstorm: number;
  derecho: boolean;
}

function parseWeatherHistory(detail: string): WeatherHistoryStats {
  const stats: WeatherHistoryStats = {
    tornado: 0,
    iceStorm: 0,
    highWind: 0,
    thunderstorm: 0,
    derecho: false,
  };

  const tornadoMatch = detail.match(/(\d+)\s*tornado/i);
  if (tornadoMatch) stats.tornado = parseInt(tornadoMatch[1], 10);

  const iceMatch = detail.match(/(\d+)\s*ice\s*storm/i);
  if (iceMatch) stats.iceStorm = parseInt(iceMatch[1], 10);

  const windMatch = detail.match(/(\d+)\s*high\s*wind/i);
  if (windMatch) stats.highWind = parseInt(windMatch[1], 10);

  const tsMatch = detail.match(/(\d+)\s*(severe\s*)?thunderstorm/i);
  if (tsMatch) stats.thunderstorm = parseInt(tsMatch[1], 10);

  stats.derecho = /derecho/i.test(detail);

  return stats;
}

export function ZoneDetailPanel({
  zone,
  citiesInZone,
  onClose,
  onRequestBriefing,
  briefing,
  briefingLoading,
}: ZoneDetailPanelProps) {
  const topDriver = useMemo(() => {
    const values = Object.values(zone.factors);
    return values.reduce((top, item) =>
      item.contribution > top.contribution ? item : top,
    );
  }, [zone.factors]);

  const historyStats = useMemo(
    () => parseWeatherHistory(zone.factors.weatherHistory?.detail ?? ''),
    [zone.factors.weatherHistory],
  );

  return (
    <aside
      key={zone.h3Index}
      className="gg-panel absolute right-0 top-0 z-30 flex h-[calc(100%-72px)] w-full flex-col border-l border-[var(--border-strong)] bg-[var(--background)]/95 backdrop-blur-md sm:w-[440px]"
    >
      <header className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-5 pb-4 pt-5">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--muted)]">
              Zone assessment
            </p>
            <span className="gg-chip text-[9px]">{zone.region}</span>
          </div>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-[var(--paper)]">
            {zone.zone_label}
          </h2>
          <p className="mt-1 font-mono text-[11px] text-[var(--muted)]">
            {zone.center.lat.toFixed(4)}, {zone.center.lng.toFixed(4)}
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
          <RiskGauge score={zone.risk_score} tier={zone.risk_tier} />
          <div className="mt-5 grid gap-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="uppercase tracking-[0.16em] text-[var(--muted)]">
                Top driver
              </span>
              <span className={`font-medium ${TIER_LABEL_COLOR[zone.risk_tier]}`}>
                {topDriver.label}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="uppercase tracking-[0.16em] text-[var(--muted)]">
                Storm context
              </span>
              <span className="max-w-[60%] truncate text-right text-[var(--paper-dim)]">
                {zone.storm_context}
              </span>
            </div>
          </div>
        </div>

        {/* Weather history profile */}
        <h3 className="mt-6 mb-3 text-[10px] uppercase tracking-[0.22em] text-[var(--muted)]">
          Historical weather profile
        </h3>
        <div className="gg-zone-stats">
          <div className="gg-zone-stat-card">
            <span className="gg-zone-stat-icon">🌪️</span>
            <div>
              <div className="gg-zone-stat-value">{historyStats.tornado}</div>
              <div className="gg-zone-stat-label">Tornado</div>
            </div>
          </div>
          <div className="gg-zone-stat-card">
            <span className="gg-zone-stat-icon">❄️</span>
            <div>
              <div className="gg-zone-stat-value">{historyStats.iceStorm}</div>
              <div className="gg-zone-stat-label">Ice storm</div>
            </div>
          </div>
          <div className="gg-zone-stat-card">
            <span className="gg-zone-stat-icon">💨</span>
            <div>
              <div className="gg-zone-stat-value">{historyStats.highWind}</div>
              <div className="gg-zone-stat-label">High wind</div>
            </div>
          </div>
          <div className="gg-zone-stat-card">
            <span className="gg-zone-stat-icon">⛈️</span>
            <div>
              <div className="gg-zone-stat-value">{historyStats.thunderstorm}</div>
              <div className="gg-zone-stat-label">Thunderstorm</div>
            </div>
          </div>
        </div>
        {historyStats.derecho && (
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-[var(--risk-high)]/30 bg-[var(--risk-high)]/10 px-3 py-2">
            <span className="text-base">🌀</span>
            <span className="text-xs font-medium text-[var(--risk-high)]">
              Derecho exposure zone
            </span>
          </div>
        )}

        {/* Factor breakdown */}
        <h3 className="mt-6 mb-3 text-[10px] uppercase tracking-[0.22em] text-[var(--muted)]">
          Factor breakdown
        </h3>
        <FactorBreakdown factors={zone.factors} />

        {/* Cities in zone */}
        {citiesInZone.length > 0 && (
          <>
            <h3 className="mt-6 mb-3 text-[10px] uppercase tracking-[0.22em] text-[var(--muted)]">
              Monitored cities in zone
              <span className="ml-1 font-mono text-[var(--paper-dim)]">
                · {citiesInZone.length.toString().padStart(2, '0')}
              </span>
            </h3>
            <div className="flex flex-col gap-2">
              {citiesInZone.map((city) => (
                <div
                  key={city.name}
                  className="gg-card flex items-center justify-between px-4 py-3"
                >
                  <div>
                    <span className="text-sm font-medium text-[var(--paper)]">
                      {city.label}
                    </span>
                    <span className="ml-2 font-mono text-xs text-[var(--muted)]">
                      {city.risk_score.toFixed(2)}
                    </span>
                  </div>
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em]"
                    style={{
                      borderColor: TIER_COLOR[city.risk_tier],
                      color: TIER_COLOR[city.risk_tier],
                    }}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{
                        backgroundColor: TIER_COLOR[city.risk_tier],
                        boxShadow: `0 0 8px ${TIER_COLOR[city.risk_tier]}`,
                      }}
                    />
                    {city.risk_tier}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Briefing */}
        <h3 className="mt-6 mb-3 text-[10px] uppercase tracking-[0.22em] text-[var(--muted)]">
          Zone briefing
        </h3>
        {briefing ? (
          <BriefingReport
            briefing={briefing.text}
            location={zone.zone_label}
            tier={zone.risk_tier}
            score={zone.risk_score}
            generatedAt={new Date().toISOString()}
            source={briefing.source as 'gemini' | 'local'}
          />
        ) : (
          <button
            type="button"
            onClick={onRequestBriefing}
            disabled={briefingLoading}
            className="gg-btn gg-btn-signal w-full justify-center"
          >
            {briefingLoading ? (
              <>
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-[var(--signal)] border-t-transparent" />
                Generating briefing…
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 3v18M3 12h18" strokeLinecap="round" />
                </svg>
                Generate zone briefing
              </>
            )}
          </button>
        )}

        <p className="mt-6 text-[11px] leading-relaxed text-[var(--muted)]">
          Zone-level risk aggregates wind, canopy, flood, outage history, and
          historical severe weather data across the H3 hex region. Individual
          city scores may differ from zone-level risk.
        </p>
      </div>
    </aside>
  );
}
