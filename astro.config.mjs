// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import cloudflare from '@astrojs/cloudflare';

// Give every content heading (h2–h4) a stable, build-time `id` derived from
// its text, so deep links like `/stdlib/time#zones` resolve on first paint —
// before any client JS runs. The slug rule MUST match `slugify()` in
// src/scripts/progress.js so the runtime TOC fallback stays consistent.
function rehypeHeadingIds() {
  const slugify = (s) =>
    s.toLowerCase().replace(/[^\w]+/g, '-').replace(/^-+|-+$/g, '');
  const toText = (node) =>
    node.type === 'text'
      ? node.value
      : (node.children || []).map(toText).join('');
  return (tree) => {
    const seen = new Map(); // base slug -> count, for de-duping repeats
    const walk = (node) => {
      for (const child of node.children || []) {
        if (
          child.type === 'element' &&
          /^h[2-4]$/.test(child.tagName) &&
          !child.properties?.id
        ) {
          const base = slugify(toText(child)) || 'section';
          const n = seen.get(base) || 0;
          seen.set(base, n + 1);
          child.properties = child.properties || {};
          child.properties.id = n ? `${base}-${n}` : base;
        }
        walk(child);
      }
    };
    walk(tree);
  };
}

// https://astro.build/config
export default defineConfig({
  // Update to your custom domain once attached to the Worker.
  site: 'https://go-reference.workers.dev',
  integrations: [mdx(), react()],
  adapter: cloudflare({
    // Expose wrangler.jsonc bindings (D1) under `astro dev` via Miniflare.
    platformProxy: { enabled: true },
  }),
  markdown: {
    rehypePlugins: [rehypeHeadingIds],
    shikiConfig: {
      // Dual-theme output: colors come as --shiki-light/--shiki-dark CSS
      // vars (defaultColor:false), switched by [data-theme] in global.css.
      themes: { light: 'github-light', dark: 'github-dark-default' },
      defaultColor: false,
      wrap: false,
    },
  },
  vite: {
    resolve: {
      // @astrojs/react imports the bare `react-dom/server`, which resolves to
      // the `server.browser` build under workerd — that build references
      // `MessageChannel`, which the Workers runtime doesn't expose, so SSR
      // crashes at startup. Force the Web-Streams `server.edge` build instead.
      //
      // Build-only: `server.edge.js` is CommonJS and loads correctly under
      // workerd, but `astro dev` runs SSR in Node, where its `require` calls
      // throw "require is not defined". In dev we let `react-dom/server`
      // resolve to its Node build as usual.
      alias: process.argv.includes('build')
        ? { 'react-dom/server': 'react-dom/server.edge' }
        : {},
    },
  },
});
