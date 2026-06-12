// Client-side identity for likes & progress sync, shared by progress.js and
// the LikeButton island. The email itself never leaves this browser: it lives
// in localStorage, and the server (and database) only ever receive a one-way
// SHA-256 fingerprint of it. The salt constant must not change — stored
// fingerprints are keyed by it.
export const EMAIL_KEY = 'dp-email';
export const EMAIL_RE = /^[^\s@]{1,64}@[^\s@.]+(\.[^\s@.]+)+$/;

export function userEmail(): string {
  try {
    return localStorage.getItem(EMAIL_KEY) ?? '';
  } catch {
    return '';
  }
}

export function setUserEmail(email: string): void {
  try {
    if (email) localStorage.setItem(EMAIL_KEY, email);
    else localStorage.removeItem(EMAIL_KEY);
  } catch {}
}

export async function visitorHash(email: string): Promise<string> {
  const bytes = new TextEncoder().encode(`go-reference-likes-v1:${email}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function maskEmail(email: string): string {
  const at = email.indexOf('@');
  const user = email.slice(0, at);
  return (user.length > 2 ? user.slice(0, 2) + '…' : user) + email.slice(at);
}
