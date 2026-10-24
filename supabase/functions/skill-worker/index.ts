// skill-worker — طابور «سكيل من لينك». العامل (GitHub Actions) بيكلّم الدالة دي بنفس سر المونتاج (mk_vr_secret):
//   peek → كام لينك مستني | claim → ياخد لينك | progress | done (السكيل والكلام) | fail
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const safeEq = (a: string, b: string) => { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; };
const T = "mk_skill_jobs";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  try {
    const b = await req.json().catch(() => ({}));
    const c = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const s = await c.from("mk_vr_secret").select("secret").limit(1).maybeSingle();
    if (!s.data || typeof b.secret !== "string" || !safeEq(String(s.data.secret), b.secret)) return json({ error: "forbidden" }, 403);
    const old = new Date(Date.now() - 15 * 60000).toISOString();
    const pend = "status.eq.queued,and(status.eq.working,updated_at.lt." + old + ")";
    if (b.action === "peek") {
      const q = await c.from(T).select("id", { count: "exact", head: true }).or(pend).lt("attempts", 3);
      return json({ n: q.count || 0 });
    }
    if (b.action === "claim") {
      const q = await c.from(T).select("*").or(pend).lt("attempts", 3).order("created_at").limit(1).maybeSingle();
      if (!q.data) return json({ job: null });
      const j = q.data;
      const u = await c.from(T).update({ status: "working", attempts: (j.attempts || 0) + 1, note: "بدأ الشغل", updated_at: new Date().toISOString() }).eq("id", j.id).eq("updated_at", j.updated_at).select("id").maybeSingle();
      if (!u.data) return json({ job: null });
      return json({ job: { id: j.id, url: j.url } });
    }
    const id = String(b.id || "");
    if (b.action === "progress") {
      await c.from(T).update({ note: String(b.note || "").slice(0, 120), updated_at: new Date().toISOString() }).eq("id", id);
      return json({ ok: true });
    }
    if (b.action === "done") {
      await c.from(T).update({ status: "done", note: "جاهز", skill: String(b.skill || "").slice(0, 60000), transcript: String(b.transcript || "").slice(0, 100000), error: "", updated_at: new Date().toISOString() }).eq("id", id);
      return json({ ok: true });
    }
    if (b.action === "fail") {
      const j = await c.from(T).select("attempts").eq("id", id).maybeSingle();
      const final = !b.retry || ((j.data?.attempts || 1) >= 3);
      await c.from(T).update({ status: final ? "failed" : "queued", error: String(b.error || "").slice(0, 300), note: final ? "فشل" : "هيعيد المحاولة", updated_at: new Date().toISOString() }).eq("id", id);
      return json({ ok: true, final });
    }
    return json({ error: "bad_action" }, 400);
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
