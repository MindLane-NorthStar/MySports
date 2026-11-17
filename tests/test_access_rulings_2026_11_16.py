#!/usr/bin/env python3
"""Prompt 132 block A: the access rulings of 2026-11-14 and 2026-11-16 (register §77).

    python -m unittest tests.test_access_rulings_2026_11_16 -v    # from the repo root; stdlib only

A1  "I have DAZN via DirecTV - i get all games on DAZN" (Joe, 2026-11-14). ESPN's `DAZN CLE` is decision
    7's DAZN: an alias in adapters/common.py, the spelling-ruling shape of d646d20 ("ACC Extra" -> ACCNX).
    ONLY that spelling - `DAZN MEM` and the other clubs' DAZN feeds are their markets' products.
A2  "yes i get bluejackets too" (Joe, 2026-11-16). CBJNHL and CBJHN move to `available` in
    data/access_profile.json, superseding the 2026-10-14 ruling (register §74). The Blue Jackets' Prime
    Video add-on stays UNAVAILABLE (2026-10-06). WWHO, CW Columbus, is OUT_OF_MARKET, named with its
    reason in data/local_rights.json nhl.CBJ.outOfMarketStations.
A3  ERADM is ESPN Radio. Decoded 2026-11-16 from ESPN's summary payloads for TEX @ LSU (401856885) and
    GSW @ SA (401909302): `"type": {"id": "5", "shortName": "Radio"}`, `"media": {"callLetters": "ERADM",
    "name": "ESPN Radio", "shortName": "ERADM"}`. Radio is not a broadcast row - adapters/nascar.py's
    precedent - so adapters/espn.py `_broadcast_names` skips ESPN's typed radio entries.
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
from adapters.common import access_lookup, canonical_outlet, local_rights_access, outlet_access  # noqa: E402
from adapters.espn import _broadcast_names, is_radio  # noqa: E402
from tests.test_nfl_market_rules import event  # noqa: E402

AVAILABLE, UNAVAILABLE = access_lookup(ROOT)
RIGHTS = json.loads((ROOT / "data" / "local_rights.json").read_text(encoding="utf-8"))
SIMULCAST_FIXTURE = ROOT / "tests" / "fixtures" / "nhl_cbj_simulcast_2026-11.json"


def access(label):
    return outlet_access(canonical_outlet(label, AVAILABLE, UNAVAILABLE), AVAILABLE, UNAVAILABLE)


def nba_game(eid, away, home, away_ab, home_ab, *geo):
    """One NBA scoreboard event whose geoBroadcasts are exactly `geo`."""
    ev = event(eid, "2026-11-18T00:30:00Z", away, home, "unused", away_ab, home_ab)
    ev["competitions"][0]["geoBroadcasts"] = list(geo)
    with redirect_stdout(io.StringIO()):
        fx, _ = nba.build_from_espn({"events": [ev]}, ROOT, season=2026, day_filter=None, teams=[])
    return fx["games"][0]


def geo(short, market="National", type_=None):
    g = {"lang": "en", "region": "us", "media": {"shortName": short}, "market": {"type": market}}
    if type_:
        g["type"] = type_
    return g


def cbj_nights():
    raw = json.loads(SIMULCAST_FIXTURE.read_text(encoding="utf-8"))
    with redirect_stdout(io.StringIO()):
        fx, _ = nhl.build_fixture(raw, ROOT, season=2026, anchor_date="2026-11-12", teams=[])
    return {g["id"]: g for g in fx["games"]}


# ------------------------------------------------------------------------------------------- A1
class A1DaznCle(unittest.TestCase):
    def test_dazn_cle_is_decision_7s_dazn_and_available(self):
        self.assertEqual(canonical_outlet("DAZN CLE", AVAILABLE, UNAVAILABLE), "DAZN")
        self.assertEqual(access("DAZN CLE"), "AVAILABLE")
        self.assertIn("DAZN", AVAILABLE, "the mechanism is the plain DAZN entry the profile already lists")

    def test_a_cavaliers_game_on_dazn_cle_carries_the_dazn_row_available(self):
        g = nba_game("401909999", ("Bulls", "Chicago Bulls"), ("Cavaliers", "Cleveland Cavaliers"), "CHI", "CLE",
                     geo("DAZN CLE", "Home"), geo("CHSN", "Away"))
        rows = sorted((m["outlet"], m["access"], m["market"]) for m in g["media"])
        self.assertIn(("DAZN", "AVAILABLE", "local"), rows)
        self.assertNotIn("DAZN CLE", [m["outlet"] for m in g["media"]], "no `dazn-cle` stub row is minted")

    def test_another_clubs_dazn_feed_does_not_change(self):
        """`DAZN MEM` keeps its own spelling and, as another club's local feed, stays out of market."""
        self.assertEqual(canonical_outlet("DAZN MEM", AVAILABLE, UNAVAILABLE), "DAZN MEM")
        g = nba_game("401909998", ("Hawks", "Atlanta Hawks"), ("Grizzlies", "Memphis Grizzlies"), "ATL", "MEM",
                     geo("DAZN MEM", "Home"), geo("NBA TV"))
        self.assertIn(("DAZN MEM", "OUT_OF_MARKET"), [(m["outlet"], m["access"]) for m in g["media"]])


# ------------------------------------------------------------------------------------------- A2
class A2BlueJackets(unittest.TestCase):
    def test_the_club_channel_is_available_in_both_spellings(self):
        for label in ("CBJNHL", "CBJHN"):
            with self.subTest(label=label):
                self.assertEqual(access(label), "AVAILABLE")
                self.assertNotIn(label, UNAVAILABLE)

    def test_the_prime_video_add_on_stays_unavailable(self):
        cbj = RIGHTS["nhl"]["CBJ"]
        self.assertEqual((cbj["outlet"], cbj["access"]), ("Prime Video", "UNAVAILABLE"))
        self.assertEqual(local_rights_access(cbj, "CBJ", AVAILABLE, UNAVAILABLE), "UNAVAILABLE")
        self.assertEqual(access("Prime Video"), "AVAILABLE", "Prime Video itself stays on his services")

    def test_a_cbj_game_with_no_club_channel_row_still_carries_the_add_on_unavailable(self):
        raw = json.loads((ROOT / "tests" / "fixtures" / "nhl_schedule_shapes_2026-10-06.json").read_text(encoding="utf-8"))
        with redirect_stdout(io.StringIO()):
            fx, _ = nhl.build_fixture(raw, ROOT, season=2026, anchor_date="2026-10-06", teams=[])
        fla = next(g for g in fx["games"] if g["id"] == "nhl-2026020289")      # FLA @ CBJ: no CBJNHL/CBJHN row
        prime = [m for m in fla["media"] if m["outlet"] == "Prime Video"]
        self.assertEqual([(m["access"], m["source"]) for m in prime], [("UNAVAILABLE", "data/local_rights.json")])

    def test_the_supersession_is_recorded_with_its_dates(self):
        about = json.loads((ROOT / "data" / "access_profile.json").read_text(encoding="utf-8"))["_about"]
        for fact in ("SUPERSEDED 2026-11-16", "2026-10-24", "660", "yes i get bluejackets too"):
            self.assertIn(fact, about)
        self.assertIn("2026-10-24", RIGHTS["nhl"]["CBJ"]["channelDecision"])

    def test_wwho_is_out_of_market_on_both_simulcast_nights(self):
        nights = cbj_nights()
        for gid in ("nhl-2026020304", "nhl-2026020432"):
            with self.subTest(gid=gid):
                wwho = [m["access"] for m in nights[gid]["media"] if m["outlet"] == "WWHO"]
                self.assertEqual(wwho, ["OUT_OF_MARKET"])

    def test_wwho_is_ruled_by_name_with_its_reason_not_by_the_profile(self):
        reason = RIGHTS["nhl"]["CBJ"]["outOfMarketStations"]["WWHO"]
        self.assertIn("CW Columbus", reason)
        self.assertGreater(len(reason), 40)
        self.assertEqual(access("WWHO"), "UNKNOWN", "the profile knows nothing of WWHO; the NHL adapter's list does")

    def test_a_blue_jackets_night_resolves_to_an_available_channel_row(self):
        g = cbj_nights()["nhl-2026020319"]       # PHI @ CBJ, 11-14: not a simulcast night
        self.assertEqual(sorted((m["outlet"], m["access"]) for m in g["media"]),
                         [("CBJHN", "AVAILABLE"), ("CBJNHL", "AVAILABLE"), ("NBCSP", "OUT_OF_MARKET")])


# ------------------------------------------------------------------------------------------- A3
# ESPN's own entries, VERBATIM from the 2026-11-16 decode (scoreboard 2026-11-13, event 401909302 GS @ SA)
ERADM_TYPED = {"type": {"id": "5", "shortName": "Radio"}, "market": {"id": "1", "type": "National"},
               "media": {"shortName": "ERADM"}, "lang": "en", "region": "us"}
PRIME_TYPED = {"type": {"id": "4", "shortName": "Streaming"}, "market": {"id": "1", "type": "National"},
               "media": {"shortName": "Prime Video"}, "lang": "en", "region": "us"}


class A3EspnRadio(unittest.TestCase):
    def test_the_decoded_entry_is_radio_and_the_tv_entry_is_not(self):
        self.assertTrue(is_radio(ERADM_TYPED))
        self.assertFalse(is_radio(PRIME_TYPED))
        self.assertFalse(is_radio({"media": {"shortName": "ESPN"}}), "an untyped entry is not radio")

    def test_eradm_is_not_a_broadcast_row(self):
        comp = {"geoBroadcasts": [ERADM_TYPED, PRIME_TYPED], "broadcasts": [{"market": "national", "names": ["Prime Video"]}]}
        self.assertEqual(_broadcast_names(comp, AVAILABLE, UNAVAILABLE), [("Prime Video", "national")])

    def test_a_typed_radio_name_cannot_come_back_through_the_flat_list(self):
        comp = {"geoBroadcasts": [ERADM_TYPED], "broadcasts": [{"market": "national", "names": ["ERADM", "ABC"]}]}
        self.assertEqual(_broadcast_names(comp, AVAILABLE, UNAVAILABLE), [("ABC", "national")])

    def test_gsw_at_sa_mints_prime_video_and_no_eradm_row(self):
        g = nba_game("401909302", ("Warriors", "Golden State Warriors"), ("Spurs", "San Antonio Spurs"), "GS", "SA",
                     ERADM_TYPED, PRIME_TYPED)
        self.assertEqual([(m["outlet"], m["access"]) for m in g["media"]], [("Prime Video", "AVAILABLE")])


# --------------------------------------------------------------------- A1's follow-up: DAZN's surface
# Found by the refresh that cleared smoke (h), 2026-11-16: the `DAZN CLE` alias minted ESPN's row as LINEAR,
# because adapters/nba.py's STREAM_ONLY lacked DAZN, so nba-401909307, -401909995 and -401910007 each gained a
# LINEAR DAZN row beside their STREAMING "Cavaliers on DAZN (RESN)" row - DAZN twice in the detail panel and an
# unintended DIRECTV link. pipeline/load.py keys a row's `active` on service id alone, so the loader can never
# retire the second row; the fix has to stop it being minted.
from adapters import espn as espn_adapter, mlb as mlb_adapter  # noqa: E402
from tests.test_eligibility_follows_access import Harness  # noqa: E402


class A1DaznIsStreaming(unittest.TestCase):
    def test_espns_dazn_cle_row_is_a_streaming_row(self):
        g = nba_game("401909995", ("Bulls", "Chicago Bulls"), ("Cavaliers", "Cleveland Cavaliers"), "CHI", "CLE",
                     geo("DAZN CLE", "Home"))
        self.assertEqual([(m["outlet"], m["mediaType"]) for m in g["media"]], [("DAZN", "web")])

    def test_every_adapter_that_decides_a_surface_by_name_calls_dazn_streaming(self):
        """The sweep of 2026-11-16: four adapters decide streaming-or-linear from a set of names, and the
        `DAZN CLE` alias in adapters/common.py reaches all of them. Each set carries DAZN."""
        for name, s in (("nba.STREAM_ONLY", nba.STREAM_ONLY), ("espn.STREAM_ONLY", espn_adapter.STREAM_ONLY),
                        ("nhl.STREAM_ONLY", nhl.STREAM_ONLY), ("mlb.STREAMING", mlb_adapter.STREAMING)):
            with self.subTest(name=name):
                self.assertIn("DAZN", s)

    def test_the_nhl_adapter_reads_its_named_set_not_an_inline_one(self):
        src = (ROOT / "adapters" / "nhl.py").read_text(encoding="utf-8")
        self.assertIn('mtype = "web" if outlet in STREAM_ONLY else "tv"', src)


class A1OneDaznRowThroughTheLoader(Harness):
    def test_the_dazn_cle_row_merges_into_the_cavaliers_streaming_row(self):
        """The production sequence: the game first carries the hand-entered DAZN row (no ESPN local feed),
        then ESPN names `DAZN CLE`. One active DAZN row must remain, and it must be STREAMING."""
        before = nba_game("401909995", ("Bulls", "Chicago Bulls"), ("Cavaliers", "Cleveland Cavaliers"), "CHI", "CLE",
                          geo("NBA TV"))
        self.assertIn(("DAZN", "web", "data/local_rights.json"),
                      [(m["outlet"], m["mediaType"], m["source"]) for m in before["media"]], "the premise")
        self.load("nba", [before])
        self.reconcile()
        after = nba_game("401909995", ("Bulls", "Chicago Bulls"), ("Cavaliers", "Cleveland Cavaliers"), "CHI", "CLE",
                         geo("DAZN CLE", "Home"), geo("NBA TV"))
        self.load("nba", [after])
        self.reconcile()
        rows = self.db.conn.execute(
            "select delivery_surface, access_status from game_broadcasts where game_id = ? and service_id = 'dazn' and active",
            (after["id"],)).fetchall()
        self.assertEqual([tuple(r) for r in rows], [("STREAMING", "available")])


if __name__ == "__main__":
    unittest.main()
