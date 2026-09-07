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


if __name__ == "__main__":
    unittest.main()
