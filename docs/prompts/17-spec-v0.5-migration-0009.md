# MySports — Prompt 17: Spec v0.5 Program Model + Migration 0009 (Unattended)

You are working in the MySports repo (C:\Users\jlull\Joe's Projects\Apps - Personal\MySports), branch main (verify HEAD is the design-assets prompt-16 commit or later before starting). Joe is away; run all stages in succession without approvals. This prompt implements the ARCHITECTURE ONLY of the Events & Shows batch — the `programs` supertype Joe approved 2026-09-02. **No adapters, no UI, no rendering changes, no studio-show data.** After this run, the app and grids must look and behave IDENTICALLY; the only change is that the database can now describe non-game programming.

**Rails (standard):** each stage self-commits + pushes before the next; failing step retried once then logged-and-skipped; hard stops only for secret-gate match / destructive-DB surprise / unrecoverable push rejection (write `artifacts/RUN_STOPPED.md`). Never print `.env` values; secret gate every commit; nothing under `assets/`, `artifacts/`, `.env`, `node_modules/` staged. Windows Python conventions. **Migration 0009 live apply is authorized — ADDITIVE ONLY, backups first.** If any statement would drop, rewrite, or narrow an existing table/column/enum, that is a hard stop, not a workaround.

Preconditions (log): clean tree; 131 tests green; `refresh_runs` shows a recent github-actions schedule_refresh success (the daily cron from prompt 15 — confirm it is still green before touching anything).

Authority for this design: Joe's decisions of 2026-09-02 (enhancement register §7–§9). Binding points repeated here so nothing drifts: programs supertype approved, NO NASCAR exception (one `sport=nascar` + `series` cup/oreilly/truck); motorsport = race only (no practice/qualifying sessions); UFC = ONE card per event with a `segments` timeline, CBS carried as a broadcast WINDOW; **purchasable content EXCLUDED — do NOT create a `purchasable` access state** (AEW scope = Dynamite/Collision + included-with-subscription specials only); studio shows = pregame/postgame bookends only, no chip, hosts/locations sourced from public announcements; WWE = Raw/SmackDown/main-roster PLEs, NXT dropped, SNME treated as PLE-class special_event (flag as assumption in the spec).

---
## STAGE A — Spec v0.5 (docs only, own commit)

Write `MYSPORTS_BUILD_SPEC_v0.5.md` as a delta document over v0.4 (do not rewrite v0.4; reference it): the program model as the new §"Programs" — every grid cell is a program; `game` is a subtype; the six program_types; the three research-driven additions (segments, broadcast windows, per-episode network as data on every episode/race); sport dimension gains nascar/indycar/ufc/wwe/aew; chips driven by `sport` (studio shows chipless); duration defaults + `open_ended` fade-right treatment (design item, contract v1.7, NOT implemented here); authority tiers announced (press room) > reported (trade, muted render) > league schedule; the exclusions (no purchasable state, no NXT, no practice/qualifying, no daily talk shows). Note SNME=PLE-class as an assumption pending Joe. Cross-reference the register and Brief 2 docs by name. Commit `Spec v0.5: program model (delta over v0.4)`. Push.

## STAGE B — Migration 0009 (additive; backups first; own commit)

1. Backups: `python scripts/backup_table.py games` and `... broadcasts` (log counts; expect ~317 games).
2. FIRST inspect what exists (information_schema + `\d`-equivalents via psycopg): whether `sport` is an enum or text; broadcasts' actual name/shape; how access states are enumerated. **Write the DDL against reality, not this sketch** — the sketch below is the intent:
   - `programs`: program_id (pk), sport text/enum, program_type enum('game','race_session','fight_card','weekly_show','special_event','studio_show'), title, subtitle, start_at timestamptz, expected_duration_min int, open_ended bool default false, venue, location_text, on_site bool default false, parent_program_id self-FK nullable, series text nullable CHECK in ('cup','oreilly','truck') when sport='nascar', headliners jsonb, hosts_crew jsonb, brand_mark text, graphic_package text, segments jsonb, postponed_to timestamptz nullable, created/updated timestamps. Index on (sport, start_at).
   - `games.program_id` nullable FK → programs (the shadow link).
   - broadcasts (whatever the table is actually named): `window_start`/`window_end` timestamptz nullable + `simulcast_linear` bool default false. Semantics documented: null window = carries the whole program; duplicate-feed suppression must compare windows.
   - `studio_shows` registry (show_id, name, network, sport_covered, brand_mark, default_slot) + `studio_show_instances` (instance_id, show_id, program_id FK, air_date, location_text, on_site, hosts jsonb, **source_url NOT NULL**, source_tier enum('announced','reported'), observed_at). Empty tables — no data this prompt.
   - New sport values (nascar/indycar/ufc/wwe/aew) added to the sport dimension in whatever form it takes (enum values, dimension rows, or check constraints) — additive only.
   - `data/duration_defaults.json` (repo data file, not a table): per program_type (+ per track type for race_session, from research-nascar.md's defaults) — the renderer/app read it later.
3. Dry-run, verification selects separately, then APPLY LIVE. `db/README.md` ledger entry including the window/null semantics and the no-purchasable decision.
4. Commit `Migration 0009: programs supertype, broadcast windows, studio show registries (additive)`. Push.

## STAGE C — Shadow rows + loader maintenance (own commit)

1. Backfill: one `programs` row per existing game (program_type='game', sport, title "AWAY @ HOME", start_at, expected_duration_min from the sport's display duration policy, venue) and set `games.program_id`. Batched, idempotent (re-run creates nothing new).
2. `pipeline/load.py`: on every game upsert, upsert the shadow program row in the same load (loader-written, reconciler-invisible — the 0007/0008 doctrine; no DB triggers). A changed kickoff updates the program's start_at; nothing ever deletes a program here.
3. Tests: shadow created on new game, updated on time change, idempotent re-load, counts equal; broadcasts window columns default null and load untouched. Expect 138+ green.
4. Acceptance, all pasted: `select count(*) from programs` == games count; FK integrity (0 orphans both directions); `python -m pipeline.load --all --workflow claude-code` then re-load → 0 new observations AND 0 new programs; `python -m pipeline.reconcile --workflow claude-code` wakes 0 from this work; renderer regression count line unchanged; `cd web && npm run build` clean and smoke 30/30 (the app must not know or care that programs exist yet).
5. Commit `Programs shadow rows: backfill + loader maintenance`. Push.

## STAGE D — Read-only probes (no repo changes beyond the report; own commit for the report file)

From this machine (it has open network — the Akamai cloud block does not apply here), probe the Brief 2 UNVERIFIED sources READ-ONLY and write `artifacts/qa/probe-report-2026-09.md` plus a tracked copy at `docs/research/probe-report-2026-09.md` (commit the docs/ copy only). For each: HTTP status, whether the content is static-fetchable or JS-blank, and a two-line shape note. Probe with the honest UA first; note any that require more:
- ESPN scoreboards: `site.api.espn.com/apis/site/v2/sports/racing/nascar-premier/scoreboard`, `racing/nascar-secondary`, `racing/nascar-truck`, `racing/irl`, `mma/ufc`.
- `cf.nascar.com/cacher/2026/1/schedule-feed.json` (and series ids 2, 3 if 1 resolves).
- foxsports.com Press Pass, CBS Sports PR, NBC Sports Pressbox, ufc.com events page, press.wbd.com.
- Re-confirm one known-clean control (espnpressroom.com GameDay table) so a network-level failure is distinguishable from a source-level one.
NO parsing beyond shape notes, NO data written to the DB. Commit `Brief 2 probe report (read-only source verification)`. Push.

## FINAL REPORT
Per-stage hashes; the actual DDL as applied (paste it — Joe reviews); backfill counts + integrity checks; the zero-behavior-change proofs (re-load, reconcile, renderer line, smoke); test count; the probe table verbatim; judgment log; anything awaiting Joe (expected: SNME classification assumption; any place the sketch had to bend to schema reality — name each bend explicitly, never bend silently).
