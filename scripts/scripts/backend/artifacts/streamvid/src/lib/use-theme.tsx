import { createContext, useContext, useEffect, useState } from "react";

export type ThemeId =
  | "default"
  | "midnight"
  | "crimson"
  | "ocean"
  | "forest"
  | "rose"
  | "gold"
  | "light";

export interface ThemeDef {
  id: ThemeId;
  label: string;
  primary: string;
  bg: string;
  isLight?: boolean;
}

export const THEMES: ThemeDef[] = [
  { id: "default",  label: "Mor Karanlık",  primary: "#9333ea", bg: "#050505" },
  { id: "midnight", label: "Gece Mavisi",   primary: "#3b82f6", bg: "#060d1a" },
  { id: "crimson",  label: "Kızıl",         primary: "#ef4444", bg: "#0a0303" },
  { id: "ocean",    label: "Okyanus",       primary: "#06b6d4", bg: "#030d10" },
  { id: "forest",   label: "Orman",         primary: "#22c55e", bg: "#030a05" },
  { id: "rose",     label: "Pembe",         primary: "#ec4899", bg: "#0a0306" },
  { id: "gold",     label: "Altın",         primary: "#f59e0b", bg: "#080601" },
  { id: "light",    label: "Aydınlık",      primary: "#7c3aed", bg: "#ffffff", isLight: true },
];

const STORAGE_KEY = "prnhbbbb_theme";

interface ThemeCtx { theme: ThemeId; setTheme: (t: ThemeId) => void; themes: ThemeDef[] }
const ThemeContext = createContext<ThemeCtx>({ theme: "default", setTheme: () => {}, themes: THEMES });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as ThemeId | null;
    if (saved && THEMES.find(t => t.id === saved)) return saved;
    return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "default";
  });

  const setTheme = (t: ThemeId) => {
    setThemeState(t);
    localStorage.setItem(STORAGE_KEY, t);
  };

  useEffect(() => {
    const html = document.documentElement;
    THEMES.forEach(t => html.removeAttribute(`data-theme-${t.id}`));
    html.setAttribute("data-theme", theme);
    if (theme === "light") {
      html.classList.remove("dark");
      document.body.style.colorScheme = "light";
    } else {
      html.classList.add("dark");
      document.body.style.colorScheme = "dark";
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() { return useContext(ThemeContext); }
