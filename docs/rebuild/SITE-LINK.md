# ربط الموقع الجديد بالباك الجديد (طلبات الموقع) — للجلسة اللي شغالة على الموقع

**الباك جاهز (على `tajroba-rebuild`، PR #19):** `POST /api/v1/web/public/orders` {customerName, phone, items:[{code,qty,backorder?}], ship?:{method:pickup|delivery|ship,gov,area,address}}، `/web/public/requests` {name,phone,note,imgs}، `/web/public/custom` {kind: steel|bamboo|delf, name, phone, summary, note, img, spec}، `/web/public/media` {data(base64), ext} → {url}. الرد على كلهم `{id}` (المرجع = أول 8 حروف). عمود `WebOrder.ship` اتضاف (migration 20261101120000_web_order_ship) واتطبّق على قاعدة `mekanizm`.
**لسه ناقص في الموقع (`rebuild/site`، فرع site-rebuild):**
1. `src/lib/api.ts`: flag `NEXT_PUBLIC_NEW_BACKEND==='1'` — `placeOrder` / `placeRequest` / `placeCustomOrder` / `uploadRequestImage` يبعتوا على `/mkapi/web/public/...` بدل Supabase RPC (نفس شكل الرد: `{ok, data: id-string, message}`؛ رفع الصورة base64 لـ `/web/public/media` ويرجّع `url` نسبي `/api/v1/work/files/..`).
2. `next.config.mjs`: `rewrites()` → `/mkapi/:path*` إلى `${BACKEND_URL}/api/v1/:path*` (من غير CORS — الباك مفيهوش CORS).
3. تتبّع الطلب (`track_order`/`track_custom`) والتقييمات والكتالوج (`site_stock`) لسه Supabase — الباك الجديد مفيهوش لهم endpoints عامة.
4. لازم لينك ثابت للباك (الدومين) في `BACKEND_URL`، والـ rate-limit بيتحسب على IP سيرفر الموقع (10 طلبات/دقيقة لكل الزوار) — يتظبط لو الزحمة كبيرة.
**ممنوع تشغيله على الموقع الحقيقي قبل موافقة عبده** (بيغيّر اللي الزباين بتشوفه).
