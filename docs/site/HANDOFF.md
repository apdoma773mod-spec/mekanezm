# Public website rebuild — handoff

Branch `site-rebuild` (from `tajroba-rebuild`), worktree `C:\Users\ميكانزم\Documents\mekanezm-site-next`.
New workspace: `rebuild/site` (Next.js 15 App Router, TypeScript, zod). Port **3300**.

Rule followed: copy the old site's **final** state only (live `main`, commit 4ae6ad96), never replay its history.
The old pages patch themselves with many script blocks; the final behaviour was read from the live page
(headless Chrome: rendered DOM + final function versions) and from the last override in the source.

## Status
- [x] Data layer: `src/lib/catalog.ts` (server reads, ISR 300 s), `src/lib/api.ts` (browser writes: orders,
      requests, tracking, reviews, notify-me, custom orders, portal). Same Supabase tables/RPCs as the old site.
- [x] Store home `/`, product pages `/p/[id]`, cart + checkout with delivery choice, popups, SEO files.
- [ ] `/custom` (تجهيز), `/story`, `/portal`
- [ ] Browser check on mobile, tunnel link

See the end of this file for "how to run" (filled in when the first run is verified).
