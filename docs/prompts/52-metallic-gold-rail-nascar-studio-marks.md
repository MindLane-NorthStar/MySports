# Prompt 52 — the metallic gold, the network rail resized, NASCAR unfiltered, and the studio-show art

**Merged unattended run. Provisioned to run in full, overnight, without interruption.**

Nine stages. Each gates and commits on its own. Deterministic work runs first; the one stage that
depends on the public internet runs last, so a failure there cannot block anything else.

---

## PRECONDITIONS — checked ONCE, here, and never re-asserted by a later stage

Later stages must NOT re-check the sha: this run moves HEAD nine times by design.

1. `git --no-optional-locks rev-parse HEAD` == `e9fede3`, and `HEAD == origin/main`.
2. The working tree is clean except for these six untracked paths, which are expected and which
   stage 0 disposes of:
   `assets/brand/`, `assets/handoff/`, `assets/league-logos/`, `assets/logos/`,
   `assets/network-logos/`, `assets/program-logos/`, and
   `docs/ux-reference/visual-refinement-metallic-gold.png`,
   `docs/ux-reference/visual-refinement-handoff-2026-09-06.md`.
   Anything else untracked or modified: **report it and leave it alone.** Do not stash, do not clean.
3. Baseline gates, recorded before any edit so every later number has something to compare against:
   Python `465 + 1`, JS unit `353`, smoke `30`, qa-shots `14`.

---

## STANDING RULES FOR THIS RUN

The binding list is `docs/handoff-status.md` "Working rules (binding)" 1–29. These are the ones this
run will actually collide with, restated so you do not have to go look:

- **Rule 3 — secret gate every commit, ADDED lines only, with `grep`, never `findstr`.**
- **Rule 4 — stage by explicit path. Never `git add -A`.** This run adds binary art from the
  internet; a blanket add is how something unreviewed gets committed.
- **Rule 16 — colour tokens are READ from `web/app/globals.css`, never retyped from a mockup.**
  The one exception this run authorizes is the six NEW gold values in stage 3, which come from
  Joe's handoff document and are transcribed once, into the token block, with the source cited.
- **Rule 20 — never a bare repeated string replace.** Stage 3 exists because of this rule. Read it.
- **Rule 22 — before asserting what a component does, READ the component and cite file and line.**
  Never cite the contract that describes it. This prompt cites file:line throughout; verify each
  citation against the file before you act on it, and report any that has moved.
- **Rule 23 — when a change alters anything the locked reference implements,
  `docs/design/mobile_demo.html` changes in the SAME COMMIT.** Stages 3, 4 and 5 all trip this.
- **Rule 26 — the gate and the commit are SEPARATE COMMANDS.**
- **Rule 29 — a text write with no `newline=` produces different bytes on Windows than on the
  runner.** Stage 7 writes JSON. Use a parser and set the newline explicitly.

**Hard stops — and this run has exactly three.** Stop only for: a secret-gate hit on an added line;
a destructive database operation (this run performs NO database writes of any kind and needs none);
or a rejected push. Everything else is two-strikes-skip: attempt, attempt again differently, then
record what you tried, what happened, move to the next stage, and never roll back a green stage
because a later one failed.

**No database writes.** Not one. Every database interaction in this run is a `SELECT`-shaped
PostgREST anon read, and the only reason to make one is to answer a question the report asks.

---

## STAGE 0 — file the reference art, and clear the tree

`docs/ux-reference/visual-refinement-metallic-gold.png` and
`docs/ux-reference/visual-refinement-handoff-2026-09-06.md` are on disk, untracked. They are the
design of record for stages 3 and 4 and everything downstream cites them. Commit them by explicit
path.

The six untracked `assets/` directories are working art that predates this run. **Leave them
untracked.** Report their sizes and top-level contents so the record shows what was there, and do
not add them.

**Commit:** `docs: the metallic-gold refinement handoff and its rendering, filed`

---

## STAGE 1 — the NASCAR series sub-filter comes off

**Read first and cite file:line:** `web/components/Filters.js` (the `SeriesFilter` component and its
`.seriesrow` / `.serbtn` markup), `web/app/page.js` (where `SeriesFilter` renders inside the control
stack), `web/lib/queries.js` (wherever `series` narrows a query), `web/lib/hubparams.js` (the hub's
URL contract, where prompt 50 stage 1a added `series`), `web/lib/config.js` (any series roster),
`web/app/globals.css` (`.seriesrow`, `.serbtn`), and every test that pins the filter.

### What Joe ruled

> "Remove the Cup / O'Reilly / Truck buttons that render on some screens to sort NASCAR races.
> Simply allow all NASCAR races to appear when they should instead of having them filtered by
> series."

All NASCAR races render together — Cup, O'Reilly Auto Parts and Craftsman Truck — wherever races
render at all: under the Racing tile, and under ALL SPORTS.

### The contradiction this reverses, named rather than discovered

**This overturns enhancement-register §9 and §16.** §9 recorded Joe choosing individual sport chips
*with* a NASCAR series sub-filter, explicitly in preference to grouped chips. §16 then placed that
sub-filter as a **second row beneath the tiles**, specifically so the tile row's frozen geometry
would not have to move to accommodate it. Both were deliberate. Both are now superseded. The docs
stage records the reversal — do not leave §9 and §16 standing as if they still describe the app.

### What comes out

1. **The control.** `SeriesFilter` and its call site. Delete the component; do not leave it
   rendered-but-hidden.
2. **The filtering.** Wherever `series` narrows a query or a client-side list, remove it. Races are
   selected by sport alone.
3. **The parameter.** `series` leaves the hub's URL contract.
4. **The CSS.** `.seriesrow`, `.serbtn`, and any rule that positioned the second row.
5. **The tests.** A test pinning the series filter is **retired, not weakened** — delete the
   assertion and name which ones went. If a test covers the sport filter *through* the series
   filter, re-base it onto sport alone rather than deleting the coverage.

### What must NOT come out — and attempting it is a hard stop

**`programs.series` stays in the database. No migration, no DML, no schema change of any kind.**

Migration 0015 makes the race-session natural key `(sport, coalesce(series, ''), start_at, title)`.
The `coalesce` exists precisely because NASCAR carries a series and IndyCar does not, and prompt 48
measured that without it two loads of the same 18 IndyCar races produced 36 rows. **Dropping or
ignoring that column reopens a duplication bug that has already been fixed once.** The adapters keep
writing it, the loader keeps keying on it, nothing about the data layer changes. This is a
presentation change only — the same shape register §16 used when it made the Racing chip filter two
sports without a schema change.

### Acceptance

- A stale link carrying `?series=cup` **still renders, ignored rather than erroring.** Old bookmarks
  and anything Joe has shared must not 404 or 400. Report what such a URL actually does.
- Pick a day whose schedule carries races from **more than one series** and confirm all of them
  render, in both LIST and GRID, under the Racing tile and under ALL SPORTS. Report the day and the
  counts. If no loaded day carries two series, say so and use the nearest case — do not synthesize
  one.
- `select count(*) from programs where series is not null` is unchanged before and after. A read,
  proving the data layer was untouched.
- The tile row and its 6px internal gap are unchanged, and removing the second row shifts nothing
  above it.

**Commit:** `hub: NASCAR races render together — the series sub-filter is retired`

---

## STAGE 2 — row spacing · VERIFY ONLY, no code change expected

Joe's instruction was to standardize the spacing between rows, keep ALL SPORTS → league tiles as the
single exception, and apply the banner/toggle gap to tiles → picker and picker → content as well.

**Prompt 51 stage 2 already built exactly this**, and Joe's own parenthetical — *"they should be
already"* — was right about all five. In the stylesheet at `e9fede3`:

```
.hubctl { display: flex; flex-direction: column; gap: 8px; padding-bottom: 8px; }
.pickrow { margin: 0; }
```

One `gap` governs every space inside the control stack and the `padding-bottom` governs the space
below the picker, so the five gaps cannot drift apart. **ALL SPORTS → tiles stays 6px**, which is
`.sportbar`'s own internal gap and is what makes the bar and the tile row read as one control —
Joe's named exception, already honored.

**So this stage builds nothing.** Re-measure all six at 360, 390, 430 and 1440 and report them, so
the record shows the instruction was satisfied rather than skipped. **Measure after stage 1 landed**,
since removing the series row changes what sits where.

**If the stack still reads uneven, the cause is row heights, not gaps.** The rows are 31px (both
toggle rows), 24px (ALL SPORTS), 44px (league tiles) and 44px (the picker, whose height comes from
the `‹` `›` arrows' 44px minimum). The eye measures ink to ink, so uniform 8px gaps between boxes of
24, 31 and 44 can still read as an uneven rhythm. **That is a separate conversation about row
heights and it needs Joe's ruling before anything moves** — do not adjust gaps to compensate for a
height problem. Report the row heights alongside the gaps so he can judge.

**No commit.** The measurements go in the report and into the docs stage.

---

## STAGE 3 — the metallic gold, part 1: the tokens and every surface that reads them

**Design of record:** `docs/ux-reference/visual-refinement-handoff-2026-09-06.md`, filed in stage 0.
Read §4, §5, §8, §9, §13 and §19 before editing. The rendering at
`docs/ux-reference/visual-refinement-metallic-gold.png` is a **direction reference, not a
specification** — handoff §18 is explicit about that and it is the section this stage is most likely
to violate.

### The new family, transcribed once, from the handoff

```
--gold:      #C6AF7A    /* was #f0c850 — handoff §4 "primary metallic gold" */
--gold-dim:  #8C7650    /* was #8a7530 — handoff §4 "deep gold" */
--gold-hi:   #E0D1A5    /* new — handoff §4 "highlight gold" */
--gold-mid:  #B39A69    /* new — handoff §4 "mid gold" */
--gold-glow: rgba(198, 175, 122, 0.22)   /* new — handoff §4 "soft gold glow" */
--gold-line: rgba(198, 175, 122, 0.55)   /* new — handoff §4 "gold border / fine accent" */
```

Cite the handoff by section in the CSS comment beside the block. This is the rule-16 exception this
prompt authorizes, and it is authorized exactly once, here.

### Contrast is already measured — verify, do not re-derive from scratch

`#C6AF7A` against the app's real grounds: **9.02:1** on `--spot-3 #0e0e0e`, **8.05:1** on
`--spot-2 #1b1b1b`, **7.35:1** on `--spot-1 #232323`, **5.24:1** on `--spot-0 #3b3b3b`, **7.09:1**
on `--panel #23262b`, **5.69:1** on `--panel-top #31363d`, **7.55:1** on `--panel-bottom #1e2126`.
Dark text on the gold plate (`.seg button[data-active='true']`, `globals.css`, `color: var(--spot-3)`)
is **9.02:1**, down from `#f0c850`'s 12.03:1 and still comfortably above AA.

`--gold-dim` moves `#8a7530` → `#8C7650`, which is **4.43:1** on `--spot-3` versus the old 4.29:1 —
a marginal improvement, not a regression.

**Re-measure these yourself against the actual token values you read out of the file** (rule 13:
measure against the local background, not a corner sample) and report any that disagree with the
figures above. If any drops below **4.5:1 for text** or **3.0:1 for a non-text boundary**, do not
ship that site — report it and leave it on the old value.

### THE TRAP THIS STAGE EXISTS TO AVOID — read before you touch anything

**`data/brands.json` line 40 sets AEW's brand colour to `#F0C850` — byte-identical to the old
`--gold`.** It is not a use of the token. It is a brand constant, recorded in
`docs/design/program-card-design-v1.md` as "the non-red proof against the all-red cluster," and it
paints AEW's program card wash, seam and endcap bar. **A find-and-replace on that hex silently
repaints a brand.**

**AEW keeps `#F0C850`.** Add a one-line comment in `data/brands.json` beside it saying so and why,
edited through a JSON parser (rule 17), written with an explicit newline (rule 29).

More generally, and this is the whole point of rule 20: **change the TOKEN VALUES, not the call
sites.** `globals.css` has 25 `var(--gold)` and 3 `var(--gold-dim)` references; every one of them
migrates for free the moment the token changes, and none of them should be edited. Then hunt the
literals separately and judge each one on what it is:

| where | what it is | what happens to it |
|---|---|---|
| `web/app/globals.css` `:root` | the tokens | **changed** — this is the migration |
| `data/brands.json:40` | AEW's brand constant | **kept** at `#F0C850`, commented |
| `docs/design/mobile_demo.html:33, :74` | the locked reference | **changed**, same commit (rule 23) |
| `web/components/BannerMobileV2.jsx`, `BannerDesktopV2.jsx`, `web/lib/banner-*-v2.json` | the wordmark gradient | **stage 4** — do not touch here |
| `docs/rendering-contract.md`, `scripts/render_day.py` | the archived desktop renderer | **untouched** — see below |
| `docs/prompts/*`, `docs/feature-study/*`, `docs/enhancement-register.md`, `docs/hub/*` | historical record | **untouched** — never edit a filed prompt or a past measurement to look right in hindsight |
| `docs/design/banner/banner-and-navbar.css` | archival; referenced only by other docs | report, do not change |

**The gold migration is WEB APP ONLY.** `scripts/render_day.py` and `docs/rendering-contract.md` use
`#F0C850` for the archived desktop renderer's marquee plate, rivalry pill and mock subtitle. That is
a separate colour system with its own contract, tuned for a light printed ground. Re-tuning it is its
own job and is not in this run. Say so in the report.

### Where the gold now goes, and where it must not

Handoff §5 sets the hierarchy: **white/near-white = primary sports information; gray = secondary
metadata; metallic gold = selection, action and emphasis; red = LIVE; network and team branding
colours stay authentic.** Audit the 25 `var(--gold)` sites against that. Any site where gold is
carrying *information* rather than *selection or emphasis* — report it with file:line and your
reading; **do not change it in this run.** Joe decides those individually.

Two sites are already settled and must not move:

- **The gold kickoff time stays gold.** Joe ruled on it directly.
- **`.mname .mrank` and `.mname .mat` take the BAND'S ink, not a token** (`globals.css`, the C4
  comment). That rule exists because gold is invisible on a gold team band. It is unaffected by the
  new value and must stay unaffected.

### Surface depth — handoff §8 and §9, applied conservatively

**Borders (§9):** the normal card edge moves toward `rgba(255,255,255,0.07)` where it is currently
harsher, and the selected/gold-emphasized edge uses `--gold-line`. Audit first; change only edges
that are demonstrably heavier than that.

**Surfaces (§8):** the intended ladder is page darkest → control surface → card surface → elevated.
`--line-grid #4a505a` exists specifically because prompt 34 needed the grid's network rule firmer
without dragging every card border in the app up with it — respect that separation.

**THE CARD GRADIENT STAYS `#31363d → #1e2126`.** The rendering flattens the card surface to
`#2A2A2A`. Prompt 25 measured `--dim` and `--faint` against **both ends** of that gradient to land
the current three-step contrast ramp, and the `--dim` comment in `globals.css` records exactly how
little headroom is left ("the third step dies"). Flattening the gradient invalidates those
measurements. **Cowork's call, flagged for Joe's veto in the report.**

### LIVE stays GREEN — Cowork's call, made because Joe did not rule and the run cannot wait

Handoff §11 asks for a red LIVE dot and label under the rule *red = event state, gold = user action*.
**This app does not work that way and should not be changed to.** `--live` is `#7fd1a3`, a green.
`--alert` is `#e8918d`, a soft red, and it already means **unavailable / out of market** on the
broadcast-access line (`globals.css`, the `.dbcast .dacc[data-a=...]` rules) and marks errors.
Making LIVE red would collide with the colour that currently means *you cannot watch this* — the
opposite meaning.

**So: `--live` and `--alert` are untouched.** §11's actual intent — that LIVE must not be gold, and
that gold must mean action rather than state — is satisfied as built. Record it that way in the
register and put it in the report as a call Joe can overrule. If he wants red, it is a `--live` /
`--alert` recolour done together, and that is a separate prompt.

### Micro-interactions — handoff §16, with the omission it has

§16 authorizes restrained motion at 120–220ms: segmented-control slide, subtle press, hover brighten
on desktop, smooth selected-state transition. Apply those.

**§16 omits `prefers-reduced-motion` and that is not optional.** Every transition and animation this
stage adds sits inside `@media (prefers-reduced-motion: no-preference)`, or is disabled by a
`@media (prefers-reduced-motion: reduce)` block. A user who has asked their operating system to stop
animating things is not asking for a restrained version.

### Acceptance

- No literal `#f0c850` or `#8a7530` survives anywhere under `web/`, in any case. Report the grep.
- `#F0C850` survives in exactly the places the table above says it should.
- Every gate is at or above baseline: Python 465+1, JS unit 353, smoke 30, qa-shots 14.
- Screenshot the hub at 390 in both LIST and GRID and describe what changed, in words, against the
  rendering — not "matches" but which specific elements moved to metallic and which did not.

**Commit:** `design: the metallic gold family replaces the yellow, tokens and every surface that reads them`

---

## STAGE 4 — the metallic gold, part 2: the wordmark and the segmented controls

### THE FINDING THIS STAGE EXISTS FOR

**The banner wordmark is not on the token.** `web/components/BannerMobileV2.jsx:34` and
`BannerDesktopV2.jsx:12` paint "MYSPORTS TV" with a four-stop SVG gradient —
`#FBE59A → #F2CD62 → #E4B646 → #D2A038` — and the same stops live in
`web/lib/banner-mobile-v2.json` and `banner-desktop-v2.json`, which also carry `#F3CC5A`.

**A token change does not reach any of it.** Left alone, the app migrates to cool metallic gold
everywhere *except the largest, most prominent gold on every screen*, which stays warm yellow. That
is worse than not migrating at all, and handoff §4 names SVG fills explicitly in its audit list.

**The mapping**, using the handoff's own family so nothing is invented:

```
#FBE59A  ->  #E0D1A5   (highlight)
#F2CD62  ->  #C6AF7A   (primary)
#E4B646  ->  #B39A69   (mid)
#D2A038  ->  #8C7650   (deep)
#F3CC5A  ->  #C6AF7A   (primary — read the file first and confirm what it paints)
```

Read `banner-mobile-v2.json` and `banner-desktop-v2.json` and find **every** gold-family value in
them, not only the five above; the JSON is the source of record for the components, so the two must
agree afterward or the next banner rebuild reverts the change. Edit the JSON through a parser
(rule 17) with an explicit newline (rule 29).

Any glow or `text-shadow` built on `rgba(240, 200, 80, ...)` moves to `--gold-glow`'s
`rgba(198, 175, 122, ...)` at the same alpha.

**This is the app's signature element and this stage recolours it. Flag it prominently in the report
for Joe's veto**, with a before/after screenshot of the banner at 390 and at 1440. If he wants the
wordmark to stay warm, reverting is one commit.

**Do NOT change the banner's geometry.** Not the artboard, not the type size, not the letter-spacing,
not the safe-area absorption prompt 51 tuned to 6px, not the vertical position. Colour only.
`docs/design/mobile_demo.html` changes in the same commit if it carries any of these values
(rule 23).

### Segmented controls — handoff §6

DAY | WEEK, ALL GAMES | MY TEAMS, LIST VIEW | TV GRID. §6's preferred treatment: a dark recessed
track, the selected state in metallic gold, a slightly darker unselected state, dark text on the
selected plate, a subtle top highlight, and a **restrained** gradient rather than a flat fill:

```
#D8C595 -> #C6AF7A -> #B39A69
```

§6 says "this should be subtle" and "do not make the controls glossy or flashy." Take it literally.

**§6 also says: preserve current dimensions and spacing unless there is a clear usability problem.
There is not one.** The toggle rows are 31px and the gaps are 8px, both set deliberately by prompt 51
against Joe's explicit instruction. **Nothing in this stage changes a single dimension.** If a
gradient or an inset shadow would change a computed height by even a pixel, use `background-image`
and `box-shadow: inset`, which do not affect layout, and prove it by measuring the row heights before
and after.

Dark text on the *lightest* stop `#D8C595` is the contrast case to check, not the primary — measure
it against `--spot-3` and report it.

**Sport tiles — handoff §14:** the selected tile gets a thin `--gold-line` ring and a gold label;
unselected stays neutral. §14 forbids oversized selected tiles and large gold blocks, and register
§14 already recorded *why* the active chip is inverted — a charcoal plate with a gold border, not a
gold fill, because prompt 25 measured five of ten league marks failing on a gold plate. **That
finding still holds against the new gold and the inversion stays.** Do not re-introduce a gold fill.

### Acceptance

- Row heights, tile sizes and every gap in the control stack are byte-identical to stage 2's
  measurements. Report both sets.
- The banner's rendered artwork occupies the same box as before at 360, 390, 430 and 1440, and
  still shows **0.0px overlap** with the safe-area inset at 47 and 59 — the measurement prompt 51
  established. Re-run it.
- Gates at or above baseline.

**Commit:** `design: the wordmark and the segmented controls join the metallic family`

---

## STAGE 5 — the network rail: standardized marks, and 9px back to the schedule

**Read first and cite file:line:** `web/lib/marks.js` (all of it — it is 45 lines),
`web/components/MobileGrid.js:378-395` (the rail cell) and `:315-335` (the sport-band mark, a
DIFFERENT surface), `web/app/globals.css:1035-1085` (`.mrail-cell`, `.mrail-mark`, `.mrail-mark img`,
`--rail-w`), `scripts/build_web_marks.py:256-300` and `:356-400` (`trim`, `ink_area`, `resize_h`,
`build`), and `web/public/marks/manifest.json`.

### THE DIAGNOSIS — measured, and not what the symptom looks like

Joe reported: *"NBC renders much smaller than FOX."*

**NBC is at the rail's maximum height.** 30px, tied for the tallest thing in the column. FOX is 23px.
NBC reads smaller because it is a square roundel drawn at 30 × 30 while FOX is a wordmark drawn at
54.3 × 23 — the eye weighs ink AREA, not height. FOX carries **37% more ink and is 78% wider**.

**The actual defect is mechanical.** `web/lib/marks.js:44` sizes every mark as
`round(stackHeight * 2/3 * hf)`, where `hf` is the frozen ink-area normalization factor from the
manifest. That IS the equal-visual-weight rule. But `globals.css:1078-1082` then clamps every mark
with `max-width: 100%` inside a content box of **61px** (rail 69 − 2px border-right − 6px horizontal
padding), and **eleven of the twenty-eight marks are wider than that box at their computed height**.
For those eleven the clamp overrides `hf` completely and the height collapses to whatever the aspect
allows. `hf` never gets to do its job for the marks that need it most.

Measured today, drawn height × drawn width → ink box:

```
hbo-max          9.7 x 61.0 =  590      <- smallest
espn2           11.7 x 61.0 =  711
espn-plus       13.7 x 61.0 =  836
paramount-plus  14.0 x 61.0 =  857
nbc             30.0 x 30.5 =  914
fox             23.0 x 54.3 = 1248
disney-plus     30.0 x 54.8 = 1645
fs1             27.6 x 61.0 = 1683
apple-tv        30.0 x 59.1 = 1772      <- largest
```

**Spread 3.00×.** That is what Joe is looking at.

### THE TRADE, AND WHY JOE'S TWO ASKS COULD NOT BOTH BE MET

Uniform-at-NBC's-current-size (900px²) requires a content box of `sqrt(900 x 6.30) = 75px` — a rail
of **83px, fourteen pixels WIDER than today**, because the widest wordmark sets the ceiling for
everyone. Narrowing the rail forces the uniform size down. Joe was shown the measured trade table and
**ruled: rail 60px, uniform ink target 600px²** (a 24.5px square equivalent). Twenty-six of
twenty-eight marks land on exactly that; spread falls from 3.00× to **1.40×**; the visible schedule
at a 390px viewport goes from 321px to 330px, **+2.8%**.

### What to build

**1. The manifest carries geometry — added WITHOUT re-running the build.**
`web/public/marks/manifest.json` is `[{slug, hf}]`. It needs `[{slug, hf, w, h}]`, the published
pixel dimensions of each PNG.

**Do NOT re-run `scripts/build_web_marks.py` to get them, and read this before you decide otherwise.**
Its sources live in `assets/network-logos/`, which is **untracked and never committed** (`SRC_DIR`,
line 45). A rebuild against a folder missing even one source silently drops that mark, and
`build()` line 385 computes `target = statistics.median(areas.values())` **over whatever it
processed** — so one missing file moves the median and rewrites every `hf` in the suite. That would
resize all 28 marks and invalidate this stage's own table.

**And `--only` is worse.** `build()` filters `todo` by `--only`, builds `areas` from that subset, and
then writes `manifest.json` containing **only those slugs**. `build_web_marks.py --only espn2` does
not update one entry — it replaces the manifest with a one-line file and takes the median of a single
mark. Never use `--only` for a published write. Report this as a footgun; it is a strong candidate
for working rule 30.

So: read the 28 published PNGs in `web/public/marks/`, take each one's real pixel width and height,
and write `w` and `h` into the existing manifest through a parser (rule 17, explicit newline per
rule 29). **Every `hf` stays byte-identical** — diff the file and show that `hf` is the only field
untouched and no slug was added or dropped. Every published PNG is `PUBLISH_H = 128` tall (line 50),
so if any `h` comes back as something other than 128, stop and report it: that means the published
suite is not what the script says it is.

Then teach `build_web_marks.py` to emit `w` and `h` too, so a future rebuild agrees rather than
stripping them. `build_web_marks.py` has **no `--check` mode** (only `build_brand_marks.py` does), so
prove agreement by building to a **temporary directory** and diffing its manifest against the
published one. If they disagree on any `hf`, report the diff and leave the published manifest alone —
that is a real finding about drift between the sources and the published art, and it is not this
stage's job to resolve it.

**2. A new fit function, for the rail only.** Add to `web/lib/marks.js`:

```
RAIL_TARGET_AREA = 600      // px^2 of drawn ink box — Joe's ruling 2026-09-06
RAIL_BOX_W       = 52       // --rail-w 60 - 2px border-right - 6px horizontal padding
RAIL_MAX_H       = 30       // .mrail-mark's height; does not bind at this target

railMark(slug):
  a = w / h                                   // from the manifest
  H = min( sqrt(RAIL_TARGET_AREA / a),         // uniform ink area — the rule
           RAIL_BOX_W / a,                     // never wider than the box
           RAIL_MAX_H )
  return { src, height: H, width: H * a }
```

Derive `RAIL_BOX_W` from the CSS rather than hardcoding 52 if you can do it without a runtime read;
if you cannot, define it beside `--rail-w` with a comment naming the three terms, so the next person
who changes the rail width finds it.

**`markStyle()` is NOT changed.** Its other two callers — `MobileGrid.js:320` (the sport band) and
`GameDetail.js:134` — are different surfaces at different sizes, and Joe scoped this ruling to *"the
GRID views ONLY."* Leave both alone and say so in the report.

**3. `--rail-w: 69px` → `60px`** in `globals.css:99`.

**4. The CSS clamps stay** — `max-width: 100%` and `max-height: 100%` on `.mrail-mark img` remain as
a backstop. **But they must no longer bind.** Verify for every mark that the computed width is ≤
`RAIL_BOX_W`; if any exceeds it, the fit function is wrong, not the CSS.

### THE TRIPWIRE BREAKS ON PURPOSE — re-baseline, do not hard-stop

`MobileGrid.js:340` sets the canvas width to `calc(var(--rail-w) + {scale.width}px)`, so narrowing
the rail by 9px moves scrollWidth by 9px and **deliberately invalidates the frozen geometry
tripwire**: CFB `2026-09-05` = 64 blocks / {240, 223, 205, 136} / scrollWidth **1282**; MLB
`2026-09-03` = 3 / {228} / **577**.

**Block counts and block widths must NOT change** — those are the parts that would signal a real
regression. Only scrollWidth moves, by exactly 9px, to **1273** and **568**. Assert that. If block
counts or widths move by even one pixel, **that is a hard stop** and you have broken something this
stage had no business touching.

Record the new baselines wherever the old ones live, and amend **Mobile Grid Addendum M4**, which
specifies a 69pt rail. Bump the addendum version and say what changed and why — same treatment
prompt 30 gave M4 when it found the addendum prescribing a broken mechanism.

### ESPN2 and HBO Max are the two exceptions, and stage 7 closes them

At 60/600 the only two marks that cannot reach the target are **ESPN2** (aspect 5.23, lands at 9.9px
tall, from 11.7 today) and **HBO Max** (aspect 6.30, lands at 8.2px, from 9.7). Both are already the
two smallest marks in the column, so nothing new becomes the worst offender, but 8.2px is marginal
and Joe knows it. He ruled that stage 7 sources compact lockups for both. **When that art lands, the
fit recomputes from the manifest with no code change** — which is the point of making it data-driven.
If stage 7 fails to find compact art, this stage's result stands on its own and is still a 2× gain.

### Acceptance

- Report the full 28-row table: slug, aspect, drawn height, drawn width, ink area, and the delta
  against today's figures above.
- Twenty-six marks at 600 ± 1 px². Name the two that are not and their values.
- Ink-area spread ≤ 1.45×, from 3.00×.
- Every mark's drawn width ≤ 52px.
- scrollWidth 1273 (CFB 2026-09-05) and 568 (MLB 2026-09-03); block counts and widths unchanged.
- `docs/design/mobile_demo.html` updated in the same commit if it carries the rail width (rule 23).
- Gates at or above baseline.

**Commit:** `grid: one ink weight for every network mark, and 9px of rail back to the schedule`

---

## STAGE 6 — the two studio marks that were built and never wired up

### THE FINDING

`web/public/programs/` holds `big-noon-kickoff.png` and `college-gameday.png` with a `manifest.json`
carrying real ink-area factors and recipe notes. **Nothing under `web/` references that folder** —
verify with `git grep` and report the result. `data/brands.json` carries `mark: null, mark_dark: null`
for both `bignoon` and `gameday`, so `ProgramCard.js:73` falls through to the typographic
`short_title`.

The art exists. It was built correctly, through the pipeline, with the right normalization. It was
never connected. **Two of the four shows Joe named as "missing logos" are a wiring bug, not a
sourcing problem**, and this stage is the cheapest win in the run.

### What to build

Point `bignoon` and `gameday` at their published marks in `data/brands.json`, matching whatever path
convention `brandFor()` and `ProgramCard.js:73-77` already expect (`mark_dark` is what the endcap
reads — read those lines and follow them). Edit through a parser; explicit newline.

Note that these marks are processed for a **dark context** already; check whether the existing
`mark` / `mark_dark` split has meaning for program brands the way it does for league marks, and if
`ProgramCard` only ever reads `mark_dark`, say so rather than populating a field nothing reads.

**`gameday` keeps `#F96302`** (Home Depot orange, Joe's explicit ruling, recorded in
`docs/design/program-card-design-v1.md`). Wiring the mark does not re-derive the colour.

**`bignoon` is `provisional: true` with the note "no mark in the tree; FOX's cached wordmark is
monochrome, so no colour to derive."** That note is now false — there IS a mark in the tree. Once the
mark is wired, either derive a brand colour from it the way `indycar` was derived and clear the
provisional flag, or leave the neutral and correct the note to say why. Either is fine; silently
leaving a false note is not.

### Acceptance

- Both cards render their art instead of their short title. Screenshot each in LIST and in GRID.
- The typographic fallback still works for a brand with no art — pick one of the nine and prove it.
- Gates at or above baseline.

**Commit:** `programs: Big Noon and GameDay render the marks that were already built for them`

---

## STAGE 7 — source the missing studio-show art

**This is the only stage that depends on the public internet, and it runs last on purpose.**
Everything above is already committed. If this stage fails entirely, the run is still a success and
Joe loses nothing but the logos.

### The nine brands with no art

`foxnflsunday`, `foxnflkickoff`, `nfltoday`, `fnia`, `mnfcountdown`, `nflcountdown`, `tnfpregame`,
`netflixpregame`, and the NASCAR pre/post shows (`nascarprerace`, `nascarpostrace`, `nascarraceday`
currently borrow the NASCAR league mark, which is a reasonable fallback — treat replacing it as
optional and report whether a show-specific mark is even better than the league mark).

**Joe ruled: all nine, regardless of whether the show currently has loaded instances.** Report which
of them have zero rows in `programs` so the record shows what was speculative.

### Plus the two compact network lockups stage 5 needs

**ESPN2** and **HBO Max**: source a compact or stacked lockup with an aspect ratio **at or below
4.3:1**, so the fit function can bring them to the 600px² target. At 4.3:1 or narrower the
`RAIL_BOX_W / a` term stops binding and all 28 marks land on identical weight — spread 1.00×. Report
the aspect you achieved. If you cannot find compact art at or under 4.3:1, keep the current mark;
stage 5's result stands.

### Sourcing rules

**Joe ruled that art may be taken from wherever it is available**, overruling a
press-rooms-only constraint. So the gates below are about the FILE, not the source:

1. **Provenance is mandatory.** Every mark records source URL and fetch date, in the recipe table
   comment in `scripts/build_web_marks.py` or in the manifest — wherever the existing marks record
   theirs. A mark with no recorded source does not ship.
2. **Quality floor.** At least 256px on the long edge; transparent background, or a flat background
   that `key_plate()` removes cleanly; no watermark, no comp/preview overlay, no visible JPEG ringing
   around the ink. **A mark that fails any of these does not ship** — the typographic fallback is
   better than bad art, and `ProgramCard.js:76` already renders it well.
3. **Right mark, current era.** These shows rebrand. Prefer the lockup currently in use. If you can
   only find a retired logo, ship it and say so in the report so Joe can judge.
4. **Everything goes through `scripts/build_web_marks.py`.** Add each to the `RECIPES` table with the
   source kind and its treatment, run the build, let the pipeline write the PNG and the manifest.
   **Never a hand-edited PNG. Never a hand-edited manifest.** This is the standing rule from prompts
   25, 34 and 38 and it is the one thing about art sourcing that has never moved.
5. **Two strikes, then skip.** Two failed attempts at one mark and you move on. Nine logos is not
   worth stalling the run.

### The standing instruction this reverses, named rather than discovered

Prompts 25, 34 and 38 all carry: *"If the source art is not in `assets/`, stop and report — sourcing
art is Cowork's job, not this prompt's."* **Joe has lifted that for this run**, deliberately, so that
the logos can land unattended. It is lifted **for this stage only**; it is not a general change and
the next prompt inherits the old rule unless it says otherwise. Record that in the register.

### The normalization hazard — which runs in the direction you would not guess

**The nine studio-show marks are safe.** They are built by `scripts/build_brand_marks.py`, not
`build_web_marks.py`, and its `target()` (line 239) **recovers the ink-area target from the frozen
network manifest** rather than recomputing it from the programs themselves. Its own docstring says so.
Adding program marks therefore cannot move a network `hf`. Verify that by reading `target()` and
`build_programs()` before you rely on it, then say in the report that you did.

**The two network compacts are the dangerous half.** Replacing ESPN2's and HBO Max's art changes
their ink areas, and `build_web_marks.py:385` takes the **median of all 28** as the target. If the
median moves, every `hf` in the suite moves with it, all 28 marks resize, and stage 5's table is
void. Worse, `build_brand_marks.py:target()` then recovers a *different* target from the changed
manifest, so the program marks drift on their next rebuild too. One art swap, two suites moved.

**How to do it safely:**

1. Run the full build to a **temporary directory** — never `--only`, never over the published
   manifest (see stage 5 for why `--only` truncates).
2. Compare the temp manifest's `target` against the published suite's. If the median moved,
   **freeze it**: pin the network target to its current value (recover it the way
   `build_brand_marks.py:target()` does — invert `hf` for the marks the 0.62/1.15 clamp did not bite
   and take the median) and rebuild against the pinned value, so only the two replaced marks change.
3. Diff the resulting manifest against stage 5's. **Exactly two rows may differ.** If more differ,
   discard the whole attempt, keep the current ESPN2 and HBO Max art, and report it. Stage 5's result
   is worth more than two extra pixels of logo height.
4. `guardians-tv` carries `HF_OVERRIDE = 1.25` (line 315), outside the clamp. It is excluded from any
   target recovery — the same exclusion `build_brand_marks.py:target()` already makes.

This is the single most likely way this stage breaks something upstream of it, so the report states
the before and after target explicitly, whether or not it moved.

### Acceptance

- A table: brand, sourced yes/no, source URL, fetch date, resulting aspect, resulting `hf`, and
  whether it renders.
- Every existing network `hf` is **byte-identical** to stage 5's manifest. Diff it and show the diff
  is empty.
- If ESPN2 and HBO Max got compact art: re-run stage 5's 28-row table and report the new spread.
- Gates at or above baseline.

**Commit:** `programs: studio-show marks sourced and processed` (and, if the compacts landed, a
second commit `grid: compact lockups close the last two marks onto the target weight`)

---

## STAGE 8 — the docs, and the record of what this run reversed

**Enhancement register — two new sections.**

**§19 — THE METALLIC GOLD.** Joe's handoff and rendering as the design of record; the six new token
values and their source; the AEW `#F0C850` carve-out and why a hex is not always a token; the banner
wordmark's four-stop gradient and its mapping; the card gradient kept against the rendering's flat
`#2A2A2A`, with prompt 25's contrast measurements as the reason; **LIVE kept green, with the
`--alert` collision as the reason, marked as Cowork's call and open to Joe's veto**; the desktop
renderer explicitly out of scope; `prefers-reduced-motion` added to handoff §16's list. Also record
what was HELD: Watch Live (handoff §10 and Priority 5), sticky-header styling (rides phase 4), and
the on-card My Team gold treatment (ruled out — My Team stays at band level).

**§20 — THE NETWORK RAIL, AND THE END OF THE SERIES SUB-FILTER.** Both reversals in one section
because both overturn earlier register entries:

- The rail: the real diagnosis (`max-width` overriding `hf` for eleven of twenty-eight marks), the
  measured incompatibility between "uniform at NBC's size" and "narrower column", the trade table,
  Joe's ruling of 60/600, and the M4 amendment.
- The series filter: **§9 and §16 are superseded.** Write it into §20 and add a forward pointer at
  §9 and §16 themselves, so a future reader arriving at the old sections is not misled. Do not
  rewrite §9 or §16's original text — a superseded decision is part of the record.

**`docs/rendering-contract-mobile.md`:** bump the Mobile Grid Addendum, amend **M4** for the 60px
rail, and check **M5** — it specifies axis labels at "gold #F0C850", which stage 3 has now moved.

**`docs/handoff-status.md`:** this file did not mention the Schedule Hub at all until prompt 50 fixed
it. Do not let that happen again. Add this run's stage/commit table, the new tripwire baselines
(1273 / 568), stage 2's spacing and row-height measurements, the new gold tokens, and the rail
constants.

**A new working rule 30, if this run earned one.** The candidate: *a colour that appears in a token
and in a brand constant is not the same colour twice — audit hex literals by what they MEAN, not by
their value.* Write it only if stage 3 actually found the AEW trap live; if the trap was avoided
because this prompt named it in advance, say that instead and do not manufacture a rule.

**File this prompt** at `docs/prompts/52-metallic-gold-rail-nascar-studio-marks.md`, verbatim, per
the convention prompt 49 stage 2 established. Verbatim means verbatim — including the places where
this brief turns out to have been wrong about the codebase. The run report is what corrects it.

**Commit:** `docs: register §19 and §20, the addendum amendments, and the run of record`

---

## THE REPORT

Lead with what Joe has to look at on his phone, not with what passed.

1. **The four calls open to his veto**, each in one paragraph with a screenshot: the banner wordmark
   recoloured; LIVE kept green; the card gradient kept; and any gold site where gold is carrying
   information rather than selection.
2. **The rail table** — 28 rows, before and after, plus the spread.
3. **The studio-show table** — nine brands, what landed, what did not, and why.
4. **Stage-by-stage:** commit sha, what changed, gate counts, and anything skipped under
   two-strikes with what was tried.
5. **Every citation in this brief that turned out to be wrong**, with the correction. Prompts 29,
   31 and 35 each found real errors in their briefs; assume this one has some too and go looking
   rather than waiting to trip over them.
6. **HEAD, and whether `HEAD == origin/main`.**

Then stop. Do not deploy, do not open a browser, do not write to the database.
