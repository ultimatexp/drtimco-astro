export const prerender = false;

import { readdir, stat } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { isAdminSession } from '../../../lib/adminAuth.js';
import { sql } from '../../../lib/neon.js';

export async function GET({ cookies }) {
    if (!isAdminSession(cookies)) {
        return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        const fileList = [];
        const seenUrls = new Set();

        // 1. Fetch from Neon Database media_library
        try {
            const rows = await sql`
                SELECT id, filename as name, url, mime_type, size_bytes as size, alt_text, uploaded_at as date
                FROM media_library
                ORDER BY uploaded_at DESC
                LIMIT 150
            `;
            for (const r of rows) {
                fileList.push(r);
                seenUrls.add(r.url);
            }
        } catch (dbErr) {
            console.warn('⚠️ Could not query Neon media_library:', dbErr.message);
        }

        // 2. Scan local public/images/uploads directory
        try {
            const uploadsDir = join(process.cwd(), 'public', 'images', 'uploads');
            if (existsSync(uploadsDir)) {
                const files = await readdir(uploadsDir);
                for (const f of files) {
                    if (f.startsWith('.')) continue;
                    const url = `/images/uploads/${f}`;
                    if (seenUrls.has(url)) continue;

                    const s = await stat(join(uploadsDir, f));
                    fileList.push({
                        name: f,
                        url,
                        size: s.size,
                        date: s.mtime,
                        mime_type: 'image/jpeg',
                        alt_text: ''
                    });
                }
            }
        } catch (fsErr) {
            console.warn('⚠️ Could not scan local uploads:', fsErr.message);
        }

        // Sort newest first
        fileList.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

        return new Response(JSON.stringify({ success: true, files: fileList }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error("Media List Error:", error);
        return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
