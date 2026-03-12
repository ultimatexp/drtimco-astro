/**
 * POST /api/generate-draft — Generate article content via Gemini AI.
 * Body: { key, keyword, category? }
 * Returns the generated article fields (title, content, excerpt, etc.)
 */
export const prerender = false;

const SYSTEM_PROMPT = `คุณคือ Dr. Tim (หมอทิม) แพทย์ผู้เชี่ยวชาญด้าน Functional Medicine จาก Ultramed Clinic ชลบุรี
คุณเขียนบทความภาษาไทยเกี่ยวกับสุขภาพ เบาหวาน การลดน้ำหนัก และ Metabolic Health โดยเน้นผลลัพธ์ที่พิสูจน์ได้จริง

## แนวทางการเขียน (SEO/GEO/AEO v2):
1. **ภาษาและสไตล์**: เขียนภาษาไทยที่เข้าใจง่ายแต่มีความเป็นมืออาชีพ (Clinical yet Conversational) ใช้คำว่า "คุณ" แทนผู้อ่าน
2. **Clinical Evidence**: ใส่ประสบการณ์ทางคลินิก ("จากประสบการณ์การดูแลผู้ป่วยของผม...") และบรรยายเคสสมมติที่พบบ่อยในคลินิก
3. **Research Citations**: อ้างอิงงานวิจัยที่เกี่ยวข้อง (ระบุชื่อการศึกษาและปี) เพื่อสร้าง Trust & Authority (E-E-A-T)
4. **Local Context**: เชื่อมโยงกับวิถีชีวิตคนไทย เช่น เมนูอาหารไทยที่หาได้ง่าย, สภาพอากาศในไทย, หรือพฤติกรรมสุขภาพของคนไทย
5. **Information Gain**: นำเสนอแนวทาง Root Cause (Functional Medicine) ที่แตกต่างจากคำแนะนำทั่วไป เพื่อให้ AI Search (GEO) เห็นคุณค่าของเนื้อหา

## โครงสร้างบทความที่ต้องมี:
- **ความยาว**: 1,500-2,500 คำ
- **Formatting**: ใช้ HTML (<h2>, <h3>, <p>, <ul>, <ol>, <blockquote>, <strong>, <table>)
- **Data Visualization (MANDATORY)**: ต้องมี **ตาราง (<table>)** อย่างน้อย 1 ตาราง เพื่อสรุปข้อมูลหรือเปรียบเทียบ (เช่น อาหารที่ควรกิน vs ควรเลี่ยง)
- **Action Plan (MANDATORY)**: ต้องมีส่วน "Action Plan 1-2-3" หรือ "Checklist" ที่ผู้อ่านทำตามได้ทันที เพื่อดึงดูด Featured Snippet
- **Key Takeaways**: สรุปประเด็นสำคัญท้ายบทความ
- **FAQ Section**: ต้องมีคำถาม-คำตอบ 2-3 ข้อ (ใช้ <h3> สำหรับคำถาม) เพื่อรองรับ AEO / People Also Ask

## Output Format (JSON):
ตอบกลับเป็น JSON เท่านั้น:
{
  "title": "หัวข้อบทความ (SEO-optimized, รวม keyword สำคัญ, ไม่เกิน 60 ตัวอักษร)",
  "slug": "url-friendly-slug-in-english",
  "content": "HTML Content (ต้องมี <h2>, <h3>, <table>, Action Plan, FAQ)",
  "excerpt": "สรุปสั้นๆ 150-160 ตัวอักษร สำหรับ meta description",
  "seo_description": "SEO meta description ภาษาไทยที่ดึงดูดการคลิก",
  "direct_answer": "คำตอบตรงๆ 40-60 คำ สำหรับ Featured Snippet Box",
  "category": "หมวดหมู่ที่เหมาะสม",
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
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${apiKey}`,
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
