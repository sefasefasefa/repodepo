# Hotpulse (Soci)

An 18+ social video sharing platform with video uploads, live streaming, messaging, and a token-based economy.

## Stack

- **Backend:** Python 3.11, Django 4.2, Django REST Framework, SimpleJWT
- **Frontend:** React + Vite (pre-compiled static assets served via WhiteNoise)
- **Database:** SQLite (dev) — set `DATABASE_URL` to switch to PostgreSQL in production
- **Static serving:** WhiteNoise middleware
- **Server:** Gunicorn (Linux/Replit)

## How to run

The **Start application** workflow handles everything:
```
cd backend && python3.11 manage.py migrate --run-syncdb --no-input && python3.11 manage.py collectstatic --noinput -v 0 && python3.11 -m gunicorn config.wsgi:application --config gunicorn.conf.py
```

Django will serve the pre-built React frontend at `/` and the REST API at `/api/`.

## Environment variables

Set via Replit Secrets / environment:

| Variable | Default | Description |
|---|---|---|
| `SECRET_KEY` / `SESSION_SECRET` | insecure fallback | Django secret key — set a strong value in production |
| `DEBUG` | `True` | Set `False` in production |
| `ALLOWED_HOSTS` | `*` | Comma-separated allowed hosts |
| `FORCE_SQLITE` | `true` | Force SQLite even if `DATABASE_URL` is set |
| `DATABASE_URL` | (none) | PostgreSQL connection string for production |

## Project layout

```
backend/
  apps/           # Django apps (accounts, videos, social, live, messaging, tokens, subscriptions, …)
  artifacts/      # Frontend source (React + Vite workspace)
  config/         # Django settings, URLs, WSGI
  static/         # Compiled frontend assets (committed)
  media/          # User-uploaded files (committed)
  db.sqlite3      # Dev database
infra/            # Nginx configs
scripts/          # Backup/restore and OS-specific setup scripts
docs/             # Platform documentation
```

## Admin

Create a superuser with:
```
cd backend && python3.11 manage.py createsuperuser
```

Django admin is at `/admin/`. The platform also has a custom admin panel at `/panel/`.

## User preferences

- Always use `python3.11` (not `python` or `python3`)
