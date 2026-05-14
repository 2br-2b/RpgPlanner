import { useState, useRef, useEffect } from "react";
import EmojiPicker, { EmojiStyle } from "emoji-picker-react";
import { useThemeCSS } from "./theme.js";

export function IconPicker({ value, onChange }) {
  const { T, css } = useThemeCSS();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button
        onClick={() => setOpen(v => !v)}
        title="Pick icon"
        style={{
          ...css.btn(),
          width: 42,
          height: 36,
          fontSize: 20,
          padding: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {value || "📄"}
      </button>

      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 1000 }}>
          <EmojiPicker
            onEmojiClick={(emojiData) => {
              onChange(emojiData.emoji);
              setOpen(false);
            }}
            autoFocusSearch
            height={400}
            width={320}
            previewConfig={{ showPreview: false }}
            emojiStyle={EmojiStyle.NATIVE}
          />
        </div>
      )}
    </div>
  );
}
