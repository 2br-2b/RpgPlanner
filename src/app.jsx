import { useCallback, useEffect, useRef, useState } from "react";
import { FlowchartView } from "./flowchart.jsx";
import { ImportExportModal } from "./io.jsx";
import { OutlineView, PageEditor, SchemaEditor } from "./editor.jsx";
import { SettingsView } from "./settings.jsx";
import { Sidebar } from "./sidebar.jsx";
import { SimulatorView } from "./simulator.jsx";
import { ThemeCtx, THEMES, makeCSS, useIsMobile, useTheme } from "./theme.js";
import { defaultCampaign, loadData, migrateCampaign, saveData } from "./storage.js";

const NAV_ITEMS = [
  { key: "outline", icon: "=", label: "Outline" },
  { key: "schema", icon: "*", label: "Schema" },
  { key: "flowchart", icon: "o", label: "Flow" },
  { key: "simulate", icon: ">", label: "Simulate" },
  { key: "settings", icon: "#", label: "Settings" },
];

function ThemePicker({ current, onChange }) {
  const T = useTheme();
  const css = makeCSS(T);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (event) => {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button style={{ ...css.btn(), fontSize: 11, display: "flex", alignItems: "center", gap: 6 }} onClick={() => setOpen(!open)}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: T.accent, display: "inline-block" }} />
        {THEMES[current]?.label || "Theme"} v
      </button>
      {open && (
        <div style={{ position: "absolute", top: "110%", right: 0, background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radius, zIndex: 200, minWidth: 150, boxShadow: "0 4px 20px rgba(0,0,0,0.5)" }}>
          {Object.entries(THEMES).map(([key, theme]) => (
            <button key={key} style={{ width: "100%", padding: "8px 14px", cursor: "pointer", fontSize: 12, fontFamily: theme.font, color: key === current ? theme.accentBright : T.text, background: key === current ? T.surface2 : "transparent", border: "none", borderLeft: `3px solid ${key === current ? theme.accentBright : "transparent"}`, display: "flex", alignItems: "center", gap: 8, textAlign: "left" }} onClick={() => { onChange(key); setOpen(false); }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: theme.accent, flexShrink: 0 }} />
              {theme.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function App() {
  const [campaign, setCampaign] = useState(null);
  const [selectedPageId, setSelectedPageId] = useState(null);
  const [view, setView] = useState("outline");
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState("saved");
  const [showIO, setShowIO] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isMobile = useIsMobile();
  const saveTimer = useRef(null);

  useEffect(() => {
    loadData().then((data) => {
      setCampaign(data ? migrateCampaign(data) : defaultCampaign());
      setLoading(false);
    });
  }, []);

  const persist = useCallback((nextCampaign) => {
    setSaveStatus("saving");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveData(nextCampaign).then(() => setSaveStatus("saved"));
    }, 800);
  }, []);

  const update = useCallback((fn) => {
    setCampaign((previous) => {
      const next = fn(previous);
      persist(next);
      return next;
    });
  }, [persist]);

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
  const showSidebar = view === "outline" || view === "editor";
  const mainPad = isMobile ? "12px" : "24px";
  const navigateTo = (nextView, pageId) => {
    setView(nextView);
    if (pageId !== undefined) setSelectedPageId(pageId);
    setSidebarOpen(false);
  };

  return (
    <ThemeCtx.Provider value={T}>
      <div style={{ ...css.app, minHeight: "100dvh" }}>
        {!isMobile && (
          <div style={css.topbar}>
            <span style={{ color: T.accentBright, fontSize: 13, fontWeight: "bold", letterSpacing: "0.15em", flexShrink: 0 }}>John's Campaign Manager</span>
            <input style={{ ...css.input, width: 180, fontSize: 13 }} value={campaign.name} onChange={(event) => update((data) => ({ ...data, name: event.target.value }))} />
            <div style={{ flex: 1 }} />
            {NAV_ITEMS.map(({ key, label }) => (
              <button key={key} style={{ ...css.btn(view === key ? "primary" : "default"), letterSpacing: "0.06em", fontSize: 11 }} onClick={() => navigateTo(key)}>{label.toUpperCase()}</button>
            ))}
            <ThemePicker current={campaign.theme} onChange={(key) => update((data) => ({ ...data, theme: key }))} />
            <button style={{ ...css.btn(), fontSize: 11 }} onClick={() => setShowIO(true)}>Data</button>
            <span style={{ fontSize: 10, color: T.textMuted, flexShrink: 0 }}>{saveStatus}</span>
          </div>
        )}

        {isMobile && (
          <div style={{ ...css.topbar, height: 52, padding: "0 10px", gap: 6 }}>
            {showSidebar && <button style={{ ...css.btn(), padding: "6px 10px", fontSize: 18, lineHeight: 1, flexShrink: 0 }} onClick={() => setSidebarOpen((open) => !open)}>=</button>}
            <span style={{ color: T.accentBright, fontSize: 13, fontWeight: "bold", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{view === "editor" && selectedPage ? selectedPage.name : (NAV_ITEMS.find((item) => item.key === view)?.label || view)}</span>
            <ThemePicker current={campaign.theme} onChange={(key) => update((data) => ({ ...data, theme: key }))} />
            <button style={{ ...css.btn(), fontSize: 11, padding: "4px 8px", flexShrink: 0 }} onClick={() => setShowIO(true)}>Data</button>
            <span style={{ fontSize: 9, color: T.textMuted, flexShrink: 0 }}>{saveStatus === "saving" ? "*" : "o"}</span>
          </div>
        )}

        <div style={{ ...css.body, position: "relative", overflow: isMobile ? "visible" : "hidden" }}>
          {isMobile && sidebarOpen && showSidebar && (
            <div style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex" }}>
              <div style={{ background: "rgba(0,0,0,0.55)", position: "absolute", inset: 0 }} onClick={() => setSidebarOpen(false)} />
              <div style={{ position: "relative", zIndex: 1, width: 270, maxWidth: "88vw", height: "100%", overflowY: "auto" }}>
                <Sidebar campaign={campaign} selectedPageId={selectedPageId} onSelect={(id) => { setSelectedPageId(id); setView("editor"); setSidebarOpen(false); }} onUpdate={update} />
              </div>
            </div>
          )}

          {!isMobile && showSidebar && <Sidebar campaign={campaign} selectedPageId={selectedPageId} onSelect={(id) => navigateTo("editor", id)} onUpdate={update} />}

          <div style={{ ...css.main, padding: mainPad, paddingBottom: isMobile ? "68px" : mainPad, overflowY: "auto" }}>
            {view === "outline" && <OutlineView campaign={campaign} onSelect={(id) => navigateTo("editor", id)} onUpdate={update} />}
            {view === "editor" && selectedPage && <PageEditor key={selectedPage.id} page={selectedPage} schema={campaign.sectionSchema} onUpdate={(page) => update((data) => ({ ...data, pages: data.pages.map((item) => item.id === page.id ? page : item) }))} onBack={() => navigateTo("outline")} />}
            {view === "editor" && !selectedPage && <div style={{ color: T.textDim, textAlign: "center", marginTop: 80 }}>{isMobile ? "Open the menu to select a page" : "Select a page to edit"}</div>}
            {view === "schema" && <SchemaEditor campaign={campaign} onUpdate={update} />}
            {view === "flowchart" && <FlowchartView campaign={campaign} onUpdate={update} />}
            {view === "simulate" && <SimulatorView campaign={campaign} />}
            {view === "settings" && <SettingsView campaign={campaign} onUpdate={update} onClear={() => { const fresh = defaultCampaign(); setCampaign(fresh); persist(fresh); navigateTo("outline"); }} />}
          </div>
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

        {showIO && <ImportExportModal campaign={campaign} onImport={(data) => { setCampaign(data); persist(data); }} onClose={() => setShowIO(false)} />}
      </div>
    </ThemeCtx.Provider>
  );
}
