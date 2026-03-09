/**
 * WordPress Image Exporter → ZIP
 * ═══════════════════════════════════════════════
 * Run this in your browser console while on drtim.co
 * 
 * INSTRUCTIONS:
 * 1. Open https://drtim.co in your browser
 * 2. Open DevTools Console (Cmd+Option+J)
 * 3. Paste this entire script and press Enter
 * 4. Wait for all images to download (~5-10 min)
 * 5. A wp-images.zip file will auto-download
 * 6. Unzip into your Astro project:
 *    unzip ~/Downloads/wp-images.zip -d "DrtimCO Astro/public/"
 */

(async function exportImages() {
    console.log('🖼️ WordPress Image Exporter\n');

    // Step 1: Load JSZip from CDN
    console.log('📦 Loading JSZip library...');
    await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
    console.log('✅ JSZip loaded\n');

    const zip = new JSZip();

    // Step 2: Fetch all posts to find featured images
    console.log('📝 Fetching posts to find image URLs...');
    const API_BASE = '/wp-json/wp/v2';

    async function fetchAll(endpoint, params = {}) {
        const items = [];
        let page = 1;
        let totalPages = 1;
        while (page <= totalPages) {
            const url = new URL(endpoint, window.location.origin);
            url.searchParams.set('per_page', '100');
            url.searchParams.set('page', String(page));
            Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
            const res = await fetch(url.toString());
            if (!res.ok) break;
            totalPages = parseInt(res.headers.get('X-WP-TotalPages') || '1');
            items.push(...(await res.json()));
            page++;
        }
        return items;
    }

    // Force any URL to use https and the current origin
    function fixUrl(url) {
        if (!url) return null;
        // Replace http:// with https://
        url = url.replace(/^http:\/\//, 'https://');
        // Ensure it uses the current origin (handles both drtim.co and www.drtim.co)
        url = url.replace(/^https?:\/\/[^/]+/, window.location.origin);
        return url;
    }

    const posts = await fetchAll(`${API_BASE}/posts`, { _embed: '1' });
    console.log(`✅ Found ${posts.length} posts\n`);

    // Step 3: Collect ALL unique drtim.co image URLs
    const imageUrls = new Set();

    posts.forEach(p => {
        // Featured image
        const fm = (p._embedded?.['wp:featuredmedia'] || [])[0];
        if (fm?.source_url) {
            imageUrls.add(fixUrl(fm.source_url));
        }

        // Content images from drtim.co only
        const content = p.content?.rendered || '';
        const matches = content.matchAll(/(?:src|srcset)=["'](https?:\/\/drtim\.co\/wp-content\/uploads\/[^"'\s]+)["']/g);
        for (const m of matches) {
            imageUrls.add(fixUrl(m[1].split(' ')[0]));
        }
        // Also match http:// version
        const httpMatches = content.matchAll(/(?:src|srcset)=["'](http:\/\/drtim\.co\/wp-content\/uploads\/[^"'\s]+)["']/g);
        for (const m of httpMatches) {
            imageUrls.add(fixUrl(m[1].split(' ')[0]));
        }
    });

    // Remove nulls
    imageUrls.delete(null);

    console.log(`🔗 Found ${imageUrls.size} unique images to download\n`);

    // Step 4: Download images and add to ZIP
    const urls = Array.from(imageUrls);
    let downloaded = 0;
    let failed = 0;
    const failedUrls = [];
    const BATCH = 3; // smaller batches to be gentler

    for (let i = 0; i < urls.length; i += BATCH) {
        const batch = urls.slice(i, i + BATCH);

        await Promise.allSettled(batch.map(async (url) => {
            try {
                const res = await fetch(url, {
                    credentials: 'include',  // Include cookies for auth
                    cache: 'force-cache'     // Use cached versions if available
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const blob = await res.blob();
                const data = await blob.arrayBuffer();

                // Extract path: https://drtim.co/wp-content/uploads/2025/10/img.png
                // → wp-content/uploads/2025/10/img.png
                const urlObj = new URL(url);
                const path = urlObj.pathname.replace(/^\//, '');

                zip.file(path, data);
                downloaded++;
            } catch (e) {
                failed++;
                failedUrls.push({ url, error: e.message });
            }
        }));

        const done = Math.min(i + BATCH, urls.length);
        if (done % 15 === 0 || done === urls.length) {
            console.log(`  ⬇️ ${done}/${urls.length} (${downloaded} ✓ ${failed} ✗)`);
        }

        // Small delay between batches
        await new Promise(r => setTimeout(r, 200));
    }

    console.log(`\n✅ Downloaded ${downloaded} images (${failed} failed)\n`);
    if (failedUrls.length > 0) {
        console.log('Failed URLs (first 10):');
        failedUrls.slice(0, 10).forEach(f => console.log(`  ❌ ${f.url} — ${f.error}`));
    }

    // Step 5: Generate ZIP and trigger download
    console.log('\n📦 Creating ZIP file...');
    const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
    }, (metadata) => {
        if (Math.round(metadata.percent) % 25 === 0) {
            console.log(`  ZIP: ${Math.round(metadata.percent)}%`);
        }
    });

    const sizeMB = (zipBlob.size / 1024 / 1024).toFixed(1);
    console.log(`📦 ZIP size: ${sizeMB} MB`);

    // Trigger download
    const link = document.createElement('a');
    link.href = URL.createObjectURL(zipBlob);
    link.download = 'wp-images.zip';
    link.click();
    URL.revokeObjectURL(link.href);

    console.log('\n🎉 Download complete!');
    console.log('\n📋 Next steps:');
    console.log('  cd "/Users/yellow-eclipse/Desktop/DrtimCO Astro"');
    console.log('  unzip ~/Downloads/wp-images.zip -d public/');
    console.log('  npm run dev');
})();
