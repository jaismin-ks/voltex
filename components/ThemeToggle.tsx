"use client";

import { useEffect, useState } from "react";

type Theme = "dark" | "light";

const STORAGE_KEY = "vx-theme";

const THEME_COLOR: Record<Theme, string> = {
  dark: "#101216",
  light: "#F0F2F5",
};

function applyThemeColor(theme: Theme) {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", THEME_COLOR[theme]);
}

function readInitialTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr === "light" || attr === "dark") return attr;
  return "dark";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Reading the DOM-attached theme is a one-shot sync with an external
    // system (the inline boot script writes the data-theme attribute before
    // hydration). This is exactly the kind of setState an effect is for.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    const initial = readInitialTheme();
    setTheme(initial);
    applyThemeColor(initial);
    setMounted(true);
  }, []);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    applyThemeColor(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
    /* Notify any component (e.g. the map) that owns external state and
     * needs to react to a palette flip. */
    window.dispatchEvent(new CustomEvent("vx-theme-change", { detail: next }));
  };

  const next: Theme = theme === "dark" ? "light" : "dark";
  const label = mounted
    ? `Switch to ${next} mode`
    : "Toggle theme";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className="gg-press inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] bg-transparent text-[var(--paper-dim)] hover:border-[var(--border-strong)] hover:text-[var(--paper)]"
    >
      {/* Minimal sun / moon mark. Renders the moon when in light theme
       * (signalling the available action) and the sun when in dark theme. */}
      {mounted && theme === "light" ? (
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 3v1.5M12 19.5V21M3 12h1.5M19.5 12H21M5.6 5.6l1.05 1.05M17.35 17.35l1.05 1.05M5.6 18.4l1.05-1.05M17.35 6.65l1.05-1.05" strokeLinecap="round" />
        </svg>
      )}
    </button>
  );
}
