---
name: Stack Overview
description: Core technical facts about the Hotpulse (Soci) platform stack that aren't obvious from the code.
---

# Stack

- **Backend:** Django 4.2 + DRF — `backend/` — runs on port :5000 (dev, single workflow)
- **Frontend:** React + Vite — `backend/artifacts/streamvid/` — built into `backend/static/`
- **Package manager:** pnpm workspace
- **DB (dev):** SQLite at `backend/db.sqlite3`
- **DB (prod):** PostgreSQL via `DATABASE_URL` env var

# Deployment (Production — Windows VDS)

- **Server:** Waitress (`scripts/start.sh`) behind nginx (`C:\nginx\`)
- **Deploy:** `./scripts/update.sh` — pulls code (tarball, not git fetch), builds frontend, updates nginx conf, warms cache, restarts Waitress
- **Frontend build:** `cd backend/artifacts/streamvid && pnpm build` → `python manage.py collectstatic --noinput --clear`
- **CDN:** Cloudflare in front of nginx
- **nginx configs:** `infra/nginx/nginx-windows.conf` (Windows VDS), `infra/nginx/nginx-linux.conf` (Linux VDS)

# Non-obvious Auth Quirks

- Admin check is `user.role in ('admin', 'moderator')` — NOT Django's `is_staff`
- JWT token comes from `useAuth() as any` then `.token` in frontend
- Session token stored on User model in `session_token` field (custom, not Django sessions)

# Workflows (Dev / Replit)

- Single workflow: `cd backend && python manage.py runserver 0.0.0.0:5000`
- Django serves both API and pre-built frontend static files on port 5000

# Key Critical Files

- `backend/config/settings.py` — all Django settings
- `backend/apps/core/views.py` — `/api/init` endpoint (anon cache 5 min, key: `init:anon:full:v3`)
- `backend/apps/core/seo_views.py` — embeds init data into HTML as `__HP_INIT__` script tag
- `backend/artifacts/streamvid/src/lib/init-prefetch.ts` — React skips network call if `__HP_INIT__` present
- `nginx.conf` — proxy cache + smart `/api/` caching (only caches if no Authorization header)

# Speed Optimizations (Done)

- Anon `/api/init`, `/api/home`, `/api/categories` → public, `s-maxage` set (Cloudflare + nginx cache)
- Avatar upload → WebP 400×400 via Pillow
- Thumbnail → WebP via ffmpeg→Pillow
- Notification fetch delayed 3s from page load
- Video pages embed inline init data for anon users

# Pending (Cloudflare Panel)

- Cache Rule: `hotpulse.me/api/init` GET → Edge TTL 1 min
- Cache Rule: `hotpulse.me/api/home*` GET → Edge TTL 2 min

# Gotchas

- `locmem` cache: Waitress restart = cache cleared → `update.sh` warms cache after restart
- `CORS_ALLOW_ALL_ORIGINS = True` is still on in production (not yet restricted)
- Windows: `git pull` avoided in `update.sh` (Defender lock + CONIN$ issue) — uses tarball download instead
- Admin uses custom `role` field, not `is_staff`

**Why:** These facts are non-obvious from reading code alone and affect how new features should be built.
