// video-plus — أدوات إضافية للمونتاج الذكي (دالة إضافية، مابتغيّرش أي دالة تانية):
//   mode = "direct":    المخرج الذكي — بيقرا الكلام كله ويرجّع: أقوى جملة تبدأ بيها (hook) + هوك تاني للمقارنة (hookB)
//                       + الجمل الضعيفة/المكررة اللي تتشال (cuts) + هيكل الإعلان (مشكلة/حل/دليل/نداء) + نصايح + عناوين
//   mode = "translate": ترجمة كل جملة للإنجليزي (كابشن بلغتين)
// الدخول زي video-ai (توكن مستخدم ميكانيزم أو سر العامل). المفتاح GEMINI_API_KEY من Secrets.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-vr-secret", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const MODELS = [Deno.env.get("VIDEO_MODEL"), "gemini-3.8-flash", "gemini-flash-latest", "gemini-3-flash-preview", "gemini-3.5-flash-lite", "gemini-pro-latest"].filter((m, i, a) => m && a.indexOf(m) === i) as string[];
const GONE = /no longer available|not found|is not supported|deprecated|unknown model|404/i;
const MAX_SEG = 800;
type Seg = { i: number; s: number; e: number; t: string };

const SCH_DIRECT = {
  type: "OBJECT",
  properties: {
    hook: { type: "OBJECT", properties: { seg: { type: "INTEGER" }, text: { type: "STRING" }, why: { type: "STRING" } }, required: ["seg", "text"] },
    hookB: { type: "OBJECT", properties: { text: { type: "STRING" }, why: { type: "STRING" } }, required: ["text"] },
    cuts: { type: "ARRAY", items: { type: "OBJECT", properties: { i: { type: "INTEGER" }, why: { type: "STRING" } }, required: ["i", "why"] } },
    structure: { type: "OBJECT", properties: { problem: { type: "INTEGER" }, solution: { type: "INTEGER" }, proof: { type: "INTEGER" }, cta: { type: "INTEGER" } } },
    tips: { type: "ARRAY", items: { type: "STRING" } },
    titles: { type: "ARRAY", items: { type: "STRING" } },
    score: { type: "INTEGER" },
  },
  required: ["hook", "cuts", "structure", "tips", "score"],
};
const SCH_TR = { type: "OBJECT", properties: { items: { type: "ARRAY", items: { type: "OBJECT", properties: { i: { type: "INTEGER" }, en: { type: "STRING" } }, required: ["i", "en"] } } }, required: ["items"] };

const lines = (segs: Seg[]) => segs.map((g) => `[${g.i}] (${g.s.toFixed(1)}-${g.e.toFixed(1)}) ${g.t}`).join("\n");
const P_DIRECT = (segs: Seg[], title: string, products: string[], dur: number) => `انت مخرج ومونتير محترف لفيديوهات ريلز وتيك توك وإعلانات لمحل إكسسوار مطابخ ودريسنج روم وعدد في مصر (ميكانيزم). صاحب المحل صوّر فيديو مدته ${Math.round(dur)} ثانية بيتكلم فيه بالعامية المصرية.
${title ? "العنوان الحالي: " + title + "\n" : ""}${products.length ? "أصناف المحل: " + products.slice(0, 60).join(" | ") + "\n" : ""}
الكلام (كل سطر: [رقم الجملة] (من - لـ) النص):
${lines(segs)}

راجع الفيديو كمخرج هدفه إن الناس تكمّل الفيديو للآخر وتطلب:
- hook: أقوى جملة من الكلام تصلح تبقى أول حاجة الناس تسمعها (seg = رقمها). text = جملة هوك قصيرة جدًا (٣ لـ ٧ كلمات) بالعامية تتكتب على الشاشة في أول ثانيتين، مبنية على كلامه هو (سؤال/صدمة/رقم/مشكلة). why = ليه في سطر.
- hookB: هوك تاني مختلف في الأسلوب (لو الأول سؤال يبقى ده رقم أو تحدي) عشان يقارن بين نسختين. text بنفس الطول.
- cuts: الجمل اللي شيلها يخلّي الفيديو أقوى: تكرار لنفس المعنى، حشو، كلام ضعيف ملهوش لازمة، استطراد بعيد عن الموضوع. ماتشيلش أي جملة فيها سعر أو مقاس أو اسم منتج أو عنوان أو تليفون أو نداء للشراء. ماتشيلش أكتر من ٢٥٪ من الجمل. why = السبب في كلمتين لـ ٥.
- structure: رقم الجملة اللي فيها: problem (المشكلة/الوجع)، solution (الحل/المنتج)، proof (دليل: تجربة/مقارنة/ضمان/رقم)، cta (نداء: اطلب/كلمنا/تعالى). -1 لو مش موجودة.
- tips: من ٢ لـ ٥ نصايح قصيرة جدًا بالعامية المصرية لتحسين الفيديو ده بالذات (مثلًا «مفيش نداء في الآخر — قول اطلب دلوقتي وابعت رقمك»). من غير كلام عام.
- titles: ٣ عناوين قصيرة جذابة (٣ لـ ٦ كلمات).
- score: من ١٠٠ قد إيه الفيديو قوي كإعلان.
ماتخترعش معلومات مااتقالتش.`;
const P_TR = (segs: Seg[]) => `Translate each Egyptian Arabic line below into short, natural English subtitles (keep numbers, prices and product names; no explanations). Return one item per line with the same i.
${lines(segs)}`;

async function workerOk(req: Request) {
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
async function gemini(gkey: string, prompt: string, schema: unknown, maxTok: number) {
  const t0 = Date.now(); let last = "الذكاء مارجعش رد";
  for (const m of MODELS) {
    const left = 115000 - (Date.now() - t0);
    if (left < 15000) break;
    let r: Response;
    try {
      r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {
        method: "POST", signal: AbortSignal.timeout(Math.min(m.includes("pro") ? 80000 : 55000, left)),
        headers: { "x-goog-api-key": gkey, "content-type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json", responseSchema: schema, temperature: .2, maxOutputTokens: maxTok } }),
      });
    } catch (e) { const n = (e as Error).name; last = n === "TimeoutError" || n === "AbortError" ? "timeout: جوجل متأخر" : String((e as Error).message || e); continue; }
    const rb = await r.json().catch(() => ({}));
    if (!r.ok) { last = rb?.error?.message || `Gemini ${r.status}`; if (GONE.test(last) || r.status === 404) last = "موديل جوجل اتقفل: " + m; continue; }
    const txt = rb?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || "").join("") || "";
    try { return { d: JSON.parse(txt), m }; } catch { last = "الرد مش مفهوم"; }
  }
  throw new Error(last);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  try {
    if (!(await authed(req))) return json({ error: "لازم تسجّل دخول بحساب ميكانيزم" }, 401);
    const gkey = Deno.env.get("GEMINI_API_KEY");
    if (!gkey) return json({ error: "مفتاح Gemini مش متسجل على السيرفر" }, 500);
    const body = await req.json();
    const segs: Seg[] = (Array.isArray(body.segs) ? body.segs : [])
      .map((g: Seg) => ({ i: Number(g.i), s: Number(g.s) || 0, e: Number(g.e) || 0, t: String(g.t || "").slice(0, 300) }))
      .filter((g: Seg) => Number.isInteger(g.i) && g.t.trim()).slice(0, MAX_SEG);
    if (!segs.length) return json({ error: "مفيش كلام في الفيديو" }, 400);
    const ids = new Set(segs.map((g) => g.i));
    if (body.mode === "translate") {
      const { d, m } = await gemini(gkey, P_TR(segs), SCH_TR, 16384);
      const items = (Array.isArray(d.items) ? d.items : []).filter((x: { i: number; en: string }) => ids.has(Number(x.i)) && String(x.en || "").trim()).map((x: { i: number; en: string }) => ({ i: Number(x.i), en: String(x.en).trim().slice(0, 200) }));
      return json({ items, _model: m });
    }
    if (body.mode === "direct") {
      const products = Array.isArray(body.products) ? body.products.map(String) : [];
      const { d, m } = await gemini(gkey, P_DIRECT(segs, String(body.title || "").slice(0, 120), products, Number(body.dur) || segs[segs.length - 1].e), SCH_DIRECT, 8192);
      const okSeg = (n: unknown) => (ids.has(Number(n)) ? Number(n) : -1);
      const max = Math.floor(segs.length * .25), seen = new Set<number>();
      const cuts = (Array.isArray(d.cuts) ? d.cuts : []).filter((x: { i: number }) => { const k = Number(x.i); if (!ids.has(k) || seen.has(k)) return false; seen.add(k); return true; })
        .slice(0, max).map((x: { i: number; why?: string }) => ({ i: Number(x.i), why: String(x.why || "").slice(0, 60) }));
      const st = d.structure || {};
      return json({
        hook: { seg: okSeg(d.hook?.seg), text: String(d.hook?.text || "").slice(0, 60), why: String(d.hook?.why || "").slice(0, 120) },
        hookB: { text: String(d.hookB?.text || "").slice(0, 60), why: String(d.hookB?.why || "").slice(0, 120) },
        cuts, structure: { problem: okSeg(st.problem), solution: okSeg(st.solution), proof: okSeg(st.proof), cta: okSeg(st.cta) },
        tips: (Array.isArray(d.tips) ? d.tips : []).map((x: unknown) => String(x).slice(0, 140)).slice(0, 5),
        titles: (Array.isArray(d.titles) ? d.titles : []).map((x: unknown) => String(x).slice(0, 60)).slice(0, 3),
        score: Math.max(0, Math.min(100, Number(d.score) || 0)), _model: m,
      });
    }
    return json({ error: "mode لازم يبقى direct أو translate" }, 400);
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 502);
  }
});
