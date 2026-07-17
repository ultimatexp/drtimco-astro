export const prerender = false;

import { neon } from '@neondatabase/serverless';
import { isAdminSession, unauthorizedJson } from '../../../../../lib/adminAuth.js';

/**
 * DELETE /api/admin/article/[id]  — move an article to trash
 * POST   /api/admin/article/[id]  — { action: 'restore' } to bring it back
 *
 * Soft delete: sets deleted_at rather than removing the row, because the CMS
 * has no revision history and posts.json is rebuilt from this table. The build
 * sync skips rows with deleted_at set, so trashing a published article also
 * drops it from the live site on the next deploy.
 */
function json(body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

function getSql() {
    return neon(import.meta.env.NEON_DATABASE_URL || process.env.NEON_DATABASE_URL);
}

function parseId(raw) {
    const id = Number.parseInt(raw, 10);
    return Number.isInteger(id) && id > 0 ? id : null;
}

export async function DELETE({ params, cookies }) {
    if (!isAdminSession(cookies)) return unauthorizedJson();

    const id = parseId(params.id);
    if (!id) return json({ success: false, error: 'Invalid article id.' }, 400);

    try {
        const rows = await getSql()`
            UPDATE article_drafts
            SET deleted_at = NOW()
            WHERE id = ${id} AND deleted_at IS NULL
            RETURNING id, title, status
        `;
        if (rows.length === 0) {
            return json({ success: false, error: 'Article not found, or already in trash.' }, 404);
        }
        return json({ success: true, article: rows[0] });
    } catch (e) {
        return json({ success: false, error: e.message }, 500);
    }
}

export async function POST({ params, cookies, request }) {
    if (!isAdminSession(cookies)) return unauthorizedJson();

    const id = parseId(params.id);
    if (!id) return json({ success: false, error: 'Invalid article id.' }, 400);

    const body = await request.json().catch(() => ({}));
    if (body.action !== 'restore') {
        return json({ success: false, error: "Unsupported action. Expected { action: 'restore' }." }, 400);
    }

    try {
        const rows = await getSql()`
            UPDATE article_drafts
            SET deleted_at = NULL
            WHERE id = ${id} AND deleted_at IS NOT NULL
            RETURNING id, title, status
        `;
        if (rows.length === 0) {
            return json({ success: false, error: 'Article not found, or not in trash.' }, 404);
        }
        return json({ success: true, article: rows[0] });
    } catch (e) {
        return json({ success: false, error: e.message }, 500);
    }
}
