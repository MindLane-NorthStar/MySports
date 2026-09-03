#!/usr/bin/env python3
"""The NBA game-id divergence guard (2026-09-03).

    python -m unittest tests.test_nba_game_ids -v    # from the repo root; stdlib only

adapters/nba.py can build a fixture from EITHER of two sources, and they mint DIFFERENT game ids:

    build_from_espn    -> nba-{espnEventId}     e.g. nba-401909861   (9-digit ESPN id)
    build_from_league  -> nba-{nbaGameId}       e.g. nba-0022600001  (10-digit league id)

THE DATABASE HOLDS THE ESPN FORM, and web/lib/livescores.js joins its overlay on exactly that. So if
NBA is ever loaded through the league-file path, every NBA game silently stops matching its live
score - no error, no warning, no failed row. Just cards that never go live, on a page whose whole
purpose is showing what is on right now.

WHY THIS TEST DOES NOT ASSERT THE TWO AGREE: they cannot. The ESPN scoreboard payload carries no NBA
gameId, and the cdn.nba.com league file carries no ESPN id - verified against the recorded fixture and
the live table. Reconciling them needs a cross-reference that does not exist in this repo. So the
guard instead PINS the divergence and fails loudly, naming the consequence, if either constructor
moves. That is the honest version: the bug cannot be prevented by making the ids equal, only by
noticing when someone changes which source feeds the loader.
"""
from __future__ import annotations

import json
import re
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

FIXTURES = Path(__file__).resolve().parent / "fixtures"
NBA_SRC = (ROOT / "adapters" / "nba.py").read_text(encoding="utf-8")

CONSEQUENCE = (
    "NBA game ids diverge between adapters/nba.py's two sources. The database and "
    "web/lib/livescores.js both use the ESPN form nba-{espnEventId}; the cdn.nba.com league file "
    "mints nba-{nbaGameId}. Loading NBA from the league file makes every NBA overlay join fail "
    "SILENTLY - no error, just scores that never appear."
)


class TheTwoPathsMintDifferentIds(unittest.TestCase):
    def test_the_espn_path_builds_its_id_from_the_event_id(self):
        self.assertIn('"id": f"nba-{ev.get(\'id\')}"', NBA_SRC, CONSEQUENCE)

    def test_the_league_path_builds_its_id_from_gameId(self):
        self.assertIn('"id": f"nba-{g.get(\'gameId\')}"', NBA_SRC, CONSEQUENCE)

    def test_they_read_different_source_fields_and_so_cannot_agree(self):
        # If these ever became the same expression the divergence would be gone and this guard, and
        # the comments in nba.py, should be removed rather than left to rot.
        espn = "ev.get('id')"
        league = "g.get('gameId')"
        self.assertNotEqual(espn, league, CONSEQUENCE)
        self.assertIn(espn, NBA_SRC)
        self.assertIn(league, NBA_SRC)

    def test_both_id_sites_carry_a_comment_pointing_at_the_other(self):
        """A reader at one call site must be told the other exists, or this repeats."""
        self.assertGreaterEqual(
            NBA_SRC.count("GAME-ID DIVERGENCE"), 2,
            "both id sites in adapters/nba.py must carry the divergence note",
        )


class TheEspnFormIsWhatEverythingElseExpects(unittest.TestCase):
    ESPN_ID = re.compile(r"^\d{9}$")

    def test_the_recorded_espn_payload_yields_nine_digit_ids(self):
        raw = json.loads((FIXTURES / "nba_scoreboard_raw.json").read_text(encoding="utf-8"))
        events = raw.get("events") or []
        self.assertTrue(events, "the recorded NBA scoreboard has events")
        for ev in events:
            self.assertRegex(str(ev.get("id")), self.ESPN_ID, CONSEQUENCE)

    def test_the_espn_payload_carries_no_league_gameId_to_join_on(self):
        """The reason the two cannot be reconciled here rather than a matter of taste."""
        raw = json.loads((FIXTURES / "nba_scoreboard_raw.json").read_text(encoding="utf-8"))
        for ev in (raw.get("events") or []):
            self.assertNotIn("gameId", ev, "if ESPN ever adds gameId, the two paths COULD be reconciled")

    def test_a_league_file_id_would_not_match_the_espn_shape(self):
        # 0022600001 is the league's own form: ten digits, leading zeros. It is not an ESPN id, and
        # `nba-0022600001` would join to nothing in the games table.
        self.assertNotRegex("0022600001", self.ESPN_ID, CONSEQUENCE)


if __name__ == "__main__":
    unittest.main()
