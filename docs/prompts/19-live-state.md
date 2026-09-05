# Claude Code — Prompt 19: live score overlay + card state model (E1/E4)

**Venue:** Claude Code in VS Code, on the laptop, against `C:\Users\jlull\Joe's Projects\Apps - Personal\MySports`.
**Mode:** unattended rails. Self-committing stages. Retry once, then log-and-skip. Hard stops only for the conditions in §Hard stops.
**Writes NO data to the database.** Schema unchanged, no migration, no DML. The app gains a *read* path to the providers; nothing it fetches is persisted.

This implements the amended decision **D3** and spec **E1**/**E4** from `docs/feature-study/05-home-page-decisions.md` (§6 carries the amendment — read it before starting), and wires the locked app icon up for iOS "Add to Home Screen". The home page's layout, the time-adaptive band, access counts, favorites and the desktop breakpoint are **prompt 20** and are out of scope here.

---

## Preconditions — verify first, hard stop if any is false

1. Branch `main`; `git rev-parse --short HEAD` == `b274ee5`.
2. `python -m unittest discover tests` reports **147 tests green**; `cd web && npm run smoke` reports **29/30** (the known `generated_grids` bare-key failure is the only one).
3. Working tree: **modified** `docs/feature-study/05-home-page-decisions.md` (Cowork appended §6 and §7 after it was committed). Untracked and ignored: `assets/`, `artifacts/`. Nothing else.
4. `web/app/api/egress-probe/route.js` exists and `https://my-sports-xi.vercel.app/api/egress-probe` returns four `200`s. That result is the premise of this whole prompt.

## Working rules (binding)

1. Certify Python for Windows: no `%`-strftime, explicit `encoding=` on every `open()`, ASCII-only console output.
2. Secret gate **every** commit, scoped to **ADDED lines only**: `git diff -U0 --cached | grep "^+"`. **Never `findstr`.**
3. Stage by explicit path. Never `git add -A`.
4. Every stage commits and pushes on its own and reports the `rev-parse` pair.
5. **Never write to the database.** If you find yourself opening a connection, you are off-script — stop and report.
6. Name every bend in the judgment log. Never bend silently.
7. `npm ci` currently breaks `next build` on this laptop (Windows Application Control blocks the re-extracted SWC binary). **Do not run `npm ci`, do not install `@next/swc-wasm-nodejs`, and do not set `experimental.useWasmBinary`.** Use the existing `node_modules`. If `next build` fails for that reason anyway, log it and rely on the Vercel preview build for the route table.

---

## Stage 1 — Land the pending doc, and harden the NHL fetch

1. Commit the modified `docs/feature-study/05-home-page-decisions.md` (Cowork's §6 D3 amendment and §7 deployment facts). Stage that path alone.
2. **Check before coding.** Open the GitHub Actions run history for `schedule_refresh` and report: how many runs in the last 14 days failed, and how many failed inside the **NHL** step specifically. Paste the run numbers. This decides whether the next item is insurance or a fix.
3. Add a **bounded retry** to the shared HTTP helper in `adapters/common.py` (`http_json`, or whichever function every adapter's fetch goes through — name it in the report): **2 attempts total, 2-second backoff between them**, retrying only on connection-level failures (`URLError`, `ConnectionResetError`, socket timeout) and on HTTP `5xx`. **Never retry a 4xx** — a 403 is Akamai's answer, not a blip, and retrying it makes the bot score worse. Emit one ASCII warning line per retry naming the host and the reason.

   Why this matters and why it is in scope: `.github/workflows/schedule_refresh.yml` ends the NHL, NBA and MLB "yesterday" steps with `|| exit 1`, so a single transient reset aborts the entire daily refresh *and* the render chained behind it. `api-web.nhle.com` reset on roughly half of all attempts from this laptop on 2026-09-03 while answering cleanly from Vercel.
4. Add a unit test for the retry (monkeypatch the opener; assert two attempts on a reset, one attempt on a 404, and that the backoff is not slept in the test).
5. Commit: `fix(adapters): bounded retry on connection failures and 5xx; land the D3 amendment`. Push. Report the rev-parse pair.

## Stage 2 — Put the provider fixtures in the repo

`tests/test_scores.py` reads its raw provider snapshots from `artifacts/validation/*_raw.json`, and `artifacts/` is gitignored. **The suite therefore does not pass on a clean checkout** — it passes on this laptop because those files happen to exist. Fix that, because Stage 3's tests need the same snapshots.

1. Create `tests/fixtures/` (tracked).
2. Copy in the smallest set of raw snapshots that exercises every adapter mapper `tests/test_scores.py` currently covers — at minimum one each for ESPN (NFL or CFB), NBA, NHL and MLB. Keep names explicit: `espn_nfl_scoreboard_raw.json`, `nhl_schedule_raw.json`, and so on.
3. **Report the total size.** If it exceeds ~3 MB, say so and stop rather than committing it — we will decide together whether to trim.
4. Repoint `tests/test_scores.py` at `tests/fixtures/`. **One source, no fallback** — do not leave a "use artifacts/ if present" branch, because a fallback is how the reproducibility hole reappears.
5. Confirm the suite still reports 147 green, and confirm it by checking that the fixture path resolves relative to the test file, not the working directory.
6. Commit: `test: track provider snapshots in tests/fixtures so the suite runs on a clean checkout`. Push. Report the rev-parse pair.

## Stage 3 — The live-score overlay (`web/lib/livescores.js`)

A **read-only** module. It fetches current game state from the providers, returns a small overlay object per game, and **never writes anything anywhere.**

**Scope — it reads exactly three things per game: state, score, and clock/period.** It is not a second adapter. It does not touch teams, venues, broadcasts, odds, records, or reconciliation. Everything else on the page still comes from the database.

Requirements:

- **Mirror the Python mapping, don't reinvent it.** Port `result_status()` and `score_int()` from `adapters/common.py` exactly, including their behavior: POSTPONE/CANCEL in the detail string wins over state; an unrecognized state maps to **null with a warning, never to `final`**; scores are null unless status is `in_progress` or `final`. A wrong `final` is the specific failure this mapping exists to prevent.
- **Per-sport readers.** `cfb`, `nfl` and `nba` share the ESPN scoreboard shape — write that reader once. `nhl` (`api-web.nhle.com`) and `mlb` (`statsapi`) get their own. Each returns `{ gameId, status, homeScore, awayScore, clock, period }`, where `clock` and `period` are the provider's display strings (ESPN `status.displayClock` and `status.period`) or null.
- **Id mapping.** Overlay rows join to `games.id` using the same namespacing the adapters use (`nfl-{espnId}`, `nhl-{nhlId}`, `mlb-{id}`, `nba-{TRICODE}`, CFB bare CFBD ints). Report how many rows joined and how many did not for the day you test.
- **Caching.** Use Next's fetch cache with `next: { revalidate: 60 }`. Rapid reloads must share one upstream call.
- **Only fetch when it can matter.** Skip the fetch entirely when the requested day is not today, and skip any sport with no game on that day whose scheduled window could plausibly be live. Never fetch on the History page or on a past date.
- **Fail open, always.** Any provider error, timeout, or malformed payload returns *no overlay for that sport* and logs one line. **A provider being down must never blank a card, throw, or fail the page render.** The page always renders from the database; the overlay is additive.
- **Honest UA.** Send the same `MySports-adapters/0.1 (+https://github.com/MindLane-NorthStar/MySports)` string `adapters/common.py` uses. **Never a browser UA** — a half-disguise scores worse with Akamai than an honest bot UA, measured on the runner 2026-09-03.

**Tests.** Add `web/test/livescores.test.mjs` run with Node's built-in runner — add `"test:unit": "node --test test/"` to `web/package.json`. **No new dependencies.** The tests read `tests/fixtures/` from Stage 2, so the JavaScript overlay and the Python adapters are asserted against the identical bytes. Cover at minimum: a scheduled game yields null scores; an in-progress game yields integer scores plus a clock; a final game yields `final`; an unrecognized state yields null and warns; a postponed detail string wins over its state.

Commit: `feat(web): live score overlay, read-only, tested against the adapters' own fixtures`. Push. Report the rev-parse pair.

## Stage 4 — Wire it in (E1 card state, E4 data-as-of)

1. In the Today page's server render, merge the overlay onto the games array **after** the database read. Database values stay authoritative for everything the overlay does not carry.
2. **Card state.** `web/components/MatchupCard.js` already renders a score and a state pill with `data-tone` of `final` / `live` / `sched`. Extend the **existing** pill only:
   - `in_progress` → the pill shows the provider's clock and period (`Q2 7:12`, `T3 04:11`, `B4`) **in place of the word it shows today**. Same element, same type, same tone.
   - `final` and `scheduled` are unchanged.
   - **Do not add a new element to the card, and do not change its grid, spacing, or anatomy.** The listings card is locked (contract v1.6.4 + Mobile Grid Addendum v1.0). This is a text substitution inside an element that already exists. Cowork made that call; Joe reviews it on the preview URL and may veto it.
3. **E4 "data as of".** One quiet line at the foot of the listing: the database's own freshness plus, when an overlay is present, the overlay's fetch time. Wording is yours; it must state *which* time it is showing and must never imply live data when the overlay was skipped or failed.
4. `cd web && npm run build` if it runs; report the route table if you get one. If the SWC block prevents it, say so and skip — the Vercel preview build will produce the table.

Commit: `feat(web): card state model with live clock (E1) and data-as-of line (E4)`. Push. Report the rev-parse pair.

## Stage 5 — iOS home-screen install (app icon, label, manifest)

Today, adding the site to an iOS home screen produces a screenshot of the page instead of an icon, because no `apple-touch-icon` is declared. Fix that.

**Source art:** `web/public/brand/app-icon-mysports-tv.png` — 1024×1024, RGB, **no alpha channel**. That matters: iOS composites transparency onto black, and this master has none, so there is nothing to flatten. It is the **locked v6-B icon**. Resize only. **Do not restyle, recolor, re-letter, re-crop or pad the artwork.**

1. Generate with Pillow (LANCZOS) from the 1024 master, writing RGB with no alpha channel:
   - `web/app/apple-icon.png` — **180×180** (iOS covers every device size from this one).
   - `web/app/icon.png` — **48×48** (browser tab).
   - `web/public/icon-192.png` and `web/public/icon-512.png` (manifest).

   Next's App Router file conventions serve and link `app/icon.png` and `app/apple-icon.png` automatically. **Do not hand-write `<link rel="apple-touch-icon">` into `layout.js`** — if you are adding one, the file is in the wrong place.

2. **iOS masks the icon to a squircle and clips its corners.** Before committing, write a proof into `artifacts/qa/2026-09-03-appicon/`: the flat 180×180, and the same image with an iOS-style superellipse mask applied, shown on both a white and a black page background. **Report whether the mask clips any of the locked artwork** — the wordmark, the gold-fade title, the suite contour. **If anything is clipped, do not fix it by rescaling, padding or redrawing. Report it and stop this stage.** A padded variant reopens a locked design and is Joe's decision, not an implementation detail.

3. Home-screen label: add `appleWebApp: { title: 'MySports TV' }` to the `metadata` export in `web/app/layout.js`. iOS truncates the label around 12 characters; "MySports TV" is 11.

4. Web app manifest at `web/app/manifest.js` (Next's route convention): `name` "MySports TV", `short_name` "MySports", `start_url` `/`, `background_color` and `theme_color` `#1B1B1B` (the locked `--ground` token — take it from `globals.css`, do not retype a hex you did not read), `display: "standalone"`, and the 192/512 icons with `purpose: "any"`.

5. **`display: "standalone"` is Cowork's call and Joe may veto it.** It removes Safari's chrome, which is the app feel he asked for, but it also removes the address bar and the browser back button, so the app's own navigation has to carry every route. **Report whether every route is reachable and escapable from inside the app itself** — masthead to Today / Weeks / History, and the game detail panel's dismiss. If any route is a dead end without a browser back button, say so plainly; the revert is one line, `display: "browser"`.

6. Note for the report: iOS caches `apple-touch-icon` aggressively. If Joe had already added the site to his home screen before this ships, he must delete that home-screen entry and re-add it to see the icon.

Commit: `feat(web): iOS home-screen icon, app label and web manifest`. Push. Report the rev-parse pair.

## Stage 6 — Report

1. Final `git rev-parse --short HEAD` / `origin/main` — they must match.
2. The commit chain, one line each.
3. **Stage 1's Actions history numbers**, verbatim.
4. **Stage 2's fixture list and total size.**
5. **Stage 3's join report:** rows returned per sport, rows joined to a `games.id`, rows that did not join. A large no-join count is a real finding, not noise.
6. `npm run test:unit` output; `npm run smoke` count; `python -m unittest discover tests` count.
7. **Stage 5's mask-clipping verdict**, and the standalone-navigation finding. Name the proof files written.
8. **Judgment log** — every decision this prompt did not spell out, and every bend, with reasons. "No bends" if none.

## Hard stops

1. The secret gate trips on any staged diff.
2. A push is rejected.
3. `tests/fixtures/` would exceed ~3 MB.
4. Any database connection is opened.
5. The overlay cannot be made to fail open — that is, any path exists where a provider failure throws into the page render.

## Explicitly out of scope — prompt 20 owns these

- The time-adaptive band and its three states; `prime_window_start` in `data/render_policies.json`.
- E3 access glyph, off-services count line, and the show-all toggle.
- `data/favorites.json`, the favorites float, and the band-level "YOUR TEAMS" label.
- The ≥1,600 px desktop composition.
- E5 market-pending (still unruled).
- The grid "now" marker and the `generated_grids` bare-key fix — both ride rendering-contract v1.7.
- Any change to the card's anatomy beyond the pill text substitution in Stage 4.
