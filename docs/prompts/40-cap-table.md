# Prompt 40 — the per-team cap table and the one-surface block (candidate D + 1px seam)

**Run in Claude Code**, in `C:\Users\jlull\Joe's Projects\Apps - Personal\MySports` on `main`. Four stages, self-committing, merged-unattended pattern as in prompts 35–38: two strikes then skip, hard stops only for the secret gate, destructive DB, a push reject, or the one acceptance mismatch named in stage 1. Every commit follows the standing rules (stage by explicit path, never `git add -A`; secret gate on ADDED lines with `grep`, not `findstr`; push and verify the rev-parse pair).

**Joe's ruling, 2026-09-04, on the grid cap study** (project doc `claude/grid-cap-study-2026-09-04.md`; artifact "MySports Grid Cap Study"): **ship candidate D with a 1-point seam.** That is:

1. **The cap tint is chosen per team, two levels.** The cap is the band itself where that team's logo reads on it; otherwise today's `tint(band, 0.72)`. Which one comes from a generated table, not a runtime rule.
2. **The cap's art is chosen per team**: the raw file, or the existing `_dark` file where it reads materially better on that surface. Selecting existing art is not a v1.3e lightness inversion — Joe's ruling. No new art, no strokes, no halos.
3. **The name rows take the cap's surface** — the band, or its 0.72 tint — so cap and names are one continuous surface on every block. The ink on that surface comes from the generalised band rule (below).
4. **A 1 CSS px seam** at the cap/name boundary on both sides, `rgba(0,0,0,0.30)`, drawn as an inset box-shadow so it cannot move geometry. "1pt" on the phone is 1 CSS px (3 device px at DPR 3).
5. Everything else in the block stays: the fitted name run (M17), the record and `(0-0)` suppression (M16), `.mhair`, the tray, the marquee plate. **Geometry is frozen** and measured, not argued.

This is the design change prompt 37's B5 comment recorded for Joe rather than shipped. It supersedes B5's global 0.72.

---

## Inputs — two files from the study, and where to get them

- `logo_colour_study.py` — the study script. Read-only measurement of every logo at render size; ports of `bandFor()`, `tint()`, WCAG luminance and CIEDE2000. Its docstring states the metric. It becomes the generator in stage 1.
- `cap_table_candidate_C.json` — the study's output for all 307 teams that play this season and have art: per team `tint` (1.0 or 0.72), `art` (`raw` or `dark`), `edge_crisp`, `band`, `ink`. **This is the acceptance fixture for stage 1.** Counts: 170 at 1.0 raw, 28 at 1.0 dark, 84 at 0.72 raw, 25 at 0.72 dark.

**Stage 0 fetches them; Joe does not move files by hand.** Look first in `artifacts/cap-study/` (Cowork may have placed them there over the bridge). If either is missing, copy it from Joe's Downloads folder — `%USERPROFILE%\Downloads` — into `artifacts/cap-study/` (create the folder; `artifacts/` is untracked and allowed dirty). Match by name; if Windows appended a ` (1)`-style suffix, take the newest file whose name starts with `logo_colour_study` / `cap_table_candidate_C` and copy it under the clean name. Print the SHA-256 of each file you used. If a file is in neither place, stop and say so — do not reconstruct either of them, and do not proceed to stage 1 without the fixture.

## The rule the table encodes (so it can be tested, not just copied)

For each team: `band = bandFor(primary, secondary).band`. Measure the logo's outer silhouette on two surfaces, the flat band and `tint(band, 0.72)`, for both files (raw and `_dark`): resample the PNG to 138 px (46 CSS px × DPR 3, LANCZOS), composite with alpha, take ink pixels (alpha ≥ 0.5) within 2 px of a non-ink pixel, and score the share whose WCAG luminance ratio against the surface is ≥ 1.5:1 (`edge_crisp`).

- `tint = 1.0` if the better of the two files reaches `edge_crisp ≥ 0.85` on the flat band; else `tint = 0.72`.
- On the chosen surface, `art = dark` only if the `_dark` file's `edge_crisp` exceeds the raw file's by **more than 0.05**; else `raw`.
- A team with no raw file gets no row. A team with a raw file and no `_dark` file is scored raw-only.

The generalised ink rule, for any surface `s`: of the team's primary and secondary, take the one with the higher WCAG ratio against `s`; use it if that ratio is ≥ 3.0 and the colour is not `s` itself; otherwise `--ink` `#f2f2f0` or charcoal `#101214`, whichever measures higher. **On `s == band` this must reproduce `bandFor().ink` exactly** — that is the pin.

Expected outcome over the 307 teams once names take the cap's surface: **191 team-colour inks, 116 neutral, 0 under 3.0:1** (minimum 3.04). The 26 that lose a team-colour ink relative to today, all of them 0.72 teams: Abilene Chrstn, Angels, Bulls, Cavaliers, Cincinnati, Florida St, Hornets, Indiana St, Iowa State, Louisiana, Mavericks, Mets, N Dakota St, N Illinois, N'Western St, New Hampshire, Nicholls, Ohio State, Raptors, Red Wings, Rockets, Sabres, South Florida, Twins, VMI, Virginia Tech. Joe has seen this list and accepted it.

---

## Stage 0 — preconditions

- Fetch the two input files as described above.
- `origin/main` and HEAD agree; expected `6e596e4` (prompt 38's stage 4). If HEAD has moved, confirm it is a descendant and proceed — do not call a false hard stop over a newer commit.
- Tree clean apart from untracked `assets/` and `artifacts/`.
- Python suite green (218 passed + 1 skipped after prompt 38) and JS unit green (210) — run them once here; they are the baseline for every later gate.
- Record the frozen geometry NOW, before touching anything, from a real render: CFB `2026-09-05` = 62 blocks / widths 240 and 223 / scrollWidth 1073; MLB `2026-09-03` = 3 blocks / 231 / 582. If today's numbers differ from those, the numbers you measure here are the baseline for this run; say so in the report.

## Stage 1 — the generator and the table

1. Move `artifacts/cap-study/logo_colour_study.py` to **`scripts/build_cap_table.py`** and cut it down to the generator: keep the colour maths, `band_for`, `ink_for`, `load_logo`, `measure`, and the two-level rule above; drop the study-only outputs (the Joe-theory paths, the calibration columns, the per-f sweeps, the clusters) or keep them behind a `--study` flag if that is less work — the default run must be the generator and nothing else. Certify it for Windows per the standing rule (no `%`-strftime, `encoding=` on every `open`, ASCII-only console output).
2. Team colours come from the database through the sanctioned reader (`pipeline/db.py`, SELECT only — this prompt writes nothing to the database, any DML is a hard stop), for every active team; keep a `--teams-csv` option for offline runs. Art comes from `assets/logos/`. **Include every team that has a raw file**, playing or not (that is 310 today — the three extra are `nba-BOS`, `nba-PHX`, `nba-POR`, which have art but no 2026 game rows; note that in the report as a possible NBA load gap, and do not chase it here).
3. Emit **`web/lib/cap-table.json`**, tracked, shaped as `{"_generated": <UTC ISO>, "_rule": {...the thresholds...}, "teams": {"<team id as stored in mysports.teams>": {"tint": 1.0 | 0.72, "art": "raw" | "dark", "edge_crisp": <0..1>}}}`. Keys keep the database id's case (`nba-CLE`); the URL helpers already lowercase for R2.
4. **Acceptance, and the one hard stop this prompt adds:** for the 307 ids present in `cap_table_candidate_C.json`, `tint` and `art` must match field for field, and the four counts must be 170 / 28 / 84 / 25. A mismatch means the generator and the study disagree about the art or the colours — investigate and report; **do not regenerate the fixture to make it pass.** `edge_crisp` may differ in the third decimal (the study measured on Linux Pillow); tint and art may not.
5. Tests, Python: the two-level rule on synthetic images — a solid square in the band's own colour → 0.72; a square in a contrasting colour → 1.0; a raw file at 0.80 and a `_dark` at 0.86 on the band → 1.0 dark; raw 0.80 / dark 0.84 → 0.72 (the 0.05 margin), plus `ink_for(band) == band_for().ink` over the real colour pairs of every team the reader returns. Windows-safe paths in the tests.
6. Commit: generator + table + tests. Message names the ruling and the counts.

## Stage 2 — the block

Files: `web/components/MobileGrid.js`, `web/lib/gridmodel.js`, `web/app/globals.css`, `web/lib/config.js` if a helper is missing. Locate by content; line numbers drift.

1. `gridmodel.js`: export `inkFor(surfaceHex, primaryHex, secondaryHex)` implementing the generalised rule, and `capFor(teamId)` reading `web/lib/cap-table.json` with the fallback `{tint: 0.72, art: 'raw'}` for any id not in the table (today's behaviour, so a new team can never break a block). Keep `bandFor()` as is; it still decides the band.
2. `Block`: per side, `surface = cap.tint === 1 ? band.band : tint(band.band, CAP_TINT)`; the cap's `background` and the name row's `background` are both `surface`; the name row's `color` is `inkFor(surface, primary, secondary).ink`; the cap's `<img src>` is `teamLogoUrl(id)` for `raw` and the existing `_dark` helper in `config.js` for `dark`. `CAP_TINT` stays 0.72 and is now the tinted level, not the global. Replace B5's comment block with a short one that names the table and the ruling.
3. The seam: `.mcap` gets a side class (or use first/last child of `.mblock-body`), then `box-shadow: inset -1px 0 rgba(0,0,0,.30)` on the away cap and `inset 1px 0 rgba(0,0,0,.30)` on the home cap. Not a border — a border changes the cap's box.
4. `.mseam` (the 2 px strip under the block) keeps the band gradient as the mockup drew it. In stage 3 look at it under a 0.72 block; if it reads as a stray light strip under a darker block, switch it to the two sides' `surface` values and say so in the report — that is a judgment call you may make with a screenshot in hand.
5. `.mhair` stays `rgba(0,0,0,.22)`. The record's 82% opacity stays. The archival PC renderer `scripts/render_day.py` is not touched.
6. Tests, JS (`node --test`, no new deps): `inkFor(band) === bandFor().ink` on the 28 study teams' colour pairs (ids and hexes are in the fixture JSON) and on 2,000 random pairs; `capFor` returns the fallback for an unknown id and the table's row for a known one; a rendered-block test if the existing harness supports it asserting cap and name-row backgrounds are equal on both sides.
7. Measure the frozen geometry again on both slates — identical to stage 0 or it is a defect in this stage, not a negotiation. Count inks over the 307: 191 / 116 / 0, and list the 26 that went neutral against the expected list above.
8. Commit.

## Stage 3 — render and look

Screenshots at 390 px, `artifacts/qa/<date>/`, of every one of the study's fourteen games that is on a real slate: Tigers @ Guardians (Sept 4), NC A&T @ Georgia St (Sept 4), Ball State @ Ohio State, Furman @ Tennessee, Tulane @ Duke, W Michigan @ Michigan, N Arizona @ Arizona, UCLA @ California (Sept 5–6), SMU @ Florida St (Sept 7), and Falcons @ Steelers, Ravens @ Colts, Browns @ Jaguars, Dolphins @ Raiders, Jets @ Titans (Sept 13). Compare each against the artifact's **D** tab with the seam box ticked (Joe will do the same).

Look for, and report on, each of these — they are the things the study could not prove:

- Cap and name row read as one surface on every block; the 1 px seam is visible on both flat and tinted blocks and does not read as a rendering fault.
- W Michigan @ Michigan: a 0.72 side beside a 1.0 side in one block.
- Tennessee and UCLA on their untinted white and gold surfaces beside a partner's surface; SMU's `_dark` pony on red.
- Steelers at 0.72 (white disc on dark gold, 62% crisp — the weakest cap that still ships); Ohio State's grey surface with charcoal ink (one of the 26).
- `.mname` text vertically centred on the surface (the mockup centred it explicitly; the real rule is `display:block`).
- The marquee plate and `[data-marquee]` against a flat band cap — Sept 6 Louisville / Ole Miss is the case.
- `.mseam` under a 0.72 block (the judgment call in stage 2 §4).
- A DPR 2 pass on at least Tennessee, UCLA, SMU, Steelers: the crisp shares were measured at DPR 3 and may move a few points.

Fix real defects here and commit them; do not tune the thresholds — the table's rule is Joe's ruling, and a borderline team that looks wrong is reported, not re-scored.

## Stage 4 — documents

- `docs/rendering-contract-mobile.md` → **v1.6**: M12 — cap endcaps draw the raw file or the existing `_dark` file per `web/lib/cap-table.json`; selecting existing art is not a v1.3e lightness inversion (Joe, 2026-09-04). M15 — the name rows take the cap's surface (the band or its 0.72 tint) with the generalised ink rule; no darkening loop on the phone, unchanged. M18 — the flat endcap becomes per team, band or 0.72 from the table, plus the 1 px seam at the cap/name boundary, `rgba(0,0,0,.30)`, inset. M13's note names M18 already; check it still reads true. Keep the header's note about the out-of-order numbering.
- `docs/rendering-contract.md` changelog → **v1.6.11**: the mobile block's surfaces are now table-driven; the PC contract's §3 cap gradient is unchanged and `render_day.py` is unchanged.
- Rule 23: if any reference implementation renders the grid block's band (`band()` was updated in prompt 35's commit), update it in the same commit; `mobile_demo.html` is the listing reference and should not need a change — check, don't assume.
- `db/README.md` and `docs/` get no DB entry: nothing was written to the database.
- Commit, push, verify the rev-parse pair.

## Report

The standing shape: per stage what shipped and its commit; the gates after each stage; the table's counts and the acceptance check; the ink counts and the 26; geometry before and after; the screenshot list with what each showed; every judgment call you made and why (the `.mseam` one in particular); and **anything in this prompt that turned out wrong** — the last four briefs carried 6, 3, 6, 1 errors, and this one was written from a mockup, not the component.
