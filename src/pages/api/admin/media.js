export const prerender = false;

import * as ftp from 'basic-ftp';

export async function GET({ request }) {
    // Auth Check
    const adminPassword = import.meta.env.ADMIN_PASSWORD;
    const cookieString = request.headers.get('cookie') || '';
    const hasValidAuth = cookieString.includes(`adminSession=${adminPassword}`);
    
    if (!hasValidAuth) {
        return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
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
        const urlPath = ftpPath.replace(/^\/public_html/, '');

        const client = new ftp.Client();
        client.ftp.verbose = false;

        let fileList = [];

        try {
            await client.access({
                host: ftpHost,
                user: ftpUser,
                password: ftpPass,
                secure: false, 
            });

            // Ensure the upload directory exists
            await client.ensureDir(ftpPath);

            // List files
            const files = await client.list(ftpPath);
            
            // Filter only files (type 1) and map to objects
            fileList = files
                .filter(file => file.type === 1) // 1 is File, 2 is Directory
                .map(file => ({
                    name: file.name,
                    size: file.size,
                    date: file.modifiedAt,
                    url: `${siteUrl}${urlPath}/${file.name}`
                }))
                .sort((a, b) => new Date(b.date) - new Date(a.date)); // Sort newest first

        } finally {
            client.close();
        }

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
