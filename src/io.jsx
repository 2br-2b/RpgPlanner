import { useState, useRef } from "react";
import { useThemeCSS } from "./theme.js";
import { SCHEMA_VERSION, migrateCampaign } from "./storage.js";

// ── helpers ───────────────────────────────────────────────────────────────────

function isSectionEmpty(sec, raw) {
  if (sec.type === "table") {
    return !(typeof raw === "object" && raw !== null && Array.isArray(raw.rows) && raw.rows.length > 0);
  }
  if (sec.type === "waypoints") {
    if (typeof raw !== "object" || raw === null) return true;
    const wps = raw.waypoints || {};
    return !Object.values(wps).some(v => v && String(v).trim());
  }
  if (typeof raw === "object" && raw !== null) {
    return !sec.subheaders.some(sh => raw[sh] && String(raw[sh]).trim());
  }
  return !raw || !String(raw).trim();
}

// ── JSON export ───────────────────────────────────────────────────────────────

function exportJSON(campaign) {
  const stamped = { ...campaign, schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(stamped, null, 2)], { type: "application/json" });
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `${stamped.name.replace(/\s+/g, "_")}.campaign.json` });
  a.click(); URL.revokeObjectURL(a.href);
}

// ── Markdown export ───────────────────────────────────────────────────────────

function buildMarkdownLines(campaign, hideEmpty) {
  const lines = [`# ${campaign.name}`, `_Campaign export — ${new Date().toLocaleDateString()}_\n`];
  for (const page of campaign.pages) {
    lines.push(`---\n## ${page.name}`);
    lines.push(`**Type:** ${page.type}${page.tags?.length ? `  |  **Tags:** ${page.tags.join(", ")}` : ""}\n`);
    if (page.type === "mission") {
      for (const sec of campaign.sectionSchema) {
        const raw = page.sections?.[sec.id];
        if (hideEmpty && isSectionEmpty(sec, raw)) continue;
        lines.push(`### ${sec.name}`);
        if (sec.type === "table") {
          const columns = (sec.columns || []).filter(c => c.type !== "formula");
          if (columns.length === 0) {
            lines.push("_No columns defined_");
          } else if (typeof raw === "object" && raw !== null && Array.isArray(raw.rows) && raw.rows.length > 0) {
            lines.push("| " + columns.map(c => c.label).join(" | ") + " |");
            lines.push("| " + columns.map(() => "---").join(" | ") + " |");
            for (const row of raw.rows) {
              lines.push("| " + columns.map(c => String(row[c.id] ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ")).join(" | ") + " |");
            }
          } else {
            lines.push("_No content_");
          }
        } else if (sec.type === "waypoints") {
          if (typeof raw === "object" && raw !== null) {
            const count = Math.min(26, Math.max(1, Number(raw.count) || 1));
            const wps = raw.waypoints || {};
            const entries = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".slice(0, count).split("").filter(l => wps[l]).map(l => `- **${l}**: ${wps[l].replace(/\n/g, " ")}`);
            entries.length > 0 ? lines.push(...entries) : lines.push("_No content_");
          } else {
            lines.push("_No content_");
          }
        } else {
          if (typeof raw === "object" && raw !== null) {
            const hasAny = sec.subheaders.some(sh => raw[sh]);
            if (hasAny) {
              sec.subheaders.forEach(sh => {
                if (raw[sh]) lines.push(`#### ${sh}\n${raw[sh].replace(/!\[[^\]]*\]\(data:[^)]+\)/g, "[image]")}`);
              });
            } else {
              lines.push("_No content_");
            }
          } else {
            lines.push(raw ? raw.replace(/!\[[^\]]*\]\(data:[^)]+\)/g, "[image]") : "_No content_");
          }
        }
        lines.push("");
      }
      const costs = page.costs || [], awards = page.awards || [];
      if (costs.length || awards.length) {
        lines.push("### Costs & Awards");
        costs.forEach(c => lines.push(`- Cost: ${c.label} — ${Number(c.amount).toLocaleString()} C-Bills`));
        awards.forEach(a => lines.push(`- Award: ${a.label} — ${Number(a.amount).toLocaleString()} C-Bills`));
        const net = awards.reduce((s, a) => s + Number(a.amount), 0) - costs.reduce((s, c) => s + Number(c.amount), 0);
        lines.push(`- **Net:** ${net.toLocaleString()} C-Bills\n`);
      }
    } else {
      const content = page.content ? page.content.replace(/!\[[^\]]*\]\(data:[^)]+\)/g, "[image]") : "";
      if (!hideEmpty || content.trim()) {
        lines.push(content || "_No content_");
      }
      lines.push("");
    }
  }
  if (campaign.flowchart.edges.length) {
    lines.push("---\n## Flowchart");
    for (const edge of campaign.flowchart.edges) {
      const fn = campaign.flowchart.nodes.find(n => n.id === edge.from);
      const tn = campaign.flowchart.nodes.find(n => n.id === edge.to);
      const fp = campaign.pages.find(p => p.id === fn?.pageId);
      const tp = campaign.pages.find(p => p.id === tn?.pageId);
      if (fp && tp) lines.push(`- **${fp.name}** → **${tp.name}**${edge.label ? ` _(${edge.label})_` : ""}`);
    }
  }
  return lines;
}

function exportMarkdown(campaign, hideEmpty) {
  const lines = buildMarkdownLines(campaign, hideEmpty);
  const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `${campaign.name.replace(/\s+/g, "_")}.campaign.md` });
  a.click(); URL.revokeObjectURL(a.href);
}

// ── Print ─────────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  return String(str ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function printCampaign(campaign, hideEmpty) {
  const sections = [];

  for (const page of campaign.pages) {
    const parts = [];
    parts.push(`<h2>${escapeHtml(page.name)}</h2>`);
    if (page.tags?.length) parts.push(`<p style="color:#555;font-size:11px">Tags: ${page.tags.map(escapeHtml).join(", ")}</p>`);

    if (page.type === "mission") {
      for (const sec of campaign.sectionSchema) {
        const raw = page.sections?.[sec.id];
        if (hideEmpty && isSectionEmpty(sec, raw)) continue;
        parts.push(`<h3>${escapeHtml(sec.name)}</h3>`);
        if (sec.type === "table") {
          const columns = (sec.columns || []).filter(c => c.type !== "formula");
          if (columns.length > 0 && typeof raw === "object" && raw?.rows?.length > 0) {
            parts.push("<table><thead><tr>" + columns.map(c => `<th>${escapeHtml(c.label)}</th>`).join("") + "</tr></thead><tbody>");
            for (const row of raw.rows) {
              parts.push("<tr>" + columns.map(c => `<td>${escapeHtml(row[c.id] ?? "")}</td>`).join("") + "</tr>");
            }
            parts.push("</tbody></table>");
          } else {
            parts.push("<p><em>No content</em></p>");
          }
        } else if (sec.type === "waypoints") {
          if (typeof raw === "object" && raw !== null) {
            const count = Math.min(26, Math.max(1, Number(raw.count) || 1));
            const wps = raw.waypoints || {};
            const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".slice(0, count).split("").filter(l => wps[l]);
            if (letters.length) {
              parts.push("<ul>" + letters.map(l => `<li><strong>${l}:</strong> ${escapeHtml(wps[l])}</li>`).join("") + "</ul>");
            } else {
              parts.push("<p><em>No content</em></p>");
            }
          }
        } else {
          if (typeof raw === "object" && raw !== null && sec.subheaders?.length > 0) {
            sec.subheaders.forEach(sh => {
              const v = raw[sh];
              if (!v && hideEmpty) return;
              parts.push(`<h4>${escapeHtml(sh)}</h4>`);
              parts.push(`<p>${escapeHtml(v || "").replace(/\n/g, "<br>")}</p>`);
            });
          } else {
            const v = typeof raw === "string" ? raw : "";
            if (!hideEmpty || v.trim()) parts.push(`<p>${escapeHtml(v).replace(/\n/g, "<br>")}</p>`);
          }
        }
      }
      const costs = page.costs || [], awards = page.awards || [];
      if (costs.length || awards.length) {
        parts.push("<h3>Costs &amp; Awards</h3><ul>");
        costs.forEach(c => parts.push(`<li>Cost: ${escapeHtml(c.label)} — ${Number(c.amount).toLocaleString()} C-Bills</li>`));
        awards.forEach(a => parts.push(`<li>Award: ${escapeHtml(a.label)} — ${Number(a.amount).toLocaleString()} C-Bills</li>`));
        const net = awards.reduce((s, a) => s + Number(a.amount), 0) - costs.reduce((s, c) => s + Number(c.amount), 0);
        parts.push(`<li><strong>Net: ${net.toLocaleString()} C-Bills</strong></li></ul>`);
      }
    } else {
      const content = page.content?.replace(/!\[[^\]]*\]\(data:[^)]+\)/g, "[image]") || "";
      if (!hideEmpty || content.trim()) parts.push(`<pre style="white-space:pre-wrap">${escapeHtml(content)}</pre>`);
    }

    sections.push(`<section style="page-break-after:always">${parts.join("\n")}</section>`);
  }

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(campaign.name)}</title>
<style>
  body { font-family: Georgia, serif; max-width: 800px; margin: 0 auto; padding: 24px; color: #111; }
  h1 { font-size: 24px; border-bottom: 2px solid #333; padding-bottom: 8px; }
  h2 { font-size: 18px; margin-top: 32px; border-bottom: 1px solid #999; }
  h3 { font-size: 14px; color: #444; margin-top: 16px; }
  h4 { font-size: 12px; color: #666; margin: 12px 0 4px; }
  table { border-collapse: collapse; width: 100%; margin: 8px 0; font-size: 12px; }
  th { background: #f0f0f0; border: 1px solid #ccc; padding: 4px 8px; text-align: left; }
  td { border: 1px solid #ddd; padding: 4px 8px; }
  pre { background: #f8f8f8; padding: 10px; font-size: 11px; }
  @media print { section { page-break-after: always; } }
</style></head><body>
<h1>${escapeHtml(campaign.name)}</h1>
<p style="color:#666;font-size:12px">Printed ${new Date().toLocaleDateString()}</p>
${sections.join("\n")}
</body></html>`;

  const w = window.open("", "_blank");
  if (!w) { alert("Pop-up blocked — allow pop-ups for this site to use Print."); return; }
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
}

// ── Import validation ─────────────────────────────────────────────────────────

function validateImport(data) {
  if (typeof data !== "object" || !data) return "Not an object";
  if (typeof data.name !== "string") return "Missing name";
  if (!Array.isArray(data.sectionSchema)) return "Missing sectionSchema";
  if (!Array.isArray(data.pages)) return "Missing pages";
  const v = data.schemaVersion || 1;
  if (v > SCHEMA_VERSION) return `Saved with a newer version (v${v}). Update the app to import.`;
  return null;
}

// ── Modal ─────────────────────────────────────────────────────────────────────

export function ImportExportModal({ campaign, onImport, onClose }) {
  const { T, css } = useThemeCSS();
  const [importError, setImportError] = useState("");
  const [importPreview, setImportPreview] = useState(null);
  const [hideEmpty, setHideEmpty] = useState(false);
  const fileRef = useRef(null);

  const handleFile = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        const err = validateImport(data);
        if (err) { setImportError(err); setImportPreview(null); return; }
        setImportError(""); setImportPreview(data);
      } catch { setImportError("Invalid JSON"); setImportPreview(null); }
    };
    reader.readAsText(file); e.target.value = "";
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: 24, width: 500, maxWidth: "90vw", fontFamily: T.font }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 20 }}>
          <span style={{ fontWeight: "bold", color: T.accentBright, letterSpacing: "0.1em", fontSize: 14 }}>EXPORT / IMPORT</span>
          <div style={{ flex: 1 }} />
          <button style={css.btn()} onClick={onClose}>✕</button>
        </div>

        {/* Options */}
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginBottom: 14 }}>
          <input type="checkbox" checked={hideEmpty} onChange={e => setHideEmpty(e.target.checked)} style={{ accentColor: T.accent, width: 13, height: 13 }} />
          <span style={{ fontSize: 12, color: T.textDim }}>Hide empty sections in Markdown export &amp; Print</span>
        </label>

        <div style={css.label}>Export</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
          <button style={{ ...css.btn("primary"), flex: 1 }} onClick={() => exportJSON(campaign)}>⬇ JSON (full data)</button>
          <button style={{ ...css.btn(), flex: 1 }} onClick={() => exportMarkdown(campaign, hideEmpty)}>⬇ Markdown</button>
          <button style={{ ...css.btn(), flex: 1 }} onClick={() => printCampaign(campaign, hideEmpty)}>⎙ Print / PDF</button>
        </div>
        <div style={{ fontSize: 10, color: T.textDim, marginBottom: 20 }}>JSON includes all data incl. images. Markdown &amp; Print strip base64 images to [image].</div>

        <div style={{ borderTop: `1px solid ${T.border}`, marginBottom: 16 }} />
        <div style={css.label}>Import JSON</div>
        <input ref={fileRef} type="file" accept=".json" style={{ display: "none" }} onChange={handleFile} />
        <button style={{ ...css.btn(), width: "100%", marginBottom: 8 }} onClick={() => fileRef.current?.click()}>⬆ Choose .json file…</button>
        {importError && <div style={{ color: T.danger, fontSize: 11, marginBottom: 8 }}>✕ {importError}</div>}
        {importPreview && (
          <>
            <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: 10, marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: T.textDim, marginBottom: 4 }}>Ready to import:</div>
              <div style={{ fontSize: 13, color: T.accentBright, fontWeight: "bold" }}>{importPreview.name}</div>
              <div style={{ fontSize: 11, color: T.textDim }}>{importPreview.pages.length} pages · {importPreview.sectionSchema.length} sections</div>
              <div style={{ fontSize: 10, color: T.danger, marginTop: 6 }}>⚠ This will replace your current campaign data.</div>
            </div>
            <button style={{ ...css.btn("danger"), width: "100%" }}
              onClick={() => { onImport(migrateCampaign({ ...importPreview, theme: importPreview.theme || campaign.theme })); onClose(); }}>
              Replace current campaign with import
            </button>
          </>
        )}
      </div>
    </div>
  );
}
