export const prerender = false;

import { neon } from '@neondatabase/serverless';
import { getEnv, isAdminSession, unauthorizedJson } from '../../../lib/adminAuth.js';

const GRAPH_FIELDS = 'id,message,created_time,permalink_url,full_picture,attachments';

function jsonResponse(body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

function normalizeText(value = '') {
    return String(value).replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
}

function escapeHtml(value = '') {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function slugify(value = '') {
    return value
        .toLowerCase()
        .trim()
        .replace(/[^\w\s\u0E00-\u0E7F-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 80);
}

function trimText(value = '', maxLength = 160) {
    const text = normalizeText(value).replace(/\s+/g, ' ');
    if (text.length <= maxLength) return text;
    return `${text.substring(0, Math.max(0, maxLength - 1)).trim()}…`;
}

function titleFromMessage(message = '') {
    const firstLine = normalizeText(message)
        .split('\n')
        .map((line) => line.trim())
        .find(Boolean);

    return trimText(firstLine || 'Imported Facebook post', 90);
}

function contentFromMessage(message = '', permalinkUrl = '') {
    const paragraphs = normalizeText(message)
        .split(/\n{2,}/)
        .map((block) => block.trim())
        .filter(Boolean)
        .map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`);

    if (permalinkUrl) {
        paragraphs.push(`<p><a href="${escapeHtml(permalinkUrl)}" target="_blank" rel="noopener noreferrer">Source: Facebook post</a></p>`);
    }

    return paragraphs.join('\n\n') || '<p>Imported from Facebook.</p>';
}

function parseFacebookPostUrl(rawUrl = '') {
    let parsed;

    try {
        parsed = new URL(rawUrl);
    } catch {
        return { error: 'Enter a valid Facebook post URL.' };
    }

    const hostname = parsed.hostname.replace(/^www\./, '').toLowerCase();
    if (!['facebook.com', 'm.facebook.com', 'mbasic.facebook.com', 'fb.watch'].includes(hostname)) {
        return { error: 'Only Facebook post URLs are supported.' };
    }

    if (hostname === 'fb.watch') {
        return { error: 'fb.watch short links are not supported in v1. Use the original Page post permalink.' };
    }

    const id = parsed.searchParams.get('id');
    const storyFbid = parsed.searchParams.get('story_fbid') || parsed.searchParams.get('fbid');
    if (id && storyFbid) {
        return { objectId: `${id}_${storyFbid}` };
    }

    const pathParts = parsed.pathname.split('/').filter(Boolean);
    const postTypeIndex = pathParts.findIndex((part) => ['posts', 'videos', 'photos', 'reel'].includes(part));
    if (postTypeIndex > 0 && pathParts[postTypeIndex + 1]) {
        const postId = pathParts[postTypeIndex + 1];
        if (postId.includes('_')) {
            return { objectId: postId };
        }

        return {
            pageIdentifier: pathParts[0],
            postId,
        };
    }

    return { error: 'Unsupported Facebook URL format. Use a Page post permalink URL.' };
}

function getAttachmentImage(attachment) {
    if (!attachment) return '';

    if (attachment.media?.image?.src) return attachment.media.image.src;
    if (attachment.media?.source) return attachment.media.source;
    if (Array.isArray(attachment.subattachments?.data)) {
        for (const subattachment of attachment.subattachments.data) {
            const image = getAttachmentImage(subattachment);
            if (image) return image;
        }
    }

    return '';
}

function bestImageFromPost(post) {
    if (post.full_picture) return post.full_picture;

    if (Array.isArray(post.attachments?.data)) {
        for (const attachment of post.attachments.data) {
            const image = getAttachmentImage(attachment);
            if (image) return image;
        }
    }

    return '';
}

async function fetchFacebookPost(objectId, token, version) {
    const apiVersion = version || 'v20.0';
    const graphUrl = new URL(`https://graph.facebook.com/${apiVersion}/${encodeURIComponent(objectId)}`);
    graphUrl.searchParams.set('fields', GRAPH_FIELDS);
    graphUrl.searchParams.set('access_token', token);

    const response = await fetch(graphUrl);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        const message = data?.error?.message || 'Facebook post could not be fetched.';
        const status = response.status === 404 ? 404 : 502;
        throw Object.assign(new Error(message), { status });
    }

    if (!data.message && !data.full_picture && !data.attachments) {
        throw Object.assign(new Error('Facebook post has no importable text or image.'), { status: 404 });
    }

    return data;
}

async function resolveFacebookObjectId(parsedUrl, token, version) {
    if (parsedUrl.objectId) return parsedUrl.objectId;

    const apiVersion = version || 'v20.0';
    const graphUrl = new URL(`https://graph.facebook.com/${apiVersion}/${encodeURIComponent(parsedUrl.pageIdentifier)}`);
    graphUrl.searchParams.set('fields', 'id');
    graphUrl.searchParams.set('access_token', token);

    const response = await fetch(graphUrl);
    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.id) {
        const message = data?.error?.message || 'Facebook Page could not be resolved from this URL.';
        throw Object.assign(new Error(message), { status: response.status === 404 ? 404 : 502 });
    }

    return `${data.id}_${parsedUrl.postId}`;
}

export async function POST({ request, cookies }) {
    if (!isAdminSession(cookies)) {
        return unauthorizedJson();
    }

    let body;
    try {
        body = await request.json();
    } catch {
        return jsonResponse({ success: false, error: 'Invalid JSON body.' }, 400);
    }

    const { url } = body;
    if (!url || typeof url !== 'string') {
        return jsonResponse({ success: false, error: 'Facebook URL is required.' }, 400);
    }

    const parsed = parseFacebookPostUrl(url.trim());
    if (parsed.error) {
        return jsonResponse({ success: false, error: parsed.error }, 400);
    }

    const token = getEnv('FB_PAGE_ACCESS_TOKEN');
    if (!token) {
        return jsonResponse({ success: false, error: 'FB_PAGE_ACCESS_TOKEN is not configured.' }, 500);
    }

    const databaseUrl = getEnv('NEON_DATABASE_URL');
    if (!databaseUrl) {
        return jsonResponse({ success: false, error: 'NEON_DATABASE_URL is not configured.' }, 500);
    }

    try {
        const apiVersion = getEnv('FB_API_VERSION');
        const objectId = await resolveFacebookObjectId(parsed, token, apiVersion);
        const facebookPost = await fetchFacebookPost(objectId, token, apiVersion);
        const message = normalizeText(facebookPost.message || '');
        const permalinkUrl = facebookPost.permalink_url || url.trim();
        const title = titleFromMessage(message);
        const excerpt = trimText(message || title, 155);
        const imageUrl = bestImageFromPost(facebookPost);
        const sql = neon(databaseUrl);

        const [article] = await sql`
            INSERT INTO article_drafts (
                title, slug, content, excerpt, seo_description,
                direct_answer, category, tags, status, keyword, image_url,
                focus_keyword, featured_image_url
            ) VALUES (
                ${title},
                ${slugify(title) || `facebook-post-${Date.now()}`},
                ${contentFromMessage(message, permalinkUrl)},
                ${excerpt},
                ${excerpt},
                '',
                '',
                ${[]},
                'draft',
                'facebook-import',
                ${imageUrl},
                '',
                ${imageUrl}
            )
            RETURNING id, title, slug
        `;

        return jsonResponse({ success: true, article });
    } catch (error) {
        console.error('import-facebook-post error:', error);
        return jsonResponse({
            success: false,
            error: error.message || 'Facebook import failed.',
        }, error.status || 500);
    }
}
