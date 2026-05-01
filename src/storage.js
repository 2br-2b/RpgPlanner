export const uid = () => crypto.randomUUID();

// v1: original (no version field)
// v2: edges gain .events[], nodes gain .isStart/.isEnd
// v3: pages gain .parentId (null) and .order (integer)
// v4: sectionSchema entries gain .type ("text" | "waypoints")
// v5: sectionSchema entries with type "table" gain .columns ([])
// v6: table columns gain .type (text|number|checkbox) and .summary
// v7: table columns gain optional .formula (string) for "formula" type
export const SCHEMA_VERSION = 7;

export function migrateCampaign(data) {
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

  return { ...d, schemaVersion: SCHEMA_VERSION };
}

function preferredTheme() {
  if (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches) return "materialDark";
  return "materialLight";
}

export function defaultCampaign() {
  return {
    id: uid(), name: "New Campaign", theme: preferredTheme(),
    sectionSchema: [
      { id: uid(), name: "Overview", type: "text", subheaders: ["Background", "Objectives"] },
      { id: uid(), name: "Setup", type: "text", subheaders: ["Deployment", "Special Rules"] },
      { id: uid(), name: "Rewards", type: "text", subheaders: ["C-Bills", "XP", "Salvage"] },
    ],
    schemaVersion: SCHEMA_VERSION,
    pages: [], flowchart: { nodes: [], edges: [] },
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

export function switchCampaign(guid) {
  localStorage.setItem("campaign-manager-guid", guid);
  window.location.reload();
}

export function createNewCampaign() {
  const guid = crypto.randomUUID();
  localStorage.setItem("campaign-manager-guid", guid);
  window.location.reload();
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

export async function loadData() {
  try {
    const r = await fetch(`${API_BASE}/campaign/${SESSION_GUID}`);
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(r.status);
    return (await r.json()).data || null;
  } catch (e) {
    console.warn("Load failed, falling back to localStorage:", e);
    try { return JSON.parse(localStorage.getItem("campaign-manager-local")); } catch { return null; }
  }
}

export async function saveData(data) {
  registerCampaign(SESSION_GUID, data.name);
  try { localStorage.setItem("campaign-manager-local", JSON.stringify(data)); } catch {}
  try {
    await fetch(`${API_BASE}/campaign/${SESSION_GUID}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data }),
    });
  } catch (e) { console.warn("Remote save failed (offline?):", e); }
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
