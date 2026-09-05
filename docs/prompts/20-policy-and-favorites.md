# Claude Code — Prompt 20: refresh reliability, home nav, window policy, off-service, favorites

**Venue:** Claude Code in VS Code, laptop, `C:\Users\jlull\Joe's Projects\Apps - Personal\MySports`.
**Mode:** unattended rails. Self-committing stages. Retry once, then log-and-skip.
**No migration. No DML. No writer credential.** Reads over PostgREST with the publishable anon key are the app's normal read path and are expected; a **direct Postgres connection** is the hard stop.

Implements **D2**, **D4**, **D6** and spec **E3** from `docs/feature-study/05-home-page-decisions.md`. **The time-adaptive band, the ≥1,600 px desktop composition and E10 empty-state copy are prompt 21 and are out of scope here.**

---

## Preconditions — verify first, hard stop if any is false

1. Branch `main`; `git rev-parse --short HEAD` == `99ea3c5`.
2. `python -m unittest discover tests` → **161 tests OK (skipped=1)**. `cd web && npm run test:unit` → **32/32**. `npm run smoke` → **29/30**, the known `generated_grids` bare-key failure only.
3. Tree clean apart from untracked `assets/` and `artifacts/`.

## Working rules (binding)

1. Certify Python for Windows: no `%`-strftime, explicit `encoding=`, ASCII console output.
2. Secret gate every commit, ADDED lines only: `git diff -U0 --cached | grep "^+"`. Never `findstr`.
3. Stage by explicit path. Never `git add -A`.
4. Each stage commits and pushes on its own; report the `rev-parse` pair.
5. **Do not run `npm ci`**, do not install `@next/swc-wasm-nodejs`, do not set `experimental.useWasmBinary`. Use the existing `node_modules`. If `next build` fails on the SWC Application Control block, log it and let the Vercel preview build produce the route table.
6. `npm run test:unit` is `node --test "test/**/*.test.mjs"` — quoted glob.
7. **Color tokens are read from `web/app/globals.css`, never quoted from the mockups.** The mockups use `--ground`; the app has no such token and calls the same `#1b1b1b` **`--spot-2`**.
8. **Do not modify `web/components/MatchupCard.js`.** The listings card is locked (contract v1.6.4 + Mobile Grid Addendum v1.0). Everything this prompt adds lives around the card, never inside it.
9. Name every bend in the judgment log. Never bend silently.

---

## Stage 1 — Reliability gate (do this before any feature work)

`schedule_refresh` ran 4 times in the last 14 days and **3 failed**. Now that live scores come from the overlay, the daily refresh owns everything else — schedules, broadcasts, finals — so a failing refresh means a stale slate on NFL Sunday. **This stage gates the rest of the prompt.**

1. Report the **last 10 `schedule_refresh` runs**: run number, date, conclusion, and for each failure the failing step and the actual error line.
2. **Diagnose run `33645776411`** specifically — it failed in the "Load fixtures into `mysports.*`" step and no one knows why. Read the log and **name the cause**. Do **not** fix it blind; if the cause is a real defect, describe it and propose the fix in the report rather than implementing it here.
3. **Restore the retry's patience in `adapters/common.py` `http_json`.** Prompt 19 specified 2 attempts and a flat 2 s backoff; that was written without knowing the helper already did **3 attempts with escalating 1.5 s then 3.0 s**, so following it made the helper *less* resilient. Put **3 attempts and the escalating 1.5 s / 3.0 s backoff** back. **Keep all three of prompt 19's corrections:** catch bare `ConnectionResetError` and `TimeoutError` (a mid-body reset is not a `URLError` — that gap is why the old retry could never have caught the observed failure), log every retry, never retry a 4xx. **429 stays non-retryable but must be logged on its own distinct line**, not lumped with other 4xx, so that if one ever appears we see it — the answer to a 429 is to slow the overlay, never to retry harder. Update the retry tests.
4. **HARD STOP condition:** if the three most recent runs are not green, or if the `33645776411` cause is something that will recur on the next run, **stop after committing this stage** and report. Do not build features on top of a pipeline that is not feeding them.

Commit: `fix(adapters): restore 3-attempt escalating backoff; distinct 429 logging`. Push, report the pair.

## Stage 2 — Home navigation (fixes the standalone dead end)

With `display: "standalone"` there is no address bar and no back button. `web/components/Chrome.js` renders `<Banner/>` on `/` and `<NavBanner/>` everywhere else — and `Banner.js` has **no navigation links** (its only `href`s are SVG `<image>` sources). So the installed app opens on Today and cannot reach Weeks or History at all.

1. Extract the primary link list and its markup out of `NavBanner.js` into a small shared component (`web/components/PrimaryNav.js` or similar) so **one definition** serves both. `NavBanner` keeps its current appearance exactly.
2. Render that nav on the home route as well — beneath the full banner, in the banner's own visual language. Do not restyle `Banner.js`'s SVG; this is a row added under it.
3. Keep `display: "standalone"` in `web/app/manifest.js`.
4. **Prove it:** report that from `/` both `/weeks` and `/history` are reachable, and from each of those `/` is reachable, with no browser chrome. State how you verified it.

Commit: `fix(web): primary navigation on the home route so the installed app is not a dead end`. Push, report the pair.

## Stage 3 — Prime window policy (D2)

1. Add `prime_window_start` to each sport in `data/render_policies.json`: **`nfl` "13:00", `cfb` "12:00", `nhl`/`nba`/`mlb` "18:00"** — local ET, 24-hour. Extend the file's `_about` string to document the key. **Do not restructure the file** — rendering-contract v1.7 will touch it for the `open_ended` reconciliation and the two changes must not fight.
2. Add a pure helper (`web/lib/primewindow.js`): given a day's games and the policy, return `{ opensAt, closesAt, sports }` where **`opensAt` is the earliest `prime_window_start` among the sports that actually have a game that day**, and `closesAt` is the last program end (kickoff + that sport's `block_minutes`). No games that day → return null, not a default window.
3. Unit tests under `web/test/`: a CFB Saturday opens at 12:00, an NFL Sunday at 13:00, a weeknight at 18:00, a mixed day takes the earliest, an empty day returns null.
4. Nothing consumes this yet — prompt 21's band does. That is deliberate; ship the policy settled and tested so the band prompt is pure layout.

Commit: `feat: per-sport prime_window_start policy and window helper (D2)`. Push, report the pair.

## Stage 4 — Off-service games (D4 / E3) — READ the eligibility, do not recompute it

**`mysports.viewer_game_eligibility` already exists.** It is written by `pipeline/reconcile.py` (see its eligibility block: active broadcasts whose `access_status` is in the profile's eligible set and whose `blackout_rule` is not `OUT_OF_MARKET`), it carries `eligible`, `eligible_via_network_id`, `eligible_via_service_ids` and `reason`, and migration `0005`'s `anon_read` loop makes it readable by the anon key.

1. **Read that table. Do not implement a second eligibility rule in JavaScript.** A JS reimplementation would drift from the reconciler and from the renderer's "not on your services" count within a month.
2. **Before building anything on it, report its row counts** for the loaded days (at minimum 2026-09-03, 2026-09-05, 2026-09-13). **If it is empty or covers only a fraction of loaded games, STOP and report** — that means the reconciler has not run over this data, and the honest answer is to fix that, not to fall back to a JS rule.
3. Add the read to `web/lib/queries.js` (every read the app makes lives in that one file, by construction) and join it onto games by `game_id`.
4. **Behavior, on every listing surface — Today, `/weeks`, `/history`:** ineligible games are **filtered out by default**; a count line states the totals and names the outlets, e.g. `62 games · 8 not on your services · ACC Network, NFL+`; a **"show all" toggle** reveals them. The count line is not optional — without it the page lies by omission.
5. Revealed ineligible rows are dimmed via a **wrapper class**, never by touching `MatchupCard.js`.
6. Tests for the count/label derivation.

Commit: `feat(web): off-service filtering with count line and show-all, read from viewer_game_eligibility (D4/E3)`. Push, report the pair.

## Stage 5 — Favorites (D6)

Create `data/favorites.json` holding **team ids, not names**, resolved once from this list. **Print the full resolution table in the report** — every name, the id it resolved to, and the row's canonical name — so Joe can verify it.

| Sport | Teams |
|---|---|
| NFL | Cleveland Browns · Carolina Panthers |
| MLB | Cleveland Guardians |
| NBA | Cleveland Cavaliers |
| NHL | Columbus Blue Jackets · Vegas Golden Knights · Pittsburgh Penguins |
| CFB | Ohio State · LSU · Ole Miss · Tennessee · Ohio (Bobcats) · Fresno State |

**Resolution traps — all four are hard stops if they cannot be resolved unambiguously:**

- **"Ohio" is Ohio University (Bobcats, MAC), a different school from Ohio State.** Assert both rows exist, that they are distinct ids, and that neither name matched by substring.
- **"Panthers" is the Carolina Panthers (NFL). The Florida Panthers (NHL) must not be selected.** Resolve within sport, always.
- **"Ole Miss" may be filed by CFBD as "Mississippi".** Resolve it, report which name matched, and do not confuse it with Mississippi State.
- **"Tennessee" is the Volunteers** — not Tennessee State, Middle Tennessee, or Tennessee Tech, and not the Titans.

Resolve by **exact match on the canonical name within the sport**, never by substring or fuzzy match. Team ids follow the existing convention: `nfl-{espnId}`, `mlb-{id}`, `nba-{TRICODE}`, `nhl-{nhlId}`, CFB bare CFBD ints. (Note: those are **team** ids — game ids differ, and NBA game ids are `nba-{espnEventId}`.)

**Behavior:** inside each sport band, games involving a favorite float to the top. **Floated rows keep chronological order among themselves**, and the rest of the band keeps chronological order below them — the band never stops reading as a timeline. The floated group is separated by a hairline rule with a faint uppercase **"YOUR TEAMS"** micro-label. **That label and rule live at band level, never on the card** — the card contract stays closed. The list is a settings file, editable without a code change.

Commit: `feat(web): favorites float to the top of their sport band (D6)`. Push, report the pair.

## Stage 6 — NBA game-id guard

`adapters/nba.py` carries **two** game-id schemes: the ESPN path emits `nba-{espnEventId}` (what the database holds, and what the overlay joins against) and the `cdn.nba.com` league-file path emits `nba-{nbaGameId}`. Loading NBA from the league file later would silently break the overlay join with no error.

Add a test that asserts the two paths agree, or — if they cannot — that fails loudly with a message naming this divergence, plus a comment in `adapters/nba.py` at both id sites pointing at the other one. Say in the report which of the two you did and why.

Commit: `test(adapters): guard the NBA game-id divergence between the ESPN and league-file paths`. Push, report the pair.

## Stage 7 — Report

1. `git rev-parse --short HEAD` / `origin/main` — must match.
2. Commit chain, one line each.
3. **Stage 1: the ten-run table, the `33645776411` diagnosis, and whether the gate passed.**
4. **Stage 2: how you verified the navigation, in both directions.**
5. **Stage 4: the `viewer_game_eligibility` row counts per loaded day**, and the count line as it renders for 2026-09-05.
6. **Stage 5: the full favorites resolution table**, all thirteen, with the four traps called out explicitly.
7. Test counts: Python, `test:unit`, `smoke`.
8. **Judgment log** — every decision this prompt did not spell out, and every bend, with reasons.

## Hard stops

1. Secret gate trips.
2. Push rejected.
3. **Stage 1's gate fails** — the last three runs are not green, or `33645776411`'s cause will recur.
4. **`viewer_game_eligibility` is empty or substantially incomplete** for the loaded days.
5. Any favorite name cannot be resolved unambiguously within its sport.
6. A **direct Postgres connection** is opened, or any write is attempted.
7. `MatchupCard.js` would need to change.

## Explicitly out of scope — prompt 21 owns these

- The time-adaptive band and its three states; the "See all today" escape; the header that states the viewing day and the clock it used.
- **The E2/E6 derivation must be written exactly once** and be importable by renderer v1.7's §11.9 "Tonight" line — that is prompt 21's design problem, not a thing to half-start here.
- The ≥1,600 px desktop composition.
- E10 empty-state copy.
- E5 market-pending (still unruled; due before September 13).
- The grid "now" marker and the `generated_grids` bare-key fix — both ride rendering-contract v1.7.
