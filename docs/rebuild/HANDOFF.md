# Rebuild handoff (read this first)

Branch: `tajroba-rebuild`. Code: `rebuild/` (npm workspaces: `shared`, `backend`, `frontend`). Plan: `docs/rebuild/02-architecture.md`.

## The owner (عبده)
- Egyptian Arabic, weak with computers and English, usually on his iPhone away from the PC. Short replies, no jargon.
- **Hard requirement: the new system must be an exact copy of the old one** (`index.html`): same screens, names, order, fields, wording, colors, flows and permissions, but built properly. Before building any screen, read how the old one does it (grep `index.html`, never read it whole; skip the `SEED` and `MK_LOGO` lines).
- He approved all phases up front and doesn't want to be asked for approvals. Never merge to `main` and never touch the live system (`index.html`, Supabase). Commit and push to `tajroba-rebuild` after each chunk.

## Done
- Phase 1: auth (JWT cookie + rotating refresh), users and roles (ADMIN/STAFF), first-run setup screen (the owner created his own admin account), settings (store + full old theme: colors, font, logo, background, invoice colors), audit log.
- Phase 2: products (P0001 codes never reused, stock moves, adjust, stock filter all/low/out), contacts (opening balance, statement, «💯 صفّر الحساب»), sale/purchase invoices (MK-/SH- numbering, edit and void reverse stock and balance, purchase can't be voided after its goods sold, void keeps paid money as customer credit), payments (cancel), returns (cash or against the account), expenses, cash drawer (moves, balance, overview), dashboard (old stats + «النهاردة»).
- Frontend restyled with the old CSS (no Tailwind): header, right sidebar groups, mobile bottom bar, gold + button, the old modals (quick, product, transaction, invoice view, return, contact, contact file, payment, expense), A4 invoice and 80mm receipt printing (Code128 barcode), statement print, WhatsApp link.
- Phase 3: daybook «يومية المحل» (`/daybook`, stock leaves at once instead of after 5 minutes; «صفّي» makes one invoice per customer with the cash/InstaPay/transfer split; «باقي له» stays in stock until «✔ سلّمت»), «🔒 تقفيل اليومية» modal (dashboard button, history for admins, WhatsApp to `store.ownerPhone`), «🧮 الجرد» (`/count`, draft kept in localStorage, barcode field adds one piece per scan), reports center (`/reports`: 23 of the old mkReports — the Hydrolek/company ones and «المخزون بمكان التخزين» wait for phases 5 and later — plus the old periods table, print/Excel/WhatsApp), «💰 الديون والتذكير» (`/debts`, reminders and template kept in Setting keys `debt_reminders`/`debt_template`), «📦 اقتراحات الطلب» (`/reorder`), dashboard red/orange banners and «📊 رسومات». Backend: modules `daybook`, `closing`, `counts`, `reports`, `insights`.
- Phase 4: «📝 عروض الأسعار» (`/quotes`, same window as the sale invoice, QT- numbers, convert to a sale), «🚚 الشحن والتوصيل» (`/shipments` API, `/shipping` screen, SP- numbers, A4 label, steps to «اتحاسبنا» with optional payment + fee expense, button in the sale invoice window), «🎁 هدية» / «⚠️ درجة تانية» / «🔁 بدائل» buttons in the product window and «🎁 الهدايا» on the products screen (API `/stock-extras`), «👷 العمالة والمرتبات» / «حضوري» (`/staff`: file, month salary calc, advances and pay go into expenses, manual attendance, rotating QR screen; the phone opens `/staff#punch=<code>` and `PunchCatcher` in the shell records it), «⭐ نقاط العمال», «🧩 الأطقم» (`/kits`, K0001 + barcode 29…, selling makes a normal sale invoice), «🧪 العينات» (`/samples`, switch on/off, sold = zero-price invoice, lost = stock loss), «🔎 مطلوب ومش عندنا» (window from the products screen). Not done from the old phase-4 area: «💰 بضاعة قديمة» bulk entry, reservations, and scanning a kit barcode inside the sale window.
- Phase 5: «🏢 الشركات» (`/hy`, API `/api/v1/hy/*`, module `hydrolek`): ⚡ أوردر سريع (server splits each line into sold-from-van now + requested from Mekanizm; new items go to «مطلوب ومش عندنا»), 📦 مطلوب من الميدان (line steps, «لازم يتشترى», invoice of delivered lines with an inter-company transfer at cost), 🚚 العربية (VanStock per funder, load from Mekanizm = transfer, van minimum), 🧾 التصفية (close per day/van, shortages need a reason and adjust stock), 🔁 التعامل + ⚖️ حساب الشركتين (sale + purchase in one transaction, `Invoice.ic/icRef`, settle both sides), 📑 العقود, 📲 الواتساب (messages queue in `OutboundMessage` for the Phase 7 bridge), 🤝 الشركاء + profit rules, 🚗 السيارة (each cost = Hydrolek expense), 🎨 الهوية. Company switch «🏬 ميكانيزم / 🔧 هيدرولك» on the dashboard (localStorage `mk_co`) sets the company of new invoices/products/expenses and filters the products and invoice lists. Not copied: the offline send queue of quick orders (they need the network now) and the old free-text «ord» orders tab (it wasn't in the old tab list).
- 67 backend integration tests pass (`TEST_DATABASE_URL=postgresql://mk:mk_dev_pw@localhost:54329/mekanizm_test?schema=public npx vitest run` in `rebuild/backend`).

## How to run for testing (no Docker or Postgres installed on this PC)
- Test Postgres: `C:\mk-pgtest\start.mjs` (embedded-postgres, port 54329, UTF8). Start it with `$env:TEMP="C:\mk-pgtest\tmp"; cd C:\mk-pgtest; node start.mjs` in the background. It must stay on an ASCII path because the Arabic Windows username breaks Postgres.
- Backend: `npm run dev -w backend` (from `rebuild/`, reads `backend/.env`). Stop it before `prisma generate`/`migrate dev`, or the Prisma engine DLL is locked (EPERM).
- Frontend: `npm run build -w frontend`, then `npx next start -p 3100 -H 0.0.0.0` in `rebuild/frontend`. Port 3000 belongs to another app on this PC, so don't use it.
- Phone access: `C:\mk-pgtest\cloudflared.exe tunnel --no-autoupdate --url http://localhost:3100` (logs to `C:\mk-pgtest\tunnel.log`; the trycloudflare link changes every restart, so send him the new one).
- The dev database holds the owner's real account (he set the password himself). Never wipe the `User` table again.

## Next (in this order, each as a commit on the branch)
1. Phase 3 is done (not yet clicked through in the browser with a real login; tests and the build pass).
2. Phase 4 is done (same note: tests and build pass, not clicked through with a real login).
3. Phase 5 is done (tests and build pass, not clicked through with a real login).
4. Phase 6: work systems (sliding doors/rails, stainless steel, bamboo, forf + drawings).
5. Phase 7: WhatsApp and printer bridge endpoints, AI invoice reader, SMS inbox, social inbox, backups, import from file.

The owner said (2026-10-25): do the phases back to back without sending a summary or link after each one; report once at the end.

Gotchas: after adding a value to a Prisma enum (e.g. `AuditAction`), add it to `shared/src/enums.ts` too, run `npx prisma migrate dev --name …` in `backend` (backend stopped), then `npm run build -w shared`. When copying old CSS into `globals.css`, don't copy `<style>`/`</style>` lines (the build fails with "Unexpected '/'"), and write files without a BOM.

Before each screen, grep the old one in `index.html` and copy its layout and wording. After each phase: typecheck all three packages, run the tests, build the frontend, restart the servers, check through the tunnel, commit and push, then send him a 2-line Arabic summary plus the link.
