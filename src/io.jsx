import { useState, useRef } from "react";
import { useTheme, makeCSS } from "./theme.js";
import { SCHEMA_VERSION, migrateCampaign } from "./storage.js";

function exportJSON(campaign) {
  const stamped = { ...campaign, schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(stamped, null, 2)], { type: "application/json" });
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `${stamped.name.replace(/\s+/g, "_")}.campaign.json` });
  a.click(); URL.revokeObjectURL(a.href);
}

function exportMarkdown(campaign) {
  const lines = [`# ${campaign.name}`, `_Campaign export — ${new Date().toLocaleDateString()}_\n`];
  for (const page of campaign.pages) {
    lines.push(`---\n## ${page.name}`);
    lines.push(`**Type:** ${page.type}${page.tags?.length ? `  |  **Tags:** ${page.tags.join(", ")}` : ""}\n`);
    if (page.type === "mission") {
      for (const sec of campaign.sectionSchema) {
        const raw = page.sections?.[sec.id];
        lines.push(`### ${sec.name}`);
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
      lines.push(page.content ? page.content.replace(/!\[[^\]]*\]\(data:[^)]+\)/g, "[image]") : "_No content_");
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
  const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `${campaign.name.replace(/\s+/g, "_")}.campaign.md` });
  a.click(); URL.revokeObjectURL(a.href);
}

function validateImport(data) {
  if (typeof data !== "object" || !data) return "Not an object";
  if (typeof data.name !== "string") return "Missing name";
  if (!Array.isArray(data.sectionSchema)) return "Missing sectionSchema";
  if (!Array.isArray(data.pages)) return "Missing pages";
  const v = data.schemaVersion || 1;
  if (v > SCHEMA_VERSION) return `Saved with a newer version (v${v}). Update the app to import.`;
  return null;
}

export function ImportExportModal({ campaign, onImport, onClose }) {
  const T = useTheme();
  const css = makeCSS(T);
  const [importError, setImportError] = useState("");
  const [importPreview, setImportPreview] = useState(null);
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
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: 24, width: 480, maxWidth: "90vw", fontFamily: T.font }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 20 }}>
          <span style={{ fontWeight: "bold", color: T.accentBright, letterSpacing: "0.1em", fontSize: 14 }}>EXPORT / IMPORT</span>
          <div style={{ flex: 1 }} />
          <button style={css.btn()} onClick={onClose}>✕</button>
        </div>
        <div style={css.label}>Export</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
          <button style={{ ...css.btn("primary"), flex: 1 }} onClick={() => exportJSON(campaign)}>⬇ JSON (structured)</button>
          <button style={{ ...css.btn(), flex: 1 }} onClick={() => exportMarkdown(campaign)}>⬇ Markdown (readable)</button>
        </div>
        <div style={{ fontSize: 10, color: T.textDim, marginBottom: 20 }}>JSON includes all data incl. images. Markdown strips base64 images to [image] placeholders.</div>
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
