/* Progress tracking, quiz, TOC + scrollspy — no framework, runs on every page. */
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
  window.dispatchEvent(new CustomEvent('dp:progress', { detail: { slug, on } }));
}

/* --- cross-device sync — same email (and hashed storage) as page likes --- */
const EMAIL_KEY = 'dp-email';
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@.]+(\.[^\s@.]+)+$/;

function userEmail() {
  try { return localStorage.getItem(EMAIL_KEY) || ''; } catch { return ''; }
}
function setUserEmail(email) {
  try { localStorage.setItem(EMAIL_KEY, email); } catch {}
}

function pushProgress(slugs, on) {
  const email = userEmail();
  if (!email || !slugs.length) return;
  fetch('/api/progress', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, slugs, learned: on }),
  }).catch(() => {});
}

async function syncProgress() {
  const email = userEmail();
  if (!email) return;
  try {
    const res = await fetch('/api/progress?email=' + encodeURIComponent(email));
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

/* "Sync across devices" UI — injected next to every Reset button (track
   landings) and under the sidebar's learn button, so no template changes. */
function maskEmail(email) {
  const at = email.indexOf('@');
  const user = email.slice(0, at);
  return (user.length > 2 ? user.slice(0, 2) + '…' : user) + email.slice(at);
}

function buildSyncUI() {
  const wrap = document.createElement('div');
  wrap.className = 'dp-sync';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'dp-btn dp-btn--ghost dp-btn--sm dp-sync__btn';
  const form = document.createElement('form');
  form.className = 'dp-sync__form';
  form.hidden = true;
  const input = document.createElement('input');
  input.type = 'email';
  input.required = true;
  input.placeholder = 'you@example.com';
  input.setAttribute('aria-label', 'Your email');
  const save = document.createElement('button');
  save.type = 'submit';
  save.className = 'dp-btn dp-btn--sm dp-btn--primary';
  save.textContent = 'Sync';
  const note = document.createElement('span');
  note.className = 'dp-sync__note';
  note.textContent = 'Saves your progress under this email (stored hashed) so you can pick it up on any device.';
  form.append(input, save, note);
  const render = () => {
    const email = userEmail();
    btn.textContent = email ? `⇅ Synced · ${maskEmail(email)}` : '⇅ Sync across devices…';
    btn.title = email
      ? 'Progress is saved under this email. Click to change it.'
      : 'Enter your email to keep your progress on any device.';
  };
  btn.addEventListener('click', () => {
    form.hidden = !form.hidden;
    if (!form.hidden) { input.value = userEmail(); input.focus(); }
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = input.value.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) return;
    setUserEmail(email);
    form.hidden = true;
    window.dispatchEvent(new CustomEvent('dp:email', { detail: { email } }));
  });
  window.addEventListener('dp:email', render);
  render();
  wrap.append(btn, form);
  return wrap;
}

function initSync() {
  document.querySelectorAll('[data-dp-reset]').forEach((reset) => {
    reset.insertAdjacentElement('beforebegin', buildSyncUI());
  });
  const learn = document.querySelector('[data-dp-learn]');
  if (learn) learn.insertAdjacentElement('afterend', buildSyncUI());
  window.addEventListener('dp:email', () => syncProgress());
  syncProgress();
}

function initProgressViews() {
  if (!document.querySelector('.dp-card[data-slug], [data-dp-progress]')) return;
  paintCards(); paintBars();
  window.addEventListener('dp:progress', () => { paintCards(); paintBars(); });
  window.addEventListener('storage', (e) => {
    if (e.key === STORE_KEY) { learned = loadLearned(); paintCards(); paintBars(); }
  });
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
  initLearnButton();
  initProgressViews();
  initReset();
  initSync();
  initToc();
  initQuiz();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
