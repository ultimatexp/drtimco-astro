/**
 * GET /api/article/[id] — Fetch full article content
 */
export const prerender = false;

import { neon } from '@neondatabase/serverless';

export async function GET({ params, request }) {
    const url = new URL(request.url);
    const password = url.searchParams.get('key');

    if (password !== (import.meta.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD)) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const sql = neon(import.meta.env.NEON_DATABASE_URL || process.env.NEON_DATABASE_URL);
    const { id } = params;

    const rows = await sql`SELECT * FROM article_drafts WHERE id = ${id}`;

    if (rows.length === 0) {
        return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
    }

    return new Response(JSON.stringify(rows[0]), {
        headers: { 'Content-Type': 'application/json' },
    });
}
