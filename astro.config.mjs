// @ts-check
import { defineConfig, envField } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// ── Build a path → lastmod map from local content so the sitemap can
//    advertise real freshness dates (from each post's modified date)
//    instead of omitting <lastmod>. ─────────────────────────────────
/** @type {Record<string, string>} */
const lastmodByPath = {};
try {
  const postsPath = fileURLToPath(new URL('./src/data/posts.json', import.meta.url));
  const data = JSON.parse(readFileSync(postsPath, 'utf-8'));
  const posts = Array.isArray(data) ? data : data.posts || [];
  for (const p of posts) {
    if (!p?.slug) continue;
    const mod = p.modified || p.date;
    if (!mod || Number.isNaN(new Date(mod).getTime())) continue;
    const iso = new Date(mod).toISOString();
    const key = `/blog/${p.slug}`;
    lastmodByPath[key] = iso;
    // Index both encoded and decoded forms so Thai slugs match regardless
    // of how the URL is percent-encoded in the generated sitemap.
    try { lastmodByPath[decodeURIComponent(key)] = iso; } catch { /* ignore */ }
    try { lastmodByPath[encodeURI(decodeURIComponent(key))] = iso; } catch { /* ignore */ }
  }
} catch (err) {
  console.warn('[sitemap] could not build lastmod map:', err?.message || err);
}

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
  integrations: [
    sitemap({
      serialize(item) {
        try {
          const path = new URL(item.url).pathname.replace(/\/$/, '');
          let lastmod = lastmodByPath[path];
          if (!lastmod) {
            try { lastmod = lastmodByPath[decodeURIComponent(path)]; } catch { /* ignore */ }
          }
          if (lastmod) item.lastmod = lastmod;
        } catch {
          // leave item untouched on any parse error
        }
        return item;
      },
    }),
  ],
  vite: {
    ssr: {
      noExternal: [],
    },
  },
});
