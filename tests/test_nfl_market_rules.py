#!/usr/bin/env python3
"""adapters/espn.py - the six rules that decide a CBS or FOX row for Cleveland (prompt 117, register §62).

    python -m unittest tests.test_nfl_market_rules -v    # from the repo root; stdlib only

Joe, 2026-09-23: "ALL Sunday NFL broadcasts appear as visible to me on FOX or CBS - even though they're
determined by local DMA." The mechanism was working; the coverage map it needed never arrived, so every
CBS/FOX Sunday game sat UNVERIFIED ("Market TBD") all week, and national CBS/FOX games came out
UNVERIFIED too. Now the station's own listing decides, and a kickoff outside the Sunday afternoon
window is national. Every test drives the real fixture builder with a scoreboard payload in ESPN's
shape and a listings file in adapters/sd_listings.py's shape, offline.
"""
from __future__ import annotations

import io
import json
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from adapters import espn  # noqa: E402

WJW_LISTINGS = {
    "source": "schedulesdirect", "window": {"from": "2026-09-26", "to": "2026-10-10"},
    "stations": {
        "WJW": {"network": "FOX", "airings": [
            {"start": "2026-09-27T17:00:00Z", "durationSec": 10800, "title": "NFL Football",
             "episodeTitle": "Carolina Panthers at Cleveland Browns", "teams": ["Carolina Panthers", "Cleveland Browns"], "isNflGame": True},
            {"start": "2026-09-27T20:00:00Z", "durationSec": 1800, "title": "NFL on FOX Postgame", "episodeTitle": None, "teams": [], "isNflGame": False},
            {"start": "2026-09-27T20:30:00Z", "durationSec": 3600, "title": "Doc", "episodeTitle": "Pilot", "teams": [], "isNflGame": False},
            {"start": "2026-10-04T17:00:00Z", "durationSec": 10800, "title": "NFL Football", "episodeTitle": None, "teams": [], "isNflGame": True},
            {"start": "2026-10-04T20:25:00Z", "durationSec": 10800, "title": "NFL Football",
             "episodeTitle": "Los Angeles Rams at San Francisco 49ers", "teams": ["Los Angeles Rams", "San Francisco 49ers"], "isNflGame": True},
        ]},
        "WOIO": {"network": "CBS", "airings": [
            {"start": "2026-09-27T17:00:00Z", "durationSec": 10800, "title": "NFL Football",
             "episodeTitle": "Cincinnati Bengals at Pittsburgh Steelers", "teams": ["Cincinnati Bengals", "Pittsburgh Steelers"], "isNflGame": True},
            {"start": "2026-10-04T20:25:00Z", "durationSec": 10800, "title": "NFL Football",
             "episodeTitle": "New York Jets at Denver Broncos", "teams": ["New York Jets", "Denver Broncos"], "isNflGame": True},
        ]},
    },
}


def event(eid, start, away, home, network, away_abbr, home_abbr, market="National"):
    """One scoreboard event in ESPN's shape, with one TV row."""
    def side(ha, nick, full, abbr, tid):
        return {"homeAway": ha, "team": {"id": tid, "name": nick, "displayName": full, "location": full.rsplit(" ", 1)[0], "abbreviation": abbr}, "records": []}
    return {"id": eid, "date": start, "week": {"number": 3},
            "competitions": [{"date": start, "timeValid": True, "neutralSite": False,
                              "competitors": [side("home", home[0], home[1], home_abbr, eid + "h"), side("away", away[0], away[1], away_abbr, eid + "a")],
                              "geoBroadcasts": [{"lang": "en", "region": "us", "media": {"shortName": network}, "market": {"type": market}}],
                              "status": {"type": {"state": "pre", "name": "STATUS_SCHEDULED", "completed": False}},
                              "venue": {"fullName": "Somewhere"}}]}


def build(events, listings=WJW_LISTINGS, root=ROOT):
    raw = {"events": events}
    with redirect_stdout(io.StringIO()):
        fx, notes = espn.build_nfl_fixture(raw, root, season=2026, week=3, day_filter=None, teams=[], listings=listings if listings is not None else {})
    return {g["id"]: g for g in fx["games"]}


def row(g):
    m = g["media"][0]
    return m["access"], m["market"], m["source"]


# kickoffs, UTC: Sunday 2026-09-27 1:00 PM ET = 17:00Z; 4:25 PM ET = 20:25Z; Thanksgiving 2026-11-26 4:30 PM ET = 21:30Z
class Rule1NationalWindow(unittest.TestCase):
    def test_a_thanksgiving_cbs_game_is_national_with_no_listings(self):
        g = build([event("1", "2026-11-26T21:30:00Z", ("Chiefs", "Kansas City Chiefs"), ("Cowboys", "Dallas Cowboys"), "CBS", "KC", "DAL")], listings=None)
        self.assertEqual(row(g["nfl-1"]), ("AVAILABLE", "national", "national window"))

    def test_sunday_night_and_a_december_saturday_are_national(self):
        g = build([event("2", "2026-09-28T00:20:00Z", ("Ravens", "Baltimore Ravens"), ("Steelers", "Pittsburgh Steelers"), "FOX", "BAL", "PIT"),
                  event("3", "2026-12-19T21:30:00Z", ("Bills", "Buffalo Bills"), ("Jets", "New York Jets"), "CBS", "BUF", "NYJ")], listings=None)
        self.assertEqual(row(g["nfl-2"])[:2], ("AVAILABLE", "national"))
        self.assertEqual(row(g["nfl-3"])[:2], ("AVAILABLE", "national"))

    def test_the_window_edges(self):
        self.assertTrue(espn.sunday_afternoon_window("2026-09-27T16:00:00Z"))    # noon ET, in
        self.assertTrue(espn.sunday_afternoon_window("2026-09-27T20:59:00Z"))    # 4:59 PM ET, in
        self.assertFalse(espn.sunday_afternoon_window("2026-09-27T21:00:00Z"))   # 5:00 PM ET, out
        self.assertFalse(espn.sunday_afternoon_window("2026-09-27T15:30:00Z"))   # 11:30 AM ET (London), out
        self.assertFalse(espn.sunday_afternoon_window("2026-09-26T17:00:00Z"))   # a Saturday, out


class Rule2HandOverride(unittest.TestCase):
    def test_a_hand_entry_beats_the_listings(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            (root / "data").mkdir()
            for f in ("markets.json", "access_profile.json"):
                (root / "data" / f).write_bytes((ROOT / "data" / f).read_bytes())
            (root / "data" / "market_coverage_nfl.json").write_text(json.dumps({"3": {"games": {"BUF@PIT": {"cleveland": False}}}}), encoding="utf-8")
            # the listing says WOIO carries exactly this game at 1:00, which rule 4 would call AVAILABLE
            lst = {"stations": {"WOIO": {"network": "CBS", "airings": [
                {"start": "2026-09-27T17:00:00Z", "title": "NFL Football", "teams": ["Buffalo Bills", "Pittsburgh Steelers"], "isNflGame": True}]}}}
            g = build([event("4", "2026-09-27T17:00:00Z", ("Bills", "Buffalo Bills"), ("Steelers", "Pittsburgh Steelers"), "CBS", "BUF", "PIT")], listings=lst, root=root)
        self.assertEqual(row(g["nfl-4"]), ("OUT_OF_MARKET", "regional", "market_coverage_nfl.json week 3"))


class Rule3BrownsGame(unittest.TestCase):
    def test_the_browns_are_available_whatever_the_listing_says(self):
        g = build([event("5", "2026-09-27T17:00:00Z", ("Panthers", "Carolina Panthers"), ("Browns", "Cleveland Browns"), "FOX", "CAR", "CLE")], listings=None)
        self.assertEqual(row(g["nfl-5"]), ("AVAILABLE", "regional", "market: local team"))


class Rule4TheStationListing(unittest.TestCase):
    def test_the_same_two_teams_is_available_and_the_source_names_the_station_and_time(self):
        g = build([event("6", "2026-09-27T17:00:00Z", ("Bengals", "Cincinnati Bengals"), ("Steelers", "Pittsburgh Steelers"), "CBS", "CIN", "PIT")])
        self.assertEqual(row(g["nfl-6"]), ("AVAILABLE", "regional", "listings: WOIO 2026-09-27 1:00 PM"))

    def test_a_different_game_in_the_window_is_out_of_market_naming_what_the_station_carries(self):
        g = build([event("7", "2026-09-27T17:00:00Z", ("Texans", "Houston Texans"), ("Jaguars", "Jacksonville Jaguars"), "CBS", "HOU", "JAX")])
        acc, mk, src = row(g["nfl-7"])
        self.assertEqual((acc, mk), ("OUT_OF_MARKET", "regional"))
        self.assertIn("Cincinnati Bengals at Pittsburgh Steelers", src)

    def test_a_game_airing_with_no_team_names_is_unverified(self):
        g = build([event("8", "2026-10-04T17:00:00Z", ("Lions", "Detroit Lions"), ("Packers", "Green Bay Packers"), "FOX", "DET", "GB")])
        acc, mk, src = row(g["nfl-8"])
        self.assertEqual((acc, mk), ("UNVERIFIED", "regional"))
        self.assertIn("teams not named", src)

    def test_the_thirty_minute_bound(self):
        # 1:25 PM ET kickoff, listing at 1:00 PM: 25 minutes, inside
        g = build([event("9", "2026-09-27T17:25:00Z", ("Bengals", "Cincinnati Bengals"), ("Steelers", "Pittsburgh Steelers"), "CBS", "CIN", "PIT")])
        self.assertEqual(row(g["nfl-9"])[0], "AVAILABLE")
        # 4:05 PM ET kickoff, the only WOIO game that day is at 1:00: outside, and no other game in the window
        g = build([event("10", "2026-09-27T20:05:00Z", ("Bengals", "Cincinnati Bengals"), ("Steelers", "Pittsburgh Steelers"), "CBS", "CIN", "PIT")])
        self.assertEqual(row(g["nfl-10"]), ("OUT_OF_MARKET", "regional", "listings: WOIO carries no game in this window"))

    def test_the_two_team_cities_resolve_by_nickname(self):
        # WJW carries the RAMS at 4:25 on 10/04; the Chargers are the other Los Angeles club
        rams = build([event("11", "2026-10-04T20:25:00Z", ("Rams", "Los Angeles Rams"), ("49ers", "San Francisco 49ers"), "FOX", "LAR", "SF")])
        chargers = build([event("12", "2026-10-04T20:25:00Z", ("Chargers", "Los Angeles Chargers"), ("49ers", "San Francisco 49ers"), "FOX", "LAC", "SF")])
        self.assertEqual(row(rams["nfl-11"])[0], "AVAILABLE")
        self.assertEqual(row(chargers["nfl-12"])[0], "OUT_OF_MARKET")
        # WOIO carries the JETS at Denver; the Giants are the other New York club
        jets = build([event("13", "2026-10-04T20:25:00Z", ("Jets", "New York Jets"), ("Broncos", "Denver Broncos"), "CBS", "NYJ", "DEN")])
        giants = build([event("14", "2026-10-04T20:25:00Z", ("Giants", "New York Giants"), ("Broncos", "Denver Broncos"), "CBS", "NYG", "DEN")])
        self.assertEqual(row(jets["nfl-13"])[0], "AVAILABLE")
        self.assertEqual(row(giants["nfl-14"])[0], "OUT_OF_MARKET")

    def test_at_vs_and_at_sign_forms_all_match(self):
        for teams in (["Cincinnati Bengals", "Pittsburgh Steelers"], ["Pittsburgh Steelers", "Cincinnati Bengals"]):
            self.assertTrue(espn._names_match(teams, "steelers", "bengals"))
        self.assertFalse(espn._names_match(["Cincinnati Bengals", "Pittsburgh Steelers"], "steelers", "browns"))


class Rule5NoGameInTheWindow(unittest.TestCase):
    def test_wjw_carries_no_late_game_on_the_27th(self):
        g = build([event("15", "2026-09-27T20:25:00Z", ("Chiefs", "Kansas City Chiefs"), ("Chargers", "Los Angeles Chargers"), "FOX", "KC", "LAC")])
        self.assertEqual(row(g["nfl-15"]), ("OUT_OF_MARKET", "regional", "listings: WJW carries no game in this window"))


class Rule6TodaysBehaviour(unittest.TestCase):
    def test_no_listings_for_the_date_is_unverified(self):
        g = build([event("16", "2026-10-11T17:00:00Z", ("Bears", "Chicago Bears"), ("Vikings", "Minnesota Vikings"), "FOX", "CHI", "MIN")])
        self.assertEqual(row(g["nfl-16"])[:2], ("UNVERIFIED", "regional"))

    def test_a_failed_client_leaves_todays_behaviour(self):
        # listings=None -> the builder reads MYSPORTS_NFL_LISTINGS; unset (or pointing nowhere) -> None
        with redirect_stdout(io.StringIO()):
            fx, _ = espn.build_nfl_fixture({"events": [event("17", "2026-09-27T17:00:00Z", ("Bears", "Chicago Bears"), ("Vikings", "Minnesota Vikings"), "FOX", "CHI", "MIN")]},
                                           ROOT, season=2026, week=3, day_filter=None, teams=[], listings=None, listings_path="/nowhere/nfl_listings.json")
        m = fx["games"][0]["media"][0]
        self.assertEqual((m["access"], m["market"]), ("UNVERIFIED", "regional"))
        self.assertIsNone(espn.load_listings("/nowhere/nfl_listings.json"))


class TheOrder(unittest.TestCase):
    def test_the_hand_override_is_consulted_before_the_listing_and_after_the_window(self):
        # a Thanksgiving game with a hand entry saying OUT_OF_MARKET is still NATIONAL: rule 1 first
        acc, mk, src = espn.decide_regional(start_iso="2026-11-26T21:30:00Z", is_local=False, cov_game={"cleveland": False}, week=13,
                                            listings=WJW_LISTINGS, station="WOIO", home_nick="cowboys", away_nick="chiefs")
        self.assertEqual((acc, mk), ("AVAILABLE", "national"))
        # inside the window, the override beats a listing that says AVAILABLE
        acc, mk, src = espn.decide_regional(start_iso="2026-09-27T17:00:00Z", is_local=False, cov_game={"cleveland": False}, week=3,
                                            listings=WJW_LISTINGS, station="WOIO", home_nick="steelers", away_nick="bengals")
        self.assertEqual((acc, src), ("OUT_OF_MARKET", "market_coverage_nfl.json week 3"))


if __name__ == "__main__":
    unittest.main()
