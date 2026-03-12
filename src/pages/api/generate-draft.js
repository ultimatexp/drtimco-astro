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
- **ความยาว**: 1,000-1,500 คำ (เน้นความกระชับและข้อมูลที่แน่น)
- **Formatting**: ใช้ HTML (<h2>, <h3>, <p>, <ul>, <ol>, <blockquote>, <strong>, <table>)
- **Data Visualization (MANDATORY)**: ต้องมี **ตาราง (<table>)** อย่างน้อย 1 ตาราง เพื่อสรุปข้อมูลหรือเปรียบเทียบ (เช่น อาหารที่ควรกิน vs ควรเลี่ยง)
- **Action Plan (MANDATORY)**: ต้องมีส่วน "Action Plan 1-2-3" หรือ "Checklist" ที่ผู้อ่านทำตามได้ทันที เพื่อดึงดูด Featured Snippet
- **Key Takeaways**: สรุปประเด็นสำคัญท้ายบทความ
- **FAQ Section**: ต้องมีคำถาม-คำตอบ 2-3 ข้อ (ใช้ <h3> สำหรับคำถาม) เพื่อรองรับ AEO / People Also Ask

## Output Format (JSON):
ตอบกลับเป็น JSON เท่านั้น ห้ามมีข้อความอื่นนอก JSON:
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
ตอบกลับเป็น JSON ตาม format ที่กำหนดเท่านั้น ห้ามมีคำอธิบายอื่นนอก JSON`;

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    systemInstruction: {
                        parts: [{ text: SYSTEM_PROMPT }]
                    },
                    contents: [
                        { role: 'user', parts: [{ text: userPrompt }] }
                    ],
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
            console.error('Gemini API error:', response.status, errText.substring(0, 300));
            return new Response(JSON.stringify({
                error: `Gemini API error: ${response.status}`,
                detail: errText.substring(0, 200)
            }), { status: 502 });
        }

        const data = await response.json();
        let text = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) {
            const finishReason = data.candidates?.[0]?.finishReason;
            return new Response(JSON.stringify({
                error: 'No content from Gemini',
                finishReason: finishReason || 'unknown'
            }), { status: 502 });
        }

        // Robust JSON extraction
        const article = extractJSON(text);

        if (!article) {
            console.error('JSON extraction failed. Raw text (first 300 chars):', text.substring(0, 300));
            return new Response(JSON.stringify({
                error: 'AI returned invalid JSON format',
                hint: 'Try generating again or use a simpler keyword.',
                raw_start: text.substring(0, 150),
            }), { status: 502 });
        }

        // Validate required fields
        if (!article.title || !article.content) {
            return new Response(JSON.stringify({
                error: 'AI response missing required fields (title/content)',
                fields: Object.keys(article),
            }), { status: 502 });
        }

        return new Response(JSON.stringify({ success: true, article }), {
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (err) {
        console.error('generate-draft error:', err);
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
}

/**
 * Robust JSON extraction from AI text.
 * Uses charCodeAt for reliable character comparison (avoids escape issues).
 */
function extractJSON(text) {
    // Strategy 1: Direct parse
    try { return JSON.parse(text); } catch (e) { /* continue */ }

    // Strategy 2: Strip markdown code fences
    const cleaned = text.replace(/```(?:json)?\n?/g, '').replace(/```$/g, '').trim();
    try { return JSON.parse(cleaned); } catch (e) { /* continue */ }

    // Strategy 3: Extract the top-level JSON object using brace depth matching
    const extracted = extractTopLevelJSON(cleaned);
    if (!extracted) {
        console.error('Could not find balanced JSON object. Raw text last 200 chars:', text.substring(text.length - 200));
        return null;
    }
    try { return JSON.parse(extracted); } catch (e) { /* continue */ }

    // Strategy 4: Fix unescaped control characters using charCodeAt
    const fixed = fixControlChars(extracted);
    try { return JSON.parse(fixed); } catch (e) {
        console.error('All JSON parse strategies failed:', e.message);
    }

    return null;
}

/**
 * Fix unescaped control chars (newline, tab, etc.) inside JSON string values.
 * Uses charCodeAt to avoid JavaScript string escape ambiguity.
 */
function fixControlChars(str) {
    const BACKSLASH = 92;  // \
    const QUOTE = 34;      // "
    const NEWLINE = 10;    // \n
    const CR = 13;         // \r
    const TAB = 9;         // \t

    let result = '';
    let inString = false;
    let i = 0;

    while (i < str.length) {
        const code = str.charCodeAt(i);

        // Inside a string, handle escape sequences
        if (inString && code === BACKSLASH && i + 1 < str.length) {
            // Valid escape sequence — copy both chars
            result += str[i] + str[i + 1];
            i += 2;
            continue;
        }

        // Toggle string state on unescaped quotes
        if (code === QUOTE) {
            inString = !inString;
            result += str[i];
            i++;
            continue;
        }

        // Inside strings, replace control characters with escape sequences
        if (inString) {
            if (code === NEWLINE) { result += String.fromCharCode(BACKSLASH) + 'n'; i++; continue; }
            if (code === CR) { result += String.fromCharCode(BACKSLASH) + 'r'; i++; continue; }
            if (code === TAB) { result += String.fromCharCode(BACKSLASH) + 't'; i++; continue; }
            // Other control chars (rare)
            if (code < 32) {
                result += String.fromCharCode(BACKSLASH) + 'u' + code.toString(16).padStart(4, '0');
                i++;
                continue;
            }
        }

        result += str[i];
        i++;
    }

    return result;
}

/**
 * Extract the top-level JSON object from text by matching brace depth.
 * Handles strings (with escaped quotes) to avoid false brace matches.
 */
function extractTopLevelJSON(text) {
    const LBRACE = 123;    // {
    const RBRACE = 125;    // }
    const QUOTE = 34;      // "
    const BACKSLASH = 92;  // \

    const start = text.indexOf('{');
    if (start === -1) return null;

    let depth = 0;
    let inString = false;
    let i = start;

    while (i < text.length) {
        const code = text.charCodeAt(i);

        // Handle escape sequences inside strings
        if (inString && code === BACKSLASH) {
            i += 2; // skip escaped char
            continue;
        }

        // Toggle string state
        if (code === QUOTE) {
            inString = !inString;
            i++;
            continue;
        }

        if (!inString) {
            if (code === LBRACE) depth++;
            if (code === RBRACE) {
                depth--;
                if (depth === 0) {
                    return text.substring(start, i + 1);
                }
            }
        }

        i++;
    }

    return null; // unbalanced braces
}
