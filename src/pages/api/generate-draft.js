/**
 * POST /api/generate-draft — Generate article content via Gemini AI.
 * Body: { key, keyword, category? }
 * Returns the generated article fields (title, content, excerpt, etc.)
 */
export const prerender = false;

const SYSTEM_PROMPT = `คุณคือ Dr. Tim (หมอทิม) แพทย์ผู้เชี่ยวชาญด้าน Functional Medicine จาก Ultramed Clinic ชลบุรี
คุณเขียนบทความภาษาไทยเกี่ยวกับสุขภาพ เบาหวาน การลดน้ำหนัก และ Metabolic Health

## แนวทางการเขียน:
1. เขียนเป็นภาษาไทยที่เข้าใจง่าย ใช้ศัพท์ทางการแพทย์พร้อมคำอธิบาย
2. ใส่ประสบการณ์ทางคลินิก เช่น "จากประสบการณ์การดูแลผู้ป่วยของผม..."
3. อ้างอิงงานวิจัยที่เกี่ยวข้อง (ระบุชื่อการศึกษาและปี)
4. เขียนแบบเป็นกันเอง สื่อสารกับคนไข้โดยตรง ใช้คำว่า "คุณ" แทนผู้อ่าน
5. ใส่ข้อมูลเชิงปฏิบัติที่ผู้อ่านนำไปใช้ได้ทันที
6. หลีกเลี่ยงการพูดเกินจริง ใช้หลักฐานเชิงประจักษ์เสมอ
7. เน้น Root Cause ของโรค ไม่ใช่แค่รักษาอาการ

## โครงสร้างบทความ:
- ความยาว: 1,500-2,500 คำ
- ใช้ HTML สำหรับ formatting (<h2>, <h3>, <p>, <ul>, <ol>, <blockquote>, <strong>)
- มี heading (h2, h3) ที่ชัดเจนแบ่งเนื้อหา
- มีส่วน "สรุป" หรือ "Key Takeaways" ท้ายบทความ
- ต้องมี FAQ 2-3 คำถาม ท้ายบทความ (ใช้ <h3> สำหรับคำถาม)

## Output Format (JSON):
ตอบกลับเป็น JSON เท่านั้น ไม่ต้องมี markdown code block:
{
  "title": "หัวข้อบทความ (ภาษาไทย, SEO-optimized, ไม่เกิน 60 ตัวอักษร)",
  "slug": "url-friendly-slug-in-english",
  "content": "<h2>...</h2><p>...</p>... (HTML content)",
  "excerpt": "สรุปสั้นๆ 2-3 ประโยค สำหรับ meta description (150-160 ตัวอักษร)",
  "seo_description": "SEO meta description ภาษาไทย (150-160 ตัวอักษร)",
  "direct_answer": "คำตอบตรงๆ 40-60 คำ สำหรับ Direct Answer Box / Featured Snippet",
  "category": "หมวดหมู่ที่เหมาะสมที่สุด",
  "tags": ["tag1", "tag2", "tag3"]
}`;

export async function POST({ request }) {
    const body = await request.json();
    const { key, keyword, category } = body;

    if (key !== (import.meta.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD)) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    if (!keyword) {
        return new Response(JSON.stringify({ error: 'keyword is required' }), { status: 400 });
    }

    const apiKey = import.meta.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return new Response(JSON.stringify({ error: 'GEMINI_API_KEY not configured' }), { status: 500 });
    }

    const userPrompt = `เขียนบทความเรื่อง "${keyword}" ${category ? `ในหมวดหมู่ "${category}"` : ''}

กรุณาเขียนบทความที่ครบถ้วน ให้ข้อมูลที่มีประโยชน์ และอ้างอิงงานวิจัย
ตอบกลับเป็น JSON ตาม format ที่กำหนดเท่านั้น`;

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [
                        { role: 'user', parts: [{ text: SYSTEM_PROMPT + '\n\n' + userPrompt }] }
                    ],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 8192,
                        responseMimeType: 'application/json',
                    },
                }),
            }
        );

        if (!response.ok) {
            const errText = await response.text();
            return new Response(JSON.stringify({ error: `Gemini API error: ${response.status}`, detail: errText }), { status: 502 });
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) {
            return new Response(JSON.stringify({ error: 'No content from Gemini' }), { status: 502 });
        }

        const article = JSON.parse(text);
        return new Response(JSON.stringify({ success: true, article }), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
}
