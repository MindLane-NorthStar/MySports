#!/usr/bin/env python3
"""scripts/build_cap_table.py - the two-level cap rule, and the pin that ties ink_for to band_for.

    python -m unittest tests.test_cap_table -v

The synthetic images are built in a temp dir, so these run with no network, no database and no
dependency on assets/logos. The colour-pair pin DOES read the database when it is reachable and
skips itself when it is not, so the suite stays green offline.

Windows-safe: every path is built with pathlib, every open() passes encoding=.
"""
from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import numpy as np  # noqa: E402
from PIL import Image  # noqa: E402

from unittest import mock  # noqa: E402

import scripts.build_cap_table as bct  # noqa: E402
from scripts.build_cap_table import (  # noqa: E402
    CAP_TINT, DARK_MARGIN, FLAT_MIN, band_for, decide, decide_ruled, hex2rgb, ink_for, row_for, tint,
)


def square(path: Path, hexcolour: str, size: int = 256):
    """A solid opaque square - every ink pixel within 2px of the frame counts as edge, so the whole
    shape is measured and the score is unambiguous."""
    rgb = tuple(int(x) for x in hex2rgb(hexcolour))
    Image.new("RGBA", (size, size), rgb + (255,)).save(path)
    return path


class TwoLevelRule(unittest.TestCase):
    """tint = 1.0 when the logo reads on the flat band; else 0.72."""

    def test_a_logo_in_the_bands_own_colour_falls_to_the_tinted_cap(self):
        # The failure the whole ruling exists to avoid: art drawn in the team's own colour cannot
        # survive a cap painted that same colour, so the band is refused and 0.72 is used.
        with tempfile.TemporaryDirectory() as d:
            raw = square(Path(d) / "t.png", "#1b3a6b")
            level, art, crisp = decide(raw, None, "#1b3a6b")
        self.assertEqual(level, CAP_TINT)
        self.assertEqual(art, "raw")

    def test_a_contrasting_logo_keeps_the_flat_band(self):
        with tempfile.TemporaryDirectory() as d:
            raw = square(Path(d) / "t.png", "#ffffff")
            level, art, crisp = decide(raw, None, "#101214")
        self.assertEqual(level, 1.0)
        self.assertEqual(art, "raw")
        self.assertGreaterEqual(crisp, FLAT_MIN)

    def test_no_dark_file_is_scored_raw_only(self):
        with tempfile.TemporaryDirectory() as d:
            raw = square(Path(d) / "t.png", "#ffffff")
            self.assertEqual(decide(raw, None, "#101214")[1], "raw")
            self.assertEqual(decide(raw, Path(d) / "missing_dark.png", "#101214")[1], "raw")


class DarkMargin(unittest.TestCase):
    """art = dark only when _dark beats raw by MORE than 0.05 on the CHOSEN surface."""

    def _pair(self, band, raw_hex, dark_hex):
        with tempfile.TemporaryDirectory() as d:
            raw = square(Path(d) / "t.png", raw_hex)
            dark = square(Path(d) / "t_dark.png", dark_hex)
            return decide(raw, dark, band)

    def test_a_clearly_better_dark_file_wins(self):
        # raw is the band's own colour (0.0 crisp); dark is white (1.0). 1.0 - 0.0 > 0.05.
        level, art, crisp = self._pair("#1b3a6b", "#1b3a6b", "#ffffff")
        self.assertEqual(art, "dark")
        self.assertEqual(level, 1.0, "the dark file reads on the flat band, so the band is kept")

    def test_a_dark_file_that_is_no_better_is_refused(self):
        # both files read perfectly; the margin is 0.0, which is not > 0.05.
        level, art, crisp = self._pair("#101214", "#ffffff", "#f2f2f0")
        self.assertEqual(art, "raw")

    def test_the_margin_is_strict(self):
        # Equal scores must not flip to dark: selecting other art has a cost, so it needs to earn it.
        with tempfile.TemporaryDirectory() as d:
            raw = square(Path(d) / "t.png", "#ffffff")
            dark = square(Path(d) / "t_dark.png", "#ffffff")
            self.assertEqual(decide(raw, dark, "#101214")[1], "raw")

    def test_the_margin_constant_is_the_ruling_s(self):
        self.assertEqual(DARK_MARGIN, 0.05)
        self.assertEqual(FLAT_MIN, 0.85)
        self.assertEqual(CAP_TINT, 0.72)


class RuledTeamsAreScoredOnTheirOwnBand(unittest.TestCase):
    """Prompt 113 (Joe's ruling, 2026-09-22): a RULED team is scored on the flat band it paints,
    tint 1.0; an UNRULED team keeps band_for() + decide(). Same files, two answers, and the answer
    must depend on WHICH branch row_for() takes - revert the ruled branch and these go red."""

    def _files(self, d, raw_hex, dark_hex=None):
        raw = square(Path(d) / "t.png", raw_hex)
        if dark_hex:
            square(Path(d) / "t_dark.png", dark_hex)
        return raw

    def test_a_ruled_team_takes_the_dark_file_its_ruled_band_needs(self):
        # raw is WHITE; the ruled band is white, so raw scores 0.0 there and the charcoal dark 1.0.
        # band_for() on the team's colours would give a navy band, where raw is perfect and dark is
        # refused - the exact shape of the Padres and the Rams (prompt 112).
        with tempfile.TemporaryDirectory() as d:
            self._files(d, "#ffffff", "#101214")
            ruled = row_for("t", Path(d), {"t": "#ffffff"}, "#1b3a6b", None)
            unruled = row_for("t", Path(d), {}, "#1b3a6b", None)
        self.assertEqual(ruled, {"tint": 1.0, "art": "dark", "edge_crisp": 1.0})
        self.assertEqual(unruled["art"], "raw")
        self.assertEqual(unruled["tint"], 1.0)

    def test_a_ruled_team_is_never_tinted_even_when_nothing_reads_on_its_band(self):
        # decide() would fall to 0.72 here (best flat score 0.0 < 0.85); the ruled branch writes 1.0
        # because capFor() paints a ruled band untinted whatever the table says.
        with tempfile.TemporaryDirectory() as d:
            self._files(d, "#ffffff")
            got = row_for("t", Path(d), {"t": "#ffffff"}, "#1b3a6b", None)
            level, art, crisp = decide_ruled(Path(d) / "t.png", None, "#ffffff")
        self.assertEqual(got["tint"], 1.0)
        self.assertEqual(got["art"], "raw")
        self.assertEqual(got["edge_crisp"], 0.0)
        self.assertEqual((level, art, crisp), (1.0, "raw", 0.0))

    def test_an_unruled_team_still_takes_the_two_level_rule(self):
        with tempfile.TemporaryDirectory() as d:
            self._files(d, "#1b3a6b")
            got = row_for("t", Path(d), {}, "#1b3a6b", None)
        self.assertEqual(got["tint"], CAP_TINT, "a logo in the band's own colour falls to the tint")
        self.assertEqual(got["art"], "raw")

    def test_the_cap_override_is_applied_by_the_build_and_scored_on_the_ruled_band(self):
        # The Giants' ruling (prompt 69): a third file the measurement cannot choose. With the
        # override the row says 'cap' and carries the _cap file's own score on the ruled band.
        with tempfile.TemporaryDirectory() as d:
            self._files(d, "#fd5a1e", "#fd5a1e")          # both files vanish on the orange band
            square(Path(d) / "t_cap.png", "#000000")     # the silhouette reads on it
            with mock.patch.dict(bct.CAP_ART_OVERRIDES, {"t": "cap"}):
                got = row_for("t", Path(d), {"t": "#fd5a1e"}, "#fd5a1e", "#000000")
            plain = row_for("t", Path(d), {"t": "#fd5a1e"}, "#fd5a1e", "#000000")
        self.assertEqual(got, {"tint": 1.0, "art": "cap", "edge_crisp": 1.0})
        self.assertEqual(plain["art"], "raw", "without the override the margin rule ties to raw")

    def test_the_shipped_override_names_the_giants_and_nothing_else(self):
        self.assertEqual(bct.CAP_ART_OVERRIDES, {"mlb-137": "cap"})

    def test_a_missing_ruled_file_means_nobody_is_ruled(self):
        with tempfile.TemporaryDirectory() as d:
            self.assertEqual(bct.ruled_bands(Path(d) / "absent.json"), {})


class TintPort(unittest.TestCase):
    def test_tint_darkens_toward_near_black_like_gridmodel(self):
        # gridmodel.js: c*f + 255*(1-f)*0.08
        got = tint(hex2rgb("#ffffff"), 0.72)
        want = np.round(np.array([255.0, 255.0, 255.0]) * 0.72 + 255.0 * 0.28 * 0.08)
        self.assertTrue(np.array_equal(got, want))

    def test_tint_of_1_is_the_colour_itself(self):
        self.assertTrue(np.array_equal(tint(hex2rgb("#1b3a6b"), 1.0), hex2rgb("#1b3a6b")))


class InkForIsTheBandRule(unittest.TestCase):
    """THE PIN: on surface == band, the generalised rule must reproduce band_for().ink exactly.

    If these two ever disagree, the name row and the cap stop agreeing about what colour the text is,
    and the block quietly renders unreadable ink on a surface that measured fine.
    """

    PAIRS = [
        ("#1b3a6b", "#ffffff"), ("#ffffff", "#101214"), ("#c8102e", "#ffb81c"),
        ("#000000", "#ffffff"), ("#6e747c", None), ("#dbcca6", "#8c2232"),
        ("#ffb81c", "#000000"), ("#7a0019", "#ffcc33"), (None, "#123456"),
    ]

    def test_over_hand_picked_pairs(self):
        for p, s in self.PAIRS:
            b = band_for(p, s)
            self.assertEqual(ink_for(b["band"], p, s)["ink"].lower(), b["ink"].lower(),
                             "band rule disagreed for primary=%s secondary=%s" % (p, s))

    def test_over_two_thousand_random_pairs(self):
        rng = np.random.default_rng(40)
        for _ in range(2000):
            p = "#%06x" % int(rng.integers(0, 0x1000000))
            s = None if rng.random() < 0.15 else "#%06x" % int(rng.integers(0, 0x1000000))
            b = band_for(p, s)
            self.assertEqual(ink_for(b["band"], p, s)["ink"].lower(), b["ink"].lower(),
                             "band rule disagreed for primary=%s secondary=%s" % (p, s))

    def test_over_every_real_team_colour_pair(self):
        try:
            from scripts.build_cap_table import teams_from_db
            teams = teams_from_db()
        except Exception as e:  # noqa: BLE001 - offline or no DSN: the synthetic pins still ran
            self.skipTest("database not reachable: %s" % type(e).__name__)
        self.assertGreater(len(teams), 0)
        for t in teams:
            b = band_for(t["primary"], t["secondary"])
            self.assertEqual(ink_for(b["band"], t["primary"], t["secondary"])["ink"].lower(),
                             b["ink"].lower(), "band rule disagreed for %s" % t["id"])


class GeneratedTable(unittest.TestCase):
    def test_the_shipped_table_is_well_formed(self):
        import json
        p = Path(__file__).resolve().parents[1] / "web" / "lib" / "cap-table.json"
        doc = json.loads(p.read_text(encoding="utf-8"))
        self.assertIn("_generated", doc)
        self.assertIn("teams", doc)
        self.assertEqual(doc["_rule"]["flat_min"], FLAT_MIN)
        self.assertEqual(doc["_rule"]["dark_margin"], DARK_MARGIN)
        for tid, row in doc["teams"].items():
            self.assertIn(row["tint"], (1.0, CAP_TINT), tid)
            # 'cap' JOINED THE TWO IN PROMPT 69 - a black silhouette for a bright band, read only
            # by the grid endcap through teamLogoCapUrl(). It is a THIRD art context, not a third
            # value of the same one: the raw and dark files both score edge_crisp 0.000 on the
            # Giants' #fd5a1e band, and the silhouette that scores 1.000 there scores 0.000 on the
            # charcoal the listings card floats a logo on. build_web_marks.py --cap-art builds it.
            self.assertIn(row["art"], ("raw", "dark", "cap"), tid)
            self.assertGreaterEqual(row["edge_crisp"], 0.0, tid)
            self.assertLessEqual(row["edge_crisp"], 1.0, tid)

    def test_keys_keep_the_database_case(self):
        # The URL helpers lowercase for R2; the table must not, or nba-CLE stops matching.
        import json
        p = Path(__file__).resolve().parents[1] / "web" / "lib" / "cap-table.json"
        doc = json.loads(p.read_text(encoding="utf-8"))
        self.assertTrue(any(k != k.lower() for k in doc["teams"]),
                        "expected mixed-case ids such as nba-CLE to survive")


if __name__ == "__main__":
    unittest.main()
