# Claude Code — Prompt 26: the grid zoom fix and the iOS standalone gaps

**Repo:** `C:\Users\jlull\Joe's Projects\Apps - Personal\MySports` · **main**

**Run this only after prompt 25 has reported and pushed.** Preconditions: `HEAD == origin/main`, tree clean apart from untracked `assets/` and `artifacts/`, and all four gates green at whatever prompt 25 left them.

**Why this is its own prompt.** Stage 1 is a behavioural change to a locked component (Mobile Grid Addendum **M6**) and stage 2 changes how the installed app paints. Prompt 24 was split from 25 for exactly this reason: mixing a behavioural fix with a visual pass in one unattended run means a mid-run hard stop leaves it unclear which half landed.

**Authority:** `docs/rendering-contract-mobile.md` Addendum v1.1 (M1, M4, M6, M7, M9), `docs/handoff-status.md` working rules 1–22, `claude/audit-triage-2026-09-03.md` §6 items 1 and 3.

**Working rule 22 applies throughout:** before asserting what a component does, open it and cite file and line. Every citation below was taken at `10efae7`; if prompt 25 moved a line, re-locate it rather than trusting the number.

---

## Stage 1 — the mobile grid clips under pinch-zoom

### The defect, and why nine months of QA never saw it

`web/components/MobileGrid.js:248`:

```js
style={{ transform: `scale(${zoom})`, width: `calc(var(--rail-w) + ${scale.width}px)` }}
```

with `.mgrid-canvas { transform-origin: 0 0 }` (`web/app/globals.css:743`) inside `.mgrid-scroll { overflow-x: auto; overflow-y: hidden }` (`:735`), and `zoom` clamped to `[0.6, 2.5]` at `MobileGrid.js:192`.

A CSS `transform` **paints** at the new size but does not participate in **layout**. The canvas keeps its unzoomed border box, so `.mgrid-scroll` computes `scrollWidth` from the unzoomed width. At `zoom = 2.5` the canvas paints 2.5× wider than the scrollable extent, so roughly **60% of the schedule is drawn outside the scroller and cannot be reached by panning** — it is clipped at the right edge. Height is wrong the same way, against `overflow-y: hidden`. Below 1.0 the inverse: dead scroll range past the end of the content.

At `zoom = 1` — the default, and the only value any Playwright shot has ever used — there is no symptom. That is why the qa-shots suite is green and the defect is real.

**Addendum M6 promises pinch-to-zoom with the rail pinned at every zoom level. What ships is a zoom that makes the right of the schedule unreachable.** This is a contract violation, in the same sense prompt 22's nine findings were: the shipped app has drifted from what the addendum says, not the other way round.

Prompt 25 stage 7c measured `scrollWidth`, `clientWidth` and the canvas rect at 0.6 / 1 / 2.5. **Start from those numbers.** If they contradict the analysis above, stop and report rather than implementing a fix for a defect that is not there — this is the prompt-22-stage-4 discipline, and last time it correctly stopped a change.

### The fix

Wrap the canvas in a sizer whose **layout** dimensions carry the zoom, and leave the transform to do the painting:

- a `.mgrid-sizer` element between `.mgrid-scroll` and `.mgrid-canvas`, sized `width: (rail-w + scale.width) * zoom` and `height: naturalHeight * zoom`;
- `.mgrid-canvas` keeps `transform: scale(zoom)` and `transform-origin: 0 0` and keeps its **natural** width, so the paint and the layout agree.

Do not reach for the non-standard `zoom` property, and do not multiply the natural width by zoom on the canvas itself — that double-counts.

**The rail must survive.** `.mrail-cell, .mgrid-axis-rail { position: sticky; left: 0 }` (`globals.css:749`) is M4, and it is load-bearing. Inserting an element between the scroller and the sticky element's containing block is exactly the change that breaks sticky positioning. **Verify the rail is still pinned at 0.6, 1.0 and 2.5** before you commit, and if the sizer breaks it, report the trade-off rather than choosing between M4 and M6 on your own.

### The test

`web/test/` — add one that pins the **invariant**, not a number (rule 19's lesson: pin the call site, not a row count):

> for every zoom in {0.6, 1.0, 2.5}, the scroller's scrollable width equals the canvas's painted width within 1 px.

A DOM-less unit test over the sizing function is fine and preferred — extract the sizing arithmetic into a pure function of `(railW, scaleWidth, naturalHeight, zoom)` if it is not already separable, and pin that. If the arithmetic can only be observed in the DOM, say so and add the assertion to `qa-shots.mjs` instead, at all three zoom levels.

### Acceptance

- `scrollWidth` tracks `zoom` at 0.6, 1.0 and 2.5 — report the numbers against prompt 25's stage 7c baseline.
- The rail is pinned at 0 at all three.
- The last program of the day is reachable by panning at `zoom = 2.5` on `/?sport=cfb&day=2026-09-05` at 390 px. Screenshot the right edge.
- No vertical clipping introduced by the height change against `overflow-y: hidden`.
- No page-level horizontal scrollbar at any zoom.
- Existing grid tests still pass, `gridnote.test.mjs` included.

---

## Stage 2 — the iOS standalone gaps

The PWA is built and correct as far as it goes: `web/app/manifest.js` (`display: 'standalone'`, `theme_color` and `background_color` both `#1b1b1b`, 192 and 512 icons), `web/app/apple-icon.png`, and `appleWebApp: { title: 'MySports TV' }` at `web/app/layout.js:14`. **Do not redesign any of that.** Two things are missing.

### 2a. The status bar

`appleWebApp` carries only `title`, so Next never emits `apple-mobile-web-app-status-bar-style` and iOS falls back to `default` — an opaque light bar above a `#1b1b1b` app. Set `appleWebApp: { title: 'MySports TV', statusBarStyle: 'black-translucent' }`.

`black-translucent` makes the web view extend **under** the status bar, which is why it pairs with 2b and must not ship without it. If 2b cannot be made to work, use `'black'` instead and say so — `'black'` gives a dark opaque bar with no layout consequence.

### 2b. Safe-area insets

Verified absent at `10efae7`: zero occurrences of `env(safe-area-inset` or `viewport-fit` anywhere in `web/app` or `web/components`.

- Add a `viewport` export to `web/app/layout.js` with `viewportFit: 'cover'` (Next's App Router `viewport` convention — do **not** hand-write a `<meta name="viewport">`; the same file-convention reasoning already recorded in the comment at `layout.js:9–13` about `apple-touch-icon` applies here).
- Apply `env(safe-area-inset-left/right)` to `.shell`'s horizontal padding and `env(safe-area-inset-bottom)` to its bottom padding, each with a `0px` fallback so nothing changes in a normal browser.
- The **banner is meant to bleed full width** — that is why `Chrome` renders outside `.shell` (`layout.js:22–26`). Give `.banner` top padding of `env(safe-area-inset-top)` so its content clears the status bar while its background still reaches the top edge. That is the whole point of `black-translucent`.
- `.mgrid-scroll` is a horizontal scroller: check it against the left/right insets in landscape and add inset padding only if content actually lands under the notch.

### Acceptance

Report the rendered `<meta>` tags. Then, because Playwright at 390 px is Chromium and not iOS Safari, **state plainly that this stage cannot be self-verified** and list exactly what Joe should check on his phone with the app installed from the Home Screen:

1. the status bar text is legible over the banner at the top of the Today page;
2. the banner's background reaches the very top of the screen with no light bar;
3. nothing is clipped by the home indicator at the bottom of a long scroll;
4. in landscape, no content sits under the notch on either side.

**Joe's phone is the authority here** — that is the standing mobile caveat and it applies to this stage more than to anything else in the app.

---

## Stage 3 — report

Per stage: what changed, the commit sha, the acceptance evidence, every judgment call.

- Stage 1: the before/after sizing table at all three zoom levels; the rail-pinned evidence; the right-edge screenshot at `zoom = 2.5`; the new test and what invariant it pins.
- Stage 2: the rendered meta tags, the CSS added, and the four-item phone checklist above, stated as unverified-by-you.
- Gates before and after.
- Whether Addendum M6 now needs a wording change to record that the canvas paints through a sizer. If it does, **report the proposed wording — do not edit the addendum.** Contract edits are Cowork's.

---

## Explicitly out of scope

- Anything in `pipeline/`, `adapters/` or the database.
- The M1 80% scale, M2 time compression, M4 rail geometry and M7 TBD cards — this prompt fixes how zoom is *sized*, and changes no other addendum rule.
- Everything carried by prompt 25.
- Service workers and offline caching. `manifest.js` has none and none is wanted: the audit that raised the PWA question said it itself, and live scores are the reason — an overlay cached offline would show yesterday's game as live.
