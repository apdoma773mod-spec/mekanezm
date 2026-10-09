// وصف المنتج بالذكاء الاصطناعي (نفس أسلوب مدير المنتجات) — بيشوف صورة المنتج واسمه ويكتب وصف قصير بالعامية
// بتتنشر على Supabase باسم: describe-product   (اقفل «Verify JWT» — التحقق بيتعمل جوه الكود تحت)
// السر المطلوب: GEMINI_API_KEY في Edge Functions → Secrets
import { encodeBase64 } from "jsr:@std/encoding/base64";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// لو موديل زحمة أو مش متاح للمفاتيح الجديدة بنجرب اللي بعده
const MODELS = [...new Set([Deno.env.get("GEMINI_MODEL"), "gemini-3.5-flash", "gemini-flash-latest", "gemini-flash-lite-latest"].filter(Boolean))] as string[];

async function authed(req: Request): Promise<boolean> {
  const auth = req.headers.get("authorization") || "";
  const apikey = req.headers.get("apikey") || Deno.env.get("SUPABASE_ANON_KEY") || "";
  const url = Deno.env.get("SUPABASE_URL");
  if (!auth.startsWith("Bearer ") || !url) return false;
  const r = await fetch(`${url}/auth/v1/user`, { headers: { Authorization: auth, apikey } });
  if (!r.ok) return false;
  const u = await r.json();
  return !!(u && u.id); // لازم يوزر مسجّل دخول
}

const prompt = (name: string, hint: string, cat: string, kind: string) =>
  `اكتب وصف منتج لمتجر بالعربي (لهجة مصرية بسيطة ومحترفة، من ٣ لـ ٥ جمل) للمنتج: "${name}".\n` +
  (cat ? `القسم: ${cat}.\n` : "") +
  (hint ? `معلومات من صاحب المحل (لازم تستخدمها): ${hint}\n` : "") +
  (kind ? `المحل بيبيع ${kind}. ` : "") +
  `اعتمد على الصورة والاسم والمعلومات دي بس، ومتخترعش مواصفات أو مقاسات أو خامات مش ظاهرة، ومتكتبش أسعار. رجّع نص الوصف فقط بدون عنوان.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST بس" }, 405);
  if (!(await authed(req))) return json({ error: "لازم تكون مسجّل دخول في السيستم" }, 401);
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) return json({ error: "مفتاح Gemini مش متحط في إعدادات السيرفر" }, 500);

  let b: { name?: string; hint?: string; cat?: string; kind?: string; image_url?: string } = {};
  try { b = await req.json(); } catch { return json({ error: "طلب غلط" }, 400); }
  const name = String(b.name || "").trim().slice(0, 200);
  if (!name) return json({ error: "اسم المنتج مطلوب" }, 400);

  const parts: unknown[] = [{ text: prompt(name, String(b.hint || "").slice(0, 800), String(b.cat || "").slice(0, 100), String(b.kind || "").slice(0, 100)) }];
  // صورة المنتج (لينك عام https) — لو ماتحملتش بنكمل بالاسم بس
  if (b.image_url && /^https:\/\//.test(b.image_url)) {
    try {
      const r = await fetch(b.image_url, { signal: AbortSignal.timeout(15000) });
      const mt = (r.headers.get("content-type") || "").split(";")[0];
      if (r.ok && /^image\/(jpeg|png|webp)$/.test(mt)) {
        const buf = new Uint8Array(await r.arrayBuffer());
        if (buf.length < 5_000_000) parts.unshift({ inline_data: { mime_type: mt, data: encodeBase64(buf) } });
      }
    } catch { /* نكمل من غير صورة */ }
  }

  let last = "";
  for (const m of MODELS) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {
        method: "POST",
        headers: { "x-goog-api-key": key, "content-type": "application/json" },
        body: JSON.stringify({ contents: [{ parts }], generationConfig: { temperature: 0.6, maxOutputTokens: 2000 } }),
        signal: AbortSignal.timeout(30000),
      });
      const j = await r.json().catch(() => ({}));
      if (r.status === 401 || r.status === 403) return json({ error: "مفتاح Gemini مرفوض" }, 502);
      if (!r.ok) { last = `Gemini ${m} ${r.status}`; continue; }
      const txt = (j?.candidates?.[0]?.content?.parts || []).filter((p: { thought?: boolean }) => !p.thought).map((p: { text?: string }) => p.text || "").join("").trim();
      if (txt) return json({ description: txt });
      last = "رد فاضي";
    } catch (e) { last = String((e as Error).message || e); }
  }
  return json({ error: "الذكاء الاصطناعي مش متاح دلوقتي، جرّب كمان شوية (" + last + ")" }, 502);
});
