#!/usr/bin/env python3
"""The NHL odds join, and the abbreviation trap it walks past (prompt 57 stage 2).

    python -m unittest tests.test_nhl_odds -v    # from the repo root; stdlib only, no network

`adapters/nhl.py` hardcoded `"odds": None` and shipped a blank right slot on every NHL card. The
lines exist - ESPN's NHL scoreboard carries the same DraftKings block `adapters/espn.py:_odds()`
already parses for the NFL and NBA - so the work was a JOIN, not a parser.

WHY THE JOIN IS NOT ON IDS. `adapters/nba.py` documents the trap in this codebase: ESPN's event ids
are not the league API's, and a loader that joins on them "would leave every NBA card without a live
score and raise no error at all." So the key is (ET date, away abbrev, home abbrev) - the one thing
both APIs agree on, unique because no NHL club plays twice in a day, and THREE fields rather than one
because working rule 18 wants a second key cross-checked.

AND THE ABBREVIATIONS ARE THE TRAP, one endpoint deep. `NHL_TO_ESPN` has existed since the adapter
was written and maps Utah `UTA` -> `UTAH`. That is CORRECT for ESPN's TEAMS endpoint, which
`build_teams()` joins against for colours and logos. It is WRONG for the SCOREBOARD, which spells
Utah `UTA` exactly as the NHL does. Reusing the one map for both - which is what the brief for this
stage instructed - would have translated `UTA` into `UTAH`, matched no event, and dropped every Utah
game with no error at all: the same failure, through a different door.

MEASURED 2026-09-07 against both live APIs, 32 clubs each:
    NHL not in ESPN scoreboard : LAK, NJD, SJS, TBL
    ESPN scoreboard not in NHL : LA,  NJ,  SJ,  TB
Four divergences, not five.
"""
from __future__ import annotations

import json
import unittest
from pathlib import Path

from adapters.common import et_date
from adapters.nhl import NHL_TO_ESPN, NHL_TO_ESPN_SCOREBOARD, build_fixture, espn_abbrev

ROOT = Path(__file__).resolve().parents[1]
# tests/fixtures/, NOT artifacts/ - artifacts/ is gitignored, and tests/test_scores.py records what
# that cost last time: a clean checkout skipped the mappers and still reported OK. This file is
# already committed and already used by test_scores.py; it is the same 2026-10-01 window, 47 games.
RAW = ROOT / "tests" / "fixtures" / "nhl_schedule_raw.json"


def _raw() -> dict:
    if not RAW.exists():
        raise FileNotFoundError(f"tracked fixture missing: {RAW}")
    return json.loads(RAW.read_text(encoding="utf-8"))


def _build(espn_odds=None):
    # teams=[] on purpose: build_fixture falls back through `by_id.get(tid, {})` for every field it
    # takes from the directory, so the odds join is exercised without a 68KB team file.
    return build_fixture(_raw(), ROOT, season=2026, anchor_date="2026-10-01",
                         teams=[], espn_odds=espn_odds)


class TwoMapsForTwoEndpoints(unittest.TestCase):
    def test_the_scoreboard_map_is_the_teams_map_minus_utah(self):
        self.assertEqual(NHL_TO_ESPN_SCOREBOARD, {"LAK": "LA", "NJD": "NJ", "TBL": "TB", "SJS": "SJ"})
        # They are deliberately different, and Utah is the ONLY difference. If someone "tidies" the
        # two into one map, this fails rather than Utah silently losing its odds.
        only_in_teams = {k: v for k, v in NHL_TO_ESPN.items() if k not in NHL_TO_ESPN_SCOREBOARD}
        self.assertEqual(only_in_teams, {"UTA": "UTAH"},
                         "Utah is the one club whose ESPN spelling depends on which endpoint you ask")
        for k, v in NHL_TO_ESPN_SCOREBOARD.items():
            self.assertEqual(NHL_TO_ESPN[k], v, f"{k} must agree between the two maps")

    def test_utah_is_never_translated_for_the_scoreboard(self):
        # The whole bug in one assertion.
        self.assertEqual(espn_abbrev("UTA"), "UTA")
        self.assertNotEqual(espn_abbrev("UTA"), "UTAH")

    def test_the_four_that_do_diverge_translate_and_the_rest_are_identity(self):
        self.assertEqual(espn_abbrev("LAK"), "LA")
        self.assertEqual(espn_abbrev("NJD"), "NJ")
        self.assertEqual(espn_abbrev("TBL"), "TB")
        self.assertEqual(espn_abbrev("SJS"), "SJ")
        for ab in ("CBJ", "NYR", "BOS", "TOR", "VGK", "UTA"):
            self.assertEqual(espn_abbrev(ab), ab, f"{ab} needs no translation")
        self.assertIsNone(espn_abbrev(None))


class TheJoin(unittest.TestCase):
    def test_no_odds_map_leaves_every_game_exactly_as_it_was(self):
        # An offline run and every --from-file rebuild take this path. It must not change.
        fixture, _ = _build(espn_odds=None)
        self.assertTrue(fixture["games"], "the recorded window has games")
        self.assertTrue(all(g["odds"] is None for g in fixture["games"]))

    def test_a_priced_event_reaches_the_game_it_belongs_to(self):
        raw = _raw()
        first = raw["gameWeek"][0]["games"][0]
        key = (et_date(first["startTimeUTC"]),
               espn_abbrev(first["awayTeam"]["abbrev"]),
               espn_abbrev(first["homeTeam"]["abbrev"]))
        line = {"provider": "DraftKings", "spread": -1.5, "overUnder": 5.5,
                "moneylineHome": "-142", "moneylineAway": "+120", "fetchedAt": "2026-09-07T00:00:00-04:00"}
        fixture, _ = _build(espn_odds={key: line})
        gid = f"nhl-{first['id']}"
        got = next(g for g in fixture["games"] if g["id"] == gid)
        self.assertEqual(got["odds"], line)
        # and nothing else was given odds by accident
        self.assertEqual(len([g for g in fixture["games"] if g["odds"]]), 1)

    def test_the_contract_load_py_consumes_is_what_lands_on_the_game(self):
        # pipeline/load.py:258 guards on od["spread"] and reads provider / overUnder /
        # moneylineHome / moneylineAway / fetchedAt. A block missing those writes no row.
        raw = _raw()
        first = raw["gameWeek"][0]["games"][0]
        key = (et_date(first["startTimeUTC"]), espn_abbrev(first["awayTeam"]["abbrev"]),
               espn_abbrev(first["homeTeam"]["abbrev"]))
        line = {"provider": "DraftKings", "spread": -1.5, "overUnder": 5.5,
                "moneylineHome": "-142", "moneylineAway": "+120", "fetchedAt": "2026-09-07T00:00:00-04:00"}
        fixture, _ = _build(espn_odds={key: line})
        odds = next(g["odds"] for g in fixture["games"] if g["odds"])
        for field in ("provider", "spread", "overUnder", "moneylineHome", "moneylineAway", "fetchedAt"):
            self.assertIn(field, odds, f"load.py reads {field}")

    def test_an_event_with_no_line_yet_is_ORDINARY_and_a_missing_event_is_the_ALARM(self):
        # This is the distinction that makes the guard a guard. A map of only-priced events cannot
        # tell "the book is slow" from "the join broke" - measured on the recorded window, 25 of 47
        # games had an ESPN event and no line, which is the majority and entirely normal.
        raw = _raw()
        games = [g for day in raw["gameWeek"] for g in day["games"]]
        keys = [(et_date(g["startTimeUTC"]), espn_abbrev(g["awayTeam"]["abbrev"]),
                 espn_abbrev(g["homeTeam"]["abbrev"])) for g in games]

        # every event present, none priced -> no alarm
        _, notes = _build(espn_odds={k: None for k in keys})
        self.assertEqual([n for n in notes if "NO ESPN EVENT" in n], [])

        # the same window with the abbreviations NOT translated -> the four mapped clubs stop
        # matching, and the adapter says so instead of shrugging
        untranslated = {(d, a, h): None for (d, a, h) in
                        [(et_date(g["startTimeUTC"]), g["awayTeam"]["abbrev"], g["homeTeam"]["abbrev"])
                         for g in games]}
        _, notes2 = _build(espn_odds=untranslated)
        alarms = [n for n in notes2 if "NO ESPN EVENT" in n]
        self.assertTrue(alarms, "a broken abbreviation join must raise the alarm, not go quiet")
        # and it is exactly the mapped clubs that fail
        for n in alarms:
            self.assertTrue(any(v in n for v in NHL_TO_ESPN_SCOREBOARD.values()),
                            f"unexpected alarm: {n}")


if __name__ == "__main__":
    unittest.main()
