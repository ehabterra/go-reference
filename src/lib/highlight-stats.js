// Client side of the anonymous "N readers highlighted this paragraph" stats.
// Your highlights stay private (localStorage + per-device sync); this layer
// only ever sends the *set of paragraph indices* you've highlighted on a page,
// keyed by the same SHA-256 email fingerprint likes/sync use — no text, no
// notes, no identity. The server aggregates it into counts. Opt-out is honoured
// here, so an opted-out reader never contributes anything.
import { userEmail, visitorHash } from './visitor';

const OPTOUT_KEY = 'dp-hl-stats-optout';

let optedOut = false;
try {
  optedOut = localStorage.getItem(OPTOUT_KEY) === '1';
} catch {}

export function statsOptedOut() {
  return optedOut;
}

export function setStatsOptOut(value) {
  optedOut = !!value;
  try {
    if (optedOut) localStorage.setItem(OPTOUT_KEY, '1');
    else localStorage.removeItem(OPTOUT_KEY);
  } catch {}
}

// Debounced "these are my highlighted blocks for this page right now" report.
// A set-replace on the server, so sending the same set twice is harmless; we
// still skip exact repeats within a page session to avoid pointless writes.
let timer = null;
let pending = null;
let lastKey = '';

export function reportBlocks(page, blocks) {
  if (optedOut) return;
  const sorted = [...new Set(blocks)].sort((a, b) => a - b);
  const key = `${page}|${sorted.join(',')}`;
  if (key === lastKey) return;
  lastKey = key;
  pending = { page, blocks: sorted };
  clearTimeout(timer);
  timer = setTimeout(flush, 800);
}

async function flush() {
  const job = pending;
  pending = null;
  if (!job) return;
  const email = userEmail();
  if (!email) return; // no identity → nothing to dedupe by, so don't contribute
  try {
    const visitor = await visitorHash(email);
    fetch('/api/highlight-stats', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ visitor, page: job.page, blocks: job.blocks }),
    }).catch(() => {});
  } catch {}
}

// Read the public counts for a page: { "<blockIndex>": readerCount }. Cheap and
// edge-cached, so calling it on every page load is fine.
export async function fetchStats(page) {
  try {
    const res = await fetch('/api/highlight-stats?page=' + encodeURIComponent(page));
    if (!res.ok) return {};
    return (await res.json()).counts || {};
  } catch {
    return {};
  }
}
