import { getSocket as getApiSocket } from "./lib/api.js";

const DARK = {
  bg:"#020408", surface:"#060b14", card:"#0a1020", card2:"#0f1830",
  border:"rgba(255,255,255,0.07)", border2:"rgba(255,255,255,0.13)",
  indigo:"#6366f1", indigoDim:"rgba(99,102,241,0.12)", indigoBorder:"rgba(99,102,241,0.3)",
  purple:"#8b5cf6", purpleDim:"rgba(139,92,246,0.12)",
  cyan:"#06b6d4",   cyanDim:"rgba(6,182,212,0.12)",
  green:"#22c55e",  greenDim:"rgba(34,197,94,0.12)",
  red:"#f43f5e",    redDim:"rgba(244,63,94,0.12)",
  amber:"#f59e0b",  amberDim:"rgba(245,158,11,0.12)",
  text:"#f1f5f9",   sub:"#94a3b8",  muted:"#475569",
};

const DASH = (k: string) => DARK[k] || "";
function getCSSVar(name: string): string {
  if (typeof document === "undefined") return DASH(name);
  return getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim() || DASH(name);
}

export const C = new Proxy(DARK, {
  get(_, prop: string) {
    const v = getCSSVar(prop);
    return v || Reflect.get(DARK, prop);
  },
}) as typeof DARK;

export const socket = new Proxy({} as ReturnType<typeof getApiSocket>, {
  get(_, prop) {
    const s = getApiSocket();
    const v = (s as any)[prop as string];
    return typeof v === "function" ? v.bind(s) : v;
  },
  set(_, prop, val) {
    const s = getApiSocket();
    (s as any)[prop as string] = val;
    return true;
  },
});
export const fmt = v => new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(v||0);
export const fmtN = v => new Intl.NumberFormat("pt-BR").format(v||0);
