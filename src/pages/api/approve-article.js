/**
 * POST /api/approve-article — Approve or reject an article draft.
 * 
 * Body: { id, action: 'approve' | 'reject', notes?: string }
 * 
 * On approve:
 *   1. Updates article status to 'approved' 
 *   2. Posts to Facebook Page (if FB token configured)
 *   3. Triggers Vercel deploy hook to rebuild the site
 */
export const prerender = false;

import { neon } from '@neondatabase/serverless';

export async function POST({ request }) {
    const body = await request.json();
    const { id, action, notes, key } = body;

    // Simple admin auth
    if (key !== (import.meta.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD)) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    if (!id || !['approve', 'reject'].includes(action)) {
        return new Response(
            JSON.stringify({ error: 'Missing id or invalid action' }),
            { status: 400 }
        );
    }

    const sql = neon(import.meta.env.NEON_DATABASE_URL || process.env.NEON_DATABASE_URL);

    if (action === 'reject') {
        await sql`
      UPDATE article_drafts 
      SET status = 'rejected', admin_notes = ${notes || ''}, reviewed_at = NOW() 
      WHERE id = ${id}
    `;
        return new Response(JSON.stringify({ success: true, action: 'rejected' }));
    }

    // ── Approve flow ────────────────────────────────────
    // 1. Update status
    const rows = await sql`
    UPDATE article_drafts 
    SET status = 'approved', admin_notes = ${notes || ''}, reviewed_at = NOW(), published_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `;

    if (rows.length === 0) {
        return new Response(JSON.stringify({ error: 'Article not found' }), { status: 404 });
    }

    const article = rows[0];
    const results = { success: true, action: 'approved', facebook: null, deploy: null };

    // 2. Post to Facebook (if configured)
    const fbToken = import.meta.env.FB_PAGE_ACCESS_TOKEN || process.env.FB_PAGE_ACCESS_TOKEN;
    const fbPageId = import.meta.env.FB_PAGE_ID || process.env.FB_PAGE_ID;
    const siteUrl = import.meta.env.SITE_URL || 'https://drtim.co';

    if (fbToken && fbPageId) {
        try {
            const articleUrl = `${siteUrl}/blog/${article.slug}`;
            const message = `📝 บทความใหม่!\n\n${article.title}\n\n${article.excerpt}\n\n👉 อ่านเพิ่มเติม: ${articleUrl}`;

            let fbEndpoint = `https://graph.facebook.com/v19.0/${fbPageId}/feed`;
            let fbPayload = {
                message: message,
                link: articleUrl,
                access_token: fbToken,
            };

            // Use /photos endpoint if we have an image
            if (article.image_url) {
                fbEndpoint = `https://graph.facebook.com/v19.0/${fbPageId}/photos`;

                // Ensure image URL is absolute
                let absoluteImageUrl = article.image_url;
                if (!absoluteImageUrl.startsWith('http')) {
                    absoluteImageUrl = `${siteUrl}${article.image_url.startsWith('/') ? '' : '/'}${article.image_url}`;
                }

                fbPayload = {
                    url: absoluteImageUrl,
                    caption: message,
                    access_token: fbToken,
                };
            }

            const fbResponse = await fetch(fbEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(fbPayload),
            });

            const fbData = await fbResponse.json();

            if (fbData.id || fbData.post_id) {
                const postId = fbData.post_id || fbData.id;
                // Save Facebook post ID
                await sql`
          UPDATE article_drafts 
          SET facebook_post_id = ${postId}, status = 'published'
          WHERE id = ${id}
        `;
                results.facebook = { success: true, postId: postId };
            } else {
                results.facebook = { success: false, error: fbData.error?.message };
            }
        } catch (err) {
            results.facebook = { success: false, error: err.message };
        }
    }

    // 3. Trigger Vercel deploy
    const deployHook = import.meta.env.VERCEL_DEPLOY_HOOK_URL || process.env.VERCEL_DEPLOY_HOOK_URL;
    if (deployHook) {
        try {
            await fetch(deployHook, { method: 'POST' });
            results.deploy = { success: true };
        } catch (err) {
            results.deploy = { success: false, error: err.message };
        }
    }

    return new Response(JSON.stringify(results), {
        headers: { 'Content-Type': 'application/json' },
    });
}
