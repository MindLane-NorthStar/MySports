# Claude Code — prompt 96: make Joe's raw-logo ruling actually reach the runner

**Run in Claude Code**, in `C:\Users\jlull\Joe's Projects\Apps - Personal\MySports`, on `main`.

**One case-sensitive comparison, one workflow flag, tests, one contact sheet, and the record. No
database access of any kind, and nothing is published to R2 by this brief.**

**THIS IS AN UNATTENDED RUN.** Self-commit and push under working rule 7's default; stop only for the
stop list in `CLAUDE.md`'s `## Committing` and the list at the end.

**Scope this brief may touch:** `scripts/build_web_marks.py`, `tests/test_logo_conditioning.py`,
`.github/workflows/bootstrap_season.yml`, `docs/enhancement-register.md`, `docs/handoff-status.md`,
`docs/rules-casebook.md`, `docs/prompts/README.md`, `docs/prompts/96-logo-ruling-case.md`,
`CLAUDE.md`, and one new image written to `Claude outputs\` (untracked, gitignored at `:34`).
Nothing else. **`data/logo_conditioning.json` is NOT in scope** — see stage A.

---

## What prompt 95 found, verified independently by Cowork on 2026-09-14

Your diagnosis is right and I checked every link of it against the tree rather than taking it:

- **`data/logo_conditioning.json`'s `skip_derive` is a dict of 463 entries. Exactly 25 keys contain
  an uppercase letter, and all 25 are NBA:** `nba-BKN`, `nba-BOS`, `nba-CHA`, `nba-CHI`, `nba-CLE`,
  `nba-DAL`, `nba-DEN`, `nba-DET`, `nba-GSW`, `nba-IND`, `nba-LAC`, `nba-LAL`, `nba-MEM`, `nba-MIA`,
  `nba-MIL`, `nba-MIN`, `nba-NOP`, `nba-NYK`, `nba-OKC`, `nba-ORL`, `nba-PHX`, `nba-POR`, `nba-SAC`,
  `nba-SAS`, `nba-WAS`. The other 438 are numeric CFB ids. The reach really is exactly these 25, and
  the conflict set matches them one for one.
- **`build_web_marks.py:581`** builds `skip` as a `set()` of those keys, so the set holds the
  uppercase spelling. **`:633` is `if p.stem in skip_derive:`**, and `p.stem` comes from
  `LOGO_DIR.glob("*.png")` at `:618` — the filename on whatever machine is running.
- **The two machines spell the file differently.** Joe's laptop has `nba-BKN.png`, so the stem
  matches and the ruled-raw branch fires: a byte copy of the 500px base, which is why his copies are
  right. The runner pulls from R2, whose keys are lowercased on upload by
  `sync_assets.py:local_files()`, so it has `nba-bkn.png`, the stem misses the set, and the file
  falls through to the conditioning chain at `:655-658` — `thumbnail((DARK_MAX, DARK_MAX))` then
  `floor_l(derive(im), 0.5)`. 256px, conditioned. **The ruling is silently not applied.**

**So this is not a cosmetic id-spelling issue.** A ruling Joe made on 2026-09-08 after looking at the
art has been overridden nightly since run #14 on 2026-09-09, on 25 teams including the Cavaliers,
and nothing anywhere reported a problem — the counts line prints `25 generated` rather than
`25 copied raw`, which is the only trace, and it reads as normal work.

**It self-heals once the comparison is fixed, and Cowork traced why, so this brief does not republish
anything.** The ruled-raw branch at `:635-640` is
`if not (dark.exists() and not force and _sha(dark) == _sha(p)): shutil.copyfile(p, dark)`. On the
runner after the fix, `dark` exists but is the conditioned file, so its sha differs from the base's,
the guard is False, and `copyfile` overwrites it with the raw base. `--push` then sees the bytes
differ and uploads. **The next nightly corrects the bucket on its own.** Confirm that reasoning as
stage D rather than trusting it.

---

## Preconditions

- `6d06968` in history. `git status` clean apart from `assets/`; report anything else.
- `HEAD == origin/main`; say what it is.
- Five gates as the baseline, each its own command, each against the floor **read from**
  `docs/handoff-status.md` under "Repo state". Prompt 95 moved the pytest floor; read it, do not
  remember it. **This brief quotes no gate number.**
- Working rule 1: certify the Python interpreter for Windows before running anything Python.

---

## Stage A — fix the comparison, not the data

**Fix `build_web_marks.py`, and leave `data/logo_conditioning.json` exactly as it is.**

The reasoning, because the opposite choice is tempting and wrong: lowercasing the 25 keys would make
today's symptom go away and leave the next mixed-case id broken, and the JSON is the record of Joe's
ruling in the spelling he gave it. **Three spellings of a team id are already in play** — the
database's, the local filename's, and the lowercased R2 key's — so the comparison has to be immune to
which one arrives. That is a code fix with one home.

- Normalize **both sides** where `conditioning_rulings()` builds its sets at `:581` and where `:633`
  tests membership. **Do the same for the `derive` set** — it is built from the same file in the same
  line and has the identical exposure; fixing only `skip_derive` leaves half the bug.
- Check whether any other module reads `logo_conditioning.json` or compares a stem to a team id the
  same way. `grep` for it, **report what you searched and what you found**, and fix nothing outside
  this brief's scope — name it instead.
- Update the docstring note above the branch so it records that the match is case-insensitive and
  why, in the register of the comments already in that file.

---

## Stage B — `bootstrap_season.yml:49`

The line is `- run: python scripts/sync_assets.py --push` — bare, no prefix, no flag. After prompt 95
it refuses the moment a freshly fetched logo is new to the bucket, which is the normal case for that
workflow, and the job dies before it loads reference data.

Add `--allow-new`, with a one-line comment saying why it is deliberate there: this workflow's whole
job is to fetch art that does not exist yet. **Change nothing else in that file** — not the step
order, not the adapter loop.

---

## Stage C — tests

Extend `tests/test_logo_conditioning.py` (it exists; read its fixtures before adding to it).

- A base named with the **lowercase** stem whose id is ruled raw in mixed case → the ruled-raw branch
  fires. **Name the test so its failure says the ruling was not applied.**
- The same base named in **mixed case** → still fires. Both spellings, one behavior.
- A team that is **not** ruled raw → still conditioned. The fix must not widen the ruling.
- The `derive` set gets the same mixed-case coverage.

**Mutation check, required:** restore the case-sensitive comparison, confirm the lowercase test
fails, restore the fix, confirm it passes. **Report both directions.**

---

## Stage D — prove the self-heal locally, without touching the bucket

In a scratch directory, not `assets/`: a lowercase-named 500px base plus a `_dark.png` that is the
**conditioned 256px** version (build it the same way the code does). Run `team_dark_variants()`
against it and report:

- that the dark file is rewritten to a byte copy of the base;
- the counts line, which should now read `copied raw (ruled skip_derive)` rather than `generated`;
- that a **second** run leaves it alone, so the fix is idempotent and will not rewrite 25 objects
  every night forever.

**If the second run rewrites, stop and report** — that would turn a one-time correction into a
nightly 25-file push, which is a different problem than the one this brief is fixing.

---

## Stage E — one picture, because a ruling about how art looks deserves one

Write a single side-by-side contact sheet to
`Claude outputs\nba-ruled-raw-restored-2026-09-14.png` — three or four of the 25 teams, Cleveland
among them, each showing the bucket's current conditioned 256px copy beside the raw 500px copy the
ruling asks for, **at the size a listings card actually renders them**, on the charcoal the app
floats them on (`#101214`, per the note at `team_cap_art`). Label each column.

Cowork will open it. This is not a gate and nothing depends on it — it is the record of what changed
in production, for a ruling Joe made by looking. `Claude outputs\` is gitignored, so it is not
committed.

---

## Stage F — the record

- **`docs/enhancement-register.md`** — a new section at the next unused number. **Count and say which
  number you used**; prompt 95 took §44, so expect §45 and confirm it. Record the chain: the
  uppercase keys, the case-sensitive membership test, the two machines' different filename spellings,
  the counts line that read as normal work, the date the divergence started (run #14, 2026-09-09),
  and the decision to fix the comparison rather than the data with the three-spellings reason.
- **`docs/handoff-status.md`** — the 25-conflict item closes, naming this prompt and stating that the
  bucket corrects itself on the next nightly rather than by a manual push. The
  `bootstrap_season.yml` item closes. The 29 local-only item **stays open** — this brief does not
  touch it.
- **`docs/rules-casebook.md`** — one entry, in that file's format. The lesson is not a new rule: a
  ruling recorded in a data file is not in force until something proves it fires, and here the only
  evidence either way was a counts line that looked healthy while doing the opposite of the ruling.
  **Do not write a new rule**; point at rule 30.
- File this brief to `docs/prompts/96-logo-ruling-case.md`, verbatim. Update
  `docs/prompts/README.md` and `CLAUDE.md`'s prompt-count and register rows. **Count; do not
  increment.**

---

## Assertions

- `grep` the workflow: `--allow-new` now appears in `bootstrap_season.yml` exactly once, on the push
  line, and still exactly once in `schedule_refresh.yml`.
- The 25 uppercase ids are unchanged in `data/logo_conditioning.json`. `git status --short` proves
  the file was not touched.
- `python -m pytest tests/test_logo_conditioning.py -v` passes, reported by name with its count.
- `python scripts/sync_assets.py --check` — read-only, no flags that write. Report the counts line.
  **The 25 conflicts will still be there**, because nothing has been published yet; say so rather
  than letting the number look like a failure.
- The five gates, each its own command, each against the floor read from `docs/handoff-status.md`.

---

## Gates, then commit and push

All five, each its own command. Gate and commit are separate commands (rule 26). Then commit and
push, and report the Vercel result — no web code here, so call it a no-op rebuild.

**End with the undo block:** the revert command with the real SHA. Note honestly that a revert
restores the bug **and** removes the `bootstrap_season.yml` flag, so a revert must be of the whole
commit. Note also that **after the next nightly runs, a revert no longer restores the bucket** — the
25 objects will have been overwritten with the raw art by then, and R2 keeps no previous version.
That is the intended outcome and it is still worth stating plainly.

**Do not dispatch any workflow, and do not run `--push`, `--pull`, `--force` or `--recache`.**

---

## When to actually stop

Only these. Everything else, decide and keep going, and log the call.

1. `git status` is not clean apart from `assets/` at the start.
2. Stage D's second run rewrites the file — the fix would not be idempotent.
3. A mutation check does not fail when the fix is reverted.
4. The fix would require changing `data/logo_conditioning.json`.
5. A gate fails and cannot be made to pass.
6. Anything in `CLAUDE.md`'s `## Committing` stop list.

---

## Standing rules

- Working rule 2: never write to the repo while another prompt is in flight.
- Working rule 4: stage by explicit path; never `git add -A`.
- Working rule 3: secret gate on added lines, with `grep`, never `findstr`.
- Working rule 14: no database write; the `mysports_writer` credential is never read, printed or used.
- Working rule 30: check the thing, not the label — `25 generated` was the label that hid this for
  five days.
- Gate floors: `docs/handoff-status.md` under "Repo state", nowhere else. This brief quotes none.
- Marks are built ONLY through `build_web_marks.py` / `build_brand_marks.py` — never a hand-edited
  PNG, never a hand-edited manifest. That is why stage A fixes code and not art.
- WUAB and RESN are never named. Credentials never enter the repo or a committed doc.
