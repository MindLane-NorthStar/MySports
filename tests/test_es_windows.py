#!/usr/bin/env python3
"""adapters/es_windows.py - the EntitledSports window reader, offline (prompt 118, register §63).

    python -m unittest tests.test_es_windows -v    # from the repo root; stdlib only

The fixtures are the Cleveland-Akron (Canton) block and the stamp row, hand-trimmed from the live week 3
and week 4 pages read 2026-09-23 (the one live fetch prompt 118 allowed). Nothing here reaches the
network: `http_text` and `http_json` are replaced by a helper that fails the test.
"""
from __future__ import annotations

import io
import json
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from datetime import datetime, timezone
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from adapters import es_windows as es  # noqa: E402

FIX = ROOT / "tests" / "fixtures"
WEEK3 = (FIX / "es_week3_cleveland.html").read_text(encoding="utf-8")
WEEK4 = (FIX / "es_week4_cleveland.html").read_text(encoding="utf-8")
SCOREBOARD = json.loads((FIX / "espn_nfl_scoreboard_raw.json").read_text(encoding="utf-8"))


def LIVE_CALL(*a, **k):
    raise AssertionError("a test reached adapters.common's HTTP helper: no live call is allowed from the suite")


class TheParser(unittest.TestCase):
    def test_week_3_reads_two_named_early_windows_and_two_tbd_late_windows(self):
        p = es.parse_page(WEEK3)
        self.assertEqual(p["market"], "Cleveland–Akron (Canton)")
        self.assertEqual(p["updated"], "Wed Sep 23, 5:30 AM ET")
        rows = [(w["network"], w["slot"], w["station"], w["text"], w["tbd"]) for w in p["windows"]]
        self.assertEqual(rows, [("CBS", "early", "WOIO 19 (CBS)", "CIN Bengals @ PIT Steelers", False),
                                ("FOX", "early", "WJW 8 (FOX)", "CAR Panthers @ CLE Browns", False),
                                ("CBS", "late", "WOIO 19 (CBS)", "TBD", True),
                                ("FOX", "late", "WJW 8 (FOX)", "TBD", True)])
        self.assertEqual(p["windows"][0]["away"], {"abbr": "CIN", "nick": "Bengals"})
        self.assertEqual(p["windows"][0]["home"], {"abbr": "PIT", "nick": "Steelers"})
        self.assertIsNone(p["windows"][2]["home"])
        self.assertEqual(p["notes"], [])

    def test_week_4_is_all_tbd(self):
        p = es.parse_page(WEEK4)
        self.assertEqual(p["updated"], "Sun Sep 13, 10:22 PM ET")
        self.assertTrue(all(w["tbd"] for w in p["windows"]))
        self.assertEqual(len(p["windows"]), 4)

    def test_an_unrecognized_marker_is_recorded_verbatim_and_becomes_tbd(self):
        html = WEEK3.replace("CIN Bengals @ PIT Steelers", "No game")
        p = es.parse_page(html)
        self.assertTrue(p["windows"][0]["tbd"])
        self.assertEqual(p["windows"][0]["text"], "No game")
        self.assertEqual(p["notes"], ["CBS early: unrecognized window text 'No game' treated as TBD"])
        # and a national-style marker the same way: never guessed into a decision
        p = es.parse_page(WEEK3.replace("TBD<span", "National<span", 1))
        self.assertTrue(p["windows"][2]["tbd"])
        self.assertIn("'National'", p["notes"][0])

    def test_a_missing_cleveland_block_is_a_page_error(self):
        with self.assertRaises(es.PageError):
            es.parse_page(WEEK3.replace("cleveland-akron-canton", "columbus"))

    def test_three_windows_only_is_a_page_error(self):
        cut = WEEK3.index('<div class="mw"><span class="lw">FOX Late')
        end = WEEK3.index("</div>", cut) + len("</div>")
        with self.assertRaises(es.PageError):
            es.parse_page(WEEK3[:cut] + WEEK3[end:])

    def test_a_garbled_block_is_a_page_error(self):
        with self.assertRaises(es.PageError):
            es.parse_page(WEEK3.replace('class="lw"', 'class="label"'))


class TheWeek(unittest.TestCase):
    def test_the_week_comes_from_espns_calendar_and_matches_the_events_week(self):
        ev = SCOREBOARD["events"][0]
        when = datetime.fromisoformat(ev["date"].replace("Z", "+00:00"))
        cur, nxt = es.weeks_from_calendar(SCOREBOARD, when)
        self.assertEqual(cur, ev["week"]["number"], "the calendar's number is the number on the game")
        self.assertEqual(nxt, cur + 1)

    def test_the_two_dates_the_brief_names(self):
        cur, nxt = es.weeks_from_calendar(SCOREBOARD, datetime(2026, 9, 27, 17, 0, tzinfo=timezone.utc))
        self.assertEqual((cur, nxt), (3, 4))
        cur, nxt = es.weeks_from_calendar(SCOREBOARD, datetime(2026, 10, 4, 17, 0, tzinfo=timezone.utc))
        self.assertEqual((cur, nxt), (4, 5))
        cur, nxt = es.weeks_from_calendar(SCOREBOARD, datetime(2026, 9, 23, 12, 0, tzinfo=timezone.utc))   # a Wednesday
        self.assertEqual((cur, nxt), (3, 4))

    def test_outside_the_regular_season_is_an_error(self):
        with self.assertRaises(es.PageError):
            es.weeks_from_calendar(SCOREBOARD, datetime(2026, 3, 1, tzinfo=timezone.utc))


def _main(pages: dict[str, str] | Exception, argv=None, now=None):
    def fetch_text(url):
        if isinstance(pages, Exception):
            raise pages
        if url not in pages:
            raise RuntimeError(f"HTTP 404 for {url}")
        return pages[url]
    with tempfile.TemporaryDirectory() as td:
        out = Path(td) / "nfl_windows.json"
        buf = io.StringIO()
        with mock.patch.object(es, "http_text", LIVE_CALL), mock.patch.object(es, "http_json", LIVE_CALL), redirect_stdout(buf):
            rc = es.main(["--out", str(out)] + (argv or []), fetch_text=fetch_text,
                         fetch_scoreboard=lambda now: SCOREBOARD, now=now or datetime(2026, 9, 23, 12, 0, tzinfo=timezone.utc))
        data = json.loads(out.read_text(encoding="utf-8")) if out.exists() else None
        return rc, data, buf.getvalue()


PAGES = {es.PAGE_URL.format(week=3): WEEK3, es.PAGE_URL.format(week=4): WEEK4}


class TheRun(unittest.TestCase):
    def test_this_week_and_the_next_from_the_calendar(self):
        rc, data, log = _main(PAGES)
        self.assertEqual(rc, 0)
        self.assertEqual(list(data["weeks"]), ["3", "4"])
        self.assertEqual(data["weeks"]["3"]["updated"], "Wed Sep 23, 5:30 AM ET")
        self.assertEqual(data["weeks"]["3"]["windows"][0]["home"]["nick"], "Steelers")
        self.assertEqual(data["market"], "Cleveland–Akron (Canton)")
        self.assertIn("ESPN calendar", log)
        self.assertIn("2 of 8 windows named", log)

    def test_weeks_named_on_the_command_line_fetch_no_calendar(self):
        rc, data, log = _main(PAGES, argv=["--week", "3"])
        self.assertEqual(rc, 0)
        self.assertEqual(list(data["weeks"]), ["3"])
        self.assertIn("command line", log)

    def test_an_http_500_writes_nothing_logs_one_line_and_exits_zero(self):
        rc, data, log = _main(RuntimeError("HTTP 500 for https://entitledsports.com/...: down"))
        self.assertEqual(rc, 0)
        self.assertIsNone(data)
        self.assertEqual(len([l for l in log.splitlines() if l.strip()]), 1)
        self.assertIn("failed", log)

    def test_a_missing_cleveland_block_writes_nothing(self):
        rc, data, log = _main({k: v.replace("cleveland-akron-canton", "columbus") for k, v in PAGES.items()})
        self.assertEqual((rc, data), (0, None))
        self.assertIn("no Cleveland", log)

    def test_three_windows_only_writes_nothing(self):
        cut = WEEK3.index('<div class="mw"><span class="lw">FOX Late')
        end = WEEK3.index("</div>", cut) + len("</div>")
        pages = dict(PAGES); pages[es.PAGE_URL.format(week=3)] = WEEK3[:cut] + WEEK3[end:]
        rc, data, log = _main(pages)
        self.assertEqual((rc, data), (0, None))
        self.assertIn("four are required", log)

    def test_a_garbled_block_writes_nothing(self):
        rc, data, log = _main({k: v.replace('class="lw"', 'class="label"') for k, v in PAGES.items()})
        self.assertEqual((rc, data), (0, None))

    def test_the_next_weeks_page_missing_is_a_failure_of_the_whole_run(self):
        # the brief's contract is "a failure of any kind": a 404 on either page writes nothing
        rc, data, log = _main({es.PAGE_URL.format(week=3): WEEK3})
        self.assertEqual((rc, data), (0, None))
        self.assertIn("404", log)

    def test_the_fixtures_are_the_cleveland_block_only(self):
        for name, text in (("week 3", WEEK3), ("week 4", WEEK4)):
            self.assertEqual(text.count('<details class="mkd">'), 1, f"{name}: one market block, not the page")
            self.assertLess(len(text), 2500, f"{name}: a trimmed block, not a page copy")
            self.assertNotIn("<table", text)


if __name__ == "__main__":
    unittest.main()
