# Prompt 55 — LIST is a list, GRID is a grid, and four network marks

**Run after prompt 54.** `CLAUDE.md` is the standing brief and you have read it; this prompt names
rule numbers only where a stage collides with one.

## PRECONDITIONS

1. `HEAD == c18eea0 == origin/main` (prompt 54's docs commit).
2. Tree clean except the six untracked `assets/` directories. `assets/network-logos/` now holds four
   new source files staged by Cowork — `nfl-network.png`, `accnx.png`, `trutv.png`, `tbs.png`. They
   stay untracked.
3. Baseline gates from prompt 54's report: Python **466 + 1**, JS unit **377**, smoke **30/30**,
   qa-shots **14/14**.

---

## STAGE 1 — the grid comes out of LIST view

**Joe's ruling, 2026-09-06, verbatim: "I only want list cards on list view and only grids on grid
view."**

### What this supersedes, named rather than discovered

**05 §11's mobile page order put the grid INSIDE the Today list** — that is why `Listing` renders the
mobile grid under the bands and why `globals.css:2001` lifts it above them with `order: -1` at
≤699px. That ruling is dated **2026-09-03**. The LIST | GRID toggle did not exist until prompt 50 on
**2026-09-06**. So the grid-inside-the-list is a pre-toggle artefact: it was the only way to reach a
grid when there was nothing to ask for one with.

Prompt 54 then left the two modes disagreeing — day mode's LIST shows a grid, week mode's LIST does
not — and this ruling resolves it in the direction that makes the toggle mean one thing everywhere.

**05 §11 is superseded on this point and must be marked so**, along with register §18/§21 wherever
they restate the page order. Do not rewrite the original ruling's text — a superseded decision is
part of the record.

### What to build

`Listing.js` renders the grid on `showGrid = Boolean(grid && games.length)`. **The `grid` prop is now
true only in GRID view, in both modes.** Day mode passes `grid={P.isGrid}`; prompt 54 already made
week mode pass `grid={P.isGrid}` (its report records shipping exactly that after the brief's bare
`grid` turned the phone grid on in LIST).

**Retire the CSS ordering that exists only to interleave them.** `globals.css:1999-2002` lifts
`.mgrid-only` above the bands at ≤699px; with the grid never sharing a page with the bands, that rule
has nothing to order. Read it, confirm nothing else depends on it, and remove it — or say why it must
stay. `.listing`'s `display:flex` may still be needed for other reasons; check rather than assume.

### Acceptance, at 390 and 1440

- **DAY · LIST** — cards, zero grids. Report the page height delta; prompt 54 measured the day grid
  at 4,092px, so a day page should get shorter by roughly that.
- **DAY · GRID** — grid, zero cards. Unchanged from prompt 53.
- **WEEK · LIST** — cards, zero grids. Unchanged from prompt 54.
- **WEEK · GRID** — grids, zero cards. Unchanged from prompt 54.
- The **FirstBand** still renders in DAY · LIST and is still suppressed in GRID. It is a band of
  cards, not a grid, and this ruling does not touch it.
- Geometry: the day/week equality proof from prompt 54 stage 3 still passes.

**Commit:** `hub: the grid leaves LIST view — one meaning for the toggle in both modes`

---

## STAGE 2 — four network marks, and the treatment they need

Four sources are staged. **Cowork inspected all four and tested the treatment; the findings are
below, and they are measurements, not guesses — but verify them before relying on them.**

| slug | source | background | aspect | note |
|---|---|---|---|---|
| `nfl-network` | 728×312, PNG converted from Joe's JPEG | **transparency checkerboard, baked in** | 2.33 | NFL shield + navy NETWORK wordmark |
| `accnx` | 320×320, PNG (palette) | **transparency checkerboard, baked in** | 1.00 | blue ACCNX + grey swoosh + ESPN |
| `trutv` | 600×600, PNG (palette) | flat white | 1.00 | black "tru" + yellow-green circle |
| `tbs` | 600×600, PNG (greyscale) | flat white | 1.00 | black plate, white letters |

### THE CHECKERBOARD, AND WHY THE EXISTING KEYS DO NOT REACH IT

Two of these came from a PNG-aggregator site that **flattens transparency onto a checkerboard and
ships it as opaque pixels.** They look transparent in a thumbnail and are not: `nfl-network` measures
100% opaque with light-grey values around 188–254 in a regular alternation; `accnx` the same at
237/238/254.

`key_plate` (`build_web_marks.py:149`) samples an **edge median** and keys that — a two-tone
checkerboard defeats it, because the median sits between the two tones and matches neither.
`key_white` (`build_brand_marks.py:132`) floods inward from the border, which is the right shape, but
it lives in the other module and is tuned for a single flat white.

**Add a flood-fill neutral key to `build_web_marks.py`.** Cowork tested this exact predicate against
both files and it worked cleanly:

- a pixel is **background-eligible** when `|R−G| < 18` and `|G−B| < 18` and `mean(RGB) > 170`
- flood 4-connected from **all four edges**, keying only what is reachable
- everything not reached keeps alpha 255

**Flooding from the border is what makes this safe**: the NFL shield's interior white stars are not
connected to the edge, so they survive. A global colour test would have eaten them. That is the same
reason `key_white`'s docstring gives for flooding rather than testing globally, and the same reason
IndyCar floods.

Verified result: 78.1% of the NFL Network canvas keyed, 91.4% of ACCNX, and both composite cleanly on
`--spot-2 #1b1b1b` with the shield's whites and ACCNX's grey swoosh intact.

`trutv` and `tbs` have flat white backgrounds and want the ordinary white key, not this one.

### Three ink judgments to make by looking, not by rule

Each of these is a dark mark on a dark ground, and the NHL/ABC ruling says a dark body can be legal
when it reads by rim and light text. **Composite each on `#1b1b1b` and look before choosing:**

- **`tbs`** is a black plate carrying white letters. That is the ABC case almost exactly — ABC ships
  RAW because its black is background, not ink. If TBS reads the same way, ship it raw and say so.
- **`trutv`**'s "tru" is black and its circle is yellow-green. The black will vanish; the circle will
  not. Lifting only the dark ink is what `whiten_dark` / `whiten_below_gap` are for.
- **`nfl-network`**'s NETWORK wordmark is navy on charcoal — legible but not bright. Judge it against
  `nfl-today`, whose navy shield was accepted under the same ruling.

**Do not lighten a mark into a grey plate.** Prompt 53 found `floor_l` doing exactly that on the FOX
shields at endcap size; measure at the rendered size, not at full resolution.

### Provenance and the quality floor

Provenance is mandatory: "supplied by Joe, 2026-09-06" for all four. Quality floor: ≥256px long edge
— all four clear it (728, 320, 600, 600).

**ESPN3 was supplied and REJECTED, and this is on the record so nobody re-sources it blind.** Its file
carries a **"clearpng" watermark baked over the letterforms**. The flood key clears its checkerboard
but cannot reach the watermark — it is not connected to the border and where it crosses the red it is
not neutral. ESPN3 stays without a mark until clean art exists. That leaves **one** access-profile
network unmarked, down from five.

### THE NORMALIZATION HAZARD — the one that bites here

`build_web_marks.py:385` takes the **median of every processed mark** as the ink-area target. Adding
four marks moves that median, which moves every `hf`, which resizes all 28 existing marks and
invalidates prompt 52's rail work. And `build_brand_marks.py:239 target()` recovers its target from
this manifest, so the drift would propagate into the program marks too.

**Freeze the target.** Recover the current value the way `target()` does — invert `hf` for the marks
the 0.62/1.15 clamp did not bite, excluding `guardians-tv` (`HF_OVERRIDE = 1.25`), take the median —
and build against the pinned value.

**Then diff the manifest. Exactly four rows may be ADDED and zero may CHANGE.** If any existing `hf`
moved, discard the build, report it, and stop. Prompt 52 shipped a pin for this; use it rather than
writing a second.

Never `--only` for a published write — it truncates the manifest to the subset (prompt 52's finding).

### The rail fit

The rail's uniform target is 600px² in a 52px content box (`--rail-w: 60px`). Report where each new
mark lands: aspect 1.00 gives ~24.5px square; aspect 2.33 gives ~16.0 × 37.3px. All four should hit
600px² exactly, since the box only binds above aspect 4.51. **Confirm the suite's spread does not
widen** — prompt 52 left it at 1.16×.

### Wiring

`nfl-network`, `TBS`, `truTV` and `ACCNX` are **already in `data/access_profile.json` `available`**
and NFL Network is already in `data/row_order.json` under `nfl.cable`. Verify with these three, and
note that both files are **label-based, not slug-based**:

```
python -c "import json;a=json.load(open('data/access_profile.json'));print([n for n in ['NFL Network','TBS','truTV','ACCNX','ESPN3'] if n in a['available']])"
python -c "import json;print(json.load(open('data/row_order.json'))['nfl']['cable'])"
```

Report what they return. Add a row-order placement only where one is genuinely missing, and say which
sport and group you put it in and why.

**Commit:** `marks: NFL Network, TBS, truTV and ACCNX join the rail`

---

## STAGE 3 — working rule 31, if this run earns it

Rules stop at 30 — verify. The candidate, and it has now happened **three times in four days**:

- `bignoon` carried `"no mark in the tree"` while the mark sat in the tree (prompt 52).
- The prompt archive said `"not yet filed"` and was read as a permanent gap (prompt 52 stage 8).
- `nfl-network` was reported absent from `access_profile.json` and `row_order.json` **twice**, while
  both files carried it under the label `NFL Network` — they are label-keyed, and the search was
  slug-keyed.

Rule 30 covers the stale note. This third one is different in kind: the note was fine, the **query**
was wrong. Proposed:

> **A search that finds nothing is evidence about the query, not about the repo.** Before reporting
> something absent, check that you searched the representation the file actually uses — label versus
> slug, display name versus id, the enum versus the filter token. Name the search you ran in the
> report so the reader can see what was and was not asked.

Write it only if you agree it is distinct from 30; if you think it is 30 in a costume, say so and
extend 30 instead. Cite all three instances either way.

**Commit:** `docs: working rule 31 — a search that finds nothing`

---

## STAGE 4 — the record

**Register §23** (last is §22 — verify): LIST is a list and GRID is a grid, superseding 05 §11's page
order with the reason (the ruling predates the toggle by three days); the four marks with their
treatments and the checkerboard finding; ESPN3 rejected for a watermark, named so it is not
re-sourced blind.

**`docs/handoff-status.md`:** the stage/commit table, the gate counts, and the open item that ESPN3 is
now the only unmarked access-profile network.

**`docs/design/mobile_demo.html`** if the ordering change touches anything it implements (rule 23) —
it may, since the grid's position on the phone was part of the locked reference. Check.

**File this prompt** at `docs/prompts/55-list-grid-split-network-marks.md`, verbatim.

**Commit:** `docs: register §23 and the run of record`

---

## THE REPORT

1. Screenshots at 390 of all four states — DAY·LIST, DAY·GRID, WEEK·LIST, WEEK·GRID — and the day
   page's height delta.
2. The four new marks composited on charcoal, and the ink judgment you made for each with the reason.
3. The manifest diff proving four added and zero changed, plus the frozen target value.
4. What the three verification commands returned.
5. Every citation in this brief that was wrong.
6. HEAD, and whether `HEAD == origin/main`.
