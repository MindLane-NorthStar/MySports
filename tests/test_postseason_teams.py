#!/usr/bin/env python3
"""Prompt 116 block A: a game's teams follow the source, and a flip is never silent.

    python -m unittest tests.test_postseason_teams -v    # from the repo root; stdlib only

THE GAP THIS PINS. Until 2026-09-23 `pipeline/load.py`'s games upsert updated `season, week,
neutral_site` on conflict and nothing else, so `home_team_id` / `away_team_id` were written once, at
the row's first insert. MLB's postseason rows arrive with placeholder participants ("AL Wild Card
#2", `mlb-4944`) and are filled in as the seeds clinch - the same gamePk, a new team id - and the
loader dropped the correction. `docs/research/mlb-adapter-brief.md` §7.4 said those rows "update in
place"; for the teams that was never true. Register §61.

No database and no network: the DB runs in emit-SQL mode, and the two-step case uses a subclass
that answers the loader's one read from a dict it maintains from the emitted upserts.
"""
from __future__ import annotations

import io
import json
import re
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import pipeline.load as load  # noqa: E402
from pipeline.db import DB, _inline  # noqa: E402
from pipeline.load import ZERO_COUNTS, load_fixture  # noqa: E402


def game(away_id, away_name="AL Wild Card #2", home_id="mlb-147", home_name="Yankees"):
    return {
        "id": "mlb-849851", "sport": "mlb", "season": 2026, "week": None,
        "startDate": "2026-09-29T07:33:00Z", "startTimeTBD": True, "neutralSite": False, "venue": "Yankee Stadium",
        "home": {"id": home_id, "team": home_name, "teamFull": f"New York {home_name}", "abbreviation": "NYY"},
        "away": {"id": away_id, "team": away_name, "teamFull": away_name, "abbreviation": "ALWC2"},
        "media": [{"mediaType": "tv", "outlet": "NBC", "access": "AVAILABLE", "market": "national",
                   "carriageCertainty": "CONFIRMED", "source": "mlb.schedule"}],
        "status": "scheduled", "homeScore": None, "awayScore": None,
    }


def fixture(tmp: Path, name: str, games) -> Path:
    p = tmp / name
    p.write_text(json.dumps({"validation": {"generatedAt": "2026-09-23T09:00:00-04:00", "sport": "mlb", "year": 2026,
                                            "week": None, "source": "mlb.schedule"}, "games": games}), encoding="utf-8")
    return p


class StatefulDB(DB):
    """Emit mode that REMEMBERS the games it upserted, so the loader's read-before-write sees a
    stored pair on the second load. `live` makes `conn` look open so the new-game skip is reachable."""

    def __init__(self, tmp: Path, live: bool = False):
        super().__init__(str(tmp / "emitted.sql"))
        self.games: dict[str, tuple[str, str]] = {}
        if live:
            self.conn = object()   # never used for execution: run() is overridden below

    def run(self, sql, params=None, tag=None):
        if tag:
            self.stats[tag] = self.stats.get(tag, 0) + 1
        self.emitted.append(sql if params is None else _inline(sql, params))
        if sql.startswith("insert into games ("):
            cols = sql[len("insert into games ("):sql.index(")")].split(", ")
            row = dict(zip(cols, params))
            gid = row["id"]
            old = self.games.get(gid)
            home = row["home_team_id"] if row["home_team_id"] is not None else (old[0] if old else None)
            away = row["away_team_id"] if row["away_team_id"] is not None else (old[1] if old else None)
            self.games[gid] = (home, away)

    def fetch(self, sql, params=None):
        if "select home_team_id, away_team_id from games where id" in sql:
            g = self.games.get(params[0])
            return [g] if g else []
        return []


def load_quiet(db, path):
    with redirect_stdout(io.StringIO()):
        return load_fixture(db, path, run_id=None)


def games_upsert(db) -> str:
    return next(s for s in db.emitted if s.startswith("insert into games ("))


class TheUpsertCarriesBothTeamColumns(unittest.TestCase):
    def test_do_update_sets_home_and_away_preserved(self):
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            db = DB(str(tmp / "e.sql"))
            load_quiet(db, fixture(tmp, "mlb_2026_2026-09-29_fixture.json", [game("mlb-4944")]))
            sql = games_upsert(db)
            self.assertIn("home_team_id = coalesce(excluded.home_team_id, games.home_team_id)", sql)
            self.assertIn("away_team_id = coalesce(excluded.away_team_id, games.away_team_id)", sql)
            # the three that were always there still are
            for c in ("season", "week", "neutral_site"):
                self.assertIn(f"{c} = excluded.{c}", sql)

    def test_the_loader_looks_before_it_writes(self):
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            db = DB(str(tmp / "e.sql"))
            load_quiet(db, fixture(tmp, "mlb_x_fixture.json", [game("mlb-4944")]))
            self.assertEqual(db.stats.get("games.teams.read"), 1)
            self.assertTrue(any("read games.home_team_id, games.away_team_id for mlb-849851" in s for s in db.emitted))


class APlaceholderBecomesAClub(unittest.TestCase):
    def setUp(self):
        load.TEAM_CHANGES.clear()

    def test_the_second_load_changes_the_stored_away_id_and_writes_a_note(self):
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            db = StatefulDB(tmp)
            first = load_quiet(db, fixture(tmp, "mlb_2026_2026-09-23_fixture.json", [game("mlb-4944")]))
            self.assertEqual(db.games["mlb-849851"], ("mlb-147", "mlb-4944"))
            self.assertEqual(first["team_changes"], 0)
            self.assertEqual(load.TEAM_CHANGES, [])
            second = load_quiet(db, fixture(tmp, "mlb_2026_2026-09-28_fixture.json", [game("mlb-111", "Red Sox")]))
            self.assertEqual(db.games["mlb-849851"], ("mlb-147", "mlb-111"), "the stored away id follows the source")
            self.assertEqual(second["team_changes"], 1)
            self.assertEqual(load.TEAM_CHANGES, ["mlb-849851: away mlb-4944 -> mlb-111"])
            # the home side did not change and is not noted
            self.assertFalse(any("home" in n for n in load.TEAM_CHANGES))

    def test_the_same_teams_again_note_nothing(self):
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            db = StatefulDB(tmp)
            load_quiet(db, fixture(tmp, "a_fixture.json", [game("mlb-4944")]))
            c = load_quiet(db, fixture(tmp, "b_fixture.json", [game("mlb-4944")]))
            self.assertEqual(c["team_changes"], 0)
            self.assertEqual(load.TEAM_CHANGES, [])


class AMissingSideIsNeverWritten(unittest.TestCase):
    def setUp(self):
        load.TEAM_CHANGES.clear()

    def test_a_none_side_keeps_the_stored_value_and_is_noted(self):
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            db = StatefulDB(tmp)
            load_quiet(db, fixture(tmp, "a_fixture.json", [game("mlb-4944")]))
            c = load_quiet(db, fixture(tmp, "b_fixture.json", [game(None, "Somebody")]))
            self.assertEqual(db.games["mlb-849851"], ("mlb-147", "mlb-4944"), "the stored away id survives a missing one")
            self.assertEqual(c["team_missing"], 1)
            self.assertEqual(c["team_changes"], 0)
            self.assertEqual(load.TEAM_CHANGES, ["mlb-849851: away id missing from the source; kept mlb-4944"])
            sql = [s for s in db.emitted if s.startswith("insert into games (")][-1]
            self.assertNotIn("'None'", sql, "str(None) must never reach the row")
            self.assertRegex(sql, r"values \('mlb-849851'.*'mlb-147', null, ", "the missing side is a NULL the upsert coalesces away")

    def test_no_team_stub_is_inserted_for_a_none_side(self):
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            db = StatefulDB(tmp)
            load_quiet(db, fixture(tmp, "a_fixture.json", [game("mlb-4944")]))
            load_quiet(db, fixture(tmp, "b_fixture.json", [game(None)]))
            stubs = [s for s in db.emitted if s.startswith("insert into teams (")]
            self.assertFalse(any("'None'" in s for s in stubs), "before prompt 116 a team named None was stubbed here")

    def test_a_new_game_with_a_none_side_is_skipped_live_not_inserted_as_none(self):
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            db = StatefulDB(tmp, live=True)
            c = load_quiet(db, fixture(tmp, "a_fixture.json", [game(None)]))
            self.assertEqual(c["games"], 0)
            self.assertEqual(c["team_missing"], 1)
            self.assertNotIn("mlb-849851", db.games)
            self.assertEqual(load.TEAM_CHANGES, ["mlb-849851: away id missing from the source; kept nothing (new game, skipped)"])

    def test_zero_counts_carries_the_two_new_counters(self):
        self.assertIn("team_changes", ZERO_COUNTS)
        self.assertIn("team_missing", ZERO_COUNTS)


class TheNotesCarryTheChanges(unittest.TestCase):
    def test_main_writes_team_changes_into_refresh_runs_notes(self):
        src = (ROOT / "pipeline" / "load.py").read_text(encoding="utf-8")
        self.assertRegex(src, re.compile(r'notes = json\.dumps\(\{\*\*totals, \*\*run_context\(\), "team_changes": list\(TEAM_CHANGES\)\}\)'))


if __name__ == "__main__":
    unittest.main()
