// ميكانيزم — قراءة فواتير المشتريات في الخلفية (بتشتغل كل دقيقة من غير ما السيستم يكون مفتوح)
// بتتنشر باسم: scan-worker   — "Verify JWT" لازم يكون OFF (الجدولة بتبعت السر بس).
// Secrets مطلوبة في Supabase → Edge Functions → Secrets:
//   WORKER_SECRET   ← سر طويل من اختيارك (نفس اللي في sql/50-scan-cron.sql)
//   GEMINI_API_KEY  ← موجود أصلاً لو parse-invoice شغال
// SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY بييجوا لوحدهم جوه Supabase (مش محتاج تضيفهم).
// الدالة مابتضيفش صفوف جديدة في mk_scans، بس بتحدّث الموجودة.

const URL_ = Deno.env.get("SUPABASE_URL")!;
const SVC = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GKEY = Deno.env.get("GEMINI_API_KEY") || "";
const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") || "gemini-2.5-flash";
const INV_STRONG = Deno.env.get("INVOICE_STRONG_MODEL") || "gemini-2.5-pro";
const MAX_JOBS = 3;
const BUDGET_MS = 90_000;
const STALE_MIN = 4;
const BACK_MIN = 2;

const H = { apikey: SVC, Authorization: "Bearer " + SVC, "Content-Type": "application/json" };
const sb = async (path: string, init: RequestInit = {}) => {
  const r = await fetch(`${URL_}/rest/v1/${path}`, { ...init, headers: { ...H, ...(init.headers || {}) } });
  if (!r.ok) throw new Error(`db ${r.status}: ${await r.text()}`);
  const t = await r.text();
  return t ? JSON.parse(t) : null;
};

const PROMPT = `دي صورة فاتورة (ممكن تكون مطبوعة من سيستم أو من الكمبيوتر أو مكتوبة بخط اليد، عربي أو إنجليزي).
استخرج كل بنود الأصناف بالترتيب باستخدام الأداة record_invoice.
- اكتب اسم كل صنف زي ما هو في الفاتورة بالظبط، من غير ما تترجمه أو تصلحه أو تدمج بنود.
- الأرقام بالإنجليزي (0-9) حتى لو مكتوبة بالعربي.
- متضيفش سطور الإجماليات أو الخصم أو الضريبة أو الشحن كأنها أصناف.
- لو سعر الوحدة مش مكتوب وفيه إجمالي وكمية احسبه. لو الكمية مش واضحة خليها 1.
- لو في حاجة مش مقروءة اكتبها في notes وماتخمنش أرقام.`;


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
  },
  required: ["items"],
};


async function geminiOne(image: string, mt: string, model: string): Promise<{ ok: boolean; status: number; body: any }> {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": GKEY, "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: PROMPT.replace("باستخدام الأداة record_invoice", "كـ JSON") }, { inline_data: { mime_type: mt, data: image } }] }],
      generationConfig: { responseMimeType: "application/json", responseSchema: GSCHEMA, temperature: 0 },
    }),
  });
  const body = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, body };
}

// صفحة واحدة: الموديل السريع الأول، ولو مارجعش أصناف يجرب الأقوى
async function readPage(image: string, mt: string): Promise<any> {
  if (!GKEY) throw new Error("GEMINI_API_KEY مش متضاف");
  const first = await geminiOne(image, mt, GEMINI_MODEL);
  if (!first.ok) throw new Error(first.body?.error?.message || `Gemini ${first.status}`);
  const txt = first.body?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || "").join("") || "";
  let parsed: any = null; try { parsed = JSON.parse(txt); } catch { parsed = null; }
  if (parsed && Array.isArray(parsed.items) && parsed.items.some((x: any) => String(x?.text || "").trim())) return parsed;
  const strong = await geminiOne(image, mt, INV_STRONG);
  if (!strong.ok) throw new Error(strong.body?.error?.message || `Gemini ${strong.status}`);
  const t2 = strong.body?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || "").join("") || "";
  try { return JSON.parse(t2); } catch { throw new Error("ماقدرتش أقرا الفاتورة"); }
}

const TRANSIENT = /high demand|overload|unavailable|503|502|500|429|quota|rate.?limit|try again|temporar|timeout|timed out|fetch|network|deadline|ECONN|abort/i;

async function fetchPage(path: string): Promise<string> {
  const r = await fetch(`${URL_}/storage/v1/object/invoice-scans/${path}`, { headers: { apikey: SVC, Authorization: "Bearer " + SVC } });
  if (!r.ok) throw new Error(`تحميل الصورة ${r.status}`);
  const buf = new Uint8Array(await r.arrayBuffer());
  let bin = ""; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(bin);
}

async function work(job: any) {
  try {
    const pages: string[] = Array.isArray(job.pages) ? job.pages : [];
    const res = await Promise.all(pages.map((p) => fetchPage(p).then((img) => readPage(img, "image/jpeg"))));
    const R: any = { supplier: "", invoice_no: "", date: "", notes: "", items: [] };
    for (const r of res) {
      R.supplier = R.supplier || r.supplier || ""; R.invoice_no = R.invoice_no || r.invoice_no || ""; R.date = R.date || r.date || "";
      if (r.notes) R.notes = (R.notes ? R.notes + " • " : "") + r.notes;
      R.items = R.items.concat(r.items || []);
    }
    if (!R.items.some((x: any) => String(x?.text || "").trim())) {
      await sb(`mk_scans?id=eq.${job.id}`, { method: "PATCH", body: JSON.stringify({ status: "failed", error: "ماقدرتش ألاقي أصناف في الصورة — صوّرها أوضح وقريب", updated_at: new Date().toISOString() }) });
      return "failed";
    }
    await sb(`mk_scans?id=eq.${job.id}`, { method: "PATCH", body: JSON.stringify({ status: "done", result: R, error: "", updated_at: new Date().toISOString() }) });
    return "done";
  } catch (e) {
    const m = String((e as Error).message || e);
    const transient = TRANSIENT.test(m) && (job.attempts || 1) < 12;
    await sb(`mk_scans?id=eq.${job.id}`, { method: "PATCH", body: JSON.stringify({
      status: transient ? "pending" : "failed", error: m,
      next_at: transient ? new Date(Date.now() + BACK_MIN * 60_000).toISOString() : job.next_at,
      updated_at: new Date().toISOString() }) });
    return transient ? "retry" : "failed";
  }
}

// بياخد صف واحد بأمان: الشرط في الـ PATCH بيمنع إن اتنين يقروا نفس الفاتورة
async function claimOne(): Promise<any | null> {
  const stale = new Date(Date.now() - STALE_MIN * 60_000).toISOString();
  const now = new Date().toISOString();
  const rows = await sb(`mk_scans?select=*&or=(and(status.eq.pending,next_at.lte.${now}),and(status.eq.working,updated_at.lt.${stale}))&order=created_at.asc&limit=1`);
  if (!rows || !rows.length) return null;
  const j = rows[0];
  const up = await sb(`mk_scans?id=eq.${j.id}&or=(status.eq.pending,status.eq.working)&select=*`, { method: "PATCH", headers: { Prefer: "return=representation" },
    body: JSON.stringify({ status: "working", attempts: (j.attempts || 0) + 1, updated_at: new Date().toISOString() }) });
  return up && up.length ? up[0] : null;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("POST only", { status: 405 });
  if (!Deno.env.get("WORKER_SECRET") || req.headers.get("x-worker-secret") !== Deno.env.get("WORKER_SECRET")) {
    return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { "Content-Type": "application/json" } });
  }
  const t0 = Date.now(); const out: string[] = [];
  try {
    for (let n = 0; n < MAX_JOBS && Date.now() - t0 < BUDGET_MS; n++) {
      const job = await claimOne();
      if (!job) break;
      out.push(await work(job));
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message || e), out }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
  return new Response(JSON.stringify({ processed: out.length, out }), { headers: { "Content-Type": "application/json" } });
});
