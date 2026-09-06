# Claude Code — Prompt 34: what prompt 31 broke, plus two real defects

**Repo:** `C:\Users\jlull\Joe's Projects\Apps - Personal\MySports` · **main**

**Preconditions, hard stop if any fail:**

- `git rev-parse HEAD` == `45c339e`, and `HEAD == origin/main`.
- Python **200 OK (skipped=1)**, JS **169/169**, smoke **30/30**, qa-shots **14/14**.
- Tree clean apart from untracked `assets/`.

**Run this before prompts 32 and 33.** The sport filter is unusable on Joe's phone; nothing else queued matters more.

**Working rule 22** — locate by content, report any citation that does not match. **Rule 23** — the locked reference changes in the same commit as anything it specifies. Also rules 3, 4, 13, 16, 20.

---

## Context: prompt 31 is deployed, and two of these are its regressions

Confirmed against production, not assumed: `/history` carries prompt 31's *"All times are Eastern."* footnote, and `/?day=2026-09-04` serves all eight league marks including `/leagues/racing_dark.png`. **The build shipped.** So what Joe is seeing is prompt 31's code behaving differently on iOS Safari than it did in Chromium.

Joe, on the installed app: *"The sport chips have not rendered at all. They're tiny little gray chips with nothing in them at all."*

---

## Stage 1 — the tiles collapse on iOS Safari

### What is known versus assumed

**Known:** the eight `<img>` elements are present in the served HTML with correct paths, and every file is committed and reachable. So this is not a missing asset. Prompt 31 measured 40.5 px square tiles at 390 px **in Chromium**. Joe sees near-zero tiles on a real iPhone.

**Cowork's hypothesis, to be verified rather than assumed** — the app's third bad guess about this component would be one too many. Prompt 31 shipped, inside `@media (max-width: 699px)`:

```css
.sportrow > .spbtn {
  flex: 1 1 0;        /* flex-basis: 0 - no intrinsic main size */
  width: auto;
  min-width: 0;
  height: auto;
  min-height: 0;      /* the floor that would have caught this, removed */
  aspect-ratio: 1 / 1;/* the only thing giving the tile a height */
}
```

The tile's height comes solely from `aspect-ratio` resolved against a main size that starts at zero and is only established by flex growth. WebKit resolves that ordering differently from Blink, and `min-height: 0` removes the backstop. The mark then inherits the collapse through `max-height: 100%`.

### The fix — robust whether or not the hypothesis is right

**Give the tile a definite height and flex only the width.** Drop `aspect-ratio` from the mobile rule entirely.

- `height: 44px` (and `min-height: 44px`) at ≤699 px, with `flex: 1 1 0; min-width: 0` unchanged.
- Tiles become roughly 40 × 44 rather than exactly square. At that size the difference is invisible, and **it restores the 44 px tap target** prompt 31 traded away — so this is a net gain, not a compromise.
- Desktop's fixed 36 × 36 is unchanged.

This removes the browser-dependent behaviour rather than compensating for it. **Do not** reach for `-webkit-` prefixes, `flex-basis: auto`, or a `padding-bottom` percentage hack; those trade one browser quirk for another.

### Verify

- Report the computed width, height and rendered mark size of every tile at **360, 390 and 430 px**, and confirm the row still fits with no horizontal scroll.
- **State plainly that Chromium cannot confirm the fix**, because Chromium never reproduced the bug. The check that matters is Joe's phone.
- If your investigation shows the cause is something other than the hypothesis above, **say so and fix the real cause** — the hypothesis is a starting point, not an instruction.

---

## Stage 2 — reorder the tiles

Joe's order, replacing the current one:

**NFL · CFB · MLB · NBA · NHL · Racing · UFC · WWE**

This is `SPORTS` in `web/lib/config.js`. **Check every consumer before changing it** — prompt 25 found `queries.js` builds an enum filter from it and prompt 31 found `newestGridFor` does too. Grep, list what you find, and confirm the order change affects display order only and not any query, bucket or test that depends on position.

---

## Stage 3 — the navbar links are not clickable

Joe: *"The navbar renders properly — but we need to enable linking on the TODAY WEEKS and HISTORY borderless buttons. They're visible in the upper right corner and you need to be able to click one."*

**Cowork could not diagnose this and is not guessing.** What is established: `NavBanner.js` renders `<PrimaryNav className="nb-nav" />`; `PrimaryNav` renders real Next `<Link>` elements from `PRIMARY_ROUTES`; and on a phone `.navbar:not(.mobile) .nb-nav { margin-left: auto }` right-aligns them, which matches where Joe sees them. So they are links, in the right place, and should work.

**Reproduce and measure before changing anything:**

1. At 390 px on `/weeks`, report each link's `getBoundingClientRect()` and whether `document.elementFromPoint()` at its centre returns the link or something else.
2. Check whether anything overlaps them — the `.navbar` shadow, `.nb-ctx`, the safe-area padding region, or `.shell`. Report computed `z-index` and stacking context for anything in the area.
3. **Simulate the safe-area inset at 47 px**, as prompt 31 stage 5's verification did, and repeat the hit test. Prompt 31 changed `.navbar` to `height: calc(50px + var(--nav-safe))` with the inset as top padding; if the links now sit outside the bar's box or under it, that is the cause and it only appears where an inset exists — which is exactly Joe's phone and not Chromium's default.
4. Confirm the routes themselves resolve — `PRIMARY_ROUTES` hrefs against the actual route files.

**Report the cause, then fix it.** If the hit test passes everywhere and you cannot reproduce, say so plainly and list what Joe should check on the device instead of shipping a speculative change.

---

## Stage 4 — twelve games have been LIVE since Monday

**Verified against the database, not reported:**

```
sport  result_status  games  earliest kickoff (UTC)  latest
mlb    in_progress    12     2026-09-01 22:40        2026-09-02 00:40
```

Twelve MLB games from **Monday night, September 1** are still `in_progress`. Nothing finalised them, so every surface that reads the card state renders them LIVE — permanently, on the September 1 page and anywhere else they appear.

### 4a. The guard comes first

**A game cannot be LIVE indefinitely.** Add a display-layer guard: if `result_status = 'in_progress'` but the kickoff is more than a defensible number of hours in the past, the card must not claim LIVE.

Pick the threshold from the data, not from a guess — measure the longest real elapsed time between kickoff and `completed_at` across the loaded finals, per sport, and set the cut above the worst case with margin. **Report the measured distribution and the number you chose.** MLB extra innings and weather delays are the long tail; do not cut so tight that a genuine marathon reads as stale.

What it renders instead is a judgment call: the honest options are the scheduled time with no state, or a quiet `Final pending` — **pick one, render it, and say why.** It must not silently show a score that may be incomplete.

Put the predicate in `web/lib/format.js` beside the existing state helpers, as a pure function, and pin it with tests: fresh in-progress renders LIVE; stale in-progress does not; a final is untouched; a null kickoff does not crash.

### 4b. Then fix the twelve

Backfill their real finals. **This is a database write, so it is a hard stop for confirmation before executing** (working rule 6: SELECT-and-paste first). Report the twelve rows and the finals you intend to write, and wait.

**Then find out why the loader missed them**, because a guard hides the symptom and does not stop it recurring. Check the `schedule_refresh` run history around 2026-09-02 for the MLB "yesterday" step and report what you find. If the cause is a failed or skipped run, name it; if it is a logic gap, name that. **Do not fix the pipeline in this prompt** — report it and it gets its own.

---

## Stage 5 — TBS is missing

Joe: *"I believe we're missing TBS as a broadcaster that needs a logo. We have TNT but some baseball airs on TBS."*

**Confirmed:** `web/public/marks/` holds `tnt.png` and no TBS.

**Check the database first** — query `game_broadcasts` and the networks table for TBS and report whether any loaded game already carries it. That decides whether this is a live gap or a pre-emptive one, and it belongs in the report either way.

The mark itself goes through `scripts/build_web_marks.py` with the per-network recipe table and the frozen ink-area normalisation — **never a hand-edited PNG and never a hand-edited manifest**, per the standing rule. If the source art is not in `assets/`, **stop and report**; sourcing art is Cowork's job, not this prompt's.

---

## Stage 6 — report

Per stage: what changed, the sha, the evidence, every judgment call. Gates before and after. Call out specifically:

- Tile dimensions at all three widths, **and the plain statement that Chromium cannot confirm the iOS fix.**
- Every consumer of `SPORTS` you found before reordering.
- The navbar hit-test results, with the 47 px inset simulated — **and the cause, or an honest "could not reproduce".**
- The elapsed-time distribution behind the LIVE threshold, and the number chosen.
- The twelve rows, held at the hard stop.
- Whether TBS appears in any loaded broadcast row.
- **Anything in this brief that turned out wrong.** Nine reports running have found bad citations in their own briefs; that has been the most useful part of each — and this brief contains one explicit hypothesis that may not survive contact.

---

## Explicitly out of scope

- **The card redesign** — Joe has specified away/home/venue rows and dropping the network text; that is its own prompt once the app is usable again.
- **The count line moving beside the band header** — same.
- **The grid's team-colour bands** — prompt 32.
- **The `@`, the duplicate ET line, the 360 px count wrap, the 2 px time column** — prompt 33.
- **Fixing the pipeline gap behind the stale finals** — stage 4b reports it; a separate prompt fixes it.
- Anything else in `pipeline/` or `adapters/`.
