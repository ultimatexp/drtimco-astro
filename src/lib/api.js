// ============================================================
// WordPress REST API Client — Local Cache Strategy
// ============================================================
// Reads content from local JSON files exported via the browser
// console script (scripts/export-wp-content.js).
//
// Architecture:
//   1. User exports WP data via browser console → JSON files
//   2. JSON files placed in src/data/
//   3. Astro reads from local files at build time (zero network)
//   4. Re-export when content changes in WordPress
//
// This gives us:
//   ✅ Zero-JS builds (no runtime API calls)
//   ✅ Works despite Imunify360 bot-protection
//   ✅ Instant builds (no network latency)
//   ✅ Full offline development capability
// ============================================================

import postsData from '../data/posts.json';
import categoriesData from '../data/categories.json';
import tagsData from '../data/tags.json';
import pagesData from '../data/pages.json';
import siteInfoData from '../data/site-info.json';

// ── Post Helpers ─────────────────────────────────────────────

/**
 * Get all published posts, optionally paginated.
 * @param {number} [limit]  Max posts to return (default: all)
 * @param {number} [offset] Offset for pagination (default: 0)
 * @returns {object[]}
 */
export function getAllPosts(limit = 0, offset = 0) {
    const sorted = [...postsData].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    if (limit > 0) {
        return sorted.slice(offset, offset + limit);
    }
    return sorted;
}

/**
 * Get all post slugs (for `getStaticPaths`).
 * @returns {string[]}
 */
export function getAllPostSlugs() {
    return postsData.map((p) => p.slug);
}

/**
 * Get a single post by its slug.
 * @param {string} slug
 * @returns {object|undefined}
 */
export function getPostBySlug(slug) {
    return postsData.find((p) => p.slug === slug);
}

/**
 * Get related posts (same category, excluding current).
 * @param {object} post      Current post
 * @param {number} [limit=3] Max related posts
 * @returns {object[]}
 */
export function getRelatedPosts(post, limit = 3) {
    const catSlugs = (post.categories || []).map((c) => c.slug);
    return postsData
        .filter(
            (p) =>
                p.slug !== post.slug &&
                p.categories?.some((c) => catSlugs.includes(c.slug))
        )
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, limit);
}

/**
 * Get total post count.
 * @returns {number}
 */
export function getPostCount() {
    return postsData.length;
}

// ── Category Helpers ─────────────────────────────────────────

/**
 * Get all non-empty categories.
 * @returns {object[]}
 */
export function getCategories() {
    return categoriesData.filter((c) => c.count > 0);
}

/**
 * Get all category slugs (for `getStaticPaths`).
 * @returns {string[]}
 */
export function getCategorySlugs() {
    return categoriesData.filter((c) => c.count > 0).map((c) => c.slug);
}

/**
 * Get a category by slug.
 * @param {string} slug
 * @returns {object|undefined}
 */
export function getCategoryBySlug(slug) {
    return categoriesData.find((c) => c.slug === slug);
}

/**
 * Get posts within a specific category.
 * @param {string} categorySlug
 * @param {number} [limit=0]     0 = all
 * @returns {object[]}
 */
export function getPostsByCategory(categorySlug, limit = 0) {
    const filtered = postsData
        .filter((p) => p.categories?.some((c) => c.slug === categorySlug))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    if (limit > 0) return filtered.slice(0, limit);
    return filtered;
}

// ── Tag Helpers ──────────────────────────────────────────────

/**
 * Get all tags.
 * @returns {object[]}
 */
export function getTags() {
    return tagsData.filter((t) => t.count > 0);
}

// ── Page Helpers ─────────────────────────────────────────────

/**
 * Get a page by slug.
 * @param {string} slug
 * @returns {object|undefined}
 */
export function getPageBySlug(slug) {
    return pagesData.find((p) => p.slug === slug);
}

/**
 * Get all pages.
 * @returns {object[]}
 */
export function getAllPages() {
    return pagesData;
}

// ── Site Helpers ─────────────────────────────────────────────

/**
 * Get site info (name, description, URL).
 * @returns {object}
 */
export function getSiteInfo() {
    return siteInfoData;
}

// ── SEO Utilities ────────────────────────────────────────────

/**
 * Decode common HTML entities to their characters.
 * @param {string} text
 * @returns {string}
 */
export function decodeEntities(text = '') {
    return text
        .replace(/&#8220;/g, '\u201C')
        .replace(/&#8221;/g, '\u201D')
        .replace(/&#8216;/g, '\u2018')
        .replace(/&#8217;/g, '\u2019')
        .replace(/&#8211;/g, '\u2013')
        .replace(/&#8212;/g, '\u2014')
        .replace(/&hellip;/g, '\u2026')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&nbsp;/g, ' ')
        .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n));
}

/**
 * Strip HTML tags from a string and decode entities.
 * @param {string} html
 * @returns {string}
 */
export function stripHtml(html = '') {
    const stripped = html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    return decodeEntities(stripped);
}

/**
 * Truncate text to a max word count.
 * @param {string}  text
 * @param {number}  [maxWords=30]
 * @returns {string}
 */
export function truncateWords(text, maxWords = 30) {
    const words = text.split(/\s+/);
    if (words.length <= maxWords) return text;
    return words.slice(0, maxWords).join(' ') + '…';
}

/**
 * Generate a meta description from excerpt or content.
 * @param {string} excerpt
 * @param {string} content
 * @returns {string}
 */
export function generateMetaDescription(excerpt, content) {
    const raw = stripHtml(excerpt || content || '');
    if (raw.length <= 160) return raw;
    return raw.substring(0, 157) + '…';
}

/**
 * Generate a 40-60 word direct answer from an excerpt.
 * For AEO (AI Engine Optimization).
 * @param {string} excerpt
 * @param {string} content  Fallback
 * @returns {string}
 */
export function generateDirectAnswer(excerpt, content) {
    const raw = stripHtml(excerpt || content || '');
    const words = raw.split(/\s+/);
    // Target 40-60 words
    const target = Math.min(Math.max(words.length, 40), 60);
    return words.slice(0, target).join(' ') + (words.length > target ? '…' : '');
}

/**
 * Format a date string for display.
 * @param {string} dateStr  ISO date string
 * @returns {string}
 */
export function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
}

/**
 * Get the display name of a post author.
 * Overrides email-based names with the site doctor name.
 * @param {object} author  Author object from posts.json
 * @returns {string}
 */
export function getAuthorName(author) {
    if (!author?.name) return 'Dr. Tim';
    if (author.name.includes('@')) return 'Dr. Tim';
    return author.name;
}

/**
 * Convert a drtim.co image URL to a local WebP path.
 * 1. https://drtim.co/wp-content/uploads/2025/10/img.png → /wp-content/uploads/2025/10/img.webp
 * 2. Non-drtim.co URLs are returned unchanged.
 * 3. Swaps .png/.jpg/.jpeg → .webp for optimized loading.
 * @param {string} url
 * @returns {string}
 */
export function localizeImageUrl(url = '') {
    if (!url) return url;
    return url
        .replace(/^https?:\/\/drtim\.co\//, '/')
        .replace(/^https?:\/\/timdietclinic\.com\//, '/')
        .replace(/\.(png|jpe?g)$/i, '.webp');
}

/**
 * Sanitize WordPress HTML content for Astro rendering.
 * - Rewrites drtim.co image URLs to local paths
 * - Upgrades http:// to https:// for remaining external images
 * - Adds lazy loading to images
 * - Strips WordPress shortcodes
 * - Ensures responsive images
 * @param {string} html
 * @returns {string}
 */
export function sanitizeContent(html = '') {
    return html
        // ── XSS Protection ──
        // Strip <script> tags and contents
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        // Strip <iframe>, <object>, <embed> tags
        .replace(/<(iframe|object|embed)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
        .replace(/<(iframe|object|embed)\b[^>]*\/?>/gi, '')
        // Strip on* event handlers (onclick, onerror, onload, etc.)
        .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '')
        .replace(/\son\w+\s*=\s*[^\s>]+/gi, '')
        // Strip javascript: URLs
        .replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"')

        // ── URL Rewriting ──
        // Rewrite TOC anchor links: convert absolute drtim.co/timdietclinic.com URLs
        // with hash fragments to just the hash fragment (fixes ez-toc 404s)
        .replace(/href="https?:\/\/drtim\.co\/[^"]*?(#[^"]*)"/gi, 'href="$1"')
        // Rewrite drtim.co image URLs to local paths (for images served from public/)
        .replace(/src="https?:\/\/drtim\.co\//g, 'src="/')
        .replace(/srcset="https?:\/\/drtim\.co\//g, 'srcset="/')
        // Upgrade remaining http:// to https:// for external images
        .replace(/src="http:\/\//g, 'src="https://')
        .replace(/srcset="http:\/\//g, 'srcset="https://')

        // ── Image Optimization ──
        // Swap local .png/.jpg/.jpeg → .webp for all local image src
        .replace(/src="(\/[^"]*)\.(png|jpe?g)"/gi, 'src="$1.webp"')
        .replace(/srcset="(\/[^"]*)\.(png|jpe?g)/gi, 'srcset="$1.webp')
        // Add lazy loading to images that don't already have it
        .replace(/<img(?![^>]*loading=)/g, '<img loading="lazy"')
        // Add decoding=async for non-blocking image decode
        .replace(/<img(?![^>]*decoding=)/g, '<img decoding="async"')
        // Make images responsive
        .replace(/<img(?![^>]*style="[^"]*max-width)/g, '<img style="max-width:100%;height:auto" ')

        // ── WordPress Cleanup ──
        // Strip WordPress shortcodes like [tutor_...], [latepoint_...], etc.
        .replace(/\[[a-zA-Z_]+[^\]]*\]/g, '')
        // Remove inline WordPress/Elementor styles
        .replace(/<style>\/\*! elementor[^<]*<\/style>/g, '')
        // Clean up empty paragraphs
        .replace(/<p>\s*<\/p>/g, '')
        .replace(/<p>&nbsp;<\/p>/g, '');
}

