# Mekanizm — rebuild

New version of the shop system: Fastify + Prisma + PostgreSQL backend, Next.js 15 (App Router) frontend, shared Zod types. It is being built in phases (see `../docs/rebuild/02-architecture.md`). **Phase 1 (foundation)** is here: login, sessions, users and roles, store and theme settings, audit log.

The live system (`../index.html` + Supabase) is not touched by anything in this folder.

## Layout

```
rebuild/
  shared/     @mk/shared   enums, Zod schemas, types used by both sides
  backend/    @mk/backend  Fastify API on :4000  (prisma/ = schema + migrations)
  frontend/   @mk/frontend Next.js app on :3100 (proxies /api/* to the backend)
  docker-compose.yml
```

## Run with Docker (recommended on the shop PC)

1. Install Docker Desktop for Windows and start it.
2. In this folder: copy `.env.example` to `.env` and change every `change-me` value. `JWT_SECRET` must be at least 32 random characters:
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
   ```
3. Start everything (migrations run automatically when the backend starts):
   ```bash
   docker compose up -d --build
   ```
4. Open `http://localhost:3100`. On a fresh install it shows the **first-run setup** screen where the owner creates their own admin account (name, phone, password). The screen closes for good once any account exists. To create the admin from `.env` instead, fill `SEED_ADMIN_*` and run `docker compose exec backend node dist/seed.js`.
5. From phones on the shop Wi-Fi, open `http://<shop-pc-ip>:3100` (find the IP with `ipconfig`).

Optional access from outside the shop: create a Cloudflare Tunnel, put its token in `CLOUDFLARE_TUNNEL_TOKEN`, set `COOKIE_SECURE=true` and `TRUST_PROXY=true`, then `docker compose --profile tunnel up -d`.

## Run locally without Docker

Requirements: Node.js 20+ and PostgreSQL 16. **Create the database with UTF-8 encoding**, otherwise Arabic text can't be stored:

```sql
CREATE DATABASE mekanizm ENCODING 'UTF8' TEMPLATE template0;
```

```bash
npm install
cp .env.example backend/.env      # then edit DATABASE_URL, JWT_SECRET, SEED_* (NODE_ENV=development for pretty logs)
npm run build -w shared
npm run db:migrate                # applies prisma/migrations, generates the client
npm run db:seed                   # default settings (+ admin/staff only if SEED_* are filled)
npm run dev:backend               # http://localhost:4000
npm run dev:frontend              # http://localhost:3100
```

## Migrations

- Change `backend/prisma/schema.prisma`, then `npm run db:migrate -- --name <what-changed>` (dev). This creates a new folder in `backend/prisma/migrations/`. Commit it.
- Production / Docker: `npm run db:deploy` (the backend container runs this on every start).

## Tests

The integration tests run against a separate, empty database that is reset between tests:

```bash
TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/mekanizm_test npm test
```

## Environment variables

| Variable | Used by | Meaning |
|---|---|---|
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | docker-compose | Database account and name |
| `DATABASE_URL` | backend, Prisma | Postgres connection string (compose builds it for you) |
| `NODE_ENV` | backend | `development` / `test` / `production` |
| `HOST`, `PORT` | backend | Listen address, default `0.0.0.0:4000` |
| `LOG_LEVEL` | backend | `info` by default |
| `JWT_SECRET` | backend | Signs access tokens, at least 32 characters |
| `ACCESS_TOKEN_TTL_MIN` | backend | Access token lifetime, default 15 minutes |
| `REFRESH_TOKEN_TTL_DAYS` | backend | How long a login stays valid, default 30 days |
| `COOKIE_SECURE` | backend | `true` only when served over https |
| `TRUST_PROXY` | backend | `true` behind the tunnel / a reverse proxy |
| `LOGIN_RATE_LIMIT_MAX` | backend | Login attempts per IP per 15 minutes, default 10 |
| `SEED_ADMIN_NAME`, `SEED_ADMIN_PHONE`, `SEED_ADMIN_PASSWORD` | seed | Optional: admin account created by the seed instead of the setup screen |
| `SEED_STAFF_NAME`, `SEED_STAFF_PHONE`, `SEED_STAFF_PASSWORD` | seed | Optional demo staff account |
| `BACKEND_URL` | frontend (build time) | Where `/api/*` is forwarded, `http://backend:4000` inside compose |
| `CLOUDFLARE_TUNNEL_TOKEN` | tunnel | Optional remote access |
| `TEST_DATABASE_URL` | tests | Empty database used only by `npm test` |

## API (phase 1)

All routes are under `/api/v1`. Errors always look like `{ "error": { "code", "message", "details?" } }`.

| Method | Path | Who | Purpose |
|---|---|---|---|
| GET | `/health` | anyone | Server + database check |
| GET | `/auth/setup` | anyone | `{ needsSetup }`: true while no account exists |
| POST | `/auth/setup` | anyone, once | Creates the owner admin account and signs in (refused after that) |
| POST | `/auth/login` | anyone | `{ login: phone or email, password }` → sets session cookies |
| POST | `/auth/refresh` | cookie | Rotates the refresh token |
| POST | `/auth/logout` | cookie | Ends the session on this device |
| GET | `/auth/me` | signed in | Current user |
| POST | `/auth/change-password` | signed in | Signs out every other device |
| GET | `/users` | admin | List (`q`, `role`, `active`, `page`, `pageSize`) |
| GET | `/users/:id` | admin | One user |
| POST | `/users` | admin | Create |
| PATCH | `/users/:id` | admin | Update name / phone / email / role / active |
| DELETE | `/users/:id` | admin | Deactivate (accounts are never hard-deleted) |
| POST | `/users/:id/reset-password` | admin | Set a new password, signs that user out |
| GET | `/settings` | signed in | Store and theme settings |
| PUT | `/settings/:key` | admin | `store` or `theme` |
| GET | `/audit` | admin | Audit log (`action`, `userId`, `from`, `to`, `q`, paging) |

## Security notes

- Passwords are hashed with Argon2id and never leave the API. Sessions use httpOnly cookies: a 15-minute JWT plus a rotating refresh token stored hashed. Reusing an old refresh token revokes that whole login.
- Every change that matters is written in the same database transaction as its audit-log row (SERIALIZABLE, retried on conflicts).
- All timestamps are stored as `timestamptz` in UTC and shown in Cairo time.
