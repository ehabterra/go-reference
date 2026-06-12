// Daily learning streak — gentle by design: a single missed day doesn't
// break it (an automatic "freeze"), two missed days do. An active day is one
// with a learning action: marking a page learned or finishing a review.
//   dp-streak = { c: current, b: best, l: 'YYYY-MM-DD' (last active, local) }
export const STREAK_KEY = 'dp-streak';

function dayStr(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function daysBetween(a, b) {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

export function loadStreak() {
  try {
    const s = JSON.parse(localStorage.getItem(STREAK_KEY) || '{}') || {};
    return { c: s.c || 0, b: s.b || 0, l: s.l || '', u: s.u || 0 };
  } catch {
    return { c: 0, b: 0, l: '', u: 0 };
  }
}

function saveStreak(s) {
  try { localStorage.setItem(STREAK_KEY, JSON.stringify(s)); } catch {}
}

/* Adopt a streak that arrived from another device via sync. */
export function adoptStreak(s) {
  saveStreak(s);
  window.dispatchEvent(new CustomEvent('dp:streak', { detail: { ...s } }));
}

/* Record a learning action today. Returns the updated streak. */
export function touchStreak(now = new Date()) {
  const s = loadStreak();
  const today = dayStr(now);
  if (s.l === today) return s; // today already counted
  const gap = s.l ? daysBetween(s.l, today) : Infinity;
  s.c = gap <= 2 ? s.c + 1 : 1; // gap 2 = one missed day → freeze, streak lives
  s.l = today;
  s.b = Math.max(s.b, s.c);
  s.u = now.getTime(); // for last-write-wins in cross-device sync
  saveStreak(s);
  window.dispatchEvent(new CustomEvent('dp:streak', { detail: { ...s } }));
  return s;
}

/* The streak as of now — 0 if it lapsed (more than one missed day). */
export function currentStreak(now = new Date()) {
  const s = loadStreak();
  if (!s.l) return { c: 0, b: s.b };
  return { c: daysBetween(s.l, dayStr(now)) <= 2 ? s.c : 0, b: s.b };
}
