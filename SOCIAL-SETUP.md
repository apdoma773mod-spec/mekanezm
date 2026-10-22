# ربط فيسبوك وإنستجرام وتيك توك برسايل ميكانيزم (خطوات بسيطة)

السيستم جاهز: الصندوق الموحد في الشريط الجانبي «💬 رسايل الصفحات»، والسيرفر (social-webhook) شغال ومستني المفاتيح بس.
المفاتيح **مابتتكتبش في السيستم ولا تتبعت في شات**. بتتحط في مكان واحد بس:
Supabase ← مشروع mekanezm ← Edge Functions ← Secrets.
لينك المكان ده: https://supabase.com/dashboard/project/tkzfjeizvanfptnqvrmr/functions/secrets

رابط الـ Webhook (هتحتاجه تحت):
`https://tkzfjeizvanfptnqvrmr.supabase.co/functions/v1/social-webhook`

---

## أولًا: فيسبوك ماسنجر + إنستجرام (Meta) — من الكمبيوتر أسهل

1. ادخل https://developers.facebook.com بحساب فيسبوك اللي هو أدمن على صفحة ميكانيزم.
2. دوس **My Apps** ← **Create App** ← اختار **Business** (أو «Other» ثم Business) ← اكتب اسم مثلًا «Mekanizm Inbox» ← Create.
3. جوه الأب: من **Add products** ضيف **Messenger**، وضيف **Instagram** كمان.
4. **مفتاح الأب السري:** من القايمة **App settings ← Basic** ← جنب **App Secret** دوس Show وانسخه.
   - في Supabase Secrets: اعمل Secret اسمه `META_APP_SECRET` والقيمة اللي نسختها.
5. **كلمة التأكيد:** اختار أي كلمة سر من دماغك (مثلًا `mekanizm2026x`).
   - في Supabase Secrets: اعمل Secret اسمه `META_VERIFY_TOKEN` بنفس الكلمة.
6. **مفتاح الصفحة:** في Messenger ← **Messenger API Settings** ← **Generate access tokens** ← اختار صفحة ميكانيزم ← Generate ← انسخ التوكن.
   - في Supabase Secrets: اعمل Secret اسمه `META_PAGE_TOKEN` والقيمة دي.
7. **ربط الـ Webhook:** في نفس الصفحة ← **Configure webhooks**:
   - Callback URL: الرابط اللي فوق.
   - Verify token: نفس الكلمة بتاعة خطوة 5 ← **Verify and save**.
   - بعدها جنب الصفحة دوس **Add subscriptions** وعلّم على `messages`.
8. **إنستجرام:** لازم حساب إنستجرام المحل يكون **Business** ومربوط بصفحة الفيسبوك (من إعدادات إنستجرام ← Account type).
   في Instagram ← Webhooks حط نفس الرابط ونفس الكلمة وعلّم `messages`.
   (لو Meta إدّتك توكن مختلف لإنستجرام، حطه في Secret اسمه `META_IG_TOKEN`. لو مفيش، توكن الصفحة بيكفي.)
9. **تشغيل للكل:** طول ما الأب في وضع Development، الرسايل بتشتغل معاك انت بس (وأي حد ضايفه كـ Tester).
   عشان الزباين: من **App Review** اطلب صلاحيات `pages_messaging` و `instagram_manage_messages`، وبعد الموافقة حوّل الأب لـ **Live**.

## ثانيًا: تيك توك (TikTok for Business)

> رسايل تيك توك متاحة بس لحسابات Business ومحتاجة موافقة من تيك توك. الجزء ده جاهز في السيستم بس **ماتجربش لسه** على حساب حقيقي.

1. ادخل https://business-api.tiktok.com (TikTok API for Business) واعمل حساب Developer بحساب تيك توك المحل (لازم يكون Business Account).
2. اعمل App واطلب صلاحية الرسايل (Business Messaging / Direct Messages).
3. بعد الموافقة هتاخد:
   - App Secret ← Secret في Supabase اسمه `TIKTOK_CLIENT_SECRET`.
   - Access Token ← `TIKTOK_ACCESS_TOKEN`.
   - Business ID ← `TIKTOK_BUSINESS_ID`.
4. في إعدادات الـ Webhook بتاعة الأب حط الرابط ده:
   `https://tkzfjeizvanfptnqvrmr.supabase.co/functions/v1/social-webhook?src=tiktok`

## ثالثًا: التجربة

1. افتح السيستم ← «💬 رسايل الصفحات» ← «🔗 الربط»: المفروض تشوف ✅ جنب اللي اتربط.
2. «💬 الردود التلقائية»: اكتب رد لكل كلمة (نفس كلمات الواتساب) ودوس حفظ.
3. ابعت رسالة لصفحة المحل من حساب تاني فيها كلمة (مثلًا «استانلس») ← المفروض يجيلك الرد التلقائي، والمحادثة تظهر في «الوارد».
4. ابعت رسالة مافيهاش كلمة ← تظهر في «محتاج ردك» وانت ترد من السيستم.

## مهم
- مفيش رد تلقائي من غير كلمة ورد انت كاتبهم بنفسك.
- كل رسالة ورد بيتسجل (مين رد وإمتى).
- إعدادات الواتساب ماتغيرتش خالص.
