export const THEME_STORAGE_KEY = "honic-theme";

export type ThemePreference = "light" | "dark" | "system";

export function isThemePreference(value: string | null | undefined): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

/** Resolve stored preference against the OS setting. */
export function resolvedTheme(preference: ThemePreference, systemDark: boolean): "light" | "dark" {
  if (preference === "light") return "light";
  if (preference === "dark") return "dark";
  return systemDark ? "dark" : "light";
}

export function applyThemePreference(preference: ThemePreference) {
  if (typeof document === "undefined") return;
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const resolved = resolvedTheme(preference, systemDark);
  document.documentElement.classList.toggle("dark", resolved === "dark");
  document.documentElement.dataset.theme = preference;
  document.documentElement.style.colorScheme = resolved;
}

/** Inline boot script: set `.dark` before paint to avoid a flash. */
export const THEME_BOOT_SCRIPT = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var t=localStorage.getItem(k);if(t!=="light"&&t!=="dark"&&t!=="system")t="system";var d=t==="dark"||(t!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;r.classList.toggle("dark",d);r.dataset.theme=t;r.style.colorScheme=d?"dark":"light";}catch(e){}})();`;
