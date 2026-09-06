# Claude Code — Prompt 30: the grid rail comes unpinned under zoom

**Repo:** `C:\Users\jlull\Joe's Projects\Apps - Personal\MySports` · **main**

**Preconditions, hard stop if any fail:**

- `git rev-parse HEAD` == `c0fe4f1`, and `HEAD == origin/main`.
- Python **200 OK (skipped=1)**, JS unit at whatever prompt 29 left, smoke **30/30**, qa-shots **8/8**.
- Tree clean apart from untracked `assets/` and `artifacts/`.

**One bug, one prompt.** This is a behavioural fix to a locked component (Mobile Grid Addendum **M4** and **M6**) and it can only be verified on a real iPhone. It ships alone so Joe can test it without anything else moving underneath him.

**Working rule 22 applies.** Locate by content; line numbers have drifted after every prompt this week.

**No database, no pipeline, no adapters.**

---

## The report from the device

Joe, on the installed app, pinched to maximum zoom on the CFB grid and panned right:

> *"The logo column which is supposed to be fixed to the left of the screen — it actually starts sliding right over the grid. It's weird, it will actually go from the left of the screen and slide to the right of the screen."*

**Addendum M4 promises the opposite** — the network rail is "PERMANENTLY pinned left incl. under pinch-zoom." M6 grants the pinch. What ships breaks M4 the moment M6 is used.

---

## Stage 1 — confirm the diagnosis before you fix anything

**Cowork's diagnosis, to be verified, not assumed.** `.mgrid-canvas` carries `transform: scale(zoom)` (`MobileGrid.js`, the canvas `style` object) with `transform-origin: 0 0`. Inside it, `.mrail-cell` and `.mgrid-axis-rail` are `position: sticky; left: 0` (`globals.css`, the M4 rule). A transformed ancestor establishes a new containing block for its descendants, and WebKit resolves the sticky element against that transformed box rather than the scrollport — so the rail stops holding the screen edge and travels with the scaled content, its apparent motion multiplied by the scale factor. That is the sliding Joe saw.

**The same root cause explains prompt 25's stage 7c finding.** It measured `scrollWidth` tracking the transform in Chromium and a ~418 px dead-scroll region at `zoom < 1`. Both symptoms come from the transform, and Cowork drew the wrong conclusion from them — twice: first asserting a clipping bug that Chromium then disproved, then accepting Chromium's "no problem" verdict when Safari disagrees. **Do not repeat that pattern here.** Verify in code and in the browser before changing a line.

Report:

1. That the transform and the sticky rule are where this says they are, with file and line.
2. The rail's measured `getBoundingClientRect().left` against the scroller's, at zoom 1.0, 2.5 and 0.6, after panning right — in Chromium. Chromium may not reproduce it; **say so if it doesn't.** Chromium not reproducing is not evidence the bug is absent, because the device already reproduced it.
3. Whether any other `position: sticky` in the app sits inside a transformed ancestor. Grep for both and report.

---

## Stage 2 — the fix: zoom through layout, not through a transform

**Recommended approach.** Remove the transform entirely and let zoom drive the scale model instead: multiply `pxPerMin` by `zoom` when the model is built, so the canvas's real laid-out width, the block `left`/`width` values and the axis ticks all grow together.

Why this and not a patch to the sticky rule:

- With no transform in the ancestry, `position: sticky` works natively and M4 holds at every zoom, which is the actual requirement.
- `scrollWidth` becomes correct by construction, so the dead-scroll artefact at `zoom < 1` disappears too. **One change, both symptoms.**
- It removes a whole class of transform-versus-layout mismatch rather than compensating for one instance of it.

**The cost, named:** re-laying out on every pinch frame instead of compositing a transform. The work is arithmetic plus absolute-position style updates across roughly 36 lanes — cheap, but not free. **Measure the frame rate during a simulated pinch and report it.** If it is visibly janky, the sanctioned mitigation is to keep a transform *during* the gesture and commit to layout on gesture end — but only apply that transform to a wrapper that does **not** contain the rail, so M4 never breaks even mid-pinch.

**Fallback, only if stage 2 proves unworkable.** Lift the rail out of the transformed subtree: render it as a sibling of the canvas, absolutely positioned at the scroller's left edge, with row heights synced to the lanes. Sticky is then unnecessary. This is more DOM to keep in agreement and Cowork recommends against it — but it is the honest second option, so report it as considered rather than silently choosing one.

**Do not** attempt to fix this with `will-change`, `translateZ(0)`, `-webkit-transform-style`, or any other compositing hint. Those change when the bug appears, not whether it exists.

---

## Stage 3 — what must still be true

M1, M2, M3, M4, M6, M7, M8, M9 and M14 all describe this component. The zoom mechanism changes; nothing else may.

- **M1** — content still renders at 80% of contract design size at zoom 1.
- **M2** — the per-day time compression still comes from the longest line; nothing wraps.
- **M3** — the ≥60-minute hard cut and its labelled dashed seam are unchanged.
- **M4** — **the rail is pinned at the scroller's left edge at every zoom level.** This is the acceptance criterion.
- **M6** — pinch-zoom still works, still clamped to its current range.
- **M7 / M8 / M9** — TBD cards, the jump-to-network nav, the footer pills: untouched.
- **M14** — the overlap rule is presentational and lives in the model; confirm the shared fixtures still pass on both renderers.

Add a test pinning the invariant, not a number: **for every zoom level, the scroller's scrollable width equals the canvas's laid-out width.** Prefer a pure function over the sizing arithmetic so it tests without a DOM; if it can only be observed in the DOM, add it to `qa-shots.mjs` at three zoom levels and say so.

---

## Stage 4 — report, and be honest about what you cannot verify

Per stage: what changed, the sha, the evidence, every judgment call. Gates before and after.

- The stage 1 diagnosis, confirmed or corrected.
- The frame-rate measurement, and whether the gesture mitigation was needed.
- Rail position at 0.6 / 1.0 / 2.5 after panning, before and after.
- `scrollWidth` versus laid-out width at the same three levels.
- Screenshots of the right edge at maximum zoom.

Then state plainly: **Playwright is Chromium, and Chromium did not reproduce the bug Joe found.** Passing here is necessary and not sufficient. End with the check for Joe's phone:

1. Open the installed app, go to `/?day=2026-09-05&sport=cfb`, scroll to the grid.
2. Pinch to maximum zoom, then swipe left across the grid to the end of the night. **Does the network column stay pinned at the left edge the whole way?**
3. Pinch to minimum zoom. **Does it still scroll into empty space past the end?**
4. Confirm the network names are still legible at zoom 1.

---

## Explicitly out of scope

- The chip row, the ALL bar, the Racing chip, the Day/date row and the count copy — prompt 31.
- The YOUR TEAMS heading — prompt 31.
- The archived desktop PC grid — this is the phone grid only.
- `.favlabel`, `GameDetail.js`, the card's right slot — all settled or scheduled elsewhere.
- Anything in `pipeline/`, `adapters/`, or the database.
