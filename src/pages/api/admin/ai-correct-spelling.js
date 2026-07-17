/**
 * POST /api/admin/ai-correct-spelling
 * Corrects Thai spelling, grammar, and typos in HTML content using Gemini AI.
 * Keeps HTML structure and tags exactly intact.
 * Returns a JSON object with corrected HTML and the list of corrections.
 */
export const prerender = false;

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
        const { content } = await request.json();

        if (!content) {
            return new Response(JSON.stringify({ error: 'Content is required' }), { status: 400 });
        }

        const prompt = `คุณคือผู้เชี่ยวชาญด้านการตรวจพิสูจน์อักษรภาษาไทย หน้าที่ของคุณคือแก้ไขการสะกดคำผิด คำทับศัพท์ ไวยากรณ์ และพิมพ์ผิดในเนื้อหาบทความ HTML ต่อไปนี้

กฎสำคัญที่สุด:
1. ห้ามเพิ่ม ห้ามลบ หรือแก้ไขโครงสร้างแท็ก HTML ใดๆ (เช่น <h2>, <p>, <a>, <table>, <tr>, <td>, <br>, <strong>) โดยเด็ดขาด ห้ามเปลี่ยนลิงก์ใน href และรักษาลำดับแท็กเดิมทั้งหมด
2. รักษาใจความสำคัญและน้ำเสียงดั้งเดิมของบทความ แก้ไขเฉพาะส่วนที่พิมพ์ผิดหรือสะกดผิดเท่านั้น
3. ตอบกลับเป็นข้อมูลรูปแบบ JSON เท่านั้น โดยมีโครงสร้างดังนี้:
{
  "correctedHtml": "เนื้อหา HTML ทั้งหมดที่ผ่านการแก้ไขสะกดคำผิดแล้ว โดยรักษาโครงสร้างแท็กไว้ครบถ้วนเหมือนเดิมทุกประการ",
  "corrections": [
    {
      "original": "คำสะกดผิดดั้งเดิมที่พบในบทความ",
      "corrected": "คำที่แก้ไขให้ถูกต้องเรียบร้อยแล้ว"
    }
  ]
}

หากไม่พบคำสะกดผิดเลย ให้คืนค่า "corrections" เป็นอาเรย์ว่าง [] แต่ยังคงคืนค่า "correctedHtml" เป็นเนื้อหาเดิม

เนื้อหา HTML ที่ต้องการให้ตรวจสะกดมีดังนี้:
${content}`;

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ role: 'user', parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.1,
                        maxOutputTokens: 8192,
                        responseMimeType: 'application/json',
                    },
                }),
            }
        );

        if (!response.ok) {
            const errText = await response.text();
            console.error('Gemini API error (spelling):', response.status, errText.substring(0, 200));
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
            // Try stripping markdown code fences if AI accidentally returned them
            const cleaned = text.replace(/```(?:json)?\n?/g, '').replace(/```$/g, '').trim();
            try {
                result = JSON.parse(cleaned);
            } catch {
                return new Response(JSON.stringify({ error: 'AI returned invalid format', raw: text.substring(0, 200) }), { status: 502 });
            }
        }

        return new Response(JSON.stringify({
            success: true,
            correctedHtml: result.correctedHtml || content,
            corrections: result.corrections || []
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (err) {
        console.error('ai-correct-spelling error:', err);
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
}
