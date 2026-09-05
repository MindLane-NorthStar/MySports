"""UFC from the Paramount+ "Sneak Peak" schedule page.

THE CARD RENDERS PLAIN. Joe, 2026-09-03, in the design of record: one plain card, **no segment
dividers or labels on the block and NO CBS partial-window overlay**, superseding the register's own
Q2. `segments[]` and `broadcasts.window_start/window_end` stay DATA for the tap-open detail panel.
So the assertions below are mostly about what is DELIBERATELY ABSENT.

WHAT THE PAGE DOES AND DOES NOT CARRY. It gives the MAIN CARD start and nothing earlier -
`docs/research/ufc.md` §1 names that as its weakness and §5 warns that early prelims can begin three
hours before. A convention-derived early-prelims time would put a wrong start on the grid for every
card, so `segments` is the empty array and the run says so.
"""
from __future__ import annotations

import hashlib
import sys
from datetime import date
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from adapters.ufc import cbs_windows, parse, parse_date, parse_time  # noqa: E402

SCHEDULE = ROOT / "tests" / "fixtures" / "paramountplus_ufc_2026.html"
PRESS = ROOT / "tests" / "fixtures" / "paramount_press_cbs.html"


@pytest.fixture(scope="module")
def rows():
    return parse(SCHEDULE.read_text(encoding="utf-8"), 2026)


def by_start(rows, iso):
    return next(r for r in rows if r["start_at"].startswith(iso))


# --------------------------------------------------------------------------- the schedule
def test_every_upcoming_card_parses(rows):
    """Nine, where docs/research/ufc.md §1 listed eight - the page gained the Oct 10 Fight Night
    after the doc was written, which is the page being the authority rather than the doc."""
    assert len(rows) == 9
    assert all(r["start_at"] and r["location_text"] for r in rows)


def test_past_events_are_not_parsed(rows):
    """The section below "Upcoming events" uses a different shape and is a different job."""
    assert all(r["start_at"] >= "2026-09-05" for r in rows)
    assert not any("324" in r["title"] or "325" in r["title"] for r in rows)


def test_the_doc_s_own_list_is_reproduced(rows):
    """docs/research/ufc.md §1: Sept 5 Paris 3 PM; Sept 12 Glendale 5 PM; Sept 19 UFC 331 LA 9 PM;
    Sept 26 APEX 6 PM; Oct 3 Salt Lake 9 PM; Oct 17 Edmonton 8 PM; Oct 24 Abu Dhabi 2 PM;
    Nov 7 APEX 5 PM."""
    got = {r["start_at"][:10]: (r["title"], r["location_text"]) for r in rows}
    assert got["2026-09-05"] == ("UFC Fight Night", "Paris, France")
    assert got["2026-09-12"] == ("Noche UFC", "Glendale, Arizona")
    assert got["2026-09-20"][0] == "UFC 331"          # 9 PM ET on the 19th
    assert got["2026-10-24"] == ("UFC 333", "Abu Dhabi, United Arab Emirates")


def test_the_title_and_the_headliner_are_split_as_the_design_of_record_asks(rows):
    """`title` = "UFC 331"; `subtitle` = the headliner. The card centres the title and prints the
    headliner beneath it in the brand tint."""
    r = by_start(rows, "2026-09-20")
    assert r["title"] == "UFC 331"
    assert r["subtitle"] == "Van vs. Pantoja 2"


def test_every_card_is_paramount_plus_and_nothing_else(rows):
    """docs/research/ufc.md §2: Paramount+ carries every event, whole. Nothing else is written
    unless a source states a CBS window."""
    for r in rows:
        assert [b["service_id"] for b in r["broadcasts"]] == ["Paramount+"]
        assert r["broadcasts"][0]["delivery_surface"] == "STREAMING"


def test_a_card_is_open_ended_and_six_hours_long(rows):
    """A card's end depends on how many fights go the distance - data/duration_defaults.json's own
    reasoning for the 360-minute default and the open end."""
    assert all(r["expected_duration_min"] == 360 for r in rows)
    assert all(r["open_ended"] is True for r in rows)


# --------------------------------------------------------------------------- what is absent
def test_segments_are_empty_and_never_invented(rows):
    """EMPTY, not null: programs.segments is `jsonb NOT NULL default '[]'` (0009), so the empty
    array is what the schema already means by "none recorded". A null fails the whole load, which is
    how this was found."""
    assert all(r["segments"] == [] for r in rows)


def test_no_cbs_row_is_written_because_no_source_states_one(rows):
    """The page says it in as many words on the Sept 5 card: "There is no pay-per-view or CBS
    simulcast." A window inferred from UFC 326's 8-10 PM precedent would be an invented broadcast."""
    assert not any(b["service_id"] == "CBS" for r in rows for b in r["broadcasts"])
    assert not any(r["_provenance"]["cbs_flagged"] for r in rows)


def test_press_express_is_read_and_reports_nothing_rather_than_guessing():
    found = cbs_windows(PRESS.read_text(encoding="utf-8"))
    assert found == [], "no UFC/CBS sentence on the recorded release page"


def test_no_odds_and_no_crew(rows):
    """Register §9 puts UFC moneylines under show_odds via The Odds API; the brief forbids adding a
    provider key tonight, so nothing is loaded and nothing is faked."""
    assert all(r["hosts_crew"] == [] for r in rows)
    assert all("odds" not in r for r in rows)


# --------------------------------------------------------------------------- the parsers
def test_a_date_reads_with_or_without_a_year():
    assert parse_date("Sept. 5, 2026", 2026) == date(2026, 9, 5)
    assert parse_date("Saturday, Sept. 12", 2026) == date(2026, 9, 12)
    assert parse_date("Saturday, Nov. 7", 2026) == date(2026, 11, 7)
    assert parse_date("", 2026) is None
    assert parse_date("Someday soon", 2026) is None


def test_a_time_reads_the_eastern_half_and_nothing_else():
    assert parse_time("9 PM ET/6 PM PT") == (21, 0)
    assert parse_time("2 PM ET/11 AM PT") == (14, 0)
    assert parse_time("11 AM ET/8 AM PT") == (11, 0)
    assert parse_time("Main Card: 3 PM ET/12 PM PT") == (15, 0)
    assert parse_time("TBA") is None


def test_a_card_with_no_usable_date_or_time_is_dropped(rows):
    """Better absent than at midnight. Every parsed row has both, so this is the guard rather than
    an observed case."""
    from adapters.ufc import to_program
    assert to_program({"title": "UFC 999: A vs B", "date": "TBA", "main_card": "9 PM ET"}, 2026) is None
    assert to_program({"title": "UFC 999: A vs B", "date": "Saturday, Dec. 5", "main_card": ""}, 2026) is None


# --------------------------------------------------------------------------- the recorded fetches
def test_the_recorded_pages_are_the_ones_the_adapter_was_written_against():
    assert hashlib.sha256(SCHEDULE.read_bytes()).hexdigest() == \
        "d1cdf2341e633938aa2ef05d1ea855d7a5cefe22fa8f4d0240722c118baca9e5"
    assert hashlib.sha256(PRESS.read_bytes()).hexdigest() == \
        "a39c269cb01ce9a28847f8afb3dc416da2755423530943d2e9230895eda39ce3"
