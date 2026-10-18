# خريطة مشروع ميكانيزم (مختصرة — للصقها في Claude Project)

## إيه هو
سيستم إدارة محل (مبيعات/مشتريات/مخزون/حسابات/تقارير/أوردرات ورش) لمحل «ميكانيزم» + قسم «هيدرولك» الدائم. عربي RTL، موبايل أولًا (آيفون Safari + أندرويد Chrome).
- الصاحب: عبده. الرد بمصري مختصر، تعديل موضعي بس (ممنوع إعادة كتابة الملف)، آخر الرد سطرين ملخص.

## الملفات (الريبو: github.com/apdoma773mod-spec/mekanezm، فرع main، GitHub Pages)
- `index.html` (~1.8MB، ملف واحد فيه كل السيستم، ~52 سكريبت) — **ماتقراهوش كله**. ابحث بـ grep عن اسم الشاشة/الدالة.
- `app/index.html` **مش متزامن حاليًا** — كان المفروض نسخة مطابقة، بس آخر كذا دفعة (هيدرولك/mk-fixes/بامبو) ما اتلمسش فيه عمدًا لأنه بقى بيتعامل كمنتج منفصل في الاستخدام الفعلي. لو هتراجع الكود افترض إنه أقدم من `index.html` بكتير.
- `sw.js` (CACHE=mk-system-vNN) و`app/sw.js` (mkapp-vNN): ارفع الرقم مع كل نشر. وارفع `APP_VER` في index.html.
- `portal.html` بوابة العميل العامة. `shop.html` موقع المحل. `woodmaster/` مصنع الخشب. `diag.html` + `?diag=1` قياس الأداء.
- `sql/NN-*.sql` تعديلات قاعدة البيانات (آخر ملفات: 47 بوابة، 48 شركة، 49 هيدرولك، `RUN-ALL.sql` = الثلاثة معًا — اتشغلوا خلاص). ملفات `30-tenant-*` و`41/42` خاصة بنسخة المشتركين (Mekanix) وفيها `org` — **قاعدة المحل مفيهاش org**.
- `DESIGN-HYDROLEK.md` قرارات هيدرولك. `PERF-RULES.md` قواعد الأداء. `SESSION-NOTES.md` آخر حالة.

## الباك إند
Supabase مشروع `tkzfjeizvanfptnqvrmr`، مفتاح publishable بس (ممنوع طلب/قبول service_role).
- جداول: mk_products, mk_contacts, mk_invoices, mk_invoice_items, mk_payments, mk_returns, mk_expenses, mk_stock_moves, mk_settings, mk_daybook, mk_shipments, mk_staff(+attendance/moves), mk_gifts, mk_scans, mk_backups, mk_portal(+msgs), mk_partners(+moves), mk_vehicles(+log), mk_field_orders، وغيرها.
- الكتابة المهمة عن طريق RPC: mk_save_invoice / mk_save_return / mk_add_payment / mk_void_invoice / mk_adjust_stock / mk_daybook_* / mk_backup_now. الثلاثة الأولى ملفوفة (`*_core` + wrapper يكتب `co`/`ic`).
- التحميل: `loadAll` (MK_T "tables mode") ← mapProduct/mapPay/mapRet/mapExp؛ الكتابة المنتجات والمصروفات عبر `diffSync`.
- أي ميزة بتعتمد على عمود جديد تتفعّل بفحص وجوده (`window.mkCoOn`) عشان السيستم ما يقعش قبل SQL.

## الشاشات (data-page)
dashboard (+كارت «النهاردة»), products, sales, purchases, returns, contacts, debts, cash, reorder, count, kits, quotes, shipping, daybook, staff, reports (مركز تقارير ~25), waorders, weborders, custTerms, theme, biz, settings.

## وحدات في آخر index.html (بالترتيب)
بوابة العميل ← كارت النهاردة ← مركز التقارير (`mkReports`) ← شريط الشركة `#mkCoBar` ← هيدرولك `mkHy` (تعامل/شركاء/سيارة/أوردرات ميدانية/هوية — قسم كامل خلص بكل التبويبات) ← المخزون (`openSplit` فك لفة) ← النسخ الاحتياطية. قبلها: أنظمة الشغل v2 (IIFE وحدها، سطر ~6143): دلفة/جرار (`viewForm`+`svg`+`slideSvg`)، استانلس (`viewSteel`+`techSvg`/`techRoll`+تقطيع ألواح `pack`)، **بامبو** (`viewBamboo`+`bambooSvg`+`bambooSummary`+`elToImgUrl` لإرسال الرسمة صورة على واتساب الصنايعي)، فرفورجيه، مجسم 3D `mount3d`، الباركود الذكي، الأيقونات (نظام "تصميم ميكانيزم برو" `mkpro`)، واتساب (تصنيف تلقائي لرسايل الاستانلس `isSteel`/كلمات مفتاحية).

## الشركتين (هيدرولك داخل ميكانيزم)
- `co` = mk/hy على المنتجات والفواتير والمصروفات والمرتجعات والدفعات. `curCo()` من localStorage `mk_co`. أصناف منفصلة لكل شركة (`prodsCo()`).
- التعامل بينهم: فاتورة بيع + شراء مقابلة بـ `ic`/`ic_ref`. في «المجمّع» بتتشال (`coOk`) وربحها في سطر `icp`.
- هيدرولك قسم دائم: ممنوع فصله أو عمل API له.

## قواعد الكود (مهم جدًا)
- دوال جوه IIFE **مش ظاهرة** للسكريبتات التانية: اتأكد بـ `typeof` (globals: findP, rowCost, money, esc, toast, save, renderAll, openInvoiceModal, codeNote, nextCode…). الطباعة: `window.mkPrintA4`.
- كود المنتج مابيتعادش بعد الحذف (`codeNote`/`codeHi`) وممنوع تكراره.
- ممنوع: خلفيات تقيلة، أنيميشن، كتابة style عند كل scroll. الخلفية = طبقة ثابتة `#mkThBg`.
- UI: أزرار كبيرة، bottom sheet، "/" فاصل في الحقول متعددة القيم، حقول كبيرة للنص الطويل.
- قبل أي commit: `node --check` لكل سكريبت، رفع `APP_VER` (و`sw.js` CACHE لو الصفحة الرئيسية اتغيّرت)، `git push`. (`cp` لـ `app/` متوقف حاليًا — شوف ملاحظة `app/index.html` فوق).
- تغييرات قاعدة البيانات الكبيرة: نسخة احتياطية الأول، وأي مخاطرة (فقد بيانات) تتقال الأول.
- الاختبار: Playwright chromium على `python3 -m http.server` + mock لـ mkSB/mkT.api. ممنوع `pkill -f`.
- Commit trailers: بتتغيّر حسب الجلسة الحالية (موجودة آخر كل commit في `git log`) — متاخدش رقم الجلسة ده كتابت ليد.

## آخر الإضافات الكبيرة (بترتيب تاريخي تقريبي، الأحدث آخرًا)
- **هيدرولك كامل**: ⚡ أوردر سريع (`fqOpen`/`fqFlush`)، 📦 مطلوب من الميدان، 🚚 العربية (`mk_van_moves`/`mk_van_stock`/`mk_van_fund`/`mk_van_close`)، 🧾 التصفية، ⚖️ حساب الشركتين، كشف حساب الشركاء، 📑 العقود والعرابين، بيانات السيارة وتنبيهاتها. تقارير هيدرولك داخل `REP`. SQL: `53-field-orders-quick.sql`، `54-hydrolek-van.sql` (لازم يتشغّلوا بالترتيب لو عبده لسه ما شغّلهمش).
- **دفعة mk-fixes (APP_VER -70→-79)**: نسخة احتياطية، تقطيع ذكي `plan()`، فرفورجيه `viewForf`، `prepToInvoice`، جلسات جرد، استيراد فواتير شراء، تحسينات طباعة.
- **بامبو (أحدث شغل)**: أوردر مستقل `viewBamboo` داخل نظام الشغل (مش تجهيز قطع زي الاستانلس — بيتعمل بره عند صنايعي وعبده بيستلمه). الحقول: نوع (طبيعي/صناعي)، عرض/ارتفاع/عمق **برّه برّه** (مقاس الشاسيه اللي الدرج يتسقط فيه)، الشفة البارزة، عدد فواصل حر. الرسم `bambooSvg` (باترن نسيج قطري + إطار شبه ضفيرة). إرسال الرسمة كصورة لواتساب الصنايعي مباشرة: `elToImgUrl` (html2canvas → رفع لـ Supabase Storage bucket `site-images` مسار `bamboo/` → لينك عام → `wa_out.imgs`).
- فتحة العجل وشكل المقبض في رسمة الضلفة الجرار (`slideSvg`) والاستانلس (`techSvg`/`techRoll`) كانوا خلصوا من شغل أسبق.

## متفتح/ناقص (من ملف `HANDOFF.md` — ترتيب عبده)
1. رسومات للصنايعي — الاستانلس والبامبو وفتحة العجل خلصوا؛ باقي: رسم 2D واضح للضلفة (فتحة العجل شكل هندسي) لو لسه فيه تحفظات من عبده.
2. مجسّم الاستانلس 3D (`mount3d`) بطيء وتقيل في اللف — يحتاج يتبدّل بأداة أخف.
3. هوية بصرية: أيقونات أكبر للحاجات اللي بتتفتح كتير.
4. بالترتيب: المخزون (بيع بالمتر/مسامير/وحدات متعددة/أماكن)، البامبو القديم (تم)، هيدرولك (تم)، النسخ الاحتياطي (تم)، اليومية، الفواتير، المشتريات، الأجهزة.
- عام: تحقق Safari للشاشات الجديدة، تحديث `HANDOFF.md` على كمبيوتر المحل، `app/index.html` لسه مش متزامن (شوف ملاحظة فوق).
