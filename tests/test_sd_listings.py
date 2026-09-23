#!/usr/bin/env python3
"""adapters/sd_listings.py - the Schedules Direct client, offline (prompt 117, register §62).

    python -m unittest tests.test_sd_listings -v    # from the repo root; stdlib only

Every call goes through an injected `http(method, url, body, headers)` that answers from fixtures in
the shape of the API docs (https://github.com/SchedulesDirect/JSON-Service/wiki/API-20141201). The
fixtures are the REAL WJW 8 sequence for Sunday 2026-09-27 (tvpassport, read 2026-09-23): NFL
Football Carolina Panthers vs. Cleveland Browns at 1:00 PM, NFL on FOX Postgame at 4:00 PM, Doc at
4:30 PM - so FOX has no late game in Cleveland that day - plus WOIO carrying Cincinnati at Pittsburgh
at 1:00 PM, plus one airing titled "NFL Football" with no episode title and no teams.

No live Schedules Direct call is made anywhere in this file, and there are no credentials on the
machine that runs it. What that leaves unproven is the live API's exact shapes; what it proves is
everything this repo controls - the calls, their order, the lineup rule, the redaction and the
output.
"""
from __future__ import annotations

import hashlib
import io
import json
import os
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from datetime import date
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from adapters import sd_listings as sd  # noqa: E402

POSTAL = "12345"   # the API docs' own example, not a real lineup; the real postal code appears in no fixture
LINEUP = f"USA-OTA-{POSTAL}"
AFFILIATES = {"CBS": "WOIO", "FOX": "WJW"}
SIDS = {"WOIO": "20404", "WJW": "20403"}

# the API's shapes, per the docs
PROGRAMS = {
    "SP004142860000": {"programID": "SP004142860000", "titles": [{"title120": "NFL Football"}],
                       "episodeTitle150": "Carolina Panthers at Cleveland Browns",
                       "eventDetails": {"teams": [{"name": "Carolina Panthers"}, {"name": "Cleveland Browns", "isHome": True}]}},
    "SP004142870000": {"programID": "SP004142870000", "titles": [{"title120": "NFL Football"}],
                       "episodeTitle150": "Cincinnati Bengals at Pittsburgh Steelers",
                       "eventDetails": {"teams": [{"name": "Cincinnati Bengals"}, {"name": "Pittsburgh Steelers", "isHome": True}]}},
    "SP004142880000": {"programID": "SP004142880000", "titles": [{"title120": "NFL Football"}]},   # no episode title, no teams
    "SH012345670000": {"programID": "SH012345670000", "titles": [{"title120": "NFL on FOX Postgame"}]},
    "SH000000010000": {"programID": "SH000000010000", "titles": [{"title120": "Doc"}], "episodeTitle150": "Pilot"},
}
SCHEDULES = [
    {"stationID": SIDS["WJW"], "programs": [
        {"programID": "SP004142860000", "airDateTime": "2026-09-27T17:00:00Z", "duration": 10800},
        {"programID": "SH012345670000", "airDateTime": "2026-09-27T20:00:00Z", "duration": 1800},
        {"programID": "SH000000010000", "airDateTime": "2026-09-27T20:30:00Z", "duration": 3600},
        {"programID": "SP004142880000", "airDateTime": "2026-10-04T17:00:00Z", "duration": 10800},
    ]},
    {"stationID": SIDS["WOIO"], "programs": [
        {"programID": "SP004142870000", "airDateTime": "2026-09-27T17:00:00Z", "duration": 10800},
    ]},
]


def LIVE_CALL(*a, **k):
    raise AssertionError("a test reached adapters.common.http_json: no live Schedules Direct call is allowed")


class FakeHttp:
    """Answers the five calls from the fixtures and records everything it was asked."""

    def __init__(self, *, lineup_present=True, fail=None):
        self.calls = []
        self.lineup_present = lineup_present
        self.fail = fail           # (method, path-suffix) -> raise
        self.programs_requested = []

    def __call__(self, method, url, body=None, headers=None):
        path = url[len(sd.BASE):]
        self.calls.append((method, path, body, dict(headers or {})))
        if self.fail and method == self.fail[0] and path.endswith(self.fail[1]):
            raise RuntimeError(f"HTTP 500 for {url}: upstream broke")
        if path == "/token":
            return {"code": 0, "token": "tok-abc"}
        if path.startswith("/headends?"):
            return [{"headend": "OTA", "lineups": [{"lineup": LINEUP, "name": "Local Over the Air"}]},
                    {"headend": "CABLE1", "lineups": [{"lineup": f"USA-CABLE1-{POSTAL}", "name": "Cable"}]}]
        if path == "/lineups":
            return {"lineups": [{"lineup": LINEUP}] if self.lineup_present else []}
        if method == "PUT" and path.startswith("/lineups/"):
            return {"code": 0, "message": "added"}
        if path == f"/lineups/{LINEUP}":
            return {"stations": [{"stationID": SIDS["WOIO"], "callsign": "WOIO"}, {"stationID": SIDS["WJW"], "callsign": "WJW"},
                                 {"stationID": "99999", "callsign": "WKYC"}]}
        if path == "/schedules":
            return SCHEDULES
        if path == "/programs":
            self.programs_requested.extend(body)
            return [PROGRAMS[i] for i in body if i in PROGRAMS]
        raise AssertionError(f"unexpected call {method} {path}")


def run_client(**kw):
    http = FakeHttp(**kw)
    logs = []
    c = sd.SdClient("joe", "hunter2", POSTAL, http=http, log=logs.append, today=date(2026, 9, 26))
    out = c.run(AFFILIATES, days_ahead=13)
    return out, http, logs


class TheCalls(unittest.TestCase):
    def test_the_password_is_sent_as_a_lowercase_sha1_and_the_token_is_reused(self):
        out, http, _ = run_client()
        m, p, body, h = http.calls[0]
        self.assertEqual((m, p), ("POST", "/token"))
        self.assertEqual(body, {"username": "joe", "password": hashlib.sha1(b"hunter2").hexdigest()})
        self.assertNotIn("hunter2", json.dumps(http.calls))
        for m, p, body, h in http.calls[1:]:
            self.assertEqual(h.get("token"), "tok-abc", f"{m} {p} carries the token")

    def test_the_ota_lineup_is_chosen_and_not_re_added_when_present(self):
        out, http, logs = run_client(lineup_present=True)
        self.assertFalse(any(m == "PUT" for m, *_ in http.calls), "six adds a day: never add a lineup already on the account")

    def test_a_missing_lineup_is_added_once(self):
        out, http, logs = run_client(lineup_present=False)
        puts = [c for c in http.calls if c[0] == "PUT"]
        self.assertEqual(len(puts), 1)
        self.assertEqual(puts[0][1], f"/lineups/{LINEUP}")

    def test_stations_are_found_by_callsign_and_schedules_asked_for_the_window(self):
        out, http, _ = run_client()
        sched = next(c for c in http.calls if c[1] == "/schedules")
        asked = {s["stationID"] for s in sched[2]}
        self.assertEqual(asked, set(SIDS.values()))
        dates = sched[2][0]["date"]
        self.assertEqual(dates[0], "2026-09-25")   # yesterday, relative to the injected today (the 26th)
        self.assertEqual(dates[-1], "2026-10-09")  # today + 13
        self.assertEqual(len(dates), 15)

    def test_each_program_id_is_fetched_once(self):
        out, http, _ = run_client()
        self.assertEqual(len(http.programs_requested), len(set(http.programs_requested)))
        self.assertEqual(sum(1 for c in http.calls if c[1] == "/programs"), 1, "one request for all of them")


class TheOutput(unittest.TestCase):
    def test_the_wjw_sunday_reads_as_the_station_lists_it(self):
        out, _, _ = run_client()
        wjw = out["stations"]["WJW"]
        self.assertEqual(wjw["network"], "FOX")
        titles = [(a["start"], a["title"], a["isNflGame"]) for a in wjw["airings"] if a["start"].startswith("2026-09-27")]
        self.assertEqual(titles, [("2026-09-27T17:00:00Z", "NFL Football", True),
                                  ("2026-09-27T20:00:00Z", "NFL on FOX Postgame", False),
                                  ("2026-09-27T20:30:00Z", "Doc", False)])
        game = wjw["airings"][0]
        self.assertEqual(game["teams"], ["Carolina Panthers", "Cleveland Browns"])
        self.assertEqual(game["episodeTitle"], "Carolina Panthers at Cleveland Browns")
        self.assertEqual(game["durationSec"], 10800)

    def test_woio_carries_the_bengals_at_the_steelers(self):
        out, _, _ = run_client()
        woio = out["stations"]["WOIO"]
        self.assertEqual(woio["network"], "CBS")
        self.assertEqual(woio["airings"][0]["teams"], ["Cincinnati Bengals", "Pittsburgh Steelers"])
        self.assertTrue(woio["airings"][0]["isNflGame"])

    def test_a_game_with_no_episode_title_is_a_game_with_no_teams(self):
        out, _, _ = run_client()
        a = next(x for x in out["stations"]["WJW"]["airings"] if x["start"].startswith("2026-10-04"))
        self.assertTrue(a["isNflGame"])
        self.assertEqual(a["teams"], [])
        self.assertIsNone(a["episodeTitle"])

    def test_teams_fall_back_to_the_episode_title_in_all_three_forms(self):
        for ep in ("Carolina Panthers at Cleveland Browns", "Carolina Panthers vs. Cleveland Browns", "Carolina Panthers @ Cleveland Browns"):
            self.assertEqual(sd.teams_from_program({"episodeTitle150": ep}), ["Carolina Panthers", "Cleveland Browns"], ep)
        self.assertEqual(sd.teams_from_program({"episodeTitle150": "Pilot"}), [])

    def test_the_game_title_is_narrow(self):
        self.assertTrue(sd.is_nfl_game_title("NFL Football"))
        self.assertTrue(sd.is_nfl_game_title("nfl football"))
        for t in ("NFL on FOX Postgame", "NFL Kickoff", "The NFL Today", "NFL Football Preview", "", None):
            self.assertFalse(sd.is_nfl_game_title(t), t)


class NothingIdentifyingLeaves(unittest.TestCase):
    def test_the_output_carries_no_postal_code_lineup_id_or_station_id(self):
        out, _, _ = run_client()
        text = json.dumps(out)
        self.assertNotIn(POSTAL, text)
        self.assertNotIn(LINEUP, text)
        for sid in SIDS.values():
            self.assertNotIn(sid, text)
        self.assertEqual(set(out["stations"]), {"WOIO", "WJW"}, "keyed by callsign, which is public")

    def test_log_lines_are_redacted(self):
        out, http, logs = run_client(lineup_present=False)
        self.assertTrue(logs, "the lineup add logs a line")
        for line in logs:
            self.assertNotIn(POSTAL, line)
            self.assertNotIn(LINEUP, line)
        c = sd.SdClient("joe", "hunter2", POSTAL, http=http, log=logs.append)
        c.lineup_id = LINEUP
        c.log(f"something about {LINEUP} and {POSTAL}")
        self.assertEqual(logs[-1], "something about <redacted> and <redacted>")


class FailureNeverFailsTheRefresh(unittest.TestCase):
    def _main(self, env, http=None, out_name="nfl_listings.json"):
        with tempfile.TemporaryDirectory() as td:
            out = Path(td) / out_name
            buf = io.StringIO()
            with mock.patch.dict(os.environ, env, clear=False), redirect_stdout(buf), mock.patch.object(sd, "http_json", LIVE_CALL):
                if http is not None:
                    with mock.patch.object(sd, "default_http", http):
                        rc = sd.main(["--out", str(out)])
                else:
                    rc = sd.main(["--out", str(out)])
            return rc, out.exists(), buf.getvalue()

    def test_missing_secrets_write_nothing_and_exit_zero(self):
        env = {k: "" for k in ("SD_USERNAME", "SD_PASSWORD", "SD_POSTAL_CODE")}
        rc, exists, log = self._main(env)
        self.assertEqual(rc, 0)
        self.assertFalse(exists)
        self.assertIn("not set", log)

    def test_a_5xx_writes_nothing_logs_one_redacted_line_and_exits_zero(self):
        env = {"SD_USERNAME": "joe", "SD_PASSWORD": "hunter2", "SD_POSTAL_CODE": POSTAL}
        http = FakeHttp(fail=("POST", "/schedules"))
        rc, exists, log = self._main(env, http=http)
        self.assertEqual(rc, 0, "a failing listings step must not fail the refresh")
        self.assertFalse(exists)
        lines = [l for l in log.splitlines() if l.strip()]
        self.assertEqual(len(lines), 1)
        self.assertIn("failed", lines[0])
        self.assertNotIn(POSTAL, lines[0])
        self.assertNotIn(LINEUP, lines[0])

    def test_a_good_run_writes_the_file_and_exits_zero(self):
        env = {"SD_USERNAME": "joe", "SD_PASSWORD": "hunter2", "SD_POSTAL_CODE": POSTAL}
        with tempfile.TemporaryDirectory() as td:
            out = Path(td) / "nfl_listings.json"
            with mock.patch.dict(os.environ, env, clear=False), mock.patch.object(sd, "default_http", FakeHttp()), \
                    mock.patch.object(sd, "find_repo_root", lambda: ROOT), mock.patch.object(sd, "http_json", LIVE_CALL), \
                    redirect_stdout(io.StringIO()):
                rc = sd.main(["--out", str(out)])
            self.assertEqual(rc, 0)
            self.assertTrue(out.exists())
            text = out.read_text(encoding="utf-8")
            self.assertNotIn(POSTAL, text)
            self.assertNotIn(LINEUP, text)
            self.assertEqual(set(json.loads(text)["stations"]), {"WOIO", "WJW"})

    def test_the_affiliates_come_from_markets_json(self):
        d = json.loads((ROOT / "data" / "markets.json").read_text(encoding="utf-8"))
        self.assertEqual(d["nfl"]["affiliates"], {"CBS": "WOIO", "FOX": "WJW"})


if __name__ == "__main__":
    unittest.main()
