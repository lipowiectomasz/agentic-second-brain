"use client";

import { useSyncExternalStore } from "react";
import type { ThemePreference } from "@/lib/theme";
import { parseThemeCookie, themeCookieName, themePreferences } from "@/lib/theme";

const labels: Record<ThemePreference, string> = { system: "System", light: "Light", dark: "Dark" };

function readPreference(): ThemePreference {
  const match = document.cookie.match(new RegExp(`(?:^|; )${themeCookieName}=([^;]*)`));
  return parseThemeCookie(match?.[1]);
}

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function apply(preference: ThemePreference) {
  if (preference === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = preference;
  document.cookie = `${themeCookieName}=${preference}; Path=/; Max-Age=31536000; SameSite=Lax`;
  for (const listener of listeners) listener();
}

export function ThemeToggle() {
  const preference = useSyncExternalStore(subscribe, readPreference, () => "system");
  return (
    <div className="seg" role="radiogroup" aria-label="Theme">
      {themePreferences.map((option) => (
        <button key={option} type="button" role="radio" aria-checked={preference === option} onClick={() => apply(option)}>
          {labels[option]}
        </button>
      ))}
    </div>
  );
}
