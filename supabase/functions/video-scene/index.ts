// video-scene — رسومات متحركة مخصوصة لكل جملة في «مونتاج ذكي»: بياخد الجمل اللي محتاجة شرح (مقبض حرف L تحت الرخامة، دراع بيتكسر…)
// ويرجّع لكل واحدة رسمة بسيطة (أشكال: rect/circle/line/path/text/arrow) مع حركتها (keyframes من 0 لـ 1). الرسم نفسه بيحصل في smart.js.
// الدخول: توكن مستخدم ميكانيزم أو سر العامل (x-vr-secret) — نفس video-ai. المفتاح GEMINI_API_KEY.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-vr-secret", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const MODELS = [Deno.env.get("SCENE_MODEL"), "gemini-2.5-flash", "gemini-flash-latest", "gemini-3-flash-preview", "gemini-2.5-flash-lite"].filter((m, i, a) => m && a.indexOf(m) === i) as string[];

const KF = { type: "OBJECT", properties: { t: { type: "NUMBER" }, dx: { type: "NUMBER" }, dy: { type: "NUMBER" }, rot: { type: "NUMBER" }, s: { type: "NUMBER" }, o: { type: "NUMBER" } }, required: ["t"] };
const SHAPE = { type: "OBJECT", properties: {
  k: { type: "STRING" }, x: { type: "NUMBER" }, y: { type: "NUMBER" }, w: { type: "NUMBER" }, h: { type: "NUMBER" }, r: { type: "NUMBER" }, x2: { type: "NUMBER" }, y2: { type: "NUMBER" },
  d: { type: "STRING" }, txt: { type: "STRING" }, fill: { type: "STRING" }, stroke: { type: "STRING" }, sw: { type: "NUMBER" }, rx: { type: "NUMBER" }, ox: { type: "NUMBER" }, oy: { type: "NUMBER" },
  kf: { type: "ARRAY", items: KF },
}, required: ["k"] };
const SCHEMA = { type: "OBJECT", properties: { scenes: { type: "ARRAY", items: { type: "OBJECT", properties: { i: { type: "INTEGER" }, shapes: { type: "ARRAY", items: SHAPE } }, required: ["i", "shapes"] } } }, required: ["scenes"] };

const PROMPT = (items: { i: number; label: string; ctx: string; scene: string; action: string }[]) => `You are a motion-graphics illustrator for "Mekanizm", an Egyptian shop selling kitchen & wardrobe hardware (handles, aluminium handle profiles, hinges, drawer slides, gas lift arms, locks, corner mechanisms, wardrobe lifts, aluminium profiles).
For EACH item below, design a small flat-vector EXPLAINER ANIMATION that shows exactly what the Egyptian-Arabic sentence (ctx) is explaining — the specific product shape AND the specific point (how it is installed, where it goes, how it opens, what breaks, the difference between two types…). Every item must look different and match its own sentence.

Canvas: 400 x 260 (x to the right, y down), light background already drawn. Keep everything inside 12..388 x 12..248.
Style: clean technical side or front view, like an instruction manual. Flat colors only from this palette:
wood/doors #C99A5B, dark wood #8E6534, cabinet body #EFE8DA, countertop/marble #D9D4CC, aluminium #9DA7B1, dark metal #5E6873, black profile #2B2B2B, outlines #2E2A26, good #2E9E52, bad #E53935, highlight #F6B800, hand/skin #E0AC7E.
Shapes (field k): "rect" (x,y,w,h, rx optional), "circle" (x,y = center, r), "line" (x,y → x2,y2), "arrow" (x,y → x2,y2, arrow head at x2,y2), "path" (d = SVG path data in canvas coordinates, e.g. "M10 10 L60 10 L60 40 Z"), "text" (x,y = center, txt, h = font size 14..22).
Styling: fill, stroke, sw (stroke width). Draw back-to-front (first shape is behind).
Animation: the clip lasts about 4 seconds; kf = keyframes with t from 0 to 1. Each keyframe can set dx, dy (offset in px), rot (degrees, around ox,oy), s (scale around ox,oy), o (opacity 0..1). Values not given keep the previous keyframe value (start: dx=0, dy=0, rot=0, s=1, o=1). Set ox,oy on the shape when it rotates/scales (e.g. hinge point).
Use motion to EXPLAIN: parts sliding or snapping into their place, an arrow or a hand pulling the handle, a door/drawer opening, screws appearing, a weak part cracking (bad ✗) versus the good one working (good ✓), a highlight pulse on the important part. Make it lively: 3–6 moving shapes, things appear in sequence (o from 0 to 1 at different t).
Product hints: "built-in / بلت إن / gola" handle = aluminium profile set into the top edge of the door forming a finger groove (no protruding handle); "حرف L" profile = L-shaped aluminium profile fixed under the countertop above the door/drawer so fingers pull the door edge; "حرف U" / "حرف C" profile = U/C channel fixed horizontally between two drawer fronts; traditional handle = bar handle on the door fixed with two screws; "عود" = a long profile bar; gas arm "دراع باكم/قلاب" = piston arm holding an upward-opening door; drawer slide "مجرى" = telescopic rail under the drawer.
Text: at most 2 short Arabic labels per item (max 3 words each), never on top of drawings. 8–28 shapes per item.
Return scenes with the same i as the item.

Items:
${items.map((x) => `- i=${x.i} | label: ${x.label} | ctx: ${x.ctx}${x.scene ? " | hint scene: " + x.scene : ""}${x.action ? " | action: " + x.action : ""}`).join("\n")}`;

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
    const body = await req.json().catch(() => ({}));
    const items = (Array.isArray(body.items) ? body.items : []).slice(0, 16).map((x: Record<string, unknown>, i: number) => ({
      i: Number.isInteger(x.i) ? x.i as number : i, label: String(x.label || "").slice(0, 120), ctx: String(x.ctx || "").slice(0, 400), scene: String(x.scene || "").slice(0, 30), action: String(x.action || "").slice(0, 20),
    }));
    if (!items.length) return json({ scenes: [] });
    const t0 = Date.now();
    const errs: string[] = [];
    for (const m of MODELS) {
      const left = 145000 - (Date.now() - t0);
      if (left < 15000) break;
      let r: Response;
      try {
        r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {
          method: "POST", signal: AbortSignal.timeout(Math.min(75000, left)),
          headers: { "x-goog-api-key": gkey, "content-type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: PROMPT(items) }] }], generationConfig: { responseMimeType: "application/json", responseSchema: SCHEMA, temperature: 0.5, maxOutputTokens: 24000, thinkingConfig: { thinkingBudget: 512 } } }),
        });
      } catch (e) { errs.push(m + ": " + ((e as Error).name === "TimeoutError" ? "timeout" : String((e as Error).message || e))); continue; }
      const b = await r.json().catch(() => ({}));
      if (!r.ok) { errs.push(m + ": " + String(b?.error?.message || r.status).slice(0, 160)); continue; }
      const txt = b?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || "").join("") || "";
      try { const d = JSON.parse(txt); return json({ scenes: Array.isArray(d.scenes) ? d.scenes : [], _model: m }); } catch { errs.push(m + ": الرد مش مفهوم (" + txt.length + ")"); }
    }
    return json({ error: errs.join(" | ") || "ماقدرتش أرسم" }, 502);
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
