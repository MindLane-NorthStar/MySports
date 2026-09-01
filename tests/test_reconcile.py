#!/usr/bin/env python3
"""Reconciliation fixtures from spec §19, run against the pure resolver (pipeline/resolver.py).

    python -m unittest tests.test_reconcile -v        # from the repo root; stdlib only

Each test is a synthetic observation set: no database, no network, Windows-portable.
"""
from __future__ import annotations

import sys
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from pipeline.resolver import (Decision, Observation, canonical_state, load_rules, primary_candidates,  # noqa: E402
                               resolve_field, rights_context)

RULES = load_rules()
NOW = datetime(2026, 9, 1, 12, 0, tzinfo=timezone.utc)
T0 = NOW - timedelta(days=3)


def obs(i, src, role, value, cert="definite", rights=None, updated=None, valid_to=None, observed=T0, **extra):
    return Observation(i, src, role, 50, value, cert, observed_at=observed, updated_at=updated, valid_to=valid_to, rights_match=rights, extra=extra)


def bc(i, src, role, service, name, surface="LINEAR", feed="NATIONAL", cert="definite", valid_to=None):
    return obs(i, src, role, f"{service}|national|CONFIRMED", cert, valid_to=valid_to, service_id=service, name=name, surface=surface, feed=feed)


class ToledoAtMichiganState(unittest.TestCase):
    """spec 9.8: rights controller + broadcaster (FS1) override the official aggregator (ESPNU); NCAA row kept as evidence."""

    def setUp(self):
        self.cands = [
            obs(1, "bigten.org", "rights_controller", "fs1", rights=True),
            obs(2, "getsomemaction.com", "rights_controller", "fs1", rights=False),   # MAC: corroborates, does not control
            obs(3, "fox.pressroom", "broadcaster", "fs1"),
            obs(4, "ncaa.com", "official_aggregator", "espnu"),
        ]

    def test_fs1_wins_and_ncaa_is_rejected_evidence(self):
        d = resolve_field("primary_network", self.cands, RULES, None, NOW)
        self.assertEqual((d.status, d.value, d.winner_id), ("accepted", "fs1", 1))
        self.assertIn(4, d.rejected_ids)
        self.assertIn("ncaa.com=espnu", d.reason)
        self.assertFalse(d.conflict)

    def test_no_voting(self):
        """spec 9.7: three lower sources agreeing on ESPNU must not outvote the one controlling source."""
        cands = [obs(1, "bigten.org", "rights_controller", "fs1", rights=True)] + [obs(i, f"agg{i}", "official_aggregator", "espnu") for i in (5, 6, 7)]
        d = resolve_field("primary_network", cands, RULES, None, NOW)
        self.assertEqual(d.value, "fs1")


class HigherAuthorityCorrection(unittest.TestCase):
    def test_rights_controller_corrects_aggregator(self):
        o = [obs(1, "ncaa.com", "official_aggregator", "2026-09-05T19:30:00+00:00"), obs(2, "theacc.com", "rights_controller", "2026-09-05T23:30:00+00:00", rights=True)]
        d = resolve_field("kickoff_at", o, RULES, ("2026-09-05T19:30:00+00:00", "definite"), NOW)
        self.assertEqual((d.status, d.value, d.changed), ("accepted", "2026-09-05T23:30:00+00:00", True))


class SameSourceChanges(unittest.TestCase):
    def test_network_change_supersedes_within_source(self):
        o = [bc(1, "cfbd", "structured_provider", "abc", "ABC", valid_to=T0 + timedelta(days=1)), bc(2, "cfbd", "structured_provider", "espn", "ESPN")]
        cands, alts = primary_candidates(o, ["ABC", "ESPN"], RULES)
        d = resolve_field("primary_network", cands, RULES, ("abc", "definite"), NOW)
        self.assertEqual((d.status, d.value, d.changed, alts), ("accepted", "espn", True, []))

    def test_kickoff_change(self):
        o = [obs(1, "cfbd", "structured_provider", "2026-10-24T16:00:00+00:00", valid_to=NOW), obs(2, "cfbd", "structured_provider", "2026-10-24T19:30:00+00:00")]
        d = resolve_field("kickoff_at", o, RULES, ("2026-10-24T16:00:00+00:00", "definite"), NOW)
        self.assertEqual((d.status, d.value), ("accepted", "2026-10-24T19:30:00+00:00"))

    def test_unchanged_is_no_change(self):
        o = [obs(1, "cfbd", "structured_provider", "2026-10-24T16:00:00+00:00")]
        d = resolve_field("kickoff_at", o, RULES, ("2026-10-24T16:00:00+00:00", "definite"), NOW)
        self.assertEqual((d.status, d.changed), ("no_change", False))


class StreamOnly(unittest.TestCase):
    def test_streaming_row_is_primary_only_when_no_linear_row(self):
        o = [bc(1, "cfbd", "structured_provider", "espn-plus", "ESPN+", surface="STREAMING")]
        cands, _ = primary_candidates(o, ["ESPN+"], RULES)
        self.assertTrue(cands[0].extra["stream_exclusive"])
        d = resolve_field("primary_network", cands, RULES, None, NOW)
        self.assertEqual(d.value, "espn-plus")

    def test_linear_beats_streaming_and_national_beats_local(self):
        o = [bc(1, "nhl.schedule", "league_api", "espn-plus", "ESPN+", surface="STREAMING"),
             bc(2, "nhl.schedule", "league_api", "cbj-local", "CBJ LOCAL", feed="HOME"),
             bc(3, "nhl.schedule", "league_api", "tnt", "TNT")]
        cands, alts = primary_candidates(o, ["ESPN", "TNT", "CBJ LOCAL", "ESPN+"], RULES)
        self.assertEqual((cands[0].value, sorted(alts)), ("tnt", [1, 2]))


class UnknownToKnown(unittest.TestCase):
    def test_tbd_becomes_definite_and_state_moves(self):
        o = [obs(1, "cfbd", "structured_provider", "2026-10-24T04:00:00+00:00", "tbd", valid_to=NOW), obs(2, "cfbd", "structured_provider", "2026-10-24T19:30:00+00:00")]
        k = resolve_field("kickoff_at", o, RULES, ("2026-10-24T04:00:00+00:00", "tbd"), NOW)
        n = resolve_field("primary_network", [obs(3, "cfbd", "structured_provider", "espn2")], RULES, None, NOW)
        self.assertEqual((k.status, k.certainty), ("accepted", "definite"))
        self.assertEqual(canonical_state("cfb", k, n, n.certainty), "fully_assigned")
        before = Decision("kickoff_at", "no_change", "2026-10-24T04:00:00+00:00", "tbd", 1, [1], [], "")
        self.assertEqual(canonical_state("cfb", before, n, n.certainty), "time_tbd")

    def test_cfb_without_any_network_is_network_tbd_but_pro_is_not(self):
        k = Decision("kickoff_at", "no_change", "2026-10-24T19:30:00+00:00", "definite", 1, [1], [], "")
        n = Decision("primary_network", "no_change", None, None, None, [], [], "")
        self.assertEqual(canonical_state("cfb", k, n, None), "network_tbd")
        self.assertEqual(canonical_state("nhl", k, n, None), "fully_assigned")   # no US telecast is a legitimate pro state (Around the League)


class SameRoleConflict(unittest.TestCase):
    def setUp(self):
        self.o = [obs(1, "bigten.org", "rights_controller", "fs1", rights=True), obs(2, "fox.schedule", "rights_controller", "fox", rights=True)]

    def test_with_last_known_good_is_retained(self):
        d = resolve_field("primary_network", self.o, RULES, ("fs1", "definite"), NOW)
        self.assertEqual((d.status, d.value, d.conflict), ("retained_last_known_good", "fs1", True))

    def test_without_last_known_good_is_unresolved_and_state_is_conflict(self):
        d = resolve_field("primary_network", self.o, RULES, None, NOW)
        self.assertEqual((d.status, d.value, d.conflict), ("unresolved_conflict", None, True))
        k = Decision("kickoff_at", "no_change", "2026-09-05T23:30:00+00:00", "definite", 9, [9], [], "")
        self.assertEqual(canonical_state("cfb", k, d, None), "authority_conflict")

    def test_newer_explicit_publication_wins(self):
        self.o[1].updated_at = NOW - timedelta(hours=1)
        self.o[0].updated_at = NOW - timedelta(days=2)
        d = resolve_field("primary_network", self.o, RULES, ("fs1", "definite"), NOW)
        self.assertEqual((d.status, d.value), ("accepted", "fox"))

    def test_definite_beats_tentative_at_same_role(self):
        o = [obs(1, "bigten.org", "rights_controller", "fox|fs1", "choice_set", rights=True), obs(2, "fox.schedule", "rights_controller", "fs1", rights=True)]
        d = resolve_field("primary_network", o, RULES, None, NOW)
        self.assertEqual((d.value, d.certainty), ("fs1", "definite"))

    def test_fetch_time_never_breaks_a_tie(self):
        self.o[1].observed_at = NOW   # fetched later, but no explicit publication timestamp
        d = resolve_field("primary_network", self.o, RULES, None, NOW)
        self.assertEqual(d.status, "unresolved_conflict")


class Staleness(unittest.TestCase):
    def test_local_carriage_older_than_14_days_is_ignored(self):
        old = obs(1, "data/local_rights", "hand_entered", "fanduel-ohio", observed=NOW - timedelta(days=20))
        d = resolve_field("local_carriage", [old], RULES, ("cavs-local", "tbd"), NOW)
        self.assertEqual((d.status, d.value), ("retained_last_known_good", "cavs-local"))

    def test_kickoff_has_no_horizon(self):
        old = obs(1, "cfbd", "structured_provider", "2026-11-28T17:00:00+00:00", observed=NOW - timedelta(days=200))
        self.assertEqual(resolve_field("kickoff_at", old and [old], RULES, None, NOW).value, "2026-11-28T17:00:00+00:00")


class RightsContext(unittest.TestCase):
    def test_contexts(self):
        self.assertEqual(rights_context("nhl", False, None, "nhl-29", RULES)[:2], ("league", "nhl"))
        self.assertEqual(rights_context("cfb", False, "cfb-big-ten", "127", RULES)[:2], ("conference", "cfb-big-ten"))
        self.assertEqual(rights_context("cfb", False, "cfb-fbs-independents", "87", RULES)[:2], ("independent_school", "87"))
        self.assertEqual(rights_context("cfb", True, "cfb-sec", "333", RULES)[:2], ("event_organizer", None))


class Determinism(unittest.TestCase):
    def test_same_inputs_same_decision(self):
        o = [obs(1, "bigten.org", "rights_controller", "fs1", rights=True), obs(4, "ncaa.com", "official_aggregator", "espnu"), obs(3, "fox.pressroom", "broadcaster", "fs1")]
        a = resolve_field("primary_network", list(o), RULES, None, NOW)
        b = resolve_field("primary_network", list(reversed(o)), RULES, None, NOW)
        self.assertEqual((a.status, a.value, a.winner_id, sorted(a.rejected_ids)), (b.status, b.value, b.winner_id, sorted(b.rejected_ids)))


if __name__ == "__main__":
    unittest.main()
