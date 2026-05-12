// Migration invariant tests — run client-side after every migrateCampaign call.
// runMigrationTests(before, after) returns { ok: boolean, failures: string[] }.
// These are the ground-truth rules that every migration must satisfy. When adding
// a new schema version, add any additional invariants here that the new version
// must preserve, then verify with: npm run test:migration -- <path-to-fixture.json>

export function runMigrationTests(before, after) {
  const failures = [];

  const check = (condition, message) => {
    if (!condition) failures.push(message);
  };

  // ── Structural basics ────────────────────────────────────────────────────────

  check(after && typeof after === "object", "Output must be an object");
  if (!after || typeof after !== "object") return { ok: false, failures };

  check(typeof after.schemaVersion === "number", "schemaVersion must be a number");
  check(Array.isArray(after.pages), "pages must be an array");
  check(Array.isArray(after.pageTypes), "pageTypes must be an array");
  check(after.flowchart && Array.isArray(after.flowchart.nodes), "flowchart.nodes must be an array");
  check(after.flowchart && Array.isArray(after.flowchart.edges), "flowchart.edges must be an array");

  // ── No pages lost ────────────────────────────────────────────────────────────

  const beforePages = before.pages || [];
  const afterPages = after.pages || [];
  const afterPageIds = new Set(afterPages.map(p => p.id));

  for (const p of beforePages) {
    check(afterPageIds.has(p.id), `Page "${p.name}" (id: ${p.id}) was lost during migration`);
  }

  // ── No section content lost ──────────────────────────────────────────────────

  for (const beforePage of beforePages) {
    const afterPage = afterPages.find(p => p.id === beforePage.id);
    if (!afterPage) continue; // already caught above

    // v11+ pages store content in sections; pre-v11 may have page.content (free pages)
    const beforeSections = beforePage.sections || {};
    const afterSections = afterPage.sections || {};

    for (const [secId, val] of Object.entries(beforeSections)) {
      if (!hasContent(val)) continue;
      // Content must appear somewhere in afterSections — either same key or migrated
      const found = Object.values(afterSections).some(v => contentOverlaps(val, v));
      check(found, `Page "${beforePage.name}": section content for key "${secId}" was lost`);
    }

    // Pre-v11 free page: page.content must survive
    if (typeof beforePage.content === "string" && beforePage.content.trim()) {
      const anySection = Object.values(afterSections).some(v =>
        typeof v === "string" && v.trim() === beforePage.content.trim()
      );
      check(anySection, `Page "${beforePage.name}": free-page content was lost during migration`);
    }
  }

  // ── Every page has a valid type ──────────────────────────────────────────────

  const typeIds = new Set((after.pageTypes || []).map(t => t.id));
  for (const p of afterPages) {
    check(
      typeof p.type === "string" && typeIds.has(p.type),
      `Page "${p.name}" has invalid/missing type "${p.type}"`
    );
  }

  // ── Every page type has required fields ─────────────────────────────────────

  for (const pt of after.pageTypes || []) {
    check(typeof pt.id === "string" && pt.id.length > 0, `A page type is missing an id`);
    check(typeof pt.name === "string" && pt.name.length > 0, `Page type ${pt.id} is missing a name`);
    check(Array.isArray(pt.sectionSchema), `Page type "${pt.name}" sectionSchema must be an array`);
  }

  // ── No undefined values survive JSON round-trip ──────────────────────────────

  try {
    const json = JSON.stringify(after);
    check(typeof json === "string", "Output must be JSON-serializable");
    const reparsed = JSON.parse(json);
    check(reparsed.pages.length === afterPages.length, "Page count changed after JSON round-trip");
  } catch (e) {
    failures.push(`JSON serialization failed: ${e.message}`);
  }

  // ── Flowchart integrity ──────────────────────────────────────────────────────

  const afterNodeIds = new Set((after.flowchart?.nodes || []).map(n => n.id));
  for (const edge of after.flowchart?.edges || []) {
    check(afterNodeIds.has(edge.from), `Flowchart edge references missing node "${edge.from}"`);
    check(afterNodeIds.has(edge.to), `Flowchart edge references missing node "${edge.to}"`);
  }

  // ── v13 timestamp objects ────────────────────────────────────────────────────

  if ((after.schemaVersion || 0) >= 13) {
    check(
      after.fieldTimestamps !== null && typeof after.fieldTimestamps === "object" && !Array.isArray(after.fieldTimestamps),
      "campaign.fieldTimestamps must be a plain object"
    );
    for (const p of afterPages) {
      check(
        p.sectionTimestamps !== null && typeof p.sectionTimestamps === "object" && !Array.isArray(p.sectionTimestamps),
        `Page "${p.name}" must have sectionTimestamps as a plain object`
      );
    }
    if (after.flowchart) {
      check(
        typeof after.flowchart.nodeTimestamps === "object" && !Array.isArray(after.flowchart.nodeTimestamps),
        "flowchart.nodeTimestamps must be a plain object"
      );
      check(
        typeof after.flowchart.edgeTimestamps === "object" && !Array.isArray(after.flowchart.edgeTimestamps),
        "flowchart.edgeTimestamps must be a plain object"
      );
    }
    // Migration must not fabricate timestamps — all objects must be empty after migration
    const beforeVersion = before.schemaVersion || 1;
    if (beforeVersion < 13) {
      check(
        Object.keys(after.fieldTimestamps || {}).length === 0,
        "fieldTimestamps must be empty after v13 migration (no fabricated timestamps)"
      );
      for (const p of afterPages) {
        const beforePage = (before.pages || []).find(bp => bp.id === p.id);
        if (!beforePage || !beforePage.sectionTimestamps) {
          check(
            Object.keys(p.sectionTimestamps || {}).length === 0,
            `Page "${p.name}" sectionTimestamps must be empty after v13 migration`
          );
        }
      }
    }
  }

  return { ok: failures.length === 0, failures };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function hasContent(val) {
  if (!val) return false;
  if (typeof val === "string") return val.trim().length > 0;
  if (Array.isArray(val)) return val.length > 0;
  if (typeof val === "object") {
    return Object.values(val).some(v => hasContent(v));
  }
  return false;
}

function contentOverlaps(before, after) {
  // Checks that the meaningful content in `before` is also present in `after`.
  // For strings: exact match. For objects: all non-empty subkeys must match.
  if (!hasContent(before)) return true; // nothing to preserve
  if (typeof before === "string") return typeof after === "string" && after.trim() === before.trim();
  if (typeof before === "object" && typeof after === "object" && before !== null && after !== null) {
    return Object.entries(before).every(([k, v]) => !hasContent(v) || contentOverlaps(v, after[k]));
  }
  return false;
}
