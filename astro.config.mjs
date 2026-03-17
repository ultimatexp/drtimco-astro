// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';

// https://astro.build/config
export default defineConfig({
  site: 'https://drtim.co',
  output: 'static',
  adapter: vercel({ edgeMiddleware: true }),
  integrations: [sitemap()],
  vite: {
    ssr: {
      noExternal: [],
    },
  },
});
