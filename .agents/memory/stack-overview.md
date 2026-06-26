---
name: Stack Overview
description: Core technical facts about the Prnhbbbb / Soci platform stack that aren't obvious from the code.
---

# Stack

- **Backend:** Django 4.2 + DRF — `backend/` — runs on port :8000
- **Frontend:** React 19 + Vite — `backend/artifacts/streamvid/` — runs on port :5000
- **Package manager:** pnpm workspace
- **DB (dev):** SQLite at `backend/db.sqlite3`

# Non-obvious Auth Quirks

- Admin check is `user.role in ('admin', 'moderator')` — NOT Django's `is_staff`
- JWT token comes from `useAuth() as any` then `.token` in frontend
- Session token stored on User model in `session_token` field (custom, not Django sessions)

# Workflows
- "Django Backend": `cd backend && python manage.py runserver 0.0.0.0:8000`
- "Start application": `cd backend && PORT=5000 BASE_PATH=/ pnpm --filter @workspace/streamvid run dev`
- Vite proxies `/api` and `/media` to :8000

# Key file locations
- Admin views: `backend/apps/admin_panel/seo_webhook_views.py`
- Category CRUD: `backend/apps/videos/extras2_views.py`
- Frontend admin settings: `backend/artifacts/streamvid/src/components/admin/admin-site-settings.tsx`
- Subscription models: `backend/apps/subscriptions/models.py`
- Seed command: `backend/apps/core/management/commands/seed_data.py`

**Why:** These facts took effort to discover and are not obvious from reading the code at a glance.
