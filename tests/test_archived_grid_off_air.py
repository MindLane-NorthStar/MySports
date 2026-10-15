#!/usr/bin/env python3
"""Prompt 130 block C: the archived desktop grid draws no block for a cancelled or postponed game.

    python -m pytest tests/test_archived_grid_off_air.py -q    # from the repo root

Joe's ruling 4 of 2026-10-14: a cancelled or postponed game comes off the grid and stays in the list.
Prompt 129 made the mobile grid obey (web/lib/offservice.js `gridSet`). The archived render did not:
`pipeline/render_feed.py`'s GAMES_SQL did not select `result_status`, and `scripts/render_day.py` had no
test for either state (queue item 23).

Two halves, each tested where it lives. The FEED is the database speaking, so it carries every game
with its state and drops nothing. The RENDERER decides, beside its OMIT_ACCESS filter, and is proved by
its output - it runs its whole render at import, so it is driven as a subprocess, the way
tests/test_program_card_svg.py drives it.
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from pipeline import render_feed  # noqa: E402

DAY = "2026-10-08"
# (game id, away, home, network, result_status) - one game per network, so a grid row is a game
GAMES = [
    ("mlb-990301", ("mlb-139", "Rays", "TB"), ("mlb-147", "Yankees", "NYY"), "TBS", "scheduled"),
    ("mlb-990302", ("mlb-144", "Braves", "ATL"), ("mlb-119", "Dodgers", "LAD"), "FS1", "cancelled"),
    ("mlb-990303", ("mlb-135", "Padres", "SD"), ("mlb-158", "Brewers", "MIL"), "FOX", "postponed"),
    ("mlb-990304", ("mlb-141", "Blue Jays", "TOR"), ("mlb-136", "Mariners", "SEA"), "truTV", "final"),
]


class FakeDB:
    """Answers render_feed.build's four reads with the rows above, in GAMES_SQL's column order."""

    def __init__(self):
        self.games_sql = None

    def fetch(self, sql, params=None):
        if "from games g" in sql:
            self.games_sql = sql
            kick = datetime(2026, 10, 8, 22, 8, tzinfo=timezone.utc)
            return [(gid, 2026, None, kick, "definite", False, "Park",
                     h[0], h[1], h[1], None, h[2], None, a[0], a[1], a[1], None, a[2], None, kick, status)
                    for gid, a, h, _, status in GAMES]
        if "from game_broadcasts b" in sql:
            return [(gid, net, "LINEAR", "NATIONAL", None, "available", "CONFIRMED", None) for gid, _, _, net, _ in GAMES]
        return []


def test_the_feed_selects_result_status_and_carries_every_game_with_its_state():
    db = FakeDB()
    fx, _ = render_feed.build(db, "mlb", date=DAY, week=None, year=2026)
    assert "g.result_status" in db.games_sql
    assert [(g["id"], g["status"]) for g in fx["games"]] == [(gid, s) for gid, _, _, _, s in GAMES]


@pytest.fixture(scope="module")
def rendered(tmp_path_factory):
    teams = ROOT / "artifacts" / "validation" / "mlb_2026_teams.json"
    if not teams.exists():
        pytest.skip("the local MLB teams file is not present (artifacts/ is gitignored)")
    out = tmp_path_factory.mktemp("offair")
    db = FakeDB()
    fx, _ = render_feed.build(db, "mlb", date=DAY, week=None, year=2026)
    path = out / f"db_mlb_{DAY}_fixture.json"
    path.write_text(json.dumps(fx), encoding="utf-8")
    r = subprocess.run([sys.executable, str(ROOT / "scripts" / "render_day.py"), "--sport", "mlb", "--date", DAY,
                        "--fixture", str(path), "--out", str(out / "r")], cwd=str(ROOT), capture_output=True, text=True)
    assert r.returncode == 0, r.stderr[-2000:]
    return r.stdout, (out / "r" / f"grid_{DAY}.svg").read_text(encoding="utf-8")


def test_a_cancelled_and_a_postponed_game_draw_nothing_and_are_counted_nowhere(rendered):
    stdout, _ = rendered
    m = re.search(r"(\d+) on grid \S+ (\d+) TBA \S+ (\d+) omitted", stdout)   # the separator's encoding varies by console
    assert m and m.groups() == ("2", "0", "0"), stdout[-600:]


def test_a_scheduled_and_a_final_game_are_drawn(rendered):
    _, svg = rendered
    for name in ("RAYS", "YANKEES", "BLUE JAYS", "MARINERS"):
        assert re.search(name, svg, re.I), name


def test_neither_off_air_game_appears_anywhere_on_the_render(rendered):
    _, svg = rendered
    for name in ("BRAVES", "DODGERS", "PADRES", "BREWERS"):
        assert not re.search(name, svg, re.I), name
