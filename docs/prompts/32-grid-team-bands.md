# Claude Code — Prompt 32: the grid's team bands, the new ink rule, and the name run

**Repo:** `C:\Users\jlull\Joe's Projects\Apps - Personal\MySports` · **main**

**Preconditions, hard stop if any fail:**

- `HEAD == origin/main`, at whatever prompts 34 and 33 left.
- Python **200 OK (skipped=1)**, JS unit green, smoke **30/30**, qa-shots green.
- Tree clean apart from untracked `assets/`.

**Run after prompt 34.** Joe has confirmed prompt 30's zoom fix on his phone, so the grid is safe to touch — but 34 fixes a broken filter row and comes first.

**Working rule 22** — locate by content, report any citation that does not match. **Rule 23** — the locked reference changes in the same commit. Also rules 3, 4, 13, 16, 20.

**No database writes, no pipeline, no adapters.** Read-only queries are expected and encouraged.

---

## The finding

Joe: *"We still need to fix the cards in the mobile GRID view. They're currently rendering as logo of away team on the left, away team across top, logo of the home team on the right, home team across bottom, BUT with white text and charcoal background. We designed the grid cards very very early in this build including the color scheme."*

He is right, and **`docs/rendering-contract.md` §3 has specified team bands since v1.0.** What ships instead: `MobileGrid.js`'s `Block` renders `.mcap` → `.mnames` → `.mcap`, and `.mnames` holds two `.mname` rows with a `.mhair` between and **no background at all**, so both names sit on `.mblock`'s charcoal in white type. The end caps *are* correctly tinted per §3's Endcaps rule, so **the colour data arrives fine — the bands were simply never built.**

**Why prompt 22 stage 4 missed it.** It was told the colour bands were broken and required to measure the colour at every hop. It reported the path intact and shipped a guard — correctly, for the question asked. **It verified that the colour reaches the component, not that the component paints a band with it.** The caps use the colour, so every measurement passed. Take that lesson into stage 1: **measure what is rendered, not what is available.**

## But §3's ink rule is being replaced, and this is a contract change

§3 currently says: *top half = away primary colour, bottom half = home primary colour; ink per band by WCAG contrast (white vs `#101214`, whichever is higher); if neither reaches 4.0:1, darken the band ×0.82 repeatedly until white passes.*

**Joe's ruling, verbatim:**

> *"i forgot we have a charcoal background. Therefore whichever of the team colors is LIGHTER, make that the color for the band and then the darker of their colors is the text. If there is no secondary color or if the secondary color won't render cleanly, then swap out white or charcoal for the secondary color - whichever will render more cleanly and legibly"*

**Cowork measured this against the loaded season before writing it up, and Joe's instinct is right by a wide margin.** Every block sits on the app's charcoal ground (`#101214`). Contrast of the band against that ground:

| band rule | bands under 3:1 vs the app ground | under 1.5:1 | average |
|---|---|---|---|
| §3 as written (primary always) | **254 of 357** | 107 | 2.71:1 |
| Joe's rule (lighter of the two) | **48 of 357** | 16 | **8.97:1** |

Under §3 as written, **71% of blocks would have been dark shapes on a dark ground** — visible, but muddy, and 107 of them essentially invisible as distinct blocks. Joe's rule fixes a problem §3 never accounted for, because §3 was written for the printed PC grid on white, not for a dark phone UI. **This is a real contract defect, not a preference.** Record it that way.

**So §3 needs a version bump, not a silent repair.** The previous draft of this prompt said no bump was needed. That is now wrong — see stage 6.

---

## Stage 1 — measure what renders now

At 390 px on `/?sport=cfb&day=2026-09-05` and `/?sport=mlb&day=2026-09-03`, report:

1. Computed `background-color` of `.mnames` and each `.mname`. Expected: none, inherited from `.mblock`.
2. `.mblock`'s computed background, and the exact charcoal the block sits on. **Every contrast figure in this prompt assumes `#101214`; if the real ground differs, say so and recompute.**
3. For five real games across both slates: away and home `primary_color` and `secondary_color` reaching the component, and each cap's computed background.
4. Whether **any** element in the block paints a raw team colour today.
5. **The current name run**: computed `font-size` of `.mname`, and the rendered width of the longest `{rank} NAME (record)` against its block's available name span, for the ten widest names on the CFB slate.
6. **Lane counts and block widths for both slates** — the geometry baseline stage 4 must preserve exactly.

State the gap in one sentence before building.

---

## Stage 2 — the bands, to Joe's rule

`.mnames` becomes two stacked bands, each carrying one team's name row. Keep the existing content: rank prefix, name, record run, and the `@` / `vs` that opens the home band. Keep `.mhair` between them and give it the contract's `#FFFFFF @ 70%`.

### The rule, exactly

Given a team's `primary_color` and `secondary_color`:

1. **Both present and the pair reaches the name threshold** → the **lighter** colour paints the band at **full, unmodified strength**; the **darker** colour is the ink.
2. **Otherwise** — no secondary, malformed secondary, or the pair fails — **the lighter team colour still paints the band**, unmodified, and **the ink is replaced by a neutral**: `--ink` (`#f2f2f0`) or charcoal (`#101214`), whichever measures higher against that band.

**Note what rule 2 is and is not.** Joe's words were *"swap out white or charcoal for the secondary colour."* Read literally, that swaps the neutral into the pair and then re-applies "lighter paints the band" — which makes **white the band** on 94 teams, because white is lighter than every team colour. Cowork measured both readings:

| fallback reading | bands that stay a real team colour | teams still failing at 3.0 |
|---|---|---|
| literal (neutral joins the pair) | 14 of 108 | 12 |
| **neutralise the ink only** | **108 of 108** | **0** |

Neutralising the ink keeps every band a genuine team colour and **every one of the 108 fallback teams clears 3.0:1**, 93 of them clearing 4.5:1. The literal reading paints 94 near-white blocks into a dark grid and still leaves 12 teams failing. **Cowork has taken the second reading. Flagged for Joe's veto** — it is a deviation from his literal wording, chosen because it serves his stated goal (team colour on the bands) better than his stated mechanism does.

### What this removes

**There is no band darkening any more.** §3's ×0.82 loop existed to rescue white ink on a too-dark band. Under Joe's rule the band is always the lighter colour and the ink adapts to it, so **bands render at exactly the brand colour, never modified.** Do not port the darkening loop to the phone. If you find yourself needing it, something else is wrong — stop and report.

### Threshold

**3.0:1 for the name run.** The names are Barlow Condensed 700 uppercase; at the sizes stage 3c produces they are large text, where 3.0:1 is WCAG AA. Setting it higher does not make anything more readable, it just replaces more team colours with neutrals: 3.0 keeps both team colours on **249** teams, 4.0 on 207, 4.5 on 190. **Cowork's call, flagged for veto.**

### As a tested pure function

In `web/lib/gridmodel.js` beside `tint()`, which lives there precisely because a JSX file cannot be imported by `node --test`:

```
bandFor(primaryHex, secondaryHex) -> { band, ink, inkIsNeutral, ratio }
```

Real sRGB linearisation and `(L1 + 0.05) / (L2 + 0.05)` — **not a luminance shortcut, and not a `tint()`-style approximation.** The existing grey `[110, 116, 124]` fallback on a missing primary must keep working; `gridbands.test.mjs` already pins it — extend that file.

### Acceptance figures — check your implementation against these

Cowork measured these against the loaded season. **Reproduce them; a mismatch means one of us is wrong and it needs reporting either way.**

- **357** teams play this season and carry a parseable `primary_color`. **17** (all CFB) have no `secondary_color`.
- Of the **340** with both, the band is the **secondary** colour on **259** and the primary on **81**. *That is 76% — see the warning in stage 3a.*
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

---

## Stage 3 — the name run

### 3a. The end caps now disagree with the band on 76% of blocks

The caps use `tint(away.color, 0.86)` → `0.58` — a tint of the **primary**. Under Joe's rule the band is the **secondary** on 259 of 340 teams. So a Steelers block would render **black caps around a gold band**, and a Michigan block navy caps around a maize band. The block would read as two unrelated colours.

**Cowork's call, flagged for veto: the caps take a tint of the band colour, not the primary**, so each half of the block is one colour family. This is a one-expression change and it is the difference between a block that looks designed and one that looks broken.

If Joe vetoes it, the caps stay on the primary and the mismatch is his to judge on the device — **but say plainly in the report which way you shipped it and what it looks like.** Include a screenshot of a Steelers or Michigan block either way; that is the case that decides it.

### 3b. Rank and the `@`/`vs` marker take the band's ink

Today, on charcoal, these are fixed tokens:

```
.mname .mrank { color: var(--gold); }
.mname .mat   { color: var(--faint); }
```

**On a team-colour band, both are wrong.** Gold on an arbitrary primary is unpredictable — invisible on a gold team (and under Joe's rule gold bands are now common: Steelers, Michigan, Iowa, Jaguars), clashing on red. `--faint` disappears entirely. §3 is silent on rank colour, which means it takes the band ink like the rest of the line.

**Rank and the `@`/`vs` marker render in the band's chosen ink, same as the name.** Not gold. Gold stays what it is everywhere else in the app — the marquee treatment, the rivalry pill, the kickoff time — and it stops being a colour that lands on unpredictable grounds.

**Note for whoever reads this later:** prompt 33 removes the `@` from the **list card**. That is a different surface. The grid's `@` is contract §3 (`home line: @ {rank} TEAM`) and **stays**.

### 3c. A real bug: the record's two numbers are swapped

Contract §3: *"a secondary run at **60% size and 82% ink opacity**"*. Shipped:

```
.mname .mrec { opacity: 0.6; font-size: 82%; }
```

**The values are inverted.** It renders at 82% size and 60% opacity — bigger and fainter than specified, which is exactly backwards for a secondary run. The code comment above it restates them swapped too, which is presumably how it survived review. Correct to `font-size: 60%; opacity: 0.82`.

### 3d. The record run's colour, and a rule that cannot be built as stated

**Joe's ruling:** *"Always neutral, but when a neutral is chosen for the team name because of team color conflicts, then pick another neutral - not the same one, which is complimentary to the matchup card."*

The first half is straightforward: **the record run is always a neutral** — `--ink` or charcoal, whichever measures higher on that band — never a team colour. The team's identity lives in the name; the record is a secondary run.

**The second half does not survive measurement, and Joe needs to hear it.** The app's neutral ramp is `--ink #f2f2f0`, `--dim #9aa0a8`, `--faint #868d96`, charcoal `#101214`. On the 108 cards where the name itself falls back to a neutral:

| name ink | teams | second neutral available at 3.0:1 | at 4.5:1 |
|---|---|---|---|
| `--ink` (white) → try `--dim` | 77 | **25** | 17 |
| charcoal → try `--faint` | 31 | **2** | **0** |

**52 of the 77 white-name cards and 29 of the 31 charcoal-name cards have no second neutral that is legible on their band.** The reason is structural and already documented in `globals.css` — prompt 25's comment on `--faint` says it in as many words: on these grounds *"the third step dies."* When a band is dark enough that only white reads, a mid-grey does not read either. There is no room in the ramp.

**Cowork's call, flagged for veto: on fallback cards the record takes the same neutral as the name, and the differentiation comes from the contract's existing 60% size and 82% opacity.** Two runs at different size and opacity on the same baseline read as a hierarchy without a second hue; that is what the 60/82 pair is for. **This overrides an explicit instruction from Joe, which is why it is flagged rather than assumed** — if he wants a second hue, the ramp needs a new token and that is its own design decision, not something to invent inside this prompt.

**Verify the record still clears its own threshold** after the 82% opacity composite against the band. An 82% ink on a band that only just passes may not. **If it does not, report the measurement; do not silently raise the opacity.**

### 3e. Joe's sizing rule

`nameSize` is currently `Math.max(8, 15 * 0.8)` — **a hardcoded 12 px that measures nothing.** There is no fit logic, so a long name plus rank plus record simply truncates. The contract's fit order exists and `scripts/render_day.py:845` implements it (`fs = max(18, fs*span/total)`); the phone grid never got it.

**Joe's ruling, verbatim:** *"I want the text as large as it can be without abbreviating or affecting geometry."*

That is three constraints, in priority order:

1. **Geometry is frozen.** Block widths, lane counts, cap sizes, tray heights — identical before and after. This is a hard stop, not a goal; see stage 4.
2. **Nothing abbreviates.** The full `{rank} NAME (record)` renders. No ellipsis, no dropped record, as long as any size at or above the floor fits.
3. **Subject to those, as large as possible.**

So, per card: **find the largest font size at which the whole run fits the block's name span**, capped at the contract's 26 px × M1's 0.8 scale = **20.8 px**, floored at the contract's 14 px × 0.8 = **11.2 px**.

Per card, not per day — that is what §3 and the PC renderer do, and it gives each card its own maximum, which is what Joe asked for. **Measure the text; do not estimate from character counts.** The component already has a canvas measurement context (`ctxRef`) used by M2 — reuse it rather than adding a second measuring path.

**Below the floor**, and only then, fall back to the contract's documented order: drop the record, then shrink the name alone, then ellipsis. **Report every card that reaches this fallback and why** — if it is more than a handful, the floor or the cap is wrong and Joe should hear it.

### 3f. Record format on the phone

**Joe's ruling: the simple record only** — `(1-0)`, never the contract's conference form `(4-1, 2-0 BIG 12)`. The phone's blocks are compressed by M2 and the long form would push cards into the drop-the-record fallback constantly, so it would show *less* information, not more. The archived desktop grid keeps the full contract form.

**This is a mobile deviation and M13 currently says none exist.** Record it in `docs/rendering-contract-mobile.md` as a new numbered rule, and correct M13's *"no other mobile deviations exist"* sentence — it is now false and would mislead the next reader.

Also confirm the contract's **0-0 suppression** is implemented (`never (0-0)`); if it is not, add it — an unplayed team showing a record is noise.

---

## Stage 4 — geometry is frozen, and this is the hard stop

Joe's constraint is explicit. Before and after, for both slates:

- **Lane counts per network row — must match exactly.**
- **Block widths — must match exactly.**
- Cap width, block height, tray height, row pitch — unchanged.
- `.mgrid-scroll` scrollWidth at zoom 1 — unchanged.

**Any difference is a hard stop.** Report the numbers side by side. If a larger name forces a wider block, the name is too large — reduce it, do not widen the block.

Also confirm prompt 30's zoom fix still holds: rail pinned at 0.6 / 1.0 / 2.5 after panning, painted width equal to laid-out width. Joe verified that on his phone and it must not regress.

Everything else stays: **M1** 80% scale · **M2** time compression · **M3** the hard cut and seam · **M4** the pinned rail · **M6** pinch-zoom · **M7/M8/M9** TBD cards, quick-nav, footer pills · **M14** the overlap rule and its shared fixtures.

---

## Stage 5 — the PC renderer

`scripts/render_day.py` draws the same bands and the same name run, to §3 as written — primary bands, white-or-charcoal ink, the darkening loop. **Joe's rule now diverges from it deliberately**, because the PC grid renders on a light ground where §3's logic is correct and the dark-ground problem does not exist.

**Find its band fill, its ink logic and its `fit_parts` sizing, and report what it does.** Then state plainly whether the divergence is (a) intentional and grounded in the different background, or (b) a bug on one side. **Cowork's position is (a)** — but Cowork has not read that code and you have, so say if that is wrong.

**Do not rewrite the archival renderer in this prompt.** Report and stop. Where both sides implement a rule that genuinely should agree — the fit order, 0-0 suppression — pin them with a shared fixture the way `tests/fixtures/overlap_cases.json` pins the overlap rule.

---

## Stage 6 — contract, reference, report

**`docs/rendering-contract.md` needs a version bump.** This is not a repair of §3; it replaces §3's band-and-ink rule for the mobile surface and records why. Write into §3, or a clearly-marked mobile subsection of it:

- The lighter-colour-paints-the-band rule and the neutralise-the-ink fallback.
- **The measured justification** — 254 of 357 bands under 3:1 against the app ground under the old rule versus 48 under the new one. A future reader must be able to see why this changed without re-deriving it.
- That the ×0.82 darkening loop does not apply on the dark ground, and why.
- The 3.0:1 name threshold and the reasoning (large bold text, WCAG AA).

**`docs/rendering-contract-mobile.md` also needs a bump**, for the record-format deviation in 3f and the corrected M13 sentence.

**Rule 23:** update `docs/design/mobile_demo.html` in the **same commit** as the code. Its `band(t, side)` renders `.mgband` with `background: ${t.c1}` and ink by a simple luminance threshold — both are now wrong. Prompt 29 found `--faint` stale in that file on the day rule 23 was written; check the token block again and report any other drift.

Add to `docs/handoff-status.md`: the phone grid now implements team bands and the name run, and did not before.

**Report** per stage: what changed, the sha, the evidence, every judgment call, gates before and after. Call out:

- The stage 1 gap in one sentence, **and the real charcoal ground** if it is not `#101214`.
- **Whether your measurements reproduce Cowork's acceptance figures** — 357 / 17 / 259 / 81 / 249 / 108 / 77 / 31. Any mismatch is a finding.
- An eight-game table: band colour, ink chosen, whether the ink is a team colour or a neutral, and measured contrast.
- **The four flagged calls, each with what you shipped and what it looks like:** the fallback reading, the 3.0 threshold, the caps following the band, and the record's neutral on fallback cards.
- **A screenshot of a Steelers or Michigan block** — the caps-versus-band case.
- **The geometry comparison** — lane counts and block widths, before and after, both slates.
- The name-size distribution: largest, smallest, and every card that hit the floor or the fallback.
- Whether the record's 60/82 correction still clears its threshold on the worst band.
- What `render_day.py` actually does, and whether the divergence is intentional.
- **Anything in this brief that turned out wrong.** Nine reports running have found bad citations in their own briefs; that has been the most useful part of each — and this brief carries a great deal of arithmetic that you are in a position to check.

---

## Explicitly out of scope

- The list card's `@`, and the away/home/venue redesign — prompt 33 and a later prompt. **The grid's `@` stays; it is contract §3.**
- The chip row, the navbar, the stale LIVE games, TBS — prompt 34.
- **Rewriting `scripts/render_day.py`.** Stage 5 reports; it does not change.
- **Adding a new neutral token to the ramp.** Stage 3d explains why the second-neutral rule cannot be built with the tokens that exist; adding one is Joe's design call, not this prompt's.
- Widening any block to fit a larger name. Geometry is frozen.
- Anything in `pipeline/`, `adapters/`, or the database.
