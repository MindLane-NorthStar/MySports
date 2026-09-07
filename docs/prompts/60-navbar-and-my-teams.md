# Prompt 60 — the navbar Joe designed, and MY TEAMS said once

**Run after prompt 59.** `CLAUDE.md` is the standing brief. **Read it from disk before citing a rule
number** — rules stop at 34, register at §27.

**This replaces the collapsed bar prompt 58 shipped.** Joe designed its successor across four
exchanges on 2026-09-07 and the design never reached a brief — prompt 59 had already been written.
That gap is why nothing changed on his phone, and it is Cowork's error, not a missed instruction.

## PRECONDITIONS

1. `HEAD == origin/main == c59f1d5`, deploy READY on that sha.
2. Tree clean except the six untracked `assets/` directories.
3. Python certified for Windows (rule 1).
4. Baseline: pytest 494 + 1 skipped · unit 431 · smoke 30/30 · qa-shots 25/25 · geometry all hard
   stops (12.8898 / 6.6629 / 8.5069).

**If any is not true, stop and say which.**

## THE UNATTENDED CONTRACT

Stages self-commit. **Hard stops are only:** a secret-gate hit, a destructive database operation, or
a rejected push. Everything else is two-strikes-skip.

**No database writes and no database reads.**

**Push at the end of stage 5 — Joe authorised it for this run.**

---

## WHAT JOE DESIGNED, IN HIS WORDS

> "I'd like the banner to collapse as you scroll up OR by a purposeful tap on the tv ON the banner.
> Then the navbar that replaces it — which shows MySports TV and the Day / All Games / List / All
> Sports text buttons… Could these three choices be rendered as VERTICAL slider toggles? Day over
> Week, All Games over My Teams, List View over Grid View. All would render in the navbar with the
> selected button in gold. Meanwhile a tiny arrow gets embedded under 'All Sports' indicating that a
> tap will open a submenu, at that submenu is the league tiles. In the event the user selects a tile
> — that tile then takes the place of 'All Sports' in the navbar."

> "The navbar would take the place of the banner once a user scrolls past the banner, and the banner
> would remain permanently in place from that point forward until the user taps 'MySports TV' in
> which case the full banner and expanded toggles would appear atop the app."

**Settled in follow-up:** four columns, not three-plus-a-mixed-one — `DAY/WEEK`, `ALL GAMES/MY
TEAMS`, `LIST VIEW/GRID VIEW`, then the live tile showing `ALL SPORTS` or the chosen league's mark.
**Joe initially wrote that the fourth tile shows "All Games"; it does not** — that belongs to the
second toggle. **44px, not 88px** — see stage 2. No tagline in the navbar.

---

## STAGE 1 — the state machine, one-way

Prompt 58 shipped *scroll owns everything*: scroll down collapses, scroll to top re-expands, no
manual control. **Joe's design is different and better, and the difference is the point.**

| trigger | result |
|---|---|
| first paint | expanded — the full banner and the whole control stack |
| scrolling past the banner | **collapses** |
| tapping the TV on the expanded banner | **collapses** |
| tapping `MYSPORTS TV` in the navbar | **expands**, and returns the reader to the top |
| scrolling back to the top while collapsed | **stays collapsed** |

**Scroll only ever collapses. It never expands.** That is what removes the conflict prompt 58's brief
worried about: two inputs cannot fight over the state when only one of them can set it in each
direction. Expansion is manual, and it is the only manual thing here.

**The TV becomes a control**, so it needs to look and behave like one — a real `<button>` wrapping
it, an accessible name saying what it does, a 44px target, and a visible focus ring. An illustration
that silently became tappable is worse than no control. Report what you chose and why.

Keep prompt 58's mechanics that still apply: `IntersectionObserver` on a sentinel and never a scroll
handler; the header a **sibling** of `<main>`, never an ancestor; no transform on anything between
`.mrail-cell` and `.mgrid-scroll`; the safe-area inset painted but not counted against the 44px;
motion inside `@media (prefers-reduced-motion: no-preference)`.

**Acceptance:** each of the five rows above demonstrated at 390, with a screenshot for the two taps.

**Commit:** `hub: the header collapses one way and expands only on request`

---

## STAGE 2 — three vertical toggles

Each of the three binaries becomes a two-line stack: both labels visible, the live one in `--gold`,
the other in `--dim`. **One tap target per control, not two.** With a two-state control, tapping the
control and tapping the inactive label are the same action — a second 44px target would double the
bar's permanent cost to buy a duplicate.

That keeps the bar at **44px**. Joe asked whether 88px would let the tagline return; it would
vertically, but the tagline is *wider* than the wordmark it would sit under, so it would push the
left column out and squeeze these four controls. He chose 44.

### Measure before you fix any padding

**Cowork's width model has been wrong five times out of five in this project**, most recently by 17%
low on the wordmark and 71% high on the run. Do not take a number from this brief.

Render and measure, with real font metrics, at **360 / 375 / 390 / 430**, and report a table for
both label options:

- `LIST VIEW` / `GRID VIEW` — Joe's wording, and the widest at nine characters
- `LIST` / `GRID` — four characters

Each column sizes to the **wider of its two labels**, so `WEEK` governs the first, `ALL GAMES` the
second, and the view pair the third. **Ship the longer labels if they fit at 360 with margin;
otherwise ship the short ones and say so.** Joe wants the full words and will accept the short ones
on evidence.

**One thing to establish while measuring, because it may already be an unrecorded exception.** Prompt
58's brief specified 44px targets in both dimensions, but the measured four-control run came to
142.5px — less than four 44px targets. So the horizontal minimum probably is not applied. **Report
what the current targets actually measure.** If they are 44 tall and narrower than 44 wide, that is a
third exception to the 44px rule (register §18b holds two) and it goes in the register whether or not
this stage changes it.

**Accessibility.** A collapsed binary shows both options but is one control, so it is not a
radiogroup and it is not two buttons. Keep prompt 58's pattern — visible text is the state, the
accessible name states the action — and update the names to match the new shape, since both labels
are now visible. Report the final names for all three.

**Acceptance:** the width table at four viewports for both label options; the target measurements;
the three accessible names; screenshots of each toggle in both states.

**Commit:** `hub: the collapsed toggles show both states`

---

## STAGE 3 — the live tile

The fourth column is **not** a toggle. It shows `ALL SPORTS` by default, or the selected league's
mark once one is chosen, with **a small caret beneath it** — which makes every column in the navbar a
two-line stack and keeps the row visually even.

Tapping it opens the league row beneath the navbar: the same `SportFilter` prompt 58 stage 4 already
wired, the `ALL SPORTS` bar plus the eight tiles. Picking a league closes the row and puts that
league's mark in the tile. **Picking `ALL SPORTS` in that row puts the words back** — that is the only
way back, and it must work.

Reuse `SportFilter`; do not fork it. `aria-expanded` on the tile, a real relationship to the row it
opens, and a closed row that is absent from the DOM rather than hidden — prompt 58 established that
and the reason was focus order.

**The tile is the one column that changes shape**, so it is the one that can break the row. Measure
it with the widest league mark in the set, not with `ALL SPORTS`.

**Acceptance:** the row opens and closes; both directions of the label swap; `aria-expanded` correct;
the row overlays rather than pushing content; the width check with the widest mark.

**Commit:** `hub: the live tile opens the league row`

---

## STAGE 4 — MY TEAMS, said once

### What Joe sees, 2026-09-07

> "On the MY TEAMS page, My Teams render twice — once in what appears to be chronological order
> (although WWE Raw is currently appearing ahead of the Guardians game that airs 7 hours earlier) and
> a second time divided by sport. This seems unnecessary and repetitive."

### Two defects. One is verified; the other you must diagnose before fixing.

**Verified — the duplication.** `page.js:583` renders `FirstBand` on `rows.length && !P.isGrid`, and
`:598` then renders `Listing` over the same `rows`. `FirstBand` shows a **time-window subset**;
`#all-today` shows **everything**. Under ALL GAMES that is a small slice of eighty games and the "See
all today" link earns its place. **Under MY TEAMS the subset is nearly the whole list**, so the page
prints the same handful of rows twice.

**Verified — the ruling the code discards.** `page.js:475-479` states the intent twice:

> *"R4: MY TEAMS is a scope — favourites only, chronological across every sport… `allRows` arrives
> ordered by kickoff and `splitMine` keeps input order, so 'chronological across every sport' is
> free."*

The data layer honours it. The render layer then passes `bands={!P.isGrid}` (`:599`), which is **true
under MY TEAMS**, so the list is regrouped into sport bands — and `globals.css:2162` records that
"bands render in SPORTS order, not kickoff order." **The chronology R4 computes is thrown away three
lines later.** That is rule 32's shape: a ruling implemented in one layer and not in the one that
renders it.

**NOT diagnosed — the ordering inside the first section.** `Listing`'s `bands` default is `false`
(`:47`) and `FirstBand` passes no `bands` prop, so that section is a **flat list** and WWE Raw ahead
of an earlier Guardians game is a genuine sort fault, not band ordering. **Cowork does not know the
cause.** Read `lib/bandstate.js` and `toRows` in `lib/programs.js` and find it before changing
anything — `allRows = [...games, ...programRows]` is a concatenation, so if a program carries a null
or differently-shaped kickoff key it will not interleave correctly. **Report the mechanism, then fix
it.** If the ordering turns out to be correct and Joe is describing something else, say that instead.

### Why this is two conditions and not a rewrite — verified

`Listing` already has both arrangements (`:194-226`). Banded is one `SportBand` per sport with
headers; **flat is a single `SportBand` with `showHeader={false}`** — "same component, header off, so
the count line, the toggle, the favourites float and the row wrappers have one implementation."
Turning `bands` off therefore loses **none** of the off-service dim, the MARKET TBD cue, the NETWORK
TBD cue or the row wrapper classes. The flat path is already live — week mode with a sport selected
uses it.

### The one thing it does cost, and it is not in Joe's report

**The flat branch has never been exercised with a null sport.** `Listing:224` passes
`label={null}` and `sport={sport}`, and `SportBand:98` renders
`<section className="band" aria-label={label || sport}>`. Today the flat branch is reached only from
week mode **with a league selected**, so `sport` is always truthy. **Under MY TEAMS with ALL SPORTS,
both are null and the section loses its accessible name.**

Give it one. A scope-level name — naming the scope rather than a sport, since the section now holds
every sport — and say what you chose. This is a new state for that code path, so **check the whole
path for other assumptions that a sport is always present**, not just the aria-label.

### The fix

1. **`FirstBand` does not render under MY TEAMS.** Gate it on `!P.isMine`. It exists to answer "what
   is on right now" when a day holds eighty rows and cannot be scanned; with five it is noise, and
   its "See all today" escape points at a list identical to itself.
2. **`bands={!P.isGrid && !P.isMine}`** — MY TEAMS becomes one chronological list across every sport,
   which is what R4 says it is.
3. **Fix the sort fault** once you have the mechanism.
4. **Name the flat section**, per the note above.

Together these make MY TEAMS exactly the thing `page.js:475` describes. **ALL GAMES is untouched** —
`FirstBand`, the sport bands and the favourites bracket all stay exactly as prompt 59 left them.
Assert that in the gate rather than assuming it.

**Acceptance:** MY TEAMS at 390 before and after, day and week; a proof that ALL GAMES renders
identically before and after; the sort mechanism named, with the ordering shown correct afterwards;
the flat section's accessible name, and any other null-sport assumption found on that path.

**Commit:** `hub: my teams is one chronological list`

---

## STAGE 5 — the record, and the push

**Register §28** (last is §27 — verify): the navbar as one entry carrying Joe's design and the
one-way state machine, **with the reason scroll may not expand** — that is the part that looks
arbitrary later and is not. The 44-versus-88 decision and why the tagline stayed out. The label-length
outcome with its measurements. Any third exception to the 44px rule found in stage 2. And stage 4 as
**R4 finally implemented in the render layer**, not as a new ruling.

**`docs/handoff-status.md`:** the stage/commit table, the five gate counts, and the open items —
migration 0017 still unapplied with its evidence attached, and the streaming tap-test still owed by
Joe.

**`docs/design/mobile_demo.html`** — rule 23. This changes the header and MY TEAMS both. **Read the
file and decide** whether the locked reference implements either; say which and why.

**Rules stop at 34.** Write a 35 only if this run earns one, and say so plainly if it does not.

**File this prompt** at `docs/prompts/60-navbar-and-my-teams.md`, verbatim.

**Commit:** `docs: register §28 and the run of record`

**Then push.**

---

## THE REPORT

1. **Stage 1:** the five state rows demonstrated, and what the TV control became.
2. **Stage 2:** the width table at four viewports for both label options; the real target
   measurements; the three accessible names.
3. **Stage 3:** the tile in both states and the widest-mark width check.
4. **Stage 4:** the sort mechanism named; MY TEAMS before and after; the ALL GAMES no-change proof.
5. Stage by stage: sha, all five gate counts, anything skipped.
6. **Every citation in this brief that turned out to be wrong.** Prompt 59's carried three line
   drifts and a cost prediction that named the wrong failure mode.
7. **HEAD, `HEAD == origin/main`, and the deploy state.**

Then stop.
