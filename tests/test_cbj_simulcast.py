"""The Blue Jackets' WUAB 43 simulcasts (prompt 132 block B, Joe 2026-11-16, register §77).

Joe: "select Bluejackets games are available on WUAB 43 in Cleveland - these should surface in MySportsTV
and show WUAB 43 as the broadcaster". The team announced ten Blue Jackets Hockey Network games simulcast
over the air on 2026-11-02 (nhl.com/bluejackets/news/cbj-on-cw), Cleveland on "Cleveland (WUAB, MyNet,
43.1)". They are hand-entered in data/local_rights.json nhl.CBJ.simulcasts in the Cavaliers' shape
(nba.CLE.simulcasts, prompts 104 and 106), and adapters/nhl.py emits them through the SAME function
adapters/nba.py does - `_simulcast_rows`: one row per outlet, matched on ET date + opponent tricode, the
label keeping the station. tests/test_cavs_simulcast.py is the pattern this follows.

THE MATCH AGAINST THE DATABASE cannot live here (these tests touch no network). It was run once, on
2026-11-16, read-only: each of the ten matched exactly one game, ids in register §77. What is pinned is
the shape a later edit is most likely to break silently - the ten entries, the date+tricode key, and the
rows themselves, against a fixture cut verbatim from the league's own schedule.
"""
from __future__ import annotations

import copy
import datetime as dt
import io
import json
import sys
from contextlib import redirect_stdout
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from adapters import nhl  # noqa: E402

RIGHTS = json.loads((ROOT / "data" / "local_rights.json").read_text(encoding="utf-8"))
SIM = RIGHTS["nhl"]["CBJ"]["simulcasts"]
GAMES = SIM["games"]
FIXTURE = ROOT / "tests" / "fixtures" / "nhl_cbj_simulcast_2026-11.json"
WUAB = "WUAB 43"

# the announcement as Cowork's brief tabulated it: (date, opponent, side, ET kickoff)
ANNOUNCED = [
    ("2026-11-05", "DAL", "home", "7:00"), ("2026-11-12", "TBL", "home", "7:00"),
    ("2026-11-30", "PIT", "away", "7:00"), ("2026-12-07", "TBL", "away", "7:00"),
    ("2027-01-07", "NJD", "away", "7:00"), ("2027-01-21", "CGY", "home", "7:00"),
    ("2027-02-08", "TOR", "away", "7:30"), ("2027-02-11", "OTT", "home", "7:00"),
    ("2027-03-01", "CAR", "home", "7:00"), ("2027-03-22", "PIT", "away", "7:00"),
]


def build(raw):
    with redirect_stdout(io.StringIO()):
        fx, _ = nhl.build_fixture(raw, ROOT, season=2026, anchor_date="2026-11-12", teams=[])
    return {g["id"]: g for g in fx["games"]}


def raw():
    return json.loads(FIXTURE.read_text(encoding="utf-8"))


def wuab_rows(g):
    return [m for m in g["media"] if m["outlet"] == WUAB]


def announced_slate():
    """All ten announced games in the league's own shape: the fixture's verbatim CBJ @ PIT game, re-dated
    and re-paired per announcement, with the club channel's rows on the Blue Jackets' side. Only the
    fields the adapter reads are changed."""
    template = next(g for d in raw()["gameWeek"] for g in d["games"] if g["id"] == 2026020432)
    days = []
    for i, (date, opp, side, et) in enumerate(ANNOUNCED):
        g = copy.deepcopy(template)
        g["id"] = 2026099000 + i
        hh, mm = et.split(":")
        # 7:00 PM ET in winter is 00:00Z the next day; 7:30 is 00:30Z
        nxt = (dt.date.fromisoformat(date) + dt.timedelta(days=1)).isoformat()
        g["startTimeUTC"] = f"{nxt}T00:{mm}:00Z"
        cbj = {"abbrev": "CBJ", "id": 29, "placeName": {"default": "Columbus"}, "commonName": {"default": "Blue Jackets"}}
        other = {"abbrev": opp, "id": 900 + i, "placeName": {"default": opp}, "commonName": {"default": opp}}
        g["homeTeam"], g["awayTeam"] = (cbj, other) if side == "home" else (other, cbj)
        mk = "H" if side == "home" else "A"
        g["tvBroadcasts"] = [{"id": 1, "market": mk, "countryCode": "US", "network": "CBJNHL", "sequenceNumber": 1}]
        days.append({"date": date, "games": [g]})
    return {"gameWeek": days}


# ----------------------------------------------------------------------------------------- the data
def test_all_ten_announced_games_are_here_and_match_the_announcement():
    assert SIM["expectedCount"] == len(GAMES) == 10
    assert [(g["date"], g["opponent"], g["side"]) for g in GAMES] == [(d, o, s) for d, o, s, _ in ANNOUNCED]
    assert all(g["outlets"] == [WUAB] for g in GAMES), "every one is WUAB 43 alone"


def test_the_key_is_date_plus_tricode_because_two_opponents_repeat():
    from collections import Counter
    repeats = sorted(t for t, n in Counter(g["opponent"] for g in GAMES).items() if n > 1)
    assert repeats == ["PIT", "TBL"]
    assert len({(g["date"], g["opponent"]) for g in GAMES}) == 10


def test_the_entry_names_its_source_and_its_date():
    assert SIM["asOf"] == "2026-11-02"
    assert "nhl.com/bluejackets/news/cbj-on-cw" in SIM["source"]
    assert "Cleveland (WUAB, MyNet, 43.1)" in SIM["source"]


# ----------------------------------------------------------------------------------------- the rows
def test_the_two_fixture_nights_each_mint_one_wuab_row_available_with_the_station_in_the_label():
    games = build(raw())
    for gid in ("nhl-2026020304", "nhl-2026020432"):
        rows = wuab_rows(games[gid])
        assert len(rows) == 1, gid
        m = rows[0]
        assert (m["access"], m["market"], m["mediaType"], m["carriageCertainty"]) == ("AVAILABLE", "local", "tv", "CONFIRMED")
        assert m["source"] == "data/local_rights.json simulcasts"
        assert m["label"] == "WUAB 43 simulcast", "the label keeps the station"


def test_all_ten_mint_against_the_league_shape():
    games = build(announced_slate())
    assert len(games) == 10
    for g in games.values():
        assert [m["access"] for m in wuab_rows(g)] == ["AVAILABLE"], g["id"]


def test_a_cbj_game_not_on_the_list_gets_no_wuab_row():
    games = build(raw())
    assert wuab_rows(games["nhl-2026020319"]) == [], "PHI @ CBJ 2026-11-14 is not on the slate"
    assert wuab_rows(games["nhl-2026020430"]) == [], "another club's game on a slate date"


def test_the_opponent_must_match_too_not_just_the_date():
    slate = announced_slate()
    g = slate["gameWeek"][2]["games"][0]          # 2026-11-30 at PIT
    g["homeTeam"]["abbrev"] = "NYR"
    assert wuab_rows(build(slate)["nhl-2026099002"]) == []


def test_the_club_channel_rows_are_unchanged_beside_the_simulcast():
    g = build(raw())["nhl-2026020432"]
    assert sorted((m["outlet"], m["access"]) for m in g["media"] if m["outlet"] != WUAB) == [
        ("CBJHN", "AVAILABLE"), ("CBJNHL", "AVAILABLE"), ("SN-PIT", "OUT_OF_MARKET"), ("WWHO", "OUT_OF_MARKET")]


def test_a_league_row_naming_wuab_is_not_doubled():
    slate = raw()
    g = next(x for d in slate["gameWeek"] for x in d["games"] if x["id"] == 2026020432)
    g["tvBroadcasts"].append({"id": 7, "market": "A", "countryCode": "US", "network": "WUAB", "sequenceNumber": 9})
    rows = wuab_rows(build(slate)["nhl-2026020432"])
    assert [m["source"] for m in rows] == ["nhl.schedule"], "the league's own row wins; the hand-entered one dedupes"


@pytest.mark.parametrize("path", ["adapters/nhl.py"])
def test_the_nhl_adapter_uses_the_nba_function_rather_than_a_copy(path):
    src = (ROOT / path).read_text(encoding="utf-8")
    assert "from adapters.nba import _simulcast_rows" in src
    assert "def _simulcast_rows" not in src and "def simulcast_outlets" not in src


# ------------------------------------------------------------------------- through the loader
# A REAL Harness subclass, collected and run by the test runner, so its setUp patches are released by its
# own addCleanup. (A first version drove setUp/tearDown by hand, skipped the cleanups, and leaked the
# `sync_shadow_program` patch into tests/test_programs_shadow.py - seven failures in the full run only.)
from tests.test_eligibility_follows_access import Harness  # noqa: E402


class ThroughTheLoader(Harness):
    def test_the_wuab_row_is_stored_available_and_the_game_is_eligible(self):
        g = build(raw())["nhl-2026020432"]
        self.load("nhl", [g])
        self.reconcile()
        row = self.db.conn.execute(
            "select access_status, label, delivery_surface from game_broadcasts where game_id = ? and service_id = 'wuab-43' and active",
            (g["id"],)).fetchone()
        self.assertEqual(tuple(row), ("available", "WUAB 43 simulcast", "LINEAR"))
        self.assertEqual(self.eligibility(g["id"])["eligible"], 1)
