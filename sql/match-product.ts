// «صوّر القطعة يطلعلك الصنف»: بياخد صورة قطعة (مفصلة، مجرى، كالون…) ويقارنها بأصناف المحل ويرجّع أقرب ٣
// بتتنشر على Supabase باسم: match-product   (اقفل «Verify JWT» — التحقق بيتعمل جوه الكود)
// السر المطلوب: GEMINI_API_KEY. الأصناف بتتقري بصلاحية المستخدم نفسه (فكل محل بيشوف أصنافه بس).
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const MODELS = [...new Set([Deno.env.get("GEMINI_MODEL"), "gemini-3.5-flash", "gemini-flash-latest", "gemini-flash-lite-latest"].filter(Boolean))] as string[];

const SCHEMA = {
  type: "OBJECT",
  properties: {
    seen: { type: "STRING" },
    matches: { type: "ARRAY", items: { type: "OBJECT", properties: { code: { type: "STRING" }, why: { type: "STRING" }, score: { type: "NUMBER" } }, required: ["code"] } },
  },
  required: ["seen", "matches"],
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST بس" }, 405);
  const auth = req.headers.get("authorization") || "", apikey = req.headers.get("apikey") || Deno.env.get("SUPABASE_ANON_KEY") || "", url = Deno.env.get("SUPABASE_URL");
  if (!auth.startsWith("Bearer ") || !url) return json({ error: "لازم تكون مسجّل دخول في السيستم" }, 401);
  const u = await fetch(`${url}/auth/v1/user`, { headers: { Authorization: auth, apikey } });
  if (!u.ok) return json({ error: "لازم تكون مسجّل دخول في السيستم" }, 401);
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) return json({ error: "مفتاح Gemini مش متحط في إعدادات السيرفر" }, 500);

  let b: { image?: string; media_type?: string; kind?: string } = {};
  try { b = await req.json(); } catch { return json({ error: "طلب غلط" }, 400); }
  const image = String(b.image || "").replace(/^data:[^,]+,/, "");
  const mt = /^image\/(jpeg|png|webp)$/.test(b.media_type || "") ? b.media_type! : "image/jpeg";
  if (!image || image.length > 7_000_000) return json({ error: "الصورة ناقصة أو كبيرة قوي" }, 400);

  // أصناف المحل (بصلاحية المستخدم) + تفاصيلها لو موجودة
  const H = { Authorization: auth, apikey };
  const pr = await fetch(`${url}/rest/v1/mk_products?select=id,code,name,cat&limit=10000`, { headers: H });
  if (!pr.ok) return json({ error: "مقدرتش أقرا الأصناف" }, 500);
  const prods: { id: string; code: string; name: string; cat: string }[] = await pr.json();
  const info: Record<string, { brand?: string; finish?: string; size?: string; grp?: string }> = {};
  try {
    const ir = await fetch(`${url}/rest/v1/mk_product_info?select=product_id,brand,finish,size,grp&limit=10000`, { headers: H });
    if (ir.ok) for (const x of await ir.json()) info[x.product_id] = x;
  } catch { /* من غير تفاصيل */ }
  const lines = prods.filter((p) => p.code && p.name).map((p) => {
    const i = info[p.id] || {};
    return [p.code, p.name, p.cat, i.size, i.finish, i.brand, i.grp].filter(Boolean).join(" | ");
  });
  if (!lines.length) return json({ seen: "", matches: [] });

  const prompt =
    `دي صورة قطعة ${b.kind || "إكسسوار (مفصلات، مجاري أدراج، كوالين، مقابض، ميكانيزم مطابخ ودريسنج، رجول، بساتم…)"} صورها زبون أو موظف عشان يلاقي زيها في المحل.\n` +
    `١) اكتب في seen وصف قصير بالعامية المصرية للقطعة: نوعها وشكلها ولونها أو تشطيبها ومقاسها التقريبي لو باين.\n` +
    `٢) من قايمة أصناف المحل تحت (كل سطر: الكود | الاسم | القسم | المقاس | التشطيب | الماركة | المجموعة) اختار أقرب ٣ أصناف ممكن تكون هي نفس القطعة أو بديل مناسب ليها، ورتبهم من الأقرب. ` +
    `في why اكتب سبب قصير جداً، وفي score رقم من 0 لـ 100 لمدى التطابق. متخترعش أكواد مش في القايمة. لو مفيش ولا صنف شبهها رجّع matches فاضية.\n\nالأصناف:\n` +
    lines.join("\n");

  let last = "";
  for (const m of MODELS) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {
        method: "POST",
        headers: { "x-goog-api-key": key, "content-type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ inline_data: { mime_type: mt, data: image } }, { text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 4000, responseMimeType: "application/json", responseSchema: SCHEMA },
        }),
        signal: AbortSignal.timeout(45000),
      });
      const j = await r.json().catch(() => ({}));
      if (r.status === 401 || r.status === 403) return json({ error: "مفتاح Gemini مرفوض" }, 502);
      if (!r.ok) { last = `Gemini ${m} ${r.status}`; continue; }
      const txt = (j?.candidates?.[0]?.content?.parts || []).filter((p: { thought?: boolean }) => !p.thought).map((p: { text?: string }) => p.text || "").join("");
      let out: { seen?: string; matches?: { code: string; why?: string; score?: number }[] };
      try { out = JSON.parse(txt); } catch { last = "رد مش مفهوم"; continue; }
      const valid = new Set(prods.map((p) => String(p.code)));
      const matches = (out.matches || []).filter((x) => valid.has(String(x.code))).slice(0, 3);
      return json({ seen: out.seen || "", matches });
    } catch (e) { last = String((e as Error).message || e); }
  }
  return json({ error: "الذكاء الاصطناعي مش متاح دلوقتي، جرّب كمان شوية (" + last + ")" }, 502);
});
