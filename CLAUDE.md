# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running Locally

```bash
npm install

# Terminal 1 — frontend dev server (Vite, http://localhost:5173)
npm run dev

# Terminal 2 — backend API server (Express, http://localhost:8000)
npm run dev:server
```

The frontend proxies `/api/*` requests to the backend in development. Open `http://localhost:5173`.

To check server TypeScript types:

```bash
npm run typecheck
```

To preview the production build (builds frontend to `dist/` and server to `build/`):

```bash
npm run build
npm start   # runs build/server/index.js, which serves dist/ on port 8000
```

## Deploying to the Cluster

Use `deploy.ps1` (PowerShell, targets the k3s cluster via Flux):

```powershell
.\deploy.ps1
```

This git-pushes, triggers Flux reconciliation, restarts the deployment, and waits for the rollout to finish. CI/CD (GitHub Actions) builds and pushes the Docker image to `ghcr.io/2br-2b/rpgplanner` on every push to `main`.

## Architecture

**Frontend**: React 19 + Vite. Source files live in `src/`. Load order is managed by ES module imports — `main.jsx` is the entry point. The frontend is built into `dist/` for production.

**Backend** (`server/index.ts`) is a minimal Express 5 app with a single SQLite database at `/data/campaigns.db` (built-in `node:sqlite`, WAL mode). It stores campaign data as JSON blobs keyed by a client-generated GUID. The same GUID is stored in `localStorage` and can be shared via `?guid=` URL param to sync across devices. The backend serves the built frontend (`dist/`) for all non-API routes.

**Data shape**: each campaign lives in a `data` TEXT column in SQLite. The frontend has its own schema versioning (`SCHEMA_VERSION` in `storage.js`) and migration logic (`migrateCampaign`). **Schema migrations are required** whenever the data shape changes — bump `SCHEMA_VERSION` and add a migration branch in `migrateCampaign` that transforms old data to the new shape. Never assume fields exist; always use safe defaults (`|| []`, `|| {}`, `?? value`) in both migration and render code so old saves load cleanly.

**Persistence flow**: the frontend writes to `localStorage` immediately as a local backup, then async-syncs to `PUT /api/campaign/{guid}` with a debounced 800ms save (see `saveData` in `storage.js`).

**Sections vs subheaders**: Mission pages have a `sectionSchema` (array of sections, each with `type: "text" | "waypoints" | "table"` and optional `subheaders`). Section content is stored in `page.sections[sectionId]` — either a flat string (no subheaders), an object keyed by subheader name, or for waypoints: `{ count: N, waypoints: { A: "...", B: "..." } }`, or for tables: `{ rows: [...] }`.

**Page types**: Pages are either `type: "mission"` (uses `sections` keyed by sectionId) or `type: "free"` (has a flat `content` string rendered as rich text via Milkdown). Mission pages also carry `costs`, `awards`, `tags`, `playerVisible`, and `sectionVisibilityOverrides`.

**Page tree**: Pages have `parentId` (null for top-level) and `order` (integer, scoped to siblings). Use `getSiblings(pages, parentId)` to get a sorted sibling list. The sidebar renders the tree recursively with indent (→) / unindent (←) and ↑↓ reorder buttons. Deleting a page also deletes all descendants.

**Snapshots**: The backend stores up to 50 named point-in-time snapshots per campaign (`POST /api/campaign/:guid/snapshots`). Restoring a snapshot replaces the current campaign data in the frontend.

## Frontend Source Layout

```
src/
  main.jsx          — React entry point
  app.jsx           — Root component, global state, topbar, routing between views
  sidebar.jsx       — Page tree navigation, add/move/indent/delete pages
  editor.jsx        — OutlineView, PageEditor, MissionSection, CostsAwards
  table-section.jsx — TableSection: row editor, sort/filter, CSV import/export
  waypoints-section.jsx — WaypointsSection: A–ZZ labelled text area grid
  schema-editor.jsx — SchemaEditor, SchemaSectionRow: define section templates
  milkdown-editor.jsx — Milkdown rich-text editor wrapper (used by free pages)
  flowchart.jsx     — SVG node-and-edge flowchart editor
  simulator.jsx     — Monte Carlo campaign simulator
  settings.jsx      — Settings UI and campaign stats
  io.jsx            — Import/Export modal (JSON and Markdown)
  storage.js        — GUID persistence, loadData/saveData, migrateCampaign
  theme.js          — 14 theme definitions, makeCSS(), useTheme(), useThemeCSS()
  theme-test.jsx    — Side-by-side theme comparison page (served at /themes)
  markdown.js       — Minimal markdown → HTML renderer
```

**Theme system**: Themes are plain objects in `THEMES` (theme.js) with color/font/radius fields. `makeCSS(T)` returns a JS style-object map (`btn`, `input`, `section`, etc.). Skeuomorphic themes (parchment, chalkboard, corkboard, blueprint, newspaper, battletech) also have companion CSS files (`theme-*.css`) that apply `!important` rules to `button` elements inside `.sk-main`/`.sk-section` for texture effects. **When rendering theme-picker chips, use `<div role="button">` instead of `<button>` so the skeuomorphic CSS selectors don't override the chip's own inline styles.**

## Infrastructure

- Kubernetes namespace: `campaign-manager`
- Deployment name: `campaign-manager`
- Flux HelmRelease and GitSource: `campaign-manager` in `flux-system`
- Ingress: Traefik IngressRoute → `campaign.theboxofwires.com`
- SQLite data persisted via a 1Gi PVC mounted at `/data`
- Helm chart in `./chart/`; image built for `linux/amd64` + `linux/arm64`
