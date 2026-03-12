/**
 * GET /api/articles — Fetch article drafts from Neon DB.
 * Query params: ?status=review (optional filter)
 */
export const prerender = false;

import { neon } from '@neondatabase/serverless';

export async function GET({ request }) {
  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const password = url.searchParams.get('key');

  // Simple admin auth
  if (password !== (import.meta.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const sql = neon(import.meta.env.NEON_DATABASE_URL || process.env.NEON_DATABASE_URL);

  let rows;
  if (status) {
    rows = await sql`
      SELECT id, title, slug, excerpt, category, tags, status, image_url,
             keyword, admin_notes, created_at, reviewed_at, published_at
      FROM article_drafts 
      WHERE status = ${status}
      ORDER BY created_at DESC
    `;
  } else {
    rows = await sql`
      SELECT id, title, slug, excerpt, category, tags, status, image_url,
             keyword, admin_notes, created_at, reviewed_at, published_at
      FROM article_drafts 
      ORDER BY created_at DESC
      LIMIT 50
    `;
  }

  return new Response(JSON.stringify(rows), {
    headers: { 'Content-Type': 'application/json' },
  });
}
