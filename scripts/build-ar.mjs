// Build an AR content array from authored translations + the EN block
// templates, so quiz numbering/whitespace/span wrappers match exactly.
// Usage: node scripts/build-ar.mjs <slug> <ar-inner-json-path>
//   EN blocks come from /tmp/content-en.json (run extract-i18n.mjs first).
//   The AR file is a flat array of "inner content" strings, same length.
//   For each block we detect the EN wrapper and re-wrap the AR inner:
//     " N.\n<span>..</span> "  -> question      (keep number + spaces)
//     " <span>..</span> "      -> option
//     "<span>..</span>"        -> callout title / heading span
//     anything else            -> prose (AR inner used verbatim as HTML)
import fs from 'node:fs';

const [slug, arPath] = process.argv.slice(2);
const en = JSON.parse(fs.readFileSync('/tmp/content-en.json', 'utf8'))[slug];
const ar = JSON.parse(fs.readFileSync(arPath, 'utf8'));
if (!en) throw new Error(`no EN blocks for ${slug}`);
if (en.length !== ar.length) throw new Error(`count mismatch EN=${en.length} AR=${ar.length}`);

const out = en.map((e, i) => {
  const a = ar[i];
  let m;
  if ((m = e.match(/^ (\d+)\.\n<span>[\s\S]*<\/span> $/))) return ` ${m[1]}.\n<span>${a}</span> `;
  if (/^ <span>[\s\S]*<\/span> $/.test(e)) return ` <span>${a}</span> `;
  if (/^<span>[\s\S]*<\/span>$/.test(e)) return `<span>${a}</span>`;
  return a;
});

const dest = `src/i18n/content/${slug}.json`;
fs.writeFileSync(dest, JSON.stringify(out, null, 0));
console.log(`wrote ${dest} (${out.length} blocks)`);
