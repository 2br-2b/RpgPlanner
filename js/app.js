// ═══════════════════════════════════════════════════════════════════════════════
// MARKDOWN RENDERER
// ═══════════════════════════════════════════════════════════════════════════════
function renderMarkdown(text, T) {
  if (!text) return "";
  const t = T || THEMES.tactical;
  let html = text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%;border-radius:4px;margin:8px 0;" />')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, `<code style="background:${t.surface2};padding:2px 6px;border-radius:3px;font-family:monospace;font-size:0.9em;">$1</code>`)
    .replace(/^### (.+)$/gm, `<h3 style="color:${t.textDim};margin:12px 0 6px;font-size:1em;">$1</h3>`)
    .replace(/^## (.+)$/gm, `<h2 style="color:${t.accent};margin:14px 0 8px;font-size:1.1em;">$1</h2>`)
    .replace(/^# (.+)$/gm, `<h1 style="color:${t.accentBright};margin:16px 0 10px;font-size:1.3em;">$1</h1>`)
    .replace(/^> (.+)$/gm, `<blockquote style="border-left:3px solid ${t.accentDim};padding-left:12px;color:${t.textDim};margin:8px 0;">$1</blockquote>`)
    .replace(/^\s*[-*] (.+)$/gm, '<li style="margin:3px 0;padding-left:8px;">$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li style="margin:3px 0;padding-left:8px;list-style-type:decimal;">$1</li>')
    .replace(/^---$/gm, `<hr style="border:none;border-top:1px solid ${t.border};margin:16px 0;" />`)
    .replace(/\n\n/g, "</p><p>").replace(/\n/g, "<br/>");
  html = html.replace(/(<li[^>]*>.*?<\/li>(?:<br\/>)*)+/g, (m) => `<ul style="padding-left:20px;margin:6px 0;">${m.replace(/<br\/>/g, "")}</ul>`);
  return `<p style="margin:0;line-height:1.7;">${html}</p>`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// THEME PICKER
// ═══════════════════════════════════════════════════════════════════════════════
function ThemePicker({ current, onChange }) {
  const T = useTheme();
  const css = makeCSS(T);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button style={{ ...css.btn(), fontSize: 11, display: "flex", alignItems: "center", gap: 6 }} onClick={() => setOpen(!open)}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: T.accent, display: "inline-block" }} />
        {THEMES[current]?.label || "Theme"} ▾
      </button>
      {open && (
        <div style={{ position: "absolute", top: "110%", right: 0, background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radius, zIndex: 200, minWidth: 150, boxShadow: "0 4px 20px rgba(0,0,0,0.5)" }}>
          {Object.entries(THEMES).map(([key, theme]) => (
            <div key={key} style={{
              padding: "8px 14px", cursor: "pointer", fontSize: 12, fontFamily: theme.font,
              color: key === current ? theme.accentBright : T.text,
              background: key === current ? T.surface2 : "transparent",
              borderLeft: `3px solid ${key === current ? theme.accentBright : "transparent"}`,
              display: "flex", alignItems: "center", gap: 8,
            }} onClick={() => { onChange(key); setOpen(false); }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: theme.accent, flexShrink: 0 }} />
              {theme.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════════════════
const NAV_ITEMS = [
  { key: "outline", icon: "☰", label: "Outline" },
  { key: "schema", icon: "⚙", label: "Schema" },
  { key: "flowchart", icon: "◈", label: "Flow" },
  { key: "simulate", icon: "▶", label: "Simulate" },
  { key: "settings", icon: "⚒", label: "Settings" },
];

function App() {
  const [campaign, setCampaign] = useState(null);
  const [selectedPageId, setSelectedPageId] = useState(null);
  const [view, setView] = useState("outline");
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState("saved");
  const [showIO, setShowIO] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => { loadData().then(d => { setCampaign(d ? migrateCampaign(d) : defaultCampaign()); setLoading(false); }); }, []);

  const saveTimer = useRef(null);
  const persist = useCallback((c) => {
    setSaveStatus("saving");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveData(c).then(() => setSaveStatus("saved")), 800);
  }, []);

  const update = useCallback((fn) => {
    setCampaign(prev => { const next = fn(prev); persist(next); return next; });
  }, [persist]);

  if (loading) {
    const isDark = typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    return (
      <div style={{ background: isDark ? "#121212" : "#fafafa", color: isDark ? "#9e9e9e" : "#757575", minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif", letterSpacing: "0.1em", fontSize: 13 }}>
        Loading…
      </div>
    );
  }

  const T = THEMES[campaign.theme] || THEMES.tactical;
  const css = makeCSS(T);
  const selectedPage = campaign.pages.find(p => p.id === selectedPageId);
  const showSidebar = view === "outline" || view === "editor";
  const mainPad = isMobile ? "12px" : "24px";

  const navigateTo = (v, pageId) => {
    setView(v);
    if (pageId !== undefined) setSelectedPageId(pageId);
    setSidebarOpen(false);
  };

  return (
    <ThemeCtx.Provider value={T}>
      <div style={{ ...css.app, minHeight: "100dvh" }}>

        {!isMobile && (
          <div style={css.topbar}>
            <span style={{ color: T.accentBright, fontSize: 13, fontWeight: "bold", letterSpacing: "0.15em", flexShrink: 0 }}>◈ John's Campaign Manager</span>
            <input style={{ ...css.input, width: 180, fontSize: 13 }} value={campaign.name} onChange={e => update(c => ({ ...c, name: e.target.value }))} />
            <div style={{ flex: 1 }} />
            {NAV_ITEMS.map(({ key, label }) => (
              <button key={key} style={{ ...css.btn(view === key ? "primary" : "default"), letterSpacing: "0.06em", fontSize: 11 }}
                onClick={() => navigateTo(key)}>{label.toUpperCase()}</button>
            ))}
            <ThemePicker current={campaign.theme} onChange={k => update(c => ({ ...c, theme: k }))} />
            <button style={{ ...css.btn(), fontSize: 11 }} onClick={() => setShowIO(true)}>⇅ Data</button>
            <span style={{ fontSize: 10, color: T.textMuted, flexShrink: 0 }}>{saveStatus === "saving" ? "●" : "○"} {saveStatus}</span>
          </div>
        )}

        {isMobile && (
          <div style={{ ...css.topbar, height: 52, padding: "0 10px", gap: 6 }}>
            {showSidebar && (
              <button style={{ ...css.btn(), padding: "6px 10px", fontSize: 18, lineHeight: 1, flexShrink: 0 }}
                onClick={() => setSidebarOpen(s => !s)}>☰</button>
            )}
            <span style={{ color: T.accentBright, fontSize: 13, fontWeight: "bold", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {view === "editor" && selectedPage ? selectedPage.name : (NAV_ITEMS.find(n => n.key === view)?.label || view)}
            </span>
            <ThemePicker current={campaign.theme} onChange={k => update(c => ({ ...c, theme: k }))} />
            <button style={{ ...css.btn(), fontSize: 11, padding: "4px 8px", flexShrink: 0 }} onClick={() => setShowIO(true)}>⇅</button>
            <span style={{ fontSize: 9, color: T.textMuted, flexShrink: 0 }}>{saveStatus === "saving" ? "●" : "○"}</span>
          </div>
        )}

        <div style={{ ...css.body, position: "relative", overflow: isMobile ? "visible" : "hidden" }}>

          {isMobile && sidebarOpen && showSidebar && (
            <div style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex" }}>
              <div style={{ background: "rgba(0,0,0,0.55)", position: "absolute", inset: 0 }}
                onClick={() => setSidebarOpen(false)} />
              <div style={{ position: "relative", zIndex: 1, width: 270, maxWidth: "88vw", height: "100%", overflowY: "auto" }}>
                <Sidebar campaign={campaign} selectedPageId={selectedPageId}
                  onSelect={id => { setSelectedPageId(id); setView("editor"); setSidebarOpen(false); }}
                  onUpdate={update} />
              </div>
            </div>
          )}

          {!isMobile && showSidebar && (
            <Sidebar campaign={campaign} selectedPageId={selectedPageId}
              onSelect={id => navigateTo("editor", id)} onUpdate={update} />
          )}

          <div style={{ ...css.main, padding: mainPad, paddingBottom: isMobile ? "68px" : mainPad, overflowY: "auto" }}>
            {view === "outline" && <OutlineView campaign={campaign} onSelect={id => navigateTo("editor", id)} onUpdate={update} />}
            {view === "editor" && selectedPage && <PageEditor key={selectedPage.id} page={selectedPage} schema={campaign.sectionSchema} onUpdate={p => update(c => ({ ...c, pages: c.pages.map(x => x.id === p.id ? p : x) }))} onBack={() => navigateTo("outline")} />}
            {view === "editor" && !selectedPage && (
              <div style={{ color: T.textDim, textAlign: "center", marginTop: 80 }}>
                {isMobile ? "Tap ☰ to select a page" : "← Select a page to edit"}
              </div>
            )}
            {view === "schema" && <SchemaEditor campaign={campaign} onUpdate={update} />}
            {view === "flowchart" && <FlowchartView campaign={campaign} onUpdate={update} />}
            {view === "simulate" && <SimulatorView campaign={campaign} />}
            {view === "settings" && <SettingsView campaign={campaign} onUpdate={update} onClear={() => { const fresh = defaultCampaign(); setCampaign(fresh); persist(fresh); navigateTo("outline"); }} />}
          </div>
        </div>

        {isMobile && (
          <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, height: 56, background: T.surface, borderTop: `1px solid ${T.border}`, display: "flex", zIndex: 200 }}>
            {NAV_ITEMS.map(({ key, icon, label }) => (
              <button key={key} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, background: "transparent", border: "none", color: view === key ? T.accent : T.textDim, cursor: "pointer", fontFamily: T.font, padding: "4px 0", position: "relative" }}
                onClick={() => navigateTo(key)}>
                <span style={{ fontSize: 17, lineHeight: 1 }}>{icon}</span>
                <span style={{ fontSize: 9, letterSpacing: "0.05em" }}>{label.toUpperCase()}</span>
                {view === key && <span style={{ position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)", width: 28, height: 2, background: T.accent, borderRadius: "2px 2px 0 0" }} />}
              </button>
            ))}
          </div>
        )}

        {showIO && <ImportExportModal campaign={campaign} onImport={data => { setCampaign(data); persist(data); }} onClose={() => setShowIO(false)} />}
      </div>
    </ThemeCtx.Provider>
  );
}

// Mount
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(React.createElement(App));
