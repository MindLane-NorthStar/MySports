# Claude Code — Prompt 36: page chrome, the Weeks rebuild, and the grid's surface

**Repo:** `C:\Users\jlull\Joe's Projects\Apps - Personal\MySports` · **main**

**Preconditions, hard stop if any fail:**

- `git rev-parse HEAD` == `78ee1af`, and `HEAD == origin/main`.
- Python **200 OK (skipped=1)**, JS **185/185**, smoke **30/30**, qa-shots **14/14**.
- Tree clean apart from untracked `assets/`.

**Run start to finish without stopping for input.** Four phases, each gated and committed on its own. Preconditions are checked **once, here** — later phases begin from whatever the earlier ones left, so do not re-assert `78ee1af`.

**Hard-stop policy.** Stop that stage, leave earlier phases' commits alone, record what stopped and why, continue to anything that does not depend on it. Never roll back a green phase because a later one failed.

**Working rule 22** — locate by content, and **report any citation in this brief that does not match.** Every line reference below was read this session, but prompt 35 still found six wrong; assume nothing. **Rule 23** — `docs/design/mobile_demo.html` changes in the same commit as anything it specifies. Also rules 3, 4, 13, 16, 20.

**No database writes, no pipeline, no adapters, no migrations.** Read-only queries encouraged.

---

## Two findings that are not tasks

**There is no racing data anywhere in the database — zero rows for `nascar` and `indycar`, the whole season.** Prompt 31 fixed the enum that made `sport=eq.racing` return 400, which stopped the page crashing; it did not make races appear. The Racing chip is real and empty. **Do not attempt to load racing data in this run** — that is a pipeline prompt. Confirm the zero and report it.

**MLB is not missing from the data.** On `2026-09-04` there are **16 MLB games and 8 CFB**, every one of them with at least one `game_broadcasts` row and none with `kickoff_status = 'tbd'`. So if MLB does not render on the ALL view, the cause is in the rendering path, not the loader. Phase A stage 1 chases that.

---

# PHASE A — two defects and the venue line

## A1 — a favourite team's game must never be hidden

Joe, on the deployed app: *"the ALL tab on the main TODAY page isn't showing all games. Guardians are notably missing from Your Teams and no baseball ... is displaying at all."* The Guardians play twice on `2026-09-04`, so this is real.

**Cowork's hypothesis, explicitly a hypothesis — verify it before fixing.** `SportBand.js` computes

```
visible = showAll ? games : (games || []).filter((g) => !offIds.has(g.id))
```

and further down builds `favorites` from `split.favorites`. **Cowork did not read the `splitFavorites` call site and does not know which array it is given.** If `split` is derived from `visible`, then a favourite whose game is off-service is filtered out before the favourites are picked, and the team silently disappears from YOUR TEAMS with no count anywhere admitting it. On `/` the favourites are hoisted to a page-level section (see the `floatFavorites` / `sectionLabel` comments), so **check the page-level path too** — the hoisted section may build its own set from the same filtered array.

**Whatever the mechanism: a favourited team's game is never hidden by the off-service filter, in either toggle state.** That is the rule. Market-pending and network-TBD games are already exempt by construction; favourites join them.

Report: the actual call site, whether the hypothesis was right, and the before/after count of games rendered on `/?day=2026-09-04` with no sport selected — **broken down by sport**, because Joe reports no baseball at all, which the favourites bug alone would not explain. If MLB is absent for a second, separate reason, name it.

## A2 — `.offsvc` is declared twice

`web/app/globals.css` defines `.offsvc` in two places with conflicting `flex-direction` — the later declaration wins. Locate both, keep the one that matches what actually renders, delete the other, and **say which one was dead.** Phase B rewrites this block anyway; do this first so phase B edits one rule, not two.

## A3 — the card's bottom line becomes the venue

Joe: *"we were going to replace all the grey text indicating broadcast network on the bottom line of the LIST view cards with the venue (stadium/arena) for the event."*

**Joe's ruling: the swap only.** Not the away/home/venue restack — that is its own prompt.

The data is already there: `queries.js`'s `GAME_SELECT` carries `venue:venues(name,city,state)`, and the comment beside it already says it is "the venue the tray prints." `MatchupCard.js` has `networkText(game, b)` rendering into `.mnet-text`. Replace the text that run prints with the venue name.

Decide and report: **what renders when a game has no venue row.** The honest options are the network text as it is today, or nothing. Nothing is cleaner and Cowork leans that way, but measure how many loaded games have a null venue first and say so — if it is a large share, the line should not go blank on most cards.

The network **mark** still renders and is untouched; that is the whole reason this text is redundant.

## Phase A gate

Full gate set. Commit each stage separately. Continue to phase B.

---

# PHASE B — the section headers on Today and Weeks

Joe wants the same three changes on both pages. **They are one system: `.favlabel`'s own comment says it is matched to `.band-title` deliberately and "if the band header changes, this should change with it."** Change them together or the YOUR TEAMS heading falls out of step with every heading beneath it.

## B1 — headers 1.5×

Current, located by content in `globals.css`: `.band-head` with `.band-mark` at **22px** (18px at ≤699px) and `.band-title` at **17px** (15px at ≤699px). `.favlabel` mirrors the title's family, weight, size, letter-spacing, colour and bottom hairline.

**1.5× on the mark and the title, at both breakpoints**, and `.favlabel` with them. On the Weeks and History pages the per-day date heading (`Tue, Sep 1`) takes the same increase — **find what actually renders that heading; it may or may not be `.band-title`, and if it is a different rule, say so.**

Report the computed sizes at 360 / 390 / 430 / 1440 and confirm no header wraps or overflows at 360.

## B2 — the count line moves up beside the header

Today the count block (`.offsvc`) sits on its own line below the header. Joe wants it **on the header line, to the right of the title, at its current size** — the header grows, the count does not.

Implementation note: the header is `.band-head` (a flex row: mark, then title) and the count is a separate sibling block. Putting them on one line means the count joins that flex row and takes `margin-left: auto`, or the two become one container. **Either is fine; pick one and say which.**

**At narrow widths it must wrap below the header rather than compress the title** — a 1.5× title plus `2 airing · 13 unavailable` will not fit 360px on one line. `flex-wrap: wrap` on the header row with the count as the wrapping child does this with no media query. Report the width at which it wraps.

## B3 — one count, and the count is the link

Joe: *"eliminate the 'Show 11 unavailable' text with link and instead make the 'X unavailable' text the link. We don't need to list the number of unavailable games twice."*

He is right that it says it twice. Today `countSummary()` in `web/lib/offservice.js` **joins the parts into one string** — locate it; Cowork read it as building `[airing, tbd, unavailable]` and joining on `' · '` — and `.offsvc-toggle` renders a second control reading `Show ${offCount} unavailable`.

**So the count line can no longer be a joined string.** It has to render as parts so the unavailable part can be a control. Change `countSummary` to return the parts (keep a string-returning wrapper if any test or caller depends on the joined form — **grep for callers first and report them**), and have the band render them with `·` separators, with the unavailable part as the toggle.

**Three things must survive:**

- The toggle's behaviour is unchanged — it reveals only genuinely off-service games; market-pending and network-TBD are never hidden.
- **The 44px touch target.** `.offsvc-toggle` carries `min-height: 44px` and a comment calling it "the most important of the three: a 15px target gating access to every filtered game." Moving the affordance onto a 12px inline run must not lose that. Inline padding on the control, or a pseudo-element that extends the hit area, both work — **report the measured tap target after.**
- **`aria-expanded` and a real `<button>`.** It is a disclosure control, not a link, whatever it looks like. Style it as the link Joe wants; keep the semantics.

**The revealed state needs a way back.** Today the label flips to `Hide them`. With the count itself as the control, decide what it says when expanded — Cowork's suggestion is that the same run stays the control and the row simply reads as active (underline dropped, or the gold going to `--ink`), but **you are looking at it and Joe is not: pick what reads clearly and say why.**

## Phase B gate

Full gate set. Commit. Continue to phase C.

---

# PHASE C — the Weeks page rebuild

## C1 — the dropdown loses the week number for calendar weeks

`web/app/weeks/page.js` builds the calendar option label as `` `Week ${isoWeekNumber(w.start)} · ${daySpanLabel(w.start, w.end)}` `` and renders `<h3>Week {isoWeekNumber(w.start)}</h3>` per group.

**Joe wants `Mon Aug 24 - Sun Aug 30, 2026`** — weekday abbreviations on both ends, no ISO week number anywhere. Find `daySpanLabel` in `web/lib/weeks.js` and extend it, or add a sibling; **do not change the existing one in place if other callers depend on its current form — grep and report.**

The `<h3>` heading takes the same treatment: no `Week NN`.

## C2 — sport chips replace the Calendar/Season buttons

Joe: *"I don't want to have calendar weeks and season weeks anymore. Instead, reimport all of the CHIPS displayed on the DAYS page, directly below the WEEKS text, in lieu of the 'Calendar Week' and 'Season Week' buttons. Then user picks a chip, which populates the Week dropdown."*

**The chip row is the same component the Today page uses.** Prompt 35 established the order lives in **`SPORT_FILTERS`** in `web/lib/config.js` — `['nfl','cfb','mlb','nba','nhl','racing','ufc','wwe']` — **not `SPORTS`; prompt 35's brief got that wrong and the correction cost a stage.** Reuse `SportFilter` rather than building a second row; if it is coupled to `/`, lift the coupling rather than forking the component, and say what you changed.

**The week format follows the sport, automatically:**

- A sport in `SEASON_WEEK_SPORTS` (see `usesSeasonWeeks()` in `web/lib/weeks.js`) → numbered weeks: `NFL Week 1 · Wed Sep 9 - Mon Sep 14, 2026`.
- Any other sport, and **ALL** → calendar weeks in C1's format, with no week number.

So `?view=calendar` / `?view=season` stops being a user-facing choice. **It may still be the right internal representation.** Decide whether to derive `view` from the sport and keep the URL contract, or replace `view` with the sport token — **either is acceptable; `?w=` deep links, back/forward and shared links must keep working, and `currentWeekKey`'s "latest start wins" tie-break must survive.** Report which you chose and why.

**Joe's ruling on scope: the chip filters the page as well as the dropdown, and ALL stays as the first chip** — exactly the Today page's behaviour, so one mental model covers both pages.

**Racing will be an empty chip.** There is no racing data at all. Do not special-case it; the existing empty state should carry it, and **report what the page actually renders when a chip has no games in range** — if that state is missing or ugly on Weeks, say so rather than inventing one.

## C3 — the per-day headers on Weeks

Covered by B1 and B2: the date heading grows 1.5×, the count line joins it at its current size, and the unavailable count is the control. **Confirm both pages use the same rules** — if Weeks renders its day heading through a different class, make it share, and say what you found.

## Phase C gate

Full gate set. Commit. Continue to phase D.

---

# PHASE D — the grid

## D1 — the bar and the tile become one continuous surface

**Joe's report:** *"your text with background didn't render properly. The background color didn't fill the entire space - only directly behind the text."*

**Confirmed, and the cause is in three places.** `MobileGrid.js` sets `background: awayBand.band` on `.mname`, and in `globals.css` `.mnames` carries `align-items: center` — so each `.mname` shrinks to its text width and the colour paints only behind the glyphs — plus `padding: 0 3px` and `gap: 1px`, which keep any fill off the caps even once it stretches.

**Joe's ruling, chosen from three measured options: the whole block — both caps and both name bars — becomes the flat band colour, and the logo tile lightens to match.** One continuous surface per team, no gradient, no step where the cap meets the bar.

That means:

- `.mnames` stops centring its children — `align-items: stretch` — and loses the horizontal padding and the gap, so each band reaches edge to edge and the two meet at `.mhair`.
- The cap's `linear-gradient(180deg, tint(band, 0.86), tint(band, 0.58))` becomes the flat band colour, the same value the bar uses.
- **The ink rule from prompt 35 is unchanged and stays correct**, because the surface is still exactly `bandFor().band`. Do not recompute it, do not touch `bandFor`.

**The one real risk, and it must be measured: the logo tile gets lighter.** Team logos render RAW in the caps — lightness inversion for team logos was explicitly rejected at contract v1.3e — and they were legible against a gradient that `tint()` **darkens**. Note that `tint(hex, f)` is `c*f + 255*(1-f)*0.08`, which despite its name moves toward near-black, not toward white; at 0.86 and 0.58 the cap is materially darker than the band. On the full-strength band colour a logo whose own palette is close to that colour can wash out.

**So: measure logo-versus-surface separation across the loaded teams and report it.** If a meaningful set washes out, **do not invent a treatment and do not re-tint the whole block** — report the count, name the worst teams, and propose the smallest fix (a hairline ring around the mark, or a slight tint applied to the cap only, which reopens the step Joe asked to remove). **This is the one place in this prompt where reporting beats shipping if the evidence is bad.**

## D2 — the seam still tints the primary

`.mseam` is built from `tint(away.color, 0.86)` and `tint(home.color, 0.86)` — the **primary**, while prompt 35 moved the caps to the band. On the 259 teams whose band is the secondary those disagree. **Bring the seam onto the band colour**, consistent with everything else in the block, and report how it looks.

## D3 — there is no ALL grid, because the page refuses to build one

`web/app/page.js` gates the archived grid on `if (!sport) return null;` and `MobileGrid` is reached the same way. Joe: *"as far as I can see there is no 'ALL' grid currently. We need that to appear on the main page when 'ALL' is selected."*

**Build it.** The mobile grid already groups by network row across whatever games it is handed, so the ALL case is the same component with an unfiltered set — but **verify that before assuming it**, because the row order, the M2 time compression and the M3 hard cut are all computed per slate and an all-sports day is a wider span with more rows than any single sport.

Report: row count, lane counts, scrollWidth and the M3 cut behaviour for ALL on `2026-09-04` and `2026-09-05`, against the same numbers for each sport alone. **If the all-sports slate breaks M2 or M3 — say, one sport's kickoffs compress another's into illegibility — stop and report rather than shipping a grid that misleads.**

**The archived PC grid is a separate question.** `newestGridFor(sport, day)` is per-sport by construction and there is no all-sports generated grid to fetch. Leave that path gated on a sport, and say so plainly in the report so nobody reads "ALL grid" as covering both.

## D4 — the grid header

Currently renders `<h3>{(sport || '').toUpperCase()} GRID</h3>` with a meta line of `{day} · {onGrid} on the grid` plus the TBD and cut suffixes. Joe sees `CFP Grid  2026-09-12 - 70 on the grid`.

**Joe wants:** `(CFB logo) College Football Broadcasts · Saturday September 12, 2026 · 70 GAMES`

- **The league mark** — the same one the band headers use. `SportBand.js` holds `const MARK = { cfb: 'cfp', nfl: 'nfl', nba: 'nba', nhl: 'nhl', mlb: 'mlb' }` and renders `/leagues/${MARK[sport]}_dark.png`. **That map is now needed in two components — lift it to `web/lib/config.js` beside `SPORT_LABEL` rather than copying it.** Note it has no entry for `racing`, `ufc` or `wwe`; the band header renders no mark for those and the grid must degrade the same way, not break. **For ALL, there is no single league mark — decide what renders and say what you chose.**
- **The full sport name**, from `SPORT_LABEL` — `cfb` is already `College Football` there. This is why the header reads `CFP`: it prints the sport token, and the *mark* is named `cfp`.
- **"Broadcasts", not "Grid"** — the word the count line already uses.
- **The date as `Saturday September 12, 2026`.** `longDay()` is used for the page `<h1>`; check whether its output matches and reuse it if so rather than adding a second date formatter.
- **`70 GAMES`, not `70 on the grid`.**

**Keep the TBD and gaps-cut suffixes** — they carry information the count does not, and Joe did not ask to remove them. Report the full rendered string at 360 and 390 and confirm it does not overflow.

## D5 — the network buttons take marks

`.mgrid-nav` (M8, jump-to-network) renders `{r.name}` as text on every button. Joe wants the network or streamer icon instead.

Every row in the rail already resolves a mark through `web/public/marks/` and its manifest — the rail itself renders them full-height on a faded-charcoal tile. **Reuse that resolution; do not build a second lookup and do not hand-edit the manifest.**

- Marks are dark-adapted for the rail's charcoal tile. The nav buttons have their own background — **check the contrast there and report it**; if a mark disappears on the nav's ground, give the button the rail's tile treatment rather than altering the mark.
- **Where a network has no mark, the button keeps its text.** TBS is the known case — prompt 35 confirmed `networks_services` carries `('tbs','TBS')` with two loaded broadcast rows and `web/public/marks/` has no TBS. A silently blank button is worse than a text one.
- The button is still a control with an accessible name: the network name goes to `aria-label` (and the `alt` stays empty on the decorative image).
- Keep the ≥44px touch target the existing comment records, and confirm the nav still fits without horizontal overflow at 360.

## Phase D gate

Full gate set. Commit.

---

# Report

Per phase and stage: what changed, the sha, the evidence, every judgment call. Gates before and after each phase. Call out specifically:

- **A1: the real mechanism**, whether Cowork's hypothesis about `splitFavorites` was right, and the per-sport before/after counts on the ALL view. **If MLB was absent for a second reason, name it** — that is the part Cowork could not diagnose.
- **A2: which `.offsvc` rule was dead.**
- **A3: how many loaded games have a null venue**, and what the line renders for them.
- **B1/B2: computed header sizes at four widths, and the width at which the count wraps below.**
- **B3: the measured tap target on the new control**, every caller of `countSummary` you found, and what the expanded state reads.
- **C2: what you did with `?view=`**, and that `?w=` deep links and back/forward still work.
- **C2: what the page renders for an empty chip** — Racing has no data at all.
- **D1: the logo-versus-surface measurement.** This is the acceptance criterion for Joe's chosen option and the one place where a bad result should stop the change rather than dress it up.
- **D3: ALL-grid row counts, lanes, scrollWidth and M3 behaviour**, against each sport alone.
- **D4/D5: the rendered header string and the nav at 360**, plus which networks fell back to text.
- **Geometry:** D1 changes padding and gaps inside the block. **Confirm lane counts, block widths and scrollWidth are unchanged** against prompt 35's numbers — CFB lanes 58/60/59/58/60/61/60/61/58/59/61/60/60/81/61, 62 blocks, widths 240/223, scrollWidth 1073; MLB lanes 28/27, 3 blocks, 231, 582. A change here is a hard stop.
- **Prompt 30's zoom fix**: rail pinned at 0.6 / 1.0 / 2.5 after panning. Must not regress.
- **Confirm the racing zero** — no rows for `nascar` or `indycar` in the whole database.
- **Anything in this brief that turned out wrong.** Prompt 35's brief carried six errors, including a citation to a constant Cowork's own earlier prompt had replaced. Every reference here was read this session, and that was true last time too.

---

# Explicitly out of scope

- **Loading racing data.** Confirmed absent; it is a pipeline prompt.
- **Backfilling the twelve stuck MLB rows**, and the `schedule_refresh` / render-job gap behind them. Both still held.
- **Sourcing the TBS mark** — Cowork's job; D5 falls back to text until it exists.
- **The away / home / venue card restack.** A3 is the network-to-venue swap only, by Joe's ruling.
- **The count line moving beside the band header on the GRID** — B2 covers the list bands; the grid header is D4.
- **Re-tinting the whole block to rescue a logo**, if D1's measurement is bad. Report instead.
- **`bandFor` and the ink rule.** Measured, shipped and unchanged.
- **Widening any block.** Geometry is frozen.
- Anything in `pipeline/`, `adapters/`, or the database.
