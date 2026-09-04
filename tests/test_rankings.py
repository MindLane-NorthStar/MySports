"""pipeline/rankings.py - the poll mapping and the week window. parse() is pure, so these need no network."""
from __future__ import annotations

import unittest
from datetime import date

from pipeline.rankings import POLL_ENUM, parse, weeks_to_date


def entry(week: int, polls: list[tuple[str, list[tuple[int, int]]]], season: int = 2026) -> dict:
    return {"season": season, "seasonType": "regular", "week": week,
            "polls": [{"poll": name, "ranks": [{"rank": rk, "teamId": tid, "points": 100 - rk}
                                               for rk, tid in ranks]} for name, ranks in polls]}


class PollMapping(unittest.TestCase):
    def test_the_three_polls_the_enum_carries_are_mapped(self):
        self.assertEqual(POLL_ENUM["AP Top 25"], "AP")
        self.assertEqual(POLL_ENUM["Coaches Poll"], "Coaches")
        self.assertEqual(POLL_ENUM["Playoff Committee Rankings"], "CFP")

    def test_an_unmapped_poll_is_reported_and_skipped_never_coerced(self):
        raw = [entry(1, [("AP Top 25", [(1, 194)]), ("FCS Coaches Poll", [(1, 999), (2, 998)])])]
        rows, notes = parse(raw)
        self.assertEqual([r["poll_type"] for r in rows], ["AP"])
        self.assertTrue(any("FCS Coaches Poll" in n and "2 rank(s)" in n for n in notes), notes)

    def test_every_unmapped_poll_is_named_so_a_new_one_cannot_pass_unseen(self):
        raw = [entry(1, [("AFCA Division II Coaches Poll", [(1, 1)]),
                         ("AFCA Division III Coaches Poll", [(1, 2)]),
                         ("Some Poll Invented Next Year", [(1, 3)])])]
        rows, notes = parse(raw)
        self.assertEqual(rows, [])
        for name in ("AFCA Division II Coaches Poll", "AFCA Division III Coaches Poll",
                     "Some Poll Invented Next Year"):
            self.assertTrue(any(name in n for n in notes), f"{name} not reported: {notes}")

    def test_a_row_carries_the_ids_as_text_and_leaves_poll_date_null(self):
        rows, _ = parse([entry(3, [("AP Top 25", [(1, 194)])])])
        self.assertEqual(rows, [{"sport": "cfb", "season": 2026, "week": 3, "poll_type": "AP",
                                 "poll_date": None, "team_id": "194", "rank": 1, "points": 99}])
        self.assertIsInstance(rows[0]["team_id"], str, "teams.id is text; an int would miss every FK")

    def test_an_empty_week_is_not_an_error(self):
        # Every week before the season's first poll comes back empty, which is normal, not a failure.
        self.assertEqual(parse([]), ([], []))
        self.assertEqual(parse(None), ([], []))
        self.assertEqual(parse([entry(2, [])]), ([], []))

    def test_an_entry_missing_season_or_week_is_skipped_with_a_note(self):
        rows, notes = parse([{"polls": [{"poll": "AP Top 25", "ranks": [{"rank": 1, "teamId": 194}]}]}])
        self.assertEqual(rows, [])
        self.assertEqual(len(notes), 1)

    def test_a_rank_without_a_team_is_skipped_rather_than_written_null(self):
        raw = [{"season": 2026, "week": 1, "polls": [{"poll": "AP Top 25", "ranks": [
            {"rank": 1, "teamId": 194}, {"rank": 2}, {"teamId": 61}]}]}]
        rows, notes = parse(raw)
        self.assertEqual([r["team_id"] for r in rows], ["194"])
        self.assertEqual(len(notes), 2)


class WeekWindow(unittest.TestCase):
    def test_the_window_opens_at_week_one_and_grows_a_week_at_a_time(self):
        start = date(2026, 9, 1)
        self.assertEqual(weeks_to_date("2026-09-01", season_start=start), [1])
        self.assertEqual(weeks_to_date("2026-09-04", season_start=start), [1])
        self.assertEqual(weeks_to_date("2026-09-08", season_start=start), [1, 2])
        self.assertEqual(weeks_to_date("2026-09-15", season_start=start), [1, 2, 3])

    def test_a_date_before_the_season_still_asks_for_week_one(self):
        # Never an empty list: an out-of-season run should make one harmless request, not silently no-op.
        self.assertEqual(weeks_to_date("2026-08-01", season_start=date(2026, 9, 1)), [1])

    def test_the_window_is_capped_so_a_stale_clock_cannot_fan_out(self):
        self.assertEqual(weeks_to_date("2027-06-01", season_start=date(2026, 9, 1))[-1], 15)


if __name__ == "__main__":
    unittest.main()
