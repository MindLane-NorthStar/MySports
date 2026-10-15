#!/usr/bin/env python3
"""Prompt 130 block D: a past Saturday's CFB render reads that Saturday's week from the database.

    python -m pytest tests/test_render_range.py -q    # from the repo root

`render_all.yml` renders a range of days on demand; for a Saturday other than today it asks
`pipeline/render_feed.py --week-of D` for the week instead of `--latest-week`, so a re-render of 10-10
draws week 6 and not the newest week loaded. The workflow's shell is pinned by execution in
tests/test_workflows.py; this pins the query it relies on.
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from pipeline import render_feed  # noqa: E402


class FakeDB:
    def __init__(self, answer):
        self.answer, self.calls = answer, []

    def fetch(self, sql, params=None):
        self.calls.append((sql, params))
        return [(self.answer,)]


def test_week_of_asks_for_that_viewing_days_week_in_that_sport_and_season():
    db = FakeDB(6)
    assert render_feed.week_of(db, "cfb", 2026, "2026-10-10") == 6
    sql, params = db.calls[0]
    assert "viewing_day = %s" in sql and "sport = %s" in sql and "season = %s" in sql
    assert params == ("cfb", 2026, "2026-10-10")


def test_a_day_with_no_games_has_no_week():
    assert render_feed.week_of(FakeDB(None), "cfb", 2026, "2026-10-14") is None


def test_latest_week_is_unchanged_for_the_nightly():
    db = FakeDB(15)
    assert render_feed.latest_week(db, "cfb", 2026) == 15
    assert "viewing_day" not in db.calls[0][0]
