# Suivi Flotte Ranger

French-language web app for tracking the refurbishment of a fleet of Ford Ranger vehicles at an auto body shop ("MZ Automotive"). The UI is a single-file HTML/CSS/vanilla-JS app (no build step, no framework), now served by a small Express + PostgreSQL backend for real persistence.

## Project layout

- `suivi_flotte_ranger_1.html` — original standalone file, kept as-is/untouched.
- `frontend/index.html` — the app wrapped in a full HTML document, with a small `window.storage` shim added that talks to the backend instead of a host-provided storage API. This is the file actually served.
- `backend/` — Express server + PostgreSQL schema.

## Status

Live at https://renger-fleet.onrender.com — web service on Render, database on [Neon](https://neon.tech) (Render's own free Postgres tier expires ~30 days after creation and gets deleted, so the database was moved to Neon's free tier, which doesn't expire). Verified end-to-end in production: a write survives a full server restart, and both the raw storage API and the app's actual save/load shape (whole-state JSON blob + a photo entry) round-trip correctly.

Code: on Render, the `renger-fleet` web service (root dir `backend`) auto-deploys from this repo's `main` branch. `DATABASE_URL` in its Environment tab points at the Neon connection string — that's the one thing to update if the database ever moves again.

## Running locally

Requires Node.js (already installed). For a database, the easiest path is the bundled dev Postgres — a self-contained binary, no install/root needed:

```bash
cd backend
npm install
npm run dev:db             # starts a local Postgres on :5433, first run initializes it — leave running in this terminal
```

In a second terminal:

```bash
cd backend
cp .env.example .env       # then edit: PGSSL=false, DATABASE_URL=postgres://postgres:password@localhost:5433/ranger_fleet
npm start                  # applies the schema automatically, then serves the app + API on http://localhost:3000
```

Data persists across restarts under `backend/.pgdata` (gitignored). This local Postgres is dev-only — `.env.example`'s defaults (`PGSSL=true`, port 5432) are aimed at a real hosted Postgres for production; override them as above just for local runs.

## How persistence works

The original app already called an async `window.storage.get(key, personal) / .set(key, value) / .delete(key)` API — it just expected some host environment to provide it. The backend replaces that with:

- One Postgres table, `kv_store (key TEXT PRIMARY KEY, value TEXT, updated_at TIMESTAMPTZ)`.
- Three routes: `GET/PUT/DELETE /api/storage/:key`.
- A shim in `frontend/index.html` that implements the same `window.storage` interface via `fetch()` calls to those routes.
- The server applies the schema itself on every startup (`CREATE TABLE IF NOT EXISTS`, so it's a no-op once the table exists) — no separate migration step needed, which matters since Render's free tier has no Shell access to run one manually.

Everything else in the 2000+ line app script — state shape, rendering, migrations between schema versions — is untouched. The app still stores its whole state as one JSON blob (key `ranger-fleet-state-v4`) plus one row per photo (key `photo-<id>`, a compressed base64 JPEG data URL). This is intentionally simple rather than a fully relational schema: fine for one shop's data volume and a small number of concurrent editors, at the cost of "last write wins" if two people save changes to the *whole state* at the exact same moment (per-checkbox/per-field edits are frequent though, so the window for a real clash is small).

## Deploying (cloud-hosted)

Any host that runs Node + gives you a Postgres instance works (Render, Railway, Fly.io, etc). This is the one part that needs your own account — nothing further to build on this end once you have a connection string. On Render, for example:

1. Sign up / log in at render.com.
2. **New → PostgreSQL** — name it (e.g. `ranger-fleet-db`), pick the free tier, create it. Once ready, copy its connection string (Internal Database URL if the web service will also be on Render, External otherwise).
3. **New → Web Service** — connect this repo, set **Root Directory** to `backend`, **Build Command** to `npm install`, **Start Command** to `npm start`.
4. In the service's **Environment** tab, set `DATABASE_URL` to the connection string from step 2 (leave `PGSSL` unset — it defaults to `true`, which is correct for hosted Postgres). `PORT` is set automatically by Render.
5. Deploy. The app applies its own schema on startup — no migration step to run manually.
6. Visit the deployed URL — the app now persists through the real hosted Postgres.

## Original single-file version

## What it does

It's a **fleet refurbishment tracker** organized into 4 views, switchable via a tab bar:

1. **Overview** — cards per "marché" (project/market), each showing vehicle count, % progress, average quality rating, and total cost (variable + fixed), plus a grand total across all projects.

2. **Project view** (per marché) — the core view. Each project has:
   - A list of **vehicles** (ref, chassis number, current situation/notes), searchable and filterable (All / Done / In progress / Not started).
   - Each vehicle card expands to show a checklist of **task types** (default: Peinture, Gyophare, Strobo, Attelage, Balisage, Hardtop — fully customizable per project, each with a color), where each task can be marked done, star-rated (quality), assigned to an employee, timestamped, and photographed.
   - **Products/parts used** per vehicle, with quantity × price feeding a variable cost.
   - **Fixed costs** section (rent, misc charges) per project.
   - **Project dossier**: start date, deadline (with an overdue/on-track badge), free-text info/remarks.

3. **Team view** — employee roster; each employee has periodic "bilans" (performance reports) with star ratings, feeding an average team rating.

4. **Stock view** — parts/inventory list (name, qty, unit, unit price, min qty) with low-stock highlighting and total stock value.

5. **Daily log view** — free-form dated entries ("bilans journaliers"), optionally with author and photos.

## Notable mechanics

- **Two roles**: "Vue Atelier" (workshop, default — progress & supplies only) vs "Vue Direction" (management — unlocks costs, team ratings, reset button), gated by a hardcoded PIN (`2026`) in the script. The role is kept in memory only, resetting to Atelier on every reload.
- **Persistence**: state is saved via a `window.storage` async key/value API (get/set/delete) under versioned keys (`ranger-fleet-state-v2` → `v4`), with migration functions for older schema versions. Photos are stored separately per-id and compressed client-side before saving.
- **No backend/network calls** — everything runs client-side against this `window.storage` host API (likely injected by whatever shell/webview embeds this HTML — not defined in the file itself).
- Default seed data ships with 21 real-looking vehicles (R1–R21) with actual chassis numbers and repair situations already filled in — this looks like a real, in-use operational tool rather than a demo/template.

## Structure

- Lines 1–286: `<style>` block (dark amber/charcoal theme, Oswald/Inter/JetBrains Mono fonts).
- Lines ~259–280: static header markup (logo, title, role/edit buttons, tabs container).
- Lines 286–2110: single IIFE `<script>` containing all state, rendering (vanilla DOM, no framework), and event wiring; entry point is `init()` at the bottom, calling `loadState()` then `renderAll()`.

## Caveat

The "Direction" PIN is a plaintext string in client-side JS (`DIRECTION_PIN = '2026'`) — trivially visible via view-source. This is fine as a soft UI gate for non-technical shop staff, but shouldn't be treated as real access control.
