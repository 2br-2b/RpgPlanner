import Database from "better-sqlite3";
import express, { type ErrorRequestHandler, type RequestHandler } from "express";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MAX_PAYLOAD_MB = 10;
const PORT = Number(process.env.PORT || 8000);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const distDir = process.env.DIST_DIR || path.join(repoRoot, "dist");
const dataDir = process.env.DATA_DIR || path.join(repoRoot, "data");
const dbPath = process.env.DB_PATH || path.join(dataDir, "campaigns.db");

const saveBodySchema = z.object({
  data: z.record(z.string(), z.unknown()),
});

type CampaignRecord = {
  data: Record<string, unknown>;
  updated_at: number;
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
  )
`);

const selectCampaign = db.prepare("SELECT data, updated_at FROM campaigns WHERE guid = ?");
const upsertCampaign = db.prepare(`
  INSERT INTO campaigns (guid, data, updated_at) VALUES (?, ?, ?)
  ON CONFLICT(guid) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
`);

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
  res.setHeader("Access-Control-Allow-Methods", "GET,PUT,OPTIONS");
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
  upsertCampaign.run(guid, JSON.stringify(parsed.data.data), Date.now() / 1000);
  res.json({ ok: true });
}));

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
