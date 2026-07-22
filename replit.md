# Soci / Hotpulse — Social Video Platform

A full-stack social video platform with video sharing, live streaming, stories, messaging, and a token-based economy.

## Stack
- **Backend:** Python 3.11, Django 4.2, Django REST Framework
- **Frontend:** React + Vite (source in `backend/artifacts/streamvid/`, built output served by Django)
- **Database:** SQLite (default; PostgreSQL supported via `DATABASE_URL`)
- **Server:** Gunicorn on port 5000

## How to run
The **Start application** workflow handles everything:
1. Builds the React frontend (`pnpm run build`)
2. Runs Django migrations
3. Collects static files
4. Starts Gunicorn on port 5000

## Key paths
- Backend entry: `backend/config/wsgi.py`, `backend/manage.py`
- Django apps: `backend/apps/`
- Frontend source: `backend/artifacts/streamvid/`
- Static files (served): `backend/static/`
- Media uploads: `media/`
- Gunicorn config: `backend/gunicorn.conf.py`

## Environment
- `SESSION_SECRET` — used as Django `SECRET_KEY` (set as a Replit Secret)
- `ALLOWED_HOSTS=*` — set in `.replit` userenv
- `FORCE_SQLITE=True` — set in `.replit` userenv (forces SQLite regardless of DATABASE_URL)
- `CSRF_TRUSTED_ORIGINS` — set in `.replit` userenv for Replit domains

## Dev credentials
- Admin panel: `/django-admin/` — username `admin`, password `admin123`

## Notes
- `backend/.python-version` pins uv to Python 3.11 (required — uv defaults to 3.12 which breaks Django imports)
- Frontend must be rebuilt (`pnpm run build`) after source changes for them to take effect

## User preferences
