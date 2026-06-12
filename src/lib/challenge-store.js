// Solved state for "fix the bug" challenges, one record per challenge id:
//   dp-chal = { [id]: { done: 1, u: <solved timestamp ms> } }
// Solving is permanent (no un-solve), so last-write-wins sync per key is
// effectively a union across devices.
export const CHAL_KEY = 'dp-chal';

export function loadChallenges() {
  try {
    return JSON.parse(localStorage.getItem(CHAL_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

export function saveChallenges(map) {
  try { localStorage.setItem(CHAL_KEY, JSON.stringify(map)); } catch {}
}

export function isSolved(id) {
  return !!loadChallenges()[id];
}

export function markSolved(id, now = Date.now()) {
  const map = loadChallenges();
  if (!map[id]) {
    map[id] = { done: 1, u: now };
    saveChallenges(map);
    window.dispatchEvent(new CustomEvent('dp:chal', { detail: { id } }));
  }
  return map[id];
}
