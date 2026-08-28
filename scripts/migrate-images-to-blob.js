/**
 * migrate-images-to-blob.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Migrates all local images in public/wp-content/uploads/ to Vercel Blob CDN
 * and records their metadata in Neon PostgreSQL (media_library table).
 * 
 * Usage:
 *   BLOB_READ_WRITE_TOKEN="vercel_blob_rw_..." node scripts/migrate-images-to-blob.js
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { put } from '@vercel/blob';
import { readdir, readFile, stat } from 'fs/promises';
import { join, relative, dirname } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { neon } from '@neondatabase/serverless';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');
const UPLOADS_DIR = join(ROOT_DIR, 'public', 'wp-content', 'uploads');
const MANIFEST_FILE = join(ROOT_DIR, 'src', 'data', 'blob-images-manifest.json');

// Load environment variables from .env if present
const envPath = join(ROOT_DIR, '.env');
if (existsSync(envPath)) {
    const envContent = readFileSync(envPath, 'utf-8');
    for (const line of envContent.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) continue;
        const key = trimmed.substring(0, eqIdx).trim();
        let val = trimmed.substring(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
        }
        if (!process.env[key]) process.env[key] = val;
    }
}

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
const DATABASE_URL = process.env.NEON_DATABASE_URL;

if (!BLOB_TOKEN) {
    console.error('❌ Error: BLOB_READ_WRITE_TOKEN is not set.');
    console.error('👉 Please get your token from Vercel Dashboard → Project → Storage → Blob,');
    console.error('   and add BLOB_READ_WRITE_TOKEN="vercel_blob_rw_..." to your .env file.');
    process.exit(1);
}

const sql = DATABASE_URL ? neon(DATABASE_URL) : null;

function getMimeType(filePath) {
    if (filePath.endsWith('.webp')) return 'image/webp';
    if (filePath.endsWith('.avif')) return 'image/avif';
    if (filePath.endsWith('.png')) return 'image/png';
    if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) return 'image/jpeg';
    if (filePath.endsWith('.gif')) return 'image/gif';
    if (filePath.endsWith('.svg')) return 'image/svg+xml';
    return 'application/octet-stream';
}

async function getAllFiles(dir) {
    let results = [];
    if (!existsSync(dir)) return results;
    const list = await readdir(dir, { withFileTypes: true });
    for (const dirent of list) {
        const fullPath = join(dir, dirent.name);
        if (dirent.isDirectory()) {
            results = results.concat(await getAllFiles(fullPath));
        } else if (!dirent.name.startsWith('.')) {
            results.push(fullPath);
        }
    }
    return results;
}

async function main() {
    console.log('🚀 Starting Full Cloud Migration to Vercel Blob...\n');

    // Ensure database table exists if Neon DB is configured
    if (sql) {
        try {
            await sql`
                CREATE TABLE IF NOT EXISTS media_library (
                    id SERIAL PRIMARY KEY,
                    filename TEXT NOT NULL,
                    url TEXT NOT NULL,
                    alt_text TEXT DEFAULT '',
                    mime_type TEXT DEFAULT '',
                    size_bytes INTEGER DEFAULT 0,
                    uploaded_at TIMESTAMP DEFAULT NOW()
                );
            `;
            console.log('✅ Connected to Neon DB (media_library table ready).');
        } catch (err) {
            console.warn('⚠️ Neon DB warning:', err.message);
        }
    }

    const allFiles = await getAllFiles(UPLOADS_DIR);
    console.log(`📁 Found ${allFiles.length} files to migrate.\n`);

    // Load existing manifest to allow resuming without re-uploading
    let manifest = {};
    if (existsSync(MANIFEST_FILE)) {
        try {
            manifest = JSON.parse(readFileSync(MANIFEST_FILE, 'utf-8'));
        } catch (e) {
            manifest = {};
        }
    }

    let uploadedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < allFiles.length; i++) {
        const file = allFiles[i];
        const relPath = relative(join(ROOT_DIR, 'public'), file); // e.g. "wp-content/uploads/2026/08/img.avif"
        const webPath = '/' + relPath.replace(/\\/g, '/');

        // Check if already uploaded
        if (manifest[webPath]) {
            skippedCount++;
            continue;
        }

        try {
            const buffer = await readFile(file);
            const fileStat = await stat(file);
            const mimeType = getMimeType(file);

            // Upload to Vercel Blob with preserved path
            const blob = await put(relPath, buffer, {
                access: 'public',
                token: BLOB_TOKEN,
                contentType: mimeType,
                addRandomSuffix: false,
                allowOverwrite: true,
            });

            manifest[webPath] = blob.url;
            uploadedCount++;

            // Record into Neon DB
            if (sql) {
                try {
                    await sql`
                        INSERT INTO media_library (filename, url, mime_type, size_bytes)
                        VALUES (${relPath}, ${blob.url}, ${mimeType}, ${fileStat.size});
                    `;
                } catch (dbErr) {
                    // Ignore duplicate key warnings
                }
            }

            console.log(`[${i + 1}/${allFiles.length}] ✅ Uploaded: ${relPath} → ${blob.url}`);

            // Save manifest periodically every 25 files
            if (uploadedCount % 25 === 0) {
                writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2));
            }

        } catch (err) {
            errorCount++;
            console.error(`[${i + 1}/${allFiles.length}] ❌ Failed: ${relPath} - ${err.message}`);
        }
    }

    // Final save of the manifest mapping
    writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2));

    console.log('\n──────────────────────────────────────────────');
    console.log(`🎉 Cloud Migration Complete!`);
    console.log(`   Uploaded: ${uploadedCount}`);
    console.log(`   Skipped (already in cloud): ${skippedCount}`);
    console.log(`   Failed: ${errorCount}`);
    console.log(`   Total in Manifest: ${Object.keys(manifest).length}`);
    console.log(`   Manifest saved to: src/data/blob-images-manifest.json`);
    console.log('──────────────────────────────────────────────\n');
}

main().catch(err => {
    console.error('Fatal Migration Error:', err);
    process.exit(1);
});
