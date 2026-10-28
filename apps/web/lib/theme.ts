export const themePreferences = ["system", "light", "dark"] as const;

export type ThemePreference = (typeof themePreferences)[number];

export const themeCookieName = "cortex-theme";

export function parseThemeCookie(value: string | undefined | null): ThemePreference {
  return themePreferences.find((preference) => preference === value) ?? "system";
}

export function resolveTheme(preference: ThemePreference, systemPrefersDark: boolean): "light" | "dark" {
  if (preference === "system") return systemPrefersDark ? "dark" : "light";
  return preference;
}

export const themeBootScript = `(function(){try{var m=document.cookie.match(/(?:^|; )${themeCookieName}=(light|dark)/);if(m){document.documentElement.dataset.theme=m[1];}}catch(e){}})();`;
