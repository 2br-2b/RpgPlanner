#!/usr/bin/env node
// Usage:
//   node scripts/add-changelog.js --id <slug> --title <title> --description <desc> --priority <1-10> [--date <YYYY-MM-DD>]
//
// Appends a new entry to src/changelog.json.
// LLMs: use this script instead of editing changelog.json directly.
// Only add entries for changes users will notice. Skip refactors, build
// tooling, dependency bumps, and other internal changes. If a technical
// change has a visible effect (faster load, fixed crash), describe the
// effect — not the implementation. Write descriptions for end users.

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const CHANGELOG_PATH = resolve(__dir, "../src/changelog.json");

const args = process.argv.slice(2);
const get = (flag) => {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : null;
};

const id          = get("--id");
const title       = get("--title");
const description = get("--description");
const priority    = get("--priority");
const date        = get("--date") ?? new Date().toISOString().slice(0, 10);

if (!id || !title || !description || !priority) {
  console.error("Usage: node scripts/add-changelog.js --id <slug> --title <title> --description <desc> --priority <1-10> [--date <YYYY-MM-DD>]");
  process.exit(1);
}

const priorityNum = Number(priority);
if (!Number.isInteger(priorityNum) || priorityNum < 1 || priorityNum > 10) {
  console.error("--priority must be an integer between 1 and 10");
  process.exit(1);
}

const entries = JSON.parse(readFileSync(CHANGELOG_PATH, "utf8"));

if (entries.some(e => e.id === id)) {
  console.error(`Error: id "${id}" already exists in changelog.json`);
  process.exit(1);
}

entries.unshift({ id, date, title, description, priority: priorityNum });

writeFileSync(CHANGELOG_PATH, JSON.stringify(entries, null, 2) + "\n", "utf8");
console.log(`Added "${title}" (${id}) with priority ${priorityNum} on ${date}`);
