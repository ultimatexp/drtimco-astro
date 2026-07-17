/**
 * add-deleted-at-column.js
 * ──────────────────────────────────────────────────────
 * Adds article_drafts.deleted_at for soft-deletes (trash + restore).
 *
 * Additive and idempotent: a nullable column, so existing rows and queries are
 * unaffected. Soft-delete rather than DELETE because the CMS has no revision
 * history — a hard delete of a published article would be unrecoverable.
 *
 * Run once:
 *   node scripts/add-deleted-at-column.js
 */

import { neon } from '@neondatabase/serverless';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const envPath = join(__dirname, '..', '.env');
if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) continue;
        const key = trimmed.substring(0, eqIdx).trim();
        const val = trimmed.substring(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) process.env[key] = val;
    }
}

const DATABASE_URL = process.env.NEON_DATABASE_URL;
if (!DATABASE_URL) {
    console.error('❌ NEON_DATABASE_URL not set');
    process.exit(1);
}

const sql = neon(DATABASE_URL);

const [{ exists }] = await sql`
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'article_drafts' AND column_name = 'deleted_at'
    ) AS exists
`;

if (exists) {
    console.log('ℹ️  article_drafts.deleted_at already exists — nothing to do.');
} else {
    await sql`ALTER TABLE article_drafts ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE`;
    console.log('✅ Added article_drafts.deleted_at');
}

const [{ count }] = await sql`SELECT COUNT(*)::int AS count FROM article_drafts WHERE deleted_at IS NOT NULL`;
console.log(`   ${count} article(s) currently in trash.`);
