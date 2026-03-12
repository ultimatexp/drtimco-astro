/**
 * sync-approved-articles.js
 * ──────────────────────────────────────────────────────
 * Build-time script: fetches approved/published articles
 * from Neon DB and merges them into posts.json.
 * 
 * Run before Astro build:
 *   NEON_DATABASE_URL=... node scripts/sync-approved-articles.js
 */

import { neon } from '@neondatabase/serverless';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATABASE_URL = process.env.NEON_DATABASE_URL;

if (!DATABASE_URL) {
    console.log('ℹ️  NEON_DATABASE_URL not set, skipping article sync');
    process.exit(0);
}

const sql = neon(DATABASE_URL);

async function syncArticles() {
    console.log('🔄 Syncing approved articles from Neon DB...\n');

    // 1. Fetch approved/published articles
    const articles = await sql`
    SELECT * FROM article_drafts 
    WHERE status IN ('approved', 'published')
    ORDER BY published_at DESC
  `;

    if (articles.length === 0) {
        console.log('ℹ️  No approved articles to sync.');
        return;
    }

    console.log(`📝 Found ${articles.length} approved article(s)`);

    // 2. Load existing posts.json
    const postsPath = join(__dirname, '..', 'src', 'data', 'posts.json');
    let existingPosts = [];
    try {
        existingPosts = JSON.parse(readFileSync(postsPath, 'utf8'));
    } catch {
        console.log('⚠️  Could not read posts.json, creating new one');
    }

    // 3. Convert Neon articles to WordPress-compatible format
    const newPosts = articles.map(a => ({
        id: 100000 + a.id, // High ID to avoid collision with WP posts
        title: a.title,
        slug: a.slug,
        date: a.published_at || a.created_at,
        modified: a.reviewed_at || a.created_at,
        excerpt: `<p>${a.excerpt || ''}</p>`,
        content: a.content,
        link: `https://drtim.co/blog/${a.slug}`,
        categories: a.category ? [{ id: 0, name: a.category, slug: slugify(a.category) }] : [],
        tags: (a.tags || []).map((t, i) => ({ id: i, name: t, slug: slugify(t) })),
        author: {
            name: 'Dr. Tim',
            slug: 'dr-tim',
            description: 'Functional Medicine physician specializing in metabolic health',
            avatar: '',
        },
        featuredImage: (a.image_url || a.featured_image_url) ? {
            sourceUrl: a.image_url || a.featured_image_url,
            altText: a.title,
            width: 1200,
            height: 630,
        } : null,
        // AI metadata
        _source: 'ai-generated',
        _seo_description: a.seo_description,
        _direct_answer: a.direct_answer,
    }));

    // 4. Merge: remove existing AI posts and re-add updated ones
    const wpPosts = existingPosts.filter(p => !p._source || p._source !== 'ai-generated');
    const merged = [...newPosts, ...wpPosts];

    // 5. Write back
    writeFileSync(postsPath, JSON.stringify(merged, null, 2));
    console.log(`✅ Merged ${newPosts.length} AI articles + ${wpPosts.length} WP posts = ${merged.length} total`);
}

function slugify(text) {
    return text
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
}

syncArticles().catch(err => {
    console.error('❌ Sync failed:', err.message);
    process.exit(1);
});
