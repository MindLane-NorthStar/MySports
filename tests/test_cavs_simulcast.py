"""The Cavaliers' OTA simulcast package: the announced data, the matcher, and the two composite marks.

WHAT THIS COVERS AND WHAT IT DOES NOT. The fifteen games were announced on 2026-09-15 and are
hand-entered in `data/local_rights.json`; they were verified against the loaded team table and the
loaded games ONCE, by prompt 104, through the anon REST path. That check cannot live here - these
tests touch no network - so what is pinned is the shape a later edit is most likely to break
silently: the per-game outlet, the date+tricode key, and - since prompt 106 - THE ROWS THEMSELVES,
one per outlet, with WOIO resolving as CBS.

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


def _rows(other_ab, start, available=("CBS", "WUAB 43", "DAZN"), unavailable=()):
    from adapters.nba import _simulcast_rows
    side = {"abbreviation": "CLE", "team": "Cavaliers"}
    return _simulcast_rows(side, RIGHTS["nba"], other_ab, start, False, set(available), set(unavailable))


def test_a_woio_game_emits_ONE_row_and_it_is_CBS():
    """WOIO resolves as CBS in `adapters/common.py`'s alias table, so the row's service is CBS and the
    grid lane, the access lookup and the list card's mark all find it under one name. THE LABEL KEEPS
    THE STATION, because "WOIO simulcast" is what is true of the game."""
    rows = _rows("DAL", "2026-11-14T17:00:00Z")          # 12:00 ET on the announced day
    assert [r["outlet"] for r in rows] == ["CBS"]
    r = rows[0]
    assert r["label"] == "WOIO simulcast", "the station survives in the label"
    assert r["market"] == "local" and r["mediaType"] == "tv"
    assert r["access"] == "AVAILABLE"
    assert r["source"] == "data/local_rights.json simulcasts"


def test_a_BOTH_STATION_game_emits_TWO_rows_one_per_outlet():
    """Joe's ruling: every network airing the game shows it on the grid, so a both-station game
    appears three times on one grid with the DAZN lane. ONE ROW PER OUTLET is what makes that
    possible, and collapsing them into one row is the regression to catch."""
    rows = _rows("DET", "2027-03-09T17:00:00Z")
    assert [r["outlet"] for r in rows] == ["CBS", "WUAB 43"], "one row per outlet, in announced order"
    assert {r["label"] for r in rows} == {"WOIO simulcast", "WUAB 43 simulcast"}


def test_a_wuab_only_game_emits_the_WUAB_row_alone():
    rows = _rows("MIN", "2026-10-26T23:00:00Z")
    assert [r["outlet"] for r in rows] == ["WUAB 43"]


def test_a_game_outside_the_package_emits_nothing():
    assert _rows("BOS", "2026-12-18T17:00:00Z") == []
    assert _rows("DET", "2026-12-19T17:00:00Z") == [], "right team, wrong day"


def test_availability_is_ANY_outlet_and_falls_out_of_the_per_row_access():
    """Joe ruled a simulcast game available if ANY of its outlets is - someone with an antenna and no
    DAZN can watch. It needs no rule of its own: each row carries its own `outlet_access()`, so the
    game has an AVAILABLE row whenever one outlet is available."""
    rows = _rows("DET", "2027-03-09T17:00:00Z", available=("CBS",), unavailable=("WUAB 43", "DAZN"))
    by = {r["outlet"]: r["access"] for r in rows}
    assert by["CBS"] == "AVAILABLE"
    assert by["WUAB 43"] == "UNAVAILABLE"
    assert any(r["access"] == "AVAILABLE" for r in rows), "the antenna case"


def test_WOIO_resolves_through_the_alias_table_and_stays_out_of_the_access_profile():
    import json as _json
    from adapters.common import normalize_outlet, outlet_access
    assert normalize_outlet("WOIO") == "CBS"
    assert normalize_outlet("WOIO 19") == "CBS"
    assert outlet_access("WOIO", {"CBS"}, set()) == "AVAILABLE", "it inherits CBS's access"
    ap = _json.loads((ROOT / "data" / "access_profile.json").read_text(encoding="utf-8"))
    assert "WOIO" not in ap.get("available", []) and "WOIO" not in ap.get("unavailable", [])


def test_BOTH_call_sites_gate_the_simulcast_on_national_exclusivity():
    """A nationally exclusive game carries no local feed, and no OTA simulcast either.

    ASSERTED ON THE SOURCE because the gate lives in the callers' loops, not in a function a test can
    call - the same shape autoscroll.test.mjs uses for AutoScroll's wiring. It is here because a
    mutation check found it unguarded: dropping the gate on either path left the whole suite green.

    THIS IS LIVE, NOT THEORETICAL. Two of the fifteen announced games already carry a nationally
    exclusive row in the loaded data - `nba-401910445` (2027-01-29 TOR) on ESPN and `nba-401910691`
    (2027-03-09 DET, a BOTH-station game) on NBC - so today those two emit no simulcast row at all.
    That contradiction between the announcement and the league's national selections is reported in
    register §53 and is Joe's to rule on; what this test pins is only that the gate is applied.
    """
    src = (ROOT / "adapters" / "nba.py").read_text(encoding="utf-8")
    code = "\n".join(l for l in src.splitlines() if not l.strip().startswith("#"))
    guarded = code.count("if not national_exclusive:\n                for sim in _simulcast_rows(") \
        + code.count("if not national_exclusive:\n                    for sim in _simulcast_rows(")
    assert guarded == 2, "both the ESPN path and the league-file path must gate the simulcast rows"
    assert code.count("_simulcast_rows(") == 3, "two call sites plus the definition, and no third path"


def test_the_nba_band_has_a_CBS_LANE_with_the_station_keys():
    """Block A. The lane has to exist or the CBS row has nowhere to sit on the grid. station/channel
    ARE carried, unlike the WUAB 43 entry: the call-letters band is drawn from those keys
    (scripts/render_day.py), and the CBS mark does not carry call letters the way the 43 art does."""
    ro = json.loads((ROOT / "data" / "row_order.json").read_text(encoding="utf-8"))
    band = ro["nba"]["broadcast"]
    assert [b["network"] for b in band] == ["ABC", "NBC", "CBS", "WUAB 43"]
    cbs = next(b for b in band if b["network"] == "CBS")
    assert cbs["station"] == "WOIO" and cbs["channel"] == 19
    assert "station" not in band[-1], "WUAB 43 still omits them on purpose"
    # the same station, spelled the same way, in every band that carries it
    for sport in ("cfb", "nfl"):
        other = next(b for b in ro[sport]["broadcast"] if b["network"] == "CBS")
        assert (other["station"], other["channel"]) == (cbs["station"], cbs["channel"])


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


@pytest.mark.parametrize("slug,parts", [("cbs-dazn", ("cbs", "dazn")), ("cbs-wuab-43", ("cbs", "wuab-43"))])
def test_the_halves_are_matched_BY_WIDTH_not_by_ink_area(slug, parts):
    """JOE'S RULING, 2026-09-16 (prompt 105, register §52): "Scale CBS down so its width equals the
    width of the mark beneath it, and let its height follow proportionally."

    THIS OVERRODE THE INK-AREA BALANCE prompt 104 shipped, which is why the check is on the WIDTHS in
    the published bitmap rather than on the recipe's intent. Under the old rule the two halves
    carried equal ink and CBS came out WIDER than the mark below it; under this one they share an
    edge-to-edge width. Restoring the ink-area balance fails here, which is the point.
    """
    from PIL import Image
    im = Image.open(MARKS / f"{slug}.png").convert("RGBA")
    alpha = im.split()[3]

    def ink_rows():
        on = [any(alpha.getpixel((x, y)) >= 16 for x in range(im.width)) for y in range(im.height)]
        runs, s = [], None
        for y, v in enumerate(on + [False]):
            if v and s is None:
                s = y
            elif not v and s is not None:
                runs.append((s, y)); s = None
        return runs

    runs = ink_rows()
    # the seam is the widest empty run - the gap stack() inserts between the halves. `wuab-43` has
    # its own internal row gap, so the halves are split on the LARGEST gap, not on every gap.
    gaps = [(a[1], b[0]) for a, b in zip(runs, runs[1:])]
    assert gaps, f"{slug} has no gap between halves"
    seam = max(gaps, key=lambda g: g[1] - g[0])
    halves = [(0, seam[0]), (seam[1], im.height)]

    widths = []
    for y0, y1 in halves:
        xs = [x for x in range(im.width) if any(alpha.getpixel((x, y)) >= 16 for y in range(y0, y1))]
        widths.append(max(xs) - min(xs) + 1)
    top, bottom = widths
    assert abs(top - bottom) <= 2, (
        f"{slug}: the halves must share a width - top {top}px, bottom {bottom}px. "
        "Greater than 2px apart means the width match is gone (the ink-area balance is back, "
        "or CBS was matched to the wrong part).")
    assert im.width - max(widths) <= 2, "and the composite is no wider than its halves"


def test_the_width_match_reads_the_BOTTOM_part_not_the_widest_one():
    """The rule is 'the mark beneath it'. CBS is the widest mark in the suite, so a stack that
    matched on the WIDEST part would leave CBS at 461 and blow the other half up to meet it -
    upscaling published art and inverting the ruling."""
    from PIL import Image
    from scripts.build_web_marks import stack
    top = Image.new("RGBA", (400, 100), (255, 255, 255, 255))     # the wide one, on top
    bottom = Image.new("RGBA", (100, 100), (255, 255, 255, 255))  # the narrow one, beneath
    out = stack([top, bottom])
    assert out.width == 100, f"the BOTTOM part sets the width; got {out.width}"
    assert out.height < 100 + 100 + 30, "and the top part's height came down with its width"


def test_the_suite_still_holds_the_marks_that_were_there_before():
    """Adding composites must not drop or rename anything: build() writes the whole manifest, and
    `--only` truncating it is a footgun this file's own docstring records."""
    for slug in ("cbs", "dazn", "wuab-43", "espn", "fox", "nbc", "abc", "tnt"):
        assert slug in MANIFEST
    assert len(MANIFEST) == 35, "33 published marks + the two composites"
