/**
 * POST /api/admin/ai-generate-image
 * Generates a 1:1 emotional impact featured image using Imagen 4.0 based on article title and content.
 * Automatically uploads it via FTP to the WordPress hosting CDN.
 */
export const prerender = false;

import { Readable } from 'stream';
import * as ftp from 'basic-ftp';
import { isAdminSession, unauthorizedJson } from '../../../lib/adminAuth.js';

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

        // 2. Call Imagen 4.0 to generate the image
        const imagenUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${apiKey}`;
        const imagenPayload = {
            instances: [
                {
                    prompt: prompt
                }
            ],
            parameters: {
                sampleCount: 1,
                aspectRatio: "1:1",
                outputMimeType: "image/jpeg"
            }
        };

        const imagenRes = await fetch(imagenUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(imagenPayload)
        });

        if (!imagenRes.ok) {
            const errText = await imagenRes.text();
            console.error('Imagen API error:', imagenRes.status, errText);
            throw new Error(`Imagen 4.0 API error: ${imagenRes.status}`);
        }

        const imagenData = await imagenRes.json();
        const base64Image = imagenData.predictions?.[0]?.bytesBase64Encoded;
        if (!base64Image) {
            throw new Error('No image bytes returned by Imagen 4.0');
        }

        // 3. Connect and Upload to FTP CDN
        const ftpHost = import.meta.env.FTP_HOST || process.env.FTP_HOST;
        const ftpUser = import.meta.env.FTP_USER || process.env.FTP_USER;
        const ftpPass = import.meta.env.FTP_PASSWORD || process.env.FTP_PASSWORD;

        if (!ftpHost || !ftpUser || !ftpPass) {
            throw new Error('FTP credentials not configured.');
        }

        const ftpPath = import.meta.env.FTP_PATH || process.env.FTP_PATH || '/public_html/wp-content/uploads/astro';
        const siteUrl = import.meta.env.FTP_SITE_URL || process.env.FTP_SITE_URL || 'https://timdietclinic.com';

        const fileName = `ai-featured-${Date.now()}.jpg`;
        const buffer = Buffer.from(base64Image, 'base64');

        const client = new ftp.Client();
        client.ftp.verbose = false;

        try {
            await client.access({
                host: ftpHost,
                user: ftpUser,
                password: ftpPass,
                secure: false
            });

            await client.ensureDir(ftpPath);
            const stream = Readable.from(buffer);
            await client.uploadFrom(stream, `${ftpPath}/${fileName}`);

            const urlPath = ftpPath.replace(/^\/public_html/, '');
            const imageUrl = `${siteUrl}${urlPath}/${fileName}`;

            return new Response(JSON.stringify({
                success: true,
                url: imageUrl,
                prompt: prompt
            }), {
                headers: { 'Content-Type': 'application/json' },
            });

        } finally {
            client.close();
        }

    } catch (err) {
        console.error('ai-generate-image error:', err);
        return new Response(JSON.stringify({ error: err.message || 'Image generation failed.' }), { status: 500 });
    }
}
