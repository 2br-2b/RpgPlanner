#!/usr/bin/env node
// Generates public/licenses.json — the license metadata for every production
// (shipped) npm dependency, including transitive ones. Run after dependency
// changes:  node scripts/gen-licenses.js
//
// It lives in public/ (served statically, fetched on demand by the Credits
// section in Settings) so its full license texts never bloat the JS bundle.
// devDependencies (build tooling that never reaches the browser) are excluded.

import { execSync } from "node:child_process";
import { readFileSync, existsSync, readdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT = join(root, "public", "licenses.json");
const LICENSE_FILE_RE = /^(LICENSE|LICENCE|COPYING)(\..*)?$/i;
const MAX_LICENSE_CHARS = 8000; // keep the bundle reasonable; truncate huge texts

// Collect the unique set of production package names from the npm tree.
function collectNames() {
  // `npm ls` exits non-zero on benign tree discrepancies (extraneous/peer
  // warnings) while still printing valid JSON to stdout, so read stdout even
  // when it "fails" rather than letting the build die.
  let out;
  try {
    out = execSync("npm ls --omit=dev --all --json", { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  } catch (e) {
    out = e.stdout;
    if (!out) throw e;
  }
  const json = JSON.parse(out);
  const names = new Set();
  const walk = (deps) => {
    for (const [name, info] of Object.entries(deps || {})) {
      names.add(name);
      if (info.dependencies) walk(info.dependencies);
    }
  };
  walk(json.dependencies);
  return [...names];
}

function readLicenseText(pkgDir) {
  const file = readdirSync(pkgDir).find((f) => LICENSE_FILE_RE.test(f));
  if (!file) return null;
  let text = readFileSync(join(pkgDir, file), "utf8").trim();
  if (text.length > MAX_LICENSE_CHARS) text = text.slice(0, MAX_LICENSE_CHARS) + "\n\n… (truncated)";
  return text;
}

function licenseId(pkg) {
  if (typeof pkg.license === "string") return pkg.license;
  if (pkg.license && typeof pkg.license === "object") return pkg.license.type || "Unknown";
  if (Array.isArray(pkg.licenses)) return pkg.licenses.map((l) => l.type).filter(Boolean).join(" / ");
  return "Unknown";
}

function authorString(pkg) {
  const a = pkg.author;
  if (!a) return null;
  if (typeof a === "string") return a;
  return [a.name, a.email && `<${a.email}>`].filter(Boolean).join(" ") || null;
}

function entryFor(name) {
  const pkgDir = join(root, "node_modules", name);
  const pkgJson = join(pkgDir, "package.json");
  if (!existsSync(pkgJson)) return null;
  const pkg = JSON.parse(readFileSync(pkgJson, "utf8"));
  return {
    name,
    version: pkg.version || "",
    license: licenseId(pkg),
    author: authorString(pkg),
    homepage: pkg.homepage || (pkg.repository && (pkg.repository.url || pkg.repository)) || null,
    licenseText: readLicenseText(pkgDir),
  };
}

const entries = collectNames()
  .map(entryFor)
  .filter(Boolean)
  .sort((a, b) => a.name.localeCompare(b.name));

writeFileSync(OUT, JSON.stringify(entries, null, 2) + "\n");
console.log(`Wrote ${entries.length} license entries to ${OUT}`);
