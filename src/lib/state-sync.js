// Cross-device sync for the review schedule, the streak and the resume
// pointer, via /api/state — a per-visitor key-value store with
// last-write-wins per key (the learned set keeps its own union-merge sync).
// Keys: review:<slug>, streak, last. No email → everything stays local.
import { userEmail, visitorHash } from './visitor';
import { loadReview, saveReview } from './review-store';
import { loadStreak, adoptStreak } from './streak-store';
import { loadChallenges, saveChallenges } from './challenge-store';
import { loadHighlights, saveHighlights } from './highlight-store';

const LAST_KEY = 'dp-last';

export async function pushState(items) {
  const email = userEmail();
  if (!email || !items.length) return;
  try {
    const visitor = await visitorHash(email);
    fetch('/api/state', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ visitor, items }),
    }).catch(() => {});
  } catch {}
}

export function reviewItems(review, slugs) {
  return slugs
    .filter((s) => review[s])
    .map((s) => ({ k: `review:${s}`, v: JSON.stringify(review[s]), u: review[s].u || 0 }));
}

export function streakItem(s) {
  return { k: 'streak', v: JSON.stringify(s), u: s.u || 0 };
}

export function lastItem(rec) {
  return { k: 'last', v: JSON.stringify(rec), u: rec.when || 0 };
}

export function chalItem(id, rec) {
  return { k: `chal:${id}`, v: JSON.stringify(rec), u: rec.u || 0 };
}

/* A text highlight (or its tombstone) — one key per highlight id. */
export function hlItem(rec) {
  return { k: `hl:${rec.id}`, v: JSON.stringify(rec), u: rec.u || 0 };
}

/* Pull the server copy, adopt whatever is newer there, push whatever is
   newer here. Fires dp:progress / dp:streak / dp:last so visible widgets
   (review card, streak chip, resume card) repaint with merged data. */
export async function syncState() {
  const email = userEmail();
  if (!email) return;
  let items;
  try {
    const visitor = await visitorHash(email);
    const res = await fetch('/api/state?visitor=' + visitor);
    if (!res.ok) return;
    items = (await res.json()).items || [];
  } catch {
    return;
  }
  const server = new Map(items.map((it) => [it.k, it]));
  const toPush = [];

  // review records, last-write-wins per slug
  const review = loadReview();
  let reviewChanged = false;
  for (const [k, it] of server) {
    if (!k.startsWith('review:')) continue;
    let v;
    try { v = JSON.parse(it.v); } catch { continue; }
    const slug = k.slice('review:'.length);
    if (!review[slug] || (it.u || 0) > (review[slug].u || 0)) {
      review[slug] = v;
      reviewChanged = true;
    }
  }
  const newerHere = Object.keys(review).filter((s) => {
    const it = server.get(`review:${s}`);
    return !it || (review[s].u || 0) > (it.u || 0);
  });
  if (reviewChanged) saveReview(review);
  toPush.push(...reviewItems(review, newerHere));

  // solved challenges: solving is permanent, so LWW per key acts as a union
  const chal = loadChallenges();
  let chalChanged = false;
  for (const [k, it] of server) {
    if (!k.startsWith('chal:')) continue;
    let v;
    try { v = JSON.parse(it.v); } catch { continue; }
    const cid = k.slice('chal:'.length);
    if (!chal[cid]) {
      chal[cid] = v;
      chalChanged = true;
    }
  }
  for (const cid of Object.keys(chal)) {
    if (!server.has(`chal:${cid}`)) toPush.push(chalItem(cid, chal[cid]));
  }
  if (chalChanged) {
    saveChallenges(chal);
    window.dispatchEvent(new CustomEvent('dp:chal', { detail: {} }));
  }

  // text highlights: last-write-wins per id, tombstones included so a removal
  // on one device propagates as a delete to the others
  const hl = loadHighlights();
  let hlChanged = false;
  for (const [k, it] of server) {
    if (!k.startsWith('hl:')) continue;
    let v;
    try { v = JSON.parse(it.v); } catch { continue; }
    const id = k.slice('hl:'.length);
    if (!hl[id] || (it.u || 0) > (hl[id].u || 0)) {
      hl[id] = v;
      hlChanged = true;
    }
  }
  for (const id of Object.keys(hl)) {
    const it = server.get(`hl:${id}`);
    if (!it || (hl[id].u || 0) > (it.u || 0)) toPush.push(hlItem(hl[id]));
  }
  if (hlChanged) {
    saveHighlights(hl);
    window.dispatchEvent(new CustomEvent('dp:highlights', { detail: {} }));
  }

  // streak: adopt the newer record, never lose the better "best"
  const localStreak = loadStreak();
  const sIt = server.get('streak');
  let serverStreak = null;
  if (sIt) {
    try { serverStreak = JSON.parse(sIt.v); } catch {}
  }
  if (serverStreak && (sIt.u || 0) > (localStreak.u || 0)) {
    const merged = { ...serverStreak, b: Math.max(serverStreak.b || 0, localStreak.b || 0) };
    adoptStreak(merged);
    if (merged.b !== (serverStreak.b || 0)) {
      merged.u = Date.now();
      adoptStreak(merged);
      toPush.push(streakItem(merged));
    }
  } else if ((localStreak.u || 0) > (sIt?.u || 0)) {
    toPush.push(streakItem(localStreak));
  }

  // resume pointer: latest visit anywhere wins
  let localLast = null;
  try { localLast = JSON.parse(localStorage.getItem(LAST_KEY) || 'null'); } catch {}
  const lIt = server.get('last');
  let serverLast = null;
  if (lIt) {
    try { serverLast = JSON.parse(lIt.v); } catch {}
  }
  if (serverLast && (lIt.u || 0) > (localLast?.when || 0)) {
    try { localStorage.setItem(LAST_KEY, JSON.stringify(serverLast)); } catch {}
    window.dispatchEvent(new CustomEvent('dp:last', { detail: serverLast }));
  } else if (localLast && (localLast.when || 0) > (lIt?.u || 0)) {
    toPush.push(lastItem(localLast));
  }

  if (toPush.length) pushState(toPush);
  if (reviewChanged) window.dispatchEvent(new CustomEvent('dp:progress', { detail: {} }));
}
