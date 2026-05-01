import { forwardRef, useImperativeHandle, useState, useCallback } from "react";
import { Editor, rootCtx, defaultValueCtx, commandsCtx } from "@milkdown/core";
import {
  commonmark,
  insertImageCommand,
  toggleStrongCommand,
  toggleEmphasisCommand,
  toggleInlineCodeCommand,
  wrapInHeadingCommand,
  wrapInBulletListCommand,
  wrapInOrderedListCommand,
  wrapInBlockquoteCommand,
  createCodeBlockCommand,
  turnIntoTextCommand,
} from "@milkdown/preset-commonmark";
import { history } from "@milkdown/plugin-history";
import { listener, listenerCtx } from "@milkdown/plugin-listener";
import { Milkdown, MilkdownProvider, useEditor } from "@milkdown/react";
import { $mark, $command } from "@milkdown/utils";
import { toggleMark } from "@milkdown/prose/commands";
import { useThemeCSS } from "./theme.js";
import "./milkdown-editor.css";

const underlineSchema = $mark("underline", () => ({
  parseDOM: [{ tag: "u" }],
  toDOM: () => ["u", 0],
}));

const toggleUnderlineCommand = $command("ToggleUnderline", (ctx) => () =>
  toggleMark(underlineSchema.type(ctx))
);

const underlinePlugin = [underlineSchema, toggleUnderlineCommand];

const TOOLBAR_GROUPS = [
  [
    { label: "¶", title: "Plain text (remove heading)", cmd: (c) => c(turnIntoTextCommand) },
    { label: "H1", title: "Heading 1", cmd: (c) => c(wrapInHeadingCommand, 1), cls: "mk-heading" },
    { label: "H2", title: "Heading 2", cmd: (c) => c(wrapInHeadingCommand, 2), cls: "mk-heading" },
    { label: "H3", title: "Heading 3", cmd: (c) => c(wrapInHeadingCommand, 3), cls: "mk-heading" },
  ],
  [
    { label: "B", title: "Bold (Ctrl+B)", cmd: (c) => c(toggleStrongCommand), cls: "mk-bold" },
    { label: "I", title: "Italic (Ctrl+I)", cmd: (c) => c(toggleEmphasisCommand), cls: "mk-italic" },
    { label: "U", title: "Underline", cmd: (c) => c(toggleUnderlineCommand), cls: "mk-underline" },
    { label: "</>", title: "Inline Code", cmd: (c) => c(toggleInlineCodeCommand), cls: "mk-code" },
  ],
  [
    { label: "❝", title: "Blockquote", cmd: (c) => c(wrapInBlockquoteCommand) },
    { label: "•", title: "Bullet List", cmd: (c) => c(wrapInBulletListCommand) },
    { label: "1.", title: "Ordered List", cmd: (c) => c(wrapInOrderedListCommand) },
    { label: "{ }", title: "Code Block", cmd: (c) => c(createCodeBlockCommand), cls: "mk-code" },
  ],
];

function EditorToolbar({ cmd, visible }) {
  if (!visible) return null;
  return (
    <div className="mk-toolbar">
      {TOOLBAR_GROUPS.map((group, gi) => (
        <span key={gi} className="mk-toolbar-group">
          {group.map(({ label, title, cmd: action, cls }) => (
            <button
              key={label}
              title={title}
              className={["mk-toolbar-btn", cls].filter(Boolean).join(" ")}
              onMouseDown={(e) => { e.preventDefault(); action(cmd); }}
            >
              {label}
            </button>
          ))}
        </span>
      ))}
    </div>
  );
}

const EditorInner = forwardRef(function EditorInner({ value, onChange, onFocus, onBlur, focused }, ref) {
  const { get } = useEditor((root) =>
    Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root);
        ctx.set(defaultValueCtx, value || "");
      })
      .use(commonmark)
      .use(underlinePlugin)
      .use(history)
      .use(listener)
      .config((ctx) => {
        ctx.get(listenerCtx).markdownUpdated((_, markdown) => {
          onChange?.(markdown);
        });
      })
  );

  const cmd = useCallback((command, payload) => {
    get()?.action((ctx) => ctx.get(commandsCtx).call(command.key, payload));
  }, [get]);

  useImperativeHandle(ref, () => ({
    insertImage: (src, alt) => cmd(insertImageCommand, { src, alt, title: "" }),
  }), [cmd]);

  return (
    <div onFocus={onFocus} onBlur={onBlur}>
      <EditorToolbar cmd={cmd} visible={focused} />
      <Milkdown />
    </div>
  );
});

export const MilkdownEditor = forwardRef(function MilkdownEditor(
  { value, onChange, minHeight = 200 },
  ref
) {
  const { T } = useThemeCSS();
  const [focused, setFocused] = useState(false);

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
        <EditorInner
          ref={ref}
          value={value}
          onChange={onChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          focused={focused}
        />
      </MilkdownProvider>
    </div>
  );
});
