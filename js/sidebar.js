// ═══════════════════════════════════════════════════════════════════════════════
// SIDEBAR
// ═══════════════════════════════════════════════════════════════════════════════

function getSiblings(pages, parentId) {
  return pages.filter(p => (p.parentId ?? null) === (parentId ?? null)).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

function reorder(pages, siblings) {
  const ids = new Set(siblings.map(s => s.id));
  const updated = siblings.map((s, i) => ({ ...s, order: i }));
  return pages.map(p => ids.has(p.id) ? updated.find(u => u.id === p.id) : p);
}

function Sidebar({ campaign, selectedPageId, onSelect, onUpdate }) {
  const T = useTheme(); const css = makeCSS(T);
  const [name, setName] = useState("");
  const [type, setType] = useState(campaign.defaultPageType || "mission");
  const [pendingDelete, setPendingDelete] = useState(null);
  useEffect(() => { setType(campaign.defaultPageType || "mission"); }, [campaign.defaultPageType]);

  const add = () => {
    if (!name.trim()) return;
    const siblings = getSiblings(campaign.pages, null);
    const order = siblings.length;
    onUpdate(c => ({ ...c, pages: [...c.pages, { id: uid(), name: name.trim(), type, tags: [], content: "", sections: {}, costs: [], awards: [], parentId: null, order }] }));
    setName("");
  };

  const movePage = (pageId, dir) => {
    onUpdate(c => {
      const page = c.pages.find(p => p.id === pageId);
      if (!page) return c;
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
      const page = c.pages.find(p => p.id === pageId);
      if (!page) return c;
      const siblings = getSiblings(c.pages, page.parentId ?? null);
      const idx = siblings.findIndex(s => s.id === pageId);
      if (idx === 0) return c;
      const newParent = siblings[idx - 1];
      const newSiblings = getSiblings(c.pages, newParent.id);
      const updated = c.pages.map(p => p.id === pageId ? { ...p, parentId: newParent.id, order: newSiblings.length } : p);
      const oldSiblings = getSiblings(updated, page.parentId ?? null);
      return { ...c, pages: reorder(updated, oldSiblings) };
    });
  };

  const unindentPage = (pageId) => {
    onUpdate(c => {
      const page = c.pages.find(p => p.id === pageId);
      if (!page || (page.parentId ?? null) === null) return c;
      const parent = c.pages.find(p => p.id === page.parentId);
      const newParentId = parent ? (parent.parentId ?? null) : null;
      const newSiblings = getSiblings(c.pages, newParentId);
      const parentIdx = newSiblings.findIndex(s => s.id === (parent?.id));
      const insertAt = parentIdx + 1;
      const withRemoved = newSiblings.filter(s => s.id !== pageId);
      withRemoved.splice(insertAt, 0, { ...page, parentId: newParentId });
      let pages = c.pages.map(p => p.id === pageId ? { ...p, parentId: newParentId } : p);
      const oldSiblings = getSiblings(pages, page.parentId).filter(s => s.id !== pageId);
      pages = reorder(pages, oldSiblings);
      pages = reorder(pages, withRemoved);
      return { ...c, pages };
    });
  };

  const renderTree = (parentId, depth) => {
    const siblings = getSiblings(campaign.pages, parentId);
    return siblings.map((page, idx) => {
      const isSelected = selectedPageId === page.id;
      const isDeleting = pendingDelete === page.id;
      const children = getSiblings(campaign.pages, page.id);
      const hasParent = (page.parentId ?? null) !== null;
      return (
        <div key={page.id}>
          <div style={{ paddingLeft: 12 + depth * 16, paddingRight: 4, paddingTop: 6, paddingBottom: 6, cursor: "pointer", background: isSelected ? T.surface2 : "transparent", borderLeft: `3px solid ${isSelected ? T.accent : "transparent"}`, borderBottom: isDeleting ? "none" : `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 4 }}
            onClick={() => { setPendingDelete(null); onSelect(page.id); }}>
            <span style={{ fontSize: 10, color: page.type === "mission" ? T.accent : T.textDim, flexShrink: 0 }}>{page.type === "mission" ? "⬟" : "◻"}</span>
            <span style={{ flex: 1, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{page.name}</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 1, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
              <button style={{ ...css.btn(), padding: "0px 4px", fontSize: 8, lineHeight: 1.2, opacity: idx === 0 ? 0.2 : 0.7 }} disabled={idx === 0} onClick={() => movePage(page.id, -1)}>▲</button>
              <button style={{ ...css.btn(), padding: "0px 4px", fontSize: 8, lineHeight: 1.2, opacity: idx === siblings.length - 1 ? 0.2 : 0.7 }} disabled={idx === siblings.length - 1} onClick={() => movePage(page.id, 1)}>▼</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 1, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
              <button style={{ ...css.btn(), padding: "0px 4px", fontSize: 8, lineHeight: 1.2, opacity: idx === 0 ? 0.2 : 0.7 }} disabled={idx === 0} title="Indent" onClick={() => indentPage(page.id)}>→</button>
              <button style={{ ...css.btn(), padding: "0px 4px", fontSize: 8, lineHeight: 1.2, opacity: hasParent ? 0.7 : 0.2 }} disabled={!hasParent} title="Unindent" onClick={() => unindentPage(page.id)}>←</button>
            </div>
            <button style={{ ...css.btn("danger"), padding: "1px 5px", fontSize: 10, opacity: 0.6, flexShrink: 0 }}
              onClick={e => { e.stopPropagation(); setPendingDelete(isDeleting ? null : page.id); }}>×</button>
          </div>
          {isDeleting && (
            <div style={{ background: T.danger + "22", borderBottom: `1px solid ${T.border}`, paddingLeft: 12 + depth * 16, paddingRight: 8, paddingTop: 6, paddingBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 10, color: T.danger, flex: 1 }}>Delete{children.length > 0 ? " (and children)?" : "?"}</span>
              <button style={{ ...css.btn("danger"), padding: "2px 8px", fontSize: 10 }} onClick={() => {
                const toDelete = new Set();
                const collect = (id) => { toDelete.add(id); getSiblings(campaign.pages, id).forEach(c => collect(c.id)); };
                collect(page.id);
                onUpdate(c => ({ ...c, pages: c.pages.filter(p => !toDelete.has(p.id)) }));
                setPendingDelete(null);
              }}>Yes</button>
              <button style={{ ...css.btn(), padding: "2px 8px", fontSize: 10 }} onClick={() => setPendingDelete(null)}>No</button>
            </div>
          )}
          {children.length > 0 && renderTree(page.id, depth + 1)}
        </div>
      );
    });
  };

  return (
    <div style={css.sidebar}>
      <div style={{ padding: "10px 12px", borderBottom: `1px solid ${T.border}` }}>
        <div style={css.label}>Pages</div>
        <input style={{ ...css.input, fontSize: 11, marginBottom: 6 }} placeholder="Page name..." value={name}
          onChange={e => setName(e.target.value)} onKeyDown={e => e.key === "Enter" && add()} />
        <div style={{ display: "flex", gap: 4 }}>
          <select style={{ ...css.input, fontSize: 11, flex: 1 }} value={type} onChange={e => setType(e.target.value)}>
            <option value="mission">Mission</option>
            <option value="free">Free Page</option>
          </select>
          <button style={css.btn("primary")} onClick={add}>+</button>
        </div>
      </div>
      <div style={{ flex: 1, overflow: "auto" }}>
        {campaign.pages.length === 0 && <div style={{ padding: 12, color: T.textMuted, fontSize: 11 }}>No pages yet</div>}
        {renderTree(null, 0)}
      </div>
    </div>
  );
}
