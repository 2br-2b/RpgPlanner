// ═══════════════════════════════════════════════════════════════════════════════
// FLOWCHART
// ═══════════════════════════════════════════════════════════════════════════════
const NW = 180, NH = 72;

function emptyEvent() {
  return { id: uid(), description: "", probability: 100, requiresKeyword: "", grantsKeyword: "", costMin: 0, costMax: 0, awardMin: 0, awardMax: 0 };
}

function EdgeEventEditor({ events, onChange, T, css }) {
  const add = () => onChange([...events, emptyEvent()]);
  const upd = (id, field, val) => onChange(events.map(ev => ev.id === id ? { ...ev, [field]: val } : ev));
  const del = (id) => onChange(events.filter(ev => ev.id !== id));

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 11, color: T.accent, fontWeight: "bold", letterSpacing: "0.08em" }}>EDGE EVENTS</span>
        <button style={{ ...css.btn(), fontSize: 10, padding: "2px 8px" }} onClick={add}>+ Add Event</button>
      </div>
      <div style={{ fontSize: 10, color: T.textDim, marginBottom: 8 }}>
        Events fire when the party takes this path. Costs/awards use random values in the given range.
      </div>
      {events.map(ev => (
        <div key={ev.id} style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: 10, marginBottom: 8 }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
            <input style={{ ...css.input, flex: 1, fontSize: 11 }} placeholder="Description (e.g. 'Mech destroyed')" value={ev.description} onChange={e => upd(ev.id, "description", e.target.value)} />
            <button style={{ ...css.btn("danger"), padding: "2px 6px", fontSize: 10 }} onClick={() => del(ev.id)}>×</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 6 }}>
            <div>
              <div style={{ fontSize: 9, color: T.textDim, marginBottom: 2 }}>PROBABILITY %</div>
              <input type="number" min="0" max="100" style={{ ...css.input, fontSize: 11 }} value={ev.probability} onChange={e => upd(ev.id, "probability", Math.min(100, Math.max(0, Number(e.target.value))))} />
            </div>
            <div>
              <div style={{ fontSize: 9, color: T.textDim, marginBottom: 2 }}>REQUIRES KEYWORD</div>
              <input style={{ ...css.input, fontSize: 11 }} placeholder="e.g. veteran_salvagers" value={ev.requiresKeyword} onChange={e => upd(ev.id, "requiresKeyword", e.target.value)} />
            </div>
            <div>
              <div style={{ fontSize: 9, color: T.danger, marginBottom: 2 }}>COST MIN → MAX</div>
              <div style={{ display: "flex", gap: 4 }}>
                <input type="number" style={{ ...css.input, fontSize: 11 }} placeholder="0" value={ev.costMin} onChange={e => upd(ev.id, "costMin", Number(e.target.value))} />
                <input type="number" style={{ ...css.input, fontSize: 11 }} placeholder="0" value={ev.costMax} onChange={e => upd(ev.id, "costMax", Number(e.target.value))} />
              </div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: T.accent, marginBottom: 2 }}>AWARD MIN → MAX</div>
              <div style={{ display: "flex", gap: 4 }}>
                <input type="number" style={{ ...css.input, fontSize: 11 }} placeholder="0" value={ev.awardMin} onChange={e => upd(ev.id, "awardMin", Number(e.target.value))} />
                <input type="number" style={{ ...css.input, fontSize: 11 }} placeholder="0" value={ev.awardMax} onChange={e => upd(ev.id, "awardMax", Number(e.target.value))} />
              </div>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 9, color: T.textDim, marginBottom: 2 }}>GRANTS KEYWORD</div>
            <input style={{ ...css.input, fontSize: 11 }} placeholder="e.g. hero_of_steiner" value={ev.grantsKeyword} onChange={e => upd(ev.id, "grantsKeyword", e.target.value)} />
          </div>
        </div>
      ))}
      {events.length === 0 && <div style={{ fontSize: 10, color: T.textMuted, textAlign: "center", padding: "8px 0" }}>No events — add one above</div>}
    </div>
  );
}

function FlowchartView({ campaign, onUpdate }) {
  const T = useTheme(); const css = makeCSS(T);
  const svgRef = useRef(null);
  const [dragging, setDragging] = useState(null);
  const [connecting, setConnecting] = useState(null);
  const [selectedEdge, setSelectedEdge] = useState(null);
  const { nodes, edges } = campaign.flowchart;

  const setFC = (fn) => onUpdate(c => ({ ...c, flowchart: fn(c.flowchart) }));

  const addNode = (pageId) => {
    if (nodes.find(n => n.pageId === pageId)) return;
    setFC(fc => ({ ...fc, nodes: [...fc.nodes, { id: uid(), pageId, x: 60 + (nodes.length % 4) * 210, y: 80 + Math.floor(nodes.length / 4) * 130, isStart: false, isEnd: false }] }));
  };
  const removeNode = (nid) => { setSelectedEdge(null); setFC(fc => ({ nodes: fc.nodes.filter(n => n.id !== nid), edges: fc.edges.filter(e => e.from !== nid && e.to !== nid) })); };
  const toggleNodeProp = (nid, prop) => setFC(fc => ({
    ...fc,
    nodes: fc.nodes.map(n => {
      if (n.id !== nid) return prop === "isStart" ? { ...n, isStart: false } : n;
      return { ...n, [prop]: !n[prop] };
    }),
  }));
  const connectNodes = (a, b) => { if (a === b || edges.find(e => e.from === a && e.to === b)) return; setFC(fc => ({ ...fc, edges: [...fc.edges, { from: a, to: b, label: "", events: [] }] })); };
  const removeEdge = (f, t) => { setSelectedEdge(null); setFC(fc => ({ ...fc, edges: fc.edges.filter(e => !(e.from === f && e.to === t)) })); };
  const updateEdge = (f, t, patch) => setFC(fc => ({ ...fc, edges: fc.edges.map(e => e.from === f && e.to === t ? { ...e, ...patch } : e) }));

  const onMD = (e, nid) => { e.stopPropagation(); const n = nodes.find(x => x.id === nid); setDragging({ nid, sx: e.clientX, sy: e.clientY, ox: n.x, oy: n.y }); };
  const onMM = (e) => { if (!dragging) return; setFC(fc => ({ ...fc, nodes: fc.nodes.map(n => n.id === dragging.nid ? { ...n, x: dragging.ox + e.clientX - dragging.sx, y: dragging.oy + e.clientY - dragging.sy } : n) })); };
  const onMU = () => setDragging(null);

  const getMid = (f, t) => { const n1 = nodes.find(n => n.id === f), n2 = nodes.find(n => n.id === t); if (!n1 || !n2) return { x: 0, y: 0 }; return { x: (n1.x + NW / 2 + n2.x + NW / 2) / 2, y: (n1.y + NH / 2 + n2.y + NH / 2) / 2 }; };
  const getPath = (f, t) => { const n1 = nodes.find(n => n.id === f), n2 = nodes.find(n => n.id === t); if (!n1 || !n2) return ""; const x1 = n1.x + NW / 2, y1 = n1.y + NH / 2, x2 = n2.x + NW / 2, y2 = n2.y + NH / 2; return `M ${x1} ${y1} Q ${(x1 + x2) / 2} ${(y1 + y2) / 2 - 20} ${x2} ${y2}`; };

  const unusedPages = campaign.pages.filter(p => !nodes.find(n => n.pageId === p.id));
  const selEdgeData = selectedEdge ? edges.find(e => e.from === selectedEdge.from && e.to === selectedEdge.to) : null;

  return (
    <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
          <h2 style={{ margin: 0, color: T.accentBright, fontSize: 16, letterSpacing: "0.1em" }}>FLOWCHART</h2>
          <span style={{ fontSize: 10, color: T.textDim }}>drag · ◈ connect · ▶/■ mark start/end · click edge to edit</span>
        </div>
        {unusedPages.length > 0 && (
          <div style={{ marginBottom: 10, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 11, color: T.textDim }}>Add to chart:</span>
            {unusedPages.map(p => <button key={p.id} style={{ ...css.btn(), fontSize: 11 }} onClick={() => addNode(p.id)}>+ {p.name}</button>)}
          </div>
        )}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radius, overflow: "hidden" }}>
          <svg ref={svgRef} width="100%" height={480} style={{ cursor: dragging ? "grabbing" : "default", display: "block" }}
            onMouseMove={onMM} onMouseUp={onMU} onMouseLeave={onMU}>
            <defs>
              <marker id="arr" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
                <path d="M0,0 L0,6 L8,3 z" fill={T.accent} />
              </marker>
              <marker id="arr-sel" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
                <path d="M0,0 L0,6 L8,3 z" fill={T.accentBright} />
              </marker>
            </defs>
            <pattern id="g" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke={T.border} strokeWidth="0.5" />
            </pattern>
            <rect width="100%" height="100%" fill="url(#g)" />

            {edges.map(edge => {
              const m = getMid(edge.from, edge.to);
              const isSel = selectedEdge?.from === edge.from && selectedEdge?.to === edge.to;
              const hasEvents = (edge.events || []).length > 0;
              return (
                <g key={`${edge.from}-${edge.to}`} style={{ cursor: "pointer" }}
                  onClick={() => setSelectedEdge(isSel ? null : { from: edge.from, to: edge.to })}>
                  <path d={getPath(edge.from, edge.to)} fill="none" stroke={isSel ? T.accentBright : T.accent}
                    strokeWidth={isSel ? 2.5 : 1.5} markerEnd={isSel ? "url(#arr-sel)" : "url(#arr)"}
                    strokeDasharray={hasEvents ? "none" : "4 2"} />
                  <text x={m.x} y={m.y - 4} textAnchor="middle" fill={isSel ? T.accentBright : T.textDim} fontSize={10} fontFamily={T.font}>
                    {edge.label || (hasEvents ? `★ ${(edge.events||[]).length}` : "·")}
                  </text>
                </g>
              );
            })}

            {nodes.map(node => {
              const page = campaign.pages.find(p => p.id === node.pageId); if (!page) return null;
              const isCon = connecting === node.id, isTgt = connecting && connecting !== node.id;
              const projCost = (page.costs || []).reduce((s, c) => s + (Number(c.amount) || 0), 0);
              const projAward = (page.awards || []).reduce((s, a) => s + (Number(a.amount) || 0), 0);
              const borderColor = node.isStart ? T.accentBright : node.isEnd ? T.danger : isCon ? T.accentBright : isTgt ? T.accent : T.border;
              const fillColor = node.isStart ? T.accentDim : node.isEnd ? T.danger + "33" : isCon ? T.accentDim : T.surface2;
              return (
                <g key={node.id} transform={`translate(${node.x},${node.y})`} onMouseDown={e => onMD(e, node.id)} style={{ cursor: dragging?.nid === node.id ? "grabbing" : "grab" }}>
                  <rect width={NW} height={NH} rx={T.radius} fill={fillColor} stroke={borderColor}
                    strokeWidth={node.isStart || node.isEnd || isCon || isTgt ? 2 : 1}
                    style={{ cursor: isTgt ? "crosshair" : "grab" }}
                    onClick={() => { if (connecting && connecting !== node.id) { connectNodes(connecting, node.id); setConnecting(null); } }} />
                  <text x={8} y={15} fill={page.type === "mission" ? T.accentBright : T.textDim} fontSize={9} fontFamily={T.font}>
                    {node.isStart ? "▶ START" : node.isEnd ? "■ END" : page.type === "mission" ? "⬟ MISSION" : "◻ PAGE"}
                  </text>
                  <text x={8} y={33} fill={T.text} fontSize={12} fontFamily={T.font}>{page.name.length > 19 ? page.name.slice(0, 17) + "…" : page.name}</text>
                  {(projCost > 0 || projAward > 0) && (
                    <text x={8} y={52} fill={T.textDim} fontSize={8} fontFamily={T.font}>
                      {projCost > 0 ? `▼${projCost.toLocaleString()}` : ""}{projCost > 0 && projAward > 0 ? " " : ""}{projAward > 0 ? `▲${projAward.toLocaleString()}` : ""}
                    </text>
                  )}
                  <text x={NW - 20} y={18} fill={isCon ? T.accentBright : T.textDim} fontSize={12} style={{ cursor: "pointer" }}
                    onClick={e => { e.stopPropagation(); setConnecting(connecting === node.id ? null : node.id); }}>◈</text>
                  <text x={NW - 20} y={36} fill={node.isStart ? T.accentBright : T.textMuted} fontSize={10} style={{ cursor: "pointer" }}
                    title="Mark as start"
                    onClick={e => { e.stopPropagation(); toggleNodeProp(node.id, "isStart"); }}>▶</text>
                  <text x={NW - 20} y={54} fill={node.isEnd ? T.danger : T.textMuted} fontSize={10} style={{ cursor: "pointer" }}
                    title="Mark as end"
                    onClick={e => { e.stopPropagation(); toggleNodeProp(node.id, "isEnd"); }}>■</text>
                  <text x={NW - 36} y={54} fill={T.textMuted} fontSize={10} style={{ cursor: "pointer" }}
                    onClick={e => { e.stopPropagation(); removeNode(node.id); }}>✕</text>
                </g>
              );
            })}

            {connecting && <text x={10} y={472} fill={T.accent} fontSize={11} fontFamily={T.font}>Click target node to connect · ◈ again to cancel</text>}
            {nodes.length === 0 && <text x="50%" y="50%" textAnchor="middle" fill={T.textMuted} fontSize={13} fontFamily={T.font}>Add pages using the buttons above</text>}
          </svg>
        </div>
      </div>

      {selEdgeData && (() => {
        const fromNode = nodes.find(n => n.id === selEdgeData.from);
        const toNode = nodes.find(n => n.id === selEdgeData.to);
        const fromPage = campaign.pages.find(p => p.id === fromNode?.pageId);
        const toPage = campaign.pages.find(p => p.id === toNode?.pageId);
        return (
          <div style={{ width: 300, flexShrink: 0, background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontSize: 12, color: T.accentBright, fontWeight: "bold" }}>EDGE</span>
              <button style={{ ...css.btn("danger"), padding: "2px 6px", fontSize: 10 }} onClick={() => removeEdge(selEdgeData.from, selEdgeData.to)}>Remove edge</button>
            </div>
            <div style={{ fontSize: 10, color: T.textDim, marginBottom: 8 }}>
              {fromPage?.name || "?"} → {toPage?.name || "?"}
            </div>
            <div style={{ fontSize: 10, color: T.textDim, marginBottom: 4 }}>CONDITION / LABEL</div>
            <input style={{ ...css.input, fontSize: 11, marginBottom: 12 }}
              placeholder="e.g. 'Win streak ≥ 3' or leave blank"
              value={selEdgeData.label || ""}
              onChange={e => updateEdge(selEdgeData.from, selEdgeData.to, { label: e.target.value })} />
            <EdgeEventEditor
              events={selEdgeData.events || []}
              onChange={evts => updateEdge(selEdgeData.from, selEdgeData.to, { events: evts })}
              T={T} css={css} />
            <button style={{ ...css.btn(), fontSize: 10, width: "100%", marginTop: 12 }} onClick={() => setSelectedEdge(null)}>Close ✕</button>
          </div>
        );
      })()}
    </div>
  );
}
