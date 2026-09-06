# Prompt 53 — the hub's display architecture corrected, and the studio-show logos

**Merged run. Ten stages, each gating and committing on its own.**

`CLAUDE.md` at the repo root is the standing brief and you have already read it: the venue split, the
29 working rules, the four gates, the geometry tripwire and the approval rule are all there. **This
prompt does not restate them.** Where a stage collides with a specific rule it names the number.

This prompt implements a read-only analysis of the Schedule Hub done 2026-09-06 at `61469b6`. Every
file:line below was read out of the component; verify each before acting on it and report any that
has moved (rule 22).

---

## PRECONDITIONS — checked once, here

1. `HEAD == 61469b6 == origin/main`.
2. Working tree clean except the six untracked `assets/` directories, which now include four new
   files in `assets/program-logos/` staged by Cowork — see stage 7. **They stay untracked**;
   `assets/` is source art and is never committed.
3. Baseline gates recorded before any edit: Python **466 + 1 skipped**, JS unit **367**,
   smoke **30/30**, qa-shots **14/14**.

**Do not re-assert the sha in a later stage.** This run moves HEAD ten times by design.

---

## STAGE 1 — the archive claim, and the rule this run owes

`docs/handoff-status.md` still says prompts 50 and 51 "were never filed" and "could not be
reconstructed." **Both statements are false** — `cdfae84` filed both, and they had been sitting in
`Claude outputs\` the whole time with the README naming prompt 50's path exactly.

- **Header (around line 15-20):** replace with the plain state — **54 briefs in `docs/prompts/`; 39
  and 42 are the only gaps and are not recoverable.** Keep the miss on the record in one sentence:
  prompt 52 stage 8 reported them unreconstructable, that was wrong, and the path was in the note it
  was reading.
- **The open item under "Opened by prompt 52" (around line 268):** retire it, marked closed by
  `cdfae84`. Do not delete the entry.
- **DO NOT TOUCH `docs/prompts/README.md:97.** It carries nearly identical wording — "not
  reconstructed and no placeholder was written" — about **prompts 39 and 42**, and it is TRUE. Read
  the surrounding section before editing anything in that file. If you sweep for the phrase, that
  line is the one that must survive.

**Write working rule 30** (rules stop at 29 — verify before numbering). It covers two instances from
one run: `bignoon`'s `"no mark in the tree"` when `web/public/programs/big-noon-kickoff.png` had
existed for four days, and the archive's deliberate "not yet filed" read as a permanent gap.
Proposed, sharpen as you see fit:

> **A note recording an absence is a timestamp, not a fact.** Before acting on "missing", "not yet
> filed", "no mark in the tree", "none exists" or "TBD", check the thing itself — and when the note
> turns out to be stale, correct the note in the same commit as the work it misled you about.

Cite both instances so the next reader sees why it exists.

**Commit:** `docs: the archive is 54 briefs; working rule 30`

---

## STAGE 2 — two one-line defects

**2a. The sport filter is dropped on the season-week programs read.** `page.js:226-229`:

```js
const progs = seasonMode
  ? await programsForRange(wk.start, wk.end)          // <- no sport
  : await programsForRange(wk.start, wk.end, P.sport);
```

`seasonMode` is true **only when a sport is selected** (`page.js:205`), so the branch that knows the
sport is the one that discards it. Consequence: WEEK · CFB and WEEK · NFL render that sport's games
beside **every sport's programs** — NASCAR races, UFC cards, WWE and AEW shows, 196 rows in the
database.

Pass `P.sport`. `programsForRange` already takes it as its third argument (`queries.js:332`).

**This loses nothing you want:** the studio shows that belong on an NFL week carry `sport = 'nfl'`
themselves (`favorites.js:50-51`), so filtering by sport keeps them and drops only the unrelated
sports. Prove it — report the row counts for one CFB week and one NFL week before and after.

**2b. A stale comment.** `Listing.js:76` says bands render *"in SPORTS order (cfb, nfl, nba, nhl,
mlb)"*. `config.js:42` is `['nfl', 'cfb', 'mlb', 'nba', 'nhl', …]`. The code is right; the
parenthetical is wrong. Fix the comment, not the constant.

**Commit:** `hub: a season week shows its own sport's programs`

---

## STAGE 3 — GRID VIEW means the grid is the primary object

**Joe's ruling, 2026-09-06.** Today the toggle adds a grid nowhere and only removes things.

**Read and cite first:** `page.js:362-377`, `Listing.js:28-30` and `:97`, `:116-150`,
`globals.css:1985-2002`.

### The defect

`page.js:374` passes `gridOnly={P.isGrid}`. `Listing.js:28-30` **does not destructure it.**
`git grep gridOnly` returns exactly one line in the whole repo — the call site. No CSS compensates.
So GRID VIEW never suppresses the list; `bands={!P.isGrid}` merely collapses the sport bands into one
flat unheaded block. And `.mgrid-only` is `display:none` above 699px, so on desktop GRID VIEW renders
**no grid at all** and a degraded list. It is one click from LIST and strictly worse.

### What to build

**On a phone (≤699px):** GRID VIEW renders the mobile grid and **suppresses the list entirely**.
Implement the suppression properly — either read `gridOnly` in `Listing` or drop the prop and gate on
what is already there. Do not leave a passed prop unread.

**On desktop (≥700px):** the mobile grid stays phone-only — the Mobile Grid Addendum's deviations
are phone-only and M5 says "PC keeps v1.2 labels," so do not lift it. GRID VIEW instead **promotes
`ArchivedGrid` to the top of the page** and suppresses the list. `ArchivedGrid` (`page.js:85-114`)
already renders an honest one-line empty state when no PC grid exists for that `(sport, day)` — use
it rather than writing a second one.

**With ALL SPORTS selected on desktop**, there is no archived grid to promote: it is per `(sport,
day)` by construction. Render one honest line saying the desktop grid is per league and to pick one,
in the same voice as the existing `gridnone` copy. Do not fall back to the phone grid.

**LIST VIEW is unchanged in every respect.** The FirstBand suppression in grid view (`page.js:367`)
stays as it is and is correct.

### Acceptance

- At 390: GRID VIEW shows the grid and **zero** matchup or program cards. Report the card count.
- At 1440: GRID VIEW with a sport shows the archived grid at the top and no list; with ALL SPORTS it
  shows the one-line explanation and no list.
- LIST VIEW at both widths is byte-identical to before — diff the rendered DOM node count.
- The tripwire is untouched: CFB `2026-09-05` 64 blocks / {240, 223, 205, 136} / **1273**;
  MLB `2026-09-03` 3 / {228} / **568**.

**Commit:** `hub: GRID VIEW shows a grid and nothing else`

---

## STAGE 4 — week mode inherits two things day mode already has

**4a. The empty state.** `page.js:192` returns `"No UFC games loaded for this week."` — the bare "no
games" register §13 rules out. Day mode gives racing, nascar, indycar, ufc and wwe bespoke copy
(`SPORT_EMPTY`, `page.js:70`). **Share it.** Same tile, same absent data, one answer in both modes.
Keep week mode's own "for this week" framing; only the explanatory half is shared.

**4b. The provenance line.** `DataAsOf` (`page.js:124`, rendered at `:384`) is day-only, and so is the
live overlay (`:313`). A week containing today therefore renders today's games with database scores
and **no line saying they are not live** — which `DataAsOf`'s own docstring (`page.js:120`) argues is
the worst option.

**Do NOT add the live overlay to week mode** — that is a per-day fetch and a week is up to ten days.
Render `DataAsOf` with the "no live check" wording, stating plainly that a week view does not check
live scores. One accurate sentence beats silence.

**Commit:** `hub: a week says why a chip is empty, and where its scores came from`

---

## STAGE 5 — sport bands in week mode, under ALL SPORTS only

**Joe's ruling.** Banding adds information exactly when more than one sport is on screen and adds
only heading noise when the tiles have already narrowed it to one.

`page.js:275` passes no `bands` prop, so `Listing.js:29` defaults it false and every week day renders
one flat `SportBand` with the weekday as its section label. Under ALL SPORTS an NFL game and an MLB
game sit adjacent with nothing distinguishing them.

**Pass `bands={!P.sport}` and `sport={P.sport}` from the week branch.** With a sport selected the flat
shape is retained exactly as today.

The comment at `Listing.js:129` justifies the flat branch as *"/weeks and /history keep their flat
structure."* Both are retired — they are redirects (`web/app/weeks/page.js:22`,
`web/app/history/page.js:28`). Correct the comment to say what the branch is actually for now.

**Watch the nesting:** a day heading with sport bands beneath it is two heading levels. Report the
rendered heading hierarchy at 390 and confirm the weekday heading still reads as the outer one.

**Commit:** `hub: an all-sports week separates its sports`

---

## STAGE 6 — the "Your teams" tautology

`SportBand.js:55` leaves `floatFavorites` at its default `true` in every arrangement, and the float
tests `isFavorite` (`favorites.js:19`) while the scope tests `isMine` (`:71`).

Under `scope=mine`: an NFL band contains only favourites, so **every row floats under a "Your teams"
label with a trailing hairline separating a list from nothing**; a NASCAR band is in scope via
`TEAMLESS_SPORTS` but fails `isFavorite`, so nothing floats and no label renders. One page, some
bands entirely labelled and others entirely not, for reasons invisible to the reader.

**Pass `floatFavorites={!P.isMine}` through `Listing` to `SportBand`.** Under MY TEAMS the page is the
label. Item 9 — `FirstBand`'s inner `Listing` (`FirstBand.js:39`) double-labelling a favourite that
also appears in its band below — falls out of the same change; confirm it does.

**Leave the ALL GAMES behaviour alone.** A race carries no team, so it takes no "your teams" marker
there, and `favorites.js:66` records why. That is deliberate and is not in scope.

**Commit:** `hub: MY TEAMS does not label every row as yours`

---

## STAGE 7 — four studio-show marks

Cowork staged four files in `assets/program-logos/`, inspected and measured:

| file | size | state |
|---|---|---|
| `fox-nfl-sunday.png` | 1280×720 RGBA, 66% clear | **replaces** the retired lockup currently shipping |
| `netflix-gameday.png` | 582×476 RGBA | halo pixels average RGB (7,6,6) — near-black, vanishes on charcoal |
| `tnf-pregame.png` | 2160×2160 RGBA, 55% clear | the TNF shield; blue with white type |
| `fox-nfl-kickoff.png` | 270×390 RGBA, 93% opaque | **portrait, 0.69** — the first portrait program mark |

Add each to the `PROGRAMS` table in `scripts/build_brand_marks.py` (`:278`) with a treatment, a recipe
note and a provenance line — **provenance is mandatory, a mark with no recorded source does not
ship**. Provenance here is "supplied by Joe, 2026-09-06".

**Treatments to work out, not to assume.** `fox-nfl-kickoff` and `fox-nfl-sunday` are **black and
yellow**: the FOX and KICKOFF/SUNDAY boxes are black and will vanish on charcoal while the yellow
survives. That is the problem `whiten_below_gap` already solves for `football-night-in-america` and
`sunday-nfl-countdown` — start there and tune the cut, then look at the result composited on
`--spot-2 #1b1b1b` before accepting it. `netflix-gameday`'s soft halo may want `alpha_harden`;
measured, it renders acceptably either way, so only harden it if the render is better for it.

**Wire the brands** in `data/brands.json` through a parser (rule 17), explicit newline (rule 29):
`mark_dark` for `foxnflsunday`, `netflixpregame`, `tnfpregame` and `foxnflkickoff`, and clear
`provisional` where a colour can now be derived from the art the way `indycar` was. Report every
colour you derive and the method.

**Two naming corrections.** `netflixpregame`'s title is `"Netflix NFL Pregame"`; the art reads
**NETFLIX GAMEDAY**, which is the show's name — correct the title and the `short_title`. Check
`tnfpregame`'s title against its art too and report rather than guessing.

**THE NORMALIZATION HAZARD, and it runs in one direction only.** `build_brand_marks.py:239 target()`
recovers the ink-area target from the **frozen network manifest** and never recomputes it from the
programs, so adding program marks cannot move a network `hf`. Verify that by reading `target()` and
`build_programs()` before relying on it, then say in the report that you did. **Diff
`web/public/marks/manifest.json` before and after and prove it is unchanged.**

Never a hand-edited PNG, never a hand-edited manifest.

**Commit:** `programs: four studio-show marks, sourced and processed`

---

## STAGE 8 — the logo takes priority in the grid

**Joe's ruling, 2026-09-06, and it inverts the current rule.**

> "I want the pregame/postgame program logos to appear clearly no matter what. Priority should be
> given to the LOGO to render clearly — even if it prevents text from rendering… if it fills the
> entire space that is fine — only if there's enough room to render the logo clearly on the left in
> the logo tile, then open up the text portion of the card to the right, only then should logo AND
> text both render."

**Read and cite first:** `MobileGrid.js:716-796` (`ProgramBlock`), `:722` (the cap), `:733-738` (the
title ladder), and the `.pcap` / `.pstage` / `.pwash` / `.ptext` rules in `globals.css`.

### What is there now, and why it is backwards

`cap = Math.max(16, Math.min(blockH, w / 3))` — the logo tile is a third of the block, floored at
16px. `span = Math.max(0, w - cap - 10)`, and the title takes the largest of
`[26, 22, 18, 15, 13, 11] × SCALE` that fits, **falling through to the smallest when none does**. So
the logo is squeezed to a third and the text always renders. Joe wants the opposite.

### The rule to build

**Scope: every program type** — studio shows, races, fight cards, weekly shows. Long blocks keep both
anyway because they have the room, so in practice this changes only the short ones.

**Two layouts, chosen by width.**

1. **LOGO ONLY.** The mark is fit-boxed into the whole block body, centred, at its clear height. The
   brand **wash stays behind it** — it is what makes four red-branded shows tell each other apart.
   The **seam and the tray stay** — the tray carries the start time and venue and you need them. The
   **3px brand bar goes** (there is no endcap edge left to mark) and so does the **subtitle**.
2. **LOGO + TEXT.** The mark sits left in the endcap at its clear size; the title and subtitle take
   the remainder; the brand bar, wash, seam and tray are exactly as today.

**The threshold, stated as a rule rather than a number:** compute the width the mark needs to render
at its clear height — `H_logo × aspect`, where `H_logo` is the block body height less its inset and
`aspect` comes from the published PNG. **Text renders only if, after that width and the gap, the
title still fits at 18 × SCALE (14.4px) or larger.** Below that the block is LOGO ONLY. Rationale:
text that has to shrink past legibility is not information, and Joe would rather have the mark.

**Derive `aspect` from the manifest, not from the DOM.** `web/public/programs/manifest.json` is
`[{slug, hf, recipe, ink_area, target, lum}]` — **extend it with `w` and `h`** the way prompt 52
extended the network manifest, by reading the published PNGs, so the layout decision is deterministic
and server-renderable. Do not measure an image at runtime; that is a layout shift.

**A brand with NO mark keeps today's treatment** — the title centred on the wash, with `pcap-type`
as it is now. Logo priority applies only where there is a logo, so the gap stays visible rather than
disguised. `foxnflkickoff` will have art after stage 7; a future brand will not.

**Zoom:** the grid's pinch multiplies `pxPerMin`, so a block widens with zoom while `blockH` does
not. The logo stays at its clear size and **the extra width goes to the text** — which is what makes
Joe's "as the grid card is expanded, the text can render" true. Do not grow the logo with zoom.

### Acceptance

- A table of every program brand: slug, aspect, the width its clear logo needs, and the block width
  at which text starts rendering — at zoom 1 and at zoom 2.
- Screenshots at 390 of: a 30-minute block (logo only), a 60-minute block, and a 2-hour block (both).
- **Geometry frozen.** Block widths, lane counts, block heights and tray heights are identical before
  and after. The tripwire is a hard stop: 1273 / 568, counts and widths unchanged.
- Gates at or above baseline.

**Commit:** `grid: the program logo renders first, the title only when it fits`

---

## STAGE 9 — the record

**Enhancement register §21** (last section is §20 — verify): the hub's display architecture
corrected. Record GRID VIEW's meaning at both widths and that `gridOnly` was dead; week mode
inheriting the empty states and the provenance line; sport bands under ALL SPORTS only and why not
otherwise; the MY TEAMS float; the season-week programs bug; and the logo-priority rule with its
14.4px text floor as Joe's ruling.

**`docs/handoff-status.md`:** this run's stage/commit table, the gate counts, and any tripwire
figure that moved (none should).

**`docs/design/mobile_demo.html`** if stage 3 or 8 altered anything it implements (rule 23).

**File this prompt** at `docs/prompts/53-hub-architecture-studio-logos.md`, verbatim.

**Commit:** `docs: register §21 and the run of record`

---

## THE REPORT

1. **What Joe has to look at on his phone**, with screenshots: GRID VIEW now showing only a grid, the
   four new studio-show marks, and the logo-priority rule at three block widths.
2. The program-brand table from stage 8.
3. Stage by stage: sha, what changed, gate counts, anything skipped under two-strikes.
4. **Every citation in this brief that was wrong**, with the correction. Assume there are some.
5. HEAD, and whether `HEAD == origin/main`.
