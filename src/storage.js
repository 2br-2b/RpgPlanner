export const uid = () => crypto.randomUUID();

// v1: original (no version field)
// v2: edges gain .events[], nodes gain .isStart/.isEnd
// v3: pages gain .parentId (null) and .order (integer)
// v4: sectionSchema entries gain .type ("text" | "waypoints")
export const SCHEMA_VERSION = 4;

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
  try { localStorage.setItem("campaign-manager-local", JSON.stringify(data)); } catch {}
  try {
    await fetch(`${API_BASE}/campaign/${SESSION_GUID}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data }),
    });
  } catch (e) { console.warn("Remote save failed (offline?):", e); }
}
