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
  window.dispatchEvent(new CustomEvent('dp:progress', { detail: { slug, on } }));
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
  render();
}

function initReset() {
  const btn = document.querySelector('[data-dp-reset]');
  if (!btn) return;
  btn.addEventListener('click', () => {
    if (!confirm('Reset your learning progress? This clears all “learned” marks.')) return;
    learned = new Set(); saveLearned(learned);
    paintCards(); paintBars();
  });
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
  initToc();
  initQuiz();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
