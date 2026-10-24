# Rebuild — Step 1: Audit & Inventory

Branch: `tajroba-rebuild`. Source of truth audited: `index.html` (11,398 lines), `sql/` (49 files), `supabase/functions/` (8), `whatsapp-bridge/`, plus side apps.

## 1. Applications in the repo

| App | Path | Status |
|---|---|---|
| Shop management system (core) | `index.html` | Live, main product |
| Old copy of the core | `app/index.html` | Out of date, ignore |
| Customer portal | `portal.html` | Live |
| Shop website / catalog | `shop.html`, `story.html`, `custom.html` | Live |
| Woodmaster (wood factory SaaS) | `woodmaster/` | Separate product (`wm_*` tables) |
| Studio (video editing / skills) | `studio/` | Separate tool (`mk_video_jobs`) |
| Mekanix (multi-tenant copy) | `sql/30-tenant-*`, `41`, `42` | Separate system with `org` column |
| WhatsApp + printer bridge | `whatsapp-bridge/` (runs on shop PC) | Live, local Node processes |

## 2. Screens / user flows (core system)

Main nav: dashboard (+ "today" card), products & stock, purchases, sales, returns, contacts (customers / suppliers), cash & expenses, reports center (~25 reports), theme, settings/admin.

Injected screens: web orders, quotes, stock count (sessions), site editor, shipping, daybook (shop journal), debts & reminders, reorder suggestions, WhatsApp orders + WhatsApp photos, staff (attendance QR / punch codes, advances, pay, points), biz analytics, kits, customer terms, samples, Hydrolek section (quick field orders, field requests, van stock / fund / daily close, partner accounts, inter-company accounts, contracts and deposits, vehicle data and alerts), work systems (sliding doors / door rails, stainless steel cutting + 2D/3D drawings, bamboo drawers sent to craftsmen, wrought iron), gifts / second-grade / old stock, theft alerts, market prices, SMS money inbox + partner (Mohamed) wallet account, social inbox (FB/IG/TikTok), backups, audit log, invoice designer, receipt 80mm / A4 / labels / barcodes, camera barcode scanner, AI invoice reader (photo → items) + background scan queue, AI transfer reader, Excel daybook import, prep sheets, zero-account, company switch (mk / hy).

Cross-cutting: two companies (`co` = mk/hy) on products, invoices, payments, expenses, returns; inter-company invoices (`ic`/`ic_ref`); product codes never reused; Arabic/Hindi digits everywhere; offline tolerance; service worker.

## 3. Database (Supabase Postgres)

Tables (52): mk_products, mk_product_costs, mk_item_costs, mk_contacts, mk_invoices, mk_invoice_items, mk_payments, mk_returns, mk_voided, mk_expenses, mk_stock_moves, mk_counts, mk_closings, mk_daybook, mk_settings, mk_log, mk_backups, mk_members, mk_staff, mk_staff_moves, mk_attendance, mk_punch_codes, mk_gifts, mk_samples, mk_quotes, mk_prep_sheets, mk_scans, mk_shipments, mk_portal, mk_portal_msgs, mk_partners, mk_partner_moves, mk_vehicles, mk_vehicle_log, mk_field_orders, mk_van_moves, mk_van_close, mk_rate, mk_social_msgs, mk_video_jobs, mk_vr_secret, mk_orgs, wa_config, wa_orders, wa_out, wa_photos, wm_state, wm_subs, it_orgs, it_members, it_invites, it_events.
Also used but defined outside `sql/`: mk_wanted, mk_product_info, mk_sms_inbox, mk_van_stock, mk_van_fund, web_orders, web_custom_orders, web_requests, site_content, app_state.
Storage buckets: site-images, invoice-scans.

## 4. API surface (today = Supabase REST + RPC, no custom server)

~100 Postgres functions. Grouped:
- Invoices / payments: mk_save_invoice(_core), mk_void_invoice, mk_save_return, mk_add_payment(_rev), mk_cancel_payment, mk_import_invoices, mk_next_no, mk_purge_cancelled, mk_zero_account, mk_rename_contact, mk_contact_for
- Stock: mk_adjust_stock, mk_stock_count, mk_bulk_price, mk_gift, mk_grade_move
- Daybook: mk_daybook_add / update / delete / post / commit / commit_due / deliver / owed / set_pay, mk_db_ded, mk_db_stock, mk_day_summary
- Reports / closing: mk_report_preview, mk_report_tick, mk_daily_report, mk_save_closing, mk_today, mk_ar_date
- Staff: mk_punch, mk_punch_code, mk_staff_advance, mk_staff_pay
- Hydrolek: mk_van_move, mk_van_close_day, mk_van_close_guard, mk_field_before
- Alerts / audit: mk_alert_* (7), mk_log_add, mk_lock, mk_throttle
- Backup: mk_backup_now, mk_backup_all
- Portal: mk_portal_get, mk_portal_send, mk_portal_tok_ok
- Scans: mk_scan_claim, mk_scan_finish, mk_prep_new
- WhatsApp: wa_submit, wa_photo_submit, wa_out_claim, wa_out_done, wa_known_phones, wa_my_secret, wa_rules_get / promote / stat, mk_rl_wa, mk_rl_public
- Auth / roles: mk_me, mk_me_name, mk_role, mk_is_admin, mk_is_member, mk_phone_to_email, mk_org, mk_switch, mk_tables_on, mk_migrate
- Mekanix / Woodmaster / IT: app_*, wm_*, it_*

Edge functions: parse-invoice, scan-worker, social-webhook, video-ai, video-scene, video-skill, vr-worker, skill-worker.

## 5. Roles

`admin` (owner) and `emp` / staff (restricted: no products, returns, contacts, cash, reports...). Login by phone (mk_phone_to_email) or email via Supabase Auth. Customer portal uses a token (no account). Mekanix / IT have their own org roles.

## 6. Third-party integrations

Supabase (Auth, Postgres, Storage, Edge Functions, cron) · Anthropic Claude + Google Gemini (invoice / transfer / product reading, video) · WhatsApp via local whatsapp-web bridge (3 numbers) · ESC/POS printers XP-E200L (receipt) and XP-370B (labels) via local printer bridge · Meta Graph (FB/IG) + TikTok webhooks · Android SMS forwarding (wallet money) · GitHub Pages hosting + GitHub Actions (deploy functions, video workers) · CDN libs: JsBarcode, html2canvas, jsPDF, Three.js.
