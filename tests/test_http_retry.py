#!/usr/bin/env python3
"""The bounded retry in adapters.common.http_json (2026-09-03).

    python -m unittest tests.test_http_retry -v    # from the repo root; stdlib only

No network: urllib.request.urlopen is monkeypatched, and the backoff is injected so nothing sleeps.

The policy under test, and why each half of it matters:

  * connection-level failures and 5xx are retried once - a reset or a 502 is the network having a
    moment, and a second try usually lands;
  * NO 4xx is EVER retried. A 403 is Akamai's answer, not a blip; re-asking makes the bot score worse.
    The only CI fetch failure in this repo's history is exactly that (run 33673744218, HTTP 403 from
    site.api.espn.com), so this is the case the policy is shaped around;
  * ConnectionResetError and TimeoutError are caught EXPLICITLY, because urllib only wraps failures
    raised while connecting in URLError - a reset arriving mid-body, during resp.read(), is a bare
    ConnectionResetError and the old `except URLError` never saw it. That is the api-web.nhle.com
    failure shape from 2026-09-03, so this test is the regression guard for the actual bug.
"""
from __future__ import annotations

import io
import json
import sys
import unittest
import urllib.error
import urllib.request
from contextlib import redirect_stdout
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from adapters import common  # noqa: E402


class FakeResponse:
    def __init__(self, payload):
        self._b = json.dumps(payload).encode("utf-8")

    def read(self):
        return self._b

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


def http_error(code: int) -> urllib.error.HTTPError:
    return urllib.error.HTTPError("https://example.test/x", code, "boom", {}, io.BytesIO(b"denied"))


class Harness:
    """Records every attempt and replays a scripted sequence of outcomes."""

    def __init__(self, outcomes):
        self.outcomes = list(outcomes)
        self.calls = 0
        self.slept: list[float] = []

    def urlopen(self, req, timeout=None):
        self.calls += 1
        outcome = self.outcomes[min(self.calls - 1, len(self.outcomes) - 1)]
        if isinstance(outcome, Exception):
            raise outcome
        return FakeResponse(outcome)

    def sleep(self, seconds):
        self.slept.append(seconds)   # never actually waits


def run(outcomes, **kw):
    h = Harness(outcomes)
    real = urllib.request.urlopen
    urllib.request.urlopen = h.urlopen
    try:
        with redirect_stdout(io.StringIO()) as out:
            try:
                value = common.http_json("https://api-web.nhle.com/v1/schedule/now", sleep=h.sleep, **kw)
                err = None
            except Exception as e:  # noqa: BLE001 - the failure is the assertion subject
                value, err = None, e
        return h, value, err, out.getvalue()
    finally:
        urllib.request.urlopen = real


class RetriesConnectionFailures(unittest.TestCase):
    def test_a_reset_mid_body_is_retried_and_succeeds(self):
        h, value, err, _ = run([ConnectionResetError(10054, "An existing connection was forcibly closed"),
                                {"ok": True}])
        self.assertIsNone(err)
        self.assertEqual(value, {"ok": True})
        self.assertEqual(h.calls, 2, "a reset must be retried exactly once")

    def test_a_bare_timeout_is_retried(self):
        h, value, err, _ = run([TimeoutError("timed out"), {"ok": True}])
        self.assertIsNone(err)
        self.assertEqual(h.calls, 2)

    def test_a_urlerror_is_retried(self):
        h, value, err, _ = run([urllib.error.URLError("no route"), {"ok": True}])
        self.assertIsNone(err)
        self.assertEqual(h.calls, 2)

    def test_two_resets_give_up_after_two_attempts(self):
        h, _, err, _ = run([ConnectionResetError(10054, "reset"), ConnectionResetError(10054, "reset")])
        self.assertIsInstance(err, RuntimeError)
        self.assertEqual(h.calls, 2, "bounded: never more than 2 attempts")


class NeverRetriesFourXX(unittest.TestCase):
    def test_a_403_is_not_retried(self):
        h, _, err, _ = run([http_error(403), {"ok": True}])
        self.assertIsInstance(err, RuntimeError)
        self.assertIn("HTTP 403", str(err))
        self.assertEqual(h.calls, 1, "a 403 is Akamai's answer; re-asking worsens the bot score")

    def test_a_404_is_not_retried(self):
        h, _, err, _ = run([http_error(404), {"ok": True}])
        self.assertIsInstance(err, RuntimeError)
        self.assertEqual(h.calls, 1)

    def test_a_429_is_not_retried_either(self):
        # Deliberate narrowing on 2026-09-03: the policy is "never retry a 4xx", full stop.
        h, _, err, _ = run([http_error(429), {"ok": True}])
        self.assertEqual(h.calls, 1)


class RetriesServerErrors(unittest.TestCase):
    def test_a_502_is_retried(self):
        h, value, err, _ = run([http_error(502), {"ok": True}])
        self.assertIsNone(err)
        self.assertEqual(h.calls, 2)

    def test_a_500_is_retried(self):
        h, _, _, _ = run([http_error(500), {"ok": True}])
        self.assertEqual(h.calls, 2)


class BoundsAndReporting(unittest.TestCase):
    def test_a_clean_first_attempt_does_not_retry_or_sleep(self):
        h, value, err, out = run([{"ok": True}])
        self.assertEqual(h.calls, 1)
        self.assertEqual(h.slept, [])
        self.assertEqual(out, "", "a successful fetch says nothing")

    def test_the_backoff_is_two_seconds_and_is_not_actually_slept(self):
        h, _, _, _ = run([ConnectionResetError(10054, "reset"), {"ok": True}])
        self.assertEqual(h.slept, [2.0])

    def test_one_ascii_warning_line_per_retry_naming_host_and_reason(self):
        _, _, _, out = run([ConnectionResetError(10054, "reset"), {"ok": True}])
        lines = [l for l in out.splitlines() if l.strip()]
        self.assertEqual(len(lines), 1, "exactly one line per retry")
        self.assertIn("api-web.nhle.com", lines[0])
        self.assertIn("ConnectionResetError", lines[0])
        self.assertTrue(lines[0].isascii(), "console output is ASCII-only on Windows")

    def test_attempts_is_a_total_not_an_extra(self):
        h, _, _, _ = run([ConnectionResetError(10054, "r")] * 5, attempts=3)
        self.assertEqual(h.calls, 3)

    def test_attempts_of_one_disables_retrying(self):
        h, _, err, out = run([ConnectionResetError(10054, "r"), {"ok": True}], attempts=1)
        self.assertIsInstance(err, RuntimeError)
        self.assertEqual(h.calls, 1)
        self.assertEqual(out, "")


if __name__ == "__main__":
    unittest.main()
