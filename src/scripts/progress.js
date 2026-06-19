/* Progress tracking, quiz, TOC + scrollspy — no framework, runs on every page. */
import { EMAIL_RE, userEmail, setUserEmail, visitorHash, maskEmail } from '../lib/visitor';
import { t } from '../lib/i18n-client';
import { loadReview, saveReview, scheduleNew, dropSlug, seed, dueSlugs } from '../lib/review-store';
import { touchStreak, currentStreak } from '../lib/streak-store';
import { syncState, pushState, reviewItems, streakItem, lastItem } from '../lib/state-sync';

const STORE_KEY = 'dp-progress';

function loadLearned() {
  try { return new Set(JSON.parse(localStorage.getItem(STORE_KEY) || '[]')); }
  catch { return new Set(); }
}
function saveLearned(set) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify([...set])); } catch {}
}
let learned = loadLearned();

function isLearned(slug) { return learned.has(slug); }
function setLearned(slug, on) {
  if (on) learned.add(slug); else learned.delete(slug);
  saveLearned(learned);
  pushProgress([slug], on);
  // learned pages enter the spaced-repetition deck; unlearned ones leave it
  const review = loadReview();
  if (on) scheduleNew(review, slug); else dropSlug(review, slug);
  saveReview(review);
  if (on) {
    const streak = touchStreak();
    pushState([...reviewItems(review, [slug]), streakItem(streak)]);
  }
  window.dispatchEvent(new CustomEvent('dp:progress', { detail: { slug, on } }));
}

/* --- cross-device sync — same email fingerprint as page likes --- */
async function pushProgress(slugs, on) {
  const email = userEmail();
  if (!email || !slugs.length) return;
  try {
    const visitor = await visitorHash(email);
    fetch('/api/progress', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ visitor, slugs, learned: on }),
    }).catch(() => {});
  } catch {}
}

async function syncProgress() {
  const email = userEmail();
  if (!email) return;
  try {
    const visitor = await visitorHash(email);
    const res = await fetch('/api/progress?visitor=' + visitor);
    if (!res.ok) return;
    const server = new Set((await res.json()).slugs || []);
    const localOnly = [...learned].filter((s) => !server.has(s));
    let merged = false;
    server.forEach((s) => { if (!learned.has(s)) { learned.add(s); merged = true; } });
    if (merged) {
      saveLearned(learned);
      window.dispatchEvent(new CustomEvent('dp:progress', { detail: {} }));
    }
    pushProgress(localOnly, true); // a device's pre-sync marks count too
  } catch {}
}

function pct(done, total) { return total ? Math.round((done / total) * 100) : 0; }

function paintCards() {
  document.querySelectorAll('.dp-card[data-slug]').forEach((card) => {
    card.classList.toggle('is-learned', isLearned(card.getAttribute('data-slug')));
  });
}
function paintBars() {
  document.querySelectorAll('[data-dp-progress]').forEach((el) => {
    const slugs = (el.getAttribute('data-slugs') || '').split(',').map((s) => s.trim()).filter(Boolean);
    const done = slugs.filter(isLearned).length;
    const p = pct(done, slugs.length);
    const fill = el.querySelector('.dp-progress__fill');
    const label = el.querySelector('.dp-progress__label');
    if (fill) fill.style.width = p + '%';
    if (label) label.textContent = `${done} / ${slugs.length} · ${p}%`;
  });
}

function initLearnButton() {
  const btn = document.querySelector('[data-dp-learn]');
  if (!btn) return;
  const slug = btn.getAttribute('data-dp-learn');
  const label = btn.querySelector('[data-dp-learn-label]');
  const render = () => {
    const on = isLearned(slug);
    btn.classList.toggle('is-on', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    if (label) label.textContent = on ? 'Learned ✓' : 'Mark as learned';
    btn.style.background = on ? 'linear-gradient(92deg,#34d399,#0f9d6b)' : '';
    btn.style.color = on ? '#04121a' : '';
    btn.style.borderColor = on ? 'transparent' : '';
  };
  btn.addEventListener('click', () => { setLearned(slug, !isLearned(slug)); render(); });
  window.addEventListener('dp:progress', render); // re-render after a server merge
  render();
}

function initReset() {
  const btn = document.querySelector('[data-dp-reset]');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const synced = !!userEmail();
    const msg = synced
      ? 'Reset your learning progress? This clears all “learned” marks on every synced device.'
      : 'Reset your learning progress? This clears all “learned” marks.';
    if (!confirm(msg)) return;
    pushProgress([...learned], false); // clear server copy too, or sync restores it
    learned = new Set(); saveLearned(learned);
    paintCards(); paintBars();
  });
}

/* --- the one email entry point: the header dialog (Nav.astro) ------------
   Everything else — like button, sync buttons, the nudge — just opens it
   (via openAccountDialog / the dp:ask-email event) and listens for dp:email. */
let accountDialog = null;

function openAccountDialog() {
  if (!accountDialog) return;
  const input = accountDialog.querySelector('input[type="email"]');
  input.value = userEmail();
  accountDialog.showModal();
  input.focus();
}

function initAccount() {
  accountDialog = document.querySelector('[data-dp-account]');
  const trigger = document.querySelector('[data-dp-account-btn]');
  if (!accountDialog || !trigger) return;
  const label = trigger.querySelector('[data-dp-account-label]');
  const status = accountDialog.querySelector('[data-dp-account-status]');
  const statusEmail = accountDialog.querySelector('[data-dp-account-email]');
  const form = accountDialog.querySelector('[data-dp-account-form]');
  const input = form.querySelector('input[type="email"]');
  const removeBtn = accountDialog.querySelector('[data-dp-account-remove]');
  const cancelBtn = accountDialog.querySelector('[data-dp-account-cancel]');

  const render = () => {
    const email = userEmail();
    trigger.classList.toggle('is-on', !!email);
    if (email) {
      // a masked address mustn't be overwritten by the i18n pass
      label.removeAttribute('data-i18n');
      label.textContent = maskEmail(email);
    } else {
      label.setAttribute('data-i18n', 'nav.sync');
      label.textContent = t('nav.sync', 'Sync');
    }
    status.hidden = !email;
    if (email) statusEmail.textContent = email;
    removeBtn.hidden = !email;
  };

  trigger.addEventListener('click', openAccountDialog);
  cancelBtn.addEventListener('click', () => accountDialog.close());
  removeBtn.addEventListener('click', () => {
    setUserEmail('');
    accountDialog.close();
    window.dispatchEvent(new CustomEvent('dp:email', { detail: { email: '' } }));
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = input.value.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) return;
    setUserEmail(email);
    accountDialog.close();
    window.dispatchEvent(new CustomEvent('dp:email', { detail: { email } }));
  });
  window.addEventListener('dp:ask-email', openAccountDialog);
  window.addEventListener('dp:email', render);
  render();
}

function initSync() {
  // No injected sync openers anymore — the central "⇅ Sync" in the header is
  // the single entry point. This just wires the actual sync to run.
  window.addEventListener('dp:email', () => { syncProgress(); syncState(); });
  syncProgress();
  syncState();
}

/* A one-time, dismissible nudge: once the visitor has real progress and no
   email yet, gently point at the sync dialog. Never shown again after either
   dismissing it or adding an email. */
const NUDGE_KEY = 'dp-sync-nudge';

function nudgeDone() {
  try { return !!localStorage.getItem(NUDGE_KEY); } catch { return true; }
}
function setNudgeDone() {
  try { localStorage.setItem(NUDGE_KEY, '1'); } catch {}
}

function showNudge() {
  if (userEmail() || nudgeDone() || document.querySelector('.dp-nudge')) return;
  const el = document.createElement('div');
  el.className = 'dp-nudge';
  el.setAttribute('role', 'status');
  const text = document.createElement('p');
  text.className = 'dp-nudge__text';
  text.textContent = '💡 ' + t(
    'nudge.text',
    'Nice progress! Add your email to keep it on any device — it never leaves this browser, nothing is saved but an anonymous fingerprint.'
  );
  const row = document.createElement('div');
  row.className = 'dp-nudge__row';
  const add = document.createElement('button');
  add.type = 'button';
  add.className = 'dp-btn dp-btn--sm dp-btn--primary';
  add.textContent = t('nudge.add', 'Add email');
  add.addEventListener('click', () => { setNudgeDone(); el.remove(); openAccountDialog(); });
  const later = document.createElement('button');
  later.type = 'button';
  later.className = 'dp-btn dp-btn--sm dp-btn--ghost';
  later.textContent = t('nudge.later', 'No thanks');
  later.addEventListener('click', () => { setNudgeDone(); el.remove(); });
  row.append(add, later);
  el.append(text, row);
  document.body.appendChild(el);
}

function initNudge() {
  if (userEmail() || nudgeDone()) return;
  window.addEventListener('dp:email', (e) => {
    if (e.detail?.email) {
      setNudgeDone();
      document.querySelector('.dp-nudge')?.remove();
    }
  });
  if (learned.size) {
    setTimeout(showNudge, 1500);
  } else {
    // ...or right after they mark their first page — the moment progress
    // becomes worth keeping.
    const onFirstMark = () => {
      if (!learned.size) return;
      window.removeEventListener('dp:progress', onFirstMark);
      setTimeout(showNudge, 800);
    };
    window.addEventListener('dp:progress', onFirstMark);
  }
}

function initProgressViews() {
  if (!document.querySelector('.dp-card[data-slug], [data-dp-progress]')) return;
  paintCards(); paintBars();
  window.addEventListener('dp:progress', () => { paintCards(); paintBars(); });
  window.addEventListener('storage', (e) => {
    if (e.key === STORE_KEY) { learned = loadLearned(); paintCards(); paintBars(); }
  });
}

/* --- milestones & streak ------------------------------------------------ */
const MILESTONES = [
  { pct: 25, emoji: '🥉', key: 'ms.apprentice', name: 'Apprentice' },
  { pct: 50, emoji: '🥈', key: 'ms.journeyman', name: 'Journeyman' },
  { pct: 75, emoji: '🥇', key: 'ms.expert', name: 'Expert' },
  { pct: 100, emoji: '🏆', key: 'ms.master', name: 'Master Gopher' },
];
const MS_SEEN_KEY = 'dp-ms-seen';

function confettiBurst() {
  const wrap = document.createElement('div');
  wrap.className = 'dp-confetti';
  const colors = ['#00c2f2', '#34d399', '#fbbf24', '#a78bfa', '#fb7185', '#6bd7ee'];
  for (let i = 0; i < 60; i++) {
    const p = document.createElement('i');
    p.style.left = Math.random() * 100 + 'vw';
    p.style.background = colors[i % colors.length];
    p.style.animationDelay = Math.random() * 0.4 + 's';
    p.style.animationDuration = 1.8 + Math.random() * 1.4 + 's';
    wrap.appendChild(p);
  }
  document.body.appendChild(wrap);
  setTimeout(() => wrap.remove(), 3800);
}

function showToast(text) {
  const el = document.createElement('div');
  el.className = 'dp-nudge dp-nudge--toast';
  el.setAttribute('role', 'status');
  const p = document.createElement('p');
  p.className = 'dp-nudge__text';
  p.textContent = text;
  el.appendChild(p);
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 6000);
}

/* Celebrate crossing 25/50/75/100% of the current track, at the moment the
   page is marked learned. dp-ms-seen remembers the highest celebrated pct
   per track so un-learning and re-learning doesn't re-fire the party. */
function initMilestoneWatch() {
  const el = document.getElementById('dp-track-info');
  if (!el) return;
  let info;
  try { info = JSON.parse(el.textContent || ''); } catch { return; }
  if (!info?.slugs?.length) return;
  window.addEventListener('dp:progress', (e) => {
    const { slug, on } = e.detail || {};
    if (!on || !info.slugs.includes(slug)) return;
    const total = info.slugs.length;
    const done = info.slugs.filter(isLearned).length;
    const before = ((done - 1) / total) * 100;
    const after = (done / total) * 100;
    const crossed = MILESTONES.filter((m) => before < m.pct && after >= m.pct).pop();
    if (!crossed) return;
    let seen = {};
    try { seen = JSON.parse(localStorage.getItem(MS_SEEN_KEY) || '{}') || {}; } catch {}
    if ((seen[info.name] || 0) >= crossed.pct) return;
    seen[info.name] = crossed.pct;
    try { localStorage.setItem(MS_SEEN_KEY, JSON.stringify(seen)); } catch {}
    confettiBurst();
    showToast(`${crossed.emoji} ${info.name} · ${crossed.pct}% — ${t(crossed.key, crossed.name)}!`);
  });
}

/* Badge chips under every track/overall progress bar (injected, like the
   sync buttons, so the 12 landing templates stay untouched). */
function initMilestoneChips() {
  document.querySelectorAll('.dp-overall [data-dp-progress]').forEach((bar) => {
    const slugs = (bar.getAttribute('data-slugs') || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (slugs.length < 4) return;
    const row = document.createElement('div');
    row.className = 'dp-ms';
    const render = () => {
      const pct = (slugs.filter(isLearned).length / slugs.length) * 100;
      row.innerHTML = '';
      for (const m of MILESTONES) {
        const chip = document.createElement('span');
        chip.className = 'dp-ms__chip' + (pct >= m.pct ? ' is-on' : '');
        chip.textContent = `${m.emoji} ${t(m.key, m.name)}`;
        chip.title = `${m.pct}%`;
        row.appendChild(chip);
      }
    };
    bar.insertAdjacentElement('afterend', row);
    window.addEventListener('dp:progress', render);
    render();
  });
}

/* "🔥 N" chip beside the overall progress title on the hub. */
function initStreakChip() {
  if (location.pathname !== '/') return;
  const top = document.querySelector('.dp-overall__top');
  if (!top) return;
  const chip = document.createElement('span');
  chip.className = 'dp-streak';
  const render = () => {
    const { c, b } = currentStreak();
    chip.hidden = c < 2; // only show once it's a real streak
    chip.textContent = `🔥 ${c}`;
    chip.title = `${c} ${t('streak.days', 'day learning streak')} · ${t('streak.best', 'best')} ${b}`;
  };
  window.addEventListener('dp:streak', render);
  window.addEventListener('dp:progress', render);
  top.querySelector('strong')?.insertAdjacentElement('afterend', chip);
  render();
}

/* --- light / dark theme toggle (default dark; light is opt-in) --- */
function applyGiscusTheme(light) {
  const frame = document.querySelector('iframe.giscus-frame');
  frame?.contentWindow?.postMessage(
    { giscus: { setConfig: { theme: light ? 'light' : 'transparent_dark' } } },
    'https://giscus.app'
  );
}

function initTheme() {
  const root = document.documentElement;
  const btn = document.querySelector('[data-dp-theme]');
  const render = () => {
    if (btn) btn.textContent = root.dataset.theme === 'light' ? '🌙' : '☀️';
  };
  btn?.addEventListener('click', () => {
    const light = root.dataset.theme !== 'light';
    if (light) root.dataset.theme = 'light';
    else delete root.dataset.theme;
    try {
      if (light) localStorage.setItem('dp-theme', 'light');
      else localStorage.removeItem('dp-theme');
    } catch {}
    render();
    applyGiscusTheme(light);
    window.dispatchEvent(new CustomEvent('dp:theme', { detail: { light } }));
  });
  render();
  // giscus loads lazily with a dark default — re-theme it for light-mode
  // visitors once its iframe shows up
  if (root.dataset.theme === 'light') {
    let tries = 0;
    const timer = setInterval(() => {
      if (document.querySelector('iframe.giscus-frame')) {
        clearInterval(timer);
        setTimeout(() => applyGiscusTheme(true), 800);
      } else if (++tries > 30) {
        clearInterval(timer);
      }
    }, 500);
  }
}

/* --- "most liked pages" strip on the hub — social proof from real likes --- */
function initTopLikes() {
  const wrap = document.querySelector('[data-dp-toplikes]');
  const data = document.getElementById('dp-resume-manifest');
  if (!wrap || !data) return;
  let manifest = [];
  try { manifest = JSON.parse(data.textContent || '[]'); } catch {}
  const byPath = new Map();
  for (const tr of manifest) {
    for (const p of tr.pages) {
      byPath.set(`${tr.base}/${p.id}`, { title: p.title, track: tr.name, url: `${tr.base}/${p.id}/` });
    }
  }
  fetch('/api/likes?top=6')
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      const rows = (d?.top || [])
        .map((row) => ({ ...byPath.get(row.page), count: row.count }))
        .filter((r) => r.title && r.count > 0);
      if (rows.length < 3) return; // too little to be social proof — stay hidden
      const grid = wrap.querySelector('[data-dp-toplikes-grid]');
      rows.forEach((r, i) => {
        const a = document.createElement('a');
        a.className = 'dp-toplike';
        a.href = r.url;
        const rank = document.createElement('span');
        rank.className = 'dp-toplike__rank';
        rank.textContent = String(i + 1);
        const body = document.createElement('span');
        body.className = 'dp-toplike__body';
        const title = document.createElement('strong');
        title.textContent = r.title;
        const meta = document.createElement('span');
        meta.className = 'dp-toplike__meta';
        meta.textContent = r.track;
        body.append(title, meta);
        const count = document.createElement('span');
        count.className = 'dp-toplike__count';
        count.textContent = `♥ ${r.count}`;
        a.append(rank, body, count);
        grid.appendChild(a);
      });
      wrap.hidden = false;
    })
    .catch(() => {});
}

/* --- "my liked pages" on the hub — the pages this visitor has liked --- */
function initMyLikes() {
  const wrap = document.querySelector('[data-dp-mylikes]');
  const data = document.getElementById('dp-resume-manifest');
  if (!wrap || !data) return;
  let manifest = [];
  try { manifest = JSON.parse(data.textContent || '[]'); } catch {}
  const byPath = new Map();
  for (const tr of manifest) {
    for (const p of tr.pages) {
      byPath.set(`${tr.base}/${p.id}`, { title: p.title, track: tr.name, url: `${tr.base}/${p.id}/` });
    }
  }
  const grid = wrap.querySelector('[data-dp-mylikes-grid]');

  const render = async () => {
    const email = userEmail();
    if (!email) { wrap.hidden = true; return; } // likes need an email — nothing to show
    try {
      const res = await fetch('/api/likes?mine=' + (await visitorHash(email)));
      if (!res.ok) return;
      const locale = document.documentElement.lang === 'ar' ? 'ar' : undefined;
      const fmtDate = (s) => {
        if (!s) return '';
        // created_at is a UTC "YYYY-MM-DD HH:MM:SS" string from SQLite
        const d = new Date(s.replace(' ', 'T') + 'Z');
        return isNaN(d) ? '' : d.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
      };
      const rows = ((await res.json()).pages || [])
        .map((row) => ({ ...byPath.get(row.page), count: row.count, likedAt: fmtDate(row.liked_at) }))
        .filter((r) => r.title);
      grid.innerHTML = '';
      if (!rows.length) { wrap.hidden = true; return; }
      for (const r of rows) {
        const a = document.createElement('a');
        a.className = 'dp-toplike';
        a.href = r.url;
        const body = document.createElement('span');
        body.className = 'dp-toplike__body';
        const title = document.createElement('strong');
        title.textContent = r.title;
        const meta = document.createElement('span');
        meta.className = 'dp-toplike__meta';
        meta.textContent = r.likedAt ? `${r.track} · ${r.likedAt}` : r.track;
        body.append(title, meta);
        const count = document.createElement('span');
        count.className = 'dp-toplike__count';
        count.textContent = `♥ ${r.count}`;
        a.append(body, count);
        grid.appendChild(a);
      }
      wrap.hidden = false;
    } catch {}
  };
  render();
  window.addEventListener('dp:email', render); // populate the moment an email is set
}

/* --- skill map on track landings: light learned, pulse the next step --- */
function initSkillTree() {
  document.querySelectorAll('[data-dp-tree]').forEach((tree) => {
    const nodes = [...tree.querySelectorAll('[data-tree-slug]')];
    if (!nodes.length) return;
    const render = () => {
      let nextFound = false;
      for (const n of nodes) {
        const on = isLearned(n.getAttribute('data-tree-slug'));
        n.classList.toggle('is-learned', on);
        const isNext = !on && !nextFound;
        if (isNext) nextFound = true;
        n.classList.toggle('is-next', isNext);
      }
      tree.querySelectorAll('[data-tree-tier]').forEach((tier) => {
        const tierNodes = [...tier.querySelectorAll('[data-tree-slug]')];
        tier.classList.toggle(
          'is-done',
          tierNodes.length > 0 && tierNodes.every((n) => n.classList.contains('is-learned'))
        );
      });
    };
    window.addEventListener('dp:progress', render);
    render();
  });
}

/* --- resume card: remember the last visited page, surface it on the hub --- */
const LAST_KEY = 'dp-last';

function recordVisit() {
  const btn = document.querySelector('[data-dp-learn]');
  if (!btn) return; // only content pages carry the learn button
  const rec = {
    slug: btn.getAttribute('data-dp-learn'),
    path: location.pathname,
    when: Date.now(),
  };
  try { localStorage.setItem(LAST_KEY, JSON.stringify(rec)); } catch {}
  pushState([lastItem(rec)]); // resume works from any device
}

function initResume() {
  const card = document.querySelector('[data-dp-resume]');
  const data = document.getElementById('dp-resume-manifest');
  if (!card || !data) return;
  let manifest = [];
  try { manifest = JSON.parse(data.textContent || '[]'); } catch {}

  // Re-reads dp-last every time: cross-device sync (dp:last) can replace it
  // after the initial paint. First visit ever → card stays hidden.
  const render = () => {
    let last = null;
    try { last = JSON.parse(localStorage.getItem(LAST_KEY) || 'null'); } catch {}
    if (!last || !last.slug) return;
    const track =
      manifest.find((t) => (last.path || '').startsWith(t.base + '/')) ||
      manifest.find((t) => t.pages.some((p) => p.id === last.slug));
    if (!track) return;
    const idx = track.pages.findIndex((p) => p.id === last.slug);
    if (idx === -1) return;
    const done = track.pages.filter((p) => isLearned(p.id)).length;
    card.querySelector('[data-dp-resume-title]').textContent = track.pages[idx].title;
    card.querySelector('[data-dp-resume-track]').textContent = track.name;
    card.querySelector('[data-dp-resume-count]').textContent = `${done} / ${track.pages.length}`;
    card.querySelector('[data-dp-resume-link]').href = `${track.base}/${last.slug}/`;
    // next unlearned page after the current one, wrapping around the track
    const ahead = [...track.pages.slice(idx + 1), ...track.pages.slice(0, idx)];
    const next = ahead.find((p) => !isLearned(p.id));
    const nextEl = card.querySelector('[data-dp-resume-next]');
    if (next) {
      nextEl.hidden = false;
      nextEl.href = `${track.base}/${next.id}/`;
      card.querySelector('[data-dp-resume-next-title]').textContent = next.title;
    } else {
      nextEl.hidden = true;
    }
    card.hidden = false;
  };
  window.addEventListener('dp:progress', render); // server sync can change counts
  window.addEventListener('dp:last', render); // …or replace the pointer itself
  render();
}

/* --- review card on the hub: how many learned pages are due for recall --- */
function initReviewCard() {
  const card = document.querySelector('[data-dp-review-card]');
  const data = document.getElementById('dp-resume-manifest');
  if (!card || !data) return;
  let manifest = [];
  try { manifest = JSON.parse(data.textContent || '[]'); } catch {}
  const quizSlugs = new Set(
    manifest.flatMap((tr) => tr.pages.filter((p) => p.q).map((p) => p.id))
  );
  const render = () => {
    const review = loadReview();
    const candidates = [...learned].filter((s) => quizSlugs.has(s));
    if (seed(review, candidates)) saveReview(review);
    const due = dueSlugs(review, candidates);
    card.querySelector('[data-dp-review-count]').textContent = String(due.length);
    card.hidden = due.length === 0;
  };
  window.addEventListener('dp:progress', render);
  render();
}

function slugify(s) {
  return s.toLowerCase().replace(/[^\w]+/g, '-').replace(/^-+|-+$/g, '');
}
function initToc() {
  const tocList = document.querySelector('[data-dp-toc]');
  const body = document.querySelector('.dp-article__body');
  if (!tocList || !body) return;
  const heads = body.querySelectorAll('h2, h3');
  if (!heads.length) {
    const wrap = document.querySelector('.dp-article__toc');
    if (wrap) wrap.style.display = 'none';
    return;
  }
  const items = [];
  heads.forEach((h) => {
    // innerText reflects only the visible language (bilingual headings)
    const label = (h.innerText || h.textContent || '').trim();
    if (!label) return; // skip an empty (fully-hidden) heading
    if (!h.id) h.id = slugify(label);
    const li = document.createElement('li');
    li.className = h.tagName === 'H3' ? 'lvl-3' : 'lvl-2';
    const a = document.createElement('a');
    a.href = '#' + h.id;
    a.textContent = label;
    li.appendChild(a);
    tocList.appendChild(li);
    items.push({ link: a, el: h });
  });
  const spy = () => {
    const top = window.scrollY + 110;
    let current = items[0];
    for (const it of items) if (it.el.offsetTop <= top) current = it;
    items.forEach((it) => it.link.classList.toggle('is-active', it === current));
  };
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { spy(); ticking = false; });
  });
  spy();
}

// Make content headings self-linking: clicking one copies a deep link to it
// (and updates the URL hash). IDs come from the build-time rehype plugin; this
// only wires the affordance. Runs against h2–h4 so any heading is referencable.
function initHeadingAnchors() {
  const body = document.querySelector('.dp-article__body');
  if (!body) return;
  body.querySelectorAll('h2[id], h3[id], h4[id]').forEach((h) => {
    h.classList.add('dp-anchored');
    h.setAttribute('title', 'Copy link to this section');
    h.addEventListener('click', (e) => {
      if (e.target.closest('a')) return; // don't hijack real links in a heading
      const url = location.href.split('#')[0] + '#' + h.id;
      try { history.replaceState(null, '', '#' + h.id); } catch { location.hash = h.id; }
      const flash = () => {
        h.classList.add('is-copied');
        setTimeout(() => h.classList.remove('is-copied'), 1400);
      };
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText(url).then(flash, flash);
      else flash();
    });
  });
}

function initQuiz() {
  const quiz = document.querySelector('[data-dp-quiz]');
  if (!quiz) return;
  const total = quiz.querySelectorAll('.dp-q').length;
  let correct = 0;
  const scoreEl = quiz.querySelector('[data-dp-score]');
  const updateScore = () => { if (scoreEl) scoreEl.textContent = `Score: ${correct} / ${total}`; };
  updateScore();
  quiz.querySelectorAll('.dp-q').forEach((q) => {
    let done = false;
    const explain = q.querySelector('.dp-q__explain');
    if (explain) explain.style.display = 'none';
    q.querySelectorAll('.dp-opt').forEach((opt) => {
      opt.addEventListener('click', () => {
        if (done) return;
        done = true;
        const right = opt.getAttribute('data-correct') === 'true';
        if (right) { opt.classList.add('is-correct'); correct++; }
        else {
          opt.classList.add('is-wrong');
          const good = q.querySelector('.dp-opt[data-correct="true"]');
          if (good) good.classList.add('is-correct');
        }
        q.querySelectorAll('.dp-opt').forEach((o) => { o.disabled = true; });
        if (explain) explain.style.display = 'block';
        updateScore();
      });
    });
  });
}

function boot() {
  initTheme();
  initLearnButton();
  initProgressViews();
  initReset();
  initAccount();
  initSync();
  initNudge();
  recordVisit();
  initResume();
  initReviewCard();
  initTopLikes();
  initMyLikes();
  initMilestoneWatch();
  initMilestoneChips();
  initStreakChip();
  initSkillTree();
  initToc();
  initHeadingAnchors();
  initQuiz();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
