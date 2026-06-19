/* Select-to-highlight on content pages + the /highlights/ collection page.
   Highlights live in localStorage (highlight-store) and re-anchor to the prose
   by character offset, with the highlighted text + surrounding context as a
   fallback when offsets drift between builds. Cross-device sync rides the same
   /api/state store the review schedule uses. No framework — runs on every page,
   no-ops where there's nothing to do. */
import {
  putHighlight,
  removeHighlight,
  listHighlights,
  highlightsForPage,
  clearHighlights,
  newId,
  HL_COLORS,
} from '../lib/highlight-store';
import { pushState, hlItem } from '../lib/state-sync';
import { t } from '../lib/i18n-client';

// Prose only: skip the runnable editor, quiz, diagrams, and the after-content
// components so offsets are a stable function of the article's words alone.
const EXCLUDE =
  '.dp-pg, .dp-playground, [data-dp-quiz], .dp-quiz, .dp-pager, .dp-comments, ' +
  '.dp-grid, .dp-tradeoffs, .dp-mermaid, .mermaid, svg, script, style, button, .dp-draft';
const CTX = 32; // chars of context stored on each side for re-anchoring

const pageId = () => location.pathname.replace(/\/+$/, '') || '/';
function pageTitle() {
  const h1 = document.querySelector('article h1, .dp-article h1, main h1');
  const txt = (h1?.innerText || h1?.textContent || '').trim();
  return txt || document.title.replace(/\s·\s.*$/, '');
}
const getRoot = () => document.querySelector('.dp-article__body');

/* --- prose text index ---------------------------------------------------- */
function buildIndex(root) {
  const nodes = [];
  let text = '';
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      if (!n.nodeValue) return NodeFilter.FILTER_REJECT;
      const p = n.parentElement;
      if (!p || p.closest(EXCLUDE)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let n;
  while ((n = walker.nextNode())) {
    nodes.push({ node: n, start: text.length, len: n.nodeValue.length });
    text += n.nodeValue;
  }
  return { text, nodes };
}

// Character offset of a DOM boundary within the prose text. comparePoint tells
// us whether the boundary sits before / inside / after each accepted text node.
function offsetOf(index, container, offset) {
  let total = 0;
  for (const e of index.nodes) {
    let cmp;
    try {
      const r = document.createRange();
      r.setStart(e.node, 0);
      r.setEnd(e.node, e.len);
      cmp = r.comparePoint(container, offset);
    } catch {
      cmp = 1;
    }
    if (cmp > 0) {
      total += e.len;
      continue;
    }
    if (cmp < 0) break;
    return total + (container === e.node ? offset : 0);
  }
  return total;
}

// Map a prose offset back to a { node, offset } pair.
function locate(index, g) {
  for (const e of index.nodes) {
    if (g <= e.start + e.len) return { node: e.node, offset: Math.max(0, g - e.start) };
  }
  const last = index.nodes[index.nodes.length - 1];
  return last ? { node: last.node, offset: last.len } : null;
}

// Where does this highlight's text live now? Trust the stored offset if it still
// matches; otherwise locate by text + context (W3C TextQuoteSelector style).
function findRange(index, hl) {
  const text = hl.text || '';
  if (text.length < 2) return null;
  if (typeof hl.start === 'number' && index.text.substr(hl.start, text.length) === text) {
    return { start: hl.start, end: hl.start + text.length };
  }
  const hits = [];
  for (let i = index.text.indexOf(text); i !== -1; i = index.text.indexOf(text, i + 1)) {
    hits.push(i);
    if (hits.length > 50) break;
  }
  if (!hits.length) return null;
  if (hits.length > 1) {
    const score = (pos) => {
      let s = 0;
      if (hl.prefix && index.text.slice(Math.max(0, pos - hl.prefix.length), pos).endsWith(hl.prefix)) s += 2;
      if (hl.suffix && index.text.slice(pos + text.length, pos + text.length + hl.suffix.length).startsWith(hl.suffix)) s += 2;
      if (typeof hl.start === 'number') s -= Math.min(1, Math.abs(pos - hl.start) / 5000);
      return s;
    };
    hits.sort((a, b) => score(b) - score(a));
  }
  return { start: hits[0], end: hits[0] + text.length };
}

// Wrap [start,end) of the prose in <mark>s — one per text node it spans, all
// sharing the highlight id; the first carries the scroll anchor.
function wrapRange(index, start, end, hl) {
  const pieces = index.nodes.filter((e) => e.start < end && e.start + e.len > start);
  let anchored = false;
  for (const e of pieces) {
    let from = Math.max(0, start - e.start);
    const to = Math.min(e.len, end - e.start);
    if (to <= from) continue;
    let node = e.node;
    if (from > 0) node = node.splitText(from);
    if (to - from < node.nodeValue.length) node.splitText(to - from);
    const mark = document.createElement('mark');
    mark.className = `dp-hl dp-hl--${HL_COLORS.includes(hl.color) ? hl.color : 'yellow'}`;
    mark.dataset.hlId = hl.id;
    mark.tabIndex = 0;
    mark.setAttribute('role', 'button');
    if (!anchored) {
      mark.id = 'hl-' + hl.id;
      anchored = true;
    }
    node.parentNode.insertBefore(mark, node);
    mark.appendChild(node);
  }
  return anchored;
}

function applyOne(root, hl) {
  if (document.querySelector(`.dp-hl[data-hl-id="${CSS.escape(hl.id)}"]`)) return true;
  const index = buildIndex(root);
  const r = findRange(index, hl);
  if (!r) return false;
  return wrapRange(index, r.start, r.end, hl);
}

function unwrap(id) {
  document.querySelectorAll(`.dp-hl[data-hl-id="${CSS.escape(id)}"]`).forEach((m) => {
    const parent = m.parentNode;
    while (m.firstChild) parent.insertBefore(m.firstChild, m);
    parent.removeChild(m);
    parent.normalize();
  });
}

/* Bring the DOM in line with the store — apply new highlights, drop removed
   ones. Safe to call repeatedly (on load and after a cross-device sync). */
function reconcile() {
  const root = getRoot();
  if (!root) return;
  const want = new Map(highlightsForPage(pageId()).map((h) => [h.id, h]));
  const present = new Set([...document.querySelectorAll('.dp-hl')].map((m) => m.dataset.hlId));
  for (const id of present) if (!want.has(id)) unwrap(id);
  for (const [id, h] of want) if (!present.has(id)) applyOne(root, h);
}

/* --- cross-device sync --------------------------------------------------- */
function push(recs) {
  if (recs.length) pushState(recs.map(hlItem));
}

/* --- the floating "highlight" toolbar ------------------------------------ */
let toolbar = null;
let pendingRange = null;

function buildToolbar() {
  toolbar = document.createElement('div');
  toolbar.className = 'dp-hl-bar';
  toolbar.hidden = true;
  toolbar.setAttribute('role', 'toolbar');
  toolbar.setAttribute('aria-label', t('hl.toolbar', 'Highlight selection'));
  for (const color of HL_COLORS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `dp-hl-bar__dot dp-hl--${color}`;
    b.title = t('hl.add', 'Highlight');
    b.setAttribute('aria-label', `${t('hl.add', 'Highlight')} — ${color}`);
    b.addEventListener('click', () => createHighlight(color));
    toolbar.appendChild(b);
  }
  // keep the selection alive when the toolbar is pressed
  toolbar.addEventListener('mousedown', (e) => e.preventDefault());
  document.body.appendChild(toolbar);
}

function showToolbarAt(rect) {
  if (!toolbar) buildToolbar();
  toolbar.hidden = false;
  const { offsetWidth: w, offsetHeight: h } = toolbar;
  let left = rect.left + rect.width / 2 - w / 2;
  left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
  let top = rect.top - h - 8;
  if (top < 8) top = rect.bottom + 8; // flip below if no room above
  toolbar.style.left = `${left}px`;
  toolbar.style.top = `${top}px`;
}

function hideToolbar() {
  if (toolbar) toolbar.hidden = true;
  pendingRange = null;
}

function updateToolbar() {
  const root = getRoot();
  const sel = window.getSelection();
  if (!root || !sel || sel.isCollapsed || !sel.rangeCount) return hideToolbar();
  const range = sel.getRangeAt(0);
  if (!root.contains(range.commonAncestorContainer)) return hideToolbar();
  const anc = range.commonAncestorContainer;
  const ancEl = anc.nodeType === 1 ? anc : anc.parentElement;
  if (ancEl && ancEl.closest(EXCLUDE)) return hideToolbar();
  if (sel.toString().trim().length < 2) return hideToolbar();
  pendingRange = range.cloneRange();
  showToolbarAt(range.getBoundingClientRect());
}

function createHighlight(color) {
  const root = getRoot();
  if (!root || !pendingRange) return hideToolbar();
  const index = buildIndex(root);
  let start = offsetOf(index, pendingRange.startContainer, pendingRange.startOffset);
  let end = offsetOf(index, pendingRange.endContainer, pendingRange.endOffset);
  if (start > end) [start, end] = [end, start];
  // trim whitespace the selection may have grabbed at the edges
  const raw = index.text.slice(start, end);
  start += raw.length - raw.trimStart().length;
  end -= raw.length - raw.trimEnd().length;
  const text = index.text.slice(start, end);
  if (text.trim().length < 2) return hideToolbar();
  const rec = putHighlight({
    id: newId(),
    page: pageId(),
    title: pageTitle(),
    text,
    prefix: index.text.slice(Math.max(0, start - CTX), start),
    suffix: index.text.slice(end, end + CTX),
    start,
    end,
    color,
  });
  window.getSelection()?.removeAllRanges();
  hideToolbar();
  applyOne(root, rec);
  push([rec]);
  window.dispatchEvent(new CustomEvent('dp:highlights', { detail: { id: rec.id } }));
}

/* --- remove popover (tap an existing highlight) -------------------------- */
let popover = null;

function hidePopover() {
  if (popover) {
    popover.remove();
    popover = null;
  }
}

function showPopover(mark) {
  hidePopover();
  const id = mark.dataset.hlId;
  popover = document.createElement('div');
  popover.className = 'dp-hl-pop';
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'dp-hl-pop__btn';
  remove.textContent = t('hl.remove', 'Remove highlight');
  remove.addEventListener('click', () => {
    removeHighlight(id);
    unwrap(id);
    push([{ id, del: true, u: Date.now() }]);
    hidePopover();
    window.dispatchEvent(new CustomEvent('dp:highlights', { detail: { id } }));
  });
  const open = document.createElement('a');
  open.className = 'dp-hl-pop__btn dp-hl-pop__btn--ghost';
  open.href = '/highlights/';
  open.textContent = t('hl.all', 'All highlights');
  popover.append(remove, open);
  popover.addEventListener('mousedown', (e) => e.stopPropagation());
  document.body.appendChild(popover);
  const rect = mark.getBoundingClientRect();
  const w = popover.offsetWidth;
  let left = rect.left + rect.width / 2 - w / 2;
  left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
  popover.style.left = `${left + window.scrollX}px`;
  popover.style.top = `${rect.bottom + window.scrollY + 8}px`;
}

/* --- content-page wiring ------------------------------------------------- */
function initContentPage() {
  const root = getRoot();
  if (!root) return;
  reconcile();

  // a /page/#hl-<id> deep link can't scroll on its own — the mark only exists
  // after reconcile() re-applies it, so jump to it now
  if (location.hash.startsWith('#hl-')) {
    const target = document.getElementById(location.hash.slice(1));
    if (target) target.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  document.addEventListener('mouseup', (e) => {
    if (e.target.closest?.('.dp-hl-bar, .dp-hl-pop')) return;
    setTimeout(updateToolbar, 0);
  });
  document.addEventListener('selectionchange', () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) hideToolbar();
  });

  root.addEventListener('click', (e) => {
    const mark = e.target.closest('.dp-hl');
    if (mark) {
      e.preventDefault();
      showPopover(mark);
    }
  });
  root.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.classList?.contains('dp-hl')) {
      e.preventDefault();
      showPopover(e.target);
    }
  });
  document.addEventListener('mousedown', (e) => {
    if (!e.target.closest?.('.dp-hl, .dp-hl-pop')) hidePopover();
  });
  window.addEventListener('dp:highlights', reconcile);
  // a cross-device sync merges into the store, then fires dp:highlights → reconcile
}

/* --- the /highlights/ collection page ------------------------------------ */
function initHighlightsPage() {
  const wrap = document.querySelector('[data-dp-highlights]');
  if (!wrap) return;
  const listEl = wrap.querySelector('[data-dp-highlights-list]');
  const emptyEl = wrap.querySelector('[data-dp-highlights-empty]');
  const countEl = wrap.querySelector('[data-dp-highlights-count]');
  const clearBtn = wrap.querySelector('[data-dp-highlights-clear]');
  const locale = document.documentElement.lang === 'ar' ? 'ar' : undefined;
  const fmtDate = (ms) => {
    const d = new Date(ms || 0);
    return isNaN(d) ? '' : d.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const render = () => {
    const all = listHighlights();
    if (countEl) countEl.textContent = String(all.length);
    if (clearBtn) clearBtn.hidden = all.length === 0;
    if (emptyEl) emptyEl.hidden = all.length !== 0;
    listEl.innerHTML = '';

    // group by page, preserving newest-first order of first appearance
    const groups = [];
    const byPage = new Map();
    for (const h of all) {
      let g = byPage.get(h.page);
      if (!g) {
        g = { page: h.page, title: h.title || h.page, items: [] };
        byPage.set(h.page, g);
        groups.push(g);
      }
      g.items.push(h);
    }

    for (const g of groups) {
      const sec = document.createElement('section');
      sec.className = 'dp-hl-group';
      const head = document.createElement('a');
      head.className = 'dp-hl-group__head';
      head.href = g.page + '/';
      head.innerHTML = `<span class="dp-hl-group__title"></span><span class="dp-hl-group__path"></span>`;
      head.querySelector('.dp-hl-group__title').textContent = g.title;
      head.querySelector('.dp-hl-group__path').textContent = g.page;
      sec.appendChild(head);

      for (const h of g.items) {
        const card = document.createElement('div');
        card.className = 'dp-hl-card';
        const quote = document.createElement('a');
        quote.className = `dp-hl-card__quote dp-hl--${HL_COLORS.includes(h.color) ? h.color : 'yellow'}`;
        quote.href = `${h.page}/#hl-${h.id}`;
        quote.textContent = h.text;
        const meta = document.createElement('div');
        meta.className = 'dp-hl-card__meta';
        const date = document.createElement('span');
        date.textContent = fmtDate(h.created);
        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'dp-hl-card__del';
        del.textContent = t('hl.remove', 'Remove');
        del.setAttribute('aria-label', t('hl.remove', 'Remove highlight'));
        del.addEventListener('click', () => {
          removeHighlight(h.id);
          push([{ id: h.id, del: true, u: Date.now() }]);
          render();
        });
        meta.append(date, del);
        card.append(quote, meta);
        sec.appendChild(card);
      }
      listEl.appendChild(sec);
    }
  };

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (!confirm(t('hl.clearConfirm', 'Remove all of your highlights? This cannot be undone.'))) return;
      const ids = listHighlights().map((h) => h.id);
      clearHighlights();
      const now = Date.now();
      push(ids.map((id) => ({ id, del: true, u: now })));
      render();
    });
  }
  window.addEventListener('dp:highlights', render); // repaint after a sync
  render();
}

function boot() {
  initContentPage();
  initHighlightsPage();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
