import { useCallback, useMemo } from "react";
import {
  ReactFlow, Background, Controls, MiniMap,
  Handle, Position, MarkerType,
  BaseEdge, EdgeLabelRenderer, getBezierPath,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useThemeCSS } from "./theme.js";
import { uid, pageCostTotal, pageAwardTotal } from "./storage.js";
import { useState } from "react";

// ── Edge type definitions ─────────────────────────────────────────────────────

const EDGE_TYPES_DEF = [
  { value: "default",  label: "—",        color: null,      dash: null,    desc: "Neutral path" },
  { value: "win",      label: "Win",       color: "#3a9a3a", dash: null,    desc: "Players succeed" },
  { value: "lose",     label: "Lose",      color: "#c03030", dash: null,    desc: "Players fail" },
  { value: "branch",   label: "Branch",    color: "#2090c0", dash: null,    desc: "Player choice" },
  { value: "optional", label: "Optional",  color: "#c07020", dash: "5,3",   desc: "Side mission" },
];

function edgeTypeDef(type) {
  return EDGE_TYPES_DEF.find(t => t.value === type) || EDGE_TYPES_DEF[0];
}

function edgeColor(fcEdge, T) {
  const etd = edgeTypeDef(fcEdge.edgeType);
  if (etd.color) return etd.color;
  // Auto-derive from events if default type
  const events = fcEdge.events || [];
  let totalCost = 0, totalAward = 0;
  events.forEach(ev => {
    totalCost += ((ev.costMin || 0) + (ev.costMax || 0)) / 2;
    totalAward += ((ev.awardMin || 0) + (ev.awardMax || 0)) / 2;
  });
  if (totalCost > 0 && totalAward === 0) return "#c03030";
  if (totalAward > 0 && totalCost === 0) return "#3a9a3a";
  return T.accent;
}

// ── Node color palette ────────────────────────────────────────────────────────

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

// ── Helpers ───────────────────────────────────────────────────────────────────

function emptyEvent() {
  return {
    id: uid(), description: "", probability: 100,
    requiresKeyword: "", grantsKeyword: "",
    costMin: 0, costMax: 0, awardMin: 0, awardMax: 0,
    statDeltas: [],
  };
}

// Given a selected node id, compute the set of connected node+edge ids (within 1 hop)
function getConnectedIds(selectedNodeId, fcNodes, fcEdges) {
  if (!selectedNodeId) return null;
  const connectedNodes = new Set([selectedNodeId]);
  const connectedEdges = new Set();
  fcEdges.forEach(e => {
    if (e.from === selectedNodeId || e.to === selectedNodeId) {
      connectedNodes.add(e.from);
      connectedNodes.add(e.to);
      connectedEdges.add(`${e.from}--${e.to}`);
    }
  });
  return { nodes: connectedNodes, edges: connectedEdges };
}

// ── Conversion helpers ────────────────────────────────────────────────────────

function toRFNodes(fcNodes, pages, T, selectedNodeId, selectedEdgeId) {
  const connected = selectedNodeId ? getConnectedIds(selectedNodeId, fcNodes, []) : null;
  // For edge selection: find adjacent nodes
  let edgeAdjacentNodes = null;
  if (selectedEdgeId) {
    const [from, to] = selectedEdgeId.split("--");
    edgeAdjacentNodes = new Set([from, to]);
  }

  return fcNodes.map(n => {
    const page = pages.find(p => p.id === n.pageId);
    const dimmed = (selectedNodeId && !getConnectedIds(selectedNodeId, fcNodes, [/* no edges needed for node set */])?.nodes.has(n.id))
      || (selectedEdgeId && edgeAdjacentNodes && !edgeAdjacentNodes.has(n.id));
    const pageCosts = pageCostTotal(page);
    const pageAwards = pageAwardTotal(page);
    return {
      id: n.id,
      type: "missionNode",
      position: { x: n.x, y: n.y },
      data: {
        pageId: n.pageId,
        pageName: page?.name ?? "?",
        pageType: page?.type ?? "mission",
        isStart: n.isStart,
        isEnd: n.isEnd,
        color: n.color,
        dimmed: !!(selectedNodeId || selectedEdgeId) && dimmed,
        pageCosts,
        pageAwards,
      },
    };
  });
}

function toRFEdges(fcEdges, T, selectedNodeId, selectedEdgeId) {
  return fcEdges.map(e => {
    const internalId = `${e.from}--${e.to}`;
    const color = edgeColor(e, T);
    const etd = edgeTypeDef(e.edgeType);
    const isAdjacentToSelectedNode = selectedNodeId && (e.from === selectedNodeId || e.to === selectedNodeId);
    const dimmed = !!(selectedNodeId || selectedEdgeId)
      && internalId !== selectedEdgeId
      && !isAdjacentToSelectedNode;
    return {
      id: internalId,
      source: e.from,
      target: e.to,
      type: "missionEdge",
      data: {
        label: e.label || "",
        events: e.events || [],
        edgeType: e.edgeType || "default",
        color,
        dash: etd.dash,
        dimmed,
      },
      markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color },
      style: { stroke: color, strokeWidth: 2, opacity: dimmed ? 0.2 : 1 },
    };
  });
}

function fromRFNodes(rfNodes, prevFcNodes) {
  return rfNodes.map(rn => {
    const prev = prevFcNodes.find(n => n.id === rn.id) || {};
    return {
      id: rn.id,
      pageId: rn.data.pageId,
      x: rn.position.x,
      y: rn.position.y,
      isStart: prev.isStart ?? false,
      isEnd: prev.isEnd ?? false,
      color: prev.color ?? null,
    };
  });
}

// ── Custom node ───────────────────────────────────────────────────────────────

function MissionNode({ data, selected }) {
  const { T } = useThemeCSS();
  const [hovered, setHovered] = useState(false);
  const accent = data.color || (data.isStart ? T.accentBright : data.isEnd ? T.danger : T.accent);
  const bg = data.color ? `${data.color}22` : data.isStart ? `${T.accentBright}22` : data.isEnd ? `${T.danger}22` : T.surface2;
  const isMission = data.pageType === "mission";

  const hasCosts = data.pageCosts > 0;
  const hasAwards = data.pageAwards > 0;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: bg,
        border: `2px solid ${selected ? T.accentBright : accent}`,
        borderRadius: isMission ? 8 : 4,
        minWidth: 160,
        padding: "8px 12px",
        fontFamily: T.font,
        boxShadow: selected ? `0 0 0 2px ${T.accentBright}44` : "none",
        opacity: data.dimmed ? 0.25 : 1,
        transition: "opacity 0.15s",
        position: "relative",
      }}>
      <Handle type="target" position={Position.Left} style={{ background: T.accent, border: `2px solid ${T.surface}`, width: 10, height: 10 }} />
      <Handle type="source" position={Position.Right} style={{ background: T.accentBright, border: `2px solid ${T.surface}`, width: 10, height: 10 }} />

      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
        {/* Page type icon */}
        <span style={{ fontSize: 10, color: accent, flexShrink: 0 }} title={isMission ? "Mission" : "Free page"}>
          {isMission ? "⬟" : "◻"}
        </span>
        {data.isStart && <span style={{ fontSize: 9, background: T.accentBright, color: T.surface, borderRadius: 3, padding: "1px 5px", fontWeight: "bold" }}>START</span>}
        {data.isEnd && <span style={{ fontSize: 9, background: T.danger, color: "#fff", borderRadius: 3, padding: "1px 5px", fontWeight: "bold" }}>END</span>}
        {!data.isStart && !data.isEnd && (
          <span style={{ fontSize: 9, color: T.textDim, textTransform: "uppercase" }}>{isMission ? "mission" : "note"}</span>
        )}
        {data.color && <span style={{ width: 7, height: 7, borderRadius: "50%", background: data.color, display: "inline-block", flexShrink: 0, marginLeft: "auto" }} />}
      </div>
      <div style={{ fontSize: 13, fontWeight: "bold", color: T.text, lineHeight: 1.3 }}>
        {data.pageName.length > 22 ? `${data.pageName.slice(0, 20)}…` : data.pageName}
      </div>

      {/* Cost/award summary row */}
      {(hasCosts || hasAwards) && (
        <div style={{ display: "flex", gap: 8, marginTop: 5 }}>
          {hasCosts && <span style={{ fontSize: 9, color: "#c03030" }}>-{data.pageCosts.toLocaleString()} C¢</span>}
          {hasAwards && <span style={{ fontSize: 9, color: "#3a9a3a" }}>+{data.pageAwards.toLocaleString()} C¢</span>}
        </div>
      )}

      {/* Hover tooltip */}
      {hovered && (hasCosts || hasAwards) && (
        <div style={{
          position: "absolute", bottom: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)",
          background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6,
          padding: "6px 10px", fontSize: 10, color: T.text, whiteSpace: "nowrap",
          zIndex: 9999, pointerEvents: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
        }}>
          {hasCosts && <div style={{ color: "#c03030" }}>Cost: {data.pageCosts.toLocaleString()} C-Bills</div>}
          {hasAwards && <div style={{ color: "#3a9a3a" }}>Award: {data.pageAwards.toLocaleString()} C-Bills</div>}
          {hasCosts && hasAwards && <div style={{ color: T.textDim, borderTop: `1px solid ${T.border}`, marginTop: 4, paddingTop: 4 }}>Net: {(data.pageAwards - data.pageCosts).toLocaleString()} C-Bills</div>}
        </div>
      )}
    </div>
  );
}

// ── Custom edge ───────────────────────────────────────────────────────────────

function MissionEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, selected, style, markerEnd }) {
  const { T } = useThemeCSS();
  const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });

  const color = data?.color || T.accent;
  const dimmed = data?.dimmed;
  const dash = data?.dash;
  const etd = edgeTypeDef(data?.edgeType);

  const hasEvents = (data?.events || []).length > 0;
  const conditionLabel = data?.label || "";
  const typeLabel = etd.value !== "default" ? etd.label : "";
  const eventBadge = hasEvents ? `${data.events.length}ev` : "";

  // Build display label: type prefix + condition
  const displayLabel = [typeLabel, conditionLabel].filter(Boolean).join(": ") || (eventBadge || "");

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: selected ? T.accentBright : color,
          strokeWidth: selected ? 2.5 : 2,
          strokeDasharray: dash || undefined,
          opacity: dimmed ? 0.15 : 1,
          transition: "opacity 0.15s",
        }}
      />
      {displayLabel && !dimmed && (
        <EdgeLabelRenderer>
          <div style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            background: T.surface,
            border: `1px solid ${selected ? T.accentBright : color}`,
            borderRadius: 4,
            padding: "2px 7px",
            fontSize: 10,
            color: selected ? T.accentBright : color,
            fontFamily: T.font,
            pointerEvents: "none",
            whiteSpace: "nowrap",
            fontWeight: etd.value !== "default" ? "bold" : "normal",
          }}>
            {displayLabel}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

const nodeTypes = { missionNode: MissionNode };
const edgeTypes = { missionEdge: MissionEdge };

// ── Side panels ───────────────────────────────────────────────────────────────

function NodePanel({ node, pages, onUpdate, onDelete, onNavigate, T, css }) {
  const page = pages.find(p => p.id === node.data.pageId);
  const isMission = page?.type === "mission";
  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: "bold", color: T.accentBright }}>
          {isMission ? "⬟" : "◻"} {node.data.pageName}
        </span>
        <button style={{ ...css.btn("danger"), fontSize: 10, padding: "2px 8px" }} onClick={onDelete}>Remove</button>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14 }}>
        <span style={{ fontSize: 11, color: T.textDim }}>{isMission ? "Mission page" : "Free page (note/lore)"}</span>
        <button style={{ ...css.btn(), fontSize: 10, padding: "2px 10px", marginLeft: "auto" }}
          onClick={() => onNavigate("editor", node.data.pageId)}>
          Open page →
        </button>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, cursor: "pointer" }}>
          <input type="checkbox" checked={node.data.isStart}
            onChange={e => onUpdate({ isStart: e.target.checked, isEnd: e.target.checked ? false : node.data.isEnd })} />
          <span style={{ color: T.accentBright }}>Start</span>
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, cursor: "pointer" }}>
          <input type="checkbox" checked={node.data.isEnd}
            onChange={e => onUpdate({ isEnd: e.target.checked, isStart: e.target.checked ? false : node.data.isStart })} />
          <span style={{ color: T.danger }}>End</span>
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
  const edgeType = edge.data?.edgeType || "default";

  const updateEvent = (id, patch) =>
    onUpdate({ events: events.map(ev => ev.id === id ? { ...ev, ...patch } : ev) });
  const addEvent = () => onUpdate({ events: [...events, emptyEvent()] });
  const removeEvent = id => onUpdate({ events: events.filter(ev => ev.id !== id) });

  const updateStatDelta = (evId, statId, delta) => {
    const ev = events.find(e => e.id === evId);
    if (!ev) return;
    const existing = (ev.statDeltas || []).filter(d => d.statId !== statId);
    const next = delta === "" ? existing : [...existing, { statId, delta: Number(delta) }];
    updateEvent(evId, { statDeltas: next });
  };

  const etd = edgeTypeDef(edgeType);
  const srcPage = edge._srcName || "";
  const tgtPage = edge._tgtName || "";

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: "bold", color: etd.color || T.accentBright }}>
          {srcPage && tgtPage ? `${srcPage} → ${tgtPage}` : "Edge"}
        </span>
        <button style={{ ...css.btn("danger"), fontSize: 10, padding: "2px 8px" }} onClick={onDelete}>Remove</button>
      </div>

      {/* Edge type */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: T.textDim, marginBottom: 4 }}>Path type</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {EDGE_TYPES_DEF.map(et => (
            <button key={et.value} title={et.desc}
              onClick={() => onUpdate({ edgeType: et.value })}
              style={{
                ...css.btn(), fontSize: 10, padding: "3px 10px",
                background: edgeType === et.value ? (et.color || T.accent) : T.surface2,
                color: edgeType === et.value ? "#fff" : T.text,
                border: `1px solid ${edgeType === et.value ? (et.color || T.accent) : T.border}`,
              }}>
              {et.label}
            </button>
          ))}
        </div>
        {etd.dash && <div style={{ fontSize: 9, color: T.textDim, marginTop: 4 }}>Shown as dashed line</div>}
      </div>

      {/* Condition label */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: T.textDim, marginBottom: 4 }}>Condition / label</div>
        <input style={{ ...css.input, width: "100%", boxSizing: "border-box" }}
          placeholder="e.g. If players rescued hostages…"
          value={edge.data?.label || ""}
          onChange={e => onUpdate({ label: e.target.value })}
        />
      </div>

      {/* Events */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: T.accent, fontWeight: "bold", letterSpacing: "0.08em" }}>EVENTS</span>
        <button style={{ ...css.btn(), fontSize: 10, padding: "2px 8px" }} onClick={addEvent}>+ Add</button>
      </div>
      <div style={{ fontSize: 10, color: T.textDim, marginBottom: 8 }}>Fire when the party takes this path.</div>

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
            <label style={{ fontSize: 9, color: "#c03030" }}>COST MIN
              <input type="number" style={{ ...css.input, fontSize: 11, display: "block", width: "100%", boxSizing: "border-box" }}
                value={ev.costMin} onChange={e => updateEvent(ev.id, { costMin: Number(e.target.value) })} />
            </label>
            <label style={{ fontSize: 9, color: "#c03030" }}>COST MAX
              <input type="number" style={{ ...css.input, fontSize: 11, display: "block", width: "100%", boxSizing: "border-box" }}
                value={ev.costMax} onChange={e => updateEvent(ev.id, { costMax: Number(e.target.value) })} />
            </label>
            <label style={{ fontSize: 9, color: "#3a9a3a" }}>AWARD MIN
              <input type="number" style={{ ...css.input, fontSize: 11, display: "block", width: "100%", boxSizing: "border-box" }}
                value={ev.awardMin} onChange={e => updateEvent(ev.id, { awardMin: Number(e.target.value) })} />
            </label>
            <label style={{ fontSize: 9, color: "#3a9a3a" }}>AWARD MAX
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
                        ? <select style={{ ...css.input, fontSize: 10, width: 90 }}
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

export function FlowchartView({ campaign, onUpdate, onNavigate }) {
  const { T, css } = useThemeCSS();
  const { nodes: fcNodes, edges: fcEdges } = campaign.flowchart;
  const statDefs = campaign.statDefs || [];
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState(null);

  const rfNodes = useMemo(
    () => toRFNodes(fcNodes, campaign.pages, T, selectedNodeId, selectedEdgeId),
    [fcNodes, campaign.pages, T, selectedNodeId, selectedEdgeId]
  );
  const rfEdges = useMemo(
    () => toRFEdges(fcEdges, T, selectedNodeId, selectedEdgeId),
    [fcEdges, T, selectedNodeId, selectedEdgeId]
  );

  const onConnect = useCallback((conn) => {
    if (fcEdges.some(e => e.from === conn.source && e.to === conn.target)) return;
    const newEdge = { from: conn.source, to: conn.target, label: "", edgeType: "default", events: [] };
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
      y: 80 + Math.floor(existing / 4) * 150,
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
    const PAD_X = 240, PAD_Y = 150, START_X = 60, START_Y = 60;
    const positions = {};
    layers.forEach((layer, li) => layer.forEach((id, ci) => { positions[id] = { x: START_X + li * PAD_X, y: START_Y + ci * PAD_Y }; }));
    onUpdate(data => ({ ...data, flowchart: { ...data.flowchart, nodes: data.flowchart.nodes.map(n => positions[n.id] ? { ...n, ...positions[n.id] } : n) } }));
  };

  // Separate unused missions from unused free pages for clearer toolbar
  const unusedPages = campaign.pages.filter(p => !fcNodes.some(n => n.pageId === p.id));
  const unusedMissions = unusedPages.filter(p => p.type === "mission");
  const unusedFree = unusedPages.filter(p => p.type !== "mission");

  const selectedNodeRF = selectedNodeId ? rfNodes.find(n => n.id === selectedNodeId) : null;
  const selectedEdgeFC = selectedEdgeId ? fcEdges.find(e => `${e.from}--${e.to}` === selectedEdgeId) : null;
  const selectedEdgeRF = selectedEdgeFC ? {
    id: selectedEdgeId,
    data: { label: selectedEdgeFC.label, events: selectedEdgeFC.events || [], edgeType: selectedEdgeFC.edgeType || "default" },
    _srcName: campaign.pages.find(p => p.id === fcNodes.find(n => n.id === selectedEdgeFC.from)?.pageId)?.name || "",
    _tgtName: campaign.pages.find(p => p.id === fcNodes.find(n => n.id === selectedEdgeFC.to)?.pageId)?.name || "",
  } : null;

  const panelOpen = !!(selectedNodeRF || selectedEdgeRF);

  return (
    <div style={{ display: "flex", height: "100%", gap: 0 }}>
      {/* Main flow area */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {/* Toolbar */}
        <div style={{ padding: "8px 12px", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", borderBottom: `1px solid ${T.border}`, background: T.surface, minHeight: 42 }}>
          <span style={{ fontSize: 13, fontWeight: "bold", color: T.accentBright, letterSpacing: "0.08em", marginRight: 4 }}>FLOWCHART</span>
          {fcNodes.length > 1 && (
            <button style={{ ...css.btn(), fontSize: 11, padding: "3px 10px" }} onClick={autoLayout}>⬡ Auto-layout</button>
          )}

          {unusedMissions.length > 0 && (
            <>
              <span style={{ fontSize: 10, color: T.textDim, marginLeft: 4 }}>Missions:</span>
              {unusedMissions.map(p => (
                <button key={p.id} style={{ ...css.btn(), fontSize: 11, padding: "3px 10px", borderLeft: `3px solid ${T.accent}` }} onClick={() => addNode(p.id)}>
                  ⬟ {p.name}
                </button>
              ))}
            </>
          )}

          {unusedFree.length > 0 && (
            <>
              <span style={{ fontSize: 10, color: T.textDim, marginLeft: unusedMissions.length ? 0 : 4 }}>Notes:</span>
              {unusedFree.map(p => (
                <button key={p.id} style={{ ...css.btn(), fontSize: 11, padding: "3px 10px", borderLeft: `3px solid ${T.textDim}` }} onClick={() => addNode(p.id)}>
                  ◻ {p.name}
                </button>
              ))}
            </>
          )}

          {unusedPages.length === 0 && fcNodes.length > 0 && (
            <span style={{ fontSize: 11, color: T.textDim }}>All pages on chart — drag right handle → left handle to connect.</span>
          )}
          {fcNodes.length === 0 && unusedPages.length === 0 && (
            <span style={{ fontSize: 11, color: T.textDim }}>No pages yet. Create pages in the Outline tab first.</span>
          )}
          {fcNodes.length === 0 && unusedPages.length > 0 && (
            <span style={{ fontSize: 11, color: T.textDim }}>Add pages above to get started.</span>
          )}
        </div>

        {/* React Flow canvas */}
        <div style={{ flex: 1, minHeight: 0 }}>
          <ReactFlow
            nodes={rfNodes}
            edges={rfEdges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={() => {}}
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
        <div style={{ width: 300, flexShrink: 0, background: T.surface, borderLeft: `1px solid ${T.border}`, overflowY: "auto" }}>
          <div style={{ display: "flex", justifyContent: "flex-end", padding: "8px 12px 0" }}>
            <button style={{ ...css.btn(), fontSize: 11, padding: "2px 8px" }} onClick={() => { setSelectedNodeId(null); setSelectedEdgeId(null); }}>✕</button>
          </div>
          {selectedNodeRF && (
            <NodePanel node={selectedNodeRF} pages={campaign.pages} onUpdate={updateSelectedNode} onDelete={deleteSelectedNode} onNavigate={onNavigate} T={T} css={css} />
          )}
          {selectedEdgeRF && (
            <EdgePanel edge={selectedEdgeRF} statDefs={statDefs} onUpdate={updateSelectedEdge} onDelete={deleteSelectedEdge} T={T} css={css} />
          )}
        </div>
      )}
    </div>
  );
}
