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
// Remote timdietclinic.com images that scripts/mirror-remote-images.js pulled
// into public/, so localizeImageUrl can serve the local (AVIF/WebP-able) copy.
import mirroredImages from '../data/mirrored-images.json';

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
 * Top-level, non-empty categories (`parent === 0`).
 *
 * Used for the /blog filter bar: listing all 44 categories flat buries the 23
 * real topics among 21 narrow child topics. Children stay reachable from their
 * parent's archive page.
 * @returns {object[]}
 */
export function getRootCategories() {
    return categoriesData.filter((c) => c.count > 0 && !c.parent);
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
 * Get a category by its numeric WordPress term id.
 * @param {number} id
 * @returns {object|undefined}
 */
export function getCategoryById(id) {
    return categoriesData.find((c) => c.id === id);
}

/**
 * Ancestors of a category, outermost first (e.g. [โภชนาการพร่องแป้ง, IF] for
 * ประโยชน์ของการ IF). Categories store `parent` as a term id; 0 means root.
 * @param {object} category
 * @returns {object[]}
 */
export function getCategoryAncestors(category) {
    const chain = [];
    const seen = new Set();
    let current = category;
    while (current?.parent) {
        if (seen.has(current.parent)) break; // defensive: cyclic parent data
        seen.add(current.parent);
        const parent = getCategoryById(current.parent);
        if (!parent) break;
        chain.unshift(parent);
        current = parent;
    }
    return chain;
}

/**
 * Non-empty child categories of a category.
 * @param {object} category
 * @returns {object[]}
 */
export function getCategoryChildren(category) {
    if (!category) return [];
    return categoriesData.filter((c) => c.parent === category.id && c.count > 0);
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
 * Get display summary for post cards.
 * AI-generated posts may not have a WordPress-style excerpt, so fall back
 * through SEO fields and finally content.
 * @param {object} post
 * @param {number} [maxChars=160]
 * @returns {string}
 */
export function getPostSummary(post, maxChars = 160) {
    const candidates = [
        post?.excerpt,
        post?._seo_description,
        post?.seo_description,
        post?.seoDescription,
        post?.description,
        post?.metaDescription,
        post?._direct_answer,
        post?.direct_answer,
        post?.content,
    ];

    const raw = candidates.map((value) => stripHtml(value || '')).find(Boolean) || '';

    if (!raw) return '';
    return raw.length > maxChars ? `${raw.substring(0, Math.max(0, maxChars - 1))}…` : raw;
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
 * Extract FAQ question/answer pairs from article HTML for FAQPage schema.
 *
 * GROUNDED-ONLY: returns pairs only when the content has a clearly
 * delimited FAQ section (an <h2>/<h3> heading containing "FAQ",
 * "คำถามที่พบบ่อย", or "คำถาม-คำตอบ"), then reads the question
 * headings that follow it and the text between each. This guarantees
 * the emitted schema always matches visible on-page content — never
 * fabricated — so it satisfies Google's FAQ structured-data policy.
 *
 * Returns [] (→ no FAQ schema) when no genuine FAQ section is found,
 * which is the correct behaviour for legacy posts without one.
 *
 * @param {string} content  Article HTML
 * @returns {{question: string, answer: string}[]}
 */
export function extractFaqItems(content) {
    if (!content || typeof content !== 'string') return [];

    // 1. Locate an explicit FAQ section heading (h2 or h3).
    const faqHeading = /<h([23])[^>]*>([^<]*?(?:FAQ|คำถามที่พบบ่อย|คำถาม[\s\-–—]*คำตอบ)[^<]*?)<\/h\1>/i;
    const m = content.match(faqHeading);
    if (!m) return [];

    const headingLevel = m[1];          // '2' or '3'
    const after = content.slice(m.index + m[0].length);

    // Stop the FAQ section at the next heading of the same-or-higher level.
    const stopRe = headingLevel === '2'
        ? /<h2[^>]*>/i
        : /<h[12][^>]*>/i;
    const stopMatch = after.match(stopRe);
    const section = stopMatch ? after.slice(0, stopMatch.index) : after;

    // 2. Questions are the headings one level below the FAQ heading.
    const qLevel = headingLevel === '2' ? '3' : '4';
    const qRe = new RegExp(`<h${qLevel}[^>]*>([\\s\\S]*?)<\\/h${qLevel}>`, 'gi');

    const items = [];
    let qMatch;
    const positions = [];
    while ((qMatch = qRe.exec(section)) !== null) {
        positions.push({
            question: stripHtml(qMatch[1]).trim(),
            headingStart: qMatch.index,                      // where the next Q heading begins
            contentStart: qMatch.index + qMatch[0].length,   // where this Q's answer begins
        });
    }

    for (let i = 0; i < positions.length; i++) {
        // Answer runs from after this question's heading up to the START of
        // the next question heading (so the next question never leaks in).
        const end = i + 1 < positions.length ? positions[i + 1].headingStart : section.length;
        const answer = stripHtml(section.slice(positions[i].contentStart, end))
            .replace(/\s+/g, ' ')
            .trim();
        const question = positions[i].question;
        if (question && answer && question.length > 3 && answer.length > 10) {
            items.push({ question, answer });
        }
    }

    // Only emit FAQ schema for a real list (>= 2 pairs).
    return items.length >= 2 ? items : [];
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
 * Convert an image URL to its local WebP path.
 * 1. https://drtim.co/wp-content/uploads/2025/10/img.png → /wp-content/uploads/2025/10/img.webp
 * 2. timdietclinic.com URLs that were mirrored locally → local .webp path
 * 3. Other timdietclinic.com URLs are kept as-is (still remote)
 * 4. Non-drtim.co URLs are returned unchanged.
 * @param {string} url
 * @returns {string}
 */
export function localizeImageUrl(url = '') {
    if (!url) return url;
    // A mirrored remote image is now a local file — serve that (then .webp).
    const mirrored = mirroredImages[url];
    if (mirrored) return mirrored.replace(/\.(png|jpe?g)$/i, '.webp');
    // Un-mirrored timdietclinic.com URLs stay external (FTP-uploaded images).
    if (url.includes('timdietclinic.com')) return url;

    let localized = url.replace(/^https?:\/\/(?:www\.)?drtim\.co\//, '/');
    if (localized.startsWith('/wp-content/uploads/')) {
        // Normalize WordPress resize suffixes (-300x200, -768x512) back to base webp
        localized = localized.replace(/(?:-e\d+)?-\d{2,4}x\d{2,4}(?=\.[a-zA-Z]+$)/i, '');
    }
    return localized.replace(/\.(png|jpe?g)$/i, '.webp');
}

/**
 * Sanitize WordPress HTML content for Astro rendering.
 * - Rewrites drtim.co image URLs to local paths with thumbnail fallback
 * - Upgrades http:// to https:// for remaining external images
 * - Adds lazy loading to images
 * - Strips WordPress shortcodes and broken srcset attributes
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
        // Remove legacy WP srcset attributes that point to missing thumbnail sizes
        .replace(/\ssrcset="[^"]*"/gi, '')
        .replace(/\ssizes="[^"]*"/gi, '')
        // Rewrite drtim.co image URLs to local paths (for images served from public/)
        .replace(/src="https?:\/\/drtim\.co\//g, 'src="/')
        // Normalize WordPress resize suffixes in local src attributes
        .replace(/src="(\/wp-content\/uploads\/[^"]*?)(?:-e\d+)?-\d{2,4}x\d{2,4}\.(png|jpe?g|webp)"/gi, 'src="$1.$2"')
        // Upgrade remaining http:// to https:// for external images
        .replace(/src="http:\/\//g, 'src="https://')

        // ── Image Optimization ──
        // Swap local .png/.jpg/.jpeg → .webp for all local image src
        .replace(/src="(\/[^"]*)\.(png|jpe?g)"/gi, 'src="$1.webp"')
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

/**
 * Derive a human-readable alt text from an image src filename.
 * e.g. "/wp-content/uploads/2025/10/cgm-sensor-arm-1024x768.webp"
 *      → "cgm sensor arm"
 * Returns '' when the filename carries no meaningful words.
 * @param {string} src
 * @returns {string}
 */
function altFromFilename(src = '') {
    try {
        let name = src.split(/[?#]/)[0].split('/').pop() || '';
        name = name.replace(/\.[a-z0-9]+$/i, '');           // drop extension
        try { name = decodeURIComponent(name); } catch { /* keep raw */ }
        name = name
            .replace(/[-_]+/g, ' ')                          // separators → space
            .replace(/\b\d{2,4}x\d{2,4}\b/g, ' ')            // strip dimension tokens (1024x768)
            .replace(/\bscaled\b|\bcopy\b|\bfinal\b/gi, ' ') // common WP noise
            .replace(/\s+/g, ' ')
            .trim();
        // Reject generic/auto-generated names (img, image, dsc1234, screenshot, numbers only).
        const generic = /^(img|image|photo|pic|picture|dsc|screenshot|untitled|unnamed|download|file)?[\s\d]*$/i;
        const letters = (name.match(/[A-Za-z฀-๿]/g) || []).length; // Latin or Thai
        if (!name || letters < 2 || generic.test(name)) return '';
        return name;
    } catch {
        return '';
    }
}

/**
 * Inject alt text into images that are missing it (or have an empty alt).
 * Alt is derived from the image filename, falling back to `fallbackAlt`
 * (typically the article title). Images that already have a non-empty
 * alt — including emoji images — are left untouched.
 *
 * Non-destructive: run at render time so it covers both legacy and
 * future content without mutating the stored data.
 *
 * @param {string} html
 * @param {string} fallbackAlt
 * @returns {string}
 */
export function addImageAltText(html = '', fallbackAlt = '') {
    if (!html) return html;
    const fallback = stripHtml(fallbackAlt).replace(/"/g, '').trim();

    return html.replace(/<img\b[^>]*>/gi, (tag) => {
        // Skip images that already have a non-empty alt.
        const altMatch = tag.match(/\salt\s*=\s*("([^"]*)"|'([^']*)')/i);
        if (altMatch) {
            const val = (altMatch[2] ?? altMatch[3] ?? '').trim();
            if (val) return tag;
            // Empty alt="" — remove it so we can insert a meaningful one.
            tag = tag.replace(/\salt\s*=\s*(""|'')/i, '');
        }

        const srcMatch = tag.match(/\ssrc\s*=\s*("([^"]*)"|'([^']*)')/i);
        const src = srcMatch ? (srcMatch[2] ?? srcMatch[3] ?? '') : '';
        const alt = (altFromFilename(src) || fallback)
            .replace(/"/g, '')
            .trim();
        if (!alt) return tag; // nothing useful to add

        return tag.replace(/^<img\b/i, `<img alt="${alt}"`);
    });
}
