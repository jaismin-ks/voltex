"use client";

import Link from "next/link";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

interface TopNavProps {
  onJumpToExplore?: () => void;
}

export function TopNav({ onJumpToExplore }: TopNavProps) {
  return (
    <header className="relative z-30 w-full border-b border-[var(--border)] bg-[var(--background)]/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <a
          href="#top"
          className="gg-press inline-flex items-center gap-3 text-[var(--paper)]"
          aria-label="Voltex home"
        >
          <Logo size={24} withWordmark />
          <span className="hidden text-[10px] uppercase tracking-[0.22em] text-[var(--muted)] sm:inline">
            Storm Risk Intelligence · Ontario
          </span>
        </a>
        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[10px] uppercase tracking-[0.22em] text-[var(--paper-dim)] sm:inline-flex">
            <span
              aria-hidden
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ background: "var(--signal)", boxShadow: "0 0 10px var(--signal)" }}
            />
            live
          </span>
          {onJumpToExplore && (
            <button
              type="button"
              onClick={onJumpToExplore}
              className="gg-press rounded-lg border border-[var(--border)] bg-transparent px-3 py-1.5 text-xs uppercase tracking-[0.16em] text-[var(--paper-dim)] hover:border-[var(--border-strong)] hover:text-[var(--paper)]"
            >
              Map
            </button>
          )}
          <Link
            href="/about"
            className="gg-press rounded-lg border border-[var(--border)] bg-transparent px-3 py-1.5 text-xs uppercase tracking-[0.16em] text-[var(--paper-dim)] hover:border-[var(--border-strong)] hover:text-[var(--paper)]"
          >
            Methodology
          </Link>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
