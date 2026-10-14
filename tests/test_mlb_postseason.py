#!/usr/bin/env python3
"""Prompt 129 blocks B and C: MLB's postseason spellings, and a FOX postseason game is national.

    python -m unittest tests.test_mlb_postseason -v    # from the repo root; stdlib only

BLOCK B. Statsapi labelled the 2026 postseason's FS1 rows `FS1/ FOX ONE` (09-18..10-08) and then
`FS1 / FOX ONE` (from 10-09), FOX's `FOX/ FOX ONE`, and TBS's `TBS/HBO MAX`. Only `FOX / FOX ONE`,
`FOX / FS1` and `TBS (out-of-market only)` were aliased, so the loader minted three stub networks
with access `unknown` and the NLCS was hidden. The spacing around `/` is now normalised on both the
label and the alias keys, so the lookup stays exact (rule 18) and covers both spellings.
"""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from adapters.common import access_lookup, canonical_outlet, normalize_outlet, outlet_access  # noqa: E402
from adapters.mlb import build_media  # noqa: E402

AVAILABLE, UNAVAILABLE = access_lookup(ROOT)


def tv(name, side, code="national", bid=1):
    return {"type": "TV", "name": name, "homeAway": side, "language": "en", "id": bid,
            "availability": {"availabilityCode": code}}


def mlb_game(broadcasts, *, home="LAD", away="MIL", game_type="L", pk=849810):
    return {"gamePk": pk, "gameType": game_type,
            "teams": {"home": {"team": {"id": 119, "abbreviation": home}}, "away": {"team": {"id": 158, "abbreviation": away}}},
            "broadcasts": broadcasts, "status": {"abstractGameState": "Preview"}}


def media(game, *, start="2026-10-15T00:08:00Z", date="2026-10-14", coverage=None):
    notes: list[str] = []
    rows, _, _ = build_media(game, local_abbrevs={"CLE"}, available=AVAILABLE, unavailable=UNAVAILABLE,
                             start=start, tbd=False, coverage=coverage or {}, official_date=date, notes=notes)
    return rows


class ThePostseasonSpellings(unittest.TestCase):
    def test_each_postseason_spelling_resolves(self):
        for raw, canon in (("FS1 / FOX ONE", "FS1"), ("FS1/ FOX ONE", "FS1"), ("FOX/ FOX ONE", "FOX"), ("TBS/HBO MAX", "TBS")):
            with self.subTest(raw=raw):
                self.assertEqual(normalize_outlet(raw), canon)
                self.assertEqual(outlet_access(canonical_outlet(raw, AVAILABLE, UNAVAILABLE), AVAILABLE, UNAVAILABLE), "AVAILABLE")

    def test_every_pre_existing_slash_alias_still_resolves(self):
        for raw, canon in (("ESPN/ESPN App", "ESPN"), ("ABC/ESPN App", "ABC"), ("NBC/Peacock", "NBC"),
                           ("Peacock/NBCSN", "Peacock"), ("Peacock / NBCSN Extra", "Peacock"),
                           ("FOX / FOX ONE", "FOX"), ("FOX / FS1", "FOX")):
            with self.subTest(raw=raw):
                self.assertEqual(normalize_outlet(raw), canon)

    def test_the_spacing_is_relaxed_and_the_words_are_not(self):
        self.assertEqual(normalize_outlet("FS1 / FOX TWO"), "FS1 / FOX TWO", "no substring or fuzzy match")
        self.assertEqual(normalize_outlet("CBS/Paramount+"), "CBS/Paramount+", "an unaliased label keeps its own spelling")

    def test_an_nlcs_game_on_fs1_emits_one_national_fs1_row(self):
        rows = media(mlb_game([tv("FS1 / FOX ONE", "home", bid=1), tv("FS1 / FOX ONE", "away", bid=2)]))
        self.assertEqual([(r["outlet"], r["market"], r["access"], r["feedSide"]) for r in rows],
                         [("FS1", "national", "AVAILABLE", "NATIONAL")])
        self.assertEqual(rows[0]["label"], "FS1 / FOX ONE", "the feed's own words ride along as the label")


FOX_PAIR = [tv("FOX / FOX ONE", "home", bid=1), tv("FOX / FOX ONE", "away", bid=2)]


def fox_row(game_type, broadcasts=None, **kw):
    rows = media(mlb_game(broadcasts or FOX_PAIR, game_type=game_type), **kw)
    return [(r["outlet"], r["market"], r["access"]) for r in rows]


class FoxPostseasonIsNational(unittest.TestCase):
    """Block C: the regional branch is the regular-season Saturday window and nothing else."""

    def test_an_lcs_game_on_fox_without_the_guardians_is_national_and_available(self):
        self.assertEqual(fox_row("L"), [("FOX", "national", "AVAILABLE")])

    def test_every_postseason_round_is_national(self):
        for t in ("F", "D", "L", "W"):
            with self.subTest(gameType=t):
                self.assertEqual(fox_row(t), [("FOX", "national", "AVAILABLE")])

    def test_a_regular_season_saturday_fox_game_is_still_regional_and_unverified(self):
        self.assertEqual(fox_row("R", start="2026-09-19T23:15:00Z", date="2026-09-19"), [("FOX", "regional", "UNVERIFIED")])

    def test_the_other_spacing_of_the_fox_label_is_regional_in_the_regular_season_too(self):
        pair = [tv("FOX/ FOX ONE", "home", bid=1), tv("FOX/ FOX ONE", "away", bid=2)]
        self.assertEqual(fox_row("R", pair, start="2026-09-19T23:15:00Z", date="2026-09-19"), [("FOX", "regional", "UNVERIFIED")])

    def test_the_all_star_game_is_national(self):
        self.assertEqual(fox_row("A"), [("FOX", "national", "AVAILABLE")])


class StoredAsAPlayoffGame(unittest.TestCase):
    def fixture_game(self, game_type):
        from adapters.mlb import build_fixture
        import io
        from contextlib import redirect_stdout
        g = mlb_game(FOX_PAIR, game_type=game_type)
        g.update({"gameDate": "2026-10-15T00:08:00Z", "season": "2026", "status": {"abstractGameState": "Preview", "statusCode": "S"}})
        with redirect_stdout(io.StringIO()):
            fx, _, _ = build_fixture({"dates": [{"date": "2026-10-14", "games": [g]}]}, ROOT, season=2026, date="2026-10-14", teams=[])
        return fx["games"][0]

    def test_the_adapter_names_the_context_from_the_game_type(self):
        self.assertEqual(self.fixture_game("L")["competitionContext"], "PLAYOFF")
        self.assertEqual(self.fixture_game("W")["competitionContext"], "PLAYOFF")
        self.assertEqual(self.fixture_game("R")["competitionContext"], "REGULAR")
        self.assertNotIn("competitionContext", self.fixture_game("A"), "no guess for a type with no ruling")

    def load_sql(self, fx_game, sport):
        import io
        import json
        import tempfile
        from contextlib import redirect_stdout
        from pipeline.db import DB
        from pipeline.load import load_fixture
        with tempfile.TemporaryDirectory() as td:
            p = Path(td) / f"{sport}_fixture.json"
            p.write_text(json.dumps({"validation": {"sport": sport, "year": 2026, "source": "mlb-statsapi" if sport == "mlb" else "espn.scoreboard"},
                                     "games": [fx_game]}), encoding="utf-8")
            db = DB(str(Path(td) / "out.sql"))
            with redirect_stdout(io.StringIO()):
                load_fixture(db, p, run_id=None)
        return next(s for s in db.emitted if s.startswith("insert into games ("))

    def test_an_lcs_game_loads_as_playoff_on_insert_and_on_update(self):
        sql = self.load_sql(self.fixture_game("L"), "mlb")
        self.assertIn("competition_context", sql.split(") values (")[0])
        self.assertIn("'PLAYOFF'", sql)
        self.assertIn("competition_context = coalesce(excluded.competition_context, games.competition_context)", sql)

    def test_a_fixture_that_does_not_state_one_leaves_the_stored_value_alone(self):
        nfl = {"id": "nfl-401872997", "season": 2026, "week": 7, "startDate": "2026-10-18T17:00:00Z", "startTimeTBD": False,
               "home": {"id": "nfl-5", "team": "Browns", "abbreviation": "CLE"}, "away": {"id": "nfl-33", "team": "Ravens", "abbreviation": "BAL"},
               "media": [], "status": "scheduled"}
        sql = self.load_sql(nfl, "nfl")
        self.assertNotIn("competition_context", sql, "neither inserted nor updated: the stored value stands")


if __name__ == "__main__":
    unittest.main()
