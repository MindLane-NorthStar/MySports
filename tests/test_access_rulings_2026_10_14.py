#!/usr/bin/env python3
"""Prompt 129 block D: Joe's access rulings of 2026-10-14 (register §74, rulings 2, 3 and 7).

    python -m unittest tests.test_access_rulings_2026_10_14 -v    # from the repo root; stdlib only

"I get NBA TV" and "I have HULU": both go under `available` in data/access_profile.json.
"Blue Jackets NOT AVAILABLE": the club's own channel, which the NHL's schedule names `CBJNHL` and
`CBJHN` (measured in tests/fixtures/nhl_schedule_shapes_2026-10-06.json and in
networks_services.canonical_name), goes under `unavailable`. SUPERSEDED 2026-11-16 by prompt 132
(register §77): the channel is on Joe's services, and the two CBJ tests below say so. Until now all four answered UNKNOWN,
and the reconciler filed their games as off-service: 76 of 79 NBA TV games were hidden.

The two eligibility cases run the real loader and reconciler over the SQLite harness of
tests/test_eligibility_follows_access.py, so the verdict is evaluated rather than mirrored.
"""
from __future__ import annotations

import io
import json
import sys
import unittest
from contextlib import redirect_stdout
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from adapters import nba, nhl  # noqa: E402
from adapters.common import access_lookup, canonical_outlet, outlet_access  # noqa: E402
from tests.test_eligibility_follows_access import Harness  # noqa: E402
from tests.test_nfl_market_rules import event  # noqa: E402

AVAILABLE, UNAVAILABLE = access_lookup(ROOT)


def access(label):
    return outlet_access(canonical_outlet(label, AVAILABLE, UNAVAILABLE), AVAILABLE, UNAVAILABLE)


class TheProfile(unittest.TestCase):
    def test_nba_tv_and_hulu_are_available(self):
        for label in ("NBA TV", "Hulu", "HULU"):
            with self.subTest(label=label):
                self.assertEqual(access(label), "AVAILABLE")

    def test_the_blue_jackets_own_channel_ruling_is_superseded_by_prompt_132(self):
        """Ruled UNAVAILABLE here on 2026-10-14; Joe superseded it on 2026-11-16 (register §77) after the
        2026-10-24 DirecTV deal. The profile records the supersession, and both spellings now read AVAILABLE -
        tests/test_access_rulings_2026_11_16.py holds the new ruling itself."""
        about = json.loads((ROOT / "data" / "access_profile.json").read_text(encoding="utf-8"))["_about"]
        self.assertIn("SUPERSEDED 2026-11-16", about)
        for label in ("CBJNHL", "CBJHN"):
            with self.subTest(label=label):
                self.assertEqual(access(label), "AVAILABLE")

    def test_acc_extra_is_accnx_and_available(self):
        """Joe's later ruling of 2026-10-14: "ACC Extra" is the same service as ACCNX."""
        for label in ("ACC Extra", "ACC EXTRA"):
            with self.subTest(label=label):
                self.assertEqual(canonical_outlet(label, AVAILABLE, UNAVAILABLE), "ACCNX")
                self.assertEqual(access(label), "AVAILABLE")

    def test_the_blue_jackets_prime_video_entry_is_unchanged(self):
        cbj = json.loads((ROOT / "data" / "local_rights.json").read_text(encoding="utf-8"))["nhl"]["CBJ"]
        self.assertEqual((cbj.get("outlet"), cbj.get("access")), ("Prime Video", "UNAVAILABLE"))


def nba_tv_game():
    """BOS @ DET on NBA TV, with the two clubs' regional feeds - neither is Cleveland's."""
    ev = event("401810001", "2026-10-28T23:00:00Z", ("Celtics", "Boston Celtics"), ("Pistons", "Detroit Pistons"),
               "NBA TV", "BOS", "DET")
    comp = ev["competitions"][0]
    comp["geoBroadcasts"] += [{"lang": "en", "region": "us", "media": {"shortName": "FanDuel SN DET"}, "market": {"type": "Home"}},
                              {"lang": "en", "region": "us", "media": {"shortName": "NBC Sports Boston"}, "market": {"type": "Away"}}]
    with redirect_stdout(io.StringIO()):
        fx, _ = nba.build_from_espn({"events": [ev]}, ROOT, season=2026, day_filter=None, teams=[])
    return fx["games"][0]


def cbj_game():
    raw = json.loads((ROOT / "tests" / "fixtures" / "nhl_schedule_shapes_2026-10-06.json").read_text(encoding="utf-8"))
    with redirect_stdout(io.StringIO()):
        fx, _ = nhl.build_fixture(raw, ROOT, season=2026, anchor_date="2026-10-06", teams=[])
    return next(g for g in fx["games"] if g["id"] == "nhl-2026020068")


class TheVerdict(Harness):
    def test_an_nba_tv_game_with_out_of_market_local_feeds_is_eligible(self):
        g = nba_tv_game()
        self.assertEqual(sorted((m["outlet"], m["access"]) for m in g["media"]),
                         [("FanDuel SN DET", "OUT_OF_MARKET"), ("NBA TV", "AVAILABLE"), ("NBC Sports Boston", "OUT_OF_MARKET")])
        self.load("nba", [g])
        self.reconcile()
        e = self.eligibility(g["id"])
        self.assertEqual((e["eligible"], e["market_pending"], e["via"]), (1, 0, "nba-tv"))

    def test_a_blue_jackets_game_on_their_own_channel_is_ruled_not_unknown(self):
        # Off-service under the 10-14 ruling; eligible since prompt 132 put the channel on Joe's services
        # (register §77). What this test was for holds either way: every row is RULED, none is unknown.
        g = cbj_game()
        self.assertEqual(sorted((m["outlet"], m["access"]) for m in g["media"]),
                         [("CBJHN", "AVAILABLE"), ("CBJNHL", "AVAILABLE"), ("SN-PIT", "OUT_OF_MARKET")])
        self.load("nhl", [g])
        self.reconcile()
        e = self.eligibility(g["id"])
        self.assertEqual((e["eligible"], e["market_pending"]), (1, 0))
        stored = {r[0] for r in self.db.conn.execute(
            "select access_status from game_broadcasts where game_id = ? and active", (g["id"],))}
        self.assertNotIn("unknown", stored, "every row is ruled: off-service, not unrecognized")


if __name__ == "__main__":
    unittest.main()
