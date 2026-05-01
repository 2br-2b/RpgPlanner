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
    bg: "#121f12", surface: "#182818", surface2: "#1f321f",
    border: "#2d5230", accent: "#5cb84a", accentDim: "#2e6228",
    accentBright: "#82d46e", text: "#d4e8c2", textDim: "#7ea87e",
    textMuted: "#3d5c3d", danger: "#b84848", warn: "#a09038",
    tag: "#1e3e28", tagText: "#82cc82", tagBorder: "#2e6238", radius: 3,
  },
  industrial: {
    label: "Industrial",
    font: "'Courier New', monospace",
    bg: "#141510",
    surface: "#1c1e16",
    surface2: "#25271e",
    border: "#58582e",
    accent: "#de9628",
    accentDim: "#8a5a18",
    accentBright: "#ffc040",
    text: "#e8d8b0",
    textDim: "#9e8e5a",
    textMuted: "#48462a",
    danger: "#c43030",
    warn: "#c09800",
    tag: "#302c14",
    tagText: "#de9628",
    tagBorder: "#685828",
    radius: 2,
    skeuomorphic: true,
    rivetColor: "#6a6838",
    hexStroke: "rgba(200,170,70,0.18)",
    skPrimaryHighlight: "#ffd460",
    skPrimaryText: "#1a0e00",
  },
  cyber: {
    label: "Cyber",
    font: "'Courier New', monospace",
    bg: "#06111e", surface: "#0a1828", surface2: "#0e2038",
    border: "#1a4878", accent: "#18c4ff", accentDim: "#0870a0",
    accentBright: "#60deff", text: "#b0e0f8", textDim: "#4c7a9a",
    textMuted: "#162e48", danger: "#ff5070", warn: "#ffbe18",
    tag: "#081e30", tagText: "#18c4ff", tagBorder: "#1a5a90", radius: 0,
  },
  materialLight: {
    label: "Material Light",
    font: "'Segoe UI', system-ui, sans-serif",
    bg: "#f0f2f5", surface: "#ffffff", surface2: "#e8eaed",
    border: "#c8cdd6", accent: "#1a7fd4", accentDim: "#cce3f8",
    accentBright: "#1461a8", text: "#1a1f2e", textDim: "#5a6475",
    textMuted: "#b0b8c4", danger: "#c62828", warn: "#e06500",
    tag: "#ddeeff", tagText: "#1461a8", tagBorder: "#80b8f0", radius: 6,
  },
  materialDark: {
    label: "Material Dark",
    font: "'Segoe UI', system-ui, sans-serif",
    bg: "#1c1c1c", surface: "#252525", surface2: "#303030",
    border: "#484848", accent: "#7ab8f8", accentDim: "#254068",
    accentBright: "#b0d4ff", text: "#e8e8e8", textDim: "#909090",
    textMuted: "#484848", danger: "#f08080", warn: "#ffcc70",
    tag: "#1c3050", tagText: "#7ab8f8", tagBorder: "#2c4870", radius: 6,
  },
  parchment: {
    label: "Parchment",
    font: "'Georgia', serif",
    bg: "#f0e8d2", surface: "#faf4e2", surface2: "#e8e0cc",
    border: "#c0a87a", accent: "#8a5522", accentDim: "#d4a870",
    accentBright: "#6a3c18", text: "#2e1e0a", textDim: "#7a6040",
    textMuted: "#c0a87a", danger: "#9a3020", warn: "#8a7210",
    tag: "#e0cca0", tagText: "#5a3418", tagBorder: "#b08848", radius: 3,
  },
  noir: {
    label: "Noir",
    font: "'Times New Roman', serif",
    bg: "#161616", surface: "#1e1e1e", surface2: "#282828",
    border: "#3a3a3a", accent: "#d8d8d8", accentDim: "#606060",
    accentBright: "#f8f8f8", text: "#d0d0d0", textDim: "#787878",
    textMuted: "#404040", danger: "#c05050", warn: "#c0a848",
    tag: "#242424", tagText: "#d0d0d0", tagBorder: "#505050", radius: 0,
  },
  bloodmoon: {
    label: "Blood Moon",
    font: "'Courier New', monospace",
    bg: "#160808", surface: "#200c0c", surface2: "#2a1010",
    border: "#501818", accent: "#d04040", accentDim: "#781c1c",
    accentBright: "#e86868", text: "#ecc8c8", textDim: "#9a5858",
    textMuted: "#501c1c", danger: "#d04040", warn: "#cc8030",
    tag: "#280a0a", tagText: "#e86868", tagBorder: "#781c1c", radius: 3,
  },
  chalkboard: {
    label: "Chalkboard",
    font: "'Courier New', monospace",
    bg: "#2a3a2a", surface: "#324232", surface2: "#3c4e3c",
    border: "#586858", accent: "#f0e870", accentDim: "#b0a838",
    accentBright: "#fffaaa", text: "#eef0e0", textDim: "#a8b090",
    textMuted: "#587058", danger: "#e86060", warn: "#ecc048",
    tag: "#1e2e1e", tagText: "#eef0e0", tagBorder: "#587058", radius: 0,
  },
  corkboard: {
    label: "Corkboard",
    font: "'Georgia', serif",
    bg: "#b8803a", surface: "#fefef8", surface2: "#f2eee4",
    border: "#bca878", accent: "#b82828", accentDim: "#7a1818",
    accentBright: "#d84040", text: "#1c1208", textDim: "#6a5030",
    textMuted: "#c0a070", danger: "#b82828", warn: "#b86820",
    tag: "#e8e0d0", tagText: "#3a2010", tagBorder: "#c0a880", radius: 2,
  },
  newspaper: {
    label: "Newspaper",
    font: "'Times New Roman', serif",
    bg: "#ede4c8", surface: "#f8f2e0", surface2: "#e8dfc4",
    border: "#383020", accent: "#b81010", accentDim: "#780000",
    accentBright: "#980000", text: "#181410", textDim: "#504840",
    textMuted: "#908870", danger: "#b81010", warn: "#bb7000",
    tag: "#181410", tagText: "#f8f2e0", tagBorder: "#383020", radius: 0,
  },
  blueprint: {
    label: "Blueprint",
    font: "'Courier New', monospace",
    bg: "#0e2440", surface: "#122c50", surface2: "#18385e",
    border: "#3a78c0", accent: "#70c0ff", accentDim: "#245a98",
    accentBright: "#a8d8ff", text: "#d8eeff", textDim: "#6898cc",
    textMuted: "#2a4870", danger: "#ff7070", warn: "#ffcc50",
    tag: "#0e2030", tagText: "#70c0ff", tagBorder: "#3a78c0", radius: 0,
  },
  battletech: {
    label: "American Mecha",
    font: "'Courier New', monospace",
    bg: "#161208", surface: "#201a0e", surface2: "#2a2416",
    border: "#8a6e20", accent: "#d8a830", accentDim: "#6a4810",
    accentBright: "#f0d060", text: "#e0d4b0", textDim: "#8a7a48",
    textMuted: "#48401e", danger: "#c03822", warn: "#c08818",
    tag: "#221a08", tagText: "#d8a830", tagBorder: "#685018", radius: 0,
    skeuomorphic: true,
    skDark: "#0e0c06",
    rivetColor: "#7a6018",
    hexStroke: "rgba(200,160,50,0.14)",
    skPrimaryHighlight: "#f8e070",
    skPrimaryText: "#1a0e00",
    skScanLine: "rgba(0,0,0,0.05)",
    skInsetShadow: "inset 0 2px 6px rgba(0,0,0,0.7)",
  },
};

export const ThemeCtx = createContext(THEMES.tactical);
export const useTheme = () => useContext(ThemeCtx);
export function useThemeCSS() {
  const T = useTheme();
  return { T, css: makeCSS(T) };
}

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
