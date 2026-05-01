import { useRef, useState } from "react";
import { useThemeCSS } from "./theme.js";
import { uid } from "./storage.js";

const NW = 180;
const NH = 72;

const NODE_PALETTE = [
  null,          // default (no override)
  "#c03030",     // red
  "#c07020",     // amber
  "#3a9a3a",     // green
  "#2090c0",     // blue
  "#7030a0",     // purple
  "#c06090",     // pink
  "#606060",     // grey
];

function emptyEvent() {
  return { id: uid(), description: "", probability: 100, requiresKeyword: "", grantsKeyword: "", costMin: 0, costMax: 0, awardMin: 0, awardMax: 0 };
}

function EdgeEventEditor({ events, onChange, T, css }) {
  const update = (id, field, value) => onChange(events.map((event) => event.id === id ? { ...event, [field]: value } : event));
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 11, color: T.accent, fontWeight: "bold", letterSpacing: "0.08em" }}>EDGE EVENTS</span>
        <button style={{ ...css.btn(), fontSize: 10, padding: "2px 8px" }} onClick={() => onChange([...events, emptyEvent()])}>+ Add Event</button>
      </div>
      <div style={{ fontSize: 10, color: T.textDim, marginBottom: 8 }}>Events fire when the party takes this path.</div>
      {events.map((event) => (
        <div key={event.id} style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: 10, marginBottom: 8 }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
            <input style={{ ...css.input, flex: 1, fontSize: 11 }} placeholder="Description" value={event.description} onChange={(e) => update(event.id, "description", e.target.value)} />
            <button style={{ ...css.btn("danger"), padding: "2px 6px", fontSize: 10 }} onClick={() => onChange(events.filter((x) => x.id !== event.id))}>x</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <label style={{ fontSize: 9, color: T.textDim }}>PROBABILITY %<input type="number" min="0" max="100" style={{ ...css.input, fontSize: 11 }} value={event.probability} onChange={(e) => update(event.id, "probability", Math.min(100, Math.max(0, Number(e.target.value))))} /></label>
            <label style={{ fontSize: 9, color: T.textDim }}>REQUIRES KEYWORD<input style={{ ...css.input, fontSize: 11 }} value={event.requiresKeyword} onChange={(e) => update(event.id, "requiresKeyword", e.target.value)} /></label>
            <label style={{ fontSize: 9, color: T.danger }}>COST MIN<input type="number" style={{ ...css.input, fontSize: 11 }} value={event.costMin} onChange={(e) => update(event.id, "costMin", Number(e.target.value))} /></label>
            <label style={{ fontSize: 9, color: T.danger }}>COST MAX<input type="number" style={{ ...css.input, fontSize: 11 }} value={event.costMax} onChange={(e) => update(event.id, "costMax", Number(e.target.value))} /></label>
            <label style={{ fontSize: 9, color: T.accent }}>AWARD MIN<input type="number" style={{ ...css.input, fontSize: 11 }} value={event.awardMin} onChange={(e) => update(event.id, "awardMin", Number(e.target.value))} /></label>
            <label style={{ fontSize: 9, color: T.accent }}>AWARD MAX<input type="number" style={{ ...css.input, fontSize: 11 }} value={event.awardMax} onChange={(e) => update(event.id, "awardMax", Number(e.target.value))} /></label>
          </div>
          <label style={{ display: "block", fontSize: 9, color: T.textDim, marginTop: 6 }}>GRANTS KEYWORD<input style={{ ...css.input, fontSize: 11 }} value={event.grantsKeyword} onChange={(e) => update(event.id, "grantsKeyword", e.target.value)} /></label>
        </div>
      ))}
    </div>
  );
}

function ColorPicker({ currentColor, onSelect, T }) {
  return (
    <g>
      {NODE_PALETTE.map((color, i) => {
        const x = 6 + i * 18;
        const y = NH - 12;
        const isSelected = color === currentColor;
        return (
          <g key={i} style={{ cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); onSelect(color); }}>
            <circle cx={x} cy={y} r={6} fill={color || T.surface} stroke={isSelected ? "#fff" : T.border} strokeWidth={isSelected ? 2 : 1} />
            {color === null && <text x={x} y={y + 4} textAnchor="middle" fontSize={8} fill={T.textDim} fontFamily="monospace">✕</text>}
          </g>
        );
      })}
    </g>
  );
}

export function FlowchartView({ campaign, onUpdate }) {
  const { T, css } = useThemeCSS();
  const svgRef = useRef(null);
  const [dragging, setDragging] = useState(null);
  const [connecting, setConnecting] = useState(null);
  const [selectedEdge, setSelectedEdge] = useState(null);
  const [colorPickerNode, setColorPickerNode] = useState(null);
  const { nodes, edges } = campaign.flowchart;
  const setFC = (fn) => onUpdate((campaignData) => ({ ...campaignData, flowchart: fn(campaignData.flowchart) }));

  const addNode = (pageId) => {
    if (nodes.some((node) => node.pageId === pageId)) return;
    setFC((fc) => ({ ...fc, nodes: [...fc.nodes, { id: uid(), pageId, x: 60 + (nodes.length % 4) * 210, y: 80 + Math.floor(nodes.length / 4) * 130, isStart: false, isEnd: false, color: null }] }));
  };
  const removeNode = (nodeId) => {
    setSelectedEdge(null);
    setColorPickerNode(null);
    setFC((fc) => ({ nodes: fc.nodes.filter((node) => node.id !== nodeId), edges: fc.edges.filter((edge) => edge.from !== nodeId && edge.to !== nodeId) }));
  };
  const toggleNodeProp = (nodeId, prop) => setFC((fc) => ({
    ...fc,
    nodes: fc.nodes.map((node) => {
      if (node.id !== nodeId) return prop === "isStart" ? { ...node, isStart: false } : node;
      return { ...node, [prop]: !node[prop] };
    }),
  }));
  const setNodeColor = (nodeId, color) => {
    setFC((fc) => ({ ...fc, nodes: fc.nodes.map((node) => node.id === nodeId ? { ...node, color } : node) }));
    setColorPickerNode(null);
  };
  const connectNodes = (from, to) => {
    if (from === to || edges.some((edge) => edge.from === from && edge.to === to)) return;
    setFC((fc) => ({ ...fc, edges: [...fc.edges, { from, to, label: "", events: [] }] }));
  };
  const updateEdge = (from, to, patch) => setFC((fc) => ({ ...fc, edges: fc.edges.map((edge) => edge.from === from && edge.to === to ? { ...edge, ...patch } : edge) }));
  const removeEdge = (from, to) => {
    setSelectedEdge(null);
    setFC((fc) => ({ ...fc, edges: fc.edges.filter((edge) => !(edge.from === from && edge.to === to)) }));
  };
  const getPath = (from, to) => {
    const a = nodes.find((node) => node.id === from);
    const b = nodes.find((node) => node.id === to);
    if (!a || !b) return "";
    const x1 = a.x + NW / 2, y1 = a.y + NH / 2, x2 = b.x + NW / 2, y2 = b.y + NH / 2;
    return `M ${x1} ${y1} Q ${(x1 + x2) / 2} ${(y1 + y2) / 2 - 20} ${x2} ${y2}`;
  };
  const getMid = (from, to) => {
    const a = nodes.find((node) => node.id === from);
    const b = nodes.find((node) => node.id === to);
    return a && b ? { x: (a.x + b.x + NW) / 2, y: (a.y + b.y + NH) / 2 } : { x: 0, y: 0 };
  };
  const onMove = (event) => {
    if (!dragging) return;
    setFC((fc) => ({ ...fc, nodes: fc.nodes.map((node) => node.id === dragging.nodeId ? { ...node, x: dragging.ox + event.clientX - dragging.sx, y: dragging.oy + event.clientY - dragging.sy } : node) }));
  };
  const unusedPages = campaign.pages.filter((page) => !nodes.some((node) => node.pageId === page.id));
  const selectedEdgeData = selectedEdge ? edges.find((edge) => edge.from === selectedEdge.from && edge.to === selectedEdge.to) : null;

  return (
    <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
          <h2 style={{ margin: 0, color: T.accentBright, fontSize: 16, letterSpacing: "0.1em" }}>FLOWCHART</h2>
          <span style={{ fontSize: 10, color: T.textDim }}>drag nodes, connect with dot, mark start/end, click dot on node to color</span>
        </div>
        {unusedPages.length > 0 && (
          <div style={{ marginBottom: 10, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 11, color: T.textDim }}>Add to chart:</span>
            {unusedPages.map((page) => <button key={page.id} style={{ ...css.btn(), fontSize: 11 }} onClick={() => addNode(page.id)}>+ {page.name}</button>)}
          </div>
        )}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radius, overflow: "hidden" }}>
          <svg ref={svgRef} width="100%" height={480} style={{ cursor: dragging ? "grabbing" : "default", display: "block" }}
            onMouseMove={onMove}
            onMouseUp={() => setDragging(null)}
            onMouseLeave={() => setDragging(null)}
            onClick={() => { setColorPickerNode(null); }}>
            <defs>
              <marker id="arr" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill={T.accent} /></marker>
              <marker id="arr-sel" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill={T.accentBright} /></marker>
              <pattern id="g" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke={T.border} strokeWidth="0.5" /></pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#g)" />
            {edges.map((edge) => {
              const mid = getMid(edge.from, edge.to);
              const isSelected = selectedEdge?.from === edge.from && selectedEdge?.to === edge.to;
              const hasEvents = (edge.events || []).length > 0;
              return (
                <g key={`${edge.from}-${edge.to}`} style={{ cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); setColorPickerNode(null); setSelectedEdge(isSelected ? null : { from: edge.from, to: edge.to }); }}>
                  <path d={getPath(edge.from, edge.to)} fill="none" stroke={isSelected ? T.accentBright : T.accent} strokeWidth={isSelected ? 2.5 : 1.5} markerEnd={isSelected ? "url(#arr-sel)" : "url(#arr)"} strokeDasharray={hasEvents ? "none" : "4 2"} />
                  <text x={mid.x} y={mid.y - 4} textAnchor="middle" fill={isSelected ? T.accentBright : T.textDim} fontSize={10} fontFamily={T.font}>{edge.label || (hasEvents ? `* ${(edge.events || []).length}` : ".")}</text>
                </g>
              );
            })}
            {nodes.map((node) => {
              const page = campaign.pages.find((item) => item.id === node.pageId);
              if (!page) return null;
              const isTarget = connecting && connecting !== node.id;
              const nodeColor = node.color || null;
              const nodeFill = node.isStart ? T.accentDim : node.isEnd ? `${T.danger}33` : nodeColor ? `${nodeColor}44` : T.surface2;
              const borderColor = node.isStart ? T.accentBright : node.isEnd ? T.danger : nodeColor || (isTarget ? T.accent : T.border);
              const showPicker = colorPickerNode === node.id;
              return (
                <g key={node.id} transform={`translate(${node.x},${node.y})`}
                  onMouseDown={(e) => { e.stopPropagation(); if (!showPicker) setDragging({ nodeId: node.id, sx: e.clientX, sy: e.clientY, ox: node.x, oy: node.y }); }}
                  style={{ cursor: "grab" }}>
                  <rect width={NW} height={NH} rx={T.radius} fill={nodeFill} stroke={borderColor} strokeWidth={node.isStart || node.isEnd || isTarget ? 2 : 1}
                    onClick={() => { if (isTarget) { connectNodes(connecting, node.id); setConnecting(null); } }} />
                  <text x={8} y={15} fill={page.type === "mission" ? T.accentBright : T.textDim} fontSize={9} fontFamily={T.font}>{node.isStart ? "> START" : node.isEnd ? "[] END" : page.type.toUpperCase()}</text>
                  <text x={8} y={33} fill={T.text} fontSize={12} fontFamily={T.font}>{page.name.length > 19 ? `${page.name.slice(0, 17)}...` : page.name}</text>
                  {/* color swatch — click to toggle picker */}
                  <circle cx={NW - 56} cy={10} r={5} fill={nodeColor || T.surface} stroke={T.border} strokeWidth={1} style={{ cursor: "pointer" }}
                    onClick={(e) => { e.stopPropagation(); setColorPickerNode(showPicker ? null : node.id); setSelectedEdge(null); }} />
                  <text x={NW - 20} y={18} fill={connecting === node.id ? T.accentBright : T.textDim} fontSize={12} style={{ cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); setConnecting(connecting === node.id ? null : node.id); }}>o</text>
                  <text x={NW - 20} y={36} fill={node.isStart ? T.accentBright : T.textMuted} fontSize={10} style={{ cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); toggleNodeProp(node.id, "isStart"); }}>&gt;</text>
                  <text x={NW - 20} y={54} fill={node.isEnd ? T.danger : T.textMuted} fontSize={10} style={{ cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); toggleNodeProp(node.id, "isEnd"); }}>[]</text>
                  <text x={NW - 42} y={54} fill={T.textMuted} fontSize={10} style={{ cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); removeNode(node.id); }}>x</text>
                  {showPicker && (
                    <g>
                      <rect x={0} y={NH + 4} width={NODE_PALETTE.length * 18 + 4} height={20} rx={3} fill={T.surface} stroke={T.border} />
                      <ColorPicker currentColor={nodeColor} onSelect={(c) => setNodeColor(node.id, c)} T={T} />
                    </g>
                  )}
                </g>
              );
            })}
            {connecting && <text x={10} y={472} fill={T.accent} fontSize={11} fontFamily={T.font}>Click target node to connect, or dot again to cancel</text>}
            {nodes.length === 0 && <text x="50%" y="50%" textAnchor="middle" fill={T.textMuted} fontSize={13} fontFamily={T.font}>Add pages using the buttons above</text>}
          </svg>
        </div>
      </div>
      {selectedEdgeData && (
        <div style={{ width: 300, flexShrink: 0, background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontSize: 12, color: T.accentBright, fontWeight: "bold" }}>EDGE</span>
            <button style={{ ...css.btn("danger"), padding: "2px 6px", fontSize: 10 }} onClick={() => removeEdge(selectedEdgeData.from, selectedEdgeData.to)}>Remove</button>
          </div>
          <input style={{ ...css.input, fontSize: 11, marginBottom: 12 }} placeholder="Condition / label" value={selectedEdgeData.label || ""} onChange={(e) => updateEdge(selectedEdgeData.from, selectedEdgeData.to, { label: e.target.value })} />
          <EdgeEventEditor events={selectedEdgeData.events || []} onChange={(events) => updateEdge(selectedEdgeData.from, selectedEdgeData.to, { events })} T={T} css={css} />
          <button style={{ ...css.btn(), fontSize: 10, width: "100%", marginTop: 12 }} onClick={() => setSelectedEdge(null)}>Close</button>
        </div>
      )}
    </div>
  );
}
