/**
 * convert-to-webp.js
 * ═══════════════════════════════════════════════
 * Batch converts all PNG/JPG images in public/wp-content/uploads/ to WebP.
 * Uses the `sharp` library for fast, high-quality conversion.
 *
 * Usage:
 *   npm install sharp (if not already installed)
 *   node scripts/convert-to-webp.js
 *
 * Options:
 *   --quality=80    WebP quality (default: 80, range: 1-100)
 *   --delete        Delete original files after conversion
 */

import sharp from 'sharp';
import { readdir, stat, unlink } from 'fs/promises';
import { join, extname, basename, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = join(__dirname, '..', 'public', 'wp-content', 'uploads');
const QUALITY = parseInt(process.argv.find(a => a.startsWith('--quality='))?.split('=')[1] || '80');
const DELETE_ORIGINALS = process.argv.includes('--delete');

const EXTENSIONS = new Set(['.png', '.jpg', '.jpeg']);

async function* walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) {
            yield* walk(path);
        } else if (EXTENSIONS.has(extname(entry.name).toLowerCase())) {
            yield path;
        }
    }
}

async function convert() {
    console.log(`\n🖼️  WebP Converter — quality: ${QUALITY}\n`);
    console.log(`📂 Scanning: ${UPLOADS_DIR}\n`);

    let converted = 0;
    let skipped = 0;
    let totalSaved = 0;
    let failed = 0;

    for await (const filePath of walk(UPLOADS_DIR)) {
        const ext = extname(filePath);
        const webpPath = filePath.replace(new RegExp(`\\${ext}$`), '.webp');

        // Skip if WebP already exists
        try {
            await stat(webpPath);
            skipped++;
            continue;
        } catch {
            // WebP doesn't exist — proceed
        }

        try {
            const originalStats = await stat(filePath);
            const originalSize = originalStats.size;

            await sharp(filePath)
                .webp({ quality: QUALITY })
                .toFile(webpPath);

            const webpStats = await stat(webpPath);
            const webpSize = webpStats.size;
            const saved = originalSize - webpSize;
            const pct = ((saved / originalSize) * 100).toFixed(0);
            totalSaved += saved;

            converted++;
            const name = basename(filePath);
            console.log(`  ✅ ${name} → .webp  (${(originalSize / 1024).toFixed(0)}KB → ${(webpSize / 1024).toFixed(0)}KB, -${pct}%)`);

            if (DELETE_ORIGINALS) {
                await unlink(filePath);
            }
        } catch (e) {
            failed++;
            console.log(`  ❌ ${basename(filePath)} — ${e.message}`);
        }
    }

    console.log(`\n─────────────────────────────────────`);
    console.log(`✅ Converted: ${converted}`);
    console.log(`⏭️  Skipped (already WebP): ${skipped}`);
    if (failed > 0) console.log(`❌ Failed: ${failed}`);
    console.log(`💾 Total saved: ${(totalSaved / 1024 / 1024).toFixed(1)} MB`);
    if (DELETE_ORIGINALS) console.log(`🗑️  Originals deleted`);
    else console.log(`💡 Run with --delete to remove originals`);
    console.log(``);
}

convert();
