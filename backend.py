"""
Campaign Manager sync backend.
Stores one JSON blob per GUID in SQLite.

Run:  uvicorn backend:app --host 0.0.0.0 --port 8000
Deps: pip install fastapi uvicorn[standard]
"""

import sqlite3, json, re, time
from pathlib import Path
from contextlib import contextmanager
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from pydantic import BaseModel

DB_PATH = Path("/data/campaigns.db")
STATIC_DIR = Path("/app/static")          # put campaign-manager.html here
GUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
MAX_PAYLOAD_MB = 10

app = FastAPI(title="Campaign Manager Sync")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # tighten to your domain in production
    allow_methods=["GET", "PUT", "OPTIONS"],
    allow_headers=["*"],
)


# ── Database ──────────────────────────────────────────────────────────────────

def init_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(DB_PATH) as con:
        con.execute("""
            CREATE TABLE IF NOT EXISTS campaigns (
                guid        TEXT PRIMARY KEY,
                data        TEXT NOT NULL,
                updated_at  REAL NOT NULL
            )
        """)

@contextmanager
def db():
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    try:
        yield con
        con.commit()
    finally:
        con.close()

init_db()


# ── Helpers ───────────────────────────────────────────────────────────────────

def validate_guid(guid: str):
    if not GUID_RE.match(guid):
        raise HTTPException(status_code=400, detail="Invalid GUID format")


# ── API routes ────────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {"ok": True}


@app.get("/api/campaign/{guid}")
def load_campaign(guid: str):
    validate_guid(guid)
    with db() as con:
        row = con.execute("SELECT data, updated_at FROM campaigns WHERE guid = ?", (guid,)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Not found")
    return {"data": json.loads(row["data"]), "updated_at": row["updated_at"]}


class SaveBody(BaseModel):
    data: dict

@app.put("/api/campaign/{guid}")
async def save_campaign(guid: str, request: Request, body: SaveBody):
    validate_guid(guid)
    # Rough size check before SQLite write
    raw = await request.body()
    if len(raw) > MAX_PAYLOAD_MB * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"Payload too large (max {MAX_PAYLOAD_MB}MB)")
    with db() as con:
        con.execute(
            "INSERT INTO campaigns (guid, data, updated_at) VALUES (?, ?, ?)"
            " ON CONFLICT(guid) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at",
            (guid, json.dumps(body.data), time.time()),
        )
    return {"ok": True}


# ── Static file serving ───────────────────────────────────────────────────────
# Serves campaign-manager.html for all non-API routes so the SPA handles routing

@app.get("/{full_path:path}")
def spa_fallback(full_path: str):
    index = STATIC_DIR / "campaign-manager.html"
    if index.exists():
        return FileResponse(index)
    return JSONResponse({"error": "Frontend not found. Copy campaign-manager.html to /app/static/"}, status_code=404)
