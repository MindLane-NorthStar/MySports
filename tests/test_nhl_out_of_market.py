#!/usr/bin/env python3
"""Prompt 128: an out-of-market NHL game names ESPN+, and the Blue Jackets' Prime Video add-on is not on Joe's services.

    python -m pytest tests/test_nhl_out_of_market.py -q        # from the repo root; no network, no database

JOE'S RULINGS, 2026-10-06. (1) "Surface ESPN+ as the broadcast provider for ALL NHL games that are not
airing on one of the other primary national broadcast providers (ESPN, ABC, TBS, TNT)." (2) "NHL Network
games are NOT on my services." (3) "Columbus Blue Jackets amazon prime broadcasts are an extra paid tier so
those broadcasts need to be marked as blacked out for me (unavailable)." Register §72.

WHAT IS PROVED HERE, and through what. The adapter on two recorded files - the ten-game file captured
for this prompt (one game per broadcast shape) and the tracked 47-game file - with the rule on, off,
and against an edited access profile. The local-rights access function on every value it can meet.
The reconciler's own functions on these games' claims. And, through the SQLite harness prompt 123
built (imported, not copied), the two things that need the loader: a package row RETIRES when the
league names a national row, and the Blue Jackets' access change reaches the verdict.

The edited data files live in a temporary root and are edited through a parser; the tree's own
data/ is never written.
"""
from __future__ import annotations

import copy
import io
import json
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import pipeline.load as load  # noqa: E402
from adapters.common import local_rights_access, outlet_access  # noqa: E402
from adapters.nba import _local_row  # noqa: E402
from adapters.nhl import PACKAGE_SOURCE, build_fixture, takes_out_of_market_package  # noqa: E402
from pipeline.reconcile import rail_order, telecast_verdict  # noqa: E402
from pipeline.resolver import Observation, load_rules, primary_candidates, resolve_field  # noqa: E402
from tests.test_eligibility_follows_access import Harness  # noqa: E402

SHAPES = ROOT / "tests" / "fixtures" / "nhl_schedule_shapes_2026-10-06.json"
TRACKED = ROOT / "tests" / "fixtures" / "nhl_schedule_raw.json"
RULES = load_rules()
NOW = datetime(2026, 10, 6, 23, 0, tzinfo=timezone.utc)

VGK_SEA, PIT_CBJ, PHI_DET, TOR_EDM = "nhl-2026020051", "nhl-2026020068", "nhl-2026020110", "nhl-2026020176"
MTL_DAL, NJD_VGK, FLA_CBJ = "nhl-2026020209", "nhl-2026020214", "nhl-2026020289"


def raw(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def build(payload: dict, root: Path = ROOT) -> dict[str, dict]:
    """The adapter's own games, keyed by id. teams=[] as tests/test_nhl_odds.py passes it."""
    with redirect_stdout(io.StringIO()):
        fx, _ = build_fixture(payload, root, season=2026, anchor_date="2026-10-06", teams=[])
    return {g["id"]: g for g in fx["games"]}


def rows(game: dict) -> list[tuple[str, str, str]]:
    return [(m["outlet"], m["access"], m["market"]) for m in game["media"]]


def package_rows(game: dict) -> list[dict]:
    return [m for m in game["media"] if m.get("source") == PACKAGE_SOURCE]


def raw_game(payload: dict, gid: str) -> dict:
    return next(g for d in payload["gameWeek"] for g in d["games"] if f"nhl-{g['id']}" == gid)


def one_game(game: dict, **changes) -> dict:
    """A one-game schedule payload around a copy of a raw league game."""
    return {"gameWeek": [{"date": game["startTimeUTC"][:10], "games": [dict(copy.deepcopy(game), **changes)]}]}


def data_root(tmp: Path, **edits) -> Path:
    """A repo root whose data/ holds the three files build_fixture reads, each edited through the parser
    by the callable named for it (markets, local_rights, access_profile)."""
    (tmp / "data").mkdir()
    for name in ("markets.json", "local_rights.json", "access_profile.json"):
        doc = json.loads((ROOT / "data" / name).read_text(encoding="utf-8"))
        edit = edits.get(name.removesuffix(".json"))
        if edit:
            edit(doc)
        (tmp / "data" / name).write_text(json.dumps(doc), encoding="utf-8", newline="\n")
    return tmp


def package_off(doc: dict) -> None:
    del doc["nhl"]["outOfMarketPackage"]


def cbj_as_at_7b11fb1(doc: dict) -> None:
    """The Blue Jackets' entry as prompt 127's tree held it: no `access`, so the profile decided."""
    del doc["nhl"]["CBJ"]["access"]
    doc["nhl"]["CBJ"]["label"] = "Blue Jackets on Prime Video"


class _Tmp(unittest.TestCase):
    def setUp(self):
        self._td = tempfile.TemporaryDirectory()
        self.addCleanup(self._td.cleanup)
        self.tmp = Path(self._td.name)


# ------------------------------------------------------------------------------- the ten games
AFTER = {
    "nhl-2026020048": [("ESPN", "AVAILABLE", "national")],
    VGK_SEA: [("Prime Video", "OUT_OF_MARKET", "local"), ("KING", "OUT_OF_MARKET", "local"),
              ("KONG", "OUT_OF_MARKET", "local"), ("SCRIPPS", "OUT_OF_MARKET", "local"), ("ESPN+", "AVAILABLE", "national")],
    PIT_CBJ: [("CBJNHL", "UNKNOWN", "local"), ("CBJHN", "UNKNOWN", "local"), ("SN-PIT", "OUT_OF_MARKET", "local"),
              ("Prime Video", "UNAVAILABLE", "local")],
    PHI_DET: [("ESPN+", "AVAILABLE", "national"), ("Hulu", "UNKNOWN", "national"), ("Disney+", "AVAILABLE", "national")],
    TOR_EDM: [("ESPN+", "AVAILABLE", "national")],
    "nhl-2026020199": [("TNT", "AVAILABLE", "national"), ("truTV", "AVAILABLE", "national"),
                       ("HBO Max", "AVAILABLE", "national"), ("NBCSP+", "OUT_OF_MARKET", "local")],
    MTL_DAL: [("Prime Video", "OUT_OF_MARKET", "local"), ("ESPN+", "AVAILABLE", "national")],
    NJD_VGK: [("NHL Network", "UNAVAILABLE", "national"), ("MSGSN", "OUT_OF_MARKET", "local"),
              ("SCRIPPS", "OUT_OF_MARKET", "local")],
    FLA_CBJ: [("ESPN+", "AVAILABLE", "national"), ("Hulu", "UNKNOWN", "national"), ("Disney+", "AVAILABLE", "national"),
              ("Prime Video", "UNAVAILABLE", "local")],
    "nhl-2026021319": [("TNT", "AVAILABLE", "national"), ("truTV", "AVAILABLE", "national"),
                       ("HBO Max", "AVAILABLE", "national"), ("NBCSP+", "OUT_OF_MARKET", "local"),
                       ("Prime Video", "UNAVAILABLE", "local")],
}
PACKAGE_GAMES = {VGK_SEA, TOR_EDM, MTL_DAL}


class TenGames(unittest.TestCase):
    def setUp(self):
        self.games = build(raw(SHAPES))

    def test_every_game_reads_as_the_brief_measured_it(self):
        self.assertEqual(set(self.games), set(AFTER))
        for gid, want in AFTER.items():
            self.assertEqual(rows(self.games[gid]), want, gid)

    def test_the_package_row_is_one_row_on_exactly_three_games(self):
        for gid, g in self.games.items():
            pkg = package_rows(g)
            self.assertEqual(len(pkg), 1 if gid in PACKAGE_GAMES else 0, gid)
            for m in pkg:
                self.assertEqual(m["source"], "data/markets.json nhl.outOfMarketPackage", "the rule's own name")
                self.assertEqual(m["label"], "NHL Power Play on ESPN+")
                self.assertEqual((m["mediaType"], m["market"], m["carriageCertainty"]), ("web", "national", "CONFIRMED"))
        # a game the league already lists on ESPN+ keeps exactly one ESPN+ row, the league's own
        for gid in (PHI_DET, FLA_CBJ):
            espn_plus = [m for m in self.games[gid]["media"] if m["outlet"] == "ESPN+"]
            self.assertEqual([m["source"] for m in espn_plus], ["nhl.schedule"], gid)

    def test_the_blue_jackets_row_is_the_add_on(self):
        for gid in (PIT_CBJ, FLA_CBJ, "nhl-2026021319"):
            prime = [m for m in self.games[gid]["media"] if m["outlet"] == "Prime Video"]
            self.assertEqual(len(prime), 1, gid)
            self.assertEqual((prime[0]["access"], prime[0]["source"], prime[0]["label"]),
                             ("UNAVAILABLE", "data/local_rights.json", "Blue Jackets on Prime Video (add-on subscription)"), gid)

    def test_no_game_in_the_file_is_reported_as_having_no_us_row(self):
        with redirect_stdout(io.StringIO()):
            _, notes = build_fixture(raw(SHAPES), ROOT, season=2026, anchor_date="2026-10-06", teams=[])
        self.assertEqual(notes, [], "TOR @ EDM carries the package row, so it is not a 'no US broadcast rows' game")


# ------------------------------------------------------------------------------ the tracked file
class TrackedFile(_Tmp):
    def test_38_take_the_row_alone_7_are_unchanged_and_2_carry_the_add_on(self):
        games = build(raw(TRACKED))
        off = build(raw(TRACKED), data_root(self.tmp, markets=package_off))
        self.assertEqual(len(games), 47)
        alone = [gid for gid, g in games.items() if len(g["media"]) == 1 and package_rows(g)]
        self.assertEqual(len(alone), 38)
        self.assertEqual(sum(1 for g in games.values() if package_rows(g)), 38, "and no other game takes it")
        national = [gid for gid, g in games.items()
                    if any(m["market"] == "national" and m["source"] == "nhl.schedule" for m in g["media"])]
        self.assertEqual(len(national), 7)
        for gid in national:
            self.assertEqual(games[gid]["media"], off[gid]["media"], f"{gid}: unchanged by the rule")
        cbj = [g for g in games.values() if "CBJ" in (g["home"]["abbreviation"], g["away"]["abbreviation"])]
        self.assertEqual(len(cbj), 2)
        for g in cbj:
            self.assertEqual(rows(g), [("Prime Video", "UNAVAILABLE", "local")], g["id"])
        self.assertEqual(len(alone) + len(national) + len(cbj), 47, "three classes cover the file")


# ------------------------------------------------------------------- the conditions, one at a time
class GameType(unittest.TestCase):
    def test_preseason_and_playoffs_take_no_package_row(self):
        vgk = raw_game(raw(SHAPES), VGK_SEA)
        self.assertEqual(len(package_rows(build(one_game(vgk))[VGK_SEA])), 1, "the regular-season game does")
        for game_type in (1, 3):
            g = build(one_game(vgk, gameType=game_type))[VGK_SEA]
            self.assertEqual(package_rows(g), [], f"gameType {game_type}")


class TheSwitch(_Tmp):
    def test_with_the_entry_absent_no_game_in_either_file_takes_the_row(self):
        root = data_root(self.tmp, markets=package_off)
        for path in (SHAPES, TRACKED):
            for gid, g in build(raw(path), root).items():
                self.assertEqual(package_rows(g), [], f"{path.name} {gid}")

    def test_an_entry_missing_outlet_or_game_types_adds_nothing(self):
        entry = {"outlet": "ESPN+", "label": "x", "gameTypes": ["regular"]}
        self.assertTrue(takes_out_of_market_package("regular", "VGK", "SEA", [], {"CBJ"}, entry))
        for broken in ({k: v for k, v in entry.items() if k != "outlet"},
                       {k: v for k, v in entry.items() if k != "gameTypes"},
                       dict(entry, gameTypes=[]), None, {}):
            self.assertFalse(takes_out_of_market_package("regular", "VGK", "SEA", [], {"CBJ"}, broken), broken)

    def test_the_rule_reads_each_condition(self):
        entry = {"outlet": "ESPN+", "gameTypes": ["regular"]}
        local = [{"outlet": "KING", "market": "local"}]
        self.assertTrue(takes_out_of_market_package("regular", "SEA", "VGK", local, {"CBJ"}, entry))
        self.assertFalse(takes_out_of_market_package("preseason", "SEA", "VGK", local, {"CBJ"}, entry), "game type")
        self.assertFalse(takes_out_of_market_package("regular", "CBJ", "PIT", local, {"CBJ"}, entry), "home team local")
        self.assertFalse(takes_out_of_market_package("regular", "PIT", "CBJ", local, {"CBJ"}, entry), "away team local")
        unseen = [{"outlet": "Some New Network", "market": "national"}]
        self.assertFalse(takes_out_of_market_package("regular", "SEA", "VGK", unseen, {"CBJ"}, entry),
                         "ANY national row withholds it, a name nobody has listed included")
        self.assertFalse(takes_out_of_market_package("regular", "SEA", "VGK", [{"outlet": "ESPN+", "market": "local"}],
                                                     {"CBJ"}, entry), "the outlet already has a row")


class TheProfileDecides(_Tmp):
    def test_espn_plus_listed_unavailable_makes_the_package_row_unavailable(self):
        def espn_plus_out(doc):
            doc["unavailable"].append("ESPN+")
        g = build(raw(SHAPES), data_root(self.tmp, access_profile=espn_plus_out))[VGK_SEA]
        self.assertEqual([m["access"] for m in package_rows(g)], ["UNAVAILABLE"])


# --------------------------------------------------------------------- the local-rights access function
class LocalRightsAccess(unittest.TestCase):
    ENTRY = {"status": "CONFIRMED", "outlet": "Prime Video", "surface": "web"}

    def test_a_stated_access_wins_and_an_absent_one_leaves_it_to_the_profile(self):
        avail, unavail = {"Prime Video"}, set()
        self.assertEqual(local_rights_access(dict(self.ENTRY, access="UNAVAILABLE"), "CBJ", avail, unavail), "UNAVAILABLE")
        self.assertEqual(local_rights_access(dict(self.ENTRY, access="AVAILABLE"), "CBJ", set(), {"Prime Video"}), "AVAILABLE")
        self.assertEqual(local_rights_access(self.ENTRY, "CBJ", avail, unavail), "AVAILABLE", "absent: the profile")
        self.assertEqual(local_rights_access(self.ENTRY, "CBJ", set(), {"Prime Video"}), "UNAVAILABLE", "absent: the profile")

    def test_a_misspelled_value_is_unknown_and_says_so(self):
        out = io.StringIO()
        with redirect_stdout(out):
            got = local_rights_access(dict(self.ENTRY, access="UNAVAILBLE"), "CBJ", {"Prime Video"}, set())
        self.assertEqual(got, "UNKNOWN")
        self.assertIn("CBJ", out.getvalue())
        self.assertIn("'UNAVAILBLE'", out.getvalue())

    def test_every_access_in_the_real_file_is_one_of_the_two(self):
        doc = raw(ROOT / "data" / "local_rights.json")
        stated = [(sport, team, e["access"]) for sport in ("nhl", "nba") for team, e in doc[sport].items() if "access" in e]
        self.assertIn(("nhl", "CBJ", "UNAVAILABLE"), stated)
        for sport, team, value in stated:
            self.assertIn(value, ("AVAILABLE", "UNAVAILABLE"), f"{sport}.{team}")
        self.assertIn("previousDecision", doc["nhl"]["CBJ"], "the 2026-09-09 ruling is kept as history")

    def test_the_cavaliers_row_is_what_it_was(self):
        """nba.CLE states no access, so the profile decides, exactly as before prompt 128."""
        doc = raw(ROOT / "data" / "local_rights.json")
        self.assertNotIn("access", doc["nba"]["CLE"])
        prof = raw(ROOT / "data" / "access_profile.json")
        avail, unavail = set(prof["available"]), set(prof["unavailable"])
        row = _local_row({"abbreviation": "CLE", "team": "Cavaliers"}, doc["nba"], "2026-10-28T23:00:00Z", False, avail, unavail)
        self.assertEqual((row["outlet"], row["access"], row["market"], row["label"]),
                         ("DAZN", outlet_access("DAZN", avail, unavail), "local", "Cavaliers on DAZN (RESN)"))
        self.assertEqual(row["access"], "AVAILABLE")


# ------------------------------------------------------------------- the reconciler, through its functions
def claims(game: dict) -> list[Observation]:
    """The game's rows as `broadcast` observations, filed under the source pipeline/load.py files each
    under (:317-321), with surface and feed as pipeline/reconcile.py reads them back (:189-195)."""
    out = []
    for i, m in enumerate(game["media"], 1):
        src = "data/local_rights" if (m.get("source") or "").startswith("data/local_rights") else "nhl.schedule"
        sid = load.slug(m["outlet"])
        surface = "STREAMING" if m["mediaType"] == "web" or m["outlet"] in load.STREAM_TYPES else "LINEAR"
        out.append(Observation(i, src, "league_api", 80, f"{sid}|{m['market']}|{m['carriageCertainty']}", "definite",
                               observed_at=NOW, extra={"service_id": sid, "name": m["outlet"], "surface": surface,
                                                       "feed": "NATIONAL" if m["market"] == "national" else "HOME"}))
    return out


def primary(game: dict) -> str:
    cands, _ = primary_candidates(claims(game), rail_order("nhl"), RULES)
    return resolve_field("primary_network", cands, RULES, None, NOW).value


def active_rows(game: dict) -> list[dict]:
    """The game_broadcasts columns telecast_verdict reads, as pipeline/load.py writes them."""
    out = []
    for m in game["media"]:
        acc = load.ACCESS.get(m["access"], "unknown")
        out.append({"service_id": load.slug(m["outlet"]), "access_status": acc,
                    "blackout_rule": "OUT_OF_MARKET" if acc == "out_of_market" else "NONE",
                    "delivery_surface": "STREAMING" if m["mediaType"] == "web" else "LINEAR",
                    "carriage_certainty": m["carriageCertainty"]})
    return out


def verdict(game: dict) -> tuple:
    reason, _status, eligible, via_net, via_srv = telecast_verdict(
        "nhl", active_rows(game), RULES, network_id=primary(game), stream_exclusive=False, canonical_state="fully_assigned")
    return eligible, via_net, via_srv, reason


class TheReconciler(_Tmp):
    def setUp(self):
        super().setUp()
        self.games = build(raw(SHAPES))
        self.off = build(raw(SHAPES), data_root(self.tmp, markets=package_off))

    def test_on_mtl_at_dal_the_package_row_is_primary(self):
        self.assertEqual(len(claims(self.games[MTL_DAL])), 2)
        cands, _ = primary_candidates(claims(self.games[MTL_DAL]), rail_order("nhl"), RULES)
        self.assertEqual([c.value for c in cands], ["espn-plus"], "a national stream outranks a local one")

    def test_on_vgk_at_sea_a_linear_local_row_stays_primary(self):
        got, without = primary(self.games[VGK_SEA]), primary(self.off[VGK_SEA])
        self.assertEqual(got, without, "the package row does not move the primary")
        self.assertIn(got, {"king", "kong", "scripps"})

    def test_vgk_at_sea_is_eligible_on_espn_plus(self):
        eligible, via_net, via_srv, reason = verdict(self.games[VGK_SEA])
        self.assertTrue(eligible)
        self.assertEqual((via_net, via_srv), (None, ["espn-plus"]))
        self.assertEqual(reason, "stream only: espn-plus")
        self.assertFalse(verdict(self.off[VGK_SEA])[0], "and it was not without the rule")

    def test_pit_at_cbj_and_njd_at_vgk_are_not_eligible(self):
        for gid in (PIT_CBJ, NJD_VGK):
            self.assertFalse(verdict(self.games[gid])[0], gid)


# ------------------------------------------------- through the loader: retirement and an access change
class ThroughTheLoader(Harness):
    def broadcast(self, gid: str, sid: str) -> tuple:
        return self.db.conn.execute("select active, access_status from game_broadcasts where game_id = ? and service_id = ?",
                                    (gid, sid)).fetchone()

    def test_the_package_row_retires_when_the_league_names_a_national_row(self):
        shapes = raw(SHAPES)
        self.load("nhl", [build(shapes)[VGK_SEA]])
        self.reconcile()
        self.assertEqual(self.broadcast(VGK_SEA, "espn-plus"), (1, "available"))
        self.assertEqual(self.eligibility(VGK_SEA)["eligible"], 1)
        # the league names NHL Network for the game, as it names its games in batches
        vgk = raw_game(shapes, VGK_SEA)
        named = one_game(vgk, tvBroadcasts=vgk["tvBroadcasts"] + [
            {"id": 999, "market": "N", "countryCode": "US", "network": "NHLN", "sequenceNumber": 99}])
        later = build(named)[VGK_SEA]
        self.assertEqual(package_rows(later), [], "the premise: the adapter withholds the row now")
        self.load("nhl", [later])
        self.reconcile()
        self.assertEqual(self.broadcast(VGK_SEA, "espn-plus")[0], 0, "the ESPN+ row is inactive")
        self.assertEqual(self.broadcast(VGK_SEA, "nhl-network"), (1, "unavailable"))
        self.assertEqual(self.eligibility(VGK_SEA)["eligible"], 0)

    def test_the_blue_jackets_access_change_reaches_the_verdict(self):
        with tempfile.TemporaryDirectory() as td:
            before = build(raw(SHAPES), data_root(Path(td), local_rights=cbj_as_at_7b11fb1))[PIT_CBJ]
        self.assertIn(("Prime Video", "AVAILABLE", "local"), rows(before), "the premise: prompt 127's tree")
        self.load("nhl", [before])
        self.reconcile()
        self.assertEqual(self.eligibility(PIT_CBJ)["eligible"], 1)
        self.load("nhl", [build(raw(SHAPES))[PIT_CBJ]])
        self.reconcile()
        self.assertEqual(self.broadcast(PIT_CBJ, "prime-video"), (1, "unavailable"))
        self.assertEqual(self.eligibility(PIT_CBJ)["eligible"], 0)


if __name__ == "__main__":
    unittest.main()
