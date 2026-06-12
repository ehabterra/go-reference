// Spaced-repetition schedule for learned pages (Leitner-style), shared by
// progress.js (due count on the hub, learn/unlearn hooks) and review.js (the
// /review/ session). One record per page in localStorage:
//   dp-review = { [slug]: { b: <box 0..4>, d: <due timestamp ms> } }
// Answering a page's questions correctly moves it up a box (longer gap);
// missing sends it back to box 0 (due tomorrow).
export const REVIEW_KEY = 'dp-review';
export const INTERVAL_DAYS = [1, 3, 7, 21, 60];
const DAY = 86_400_000;

export function loadReview() {
  try {
    return JSON.parse(localStorage.getItem(REVIEW_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

export function saveReview(state) {
  try {
    localStorage.setItem(REVIEW_KEY, JSON.stringify(state));
  } catch {}
}

/* A page just marked learned: first recall lands tomorrow. (`u` is the
   update timestamp the cross-device sync compares for last-write-wins.) */
export function scheduleNew(state, slug, now = Date.now()) {
  if (!state[slug]) state[slug] = { b: 0, d: now + INTERVAL_DAYS[0] * DAY, u: now };
}

export function dropSlug(state, slug) {
  delete state[slug];
}

/* Pages learned before this feature (or synced from another device) have no
   record yet — they become due immediately. Returns true if state changed. */
export function seed(state, slugs, now = Date.now()) {
  let changed = false;
  for (const s of slugs) {
    if (!state[s]) {
      state[s] = { b: 0, d: now, u: now };
      changed = true;
    }
  }
  return changed;
}

export function dueSlugs(state, slugs, now = Date.now()) {
  return slugs.filter((s) => state[s] && state[s].d <= now);
}

/* The earliest upcoming due time among the given slugs, or null. */
export function nextDue(state, slugs) {
  let min = null;
  for (const s of slugs) {
    const rec = state[s];
    if (rec && (min === null || rec.d < min)) min = rec.d;
  }
  return min;
}

export function applyResult(state, slug, correct, now = Date.now()) {
  const prev = state[slug] || { b: 0, d: 0 };
  const b = correct ? Math.min(prev.b + 1, INTERVAL_DAYS.length - 1) : 0;
  state[slug] = { b, d: now + INTERVAL_DAYS[b] * DAY, u: now };
}
