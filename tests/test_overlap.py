#!/usr/bin/env python3
"""The overlap rule, PC side (pipeline/overlap.py) - rendering contract v1.6.5.

    python -m unittest tests.test_overlap -v

Reads tests/fixtures/overlap_cases.json, the SAME file web/test/overlap.test.mjs reads. That shared
fixture is the point: the archived PC grid and the live phone grid are two implementations of one
design, and the only thing stopping them drifting on placement is that both are asserted against one
set of expected numbers. If a case here is edited without the JS agreeing, one of the two suites goes
red immediately.
"""
from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from pipeline.overlap import MAX_SPLIT_MIN, MIN_CHIP_MIN, split_overlaps  # noqa: E402

FIX = json.loads((Path(__file__).resolve().parent / "fixtures" / "overlap_cases.json").read_text(encoding="utf-8"))


def lanes_needed(items):
    """Greedy first-fit, the same packing both renderers do after the split."""
    lanes = []
    for it in sorted(items, key=lambda x: x["start"]):
        for lane in lanes:
            if lane[-1]["end"] <= it["start"]:
                lane.append(it)
                break
        else:
            lanes.append([it])
    return len(lanes)


class SharedFixtures(unittest.TestCase):
    def test_every_case_places_exactly_as_the_fixture_says(self):
        for case in FIX["cases"]:
            with self.subTest(case["name"]):
                out, split, guarded = split_overlaps(case["items"])
                got = [{"id": o["id"], "start": o["start"], "end": o["end"]} for o in out]
                self.assertEqual(got, case["expect"], case.get("why", ""))

    def test_which_pairs_split_matches(self):
        for case in FIX["cases"]:
            with self.subTest(case["name"]):
                out, split, _ = split_overlaps(case["items"])
                ids = [[case["items"][i]["id"], case["items"][j]["id"]] for i, j in split]
                self.assertEqual(ids, case["expect_split"])

    def test_the_width_guard_fires_where_the_fixture_says(self):
        for case in FIX["cases"]:
            with self.subTest(case["name"]):
                _, _, guarded = split_overlaps(case["items"])
                ids = [[case["items"][i]["id"], case["items"][j]["id"]] for i, j in guarded]
                self.assertEqual(ids, case.get("expect_guarded", []))

    def test_lane_count_after_the_split_matches(self):
        """The whole point: a split pair must collapse into ONE lane."""
        for case in FIX["cases"]:
            with self.subTest(case["name"]):
                out, _, _ = split_overlaps(case["items"])
                self.assertEqual(lanes_needed(out), case["expect_lanes"], case.get("why", ""))


class TheRuleItself(unittest.TestCase):
    def test_thresholds_match_the_fixture_header(self):
        self.assertEqual(MAX_SPLIT_MIN, FIX["max_split_min"])
        self.assertEqual(MIN_CHIP_MIN, FIX["min_chip_min"])

    def test_the_input_is_never_mutated(self):
        """Presentational only - the caller's rows must survive untouched."""
        items = [{"id": "a", "start": 720, "end": 930}, {"id": "b", "start": 915, "end": 1125}]
        before = json.dumps(items, sort_keys=True)
        split_overlaps(items)
        self.assertEqual(json.dumps(items, sort_keys=True), before)

    def test_a_split_pair_exactly_meets_with_no_gap_and_no_overlap(self):
        out, _, _ = split_overlaps([{"start": 750, "end": 960}, {"start": 930, "end": 1140}])
        self.assertEqual(out[0]["end"], out[1]["start"])

    def test_total_span_is_preserved(self):
        """Splitting moves the boundary; it must not move the outer edges of the pair."""
        items = [{"start": 750, "end": 960}, {"start": 930, "end": 1140}]
        out, _, _ = split_overlaps(items)
        self.assertEqual(out[0]["start"], 750)
        self.assertEqual(out[1]["end"], 1140)

    def test_an_empty_or_single_row_is_a_no_op(self):
        self.assertEqual(split_overlaps([])[0], [])
        one = [{"start": 1, "end": 2}]
        self.assertEqual(split_overlaps(one)[0], one)


if __name__ == "__main__":
    unittest.main()
