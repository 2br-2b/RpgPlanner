import { useThemeCSS } from "./theme.js";

function waypointLabel(i) {
  const alpha = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  if (i < 26) return alpha[i];
  let s = "";
  let n = i;
  while (n >= 0) {
    s = alpha[n % 26] + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

function waypointLabels(count) {
  return Array.from({ length: count }, (_, i) => waypointLabel(i));
}

// Exported so MissionSection can use it to derive the last label for display.
export { waypointLabel };

export function WaypointsSection({ sec, sectionData, onChange, showVisibility }) {
  const { T, css } = useThemeCSS();
  const raw = (typeof sectionData === "object" && sectionData !== null && !Array.isArray(sectionData)) ? sectionData : {};
  const count = Math.min(702, Math.max(0, raw.count != null ? Number(raw.count) : 1));
  const waypoints = raw.waypoints || {};
  const waypointVisibility = raw.waypointVisibility || {};

  const toggleVisibility = (label) => {
    // Default absent = visible; toggle to explicit false then back to absent (= visible)
    const current = waypointVisibility[label];
    if (current === false) {
      // Remove the key (back to default visible)
      const { [label]: _, ...rest } = waypointVisibility;
      onChange("__waypoints_vis__" + label, undefined);
      // Use a sentinel: undefined means remove the key
      const newVis = { ...waypointVisibility };
      delete newVis[label];
      onChange("__waypoints_vis_obj__", newVis);
    } else {
      onChange("__waypoints_vis__" + label, false);
    }
  };

  return (
    <div className="sk-section" style={{ ...css.section, marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <span style={{ color: T.accentBright, fontWeight: "bold", fontSize: 13, letterSpacing: "0.1em" }}>{sec.name.toUpperCase()}</span>
        <span style={{ fontSize: 11, color: T.textDim }}>Waypoints:</span>
        <input type="number" min="0" max="702" style={{ ...css.input, width: 56, fontSize: 12 }}
          value={count} onChange={e => onChange("__waypoints_count__", Math.min(702, Math.max(0, Number(e.target.value) || 0)))} />
        {count > 0 && <span style={{ fontSize: 10, color: T.textMuted }}>A–{waypointLabel(count - 1)}</span>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
        {waypointLabels(count).map(label => {
          const isVisible = waypointVisibility[label] !== false;
          return (
            <div key={label} style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: 10, display: "flex", flexDirection: "column", gap: 6, opacity: (!showVisibility || isVisible) ? 1 : 0.5 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ ...css.tag, alignSelf: "flex-start" }}>{label}</span>
                {showVisibility && (
                  <span style={{ fontSize: 11, cursor: "pointer", marginLeft: "auto", color: isVisible ? T.accent : T.textMuted, userSelect: "none" }}
                    title={isVisible ? "Visible to players — click to hide" : "Hidden from players — click to show"}
                    onClick={() => toggleVisibility(label)}>
                    {isVisible ? "👁" : "🚫"}
                  </span>
                )}
              </div>
              <textarea style={{ ...css.textarea, minHeight: 80, resize: "vertical" }}
                placeholder={`Waypoint ${label}: Do…`}
                value={waypoints[label] || ""}
                onChange={e => onChange("__waypoints_wp__" + label, e.target.value)} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
