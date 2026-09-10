#!/usr/bin/env python3
"""Boxscore links and provider-status mapping (Milestone 4 part 0, db/migrations/0007).

    python -m unittest tests.test_scores -v        # from the repo root; stdlib only

Two guarantees are load-bearing here and both are cheap to break:

1. `boxscore_url` is computed ONCE, at the first load that sees the game - in ANY state since prompt
   86; it was 'final' only, then final-and-live from prompt 78 - and never overwritten
   (pipeline/load.py SCORES_SQL). A wrong template is therefore permanent for that game, which is
   why migration 0018 had to rewrite the stored `/boxscore/` rows rather than wait for the loader.
2. An unrecognized provider status maps to NULL, never to 'final' - a wrong 'final' freezes
   completed_at and boxscore_url on a game that has not been played.

Every adapter mapper is exercised over the raw provider snapshots TRACKED IN tests/fixtures/, plus
hand-built minimal dicts for the states no snapshot happens to contain. No database, no network,
Windows-portable.

These used to be read from artifacts/validation/, which is gitignored - so on a clean checkout the
files were absent, load_raw() raised SkipTest, and the suite still reported OK with those mappers
SILENTLY UNTESTED. Passing because a machine happens to hold an untracked file is not passing. The
snapshots now live in tests/fixtures/ and are resolved relative to THIS FILE, never the working
directory, so the result does not depend on where the runner was invoked from.

There is deliberately NO fallback to artifacts/: a missing fixture is now a hard error, because a
"use the other location if present" branch is exactly how the hole would reappear. The same bytes
are read by web/test/livescores.test.mjs, so the JavaScript overlay and these Python mappers cannot
silently disagree about a provider payload (D3 amendment, 2026-09-03).
"""
from __future__ import annotations

import io
import json
import sys
import unittest
from contextlib import redirect_stdout
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from adapters import espn, nba, nhl  # noqa: E402
from adapters.common import result_status, score_int  # noqa: E402
from pipeline.load import boxscore_url  # noqa: E402

RAW = Path(__file__).resolve().parent / "fixtures"   # relative to THIS FILE, not the cwd


def quiet(fn, *a, **kw):
    """Mappers warn on stdout by design; tests assert the return value, not the console."""
    buf = io.StringIO()
    with redirect_stdout(buf):
        out = fn(*a, **kw)
    return out, buf.getvalue()


def load_raw(name):
    """Read a tracked provider snapshot. A missing file is an ERROR, never a skip.

    Skipping was the old behaviour and it hid the problem: the fixtures lived under gitignored
    artifacts/, so a clean checkout skipped these mappers and still reported OK.
    """
    p = RAW / name
    if not p.exists():
        raise FileNotFoundError(f"tracked fixture missing: {p} (it should be committed under tests/fixtures/)")
    return json.loads(p.read_text(encoding="utf-8"))


def espn_comp(state, name, completed, home="0", away="0"):
    """Minimal ESPN competition + the sides dict the adapters pass alongside it."""
    comp = {"status": {"type": {"state": state, "name": name, "completed": completed}}}
    return comp, {"home": {"score": home}, "away": {"score": away}}


# --------------------------------------------------------------------------- boxscore templates
class BoxscoreTemplates(unittest.TestCase):
    """PROMPT 86: the three ESPN sports point at ESPN's GAME page, which resolves preview ->
    gamecast -> recap on its own; `/boxscore/` did not. nhl and mlb are unchanged byte for byte."""

    def test_cfb_id_is_used_as_is(self):
        # cfb ids are bare CFBD/ESPN numerics with no sport prefix - splitting on '-' would be wrong
        self.assertEqual(boxscore_url("cfb", "401628319"),
                         "https://www.espn.com/college-football/game/_/gameId/401628319")

    def test_the_cfb_branch_passes_the_WHOLE_id_and_every_other_sport_the_tail(self):
        """THE ASYMMETRY IS EASY TO BREAK WHILE EDITING THE MAP ABOVE IT. `boxscore_url` passes the
        whole id for cfb and the post-hyphen tail for everything else. A hyphenated id makes the two
        branches disagree visibly - no real cfb id has one, which is exactly why a test must."""
        self.assertEqual(boxscore_url("cfb", "cfb-401628319"),
                         "https://www.espn.com/college-football/game/_/gameId/cfb-401628319")
        self.assertEqual(boxscore_url("nfl", "cfb-401628319"),
                         "https://www.espn.com/nfl/game/_/gameId/401628319")

    def test_espn_leagues_strip_the_sport_prefix(self):
        self.assertEqual(boxscore_url("nfl", "nfl-401772510"),
                         "https://www.espn.com/nfl/game/_/gameId/401772510")
        self.assertEqual(boxscore_url("nba", "nba-401810245"),
                         "https://www.espn.com/nba/game/_/gameId/401810245")

    def test_no_espn_template_is_a_box_score_page_any_more(self):
        from pipeline.load import _BOXSCORE
        for sport in ("cfb", "nfl", "nba"):
            self.assertIn("/game/_/gameId/{n}", _BOXSCORE[sport], sport)
            self.assertNotIn("/boxscore/", _BOXSCORE[sport], sport)

    def test_league_native_hosts_for_nhl_and_mlb(self):
        # UNCHANGED BY PROMPT 86, and pinned as exact strings so an edit to the ESPN rows above that
        # strays into these two fails here.
        self.assertEqual(boxscore_url("nhl", "nhl-2026020123"), "https://www.nhl.com/gamecenter/2026020123")
        self.assertEqual(boxscore_url("mlb", "mlb-778123"), "https://www.mlb.com/gameday/778123")

    def test_only_the_first_hyphen_is_a_prefix(self):
        # split("-", 1) keeps everything after the sport tag, hyphens included
        self.assertEqual(boxscore_url("mlb", "mlb-778123-2"), "https://www.mlb.com/gameday/778123-2")

    def test_unknown_sport_has_no_template(self):
        self.assertIsNone(boxscore_url("wnba", "wnba-1"))
        self.assertIsNone(boxscore_url("", "1"))

    def test_every_configured_sport_produces_an_https_url(self):
        for sport in ("cfb", "nfl", "nba", "nhl", "mlb"):
            url = boxscore_url(sport, f"{sport}-12345" if sport != "cfb" else "12345")
            self.assertTrue(url.startswith("https://"), sport)
            self.assertTrue(url.endswith("12345"), sport)


class ScoresWrite(unittest.TestCase):
    """The statement that stores the link, read from the module rather than restated."""

    def test_the_link_is_written_in_every_state_and_never_overwritten(self):
        from pipeline.load import SCORES_SQL
        self.assertIn("boxscore_url  = coalesce(boxscore_url, %s)", SCORES_SQL)
        self.assertNotIn("in ('final', 'in_progress')", SCORES_SQL, "the state gate is gone")
        self.assertNotRegex(SCORES_SQL, r"boxscore_url\s*=\s*%s", "never an unconditional overwrite")

    def test_the_call_site_passes_exactly_one_value_per_placeholder(self):
        """REMOVING THE STATE GATE REMOVED A PLACEHOLDER, and the call site had to lose an argument
        with it. psycopg would raise on the mismatch - but only against a live database, and the
        --emit-sql path inlines positionally and would silently shift every value by one. So the two
        are counted here, from the source."""
        import ast
        from pipeline.load import SCORES_SQL
        tree = ast.parse((ROOT / "pipeline" / "load.py").read_text(encoding="utf-8"))
        calls = [n for n in ast.walk(tree) if isinstance(n, ast.Call) and n.args
                 and isinstance(n.args[0], ast.Name) and n.args[0].id == "SCORES_SQL"]
        self.assertEqual(len(calls), 1, "one call site")
        self.assertEqual(len(calls[0].args[1].elts), SCORES_SQL.count("%s"))


# --------------------------------------------------------------------------- ESPN (nfl / cfb shape)
class EspnStatusMapper(unittest.TestCase):
    def test_saved_nfl_snapshot_scheduled_games_carry_no_scores(self):
        raw = load_raw("espn_nfl_scoreboard_raw.json")
        events = raw["events"]
        self.assertTrue(events, "snapshot has no events")
        seen = set()
        for e in events:
            comp = e["competitions"][0]
            sides = {c["homeAway"]: c for c in comp["competitors"]}
            out, _ = quiet(espn._status_scores, comp, sides)
            seen.add(out["status"])
            if out["status"] not in ("in_progress", "final"):
                # ESPN sends 0 on every unplayed game; it must never reach the database as an integer
                self.assertIsNone(out["homeScore"])
                self.assertIsNone(out["awayScore"])
        self.assertTrue(seen <= {"scheduled", "in_progress", "final", "postponed", "cancelled", None}, seen)

    def test_string_zero_before_kickoff_is_not_an_integer(self):
        comp, sides = espn_comp("pre", "STATUS_SCHEDULED", False, home="0", away="0")
        out, _ = quiet(espn._status_scores, comp, sides)
        self.assertEqual(out["status"], "scheduled")
        self.assertIsNone(out["homeScore"])
        self.assertIsNone(out["awayScore"])

    def test_final_yields_integer_scores(self):
        comp, sides = espn_comp("post", "STATUS_FINAL", True, home="24", away="17")
        out, _ = quiet(espn._status_scores, comp, sides)
        self.assertEqual(out["status"], "final")
        self.assertEqual((out["homeScore"], out["awayScore"]), (24, 17))
        self.assertIsInstance(out["homeScore"], int)

    def test_in_progress_yields_live_scores(self):
        comp, sides = espn_comp("in", "STATUS_IN_PROGRESS", False, home="7", away="3")
        out, _ = quiet(espn._status_scores, comp, sides)
        self.assertEqual(out["status"], "in_progress")
        self.assertEqual((out["homeScore"], out["awayScore"]), (7, 3))

    def test_postponed_and_cancelled_come_from_the_status_name(self):
        comp, sides = espn_comp("post", "STATUS_POSTPONED", False)
        self.assertEqual(quiet(espn._status_scores, comp, sides)[0]["status"], "postponed")
        comp, sides = espn_comp("post", "STATUS_CANCELED", False)   # ESPN spells it with one L
        self.assertEqual(quiet(espn._status_scores, comp, sides)[0]["status"], "cancelled")

    def test_unrecognized_state_is_null_never_final(self):
        comp, sides = espn_comp("halted", "STATUS_DELAYED", False, home="10", away="9")
        out, warn = quiet(espn._status_scores, comp, sides)
        self.assertIsNone(out["status"])
        self.assertIsNone(out["homeScore"])
        self.assertIn("unrecognized", warn)

    def test_post_without_completed_is_null_not_final(self):
        # ESPN has been seen sending state 'post' on a game still being corrected
        comp, sides = espn_comp("post", "STATUS_END_PERIOD", False, home="21", away="21")
        out, warn = quiet(espn._status_scores, comp, sides)
        self.assertIsNone(out["status"])
        self.assertIsNone(out["homeScore"])
        self.assertIn("completed=false", warn)


# --------------------------------------------------------------------------- NBA (ESPN + league file)
class NbaStatusMapper(unittest.TestCase):
    def test_saved_nba_snapshot_maps_cleanly(self):
        raw = load_raw("nba_scoreboard_raw.json")
        self.assertTrue(raw["events"])
        for e in raw["events"]:
            comp = e["competitions"][0]
            sides = {c["homeAway"]: c for c in comp["competitors"]}
            out, _ = quiet(nba._status_scores, comp, sides)
            self.assertIn(out["status"], ("scheduled", "in_progress", "final", "postponed", "cancelled", None))
            if out["status"] not in ("in_progress", "final"):
                self.assertIsNone(out["homeScore"])

    def test_espn_shape_states(self):
        for state, name, completed, expect in (("pre", "STATUS_SCHEDULED", False, "scheduled"),
                                               ("in", "STATUS_IN_PROGRESS", False, "in_progress"),
                                               ("post", "STATUS_FINAL", True, "final")):
            comp, sides = espn_comp(state, name, completed, home="101", away="99")
            self.assertEqual(quiet(nba._status_scores, comp, sides)[0]["status"], expect)

    def test_league_file_trusts_only_the_numeric_code(self):
        for code, expect in ((1, "scheduled"), (2, "in_progress"), (3, "final")):
            g = {"gameStatus": code, "homeTeam": {"score": 110}, "awayTeam": {"score": 108}}
            out, _ = quiet(nba._league_status_scores, g)
            self.assertEqual(out["status"], expect)
            self.assertEqual(out["homeScore"], 110 if expect != "scheduled" else None)

    def test_league_file_unknown_code_is_null_never_final(self):
        out, warn = quiet(nba._league_status_scores, {"gameStatus": 4, "homeTeam": {"score": 110}, "awayTeam": {"score": 108}})
        self.assertIsNone(out["status"])
        self.assertIsNone(out["homeScore"])
        self.assertIn("unrecognized", warn)

    def test_league_file_free_text_status_is_ignored(self):
        # gameStatusText is free text ('Final/OT'); it must not be able to promote a game to final
        out, _ = quiet(nba._league_status_scores, {"gameStatusText": "Final", "homeTeam": {"score": 110}, "awayTeam": {"score": 108}})
        self.assertIsNone(out["status"])


# --------------------------------------------------------------------------- NHL (league gameState)
class NhlStatusMapper(unittest.TestCase):
    def test_saved_nhl_snapshot_maps_cleanly(self):
        raw = load_raw("nhl_schedule_raw.json")
        games = [g for wk in raw.get("gameWeek", []) for g in wk.get("games", [])]
        self.assertTrue(games, "snapshot has no games")
        for g in games:
            out, _ = quiet(nhl._status_scores, g)
            self.assertIn(out["status"], ("scheduled", "in_progress", "final", "postponed", "cancelled", None))
            if out["status"] not in ("in_progress", "final"):
                self.assertIsNone(out["homeScore"])
                self.assertIsNone(out["awayScore"])

    def test_every_documented_gamestate(self):
        for state, expect in (("FUT", "scheduled"), ("PRE", "scheduled"), ("LIVE", "in_progress"),
                              ("CRIT", "in_progress"), ("FINAL", "final"), ("OFF", "final")):
            g = {"id": 1, "gameState": state, "homeTeam": {"score": 4}, "awayTeam": {"score": 2}}
            out, _ = quiet(nhl._status_scores, g)
            self.assertEqual(out["status"], expect, state)
            self.assertEqual(out["homeScore"], 4 if expect in ("in_progress", "final") else None)

    def test_unknown_gamestate_is_null_never_final(self):
        out, warn = quiet(nhl._status_scores, {"id": 1, "gameState": "SUSP", "homeTeam": {"score": 4}, "awayTeam": {"score": 2}})
        self.assertIsNone(out["status"])
        self.assertIsNone(out["homeScore"])
        self.assertIn("unrecognized", warn)

    def test_missing_gamestate_is_null_without_a_warning(self):
        out, warn = quiet(nhl._status_scores, {"id": 1, "homeTeam": {}, "awayTeam": {}})
        self.assertIsNone(out["status"])
        self.assertEqual(warn, "")


# --------------------------------------------------------------------------- MLB (abstractGameState)
class MlbStatusMapper(unittest.TestCase):
    """adapters/mlb.py maps inline: result_status(abstractGameState, detail=detailedState) + score_int."""

    @staticmethod
    def mlb_map(status, teams):
        st, warn = quiet(result_status, status.get("abstractGameState"),
                         detail=status.get("detailedState"), context="mlb test")
        return {"status": st,
                "homeScore": score_int((teams.get("home") or {}).get("score"), st),
                "awayScore": score_int((teams.get("away") or {}).get("score"), st)}, warn

    def test_saved_mlb_snapshot_finals_carry_integer_scores(self):
        raw = load_raw("mlb_schedule_raw.json")
        games = [g for d in raw.get("dates", []) for g in d.get("games", [])]
        self.assertTrue(games, "snapshot has no games")
        finals = 0
        for g in games:
            out, _ = self.mlb_map(g.get("status") or {}, g.get("teams") or {})
            self.assertIn(out["status"], ("scheduled", "in_progress", "final", "postponed", "cancelled", None))
            if out["status"] == "final":
                finals += 1
                self.assertIsInstance(out["homeScore"], int)
                self.assertIsInstance(out["awayScore"], int)
            else:
                self.assertIsNone(out["homeScore"])
        self.assertGreater(finals, 0, "2026-08-31 snapshot should contain completed games")

    def test_abstract_states(self):
        for abstract, expect in (("Preview", "scheduled"), ("Live", "in_progress"), ("Final", "final")):
            out, _ = self.mlb_map({"abstractGameState": abstract, "detailedState": abstract},
                                  {"home": {"score": 5}, "away": {"score": 3}})
            self.assertEqual(out["status"], expect, abstract)

    def test_detailed_state_postponed_overrides_the_abstract_state(self):
        # MLB keeps abstractGameState 'Preview' on a postponed game; detailedState is the truth
        out, _ = self.mlb_map({"abstractGameState": "Preview", "detailedState": "Postponed"}, {})
        self.assertEqual(out["status"], "postponed")

    def test_detailed_state_cancelled_overrides_even_a_final(self):
        out, _ = self.mlb_map({"abstractGameState": "Final", "detailedState": "Cancelled"}, {"home": {"score": 0}})
        self.assertEqual(out["status"], "cancelled")
        self.assertIsNone(out["homeScore"])

    def test_unknown_abstract_state_is_null_never_final(self):
        out, warn = self.mlb_map({"abstractGameState": "Suspended", "detailedState": "Suspended: Rain"},
                                 {"home": {"score": 2}, "away": {"score": 2}})
        self.assertIsNone(out["status"])
        self.assertIsNone(out["homeScore"])
        self.assertIn("unrecognized", warn)


# --------------------------------------------------------------------------- CFBD (completed flag)
class CfbdStatusMapper(unittest.TestCase):
    """adapters/cfbd.py maps inline: 'final' if completed else 'scheduled', scores through score_int."""

    @staticmethod
    def cfbd_map(g):
        st = "final" if g.get("completed") else "scheduled"
        return {"status": st, "homeScore": score_int(g.get("homePoints"), st), "awayScore": score_int(g.get("awayPoints"), st)}

    def test_completed_game_is_final_with_integer_scores(self):
        out = self.cfbd_map({"completed": True, "homePoints": 31, "awayPoints": 28})
        self.assertEqual((out["status"], out["homeScore"], out["awayScore"]), ("final", 31, 28))

    def test_unplayed_game_is_scheduled_with_no_scores(self):
        out = self.cfbd_map({"completed": False, "homePoints": None, "awayPoints": None})
        self.assertEqual(out["status"], "scheduled")
        self.assertIsNone(out["homeScore"])

    def test_scores_present_before_completion_are_still_suppressed(self):
        # CFBD has been seen carrying stale points on an uncompleted row
        out = self.cfbd_map({"completed": False, "homePoints": 0, "awayPoints": 0})
        self.assertIsNone(out["homeScore"])
        self.assertIsNone(out["awayScore"])

    def test_saved_cfbd_snapshot_maps_cleanly(self):
        # A DIFFERENT gap from the artifacts/ one fixed on 2026-09-03, and it keeps its skip on
        # purpose. This snapshot was never saved anywhere in the repo's history - not in
        # artifacts/validation/, not anywhere - so there is nothing to promote into tests/fixtures/.
        # The skip is therefore honest ("we have no CFBD snapshot") rather than a fallback hiding a
        # tracked file. Recording a CFBD week snapshot would close it; until then this reports as a
        # skip so the missing coverage stays visible instead of silently passing.
        p = RAW / "cfbd_2026_week1_games.json"
        if not p.exists():
            self.skipTest("cfbd week1 snapshot not present (never recorded; see comment)")
        games = json.loads(p.read_text(encoding="utf-8"))
        self.assertTrue(games)
        for g in games[:200]:
            out = self.cfbd_map(g)
            self.assertIn(out["status"], ("final", "scheduled"))
            if out["status"] == "scheduled":
                self.assertIsNone(out["homeScore"])


# --------------------------------------------------------------------------- shared score guard
class ScoreIntGuard(unittest.TestCase):
    def test_scores_only_exist_once_play_starts(self):
        for status in (None, "scheduled", "postponed", "cancelled"):
            self.assertIsNone(score_int("14", status), status)
            self.assertIsNone(score_int(14, status), status)

    def test_string_scores_become_integers_once_live(self):
        self.assertEqual(score_int("14", "in_progress"), 14)
        self.assertEqual(score_int("14", "final"), 14)
        self.assertEqual(score_int(0, "final"), 0)

    def test_unparseable_or_empty_scores_are_null(self):
        for v in (None, "", "  ", "TBD", "n/a", {}, []):
            self.assertIsNone(score_int(v, "final"), repr(v))

    def test_result_status_vocabulary_is_closed(self):
        from adapters.common import RESULT_STATES
        for word in ("pre", "in", "post", "FUT", "LIVE", "FINAL", "OFF", "Preview", "Live", "Final"):
            st, _ = quiet(result_status, word)
            self.assertIn(st, RESULT_STATES, word)


if __name__ == "__main__":
    unittest.main()
