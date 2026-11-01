# Free hosting of the new system (no shop PC needed)

Plan: Vercel (frontend `rebuild/frontend`) → Render free (backend, `render.yaml`) → Supabase project `mekanizm-app`, **schema `mk_new` only** (never `public`).

## Status
- [x] Uploads layer: `backend/src/lib/files.ts` (Supabase Storage when `SUPABASE_URL`+`SUPABASE_SERVICE_KEY` set, else local `uploads/`). Used by work/web/portal file routes.
- [x] `render.yaml` blueprint at repo root, `.env.example` updated.
- [ ] `C:\mekanizm-deploy\db.secret.txt` filled by the owner (Session pooler string; append `?schema=mk_new`).
- [x] migrations applied to mk_new; data copied with `backend/scripts/copy-to-hosted.mjs` (1791 rows: 1259 products, 291 contacts). Re-run is safe (truncates mk_new tables only).
- [x] Storage bucket `mk-uploads` (private) and empty schema `mk_new` created in project `mekanizm-app` (ref rzvncstjattlklpdtkfn) via Supabase MCP. Nothing else touched.
- [ ] Render service + env vars; Vercel project (root dir `rebuild/frontend`, env `BACKEND_URL=<render url>`).
- [ ] Point shop-PC bridges at the Render URL.

## Free-tier limits (tell the owner once)
- Render sleeps after 15 min idle (first request ~30-60 s). Bridge polling from the shop PC keeps it awake; if PC is off it sleeps.
- Timers (backup, invoice reader worker, nightly reports, watchdog) do not run while asleep.
- Invoice scan temp pages (`uploads/scans`) stay on local disk → lost on restart; a scan in progress may need re-sending.
- If the PC is off: sales and the site work; printing / WhatsApp / cameras pause.

## Moving to a friend's server later
`docker compose up -d` in `rebuild/` with `.env` (see `.env.example`); `DATABASE_URL` points to the local `db` service, leave `SUPABASE_*` empty.

## 2026-11-01 DECISION CHANGE (owner): no Render/Vercel/accounts. One month of trials on the shop PC.
The system runs on the shop PC (db 54329, backend :4000, frontend :3100, cloudflared quick tunnel). Keeper: scheduled task `Mekanizm-keeper` (at logon + every 5 min) runs `C:\mekanizm-deploy\start-all.ps1`, which starts only what is down and writes the public link to `C:\mekanizm-deploy\LINK.txt`. The quick-tunnel link changes only when cloudflared restarts. Shop wifi link is stable: http://192.168.1.3:3100. The Render/Vercel files and the Supabase `mk_new` copy (1791 rows, snapshot) are kept for the later real server move.
