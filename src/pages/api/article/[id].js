/**
 * GET /api/article/[id] — Fetch full article content
 */
export const prerender = false;

import { neon } from '@neondatabase/serverless';
import { isAdminKey, unauthorizedJson } from '../../../lib/adminAuth.js';

export async function GET({ params, request }) {
    const url = new URL(request.url);
    const password = url.searchParams.get('key');

    if (!isAdminKey(password)) {
        return unauthorizedJson();
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
