# MySports — Prompt 15: Ops Diagnosis + Fix Round + Ranks/Records/Rivalry (Unattended, 2026-09-03)

You are working in the MySports repo (C:\Users\jlull\Joe's Projects\Apps - Personal\MySports), branch main, HEAD 9e5ab9d. Joe is away; run ALL stages in succession WITHOUT waiting for approvals.

**Rails (same as the 09-02 combined run):** each stage ends with its own commit + push (rev-parse pair identical) before the next begins. A failing step: fix and retry ONCE; second failure → log, SKIP the item (or the stage if it cannot meaningfully complete), continue. Judgment log throughout; every skip in the final report. **Hard stops only for:** secret-gate match, a DB operation behaving destructively or hitting an unexpected FK, unrecoverable push rejection → write `artifacts/RUN_STOPPED.md` and stop. Never print any `.env` value. Secret gate before every commit; nothing under `assets/`, `artifacts/`, `.env`, `node_modules/` staged except existing `web/public/marks|fonts` files being modified. Windows Python conventions. **NO schema changes in this prompt** — migration 0009 belongs to prompt 16; everything here writes existing columns only. Playwright + Chromium are already installed from Stage 4 of the last run — reuse them.

Preconditions (log both): `git status --short` clean apart from always-untracked asset dirs; `python -m unittest discover tests` = 113 green.

---
## STAGE 1 — Ops: why has schedule_refresh never run?

The DB proves the problem: `mysports.refresh_runs` contains workflows `claude-code`, `bootstrap_season`, `cowork`, `standings` — **`schedule_refresh` has NEVER logged a run**. Today's data is fresh only because yesterday's laptop run refreshed it.

1. `gh run list --workflow schedule_refresh.yml --limit 10` (and `gh workflow list`). Three possible worlds — diagnose which:
   a. **Never dispatching** (cron missing/typo'd, workflow disabled, or the file only supports workflow_dispatch): fix the trigger (daily cron; keep dispatch), and confirm the workflow labels its runs `workflow=schedule_refresh` when writing `refresh_runs` — if the pipeline steps run under a different label or skip run-logging on Actions, fix that too, so the ledger can distinguish runner refreshes from laptop ones forever.
   b. **Dispatching but failing** — read the newest failed log. If ESPN endpoints return 403 (AkamaiGHost — the standing gotcha, confirmed from the cloud workspace 09-02): add a browser User-Agent to the shared HTTP helper used by `adapters/espn.py` and any other `site.api.espn.com` caller INCLUDING `pipeline/standings.py`'s NBA/NFL fetches (same class of fix as the `pub-…r2.dev` rule). If the failure is something else, fix what the log actually shows.
   c. **Succeeding but silent** — runs green yet no `refresh_runs` rows: the logging step is broken or conditionally skipped; fix it.
2. Prove the fix live: `gh workflow run schedule_refresh.yml`, wait for completion (`gh run watch` or poll), then verify via psycopg: a new `refresh_runs` row with today's timestamp and the correct workflow label, and fresh `source_observations`. Paste both.
3. If the runner turns out to be 403'd AND the UA fix does not clear it after one retry, log it as an open infrastructure risk (runner IP block), leave the laptop path as the working refresh, and continue — do not burn the run on it.
4. Commit: `Ops: schedule_refresh dispatch/logging fix (+ ESPN UA if applicable)` + attribution. Push.

## STAGE 2 — Repo/doc chores (small, own commit)

1. **Contract tag renumber:** in `docs/rendering-contract.md` §12, the 2026-09-02 Mobile Grid Addendum adoption entry is labeled `v1.5`, colliding with the existing v1.5 entry. Relabel that one entry `v1.6.4` (text otherwise unchanged).
2. **Research changelog:** append EXACTLY the following entry to `docs/research/research-changelog.md`:

<<<BEGIN CHANGELOG ENTRY
## 2026-09-02 — Brief 2: Events & Shows (Chat architecture session)
- **Requests recorded** (enhancement-register.md): NASCAR (3 series), UFC, IndyCar, WWE, AEW, studio/pregame shows.
- **Decisions (Joe):** programs supertype approved; individual sport chips; race only; UFC one card + segment timeline; purchasable content excluded (AEW PPV out); studio = pre/post bookends; hosts/locations sourced not curated; one nascar sport + series; WWE = Raw/SmackDown/PLEs, NXT out; design pass option (a) prototype-first; UFC/NASCAR odds under show_odds.
- **Correction logged:** register initially re-flagged the §21 betting-lines contradiction; it was resolved 08-31 (`show_odds`) and odds already render (prompt 13). Failure mode: memory carried a stale open item past its resolution. Rule: check handoff-status "SIX DECISIONS" before re-raising any decision.
- **Verified fetch-clean sources:** espnpressroom.com (GameDay site table), wwe.com (Drupal; Premier Shows block = calendar), paramountplus.com Sneak Peak UFC schedule (static WP), paramountpressexpress.com (CBS windows), indycar.com (season table). **JS-blank:** espn.com stories, nascar.com schedule pages.
- **Rights verified:** UFC P+ exclusive through 2033 + CBS partial windows; WWE Raw Netflix / SmackDown USA (3h) / PLEs ESPN Unlimited / SNME Peacock; AEW Dynamite TBS+HBO Max, Collision TNT+HBO Max (volatile), PPV $39.99 purchase; NASCAR Cup FOX→Prime→TNT→USA/NBC(+Peacock ×4), O'Reilly CW, Truck FS1 (2 FOX); IndyCar all FOX.
- **New standing gotcha:** ESPN `site.api.espn.com` returned Akamai 403 for ALL endpoints (incl. NFL) from the cloud workspace 09-02. Verify Actions runner; consider browser UA in adapters/espn.py.
- **Watch-task additions proposed:** GameDay/Big Noon site releases (weekly); AEW monthly WBD schedule + mid-month moves; WWE PLE carriage confirmation; NASCAR postponements.
- **Deliverables:** research-studio-shows.md, research-wwe.md, research-aew.md, research-ufc.md, research-nascar.md, research-indycar.md, research-summary-2.md, research-brief-2-events-and-shows.md, enhancement-register.md (v0.1 + decisions §7–§9).
END CHANGELOG ENTRY>>>

3. Commit: `Contract tag v1.6.4 + Brief 2 research changelog entry` + attribution. Push.

## STAGE 3 — Fix round (web) — Cowork's screenshot-review findings, Joe-ruled

The LOCKED mobile demo's card layout is the reference implementation (Joe's ruling 09-02). Fix all five, in `web/`:

1. **Listings first, everywhere.** Sport-filtered mobile views currently render the grid ABOVE the listing cards — Joe's ruling is LISTINGS FIRST as the mobile default in every view. Listings render first; the grid section follows below, with a small "Grid ↓" jump chip in the section header so it stays one tap away. Applies to every sport and the ALL view.
2. **Tiered name shrink is not engaging.** Card team names ellipsize ("Blue …", "Brew…"). The rule: 15px → 12.5px when the name exceeds 13 characters → 11px when it exceeds 19 — ellipsis only after all three tiers. Verify against the reference: on a 390px viewport, "Blue Jays", "Brewers", "White Sox", "Athletics" must all render whole.
3. **Sched/odds slot to the RIGHT column.** The status/odds slot currently sits bottom-left. The locked card puts it in the right-hand column: favored-team `_dark` logo + moneyline over O/U when a line exists; `SCHED`/`FINAL` otherwise. Restore the demo's geometry.
4. **Grid home line "@" prefix.** Grid blocks render "ALABAMA" — the contract (§3) requires `@ {rank} {TEAM}` on the home band; the "@" must render NOW, independent of rank data being null.
5. **Rail RSN labels.** Guardians TV must use its mark (it exists in the marks set). Networks with no mark: render a clean stacked abbreviation, NEVER a mid-word ellipsis — derive as: strip "presented by …" and suffixes, split on the first word boundary ≤10 chars per line, two lines max (e.g. "Marlins.TV", "Space City", "NBCS BA" style). No name may render with "…" in the rail.

Re-run the Stage-4 audit assertions from the last run against these five (plus the standing eight), re-screenshot every view to `artifacts/qa/2026-09-03/`, two-strikes-skip per item. `npm run build` clean; smoke still 30/30. Commit: `Fix round: listings-first, tier shrink, right slot, @ prefix, rail labels` + attribution. Push.

## STAGE 4 — Ranks / records / rivalry into the DB (no schema change — columns exist)

`games.home_rank / away_rank / home_record / away_record / is_rivalry` are null for all games; the PC renderer reads CFB enrichment files instead, and the app therefore cannot render rank prefixes or the marquee gold plate. Give them a loader path, following the 0007/0008 doctrine: **loader-written provider facts, never reconciled observations.**

1. **CFB ranks + records:** `pipeline/enrich_cfb.py` (or a load.py step — your call, log it): read the current week's `artifacts/validation/cfbd_2026_week{N}_enrichment.json` (fetch fresh via the existing probe script — CFBD key is in `.env` on this machine); write `home_rank/away_rank` from the §6 ranking rule (Playoff Committee if present, else AP; never Coaches) and `home_record/away_record` as display strings from the records block (conference form when both teams share a conference, exactly like the renderer's record_label). Null-safe: absent data never erases; a changed rank overwrites (polls move weekly).
2. **Rivalry:** from `data/rivalries.json`, set `is_rivalry` true for matching CFB games (tier stored if a column exists for it; otherwise tier-1-only per the marquee criterion — log which).
3. **Pro records:** the adapters already emit records (134 per refresh run). Ensure load.py writes `home_record/away_record` for pro games from the same data that feeds team_records, so the grid record run reads one consistent source. Pro ranks stay null — no polls; honest.
4. **Workflow:** add the CFB enrichment fetch + enrich step to `schedule_refresh.yml` on a weekly cadence (Tuesdays, after the poll drop) plus the daily record refresh.
5. **Acceptance:** run it live for CFB week 1 + this week's pro slates; verify via psycopg (paste counts: ranked games, record-carrying games, rivalry flags); then re-render the app's Saturday Sept 5 CFB view — rank prefixes ("@ 13 ALABAMA" style) and at least one MARQUEE gold plate must now appear if the slate qualifies (both-ranked or tier-1 rivalry; if none qualifies, show the nearest evidence honestly). Screenshot to `artifacts/qa/2026-09-03/`. Renderer regression: the archival PC render count line unchanged (`3 on grid · 0 TBA · 13 omitted` for the MLB fixture check). Tests: extend (rank parse, record display form, rivalry match, null-safety) — expect 117+.
6. Commit: `Ranks, records, rivalry: loader-written provider facts (games columns live)` + attribution. Push.

## FINAL REPORT
Consolidated: per-stage hashes; the Stage 1 diagnosis (which world it was, what fixed it, the live Actions run id + refresh_runs row); the audit checklist PASS/FIXED/SKIPPED with the five fix-round items called out; ranks/records/rivalry counts + the Sept 5 marquee evidence; test count; screenshot paths; judgment log; anything awaiting Joe. Note explicitly that migration 0009 / programs supertype was NOT touched (prompt 16).
