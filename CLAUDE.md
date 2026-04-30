# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running Locally

```bash
pip install fastapi "uvicorn[standard]"
uvicorn backend:app --reload --port 8000
```

Then open `http://localhost:8000` — the backend serves `campaign-manager.html` as the SPA fallback.

## Deploying to the Cluster

Use `deploy.ps1` (PowerShell, targets the k3s cluster via Flux):

```powershell
.\deploy.ps1
```

This git-pushes, triggers Flux reconciliation, restarts the deployment, and waits for the rollout to finish. CI/CD (GitHub Actions) builds and pushes the Docker image to `ghcr.io/2br-2b/rpgplanner` on every push to `main`.

## Architecture

**No build step.** The frontend is `campaign-manager.html` (shell only) + `js/` (JSX source files) — React 18 + Babel loaded from CDN, all JSX compiled in-browser at runtime. Load order in the HTML matters: `theme.js` → `storage.js` → `io.js` → `sidebar.js` → `editor.js` → `flowchart.js` → `simulator.js` → `settings.js` → `app.js`. Each file depends on globals defined by earlier files.

**Backend** (`backend.py`) is a minimal FastAPI app with a single SQLite database at `/data/campaigns.db`. It stores campaign data as JSON blobs keyed by a client-generated GUID. The same GUID is stored in `localStorage` and can be shared via `?guid=` URL param to sync across devices. The backend also serves `campaign-manager.html` for all non-API routes.

**Data shape**: each campaign lives in `campaign.data` (a JSON column). The frontend has its own schema versioning (`SCHEMA_VERSION`) and migration logic (`migrateCampaign`). **Schema migrations are required** whenever the data shape changes — bump `SCHEMA_VERSION` and add a migration branch in `migrateCampaign` that transforms old data to the new shape. Never assume fields exist; always use safe defaults (`|| []`, `|| {}`, `?? value`) in both migration and render code so old saves load cleanly.

**Persistence flow**: the frontend writes to `localStorage` immediately as a local backup, then async-syncs to `/api/campaign/{guid}` with a debounced 800ms save.

**Sections vs subheaders**: Mission pages have a `sectionSchema` (array of sections, each with `type: "text" | "waypoints"` and optional `subheaders`). Section content is stored in `page.sections[sectionId]` — either a flat string (no subheaders), an object keyed by subheader name, or for waypoints: `{ count: N, waypoints: { A: "...", B: "..." } }`.

**Page tree**: Pages have `parentId` (null for top-level) and `order` (integer, scoped to siblings). Use `getSiblings(pages, parentId)` to get a sorted sibling list. The sidebar renders the tree recursively with indent (→) / unindent (←) and ↑↓ reorder buttons. Deleting a page also deletes all descendants.

## Infrastructure

- Kubernetes namespace: `campaign-manager`
- Deployment name: `campaign-manager`
- Flux HelmRelease and GitSource: `campaign-manager` in `flux-system`
- Ingress: Traefik IngressRoute → `campaign.theboxofwires.com`
- SQLite data persisted via a 1Gi PVC mounted at `/data`
- Helm chart in `./chart/`; image built for `linux/amd64` + `linux/arm64`
