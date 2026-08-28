/**
 * POST /api/admin/ai-generate-image
 * Generates a 1:1 emotional impact featured image using Imagen 4.0 based on article title and content.
 * Automatically uploads it via Vercel Blob or local storage and records in Neon DB.
 */
export const prerender = false;

import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { put } from '@vercel/blob';
import { isAdminSession, unauthorizedJson } from '../../../lib/adminAuth.js';
import { sql } from '../../../lib/neon.js';

export async function POST({ request, cookies }) {
    if (!isAdminSession(cookies)) {
        return unauthorizedJson();
    }

    const apiKey = import.meta.env.GEMINI_API_KEY;
    if (!apiKey) {
        return new Response(JSON.stringify({ error: 'GEMINI_API_KEY not configured' }), { status: 500 });
    }

    try {
        const { prompt } = await request.json();

        if (!prompt) {
            return new Response(JSON.stringify({ error: 'Prompt is required' }), { status: 400 });
        }

        console.log('[AI Image] Using user-confirmed prompt:', prompt);

        // 1. Call Imagen 4.0 Generate endpoint
        const imagenUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${apiKey}`;

        const imagenRes = await fetch(imagenUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                instances: [{ prompt: prompt }],
                parameters: {
                    sampleCount: 1,
                    aspectRatio: '1:1',
                    outputMimeType: 'image/jpeg',
                    personGeneration: 'ALLOW_ADULT'
                }
            })
        });

        if (!imagenRes.ok) {
            const errText = await imagenRes.text();
            console.error('Imagen API failed:', imagenRes.status, errText);
            throw new Error(`Imagen 4.0 API error: ${imagenRes.status}`);
        }

        const imagenData = await imagenRes.json();
        const base64Image = imagenData.predictions?.[0]?.bytesBase64Encoded;
        if (!base64Image) {
            throw new Error('No image bytes returned by Imagen 4.0');
        }

        // 2. Save to Vercel Blob CDN or Local public uploads
        const fileName = `ai-featured-${Date.now()}.jpg`;
        const buffer = Buffer.from(base64Image, 'base64');
        let imageUrl = '';

        const blobToken = import.meta.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_READ_WRITE_TOKEN;

        if (blobToken) {
            const blob = await put(`uploads/${fileName}`, buffer, {
                access: 'public',
                token: blobToken,
                contentType: 'image/jpeg'
            });
            imageUrl = blob.url;
        } else {
            const uploadsDir = join(process.cwd(), 'public', 'images', 'uploads');
            await mkdir(uploadsDir, { recursive: true });
            await writeFile(join(uploadsDir, fileName), buffer);
            imageUrl = `/images/uploads/${fileName}`;
        }

        // 3. Record in Neon Database media_library
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
                VALUES (${fileName}, ${imageUrl}, ${prompt.slice(0, 200)}, 'image/jpeg', ${buffer.length});
            `;
        } catch (dbErr) {
            console.warn('⚠️ Could not record to Neon media_library:', dbErr.message);
        }

        return new Response(JSON.stringify({
            success: true,
            url: imageUrl,
            prompt: prompt
        }), {
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (err) {
        console.error('ai-generate-image error:', err);
        return new Response(JSON.stringify({ error: err.message || 'Image generation failed.' }), { status: 500 });
    }
}
