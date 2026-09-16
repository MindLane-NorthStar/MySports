# Prompt 101 — the banner's two remaining bugs, both in the pin's release path

Two defects, one release handler, both measured. Block A is mechanism-proven and should behave
identically on your gates. Block B is a HYPOTHESIS with strong evidence and can only be judged on
Joe's phone, so it ships provisionally with a named revert.

Read `docs/handoff-status.md` first as always. The gate floors are there and nowhere else.

---

## BLOCK A — the first scroll after a landing does not collapse the header

### The complaint

Joe, 2026-09-15: *"The banner does not collapse and morph into the Navbar upon scroll down — you
scroll down and the banner disappears, scroll up and the banner is still there, scroll down again and
THEN the banner disappears and navbar appears."* And, decisively, 2026-09-16: *"I can't scroll down on
initial open because the DAY / All Games / List view today is so short there's no scrolldown to
perform. When I immediately shift to week and scroll down, there is no navbar popup."*

### The mechanism, with the repo's own measurements

The collapse fires from an `IntersectionObserver` on a zero-height sentinel at
`web/components/CollapsedHeader.js:157-159`, `{ threshold: 0 }`. An IntersectionObserver reports
CROSSINGS, not positions.

1. A navigation runs `land()` at `web/components/AutoScroll.js:134-168`, which calls
   `suppressScrollCollapse()` for the duration of the landing.
2. The landing carries the page past the sentinel. `web/lib/bannerpin.js:7-10` records the measured
   figure: *"week / all games / list lands at scrollY 1050 with `data-hdr` still null and the banner
   still in the document."* The sentinel sits near 340 (`web/app/page.js:797`, immediately after
   `.hubctl`).
3. That crossing is delivered while suppressed and swallowed. The observer's state now sits at
   "not intersecting".
4. Prompt 73's pin keeps the banner VISIBLE through the landing
   (`web/app/globals.css:3314-3318`). It fixed the visual half. The spent crossing is untouched.
5. So the reader's first scroll-down produces no callback at all. Scroll-up re-intersects and the
   machine is one-way, so nothing happens. The second scroll-down is the first real crossing.

`web/components/CollapsedHeader.js:150-156` already describes step 5 and treats it as acceptable:
*"The next one comes when the reader scrolls back up (it intersects again) and then down (it
leaves)."* It was reasoned about and accepted. Joe experiences it as a bug, and his ruling stands.

**Why it looked intermittent:** it needs a landing long enough to clear the sentinel. WEEK always
qualifies at ~1050. DAY on a light slate often does not, and on 2026-09-16 DAY was too short to
scroll at all.

### What to change

`web/lib/bannerpin.js` — `installPinRelease(win)` gains an optional second parameter:

- Capture `win.scrollY` at install time.
- On the one-shot scroll event, release the pin exactly as now, then, if a callback was supplied,
  call it with whether the scroll was DOWNWARD (`win.scrollY > captured`).
- The module must NOT import `collapseHeader`. `web/lib/bannerpin.js:16-23` is explicit that
  *"RELEASE AND COLLAPSE ARE TWO EVENTS AT TWO MOMENTS, and conflating them is the whole hazard."*
  Passing a callback keeps this module owning only the pin and puts the policy where the landing
  context lives.

`web/components/AutoScroll.js` — `listen()` passes a callback that calls `collapseHeader()` when BOTH:

- the scroll was downward, AND
- `document.getElementById(SENTINEL_ID).getBoundingClientRect().top < 0` — the sentinel is already
  above the viewport, so the observer provably cannot fire for this scroll.

### Why that shape, and the three things it protects

- **Scroll still only ever collapses.** `web/lib/headerstate.js:17-21` — *"SCROLL ONLY EVER
  COLLAPSES ... if one is ever added, this file's whole promise is void."* This adds a collapse path,
  never an expand path.
- **The direction check** stops an upward scroll at scrollY 1050 — the natural gesture after a
  landing — from collapsing the banner in the reader's face.
- **The off-screen guard** makes it inert in every currently-working case. When the sentinel is on
  screen the observer owns the collapse and the callback does nothing, so prompts 71 and 73 cannot
  regress.

It addresses `bannerpin.js:16-23` rather than ignoring it: the two events stay separate in the normal
case and join only where the crossing was already spent.

### Tests

`web/test/bannerpin.test.mjs` and `web/test/autoscroll.test.mjs` both exist. Add there, don't create
a new file.

At minimum: the callback fires on a downward scroll and not on an upward one; it is not called at all
when no callback is passed (the existing signature must keep working); and the AutoScroll-side
predicate collapses when the sentinel rect top is negative and does not when it is positive.

**Mutation checks are required on every new assertion.** For each, break the thing it claims to
guard and show the test failing — invert the direction comparison, flip the sentinel sign, drop the
callback — then restore. Report each mutation and its failure. A test that passes against a broken
implementation is not a test.

---

## BLOCK B — the wordmark is half-brightness after a tap-restore

### The measurement

Two screenshots, same iPhone, same install, same minute (8:13), taken 2026-09-16 after a delete-and-
reinstall of the PWA, so both are running prompt 99 rev B. Shot 1: fresh open, nothing tapped. Shot 2:
WEEK, scrolled down, up, down, then the navbar wordmark tapped to restore the banner.

Measured at pixel scale on the two images (723 × 1568):

- **Status band, fresh open:** flat `#282828`, uniform across all 723 columns, no gradient.
- **Status band, tap-restored:** `#020202` at the top with a continuous downward fade.
- **The fade dies out at y≈152 of 1568 — about 90 CSS px from the top of the screen.** The iOS status
  bar is 59 CSS px, so it feathers roughly 30 px BELOW iOS's own bar.
- **Below that line the two shots are identical**, delta 0.0 on every sampled row from y=150 to
  y=320. There is no banner-wide dimming; the artwork, the network logos and the toggles are
  pixel-for-pixel the same.
- **The wordmark sits inside the feather.** MYSPORTS TV glyph rows span y=111–149. Mean gold-glyph
  brightness, tap-restored as a fraction of fresh-open: **0.484** at the top of the capitals, 0.560,
  0.585, 0.634, 0.680, 0.721, 0.768, 0.816, 0.863, **0.894** at the baseline, 1.000 below y≈155.

An earlier, unmatched pair of screenshots gave 92 CSS px and 0.50 → 0.88 over the same span. Two
independent measurement sets agree.

**A correction to yesterday's read.** From the first, unmatched pair I concluded the two shots were
different builds, because a flat gray band and a fading black band looked like two different
`apple-mobile-web-app-status-bar-style` values. This matched pair disproves that: one install
produces BOTH bands, depending only on app state. The status-bar treatment is state-dependent.

### The hypothesis

The only structural difference between the two states is `data-pin`:

- **Fresh open:** `armBannerPin()` has run (`AutoScroll.js:180`) and the reader has not scrolled, so
  `html[data-pin='banner']` is set and `.banner` resolves to `position: sticky; top: 0; z-index: 40`
  (`web/app/globals.css:3314-3318`).
- **Tap-restored:** the reader scrolled, the one-shot release fired, `data-pin` is gone, and
  `.banner` is back to `position: relative`.

A third state agrees: `.chdr` is unconditionally `position: sticky; top: 0; z-index: 40` with an
opaque `var(--spot-2)` and its own safe-area padding (`web/app/globals.css:3173-3180`), and Joe
reports the navbar renders correctly in every screenshot.

So across three observed states, **an element that holds the top edge suppresses iOS 27's scroll-edge
scrim, and ordinary in-flow content under the status bar receives it.** Three consistent data points
is good evidence. It is NOT proof of the mechanism, and this block should be read that way.

### What to change

Re-arm the pin when the wordmark expands the header.

This is Joe's prompt-73 ruling applied to one more entry point, not a new behavior: *"make banner
STICKY until the user scrolls."* After a tap-expand the reader has not scrolled from the restored
position. The pin still releases on their next scroll, the banner still travels, the sentinel still
fires, the height arithmetic is untouched.

**It is explicitly NOT the rejected design.** `web/lib/bannerpin.js:32-35` records: *"REJECTED, AND
RECORDED SO IT IS NOT RE-PROPOSED AS AN IMPROVEMENT: a permanently pinned banner that swaps to the
navbar in place ... a banner that never travels breaks the sentinel that triggers the collapse, the
height arithmetic the landing depends on, and the route back."* This banner still travels. If your
reading of the change is that the banner stops travelling, stop and say so rather than proceeding.

**Wire it in `AutoScroll.js`, not in `CollapsedHeader.js`.** The wordmark handler is
`CollapsedHeader.js:379` (`onClick={() => expandHeader()}`), but `AutoScroll.js:212-218` owns the
single release listener and is explicit that *"there is never more than one."* Arming from the button
would set the attribute with nothing left to release it — which IS the rejected permanent pin. So:
subscribe to `subscribeHeader` inside AutoScroll's existing effect, track the previous value of
`headerCollapsed()`, and on a collapsed → expanded transition run the same `rearm()` + `listen()` pair
the effect already defines.

**THE TIMING HOLE — this will cost a run if it is missed.** `expandHeader()` calls
`window.scrollTo(0, 0)` BEFORE `notify()` (`web/lib/headerstate.js:150-160`). The scroll offset moves
synchronously but its `scroll` event is dispatched at the next rendering opportunity — the exact hazard
`web/lib/bannerpin.js:38-53` documents. A listener installed synchronously in the subscriber will catch
that pending event and release the pin instantly, and the fix will appear not to work. Install one
animation frame later, the way `land()` does at `AutoScroll.js:166`.

### Tests

`web/test/bannerpin.test.mjs`, `web/test/autoscroll.test.mjs`, `web/test/collapsedheader.test.mjs`
all exist. Add to the fitting one.

At minimum: an expand transition arms the pin; a collapse transition does not; and the release
listener installed after an expand survives the `scrollTo(0,0)` that `expandHeader` issues — that
last one is the whole block, so pin it directly rather than by implication.

Mutation checks on every new assertion, same rule as Block A.

### What is in scope and is not

**Not in scope, deliberately:**

- Adding headroom above the wordmark, or moving it down inside the banner box. That is the fallback
  if Block B fails on the phone, and it costs vertical space Joe has spent three prompts reclaiming
  (prompts 46, 50 and 51 each absorbed some of it). Do not pre-emptively take any of it back.
- **Register §48's pre-measured pull-up, `margin-top: calc(-100% * 4.392 / 428)`, is now
  CONTRAINDICATED and must not be applied.** It moves the wordmark 4.4 CSS px UP, deeper into the
  feather. Add a line to §48 recording that the 2026-09-16 measurement reverses it.
- The stale comments in `globals.css` still saying "translucent", "11 stage px" and "flush"
  (around :1960-1962, :1966-1967, :1993-2008, :2003-2004). Still queued, still not this prompt.

---

## COMMITTING

Both blocks commit and push, per rule 7 and register §39, with the `## Committing` stop list in
`CLAUDE.md` unwaived. Block B has to deploy to be testable at all: the PWA runs on Joe's phone against
production, and Vercel is the only compile check that exists.

Record in the commit message that **Block B is provisional pending device confirmation (rule 25)**,
and give Joe the exact single-command revert for Block B alone in your report.

## THE RECORD

- `docs/enhancement-register.md`: a new numbered section for this prompt. Count the existing sections
  and state the count — the last one was §49 and there was no §50. Include the pixel measurements
  above, the correction to the different-builds reading, and the fact that Block B is a hypothesis.
- Amend §48 with the reversal named above.
- `docs/handoff-status.md`: the Repo state line for this prompt, and an open item for Joe's device
  confirmation of Block B.
- File this brief byte-identical to `docs/prompts/101-banner-pin-and-scroll-recovery.md` and update
  the prompts README.
- **Also fix, in the same edit:** `docs/handoff-status.md`'s `## Repo state` still opens *"main, HEAD
  is prompt 66."* HEAD is prompt 101. Every prompt since has appended a `Re-measured … prompt NN` line
  beneath that sentence without touching it. The rest of that paragraph is correct provenance for the
  floors-live-here rule; only the opening clause is stale.

## GATES

All five, each reported as its own command with its own count, and no count may move except where a
block above adds tests:

```
pytest
npm run test:unit
npm run smoke
node scripts/qa-shots.mjs
npm run geometry -- http://localhost:3000
```

`npm run geometry` defaults to port 3001 and must be pointed at the dev server explicitly.

End the report with the five counts, every mutation check and its failure, what is left in the tree,
and the Block B revert command.
