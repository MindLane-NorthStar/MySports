# Claude Code prompts — the build's as-run record

Every commit in this repository was produced by a Claude Code brief. Until 2026-09-06 none of those
briefs lived here: 01–44 in the Claude.ai Project, 45–49 in `Claude outputs\` on Joe's laptop, which
`.gitignore` excludes as `/Claude outputs/`. So the repo carried forty-nine prompts' worth of commits
and not one of the documents that produced them.

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

| # | file | original name in `Claude outputs\` |
|---|---|---|
| 19 | `19-live-state.md` | `phase4-claude-code-prompt-19-live-state.md` |
| 20 | `20-policy-and-favorites.md` | `phase4-claude-code-prompt-20-policy-and-favorites.md` |
| 21 | `21-bands-and-market-pending.md` | `phase4-claude-code-prompt-21-bands-and-market-pending.md` |
| 22 | `22-contract-repair.md` | `phase4-claude-code-prompt-22-contract-repair.md` |
| 23 | `23-weeks-and-season-load-superseded.md` | `phase4-claude-code-prompt-23-weeks-and-season-load.md` |
| 23 | `23-season-weeks-overlap.md` | `phase4-claude-code-prompt-23-season-weeks-overlap.md` |
| 40 | `40-cap-table.md` | `prompt-40-cap-table.md` |
| 43 | `43-night-run.md` | `prompt-43-night-run.md` |
| 43 | `43-banner-every-route.md` | `prompt-43-banner-every-route.md` |
| 44 | `44-safe-area.md` | `prompt-44-safe-area.md` |
| 45 | `45-banner-seam-headroom-pickers.md` | `prompt 45 - banner seam and headroom, DATE and WEEK header pickers, ALL SPORTS bar.md` |
| 46 | `46-night-run-ui-docs-reconciler-loads.md` | `prompt 46 - overnight run - UI batch, docs, reconciler, enums, D1 band, NHL NBA and NASCAR loads.md` |
| 47 | `47-programs-migrations-nhl-nba-nascar.md` | `prompt 47 - programs live - migrations, NHL NBA dispatch, NASCAR, v1.7 program card, IndyCar WWE AEW studio UFC, refresh agent, project mirror.md` |
| 48 | `48-programs-live-source-docs-v1.7.md` | `prompt 48 - programs live part 2 - source docs, eligibility 0014, v1.7 program card, IndyCar WWE AEW studio UFC, refresh agent, project mirror.md` |
| 49 | `49-nascar-times-race-key.md` | `prompt 49 - NASCAR start times corrected in place, 0016 stable race natural key.md` |

Every one was copied with `shutil.copyfile` and verified byte-identical to its source by `sha256`;
the table is in the prompt-49 run report.

## What is NOT here

**01–18, 24–39, 41, 42.** These exist only in the Claude.ai Project. **Cowork is extracting them and
will deliver them for prompt 50.** They were not reconstructed and no placeholder was written for
them — a placeholder in a historical record is worse than a gap, because a gap is visibly a gap.

Two of those are known to be in trouble:

- **42** — the brief itself has no known copy anywhere. Its *handoff* survives, untracked, at
  `assets/handoff/banner-v2/HANDOFF-Prompt-42.md`. What prompt 42 shipped is in
  `docs/handoff-status.md` (`fbfc2f8`, contract v1.6.13).
- **39** — **no trace anywhere.** Not in the Project's exported set, not on the laptop, not
  referenced by name in `docs/handoff-status.md`. Whether a prompt 39 ever existed is itself open.

## Duplicate numbers

Three numbers carry two files each, and they are two different situations:

- **23** — two versions of one brief, ninety minutes apart on 2026-09-03. The later
  (`23-season-weeks-overlap.md`, 08:57, 11,319 bytes) states a superset of the earlier's objective:
  *"season load, the Weeks page, **and the overlap rule**"* against *"full season load and the Weeks
  page"*. On that evidence — later timestamp, wider scope — the 08:04 draft is marked superseded.
  **If that reading is wrong, rename it; nothing depends on the mark.**
- **43** — **not two versions: two different briefs sharing a number.**
  `43-banner-every-route.md` is what `docs/handoff-status.md` records as prompt 43 (icon v7 → banner
  phone v2 → banner desktop v2 → the banner on every route). `43-night-run.md` is an unattended
  night run, an objective that reappears as prompt 46's *"the unattended night run (rebuilt
  2026-09-05)"*. Both are filed as they are; **which number the night run should carry is Joe's or
  Cowork's ruling, not this run's.**
- **26** — the brief for prompt 49 records that 26 also exists in two versions. Neither is on the
  laptop, so both arrive with Cowork's delivery.

## When the rest arrive

File them under the same rule, one commit, no edits to their content. If Cowork's copy of a prompt
already here differs from this one, **Cowork's is canonical** — these fifteen came from the laptop's
working drop folder, which is where a brief is pasted, not where it is archived.
