# Rebuild — Step 2: Architecture Plan

Decisions (confirmed by owner): scope = shop system only (`index.html`, Hydrolek included as a permanent section); Mekanizm only (no multi-tenant `org`); hosted on the shop PC with Docker; starts with an empty database (seed data only). The live system on GitHub Pages + Supabase stays untouched.

## 1. Repository layout

```
rebuild/
  docker-compose.yml          postgres + backend + frontend (+ optional cloudflared tunnel)
  .env.example
  README.md
  shared/                     @mk/shared — Zod schemas + inferred TS types used by both sides
    src/enums.ts  src/schemas/*.ts  src/index.ts
  backend/                    Fastify + Prisma + Zod
    prisma/schema.prisma  prisma/migrations/  prisma/seed.ts
    src/
      app.ts  server.ts  config.ts
      plugins/   prisma.ts auth.ts errors.ts logger.ts rate-limit.ts
      lib/       money.ts digits.ts codes.ts pagination.ts audit.ts
      modules/<resource>/  routes.ts  service.ts  schema.ts   (one folder per resource)
    test/
  frontend/                   Next.js 14 App Router + Tailwind, RTL Arabic
    src/
      app/(auth)/login
      app/(app)/<screen>/page.tsx      one folder per screen
      components/ui/*  components/<feature>/*
      lib/api.ts (typed fetch wrapper)  lib/auth.ts  lib/format.ts
      middleware.ts                    route protection by role
```

## 2. Database schema (Prisma, PostgreSQL)

Conventions: `id` = cuid, money = `Decimal(14,2)`, quantities = `Decimal(14,3)` (meters and pieces), every table has `createdAt`/`updatedAt` (`timestamptz`, UTC), `company` enum `MK | HY` wherever the old system had `co`. Soft delete (`deletedAt`) for business records; hard delete only for drafts.

| Model | Key fields | Relations / constraints |
|---|---|---|
| User | phone (unique), email?, passwordHash, name, role `ADMIN/STAFF`, active | → RefreshToken[], Staff? |
| RefreshToken | tokenHash, expiresAt, revokedAt | → User |
| Setting | key (pk), value Json | store name, invoice design, wa_rules, market prices, theme |
| Product | code (unique, never reused), name, barcode?, unit, sellUnit, unitsPerPack, cost, price, minStock, location, company, grade `A/B/OLD`, supplierName? | → StockMove[], ProductAlias[], KitItem[] |
| CodeRegistry | code (pk), productId? | keeps deleted codes so they are never reused |
| ProductAlias | alias, supplierId? | AI invoice-reader memory |
| Remnant | productId, lengthM, barcode | leftover rod pieces (fadl) |
| Contact | type `CUSTOMER/SUPPLIER/BOTH/CRAFTSMAN/PARTNER`, name, phone(s), balance (derived), terms | → Invoice[], Payment[] |
| Invoice | no (per type+company sequence), type `SALE/PURCHASE`, status `DRAFT/POSTED/VOID`, contactId?, company, subtotal, discount, total, paid, payMode `CASH/CREDIT/WALLET/INSTAPAY`, soldBy, icRefId? (inter-company twin), source `MANUAL/DAYBOOK/SCAN/IMPORT/WA` | → InvoiceItem[], Payment[] |
| InvoiceItem | productId?, name, qty, unit, price, cost, lineTotal | → Invoice, Product |
| Return | invoiceId, kind `RETURN/EXCHANGE`, total | → ReturnItem[] |
| Payment | contactId, invoiceId?, direction `IN/OUT`, amount, method, account, cancelledAt? | |
| StockMove | productId, qty (+/-), reason `SALE/PURCHASE/RETURN/ADJUST/COUNT/GIFT/GRADE/VAN/PREP/SAMPLE`, refType, refId | single source of stock |
| Expense | category, amount, company, note, drawer bool | |
| CashAccount + CashMove | wallet/instapay/drawer accounts, SMS-detected money, partner share | |
| DaybookEntry | day (date), kind `ITEM/PAY/EXPENSE`, productId?, qty, price, contactId?, payMode, committedAt?, postedAt? | posted → Invoice |
| DayClosing | day (unique), expected, counted, diff, by | |
| StockCount + StockCountLine | session-based count | applies StockMove ADJUST |
| Quote + QuoteItem | | convertible to Invoice |
| Kit + KitItem | | |
| Sample | productId, contactId, status `OUT/RETURNED/SOLD/LOST` | |
| Gift | productId, contactId, qty | |
| Staff, Attendance, PunchCode, StaffMove (advance/pay/points) | | → User? |
| Shipment | invoiceId, courier, status, cost | |
| WaOrder, WaPhoto, OutboundMessage (wa_out queue: WHATSAPP / PRINT receipt/label/a4) | status, claimedBy, doneAt | consumed by the local bridge |
| ScanJob | image path, status, result Json | AI invoice reader queue |
| Partner + PartnerMove | Hydrolek partners & Mohamed wallet account | |
| Vehicle + VehicleLog | | |
| FieldOrder | Hydrolek quick / field requests | |
| VanMove, VanClose | van stock & fund are derived from VanMove | |
| WorkOrder | type `SLIDING/RAIL/STEEL/BAMBOO/FORF`, specs Json, craftsmanId?, stage, deposit, price, cost | → Payment[] |
| PrepSheet | prep/cutting sheet linked to WorkOrder | |
| SocialMessage, SmsInbox | inbound channels | |
| AuditLog | userId, action, entity, entityId, before/after Json | written in the same transaction |
| Backup | file path, size, by | `pg_dump` triggered from the admin screen |
| WantedItem | shortages list | |

## 3. API contract (REST, JSON, prefix `/api/v1`)

Error shape on every route: `{ "error": { "code": "VALIDATION_ERROR", "message": "…", "details": [...] } }`. Lists: `?q=&page=&pageSize=&from=&to=&company=` → `{ items, total, page, pageSize }`.

- **auth**: POST /auth/login {phoneOrEmail,password} · POST /auth/refresh · POST /auth/logout · GET /auth/me · POST /auth/change-password
- **users** (admin): GET/POST /users · PATCH/DELETE /users/:id
- **settings**: GET /settings · PUT /settings/:key (admin)
- **products**: CRUD /products · GET /products/lookup?barcode= · POST /products/:id/adjust-stock · POST /products/bulk-price · GET /products/:id/moves · POST /products/:id/split (pack → units) · /products/:id/remnants
- **contacts**: CRUD /contacts · GET /contacts/:id/statement (+ ?format=pdf) · POST /contacts/:id/rename · POST /contacts/:id/zero-account
- **invoices**: GET/POST /invoices · GET/PATCH /invoices/:id · POST /invoices/:id/void · POST /invoices/import · GET /invoices/:id/pdf
- **returns**: GET/POST /returns
- **payments**: GET/POST /payments · POST /payments/:id/cancel
- **expenses / cash**: CRUD /expenses · GET /cash/summary · CRUD /cash/accounts · GET/POST /cash/moves · POST /sms/inbound (device token)
- **daybook**: GET /daybook?day= · POST/PATCH/DELETE /daybook/entries/:id · POST /daybook/:day/post · POST /daybook/entries/:id/set-pay · GET /daybook/:day/summary
- **closings**: GET/POST /closings
- **counts**: CRUD /counts · POST /counts/:id/apply
- **quotes**: CRUD /quotes · POST /quotes/:id/convert
- **kits, samples, gifts, shipments, wanted**: CRUD each (+ /samples/:id/status, /products/:id/grade)
- **reports**: GET /reports/:name (~25 named reports: sales-by-day, profit, top-products, debts, stock-value, reorder, staff, hydrolek…)
- **staff**: CRUD /staff · POST /attendance/punch (QR code) · GET /attendance · POST /staff/:id/advance · POST /staff/:id/pay
- **hydrolek**: /field-orders · /van/moves · POST /van/close-day · /partners (+moves, statement) · /vehicles (+log) · /intercompany/summary
- **work-orders**: CRUD /work-orders · POST /work-orders/:id/stage · POST /work-orders/:id/send (WhatsApp to craftsman) · /prep-sheets
- **whatsapp**: GET/PATCH /wa/orders · GET/PATCH /wa/photos · bridge-only (token): POST /bridge/submit · POST /bridge/photo · POST /bridge/outbox/claim · POST /bridge/outbox/:id/done · GET /bridge/rules
- **print**: POST /print {kind: receipt|label|a4, payload} → OutboundMessage
- **scans**: POST /scans (image upload) · GET /scans/:id · worker processes with Claude / Gemini
- **social**: POST /webhooks/meta · GET/PATCH /social/messages
- **audit / backups / health**: GET /audit · GET/POST /backups · GET /health

## 4. Auth & middleware

- JWT access token (15 min) + rotating refresh token (30 days, hashed in DB) — both in httpOnly, SameSite=Lax cookies; passwords hashed with argon2. Login by phone or email.
- Fastify hooks: `authenticate` (verify JWT) → `requireRole('ADMIN')` per route; bridge/SMS routes use a separate static device token from `.env`.
- Every route: Zod schema for params/query/body (shared with frontend), central error handler mapping Zod/Prisma/domain errors to the error shape, pino request logging, rate limiting on /auth.
- Money-moving writes (invoice save/void, returns, payments, daybook post, stock adjust, van close) run in `prisma.$transaction` with `SERIALIZABLE` isolation and write AuditLog in the same transaction.
- Frontend: `middleware.ts` redirects to /login when there's no session and hides admin-only routes from STAFF; the server still enforces every rule.

## 5. Shared types

`rebuild/shared` exports enums (Role, Company, InvoiceType, PayMode, MoveReason, WorkOrderType…), Zod input schemas (`ProductInput`, `InvoiceInput`, `DaybookEntryInput`…) and response types. Both backend and frontend import from `@mk/shared` (npm workspaces).

## 6. Hosting on the shop PC

`docker compose up -d` runs Postgres 16, the backend (port 4000), and the frontend (port 3000). Phones on the shop Wi-Fi open `http://<pc-ip>:3000`. To use it from outside the shop, there's an optional free Cloudflare Tunnel service in the compose file. The existing WhatsApp/printer bridge switches from polling Supabase to the `/bridge/*` endpoints.

## 7. Build phases (each phase ships complete, end-to-end, as its own commit on `tajroba-rebuild`)

1. Foundation: monorepo, Docker, Prisma schema + migration, seed, auth, users, settings, error handling, layout/RTL/theme, login.
2. Core trade: products & stock, contacts, sales & purchase invoices, returns/exchange, payments, expenses/cash, receipts/A4/labels printing.
3. Daybook, day closing, stock counts, reports center, debts, reorder.
4. Quotes, kits, samples, gifts/grades, shipping, wanted list, staff & attendance.
5. Hydrolek: field orders, van, partners, vehicles, inter-company accounts.
6. Work systems: sliding doors/rails, stainless steel, bamboo, forf + drawings + craftsman WhatsApp.
7. Integrations: WhatsApp bridge + rules, printer bridge, AI invoice/transfer reader, SMS inbox, social inbox, backups, audit screen.
