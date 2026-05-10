import { useEffect, useState } from "react";

// Reusable eye/ban badge for player-visibility toggles.
// onClick is optional — omit for read-only display.
export function VisibilityBadge({ visible, onClick, fontSize = 10 }) {
  return (
    <span
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined}
      title={visible ? "Visible to players — click to hide" : "Hidden from players — click to show"}
      onClick={onClick}
      style={{ fontSize, cursor: onClick ? "pointer" : "default", userSelect: "none", lineHeight: 1 }}
    >
      {visible ? "👁" : "🚫"}
    </span>
  );
}

export function useEscapeKey(onClose) {
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);
}

export function ModalOverlay({ onClose, children, align = "center", zIndex = 2000 }) {
  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: align === "top" ? "flex-start" : "center", justifyContent: "center", zIndex, padding: align === "top" ? "80px 16px 16px" : 16 }}
      onClick={e => e.target === e.currentTarget && onClose?.()}
    >
      {children}
    </div>
  );
}

// Neutral dark confirm modal — used for danger zone actions and warnings.
// For suppress checkbox (visibility warnings), pass suppressLabel; onConfirm receives (suppress).
export function ConfirmModal({ title, message, confirmLabel, onConfirm, onCancel, danger = true, warn = false, suppressLabel, children }) {
  const [suppress, setSuppressState] = useState(false);
  const color = warn ? "#cc7700" : danger ? "#ef4444" : "#3b82f6";
  return (
    <ModalOverlay onClose={onCancel} zIndex={9999}>
      <div style={{ background: "#1e1e2e", border: "1px solid #444", borderRadius: 8, padding: 28, maxWidth: 440, width: "100%", color: "#eee", fontFamily: "system-ui, sans-serif", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>
        <div style={{ fontSize: 15, fontWeight: "bold", marginBottom: 12, color }}>{title}</div>
        {message && <div style={{ fontSize: 12, lineHeight: 1.6, color: "#bbb", marginBottom: suppressLabel || children ? 16 : 20 }}>{message}</div>}
        {children && <div style={{ fontSize: 13, lineHeight: 1.6, color: "#ccc", marginBottom: 16 }}>{children}</div>}
        {suppressLabel && (
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#aaa", marginBottom: 20, cursor: "pointer" }}>
            <input type="checkbox" checked={suppress} onChange={e => setSuppressState(e.target.checked)} />
            {suppressLabel}
          </label>
        )}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={{ padding: "7px 16px", borderRadius: 6, border: "1px solid #555", background: "transparent", color: "#ccc", cursor: "pointer", fontSize: 12, fontFamily: "system-ui" }}>Cancel</button>
          <button onClick={() => onConfirm(suppress)} style={{ padding: "7px 16px", borderRadius: 6, border: `1px solid ${color}`, background: color, color: "#fff", cursor: "pointer", fontSize: 12, fontFamily: "system-ui", fontWeight: "bold" }}>{confirmLabel}</button>
        </div>
      </div>
    </ModalOverlay>
  );
}
