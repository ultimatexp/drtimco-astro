// @ts-check
import { defineConfig, envField } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';

// https://astro.build/config
export default defineConfig({
  site: 'https://drtim.co',
  output: 'server',
  adapter: vercel(),
  env: {
    schema: {
      ADMIN_PASSWORD: envField.string({ context: 'server', access: 'secret', optional: true }),
    },
  },
  integrations: [sitemap()],
  vite: {
    ssr: {
      noExternal: [],
    },
  },
});
