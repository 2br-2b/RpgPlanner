import { useState, useRef } from "react";
import { useThemeCSS, useIsMobile } from "./theme.js";
import { uid } from "./storage.js";
import { TableSection } from "./table-section.jsx";
import { WaypointsSection } from "./waypoints-section.jsx";
import { MilkdownEditor } from "./milkdown-editor.jsx";

export function OutlineView({ campaign, onSelect, onUpdate }) {
  const { T, css } = useThemeCSS();
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
        {filtered.map(page => <OutlineCard key={page.id} page={page} schema={campaign.sectionSchema} showCosts={campaign.showCostsInOutline !== false} onSelect={onSelect} onUpdate={onUpdate} onFilterByTag={tag => setFilterTag(filterTag === tag ? "" : tag)} />)}
      </div>
    </div>
  );
}

function OutlineCard({ page, schema, showCosts, onSelect, onUpdate, onFilterByTag }) {
  const { T, css } = useThemeCSS();
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
    <div className="sk-section" style={{ ...css.section, cursor: "pointer", transition: "border-color 0.15s" }}
      onMouseEnter={e => e.currentTarget.style.borderColor = T.accent}
      onMouseLeave={e => e.currentTarget.style.borderColor = T.border}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }} onClick={() => onSelect(page.id)}>
        <span style={{ fontSize: 10, color: page.type === "mission" ? T.accent : T.textDim }}>{page.type === "mission" ? "⬟ MISSION" : "◻ PAGE"}</span>
        <span style={{ flex: 1, fontWeight: "bold", fontSize: 14, color: T.accentBright }}>{page.name}</span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
        {(page.tags || []).map(tag => (
          <span key={tag} style={{ ...css.tag, display: "inline-flex", alignItems: "center", gap: 3 }}>
            <span style={{ cursor: "pointer" }} title="Filter by this tag" onClick={e => { e.stopPropagation(); onFilterByTag(tag); }}>{tag}</span>
            <span style={{ cursor: "pointer", opacity: 0.6 }} title="Remove tag"
              onClick={e => { e.stopPropagation(); onUpdate(c => ({ ...c, pages: c.pages.map(p => p.id === page.id ? { ...p, tags: p.tags.filter(t => t !== tag) } : p) })); }}>×</span>
          </span>
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

function PageVisibilityWarning({ onConfirm, onCancel }) {
  const [suppress, setSuppress] = useState(false);
  const T = { text: "#111", danger: "#cc0000", warn: "#cc7700", border: "#ddd" };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, padding: 24 }}>
      <div style={{ background: "#fff", borderRadius: 8, padding: 24, maxWidth: 420, width: "100%", color: T.text, fontFamily: "system-ui, sans-serif" }}>
        <div style={{ fontWeight: "bold", fontSize: 15, marginBottom: 10, color: T.warn }}>⚠ Make page visible to players?</div>
        <div style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>
          This page will be visible to anyone with the share link. Only player-visible fields will be shown.
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#555", marginBottom: 16, cursor: "pointer" }}>
          <input type="checkbox" checked={suppress} onChange={e => setSuppress(e.target.checked)} />
          Don't remind me this session
        </label>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={{ padding: "7px 14px", borderRadius: 6, border: "1px solid #ccc", background: "#f5f5f5", cursor: "pointer", fontFamily: "system-ui", fontSize: 13 }}>Cancel</button>
          <button onClick={() => onConfirm(suppress)} style={{ padding: "7px 14px", borderRadius: 6, border: "none", background: T.warn, color: "#fff", cursor: "pointer", fontFamily: "system-ui", fontSize: 13 }}>Make Visible</button>
        </div>
      </div>
    </div>
  );
}

function FieldVisibilityWarning({ onConfirm, onCancel }) {
  const [suppress, setSuppress] = useState(false);
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, padding: 24 }}>
      <div style={{ background: "#fff", borderRadius: 8, padding: 24, maxWidth: 380, width: "100%", color: "#111", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ fontWeight: "bold", fontSize: 14, marginBottom: 8, color: "#cc7700" }}>⚠ Show field to players?</div>
        <div style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>The page is already visible. This field will immediately become visible to players with the share link.</div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#555", marginBottom: 16, cursor: "pointer" }}>
          <input type="checkbox" checked={suppress} onChange={e => setSuppress(e.target.checked)} />
          Don't remind me this session
        </label>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #ccc", background: "#f5f5f5", cursor: "pointer", fontFamily: "system-ui", fontSize: 13 }}>Cancel</button>
          <button onClick={() => onConfirm(suppress)} style={{ padding: "6px 12px", borderRadius: 6, border: "none", background: "#cc7700", color: "#fff", cursor: "pointer", fontFamily: "system-ui", fontSize: 13 }}>Show Field</button>
        </div>
      </div>
    </div>
  );
}

export function PageEditor({ page, schema, onUpdate, onBack, shareEnabled }) {
  const { T, css } = useThemeCSS();
  const isMobile = useIsMobile();
  const [activeSection, setActiveSection] = useState(null);
  const [editTag, setEditTag] = useState("");
  const [showPageWarn, setShowPageWarn] = useState(false);
  const freeImgRef = useRef(null);
  const freeEditorRef = useRef(null);

  const set = (k, v) => onUpdate({ ...page, [k]: v });
  const setSection = (sid, subKey, v) => {
    if (subKey === undefined) {
      onUpdate({ ...page, sections: { ...page.sections, [sid]: v } });
    } else {
      const prev = (typeof page.sections[sid] === "object" && page.sections[sid] !== null) ? page.sections[sid] : {};
      onUpdate({ ...page, sections: { ...page.sections, [sid]: { ...prev, [subKey]: v } } });
    }
  };

  const handlePlayerVisibleToggle = (checked) => {
    if (checked && !sessionStorage.getItem("page-vis-warn-dismissed")) {
      setShowPageWarn(true);
    } else {
      set("playerVisible", checked);
    }
  };

  const setSectionOverride = (sectionId, value) => {
    const overrides = { ...(page.sectionVisibilityOverrides || {}), [sectionId]: value };
    set("sectionVisibilityOverrides", overrides);
  };

  const addTag = () => {
    const t = editTag.trim().toLowerCase();
    if (!t || (page.tags || []).includes(t)) { setEditTag(""); return; }
    set("tags", [...(page.tags || []), t]); setEditTag("");
  };

  const handleFreeImg = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const r = new FileReader();
    r.onload = (ev) => {
      freeEditorRef.current?.insertImage(ev.target.result, file.name);
    };
    r.readAsDataURL(file); e.target.value = "";
  };

  return (
    <div style={{ maxWidth: 860 }}>
      {showPageWarn && (
        <PageVisibilityWarning
          onConfirm={(suppress) => {
            if (suppress) sessionStorage.setItem("page-vis-warn-dismissed", "1");
            set("playerVisible", true);
            setShowPageWarn(false);
          }}
          onCancel={() => setShowPageWarn(false)}
        />
      )}
      {isMobile && onBack && (
        <button style={{ ...css.btn(), marginBottom: 12, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }} onClick={onBack}>← Outline</button>
      )}
      <input style={{ ...css.input, fontSize: "clamp(16px, 4vw, 20px)", fontWeight: "bold", marginBottom: 12, color: T.accentBright, maxWidth: "100%", boxSizing: "border-box" }} value={page.name} onChange={e => set("name", e.target.value)} />
      {shareEnabled && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, padding: "8px 12px", background: page.playerVisible ? T.surface2 : "transparent", border: `1px solid ${page.playerVisible ? T.accent : T.border}`, borderRadius: T.radius }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12, color: T.textDim }}>
            <input type="checkbox" checked={page.playerVisible || false}
              onChange={e => handlePlayerVisibleToggle(e.target.checked)}
              style={{ accentColor: T.accent, width: 14, height: 14 }} />
            Show this page to players
          </label>
          {page.playerVisible && <span style={{ fontSize: 10, color: T.accent, fontWeight: "bold", letterSpacing: "0.08em" }}>SHARED</span>}
        </div>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16, alignItems: "center" }}>
        <span style={{ ...css.label, margin: 0 }}>Tags:</span>
        {(page.tags || []).map(tag => <span key={tag} style={{ ...css.tag, cursor: "pointer" }} onClick={() => set("tags", page.tags.filter(t => t !== tag))}>{tag} ×</span>)}
        <input style={{ ...css.input, width: 100, fontSize: 11, padding: "2px 6px" }} placeholder="+ add tag" value={editTag}
          onChange={e => setEditTag(e.target.value)} onKeyDown={e => e.key === "Enter" && addTag()} />
      </div>

      {page.type === "free" && (
        <div>
          <input ref={freeImgRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFreeImg} />
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <button style={css.btn()} onClick={() => freeImgRef.current?.click()}>🖼 Image</button>
          </div>
          <MilkdownEditor ref={freeEditorRef} value={page.content || ""} onChange={v => set("content", v)} minHeight={400} />
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
              shareEnabled={shareEnabled} page={page} onOverride={setSectionOverride} />
          ))}
          {activeSection !== null && activeSection !== "__costs" && (() => {
            const sec = schema.find(s => s.id === activeSection);
            return sec ? <MissionSection sec={sec} sectionData={page.sections[sec.id]}
              onChange={(subKey, v) => setSection(sec.id, subKey, v)} expanded
              shareEnabled={shareEnabled} page={page} onOverride={setSectionOverride} /> : null;
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

function SubBox({ label, value, onChange, expanded, shareEnabled, sec, subheader, page, onOverride }) {
  const { T, css } = useThemeCSS();
  const [showWarn, setShowWarn] = useState(false);
  const [pendingVis, setPendingVis] = useState(null);
  const imgRef = useRef(null);
  const editorRef = useRef(null);

  const handleImg = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const r = new FileReader();
    r.onload = (ev) => {
      editorRef.current?.insertImage(ev.target.result, file.name);
    };
    r.readAsDataURL(file); e.target.value = "";
  };

  // Per-subheader visibility
  let subheaderVisible = null;
  let subheaderVisibleEffective = false;
  if (shareEnabled && sec && subheader && onOverride) {
    const overrides = page?.sectionVisibilityOverrides || {};
    const secOverride = overrides[sec.id];
    if (typeof secOverride === "object" && secOverride !== null && subheader in secOverride) {
      subheaderVisibleEffective = secOverride[subheader] === true;
    } else if (typeof secOverride === "boolean") {
      subheaderVisibleEffective = secOverride;
    } else {
      subheaderVisibleEffective = (sec.playerVisibleSubheaders || []).includes(subheader);
    }

    const setSubVis = (val) => {
      const secOverrideObj = (typeof secOverride === "object" && secOverride !== null) ? secOverride : {};
      const newOverride = { ...secOverrideObj, [subheader]: val };
      onOverride(sec.id, newOverride);
    };
    const trySetVis = (val) => {
      if (val && page?.playerVisible && !sessionStorage.getItem("field-vis-warn-dismissed")) {
        setPendingVis(val); setShowWarn(true);
      } else {
        setSubVis(val);
      }
    };

    subheaderVisible = (
      <span style={{ fontSize: 9, color: subheaderVisibleEffective ? T.accent : T.textMuted, cursor: "pointer", userSelect: "none" }}
        title={subheaderVisibleEffective ? "Visible to players — click to hide" : "Hidden from players — click to show"}
        onClick={() => trySetVis(!subheaderVisibleEffective)}>
        {subheaderVisibleEffective ? "👁" : "🚫"}
      </span>
    );
  }

  return (
    <>
      {showWarn && (
        <FieldVisibilityWarning
          onConfirm={(suppress) => {
            if (suppress) sessionStorage.setItem("field-vis-warn-dismissed", "1");
            const overrides = page?.sectionVisibilityOverrides || {};
            const secOverride = overrides[sec.id];
            const secOverrideObj = (typeof secOverride === "object" && secOverride !== null) ? secOverride : {};
            onOverride(sec.id, { ...secOverrideObj, [subheader]: pendingVis });
            setShowWarn(false);
          }}
          onCancel={() => { setShowWarn(false); setPendingVis(null); }}
        />
      )}
      <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        <input ref={imgRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleImg} />
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: T.accent, fontWeight: "bold", letterSpacing: "0.08em", flex: 1 }}>{label.toUpperCase()}</span>
          {subheaderVisible}
          <button style={{ ...css.btn(), fontSize: 10, padding: "2px 6px" }} onClick={() => imgRef.current?.click()}>🖼</button>
        </div>
        <MilkdownEditor ref={editorRef} value={value} onChange={onChange} minHeight={expanded ? 400 : 200} />
      </div>
    </>
  );
}

function SectionVisibilityBadge({ sec, page, onOverride, T, css }) {
  const [showWarn, setShowWarn] = useState(false);
  const [pendingOverride, setPendingOverride] = useState(null);

  const overrides = page?.sectionVisibilityOverrides || {};
  const override = overrides[sec.id];
  const schemaDefault = sec.playerVisible || false;
  const effective = typeof override === "boolean" ? override : schemaDefault;
  const isOverridden = override !== undefined;

  const trySet = (value) => {
    if (value && page?.playerVisible && !sessionStorage.getItem("field-vis-warn-dismissed")) {
      setPendingOverride(value);
      setShowWarn(true);
    } else {
      onOverride(sec.id, value);
    }
  };

  const label = effective ? "👁 Visible" : "🚫 Hidden";
  const color = effective ? T.accent : T.textMuted;

  return (
    <>
      {showWarn && (
        <FieldVisibilityWarning
          onConfirm={(suppress) => {
            if (suppress) sessionStorage.setItem("field-vis-warn-dismissed", "1");
            onOverride(sec.id, pendingOverride);
            setShowWarn(false);
          }}
          onCancel={() => { setShowWarn(false); setPendingOverride(null); }}
        />
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color }}>
        <span title={isOverridden ? "Overriding schema default" : "Using schema default"}>{label}{isOverridden ? " (override)" : ""}</span>
        <button style={{ ...css.btn(), fontSize: 9, padding: "1px 5px" }} onClick={() => trySet(!effective)}>toggle</button>
        {isOverridden && <button style={{ ...css.btn(), fontSize: 9, padding: "1px 5px" }} onClick={() => onOverride(sec.id, undefined)} title="Reset to schema default">reset</button>}
      </div>
    </>
  );
}

function MissionSection({ sec, sectionData, onChange, expanded, shareEnabled, page, onOverride }) {
  const { T, css } = useThemeCSS();

  if (sec.type === "table") {
    return (
      <div>
        {shareEnabled && onOverride && <div style={{ marginBottom: 4 }}><SectionVisibilityBadge sec={sec} page={page} onOverride={onOverride} T={T} css={css} /></div>}
        <TableSection sec={sec} sectionData={sectionData} onChange={(newData) => onChange(undefined, newData)} />
      </div>
    );
  }

  if (sec.type === "waypoints") {
    const handleChange = (specialKey, v) => {
      const raw = (typeof sectionData === "object" && sectionData !== null && !Array.isArray(sectionData)) ? sectionData : {};
      if (specialKey === "__waypoints_count__") {
        onChange(undefined, { ...raw, count: v });
      } else if (specialKey?.startsWith("__waypoints_wp__")) {
        const label = specialKey.slice("__waypoints_wp__".length);
        onChange(undefined, { ...raw, waypoints: { ...(raw.waypoints || {}), [label]: v } });
      } else if (specialKey === "__waypoints_vis_obj__") {
        onChange(undefined, { ...raw, waypointVisibility: v });
      } else if (specialKey?.startsWith("__waypoints_vis__")) {
        const label = specialKey.slice("__waypoints_vis__".length);
        onChange(undefined, { ...raw, waypointVisibility: { ...(raw.waypointVisibility || {}), [label]: v } });
      }
    };
    return (
      <div>
        {shareEnabled && onOverride && <div style={{ marginBottom: 4 }}><SectionVisibilityBadge sec={sec} page={page} onOverride={onOverride} T={T} css={css} /></div>}
        <WaypointsSection sec={sec} sectionData={sectionData} onChange={handleChange} showVisibility={shareEnabled} />
      </div>
    );
  }

  const getVal = (sh) => {
    if (typeof sectionData === "object" && sectionData !== null) return sectionData[sh] || "";
    return "";
  };
  const flatVal = typeof sectionData === "string" ? sectionData : (typeof sectionData === "object" && sectionData !== null ? "" : sectionData || "");

  return (
    <div className="sk-section" style={{ ...css.section, marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <span style={{ color: T.accentBright, fontWeight: "bold", fontSize: 13, letterSpacing: "0.1em", flex: 1 }}>{sec.name.toUpperCase()}</span>
        {shareEnabled && onOverride && <SectionVisibilityBadge sec={sec} page={page} onOverride={onOverride} T={T} css={css} />}
      </div>
      {sec.subheaders.length > 0
        ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 12 }}>
            {sec.subheaders.map(sh => (
              <SubBox key={sh} label={sh} value={getVal(sh)} onChange={v => onChange(sh, v)} expanded={expanded}
                shareEnabled={shareEnabled} sec={sec} subheader={sh} page={page} onOverride={onOverride} />
            ))}
          </div>
        )
        : <SubBox label={sec.name} value={flatVal} onChange={v => onChange(undefined, v)} expanded={expanded} />
      }
    </div>
  );
}

function CostsAwards({ costs, awards, onAddCost, onAddAward, onUpdateCost, onUpdateAward, onRemoveCost, onRemoveAward }) {
  const { T, css } = useThemeCSS();
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
          <div key={key} className="sk-section" style={css.section}>
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
