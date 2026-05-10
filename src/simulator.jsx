import { useState } from "react";
import { useThemeCSS } from "./theme.js";
import { pageCostTotal, pageAwardTotal } from "./storage.js";

// ── Simulation engine ─────────────────────────────────────────────────────────

function randBetween(min, max) {
  const lo = Math.min(min, max), hi = Math.max(min, max);
  return lo === hi ? lo : lo + Math.random() * (hi - lo);
}

function simulateOne(campaign, startingStats) {
  const { nodes, edges } = campaign.flowchart;
  const startNode = nodes.find(n => n.isStart);
  if (!startNode) return null;

  // Stats: cbills + user-defined stats
  const stats = { ...startingStats };
  const keywords = new Set();
  const path = [];
  let currentNodeId = startNode.id;
  let steps = 0;

  while (currentNodeId && steps < 60) {
    steps++;
    const node = nodes.find(n => n.id === currentNodeId);
    if (!node) break;
    const page = campaign.pages.find(p => p.id === node.pageId);
    path.push(page?.name || "?");

    // Apply page base costs/awards to cbills
    if (page) {
      const baseCost = pageCostTotal(page);
      const baseAward = pageAwardTotal(page);
      stats.cbills = (stats.cbills || 0) + baseAward - baseCost;
    }
    if (node.isEnd) break;

    const outEdges = edges.filter(e => e.from === currentNodeId);
    if (outEdges.length === 0) break;
    const nextEdge = outEdges[Math.floor(Math.random() * outEdges.length)];

    for (const ev of nextEdge.events || []) {
      if (ev.requiresKeyword && !keywords.has(ev.requiresKeyword)) continue;
      if (Math.random() * 100 > ev.probability) continue;
      stats.cbills = (stats.cbills || 0) + randBetween(ev.awardMin || 0, ev.awardMax || 0) - randBetween(ev.costMin || 0, ev.costMax || 0);
      if (ev.grantsKeyword) keywords.add(ev.grantsKeyword);
      // Apply stat deltas
      for (const delta of ev.statDeltas || []) {
        if (delta.statId === "cbills") continue; // handled above
        const def = (campaign.statDefs || []).find(d => d.id === delta.statId);
        if (!def) continue;
        if (def.type === "boolean") {
          stats[delta.statId] = delta.delta === 1 || delta.delta === "1";
        } else {
          stats[delta.statId] = (stats[delta.statId] || 0) + Number(delta.delta);
        }
      }
    }
    currentNodeId = nextEdge.to;
  }

  return {
    cbills: Math.round(stats.cbills || 0),
    stats: Object.fromEntries(
      (campaign.statDefs || []).map(d => [d.id, stats[d.id] ?? (d.type === "boolean" ? false : 0)])
    ),
    path,
    keywords: [...keywords],
  };
}

async function runSimulation(campaign, startingStats, runs, onProgress) {
  const startNode = campaign.flowchart.nodes.find(n => n.isStart);
  if (!startNode) return { error: "No start node marked. Go to Flowchart and click a node to mark it as Start." };

  const CHUNK = 50;
  const results = [];
  for (let i = 0; i < runs; i += CHUNK) {
    const end = Math.min(i + CHUNK, runs);
    for (let j = i; j < end; j++) {
      const r = simulateOne(campaign, { cbills: startingStats.cbills, ...startingStats });
      if (r) results.push(r);
    }
    onProgress(Math.round((end / runs) * 100));
    await new Promise(r => setTimeout(r, 0));
  }

  if (results.length === 0) return { error: "No results." };

  const finalCBills = results.map(r => r.cbills).sort((a, b) => a - b);
  const n = finalCBills.length;
  const mean = Math.round(finalCBills.reduce((s, v) => s + v, 0) / n);
  const min = finalCBills[0], max = finalCBills[n - 1];
  const range = max - min;
  const bucketSize = range === 0 ? 1 : Math.max(1, Math.ceil(range / 12));
  const buckets = Array.from({ length: 12 }, (_, i) => {
    const lo = min + i * bucketSize, hi = lo + bucketSize;
    return { lo, hi, count: finalCBills.filter(v => v >= lo && (i === 11 ? v <= hi : v < hi)).length };
  });

  // Per stat distributions
  const statResults = {};
  for (const def of campaign.statDefs || []) {
    const vals = results.map(r => r.stats[def.id] ?? (def.type === "boolean" ? false : 0));
    if (def.type === "boolean") {
      const trueCount = vals.filter(Boolean).length;
      statResults[def.id] = { trueCount, falseCount: n - trueCount, truePct: ((trueCount / n) * 100).toFixed(1) };
    } else {
      const sorted = [...vals].sort((a, b) => a - b);
      statResults[def.id] = {
        mean: (sorted.reduce((s, v) => s + v, 0) / n).toFixed(2),
        median: sorted[Math.floor(n / 2)],
        min: sorted[0],
        max: sorted[n - 1],
        p10: sorted[Math.floor(n * 0.1)],
        p90: sorted[Math.floor(n * 0.9)],
      };
    }
  }

  const pathCounts = {}, keywordCounts = {};
  results.forEach(r => { pathCounts[r.path.join(" → ")] = (pathCounts[r.path.join(" → ")] || 0) + 1; });
  results.forEach(r => r.keywords.forEach(kw => { keywordCounts[kw] = (keywordCounts[kw] || 0) + 1; }));

  return {
    mean, median: finalCBills[Math.floor(n / 2)],
    p10: finalCBills[Math.floor(n * 0.1)],
    p90: finalCBills[Math.floor(n * 0.9)],
    min, max, buckets, runs: n,
    statResults,
    topPaths: Object.entries(pathCounts).sort((a, b) => b[1] - a[1]).slice(0, 8),
    topKeywords: Object.entries(keywordCounts).sort((a, b) => b[1] - a[1]).slice(0, 12),
    allPaths: pathCounts,
    allKeywords: keywordCounts,
  };
}

function exportCSV(result, startingStats, statDefs) {
  const rows = [
    ["Metric", "Value"],
    ["Simulations", result.runs],
    ["Starting C-Bills", startingStats.cbills],
    ...(statDefs || []).map(d => [`Starting ${d.name}`, startingStats[d.id] ?? d.startValue]),
    [],
    ["C-Bills Mean", result.mean],
    ["C-Bills Median", result.median],
    ["C-Bills 10th %ile", result.p10],
    ["C-Bills 90th %ile", result.p90],
    ["C-Bills Worst", result.min],
    ["C-Bills Best", result.max],
  ];
  for (const def of statDefs || []) {
    const sr = result.statResults[def.id];
    if (!sr) continue;
    rows.push([]);
    rows.push([`${def.name} (${def.type})`]);
    if (def.type === "boolean") {
      rows.push([`${def.name} True`, sr.trueCount, `${sr.truePct}%`]);
      rows.push([`${def.name} False`, sr.falseCount]);
    } else {
      rows.push([`${def.name} Mean`, sr.mean]);
      rows.push([`${def.name} Median`, sr.median]);
      rows.push([`${def.name} Min`, sr.min]);
      rows.push([`${def.name} Max`, sr.max]);
    }
  }
  rows.push([], ["Path", "Count", "Frequency %"]);
  rows.push(...Object.entries(result.allPaths).sort((a, b) => b[1] - a[1]).map(([p, c]) => [p, c, `${((c / result.runs) * 100).toFixed(1)}%`]));
  rows.push([], ["Keyword", "Count", "Frequency %"]);
  rows.push(...Object.entries(result.allKeywords).sort((a, b) => b[1] - a[1]).map(([k, c]) => [k, c, `${((c / result.runs) * 100).toFixed(1)}%`]));

  const csv = rows.map(r => r.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "simulation.csv" });
  a.click(); URL.revokeObjectURL(a.href);
}

// ── UI components ─────────────────────────────────────────────────────────────

export function SimulatorView({ campaign, onUpdate }) {
  const { T, css } = useThemeCSS();
  const statDefs = campaign.statDefs || [];
  const startNode = campaign.flowchart.nodes.find(n => n.isStart);

  // Starting values for each user-defined stat
  const defaultStarting = () => {
    const s = { cbills: 10000000 };
    for (const d of statDefs) s[d.id] = d.type === "boolean" ? false : (Number(d.startValue) || 0);
    return s;
  };

  const [startingStats, setStartingStats] = useState(defaultStarting);
  const [runCount, setRunCount] = useState(100);
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showStatDefs, setShowStatDefs] = useState(false);

  const fmt = v => v === undefined || v === null ? "–" : `${v >= 0 ? "" : "−"}${Math.abs(Math.round(v)).toLocaleString()}`;

  const run = async () => {
    setRunning(true); setProgress(0);
    const r = await runSimulation(campaign, startingStats, runCount, setProgress);
    setResult(r); setRunning(false);
  };

  const statCard = (label, value, color) => (
    <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: "10px 14px", textAlign: "center" }}>
      <div style={{ fontSize: 9, color: T.textDim, letterSpacing: "0.08em", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: "bold", color: color || T.accentBright }}>{fmt(value)}</div>
    </div>
  );

  return (
    <div style={{ maxWidth: 900, padding: "0 4px" }}>
      <h2 style={{ margin: "0 0 4px", color: T.accentBright, fontSize: 16, letterSpacing: "0.1em" }}>CAMPAIGN SIMULATOR</h2>
      <p style={{ margin: "0 0 20px", fontSize: 12, color: T.textDim }}>Runs random campaigns through your flowchart and projects outcomes for C-Bills and all defined stats.</p>

      {!startNode && (
        <div style={{ background: `${T.warn}22`, border: `1px solid ${T.warn}`, borderRadius: T.radius, padding: 12, marginBottom: 16, fontSize: 12, color: T.warn }}>
          No start node set. Go to Flowchart, click a node, and check "Start node" in the side panel.
        </div>
      )}

      {/* Stat definitions manager */}
      <div style={{ ...css.section, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: showStatDefs ? 12 : 0 }}>
          <span style={{ fontSize: 11, color: T.accent, fontWeight: "bold", letterSpacing: "0.08em" }}>STAT DEFINITIONS</span>
          <div style={{ display: "flex", gap: 8 }}>
            {showStatDefs && (
              <button style={{ ...css.btn(), fontSize: 10, padding: "2px 8px" }}
                onClick={() => {
                  const newDef = { id: crypto.randomUUID(), name: "New Stat", type: "number", startValue: 0 };
                  onUpdate(data => ({ ...data, statDefs: [...(data.statDefs || []), newDef] }));
                }}>
                + Add stat
              </button>
            )}
            <button style={{ ...css.btn(), fontSize: 10, padding: "2px 8px" }} onClick={() => setShowStatDefs(v => !v)}>
              {showStatDefs ? "▲ Hide" : "▼ Manage stats"}
            </button>
          </div>
        </div>

        {showStatDefs && (
          <div>
            {statDefs.length === 0 && (
              <div style={{ fontSize: 11, color: T.textDim }}>No stats defined. Add stats like XP, Level, Reputation, or any custom tracker.</div>
            )}
            {statDefs.map((def, i) => (
              <div key={def.id} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                <input style={{ ...css.input, flex: 2, fontSize: 12 }} value={def.name}
                  onChange={e => onUpdate(data => ({ ...data, statDefs: data.statDefs.map(d => d.id === def.id ? { ...d, name: e.target.value } : d) }))} />
                <select style={{ ...css.input, flex: 1, fontSize: 11 }} value={def.type}
                  onChange={e => onUpdate(data => ({ ...data, statDefs: data.statDefs.map(d => d.id === def.id ? { ...d, type: e.target.value } : d) }))}>
                  <option value="number">Number</option>
                  <option value="boolean">Boolean</option>
                </select>
                {def.type === "number" && (
                  <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: T.textDim, flexShrink: 0 }}>
                    Start:
                    <input type="number" style={{ ...css.input, width: 60, fontSize: 11 }} value={def.startValue ?? 0}
                      onChange={e => onUpdate(data => ({ ...data, statDefs: data.statDefs.map(d => d.id === def.id ? { ...d, startValue: Number(e.target.value) } : d) }))} />
                  </label>
                )}
                <button style={{ ...css.btn("danger"), fontSize: 10, padding: "2px 6px", flexShrink: 0 }}
                  onClick={() => onUpdate(data => ({ ...data, statDefs: data.statDefs.filter(d => d.id !== def.id) }))}>✕</button>
              </div>
            ))}
          </div>
        )}

        {!showStatDefs && statDefs.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
            {statDefs.map(d => <span key={d.id} style={css.tag}>{d.name} ({d.type})</span>)}
          </div>
        )}
      </div>

      {/* Run controls */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap", alignItems: "flex-end" }}>
        <label style={{ fontSize: 10, color: T.textDim }}>
          STARTING C-BILLS
          <input type="number" style={{ ...css.input, display: "block", marginTop: 2 }} value={startingStats.cbills}
            onChange={e => setStartingStats(s => ({ ...s, cbills: Number(e.target.value) }))} />
        </label>
        {statDefs.filter(d => d.type === "number").map(def => (
          <label key={def.id} style={{ fontSize: 10, color: T.textDim }}>
            STARTING {def.name.toUpperCase()}
            <input type="number" style={{ ...css.input, display: "block", marginTop: 2, width: 100 }}
              value={startingStats[def.id] ?? def.startValue ?? 0}
              onChange={e => setStartingStats(s => ({ ...s, [def.id]: Number(e.target.value) }))} />
          </label>
        ))}
        {statDefs.filter(d => d.type === "boolean").map(def => (
          <label key={def.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, cursor: "pointer" }}>
            <input type="checkbox" checked={startingStats[def.id] ?? false}
              onChange={e => setStartingStats(s => ({ ...s, [def.id]: e.target.checked }))} />
            START WITH {def.name.toUpperCase()}
          </label>
        ))}
        <label style={{ fontSize: 10, color: T.textDim }}>
          SIMULATIONS
          <select style={{ ...css.input, display: "block", marginTop: 2 }} value={runCount} onChange={e => setRunCount(Number(e.target.value))}>
            {[10, 50, 100, 500, 1000].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <button style={{ ...css.btn("primary"), padding: "8px 20px", fontSize: 13, opacity: !startNode || running ? 0.5 : 1 }}
          disabled={!startNode || running} onClick={run}>
          {running ? `Running… ${progress}%` : `▶ Run ${runCount} Simulations`}
        </button>
        {result && !result.error && (
          <button style={{ ...css.btn(), padding: "8px 14px", fontSize: 12 }}
            onClick={() => exportCSV(result, startingStats, statDefs)}>↓ CSV</button>
        )}
      </div>

      {running && (
        <div style={{ height: 4, borderRadius: 2, background: T.surface2, marginBottom: 16, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${progress}%`, background: T.accent, transition: "width 0.1s", borderRadius: 2 }} />
        </div>
      )}

      {result?.error && (
        <div style={{ color: T.danger, fontSize: 13, padding: 12, background: `${T.danger}22`, borderRadius: T.radius }}>{result.error}</div>
      )}

      {result && !result.error && (
        <div>
          {/* C-Bills results */}
          <div style={{ fontSize: 11, color: T.accent, fontWeight: "bold", letterSpacing: "0.08em", marginBottom: 10 }}>C-BILLS OUTCOME</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 8, marginBottom: 16 }}>
            {statCard("MEAN", result.mean)}
            {statCard("MEDIAN", result.median)}
            {statCard("10th %ile", result.p10, result.p10 < 0 ? T.danger : T.textDim)}
            {statCard("90th %ile", result.p90, T.accent)}
            {statCard("WORST", result.min, result.min < 0 ? T.danger : T.textDim)}
            {statCard("BEST", result.max, T.accent)}
          </div>

          {/* Distribution */}
          <div style={{ ...css.section, marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: T.accent, fontWeight: "bold", letterSpacing: "0.08em", marginBottom: 12 }}>C-BILLS DISTRIBUTION</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 80 }}>
              {result.buckets.map(b => {
                const maxCount = Math.max(...result.buckets.map(x => x.count));
                const h = maxCount === 0 ? 0 : Math.max(4, (b.count / maxCount) * 76);
                const pct = ((b.count / result.runs) * 100).toFixed(1);
                return <div key={b.lo} title={`${b.lo.toLocaleString()}–${b.hi.toLocaleString()}: ${b.count} (${pct}%)`}
                  style={{ flex: 1, height: h, background: b.lo < 0 ? T.danger : T.accent, borderRadius: "2px 2px 0 0", opacity: 0.8 }} />;
              })}
            </div>
            <div style={{ display: "flex", gap: 3, marginTop: 4 }}>
              {result.buckets.map(b => (
                <div key={`l-${b.lo}`} style={{ flex: 1, fontSize: 8, color: T.textMuted, textAlign: "center" }}>
                  {((b.count / result.runs) * 100).toFixed(0)}%
                </div>
              ))}
            </div>
          </div>

          {/* Per-stat results */}
          {statDefs.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: T.accent, fontWeight: "bold", letterSpacing: "0.08em", marginBottom: 10 }}>STAT OUTCOMES</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
                {statDefs.map(def => {
                  const sr = result.statResults[def.id];
                  if (!sr) return null;
                  return (
                    <div key={def.id} style={{ ...css.section }}>
                      <div style={{ fontSize: 11, fontWeight: "bold", color: T.accentBright, marginBottom: 8 }}>{def.name}</div>
                      {def.type === "boolean" ? (
                        <div style={{ display: "flex", gap: 12 }}>
                          <div style={{ textAlign: "center" }}>
                            <div style={{ fontSize: 20, fontWeight: "bold", color: T.accent }}>{sr.truePct}%</div>
                            <div style={{ fontSize: 10, color: T.textDim }}>TRUE ({sr.trueCount})</div>
                          </div>
                          <div style={{ textAlign: "center" }}>
                            <div style={{ fontSize: 20, fontWeight: "bold", color: T.textDim }}>{(100 - parseFloat(sr.truePct)).toFixed(1)}%</div>
                            <div style={{ fontSize: 10, color: T.textDim }}>FALSE ({sr.falseCount})</div>
                          </div>
                          {/* Simple progress bar */}
                          <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
                            <div style={{ height: 10, width: "100%", background: T.surface2, borderRadius: 5, overflow: "hidden" }}>
                              <div style={{ height: "100%", width: `${sr.truePct}%`, background: T.accent, borderRadius: 5 }} />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                          {[["MEAN", sr.mean], ["MEDIAN", sr.median], ["MIN", sr.min], ["MAX", sr.max], ["10th %", sr.p10], ["90th %", sr.p90]].map(([l, v]) => (
                            <div key={l} style={{ textAlign: "center" }}>
                              <div style={{ fontSize: 14, fontWeight: "bold", color: T.accentBright }}>{Number(v).toFixed(1)}</div>
                              <div style={{ fontSize: 9, color: T.textDim }}>{l}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Paths and keywords */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
            <div style={css.section}>
              <div style={{ fontSize: 11, color: T.accent, fontWeight: "bold", letterSpacing: "0.08em", marginBottom: 10 }}>TOP PATHS</div>
              {result.topPaths.length === 0 && <div style={{ fontSize: 11, color: T.textMuted }}>No paths recorded.</div>}
              {result.topPaths.map(([path, count]) => (
                <div key={path} style={{ marginBottom: 6 }}>
                  <div style={{ fontSize: 11, color: T.text, marginBottom: 2 }}>{path}</div>
                  <div style={{ fontSize: 10, color: T.textDim }}>{count}× ({((count / result.runs) * 100).toFixed(1)}%)</div>
                </div>
              ))}
            </div>
            <div style={css.section}>
              <div style={{ fontSize: 11, color: T.accent, fontWeight: "bold", letterSpacing: "0.08em", marginBottom: 10 }}>KEYWORDS EARNED</div>
              {result.topKeywords.length === 0 && <div style={{ fontSize: 11, color: T.textMuted }}>No keywords earned.</div>}
              {result.topKeywords.map(([kw, count]) => (
                <div key={kw} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={css.tag}>{kw}</span>
                  <span style={{ fontSize: 11, color: T.textDim }}>{count}× ({((count / result.runs) * 100).toFixed(1)}%)</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
