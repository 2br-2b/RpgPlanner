import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { THEMES, useThemeCSS } from "./theme.js";
import "./theme-picker.css";

function chipStyle(themeKey, theme, selected) {
  return {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "5px 10px",
    borderRadius: theme.radius || 4,
    border: "none",
    outline: `2px solid ${selected ? theme.accentBright : theme.border}`,
    outlineOffset: "-2px",
    background: theme.chipBg || theme.surface,
    cursor: "pointer",
    fontFamily: theme.font,
    fontSize: 12,
    color: theme.text,
    userSelect: "none",
    boxShadow: theme.chipShadow,
    transition: "outline-color 0.1s",
  };
}

export function ThemeChip({ themeKey, selected, onClick }) {
  const theme = THEMES[themeKey];
  if (!theme) return null;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => (e.key === "Enter" || e.key === " ") && onClick?.()}
      style={chipStyle(themeKey, theme, selected)}
    >
      <span style={{ width: 9, height: 9, borderRadius: "50%", background: theme.accent, flexShrink: 0 }} />
      <span style={{ color: theme.text, fontFamily: theme.font }}>{theme.label}</span>
    </div>
  );
}

export function ThemeChipRow({ current, onChange }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {Object.keys(THEMES).map(key => (
        <ThemeChip key={key} themeKey={key} selected={key === current} onClick={() => onChange(key)} />
      ))}
    </div>
  );
}

export function ThemePicker({ current, onChange }) {
  const { T, css } = useThemeCSS();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const btnRef = useRef(null);
  const dropRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (btnRef.current?.contains(e.target)) return;
      if (dropRef.current && !dropRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleOpen = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
    }
    setOpen(o => !o);
  };

  return (
    <div style={{ position: "relative" }}>
      <button ref={btnRef} style={{ ...css.btn(), fontSize: 11, display: "flex", alignItems: "center", gap: 6 }} onClick={handleOpen}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: T.accent, display: "inline-block" }} />
        {THEMES[current]?.label || "Theme"} ▾
      </button>
      {open && createPortal(
        <div ref={dropRef} style={{ position: "fixed", top: pos.top, right: pos.right, background: "#1a1a1a", border: "1px solid #444", borderRadius: 6, zIndex: 9999, padding: 8, boxShadow: "0 4px 24px rgba(0,0,0,0.7)", display: "flex", flexDirection: "column", gap: 4, minWidth: 180, maxHeight: "80vh", overflowY: "auto" }}>
          {Object.keys(THEMES).map(key => (
            <ThemeChip key={key} themeKey={key} selected={key === current} onClick={() => { onChange(key); setOpen(false); }} />
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}
