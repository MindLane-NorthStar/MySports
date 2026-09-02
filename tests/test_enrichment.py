#!/usr/bin/env python3
"""CFB ranks, records and rivalry flags (prompt 15 stage 4, pipeline/enrich_cfb.py).

    python -m unittest tests.test_enrichment -v     # from the repo root; stdlib only

Four things are load-bearing here:

1. The §6 ranking rule is the PROBE's (Playoff Committee if present, else AP, never Coaches); this
   module only looks a team up in whichever poll the probe chose - by id first, school name second.
2. The record display form matches the renderer's `record_label`: suppressed at 0-0, and the
   conference form appears ONLY when both clubs share a conference.
3. Ranks are per-POLL, and that is what makes the two halves of "null-safe" compatible: a file WITH a
   poll rewrites the whole slate (a team that dropped out goes back to null); a file WITHOUT one does
   not touch ranks at all, so a failed fetch can never erase a good poll.
4. A rivalry matches in EITHER orientation, and only for cfb.

No database and no network: the DB object runs in --emit-sql mode, which never opens a connection.
"""
from __future__ import annotations

import io
import sys
import unittest
from contextlib import redirect_stdout
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from pipeline import enrich_cfb  # noqa: E402


def rec(display, conf_display=None, team=None):
    r = {"team": team, "display": display}
    if conf_display is not None:
        r["conf"] = {"display": conf_display}
    return r


# --------------------------------------------------------------------------- ranking lookup
class RankLookup(unittest.TestCase):
    RANKING = {"source": "AP Top 25", "byTeamId": {"194": 1, "2483": 2}, "bySchool": {"Georgia": 3}}

    def test_id_first(self):
        self.assertEqual(enrich_cfb.rank_of(self.RANKING, "194", "Ohio State"), 1)
        self.assertEqual(enrich_cfb.rank_of(self.RANKING, 2483, "Oregon"), 2)

    def test_school_name_is_the_fallback(self):
        self.assertEqual(enrich_cfb.rank_of(self.RANKING, "61", "Georgia"), 3)

    def test_unranked_is_none_never_zero(self):
        self.assertIsNone(enrich_cfb.rank_of(self.RANKING, "999", "Akron"))
        self.assertIsNone(enrich_cfb.rank_of(self.RANKING, "999", None))

    def test_a_junk_rank_is_none_rather_than_a_crash(self):
        self.assertIsNone(enrich_cfb.rank_of({"byTeamId": {"1": "NR"}}, "1", None))
        self.assertIsNone(enrich_cfb.rank_of({}, "1", None))


# --------------------------------------------------------------------------- record display form
class RecordDisplay(unittest.TestCase):
    def test_plain_record(self):
        self.assertEqual(enrich_cfb.record_display(rec("1-0"), "ACC", "SEC"), "1-0")

    def test_conference_form_only_when_both_share_a_conference(self):
        self.assertEqual(enrich_cfb.record_display(rec("1-0", "0-0"), "ACC", "ACC"), "1-0, 0-0 ACC")
        self.assertEqual(enrich_cfb.record_display(rec("1-0", "0-0"), "ACC", "SEC"), "1-0")

    def test_conference_abbreviation_matches_the_renderer(self):
        self.assertEqual(enrich_cfb.record_display(rec("2-0", "1-0"), "Big Ten", "Big Ten"), "2-0, 1-0 BIG TEN")
        self.assertEqual(enrich_cfb.record_display(rec("2-0", "1-0"), "Mountain West", "Mountain West"),
                         "2-0, 1-0 MW")

    def test_independents_take_no_conference_run(self):
        # CONF_ABBR maps FBS Independents to None - there is no conference record to show
        self.assertEqual(enrich_cfb.record_display(rec("1-0", "0-0"), "FBS Independents", "FBS Independents"),
                         "1-0")

    def test_zero_and_zero_is_suppressed(self):
        # contract v1.1: a record run before a team's first game says nothing
        self.assertIsNone(enrich_cfb.record_display(rec("0-0"), "ACC", "ACC"))
        self.assertIsNone(enrich_cfb.record_display(rec("0-0", "0-0"), "ACC", "ACC"))

    def test_absent_record_is_none(self):
        self.assertIsNone(enrich_cfb.record_display(None, "ACC", "ACC"))
        self.assertIsNone(enrich_cfb.record_display({}, "ACC", "ACC"))

    def test_a_tie_survives_into_the_display(self):
        self.assertEqual(enrich_cfb.record_display(rec("1-0-1"), None, None), "1-0-1")


# --------------------------------------------------------------------------- null-safety, per poll
def emit(data, rows):
    """Run apply_week against a fake DB in emit-SQL mode and return the statements."""
    from pipeline.db import DB

    class FakeDB(DB):
        def __init__(self, fetch_rows):
            super().__init__(str(Path(ROOT) / "artifacts" / "sql" / "_test_enrich.sql"))
            self._rows = fetch_rows

        def fetch(self, sql, params=None):
            return self._rows

    db = FakeDB(rows)
    with redirect_stdout(io.StringIO()):
        counts = enrich_cfb.apply_week(db, 2026, 1, data)
    return counts, db.emitted


GAME_ROWS = [("401", "194", "2483", "Big Ten", "Big Ten")]


class RankNullSafety(unittest.TestCase):
    def test_a_poll_rewrites_the_slate_including_back_to_null(self):
        # 2483 has dropped out of this week's poll - its rank must go back to null, not stay frozen
        data = {"ranking": {"source": "AP Top 25", "byTeamId": {"194": 1}}, "records": {}}
        counts, stmts = emit(data, GAME_ROWS)
        rank_stmts = [s for s in stmts if "home_rank" in s]
        self.assertEqual(len(rank_stmts), 1)
        self.assertIn("home_rank = 1", rank_stmts[0])
        self.assertIn("away_rank = null", rank_stmts[0])
        self.assertEqual(counts["ranked_sides"], 1)

    def test_no_poll_means_ranks_are_not_touched_at_all(self):
        # week 8 today: source null, nothing ranked. A missing poll must never erase a good one.
        data = {"ranking": {"source": None, "byTeamId": {}}, "records": {}}
        counts, stmts = emit(data, GAME_ROWS)
        self.assertEqual([s for s in stmts if "home_rank" in s], [])
        self.assertEqual(counts["ranks_skipped_no_poll"], 1)

    def test_records_coalesce_so_a_missing_team_keeps_what_it_had(self):
        data = {"ranking": {}, "records": {"194": rec("2-0", "1-0", "Ohio State")}}
        counts, stmts = emit(data, GAME_ROWS)
        rs = [s for s in stmts if "home_record" in s]
        self.assertEqual(len(rs), 1)
        self.assertIn("coalesce('2-0, 1-0 BIG TEN', home_record)", rs[0])
        self.assertIn("coalesce(null, away_record)", rs[0])   # 2483 absent -> keeps its stored value
        self.assertEqual(counts["record_sides"], 1)

    def test_a_slate_with_neither_emits_no_update_at_all(self):
        counts, stmts = emit({"ranking": {}, "records": {}}, GAME_ROWS)
        self.assertEqual([s for s in stmts if "home_record" in s or "home_rank" in s], [])
        self.assertEqual(counts["games"], 1)


# --------------------------------------------------------------------------- rivalry matching
class RivalryMatch(unittest.TestCase):
    def test_the_sql_matches_either_orientation_and_only_cfb(self):
        sql = enrich_cfb.RIVALRY_SQL
        self.assertIn("g.home_team_id = r.team_a_id and g.away_team_id = r.team_b_id", sql)
        self.assertIn("g.home_team_id = r.team_b_id and g.away_team_id = r.team_a_id", sql)
        self.assertIn("g.sport = 'cfb'", sql)
        self.assertIn("r.active", sql)

    def test_it_sets_the_fk_not_just_the_flag(self):
        # tier is reachable through rivalry_id, which is why stage 4 needed no new column for it
        self.assertIn("rivalry_id = r.id", enrich_cfb.RIVALRY_SQL)
        self.assertIn("is_rivalry = true", enrich_cfb.RIVALRY_SQL)

    def test_it_does_not_rewrite_rows_that_are_already_correct(self):
        self.assertIn("is distinct from", enrich_cfb.RIVALRY_SQL)


if __name__ == "__main__":
    unittest.main()
