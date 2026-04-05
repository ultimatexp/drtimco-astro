export const prerender = false;

import { neon } from '@neondatabase/serverless';

export async function GET({ request }) {
    // Auth Check
    const adminPassword = import.meta.env.ADMIN_PASSWORD;
    const cookieString = request.headers.get('cookie') || '';
    const hasValidAuth = cookieString.includes(`adminSession=${adminPassword}`);
    
    if (!hasValidAuth) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    try {
        const sql = neon(import.meta.env.NEON_DATABASE_URL);
        
        // Ensure table exists safely
        await sql`
            CREATE TABLE IF NOT EXISTS categories (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL UNIQUE,
                slug VARCHAR(255) NOT NULL UNIQUE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `;

        const categories = await sql`SELECT * FROM categories ORDER BY name ASC`;

        return new Response(JSON.stringify({ success: true, categories }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}

export async function POST({ request }) {
    // Auth Check
    const adminPassword = import.meta.env.ADMIN_PASSWORD;
    const cookieString = request.headers.get('cookie') || '';
    const hasValidAuth = cookieString.includes(`adminSession=${adminPassword}`);
    
    if (!hasValidAuth) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    try {
        const sql = neon(import.meta.env.NEON_DATABASE_URL);
        const data = await request.json();
        const { action, id, name, slug, oldName } = data;

        if (action === 'create') {
            await sql`
                INSERT INTO categories (name, slug) 
                VALUES (${name}, ${slug}) 
                ON CONFLICT (name) DO NOTHING
            `;
        } else if (action === 'update') {
            await sql`
                UPDATE categories 
                SET name = ${name}, slug = ${slug} 
                WHERE id = ${id}
            `;

            // Optionally, update existing articles to reflect the new category name
            if (oldName && oldName !== name) {
                await sql`
                    UPDATE article_drafts 
                    SET category = ${name} 
                    WHERE category = ${oldName}
                `;
            }
        } else if (action === 'delete') {
            await sql`DELETE FROM categories WHERE id = ${id}`;
        }

        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}
