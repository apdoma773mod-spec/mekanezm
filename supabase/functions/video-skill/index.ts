// video-skill — «سكيل من فيديو»: فيديو بيشرح أدوات/طرق لاستخدام كلود → سكيل SKILL.md جاهز.
//   mode "transcribe": صوت جزء (WAV ١٦ كيلو مونو) → { text } الكلام زي ما اتقال (عربي/إنجليزي، أسماء الأدوات بالإنجليزي)
//   mode "skill":      { transcript, frames[] (JPEG base64 من الفيديو — لينكات/أسماء على الشاشة), name } → { skill } نص SKILL.md كامل
// الدخول: توكن مستخدم ميكانيزم. المفتاح GEMINI_API_KEY من Secrets (نفس video-ai).
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const MODELS = [Deno.env.get("VIDEO_MODEL"), "gemini-3.8-flash", "gemini-flash-latest", "gemini-3-flash-preview", "gemini-3.5-flash-lite"].filter((m, i, a) => m && a.indexOf(m) === i) as string[];
const MAX_B64 = 9_000_000;

const T_PROMPT = `ده صوت جزء من فيديو بيشرح أدوات أو طرق لاستخدام Claude (الذكاء الاصطناعي من Anthropic) أو أدوات حواليه. اكتب الكلام زي ما اتقال بالظبط (عامية مصرية أو عربي أو إنجليزي زي ما هو، من غير ترجمة). أسماء الأدوات والمواقع والأوامر اكتبها بالإنجليزي زي ما بتتكتب (مثلًا Claude Code, MCP, GitHub, npm). لو فيه لينك أو اسم موقع اتنطق اكتبه. ماتخترعش حاجة. لو مفيش كلام رجّع نص فاضي. رجّع النص بس من غير مقدمة.`;

const S_PROMPT = (name: string) => `إنت بتكتب «سكيل» (Skill) لـ Claude Code/Claude من فيديو تعليمي شافه صاحبي (عبده). الفيديو بيتكلم عن إزاي تستخدم Claude وأحسن أدوات معاه. معاك نص الكلام اللي اتقال في الفيديو (متترجم من الصوت) وكمان صور (فريمات) من الفيديو — بص عليها كويس: أي لينك أو اسم أداة أو أمر مكتوب على الشاشة خده منها.

اكتب ملف SKILL.md كامل بالشكل ده بالظبط:
---
name: <اسم قصير بالإنجليزي kebab-case بيعبّر عن موضوع الفيديو>
description: <جملة أو جملتين بالإنجليزي: السكيل ده بيعمل إيه وإمتى Claude يستخدمه>
---
# <عنوان بالعربي>
## الفيديو بيتكلم على إيه
<٣ لـ ٥ سطور ملخص بالعامية المصرية البسيطة>
## الأدوات المذكورة
لكل أداة: **اسمها** — بتعمل إيه — اللينك — إزاي تتركّب/تتشغّل (أوامر لو اتقالت).
اللينك: اكتبه لو اتقال أو ظهر في الفيديو. لو مش مذكور وإنت متأكد 100% من الموقع الرسمي اكتبه وحط جنبه «(مش في الفيديو — الموقع الرسمي)». لو مش متأكد اكتب «اللينك مش مذكور — دوّر عليه باسم الأداة». ماتخترعش لينك أبدًا.
## الخطوات والنصايح
<نقط مرتبة: إزاي تطبّق اللي اتقال، بالتفصيل العملي>
## أوامر وبرومبتات جاهزة
<أي أمر أو برومبت اتذكر، في code blocks. لو مفيش احذف القسم>
## إمتى Claude يستخدم السكيل ده
<سطرين: الحالات اللي المعلومات دي تنفع فيها>

قواعد: ماتضيفش معلومة مش في الفيديو (غير الاسم الرسمي واللينك الرسمي المتأكد منه). لو الكلام مش واضح في نقطة قول كده. العربي بالعامية المصرية البسيطة، والمصطلحات التقنية بالإنجليزي. رجّع محتوى الملف بس من غير \`\`\` حواليه ومن غير مقدمة.${name ? `\nاسم ملف الفيديو (يمكن يساعد في العنوان): ${name}` : ""}`;

import { createClient } from "npm:@supabase/supabase-js@2.45.4";
async function workerOk(req: Request) {   // العامل السحابي بيدخل بالسر بدل توكن مستخدم
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

async function gemini(gkey: string, parts: unknown[], maxTokens: number) {
  const t0 = Date.now();
  let last = "ماقدرتش أسمع الفيديو";
  for (const m of MODELS) {
    const left = 115000 - (Date.now() - t0);
    if (left < 15000) break;
    let r: Response;
    try {
      r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {
        method: "POST", signal: AbortSignal.timeout(Math.min(60000, left)),
        headers: { "x-goog-api-key": gkey, "content-type": "application/json" },
        body: JSON.stringify({ contents: [{ parts }], generationConfig: { temperature: 0.2, maxOutputTokens: maxTokens } }),
      });
    } catch (e) {
      const n = (e as Error).name; last = n === "TimeoutError" || n === "AbortError" ? "timeout: جوجل متأخر" : String((e as Error).message || e); continue;
    }
    const body = await r.json().catch(() => ({}));
    if (!r.ok) { last = body?.error?.message || `Gemini ${r.status}`; continue; }
    const txt = body?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || "").join("") || "";
    return { txt, m };
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
    const b = await req.json();
    if (b.mode === "skill") {
      const tr = String(b.transcript || "").slice(0, 60000);
      if (tr.trim().length < 20) return json({ error: "مفيش كلام كفاية في الفيديو" }, 400);
      const frames = (Array.isArray(b.frames) ? b.frames : []).slice(0, 8).filter((f: unknown) => typeof f === "string" && f.length < 900_000);
      const parts: unknown[] = [{ text: S_PROMPT(String(b.name || "").slice(0, 120)) + "\n\n=== نص الكلام ===\n" + tr }];
      frames.forEach((f: string) => parts.push({ inline_data: { mime_type: "image/jpeg", data: f } }));
      const { txt, m } = await gemini(gkey, parts, 8192);
      const skill = txt.replace(/^\s*```(?:markdown|md)?\s*\n/i, "").replace(/\n```\s*$/, "").trim();
      if (!skill.startsWith("---")) return json({ error: "الرد مش مفهوم — جرّب تاني" }, 502);
      return json({ skill, _model: m });
    }
    const audio = b.audio;
    if (typeof audio !== "string" || !audio) return json({ error: "مفيش صوت" }, 400);
    if (audio.length > MAX_B64) return json({ error: "الجزء كبير — قصّره" }, 413);
    const { txt, m } = await gemini(gkey, [{ text: T_PROMPT }, { inline_data: { mime_type: b.mime || "audio/wav", data: audio } }], 8192);
    return json({ text: txt.trim(), _model: m });
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 502);
  }
});
