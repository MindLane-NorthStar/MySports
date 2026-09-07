# Claude Code prompts — the build's as-run record

Every commit in this repository was produced by a Claude Code brief. Until 2026-09-06 none of those
briefs lived here: 01–44 in the Claude.ai Project, 45–49 in `Claude outputs\` on Joe's laptop, which
`.gitignore` excludes as `/Claude outputs/`. So the repo carried forty-nine prompts' worth of commits
and not one of the documents that produced them.

**As of 2026-09-06 the archive is complete except for two acknowledged gaps.** Prompt 49
stage 2 filed the fifteen it could reach from the laptop; prompt 50 filed the **36** that existed
only in the Project or under gitignored `artifacts/`; prompt 52 stage 8 filed itself; and 50 and 51
were filed from `Claude outputs\` afterwards; prompts 53-60 filed themselves. **62 files are here, covering 01-60. 39 and 42 are missing,
and they are not going to be found** — see "The two gaps" below.

That is the failure prompt 47 hit from the other side — the events & shows research lived only in the
Project, and a run that needed it could not read it — and the Project has already lost a session once
(`claude/session-reconstruction-2026-09-03.md`). This directory is the fix.

**These are HISTORY, not documentation.** A prompt records what was asked for on the day it ran,
including the parts that turned out to be wrong. Several of them are wrong in interesting ways and
the run reports say so. **`docs/handoff-status.md` is what is current**; a prompt is only ever
evidence of why a commit exists.

## Naming

`NN-slug.md` — the prompt number zero-padded to two digits, then a short slug describing the
objective. **Content is verbatim and is never edited after the fact.** A brief that was revised
before it ran is filed in its final form; a superseded draft that also survives is filed beside it
with `-superseded` in the name.

## What is here

Fifty-one briefs, `NN-slug.md`. Numbers in **bold** carry two files each or are otherwise not what
the number alone suggests; everything else is one brief, one file.

| # | file |
|---|---|
| 01 | `01-league-adapters-renderer-v1.5.md` |
| 02 | `02-deployment-contract-nba-renderer-v1.6.md` |
| 03 | `03-pipeline-loader-first-live-load.md` |
| 04 | `04-bootstrap-hygiene-week8-fixture.md` |
| 05 | `05-reconciliation-engine-0006.md` |
| 06 | `06-reconcile-resume-cavs-dazn.md` |
| 07 | `07-renderer-reads-database.md` |
| 08 | `08-mlb-adapter.md` |
| 09 | `09-loader-rejects-db-feeds.md` |
| 10 | `10-final-scores-grid-registry.md` |
| 11 | `11-render-timestamp-determinism.md` |
| 12 | `12-overnight-web-app-skeleton.md` — *carries the publishable anon key; see the disclosure below* |
| 13 | `13-standings-probables-display-names.md` |
| **13–14** | `13-14-combined-standings-and-design.md` — the merged unattended run of the two |
| 14 | `14-mobile-addendum-design-application.md` |
| 15 | `15-ops-diagnosis-ranks-records-rivalry.md` |
| 16 | `16-design-assets-banner.md` |
| 17 | `17-spec-v0.5-migration-0009.md` |
| 18 | `18-deploy-readiness.md` |
| 19 | `19-live-state.md` |
| 20 | `20-policy-and-favorites.md` |
| 21 | `21-bands-and-market-pending.md` |
| 22 | `22-contract-repair.md` |
| **23** | `23-weeks-and-season-load-superseded.md` |
| **23** | `23-season-weeks-overlap.md` |
| 24 | `24-network-tbd.md` |
| 25 | `25-visual-pass.md` |
| **26** | `26-grid-zoom-and-pwa-superseded.md` |
| **26** | `26-rulings-and-ios.md` |
| 27 | `27-page-order.md` |
| 28 | `28-square-tiles.md` |
| 29 | `29-right-slot.md` |
| 30 | `30-grid-rail-zoom.md` |
| 31 | `31-controls-block.md` |
| 32 | `32-grid-team-bands.md` |
| 33 | `33-drop-the-at.md` |
| 34 | `34-regressions.md` |
| 35 | `35-merged-unattended.md` |
| 36 | `36-chrome-weeks-grid.md` |
| 37 | `37-data-grid-card.md` |
| 38 | `38-ranking-nhl-tbs.md` |
| 39 | **MISSING — no trace anywhere** |
| 40 | `40-cap-table.md` |
| 41 | `41-ink-fix.md` |
| 42 | **MISSING — handoff only, at `assets/handoff/banner-v2/HANDOFF-Prompt-42.md`** |
| **43** | `43-night-run.md` — *drafted and shelved; never ran* |
| **43** | `43-banner-every-route.md` — *what ran* |
| 44 | `44-safe-area.md` |
| 45 | `45-banner-seam-headroom-pickers.md` |
| 46 | `46-night-run-ui-docs-reconciler-loads.md` |
| 47 | `47-programs-migrations-nhl-nba-nascar.md` |
| 48 | `48-programs-live-source-docs-v1.7.md` |
| 49 | `49-nascar-times-race-key.md` |
| 50 | `50-schedule-hub-foundation.md` |
| 51 | `51-one-gap-shorter-toggles-my-teams.md` |
| 52 | `52-metallic-gold-rail-nascar-studio-marks.md` |
| 53 | `53-hub-architecture-studio-logos.md` |
| 54 | `54-week-grid.md` |
| 55 | `55-list-grid-split-network-marks.md` |
| 56 | `56-approved-revisions-vertical-rhythm.md` |
| 57 | `57-odds-pipeline-third-grey-banner-generator.md` |
| 58 | `58-collapsing-header.md` |
| 59 | `59-favourites-bracket-and-two-harvests.md` |
| 60 | `60-navbar-and-my-teams.md` |

## What is NOT here — the two gaps

**Prompt 39 and prompt 42's briefs do not exist anywhere.** Not in the Project's exported set, not on
the laptop, not under `artifacts/`. They were **not reconstructed and no placeholder was written**:
an invented brief filed beside real ones is worse than an acknowledged gap, because a gap is visibly
a gap and a placeholder is not.

- **42** — the brief is gone; its **handoff survives**, untracked, at
  `assets/handoff/banner-v2/HANDOFF-Prompt-42.md`. What 42 shipped is in `docs/handoff-status.md`:
  `fbfc2f8`, contract v1.6.13, the card's fit order mirroring the grid's.
- **39** — **no trace at all.** Its commits are in `git log`; whether a brief was ever written for it
  is itself open.

## Duplicate numbers

Three numbers carry two files each, and they are three different situations:

- **23** — two versions of one brief, ninety minutes apart on 2026-09-03. The later
  (`23-season-weeks-overlap.md`, 08:57) states a superset of the earlier's objective: *"season load,
  the Weeks page, **and the overlap rule**"* against *"full season load and the Weeks page"*. On that
  evidence — later timestamp, wider scope — the 08:03 draft is marked superseded. **If that reading
  is wrong, rename it; nothing depends on the mark.**
- **26** — two versions, and the difference is itself part of the record.
  `26-grid-zoom-and-pwa-superseded.md` was replaced by `26-rulings-and-ios.md`, which **dropped the
  grid-zoom fix** — Joe ruled it should wait for his phone — and carried the prompt-25 rulings
  instead. Both are filed.
- **43** — **not two versions: two different briefs sharing a number.**
  `43-banner-every-route.md` is what `docs/handoff-status.md` records as prompt 43 (icon v7 → banner
  phone v2 → banner desktop v2 → the banner on every route). **`43-night-run.md` was drafted and
  shelved and never ran** — its objective reappears as prompt 46's *"the unattended night run
  (rebuilt 2026-09-05)"*. Cowork's copy of that file is named `43-night-run-shelved.md`; the repo
  keeps the shorter name and this line carries the fact instead.

## Provenance

| range | came from |
|---|---|
| 01–17, 24–38 | the Claude.ai Project's `claude/` namespace, originally `phase4-claude-code-prompt-{N}[-slug].md` |
| 18 | `artifacts/cowork-scratch-2026-09-03/` (gitignored) |
| 19–23, 40, 43, 44 | `Claude outputs\` on the laptop |
| 41 | `artifacts/cap-study/` (gitignored) |
| 45–49 | `Claude outputs\prompt NN - ….md` |

The fifteen filed by prompt 49 were copied with `shutil.copyfile` and verified byte-identical to
their sources by `sha256`. The 36 filed by prompt 50 were extracted from
`Claude outputs\prompt-archive-delta.zip` (204,133 bytes) with Python's `zipfile` — not a shell
unzip, because both paths contain characters that break one — and verified the same way: **36 of 36
byte-identical, zero filename collisions.**

## One disclosure, made once

**`12-overnight-web-app-skeleton.md` carries the Supabase anon key inline** in its stage-5 section.
That key is **publishable by design** — the same value is committed in `web/lib/config.js` and
documented as publishable in `docs/deployment-contract.md` — so filing the brief verbatim changes
nothing about this project's exposure. It is named here so nobody has to wonder on finding it.

**The writer credential and the CFBD key appear in no prompt.** Every brief that touches them says
*"never print any value from `.env`."*

## Verbatim means verbatim

These files are byte-for-byte what was pasted into Claude Code, with only the file names changed —
the same rule `docs/research/README-events-docs.md` established for the events documents. **Several
of them are wrong about the codebase**, sometimes in ways their own run reports then corrected. That
is why the reports matter, and why nothing here is edited to look better in hindsight.

**50 and 51 were filed late, and the miss is worth recording.** Prompt 50 was told to file 01–44
and to expect a fixed count here afterwards, so it left itself out rather than quietly changing that
count — deliberate, and this note is what it left behind. Prompt 51 then inherited the same omission.
Prompt 52 stage 8 went looking for both, reported them as unreconstructable, and closed. **They were
never lost:** both sat in `Claude outputs\` the whole time, and the paragraph this replaces named
prompt 50's path exactly. A "not yet filed" note is not a gap, and a run that finds one should read
the note before concluding the document is gone.
