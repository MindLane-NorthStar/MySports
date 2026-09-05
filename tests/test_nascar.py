"""adapters/nascar.py against recorded bytes.

WHAT THIS BUYS, stated once so nobody reads more into it: the app renders `games`, a race is a
`program` with no `games` row, and NOTHING in web/ renders a program until rendering-contract v1.7.
This adapter makes the data and the mapping exist. The Racing chip's empty state stays honest.

The three fixtures are the real cf.nascar.com feeds for 2026, recorded on 2026-09-05, so the parser
is tested against bytes the way the other four adapters are.
"""

import json
from pathlib import Path

import pytest

from adapters.nascar import SERIES, SERIES_ID, build, duration_min, to_program

ROOT = Path(__file__).resolve().parents[1]
FIX = ROOT / "tests" / "fixtures"

EXPECTED = {"cup": 40, "oreilly": 33, "truck": 25}


def races(series):
    with open(FIX / ("nascar_2026_%s.json" % series), encoding="utf-8") as fh:
        return json.load(fh)


@pytest.mark.parametrize("series,count", sorted(EXPECTED.items()))
def test_every_race_session_becomes_one_program(series, count):
    rows = build(races(series), series)
    assert len(rows) == count
    assert len(rows) == len(races(series)), "no race session may be silently dropped"


def test_race_sessions_only_not_the_nested_weekend_schedule():
    """Register section 7 Q2. Each entry carries a nested `schedule` of haulers, practice and
    qualifying - 428 of them for Cup alone. Prompt 17's "113 entries" counted those. One program per
    RACE, so 2026 is 98 programs and not 964."""
    total_nested = sum(len(r.get("schedule") or []) for r in races("cup"))
    assert total_nested > 400, "the fixture really does carry the nested sessions"
    assert len(build(races("cup"), "cup")) == 40


def test_the_row_matches_migration_0009():
    row = build(races("cup"), "cup")[0]
    assert row["sport"] == "nascar"
    assert row["program_type"] == "race_session"
    assert row["series"] in ("cup", "oreilly", "truck"), "programs_series_ck"
    assert row["title"]
    assert row["start_at"].endswith("Z")
    assert isinstance(row["expected_duration_min"], int) and row["expected_duration_min"] > 0
    assert "game_id" not in row, "a race session has no game"


def test_the_series_vocabulary_is_the_schema_s():
    assert sorted(SERIES.values()) == ["cup", "oreilly", "truck"]
    assert SERIES_ID["cup"] == 1


def test_duration_prefers_the_feed_and_records_which_it_used():
    m, prov = duration_min({"total_race_time": "2:20:15"}, "cup")
    assert m == 140 and prov == "feed:total_race_time"
    m, prov = duration_min({"total_race_time": "0"}, "cup")
    assert m == 210 and prov.startswith("duration_defaults")
    m, prov = duration_min({}, "truck")
    assert m == 150 and prov.startswith("duration_defaults")


def test_a_race_with_no_date_is_skipped_not_guessed():
    assert to_program({"race_name": "x", "race_date": None}, "cup") is None
    assert to_program({"race_name": "", "race_date": "2026-02-04T18:00:00"}, "cup") is None


def test_the_broadcaster_is_carried_but_not_emitted_as_a_broadcast_row():
    """game_broadcasts requires a game_id and has NO program_id, so a program cannot own a broadcast
    row without DDL. The value travels in provenance so the migration, when it lands, has the data
    waiting rather than needing a re-fetch."""
    row = build(races("cup"), "cup")[0]
    assert row["_provenance"]["television_broadcaster"]
    assert "service_id" not in row and "delivery_surface" not in row


def test_exhibitions_are_emitted_and_labelled():
    """race_type_id 2 is the Clash, the Duels and the All-Star race. They are race sessions, so they
    are emitted; the field is carried so a later ruling can separate them without a re-fetch."""
    rows = build(races("cup"), "cup")
    kinds = {r["_provenance"]["race_type_id"] for r in rows}
    assert 1 in kinds and 2 in kinds
