import { forwardRef, useImperativeHandle } from "react";
import { Editor, rootCtx, defaultValueCtx, commandsCtx } from "@milkdown/core";
import { commonmark, insertImageCommand } from "@milkdown/preset-commonmark";
import { history } from "@milkdown/plugin-history";
import { listener, listenerCtx } from "@milkdown/plugin-listener";
import { Milkdown, MilkdownProvider, useEditor } from "@milkdown/react";
import { useThemeCSS } from "./theme.js";
import "./milkdown-editor.css";

const EditorInner = forwardRef(function EditorInner({ value, onChange }, ref) {
  const { get } = useEditor((root) =>
    Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root);
        ctx.set(defaultValueCtx, value || "");
      })
      .use(commonmark)
      .use(history)
      .use(listener)
      .config((ctx) => {
        ctx.get(listenerCtx).markdownUpdated((_, markdown) => {
          onChange?.(markdown);
        });
      })
  );

  useImperativeHandle(ref, () => ({
    insertImage: (src, alt) => {
      get()?.action((ctx) => {
        ctx.get(commandsCtx).call(insertImageCommand.key, { src, alt, title: "" });
      });
    },
  }), [get]);

  return <Milkdown />;
});

export const MilkdownEditor = forwardRef(function MilkdownEditor(
  { value, onChange, minHeight = 200 },
  ref
) {
  const { T } = useThemeCSS();

  return (
    <div
      className="milkdown-editor-wrapper"
      onKeyDown={(e) => {
        if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "y" || (e.key === "Z" && e.shiftKey))) {
          e.stopPropagation();
        }
      }}
      style={{
        border: `1px solid ${T.border}`,
        borderRadius: T.radius,
        background: T.surface,
        overflow: "hidden",
        "--mk-text": T.text,
        "--mk-text-dim": T.textDim,
        "--mk-text-muted": T.textMuted,
        "--mk-accent": T.accent,
        "--mk-accent-bright": T.accentBright,
        "--mk-accent-dim": T.accentDim,
        "--mk-surface": T.surface,
        "--mk-surface2": T.surface2,
        "--mk-border": T.border,
        "--mk-font": T.font,
        "--mk-min-height": typeof minHeight === "number" ? `${minHeight}px` : minHeight,
      }}
    >
      <MilkdownProvider>
        <EditorInner ref={ref} value={value} onChange={onChange} />
      </MilkdownProvider>
    </div>
  );
});
