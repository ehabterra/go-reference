// Personal text highlights, kept in localStorage and surfaced on /highlights/.
// One record per highlight in a single object, keyed by id:
//   dp-highlights = { [id]: {
//     id, page, title, text, prefix, suffix, start, end, color, created, u, del
//   } }
// `page` is the path (e.g. "/fundamentals/slices"); `start`/`end` are character
// offsets into the page's prose text and `text`/`prefix`/`suffix` re-anchor the
// mark even if those offsets drift between builds. Deletes leave a tombstone
// ({ del: true, u }) so the cross-device sync can propagate a removal — the
// reading views filter tombstones out. `u` is the update time (ms), the
// last-write-wins clock the /api/state sync compares (same as the review/streak).
export const HL_KEY = 'dp-highlights';
export const HL_COLORS = ['yellow', 'green', 'pink', 'blue'];
const MAX_TEXT = 1200; // a highlight is a passage, not a chapter

export function loadHighlights() {
  try {
    return JSON.parse(localStorage.getItem(HL_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

export function saveHighlights(state) {
  try {
    localStorage.setItem(HL_KEY, JSON.stringify(state));
  } catch {}
}

export function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* Store (or replace) a highlight. Returns the saved record. */
export function putHighlight(rec, now = Date.now()) {
  const state = loadHighlights();
  const full = { ...rec, text: (rec.text || '').slice(0, MAX_TEXT), u: now };
  if (!full.created) full.created = now;
  delete full.del;
  state[full.id] = full;
  saveHighlights(state);
  return full;
}

/* Tombstone a highlight so the removal syncs; keep created for ordering. */
export function removeHighlight(id, now = Date.now()) {
  const state = loadHighlights();
  if (!state[id]) return;
  state[id] = { id, del: true, u: now };
  saveHighlights(state);
}

/* Live highlights (tombstones dropped), newest first. */
export function listHighlights() {
  return Object.values(loadHighlights())
    .filter((h) => h && !h.del && h.id)
    .sort((a, b) => (b.created || 0) - (a.created || 0));
}

export function highlightsForPage(page) {
  return listHighlights().filter((h) => h.page === page);
}

export function clearHighlights(now = Date.now()) {
  const state = loadHighlights();
  for (const id of Object.keys(state)) {
    if (!state[id]?.del) state[id] = { id, del: true, u: now };
  }
  saveHighlights(state);
}
