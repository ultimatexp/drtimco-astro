/**
 * POST /api/admin/ai-generate-prompt
 * Generates an English visual prompt for Imagen using Gemini 3.5 Flash.
 * Focuses on depicting a scientific/clinical setting with Dr. Tim (Thai male doctor with glasses/lab coat).
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
        const { title, content } = await request.json();

        if (!title && !content) {
            return new Response(JSON.stringify({ error: 'Title or content is required' }), { status: 400 });
        }

        const promptGenText = `สร้าง Prompt ภาษาอังกฤษสั้นๆ (ความยาวไม่เกิน 60 คำ) สำหรับส่งให้ AI วาดภาพประกอบบทความสุขภาพ (เช่น Imagen)
หัวข้อบทความ: ${title || '(ไม่มี)'}
เนื้อหาบทความ: ${content ? content.replace(/<[^>]*>/g, ' ').substring(0, 1000) : '(ไม่มี)'}

ความต้องการและรายละเอียดของภาพ:
1. สัดส่วน 1:1 (Square aspect ratio)
2. ภาพต้องมีตัวละคร "Dr. Tim" ซึ่งเป็นคุณหมอผู้ชายชาวไทย (young Thai male doctor) หน้าตาเป็นมิตร ผมสีดำสั้นเรียบร้อย ใส่แว่นตาเลนส์ใสกรอบสีดำ สวมเสื้อกาวน์แพทย์สีขาวคลุมทับเสื้อเชิ้ตคอปกสีขาว (ลักษณะเลียนแบบรูปจริงของหมอทิม)
3. กิจกรรมที่ตัวละครกำลังทำ วัตถุที่ถือ หรือกราฟิกแผนภูมิข้อมูลในฉากหลัง จะต้องสะท้อนและเกี่ยวโยงกับหัวข้อ/เนื้อหาของบทความสุขภาพนี้โดยตรงเพื่อให้ภาพสื่อความหมายได้ชัดเจน (ตัวอย่าง: หากเกี่ยวกับ "lactate" หรือการวิ่งออกกำลังกาย ให้มีภาพคุณหมอกำลังวิเคราะห์บอร์ดแผนภูมิวัดประสิทธิภาพกล้ามเนื้อ พลังงาน หรือความเหนื่อย; หากเกี่ยวกับเบาหวานหรือโรคไต ให้มีภาพคุณหมอกำลังอธิบายแผนภูมิตารางสารอาหาร น้ำตาล หรือวิเคราะห์ผลแล็บระดับโมเลกุล)
4. ฉากหลังต้องมีลักษณะเป็นวิทยาศาสตร์ คลินิก หรือแล็บวิทยาศาสตร์การกีฬาที่ดูทันสมัย (scientific, clinical, modern sports science lab setting, with technical charts, digital biometric data displays, or heart rate monitoring graphs, gym or testing equipment)
5. สื่ออารมณ์ความรู้สึกถึงความใส่ใจ วิทยาศาสตร์การแพทย์ที่เชื่อถือได้ หรือสุขภาพที่ดี (hope, care, medical expertise, athletic health science)
6. สไตล์ภาพถ่ายคุณภาพระดับสตูดิโอ (premium studio photography, sharp focus, professional lighting) หรือภาพสามมิติเสมือนจริงที่ดูสะอาดตา (clean modern 3D rendering)
7. หลีกเลี่ยงภาพเข็มฉีดยาหรือภาพสยองขวัญทางแพทย์
8. ห้ามใช้คำที่สะกดหรือออกเสียงคล้ายกับกาแฟหรือนม เช่น ห้ามใส่คำว่า "lactate" ใน Prompt (เนื่องจากจะถูกแปลงเป็น "latte" หรือเครื่องชงกาแฟ/นม) ให้เปลี่ยนไปใช้คำอธิบายภาพสะท้อนทางวิทยาศาสตร์และการออกกำลังกายแทน
9. ห้ามใส่คำว่า coffee, latte, milk, cup, machine หรือคำที่เกี่ยวข้องกับเครื่องดื่มคาเฟอีนใน Prompt ภาษาอังกฤษเด็ดขาด
10. ตอบกลับเฉพาะตัวข้อความ Prompt ภาษาอังกฤษเท่านั้น ไม่มีส่วนหัวหรือคำอธิบายใดๆ ทั้งสิ้น`;

        const geminiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ role: 'user', parts: [{ text: promptGenText }] }],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 2048,
                    },
                }),
            }
        );

        if (!geminiRes.ok) {
            throw new Error(`Gemini API error generating prompt: ${geminiRes.status}`);
        }

        const geminiData = await geminiRes.json();
        let imagenPrompt = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!imagenPrompt) {
            throw new Error('No prompt returned by Gemini');
        }
        imagenPrompt = imagenPrompt.trim();

        return new Response(JSON.stringify({
            success: true,
            prompt: imagenPrompt
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (err) {
        console.error('ai-generate-prompt error:', err);
        return new Response(JSON.stringify({ error: err.message || 'Prompt generation failed.' }), { status: 500 });
    }
}
