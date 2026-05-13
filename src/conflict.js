// Pure functions for conflict detection and merging. Both inputs must already
// be at SCHEMA_VERSION when called (storage.js ensures this via _safeMigrate).

// ── Timestamp resolution ──────────────────────────────────────────────────────

// Compares ISO-8601 timestamps against an anchor (Unix seconds).
// Returns { value, winner: "local"|"server", conflict: boolean }
function _resolveByTimestamp(localVal, serverVal, localTs, serverTs, anchorMs) {
  const localT  = localTs  ? new Date(localTs).getTime()  : 0;
  const serverT = serverTs ? new Date(serverTs).getTime() : 0;

  if (localT > anchorMs && serverT <= anchorMs) return { value: localVal,  winner: "local",  conflict: false };
  if (serverT > anchorMs && localT <= anchorMs) return { value: serverVal, winner: "server", conflict: false };
  if (localT > anchorMs && serverT > anchorMs)  return { value: serverVal, winner: "server", conflict: true  };
  return { value: serverVal, winner: "server", conflict: false }; // neither changed or no timestamps
}

// ── diffCampaigns ─────────────────────────────────────────────────────────────

export function diffCampaigns(local, server) {
  const items = [];

  const localPages  = _byId(local.pages  || []);
  const serverPages = _byId(server.pages || []);
  const allPageIds  = new Set([...Object.keys(localPages), ...Object.keys(serverPages)]);

  for (const id of allPageIds) {
    const lp = localPages[id];
    const sp = serverPages[id];
    if (!lp) { items.push({ kind: "page-added",   id, label: sp.name }); continue; }
    if (!sp) { items.push({ kind: "page-removed",  id, label: lp.name }); continue; }
    if (!_deepEqual(lp, sp)) {
      const sectionDiffs = _sectionDiffs(lp, sp);
      items.push({ kind: "page-edited", id, label: lp.name, sectionDiffs });
    }
  }

  const localTypes  = _byId(local.pageTypes  || []);
  const serverTypes = _byId(server.pageTypes || []);
  for (const id of new Set([...Object.keys(localTypes), ...Object.keys(serverTypes)])) {
    const lt = localTypes[id];
    const st = serverTypes[id];
    if (!lt) { items.push({ kind: "pageType-added",   id, label: st.name }); continue; }
    if (!st) { items.push({ kind: "pageType-removed",  id, label: lt.name }); continue; }
    if (!_deepEqual(lt, st)) items.push({ kind: "pageType-edited", id, label: lt.name });
  }

  const localStats  = _byId(local.statDefs  || []);
  const serverStats = _byId(server.statDefs || []);
  for (const id of new Set([...Object.keys(localStats), ...Object.keys(serverStats)])) {
    const ls = localStats[id];
    const ss = serverStats[id];
    if (!ls) { items.push({ kind: "statDef-added",   id, label: ss.name }); continue; }
    if (!ss) { items.push({ kind: "statDef-removed",  id, label: ls.name }); continue; }
    if (!_deepEqual(ls, ss)) items.push({ kind: "statDef-edited", id, label: ls.name });
  }

  const metaFields = ["name", "shareEnabled", "shareCustomCss", "shareTheme", "statDefs"];
  for (const field of metaFields) {
    if (!_deepEqual(local[field], server[field])) {
      items.push({ kind: "meta-field", id: field, label: field, localValue: String(local[field] ?? ""), serverValue: String(server[field] ?? "") });
    }
  }

  const lfc = local.flowchart  || {};
  const sfc = server.flowchart || {};
  const localNodes  = _byId(lfc.nodes || []);
  const serverNodes = _byId(sfc.nodes || []);
  for (const id of new Set([...Object.keys(localNodes), ...Object.keys(serverNodes)])) {
    const ln = localNodes[id];
    const sn = serverNodes[id];
    if (!ln) { items.push({ kind: "flowchart-node-added",   id, label: sn.pageId || id }); continue; }
    if (!sn) { items.push({ kind: "flowchart-node-removed",  id, label: ln.pageId || id }); continue; }
    if (!_deepEqual(_stripPos(ln), _stripPos(sn))) items.push({ kind: "flowchart-node-edited", id, label: ln.pageId || id });
  }

  const localEdges  = _byEdgeId(lfc.edges || []);
  const serverEdges = _byEdgeId(sfc.edges || []);
  for (const id of new Set([...Object.keys(localEdges), ...Object.keys(serverEdges)])) {
    const le = localEdges[id];
    const se = serverEdges[id];
    if (!le) { items.push({ kind: "flowchart-edge-added",   id, label: id }); continue; }
    if (!se) { items.push({ kind: "flowchart-edge-removed",  id, label: id }); continue; }
    if (!_deepEqual(le, se)) items.push({ kind: "flowchart-edge-edited", id, label: id });
  }

  return items;
}

// ── mergeCampaigns ────────────────────────────────────────────────────────────

export function mergeCampaigns(local, server, lastSyncedAt) {
  const anchorMs = (lastSyncedAt || 0) * 1000;
  const conflicts  = [];
  const autoResolved = [];
  const merged = { ...server };

  // ── Pages ─────────────────────────────────────────────────────────────────

  const localPages  = _byId(local.pages  || []);
  const serverPages = _byId(server.pages || []);
  const mergedPages = [];

  for (const id of new Set([...Object.keys(localPages), ...Object.keys(serverPages)])) {
    const lp = localPages[id];
    const sp = serverPages[id];

    if (!sp) { mergedPages.push(lp); autoResolved.push({ kind: "page-added-local", id, label: lp.name }); continue; }
    if (!lp) { mergedPages.push(sp); autoResolved.push({ kind: "page-added-server", id, label: sp.name }); continue; }
    if (_deepEqual(lp, sp)) { mergedPages.push(sp); continue; }

    const lTs = lp.sectionTimestamps || {};
    const sTs = sp.sectionTimestamps || {};
    const allKeys = new Set([...Object.keys(lTs), ...Object.keys(sTs)]);

    // No timestamps on either side → whole-page server-wins, flag it
    if (allKeys.size === 0) {
      mergedPages.push(sp);
      conflicts.push({ kind: "page-edited", id, label: lp.name });
      continue;
    }

    let pageHasConflict = false;
    let mergedPage = { ...sp, sections: { ...(sp.sections || {}) }, sectionTimestamps: { ...sTs } };
    const sectionConflicts = [];
    const autoMergedSections = [];

    for (const key of allKeys) {
      const localVal  = _getPageField(lp, key);
      const serverVal = _getPageField(sp, key);
      const res = _resolveByTimestamp(localVal, serverVal, lTs[key], sTs[key], anchorMs);
      if (res.conflict) {
        pageHasConflict = true;
        sectionConflicts.push({ sectionId: key, localValue: localVal, serverValue: serverVal });
      } else if (res.winner === "local") {
        if (key === "__meta__") {
          mergedPage = { ...mergedPage, name: lp.name, tags: lp.tags, type: lp.type, playerVisible: lp.playerVisible };
        } else if (key === "__costs__") {
          mergedPage = { ...mergedPage, costs: lp.costs };
        } else if (key === "__awards__") {
          mergedPage = { ...mergedPage, awards: lp.awards };
        } else {
          mergedPage.sections[key] = localVal;
        }
        mergedPage.sectionTimestamps[key] = lTs[key];
        if (!_deepEqual(localVal, serverVal)) autoMergedSections.push({ sectionId: key, winner: "local", keptValue: localVal, discardedValue: serverVal });
      } else {
        if (!_deepEqual(localVal, serverVal)) autoMergedSections.push({ sectionId: key, winner: "server", keptValue: serverVal, discardedValue: localVal });
      }
    }

    mergedPages.push(mergedPage);

    if (pageHasConflict) {
      conflicts.push({ kind: "page-edited", id, label: lp.name, sectionConflicts, autoMergedSections });
    } else {
      autoResolved.push({ kind: "page-merged", id, label: lp.name, autoMergedSections });
    }
  }

  // Preserve server page order, then append local-only pages
  const serverPageOrder = (server.pages || []).map(p => p.id);
  merged.pages = [
    ...serverPageOrder.map(id => mergedPages.find(p => p.id === id)).filter(Boolean),
    ...mergedPages.filter(p => !serverPageOrder.includes(p.id)),
  ];

  // ── pageTypes ─────────────────────────────────────────────────────────────

  const localTypes  = _byId(local.pageTypes  || []);
  const serverTypes = _byId(server.pageTypes || []);
  const mergedTypes = [...(server.pageTypes || [])];

  for (const [id, lt] of Object.entries(localTypes)) {
    if (!serverTypes[id]) { mergedTypes.push(lt); autoResolved.push({ kind: "pageType-added", id, label: lt.name }); }
    else if (!_deepEqual(lt, serverTypes[id])) conflicts.push({ kind: "pageType-edited", id, label: lt.name });
  }
  merged.pageTypes = mergedTypes;

  // ── statDefs ─────────────────────────────────────────────────────────────

  const localStats  = _byId(local.statDefs  || []);
  const serverStats = _byId(server.statDefs || []);
  const mergedStats = [...(server.statDefs || [])];

  for (const [id, ls] of Object.entries(localStats)) {
    if (!serverStats[id]) { mergedStats.push(ls); autoResolved.push({ kind: "statDef-added", id, label: ls.name }); }
    else if (!_deepEqual(ls, serverStats[id])) conflicts.push({ kind: "statDef-edited", id, label: ls.name });
  }
  merged.statDefs = mergedStats;

  // ── Campaign meta fields ──────────────────────────────────────────────────

  const lFT = local.fieldTimestamps  || {};
  const sFT = server.fieldTimestamps || {};
  const mergedFT = { ...sFT };
  const META_FIELDS = ["name", "shareEnabled", "shareCustomCss", "shareTheme"];

  for (const field of META_FIELDS) {
    if (_deepEqual(local[field], server[field])) continue;
    const res = _resolveByTimestamp(local[field], server[field], lFT[field], sFT[field], anchorMs);
    if (res.conflict) {
      conflicts.push({ kind: "meta-field", id: field, label: field });
    } else {
      if (res.winner === "local") {
        merged[field] = local[field];
        mergedFT[field] = lFT[field];
        autoResolved.push({ kind: "meta-field", id: field, label: field });
      }
    }
  }
  // shareGuid → server always wins (never conflict-flagged)
  merged.shareGuid = server.shareGuid;
  // theme → local always wins (device preference, never conflict-flagged)
  merged.theme = local.theme;
  merged.fieldTimestamps = mergedFT;

  // ── Flowchart ─────────────────────────────────────────────────────────────

  const lfc = local.flowchart  || {};
  const sfc = server.flowchart || {};
  const lNTs = lfc.nodeTimestamps || {};
  const sNTs = sfc.nodeTimestamps || {};
  const lETs = lfc.edgeTimestamps || {};
  const sETs = sfc.edgeTimestamps || {};

  const localNodes  = _byId(lfc.nodes || []);
  const serverNodes = _byId(sfc.nodes || []);
  const mergedNodes = [];
  const mergedNTs   = { ...sNTs };

  for (const id of new Set([...Object.keys(localNodes), ...Object.keys(serverNodes)])) {
    const ln = localNodes[id];
    const sn = serverNodes[id];
    if (!sn) { mergedNodes.push(ln); mergedNTs[id] = lNTs[id]; autoResolved.push({ kind: "node-added", id }); continue; }
    if (!ln) { mergedNodes.push(sn); continue; }
    const res = _resolveByTimestamp(ln, sn, lNTs[id], sNTs[id], anchorMs);
    if (res.conflict) { conflicts.push({ kind: "flowchart-node-edited", id, label: ln.pageId || id }); mergedNodes.push(sn); }
    else if (res.winner === "local") { mergedNodes.push(ln); mergedNTs[id] = lNTs[id]; autoResolved.push({ kind: "node-merged", id }); }
    else mergedNodes.push(sn);
  }

  const localEdges  = _byEdgeId(lfc.edges || []);
  const serverEdges = _byEdgeId(sfc.edges || []);
  const mergedEdges = [];
  const mergedETs   = { ...sETs };

  for (const id of new Set([...Object.keys(localEdges), ...Object.keys(serverEdges)])) {
    const le = localEdges[id];
    const se = serverEdges[id];
    if (!se) { mergedEdges.push(le); mergedETs[id] = lETs[id]; autoResolved.push({ kind: "edge-added", id }); continue; }
    if (!le) { mergedEdges.push(se); continue; }
    const res = _resolveByTimestamp(le, se, lETs[id], sETs[id], anchorMs);
    if (res.conflict) { conflicts.push({ kind: "flowchart-edge-edited", id, label: id }); mergedEdges.push(se); }
    else if (res.winner === "local") { mergedEdges.push(le); mergedETs[id] = lETs[id]; autoResolved.push({ kind: "edge-merged", id }); }
    else mergedEdges.push(se);
  }

  merged.flowchart = { ...sfc, nodes: mergedNodes, nodeTimestamps: mergedNTs, edges: mergedEdges, edgeTimestamps: mergedETs };

  return { merged, conflicts, autoResolved };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _byId(arr) {
  const m = {};
  for (const item of arr) if (item.id) m[item.id] = item;
  return m;
}

function _byEdgeId(arr) {
  const m = {};
  for (const e of arr) m[`${e.from}--${e.to}`] = e;
  return m;
}

function _deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function _stripPos(node) {
  const { x: _x, y: _y, ...rest } = node;
  return rest;
}

function _sectionDiffs(lp, sp) {
  const lSecs = lp.sections || {};
  const sSecs = sp.sections || {};
  const allIds = new Set([...Object.keys(lSecs), ...Object.keys(sSecs)]);
  const diffs = [];
  for (const sid of allIds) {
    if (!_deepEqual(lSecs[sid], sSecs[sid])) {
      diffs.push({ sectionId: sid, localSummary: _summarize(lSecs[sid]), serverSummary: _summarize(sSecs[sid]) });
    }
  }
  return diffs;
}

function _summarize(val) {
  if (!val) return "(empty)";
  if (typeof val === "string") return val.slice(0, 60) + (val.length > 60 ? "…" : "");
  if (typeof val === "object") {
    const keys = Object.keys(val);
    return `{${keys.slice(0, 3).join(", ")}${keys.length > 3 ? "…" : ""}}`;
  }
  return String(val);
}

// page.sections uses sectionId keys; synthetic keys: __meta__, __costs__, __awards__
function _getPageField(page, key) {
  if (key === "__meta__")   return { name: page.name, tags: page.tags, type: page.type, playerVisible: page.playerVisible };
  if (key === "__costs__")  return page.costs;
  if (key === "__awards__") return page.awards;
  return (page.sections || {})[key];
}

