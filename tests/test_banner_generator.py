#!/usr/bin/env python3
"""The mobile banner component is GENERATED, and this proves the committed file still is.

    python -m unittest tests.test_banner_generator -v    # from the repo root; stdlib only

`web/components/Banner.js:5-7` has said since prompt 42 that coordinates are "never hand-edited
here" and that the component "is regenerated from" the JSON. THE GENERATOR DID NOT EXIST - not in
scripts/, not in pipeline/, not anywhere reachable. The repo held a generated file whose generator
nobody had, and a comment forbidding the only edit anyone could actually make. Prompt 57 stage 6
wrote `scripts/build_banner_mobile.py`; this is what stops the two drifting apart again.

WHAT MAKES THIS A REAL GUARD RATHER THAN A CEREMONY: the generator was proved against the
hand-generated file BEFORE anything moved. Built from the unmodified JSON it reproduced the
committed component byte-for-byte below the header comment - same viewBox, same 24 images, same
rect, same two ellipses, same gradient stops and ids, same filter primitives, same three text
baselines. Only the header prose changed, deliberately, to name the generator.
"""
from __future__ import annotations

import json
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "build_banner_mobile.py"
JSON_SRC = ROOT / "web" / "lib" / "banner-mobile-v2.json"
JSX = ROOT / "web" / "components" / "BannerMobileV2.jsx"

sys.path.insert(0, str(ROOT / "scripts"))
from build_banner_mobile import build  # noqa: E402


class TheGeneratorAndTheComponentAgree(unittest.TestCase):
    def test_the_committed_component_is_exactly_what_the_json_generates(self):
        want = build(json.loads(JSON_SRC.read_text(encoding="utf-8")))
        got = JSX.read_text(encoding="utf-8")
        self.assertEqual(got, want,
                         "BannerMobileV2.jsx has drifted from banner-mobile-v2.json - edit the JSON "
                         "and run `python scripts/build_banner_mobile.py`, never the JSX")

    def test_the_check_flag_agrees_and_is_usable_from_a_shell(self):
        r = subprocess.run([sys.executable, str(SCRIPT), "--check"], capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stderr)

    def test_the_component_is_written_LF(self):
        # Rule 29: a writer that can reach a tracked file writes LF, never the platform separator.
        self.assertNotIn(b"\r\n", JSX.read_bytes())


class TheJsonCanExpressTheWholeDesign(unittest.TestCase):
    """The point of the generator is that the JSON is the source of record. If a fact the component
    needs is missing from the JSON, the generator has to invent it and the JSON stops being that."""

    def test_the_stage_is_the_viewbox(self):
        # There is deliberately no separate `viewBox` key - `stage` already IS that fact, and a
        # second copy of a fact is a second thing to get wrong.
        d = json.loads(JSON_SRC.read_text(encoding="utf-8"))
        self.assertIn("w", d["stage"])
        self.assertIn("h", d["stage"])
        self.assertIn(f'viewBox="0 0 {d["stage"]["w"]} {d["stage"]["h"]}"', JSX.read_text(encoding="utf-8"))

    def test_the_two_prose_only_facts_are_now_numbers(self):
        d = json.loads(JSON_SRC.read_text(encoding="utf-8"))
        rect = d["headroom_paint"]["rect"]
        for k in ("x", "y", "w", "h"):
            self.assertIn(k, rect, "the ground rect's geometry was prose only until prompt 57")
        for which in ("mark", "tv"):
            self.assertIn(which, d["filters"]["svg"])

    def test_the_ground_rect_follows_the_stage_height(self):
        # h = overhang + stage.h, derived rather than restated, so changing the stage cannot leave
        # the safe-area ground behind - which is exactly what model F changes.
        d = json.loads(JSON_SRC.read_text(encoding="utf-8"))
        overhang = -d["headroom_paint"]["rect"]["y"]
        expected = overhang + d["stage"]["h"]
        self.assertIn(f'height="{expected}" fill="url(#bnBg)"', JSX.read_text(encoding="utf-8"))

    def test_every_mark_in_the_json_reaches_the_component(self):
        d = json.loads(JSON_SRC.read_text(encoding="utf-8"))
        jsx = JSX.read_text(encoding="utf-8")
        self.assertEqual(len(d["marks"]), 23, "15 network marks + 8 league marks")
        for m in d["marks"]:
            self.assertIn(f'href="/banner/{m["file"]}"', jsx, f'{m["id"]} is missing from the component')
        self.assertIn(f'href="/banner/{d["tv"]["file"]}"', jsx)
        self.assertEqual(jsx.count("<image "), 24, "23 marks plus the TV cutout")


DESKTOP_JSON = ROOT / "web" / "lib" / "banner-desktop-v2.json"
DESKTOP_JSX = ROOT / "web" / "components" / "BannerDesktopV2.jsx"


class TheDesktopBannerIsTranscribed(unittest.TestCase):
    """THERE IS NO DESKTOP GENERATOR, and that is the whole reason this class exists.

    `scripts/` holds `build_banner_mobile.py` and nothing for the 1400x200 breakpoint, so
    BannerDesktopV2.jsx is hand-written and transcribed from banner-desktop-v2.json by a person. The
    class above is a byte-for-byte guard because a program writes the file it checks; this one cannot
    be, because nothing generates the file. What it CAN do is pin every value that was transcribed,
    so a slip in the transcription fails here rather than shipping.

    Prompt 81 block E is why: it changed four lines by hand in a file whose own header said
    "regenerate from the JSON if the design changes", naming a tool the repo does not contain. That
    header now says the opposite; this is the guard that makes the new instruction enforceable.

    DELIBERATELY NOT CHECKED: the mark, stage and cutout COORDINATES. They came out of prompt 42's
    layout pass, no later prompt has moved one, and asserting 23 boxes here would only restate the
    JSON without protecting anything a reader would get wrong.
    """

    def setUp(self):
        self.d = json.loads(DESKTOP_JSON.read_text(encoding="utf-8"))
        self.jsx = DESKTOP_JSX.read_text(encoding="utf-8")

    def test_the_television_is_the_file_the_json_names(self):
        self.assertIn(f'href="/banner/{self.d["tv"]["file"]}"', self.jsx)
        self.assertNotIn("/banner/tv-cutout.png", self.jsx,
                         "the lit set stays in web/public as the way back, and unreferenced")

    def test_both_glows_carry_exactly_the_stops_the_json_lists(self):
        # Including the last one. The tails used to end at 0.021 / 0.028 and prompt 81 block E4
        # re-tapered them to zero; ending at a non-zero alpha is what painted the faint ring.
        for i, g in enumerate(self.d["glow"]):
            stops = "".join(
                f'<stop offset="{o}" stopColor="{g["color"]}" stopOpacity="{a}"/>'
                for o, a in g["alpha_stops"])
            self.assertIn(f'<radialGradient id="bdGlow{i}"', self.jsx)
            self.assertIn(stops, self.jsx, f"bdGlow{i} does not carry the JSON's stop list")
            self.assertEqual(g["alpha_stops"][-1][1], 0, "the outer stop must reach zero")

    def test_the_title_halo_is_the_two_pass_dark_one_at_the_desktop_radii(self):
        h = self.d["title"]["halo"]
        r = h["region"]
        want = (f'<filter id="bdTitleHalo" x="{r["x"]}" y="{r["y"]}" width="{r["width"]}"'
                f' height="{r["height"]}" colorInterpolationFilters="sRGB">'
                f'<feGaussianBlur in="SourceAlpha" stdDeviation="{h["wide"]["std_dev"]}" result="w"/>'
                f'<feComponentTransfer in="w" result="wide">'
                f'<feFuncA type="linear" slope="{h["wide"]["alpha_slope"]}"/></feComponentTransfer>'
                f'<feGaussianBlur in="SourceAlpha" stdDeviation="{h["tight"]["std_dev"]}" result="t"/>'
                f'<feComponentTransfer in="t" result="tight">'
                f'<feFuncA type="linear" slope="{h["tight"]["alpha_slope"]}"/></feComponentTransfer>'
                f'<feMerge><feMergeNode in="wide"/><feMergeNode in="tight"/></feMerge></filter>')
        self.assertIn(want, self.jsx)
        self.assertIn(f'fill="{h["fill"]}" filter="url(#bdTitleHalo)"', self.jsx)

    def test_the_radii_are_ratios_of_cap_height_and_the_json_agrees_with_itself(self):
        # The JSON stores the ratio AND the product so the generator does not have to compute one.
        # Two copies of a fact is two things to get wrong, so the arithmetic is checked here instead.
        for f in (JSON_SRC, DESKTOP_JSON):
            h = json.loads(f.read_text(encoding="utf-8"))["title"]
            cap = h["halo"]["cap_height"]
            self.assertAlmostEqual(cap, h["font_size"] * h["halo"]["cap_height_ratio"], places=6,
                                   msg=f"{f.name}: cap_height is not ratio x font_size")
            for pass_ in ("wide", "tight"):
                p = h["halo"][pass_]
                self.assertAlmostEqual(p["std_dev"], round(cap * p["std_dev_over_cap"], 1), places=6,
                                       msg=f"{f.name}: the {pass_} radius is not its ratio of cap height")

    def test_neither_breakpoint_still_paints_the_gold_glow(self):
        # Rule 32: the same ruling, in two files that are maintained differently.
        for f in (JSX, DESKTOP_JSX):
            t = f.read_text(encoding="utf-8")
            self.assertNotIn("TitleGlow", t, f"{f.name} still references the retired gold glow")
            self.assertNotIn('fill="#C6AF7A" opacity=".55"', t, f"{f.name} still paints it")

    def test_the_desktop_file_no_longer_claims_a_generator_it_does_not_have(self):
        # Rule 33. The header said "Generated ... from banner-desktop-v2.json" and "regenerate from
        # the JSON if the design changes" while `scripts/` contained no such tool.
        self.assertFalse(list((ROOT / "scripts").glob("*banner*desktop*")),
                         "a desktop generator appeared - this whole class should become the mobile one")
        head = DESKTOP_JSX.read_text(encoding="utf-8")[:2000]
        self.assertIn("HAND-WRITTEN", head)
        self.assertIn("NO DESKTOP GENERATOR", head)
        self.assertIn("no props, no state", ROOT.joinpath("web/components/Banner.js").read_text(encoding="utf-8"))
        self.assertIn("THERE IS NO DESKTOP GENERATOR",
                      ROOT.joinpath("web/components/Banner.js").read_text(encoding="utf-8"),
                      "Banner.js claimed both components were regenerated; only the phone is")


if __name__ == "__main__":
    unittest.main()
