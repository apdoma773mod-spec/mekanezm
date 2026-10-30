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
- Prices: a product's `price` (number or text) shows on the card, on the product page (with the total for the chosen quantity), in the JSON-LD offer, and as an estimated total in the cart. With no price, it still shows «اسأل عن السعر» (all 7 products today).
- «💳 الدفع» in the cart, on the success screen and on `/policy`: cash at the shop or to the courier, or a transfer for shipped orders. The account numbers come from `NEXT_PUBLIC_INSTAPAY` / `NEXT_PUBLIC_WALLET`; they are hidden while empty.
- Reviews per product: `list_reviews(p_product)` / `add_review(…, p_product)`, which the database already supports. They show only after approval (`web_reviews.approved`).
- `/compare?i=a,b[,c]` side-by-side table, filled from the «⚖️ قارن» button (`mk_cmp`, max 3).
- `/guide` + 4 articles (`src/lib/guides.ts`: hinges, drawer slides, dressing room, kitchen). They have Article JSON-LD, are in the sitemap, and are linked from the home page and the footer.
- Customer script errors are sent to `/api/log` (server log `[client-error]`, plus `LOG_WEBHOOK` if set). The error page reports too.
- Pages refresh every 60 s (was 300), so system edits show within a minute even without `/api/revalidate`.
- `npm run test:e2e [-- URL]`: browser smoke test of all pages (`e2e/smoke.mjs`, playwright-core). It never submits anything.
- `docs/site/DEPLOY.md`: host, domain, env, Google Search Console/Business, monitoring.

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
