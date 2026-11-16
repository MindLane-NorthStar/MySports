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
# prompt 131: the three-window pages, cut verbatim from the live week 9 and week 10 pages read 2026-11-14
WEEK9 = (FIX / "es_week9_cleveland.html").read_text(encoding="utf-8")
WEEK10 = (FIX / "es_week10_cleveland.html").read_text(encoding="utf-8")
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

    def test_a_three_window_block_missing_its_single_window_is_a_page_error(self):
        # PROMPT 131 REPLACES prompt 118's "three windows only is a page error": three windows is now the
        # page's normal shape. Three windows with NO single - the four-window block less one - is not.
        cut = WEEK3.index('<div class="mw"><span class="lw">FOX Late')
        end = WEEK3.index("</div>", cut) + len("</div>")
        with self.assertRaises(es.PageError) as e:
            es.parse_page(WEEK3[:cut] + WEEK3[end:])
        self.assertIn("(CBS Early, FOX Early, CBS Late)", str(e.exception), "the message names the labels it found")
        # and week 9 with its single window gone: the doubleheader's two windows alone are not a block
        cut = WEEK9.index('<div class="mw"><span class="lw">CBS</span>')
        end = WEEK9.index("</div>", cut) + len("</div>")
        with self.assertRaises(es.PageError) as e:
            es.parse_page(WEEK9[:cut] + WEEK9[end:])
        self.assertIn("2 window(s) parsed (FOX Early, FOX Late)", str(e.exception))

    def test_a_garbled_block_is_a_page_error(self):
        with self.assertRaises(es.PageError):
            es.parse_page(WEEK3.replace('class="lw"', 'class="label"'))


class TheThreeWindowPage(unittest.TestCase):
    """Prompt 131: from week 9 every block is three windows - one network's Early and Late, the other's
    single window labelled bare, its kickoff in the station span."""

    def test_week_9_reads_cbs_single_fox_early_fox_late_and_the_stamp(self):
        p = es.parse_page(WEEK9)
        self.assertEqual(p["market"], "Cleveland–Akron (Canton)")
        self.assertEqual(p["updated"], "Mon Nov 9, 12:27 PM ET")
        rows = [(w["network"], w["slot"], w["station"], w["time"], w["text"], w["tbd"]) for w in p["windows"]]
        self.assertEqual(rows, [("CBS", "single", "WOIO 19 (CBS) · 1:00 PM ET", "1:00 PM ET", "CLE Browns @ NO Saints", False),
                                ("FOX", "early", "WJW 8 (FOX)", None, "DAL Cowboys @ IND Colts", False),
                                ("FOX", "late", "WJW 8 (FOX)", None, "GB Packers @ NE Patriots", False)])
        self.assertEqual(p["windows"][0]["away"], {"abbr": "CLE", "nick": "Browns"})
        self.assertEqual(p["windows"][0]["home"], {"abbr": "NO", "nick": "Saints"})
        self.assertEqual(p["notes"], [])

    def test_week_10_reads_a_4_05_cbs_single_window(self):
        p = es.parse_page(WEEK10)
        self.assertEqual(p["updated"], "Fri Nov 13, 12:27 AM ET")
        self.assertEqual([(w["network"], w["slot"], w["time"], w["text"]) for w in p["windows"]],
                         [("CBS", "single", "4:05 PM ET", "SEA Seahawks @ LV Raiders"),
                          ("FOX", "early", None, "HOU Texans @ CLE Browns"),
                          ("FOX", "late", None, "SF 49ers @ DAL Cowboys")])

    def test_the_call_sign_survives_the_kickoff_suffix(self):
        # adapters/espn.py windows_decision takes the call sign as the station span up to the first space
        station = es.parse_page(WEEK9)["windows"][0]["station"]
        self.assertEqual(station.split(" ")[0], "WOIO")

    def test_a_fox_single_page_is_valid(self):
        flipped = (WEEK9.replace('<span class="lw">CBS</span>', '<span class="lw">FOX</span>')
                        .replace('<span class="lw">FOX Early</span>', '<span class="lw">CBS Early</span>')
                        .replace('<span class="lw">FOX Late</span>', '<span class="lw">CBS Late</span>'))
        p = es.parse_page(flipped)
        self.assertEqual([(w["network"], w["slot"]) for w in p["windows"]], [("FOX", "single"), ("CBS", "early"), ("CBS", "late")])


class TheTwoShapes(unittest.TestCase):
    """Prompt 131: a block is exactly the four windows, or one network's early and late plus the other's single."""

    def test_four_windows_two_networks_is_still_valid(self):
        self.assertEqual(len(es.parse_page(WEEK3)["windows"]), 4)

    def test_three_windows_of_one_network_is_a_page_error(self):
        with self.assertRaises(es.PageError) as e:
            es.parse_page(WEEK9.replace('<span class="lw">CBS</span>', '<span class="lw">FOX</span>'))
        self.assertIn("(FOX, FOX Early, FOX Late)", str(e.exception))

    def test_two_singles_is_a_page_error(self):
        cut = WEEK9.index('<div class="mw"><span class="lw">FOX Late')
        end = WEEK9.index("</div>", cut) + len("</div>")
        two = WEEK9[:cut] + WEEK9[end:]
        with self.assertRaises(es.PageError) as e:
            es.parse_page(two.replace('<span class="lw">FOX Early</span>', '<span class="lw">FOX</span>'))
        self.assertIn("(CBS, FOX)", str(e.exception))

    def test_a_single_beside_its_own_networks_early_is_a_page_error(self):
        with self.assertRaises(es.PageError):
            es.parse_page(WEEK9.replace('<span class="lw">FOX Late</span>', '<span class="lw">CBS Early</span>'))

    def test_valid_shape_directly(self):
        ok = [set(es.WINDOW_LABELS), {("CBS", "early"), ("CBS", "late"), ("FOX", "single")},
              {("FOX", "early"), ("FOX", "late"), ("CBS", "single")}]
        bad = [{("FOX", "early"), ("FOX", "late"), ("FOX", "single")}, {("CBS", "single"), ("FOX", "single")},
               {("CBS", "early"), ("FOX", "early"), ("CBS", "late")}, set(es.WINDOW_LABELS) | {("CBS", "single")}, set()]
        for s in ok:
            self.assertTrue(es.valid_shape(s), s)
        for s in bad:
            self.assertFalse(es.valid_shape(s), s)


class TheStatus(unittest.TestCase):
    """Prompt 131: the per-week result reaches refresh_runs.notes through MYSPORTS_NFL_WINDOWS_STATUS,
    on EVERY exit - the failure that went unseen for nine days most of all."""

    def run_with_status(self, pages, argv=None, scoreboard=None):
        with tempfile.TemporaryDirectory() as td:
            st = Path(td) / "status.json"
            out = Path(td) / "w.json"
            fetch_sb = scoreboard or (lambda now: SCOREBOARD)
            def fetch_text(url):
                if url not in pages:
                    raise RuntimeError(f"HTTP 404 for {url}")
                return pages[url]
            with mock.patch.dict(es.os.environ, {es.STATUS_ENV: str(st)}), mock.patch.object(es, "http_text", LIVE_CALL), \
                    mock.patch.object(es, "http_json", LIVE_CALL), redirect_stdout(io.StringIO()):
                rc = es.main(["--out", str(out)] + (argv or []), fetch_text=fetch_text, fetch_scoreboard=fetch_sb,
                             now=datetime(2026, 9, 23, 12, 0, tzinfo=timezone.utc))
            return rc, out.exists(), (json.loads(st.read_text(encoding="utf-8")) if st.exists() else None)

    def test_a_good_week_and_a_failed_week_are_both_named(self):
        bad4 = WEEK4.replace('<span class="lw">FOX Late</span>', '<span class="lw">FOX</span>')
        rc, wrote, st = self.run_with_status({es.PAGE_URL.format(week=3): WEEK3, es.PAGE_URL.format(week=4): bad4})
        self.assertEqual((rc, wrote, st["written"]), (0, True, True))
        self.assertEqual(st["weeks"]["3"], "ok: 2 of 4 windows named")
        self.assertTrue(st["weeks"]["4"].startswith("failed (PageError: 4 window(s) parsed (CBS Early, FOX Early, CBS Late, FOX)"), st["weeks"]["4"])

    def test_every_week_failing_still_writes_the_status_and_no_windows(self):
        rc, wrote, st = self.run_with_status({})
        self.assertEqual((rc, wrote, st["written"]), (0, False, False))
        self.assertEqual(set(st["weeks"]), {"3", "4"})
        self.assertTrue(all(v.startswith("failed (RuntimeError: HTTP 404") for v in st["weeks"].values()))

    def test_a_calendar_failure_writes_the_error(self):
        def boom(now):
            raise RuntimeError("scoreboard down")
        rc, wrote, st = self.run_with_status({}, scoreboard=boom)
        self.assertEqual((rc, wrote, st["written"], st["weeks"]), (0, False, False, {}))
        self.assertEqual(st["error"], "RuntimeError: scoreboard down")

    def test_a_three_window_week_reads_as_three_named(self):
        rc, wrote, st = self.run_with_status({es.PAGE_URL.format(week=9): WEEK9}, argv=["--week", "9"])
        self.assertEqual(st["weeks"], {"9": "ok: 3 of 3 windows named"})

    def test_no_variable_no_file(self):
        with mock.patch.dict(es.os.environ, {}, clear=False), mock.patch.object(es.Path, "write_text") as w:
            es.os.environ.pop(es.STATUS_ENV, None)
            es.write_status({"written": True})
            w.assert_not_called()


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
        self.assertIn("week 3 2 of 4 windows named; week 4 0 of 4 windows named", log)

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
        self.assertIn("every week failed", log)
        self.assertIn("no Cleveland", log)

    def test_a_three_window_block_missing_its_single_window_writes_nothing(self):
        # PROMPT 131 REPLACES prompt 118's "three windows only writes nothing" (see the parser test).
        cut = WEEK3.index('<div class="mw"><span class="lw">FOX Late')
        end = WEEK3.index("</div>", cut) + len("</div>")
        # both pages three windows with no single (prompt 119: one bad week alone leaves the other standing)
        cut4 = WEEK4.index('<div class="mw"><span class="lw">FOX Late'); end4 = WEEK4.index("</div>", cut4) + len("</div>")
        pages = {es.PAGE_URL.format(week=3): WEEK3[:cut] + WEEK3[end:], es.PAGE_URL.format(week=4): WEEK4[:cut4] + WEEK4[end4:]}
        rc, data, log = _main(pages)
        self.assertEqual((rc, data), (0, None))
        self.assertIn("a block is the four windows, or one network's Early and Late and the other's single window", log)

    def test_a_garbled_block_writes_nothing(self):
        rc, data, log = _main({k: v.replace('class="lw"', 'class="label"') for k, v in PAGES.items()})
        self.assertEqual((rc, data), (0, None))

    def test_a_next_week_that_404s_leaves_the_current_week_standing_with_one_note(self):
        # prompt 119 REPLACES prompt 118's "a 404 on the next page writes nothing": in the season's last
        # regular week the next page does not exist, and that must not cost the current week its windows
        rc, data, log = _main({es.PAGE_URL.format(week=3): WEEK3})
        self.assertEqual(rc, 0)
        self.assertEqual(list(data["weeks"]), ["3"])
        self.assertEqual(data["weeks"]["3"]["windows"][0]["home"]["nick"], "Steelers")
        self.assertEqual(len(data["notes"]), 1)
        self.assertTrue(data["notes"][0].startswith("week 4: left out (RuntimeError: HTTP 404"), data["notes"][0])
        self.assertIn("week 3 2 of 4 windows named; week 4 failed (RuntimeError: HTTP 404", log)

    def test_a_current_week_that_fails_leaves_the_next_week_standing(self):
        rc, data, log = _main({es.PAGE_URL.format(week=4): WEEK4})
        self.assertEqual(rc, 0)
        self.assertEqual(list(data["weeks"]), ["4"])
        self.assertIn("week 3: left out", data["notes"][0])

    def test_both_weeks_failing_writes_nothing_and_logs_one_line(self):
        rc, data, log = _main({})
        self.assertEqual((rc, data), (0, None))
        lines = [l for l in log.splitlines() if l.strip()]
        self.assertEqual(len(lines), 1)
        self.assertIn("every week failed", lines[0])
        self.assertIn("week 3 failed (RuntimeError: HTTP 404", lines[0]); self.assertIn("week 4 failed (RuntimeError: HTTP 404", lines[0])

    def test_a_bad_week_is_named_with_its_reason_and_the_good_week_has_no_note(self):
        cut = WEEK4.index('<div class="mw"><span class="lw">FOX Late')
        end = WEEK4.index("</div>", cut) + len("</div>")
        rc, data, log = _main({es.PAGE_URL.format(week=3): WEEK3, es.PAGE_URL.format(week=4): WEEK4[:cut] + WEEK4[end:]})
        self.assertEqual(list(data["weeks"]), ["3"])
        self.assertEqual(data["notes"], ["week 4: left out (PageError: 3 window(s) parsed (CBS Early, FOX Early, CBS Late); "
                                         "a block is the four windows, or one network's Early and Late and the other's single window)"])

    def test_the_fixtures_are_the_cleveland_block_only(self):
        for name, text in (("week 3", WEEK3), ("week 4", WEEK4), ("week 9", WEEK9), ("week 10", WEEK10)):
            self.assertEqual(text.count('<details class="mkd">'), 1, f"{name}: one market block, not the page")
            self.assertLess(len(text), 2500, f"{name}: a trimmed block, not a page copy")
            self.assertNotIn("<table", text)


class TheAnchor(unittest.TestCase):
    """Prompt 130 (queue item 24): `--date D` reads D's week and the next, at noon ET on D."""

    REAL_NOW = datetime(2026, 10, 15, 12, 0, tzinfo=timezone.utc)   # the clock on the morning of the backfill

    def run_anchored(self, argv):
        asked = []
        pages = {es.PAGE_URL.format(week=w): WEEK3 for w in range(1, 19)}
        def fetch_text(url):
            return pages[url]
        def fetch_scoreboard(now):
            asked.append(now)
            return SCOREBOARD
        with tempfile.TemporaryDirectory() as td:
            out = Path(td) / "w.json"
            with mock.patch.object(es, "http_text", LIVE_CALL), mock.patch.object(es, "http_json", LIVE_CALL),                     redirect_stdout(io.StringIO()):
                rc = es.main(["--out", str(out)] + argv, fetch_text=fetch_text, fetch_scoreboard=fetch_scoreboard,
                             now=self.REAL_NOW)
            data = json.loads(out.read_text(encoding="utf-8")) if out.exists() else None
        return rc, data, asked

    def test_a_past_sunday_reads_its_own_week_and_the_next(self):
        rc, data, asked = self.run_anchored(["--date", "2026-10-04"])
        self.assertEqual((rc, list(data["weeks"])), (0, ["4", "5"]))
        self.assertEqual(asked, [datetime(2026, 10, 4, 16, 0, tzinfo=timezone.utc)], "noon ET on the anchor")

    def test_the_second_anchor_reads_week_5_and_6(self):
        rc, data, _ = self.run_anchored(["--date", "2026-10-11"])
        self.assertEqual(list(data["weeks"]), ["5", "6"])

    def test_without_a_date_the_real_clock_decides_exactly_as_before(self):
        rc, data, asked = self.run_anchored([])
        self.assertEqual(list(data["weeks"]), ["6", "7"])
        self.assertEqual(asked, [self.REAL_NOW])

    def test_noon_et_in_both_seasons_of_the_clock(self):
        self.assertEqual(es.anchor_noon("2026-10-04"), datetime(2026, 10, 4, 16, 0, tzinfo=timezone.utc))
        self.assertEqual(es.anchor_noon("2026-12-06"), datetime(2026, 12, 6, 17, 0, tzinfo=timezone.utc))

    def test_a_bad_date_writes_nothing_and_exits_zero(self):
        rc, data, asked = self.run_anchored(["--date", "2026-13-40"])
        self.assertEqual((rc, data, asked), (0, None, []))


if __name__ == "__main__":
    unittest.main()
