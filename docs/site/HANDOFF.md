# Public website rebuild — handoff

Branch `site-rebuild` (from `tajroba-rebuild`), worktree `C:\Users\ميكانزم\Documents\mekanezm-site-next`.
New workspace `rebuild/site`: Next.js 15 App Router, TypeScript, zod. Port **3300**.
`rebuild/backend`, `rebuild/frontend`, `rebuild/shared` were not touched (only `site` added to the root workspaces list).

Rule followed: copy the old site's **final** state only (live `main`, commit 4ae6ad96), never replay its history.
The old pages patch themselves with many script blocks; the final behaviour was read from the live page
(headless Chrome: rendered DOM + final function versions) and from the last override in the source.

## What's built
| New URL | Old page | Notes |
|---|---|---|
| `/` | shop.html | header banner + slider + promo ticker, trust chip, WhatsApp catalog, delivery/track buttons, socials, «الأكثر طلباً» carousel, 3 steps, custom-order card, choice assistant, category tiles (same SVG art), «مش لاقي» request, latest products, all products (live search with suggestions, avail filter, sort, fav share, recently viewed, sticky section bar), works, delivery info, why/stats/reviews/FAQ/location, footer |
| `/p/[id]` | shop.html?p= overlay | real page per product (SSG + ISR): gallery with gold frame, arrows/dots/thumbs, zoom, breadcrumbs, stock, trust strip, ask price, delivery info, video, spec table, notify-me, WhatsApp order, call/print, similar, story link, sticky qty + add bar, JSON-LD Product + Breadcrumb |
| `/custom` (`?k=steel|bamboo|delf`) | custom.html | measuring guide, quick sizes, live drawing, smart warnings, hinge suggestion with «اعتمد», review sheet, uploads drawing, `place_custom_order`, saved draft, track link |
| `/story` (`?p=`) | story.html | scroll story, prev/next, share, store link, similar, preload next |
| `/portal?t=` | portal.html | customer account page (invoices, payments, returns, send request with photos/videos) |
| `sitemap.xml`, `robots.txt`, `manifest.webmanifest`, 404 | same files | |

Popups: cart/checkout (pickup / Cairo-Giza delivery / shipping with governorate + address, back-order notes, «ابعت الطلب كله واتساب», success with track button), delivery info, product request with up to 3 photos, order tracking (orders + custom orders, step timeline), review, notify-me, works viewer, image zoom.
Floating: bottom nav (fav filter, cart), WhatsApp button (shrinks on scroll), «كمّل الطلب» bar, back-to-top, scroll progress, toast with undo, offline notice, install-app + iOS hint.
Old links redirect: `shop.html`, `shop.html?p=X` → `/p/X`, `shop.html?track=` → `/?track=`, `p/X.html`, `custom.html`, `story.html`, `portal.html`, `shop3.html`.
Analytics: GA4 + Facebook Pixel (load lazily). Visit counter `bump_visit`.

Not copied on purpose: the old shop.html admin editor (login/edit/save site) — the shop data is edited from the system. `shop3.html` was an old duplicate (redirects to `/`).

## v2 (built for thousands of products)
- Home: products first — category tiles, then one swipeable row per section (12 cards + «عرض الكل»), «الأكثر طلباً», «وصل حديثاً», recently viewed; service blocks after.
- `/c/[id]` category pages (sort, available-only, «عرض المزيد» 24 per step, plain links), `/search` (Arabic-normalized: أ/ا، ة/ه، ى/ي; `?top=1` = featured), `/fav`.
- Fixed top bar (search with server suggestions from `/api/suggest`, recent searches, section chips, cart count).
- The browser never gets the full catalog: cart/favorites/recent keep product snapshots (`Item`) in localStorage (`mk_cart2`, `mk_fav2`, `mk_recent2`); availability is decided on the server.
- Empty sections are hidden everywhere.
- `/api/revalidate?secret=REVALIDATE_SECRET` → refresh site + stock immediately (call it from the system after saving).
- `output: 'standalone'`, `rebuild/site/Dockerfile`, security + cache headers, `public/sw.js` (offline pages, cached photos), loading skeleton, error page.

## v3
Card turns into a − n + stepper after adding; `/quick` order by codes (`/api/items?codes=`); cart shared as a link `/cart?i=ID.Q,…` (button in the cart);
swipeable photo viewer; previous/next product in section; «مفتوح دلوقتي» badge (`OPENING` in config.ts: 10→24, Friday off);
`/contact`, `/policy`; WhatsApp button is a small circle off the home top and mentions the open product/section;
`/api/health` for uptime monitoring; richer HardwareStore JSON-LD, category share images, favicon.

## v4
«تكمّل بيها الشغل» on product pages (`complements()`: other sections of the same room, `ROOMS` in shop.ts); blurred tiny-photo placeholder (`lqip`, `.lq`);
auto keyword chips inside big sections (`topTerms`, needs ≥4 products) + `?q=` inside a section; «عرض المزيد» loads by itself on scroll (`AutoMore`);
`/orders` «طلباتي» (orders saved in `mk_orders` after sending, with track button); cart reminder toast once per visit;
`/quote?i=…&n=` printable quote request (button «عرض سعر / PDF» in the cart); search with no full match shows «نتايج قريبة» (`looseQuery`) + sections;
«جديد» badge on the newest 12 products (only when the catalog has more than 24); «ابعته لصاحبك» WhatsApp share; WhatsApp/phone taps tracked as `contact`; preconnect to the image CDN.

## v5 (ready to go live)
- **No prices on the site, by the owner's decision (competitors).** `price` is left out of the zod schema, so even if the shop data has one, it never reaches a page, the browser or JSON-LD. Everything says «اسأل عن السعر».
- «💳 الدفع» in the cart, on the success screen and on `/policy`: cash at the shop or to the courier, or a transfer for shipped orders. InstaPay 01010741015 and wallet 01119199659 (defaults in config.ts; `NEXT_PUBLIC_INSTAPAY` / `NEXT_PUBLIC_WALLET` override them, and an empty value hides one).
- Reviews per product: `list_reviews(p_product)` / `add_review(…, p_product)`, which the database already supports. They show only after approval (`web_reviews.approved`).
- `/compare?i=a,b[,c]` side-by-side table, filled from the «⚖️ قارن» button (`mk_cmp`, max 3).
- `/guide` + 4 articles (`src/lib/guides.ts`: hinges, drawer slides, dressing room, kitchen). They have Article JSON-LD, are in the sitemap, and are linked from the home page and the footer.
- Customer script errors are sent to `/api/log` (server log `[client-error]`, plus `LOG_WEBHOOK` if set). The error page reports too.
- Pages refresh every 60 s (was 300), so system edits show within a minute even without `/api/revalidate`.
- `npm run test:e2e [-- URL]`: browser smoke test of all pages (`e2e/smoke.mjs`, playwright-core). It never submits anything.
- `docs/site/DEPLOY.md`: host, domain, env, Google Search Console/Business, monitoring.

## v6 (before launch)
- «💰 اسأل عن السعر» on cards, product page and cart («ابعتلي سعر الطلب كله») opens a sheet: name, phone, quantities, note → `place_request` with note «💰 طلب سعر من الموقع …». So every price question leaves a lead in the system, and WhatsApp stays as a second option. The name/phone are remembered on the phone (`mk_me`, `src/lib/me.ts`) and prefill the cart and the forms.
- `/trade` wholesale sign-up (carpenter / shop / contractor / designer, shop name, area, what they buy) → `place_request` «🧰 تسجيل جملة». Linked from a home strip and the footer.
- Product codes stay visible (they are the system's own codes; the owner wants customers to order by them).
- `/about` (shop info from settings, sections, custom work, map/phones, works). The owner's shop photos go in `public/about/` + the `PHOTOS` list in the page. Also `/privacy`, `/terms` (needed for Facebook/Google ads). All of these are in the footer and the sitemap.
- Spec table: any short «key: value» line in a description becomes a row, wherever it is (headings like «اسم المنتج:» and «المميزات:» are skipped). Category pages get spec filter chips (`?f=key|value`) when ≥2 products share a key. `docs/site/PRODUCT-TEXT.md` explains how to write descriptions and has drafts for the 7 products.
- Copy: «دريسنج» everywhere. Search treats دريسينج/دريسنج and ألومنيوم/المنيوم/المونيوم as the same word.
- Checked at 360/375 px: no sideways scroll, no tap target under 32 px (footer links, «عرض الكل», «اسأل عن السعر» were enlarged), no text under 12 px, all images have alt. Slider loads the first photo only, then the rest. Home on slow 3G + 6× CPU through the tunnel: LCP 13.1 s → 10.9 s (the product page is 1.4 s). It will be faster on a real host.
- All old links redirect correctly (shop.html, ?p=, p/X.html, custom/story/portal.html, shop3.html, /products).
- The test order `8bafdf3c` («تجربة الموقع الجديد — تجاهله») is still in `web_orders`; the owner deletes it from the system.

## v7
- New product card: square photo in a rounded frame with an availability dot badge, a heart, and 🔔 (notify me) on the photo; the code chip (#1248) + section; a fixed two-line name; one action row: «اسأل عن السعر» pill + round ➕ (amber when the product is on back-order). After adding, the row turns into the − n + stepper. The description is no longer on the card (it is on the product page). All cards have the same height.
- Wholesale sign-up needs proof: photos of the workshop/shop/current work (up to 3, uploaded like «مش لاقي» photos), or papers (commercial register / tax card / workshop card), or past invoices (`TRADE.minInvoices` in `TRADE.months` months, checked by phone number). Customers must accept the terms (manual review, a review every `TRADE.months` months, prices tied to the registered phone). It arrives as «🧰 طلب حساب جملة — محتاج مراجعة» with the photos. Nothing is granted automatically. The numbers are in `src/lib/config.ts` → `TRADE` (now 5 invoices in 3 months, answer within 1 working day).

## Data
- Reads: `src/lib/catalog.ts` → Supabase `site_content` (id=main) + `rpc/site_stock`, cached 300 s / 60 s (ISR). Browser refreshes stock once on load.
- Writes: `src/lib/api.ts` → same RPCs as the old site (`place_order`, `place_request`, `track_order`, `track_custom`, `list_reviews`, `add_review`, `add_notify_me`, `place_custom_order`, `bump_visit`, `mk_portal_get/send`) and storage buckets `customer-requests`, `portal`.
- To move to the new backend: change only those two files (+ `config.ts`). Types are in `src/lib/schema.ts` (zod).
- Images: `src/lib/image-loader.ts` resizes Supabase photos through Supabase's image endpoint; `/public/pw/*.webp` are the white-background covers, `/public/frame.webp` the gold frame.

## Run
```
cd rebuild && npm install          # in this worktree only
cd site && npx next build && npx next start -p 3300
```
`NEXT_PUBLIC_SITE_URL` (in `rebuild/site/.env.local`, not committed) sets the public address used in canonical/share/sitemap links; it is baked in at build time, so rebuild after changing it.
Other env (optional): `NEXT_PUBLIC_SB_URL`, `NEXT_PUBLIC_SB_KEY`, `NEXT_PUBLIC_GA_ID`, `NEXT_PUBLIC_FB_PIXEL`.

## Checked (2026-10-30, headless Chrome 390×844, also through a cloudflared quick tunnel)
Home renders all 14 sections/7 products, search suggestions, add to cart → toast + bar, cart with shipping choice (27 governorates), delivery and track popups, category filter, product gallery + add bar, old-URL redirects, custom page warnings + hinge suggestion, story scroll, portal bad-token message, 404, sitemap/robots/manifest. No page errors.
Orders/requests were NOT submitted (they would reach the real system).
Slow-4G + 4× CPU, home: old LCP 7.9 s / load 9.3 s / ~1.1 MB → new LCP 4.1 s / load 4.8 s / ~0.7 MB (new measured through the tunnel from the PC, so first paint is slower than a real host would be).

## Next
- Pick hosting (Vercel / the same server as the system) and set `NEXT_PUBLIC_SITE_URL`; point the domain; keep the redirects.
- Send one real test order from the new site and confirm it appears in the system.
- Later: switch `catalog.ts`/`api.ts` to the new backend API.
