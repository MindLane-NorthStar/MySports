# Prompt 67 — the TONIGHT band goes, the week scrolls to now, and the picker drops the year

**Venue:** Claude Code. **Run prompt 66 first** — it carries a live 1.46:1 block on `main`.
**COMMIT AND PUSH ARE BOTH AUTHORIZED FOR THIS RUN**, on prompt 65's terms: five gates green, then
commit, then push, and only the commits this prompt creates. A rejected push is a hard stop.

Three rulings Joe made on 2026-09-08. Read the floors from `docs/handoff-status.md` (rule 10).

## Rules that bite

Rule 3 (secret gate, ADDED only), rule 4, rule 11, rule 20, rule 22 (**read the component and cite
file and line — never the contract that describes it**), rule 23 (`docs/design/mobile_demo.html`
moves with anything it implements), rule 26, rule 32 (a ruling is not implemented until every place
that renders the same thing obeys it).

## Gates — five, each its own command

Floors live in `docs/handoff-status.md` only now — prompt 66 stage 2 took the numbers out of
`CLAUDE.md`. **Verify handoff carries prompt 66's final counts** (pytest 511 + 1 skipped · unit 474 ·
smoke 33/33 · qa-shots 91/91) before trusting them; that file was written mid-run.

**`qa-shots` flakiness is environmental and it has now cost three runs.** Prompt 66 found **five**
orphaned `next dev` servers from 09-06, 09-07 and its own earlier stages sharing one `.next`, plus
**25 orphaned chromium processes**. Nine runs in that state gave 91/91 once and one-to-three
different failures otherwise, never the same set, every failure a fixed `waitForTimeout` expiring
before a navigation. **Check for both before debugging code.** The durable fix — waiting on the
condition rather than a duration — is recorded in `handoff-status.md` and still not done; if you have
the room after stage 3, it is worth more than anything else on the open list.

---

# Stage 1 — the TONIGHT band comes out

**Joe, 2026-09-08:** *"In DAY view, ALL GAMES, LIST — we're still seeing the same games two times."*

**This is not a bug.** `FirstBand` (`components/FirstBand.js`) is a deliberate filtered preview —
TONIGHT / Live & Upcoming / Finals & Tomorrow — rendered at `app/page.js:621`, with a *See all today*
link to `#all-today` and the full chronological list below it. Prompt 56 built it that way. Joe has
now ruled that the repeat is not worth the preview: **the full list is already chronological, the
picker already names the day, and stage 2 of this prompt makes the app scroll to what is on now —
which is what the band existed to answer.**

## Do

1. Remove the `FirstBand` render from `app/page.js`. The full listing stays exactly as it is.
2. **Report what becomes dead before deleting it.** Candidates: `components/FirstBand.js`,
   `web/lib/bandstate.js`, `BAND_TITLE`, the `#all-today` anchor and any CSS under `.fband*`. For each,
   say whether anything else still references it. **Delete only what is provably unreferenced**, and
   list anything you left because a second caller exists.
3. The `#all-today` id may be linked from elsewhere — check before removing it.
4. Tests that assert the band renders will fail. That is correct: **update them to assert it does
   not**, rather than deleting them. A test that once pinned a feature is the right place to record
   that the feature was removed and when.
5. Confirm the day page still renders every game exactly once, in every scope and view combination.

**Commit:** `day: the tonight band comes out`

---

# Stage 2 — the week scrolls to what is on now

Joe wants to land on the current day without scrolling, in both LIST and GRID.

## The rulings, in his words and mine

- **Target:** *"Top of the day before games start, games in-progress while games are in-progress."*
  So: before the day's first kickoff, the current day's heading. Once anything is live, the earliest
  in-progress game. **After the last game has finished, treat the day as pre-game and land on its
  heading** — Cowork's reading, not Joe's words; if you think a different fallback is better, say so
  rather than silently choosing.
- **When:** every entry to week view, **and again when the app returns from the background.** Joe
  chose the most aggressive option knowingly, over Cowork's recommendation.
- **Never on a week that does not contain today.** There is no current day there to scroll to.
- **Day view gets the same treatment.** Cowork's call, not Joe's explicit words — the day is the whole
  page there, so "scroll to the current day" means "scroll to what is on now" and the same target rule
  applies. It is also what makes stage 1 safe: dropping the band removes the at-a-glance "what is on
  now", and this puts it back. **If day view turns out to need a different rule, report rather than
  improvise.**

## Hazards, all real

1. **The header collapse.** `lib/headerstate.js` collapses on an IntersectionObserver crossing the
   sentinel, and it applies a scroll compensation when it does. A programmatic scroll will cross that
   sentinel. Decide deliberately whether the header should be collapsed after an auto-scroll — it
   probably should — and make sure the compensation does not fight the scroll and land the reader
   somewhere neither intended. **Measure the final scroll position, do not reason about it.**
2. **The sticky picker.** Prompt 62 made `.chdr` and `.pickrow` sticky with a JS-maintained
   `--stack-h`. An element scrolled to the top of the viewport sits *under* that stack unless the
   scroll accounts for it. The target must land below the fixed stack, not behind it.
3. **`prefers-reduced-motion`.** A smooth scroll is motion. Honour the query.
4. **The grid.** In week + GRID each day is its own stacked grid. The anchor must be the day's
   heading or its grid, and the horizontal scroll position inside `MobileGrid` must not be disturbed —
   the pinch and scroll handling there is the most fragile code in the app and the geometry tripwire
   guards it.

## Do

1. Read how week mode groups days (`app/page.js` around `:403`) — each day already knows whether it is
   today, via `nowMinute={d === today ? weekNow : null}`. Use what exists rather than recomputing it.
2. Give each day block a stable anchor.
3. Implement the target rule, the trigger rule and the never-rule above.
4. **Report the measured landing position** for: before the first game, mid-slate with a live game,
   after the last game, and a week that does not contain today. Four numbers, four scenarios.
5. Geometry tripwire must not move. A scroll feature has no business touching block widths.

**Commit:** `week: opening lands on what is on now`

---

# Stage 3 — the picker drops the year

**Joe's ruling.** Calendar weeks become **`Monday, Sep 7 - Sunday, Sep 13`** — full weekday names,
abbreviated month, no year. Season weeks keep their prefix and drop the year:
**`NFL Week 1 · Wed Sep 9 - Mon Sep 14`**. The day picker is unchanged.

## Why that exact format

Cowork measured the candidates in the real font — Inter SemiBold 12px with the picker's 0.03em
tracking — against the room the pill actually has: **233px at 390, 203px at 360**.

| candidate | width | fits |
|---|---|---|
| `Monday, September 7 - Sunday, September 13` (Joe's first ask) | 283px | **no** — truncates at both widths |
| `Monday, Sep 7 - Sunday, Sep 13` | 196px | yes, at 360 and above |
| `September 7 - September 13` | 174px | yes, but loses the weekday names |
| `Wed Sep 9 - Mon Sep 14` (season range) | 149px | yes |

**Verify these yourself** before building on them — Cowork's measurement is a claim, and the
season-week case in particular carries a gold prefix whose width is not in that table. Report the
widest real label at 360 including the prefix, and say whether it clears the room.

## Do

1. Find where the picker's parts are built. `components/WeekSelect.js:83-88` renders `p.prefix` and
   `p.range` from a `selectedParts` prop; the builder is upstream, reached through `weekChoices`.
   Cite it when you find it.
2. Change the range format for both cases. `.pk-range` is the part allowed to ellipsize and
   `.pk-sport` is not — that ruling stands, so a season week must still lose its range rather than its
   week number if anything has to give.
3. **The year-boundary case.** A week spanning 29 December to 4 January is genuinely ambiguous with no
   year. **Show the year only when the week's two ends fall in different years** —
   `Monday, Dec 29 - Sunday, Jan 4, 2027`. Measure that string; if it does not fit at 360, report it
   and propose, do not truncate silently.
4. **A month-spanning week must still fit:** `Monday, Sep 28 - Sunday, Oct 4`. Measure it.
5. Rule 23 — if `mobile_demo.html` shows a picker label, it moves in this commit.

**Commit:** `picker: the week range drops the year`

---

# Stage 4 — two loose ends prompt 66 left, both Joe's to see

## 4a. Most of the bucket still has no cache policy

Stage 4 of prompt 66 set `public, max-age=300` on upload, but a `--push` skips unchanged objects, so
**387 of 1,532 `logos/` objects carry the policy and 1,145 answer with none.** Those 1,145 keep the
behaviour that cost an hour on 2026-09-08 until their art happens to change.

**Do:** force a re-upload of the `logos/` prefix so every object carries the policy now. Read
`scripts/sync_assets.py` for whether a flag already forces it; if none exists, say so and propose the
smallest change rather than inventing one. Report objects re-uploaded, and confirm with `head_object`
on a sample that previously had `CacheControl=None` that it now carries the policy.

**This is a bucket write, not a git push.** Nothing in the app changes.

## 4b. Sixteen caps chose their art against a tint that no longer exists

Prompt 66 stage 5 made ruled teams paint their band untinted. **16 of the 42 formerly-tinted caps
carry `art: 'dark'`, and that choice was made because the dark lockup read better on the tinted
surface** — a surface that is now gone. Recorded in register §29 and deliberately not touched, because
re-deciding needs the pixels measured at render size through `scripts/build_cap_table.py`.

**Do — measure and report, change nothing.** For each of those 16, measure both art variants against
the band as it now paints, at the size the cap actually renders. Report which ones the change has made
wrong, with the numbers. **Do not re-pick the art.** Joe judged 766 logos by eye and he will judge
these; the deliverable here is the evidence, not a decision.

If the answer is "none of the 16 got worse", say that plainly — it closes the item.

---

# The report

Per stage: what changed, the five gate counts, the commit hash, and every number with the command
that produced it. Then:

- **What became dead** with the TONIGHT band, and what you left behind because something still calls it.
- **The four measured landing positions** from stage 2, and whether the header collapsed on each.
- **The widest real picker label at 360**, prefix included.
- **The 16 caps**: which the untinting made worse, measured, and which are unaffected.
- **Anything in this brief that turned out to be wrong** — the line citations came from Cowork reading
  the files today and the picker's parts builder was never located.
