// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  // Update to your custom domain once attached to the Worker.
  site: 'https://go-reference.workers.dev',
  integrations: [mdx(), react()],
  adapter: cloudflare(),
  markdown: {
    shikiConfig: {
      theme: 'github-dark-default',
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
