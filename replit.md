# Soci — Social Video Platform

Django 4.2 backend + React/Vite frontend social video sharing platform (18+ content).

## Stack

- **Backend**: Django 4.2, Django REST Framework, SimpleJWT — runs on port 5000 via gunicorn
- **Frontend**: React/Vite, pre-built static files served by Django/WhiteNoise
- **Database**: PostgreSQL (Replit-managed, `DATABASE_URL` env var injected automatically)
- **Python**: Must use `python3.11` — packages are installed for 3.11; system `python3` resolves to 3.12 and will fail

## How to run

The "Start application" workflow handles everything:
1. Runs Django migrations
2. Collects static files
3. Starts gunicorn on port 5000

## Key URLs

| URL | Description |
|---|---|
| `/` | Frontend app (age gate → login/register) |
| `/api/healthz` | Health check |
| `/api/auth/register/` | Registration |
| `/api/auth/login/` | Login (returns JWT) |
| `/django-admin/` | Django admin panel |

## Project structure

```
backend/
  apps/           # Django apps (accounts, videos, social, subscriptions, …)
  config/         # settings.py, urls.py, wsgi.py
  artifacts/      # Pre-built frontend (streamvid)
  static/         # Collected static files
  manage.py
  gunicorn.conf.py
  requirements.txt
```

## Environment

- `DATABASE_URL` — injected by Replit (PostgreSQL). SQLite fallback: set `FORCE_SQLITE=true`
- `SESSION_SECRET` — used as Django `SECRET_KEY`

## User preferences

- Use `python3.11` explicitly in all shell commands (not `python3` or `python`)
