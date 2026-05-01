import { useState } from "react";
import { useThemeCSS } from "./theme.js";

function randBetween(min, max) {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  return lo === hi ? lo : lo + Math.random() * (hi - lo);
}

function runSimulation(campaign, startingCBills, runs) {
  const { nodes, edges } = campaign.flowchart;
  const startNode = nodes.find((node) => node.isStart);
  if (!startNode) return { error: "No start node marked. Click > on a node in the flowchart." };

  const results = [];
  for (let i = 0; i < runs; i++) {
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
    results.push({ cbills: Math.round(cbills), path, keywords: [...keywords] });
  }

  const finalCBills = results.map((result) => result.cbills).sort((a, b) => a - b);
  const mean = Math.round(finalCBills.reduce((sum, value) => sum + value, 0) / runs);
  const min = finalCBills[0];
  const max = finalCBills[runs - 1];
  const bucketSize = Math.max(1, Math.ceil((max - min) / 12));
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
    median: finalCBills[Math.floor(runs / 2)],
    p10: finalCBills[Math.floor(runs * 0.1)],
    p90: finalCBills[Math.floor(runs * 0.9)],
    min,
    max,
    topPaths: Object.entries(pathCounts).sort((a, b) => b[1] - a[1]).slice(0, 8),
    topKeywords: Object.entries(keywordCounts).sort((a, b) => b[1] - a[1]).slice(0, 12),
    buckets,
    runs,
  };
}

export function SimulatorView({ campaign }) {
  const { T, css } = useThemeCSS();
  const [startCBills, setStartCBills] = useState(10000000);
  const [runCount, setRunCount] = useState(100);
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);
  const startNode = campaign.flowchart.nodes.find((node) => node.isStart);
  const endNode = campaign.flowchart.nodes.find((node) => node.isEnd);
  const fmt = (value) => value === undefined || value === null ? "-" : `${value >= 0 ? "" : "-"}${Math.abs(Math.round(value)).toLocaleString()}`;
  const statCard = (label, value, color) => (
    <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: "10px 14px", textAlign: "center" }}>
      <div style={{ fontSize: 9, color: T.textDim, letterSpacing: "0.08em", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: "bold", color: color || T.accentBright }}>{fmt(value)}</div>
    </div>
  );

  const run = () => {
    setRunning(true);
    setTimeout(() => {
      setResult(runSimulation(campaign, startCBills, runCount));
      setRunning(false);
    }, 10);
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
        <button style={{ ...css.btn("primary"), padding: "8px 20px", fontSize: 13, opacity: !startNode || running ? 0.5 : 1 }} disabled={!startNode || running} onClick={run}>{running ? "Running..." : `Run ${runCount} Simulations`}</button>
      </div>

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
                return <div key={`${bucket.lo}-${bucket.hi}`} title={`${bucket.lo.toLocaleString()}-${bucket.hi.toLocaleString()}: ${bucket.count}`} style={{ flex: 1, height, background: bucket.lo < 0 ? T.danger : T.accent, borderRadius: "2px 2px 0 0", opacity: 0.8 }} />;
              })}
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
            <div style={css.section}>
              <div style={{ fontSize: 11, color: T.accent, fontWeight: "bold", letterSpacing: "0.08em", marginBottom: 10 }}>TOP PATHS</div>
              {result.topPaths.map(([path, count]) => <div key={path} style={{ display: "flex", gap: 8, marginBottom: 6 }}><span style={{ flex: 1, fontSize: 11 }}>{path}</span><strong style={{ color: T.accentBright, fontSize: 11 }}>{count}x</strong></div>)}
            </div>
            <div style={css.section}>
              <div style={{ fontSize: 11, color: T.accent, fontWeight: "bold", letterSpacing: "0.08em", marginBottom: 10 }}>KEYWORDS EARNED</div>
              {result.topKeywords.length === 0 && <div style={{ fontSize: 11, color: T.textMuted }}>No keywords earned.</div>}
              {result.topKeywords.map(([keyword, count]) => <div key={keyword} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><span style={css.tag}>{keyword}</span><span style={{ fontSize: 11, color: T.textDim }}>{count}x</span></div>)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
