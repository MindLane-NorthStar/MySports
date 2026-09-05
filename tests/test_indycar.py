"""IndyCar 2026 from indycar.com, and the two traps this adapter walked into.

TRAP 1 - THE WRONG CROSS-CHECK. ESPN's `racing/irl` scoreboard carries BOTH a `leagues[0].calendar`
and per-date `events[]`, and they disagree with each other by a FIXED THREE HOURS. Verifying against
the calendar reported all 18 races as wrong and would have "corrected" a correct adapter into a
three-hour error across a whole season. The events are the truth; the module docstring carries the
measurements.

TRAP 2 - A NULL SERIES CANNOT BE A NATURAL KEY. NASCAR runs three series and carries one on every
row; IndyCar runs one and carries `series = null`, because register section 16 ruled that giving it a
value would make it look like a fourth NASCAR series. 0012's key is
`(sport, series, start_at, title)` and NULLs are distinct in a unique index, so every IndyCar row
looked new and a second load INSERTED - 18 races became 36. Migration 0015 is the fix and is asserted
here, because the property that broke is invisible in the adapter itself.
"""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from adapters.indycar import networks, parse, parse_start, verify  # noqa: E402

FIXTURE = ROOT / "tests" / "fixtures" / "indycar_2026_schedule.html"
ESPN = ROOT / "tests" / "fixtures" / "espn_racing_irl_2026.json"


@pytest.fixture(scope="module")
def rows():
    with open(FIXTURE, encoding="utf-8") as fh:
        return parse(fh.read(), 2026)


def by_title(rows, needle):
    return next(r for r in rows if needle in r["title"])


# --------------------------------------------------------------------------- the season
def test_the_whole_2026_season_parses(rows):
    """18 event cards carrying a 2026 race link. The doc says 17 races; the page lists 18 because
    Milwaukee is a doubleheader and the Indianapolis road course is separate from the 500."""
    assert len(rows) == 18
    assert all(r["start_at"] for r in rows), "every race has a start"
    assert len({r["_provenance"]["slug"] for r in rows}) == 18, "the megamenu repeats cards; dedupe"


def test_every_race_is_on_fox_or_fs1_and_fox_one_is_suppressed(rows):
    """docs/research/indycar.md section 2: every race on FOX, simulcast on FOX One. FOX One
    duplicates a feed the viewer already has, so the local-feed rule drops it (section 3)."""
    nets = sorted({b["service_id"] for r in rows for b in r["broadcasts"]})
    assert nets == ["FOX", "FS1"]
    assert not any("One" in b["service_id"] for r in rows for b in r["broadcasts"])


def test_no_series_is_written_because_indycar_runs_one(rows):
    """Register section 16 named the trap: a series value would make IndyCar a fourth series
    alongside NASCAR's Cup, O'Reilly and Truck."""
    assert all(r["series"] is None for r in rows)


def test_every_row_is_a_race_session_branded_indycar(rows):
    assert {r["program_type"] for r in rows} == {"race_session"}
    assert {r["sport"] for r in rows} == {"indycar"}
    assert {r["brand_key"] for r in rows} == {"indycar"}


def test_every_row_carries_its_own_race_page_as_provenance(rows):
    for r in rows:
        assert r["source_url"].startswith("https://www.indycar.com/Schedule/2026/")
        assert r["source_tier"] == "official_league_site"


# --------------------------------------------------------------------------- times
def test_the_page_states_its_zone_so_nothing_is_inferred():
    """Unlike cf.nascar.com, indycar.com writes `2:30 PM ET` - an explicit zone, not a naive stamp."""
    got = parse_start("Sep 6", "2:30 PM ET", 2026)
    assert got.astimezone(timezone.utc) == datetime(2026, 9, 6, 18, 30, tzinfo=timezone.utc)
    # EST, to prove it is a wall clock rather than a fixed offset
    got = parse_start("Mar 1", "12:00 PM ET", 2026)
    assert got.astimezone(timezone.utc) == datetime(2026, 3, 1, 17, 0, tzinfo=timezone.utc)


def test_a_card_with_no_time_is_dropped_rather_than_placed_at_midnight():
    assert parse_start("Sep 6", None, 2026) is None
    assert parse_start("Sep 6", "TBA", 2026) is None
    assert parse_start("Someday", "2:30 PM ET", 2026) is None


def test_the_finale_lands_where_espn_and_the_research_doc_both_put_it(rows):
    assert by_title(rows, "Monterey")["start_at"] == "2026-09-06T18:30:00.000Z"


def test_the_indy_500_takes_the_six_hour_window_the_research_doc_names(rows):
    """docs/research/indycar.md section 2: "Indy 500: six-hour window from 10 AM". That is why the
    page's 10:00 AM differs from ESPN's noon green flag, and why the duration is 360."""
    r = by_title(rows, "Indianapolis 500")
    assert r["start_at"] == "2026-05-24T14:00:00.000Z"        # 10:00 AM ET
    assert r["expected_duration_min"] == 360
    assert "six-hour window" in r["_provenance"]["duration"]


def test_every_race_is_open_ended(rows):
    """Cautions and red flags move the end, exactly as they do for NASCAR. Read from
    data/duration_defaults.json rather than restated."""
    assert all(r["open_ended"] is True for r in rows)


# --------------------------------------------------------------------------- the cross-check
def test_the_verifier_reads_events_and_never_the_calendar():
    """THE TRAP. ESPN's calendar startDate is a fixed +3h from its own event date; verifying against
    it reported 18 of 18 races wrong. This pins that the calendar is not consulted."""
    import ast
    import inspect

    import adapters.indycar as mod

    # The CODE, with the docstring removed - the docstring says "never leagues[0].calendar", which
    # is the point of the function and which a bare substring search reads as a violation.
    tree = ast.parse(inspect.getsource(mod.espn_events_on))
    fn = tree.body[0]
    if (fn.body and isinstance(fn.body[0], ast.Expr)
            and isinstance(fn.body[0].value, ast.Constant)):
        fn.body = fn.body[1:]
    code = ast.unparse(fn)
    assert "events" in code
    assert "calendar" not in code, "the calendar startDate is a fixed +3h and must not be read"


def test_the_verifier_reports_and_never_corrects():
    """A start that disagrees produces a LINE, not a different value."""
    rows_ = [{"title": "X", "start_at": "2026-09-06T18:30:00.000Z"}]
    notes = verify(rows_, lambda _d: ["2026-09-06T20:30Z"])
    assert len(notes) == 1 and "delta 2:00:00" in notes[0]
    assert rows_[0]["start_at"] == "2026-09-06T18:30:00.000Z", "the row is untouched"


def test_the_verifier_matches_the_closest_event_so_a_doubleheader_is_not_a_false_alarm():
    """Milwaukee runs two races on one day; comparing race 2 against `events[0]` reported a
    five-hour disagreement that was the verifier's fault rather than the data's."""
    rows_ = [{"title": "race 2", "start_at": "2026-08-30T22:00:00.000Z"}]
    notes = verify(rows_, lambda _d: ["2026-08-30T17:00Z", "2026-08-30T22:00Z"])
    assert notes == []


def test_a_network_failure_in_the_probe_never_fails_the_run():
    notes = verify([{"title": "X", "start_at": "2026-09-06T18:30:00.000Z"}],
                   lambda _d: "ERROR connection reset")
    assert len(notes) == 1 and "ERROR" in notes[0]


# --------------------------------------------------------------------------- migration 0015
def test_0015_makes_the_race_session_key_survive_a_null_series():
    sql = (ROOT / "db" / "migrations" / "0015_race_session_key_is_null_safe.sql").read_text(encoding="utf-8")
    assert "programs_race_session_key_uq" in sql
    assert "coalesce(series, '')" in sql
    assert "where program_type = 'race_session'" in sql
    # additive: 0012's index is kept
    assert "drop index" not in sql.lower()


def test_the_loader_conflicts_on_the_null_safe_key():
    src = (ROOT / "pipeline" / "load_programs.py").read_text(encoding="utf-8")
    conflict = src.split("CONFLICT = {")[1].split("}")[0]
    assert "coalesce(series, '')" in conflict, "a null series must not look like a new race"


# --------------------------------------------------------------------------- the recorded fetch
def test_the_recorded_page_is_the_one_the_adapter_was_written_against():
    """Tested against BYTES, so a silent site change shows up as a test failure rather than as a
    quiet drift in what gets loaded."""
    import hashlib
    h = hashlib.sha256(FIXTURE.read_bytes()).hexdigest()
    assert h == "30d34f7bf4a7d1c7d11b6ee11530827bb7cb2334ad468347619423f83cf08894"
    assert FIXTURE.stat().st_size == 361003


def test_the_espn_fixture_is_recorded_too():
    import hashlib
    h = hashlib.sha256(ESPN.read_bytes()).hexdigest()
    assert h == "82017228687c12dc4d193a383cd26baf47db2359ccb86b68138d964719224892"
    data = json.loads(ESPN.read_text(encoding="utf-8"))
    assert len(data["leagues"][0]["calendar"]) == 18
