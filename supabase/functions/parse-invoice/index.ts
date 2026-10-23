// ميكانيزم — قراءة صورة فاتورة (مطبوعة أو بخط اليد) وإرجاع البنود كـ JSON
// + kind:"transfer" ← قراءة صورة تحويل فلوس (انستاباي/محافظ/بنك) حتى لو ضعيفة
// بتتنشر على Supabase باسم: parse-invoice   (اقفل «Verify JWT» — التحقق بيتعمل جوه الكود تحت)
// الأسرار في Supabase → Edge Functions → Secrets (واحد منهم يكفي):
//   GEMINI_API_KEY     ← مجاني من aistudio.google.com (من غير فيزا)
//   ANTHROPIC_API_KEY  ← مدفوع (Claude)
// لو الاتنين موجودين بيستخدم Gemini.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const MODEL = Deno.env.get("INVOICE_MODEL") || "claude-sonnet-5-5";
const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") || "gemini-2.5-flash";
const MAX_B64 = 7_000_000; // ~5MB صورة
const TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const TOOL = {
  name: "record_invoice",
  description: "سجّل بيانات الفاتورة زي ما هي مكتوبة بالظبط",
  input_schema: {
    type: "object",
    properties: {
      supplier: { type: "string", description: "اسم المورد/المحل صاحب الفاتورة لو ظاهر، وإلا فاضي" },
      invoice_no: { type: "string", description: "رقم الفاتورة لو ظاهر" },
      date: { type: "string", description: "تاريخ الفاتورة بصيغة YYYY-MM-DD لو ظاهر" },
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            text: { type: "string", description: "اسم/وصف الصنف زي ما هو مكتوب في الفاتورة بالظبط (من غير ترجمة أو تعديل)" },
            code: { type: "string", description: "كود/رقم الصنف عند المورد لو موجود" },
            qty: { type: "number", description: "الكمية" },
            unit: { type: "string", description: "الوحدة لو مكتوبة (قطعة، علبة، متر...)" },
            price: { type: "number", description: "سعر الوحدة" },
            total: { type: "number", description: "إجمالي البند" },
          },
          required: ["text"],
        },
      },
      notes: { type: "string", description: "أي ملاحظة عن وضوح الصورة أو بنود مش مقروءة" },
    },
    required: ["items"],
  },
};

const PROMPT = `دي صورة فاتورة (ممكن تكون مطبوعة من سيستم أو من الكمبيوتر أو مكتوبة بخط اليد، عربي أو إنجليزي).
استخرج كل بنود الأصناف بالترتيب باستخدام الأداة record_invoice.
- اكتب اسم كل صنف زي ما هو في الفاتورة بالظبط، من غير ما تترجمه أو تصلحه أو تدمج بنود.
- الأرقام بالإنجليزي (0-9) حتى لو مكتوبة بالعربي.
- متضيفش سطور الإجماليات أو الخصم أو الضريبة أو الشحن كأنها أصناف.
- لو سعر الوحدة مش مكتوب وفيه إجمالي وكمية احسبه. لو الكمية مش واضحة خليها 1.
- لو في حاجة مش مقروءة اكتبها في notes وماتخمنش أرقام.
- مهم جدًا: قبل ما تكتب البنود عِدّ صفوف الأصناف كلها في الجدول واكتب العدد في row_count، وبعدين اكتب كل صف منهم من أول الجدول لآخره — حتى لو الصفوف كتير أو الخط صغير أو بالقلم أو الصورة مايلة. ممنوع تقف بدري أو تكتفي بأول صف.
- grand_total = الإجمالي النهائي المكتوب في الفاتورة (لو موجود)، و discount = الخصم لو موجود. ماتحسبهمش من عندك.`;


const GSCHEMA = {
  type: "OBJECT",
  properties: {
    supplier: { type: "STRING" },
    invoice_no: { type: "STRING" },
    date: { type: "STRING" },
    items: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          text: { type: "STRING" }, code: { type: "STRING" }, qty: { type: "NUMBER" },
          unit: { type: "STRING" }, price: { type: "NUMBER" }, total: { type: "NUMBER" },
        },
        required: ["text"],
      },
    },
    notes: { type: "STRING" },
    row_count: { type: "NUMBER" },
    grand_total: { type: "NUMBER" },
    discount: { type: "NUMBER" },
  },
  required: ["items", "row_count"],
};

// ═════════ الفاتورة: قراءة دقيقة بمراجعة ذاتية
// ١) الموديل الأقوى أولًا (القراءة بتحصل في الخلفية فالدقة أهم من السرعة) — لو فشل/اتأخر: الأسرع.
// ٢) مراجعة: عدد الصفوف اللي الموديل عدّها + الإجمالي المكتوب مقابل مجموع البنود. لو ناقص → قراءة تانية بتنبيه «ناقص بنود» ونختار الأحسن.
// ٣) part = {i, n}: شريحة من صورة طويلة (العميل بيقطّعها لما القراءة الكاملة تبان ناقصة).
const INV_STRONG = Deno.env.get("INVOICE_STRONG_MODEL") || "gemini-2.5-pro";
type Inv = { items?: { text?: string; qty?: number; price?: number; total?: number }[]; row_count?: number; grand_total?: number; discount?: number; [k: string]: unknown };
function invCheck(d: Inv) {
  const it = (d.items || []).filter((x) => x && String(x.text || "").trim());
  const sum = Math.round(it.reduce((a, x) => a + (Number(x.total) > 0 ? Number(x.total) : (Number(x.qty) || 1) * (Number(x.price) || 0)), 0) * 100) / 100;
  const rows = Number(d.row_count) || 0, gt = Number(d.grand_total) || 0, disc = Number(d.discount) || 0;
  const near = (a: number, b: number) => Math.abs(a - b) <= Math.max(1, b * 0.01);
  const rowsOk = !rows || it.length >= rows;
  const totalOk = !(gt > 0) || near(sum, gt) || near(sum - disc, gt) || near(sum + disc, gt);
  return { n: it.length, rows, sum, grand_total: gt, discount: disc, rows_ok: rowsOk, total_ok: totalOk, ok: it.length > 0 && rowsOk && totalOk };
}
const invScore = (c: ReturnType<typeof invCheck>) => c.n * 10 + (c.total_ok ? 25 : 0) + (c.rows_ok ? 15 : 0);
async function geminiInv(key: string, image: string, mt: string, model: string, timeoutMs: number, hint: string): Promise<{ ok: true; d: Inv } | { ok: false; status: number; error: string }> {
  let r: Response;
  try {
    r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "x-goog-api-key": key, "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: PROMPT.replace("باستخدام الأداة record_invoice", "كـ JSON") + (hint ? "\n" + hint : "") }, { inline_data: { mime_type: mt, data: image } }] }],
        generationConfig: { responseMimeType: "application/json", responseSchema: GSCHEMA, temperature: 0, maxOutputTokens: 32768 },
      }),
    });
  } catch (e) {
    const n = (e as Error).name, to = n === "TimeoutError" || n === "AbortError";
    return { ok: false, status: to ? 504 : 502, error: to ? "timeout: جوجل متأخر في الرد" : "Gemini: " + String((e as Error).message || e) };
  }
  const body = await r.json().catch(() => ({}));
  if (!r.ok) return { ok: false, status: 502, error: body?.error?.message || `Gemini ${r.status}` };
  const txt = body?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || "").join("") || "";
  try { return { ok: true, d: JSON.parse(txt) }; } catch { return { ok: false, status: 422, error: body?.candidates?.[0]?.finishReason === "MAX_TOKENS" ? "الفاتورة طويلة قوي — اتقطعت" : "ماقدرتش أقرا الفاتورة" }; }
}
async function viaGemini(key: string, image: string, mt: string, part?: { i: number; n: number }) {
  const t0 = Date.now(), left = () => 118000 - (Date.now() - t0);
  const partHint = part && part.n > 1 ? `دي شريحة رقم ${part.i} من ${part.n} من صورة فاتورة طويلة (الشرايح متداخلة شوية). اكتب كل صفوف الأصناف الظاهرة في الشريحة دي بس — حتى أول وآخر صف لو مقروءين. row_count = عدد الصفوف في الشريحة دي. grand_total بس لو الإجمالي النهائي ظاهر في الشريحة دي.` : "";
  const order = [INV_STRONG, GEMINI_MODEL].filter((m, i, a) => m && a.indexOf(m) === i);
  let best: { d: Inv; c: ReturnType<typeof invCheck>; model: string } | null = null, lastErr = { status: 502, error: "ماقدرتش أقرا الفاتورة" }, passes = 0;
  for (const m of order) {
    if (left() < 15000) break;
    const r = await geminiInv(key, image, mt, m, Math.min(m === INV_STRONG ? 70000 : 45000, left()), partHint);
    passes++;
    if (!r.ok) { lastErr = r; continue; }
    const c = invCheck(r.d);
    if (!best || invScore(c) > invScore(best.c)) best = { d: r.d, c, model: m };
    if (c.ok) break;
    // ناقص: قراءة تانية بالموديل الجاي ومعاها اللي اتلاحظ
    if (left() > 20000) {
      const miss = `\nتنبيه: قراءة سابقة طلّعت ${c.n} بند بس` + (c.rows ? ` مع إن الجدول فيه حوالي ${c.rows} صف` : "") + (c.grand_total > 0 && !c.total_ok ? ` ومجموعهم ${c.sum} والإجمالي المكتوب ${c.grand_total}` : "") + `. ارجع للصورة سطر سطر واكتب كل الصفوف كاملة.`;
      const nx = order.find((x) => x !== m) || m;
      const r2 = await geminiInv(key, image, mt, nx, Math.min(nx === INV_STRONG ? 60000 : 45000, left()), partHint + miss);
      passes++;
      if (r2.ok) { const c2 = invCheck(r2.d); if (invScore(c2) > invScore(best.c)) best = { d: r2.d, c: c2, model: nx }; }
      break;
    }
  }
  if (!best) return json({ error: lastErr.error }, lastErr.status);
  return json({ ...best.d, _check: { ...best.c, model: best.model, passes } });
}

// ═════════ قراءة صورة تحويل فلوس (انستاباي / محافظ / بنك) — kind: "transfer"
// بتشتغل حتى لو الصورة ضعيفة أو متصورة من شاشة موبايل تاني: قراءة أولى سريعة، ولو الثقة قليلة قراءة تانية بموديل أقوى.
const TF_FIELDS = {
  is_transfer: "هل الصورة دي إيصال/سكرين تحويل فلوس فعلاً؟",
  confidence: "ثقتك في قراءة المبلغ من 0 لـ 1",
  method: "instapay | vodafone_cash | etisalat_cash | orange_cash | we_pay | bank | fawry | other",
  status: "success | failed | pending | unknown",
  amount: "المبلغ المحوّل الأساسي (رقم بس، من غير رسوم)",
  amount_text: "المبلغ زي ما هو مكتوب في الصورة بالظبط",
  fees: "رسوم التحويل لو ظاهرة",
  currency: "EGP عادةً",
  date: "تاريخ العملية YYYY-MM-DD",
  time: "وقت العملية HH:MM (24 ساعة)",
  sender_name: "اسم المحوِّل",
  sender_account: "رقم موبايل/حساب/عنوان دفع المحوِّل زي ما ظاهر (ممكن يكون متنجم ***)",
  receiver_name: "اسم المستلم",
  receiver_account: "رقم موبايل/حساب/عنوان دفع المستلم زي ما ظاهر",
  reference: "رقم العملية / المرجع / Transaction ID",
  note: "أي رسالة أو ملاحظة مكتوبة مع التحويل",
  quality: "good | blurry | photo_of_screen | cropped | dark",
  issues: "أي حاجة مش مقروءة أو مشكوك فيها",
};
const TF_SCHEMA = {
  type: "OBJECT",
  properties: Object.fromEntries(Object.keys(TF_FIELDS).map((k) => [k, { type: ["is_transfer"].includes(k) ? "BOOLEAN" : ["confidence", "amount", "fees"].includes(k) ? "NUMBER" : "STRING" }])),
  required: ["is_transfer", "confidence", "amount"],
};
const TF_TOOL = {
  name: "record_transfer",
  description: "سجّل بيانات التحويل زي ما ظاهرة في الصورة",
  input_schema: {
    type: "object",
    properties: Object.fromEntries(Object.entries(TF_FIELDS).map(([k, d]) => [k, { type: k === "is_transfer" ? "boolean" : ["confidence", "amount", "fees"].includes(k) ? "number" : "string", description: d }])),
    required: ["is_transfer", "confidence", "amount"],
  },
};
const TF_PROMPT = `دي صورة جاية على واتساب محل في مصر. غالبًا سكرين أو صورة إيصال تحويل فلوس (InstaPay، فودافون كاش، اتصالات كاش، أورنج كاش، وي باي، تحويل بنكي، فوري) — وممكن تكون صورة عادية مش تحويل خالص.
الصورة ممكن تكون ضعيفة: مهزوزة، أو متصورة من شاشة موبايل تاني بكاميرا (فيها انعكاس أو خطوط)، أو مقصوصة، أو غامقة. اقراها بعناية.
القواعد:
- لو مش تحويل فلوس: is_transfer=false و amount=0.
- amount = المبلغ المحوّل نفسه، مش الرسوم ومش الرصيد المتبقي ومش "إجمالي مع الرسوم". لو فيه "المبلغ" و"الإجمالي" خد المبلغ.
- الأرقام بالإنجليزي. انتبه للفاصلة: 1,500.00 = 1500. وفي الأرقام العربي "٫" = علامة عشرية.
- اكتب amount_text زي ما هو مكتوب بالظبط عشان نراجع.
- ماتخمّنش: لو المبلغ مش واضح قلّل confidence واكتب السبب في issues.
- confidence عالية (0.9+) بس لو المبلغ واضح تمامًا ومفيش شك.
- status=failed لو مكتوب فشلت/مرفوضة/failed، pending لو قيد التنفيذ.`;

const TF_MODELS = [...new Set([Deno.env.get("TRANSFER_MODEL"), Deno.env.get("GEMINI_MODEL"), "gemini-flash-latest", "gemini-2.5-flash", "gemini-flash-lite-latest"].filter(Boolean))] as string[];
const TF_STRONG = [...new Set([Deno.env.get("TRANSFER_STRONG_MODEL"), "gemini-pro-latest", "gemini-2.5-pro"].filter(Boolean))] as string[];

async function tfGemini(key: string, models: string[], image: string, mt: string, hint = "") {
  let last = "";
  for (const m of models) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": key, "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: TF_PROMPT + (hint ? "\n" + hint : "") + "\nرجّع JSON بس." }, { inline_data: { mime_type: mt, data: image } }] }],
        generationConfig: { responseMimeType: "application/json", responseSchema: TF_SCHEMA, temperature: 0 },
      }),
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) { last = body?.error?.message || `Gemini ${r.status}`; if ([400, 404, 429, 500, 503].includes(r.status)) continue; break; }
    const txt = body?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || "").join("") || "";
    try { const o = JSON.parse(txt); o._model = m; return o; } catch { last = "رد مش مفهوم"; }
  }
  throw new Error(last || "ماقدرتش أقرا الصورة");
}
async function tfClaude(key: string, image: string, mt: string) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: MODEL, max_tokens: 1500, tools: [TF_TOOL], tool_choice: { type: "tool", name: "record_transfer" },
      messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: mt, data: image } }, { type: "text", text: TF_PROMPT }] }],
    }),
  });
  const body = await r.json();
  if (!r.ok) throw new Error(body?.error?.message || `Anthropic ${r.status}`);
  const tu = (body.content || []).find((c: { type: string }) => c.type === "tool_use");
  if (!tu) throw new Error("ماقدرتش أقرا الصورة");
  return { ...tu.input, _model: MODEL };
}
const weak = (o: Record<string, unknown> | null) => !o || (o.is_transfer !== false && (!(Number(o.amount) > 0) || Number(o.confidence || 0) < 0.8));

async function readTransfer(gkey: string | undefined, akey: string | undefined, image: string, mt: string) {
  let a: Record<string, unknown> | null = null, err = "";
  if (gkey) { try { a = await tfGemini(gkey, TF_MODELS, image, mt); } catch (e) { err = String((e as Error).message); } }
  else if (akey) { try { a = await tfClaude(akey, image, mt); } catch (e) { err = String((e as Error).message); } }
  if (!weak(a)) return { ...a, passes: 1 };
  // قراءة تانية بموديل أقوى (الصورة ضعيفة أو الثقة قليلة)
  let b: Record<string, unknown> | null = null;
  try {
    if (gkey) b = await tfGemini(gkey, TF_STRONG, image, mt, "دي قراءة تانية لأن الأولى مكانتش واثقة. ركّز على المبلغ ورقم العملية.");
    else if (akey && !a) b = await tfClaude(akey, image, mt);
  } catch (_) { /* الموديل الأقوى مش متاح: نكمل بالأولى */ }
  if (!b && akey && gkey) { try { b = await tfClaude(akey, image, mt); } catch (_) {} }
  if (!a && !b) throw new Error(err || "ماقدرتش أقرا الصورة");
  if (!a) return { ...b, passes: 2 };
  if (!b) return { ...a, passes: 1 };
  const agree = Math.abs(Number(a.amount || 0) - Number(b.amount || 0)) < 0.01;
  const best = Number(b.confidence || 0) >= Number(a.confidence || 0) ? b : a;
  return { ...best, passes: 2, agree, alt_amount: agree ? undefined : (best === b ? a.amount : b.amount), confidence: agree ? Math.max(Number(a.confidence || 0), Number(b.confidence || 0), 0.85) : Math.min(Number(best.confidence || 0), 0.6) };
}

async function authed(req: Request): Promise<boolean> {
  const auth = req.headers.get("authorization") || "";
  const apikey = req.headers.get("apikey") || Deno.env.get("SUPABASE_ANON_KEY") || "";
  const url = Deno.env.get("SUPABASE_URL");
  if (!auth.startsWith("Bearer ") || !url) return false;
  const r = await fetch(`${url}/auth/v1/user`, { headers: { Authorization: auth, apikey } });
  if (!r.ok) return false;
  const u = await r.json();
  return !!(u && u.id); // لازم يوزر مسجّل دخول (مش مفتاح الموقع العام)
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  try {
    if (!(await authed(req))) return json({ error: "لازم تكون مسجّل دخول في السيستم" }, 401);
    const gkey = Deno.env.get("GEMINI_API_KEY");
    const key = Deno.env.get("ANTHROPIC_API_KEY");
    if (!gkey && !key) return json({ error: "ضيف GEMINI_API_KEY (مجاني) أو ANTHROPIC_API_KEY في Secrets" }, 500);

    const { image, media_type, kind, part } = await req.json();
    if (typeof image !== "string" || !image) return json({ error: "مفيش صورة" }, 400);
    if (image.length > MAX_B64) return json({ error: "الصورة كبيرة — صوّرها تاني بحجم أصغر" }, 413);
    const mt = TYPES.includes(media_type) ? media_type : "image/jpeg";
    if (kind === "transfer") {
      try { return json(await readTransfer(gkey || undefined, key || undefined, image.replace(/^data:[^,]+,/, ""), mt)); }
      catch (e) { return json({ error: String((e as Error).message || e) }, 502); }
    }
    if (gkey) return await viaGemini(gkey, image, mt, part && Number(part.n) > 1 ? { i: Number(part.i) || 1, n: Number(part.n) } : undefined);

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key!, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4096,
        tools: [TOOL],
        tool_choice: { type: "tool", name: "record_invoice" },
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mt, data: image } },
            { type: "text", text: PROMPT },
          ],
        }],
      }),
    });
    const body = await r.json();
    if (!r.ok) return json({ error: body?.error?.message || `Anthropic ${r.status}` }, 502);
    const tu = (body.content || []).find((c: { type: string }) => c.type === "tool_use");
    if (!tu) return json({ error: "ماقدرتش أقرا الفاتورة" }, 422);
    return json(tu.input);
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
