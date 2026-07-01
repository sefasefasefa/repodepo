# Hotpulse (Soci)

An 18+ social video platform with video uploading/streaming, subscriptions, live streaming, private messaging, a token/tipping system, badges, stories, and an affiliate system.

## Run & Operate

Workflow **"Start application"** runs a single server:
- Django on `http://0.0.0.0:5000` — serves API + pre-built, gzip-compressed frontend assets

### Useful commands

```bash
# Rebuild frontend after code changes (run both commands)
cd backend/artifacts/streamvid && pnpm build
cd backend && python manage.py collectstatic --noinput --clear

# Run migrations
cd backend && python manage.py migrate

# Create a superuser
cd backend && python manage.py createsuperuser

# Install/update Python deps
pip install -r backend/requirements.txt

# Install/update frontend deps
cd backend/artifacts/streamvid && pnpm install
```

## Stack

- **Backend:** Django 4.2 + Django REST Framework + SimpleJWT, running on port 6000
- **Frontend:** React + Vite + TailwindCSS v4, running on port 5000
- **Database:** SQLite (dev, at `backend/db.sqlite3`) / PostgreSQL (prod via `DATABASE_URL`)
- **Package managers:** pip (Python), pnpm (Node)

## Where things live

- Django apps: `backend/apps/` (accounts, videos, social, subscriptions, live, messaging, tokens, affiliate, ai, …)
- Django config: `backend/config/settings.py`, `backend/config/urls.py`
- Frontend source: `backend/artifacts/streamvid/src/`
- Media uploads: `backend/media/`
- Static files (built): `backend/static/`

## Environment variables

Settings are read from `backend/.env` (via `python-dotenv`). All have safe defaults for dev:

| Variable | Default | Notes |
|---|---|---|
| `SECRET_KEY` | insecure fallback | Falls back to `SESSION_SECRET` Replit secret |
| `DEBUG` | `True` | Set to `False` in production |
| `ALLOWED_HOSTS` | `*` | Comma-separated list |
| `DATABASE_URL` | SQLite | Set to Postgres URL for production |
| `FORCE_SQLITE` | unset | Set to `true` to force SQLite even with `DATABASE_URL` |

## Architecture decisions

- JWT auth via SimpleJWT; token refresh handled client-side via `useAuth()` hook.
- `SESSION_SECRET` Replit secret is used as `SECRET_KEY` fallback — no `.env` required in dev.
- Vite dev server proxies API calls so frontend and backend share the same origin in dev.
- `CORS_ALLOW_ALL_ORIGINS = True` is set in dev — should be locked down to specific origins before deploying.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- After any Python dependency changes, restart the workflow.
- `db.sqlite3` lives in `backend/` alongside the code — do not delete it without backing up.
- Run `python manage.py migrate` after pulling changes that include new migrations.
