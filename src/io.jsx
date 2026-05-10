import { useState, useRef } from "react";
import { useThemeCSS, THEMES } from "./theme.js";
import { SCHEMA_VERSION, migrateCampaign, pageCostTotal, pageAwardTotal } from "./storage.js";
import { renderMarkdown } from "./markdown.js";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
  WidthType, BorderStyle, AlignmentType,
} from "docx";

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

// ── Import validation ─────────────────────────────────────────────────────────

export function validateImport(data) {
  if (typeof data !== "object" || !data) return "Not an object";
  if (typeof data.name !== "string") return "Missing name";
  if (!Array.isArray(data.sectionSchema)) return "Missing sectionSchema";
  if (!Array.isArray(data.pages)) return "Missing pages";
  const v = data.schemaVersion || 1;
  if (v > SCHEMA_VERSION) return `Saved with a newer version (v${v}). Update the app to import.`;
  return null;
}

// ── Markdown export ───────────────────────────────────────────────────────────

function buildMarkdownLines(campaign, hideEmpty, hidePlayerHidden) {
  const lines = [`# ${campaign.name}`, `_Campaign export — ${new Date().toLocaleDateString()}_\n`];
  for (const page of campaign.pages) {
    lines.push(`---\n## ${page.name}`);
    lines.push(`**Type:** ${page.type}${page.tags?.length ? `  |  **Tags:** ${page.tags.join(", ")}` : ""}\n`);
    if (page.type === "mission") {
      for (const sec of campaign.sectionSchema) {
        const raw = page.sections?.[sec.id];
        if (!isSectionVisible(sec, page, hidePlayerHidden)) continue;
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
        const net = pageAwardTotal(page) - pageCostTotal(page);
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

function exportMarkdown(campaign, hideEmpty, hidePlayerHidden) {
  const lines = buildMarkdownLines(campaign, hideEmpty, hidePlayerHidden);
  const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `${campaign.name.replace(/\s+/g, "_")}.campaign.md` });
  a.click(); URL.revokeObjectURL(a.href);
}

// ── HTML / Print / PDF ────────────────────────────────────────────────────────

function escapeHtml(str) {
  return String(str ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function buildPrintHTML(campaign, hideEmpty, themeKey = "plain", hidePlayerHidden = false) {
  const printTheme = THEMES[themeKey] || THEMES.plain;
  const sections = [];

  for (const page of campaign.pages) {
    const parts = [];
    parts.push(`<h2>${escapeHtml(page.name)}</h2>`);
    if (page.tags?.length) parts.push(`<p style="color:#555;font-size:11px">Tags: ${page.tags.map(escapeHtml).join(", ")}</p>`);

    if (page.type === "mission") {
      for (const sec of campaign.sectionSchema) {
        const raw = page.sections?.[sec.id];
        if (!isSectionVisible(sec, page, hidePlayerHidden)) continue;
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
              parts.push(renderMarkdown(v || "", printTheme));
            });
          } else {
            const v = typeof raw === "string" ? raw : "";
            if (!hideEmpty || v.trim()) parts.push(renderMarkdown(v, printTheme));
          }
        }
      }
      const costs = page.costs || [], awards = page.awards || [];
      if (costs.length || awards.length) {
        parts.push("<h3>Costs &amp; Awards</h3><ul>");
        costs.forEach(c => parts.push(`<li>Cost: ${escapeHtml(c.label)} — ${Number(c.amount).toLocaleString()} C-Bills</li>`));
        awards.forEach(a => parts.push(`<li>Award: ${escapeHtml(a.label)} — ${Number(a.amount).toLocaleString()} C-Bills</li>`));
        const net = pageAwardTotal(page) - pageCostTotal(page);
        parts.push(`<li><strong>Net: ${net.toLocaleString()} C-Bills</strong></li></ul>`);
      }
    } else {
      const content = (page.content || "").replace(/!\[[^\]]*\]\(data:[^)]+\)/g, "[image]");
      if (!hideEmpty || content.trim()) parts.push(renderMarkdown(content, printTheme));
    }

    sections.push(`<section style="page-break-after:always">${parts.join("\n")}</section>`);
  }

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(campaign.name)}</title>
<style>
  body { font-family: Georgia, serif; max-width: 800px; margin: 0 auto; padding: 24px; color: #111; }
  h1 { font-size: 24px; border-bottom: 2px solid #333; padding-bottom: 8px; }
  h2 { font-size: 18px; margin-top: 32px; border-bottom: 1px solid #999; }
  h3 { font-size: 14px; color: #444; margin-top: 16px; }
  h4 { font-size: 12px; color: #666; margin: 12px 0 4px; }
  p { margin: 4px 0; line-height: 1.6; }
  ul, ol { margin: 6px 0; padding-left: 24px; }
  li { margin: 2px 0; }
  blockquote { border-left: 3px solid #aaa !important; padding-left: 12px !important; color: #555 !important; margin: 8px 0 !important; font-style: italic; }
  code { background: #f0f0f0 !important; padding: 2px 5px; border-radius: 3px; font-family: monospace; font-size: 0.9em; }
  table { border-collapse: collapse; width: 100%; margin: 8px 0; font-size: 12px; }
  th { background: #f0f0f0; border: 1px solid #ccc; padding: 4px 8px; text-align: left; }
  td { border: 1px solid #ddd; padding: 4px 8px; }
  hr { border: none; border-top: 1px solid #ccc; margin: 12px 0; }
  @media print { section { page-break-after: always; } }
</style></head><body>
<h1>${escapeHtml(campaign.name)}</h1>
<p style="color:#666;font-size:12px">Exported ${new Date().toLocaleDateString()}</p>
${sections.join("\n")}
</body></html>`;
}

function printCampaign(campaign, hideEmpty, themeKey = "plain", hidePlayerHidden = false) {
  const html = buildPrintHTML(campaign, hideEmpty, themeKey, hidePlayerHidden);
  const w = window.open("", "_blank");
  if (!w) { alert("Pop-up blocked — allow pop-ups for this site to use Print."); return; }
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
}

function exportHTML(campaign, hideEmpty, themeKey = "plain", hidePlayerHidden = false) {
  const html = buildPrintHTML(campaign, hideEmpty, themeKey, hidePlayerHidden);
  const blob = new Blob([html], { type: "text/html" });
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(blob),
    download: `${campaign.name.replace(/\s+/g, "_")}.html`,
  });
  a.click();
  URL.revokeObjectURL(a.href);
}

async function exportPDF(campaign, hideEmpty, themeKey, setWorking, hidePlayerHidden = false) {
  setWorking(true);
  try {
    const html = buildPrintHTML(campaign, hideEmpty, themeKey, hidePlayerHidden);
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;left:-9999px;top:0;width:850px;height:1px;border:none;visibility:hidden;";
    document.body.appendChild(iframe);
    await new Promise(resolve => {
      iframe.onload = resolve;
      iframe.contentDocument.open();
      iframe.contentDocument.write(html);
      iframe.contentDocument.close();
    });
    const body = iframe.contentDocument.body;
    const fullHeight = Math.max(body.scrollHeight, body.offsetHeight);
    iframe.style.height = fullHeight + "px";
    iframe.style.visibility = "visible";
    await new Promise(r => setTimeout(r, 200));
    const canvas = await html2canvas(body, { scale: 2, useCORS: true, width: 850, windowWidth: 850 });
    document.body.removeChild(iframe);
    const imgData = canvas.toDataURL("image/jpeg", 0.92);
    const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgH = (canvas.height / canvas.width) * pageW;
    let y = 0;
    while (y < imgH) {
      if (y > 0) pdf.addPage();
      pdf.addImage(imgData, "JPEG", 0, -y, pageW, imgH);
      y += pageH;
    }
    pdf.save(`${campaign.name.replace(/\s+/g, "_")}.pdf`);
  } finally {
    setWorking(false);
  }
}

// ── Word export ───────────────────────────────────────────────────────────────

function mdRunsFromText(text) {
  // Parse inline markdown into TextRun array (bold, italic, plain)
  const runs = [];
  const re = /\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`|(.+?)(?=\*\*|\*|`|$)/gs;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (!m[0]) continue;
    if (m[1]) runs.push(new TextRun({ text: m[1], bold: true }));
    else if (m[2]) runs.push(new TextRun({ text: m[2], italics: true }));
    else if (m[3]) runs.push(new TextRun({ text: m[3], font: "Courier New", size: 18 }));
    else if (m[4]) runs.push(new TextRun({ text: m[4] }));
  }
  return runs.length ? runs : [new TextRun({ text })];
}

function textToDocxParagraphs(text) {
  if (!text) return [new Paragraph("")];
  return text.split("\n").map(line => {
    if (/^### (.+)/.test(line)) return new Paragraph({ text: line.slice(4), heading: HeadingLevel.HEADING_3 });
    if (/^## (.+)/.test(line)) return new Paragraph({ text: line.slice(3), heading: HeadingLevel.HEADING_2 });
    if (/^# (.+)/.test(line)) return new Paragraph({ text: line.slice(2), heading: HeadingLevel.HEADING_1 });
    if (/^> (.+)/.test(line)) return new Paragraph({ children: [new TextRun({ text: line.slice(2), italics: true, color: "555555" })], indent: { left: 720 } });
    if (/^[-*] (.+)/.test(line)) return new Paragraph({ children: mdRunsFromText(line.slice(2)), bullet: { level: 0 } });
    return new Paragraph({ children: mdRunsFromText(line) });
  });
}

async function exportWord(campaign, hideEmpty, hidePlayerHidden = false) {
  const children = [
    new Paragraph({ text: campaign.name, heading: HeadingLevel.TITLE }),
    new Paragraph({ children: [new TextRun({ text: `Exported ${new Date().toLocaleDateString()}`, italics: true, color: "666666" })] }),
    new Paragraph(""),
  ];

  for (const page of campaign.pages) {
    children.push(new Paragraph({ text: page.name, heading: HeadingLevel.HEADING_1 }));
    if (page.tags?.length) children.push(new Paragraph({ children: [new TextRun({ text: `Tags: ${page.tags.join(", ")}`, italics: true, color: "555555", size: 20 })] }));

    if (page.type === "mission") {
      for (const sec of campaign.sectionSchema) {
        const raw = page.sections?.[sec.id];
        if (!isSectionVisible(sec, page, hidePlayerHidden)) continue;
        if (hideEmpty && isSectionEmpty(sec, raw)) continue;
        children.push(new Paragraph({ text: sec.name, heading: HeadingLevel.HEADING_2 }));

        if (sec.type === "table") {
          const columns = (sec.columns || []).filter(c => c.type !== "formula");
          if (columns.length > 0 && typeof raw === "object" && raw?.rows?.length > 0) {
            const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
            const borders = { top: border, bottom: border, left: border, right: border };
            const headerRow = new TableRow({
              children: columns.map(c => new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: c.label, bold: true })] })],
                borders, shading: { fill: "F0F0F0" },
              })),
            });
            const dataRows = raw.rows.map(row => new TableRow({
              children: columns.map(c => new TableCell({
                children: [new Paragraph(String(row[c.id] ?? ""))],
                borders,
              })),
            }));
            children.push(new Table({ rows: [headerRow, ...dataRows], width: { size: 100, type: WidthType.PERCENTAGE } }));
          } else {
            children.push(new Paragraph({ children: [new TextRun({ text: "No content", italics: true })] }));
          }
        } else if (sec.type === "waypoints") {
          if (typeof raw === "object" && raw !== null) {
            const count = Math.min(26, Math.max(1, Number(raw.count) || 1));
            const wps = raw.waypoints || {};
            const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".slice(0, count).split("").filter(l => wps[l]);
            letters.forEach(l => children.push(new Paragraph({ children: [new TextRun({ text: `${l}: `, bold: true }), new TextRun(wps[l])], bullet: { level: 0 } })));
          }
        } else {
          if (typeof raw === "object" && raw !== null && sec.subheaders?.length > 0) {
            sec.subheaders.forEach(sh => {
              const v = raw[sh];
              if (!v && hideEmpty) return;
              children.push(new Paragraph({ text: sh, heading: HeadingLevel.HEADING_3 }));
              children.push(...textToDocxParagraphs(v || ""));
            });
          } else {
            const v = typeof raw === "string" ? raw : "";
            if (!hideEmpty || v.trim()) children.push(...textToDocxParagraphs(v));
          }
        }
      }
      const costs = page.costs || [], awards = page.awards || [];
      if (costs.length || awards.length) {
        children.push(new Paragraph({ text: "Costs & Awards", heading: HeadingLevel.HEADING_2 }));
        costs.forEach(c => children.push(new Paragraph({ children: [new TextRun(`Cost: ${c.label} — ${Number(c.amount).toLocaleString()} C-Bills`)], bullet: { level: 0 } })));
        awards.forEach(a => children.push(new Paragraph({ children: [new TextRun(`Award: ${a.label} — ${Number(a.amount).toLocaleString()} C-Bills`)], bullet: { level: 0 } })));
        const net = pageAwardTotal(page) - pageCostTotal(page);
        children.push(new Paragraph({ children: [new TextRun({ text: `Net: ${net.toLocaleString()} C-Bills`, bold: true })], bullet: { level: 0 } }));
      }
    } else {
      const content = (page.content || "").replace(/!\[[^\]]*\]\(data:[^)]+\)/g, "[image]");
      if (!hideEmpty || content.trim()) children.push(...textToDocxParagraphs(content));
    }
    children.push(new Paragraph(""));
  }

  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(blob),
    download: `${campaign.name.replace(/\s+/g, "_")}.docx`,
  });
  a.click();
  URL.revokeObjectURL(a.href);
}

// ── Export dropdown ───────────────────────────────────────────────────────────

const FORMATS = [
  { key: "pdf",      label: "PDF",                    themed: true  },
  { key: "print",    label: "Print",                  themed: true  },
  { key: "html",     label: "HTML",                   themed: true  },
  { key: "word",     label: "Word (.docx)",           themed: false },
  { key: "markdown", label: "Markdown",               themed: false },
  { key: "json",     label: "JSON (full data)",       themed: false },
];

const CACHE_KEY = "campaign-manager-export-prefs";

function loadExportPrefs() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY)) || {}; } catch { return {}; }
}
function saveExportPrefs(prefs) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(prefs)); } catch {}
}

export function ExportDropdown({ campaign, currentPage }) {
  const { T, css } = useThemeCSS();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        style={{ ...css.btn(), fontSize: 11, padding: "3px 10px", height: 26, flexShrink: 0 }}
        onClick={() => setOpen(true)}
      >
        ⬇ Export
      </button>
      {open && <ExportModal campaign={campaign} currentPage={currentPage} onClose={() => setOpen(false)} T={T} css={css} />}
    </>
  );
}

function filterCampaignForExport(campaign, scope, hidePlayerHidden) {
  let pages = scope === "page-only" && campaign._currentPage
    ? [campaign._currentPage]
    : campaign.pages;

  if (hidePlayerHidden) {
    pages = pages.filter(p => p.playerVisible);
  }

  return { ...campaign, pages };
}

function isSectionVisible(sec, page, hidePlayerHidden) {
  if (!hidePlayerHidden) return true;
  const overrides = page.sectionVisibilityOverrides || {};
  return overrides[sec.id] !== undefined ? overrides[sec.id] : (sec.playerVisible || false);
}

function ExportModal({ campaign, currentPage, onClose, T, css }) {
  const prefs = loadExportPrefs();
  const [format, setFormat] = useState(prefs.format || "pdf");
  const [themeKey, setThemeKey] = useState(prefs.theme || "plain");
  const [hideEmpty, setHideEmpty] = useState(prefs.hideEmpty ?? false);
  const [hidePlayerHidden, setHidePlayerHidden] = useState(prefs.hidePlayerHidden ?? false);
  const [scope, setScope] = useState(prefs.scope || "all");
  const [working, setWorking] = useState(false);

  const fmt = FORMATS.find(f => f.key === format) || FORMATS[0];

  const persist = (patch) => {
    const next = { format, themeKey, hideEmpty, hidePlayerHidden, scope, ...patch };
    saveExportPrefs({ format: next.format, theme: next.themeKey, hideEmpty: next.hideEmpty, hidePlayerHidden: next.hidePlayerHidden, scope: next.scope });
  };

  const handleFormat = (v) => { setFormat(v); persist({ format: v }); };
  const handleTheme = (v) => { setThemeKey(v); persist({ themeKey: v }); };
  const handleHideEmpty = (v) => { setHideEmpty(v); persist({ hideEmpty: v }); };
  const handleHidePlayerHidden = (v) => { setHidePlayerHidden(v); persist({ hidePlayerHidden: v }); };
  const handleScope = (v) => { setScope(v); persist({ scope: v }); };

  const buildCampaign = () => {
    const c = scope === "page-only" && currentPage
      ? { ...campaign, pages: [currentPage] }
      : campaign;
    return c;
  };

  const run = async () => {
    const c = buildCampaign();
    switch (format) {
      case "pdf":      await exportPDF(c, hideEmpty, themeKey, setWorking, hidePlayerHidden); break;
      case "print":    printCampaign(c, hideEmpty, themeKey, hidePlayerHidden); break;
      case "html":     exportHTML(c, hideEmpty, themeKey, hidePlayerHidden); break;
      case "word":     await exportWord(c, hideEmpty, hidePlayerHidden); break;
      case "markdown": exportMarkdown(c, hideEmpty, hidePlayerHidden); break;
      case "json":     exportJSON(c); break;
    }
    if (format !== "print") onClose();
  };

  const labelStyle = { fontSize: 12, color: T.textDim, marginBottom: 4, display: "block" };
  const rowStyle = { marginBottom: 14 };
  const checkRowStyle = { display: "flex", alignItems: "center", gap: 8, marginBottom: 14, cursor: "pointer" };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ ...css.section, width: 320, padding: 24, borderRadius: T.radius, boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <span style={{ fontSize: 15, fontWeight: "bold", color: T.accentBright }}>Export</span>
          <button style={{ ...css.btn(), padding: "2px 8px", fontSize: 13 }} onClick={onClose}>✕</button>
        </div>

        <div style={rowStyle}>
          <label style={labelStyle}>Format</label>
          <select value={format} onChange={e => handleFormat(e.target.value)} style={{ ...css.input, width: "100%" }}>
            {FORMATS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>
        </div>

        {fmt.themed && (
          <div style={rowStyle}>
            <label style={labelStyle}>Theme</label>
            <select value={themeKey} onChange={e => handleTheme(e.target.value)} style={{ ...css.input, width: "100%" }}>
              {Object.entries(THEMES).map(([key, t]) => <option key={key} value={key}>{t.label}</option>)}
            </select>
          </div>
        )}

        <div style={rowStyle}>
          <label style={labelStyle}>Pages</label>
          <select value={scope} onChange={e => handleScope(e.target.value)} style={{ ...css.input, width: "100%" }}>
            <option value="all">Whole campaign</option>
            <option value="page-only" disabled={!currentPage}>{currentPage ? `Current page: ${currentPage.name}` : "Current page (none open)"}</option>
          </select>
        </div>

        <label style={checkRowStyle}>
          <input type="checkbox" checked={hidePlayerHidden} onChange={e => handleHidePlayerHidden(e.target.checked)} />
          <span style={{ fontSize: 12, color: T.text }}>Hide sections not visible to players</span>
        </label>

        <label style={checkRowStyle}>
          <input type="checkbox" checked={hideEmpty} onChange={e => handleHideEmpty(e.target.checked)} />
          <span style={{ fontSize: 12, color: T.text }}>Hide empty sections</span>
        </label>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
          <button style={{ ...css.btn(), fontSize: 13 }} onClick={onClose}>Cancel</button>
          <button style={{ ...css.btn("primary"), fontSize: 13 }} onClick={run} disabled={working}>
            {working ? "Generating…" : "⬇ Export"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── JSON import helper (used by Settings) ─────────────────────────────────────

export function ImportButton({ campaign, onImport }) {
  const { T, css } = useThemeCSS();
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(null);
  const fileRef = useRef(null);

  const handleFile = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        const err = validateImport(data);
        if (err) { setError(err); setPreview(null); return; }
        setError(""); setPreview(data);
      } catch { setError("Invalid JSON"); setPreview(null); }
    };
    reader.readAsText(file); e.target.value = "";
  };

  return (
    <div>
      <input ref={fileRef} type="file" accept=".json" style={{ display: "none" }} onChange={handleFile} />
      <button style={{ ...css.btn(), fontSize: 11 }} onClick={() => fileRef.current?.click()}>⬆ Import JSON…</button>
      {error && <div style={{ color: T.danger, fontSize: 11, marginTop: 6 }}>✕ {error}</div>}
      {preview && (
        <div style={{ marginTop: 8 }}>
          <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: 10, marginBottom: 8 }}>
            <div style={{ fontSize: 11, color: T.textDim, marginBottom: 4 }}>Ready to import:</div>
            <div style={{ fontSize: 13, color: T.accentBright, fontWeight: "bold" }}>{preview.name}</div>
            <div style={{ fontSize: 11, color: T.textDim }}>{preview.pages.length} pages · {preview.sectionSchema.length} sections</div>
            <div style={{ fontSize: 10, color: T.danger, marginTop: 6 }}>⚠ This will replace your current campaign data.</div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button style={{ ...css.btn("danger"), fontSize: 11 }}
              onClick={() => { onImport(migrateCampaign({ ...preview, theme: preview.theme || campaign.theme })); setPreview(null); }}>
              Replace with import
            </button>
            <button style={{ ...css.btn(), fontSize: 11 }} onClick={() => setPreview(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
