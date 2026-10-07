"use client";

import dynamic from "next/dynamic";
import { useCallback, useRef } from "react";
import { TopNav } from "@/components/TopNav";

const RiskDashboard = dynamic(() => import("@/components/RiskDashboard"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-[var(--background)]">
      <div className="flex items-center gap-3 rounded-2xl border border-[var(--border-strong)] bg-[var(--overlay)] px-5 py-4 backdrop-blur">
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-[var(--signal)] border-t-transparent" />
        <span className="text-sm text-[var(--paper)]">Loading Ontario risk board…</span>
      </div>
    </div>
  ),
});

export default function Home() {
  const dashboardRef = useRef<HTMLDivElement | null>(null);
  const onJumpToExplore = useCallback(() => {
    dashboardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <div id="top" className="flex h-screen flex-col overflow-hidden bg-[var(--background)]">
      <TopNav onJumpToExplore={onJumpToExplore} />
      <main ref={dashboardRef} className="relative flex-1 overflow-hidden">
        <RiskDashboard />
      </main>
    </div>
  );
}
