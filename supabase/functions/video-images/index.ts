// video-images — إدراج صور ذكي لمونتاج ميكانيزم: بياخد صور (JPEG صغيرة) + كلام الفيديو بتوقيته، ويرجّع لكل صورة:
//   seg:    رقم الجملة اللي الصورة تتحط عندها (-1 = مفيش جملة مناسبة)
//   phrase: الكلمة/الكلمتين اللي لما تتقال تظهر الصورة (من نص الجملة بالظبط)
//   conf:   الثقة 0..1، kind: نوع الصورة، desc: وصف قصير للصورة، caption: كلمة صغيرة تتكتب على الصورة (اختياري)
// دالة إضافية: مابتغيّرش أي دالة تانية. الدخول زي video-ai (توكن مستخدم ميكانيزم أو سر العامل). المفتاح GEMINI_API_KEY من Secrets.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-vr-secret", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const MODELS = [Deno.env.get("VIDEO_MODEL"), "gemini-3.8-flash", "gemini-flash-latest", "gemini-3-flash-preview", "gemini-3.5-flash-lite", "gemini-pro-latest"].filter((m, i, a) => m && a.indexOf(m) === i) as string[];
const GONE = /no longer available|not found|is not supported|deprecated|unknown model|404/i;
const MAX_IMG = 30, MAX_B64_EACH = 900_000, MAX_B64_ALL = 14_000_000, MAX_SEG = 800;

const SCHEMA = {
  type: "OBJECT",
  properties: {
    matches: { type: "ARRAY", items: { type: "OBJECT", properties: {
      i: { type: "INTEGER" }, seg: { type: "INTEGER" }, phrase: { type: "STRING" }, conf: { type: "NUMBER" },
      kind: { type: "STRING" }, desc: { type: "STRING" }, caption: { type: "STRING" },
    }, required: ["i", "seg", "conf", "desc"] } },
  },
  required: ["matches"],
};

const PROMPT = (segs: { i: number; s: number; e: number; t: string }[], title: string, products: string[], n: number) => `انت مونتير فيديو لمحل إكسسوار مطابخ ودريسنج روم وعدد في مصر (ميكانيزم). صاحب المحل صوّر فيديو بيشرح فيه، ورفع ${n} صورة (منتجات، شغل متنفذ، موقع المحل، شاشة موقع/تطبيق، عروض، أسعار...). مهمتك تحط كل صورة في اللحظة المناسبة من كلامه، لما يتكلم عن حاجة ليها علاقة بالصورة بالظبط.
${title ? "عنوان الفيديو: " + title + "\n" : ""}${products.length ? "أصناف المحل (للمساعدة في التعرّف على الصورة): " + products.slice(0, 80).join(" | ") + "\n" : ""}
كلام الفيديو (كل سطر: [رقم الجملة] (من ثانية - لثانية) النص):
${segs.map((g) => `[${g.i}] (${g.s.toFixed(1)}-${g.e.toFixed(1)}) ${g.t}`).join("\n")}

الصور جاية بعد كده مرقّمة من 0 لـ ${n - 1} (قبل كل صورة سطر «الصورة رقم X»).
لكل صورة بالظبط (كل الصور، مرة واحدة لكل صورة) رجّع عنصر في matches:
- i = رقم الصورة.
- desc = وصف قصير جدًا بالعربي لإيه اللي في الصورة (٣ لـ ٨ كلمات).
- kind = واحد من: product (منتج/قطعة) — work (شغل متنفذ/تركيب) — place (موقع/محل/واجهة/خريطة) — screen (شاشة موبايل أو موقع أو تطبيق) — price (قايمة أسعار/عرض) — person (ناس) — other.
- seg = رقم الجملة اللي صاحب المحل بيتكلم فيها عن اللي في الصورة. اختار الجملة اللي بتتكلم عن نفس الحاجة بالظبط (مثلًا صورة الموقع تتحط لما يقول العنوان أو المكان، صورة المفصلة لما يتكلم عن المفصلة). لو مفيش جملة ليها علاقة حقيقية بالصورة رجّع seg = -1 و conf = 0.
- phrase = الكلمة أو الكلمتين من نص الجملة دي (زي ما هما مكتوبين بالظبط) اللي لما تتقال الصورة تظهر. لو seg = -1 رجّعها فاضية.
- conf = ثقتك من ٠ لـ ١ (١ = الجملة بتسمّي اللي في الصورة صراحة، ٠٫٥ = علاقة معقولة، أقل من ٠٫٣ = تخمين).
- caption = كلمة أو كلمتين (٢ كلمة بالكتير) تتكتب تحت الصورة لو مفيدة (اسم الصنف أو «موقعنا»)، وإلا فاضية.
قواعد: ماتخترعش علاقة مش موجودة. أكتر من صورة ممكن تتحط عند نفس الجملة لو كلهم عن نفس الكلام، بس ماتكررش نفس الصورة. لو الصورة غامضة وكلام الفيديو مفيهوش حاجة تخصها، seg = -1.`;

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  try {
    if (!(await authed(req))) return json({ error: "لازم تسجّل دخول بحساب ميكانيزم" }, 401);
    const gkey = Deno.env.get("GEMINI_API_KEY");
    if (!gkey) return json({ error: "مفتاح Gemini مش متسجل على السيرفر" }, 500);
    const body = await req.json();
    const images: { i: number; jpg: string }[] = Array.isArray(body.images) ? body.images : [];
    const segs: { i: number; s: number; e: number; t: string }[] = (Array.isArray(body.segs) ? body.segs : [])
      .map((g: { i: number; s: number; e: number; t: string }) => ({ i: Number(g.i), s: Number(g.s) || 0, e: Number(g.e) || 0, t: String(g.t || "").slice(0, 300) }))
      .filter((g: { i: number; t: string }) => Number.isFinite(g.i) && g.t).slice(0, MAX_SEG);
    if (!images.length) return json({ error: "مفيش صور" }, 400);
    if (images.length > MAX_IMG) return json({ error: "الصور كتير (أقصى " + MAX_IMG + ")" }, 413);
    if (!segs.length) return json({ error: "مفيش كلام في الفيديو لسه" }, 400);
    let total = 0;
    for (const im of images) {
      if (typeof im.jpg !== "string" || !im.jpg || im.jpg.length > MAX_B64_EACH) return json({ error: "صورة رقم " + im.i + " كبيرة أو فاضية" }, 413);
      total += im.jpg.length;
    }
    if (total > MAX_B64_ALL) return json({ error: "حجم الصور كبير" }, 413);
    const products = Array.isArray(body.products) ? body.products.map(String) : [];
    const parts: unknown[] = [{ text: PROMPT(segs, String(body.title || "").slice(0, 120), products, images.length) }];
    // الترقيم جوه الطلب 0..n-1 بالترتيب، والرد بيتحوّل لأرقام الصور الأصلية بعد كده
    images.forEach((im, k) => { parts.push({ text: "الصورة رقم " + k }); parts.push({ inline_data: { mime_type: "image/jpeg", data: im.jpg } }); });
    const t0 = Date.now();
    let last = "ماقدرتش أحلل الصور";
    for (const m of MODELS) {
      const left = 115000 - (Date.now() - t0);
      if (left < 15000) break;
      let r: Response;
      try {
        r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {
          method: "POST", signal: AbortSignal.timeout(Math.min(m.includes("pro") ? 80000 : 55000, left)),
          headers: { "x-goog-api-key": gkey, "content-type": "application/json" },
          body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseMimeType: "application/json", responseSchema: SCHEMA, temperature: 0, maxOutputTokens: 8192 } }),
        });
      } catch (e) {
        const n = (e as Error).name; last = n === "TimeoutError" || n === "AbortError" ? "timeout: جوجل متأخر" : String((e as Error).message || e); continue;
      }
      const rb = await r.json().catch(() => ({}));
      if (!r.ok) { last = rb?.error?.message || `Gemini ${r.status}`; if (GONE.test(last) || r.status === 404) last = "موديل جوجل اتقفل: " + m; continue; }
      const txt = rb?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || "").join("") || "";
      try {
        const d = JSON.parse(txt);
        const segIdx = new Set(segs.map((g) => g.i)), seen = new Set<number>();
        const out = (Array.isArray(d.matches) ? d.matches : []).map((x: { i: number; seg: number; phrase?: string; conf: number; kind?: string; desc?: string; caption?: string }) => {
          const k = Number(x.i); if (!Number.isInteger(k) || k < 0 || k >= images.length || seen.has(k)) return null; seen.add(k);
          const sg = Number(x.seg), ok = segIdx.has(sg);
          return { i: images[k].i, seg: ok ? sg : -1, phrase: ok ? String(x.phrase || "").slice(0, 60) : "", conf: ok ? Math.max(0, Math.min(1, Number(x.conf) || 0)) : 0, kind: String(x.kind || "other"), desc: String(x.desc || "").slice(0, 80), caption: String(x.caption || "").slice(0, 30) };
        }).filter(Boolean);
        return json({ matches: out, _model: m });
      } catch { last = "الرد مش مفهوم"; }
    }
    return json({ error: last }, 502);
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
