#!/usr/bin/env python3
"""Prompt 129 block H: MLB's observations are credited to the MLB Stats API, and its espn-labeled
predecessors close.

    python -m unittest tests.test_mlb_source_switch -v    # from the repo root; stdlib only

THE GAP THIS PINS. MLB fixtures say `source: "mlb-statsapi"`; pipeline/load.py's SOURCE_ID had no
entry for it, so its fallback credited every MLB observation since 2026-09-01 to espn.scoreboard
(843 broadcast rows). Switching the id alone would strand those claims: the closing loop closes only
claims whose source is in `seen_now`, so every espn.scoreboard claim on an MLB game would stay active
forever. Joe, 2026-10-14: "MLB is fine to MLB".

The loader and reconciler run their own SQL over the SQLite harness of
tests/test_eligibility_follows_access.py.
"""
from __future__ import annotations

import io
import json
import sys
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import pipeline.load as load  # noqa: E402
from tests.test_eligibility_follows_access import Harness, game  # noqa: E402

GID = "mlb-849810"
MLB = dict(home=("mlb-119", "Dodgers", "LAD"), away=("mlb-158", "Brewers", "MIL"), start="2026-10-16T00:08:00Z")


def mlb_game(outlet, access, gid=GID):
    g = game(gid, outlet, access, "mlb-statsapi", **MLB)
    g["media"][0]["market"] = "national"
    return g


class Switch(Harness):
    def load_as(self, sport, source, games):
        self.runs += 1
        p = self.tmp / f"{sport}_{self.runs}_fixture.json"
        p.write_text(json.dumps({"validation": {"generatedAt": "2026-10-14T09:00:00-04:00", "sport": sport, "year": 2026,
                                                "week": None, "source": source}, "games": games}), encoding="utf-8")
        with redirect_stdout(io.StringIO()):
            load.load_fixture(self.db, p, run_id=None)
        self.db.conn.commit()

    def claims(self, gid=GID, field=None, active=True):
        sql = "select source_id, field_name, normalized_value from source_observations where game_id = ?"
        sql += " and valid_to is null" if active else " and valid_to is not null"
        rows = self.db.conn.execute(sql, (gid,)).fetchall()
        return sorted(r for r in rows if field is None or r[1] == field)

    def bcast(self, gid=GID):
        return dict(self.db.conn.execute("select service_id, active from game_broadcasts where game_id = ?", (gid,)).fetchall())

    def state(self, gid=GID):
        g = self.db.conn.execute("select primary_network_id, network_status, canonical_state, canonical_kickoff_at_utc "
                                 "from games where id = ?", (gid,)).fetchone()
        e = self.eligibility(gid)
        return (*g, e["eligible"], e["market_pending"], e["reason"], e["via"])


class TheSourceIsMlb(Switch):
    def test_an_mlb_fixture_is_credited_to_mlb_statsapi(self):
        self.assertEqual(load.SOURCE_ID["mlb-statsapi"], "mlb.statsapi")
        self.assertEqual(load.SOURCE_META["mlb.statsapi"], ("league_api", 80))
        self.load_as("mlb", "mlb-statsapi", [mlb_game("FS1", "AVAILABLE")])
        self.assertEqual({r[0] for r in self.claims()}, {"mlb.statsapi"})

    def test_the_legacy_stub_claim_closes_and_its_row_goes_inactive(self):
        # the stub as production holds it: written before prompt 129 aliased the label, so the seeding
        # load runs with the loader's alias step as it was for that label - a pass-through
        with mock.patch.object(load, "normalize_outlet", lambda o: o):
            self.load_as("mlb", "espn.scoreboard", [mlb_game("FS1/ FOX ONE", "UNKNOWN")])
        self.assertEqual(self.bcast(), {"fs1-fox-one": 1})
        self.load_as("mlb", "mlb-statsapi", [mlb_game("FS1", "AVAILABLE")])
        self.assertEqual(self.claims(field="broadcast"), [("mlb.statsapi", "broadcast", "fs1|national|CONFIRMED")])
        self.assertIn(("espn.scoreboard", "broadcast", "fs1-fox-one|national|CONFIRMED"), self.claims(field="broadcast", active=False))
        self.assertEqual(self.bcast(), {"fs1-fox-one": 0, "fs1": 1})

    def test_a_legacy_kickoff_claim_is_superseded(self):
        self.load_as("mlb", "espn.scoreboard", [mlb_game("FS1", "AVAILABLE")])
        self.load_as("mlb", "mlb-statsapi", [mlb_game("FS1", "AVAILABLE")])
        self.assertEqual([r[0] for r in self.claims(field="kickoff_at")], ["mlb.statsapi"])
        self.assertEqual([r[0] for r in self.claims(field="kickoff_at", active=False)], ["espn.scoreboard"])

    def test_an_unchanged_game_reconciles_identically_across_the_switch(self):
        self.load_as("mlb", "espn.scoreboard", [mlb_game("FS1", "AVAILABLE")])
        self.reconcile()
        before = self.state()
        self.load_as("mlb", "mlb-statsapi", [mlb_game("FS1", "AVAILABLE")])
        self.reconcile()
        after = self.state()
        self.assertEqual(before, after)
        self.assertNotEqual(after[1], "authority_conflict")
        self.assertEqual(self.bcast(), {"fs1": 1})

    def test_a_second_load_under_the_new_id_is_a_repeat_sighting(self):
        self.load_as("mlb", "espn.scoreboard", [mlb_game("FS1", "AVAILABLE")])
        self.load_as("mlb", "mlb-statsapi", [mlb_game("FS1", "AVAILABLE")])
        closed = len(self.claims(active=False))
        self.load_as("mlb", "mlb-statsapi", [mlb_game("FS1", "AVAILABLE")])
        self.assertEqual(len(self.claims(active=False)), closed, "nothing more closes")
        self.assertEqual(len(self.claims()), 2, "one kickoff claim and one broadcast claim")


class LeavesOthersAlone(Switch):
    def test_a_non_mlb_games_espn_scoreboard_claims_are_untouched(self):
        nba = game("nba-401898407", "NBA TV", "AVAILABLE", "espn.scoreboard",
                   home=("nba-PHI", "76ers", "PHI"), away=("nba-BOS", "Celtics", "BOS"), start="2026-10-16T23:00:00Z")
        nba["media"][0]["market"] = "national"
        self.load_as("nba", "espn.scoreboard", [nba])
        before = self.claims("nba-401898407")
        ids = lambda: sorted(r[0] for r in self.db.conn.execute(  # noqa: E731
            "select id from source_observations where game_id = 'nba-401898407' and valid_to is null"))
        before_ids = ids()
        self.load_as("mlb", "espn.scoreboard", [mlb_game("FS1", "AVAILABLE")])
        self.load_as("mlb", "mlb-statsapi", [mlb_game("FS1", "AVAILABLE")])
        self.load_as("nba", "espn.scoreboard", [nba])
        self.assertEqual(self.claims("nba-401898407"), before)
        self.assertEqual(ids(), before_ids, "the same rows, repeat-sighted - not closed and re-inserted")
        self.assertEqual({r[0] for r in before}, {"espn.scoreboard"})

    def test_an_mlb_game_the_run_does_not_load_keeps_its_claims(self):
        self.load_as("mlb", "espn.scoreboard", [mlb_game("FS1", "AVAILABLE"), mlb_game("TBS", "AVAILABLE", gid="mlb-849818")])
        self.load_as("mlb", "mlb-statsapi", [mlb_game("FS1", "AVAILABLE")])
        self.assertEqual({r[0] for r in self.claims("mlb-849818")}, {"espn.scoreboard"})


if __name__ == "__main__":
    unittest.main()
