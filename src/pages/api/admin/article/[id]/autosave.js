import { neon } from '@neondatabase/serverless';

export async function PATCH({ params, request }) {
    const { id } = params;
    
    // Auth Check
    const adminPassword = import.meta.env.ADMIN_PASSWORD;
    const cookieString = request.headers.get('cookie') || '';
    const hasValidAuth = cookieString.includes(`adminSession=${adminPassword}`);
    
    // In dev mode, we might allow fallback auth checking via header, 
    // but the cookie is the primary way now.
    if (!hasValidAuth) {
        return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        const body = await request.json();
        const DATABASE_URL = import.meta.env.NEON_DATABASE_URL;
        
        if (!DATABASE_URL) {
            throw new Error('NEON_DATABASE_URL not configured');
        }

        const sql = neon(DATABASE_URL);

        // Update fields that were provided
        // We use COALESCE and parameterized queries to safely update
        // only the fields that are passed in the JSON body.
        
        await sql`
            UPDATE article_drafts
            SET 
                title = COALESCE(${body.title !== undefined ? body.title : sql`title`}, title),
                content = COALESCE(${body.content !== undefined ? body.content : sql`content`}, content),
                status = COALESCE(${body.status !== undefined ? body.status : sql`status`}, status),
                category = COALESCE(${body.category !== undefined ? body.category : sql`category`}, category),
                seo_description = COALESCE(${body.seo_description !== undefined ? body.seo_description : sql`seo_description`}, seo_description),
                direct_answer = COALESCE(${body.direct_answer !== undefined ? body.direct_answer : sql`direct_answer`}, direct_answer),
                focus_keyword = COALESCE(${body.focus_keyword !== undefined ? body.focus_keyword : sql`focus_keyword`}, focus_keyword),
                featured_image_url = COALESCE(${body.featured_image_url !== undefined ? body.featured_image_url : sql`featured_image_url`}, featured_image_url)
            WHERE id = ${id}
        `;

        return new Response(JSON.stringify({ success: true, timestamp: new Date().toISOString() }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
        
    } catch (error) {
        console.error("Autosave Error:", error);
        return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
