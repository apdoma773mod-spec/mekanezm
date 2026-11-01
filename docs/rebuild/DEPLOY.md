# Free hosting of the new system (no shop PC needed)

Plan: Vercel (frontend `rebuild/frontend`) → Render free (backend, `render.yaml`) → Supabase project `mekanizm-app`, **schema `mk_new` only** (never `public`).

## Status
- [x] Uploads layer: `backend/src/lib/files.ts` (Supabase Storage when `SUPABASE_URL`+`SUPABASE_SERVICE_KEY` set, else local `uploads/`). Used by work/web/portal file routes.
- [x] `render.yaml` blueprint at repo root, `.env.example` updated.
- [ ] `C:\mekanizm-deploy\db.secret.txt` filled by the owner (Session pooler string; append `?schema=mk_new`).
- [ ] Create schema + `prisma migrate deploy`, copy dev data into `mk_new`.
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
