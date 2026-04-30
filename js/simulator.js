// ═══════════════════════════════════════════════════════════════════════════════
// SIMULATOR
// ═══════════════════════════════════════════════════════════════════════════════

function randBetween(min, max) {
  const lo = Math.min(min, max), hi = Math.max(min, max);
  return lo === hi ? lo : lo + Math.random() * (hi - lo);
}

function runSimulation(campaign, startingCBills, runs) {
  const { nodes, edges } = campaign.flowchart;
  const startNode = nodes.find(n => n.isStart);
  if (!startNode) return { error: "No start node marked. Click ▶ on a node in the flowchart." };

  const results = [];

  for (let i = 0; i < runs; i++) {
    let cbills = startingCBills;
    let keywords = new Set();
    let path = [];
    let currentNodeId = startNode.id;
    let steps = 0;
    const MAX_STEPS = 60;

    while (currentNodeId && steps < MAX_STEPS) {
      steps++;
      const node = nodes.find(n => n.id === currentNodeId);
      if (!node) break;

      const page = campaign.pages.find(p => p.id === node.pageId);
      path.push(page?.name || "?");

      if (page) {
        const baseCost = (page.costs || []).reduce((s, c) => s + (Number(c.amount) || 0), 0);
        const baseAward = (page.awards || []).reduce((s, a) => s + (Number(a.amount) || 0), 0);
        cbills += baseAward - baseCost;
      }

      if (node.isEnd) break;

      const outEdges = edges.filter(e => e.from === currentNodeId);
      if (outEdges.length === 0) break;

      const nextEdge = outEdges[Math.floor(Math.random() * outEdges.length)];

      for (const ev of (nextEdge.events || [])) {
        if (ev.requiresKeyword && !keywords.has(ev.requiresKeyword)) continue;
        if (Math.random() * 100 > ev.probability) continue;
        const cost = randBetween(ev.costMin || 0, ev.costMax || 0);
        const award = randBetween(ev.awardMin || 0, ev.awardMax || 0);
        cbills += award - cost;
        if (ev.grantsKeyword) keywords.add(ev.grantsKeyword);
      }

      currentNodeId = nextEdge.to;
    }

    results.push({ cbills: Math.round(cbills), path, keywords: [...keywords] });
  }

  const finalCBills = results.map(r => r.cbills).sort((a, b) => a - b);
  const mean = Math.round(finalCBills.reduce((s, v) => s + v, 0) / runs);
  const median = finalCBills[Math.floor(runs / 2)];
  const p10 = finalCBills[Math.floor(runs * 0.1)];
  const p90 = finalCBills[Math.floor(runs * 0.9)];
  const min = finalCBills[0];
  const max = finalCBills[runs - 1];

  const pathCounts = {};
  results.forEach(r => { const key = r.path.join(" → "); pathCounts[key] = (pathCounts[key] || 0) + 1; });
  const topPaths = Object.entries(pathCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);

  const kwCounts = {};
  results.forEach(r => r.keywords.forEach(kw => { kwCounts[kw] = (kwCounts[kw] || 0) + 1; }));
  const topKeywords = Object.entries(kwCounts).sort((a, b) => b[1] - a[1]).slice(0, 12);

  const bucketCount = 12;
  const bucketSize = Math.max(1, Math.ceil((max - min) / bucketCount));
  const buckets = [];
  for (let b = 0; b < bucketCount; b++) {
    const lo = min + b * bucketSize;
    const hi = lo + bucketSize;
    buckets.push({ lo, hi, count: finalCBills.filter(v => v >= lo && v < hi).length });
  }
  if (buckets.length > 0) buckets[buckets.length - 1].count += finalCBills.filter(v => v >= buckets[buckets.length-1].hi).length;

  return { mean, median, p10, p90, min, max, topPaths, topKeywords, buckets, runs };
}

function SimulatorView({ campaign }) {
  const T = useTheme(); const css = makeCSS(T);
  const [startCBills, setStartCBills] = useState(10000000);
  const [runCount, setRunCount] = useState(100);
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);

  const { nodes } = campaign.flowchart;
  const startNode = nodes.find(n => n.isStart);
  const endNodes = nodes.find(n => n.isEnd);

  const run = () => {
    setRunning(true);
    setTimeout(() => {
      const r = runSimulation(campaign, startCBills, runCount);
      setResult(r);
      setRunning(false);
    }, 10);
  };

  const fmt = (n) => {
    if (n === undefined || n === null) return "—";
    return (n >= 0 ? "" : "-") + Math.abs(Math.round(n)).toLocaleString();
  };

  const statCard = (label, value, color) => (
    <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: "10px 14px", textAlign: "center" }}>
      <div style={{ fontSize: 9, color: T.textDim, letterSpacing: "0.08em", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: "bold", color: color || T.accentBright }}>{fmt(value)}</div>
    </div>
  );

  return (
    <div style={{ maxWidth: 820 }}>
      <h2 style={{ margin: "0 0 4px", color: T.accentBright, fontSize: 16, letterSpacing: "0.1em" }}>CAMPAIGN SIMULATOR</h2>
      <p style={{ margin: "0 0 20px", fontSize: 12, color: T.textDim }}>
        Runs N random campaigns through your flowchart and projects financial outcomes.
        Mark a ▶ start and ■ end node in the Flowchart view first.
      </p>

      {!startNode && (
        <div style={{ background: T.warn + "22", border: `1px solid ${T.warn}`, borderRadius: T.radius, padding: 12, marginBottom: 16, fontSize: 12, color: T.warn }}>
          ⚠ No start node set. Go to Flowchart and click ▶ on the first mission node.
        </div>
      )}
      {startNode && !endNodes && (
        <div style={{ background: T.textDim + "22", border: `1px solid ${T.border}`, borderRadius: T.radius, padding: 10, marginBottom: 16, fontSize: 11, color: T.textDim }}>
          Tip: mark ■ end nodes so simulations know where to stop. Without them, paths end at nodes with no outgoing edges.
        </div>
      )}

      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ flex: "0 0 200px" }}>
          <div style={{ fontSize: 10, color: T.textDim, marginBottom: 4, letterSpacing: "0.08em" }}>STARTING C-BILLS</div>
          <input type="number" style={{ ...css.input }} value={startCBills} onChange={e => setStartCBills(Number(e.target.value))} />
        </div>
        <div style={{ flex: "0 0 120px" }}>
          <div style={{ fontSize: 10, color: T.textDim, marginBottom: 4, letterSpacing: "0.08em" }}>SIMULATIONS</div>
          <select style={{ ...css.input }} value={runCount} onChange={e => setRunCount(Number(e.target.value))}>
            <option value={10}>10</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={500}>500</option>
            <option value={1000}>1000</option>
          </select>
        </div>
        <button style={{ ...css.btn("primary"), padding: "8px 20px", fontSize: 13, opacity: (!startNode || running) ? 0.5 : 1 }}
          disabled={!startNode || running} onClick={run}>
          {running ? "Running…" : `▶ Run ${runCount} Simulations`}
        </button>
      </div>

      {result?.error && (
        <div style={{ color: T.danger, fontSize: 13, padding: 12, background: T.danger + "22", borderRadius: T.radius }}>{result.error}</div>
      )}

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
            <div style={{ fontSize: 11, color: T.accent, fontWeight: "bold", letterSpacing: "0.08em", marginBottom: 12 }}>DISTRIBUTION (final C-Bills)</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 80 }}>
              {result.buckets.map((b, i) => {
                const maxCount = Math.max(...result.buckets.map(x => x.count));
                const h = maxCount === 0 ? 0 : Math.max(4, (b.count / maxCount) * 76);
                const isNeg = b.lo < 0;
                return (
                  <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }} title={`${b.lo.toLocaleString()} – ${b.hi.toLocaleString()}: ${b.count} runs`}>
                    <div style={{ width: "100%", height: h, background: isNeg ? T.danger : T.accent, borderRadius: "2px 2px 0 0", opacity: 0.8 }} />
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8, color: T.textMuted, marginTop: 4 }}>
              <span>{fmt(result.min)}</span>
              <span>{fmt(result.mean)} avg</span>
              <span>{fmt(result.max)}</span>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16, marginBottom: 16 }}>
            <div style={css.section}>
              <div style={{ fontSize: 11, color: T.accent, fontWeight: "bold", letterSpacing: "0.08em", marginBottom: 10 }}>TOP PATHS</div>
              {result.topPaths.map(([path, count]) => (
                <div key={path} style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "flex-start" }}>
                  <div style={{ flex: 1, fontSize: 11, color: T.text, lineHeight: 1.4 }}>{path}</div>
                  <div style={{ flexShrink: 0, fontSize: 11, color: T.accentBright, fontWeight: "bold" }}>
                    {count}× <span style={{ color: T.textDim, fontWeight: "normal" }}>({Math.round(count / result.runs * 100)}%)</span>
                  </div>
                </div>
              ))}
              {result.topPaths.length === 0 && <div style={{ fontSize: 11, color: T.textMuted }}>No paths recorded.</div>}
            </div>

            <div style={css.section}>
              <div style={{ fontSize: 11, color: T.accent, fontWeight: "bold", letterSpacing: "0.08em", marginBottom: 10 }}>KEYWORDS EARNED</div>
              {result.topKeywords.map(([kw, count]) => (
                <div key={kw} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ ...css.tag }}>{kw}</span>
                  <span style={{ fontSize: 11, color: T.textDim }}>
                    {count}× ({Math.round(count / result.runs * 100)}%)
                  </span>
                </div>
              ))}
              {result.topKeywords.length === 0 && <div style={{ fontSize: 11, color: T.textMuted }}>No keywords earned. Add keyword grants to edge events.</div>}
            </div>
          </div>

          <div style={{ fontSize: 10, color: T.textMuted, borderTop: `1px solid ${T.border}`, paddingTop: 8 }}>
            {result.runs} simulations · branching paths chosen randomly (uniform) · edge event probabilities applied per-event
          </div>
        </div>
      )}
    </div>
  );
}
