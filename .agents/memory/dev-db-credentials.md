---
name: Dev Database & Credentials
description: Location of SQLite dev DB and all seed user/password combos for Prnhbbbb platform.
---

# Dev Database

**File:** `backend/db.sqlite3` — intentionally committed alongside code, NOT gitignored.
**Engine:** SQLite (dev). Do NOT gitignore this file.

To reset & repopulate:
```
cd backend && python manage.py seed_data --env=dev --force
```

# Dev Credentials

| Role       | Username      | Password     | Email                    | Notes                          |
|------------|---------------|--------------|--------------------------|--------------------------------|
| admin      | admin         | admin123     | Admin@admin.com          | is_staff=True, is_superuser=True |
| moderator  | moderator     | mod123       | moderator@soci.local     | role=moderator                 |
| creator    | creator1–5    | creator123   | creator1-5@soci.local    | verified creators, 1-5 names   |
| user       | user1–10      | user123      | user1-10@soci.local      | regular users                  |
| user (VIP) | vip1–3        | vip123       | vip1-3@soci.local        | active adult subscriptions     |

**Why:** Credentials saved here so any future agent (or team member with repo access) can immediately use the dev DB without re-running seed or guessing passwords.

**How to apply:** Log in to the running app at :5000 with any credential above. Admin panel requires role=admin or role=moderator.
