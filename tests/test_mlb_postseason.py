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


if __name__ == "__main__":
    unittest.main()
