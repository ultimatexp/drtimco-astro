export const prerender = false;

import { isAdminSession, unauthorizedJson, getEnv } from '../../../lib/adminAuth.js';

/**
 * POST /api/admin/deploy — trigger a production rebuild.
 *
 * Publishing writes to Neon, but the blog is prerendered from posts.json, which
 * is only refreshed by scripts/sync-approved-articles.js at build time. Without
 * a rebuild a "published" article stays invisible, so the editor calls this
 * after a successful publish.
 *
 * Requires VERCEL_DEPLOY_HOOK_URL (Vercel → Settings → Git → Deploy Hooks).
 * The hook URL is a secret and is never sent to the browser.
 */
function json(body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

export async function POST({ cookies }) {
    if (!isAdminSession(cookies)) return unauthorizedJson();

    const hookUrl = getEnv('VERCEL_DEPLOY_HOOK_URL');
    if (!hookUrl) {
        return json({
            success: false,
            error:
                'VERCEL_DEPLOY_HOOK_URL is not set. Create a deploy hook in Vercel → Settings → Git → Deploy Hooks, then add it as an environment variable.',
        }, 501);
    }

    // The URL comes from our own env, but validate the host anyway so a typo or
    // a bad env value can't turn this endpoint into a generic request proxy.
    let target;
    try {
        target = new URL(hookUrl);
    } catch {
        return json({ success: false, error: 'VERCEL_DEPLOY_HOOK_URL is not a valid URL.' }, 500);
    }
    if (target.protocol !== 'https:' || target.hostname !== 'api.vercel.com') {
        return json({
            success: false,
            error: 'VERCEL_DEPLOY_HOOK_URL must be an https://api.vercel.com deploy hook.',
        }, 500);
    }

    try {
        const res = await fetch(target, { method: 'POST' });
        if (!res.ok) {
            const detail = await res.text().catch(() => '');
            return json({
                success: false,
                error: `Vercel rejected the deploy hook (${res.status}).`,
                detail: detail.slice(0, 300),
            }, 502);
        }

        // Vercel replies with { job: { id, state, createdAt } }.
        const data = await res.json().catch(() => ({}));
        return json({ success: true, job: data.job ?? null });
    } catch (e) {
        return json({ success: false, error: `Could not reach Vercel: ${e.message}` }, 502);
    }
}
