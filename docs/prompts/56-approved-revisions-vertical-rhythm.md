# Prompt 56 — ten approved revisions, and the vertical rhythm below the picker

**Run after prompt 55.** `CLAUDE.md` is the standing brief and you have read it; rule numbers are
named only where a stage collides with one.

Every change below was proposed from a read-only pass at `017d73e`, shown to Joe as paired
before/after mockups, and **approved by him on 2026-09-06**. Where a citation in this brief turns out
to be wrong, correct it and report it — several already were in prompts 53–55.

## PRECONDITIONS

1. `HEAD == 017d73e == origin/main`.
2. Tree clean except the six untracked `assets/` directories.
3. Baseline gates from prompt 55's report. Record them before any edit.

---

## STAGE 1 — the footer, the count line, and the condition that decides the provenance line

Three approvals in one commit; none of them moves a layout.

**R5 — drop the developer footnote.** `layout.js:47-49` renders
*"Every game is kept in the database — nothing is deleted. Reads are anon, read-only, live."* on
**all eight views**. It describes the data architecture to someone who wants to know what is on
television, and it is the only copy in the app written from the build's side of the screen. Remove
the element. **Keep** `.footnote-tz` — *"All times are Eastern · Cleveland market."* — which is a
fact the reader needs.

**R7 — "broadcasts", not "games".** `offservice.js:306` builds
`` `${on} ${on === 1 ? 'game' : 'games'} on your services` ``, and `on` counts every row — a NASCAR
race, a UFC card and College GameDay included. Change the noun to **broadcast / broadcasts**. It is
true of all of them and it is the word this app used before prompt 26 shortened it. Update any test
pinning the string.

**R6 — one condition for the provenance line.** Day mode renders `DataAsOf` on
`!error && rows.length` (`page.js:565`); week mode renders it inside `(visible.length ||
hidden.length)` (`:424`). **A day where every game is off-service shows a count line with no
provenance; the identical week shows both.** Make day mode use week mode's condition, so the two
lines appear and disappear together in all eight views.

**Acceptance:** the two-line footer at 390 in all eight views; the count line reads "N broadcasts on
your services"; a day whose games are all hidden shows both the count and the provenance line.

**Commit:** `hub: one footer, one noun, one condition for the provenance line`

---

## STAGE 2 — R1: the reveal leaves GRID view

**Views: Day · Grid and Week · Grid, both scopes — four of the eight.**

`PageCount` renders in every view (`page.js:422`, `:560`). Its `<button class="offsvc-toggle">`
opens `.pagecount-hidden` → **a full set of sport bands with marks, `<h2>` titles, matchup and
program cards, and the tap-to-open `GameDetail` panel** (`PageCount.js:86-115`). So **"Show 5 not on
your services" puts a card list under the grid.**

That is the direct contradiction of Joe's ruling *"I only want list cards on list view and only grids
on grid view."* Prompt 55 implemented that ruling inside `Listing`; the reveal lives in `PageCount`,
so the two never met.

**What to build.** `PageCount` learns whether it is in grid view — pass it down rather than letting
it guess. In grid view:
- the count line **stays** and is unchanged
- the **button does not render**; in its place, a plain clause naming where the hidden games are:
  **"5 not on your services — switch to List to see them"**
- `.pagecount-hidden` can never open, so no card, band or detail panel reaches a grid view

List views are untouched: the button, the reveal and the detail panel all behave exactly as today.

**Acceptance:** at 390, each of the four grid views renders **zero** elements matching
`.mcard, .pcard, .band-head` — report the count. The four list views are byte-identical to before.

**Commit:** `hub: the count line reports in GRID view, it does not reveal`

---

## STAGE 3 — R2: MY TEAMS says so

**Views: the four MY TEAMS views.**

Nothing on the page names the scope. In list views the only signal is the *absence* of "Your teams"
labels (prompt 53 stage 6 removed them there, correctly); in grid views there is no signal at all, so
**Day · My Teams · Grid is structurally identical to Day · All Teams · Grid** and only the number of
blocks differs.

**What to build.** When `P.isMine`, one line directly below the control stack and above everything
else, in **all four** MY TEAMS views. **Joe pinned the wording on 2026-09-06:**

> **MY TEAMS · 13 CLUBS + RACING + COMBAT SPORTS**

Small, gold, uppercase, with a left rule — the same visual weight as a caption, not a heading. It
must not look like a band title.

**The two category words cover all five team-less sports**, which is why this phrasing was chosen over
naming them individually:

| word | covers |
|---|---|
| **racing** | `nascar`, `indycar` |
| **combat sports** | `ufc`, `wwe`, `aew` |

`racing` is not new vocabulary — it is already the app's own filter token for exactly those two sports
(`FILTER_EXPANDS`, `config.js:51`), so the line and the tile agree. `combat sports` is a display label
only; do **not** add it as a filter token or a sport value.

**Derive the club count, never hardcode it** — `favoriteIds(favoritesDoc).size`. It changes the day
Joe adds a team, and a line reading "13 clubs" above fourteen clubs' games is worse than no line.

**Pin the coverage with a test.** Assert that every member of `TEAMLESS_SPORTS` (`favorites.js:61`)
falls into one of the two categories above. If a sixth team-less sport is ever added, that test fails
and the line gets revisited rather than silently under-describing the scope — which is the whole
failure this line exists to fix.

This is also the first place the app states that MY TEAMS silently includes **every** race, fight card
and wrestling show, not just the thirteen clubs. That was register §18d's ruling and no surface has
ever said it.

**Acceptance:** the line appears in exactly four views and nowhere else. Screenshot Day · My Teams ·
Grid beside Day · All Teams · Grid and confirm they are now distinguishable.

**Commit:** `hub: MY TEAMS names itself`

---

## STAGE 4 — R3 + R4: the week keeps its league, and its day heading stops moving

**Views: the four WEEK views, and only when a league tile is selected.**

Two faults, one fix.

**R3 — the league vanishes.** With a tile selected, `bands={!P.sport}` is false, so `Listing` takes
the flat branch and `SportBand` renders with `showHeader={false}` — no mark, no title. Scroll three
days into WEEK · NFL and **nothing on screen says NFL** except a highlighted tile far above.

**R4 — the weekday heading is two different objects.** Under ALL SPORTS it is a `<p>` sibling
*above* the bands (`Listing.js`). With a league picked it is passed *into* `SportBand` as
`sectionLabel` and renders inside `.band-headrow`. Same text, same class, different DOM level and
different neighbours — and `.band-headrow` was built to share its row with a per-band count line that
prompt 50 retired.

**What to build.**
1. **The weekday heading always renders at the outer level**, whether or not a tile is selected.
   `SportBand` stops receiving `sectionLabel` from week mode.
2. **The heading row carries the league mark** when a tile is selected — one mark per day, beside the
   weekday, at the size `.weekday .band-mark` already sets. Under ALL SPORTS nothing changes: the day
   stays the outer heading with sport bands nested beneath it, each with its own mark.

**Two dead things fall out — remove both and say you did.**
- `SportBand.js:92` sets `className={sectionLabel ? 'band yourteams' : 'band'}`. `sectionLabel` used
  to mean the page-level YOUR TEAMS section, retired by prompt 51; the only caller still passing it is
  week mode passing a **weekday**, so every Tuesday is currently marked `yourteams`. Once (1) lands
  nothing passes it and the branch is dead.
- `globals.css:2040` still carries `.listing > .yourteams { order: -2 }` — an ordering rule for that
  same retired section. **Verify `.yourteams` has no other rule and no other consumer before removing
  it** (Cowork found none, and rule 31 says a search that finds nothing is evidence about the query —
  so search the class name, not the concept).

**Acceptance:** WEEK · NFL · LIST at 390 shows the NFL mark beside each weekday. WEEK · ALL SPORTS is
unchanged — diff the rendered DOM. `git grep yourteams` returns nothing.

**Commit:** `hub: a week names its league, and its day heading holds one shape`

---

## STAGE 5 — R8: the empty day stops naming dates that have passed

**Views: Day · All Games, both list and grid.**

`page.js:498-499` hardcodes six dates — *"try 2026-09-03 or 2026-09-04 (MLB), 2026-09-05 (CFB),
2026-09-13 (NFL), 2026-10-01 (NHL) or 2026-10-28 (NBA)"*. Three are already in the past. By November
the paragraph is a list of dead ends, and week mode's equivalent (*"try a CFB or NFL week"*) does not
age because it names no date.

**What to build.** Derive the **nearest loaded viewing day** and name that one:

> Nothing on this viewing day. The next loaded day is **Saturday, October 10**.

Prefer the next loaded day at or after the one being viewed; if there is none, name the most recent
past one and say so. Add a bounded query for it — one `viewing_day` lookup, ordered, `limit 1`, and
**never an unbounded select** (rule 19). If the query fails or returns nothing, fall back to a generic
line with no date in it; an empty state must not be able to error.

The per-sport lines in `SPORT_EMPTY` (`page.js:70-80`) are **unchanged** — those name external gates
rather than loaded data, which is why they are allowed to name a date.

**Commit:** `hub: an empty day points at the next loaded one`

---

## STAGE 6 — R9 and the band titles

**Views: Day · List, both scopes** (the only two with a first band).

**R9 — the band stops repeating the date.** `FirstBand.js:27` renders `band.heading`, which
`bandstate.js:85` builds as `` `${dayLabel} · ${clock} ET` `` → *"Friday, September 4, 2026 · 7:12 PM
ET"*. **The picker two rows above already shows that date, in those words.** Drop the day half; keep
the clock:

> **as of 7:12 PM**

Note that `etTime()` no longer appends " ET" (prompt 31) and the footnote carries it once — so the
new string must not reintroduce it.

**R11 was NOT approved.** Joe considered adding "2 of 14 today" to this line and declined. The
subtext is the clock alone. Do not add a fraction.

**The band titles, all three, renamed together.** Joe asked for one and then ruled that all three
should match rather than leaving two connectors doing one job. `bandstate.js:159-163`:

| state | now | becomes |
|---|---|---|
| `tonight` | `Tonight` | **`Tonight`** *(unchanged)* |
| `live` | `On now · Next up` | **`Live & Upcoming`** |
| `finals` | `Finals · Tomorrow` | **`Finals & Tomorrow`** |

Update every test pinning these strings, and check whether any doc quotes them — the register and
05 §11 may.

**Commit:** `hub: the first band states the clock, and its three titles share one voice`

---

## STAGE 7 — R10: a programs-only day speaks on the laptop

**Views: Day · Grid, both scopes, desktop only.**

`page.js:522` gates the archived PC grid on `games.length`. A day carrying **only programs** — a
NASCAR Sunday, a studio-show morning — has zero games, falls through both branches, and renders **an
empty `.deskgrid-only` container with no grid and no explanation.** Week mode asks
`grouped[d]?.length`, which counts programs, so the two modes disagree about what "has content" means.

Ask week mode's question. The existing one-liner in `ArchivedGrid` (`page.js:137-142`) then does its
job. No new copy.

**Commit:** `hub: the desktop grid answers on a day with no games`

---

## STAGE 8 — the vertical rhythm below the picker

**Joe, 2026-09-06:** *"evaluate the vertical spacing between cards and between sections that render
below the picker — make sure they're standardized and not excessive."*

**He ruled: measure, report, then apply a stated scale.** So this stage does all three, in that order,
and the report carries both sets of numbers.

### What to measure

Every vertical gap **below the picker**, at **390px**, in all eight views, populated. **Measure the
RENDERED gap** — the distance between the bottom border box of one element and the top of the next —
not the declared value. Adjacent margins and the flex container interact, and the declared numbers
will not tell you the truth. `.listing` is `display:flex; flex-direction:column` with **no `gap`**, so
its children stack on their own margins.

The pairs, at minimum:

- card → card · heading → first card · last card → next heading
- band → band · day group → day group · first band → the list below it
- the favourites group's rule (`.favrule`) above and below
- content → count line · count line → provenance line · provenance line → footnote
- in grid views: picker → grid · grid → count line
- with a scope line (stage 3): picker → scope line → content

### The declared values Cowork found, as a starting map — verify each

`.cards { gap: 8px }` · `.band { margin: 0 0 26px }` ·
`.band-headrow { margin: 0 0 8px; padding-bottom: 6px }` · `.weekday { margin-bottom: 14px }` ·
`.weekday-head { margin-bottom: 6px }` · `.fband { margin: 0 0 22px }` ·
`.favrule { margin: 14px 0 }`

**Note what that adds up to:** a day group ends with a band carrying 26px, then `.weekday` adds 14px
— so day-group to day-group is likely ~40px rendered, against 8px between cards. That is the kind of
excess to find, and it is why the measurement has to be rendered rather than declared.

### The scale to standardize onto

Derived from the control stack's own rhythm, which prompt 51 settled at **8px** and which Joe has
already accepted by eye:

| role | value |
|---|---|
| card → card, and anything inside one group | **8px** |
| a heading → the content it labels | **16px** |
| one section → the next section | **24px** |

**Three hard rules:**
1. **No rendered gap may grow.** If a pair currently sits below its target, it keeps its current
   value and you report it rather than opening it up.
2. **Nothing inside a list card or a grid block changes.** The card contract is locked (v1.6.4) and
   the grid's internal geometry is frozen by the tripwire — lane gaps, block heights, tray heights
   and the rail are all out of scope.
3. **The control stack is out of scope.** Prompt 51 tuned it and Joe has confirmed it on the device.
   This stage starts below the picker.

If a pair cannot take its target without breaking one of those rules, **leave it and report why**.
A stated exception is worth more than a forced number.

### Acceptance

- The full before/after table, all eight views, rendered values.
- The geometry tripwire is untouched: block counts, lane counts and row counts unchanged. Per
  prompt 54 stage 3 the pixel figures are report-and-explain, not a hard stop — but **nothing in this
  stage should move them at all**, so any movement is a finding.
- Page-height delta per view.

**Commit:** `hub: one vertical rhythm below the picker`

---

## STAGE 9 — the record

**Register §24** (last is §23 — verify): the ten approved revisions, each with the view set it
changed and Joe's approval dated 2026-09-06; the band-title rename as a set of three; R11 recorded as
**considered and declined**, so nobody re-proposes it; and the vertical scale with its three hard
rules, which is the part a future change needs to obey.

**`docs/handoff-status.md`:** the stage/commit table, the gates, and the spacing scale.

**`docs/design/mobile_demo.html`** — stages 4, 6 and 8 all touch things the locked reference
implements (rule 23). Check each; do not assume.

**A working rule 32, only if this run earns one.** Rules stop at 31 — verify. The candidate, if
stage 2 plays out as expected: *a ruling implemented in one component is not implemented until every
component that renders the same thing obeys it* — prompt 55 put "grids only" into `Listing` while
`PageCount` kept serving cards. Write it only if you agree it is distinct from 22 and 30; if it is one
of those in a costume, say so and extend that one instead.

**File this prompt** at `docs/prompts/56-approved-revisions-vertical-rhythm.md`, verbatim.

**Commit:** `docs: register §24 and the run of record`

---

## THE REPORT

1. **Screenshots at 390 of all eight views**, after. This run touches every one of them.
2. The stage 8 before/after spacing table, and the page-height delta per view.
3. The zero-card proof for the four grid views.
4. Stage by stage: sha, gate counts, anything skipped under two-strikes.
5. Every citation in this brief that was wrong.
6. HEAD, and whether `HEAD == origin/main`.
