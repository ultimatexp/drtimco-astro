/**
 * WordPress Content Export Script
 * ──────────────────────────────────────────────
 * Run this in your browser console while on drtim.co
 * to export all content as JSON files.
 *
 * INSTRUCTIONS:
 * 1. Open https://drtim.co in your browser
 * 2. Open Developer Tools (Cmd+Option+I)
 * 3. Go to the Console tab
 * 4. Paste this entire script and press Enter
 * 5. Wait for all data to be fetched
 * 6. JSON files will auto-download to your Downloads folder
 * 7. Move them to: DrtimCO Astro/src/data/
 */

(async function exportWordPressContent() {
    const API_BASE = '/wp-json/wp/v2';

    console.log('🚀 Starting WordPress content export...\n');

    // Helper: fetch all pages of a paginated endpoint
    async function fetchAll(endpoint, params = {}) {
        const items = [];
        let page = 1;
        let totalPages = 1;

        while (page <= totalPages) {
            const url = new URL(endpoint, window.location.origin);
            url.searchParams.set('per_page', '100');
            url.searchParams.set('page', String(page));
            Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

            console.log(`  Fetching: ${url.pathname}${url.search} (page ${page}/${totalPages})`);
            const res = await fetch(url.toString());

            if (!res.ok) {
                console.warn(`  ⚠️ HTTP ${res.status} for ${url.pathname}`);
                break;
            }

            totalPages = parseInt(res.headers.get('X-WP-TotalPages') || '1');
            const data = await res.json();
            items.push(...data);
            page++;
        }

        return items;
    }

    // Helper: download JSON
    function downloadJSON(data, filename) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        console.log(`  ✅ Downloaded: ${filename} (${data.length || Object.keys(data).length} items)`);
    }

    try {
        // 1. Fetch all posts with embedded data
        console.log('\n📝 Fetching posts...');
        const posts = await fetchAll(`${API_BASE}/posts`, { _embed: '1' });

        // Clean posts to essential fields
        const cleanPosts = posts.map(p => {
            const embedded = p._embedded || {};
            const author = (embedded.author || [{}])[0];
            const featuredMedia = (embedded['wp:featuredmedia'] || [[]])[0];
            const terms = embedded['wp:term'] || [];

            // Extract categories and tags from embedded terms
            const categories = [];
            const tags = [];
            terms.forEach(termGroup => {
                if (Array.isArray(termGroup)) {
                    termGroup.forEach(t => {
                        if (t.taxonomy === 'category') categories.push({ id: t.id, name: t.name, slug: t.slug });
                        if (t.taxonomy === 'post_tag') tags.push({ id: t.id, name: t.name, slug: t.slug });
                    });
                }
            });

            return {
                id: p.id,
                title: p.title?.rendered || '',
                slug: p.slug,
                date: p.date,
                modified: p.modified,
                excerpt: p.excerpt?.rendered || '',
                content: p.content?.rendered || '',
                link: p.link,
                categories,
                tags,
                author: {
                    name: author.name || '',
                    slug: author.slug || '',
                    description: author.description || '',
                    avatar: author.avatar_urls?.['96'] || '',
                },
                featuredImage: featuredMedia ? {
                    sourceUrl: featuredMedia.source_url || '',
                    altText: featuredMedia.alt_text || '',
                    width: featuredMedia.media_details?.width || 0,
                    height: featuredMedia.media_details?.height || 0,
                } : null,
            };
        });
        downloadJSON(cleanPosts, 'posts.json');

        // 2. Fetch categories
        console.log('\n📁 Fetching categories...');
        const categories = await fetchAll(`${API_BASE}/categories`);
        const cleanCategories = categories.map(c => ({
            id: c.id,
            name: c.name,
            slug: c.slug,
            description: c.description || '',
            count: c.count,
            parent: c.parent,
        }));
        downloadJSON(cleanCategories, 'categories.json');

        // 3. Fetch tags
        console.log('\n🏷️ Fetching tags...');
        const tagsData = await fetchAll(`${API_BASE}/tags`);
        const cleanTags = tagsData.map(t => ({
            id: t.id,
            name: t.name,
            slug: t.slug,
            count: t.count,
        }));
        downloadJSON(cleanTags, 'tags.json');

        // 4. Fetch pages
        console.log('\n📄 Fetching pages...');
        const pages = await fetchAll(`${API_BASE}/pages`, { _embed: '1' });
        const cleanPages = pages.map(p => {
            const embedded = p._embedded || {};
            const featuredMedia = (embedded['wp:featuredmedia'] || [[]])[0];
            return {
                id: p.id,
                title: p.title?.rendered || '',
                slug: p.slug,
                date: p.date,
                modified: p.modified,
                content: p.content?.rendered || '',
                link: p.link,
                featuredImage: featuredMedia ? {
                    sourceUrl: featuredMedia.source_url || '',
                    altText: featuredMedia.alt_text || '',
                } : null,
            };
        });
        downloadJSON(cleanPages, 'pages.json');

        // 5. Fetch media (for image catalog)
        console.log('\n🖼️ Fetching media...');
        const media = await fetchAll(`${API_BASE}/media`);
        const cleanMedia = media.map(m => ({
            id: m.id,
            sourceUrl: m.source_url || '',
            altText: m.alt_text || '',
            title: m.title?.rendered || '',
            width: m.media_details?.width || 0,
            height: m.media_details?.height || 0,
        }));
        downloadJSON(cleanMedia, 'media.json');

        // 6. Site info
        console.log('\n🌐 Fetching site info...');
        const siteRes = await fetch('/wp-json');
        const site = await siteRes.json();
        const siteInfo = {
            name: site.name,
            description: site.description,
            url: site.url,
            home: site.home,
            namespaces: site.namespaces,
        };
        downloadJSON(siteInfo, 'site-info.json');

        console.log('\n✅ Export complete! Move all downloaded JSON files to:');
        console.log('   DrtimCO Astro/src/data/\n');
        console.log(`📊 Summary: ${cleanPosts.length} posts, ${cleanCategories.length} categories, ${cleanTags.length} tags, ${cleanPages.length} pages, ${cleanMedia.length} media items`);

    } catch (err) {
        console.error('❌ Export failed:', err);
    }
})();
