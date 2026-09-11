#!/usr/bin/env python3
"""CFB records into team_records, and the week the nightly enriches (prompt 90, pipeline/enrich_cfb.py).

    python -m pytest tests/test_enrich_cfb_records.py -v     # from the repo root; no database, no network

Joe's rulings, 2026-09-11 (register §40): CFB records go into `team_records`, written by
enrich_cfb.py; the nightly enriches the week CONTAINING TODAY, not max(week); no backfill.

Everything is pinned to FIXED DATES, never to today - a resolution test that reads the clock passes
in September and rots in December, which is exactly the month the defect lived in. The week ranges
below are the measured 2026 shape: week 1 spans Labor Day, week 2 is 2026-09-10 to 09-12, and the
newest loaded week (15) is a single December Saturday. The module is never run as a CLI here: main()
is driven against a fake DB that cannot open a connection.
"""
from __future__ import annotations

import io
import json
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from datetime import date
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from pipeline import enrich_cfb  # noqa: E402
from pipeline.db import DB  # noqa: E402

D = date.fromisoformat

RANGES = [
    (1, D("2026-08-29"), D("2026-09-07")),
    (2, D("2026-09-10"), D("2026-09-12")),
    (3, D("2026-09-17"), D("2026-09-19")),
    (15, D("2026-12-12"), D("2026-12-12")),
]


# --------------------------------------------------------------------------- the record parse
class RecordParse(unittest.TestCase):
    def test_plain_w_l_splits_into_wins_and_losses(self):
        self.assertEqual(enrich_cfb.parse_record("3-1"), (3, 1, 0))

    def test_ties_only_from_a_third_component(self):
        self.assertEqual(enrich_cfb.parse_record("3-1-1"), (3, 1, 1))
        self.assertEqual(enrich_cfb.parse_record("0-1"), (0, 1, 0))

    def test_all_zero_is_not_a_record(self):
        self.assertIsNone(enrich_cfb.parse_record("0-0"))
        self.assertIsNone(enrich_cfb.parse_record("0-0-0"))

    def test_missing_or_unparseable_is_none(self):
        for v in (None, "", "TBD", "3", {}, 3):
            self.assertIsNone(enrich_cfb.parse_record(v), v)

    def test_the_desktop_display_form_is_refused_not_misread(self):
        # record_display()'s same-conference form. The write must never be fed it; if it were, it has
        # to come back as nothing rather than as a wrong record.
        self.assertIsNone(enrich_cfb.parse_record("4-1, 2-0 BIG 12"))


# --------------------------------------------------------------------------- rows from the block
AS_OF = D("2026-09-11")

# The shapes on disk: week-1-style entries carry `conf`; the week-8 file's do not.
RECORDS = {
    "194": {"team": "Ohio State", "wins": 2, "losses": 0, "ties": 0, "display": "2-0",
            "conf": {"wins": 0, "losses": 0, "ties": 0, "display": "0-0"}},
    "13": {"team": "Cal Poly", "wins": 1, "losses": 0, "ties": 0, "display": "1-0",
           "conf": {"wins": 1, "losses": 0, "ties": 0, "display": "1-0"}},
    "2483": {"team": "Oregon", "wins": 3, "losses": 1, "ties": 0, "display": "3-1"},
    "61": {"team": "Georgia", "wins": 0, "losses": 0, "ties": 0, "display": "0-0"},
    "Nowhere Tech": {"team": "Nowhere Tech", "display": "1-1"},
}
KNOWN = ["194", "13", "2483", "61"]


class TeamRecordRows(unittest.TestCase):
    def setUp(self):
        self.rows, self.counts = enrich_cfb.team_record_rows(RECORDS, 2026, AS_OF, KNOWN)
        self.by_id = {r["team_id"]: r for r in self.rows}

    def test_one_row_per_team_with_a_real_record(self):
        self.assertEqual(sorted(self.by_id), ["13", "194", "2483"])
        self.assertEqual(self.counts["team_records"], 3)

    def test_three_one_is_wins_three_losses_one(self):
        r = self.by_id["2483"]
        self.assertEqual((r["wins"], r["losses"], r["ties"]), (3, 1, 0))

    def test_all_zero_writes_no_row(self):
        self.assertNotIn("61", self.by_id)
        self.assertEqual(self.counts["team_records_zero_skipped"], 1)

    def test_an_id_not_in_teams_is_not_written(self):
        # team_records.team_id is a foreign key; one unknown id would roll back the whole step.
        self.assertNotIn("Nowhere Tech", self.by_id)
        self.assertEqual(self.counts["team_records_unknown_team"], 1)

    def test_season_as_of_and_source(self):
        for r in self.rows:
            self.assertEqual((r["season"], r["as_of"], r["source"]), (2026, AS_OF, "cfbd.enrich_cfb"))

    def test_conference_record_when_the_block_carries_one(self):
        self.assertEqual((self.by_id["13"]["conf_wins"], self.by_id["13"]["conf_losses"]), (1, 0))
        # a 0-0 conference record beside a real overall one is a fact, not an absence
        self.assertEqual((self.by_id["194"]["conf_wins"], self.by_id["194"]["conf_losses"]), (0, 0))

    def test_no_conference_block_leaves_conference_null(self):
        self.assertIsNone(self.by_id["2483"]["conf_wins"])
        self.assertIsNone(self.by_id["2483"]["conf_losses"])


# --------------------------------------------------------------------------- the week the nightly picks
class CurrentWeek(unittest.TestCase):
    def week(self, today, ranges=RANGES):
        r = enrich_cfb.current_week(ranges, D(today))
        return None if r is None else (r[0], r[3])

    def test_the_week_whose_range_contains_the_date(self):
        # 2026-09-11 is the measured case: week 2, NOT week 15 (max(week)).
        self.assertEqual(self.week("2026-09-11"), (2, "contains today"))

    def test_both_ends_of_a_range_are_inside_it(self):
        self.assertEqual(self.week("2026-09-10")[0], 2)
        self.assertEqual(self.week("2026-09-12")[0], 2)
        self.assertEqual(self.week("2026-09-07")[0], 1)    # Labor Day belongs to week 1

    def test_between_weeks_it_is_the_next_to_start(self):
        self.assertEqual(self.week("2026-09-08"), (2, "next to start after today"))
        self.assertEqual(self.week("2026-09-13"), (3, "next to start after today"))
        self.assertEqual(self.week("2026-08-01"), (1, "next to start after today"))

    def test_after_the_last_week_it_is_the_highest_week_already_ended(self):
        self.assertEqual(self.week("2026-12-20"), (15, "highest week already ended"))

    def test_the_answer_carries_its_range(self):
        self.assertEqual(enrich_cfb.current_week(RANGES, D("2026-09-11")),
                         (2, D("2026-09-10"), D("2026-09-12"), "contains today"))

    def test_input_order_does_not_matter(self):
        self.assertEqual(self.week("2026-09-11", list(reversed(RANGES)))[0], 2)
        self.assertEqual(self.week("2026-09-13", list(reversed(RANGES)))[0], 3)

    def test_nothing_loaded_resolves_to_nothing(self):
        self.assertIsNone(self.week("2026-09-11", []))


# --------------------------------------------------------------------------- main(), end to end, no database
class FakeDB(DB):
    """Emit mode (never connects), answering each read by what the SQL asks for."""

    commits = 0

    def __init__(self, emit_path=None):
        super().__init__(str(Path(tempfile.gettempdir()) / "_test_enrich_cfb_records.sql"))

    def fetch(self, sql, params=None):
        if "max(viewing_day)" in sql:
            return list(RANGES)
        if "from teams" in sql:
            return [(k,) for k in KNOWN]
        if "max(week)" in sql:
            return [(15,)]
        if "g.week = %s" in sql:
            return [("401", "194", "2483", "Big Ten", "Big Ten")]
        if "count(*)" in sql:
            return [(0,)]
        return []

    def commit(self):
        FakeDB.commits += 1
        self.at_commit = len(self.emitted)


class MainWiring(unittest.TestCase):
    def run_main(self, argv, today="2026-09-11"):
        made = []

        def factory(emit_path=None):
            db = FakeDB(emit_path)
            made.append(db)
            return db

        with tempfile.TemporaryDirectory() as tmp:
            asked = []

            def path(year, week):
                asked.append(week)
                p = Path(tmp) / f"cfbd_{year}_week{week}_enrichment.json"
                p.write_text(json.dumps({"generatedAt": "2026-09-11T11:00:00Z", "ranking": {},
                                         "records": RECORDS}), encoding="utf-8", newline="\n")
                return p

            out = io.StringIO()
            with mock.patch.object(enrich_cfb, "DB", factory), \
                 mock.patch.object(enrich_cfb, "today_et", lambda: D(today)), \
                 mock.patch.object(enrich_cfb, "enrichment_path", path), \
                 redirect_stdout(out):
                FakeDB.commits = 0
                code = enrich_cfb.main(argv)
        return code, out.getvalue(), asked, made[0]

    def test_current_week_enriches_the_week_containing_today_and_says_so(self):
        code, out, asked, _ = self.run_main(["--current-week"])
        self.assertEqual(code, 0)
        self.assertEqual(asked, [2])
        self.assertIn("current week: 2 (2026-09-10 to 2026-09-12) - contains today, today 2026-09-11 ET", out)

    def test_team_records_and_game_columns_commit_together_once(self):
        code, out, _, db = self.run_main(["--current-week"])
        self.assertEqual(code, 0)
        tr = [s for s in db.emitted if s.startswith("insert into team_records")]
        self.assertEqual(len(tr), 3)
        self.assertTrue(any("home_record" in s for s in db.emitted))
        self.assertEqual(FakeDB.commits, 1)
        self.assertEqual(db.at_commit, len(db.emitted))     # nothing written after the one commit
        self.assertIn("on conflict (team_id, season, as_of) do update set wins = excluded.wins", tr[0])
        self.assertIn("'2026-09-11'", tr[0])
        self.assertIn("team_records 3 row(s) as_of 2026-09-11 - 1 all-zero skipped, 1 unknown team(s)", out)

    def test_team_records_is_counted_apart_from_record_sides(self):
        _, out, _, _ = self.run_main(["--current-week"])
        total = [ln for ln in out.splitlines() if ln.startswith("TOTAL:")][0]
        self.assertIn("record_sides 2", total)
        self.assertIn("team_records 3", total)

    def test_latest_week_keeps_its_meaning(self):
        # not repurposed: still the newest LOADED week, for manual runs
        _, _, asked, _ = self.run_main(["--latest-week"])
        self.assertEqual(asked, [15])

    def test_december_resolves_to_the_last_week_not_nothing(self):
        code, out, asked, _ = self.run_main(["--current-week"], today="2026-12-20")
        self.assertEqual((code, asked), (0, [15]))
        self.assertIn("highest week already ended", out)


# --------------------------------------------------------------------------- the nightly runs it
class NightlyStep(unittest.TestCase):
    def test_schedule_refresh_enriches_the_current_week(self):
        text = (ROOT / ".github" / "workflows" / "schedule_refresh.yml").read_text(encoding="utf-8")
        lines = [ln.strip() for ln in text.splitlines() if "pipeline.enrich_cfb" in ln]
        self.assertEqual(lines, ["run: python -m pipeline.enrich_cfb --current-week --fetch --workflow schedule_refresh"])


if __name__ == "__main__":
    unittest.main()
