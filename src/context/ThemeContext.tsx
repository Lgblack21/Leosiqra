"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type ThemeMode = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "leosiqra-theme";

interface ThemeContextType {
  theme: ThemeMode;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const readStoredTheme = (): ThemeMode => {
  if (typeof window === "undefined") return "system";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
};

const readSystemPrefersDark = (): boolean =>
  typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(() => readStoredTheme());
  const [systemPrefersDark, setSystemPrefersDark] = useState(() => readSystemPrefersDark());

  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e: MediaQueryListEvent) => setSystemPrefersDark(e.matches);
    mql.addEventListener("change", handleChange);
    return () => mql.removeEventListener("change", handleChange);
  }, []);

  const setTheme = (next: ThemeMode) => {
    setThemeState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  };

  const resolvedTheme: ResolvedTheme = theme === "system" ? (systemPrefersDark ? "dark" : "light") : theme;

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
