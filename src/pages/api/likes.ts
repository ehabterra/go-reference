import type { APIRoute } from 'astro';

// Per-page likes, stored in Cloudflare D1 (binding `DB` in wrangler.jsonc).
// A like is keyed by the visitor's email (asked once, kept in localStorage) —
// not verified, but enough to count one like per person without a login.
// Emails never reach the database: rows store a salted SHA-256 of the email,
// so the DB holds no addresses while one-like-per-person still holds.
//
//   GET  /api/likes?page=/patterns/strategy&email=<email> → { count, liked }
//   POST /api/likes  { page, email, liked }               → { count, liked }
export const prerender = false;

// Minimal structural types for the D1 binding so we don't need
// @cloudflare/workers-types for a single table.
interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(): Promise<T | null>;
  run(): Promise<unknown>;
}
interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

const PAGE_RE = /^\/[a-z0-9][a-z0-9/_-]{0,199}$/i;
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@.]+(\.[^\s@.]+)+$/;

function normalizeEmail(raw: unknown): string {
  const email = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  return email.length <= 254 && EMAIL_RE.test(email) ? email : '';
}

// Salting keeps the stored hashes from being reversed with a dictionary of
// known addresses. Optionally set a private LIKES_SALT in production
// (`wrangler secret put LIKES_SALT`); changing it later orphans old likes.
function getSalt(locals: unknown): string {
  return (locals as any)?.runtime?.env?.LIKES_SALT || 'go-reference-likes-v1';
}

async function hashEmail(email: string, salt: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${salt}:${email}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function getDB(locals: unknown): D1Database | null {
  return (locals as any)?.runtime?.env?.DB ?? null;
}

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
  const page = url.searchParams.get('page') ?? '';
  const email = normalizeEmail(url.searchParams.get('email'));
  if (!PAGE_RE.test(page)) return json({ error: 'Bad page.' }, 400);

  const db = getDB(locals);
  if (!db) return json({ error: 'Likes are not configured.' }, 503);

  try {
    await ensureSchema(db);
    const visitor = email ? await hashEmail(email, getSalt(locals)) : '';
    return json(await state(db, page, visitor));
  } catch {
    return json({ error: 'Storage unavailable.' }, 503);
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  let page = '';
  let email = '';
  let liked = false;
  try {
    const body = await request.json();
    page = typeof body?.page === 'string' ? body.page : '';
    email = normalizeEmail(body?.email);
    liked = body?.liked === true;
  } catch {
    return json({ error: 'Invalid request body.' }, 400);
  }
  if (!PAGE_RE.test(page)) return json({ error: 'Bad page.' }, 400);
  if (!email) return json({ error: 'A valid email is required.' }, 400);

  const db = getDB(locals);
  if (!db) return json({ error: 'Likes are not configured.' }, 503);

  try {
    await ensureSchema(db);
    const visitor = await hashEmail(email, getSalt(locals));
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
