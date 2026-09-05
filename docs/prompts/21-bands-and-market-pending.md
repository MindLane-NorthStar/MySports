# Claude Code — Prompt 21: per-sport bands and market-pending (E5)

**Venue:** Claude Code in VS Code, laptop, `C:\Users\jlull\Joe's Projects\Apps - Personal\MySports`.
**Mode:** unattended rails. Self-committing stages. Retry once, then log-and-skip.

**This prompt contains an ADDITIVE migration (0010) and Joe pre-authorizes applying it live**, under the standing rules: additive only, backup first, no destructive statement, SELECT-and-paste before anything that removes or rewrites data. **No column is dropped, no data is deleted.**

Implements **E5** from `docs/feature-study/05-home-page-decisions.md` §8, and builds the per-sport band structure that D6 assumed and the app does not have. **The time-adaptive band (D1/D1b), the ≥1,600 px desktop composition (D5) and E10 empty-state copy are prompt 22 and are out of scope.**

---

## Preconditions — verify first, hard stop if any is false

1. Branch `main`; `git rev-parse --short HEAD` == `65cfdf2`.
2. `python -m unittest discover tests` → **174 OK (skipped=1)**. `cd web && npm run test:unit` → **81/81**. `npm run smoke` → **29/30**.
3. Working tree carries two uncommitted `docs/` files written by Cowork — **modified** `docs/feature-study/05-home-page-decisions.md` (E5 added as §8) and **untracked** `docs/handoff-status.md` (this file moved into the repo; the project copy is now a mirror written from it). Both ride Stage 1.

## Working rules (binding)

1. Certify Python for Windows: no `%`-strftime, explicit `encoding=`, ASCII console output.
2. Secret gate every commit, ADDED lines only: `git diff -U0 --cached | grep "^+"`. Never `findstr`.
3. Stage by explicit path. Never `git add -A`.
4. Each stage commits and pushes on its own; report the `rev-parse` pair.
5. **Do not run `npm ci`**; never set `experimental.useWasmBinary`. Use the existing `node_modules`; if `next build` dies on the SWC Application Control block, log it and let the Vercel preview build produce the route table.
6. `npm run test:unit` is `node --test "test/**/*.test.mjs"` — quoted glob.
7. Color tokens come from `web/app/globals.css` — the page ground is **`--spot-2`**, not `--ground`.
8. **Do not modify `web/components/MatchupCard.js`.** The listings card is locked. Everything here lives around it.
9. **Edit JSON data files through a parser, never line-based**, and assert nothing but the intended keys changed.
10. Name every bend in the judgment log.

---

## Stage 1 — Land the pending docs

Commit the two `docs/` files named in precondition 3. Stage those paths alone.

Commit: `docs: E5 ruling in the decision record; move handoff-status into the repo`. Push, report the pair.

## Stage 2 — Characterize before you classify

**Do not write the market-pending rule until you have looked at the data it must classify.** Report, as tables:

1. For **every ineligible game on 2026-09-13** (11 of 13 per the last census): `games.id`, and for each of its `game_broadcasts` rows — `service_id`, `delivery_surface`, `feed_side`, `access_status`, `carriage_certainty`, `blackout_rule`, `market_id`, `active` — plus the `viewer_game_eligibility.reason` string.
2. The same for **2026-09-05** (CFB, 20 ineligible) so the NFL pattern can be told apart from the CFB one.
3. Row counts in **`market_coverage`** and **`markets`**, and which `market_id` represents Cleveland.
4. The distinct `viewer_game_eligibility.reason` strings across all loaded days, with counts.

State plainly, in the report, **what actually distinguishes a "we don't know yet" game from a "you genuinely cannot watch this" game in this data.** That sentence is the deliverable of this stage.

Commit nothing in this stage unless you wrote a throwaway script; delete it if so.

## Stage 3 — Migration 0010 and the reconciler

**Eligibility is computed in one place — `pipeline/reconcile.py`. Market-pending is computed there too.** Do not implement this rule in JavaScript; a second implementation would drift from the reconciler and from the renderer exactly as a JS eligibility rule would have.

1. **Migration `db/migrations/0010_market_pending.sql`, additive only:** add `market_pending boolean` (nullable, no default, so "never computed" stays distinguishable from "computed false") to `viewer_game_eligibility`. Nothing else. **Back up first** per the standing rule, and paste the backup confirmation into the report before applying.
2. **The rule lives in `data/authority_rules.json` under `eligibility`, not in code** — the same place `eligible_access` and `conditional_access` already live, so it is tunable without a commit. Express it from what Stage 2 found. The intended shape, which Stage 2 may correct:

   > A game is **market pending** when it is currently ineligible, its sport uses regional windows, at least one active broadcast row is on a market-dependent network, and **`market_coverage` holds no row for that (game, network, viewer market)** — i.e. the out-of-market conclusion was reached with no map data to support it.

   **Derive "market-dependent network" from data, never from a hardcoded list of call letters.** If the schema has no flag that expresses it, add the set to `authority_rules.json` and say so in the report.
3. The reconciler writes `market_pending` alongside `eligible` in the same upsert. **A game that is eligible is never market pending.**
4. **Backfill** every existing `viewer_game_eligibility` row — the reconciler normally only visits games with new evidence, so a one-time pass is required or the 375 existing rows stay null forever. Report the count updated.
5. **Sanity gate — HARD STOP if either holds:** the rule marks **zero** games market pending on 2026-09-13, or it marks **every** ineligible game market pending on both 2026-09-13 and 2026-09-05. Both mean the rule is wrong, not that the data is interesting. Report the counts per day either way.
6. Python tests for the rule, covering: no map row → pending; a map row saying `receives = false` → **not** pending, genuinely out of market; a map row saying `receives = true` → eligible, not pending; an eligible game → never pending; a CFB game with no telecast observed → not pending.

Commit: `feat(pipeline): market_pending on viewer_game_eligibility (E5, migration 0010)`. Push, report the pair.

## Stage 4 — Read it in the app; market-pending never filters

1. Add `market_pending` to the eligibility read in `web/lib/queries.js` (every read the app makes lives in that one file).
2. In `web/lib/offservice.js`: **market-pending games are exempt from filter-by-default in every surface and every toggle state.** They are shown always, and they are **never counted inside "not on your services."**
3. Count line gains its own segment. Shape from the decision record:

   ```
   Sun Sep 13 · 13 games
     2 on your services
     3 market pending · FOX, CBS — map publishes ~Wed
     8 not on your services · FOX, CBS, NFL+
   ```

   Keep the sponsor-tail trim already in place (a network name can contain a comma — "ABTV, presented by Pechanga Resort Casino" — and the one element whose job is counting honestly must not miscount because of it).
4. A **"market TBD" cue** on the row itself, rendered by the row wrapper, **never by touching `MatchupCard.js`**.
5. A game with **no** eligibility row is still shown and still uncounted — unjudged is not ineligible, and it is not market pending either.
6. `test:unit` coverage for the three-way count and for the exemption holding in both toggle states.

Commit: `feat(web): market-pending is shown, never filtered, and counted on its own line (E5)`. Push, report the pair.

## Stage 5 — Per-sport bands

`web/app/page.js` renders one flat `Listing` of all games sorted by kickoff. The feature study's "band per sport" was intent, not shipped code. Build it.

1. A `SportBand` component: a header carrying the sport's mark and label, that sport's count line from Stage 4, and the sport's rows. Bands render in `SPORTS` order from `web/lib/config.js`.
2. **Re-scope the favorites float to be per-band** — it currently floats within the flat listing. Inside each band, games involving a favorite float to the top, **floated rows keeping chronological order among themselves** and the remainder keeping chronological order below, separated by a hairline rule with a faint uppercase **"YOUR TEAMS"** micro-label. Band level, never the card.
3. The grid jump chip and the mobile grid stay bound to a **single selected sport**, exactly as today — bands do not each get a grid.
4. **Do not change the card, the mobile grid, or the detail panel.** This stage is grouping and headers only.
5. `/weeks` and `/history` keep their current structure unless bands fall out for free; if they do not, say so and leave them.

Commit: `feat(web): per-sport bands with per-band counts and favorites float (D6)`. Push, report the pair.

## Stage 6 — QA shots

Run the existing `web/scripts/qa-shots.mjs` against a local dev server if one starts, or against the Vercel preview URL if not. Capture 2026-09-13 (the market-pending case), 2026-09-05 (the 83-game CFB case) and 2026-09-03 (a light weeknight), at 390 px and at 1280 px. Write to `artifacts/qa/2026-09-03-bands/`. **Look at them** and say what is wrong, not only that they were captured.

## Stage 7 — Report

1. `rev-parse` pair; commit chain.
2. **Stage 2's tables, and the sentence naming what distinguishes "unknown" from "unavailable."**
3. The 0010 backup confirmation, the backfill count, and the **per-day market-pending counts** with the sanity gate's verdict.
4. The Sept 13 count line as it actually renders.
5. Test counts: Python, `test:unit`, `smoke`.
6. What the QA shots show — including anything that looks wrong.
7. **Judgment log**, with every bend and its reason.

## Hard stops

1. Secret gate trips, or a push is rejected.
2. The Stage 3 sanity gate fires (zero, or all-ineligible, marked pending).
3. The migration would drop a column, delete data, or be anything other than additive.
4. `MatchupCard.js` would need to change.
5. `market_coverage` turns out to already hold rows for September 13 — that would mean the map is loaded and E5's premise needs re-examining before building on it. Report and stop.

## Explicitly out of scope — prompt 22 owns these

- The time-adaptive band and its three states, the "See all today" escape, and the header stating the viewing day and the clock it used.
- **The E2/E6 derivation, which must be written exactly once** and be importable by renderer v1.7's §11.9 "Tonight" line.
- The ≥1,600 px desktop composition (D5).
- E10 empty-state copy.
- The grid "now" marker, the `generated_grids` bare-key fix, and the loader enum-hardening stage — all three ride rendering-contract v1.7.
