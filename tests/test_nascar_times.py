"""The cf.nascar.com feed publishes NAIVE timestamps, and they are Eastern.

WHAT WENT WRONG. `race_date` reads `"2026-09-06T17:00:00"` with no zone, and
`adapters.common.parse_iso` stamps a naive value UTC - so prompt 47 loaded all 98 2026 races FOUR
HOURS EARLY. The Cook Out Southern 500 sat on the grid at 1:00 PM instead of 5:00 PM, and the first
thing rendering-contract v1.7 puts in front of a reader is that race.

HOW IT WAS ESTABLISHED, because "naive means local" is a guess until it is measured. Six 2026 Cup
races were read back from ESPN's `racing/nascar-premier` scoreboard, which publishes real UTC. Five
agree with the Eastern reading to the minute, INCLUDING the Nov 8 championship race, which falls in
EST - so this is a wall clock and not a fixed -4 offset. The numbers are in the adapter's docstring.

The sixth, the DAYTONA 500, is a source disagreement rather than a zone question - cf.nascar.com
says 14:30 ET and ESPN says 13:30 ET - and it is pinned here as a disagreement so that a later
session does not "fix" the timezone rule to chase it.
"""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from adapters.nascar import build, race_start, to_program  # noqa: E402

FIXTURE = ROOT / "tests" / "fixtures" / "nascar_2026_cup.json"


def cup_races():
    with open(FIXTURE, encoding="utf-8") as fh:
        return json.load(fh)


def by_title(rows, needle):
    return next(r for r in rows if needle in r["title"])


# --------------------------------------------------------------------------- the reading itself
def test_a_naive_feed_time_is_eastern_not_utc():
    """EDT: 17:00 in the feed is 21:00Z, which is what ESPN publishes for the Southern 500."""
    got = race_start("2026-09-06T17:00:00")
    assert got.astimezone(timezone.utc).isoformat() == "2026-09-06T21:00:00+00:00"


def test_the_reading_is_a_wall_clock_and_not_a_fixed_offset():
    """EST: 15:00 in the feed is 20:00Z (UTC-5), and ESPN publishes 20:00Z for the finale.

    A fixed -4 offset would give 19:00Z. This is the assertion that tells the two apart.
    """
    got = race_start("2026-11-08T15:00:00")
    assert got.astimezone(timezone.utc).isoformat() == "2026-11-08T20:00:00+00:00"


def test_a_zoned_feed_value_is_trusted_as_written():
    """If the feed ever starts publishing an offset, the guessing stops that day, not a day later."""
    got = race_start("2026-09-06T21:00:00+00:00")
    assert got == datetime(2026, 9, 6, 21, 0, tzinfo=timezone.utc)


def test_an_unusable_value_is_none_rather_than_a_guess():
    assert race_start(None) is None
    assert race_start("") is None
    assert race_start("not a date") is None


# --------------------------------------------------------------------------- through the adapter
def test_the_southern_500_lands_at_five_pm_eastern():
    programs = build(cup_races(), "cup")
    race = by_title(programs, "Southern 500")
    assert race["start_at"] == "2026-09-06T21:00:00.000Z"


def test_every_cup_race_carries_open_ended():
    """A race END is not knowable in advance - cautions, red flags and rain move it. The value is
    read from data/duration_defaults.json (`race_session.open_ended_default`), never restated."""
    programs = build(cup_races(), "cup")
    assert programs
    assert all(p["open_ended"] is True for p in programs)


def test_the_daytona_500_disagreement_is_recorded_not_smoothed_over():
    """cf.nascar.com 14:30 ET -> 19:30Z. ESPN says 18:30Z. ONE HOUR, ONE RACE.

    Pinned so a later session reading the two sources side by side does not conclude the timezone
    rule is wrong and re-break the other 97.
    """
    programs = build(cup_races(), "cup")
    race = by_title(programs, "DAYTONA 500")
    assert race["start_at"] == "2026-02-15T19:30:00.000Z"


def test_a_race_with_no_date_is_dropped_rather_than_placed_at_epoch():
    assert to_program({"race_name": "Nowhere 400", "race_date": None}, "cup") is None
