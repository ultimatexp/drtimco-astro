import { neon } from '@neondatabase/serverless';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env file
const envPath = join(__dirname, '..', '.env');
if (existsSync(envPath)) {
    const envContent = readFileSync(envPath, 'utf-8');
    for (const line of envContent.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) continue;
        const key = trimmed.substring(0, eqIdx).trim();
        const val = trimmed.substring(eqIdx + 1).trim();
        if (!process.env[key]) process.env[key] = val;
    }
}

const DATABASE_URL = process.env.NEON_DATABASE_URL;

if (!DATABASE_URL) {
    console.error('❌ NEON_DATABASE_URL not set');
    process.exit(1);
}

const sql = neon(DATABASE_URL);

async function migrate() {
    console.log('🔄 Running CMS migrations...');

    try {
        // 1. Media Library Table
        await sql`
        CREATE TABLE IF NOT EXISTS media_library (
            id SERIAL PRIMARY KEY,
            filename TEXT NOT NULL,
            url TEXT NOT NULL,
            alt_text TEXT DEFAULT '',
            mime_type TEXT DEFAULT '',
            size_bytes INTEGER DEFAULT 0,
            width INTEGER,
            height INTEGER,
            uploaded_at TIMESTAMP DEFAULT NOW()
        );
        `;
        console.log('✅ media_library table created or exists');

        // 2. Categories Table
        await sql`
        CREATE TABLE IF NOT EXISTS categories (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            slug TEXT NOT NULL UNIQUE,
            description TEXT DEFAULT '',
            parent_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
            created_at TIMESTAMP DEFAULT NOW()
        );
        `;
        console.log('✅ categories table created or exists');

        // 3. Tags Table
        await sql`
        CREATE TABLE IF NOT EXISTS tags (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            slug TEXT NOT NULL UNIQUE,
            created_at TIMESTAMP DEFAULT NOW()
        );
        `;
        console.log('✅ tags table created or exists');

        // 4. Alter article_drafts
        await sql`ALTER TABLE article_drafts ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP;`;
        await sql`ALTER TABLE article_drafts ADD COLUMN IF NOT EXISTS author TEXT DEFAULT 'Dr. Tim';`;
        await sql`ALTER TABLE article_drafts ADD COLUMN IF NOT EXISTS word_count INTEGER DEFAULT 0;`;
        await sql`ALTER TABLE article_drafts ADD COLUMN IF NOT EXISTS reading_time INTEGER DEFAULT 0;`;
        await sql`ALTER TABLE article_drafts ADD COLUMN IF NOT EXISTS focus_keyword TEXT DEFAULT '';`;
        
        console.log('✅ article_drafts columns updated');

        console.log('🎯 Migration complete!');
    } catch (e) {
        console.error('❌ Migration failed:', e);
    }
}

migrate();
