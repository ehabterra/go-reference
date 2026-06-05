// Extract translatable prose blocks from built pattern pages, in the exact
// order the client runtime (ui.js i18nBlocks) collects them. Output: an
// English block array per slug, for translation into src/i18n/content/<slug>.json.
import fs from 'node:fs';
import * as cheerio from 'cheerio';

const base = process.argv[2] || '.vercel/output/static/patterns';
const out = {};

for (const slug of fs.readdirSync(base)) {
  const file = `${base}/${slug}/index.html`;
  if (!fs.existsSync(file)) continue;
  const $ = cheerio.load(fs.readFileSync(file, 'utf8'));
  const body = $('.dp-article__body').first();
  if (!body.length) continue;

  const blocks = [];
  body.find('h2,h3,h4,p,li,.dp-opt').each((_, el) => {
    const $el = $(el);
    if ($el.closest('pre, .dp-mermaid, .dp-pg, .dp-grid, .dp-pager, table').length) return;
    if ($el.hasClass('dp-card__intent')) return;
    if (!$el.text().trim()) return;
    blocks.push($.html($el.contents())); // innerHTML
  });
  out[slug] = blocks;
}

fs.writeFileSync('/tmp/content-en.json', JSON.stringify(out));
const counts = Object.entries(out).map(([k, v]) => `${k}:${v.length}`);
console.log(`extracted ${Object.keys(out).length} pages`);
console.log('block counts:', counts.join('  '));
