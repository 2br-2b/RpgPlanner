// ═══════════════════════════════════════════════════════════════════════════════
// SETTINGS VIEW
// ═══════════════════════════════════════════════════════════════════════════════
function SettingsView({ campaign, onUpdate, onClear }) {
  const T = useTheme(); const css = makeCSS(T);
  const [confirmClear, setConfirmClear] = useState(false);

  const isMobile = useIsMobile();
  const Row = ({ label, hint, children }) => (
    <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: "flex-start", gap: isMobile ? 8 : 16, padding: "14px 0", borderBottom: `1px solid ${T.border}` }}>
      <div style={{ flex: isMobile ? "none" : "0 0 200px" }}>
        <div style={{ fontSize: 13, color: T.text, marginBottom: 3 }}>{label}</div>
        {hint && <div style={{ fontSize: 10, color: T.textDim }}>{hint}</div>}
      </div>
      <div style={{ flex: 1, width: "100%" }}>{children}</div>
    </div>
  );

  const [guidCopied, setGuidCopied] = useState(false);
  const [adoptGuid, setAdoptGuid] = useState("");
  const [adoptDone, setAdoptDone] = useState(false);

  const copyShareLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?guid=${SESSION_GUID}`;
    navigator.clipboard.writeText(url).then(() => { setGuidCopied(true); setTimeout(() => setGuidCopied(false), 2000); });
  };

  const copyGuidOnly = () => {
    navigator.clipboard.writeText(SESSION_GUID).then(() => { setGuidCopied(true); setTimeout(() => setGuidCopied(false), 2000); });
  };

  const doAdoptGuid = () => {
    const g = adoptGuid.trim();
    if (!/^[0-9a-f-]{36}$/.test(g)) return;
    localStorage.setItem("campaign-manager-guid", g);
    setAdoptDone(true);
    setTimeout(() => window.location.reload(), 1200);
  };

  return (
    <div style={{ maxWidth: 680 }}>
      <h2 style={{ margin: "0 0 20px", color: T.accentBright, fontSize: 16, letterSpacing: "0.1em" }}>SETTINGS</h2>

      <div style={{ ...css.section, marginBottom: 24 }}>
        <div style={{ fontSize: 11, color: T.accent, fontWeight: "bold", letterSpacing: "0.1em", marginBottom: 12 }}>SYNC &amp; SHARING</div>
        <Row label="Your sync ID" hint="This browser's GUID. All saves go to this ID on the server. Share to sync across devices.">
          <div style={{ fontFamily: "monospace", fontSize: 11, color: T.accentBright, background: T.surface2, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: "6px 10px", marginBottom: 8, wordBreak: "break-all" }}>
            {SESSION_GUID}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button style={{ ...css.btn("primary"), fontSize: 11 }} onClick={copyShareLink}>
              {guidCopied ? "✓ Copied!" : "Copy share link"}
            </button>
            <button style={{ ...css.btn(), fontSize: 11 }} onClick={copyGuidOnly}>Copy ID only</button>
          </div>
        </Row>
        <Row label="Adopt a sync ID" hint="Paste another device's GUID to load that campaign. Page will reload.">
          <div style={{ display: "flex", gap: 6 }}>
            <input style={{ ...css.input, fontSize: 11, fontFamily: "monospace" }}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              value={adoptGuid} onChange={e => setAdoptGuid(e.target.value)} />
            <button style={{ ...css.btn(adoptDone ? "primary" : "default"), fontSize: 11, flexShrink: 0 }}
              onClick={doAdoptGuid} disabled={adoptDone}>
              {adoptDone ? "Reloading…" : "Adopt"}
            </button>
          </div>
        </Row>
      </div>

      <div style={{ ...css.section, marginBottom: 24 }}>
        <div style={{ fontSize: 11, color: T.accent, fontWeight: "bold", letterSpacing: "0.1em", marginBottom: 12 }}>CAMPAIGN</div>

        <Row label="Campaign name" hint="Shown in the topbar and export filenames.">
          <input style={css.input} value={campaign.name} onChange={e => onUpdate(c => ({ ...c, name: e.target.value }))} />
        </Row>

        <Row label="Description" hint="Optional. Exported to Markdown output.">
          <textarea style={{ ...css.textarea, minHeight: 80 }}
            value={campaign.description || ""}
            onChange={e => onUpdate(c => ({ ...c, description: e.target.value }))}
            placeholder="Campaign overview, setting, notes for the GM…" />
        </Row>

        <Row label="Default new page type" hint="Pre-selects the type when adding pages from the sidebar.">
          <select style={{ ...css.input, width: "auto" }}
            value={campaign.defaultPageType || "mission"}
            onChange={e => onUpdate(c => ({ ...c, defaultPageType: e.target.value }))}>
            <option value="mission">Mission</option>
            <option value="free">Free Page</option>
          </select>
        </Row>
      </div>

      <div style={{ ...css.section, marginBottom: 24 }}>
        <div style={{ fontSize: 11, color: T.accent, fontWeight: "bold", letterSpacing: "0.1em", marginBottom: 12 }}>DISPLAY</div>

        <Row label="Theme" hint="Also accessible from the topbar dropdown.">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {Object.entries(THEMES).map(([key, theme]) => (
              <div key={key}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: theme.radius, border: `1px solid ${campaign.theme === key ? theme.accentBright : T.border}`, background: campaign.theme === key ? T.surface2 : "transparent", cursor: "pointer", fontFamily: theme.font, fontSize: 12, color: campaign.theme === key ? theme.accentBright : T.textDim }}
                onClick={() => onUpdate(c => ({ ...c, theme: key }))}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: theme.accent, flexShrink: 0 }} />
                {theme.label}
              </div>
            ))}
          </div>
        </Row>

        <Row label="Show projected costs in outline" hint="Show cost/award totals on mission cards in the outline view.">
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input type="checkbox"
              checked={campaign.showCostsInOutline !== false}
              onChange={e => onUpdate(c => ({ ...c, showCostsInOutline: e.target.checked }))}
              style={{ accentColor: T.accent, width: 14, height: 14 }} />
            <span style={{ fontSize: 12, color: T.textDim }}>Enabled</span>
          </label>
        </Row>
      </div>

      <div style={{ ...css.section, marginBottom: 24 }}>
        <div style={{ fontSize: 11, color: T.accent, fontWeight: "bold", letterSpacing: "0.1em", marginBottom: 12 }}>CAMPAIGN STATS</div>
        {(() => {
          const missions = campaign.pages.filter(p => p.type === "mission");
          const freePages = campaign.pages.filter(p => p.type === "free");
          const allTags = [...new Set(campaign.pages.flatMap(p => p.tags || []))];
          const totalCost = missions.reduce((s, p) => s + (p.costs || []).reduce((a, c) => a + (Number(c.amount) || 0), 0), 0);
          const totalAward = missions.reduce((s, p) => s + (p.awards || []).reduce((a, c) => a + (Number(c.amount) || 0), 0), 0);
          return (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12 }}>
              {[
                { label: "Total pages", value: campaign.pages.length },
                { label: "Missions", value: missions.length },
                { label: "Free pages", value: freePages.length },
                { label: "Unique tags", value: allTags.length },
                { label: "Flowchart nodes", value: campaign.flowchart.nodes.length },
                { label: "Flowchart edges", value: campaign.flowchart.edges.length },
                { label: "Projected costs", value: totalCost > 0 ? totalCost.toLocaleString() : "—" },
                { label: "Projected awards", value: totalAward > 0 ? totalAward.toLocaleString() : "—" },
              ].map(({ label, value }) => (
                <div key={label} style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: "10px 12px" }}>
                  <div style={{ fontSize: 10, color: T.textDim, letterSpacing: "0.06em", marginBottom: 4 }}>{label.toUpperCase()}</div>
                  <div style={{ fontSize: 18, color: T.accentBright, fontWeight: "bold" }}>{value}</div>
                </div>
              ))}
            </div>
          );
        })()}
      </div>

      <div style={{ ...css.section, borderColor: T.danger }}>
        <div style={{ fontSize: 11, color: T.danger, fontWeight: "bold", letterSpacing: "0.1em", marginBottom: 12 }}>DANGER ZONE</div>
        <Row label="Clear all data" hint="Deletes all pages, schema, and flowchart. Creates a fresh campaign. Cannot be undone.">
          {confirmClear
            ? (
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 11, color: T.danger }}>Are you sure? This cannot be undone.</span>
                <button style={css.btn("danger")} onClick={() => { onClear(); setConfirmClear(false); }}>Yes, clear everything</button>
                <button style={css.btn()} onClick={() => setConfirmClear(false)}>Cancel</button>
              </div>
            )
            : <button style={css.btn("danger")} onClick={() => setConfirmClear(true)}>Clear campaign data…</button>
          }
        </Row>
      </div>
    </div>
  );
}
