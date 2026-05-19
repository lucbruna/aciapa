import { createContext, useContext, useState, ReactNode } from "react";

const DARK = {
  bg: "#020408", surface: "#060b14", card: "#0a1020", card2: "#0f1830",
  border: "rgba(255,255,255,0.07)", border2: "rgba(255,255,255,0.13)",
  indigo: "#6366f1", indigoDim: "rgba(99,102,241,0.12)", indigoBorder: "rgba(99,102,241,0.3)",
  purple: "#8b5cf6", purpleDim: "rgba(139,92,246,0.12)",
  cyan: "#06b6d4",   cyanDim: "rgba(6,182,212,0.12)",
  green: "#22c55e",  greenDim: "rgba(34,197,94,0.12)",
  red: "#f43f5e",    redDim: "rgba(244,63,94,0.12)",
  amber: "#f59e0b",  amberDim: "rgba(245,158,11,0.12)",
  text: "#f1f5f9",   sub: "#94a3b8",  muted: "#475569",
};

const LIGHT = {
  bg: "#f8fafc", surface: "#f1f5f9", card: "#ffffff", card2: "#f8fafc",
  border: "rgba(0,0,0,0.08)", border2: "rgba(0,0,0,0.15)",
  indigo: "#4f46e5", indigoDim: "rgba(79,70,229,0.1)", indigoBorder: "rgba(79,70,229,0.25)",
  purple: "#7c3aed", purpleDim: "rgba(124,58,237,0.1)",
  cyan: "#0891b2",   cyanDim: "rgba(8,145,178,0.1)",
  green: "#16a34a",  greenDim: "rgba(22,163,74,0.1)",
  red: "#dc2626",    redDim: "rgba(220,38,38,0.1)",
  amber: "#d97706",  amberDim: "rgba(217,119,6,0.1)",
  text: "#0f172a",   sub: "#475569",  muted: "#94a3b8",
};

interface ThemeColors {
  bg: string; surface: string; card: string; card2: string;
  border: string; border2: string;
  indigo: string; indigoDim: string; indigoBorder: string;
  purple: string; purpleDim: string;
  cyan: string; cyanDim: string;
  green: string; greenDim: string;
  red: string; redDim: string;
  amber: string; amberDim: string;
  text: string; sub: string; muted: string;
}

interface ThemeValue {
  isDark: boolean;
  colors: ThemeColors;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeValue>(null!);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem("aciapa_theme");
    const dark = saved !== "light";
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    return dark;
  });

  const colors = isDark ? DARK : LIGHT;
  const toggleTheme = () => {
    const next = !isDark;
    document.documentElement.setAttribute("data-theme", next ? "dark" : "light");
    localStorage.setItem("aciapa_theme", next ? "dark" : "light");
    setIsDark(next);
  };

  return (
    <ThemeContext.Provider value={{ isDark, colors, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
