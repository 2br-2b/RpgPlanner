#!/usr/bin/env node
// Migration test runner — CLI tool for LLMs and developers.
// Usage: node scripts/test-migration.js <path-to-campaign.json>
//
// Loads the JSON file, applies all schema migrations, runs the invariant
// tests from src/migration-tests.js, and exits 0 on success or 1 on failure.
//
// Run this before committing any new schema version. See CLAUDE.md for details.

import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";

const fixturePath = process.argv[2];
if (!fixturePath) {
  console.error("Usage: node scripts/test-migration.js <path-to-campaign.json>");
  process.exit(1);
}

let fixture;
try {
  fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
} catch (e) {
  console.error(`Failed to read/parse fixture: ${e.message}`);
  process.exit(1);
}

// Import via file URL so Node resolves the ESM graph correctly from the repo root.
const repoRoot = path.resolve(path.dirname(process.argv[1]), "..");
const storageUrl = pathToFileURL(path.join(repoRoot, "src", "storage.js")).href;
const testsUrl   = pathToFileURL(path.join(repoRoot, "src", "migration-tests.js")).href;

// storage.js references `window` and `localStorage` (browser globals) — stub them.
globalThis.window = {
  matchMedia: () => ({ matches: false }),
  location: { search: "", pathname: "/", hash: "" },
  history: { replaceState: () => {}, pushState: () => {} },
  CAMPAIGN_API_BASE: undefined,
};
globalThis.localStorage = {
  _store: {},
  getItem(k) { return this._store[k] ?? null; },
  setItem(k, v) { this._store[k] = String(v); },
  removeItem(k) { delete this._store[k]; },
};
// Node 25+ has crypto as a read-only built-in; only set if truly missing
if (typeof globalThis.crypto === "undefined") {
  const { webcrypto } = await import("node:crypto");
  Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });
}

const { migrateCampaign, SCHEMA_VERSION } = await import(storageUrl);
const { runMigrationTests } = await import(testsUrl);

const fromVersion = fixture.schemaVersion || 1;
console.log(`\nTesting migration: v${fromVersion} → v${SCHEMA_VERSION}`);
console.log(`Fixture: ${fixturePath}`);
console.log(`Pages: ${(fixture.pages || []).length}, PageTypes: ${(fixture.pageTypes || fixture.sectionSchema) ? "present" : "absent"}\n`);

let after;
try {
  // Run migrations without the invariant gate so we can see the output even if tests fail
  after = migrateCampaign(fixture, { skipTests: true });
} catch (e) {
  console.error(`Migration threw an unexpected error: ${e.message}`);
  process.exit(1);
}

const { ok, failures } = runMigrationTests(fixture, after);

if (ok) {
  console.log("✅  PASS — all invariants satisfied");
  process.exit(0);
} else {
  console.error(`❌  FAIL — ${failures.length} invariant check(s) failed:\n`);
  for (const f of failures) console.error(`   • ${f}`);
  console.error("");
  process.exit(1);
}
