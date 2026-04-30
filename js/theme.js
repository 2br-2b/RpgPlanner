// ═══════════════════════════════════════════════════════════════════════════════
// THEMES
// ═══════════════════════════════════════════════════════════════════════════════
const THEMES = {
  tactical: {
    label: "Tactical",
    font: "'Courier New', monospace",
    bg: "#0d1a0d", surface: "#111f11", surface2: "#162616",
    border: "#1e3a1e", accent: "#4a9a3a", accentDim: "#2a5a2a",
    accentBright: "#6dbb5a", text: "#c8ddb8", textDim: "#6a8a6a",
    textMuted: "#3a5a3a", danger: "#9a3a3a", warn: "#8a7a2a",
    tag: "#1a3a2a", tagText: "#7abf7a", tagBorder: "#2a5a3a", radius: 3,
  },
  industrial: {
    label: "Industrial",
    font: "'Courier New', monospace",
    bg: "#111111", surface: "#1a1a1a", surface2: "#222222",
    border: "#333333", accent: "#c47a20", accentDim: "#7a4a10",
    accentBright: "#e8993a", text: "#d4c4a8", textDim: "#7a6a58",
    textMuted: "#3a3028", danger: "#8a2a2a", warn: "#7a6a1a",
    tag: "#2a1e0e", tagText: "#c47a20", tagBorder: "#5a3a10", radius: 2,
  },
  cyber: {
    label: "Cyber",
    font: "'Courier New', monospace",
    bg: "#020b18", surface: "#050f20", surface2: "#081428",
    border: "#0a3060", accent: "#00b4ff", accentDim: "#005a80",
    accentBright: "#40d4ff", text: "#a0d8f8", textDim: "#3a6888",
    textMuted: "#0a2840", danger: "#ff3a5a", warn: "#ffaa00",
    tag: "#001828", tagText: "#00b4ff", tagBorder: "#004878", radius: 0,
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
  },
  bloodmoon: {
    label: "Blood Moon",
    font: "'Courier New', monospace",
    bg: "#0f0505", surface: "#180808", surface2: "#1f0a0a",
    border: "#3a1010", accent: "#c03030", accentDim: "#601818",
    accentBright: "#e05050", text: "#e0b8b8", textDim: "#804040",
    textMuted: "#401818", danger: "#c03030", warn: "#c07020",
    tag: "#200808", tagText: "#e05050", tagBorder: "#601818", radius: 3,
  },
};

const ThemeCtx = createContext(THEMES.tactical);
const useTheme = () => useContext(ThemeCtx);

function useIsMobile() {
  const [mobile, setMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < 640);
  useEffect(() => {
    const h = () => setMobile(window.innerWidth < 640);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return mobile;
}

function makeCSS(T) {
  return {
    app: { fontFamily: T.font, background: T.bg, color: T.text, minHeight: "100vh", display: "flex", flexDirection: "column" },
    topbar: { background: T.surface, borderBottom: `1px solid ${T.border}`, padding: "0 16px", display: "flex", alignItems: "center", gap: 10, height: 48, flexShrink: 0 },
    body: { display: "flex", flex: 1, overflow: "hidden" },
    sidebar: { width: 240, background: T.surface, borderRight: `1px solid ${T.border}`, display: "flex", flexDirection: "column", overflow: "hidden", flexShrink: 0 },
    main: { flex: 1, overflow: "auto", padding: 24 },
    btn: (v = "default") => ({
      background: v === "primary" ? T.accent : v === "danger" ? T.danger : T.surface2,
      color: v === "primary" && (T.label === "Material Light") ? "#fff" : T.text,
      border: `1px solid ${v === "primary" ? T.accentDim : T.border}`,
      borderRadius: T.radius, padding: "4px 10px", cursor: "pointer",
      fontFamily: T.font, fontSize: 12, transition: "all 0.15s",
    }),
    input: { background: T.surface2, border: `1px solid ${T.border}`, borderRadius: T.radius, color: T.text, padding: "5px 8px", fontFamily: T.font, fontSize: 13, outline: "none", width: "100%" },
    textarea: { background: T.surface2, border: `1px solid ${T.border}`, borderRadius: T.radius, color: T.text, padding: "8px", fontFamily: "'Courier New', monospace", fontSize: 12, outline: "none", width: "100%", resize: "vertical", lineHeight: 1.6 },
    label: { fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4, display: "block" },
    section: { background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: 16, marginBottom: 16 },
    tag: { background: T.tag, color: T.tagText, border: `1px solid ${T.tagBorder}`, borderRadius: T.radius, padding: "1px 7px", fontSize: 10, letterSpacing: "0.05em", textTransform: "uppercase" },
  };
}
