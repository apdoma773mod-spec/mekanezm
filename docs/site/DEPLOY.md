# Putting the site live on mekanezm.com

The site is ready to run on a real host. Steps that need the owner's accounts (buying the domain, the
host, Google accounts, payment numbers) are marked **owner**.

## 1. Pick the host (owner)
**A. Vercel (easiest, free to start).** Made by the team behind Next.js. Builds on every push, and has a CDN in Europe and the Middle East.
1. vercel.com → sign in with GitHub → *Add New Project* → this repo.
2. Root directory: `rebuild/site`. Framework: Next.js. Build command: `next build`.
3. Branch: `site-rebuild` (or `main` after merge).
4. Environment variables: see section 3.

**B. Your own server (VPS, or the same server as the system).** Docker is ready:
```
docker build -f rebuild/site/Dockerfile --build-arg SITE_URL=https://mekanezm.com -t mk-site rebuild
docker run -d --restart=always -p 3300:3300 --env-file site.env --name mk-site mk-site
```
Put Caddy or nginx in front for https:
```
mekanezm.com, www.mekanezm.com {
  reverse_proxy 127.0.0.1:3300
}
```
Caddy gets the SSL certificate by itself.

## 2. Domain (owner)
Buy `mekanezm.com` (Namecheap, GoDaddy, Cloudflare…). Then set its DNS:
- **Vercel:** add the domain in the project → copy the records it shows (an `A 76.76.21.21` record and a `CNAME www → cname.vercel-dns.com`).
- **Own server:** an `A` record for `@` and for `www` pointing to the server IP.

Keep the old GitHub Pages site running until the new one works. Old links (`shop.html?p=…`, `custom.html`, `p/ID.html`) redirect by themselves once the domain points here.

## 3. Settings (environment variables)
| Name | Value | Needed |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://mekanezm.com` | yes (canonical, sitemap and share links; set before the build) |
| `REVALIDATE_SECRET` | any long random text | yes, for instant refresh |
| `NEXT_PUBLIC_INSTAPAY` | InstaPay number (default 01010741015) | no, shown under «💳 الدفع» |
| `NEXT_PUBLIC_WALLET` | mobile-wallet number (default 01119199659) | no |
| `LOG_WEBHOOK` | a webhook URL that accepts `{"text": …}` (Slack, Discord with `/slack`, Google Chat…) | optional, alerts on customer errors |
| `NEXT_PUBLIC_GA_ID`, `NEXT_PUBLIC_FB_PIXEL` | already set to the old site's ids | no |

`NEXT_PUBLIC_*` values are baked in when the site is built. Change one → rebuild. With Docker, pass them as build args: `--build-arg SITE_URL=… --build-arg INSTAPAY=… --build-arg WALLET=…`. `REVALIDATE_SECRET` and `LOG_WEBHOOK` are read at run time, so pass them to `docker run` / `--env-file`.

## 4. Instant refresh after editing products
Pages refresh by themselves every 60 seconds. To show an edit right away, have the system call this after it saves the shop:
```
POST https://mekanezm.com/api/revalidate?secret=REVALIDATE_SECRET
```
(One line in the system's save; not added yet because `rebuild/backend` is out of scope for this branch.)

## 5. Google (owner, ~15 minutes)
1. **Search Console** (search.google.com/search-console): add the property `https://mekanezm.com`.
   The two verification files from the old site are already in `public/`. If Google gives a new one, drop it in `rebuild/site/public/`.
2. Sitemaps → submit `https://mekanezm.com/sitemap.xml`.
3. **Google Business Profile** (business.google.com): put the shop on Maps with the address, hours (10 AM–12 AM, Friday off), phone and the website link. Ask happy customers for a Google review.
4. Analytics (GA4 `G-MY8C3L82KH`) and the Facebook Pixel work already. Watch the `contact`, `add_to_cart` and `generate_lead` events.

## 6. Monitoring
- Uptime: add `https://mekanezm.com/api/health` to UptimeRobot or Better Stack (free). It returns 503 when the site can't read its data.
- Customer errors: script errors on customers' phones are sent to `/api/log`. They show in the server log as `[client-error]`, and in `LOG_WEBHOOK` if it is set.
- Backups: the data lives in Supabase (`site_content`, `web_orders`, …) and is covered by the system's backups. The site itself stores nothing.

## 7. Before every release
```
cd rebuild/site && npx next build && npx next start -p 3300
npm run test:e2e                 # local
npm run test:e2e -- https://mekanezm.com   # after deploy
```
The test never sends orders or forms.
