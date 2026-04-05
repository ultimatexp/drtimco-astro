/**
 * POST /api/create-article — Manually create an article draft.
 */
export const prerender = false;

import { neon } from '@neondatabase/serverless';

export async function POST({ request }) {
  const body = await request.json();
  const { id, key, title, slug, content, excerpt, seo_description, direct_answer, category, tags, image_url, status, focus_keyword, featured_image_url } = body;

  const adminPassword = import.meta.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD;

  // Accept auth via JSON body key (for scripts) OR via cookie (for CMS dashboard)
  const cookieString = request.headers.get('cookie') || '';
  const hasValidCookie = cookieString.includes(`adminSession=${adminPassword}`);
  const hasValidKey = key === adminPassword;

  if (!hasValidCookie && !hasValidKey) {
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

  let article;

  try {
    if (id) {
      // Update existing article
      const result = await sql`
      UPDATE article_drafts SET
        title = ${title},
        slug = ${finalSlug},
        content = ${content},
        excerpt = ${excerpt || ''},
        seo_description = ${seo_description || ''},
        direct_answer = ${direct_answer || ''},
        category = ${category || ''},
        tags = ${tags || []},
        image_url = ${image_url || ''},
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, title, slug
    `;
      article = result[0];
    } else {
      // Insert new article
      const result = await sql`
      INSERT INTO article_drafts (
        title, slug, content, excerpt, seo_description,
        direct_answer, category, tags, status, keyword, image_url,
        focus_keyword, featured_image_url
      ) VALUES (
        ${title},
        ${finalSlug},
        ${content},
        ${excerpt || ''},
        ${seo_description || ''},
        ${direct_answer || ''},
        ${category || ''},
        ${tags || []},
        ${status || 'draft'},
        'manual',
        ${image_url || featured_image_url || ''},
        ${focus_keyword || ''},
        ${featured_image_url || image_url || ''}
      )
      RETURNING id, title, slug
    `;
      article = result[0];
    }

    if (!article) {
      return new Response(JSON.stringify({ error: 'Article not found or update failed' }), { status: 404 });
    }

    return new Response(JSON.stringify({ success: true, article }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('create-article error:', err);
    return new Response(JSON.stringify({ error: 'Database error: ' + err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
