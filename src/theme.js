import { createContext, useContext, useState, useEffect } from "react";

function makeHexBg(strokeColor) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="52" height="90"><polygon points="0,-30 26,-15 26,15 0,30 -26,15 -26,-15" fill="none" stroke="${strokeColor}" stroke-width="0.8"/><polygon points="52,-30 78,-15 78,15 52,30 26,15 26,-15" fill="none" stroke="${strokeColor}" stroke-width="0.8"/><polygon points="0,60 26,75 26,105 0,120 -26,105 -26,75" fill="none" stroke="${strokeColor}" stroke-width="0.8"/><polygon points="52,60 78,75 78,105 52,120 26,105 26,75" fill="none" stroke="${strokeColor}" stroke-width="0.8"/><polygon points="26,15 52,30 52,60 26,75 0,60 0,30" fill="none" stroke="${strokeColor}" stroke-width="0.8"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

function rivetPanel(mainGrad, rivetColor) {
  return [
    `radial-gradient(circle at 10px 10px, ${rivetColor} 3px, transparent 3px)`,
    `radial-gradient(circle at calc(100% - 10px) 10px, ${rivetColor} 3px, transparent 3px)`,
    `radial-gradient(circle at 10px calc(100% - 10px), ${rivetColor} 3px, transparent 3px)`,
    `radial-gradient(circle at calc(100% - 10px) calc(100% - 10px), ${rivetColor} 3px, transparent 3px)`,
    mainGrad,
  ].join(", ");
}

export const THEMES = {
  tactical: {
    label: "Tactical",
    font: "'Courier New', monospace",
    bg: "#0d1a0d", surface: "#111f11", surface2: "#162616",
    border: "#1e3a1e", accent: "#4a9a3a", accentDim: "#2a5a2a",
    accentBright: "#6dbb5a", text: "#c8ddb8", textDim: "#6a8a6a",
    textMuted: "#3a5a3a", danger: "#9a3a3a", warn: "#8a7a2a",
    tag: "#1a3a2a", tagText: "#7abf7a", tagBorder: "#2a5a3a", radius: 3,
    skeuomorphic: true,
    rivetColor: "#2a5c2a",
    hexStroke: "rgba(74,154,58,0.15)",
    skPrimaryHighlight: "#8add6a",
    skPrimaryText: "#051005",
  },
  industrial: {
    label: "Industrial",
    font: "'Courier New', monospace",
    bg: "#0d0e09",
    surface: "#151610",
    surface2: "#1e1f18",
    border: "#4a4a28",
    accent: "#d4891a",
    accentDim: "#7a4e0c",
    accentBright: "#ffaa22",
    text: "#e0d0a0",
    textDim: "#8a7a4a",
    textMuted: "#3a3820",
    danger: "#aa2222",
    warn: "#aa8800",
    tag: "#2a2410",
    tagText: "#d4891a",
    tagBorder: "#5a4a18",
    radius: 2,
    skeuomorphic: true,
    rivetColor: "#5c5c32",
    hexStroke: "rgba(180,150,60,0.16)",
    skPrimaryHighlight: "#ffcc55",
    skPrimaryText: "#1a0e00",
  },
  cyber: {
    label: "Cyber",
    font: "'Courier New', monospace",
    bg: "#020b18", surface: "#050f20", surface2: "#081428",
    border: "#0a3060", accent: "#00b4ff", accentDim: "#005a80",
    accentBright: "#40d4ff", text: "#a0d8f8", textDim: "#3a6888",
    textMuted: "#0a2840", danger: "#ff3a5a", warn: "#ffaa00",
    tag: "#001828", tagText: "#00b4ff", tagBorder: "#004878", radius: 0,
    skeuomorphic: true,
    rivetColor: "#004488",
    hexStroke: "rgba(0,180,255,0.15)",
    skPrimaryHighlight: "#80eaff",
    skPrimaryText: "#001020",
    skScanLine: "rgba(0,180,255,0.03)",
  },
  materialLight: {
    label: "Material Light",
    font: "'Segoe UI', system-ui, sans-serif",
    bg: "#fafafa", surface: "#ffffff", surface2: "#f5f5f5",
    border: "#e0e0e0", accent: "#1976d2", accentDim: "#bbdefb",
    accentBright: "#1565c0", text: "#212121", textDim: "#757575",
    textMuted: "#bdbdbd", danger: "#d32f2f", warn: "#f57c00",
    tag: "#e3f2fd", tagText: "#1565c0", tagBorder: "#90caf9", radius: 4,
  },
  materialDark: {
    label: "Material Dark",
    font: "'Segoe UI', system-ui, sans-serif",
    bg: "#121212", surface: "#1e1e1e", surface2: "#2c2c2c",
    border: "#3a3a3a", accent: "#90caf9", accentDim: "#1e3a5f",
    accentBright: "#bbdefb", text: "#e0e0e0", textDim: "#9e9e9e",
    textMuted: "#424242", danger: "#ef9a9a", warn: "#ffcc80",
    tag: "#1a2a3a", tagText: "#90caf9", tagBorder: "#2a4a6a", radius: 4,
  },
  parchment: {
    label: "Parchment",
    font: "'Georgia', serif",
    bg: "#f5efe0", surface: "#fdf6e3", surface2: "#ede8d5",
    border: "#c8b48a", accent: "#7a4a1a", accentDim: "#c89a6a",
    accentBright: "#5a3010", text: "#3a2810", textDim: "#8a7050",
    textMuted: "#c8b48a", danger: "#8a2a1a", warn: "#7a6a1a",
    tag: "#e8d8b0", tagText: "#5a3010", tagBorder: "#a87840", radius: 2,
  },
  noir: {
    label: "Noir",
    font: "'Times New Roman', serif",
    bg: "#0a0a0a", surface: "#111111", surface2: "#181818",
    border: "#2a2a2a", accent: "#c8c8c8", accentDim: "#505050",
    accentBright: "#ffffff", text: "#c0c0c0", textDim: "#606060",
    textMuted: "#303030", danger: "#aa4444", warn: "#aa9944",
    tag: "#1a1a1a", tagText: "#c0c0c0", tagBorder: "#404040", radius: 0,
    skeuomorphic: true,
    rivetColor: "#484848",
    hexStroke: "rgba(120,120,120,0.10)",
    skPrimaryHighlight: "#e0e0e0",
    skPrimaryText: "#080808",
    skScanLine: "rgba(0,0,0,0.06)",
  },
  bloodmoon: {
    label: "Blood Moon",
    font: "'Courier New', monospace",
    bg: "#0f0505", surface: "#180808", surface2: "#1f0a0a",
    border: "#3a1010", accent: "#c03030", accentDim: "#601818",
    accentBright: "#e05050", text: "#e0b8b8", textDim: "#804040",
    textMuted: "#401818", danger: "#c03030", warn: "#c07020",
    tag: "#200808", tagText: "#e05050", tagBorder: "#601818", radius: 3,
    skeuomorphic: true,
    rivetColor: "#5a1515",
    hexStroke: "rgba(192,48,48,0.14)",
    skPrimaryHighlight: "#e07070",
    skPrimaryText: "#150000",
    skScanLine: "rgba(180,0,0,0.04)",
  },
};

export const ThemeCtx = createContext(THEMES.tactical);
export const useTheme = () => useContext(ThemeCtx);

export function useIsMobile() {
  const [mobile, setMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < 640);
  useEffect(() => {
    const h = () => setMobile(window.innerWidth < 640);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return mobile;
}

export function makeCSS(T) {
  const sk = T.skeuomorphic;
  const skDark = T.skDark || T.bg;
  const rivetColor = T.rivetColor || "#5c5c32";
  const hexBg = sk ? makeHexBg(T.hexStroke || "rgba(180,150,60,0.16)") : undefined;
  const scanLine = T.skScanLine || "rgba(0,0,0,0.04)";
  const insetShadow = T.skInsetShadow || "inset 0 2px 5px rgba(0,0,0,0.7)";
  const primaryHighlight = T.skPrimaryHighlight || T.accentBright;
  const primaryText = T.skPrimaryText || T.bg;

  return {
    app: {
      fontFamily: T.font,
      backgroundColor: T.bg,
      backgroundImage: sk
        ? `repeating-linear-gradient(0deg, transparent, transparent 3px, ${scanLine} 3px, ${scanLine} 4px), ${hexBg}`
        : undefined,
      color: T.text,
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
    },
    topbar: {
      background: sk
        ? `linear-gradient(to bottom, ${T.surface2} 0%, ${T.surface} 100%)`
        : T.surface,
      borderBottom: `${sk ? 2 : 1}px solid ${T.border}`,
      boxShadow: sk
        ? `0 3px 10px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.10)`
        : undefined,
      padding: "0 16px",
      display: "flex",
      alignItems: "center",
      gap: 10,
      height: 48,
      flexShrink: 0,
    },
    body: { display: "flex", flex: 1, overflow: "hidden" },
    sidebar: {
      width: 240,
      background: sk
        ? `linear-gradient(to right, ${skDark} 0%, ${T.surface} 100%)`
        : T.surface,
      borderRight: `${sk ? 2 : 1}px solid ${T.border}`,
      boxShadow: sk
        ? `inset -2px 0 6px rgba(0,0,0,0.4), 2px 0 8px rgba(0,0,0,0.5)`
        : undefined,
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      flexShrink: 0,
    },
    main: { flex: 1, overflow: "auto", padding: 24 },
    btn: (v = "default") => {
      const base = {
        borderRadius: T.radius,
        padding: "4px 10px",
        cursor: "pointer",
        fontFamily: T.font,
        fontSize: 12,
        transition: "all 0.15s",
      };
      if (!sk) return {
        ...base,
        background: v === "primary" ? T.accent : v === "danger" ? T.danger : T.surface2,
        color: v === "primary" && T.label === "Material Light" ? "#fff" : T.text,
        border: `1px solid ${v === "primary" ? T.accentDim : T.border}`,
      };
      if (v === "primary") return {
        ...base,
        background: `linear-gradient(to bottom, ${primaryHighlight} 0%, ${T.accent} 45%, ${T.accentDim} 100%)`,
        color: primaryText,
        border: `1px solid ${T.accentDim}`,
        borderBottom: `1px solid ${skDark}`,
        boxShadow: `0 2px 5px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.2)`,
        textShadow: "0 1px 0 rgba(0,0,0,0.3)",
        fontWeight: "bold",
        letterSpacing: "0.05em",
      };
      if (v === "danger") return {
        ...base,
        background: `linear-gradient(to bottom, #cc4444 0%, ${T.danger} 60%, #6a1212 100%)`,
        color: "#ffe0e0",
        border: `1px solid #6a1212`,
        borderBottom: `1px solid #3a0808`,
        boxShadow: `0 2px 5px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,150,150,0.2)`,
        textShadow: "0 1px 1px rgba(0,0,0,0.5)",
      };
      return {
        ...base,
        background: `linear-gradient(to bottom, ${T.surface2} 0%, ${T.surface} 50%, ${skDark} 100%)`,
        color: T.text,
        border: `1px solid ${T.border}`,
        borderBottom: `1px solid ${skDark}`,
        boxShadow: `0 2px 4px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)`,
      };
    },
    input: sk ? {
      background: skDark,
      border: `1px solid ${T.border}`,
      borderRadius: T.radius,
      color: T.text,
      padding: "5px 8px",
      fontFamily: T.font,
      fontSize: 13,
      outline: "none",
      width: "100%",
      boxShadow: insetShadow,
    } : {
      background: T.surface2,
      border: `1px solid ${T.border}`,
      borderRadius: T.radius,
      color: T.text,
      padding: "5px 8px",
      fontFamily: T.font,
      fontSize: 13,
      outline: "none",
      width: "100%",
    },
    textarea: sk ? {
      background: skDark,
      border: `1px solid ${T.border}`,
      borderRadius: T.radius,
      color: T.text,
      padding: "8px",
      fontFamily: "'Courier New', monospace",
      fontSize: 12,
      outline: "none",
      width: "100%",
      resize: "vertical",
      lineHeight: 1.6,
      boxShadow: insetShadow,
    } : {
      background: T.surface2,
      border: `1px solid ${T.border}`,
      borderRadius: T.radius,
      color: T.text,
      padding: "8px",
      fontFamily: "'Courier New', monospace",
      fontSize: 12,
      outline: "none",
      width: "100%",
      resize: "vertical",
      lineHeight: 1.6,
    },
    label: {
      fontSize: 10,
      color: T.textDim,
      textTransform: "uppercase",
      letterSpacing: "0.1em",
      marginBottom: 4,
      display: "block",
    },
    section: sk ? {
      background: rivetPanel(
        `linear-gradient(160deg, ${skDark} 0%, ${T.surface} 40%, ${skDark} 100%)`,
        rivetColor
      ),
      border: `1px solid ${T.border}`,
      borderRadius: T.radius,
      padding: 16,
      marginBottom: 16,
      boxShadow: "0 4px 12px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.04)",
      position: "relative",
    } : {
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderRadius: T.radius,
      padding: 16,
      marginBottom: 16,
      position: "relative",
    },
    tag: {
      background: T.tag,
      color: T.tagText,
      border: `1px solid ${T.tagBorder}`,
      borderRadius: T.radius,
      padding: "1px 7px",
      fontSize: 10,
      letterSpacing: "0.05em",
      textTransform: "uppercase",
    },
  };
}
