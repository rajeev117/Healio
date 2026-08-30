"use client";

import { useSyncExternalStore } from "react";

type Theme = "light" | "dark";
const KEY = "healio-theme";
const EVENT = "healio-themechange";

/**
 * The resolved theme lives outside React — it is an attribute on <html>, backed
 * by localStorage and falling back to the OS preference. `useSyncExternalStore`
 * subscribes to that rather than mirroring it into state, so there is no
 * setState-in-effect and no hydration mismatch: the server snapshot is `null`
 * (unknowable) and the real value arrives on the client.
 */
function subscribe(onChange: () => void) {
  const mq = window.matchMedia("(prefers-color-scheme: light)");
  mq.addEventListener("change", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    mq.removeEventListener("change", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

function getSnapshot(): Theme {
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr === "light" || attr === "dark") return attr;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function getServerSnapshot(): Theme | null {
  return null;
}

export default function ThemeToggle({ className = "" }: { className?: string }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggle = () => {
    const next: Theme = getSnapshot() === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* private mode — the choice just won't persist */
    }
    window.dispatchEvent(new Event(EVENT));
  };

  const label =
    theme === null ? "Switch theme" : `Switch to ${theme === "dark" ? "light" : "dark"} mode`;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className={`glass-pill relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors duration-[var(--dur-quick)] hover:bg-[var(--glass-04)] ${className}`}
    >
      {/* Both icons are always mounted and cross-faded, so the control never
          reflows. Before hydration neither is shown, which keeps the server and
          client markup identical. */}
      <Sun
        className={`absolute transition-all duration-[var(--dur-base)] [transition-timing-function:var(--ease-standard)] ${
          theme === "dark" ? "scale-100 opacity-100" : "scale-75 opacity-0"
        }`}
      />
      <Moon
        className={`absolute transition-all duration-[var(--dur-base)] [transition-timing-function:var(--ease-standard)] ${
          theme === "light" ? "scale-100 opacity-100" : "scale-75 opacity-0"
        }`}
      />
    </button>
  );
}

function Sun({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" width="17" height="17" fill="none" aria-hidden="true" className={className}>
      <circle cx="10" cy="10" r="3.9" stroke="currentColor" strokeWidth="1.3" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
        <line
          key={deg}
          x1="10"
          y1="1.6"
          x2="10"
          y2="3.6"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
          transform={`rotate(${deg} 10 10)`}
        />
      ))}
    </svg>
  );
}

function Moon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" width="17" height="17" fill="none" aria-hidden="true" className={className}>
      <path
        d="M16.2 12.4A6.8 6.8 0 0 1 7.6 3.8a6.9 6.9 0 1 0 8.6 8.6Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}
