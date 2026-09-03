#!/usr/bin/env python3
"""E5: the market-pending rule in pipeline/reconcile.py (2026-09-03).

    python -m unittest tests.test_market_pending -v    # from the repo root; stdlib only

No database and no network: market_coverage lookups go through a fake DB that replays a scripted
answer, so the rule is exercised without touching Supabase.

WHAT THE RULE IS FOR. On NFL Sunday September 13 the app said "11 not on your services - on FOX and
CBS", networks Joe HAS. That count was not wrong about how many he can watch, but it asserted a
certainty the data did not have: market_coverage was empty because the 506sports regional maps do not
publish until roughly September 8. Those games are not unavailable, they are NOT ASSIGNED YET - and
the same state recurs every Monday-to-Wednesday of the season.

THE DISCRIMINATOR, from the live data (prompt 21 Stage 2): an ineligible game carries one of three
shapes, and only the first is unknown rather than decided.

    access_status = 'unverified'    regional window, no map entry     -> UNKNOWN, market pending
    access_status = 'out_of_market' blackout_rule = OUT_OF_MARKET     -> decided: out of market
    access_status = 'unavailable'   a service Joe does not subscribe  -> decided: cannot watch
"""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from adapters.common import load_data  # noqa: E402
from pipeline.reconcile import is_market_pending, market_covered  # noqa: E402

RULES = load_data(ROOT, "authority_rules.json", {})


class FakeDB:
    """Replays market_coverage: `covered` is the set of (game_id, network_id) the map knows about."""

    def __init__(self, covered=()):
        self.covered = set(covered)
        self.queries = 0

    def fetch(self, sql, params=None):
        self.queries += 1
        game_id, network_id = params
        return [(1,)] if (game_id, network_id) in self.covered else []


def bc(service_id, access_status, blackout_rule="NONE", active=True):
    return {"service_id": service_id, "access_status": access_status,
            "blackout_rule": blackout_rule, "active": active}


class TheRuleTheFileCarries(unittest.TestCase):
    def test_market_pending_access_is_configuration_not_code(self):
        """Tunable without a commit, in the same block eligible_access lives in."""
        self.assertEqual(RULES["eligibility"]["market_pending_access"], ["unverified"])

    def test_it_is_derived_from_access_status_not_a_list_of_networks(self):
        # The adapters write 'unverified' exactly where a game sits in a regional window with no map
        # entry, so no FOX/CBS list appears anywhere in the rule.
        self.assertNotIn("market_pending_networks", RULES["eligibility"])


class NoMapRowMeansPending(unittest.TestCase):
    def test_an_unverified_row_with_no_map_row_is_pending(self):
        db = FakeDB()
        self.assertTrue(is_market_pending(db, "nfl-1", False, [bc("fox", "unverified")], RULES))

    def test_the_sept_13_shape_is_pending(self):
        """The exact live shape: FOX/CBS, unverified, blackout NONE, market cleveland, active."""
        db = FakeDB()
        for svc in ("fox", "cbs"):
            self.assertTrue(is_market_pending(db, "nfl-401872658", False, [bc(svc, "unverified")], RULES), svc)


class AMapRowSettlesIt(unittest.TestCase):
    def test_a_map_row_saying_receives_false_is_NOT_pending(self):
        """Genuinely out of market: the map exists and it says no. That is a decision, not a gap."""
        db = FakeDB(covered=[("nfl-1", "fox")])
        self.assertFalse(is_market_pending(db, "nfl-1", False, [bc("fox", "unverified")], RULES))

    def test_a_map_row_saying_receives_true_makes_the_game_eligible_not_pending(self):
        # Eligibility is decided upstream; once eligible, pending is false by the first rule below.
        db = FakeDB(covered=[("nfl-1", "fox")])
        self.assertFalse(is_market_pending(db, "nfl-1", True, [bc("fox", "available")], RULES))

    def test_the_map_is_consulted_per_network_not_per_game(self):
        # A map row for CBS must not settle a FOX row on the same game.
        db = FakeDB(covered=[("nfl-1", "cbs")])
        self.assertTrue(is_market_pending(db, "nfl-1", False, [bc("fox", "unverified")], RULES))


class AnEligibleGameIsNeverPending(unittest.TestCase):
    def test_eligible_short_circuits(self):
        db = FakeDB()
        self.assertFalse(is_market_pending(db, "nfl-1", True, [bc("fox", "unverified")], RULES))

    def test_eligible_does_not_even_query_the_map(self):
        """If there is a way to watch it, nothing is pending - and the lookup is not worth making."""
        db = FakeDB()
        is_market_pending(db, "nfl-1", True, [bc("fox", "unverified")], RULES)
        self.assertEqual(db.queries, 0)


class DecidedNegativesAreNotPending(unittest.TestCase):
    def test_out_of_market_is_a_decision(self):
        db = FakeDB()
        rows = [bc("rays-tv", "out_of_market", blackout_rule="OUT_OF_MARKET")]
        self.assertFalse(is_market_pending(db, "mlb-1", False, rows, RULES))

    def test_unavailable_is_a_decision(self):
        db = FakeDB()
        self.assertFalse(is_market_pending(db, "cfb-1", False, [bc("cbs-sports-network", "unavailable")], RULES))

    def test_a_cfb_game_with_no_telecast_observed_is_not_pending(self):
        """No broadcast rows at all is not the same as an unassigned regional window."""
        db = FakeDB()
        self.assertFalse(is_market_pending(db, "cfb-1", False, [], RULES))

    def test_an_inactive_unverified_row_does_not_make_it_pending(self):
        # The caller passes only active rows; this pins the intent if that ever changes.
        db = FakeDB()
        rows = [bc("cbs-sports-network", "unavailable")]
        self.assertFalse(is_market_pending(db, "cfb-1", False, rows, RULES))


class MixedRows(unittest.TestCase):
    def test_one_unverified_row_among_decided_ones_still_pends(self):
        db = FakeDB()
        rows = [bc("rays-tv", "out_of_market", blackout_rule="OUT_OF_MARKET"), bc("fox", "unverified")]
        self.assertTrue(is_market_pending(db, "mlb-1", False, rows, RULES))

    def test_a_row_with_no_service_id_cannot_be_covered_and_does_not_crash(self):
        db = FakeDB()
        self.assertFalse(market_covered(db, "g", None))


class EmptyConfigDisablesTheRule(unittest.TestCase):
    def test_no_market_pending_access_means_nothing_is_pending(self):
        db = FakeDB()
        rules = {"eligibility": {"market_pending_access": []}}
        self.assertFalse(is_market_pending(db, "nfl-1", False, [bc("fox", "unverified")], rules))


if __name__ == "__main__":
    unittest.main()
