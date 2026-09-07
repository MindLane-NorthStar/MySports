#!/usr/bin/env python3
"""Generate web/components/BannerMobileV2.jsx from web/lib/banner-mobile-v2.json.

    python scripts/build_banner_mobile.py            # write the component
    python scripts/build_banner_mobile.py --check    # exit 1 if the committed file has drifted

WHY THIS EXISTS. `web/components/Banner.js:5-7` has said since prompt 42 that the JSON files "ship
as DOCUMENTATION of the same values", that "nothing reads them at build time", and that "if the
design moves, the JSON changes and the component is regenerated from it - coordinates are never
hand-edited here."

THE TOOL THAT DID THAT REGENERATION WAS NOT IN THE REPOSITORY, OR ANYWHERE ELSE REACHABLE. Nothing
under scripts/, pipeline/ or tests/ read `banner-mobile-v2`; the only references were docs, Banner.js,
the JSX and the JSON itself. So the repo held a generated file whose generator nobody had, and a
comment forbidding the only edit anyone could actually make. Prompt 57 stage 6 closes that.

WHAT THE JSON ALREADY CARRIED, and it was more than the brief expected: `stage` IS the viewBox
(w/h), and `background.stops`, `glow[]`, `title.fill_gradient_top_to_bottom`, `title.glow`,
`tagline`, `tv` and all 23 `marks` were fully specified. Only two things were prose-only and had to
be added - `headroom_paint.rect` (the ground rect prompt 45 draws from y=-90) and `filters.svg` (the
two drop-shadow filters' numbers). There is deliberately NO separate `viewBox` key: `stage` is
already that fact, and a second copy of a fact is a second thing to get wrong.

NUMBER FORMATTING IS THE JSON'S OWN. `str()` on a parsed value reproduces `36.0` as "36.0" and `84`
as "84", which is exactly how the hand-generated file wrote them - so a float stays a float and an
int stays an int without a formatting rule of this script's own invention.

THE GLOW TRANSFORM IS EXACT, NOT ROUNDED. The committed file carries
`scale(1,0.73913043478260869565)`, which is ry/rx to twenty decimal places; float division gives
sixteen. `decimal` reproduces the literal digit for digit, so regenerating changes no number at all.
"""
from __future__ import annotations

import argparse
import io
import json
import sys
from decimal import Decimal, getcontext
from pathlib import Path

getcontext().prec = 40

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "web" / "lib" / "banner-mobile-v2.json"
OUT = ROOT / "web" / "components" / "BannerMobileV2.jsx"

FONT = ("'Barlow Condensed', 'Barlow Condensed Fallback', Impact, sans-serif")

# The file's own preamble. It is documentation of two rulings (prompt 45's safe-area band and why
# the glows keep their tails) and must survive regeneration, so it lives here rather than being
# reconstructed from the JSON's prose.
HEADER = """// MySports TV — home banner v2, PHONE breakpoint. GENERATED from banner-mobile-v2.json by
// scripts/build_banner_mobile.py. Do not hand-edit: edit the JSON and regenerate.
// Stage {w}x{h}, scales to the container width. Assets live in web/public/banner/.
//
// PROMPT 45 - THE ARTWORK PAINTS THE SAFE-AREA BAND. Installed on iOS the web view runs under the
// status bar and .banner pads itself by env(safe-area-inset-top). That band used to be .banner's
// flat CSS gradient while the stage below it started with its own ground AND its two warm glows -
// a step of 8.7/255 under the wordmark and 10.7/255 under the TV, which is the seam Joe reported on
// 2026-09-04. The fix is overflow:visible plus a ground rect that starts above the stage, so the
// stage's own paint fills the band and there is no boundary to see.
//
// WHICH IS WHY THE THREE GRADIENTS ARE userSpaceOnUse. They were objectBoundingBox (the default),
// which defines a gradient on the unit square of the shape it fills - so growing the ground rect
// would have stretched its gradient with it and moved every pixel of the visible stage. Pinned to
// stage coordinates instead, the rect can grow and the paint cannot move. The conversion arithmetic
// is artifacts/qa/2026-09-05-banner-seam/gradient-convert.py.
//
// THE GLOWS' OUTER STOPS ARE LEFT AS DESIGNED (0.021 / 0.028, not 0). They make the ellipse
// boundary a faint hard edge, which overflow:visible exposes in the band as a 3.4/255 line above
// the stage. Fading them to zero removes it, and was measured: it also repaints the annulus between
// the 82% and 100% rings, changing 10.6% of the visible stage by up to 6/255. That is a far bigger
// change to the artwork than the artifact is worth, so the tails stay.
//"""


def n(v) -> str:
    """A JSON number as the JSON wrote it - 36.0 stays "36.0", 84 stays "84"."""
    return str(v)


def _offset(pct: str) -> str:
    """"45%" -> ".45". The LINEAR gradients were written in SVG's decimal shorthand and the RADIAL
    ones in percentages; both are legal and identical to a rasteriser, and reproducing each as it
    was written is what keeps regeneration a no-op instead of a diff nobody can review."""
    v = float(pct.rstrip("%")) / 100
    if v == 0:
        return "0"
    if v == 1:
        return "1"
    return f"{v:g}".lstrip("0")


def _stops(pairs, attr="stopColor"):
    return "".join(f'<stop offset="{_offset(o)}" {attr}="{c}"/>' for o, c in pairs)


def build(d: dict) -> str:
    w, h = d["stage"]["w"], d["stage"]["h"]
    bg, glows, title, tag, tv = d["background"], d["glow"], d["title"], d["tagline"], d["tv"]
    rect, filt = d["headroom_paint"]["rect"], d["filters"]["svg"]
    # The ground rect's height follows the stage: overhang above, stage below. The JSON records the
    # value it had when this was written; the derivation is what keeps them together.
    overhang = -rect["y"]
    rect_h = overhang + h

    L = [HEADER.format(w=w, h=h), "export default function BannerMobileV2() {", "  return ("]
    L.append(f'    <svg viewBox="0 0 {n(w)} {n(h)}" width="100%" role="img" aria-labelledby="bnTitle"'
             f' overflow="visible" style={{{{ display: "block" }}}}>')
    # The accessible name is prose, not geometry, and is the one string here that is not derived:
    # it reads as a sentence rather than as the tagline's shouted caps.
    L.append('    <title id="bnTitle">MySports TV. Every game. Every channel. One place.</title>')
    L.append("    <defs>")
    # the ground: pinned to stage coordinates so the rect can grow without moving the paint
    L.append(f'    <linearGradient id="bnBg" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0"'
             f' y2="{n(h)}">{_stops(bg["stops"])}'
             f'</linearGradient>')
    for i, g in enumerate(glows):
        aspect = (Decimal(g["ry"]) / Decimal(g["rx"])).quantize(Decimal("1e-20"))
        stops = "".join(
            f'<stop offset="{o}" stopColor="{g["color"]}" stopOpacity="{a}"/>' for o, a in g["alpha_stops"])
        L.append(f'    <radialGradient id="bnGlow{i}" gradientUnits="userSpaceOnUse" cx="{n(g["cx"])}"'
                 f' cy="{n(g["cy"])}" r="{n(g["rx"])}" gradientTransform="translate({n(g["cx"])},{n(g["cy"])})'
                 f' scale(1,{aspect}) translate(-{n(g["cx"])},-{n(g["cy"])})">{stops}</radialGradient>')
    L.append(f'    <linearGradient id="bnGold" x1="0" y1="0" x2="0" y2="1">'
             f'{_stops(title["fill_gradient_top_to_bottom"])}'
             f'</linearGradient>')
    L.append(f'    <filter id="bnTitleGlow" x="-20%" y="-100%" width="140%" height="300%">'
             f'<feGaussianBlur stdDeviation="{n(title["glow"]["blur_std_dev"])}"/></filter>')
    m, r = filt["mark"], filt["mark"]["region"]
    L.append(f'    <filter id="bnMark" x="{r["x"]}" y="{r["y"]}" width="{r["width"]}" height="{r["height"]}">'
             f'<feDropShadow dx="{n(m["halo"]["dx"])}" dy="{n(m["halo"]["dy"])}" stdDeviation="{n(m["halo"]["stdDeviation"])}"'
             f' floodColor="{m["halo"]["color"]}" floodOpacity="{m["halo"]["opacity"]}" result="halo"/>'
             f'<feDropShadow in="halo" dx="{n(m["drop"]["dx"])}" dy="{n(m["drop"]["dy"])}"'
             f' stdDeviation="{n(m["drop"]["stdDeviation"])}" floodColor="{m["drop"]["color"]}"'
             f' floodOpacity="{m["drop"]["opacity"]}"/></filter>')
    t, r = filt["tv"], filt["tv"]["region"]
    L.append(f'    <filter id="bnTv" x="{r["x"]}" y="{r["y"]}" width="{r["width"]}" height="{r["height"]}">'
             f'<feDropShadow dx="{n(t["drop"]["dx"])}" dy="{n(t["drop"]["dy"])}" stdDeviation="{n(t["drop"]["stdDeviation"])}"'
             f' floodColor="{t["drop"]["color"]}" floodOpacity="{t["drop"]["opacity"]}" result="s"/>'
             f'<feDropShadow in="s" dx="{n(t["halo"]["dx"])}" dy="{n(t["halo"]["dy"])}"'
             f' stdDeviation="{n(t["halo"]["stdDeviation"])}" floodColor="{t["halo"]["color"]}"'
             f' floodOpacity="{t["halo"]["opacity"]}"/></filter>')
    L.append("    </defs>")
    L.append(f'    <rect x="{n(rect["x"])}" y="{n(rect["y"])}" width="{n(rect["w"])}" height="{n(rect_h)}" fill="url(#bnBg)"/>')
    for i, g in enumerate(glows):
        L.append(f'    <ellipse cx="{n(g["cx"])}" cy="{n(g["cy"])}" rx="{n(g["rx"])}" ry="{n(g["ry"])}" fill="url(#bnGlow{i})"/>')
    L.append(f'    <image href="/banner/{tv["file"]}" x="{n(tv["x"])}" y="{n(tv["y"])}" width="{n(tv["w"])}"'
             f' height="{n(tv["h"])}" preserveAspectRatio="xMidYMid meet" filter="url(#bnTv)"/>')
    for mk in d["marks"]:
        L.append(f'    <image href="/banner/{mk["file"]}" x="{n(mk["x"])}" y="{n(mk["y"])}" width="{n(mk["w"])}"'
                 f' height="{n(mk["h"])}" preserveAspectRatio="xMidYMid meet" filter="url(#bnMark)"/>')
    ttl = (f'x="{n(title["x"])}" y="{n(title["baseline_y"])}" fontFamily="{FONT}" fontWeight="700"'
           f' fontSize="{n(title["font_size"])}" letterSpacing="{n(title["letter_spacing_px"])}"')
    L.append(f'    <text {ttl} fill="{title["glow"]["fill"]}" opacity="{str(title["glow"]["opacity"]).lstrip("0")}"'
             f' filter="url(#bnTitleGlow)">{title["text"]}</text>')
    L.append(f'    <text {ttl} fill="url(#bnGold)">{title["text"]}</text>')
    L.append(f'    <text x="{n(tag["x"])}" y="{n(tag["baseline_y"])}" fontFamily="{FONT}" fontWeight="600"'
             f' fontSize="{n(tag["font_size"])}" letterSpacing="{n(tag["letter_spacing_px"])}"'
             f' fill="{tag["fill"]}">{tag["text"]}</text>')
    L.append("    </svg>")
    L.append("  );")
    L.append("}")
    return "\n".join(L) + "\n"


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true", help="exit 1 if the committed file has drifted")
    args = ap.parse_args(argv)
    out = build(json.loads(SRC.read_text(encoding="utf-8")))
    if args.check:
        cur = OUT.read_text(encoding="utf-8")
        if cur != out:
            print(f"DRIFT: {OUT.relative_to(ROOT)} is not what the JSON generates", file=sys.stderr)
            return 1
        print(f"{OUT.relative_to(ROOT)} matches the JSON")
        return 0
    # rule 29: a writer that can reach a tracked file writes LF, never the platform separator.
    io.open(OUT, "w", encoding="utf-8", newline="\n").write(out)
    print(f"wrote {OUT.relative_to(ROOT)} ({len(out.splitlines())} lines) from {SRC.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
