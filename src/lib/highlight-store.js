// Personal text highlights, kept in localStorage and surfaced on /highlights/.
// One record per highlight in a single object, keyed by id:
//   dp-highlights = { [id]: {
//     id, page, title, text, prefix, suffix, start, end, color, note, created, u, del
//   } }
// `page` is the path (e.g. "/fundamentals/slices"); `start`/`end` are character
// offsets into the page's prose text and `text`/`prefix`/`suffix` re-anchor the
// mark even if those offsets drift between builds. `note` is an optional personal
// annotation the reader attaches to the passage (your own margin note). Deletes
// leave a tombstone ({ del: true, u }) so the cross-device sync can propagate a
// removal — the reading views filter tombstones out. `u` is the update time (ms),
// the last-write-wins clock the /api/state sync compares (same as review/streak);
// recolouring or editing a note bumps `u` so the change syncs like any other.
export const HL_KEY = 'dp-highlights';
export const HL_COLORS = ['yellow', 'green', 'pink', 'blue'];
const MAX_TEXT = 1200; // a highlight is a passage, not a chapter
const MAX_NOTE = 2000; // a note is a margin annotation, not an essay

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
  const note = (full.note || '').slice(0, MAX_NOTE).trim();
  if (note) full.note = note;
  else delete full.note; // never persist an empty note
  delete full.del;
  state[full.id] = full;
  saveHighlights(state);
  return full;
}

/* Attach / edit / clear a highlight's personal note in place — text, colour and
   anchors are untouched, only `note` (and the `u` sync clock) change. Returns the
   saved record, or null if the highlight is gone (or already a tombstone). */
export function setHighlightNote(id, note, now = Date.now()) {
  const state = loadHighlights();
  const h = state[id];
  if (!h || h.del) return null;
  const clean = (note || '').slice(0, MAX_NOTE).trim();
  if (clean) h.note = clean;
  else delete h.note;
  h.u = now;
  saveHighlights(state);
  return h;
}

/* Recolour a highlight in place. Returns the saved record, or null if gone. */
export function setHighlightColor(id, color, now = Date.now()) {
  const state = loadHighlights();
  const h = state[id];
  if (!h || h.del || !HL_COLORS.includes(color)) return null;
  h.color = color;
  h.u = now;
  saveHighlights(state);
  return h;
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
