import { useCallback, useRef } from "react";
import {
  ReactFlow, Background, Controls, MiniMap,
  addEdge, useNodesState, useEdgesState,
  Handle, Position, MarkerType,
  BaseEdge, EdgeLabelRenderer, getStraightPath, getBezierPath,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useThemeCSS } from "./theme.js";
import { uid } from "./storage.js";
import { useState, useEffect } from "react";

// ── helpers ───────────────────────────────────────────────────────────────────

function emptyEvent() {
  return {
    id: uid(), description: "", probability: 100,
    requiresKeyword: "", grantsKeyword: "",
    costMin: 0, costMax: 0, awardMin: 0, awardMax: 0,
    statDeltas: [],
  };
}

const NODE_COLORS = [
  { label: "Default", value: null },
  { label: "Red",     value: "#c03030" },
  { label: "Amber",   value: "#c07020" },
  { label: "Green",   value: "#3a9a3a" },
  { label: "Blue",    value: "#2090c0" },
  { label: "Purple",  value: "#7030a0" },
  { label: "Pink",    value: "#c06090" },
  { label: "Grey",    value: "#606060" },
];

// Convert internal flowchart data → React Flow nodes/edges
function toRFNodes(fcNodes, pages, T) {
  return fcNodes.map(n => ({
    id: n.id,
    type: "missionNode",
    position: { x: n.x, y: n.y },
    data: {
      pageId: n.pageId,
      pageName: pages.find(p => p.id === n.pageId)?.name ?? "?",
      pageType: pages.find(p => p.id === n.pageId)?.type ?? "mission",
      isStart: n.isStart,
      isEnd: n.isEnd,
      color: n.color,
    },
  }));
}

function toRFEdges(fcEdges, T) {
  return fcEdges.map(e => ({
    id: `${e.from}-${e.to}`,
    source: e.from,
    target: e.to,
    type: "missionEdge",
    label: e.label || "",
    data: { label: e.label || "", events: e.events || [] },
    markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: T.accent },
    style: { stroke: T.accent, strokeWidth: 2 },
  }));
}

// Convert React Flow positions back to internal format
function fromRFNodes(rfNodes, prevFcNodes) {
  return rfNodes.map(rn => {
    const prev = prevFcNodes.find(n => n.id === rn.id) || {};
    return {
      id: rn.id,
      pageId: rn.data.pageId,
      x: rn.position.x,
      y: rn.position.y,
      isStart: rn.data.isStart ?? false,
      isEnd: rn.data.isEnd ?? false,
      color: rn.data.color ?? null,
    };
  });
}

function fromRFEdges(rfEdges) {
  return rfEdges.map(re => {
    const [from, ...rest] = re.id.split("-");
    return {
      from: re.source,
      to: re.target,
      label: re.data?.label ?? "",
      events: re.data?.events ?? [],
    };
  });
}

// ── Custom node ───────────────────────────────────────────────────────────────

function MissionNode({ data, selected }) {
  const { T } = useThemeCSS();
  const accent = data.color || (data.isStart ? T.accentBright : data.isEnd ? T.danger : T.accent);
  const bg = data.color ? `${data.color}22` : data.isStart ? `${T.accentBright}22` : data.isEnd ? `${T.danger}22` : T.surface2;

  return (
    <div style={{
      background: bg,
      border: `2px solid ${selected ? T.accentBright : accent}`,
      borderRadius: 8,
      minWidth: 160,
      padding: "8px 12px",
      fontFamily: T.font,
      boxShadow: selected ? `0 0 0 2px ${T.accentBright}44` : "none",
      position: "relative",
    }}>
      <Handle type="target" position={Position.Left} style={{ background: T.accent, border: `2px solid ${T.surface}`, width: 10, height: 10 }} />
      <Handle type="source" position={Position.Right} style={{ background: T.accentBright, border: `2px solid ${T.surface}`, width: 10, height: 10 }} />

      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        {data.isStart && <span style={{ fontSize: 9, background: T.accentBright, color: T.surface, borderRadius: 3, padding: "1px 5px", fontWeight: "bold" }}>START</span>}
        {data.isEnd && <span style={{ fontSize: 9, background: T.danger, color: "#fff", borderRadius: 3, padding: "1px 5px", fontWeight: "bold" }}>END</span>}
        {!data.isStart && !data.isEnd && <span style={{ fontSize: 9, color: T.textDim, textTransform: "uppercase" }}>{data.pageType}</span>}
        {data.color && <span style={{ width: 8, height: 8, borderRadius: "50%", background: data.color, display: "inline-block", flexShrink: 0 }} />}
      </div>
      <div style={{ fontSize: 13, fontWeight: "bold", color: T.text, lineHeight: 1.3 }}>
        {data.pageName.length > 22 ? `${data.pageName.slice(0, 20)}…` : data.pageName}
      </div>
    </div>
  );
}

// ── Custom edge ───────────────────────────────────────────────────────────────

function MissionEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, selected, style, markerEnd }) {
  const { T } = useThemeCSS();
  const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  const hasEvents = (data?.events || []).length > 0;
  const label = data?.label || (hasEvents ? `${data.events.length} event${data.events.length > 1 ? "s" : ""}` : "");

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={{ ...style, stroke: selected ? T.accentBright : T.accent, strokeWidth: selected ? 2.5 : 2 }} />
      {label && (
        <EdgeLabelRenderer>
          <div style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            background: T.surface,
            border: `1px solid ${T.border}`,
            borderRadius: 4,
            padding: "2px 6px",
            fontSize: 10,
            color: selected ? T.accentBright : T.textDim,
            fontFamily: T.font,
            pointerEvents: "none",
            whiteSpace: "nowrap",
          }}>
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

const nodeTypes = { missionNode: MissionNode };
const edgeTypes = { missionEdge: MissionEdge };

// ── Side panel ────────────────────────────────────────────────────────────────

function NodePanel({ node, pages, onUpdate, onDelete, T, css }) {
  const page = pages.find(p => p.id === node.data.pageId);
  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: "bold", color: T.accentBright }}>Node: {node.data.pageName}</span>
        <button style={{ ...css.btn("danger"), fontSize: 10, padding: "2px 8px" }} onClick={onDelete}>Remove</button>
      </div>
      <div style={{ fontSize: 11, color: T.textDim, marginBottom: 12 }}>
        {page?.type === "mission" ? "Mission page" : "Free page"}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, cursor: "pointer" }}>
          <input type="checkbox" checked={node.data.isStart} onChange={e => onUpdate({ isStart: e.target.checked, isEnd: e.target.checked ? false : node.data.isEnd })} />
          <span style={{ color: T.accentBright }}>Start node</span>
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, cursor: "pointer" }}>
          <input type="checkbox" checked={node.data.isEnd} onChange={e => onUpdate({ isEnd: e.target.checked, isStart: e.target.checked ? false : node.data.isStart })} />
          <span style={{ color: T.danger }}>End node</span>
        </label>
      </div>

      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 11, color: T.textDim, marginBottom: 6 }}>Color</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {NODE_COLORS.map(c => (
            <div key={c.value ?? "null"} title={c.label}
              onClick={() => onUpdate({ color: c.value })}
              style={{
                width: 20, height: 20, borderRadius: "50%",
                background: c.value || T.surface2,
                border: `2px solid ${node.data.color === c.value ? T.accentBright : T.border}`,
                cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
              {c.value === null && <span style={{ fontSize: 8, color: T.textDim }}>✕</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function EdgePanel({ edge, statDefs, onUpdate, onDelete, T, css }) {
  const events = edge.data?.events || [];
  const updateEvent = (id, patch) => {
    onUpdate({ events: events.map(ev => ev.id === id ? { ...ev, ...patch } : ev) });
  };
  const addEvent = () => onUpdate({ events: [...events, emptyEvent()] });
  const removeEvent = id => onUpdate({ events: events.filter(ev => ev.id !== id) });

  const updateStatDelta = (evId, statId, delta) => {
    const ev = events.find(e => e.id === evId);
    if (!ev) return;
    const existing = (ev.statDeltas || []).filter(d => d.statId !== statId);
    const next = delta === "" ? existing : [...existing, { statId, delta: Number(delta) }];
    updateEvent(evId, { statDeltas: next });
  };

  const srcPage = edge._srcName || "";
  const tgtPage = edge._tgtName || "";

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: "bold", color: T.accentBright }}>
          {srcPage && tgtPage ? `${srcPage} → ${tgtPage}` : "Edge"}
        </span>
        <button style={{ ...css.btn("danger"), fontSize: 10, padding: "2px 8px" }} onClick={onDelete}>Remove</button>
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: T.textDim, marginBottom: 4 }}>Condition / label</div>
        <input style={{ ...css.input, width: "100%", boxSizing: "border-box" }}
          placeholder="e.g. If won, If player chose rescue…"
          value={edge.data?.label || ""}
          onChange={e => onUpdate({ label: e.target.value })}
        />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 11, color: T.accent, fontWeight: "bold", letterSpacing: "0.08em" }}>EVENTS</span>
        <button style={{ ...css.btn(), fontSize: 10, padding: "2px 8px" }} onClick={addEvent}>+ Add</button>
      </div>
      <div style={{ fontSize: 10, color: T.textDim, marginBottom: 8 }}>Events fire when the party takes this path.</div>

      {events.map(ev => (
        <div key={ev.id} style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 6, padding: 10, marginBottom: 8 }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            <input style={{ ...css.input, flex: 1, fontSize: 11 }} placeholder="Description"
              value={ev.description} onChange={e => updateEvent(ev.id, { description: e.target.value })} />
            <button style={{ ...css.btn("danger"), padding: "2px 6px", fontSize: 10 }} onClick={() => removeEvent(ev.id)}>✕</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 6 }}>
            <label style={{ fontSize: 9, color: T.textDim }}>PROBABILITY %
              <input type="number" min="0" max="100" style={{ ...css.input, fontSize: 11, display: "block", width: "100%", boxSizing: "border-box" }}
                value={ev.probability} onChange={e => updateEvent(ev.id, { probability: Math.min(100, Math.max(0, Number(e.target.value))) })} />
            </label>
            <label style={{ fontSize: 9, color: T.textDim }}>REQUIRES KEYWORD
              <input style={{ ...css.input, fontSize: 11, display: "block", width: "100%", boxSizing: "border-box" }}
                value={ev.requiresKeyword} onChange={e => updateEvent(ev.id, { requiresKeyword: e.target.value })} />
            </label>
            <label style={{ fontSize: 9, color: T.danger }}>COST MIN
              <input type="number" style={{ ...css.input, fontSize: 11, display: "block", width: "100%", boxSizing: "border-box" }}
                value={ev.costMin} onChange={e => updateEvent(ev.id, { costMin: Number(e.target.value) })} />
            </label>
            <label style={{ fontSize: 9, color: T.danger }}>COST MAX
              <input type="number" style={{ ...css.input, fontSize: 11, display: "block", width: "100%", boxSizing: "border-box" }}
                value={ev.costMax} onChange={e => updateEvent(ev.id, { costMax: Number(e.target.value) })} />
            </label>
            <label style={{ fontSize: 9, color: T.accent }}>AWARD MIN
              <input type="number" style={{ ...css.input, fontSize: 11, display: "block", width: "100%", boxSizing: "border-box" }}
                value={ev.awardMin} onChange={e => updateEvent(ev.id, { awardMin: Number(e.target.value) })} />
            </label>
            <label style={{ fontSize: 9, color: T.accent }}>AWARD MAX
              <input type="number" style={{ ...css.input, fontSize: 11, display: "block", width: "100%", boxSizing: "border-box" }}
                value={ev.awardMax} onChange={e => updateEvent(ev.id, { awardMax: Number(e.target.value) })} />
            </label>
          </div>
          <label style={{ fontSize: 9, color: T.textDim, display: "block", marginBottom: 6 }}>GRANTS KEYWORD
            <input style={{ ...css.input, fontSize: 11, display: "block", width: "100%", boxSizing: "border-box" }}
              value={ev.grantsKeyword} onChange={e => updateEvent(ev.id, { grantsKeyword: e.target.value })} />
          </label>

          {statDefs.length > 0 && (
            <div style={{ marginTop: 6 }}>
              <div style={{ fontSize: 9, color: T.textDim, marginBottom: 4 }}>STAT CHANGES</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {statDefs.map(sd => {
                  const existing = (ev.statDeltas || []).find(d => d.statId === sd.id);
                  return (
                    <label key={sd.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10 }}>
                      <span style={{ flex: 1, color: T.textDim }}>{sd.name}</span>
                      {sd.type === "boolean"
                        ? <select style={{ ...css.input, fontSize: 10, width: 80 }}
                            value={existing ? String(existing.delta) : ""}
                            onChange={e => updateStatDelta(ev.id, sd.id, e.target.value === "" ? "" : e.target.value)}>
                            <option value="">no change</option>
                            <option value="1">set true</option>
                            <option value="0">set false</option>
                          </select>
                        : <input type="number" placeholder="±0" style={{ ...css.input, fontSize: 10, width: 60 }}
                            value={existing?.delta ?? ""}
                            onChange={e => updateStatDelta(ev.id, sd.id, e.target.value)} />
                      }
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

export function FlowchartView({ campaign, onUpdate }) {
  const { T, css } = useThemeCSS();
  const { nodes: fcNodes, edges: fcEdges } = campaign.flowchart;
  const statDefs = campaign.statDefs || [];
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState(null);

  const rfNodes = toRFNodes(fcNodes, campaign.pages, T);
  const rfEdges = toRFEdges(fcEdges, T);

  const saveFC = (newRFNodes, newRFEdges) => {
    onUpdate(data => ({
      ...data,
      flowchart: {
        nodes: fromRFNodes(newRFNodes, data.flowchart.nodes),
        edges: fromRFEdges(newRFEdges),
      },
    }));
  };

  const onNodesChange = useCallback((changes) => {
    // Apply position/selection changes directly
    const updated = changes.reduce((acc, change) => {
      if (change.type === "position" && change.position) {
        return acc.map(n => n.id === change.id ? { ...n, x: change.position.x, y: change.position.y } : n);
      }
      if (change.type === "remove") {
        setSelectedNodeId(null);
        return acc.filter(n => n.id !== change.id);
      }
      return acc;
    }, fcNodes);

    const removedIds = changes.filter(c => c.type === "remove").map(c => c.id);
    const newEdges = removedIds.length
      ? fcEdges.filter(e => !removedIds.includes(e.from) && !removedIds.includes(e.to))
      : fcEdges;

    if (updated !== fcNodes || newEdges !== fcEdges) {
      onUpdate(data => ({ ...data, flowchart: { nodes: updated, edges: newEdges } }));
    }
  }, [fcNodes, fcEdges, onUpdate]);

  const onEdgesChange = useCallback((changes) => {
    const updated = changes.reduce((acc, change) => {
      if (change.type === "remove") {
        setSelectedEdgeId(null);
        return acc.filter(e => `${e.from}-${e.to}` !== change.id);
      }
      return acc;
    }, fcEdges);
    if (updated !== fcEdges) onUpdate(data => ({ ...data, flowchart: { ...data.flowchart, edges: updated } }));
  }, [fcEdges, onUpdate]);

  const onConnect = useCallback((conn) => {
    if (fcEdges.some(e => e.from === conn.source && e.to === conn.target)) return;
    const newEdge = { from: conn.source, to: conn.target, label: "", events: [] };
    onUpdate(data => ({ ...data, flowchart: { ...data.flowchart, edges: [...data.flowchart.edges, newEdge] } }));
  }, [fcEdges, onUpdate]);

  const onNodeDragStop = useCallback((_, node) => {
    onUpdate(data => ({
      ...data,
      flowchart: {
        ...data.flowchart,
        nodes: data.flowchart.nodes.map(n => n.id === node.id ? { ...n, x: node.position.x, y: node.position.y } : n),
      },
    }));
  }, [onUpdate]);

  const addNode = (pageId) => {
    const existing = fcNodes.length;
    const newNode = {
      id: uid(), pageId,
      x: 60 + (existing % 4) * 220,
      y: 80 + Math.floor(existing / 4) * 140,
      isStart: false, isEnd: false, color: null,
    };
    onUpdate(data => ({ ...data, flowchart: { ...data.flowchart, nodes: [...data.flowchart.nodes, newNode] } }));
  };

  const updateSelectedNode = (patch) => {
    onUpdate(data => ({
      ...data,
      flowchart: {
        ...data.flowchart,
        nodes: data.flowchart.nodes.map(n => {
          if (n.id !== selectedNodeId) {
            // Clear isStart from others if setting this node as start
            if (patch.isStart) return { ...n, isStart: false };
            return n;
          }
          return { ...n, ...patch };
        }),
      },
    }));
  };

  const deleteSelectedNode = () => {
    if (!selectedNodeId) return;
    onUpdate(data => ({
      ...data,
      flowchart: {
        nodes: data.flowchart.nodes.filter(n => n.id !== selectedNodeId),
        edges: data.flowchart.edges.filter(e => e.from !== selectedNodeId && e.to !== selectedNodeId),
      },
    }));
    setSelectedNodeId(null);
  };

  const updateSelectedEdge = (patch) => {
    if (!selectedEdgeId) return;
    const [from, to] = selectedEdgeId.split("--");
    onUpdate(data => ({
      ...data,
      flowchart: {
        ...data.flowchart,
        edges: data.flowchart.edges.map(e => {
          if (`${e.from}--${e.to}` !== selectedEdgeId) return e;
          return { ...e, ...patch };
        }),
      },
    }));
  };

  const deleteSelectedEdge = () => {
    if (!selectedEdgeId) return;
    onUpdate(data => ({
      ...data,
      flowchart: {
        ...data.flowchart,
        edges: data.flowchart.edges.filter(e => `${e.from}--${e.to}` !== selectedEdgeId),
      },
    }));
    setSelectedEdgeId(null);
  };

  const autoLayout = () => {
    if (fcNodes.length === 0) return;
    const indegree = {}, adj = {};
    fcNodes.forEach(n => { indegree[n.id] = 0; adj[n.id] = []; });
    fcEdges.forEach(e => { if (adj[e.from] && indegree[e.to] !== undefined) { adj[e.from].push(e.to); indegree[e.to]++; } });
    const layers = [];
    let queue = fcNodes.filter(n => indegree[n.id] === 0).map(n => n.id);
    const visited = new Set();
    while (queue.length > 0) {
      layers.push([...queue]);
      queue.forEach(id => visited.add(id));
      const next = [];
      queue.forEach(id => (adj[id] || []).forEach(to => { if (!visited.has(to)) { indegree[to]--; if (indegree[to] === 0) next.push(to); } }));
      queue = next;
    }
    const unreached = fcNodes.filter(n => !visited.has(n.id)).map(n => n.id);
    if (unreached.length) layers.push(unreached);

    const PAD_X = 240, PAD_Y = 140, START_X = 60, START_Y = 60;
    const positions = {};
    layers.forEach((layer, li) => layer.forEach((id, ci) => { positions[id] = { x: START_X + li * PAD_X, y: START_Y + ci * PAD_Y }; }));
    onUpdate(data => ({ ...data, flowchart: { ...data.flowchart, nodes: data.flowchart.nodes.map(n => positions[n.id] ? { ...n, ...positions[n.id] } : n) } }));
  };

  const unusedPages = campaign.pages.filter(p => !fcNodes.some(n => n.pageId === p.id));

  const selectedNode = selectedNodeId ? fcNodes.find(n => n.id === selectedNodeId) : null;
  const selectedNodeRF = selectedNodeId ? rfNodes.find(n => n.id === selectedNodeId) : null;

  // Build the edge object for the panel
  const selectedEdgeFC = selectedEdgeId
    ? fcEdges.find(e => `${e.from}--${e.to}` === selectedEdgeId)
    : null;
  const selectedEdgeRF = selectedEdgeFC
    ? {
        id: selectedEdgeId,
        data: { label: selectedEdgeFC.label, events: selectedEdgeFC.events || [] },
        _srcName: campaign.pages.find(p => p.id === fcNodes.find(n => n.id === selectedEdgeFC.from)?.pageId)?.name || "",
        _tgtName: campaign.pages.find(p => p.id === fcNodes.find(n => n.id === selectedEdgeFC.to)?.pageId)?.name || "",
      }
    : null;

  // Map RF node ids to styled RF nodes (with selection state)
  const styledRFNodes = rfNodes.map(n => ({ ...n, selected: n.id === selectedNodeId }));
  const styledRFEdges = rfEdges.map(e => {
    // Re-map edge id to use -- separator for our internal tracking
    const internalId = `${e.source}--${e.target}`;
    return { ...e, id: internalId, selected: internalId === selectedEdgeId };
  });

  const panelOpen = !!(selectedNodeRF || selectedEdgeRF);

  return (
    <div style={{ display: "flex", height: "100%", gap: 0 }}>
      {/* Main flow area */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {/* Toolbar */}
        <div style={{ padding: "8px 12px", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", borderBottom: `1px solid ${T.border}`, background: T.surface }}>
          <span style={{ fontSize: 13, fontWeight: "bold", color: T.accentBright, letterSpacing: "0.08em", marginRight: 4 }}>FLOWCHART</span>
          {fcNodes.length > 1 && (
            <button style={{ ...css.btn(), fontSize: 11, padding: "3px 10px" }} onClick={autoLayout}>⬡ Auto-layout</button>
          )}
          {unusedPages.length > 0 && (
            <>
              <span style={{ fontSize: 11, color: T.textDim }}>Add:</span>
              {unusedPages.map(p => (
                <button key={p.id} style={{ ...css.btn(), fontSize: 11, padding: "3px 10px" }} onClick={() => addNode(p.id)}>
                  + {p.name}
                </button>
              ))}
            </>
          )}
          {unusedPages.length === 0 && fcNodes.length > 0 && (
            <span style={{ fontSize: 11, color: T.textDim }}>All pages are on the chart. Connect them by dragging from the right handle of a node to the left handle of another.</span>
          )}
          {fcNodes.length === 0 && (
            <span style={{ fontSize: 11, color: T.textDim }}>Add pages above to get started.</span>
          )}
        </div>

        {/* React Flow canvas */}
        <div style={{ flex: 1, minHeight: 0 }}>
          <ReactFlow
            nodes={styledRFNodes}
            edges={styledRFEdges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={() => {}} // we manage state externally
            onEdgesChange={() => {}}
            onConnect={onConnect}
            onNodeDragStop={onNodeDragStop}
            onNodeClick={(_, node) => {
              setSelectedNodeId(prev => prev === node.id ? null : node.id);
              setSelectedEdgeId(null);
            }}
            onEdgeClick={(_, edge) => {
              setSelectedEdgeId(prev => prev === edge.id ? null : edge.id);
              setSelectedNodeId(null);
            }}
            onPaneClick={() => { setSelectedNodeId(null); setSelectedEdgeId(null); }}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            deleteKeyCode={null}
            style={{ background: T.surface }}
            defaultEdgeOptions={{
              type: "missionEdge",
              markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: T.accent },
              style: { stroke: T.accent, strokeWidth: 2 },
            }}
          >
            <Background color={T.border} gap={32} />
            <Controls style={{ button: { background: T.surface2, border: `1px solid ${T.border}`, color: T.text } }} />
            <MiniMap nodeColor={n => n.data?.color || T.surface2} style={{ background: T.surface, border: `1px solid ${T.border}` }} />
          </ReactFlow>
        </div>
      </div>

      {/* Side panel */}
      {panelOpen && (
        <div style={{
          width: 300, flexShrink: 0,
          background: T.surface, borderLeft: `1px solid ${T.border}`,
          overflowY: "auto",
        }}>
          <div style={{ display: "flex", justifyContent: "flex-end", padding: "8px 12px 0" }}>
            <button style={{ ...css.btn(), fontSize: 11, padding: "2px 8px" }} onClick={() => { setSelectedNodeId(null); setSelectedEdgeId(null); }}>✕</button>
          </div>
          {selectedNodeRF && (
            <NodePanel
              node={selectedNodeRF}
              pages={campaign.pages}
              onUpdate={updateSelectedNode}
              onDelete={deleteSelectedNode}
              T={T} css={css}
            />
          )}
          {selectedEdgeRF && (
            <EdgePanel
              edge={selectedEdgeRF}
              statDefs={statDefs}
              onUpdate={updateSelectedEdge}
              onDelete={deleteSelectedEdge}
              T={T} css={css}
            />
          )}
        </div>
      )}
    </div>
  );
}
