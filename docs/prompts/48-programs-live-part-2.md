# Claude Code prompt 48 — programs go live, part 2

> **THIS BRIEF IS NOT IN THE TREE.** It was given to the Claude Code session in the chat and has no
> repo copy, so this is the copy the session held in context, written out verbatim from it for the
> Project. If it differs anywhere from what Joe pasted, Joe's copy is the one that governs.
>
> Everything the brief asked for shipped, in ten commits on `main` from `ef3d826`, except where this
> file's companions say otherwise — read `claude_handoff-status.md`'s "2026-09-05/06 programs-live
> run (prompt 48)" block for what shipped, what moved, and what is open.

---

**Run in Claude Code**, in `C:\Users\jlull\Joe's Projects\Apps - Personal\MySports` on `main` at
`ef3d826` or a descendant (prompt 47's final HEAD; gates there: Python 320 + 1 skip, JS 298, smoke
30/30, qa-shots 14/14). Straight through, no pause, nobody reading mid-run. Ten stages (0–9) in the
merged-unattended shape of prompts 35–47: preconditions once at the top, never re-asserted by sha;
every stage gates, commits and pushes on its own; two strikes then skip; a hard stop stops *that
stage only* and never rolls back a green one. Hard stops: the secret gate, a push reject, any
database write outside the approval below, any DDL that is not additive. Standing rules on every
commit: stage by explicit path, never `git add -A`; secret gate with `grep` on added lines
(`git diff --cached | grep -E "CFBD_API_KEY=[A-Za-z0-9]{20,}"` prints nothing); push and print
`git rev-parse HEAD` and `git rev-parse origin/main`; Windows-certified Python (`encoding="utf-8"` on
every `open()`, ASCII-only console output); JSON through a parser; no bare repeated string replaces;
numeric thresholds against the local background (rule 13); color tokens read, never retyped (rule
16); before asserting what a component does, open it and cite file and line (rule 22); locked-
reference changes carry `docs/design/mobile_demo.html` in the same commit (rule 23); a Python-side
count is no evidence the JS runtime agrees (rule 24); done means deploy green and device agrees (rule
25); the gate and the commit are separate commands (rule 26); **rules 27 and 28 as prompt 47 wrote
them** (no `--all` reconcile while the scheduled refresh can be writing; workflows are validated by
the Actions-expression guard, not by PyYAML). Every runner alone, exit code captured, counts parsed,
compared, written into the report, and only then `git add` by path. No `npm ci`. This is `main`:
every push deploys. The project UA on ESPN (prompt 47 proved the "403" was an invented probe UA; the
project UA gets 200 — never invent a UA). The repo is frozen for Cowork while this runs.

**Why this run exists.** Prompt 47 shipped its data stages (0012/0013, NHL/NBA, NASCAR, v1.6.15) and
correctly refused to build stages 4–9 because every document they load from lived only in the
Claude.ai Project. Joe has now dropped those documents into the repo (stage 0 verifies and commits
them). This run is prompt 47's stages 4–9 rebuilt against the tree as prompt 47 left it, plus one
migration prompt 47 surfaced: programs cannot carry eligibility rows.

**This brief cites documents, not file locations.** Every "locate and cite" is exactly that. Where
this brief states a fact about the tree, treat it as a claim to verify.

**Database approval (Joe, 2026-09-05, extended to this run 2026-09-06):** additive DDL only — new
tables, nullable columns, new indexes, `ALTER TYPE … ADD VALUE`; never a drop, a rename, a type
change or a `NOT NULL` tightening (dropping a `NOT NULL` is allowed where stage 1 names it, exactly
as 0012 did). The exact DDL goes in the report and in `db/README.md`. Every table touched is backed
up with `scripts/backup_table.py` first; every load is dry-run first (`--export` then
`--input … --emit-sql`; never `--all --emit-sql`) and sanity-gated as written in its stage; every
load goes through a natural-key upsert (prompt 47 proved the `ON CONFLICT` predicate must be repeated
for a partial index — reuse `load_programs.py`). Pre-approved writes: migration 0014 (stage 1); the
reconcile of loaded programs (stage 1 and after every load); loads into `programs`, attached
broadcasts and `studio_show_instances` for IndyCar (3), WWE (4), AEW (5), studio shows (6), UFC (7).
Nothing else.

**Read first:** `docs/handoff-status.md` (prompt 47 appended; rules 1–28); `docs/enhancement-register.md`
(§1–§17; §13 is the AEW chip amendment; §17 holds Joe's 2026-09-05 amendments);
**`docs/design/program-card-design-v1.md` — the design of record, approved for build as written (Joe,
2026-09-05)**; `docs/research/README-events-docs.md` (the name map from the Project's names to the
repo paths — the research files cross-reference each other by their Project names; read them through
that table); `docs/research/events-summary-2.md`, then `docs/research/studio-shows.md`, `wwe.md`,
`aew.md`, `ufc.md`, `nascar.md`, `indycar.md`, and
`docs/research/events-and-shows-handoff-2026-09-02.md` — **every 2026 slot, network, duration and
source URL this run loads comes from those documents or from a live fetch of a source they verified;
nothing is typed from memory.** If a document is still missing at stage 0, the stages that need it
skip with that reason; nothing is written from recollection. Also `docs/rendering-contract.md`
(v1.6.15), `docs/rendering-contract-mobile.md`, `db/migrations/0009*`, `0012*`, `0013*` as built,
`data/render_policies.json`, `data/duration_defaults.json`, `pipeline/load_programs.py` and
`adapters/nascar.py` (the program-load pattern to copy).

**Rulings of record for this run** (all in the register §17 or the research docs; do not re-raise):
hosts and crews for College GameDay and Big Noon Kickoff are static, hand-curated data (these two
shows only); IndyCar is built now against 2026; the entire studio-show registry loads; UFC rides
along as stage 7 (Cowork's call, skippable); programs are rows in the D1 first band on the days they
air (Cowork's call, flagged); the list views get a program variant derived from the grid card
(Cowork's call, flagged).

---

## The ten stages, as the brief set them

- **Stage 0** — preconditions, the eleven documents, the four gates, the tripwire, source
  reachability with status and byte count, and the latest scheduled-refresh conclusions.
  Commit: `docs: events & shows source documents (from the Project)`.
- **Stage 1** — migration 0014 (eligibility rows for programs), the reconciler extended to programs,
  and the 98 NASCAR programs reconciled.
  Commit: `db: 0014 eligibility rows for programs; reconciler covers programs`.
- **Stage 2** — rendering-contract v1.7: the program card on both grids, the list-card variant,
  chips, `open_ended` reconciled, studio bookends, the "now" marker, eligibility on every program
  surface, the contract and the mobile addendum, and an acceptance pass.
  Commit: `render: v1.7 — program card (design of record v1.0), studio bookends, open-ended fade, now marker`.
- **Stage 3** — IndyCar 2026. Commit: `indycar: adapter against indycar.com; 2026 season loaded`.
- **Stage 4** — WWE. Commit: `wwe: adapter against wwe.com; Raw / SmackDown / PLEs loaded`.
- **Stage 5** — AEW. Commit: `aew: adapter; Dynamite / Collision loaded with per-episode network`.
- **Stage 6** — studio shows. Commit: `studio: registry + instances for the 2026 season; GameDay site parse; hand-curated GameDay and Big Noon crews`.
- **Stage 7** — UFC. Commit: `ufc: adapter against the Paramount+ schedule; cards loaded with CBS windows as data`.
- **Stage 8** — the refresh agent. Commit: `refresh: indycar, wwe, aew, studio, ufc steps — fail-honest per unit`.
- **Stage 9** — docs, the register, and this Project mirror.
  Commit: `docs: 2026-09-06 programs-live run; register close-outs; project mirror`.

**Report shape the brief asked for:** per stage what shipped and its commit; the gate table; every
backup path, dry-run summary and sanity-gate result with numbers; the DDL verbatim; the
source-reachability table from the laptop and from the runner; the tripwire history; every judgment
call; what was skipped and why; the open-items list; and **anything in the brief that turned out
wrong**, as its own section.

---

## Where the brief and the tree disagreed

Recorded here because the brief told the session to treat its own statements about the tree as claims
to verify, and five of them did not hold. All five are also in `claude_handoff-status.md`.

1. **0014 could not take 0012's shape.** `viewer_game_eligibility.game_id` is half the table's
   PRIMARY KEY, so "make it nullable" means dropping that primary key — which the approval forbids.
   Built additively as a separate `viewer_program_eligibility` instead.
2. **`src/` does not exist.** The Python SVG renderer is `scripts/render_day.py`.
3. **`docs/research/changelog.md` does not exist** — it is `docs/research/research-changelog.md`.
4. **Register §16 supersedes §13's chip roster**, which stage 2c did not account for: NASCAR and
   IndyCar share one Racing chip. The shipped roster already matched §16 and was left alone; only
   §9's series sub-filter was missing, and it shipped.
5. **`docs/research/studio-shows.md` §1 does not carry Sunday NFL Countdown**, which stage 6 listed
   among the shows to load. Three more of stage 6's named shows have no usable slot either.

Plus one the brief could not have known: **the ESPN Press Room GameDay page has no weekly
Date/Site/Game table.** Its one table is a historical January bowl table; the weekly site is prose
inside each week's own release, and that is what the loader parses.
