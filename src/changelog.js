// Changelog logic for the What's New popup.
//
// IMPORTANT FOR LLM CONTRIBUTORS: Do NOT edit src/changelog.json directly.
// Run this instead:
//   node scripts/add-changelog.js --id <slug> --title <title> --description <desc> --priority <1-10>

import CHANGELOG_DATA from "./changelog.json";

/** @type {Array<{id:string, date:string, title:string, description:string, priority:number}>} */
export const CHANGELOG = CHANGELOG_DATA;

// Sorted newest-first, then by priority descending for same-date entries.
export const CHANGELOG_SORTED = [...CHANGELOG].sort((a, b) => {
  const dateDiff = b.date.localeCompare(a.date);
  return dateDiff !== 0 ? dateDiff : b.priority - a.priority;
});

// The N highest-priority entries shown in the compact popup.
export const COMPACT_LIMIT = 10;

export function getCompactEntries() {
  return [...CHANGELOG_SORTED]
    .sort((a, b) => b.priority - a.priority)
    .slice(0, COMPACT_LIMIT);
}

// Returns only entries newer than the last-seen marker (high-water-mark).
export function getUnseenEntries() {
  const seen = localStorage.getItem(CHANGELOG_SEEN_KEY);
  if (!seen) return CHANGELOG_SORTED;
  const idx = CHANGELOG_SORTED.findIndex(e => e.id === seen);
  if (idx === -1) return CHANGELOG_SORTED;
  return CHANGELOG_SORTED.slice(0, idx);
}

// localStorage key that stores the id of the last changelog entry the user saw.
export const CHANGELOG_SEEN_KEY = "campaign-manager-changelog-seen";

// Returns true when the user has never seen the app at all (first visit).
export function isFirstVisit() {
  return localStorage.getItem(CHANGELOG_SEEN_KEY) === null;
}

// Returns true when there are unseen entries since the user last dismissed.
export function hasUnseenChanges() {
  const seen = localStorage.getItem(CHANGELOG_SEEN_KEY);
  if (!seen) return true; // first visit
  return CHANGELOG_SORTED.length > 0 && CHANGELOG_SORTED[0].id !== seen;
}

// Mark the most-recent entry as seen.
export function markChangelogSeen() {
  if (CHANGELOG_SORTED.length > 0) {
    localStorage.setItem(CHANGELOG_SEEN_KEY, CHANGELOG_SORTED[0].id);
  }
}
