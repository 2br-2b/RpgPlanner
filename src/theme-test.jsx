import { THEMES, makeCSS } from "./theme.js";

function ThemeCard({ themeKey, theme }) {
  const css = makeCSS(theme);

  return (
    <div data-theme={themeKey} className="sk-app" style={{ ...css.app, minHeight: "unset", border: `2px solid ${theme.border}`, borderRadius: 8, overflow: "hidden", minWidth: 240, flex: "1 1 240px" }}>

      {/* Topbar */}
      <div className="sk-topbar" style={{ ...css.topbar, padding: "0 10px", gap: 6 }}>
        <span style={{ color: theme.accentBright, fontSize: 11 }}>⬡</span>
        <span style={{ fontWeight: "bold", color: theme.accentBright, fontSize: 12, flex: 1 }}>{theme.label}</span>
        <button style={{ ...css.btn(), fontSize: 10, padding: "3px 8px" }}>Default</button>
        <button style={{ ...css.btn("primary"), fontSize: 10, padding: "3px 8px" }}>Selected</button>
      </div>

      {/* Body */}
      <div className="sk-main" style={{ ...css.main, padding: 12, display: "flex", flexDirection: "column", gap: 10, overflow: "unset" }}>

        {/* Section card */}
        <div className="sk-section" style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: theme.radius, padding: "10px 12px" }}>
          <div style={{ fontSize: 9, color: theme.textDim, letterSpacing: "0.08em", marginBottom: 6 }}>OVERVIEW</div>
          <div style={{ fontSize: 12, color: theme.text, lineHeight: 1.5, marginBottom: 8 }}>
            Sample mission briefing text. Players will see this content in the share view.
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
            <span style={{ fontSize: 10, background: theme.tag, color: theme.tagText, border: `1px solid ${theme.tagBorder}`, borderRadius: theme.radius, padding: "2px 7px" }}>attack</span>
            <span style={{ fontSize: 10, background: theme.tag, color: theme.tagText, border: `1px solid ${theme.tagBorder}`, borderRadius: theme.radius, padding: "2px 7px" }}>urban</span>
          </div>
          {/* Section row with remove/delete buttons */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 0", borderTop: `1px solid ${theme.border}` }}>
            <span style={{ fontSize: 11, color: theme.text, flex: 1 }}>Waypoint A</span>
            <button style={{ ...css.btn(), fontSize: 10, padding: "2px 6px" }}>Default</button>
            <button style={{ ...css.btn("danger"), fontSize: 10, padding: "2px 6px" }}>×</button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 0", borderTop: `1px solid ${theme.border}` }}>
            <span style={{ fontSize: 11, color: theme.text, flex: 1 }}>Waypoint B</span>
            <button style={{ ...css.btn(), fontSize: 10, padding: "2px 6px" }}>Default</button>
            <button style={{ ...css.btn("danger"), fontSize: 10, padding: "2px 6px" }}>×</button>
          </div>
        </div>

        {/* All button variants */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <button style={{ ...css.btn("primary"), fontSize: 11 }}>Primary</button>
          <button style={{ ...css.btn(), fontSize: 11 }}>Default</button>
          <button style={{ ...css.btn("danger"), fontSize: 11 }}>Danger</button>
          <button style={{ ...css.btn("danger"), fontSize: 11, padding: "2px 7px" }}>Danger ×</button>
        </div>

        {/* Input */}
        <input readOnly value="Sample input field" style={{ ...css.input, fontSize: 11 }} />

        {/* Stat chips */}
        <div style={{ display: "flex", gap: 6 }}>
          {[["PAGES", "12", theme.accentBright], ["NODES", "8", theme.accent], ["TAGS", "5", theme.textDim]].map(([label, val, color]) => (
            <div key={label} style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: theme.radius, padding: "6px 10px", flex: 1, textAlign: "center" }}>
              <div style={{ fontSize: 9, color: theme.textDim }}>{label}</div>
              <div style={{ fontSize: 15, color, fontWeight: "bold" }}>{val}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ThemeTestPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#111", padding: 24, boxSizing: "border-box" }}>
      <div style={{ marginBottom: 20, display: "flex", alignItems: "baseline", gap: 16 }}>
        <h1 style={{ margin: 0, fontSize: 18, fontFamily: "system-ui", color: "#fff", fontWeight: "bold" }}>Theme Comparison</h1>
        <span style={{ fontSize: 12, color: "#666", fontFamily: "system-ui" }}>{Object.keys(THEMES).length} themes</span>
        <a href="/" style={{ fontSize: 12, color: "#4a9eff", fontFamily: "system-ui", marginLeft: "auto" }}>← Back to app</a>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-start" }}>
        {Object.entries(THEMES).map(([key, theme]) => (
          <ThemeCard key={key} themeKey={key} theme={theme} />
        ))}
      </div>
    </div>
  );
}
