"""The Cavaliers' OTA simulcast package: the announced data, the matcher, and the two composite marks.

WHAT THIS COVERS AND WHAT IT DOES NOT. The fifteen games were announced on 2026-09-15 and are
hand-entered in `data/local_rights.json`; they were verified against the loaded team table and the
loaded games ONCE, by prompt 104, through the anon REST path. That check cannot live here - these
tests touch no network - so what is pinned is the shape a later edit is most likely to break
silently: the per-game outlet, the date+tricode key, and the boundary that keeps prompt 104 from
emitting a broadcast row it did not design.

THE SPLIT IS THE POINT. Nine games are on WOIO alone, two on WUAB 43 alone and four on both, so the
old single `outlet` field on the package could not express the announcement. A regression here is
somebody flattening it back.
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
RIGHTS = json.loads((ROOT / "data" / "local_rights.json").read_text(encoding="utf-8"))
SIM = RIGHTS["nba"]["CLE"]["simulcasts"]
GAMES = SIM["games"]
MARKS = ROOT / "web" / "public" / "marks"
MANIFEST = {m["slug"]: m for m in json.loads((MARKS / "manifest.json").read_text(encoding="utf-8"))}

WOIO, WUAB = "WOIO", "WUAB 43"


def test_all_fifteen_announced_games_are_here():
    assert len(GAMES) == 15
    assert SIM["expectedCount"] == 15, "the count the file has carried since 2026-09-01"


def test_the_outlet_is_per_game_and_the_package_no_longer_carries_one():
    """The announcement's whole shape. `outlet` at the package level is what this replaced, and it
    survives only under `superseded` - so a flattening back to one outlet fails here."""
    assert "outlet" not in SIM, "the package-level outlet is gone; it is per game now"
    assert SIM["superseded"]["outlet"] == WUAB, "and the old value is kept as dated history"
    for g in GAMES:
        assert g["outlets"], f"{g['date']} carries no outlet"
        assert set(g["outlets"]) <= {WOIO, WUAB}, f"{g['date']} names an unknown outlet"


def test_the_split_is_nine_two_and_four():
    only_woio = [g for g in GAMES if g["outlets"] == [WOIO]]
    only_wuab = [g for g in GAMES if g["outlets"] == [WUAB]]
    both = [g for g in GAMES if set(g["outlets"]) == {WOIO, WUAB}]
    assert (len(only_woio), len(only_wuab), len(both)) == (9, 2, 4)
    assert sum(1 for g in GAMES if WOIO in g["outlets"]) == 13
    assert sum(1 for g in GAMES if WUAB in g["outlets"]) == 6


def test_the_key_is_date_plus_tricode_because_three_opponents_repeat():
    """DAL, DET and CHA each appear twice. A matcher keyed on the tricode alone would put the
    December Detroit game's outlets on the March one - and they differ, which is what makes this a
    defect rather than a tidiness point."""
    from collections import Counter
    repeats = sorted(t for t, n in Counter(g["opponent"] for g in GAMES).items() if n > 1)
    assert repeats == ["CHA", "DAL", "DET"]
    assert len({(g["date"], g["opponent"]) for g in GAMES}) == 15, "date+tricode IS unique"
    det = {g["date"]: g["outlets"] for g in GAMES if g["opponent"] == "DET"}
    assert det["2026-12-18"] == [WOIO]
    assert set(det["2027-03-09"]) == {WOIO, WUAB}, "the two Detroit games differ, so the date decides"


def test_every_date_is_iso_and_inside_the_announced_season():
    for g in GAMES:
        assert len(g["date"]) == 10 and g["date"][4] == g["date"][7] == "-"
        assert "2026-10-26" <= g["date"] <= "2027-04-04"
        assert g["side"] in ("home", "away")


# ------------------------------------------------------------------ the matcher
def test_simulcast_outlets_matches_on_the_pair_and_returns_the_right_games_outlets():
    from adapters.nba import simulcast_outlets
    carriage = RIGHTS["nba"]
    # the ET date is derived from the start time, so these are ET-midday starts on the two DET dates
    assert simulcast_outlets(carriage, "CLE", "DET", "2026-12-18T17:00:00Z") == [WOIO]
    assert set(simulcast_outlets(carriage, "CLE", "DET", "2027-03-09T17:00:00Z")) == {WOIO, WUAB}
    assert simulcast_outlets(carriage, "CLE", "MIN", "2026-10-26T23:00:00Z") == [WUAB]


def test_simulcast_outlets_is_empty_for_a_game_that_is_not_in_the_package():
    from adapters.nba import simulcast_outlets
    carriage = RIGHTS["nba"]
    assert simulcast_outlets(carriage, "CLE", "BOS", "2026-12-18T17:00:00Z") == []
    assert simulcast_outlets(carriage, "CLE", "DET", "2026-12-19T17:00:00Z") == [], "right team, wrong day"
    assert simulcast_outlets(carriage, "BOS", "DET", "2026-12-18T17:00:00Z") == [], "no package for BOS"


def test_no_broadcast_row_is_emitted_yet_and_that_is_deliberate():
    """PROMPT 105 OWNS THE ROW. WOIO is absent from access_profile.json on purpose (it resolves as
    CBS), four games carry two outlets, and both callers dedupe on a single `m["outlet"]` - so a row
    emitted now would be a guess at three decisions nobody has made. When 105 makes them, this test
    is the one to rewrite, deliberately, rather than to delete."""
    from adapters.nba import _simulcast_row
    carriage = RIGHTS["nba"]
    side = {"abbreviation": "CLE", "team": "Cavaliers"}
    assert _simulcast_row(side, carriage, "DET", "2026-12-18T17:00:00Z", False) is None


# ------------------------------------------------------------------ the composite marks
@pytest.mark.parametrize("slug,parts", [("cbs-dazn", ("cbs", "dazn")), ("cbs-wuab-43", ("cbs", "wuab-43"))])
def test_the_composite_marks_are_published_and_are_recipes_over_real_parts(slug, parts):
    from scripts.build_web_marks import COMPOSITES
    assert COMPOSITES[slug] == parts, "the recipe, so the composite can always be rebuilt"
    assert (MARKS / f"{slug}.png").exists()
    row = MANIFEST[slug]
    assert row["h"] == 128, "published at the suite's height like every other mark"
    assert 0.62 <= row["hf"] <= 1.15, "hf is derived and clamped by the same frozen bounds"
    for p in parts:
        assert p in MANIFEST, f"{slug} is built from {p}, which must itself be published"


def test_the_suite_still_holds_the_marks_that_were_there_before():
    """Adding composites must not drop or rename anything: build() writes the whole manifest, and
    `--only` truncating it is a footgun this file's own docstring records."""
    for slug in ("cbs", "dazn", "wuab-43", "espn", "fox", "nbc", "abc", "tnt"):
        assert slug in MANIFEST
    assert len(MANIFEST) == 35, "33 published marks + the two composites"
