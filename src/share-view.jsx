import { useState, useEffect, useRef } from "react";
import { THEMES, ThemeCtx, makeCSS, useTheme, useThemeCSS } from "./theme.js";
import { loadShareData, patchShareField } from "./storage.js";
import { renderMarkdown } from "./markdown.js";
import { ModalOverlay } from "./ui.jsx";

// ── CSS Safety Modal ──────────────────────────────────────────────────────────

function CssSafetyModal({ campaignName, onAccept, onDecline }) {
  const [checked, setChecked] = useState(false);
  const T = THEMES.materialLight;

  return (
    <ModalOverlay zIndex={9999}>
      <div style={{ background: "#fff", borderRadius: 8, padding: 32, maxWidth: 520, width: "100%", color: "#111", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ fontSize: 20, fontWeight: "bold", marginBottom: 12, color: "#cc0000" }}>⚠ GM Custom CSS Active</div>
        <div style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 16, color: "#333" }}>
          The campaign <strong>{campaignName || "you are viewing"}</strong> has custom CSS enabled by the GM.
        </div>
        <div style={{ background: "#fff3cd", border: "1px solid #ffc107", borderRadius: 6, padding: 14, marginBottom: 16, fontSize: 12, lineHeight: 1.7, color: "#333" }}>
          <strong>Custom CSS can:</strong>
          <ul style={{ margin: "6px 0 0", paddingLeft: 20 }}>
            <li>Change any visual element on this page</li>
            <li>Hide this warning or other safety indicators</li>
            <li>Relabel buttons and links</li>
            <li>Make the page look like a login screen or other site</li>
          </ul>
          <div style={{ marginTop: 10 }}>
            If the campaign has player-editable fields, a malicious GM could use CSS to make them look like password prompts.
          </div>
          <div style={{ marginTop: 10, fontWeight: "bold" }}>
            Only proceed if you trust the person who shared this link.
          </div>
        </div>
        <label style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 20, cursor: "pointer", fontSize: 12, lineHeight: 1.5, color: "#333" }}>
          <input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} style={{ marginTop: 2, flexShrink: 0 }} />
          I understand the GM can change the appearance of this page in arbitrary ways, including creating forms that look like login prompts. I trust the source of this link.
        </label>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onDecline} style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid #ccc", background: "#f5f5f5", cursor: "pointer", fontSize: 13, fontFamily: "system-ui" }}>
            Continue without custom CSS
          </button>
          <button onClick={onAccept} disabled={!checked} style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid #cc0000", background: checked ? "#cc0000" : "#eee", color: checked ? "#fff" : "#999", cursor: checked ? "pointer" : "not-allowed", fontSize: 13, fontFamily: "system-ui" }}>
            Apply custom CSS
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

// ── Read-only section renderers ───────────────────────────────────────────────

function ShareTextSection({ sec, sectionData, onSave, T, css }) {
  const [drafts, setDrafts] = useState({});
  const [saving, setSaving] = useState(false);

  const subheaders = sec.subheaders || [];
  const hasSubheaders = subheaders.length > 0;
  const content = typeof sectionData === "object" && sectionData !== null ? sectionData : {};

  const handleSave = async (subheader) => {
    if (!onSave) return;
    setSaving(true);
    try { await onSave({ type: "text", sectionId: sec.id, subheader, value: drafts[subheader] ?? content[subheader] ?? "" }); }
    catch { }
    setSaving(false);
  };

  const renderField = (subheader, value) => {
    if (sec.playerEditable) {
      const draft = drafts[subheader] ?? value ?? "";
      return (
        <div key={subheader}>
          {subheader && <div style={{ ...css.label, marginBottom: 4 }}>{subheader}</div>}
          <textarea style={{ ...css.textarea, minHeight: 80 }} value={draft}
            onChange={e => setDrafts(d => ({ ...d, [subheader]: e.target.value }))} />
          <button style={{ ...css.btn("primary"), fontSize: 11, marginTop: 4 }} onClick={() => handleSave(subheader)} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      );
    }
    return (
      <div key={subheader}>
        {subheader && <div style={{ fontSize: 11, fontWeight: "bold", color: T.textDim, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>{subheader}</div>}
        <div style={{ lineHeight: 1.7, fontSize: 13, color: T.text }} dangerouslySetInnerHTML={{ __html: renderMarkdown(value || "", T) }} />
      </div>
    );
  };

  if (!hasSubheaders) {
    return (
      <div style={{ ...css.section }}>
        <div style={{ fontSize: 13, fontWeight: "bold", color: T.accentBright, marginBottom: 10 }}>{sec.name}</div>
        {renderField("", content[""] || content[sec.name] || "")}
      </div>
    );
  }

  return (
    <div style={{ ...css.section }}>
      <div style={{ fontSize: 13, fontWeight: "bold", color: T.accentBright, marginBottom: 12 }}>{sec.name}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
        {subheaders.map(sh => renderField(sh, content[sh] || ""))}
      </div>
    </div>
  );
}

function ShareWaypointsSection({ sec, sectionData, onSave, T, css }) {
  const [drafts, setDrafts] = useState({});
  const [saving, setSaving] = useState({});
  const count = sectionData?.count || 0;
  const waypoints = sectionData?.waypoints || {};
  const labels = Object.keys(waypoints);

  const handleSave = async (label) => {
    if (!onSave) return;
    setSaving(s => ({ ...s, [label]: true }));
    try { await onSave({ type: "waypoint", sectionId: sec.id, label, value: drafts[label] ?? waypoints[label] ?? "" }); }
    catch { }
    setSaving(s => ({ ...s, [label]: false }));
  };

  if (labels.length === 0) return null;

  return (
    <div style={{ ...css.section }}>
      <div style={{ fontSize: 13, fontWeight: "bold", color: T.accentBright, marginBottom: 12 }}>{sec.name}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
        {labels.map(label => (
          <div key={label} style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: 10 }}>
            <div style={{ fontSize: 10, fontWeight: "bold", color: T.accent, marginBottom: 6, letterSpacing: "0.08em" }}>{label}</div>
            {sec.playerEditable ? (
              <>
                <textarea style={{ ...css.textarea, minHeight: 60, fontSize: 12 }} value={drafts[label] ?? waypoints[label] ?? ""}
                  onChange={e => setDrafts(d => ({ ...d, [label]: e.target.value }))} />
                <button style={{ ...css.btn("primary"), fontSize: 10, marginTop: 4 }} onClick={() => handleSave(label)} disabled={saving[label]}>
                  {saving[label] ? "…" : "Save"}
                </button>
              </>
            ) : (
              <div style={{ fontSize: 12, color: T.text, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{waypoints[label] || ""}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ShareTableSection({ sec, sectionData, T, css }) {
  const columns = sec.columns || [];
  const rows = sectionData?.rows || [];
  if (columns.length === 0 || rows.length === 0) return null;

  return (
    <div style={{ ...css.section }}>
      <div style={{ fontSize: 13, fontWeight: "bold", color: T.accentBright, marginBottom: 12 }}>{sec.name}</div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr>
              {columns.map(col => (
                <th key={col.id} style={{ textAlign: "left", padding: "6px 10px", background: T.surface2, border: `1px solid ${T.border}`, color: T.textDim, fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase" }}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${T.border}` }}>
                {columns.map(col => (
                  <td key={col.id} style={{ padding: "6px 10px", color: T.text, border: `1px solid ${T.border}`, verticalAlign: "top" }}>
                    {col.type === "checkbox"
                      ? <input type="checkbox" checked={!!row[col.id]} readOnly />
                      : String(row[col.id] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SharePageView({ page, schema, shareGuid, T, css }) {
  const handleSave = async (patch) => {
    await patchShareField(shareGuid, page.id, patch);
  };

  if (page.type === "free") {
    return (
      <div>
        <h2 style={{ margin: "0 0 16px", color: T.accentBright, fontSize: 18 }}>{page.name}</h2>
        <div style={{ lineHeight: 1.7, color: T.text }} dangerouslySetInnerHTML={{ __html: renderMarkdown(page.content || "", T) }} />
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ margin: "0 0 16px", color: T.accentBright, fontSize: 18 }}>{page.name}</h2>
      {(page.tags || []).length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
          {page.tags.map(tag => <span key={tag} style={{ ...css.tag }}>{tag}</span>)}
        </div>
      )}
      {schema.map(sec => {
        const sectionData = (page.sections || {})[sec.id];
        if (sec.type === "text") return <ShareTextSection key={sec.id} sec={sec} sectionData={sectionData} onSave={sec.playerEditable ? handleSave : null} T={T} css={css} />;
        if (sec.type === "waypoints") return <ShareWaypointsSection key={sec.id} sec={sec} sectionData={sectionData} onSave={sec.playerEditable ? handleSave : null} T={T} css={css} />;
        if (sec.type === "table") return <ShareTableSection key={sec.id} sec={sec} sectionData={sectionData} T={T} css={css} />;
        return null;
      })}
      {((page.costs || []).length > 0 || (page.awards || []).length > 0) && (
        <div style={{ ...css.section }}>
          <div style={{ fontSize: 13, fontWeight: "bold", color: T.accentBright, marginBottom: 10 }}>Costs &amp; Awards</div>
          <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
            {(page.costs || []).length > 0 && (
              <div>
                <div style={{ ...css.label }}>Costs</div>
                {page.costs.map((c, i) => <div key={i} style={{ fontSize: 12, color: T.danger }}>▼ {c.label}: {c.amount}</div>)}
              </div>
            )}
            {(page.awards || []).length > 0 && (
              <div>
                <div style={{ ...css.label }}>Awards</div>
                {page.awards.map((a, i) => <div key={i} style={{ fontSize: 12, color: T.accent }}>▲ {a.label}: {a.amount}</div>)}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

function ShareSidebar({ pages, selectedId, onSelect, T, css }) {
  const sorted = [...pages].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const renderTree = (parentId, depth) => {
    const children = sorted.filter(p => (p.parentId ?? null) === parentId);
    return children.map(page => {
      const isPlaceholder = page.type === "placeholder";
      return (
        <div key={page.id}>
          <div
            onClick={() => !isPlaceholder && onSelect(page.id)}
            style={{
              padding: `6px ${8 + depth * 14}px`,
              cursor: isPlaceholder ? "default" : "pointer",
              fontSize: 12,
              color: isPlaceholder ? T.textDim : (selectedId === page.id ? T.accentBright : T.text),
              background: !isPlaceholder && selectedId === page.id ? T.surface2 : "transparent",
              borderLeft: !isPlaceholder && selectedId === page.id ? `3px solid ${T.accent}` : "3px solid transparent",
              borderRadius: T.radius,
              display: "flex", alignItems: "center", gap: 6,
              opacity: isPlaceholder ? 0.5 : 1,
            }}
          >
            <span style={{ fontSize: 9, color: isPlaceholder ? T.textDim : (page.type === "mission" ? T.accent : T.textDim) }}>
              {isPlaceholder ? "▢" : page.type === "mission" ? "⬟" : "◻"}
            </span>
            <span style={{ fontStyle: isPlaceholder ? "italic" : "normal" }}>{page.name}</span>
            {isPlaceholder && <span style={{ fontSize: 9, color: T.textDim }}>[hidden]</span>}
          </div>
          {renderTree(page.id, depth + 1)}
        </div>
      );
    });
  };

  return (
    <div style={{ ...css.sidebar, overflow: "auto" }}>
      <div style={{ padding: "12px 10px 8px", fontSize: 10, color: T.textDim, fontWeight: "bold", letterSpacing: "0.1em", textTransform: "uppercase" }}>
        Pages
      </div>
      {renderTree(null, 0)}
    </div>
  );
}

// ── Main ShareApp ─────────────────────────────────────────────────────────────

function ShareInner({ data, shareGuid }) {
  const { T, css } = useThemeCSS();
  const styleRef = useRef(null);
  const [selectedId, setSelectedId] = useState(() => {
    const sorted = [...(data.pages || [])].filter(p => p.type !== "placeholder").sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    return sorted[0]?.id || null;
  });

  useEffect(() => {
    if (styleRef.current) {
      styleRef.current.textContent = data.shareCustomCss || "";
    }
  }, [data.shareCustomCss]);

  const pages = data.pages || [];
  const schema = data.sectionSchema || [];
  const selectedPage = pages.find(p => p.id === selectedId && p.type !== "placeholder");
  const hasVisiblePages = pages.some(p => p.type !== "placeholder");

  return (
    <div style={{ ...css.app, minHeight: "100vh" }}>
      <style ref={styleRef} />
      <div style={{ ...css.topbar }}>
        <span style={{ fontWeight: "bold", color: T.accentBright, fontSize: 14 }}>{data.name || "Campaign"}</span>
        <span style={{ fontSize: 10, color: T.textMuted, marginLeft: 8 }}>Player View</span>
      </div>
      <div style={{ ...css.body }}>
        {hasVisiblePages && <ShareSidebar pages={pages} selectedId={selectedId} onSelect={setSelectedId} T={T} css={css} />}
        <div style={{ ...css.main }}>
          {!hasVisiblePages
            ? (
              <div style={{ color: T.textDim, textAlign: "center", padding: 64 }}>
                <div style={{ fontSize: 32, marginBottom: 16, opacity: 0.25 }}>◈</div>
                <div style={{ fontSize: 15, color: T.text, marginBottom: 8 }}>Nothing shared yet</div>
                <div style={{ fontSize: 13 }}>The GM hasn't made any pages visible to players.</div>
              </div>
            )
            : selectedPage
              ? <SharePageView page={selectedPage} schema={schema} shareGuid={shareGuid} T={T} css={css} />
              : <div style={{ color: T.textDim, textAlign: "center", padding: 48 }}>Select a page from the sidebar.</div>
          }
        </div>
      </div>
    </div>
  );
}

export function ShareApp({ shareGuid }) {
  const [state, setState] = useState("loading"); // loading | css-warn | ready | error
  const [data, setData] = useState(null);
  const [cssChoice, setCssChoice] = useState(null); // null | "yes" | "no"

  useEffect(() => {
    const timeout = setTimeout(() => setState("error"), 10000);
    loadShareData(shareGuid).then(result => {
      clearTimeout(timeout);
      if (!result) { setState("error"); return; }
      setData(result);
      if (result.shareCustomCss) {
        const stored = sessionStorage.getItem(`share-css-${shareGuid}`);
        if (stored) { setCssChoice(stored); setState("ready"); }
        else setState("css-warn");
      } else {
        setState("ready");
      }
    }).catch(() => { clearTimeout(timeout); setState("error"); });
  }, [shareGuid]);

  const handleCssAccept = () => {
    sessionStorage.setItem(`share-css-${shareGuid}`, "yes");
    setCssChoice("yes");
    setState("ready");
  };
  const handleCssDecline = () => {
    sessionStorage.setItem(`share-css-${shareGuid}`, "no");
    setCssChoice("no");
    setState("ready");
  };

  if (state === "loading") {
    return <div style={{ fontFamily: "system-ui", padding: 48, textAlign: "center", color: "#666" }}>Loading campaign…</div>;
  }
  if (state === "error") {
    return (
      <div style={{ fontFamily: "system-ui", padding: 48, textAlign: "center", color: "#666" }}>
        <div style={{ fontSize: 32, marginBottom: 16, opacity: 0.3 }}>◈</div>
        <div style={{ fontSize: 16, marginBottom: 8, color: "#333" }}>Campaign not found</div>
        <div style={{ fontSize: 13 }}>This share link may be invalid, or sharing may have been disabled by the GM.</div>
      </div>
    );
  }

  const theme = THEMES[data.shareTheme] || THEMES.plain || THEMES.materialLight;
  const injectCss = cssChoice === "yes" ? (data.shareCustomCss || "") : "";

  return (
    <ThemeCtx.Provider value={theme}>
      {state === "css-warn" && (
        <CssSafetyModal campaignName={data.name} onAccept={handleCssAccept} onDecline={handleCssDecline} />
      )}
      {state === "ready" && (
        <ShareInner data={{ ...data, shareCustomCss: injectCss }} shareGuid={shareGuid} />
      )}
    </ThemeCtx.Provider>
  );
}
