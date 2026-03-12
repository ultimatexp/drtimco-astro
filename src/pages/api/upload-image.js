/**
 * POST /api/upload-image — Upload an image via FTP to WordPress hosting.
 * 
 * Uploads to wp-content/uploads/astro/ directory on the WordPress server.
 * Images get permanent URLs like: https://drtim.co/wp-content/uploads/astro/image.webp
 * 
 * Requires env vars:
 *   FTP_HOST      — FTP hostname (e.g. ftp.drtim.co or your hosting IP)
 *   FTP_USER      — FTP username
 *   FTP_PASSWORD   — FTP password
 *   FTP_PATH      — Remote upload path (default: /public_html/wp-content/uploads/astro)
 *   SITE_URL      — Site base URL (default: https://drtim.co)
 */
export const prerender = false;

import * as ftp from 'basic-ftp';
import { Readable } from 'stream';

export async function POST({ request }) {
    try {
        const formData = await request.formData();
        const file = formData.get('image');
        const key = formData.get('key');

        if (key !== (import.meta.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD)) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401, headers: { 'Content-Type': 'application/json' }
            });
        }

        if (!file || !(file instanceof File)) {
            return new Response(JSON.stringify({ error: 'No image file uploaded' }), {
                status: 400, headers: { 'Content-Type': 'application/json' }
            });
        }

        const ftpHost = import.meta.env.FTP_HOST || process.env.FTP_HOST;
        const ftpUser = import.meta.env.FTP_USER || process.env.FTP_USER;
        const ftpPass = import.meta.env.FTP_PASSWORD || process.env.FTP_PASSWORD;

        if (!ftpHost || !ftpUser || !ftpPass) {
            return new Response(JSON.stringify({
                error: 'FTP credentials not configured. Set FTP_HOST, FTP_USER, FTP_PASSWORD in .env'
            }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }

        const ftpPath = import.meta.env.FTP_PATH || process.env.FTP_PATH || '/public_html/wp-content/uploads/astro';
        const siteUrl = import.meta.env.FTP_SITE_URL || process.env.FTP_SITE_URL || 'https://timdietclinic.com';

        // Prepare file
        const fileName = `${Date.now()}-${file.name.replace(/\s+/g, '-')}`;
        const buffer = Buffer.from(await file.arrayBuffer());

        // Connect and upload via FTP
        const client = new ftp.Client();
        client.ftp.verbose = false;

        try {
            await client.access({
                host: ftpHost,
                user: ftpUser,
                password: ftpPass,
                secure: false, // Set to true if your host supports FTPS
            });

            // Ensure the upload directory exists
            await client.ensureDir(ftpPath);

            // Upload the file
            const stream = Readable.from(buffer);
            await client.uploadFrom(stream, `${ftpPath}/${fileName}`);

            // Build the public URL
            // ftpPath like /public_html/wp-content/uploads/astro
            // URL should be https://drtim.co/wp-content/uploads/astro/fileName
            const urlPath = ftpPath.replace(/^\/public_html/, '');
            const imageUrl = `${siteUrl}${urlPath}/${fileName}`;

            return new Response(JSON.stringify({
                success: true,
                url: imageUrl,
            }), {
                headers: { 'Content-Type': 'application/json' },
            });

        } finally {
            client.close();
        }

    } catch (err) {
        console.error('Upload error:', err);
        return new Response(JSON.stringify({ error: 'Upload failed: ' + err.message }), {
            status: 500, headers: { 'Content-Type': 'application/json' }
        });
    }
}
