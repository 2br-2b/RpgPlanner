import { runMigrationTests } from "./migration-tests.js";

export const uid = () => crypto.randomUUID();

export class MigrationError extends Error {
  constructor(message, failures, before, after) {
    super(message);
    this.name = "MigrationError";
    this.failures = failures;   // string[]
    this.before = before;       // raw pre-migration data
    this.after = after;         // post-migration data (may be partially valid)
  }
}

export const pageCostTotal  = (page) => (page?.costs  || []).reduce((s, c) => s + (Number(c.amount) || 0), 0);
export const pageAwardTotal = (page) => (page?.awards || []).reduce((s, a) => s + (Number(a.amount) || 0), 0);

// v1: original (no version field)
// v2: edges gain .events[], nodes gain .isStart/.isEnd
// v3: pages gain .parentId (null) and .order (integer)
// v4: sectionSchema entries gain .type ("text" | "waypoints")
// v5: sectionSchema entries with type "table" gain .columns ([])
// v6: table columns gain .type (text|number|checkbox) and .summary
// v7: table columns gain optional .formula (string) for "formula" type
// v8: player sharing — shareEnabled/shareGuid/shareTheme/shareCustomCss on campaign;
//     playerVisible/playerEditable/playerVisibleSubheaders/playerVisibleColumns on schema sections;
//     playerVisible/sectionVisibilityOverrides on pages
// v9: statDefs [] on campaign; statDeltas [] on all edge events
// v10: edgeType "default" on all edges
// v11: sectionSchema replaced by pageTypes[]; page.type becomes a pageTypeId;
//      old "free" pages become mission-style with 1 section (content migrated)
// v12: pageTypes gain .icon field
// v13: fieldTimestamps on campaign root, sectionTimestamps on pages,
//      nodeTimestamps/edgeTimestamps on flowchart — all empty on migration (no fabricated times)
// v14: flowchart.notes [] for free-floating text annotations
export const SCHEMA_VERSION = 14;

function _applyMigrations(data) {
  const v = data.schemaVersion || 1;
  if (v === SCHEMA_VERSION) return data;
  let d = { ...data };

  if (v < 2) {
    d = {
      ...d,
      flowchart: {
        nodes: (d.flowchart?.nodes || []).map(n => ({ isStart: false, isEnd: false, ...n })),
        edges: (d.flowchart?.edges || []).map(e => ({ events: [], ...e })),
      },
    };
  }
  if (v < 3) {
    d = { ...d, pages: (d.pages || []).map((p, i) => ({ parentId: null, order: i, ...p })) };
  }
  if (v < 4) {
    d = { ...d, sectionSchema: (d.sectionSchema || []).map(s => ({ type: "text", ...s })) };
  }

  if (v < 5) {
    d = {
      ...d,
      sectionSchema: (d.sectionSchema || []).map(s =>
        s.type === "table" ? { columns: [], ...s } : s
      ),
    };
  }

  if (v < 6) {
    d = {
      ...d,
      sectionSchema: (d.sectionSchema || []).map(s => {
        if (s.type !== "table") return s;
        return {
          ...s,
          columns: (s.columns || []).map(c => ({
            id: c.id,
            label: c.label,
            defaultValue: c.defaultValue ?? "",
            type: c.type || "text",
            summary: c.summary || "none",
          })),
        };
      }),
    };
  }

  if (v < 7) {
    d = {
      ...d,
      sectionSchema: (d.sectionSchema || []).map(s => {
        if (s.type !== "table") return s;
        return {
          ...s,
          columns: (s.columns || []).map(c => ({
            formula: "",
            ...c,
          })),
        };
      }),
    };
  }

  if (v < 8) {
    d = {
      ...d,
      shareEnabled: false,
      shareGuid: null,
      shareTheme: d.theme || "materialLight",
      shareCustomCss: "",
      sectionSchema: (d.sectionSchema || []).map(s => ({
        playerVisible: false,
        playerEditable: false,
        playerVisibleSubheaders: [],
        playerVisibleColumns: [],
        ...s,
      })),
      pages: (d.pages || []).map(p => ({
        playerVisible: false,
        sectionVisibilityOverrides: {},
        ...p,
      })),
    };
  }

  if (v < 9) {
    d = {
      ...d,
      statDefs: d.statDefs || [],
      flowchart: {
        nodes: d.flowchart?.nodes || [],
        edges: (d.flowchart?.edges || []).map(e => ({
          ...e,
          events: (e.events || []).map(ev => ({ statDeltas: [], ...ev })),
        })),
      },
    };
  }

  if (v < 10) {
    d = {
      ...d,
      flowchart: {
        ...d.flowchart,
        edges: (d.flowchart?.edges || []).map(e => ({ edgeType: "default", ...e })),
      },
    };
  }

  if (v < 11) {
    // Create the "Mission" page type from the existing sectionSchema
    const missionTypeId = uid();
    const missionType = {
      id: missionTypeId,
      name: "Mission",
      icon: "⚔",
      sectionSchema: (d.sectionSchema || []),
    };
    // Create a "Free Page" type with one content section (no subheaders)
    const freeContentSectionId = uid();
    const freeTypeId = uid();
    const freeType = {
      id: freeTypeId,
      name: "Free Page",
      icon: "📝",
      sectionSchema: [
        {
          id: freeContentSectionId,
          name: "Content",
          type: "text",
          subheaders: [],
          playerVisible: false,
          playerEditable: false,
          playerVisibleSubheaders: [],
          playerVisibleColumns: [],
        },
      ],
    };
    // Migrate pages: remap type strings to pageType IDs, migrate free page content
    const migratedPages = (d.pages || []).map(p => {
      if ((p.type ?? "mission") === "free") {
        // Move page.content → page.sections[freeContentSectionId] (flat string value)
        const existingContent = p.content || "";
        return {
          ...p,
          type: freeTypeId,
          sections: { ...(p.sections || {}), [freeContentSectionId]: existingContent },
          content: undefined,
        };
      }
      // mission (or anything else)
      return { ...p, type: missionTypeId };
    });
    d = {
      ...d,
      pageTypes: [missionType, freeType],
      sectionSchema: undefined,
      pages: migratedPages,
    };
  }

  if (v < 12) {
    const DEFAULT_ICONS = ["⚔", "📝", "🗺", "🏰", "📖", "🔮", "🎲"];
    d = {
      ...d,
      pageTypes: (d.pageTypes || []).map((pt, i) => pt.icon ? pt : { ...pt, icon: DEFAULT_ICONS[i] || "📄" }),
    };
  }

  if (v < 13) {
    d = {
      fieldTimestamps: {},
      ...d,
      pages: (d.pages || []).map(p => ({
        sectionTimestamps: {},
        ...p,
      })),
      flowchart: d.flowchart ? {
        nodeTimestamps: {},
        edgeTimestamps: {},
        ...d.flowchart,
      } : d.flowchart,
    };
  }

  if (v < 14) {
    d = {
      ...d,
      flowchart: d.flowchart ? { ...d.flowchart, notes: d.flowchart.notes || [] } : d.flowchart,
    };
  }

  return { ...d, schemaVersion: SCHEMA_VERSION };
}

// Public wrapper: runs migration then validates invariants.
// Throws MigrationError if tests fail — callers must catch and show the error UI.
// Pass skipTests=true only from the "snapshot and continue (unsafe)" path.
export function migrateCampaign(data, { skipTests = false } = {}) {
  const v = data.schemaVersion || 1;
  if (v === SCHEMA_VERSION) return data;           // nothing to migrate, no tests needed
  const after = _applyMigrations(data);
  if (!skipTests) {
    const { ok, failures } = runMigrationTests(data, after);
    if (!ok) throw new MigrationError(
      `Migration from v${v} to v${SCHEMA_VERSION} failed ${failures.length} invariant check(s)`,
      failures, data, after
    );
  }
  return after;
}

export async function logMigrationError(err) {
  try {
    await fetch(`${API_BASE}/campaign/${SESSION_GUID}/migration-errors`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fromVersion: err.before?.schemaVersion || null,
        toVersion: SCHEMA_VERSION,
        failures: err.failures,
        timestamp: new Date().toISOString(),
      }),
    });
  } catch { /* best-effort — don't mask the original error */ }
}

function preferredTheme() {
  if (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches) return "materialDark";
  return "materialLight";
}

export function defaultPageTypes() {
  const missionTypeId = uid();
  const freeTypeId = uid();
  const freeContentSectionId = uid();
  return {
    missionTypeId,
    freeTypeId,
    pageTypes: [
      {
        id: missionTypeId,
        name: "Mission",
        icon: "⚔",
        sectionSchema: [
          { id: uid(), name: "Overview", type: "text", subheaders: ["Background", "Objectives"], playerVisible: false, playerEditable: false, playerVisibleSubheaders: [], playerVisibleColumns: [] },
          { id: uid(), name: "Setup", type: "text", subheaders: ["Deployment", "Special Rules"], playerVisible: false, playerEditable: false, playerVisibleSubheaders: [], playerVisibleColumns: [] },
          { id: uid(), name: "Rewards", type: "text", subheaders: ["C-Bills", "XP", "Salvage"], playerVisible: false, playerEditable: false, playerVisibleSubheaders: [], playerVisibleColumns: [] },
        ],
      },
      {
        id: freeTypeId,
        name: "Free Page",
        icon: "📝",
        sectionSchema: [
          { id: freeContentSectionId, name: "Content", type: "text", subheaders: [], playerVisible: false, playerEditable: false, playerVisibleSubheaders: [], playerVisibleColumns: [] },
        ],
      },
    ],
  };
}

export function defaultCampaign() {
  const { pageTypes } = defaultPageTypes();
  return {
    id: uid(), name: "New Campaign", theme: preferredTheme(),
    shareEnabled: false, shareGuid: null, shareTheme: preferredTheme(), shareCustomCss: "",
    pageTypes,
    schemaVersion: SCHEMA_VERSION,
    statDefs: [],
    fieldTimestamps: {},
    pages: [],
    flowchart: { nodes: [], edges: [], nodeTimestamps: {}, edgeTimestamps: {} },
  };
}

// ── Multi-campaign management ─────────────────────────────────────────────────

export function getKnownCampaigns() {
  try { return JSON.parse(localStorage.getItem("campaign-manager-campaigns") || "[]"); } catch { return []; }
}

export function registerCampaign(guid, name) {
  const list = getKnownCampaigns();
  const idx = list.findIndex(c => c.guid === guid);
  const entry = { guid, name: name || "Unnamed Campaign", lastUsed: Date.now() };
  if (idx >= 0) list[idx] = entry;
  else list.push(entry);
  localStorage.setItem("campaign-manager-campaigns", JSON.stringify(list));
}

// Pending save callback — app.jsx sets this so switch/create can flush first.
let _pendingSaveFlush = null;
export function registerSaveFlush(fn) { _pendingSaveFlush = fn; }

async function flushAndReload(setGuid) {
  setGuid();
  if (_pendingSaveFlush) await _pendingSaveFlush();
  window.location.reload();
}

export function switchCampaign(guid) {
  flushAndReload(() => localStorage.setItem("campaign-manager-guid", guid));
}

export function createNewCampaign() {
  const guid = crypto.randomUUID();
  flushAndReload(() => localStorage.setItem("campaign-manager-guid", guid));
}

export function forgetCampaign(guid) {
  const list = getKnownCampaigns().filter(c => c.guid !== guid);
  localStorage.setItem("campaign-manager-campaigns", JSON.stringify(list));
}

// ── GUID-based REST sync ──────────────────────────────────────────────────────

function getOrCreateGuid() {
  const params = new URLSearchParams(window.location.search);
  const urlGuid = params.get("guid");
  if (urlGuid && /^[0-9a-f-]{36}$/.test(urlGuid)) {
    localStorage.setItem("campaign-manager-guid", urlGuid);
    window.history.replaceState({}, "", window.location.pathname + window.location.hash);
    return urlGuid;
  }
  let g = localStorage.getItem("campaign-manager-guid");
  if (!g) { g = crypto.randomUUID(); localStorage.setItem("campaign-manager-guid", g); }
  return g;
}

export const SESSION_GUID = getOrCreateGuid();
const API_BASE = window.CAMPAIGN_API_BASE || "/api";

// ── Private sync helpers ──────────────────────────────────────────────────────

function _readLocal() {
  try { return JSON.parse(localStorage.getItem("campaign-manager-local")); } catch { return null; }
}

function _readLastSyncedAt() {
  const raw = localStorage.getItem("campaign-manager-synced-at");
  if (raw === null) return null;
  const v = parseFloat(raw);
  return isNaN(v) ? null : v;
}

function _dataEqual(a, b) {
  const strip = (x) => { const c = { ...x }; delete c.schemaVersion; return JSON.stringify(c); };
  return strip(a) === strip(b);
}

// Always migrates to SCHEMA_VERSION regardless of current version.
// Falls back to skipTests=true on MigrationError to never block the conflict UI.
function _safeMigrate(data) {
  if (!data) return null;
  try { return migrateCampaign(data); }
  catch (e) {
    if (e instanceof MigrationError) return migrateCampaign(data, { skipTests: true });
    throw e;
  }
}

export async function loadData() {
  const localRaw = _readLocal();
  const lastSyncedAt = _readLastSyncedAt();

  let serverRaw = null;
  let serverUpdatedAt = null;

  try {
    const r = await fetch(`${API_BASE}/campaign/${SESSION_GUID}`);
    if (r.status === 404) {
      // Return raw — _finishLoad in app.jsx calls migrateCampaign() and can show MigrationErrorModal
      return { data: localRaw, serverUpdatedAt: null, localData: localRaw, lastSyncedAt, conflict: null };
    }
    if (!r.ok) throw new Error(r.status);
    const json = await r.json();
    serverRaw = json.data || null;
    serverUpdatedAt = json.updated_at ?? null;
  } catch (e) {
    console.warn("Load failed, falling back to localStorage:", e);
    return { data: localRaw, serverUpdatedAt: null, localData: localRaw, lastSyncedAt, conflict: null };
  }

  // No sync history → first-ever load; server wins silently
  if (lastSyncedAt === null) {
    return { data: serverRaw ?? localRaw, serverUpdatedAt, localData: localRaw, lastSyncedAt, conflict: null };
  }

  // Server unchanged since last sync → local may be ahead; use local
  if (serverUpdatedAt !== null && serverUpdatedAt <= lastSyncedAt + 0.5) {
    return { data: localRaw ?? serverRaw, serverUpdatedAt, localData: localRaw, lastSyncedAt, conflict: null };
  }

  // No local data → server wins silently
  if (!localRaw) {
    return { data: serverRaw, serverUpdatedAt, localData: null, lastSyncedAt, conflict: null };
  }

  // Content identical (ignoring schemaVersion) → server wins silently
  if (serverRaw && _dataEqual(localRaw, serverRaw)) {
    return { data: serverRaw, serverUpdatedAt, localData: localRaw, lastSyncedAt, conflict: null };
  }

  // Conflict: both sides changed since last sync. Migrate both to SCHEMA_VERSION.
  const localMigrated = _safeMigrate(localRaw);
  const serverMigrated = _safeMigrate(serverRaw);
  return {
    data: serverMigrated,
    serverUpdatedAt,
    localData: localRaw,
    lastSyncedAt,
    conflict: { local: localMigrated, server: serverMigrated, localRaw, serverRaw, serverUpdatedAt, lastSyncedAt },
  };
}

export async function saveData(data) {
  registerCampaign(SESSION_GUID, data.name);
  let localQuotaExceeded = false;
  try {
    localStorage.setItem("campaign-manager-local", JSON.stringify(data));
  } catch (e) {
    if (e instanceof DOMException && (e.name === "QuotaExceededError" || e.name === "NS_ERROR_DOM_QUOTA_REACHED")) {
      localQuotaExceeded = true;
    }
  }
  try {
    const r = await fetch(`${API_BASE}/campaign/${SESSION_GUID}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data }),
    });
    if (r.ok) {
      localStorage.setItem("campaign-manager-synced-at", String(Date.now() / 1000));
    }
  } catch (e) { console.warn("Remote save failed (offline?):", e); }
  return { localQuotaExceeded };
}

// ── Share API helpers ─────────────────────────────────────────────────────────

export async function loadShareData(shareGuid) {
  const r = await fetch(`${API_BASE}/share/${shareGuid}`);
  if (!r.ok) return null;
  return await r.json();
}

export async function setSharing(shareEnabled, shareTheme, shareCustomCss) {
  const r = await fetch(`${API_BASE}/campaign/${SESSION_GUID}/share`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ shareEnabled, shareTheme, shareCustomCss }),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to update sharing");
  }
  return await r.json();
}

export async function patchShareField(shareGuid, pageId, patch) {
  const r = await fetch(`${API_BASE}/share/${shareGuid}/page/${pageId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to save");
  }
  return await r.json();
}

// ── Snapshot API helpers ──────────────────────────────────────────────────────

export async function listSnapshots() {
  try {
    const r = await fetch(`${API_BASE}/campaign/${SESSION_GUID}/snapshots`);
    if (!r.ok) return [];
    return (await r.json()).snapshots || [];
  } catch { return []; }
}

export async function saveSnapshot(name) {
  const r = await fetch(`${API_BASE}/campaign/${SESSION_GUID}/snapshots`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to save snapshot");
  }
  return (await r.json()).id;
}

export async function deleteSnapshot(snapId) {
  const r = await fetch(`${API_BASE}/campaign/${SESSION_GUID}/snapshots/${snapId}`, { method: "DELETE" });
  if (!r.ok) throw new Error("Failed to delete snapshot");
}

export async function restoreSnapshot(snapId) {
  const r = await fetch(`${API_BASE}/campaign/${SESSION_GUID}/snapshots/${snapId}`);
  if (!r.ok) throw new Error("Failed to load snapshot");
  return (await r.json()).data || null;
}
