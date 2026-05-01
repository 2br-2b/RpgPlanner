import { useState } from "react";
import { useThemeCSS } from "./theme.js";
import { uid } from "./storage.js";
import { FORMULA_HELP } from "./formula.js";

export function SchemaEditor({ campaign, onUpdate }) {
  const { T, css } = useThemeCSS();
  const add = () => onUpdate(c => ({ ...c, sectionSchema: [...c.sectionSchema, { id: uid(), name: "New Section", type: "text", subheaders: [] }] }));
  const upd = (id, f, v) => onUpdate(c => ({ ...c, sectionSchema: c.sectionSchema.map(s => s.id === id ? { ...s, [f]: v } : s) }));
  const renameSubheader = (sectionId, oldName, newName) => onUpdate(c => {
    const newSchema = c.sectionSchema.map(s =>
      s.id === sectionId ? { ...s, subheaders: (s.subheaders || []).map(sh => sh === oldName ? newName : sh) } : s
    );
    const newPages = (c.pages || []).map(p => {
      const sData = p.sections?.[sectionId];
      if (!sData || typeof sData !== "object" || Array.isArray(sData) || !(oldName in sData)) return p;
      const { [oldName]: val, ...rest } = sData;
      return { ...p, sections: { ...p.sections, [sectionId]: { ...rest, [newName]: val } } };
    });
    return { ...c, sectionSchema: newSchema, pages: newPages };
  });
  const del = (id) => onUpdate(c => ({ ...c, sectionSchema: c.sectionSchema.filter(s => s.id !== id) }));
  const move = (id, d) => onUpdate(c => {
    const arr = [...c.sectionSchema]; const i = arr.findIndex(s => s.id === id); const j = i + d;
    if (j < 0 || j >= arr.length) return c;
    [arr[i], arr[j]] = [arr[j], arr[i]]; return { ...c, sectionSchema: arr };
  });

  return (
    <div style={{ maxWidth: 640 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <h2 style={{ margin: 0, color: T.accentBright, fontSize: 16, letterSpacing: "0.1em" }}>SECTION SCHEMA</h2>
        <span style={{ fontSize: 11, color: T.textDim }}>— applies to all Mission pages</span>
        <div style={{ flex: 1 }} />
        <button style={css.btn("primary")} onClick={add}>+ Section</button>
      </div>
      <div style={{ marginBottom: 12, padding: 10, background: T.surface2, border: `1px solid ${T.border}`, borderRadius: T.radius, fontSize: 11, color: T.textDim }}>
        Changes here propagate to all mission pages automatically. Existing section content is preserved.
      </div>
      {campaign.sectionSchema.map((sec, i) => <SchemaSectionRow key={sec.id} sec={sec} isFirst={i === 0} isLast={i === campaign.sectionSchema.length - 1} onChange={(f, v) => upd(sec.id, f, v)} onRemove={() => del(sec.id)} onMove={d => move(sec.id, d)} onRenameSubheader={(o, n) => renameSubheader(sec.id, o, n)} />)}
      {campaign.sectionSchema.length === 0 && <div style={{ color: T.textDim, textAlign: "center", padding: 32 }}>No sections defined. Mission pages will be free-form.</div>}
    </div>
  );
}

function SchemaSectionRow({ sec, isFirst, isLast, onChange, onRemove, onMove, onRenameSubheader }) {
  const { T, css } = useThemeCSS();
  const [sub, setSub] = useState("");
  const [newColLabel, setNewColLabel] = useState("");
  const [newColType, setNewColType] = useState("text");
  const secType = sec.type || "text";
  const isWaypoints = secType === "waypoints";
  const isTable = secType === "table";

  const addSub = () => {
    const s = sub.trim();
    if (!s || (sec.subheaders || []).includes(s)) { setSub(""); return; }
    onChange("subheaders", [...(sec.subheaders || []), s]);
    setSub("");
  };

  const moveSub = (idx, direction) => {
    const arr = [...(sec.subheaders || [])];
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= arr.length) return;
    [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
    onChange("subheaders", arr);
  };

  const addColumn = () => {
    const label = newColLabel.trim();
    if (!label) return;
    onChange("columns", [...(sec.columns || []), { id: uid(), label, defaultValue: "", formula: "", type: newColType, summary: newColType === "number" || newColType === "formula" ? "sum" : newColType === "checkbox" ? "count" : "none" }]);
    setNewColLabel("");
    setNewColType("text");
  };

  const removeColumn = (colId) => {
    onChange("columns", (sec.columns || []).filter(c => c.id !== colId));
  };

  const moveColumn = (colId, direction) => {
    const idx = (sec.columns || []).findIndex(c => c.id === colId);
    if (idx < 0) return;
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= (sec.columns || []).length) return;
    const arr = [...(sec.columns || [])];
    [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
    onChange("columns", arr);
  };

  return (
    <div className="sk-section" style={{ ...css.section, marginBottom: 10 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <button style={{ ...css.btn(), padding: "1px 5px", fontSize: 10 }} disabled={isFirst} onClick={() => onMove(-1)}>▲</button>
          <button style={{ ...css.btn(), padding: "1px 5px", fontSize: 10 }} disabled={isLast} onClick={() => onMove(1)}>▼</button>
        </div>
        <input style={{ ...css.input, fontWeight: "bold", color: T.accentBright, flex: 1 }} value={sec.name} onChange={e => onChange("name", e.target.value)} />
        <select style={{ ...css.input, width: "auto", fontSize: 11 }} value={secType} onChange={e => {
          const value = e.target.value;
          onChange("type", value);
          if (value === "table" && !sec.columns) onChange("columns", []);
        }}>
          <option value="text">Text</option>
          <option value="waypoints">Waypoints</option>
          <option value="table">Table</option>
        </select>
        <button style={css.btn("danger")} onClick={onRemove}>Remove</button>
      </div>
      {isWaypoints && (
        <div style={{ fontSize: 11, color: T.textDim, padding: "4px 0" }}>Each mission sets its own waypoint count (1–702, A–ZZ) and per-waypoint instructions.</div>
      )}
      {isTable && (
        <>
          <div style={{ ...css.label, marginBottom: 6 }}>
            Columns: <span style={{ color: T.textMuted, fontWeight: "normal", fontSize: 10 }}>type and configure each column</span>
          </div>
          {(sec.columns || []).map((col, colIdx) => (
            <div key={col.id} style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: 8, marginBottom: 8 }}>
              <div style={{ display: "flex", gap: 6, marginBottom: 6, alignItems: "flex-start" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <button style={{ ...css.btn(), padding: "1px 4px", fontSize: 10, minWidth: 24 }} disabled={colIdx === 0} onClick={() => moveColumn(col.id, -1)}>▲</button>
                  <button style={{ ...css.btn(), padding: "1px 4px", fontSize: 10, minWidth: 24 }} disabled={colIdx === (sec.columns || []).length - 1} onClick={() => moveColumn(col.id, 1)}>▼</button>
                </div>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                  <input style={{ ...css.input, fontSize: 11 }} placeholder="Column label" value={col.label}
                    onChange={e => onChange("columns", (sec.columns || []).map(c => c.id === col.id ? { ...c, label: e.target.value } : c))} />
                </div>
                <button style={{ ...css.btn("danger"), padding: "2px 6px", fontSize: 11 }} onClick={() => removeColumn(col.id)}>Remove</button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 6 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ fontSize: 9, color: T.textDim, fontWeight: "bold" }}>TYPE</span>
                  <select style={{ ...css.input, fontSize: 11 }} value={col.type || "text"}
                    onChange={e => onChange("columns", (sec.columns || []).map(c => c.id === col.id ? {
                      ...c,
                      type: e.target.value,
                      summary: (e.target.value === "number" || e.target.value === "formula") ? (c.summary || "sum") : e.target.value === "checkbox" ? (c.summary || "count") : "none",
                    } : c))}>
                    <option value="text">Text</option>
                    <option value="paragraph">Paragraph</option>
                    <option value="number">Number</option>
                    <option value="checkbox">Checkbox</option>
                    <option value="formula">Formula</option>
                  </select>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ fontSize: 9, color: T.textDim, fontWeight: "bold" }}>DEFAULT</span>
                  <input style={{ ...css.input, fontSize: 11 }} placeholder="Default value" value={col.defaultValue || ""}
                    onChange={e => onChange("columns", (sec.columns || []).map(c => c.id === col.id ? { ...c, defaultValue: e.target.value } : c))} />
                </div>
              </div>
              {col.type === "formula" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ fontSize: 9, color: T.textDim, fontWeight: "bold" }}>FORMULA</span>
                  <input style={{ ...css.input, fontSize: 11 }} placeholder="e.g. [Price] * [Qty]" value={col.formula || ""}
                    onChange={e => onChange("columns", (sec.columns || []).map(c => c.id === col.id ? { ...c, formula: e.target.value } : c))} />
                  <span style={{ fontSize: 9, color: T.textMuted, marginTop: 2 }}>{FORMULA_HELP}</span>
                </div>
              )}
              {["text", "number", "checkbox", "formula"].includes(col.type) && (
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 9, color: T.textDim, fontWeight: "bold" }}>SUMMARY</span>
                <select style={{ ...css.input, fontSize: 11 }} value={col.summary || "none"}
                  onChange={e => onChange("columns", (sec.columns || []).map(c => c.id === col.id ? { ...c, summary: e.target.value } : c))}>
                  <option value="none">None</option>
                  {col.type === "text" && (
                    <option value="count">Entry count</option>
                  )}
                  {(col.type === "number" || col.type === "formula") && (
                    <>
                      <option value="sum">Sum</option>
                      <option value="average">Average</option>
                      <option value="min">Min</option>
                      <option value="max">Max</option>
                    </>
                  )}
                  {col.type === "checkbox" && (
                    <option value="count">Checked count</option>
                  )}
                </select>
              </div>
              )}
            </div>
          ))}
          <div style={{ display: "flex", gap: 6 }}>
            <input style={{ ...css.input, flex: 2, fontSize: 11 }} placeholder="New column label..." value={newColLabel}
              onChange={e => setNewColLabel(e.target.value)} onKeyDown={e => e.key === "Enter" && addColumn()} />
            <select style={{ ...css.input, flex: 1, fontSize: 11 }} value={newColType}
              onChange={e => setNewColType(e.target.value)}>
              <option value="text">Text</option>
              <option value="paragraph">Paragraph</option>
              <option value="number">Number</option>
              <option value="checkbox">Checkbox</option>
              <option value="formula">Formula</option>
            </select>
            <button style={{ ...css.btn(), background: "#4caf50", color: "white", padding: "2px 8px", fontSize: 14, minWidth: 32 }} onClick={addColumn}>✓</button>
          </div>
          <div style={{ fontSize: 10, color: T.textDim, marginTop: 12, padding: "8px", background: T.surface2, borderRadius: T.radius }}>
            <strong style={{ color: T.textMuted }}>Column types:</strong> Text, Paragraph (multiline), Number, Checkbox, Formula (computed from other columns — read-only). Summaries available for Number, Formula, and Checkbox columns.
          </div>
        </>
      )}
      {!isWaypoints && !isTable && (
        <>
          <div style={css.label}>Subheaders:</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 6 }}>
            {(sec.subheaders || []).map((sh, i, arr) => (
              <div key={sh} style={{ display: "flex", gap: 4, alignItems: "center" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  <button style={{ ...css.btn(), padding: "1px 4px", fontSize: 10, minWidth: 24 }} disabled={i === 0} onClick={() => moveSub(i, -1)}>▲</button>
                  <button style={{ ...css.btn(), padding: "1px 4px", fontSize: 10, minWidth: 24 }} disabled={i === arr.length - 1} onClick={() => moveSub(i, 1)}>▼</button>
                </div>
                <input
                  style={{ ...css.input, fontSize: 11, flex: 1 }}
                  defaultValue={sh}
                  onBlur={e => {
                    const v = e.target.value.trim();
                    if (v && v !== sh && !(sec.subheaders || []).filter(s => s !== sh).includes(v)) onRenameSubheader(sh, v);
                    else e.target.value = sh;
                  }}
                  onKeyDown={e => { if (e.key === "Enter") e.target.blur(); if (e.key === "Escape") { e.target.value = sh; e.target.blur(); } }}
                />
                <button style={{ ...css.btn("danger"), padding: "2px 6px", fontSize: 11 }} onClick={() => onChange("subheaders", (sec.subheaders || []).filter(s => s !== sh))}>×</button>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <input style={{ ...css.input, fontSize: 11, flex: 1 }} placeholder="Add subheader..." value={sub} onChange={e => setSub(e.target.value)} onKeyDown={e => e.key === "Enter" && addSub()} />
            <button style={css.btn()} onClick={addSub}>+</button>
          </div>
        </>
      )}
    </div>
  );
}
