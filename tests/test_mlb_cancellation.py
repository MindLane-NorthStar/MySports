#!/usr/bin/env python3
"""Prompt 129 block E: a postseason game the feed drops is cancelled, and it fails closed.

    python -m unittest tests.test_mlb_cancellation -v    # from the repo root; stdlib only

THE GAP THIS PINS. Statsapi removes an unplayed "if necessary" game once its series ends. The
adapter only sees what the feed lists and the loader only writes what a fixture carries, so four
2026 Division Series games (mlb-849837, -849824, -849821, -849836) sat `scheduled` after their
series ended, two of them shown as watchable on truTV. Joe ruled 2026-10-14: "close them".

Fixtures come from the real `adapters.mlb.build_fixture`; the loader and the pass run their own SQL
over the SQLite harness of tests/test_eligibility_follows_access.py.
"""
from __future__ import annotations

import io
import json
import sys
import tempfile
import unittest
from contextlib import redirect_stderr, redirect_stdout
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import pipeline.load as load  # noqa: E402
from adapters import mlb  # noqa: E402
from tests.test_eligibility_follows_access import Harness  # noqa: E402


def statsapi_game(pk, date, game_type="D", state="Preview", code="S", home=(119, "LAD", "Dodgers"), away=(144, "ATL", "Braves")):
    def side(t):
        return {"team": {"id": t[0], "abbreviation": t[1], "teamName": t[2], "name": t[2]}, "leagueRecord": {}}
    return {"gamePk": pk, "gameType": game_type, "season": "2026", "gameDate": f"{date}T22:08:00Z", "officialDate": date,
            "status": {"abstractGameState": state, "statusCode": code, "detailedState": "Scheduled"},
            "teams": {"home": side(home), "away": side(away)}, "venue": {"id": 22, "name": "Dodger Stadium"},
            "broadcasts": [{"type": "TV", "name": "TBS/HBO MAX", "homeAway": "home", "language": "en", "id": 1,
                            "availability": {"availabilityCode": "national"}}]}


def payload(date, games):
    return {"totalGames": len(games), "dates": ([{"date": date, "games": games}] if games else [])}


class Pass(Harness):
    def setUp(self):
        super().setUp()
        self.db.conn.execute("alter table games add column competition_context default 'REGULAR'")
        load.CANCELLATIONS.clear()

    def fixture(self, date, games, raw=None, name=None, age=timedelta(0)):
        with redirect_stdout(io.StringIO()):
            fx, _, _ = mlb.build_fixture(raw if raw is not None else payload(date, games), ROOT, season=2026, date=date, teams=[])
        fx["validation"]["generatedAt"] = (datetime.now(timezone.utc) - age).isoformat()
        self.runs += 1
        p = self.tmp / (name or f"mlb_2026_{date}_{self.runs}_fixture.json")
        p.write_text(json.dumps(fx), encoding="utf-8")
        return p

    def load_fx(self, p):
        with redirect_stdout(io.StringIO()):
            load.load_fixture(self.db, p, run_id=None)
        self.db.conn.commit()

    def cancel(self, *paths):
        with redirect_stdout(io.StringIO()):
            lines = load.cancel_dropped_postseason(self.db, list(paths))
        self.db.conn.commit()
        return lines

    def status(self, gid):
        return self.db.conn.execute("select result_status from games where id = ?", (gid,)).fetchone()[0]

    def seed(self, date, *games):
        self.load_fx(self.fixture(date, list(games)))


class Cancels(Pass):
    def test_an_absent_playoff_game_is_cancelled_and_the_note_is_written(self):
        self.seed("2026-10-16", statsapi_game(849806, "2026-10-16", "L"), statsapi_game(849807, "2026-10-16", "L"))
        lines = self.cancel(self.fixture("2026-10-16", [statsapi_game(849806, "2026-10-16", "L")]))
        self.assertEqual(self.status("mlb-849807"), "cancelled")
        self.assertEqual(self.status("mlb-849806"), "scheduled")
        self.assertEqual(lines, ["mlb-849807: scheduled -> cancelled (absent from the 2026-10-16 feed; postseason)"])
        self.assertEqual(load.CANCELLATIONS, lines, "the run's notes carry the same lines")

    def test_an_absent_game_after_the_postseason_start_is_cancelled_even_when_stored_as_regular(self):
        """The four Division Series games: they left the feed before anything wrote PLAYOFF."""
        self.seed("2026-10-09", statsapi_game(849821, "2026-10-09", "D"))
        self.db.conn.execute("update games set competition_context = 'REGULAR' where id = 'mlb-849821'")
        self.cancel(self.fixture("2026-10-09", [], raw=payload("2026-10-09", [])))
        self.assertEqual(self.status("mlb-849821"), "cancelled")

    def test_a_successful_empty_day_cancels(self):
        """10-19: both series over, the feed answers `"totalGames":0,"dates":[]`."""
        self.seed("2026-10-19", statsapi_game(849805, "2026-10-19", "L"))
        p = self.fixture("2026-10-19", [], raw={"totalGames": 0, "dates": []})
        self.assertIs(json.loads(p.read_text(encoding="utf-8"))["validation"]["feedComplete"], True)
        self.cancel(p)
        self.assertEqual(self.status("mlb-849805"), "cancelled")

    def test_a_reappearing_game_is_restored(self):
        self.seed("2026-10-16", statsapi_game(849807, "2026-10-16", "L"))
        self.cancel(self.fixture("2026-10-16", []))
        self.assertEqual(self.status("mlb-849807"), "cancelled")
        self.load_fx(self.fixture("2026-10-16", [statsapi_game(849807, "2026-10-16", "L")]))
        self.assertEqual(self.status("mlb-849807"), "scheduled")

    def test_a_game_another_fixture_in_the_run_lists_is_not_cancelled(self):
        """Moved to the next day: the next day's fixture lists it, so the run as a whole has seen it."""
        self.seed("2026-10-16", statsapi_game(849807, "2026-10-16", "L"))
        moved = statsapi_game(849807, "2026-10-17", "L")
        self.cancel(self.fixture("2026-10-16", []), self.fixture("2026-10-17", [moved]))
        self.assertEqual(self.status("mlb-849807"), "scheduled")

    def test_a_tombstoned_game_is_not_cancelled_by_the_pass(self):
        self.seed("2026-10-16", statsapi_game(849807, "2026-10-16", "L"))
        ppd = statsapi_game(849807, "2026-10-16", "L", code="DR")
        p = self.fixture("2026-10-16", [ppd])
        self.assertEqual([t["id"] for t in json.loads(p.read_text(encoding="utf-8"))["validation"]["postponed"]], ["mlb-849807"])
        self.cancel(p)
        self.assertEqual(self.status("mlb-849807"), "scheduled")


class LeavesAlone(Pass):
    def test_an_absent_regular_season_game_is_untouched(self):
        self.seed("2026-09-20", statsapi_game(824001, "2026-09-20", "R"))
        self.cancel(self.fixture("2026-09-20", []))
        self.assertEqual(self.status("mlb-824001"), "scheduled")

    def test_an_absent_final_game_is_untouched(self):
        self.seed("2026-10-12", statsapi_game(849812, "2026-10-12", "L", state="Final", code="F"))
        self.assertEqual(self.status("mlb-849812"), "final")
        self.cancel(self.fixture("2026-10-12", []))
        self.assertEqual(self.status("mlb-849812"), "final")

    def test_a_fixture_without_the_complete_marker_cancels_nothing(self):
        self.seed("2026-10-16", statsapi_game(849807, "2026-10-16", "L"))
        self.cancel(self.fixture("2026-10-16", [], raw={"dates": []}), self.fixture("2026-10-16", [], raw={"message": "error"}))
        self.assertEqual(self.status("mlb-849807"), "scheduled")

    def test_a_stale_fixture_cancels_nothing(self):
        self.seed("2026-10-16", statsapi_game(849807, "2026-10-16", "L"))
        self.cancel(self.fixture("2026-10-16", [], age=timedelta(days=3)))
        self.assertEqual(self.status("mlb-849807"), "scheduled")

    def test_another_days_fixture_does_not_reach_this_day(self):
        self.seed("2026-10-16", statsapi_game(849807, "2026-10-16", "L"))
        self.cancel(self.fixture("2026-10-17", []))
        self.assertEqual(self.status("mlb-849807"), "scheduled")

    def test_another_seasons_postseason_date_does_not_reach_next_season(self):
        g = statsapi_game(900001, "2027-04-01", "R")
        g["season"] = "2027"
        self.load_fx(self.fixture("2027-04-01", [g]))
        self.db.conn.execute("update games set season = 2027 where id = 'mlb-900001'")
        p = self.fixture("2027-04-01", [])
        fx = json.loads(p.read_text(encoding="utf-8")); fx["validation"]["year"] = 2027
        p.write_text(json.dumps(fx), encoding="utf-8")
        self.cancel(p)
        self.assertEqual(self.status("mlb-900001"), "scheduled")


class AFailedFetchWritesNoFixture(unittest.TestCase):
    """The proof the brief asks for: a failed fetch never produces a fixture for the loader to read."""

    def test_the_adapter_raises_and_writes_nothing_when_the_fetch_fails(self):
        with tempfile.TemporaryDirectory() as td:
            def boom(*a, **k):
                raise RuntimeError("HTTP 503 for https://statsapi.mlb.com/api/v1/schedule")
            with mock.patch.object(mlb, "fetch_day", boom), redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
                with self.assertRaises(RuntimeError):
                    mlb.main(["--date", "2026-10-16", "--no-logos", "--output-dir", td])
            self.assertEqual(list(Path(td).glob("*_fixture.json")), [])

    def test_main_runs_the_pass_after_every_fixture_and_records_it(self):
        with tempfile.TemporaryDirectory() as td:
            with redirect_stdout(io.StringIO()):
                fx, _, _ = mlb.build_fixture({"totalGames": 0, "dates": []}, ROOT, season=2026, date="2026-10-19", teams=[])
            p = Path(td) / "mlb_2026_2026-10-19_fixture.json"
            p.write_text(json.dumps(fx), encoding="utf-8")
            out = Path(td) / "out.sql"
            with redirect_stdout(io.StringIO()):
                self.assertEqual(load.main(["--fixture", str(p), "--emit-sql", str(out)]), 0)
            sql = out.read_text(encoding="utf-8")
            self.assertIn("update games set result_status = 'cancelled'", sql)
            self.assertIn('"cancellations": []', sql)


if __name__ == "__main__":
    unittest.main()
