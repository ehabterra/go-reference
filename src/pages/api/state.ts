import type { APIRoute } from 'astro';
import { getDB, json, normalizeVisitor, type D1Database } from '../../lib/social-db';

// Generic per-visitor key-value sync with last-write-wins semantics. The
// client uses it for the review schedule (`review:<slug>`), the daily streak
// (`streak`) and the resume pointer (`last`); values are opaque JSON strings.
// `u` is the client's update timestamp (ms) — an upsert only applies when
// strictly newer than the stored row, so devices converge on latest activity.
//
//   GET  /api/state?visitor=<hash>          → { items: [{ k, v, u }] }
//   POST /api/state { visitor, items }      → { ok, count }
export const prerender = false;

const KEY_RE = /^[a-z0-9:_/-]{1,220}$/i;
const MAX_VALUE = 4096;
const MAX_BULK = 1000;

// Same self-bootstrapping trick as the likes/progress tables.
let ready: Promise<unknown> | null = null;
function ensureSchema(db: D1Database) {
  ready ??= db
    .prepare(
      `CREATE TABLE IF NOT EXISTS state (
         visitor_id TEXT NOT NULL,
         k          TEXT NOT NULL,
         v          TEXT NOT NULL,
         u          INTEGER NOT NULL DEFAULT 0,
         PRIMARY KEY (visitor_id, k)
       )`
    )
    .run()
    .catch((err) => {
      ready = null;
      throw err;
    });
  return ready;
}

export const GET: APIRoute = async ({ url, locals }) => {
  const visitor = normalizeVisitor(url.searchParams.get('visitor'));
  if (!visitor) return json({ error: 'A visitor id is required.' }, 400);

  const db = getDB(locals);
  if (!db) return json({ error: 'Sync is not configured.' }, 503);

  try {
    await ensureSchema(db);
    const { results } = await db
      .prepare('SELECT k, v, u FROM state WHERE visitor_id = ?1')
      .bind(visitor)
      .all<{ k: string; v: string; u: number }>();
    return json({ items: results });
  } catch {
    return json({ error: 'Storage unavailable.' }, 503);
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  let visitor = '';
  let items: { k: string; v: string; u: number }[] = [];
  try {
    const body = await request.json();
    visitor = normalizeVisitor(body?.visitor);
    const raw = Array.isArray(body?.items) ? body.items : [];
    items = raw
      .filter(
        (it: any) =>
          typeof it?.k === 'string' &&
          KEY_RE.test(it.k) &&
          typeof it?.v === 'string' &&
          it.v.length <= MAX_VALUE &&
          Number.isFinite(it?.u) &&
          it.u >= 0
      )
      .map((it: any) => ({ k: it.k, v: it.v, u: Math.floor(it.u) }));
  } catch {
    return json({ error: 'Invalid request body.' }, 400);
  }
  if (!visitor) return json({ error: 'A visitor id is required.' }, 400);
  if (!items.length) return json({ error: 'No valid items.' }, 400);
  if (items.length > MAX_BULK) items = items.slice(0, MAX_BULK);

  const db = getDB(locals);
  if (!db) return json({ error: 'Sync is not configured.' }, 503);

  try {
    await ensureSchema(db);
    const sql = `INSERT INTO state (visitor_id, k, v, u) VALUES (?1, ?2, ?3, ?4)
                 ON CONFLICT (visitor_id, k) DO UPDATE SET v = excluded.v, u = excluded.u
                 WHERE excluded.u > state.u`;
    await db.batch(items.map((it) => db.prepare(sql).bind(visitor, it.k, it.v, it.u)));
    return json({ ok: true, count: items.length });
  } catch {
    return json({ error: 'Storage unavailable.' }, 503);
  }
};
