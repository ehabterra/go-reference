// Shared plumbing for the social endpoints (/api/likes, /api/progress).
// Identity is a SHA-256 fingerprint of the visitor's email, computed in the
// browser (src/lib/visitor.ts) — the address itself never reaches the server,
// so neither the Worker nor the database ever see it.

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

// A visitor id is the lowercase hex of a SHA-256 digest, nothing else.
const VISITOR_RE = /^[a-f0-9]{64}$/;

export function normalizeVisitor(raw: unknown): string {
  const visitor = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  return VISITOR_RE.test(visitor) ? visitor : '';
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
