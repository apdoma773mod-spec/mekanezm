// video-ai — مونتاج ذكي لميكانيزم ستوديو: بياخد صوت جزء من الفيديو (WAV مضغوط، ١٦ كيلو مونو) ويرجّع:
//   segments: الكلام بتوقيته (ثواني من أول الجزء) — للترجمة على الفيديو
//   events:   حاجات تتوضّح على الشاشة: مقاس/رقم بوحدة (measure) — نموذج أو صنف (product) — نقطة مهمة (point) — سعر (price)
//   title:    عنوان قصير للفيديو (من أول جزء بس)
// الدخول: توكن مستخدم مسجّل في ميكانيزم (نفس حساب السيستم). المفتاح GEMINI_API_KEY من Secrets (نفس parse-invoice).
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const MODELS = [Deno.env.get("VIDEO_MODEL") || "gemini-2.5-flash", "gemini-2.5-pro"].filter((m, i, a) => a.indexOf(m) === i);
const MAX_B64 = 9_000_000;

const SCHEMA = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    segments: { type: "ARRAY", items: { type: "OBJECT", properties: { s: { type: "NUMBER" }, e: { type: "NUMBER" }, t: { type: "STRING" } }, required: ["s", "e", "t"] } },
    events: { type: "ARRAY", items: { type: "OBJECT", properties: {
      s: { type: "NUMBER" }, e: { type: "NUMBER" }, type: { type: "STRING" }, label: { type: "STRING" }, value: { type: "STRING" }, unit: { type: "STRING" },
    }, required: ["s", "type", "label"] } },
  },
  required: ["segments", "events"],
};
const PROMPT = (offset: number, first: boolean, products: string[]) => `ده صوت جزء من فيديو شغل لمحل إكسسوار مطابخ ودريسنج روم وعدد في مصر (ميكانيزم). اللي بيتكلم صاحب المحل بالعامية المصرية وبيشرح منتج أو شغلانة.
اكتب الكلام زي ما اتقال بالظبط بالعامية المصرية (من غير تصحيح للفصحى ومن غير ترجمة)، مقسم لجمل قصيرة (من ٣ لـ ٨ كلمات) كل جملة بتوقيت بدايتها ونهايتها بالثواني من أول الجزء ده (s و e). التوقيت لازم يكون دقيق على الكلام.
events = الحاجات اللي محتاجة تتوضّح على الشاشة وقت ما بتتقال:
- measure: أي مقاس أو رقم بوحدة (سم، مم، متر، م، كيلو، بوصة، درجة، لتر). value = الرقم بالإنجليزي، unit = الوحدة زي ما اتقالت مختصرة (سم/مم/م/كجم/بوصة)، label = الجملة القصيرة اللي توضّحه (مثلًا «عرض الدرج 60 سم»).
- product: لما يذكر صنف أو نموذج أو موديل (مفصلة، مجرى، مقبض، كالون، ميكانيزم ركنة، سلة، ...). label = اسم الصنف.${products.length ? " لو الكلام قريب من صنف من دول اكتب اسمه زي ما هو: " + products.slice(0, 80).join(" | ") : ""}
- price: لو قال سعر. value = الرقم، unit = «جنيه».
- point: نقطة مهمة أو نصيحة أو ميزة (مثلًا «قفلة هادية من غير خبط»). label قصير جدًا (٢ لـ ٥ كلمات).
ماتخترعش حاجة مااتقالتش. لو مفيش كلام خالص رجّع segments فاضية.${first ? "\ntitle = عنوان قصير جذاب للفيديو (٣ لـ ٦ كلمات) من موضوع الكلام." : ""}
(ملحوظة: الجزء ده بيبدأ من الثانية ${offset} في الفيديو الأصلي، بس التوقيت اللي ترجعه يكون من أول الجزء نفسه.)`;

async function authed(req: Request) {
  const auth = req.headers.get("authorization") || "", url = Deno.env.get("SUPABASE_URL"), key = req.headers.get("apikey") || Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (!auth.startsWith("Bearer ") || !url) return false;
  const r = await fetch(`${url}/auth/v1/user`, { headers: { Authorization: auth, apikey: key } }).catch(() => null);
  if (!r || !r.ok) return false;
  const u = await r.json().catch(() => null);
  return !!(u && u.id);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  try {
    if (!(await authed(req))) return json({ error: "لازم تسجّل دخول بحساب ميكانيزم" }, 401);
    const gkey = Deno.env.get("GEMINI_API_KEY");
    if (!gkey) return json({ error: "مفتاح Gemini مش متسجل على السيرفر" }, 500);
    const { audio, mime, offset, first, products } = await req.json();
    if (typeof audio !== "string" || !audio) return json({ error: "مفيش صوت" }, 400);
    if (audio.length > MAX_B64) return json({ error: "الجزء كبير — قصّره" }, 413);
    const t0 = Date.now();
    let last = "ماقدرتش أسمع الفيديو";
    for (const m of MODELS) {
      const left = 115000 - (Date.now() - t0);
      if (left < 15000) break;
      let r: Response;
      try {
        r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {
          method: "POST", signal: AbortSignal.timeout(Math.min(m.includes("pro") ? 70000 : 50000, left)),
          headers: { "x-goog-api-key": gkey, "content-type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: PROMPT(Number(offset) || 0, !!first, Array.isArray(products) ? products.map(String) : []) }, { inline_data: { mime_type: mime || "audio/wav", data: audio } }] }],
            generationConfig: { responseMimeType: "application/json", responseSchema: SCHEMA, temperature: 0, maxOutputTokens: 16384 },
          }),
        });
      } catch (e) {
        const n = (e as Error).name; last = n === "TimeoutError" || n === "AbortError" ? "timeout: جوجل متأخر" : String((e as Error).message || e); continue;
      }
      const body = await r.json().catch(() => ({}));
      if (!r.ok) { last = body?.error?.message || `Gemini ${r.status}`; continue; }
      const txt = body?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || "").join("") || "";
      try { const d = JSON.parse(txt); return json({ ...d, _model: m }); } catch { last = "الرد مش مفهوم"; }
    }
    return json({ error: last }, 502);
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
