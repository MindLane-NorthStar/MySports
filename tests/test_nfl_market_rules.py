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


def event(eid, start, away, home, network, away_abbr, home_abbr, market="National", week=3, season_type=2):
    """One scoreboard event in ESPN's shape, with one TV row."""
    def side(ha, nick, full, abbr, tid):
        return {"homeAway": ha, "team": {"id": tid, "name": nick, "displayName": full, "location": full.rsplit(" ", 1)[0], "abbreviation": abbr}, "records": []}
    return {"id": eid, "date": start, "week": {"number": week}, "season": {"year": 2026, "type": season_type, "slug": "regular-season" if season_type == 2 else "post-season"},
            "competitions": [{"date": start, "timeValid": True, "neutralSite": False,
                              "competitors": [side("home", home[0], home[1], home_abbr, eid + "h"), side("away", away[0], away[1], away_abbr, eid + "a")],
                              "geoBroadcasts": [{"lang": "en", "region": "us", "media": {"shortName": network}, "market": {"type": market}}],
                              "status": {"type": {"state": "pre", "name": "STATUS_SCHEDULED", "completed": False}},
                              "venue": {"fullName": "Somewhere"}}]}


WINDOWS = {
    "source": "entitledsports", "market": "Cleveland–Akron (Canton)",
    "weeks": {
        "3": {"updated": "Wed Sep 23, 5:30 AM ET", "windows": [
            {"network": "CBS", "slot": "early", "station": "WOIO 19 (CBS)", "text": "CIN Bengals @ PIT Steelers",
             "away": {"abbr": "CIN", "nick": "Bengals"}, "home": {"abbr": "PIT", "nick": "Steelers"}, "tbd": False},
            {"network": "FOX", "slot": "early", "station": "WJW 8 (FOX)", "text": "CAR Panthers @ CLE Browns",
             "away": {"abbr": "CAR", "nick": "Panthers"}, "home": {"abbr": "CLE", "nick": "Browns"}, "tbd": False},
            {"network": "CBS", "slot": "late", "station": "WOIO 19 (CBS)", "text": "TBD", "away": None, "home": None, "tbd": True},
            {"network": "FOX", "slot": "late", "station": "WJW 8 (FOX)", "text": "TBD", "away": None, "home": None, "tbd": True}]},
        "4": {"updated": "Sun Sep 13, 10:22 PM ET", "windows": [
            {"network": n, "slot": s, "station": st, "text": "TBD", "away": None, "home": None, "tbd": True}
            for n, s, st in (("CBS", "early", "WOIO 19 (CBS)"), ("FOX", "early", "WJW 8 (FOX)"), ("CBS", "late", "WOIO 19 (CBS)"), ("FOX", "late", "WJW 8 (FOX)"))]},
    },
    "notes": [],
}


def build(events, listings=WJW_LISTINGS, root=ROOT, windows=None, week=3):
    raw = {"events": events}
    with redirect_stdout(io.StringIO()):
        fx, notes = espn.build_nfl_fixture(raw, root, season=2026, week=week, day_filter=None, teams=[],
                                           listings=listings if listings is not None else {}, windows=windows if windows is not None else {})
    return {g["id"]: g for g in fx["games"]}


def row(g):
    m = g["media"][0]
    return m["access"], m["market"], m["source"]


# kickoffs, UTC: Sunday 2026-09-27 1:00 PM ET = 17:00Z; 4:25 PM ET = 20:25Z; Thanksgiving 2026-11-26 4:30 PM ET = 21:30Z
class Rule0PostseasonIsNational(unittest.TestCase):
    """prompt 119: every playoff game airs nationally, before any other rule - a hand entry cannot override it."""

    def test_a_postseason_cbs_game_at_sunday_one_pm_is_national(self):
        g = build([event("40", "2027-01-10T18:00:00Z", ("Bills", "Buffalo Bills"), ("Steelers", "Pittsburgh Steelers"), "CBS", "BUF", "PIT", week=1, season_type=3)], listings=None)
        self.assertEqual(row(g["nfl-40"]), ("AVAILABLE", "national", "national window (postseason)"))

    def test_a_postseason_fox_game_at_four_thirty_is_national_even_with_a_hand_entry_saying_no(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            (root / "data").mkdir()
            for f in ("markets.json", "access_profile.json"):
                (root / "data" / f).write_bytes((ROOT / "data" / f).read_bytes())
            (root / "data" / "market_coverage_nfl.json").write_text(json.dumps({"1": {"games": {"GB@DET": {"cleveland": False}}}}), encoding="utf-8")
            g = build([event("41", "2027-01-10T21:30:00Z", ("Packers", "Green Bay Packers"), ("Lions", "Detroit Lions"), "FOX", "GB", "DET", week=1, season_type=3),
                      # the same game as a regular-season one proves the hand entry bites: rule 2 makes it OUT_OF_MARKET
                      event("41r", "2027-01-10T21:30:00Z", ("Packers", "Green Bay Packers"), ("Lions", "Detroit Lions"), "FOX", "GB", "DET", week=1, season_type=2)],
                      listings=None, root=root, week=1)
        self.assertEqual(row(g["nfl-41r"]), ("OUT_OF_MARKET", "regional", "market_coverage_nfl.json week 1"))
        self.assertEqual(row(g["nfl-41"]), ("AVAILABLE", "national", "national window (postseason)"))

    def test_a_regular_season_game_at_the_same_times_is_unchanged(self):
        # 1:00 PM ET Sunday: the regional rules; 4:30 PM ET Sunday: still the regional window (rule 1 is 12:00-17:00)
        g = build([event("42", "2026-09-27T18:00:00Z", ("Bills", "Buffalo Bills"), ("Steelers", "Pittsburgh Steelers"), "CBS", "BUF", "PIT"),
                  event("43", "2026-09-27T20:30:00Z", ("Packers", "Green Bay Packers"), ("Lions", "Detroit Lions"), "FOX", "GB", "DET")], listings=None)   # 4:30 PM EDT
        self.assertEqual(row(g["nfl-42"])[1], "regional")
        self.assertEqual(row(g["nfl-43"])[1], "regional")
        self.assertNotIn("postseason", row(g["nfl-42"])[2])

    def test_the_test_reads_the_events_own_season_type(self):
        self.assertTrue(espn.is_postseason({"season": {"type": 3}}))
        self.assertTrue(espn.is_postseason({"season": {"type": "3"}}))
        for ev in ({"season": {"type": 2}}, {"season": {"type": 1}}, {"season": {}}, {}, {"season": {"type": "x"}}):
            self.assertFalse(espn.is_postseason(ev), ev)


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


class Rule4bTheCoverageWindow(unittest.TestCase):
    """prompt 118: EntitledSports' window for the game's week decides when the listings do not."""

    def test_week_3_cbs_early_is_the_bengals_at_the_steelers_and_every_other_cbs_early_game_is_out(self):
        g = build([event("20", "2026-09-27T17:00:00Z", ("Bengals", "Cincinnati Bengals"), ("Steelers", "Pittsburgh Steelers"), "CBS", "CIN", "PIT")], listings=None, windows=WINDOWS)
        self.assertEqual(row(g["nfl-20"]), ("AVAILABLE", "regional", "entitledsports week 3 (updated Wed Sep 23 5:30 AM ET): WOIO CBS early CIN @ PIT"))
        others = [("21", ("Texans", "Houston Texans"), ("Colts", "Indianapolis Colts"), "HOU", "IND"),
                  ("22", ("Chiefs", "Kansas City Chiefs"), ("Dolphins", "Miami Dolphins"), "KC", "MIA"),
                  ("23", ("Patriots", "New England Patriots"), ("Jaguars", "Jacksonville Jaguars"), "NE", "JAX"),
                  ("24", ("Titans", "Tennessee Titans"), ("Giants", "New York Giants"), "TEN", "NYG")]
        g = build([event(i, "2026-09-27T17:00:00Z", a, h, "CBS", aa, ha) for i, a, h, aa, ha in others], listings=None, windows=WINDOWS)
        for i, *_ in others:
            acc, mk, src = row(g[f"nfl-{i}"])
            self.assertEqual((acc, mk), ("OUT_OF_MARKET", "regional"), i)
            self.assertIn("WOIO CBS early CIN @ PIT", src)

    def test_the_late_windows_fall_through_to_unverified(self):
        g = build([event("25", "2026-09-27T20:25:00Z", ("Chiefs", "Kansas City Chiefs"), ("Chargers", "Los Angeles Chargers"), "FOX", "KC", "LAC"),
                  event("26", "2026-09-27T20:05:00Z", ("Ravens", "Baltimore Ravens"), ("Cowboys", "Dallas Cowboys"), "CBS", "BAL", "DAL")], listings=None, windows=WINDOWS)
        for i in ("25", "26"):
            acc, mk, src = row(g[f"nfl-{i}"])
            self.assertEqual((acc, mk), ("UNVERIFIED", "regional"), i)
            self.assertIn("neither the station listing nor the coverage window", src)

    def test_week_4_falls_through_for_every_game(self):
        g = build([event("27", "2026-10-04T17:00:00Z", ("Lions", "Detroit Lions"), ("Packers", "Green Bay Packers"), "FOX", "DET", "GB", week=4),
                  event("28", "2026-10-04T20:25:00Z", ("Jets", "New York Jets"), ("Broncos", "Denver Broncos"), "CBS", "NYJ", "DEN", week=4)], listings=None, windows=WINDOWS)
        for i in ("27", "28"):
            self.assertEqual(row(g[f"nfl-{i}"])[0], "UNVERIFIED", i)

    def test_the_early_late_cut_is_three_pm_eastern(self):
        # the week-3 CBS early window names CIN @ PIT: a 1:00 kickoff reads it, a 4:05 or 4:25 kickoff reads the late window (TBD)
        for start, expect in (("2026-09-27T17:00:00Z", "AVAILABLE"), ("2026-09-27T20:05:00Z", "UNVERIFIED"), ("2026-09-27T20:25:00Z", "UNVERIFIED")):
            got = espn.windows_decision(WINDOWS, "CBS", 3, start, "steelers", "bengals")
            self.assertEqual(got[0] if got else "UNVERIFIED", expect, start)
        # the cut itself: 2:59 PM ET is early, 3:00 PM ET is late
        self.assertIsNotNone(espn.windows_decision(WINDOWS, "CBS", 3, "2026-09-27T18:59:00Z", "steelers", "bengals"))
        self.assertIsNone(espn.windows_decision(WINDOWS, "CBS", 3, "2026-09-27T19:00:00Z", "steelers", "bengals"))

    def test_the_two_team_cities_resolve_by_nickname(self):
        w = {"weeks": {"3": {"updated": "x", "windows": [
            {"network": "FOX", "slot": "early", "station": "WJW 8 (FOX)", "text": "NYJ Jets @ DET Lions",
             "away": {"abbr": "NYJ", "nick": "Jets"}, "home": {"abbr": "DET", "nick": "Lions"}, "tbd": False},
            {"network": "CBS", "slot": "late", "station": "WOIO 19 (CBS)", "text": "LAR Rams @ SF 49ers",
             "away": {"abbr": "LAR", "nick": "Rams"}, "home": {"abbr": "SF", "nick": "49ers"}, "tbd": False}]}}}
        self.assertEqual(espn.windows_decision(w, "FOX", 3, "2026-09-27T17:00:00Z", "lions", "jets")[0], "AVAILABLE")
        self.assertEqual(espn.windows_decision(w, "FOX", 3, "2026-09-27T17:00:00Z", "lions", "giants")[0], "OUT_OF_MARKET")
        self.assertEqual(espn.windows_decision(w, "CBS", 3, "2026-09-27T20:25:00Z", "49ers", "rams")[0], "AVAILABLE")
        self.assertEqual(espn.windows_decision(w, "CBS", 3, "2026-09-27T20:25:00Z", "49ers", "chargers")[0], "OUT_OF_MARKET")

    def test_tbd_an_unrecognized_marker_and_no_file_each_fall_through(self):
        self.assertIsNone(espn.windows_decision(WINDOWS, "CBS", 3, "2026-09-27T20:25:00Z", "cowboys", "ravens"))     # TBD
        odd = {"weeks": {"3": {"windows": [{"network": "CBS", "slot": "early", "text": "No game", "away": None, "home": None, "tbd": True}]}}}
        self.assertIsNone(espn.windows_decision(odd, "CBS", 3, "2026-09-27T17:00:00Z", "steelers", "bengals"))     # unrecognized marker
        self.assertIsNone(espn.windows_decision(None, "CBS", 3, "2026-09-27T17:00:00Z", "steelers", "bengals"))    # no file
        self.assertIsNone(espn.windows_decision(WINDOWS, "CBS", 7, "2026-10-25T17:00:00Z", "steelers", "bengals"))  # week not covered
        self.assertIsNone(espn.load_windows("/nowhere/nfl_windows.json"))

    def test_precedence_listings_beat_windows_and_a_hand_entry_beats_both(self):
        # WOIO's listing carries CIN @ PIT at 1:00 and the window says the same: both agree, the listing is the source
        acc, mk, src = espn.decide_regional(start_iso="2026-09-27T17:00:00Z", is_local=False, cov_game=None, week=3, listings=WJW_LISTINGS,
                                            station="WOIO", home_nick="steelers", away_nick="bengals", windows=WINDOWS, network="CBS")
        self.assertEqual(acc, "AVAILABLE"); self.assertTrue(src.startswith("listings:"), src)
        # the listing carries a DIFFERENT game from the window: the listing wins
        w = {"weeks": {"3": {"updated": "x", "windows": [{"network": "CBS", "slot": "early", "station": "WOIO 19 (CBS)", "text": "HOU Texans @ IND Colts",
                                                            "away": {"abbr": "HOU", "nick": "Texans"}, "home": {"abbr": "IND", "nick": "Colts"}, "tbd": False}]}}}
        acc, mk, src = espn.decide_regional(start_iso="2026-09-27T17:00:00Z", is_local=False, cov_game=None, week=3, listings=WJW_LISTINGS,
                                            station="WOIO", home_nick="steelers", away_nick="bengals", windows=w, network="CBS")
        self.assertEqual((acc, src.split(":")[0]), ("AVAILABLE", "listings"))
        # no listing for the station: the window decides
        acc, mk, src = espn.decide_regional(start_iso="2026-09-27T17:00:00Z", is_local=False, cov_game=None, week=3, listings=None,
                                            station="WOIO", home_nick="steelers", away_nick="bengals", windows=w, network="CBS")
        self.assertEqual((acc, src.split(" ")[0]), ("OUT_OF_MARKET", "entitledsports"))
        # a hand entry beats both
        acc, mk, src = espn.decide_regional(start_iso="2026-09-27T17:00:00Z", is_local=False, cov_game={"cleveland": False}, week=3, listings=WJW_LISTINGS,
                                            station="WOIO", home_nick="steelers", away_nick="bengals", windows=WINDOWS, network="CBS")
        self.assertEqual((acc, src), ("OUT_OF_MARKET", "market_coverage_nfl.json week 3"))

    def test_the_fixture_builder_reads_the_windows_file_from_the_environment(self):
        with tempfile.TemporaryDirectory() as td:
            p = Path(td) / "nfl_windows.json"
            p.write_text(json.dumps(WINDOWS), encoding="utf-8")
            with redirect_stdout(io.StringIO()):
                fx, _ = espn.build_nfl_fixture({"events": [event("29", "2026-09-27T17:00:00Z", ("Bengals", "Cincinnati Bengals"), ("Steelers", "Pittsburgh Steelers"), "CBS", "CIN", "PIT")]},
                                               ROOT, season=2026, week=3, day_filter=None, teams=[], listings={}, listings_path=None, windows=None, windows_path=str(p))
            m = fx["games"][0]["media"][0]
            self.assertEqual(m["access"], "AVAILABLE")
            self.assertTrue(m["source"].startswith("entitledsports week 3"))


def _week9_windows():
    """The week 9 windows exactly as adapters/es_windows.py parses the saved live fixture (prompt 131)."""
    from adapters import es_windows as es
    p = es.parse_page((ROOT / "tests" / "fixtures" / "es_week9_cleveland.html").read_text(encoding="utf-8"))
    return {"source": "entitledsports", "market": p["market"], "notes": [],
            "weeks": {"9": {"updated": p["updated"], "windows": p["windows"]}}}


# Sunday 2026-11-08 (EST): 1:00 PM ET = 18:00Z; 4:05 PM ET = 21:05Z; 4:25 PM ET = 21:25Z. ESPN's week 9 slate.
WEEK9_SLATE = [
    ("401873039", "2026-11-08T18:00:00Z", ("Browns", "Cleveland Browns"), ("Saints", "New Orleans Saints"), "CBS", "CLE", "NO"),
    ("401873045", "2026-11-08T18:00:00Z", ("Jets", "New York Jets"), ("Chiefs", "Kansas City Chiefs"), "CBS", "NYJ", "KC"),
    ("401873042", "2026-11-08T18:00:00Z", ("Lions", "Detroit Lions"), ("Dolphins", "Miami Dolphins"), "CBS", "DET", "MIA"),
    ("401873041", "2026-11-08T18:00:00Z", ("Broncos", "Denver Broncos"), ("Panthers", "Carolina Panthers"), "CBS", "DEN", "CAR"),
    ("401873046", "2026-11-08T21:05:00Z", ("Texans", "Houston Texans"), ("Chargers", "Los Angeles Chargers"), "CBS", "HOU", "LAC"),
    ("401873040", "2026-11-08T18:00:00Z", ("Cowboys", "Dallas Cowboys"), ("Colts", "Indianapolis Colts"), "FOX", "DAL", "IND"),
    ("401873044", "2026-11-08T18:00:00Z", ("Giants", "New York Giants"), ("Eagles", "Philadelphia Eagles"), "FOX", "NYG", "PHI"),
    ("401873043", "2026-11-08T18:00:00Z", ("Rams", "Los Angeles Rams"), ("Commanders", "Washington Commanders"), "FOX", "LAR", "WSH"),
    ("401873049", "2026-11-08T21:25:00Z", ("Packers", "Green Bay Packers"), ("Patriots", "New England Patriots"), "FOX", "GB", "NE"),
    ("401873047", "2026-11-08T21:25:00Z", ("Raiders", "Las Vegas Raiders"), ("49ers", "San Francisco 49ers"), "FOX", "LV", "SF"),
    ("401873048", "2026-11-08T21:25:00Z", ("Cardinals", "Arizona Cardinals"), ("Seahawks", "Seattle Seahawks"), "FOX", "ARI", "SEA"),
]


class Rule4bTheSingleWindow(unittest.TestCase):
    """prompt 131: from week 9 the page gives one network a single window; it decides that network's games
    in EITHER slot, because a network with one game in the market airs that game and no other."""

    def test_week_9_three_available_and_every_other_cbs_or_fox_afternoon_game_out(self):
        g = build([event(*s, week=9) for s in WEEK9_SLATE], listings=None, windows=_week9_windows(), week=9)
        got = {gid: row(g[f"nfl-{gid}"]) for gid, *_ in WEEK9_SLATE}
        self.assertEqual(got["401873039"], ("AVAILABLE", "regional", "market: local team"), "CLE @ NO: rule 3 runs first")
        self.assertEqual(got["401873040"][:2], ("AVAILABLE", "regional"))   # DAL @ IND, FOX early on WJW 8
        self.assertEqual(got["401873049"][:2], ("AVAILABLE", "regional"))   # GB @ NE, FOX late on WJW 8
        self.assertEqual(got["401873040"][2], "entitledsports week 9 (updated Mon Nov 9 12:27 PM ET): WJW FOX early DAL @ IND")
        for gid in ("401873045", "401873042", "401873041", "401873046", "401873044", "401873043", "401873047", "401873048"):
            self.assertEqual(got[gid][:2], ("OUT_OF_MARKET", "regional"), gid)
        self.assertNotIn("UNVERIFIED", {a for a, _, _ in got.values()}, "nothing falls to rule 6 when the page names every window")

    def test_hou_at_lac_at_4_05_on_cbs_is_decided_by_the_single_window(self):
        # a slot-exact lookup asks for CBS late, which the page no longer has - and would fall to rule 6
        got = espn.windows_decision(_week9_windows(), "CBS", 9, "2026-11-08T21:05:00Z", "chargers", "texans")
        self.assertEqual(got, ("OUT_OF_MARKET", "entitledsports week 9 (updated Mon Nov 9 12:27 PM ET): WOIO CBS single CLE @ NO"))

    def test_rule_4b_alone_makes_cle_at_no_available_against_the_single_window(self):
        got = espn.windows_decision(_week9_windows(), "CBS", 9, "2026-11-08T18:00:00Z", "saints", "browns")
        self.assertEqual(got, ("AVAILABLE", "entitledsports week 9 (updated Mon Nov 9 12:27 PM ET): WOIO CBS single CLE @ NO"))

    def test_a_fox_single_page_decides_a_4_05_fox_game_against_the_single_window(self):
        w = {"weeks": {"9": {"updated": "x", "windows": [
            {"network": "FOX", "slot": "single", "station": "WJW 8 (FOX) · 4:25 PM ET", "text": "GB Packers @ NE Patriots",
             "away": {"abbr": "GB", "nick": "Packers"}, "home": {"abbr": "NE", "nick": "Patriots"}, "tbd": False},
            {"network": "CBS", "slot": "early", "station": "WOIO 19 (CBS)", "text": "TBD", "away": None, "home": None, "tbd": True},
            {"network": "CBS", "slot": "late", "station": "WOIO 19 (CBS)", "text": "TBD", "away": None, "home": None, "tbd": True}]}}}
        acc, src = espn.windows_decision(w, "FOX", 9, "2026-11-08T21:05:00Z", "seahawks", "cardinals")
        self.assertEqual(acc, "OUT_OF_MARKET")
        self.assertIn("WJW FOX single GB @ NE", src)
        self.assertEqual(espn.windows_decision(w, "FOX", 9, "2026-11-08T21:25:00Z", "patriots", "packers")[0], "AVAILABLE")
        self.assertEqual(espn.windows_decision(w, "FOX", 9, "2026-11-08T18:00:00Z", "patriots", "packers")[0], "AVAILABLE",
                         "the single window answers whatever slot the kickoff falls in")
        self.assertIsNone(espn.windows_decision(w, "CBS", 9, "2026-11-08T18:00:00Z", "chiefs", "jets"), "a TBD window still falls through")

    def test_an_exact_slot_wins_and_a_tbd_single_falls_through(self):
        w = _week9_windows()
        w["weeks"]["9"]["windows"][0].update({"tbd": True, "away": None, "home": None, "text": "TBD"})
        self.assertIsNone(espn.windows_decision(w, "CBS", 9, "2026-11-08T18:00:00Z", "chiefs", "jets"))
        self.assertEqual(espn.windows_decision(w, "FOX", 9, "2026-11-08T21:25:00Z", "seahawks", "cardinals")[1].split(": ")[1],
                         "WJW FOX late GB @ NE")


class TheLedger(unittest.TestCase):
    """prompt 131: pipeline/load.py copies the windows step's status into refresh_runs.notes."""

    def test_the_status_file_becomes_nfl_windows(self):
        from unittest import mock
        from pipeline import load
        with tempfile.TemporaryDirectory() as td:
            p = Path(td) / "s.json"
            p.write_text(json.dumps({"source": "entitledsports", "written": False, "weeks": {"9": "failed (PageError: x)"}}), encoding="utf-8")
            with mock.patch.dict(load.os.environ, {"MYSPORTS_NFL_WINDOWS_STATUS": str(p)}):
                self.assertEqual(load.windows_status(), {"nfl_windows": {"source": "entitledsports", "written": False, "weeks": {"9": "failed (PageError: x)"}}})
            with mock.patch.dict(load.os.environ, {"MYSPORTS_NFL_WINDOWS_STATUS": str(Path(td) / "missing.json")}):
                self.assertIn("no readable status", load.windows_status()["nfl_windows"]["error"])
        with mock.patch.dict(load.os.environ, {}):
            load.os.environ.pop("MYSPORTS_NFL_WINDOWS_STATUS", None)
            self.assertEqual(load.windows_status(), {}, "unset: the key is left out")

    def test_main_puts_it_in_the_notes(self):
        src = (ROOT / "pipeline" / "load.py").read_text(encoding="utf-8")
        self.assertIn('"cancellations": list(CANCELLATIONS), **windows_status()})', src)

    def test_the_workflow_passes_the_same_status_file_to_both_steps(self):
        import yaml
        doc = yaml.safe_load((ROOT / ".github" / "workflows" / "schedule_refresh.yml").read_text(encoding="utf-8"))
        steps = doc["jobs"]["refresh"]["steps"]
        win = next(s for s in steps if "adapters.es_windows" in str(s.get("run", "")))
        load_step = next(s for s in steps if "pipeline.load --all" in str(s.get("run", "")))
        path = win["env"]["MYSPORTS_NFL_WINDOWS_STATUS"]
        self.assertTrue(path.startswith("${{ runner.temp }}/"))
        self.assertEqual(load_step["env"]["MYSPORTS_NFL_WINDOWS_STATUS"], path)
        self.assertNotIn("${{", load_step["run"])


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
