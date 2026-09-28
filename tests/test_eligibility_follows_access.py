#!/usr/bin/env python3
"""Prompt 123: a change in who can watch a game reaches viewer_game_eligibility, not only game_broadcasts.

    python -m unittest tests.test_eligibility_follows_access -v    # from the repo root; stdlib only

WHAT JOE SAW. Sunday 2026-09-27, NFL: "Market TBD" all day on games prompts 118 and 119 had decided by
Thursday. game_broadcasts was right - rule 4b had turned the CBS/FOX rows from `unverified` into
`available` or `out_of_market` - and viewer_game_eligibility, which the app reads, still carried the
row computed on 2026-09-05. The broadcast observation's value is `service|market|certainty`, so an
access change is a repeat sighting: it bumps last_seen_at, supersedes nothing, and the game never
re-entered the reconciler's changed-evidence set. Register §66.

HOW THIS TESTS IT. No Postgres and no network: `SqliteDB` runs the SQL that pipeline/load.py and
pipeline/reconcile.py actually issue against an in-memory SQLite, with the three dialect gaps bridged
(`::type` casts dropped, `update t b` spelled `update t as b`, `= any(list)` read through `json_each`,
and `now`, `greatest` and `split_part` supplied as functions). So a change to the selection SQL - the staleness term dropped, a sport named -
is evaluated rather than mirrored, and the mutation checks mean something. `reconcile.DB` is patched to
this instance and SUPABASE_DB_URL is blanked, so nothing here can open a connection.
"""
from __future__ import annotations

import io
import json
import os
import re
import sqlite3
import sys
import tempfile
import time
import unittest
from contextlib import redirect_stderr, redirect_stdout
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import pipeline.load as load  # noqa: E402
import pipeline.reconcile as reconcile  # noqa: E402
from pipeline.db import DB  # noqa: E402

SCHEMA = """
create table sources (id text primary key, rights_scope text);
create table source_snapshots (id integer primary key autoincrement, source_id, source_url, http_status, content_hash,
    content_type, storage_url, parser_version, parse_status);
create table teams (id text primary key, sport, canonical_name, short_name, abbreviation, external_ids, conference_id);
create table venues (id integer primary key autoincrement, name, city, unique (name, city));
create table networks_services (id text primary key, canonical_name, type);
create table games (id text primary key, sport, external_primary_id, season, week, game_date, viewing_day,
    home_team_id, away_team_id, neutral_site, venue_id, canonical_kickoff_at_utc, canonical_kickoff_at_et,
    kickoff_certainty, kickoff_status, schedule_certainty, primary_network_id, network_certainty, network_status,
    canonical_state, rights_controller_type, rights_controller_id, rights_context_reason, last_verified_at,
    home_score, away_score, result_status, completed_at, boxscore_url, probable_home_pitcher,
    probable_away_pitcher, home_record, away_record);
create table source_observations (id integer primary key autoincrement, source_id, game_id, snapshot_id, field_name,
    raw_value, normalized_value, raw_label, authority_role, authority_score, claim_certainty, source_url_or_key,
    extraction_method, parser_version, observed_at, published_at, updated_at, valid_to, last_seen_at,
    seen_count default 1);
create trigger source_observations_defaults after insert on source_observations when new.observed_at is null
begin update source_observations set observed_at = now(), last_seen_at = now() where id = new.id; end;
create table game_broadcasts (id integer primary key autoincrement, game_id, program_id, service_id, delivery_surface,
    feed_side, is_primary, requires_auth, access_status, carriage_certainty, suppresses_local_feed, blackout_rule,
    market_id, label, last_seen_at, active, unique (game_id, service_id, delivery_surface, feed_side));
create table canonical_decisions (id integer primary key autoincrement, game_id, field_name, rule_version,
    rights_context, winning_source_observation_id, considered_observation_ids, rejected_observation_ids,
    decision_reason, result_value, result_certainty, decision_status, decided_at);
create trigger canonical_decisions_defaults after insert on canonical_decisions when new.decided_at is null
begin update canonical_decisions set decided_at = now() where id = new.id; end;
create table canonical_change_history (id integer primary key autoincrement, game_id, field_name, old_value,
    new_value, canonical_decision_id, decision_reason, winning_source_observation_id, conflicting_observation_ids);
create table viewer_game_eligibility (game_id, viewer_profile_id, eligible, eligible_via_network_id,
    eligible_via_service_ids, reason, market_pending, computed_at, entitlement_version,
    primary key (game_id, viewer_profile_id));
create table markets (id text primary key, is_viewer_market);
create table market_coverage (game_id, network_id, market_id);
create table refresh_runs (run_id integer primary key autoincrement, workflow, providers_called, started_at,
    completed_at, status, games_checked, games_changed, conflicts_found, notes, errors);
insert into sources (id) values ('espn.scoreboard'), ('cfbd'), ('nhl.schedule'), ('nba.schedule'),
    ('data/local_rights'), ('506sports');
"""


def _stamp(v: datetime) -> str:
    """Every timestamp in one UTC, fixed-width form, so SQLite's text comparison is chronological."""
    return v.astimezone(timezone.utc).isoformat(timespec="microseconds")


def _now() -> str:
    return _stamp(datetime.now(timezone.utc))


def _greatest(*xs):
    xs = [x for x in xs if x is not None]
    return max(xs) if xs else None


def _split_part(s, sep, n):
    parts = (s or "").split(sep)
    return parts[n - 1] if 0 < n <= len(parts) else ""


def _param(v):
    if isinstance(v, datetime):
        return _stamp(v)
    if isinstance(v, date):
        return v.isoformat()
    if isinstance(v, bool):
        return int(v)
    if isinstance(v, (list, tuple, dict)):
        return json.dumps(v, default=str)
    return v


def _sqlite(sql: str) -> str:
    sql = re.sub(r"::[a-z_]+", "", sql)
    sql = sql.replace("= any(%s)", "in (select value from json_each(%s))")   # a list param arrives as JSON
    sql = re.sub(r"^\s*update (\w+) (?!set\b)(\w+) set", r"update \1 as \2 set", sql)
    return sql.replace("%s", "?")


class SqliteDB(DB):
    """pipeline.db.DB over an in-memory SQLite. Constructed in emit mode so the parent never connects."""

    def __init__(self, tmp: Path):
        super().__init__(str(tmp / "never-written.sql"))
        self.conn = sqlite3.connect(":memory:")
        self.conn.create_function("now", 0, _now)
        self.conn.create_function("greatest", -1, _greatest)
        self.conn.create_function("split_part", 3, _split_part)
        self.conn.executescript(SCHEMA)
        self.executed: list[str] = []

    def run(self, sql, params=None, tag=None):
        if tag:
            self.stats[tag] = self.stats.get(tag, 0) + 1
        self.executed.append(sql)
        self.conn.execute(_sqlite(sql), tuple(_param(v) for v in params or ()))

    def fetch(self, sql, params=None):
        self.executed.append(sql)
        return self.conn.execute(_sqlite(sql), tuple(_param(v) for v in params or ())).fetchall()

    def close(self):
        pass   # reconcile.main() closes its DB in a finally; this one outlives the call


def tick() -> None:
    """Let the clock move, so 'after' is strictly after on any timer resolution."""
    t0 = datetime.now(timezone.utc)
    while datetime.now(timezone.utc) <= t0 + timedelta(milliseconds=20):
        time.sleep(0.005)


def game(gid: str, outlet: str, access: str, source: str, *, start: str = "2026-09-27T17:00:00Z",
         home=("nfl-23", "Steelers", "PIT"), away=("nfl-4", "Bengals", "CIN")) -> dict:
    """One game with one regional TV row, in the shape adapters/espn.py's decide_regional writes."""
    return {
        "id": gid, "season": 2026, "week": 3, "startDate": start, "startTimeTBD": False, "neutralSite": False,
        "home": {"id": home[0], "team": home[1], "teamFull": home[1], "abbreviation": home[2]},
        "away": {"id": away[0], "team": away[1], "teamFull": away[1], "abbreviation": away[2]},
        "media": [{"mediaType": "tv", "outlet": outlet, "access": access, "market": "regional",
                   "carriageCertainty": "CONFIRMED", "source": source}],
        "status": "scheduled", "homeScore": None, "awayScore": None,
    }


RULE_6 = "regional feed - neither the station listing nor the coverage window decided this game"
RULE_4B = "entitledsports week 3 (updated Wed Sep 23 5:30 AM ET): WOIO CBS early CIN @ PIT"


class Harness(unittest.TestCase):
    def setUp(self):
        self._td = tempfile.TemporaryDirectory()
        self.tmp = Path(self._td.name)
        self.db = SqliteDB(self.tmp)
        self.runs = 0
        for p in (mock.patch.dict(os.environ, {"SUPABASE_DB_URL": ""}),
                  mock.patch.object(load, "sync_shadow_program", lambda *a, **k: None),
                  mock.patch.object(reconcile, "DB", lambda *a, **k: self.db)):
            p.start()
            self.addCleanup(p.stop)
        load.TEAM_CHANGES.clear()

    def tearDown(self):
        self.db.conn.close()
        self._td.cleanup()

    def load(self, sport: str, games: list[dict]) -> None:
        self.runs += 1
        p = self.tmp / f"{sport}_{self.runs}_fixture.json"
        p.write_text(json.dumps({"validation": {"generatedAt": "2026-09-24T09:00:00-04:00", "sport": sport,
                                                "year": 2026, "week": 3, "source": "espn.scoreboard"},
                                 "games": games}), encoding="utf-8")
        with redirect_stdout(io.StringIO()):
            load.load_fixture(self.db, p, run_id=None)
        self.db.conn.commit()
        tick()

    def reconcile(self) -> dict:
        """reconcile.main() in default mode - the refresh's own invocation. Returns the run's notes."""
        self.runs += 1
        out, err = io.StringIO(), io.StringIO()
        with redirect_stdout(out), redirect_stderr(err):
            rc = reconcile.main(["--workflow", "test", "--log", str(self.tmp / f"reconcile_{self.runs}.md")])
        self.assertEqual(rc, 0, err.getvalue())
        tick()
        return json.loads(self.db.conn.execute("select notes from refresh_runs order by run_id desc limit 1").fetchone()[0])

    def eligibility(self, gid: str) -> dict:
        row = self.db.conn.execute(
            "select eligible, market_pending, reason, computed_at, eligible_via_network_id from viewer_game_eligibility "
            "where game_id = ? and viewer_profile_id = 1", (gid,)).fetchone()
        self.assertIsNotNone(row, f"no eligibility row for {gid}")
        return dict(zip(["eligible", "market_pending", "reason", "computed_at", "via"], row))

    def decisions(self) -> int:
        return self.db.conn.execute("select count(*) from canonical_decisions").fetchone()[0]


class SundayReproduced(Harness):
    """Load a CBS row `unverified`, reconcile; load it again decided, with an IDENTICAL observation."""

    GID = "nfl-401872950"   # Bengals @ Steelers, CBS early, 2026-09-27 - one of the three Cowork measured

    def first_day(self):
        self.load("nfl", [game(self.GID, "CBS", "UNVERIFIED", RULE_6)])
        self.reconcile()
        before = self.eligibility(self.GID)
        self.assertEqual((before["eligible"], before["market_pending"], before["reason"]),
                         (0, 1, "not receivable: cbs=unverified"), "the Sept. 5 row: Market TBD")
        return before

    def test_available_reaches_eligibility_with_a_fresh_computed_at(self):
        before = self.first_day()
        self.load("nfl", [game(self.GID, "CBS", "AVAILABLE", RULE_4B)])
        # THE PREMISE, pinned so the test cannot pass for the wrong reason: the broadcast observation is
        # the same claim seen twice, nothing superseded - and CHANGED_WHERE therefore does not select it.
        obs = self.db.conn.execute("select normalized_value, seen_count, valid_to from source_observations "
                                   "where game_id = ? and field_name = 'broadcast'", (self.GID,)).fetchall()
        self.assertEqual(obs, [("cbs|regional|CONFIRMED", 2, None)])
        self.assertEqual(self.db.conn.execute("select access_status from game_broadcasts where game_id = ?",
                                              (self.GID,)).fetchone()[0], "available")
        self.assertEqual(reconcile.read_input(self.db, None, False)["games"], [], "not in the changed-evidence set")
        self.reconcile()
        after = self.eligibility(self.GID)
        self.assertEqual(after["eligible"], 1)
        self.assertEqual(after["market_pending"], 0)
        self.assertEqual(after["reason"], "linear cbs")
        self.assertEqual(after["via"], "cbs")
        self.assertGreater(after["computed_at"], before["computed_at"], "computed_at is fresh")

    def test_out_of_market_is_decided_not_pending(self):
        before = self.first_day()
        self.load("nfl", [game(self.GID, "CBS", "OUT_OF_MARKET", RULE_4B.replace("CIN @ PIT", "KC @ BUF"))])
        self.reconcile()
        after = self.eligibility(self.GID)
        self.assertEqual((after["eligible"], after["market_pending"]), (0, 0), "out of market, not Market TBD")
        self.assertEqual(after["reason"], "not receivable: cbs=out_of_market")
        self.assertGreater(after["computed_at"], before["computed_at"])

    def test_the_canonical_decision_is_not_remade(self):
        """CHANGED_WHERE keeps its purpose: an access-only change re-decides eligibility and nothing else."""
        self.first_day()
        decided = self.decisions()
        verified = self.db.conn.execute("select last_verified_at from games where id = ?", (self.GID,)).fetchone()[0]
        self.load("nfl", [game(self.GID, "CBS", "AVAILABLE", RULE_4B)])
        notes = self.reconcile()
        self.assertEqual(self.decisions(), decided, "no canonical_decisions row for an access-only change")
        self.assertEqual(self.db.conn.execute("select last_verified_at from games where id = ?", (self.GID,)).fetchone()[0],
                         verified, "the games row is not rewritten")
        self.assertEqual(notes.get("eligibility_only"), 1)
        self.assertEqual(notes.get("eligibility_changes"), 1)

    def test_the_log_names_the_change(self):
        self.first_day()
        self.load("nfl", [game(self.GID, "CBS", "AVAILABLE", RULE_4B)])
        self.reconcile()
        text = (self.tmp / f"reconcile_{self.runs}.md").read_text(encoding="utf-8")
        self.assertIn(f"- ELIGIBILITY {self.GID}: not receivable: cbs=unverified [market pending] -> linear cbs\n", text)


class NotOnlyTheNFL(Harness):
    """Cowork measured stale rows in every sport; the pass must not be a football special case."""

    def test_an_mlb_regional_row_that_resolves_reaches_eligibility(self):
        gid = "mlb-776001"
        mlb = dict(home=("mlb-114", "Guardians", "CLE"), away=("mlb-116", "Tigers", "DET"), start="2026-09-26T20:10:00Z")
        self.load("mlb", [game(gid, "FOX", "UNVERIFIED", "regional window", **mlb)])
        self.reconcile()
        self.assertEqual(self.eligibility(gid)["market_pending"], 1)
        self.load("mlb", [game(gid, "FOX", "AVAILABLE", "regional window", **mlb)])
        self.reconcile()
        after = self.eligibility(gid)
        self.assertEqual((after["eligible"], after["market_pending"], after["reason"]), (1, 0, "linear fox"))


class ScopedToWhatMoved(Harness):
    def test_a_game_the_load_did_not_touch_keeps_its_row(self):
        """Not --all: a game whose broadcast rows were not seen since its verdict is not re-judged."""
        other = "nfl-401872951"
        self.load("nfl", [game("nfl-401872950", "CBS", "UNVERIFIED", RULE_6),
                          game(other, "CBS", "UNVERIFIED", RULE_6, home=("nfl-33", "Ravens", "BAL"), away=("nfl-6", "Cowboys", "DAL"))])
        self.reconcile()
        kept = self.eligibility(other)["computed_at"]
        self.load("nfl", [game("nfl-401872950", "CBS", "AVAILABLE", RULE_4B)])
        notes = self.reconcile()
        self.assertEqual(self.eligibility(other)["computed_at"], kept)
        self.assertEqual(notes.get("eligibility_only"), 1)

    def test_one_eligibility_write_per_game_per_run(self):
        """A new game is in BOTH sets on its first run - no decision yet, no eligibility yet - and is
        written once, by the full reconcile."""
        self.load("nfl", [game("nfl-401872950", "CBS", "UNVERIFIED", RULE_6)])
        self.db.stats.clear()
        notes = self.reconcile()
        self.assertEqual(self.db.stats.get("viewer_game_eligibility"), 1)
        self.assertNotIn("eligibility_only", notes)

    def test_all_and_game_modes_read_no_eligibility_only_set(self):
        self.load("nfl", [game("nfl-401872950", "CBS", "UNVERIFIED", RULE_6)])
        for args in ((None, True), (["nfl-401872950"], False)):
            self.assertNotIn("eligibility_games", reconcile.read_input(self.db, *args))


class TheSelectionSql(unittest.TestCase):
    def test_it_compares_last_seen_with_computed_at_and_names_no_sport(self):
        where = reconcile.STALE_ELIGIBILITY_WHERE
        self.assertIn("sb.last_seen_at > ve.computed_at", where)
        self.assertIn("ve.computed_at is null", where, "a game with no verdict at all is stale by definition")
        self.assertNotIn("sport", where)

    def test_the_broadcast_read_stays_game_scoped(self):
        """The 0012 guard's shape (tests/test_program_broadcasts.py): never an empty broadcast where-clause."""
        src = (ROOT / "pipeline" / "reconcile.py").read_text(encoding="utf-8")
        self.assertIn('stale_ids = "where b.game_id in (select g.id from games g " + STALE_ELIGIBILITY_WHERE + ")"', src)


if __name__ == "__main__":
    unittest.main()
