import type { APIRoute } from 'astro';
import { getDB, json, normalizeVisitor, type D1Database } from '../../lib/social-db';

// Per-page likes, stored in Cloudflare D1 (binding `DB` in wrangler.jsonc).
// A like is keyed by the visitor's email — but only as a SHA-256 fingerprint
// computed in the browser (src/lib/visitor.ts); the address itself never
// reaches this endpoint. Not verified, but enough to count one like per
// person without a login.
//
//   GET  /api/likes?page=/patterns/strategy&visitor=<hash> → { count, liked }
//   GET  /api/likes?top=6                                  → { top: [{ page, count }] }
//   POST /api/likes  { page, visitor, liked }              → { count, liked }
export const prerender = false;

const PAGE_RE = /^\/[a-z0-9][a-z0-9/_-]{0,199}$/i;

// Bootstrap the table on the first request per isolate — IF NOT EXISTS makes
// it a no-op afterwards, and it spares both dev and prod a migration step.
let ready: Promise<unknown> | null = null;
function ensureSchema(db: D1Database) {
  ready ??= db
    .prepare(
      `CREATE TABLE IF NOT EXISTS likes (
         page       TEXT NOT NULL,
         visitor_id TEXT NOT NULL,
         created_at TEXT NOT NULL DEFAULT (datetime('now')),
         PRIMARY KEY (page, visitor_id)
       )`
    )
    .run()
    .catch((err) => {
      ready = null;
      throw err;
    });
  return ready;
}

async function state(db: D1Database, page: string, visitor: string) {
  const row = await db
    .prepare('SELECT COUNT(*) AS count FROM likes WHERE page = ?1')
    .bind(page)
    .first<{ count: number }>();
  let liked = false;
  if (visitor) {
    liked = !!(await db
      .prepare('SELECT 1 FROM likes WHERE page = ?1 AND visitor_id = ?2')
      .bind(page, visitor)
      .first());
  }
  return { count: row?.count ?? 0, liked };
}

export const GET: APIRoute = async ({ url, locals }) => {
  const db = getDB(locals);
  if (!db) return json({ error: 'Likes are not configured.' }, 503);

  // leaderboard mode: the home hub's "most liked pages" strip
  const top = url.searchParams.get('top');
  if (top) {
    const n = Math.min(Math.max(parseInt(top, 10) || 0, 1), 12);
    try {
      await ensureSchema(db);
      const { results } = await db
        .prepare('SELECT page, COUNT(*) AS count FROM likes GROUP BY page ORDER BY count DESC, page ASC LIMIT ?1')
        .bind(n)
        .all<{ page: string; count: number }>();
      return new Response(JSON.stringify({ top: results }), {
        status: 200,
        // staleness is fine for a leaderboard — let Cloudflare cache it
        headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=300' },
      });
    } catch {
      return json({ error: 'Storage unavailable.' }, 503);
    }
  }

  // "my liked pages" mode: every page this visitor liked, newest first, each
  // with the page's total like count.
  const mine = normalizeVisitor(url.searchParams.get('mine'));
  if (url.searchParams.has('mine')) {
    if (!mine) return json({ error: 'Bad visitor.' }, 400);
    try {
      await ensureSchema(db);
      const { results } = await db
        .prepare(
          `SELECT page, created_at AS liked_at,
                  (SELECT COUNT(*) FROM likes a WHERE a.page = likes.page) AS count
           FROM likes WHERE visitor_id = ?1 ORDER BY created_at DESC LIMIT 100`
        )
        .bind(mine)
        .all<{ page: string; liked_at: string; count: number }>();
      return json({ pages: results });
    } catch {
      return json({ error: 'Storage unavailable.' }, 503);
    }
  }

  const page = url.searchParams.get('page') ?? '';
  const visitor = normalizeVisitor(url.searchParams.get('visitor'));
  if (!PAGE_RE.test(page)) return json({ error: 'Bad page.' }, 400);

  try {
    await ensureSchema(db);
    return json(await state(db, page, visitor));
  } catch {
    return json({ error: 'Storage unavailable.' }, 503);
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  let page = '';
  let visitor = '';
  let liked = false;
  try {
    const body = await request.json();
    page = typeof body?.page === 'string' ? body.page : '';
    visitor = normalizeVisitor(body?.visitor);
    liked = body?.liked === true;
  } catch {
    return json({ error: 'Invalid request body.' }, 400);
  }
  if (!PAGE_RE.test(page)) return json({ error: 'Bad page.' }, 400);
  if (!visitor) return json({ error: 'A visitor id is required.' }, 400);

  const db = getDB(locals);
  if (!db) return json({ error: 'Likes are not configured.' }, 503);

  try {
    await ensureSchema(db);
    if (liked) {
      await db
        .prepare('INSERT OR IGNORE INTO likes (page, visitor_id) VALUES (?1, ?2)')
        .bind(page, visitor)
        .run();
    } else {
      await db
        .prepare('DELETE FROM likes WHERE page = ?1 AND visitor_id = ?2')
        .bind(page, visitor)
        .run();
    }
    return json(await state(db, page, visitor));
  } catch {
    return json({ error: 'Storage unavailable.' }, 503);
  }
};
