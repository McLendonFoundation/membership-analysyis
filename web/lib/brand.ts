import type { CSSProperties } from "react";

// Official association colors (from "Association Colors 9.14.26", updated 8.24.26).
// primary drives the header, buttons, table headers and charts; accent drives chips, tab underlines and highlights.
// Colors are adjusted automatically so text on or in them stays readable (WCAG AA, 4.5:1).

export type BrandInput = { primary: string; accent: string };
export type Brand = {
  primary: string;     // text-safe: white text on it is at least 4.5:1
  accent: string;      // official accent, for borders, chip backgrounds, underlines
  accentFg: string;    // text color to use on the accent (white or near-black)
  accentInk: string;   // accent darkened so it can be used as text on white
  onPrimary: string;   // a light highlight that reads on the primary
  logo: string | null; // path under /public, shown in the header and report
  logoOnDark: boolean; // true when the logo is made for a dark background (no white plate needed)
};

// Logos live in public/logos. FBS ADA and FCS ADA have none yet.
const LOGOS: Record<string, string> = {
  NACDA: "/logos/nacda-white.png", CABMA: "/logos/cabma.png", CEFMA: "/logos/cefma.png", CCA: "/logos/cca.png",
  DIIADA: "/logos/dii-ada.png", DIIICA: "/logos/diiica.png", IAAAADA: "/logos/iaaa-ada.png", ICLA: "/logos/icla.png",
  MOAA: "/logos/moaa.png", N4A: "/logos/n4a.png", NAAC: "/logos/naac.png", NAADD: "/logos/naadd.png",
  NAATSO: "/logos/naatso.png", NACMA: "/logos/nacma.png", NADIIIAA: "/logos/nadiiiaa.png", NAIAADA: "/logos/naia-ada.png",
  NATYCAA: "/logos/natycaa.png",
};
const ON_DARK = new Set(["NACDA"]);

const NACDA: BrandInput = { primary: "#111111", accent: "#ffb700" };

const COLORS: Record<string, BrandInput> = {
  NACDA,
  CABMA: { primary: "#e31837", accent: "#e31837" },
  CEFMA: { primary: "#b1953a", accent: "#b1953a" },
  FBSADA: { primary: "#919d9d", accent: "#919d9d" },
  FCSADA: { primary: "#00447c", accent: "#fdbb30" },
  IAAAADA: { primary: "#000000", accent: "#f8991d" },
  CCA: { primary: "#111c36", accent: "#5ac0ff" },
  DIIADA: { primary: "#00539f", accent: "#00539f" },
  DIIICA: { primary: "#09202e", accent: "#7a2530" },
  ICLA: { primary: "#00a160", accent: "#00a160" },
  MOAA: { primary: "#ef3e42", accent: "#ef3e42" },
  N4A: { primary: "#023c5b", accent: "#f99d25" },
  NAAC: { primary: "#0047bb", accent: "#a2aaad" },
  NAADD: { primary: "#2a4925", accent: "#68c028" },
  NAATSO: { primary: "#cbb677", accent: "#cbb677" },
  NACMA: { primary: "#2d507d", accent: "#00a1fe" },
  NADIIIAA: { primary: "#334048", accent: "#ba0c2f" },
  NAIAADA: { primary: "#004990", accent: "#e03a3e" },
  NATYCAA: { primary: "#009ac7", accent: "#ed1c24" },
};

// Alternate spellings that show up in the data or the colors sheet.
const ALIASES: Record<string, string> = { D2ADA: "DIIADA", DIICCA: "CCA", IAAA: "IAAAADA", NAIA: "NAIAADA", FOUNDATION: "NACDA" };

const norm = (code?: string | null) => (code ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

function rgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}
function hex([r, g, b]: number[]) {
  return "#" + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
}
function lum(h: string) {
  const [r, g, b] = rgb(h).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a: string, b: string) {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}
/** Darken toward black in small steps until white text (or text on white) reaches the target ratio. */
function darkenFor(h: string, target = 4.5) {
  let c = rgb(h);
  let out = h;
  for (let i = 0; i < 40 && contrast(out, "#ffffff") < target; i++) {
    c = c.map((v) => v * 0.95) as [number, number, number];
    out = hex(c);
  }
  return out;
}

export function brandFor(code?: string | null, override?: Partial<BrandInput> | null): Brand {
  const key = norm(code);
  const id = COLORS[key] ? key : COLORS[ALIASES[key]] ? ALIASES[key] : "NACDA";
  const base = COLORS[id];
  const input = { ...base, ...(override ?? {}) };
  const primary = darkenFor(input.primary);
  const accent = input.accent;
  const accentFg = contrast(accent, "#ffffff") >= contrast(accent, "#111111") ? "#ffffff" : "#111111";
  const accentInk = darkenFor(accent);
  const onPrimary = contrast(accent, primary) >= 3 ? accent : "#ffffff";
  return { primary, accent, accentFg, accentInk, onPrimary, logo: LOGOS[id] ?? null, logoOnDark: ON_DARK.has(id) };
}

/** CSS variables for a wrapper element. Every class in globals.css reads these. */
export function brandVars(b: Brand): CSSProperties {
  return {
    ["--navy" as any]: b.primary,
    ["--accent" as any]: b.accent,
    ["--accent-fg" as any]: b.accentFg,
    ["--accent-ink" as any]: b.accentInk,
    ["--on-navy" as any]: b.onPrimary,
  };
}
