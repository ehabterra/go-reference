import type { APIRoute } from 'astro';
import { getDB, json, normalizeVisitor, type D1Database } from '../../lib/social-db';

// Anonymous, aggregate "how many readers highlighted this paragraph" stats,
// stored in Cloudflare D1 (binding `DB`). A row is (page, block, visitor) where
// `block` is the prose paragraph index the highlights client already records on
// every highlight, and `visitor` is the same SHA-256 email fingerprint used by
// likes/sync — never the address itself. The read path returns COUNTS ONLY:
// no visitor ids, no text, no notes ever leave the server, so this exposes
// strictly less than /api/state already stores for sync.
//
//   GET  /api/highlight-stats?page=/patterns/strategy → { counts: { "<block>": n } }
//   POST /api/highlight-stats { page, visitor, blocks } → { ok }
//        (replaces this visitor's block set for the page — idempotent)
export const prerender = false;

const PAGE_RE = /^\/[a-z0-9][a-z0-9/_-]{0,199}$/i;
const MAX_BLOCK = 5000; // a page has far fewer paragraphs than this
const MAX_BLOCKS = 400; // a single reader won't highlight more blocks than this

// Self-bootstrapping schema — same trick as likes/state, a no-op after the
// first request per isolate.
let ready: Promise<unknown> | null = null;
function ensureSchema(db: D1Database) {
  ready ??= db
    .prepare(
      `CREATE TABLE IF NOT EXISTS highlight_stats (
         page       TEXT NOT NULL,
         block      INTEGER NOT NULL,
         visitor_id TEXT NOT NULL,
         created_at TEXT NOT NULL DEFAULT (datetime('now')),
         PRIMARY KEY (page, block, visitor_id)
       )`
    )
    .run()
    .then(() =>
      db.prepare('CREATE INDEX IF NOT EXISTS idx_hl_stats_page ON highlight_stats(page)').run()
    )
    .catch((err) => {
      ready = null;
      throw err;
    });
  return ready;
}

export const GET: APIRoute = async ({ url, locals }) => {
  const page = url.searchParams.get('page') ?? '';
  if (!PAGE_RE.test(page)) return json({ error: 'Bad page.' }, 400);

  const db = getDB(locals);
  if (!db) return json({ error: 'Stats are not configured.' }, 503);

  try {
    await ensureSchema(db);
    const { results } = await db
      .prepare('SELECT block, COUNT(*) AS count FROM highlight_stats WHERE page = ?1 GROUP BY block')
      .bind(page)
      .all<{ block: number; count: number }>();
    const counts: Record<string, number> = {};
    for (const r of results) counts[r.block] = r.count;
    return new Response(JSON.stringify({ counts }), {
      status: 200,
      // soft, shared stats — let Cloudflare's edge serve them so D1 isn't hit
      // on every page view; a minute of staleness is invisible here.
      headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=60' },
    });
  } catch {
    return json({ error: 'Storage unavailable.' }, 503);
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  let page = '';
  let visitor = '';
  let blocks: number[] = [];
  try {
    const body = await request.json();
    page = typeof body?.page === 'string' ? body.page : '';
    visitor = normalizeVisitor(body?.visitor);
    const raw = Array.isArray(body?.blocks) ? body.blocks : [];
    blocks = [
      ...new Set(
        raw
          .filter((b: any) => Number.isInteger(b) && b >= 0 && b <= MAX_BLOCK)
          .map((b: number) => b)
      ),
    ].slice(0, MAX_BLOCKS);
  } catch {
    return json({ error: 'Invalid request body.' }, 400);
  }
  if (!PAGE_RE.test(page)) return json({ error: 'Bad page.' }, 400);
  if (!visitor) return json({ error: 'A visitor id is required.' }, 400);

  const db = getDB(locals);
  if (!db) return json({ error: 'Stats are not configured.' }, 503);

  try {
    await ensureSchema(db);
    // Replace this visitor's block set for the page in one transaction: drop
    // what they had, insert what they have now. Handles add / remove / recolor
    // uniformly, and stays idempotent if the same set is sent twice.
    const stmts = [
      db.prepare('DELETE FROM highlight_stats WHERE page = ?1 AND visitor_id = ?2').bind(page, visitor),
    ];
    for (const block of blocks) {
      stmts.push(
        db
          .prepare('INSERT OR IGNORE INTO highlight_stats (page, block, visitor_id) VALUES (?1, ?2, ?3)')
          .bind(page, block, visitor)
      );
    }
    await db.batch(stmts);
    return json({ ok: true, blocks: blocks.length });
  } catch {
    return json({ error: 'Storage unavailable.' }, 503);
  }
};
