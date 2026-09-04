#!/usr/bin/env python3
"""A loader that could not reach its provider must not be able to erase what a good run established.

    python -m unittest tests.test_reference_preserve -v    # from the repo root; stdlib only

THE BUG THIS PINS, which is not hypothetical - it deleted real data on 2026-09-01.

`pipeline/bootstrap.py` derives every team's `conference_id` from the per-team `conference` field of
`artifacts/validation/<sport>_2026_teams.json`, and upserts `teams` with `conference_id` among its
update columns. `adapters/nhl.py` gets those divisions from `fetch_standings_teams()` - a SEPARATE call
to the one that produces the team list - behind a `_safe` that swallows any exception and returns None.
When that call failed, the teams file was still written, with `conference: null` on all 32 clubs, and
the next bootstrap wrote those nulls straight over the division links. Migration 0011 had to seed them
a second time.

**The exposure is wider than that one adapter.** As of 2026-09-04 the NFL, NBA and NHL teams files ALL
carry `conference: null` on every row - 94 clubs - because only MLB and college football's providers
supply a conference in their team payload at all. So an unguarded bootstrap wipes all 94 on its next
ordinary run, with no fetch failure needed.

The fix is in `DB.upsert(preserve=[...])`: those columns become `coalesce(excluded.c, table.c)`, so a
null is refused and a real value still lands. These tests drive the real `teams_and_conferences()` in
--emit-sql mode, so they assert the SQL that WOULD have run - no database, no network.
"""
from __future__ import annotations

import io
import json
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from pipeline.db import DB  # noqa: E402


def emit(fn) -> list[str]:
    """Run fn(db) against an --emit-sql DB and return the statements it would have executed."""
    with tempfile.TemporaryDirectory() as d:
        out = Path(d) / "x.sql"
        db = DB(str(out))
        with redirect_stdout(io.StringIO()):
            fn(db)
        return list(db.emitted)


class UpsertPreserve(unittest.TestCase):
    """The primitive, in isolation."""

    def test_a_preserved_column_coalesces_and_an_ordinary_one_does_not(self):
        stmts = emit(lambda db: db.upsert(
            "teams", [{"id": "nfl-5", "conference_id": None, "short_name": "Browns"}],
            "id", ["conference_id", "short_name"], preserve=["conference_id"]))
        self.assertIn("conference_id = coalesce(excluded.conference_id, teams.conference_id)", stmts[0])
        self.assertIn("short_name = excluded.short_name", stmts[0])
        self.assertNotIn("coalesce(excluded.short_name", stmts[0])

    def test_preserve_is_opt_in_so_the_default_is_unchanged(self):
        # pipeline/standings.py upserts columns where null is a REAL answer - the NHL publishes no
        # games_back - and coalescing those would freeze a stale number the day a league stopped
        # publishing one. The two cases are identical in SQL and opposite in meaning, so nothing may
        # be preserved unless the caller says so.
        stmts = emit(lambda db: db.upsert(
            "team_records", [{"team_id": "nhl-8", "games_back": None}], "team_id", ["games_back"]))
        self.assertIn("games_back = excluded.games_back", stmts[0])
        self.assertNotIn("coalesce", stmts[0])

    def test_a_column_not_in_the_row_is_not_written_at_all(self):
        stmts = emit(lambda db: db.upsert(
            "teams", [{"id": "nfl-5"}], "id", ["conference_id"], preserve=["conference_id"]))
        self.assertNotIn("conference_id", stmts[0])


class BootstrapSurvivesAFailedFetch(unittest.TestCase):
    """The real loader path, against a teams file shaped exactly like a failed NHL standings call."""

    def _run(self, teams_json: list[dict]) -> list[str]:
        import pipeline.bootstrap as bs
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            val = root / "artifacts" / "validation"
            val.mkdir(parents=True)
            (val / "nhl_2026_teams.json").write_text(json.dumps(teams_json), encoding="utf-8")
            original = bs.ROOT
            bs.ROOT = root
            try:
                return emit(lambda db: bs.teams_and_conferences(db))
            finally:
                bs.ROOT = original

    @staticmethod
    def _team(conference):
        return {"id": "nhl-8", "school": "Montreal Canadiens", "nickname": "Canadiens",
                "location": "Montreal", "abbreviation": "MTL", "conference": conference,
                "color": "#AF1E2D", "alternateColor": "#192168"}

    def test_a_null_conference_cannot_overwrite_an_established_one(self):
        # THE REGRESSION. This is the exact file adapters/nhl.py writes when fetch_standings_teams()
        # raises and _safe() swallows it: every club present, every conference null.
        stmts = self._run([self._team(None)])
        team_stmts = [s for s in stmts if s.startswith("insert into teams ")]
        self.assertEqual(len(team_stmts), 1)
        self.assertIn("conference_id = coalesce(excluded.conference_id, teams.conference_id)", team_stmts[0])
        self.assertNotIn("conference_id = excluded.conference_id", team_stmts[0])

    def test_a_failed_fetch_creates_no_conference_row_to_point_at_either(self):
        stmts = self._run([self._team(None)])
        self.assertEqual([s for s in stmts if s.startswith("insert into conferences ")], [])

    def test_a_good_fetch_still_writes_the_link(self):
        # coalesce must not make the column unwritable - only unerasable.
        stmts = self._run([self._team("Atlantic")])
        team_stmts = [s for s in stmts if s.startswith("insert into teams ")]
        self.assertIn("'nhl-atlantic'", team_stmts[0])
        conf = [s for s in stmts if s.startswith("insert into conferences ")]
        self.assertEqual(len(conf), 1)
        self.assertIn("'nhl-atlantic'", conf[0])

    def test_a_reassignment_still_lands(self):
        # A club that genuinely moves division writes a non-null value, which coalesce passes through.
        stmts = self._run([self._team("Metropolitan")])
        team_stmts = [s for s in stmts if s.startswith("insert into teams ")]
        self.assertIn("'nhl-metropolitan'", team_stmts[0])

    def test_the_other_reference_columns_are_guarded_the_same_way(self):
        # Same class of loss: a thin teams file must not blank a club's colours or abbreviation.
        stmts = self._run([{"id": "nhl-8", "school": "Montreal Canadiens", "nickname": "Canadiens",
                            "conference": None}])
        t = [s for s in stmts if s.startswith("insert into teams ")][0]
        for col in ("location", "abbreviation", "primary_color", "secondary_color", "fbs_status"):
            self.assertIn(f"{col} = coalesce(excluded.{col}, teams.{col})", t, col)

    def test_the_name_columns_are_deliberately_NOT_preserved(self):
        # They are always derived non-null here, so a null would be a bug worth seeing.
        t = [s for s in self._run([self._team("Atlantic")]) if s.startswith("insert into teams ")][0]
        self.assertIn("canonical_name = excluded.canonical_name", t)
        self.assertIn("short_name = excluded.short_name", t)
        self.assertNotIn("coalesce(excluded.canonical_name", t)


if __name__ == "__main__":
    unittest.main()
