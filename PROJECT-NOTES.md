# Life Work OS — project notes

A personal life/work management tool (tasks, matters, calendar, habits, journal,
AI assistant), originally built on Replit and brought fully in-house: a real
backend, self-hosted deployment, and a run of feature work on top of the
original export. This doc is a snapshot of key decisions and where things
stand — see `DEPLOY.md` and `SELF-HOST-PI.md` for step-by-step deploy
instructions.

## Architecture

- **Frontend**: React + Vite + TypeScript, Tailwind v4, shadcn/ui components.
  Custom CSS design system (`lo-*` classes) in `src/index.css`, not utility-class
  driven — original Replit design language, preserved.
- **Backend**: Express (`server/`), added from scratch — the original Replit
  export only ever included the frontend. Single-file JSON storage
  (`server/data/db.json`), no database. Auto-incrementing IDs, one flat DB
  object holding tasks/events/habits/journal/matters/settings.
- **Auth**: HTTP Basic Auth (`server/auth.ts`), gated by `APP_PASSWORD` env var.
  No-op when unset (local dev). Includes IP-based rate limiting (8 wrong
  attempts / 15 min lockout) that only counts requests with an actual
  (wrong) Authorization header, not the normal missing-header handshake.

## Deployment

- **Primary: self-hosted on a Raspberry Pi**, reachable via Tailscale (private
  tailnet, no public exposure). Chosen over Railway specifically for privacy —
  data never touches third-party infrastructure this way. Railway was used
  briefly, then decommissioned once the Pi setup was working.
- **Tailscale Funnel** is used for access from devices without Tailscale
  installed (e.g. a work PC) — publishes a real public HTTPS URL, so the
  password gate + rate limiting are load-bearing for that path.
- Railway config (`railway.json`) is still in the repo as a harmless leftover
  in case it's ever needed again, but is not the active deployment.

## Key decisions (the "why", not derivable from the code)

- **Fonts self-hosted** (`public/fonts/`) instead of Google Fonts CDN — removes
  the only third-party call the app made that wasn't Railway/Anthropic/Outlook.
- **Outlook sync is one-way, via ICS subscription link**, not Microsoft Graph
  OAuth — avoids Azure app registration entirely at the cost of no push-back
  to Outlook and overwrite-on-resync semantics (a manual edit here gets
  clobbered by the next sync if Outlook still has the old value).
- **AI Assistant** calls Anthropic's API server-side only; the assistant's
  context (open tasks, today's events, habit status) is rebuilt from live data
  on every request rather than stored — chat history itself is never
  persisted, browser-tab-only.
- **Timezone handling**: `Date.toISOString().split("T")[0]` was used
  throughout the original code (and copied into new code before this was
  caught) to derive "YYYY-MM-DD" strings. This silently shifts the date
  backward for positive-UTC-offset zones (AEST) depending on time of day.
  Fixed via `toLocalDateStr()` in `src/lib/utils.ts` — always use this, never
  `toISOString()`, for any local-calendar-date string.

## Features shipped beyond the original export

- Full Express backend + CRUD for everything (none of this existed in the
  Replit export, which was frontend-only).
- Matter ↔ Task linking: badge/tag on task rows and detail panel, a picker in
  the add-task form, and inline-editable "waiting for" actions and linked
  tasks inside a Matter's own panel (originally read-only spans).
- Tasks sort by due date (open-before-done, earliest first, undated last).
- Each matter gets a distinct, deterministic tag color (8-color palette keyed
  by matter id) instead of one flat gray.
- Habit log: per-day free-text notes on top of the existing done/not-done
  tracker, editable from the habit's history panel.
- Calendar week view with drag-and-drop time-blocking: drag an open task onto
  an hourly grid (8am–10pm) to create a resizable, linked event block; existing
  blocks can be dragged to reposition. Matters are *not* a direct drag source —
  only tasks (which carry their matter tag along with them).
- Outlook calendar one-way sync via ICS link (see decision above), including
  recurring-event expansion.

## Known limitations / open items

- **Projects** is not a real entity — `Projects.tsx` is just `Tasks.tsx`
  filtered to `category: "projects"`. Building it out as a proper entity
  (mirroring Matters) was scoped and started (data model design discussed)
  then explicitly deprioritized by the user ("don't worry about it for now").
- **Work/Personal split is being removed.** The user is merging this in
  Replit into one unified workspace and will hand over the changed files.
  This currently drives: the Sidebar mode toggle, `viewMode` +
  `WORK_CATEGORIES`/`PERSONAL_CATEGORIES` in `AppContext.tsx`, and category
  filtering/dropdowns in `Tasks.tsx`. Expect a merge here, not a straight
  overwrite, since Replit's copy doesn't know about anything in "Features
  shipped" above.
- Outlook sync has no conflict resolution — see decision note above.
- No automated backups of `server/data/db.json` beyond whatever the Pi's own
  disk/backup setup provides.
