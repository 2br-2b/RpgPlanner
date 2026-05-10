import { useCallback, useEffect, useRef, useState } from "react";
import { FlowchartView } from "./flowchart.jsx";
import { ExportDropdown } from "./io.jsx";
import { OutlineView, PageEditor } from "./editor.jsx";
import { SchemaEditor } from "./schema-editor.jsx";
import { SettingsView } from "./settings.jsx";
import { Sidebar } from "./sidebar.jsx";
import { SimulatorView } from "./simulator.jsx";
import { ThemeCtx, THEMES, makeCSS, useIsMobile, useThemeCSS } from "./theme.js";
import { ThemePicker } from "./theme-picker.jsx";
import { useEscapeKey, ModalOverlay } from "./ui.jsx";
import {
  SESSION_GUID,
  defaultCampaign,
  loadData,
  migrateCampaign,
  saveData,
  getKnownCampaigns,
  switchCampaign,
  createNewCampaign,
  forgetCampaign,
  registerSaveFlush,
} from "./storage.js";

const NAV_ITEMS = [
  { key: "outline", icon: "=", label: "Outline" },
  { key: "schema", icon: "*", label: "Schema" },
  { key: "flowchart", icon: "o", label: "Flow" },
  { key: "simulate", icon: ">", label: "Simulate" },
  { key: "settings", icon: "#", label: "Settings" },
];


function SearchModal({ campaign, onNavigate, onClose, T, css }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEscapeKey(onClose);

  const q = query.trim().toLowerCase();
  const results = q
    ? campaign.pages.filter(p => p.name.toLowerCase().includes(q) || (p.tags || []).some(t => t.includes(q)))
    : campaign.pages.slice(0, 12);

  return (
    <ModalOverlay onClose={onClose} align="top" zIndex={2000}>
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radius, width: 480, maxWidth: "90vw", boxShadow: "0 8px 40px rgba(0,0,0,0.6)", overflow: "hidden" }}>
        <div style={{ padding: "10px 14px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: T.textDim, fontSize: 14 }}>⌕</span>
          <input ref={inputRef} style={{ ...css.input, border: "none", background: "transparent", fontSize: 14, padding: 0, flex: 1 }}
            placeholder="Search pages…" value={query} onChange={e => setQuery(e.target.value)} />
          <span style={{ fontSize: 10, color: T.textMuted }}>ESC</span>
        </div>
        <div style={{ maxHeight: 360, overflowY: "auto" }}>
          {results.length === 0 && (
            <div style={{ padding: "24px 16px", textAlign: "center", color: T.textDim, fontSize: 12 }}>No pages match "{query}"</div>
          )}
          {results.map((page, i) => (
            <div key={page.id} style={{ padding: "10px 16px", cursor: "pointer", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 10 }}
              onMouseEnter={e => e.currentTarget.style.background = T.surface2}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              onClick={() => { onNavigate(page.id); onClose(); }}>
              <span style={{ fontSize: 10, color: page.type === "mission" ? T.accent : T.textDim, flexShrink: 0 }}>{page.type === "mission" ? "⬟" : "◻"}</span>
              <span style={{ flex: 1, fontSize: 13 }}>{page.name}</span>
              {(page.tags || []).length > 0 && (
                <span style={{ fontSize: 10, color: T.textMuted }}>{page.tags.join(", ")}</span>
              )}
            </div>
          ))}
        </div>
        {!q && campaign.pages.length > 12 && (
          <div style={{ padding: "6px 16px", fontSize: 10, color: T.textMuted, borderTop: `1px solid ${T.border}` }}>Type to search all {campaign.pages.length} pages</div>
        )}
      </div>
    </ModalOverlay>
  );
}

function CampaignSwitcher({ current, onClose, T, css }) {
  const [campaigns, setCampaigns] = useState(() => getKnownCampaigns());
  const [confirmForget, setConfirmForget] = useState(null);

  useEscapeKey(onClose);

  const sorted = [...campaigns].sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0));

  return (
    <ModalOverlay onClose={onClose} zIndex={2000}>
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radius, width: 460, maxWidth: "90vw", boxShadow: "0 8px 40px rgba(0,0,0,0.6)", overflow: "hidden" }}>
        <div style={{ padding: "14px 16px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center" }}>
          <span style={{ fontWeight: "bold", color: T.accentBright, letterSpacing: "0.1em", fontSize: 13 }}>CAMPAIGNS</span>
          <div style={{ flex: 1 }} />
          <button style={css.btn()} onClick={onClose}>✕</button>
        </div>
        <div style={{ maxHeight: 360, overflowY: "auto" }}>
          {sorted.map(c => {
            const isCurrent = c.guid === current;
            return (
              <div key={c.guid}>
                <div style={{ padding: "10px 16px", display: "flex", alignItems: "center", gap: 10, borderBottom: `1px solid ${T.border}`, background: isCurrent ? T.surface2 : "transparent" }}>
                  {isCurrent && <span style={{ fontSize: 9, color: T.accent, letterSpacing: "0.08em" }}>ACTIVE</span>}
                  <span style={{ flex: 1, fontSize: 13, color: isCurrent ? T.accentBright : T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                  <span style={{ fontSize: 10, color: T.textMuted, flexShrink: 0 }}>{c.lastUsed ? new Date(c.lastUsed).toLocaleDateString() : ""}</span>
                  {!isCurrent && (
                    <>
                      <button style={{ ...css.btn("primary"), fontSize: 10, padding: "2px 8px", flexShrink: 0 }} onClick={() => switchCampaign(c.guid)}>Open</button>
                      {confirmForget === c.guid
                        ? <>
                          <button style={{ ...css.btn("danger"), fontSize: 10, padding: "2px 8px" }} onClick={() => { forgetCampaign(c.guid); setCampaigns(getKnownCampaigns()); setConfirmForget(null); }}>Remove</button>
                          <button style={{ ...css.btn(), fontSize: 10, padding: "2px 6px" }} onClick={() => setConfirmForget(null)}>Cancel</button>
                        </>
                        : <button style={{ ...css.btn("danger"), fontSize: 10, padding: "2px 6px", opacity: 0.6 }} title="Remove from list" onClick={() => setConfirmForget(c.guid)}>×</button>
                      }
                    </>
                  )}
                </div>
              </div>
            );
          })}
          {sorted.length === 0 && <div style={{ padding: "24px 16px", textAlign: "center", color: T.textDim, fontSize: 12 }}>No saved campaigns yet.</div>}
        </div>
        <div style={{ padding: "12px 16px", borderTop: `1px solid ${T.border}` }}>
          <button style={{ ...css.btn("primary"), width: "100%" }} onClick={() => createNewCampaign()}>+ New Campaign</button>
        </div>
      </div>
    </ModalOverlay>
  );
}

const SPLIT_MIN_WIDTH = 1100; // px — below this, split is hidden

function SplitView({ campaign, leftPageId, rightPageId, onUpdate, onNavigate, splitRatio, onSplitRatioChange, T, css, mainPad }) {
  const leftPage  = campaign.pages.find(p => p.id === leftPageId);
  const rightPage = campaign.pages.find(p => p.id === rightPageId);
  const containerRef = useRef(null);

  const onDividerMouseDown = (e) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;
    const onMove = (ev) => {
      const rect = container.getBoundingClientRect();
      const ratio = Math.max(0.2, Math.min(0.8, (ev.clientX - rect.left) / rect.width));
      onSplitRatioChange(ratio);
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const paneStyle = { overflowY: "auto", height: "100%", ...css.main, padding: mainPad };

  return (
    <div ref={containerRef} style={{ display: "flex", flex: 1, minWidth: 0, height: "100%", overflow: "hidden" }}>
      {/* Left pane */}
      <div style={{ ...paneStyle, width: `${splitRatio * 100}%`, flexShrink: 0 }}>
        {leftPage
          ? <PageEditor key={leftPage.id} page={leftPage} schema={campaign.sectionSchema} allPages={campaign.pages}
              onUpdate={(updater) => onUpdate((data) => ({ ...data, pages: data.pages.map(p => p.id === leftPageId ? updater(p) : p) }))}
              onBack={() => onNavigate("outline")} shareEnabled={campaign.shareEnabled || false} />
          : <div style={{ color: T.textDim, textAlign: "center", marginTop: 80, fontSize: 13 }}>
              <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.2 }}>◧</div>
              <div>Select a page from the sidebar</div>
            </div>
        }
      </div>

      {/* Drag divider */}
      <div
        onMouseDown={onDividerMouseDown}
        style={{ width: 5, flexShrink: 0, cursor: "col-resize", background: T.border, zIndex: 10, transition: "background 0.15s" }}
        onMouseEnter={e => e.currentTarget.style.background = T.accent}
        onMouseLeave={e => e.currentTarget.style.background = T.border}
        title="Drag to resize"
      />

      {/* Right pane */}
      <div style={{ ...paneStyle, flex: 1, minWidth: 0 }}>
        {rightPage
          ? <PageEditor key={rightPage.id} page={rightPage} schema={campaign.sectionSchema} allPages={campaign.pages}
              onUpdate={(updater) => onUpdate((data) => ({ ...data, pages: data.pages.map(p => p.id === rightPageId ? updater(p) : p) }))}
              onBack={() => {}} shareEnabled={campaign.shareEnabled || false} />
          : <div style={{ color: T.textDim, textAlign: "center", marginTop: 80 }}>
              <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.2 }}>◨</div>
              <div style={{ fontSize: 14, marginBottom: 8 }}>No page selected</div>
              <div style={{ fontSize: 12, color: T.textMuted, maxWidth: 280, margin: "0 auto", lineHeight: 1.6 }}>
                Set the sidebar target to <strong style={{ color: T.accent }}>Right</strong> and click any page to open it here.
              </div>
            </div>
        }
      </div>
    </div>
  );
}

export function App() {
  const [campaign, setCampaign] = useState(null);
  const [selectedPageId, setSelectedPageId] = useState(null);
  const [view, setView] = useState("outline");
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState("saved");

  const [showSearch, setShowSearch] = useState(false);
  const [showCampaigns, setShowCampaigns] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const stored = localStorage.getItem("campaign-manager-sidebar-width");
    return stored ? Number(stored) : 240;
  });

  const isMobile = useIsMobile();

  // Split-screen state
  const [splitEnabled, setSplitEnabled] = useState(false);
  const [splitPageId, setSplitPageId] = useState(null);       // page shown in right pane
  const [splitTarget, setSplitTarget] = useState("right");    // "left" | "right" — which pane sidebar clicks go to
  const [splitRatio, setSplitRatio] = useState(0.5);          // fraction of main area for left pane
  const [windowWidth, setWindowWidth] = useState(() => window.innerWidth);

  useEffect(() => {
    const onResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const splitAvailable = !isMobile && windowWidth >= SPLIT_MIN_WIDTH;
  const splitActive = splitEnabled && splitAvailable;
  const saveTimer = useRef(null);
  const historyRef = useRef({ stack: [], idx: -1 });

  useEffect(() => {
    loadData().then((data) => {
      const migrated = data ? migrateCampaign(data) : defaultCampaign();
      setCampaign(migrated);
      historyRef.current = { stack: [migrated], idx: 0 };
      setLoading(false);
    });
  }, []);

  const persist = useCallback((nextCampaign) => {
    setSaveStatus("saving");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveData(nextCampaign).then(({ localQuotaExceeded } = {}) => {
        setSaveStatus(localQuotaExceeded ? "local storage full" : "saved");
      });
    }, 800);
  }, []);

  // Let storage.js flush an immediate save before reloading on campaign switch.
  const campaignRef = useRef(null);
  useEffect(() => { campaignRef.current = campaign; }, [campaign]);
  useEffect(() => {
    registerSaveFlush(() => {
      clearTimeout(saveTimer.current);
      return campaignRef.current ? saveData(campaignRef.current) : Promise.resolve();
    });
  }, []);

  const update = useCallback((fn) => {
    setCampaign((previous) => {
      const next = fn(previous);
      persist(next);
      const h = historyRef.current;
      const stack = h.stack.slice(0, h.idx + 1).concat(next);
      historyRef.current = { stack: stack.length > 50 ? stack.slice(-50) : stack, idx: Math.min(h.idx + 1, 49) };
      return next;
    });
  }, [persist]);

  const undo = useCallback(() => {
    const h = historyRef.current;
    if (h.idx <= 0) return;
    const newIdx = h.idx - 1;
    const prev = h.stack[newIdx];
    historyRef.current = { ...h, idx: newIdx };
    setCampaign(prev);
    persist(prev);
  }, [persist]);

  const redo = useCallback(() => {
    const h = historyRef.current;
    if (h.idx >= h.stack.length - 1) return;
    const newIdx = h.idx + 1;
    const next = h.stack[newIdx];
    historyRef.current = { ...h, idx: newIdx };
    setCampaign(next);
    persist(next);
  }, [persist]);

  useEffect(() => {
    const handler = (e) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      if (e.key === "k") { e.preventDefault(); setShowSearch(true); return; }
      if (e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); return; }
      if (e.key === "y" || (e.key === "z" && e.shiftKey)) { e.preventDefault(); redo(); return; }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [undo, redo]);

  const navigateTo = useCallback((nextView, pageId) => {
    // In split mode, page navigations from the flowchart "Open page" button always go to left pane
    setView(nextView);
    if (pageId !== undefined) setSelectedPageId(pageId);
    setSidebarOpen(false);
    window.history.pushState({ view: nextView, pageId: pageId ?? null }, "");
  }, []);

  // Sidebar page selection — routes to left or right pane depending on splitTarget
  const onSidebarSelect = useCallback((id) => {
    if (splitActive && splitTarget === "right") {
      setSplitPageId(id);
      setSidebarOpen(false);
      // ensure we're on the editor view so the split pane renders
      setView("editor");
      window.history.pushState({ view: "editor", pageId: selectedPageId ?? null }, "");
    } else {
      navigateTo("editor", id);
    }
  }, [splitActive, splitTarget, navigateTo, selectedPageId]);

  useEffect(() => {
    window.history.replaceState({ view: "outline", pageId: null }, "");
  }, []);

  useEffect(() => {
    const handler = () => {
      const state = window.history.state;
      if (!state) return;
      if (showSearch) { setShowSearch(false); window.history.pushState(state, ""); return; }
      if (showCampaigns) { setShowCampaigns(false); window.history.pushState(state, ""); return; }
      if (sidebarOpen) { setSidebarOpen(false); window.history.pushState(state, ""); return; }
      setView(state.view);
      if (state.pageId !== null) setSelectedPageId(state.pageId);
    };
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, [showSearch, showCampaigns, sidebarOpen]);

  if (loading) {
    const isDark = typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    return (
      <div style={{ background: isDark ? "#121212" : "#fafafa", color: isDark ? "#9e9e9e" : "#757575", minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif", letterSpacing: "0.1em", fontSize: 13 }}>
        Loading...
      </div>
    );
  }

  const T = THEMES[campaign.theme] || THEMES.tactical;
  const css = makeCSS(T);
  const selectedPage = campaign.pages.find((page) => page.id === selectedPageId);
  const splitPage = campaign.pages.find((page) => page.id === splitPageId);
  const showSidebar = view === "outline" || view === "editor";
  const mainPad = isMobile ? "12px" : "24px";
  const canUndo = historyRef.current.idx > 0;
  const canRedo = historyRef.current.idx < historyRef.current.stack.length - 1;

  return (
    <ThemeCtx.Provider value={T}>
      {T.skeuomorphic && (
        <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 9999, backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.028) 2px, rgba(0,0,0,0.028) 4px)" }} />
      )}
      <div data-theme={campaign.theme} className="sk-app" style={{ ...css.app, ...(isMobile ? { minHeight: "100dvh" } : { height: "100dvh", overflow: "hidden" }) }}>
        {!isMobile && (
          <div className="sk-topbar" style={css.topbar}>
            <button style={{ ...css.btn(), fontSize: 11, display: "flex", alignItems: "center", gap: 4 }} onClick={() => setShowCampaigns(true)} title="Switch campaign">
              <span style={{ color: T.accentBright }}>⬡</span>
              <span style={{ maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{campaign.name}</span>
              <span style={{ color: T.textDim }}>▾</span>
            </button>
            <input style={{ ...css.input, width: 180, fontSize: 13 }} value={campaign.name} onChange={(event) => update((data) => ({ ...data, name: event.target.value }))} />
            <div style={{ flex: 1 }} />
            <button style={{ ...css.btn(), fontSize: 11, padding: "4px 10px", display: "flex", alignItems: "center", gap: 4 }} onClick={() => setShowSearch(true)} title="Search pages (Ctrl+K)">
              ⌕ <span style={{ opacity: 0.5, fontSize: 9 }}>⌃K</span>
            </button>
            <button style={{ ...css.btn(), fontSize: 11, padding: "4px 8px", opacity: canUndo ? 1 : 0.3 }} onClick={undo} title="Undo (Ctrl+Z)" disabled={!canUndo}>↩</button>
            <button style={{ ...css.btn(), fontSize: 11, padding: "4px 8px", opacity: canRedo ? 1 : 0.3 }} onClick={redo} title="Redo (Ctrl+Y)" disabled={!canRedo}>↪</button>
            {NAV_ITEMS.map(({ key, label }) => (
              <button key={key} style={{ ...css.btn(view === key ? "primary" : "default"), letterSpacing: "0.06em", fontSize: 11 }} onClick={() => navigateTo(key)}>{label.toUpperCase()}</button>
            ))}
            <ThemePicker current={campaign.theme} onChange={(key) => update((data) => ({ ...data, theme: key }))} />
            <ExportDropdown campaign={campaign} currentPage={selectedPage} />
            {splitAvailable && showSidebar && (
              <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: T.textDim, cursor: "pointer", userSelect: "none", flexShrink: 0 }} title="Split screen — open two pages side by side">
                <input type="checkbox" checked={splitEnabled} onChange={e => { setSplitEnabled(e.target.checked); if (!e.target.checked) setSplitPageId(null); }}
                  style={{ accentColor: T.accent, width: 13, height: 13 }} />
                Split
              </label>
            )}
            <span style={{ fontSize: 10, color: saveStatus === "local storage full" ? T.warn : T.textMuted, flexShrink: 0 }} title={saveStatus === "local storage full" ? "Local backup failed: browser storage is full. Data is saved to the server." : undefined}>{saveStatus}</span>
          </div>
        )}

        {isMobile && (
          <div className="sk-topbar" style={{ ...css.topbar, height: 52, padding: "0 10px", gap: 6, position: "sticky", top: 0, zIndex: 100 }}>
            {showSidebar && <button style={{ ...css.btn(), padding: "6px 10px", fontSize: 18, lineHeight: 1, flexShrink: 0 }} onClick={() => setSidebarOpen((open) => !open)}>=</button>}
            <span style={{ color: T.accentBright, fontSize: 13, fontWeight: "bold", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{view === "editor" && selectedPage ? selectedPage.name : (NAV_ITEMS.find((item) => item.key === view)?.label || view)}</span>
            <button style={{ ...css.btn(), fontSize: 14, padding: "4px 8px", flexShrink: 0 }} onClick={() => setShowSearch(true)} title="Search">⌕</button>
            <ThemePicker current={campaign.theme} onChange={(key) => update((data) => ({ ...data, theme: key }))} />
            <ExportDropdown campaign={campaign} currentPage={selectedPage} />
            <span style={{ fontSize: 9, color: T.textMuted, flexShrink: 0 }}>{saveStatus === "saving" ? "*" : "o"}</span>
          </div>
        )}

        <div style={{ ...css.body, position: "relative", overflow: isMobile ? "visible" : "hidden", minHeight: 0 }}>
          {isMobile && sidebarOpen && showSidebar && (
            <div style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex" }}>
              <div style={{ background: "rgba(0,0,0,0.55)", position: "absolute", inset: 0 }} onClick={() => setSidebarOpen(false)} />
              <div style={{ position: "relative", zIndex: 1, width: 270, maxWidth: "88vw", height: "100%", overflowY: "auto" }}>
                <Sidebar campaign={campaign} selectedPageId={selectedPageId} onSelect={(id) => { setSelectedPageId(id); setView("editor"); setSidebarOpen(false); }} onUpdate={update} />
              </div>
            </div>
          )}

          {!isMobile && showSidebar && (
            <div style={{ display: "flex", flexShrink: 0 }}>
              <Sidebar
                campaign={campaign}
                selectedPageId={selectedPageId}
                onSelect={onSidebarSelect}
                onUpdate={update}
                width={sidebarWidth}
                splitActive={splitActive}
                splitTarget={splitTarget}
                onSplitTargetChange={setSplitTarget}
                splitPageId={splitPageId}
              />
              <div
                style={{ width: 5, cursor: "col-resize", background: "transparent", flexShrink: 0, zIndex: 10 }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  const startX = e.clientX;
                  const startW = sidebarWidth;
                  const onMove = (ev) => {
                    const next = Math.max(160, Math.min(480, startW + ev.clientX - startX));
                    setSidebarWidth(next);
                    localStorage.setItem("campaign-manager-sidebar-width", next);
                  };
                  const onUp = () => {
                    window.removeEventListener("mousemove", onMove);
                    window.removeEventListener("mouseup", onUp);
                  };
                  window.addEventListener("mousemove", onMove);
                  window.addEventListener("mouseup", onUp);
                }}
                title="Drag to resize sidebar"
              />
            </div>
          )}

          {/* Main content — single or split pane */}
          {splitActive && view === "editor" ? (
            <SplitView
              campaign={campaign}
              leftPageId={selectedPageId}
              rightPageId={splitPageId}
              onUpdate={update}
              onNavigate={navigateTo}
              splitRatio={splitRatio}
              onSplitRatioChange={setSplitRatio}
              T={T} css={css} mainPad={mainPad}
            />
          ) : (
            <div className="sk-main" style={{ ...css.main, padding: mainPad, paddingBottom: isMobile ? "68px" : mainPad, overflowY: "auto" }}>
              {view === "outline" && <OutlineView campaign={campaign} onSelect={(id) => navigateTo("editor", id)} onUpdate={update} />}
              {view === "editor" && selectedPage && <PageEditor key={selectedPage.id} page={selectedPage} schema={campaign.sectionSchema} allPages={campaign.pages} onUpdate={(updater) => update((data) => ({ ...data, pages: data.pages.map((item) => item.id === selectedPageId ? updater(item) : item) }))} onBack={() => navigateTo("outline")} shareEnabled={campaign.shareEnabled || false} />}
              {view === "editor" && !selectedPage && <div style={{ color: T.textDim, textAlign: "center", marginTop: 80 }}>{isMobile ? "Open the menu to select a page" : "Select a page to edit"}</div>}
              {view === "schema" && <SchemaEditor campaign={campaign} onUpdate={update} />}
              {view === "flowchart" && <FlowchartView campaign={campaign} onUpdate={update} onNavigate={navigateTo} />}
              {view === "simulate" && <SimulatorView campaign={campaign} onUpdate={update} />}
              {view === "settings" && <SettingsView campaign={campaign} onUpdate={update} onRestore={(data) => { const m = migrateCampaign(data); setCampaign(m); persist(m); }} onImport={(data) => { setCampaign(data); persist(data); }} onClear={() => { const fresh = defaultCampaign(); setCampaign(fresh); persist(fresh); navigateTo("outline"); }} onNavigate={navigateTo} />}
            </div>
          )}
        </div>

        {isMobile && (
          <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, height: 56, background: T.surface, borderTop: `1px solid ${T.border}`, display: "flex", zIndex: 200 }}>
            {NAV_ITEMS.map(({ key, icon, label }) => (
              <button key={key} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, background: "transparent", border: "none", color: view === key ? T.accent : T.textDim, cursor: "pointer", fontFamily: T.font, padding: "4px 0", position: "relative" }} onClick={() => navigateTo(key)}>
                <span style={{ fontSize: 17, lineHeight: 1 }}>{icon}</span>
                <span style={{ fontSize: 9, letterSpacing: "0.05em" }}>{label.toUpperCase()}</span>
                {view === key && <span style={{ position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)", width: 28, height: 2, background: T.accent, borderRadius: "2px 2px 0 0" }} />}
              </button>
            ))}
          </div>
        )}


        {showSearch && <SearchModal campaign={campaign} onNavigate={(id) => navigateTo("editor", id)} onClose={() => setShowSearch(false)} T={T} css={css} />}
        {showCampaigns && <CampaignSwitcher current={SESSION_GUID} onClose={() => setShowCampaigns(false)} T={T} css={css} />}
      </div>
    </ThemeCtx.Provider>
  );
}
