"""WWE from wwe.com — the scope rulings, and the dual listing the research flagged.

WHAT IS PINNED HERE IS THE SCOPE, not the parser. Register §7 Q7 is "Raw, SmackDown, main-roster
PLEs. NXT dropped entirely", and the Premier Shows block lists NXT's slot right beside the rest
("Tuesdays at 8 ET/7 CT on The CW"), with AAA's TripleMania and a WWE/AAA/NXT crossover sitting in
the same events carousel as the PLEs. A parser that reads the page correctly and loads all of it is
a parser that broke a ruling, so the exclusions are what these assert.

THE DUAL LISTING. The block lists each PLE TWICE, once on "ESPN with the Unlimited Plan" and once on
"Netflix", for both Oct 10 and Nov 28. docs/research/wwe.md §2 reads Netflix as the international
carrier and marks it UNVERIFIED; the run's brief rules "load ESPN Unlimited only and put both dates
in the report". Both halves of that are asserted: the row, and the note.
"""
from __future__ import annotations

import hashlib
import sys
from datetime import date
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from adapters.wwe import build, events, is_main_roster, premier_shows  # noqa: E402

PREMIER = ROOT / "tests" / "fixtures" / "wwe_premier_shows.html"
EVENTS = ROOT / "tests" / "fixtures" / "wwe_events.html"


@pytest.fixture(scope="module")
def built():
    return build(PREMIER.read_text(encoding="utf-8"), EVENTS.read_text(encoding="utf-8"),
                 2026, date(2026, 9, 5), date(2026, 12, 31))


def rows_of(built, ptype):
    return [r for r in built[0] if r["program_type"] == ptype]


# --------------------------------------------------------------------------- the block
def test_the_premier_shows_block_yields_the_two_weekly_slots():
    block = premier_shows(PREMIER.read_text(encoding="utf-8"), 2026)
    assert block["slots"]["Monday"] == "Netflix"
    assert block["slots"]["Friday"] == "USA Network"


def test_the_block_also_names_nxts_slot_and_it_is_dropped(built):
    block = premier_shows(PREMIER.read_text(encoding="utf-8"), 2026)
    assert block["slots"].get("Tuesday") == "The CW", "NXT is on the page"
    titles = {r["title"] for r in built[0]}
    assert not any("NXT" in t for t in titles), "and it must not be loaded"
    assert any("NXT" in n for n in built[1]), "and the drop is reported, not silent"


def test_the_block_carries_the_dated_premium_live_events():
    block = premier_shows(PREMIER.read_text(encoding="utf-8"), 2026)
    dates = {d for d, _h, _m, _p in block["dated"]}
    assert date(2026, 9, 6) in dates      # SNME
    assert date(2026, 10, 10) in dates    # Money in the Bank
    assert date(2026, 11, 28) in dates    # Survivor Series: WarGames


def test_an_evening_hour_with_no_meridiem_reads_as_pm():
    """The block writes "8 ET/5 PT" with no AM/PM. Its own PT twin proves 8 is the evening."""
    block = premier_shows(PREMIER.read_text(encoding="utf-8"), 2026)
    hours = {h for _d, h, _m, _p in block["dated"]}
    assert hours and all(h >= 12 for h in hours)


# --------------------------------------------------------------------------- weekly shows
def test_every_monday_and_friday_through_year_end_gets_exactly_one_show(built):
    weekly = rows_of(built, "weekly_show")
    raw = [r for r in weekly if r["title"] == "Monday Night Raw"]
    sd = [r for r in weekly if r["title"] == "Friday Night SmackDown"]
    assert len(raw) == 17 and len(sd) == 16
    assert len({r["start_at"] for r in raw}) == 17, "no duplicate air date"
    assert len({r["start_at"] for r in sd}) == 16


def test_raw_is_netflix_and_smackdown_is_usa(built):
    weekly = rows_of(built, "weekly_show")
    for r in weekly:
        want = "Netflix" if r["title"] == "Monday Night Raw" else "USA Network"
        assert [b["service_id"] for b in r["broadcasts"]] == [want]


def test_a_weekly_show_has_a_fixed_end(built):
    """docs/research/wwe.md §4: Raw and SmackDown are three hours, fixed. Only PLEs run long."""
    assert all(r["open_ended"] is False for r in rows_of(built, "weekly_show"))
    assert all(r["expected_duration_min"] == 180 for r in rows_of(built, "weekly_show"))


def test_a_venue_is_carried_where_the_events_page_has_one_and_never_invented(built):
    weekly = rows_of(built, "weekly_show")
    withv = [r for r in weekly if r["location_text"]]
    assert len(withv) == 1, "only the Mexico City Raw is sited on the recorded page"
    assert withv[0]["location_text"] == "Mexico City, MEX"
    assert all(r["location_text"] is None for r in weekly if r not in withv)


# --------------------------------------------------------------------------- PLEs
def test_the_three_premium_live_events_load_with_their_names_and_venues(built):
    ples = {r["title"]: r for r in rows_of(built, "special_event")}
    assert set(ples) == {"Sunday Night's Main Event", "Money in the Bank",
                         "Survivor Series: WarGames"}
    assert ples["Money in the Bank"]["location_text"] == "New Orleans, LA"
    assert ples["Survivor Series: WarGames"]["location_text"] == "Houston, TX"
    assert ples["Sunday Night's Main Event"]["location_text"] == "Atlanta, GA"


def test_snme_is_on_peacock_and_the_other_two_on_espn_unlimited(built):
    """Register §8: PLEs are ESPN Unlimited EXCEPT Saturday and Sunday Night's Main Event."""
    ples = {r["title"]: [b["service_id"] for b in r["broadcasts"]]
            for r in rows_of(built, "special_event")}
    assert ples["Sunday Night's Main Event"] == ["Peacock"]
    assert ples["Money in the Bank"] == ["ESPN Unlimited"]
    assert ples["Survivor Series: WarGames"] == ["ESPN Unlimited"]


def test_the_netflix_dual_listing_is_not_loaded_and_is_reported(built):
    rows, notes = built
    services = {b["service_id"] for r in rows if r["program_type"] == "special_event"
                for b in r["broadcasts"]}
    assert "Netflix" not in services, "the Netflix twin of a PLE must not become a second row"
    dual = [n for n in notes if "dual listing" in n]
    assert any("2026-10-10" in n for n in dual)
    assert any("2026-11-28" in n for n in dual)


def test_a_ple_is_open_ended(built):
    assert all(r["open_ended"] is True for r in rows_of(built, "special_event"))


# --------------------------------------------------------------------------- scope
def test_nothing_outside_the_main_roster_is_loaded(built):
    rows, notes = built
    titles = " ".join(r["title"] for r in rows).lower()
    for banned in ("triplemania", "worlds collide", "nxt"):
        assert banned not in titles
    assert any("not main-roster" in n for n in notes), "and the drops are named"


def test_the_main_roster_test_is_a_rule_not_a_list():
    assert is_main_roster("Money in the Bank")
    assert is_main_roster("Survivor Series: WarGames")
    assert not is_main_roster("TripleMania 34 - Night 1")
    assert not is_main_roster("WWE/AAA/NXT Worlds Collide")
    assert not is_main_roster("NXT Deadline")


def test_no_crew_is_written(built):
    """docs/research/wwe.md §6: WWE crews are REPORTED, not announced, and the design of record's
    crew tier takes announcements. §17's hand-curation amendment is GameDay and Big Noon only."""
    assert all(r["hosts_crew"] == [] for r in built[0])


# --------------------------------------------------------------------------- the recorded fetches
def test_the_recorded_pages_are_the_ones_the_adapter_was_written_against():
    assert hashlib.sha256(PREMIER.read_bytes()).hexdigest() == \
        "c8978863137f3495e4967834bfd370a96608fbb512eabe4edb2fc510403736c9"
    assert hashlib.sha256(EVENTS.read_bytes()).hexdigest() == \
        "2770a36f987b478e5869455a42c9e03586d90e7778b7464a9e0d71b97bab09d6"


def test_the_events_page_parses_to_named_dated_triples():
    got = events(EVENTS.read_text(encoding="utf-8"), 2026)
    assert len(got) >= 6
    assert all(e["title"] and e["date"] for e in got)
