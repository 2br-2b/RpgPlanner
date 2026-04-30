// ═══════════════════════════════════════════════════════════════════════════════
// STORAGE — GUID-based REST sync
// ═══════════════════════════════════════════════════════════════════════════════

function getOrCreateGuid() {
  const params = new URLSearchParams(window.location.search);
  const urlGuid = params.get("guid");
  if (urlGuid && /^[0-9a-f-]{36}$/.test(urlGuid)) {
    localStorage.setItem("campaign-manager-guid", urlGuid);
    const clean = window.location.pathname + window.location.hash;
    window.history.replaceState({}, "", clean);
    return urlGuid;
  }
  let g = localStorage.getItem("campaign-manager-guid");
  if (!g) {
    g = crypto.randomUUID();
    localStorage.setItem("campaign-manager-guid", g);
  }
  return g;
}

const SESSION_GUID = getOrCreateGuid();
const API_BASE = window.CAMPAIGN_API_BASE || "/api";

async function loadData() {
  try {
    const r = await fetch(`${API_BASE}/campaign/${SESSION_GUID}`);
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(r.status);
    const json = await r.json();
    return json.data || null;
  } catch (e) {
    console.warn("Load failed, falling back to localStorage:", e);
    try {
      const local = localStorage.getItem("campaign-manager-local");
      return local ? JSON.parse(local) : null;
    } catch { return null; }
  }
}

async function saveData(data) {
  try { localStorage.setItem("campaign-manager-local", JSON.stringify(data)); } catch {}
  try {
    await fetch(`${API_BASE}/campaign/${SESSION_GUID}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data }),
    });
  } catch (e) { console.warn("Remote save failed (offline?):", e); }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULT DATA & SCHEMA MIGRATION
// ═══════════════════════════════════════════════════════════════════════════════
const uid = () => crypto.randomUUID();

// v1: original (no version field)
// v2: edges gain .events[], nodes gain .isStart/.isEnd
// v3: pages gain .parentId (null) and .order (integer)
const SCHEMA_VERSION = 3;

function migrateCampaign(data) {
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
    d = {
      ...d,
      pages: (d.pages || []).map((p, i) => ({ parentId: null, order: i, ...p })),
    };
  }

  return { ...d, schemaVersion: SCHEMA_VERSION };
}

function preferredTheme() {
  if (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches) return "materialDark";
  return "materialLight";
}

function defaultCampaign() {
  return {
    id: uid(), name: "New Campaign", theme: preferredTheme(),
    sectionSchema: [
      { id: uid(), name: "Overview", subheaders: ["Background", "Objectives"] },
      { id: uid(), name: "Setup", subheaders: ["Deployment", "Special Rules"] },
      { id: uid(), name: "Rewards", subheaders: ["C-Bills", "XP", "Salvage"] },
    ],
    schemaVersion: SCHEMA_VERSION,
    pages: [], flowchart: { nodes: [], edges: [] },
  };
}
