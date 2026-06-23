/* Select-to-highlight on content pages + the /highlights/ collection page.
   Highlights live in localStorage (highlight-store) and re-anchor to the prose
   by character offset, with the highlighted text + surrounding context as a
   fallback when offsets drift between builds. Cross-device sync rides the same
   /api/state store the review schedule uses. No framework — runs on every page,
   no-ops where there's nothing to do. */
import {
  putHighlight,
  removeHighlight,
  setHighlightNote,
  setHighlightColor,
  listHighlights,
  highlightsForPage,
  clearHighlights,
  loadHighlights,
  newId,
  HL_COLORS,
} from '../lib/highlight-store';
import { pushState, hlItem } from '../lib/state-sync';
import { fetchStats, reportBlocks, statsOptedOut, setStatsOptOut } from '../lib/highlight-stats';
import { t } from '../lib/i18n-client';

// Prose only: skip the runnable editor, quiz, diagrams, and the after-content
// components so offsets are a stable function of the article's words alone.
const EXCLUDE =
  '.dp-pg, .dp-playground, [data-dp-quiz], .dp-quiz, .dp-pager, .dp-comments, ' +
  '.dp-grid, .dp-tradeoffs, .dp-mermaid, .mermaid, svg, script, style, button, .dp-draft';
const CTX = 32; // chars of context stored on each side for re-anchoring
const STAT_MIN = 2; // surface the "readers highlighted this" cue only past this count

// inline pencil glyph, reused on the toolbar's note action and the "add note" cue
const NOTE_ICON =
  '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" ' +
  'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';

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
      if (hl.note) mark.dataset.hasNote = '1'; // ✎ badge on the first mark only
      anchored = true;
    }
    node.parentNode.insertBefore(mark, node);
    mark.appendChild(node);
  }
  return anchored;
}

const currentLang = () => (document.documentElement.dataset.lang === 'ar' ? 'ar' : 'en');

// The page's translatable prose blocks, in document order. MUST mirror
// i18nBlocks() in scripts/ui.js so block index N means the same paragraph in
// either language — that positional alignment is what lets an English
// highlight light up its Arabic counterpart.
function proseBlocks() {
  const body = getRoot();
  if (!body) return [];
  return Array.from(body.querySelectorAll('h2,h3,h4,p,li,.dp-opt')).filter(
    (el) =>
      !el.closest('pre, .dp-mermaid, .dp-pg, .dp-grid, .dp-pager, table') &&
      !el.classList.contains('dp-card__intent') &&
      (el.textContent || '').trim().length > 0
  );
}

function blocksInRange(range) {
  const out = [];
  proseBlocks().forEach((el, i) => {
    try {
      if (range.intersectsNode(el)) out.push(i);
    } catch {}
  });
  return out;
}

// Cross-language fallback: tint the whole matching paragraph(s). The class sits
// on the block element, which survives the innerHTML swap a language switch does
// (reconcile re-evaluates every highlight on dp:lang anyway).
function applyBlocks(hl) {
  if (!hl.blocks?.length) return false;
  const blocks = proseBlocks();
  const color = HL_COLORS.includes(hl.color) ? hl.color : 'yellow';
  let any = false;
  hl.blocks.forEach((i, k) => {
    const el = blocks[i];
    if (!el) return;
    el.classList.add('dp-hl-block', `dp-hl--${color}`);
    const tagged = (el.dataset.hlBlock || '').split(' ').filter(Boolean);
    if (!tagged.includes(hl.id)) tagged.push(hl.id);
    el.dataset.hlBlock = tagged.join(' ');
    if (k === 0) {
      if (!el.id) el.id = 'hl-' + hl.id;
      if (hl.note) el.dataset.hasNote = '1';
    }
    any = true;
  });
  return any;
}

// Render one highlight: exact word-level marks when its text is on the page
// (same language), else the whole-paragraph fallback (other language / orphan).
function applyOne(root, hl) {
  const index = buildIndex(root);
  const r = findRange(index, hl);
  if (r) return wrapRange(index, r.start, r.end, hl);
  return applyBlocks(hl);
}

function unwrap(id) {
  document.querySelectorAll(`.dp-hl[data-hl-id="${CSS.escape(id)}"]`).forEach((m) => {
    const parent = m.parentNode;
    while (m.firstChild) parent.insertBefore(m.firstChild, m);
    parent.removeChild(m);
    parent.normalize();
  });
}

// Highlight ids currently in the DOM — as precise marks or as block tints.
function renderedIds() {
  const ids = new Set();
  document.querySelectorAll('.dp-hl[data-hl-id]').forEach((m) => ids.add(m.dataset.hlId));
  document
    .querySelectorAll('[data-hl-block]')
    .forEach((el) => (el.dataset.hlBlock || '').split(' ').forEach((id) => id && ids.add(id)));
  return ids;
}

// Remove every trace of one highlight: its marks and its share of any block tint.
function removeRendered(id) {
  unwrap(id);
  document.querySelectorAll(`[data-hl-block~="${CSS.escape(id)}"]`).forEach((el) => {
    const rest = (el.dataset.hlBlock || '').split(' ').filter((x) => x && x !== id);
    if (rest.length) {
      el.dataset.hlBlock = rest.join(' ');
    } else {
      delete el.dataset.hlBlock;
      delete el.dataset.hasNote;
      el.classList.remove('dp-hl-block', ...HL_COLORS.map((c) => `dp-hl--${c}`));
      if (el.id === 'hl-' + id) el.removeAttribute('id');
    }
  });
}

/* Bring the DOM in line with the store. A full refresh (clear all, re-apply
   from the store) — cheap for the handful of highlights a page carries, and the
   only correct option after a language switch, where a highlight can flip
   between precise marks and a paragraph tint. */
function reconcile() {
  const root = getRoot();
  if (!root) return;
  for (const id of renderedIds()) removeRendered(id);
  for (const h of highlightsForPage(pageId())) applyOne(root, h);
}

/* --- cross-device sync --------------------------------------------------- */
function push(recs) {
  if (recs.length) pushState(recs.map(hlItem));
}

/* --- anonymous "readers highlighted this" stats -------------------------- */
// The prose blocks this visitor currently has any highlight on (deduped). This
// is the only thing reported to the aggregate — paragraph indices, nothing else.
function myBlocks() {
  const set = new Set();
  for (const h of highlightsForPage(pageId())) (h.blocks || []).forEach((b) => set.add(b));
  return [...set];
}

// Paint the soft margin cue on paragraphs others have also highlighted. A
// separate channel from the user's own marks/tints (a gutter bar, not a
// background), so the two never fight.
function renderStats(counts) {
  proseBlocks().forEach((el, i) => {
    const n = counts[i] || counts[String(i)] || 0;
    if (n >= STAT_MIN) {
      el.classList.add('dp-hl-stat');
      el.dataset.hlCount = String(n);
      el.style.setProperty('--stat', String(Math.min(n, 8)));
      el.title = t('hl.statReaders', `Highlighted by ${n} readers`).replace('{n}', String(n));
    } else if (el.classList.contains('dp-hl-stat')) {
      el.classList.remove('dp-hl-stat');
      delete el.dataset.hlCount;
      el.style.removeProperty('--stat');
      el.removeAttribute('title');
    }
  });
}

async function refreshStats() {
  if (!getRoot()) return;
  renderStats(await fetchStats(pageId()));
}

// Report my current block set, then repaint shortly after so my own change is
// reflected (best-effort — the read is edge-cached, so others converge within
// the cache window).
function syncStats() {
  reportBlocks(pageId(), myBlocks());
  setTimeout(refreshStats, 1500);
}

/* --- the floating "highlight" toolbar ------------------------------------ */
let toolbar = null;
let pendingRange = null;
// Set while a toolbar dot is being pressed. On touch, tapping a dot collapses
// the selection before the button's click fires; this guards selectionchange
// from tearing down the bar (and pendingRange) in that window.
let toolbarHold = false;

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
  // a divider, then the "highlight + write a note" action: highlights in the
  // first colour and opens the note editor on the new mark in one gesture
  const sep = document.createElement('span');
  sep.className = 'dp-hl-bar__sep';
  sep.setAttribute('aria-hidden', 'true');
  toolbar.appendChild(sep);
  const note = document.createElement('button');
  note.type = 'button';
  note.className = 'dp-hl-bar__note';
  note.title = t('hl.note', 'Highlight & add a note');
  note.setAttribute('aria-label', t('hl.note', 'Highlight and add a note'));
  note.innerHTML = NOTE_ICON;
  note.addEventListener('click', () => createHighlight(HL_COLORS[0], true));
  toolbar.appendChild(note);
  // keep the selection alive when the toolbar is pressed
  toolbar.addEventListener('mousedown', (e) => e.preventDefault());
  // On touch there's no mousedown until after the tap; hold the bar from the
  // first pointer/touch contact so the collapsing selection can't dismiss it.
  const hold = () => {
    toolbarHold = true;
  };
  toolbar.addEventListener('pointerdown', hold, { passive: true });
  toolbar.addEventListener('touchstart', hold, { passive: true });
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
  toolbarHold = false;
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

// Ids of existing highlights whose marks the range touches — so re-highlighting
// over them toggles/recolours instead of stacking a second <mark>.
function highlightsInRange(range) {
  const ids = [];
  const add = (id) => {
    if (id && !ids.includes(id)) ids.push(id);
  };
  document.querySelectorAll('.dp-hl[data-hl-id]').forEach((m) => {
    try {
      if (range.intersectsNode(m)) add(m.dataset.hlId);
    } catch {}
  });
  document.querySelectorAll('[data-hl-block]').forEach((el) => {
    try {
      if (range.intersectsNode(el)) (el.dataset.hlBlock || '').split(' ').forEach(add);
    } catch {}
  });
  return ids;
}

function createHighlight(color, withNote = false) {
  const root = getRoot();
  if (!root || !pendingRange) return hideToolbar();

  // what already-highlighted text does this selection cover?
  const overlapIds = highlightsInRange(pendingRange);
  const store = loadHighlights();
  const overlapped = overlapIds.map((id) => store[id]).filter((h) => h && !h.del);

  const index = buildIndex(root);
  let start = offsetOf(index, pendingRange.startContainer, pendingRange.startOffset);
  let end = offsetOf(index, pendingRange.endContainer, pendingRange.endOffset);
  if (start > end) [start, end] = [end, start];
  // trim whitespace the selection may have grabbed at the edges
  const raw = index.text.slice(start, end);
  start += raw.length - raw.trimStart().length;
  end -= raw.length - raw.trimEnd().length;
  let text = index.text.slice(start, end);
  let blocks = blocksInRange(pendingRange);

  window.getSelection()?.removeAllRanges();
  hideToolbar();

  // never nest: drop every highlight the selection touches first
  const now = Date.now();
  const tombs = overlapIds.map((id) => {
    removeHighlight(id, now);
    return { id, del: true, u: now };
  });

  // re-highlighting one existing mark: same colour just removes it (an
  // un-highlight), a different colour recolours its whole original span
  const single = overlapped.length === 1 ? overlapped[0] : null;
  const reselect = single && typeof single.start === 'number' && single.start <= start && single.end >= end;
  const finish = (extra) => {
    if (extra) push([...tombs, extra]);
    else if (tombs.length) push(tombs);
    window.dispatchEvent(new CustomEvent('dp:highlights', { detail: {} }));
  };

  if (reselect && (single.color || 'yellow') === color) return finish(); // toggled off
  if (reselect) {
    start = single.start;
    end = single.end;
    text = single.text || index.text.slice(start, end);
    blocks = single.blocks || blocks;
  }
  if (text.trim().length < 2) return finish();

  // store only — reconcile (via dp:highlights below) renders the marks/tints
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
    blocks,
    lang: currentLang(),
  });
  finish(rec);
  // "highlight + note": the mark now exists (reconcile ran inside finish) — open
  // the editor on it so the reader can type straight away
  if (withNote) {
    const mark = document.getElementById('hl-' + rec.id);
    if (mark) showPopover(mark, { focusNote: true });
  }
}

/* --- the highlight card (tap an existing highlight) ----------------------
   A small editor: recolour swatches, a personal note, and remove. The note
   saves on blur / on close (and recolours apply instantly); every change bumps
   the record's `u` so it syncs across devices like the highlight itself. */
let popover = null;
let editing = null; // { id } of the highlight whose note is being edited

// Persist the textarea's note if it changed since the card opened.
function flushNote() {
  if (!editing || !popover) return;
  const ta = popover.querySelector('.dp-hl-note');
  if (!ta) return;
  const prev = loadHighlights()[editing.id]?.note || '';
  if (ta.value.trim() === prev.trim()) return;
  const rec = setHighlightNote(editing.id, ta.value);
  if (rec) {
    push([rec]);
    window.dispatchEvent(new CustomEvent('dp:highlights', { detail: { id: editing.id } }));
  }
}

function hidePopover() {
  if (!popover) return;
  flushNote();
  popover.remove();
  popover = null;
  editing = null;
}

function positionPopover(mark) {
  const rect = mark.getBoundingClientRect();
  const w = popover.offsetWidth;
  const h = popover.offsetHeight;
  let left = rect.left + rect.width / 2 - w / 2;
  left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
  // below by default; flip above when it would run off the bottom and there's room
  let top = rect.bottom + 8;
  if (top + h > window.innerHeight - 8 && rect.top - h - 8 > 8) top = rect.top - h - 8;
  popover.style.left = `${left + window.scrollX}px`;
  popover.style.top = `${top + window.scrollY}px`;
}

function showPopover(mark, opts = {}) {
  hidePopover();
  const id = mark.dataset.hlId;
  const hl = loadHighlights()[id];
  if (!hl || hl.del) return;
  editing = { id };

  popover = document.createElement('div');
  popover.className = `dp-hl-pop dp-hl-pop--card dp-hl--${HL_COLORS.includes(hl.color) ? hl.color : 'yellow'}`;
  popover.setAttribute('role', 'dialog');
  popover.setAttribute('aria-label', t('hl.edit', 'Edit highlight'));

  // the note, with an auto-growing field (the passage itself is already marked
  // in front of the reader, so the card doesn't repeat it)
  const ta = document.createElement('textarea');
  ta.className = 'dp-hl-note';
  ta.rows = 2;
  ta.placeholder = t('hl.notePlaceholder', 'Add a note…');
  ta.value = hl.note || '';
  const autoGrow = () => {
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
  };
  ta.addEventListener('input', autoGrow);
  ta.addEventListener('change', flushNote); // blur
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || (e.key === 'Enter' && (e.metaKey || e.ctrlKey))) {
      e.preventDefault();
      hidePopover();
    }
  });

  // recolour swatches
  const colors = document.createElement('div');
  colors.className = 'dp-hl-pop__colors';
  for (const color of HL_COLORS) {
    const sw = document.createElement('button');
    sw.type = 'button';
    sw.className = `dp-hl-pop__swatch dp-hl--${color}`;
    sw.setAttribute('aria-label', `${t('hl.recolor', 'Recolour')} — ${color}`);
    sw.setAttribute('aria-pressed', String((hl.color || 'yellow') === color));
    sw.addEventListener('click', () => {
      flushNote();
      const rec = setHighlightColor(id, color);
      if (rec) {
        popover.classList.remove(...HL_COLORS.map((c) => `dp-hl--${c}`));
        popover.classList.add(`dp-hl--${color}`);
        push([rec]);
        window.dispatchEvent(new CustomEvent('dp:highlights', { detail: { id } }));
      }
      colors
        .querySelectorAll('.dp-hl-pop__swatch')
        .forEach((s) => s.setAttribute('aria-pressed', String(s === sw)));
    });
    colors.appendChild(sw);
  }

  // actions row: recolour on the left, remove + open on the right
  const actions = document.createElement('div');
  actions.className = 'dp-hl-pop__actions';
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'dp-hl-pop__btn dp-hl-pop__btn--del';
  remove.textContent = t('hl.remove', 'Remove');
  remove.addEventListener('click', () => {
    editing = null; // don't flush a note onto a highlight we're deleting
    removeHighlight(id);
    removeRendered(id);
    push([{ id, del: true, u: Date.now() }]);
    hidePopover();
    window.dispatchEvent(new CustomEvent('dp:highlights', { detail: { id } }));
  });
  const open = document.createElement('a');
  open.className = 'dp-hl-pop__btn dp-hl-pop__btn--ghost';
  open.href = '/highlights/';
  open.textContent = t('hl.all', 'All highlights');
  open.addEventListener('click', flushNote); // save before we navigate away
  actions.append(colors, remove, open);

  // a quiet hint at the keyboard shortcuts
  const mac = /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent || '');
  const hint = document.createElement('p');
  hint.className = 'dp-hl-pop__hint';
  hint.textContent = t('hl.noteHint', `${mac ? '⌘' : 'Ctrl'}↵ to save · Esc to close`);

  popover.append(ta, actions, hint);
  // a press inside the card must not bubble to the document mousedown that
  // dismisses it, nor cancel the live selection logic
  popover.addEventListener('mousedown', (e) => e.stopPropagation());
  document.body.appendChild(popover);
  autoGrow();
  positionPopover(mark);
  if (opts.focusNote) {
    ta.focus();
    const end = ta.value.length;
    ta.setSelectionRange(end, end); // caret at the end, ready to type
  }
}

/* --- content-page wiring ------------------------------------------------- */
function initContentPage() {
  const root = getRoot();
  if (!root) return;
  reconcile();
  refreshStats(); // paint how many readers marked each paragraph
  const initial = myBlocks(); // backfill the aggregate with what's already here
  if (initial.length) reportBlocks(pageId(), initial);

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

  // Desktop pops the bar on mouseup. Touch devices fire no mouseup when you drag
  // the native selection handles — only selectionchange — so on a coarse pointer
  // we watch the selection settle and show the bar then.
  const coarsePointer =
    (typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches) ||
    navigator.maxTouchPoints > 0;
  let selTimer = null;
  document.addEventListener('selectionchange', () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) {
      if (toolbarHold) return; // a toolbar tap collapsed it — keep the bar alive
      clearTimeout(selTimer);
      return hideToolbar();
    }
    if (coarsePointer) {
      clearTimeout(selTimer);
      selTimer = setTimeout(updateToolbar, 300); // debounce: wait for the drag to settle
    }
  });
  // A tap outside the bar (to dismiss, or to start a new selection) clears a
  // bar left up after a cancelled toolbar press.
  document.addEventListener(
    'pointerdown',
    (e) => {
      if (toolbar && !toolbar.hidden && !e.target.closest?.('.dp-hl-bar')) hideToolbar();
    },
    true
  );

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
  window.addEventListener('dp:highlights', () => {
    reconcile();
    syncStats(); // my block set may have changed — report it and repaint
  });
  // a cross-device sync merges into the store, then fires dp:highlights → reconcile
  // a language switch re-renders the prose innerHTML (dropping our marks) — the
  // marks whose text exists in the now-current language get re-applied
  window.addEventListener('dp:lang', () => {
    reconcile();
    refreshStats(); // blocks realign positionally across languages
  });
}

/* --- the /highlights/ collection page ------------------------------------ */
function initHighlightsPage() {
  const wrap = document.querySelector('[data-dp-highlights]');
  if (!wrap) return;
  const listEl = wrap.querySelector('[data-dp-highlights-list]');
  const emptyEl = wrap.querySelector('[data-dp-highlights-empty]');
  const countEl = wrap.querySelector('[data-dp-highlights-count]');
  const clearBtn = wrap.querySelector('[data-dp-highlights-clear]');

  // opt in/out of contributing to the anonymous "readers highlighted this" counts
  const optoutEl = wrap.querySelector('[data-dp-hl-stats-optout]');
  if (optoutEl) {
    optoutEl.checked = !statsOptedOut();
    optoutEl.addEventListener('change', () => setStatsOptOut(!optoutEl.checked));
  }

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
        if (h.note) {
          const noteEl = document.createElement('p');
          noteEl.className = 'dp-hl-card__note';
          noteEl.textContent = h.note;
          card.append(quote, noteEl, meta);
        } else {
          card.append(quote, meta);
        }
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
