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
      alias: {
        'react-dom/server': 'react-dom/server.edge',
      },
    },
  },
});
