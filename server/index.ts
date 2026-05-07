import Database from "better-sqlite3";
import express, { type ErrorRequestHandler, type RequestHandler } from "express";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MAX_PAYLOAD_MB = 10;
const PORT = Number(process.env.PORT || 8000);
const MAX_SNAPSHOTS_PER_CAMPAIGN = 50;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const distDir = process.env.DIST_DIR || path.join(repoRoot, "dist");
const dataDir = process.env.DATA_DIR || path.join(repoRoot, "data");
const dbPath = process.env.DB_PATH || path.join(dataDir, "campaigns.db");

const saveBodySchema = z.object({
  data: z.record(z.string(), z.unknown()),
});

const shareSettingsSchema = z.object({
  shareEnabled: z.boolean(),
  shareTheme: z.string().optional().default("plain"),
  shareCustomCss: z.string().optional().default(""),
});

const sharePatchSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), sectionId: z.string(), subheader: z.string(), value: z.string() }),
  z.object({ type: z.literal("table"), sectionId: z.string(), rowIndex: z.number().int().nonnegative(), columnId: z.string(), value: z.unknown() }),
  z.object({ type: z.literal("waypoint"), sectionId: z.string(), label: z.string(), value: z.string() }),
]);

const snapshotBodySchema = z.object({
  name: z.string().min(1).max(200),
});

type CampaignRecord = {
  data: Record<string, unknown>;
  updated_at: number;
};

type SnapshotRow = {
  id: string;
  name: string;
  created_at: number;
};

class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS campaigns (
    guid        TEXT PRIMARY KEY,
    data        TEXT NOT NULL,
    updated_at  REAL NOT NULL
  );
  CREATE TABLE IF NOT EXISTS snapshots (
    id            TEXT PRIMARY KEY,
    campaign_guid TEXT NOT NULL,
    name          TEXT NOT NULL,
    data          TEXT NOT NULL,
    created_at    REAL NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_snapshots_guid ON snapshots(campaign_guid);
`);
try { db.exec(`ALTER TABLE campaigns ADD COLUMN share_guid TEXT`); } catch { /* already exists */ }
db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_campaigns_share_guid ON campaigns(share_guid)`);

const selectCampaign = db.prepare("SELECT data, updated_at FROM campaigns WHERE guid = ?");
const selectByShareGuid = db.prepare("SELECT data FROM campaigns WHERE share_guid = ?");
const upsertCampaign = db.prepare(`
  INSERT INTO campaigns (guid, data, updated_at, share_guid) VALUES (?, ?, ?, ?)
  ON CONFLICT(guid) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, share_guid = excluded.share_guid
`);
const setShareGuidStmt = db.prepare("UPDATE campaigns SET share_guid = ? WHERE guid = ?");
const clearShareGuidStmt = db.prepare("UPDATE campaigns SET share_guid = NULL WHERE guid = ?");

const listSnapshotsStmt = db.prepare(
  "SELECT id, name, created_at FROM snapshots WHERE campaign_guid = ? ORDER BY created_at DESC LIMIT 50"
);
const insertSnapshot = db.prepare(
  "INSERT INTO snapshots (id, campaign_guid, name, data, created_at) VALUES (?, ?, ?, ?, ?)"
);
const deleteSnapshotStmt = db.prepare(
  "DELETE FROM snapshots WHERE id = ? AND campaign_guid = ?"
);
const getSnapshotStmt = db.prepare(
  "SELECT data FROM snapshots WHERE id = ? AND campaign_guid = ?"
);
const countSnapshotsStmt = db.prepare(
  "SELECT COUNT(*) as cnt FROM snapshots WHERE campaign_guid = ?"
);

function assertGuid(guid: string): void {
  if (!GUID_RE.test(guid)) throw new HttpError(400, "Invalid GUID format");
}

function getGuidParam(value: string | string[] | undefined): string {
  if (typeof value !== "string") throw new HttpError(400, "Invalid GUID format");
  assertGuid(value);
  return value;
}

const asyncRoute = (handler: RequestHandler): RequestHandler => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

const app = express();

app.disable("x-powered-by");
app.use((_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  next();
});
app.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});
app.use(express.json({ limit: `${MAX_PAYLOAD_MB}mb` }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/campaign/:guid", asyncRoute(async (req, res) => {
  const guid = getGuidParam(req.params.guid);
  const row = selectCampaign.get(guid) as { data: string; updated_at: number } | undefined;
  if (!row) throw new HttpError(404, "Not found");
  const record: CampaignRecord = {
    data: JSON.parse(row.data) as Record<string, unknown>,
    updated_at: row.updated_at,
  };
  res.json(record);
}));

app.put("/api/campaign/:guid", asyncRoute(async (req, res) => {
  const guid = getGuidParam(req.params.guid);
  const parsed = saveBodySchema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, "Request body must be { data: object }");
  const data = parsed.data.data;
  const shareEnabled = data.shareEnabled === true;
  const shareGuid = shareEnabled && typeof data.shareGuid === "string" && GUID_RE.test(data.shareGuid as string)
    ? data.shareGuid as string
    : null;
  upsertCampaign.run(guid, JSON.stringify(data), Date.now() / 1000, shareGuid);
  res.json({ ok: true });
}));

// ── Share routes ──────────────────────────────────────────────────────────────

function filterSectionsForPage(schema: any[], page: any): { filteredSections: Record<string, unknown> } {
  const overrides: Record<string, any> = page.sectionVisibilityOverrides || {};
  const filteredSections: Record<string, unknown> = {};

  for (const sec of schema) {
    const override = overrides[sec.id];
    let sectionVisible: boolean;
    if (typeof override === "boolean") sectionVisible = override;
    else sectionVisible = sec.playerVisible === true;
    if (!sectionVisible) continue;

    const rawData: any = (page.sections || {})[sec.id];

    if (sec.type === "text") {
      const visibleSubheaders: string[] = (sec.subheaders || []).filter((sh: string) => {
        if (typeof override === "object" && override !== null && sh in override) return (override as any)[sh] === true;
        return (sec.playerVisibleSubheaders || []).includes(sh);
      });
      const sectionData: Record<string, unknown> = {};
      if (typeof rawData === "object" && rawData !== null) {
        for (const sh of visibleSubheaders) {
          if (sh in rawData) sectionData[sh] = rawData[sh];
        }
      }
      filteredSections[sec.id] = sectionData;

    } else if (sec.type === "waypoints") {
      if (typeof rawData === "object" && rawData !== null) {
        const visibility: Record<string, boolean> = rawData.waypointVisibility || {};
        const filteredWaypoints: Record<string, string> = {};
        for (const [label, text] of Object.entries(rawData.waypoints || {})) {
          if (visibility[label] !== false) filteredWaypoints[label] = text as string;
        }
        filteredSections[sec.id] = { count: rawData.count, waypoints: filteredWaypoints };
      }

    } else if (sec.type === "table") {
      filteredSections[sec.id] = rawData;
    }
  }

  return { filteredSections };
}

function buildResponseSchema(schema: any[]): any[] {
  return schema
    .filter((sec: any) => sec.playerVisible === true)
    .map((sec: any) => {
      if (sec.type === "text") {
        return { id: sec.id, name: sec.name, type: sec.type, subheaders: sec.playerVisibleSubheaders || [], playerEditable: sec.playerEditable || false };
      }
      if (sec.type === "waypoints") {
        return { id: sec.id, name: sec.name, type: sec.type, playerEditable: sec.playerEditable || false };
      }
      if (sec.type === "table") {
        return { id: sec.id, name: sec.name, type: sec.type, columns: (sec.columns || []).filter((c: any) => c.type !== "formula"), playerEditable: sec.playerEditable || false };
      }
      return { id: sec.id, name: sec.name, type: sec.type, playerEditable: sec.playerEditable || false };
    });
}

function filterCampaignForShare(raw: Record<string, unknown>): Record<string, unknown> | null {
  if (!raw.shareEnabled) return null;
  const schema = (raw.sectionSchema as any[]) || [];
  const pages = (raw.pages as any[]) || [];

  const visiblePages = pages
    .filter((p: any) => p.playerVisible === true)
    .map((page: any) => {
      if (page.type === "free") {
        return { id: page.id, name: page.name, type: page.type, order: page.order, parentId: page.parentId, tags: page.tags || [], content: page.content || "" };
      }
      const { filteredSections } = filterSectionsForPage(schema, page);
      return { id: page.id, name: page.name, type: page.type, order: page.order, parentId: page.parentId, tags: page.tags || [], sections: filteredSections, costs: page.costs || [], awards: page.awards || [] };
    });

  return {
    name: raw.name,
    shareTheme: raw.shareTheme || "plain",
    shareCustomCss: raw.shareCustomCss || "",
    sectionSchema: buildResponseSchema(schema),
    pages: visiblePages,
  };
}

app.get("/api/share/:shareGuid", asyncRoute(async (req, res) => {
  const shareGuid = getGuidParam(req.params.shareGuid);
  const row = selectByShareGuid.get(shareGuid) as { data: string } | undefined;
  if (!row) throw new HttpError(404, "Not found");
  const raw = JSON.parse(row.data) as Record<string, unknown>;
  const filtered = filterCampaignForShare(raw);
  if (!filtered) throw new HttpError(404, "Not found");
  res.json(filtered);
}));

app.put("/api/campaign/:guid/share", asyncRoute(async (req, res) => {
  const guid = getGuidParam(req.params.guid);
  const parsed = shareSettingsSchema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, "Invalid share settings");

  const campaignRow = selectCampaign.get(guid) as { data: string; updated_at: number } | undefined;
  if (!campaignRow) throw new HttpError(404, "Campaign not found — save it first");

  const data = JSON.parse(campaignRow.data) as Record<string, unknown>;
  const { shareEnabled, shareTheme, shareCustomCss } = parsed.data;

  let shareGuid: string | null = (data.shareGuid as string | null) || null;

  if (shareEnabled) {
    if (!shareGuid || !GUID_RE.test(shareGuid)) {
      // Generate a unique share GUID with retry
      shareGuid = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        const candidate = crypto.randomUUID();
        try {
          setShareGuidStmt.run(candidate, guid);
          shareGuid = candidate;
          break;
        } catch (e: any) {
          if (!e.message?.includes("UNIQUE constraint")) throw e;
        }
      }
      if (!shareGuid) throw new HttpError(500, "Failed to generate unique share link");
    }
  } else {
    clearShareGuidStmt.run(guid);
    shareGuid = null;
  }

  const updatedData = { ...data, shareEnabled, shareTheme, shareCustomCss, shareGuid };
  upsertCampaign.run(guid, JSON.stringify(updatedData), Date.now() / 1000, shareEnabled ? shareGuid : null);

  res.json({ ok: true, shareGuid });
}));

app.patch("/api/share/:shareGuid/page/:pageId", asyncRoute(async (req, res) => {
  const shareGuid = getGuidParam(req.params.shareGuid);
  const pageId = req.params.pageId;
  if (typeof pageId !== "string" || !GUID_RE.test(pageId)) throw new HttpError(400, "Invalid page ID");

  const parsed = sharePatchSchema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, "Invalid patch body");

  const campaignRow = selectByShareGuid.get(shareGuid) as { data: string } | undefined;
  if (!campaignRow) throw new HttpError(404, "Not found");

  const data = JSON.parse(campaignRow.data) as Record<string, unknown>;
  if (!data.shareEnabled) throw new HttpError(404, "Not found");

  const pages = (data.pages as any[]) || [];
  const pageIdx = pages.findIndex((p: any) => p.id === pageId);
  if (pageIdx < 0) throw new HttpError(404, "Page not found");

  const page = pages[pageIdx];
  if (page.playerVisible !== true) throw new HttpError(403, "Page not visible");

  const schema = (data.sectionSchema as any[]) || [];
  const patch = parsed.data;
  const sec = schema.find((s: any) => s.id === patch.sectionId);
  if (!sec || !sec.playerEditable) throw new HttpError(403, "Section not editable");

  const overrides = page.sectionVisibilityOverrides || {};
  const override = overrides[patch.sectionId];
  const sectionVisible = typeof override === "boolean" ? override : sec.playerVisible === true;
  if (!sectionVisible) throw new HttpError(403, "Section not visible");

  const sections = { ...(page.sections || {}) };
  const sectionData: any = { ...(sections[patch.sectionId] || {}) };

  if (patch.type === "text") {
    if (!(sec.playerVisibleSubheaders || []).includes(patch.subheader)) throw new HttpError(403, "Subheader not visible");
    sectionData[patch.subheader] = patch.value;
  } else if (patch.type === "table") {
    const rows = [...(sectionData.rows || [])];
    if (patch.rowIndex >= rows.length) throw new HttpError(400, "Row index out of bounds");
    const col = (sec.columns || []).find((c: any) => c.id === patch.columnId);
    if (!col) throw new HttpError(400, "Column not found");
    rows[patch.rowIndex] = { ...rows[patch.rowIndex], [patch.columnId]: patch.value };
    sectionData.rows = rows;
  } else if (patch.type === "waypoint") {
    const waypoints = { ...(sectionData.waypoints || {}) };
    const visibility: Record<string, boolean> = sectionData.waypointVisibility || {};
    if (visibility[patch.label] === false) throw new HttpError(403, "Waypoint not visible");
    waypoints[patch.label] = patch.value;
    sectionData.waypoints = waypoints;
  }

  sections[patch.sectionId] = sectionData;
  pages[pageIdx] = { ...page, sections };
  const updatedData = { ...data, pages };

  // Get the edit guid for this campaign
  const editRow = db.prepare("SELECT guid FROM campaigns WHERE share_guid = ?").get(shareGuid) as { guid: string } | undefined;
  if (!editRow) throw new HttpError(500, "Internal error");
  upsertCampaign.run(editRow.guid, JSON.stringify(updatedData), Date.now() / 1000, shareGuid);

  res.json({ ok: true });
}));

// ── Snapshots ─────────────────────────────────────────────────────────────────

app.get("/api/campaign/:guid/snapshots", asyncRoute(async (req, res) => {
  const guid = getGuidParam(req.params.guid);
  const rows = listSnapshotsStmt.all(guid) as SnapshotRow[];
  res.json({ snapshots: rows });
}));

app.post("/api/campaign/:guid/snapshots", asyncRoute(async (req, res) => {
  const guid = getGuidParam(req.params.guid);
  const parsed = snapshotBodySchema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, "Request body must be { name: string }");

  const campaignRow = selectCampaign.get(guid) as { data: string } | undefined;
  if (!campaignRow) throw new HttpError(404, "Campaign not found — save it first");

  const { cnt } = countSnapshotsStmt.get(guid) as { cnt: number };
  if (cnt >= MAX_SNAPSHOTS_PER_CAMPAIGN) throw new HttpError(400, "Snapshot limit reached (50)");

  const id = crypto.randomUUID();
  insertSnapshot.run(id, guid, parsed.data.name, campaignRow.data, Date.now() / 1000);
  res.json({ ok: true, id });
}));

app.delete("/api/campaign/:guid/snapshots/:snapId", asyncRoute(async (req, res) => {
  const guid = getGuidParam(req.params.guid);
  const snapId = req.params.snapId;
  if (typeof snapId !== "string" || !GUID_RE.test(snapId)) throw new HttpError(400, "Invalid snapshot ID");
  const info = deleteSnapshotStmt.run(snapId, guid);
  if (info.changes === 0) throw new HttpError(404, "Snapshot not found");
  res.json({ ok: true });
}));

app.get("/api/campaign/:guid/snapshots/:snapId", asyncRoute(async (req, res) => {
  const guid = getGuidParam(req.params.guid);
  const snapId = req.params.snapId;
  if (typeof snapId !== "string" || !GUID_RE.test(snapId)) throw new HttpError(400, "Invalid snapshot ID");
  const row = getSnapshotStmt.get(snapId, guid) as { data: string } | undefined;
  if (!row) throw new HttpError(404, "Snapshot not found");
  res.json({ data: JSON.parse(row.data) });
}));

// ─────────────────────────────────────────────────────────────────────────────

app.use(express.static(distDir));

app.get(/.*/, (_req, res) => {
  res.sendFile(path.join(distDir, "index.html"), (error) => {
    if (error) res.status(404).json({ error: "Frontend not found. Run npm run build first." });
  });
});

const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof HttpError) {
    res.status(error.status).json({ detail: error.message });
    return;
  }
  if (error instanceof SyntaxError && "body" in error) {
    res.status(400).json({ detail: "Invalid JSON" });
    return;
  }
  console.error(error);
  res.status(500).json({ detail: "Internal server error" });
};

app.use(errorHandler);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Campaign Manager listening on http://0.0.0.0:${PORT}`);
});
