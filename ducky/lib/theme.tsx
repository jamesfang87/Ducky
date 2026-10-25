"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export const THEMES = [
  { id: "light", label: "Light", swatch: ["#F3F4F1", "#0B7A62"] },
  { id: "dark", label: "Dark", swatch: ["#0F1216", "#3FBF9F"] },
  { id: "lofi", label: "Lofi", swatch: ["#1F1A2E", "#F48FB1"] },
  { id: "paper", label: "Paper", swatch: ["#F4ECDC", "#9C5028"] },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];
const KEY = "ducky:theme";

/** Runs before first paint (see layout) so a saved theme never flashes the default. */
export const THEME_SCRIPT = `try{var t=localStorage.getItem("${KEY}");if(t)document.documentElement.setAttribute("data-theme",t)}catch(e){}`;

type Ctx = { theme: ThemeId; setTheme: (t: ThemeId) => void };
const ThemeContext = createContext<Ctx>({ theme: "light", setTheme: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>("light");

  useEffect(() => {
    const cur = document.documentElement.getAttribute("data-theme") as ThemeId | null;
    if (cur && THEMES.some((t) => t.id === cur)) setThemeState(cur);
  }, []);

  const setTheme = useCallback((t: ThemeId) => {
    setThemeState(t);
    document.documentElement.setAttribute("data-theme", t);
    try {
      localStorage.setItem(KEY, t);
    } catch {
      /* storage blocked: the choice just won't persist */
    }
  }, []);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
