import { useState } from "react";
import { useThemeCSS } from "./theme.js";

function randBetween(min, max) {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  return lo === hi ? lo : lo + Math.random() * (hi - lo);
}

function simulateOne(campaign, startingCBills) {
  const { nodes, edges } = campaign.flowchart;
  const startNode = nodes.find((node) => node.isStart);
  if (!startNode) return null;

  let cbills = startingCBills;
  const keywords = new Set();
  const path = [];
  let currentNodeId = startNode.id;
  let steps = 0;

  while (currentNodeId && steps < 60) {
    steps++;
    const node = nodes.find((item) => item.id === currentNodeId);
    if (!node) break;
    const page = campaign.pages.find((item) => item.id === node.pageId);
    path.push(page?.name || "?");

    if (page) {
      const baseCost = (page.costs || []).reduce((sum, cost) => sum + (Number(cost.amount) || 0), 0);
      const baseAward = (page.awards || []).reduce((sum, award) => sum + (Number(award.amount) || 0), 0);
      cbills += baseAward - baseCost;
    }
    if (node.isEnd) break;

    const outEdges = edges.filter((edge) => edge.from === currentNodeId);
    if (outEdges.length === 0) break;
    const nextEdge = outEdges[Math.floor(Math.random() * outEdges.length)];

    for (const event of nextEdge.events || []) {
      if (event.requiresKeyword && !keywords.has(event.requiresKeyword)) continue;
      if (Math.random() * 100 > event.probability) continue;
      cbills += randBetween(event.awardMin || 0, event.awardMax || 0) - randBetween(event.costMin || 0, event.costMax || 0);
      if (event.grantsKeyword) keywords.add(event.grantsKeyword);
    }
    currentNodeId = nextEdge.to;
  }
  return { cbills: Math.round(cbills), path, keywords: [...keywords] };
}

// Run simulations in async chunks so the main thread stays responsive.
async function runSimulation(campaign, startingCBills, runs, onProgress) {
  const { nodes } = campaign.flowchart;
  const startNode = nodes.find((node) => node.isStart);
  if (!startNode) return { error: "No start node marked. Click > on a node in the flowchart." };

  const CHUNK = 50;
  const results = [];
  for (let i = 0; i < runs; i += CHUNK) {
    const end = Math.min(i + CHUNK, runs);
    for (let j = i; j < end; j++) {
      const r = simulateOne(campaign, startingCBills);
      if (r) results.push(r);
    }
    onProgress(Math.round((end / runs) * 100));
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  const finalCBills = results.map((result) => result.cbills).sort((a, b) => a - b);
  const n = finalCBills.length;
  if (n === 0) return { error: "No results." };
  const mean = Math.round(finalCBills.reduce((sum, value) => sum + value, 0) / n);
  const min = finalCBills[0];
  const max = finalCBills[n - 1];
  const range = max - min;
  const bucketSize = range === 0 ? 1 : Math.max(1, Math.ceil(range / 12));
  const buckets = Array.from({ length: 12 }, (_, index) => {
    const lo = min + index * bucketSize;
    const hi = lo + bucketSize;
    return { lo, hi, count: finalCBills.filter((value) => value >= lo && (index === 11 ? value <= hi : value < hi)).length };
  });

  const pathCounts = {};
  results.forEach((result) => { pathCounts[result.path.join(" -> ")] = (pathCounts[result.path.join(" -> ")] || 0) + 1; });
  const keywordCounts = {};
  results.forEach((result) => result.keywords.forEach((keyword) => { keywordCounts[keyword] = (keywordCounts[keyword] || 0) + 1; }));

  return {
    mean,
    median: finalCBills[Math.floor(n / 2)],
    p10: finalCBills[Math.floor(n * 0.1)],
    p90: finalCBills[Math.floor(n * 0.9)],
    min,
    max,
    topPaths: Object.entries(pathCounts).sort((a, b) => b[1] - a[1]).slice(0, 8),
    topKeywords: Object.entries(keywordCounts).sort((a, b) => b[1] - a[1]).slice(0, 12),
    buckets,
    runs: n,
    allPaths: pathCounts,
    allKeywords: keywordCounts,
  };
}

function exportCSV(result, startCBills) {
  const rows = [
    ["Metric", "Value"],
    ["Starting C-Bills", startCBills],
    ["Simulations", result.runs],
    ["Mean", result.mean],
    ["Median", result.median],
    ["10th Percentile", result.p10],
    ["90th Percentile", result.p90],
    ["Worst", result.min],
    ["Best", result.max],
    [],
    ["Path", "Count", "Frequency %"],
    ...Object.entries(result.allPaths).sort((a, b) => b[1] - a[1]).map(([path, count]) => [path, count, ((count / result.runs) * 100).toFixed(1) + "%"]),
    [],
    ["Keyword", "Count", "Frequency %"],
    ...Object.entries(result.allKeywords).sort((a, b) => b[1] - a[1]).map(([kw, count]) => [kw, count, ((count / result.runs) * 100).toFixed(1) + "%"]),
  ];
  const csv = rows.map(r => r.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "simulation-results.csv"; a.click();
  URL.revokeObjectURL(url);
}

export function SimulatorView({ campaign }) {
  const { T, css } = useThemeCSS();
  const [startCBills, setStartCBills] = useState(10000000);
  const [runCount, setRunCount] = useState(100);
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const startNode = campaign.flowchart.nodes.find((node) => node.isStart);
  const endNode = campaign.flowchart.nodes.find((node) => node.isEnd);
  const fmt = (value) => value === undefined || value === null ? "-" : `${value >= 0 ? "" : "-"}${Math.abs(Math.round(value)).toLocaleString()}`;
  const statCard = (label, value, color) => (
    <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: "10px 14px", textAlign: "center" }}>
      <div style={{ fontSize: 9, color: T.textDim, letterSpacing: "0.08em", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: "bold", color: color || T.accentBright }}>{fmt(value)}</div>
    </div>
  );

  const run = async () => {
    setRunning(true);
    setProgress(0);
    const r = await runSimulation(campaign, startCBills, runCount, setProgress);
    setResult(r);
    setRunning(false);
  };

  return (
    <div style={{ maxWidth: 820 }}>
      <h2 style={{ margin: "0 0 4px", color: T.accentBright, fontSize: 16, letterSpacing: "0.1em" }}>CAMPAIGN SIMULATOR</h2>
      <p style={{ margin: "0 0 20px", fontSize: 12, color: T.textDim }}>Runs random campaigns through your flowchart and projects financial outcomes.</p>
      {!startNode && <div style={{ background: `${T.warn}22`, border: `1px solid ${T.warn}`, borderRadius: T.radius, padding: 12, marginBottom: 16, fontSize: 12, color: T.warn }}>No start node set. Go to Flowchart and click &gt; on the first mission node.</div>}
      {startNode && !endNode && <div style={{ background: `${T.textDim}22`, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: 10, marginBottom: 16, fontSize: 11, color: T.textDim }}>Tip: mark end nodes so simulations know where to stop.</div>}

      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap", alignItems: "flex-end" }}>
        <label style={{ flex: "0 0 200px", fontSize: 10, color: T.textDim }}>STARTING C-BILLS<input type="number" style={css.input} value={startCBills} onChange={(e) => setStartCBills(Number(e.target.value))} /></label>
        <label style={{ flex: "0 0 120px", fontSize: 10, color: T.textDim }}>SIMULATIONS<select style={css.input} value={runCount} onChange={(e) => setRunCount(Number(e.target.value))}>{[10, 50, 100, 500, 1000].map((count) => <option key={count} value={count}>{count}</option>)}</select></label>
        <button style={{ ...css.btn("primary"), padding: "8px 20px", fontSize: 13, opacity: !startNode || running ? 0.5 : 1 }} disabled={!startNode || running} onClick={run}>{running ? `Running… ${progress}%` : `Run ${runCount} Simulations`}</button>
        {result && !result.error && (
          <button style={{ ...css.btn(), padding: "8px 14px", fontSize: 12 }} onClick={() => exportCSV(result, startCBills)}>↓ Export CSV</button>
        )}
      </div>

      {running && (
        <div style={{ height: 4, borderRadius: 2, background: T.surface2, marginBottom: 16, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${progress}%`, background: T.accent, transition: "width 0.1s", borderRadius: 2 }} />
        </div>
      )}

      {result?.error && <div style={{ color: T.danger, fontSize: 13, padding: 12, background: `${T.danger}22`, borderRadius: T.radius }}>{result.error}</div>}
      {result && !result.error && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 8, marginBottom: 20 }}>
            {statCard("MEAN", result.mean)}
            {statCard("MEDIAN", result.median)}
            {statCard("10th %ile", result.p10, result.p10 < 0 ? T.danger : T.textDim)}
            {statCard("90th %ile", result.p90, T.accent)}
            {statCard("WORST", result.min, result.min < 0 ? T.danger : T.textDim)}
            {statCard("BEST", result.max, T.accent)}
          </div>
          <div style={{ ...css.section, marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: T.accent, fontWeight: "bold", letterSpacing: "0.08em", marginBottom: 12 }}>DISTRIBUTION</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 80 }}>
              {result.buckets.map((bucket) => {
                const maxCount = Math.max(...result.buckets.map((item) => item.count));
                const height = maxCount === 0 ? 0 : Math.max(4, (bucket.count / maxCount) * 76);
                const pct = result.runs > 0 ? ((bucket.count / result.runs) * 100).toFixed(1) : "0";
                return <div key={`${bucket.lo}-${bucket.hi}`}
                  title={`${bucket.lo.toLocaleString()}–${bucket.hi.toLocaleString()}: ${bucket.count} runs (${pct}%)`}
                  style={{ flex: 1, height, background: bucket.lo < 0 ? T.danger : T.accent, borderRadius: "2px 2px 0 0", opacity: 0.8 }} />;
              })}
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 3, marginTop: 4 }}>
              {result.buckets.map((bucket) => {
                const pct = result.runs > 0 ? ((bucket.count / result.runs) * 100).toFixed(0) : "0";
                return <div key={`label-${bucket.lo}`} style={{ flex: 1, fontSize: 8, color: T.textMuted, textAlign: "center", lineHeight: 1 }}>{pct}%</div>;
              })}
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
            <div style={css.section}>
              <div style={{ fontSize: 11, color: T.accent, fontWeight: "bold", letterSpacing: "0.08em", marginBottom: 10 }}>TOP PATHS</div>
              {result.topPaths.map(([path, count]) => {
                const pct = ((count / result.runs) * 100).toFixed(1);
                return <div key={path} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                  <span style={{ flex: 1, fontSize: 11 }}>{path}</span>
                  <strong style={{ color: T.accentBright, fontSize: 11, flexShrink: 0 }}>{count}x ({pct}%)</strong>
                </div>;
              })}
            </div>
            <div style={css.section}>
              <div style={{ fontSize: 11, color: T.accent, fontWeight: "bold", letterSpacing: "0.08em", marginBottom: 10 }}>KEYWORDS EARNED</div>
              {result.topKeywords.length === 0 && <div style={{ fontSize: 11, color: T.textMuted }}>No keywords earned.</div>}
              {result.topKeywords.map(([keyword, count]) => {
                const pct = ((count / result.runs) * 100).toFixed(1);
                return <div key={keyword} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={css.tag}>{keyword}</span>
                  <span style={{ fontSize: 11, color: T.textDim }}>{count}x ({pct}%)</span>
                </div>;
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
