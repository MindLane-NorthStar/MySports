#!/usr/bin/env python3
"""Shadow program rows: the loader maintains one `programs` row per game (spec v0.5 P.1, migration 0009).

    python -m unittest tests.test_programs_shadow -v    # from the repo root; stdlib only

No database and no network: the DB object runs in --emit-SQL mode, so these assert the SQL the loader
GENERATES. That is the right level for the properties that matter here, because idempotency is a
property of the statements themselves rather than of a particular database's contents:

  * the INSERT is guarded by `program_id is null`, so a second load creates nothing;
  * the UPDATE is guarded by `is distinct from`, so a load that changes nothing writes nothing - which
    also keeps the updated_at trigger from firing on all 375 rows every time the cron runs.

The live counterparts (backfill counts, FK integrity, re-load producing 0 new programs) are the
acceptance checks in the prompt-17 run, not unit tests.
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

from pipeline.db import DB  # noqa: E402
from pipeline.load import load_fixture  # noqa: E402
from pipeline.programs import DEFAULT_BLOCK_MIN, block_minutes, game_title  # noqa: E402

GAME = {
    "id": "nba-401810245", "sport": "nba", "season": 2026, "week": None,
    "startDate": "2026-10-28T23:00:00Z", "startTimeTBD": False, "neutralSite": False, "venue": "Test Arena",
    "home": {"id": "nba-CLE", "team": "Cavaliers", "teamFull": "Cleveland Cavaliers", "abbreviation": "CLE"},
    "away": {"id": "nba-BOS", "team": "Celtics", "teamFull": "Boston Celtics", "abbreviation": "BOS"},
    "media": [{"mediaType": "tv", "outlet": "TNT", "access": "AVAILABLE", "market": "national",
               "carriageCertainty": "CONFIRMED", "source": "espn.scoreboard"}],
    "status": "scheduled", "homeScore": None, "awayScore": None,
}


def emitted_for(games, sport="nba"):
    """Load a one-fixture file in emit mode and return (counts, [sql statements])."""
    with tempfile.TemporaryDirectory() as d:
        tmp = Path(d)
        fx = tmp / "t_fixture.json"
        fx.write_text(json.dumps({
            "validation": {"generatedAt": "2026-09-01T20:40:00-04:00", "sport": sport, "year": 2026,
                           "week": None, "source": "espn.scoreboard"},
            "games": games,
        }), encoding="utf-8")
        db = DB(str(tmp / "emitted.sql"))
        with redirect_stdout(io.StringIO()):
            counts = load_fixture(db, fx, run_id=None)
        return counts, list(db.emitted)


def programs_sql(stmts):
    return [s for s in stmts if "programs" in s]


class OneShadowPerGame(unittest.TestCase):
    def test_a_new_game_emits_shadow_statements(self):
        _, stmts = emitted_for([GAME])
        self.assertTrue(any("insert into programs" in s for s in stmts))
        self.assertTrue(any("update programs" in s for s in stmts))

    def test_every_game_emits_exactly_one_program(self):
        """ONE-DIRECTIONAL, and prompt 46 is why the direction now matters.

        This counts the statements a GAMES fixture emits, so it says "every game has a program".
        It has never said the converse, and since prompt 46 the converse is false: NASCAR race
        sessions are programs with no game at all (adapters/nascar.py, migration 0009). Read
        database-wide, `programs == games` is not an invariant any more - read here, per load, it
        still is.
        """
        counts, _ = emitted_for([GAME, {**GAME, "id": "nba-2"}, {**GAME, "id": "nba-3"}])
        self.assertEqual(counts["games"], 3)
        self.assertEqual(counts["programs"], counts["games"])

    def test_a_fixture_with_no_games_emits_no_shadow_statements(self):
        counts, stmts = emitted_for([])
        self.assertEqual(counts["programs"], 0)
        self.assertEqual(programs_sql(stmts), [])

    def test_the_shadow_is_typed_as_a_game(self):
        _, stmts = emitted_for([GAME])
        ins = next(s for s in stmts if "insert into programs" in s)
        self.assertIn("'game'::program_type", ins)


class IdempotentByConstruction(unittest.TestCase):
    def test_the_insert_only_fires_when_the_game_has_no_shadow(self):
        _, stmts = emitted_for([GAME])
        ins = next(s for s in stmts if "insert into programs" in s)
        self.assertIn("program_id is null", ins)

    def test_the_link_update_also_guards_on_program_id_is_null(self):
        _, stmts = emitted_for([GAME])
        ins = next(s for s in stmts if "insert into programs" in s)
        # the games.program_id write is the tail of the same statement
        self.assertIn("update games set program_id", ins)
        self.assertIn("exists (select 1 from ins)", ins)

    def test_the_update_writes_nothing_when_nothing_differs(self):
        _, stmts = emitted_for([GAME])
        upd = next(s for s in stmts if s.strip().startswith("update programs"))
        for col in ("start_at", "title", "expected_duration_min", "venue_id", "sport"):
            self.assertIn(f"p.{col}", upd)
        self.assertIn("is distinct from", upd)

    def test_the_update_precedes_the_insert(self):
        _, stmts = emitted_for([GAME])
        i_upd = next(i for i, s in enumerate(stmts) if s.strip().startswith("update programs"))
        i_ins = next(i for i, s in enumerate(stmts) if "insert into programs" in s)
        self.assertLess(i_upd, i_ins, "the insert would be rewritten by the update if it ran first")


class KickoffAndLabelling(unittest.TestCase):
    def test_start_at_prefers_the_canonical_kickoff_over_the_fixture_claim(self):
        # A changed kickoff must move the shadow, but the reconciler owns the canonical instant, so
        # the fixture's start is only the fallback until reconciliation has run.
        _, stmts = emitted_for([GAME])
        for s in programs_sql(stmts):
            if "canonical_kickoff_at_utc" in s:
                self.assertIn("coalesce(g.canonical_kickoff_at_utc", s)
        self.assertTrue(any("coalesce(g.canonical_kickoff_at_utc" in s for s in programs_sql(stmts)))

    def test_title_is_away_at_home(self):
        self.assertEqual(game_title("Celtics", "Cavaliers"), "Celtics @ Cavaliers")

    def test_title_tolerates_a_missing_side(self):
        self.assertEqual(game_title(None, "Cavaliers"), "? @ Cavaliers")


class DurationComesFromTheRenderPolicy(unittest.TestCase):
    def test_every_sport_matches_render_policies_json(self):
        pol = json.loads((ROOT / "data" / "render_policies.json").read_text(encoding="utf-8"))
        for sport, cfg in pol.items():
            if not isinstance(cfg, dict) or "block_minutes" not in cfg:
                continue
            self.assertEqual(block_minutes(sport), int(cfg["block_minutes"]), sport)

    def test_the_known_durations_are_the_ones_the_grid_draws(self):
        self.assertEqual(block_minutes("cfb"), 210)
        self.assertEqual(block_minutes("nhl"), 150)
        self.assertEqual(block_minutes("mlb"), 180)

    def test_an_unknown_sport_falls_back(self):
        self.assertEqual(block_minutes("quidditch"), DEFAULT_BLOCK_MIN)


class NothingIsDestroyed(unittest.TestCase):
    def test_no_statement_ever_deletes_a_program(self):
        _, stmts = emitted_for([GAME, {**GAME, "id": "nba-2"}])
        for s in programs_sql(stmts):
            low = s.lower()
            self.assertNotIn("delete from programs", low)
            self.assertNotIn("drop table", low)
            self.assertNotIn("truncate", low)


class BroadcastLoadIsUntouched(unittest.TestCase):
    def test_the_broadcast_insert_names_no_window_column(self):
        # 0009 added window_start/window_end/simulcast_linear as nullable (and false-defaulted). The
        # loader must not write them: a null window means "carries the whole program", which is what
        # every existing row means and must keep meaning.
        _, stmts = emitted_for([GAME])
        bc = [s for s in stmts if "insert into game_broadcasts" in s]
        self.assertTrue(bc, "the fixture carries media, so a broadcast row is expected")
        for s in bc:
            self.assertNotIn("window_start", s)
            self.assertNotIn("window_end", s)
            self.assertNotIn("simulcast_linear", s)


if __name__ == "__main__":
    unittest.main()
