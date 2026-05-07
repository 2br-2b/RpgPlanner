import { useState, useEffect, useCallback } from "react";
import { THEMES, useIsMobile, useThemeCSS } from "./theme.js";
import { SESSION_GUID, listSnapshots, saveSnapshot, deleteSnapshot, restoreSnapshot, migrateCampaign, setSharing } from "./storage.js";

function ConfirmModal({ title, message, confirmLabel, onConfirm, onCancel, danger = true }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: 24 }}>
      <div style={{ background: "#1e1e2e", border: "1px solid #444", borderRadius: 8, padding: 28, maxWidth: 420, width: "100%", color: "#eee", fontFamily: "system-ui, sans-serif", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>
        <div style={{ fontSize: 15, fontWeight: "bold", marginBottom: 12, color: danger ? "#f87171" : "#eee" }}>{title}</div>
        <div style={{ fontSize: 12, lineHeight: 1.6, color: "#bbb", marginBottom: 20 }}>{message}</div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={{ padding: "7px 16px", borderRadius: 6, border: "1px solid #555", background: "transparent", color: "#ccc", cursor: "pointer", fontSize: 12, fontFamily: "system-ui" }}>Cancel</button>
          <button onClick={onConfirm} style={{ padding: "7px 16px", borderRadius: 6, border: `1px solid ${danger ? "#ef4444" : "#3b82f6"}`, background: danger ? "#ef4444" : "#3b82f6", color: "#fff", cursor: "pointer", fontSize: 12, fontFamily: "system-ui", fontWeight: "bold" }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, hint, children, T, isMobile }) {
  return (
    <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: "flex-start", gap: isMobile ? 8 : 16, padding: "14px 0", borderBottom: `1px solid ${T.border}` }}>
      <div style={{ flex: isMobile ? "none" : "0 0 200px" }}>
        <div style={{ fontSize: 13, color: T.text, marginBottom: 3 }}>{label}</div>
        {hint && <div style={{ fontSize: 10, color: T.textDim }}>{hint}</div>}
      </div>
      <div style={{ flex: 1, width: "100%" }}>{children}</div>
    </div>
  );
}

function SnapshotsPanel({ campaign, onRestore, T, css, isMobile }) {
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saveName, setSaveName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [restoring, setRestoring] = useState(null);

  const reload = useCallback(() => {
    setLoading(true);
    listSnapshots().then(list => { setSnapshots(list); setLoading(false); });
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const handleSave = async () => {
    const name = saveName.trim() || `Snapshot ${new Date().toLocaleString()}`;
    setSaving(true); setSaveError("");
    try {
      await saveSnapshot(name);
      setSaveName("");
      reload();
    } catch (e) {
      setSaveError(e.message || "Failed to save");
    }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    try { await deleteSnapshot(id); reload(); } catch { reload(); }
    setConfirmDelete(null);
  };

  const handleRestore = async (id, name) => {
    setRestoring(id);
    try {
      const data = await restoreSnapshot(id);
      if (data) { onRestore(migrateCampaign(data)); }
    } catch { }
    setRestoring(null);
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
        <input style={{ ...css.input, flex: 1, fontSize: 11, minWidth: 160 }} placeholder={`Name (default: timestamp)`}
          value={saveName} onChange={e => setSaveName(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleSave()} />
        <button style={{ ...css.btn("primary"), fontSize: 11, flexShrink: 0 }} onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "+ Save snapshot"}
        </button>
      </div>
      {saveError && <div style={{ fontSize: 11, color: T.danger, marginBottom: 8 }}>{saveError}</div>}

      {loading && <div style={{ fontSize: 11, color: T.textDim }}>Loading…</div>}
      {!loading && snapshots.length === 0 && <div style={{ fontSize: 11, color: T.textDim }}>No snapshots saved yet.</div>}
      {snapshots.map(snap => (
        <div key={snap.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: `1px solid ${T.border}`, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{snap.name}</div>
            <div style={{ fontSize: 10, color: T.textDim }}>{new Date(snap.created_at * 1000).toLocaleString()}</div>
          </div>
          {confirmDelete === snap.id ? (
            <>
              <span style={{ fontSize: 10, color: T.danger }}>Delete?</span>
              <button style={{ ...css.btn("danger"), fontSize: 10, padding: "2px 8px" }} onClick={() => handleDelete(snap.id)}>Yes</button>
              <button style={{ ...css.btn(), fontSize: 10, padding: "2px 6px" }} onClick={() => setConfirmDelete(null)}>No</button>
            </>
          ) : (
            <>
              <button style={{ ...css.btn(), fontSize: 10, padding: "2px 8px" }} onClick={() => handleRestore(snap.id, snap.name)} disabled={restoring === snap.id}>
                {restoring === snap.id ? "…" : "Restore"}
              </button>
              <button style={{ ...css.btn("danger"), fontSize: 10, padding: "2px 6px", opacity: 0.7 }} onClick={() => setConfirmDelete(snap.id)}>×</button>
            </>
          )}
        </div>
      ))}
      <div style={{ fontSize: 10, color: T.textMuted, marginTop: 8 }}>Snapshots save the current server-side state. Up to 50 per campaign.</div>
    </div>
  );
}

function SharingPanel({ campaign, onUpdate, onNavigateSchema, T, css, isMobile }) {
  const [toggling, setToggling] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [confirmRegen, setConfirmRegen] = useState(false);
  const [regenDone, setRegenDone] = useState(false);
  const [shareError, setShareError] = useState("");
  const [showShareUrl, setShowShareUrl] = useState(false);

  const shareUrl = campaign.shareGuid ? `${window.location.origin}/share/${campaign.shareGuid}` : null;

  const handleToggle = async (enabled) => {
    setToggling(true); setShareError("");
    try {
      const result = await setSharing(enabled, campaign.shareTheme || campaign.theme || "plain", campaign.shareCustomCss || "");
      onUpdate(c => ({ ...c, shareEnabled: enabled, shareGuid: result.shareGuid }));
    } catch (e) { setShareError(e.message || "Failed"); }
    setToggling(false);
  };

  const handleRegen = async () => {
    setToggling(true); setShareError(""); setConfirmRegen(false);
    try {
      // Temporarily disable then re-enable to force new GUID
      await setSharing(false, campaign.shareTheme || campaign.theme || "plain", campaign.shareCustomCss || "");
      const result = await setSharing(true, campaign.shareTheme || campaign.theme || "plain", campaign.shareCustomCss || "");
      onUpdate(c => ({ ...c, shareEnabled: true, shareGuid: result.shareGuid }));
      setRegenDone(true); setTimeout(() => setRegenDone(false), 2000);
    } catch (e) { setShareError(e.message || "Failed"); }
    setToggling(false);
  };

  const handleThemeChange = async (key) => {
    onUpdate(c => ({ ...c, shareTheme: key }));
    if (campaign.shareEnabled) {
      try { await setSharing(true, key, campaign.shareCustomCss || ""); } catch { }
    }
  };

  const handleCssChange = (css) => {
    onUpdate(c => ({ ...c, shareCustomCss: css }));
  };


  return (
    <div>
      <Row label="Enable player sharing" hint="Creates a separate read-only URL for players. All content is hidden by default." T={T} isMobile={isMobile}>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
          <input type="checkbox" checked={campaign.shareEnabled || false}
            onChange={e => handleToggle(e.target.checked)}
            disabled={toggling}
            style={{ accentColor: T.accent, width: 13, height: 13 }} />
          <span style={{ fontSize: 12, color: T.textDim }}>{toggling ? "Updating…" : "Public"}</span>
        </label>
        {shareError && <div style={{ fontSize: 11, color: T.danger, marginTop: 6 }}>{shareError}</div>}
        {!campaign.shareEnabled && (
          <div style={{ fontSize: 11, color: T.textMuted, marginTop: 6 }}>When enabled, all pages and fields are hidden by default. Go to Schema to choose what players can see.</div>
        )}
      </Row>


      {campaign.shareEnabled && shareUrl && (
        <>
          <Row label="Player share link" hint="Share this URL with your players. It only shows what you've marked as visible." T={T} isMobile={isMobile}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <div style={{ fontFamily: "monospace", fontSize: 11, color: T.accentBright, background: T.surface2, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: "6px 10px", wordBreak: "break-all", flex: 1, filter: showShareUrl ? "none" : "blur(6px)", userSelect: showShareUrl ? "auto" : "none" }}>{shareUrl}</div>
              <button style={{ ...css.btn(), fontSize: 11, flexShrink: 0 }} onClick={() => setShowShareUrl(v => !v)}>{showShareUrl ? "Hide" : "Show"}</button>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button style={{ ...css.btn("primary"), fontSize: 11 }} onClick={() => { navigator.clipboard.writeText(shareUrl); setShareCopied(true); setTimeout(() => setShareCopied(false), 2000); }}>
                {shareCopied ? "Copied!" : "Copy link"}
              </button>
              <button style={{ ...css.btn(), fontSize: 11 }} onClick={() => window.open(shareUrl, "_blank")}>Preview as player ↗</button>
              <button style={{ ...css.btn(), fontSize: 11 }} onClick={() => setConfirmRegen(true)} disabled={toggling}>
                {regenDone ? "Regenerated!" : "Regenerate link…"}
              </button>
              {confirmRegen && (
                <ConfirmModal
                  title="Regenerate share link?"
                  message="The old link will stop working immediately. Anyone using it will lose access."
                  confirmLabel="Regenerate"
                  onConfirm={handleRegen}
                  onCancel={() => setConfirmRegen(false)}
                />
              )}
            </div>
          </Row>

          <Row label="Schema setup" hint="Go to Schema to set which fields players can see by default." T={T} isMobile={isMobile}>
            <div style={{ fontSize: 11, color: T.textDim, marginBottom: 6 }}>All pages and sections are hidden by default. Use the Schema editor to set player-visible defaults.</div>
            {onNavigateSchema && <button style={{ ...css.btn("primary"), fontSize: 11 }} onClick={onNavigateSchema}>Go to Schema →</button>}
          </Row>

          <Row label="Player view theme" hint="Theme used in the player-facing share view." T={T} isMobile={isMobile}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {Object.entries(THEMES).map(([key, theme]) => (
                <button key={key} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: theme.radius, border: `1px solid ${(campaign.shareTheme || campaign.theme || "plain") === key ? theme.accentBright : T.border}`, background: (campaign.shareTheme || campaign.theme || "plain") === key ? T.surface2 : "transparent", cursor: "pointer", fontFamily: theme.font, fontSize: 12, color: (campaign.shareTheme || campaign.theme || "plain") === key ? theme.accentBright : T.textDim }} onClick={() => handleThemeChange(key)}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: theme.accent, flexShrink: 0 }} />{theme.label}
                </button>
              ))}
            </div>
          </Row>

          <Row label="Custom CSS" hint="Advanced: inject CSS into the player view. Players will see a safety warning before it's applied." T={T} isMobile={isMobile}>
            <textarea style={{ ...css.textarea, minHeight: 100, fontSize: 11 }}
              value={campaign.shareCustomCss || ""}
              onChange={e => handleCssChange(e.target.value)}
              placeholder="/* Optional custom CSS for the player view */" />
            <div style={{ fontSize: 10, color: T.warn, marginTop: 4 }}>
              ⚠ Players will see a security warning explaining that custom CSS can change the appearance of the page in arbitrary ways.
            </div>
          </Row>
        </>
      )}
    </div>
  );
}

export function SettingsView({ campaign, onUpdate, onRestore, onClear, onNavigate }) {
  const { T, css } = useThemeCSS();
  const isMobile = useIsMobile();
  const [confirmClear, setConfirmClear] = useState(false);
  const [guidCopied, setGuidCopied] = useState(false);
  const [adoptGuid, setAdoptGuid] = useState("");
  const [adoptDone, setAdoptDone] = useState(false);
  const [confirmShareAll, setConfirmShareAll] = useState(false);
  const [sharingAll, setSharingAll] = useState(false);
  const [shareAllError, setShareAllError] = useState("");

  const handleShareAll = async () => {
    setSharingAll(true); setShareAllError(""); setConfirmShareAll(false);
    try {
      let shareGuid = campaign.shareGuid;
      if (!campaign.shareEnabled) {
        const result = await setSharing(true, campaign.shareTheme || campaign.theme || "plain", campaign.shareCustomCss || "");
        shareGuid = result.shareGuid;
      }
      onUpdate(c => ({
        ...c,
        shareEnabled: true,
        shareGuid,
        sectionSchema: c.sectionSchema.map(s => ({
          ...s,
          playerVisible: true,
          playerEditable: s.playerEditable || false,
          playerVisibleSubheaders: s.type === "text" ? (s.subheaders || []) : (s.playerVisibleSubheaders || []),
          playerVisibleColumns: s.type === "table" ? (s.columns || []).map(col => col.id) : (s.playerVisibleColumns || []),
        })),
        pages: c.pages.map(p => ({ ...p, playerVisible: true, sectionVisibilityOverrides: {} })),
      }));
    } catch (e) { setShareAllError(e.message || "Failed"); }
    setSharingAll(false);
  };

  const copyText = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      setGuidCopied(true);
      setTimeout(() => setGuidCopied(false), 2000);
    });
  };
  const adopt = () => {
    const guid = adoptGuid.trim();
    if (!/^[0-9a-f-]{36}$/.test(guid)) return;
    localStorage.setItem("campaign-manager-guid", guid);
    setAdoptDone(true);
    setTimeout(() => window.location.reload(), 1200);
  };

  const missions = campaign.pages.filter((page) => page.type === "mission");
  const freePages = campaign.pages.filter((page) => page.type === "free");
  const allTags = [...new Set(campaign.pages.flatMap((page) => page.tags || []))];
  const totalCost = missions.reduce((sum, page) => sum + (page.costs || []).reduce((inner, cost) => inner + (Number(cost.amount) || 0), 0), 0);
  const totalAward = missions.reduce((sum, page) => sum + (page.awards || []).reduce((inner, award) => inner + (Number(award.amount) || 0), 0), 0);

  return (
    <div style={{ maxWidth: 680 }}>
      <h2 style={{ margin: "0 0 20px", color: T.accentBright, fontSize: 16, letterSpacing: "0.1em" }}>SETTINGS</h2>

      <div style={{ ...css.section, marginBottom: 24 }}>
        <div style={{ fontSize: 11, color: T.accent, fontWeight: "bold", letterSpacing: "0.1em", marginBottom: 12 }}>PLAYER SHARING</div>
        <SharingPanel campaign={campaign} onUpdate={onUpdate} onNavigateSchema={onNavigate ? () => onNavigate("schema") : null} T={T} css={css} isMobile={isMobile} />
      </div>

      <div style={{ ...css.section, marginBottom: 24 }}>
        <div style={{ fontSize: 11, color: T.accent, fontWeight: "bold", letterSpacing: "0.1em", marginBottom: 12 }}>SYNC &amp; SHARING</div>
        <Row label="Your sync ID" hint="All saves go to this ID on the server. Share it to sync across devices." T={T} isMobile={isMobile}>
          <div style={{ fontFamily: "monospace", fontSize: 11, color: T.accentBright, background: T.surface2, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: "6px 10px", marginBottom: 8, wordBreak: "break-all" }}>{SESSION_GUID}</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button style={{ ...css.btn("primary"), fontSize: 11 }} onClick={() => copyText(`${window.location.origin}${window.location.pathname}?guid=${SESSION_GUID}`)}>{guidCopied ? "Copied!" : "Copy share link"}</button>
            <button style={{ ...css.btn(), fontSize: 11 }} onClick={() => copyText(SESSION_GUID)}>Copy ID only</button>
          </div>
        </Row>
        <Row label="Adopt a sync ID" hint="Paste another device's GUID to load that campaign. Page will reload." T={T} isMobile={isMobile}>
          <div style={{ display: "flex", gap: 6 }}>
            <input style={{ ...css.input, fontSize: 11, fontFamily: "monospace" }} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" value={adoptGuid} onChange={(e) => setAdoptGuid(e.target.value)} />
            <button style={{ ...css.btn(adoptDone ? "primary" : "default"), fontSize: 11, flexShrink: 0 }} onClick={adopt} disabled={adoptDone}>{adoptDone ? "Reloading..." : "Adopt"}</button>
          </div>
        </Row>
      </div>

      <div style={{ ...css.section, marginBottom: 24 }}>
        <div style={{ fontSize: 11, color: T.accent, fontWeight: "bold", letterSpacing: "0.1em", marginBottom: 12 }}>SNAPSHOTS</div>
        <SnapshotsPanel campaign={campaign} onRestore={onRestore} T={T} css={css} isMobile={isMobile} />
      </div>

      <div style={{ ...css.section, marginBottom: 24 }}>
        <div style={{ fontSize: 11, color: T.accent, fontWeight: "bold", letterSpacing: "0.1em", marginBottom: 12 }}>CAMPAIGN</div>
        <Row label="Campaign name" hint="Shown in the topbar and export filenames." T={T} isMobile={isMobile}>
          <input style={css.input} value={campaign.name} onChange={(e) => onUpdate((data) => ({ ...data, name: e.target.value }))} />
        </Row>
        <Row label="Description" hint="Optional. Exported to Markdown output." T={T} isMobile={isMobile}>
          <textarea style={{ ...css.textarea, minHeight: 80 }} value={campaign.description || ""} onChange={(e) => onUpdate((data) => ({ ...data, description: e.target.value }))} placeholder="Campaign overview, setting, notes for the GM..." />
        </Row>
        <Row label="Default new page type" hint="Pre-selects the type when adding pages from the sidebar." T={T} isMobile={isMobile}>
          <select style={{ ...css.input, width: "auto" }} value={campaign.defaultPageType || "mission"} onChange={(e) => onUpdate((data) => ({ ...data, defaultPageType: e.target.value }))}>
            <option value="mission">Mission</option>
            <option value="free">Free Page</option>
          </select>
        </Row>
      </div>

      <div style={{ ...css.section, marginBottom: 24 }}>
        <div style={{ fontSize: 11, color: T.accent, fontWeight: "bold", letterSpacing: "0.1em", marginBottom: 12 }}>DISPLAY</div>
        <Row label="Theme" hint="Also accessible from the topbar dropdown." T={T} isMobile={isMobile}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {Object.entries(THEMES).map(([key, theme]) => (
              <button key={key} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: theme.radius, border: `1px solid ${campaign.theme === key ? theme.accentBright : T.border}`, background: campaign.theme === key ? T.surface2 : "transparent", cursor: "pointer", fontFamily: theme.font, fontSize: 12, color: campaign.theme === key ? theme.accentBright : T.textDim }} onClick={() => onUpdate((data) => ({ ...data, theme: key }))}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: theme.accent, flexShrink: 0 }} />{theme.label}
              </button>
            ))}
          </div>
        </Row>
        <Row label="Show projected costs in outline" hint="Show cost/award totals on mission cards in the outline view." T={T} isMobile={isMobile}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input type="checkbox" checked={campaign.showCostsInOutline !== false} onChange={(e) => onUpdate((data) => ({ ...data, showCostsInOutline: e.target.checked }))} style={{ accentColor: T.accent, width: 14, height: 14 }} />
            <span style={{ fontSize: 12, color: T.textDim }}>Enabled</span>
          </label>
        </Row>
      </div>

      <div style={{ ...css.section, marginBottom: 24 }}>
        <div style={{ fontSize: 11, color: T.accent, fontWeight: "bold", letterSpacing: "0.1em", marginBottom: 12 }}>CAMPAIGN STATS</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12 }}>
          {[
            ["Total pages", campaign.pages.length],
            ["Missions", missions.length],
            ["Free pages", freePages.length],
            ["Unique tags", allTags.length],
            ["Flowchart nodes", campaign.flowchart.nodes.length],
            ["Flowchart edges", campaign.flowchart.edges.length],
            ["Projected costs", totalCost > 0 ? totalCost.toLocaleString() : "-"],
            ["Projected awards", totalAward > 0 ? totalAward.toLocaleString() : "-"],
          ].map(([label, value]) => (
            <div key={label} style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: "10px 12px" }}>
              <div style={{ fontSize: 10, color: T.textDim, letterSpacing: "0.06em", marginBottom: 4 }}>{label.toUpperCase()}</div>
              <div style={{ fontSize: 18, color: T.accentBright, fontWeight: "bold" }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ ...css.section, borderColor: T.danger }}>
        <div style={{ fontSize: 11, color: T.danger, fontWeight: "bold", letterSpacing: "0.1em", marginBottom: 12 }}>DANGER ZONE</div>
        {campaign.shareEnabled && (
          <Row label="Share all content" hint="End-of-campaign shortcut: make every page and every field visible to players at once." T={T} isMobile={isMobile}>
            <button style={{ ...css.btn("danger"), fontSize: 11 }} onClick={() => setConfirmShareAll(true)} disabled={sharingAll}>
              {sharingAll ? "Sharing…" : "Share all content…"}
            </button>
            {shareAllError && <div style={{ fontSize: 11, color: T.danger, marginTop: 6 }}>{shareAllError}</div>}
            {confirmShareAll && (
              <ConfirmModal
                title="Share all content?"
                message={`This will mark all ${campaign.pages.length} page${campaign.pages.length !== 1 ? "s" : ""} and all ${campaign.sectionSchema.length} section${campaign.sectionSchema.length !== 1 ? "s" : ""} (including every subheader and column) as visible to players. You can still hide individual items afterwards.`}
                confirmLabel="Yes, share everything"
                onConfirm={handleShareAll}
                onCancel={() => setConfirmShareAll(false)}
              />
            )}
          </Row>
        )}
        <Row label="Clear all data" hint="Deletes all pages, schema, and flowchart. Cannot be undone." T={T} isMobile={isMobile}>
          <button style={css.btn("danger")} onClick={() => setConfirmClear(true)}>Clear campaign data…</button>
          {confirmClear && (
            <ConfirmModal
              title="Clear all campaign data?"
              message="This will permanently delete all pages, schema, and flowchart data. This cannot be undone."
              confirmLabel="Yes, clear everything"
              onConfirm={() => { onClear(); setConfirmClear(false); }}
              onCancel={() => setConfirmClear(false)}
            />
          )}
        </Row>
      </div>
    </div>
  );
}
