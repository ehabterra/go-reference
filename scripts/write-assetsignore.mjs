// Cloudflare Workers Static Assets serves every file under the assets
// directory (./dist) as a public asset. The Astro Cloudflare adapter (v12)
// emits the Worker code and Pages routing manifest into that same directory,
// so we must exclude them from the public asset set — otherwise the Worker
// source and routing config would be downloadable, and the asset layer could
// shadow the Worker. The adapter only writes `.assetsignore` automatically in
// its Workers mode (adapter v13 / Astro 6), so on the Astro 5 line we write it
// here as a post-build step.
import { writeFileSync } from 'node:fs';

const target = new URL('../dist/.assetsignore', import.meta.url);
writeFileSync(target, '_worker.js\n_routes.json\n');
console.log('[postbuild] wrote dist/.assetsignore');
