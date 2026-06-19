import { forwardRef, useImperativeHandle, useState, useCallback, useRef, useEffect } from "react";
import { Link, Unlink } from "lucide-react";
import { Editor, rootCtx, defaultValueCtx, commandsCtx, editorViewCtx } from "@milkdown/core";
import {
  commonmark,
  insertImageCommand,
  toggleLinkCommand,
  linkSchema,
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
import { trailing } from "@milkdown/plugin-trailing";
import { clipboard } from "@milkdown/plugin-clipboard";
import { upload } from "@milkdown/plugin-upload";
import { emoji } from "@milkdown/plugin-emoji";
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

function EditorToolbar({ cmd, visible, onLinkOpen, onUnlink, isOnLink }) {
  if (!visible) return null;
  return (
    <div className="mk-toolbar">
      {TOOLBAR_GROUPS.map((group, gi) => (
        <span key={gi} className="mk-toolbar-group">
          {group.map(({ label, title, cmd: action, cls }) => (
            <button
              key={title}
              title={title}
              className={["mk-toolbar-btn", cls].filter(Boolean).join(" ")}
              onMouseDown={(e) => { e.preventDefault(); action(cmd); }}
            >
              {label}
            </button>
          ))}
          {gi === 1 && (
            <button
              title={isOnLink ? "Remove link" : "Link (Ctrl+K)"}
              className="mk-toolbar-btn"
              onMouseDown={(e) => { e.preventDefault(); isOnLink ? onUnlink() : onLinkOpen(); }}
            >
              {isOnLink ? <Unlink size={12} strokeWidth={2} /> : <Link size={12} strokeWidth={2} />}
            </button>
          )}
        </span>
      ))}
    </div>
  );
}

const EditorInner = forwardRef(function EditorInner({ value, onChange, onFocus, onBlur, focused }, ref) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkHref, setLinkHref] = useState("");
  const [isOnLink, setIsOnLink] = useState(false);
  const linkInputRef = useRef(null);

  const initialValueRef = useRef(value);

  const { get } = useEditor(
    useCallback((root) =>
      Editor.make()
        .config((ctx) => {
          ctx.set(rootCtx, root);
          ctx.set(defaultValueCtx, initialValueRef.current || "");
        })
        .use(commonmark)
        .use(trailing)
        .use(clipboard)
        .use(upload)
        .use(emoji)
        .use(underlinePlugin)
        .use(history)
        .use(listener)
        .config((ctx) => {
          ctx.get(listenerCtx)
            .markdownUpdated((_, markdown) => { onChangeRef.current?.(markdown); })
            .selectionUpdated(() => {
              const view = ctx.get(editorViewCtx);
              if (!view?.state) return;
              const { state } = view;
              const { from, to } = state.selection;
              const linkType = linkSchema.type(ctx);
              let found = false;
              state.doc.nodesBetween(from, from === to ? to + 1 : to, (node) => {
                if (found) return false;
                if (node.marks.some((m) => m.type === linkType)) found = true;
              });
              setIsOnLink(found);
            });
        }),
    [])
  );

  const cmd = useCallback((command, payload) => {
    get()?.action((ctx) => ctx.get(commandsCtx).call(command.key, payload));
  }, [get]);

  const getLinkAtCursor = useCallback(() => {
    let href = null;
    get()?.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      if (!view?.state) return;
      const { state } = view;
      const { from, to } = state.selection;
      const linkType = linkSchema.type(ctx);
      state.doc.nodesBetween(from, from === to ? to + 1 : to, (node) => {
        if (href) return false;
        const mark = node.marks.find((m) => m.type === linkType);
        if (mark) href = mark.attrs.href || "";
      });
    });
    return href;
  }, [get]);

  useImperativeHandle(ref, () => ({
    insertImage: (src, alt) => cmd(insertImageCommand, { src, alt, title: "" }),
    insertLink: (href) => cmd(toggleLinkCommand, { href }),
  }), [cmd]);

  const openLinkDialog = useCallback(() => {
    const existing = getLinkAtCursor();
    setLinkHref(existing ?? "");
    setLinkDialogOpen(true);
  }, [getLinkAtCursor]);

  const confirmLink = useCallback(() => {
    if (linkHref.trim()) {
      cmd(toggleLinkCommand, { href: linkHref.trim() });
    }
    setLinkDialogOpen(false);
  }, [cmd, linkHref]);

  const cancelLink = useCallback(() => {
    setLinkDialogOpen(false);
  }, []);

  const removeLink = useCallback(() => {
    cmd(toggleLinkCommand);
  }, [cmd]);

  useEffect(() => {
    if (linkDialogOpen) linkInputRef.current?.focus();
  }, [linkDialogOpen]);

  return (
    <div
      onFocus={onFocus}
      onBlur={onBlur}
      style={{ position: "relative" }}
      onKeyDown={(e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "k") {
          e.preventDefault();
          if (isOnLink) removeLink();
          else openLinkDialog();
        }
      }}
    >
      <EditorToolbar cmd={cmd} visible={focused} onLinkOpen={openLinkDialog} onUnlink={removeLink} isOnLink={isOnLink} />
      <Milkdown />
      {linkDialogOpen && (
        <div className="mk-link-dialog">
          <input
            ref={linkInputRef}
            className="mk-link-input"
            type="url"
            placeholder="https://example.com"
            value={linkHref}
            onChange={(e) => setLinkHref(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); confirmLink(); }
              if (e.key === "Escape") { e.preventDefault(); cancelLink(); }
            }}
          />
          <div className="mk-link-dialog-actions">
            <button className="mk-toolbar-btn" onMouseDown={(e) => { e.preventDefault(); confirmLink(); }}>
              Apply
            </button>
            <button className="mk-toolbar-btn" onMouseDown={(e) => { e.preventDefault(); cancelLink(); }}>
              Cancel
            </button>
          </div>
        </div>
      )}
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
