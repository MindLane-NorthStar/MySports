# Claude Code — Prompt 22: contract repair (card layout, Guardians TV mark, desktop grid)

**Venue:** Claude Code in VS Code, laptop, `C:\Users\jlull\Joe's Projects\Apps - Personal\MySports`.
**Mode:** unattended rails. Self-committing stages. Retry once, then log-and-skip.
**No migration, no DML, no writer credential.** PostgREST reads with the publishable anon key are the app's normal read path and are expected.

## Read this first — the locked-file rule is SUSPENDED for this prompt, deliberately

Prompts 19–21 said "do not modify `MatchupCard.js`." That rule existed to stop the shipped card **drifting away** from the locked design. Joe reviewed the live site on 2026-09-03 and the drift has already happened: the app's card does not match the locked reference implementation. **So this prompt does the opposite — it changes `MatchupCard.js`, `MobileGrid.js` and `globals.css` to bring them back INTO compliance.** Nothing here is a new design decision, and nothing here reopens a contract.

**The authority is `claude/src/mobile_demo.html` in the Claude project — the reference implementation behind artifact `0f1a2469`, and the source of the locked listings-card rules in `docs/rendering-contract.md` v1.6.4.** Where this prompt and the shipped code disagree, the reference wins. Where this prompt and the reference disagree, **stop and report** — do not split the difference.

---

## Preconditions — verify first, hard stop if any is false

1. Branch `main`; `git rev-parse --short HEAD` == `4250aa9`.
2. `python -m unittest discover tests` → **190 OK (skipped=1)**; `cd web && npm run test:unit` → **91/91**; `npm run smoke` → **29/30**.
3. Tree clean apart from untracked `assets/` and `artifacts/`.

## Working rules (binding)

1. Certify Python for Windows: no `%`-strftime, explicit `encoding=`, ASCII console output.
2. Secret gate every commit, ADDED lines only: `git diff -U0 --cached | grep "^+"`. Never `findstr`.
3. Stage by explicit path; never `git add -A`.
4. Each stage commits and pushes on its own; report the `rev-parse` pair.
5. **Do not run `npm ci`**, never set `experimental.useWasmBinary`. `next build` fails locally for an unrelated reason — Next's metadata-route loader does not escape the apostrophe in `Joe's Projects`. Use `next dev` for QA; Vercel builds fine.
6. `npm run test:unit` is `node --test "test/**/*.test.mjs"` — quoted glob.
7. Color tokens come from `web/app/globals.css`. The page ground is **`--spot-2`**.
8. **Edit JSON through a parser, never line-based**; assert only the intended keys changed.
9. Name every bend in the judgment log.

---

## Stage 1 — Card layout: the network mark column and the team stacks

Two of Joe's findings are one root cause: `web/app/globals.css` collapsed the card from the reference's **four** columns to three and moved the mark inside the body.

**What the reference does** (`claude/src/mobile_demo.html`):

```
.mcard { grid-template-columns: 44px minmax(0,1fr) auto minmax(58px,auto); }   /* time | body | MARK | slot */
.duel.hug { display:flex; align-items:flex-start; gap:6px; }                   /* two stacks, hugging */
.duel.hug .tcol { flex:0 1 auto; min-width:0; }
.tcol { display:flex; flex-direction:column; gap:2px; min-width:0; }           /* name line THEN record line */
.tcol .tl1 { display:flex; align-items:center; gap:6px; }                      /* logo + name */
```

**What the app currently does:**

```
.mcard  { grid-template-columns: 78px minmax(0,1fr) auto; }        /* only three - no mark column */
.mbody  { grid-template-columns: auto minmax(0,1fr); }
.mnet-mark { grid-column: 1; }                                     /* mark on the LEFT of the matchup */
.dsubs  { display:grid; grid-template-columns: 1fr 1fr; }          /* records split 50/50 across the card */
```

**Joe's finding 4 — the network mark is in the wrong place.** It renders between the time and the matchup. The contract puts the processed mark **between the matchup and the right slot**, in its own column, at 2/3 of the three-line stack height scaled by its manifest `hf`, vertically centred on line 2. Restore the fourth column and move the mark into it. The grey network text stays under the matchup, where it already correctly is.

**Joe's finding 2 — the away record is left-aligned while the home record floats mid-page.** Because `.duel` hugs but `.dsubs` is a 50/50 grid, the names hug and the records do not. **Rebuild the card body as the reference has it:** one `.tcol` per team holding that team's logo+name line *and* its record/standing line *and* (MLB) its probable line, with `.duel.hug` flexing the two `.tcol`s together around the `@`. Delete `.dsubs`. The `@` sits between the away name's last character and the home logo — content flow, never a fixed centre column, at every width.

Keep the tier-shrink rules exactly as they are (15 → 12.5 px above 13 characters → 11 px above 19, then truncation) and keep `display_name → short_name` fallback. Do not change type sizes, colors, the seam, or the right slot.

**Prove it at three widths — 390, 1024 and 1440 px** — with the away and home records left-aligned to their own team's name in every case, and the mark sitting between the matchup and the odds.

Commit: `fix(web): restore the locked four-column card - mark column and hugging team stacks`. Push, report the pair.

## Stage 2 — The Guardians TV mark has a blue plate baked in

`web/public/marks/guardians-tv.png` is 128×128 RGBA and its dominant pixel value is **(61, 131, 211, 255)** — a fully opaque blue filling most of the frame. That is a background plate, and it violates the universal rule that **every logo floats on charcoal with no backing** (rendering contract v1.3e). It shows on the listings card *and* in the grid rail, because both read the same file.

Rebuild it so the mark is only the "GUARDS TV" wordmark and the Guardians logo on transparency:

1. Find the source art (check `assets/brand/`, `assets/network-logos/` and the `scripts/build_web_marks.py` recipe table). **Report which source you used.**
2. Add or correct its recipe entry — the same class of treatment as the IndyCar badge, which is keyed off its own background. Key out the blue plate; do not simply set alpha on a colour range that also appears inside the Guardians script.
3. Regenerate through `scripts/build_web_marks.py` so the manifest stays the authority. **Do not hand-edit the PNG or the manifest.** The existing Guardians TV `hf` of 1.25 is frozen — do not re-median the network manifest.
4. **Proof:** report the dominant-colour census before and after, and confirm the corner pixels are transparent. Composite the new mark on `--spot-2` charcoal and on white, save both to `artifacts/qa/2026-09-03-guardstv/`, and say whether the wordmark still reads at the card's rendered height.

If the only available source art has the plate flattened into it with no clean key, **stop and report** — a redraw is Joe's call, not an implementation detail.

Commit: `fix(web): Guardians TV mark floats on charcoal, no blue plate`. Push, report the pair.

## Stage 3 — Desktop must show the PC grid, not the mobile one

**Joe's finding 3b and the Saturday finding are the same bug.** `web/app/page.js` renders `<Listing … grid bands />`, and `Listing` renders `MobileGrid` whenever a sport is selected — **at every width**. The archived PC grid renders only when a `generated_grids` row exists. So on desktop MLB (no row for 2026-09-03) the only grid is the mobile one, horizontally compressed; and on desktop CFB for 2026-09-05 both are present and **the archived one draws a blank black area**.

This contradicts the Mobile Grid Addendum, whose M5 shorthand hour axis is **MOBILE ONLY — "PC keeps v1.2 labels"** — and the standing rule that the PC CFB grid look governs every grid, every sport, every view.

1. **Gate `MobileGrid` to mobile widths.** Above the mobile breakpoint the desktop grid is the archived PC render. Use the same breakpoint the rest of the app uses; name it in the report.
2. **Diagnose the black CFB grid.** Its caption renders `Archived PC grid · unknown · ? on the grid`, so `generator_version` and `games_on_grid` are null on that row. **Prime suspect: the known smoke 29/30 failure** — one `generated_grids` row stores a **bare key** (`grids/…/grid_….svg`) instead of an absolute URL, which is exactly what makes an `<img src>` resolve to nothing. Query `generated_grids` and **paste every row** — `sport`, `game_date`, `svg_asset_url`, `generator_version`, `games_on_grid` — then say whether the CFB 2026-09-05 image 404s, resolves to a relative path, or loads.
3. **Fix it the way Cowork recommended and Joe has not overruled: standardise `generated_grids` on BARE KEYS, and have consumers join `ASSET_BASE_URL`.** A custom domain at deploy time would stale any absolute URLs already stored. Backfill the rows that hold absolute URLs. **This also closes smoke 29/30** — report the new smoke count.
4. **When no archived grid exists for that (sport, day) — MLB 2026-09-03 today — desktop shows an honest empty state**, not a mobile grid stretched across a desktop column. One quiet line naming the day and sport. *(Cowork's call; Joe may veto it. The alternative he might prefer is rendering the PC grid live rather than from the archive, which is larger work and not in this prompt.)*

Commit: `fix(web): desktop shows the PC grid; generated_grids standardised on bare keys`. Push, report the pair.

## Stage 4 — The grid's team-colour bands

**Joe's finding 3c:** in the MLB grid the game chips render as flat charcoal instead of the team-colour bands the CFB grid shows.

`MobileGrid.js` already builds bands from `tint(away.color, …)` / `tint(home.color, …)`, and the grid model sets `color: t?.primary_color`. So either the colour is not reaching the component for MLB, or `tint()` is washing it out.

**Measure before changing anything.** Report, for the 2026-09-03 MLB slate and the 2026-09-05 CFB slate: each team's `primary_color` as stored, the value that reaches `MobileGrid`, and the final rgb the band renders. Then say which of the two it is. Fix that, and only that — **do not adjust the tint constants to compensate for a null colour.**

Note the card's `.seam` renders correct team colours on the same page for the same games, so the colours exist in the games payload; the grid model is the place to look first.

Commit: `fix(web): team-colour bands render in the MLB grid`. Push, report the pair.

## Stage 5 — Chrome and copy (three findings from Joe's desktop + mobile pass)

**5a — The sport filter chips are text; they should carry league marks.** `web/public/leagues/` already holds the 256 px raw and `_dark` variants (`nfl`, `nba`, `mlb`, `nhl`, `cfp`, plus the events set). The chips sit on charcoal, so per rendering contract v1.3e they take the **`_dark`** variant — the charcoal-floating context, never the raw grid-cap art. Put the mark in each chip with its label; keep the text accessible to a screen reader even where the mark carries the meaning visually. College Football uses the **`cfp`** mark, consistent with the band headers and the home banner. **"All" has no league mark — keep it as text in the same chip shape** (Cowork's call; it is the one chip that is not a league).

**5b — Too much space between the banner and the page heading.** There is roughly 100 px of dead vertical space between the bottom of the chrome and "Thursday, September 3, 2026" at 1440 px. Joe reports the same gap on **`/weeks`** under the compact nav bar, so find the shared rule rather than patching one page — `main`'s padding and `h1`'s margin are the first suspects. **Fix it once and report the before/after on both routes**, `/` (full banner) and `/weeks` (compact nav bar). Do not add a negative margin on top of whatever is producing it.

**5c — Collapse the count block to one line. READ THE NOTE BELOW BEFORE IMPLEMENTING.**

Joe's words: *"The text below '68 Games' that says '62 on your services' and '6 not on your services…' — that text can be shortened to '62 available to YOU'."*

The four-line block he is reacting to was specced that way by decisions **D4** and **E5**, both of which he ruled earlier the same day, and both of which turn on facts that block deliberately carries: the count of what he *cannot* watch (D4 — "without it the page lies by omission"), and the market-pending count (E5 — the thing that stopped September 13 claiming eleven watchable games were unavailable). **Taking his sentence literally would delete both.**

**Implement this instead — one line, same facts, no outlet list:**

```
68 games · 62 available to you · 2 market pending · 4 not on your services      [Show all]
```

Rules: the phrase is **"available to you"**; the outlet lists (`· Cardinals.TV, Chicago Sports Network, Mariners.TV and 9 more`) come **out of the summary line entirely** — that is the verbose part, and each row already names its own network once revealed. A segment with a count of zero is omitted rather than printed as "0". Keep the "Show all" control. Every band still reports, including bands with nothing hidden (that fix landed in `4250aa9` — do not regress it).

**This is Cowork's reading, not Joe's literal instruction, and it is flagged for his veto in one line.** If he confirms he wants the bare `62 available to YOU` with the other counts gone, that is his call to make with the trade-off named — but an unattended run must not silently undo two rulings from the same day.

Commit: `feat(web): league marks on the sport chips, tighter banner gap, one-line count`. Push, report the pair.

## Stage 6 — QA and report

Capture `web/scripts/qa-shots.mjs` plus targeted shots of `?day=2026-09-03&sport=mlb` and `?day=2026-09-05&sport=cfb` at **390, 1024 and 1440 px**, into `artifacts/qa/2026-09-03-repair/`. Keep the 8 behavioural assertions green. **Look at them** and say what is still wrong.

Report: rev-parse pair and commit chain; Stage 1 proof at three widths; Stage 2's colour census before/after; Stage 3's full `generated_grids` table, the breakpoint you chose, and the new smoke count; Stage 4's colour trace and which of the two causes it was; **Stage 5's before/after banner gap and the count line as it renders for 2026-09-03 MLB, 2026-09-05 CFB and 2026-09-13 NFL**; test counts; what the shots show; and the judgment log.

## Hard stops

1. Secret gate trips, or a push is rejected.
2. The reference implementation disagrees with this prompt's description of the card.
3. The Guardians TV source art has no clean key for the blue plate.
4. Any change would alter card type sizes, colours, the seam, the right slot, or the tier-shrink thresholds — those are locked and correct today.
5. Any write to the database beyond the `generated_grids` URL backfill in Stage 3, which is the one data change authorised here.

## Out of scope

- The time-adaptive band, the "See all today" escape, and the ≥1,600 px composition (D5) — **these move to prompt 23**, because they reuse the card and the grid this prompt repairs.
- E10 empty-state copy beyond the one line in Stage 3.
- The grid "now" marker, the loader enum-hardening, and the `unverified` documentation note — all ride rendering-contract v1.7.
