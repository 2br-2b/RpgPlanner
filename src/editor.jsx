import { useState, useRef } from "react";
import { useTheme, makeCSS, useIsMobile } from "./theme.js";
import { uid } from "./storage.js";
import { renderMarkdown } from "./markdown.js";

export function OutlineView({ campaign, onSelect, onUpdate }) {
  const T = useTheme(); const css = makeCSS(T);
  const [filterTag, setFilterTag] = useState("");
  const allTags = [...new Set(campaign.pages.flatMap(p => p.tags || []))];
  const filtered = campaign.pages.filter(p => !filterTag || (p.tags || []).includes(filterTag));

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <h2 style={{ margin: "0 0 10px", color: T.accentBright, fontSize: 16, letterSpacing: "0.1em" }}>CAMPAIGN OUTLINE</h2>
        {allTags.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 10, color: T.textDim, letterSpacing: "0.08em" }}>FILTER:</span>
            <span style={{ ...css.tag, cursor: "pointer", opacity: !filterTag ? 1 : 0.45, outline: !filterTag ? `1px solid ${T.accent}` : "none" }} onClick={() => setFilterTag("")}>ALL</span>
            {allTags.map(tag => (
              <span key={tag} style={{ ...css.tag, cursor: "pointer", opacity: filterTag === tag ? 1 : 0.45, outline: filterTag === tag ? `1px solid ${T.accent}` : "none" }}
                onClick={() => setFilterTag(filterTag === tag ? "" : tag)}>{tag}</span>
            ))}
          </div>
        )}
      </div>
      {filtered.length === 0 && (
        <div style={{ color: T.textDim, textAlign: "center", padding: "48px 24px" }}>
          {campaign.pages.length === 0 ? (
            <div>
              <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.3 }}>◈</div>
              <div style={{ fontSize: 15, marginBottom: 8 }}>No pages yet</div>
              <div style={{ fontSize: 12, color: T.textMuted }}>Use the sidebar to add a mission or free page.</div>
            </div>
          ) : <span>No pages match this tag filter.</span>}
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
        {filtered.map(page => <OutlineCard key={page.id} page={page} schema={campaign.sectionSchema} showCosts={campaign.showCostsInOutline !== false} onSelect={onSelect} onUpdate={onUpdate} />)}
      </div>
    </div>
  );
}

function OutlineCard({ page, schema, showCosts, onSelect, onUpdate }) {
  const T = useTheme(); const css = makeCSS(T);
  const [editTag, setEditTag] = useState("");
  const tc = (page.costs || []).reduce((s, c) => s + (Number(c.amount) || 0), 0);
  const ta = (page.awards || []).reduce((s, a) => s + (Number(a.amount) || 0), 0);

  const addTag = () => {
    const t = editTag.trim().toLowerCase();
    if (!t || (page.tags || []).includes(t)) { setEditTag(""); return; }
    onUpdate(c => ({ ...c, pages: c.pages.map(p => p.id === page.id ? { ...p, tags: [...(p.tags || []), t] } : p) }));
    setEditTag("");
  };

  return (
    <div style={{ ...css.section, cursor: "pointer", transition: "border-color 0.15s" }}
      onMouseEnter={e => e.currentTarget.style.borderColor = T.accent}
      onMouseLeave={e => e.currentTarget.style.borderColor = T.border}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }} onClick={() => onSelect(page.id)}>
        <span style={{ fontSize: 10, color: page.type === "mission" ? T.accent : T.textDim }}>{page.type === "mission" ? "⬟ MISSION" : "◻ PAGE"}</span>
        <span style={{ flex: 1, fontWeight: "bold", fontSize: 14, color: T.accentBright }}>{page.name}</span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
        {(page.tags || []).map(tag => (
          <span key={tag} style={{ ...css.tag, cursor: "pointer" }}
            onClick={() => onUpdate(c => ({ ...c, pages: c.pages.map(p => p.id === page.id ? { ...p, tags: p.tags.filter(t => t !== tag) } : p) }))}>{tag} ×</span>
        ))}
        <input style={{ ...css.input, width: 80, fontSize: 10, padding: "1px 5px" }} placeholder="+ tag" value={editTag}
          onChange={e => setEditTag(e.target.value)}
          onKeyDown={e => { e.stopPropagation(); if (e.key === "Enter") addTag(); }}
          onClick={e => e.stopPropagation()} />
      </div>
      {page.type === "mission" && (
        <div style={{ fontSize: 11 }} onClick={() => onSelect(page.id)}>
          {schema.map(sec => (
            <div key={sec.id} style={{ marginBottom: 6 }}>
              <div style={{ color: T.textDim, marginBottom: 3, fontSize: 10, letterSpacing: "0.06em" }}>▸ {sec.name.toUpperCase()}</div>
              {sec.subheaders.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, paddingLeft: 8 }}>
                  {sec.subheaders.map(sh => (
                    <span key={sh} style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: T.radius, color: T.textDim, fontSize: 9, padding: "1px 6px", letterSpacing: "0.04em" }}>{sh}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {showCosts && (tc > 0 || ta > 0) && (
        <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 11 }}>
          {tc > 0 && <span style={{ color: T.danger }}>▼ {tc.toLocaleString()}</span>}
          {ta > 0 && <span style={{ color: T.accent }}>▲ {ta.toLocaleString()}</span>}
        </div>
      )}
    </div>
  );
}

export function PageEditor({ page, schema, onUpdate, onBack }) {
  const T = useTheme(); const css = makeCSS(T);
  const isMobile = useIsMobile();
  const [activeSection, setActiveSection] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editTag, setEditTag] = useState("");
  const imgRef = useRef(null);
  const [imgTarget, setImgTarget] = useState(null);

  const set = (k, v) => onUpdate({ ...page, [k]: v });
  const setSection = (sid, subKey, v) => {
    if (subKey === undefined) {
      onUpdate({ ...page, sections: { ...page.sections, [sid]: v } });
    } else {
      const prev = (typeof page.sections[sid] === "object" && page.sections[sid] !== null) ? page.sections[sid] : {};
      onUpdate({ ...page, sections: { ...page.sections, [sid]: { ...prev, [subKey]: v } } });
    }
  };
  const getSectionValue = (sid, subKey) => {
    const raw = page.sections[sid];
    if (subKey === undefined) return raw || "";
    if (typeof raw === "object" && raw !== null) return raw[subKey] || "";
    return "";
  };

  const addTag = () => {
    const t = editTag.trim().toLowerCase();
    if (!t || (page.tags || []).includes(t)) { setEditTag(""); return; }
    set("tags", [...(page.tags || []), t]); setEditTag("");
  };

  const handleImg = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const r = new FileReader();
    r.onload = (ev) => {
      const md = `\n![${file.name}](${ev.target.result})\n`;
      if (imgTarget === "free") {
        set("content", (page.content || "") + md);
      } else if (imgTarget && imgTarget.includes("::")) {
        const [sid, subKey] = imgTarget.split("::");
        setSection(sid, subKey, getSectionValue(sid, subKey) + md);
      } else if (imgTarget) {
        setSection(imgTarget, undefined, getSectionValue(imgTarget) + md);
      }
    };
    r.readAsDataURL(file); e.target.value = "";
  };

  const triggerImg = (t) => { setImgTarget(t); setTimeout(() => imgRef.current?.click(), 50); };

  return (
    <div style={{ maxWidth: 860 }}>
      {isMobile && onBack && (
        <button style={{ ...css.btn(), marginBottom: 12, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }} onClick={onBack}>← Outline</button>
      )}
      <input style={{ ...css.input, fontSize: "clamp(16px, 4vw, 20px)", fontWeight: "bold", marginBottom: 12, color: T.accentBright, maxWidth: "100%", boxSizing: "border-box" }} value={page.name} onChange={e => set("name", e.target.value)} />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16, alignItems: "center" }}>
        <span style={{ ...css.label, margin: 0 }}>Tags:</span>
        {(page.tags || []).map(tag => <span key={tag} style={{ ...css.tag, cursor: "pointer" }} onClick={() => set("tags", page.tags.filter(t => t !== tag))}>{tag} ×</span>)}
        <input style={{ ...css.input, width: 100, fontSize: 11, padding: "2px 6px" }} placeholder="+ add tag" value={editTag}
          onChange={e => setEditTag(e.target.value)} onKeyDown={e => e.key === "Enter" && addTag()} />
      </div>
      <input ref={imgRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleImg} />

      {page.type === "free" && (
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <button style={css.btn(editMode ? "primary" : "default")} onClick={() => setEditMode(!editMode)}>{editMode ? "Preview" : "Edit"}</button>
            <button style={css.btn()} onClick={() => triggerImg("free")}>🖼 Image</button>
          </div>
          {editMode
            ? <textarea style={{ ...css.textarea, minHeight: 400 }} value={page.content || ""} onChange={e => set("content", e.target.value)} placeholder="Markdown supported..." />
            : <div style={css.section} dangerouslySetInnerHTML={{ __html: renderMarkdown(page.content, T) }} />}
        </div>
      )}

      {page.type === "mission" && (
        <div>
          <div style={{ display: "flex", gap: 4, marginBottom: 16, overflowX: "auto", paddingBottom: 4, WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}>
            <button style={{ ...css.btn(activeSection === null ? "primary" : "default"), fontSize: 11, flexShrink: 0 }} onClick={() => setActiveSection(null)}>All</button>
            {schema.map(sec => (
              <button key={sec.id} style={{ ...css.btn(activeSection === sec.id ? "primary" : "default"), fontSize: 11, flexShrink: 0 }}
                onClick={() => setActiveSection(activeSection === sec.id ? null : sec.id)}>{sec.name}</button>
            ))}
            <button style={{ ...css.btn(activeSection === "__costs" ? "primary" : "default"), fontSize: 11, flexShrink: 0 }}
              onClick={() => setActiveSection(activeSection === "__costs" ? null : "__costs")}>Costs / Awards</button>
          </div>
          {activeSection === null && schema.map(sec => (
            <MissionSection key={sec.id} sec={sec} sectionData={page.sections[sec.id]}
              onChange={(subKey, v) => setSection(sec.id, subKey, v)}
              onImageUpload={(subKey) => triggerImg(subKey !== undefined ? `${sec.id}::${subKey}` : sec.id)} />
          ))}
          {activeSection !== null && activeSection !== "__costs" && (() => {
            const sec = schema.find(s => s.id === activeSection);
            return sec ? <MissionSection sec={sec} sectionData={page.sections[sec.id]}
              onChange={(subKey, v) => setSection(sec.id, subKey, v)}
              onImageUpload={(subKey) => triggerImg(subKey !== undefined ? `${sec.id}::${subKey}` : sec.id)} expanded /> : null;
          })()}
          {activeSection === "__costs" && (
            <CostsAwards
              costs={page.costs || []} awards={page.awards || []}
              onAddCost={() => set("costs", [...(page.costs || []), { id: uid(), label: "", amount: 0 }])}
              onAddAward={() => set("awards", [...(page.awards || []), { id: uid(), label: "", amount: 0 }])}
              onUpdateCost={(id, f, v) => set("costs", page.costs.map(c => c.id === id ? { ...c, [f]: v } : c))}
              onUpdateAward={(id, f, v) => set("awards", page.awards.map(a => a.id === id ? { ...a, [f]: v } : a))}
              onRemoveCost={id => set("costs", page.costs.filter(c => c.id !== id))}
              onRemoveAward={id => set("awards", page.awards.filter(a => a.id !== id))}
            />
          )}
        </div>
      )}
    </div>
  );
}

function SubBox({ label, value, onChange, onImageUpload, expanded, T, css }) {
  const [editMode, setEditMode] = useState(!value);
  return (
    <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 11, color: T.accent, fontWeight: "bold", letterSpacing: "0.08em", flex: 1 }}>{label.toUpperCase()}</span>
        <button style={{ ...css.btn(), fontSize: 10, padding: "2px 6px" }} onClick={onImageUpload}>🖼</button>
        <button style={{ ...css.btn(editMode ? "primary" : "default"), fontSize: 10, padding: "2px 8px" }} onClick={() => setEditMode(!editMode)}>{editMode ? "Preview" : "Edit"}</button>
      </div>
      {editMode
        ? <textarea style={{ ...css.textarea, minHeight: expanded ? 400 : 200 }} value={value} onChange={e => onChange(e.target.value)} placeholder={`${label}…`} />
        : <div style={{ minHeight: 60, color: value ? T.text : T.textMuted, fontSize: 12, lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: value ? renderMarkdown(value, T) : `<em style="color:${T.textMuted}">${label} — click Edit to add content</em>` }} />}
    </div>
  );
}

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

function WaypointsSection({ sec, sectionData, onChange }) {
  const T = useTheme(); const css = makeCSS(T);
  const raw = (typeof sectionData === "object" && sectionData !== null && !Array.isArray(sectionData)) ? sectionData : {};
  const count = Math.min(702, Math.max(1, Number(raw.count) || 1));
  const waypoints = raw.waypoints || {};

  return (
    <div style={{ ...css.section, marginBottom: 12 }}>
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

function TableSection({ sec, sectionData, onChange }) {
  const T = useTheme(); const css = makeCSS(T);
  const columns = sec.columns || [];
  const raw = (typeof sectionData === "object" && sectionData !== null && !Array.isArray(sectionData)) ? sectionData : {};
  const rows = Array.isArray(raw.rows) ? raw.rows : [];
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState("asc");
  const [filterText, setFilterText] = useState("");

  const getDefaultValue = (col) => {
    if (col.type === "checkbox") return col.defaultValue === true || col.defaultValue === "true";
    return col.defaultValue ?? "";
  };

  const setRows = (newRows) => onChange({ ...raw, rows: newRows });
  const addRow = () => {
    const newRow = {};
    columns.forEach(col => { newRow[col.id] = getDefaultValue(col); });
    setRows([...rows, newRow]);
  };
  const removeRow = (idx) => setRows(rows.filter((_, i) => i !== idx));
  const setCellValue = (rowIdx, colId, val) => setRows(rows.map((row, i) => i === rowIdx ? { ...row, [colId]: val } : row));

  const exportCSV = () => {
    const escape = (v) => {
      const s = String(v ?? "");
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = columns.map(c => escape(c.label)).join(",");
    const body = rows.map(row => columns.map(col => {
      const v = row[col.id];
      if (col.type === "checkbox") return v === true || v === "true" ? "true" : "false";
      return escape(v);
    }).join(",")).join("\n");
    const blob = new Blob([header + "\n" + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${sec.name || "table"}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const importCSVRef = useRef(null);
  const importCSV = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      const lines = text.split(/\r?\n/).filter(l => l.trim() !== "");
      if (lines.length < 2) return;
      const parseRow = (line) => {
        const result = []; let cur = ""; let inQ = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (inQ) { if (ch === '"' && line[i+1] === '"') { cur += '"'; i++; } else if (ch === '"') inQ = false; else cur += ch; }
          else if (ch === '"') inQ = true;
          else if (ch === ',') { result.push(cur); cur = ""; }
          else cur += ch;
        }
        result.push(cur);
        return result;
      };
      const headers = parseRow(lines[0]);
      const colByLabel = {};
      columns.forEach(c => { colByLabel[c.label.toLowerCase()] = c; });
      const newRows = lines.slice(1).map(line => {
        const vals = parseRow(line);
        const row = {};
        columns.forEach(c => { row[c.id] = getDefaultValue(c); });
        headers.forEach((h, i) => {
          const col = colByLabel[h.toLowerCase()];
          if (!col) return;
          const raw = vals[i] ?? "";
          if (col.type === "checkbox") row[col.id] = raw.toLowerCase() === "true";
          else if (col.type === "number") row[col.id] = raw === "" ? "" : Number(raw);
          else row[col.id] = raw;
        });
        return row;
      });
      setRows(newRows);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const cycleSort = (colId) => {
    if (sortCol !== colId) { setSortCol(colId); setSortDir("asc"); }
    else if (sortDir === "asc") setSortDir("desc");
    else { setSortCol(null); setSortDir("asc"); }
  };

  const filteredRows = rows.map((row, idx) => ({ row, idx })).filter(({ row }) => {
    if (!filterText.trim()) return true;
    const q = filterText.trim().toLowerCase();
    return columns.some(col => {
      const v = row[col.id];
      if (col.type === "checkbox") return (v === true || v === "true") ? "checked".includes(q) : "unchecked".includes(q);
      return String(v ?? "").toLowerCase().includes(q);
    });
  });

  const sortedRows = sortCol
    ? [...filteredRows].sort((a, b) => {
        if (sortCol === "__id__") return sortDir === "asc" ? a.idx - b.idx : b.idx - a.idx;
        const col = columns.find(c => c.id === sortCol);
        const av = a.row[sortCol]; const bv = b.row[sortCol];
        let cmp;
        if (col?.type === "number") cmp = (Number(av) || 0) - (Number(bv) || 0);
        else if (col?.type === "checkbox") cmp = ((av === true || av === "true") ? 1 : 0) - ((bv === true || bv === "true") ? 1 : 0);
        else cmp = String(av ?? "").localeCompare(String(bv ?? ""));
        return sortDir === "asc" ? cmp : -cmp;
      })
    : filteredRows;

  const summaryValues = columns.map(col => {
    if (!col.summary || col.summary === "none") return "";
    const rawValues = rows.map(row => row[col.id]).filter(v => v !== undefined && v !== null && v !== "");
    if (col.type === "text") {
      if (col.summary === "count") return rawValues.length;
      return "";
    }
    if (col.type === "number") {
      const nums = rawValues.map(v => Number(v)).filter(n => !Number.isNaN(n));
      if (!nums.length) return "";
      switch (col.summary) {
        case "sum": return nums.reduce((sum, n) => sum + n, 0);
        case "average": return nums.reduce((sum, n) => sum + n, 0) / nums.length;
        case "min": return Math.min(...nums);
        case "max": return Math.max(...nums);
        default: return "";
      }
    }
    if (col.type === "checkbox") {
      return rawValues.filter(v => v === true || v === "true").length;
    }
    return "";
  });
  const hasSummary = summaryValues.some(value => value !== "");

  if (columns.length === 0) {
    return (
      <div style={{ ...css.section, marginBottom: 12 }}>
        <span style={{ color: T.accentBright, fontWeight: "bold", fontSize: 13, letterSpacing: "0.1em" }}>{sec.name.toUpperCase()}</span>
        <div style={{ fontSize: 11, color: T.textDim, marginTop: 8 }}>No columns defined. Configure columns in the Section Schema.</div>
      </div>
    );
  }

  return (
    <div style={{ ...css.section, marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <span style={{ color: T.accentBright, fontWeight: "bold", fontSize: 13, letterSpacing: "0.1em" }}>{sec.name.toUpperCase()}</span>
        <button style={{ ...css.btn(), fontSize: 11 }} onClick={addRow}>+ Row</button>
        <input style={{ ...css.input, fontSize: 11, flex: 1, maxWidth: 200 }} placeholder="Filter rows..." value={filterText} onChange={e => setFilterText(e.target.value)} />
        {filterText && <button style={{ ...css.btn(), fontSize: 11, padding: "2px 6px" }} onClick={() => setFilterText("")}>✕</button>}
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <button style={{ ...css.btn(), fontSize: 11 }} onClick={exportCSV} title="Export table as CSV">↓ CSV</button>
          <button style={{ ...css.btn(), fontSize: 11 }} onClick={() => importCSVRef.current?.click()} title="Import rows from CSV">↑ CSV</button>
          <input ref={importCSVRef} type="file" accept=".csv,text/csv" style={{ display: "none" }} onChange={importCSV} />
        </div>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", tableLayout: "auto" }}>
          <thead>
            <tr>
              <th onClick={() => cycleSort("__id__")} style={{ padding: "6px 8px", borderBottom: `2px solid ${T.accent}`, textAlign: "left", fontSize: 11, color: sortCol === "__id__" ? T.accentBright : T.accent, fontWeight: "bold", letterSpacing: "0.06em", whiteSpace: "nowrap", width: 36, cursor: "pointer", userSelect: "none" }}>
                # {sortCol === "__id__" ? (sortDir === "asc" ? "▲" : "▼") : <span style={{ opacity: 0.3 }}>⇅</span>}
              </th>
              {columns.map(col => {
                const isActive = sortCol === col.id;
                return (
                  <th key={col.id} onClick={() => cycleSort(col.id)} style={{ padding: "6px 8px", borderBottom: `2px solid ${T.accent}`, textAlign: "left", fontSize: 11, color: isActive ? T.accentBright : T.accent, fontWeight: "bold", letterSpacing: "0.06em", whiteSpace: "nowrap", cursor: "pointer", userSelect: "none" }}>
                    {col.label.toUpperCase()} {isActive ? (sortDir === "asc" ? "▲" : "▼") : <span style={{ opacity: 0.3 }}>⇅</span>}
                  </th>
                );
              })}
              <th style={{ width: 32, borderBottom: `2px solid ${T.accent}` }} />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} style={{ padding: "16px 8px", textAlign: "center", color: T.textMuted, fontSize: 11 }}>
                  No rows yet — click + Row to add one.
                </td>
              </tr>
            ) : sortedRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} style={{ padding: "16px 8px", textAlign: "center", color: T.textMuted, fontSize: 11 }}>
                  No rows match "{filterText}".
                </td>
              </tr>
            ) : sortedRows.map(({ row, idx: rowIdx }) => (
              <tr key={rowIdx} style={{ borderBottom: `1px solid ${T.border}` }}>
                <td style={{ padding: "4px 6px", verticalAlign: "middle", fontSize: 11, color: T.textDim, textAlign: "center", width: 36 }}>{rowIdx + 1}</td>
                {columns.map(col => {
                  const rowValue = row[col.id];
                  return (
                    <td key={col.id} style={{ padding: "4px 6px", verticalAlign: "middle" }}>
                      {col.type === "checkbox" ? (
                        <input
                          type="checkbox"
                          checked={rowValue === true || rowValue === "true"}
                          onChange={e => setCellValue(rowIdx, col.id, e.target.checked)}
                        />
                      ) : col.type === "paragraph" ? (
                        <textarea
                          style={{ ...css.textarea, fontSize: 12, width: "100%", minWidth: 120, minHeight: 60, boxSizing: "border-box", resize: "vertical" }}
                          value={rowValue ?? ""}
                          onChange={e => setCellValue(rowIdx, col.id, e.target.value)}
                          placeholder={col.defaultValue || ""}
                        />
                      ) : (
                        <input
                          type={col.type === "number" ? "number" : "text"}
                          step={col.type === "number" ? "any" : undefined}
                          style={{ ...css.input, fontSize: 12, width: "100%", minWidth: 80, boxSizing: "border-box" }}
                          value={rowValue ?? ""}
                          onChange={e => setCellValue(rowIdx, col.id, e.target.value)}
                          placeholder={col.defaultValue || ""}
                        />
                      )}
                    </td>
                  );
                })}
                <td style={{ padding: "4px 6px", verticalAlign: "middle", textAlign: "center" }}>
                  <button style={{ ...css.btn("danger"), padding: "2px 6px", fontSize: 11 }} onClick={() => removeRow(rowIdx)}>×</button>
                </td>
              </tr>
            ))}
          </tbody>
          {hasSummary && (
            <tfoot>
              <tr>
                <td style={{ borderTop: `2px solid ${T.border}` }} />
                {summaryValues.map((value, idx) => (
                  <td key={columns[idx].id} style={{ padding: "6px 8px", borderTop: `2px solid ${T.border}`, fontSize: 11, color: T.textDim, whiteSpace: "nowrap" }}>
                    {value !== "" ? value : ""}
                  </td>
                ))}
                <td style={{ borderTop: `2px solid ${T.border}` }} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

function MissionSection({ sec, sectionData, onChange, onImageUpload, expanded }) {
  const T = useTheme(); const css = makeCSS(T);

  if (sec.type === "table") {
    return <TableSection sec={sec} sectionData={sectionData} onChange={(newData) => onChange(undefined, newData)} />;
  }

  if (sec.type === "waypoints") {
    const handleChange = (specialKey, v) => {
      const raw = (typeof sectionData === "object" && sectionData !== null && !Array.isArray(sectionData)) ? sectionData : {};
      if (specialKey === "__waypoints_count__") {
        onChange(undefined, { ...raw, count: v });
      } else if (specialKey?.startsWith("__waypoints_wp__")) {
        const label = specialKey.slice("__waypoints_wp__".length);
        onChange(undefined, { ...raw, waypoints: { ...(raw.waypoints || {}), [label]: v } });
      }
    };
    return <WaypointsSection sec={sec} sectionData={sectionData} onChange={handleChange} />;
  }

  const getVal = (sh) => {
    if (typeof sectionData === "object" && sectionData !== null) return sectionData[sh] || "";
    return "";
  };
  const flatVal = typeof sectionData === "string" ? sectionData : (typeof sectionData === "object" && sectionData !== null ? "" : sectionData || "");

  return (
    <div style={{ ...css.section, marginBottom: 12 }}>
      <div style={{ marginBottom: 10 }}>
        <span style={{ color: T.accentBright, fontWeight: "bold", fontSize: 13, letterSpacing: "0.1em" }}>{sec.name.toUpperCase()}</span>
      </div>
      {sec.subheaders.length > 0
        ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 12 }}>
            {sec.subheaders.map(sh => (
              <SubBox key={sh} label={sh} value={getVal(sh)} onChange={v => onChange(sh, v)}
                onImageUpload={() => onImageUpload(sh)} expanded={expanded} T={T} css={css} />
            ))}
          </div>
        )
        : <SubBox label={sec.name} value={flatVal} onChange={v => onChange(undefined, v)}
            onImageUpload={() => onImageUpload(undefined)} expanded={expanded} T={T} css={css} />
      }
    </div>
  );
}

function CostsAwards({ costs, awards, onAddCost, onAddAward, onUpdateCost, onUpdateAward, onRemoveCost, onRemoveAward }) {
  const T = useTheme(); const css = makeCSS(T);
  const tc = costs.reduce((s, c) => s + (Number(c.amount) || 0), 0);
  const ta = awards.reduce((s, a) => s + (Number(a.amount) || 0), 0);
  const sections = [
    { key: "costs", label: "COSTS", sign: "▼", color: T.danger, items: costs, onAdd: onAddCost, onUpdate: onUpdateCost, onRemove: onRemoveCost, total: tc },
    { key: "awards", label: "AWARDS", sign: "▲", color: T.accent, items: awards, onAdd: onAddAward, onUpdate: onUpdateAward, onRemove: onRemoveAward, total: ta },
  ];
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
        {sections.map(({ key, label, sign, color, items, onAdd, onUpdate, onRemove, total }) => (
          <div key={key} style={css.section}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ color, fontWeight: "bold", fontSize: 12, letterSpacing: "0.1em" }}>{sign} {label}</span>
              <button style={css.btn()} onClick={onAdd}>+ Add</button>
            </div>
            {items.map(item => (
              <div key={item.id} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                <input style={{ ...css.input, flex: 2, fontSize: 11 }} placeholder="Label" value={item.label} onChange={e => onUpdate(item.id, "label", e.target.value)} />
                <input style={{ ...css.input, flex: 1, fontSize: 11 }} type="number" placeholder="Amount" value={item.amount} onChange={e => onUpdate(item.id, "amount", e.target.value)} />
                <button style={{ ...css.btn("danger"), padding: "2px 6px" }} onClick={() => onRemove(item.id)}>×</button>
              </div>
            ))}
            {items.length > 0 && <div style={{ textAlign: "right", color, fontSize: 12, marginTop: 6 }}>Total: {total.toLocaleString()}</div>}
          </div>
        ))}
      </div>
      {(tc > 0 || ta > 0) && (
        <div style={{ textAlign: "right", fontSize: 12, color: ta - tc >= 0 ? T.accent : T.danger, paddingTop: 4 }}>
          Net: {(ta - tc).toLocaleString()} C-Bills
        </div>
      )}
    </div>
  );
}

export function SchemaEditor({ campaign, onUpdate }) {
  const T = useTheme(); const css = makeCSS(T);
  const add = () => onUpdate(c => ({ ...c, sectionSchema: [...c.sectionSchema, { id: uid(), name: "New Section", type: "text", subheaders: [] }] }));
  const upd = (id, f, v) => onUpdate(c => ({ ...c, sectionSchema: c.sectionSchema.map(s => s.id === id ? { ...s, [f]: v } : s) }));
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
      {campaign.sectionSchema.map((sec, i) => <SchemaSectionRow key={sec.id} sec={sec} isFirst={i === 0} isLast={i === campaign.sectionSchema.length - 1} onChange={(f, v) => upd(sec.id, f, v)} onRemove={() => del(sec.id)} onMove={d => move(sec.id, d)} />)}
      {campaign.sectionSchema.length === 0 && <div style={{ color: T.textDim, textAlign: "center", padding: 32 }}>No sections defined. Mission pages will be free-form.</div>}
    </div>
  );
}

function SchemaSectionRow({ sec, isFirst, isLast, onChange, onRemove, onMove }) {
  const T = useTheme(); const css = makeCSS(T);
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

  const addColumn = () => {
    const label = newColLabel.trim();
    if (!label) return;
    onChange("columns", [...(sec.columns || []), { id: uid(), label, defaultValue: "", type: newColType, summary: newColType === "number" ? "sum" : newColType === "checkbox" ? "count" : "none" }]);
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
    <div style={{ ...css.section, marginBottom: 10 }}>
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
                      summary: e.target.value === "number" ? (c.summary || "sum") : e.target.value === "checkbox" ? (c.summary || "count") : "none",
                    } : c))}>
                    <option value="text">Text</option>
                    <option value="paragraph">Paragraph</option>
                    <option value="number">Number</option>
                    <option value="checkbox">Checkbox</option>
                  </select>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ fontSize: 9, color: T.textDim, fontWeight: "bold" }}>DEFAULT</span>
                  <input style={{ ...css.input, fontSize: 11 }} placeholder="Default value" value={col.defaultValue || ""}
                    onChange={e => onChange("columns", (sec.columns || []).map(c => c.id === col.id ? { ...c, defaultValue: e.target.value } : c))} />
                </div>
              </div>
              {["text", "number", "checkbox"].includes(col.type) && (
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 9, color: T.textDim, fontWeight: "bold" }}>SUMMARY</span>
                <select style={{ ...css.input, fontSize: 11 }} value={col.summary || "none"}
                  onChange={e => onChange("columns", (sec.columns || []).map(c => c.id === col.id ? { ...c, summary: e.target.value } : c))}>
                  <option value="none">None</option>
                  {col.type === "text" && (
                    <option value="count">Entry count</option>
                  )}
                  {col.type === "number" && (
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
            </select>
            <button style={{ ...css.btn(), background: "#4caf50", color: "white", padding: "2px 8px", fontSize: 14, minWidth: 32 }} onClick={addColumn}>✓</button>
          </div>
          <div style={{ fontSize: 10, color: T.textDim, marginTop: 12, padding: "8px", background: T.surface2, borderRadius: T.radius }}>
            <strong style={{ color: T.textMuted }}>Column types:</strong> Text (single line), Paragraph (multiline, no summary), Number (Sum/Avg/Min/Max), Checkbox (count). Choose a summary option to show aggregated values below the table.
          </div>
        </>
      )}
      {!isWaypoints && !isTable && (
        <>
          <div style={css.label}>Subheaders:</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
            {(sec.subheaders || []).map(sh => (
              <span key={sh} style={{ ...css.tag, cursor: "pointer" }} onClick={() => onChange("subheaders", (sec.subheaders || []).filter(s => s !== sh))}>{sh} ×</span>
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
