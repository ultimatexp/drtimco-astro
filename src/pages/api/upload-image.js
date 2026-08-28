/**
 * POST /api/upload-image — Upload an image to Vercel Blob / Local Storage + Neon Media Library.
 * 
 * Flow:
 *   1. Uploads file to Vercel Blob CDN (if BLOB_READ_WRITE_TOKEN is set) or public/images/uploads/
 *   2. Saves image metadata (filename, url, size, mime_type) to Neon PostgreSQL media_library table
 *   3. Returns the permanent CDN / local URL
 */
export const prerender = false;

import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { put } from '@vercel/blob';
import { isAdminKey, isAdminSession, unauthorizedJson } from '../../lib/adminAuth.js';
import { sql } from '../../lib/neon.js';

export async function POST({ request, cookies }) {
    try {
        const formData = await request.formData();
        const file = formData.get('image') || formData.get('file');
        const key = formData.get('key');
        const altText = formData.get('alt') || '';

        if (!isAdminSession(cookies) && !isAdminKey(key)) {
            return unauthorizedJson();
        }

        if (!file || !(file instanceof File)) {
            return new Response(JSON.stringify({ error: 'No image file uploaded' }), {
                status: 400, headers: { 'Content-Type': 'application/json' }
            });
        }

        const rawName = file.name.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9._-]/g, '');
        const fileName = `${Date.now()}-${rawName}`;
        const buffer = Buffer.from(await file.arrayBuffer());
        let imageUrl = '';

        const blobToken = import.meta.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_READ_WRITE_TOKEN;

        if (blobToken) {
            // Upload to Vercel Blob Storage
            const blob = await put(`uploads/${fileName}`, buffer, {
                access: 'public',
                token: blobToken,
                contentType: file.type || 'image/jpeg',
            });
            imageUrl = blob.url;
        } else {
            // Local fallback: save to public/images/uploads/
            const uploadsDir = join(process.cwd(), 'public', 'images', 'uploads');
            await mkdir(uploadsDir, { recursive: true });
            await writeFile(join(uploadsDir, fileName), buffer);
            imageUrl = `/images/uploads/${fileName}`;
        }

        // Save metadata to Neon DB media_library table
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
            await sql`
                INSERT INTO media_library (filename, url, alt_text, mime_type, size_bytes)
                VALUES (${fileName}, ${imageUrl}, ${altText}, ${file.type || ''}, ${file.size || 0});
            `;
        } catch (dbErr) {
            console.warn('⚠️ Could not record to Neon media_library:', dbErr.message);
        }

        return new Response(JSON.stringify({
            success: true,
            url: imageUrl,
            filename: fileName,
        }), {
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (err) {
        console.error('Upload error:', err);
        return new Response(JSON.stringify({ error: 'Upload failed: ' + err.message }), {
            status: 500, headers: { 'Content-Type': 'application/json' }
        });
    }
}
