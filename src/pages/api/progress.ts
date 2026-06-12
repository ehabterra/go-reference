import type { APIRoute } from 'astro';
import { getDB, json, normalizeVisitor, type D1Database } from '../../lib/social-db';

// Cross-device "mark as learned" sync, keyed by the same browser-computed
// email fingerprint as likes (the address never reaches the server).
// localStorage stays the source of truth on each device; this endpoint lets
// devices that share an email converge on the union of their marks.
//
//   GET  /api/progress?visitor=<hash>              → { slugs: string[] }
//   POST /api/progress { visitor, slugs, learned } → { ok, count }
export const prerender = false;

const SLUG_RE = /^[a-z0-9][a-z0-9/_-]{0,199}$/i;
const MAX_BULK = 1000;

// Same self-bootstrapping trick as the likes table: no migration step.
let ready: Promise<unknown> | null = null;
function ensureSchema(db: D1Database) {
  ready ??= db
    .prepare(
      `CREATE TABLE IF NOT EXISTS progress (
         visitor_id TEXT NOT NULL,
         slug       TEXT NOT NULL,
         created_at TEXT NOT NULL DEFAULT (datetime('now')),
         PRIMARY KEY (visitor_id, slug)
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
  if (!db) return json({ error: 'Progress sync is not configured.' }, 503);

  try {
    await ensureSchema(db);
    const { results } = await db
      .prepare('SELECT slug FROM progress WHERE visitor_id = ?1')
      .bind(visitor)
      .all<{ slug: string }>();
    return json({ slugs: results.map((r) => r.slug) });
  } catch {
    return json({ error: 'Storage unavailable.' }, 503);
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  let visitor = '';
  let slugs: string[] = [];
  let learned = false;
  try {
    const body = await request.json();
    visitor = normalizeVisitor(body?.visitor);
    const raw = Array.isArray(body?.slugs) ? body.slugs : [body?.slug];
    slugs = raw.filter((s: unknown): s is string => typeof s === 'string' && SLUG_RE.test(s));
    learned = body?.learned === true;
  } catch {
    return json({ error: 'Invalid request body.' }, 400);
  }
  if (!visitor) return json({ error: 'A visitor id is required.' }, 400);
  if (!slugs.length) return json({ error: 'No valid slugs.' }, 400);
  if (slugs.length > MAX_BULK) slugs = slugs.slice(0, MAX_BULK);

  const db = getDB(locals);
  if (!db) return json({ error: 'Progress sync is not configured.' }, 503);

  try {
    await ensureSchema(db);
    const sql = learned
      ? 'INSERT OR IGNORE INTO progress (visitor_id, slug) VALUES (?1, ?2)'
      : 'DELETE FROM progress WHERE visitor_id = ?1 AND slug = ?2';
    await db.batch(slugs.map((slug) => db.prepare(sql).bind(visitor, slug)));
    return json({ ok: true, count: slugs.length });
  } catch {
    return json({ error: 'Storage unavailable.' }, 503);
  }
};
