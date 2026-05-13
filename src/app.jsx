import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { LayoutList, Shapes, Workflow, Dices, Settings } from "lucide-react";
import { ExportDropdown, ExportModal } from "./io.jsx";
import { OutlineView, PageEditor } from "./editor.jsx";
import { Sidebar } from "./sidebar.jsx";
import { SettingsView } from "./settings.jsx";

const FlowchartView = lazy(() => import("./flowchart.jsx").then(m => ({ default: m.FlowchartView })));
const SchemaEditor  = lazy(() => import("./schema-editor.jsx").then(m => ({ default: m.SchemaEditor })));
const SimulatorView = lazy(() => import("./simulator.jsx").then(m => ({ default: m.SimulatorView })));
import { ThemeCtx, THEMES, makeCSS, useIsMobile, useThemeCSS } from "./theme.js";
import { ThemePicker } from "./theme-picker.jsx";
import { useEscapeKey, ModalOverlay } from "./ui.jsx";
import { WhatsNewPopup, ChangelogModal } from "./changelog.jsx";
import { hasUnseenChanges, markChangelogSeen } from "./changelog.js";
import {
  SESSION_GUID,
  SCHEMA_VERSION,
  defaultCampaign,
  loadData,
  migrateCampaign,
  saveData,
  saveSnapshot,
  getKnownCampaigns,
  switchCampaign,
  createNewCampaign,
  forgetCampaign,
  registerSaveFlush,
  MigrationError,
  logMigrationError,
} from "./storage.js";
import { diffCampaigns, mergeCampaigns } from "./conflict.js";

const NAV_ITEMS = [
  { key: "outline",   Icon: LayoutList, label: "Outline"  },
  { key: "schema",    Icon: Shapes,     label: "Page Types"    },
  { key: "flowchart", Icon: Workflow,   label: "Flow"     },
  { key: "simulate",  Icon: Dices,      label: "Simulate" },
  { key: "settings",  Icon: Settings,   label: "Settings" },
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
          {results.map((page, i) => {
            const pt = (campaign.pageTypes || []).find(t => t.id === page.type) || (campaign.pageTypes || [])[0];
            return (
            <div key={page.id} style={{ padding: "10px 16px", cursor: "pointer", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 10 }}
              onMouseEnter={e => e.currentTarget.style.background = T.surface2}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              onClick={() => { onNavigate(page.id); onClose(); }}>
              <span style={{ fontSize: 14, flexShrink: 0 }}>{pt?.icon || "📄"}</span>
              <span style={{ flex: 1, fontSize: 13 }}>{page.name}</span>
              {(page.tags || []).length > 0 && (
                <span style={{ fontSize: 10, color: T.textMuted }}>{page.tags.join(", ")}</span>
              )}
            </div>
            );
          })}
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

// ── Migration error modal ─────────────────────────────────────────────────────

function MigrationErrorModal({ error, onContinueUnsafe, T, css }) {
  const [showExport, setShowExport] = useState(false);
  const [snapshotting, setSnapshotting] = useState(false);
  const [snapshotDone, setSnapshotDone] = useState(false);

  const handleSnapshotAndContinue = async () => {
    setSnapshotting(true);
    try {
      await saveSnapshot(`Pre-migration backup (v${error.before?.schemaVersion ?? "?"}) — ${new Date().toLocaleString()}`);
      setSnapshotDone(true);
    } catch { /* best-effort */ }
    setSnapshotting(false);
    onContinueUnsafe();
  };

  // Wrap the raw pre-migration blob as a minimal campaign for export
  const exportCampaign = { name: error.before?.name || "Campaign", pages: [], flowchart: { nodes: [], edges: [] }, pageTypes: [], ...error.before };

  return (
    <ModalOverlay onClose={null} zIndex={9000}>
      <div style={{ background: "#1e1e2e", border: "2px solid #ef4444", borderRadius: 10, padding: 28, maxWidth: 540, width: "100%", color: "#eee", fontFamily: "system-ui, sans-serif", boxShadow: "0 8px 40px rgba(0,0,0,0.7)" }}>
        <div style={{ fontSize: 16, fontWeight: "bold", color: "#ef4444", marginBottom: 8 }}>⚠ Migration Integrity Check Failed</div>
        <div style={{ fontSize: 12, color: "#bbb", lineHeight: 1.6, marginBottom: 16 }}>
          Your campaign data was being upgraded to a new schema version, but the migration did not pass all safety checks. No data has been saved yet.
        </div>

        <div style={{ background: "#12121e", border: "1px solid #555", borderRadius: 6, padding: 12, marginBottom: 16, maxHeight: 180, overflowY: "auto" }}>
          <div style={{ fontSize: 10, color: "#888", letterSpacing: "0.1em", marginBottom: 8 }}>FAILED CHECKS</div>
          {(error.failures || []).map((f, i) => (
            <div key={i} style={{ fontSize: 11, color: "#f87171", marginBottom: 4 }}>• {f}</div>
          ))}
        </div>

        <div style={{ fontSize: 11, color: "#aaa", marginBottom: 20, lineHeight: 1.6 }}>
          <strong style={{ color: "#fbbf24" }}>Recommended:</strong> Export your data first to keep a safe backup, then report this issue. The "Snapshot and continue (unsafe)" option will attempt to save the migration output anyway — data loss is possible.
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button
            style={{ padding: "7px 14px", borderRadius: 6, border: "1px solid #3b82f6", background: "#3b82f6", color: "#fff", cursor: "pointer", fontSize: 12, fontFamily: "system-ui", fontWeight: "bold" }}
            onClick={() => setShowExport(true)}
          >
            ⬇ Export / Print data…
          </button>
          <button
            style={{ padding: "7px 14px", borderRadius: 6, border: "1px solid #f59e0b", background: "transparent", color: "#f59e0b", cursor: "pointer", fontSize: 12, fontFamily: "system-ui" }}
            onClick={handleSnapshotAndContinue}
            disabled={snapshotting}
          >
            {snapshotting ? "Saving snapshot…" : snapshotDone ? "Continuing…" : "📸 Snapshot and continue (unsafe)"}
          </button>
        </div>

        {showExport && (
          <ExportModal
            campaign={exportCampaign}
            currentPage={null}
            onClose={() => setShowExport(false)}
            T={T}
            css={css}
          />
        )}
      </div>
    </ModalOverlay>
  );
}

// ── Sync conflict modal ───────────────────────────────────────────────────────

function SyncConflictModal({ conflict, diffs, mergeResult, onUseServer, onUseLocal, onUseMerge }) {
  const fmtTime = (ts) => {
    if (!ts) return "unknown";
    try { return new Date(typeof ts === "number" ? ts * 1000 : ts).toLocaleString(undefined, { timeZoneName: "short" }); }
    catch { return String(ts); }
  };

  const fmtSectionId = (id) => {
    if (id === "__meta__")   return "Page name / tags";
    if (id === "__costs__")  return "Costs";
    if (id === "__awards__") return "Awards";
    return id;
  };

  const fmtVal = (val) => {
    if (val == null || val === "") return "(empty)";
    if (typeof val === "string") return val;
    return JSON.stringify(val, null, 2);
  };

  const kindIcon = (kind) => {
    if (kind.includes("added"))   return "＋";
    if (kind.includes("removed")) return "−";
    if (kind.includes("edited"))  return "✎";
    if (kind.includes("merged"))  return "⤳";
    return "·";
  };

  const canMerge = mergeResult.conflicts.length === 0;
  const nonConflictDiffs = diffs.filter(d => !mergeResult.conflicts.some(c => c.id === d.id && c.kind === d.kind));

  return (
    <ModalOverlay onClose={null} zIndex={9000}>
      <div style={{ background: "#1e1e2e", border: "2px solid #f59e0b", borderRadius: 10, padding: 28, maxWidth: 640, width: "100%", color: "#eee", fontFamily: "system-ui, sans-serif", boxShadow: "0 8px 40px rgba(0,0,0,0.7)", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ fontSize: 16, fontWeight: "bold", color: "#f59e0b", marginBottom: 8 }}>⚠ Sync Conflict Detected</div>
        <div style={{ fontSize: 11, color: "#888", marginBottom: 16 }}>
          Server modified: {fmtTime(conflict.serverUpdatedAt)} · Last synced: {fmtTime(conflict.lastSyncedAt)}
        </div>

        {conflict.localRaw?.schemaVersion !== conflict.serverRaw?.schemaVersion && (
          <div style={{ fontSize: 11, color: "#60a5fa", background: "#1e3a5f", border: "1px solid #3b82f6", borderRadius: 6, padding: "6px 10px", marginBottom: 12 }}>
            Both versions were automatically upgraded to schema v{conflict.local?.schemaVersion} before comparison.
          </div>
        )}

        {mergeResult.conflicts.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: "#f87171", letterSpacing: "0.1em", marginBottom: 8 }}>CONFLICTS — must choose local or server</div>
            {mergeResult.conflicts.map((c, i) => (
              <div key={i} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: "#fca5a5", marginBottom: 6, fontWeight: "bold" }}>
                  ✗ {c.label || c.id} <span style={{ color: "#666", fontSize: 10, fontWeight: "normal" }}>({c.kind})</span>
                </div>
                {c.sectionConflicts?.map((sc, j) => (
                  <div key={j} style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 10, color: "#9ca3af", marginBottom: 4 }}>
                      Section: <span style={{ color: "#e2e8f0" }}>{fmtSectionId(sc.sectionId)}</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                      <div style={{ background: "#2d1515", border: "1px solid #7f1d1d", borderRadius: 5, padding: "6px 8px" }}>
                        <div style={{ fontSize: 9, color: "#f87171", letterSpacing: "0.08em", marginBottom: 4 }}>LOCAL</div>
                        <pre style={{ margin: 0, fontSize: 10, color: "#fca5a5", whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 120, overflowY: "auto" }}>{fmtVal(sc.localValue)}</pre>
                      </div>
                      <div style={{ background: "#152d15", border: "1px solid #14532d", borderRadius: 5, padding: "6px 8px" }}>
                        <div style={{ fontSize: 9, color: "#4ade80", letterSpacing: "0.08em", marginBottom: 4 }}>SERVER</div>
                        <pre style={{ margin: 0, fontSize: 10, color: "#86efac", whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 120, overflowY: "auto" }}>{fmtVal(sc.serverValue)}</pre>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {nonConflictDiffs.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: "#888", letterSpacing: "0.1em", marginBottom: 6 }}>OTHER CHANGES</div>
            <div style={{ background: "#12121e", border: "1px solid #333", borderRadius: 6, padding: 10 }}>
              {nonConflictDiffs.map((d, i) => (
                <div key={i} style={{ fontSize: 11, color: "#bbb", marginBottom: 2 }}>
                  {kindIcon(d.kind)} {d.label || d.id} <span style={{ color: "#555", fontSize: 10 }}>({d.kind})</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {mergeResult.autoResolved.length > 0 && (
          <details style={{ marginBottom: 16 }}>
            <summary style={{ fontSize: 11, color: "#6b7280", cursor: "pointer" }}>Auto-merged {mergeResult.autoResolved.length} item(s) by timestamp</summary>
            <div style={{ paddingTop: 8, paddingLeft: 8 }}>
              {mergeResult.autoResolved.map((r, i) => (
                <div key={i} style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 10, color: "#6b7280", marginBottom: r.autoMergedSections?.length ? 4 : 0 }}>{kindIcon(r.kind)} {r.label || r.id}</div>
                  {r.autoMergedSections?.map((s, j) => (
                    <div key={j} style={{ marginBottom: 6, paddingLeft: 8 }}>
                      <div style={{ fontSize: 10, color: "#4b5563", marginBottom: 3 }}>
                        {fmtSectionId(s.sectionId)} → kept {s.winner} version
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                        <div style={{ background: s.winner === "local" ? "#152d15" : "#1e1e2e", border: `1px solid ${s.winner === "local" ? "#14532d" : "#333"}`, borderRadius: 4, padding: "4px 6px", opacity: s.winner === "local" ? 1 : 0.4 }}>
                          <div style={{ fontSize: 9, color: s.winner === "local" ? "#4ade80" : "#555", marginBottom: 2 }}>LOCAL{s.winner === "local" ? " ✓" : ""}</div>
                          <pre style={{ margin: 0, fontSize: 10, color: s.winner === "local" ? "#86efac" : "#555", whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 60, overflowY: "auto" }}>{fmtVal(s.winner === "local" ? s.keptValue : s.discardedValue)}</pre>
                        </div>
                        <div style={{ background: s.winner === "server" ? "#152d15" : "#1e1e2e", border: `1px solid ${s.winner === "server" ? "#14532d" : "#333"}`, borderRadius: 4, padding: "4px 6px", opacity: s.winner === "server" ? 1 : 0.4 }}>
                          <div style={{ fontSize: 9, color: s.winner === "server" ? "#4ade80" : "#555", marginBottom: 2 }}>SERVER{s.winner === "server" ? " ✓" : ""}</div>
                          <pre style={{ margin: 0, fontSize: 10, color: s.winner === "server" ? "#86efac" : "#555", whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 60, overflowY: "auto" }}>{fmtVal(s.winner === "server" ? s.keptValue : s.discardedValue)}</pre>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </details>
        )}

        <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 20, lineHeight: 1.6 }}>
          {canMerge
            ? "All conflicts were resolved automatically by timestamp. Click Merge to apply."
            : "Some sections were edited on both sides. Choose which full version to keep, or resolve individual conflicts and Merge. Any sections which were only edited on one side will be saved regardless."}
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button style={{ padding: "7px 14px", borderRadius: 6, border: "1px solid #555", background: "transparent", color: "#ccc", cursor: "pointer", fontSize: 12, fontFamily: "system-ui" }} onClick={onUseLocal}>
            Keep my local version
          </button>
          <button style={{ padding: "7px 14px", borderRadius: 6, border: "1px solid #555", background: "transparent", color: "#ccc", cursor: "pointer", fontSize: 12, fontFamily: "system-ui" }} onClick={onUseServer}>
            Use server version
          </button>
          <button
            style={{ padding: "7px 14px", borderRadius: 6, border: `1px solid ${canMerge ? "#3b82f6" : "#555"}`, background: canMerge ? "#3b82f6" : "transparent", color: canMerge ? "#fff" : "#666", cursor: canMerge ? "pointer" : "not-allowed", fontSize: 12, fontFamily: "system-ui", fontWeight: "bold" }}
            onClick={canMerge ? onUseMerge : undefined}
            disabled={!canMerge}
            title={canMerge ? undefined : "Some sections were edited on both sides — choose server or local version to proceed"}
          >
            Merge ✓
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

// ── Idle warning modal ────────────────────────────────────────────────────────

function IdleWarningModal({ onDismiss }) {
  const [suppressSession, setSuppressSession] = useState(false);

  const dismiss = () => {
    if (suppressSession) sessionStorage.setItem("campaign-manager-idle-warned-session", "1");
    onDismiss();
  };

  return (
    <ModalOverlay onClose={dismiss} zIndex={8000}>
      <div style={{ background: "#1e1e2e", border: "2px solid #f59e0b", borderRadius: 10, padding: 24, maxWidth: 420, width: "100%", color: "#eee", fontFamily: "system-ui, sans-serif", boxShadow: "0 8px 40px rgba(0,0,0,0.7)" }}>
        <div style={{ fontSize: 14, fontWeight: "bold", color: "#f59e0b", marginBottom: 10 }}>⏱ Tab Idle</div>
        <div style={{ fontSize: 12, color: "#bbb", lineHeight: 1.6, marginBottom: 16 }}>
          This tab has been open for over an hour without edits. If you've been editing on another device, your next change will re-sync automatically before saving.
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "#888", marginBottom: 16, cursor: "pointer" }}>
          <input type="checkbox" checked={suppressSession} onChange={e => setSuppressSession(e.target.checked)} style={{ accentColor: "#f59e0b" }} />
          Don't show again this session
        </label>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button style={{ padding: "7px 14px", borderRadius: 6, border: "1px solid #f59e0b", background: "transparent", color: "#f59e0b", cursor: "pointer", fontSize: 12, fontFamily: "system-ui" }} onClick={dismiss}>
            Dismiss
          </button>
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
          ? <PageEditor key={leftPage.id} page={leftPage} pageTypes={campaign.pageTypes || []} allPages={campaign.pages}
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
          ? <PageEditor key={rightPage.id} page={rightPage} pageTypes={campaign.pageTypes || []} allPages={campaign.pages}
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

function FlowchartSplitView({ campaign, onUpdate, splitPageId, splitRatio, onSplitRatioChange, onSetSplitPage, T, css, mainPad }) {
  const splitPage = campaign.pages.find(p => p.id === splitPageId);
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

  return (
    <div ref={containerRef} style={{ display: "flex", flex: 1, minWidth: 0, height: "100%", overflow: "hidden" }}>
      {/* Left: Flowchart */}
      <div style={{ width: `${splitRatio * 100}%`, flexShrink: 0, height: "100%", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <Suspense fallback={null}>
          <FlowchartView
            campaign={campaign}
            onUpdate={onUpdate}
            onNavigate={(view, pageId) => { if (view === "editor" && pageId) onSetSplitPage(pageId); }}
          />
        </Suspense>
      </div>

      {/* Drag divider */}
      <div
        onMouseDown={onDividerMouseDown}
        style={{ width: 5, flexShrink: 0, cursor: "col-resize", background: T.border, zIndex: 10, transition: "background 0.15s" }}
        onMouseEnter={e => e.currentTarget.style.background = T.accent}
        onMouseLeave={e => e.currentTarget.style.background = T.border}
        title="Drag to resize"
      />

      {/* Right: Page editor */}
      <div style={{ flex: 1, minWidth: 0, height: "100%", overflowY: "auto", ...css.main, padding: mainPad }}>
        {splitPage
          ? <PageEditor
              key={splitPage.id}
              page={splitPage}
              pageTypes={campaign.pageTypes || []}
              allPages={campaign.pages}
              onUpdate={(updater) => onUpdate((data) => ({ ...data, pages: data.pages.map(p => p.id === splitPage.id ? updater(p) : p) }))}
              onBack={() => onSetSplitPage(null)}
              shareEnabled={campaign.shareEnabled || false}
            />
          : <div style={{ color: T.textDim, textAlign: "center", marginTop: 80 }}>
              <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.2 }}>◨</div>
              <div style={{ fontSize: 14, marginBottom: 8 }}>No page open</div>
              <div style={{ fontSize: 12, color: T.textMuted, maxWidth: 280, margin: "0 auto", lineHeight: 1.6 }}>
                Double-click a node or click <strong style={{ color: T.accent }}>Open page →</strong> in the panel to view it here.
              </div>
            </div>
        }
      </div>
    </div>
  );
}

// Shared nav item button — used by both the desktop activity bar and mobile bottom bar.
// variant="sidebar": vertical left column, left-border active indicator, hover effects.
// variant="bottom": horizontal bottom bar, bottom-underline active indicator, no hover.
function NavBar({ items, view, onNavigate, T, variant = "sidebar" }) {
  const sidebar = variant === "sidebar";

  const containerStyle = {
    background: T.surface,
    display: "flex",
    alignItems: "center",
    gap: 2,
    zIndex: sidebar ? 10 : 200,
    ...(sidebar
      ? { flexDirection: "column", width: 56, flexShrink: 0, paddingTop: 6, paddingBottom: 6, borderRight: `1px solid ${T.border}` }
      : { flexDirection: "row", position: "fixed", bottom: 0, left: 0, right: 0, height: 56, borderTop: `1px solid ${T.border}` }
    ),
  };

  return (
    <div className={sidebar ? "sk-activitybar" : undefined} style={containerStyle}>
      {items.map(({ key, Icon, label }) => {
        const isActive = (key === "outline" && sidebar)
          ? (view === "outline" || view === "editor")
          : view === key;
        const btnStyle = {
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          gap: sidebar ? 3 : 2, border: "none", cursor: "pointer", fontFamily: T.font,
          position: "relative",
          color: isActive ? (sidebar ? T.accentBright : T.accent) : T.textDim,
          ...(sidebar
            ? { width: 48, padding: "8px 0", background: isActive ? T.surface2 : "transparent", borderRadius: T.radius, transition: "background 0.12s, color 0.12s", flexShrink: 0 }
            : { flex: 1, padding: "4px 0", background: "transparent", borderRadius: 0 }
          ),
        };
        return (
          <button
            key={key}
            onClick={() => onNavigate(key)}
            title={label}
            style={btnStyle}
            onMouseEnter={sidebar ? (e => { if (!isActive) { e.currentTarget.style.background = T.surface2; e.currentTarget.style.color = T.text; } }) : undefined}
            onMouseLeave={sidebar ? (e => { if (!isActive) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = T.textDim; } }) : undefined}
          >
            {sidebar && isActive && (
              <span style={{ position: "absolute", left: 0, top: "20%", height: "60%", width: 3, background: T.accent, borderRadius: "0 2px 2px 0" }} />
            )}
            <Icon size={sidebar ? 18 : 17} strokeWidth={isActive ? 2 : 1.6} />
            <span style={{ fontSize: sidebar ? 8 : 9, letterSpacing: "0.05em" }}>{label.toUpperCase()}</span>
            {!sidebar && isActive && (
              <span style={{ position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)", width: 28, height: 2, background: T.accent, borderRadius: "2px 2px 0 0" }} />
            )}
          </button>
        );
      })}
    </div>
  );
}

export function App() {
  const [campaign, setCampaign] = useState(null);
  const [selectedPageId, setSelectedPageId] = useState(null);
  const [view, setView] = useState("outline");
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState("saved");
  const [migrationError, setMigrationError] = useState(null);
  const [syncConflict, setSyncConflict] = useState(null); // { local, server, diffs, mergeResult, ... }
  const [isOffline, setIsOffline] = useState(() => !navigator.onLine);
  const [isIdleStale, setIsIdleStale] = useState(false);
  const isIdleStaleRef = useRef(false);
  const idleTimerRef = useRef(null);

  const [showSearch, setShowSearch] = useState(false);
  const [showCampaigns, setShowCampaigns] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  const [showChangelogModal, setShowChangelogModal] = useState(false);
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

  // Flowchart+editor split state
  const [flowchartSplitEnabled, setFlowchartSplitEnabled] = useState(false);
  const [flowchartSplitPageId, setFlowchartSplitPageId] = useState(null);
  const [flowchartSplitRatio, setFlowchartSplitRatio] = useState(0.6); // flowchart gets more space
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

  const _finishLoad = useCallback((data) => {
    if (!data) {
      const fresh = defaultCampaign();
      setCampaign(fresh);
      historyRef.current = { stack: [fresh], idx: 0 };
      setLoading(false);
      if (hasUnseenChanges()) setShowWhatsNew(true);
      return;
    }
    // Auto-snapshot before any schema migration so the user can recover the pre-migration state
    const dataVersion = data.schemaVersion || 1;
    if (dataVersion !== SCHEMA_VERSION) {
      saveSnapshot(`Auto-backup before schema v${SCHEMA_VERSION} migration — ${new Date().toLocaleString()}`).catch(() => {});
    }
    try {
      const migrated = migrateCampaign(data);
      setCampaign(migrated);
      historyRef.current = { stack: [migrated], idx: 0 };
      setLoading(false);
      const pref = localStorage.getItem("campaign-manager-changelog-startup");
      const showOnStartup = pref === null ? true : pref === "true";
      if (showOnStartup && hasUnseenChanges()) setShowWhatsNew(true);
    } catch (err) {
      if (err instanceof MigrationError) {
        logMigrationError(err);
        setMigrationError(err);
        setLoading(false);
      } else {
        throw err;
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadData().then(({ data, conflict }) => {
      if (conflict) {
        const diffs = diffCampaigns(conflict.local, conflict.server);
        if (diffs.length === 0) { _finishLoad(conflict.server); return; }
        const mergeResult = mergeCampaigns(conflict.local, conflict.server, conflict.lastSyncedAt);
        setSyncConflict({ ...conflict, diffs, mergeResult });
        setLoading(false);
        return;
      }
      _finishLoad(data);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep isIdleStaleRef in sync so persist() (a stable callback) can read it
  useEffect(() => { isIdleStaleRef.current = isIdleStale; }, [isIdleStale]);

  // Idle timer — reset whenever update() is called; fires after 1 hour
  const _resetIdleTimer = useCallback(() => {
    const enabled = localStorage.getItem("campaign-manager-idle-warning-enabled") !== "false";
    if (!enabled) return;
    setIsIdleStale(false);
    isIdleStaleRef.current = false;
    clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      const suppressedThisSession = sessionStorage.getItem("campaign-manager-idle-warned-session");
      if (!suppressedThisSession && navigator.onLine) setIsIdleStale(true);
    }, 60 * 60 * 1000);
  }, []);

  // Start idle timer on mount; also react to coming back online
  useEffect(() => {
    _resetIdleTimer();
    const onOnline  = () => { setIsOffline(false); isIdleStaleRef.current = true; };
    const onOffline = () => setIsOffline(true);
    window.addEventListener("online",  onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online",  onOnline);
      window.removeEventListener("offline", onOffline);
      clearTimeout(idleTimerRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const persist = useCallback((nextCampaign) => {
    setSaveStatus("saving");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      if (isIdleStaleRef.current) {
        isIdleStaleRef.current = false;
        setIsIdleStale(false);
        const result = await loadData();
        if (result.conflict) {
          const diffs = diffCampaigns(nextCampaign, result.conflict.server);
          if (diffs.length > 0) {
            const mergeResult = mergeCampaigns(nextCampaign, result.conflict.server, result.conflict.lastSyncedAt);
            setSyncConflict({ ...result.conflict, local: nextCampaign, diffs, mergeResult });
            setSaveStatus("conflict");
            return;
          }
        }
      }
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

  const resolveConflict = useCallback((chosenCampaign) => {
    setCampaign(chosenCampaign);
    historyRef.current = { stack: [chosenCampaign], idx: 0 };
    setSyncConflict(null);
    saveData(chosenCampaign).then(({ localQuotaExceeded } = {}) => {
      setSaveStatus(localQuotaExceeded ? "local storage full" : "saved");
    });
  }, []);

  const update = useCallback((fn) => {
    setCampaign((previous) => {
      const next = fn(previous);
      persist(next);
      _resetIdleTimer();
      const h = historyRef.current;
      const stack = h.stack.slice(0, h.idx + 1).concat(next);
      historyRef.current = { stack: stack.length > 50 ? stack.slice(-50) : stack, idx: Math.min(h.idx + 1, 49) };
      return next;
    });
  }, [persist, _resetIdleTimer]);

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

  const isDark = typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  const loadingStyle = { background: isDark ? "#121212" : "#fafafa", color: isDark ? "#9e9e9e" : "#757575", minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif", letterSpacing: "0.1em", fontSize: 13 };

  if (loading) {
    return <div style={loadingStyle}>Loading...</div>;
  }

  if (syncConflict) {
    return (
      <div style={loadingStyle}>
        <SyncConflictModal
          conflict={syncConflict}
          diffs={syncConflict.diffs}
          mergeResult={syncConflict.mergeResult}
          onUseServer={() => resolveConflict(syncConflict.server)}
          onUseLocal={() => resolveConflict(syncConflict.local)}
          onUseMerge={() => resolveConflict(syncConflict.mergeResult.merged)}
        />
      </div>
    );
  }

  if (migrationError) {
    const fallbackT = THEMES.materialDark;
    const fallbackCss = makeCSS(fallbackT);
    return (
      <div style={loadingStyle}>
        <MigrationErrorModal
          error={migrationError}
          T={fallbackT}
          css={fallbackCss}
          onContinueUnsafe={() => {
            const after = migrationError.after || defaultCampaign();
            setCampaign(after);
            historyRef.current = { stack: [after], idx: 0 };
            setMigrationError(null);
          }}
        />
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
            <input style={{ ...css.input, width: 180, fontSize: 13 }} value={campaign.name} onChange={(event) => update((data) => ({ ...data, name: event.target.value, fieldTimestamps: { ...(data.fieldTimestamps || {}), name: new Date().toISOString() } }))} />
            <div style={{ flex: 1 }} />
            <button style={{ ...css.btn(), fontSize: 11, padding: "4px 10px", display: "flex", alignItems: "center", gap: 4 }} onClick={() => setShowSearch(true)} title="Search pages (Ctrl+K)">
              ⌕ <span style={{ opacity: 0.5, fontSize: 9 }}>⌃K</span>
            </button>
            <button style={{ ...css.btn(), fontSize: 11, padding: "4px 8px", opacity: canUndo ? 1 : 0.3 }} onClick={undo} title="Undo (Ctrl+Z)" disabled={!canUndo}>↩</button>
            <button style={{ ...css.btn(), fontSize: 11, padding: "4px 8px", opacity: canRedo ? 1 : 0.3 }} onClick={redo} title="Redo (Ctrl+Y)" disabled={!canRedo}>↪</button>
            <ThemePicker current={campaign.theme} onChange={(key) => update((data) => ({ ...data, theme: key }))} />
            <ExportDropdown campaign={campaign} currentPage={selectedPage} />
            {splitAvailable && showSidebar && (
              <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: T.textDim, cursor: "pointer", userSelect: "none", flexShrink: 0 }} title="Split screen — open two pages side by side">
                <input type="checkbox" checked={splitEnabled} onChange={e => { setSplitEnabled(e.target.checked); if (!e.target.checked) setSplitPageId(null); }}
                  style={{ accentColor: T.accent, width: 13, height: 13 }} />
                Split
              </label>
            )}
            {splitAvailable && view === "flowchart" && (
              <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: T.textDim, cursor: "pointer", userSelect: "none", flexShrink: 0 }} title="Show flowchart and page editor side by side">
                <input type="checkbox" checked={flowchartSplitEnabled} onChange={e => { setFlowchartSplitEnabled(e.target.checked); if (!e.target.checked) setFlowchartSplitPageId(null); }}
                  style={{ accentColor: T.accent, width: 13, height: 13 }} />
                Split
              </label>
            )}
            {isOffline && <span style={{ fontSize: 10, color: "#f59e0b", flexShrink: 0, fontWeight: "bold" }}>Offline</span>}
            <span style={{ fontSize: 10, color: saveStatus === "local storage full" ? T.warn : T.textMuted, flexShrink: 0 }} title={saveStatus === "local storage full" ? "Local backup failed: browser storage is full. Data is saved to the server." : undefined}>{isOffline ? "" : saveStatus}</span>
          </div>
        )}

        {isMobile && (
          <div className="sk-topbar" style={{ ...css.topbar, height: 52, padding: "0 10px", gap: 6, position: "sticky", top: 0, zIndex: 100 }}>
            {showSidebar && <button style={{ ...css.btn(), padding: "6px 10px", fontSize: 18, lineHeight: 1, flexShrink: 0 }} onClick={() => setSidebarOpen((open) => !open)}>=</button>}
            <span style={{ color: T.accentBright, fontSize: 13, fontWeight: "bold", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{view === "editor" && selectedPage ? selectedPage.name : (NAV_ITEMS.find((item) => item.key === view)?.label || view)}</span>
            <button style={{ ...css.btn(), fontSize: 14, padding: "4px 8px", flexShrink: 0 }} onClick={() => setShowSearch(true)} title="Search">⌕</button>
            <ThemePicker current={campaign.theme} onChange={(key) => update((data) => ({ ...data, theme: key, fieldTimestamps: { ...(data.fieldTimestamps || {}), theme: new Date().toISOString() } }))} />
            <ExportDropdown campaign={campaign} currentPage={selectedPage} />
            <span style={{ fontSize: 9, color: T.textMuted, flexShrink: 0 }}>{saveStatus === "saving" ? "*" : "o"}</span>
          </div>
        )}

        <div style={{ ...css.body, position: "relative", overflow: isMobile ? "visible" : "hidden", minHeight: 0 }}>
          {!isMobile && <NavBar items={NAV_ITEMS} view={view} onNavigate={navigateTo} T={T} variant="sidebar" />}

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
          {flowchartSplitEnabled && view === "flowchart" && splitAvailable ? (
            <FlowchartSplitView
              campaign={campaign}
              onUpdate={update}
              splitPageId={flowchartSplitPageId}
              splitRatio={flowchartSplitRatio}
              onSplitRatioChange={setFlowchartSplitRatio}
              onSetSplitPage={setFlowchartSplitPageId}
              T={T} css={css} mainPad={mainPad}
            />
          ) : splitActive && view === "editor" ? (
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
              {view === "editor" && selectedPage && <PageEditor key={selectedPage.id} page={selectedPage} pageTypes={campaign.pageTypes || []} allPages={campaign.pages} onUpdate={(updater) => update((data) => ({ ...data, pages: data.pages.map((item) => item.id === selectedPageId ? updater(item) : item) }))} onBack={() => navigateTo("outline")} shareEnabled={campaign.shareEnabled || false} />}
              {view === "editor" && !selectedPage && <div style={{ color: T.textDim, textAlign: "center", marginTop: 80 }}>{isMobile ? "Open the menu to select a page" : "Select a page to edit"}</div>}
              {view === "schema" && <Suspense fallback={null}><SchemaEditor campaign={campaign} onUpdate={update} /></Suspense>}
              {view === "flowchart" && <Suspense fallback={null}><FlowchartView campaign={campaign} onUpdate={update} onNavigate={navigateTo} /></Suspense>}
              {view === "simulate" && <Suspense fallback={null}><SimulatorView campaign={campaign} onUpdate={update} /></Suspense>}
              {view === "settings" && <SettingsView campaign={campaign} onUpdate={update} onRestore={(data) => { const m = migrateCampaign(data); setCampaign(m); persist(m); }} onImport={(data) => { setCampaign(data); persist(data); }} onClear={() => { const fresh = defaultCampaign(); setCampaign(fresh); persist(fresh); navigateTo("outline"); }} onNavigate={navigateTo} />}
            </div>
          )}
        </div>

        {isMobile && <NavBar items={NAV_ITEMS} view={view} onNavigate={navigateTo} T={T} variant="bottom" />}


        {showSearch && <SearchModal campaign={campaign} onNavigate={(id) => navigateTo("editor", id)} onClose={() => setShowSearch(false)} T={T} css={css} />}
        {showCampaigns && <CampaignSwitcher current={SESSION_GUID} onClose={() => setShowCampaigns(false)} T={T} css={css} />}

        {showWhatsNew && (
          <WhatsNewPopup
            T={T}
            css={css}
            isMobile={isMobile}
            onClose={() => { setShowWhatsNew(false); markChangelogSeen(); }}
            onNeverShow={() => {
              localStorage.setItem("campaign-manager-changelog-startup", "false");
              setShowWhatsNew(false);
              markChangelogSeen();
            }}
          />
        )}
        {showChangelogModal && (
          <ChangelogModal T={T} css={css} onClose={() => setShowChangelogModal(false)} />
        )}
        {isIdleStale && (
          <IdleWarningModal onDismiss={() => { setIsIdleStale(false); isIdleStaleRef.current = false; }} />
        )}
      </div>
    </ThemeCtx.Provider>
  );
}
