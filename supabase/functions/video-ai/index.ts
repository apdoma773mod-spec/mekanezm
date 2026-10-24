// video-ai — مونتاج ذكي لميكانيزم ستوديو: بياخد صوت جزء من الفيديو (WAV مضغوط، ١٦ كيلو مونو) ويرجّع:
//   segments: الكلام بتوقيته (ثواني من أول الجزء) — للترجمة على الفيديو
//   events:   حاجات تتوضّح على الشاشة: مقاس/رقم بوحدة (measure) — نموذج أو صنف (product) — نقطة مهمة (point) — سعر (price) — خطوة (step) — تحذير (warn) — قسم جديد (topic) — رسمة متحركة (anim: scene + action)
//   segments[].kw = أهم كلمة/كلمتين تتلوّن — segments[].cut = جملة تتشال (إعادة/تهتهة)
//   title:    عنوان قصير للفيديو (من أول جزء بس)
// الدخول: توكن مستخدم مسجّل في ميكانيزم (نفس حساب السيستم). المفتاح GEMINI_API_KEY من Secrets (نفس parse-invoice).
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-vr-secret", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
// الموديلات بالترتيب: لو جوجل قفل موديل (زي gemini-2.5-pro «no longer available») بنعدّي للي بعده على طول
const MODELS = [Deno.env.get("VIDEO_MODEL"), "gemini-3.8-flash", "gemini-flash-latest", "gemini-3-flash-preview", "gemini-3.5-flash-lite", "gemini-pro-latest"].filter((m, i, a) => m && a.indexOf(m) === i) as string[];
const GONE = /no longer available|not found|is not supported|deprecated|unknown model|404/i;
const MAX_B64 = 9_000_000;

const SCHEMA = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    segments: { type: "ARRAY", items: { type: "OBJECT", properties: { s: { type: "NUMBER" }, e: { type: "NUMBER" }, t: { type: "STRING" }, cut: { type: "BOOLEAN" }, kw: { type: "ARRAY", items: { type: "STRING" } } }, required: ["s", "e", "t"] } },
    events: { type: "ARRAY", items: { type: "OBJECT", properties: {
      s: { type: "NUMBER" }, e: { type: "NUMBER" }, type: { type: "STRING" }, label: { type: "STRING" }, value: { type: "STRING" }, unit: { type: "STRING" }, scene: { type: "STRING" }, action: { type: "STRING" },
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
- point: نقطة مهمة أو ميزة (مثلًا «قفلة هادية من غير خبط»). label قصير جدًا (٢ لـ ٥ كلمات).
- step: لما يشرح خطوات (أولًا/تاني حاجة/بعد كده). value = رقم الخطوة، label = الخطوة في ٢ لـ ٥ كلمات.
- warn: تحذير أو غلطة بيحذر منها (مثلًا «ماتركبش المجرى مايل»). label قصير.
- anim: رسمة متحركة بتشرح اللي بيتقال (مهمة جدًا — طلّعها كل ما يتكلم عن طريقة شغل منتج أو مشكلة فيه، مرة كل ١٠-٢٠ ثانية تقريبًا). scene = واحد من دول بالظبط: flap_up (ضلفة بتفتح لفوق / دراع باكم / بستم / قلاب) — drawer (مجرى درج / أدراج) — hinge_door (مفصلة / ضلفة بتفتح عادي) — lock (كالون / قفل / مفتاح) — corner_basket (ميكانيزم ركنة / كرسيل) — wardrobe_lift (بانتوجراف / شماعة دريسنج بتنزل) — handle (مقبض / أكرة) — item (أي منتج تاني). action = واحد من دول: open (بيشرح إنه بيفتح أو بيشتغل) — soft (بيقفل بالراحة / من غير خبط) — break (بيتكسر / بيبوظ / ضعيف) — heavy (بيشيل وزن تقيل) — compare (بيقارن العادي اللي بيتكسر باللي عندنا). label = جملة قصيرة تتكتب تحت الرسمة (٣ لـ ٧ كلمات). s = لحظة ما بيبدأ الكلام عنها.
- topic: لما يبدأ يتكلم في موضوع جديد جوه الفيديو. label = عنوان القسم في ٢ لـ ٤ كلمات. ماتكترش منه (مرة كل ٢٠-٤٠ ثانية بالكتير).
في كل جملة من segments:
- kw = من كلمة لكلمتين بالظبط زي ما مكتوبين في t، أهم كلمات في الجملة (رقم، اسم صنف، ميزة، كلمة فيها حماس). لو مفيش رجّع kw فاضية.
- cut = true لو الجملة دي لازم تتشال من الفيديو: بداية غلط واتعادت بعدها، أو تكرار لنفس الكلام، أو تهتهة/«إيه… يعني…» من غير معنى، أو كلام مش للجمهور (زي «استنى نعيد» أو «كده تمام؟»). غير كده cut = false. لو اتعادت جملة خلي آخر واحدة بس.
ماتخترعش حاجة مااتقالتش. لو مفيش كلام خالص رجّع segments فاضية.${first ? "\ntitle = عنوان قصير جذاب للفيديو (٣ لـ ٦ كلمات) من موضوع الكلام." : ""}
(ملحوظة: الجزء ده بيبدأ من الثانية ${offset} في الفيديو الأصلي، بس التوقيت اللي ترجعه يكون من أول الجزء نفسه.)`;

import { createClient } from "npm:@supabase/supabase-js@2.45.4";
async function workerOk(req: Request) {   // العامل بتاع المونتاج في الخلفية (GitHub Actions) بيدخل بالسر بدل توكن مستخدم
  const sec = req.headers.get("x-vr-secret") || "";
  if (!sec) return false;
  const c = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const r = await c.from("mk_vr_secret").select("secret").limit(1).maybeSingle();
  return !!(r.data && String(r.data.secret) === sec);
}
async function authed(req: Request) {
  if (await workerOk(req)) return true;
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
      if (!r.ok) { last = body?.error?.message || `Gemini ${r.status}`; if (GONE.test(last) || r.status === 404) last = "موديل جوجل اتقفل: " + m; continue; }
      const txt = body?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || "").join("") || "";
      try { const d = JSON.parse(txt); return json({ ...d, _model: m }); } catch { last = "الرد مش مفهوم"; }
    }
    return json({ error: last }, 502);
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
