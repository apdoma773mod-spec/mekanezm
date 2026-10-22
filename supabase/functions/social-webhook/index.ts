// social-webhook — صندوق رسايل الصفحات الموحد لميكانيزم (#15)
// • GET  (Meta)  : تأكيد الـ webhook (hub.verify_token = META_VERIFY_TOKEN)
// • POST (Meta)  : رسايل فيسبوك ماسنجر وإنستجرام (توقيع X-Hub-Signature-256 بـ META_APP_SECRET)
// • POST ?src=tiktok : رسايل تيك توك (توقيع TikTok-Signature بـ TIKTOK_CLIENT_SECRET)
// • POST {action:'send'|'status'} من شاشة السيستم: لازم توكن المستخدم ويكون مدير (mk_social_can)
// القواعد: نفس كلمات الواتساب (mk_settings: wa_rules)، والرد لكل نوع في mk_settings: social_cfg.
// مفيش أي مفتاح هنا: كله من Supabase secrets.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const env = (k: string) => Deno.env.get(k) || "";
const URL_ = env("SUPABASE_URL"), SRV = env("SUPABASE_SERVICE_ROLE_KEY"), ANON = env("SUPABASE_ANON_KEY");
const GRAPH = "https://graph.facebook.com/v21.0";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };
const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const db = () => createClient(URL_, SRV, { auth: { persistSession: false } });

// ───────── محرك المطابقة (منقول من whatsapp-bridge/wa-filter.js بنفس المنطق)
function norm(s: string) {
  return String(s || "").replace(/[ً-ٰـ]/g, "").replace(/[أإآٱ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/ؤ/g, "و").replace(/ئ/g, "ي")
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).toLowerCase().replace(/(.)\1{2,}/g, "$1$1").replace(/\s+/g, " ").trim();
}
const words = (t: string) => t.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
const PREFIXES = ["وال", "بال", "فال", "كال", "لل", "ال", "و", "ف", "ب", "ل", "ك", "ا", "ي", "ت", "ن", "س"];
function variants(w: string) { const out = new Set([w]); const strip = (x: string, d: number) => { if (d > 2) return; for (const p of PREFIXES) if (x.length - p.length >= 2 && x.startsWith(p)) { const y = x.slice(p.length); if (!out.has(y)) { out.add(y); strip(y, d + 1); } } }; strip(w, 1); return [...out]; }
const skel = (x: string) => x.charAt(0) + x.slice(1).replace(/[اوي]/g, "");
function lev(a: string, b: string) { if (a === b) return 0; const m = a.length, n = b.length; if (!m) return n; if (!n) return m; let prev = Array.from({ length: n + 1 }, (_, i) => i); for (let i = 1; i <= m; i++) { const cur = [i]; for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = cur; } return prev[n]; }
function wordHit(w: string, q: string, fuzzy?: boolean) {
  if (w === q) return true; if (q.length <= 2) return false;
  for (const v of variants(w)) {
    if (v === q) return true;
    if (v.startsWith(q) && v.length - q.length <= 5) return true;
    if (q.length >= 4) { const sq = skel(q), sv = skel(v); if (sq.length >= 3 && (sv === sq || (sv.startsWith(sq) && sv.length - sq.length <= 3))) return true; }
    if (fuzzy !== false && q.length >= 5) { const lim = q.length >= 7 && v[0] === q[0] ? 2 : 1; if (Math.abs(v.length - q.length) <= lim && lev(v, q) <= lim) return true; if (v.length > q.length && lev(v.slice(0, q.length), q) <= lim && v.length - q.length <= 4) return true; }
  }
  return false;
}
function phraseHit(p: string, t: string, ws: string[], mode?: string, fuzzy?: boolean) {
  const q = norm(p); if (!q) return false;
  if (mode === "exact") return t === q;
  const qw = words(q); if (!qw.length) return false;
  if (mode === "starts") return qw.every((x, i) => ws[i] && wordHit(ws[i], x, fuzzy));
  if (qw.length === 1) return ws.some((w) => wordHit(w, qw[0], fuzzy));
  if ((" " + ws.join(" ") + " ").includes(" " + qw.join(" ") + " ")) return true;
  for (let i = 0; i < ws.length; i++) { if (!wordHit(ws[i], qw[0], fuzzy)) continue; const win = ws.slice(i, i + qw.length + 5); if (qw.every((x) => win.some((w) => wordHit(w, x, fuzzy)))) return true; }
  return false;
}
// deno-lint-ignore no-explicit-any
function matchRule(cfg: any, text: string) {
  const t = norm(text), ws = words(t); if (!ws.length) return null;
  // deno-lint-ignore no-explicit-any
  if ((cfg.never || []).some((p: string) => phraseHit(p, t, ws, "contains", false))) return null;
  for (const r of cfg.rules || []) {
    if (r.on === false || r.scope === "owner") continue;
    if ((r.not || []).some((p: string) => phraseHit(p, t, ws, "contains", false))) continue;
    if ((r.phrases || []).some((p: string) => phraseHit(p, t, ws, r.mode, r.fuzzy))) return r;
  }
  return null;
}

// ───────── أدوات
async function hmacHex(secret: string, data: string) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return [...new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(data)))].map((b) => b.toString(16).padStart(2, "0")).join("");
}
const safeEq = (a: string, b: string) => { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; };
async function settings(keys: string[]) { const { data } = await db().from("mk_settings").select("key,value").in("key", keys); const o: Record<string, unknown> = {}; (data || []).forEach((r) => (o[r.key] = r.value)); return o; }

async function sendMeta(platform: string, to: string, text: string) {
  const tok = platform === "instagram" ? (env("META_IG_TOKEN") || env("META_PAGE_TOKEN")) : env("META_PAGE_TOKEN");
  if (!tok) return { ok: false, err: "مفتاح الصفحة (META_PAGE_TOKEN) مش متسجل" };
  const r = await fetch(`${GRAPH}/me/messages?access_token=${encodeURIComponent(tok)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recipient: { id: to }, messaging_type: "RESPONSE", message: { text } }) });
  const j = await r.json().catch(() => ({}));
  return r.ok ? { ok: true, id: j.message_id || "" } : { ok: false, err: (j.error && j.error.message) || ("HTTP " + r.status) };
}
async function sendTikTok(to: string, text: string, meta: Record<string, unknown>) {
  const tok = env("TIKTOK_ACCESS_TOKEN"), biz = env("TIKTOK_BUSINESS_ID"), url = env("TIKTOK_SEND_URL") || "https://business-api.tiktok.com/open_api/v1.3/business/message/send/";
  if (!tok || !biz) return { ok: false, err: "مفاتيح تيك توك مش متسجلة", pending: true };
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "Access-Token": tok }, body: JSON.stringify({ business_id: biz, recipient_type: "CONVERSATION", recipient: meta.conversation_id || to, message_type: "TEXT", text: { body: text } }) });
  const j = await r.json().catch(() => ({}));
  return r.ok && (j.code === 0 || j.code === undefined) ? { ok: true, id: (j.data && j.data.message_id) || "" } : { ok: false, err: j.message || ("HTTP " + r.status) };
}
const send = (platform: string, to: string, text: string, meta: Record<string, unknown> = {}) => platform === "tiktok" ? sendTikTok(to, text, meta) : sendMeta(platform, to, text);

// رسالة واردة: تتسجل، ولو فيها كلمة ليها رد متفعّل يترد عليها تلقائي
async function incoming(m: { platform: string; page_id: string; thread_id: string; ext_id: string; body: string; name?: string; meta?: Record<string, unknown> }) {
  const c = db();
  const ins = await c.from("mk_social_msgs").insert({ platform: m.platform, page_id: m.page_id, thread_id: m.thread_id, ext_id: m.ext_id || null, body: m.body || "", sender_name: m.name || "", direction: "in", status: "new", meta: m.meta || {} }).select("id").maybeSingle();
  if (ins.error) return; // مكرر (ext_id) أو خطأ — مانردّش مرتين
  const S = await settings(["wa_rules", "social_cfg"]);
  // deno-lint-ignore no-explicit-any
  const cfg: any = S.social_cfg || {}, rules = S.wa_rules || {};
  if (cfg.platforms && cfg.platforms[m.platform] === false) return;
  const r = m.body ? matchRule(rules, m.body) : null;
  if (!r) return; // مفيش كلمة: تفضل «new» وعبده يرد بنفسه
  const type = String(r.type || r.name || ""), rep = (cfg.replies || {})[type];
  if (!rep || rep.on === false || !String(rep.text || "").trim() || cfg.autoOn === false) { await c.from("mk_social_msgs").update({ rule_type: type }).eq("id", ins.data!.id); return; }
  const res = await send(m.platform, m.thread_id, String(rep.text), m.meta || {});
  await c.from("mk_social_msgs").update({ rule_type: type, status: res.ok ? "auto" : "new" }).eq("id", ins.data!.id);
  await c.from("mk_social_msgs").insert({ platform: m.platform, page_id: m.page_id, thread_id: m.thread_id, ext_id: res.ok && res.id ? res.id : null, body: String(rep.text), direction: "out", rule_type: type, status: res.ok ? "sent" : (res.pending ? "pending" : "failed"), by_name: "رد تلقائي (" + type + ")", meta: res.ok ? {} : { err: res.err } });
}
async function metaName(platform: string, id: string) {
  const tok = platform === "instagram" ? (env("META_IG_TOKEN") || env("META_PAGE_TOKEN")) : env("META_PAGE_TOKEN"); if (!tok) return "";
  try { const r = await fetch(`${GRAPH}/${id}?fields=${platform === "instagram" ? "username,name" : "name"}&access_token=${encodeURIComponent(tok)}`); const j = await r.json(); return j.name || j.username || ""; } catch { return ""; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const u = new URL(req.url);
  // تأكيد Meta
  if (req.method === "GET") {
    if (u.searchParams.get("hub.mode") === "subscribe" && env("META_VERIFY_TOKEN") && u.searchParams.get("hub.verify_token") === env("META_VERIFY_TOKEN")) return new Response(u.searchParams.get("hub.challenge") || "", { status: 200 });
    return new Response("forbidden", { status: 403 });
  }
  const raw = await req.text();
  // deno-lint-ignore no-explicit-any
  let body: any = {}; try { body = JSON.parse(raw || "{}"); } catch { body = {}; }

  // من شاشة السيستم (مدير بس)
  if (body && (body.action === "send" || body.action === "status")) {
    const auth = req.headers.get("Authorization") || "";
    const uc = createClient(URL_, ANON, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
    const can = await uc.rpc("mk_social_can"); if (can.error || can.data !== true) return json({ error: "admin_only" }, 403);
    if (body.action === "status") return json({ meta: !!(env("META_APP_SECRET") && env("META_PAGE_TOKEN") && env("META_VERIFY_TOKEN")), instagram: !!(env("META_APP_SECRET") && (env("META_IG_TOKEN") || env("META_PAGE_TOKEN"))), tiktok: !!(env("TIKTOK_CLIENT_SECRET") && env("TIKTOK_ACCESS_TOKEN") && env("TIKTOK_BUSINESS_ID")) });
    const text = String(body.text || "").trim(), platform = String(body.platform || ""), thread = String(body.thread_id || "");
    if (!text || !thread || !["facebook", "instagram", "tiktok"].includes(platform)) return json({ error: "bad_request" }, 400);
    const who = await uc.rpc("mk_me_name"); const c = db();
    const last = await c.from("mk_social_msgs").select("page_id,meta").eq("thread_id", thread).eq("direction", "in").order("created_at", { ascending: false }).limit(1).maybeSingle();
    const res = await send(platform, thread, text, (last.data && last.data.meta) || {});
    await c.from("mk_social_msgs").insert({ platform, page_id: (last.data && last.data.page_id) || "", thread_id: thread, ext_id: res.ok && res.id ? res.id : null, body: text, direction: "out", status: res.ok ? "sent" : (res.pending ? "pending" : "failed"), by_name: String(who.data || ""), meta: res.ok ? {} : { err: res.err } });
    if (res.ok) await c.from("mk_social_msgs").update({ status: "replied" }).eq("thread_id", thread).eq("direction", "in").in("status", ["new", "auto"]);
    return json(res.ok ? { ok: true } : { ok: false, error: res.err }, res.ok ? 200 : 502);
  }

  // تيك توك
  if (u.searchParams.get("src") === "tiktok") {
    const sec = env("TIKTOK_CLIENT_SECRET"); if (!sec) return new Response("not configured", { status: 503 });
    const sig = req.headers.get("TikTok-Signature") || "", parts = Object.fromEntries(sig.split(",").map((x) => x.split("=")));
    if (!parts.t || !parts.s || !safeEq(await hmacHex(sec, parts.t + "." + raw), parts.s)) return new Response("bad signature", { status: 401 });
    let c = body.content; try { if (typeof c === "string") c = JSON.parse(c); } catch { /* */ }
    c = c || body;
    const text = (c.message && (c.message.text || (c.message.content && c.message.content.text))) || c.text || "";
    const conv = c.conversation_id || (c.message && c.message.conversation_id) || "";
    const from = (c.sender && (c.sender.id || c.sender.open_id)) || c.from_user_id || conv;
    if (from) await incoming({ platform: "tiktok", page_id: String(body.user_openid || ""), thread_id: String(conv || from), ext_id: String((c.message && c.message.message_id) || c.message_id || ""), body: String(text), name: (c.sender && c.sender.display_name) || "", meta: { conversation_id: conv } });
    return new Response("ok");
  }

  // Meta (فيسبوك / إنستجرام)
  const sec = env("META_APP_SECRET"); if (!sec) return new Response("not configured", { status: 503 });
  const sig = (req.headers.get("X-Hub-Signature-256") || "").replace(/^sha256=/, "");
  if (!sig || !safeEq(await hmacHex(sec, raw), sig)) return new Response("bad signature", { status: 401 });
  const platform = body.object === "instagram" ? "instagram" : "facebook";
  for (const e of body.entry || []) for (const ev of e.messaging || []) {
    const msg = ev.message; if (!msg || msg.is_echo) continue;
    const text = msg.text || ((msg.attachments || []).length ? "📎 مرفق (" + msg.attachments.map((a: { type: string }) => a.type).join("، ") + ")" : "");
    const id = String(ev.sender && ev.sender.id || ""); if (!id) continue;
    await incoming({ platform, page_id: String(e.id || ""), thread_id: id, ext_id: String(msg.mid || ""), body: text, name: await metaName(platform, id) });
  }
  return new Response("EVENT_RECEIVED");
});
