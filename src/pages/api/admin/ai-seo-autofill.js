/**
 * POST /api/admin/ai-seo-autofill
 * Generates SEO Description, Direct Answer, and Focus Keyword from article title + content.
 * Uses Gemini AI.
 */
export const prerender = false;

export async function POST({ request }) {
    // Auth
    const adminPassword = import.meta.env.ADMIN_PASSWORD;
    const cookieString = request.headers.get('cookie') || '';
    if (!cookieString.includes(`adminSession=${adminPassword}`)) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const apiKey = import.meta.env.GEMINI_API_KEY;
    if (!apiKey) {
        return new Response(JSON.stringify({ error: 'GEMINI_API_KEY not configured' }), { status: 500 });
    }

    try {
        const { title, content, category } = await request.json();

        if (!title && !content) {
            return new Response(JSON.stringify({ error: 'Title or content is required' }), { status: 400 });
        }

        // Strip HTML tags for cleaner AI input, limit to ~2000 chars
        const plainContent = (content || '')
            .replace(/<[^>]*>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 2000);

        const prompt = `จากบทความนี้ ช่วยสร้าง SEO metadata ภาษาไทย:

หัวข้อ: ${title || '(ไม่มี)'}
หมวดหมู่: ${category || '(ไม่ระบุ)'}
เนื้อหา (ส่วนหนึ่ง): ${plainContent || '(ไม่มีเนื้อหา)'}

กรุณาตอบเป็น JSON เท่านั้น ตาม format นี้:
{
  "seo_description": "SEO meta description ดึงดูดการคลิก 120-155 ตัวอักษร ภาษาไทย",
  "direct_answer": "คำตอบตรงๆ 40-60 คำ สำหรับ Featured Snippet Box / AI snippet ภาษาไทย",
  "focus_keyword": "คำ keyword หลัก 1-3 คำ ภาษาไทย ที่เกี่ยวข้องกับบทความมากที่สุด"
}`;

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ role: 'user', parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.3,
                        maxOutputTokens: 512,
                        responseMimeType: 'application/json',
                    },
                }),
            }
        );

        if (!response.ok) {
            const errText = await response.text();
            console.error('Gemini API error:', response.status, errText.substring(0, 200));
            return new Response(JSON.stringify({ error: `AI API error: ${response.status}` }), { status: 502 });
        }

        const data = await response.json();
        let text = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) {
            return new Response(JSON.stringify({ error: 'No response from AI' }), { status: 502 });
        }

        // Parse JSON from AI response
        let result;
        try {
            result = JSON.parse(text);
        } catch {
            // Try stripping markdown code fences
            const cleaned = text.replace(/```(?:json)?\n?/g, '').replace(/```$/g, '').trim();
            try {
                result = JSON.parse(cleaned);
            } catch {
                return new Response(JSON.stringify({ error: 'AI returned invalid format', raw: text.substring(0, 200) }), { status: 502 });
            }
        }

        return new Response(JSON.stringify({
            success: true,
            seo_description: result.seo_description || '',
            direct_answer: result.direct_answer || '',
            focus_keyword: result.focus_keyword || ''
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (err) {
        console.error('ai-seo-autofill error:', err);
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
}
