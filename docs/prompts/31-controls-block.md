# Claude Code — Prompt 31: the controls block, the chrome, and two card fixes

**Repo:** `C:\Users\jlull\Joe's Projects\Apps - Personal\MySports` · **main**

**This supersedes the earlier prompts 31 and 33** — they are merged here for one unattended run. Prompt 32 (the grid's team-colour bands) stays separate and waits for Joe's phone to confirm prompt 30.

**Preconditions, hard stop if any fail:**

- `git rev-parse HEAD` == `f56c525`, and `HEAD == origin/main`.
- Python **200 OK (skipped=1)**, JS unit **169/169**, smoke **30/30**, qa-shots **14/14**.
- **`web/public/leagues/racing.png` and `racing_dark.png` present and uncommitted** — Cowork built them; stage 1 commits them. Prompt 30 correctly declined to hard-stop on them. If absent, stop and say so rather than generating art.
- Tree otherwise clean apart from untracked `assets/`.

**Nine stages, self-committing (rule 7).** Nothing here touches the phone grid, so it cannot disturb prompt 30's zoom rewrite. **Working rule 22** — locate by content, report any citation that does not match. **Rule 23** — `docs/design/mobile_demo.html` changes in the same commit as anything it specifies. Also rules 3, 4, 13, 16, 20.

**No database, no pipeline, no adapters, no migration.**

**Target layout at ≤699 px:**

```
[  ALL  ......................................... full width  ]
[ CFP ][ NFL ][ NBA ][ NHL ][ MLB ][ RACE ][ UFC ][ WWE ]
[ Day ][ Sep 3, 2026 ]   9 MLB broadcasts
```

---

## Stage 1 — the Racing art and register §16

### 1a. Commit the art

`web/public/leagues/racing.png` and `racing_dark.png` — composited by Cowork from the existing `nascar_dark` / `indycar_dark` sources into a square: NASCAR's wordmark across the top, IndyCar's badge below. Cowork rendered it at real chip size before shipping it and judged it acceptable. **Commit by explicit path; do not regenerate.** If it looks wrong to you, report and stop.

### 1b. Append to `docs/enhancement-register.md`, verbatim

```markdown
## 16. RACING — 2026-09-03. One chip over two sports, and the ALL bar takes its own row.

**This amends §9's Q1 and §13's chip roster.** §9 recorded Joe choosing individual chips per sport and
explicitly rejecting grouped "Racing" and "Wrestling" chips. Joe reversed that for racing only, and the
contradiction was named before acting: NASCAR and IndyCar now share one chip.

**Presentation only — there is no schema change.** `sport` keeps `nascar` and `indycar` as separate
enum values and the database is untouched. The Racing chip filters on both. Chosen over a true merge
because neither sport has data loaded yet, nothing has to be undone if they are split again, and a
`racing` enum value would make IndyCar a fourth "series" alongside NASCAR's Cup, O'Reilly and Truck —
a shape that describes the chip row rather than the sport.

**The mark** is a new square composite: NASCAR's wordmark across the top, IndyCar's badge below. This
is what makes the chip work at all — §13 measured NASCAR alone at 126 px against a 21 px height, a 6:1
wordmark that a square tile crushes to a few pixels of height. Stacked, both marks read. A double-width
racing tile was built and rejected by measurement: in a 2:1 box NASCAR claims the width and squeezes
IndyCar smaller, so it is worse, not better.

**The ALL bar.** "All" leaves the tile row and becomes a full-width bar directly above it, one tile
tall. Two consequences Joe wanted: All becomes the largest control on the page, and the tile row loses
two members — All itself, and one of the two racing chips.

**The row no longer scrolls, and that is the point.** §13 ruled the row scrolls horizontally because ten
marks could not fit. Eight tiles can, if they share the row's width instead of each claiming a fixed
44 px. **The tiles now flex to fill the row exactly**, so the row fits at every width by construction
and the horizontal scroll is gone — Joe: *"I find [it] very annoying."*

**Cost, named and accepted.** Flexing to fit means the tile is no longer a fixed 44 px. On a 390 px
phone eight tiles land near 40 px, under the 44 px tap target prompt 25 established. That is the trade
Joe chose: a slightly smaller target on every tile, in exchange for never swiping to reach a sport.
```

---

## Stage 2 — the tile row

**Read first:** `web/components/Filters.js` (`SportFilter`), `web/lib/config.js` (`SPORTS`, `SPORT_LABEL`, `CHIP_MARK`), `globals.css` (`.chiprow`, `.spbtn`, `.spbtn img`, `.spbtn-all`, prompt 26's active rule).

**2a. Racing replaces two chips.** The row becomes eight: **CFB · NFL · NBA · NHL · MLB · Racing · UFC · WWE**, Racing where NASCAR sat.

Selecting Racing filters **both** `nascar` and `indycar`. The sport query param carries one value today (`?sport=cfb`) — accept `racing` and expand it to the two underlying sports **in `web/lib/queries.js`, not in the component.**

**Check every consumer of `SPORTS` and of the sport param first.** Prompt 25 found `queries.js` builds `&sport=eq.<s>` against a Postgres enum, so an unexpanded `racing` is a 400, not an empty state. Grep, list what you find, and **test the Racing chip against the live database before shipping it** — report the status code. Both sports return empty today; that is the expected result.

Empty-state copy for Racing, replacing the separate NASCAR and IndyCar lines — both facts kept, since they are two reasons resolving on different clocks:

> `It is not loaded yet. NASCAR arrives with the playoffs, September 6; IndyCar's 2026 season ends this month, with the 2027 schedule in October.`

Match the sentence shape prompt 27 shipped, which pronounces the sport once in the shared prefix.

**2b. The tiles flex to fill.** `.chiprow` loses `overflow-x: auto` and its scroll affordances. `.spbtn` loses its fixed `width`/`min-width` and becomes `flex: 1 1 0; min-width: 0; aspect-ratio: 1 / 1`. Keep `border-radius: 10px` and the mark rule (`max-width/max-height: 100%; object-fit: contain`).

Desktop keeps fixed 36 px tiles left-aligned — eight tiles stretched across 1100 px would be absurd. Gate the flex to ≤699 px.

**Report the measured tile size at 360, 390 and 430 px** and confirm no horizontal scroll at any. **If the 390 px tile lands below 38 px, say so** — small enough that Joe should see it before it ships.

**2c. The plate reads like a plate.** Joe chose keep-every-tile over invisible. Border from `var(--line-soft)` to **`var(--line)`**, which is what the locked reference uses on `.spbtn`. Then judge by render whether the existing panel gradient still reads as a plate at the new border weight, or whether a flat slightly-lighter charcoal reads cleaner at this size — **pick by looking, report which and why**, and take the value from `globals.css` (rule 16).

Prompt 26's active state (charcoal plate, gold border) is unchanged. **Confirm the active tile still reads unmistakably against eight neighbours that now also have visible borders** — that is the risk this change introduces. If it no longer separates, the reference's second cue costs no layout: `box-shadow: 0 0 0 1px var(--gold) inset`.

**2d. The ALL bar.** "All" leaves `.chiprow` and becomes a full-width bar directly above it: same height as a tile, same radius, same border and plate, **left and right edges flush with the tile row beneath.** Centred Barlow Condensed 700 uppercase. Active gets gold border *and* gold text.

---

## Stage 3 — the Day row and the count text

**3a.** In `web/app/page.js`, the `.controls` block holding `DatePicker` and `SportFilter` sits under the `<h1>`. Reorder so the ALL bar and tile row come first, then a row carrying the `Day` label, the date input, and the count text to its right.

Keep the `Day` label — unlike the `Sport` and `View` spans prompt 25 deleted, it does real work in front of a control whose own text is a date. If it is still a bare `<span>`, make it a real `<label for>`.

**3b.** Delete `<p className="sub">` from under the `<h1>`. Its content moves beside the date picker and becomes:

- all sports → **`80 broadcasts`**
- one sport → **`9 MLB broadcasts`** (`SPORT_LABEL`; Racing reads `9 Racing broadcasts`)
- singular → `1 broadcast`, `1 MLB broadcast`

**Two words deliberately dropped from Joe's original wording, flagged to him and agreed:** no *"available"* — contract v1.6.6 and 05 §10 make *available* and *airing* mean "on services Joe has", and the band line below already says `6 airing · 48 TBD · 5 unavailable`; a header claiming 80 are available above a line saying 5 are unavailable is a contradiction on one screen. And no *"today"* — the date picker beside it supplies the day, and "today" is wrong every time Joe views Saturday.

---

## Stage 4 — YOUR TEAMS becomes a heading

Joe: *"Your Teams renders in small gray text like an afterthought."*

`.favlabel` was specified under D6 as a faint micro-label separating floated rows *inside* a band. Prompt 27's reorder (05 §11) made it the **first heading on the page**. Right treatment for the old job, wrong for the new one — and 05 §5 has had this open since the decision board. **This closes it.**

Give it the band-header treatment so the page has one heading system: Barlow Condensed 700, uppercase, the band-header size, `var(--ink)`, with the same bottom hairline `.band-head` carries. **Take every value from the existing `.band-title` / `.band-head` rules** rather than retyping numbers.

**Cowork's call, flagged for veto:** `--ink` rather than gold. Gold would mark it as the personal section but would make the first heading louder than every heading under it, and D6's surviving instruction is to avoid excessive decorative treatment. One token to switch.

Update 05 §5 to record the item closed and how.

---

## Stage 5 — the compact navbar sits under the iPhone status bar

Joe, on the installed app: *"The 'Weeks' and 'History' tabs eliminate the large banner and go to the smaller navbar banner. That banner is behind the bezel and the clock and battery on iPhone."*

**Confirmed:** `globals.css` contains exactly **one** `safe-area-inset-top` rule — the one on `.banner`. `.navbar` (`height: 60px`, its own gradient) never got it, and `Chrome.js` renders `<NavBanner />` on every route except `/`, so Weeks and History have run under the clock since the app went standalone.

**Joe's ruling: extend the bar's own background upward**, matching the home banner, not a separate strip.

Apply the same absorb-not-stack shape prompt 28 landed at `99bda44`: `padding-top` takes the inset, the gradient covers it, the 60 px of content sits below the clock. **Measure `.navbar`'s existing internal headroom first and subtract it**, so the bar gains no more than the status bar needs — report the number subtracted.

**Verify by simulation** — Playwright cannot produce a real inset. Substitute a literal 47 px for `env(...)`, screenshot `/weeks` at 390 px, remove the override, report before/after. Then state plainly that only Joe's phone confirms it.

---

## Stage 6 — remove "ET" everywhere, add one footnote

Joe's ruling: everywhere, one italic footnote at the page bottom.

Every surface printing a clock time drops the suffix: the card's time column, the grid block's tray, `GameDetail.js`, and the `data as of` line. **Grep for `ET` across `web/` and report every site before changing any** — some are identifiers or comments, not display strings, and those stay.

**The footnote** is a new line at the page bottom, italic: *All times are Eastern.* It sits beside the existing footnote in `app/layout.js` as its **own line**, per Joe's choice. Same footnote type treatment; italic is the only difference.

`DISPLAY_TIMEZONE` in `lib/config.js` is unchanged — this is display only; the app still renders ET and the footnote now says so.

**Measure the knock-on:** the card's time column is sized for `12:00 PM ET`. **Report the column width before and after and the width freed** — do not resize the column here; the number feeds stage 7 and the decision is Joe's.

---

## Stage 7 — the `@` drops to its own line

Joe: *"Sometimes it shows to the right of the away team, but when the away team has a longer text it can get bumped to its own row."*

**Cause verified.** `globals.css`'s `.duel` carries `flex-wrap: wrap`. The locked reference does not:

```
mobile_demo.html:97   .duel.hug{display:flex; align-items:flex-start; gap:6px}
mobile_demo.html:98   .duel.hug .tcol{flex:0 1 auto; min-width:0}
mobile_demo.html:99   .duel.hug .atbig{flex:0 0 auto}
```

The reference holds one line and lets the stacks **shrink**, so the name-size tiers (15 → 12.5 px past 13 chars → 11 px past 19) and then `text-overflow: ellipsis` absorb a long name. Prompt 25 stage 7b measured the app wrapping at **every width ≤410 px** — the normal case on a phone, not occasional.

**Fix:** remove `flex-wrap: wrap`; give the two `.tcol` `flex: 0 1 auto` and confirm `min-width: 0`; give the `@` `flex: 0 0 auto`. Change nothing else about the duel.

**Then verify the tiers engage**, since they are what makes truncation a last resort. Report at 360 / 390 / 430 px: the widest away name holding 15 px, the width where each tier takes over, and the first name that truncates. **Find the worst real case by querying the database's longest team display names rather than guessing**, and screenshot it.

**If a name still truncates at 390 px, say so with the screenshot rather than spending stage 6's freed width to compensate.** That is Joe's call, not this prompt's.

---

## Stage 8 — even spacing for the time and date

Joe: *"The start time and date render on consecutive lines centered vertically… I'd like the start time approximately 1/3 down from the top of the card and the date approximately 2/3 down. All I'm looking for is equal spacing."*

The time column holds `.mtime` and, where `showDay` is on, `.mtime-day`. Prompt 29 measured `.mtime` at a flat 34.5 px against card bodies of **68.3 / 91.3 / 186.3 px**, so on taller cards it floats mid-card with dead space above and below.

**Fix:** make the time column stretch to the card's content height and distribute its children evenly — a flex column with `align-self: stretch` and `justify-content: space-evenly`. Two children then land at roughly one-third and two-thirds, which is what Joe asked for, and it stays correct at all three card heights without a magic number.

**Do not add a literal line break or a fixed margin** — either is right on one card height and wrong on the other two.

Applies where `showDay` is on (`/weeks`, `/history`). On Today the column holds only the time; **confirm a single child still centres rather than pinning to the top.**

**Acceptance:** at 390 px on `/weeks`, report the measured offsets of time and date as a fraction of card content height, for each of the three card heights. Screenshot one of each.

---

## Stage 9 — the reference, and the report

**Rule 23.** `docs/design/mobile_demo.html` specifies `.chiprow`, `.spbtn` and `.duel.hug`. Stages 2 and 7 change all three. **Update the reference in the same commit as the code** — the scrolling row becomes a flexed row, `.spbtn` gains the flex sizing, the ALL bar is added, and `.duel` is already correct there so confirm rather than change it. Prompt 29 found `--faint` stale in that file on the day rule 23 was written; check the whole token block while you are in there and report any other drift.

**Report** per stage: what changed, the sha, the evidence, every judgment call. Gates before and after. Call out specifically:

- Measured tile size and row width at 360 / 390 / 430 px; no horizontal scroll at any; no page-level scrollbar.
- Screenshots at 390 px: the ALL bar active, Racing active with its empty state, one ordinary sport active — so Joe can judge whether the stronger border still lets the active tile stand out.
- The Racing chip against the **live database**, with the status code.
- The rendered count text for an all-sports day and a single-sport day.
- The YOUR TEAMS heading at the top of the page.
- The navbar headroom subtracted and the simulated before/after — flagged as needing Joe's phone.
- **Every `ET` site found**, and which changed versus left as code.
- **The width the time column could give back**, measured and unspent.
- The name-tier table, and whether anything still truncates at 390 px.
- The three fraction measurements from stage 8.
- **Anything in this brief that turned out wrong.** Seven reports running have found bad citations in their own briefs; that has been the most useful part of each.

---

## Explicitly out of scope

- **The phone grid** — prompt 30 just rewrote its zoom mechanism and prompt 32 carries the team-colour bands. Nothing here touches `MobileGrid.js` except stage 6's `ET` removal in the block tray, which is a string change only.
- **Resizing the card's time column** — stage 6 measures the headroom; spending it is Joe's decision.
- **The two-row stacked matchup** the outside audit proposed — stage 7 restores the reference's single-line behaviour, which is the locked design.
- A `racing` enum value or any migration — presentation only, per register §16.
- The `/weeks` View chips and the week `<select>` — they use `.chip`, untouched here.
- `DISPLAY_TIMEZONE`, and anything changing which timezone renders.
- The four project-only builders (`build_demo.py`, `app_template.html`, `build_banner.py`, `markkit.py`) — Cowork places those.
- Anything in `pipeline/`, `adapters/`, or the database.
