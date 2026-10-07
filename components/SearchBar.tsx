"use client";

import { useEffect, useRef, useState } from "react";

interface SearchBarProps {
  defaultValue?: string;
  loading?: boolean;
  onSubmit: (value: string) => void;
}

const SUGGESTIONS = [
  "Scarborough, Ontario",
  "Mississauga, Ontario",
  "Ottawa, Ontario",
  "Hamilton, Ontario",
  "North Bay, Ontario",
];

export function SearchBar({ defaultValue = "", loading, onSubmit }: SearchBarProps) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const v = value.trim();
    if (!v || loading) return;
    onSubmit(v);
  }

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div
        className="gg-card-strong flex items-center gap-3 px-4 py-2 backdrop-blur-md"
        style={{ boxShadow: "inset 0 1px 0 rgba(241,235,222,0.06)" }}
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden
          className="h-5 w-5 shrink-0 text-[var(--muted)]"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" strokeLinecap="round" />
        </svg>
        <input
          ref={inputRef}
          name="location"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Enter an Ontario address, neighbourhood, or postal code…"
          autoComplete="off"
          spellCheck={false}
          disabled={loading}
          className="flex-1 bg-transparent py-1 text-base text-[var(--paper)] placeholder:text-[var(--muted)] focus:outline-none disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={loading || !value.trim()}
          className="gg-btn gg-btn-primary disabled:opacity-40"
        >
          {loading ? (
            <>
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-black/30 border-t-black" />
              Assessing
            </>
          ) : (
            <>
              Assess risk
              <kbd className="ml-1 hidden rounded bg-black/10 px-1.5 py-0.5 font-mono text-[10px] text-black/60 sm:inline">
                ⏎
              </kbd>
            </>
          )}
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-[var(--muted)]">
        <span className="mr-1">Try</span>
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            disabled={loading}
            onClick={() => {
              setValue(s);
              onSubmit(s);
            }}
            className="gg-press rounded-full border border-[var(--border)] bg-transparent px-2.5 py-0.5 text-[var(--paper-dim)] hover:border-[var(--border-strong)] hover:text-[var(--paper)] disabled:opacity-50"
          >
            {s.replace(", Ontario", "")}
          </button>
        ))}
      </div>
    </form>
  );
}
