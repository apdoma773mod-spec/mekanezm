// vr-worker — طابور المونتاج في الخلفية. العامل (GitHub Actions) بيكلّم الدالة دي بالسر (VR_SECRET) عشان:
//   peek      → كام مهمة مستنية
//   claim     → ياخد مهمة (مع روابط تحميل مؤقتة لأجزاء الفيديو)
//   progress  → نسبة التقدم
//   uploadurl → رابط رفع مؤقت للفيديو الجاهز
//   done / fail → يقفل المهمة
// السر متخزن في جدول mk_vr_secret (مفيش service role برّه سوبابيز). الملفات في باكت video-jobs الخاص.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const db = () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const BUCKET = "video-jobs";
const safeEq = (a: string, b: string) => { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  try {
    const b = await req.json().catch(() => ({}));
    const c = db();
    const s = await c.from("mk_vr_secret").select("secret").limit(1).maybeSingle();
    if (!s.data || typeof b.secret !== "string" || !safeEq(String(s.data.secret), b.secret)) return json({ error: "forbidden" }, 403);

    if (b.action === "peek") {
      const q = await c.from("mk_video_jobs").select("id", { count: "exact", head: true }).or("status.eq.queued,and(status.eq.working,updated_at.lt." + new Date(Date.now() - 25 * 60000).toISOString() + ")");
      return json({ n: q.count || 0 });
    }
    if (b.action === "claim") {
      const old = new Date(Date.now() - 25 * 60000).toISOString();
      const q = await c.from("mk_video_jobs").select("*").or("status.eq.queued,and(status.eq.working,updated_at.lt." + old + ")").lt("attempts", 3).order("created_at").limit(1).maybeSingle();
      if (!q.data) return json({ job: null });
      const j = q.data;
      const u = await c.from("mk_video_jobs").update({ status: "working", attempts: (j.attempts || 0) + 1, progress: 1, note: "بدأ الشغل في السحابة", updated_at: new Date().toISOString() }).eq("id", j.id).eq("updated_at", j.updated_at).select("id").maybeSingle();
      if (!u.data) return json({ job: null });   // حد تاني سبق
      const urls: string[] = [];
      for (const p of (j.parts || []) as string[]) {
        const r = await c.storage.from(BUCKET).createSignedUrl(p, 3600);
        if (r.error || !r.data) return json({ error: "مش قادر أفتح جزء الفيديو: " + (r.error?.message || p) }, 500);
        urls.push(r.data.signedUrl);
      }
      return json({ job: { id: j.id, user_id: j.user_id, name: j.name, spec: j.spec, urls } });
    }
    if (b.action === "progress") {
      await c.from("mk_video_jobs").update({ progress: Math.max(0, Math.min(99, Number(b.progress) || 0)), note: String(b.note || "").slice(0, 120), updated_at: new Date().toISOString() }).eq("id", String(b.id));
      return json({ ok: true });
    }
    if (b.action === "uploadurl") {
      const j = await c.from("mk_video_jobs").select("user_id").eq("id", String(b.id)).maybeSingle();
      if (!j.data) return json({ error: "not_found" }, 404);
      const path = `${j.data.user_id}/${b.id}/out.mp4`;
      const r = await c.storage.from(BUCKET).createSignedUploadUrl(path, { upsert: true });
      if (r.error || !r.data) return json({ error: r.error?.message || "upload url" }, 500);
      return json({ path, token: r.data.token, signedUrl: r.data.signedUrl });
    }
    if (b.action === "done") {
      const j = await c.from("mk_video_jobs").select("user_id,parts").eq("id", String(b.id)).maybeSingle();
      await c.from("mk_video_jobs").update({ status: "done", progress: 100, note: "جاهز", out_path: String(b.out_path || ""), error: "", updated_at: new Date().toISOString() }).eq("id", String(b.id));
      if (j.data && Array.isArray(j.data.parts) && j.data.parts.length) await c.storage.from(BUCKET).remove(j.data.parts as string[]);   // مسح الأصل بعد النجاح (توفير مساحة)
      return json({ ok: true });
    }
    if (b.action === "fail") {
      const j = await c.from("mk_video_jobs").select("attempts").eq("id", String(b.id)).maybeSingle();
      const final = !b.retry || ((j.data?.attempts || 1) >= 3);
      await c.from("mk_video_jobs").update({ status: final ? "failed" : "queued", error: String(b.error || "").slice(0, 300), note: final ? "فشل" : "هيعيد المحاولة", updated_at: new Date().toISOString() }).eq("id", String(b.id));
      return json({ ok: true, final });
    }
    return json({ error: "bad_action" }, 400);
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
