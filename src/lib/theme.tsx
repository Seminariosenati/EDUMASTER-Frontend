import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type Theme = "dark" | "light";
const KEY = "edumaster.theme";

function initialTheme(): Theme {
  const set = document.documentElement.dataset.theme;
  if (set === "light" || set === "dark") return set;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

const ThemeContext = createContext<{ theme: Theme; setTheme: (t: Theme) => void } | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(initialTheme);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    try {
      localStorage.setItem(KEY, t);
    } catch {
      /* sin almacenamiento: el tema vale solo para esta pestaña */
    }
  }, []);
  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme fuera de ThemeProvider");
  return ctx;
}

/** Lee los colores actuales del tema para dibujar en canvas. */
export function themeColor(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim();
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <div role="group" aria-label="Tema" className="flex overflow-hidden rounded-[10px] border border-line text-xs font-semibold">
      {(["dark", "light"] as Theme[]).map((t) => (
        <button key={t} type="button" aria-pressed={theme === t} onClick={() => setTheme(t)}
          className={`px-3 py-2 ${theme === t ? "bg-blue text-white" : "text-muted hover:text-ink"}`}>
          {t === "dark" ? "Oscuro" : "Claro"}
        </button>
      ))}
    </div>
  );
}
