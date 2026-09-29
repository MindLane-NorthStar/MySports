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

**UPDATED 2026-09-10 BY PROMPT 87: 91 briefs, covering 01–87 — 92 covering 01–88 since prompt 88,
93 covering 01–89 since prompt 89, 94 covering 01–91 with 90 to follow since prompt 91, 95 covering
01–91 since prompt 90, 96 covering 01–92 since prompt 92, 98 covering 01–93 since prompt 93, 99 covering 01–94 since prompt 94, 100 covering 01–95 since prompt 95, 101 covering 01–96 since prompt 96, 102 covering 01–97 since prompt 97, 103 covering 01–98 since prompt 98, 104 covering 01–99 since prompt 99, 105 covering 01–100 since prompt 100, 106 covering 01–101 since prompt 101, 107 covering 01–102 since prompt 102, 116 covering 01–111 since prompt 111, 117 covering 01–112 since prompt 112, 118 covering 01–113 since prompt 113, 120 covering 01–113 since prompt 113 rev C filed rev B and itself, 121 covering 01–114 since prompt 114, 122 covering 01–114 since prompt 114 rev B, 123 covering 01–116 since prompt 116, 124 covering 01–117 since prompt 117, 125 covering 01–118 since prompt 118, 126 covering 01–119 since prompt 119, 127 covering 01–120 since prompt 120, 128 covering 01–122 with 121 to follow since prompt 122, 129 covering 01–123 with 121 to follow since prompt 123, 130 covering 01–124 with 121 to follow since prompt 124 (115 is reserved, not missing) — and 39 and 42 are still the only permanent gaps.** **The count stood at 107 for eight prompts** (103–110, 2026-09-16 to 2026-09-22) because the briefs stopped reaching `Claude outputs\` after 102 and lived only in the Project; prompt 111 filed all nine, with the weaker provenance the table below states. The count above was a timestamp twice over: prompt 81 had filed itself without the
count moving, and 61–80 and 82–87 were never filed at all. Prompt 87 copied those 28 files from
`Claude outputs\` (see Provenance), and **86 carries three** — see "Duplicate numbers".

That is the failure prompt 47 hit from the other side — the events & shows research lived only in the
Project, and a run that needed it could not read it — and the Project has already lost a session once
(`claude/session-reconstruction-2026-09-03.md`). This directory is the fix.

**These are HISTORY, not documentation.** A prompt records what was asked for on the day it ran,
including the parts that turned out to be wrong. Several of them are wrong in interesting ways and
the run reports say so. **`docs/handoff-status.md` is what is current**; a prompt is only ever
evidence of why a commit exists.

## Naming

`NN-slug.md` — the prompt number zero-padded to two digits, then a short slug describing the
objective. From prompt 100 the number runs to three digits and is not padded further, so a plain
directory listing sorts `100-…` between `10-…` and `11-…`; the table below is in number order.
**Content is verbatim and is never edited after the fact.** A brief that was revised
before it ran is filed in its final form; a superseded draft that also survives is filed beside it
with `-superseded` in the name.

## What is here

One hundred and thirty briefs, `NN-slug.md` (this line said fifty-one until prompt 87, ninety-one until 88,
ninety-two until 89, ninety-three until 91, ninety-four until 90, ninety-five until 92, ninety-six until 93, ninety-eight until 94, ninety-nine until 95, one hundred until 96, one hundred and one until 97, one hundred and two until 98, one hundred and three until 99, one hundred and four until 100, one hundred and five until 101, one hundred and six until 102, one hundred and seven until 111, one hundred and sixteen until 112, one hundred and seventeen until 113, one hundred and eighteen until 113 rev C, one hundred and twenty until 114, one hundred and twenty-one until 114 rev B, one hundred and twenty-two until 116, one hundred and twenty-three until 117, one hundred and twenty-four until 118, one hundred and twenty-five until 119, one hundred and twenty-six until 120, one hundred and twenty-seven until 122, one hundred and twenty-eight until 123, one hundred and twenty-nine until 124 — counted from the directory each time, not incremented). Numbers in **bold** carry
more than one file or are otherwise not what the number alone suggests; everything else is one brief,
one file.

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
| **48** | `48-programs-live-source-docs-v1.7.md` — *filed from `Claude outputs\` in `7a0fcf5`* |
| **48** | `48-programs-live-part-2.md` — *recovered 2026-09-11 from the gitignored `handoff/project-mirror/`; provenance under "Duplicate numbers"* |
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
| 61 | `61-split-header-and-unshipped-logo-art.md` |
| 62 | `62-the-split-on-the-proven-route.md` |
| 63 | `63-wordmark-picker-plate-spread-finals.md` |
| 64 | `64-pro-logo-rulings.md` |
| 65 | `65-pro-grid-card-colours.md` |
| 66 | `66-college-logo-rulings-record-faults.md` |
| 67 | `67-tonight-band-goes-week-scrolls-to-now.md` |
| 68 | `68-opens-on-the-banner-landing-buffer.md` |
| 69 | `69-the-buffer-endcap-rulings-two-holes.md` |
| 70 | `70-two-open-items-from-69.md` |
| 71 | `71-cache-busting-banner-pregame-order-watch-links.md` |
| 72 | `72-local-rsn-data-text-rendering-audit.md` |
| 73 | `73-banner-stays-until-the-scroll.md` |
| 74 | `74-three-amendments-to-73.md` |
| **75** | `75-one-chronological-run-favourite-marker.md` — *no commit carries it; see below* |
| **76** | `76-dead-guardians-link-checker-mlb-game-specific.md` — *no commit carries it; see below* |
| 77 | `77-scores-without-rerender-live-box-score.md` |
| 78 | `78-four-blocks-mlb-id-drift-watch-links-list-order.md` |
| 79 | `79-owed-gate-fix-clean-bundle-c-and-d.md` |
| 80 | `80-push-banked-tripwire-block-d-icon-v8.md` |
| 81 | `81-mlbtv-deeplink-favourite-mark-icon-v8-banner.md` |
| 82 | `82-close-f-push-then-d2.md` |
| 83 | `83-close-d2-then-block-e.md` |
| 84 | `84-block-e-render-proof.md` |
| 85 | `85-commit-e.md` |
| **86** | `86-countdown-gamelink-stickytimes.md` — *the first issue; RAN for Block A, which it built and stopped before committing* |
| **86** | `86-rev-b-countdown-push-gamelink-stickytimes-superseded.md` — *not pasted into the session that ran 86* |
| **86** | `86-rev-c-selfcommit-countdown-gamelink-stickytimes.md` — *what RAN for A′, B and C* |
| 87 | `87-closeout-backfill-preview.md` — *filed by the run it describes* |
| 88 | `88-nfl-window-rule14.md` — *written into the tree by Cowork before the run; committed with its work* |
| 89 | `89-rules-ownership-casebook.md` — *copied from `Claude outputs\` by the run it describes, byte-identical by `sha256`* |
| **90** | `90-cfb-records.md` — *the text that ran (RUN 2, rev B), filed by the run it describes; it ran AFTER 91 — the numbers are identifiers, not a run order* |
| **91** | `91-autonomy-default.md` — *the text that ran, from `RUN-1-commit-89-and-autonomy-2026-09-11.md`; an earlier Block-1-only draft survives as `prompt-91-autonomy-default-2026-09-11.md` in `Claude outputs\` and was NOT filed, because the run's scope named only this path* |
| 92 | `92-refresh-timeout.md` — *RUN 3, filed by the run it describes* |
| 93 | `93-r2-sync-diagnosis.md` — *rev C, the text that ran. Revs A and B each stopped at their own stop condition before any change and are NOT filed; rev B carried rev A's corrected content in full, and the incident is in `docs/rules-casebook.md` (rules 30 and 33)* |
| 94 | `94-r2-byte-compare.md` — *filed by the run it describes* |
| 95 | `95-push-guard-and-conflicts.md` — *filed by the run it describes* |
| 96 | `96-logo-ruling-case.md` — *filed by the run it describes* |
| 97 | `97-cron-off-the-hour.md` — *filed by the run it describes* |
| 98 | `98-drop-standalone-render.md` — *filed by the run it describes* |
| 99 | `99-ios27-status-bar.md` — *rev B, the text that ran, filed by the run it describes. Rev A (`prompt-99-ios27-status-bar-2026-09-15.md` in `Claude outputs\`, 11,471 bytes) changed the value and left the follow-up unmeasured; no commit carries it — rev B's run found HEAD at `d6cd7b2`, prompt 98's commit, with no tracked change — and it is NOT filed, because the run's scope named only this path* |
| 100 | `100-remove-agents-md.md` — *filed by the run it describes; the first three-digit number* |
| 101 | `101-banner-pin-and-scroll-recovery.md` — *filed by the run it describes; block B ships PROVISIONAL, pending Joe's device* |
| 102 | `102-close-device-confirmations.md` — *filed by the run it describes; closes prompts 99 and 101's device items* |
| **103** | `103-refresh-latency-measurement.md` — *read-only measurement; its own text says "no code changes, no commits, no pushes", and no commit carries it. Filed by prompt 111 (see Provenance: no second copy)* |
| 104 | `104-cavs-ota-simulcast-data-and-marks.md` — *`55b946c`; filed by prompt 111* |
| 105 | `105-composite-width-match.md` — *`875a50b`; filed by prompt 111* |
| 106 | `106-simulcast-rows-list-collapse-grid-lanes.md` — *`322b38f`; filed by prompt 111* |
| **107** | `107-mobile-grid-at-tablet-widths.md` — *read-only measurement; its own text says "no tracked file changes, no commits, no push, no gates", and no commit carries it; its output is untracked `assets/p107-tablet-grid/`. Filed by prompt 111* |
| **108** | `108-standings-row-truncation-check.md` — *read-only diagnostic; its own text says "no fix, no gate edit, no commit, no push", and no commit carries it — prompt 109 is the fix. Filed by prompt 111* |
| 109 | `109-standings-pagination-and-the-cap-guard.md` — *`37f5d3f` and `dde41c7`; its push follow-up is `506f081`; filed by prompt 111* |
| 110 | `110-tablet-grid-band-and-gridindex.md` — *`69616fe`; filed by prompt 111* |
| 111 | `111-handoff-corrections-and-prompt-archive.md` — *filed by the run it describes* |
| 112 | `112-dark-band-logo-class.md` — *filed by the run it describes; its block A measurement contradicts the mechanism the brief states, and queue item 11 records what was measured* |
| **113** | `113-cap-table-on-the-ruled-band.md` — *filed by the run it describes; the run stopped on seven unruled rows* |
| | `113-cap-table-on-the-ruled-band-rev-B.md` — *Joe's ruling on the seven (keep them) and three things the brief missed; filed by rev C as a rendered-text transcription, REPLACED by prompt 114 with the Project's own bytes (same words, the Markdown restored)* |
| | `113-cap-table-on-the-ruled-band-rev-C.md` — *Joe's review of the 21 pairs: six pins; filed by the run it describes* |
| **114** | `114-ipad-navbar-scrim-headroom.md` — *copied by the run it describes from `Claude outputs\`, byte-identical* |
| | `114-ipad-navbar-scrim-headroom-rev-B.md` — *the placeholder rule widened, then 114 committed; copied by the run it describes, byte-identical* |
| 116 | `116-postseason-matchups-and-tbd-badge.md` — *copied by the run it describes from `Claude outputs\`, byte-identical; 115 stays reserved for preemption* |
| 117 | `117-cleveland-nfl-assignment-from-station-listings.md` — *copied by the run it describes from `Claude outputs\`, byte-identical* |
| 118 | `118-cleveland-nfl-windows-from-entitledsports.md` — *copied by the run it describes from `Claude outputs\`, byte-identical* |
| 119 | `119-windows-per-week-and-playoffs-national.md` — *copied by the run it describes from `Claude outputs\`, byte-identical* |
| 120 | `120-codex-agents-md-self-heal.md` — *copied by the run it describes from `Claude outputs\`, byte-identical* |
| 122 | `122-icon-v9-install-and-deploy.md` — *filed by the run it describes from the brief pasted into the session; no `Claude outputs\` copy exists, so the same limitation as the 112 row applies. 121 is not filed here: as of 2026-09-24 its brief sits in `Claude outputs\` and no run of it has reached this tree — a timestamp, not a permanent gap* |
| 123 | `123-eligibility-follows-access-changes.md` — *copied by the run it describes from `Claude outputs\`, byte-identical. 121 was still unrun and unfiled on 2026-09-28, and its brief names register §66, which 123 took by its own fallback: 121 takes the next free number* |
| 124 | `124-tbd-badge-check-from-a-fixture.md` — *copied by the run it describes from `Claude outputs\`, byte-identical. 121 still unrun on 2026-09-29; 124 took register §67, so 121 takes §68 or the next free number* |

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

Seven numbers carry more than one file — 23, 26, 43, 48 and 114 two each, 86 and 113 three — and each is a different
situation (86 added by prompt 87, 48 by prompt 93, 113's two revisions by prompt 113 rev C, 114's rev B by itself; `13-14-combined-…` is the merged run of two numbers and
has its own row, so it is not counted here):

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
- **86** — **three revisions of one brief, and two of them ran** (prompt 87 filing). The first issue
  (`86-countdown-gamelink-stickytimes.md`) was pasted into Claude Code and its Block A was built and
  gated, then stopped for approval as that brief required. **Rev. B** said it superseded the first and
  was itself superseded by **rev. C**; it was never pasted into the session that ran prompt 86, hence
  `-superseded`. Rev. C (`86-rev-c-selfcommit-countdown-gamelink-stickytimes.md`) is what ran for
  Block A′ (committing A as `1b458a0`), Block B (`a24f7af`) and Block C (`f08d7dc`).
- **48** — **two texts, and which relation they have is NOT DETERMINED** (prompt 93). The second,
  `48-programs-live-part-2.md`, was recovered on 2026-09-11 from the gitignored `handoff/project-mirror/`,
  where it was `claude_phase4-claude-code-prompt-48-programs-live.md` — the Claude Project's naming —
  **9,684 bytes, mtime 2026-09-05 22:07 UTC (18:07 ET)**. It had never been filed here, and no
  byte-identical copy existed in git history or anywhere under the repo, so deleting that directory
  would have destroyed it. It is filed with nothing added: its provenance lives here, not in the file.
  **Whether it is an earlier draft of 48 or a genuine second block is not determined** — its title says
  "programs go live, part 2", as the filed brief's does, and it is about a quarter of that brief's
  35,934 bytes. Neither fact settles it, and it is not settled by inference.

## 75 and 76 — filed, and no commit carries them

Both briefs exist and are filed verbatim. **`docs/handoff-status.md` records that neither reached the
repository**: prompt 77's run found HEAD at `392d08b`, prompt 74's commit, with a clean tree. Their
objectives reappear later — the chronological band and the favourite mark in prompts 80 and 82, the
dead Guardians link and the MLB game-specific question in prompts 78 and 81. That is a reading of the
briefs' titles against later ones, not a record anybody wrote at the time.

## 103, 107 and 108 — filed, and no commit carries them

All three were read-only runs by their own text: 103 (*"Read-only. No code changes, no commits, no
pushes."*), 107 (*"Read-only measurement. No tracked file changes, no commits, no push, no gates."*)
and 108 (*"Read-only diagnostic. No fix, no gate edit, no commit, no push, no gates run."*).
`docs/handoff-status.md` carries no measurement paragraph for 103 or 107 and names 108 only inside
prompt 109's paragraph, as the run that measured what 109 fixed; that is consistent with the briefs
and is the same standing 75 and 76 have above. Their outputs live elsewhere: 107's under untracked
`assets/p107-tablet-grid/`, 108's in prompt 109's register entry (§54), and 103's in the run report
only.

## Provenance

| range | came from |
|---|---|
| 01–17, 24–38 | the Claude.ai Project's `claude/` namespace, originally `phase4-claude-code-prompt-{N}[-slug].md` |
| 18 | `artifacts/cowork-scratch-2026-09-03/` (gitignored) |
| 19–23, 40, 43, 44 | `Claude outputs\` on the laptop |
| 41 | `artifacts/cap-study/` (gitignored) |
| 45–49 | `Claude outputs\prompt NN - ….md` |
| 61–80, 82–87 | `Claude outputs\prompt-NN[-slug].md` — filed by prompt 87 with `shutil.copyfile`, **28 of 28 byte-identical by `sha256`**, zero collisions, all LF. `81` was already here and is byte-identical to its `Claude outputs\` copy |
| 88 | written into `docs/prompts/` directly by Cowork before the run, and committed with its work (`8f3b3c1`) |
| 89 | `Claude outputs\prompt-89-rules-ownership-casebook-2026-09-11.md` — copied by prompt 89 with `shutil.copyfile`, byte-identical by `sha256` (`0b2ceb13…498b`, 17,434 bytes), LF |
| 90 | `Claude outputs\RUN-2-cfb-records-2026-09-11.md` — copied by the run it describes with `shutil.copyfile`, byte-identical by `sha256` (`fb345a2e…5d1c`, 25,678 bytes), LF |
| 91 | `Claude outputs\RUN-1-commit-89-and-autonomy-2026-09-11.md` — copied by the run it describes with `shutil.copyfile`, byte-identical by `sha256` (`7973fa98…1ca9`, 16,549 bytes), LF |
| 92 | `Claude outputs\RUN-3-raise-refresh-timeout-2026-09-11.md` — copied by the run it describes with `shutil.copyfile`, byte-identical by `sha256` (`472ef2c8…e612`, 7,754 bytes), LF |
| 93 | `Claude outputs\RUN-4-rev-C-mirror-and-queue9-2026-09-11.md` — copied by the run it describes with `shutil.copyfile`, byte-identical by `sha256` (`b4e4b6fb…e48f`, 12,893 bytes), LF |
| 94 | `Claude outputs\prompt-94-r2-byte-compare-2026-09-11.md` — copied by the run it describes with `shutil.copyfile`, byte-identical by `sha256` (`9521203e…433e`, 13,852 bytes), LF |
| 95 | `Claude outputs\prompt-95-push-guard-and-conflicts-2026-09-14.md` — copied by the run it describes with `shutil.copyfile`, byte-identical by `sha256` (`4f385aee…6efd`, 11,957 bytes), LF |
| 96 | `Claude outputs\prompt-96-logo-ruling-case-2026-09-14.md` — copied by the run it describes with `shutil.copyfile`, byte-identical by `sha256` (`1f8e0a34…f9f1`, 12,165 bytes), LF |
| 97 | `Claude outputs\prompt-97-cron-off-the-hour-2026-09-14.md` — copied by the run it describes with `shutil.copyfile`, byte-identical by `sha256` (`ecd64fdb…ae17`, 10,201 bytes), LF |
| 98 | `Claude outputs\prompt-98-drop-standalone-render-2026-09-14.md` — copied by the run it describes with `shutil.copyfile`, byte-identical by `sha256` (`56a87acb…7c2c`, 10,308 bytes), LF |
| 99 | `Claude outputs\prompt-99-rev-B-ios27-status-bar-2026-09-15.md` — copied by the run it describes with `shutil.copyfile`, byte-identical by `sha256` (`d740da72…0d1a`, 13,708 bytes), LF |
| 100 | `Claude outputs\prompt-100-remove-agents-md-2026-09-15.md` — copied by the run it describes with `shutil.copyfile`, byte-identical by `sha256` (`508abf19…fbbe4`, 6,569 bytes), LF |
| 101 | `Claude outputs\prompt-101-banner-pin-and-scroll-recovery.md` — copied by the run it describes with `shutil.copyfile`, byte-identical by `sha256` (`ba82cc55…34f4`, 13,371 bytes), LF |
| 102 | `Claude outputs\prompt-102-close-device-confirmations.md` — copied by the run it describes with `shutil.copyfile`, byte-identical by `sha256` (`795359ce…709f`, 8,294 bytes), LF |
| **103–111** | **NO SECOND COPY, and this row is weaker than every other row in this table.** `Claude outputs\` stops at prompt 102 (its newest brief is `prompt-102-close-device-confirmations.md`, verified 2026-09-22; the only later object there is `prompt-archive-delta.zip` from 2026-09-05, which holds 01–44 and none of these). The source is the Claude.ai Project document, transcribed through a Cowork session into the tree as untracked files; prompt 111 verified each by `sha256` and `stat` against Cowork's table — 103 `3a509237…` 6,176 bytes; 104 `ee21a52c…` 8,776; 105 `ba187750…` 6,103; 106 `39188566…` 8,171; 107 `0f8558a6…` 6,536; 108 `4b80a830…` 7,309; 109 `992efa62…` 11,251; 110 `0389b8d7…` 6,186; 111 `b67f0541…` 12,348 — all LF, each ending in a newline, none colliding with a tracked name. **Those hashes prove the container→laptop transfer was clean. They prove nothing about Project→container fidelity, because there is nothing to compare against.** Every other row here has a surviving second copy; these nine do not, and a reader should weight them accordingly |
| 113 | typed into `docs/prompts/` by the run itself from the brief as delivered; **byte-compared against the Project copy by Cowork on 2026-09-23: identical** (9,937 bytes, `sha256` `2b65861c…`), so this row now has a surviving second copy and stands at full strength |
| 113 rev B | **REPLACED by prompt 114 with the Project's bytes** — `Claude outputs\prompt-113-rev-B-project-copy-2026-09-22.md`, copied with `shutil.copyfile`, byte-identical by `sha256` (`aef2295c…7344`, 5,469 bytes), LF. The copy rev C had typed from the session was the same words with every piece of Markdown stripped (98 backticks, 28 bold markers, 4 headings, the rules and the bullets): a rendered-text transcription, 5,268 bytes, `cf0d27bf…` |
| 113 rev C | typed into `docs/prompts/` by the run itself from the brief as delivered in the session; Chat wrote it and it was never filed to the Project, so **no second copy exists** — the same limitation as 103–111 |
| 114 | `Claude outputs\prompt-114-ipad-navbar-scrim-headroom-2026-09-23.md` — copied by the run it describes with `shutil.copyfile`, byte-identical by `sha256` (`7672029f…`, 20,222 bytes), LF |
| 114 rev B | `Claude outputs\prompt-114-rev-B-placeholder-rule-then-commit-2026-09-23.md` — copied by the run it describes with `shutil.copyfile`, byte-identical by `sha256` (`b6756a8a…c50b36`, 7,254 bytes), LF |
| 116 | `Claude outputs\prompt-116-postseason-matchups-and-tbd-badge-2026-09-23.md` — copied by the run it describes with `shutil.copyfile`, byte-identical by `sha256` (`d7e9d755…d1f440`, 9,801 bytes), LF |
| 117 | `Claude outputs\prompt-117-cleveland-nfl-assignment-from-station-listings-2026-09-23.md` — copied by the run it describes with `shutil.copyfile`, byte-identical by `sha256` (`25113202…4fe9`, 11,918 bytes), LF |
| 118 | `Claude outputs\prompt-118-cleveland-nfl-windows-from-entitledsports-2026-09-23.md` — copied by the run it describes with `shutil.copyfile`, byte-identical by `sha256` (`0efe0cca…7eefd`, 8,692 bytes), LF |
| 119 | `Claude outputs\prompt-119-windows-per-week-and-playoffs-national-2026-09-23.md` — copied by the run it describes with `shutil.copyfile`, byte-identical by `sha256` (`475a45ed…91b3`, 3,966 bytes), LF |
| 120 | `Claude outputs\prompt-120-codex-agents-md-self-heal-2026-09-23.md` — copied by the run it describes with `shutil.copyfile`, byte-identical by `sha256` (`5e78be5f…6731`, 6,702 bytes), LF |
| 122 | written into `docs/prompts/` by the run it describes from the brief pasted into the session, as 112 was by Cowork; no `Claude outputs\` copy exists, so the same limitation as the 103–111 row applies. Verified by the run: 4,898 bytes, `sha256` `2fcd802d…6e4e`, LF, zero CR bytes |
| 123 | `Claude outputs\prompt-123-eligibility-follows-access-changes-2026-09-28.md` — copied by the run it describes with `shutil.copyfile`, byte-identical by `sha256` (`19496e3a…c68f`, 7,329 bytes), LF |
| 124 | `Claude outputs\prompt-124-tbd-badge-check-from-a-fixture-2026-09-28.md` — copied by the run it describes with `shutil.copyfile`, byte-identical by `sha256` (`beb871be…38ad`, 5,811 bytes), LF |
| 112 | written into `docs/prompts/` by Cowork before the run, as 88 was; no `Claude outputs\` copy exists, so the same limitation as the 103–111 row applies. Verified by the run: 13,403 bytes, `sha256` `a260938d…`, LF, zero CR bytes |
| 48 (second file) | `handoff/project-mirror/claude_phase4-claude-code-prompt-48-programs-live.md` (gitignored, deleted by prompt 93 after this copy) — copied with `shutil.copyfile`, whole file byte-identical by `sha256` (`84358ed7…366b`, 9,684 bytes), LF, nothing added |

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
