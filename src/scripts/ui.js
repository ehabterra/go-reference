/* Modern UI behaviors: reading bar, nav-on-scroll, scroll reveal,
   mobile menu, code-copy, and a ⌘K command-palette search. No deps. */

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- nav on scroll + reading progress ---------- */
function initScroll() {
  const nav = document.getElementById('dp-nav');
  const bar = document.getElementById('dp-readbar');
  const onScroll = () => {
    const y = window.scrollY || 0;
    if (nav) nav.classList.toggle('is-scrolled', y > 8);
    if (bar) {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.width = h > 0 ? `${Math.min(100, (y / h) * 100)}%` : '0%';
    }
  };
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { onScroll(); ticking = false; });
  }, { passive: true });
  onScroll();
}

/* ---------- scroll reveal ---------- */
function initReveal() {
  if (reduceMotion || !('IntersectionObserver' in window)) return;
  // NOTE: .dp-pg is intentionally excluded — it is the root of a hydrated React
  // island (the Playground). Mutating it here (adding classes / inline style)
  // before hydration causes a React hydration mismatch, so leave it alone.
  const sel = '.dp-card, .dp-feature, .dp-callout, .dp-topic, .dp-section-head, .dp-tradeoffs, .dp-quiz, .dp-overall, .dp-mermaid';
  const els = Array.from(document.querySelectorAll(`main ${sel}`));
  if (!els.length) return;
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
    }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
  els.forEach((el, i) => {
    el.classList.add('reveal');
    el.style.transitionDelay = `${(i % 5) * 45}ms`;
    io.observe(el);
  });
  // safety net: never leave anything hidden
  setTimeout(() => els.forEach((el) => el.classList.add('is-in')), 1600);
}

/* ---------- mobile menu ---------- */
function initMenu() {
  const btn = document.querySelector('[data-dp-menu]');
  const links = document.getElementById('dp-nav-links');
  if (!btn || !links) return;
  btn.addEventListener('click', () => {
    const open = links.classList.toggle('is-open');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  links.querySelectorAll('a').forEach((a) =>
    a.addEventListener('click', () => links.classList.remove('is-open')),
  );
}

/* ---------- code copy buttons ---------- */
function initCopy() {
  document.querySelectorAll('.dp-prose pre:not(.mermaid)').forEach((pre) => {
    if (pre.querySelector('.dp-copy-btn')) return;
    const btn = document.createElement('button');
    btn.className = 'dp-copy-btn';
    btn.type = 'button';
    btn.textContent = 'Copy';
    btn.addEventListener('click', async () => {
      const code = pre.querySelector('code')?.innerText ?? pre.innerText;
      try {
        await navigator.clipboard.writeText(code.replace(/\n$/, ''));
        btn.textContent = 'Copied ✓';
        btn.classList.add('is-done');
        setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('is-done'); }, 1500);
      } catch {}
    });
    pre.appendChild(btn);
  });
}

/* ---------- command palette (⌘K) ---------- */
const CAT_COLOR = {
  foundations: '#f472b6', creational: '#34d399', structural: '#a78bfa', behavioral: '#fbbf24',
  concurrency: '#22d3ee', stdlib: '#60a5fa', practice: '#fb7185',
  'building-blocks': '#2dd4bf', coordination: '#fb923c', runtime: '#818cf8',
  complexity: '#f59e0b', linear: '#22c55e', 'trees-graphs': '#8b5cf6', algorithms: '#ec4899',
  basics: '#38bdf8', composite: '#14b8a6', 'types-methods': '#d946ef', idioms: '#f43f5e',
  essentials: '#84cc16', system: '#f97316', testing: '#a855f7', tooling: '#0891b2',
  'net-basics': '#2563eb', http: '#16a34a', apis: '#db2777', data: '#ca8a04',
};

function fuzzyScore(q, item) {
  const t = item.t.toLowerCase();
  const idx = t.indexOf(q);
  if (idx === 0) return 1000;
  if (idx > 0) return 700 - idx;
  // subsequence in title
  let qi = 0;
  for (let i = 0; i < t.length && qi < q.length; i++) if (t[i] === q[qi]) qi++;
  if (qi === q.length) return 400;
  if ((item.i || '').toLowerCase().includes(q)) return 200;
  if (item.c.includes(q) || item.s.toLowerCase().includes(q)) return 100;
  return 0;
}

const escapeHtml = (s) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const escapeReg = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// A short excerpt around the first occurrence of `q`, with the match marked.
function makeSnippet(text, q) {
  const i = text.toLowerCase().indexOf(q);
  if (i < 0) return escapeHtml(text.slice(0, 120)) + (text.length > 120 ? ' …' : '');
  const start = Math.max(0, i - 50);
  const end = Math.min(text.length, i + q.length + 90);
  const frag = (start > 0 ? '… ' : '') + text.slice(start, end) + (end < text.length ? ' …' : '');
  return escapeHtml(frag).replace(new RegExp(escapeReg(q), 'ig'), (m) => `<mark>${m}</mark>`);
}

function initSearch() {
  const modal = document.getElementById('dp-cmdk');
  const input = document.getElementById('dp-cmdk-input');
  const list = document.getElementById('dp-cmdk-results');
  const trigger = document.querySelector('[data-dp-search]');
  const indexEl = document.getElementById('dp-search-index');
  if (!modal || !input || !list || !indexEl) return;

  let data = [];
  try { data = JSON.parse(indexEl.textContent || '[]'); } catch {}
  let results = [];
  let active = 0;
  let lastFocus = null;

  // Full-text content index (page bodies, split into sections), fetched lazily
  // on first open. Until it lands, search falls back to titles/intents only.
  let content = null;
  let contentTried = false;
  const loadContent = () => {
    if (content || contentTried) return;
    contentTried = true;
    fetch('/search-index.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (Array.isArray(d)) { content = d; if (modal.classList.contains('is-open')) search(input.value); } })
      .catch(() => {});
  };

  // ---- level & track filters ----
  const filtersEl = document.getElementById('dp-cmdk-filters');
  const activeTracks = new Set();
  const activeLevels = new Set();
  const LEVEL_ORDER = ['Start here', 'Beginner', 'Intermediate', 'Advanced', 'Reference'];
  // distinct tracks (in first-seen order) and levels (in a sensible difficulty order)
  const tracks = [...new Set(data.map((x) => x.s).filter(Boolean))];
  const levels = LEVEL_ORDER.filter((l) => data.some((x) => x.d === l));

  const renderFilters = () => {
    if (!filtersEl) return;
    const chip = (label, on, kind, val) =>
      `<button class="dp-cmdk__chip ${on ? 'is-on' : ''}" data-kind="${kind}" data-val="${val.replace(/"/g, '&quot;')}">${label}</button>`;
    filtersEl.innerHTML =
      '<span class="dp-cmdk__chip-group">' +
        levels.map((l) => chip(l, activeLevels.has(l), 'level', l)).join('') +
      '</span><span class="dp-cmdk__chip-sep"></span><span class="dp-cmdk__chip-group">' +
        tracks.map((t) => chip(t, activeTracks.has(t), 'track', t)).join('') +
      '</span>';
  };

  const passesFilters = (item) =>
    (activeTracks.size === 0 || activeTracks.has(item.s)) &&
    (activeLevels.size === 0 || activeLevels.has(item.d));

  const render = () => {
    if (!results.length) {
      list.innerHTML = '<li class="dp-cmdk__empty">No matches — try “channel”, “factory”, “context”…</li>';
      return;
    }
    list.innerHTML = results.map((r, i) => {
      const color = CAT_COLOR[r.c] || '#93a1b5';
      const cat = (r.c || '').replace(/-/g, ' ');
      // Content (section) hits show the heading + a marked excerpt; page hits
      // keep the original section · level subtitle.
      const sub = r.h ? `${r.s} › ${escapeHtml(r.h)}` : `${r.s}${r.d ? ' · ' + r.d : ''}`;
      return `<li class="dp-cmdk__item ${i === active ? 'is-active' : ''}" data-i="${i}" data-u="${r.u}">
        <div class="dp-cmdk__item-main">
          <div class="dp-cmdk__item-title">${r.t}</div>
          <div class="dp-cmdk__item-sub">${sub}</div>
          ${r.snip ? `<div class="dp-cmdk__item-snip">${r.snip}</div>` : ''}
        </div>
        <span class="dp-cmdk__tag" data-cat="${r.c}" style="color:${color}">${cat}</span>
      </li>`;
    }).join('');
    const activeEl = list.querySelector('.is-active');
    if (activeEl) activeEl.scrollIntoView({ block: 'nearest' });
  };

  const search = (q) => {
    q = q.trim().toLowerCase();
    const base = data.filter(passesFilters);
    if (!q) { results = base.slice(0, 50); active = 0; render(); return; }

    // 1) Page-level matches (title / intent / category) via the inline index.
    const pageHits = base
      .map((item) => ({ item, score: fuzzyScore(q, item) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.item);
    const seen = new Set(pageHits.map((r) => r.u));

    // 2) Content matches: sections whose text contains every query token. Each
    //    deep-links to its heading anchor and shows a marked excerpt.
    const secHits = [];
    if (content) {
      const tokens = q.split(/\s+/).filter(Boolean);
      for (const pg of content) {
        if (!passesFilters(pg)) continue;
        for (const sec of pg.secs) {
          const hay = (sec.h + ' ' + sec.x).toLowerCase();
          if (!tokens.every((t) => hay.includes(t))) continue;
          const u = sec.a ? pg.u + '#' + sec.a : pg.u;
          if (seen.has(u)) continue;
          seen.add(u);
          const inHeading = tokens.some((t) => sec.h.toLowerCase().includes(t));
          secHits.push({
            t: pg.t, u, c: pg.c, s: pg.s, d: pg.d, h: sec.h,
            snip: makeSnippet(sec.x || sec.h, tokens[0]),
            _score: inHeading ? 90 : 50,
          });
        }
      }
      secHits.sort((a, b) => b._score - a._score);
    }

    results = pageHits.concat(secHits).slice(0, 30);
    active = 0;
    render();
  };

  const open = () => {
    loadContent();
    lastFocus = document.activeElement;
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    input.value = '';
    renderFilters();
    search('');
    setTimeout(() => input.focus(), 20);
  };
  const close = () => {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  };
  const go = () => { const r = results[active]; if (r) window.location.href = r.u; };

  if (trigger) trigger.addEventListener('click', open);
  input.addEventListener('input', () => search(input.value));

  if (filtersEl) filtersEl.addEventListener('click', (e) => {
    const chip = e.target.closest('.dp-cmdk__chip');
    if (!chip) return;
    const val = chip.getAttribute('data-val');
    const set = chip.getAttribute('data-kind') === 'level' ? activeLevels : activeTracks;
    set.has(val) ? set.delete(val) : set.add(val);
    renderFilters();
    search(input.value);
    input.focus();
  });
  modal.querySelectorAll('[data-dp-cmdk-close]').forEach((el) => el.addEventListener('click', close));

  list.addEventListener('click', (e) => {
    const li = e.target.closest('.dp-cmdk__item');
    if (li) window.location.href = li.getAttribute('data-u');
  });
  list.addEventListener('mousemove', (e) => {
    const li = e.target.closest('.dp-cmdk__item');
    if (li) { active = +li.getAttribute('data-i'); render(); }
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(active + 1, results.length - 1); render(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(active - 1, 0); render(); }
    else if (e.key === 'Enter') { e.preventDefault(); go(); }
  });

  document.addEventListener('keydown', (e) => {
    const typing = /^(input|textarea|select)$/i.test(e.target.tagName) || e.target.isContentEditable;
    if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) { e.preventDefault(); modal.classList.contains('is-open') ? close() : open(); }
    else if (e.key === '/' && !typing && !modal.classList.contains('is-open')) { e.preventDefault(); open(); }
    else if (e.key === 'Escape' && modal.classList.contains('is-open')) { close(); }
  });
}

/* ---------- language toggle (EN / عربي) — language-file driven ---------- */
// Collect the translatable prose blocks of a content page, in document order.
// MUST stay identical to the build-time extractor (scripts/extract-i18n.mjs).
function i18nBlocks() {
  const body = document.querySelector('.dp-article__body');
  if (!body) return [];
  return Array.from(body.querySelectorAll('h2,h3,h4,p,li,.dp-opt')).filter(
    (el) =>
      !el.closest('pre, .dp-mermaid, .dp-pg, .dp-grid, .dp-pager, table') &&
      !el.classList.contains('dp-card__intent') &&
      (el.textContent || '').trim().length > 0,
  );
}

function initLang() {
  const btn = document.querySelector('[data-dp-lang]');
  const root = document.documentElement;
  let dict = {};
  const src = document.getElementById('dp-i18n');
  if (src) { try { dict = JSON.parse(src.textContent || '{}'); } catch {} }
  let content = [];
  const csrc = document.getElementById('dp-content-ar');
  if (csrc) { try { content = JSON.parse(csrc.textContent || '[]'); } catch {} }
  let blocks = null;

  function apply(lang) {
    const ar = lang === 'ar';
    document.querySelectorAll('[data-i18n]').forEach((n) => {
      if (n.dataset.en == null) n.dataset.en = n.textContent;
      const t = dict[n.getAttribute('data-i18n')];
      n.textContent = ar && t ? t : n.dataset.en;
    });
    document.querySelectorAll('[data-i18n-html]').forEach((n) => {
      if (n.dataset.enHtml == null) n.dataset.enHtml = n.innerHTML;
      const t = dict[n.getAttribute('data-i18n-html')];
      n.innerHTML = ar && t ? t : n.dataset.enHtml;
    });
    if (content.length) {
      if (!blocks) blocks = i18nBlocks();
      blocks.forEach((el, i) => {
        if (el.dataset.enHtml == null) el.dataset.enHtml = el.innerHTML;
        const t = content[i];
        el.innerHTML = ar && t ? t : el.dataset.enHtml;
      });
    }
    root.dataset.lang = lang;
    root.dir = ar ? 'rtl' : 'ltr';
    if (btn) btn.textContent = ar ? 'EN' : 'عربي';
    markExternalLinks(); // AR content swaps innerHTML → re-mark new anchors
    // the innerHTML swaps above wipe any injected nodes (e.g. highlight marks);
    // let listeners re-apply themselves against the now-current language
    window.dispatchEvent(new CustomEvent('dp:lang', { detail: { lang } }));
  }

  apply(root.dataset.lang === 'ar' ? 'ar' : 'en'); // honor the persisted choice on load
  if (btn) btn.addEventListener('click', () => {
    const next = root.dataset.lang === 'ar' ? 'en' : 'ar';
    try { localStorage.setItem('dp-lang', next); } catch {}
    apply(next);
  });
}

/* ---------- randomize quiz answer order ----------
   Authoring puts the correct option first; without shuffling, "the first is
   always right" becomes a giveaway. We shuffle the .dp-opt buttons within each
   question AFTER initLang() has cached its i18n `blocks` (which track elements
   by reference, not DOM position) — so the EN/AR positional translation mapping
   stays correct, and data-correct moves with each button. */
function initQuizShuffle() {
  document.querySelectorAll('.dp-q').forEach((q) => {
    const opts = Array.from(q.querySelectorAll('.dp-opt'));
    if (opts.length < 2) return;
    for (let i = opts.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [opts[i], opts[j]] = [opts[j], opts[i]];
    }
    const explain = q.querySelector('.dp-q__explain'); // keep explanation last
    opts.forEach((o) => q.insertBefore(o, explain)); // explain null → append
  });
}

/* ---------- open every external link in a new tab ----------
   Applies to all <a href> pointing at another origin — covers static HTML,
   the .astro pages, and (because apply() calls it again) the Arabic content
   swapped in at runtime, whose translated anchors may lack target/rel. */
function markExternalLinks() {
  document.querySelectorAll('a[href]').forEach((a) => {
    const href = a.getAttribute('href') || '';
    if (!/^https?:\/\//i.test(href)) return; // skip internal / anchors / mailto
    if (a.host === location.host) return; // skip same-site absolute links
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
  });
}

function boot() {
  initLang();
  markExternalLinks();
  initQuizShuffle();
  initScroll();
  initReveal();
  initMenu();
  initCopy();
  initSearch();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
