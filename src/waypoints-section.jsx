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

export function WaypointsSection({ sec, sectionData, onChange }) {
  const { T, css } = useThemeCSS();
  const raw = (typeof sectionData === "object" && sectionData !== null && !Array.isArray(sectionData)) ? sectionData : {};
  const count = Math.min(702, Math.max(1, Number(raw.count) || 1));
  const waypoints = raw.waypoints || {};

  return (
    <div className="sk-section" style={{ ...css.section, marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <span style={{ color: T.accentBright, fontWeight: "bold", fontSize: 13, letterSpacing: "0.1em" }}>{sec.name.toUpperCase()}</span>
        <span style={{ fontSize: 11, color: T.textDim }}>Waypoints:</span>
        <input type="number" min="1" max="702" style={{ ...css.input, width: 56, fontSize: 12 }}
          value={count} onChange={e => onChange("__waypoints_count__", Math.min(702, Math.max(1, Number(e.target.value) || 1)))} />
        <span style={{ fontSize: 10, color: T.textMuted }}>A–{waypointLabel(count - 1)}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
        {waypointLabels(count).map(label => (
          <div key={label} style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: 10, display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ ...css.tag, alignSelf: "flex-start" }}>{label}</span>
            <textarea style={{ ...css.textarea, minHeight: 80, resize: "vertical" }}
              placeholder={`Waypoint ${label}: Do…`}
              value={waypoints[label] || ""}
              onChange={e => onChange("__waypoints_wp__" + label, e.target.value)} />
          </div>
        ))}
      </div>
    </div>
  );
}
