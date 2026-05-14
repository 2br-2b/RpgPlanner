import { useState, useRef, useEffect } from "react";
import { useThemeCSS } from "./theme.js";
import { uid } from "./storage.js";
import { ConfirmModal } from "./ui.jsx";
import { FORMULA_HELP } from "./formula.js";
import { IconPicker } from "./icon-picker.jsx";

// Returns true if any page of the given typeId has non-empty section data
function typeHasData(pages, typeId) {
  return pages.some(p => {
    if (p.type !== typeId) return false;
    const sections = p.sections || {};
    return Object.values(sections).some(v => {
      if (!v) return false;
      if (typeof v === "string") return v.trim() !== "";
      if (typeof v === "object") return Object.values(v).some(sv => sv && String(sv).trim() !== "");
      return false;
    });
  });
}

// Returns true if any page of the given typeId has data in the given sectionId
function sectionHasData(pages, typeId, sectionId) {
  return pages.some(p => {
    if (p.type !== typeId) return false;
    const sd = (p.sections || {})[sectionId];
    if (!sd) return false;
    if (typeof sd === "string") return sd.trim() !== "";
    if (typeof sd === "object") return Object.values(sd).some(v => v && String(v).trim() !== "");
    return false;
  });
}

// Returns true if any page of the given typeId has data in the given subheader of the given sectionId
function subheaderHasData(pages, typeId, sectionId, subheader) {
  return pages.some(p => {
    if (p.type !== typeId) return false;
    const sd = (p.sections || {})[sectionId];
    if (!sd || typeof sd !== "object") return false;
    const v = sd[subheader];
    return v && String(v).trim() !== "";
  });
}

function PlayerVisibilityControls({ sec, campaign, onChange, T, css }) {
  if (!campaign.shareEnabled) return null;
  const isText = sec.type === "text" || !sec.type;
  const isTable = sec.type === "table";

  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.border}` }}>
      <div style={{ fontSize: 9, color: T.textDim, fontWeight: "bold", letterSpacing: "0.1em", marginBottom: 8 }}>PLAYER VISIBILITY</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 6 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 11, color: T.textDim }}>
          <input type="checkbox" checked={sec.playerVisible || false}
            onChange={e => onChange("playerVisible", e.target.checked)}
            style={{ accentColor: T.accent }} />
          Visible to players (default for all pages)
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 11, color: T.textDim }}>
          <input type="checkbox" checked={sec.playerEditable || false}
            onChange={e => onChange("playerEditable", e.target.checked)}
            style={{ accentColor: T.accent }} />
          Players can edit
        </label>
      </div>
      {isText && sec.playerVisible && (sec.subheaders || []).length > 0 && (
        <div>
          <div style={{ fontSize: 9, color: T.textMuted, marginBottom: 4 }}>Visible subheaders (when section is shown):</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {sec.subheaders.map(sh => (
              <label key={sh} style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer", fontSize: 11, color: T.textDim }}>
                <input type="checkbox"
                  checked={(sec.playerVisibleSubheaders || []).includes(sh)}
                  onChange={e => {
                    const current = sec.playerVisibleSubheaders || [];
                    onChange("playerVisibleSubheaders", e.target.checked ? [...current, sh] : current.filter(s => s !== sh));
                  }}
                  style={{ accentColor: T.accent }} />
                {sh}
              </label>
            ))}
          </div>
        </div>
      )}
      {isTable && sec.playerVisible && (sec.columns || []).length > 0 && (
        <div>
          <div style={{ fontSize: 9, color: T.textMuted, marginBottom: 4 }}>Visible columns (when section is shown):</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {sec.columns.map(col => (
              <label key={col.id} style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer", fontSize: 11, color: T.textDim }}>
                <input type="checkbox"
                  checked={(sec.playerVisibleColumns || []).includes(col.id)}
                  onChange={e => {
                    const current = sec.playerVisibleColumns || [];
                    onChange("playerVisibleColumns", e.target.checked ? [...current, col.id] : current.filter(id => id !== col.id));
                  }}
                  style={{ accentColor: T.accent }} />
                {col.label}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── PageTypesEditor (top-level) ───────────────────────────────────────────────

export function SchemaEditor({ campaign, onUpdate }) {
  const { T, css } = useThemeCSS();
  const [selectedTypeId, setSelectedTypeId] = useState(() => (campaign.pageTypes || [])[0]?.id ?? null);
  const [newTypeName, setNewTypeName] = useState("");
  const [pendingDeleteType, setPendingDeleteType] = useState(null); // { id, name }
  const [suppressTypeDelete, setSuppressTypeDelete] = useState(false);

  const pageTypes = campaign.pageTypes || [];
  const selectedType = pageTypes.find(t => t.id === selectedTypeId) || pageTypes[0] || null;

  const addType = () => {
    const name = newTypeName.trim();
    if (!name) return;
    const newType = {
      id: uid(),
      name,
      sectionSchema: [],
    };
    onUpdate(c => ({ ...c, pageTypes: [...(c.pageTypes || []), newType] }));
    setNewTypeName("");
    setSelectedTypeId(newType.id);
  };

  const renameType = (id, name) => {
    onUpdate(c => ({ ...c, pageTypes: (c.pageTypes || []).map(t => t.id === id ? { ...t, name } : t) }));
  };

  const changeIcon = (id, icon) => {
    onUpdate(c => ({ ...c, pageTypes: (c.pageTypes || []).map(t => t.id === id ? { ...t, icon } : t) }));
  };

  const deleteType = (id) => {
    onUpdate(c => {
      const ts = new Date().toISOString();
      const deletedPageIds = (c.pages || []).filter(p => p.type === id).map(p => p.id);
      return {
        ...c,
        pageTypes: (c.pageTypes || []).filter(t => t.id !== id),
        pages: (c.pages || []).filter(p => p.type !== id),
        typeDeletedTimestamps: { ...(c.typeDeletedTimestamps || {}), [id]: ts },
        pageDeletedTimestamps: { ...(c.pageDeletedTimestamps || {}), ...Object.fromEntries(deletedPageIds.map(pid => [pid, ts])) },
      };
    });
    const remaining = pageTypes.filter(t => t.id !== id);
    setSelectedTypeId(remaining[0]?.id ?? null);
    setPendingDeleteType(null);
  };

  const tryDeleteType = (pt) => {
    if (sessionStorage.getItem("type-delete-warn-dismissed")) {
      deleteType(pt.id);
      return;
    }
    setPendingDeleteType(pt);
  };

  const updateTypeSchema = (typeId, updater) => {
    onUpdate(c => ({
      ...c,
      pageTypes: (c.pageTypes || []).map(t => t.id === typeId ? { ...t, sectionSchema: updater(t.sectionSchema || []) } : t),
    }));
  };

  const updSection = (typeId, secId, field, value) => {
    updateTypeSchema(typeId, schema => schema.map(s => s.id === secId ? { ...s, [field]: value } : s));
  };

  const addSection = (typeId) => {
    const newSec = { id: uid(), name: "New Section", type: "text", subheaders: [], playerVisible: false, playerEditable: false, playerVisibleSubheaders: [], playerVisibleColumns: [] };
    updateTypeSchema(typeId, schema => [...schema, newSec]);
  };

  const moveSection = (typeId, secId, dir) => {
    updateTypeSchema(typeId, schema => {
      const arr = [...schema];
      const i = arr.findIndex(s => s.id === secId);
      const j = i + dir;
      if (j < 0 || j >= arr.length) return arr;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return arr;
    });
  };

  const renameSubheader = (typeId, secId, oldName, newName) => {
    onUpdate(c => {
      const newSchema = (c.pageTypes || []).map(t => {
        if (t.id !== typeId) return t;
        return { ...t, sectionSchema: (t.sectionSchema || []).map(s => s.id !== secId ? s : { ...s, subheaders: (s.subheaders || []).map(sh => sh === oldName ? newName : sh) }) };
      });
      const newPages = (c.pages || []).map(p => {
        if (p.type !== typeId) return p;
        const sData = (p.sections || {})[secId];
        if (!sData || typeof sData !== "object" || Array.isArray(sData) || !(oldName in sData)) return p;
        const { [oldName]: val, ...rest } = sData;
        return { ...p, sections: { ...p.sections, [secId]: { ...rest, [newName]: val } } };
      });
      return { ...c, pageTypes: newSchema, pages: newPages };
    });
  };

  return (
    <div style={{ maxWidth: 720 }}>
      {pendingDeleteType && (
        <ConfirmModal
          title={`Delete page type "${pendingDeleteType.name}"?`}
          confirmLabel="Yes, delete type and all its pages"
          onConfirm={(suppress) => {
            if (suppress) sessionStorage.setItem("type-delete-warn-dismissed", "1");
            deleteType(pendingDeleteType.id);
          }}
          onCancel={() => setPendingDeleteType(null)}
          suppressLabel="Don't warn me again this session"
        >
          All pages of type <strong>{pendingDeleteType.name}</strong> will be permanently deleted. This cannot be undone.
        </ConfirmModal>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <h2 style={{ margin: 0, color: T.accentBright, fontSize: 16, letterSpacing: "0.1em" }}>PAGE TYPES</h2>
        <div style={{ flex: 1 }} />
      </div>

      {/* Type tabs */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16, alignItems: "center" }}>
        {pageTypes.map(pt => (
          <button key={pt.id}
            style={{ ...css.btn(selectedTypeId === pt.id ? "primary" : "default"), fontSize: 11, padding: "4px 12px" }}
            onClick={() => setSelectedTypeId(pt.id)}>
            {pt.icon || "📄"} {pt.name}
          </button>
        ))}
        <div style={{ display: "flex", gap: 4 }}>
          <input style={{ ...css.input, fontSize: 11, width: 130 }} placeholder="New type name..." value={newTypeName}
            onChange={e => setNewTypeName(e.target.value)} onKeyDown={e => e.key === "Enter" && addType()} />
          <button style={css.btn("primary")} onClick={addType}>+</button>
        </div>
      </div>

      {selectedType && (
        <PageTypePanel
          key={selectedType.id}
          pageType={selectedType}
          campaign={campaign}
          onRename={(name) => renameType(selectedType.id, name)}
          onChangeIcon={(icon) => changeIcon(selectedType.id, icon)}
          onDelete={() => tryDeleteType(selectedType)}
          onAddSection={() => addSection(selectedType.id)}
          onMoveSection={(secId, dir) => moveSection(selectedType.id, secId, dir)}
          onChangeSection={(secId, field, value) => updSection(selectedType.id, secId, field, value)}
          onRenameSubheader={(secId, o, n) => renameSubheader(selectedType.id, secId, o, n)}
          onUpdate={onUpdate}
        />
      )}
      {pageTypes.length === 0 && (
        <div style={{ color: T.textDim, textAlign: "center", padding: 32 }}>No page types defined. Add one above.</div>
      )}
    </div>
  );
}

function PageTypePanel({ pageType, campaign, onRename, onChangeIcon, onDelete, onAddSection, onMoveSection, onChangeSection, onRenameSubheader, onUpdate }) {
  const { T, css } = useThemeCSS();
  const [editName, setEditName] = useState(pageType.name);
  const schema = pageType.sectionSchema || [];
  const pageCount = (campaign.pages || []).filter(p => p.type === pageType.id).length;

  const commitRename = () => {
    const v = editName.trim();
    if (v && v !== pageType.name) onRename(v);
    else setEditName(pageType.name);
  };

  return (
    <div>
      {/* Type header */}
      <div className="sk-section" style={{ ...css.section, marginBottom: 16, display: "flex", gap: 10, alignItems: "center" }}>
        <IconPicker value={pageType.icon || "📄"} onChange={onChangeIcon} />
        <input style={{ ...css.input, fontWeight: "bold", color: T.accentBright, flex: 1 }}
          value={editName}
          onChange={e => setEditName(e.target.value)}
          onBlur={commitRename}
          onKeyDown={e => { if (e.key === "Enter") e.target.blur(); if (e.key === "Escape") { setEditName(pageType.name); e.target.blur(); } }}
        />
        <span style={{ fontSize: 11, color: T.textMuted, flexShrink: 0 }}>{pageCount} page{pageCount !== 1 ? "s" : ""}</span>
        <button style={css.btn("danger")} onClick={onDelete}>Delete type</button>
      </div>

      <div style={{ marginBottom: 12, padding: 10, background: T.surface2, border: `1px solid ${T.border}`, borderRadius: T.radius, fontSize: 11, color: T.textDim }}>
        Changes here propagate to all <strong>{pageType.name}</strong> pages automatically. Existing content is preserved.
        {schema.length === 1 && (schema[0].subheaders || []).length <= 1 && (
          <span style={{ color: T.accent }}> — single section with ≤1 subheader: renders full-width expanded.</span>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
        <button style={css.btn("primary")} onClick={onAddSection}>+ Section</button>
      </div>

      {schema.map((sec, i) => (
        <SchemaSectionRow
          key={sec.id}
          sec={sec}
          campaign={campaign}
          pageTypeId={pageType.id}
          isFirst={i === 0}
          isLast={i === schema.length - 1}
          onChange={(f, v) => onChangeSection(sec.id, f, v)}
          onRemove={() => {
            // Handled inside SchemaSectionRow with data-loss warning
          }}
          onRemoveConfirmed={() => {
            onUpdate(c => ({
              ...c,
              pageTypes: (c.pageTypes || []).map(t => t.id === pageType.id
                ? { ...t, sectionSchema: (t.sectionSchema || []).filter(s => s.id !== sec.id) }
                : t),
            }));
          }}
          onMove={dir => onMoveSection(sec.id, dir)}
          onRenameSubheader={(o, n) => onRenameSubheader(sec.id, o, n)}
          onUpdate={onUpdate}
        />
      ))}
      {schema.length === 0 && (
        <div style={{ color: T.textDim, textAlign: "center", padding: 32 }}>No sections. Pages of this type will have no structured content.</div>
      )}
    </div>
  );
}

function SchemaSectionRow({ sec, campaign, pageTypeId, isFirst, isLast, onChange, onRemoveConfirmed, onMove, onRenameSubheader, onUpdate }) {
  const { T, css } = useThemeCSS();
  const [sub, setSub] = useState("");
  const [newColLabel, setNewColLabel] = useState("");
  const [newColType, setNewColType] = useState("text");
  const [pendingDeleteSection, setPendingDeleteSection] = useState(false);
  const [pendingDeleteSubheader, setPendingDeleteSubheader] = useState(null); // subheader name
  const secType = sec.type || "text";
  const isWaypoints = secType === "waypoints";
  const isTable = secType === "table";

  const hasData = sectionHasData(campaign.pages || [], pageTypeId, sec.id);

  const tryRemoveSection = () => {
    if (hasData && !sessionStorage.getItem("section-delete-warn-dismissed")) {
      setPendingDeleteSection(true);
    } else {
      onRemoveConfirmed();
    }
  };

  const tryRemoveSubheader = (sh) => {
    const shHasData = subheaderHasData(campaign.pages || [], pageTypeId, sec.id, sh);
    if (shHasData && !sessionStorage.getItem("section-delete-warn-dismissed")) {
      setPendingDeleteSubheader(sh);
    } else {
      onChange("subheaders", (sec.subheaders || []).filter(s => s !== sh));
    }
  };

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
    <>
      {pendingDeleteSection && (
        <ConfirmModal
          title={`Delete section "${sec.name}"?`}
          confirmLabel="Yes, delete section"
          onConfirm={(suppress) => {
            if (suppress) sessionStorage.setItem("section-delete-warn-dismissed", "1");
            onRemoveConfirmed();
            setPendingDeleteSection(false);
          }}
          onCancel={() => setPendingDeleteSection(false)}
          suppressLabel="Don't warn me again this session"
        >
          This section has content on some pages. Deleting it will lose that data permanently.
        </ConfirmModal>
      )}
      {pendingDeleteSubheader && (
        <ConfirmModal
          title={`Delete subheader "${pendingDeleteSubheader}"?`}
          confirmLabel="Yes, delete subheader"
          onConfirm={(suppress) => {
            if (suppress) sessionStorage.setItem("section-delete-warn-dismissed", "1");
            onChange("subheaders", (sec.subheaders || []).filter(s => s !== pendingDeleteSubheader));
            setPendingDeleteSubheader(null);
          }}
          onCancel={() => setPendingDeleteSubheader(null)}
          suppressLabel="Don't warn me again this session"
        >
          The subheader <strong>{pendingDeleteSubheader}</strong> has content on some pages. Deleting it will lose that data permanently.
        </ConfirmModal>
      )}
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
          <button style={css.btn("danger")} onClick={tryRemoveSection}>Remove</button>
        </div>
        {isWaypoints && (
          <div style={{ fontSize: 11, color: T.textDim, padding: "4px 0" }}>Each page sets its own waypoint count (1–702, A–ZZ) and per-waypoint instructions.</div>
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
                      {col.type === "text" && <option value="count">Entry count</option>}
                      {(col.type === "number" || col.type === "formula") && (
                        <>
                          <option value="sum">Sum</option>
                          <option value="average">Average</option>
                          <option value="min">Min</option>
                          <option value="max">Max</option>
                        </>
                      )}
                      {col.type === "checkbox" && <option value="count">Checked count</option>}
                    </select>
                  </div>
                )}
              </div>
            ))}
            <div style={{ display: "flex", gap: 6 }}>
              <input style={{ ...css.input, flex: 2, fontSize: 11 }} placeholder="New column label..." value={newColLabel}
                onChange={e => setNewColLabel(e.target.value)} onKeyDown={e => e.key === "Enter" && addColumn()} />
              <select style={{ ...css.input, flex: 1, fontSize: 11 }} value={newColType} onChange={e => setNewColType(e.target.value)}>
                <option value="text">Text</option>
                <option value="paragraph">Paragraph</option>
                <option value="number">Number</option>
                <option value="checkbox">Checkbox</option>
                <option value="formula">Formula</option>
              </select>
              <button style={{ ...css.btn(), background: "#4caf50", color: "white", padding: "2px 8px", fontSize: 14, minWidth: 32 }} onClick={addColumn}>✓</button>
            </div>
            <div style={{ fontSize: 10, color: T.textDim, marginTop: 12, padding: "8px", background: T.surface2, borderRadius: T.radius }}>
              <strong style={{ color: T.textMuted }}>Column types:</strong> Text, Paragraph (multiline), Number, Checkbox, Formula (computed — read-only). Summaries available for Number, Formula, and Checkbox columns.
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
                  <button style={{ ...css.btn("danger"), padding: "2px 6px", fontSize: 11 }} onClick={() => tryRemoveSubheader(sh)}>×</button>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <input style={{ ...css.input, fontSize: 11, flex: 1 }} placeholder="Add subheader..." value={sub} onChange={e => setSub(e.target.value)} onKeyDown={e => e.key === "Enter" && addSub()} />
              <button style={css.btn()} onClick={addSub}>+</button>
            </div>
          </>
        )}
        <PlayerVisibilityControls sec={sec} campaign={campaign} onChange={onChange} T={T} css={css} />
      </div>
    </>
  );
}
