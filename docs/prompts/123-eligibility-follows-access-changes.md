# Prompt 123: A change in who can watch a game reaches the app, not only the database

This builds on `2c62d48`. Before starting, confirm three things. If any check fails, stop and report.

- `git rev-parse --short HEAD` and `git rev-parse --short origin/main` both return `2c62d48`.
- `git status --porcelain` shows only untracked `assets/` entries.
- `python scripts/remove_codex_agents_md.py` exits 0.

*(Numbering: 121, the Worker docs, is written and not yet run, and 122 was used by the icon run. This one is 123.)*

Written by Cowork on 2026-09-28 from read-only SELECTs through the Supabase connector and a read of the tree at `2c62d48`. **Verify every file:line before acting on it.**

---

## What Joe saw

*"The TV listings for NFL yesterday never rectified. They showed 'Market TBD' all day."* That was Sunday, 2026-09-27. Prompts 118 and 119 had decided those games correctly by Thursday.

## What Cowork measured: the database was right, and the app read a stale table

**`game_broadcasts` was correct.** For the 13 CBS/FOX rows on 2026-09-27 (`last_seen_at` 2026-09-28 08:12 UTC, the same values as Cowork's 2026-09-24 read):

- **Available (3):** Bengals @ Steelers (CBS), Panthers @ Browns (FOX), Ravens @ Cowboys (CBS).
- **Out of market (8):** each with `blackout_rule = OUT_OF_MARKET`.
- **Unverified (2):** the two FOX late games.

**`viewer_game_eligibility`, which the app reads, was never recomputed.** The "Market TBD" cue comes from `market_pending` in that table (`web/lib/offservice.js:36-43`, `isMarketPending`). Every one of the 14 NFL rows for 2026-09-27 has `computed_at = 2026-09-05 18:26:01 UTC`, with reasons like `not receivable: cbs=unverified` and `market_pending = true`. Bengals @ Steelers and Ravens @ Cowboys are among them. The Browns row was already eligible on 09-05, via the local-team rule.

**Why the recompute never ran.** `pipeline/reconcile.py` writes eligibility (`:352-357`) only for the games that `read_input` selects. In default mode, which is what the refresh runs (`.github/workflows/schedule_refresh.yml:313`), that set is `CHANGED_WHERE` (`reconcile.py:78-81`): games with a `source_observations` row newer than their last canonical decision.

**An access change creates no observation.** `pipeline/load.py:318-320` writes the broadcast observation as `f"{sid}|{mk}|{certainty}"`. It records service, market and certainty, but not `access_status`. When rule 4b flipped a row from `unverified` to `available` or `out_of_market`, `load.py:314` updated `game_broadcasts.access_status` in place. The observation was unchanged, so `observe()` (`:283-289`) only bumped `last_seen_at`. The game never entered the changed set, and its eligibility froze at the Sept. 5 value.

**The damage is not NFL-only.** In games within ±7 days of today, eligibility rows older than 3 days number:

| sport | stale rows |
|---|---|
| NFL | 33 of 33 |
| MLB | 85 of 109 |
| NHL | 75 of 94 |
| CFB | 128 of 130 |

Stale is not necessarily wrong: a game whose access never changed has a correct old row. **But any access-only change since 09-05 in any sport has not reached the app.** That includes local-rights edits, the Cavs over-the-air simulcast rows, and the TBS endcap work.

---

## Block A: eligibility follows access

Pick the mechanism by measurement, and report the choice and why. The two candidates:

1. **An eligibility pass for every game the load touched.** After the default reconcile, recompute eligibility and `market_pending` for every game id in this run's fixtures, or every game in the refresh's date window, even when no canonical field changed. Measure the cost first: `reconcile.py:77` records that evaluating all 237 games was acceptable in cost terms. **This is Cowork's preferred shape**, because eligibility depends on `game_broadcasts` and the rules, not on canonical decisions.
2. **`access_status` made part of the broadcast observation's value,** so an access change supersedes the observation, and the game enters `CHANGED_WHERE`. The cost: every existing broadcast observation is superseded once on the first run after deploy. That doubles as a backfill, but it rewrites evidence history across every sport. Say whether you judge that acceptable.

**Whichever you choose:**

- **Keep `CHANGED_WHERE`'s purpose** for canonical kickoff and network decisions (`reconcile.py:72-77`). Do not make every canonical field re-decide on every load.
- **Tests.** Reproduce Sunday: load a game whose CBS row is `unverified`, reconcile, then load the same game with the row `available` and an **identical observation value**, and reconcile again. Assert that eligibility becomes `eligible = true` and `market_pending = false`, with a fresh `computed_at`. Add the `out_of_market` twin.
- **Mutation checks:** remove the new pass or the access term, and restrict it to NFL. Show each go red, then restore.
- **Backfill.** The fix must repair every stale row on its first production run without any hand DML. No writer credential is used locally (rule 14). Say how the first scheduled or dispatched run repairs the table, and what count of rows you expect it to change, derived from the table (you may read it with the anon key through PostgREST if you need to).

## Block B: the guard is queued, not built

A smoke check belongs here: for the next 7 days' games, no `viewer_game_eligibility.computed_at` may be more than 26 hours older than the newest `game_broadcasts.last_seen_at` for that game. **Do not add it in this run.** On live data it stays red until the first production refresh after this push, and `CLAUDE.md`'s rule against committing over a red gate is not this brief's to waive.

1. **Measure what it would report today:** run the query read-only through PostgREST with the anon key, and report the count of offending games.
2. **Add `docs/queue.md` item:** *"eligibility freshness smoke check (prompt 123 Block B), to be added after the first production run confirms fresh rows."* Include the query and today's count.

## Block C: documents

- **Register §67** (first confirm §1–§66 exist exactly once). If §66 is not there, because 121 has not run, use the next free number and say so. Record Joe's report, the measurements above, the mechanism, the chosen fix and why, and the guard.
- **Correct register §63's and §64's claims** that the windows "decide" what Joe sees: they decided `game_broadcasts`, and until this fix, not the app.
- **`docs/handoff-status.md`:** record the gates. Add an OPEN item: *after the first production refresh, Cowork confirms `computed_at` is fresh for the next 7 days' games, and that 2026-10-04's NFL rows resolve.*
- **File this brief** byte for byte as `docs/prompts/123-eligibility-follows-access-changes.md` from `Claude outputs\`, and update the counts.

## Out of scope

- The display, and E5.
- The FOX late-window TBD question.
- Prompt 121's Worker documentation.
- Any hand DML.

## Gates, commits, push

Run the script, then all five gates, each as its own command, against the floors in `docs/handoff-status.md` under "Repo state". **All five must be green.**

**Commit per block (A, then C), then push `main`** (rule 7), and report the Vercel deployment. **Do not dispatch the workflow; Joe decides.**

End with the undo block: the real SHAs, what was one-way, and the secret gate on added lines.
