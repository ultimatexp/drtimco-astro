/**
 * generate-article.js
 * ──────────────────────────────────────────────────────
 * AI-assisted article generation script for DrtimCO.
 * 
 * Uses Gemini API to generate article drafts based on
 * keywords from the queue, then saves them to Neon DB.
 * 
 * Usage:
 *   NEON_DATABASE_URL=... GEMINI_API_KEY=... node scripts/generate-article.js
 * 
 * Can also be run via GitHub Actions cron job.
 */

import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.NEON_DATABASE_URL;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const LINE_NOTIFY_TOKEN = process.env.LINE_NOTIFY_TOKEN;

if (!DATABASE_URL || !GEMINI_API_KEY) {
    console.error('❌ Missing required env vars: NEON_DATABASE_URL, GEMINI_API_KEY');
    process.exit(1);
}

const sql = neon(DATABASE_URL);

// ── Dr. Tim's Writing Style System Prompt ───────────────
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

// ── Fetch next keyword from queue ────────────────────────
async function getNextKeyword() {
    const rows = await sql`
    SELECT id, keyword, category 
    FROM keyword_queue 
    WHERE used = false 
    ORDER BY priority DESC, id ASC 
    LIMIT 1
  `;

    if (rows.length === 0) {
        console.log('⚠️ No unused keywords in queue. Add more keywords!');
        return null;
    }

    return rows[0];
}

// ── Mark keyword as used ─────────────────────────────────
async function markKeywordUsed(id) {
    await sql`UPDATE keyword_queue SET used = true, used_at = NOW() WHERE id = ${id}`;
}

// ── Generate article via Gemini API ──────────────────────
async function generateArticle(keyword, category) {
    const userPrompt = `เขียนบทความเรื่อง "${keyword}" ในหมวดหมู่ "${category || 'สุขภาพทั่วไป'}"

กรุณาเขียนบทความที่ครบถ้วน ให้ข้อมูลที่มีประโยชน์ และอ้างอิงงานวิจัย
ตอบกลับเป็น JSON ตาม format ที่กำหนดเท่านั้น`;

    console.log(`🤖 Calling Gemini API for: "${keyword}"...`);

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
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
        throw new Error(`Gemini API error: ${response.status} ${await response.text()}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
        throw new Error('No content generated from Gemini API');
    }

    return JSON.parse(text);
}

// ── Save draft to Neon DB ────────────────────────────────
async function saveDraft(article, keyword) {
    const result = await sql`
    INSERT INTO article_drafts (
      title, slug, content, excerpt, seo_description, 
      direct_answer, category, tags, keyword, status
    ) VALUES (
      ${article.title},
      ${article.slug},
      ${article.content},
      ${article.excerpt},
      ${article.seo_description},
      ${article.direct_answer},
      ${article.category},
      ${article.tags},
      ${keyword},
      'review'
    )
    RETURNING id, title, slug
  `;

    return result[0];
}

// ── Send LINE Notify alert ───────────────────────────────
async function sendLineNotify(title, slug) {
    if (!LINE_NOTIFY_TOKEN) {
        console.log('ℹ️  LINE Notify token not set, skipping notification');
        return;
    }

    const message = `\n📝 บทความใหม่รอตรวจสอบ!\n\nหัวข้อ: ${title}\nSlug: ${slug}\n\nตรวจสอบได้ที่: https://drtim.co/admin/articles`;

    await fetch('https://notify-api.line.me/api/notify', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Bearer ${LINE_NOTIFY_TOKEN}`,
        },
        body: `message=${encodeURIComponent(message)}`,
    });

    console.log('📱 LINE notification sent!');
}

// ── Main ─────────────────────────────────────────────────
async function main() {
    console.log('🚀 DrtimCO Article Generator\n');

    // 1. Get next keyword
    const keyword = await getNextKeyword();
    if (!keyword) return;

    console.log(`📌 Keyword: "${keyword.keyword}" (category: ${keyword.category || 'N/A'})`);

    try {
        // 2. Generate article with Gemini
        const article = await generateArticle(keyword.keyword, keyword.category);
        console.log(`✅ Generated: "${article.title}"`);

        // 3. Save to database
        const saved = await saveDraft(article, keyword.keyword);
        console.log(`💾 Saved draft #${saved.id}: ${saved.slug}`);

        // 4. Mark keyword as used
        await markKeywordUsed(keyword.id);
        console.log(`✓ Keyword marked as used`);

        // 5. Send notification
        await sendLineNotify(article.title, saved.slug);

        console.log('\n🎉 Done! Article is ready for admin review.');
    } catch (err) {
        console.error('❌ Generation failed:', err.message);
        process.exit(1);
    }
}

main();
