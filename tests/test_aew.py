"""AEW — and the honest admission that the authority could not be reached.

`docs/research/aew.md` §1 and §5 are both emphatic that the **WBD monthly HBO Max schedule is the
ONLY authority** for AEW's night and network, because Collision moves both: it aired on TBS rather
than TNT on Aug 22 and moved to Thursdays twice in July. The brief's fallback order is the WBD
schedule, else a trade republication, else the slot default with `source_tier` saying so.

**The third path ran**, and these tests are mostly about making that legible rather than invisible.
`press.wbd.com` answers 200 but carries no AEW content at its root; neither pwmania.com nor
ewrestlingnews.com had republished a monthly schedule. So every generated episode is tiered
`slot_default`, the September exceptions the research doc DID record are tiered `research_document`,
and what could not be loaded is written down in `data/aew_2026_schedule.json` rather than dropped.

THE SLOTS ARE SOURCED. allelitewrestling.com states both verbatim, the page is recorded, and the
adapter RE-READS it on every run to catch the file going stale - which is the failure a slot default
invites and the reason `confirm_slots` exists at all.
"""
from __future__ import annotations

import hashlib
import json
import sys
from datetime import date
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from adapters.aew import build, confirm_slots, schedule_doc  # noqa: E402

SLOTS = ROOT / "tests" / "fixtures" / "aew_slots.html"


@pytest.fixture(scope="module")
def built():
    return build(date(2026, 9, 5), date(2026, 12, 31), SLOTS.read_text(encoding="utf-8"))


def on(rows, iso):
    return [r for r in rows if r["start_at"].startswith(iso)]


# --------------------------------------------------------------------------- the slots
def test_aews_own_site_states_both_slots_and_the_adapter_reads_them():
    got = confirm_slots(SLOTS.read_text(encoding="utf-8"))
    assert got["AEW Dynamite"] == {"weekday": "Wednesday", "hour_et": "8", "linear": "TBS"}
    assert got["AEW Collision"] == {"weekday": "Saturday", "hour_et": "8", "linear": "TNT"}


def test_the_file_and_the_site_agree_today(built):
    """A DRIFT note is what a stale slot default looks like, and there is none."""
    _rows, notes = built
    assert not [n for n in notes if n.startswith("DRIFT")], notes


def test_a_site_that_stops_saying_it_produces_a_note_rather_than_silence():
    _rows, notes = build(date(2026, 9, 5), date(2026, 9, 30), "<html>nothing here</html>")
    assert any("no longer states" in n for n in notes)


# --------------------------------------------------------------------------- which path ran
def test_every_generated_episode_says_it_is_a_slot_default(built):
    rows, _notes = built
    tiers = {r["source_tier"] for r in rows}
    assert tiers == {"slot_default", "research_document"}
    assert sum(1 for r in rows if r["source_tier"] == "slot_default") == 33
    assert sum(1 for r in rows if r["source_tier"] == "research_document") == 2


def test_the_schedule_file_says_out_loud_that_the_wbd_authority_was_unreachable():
    doc = schedule_doc()
    about = doc["_about"].lower()
    assert "only authority" in about
    assert "press.wbd.com" in about
    assert "slot default" in about


# --------------------------------------------------------------------------- the September list
def test_september_matches_the_research_docs_list_exactly(built):
    """docs/research/aew.md §2: Dynamite Wednesdays on TBS, Collision Saturdays on TNT, All Out week
    moving Collision to one hour at 10 PM Wednesday, and the Tailgate special on Sat Sept 26."""
    rows = [r for r in built[0] if r["start_at"] < "2026-10-01"]
    got = [(r["title"], r["start_at"]) for r in rows]
    assert got == [
        ("AEW Collision", "2026-09-06T00:00:00.000Z"),               # Sat Sept 5, 8 PM ET
        ("AEW Dynamite", "2026-09-10T00:00:00.000Z"),                # Wed Sept 9
        ("AEW Collision", "2026-09-13T00:00:00.000Z"),               # Sat Sept 12
        ("AEW Dynamite", "2026-09-17T00:00:00.000Z"),                # Wed Sept 16
        ("AEW Collision", "2026-09-20T00:00:00.000Z"),               # Sat Sept 19
        ("AEW Dynamite", "2026-09-24T00:00:00.000Z"),                # Wed Sept 23
        ("AEW Collision", "2026-09-24T02:00:00.000Z"),               # Wed Sept 23, 10 PM - the move
        ("AEW Collision: Tailgate to All Out", "2026-09-26T23:00:00.000Z"),   # Sat Sept 26, 7 PM
    ]


def test_the_all_out_week_move_is_one_hour_on_tbs_and_says_where_it_came_from(built):
    moved = on(built[0], "2026-09-24T02")[0]
    assert moved["expected_duration_min"] == 60
    assert moved["broadcasts"][0]["service_id"] == "TBS", "it follows Dynamite, so it is on TBS"
    assert moved["source_tier"] == "research_document"
    assert "All Out week" in moved["_provenance"]["note"]


def test_the_regular_saturday_that_week_is_suppressed_not_doubled(built):
    rows, notes = built
    assert not [r for r in rows if r["start_at"].startswith("2026-09-27T00")], \
        "the Saturday Collision that week IS the Tailgate special"
    assert any("suppressed" in n for n in notes)


# --------------------------------------------------------------------------- networks
def test_the_linear_row_is_primary_and_hbo_max_is_the_chip(built):
    """docs/research/aew.md §2: HBO Max simulcasts the linear feed, so the grid shows TBS or TNT and
    chips HBO Max. Both rows exist; only the linear one is primary."""
    for r in built[0]:
        assert len(r["broadcasts"]) == 2
        linear, simulcast = r["broadcasts"]
        assert linear["is_primary"] is True
        assert linear["delivery_surface"] == "LINEAR"
        assert linear["service_id"] in ("TBS", "TNT")
        assert simulcast["service_id"] == "HBO Max"
        assert simulcast["is_primary"] is False


def test_dynamite_is_tbs_and_the_saturday_collisions_are_tnt(built):
    for r in built[0]:
        if r["title"] == "AEW Dynamite":
            assert r["broadcasts"][0]["service_id"] == "TBS"
        elif r["title"] == "AEW Collision" and r["start_at"] != "2026-09-24T02:00:00.000Z":
            assert r["broadcasts"][0]["service_id"] == "TNT"


# --------------------------------------------------------------------------- what is excluded
def test_the_ppvs_and_zero_hour_are_excluded_and_the_reason_is_recorded(built):
    rows, notes = built
    titles = " ".join(r["title"] for r in rows).lower()
    assert "all out" in titles, "the TAILGATE special is in scope - it is free TV on TNT"
    assert "zero hour" not in titles
    assert any("Zero Hour" in n and "NOT LOADED" in n for n in notes)
    assert any("PPV" in n and "NOT LOADED" in n for n in notes)


def test_countdown_is_reported_as_a_source_gap_not_a_scope_decision(built):
    """A linear pre-show IS in scope; the doc gives Countdown's time but not its network, and a
    network typed from memory is the invented fact this run does not make."""
    _rows, notes = built
    n = next(x for x in notes if "Countdown" in x)
    assert "NOT LOADED" in n and "NOT the network" in n


def test_no_crew_and_no_open_ended_show(built):
    assert all(r["hosts_crew"] == [] for r in built[0])
    assert all(r["open_ended"] is False for r in built[0])


# --------------------------------------------------------------------------- the recorded fetch
def test_the_recorded_page_is_the_one_the_slots_were_read_from():
    assert hashlib.sha256(SLOTS.read_bytes()).hexdigest() == \
        "1800f906d9db3633d90a60f1f1a1b7fa99d60c8d33b6d8deaaf94027a00a881a"


def test_every_exception_and_omission_carries_a_citation():
    doc = schedule_doc()
    for ex in doc["exceptions"]:
        assert ex["source"], ex
    for nl in doc["not_loaded"]:
        assert nl["source"] and nl["why"], nl
    assert json.dumps(doc)  # round-trips
