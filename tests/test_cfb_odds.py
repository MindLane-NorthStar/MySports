#!/usr/bin/env python3
"""CFB odds: the fetcher that was written and never wired in (prompt 57 stage 3).

    python -m unittest tests.test_cfb_odds -v    # from the repo root; stdlib only, no network

`adapters/cfbd.py` contained ZERO "odds" keys. `fetch_lines()` had existed since the adapter was
written and was called from nowhere in the repository - `git grep fetch_lines` returned its own
definition and nothing else. So every cfb game reached `pipeline/load.py` with no `odds` key,
`load.py:258`'s `if od and od.get("spread") is not None` was never true, no `game_odds` row was
written, `favourite()` in web/components/MatchupCard.js returned null, and `slotContent` rung 4 in
web/lib/format.js was never reached. That was the empty right slot on every CFB card.

THE PIN IS A RECORDED FETCH, AND IT IS COMMITTED. CFBD answers 401 unauthenticated and there was no
saved /lines sample anywhere, so one week was fetched live on 2026-09-07 with the repo's own key and
dumped by the adapter to artifacts/validation/. The mapping was written from THAT, not from an
assumed shape. The key itself is never read or printed here.

IT READS tests/fixtures/, NOT artifacts/. `artifacts/` is gitignored, and tests/test_scores.py
records what that cost last time: "Skipping was the old behaviour and it hid the problem: the
fixtures lived under gitignored artifacts/, so a clean checkout skipped these mappers and still
reported OK." The .gitignore's own comment says fixtures are "promoted to tests/ when needed"; this
is that promotion, and a missing file is an ERROR here, never a skip.

WHY build_fixture IS EXERCISED ON SYNTHETIC GAMES rather than the recorded /games week: that file is
460KB and gitignored too, and what these tests need to prove is that a line reaches the game whose id
it carries. Two hand-written games prove that exactly as well as 455 real ones without adding half a
megabyte to the tree. The one thing the real pair DID prove - that /games and /lines mint the same
id, 171 of 171 on the recorded week - was a one-time verification, recorded in the adapter's comment
and in prompt 57's report rather than re-checked on every run.

OBSERVED SHAPE:
    entry  : id, season, seasonType, week, startDate, homeTeamId, homeTeam, homeConference,
             homeClassification, homeScore, awayTeamId, awayTeam, awayConference,
             awayClassification, awayScore, lines[]
    lines[]: provider, spread, formattedSpread, spreadOpen, overUnder, overUnderOpen,
             homeMoneyline, awayMoneyline
"""
from __future__ import annotations

import json
import unittest
from pathlib import Path

from adapters.cfbd import LINE_PROVIDERS, _odds, build_fixture

ROOT = Path(__file__).resolve().parents[1]
FIX = ROOT / "tests" / "fixtures"
LINES_FIXTURE = "cfbd_2026_week1_lines.json"


def _load(name: str):
    p = FIX / name
    if not p.exists():
        raise FileNotFoundError(f"tracked fixture missing: {p} (it belongs under tests/fixtures/)")
    return json.loads(p.read_text(encoding="utf-8"))


def _synthetic():
    """(games, media, lines, priced_id) - two FBS games, one of which the recorded week prices."""
    lines = _load(LINES_FIXTURE)
    priced = next(e for e in lines
                  if e.get("lines") and any(b.get("spread") is not None for b in e["lines"]))
    games = [
        {"id": priced["id"], "season": 2026, "week": 1, "startDate": priced.get("startDate"),
         "homeId": priced.get("homeTeamId"), "homeTeam": priced.get("homeTeam"),
         "homeConference": priced.get("homeConference"), "homeClassification": "fbs",
         "awayId": priced.get("awayTeamId"), "awayTeam": priced.get("awayTeam"),
         "awayConference": priced.get("awayConference"), "awayClassification": "fbs",
         "completed": False, "neutralSite": False, "venue": "Somewhere"},
        {"id": -1, "season": 2026, "week": 1, "startDate": "2026-08-30T20:00:00.000Z",
         "homeId": 1, "homeTeam": "Nowhere State", "homeConference": "X", "homeClassification": "fbs",
         "awayId": 2, "awayTeam": "Elsewhere", "awayConference": "Y", "awayClassification": "fcs",
         "completed": False, "neutralSite": False, "venue": "Elsewhere"},
    ]
    return games, [], lines, priced["id"]


class TheRecordedSample(unittest.TestCase):
    def test_the_sample_exists_and_has_the_shape_the_mapping_was_written_against(self):
        lines = _load(LINES_FIXTURE)
        self.assertTrue(lines, "the recorded /lines week is not empty")
        entry = next(e for e in lines if e.get("lines"))
        for k in ("id", "season", "week", "startDate", "homeTeam", "awayTeam", "lines"):
            self.assertIn(k, entry)
        for k in ("provider", "spread", "formattedSpread", "overUnder",
                  "homeMoneyline", "awayMoneyline"):
            self.assertIn(k, entry["lines"][0])

    def test_every_entry_carries_the_id_the_join_uses(self):
        lines = _load(LINES_FIXTURE)
        self.assertTrue(all(isinstance(e.get("id"), int) for e in lines))
        self.assertEqual(len({e["id"] for e in lines}), len(lines), "one entry per game id")


class TheProviderChoice(unittest.TestCase):
    def test_it_is_named_and_deterministic_not_iteration_order(self):
        self.assertEqual(LINE_PROVIDERS[0], "DraftKings")
        entry = {"lines": [{"provider": "Bovada", "spread": 3.0, "overUnder": 50.0,
                            "homeMoneyline": -150, "awayMoneyline": 130},
                           {"provider": "DraftKings", "spread": 2.5, "overUnder": 51.0,
                            "homeMoneyline": -140, "awayMoneyline": 120}]}
        self.assertEqual(_odds(entry)["provider"], "DraftKings")
        self.assertEqual(_odds(entry)["spread"], 2.5)
        entry["lines"].reverse()
        self.assertEqual(_odds(entry)["provider"], "DraftKings", "payload order must not decide")

    def test_a_book_with_no_spread_loses_to_one_that_has_a_line(self):
        # CFBD returns the same book under two spellings and the spaced one is always empty: on the
        # recorded week "Draft Kings" appears 170 times, every one with a null spread and null
        # moneylines, and on 12 entries it is the ONLY provider. Preferring a named-but-empty book
        # would throw away a real Bovada line sitting beside it, and load.py:258 would write no row.
        entry = {"lines": [{"provider": "Draft Kings", "spread": None, "overUnder": None,
                            "homeMoneyline": None, "awayMoneyline": None},
                           {"provider": "Bovada", "spread": -3.5, "overUnder": 47.0,
                            "homeMoneyline": -170, "awayMoneyline": 145}]}
        self.assertEqual(_odds(entry)["provider"], "Bovada")
        self.assertEqual(_odds(entry)["spread"], -3.5)

    def test_when_no_book_has_a_spread_the_named_order_still_decides(self):
        entry = {"lines": [{"provider": "Bovada", "spread": None, "overUnder": 44.0,
                            "homeMoneyline": None, "awayMoneyline": None},
                           {"provider": "DraftKings", "spread": None, "overUnder": 45.0,
                            "homeMoneyline": None, "awayMoneyline": None}]}
        self.assertEqual(_odds(entry)["provider"], "DraftKings")

    def test_an_unknown_book_is_used_rather_than_dropped(self):
        entry = {"lines": [{"provider": "SomeNewBook", "spread": -1.5, "overUnder": 44.0,
                            "homeMoneyline": -120, "awayMoneyline": 100}]}
        self.assertEqual(_odds(entry)["provider"], "SomeNewBook")

    def test_no_lines_is_none_not_an_empty_block(self):
        self.assertIsNone(_odds({"lines": []}))
        self.assertIsNone(_odds({}))


class TheContractLoadPyConsumes(unittest.TestCase):
    def test_every_field_load_py_reads_is_present(self):
        entry = {"lines": [{"provider": "DraftKings", "spread": -7.5, "formattedSpread": "TCU -7.5",
                            "overUnder": 46.5, "homeMoneyline": -310, "awayMoneyline": 250}]}
        o = _odds(entry)
        for field in ("provider", "spread", "overUnder", "moneylineHome", "moneylineAway", "fetchedAt"):
            self.assertIn(field, o, f"pipeline/load.py:259-261 reads {field}")
        self.assertEqual(o["moneylineHome"], -310)
        self.assertEqual(o["moneylineAway"], 250)
        self.assertEqual(o["overUnder"], 46.5)

    def test_the_opening_numbers_are_deliberately_not_carried(self):
        # The card shows the CURRENT line. Prompt 57 stage 1 exists because it was accidentally
        # showing an old one; carrying spreadOpen would invite that mistake back on purpose.
        entry = {"lines": [{"provider": "DraftKings", "spread": 22.5, "spreadOpen": 18.5,
                            "overUnder": 57.5, "overUnderOpen": 60.5,
                            "homeMoneyline": 1100, "awayMoneyline": -2100}]}
        o = _odds(entry)
        self.assertNotIn("spreadOpen", o)
        self.assertNotIn("overUnderOpen", o)
        self.assertEqual(o["spread"], 22.5)


class TheSignConvention(unittest.TestCase):
    """`favourite()` reads `sp < 0 -> home, sp > 0 -> away`. CFBD already uses that convention, and
    this asserts it against the recorded week rather than trusting one example."""

    def test_the_sign_agrees_with_formattedSpread_on_every_recorded_line(self):
        lines = _load(LINES_FIXTURE)
        checked = 0
        for e in lines:
            for l in e.get("lines") or []:
                sp, fs = l.get("spread"), l.get("formattedSpread")
                if sp is None or not fs or sp == 0:
                    continue
                if fs.startswith(str(e.get("homeTeam"))):
                    named = "home"
                elif fs.startswith(str(e.get("awayTeam"))):
                    named = "away"
                else:
                    continue
                self.assertEqual("home" if sp < 0 else "away", named,
                                 f"sign disagrees with formattedSpread on {e.get('id')}: {fs} / {sp}")
                checked += 1
        self.assertGreater(checked, 50, "the recorded week must actually exercise this")

    def test_the_chosen_book_never_disagrees_with_its_own_moneylines(self):
        # ON THE CHOSEN BOOK, not on every book in the payload, and the difference is a finding
        # rather than a convenience: two Bovada lines in the recorded week contradict themselves -
        # 401864432, a near-pick'em where the spread favours Nevada and the moneyline favours Western
        # Kentucky, and 401856780, carrying an awayMoneyline of -100000, which is a placeholder and
        # not a price. Neither reaches a card, because DraftKings is preferred and never disagrees.
        lines = _load(LINES_FIXTURE)
        checked = 0
        for e in lines:
            o = _odds(e)
            if not o:
                continue
            sp, hm, am = o["spread"], o["moneylineHome"], o["moneylineAway"]
            if sp is None or hm is None or am is None or sp == 0 or hm == am:
                continue
            self.assertEqual("home" if sp < 0 else "away", "home" if hm < am else "away",
                             f"the chosen book disagrees with itself on {e.get('id')}: {o}")
            checked += 1
        self.assertGreater(checked, 50, "the recorded week must actually exercise this")

    def test_the_two_self_contradicting_bovada_lines_are_recorded_and_not_chosen(self):
        lines = _load(LINES_FIXTURE)
        for gid in (401864432, 401856780):
            e = next(x for x in lines if x.get("id") == gid)
            self.assertNotEqual(_odds(e)["provider"], "Bovada",
                                f"{gid} carries a self-contradicting Bovada line; it must not win")


class TheFixture(unittest.TestCase):
    def test_without_lines_nothing_changes(self):
        games, media, _, _ = _synthetic()
        fx = build_fixture(games, media, ROOT, year=2026, week=1, season_type="regular")
        self.assertTrue(fx["games"])
        self.assertTrue(all(g["odds"] is None for g in fx["games"]))
        self.assertEqual(fx["validation"]["source"], "cfbd.games+media")

    def test_with_lines_the_block_reaches_the_game_carrying_that_id_and_no_other(self):
        games, media, lines, priced_id = _synthetic()
        fx = build_fixture(games, media, ROOT, year=2026, week=1, season_type="regular", lines=lines)
        by_id = {g["id"]: g for g in fx["games"]}
        self.assertIsNotNone(by_id[priced_id]["odds"], "the game whose id has a line gets it")
        self.assertIsNone(by_id[-1]["odds"], "a game with no line entry stays None")
        self.assertEqual(fx["validation"]["source"], "cfbd.games+media+lines")
        self.assertEqual(fx["validation"]["oddsProviderPreference"], list(LINE_PROVIDERS))
        # load.py writes no row without a spread, so the chosen book having one is the thing to pin
        self.assertIsNotNone(by_id[priced_id]["odds"]["spread"])


if __name__ == "__main__":
    unittest.main()
