/**
 * POST /api/upload-image — Upload an image to the server or cloud storage.
 * Handles multipart/form-data.
 */
export const prerender = false;

import fs from 'node:fs/promises';
import path from 'node:path';
import { put } from '@vercel/blob';

export async function POST({ request }) {
    try {
        const formData = await request.formData();
        const file = formData.get('image');
        const key = formData.get('key');

        if (key !== (import.meta.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD)) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
        }

        if (!file || !(file instanceof File)) {
            return new Response(JSON.stringify({ error: 'No image file uploaded' }), { status: 400 });
        }

        const fileName = `${Date.now()}-${file.name.replace(/\s+/g, '-')}`;

        // Strategy 1: Vercel Blob (Recommended for production)
        const blobToken = import.meta.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_READ_WRITE_TOKEN;
        if (blobToken) {
            const blob = await put(`uploads/${fileName}`, file, {
                access: 'public',
                token: blobToken
            });
            return new Response(JSON.stringify({ success: true, url: blob.url }), {
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Strategy 2: Local File System (For local dev environment)
        // Note: This won't work on Vercel production as it has a read-only filesystem.
        try {
            const buffer = Buffer.from(await file.arrayBuffer());
            const uploadDir = path.join(process.cwd(), 'public', 'images', 'uploads');

            // Ensure directory exists
            await fs.mkdir(uploadDir, { recursive: true });

            const filePath = path.join(uploadDir, fileName);
            await fs.writeFile(filePath, buffer);

            return new Response(JSON.stringify({
                success: true,
                url: `/images/uploads/${fileName}`,
                local: true
            }), {
                headers: { 'Content-Type': 'application/json' },
            });
        } catch (fsErr) {
            console.error('Local Upload Error:', fsErr);
            return new Response(JSON.stringify({
                error: 'Failed to save file locally. Please configure VERCEL_BLOB_READ_WRITE_TOKEN.',
                detail: fsErr.message
            }), { status: 500 });
        }

    } catch (err) {
        console.error('Upload error:', err);
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
}
