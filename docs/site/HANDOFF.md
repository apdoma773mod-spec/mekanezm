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

## v8
- Wide product card: one per row on phones, 2 from 560 px, auto-fill from 900 px. Big 4:3 photo with only the heart on it. Under it: code chip, section, «🎬 فيديو» / «جديد», a two-line name, an availability line with «🔔 نبّهني», and two labelled buttons. Rows on the home page show cards at 86% width.
- `/kits` + `/kits/kitchen`, `/kits/dressing` (`src/lib/kits.ts`): the customer gives counts (doors, door height, drawers, corner, pantry, sliding, safe, shoes). Each slot picks the best matching product (available first) and computes the quantity (hinges per door via `hingesFor`). «ضيف الطقم للطلب» adds the matched products. «ابعتلي سعر الطقم كله» opens the price sheet with the kit details and the unmatched slots as `extra`.
- `/tools` calculators: hinges per door (+1 for heavy or wide doors), slide length from depth, drawer width for ball-bearing slides, sliding-wardrobe track and door count, magic-corner fit (90 cm width / 50 cm depth / 54 cm height / 45 cm door, from the Hazard product text).
- Brands (`src/lib/brands.ts`): detected from product name/description. `/brand/[slug]` exists when a brand has products (now هازرد، ستار اكس، هب). The main brands the owner listed (ويل ماكس، بلوم، جراس، هيتتش, `carried`) show on `/brands` as «اسأل عليها» until their products are added. The product page links its brand, and the JSON-LD brand uses it.
- `/works` (`src/lib/works.ts`): the system's «🏗️ أعمالنا» with swipeable photos. Product codes written in a work's description link those products (a line «المنتجات: 1248, P0339» is hidden from customers). The product page shows «🏗️ اتركّب في شغلنا».
- Installation: guides `install-hinge`, `install-slides`. The product page shows «🔧 إزاي يتركّب؟» from a spec line «دليل التركيب: URL», else the general guide for hinges and slides.
- «🚚 يوصلك إمتى؟» on the product page (`ETA` in config.ts: order cutoff 4 PM, Cairo/Giza 1–2 working days, other governorates 2–4, Friday skipped). **These are starting numbers; the owner must confirm them.**
- «📣 اعرف الجديد أول بأول» on the home page: WhatsApp subscribe → `place_request` «📣 اشتراك…» with topics.
- Home: quick tiles (kits / tools / works / brands) after the categories. All new pages are in the footer and the sitemap.
- `docs/site/PHOTO-GUIDE.md`: how to photograph products, videos, works with codes, install-guide links.
- Not done: loyalty points for carpenters. They need invoice totals per customer from the system.

## v9
- Horizontal product card: the photo takes 38% on the right, with the code, section, a two-line name, availability and two buttons beside it. One card = screen width in the home rows (swipe one by one, snap). One per row in listings (2 from 760 px, 3 from 1150 px).
- Numbered pages: 20 products per page (`PAGE` in catalog.ts) with 1 2 … pager (`Pager` in listing.tsx). This replaces the cumulative «load more». The category, search and brand lists use it.
- `/tools/lift` lift-up flap calculator (`src/lib/lifts.ts`):
  - **Blum** (official catalogue & technical manual 2026, publications.blum.com/2026/catalogue/en/, AVENTOS pages 12–59): LF = KH (mm) × FG (kg, including 2× the handle; HF: both fronts including the handle).
    - HK-XS: 20K1101 200–1000, 20K1301 500–1500, 20K1501 800–1800 per mechanism, doubled on two sides. KH 240–600. Two sides when KB > 610 (Blum US ordering info).
    - HK-S set: 20K2B00 220–500, 20K2C00 400–1000, 20K2E00 960–2215, +50 % with a third mechanism. KH ≤ 600.
    - HK top set: 22K2300 420–1610, 22K2500 930–2800, 22K2700 1730–5200, 22K2900 3200–9000. Max 18 kg. KH 205–600.
    - HL top arms by KH/FG: 22L3200 300–339/1.5–9, 22L3500 340–389/1.75–10, 22L3800 390–540/2–12.25, 22L3900 480–580/2.5–14. Mechanism 22L2200 (300–389) / 22L2500 (390–580).
    - HS top: 22S2200 350–450/2–11.5 and 450–540/2.5–12.5, 22S2500 480–660/2.75–15.25, 22S2800 650–800/3.5–18.5, arm 22S3500, +50 % weight with a third.
    - HF top: 1 mechanism LF 1350–3000 (KB ≤ 600), 22F2500 2700–13500, 22F2800 10000–19300, +50 % with a third. Arms 22F3200 480–610, 22F3500 600–910, 22F3900 840–1200. Asymmetric: TKH ≈ upper front × 2.
    - Overlaps → the stronger mechanism, as the catalogue recommends; the weaker one is shown as the alternative.
  - **Grass Kinvaro T-Slim**: LF = front height × (weight + 2× handle). Bands 250–500 / 500–1100 / 1000–2250 / 1500–3375 (wide), as listed by Grass dealers (no open official table). L-80 and F-20 were left out because the dealer data conflict.
  - **Gas struts (باكم، اندوكس…)**: torque balance with the usual 90° mounting (90 mm on the front from the hinge, 255 mm under the top, 10 mm back → lever ≈ 84 mm), two struts, +15 %. Sizes 80/100/120/150 N.
  - Front weight from material density (MDF 750, gloss 800, plywood 550, chipboard 650, solid wood 700, aluminium + glass) × size × thickness, or typed by the customer.

## v10
- **Promo strip** (`Ticker` in site-parts.tsx): it used to move leftwards, so the END of an Arabic sentence entered first. It now flows left→right (two identical halves, ~60 px/s, speed from the text length, pauses on touch, static text with reduced-motion), so the beginning of the sentence enters first. The text itself is `site_content.promo`, edited from /admin.
- **Product card**: vertical, full width on phones (16:11 photo, 4:3 from 600 px; 2 / 3 / 4 columns at 600 / 1000 / 1280 px). On the photo: only the heart and the availability pill. Below: code chip, section, 🎬/جديد, a two-line name, «🔔 نبّهني» (only when unavailable), two buttons (أضف للطلب + اسأل عن السعر; − n + after adding). Home rows are full-width swipe rows with dots.
- **Product page**: breadcrumbs, name, status pill + code + brand, ONE buy card (ask price / WhatsApp order / notify), a 3-item trust strip, collapsible sections (specs, delivery date + shipping, video, reviews), an install link, and one row of tool tiles (share, send to a friend, compare, call, print).
- **/admin** (`src/app/admin`, `src/lib/admin-api.ts`): sign in with the system's email + password (Supabase Auth, same as the old shop.html admin; the account must be the owner: `app_state` readable). Edits colors (accent/bg/fg/card with presets, `theme.*`, applied in `(store)/layout.tsx`), promo strip text, banners (`slides`), `logo`, `hero`, `name`, `tagline`, `trust`, `socials`, and the sections' name / photo / order. Saves with the same optimistic check as the old admin (`PATCH site_content?id=eq.main&version=eq.N`, version + 1); on a lost race it re-reads and re-applies only its own fields, and it refuses a save that would change the number of products / works / reviews. Photos go to the `site-images` bucket. After saving it calls `/api/admin/revalidate` (checks the owner token) so the site refreshes at once. The session lives in memory only. `noindex`, disallowed in robots.txt.
- Not in /admin on purpose (they stay in the system's «🌐 محتوى الموقع» / «🌐 على الموقع»): products, works, reviews, delivery, contact numbers, SEO.
- Tested with a **mocked** Supabase (login, wrong password, upload, a concurrent save, and that products/works/reviews/delivery/contact are untouched). It has not been run with the owner's real login.

## v11
- **/admin now covers everything**: 📦 products (search, add, edit, delete, hide, featured, many photos with cover + order, description with spec lines and quick-add chips, video, left/right guidance), 🗂️ sections (add, rename, photo, order, delete when empty), 🏗️ works, ⭐ hand-picked reviews, 🚚 delivery + returns policy + contact numbers/hours/map/catalog button, 🎨 colors + promo strip, 🖼️ banners/logo/hero, 📝 name/tagline/trust/socials, ⚙️ backup download. Files: `app/admin/{admin-app,products,content,ui}.tsx`, `lib/admin-api.ts`. Products use the same shape the system writes (`Object.assign` on the existing object, so the system's own editor keeps the extra keys). A product's **code** must be its code in the system (stock and orders use it); duplicate codes are refused. `saveDoc(edit, allow)` refuses any save that changes the number of products/works/reviews unless that editor is the one allowed to.
- Tested against a mocked Supabase (add / hide / delete a product, duplicate code, add / delete a section, work, review, delivery, contact; everything else stays identical). Not run with the owner's real login.
- Product fields added in the data: `hidden` (filtered out in `getSite`), `dir {off, hand R|L, kind corner|door|other, pair, note}`. Site-level `reviews` (hand-picked, shown first in the home reviews block).
- **↔️ يمين ولا شمال** (`lib/hand.ts`, `components/hand-guide.tsx`): automatic when a product name says شمال / يمين (or `dir` is set in /admin). The product page shows the direction chip, a **looping motion graphic** (`components/hand-motion.tsx`: top view like a kitchen plan; the door swings open, the bean trays glide out toward the open side, a bold dashed arrow shows the direction, the fixed side stays lit with a «📌 الجزء الثابت» label and a leader line; three captions light up in step; the left version is the same scene mirrored; honours reduced-motion), the rule, and one question («الجزء الثابت على أنهي ناحية؟») that answers which version to take and links to the opposite version (found by the same name without the direction word, or `dir.pair`). Magic-corner rule (the owner's): fixed part on the left + trays out to the right = يمين; fixed part on the right = شمال. Doors: hinges side = the name. Article `/guide/left-or-right` with both drawings. The owner's example product «ماجيك فاصوليا هازرد تركي شمال» already shows it.
- Card: image 16:10 and tighter details (about 12% shorter).

## v12 — motion templates (any product with a left/right version)
- The motion is chosen by **type**, so a product added later gets its motion at once. Types (`HandKind` in `lib/hand.ts`): **bean** (ماجيك فاصوليا, two bean trays), **magic** (ماجيك كورنر classic: the front basket pulls out, the rear basket swings round into the opening), **generic** (any pull-out unit), **door** (hinged door), **other** (text only). The type is read from the product name (`kindFromName`: فاصوليا → bean, ماجيك → magic, مفصل/ضلف/باب → door, كورنر/ركنة/سحب/سلة → generic) or chosen in /admin → product → «اتجاه الفتح → هحدده بنفسي», where a **live preview** shows exactly what the customer will see. The old kind `corner` is read as `bean`.
- Custom media: `dir.media` (a GIF / image / short video URL) replaces the built-in motion for that product.
- Add a new template (a new product shape): write its unit in `components/hand-motion.tsx` (closed pose + guide arrow), its keyframes in `globals.css` (`hm-*`), its steps in `steps()`, its label in `KIND_LABEL`, and its name pattern in `kindFromName`. Nothing else changes: product pages, the guide, the admin picker and the preview pick it up.
- Rule texts per type: `rulesFor` (pull-outs use the owner's rule: fixed side opposite the exit; doors: hinge side). **Confirm with the owner that the classic magic corner follows the same rule as the bean.**
- Guide article `/guide/left-or-right` shows bean, magic and door, right and left.

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

## Session 2 check (2026-10-31)
Took over from the previous session: nothing was missing vs the old site. Rebuilt (`next build` passes, typecheck clean, `npm run test:e2e` all good), server on 3300.
InstaPay / wallet numbers are in `config.ts` (`PAY`), overridable with `NEXT_PUBLIC_INSTAPAY` / `NEXT_PUBLIC_WALLET`.
Hosting: both options (Vercel / the shop's own server with Docker) are in `docs/site/DEPLOY.md` §1; decision still the owner's.
