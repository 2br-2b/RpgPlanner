import { THEMES } from "./theme.js";

const normalizeMarkdownHeadingLevels = (text) => {
  const matches = [...text.matchAll(/^(#{1,6})\s+/gm)];
  if (!matches.length) return text;

  const minLevel = Math.min(...matches.map((m) => m[1].length));
  const shift = Math.max(0, 3 - minLevel);
  if (!shift) return text;

  return text.replace(/^(#{1,6})\s+/gm, (match, hashes) => {
    const level = Math.min(6, hashes.length + shift);
    return "#".repeat(level) + " ";
  });
};

export function renderMarkdown(text, theme) {
  if (!text) return "";
  text = normalizeMarkdownHeadingLevels(text);
  const t = theme || THEMES.tactical;
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%;border-radius:4px;margin:8px 0;" />')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, `<code style="background:${t.surface2};padding:2px 6px;border-radius:3px;font-family:monospace;font-size:0.9em;">$1</code>`)
    .replace(/^### (.+)$/gm, `<h3 style="color:${t.textDim};margin:12px 0 6px;font-size:1em;">$1</h3>`)
    .replace(/^## (.+)$/gm, `<h2 style="color:${t.accent};margin:14px 0 8px;font-size:1.1em;">$1</h2>`)
    .replace(/^# (.+)$/gm, `<h1 style="color:${t.accentBright};margin:16px 0 10px;font-size:1.3em;">$1</h1>`)
    .replace(/^&gt; (.+)$/gm, `<blockquote style="border-left:3px solid ${t.accentDim};padding-left:12px;color:${t.textDim};margin:8px 0;">$1</blockquote>`)
    .replace(/^\s*[-*] (.+)$/gm, '<li style="margin:3px 0;padding-left:8px;">$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li style="margin:3px 0;padding-left:8px;list-style-type:decimal;">$1</li>')
    .replace(/^---$/gm, `<hr style="border:none;border-top:1px solid ${t.border};margin:16px 0;" />`)
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br/>");

  html = html.replace(/(<li[^>]*>.*?<\/li>(?:<br\/>)*)+/g, (match) => (
    `<ul style="padding-left:20px;margin:6px 0;">${match.replace(/<br\/>/g, "")}</ul>`
  ));
  return `<p style="margin:0;line-height:1.7;">${html}</p>`;
}
