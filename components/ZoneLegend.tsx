'use client';

interface ZoneLegendProps {
  visible: boolean;
}

export function ZoneLegend({ visible }: ZoneLegendProps) {
  return (
    <div
      className="gg-zone-legend pointer-events-auto absolute bottom-28 left-4 z-20"
      style={{ opacity: visible ? 1 : 0, pointerEvents: visible ? 'auto' : 'none' }}
    >
      <p className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.22em] text-[var(--muted)]">
        Zone risk
      </p>
      <div
        className="h-2 w-36 rounded-full"
        style={{
          background: 'linear-gradient(90deg, #4a7c59 0%, #8ba585 30%, #d6a878 50%, #e0a458 65%, #b85651 85%, #dd4444 100%)',
        }}
      />
      <div className="mt-1 flex justify-between font-mono text-[9px] text-[var(--paper-dim)]">
        <span>0</span>
        <span>0.40</span>
        <span>0.70</span>
        <span>1.0</span>
      </div>
      <div className="mt-0.5 flex justify-between text-[9px] uppercase tracking-[0.12em] text-[var(--muted)]">
        <span>Low</span>
        <span>Medium</span>
        <span>High</span>
      </div>
    </div>
  );
}
