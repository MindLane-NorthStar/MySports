#!/usr/bin/env python3
"""Prompt 129 block A: every game adapter folds case before it decides access.

    python -m unittest tests.test_outlet_case_fold -v    # from the repo root; stdlib only

THE GAP THIS PINS. ESPN's scoreboard began writing `media.shortName = 'Fox'` on 2026-10-05, and CFBD
on 2026-10-13. Every game adapter resolved outlets with `normalize_outlet`, an EXACT lookup, so `Fox`
stayed `Fox`: it missed `REGIONAL_NETWORKS` (the six regional rules never ran), the profile answered
UNKNOWN, and the reconciler filed the game as off-service. Ravens at Browns on Sunday 10-18 was one
of 39 games hidden that way. `canonical_outlet()` already existed and folded case within the alias
table and the profile (exact match, rule 18); only the program loader reached it.
"""
from __future__ import annotations

import io
import sys
import unittest
from contextlib import redirect_stdout
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from adapters import cfbd  # noqa: E402
from tests.test_nfl_market_rules import build, event  # noqa: E402

# Sunday 2026-10-18 1:00 PM ET = 17:00Z; Saturday 2026-10-17 noon ET = 16:00Z.
# week=99: no hand entry in data/market_coverage_nfl.json can decide these rows before rule 3 does.
BROWNS = ("Browns", "Cleveland Browns")
RAVENS = ("Ravens", "Baltimore Ravens")


def espn_row(network, start="2026-10-18T17:00:00Z", away=RAVENS, home=BROWNS, away_abbr="BAL", home_abbr="CLE", eid="401872997"):
    g = build([event(eid, start, away, home, network, away_abbr, home_abbr, week=7)], listings={}, windows={}, week=99)
    m = g[f"nfl-{eid}"]["media"][0]
    return m["outlet"], m["market"], m["access"], m["source"]


def cfbd_row(outlet):
    games = [{"id": 401858488, "season": 2026, "week": 8, "startDate": "2026-10-17T16:00:00.000Z", "startTimeTBD": False,
              "neutralSite": False, "venue": "Memorial Stadium", "completed": False,
              "homeId": 84, "homeTeam": "Indiana", "homeConference": "Big Ten", "homeClassification": "fbs",
              "awayId": 194, "awayTeam": "Ohio State", "awayConference": "Big Ten", "awayClassification": "fbs"}]
    media = [{"id": 401858488, "mediaType": "tv", "outlet": outlet, "isStartTimeTBD": False, "startTime": games[0]["startDate"]}]
    with redirect_stdout(io.StringIO()):
        fx = cfbd.build_fixture(games, media, ROOT, year=2026, week=8, season_type="regular")
    m = fx["games"][0]["media"][0]
    return m["outlet"], m["access"]


class EspnFoxIsFox(unittest.TestCase):
    def test_a_sunday_one_pm_fox_game_with_the_local_team_is_regional_and_available(self):
        self.assertEqual(espn_row("Fox"), ("FOX", "regional", "AVAILABLE", "market: local team"))

    def test_the_canonical_spelling_still_gives_the_same_row(self):
        self.assertEqual(espn_row("FOX"), espn_row("Fox"))

    def test_a_saturday_cfb_fox_game_is_national_and_available(self):
        g = espn_row("Fox", start="2026-10-17T16:00:00Z", away=("Buckeyes", "Ohio State Buckeyes"),
                     home=("Hoosiers", "Indiana Hoosiers"), away_abbr="OSU", home_abbr="IU", eid="401858488")
        self.assertEqual(g, ("FOX", "national", "AVAILABLE", "national window"))

    def test_a_label_that_is_not_a_known_network_in_any_case_stays_unknown(self):
        outlet, _, access, _ = espn_row("Foxx", start="2026-10-17T16:00:00Z")
        self.assertEqual((outlet, access), ("Foxx", "UNKNOWN"))


class CfbdFoxIsFox(unittest.TestCase):
    def test_cfbd_fox_is_fox_and_available(self):
        self.assertEqual(cfbd_row("Fox"), ("FOX", "AVAILABLE"))

    def test_cfbd_foxx_stays_unknown(self):
        self.assertEqual(cfbd_row("Foxx"), ("Foxx", "UNKNOWN"))


class TheOtherGameAdaptersFoldToo(unittest.TestCase):
    """Rule 32: the fold is at every game adapter's call site, not only the two that drifted."""

    def test_an_nhl_network_in_another_case_resolves_to_the_profile_spelling(self):
        import json
        from adapters import nhl
        raw = json.loads((ROOT / "tests" / "fixtures" / "nhl_schedule_raw.json").read_text(encoding="utf-8"))
        hits = 0
        for day in raw.get("gameWeek") or []:
            for g in day.get("games") or []:
                for b in g.get("tvBroadcasts") or []:
                    if b.get("network") == "TNT":
                        b["network"] = "tnt"
                        hits += 1
        self.assertGreater(hits, 0, "the recorded week must carry a TNT row to exercise this")
        with redirect_stdout(io.StringIO()):
            fx, _ = nhl.build_fixture(raw, ROOT, season=2026, anchor_date="2026-10-01", teams=[])
        rows = [(m["outlet"], m["access"]) for g in fx["games"] for m in g["media"] if m["outlet"].casefold() == "tnt"]
        self.assertEqual(rows, [("TNT", "AVAILABLE")] * hits)


if __name__ == "__main__":
    unittest.main()
