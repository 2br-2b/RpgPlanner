import { subscribeErrors, getConsoleSnapshot } from "./error-handler.js";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createRoot } from "react-dom/client";
import { useRegisterSW } from "virtual:pwa-register/react";
import { App } from "./app.jsx";
import { ShareApp } from "./share-view.jsx";
import { ThemeTestPage } from "./theme-test.jsx";
import "./theme-parchment.css";
import "./theme-chalkboard.css";
import "./theme-corkboard.css";
import "./theme-newspaper.css";
import "./theme-blueprint.css";
import "./theme-battletech.css";
import "./theme-bubblegum.css";

const MAX_TOASTS = 10;

function ErrorToast({ errors, onDismiss }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const handleCopy = useCallback(() => {
    const errSection = errors
      .map((e, i) => [
        `[${i + 1}] ${e.message}`,
        e.location ? `    at ${e.location}` : null,
        e.stack ? e.stack : null,
      ].filter(Boolean).join("\n"))
      .join("\n\n");
    const text = `=== Console Output ===\n${getConsoleSnapshot()}\n\n=== Errors ===\n${errSection}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    });
  }, [errors]);

  if (!errors.length) return null;

  return createPortal(
    <div style={{
      position: "fixed", bottom: 20, right: 20, zIndex: 99999,
      maxWidth: 400, width: "calc(100vw - 40px)",
      background: "#1e1e2e", border: "1px solid #ef4444",
      borderRadius: 8, boxShadow: "0 4px 24px rgba(0,0,0,0.6)",
      fontFamily: "system-ui, sans-serif", overflow: "hidden",
    }}>
      <div style={{ background: "#ef4444", padding: "7px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ color: "#fff", fontSize: 12, fontWeight: "bold" }}>
          &#9888; JavaScript Error{errors.length > 1 ? ` (${errors.length})` : ""}
        </span>
        <button
          onClick={onDismiss}
          title="Dismiss"
          style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: "0 2px" }}
        >&times;</button>
      </div>
      <div style={{ padding: 12, maxHeight: 220, overflowY: "auto" }}>
        {errors.map((err, i) => (
          <div key={i} style={{ marginBottom: i < errors.length - 1 ? 10 : 0 }}>
            {errors.length > 1 && (
              <div style={{ fontSize: 10, color: "#888", marginBottom: 2 }}>Error {i + 1}</div>
            )}
            <div style={{ fontSize: 12, color: "#eee", wordBreak: "break-word", lineHeight: 1.4 }}>
              {err.message.length > 200 ? err.message.slice(0, 200) + "…" : err.message}
            </div>
            {err.location && (
              <div style={{ fontSize: 10, color: "#888", marginTop: 3 }}>at {err.location}</div>
            )}
          </div>
        ))}
      </div>
      <div style={{ padding: "8px 12px", borderTop: "1px solid #2d2d40", display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={handleCopy}
          style={{
            background: "#2a2a3e", border: `1px solid ${copied ? "#4ade80" : "#555"}`,
            color: copied ? "#4ade80" : "#ccc", cursor: "pointer",
            padding: "5px 12px", borderRadius: 5, fontSize: 11,
            fontFamily: "system-ui", transition: "color 0.15s, border-color 0.15s",
          }}
        >
          {copied ? "Copied!" : "Copy console output"}
        </button>
      </div>
    </div>,
    document.body
  );
}

function Root() {
  const { needRefresh: [needRefresh], updateSW } = useRegisterSW();
  const [errors, setErrors] = useState([]);

  useEffect(() => {
    if (needRefresh) updateSW(true);
  }, [needRefresh, updateSW]);

  useEffect(() => {
    return subscribeErrors(info => {
      setErrors(prev => prev.length >= MAX_TOASTS ? prev : [...prev, info]);
    });
  }, []);

  const shareMatch = window.location.pathname.match(/^\/share\/(.+)$/);
  const isThemeTest = window.location.pathname === "/themes";

  return (
    <>
      {isThemeTest ? <ThemeTestPage /> : shareMatch ? <ShareApp shareGuid={shareMatch[1]} /> : <App />}
      <ErrorToast errors={errors} onDismiss={() => setErrors([])} />
    </>
  );
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
