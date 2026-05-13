import { useState, useEffect, useRef, useCallback } from "react";
import { useThemeCSS } from "./theme.js";
import { uid } from "./storage.js";

export function getSiblings(pages, parentId) {
  return pages.filter(p => (p.parentId ?? null) === (parentId ?? null)).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

function reorder(pages, siblings) {
  const ids = new Set(siblings.map(s => s.id));
  const updated = siblings.map((s, i) => ({ ...s, order: i }));
  return pages.map(p => ids.has(p.id) ? updated.find(u => u.id === p.id) : p);
}

function isAncestor(pages, ancestorId, pageId) {
  let current = pages.find(p => p.id === pageId);
  while (current && current.parentId != null) {
    if (current.parentId === ancestorId) return true;
    current = pages.find(p => p.id === current.parentId);
  }
  return false;
}

export function Sidebar({ campaign, selectedPageId, onSelect, onUpdate, width, splitActive, splitTarget, onSplitTargetChange, splitPageId }) {
  const { T, css } = useThemeCSS();
  const [name, setName] = useState("");
  const pageTypes = campaign.pageTypes || [];
  const [type, setType] = useState(() => pageTypes[0]?.id || "");
  const [pendingDelete, setPendingDelete] = useState(null);
  const [nameError, setNameError] = useState(false);
  const [collapsed, setCollapsed] = useState(new Set());

  const [dragId, setDragId] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  // dropLineY: pixel Y relative to scroll container top for the indicator line (null = hidden)
  const [dropLineY, setDropLineY] = useState(null);
  const [dropLineIndent, setDropLineIndent] = useState(0);

  const expandTimerRef = useRef(null);
  const scrollContainerRef = useRef(null);
  // Map of pageId -> row DOM element
  const rowRefs = useRef({});

  useEffect(() => {
    setType(prev => {
      const ids = (campaign.pageTypes || []).map(t => t.id);
      return ids.includes(prev) ? prev : (ids[0] || "");
    });
  }, [campaign.pageTypes]);

  const add = () => {
    if (!name.trim()) { setNameError(true); return; }
    setNameError(false);
    const siblings = getSiblings(campaign.pages, null);
    onUpdate(c => ({ ...c, pages: [...c.pages, { id: uid(), name: name.trim(), type, tags: [], sections: {}, costs: [], awards: [], parentId: null, order: siblings.length }] }));
    setName("");
  };

  const movePage = (pageId, dir) => {
    onUpdate(c => {
      const page = c.pages.find(p => p.id === pageId); if (!page) return c;
      const siblings = getSiblings(c.pages, page.parentId ?? null);
      const idx = siblings.findIndex(s => s.id === pageId);
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= siblings.length) return c;
      const swapped = [...siblings];
      [swapped[idx], swapped[newIdx]] = [swapped[newIdx], swapped[idx]];
      return { ...c, pages: reorder(c.pages, swapped) };
    });
  };

  const indentPage = (pageId) => {
    onUpdate(c => {
      const page = c.pages.find(p => p.id === pageId); if (!page) return c;
      const siblings = getSiblings(c.pages, page.parentId ?? null);
      const idx = siblings.findIndex(s => s.id === pageId);
      if (idx === 0) return c;
      const newParent = siblings[idx - 1];
      const newSiblings = getSiblings(c.pages, newParent.id);
      const updated = c.pages.map(p => p.id === pageId ? { ...p, parentId: newParent.id, order: newSiblings.length } : p);
      return { ...c, pages: reorder(updated, getSiblings(updated, page.parentId ?? null)) };
    });
  };

  const unindentPage = (pageId) => {
    onUpdate(c => {
      const page = c.pages.find(p => p.id === pageId);
      if (!page || (page.parentId ?? null) === null) return c;
      const parent = c.pages.find(p => p.id === page.parentId);
      const newParentId = parent ? (parent.parentId ?? null) : null;
      const newSiblings = getSiblings(c.pages, newParentId);
      const parentIdx = newSiblings.findIndex(s => s.id === parent?.id);
      if (parentIdx === -1) return c;
      const withRemoved = newSiblings.filter(s => s.id !== pageId);
      withRemoved.splice(parentIdx + 1, 0, { ...page, parentId: newParentId });
      let pages = c.pages.map(p => p.id === pageId ? { ...p, parentId: newParentId } : p);
      pages = reorder(pages, getSiblings(pages, page.parentId).filter(s => s.id !== pageId));
      pages = reorder(pages, withRemoved);
      return { ...c, pages };
    });
  };

  const duplicatePage = (pageId) => {
    onUpdate(c => {
      const page = c.pages.find(p => p.id === pageId); if (!page) return c;
      const siblings = getSiblings(c.pages, page.parentId ?? null);
      const clone = { ...page, id: uid(), name: `${page.name} (copy)`, order: siblings.length };
      return { ...c, pages: [...c.pages, clone] };
    });
  };

  const toggleCollapse = (pageId) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(pageId)) next.delete(pageId);
      else next.add(pageId);
      return next;
    });
  };

  const clearDropLine = useCallback(() => {
    setDropLineY(null);
    setDropLineIndent(0);
  }, []);

  const updateDropLine = useCallback((rowEl, position, depth) => {
    if (!scrollContainerRef.current || !rowEl) { clearDropLine(); return; }
    const containerRect = scrollContainerRef.current.getBoundingClientRect();
    const rowRect = rowEl.getBoundingClientRect();
    const scrollTop = scrollContainerRef.current.scrollTop;
    let y;
    if (position === "before") {
      y = rowRect.top - containerRect.top + scrollTop;
    } else {
      // after: bottom of the row
      y = rowRect.bottom - containerRect.top + scrollTop;
    }
    setDropLineY(y);
    setDropLineIndent(4 + depth * 16);
  }, [clearDropLine]);

  const handleDragStart = useCallback((e, pageId) => {
    setDragId(pageId);
    setDropTarget(null);
    clearDropLine();
    e.dataTransfer.effectAllowed = "move";
    const ghost = document.createElement("div");
    ghost.style.position = "fixed";
    ghost.style.top = "-9999px";
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    setTimeout(() => document.body.removeChild(ghost), 0);
  }, [clearDropLine]);

  const handleDragOver = useCallback((e, pageId, depth, pages) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";

    if (!dragId || dragId === pageId) return;
    if (isAncestor(pages, dragId, pageId)) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const relY = e.clientY - rect.top;
    const third = rect.height / 3;

    let position;
    if (relY < third) {
      position = "before";
    } else if (relY > third * 2) {
      position = "after";
    } else {
      position = "inside";
    }

    setDropTarget(prev => {
      if (prev && prev.pageId === pageId && prev.position === position) return prev;
      return { pageId, position };
    });

    if (position === "before" || position === "after") {
      updateDropLine(rowRefs.current[pageId], position, depth);
    } else {
      clearDropLine();
    }

    if (position === "inside") {
      const hasChildren = getSiblings(pages, pageId).length > 0;
      if (hasChildren) {
        if (!expandTimerRef.current) {
          expandTimerRef.current = setTimeout(() => {
            setCollapsed(prev => {
              if (!prev.has(pageId)) return prev;
              const next = new Set(prev);
              next.delete(pageId);
              return next;
            });
            expandTimerRef.current = null;
          }, 600);
        }
      }
    } else {
      if (expandTimerRef.current) {
        clearTimeout(expandTimerRef.current);
        expandTimerRef.current = null;
      }
    }
  }, [dragId, updateDropLine, clearDropLine]);

  const handleDragLeave = useCallback((e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDropTarget(null);
      clearDropLine();
      if (expandTimerRef.current) {
        clearTimeout(expandTimerRef.current);
        expandTimerRef.current = null;
      }
    }
  }, [clearDropLine]);

  const handleDrop = useCallback((e, targetPageId) => {
    e.preventDefault();
    if (!dragId || !dropTarget) return;
    const { position } = dropTarget;

    onUpdate(c => {
      const dragged = c.pages.find(p => p.id === dragId);
      const target = c.pages.find(p => p.id === targetPageId);
      if (!dragged || !target) return c;
      if (dragged.id === target.id) return c;
      if (isAncestor(c.pages, dragged.id, target.id)) return c;

      let pages = c.pages;

      if (position === "inside") {
        const oldSiblings = getSiblings(pages, dragged.parentId ?? null).filter(p => p.id !== dragged.id);
        pages = reorder(pages, oldSiblings);
        const newSiblings = getSiblings(pages, target.id);
        pages = pages.map(p => p.id === dragged.id ? { ...p, parentId: target.id, order: newSiblings.length } : p);
        setCollapsed(prev => {
          const next = new Set(prev);
          next.delete(target.id);
          return next;
        });
      } else {
        const newParentId = target.parentId ?? null;
        const oldSiblings = getSiblings(pages, dragged.parentId ?? null).filter(p => p.id !== dragged.id);
        pages = reorder(pages, oldSiblings);
        let newSiblings = getSiblings(pages, newParentId).filter(p => p.id !== dragged.id);
        const targetIdx = newSiblings.findIndex(p => p.id === target.id);
        const insertAt = position === "before" ? targetIdx : targetIdx + 1;
        newSiblings.splice(insertAt, 0, { ...dragged, parentId: newParentId });
        pages = reorder(pages, newSiblings);
      }

      return { ...c, pages };
    });

    setDragId(null);
    setDropTarget(null);
    clearDropLine();
  }, [dragId, dropTarget, onUpdate, clearDropLine]);

  const handleDragEnd = useCallback(() => {
    setDragId(null);
    setDropTarget(null);
    clearDropLine();
    if (expandTimerRef.current) {
      clearTimeout(expandTimerRef.current);
      expandTimerRef.current = null;
    }
  }, [clearDropLine]);

  const renderTree = (parentId, depth) => {
    const siblings = getSiblings(campaign.pages, parentId);
    return siblings.map((page, idx) => {
      const isSelected = selectedPageId === page.id;
      const isRightPane = splitActive && splitPageId === page.id;
      const isDeleting = pendingDelete === page.id;
      const children = getSiblings(campaign.pages, page.id);
      const hasChildren = children.length > 0;
      const hasParent = (page.parentId ?? null) !== null;
      const isCollapsed = collapsed.has(page.id);
      const pt = pageTypes.find(t => t.id === page.type) || pageTypes[0];
      const isDragging = dragId === page.id;
      const isDropInside = dropTarget?.pageId === page.id && dropTarget.position === "inside";

      return (
        <div key={page.id}>
          <div
            ref={el => { if (el) rowRefs.current[page.id] = el; else delete rowRefs.current[page.id]; }}
            draggable
            onDragStart={e => handleDragStart(e, page.id)}
            onDragOver={e => handleDragOver(e, page.id, depth, campaign.pages)}
            onDragLeave={handleDragLeave}
            onDrop={e => handleDrop(e, page.id)}
            onDragEnd={handleDragEnd}
            style={{
              paddingLeft: 4 + depth * 16,
              paddingRight: 4,
              paddingTop: 5,
              paddingBottom: 5,
              cursor: isDragging ? "grabbing" : "grab",
              background: isDropInside
                ? T.accent + "33"
                : isSelected || isRightPane
                  ? T.surface2
                  : "transparent",
              borderLeft: `3px solid ${isSelected ? T.accent : isRightPane ? T.accentBright : isDropInside ? T.accent : "transparent"}`,
              borderBottom: isDeleting ? "none" : `1px solid ${T.border}`,
              display: "flex",
              alignItems: "center",
              gap: 3,
              opacity: isDragging ? 0.4 : 1,
              transition: "background 0.1s, opacity 0.1s",
            }}
            onClick={() => { setPendingDelete(null); onSelect(page.id); }}
          >
            <button
              style={{ background: "transparent", border: "none", cursor: hasChildren ? "pointer" : "default", color: hasChildren ? T.textDim : "transparent", fontSize: 9, padding: "0 2px", lineHeight: 1, flexShrink: 0, fontFamily: T.font }}
              onClick={e => { e.stopPropagation(); if (hasChildren) toggleCollapse(page.id); }}
              title={hasChildren ? (isCollapsed ? "Expand" : "Collapse") : undefined}
            >{hasChildren ? (isCollapsed ? "▶" : "▼") : "·"}</button>
            <span style={{ fontSize: 12, color: T.accent, flexShrink: 0 }}>{pt?.icon || "📄"}</span>
            <span style={{ flex: 1, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{page.name}</span>
            {isRightPane && <span style={{ fontSize: 9, color: T.accentBright, flexShrink: 0 }} title="Open in right pane">◨</span>}
            <div style={{ display: "flex", flexDirection: "column", gap: 1, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
              <button style={{ ...css.btn(), padding: "1px 5px", fontSize: 10, lineHeight: 1.3, opacity: idx === 0 ? 0.2 : 0.7 }} disabled={idx === 0} title="Move up" onClick={() => movePage(page.id, -1)}>↑</button>
              <button style={{ ...css.btn(), padding: "1px 5px", fontSize: 10, lineHeight: 1.3, opacity: idx === siblings.length - 1 ? 0.2 : 0.7 }} disabled={idx === siblings.length - 1} title="Move down" onClick={() => movePage(page.id, 1)}>↓</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 1, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
              <button style={{ ...css.btn(), padding: "1px 5px", fontSize: 10, lineHeight: 1.3, opacity: idx === 0 ? 0.2 : 0.7 }} disabled={idx === 0} title="Indent" onClick={() => indentPage(page.id)}>⇥</button>
              <button style={{ ...css.btn(), padding: "1px 5px", fontSize: 10, lineHeight: 1.3, opacity: hasParent ? 0.7 : 0.2 }} disabled={!hasParent} title="Unindent" onClick={() => unindentPage(page.id)}>⇤</button>
            </div>
            <button style={{ ...css.btn(), padding: "1px 5px", fontSize: 10, opacity: 0.6, flexShrink: 0 }} title="Duplicate page"
              onClick={e => { e.stopPropagation(); duplicatePage(page.id); }}>⧉</button>
            <button style={{ ...css.btn("danger"), padding: "1px 5px", fontSize: 10, opacity: 0.6, flexShrink: 0 }}
              onClick={e => { e.stopPropagation(); setPendingDelete(isDeleting ? null : page.id); }}>×</button>
          </div>
          {isDeleting && (() => {
            const collectNames = (id) => {
              const kids = getSiblings(campaign.pages, id);
              return kids.flatMap(k => [k.name, ...collectNames(k.id)]);
            };
            const childNames = collectNames(page.id);
            return (
              <div style={{ background: T.danger + "22", borderBottom: `1px solid ${T.border}`, paddingLeft: 4 + depth * 16, paddingRight: 8, paddingTop: 6, paddingBottom: 6 }}>
                <div style={{ fontSize: 10, color: T.danger, marginBottom: childNames.length ? 4 : 0 }}>
                  Delete &ldquo;{page.name}&rdquo;{childNames.length > 0 ? " and its children?" : "?"}
                </div>
                {childNames.length > 0 && (
                  <div style={{ fontSize: 9, color: T.textDim, marginBottom: 6, lineHeight: 1.5 }}>
                    {childNames.map(n => <span key={n} style={{ display: "inline-block", background: T.surface2, borderRadius: 3, padding: "0 4px", marginRight: 4 }}>{n}</span>)}
                  </div>
                )}
                <div style={{ display: "flex", gap: 6 }}>
                  <button style={{ ...css.btn("danger"), padding: "2px 8px", fontSize: 10 }} onClick={() => {
                    const toDelete = new Set();
                    const collect = (id) => { toDelete.add(id); getSiblings(campaign.pages, id).forEach(c => collect(c.id)); };
                    collect(page.id);
                    onUpdate(c => {
                      const fc = c.flowchart;
                      const deletedNodes = fc ? fc.nodes.filter(n => toDelete.has(n.pageId)).map(n => n.id) : [];
                      const deletedNodeSet = new Set(deletedNodes);
                      return {
                        ...c,
                        pages: c.pages.filter(p => !toDelete.has(p.id)),
                        flowchart: fc ? {
                          nodes: fc.nodes.filter(n => !deletedNodeSet.has(n.id)),
                          edges: fc.edges.filter(e => !deletedNodeSet.has(e.from) && !deletedNodeSet.has(e.to)),
                        } : fc,
                      };
                    });
                    setPendingDelete(null);
                  }}>Yes, delete</button>
                  <button style={{ ...css.btn(), padding: "2px 8px", fontSize: 10 }} onClick={() => setPendingDelete(null)}>Cancel</button>
                </div>
              </div>
            );
          })()}
          {hasChildren && !isCollapsed && renderTree(page.id, depth + 1)}
        </div>
      );
    });
  };

  return (
    <div className="sk-sidebar" style={{ ...css.sidebar, width: width ?? css.sidebar.width }}>
      <div style={{ padding: "10px 12px", borderBottom: `1px solid ${T.border}` }}>
        <div style={css.label}>Pages</div>
        <input style={{ ...css.input, fontSize: 11, marginBottom: nameError ? 2 : 6, borderColor: nameError ? T.danger : undefined, outline: nameError ? `1px solid ${T.danger}` : undefined }}
          placeholder="Page name..." value={name}
          onChange={e => { setName(e.target.value); if (e.target.value.trim()) setNameError(false); }}
          onKeyDown={e => e.key === "Enter" && add()} />
        {nameError && <div style={{ fontSize: 10, color: T.danger, marginBottom: 4 }}>Name is required</div>}
        <div style={{ display: "flex", gap: 4 }}>
          <select style={{ ...css.input, fontSize: 11, flex: 1 }} value={type} onChange={e => setType(e.target.value)}>
            {pageTypes.map(pt => <option key={pt.id} value={pt.id}>{pt.name}</option>)}
          </select>
          <button style={css.btn("primary")} onClick={add}>+</button>
        </div>
      </div>
      {splitActive && (
        <div style={{ padding: "6px 10px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 10, color: T.textDim, flexShrink: 0 }}>Open in:</span>
          <div style={{ display: "flex", borderRadius: T.radius, overflow: "hidden", border: `1px solid ${T.border}`, flexShrink: 0 }}>
            {["left", "right"].map((side, i) => (
              <button key={side}
                onClick={() => onSplitTargetChange(side)}
                style={{
                  padding: "3px 10px", fontSize: 10, border: "none", cursor: "pointer",
                  fontFamily: T.font,
                  borderRight: i === 0 ? `1px solid ${T.border}` : "none",
                  background: splitTarget === side ? T.accent : T.surface2,
                  color: splitTarget === side ? T.surface : T.text,
                  fontWeight: splitTarget === side ? "bold" : "normal",
                }}>
                {side === "left" ? "◧ Left" : "Right ◨"}
              </button>
            ))}
          </div>
        </div>
      )}
      <div ref={scrollContainerRef} style={{ flex: 1, overflow: "auto", position: "relative" }}>
        {campaign.pages.length === 0 && <div style={{ padding: 12, color: T.textMuted, fontSize: 11 }}>No pages yet</div>}
        {renderTree(null, 0)}
        {/* Absolutely-positioned drop line — never affects layout */}
        {dropLineY !== null && (
          <div style={{
            position: "absolute",
            top: dropLineY - 1,
            left: dropLineIndent,
            right: 4,
            height: 3,
            background: T.accent,
            borderRadius: 1,
            pointerEvents: "none",
            zIndex: 10,
          }} />
        )}
      </div>
    </div>
  );
}
