# Prompt 84 — Block E does not commit yet: the render is stale, and nothing pinned the runtime

**Do not commit Block E.** The code is right. The artifact from Block E's own gate run shows the old
banner, and no test could have noticed.

## What Cowork measured, on your machine, before writing this

- `web/qa/p83final/mobile__today-all.png` is **byte-identical** to `web/qa/p83/mobile__today-all.png`
  — sha256 prefix `df1656e4f93d77b5` on both. p83 is the pre-banner run. A change that repaints the
  top 124px of every page cannot leave that file unchanged.
- Opened, at pixel scale: the TV in that shot is still **lit with the colour test pattern**, and the
  faint rounded ring around the set is still there. That is `tv-cutout.png` and the old glow stops.
- The source is correct, so this is not a coding defect. `BannerMobileV2.jsx` and
  `BannerDesktopV2.jsx` both reference `tv-cutout-dark.png`; both carry `bnTitleHalo` / `bdTitleHalo`
  with `fill="#000000"`; and `web/public/banner/tv-cutout-dark.png` really is the blacked-out set
  (opened and composited — the screen is black, the cabinet is untouched).

**Most likely cause: the `.next` poisoning you found.** Your own remedy applies — stop the dev
server, `Remove-Item -Recurse -Force web/.next`, restart. The qa-shots run almost certainly hit a
bundle compiled before the regeneration. Confirm that rather than assuming it; if the cause turns out
to be something else, that is the more important finding.

## Why nothing caught it — rule 24, almost verbatim

The six new tests are in `tests/test_banner_generator.py`: **Python, reading JSX as text.** Rule 24
says a count computed on the Python side is no evidence the JS runtime agrees, and that the runtime
path must be pinned. Every banner assertion in this block lives on the source side. That is why five
gates went green — 96/96 included — while the served page rendered the previous banner.

Keep those tests. They are a good first layer. They are not the layer that was missing.

## What to do

1. **Clear and re-render.** Stop the dev server, delete `web/.next`, restart, re-run `qa-shots`.
2. **Assert the shot changed.** The cheapest guard that would have caught this: fail if
   `mobile__today-all.png` comes back byte-identical to `web/qa/p83/mobile__today-all.png`. Run it
   once as a check, then decide whether it belongs in the gate permanently — a page shot that never
   changes across a visual change is a signal, and this repo did not have one.
3. **Do E5.5, which was never reported.** Read the **rendered** SVG off the served route, not the
   file: `<image href>` is `/banner/tv-cutout-dark.png`; the halo text is `fill="#000000"` under
   `#bnTitleHalo` / `#bdTitleHalo`; each of the four glow gradients has five stops ending at 0.
   Report the strings you read, not a summary of them.
4. **Pin the runtime path (rule 24).** Move those three facts into `qa-shots`' assertions, read from
   the served DOM at both breakpoints. Mutation-check them — the six Python tests were never
   mutation-checked either, and prompt 83 asked for that.
5. **Render the banner so Joe can see it.** Block E is entirely a visual change — a dark halo, a
   blacked-out screen, a removed ring — and no one has looked at the result. Crop the banner at both
   breakpoints, plus a before/after pair against the p83 shot for the ring specifically, since a
   3.53/255 re-taper is the kind of thing that is easy to claim and hard to see.

Then all five gates again, as their own commands, and stop with the work in the tree.
**Still do not commit and do not push** until Joe has seen the banner.

## One question about the gates

You caught yourself reading a gate's result through `| tail -4` and called it correctly — that is
rule 26 inside a gate. Say which gate that was, and confirm how the other four were read on the final
run. If `qa-shots`' 96/96 came through a pipe, that number needs re-reading too. `NODE EXIT=0` in the
report suggests it did not, but say so explicitly.

## What is settled and is not in scope here

- **D2 is committed (`f9c9a1e`) and pushed** — `main` and `origin/main` agree.
- **The off-service mark survives the dim.** The shot answers it: the gold frame is still a frame,
  dimmed and pulled toward olive by `saturate(.7)`, but plainly distinct from an unmarked card's
  hairline. Ships as-is; no rule needed.
- **The removed-test accounting is properly recorded** at `docs/handoff-status.md:75–98`, with the
  three removed tests named and the exception invoked out loud.
- **`tv-cutout-dark.png` is staged** and `assets/` staged zero files.
- **The three findings beyond the brief were all correct.** `title.glow` holding the generator's
  actual parameters rather than only prose was a real gap in prompt 81 — Cowork caught the
  description layer and missed the data layer beneath it. Both `BannerDesktopV2.jsx` and `Banner.js`
  naming a generator this repo does not contain is rule 33, found without being pointed at.
