// Shared plumbing for the social endpoints (/api/likes, /api/progress).
// Identity is the visitor's email (asked once, kept in localStorage) — the
// database only ever sees a salted SHA-256 of it, never the address itself.

// Minimal structural types for the D1 binding so we don't need
// @cloudflare/workers-types for a couple of tables.
export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
}
export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<unknown>;
}

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@.]+(\.[^\s@.]+)+$/;

export function normalizeEmail(raw: unknown): string {
  const email = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  return email.length <= 254 && EMAIL_RE.test(email) ? email : '';
}

export function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export function getDB(locals: unknown): D1Database | null {
  return (locals as any)?.runtime?.env?.DB ?? null;
}

// Salting keeps the stored hashes from being reversed with a dictionary of
// known addresses. Optionally set a private LIKES_SALT in production
// (`wrangler secret put LIKES_SALT`); changing it later orphans old data.
function getSalt(locals: unknown): string {
  return (locals as any)?.runtime?.env?.LIKES_SALT || 'go-reference-likes-v1';
}

export async function visitorFor(locals: unknown, email: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${getSalt(locals)}:${email}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
