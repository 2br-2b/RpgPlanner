import { useState } from "react";
import { ModalOverlay, useEscapeKey } from "./ui.jsx";
import { CHANGELOG_SORTED, COMPACT_LIMIT, getUnseenEntries, isFirstVisit } from "./changelog.js";

function PriorityDot({ priority }) {
  // Color scale: 1–3 dim, 4–6 accent, 7–8 bright, 9–10 warn/highlight
  const color =
    priority >= 9 ? "#f59e0b" :
    priority >= 7 ? "#60a5fa" :
    priority >= 4 ? "#6b7280" :
    "#374151";
  const title = `Priority ${priority}/10`;
  return (
    <span
      title={title}
      style={{
        display: "inline-block",
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: color,
        flexShrink: 0,
        marginTop: 3,
      }}
    />
  );
}

function EntryList({ entries, T }) {
  return (
    <div>
      {entries.map((entry, i) => {
        const showDate = i === 0 || entries[i - 1].date !== entry.date;
        return (
          <div key={entry.id}>
            {showDate && (
              <div style={{ fontSize: 10, color: T.textDim, letterSpacing: "0.08em", marginTop: i === 0 ? 0 : 16, marginBottom: 6 }}>
                {new Date(entry.date + "T00:00:00").toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
              </div>
            )}
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 10 }}>
              <PriorityDot priority={entry.priority} />
              <div>
                <div style={{ fontSize: 13, color: T.text, fontWeight: "600", marginBottom: 2 }}>{entry.title}</div>
                <div style={{ fontSize: 12, color: T.textDim, lineHeight: 1.5 }}>{entry.description}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Full scrollable changelog modal — all entries.
export function ChangelogModal({ onClose, T, css }) {
  useEscapeKey(onClose);
  return (
    <ModalOverlay onClose={onClose} zIndex={3000}>
      <div style={{
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: T.radius,
        width: 520,
        maxWidth: "92vw",
        maxHeight: "85vh",
        display: "flex",
        flexDirection: "column",
        boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
        overflow: "hidden",
      }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center" }}>
          <span style={{ fontWeight: "bold", color: T.accentBright, letterSpacing: "0.08em", fontSize: 13 }}>CHANGELOG</span>
          <div style={{ flex: 1 }} />
          <button style={{ ...css.btn(), fontSize: 11 }} onClick={onClose}>✕</button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
          <EntryList entries={CHANGELOG_SORTED} T={T} />
        </div>
        <div style={{ padding: "12px 20px", borderTop: `1px solid ${T.border}`, display: "flex", justifyContent: "flex-end" }}>
          <button style={{ ...css.btn("primary"), fontSize: 12 }} onClick={onClose}>Close</button>
        </div>
      </div>
    </ModalOverlay>
  );
}

// Compact "What's New" / "Welcome" popup — shown at startup.
// showAll=true opens the full changelog inline.
export function WhatsNewPopup({ onClose, onNeverShow, T, css, isMobile }) {
  const [showAll, setShowAll] = useState(false);
  const firstVisit = isFirstVisit();
  const unseen = getUnseenEntries().slice(0, COMPACT_LIMIT);
  const hasMore = CHANGELOG_SORTED.length > unseen.length;

  useEscapeKey(onClose);

  if (isMobile) {
    // Mobile: notification-style banner at bottom
    return (
      <div style={{
        position: "fixed",
        bottom: 64, // above mobile nav bar
        left: 12,
        right: 12,
        zIndex: 2500,
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: T.radius,
        boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
        padding: "12px 14px",
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: "bold", color: T.accentBright, marginBottom: 2 }}>
            {firstVisit ? "Welcome!" : "What's New"}
          </div>
          <div style={{ fontSize: 11, color: T.textDim, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {firstVisit
              ? "Tap to learn how to use the app"
              : compact[0]?.title || "Updates available"}
          </div>
        </div>
        <button style={{ ...css.btn("primary"), fontSize: 11, flexShrink: 0, whiteSpace: "nowrap" }} onClick={() => { onClose(); /* reopen as full modal via parent */ setShowAll(true); }}>
          See changes
        </button>
        <button style={{ ...css.btn(), fontSize: 11, flexShrink: 0, padding: "4px 8px" }} onClick={onClose}>✕</button>
      </div>
    );
  }

  // Desktop: top-right corner popup
  return (
    <div style={{
      position: "fixed",
      top: 56, // below topbar
      right: 16,
      zIndex: 2500,
      width: showAll ? 480 : 340,
      maxWidth: "92vw",
      maxHeight: "calc(100vh - 80px)",
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderRadius: T.radius,
      boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      transition: "width 0.2s ease",
    }}>
      {/* Header */}
      <div style={{ padding: "12px 16px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontWeight: "bold", color: T.accentBright, fontSize: 13, letterSpacing: "0.08em" }}>
          {firstVisit ? "WELCOME!" : "WHAT'S NEW"}
        </span>
        <div style={{ flex: 1 }} />
        <button style={{ ...css.btn(), fontSize: 10, padding: "2px 8px" }} onClick={onClose}>✕</button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "14px 16px" }}>
        {firstVisit && !showAll && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 13, color: T.text, lineHeight: 1.6, marginBottom: 8 }}>
              Welcome to <strong style={{ color: T.accentBright }}>RPG Planner</strong> — a campaign management tool for tabletop game masters.
            </div>
            <div style={{ fontSize: 12, color: T.textDim, lineHeight: 1.6 }}>
              Create pages for missions, locations, and NPCs. Use the Schema editor to define custom page types. Share read-only views with your players. Use the Flowchart to map how pages connect.
            </div>
          </div>
        )}

        {!firstVisit && !showAll && (
          <EntryList entries={unseen} T={T} />
        )}

        {showAll && (
          <EntryList entries={CHANGELOG_SORTED} T={T} />
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: "10px 16px", borderTop: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {!showAll && (firstVisit ? (
          <button style={{ ...css.btn(), fontSize: 11 }} onClick={() => setShowAll(true)}>
            Show changelog →
          </button>
        ) : hasMore ? (
          <button style={{ ...css.btn(), fontSize: 11 }} onClick={() => setShowAll(true)}>
            Show full changelog ({CHANGELOG_SORTED.length} entries) →
          </button>
        ) : null)}
        <div style={{ flex: 1 }} />
        {!firstVisit && (
          <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: T.textDim, cursor: "pointer" }}>
            <input type="checkbox" onChange={e => { if (e.target.checked) onNeverShow(); }} style={{ accentColor: T.accent, width: 12, height: 12 }} />
            Don't show again
          </label>
        )}
        <button style={{ ...css.btn("primary"), fontSize: 11 }} onClick={onClose}>Got it</button>
      </div>
    </div>
  );
}
