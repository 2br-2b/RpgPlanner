import DOMPurify from "dompurify";
import { Marked } from "marked";
import { THEMES } from "./theme.js";

// Shift heading levels so the largest heading in an embedded snippet doesn't
// dominate its surroundings (used by Markdown export, where a section/subheader
// header already sits above the body). Full-document contexts like the player
// share view opt out via { shiftHeadings: false } to mirror the editor's true
// heading sizes.
const shiftHeadingLevels = (text, minTarget = 3) => {
  const matches = [...text.matchAll(/^(#{1,6})\s+/gm)];
  if (!matches.length) return text;
  const minLevel = Math.min(...matches.map((m) => m[1].length));
  const shift = Math.max(0, minTarget - minLevel);
  if (!shift) return text;
  return text.replace(/^(#{1,6})\s+/gm, (_m, hashes) =>
    "#".repeat(Math.min(6, hashes.length + shift)) + " ");
};

const escapeHtml = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// A custom renderer so the parsed CommonMark keeps the theme's inline styles —
// the export path (io.jsx → print/PDF) depends on inline styles rather than a
// stylesheet. Unspecified methods fall back to marked's defaults via .use().
function makeRenderer(t) {
  const headingStyle = {
    1: `color:${t.accentBright};margin:16px 0 10px;font-size:1.4em;`,
    2: `color:${t.accent};margin:14px 0 8px;font-size:1.2em;`,
    3: `color:${t.textDim};margin:12px 0 6px;font-size:1.05em;`,
    4: `color:${t.textDim};margin:10px 0 4px;font-size:1em;`,
    5: `color:${t.textDim};margin:10px 0 4px;font-size:0.95em;`,
    6: `color:${t.textDim};margin:10px 0 4px;font-size:0.9em;`,
  };
  return {
    heading({ tokens, depth }) {
      return `<h${depth} style="font-weight:700;${headingStyle[depth] || headingStyle[6]}">${this.parser.parseInline(tokens)}</h${depth}>`;
    },
    paragraph({ tokens }) {
      return `<p style="margin:0 0 8px;line-height:1.7;">${this.parser.parseInline(tokens)}</p>`;
    },
    blockquote({ tokens }) {
      return `<blockquote style="border-left:3px solid ${t.accentDim};padding-left:12px;color:${t.textDim};margin:8px 0;">${this.parser.parse(tokens)}</blockquote>`;
    },
    code({ text }) {
      return `<pre style="background:${t.surface2};padding:10px;border-radius:4px;overflow-x:auto;margin:8px 0;"><code style="font-family:monospace;font-size:0.9em;">${escapeHtml(text)}</code></pre>`;
    },
    codespan({ text }) {
      return `<code style="background:${t.surface2};padding:2px 6px;border-radius:3px;font-family:monospace;font-size:0.9em;">${text}</code>`;
    },
    image({ href, title, text }) {
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
      return `<img src="${href}" alt="${escapeHtml(text || "")}"${titleAttr} style="max-width:100%;border-radius:4px;margin:8px 0;" />`;
    },
    hr() {
      return `<hr style="border:none;border-top:1px solid ${t.border};margin:16px 0;" />`;
    },
    table({ header, rows }) {
      const cell = (c, tag, extra) => `<${tag} style="border:1px solid ${t.border};padding:6px 10px;${extra}">${this.parser.parseInline(c.tokens)}</${tag}>`;
      const head = `<tr>${header.map((c) => cell(c, "th", `background:${t.surface2};text-align:left;`)).join("")}</tr>`;
      const body = rows.map((row) => `<tr>${row.map((c) => cell(c, "td", "")).join("")}</tr>`).join("");
      return `<table style="border-collapse:collapse;margin:8px 0;font-size:0.95em;"><thead>${head}</thead><tbody>${body}</tbody></table>`;
    },
    list(token) {
      const tag = token.ordered ? "ol" : "ul";
      const start = token.ordered && token.start !== 1 ? ` start="${token.start}"` : "";
      const items = token.items.map((item) => this.listitem(item)).join("");
      return `<${tag}${start} style="padding-left:20px;margin:6px 0;">${items}</${tag}>`;
    },
    listitem(item) {
      const inner = item.task
        ? `<input type="checkbox" disabled${item.checked ? " checked" : ""} style="margin-right:6px;" />${this.parser.parseInline(item.tokens)}`
        : this.parser.parse(item.tokens);
      return `<li style="margin:3px 0;">${inner}</li>`;
    },
  };
}

export function renderMarkdown(text, theme, opts = {}) {
  if (!text) return "";
  const t = theme || THEMES.tactical;
  const src = opts.shiftHeadings === false ? text : shiftHeadingLevels(text);
  const marked = new Marked({ gfm: true, breaks: false });
  marked.use({ renderer: makeRenderer(t) });
  const html = marked.parse(src);
  return DOMPurify.sanitize(html, { ADD_ATTR: ["style", "start", "checked", "disabled"] });
}
