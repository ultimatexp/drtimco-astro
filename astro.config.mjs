// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://drtim.co',
  output: 'static',
  integrations: [sitemap()],
  vite: {
    ssr: {
      noExternal: [],
    },
  },
});
