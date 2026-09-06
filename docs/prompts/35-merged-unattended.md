# Claude Code — Prompt 35: one unattended run, three phases (the old 34, 33 and 32)

**Repo:** `C:\Users\jlull\Joe's Projects\Apps - Personal\MySports` · **main**

This replaces the separately-issued prompts 34, 33 and 32. **Run it start to finish without stopping for input.** Everything that needed a human decision has either been decided below or moved out of the run — see *The one thing this run does not do*.

---

## Preconditions — checked once, at the start. Hard stop if any fail.

- `git rev-parse HEAD` == `45c339e`, and `HEAD == origin/main`.
- Python **200 OK (skipped=1)**, JS **169/169**, smoke **30/30**, qa-shots **14/14**.
- Tree clean apart from untracked `assets/`.

**Do not re-assert `45c339e` at the start of phases B and C.** Each phase moves HEAD; the later phases begin from whatever the earlier ones left. That mistake would halt this run on its own success.

## How this run works

Three phases, in order. **After each phase: run the full gate set, and commit only if it is green.** A phase's commits are independent of the next phase's — that is what makes this bisectable if something is wrong tomorrow.

**Hard-stop policy.** Several stages below say *hard stop*. In this run a hard stop means: **stop that stage, leave the earlier phases' commits alone, record what stopped and why, and continue to the next stage or phase if it does not depend on the stopped one.** Never roll back a green phase because a later one failed. Never force a change past a hard stop to keep the run moving.

**Judgment calls.** Where this brief says *Cowork's call, flagged for veto*, ship it and report it clearly. Joe reviews after the run, not before. Where the brief gives you a hypothesis rather than a fact, **verify it; if the real cause is different, fix the real cause and say so.**

**Working rule 22** — locate by content, report any citation that does not match; line numbers have drifted after every prompt this week. **Rule 23** — the locked reference (`docs/design/mobile_demo.html`) changes in the same commit as anything it specifies. Also rules 3, 4, 13, 16, 20.

**No pipeline, no adapters, no migrations. No database writes** — read-only queries are expected and encouraged.

## The one thing this run does not do

**Twelve MLB games are stuck at `result_status = 'in_progress'`** with kickoffs 2026-09-01 22:40 to 2026-09-02 00:40 UTC — Monday night. Nothing finalised them, so they render LIVE permanently.

Phase A stage 4 builds the **display-layer guard** that stops a game claiming LIVE forever. That is code and it runs here. **Backfilling the twelve rows is a database write and it is deliberately out of this run** (working rule 6). Report the twelve rows and the finals you would write, and leave them. Joe approves that separately.

---

# PHASE A — what prompt 31 broke, plus two real defects

Two of these are prompt 31's own regressions, confirmed against production rather than assumed: `/history` carries prompt 31's *"All times are Eastern."* footnote, and `/?day=2026-09-04` serves all eight league marks including `/leagues/racing_dark.png`. **The build shipped.** So this is prompt 31's code behaving differently on iOS Safari than it did in Chromium.

Joe, on the installed app: *"The sport chips have not rendered at all. They're tiny little gray chips with nothing in them at all."*

## A1 — the sport tiles collapse on iOS Safari

**Known:** the eight `<img>` elements are present in the served HTML with correct paths, and every file is committed and reachable. **This is not a missing asset.** Prompt 31 measured 40.5 px square tiles at 390 px **in Chromium**. Joe sees near-zero tiles on a real iPhone.

**Cowork's hypothesis, to be verified rather than assumed** — the app's third bad guess about this component would be one too many. Prompt 31 shipped, inside `@media (max-width: 699px)`:

```css
.sportrow > .spbtn {
  flex: 1 1 0;         /* flex-basis: 0 - no intrinsic main size */
  width: auto;
  min-width: 0;
  height: auto;
  min-height: 0;       /* the floor that would have caught this, removed */
  aspect-ratio: 1 / 1; /* the only thing giving the tile a height */
}
```

The tile's height comes solely from `aspect-ratio` resolved against a main size that starts at zero and is only established by flex growth. WebKit resolves that ordering differently from Blink, and `min-height: 0` removes the backstop. The mark then inherits the collapse through `max-height: 100%`.

**The fix — robust whether or not the hypothesis is right. Give the tile a definite height and flex only the width. Drop `aspect-ratio` from the mobile rule entirely.**

- `height: 44px` and `min-height: 44px` at ≤ 699 px, with `flex: 1 1 0; min-width: 0` unchanged.
- Tiles become roughly 40 × 44 rather than exactly square. At that size the difference is invisible, and **it restores the 44 px tap target** prompt 31 traded away — so this is a net gain, not a compromise.
- Desktop's fixed 36 × 36 is unchanged.

This removes the browser-dependent behaviour rather than compensating for it. **Do not** reach for `-webkit-` prefixes, `flex-basis: auto`, or a `padding-bottom` percentage hack; those trade one browser quirk for another.

**Verify:** computed width, height and rendered mark size of every tile at **360, 390 and 430 px**, and no horizontal scroll. **State plainly that Chromium cannot confirm this fix**, because Chromium never reproduced the bug. The check that matters is Joe's phone.

## A2 — reorder the tiles

Joe's order, replacing the current one: **NFL · CFB · MLB · NBA · NHL · Racing · UFC · WWE**

This is `SPORTS` in `web/lib/config.js`. **Check every consumer before changing it** — prompt 25 found `queries.js` builds an enum filter from it and prompt 31 found `newestGridFor` does too. Grep, list what you find, and confirm the order change affects display order only and not any query, bucket or test that depends on position.

## A3 — the navbar links are not clickable

Joe: *"The navbar renders properly — but we need to enable linking on the TODAY WEEKS and HISTORY borderless buttons. They're visible in the upper right corner and you need to be able to click one."*

**Cowork could not diagnose this and is not guessing.** What is established: `NavBanner.js` renders `<PrimaryNav className="nb-nav" />`; `PrimaryNav` renders real Next `<Link>` elements from `PRIMARY_ROUTES`; and on a phone `.navbar:not(.mobile) .nb-nav { margin-left: auto }` right-aligns them, which matches where Joe sees them. So they are links, in the right place, and should work.

**Reproduce and measure before changing anything:**

1. At 390 px on `/weeks`, report each link's `getBoundingClientRect()` and whether `document.elementFromPoint()` at its centre returns the link or something else.
2. Check whether anything overlaps them — the `.navbar` shadow, `.nb-ctx`, the safe-area padding region, or `.shell`. Report computed `z-index` and stacking context for anything in the area.
3. **Simulate the safe-area inset at 47 px**, as prompt 31 stage 5's verification did, and repeat the hit test. Prompt 31 changed `.navbar` to `height: calc(50px + var(--nav-safe))` with the inset as top padding; if the links now sit outside the bar's box or under it, that is the cause, and it only appears where an inset exists — which is exactly Joe's phone and not Chromium's default.
4. Confirm the routes resolve — `PRIMARY_ROUTES` hrefs against the actual route files.

**Report the cause, then fix it.** If the hit test passes everywhere and you cannot reproduce, say so plainly and list what Joe should check on the device instead of shipping a speculative change.

## A4 — a game cannot be LIVE indefinitely

**Verified against the database:**

```
sport  result_status  games  earliest kickoff (UTC)  latest
mlb    in_progress    12     2026-09-01 22:40        2026-09-02 00:40
```

Add a display-layer guard: if `result_status = 'in_progress'` but the kickoff is more than a defensible number of hours in the past, the card must not claim LIVE.

**Pick the threshold from the data, not from a guess** — measure the longest real elapsed time between kickoff and `completed_at` across the loaded finals, per sport, and set the cut above the worst case with margin. **Report the measured distribution and the number you chose.** MLB extra innings and weather delays are the long tail; do not cut so tight that a genuine marathon reads as stale.

What it renders instead is a judgment call: the honest options are the scheduled time with no state, or a quiet `Final pending` — **pick one, render it, and say why.** It must not silently show a score that may be incomplete.

Put the predicate in `web/lib/format.js` beside the existing state helpers, as a pure function, and pin it with tests: fresh in-progress renders LIVE; stale in-progress does not; a final is untouched; a null kickoff does not crash.

**Then report the twelve rows and the finals you would write, and stop there** — that write is out of this run. **Also check the `schedule_refresh` run history around 2026-09-02 for the MLB "yesterday" step and report what you find.** If the cause is a failed or skipped run, name it; if it is a logic gap, name that. **Do not fix the pipeline here** — it gets its own prompt.

## A5 — TBS is missing

Joe: *"I believe we're missing TBS as a broadcaster that needs a logo. We have TNT but some baseball airs on TBS."*

**Confirmed:** `web/public/marks/` holds `tnt.png` and no TBS.

**Query the database first** — `game_broadcasts` and the networks table — and report whether any loaded game already carries TBS. That decides whether this is a live gap or a pre-emptive one, and it belongs in the report either way.

The mark goes through `scripts/build_web_marks.py` with the per-network recipe table and the frozen ink-area normalisation — **never a hand-edited PNG and never a hand-edited manifest.** If the source art is not in `assets/`, **report and move on**; sourcing art is Cowork's job, not this run's. That is a soft stop, not a hard one.

## Phase A gate

Full gate set. Commit each stage separately. Then continue to phase B.

---

# PHASE B — drop the `@` from the list card, and three items prompt 31 opened

**Nothing here touches the phone grid**, so it is independent of phase C.

## B1 — the `@` comes off ordinary games; `vs` stays for neutral sites

Joe: *"We know all matchups are away @ home. Under the circumstance, can we just eliminate the @ altogether?"*

**Almost.** Measured against the loaded season, the marker is not purely decorative: `MatchupCard.js` renders `vs` instead of `@` when `game.neutral_site` is true, and the season holds **20 neutral-site games — 9 NFL and 11 CFB** out of 1,379. Those are the international games and the Week 1 neutrals. Dropping the marker outright would render an NFL game in London as a home game.

**So the marker renders only when it carries information.**

- `neutral_site = false` → **nothing between the two team stacks.** The away-then-home order carries it.
- `neutral_site = true` → **`vs`**, exactly as today.

**This also settles the wrap prompt 31 declined to fix.** Prompt 31 measured `.mbody` at 152 px at 390 px and found that forcing one line truncated **122 of 124 names**, so it kept `flex-wrap: wrap` deliberately. Removing the `@` from 98.5% of cards frees roughly 28 px — the glyph plus its two gaps — taking each name's budget from about 31 px to about 41 px. **That is not enough to hold one line on the longest names, and it does not need to be.** What made the wrap look broken was a lone symbol stranded on its own row between the away team's sub-info and the home team. With no symbol, a wrap simply moves the home team's stack below the away team's — a clean two-row matchup, which reads as intentional rather than as a fault.

**So `flex-wrap: wrap` stays. Do not remove it.** Prompt 31's other three fixes — `flex: 0 1 auto`, `min-width: 0`, and the reference's ellipsis — stay exactly as shipped; they are what stops names overflowing when the row is tight. **Neutral-site games keep the `vs` inline**, so on those 20 cards the marker can still wrap to its own row. At 1.5% of the season that is the honest trade.

**Acceptance:** screenshots at **360, 390 and 430 px** of a short matchup that fits one line, a long matchup that wraps, and one of the 20 neutral-site games showing `vs` — **query the database for a real neutral-site game rather than constructing one.** Confirm the wrapped state reads as a two-row matchup with nothing orphaned; **this is the whole justification, so look at it and say whether it holds.** Report the per-name width budget before and after against prompt 31's 152 px. Zero overflow and zero silent truncation at all three widths. Report card heights against prompt 29's 68.3 / 91.3 / 186.3 px.

## B2 — the duplicate timezone line

`web/components/NavBanner.js:33` renders `<span className="muted">all times ET · Cleveland</span>`. Prompt 31's audit correctly left it alone because it is a timezone *statement*, not a clock suffix, and was outside that brief's enumeration.

It now duplicates the footnote. On desktop `/weeks` and `/history` the page says the times are Eastern twice; on mobile that span is `display: none`, so Today never had one, which is the gap the footnote filled.

**Delete the span.** The footnote covers the whole app in one place. **Keep the `· Cleveland` fact** — that is market information the footnote does not carry — by folding it into the footnote: *All times are Eastern · Cleveland market.* If that reads badly at 390 px, report it and leave the footnote as it was; do not invent a third location.

## B3 — the count line wraps at 360 px

Prompt 31: *"68 College Football broadcasts wraps to two lines at 360 px. No overflow."* Not a defect, but worth one measurement.

**Report the measured widths first.** Then, if the fix is genuinely one property — letting the count sit on its own line under the date rather than beside it at ≤ 380 px, say — apply it. **If it is more than that, report and change nothing.** Joe's phone is 390 px or wider, where it does not wrap.

## B4 — the time column's unspent width

Prompt 31 measured and deliberately did not spend: the widest time text went from `6:00 PM ET` at 77.3 px to `6:00 PM` at 55.9 px, so **22 px could come off the 78 px desktop column**, and on mobile the 54 px track still wraps by **1.9 px** where 56 px would unwrap it.

- **Mobile: take the 2 px.** 54 → 56 px unwraps the time and costs the matchup 2 px of its 152 px — under 1.5%.
- **Desktop: leave the 78 px column alone.** It is not crowding anything and narrowing it would be change for its own sake.

Report the rendered time at both widths after, and confirm the mobile time no longer wraps.

## B5 — reference and contract

**Rule 23.** `docs/design/mobile_demo.html` renders `<span class="atbig">@</span>` unconditionally inside `.duel.hug`. B1 changes that. **Update the reference in the same commit** so it renders the marker only for neutral sites, and check whether prompt 31's divergence note about `.duel.hug` is now stale — correct it if so.

`docs/rendering-contract.md` describes the card's matchup. **Read the relevant section and report whether B1 contradicts it.** If it does, bump the version and update the text in the same commit; if the contract is silent on the marker, say so and add one line recording the rule. Do not bump silently either way.

## Phase B gate

Full gate set. Commit. Then continue to phase C.

---

# PHASE C — the grid's team bands, the new ink rule, and the name run

## The finding

Joe: *"We still need to fix the cards in the mobile GRID view... BUT with white text and charcoal background. We designed the grid cards very very early in this build including the color scheme."*

He is right, and **`docs/rendering-contract.md` §3 has specified team bands since v1.0.** What ships instead: `MobileGrid.js`'s `Block` renders `.mcap` → `.mnames` → `.mcap`, and `.mnames` holds two `.mname` rows with a `.mhair` between and **no background at all**, so both names sit on `.mblock`'s charcoal in white type. The end caps *are* correctly tinted per §3's Endcaps rule, so **the colour data arrives fine — the bands were simply never built.**

**Why prompt 22 stage 4 missed it.** It was told the colour bands were broken and required to measure the colour at every hop. It reported the path intact and shipped a guard — correctly, for the question asked. **It verified that the colour reaches the component, not that the component paints a band with it.** The caps use the colour, so every measurement passed. Take that lesson into C1: **measure what is rendered, not what is available.**

## And §3's ink rule is being replaced — this is a contract change

§3 currently says: *top half = away primary colour, bottom half = home primary colour; ink per band by WCAG contrast (white vs `#101214`, whichever is higher); if neither reaches 4.0:1, darken the band ×0.82 repeatedly until white passes.*

**Joe's ruling, verbatim:**

> *"i forgot we have a charcoal background. Therefore whichever of the team colors is LIGHTER, make that the color for the band and then the darker of their colors is the text. If there is no secondary color or if the secondary color won't render cleanly, then swap out white or charcoal for the secondary color - whichever will render more cleanly and legibly"*

**Cowork measured this against the loaded season, and Joe's instinct is right by a wide margin.** Every block sits on the app's charcoal ground (`#101214`). Contrast of the band against that ground:

| band rule | bands under 3:1 vs the app ground | under 1.5:1 | average |
|---|---|---|---|
| §3 as written (primary always) | **254 of 357** | 107 | 2.71:1 |
| Joe's rule (lighter of the two) | **48 of 357** | 16 | **8.97:1** |

Under §3 as written, **71% of blocks would have been dark shapes on a dark ground**, and 107 of them essentially invisible as distinct blocks. §3 was written for the printed PC grid on white, not for a dark phone UI. **This is a real contract defect, not a preference.** Record it that way, and bump the version — see C7.

## C1 — measure what renders now

At 390 px on `/?sport=cfb&day=2026-09-05` and `/?sport=mlb&day=2026-09-03`, report:

1. Computed `background-color` of `.mnames` and each `.mname`. Expected: none, inherited from `.mblock`.
2. `.mblock`'s computed background, and the exact charcoal the block sits on. **Every contrast figure below assumes `#101214`; if the real ground differs, say so and recompute.**
3. For five real games across both slates: away and home `primary_color` and `secondary_color` reaching the component, and each cap's computed background.
4. Whether **any** element in the block paints a raw team colour today.
5. **The current name run**: computed `font-size` of `.mname`, and the rendered width of the longest `{rank} NAME (record)` against its block's available name span, for the ten widest names on the CFB slate.
6. **Lane counts and block widths for both slates** — the geometry baseline C6 must preserve exactly.

State the gap in one sentence before building.

## C2 — the bands, to Joe's rule

`.mnames` becomes two stacked bands, each carrying one team's name row. Keep the existing content: rank prefix, name, record run, and the `@` / `vs` that opens the home band. Keep `.mhair` between them and give it the contract's `#FFFFFF @ 70%`.

**The rule, exactly.** Given a team's `primary_color` and `secondary_color`:

1. **Both present and the pair reaches the name threshold** → the **lighter** colour paints the band at **full, unmodified strength**; the **darker** colour is the ink.
2. **Otherwise** — no secondary, malformed secondary, or the pair fails — **the lighter team colour still paints the band**, unmodified, and **the ink is replaced by a neutral**: `--ink` (`#f2f2f0`) or charcoal (`#101214`), whichever measures higher against that band.

**Note what rule 2 is and is not.** Joe's words were *"swap out white or charcoal for the secondary colour."* Read literally, that swaps the neutral into the pair and re-applies "lighter paints the band" — which makes **white the band** on 94 teams, because white is lighter than every team colour. Cowork measured both readings:

| fallback reading | bands that stay a real team colour | teams still failing at 3.0 |
|---|---|---|
| literal (neutral joins the pair) | 14 of 108 | 12 |
| **neutralise the ink only** | **108 of 108** | **0** |

**Cowork has taken the second reading. Flagged for Joe's veto** — a deviation from his literal wording, chosen because it serves his stated goal (team colour on the bands) better than his stated mechanism does.

**There is no band darkening any more.** §3's ×0.82 loop existed to rescue white ink on a too-dark band. Under Joe's rule the band is always the lighter colour and the ink adapts to it, so **bands render at exactly the brand colour, never modified.** Do not port the darkening loop to the phone. If you find yourself needing it, something else is wrong — stop and report.

**Threshold: 3.0:1 for the name run.** The names are Barlow Condensed 700 uppercase; at the sizes C5 produces they are large text, where 3.0:1 is WCAG AA. Setting it higher does not make anything more readable, it just replaces more team colours with neutrals: 3.0 keeps both team colours on **249** teams, 4.0 on 207, 4.5 on 190. **Cowork's call, flagged for veto.**

**As a tested pure function**, in `web/lib/gridmodel.js` beside `tint()` — which lives there precisely because a JSX file cannot be imported by `node --test`:

```
bandFor(primaryHex, secondaryHex) -> { band, ink, inkIsNeutral, ratio }
```

Real sRGB linearisation and `(L1 + 0.05) / (L2 + 0.05)` — **not a luminance shortcut, and not a `tint()`-style approximation.** The existing grey `[110, 116, 124]` fallback on a missing primary must keep working; `gridbands.test.mjs` already pins it — extend that file.

### Acceptance figures — check your implementation against these

Cowork measured these against the loaded season. **Reproduce them; a mismatch means one of us is wrong and needs reporting either way.**

- **357** teams play this season and carry a parseable `primary_color`. **17** (all CFB) have no `secondary_color`.
- Of the **340** with both, the band is the **secondary** colour on **259** and the primary on **81**. *That is 76% — see the warning in C3.*
- **249** of 340 pairs reach 3.0:1 and render two team colours.
- **108** fall back to a neutral ink (91 failing pairs + 17 with no secondary). **77 take `--ink`, 31 take charcoal.** All 108 clear 3.0:1; **93** clear 4.5:1.

Worked examples to pin as fixtures:

| team | primary | secondary | band | ink | ratio |
|---|---|---|---|---|---|
| Steelers | `#000000` | `#ffb612` | `#ffb612` gold | `#000000` | 11.95 |
| Michigan | `#00274c` | `#ffcb05` | `#ffcb05` maize | `#00274c` | 9.89 |
| Browns | `#472a08` | `#ff3c00` | `#ff3c00` orange | `#472a08` brown | 3.68 |
| Ohio State | `#ba0c2f` | `#a7b1b7` | `#a7b1b7` grey | `#ba0c2f` | 3.02 |
| Guardians | `#002b5c` | `#e31937` | `#e31937` red | **neutral** | pair 2.97 fails |
| Jaguars | `#007487` | `#d7a22a` | `#d7a22a` gold | **neutral** | pair 2.36 fails |
| Dolphins | `#008e97` | `#fc4c02` | `#fc4c02` orange | **neutral** | pair 1.16 fails |
| Ravens | `#29126f` | `#000000` | `#29126f` purple | **neutral** | pair 1.41 fails |

**Note the Browns line.** Joe described this card as *"orange background and brown text"* — his rule produces exactly that, where §3 as written would have produced the inverse. That is the check that the rule is implemented right way round.

**Tests:** a pair where the secondary is lighter; a pair where the primary is lighter; a pair at the 3.0 boundary; a failing pair taking `--ink`; a failing pair taking charcoal; a null secondary; a malformed secondary; and **every team colour pair in the loaded database returning ≥ 3.0:1 on the chosen ink** — that last one is the assertion that matters, and Cowork's measurement says it passes for all 357.

## C3 — the end caps now disagree with the band on 76% of blocks

The caps use `tint(away.color, 0.86)` → `0.58` — a tint of the **primary**. Under Joe's rule the band is the **secondary** on 259 of 340 teams. So a Steelers block would render **black caps around a gold band**, and a Michigan block navy caps around a maize band. The block would read as two unrelated colours.

**Cowork's call, flagged for veto: the caps take a tint of the band colour, not the primary**, so each half of the block is one colour family. This is a one-expression change and it is the difference between a block that looks designed and one that looks broken. **Include a screenshot of a Steelers or Michigan block; that is the case that decides it.**

## C4 — rank, the marker, and the record's swapped values

**Rank and the `@`/`vs` marker take the band's ink.** Today, on charcoal, they are fixed tokens:

```
.mname .mrank { color: var(--gold); }
.mname .mat   { color: var(--faint); }
```

**On a team-colour band both are wrong.** Gold on an arbitrary primary is unpredictable — invisible on a gold team, and under Joe's rule gold bands are now common (Steelers, Michigan, Iowa, Jaguars) — and clashing on red. `--faint` disappears entirely. §3 is silent on rank colour, which means it takes the band ink like the rest of the line. Gold stays what it is everywhere else in the app — the marquee treatment, the rivalry pill, the kickoff time.

**Note:** phase B removes the `@` from the **list card**. That is a different surface. **The grid's `@` is contract §3 (`home line: @ {rank} TEAM`) and stays.**

**A real bug: the record's two numbers are swapped.** Contract §3: *"a secondary run at **60% size and 82% ink opacity**"*. Shipped:

```
.mname .mrec { opacity: 0.6; font-size: 82%; }
```

**The values are inverted** — 82% size and 60% opacity, bigger and fainter than specified, exactly backwards for a secondary run. The code comment above it restates them swapped too, which is presumably how it survived review. Correct to `font-size: 60%; opacity: 0.82`.

**The record run's colour, and a rule that cannot be built as stated.** Joe: *"Always neutral, but when a neutral is chosen for the team name because of team color conflicts, then pick another neutral - not the same one, which is complimentary to the matchup card."*

The first half is straightforward: **the record run is always a neutral** — `--ink` or charcoal, whichever measures higher on that band — never a team colour.

**The second half does not survive measurement.** The app's neutral ramp is `--ink #f2f2f0`, `--dim #9aa0a8`, `--faint #868d96`, charcoal `#101214`. On the 108 cards where the name itself falls back to a neutral:

| name ink | teams | second neutral legible at 3.0:1 | at 4.5:1 |
|---|---|---|---|
| `--ink` (white) → try `--dim` | 77 | **25** | 17 |
| charcoal → try `--faint` | 31 | **2** | **0** |

**52 of the 77 white-name cards and 29 of the 31 charcoal-name cards have no second neutral that is legible on their band.** The reason is structural and already documented — prompt 25's comment on `--faint` in `globals.css` says it in as many words: on these grounds *"the third step dies."*

**Cowork's call, flagged because it overrides an explicit instruction from Joe: on fallback cards the record takes the same neutral as the name, and the differentiation comes from the contract's existing 60% size and 82% opacity.** A second hue would need a new token, which is a design decision, not something to invent inside this run.

**Verify the record still clears its own threshold** after the 82% opacity composite against the band. **If it does not, report the measurement; do not silently raise the opacity.**

## C5 — Joe's sizing rule

`nameSize` is currently `Math.max(8, 15 * 0.8)` — **a hardcoded 12 px that measures nothing.** There is no fit logic, so a long name plus rank plus record simply truncates. The contract's fit order exists and `scripts/render_day.py:845` implements it (`fs = max(18, fs*span/total)`); the phone grid never got it.

**Joe's ruling, verbatim:** *"I want the text as large as it can be without abbreviating or affecting geometry."* That is three constraints, in priority order:

1. **Geometry is frozen.** Block widths, lane counts, cap sizes, tray heights — identical before and after. A hard stop, not a goal; see C6.
2. **Nothing abbreviates.** The full `{rank} NAME (record)` renders. No ellipsis, no dropped record, as long as any size at or above the floor fits.
3. **Subject to those, as large as possible.**

So, per card: **find the largest font size at which the whole run fits the block's name span**, capped at the contract's 26 px × M1's 0.8 scale = **20.8 px**, floored at the contract's 14 px × 0.8 = **11.2 px**. Per card, not per day — that is what §3 and the PC renderer do. **Measure the text; do not estimate from character counts.** The component already has a canvas measurement context (`ctxRef`) used by M2 — reuse it rather than adding a second measuring path.

**Below the floor**, and only then, fall back to the contract's documented order: drop the record, then shrink the name alone, then ellipsis. **Report every card that reaches this fallback and why** — if it is more than a handful, the floor or the cap is wrong.

**Record format: the simple record only** — `(1-0)`, never the contract's conference form `(4-1, 2-0 BIG 12)`. M2's compression would push cards into the drop-the-record fallback constantly, showing *less* information. The archived desktop grid keeps the full form. **This is a mobile deviation and M13 currently says none exist** — record it in `docs/rendering-contract-mobile.md` as a new numbered rule and correct M13's *"no other mobile deviations exist"* sentence; it is now false. Also confirm the contract's **0-0 suppression** is implemented (`never (0-0)`); if not, add it.

## C6 — geometry is frozen, and this is the hard stop

Before and after, for both slates:

- **Lane counts per network row — must match exactly.**
- **Block widths — must match exactly.**
- Cap width, block height, tray height, row pitch — unchanged.
- `.mgrid-scroll` scrollWidth at zoom 1 — unchanged.

**Any difference is a hard stop.** Report the numbers side by side. If a larger name forces a wider block, the name is too large — reduce it, do not widen the block.

Also confirm prompt 30's zoom fix still holds: rail pinned at 0.6 / 1.0 / 2.5 after panning, painted width equal to laid-out width. **Joe verified that on his phone and it must not regress.**

Everything else stays: **M1** 80% scale · **M2** time compression · **M3** the hard cut and seam · **M4** the pinned rail · **M6** pinch-zoom · **M7/M8/M9** TBD cards, quick-nav, footer pills · **M14** the overlap rule and its shared fixtures.

## C7 — the PC renderer, the contract, and the reference

`scripts/render_day.py` draws the same bands to §3 as written — primary bands, white-or-charcoal ink, the darkening loop. **Joe's rule now diverges from it deliberately**, because the PC grid renders on a light ground where §3's logic is correct and the dark-ground problem does not exist.

**Find its band fill, its ink logic and its `fit_parts` sizing, and report what it does.** Then state plainly whether the divergence is (a) intentional and grounded in the different background, or (b) a bug on one side. **Cowork's position is (a)** — but Cowork has not read that code and you have, so say if that is wrong. **Do not rewrite the archival renderer in this run.** Where both sides implement a rule that genuinely should agree — the fit order, 0-0 suppression — pin them with a shared fixture the way `tests/fixtures/overlap_cases.json` pins the overlap rule.

**`docs/rendering-contract.md` needs a version bump.** This replaces §3's band-and-ink rule for the mobile surface. Write into §3, or a clearly-marked mobile subsection of it: the lighter-colour-paints-the-band rule and the neutralise-the-ink fallback; **the measured justification** (254 of 357 under 3:1 versus 48); that the ×0.82 loop does not apply on the dark ground, and why; and the 3.0:1 name threshold with its reasoning. A future reader must be able to see why this changed without re-deriving it.

**`docs/rendering-contract-mobile.md` also needs a bump**, for the record-format deviation and the corrected M13 sentence.

**Rule 23:** update `docs/design/mobile_demo.html` in the **same commit** as the code. Its `band(t, side)` renders `.mgband` with `background: ${t.c1}` and ink by a simple luminance threshold — both are now wrong. Prompt 29 found `--faint` stale in that file on the day rule 23 was written; check the token block again and report any other drift.

Add to `docs/handoff-status.md`: the phone grid now implements team bands and the name run, and did not before.

## Phase C gate

Full gate set. Commit.

---

# Final report

Per phase and stage: what changed, the sha, the evidence, every judgment call. Gates before and after each phase. Call out specifically:

**Phase A**
- Tile dimensions at 360 / 390 / 430, **and the plain statement that Chromium cannot confirm the iOS fix.**
- Every consumer of `SPORTS` found before reordering.
- The navbar hit-test results with the 47 px inset simulated — **and the cause, or an honest "could not reproduce."**
- The elapsed-time distribution behind the LIVE threshold, and the number chosen.
- The twelve rows and the finals you would write, **held for Joe.**
- What the `schedule_refresh` history shows around 2026-09-02.
- Whether TBS appears in any loaded broadcast row, and whether the art was in `assets/`.

**Phase B**
- The three screenshots, including a real neutral-site game.
- **Your own read on whether the wrapped two-row state looks intentional.** That judgment is the reason this design was chosen; if it looks wrong, Joe needs to hear it from you rather than discover it.
- Whether the contract needed a bump.

**Phase C**
- The C1 gap in one sentence, **and the real charcoal ground** if it is not `#101214`.
- **Whether your measurements reproduce Cowork's acceptance figures** — 357 / 17 / 259 / 81 / 249 / 108 / 77 / 31. Any mismatch is a finding.
- An eight-game table: band colour, ink chosen, team colour or neutral, measured contrast.
- **The four flagged calls, each with what you shipped and what it looks like:** the fallback reading, the 3.0 threshold, the caps following the band, the record's neutral on fallback cards.
- **A screenshot of a Steelers or Michigan block.**
- **The geometry comparison** — lane counts and block widths, before and after, both slates.
- The name-size distribution: largest, smallest, and every card that hit the floor or the fallback.
- Whether the record's 60/82 correction still clears its threshold on the worst band.
- What `render_day.py` actually does, and whether the divergence is intentional.

**Across the whole run**
- **Every hard stop that fired, what stopped, and what was left alone.**
- **Anything in this brief that turned out wrong.** Nine reports running have found bad citations in their own briefs; that has been the most useful part of each — and this brief carries a great deal of arithmetic that you are in a position to check.

---

# Explicitly out of scope

- **Backfilling the twelve MLB rows** — a database write. Report and hold.
- **Fixing the pipeline gap behind the stale finals** — reported here, fixed in its own prompt.
- **Rewriting `scripts/render_day.py`.** C7 reports; it does not change.
- **Adding a new neutral token to the ramp.** C4 explains why the second-neutral rule cannot be built with the tokens that exist; adding one is a design call, not this run's.
- **Removing `flex-wrap: wrap` from the list card** — prompt 31 measured that it truncates 122 of 124 names. It stays.
- **An abbreviation tier on team names** — considered, and not needed once the marker comes off.
- **Restacking the list card into two fixed rows**, and **the away/home/venue redesign** — Joe has specified the redesign; it is its own prompt once the app is stable.
- **The count line moving beside the band header** — same.
- **The desktop time column** — measured, deliberately unspent.
- **Widening any block to fit a larger name.** Geometry is frozen.
- Anything in `pipeline/`, `adapters/`, or the database.
