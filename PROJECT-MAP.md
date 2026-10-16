# خريطة مشروع ميكانيزم (مختصرة — للصقها في Claude Project)

## إيه هو
سيستم إدارة محل (مبيعات/مشتريات/مخزون/حسابات/تقارير/أوردرات ورش) لمحل «ميكانيزم» + قسم «هيدرولك» الدائم. عربي RTL، موبايل أولًا (آيفون Safari + أندرويد Chrome).
- الصاحب: عبده. الرد بمصري مختصر، تعديل موضعي بس (ممنوع إعادة كتابة الملف)، آخر الرد سطرين ملخص.

## الملفات (الريبو: github.com/apdoma773mod-spec/mekanezm، فرع main، GitHub Pages)
- `index.html` (~1.8MB، ملف واحد فيه كل السيستم، ~52 سكريبت) — **ماتقراهوش كله**. ابحث بـ grep عن اسم الشاشة/الدالة.
- `app/index.html` نسخة مطابقة لتطبيق المشتركين (`cp index.html app/index.html` مع كل نشر).
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
بوابة العميل ← كارت النهاردة ← مركز التقارير (`mkReports`) ← شريط الشركة `#mkCoBar` ← هيدرولك `mkHy` (تعامل/شركاء/سيارة/أوردرات ميدانية/هوية) ← المخزون (`openSplit` فك لفة) ← النسخ الاحتياطية. قبلها: أنظمة الشغل v2 (دلف/استانلس/بامبو/مجسم 3D `mount3d`/رسم 2D)، الباركود الذكي، الأيقونات، واتساب.

## الشركتين (هيدرولك داخل ميكانيزم)
- `co` = mk/hy على المنتجات والفواتير والمصروفات والمرتجعات والدفعات. `curCo()` من localStorage `mk_co`. أصناف منفصلة لكل شركة (`prodsCo()`).
- التعامل بينهم: فاتورة بيع + شراء مقابلة بـ `ic`/`ic_ref`. في «المجمّع» بتتشال (`coOk`) وربحها في سطر `icp`.
- هيدرولك قسم دائم: ممنوع فصله أو عمل API له.

## قواعد الكود (مهم جدًا)
- دوال جوه IIFE **مش ظاهرة** للسكريبتات التانية: اتأكد بـ `typeof` (globals: findP, rowCost, money, esc, toast, save, renderAll, openInvoiceModal, codeNote, nextCode…). الطباعة: `window.mkPrintA4`.
- كود المنتج مابيتعادش بعد الحذف (`codeNote`/`codeHi`) وممنوع تكراره.
- ممنوع: خلفيات تقيلة، أنيميشن، كتابة style عند كل scroll. الخلفية = طبقة ثابتة `#mkThBg`.
- UI: أزرار كبيرة، bottom sheet، "/" فاصل في الحقول متعددة القيم، حقول كبيرة للنص الطويل.
- قبل أي commit: `node --check` لكل سكريبت، `cp` لـ app، رفع SW + APP_VER، `git push origin main`.
- تغييرات قاعدة البيانات الكبيرة: نسخة احتياطية الأول، وأي مخاطرة (فقد بيانات) تتقال الأول.
- الاختبار: Playwright chromium على `python3 -m http.server` + mock لـ mkSB/mkT.api. ممنوع `pkill -f`.
- Commit trailers: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` و`Claude-Session: https://claude.ai/code/session_013ZMJ8w8sa5arGXXCCACS8W`.

## متفتح/ناقص
تحقق Safari للشاشات الجديدة، رسم الإطار/المقبض الخارجي، أيقونات أكبر، تحسينات اليومية/الفواتير/المشتريات، قاعدة نصيب الشركاء (حاليًا % من ربح هيدرولك + تمويل + سحب)، تحديث HANDOFF.md على كمبيوتر المحل.
