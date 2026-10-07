// ميكانيزم — قراءة صورة فاتورة (مطبوعة أو بخط اليد) وإرجاع البنود كـ JSON
// بتتنشر على Supabase باسم: parse-invoice   (اقفل «Verify JWT» — التحقق بيتعمل جوه الكود تحت)
// الأسرار في Supabase → Edge Functions → Secrets (واحد منهم يكفي):
//   GEMINI_API_KEY     ← مجاني من aistudio.google.com (من غير فيزا)
//   ANTHROPIC_API_KEY  ← مدفوع (Claude)
// لو الاتنين موجودين بيستخدم Gemini.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const MODEL = Deno.env.get("INVOICE_MODEL") || "claude-sonnet-5-5";
const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") || "gemini-2.5-flash";
const MAX_B64 = 7_000_000; // ~5MB صورة
const TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const TOOL = {
  name: "record_invoice",
  description: "سجّل بيانات الفاتورة زي ما هي مكتوبة بالظبط",
  input_schema: {
    type: "object",
    properties: {
      supplier: { type: "string", description: "اسم المورد/المحل صاحب الفاتورة لو ظاهر، وإلا فاضي" },
      invoice_no: { type: "string", description: "رقم الفاتورة لو ظاهر" },
      date: { type: "string", description: "تاريخ الفاتورة بصيغة YYYY-MM-DD لو ظاهر" },
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            text: { type: "string", description: "اسم/وصف الصنف زي ما هو مكتوب في الفاتورة بالظبط (من غير ترجمة أو تعديل)" },
            code: { type: "string", description: "كود/رقم الصنف عند المورد لو موجود" },
            qty: { type: "number", description: "الكمية" },
            unit: { type: "string", description: "الوحدة لو مكتوبة (قطعة، علبة، متر...)" },
            price: { type: "number", description: "سعر الوحدة" },
            total: { type: "number", description: "إجمالي البند" },
          },
          required: ["text"],
        },
      },
      notes: { type: "string", description: "أي ملاحظة عن وضوح الصورة أو بنود مش مقروءة" },
    },
    required: ["items"],
  },
};

const PROMPT = `دي صورة فاتورة (ممكن تكون مطبوعة من سيستم أو من الكمبيوتر أو مكتوبة بخط اليد، عربي أو إنجليزي).
استخرج كل بنود الأصناف بالترتيب باستخدام الأداة record_invoice.
- اكتب اسم كل صنف زي ما هو في الفاتورة بالظبط، من غير ما تترجمه أو تصلحه أو تدمج بنود.
- الأرقام بالإنجليزي (0-9) حتى لو مكتوبة بالعربي.
- متضيفش سطور الإجماليات أو الخصم أو الضريبة أو الشحن كأنها أصناف.
- لو سعر الوحدة مش مكتوب وفيه إجمالي وكمية احسبه. لو الكمية مش واضحة خليها 1.
- لو في حاجة مش مقروءة اكتبها في notes وماتخمنش أرقام.`;


const GSCHEMA = {
  type: "OBJECT",
  properties: {
    supplier: { type: "STRING" },
    invoice_no: { type: "STRING" },
    date: { type: "STRING" },
    items: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          text: { type: "STRING" }, code: { type: "STRING" }, qty: { type: "NUMBER" },
          unit: { type: "STRING" }, price: { type: "NUMBER" }, total: { type: "NUMBER" },
        },
        required: ["text"],
      },
    },
    notes: { type: "STRING" },
  },
  required: ["items"],
};

async function viaGemini(key: string, image: string, mt: string) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": key, "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: PROMPT.replace("باستخدام الأداة record_invoice", "كـ JSON") }, { inline_data: { mime_type: mt, data: image } }] }],
      generationConfig: { responseMimeType: "application/json", responseSchema: GSCHEMA, temperature: 0 },
    }),
  });
  const body = await r.json();
  if (!r.ok) return json({ error: body?.error?.message || `Gemini ${r.status}` }, 502);
  const txt = body?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || "").join("") || "";
  try { return json(JSON.parse(txt)); } catch { return json({ error: "ماقدرتش أقرا الفاتورة" }, 422); }
}

async function authed(req: Request): Promise<boolean> {
  const auth = req.headers.get("authorization") || "";
  const apikey = req.headers.get("apikey") || Deno.env.get("SUPABASE_ANON_KEY") || "";
  const url = Deno.env.get("SUPABASE_URL");
  if (!auth.startsWith("Bearer ") || !url) return false;
  const r = await fetch(`${url}/auth/v1/user`, { headers: { Authorization: auth, apikey } });
  if (!r.ok) return false;
  const u = await r.json();
  return !!(u && u.id); // لازم يوزر مسجّل دخول (مش مفتاح الموقع العام)
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  try {
    if (!(await authed(req))) return json({ error: "لازم تكون مسجّل دخول في السيستم" }, 401);
    const gkey = Deno.env.get("GEMINI_API_KEY");
    const key = Deno.env.get("ANTHROPIC_API_KEY");
    if (!gkey && !key) return json({ error: "ضيف GEMINI_API_KEY (مجاني) أو ANTHROPIC_API_KEY في Secrets" }, 500);

    const { image, media_type } = await req.json();
    if (typeof image !== "string" || !image) return json({ error: "مفيش صورة" }, 400);
    if (image.length > MAX_B64) return json({ error: "الصورة كبيرة — صوّرها تاني بحجم أصغر" }, 413);
    const mt = TYPES.includes(media_type) ? media_type : "image/jpeg";
    if (gkey) return await viaGemini(gkey, image, mt);

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key!, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4096,
        tools: [TOOL],
        tool_choice: { type: "tool", name: "record_invoice" },
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mt, data: image } },
            { type: "text", text: PROMPT },
          ],
        }],
      }),
    });
    const body = await r.json();
    if (!r.ok) return json({ error: body?.error?.message || `Anthropic ${r.status}` }, 502);
    const tu = (body.content || []).find((c: { type: string }) => c.type === "tool_use");
    if (!tu) return json({ error: "ماقدرتش أقرا الفاتورة" }, 422);
    return json(tu.input);
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
