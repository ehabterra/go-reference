// Build a full-text search index from the rendered pages, so the ⌘K palette
// can match body content (not just titles) and deep-link to the matching
// section. We read the built HTML — not the raw MDX — because pages embed code
// inside JSX (`<Playground code={…} />`) that we want to skip, and because the
// rendered headings already carry the build-time `id`s we link to.
//
// Output: dist/search-index.json — fetched lazily by the client on first open.
import fs from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';

const DIST = new URL('../dist/', import.meta.url).pathname;
const LEVELS = ['Start here', 'Beginner', 'Intermediate', 'Advanced', 'Reference'];
const SECTION_CAP = 1400; // max chars indexed per section, to bound index size
// Appended chrome that isn't real page content — never index it.
const SKIP = 'pre, .dp-mermaid, .dp-pg, .dp-grid, .dp-quiz, .dp-tradeoffs, .dp-pager, .dp-comments, table';

// Walk dist for every article page (those with a `.dp-article__body`).
function* htmlFiles(dir) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) yield* htmlFiles(full);
    else if (name === 'index.html') yield full;
  }
}

const index = [];
for (const file of htmlFiles(DIST)) {
  const $ = cheerio.load(fs.readFileSync(file, 'utf8'));
  const body = $('.dp-article__body').first();
  if (!body.length) continue; // listing / non-article page

  const url = '/' + path.relative(DIST, file).replace(/index\.html$/, '');
  const title = $('.dp-hero h1').first().text().trim();
  const track = $('.dp-breadcrumb a').first().text().trim();
  const cat = $('.dp-badge[data-cat]').first().attr('data-cat') || '';
  let level = '';
  $('.dp-badge--muted').each((_, el) => {
    const t = $(el).text().trim();
    if (LEVELS.includes(t)) level = t;
  });

  // Walk prose in document order; headings start new sections, everything
  // between them accumulates as that section's searchable text.
  const secs = [];
  let cur = { h: '', a: '', x: '' };
  body.find('h2, h3, h4, p, li, blockquote').each((_, el) => {
    const $el = $(el);
    if ($el.closest(SKIP).length) return;
    const isHeading = /^h[234]$/i.test(el.tagName);
    if (isHeading) {
      const id = $el.attr('id');
      if (id === 'related' || id === 'quiz') return; // appended sections
      if (cur.h || cur.x.trim()) secs.push(cur);
      cur = { h: $el.text().trim(), a: id || '', x: '' };
      return;
    }
    const txt = $el.text().replace(/\s+/g, ' ').trim();
    if (txt && cur.x.length < SECTION_CAP) cur.x += (cur.x ? ' ' : '') + txt;
  });
  if (cur.h || cur.x.trim()) secs.push(cur);

  // Trim and drop empty sections; keep at least the page itself searchable.
  const sections = secs
    .map((s) => ({ h: s.h, a: s.a, x: s.x.slice(0, SECTION_CAP) }))
    .filter((s) => s.h || s.x);

  if (title) index.push({ t: title, u: url, c: cat, s: track, d: level, secs: sections });
}

const out = new URL('../dist/search-index.json', import.meta.url);
fs.writeFileSync(out, JSON.stringify(index));
const kb = (fs.statSync(out).size / 1024).toFixed(0);
console.log(`[postbuild] wrote dist/search-index.json — ${index.length} pages, ${kb} KB`);
