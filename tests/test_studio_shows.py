"""The studio-show registry, its instances, and what the sources would and would not give.

SCOPE, register §7 Q4: pregame and postgame BOOKENDS on the game's network. No halftime, no daily
talk. A studio show never gets a chip (§9).

THE HARD PART OF THIS ITEM WAS NEVER THE PARSING. `docs/research/studio-shows.md` §2 says it out
loud: "No structured source anywhere. Locations and crews live in press releases." So most of what is
asserted here is about the line between what a source stated and what a run would otherwise have had
to invent - which show has a slot, which week has a site, which seat has a name.

WHAT THE SOURCES ACTUALLY GAVE, measured on the day:
  * espnpressroom.com is CLEAN and gave MORE than the doc promised - the Week 1 release carries
    GameDay's site, its window, its networks AND its announced nine-member 2026 on-air team. An
    announcement outranks the hand-curation register §17 permits, so that is what was used.
  * The GameDay landing page's one table is a HISTORICAL January bowl table, not the weekly
    Date/Site/Game table the doc described. The weekly site is prose in each week's own release.
  * foxsports.com Press Pass answers 200 on three paths with ZERO tables and zero occurrences of
    "Big Noon", because it is JS-rendered. So Big Noon's site is `tba` and its crew is TBA - and
    neither is guessed.
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

from pipeline.load_studio_shows import (  # noqa: E402
    ANCHORS, air_dates, crew_names, crews, gameday_site, registry,
)

RELEASE = ROOT / "tests" / "fixtures" / "espn_gameday_release.html"


# --------------------------------------------------------------------------- the registry
def test_every_registered_show_has_a_complete_slot():
    """A show without a weekday, a start and a network cannot be generated per air date. The four
    the doc names without one are in `_not_loaded`, with the reason."""
    for s in registry()["shows"]:
        assert s["weekday"] in range(7), s["show_key"]
        assert s["slot_start_et"], s["show_key"]
        assert s["network_key"], s["show_key"]
        assert s["bookend"] in ("pre", "post"), s["show_key"]
        assert s["source_url"] and s["source_note"], s["show_key"]
        assert date.fromisoformat(s["active_from"]) < date.fromisoformat(s["active_to"])


def test_the_shows_the_brief_named_but_the_doc_did_not_verify_are_recorded_not_dropped():
    """The brief lists the Prime TNF pregame, the Netflix pregames and the NASCAR pre/post shows.
    `docs/research/studio-shows.md` §1's "Verified 2026 slots" carries no usable slot for any of
    them, and the brief's own rule is "Nothing not in the doc".

    SUNDAY NFL COUNTDOWN WAS THE FOURTH AND IS NO LONGER HERE (prompt 86): ESPN's release stated its
    slot and §1 now carries it, so it moved to `shows` - pinned by the Countdown tests below."""
    doc = registry()
    named = " ".join(n["show"] for n in doc["_not_loaded"])
    for missing in ("Prime Video TNF pregame", "Netflix NFL pregames", "NASCAR RaceDay"):
        assert missing in named, missing
    for n in doc["_not_loaded"]:
        assert len(n["why"]) > 40, "a drop needs a reason, not a shrug"


def test_the_two_fox_shows_are_two_cards_not_one():
    """docs/research/events-summary-2.md §6's recommendation, taken: FOX NFL Kickoff and FOX NFL
    Sunday are different shows with different hosts."""
    keys = {s["show_key"] for s in registry()["shows"]}
    assert {"foxnflkickoff", "foxnflsunday"} <= keys


def test_every_anchor_rule_resolves_and_every_query_has_its_rule():
    """A rule in prose that nothing implements is a rule nobody applies - and a query with no prose
    is one nobody can read. So the two agree in BOTH directions.

    A NULL RULE IS THE SCHEMA'S OWN WORD FOR A STANDALONE SHOW (0013: "Null = standalone, and the
    show renders at its slot on its own row"). Until prompt 86 every show had an anchor, so this test
    required one; Sunday NFL Countdown is the first standalone show, and a null rule with no ANCHORS
    entry is the only shape it may take."""
    shows = registry()["shows"]
    for s in shows:
        if s["anchor_rule"] is None:
            assert s["show_key"] not in ANCHORS, "%s is standalone but has a query" % s["show_key"]
        else:
            assert s["anchor_rule"], s["show_key"]
            assert s["show_key"] in ANCHORS, "%s has prose but no query" % s["show_key"]
    assert set(ANCHORS) <= {s["show_key"] for s in shows}, "a query for a show nobody registered"


# --------------------------------------------------------------------------- Sunday NFL Countdown
#
# PROMPT 86. The slot is ESPN's own: "Sunday NFL Countdown (10 a.m.-1 p.m., ESPN)", season debut
# Sunday, Sept. 13 - the Super Bowl LXI season release, read 2026-09-10.
def _countdown():
    return next(s for s in registry()["shows"] if s["show_key"] == "sundaynflcountdown")


def test_sunday_nfl_countdown_is_registered_and_no_longer_held_out():
    doc = registry()
    assert "sundaynflcountdown" in {s["show_key"] for s in doc["shows"]}
    assert not any("Sunday NFL Countdown" in n["show"] for n in doc["_not_loaded"])
    assert len(doc["shows"]) == 8


def test_countdown_airs_on_sundays_from_sept_13_at_ten_for_three_hours():
    """ISO weekday 6 is Sunday (0013: "0=Monday .. 6=Sunday"), and `date.weekday()` agrees. The
    first air date is pinned too, because a wrong weekday still yields weekly dates - just the wrong
    ones - and "every date is the same weekday" would pass for any weekday at all."""
    show = _countdown()
    days = list(air_dates(show, date(2026, 9, 1), date(2027, 1, 31)))
    assert days[0] == date(2026, 9, 13), "the season debut"
    assert all(d.weekday() == 6 for d in days), "Sundays only"
    assert days[-1] == date(2027, 1, 3)
    assert show["slot_start_et"] == "10:00"
    assert show["duration_min"] == 180, "a STATED window, not the type default"


def test_countdown_is_standalone_so_no_game_can_shorten_a_published_window():
    """ESPN does carry the occasional Sunday NFL game. An ANCHORS entry would let the bookend rule
    cut the 10 a.m.-1 p.m. window ESPN published down to that game's kickoff."""
    assert _countdown()["anchor_rule"] is None
    assert "sundaynflcountdown" not in ANCHORS


def test_every_studio_brand_resolves_to_art_that_is_on_disk():
    """THE GUARD THAT WOULD HAVE CAUGHT A BRAND KEY POINTING AT NOTHING. The show key is
    `sundaynflcountdown` and the brand key is `nflcountdown` - the name the art, the manifest entry
    and the derived colour all hang off. An unknown key does not fail anywhere else: the app falls
    back to a neutral brand and the card silently loses its mark."""
    with open(ROOT / "data" / "brands.json", encoding="utf-8") as fh:
        brands = json.load(fh)["brands"]
    for s in registry()["shows"]:
        brand = brands.get(s["brand_key"])
        assert brand, "%s: brand_key %r is not in data/brands.json" % (s["show_key"], s["brand_key"])
        assert brand.get("mark_dark"), s["show_key"]
        art = ROOT / "web" / "public" / brand["mark_dark"].lstrip("/")
        assert art.is_file(), "%s: %s is not on disk" % (s["show_key"], art)
    assert _countdown()["brand_key"] == "nflcountdown"


def test_the_source_findings_are_recorded_in_the_file_itself():
    findings = {f["source"]: f for f in registry()["_findings"]}
    assert "foxsports.com Press Pass" in findings
    assert "CONTENT-EMPTY" in findings["foxsports.com Press Pass"]["result"]


# --------------------------------------------------------------------------- air dates
def test_instances_fall_on_the_shows_own_weekday_inside_its_own_window():
    show = next(s for s in registry()["shows"] if s["show_key"] == "gameday")
    days = list(air_dates(show, date(2026, 8, 1), date(2026, 12, 31)))
    assert days, "GameDay has a season"
    assert all(d.weekday() == 5 for d in days), "Saturdays only"
    assert days[0] >= date.fromisoformat(show["active_from"])
    assert days[-1] <= date.fromisoformat(show["active_to"])


def test_a_window_outside_the_range_yields_nothing_rather_than_throwing():
    show = next(s for s in registry()["shows"] if s["show_key"] == "mnfcountdown")
    assert list(air_dates(show, date(2026, 1, 1), date(2026, 2, 1))) == []


# --------------------------------------------------------------------------- the GameDay site
def test_the_site_is_parsed_from_the_release_prose_not_from_a_table():
    got = gameday_site(RELEASE.read_text(encoding="utf-8"), 2026)
    assert got == (date(2026, 9, 5), "Baton Rouge, LA")


def test_a_release_with_no_site_or_no_date_yields_nothing_rather_than_half_an_answer():
    assert gameday_site("<p>GameDay airs Saturday, Sept. 5</p>", 2026) is None
    assert gameday_site("<p>live from Baton Rouge, Louisiana.</p>", 2026) is None
    assert gameday_site("", 2026) is None


def test_the_recorded_release_is_the_one_the_site_was_read_from():
    assert hashlib.sha256(RELEASE.read_bytes()).hexdigest() == \
        "7ba8286aff94204599852727415d248fd9fee0f676abd1dd94e01d35077d0385"


# --------------------------------------------------------------------------- crews
def test_gamedays_crew_is_an_announcement_with_a_source_on_every_name():
    """Register §17 permits hand-curation for this show. ESPN announced the nine-member team, which
    is a better source than curation, so that is what was used - and every seat cites it."""
    doc = crews()["crews"]["gameday"]
    assert len(doc["crew"]) == 9
    for c in doc["crew"]:
        assert c["name"] != "TBA"
        assert c["source_url"], c["name"]
        assert "espnpressroom.com" in c["source_url"]
    assert "Rece Davis" == doc["crew"][0]["name"], "the host leads the ordered run"


def test_big_noons_seats_are_TBA_because_no_source_machine_reads():
    doc = crews()["crews"]["bignoon"]
    assert all(c["name"] == "TBA" for c in doc["crew"])
    assert "JS-rendered" in doc["_source"]


def test_a_tba_seat_never_reaches_a_card():
    assert crew_names("gameday", crews())[0] == "Rece Davis"
    assert crew_names("bignoon", crews()) == []
    assert crew_names("no-such-show", crews()) == []


def test_no_other_show_has_a_curated_crew():
    """§17's amendment is GameDay and Big Noon ONLY; every other show's crew stays out of the
    automated path."""
    assert set(crews()["crews"]) == {"gameday", "bignoon"}
    for s in registry()["shows"]:
        if s["show_key"] not in ("gameday", "bignoon"):
            assert crew_names(s["show_key"], crews()) == []


# --------------------------------------------------------------------------- the generated rows
@pytest.fixture(scope="module")
def rows():
    """Generated OFFLINE - no database, so no anchor is found and the slot duration stands. That is
    the un-anchored branch, which is a real state and worth exercising on its own."""
    from pipeline.db import DB
    from pipeline.load_studio_shows import build
    db = DB(str(ROOT / "artifacts" / "sql" / "_studio_test.sql"))
    got, notes = build(db, date(2026, 8, 29), date(2026, 12, 31))
    return got, notes


def test_the_registry_generates_one_row_per_show_per_air_date(rows):
    got, _notes = rows
    seen = {(r["_studio"]["show_key"], r["_studio"]["air_date"]) for r in got}
    assert len(seen) == len(got), "no show airs twice on one date"
    assert {r["_studio"]["show_key"] for r in got} == {s["show_key"] for s in registry()["shows"]}


def test_a_studio_show_carries_its_bookend_and_no_series(rows):
    got, _notes = rows
    for r in got:
        assert r["program_type"] == "studio_show"
        assert r["bookend"] in ("pre", "post")
        assert r["series"] is None
        assert r["brand_key"]


def test_only_the_week_with_a_release_gets_a_subtitle(rows):
    """studio-city display is road-only (docs/research/events-summary-2.md §6), so a show with no
    announced site prints nothing at all rather than a studio city."""
    got, _notes = rows
    sited = [r for r in got if r["subtitle"]]
    assert len(sited) == 1
    assert sited[0]["subtitle"] == "Live from Baton Rouge, LA"
    assert sited[0]["_studio"]["site_tier"] == "announced"
    assert all(r["_studio"]["site_tier"] == "tba" for r in got if r is not sited[0])


def test_an_unanchored_show_keeps_its_slot_duration_and_says_so(rows):
    got, notes = rows
    assert any("no anchor" in n for n in notes)
    gameday = [r for r in got if r["_studio"]["show_key"] == "gameday"]
    assert all(r["expected_duration_min"] == 180 for r in gameday)
    assert all(r["_studio"]["anchor_game_id"] is None for r in got), "offline, so no anchor"


def test_a_post_bookend_would_be_open_ended_and_a_pre_one_is_not(rows):
    got, _notes = rows
    assert all(r["open_ended"] is False for r in got), "every registered show today is a pre-show"
    assert all(r["bookend"] == "pre" for r in got)


def test_the_network_is_the_shows_own_and_the_simulcast_is_secondary(rows):
    got, _notes = rows
    by_key = {s["show_key"]: s for s in registry()["shows"]}
    for r in got:
        s = by_key[r["_studio"]["show_key"]]
        assert r["broadcasts"][0]["service_id"] == s["network_key"]
        assert r["broadcasts"][0]["is_primary"] is True
        if s.get("simulcast"):
            assert r["broadcasts"][1]["service_id"] == s["simulcast"]
            assert r["broadcasts"][1]["is_primary"] is False


def test_countdown_rows_start_at_ten_et_run_three_hours_and_carry_no_anchor_note(rows):
    """The generated rows, not just the registry: 10:00 ET on both sides of the DST change (EDT in
    September, EST after Nov 1), the stated 180 minutes with its provenance, ESPN, and NO "no anchor"
    note - that note means "this show has an anchor rule and the slate had no game for it", which is
    not Countdown's state."""
    from zoneinfo import ZoneInfo
    from datetime import datetime
    got, notes = rows
    cd = [r for r in got if r["_studio"]["show_key"] == "sundaynflcountdown"]
    assert cd[0]["_studio"]["air_date"] == "2026-09-13"
    for r in cd:
        start = datetime.fromisoformat(r["start_at"].replace("Z", "+00:00")).astimezone(
            ZoneInfo("America/New_York"))
        assert (start.weekday(), start.hour, start.minute) == (6, 10, 0), r["start_at"]
        assert r["expected_duration_min"] == 180
        assert r["_provenance"]["duration"] == "data/studio_shows.json"
        assert r["broadcasts"][0]["service_id"] == "ESPN" and len(r["broadcasts"]) == 1
        assert r["brand_key"] == "nflcountdown"
    assert not any("sundaynflcountdown" in n for n in notes)


def test_the_registry_row_labels_countdowns_slot_as_sunday():
    """`load_registry` writes `default_slot` from a weekday index into a Mon..Sun list - the label a
    human reads in the table. Pinned on the emitted statement, so an off-by-one there shows up."""
    from pipeline.db import DB
    from pipeline.load_studio_shows import load_registry
    db = DB(str(ROOT / "artifacts" / "sql" / "_studio_registry_test.sql"))
    assert load_registry(db, registry()) == 8
    stmt = next(s for s in db.emitted if "'sundaynflcountdown'" in s)
    assert "'Sun 10:00 ET'" in stmt
    assert "'espn'" in stmt, "the network FK is the slug"


def test_every_row_is_citable(rows):
    """0009 made studio_show_instances.source_url NOT NULL because "an unsourced instance is
    unrepresentable, not merely discouraged"."""
    got, _notes = rows
    for r in got:
        assert r["source_url"], r["title"]
        assert json.dumps(r)      # serialises for the loader
