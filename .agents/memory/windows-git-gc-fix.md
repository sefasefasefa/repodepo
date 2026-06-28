---
name: Windows Git GC Fix
description: How update.sh handles Windows Defender file locking during git gc
---

## The Problem

On Windows (MINGW64/Git Bash), `git fetch` triggers `git gc --auto` which tries to delete old `.git/objects/pack/*.idx` files. Windows Defender locks these files immediately after creation. Git's C code then calls `CreateFileA("CONIN$")` to ask "Should I try again? (y/n)" — this uses the Windows console API directly, so no env variable (GIT_TERMINAL_PROMPT, gc.auto=0, etc.) or shell redirection can suppress it.

## What Was Tried and Failed

- `gc.auto=0`, `gc.autopacklimit=0` — gc still ran (merge step re-triggers it)
- `yes y | git fetch` — git reads from CONIN$ (Windows console), not stdin
- `GIT_TERMINAL_PROMPT=0` — only affects credential prompts, not retry prompts
- `git unpack-objects` + `rm -f` — rm fails silently on locked files
- PowerShell `CreateNoWindow=true` — child process still inherits parent console; CONIN$ still accessible
- PowerShell `Add-MpPreference` (Defender exclusion) — may have failed silently

## The Fix

**update.sh Windows section uses `curl | tar xz` (GitHub tarball) instead of `git fetch`.**

```bash
ORIGIN=$(git remote get-url origin | sed 's|\.git$||')
TARBALL="${ORIGIN}/archive/refs/heads/main.tar.gz"
curl -fsSL --max-time 120 "$TARBALL" | tar xz --strip-components=1
```

**Why it works:** Tarball contains only git-tracked files. No pack files are created, no gc runs, no Defender locking, no CONIN$ prompt. Untracked files (db.sqlite3, .env, media/, venv/) are not in the tarball so `tar xz` leaves them untouched.

**Bootstrap (one-time, when update.sh itself needs updating):**
```bash
curl -fsSL https://raw.githubusercontent.com/USER/REPO/main/update.sh -o update.sh && ./update.sh
```

**Why:** Since update.sh updates itself via git, if the old version is running it pulls the new version but continues executing as the old version. The bootstrap downloads the new update.sh directly before running it.
