# Banner — composition and mark rules (design session 2026-09-02)

The home page opens on a banner; every other route wears a compact bar cut from the same art. Both
are drawn from one file, [`web/lib/banner-layout.json`](../../web/lib/banner-layout.json), by
[`web/components/Banner.js`](../../web/components/Banner.js). Static references for both breakpoints
are in [`docs/design/banner/`](banner/) — `banner-pc.svg` and `banner-mobile.svg` are what the
component must reproduce, and are the thing to diff against when a change looks wrong.

## The composition is the app icon, widened

The v6-B app icon is a television seen head-on. The banner is that same idea pulled apart until it
fills a page: the TV stays in the middle, and everything the app is *about* arranges itself around
it. Read top to bottom it is four bands.

| Band | PC | Phone | What it carries |
|---|---|---|---|
| Title | title baseline y 60, subhead y 94 | y 46 / y 72 | `MYSPORTS TV`, then the subhead |
| League ring | cy 124–240, around the set | cy 122–206 | The leagues, ringing the TV |
| TV centre | cx 700, cy 193, h 172 | cx 195, cy 184, h 128 | The cutout itself |
| Network band | the outer field, cx 111–1286 | one row, cy ~256 | Networks and programs |

The **stage** is 1400×280 on PC and 390×280 on the phone. Both are `viewBox` units, not pixels: the
SVG scales to the container width (`max-width:1400px` on PC), so every number in the layout JSON is
resolution-independent and the phone banner is a genuinely different composition rather than the
desktop one shrunk — 10 marks instead of 23, a taller TV relative to the stage, and its own spark
placement. At 390px wide the banner measures 281px tall, inside the 300px cap.

Marks are placed by **centre** (`cx`, `cy`) and **height** (`h`), never by corner. Width comes from
`ar`, the PNG's own width/height, so a re-cropped source moves nothing but its own edges. The
component turns that into `x = cx - w/2`, `y = cy - h/2`.

## Three classes of mark, sized by three different rules

**Leagues — 256px, raw and `_dark`.** A league mark renders at its natural `h`. It is deliberately
**not** ink-normalized: the NFL shield and the NASCAR wordmark are supposed to look like a shield and
a wordmark, and equalizing their ink would shrink the shield to match a bar of type. Both variants
ship for every league because the same art appears on light and dark ground elsewhere in the app;
the banner draws the `_dark` set.

**Programs — 128px, ink-normalized.** A program logo sits directly beside network marks in the
banner, so it is scaled by the same `hf` factor they are: `hf = clamp(sqrt(TARGET/ink_area), 0.62,
1.15)`. The **TARGET is read from the frozen network manifest, never recomputed** — see
[`scripts/build_brand_marks.py`](../../scripts/build_brand_marks.py). Normalizing the two programs
against each other would have made them weigh the same as *each other*, which is not the invariant
anyone wants; weighing them against the network suite is. `web/public/marks/` is never rewritten by
the program build.

**The TV — one 700px cutout**, untrimmed. Its transparent margin is part of the frame the layout was
measured against; trimming it moves the ink 0.69% and shifts every coordinate that references it.

## The three contrast rulings

Charcoal is a hostile ground for a logo, and the general rule — `dark_ready`, which derives a
gray/black mark to white — is wrong often enough that three marks needed a decision of their own.
Together they say: **lift a mark only when its darkness is an accident, never when it is the design.**

- **NHL — a dark mark that stays dark.** Its luminance barely moves between variants (raw 106.6,
  dark 107.0). The shield reads by its white rim, not by its body, so lifting the body would destroy
  the outline that identifies it while solving nothing.
- **ESPN — colour is identity.** A genuinely coloured mark (more than 8% of visible pixels) is left
  RAW even when it measures dark, because the brand colour is the thing that names it. Brightening
  ESPN's red toward legibility produces a colour that is legible and no longer ESPN.
- **ABC — black is background, not ink.** A black roundel carrying a white ring and white letters.
  `dark_ready` reads that disc as a dark mark and inverts it into a **white plate with grey letters**
  — the plate the no-plate rule forbids outright. Raw, the disc simply disappears into the charcoal
  and the ring and letters read exactly as drawn. The same reasoning carries the College GameDay
  shield and the IndyCar plate.

## Four surfaces every mark has to survive

A mark is not judged on one background, because it does not appear on one. Each of these is defined
in the repo, so a candidate can be checked rather than argued about:

1. **The banner's charcoal radial** — `radial-gradient(90% 130% at 50% 10%, #3B3B3B, #262626, #161616)`
   in [`banner-and-navbar.css`](banner/banner-and-navbar.css). The default case, and the darkest.
2. **The TV's colour bars** — marks in the league ring sit beside, and the sparks over, a saturated
   test pattern. A mark tuned only against flat charcoal can fail here.
3. **The listings cap gradients** — team-tinted `0.86 → 0.58` caps, per
   [`docs/rendering-contract-mobile.md`](../rendering-contract-mobile.md) M13. League marks reappear
   on these in the cards.
4. **The navbar's linear gradient** — `#2A2A2A → #1C1C1C`, a lighter and flatter ground than the
   banner, where the wordmark and TV cutout are re-used at 44px (34px on a phone).

## Rebuilding the art

`python scripts/build_brand_marks.py` rebuilds all three classes and both manifests;
`--only leagues|programs|tv` narrows it, and `--check` rebuilds into a temp directory and diffs
against what is committed. The check's contract is **identical pixel dimensions and ink area within
1%** — not identical bytes, since PNG encoders differ between machines and a byte comparison would
fail for reasons that have nothing to do with the art. As of 2026-09-02 it reports 22 of 23 PASS;
the exception is `programs/big-noon-kickoff.png`, whose committed file carries ~1.1% more ink than a
faithful re-rasterization of its SVG at any height. Dimensions match, so the layout is unaffected.
