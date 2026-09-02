# MySports — web app

Milestone 4 part 1: the production app skeleton. It reads the **live** `mysports` schema over the
anon (read-only) Supabase REST API and renders three routes. **Nothing is deployed** — this is a
locally-building app, committed, with real data behind it.

## Run it

```bash
cd web
npm install
npm run dev          # http://localhost:3000
```

```bash
npm run build        # production build; must complete with no errors
npm run start        # serve the production build
npm run smoke        # assert the data contract against the live database (13 checks)
```

There is no `npm run lint`: the scaffold was written by hand rather than generated, and adding
ESLint would have meant ~40 packages against the "keep the dependency tree minimal" rail. The whole
tree is **20 packages** — `next`, `react`, `react-dom` and their transitive deps, nothing else.

## Where the config lives

[`lib/config.js`](lib/config.js) — every value has a committed default, so a clean checkout builds
and runs with no secret provisioning. Override through `web/.env.local` (copy
[`.env.local.example`](.env.local.example)).

| Value | Default | Why it is safe to commit |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://ztnppejmdwmhqstqsfks.supabase.co` | Public endpoint. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the anon JWT | Publishable. Its only claim is `role=anon`; it can read exactly what an RLS policy grants anon `SELECT` on, and it can write nothing. |
| `NEXT_PUBLIC_SUPABASE_SCHEMA` | `mysports` | Sent as the PostgREST `Accept-Profile` header. |
| `NEXT_PUBLIC_ASSET_BASE_URL` | the public R2 base | Public bucket. |

The **writer** DSN (`SUPABASE_DB_URL`) and the R2 credentials live in the repo-root `.env` and never
come near this app. Nothing here can write to the database.

### Two things worth knowing about the data boundary

- `source_observations` and `refresh_runs` are **intentionally unreadable** by anon (the evidence
  trail and the run log). `npm run smoke` asserts they still return 401 — if a page ever starts
  wanting one of them, that is a design conversation, not a policy change.
- R2 object keys are **lowercased on upload** by `scripts/sync_assets.py`. NBA team ids are uppercase
  abbreviations (`nba-CLE`), so a logo URL built from the raw id 404s. `teamLogoUrl()` lowercases;
  do not build these URLs by hand.

## Routes

| Route | What it shows |
| --- | --- |
| `/` **Today** | One viewing day, with a date picker and a sport filter. Time in ET, away @ home with each team's colour as the card seam, network name, TBD/Final/Live state, final scores. When `generated_grids` has a row for the selected (sport, day), the newest archived grid SVG is shown from R2 above the listing. |
| `/weeks` **Weeks** | The two-week-concept model as day-column **listings** — never a grid. Calendar view: ISO Monday–Sunday over `viewing_day`, all sports. Season view: NFL/CFB provider week labels, each with its span **derived** from the games carrying that label. |
| `/history` **History** | `result_status = 'final'` newest first, with scores and a search box (team or network). Each card is a whole-card link to `boxscore_url`, opened in a new tab; the raw URL is never displayed. |

`viewing_day` — not `game_date` — is the day bucket everywhere, because the pipeline buckets on the
03:00 ET cutover: a game that tips at 10:40pm and ends after midnight belongs to the night you sat
down to watch it.

## How it is built

- **Next.js 15.5.24, App Router, plain JavaScript.** Not TypeScript: the repo is otherwise plain
  Python with no build-time type layer, and TS would have added `typescript` + `@types/*` for a
  three-route skeleton. 15.5 rather than 16 is the settled line; `15.5.24` specifically because
  `15.5.4` carries CVE-2025-66478.
- **Server-side data fetching only.** Every page is a Server Component; the anon key never has to
  ship to the browser even though it would be harmless if it did. The three client components
  (`Nav`, and the filter/search inputs) only rewrite the query string and let the server re-fetch.
- **`export const dynamic = 'force-dynamic'`** on all three routes. These pages read live data, so
  they are rendered per request and `npm run build` stays hermetic — it never needs the database.
- **No UI libraries.** One hand-written stylesheet on the grid palette.

## Stubbed / deliberately not done

- **Visual design.** The chrome is structural only — spacing, hierarchy, legibility. Joe's approved
  prototype design gets applied in a later pass, so components are kept clean and unstyled-simple
  rather than guessing at polish.
- **No deployment.** No Vercel project, no domain, no CI. Deliberate.
- **Network logos are not rendered** — the network *name* is. Most team-specific RSNs
  (`mariners-tv`, `detroit-sportsnet`) have no mark in `assets/network-logos/`, and a wall of broken
  images is worse than text.
- **No viewer personalisation.** `viewer_game_eligibility` / `viewer_profiles` are readable but
  unused; the app currently shows every game rather than filtering to Joe's services. The renderer's
  market filter is the model to follow when this is picked up.
- **No caching strategy.** Every read is `cache: 'no-store'`. Correct for a skeleton with no traffic;
  revisit per route when there is something to reason about.
- **Search is client-of-the-server side** — `/history` fetches the finals (200 max) and filters in
  the request. Fine at 20 rows; becomes a `or=(...)ilike` query when the archive is real.

## Files

```
web/
  app/
    layout.js            masthead, nav, footnote
    globals.css          the whole stylesheet
    page.js              /          Today
    weeks/page.js        /weeks     Weeks
    history/page.js      /history   History
  components/
    Nav.js               client: active-route nav
    Filters.js           client: date picker, sport chips, search box
    GameCard.js          server: one game; optionally a whole-card link
    DayColumn.js         server: one day of a week, as a listing
  lib/
    config.js            endpoints, keys, sport lists, asset URL builders
    rest.js              the only place this app talks to PostgREST
    queries.js           every read the app makes
    weeks.js             the two-week-concept model (pure date arithmetic)
    format.js            ET times, day labels, score/state display
  scripts/
    smoke.mjs            13 assertions against the live database
```

See `docs/app-skeleton.md` at the repo root for the route → query contract.
