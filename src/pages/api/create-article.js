/**
 * POST /api/create-article — Manually create an article draft.
 */
export const prerender = false;

import { neon } from '@neondatabase/serverless';

export async function POST({ request }) {
    const body = await request.json();
    const { key, title, slug, content, excerpt, seo_description, direct_answer, category, tags } = body;

    if (key !== (import.meta.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD)) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    if (!title || !content) {
        return new Response(JSON.stringify({ error: 'Title and content are required' }), { status: 400 });
    }

    const sql = neon(import.meta.env.NEON_DATABASE_URL || process.env.NEON_DATABASE_URL);

    // Auto-generate slug if not provided
    const finalSlug = slug || title
        .toLowerCase()
        .replace(/[^\w\s\u0E00-\u0E7F-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .substring(0, 80);

    const result = await sql`
    INSERT INTO article_drafts (
      title, slug, content, excerpt, seo_description,
      direct_answer, category, tags, status, keyword
    ) VALUES (
      ${title},
      ${finalSlug},
      ${content},
      ${excerpt || ''},
      ${seo_description || ''},
      ${direct_answer || ''},
      ${category || ''},
      ${tags || []},
      'review',
      'manual'
    )
    RETURNING id, title, slug
  `;

    return new Response(JSON.stringify({ success: true, article: result[0] }), {
        headers: { 'Content-Type': 'application/json' },
    });
}
