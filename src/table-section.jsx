import { useRef, useState } from "react";
import { useThemeCSS } from "./theme.js";
import { evaluateFormula } from "./formula.js";

// Normalises checkbox storage — cells may be stored as boolean true or string "true".
const isChecked = (v) => v === true || v === "true";

export function TableSection({ sec, sectionData, onChange }) {
  const { T, css } = useThemeCSS();
  const columns = sec.columns || [];
  const raw = (typeof sectionData === "object" && sectionData !== null && !Array.isArray(sectionData)) ? sectionData : {};
  const rows = Array.isArray(raw.rows) ? raw.rows : [];
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState("asc");
  const [filterText, setFilterText] = useState("");

  const getDefaultValue = (col) => {
    if (col.type === "checkbox") return isChecked(col.defaultValue);
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
      if (col.type === "formula") return escape(evaluateFormula(col.formula, row, columns));
      const v = row[col.id];
      if (col.type === "checkbox") return isChecked(v) ? "true" : "false";
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
          const rawVal = vals[i] ?? "";
          if (col.type === "checkbox") row[col.id] = rawVal.toLowerCase() === "true";
          else if (col.type === "number") row[col.id] = rawVal === "" ? "" : Number(rawVal);
          else row[col.id] = rawVal;
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
      if (col.type === "checkbox") return isChecked(v) ? "checked".includes(q) : "unchecked".includes(q);
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
        else if (col?.type === "checkbox") cmp = (isChecked(av) ? 1 : 0) - (isChecked(bv) ? 1 : 0);
        else cmp = String(av ?? "").localeCompare(String(bv ?? ""));
        return sortDir === "asc" ? cmp : -cmp;
      })
    : filteredRows;

  const summaryValues = columns.map(col => {
    if (!col.summary || col.summary === "none") return "";
    if (col.type === "text") {
      if (col.summary === "count") {
        return rows.map(row => row[col.id]).filter(v => v !== undefined && v !== null && v !== "").length;
      }
      return "";
    }
    if (col.type === "number" || col.type === "formula") {
      const nums = rows.map(row => {
        const v = col.type === "formula" ? evaluateFormula(col.formula, row, columns) : row[col.id];
        const n = Number(v);
        return Number.isNaN(n) ? null : n;
      }).filter(n => n !== null);
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
      return rows.map(row => row[col.id]).filter(isChecked).length;
    }
    return "";
  });
  const hasSummary = summaryValues.some(value => value !== "");

  if (columns.length === 0) {
    return (
      <div className="sk-section" style={{ ...css.section, marginBottom: 12 }}>
        <span style={{ color: T.accentBright, fontWeight: "bold", fontSize: 13, letterSpacing: "0.1em" }}>{sec.name.toUpperCase()}</span>
        <div style={{ fontSize: 11, color: T.textDim, marginTop: 8 }}>No columns defined. Configure columns in the Section Schema.</div>
      </div>
    );
  }

  return (
    <div className="sk-section" style={{ ...css.section, marginBottom: 12 }}>
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
                      {col.type === "formula" ? (() => {
                        const result = evaluateFormula(col.formula, row, columns);
                        return (
                          <span style={{ fontSize: 12, color: result === "ERR" ? T.danger : T.accentBright, fontFamily: "monospace", whiteSpace: "nowrap" }} title={`Formula: ${col.formula || "(empty)"}`}>
                            {result === "" ? "—" : String(result)}
                          </span>
                        );
                      })() : col.type === "checkbox" ? (
                        <input
                          type="checkbox"
                          checked={isChecked(rowValue)}
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
                    {value}
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
