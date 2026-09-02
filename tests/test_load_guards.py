#!/usr/bin/env python3
"""Loader guards: the renderer's own output must never be ingested as evidence (commit febed52).

    python -m unittest tests.test_load_guards -v    # from the repo root; stdlib only

render_feed.py writes db_*_fixture.json files whose validation.source is 'mysports-db'. Those are the
database speaking. Loading one would rank the DB against itself as a provider and let a reconciled
decision re-enter as fresh evidence, so the loader refuses them twice over:

  * by NAME  - `--all` globs *_fixture.json and drops anything starting with db_ (fixture_files);
  * by CONTENT - load_fixture returns the zeroed counter dict the moment it reads source 'mysports-db',
    before a single statement is generated (so a db_ feed passed explicitly via --fixture is refused too).

No database and no network: the DB object runs in --emit-sql mode, which never opens a connection.
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
from pipeline.load import ZERO_COUNTS, fixture_files, load_fixture  # noqa: E402


def emit_db(tmp: Path) -> DB:
    """A DB in emit-SQL mode: statements are collected in memory, no connection is opened."""
    return DB(str(tmp / "emitted.sql"))


def load_quiet(db: DB, path: Path):
    """load_fixture narrates on stdout; the tests assert its return value, not the console."""
    with redirect_stdout(io.StringIO()):
        return load_fixture(db, path, run_id=None)


def write_fixture(path: Path, source: str, games=None) -> Path:
    path.write_text(json.dumps({
        "validation": {"generatedAt": "2026-09-01T20:40:00-04:00", "sport": "nba", "year": 2026,
                       "week": None, "source": source},
        "games": games if games is not None else [],
    }), encoding="utf-8")
    return path


REAL_GAME = {
    "id": "nba-401810245", "sport": "nba", "season": 2026, "week": None,
    "startDate": "2026-10-28T23:00:00Z", "startTimeTBD": False, "neutralSite": False, "venue": "Test Arena",
    "home": {"id": "nba-CLE", "team": "Cavaliers", "teamFull": "Cleveland Cavaliers", "abbreviation": "CLE"},
    "away": {"id": "nba-BOS", "team": "Celtics", "teamFull": "Boston Celtics", "abbreviation": "BOS"},
    "media": [{"mediaType": "tv", "outlet": "TNT", "access": "AVAILABLE", "market": "national",
               "carriageCertainty": "CONFIRMED", "source": "espn.scoreboard"}],
    "status": "scheduled", "homeScore": None, "awayScore": None,
}


# --------------------------------------------------------------------------- content guard
class MysportsDbFeedIsNotEvidence(unittest.TestCase):
    def test_returns_the_zeroed_counter_dict(self):
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            fx = write_fixture(tmp / "db_nba_2026_2026-10-28_fixture.json", "mysports-db", [REAL_GAME])
            db = emit_db(tmp)
            counts = load_quiet(db, fx)
            self.assertEqual(counts, ZERO_COUNTS)

    def test_generates_no_sql_at_all(self):
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            fx = write_fixture(tmp / "db_nba_2026_2026-10-28_fixture.json", "mysports-db", [REAL_GAME])
            db = emit_db(tmp)
            load_quiet(db, fx)
            # not even the source_snapshots row: the guard returns before the snapshot insert
            self.assertEqual(db.emitted, [])
            self.assertEqual(db.stats, {})

    def test_the_returned_dict_is_a_copy_not_the_module_constant(self):
        # callers sum into it; handing out the shared constant would corrupt every later skip
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            fx = write_fixture(tmp / "db_x_fixture.json", "mysports-db")
            counts = load_quiet(emit_db(tmp), fx)
            counts["games"] += 5
            self.assertEqual(ZERO_COUNTS["games"], 0)

    def test_the_guard_is_on_the_source_not_the_filename(self):
        # a db_ feed renamed by hand is still refused ...
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            fx = write_fixture(tmp / "nba_2026_2026-10-28_fixture.json", "mysports-db", [REAL_GAME])
            db = emit_db(tmp)
            self.assertEqual(load_quiet(db, fx), ZERO_COUNTS)
            self.assertEqual(db.emitted, [])

    def test_a_real_provider_fixture_is_still_loaded(self):
        # the guard must not swallow ordinary adapter output
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            fx = write_fixture(tmp / "nba_2026_2026-10-28_fixture.json", "espn.scoreboard", [REAL_GAME])
            db = emit_db(tmp)
            counts = load_quiet(db, fx)
            self.assertEqual(counts["games"], 1)
            self.assertGreater(len(db.emitted), 0)
            self.assertIn("insert into games", " ".join(db.emitted))

    def test_zero_counts_covers_every_counter_a_real_load_reports(self):
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            real = write_fixture(tmp / "nba_2026_2026-10-28_fixture.json", "espn.scoreboard", [REAL_GAME])
            counts = load_quiet(emit_db(tmp), real)
            # so the TOTAL line still prints in full when every fixture in a run was skipped
            self.assertEqual(set(counts), set(ZERO_COUNTS))

    def test_zero_counts_values_are_all_zero(self):
        self.assertEqual(sorted(set(ZERO_COUNTS.values())), [0])


# --------------------------------------------------------------------------- name guard (--all)
class AllGlobFileSelection(unittest.TestCase):
    @staticmethod
    def build(tmp: Path) -> None:
        for name in ("cfbd_2026_week1_fixture.json", "nba_2026_2026-10-28_fixture.json",
                     "mlb_2026_2026-09-04_fixture.json", "db_nba_2026_2026-10-28_fixture.json",
                     "db_mlb_2026_2026-09-04_fixture.json"):
            write_fixture(tmp / name, "mysports-db" if name.startswith("db_") else "espn.scoreboard")
        # non-fixture neighbours that live in the same directory
        (tmp / "nba_2026_2026-10-28_raw.json").write_text("{}", encoding="utf-8")
        (tmp / "nba_2026_2026-10-28_report.md").write_text("# report\n", encoding="utf-8")
        (tmp / "nba_espn_teams.json").write_text("[]", encoding="utf-8")
        sub = tmp / "samples"
        sub.mkdir()
        write_fixture(sub / "sample_2026_fixture.json", "espn.scoreboard")

    def test_db_feeds_are_excluded(self):
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            self.build(tmp)
            names = [p.name for p in fixture_files(tmp)]
            self.assertNotIn("db_nba_2026_2026-10-28_fixture.json", names)
            self.assertNotIn("db_mlb_2026_2026-09-04_fixture.json", names)
            self.assertFalse([n for n in names if n.startswith("db_")])

    def test_provider_fixtures_are_included(self):
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            self.build(tmp)
            names = [p.name for p in fixture_files(tmp)]
            self.assertEqual(names, ["cfbd_2026_week1_fixture.json",
                                     "mlb_2026_2026-09-04_fixture.json",
                                     "nba_2026_2026-10-28_fixture.json"])

    def test_non_fixture_files_are_excluded(self):
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            self.build(tmp)
            names = [p.name for p in fixture_files(tmp)]
            for other in ("nba_2026_2026-10-28_raw.json", "nba_2026_2026-10-28_report.md", "nba_espn_teams.json"):
                self.assertNotIn(other, names)

    def test_subdirectories_are_not_descended(self):
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            self.build(tmp)
            self.assertNotIn("sample_2026_fixture.json", [p.name for p in fixture_files(tmp)])

    def test_selection_is_sorted_and_deterministic(self):
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            self.build(tmp)
            first = fixture_files(tmp)
            self.assertEqual(first, sorted(first))
            self.assertEqual(first, fixture_files(tmp))

    def test_empty_directory_selects_nothing(self):
        with tempfile.TemporaryDirectory() as td:
            self.assertEqual(fixture_files(Path(td)), [])

    def test_live_validation_directory_has_no_db_feeds_selected(self):
        live = ROOT / "artifacts" / "validation"
        if not live.exists():
            self.skipTest("artifacts/validation not present")
            return
        selected = fixture_files(live)
        self.assertTrue(selected, "expected the repo's own fixtures to be selected")
        self.assertFalse([p.name for p in selected if p.name.startswith("db_")])
        # and the renderer feeds really are on disk, so the exclusion is doing work
        self.assertTrue(list(live.glob("db_*_fixture.json")))


if __name__ == "__main__":
    unittest.main()
