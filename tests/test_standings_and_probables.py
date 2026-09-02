#!/usr/bin/env python3
"""Standings, probable pitchers and MLB short names (prompt 13, db/migrations/0008).

    python -m unittest tests.test_standings_and_probables -v    # from the repo root; stdlib only

Four things here are load-bearing and all four are cheap to break:

1. A probable pitcher renders as "F. Lastname (W-L, ERA)" and degrades to the NAME ALONE when the stats
   call did not answer - never to a guessed record. A traded pitcher's line is the COMBINED split
   (`numTeams` present, no `team` key), never one club's half.
2. The loader is null-safe in BOTH directions: an incoming null never erases a stored starter, and a
   CHANGED name overwrites (a scratch two hours before first pitch has to reach the card).
3. `teams.short_name` for MLB comes from statsapi `teamName`. The last-word fallback in
   pipeline.bootstrap cannot spell a two-word nickname: it made "Red Sox" and "White Sox" both 'Sox'.
4. Standings parse per league with the fields that league actually publishes and null everywhere else -
   and NBA's `division_rank` carries the CONFERENCE seed (Joe's ruling 2026-09-02).

Saved provider snapshots under artifacts/validation/ are used where they exist; everything else is a
hand-built minimal dict. No database, no network, Windows-portable.
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

from adapters import mlb  # noqa: E402
from pipeline import standings  # noqa: E402
from pipeline.bootstrap import _norm_school  # noqa: E402
from pipeline.db import DB  # noqa: E402
from pipeline.load import load_fixture  # noqa: E402

RAW = ROOT / "artifacts" / "validation"


def load_raw(name):
    p = RAW / name
    if not p.exists():
        raise unittest.SkipTest(f"{name} not present")
    return json.loads(p.read_text(encoding="utf-8"))


def person(pid, first, last, *, splits=None):
    p = {"id": pid, "useName": first, "firstName": first, "lastName": last, "fullName": f"{first} {last}"}
    if splits is not None:
        p["stats"] = [{"group": {"displayName": "pitching"}, "type": {"displayName": "season"}, "splits": splits}]
    return p


def split(wins, losses, era, *, team=None, num_teams=None):
    sp = {"season": "2026", "gameType": "R", "stat": {"wins": wins, "losses": losses, "era": era}}
    if team is not None:
        sp["team"] = {"id": team, "name": str(team)}
    if num_teams is not None:
        sp["numTeams"] = num_teams
    return sp


# --------------------------------------------------------------------------- probable pitchers: parse
class ProbablePitcherDisplay(unittest.TestCase):
    def test_name_and_season_line(self):
        people = {519242: person(519242, "Chris", "Sale", splits=[split(13, 9, "2.06")])}
        self.assertEqual(mlb.pitcher_display({"id": 519242}, people), "C. Sale (13-9, 2.06)")

    def test_traded_pitcher_uses_the_combined_split_not_one_club(self):
        # verified live 2026-09-02: Jose Soriano, 11-7 3.45 across two clubs (9-6 + 2-1)
        people = {667755: person(667755, "Jose", "Soriano", splits=[
            split(11, 7, "3.45", num_teams=2), split(9, 6, "3.29", team=108), split(2, 1, "4.13", team=141)])}
        self.assertEqual(mlb.pitcher_display({"id": 667755}, people), "J. Soriano (11-7, 3.45)")

    def test_name_alone_when_the_stats_call_did_not_answer(self):
        # the schedule named him; /people returned nothing for that id - the name still renders
        self.assertEqual(mlb.pitcher_display({"id": 999, "useName": "Blade", "lastName": "Tidwell"}, {}),
                         "B. Tidwell")

    def test_name_alone_when_era_is_not_a_number(self):
        # MLB sends '-.--' for a pitcher with no innings; that is not an ERA and must not be printed
        people = {1: person(1, "Rookie", "Callup", splits=[split(0, 0, "-.--")])}
        self.assertEqual(mlb.pitcher_display({"id": 1}, people), "R. Callup")

    def test_absent_probable_is_none(self):
        self.assertIsNone(mlb.pitcher_display(None, {}))
        self.assertIsNone(mlb.pitcher_display({}, {}))

    def test_build_probables_always_has_both_sides(self):
        game = {"teams": {"away": {"probablePitcher": {"id": 7, "useName": "Ann", "lastName": "Ace"}},
                          "home": {}}}
        self.assertEqual(mlb.build_probables(game, {}), {"away": "A. Ace", "home": None})


class ProbablePitcherFromSavedSnapshot(unittest.TestCase):
    def test_saved_schedule_snapshot_yields_display_strings(self):
        raw = load_raw("mlb_2026_2026-09-03_raw.json")
        ids = mlb.probable_ids(raw)
        self.assertTrue(ids, "snapshot names no probable pitchers")
        self.assertEqual(len(ids), len(set(ids)), "probable_ids must de-duplicate")
        people_path = RAW / "mlb_2026_2026-09-03_people.json"
        people = ({int(p["id"]): p for p in json.loads(people_path.read_text(encoding="utf-8"))["people"]}
                  if people_path.exists() else {})
        seen = 0
        for bucket in raw.get("dates", []):
            for g in bucket.get("games", []):
                for side, value in mlb.build_probables(g, people).items():
                    if value is None:
                        continue
                    seen += 1
                    self.assertRegex(value, r"^[A-Z]\. \S")     # 'C. Sale', never a bare surname
                    if "(" in value:
                        self.assertRegex(value, r"\(\d+-\d+, \d+\.\d+\)$")
        self.assertGreater(seen, 0, "no probable rendered from the saved snapshot")

    def test_a_side_the_schedule_does_not_name_is_null(self):
        """An unnamed side is None - on any game, doubleheader or not.

        This test used to assert that game 2 of a doubleheader NEVER carries a probable. That was an
        overreach from a single day's payload: on 2026-09-03 both halves of the 2026-09-04 DET @ CLE
        doubleheader were blank, and by 2026-09-04 MLB had named a starter for one of them. What is
        actually load-bearing - and true every day - is that a side the schedule leaves out comes back
        null rather than guessed.
        """
        raw = load_raw("mlb_2026_2026-09-04_raw.json")
        games = [g for b in raw.get("dates", []) for g in b.get("games", [])]
        self.assertTrue(games, "snapshot has no games")
        checked = 0
        for g in games:
            teams = g.get("teams") or {}
            built = mlb.build_probables(g, {})
            for side in ("away", "home"):
                named = ((teams.get(side) or {}).get("probablePitcher") or {}).get("id")
                if named is None:
                    self.assertIsNone(built[side], f"{g.get('gamePk')} {side}")
                    checked += 1
                else:
                    self.assertIsNotNone(built[side], f"{g.get('gamePk')} {side}")
        self.assertGreater(checked, 0, "no unnamed side in the snapshot to check")


# --------------------------------------------------------------------------- loader null-safety
GAME = {
    "id": "mlb-824388", "sport": "mlb", "season": 2026, "week": None,
    "startDate": "2026-09-03T22:40:00Z", "startTimeTBD": False, "neutralSite": False, "venue": "Progressive Field",
    "home": {"id": "mlb-114", "team": "Guardians", "teamFull": "Cleveland Guardians", "abbreviation": "CLE"},
    "away": {"id": "mlb-141", "team": "Blue Jays", "teamFull": "Toronto Blue Jays", "abbreviation": "TOR"},
    "media": [], "odds": None, "records": None, "status": "scheduled",
    "homeScore": None, "awayScore": None,
}


def emit_load(tmp: Path, probables) -> list[str]:
    """Run load_fixture in emit-SQL mode (no connection, no network) and return the statements."""
    game = dict(GAME)
    if probables is not None:
        game["probables"] = probables
    path = tmp / "mlb_2026_test_fixture.json"
    path.write_text(json.dumps({"validation": {"generatedAt": "2026-09-03T08:00:00-04:00", "sport": "mlb",
                                               "year": 2026, "week": None, "source": "mlb-statsapi"},
                                "games": [game]}), encoding="utf-8")
    db = DB(str(tmp / "emitted.sql"))
    with redirect_stdout(io.StringIO()):
        load_fixture(db, path, run_id=None)
    return [s for s in db.emitted if "probable_home_pitcher" in s]


class LoaderNullSafety(unittest.TestCase):
    def test_a_named_starter_is_written(self):
        with tempfile.TemporaryDirectory() as d:
            stmts = emit_load(Path(d), {"away": "J. Soriano (11-7, 3.45)", "home": "T. Bibee (5-14, 3.88)"})
        self.assertEqual(len(stmts), 1)
        self.assertIn("'T. Bibee (5-14, 3.88)'", stmts[0])      # home first in the UPDATE
        self.assertIn("'J. Soriano (11-7, 3.45)'", stmts[0])

    def test_a_null_never_erases_a_stored_starter(self):
        with tempfile.TemporaryDirectory() as d:
            stmts = emit_load(Path(d), {"away": None, "home": None})
        self.assertEqual(len(stmts), 1)
        # coalesce(null, probable_home_pitcher) keeps whatever the column already holds
        self.assertIn("coalesce(null, probable_home_pitcher)", stmts[0])
        self.assertIn("coalesce(null, probable_away_pitcher)", stmts[0])

    def test_a_changed_name_overwrites(self):
        with tempfile.TemporaryDirectory() as d:
            stmts = emit_load(Path(d), {"away": None, "home": "S. Bieber (9-3, 2.88)"})
        self.assertIn("coalesce('S. Bieber (9-3, 2.88)', probable_home_pitcher)", stmts[0])

    def test_a_fixture_without_probables_emits_no_probable_statement(self):
        # every non-MLB sport: the key is absent, so the loader must not touch the columns at all
        with tempfile.TemporaryDirectory() as d:
            self.assertEqual(emit_load(Path(d), None), [])

    def test_blank_and_non_string_values_are_treated_as_absent(self):
        with tempfile.TemporaryDirectory() as d:
            stmts = emit_load(Path(d), {"away": "   ", "home": 42})
        self.assertIn("coalesce(null, probable_home_pitcher)", stmts[0])
        self.assertIn("coalesce(null, probable_away_pitcher)", stmts[0])


# --------------------------------------------------------------------------- MLB short names
STATSAPI_TEAMS = [
    {"id": 111, "name": "Boston Red Sox", "teamName": "Red Sox", "abbreviation": "BOS",
     "locationName": "Boston", "league": {"name": "American League"}, "division": {"name": "American League East"}},
    {"id": 145, "name": "Chicago White Sox", "teamName": "White Sox", "abbreviation": "CWS",
     "locationName": "Chicago", "league": {"name": "American League"}, "division": {"name": "American League Central"}},
    {"id": 141, "name": "Toronto Blue Jays", "teamName": "Blue Jays", "abbreviation": "TOR",
     "locationName": "Toronto", "league": {"name": "American League"}, "division": {"name": "American League East"}},
    {"id": 114, "name": "Cleveland Guardians", "teamName": "Guardians", "abbreviation": "CLE",
     "locationName": "Cleveland", "league": {"name": "American League"}, "division": {"name": "American League Central"}},
]


def bootstrap_short_name(team: dict) -> str:
    """The exact expression pipeline.bootstrap uses for a pro team's short_name."""
    return team.get("nickname") or (team.get("school") or "").split(" ")[-1]


class MlbShortNames(unittest.TestCase):
    def test_sox_is_not_a_team(self):
        built = {t["id"]: t for t in mlb.build_teams(STATSAPI_TEAMS, [])}
        self.assertEqual(built["mlb-111"]["nickname"], "Red Sox")
        self.assertEqual(built["mlb-145"]["nickname"], "White Sox")
        self.assertNotEqual(bootstrap_short_name(built["mlb-111"]), bootstrap_short_name(built["mlb-145"]))

    def test_bootstrap_short_name_keeps_both_words(self):
        built = {t["id"]: t for t in mlb.build_teams(STATSAPI_TEAMS, [])}
        self.assertEqual(bootstrap_short_name(built["mlb-111"]), "Red Sox")
        self.assertEqual(bootstrap_short_name(built["mlb-145"]), "White Sox")
        self.assertEqual(bootstrap_short_name(built["mlb-141"]), "Blue Jays")
        self.assertEqual(bootstrap_short_name(built["mlb-114"]), "Guardians")

    def test_the_last_word_fallback_is_what_broke_them(self):
        # regression guard: without `nickname` the fallback collapses two clubs onto one name
        self.assertEqual(bootstrap_short_name({"school": "Red Sox"}), "Sox")
        self.assertEqual(bootstrap_short_name({"school": "White Sox"}), "Sox")

    def test_saved_teams_file_carries_every_nickname(self):
        teams = load_raw("mlb_2026_teams.json")
        self.assertEqual(len(teams), 30)
        by_id = {t["id"]: t for t in teams}
        self.assertEqual(by_id["mlb-111"]["nickname"], "Red Sox")
        self.assertEqual(by_id["mlb-145"]["nickname"], "White Sox")
        self.assertTrue(all(t.get("nickname") for t in teams))


# --------------------------------------------------------------------------- standings parsers
class StandingsParsers(unittest.TestCase):
    def test_mlb_strings_become_numbers_and_the_leader_is_zero_games_back(self):
        raw = {"records": [{"teamRecords": [
            {"team": {"id": 139}, "wins": 83, "losses": 55, "divisionRank": "1", "gamesBack": "-",
             "leagueRecord": {"wins": 83, "losses": 55, "ties": 0}},
            {"team": {"id": 114}, "wins": 70, "losses": 68, "divisionRank": "2", "gamesBack": "3.0",
             "leagueRecord": {"wins": 70, "losses": 68, "ties": 0}}]}]}
        rows, notes = standings.parse_mlb(raw, 2026)
        self.assertEqual(notes, [])
        by_id = {r["team_id"]: r for r in rows}
        self.assertEqual(by_id["mlb-139"]["games_back"], 0.0)
        self.assertEqual(by_id["mlb-114"]["division_rank"], 2)
        self.assertEqual(by_id["mlb-114"]["games_back"], 3.0)
        # MLB publishes neither of these; they stay null rather than 0
        self.assertIsNone(by_id["mlb-114"]["points"])
        self.assertIsNone(by_id["mlb-114"]["ot_losses"])

    def test_nhl_season_comes_from_the_season_id_and_unknown_clubs_are_skipped(self):
        raw = {"standings": [
            {"teamAbbrev": {"default": "COL"}, "wins": 55, "losses": 16, "otLosses": 11, "points": 121,
             "divisionSequence": 1, "seasonId": 20252026, "ties": 0},
            {"teamAbbrev": {"default": "ZZZ"}, "wins": 1, "losses": 1, "seasonId": 20252026}]}
        rows, notes = standings.parse_nhl(raw, {"COL": "nhl-21"})
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0], {"team_id": "nhl-21", "season": 2025, "wins": 55, "losses": 16, "ties": 0,
                                   "ot_losses": 11, "points": 121, "division_rank": 1, "games_back": None})
        self.assertTrue(any("ZZZ" in n for n in notes))

    def test_nba_division_rank_holds_the_conference_seed(self):
        raw = {"season": {"displayName": "2025-26"}, "children": [{"name": "Eastern Conference", "standings": {
            "entries": [{"team": {"abbreviation": "CLE"}, "stats": [
                {"name": "wins", "value": 52.0}, {"name": "losses", "value": 30.0},
                {"name": "playoffSeed", "value": 4.0},
                {"name": "gamesBehind", "value": 8.0, "displayValue": "8"}]}]}}]}
        rows, notes = standings.parse_espn(raw, "nba", 2026)
        self.assertEqual(notes, [])
        self.assertEqual(rows[0]["team_id"], "nba-CLE")
        self.assertEqual(rows[0]["season"], 2025)          # the provider's own label decides the season
        self.assertEqual(rows[0]["division_rank"], 4)      # CONFERENCE seed (Joe's ruling)
        self.assertEqual(rows[0]["games_back"], 8.0)

    def test_nfl_rank_is_null_while_nobody_has_played(self):
        # before week 1 every club is 0-0 and ESPN's order inside a division is arbitrary
        entry = lambda tid: {"team": {"id": tid}, "stats": [                                    # noqa: E731
            {"name": "wins", "value": 0.0}, {"name": "losses", "value": 0.0}, {"name": "ties", "value": 0.0},
            {"name": "gamesBehind", "value": 0.0, "displayValue": "-"}]}
        raw = {"season": {"displayName": "2026"}, "children": [{"name": "AFC", "children": [
            {"name": "AFC North", "standings": {"entries": [entry("5"), entry("33")]}}]}]}
        rows, _ = standings.parse_espn(raw, "nfl", 2026)
        self.assertEqual({r["team_id"] for r in rows}, {"nfl-5", "nfl-33"})
        self.assertTrue(all(r["division_rank"] is None for r in rows))
        self.assertTrue(all(r["season"] == 2026 for r in rows))

    def test_nfl_rank_is_the_group_order_once_games_are_played(self):
        def entry(tid, w, l):
            return {"team": {"id": tid}, "stats": [{"name": "wins", "value": float(w)},
                                                   {"name": "losses", "value": float(l)},
                                                   {"name": "ties", "value": 0.0}]}
        raw = {"season": {"displayName": "2026"}, "children": [{"name": "AFC", "children": [
            {"name": "AFC North", "standings": {"entries": [entry("5", 3, 0), entry("33", 2, 1)]}}]}]}
        rows, _ = standings.parse_espn(raw, "nfl", 2026)
        by_id = {r["team_id"]: r for r in rows}
        self.assertEqual(by_id["nfl-5"]["division_rank"], 1)
        self.assertEqual(by_id["nfl-33"]["division_rank"], 2)

    def test_season_label_parsing(self):
        self.assertEqual(standings.start_year("2025-26", 0), 2025)
        self.assertEqual(standings.start_year("2026", 0), 2026)
        self.assertEqual(standings.start_year(None, 2026), 2026)

    def test_saved_snapshots_parse_for_every_league(self):
        for league, parse in (("mlb", lambda r: standings.parse_mlb(r, 2026)),
                              ("nhl", lambda r: standings.parse_nhl(r, {"COL": "nhl-21"})),
                              ("nba", lambda r: standings.parse_espn(r, "nba", 2026)),
                              ("nfl", lambda r: standings.parse_espn(r, "nfl", 2026))):
            raw = load_raw(f"standings_{league}_2026-09-02_raw.json")
            rows, _ = parse(raw)
            expected = 1 if league == "nhl" else (30 if league in ("mlb", "nba") else 32)
            self.assertEqual(len(rows), expected, league)
            for r in rows:
                self.assertEqual(set(r), {"team_id", "season", *standings.FIELDS}, league)


# --------------------------------------------------------------------------- display-name matching
class DisplayNameMatching(unittest.TestCase):
    def test_normalization_folds_spelling_not_identity(self):
        self.assertEqual(_norm_school("San Jose State"), _norm_school("San José St"))
        self.assertEqual(_norm_school("North Carolina A&T"), _norm_school("North Carolina A and T"))
        self.assertNotEqual(_norm_school("Miami (OH)"), _norm_school("Miami (FL)"))


if __name__ == "__main__":
    unittest.main()
