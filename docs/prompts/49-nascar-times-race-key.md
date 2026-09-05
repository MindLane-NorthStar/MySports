# Prompt 49 — housekeeping the tree and the prompt record; NASCAR start times corrected in place; 0016 gives race sessions a stable natural key

**Run in Claude Code**, in `C:\Users\jlull\Joe's Projects\Apps - Personal\MySports` on `main` at `f990165` or a descendant (prompt 48's final HEAD; gates: Python 443 + 1 skip, JS 329, smoke 30/30, qa-shots 14/14). Four stages, four commits, the merged-unattended shape of prompts 35–48 and every standing rule in `docs/handoff-status.md` (1–28): gate and commit as separate commands; stage by path; secret gate with `grep`; push and print the rev-parse pair; backups before any write; dry-run before any load; JSON through a parser; locate and cite before asserting what anything does. Hard stops: the secret gate, a push reject, **any database write other than the two named below**, any DDL that is not additive. Rule 27: check `gh run list --workflow schedule_refresh.yml -L 3` first and do not write while the scheduled refresh can be writing; if it is due within the hour, wait for it to finish. The repo is frozen for Cowork while this runs.

**Approved by Joe, 2026-09-06 ("NASCAR fix is approved"):** (a) a targeted `UPDATE` of `start_at` (and any derived end/viewing-day columns) on exactly the 98 NASCAR race-session rows loaded by prompt 47; (b) migration 0016, additive. Nothing else. **Stages 1 and 2 touch no database at all.**

**The defect** (prompt 48 report): `cf.nascar.com` publishes naive Eastern wall-clock timestamps; `parse_iso` stamped them UTC, so every 2026 race is stored 4 hours early in EDT and 5 in EST. Prompt 48 fixed the adapter (`77258ff`) but could not fix the rows: `start_at` is part of the race-session natural key, so a corrected time reads as a different race and the moved-twin guard skips it. The Darlington race shows at 1:00 PM instead of 5:00 PM today.

**Why stages 1 and 2 exist.** Cowork read the repo directly on 2026-09-05 and found two pieces of housekeeping that should be settled before prompt 50 opens: a permanently dirty working tree that will mask a real change, and a build record whose briefs live outside the repo. Both are cheap, neither touches data, and both are ordered ahead of the database work so that if a later stage hard-stops the housekeeping is already banked.

---

## Stage 0 — preconditions

`HEAD == origin/main`, `f990165` or a descendant. `.env` present (values never printed); Python 3.13.

**The working tree is NOT clean, and that is expected.** Record `git status --short` verbatim. Cowork measured it on 2026-09-05 and it read:

```
 M tests/fixtures/espn_nfl_scoreboard_raw.json
 M tests/fixtures/mlb_schedule_raw.json
 M tests/fixtures/nba_scoreboard_raw.json
 M tests/fixtures/nhl_schedule_raw.json
?? assets/brand/
?? assets/handoff/
?? assets/league-logos/
?? assets/logos/
?? assets/network-logos/
?? assets/program-logos/
```

The four modified fixtures are stage 1's subject. The `assets/` entries are the always-untracked art. `handoff/project-mirror/` is gitignored and does not appear. **Anything else in that list is a precondition failure — stop and report it.**

Four gates recorded as baseline; below the floors stops the run. Tripwire (`document.fonts.ready` first): the post-prompt-48 CFB `2026-09-05` and MLB `2026-09-03` numbers from `docs/handoff-status.md` — record them; nothing in this prompt may move them. Fetch the three `cf.nascar.com` series feeds with the project UA; record status and bytes; if any is down, stage 3 uses the recorded fixtures under `tests/fixtures/` and says so.

---

## Stage 1 — the four recorded fixtures stop showing as modified · commit `chore: restore LF in the four pre--text recorded fixtures`

**What Cowork measured, so you do not have to rediscover it.** All four diffs are 26,169 insertions against 26,169 deletions and vanish completely under `git diff --ignore-cr-at-eol`. Every one of the four is CRLF in the working tree and LF in the index — `grep -c $'\r'` gives 15314 / 5344 / 2489 / 3022 on disk and **0** for all four out of `git show :<path>`. Not one byte of payload differs. Their mtimes are all 2026-09-03, so this predates prompts 46, 47 and 48, and every gate since has run over it.

**How it arose.** `.gitattributes` originally declared `*.json text eol=lf`, which normalises on read, so a CRLF working copy looked clean on Windows. The later block — `tests/fixtures/*.html -text` and `tests/fixtures/*.json -text`, added because recorded fetches are asserted as bytes — turned that normalisation off, and the stale CRLF copies became a permanent diff. The CRLF almost certainly came from a Windows `open(path, "w")` without `newline=""`, which is rule 1 in a costume nobody had named yet.

**Establish the direction of the fix before making it.** The `-text` block exists to protect fixtures whose tests pin a `sha256` and a byte count. Cowork's reading is that these four are **not** among them — `sha256` appears in `tests/test_aew.py`, `test_indycar.py`, `test_register_grids.py`, `test_studio_shows.py`, `test_ufc.py` and `test_wwe.py`, while the only readers of these four are `tests/test_scores.py` (lines 108, 168, 207, 250, via `load_raw`) and `tests/test_nba_game_ids.py` (lines 73, 81, via `read_text` + `json.loads`), all of which parse rather than hash. **Verify that claim yourself and cite file and line** (rule 22). Then:

1. **If no test pins these four by hash or byte count** — the expected case — the LF blobs in the index are the bytes the sources actually served and the CRLF on disk is local corruption. Restore the working copies from the index (`git checkout -- <the four paths>`), confirm `git status --short` no longer lists them, and confirm all four still parse (`json.loads`) and that the Python gate is unchanged. **This stage then commits no fixture change at all** — the tree simply goes clean. Say so plainly in the report; a commit with nothing in it is not a failure here, it is the correct outcome, and stage 1's commit carries only item 2 and 3 below.
2. **If some test does pin one of them by hash or byte count**, the recorded hash is the CRLF hash and the LF blob in git is the wrong artifact. Do the opposite: stage the four CRLF working copies and commit them, so index and disk agree on the bytes the tests assert. **Report this loudly** — it means a fresh clone or a CI checkout has been failing that assertion, and that is a finding, not housekeeping.
3. **Stop it recurring.** Find every place the repo writes a `tests/fixtures/*.json` or `*.html` file (the recorders and any promote/snapshot helper — locate and cite them) and make each write bytes, or open with `newline=""`. Add a test that fails if any file under `tests/fixtures/` contains a CR byte, unless case 2 above applies, in which case pin the four by name as documented exceptions with a comment saying why.
4. Add a short paragraph to `docs/handoff-status.md` under the working rules recording the finding: `tests/fixtures/*` is `-text` on purpose, recorded fetches are bytes, and any writer of a fixture must write bytes or `newline=""` on Windows. If a numbered rule is warranted, it is **rule 29** — do not renumber anything.

Gates, commit, push. Report the `git status --short` before and after.

---

## Stage 2 — the prompt record moves into the repo · commit `docs: prompts 45-49 filed under docs/prompts`

**The problem.** Every Claude Code brief for this build lives outside the repo — 1 through 44 in the Claude.ai Project, 45 through 49 in `Claude outputs\` on Joe's laptop, which `.gitignore` line 15 excludes as `/Claude outputs/`. The repo therefore carries 49 prompts' worth of commits and none of the briefs that produced them. That is the same failure prompt 47 hit when the events research lived only in the Project, and the Project has already lost a session once (`claude/session-reconstruction-2026-09-03.md`).

**Scope of this stage: the five briefs already on disk.** Prompts 01–44 exist only in the Project, which Claude Code cannot read; **Cowork is extracting them and will deliver them for prompt 50.** Do not attempt to reconstruct them, and do not write placeholder files for them.

1. Create `docs/prompts/`.
2. Copy these five, **verbatim, bytes unchanged**, from `Claude outputs\` to `docs/prompts\`. Do this with Python (`shutil.copyfile`), not a shell copy — the source names contain spaces and the repo path contains an apostrophe (rule 12's standing caution):

| source in `Claude outputs\` | destination in `docs\prompts\` |
|---|---|
| `prompt 45 - banner seam and headroom, DATE and WEEK header pickers, ALL SPORTS bar.md` | `45-banner-seam-headroom-pickers.md` |
| `prompt 46 - overnight run - UI batch, docs, reconciler, enums, D1 band, NHL NBA and NASCAR loads.md` | `46-night-run-ui-docs-reconciler-loads.md` |
| `prompt 47 - programs live - migrations, NHL NBA dispatch, NASCAR, v1.7 program card, IndyCar WWE AEW studio UFC, refresh agent, project mirror.md` | `47-programs-migrations-nhl-nba-nascar.md` |
| `prompt 48 - programs live part 2 - source docs, eligibility 0014, v1.7 program card, IndyCar WWE AEW studio UFC, refresh agent, project mirror.md` | `48-programs-live-source-docs-v1.7.md` |
| `prompt 49 - NASCAR start times corrected in place, 0016 stable race natural key.md` | `49-nascar-times-race-key.md` |

**The prompt 49 file on disk is this brief**, the four-stage version — Cowork overwrote it before handing it to Joe, so the filed copy is the one that ran. Confirm its first heading matches this document's before copying; if it does not, stop and report, because you are running text that differs from what will be filed.

3. Prove the copies are byte-identical to their sources (compare sizes and a hash of each pair; paste the table).
4. Write `docs/prompts/README.md`, modelled on `docs/research/README-events-docs.md` — same voice, same table shape. It must carry: the naming rule (`NN-slug.md`, zero-padded, slug describing the objective, content verbatim and never edited after the fact); the five rows above with their original names; a line stating that **01–44 are pending delivery from the Project by Cowork** and that **39 and 42 are not known to exist anywhere** — 42's handoff survives as `assets/handoff/banner-v2/HANDOFF-Prompt-42.md`, 39 has no trace; a note that prompts 23 and 26 each exist in two versions and both will be filed when they arrive, the superseded one marked in its filename; and a sentence saying prompts are the historical record of why each commit exists and are not to be treated as current documentation — `docs/handoff-status.md` is current, prompts are as-run.
5. `docs/handoff-status.md`: one line in the companions paragraph at the top pointing at `docs/prompts/` and saying what it holds and what it does not yet hold.

Gates, commit, push. **Nothing under `Claude outputs\` is staged, moved or deleted** — it stays as the working drop folder.

---

## Stage 3 — the 98 rows, corrected in place (approved write a) · commit `nascar: start_at corrected in place for the 98 loaded race sessions`

1. **Build the correction set from the feed, not from arithmetic.** Run the *fixed* adapter over the fresh feeds (or the fixtures) to get the correct `start_at` for every race session. Match each to its stored row **by the feed's race id** — locate the race id in the feed and in whatever the loader stored (`source_url`, a metadata column, the title+series pair as a last resort; cite what you use). Never match by `start_at`. Exactly 98 matches are expected; any unmatched stored row or unmatched feed race is a stop for this stage, reported by title.
2. **Dry-run:** a script that prints, per row, `program_id · series · title · stored start_at → corrected start_at · offset`. Gate before writing: 98 rows; every offset is exactly `+4h` (a race on or after 2026-11-01 03:00 ET: `+5h`) — a row whose offset is anything else is a stop; no other `programs` row appears. Put the table in the report.
3. **Derived columns.** Locate every column derived from `start_at` on `programs` (expected end, `viewing_day` or its equivalent, anything the grid's day bucketing reads — cite) and on the 98 attached `game_broadcasts` rows (`window_start/end` if set). Correct them in the same transaction with the same offsets. The eligibility rows do not depend on time; prove it by checksum before and after.
4. Back up `programs` and `game_broadcasts`. Apply in one transaction. **Post-check:** 98 rows changed, checksum over every other `programs` row unchanged, `viewer_program_eligibility` checksum unchanged, `viewer_game_eligibility` untouched, the game-verdict md5 (`d4fa47cb02ab41427267dfcff1eb8440` at prompt 48's end, or the current value recorded in stage 0) unchanged. Record the run in `db/README.md`.
5. **Verify on the page:** render `2026-09-06` Today at 390 — the Darlington Cup race block and list card at **5:00 PM ET** (the feed's value, not a number typed here) on its network row; the archived Sept 6 desktop SVG is regenerated only if the daily job already regenerates today's grid (do not add that step here — it is a separate open item). Screenshot into `artifacts/qa/2026-09-06-nascar-times/`.
6. Gates, commit (scripts and docs only — data is not in git), push.

---

## Stage 4 — migration 0016: a stable natural key for race sessions (approved write b) · commit `db: 0016 programs.external_id; race-session natural key no longer depends on start_at`

1. **DDL, additive:** `programs.external_id text` (nullable); a partial unique index on `(sport, series, external_id) where program_type = 'race_session' and external_id is not null`. The existing `(sport, series, start_at, title)` partial unique from 0012 stays (dropping it is not additive); document in `db/README.md` that it is superseded for rows carrying `external_id` and is to be dropped in a later, separately approved migration. Back up; apply through the migration runner; regenerate `db/enums.json` (unchanged — prove it).
2. **Backfill:** write `external_id` on the 98 rows from the same feed-id match stage 3 used (this is within write (a)'s scope — the same rows, one more column; say so). Gate: 98 non-null, all distinct within series.
3. **The loader:** `pipeline/load_programs.py` (and the NASCAR path in the refresh step) upserts race sessions on `(sport, series, external_id)` when the adapter supplies one, repeating the partial index's predicate in `ON CONFLICT` (prompt 47's finding); falls back to the 0012 key only when it does not. The adapter supplies it. **Relax the moved-twin guard** for rows with `external_id`: a changed `start_at` is an update, and the report line says "moved" with the old and new times. Keep the guard as-is for keyless rows.
4. **Tests:** a second load of the corrected feed updates 98 / inserts 0; a fixture with one race moved by an hour updates that one row in place and logs the move; a keyless fixture still trips the guard; the IndyCar adapter (18 rows, prompt 48) is untouched unless its feed carries an id — check, and either supply it the same way or leave a report line saying why not.
5. Dispatch the refresh only if rule 27 permits; if you do, confirm from the log that the NASCAR step reports 98 updated / 0 inserted / 0 moved-twin skips.
6. `docs/handoff-status.md`: a short "2026-09-06 NASCAR times" block — the four commits, the offsets table's summary, the superseded 0012 key, the stage-1 fixture finding, the new `docs/prompts/` home, and the open item for the archived-grid program step. Refresh `handoff/project-mirror/` for every doc this prompt changed. Gates, commit, push.

---

## Report

The standing shape: per stage what shipped and its commit; gates before and after; backup paths; the 98-row offset table; every checksum before and after; the DDL verbatim; every judgment call; anything in this brief that was wrong, as its own section. Stage 1 must state which of its two cases applied and why, with the citation that decided it. Stage 2 must include the byte-identity table.

**For Joe:**

1. Close the installed app fully and reopen it from the Home Screen.
2. `TODAY` (or `HISTORY` → Sunday Sept 6): the Darlington Cup race now at 5:00 PM ET in the grid and the list card.
3. `WEEKS` → any later NASCAR week: race times read as evening/afternoon starts, not early morning.
4. Anything wrong: screenshot with the step number into the Cowork chat.
