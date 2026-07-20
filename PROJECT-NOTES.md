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
  object holding tasks/events/habits/journal/matters.
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
  the only third-party call the app made that wasn't Railway/Anthropic.
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
  tasks inside a Matter's own panel (originally read-only spans). Clicking a
  linked task inside a Matter now opens the same full `TaskDetail` panel used
  on the Tasks page (priority, category, due date, steps, waiting-on log,
  notes) instead of a bare checkbox + editable-text row — `TaskDetail` was
  extracted to `src/components/TaskDetail.tsx` so both pages share it.
- Tasks sort by due date (open-before-done, earliest first, undated last).
- Each matter gets a distinct, deterministic tag color (8-color palette keyed
  by matter id) instead of one flat gray.
- Habit log: per-day free-text notes on top of the existing done/not-done
  tracker, editable from the habit's history panel.
- Calendar rewritten (`src/pages/Calendar.tsx`) to a full Day/Week/Month view
  (adopted from a later Replit iteration, `Event.endTime` replacing the
  earlier `durationMinutes` field), with our own drag-and-drop task scheduling
  layered on top: drag an open task from the side panel onto the 8am–9pm time
  grid to create a resizable, linked event block (carries the task's matter
  tag/color); existing blocks can be dragged to reposition or resized from the
  bottom edge; clicking an empty slot opens a quick-add modal, clicking an
  event opens a full edit modal; hovering an event shows a tooltip with time/
  category/matter. Matters are *not* a direct drag source — only tasks.
  Matter-linked events show the matter's name directly in the block/cell
  text ("◇ Matter name: Task title", in both the Week/Day grid and Month
  view) rather than just the color-coded diamond icon — color alone wasn't
  enough to identify which matter without hovering for the tooltip.
- Unified Work/Personal workspace (merged in from a Replit iteration): the
  Sidebar mode toggle and `viewMode`/`WORK_CATEGORIES`/`PERSONAL_CATEGORIES`
  are gone. `AppContext.tsx` now exposes a single `ALL_TASK_CATEGORIES =
  ["inbox", "work", "personal", "health", "finance", "matters", "other"]`,
  and every nav item is always visible.
- Task inbox + quick capture: the Dashboard has a "Capture a task" field that
  files new tasks under the `inbox` category, plus an "Tasks to be processed"
  card to assign a real category later.
- `Task.urgent` boolean, independent of priority/due date — surfaced as a ⚡
  toggle on task rows and in the task detail panel.
- Eisenhower priority matrix on the Dashboard (Do First / Schedule / Delegate
  / Eliminate), computed from `urgent` OR overdue-or-due-today, crossed with
  `priority === "high"`. The same matrix is also a full "matrix" filter tab on
  the Tasks page itself (bigger quadrants, full task rows, all open tasks not
  just the top 5). Independently of that view, "Do First" tasks (urgent +
  important) always sort to the top of the plain task list too, ahead of
  due-date ordering — that's the point of the quadrant.
- Task "waiting on" log: each Task carries a `waits: WaitEntry[]` (description,
  who/where it's with, sent date, waiting/received status, received date) —
  the same shape as the pre-existing `MatterAction`, just hung off Task
  instead of Matter, and reusing its CSS classes. Surfaced as a "Waiting on"
  section in the task detail panel, a "⏳ Nd · who" badge on the oldest open
  wait in the task list, and a "Waiting on others" card on the Dashboard
  listing every task's open waits, oldest first.
- Calendar planned-vs-actual tracking: `Event.actualTime`/`actualEndTime`
  alongside the planned `time`/`endTime`. A ⏱ toggle button on each calendar
  block (▶ start / ⏹ stop / ↺ restart) stamps the current local time; the
  variance ("+15m over" / "20m under" / "On schedule") shows in the event's
  hover tooltip and in the edit modal, which also allows manually typing or
  clearing the actual times. No dual-bar rendering on the grid — variance is
  surfaced as text only, by design (see decision in that feature's build).
- Multi-day all-day calendar events: `Event.endDate` (defaults to `date` for
  single-day events), editable via a "through" date field in the edit modal
  that only appears when "All day" is checked. Rendered by repeating the same
  all-day chip in every day cell the span covers (Week/Day's all-day row and
  Month view) rather than drawing one continuous banner bar — much less
  rendering risk, at the cost of not looking like a single joined bar.
- Complete-task toast: checking a task complete (task list, task detail, or
  the Dashboard inbox) doesn't interrupt the completion — it fires instantly
  as before — but a dismissible toast then offers "waiting on someone?" for a
  few seconds, expanding inline into a mini form (who + description,
  pre-filled with the task text) that logs a `WaitEntry` without a second
  trip into the task detail panel. Shared component: `src/components/
  CompleteToast.tsx`.

## Known limitations / open items

- **Projects** was removed as part of the unified-workspace merge above —
  it was never a real entity (`Projects.tsx` was just `Tasks.tsx` filtered to
  `category: "projects"`), and the Replit iteration that unified Work/Personal
  dropped it from the nav entirely. Building a proper Projects entity
  (mirroring Matters) was scoped once then explicitly deprioritized by the
  user ("don't worry about it for now") — revisit only if asked again.
- **Outlook calendar sync was removed** (previously a one-way ICS-link sync,
  `server/outlook.ts` + `Settings`/`syncOutlook` in `AppContext.tsx`) when the
  calendar was rewritten to adopt Replit's Day/Week/Month design — removed by
  explicit request rather than merged forward. If it's wanted again, it needs
  to be re-added on top of the new `endTime`-based Event schema (the old
  `node-ical`-based sync code assumed `durationMinutes`, so it can't just be
  restored as-is).
- No automated backups of `server/data/db.json` beyond whatever the Pi's own
  disk/backup setup provides.
