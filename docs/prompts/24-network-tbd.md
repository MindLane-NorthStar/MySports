# Claude Code — Prompt 24: the NETWORK TBD state and the reconciler mislabel

**Venue:** Claude Code in VS Code, laptop, `C:\Users\jlull\Joe's Projects\Apps - Personal\MySports`.
**Mode:** unattended rails. Self-committing stages. Retry once, then log-and-skip.

**Cite repo paths only.** If this prompt names a path that does not exist, say so and verify against the in-repo sources instead.

**This prompt re-runs reconciliation.** Joe pre-authorizes it under the standing rules: additive/upsert only, backup first, no destructive statement, SELECT-and-paste before anything that removes or rewrites a row. **No migration.**

---

## Why this prompt exists

The 2026-09-03 season load took `games` from 375 to ~1,379. A read-only diagnostic then found that **529 of those games have zero `game_broadcasts` rows** — not a load failure, but a **broadcast-announcement horizon**: CFB is fully assigned through week 3 and falls off a cliff at week 4 (~75% bare from week 5 on); NFL is fully assigned through week 15 and week 18 is 100% bare because it is deliberately flex-scheduled; NHL and NBA are bare because their seasons have not started; MLB is 0% bare because its RSN deals are static.

**The app currently calls every one of those games "not on your services."** `2027-01-10` renders `16 games · 16 not on your services` on a completely empty page. That is false in every word.

**E5's `market_pending` cannot reach them, and it is not a tuning problem.** `is_market_pending()` iterates active broadcast rows looking for `access_status = 'unverified'`; an empty list means the loop body never executes, so the answer is `False` by construction. Confirmed: 0 of 529.

**The two states are different questions and must not be merged:**

| | Market pending (E5) | Network TBD (this prompt) |
|---|---|---|
| Known | **Who** is airing it (FOX, CBS) | Nothing |
| Unknown | Whether Cleveland gets that feed | Whether **anyone** is airing it |
| Resolved by | `market_coverage` / 506sports maps | The network announcing a window |

Calling an NFL week-18 game "market pending" would be a **second false certainty** — it asserts a broadcaster exists whose regional split is undecided, when no broadcaster has been named.

**The data is already correct.** `reason` separates `no telecast observed` from `not receivable: X=unavailable`, and "has zero active broadcast rows" is a one-line predicate. This is a presentation-and-vocabulary change over correct data, plus one genuine data-layer bug in Stage 2.

## Joe's rulings (binding — do not reinterpret)

1. **NETWORK TBD is a fourth state.** It is **never** counted as off-service and **never** hidden by D4's filter-by-default. It is **always shown**, exactly as E5's market-pending games are.
2. **The label is `network TBD`** — chosen to pair with the existing `MARKET TBD` badge. The two are mutually exclusive by construction (market-pending requires a broadcast row; network-TBD requires none), so **no card may ever render both**. Assert that in a test.
3. Zero-count segments stay omitted, per the rule that landed in prompt 22.

## Preconditions

1. Branch `main`; `git rev-parse --short HEAD` == `b44893e`.
1b. **Expect `docs/handoff-status.md` and `docs/feature-study/05-home-page-decisions.md` to be modified** — Cowork wrote them directly. That is Stage 1's input, not a precondition failure.
2. `python -m unittest discover tests` → **200 OK (skipped=1)**; `cd web && npm run test:unit` → **123/123**; `npm run smoke` → **30/30**.
3. **Row counts are NOT preconditions** — the daily refresh moves them. Record what you find and move on.

## Working rules (binding)

1. Certify Python for Windows: no `%`-strftime, explicit `encoding=`, ASCII console output.
2. Secret gate every commit, ADDED lines only: `git diff -U0 --cached | grep "^+"`. Never `findstr`.
3. Stage by explicit path; never `git add -A`.
4. Each stage commits and pushes on its own; report the `rev-parse` pair.
5. **Run-workflow-never-Re-run** when dispatching Actions.
6. **Do not run `npm ci`**; `next build` fails locally on the apostrophe in `Joe's Projects`. Use `next dev`.
7. `npm run test:unit` is `node --test "test/**/*.test.mjs"` — quoted glob.
8. **Never edit a source file with a bare repeated string replace.** Prompt 22 corrupted `web/lib/offservice.js` that way and prompt 20 corrupted `data/render_policies.json`. Use line-anchored surgery or a parser, and assert only the intended region changed. **`web/lib/offservice.js` is the main file this prompt touches — take the extra care there.**
9. **Never issue an unbounded PostgREST select.** It silently caps at 1,000 rows and returns no error; that cost prompt 23 a third of the season in the week picker. Use the paginating `restAll()` that landed at `b44893e`. **Any new read added in this prompt must go through it, and the report must name every read you added.**
10. Name every bend in the judgment log.

---

## Stage 1 — Commit the docs Cowork already wrote

**Cowork wrote these two files directly on 2026-09-03 while no prompt was in flight. Do not rewrite them — read them, then commit them.**

- `docs/handoff-status.md` — refreshed to post-prompt-23: HEAD, both commit chains, 200/123/30-of-30, smoke 29/30 closed, the season load, the overlap rule at contract v1.6.5 / Addendum M14 v1.1, the announcement-horizon headline, and **new binding working rules 19, 20 and 21**.
- `docs/feature-study/05-home-page-decisions.md` — gains **§9, the NETWORK TBD ruling**, in the file's existing style. This is the binding record; register §12 deliberately does not restate home-page rulings. **Read §9 before writing a line of Stage 3.**

Verify the tree shows only these two files changed, stage them by explicit path, and commit.

Commit: `docs: handoff status through prompt 23; NETWORK TBD ruled (05 §9)`. Push, report the pair.

## Stage 1b — Normalise line endings for the web file types (isolated commit)

**Do this alone, before any code stage, and commit nothing else with it.**

`.gitattributes` was written to keep diffs clean across the Linux/Windows boundary, but it declares `eol=lf` only for `.py .md .json .svg .txt .yml .yaml .sql` — **not for `.js .mjs .jsx .css .html`**, which is about 51 files and roughly half the repo's text. Five are CRLF on disk (`web/app/history/page.js`, `web/lib/marks.js`, `web/lib/raillabel.js`, `web/lib/standings.js`, `web/scripts/qa-shots.mjs`). Windows git normalises on read so your tree looks clean; Cowork's Linux bridge shell sees a **479-line phantom diff of pure line-ending churn**. Left alone, the first stage that touches one of those files from any Linux context commits that churn into every future blame.

1. Add `*.js`, `*.mjs`, `*.jsx`, `*.css`, `*.html` as `text eol=lf` to `.gitattributes`.
2. `git add --renormalize .`
3. **Prove it is content-only:** `git diff --cached --ignore-cr-at-eol --stat` must be **empty**. If it is not, something real changed — **stop and report**.
4. Confirm the five named files are LF on disk afterwards, and that Python, `test:unit` and `smoke` counts are unchanged from the preconditions.

Commit: `chore: normalise line endings for js/mjs/jsx/css/html`. Push, report the pair. **Nothing else rides this commit.**

## Stage 2 — Fix the reconciler's false out-of-market conclusion

**The bug:** `pipeline/reconcile.py`'s non-CFB else-branch writes `reason = "no national telecast - out of market"` for games with an **empty** broadcast list. It asserts an out-of-market *conclusion* from *no data at all*. The diagnostic found exactly **78** such rows, reconciling precisely to nfl 24 + nhl 38 + nba 16 — every non-CFB bare game. CFB's 451 bare games correctly read `no telecast observed`.

1. **Read the branch before changing it** and paste it into the report. Confirm the 78/451 split still holds.
2. **Guard the else-branch on a non-empty broadcast list.** A game with zero active broadcast rows must never receive an out-of-market reason in any sport. Give it the honest reason — match CFB's existing `no telecast observed` rather than inventing a fifth string.
3. **This is the one place the fix belongs.** Do not paper over it in the web layer; Stage 3's predicate must not have to compensate for a wrong reason string.
4. **Back up first** and paste the confirmation. Record before counts for `games`, `game_broadcasts`, `viewer_game_eligibility`, and the reason-string distribution.
5. Re-run `pipeline.reconcile --all`. Record the same after, plus wall-clock.
6. **Sanity gate — HARD STOP if any holds:** any pre-existing row count decreases; the count of rows reading `no national telecast - out of market` does not fall to zero for games with zero broadcast rows; `viewer_game_eligibility` stops covering every game; or the count of genuinely unavailable games (208 at diagnostic time, rows present and not receivable) changes by more than the daily refresh can account for. **A drop in that 208 means the guard is over-broad and is eating real out-of-market verdicts — stop and report.**

Commit: `fix(pipeline): no out-of-market conclusion from an empty broadcast list`. Push, report the pair.

## Stage 3 — The NETWORK TBD state

**Write the predicate exactly once**, in the same spirit as E2/E6 — one exported derivation, imported everywhere, never re-implemented per surface. It is one line: the game has zero active broadcast rows.

1. **Predicate.** Add it beside the existing eligibility/market-pending derivations. Name it plainly. Export it.
2. **`web/lib/offservice.js`.** `offServiceSummary` currently tests `isMarketPending` then `isEligible`, so these games fall through to `off`. Add the new state **ahead of the off bucket**: a network-TBD game is never off-service and never filtered by default. Rule 8 applies with force here.
3. **Count line.** Add the fourth segment, zero-count segments still omitted. The target strings:
   - `2026-11-14` → `56 games · 6 available to you · 42 network TBD · 8 not on your services`
   - `2027-01-10` → `16 games · 16 network TBD`
   - `2026-09-03` → unchanged from today
4. **Band lines.** Every band still reports, including bands with nothing hidden — the `4250aa9` fix must not regress.
5. **Card badge.** The card renders `NETWORK TBD` where `MARKET TBD` renders today. **`MatchupCard.js` stays structurally untouched** — this is a return-value change at the point that produces the MARKET TBD badge, the same shape as E1's `resultLabel` change. If it cannot be done that way, **stop and report** rather than restructuring the card.
6. **Test that the two badges are mutually exclusive** — no game may be both market-pending and network-TBD.
7. Unit tests for the predicate, the summary bucketing, the count-line rendering including the zero-omit cases, and the D4 filter exemption.

Commit: `feat(web): network TBD is its own state, never off-service, never hidden`. Push, report the pair.

## Stage 4 — The grid consequence (Cowork's call; flagged for Joe's veto)

**A network-TBD game cannot be placed on the grid.** The grid is organized into network rows and this game has no network — so it silently vanishes from the grid while appearing in the list. On `2026-11-14` the grid would show 14 games while the list shows 56, with nothing explaining the gap.

**Ruling:** the grid renders an honest one-line note beneath it naming the count — e.g. `42 games not on the grid · network TBD`. One quiet line in the grid's own voice; no placeholder row, no invented "TBD" network lane. The line is omitted when the count is zero.

*(Flagged for Joe's veto. The alternative — a literal "TBD" network row — was rejected because it would render as a real network and the grid's whole contract is that a row is a channel you can tune to.)*

Report the note as it renders for `2026-11-14`, `2027-01-10` and `2026-09-03`.

Commit: `feat(grid): honest note for games with no network to place`. Push, report the pair.

## Stage 5 — QA and report

Capture `/?day=2026-11-14&sport=cfb`, `/?day=2027-01-10&sport=nfl`, `/?day=2026-09-03` and `/weeks?view=season` at **390, 1024 and 1440 px** into `artifacts/qa/2026-09-03-networktbd/`, plus the qa-shots set. Keep the 8 behavioural assertions green. **Look at the shots** and say what is still wrong.

Report: rev-parse pair and commit chain; **Stage 1b's proof that `--ignore-cr-at-eol --stat` came back empty**; **Stage 2's before/after reason distribution, the 78 → 0 confirmation, and the 208 unavailable count before and after**; Stage 3's three literal count strings; whether the badge change stayed inside `resultLabel`-shaped territory; **Stage 4's grid note as rendered**; every read you added and confirmation it goes through `restAll()`; test counts; what the shots show; and the judgment log.

## Hard stops

1. Secret gate trips, or a push is rejected.
2. Stage 2's sanity gate fires — **especially a drop in the genuinely-unavailable count**.
3. Any row count decreases, or any destructive statement is required.
4. The `NETWORK TBD` badge cannot be produced without restructuring `MatchupCard.js`.
5. A game is found that is both market-pending and network-TBD — that would mean the predicate is wrong.

## Out of scope — prompt 25 owns these

- **The chip rebuild** (league marks only, no text; NASCAR/INDYCAR/UFC/WWE added; no AEW chip; raw art on the gold active plate; horizontally scrolling row; honest per-sport empty states). Specced in `enhancement-register.md` §13.
- **The logo two-state audit**, starting from the lead that `nfl.png` and `nfl_dark.png` are byte-identical at 28,678 bytes.
- **The week control restyle** — it renders gold under the gold "Season week" chip and reads as two selected chips. Joe has ruled: inactive chip style with a caret.
- **The 390 px mobile pass** — the wrapping `@`, the network mark abutting the home team name, and the 78 px time column.
- **The mobile page reorder** (YOUR TEAMS → grid → rest of list).
- E10 empty-state copy, the grid "now" marker, loader enum-hardening, and the `unverified` documentation note — all ride rendering-contract v1.7.
