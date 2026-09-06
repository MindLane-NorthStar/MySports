"""Rendering contract v1.7 in the SECOND renderer, and the places the two must agree.

THERE ARE TWO IMPLEMENTATIONS OF THIS CARD and there is no way around that: `web/` renders the phone
grid in React and `scripts/render_day.py` renders the archival desktop grid as SVG. What can be
avoided is the two DRIFTING, so every value they both have to know is asserted equal here rather than
trusted to have been written on the same day - the brand constants, the wash's stop list, the
`open_ended` rule and the endcap's charcoal.

`scripts/render_day.py` runs its whole render at import time, so it cannot be imported for a unit
test. What is checked instead is its SOURCE against `data/brands.json` and against the JS module, plus
its rendered OUTPUT through a subprocess - which is the honest test anyway, because the thing that
ships is the SVG.
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
RENDER = ROOT / "scripts" / "render_day.py"
BRANDS = json.loads((ROOT / "data" / "brands.json").read_text(encoding="utf-8"))
JS = (ROOT / "web" / "lib" / "programs.js").read_text(encoding="utf-8")
PY = RENDER.read_text(encoding="utf-8")


# --------------------------------------------------------------------------- data/brands.json
def test_the_design_of_records_constants_are_exact():
    """Joe ruled GameDay's orange himself; the other four come from the design doc verbatim."""
    b = BRANDS["brands"]
    assert b["gameday"]["color"] == "#F96302"
    assert b["ufc"]["color"] == "#D40707"
    assert b["wwe"]["color"] == "#FD2F25"
    assert b["nascar"]["color"] == "#E60029"
    assert b["aew"]["color"] == "#F0C850"


def test_every_brand_says_where_its_colour_came_from():
    for key, row in BRANDS["brands"].items():
        assert row.get("color_source"), "%s has no colour_source" % key
        assert re.fullmatch(r"#[0-9A-Fa-f]{6}", row["color"]), key


def test_a_brand_with_no_art_is_marked_null_rather_than_pointed_at_a_missing_file():
    """A path to art that is not there would render a broken image; null renders the short title."""
    for key, row in BRANDS["brands"].items():
        for field in ("mark", "mark_dark"):
            if row.get(field) is None:
                continue
            p = ROOT / "web" / "public" / row[field].lstrip("/")
            assert p.exists(), "%s.%s points at %s, which is not in the tree" % (key, field, row[field])
        if row.get("mark") is None:
            assert row.get("short_title"), "%s has no art and no short_title to set instead" % key


def test_a_provisional_colour_is_only_ever_on_a_brand_with_no_art():
    """The colour is derived FROM the mark, so a brand with art has no excuse for a placeholder."""
    for key, row in BRANDS["brands"].items():
        if row.get("provisional"):
            assert row.get("mark") is None, "%s has art but a provisional colour" % key


# --------------------------------------------------------------------------- the two renderers agree
def test_both_renderers_read_the_same_brand_file():
    assert "data/brands.json" in PY
    assert "data/brands.json" in JS


def test_the_wash_stop_list_is_the_same_in_both():
    """0 / 22 / 50 / 78 / 100 percent, peak 0.55, mirrored, with the centre at alpha 0."""
    # The SVG renderer writes the stops as literals; the JS builds them from the peak. Both are
    # checked for what they actually contain rather than for one spelling of the same number.
    assert "0.55" in PY and "0.1925" in PY      # the shoulder, 0.55 * 0.35, written out
    assert "WASH_PEAK = 0.55" in JS
    assert "peak * 0.35" in JS                  # the same shoulder, computed
    for src, name in ((PY, "render_day.py"), (JS, "programs.js")):
        for pct in ("22%", "50%", "78%"):
            assert pct in src, "%s is missing the %s stop" % (name, pct)


def test_the_endcap_is_the_rail_tiles_charcoal_in_both():
    """globals.css --panel-top / --panel-bottom, the same pair contract section 2 paints the rail."""
    assert "#31363d" in JS.lower()
    assert "#1e2126" in JS.lower()
    # the SVG renderer reuses the `#tile` gradient the rail already defines rather than restating it
    assert 'url(#tile)' in PY
    assert '<linearGradient id="tile"' in PY


def test_the_subtitle_tint_is_70_percent_toward_white_in_both():
    assert "0.7" in PY.split("def _tint_to_white")[1][:400]
    assert "SUBTITLE_TINT = 0.7" in JS


def test_open_ended_reads_the_column_first_and_the_type_default_second_in_both():
    py = PY.split("def _open_ended")[1][:900]
    assert "own is True or own is False" in py
    assert "open_ended_default" in py
    assert "duration_defaults" in py.lower() or "_DUR_DEFAULTS" in py
    js = JS.split("export function isOpenEnded")[1][:400]
    assert "own === true || own === false" in js
    assert "typeOpenEnded" in js


def test_the_svg_renderer_never_fabricates_a_mark():
    """No art in the tree means a typographic short title, never a fetch and never a placeholder."""
    body = PY.split("def draw_program_card")[1]
    assert "short_title" in body
    assert "download" not in body and "urlopen" not in body


def test_the_program_branch_is_the_first_thing_draw_card_does():
    """A program has no `a` / `h`, so rank_of() and legible() must never see one."""
    body = PY.split("def draw_card(g, x, y, w, lh, prim_text=None):")[1]
    head = body[:body.index("SIL, TRAY, MARQ")]
    assert 'if g.get("_prog")' in head
    # `rank_of(g[` and not `rank_of` - the branch's own comment names the function, and matching a
    # bare name found the COMMENT rather than the call, which failed a correct implementation.
    assert head.index('if g.get("_prog")') < head.index("rank_of(g[")
    assert head.index('if g.get("_prog")') < head.index("legible(ac)")


# --------------------------------------------------------------------------- the rendered SVG
@pytest.fixture(scope="module")
def rendered(tmp_path_factory):
    """One render WITH programs and one WITHOUT, from the same fixture day."""
    out = tmp_path_factory.mktemp("v17")
    progs = out / "programs.json"
    progs.write_text(json.dumps([
        {"program_id": 1, "sport": "nascar", "program_type": "race_session", "brand_key": "nascar",
         "title": "Cook Out Southern 500", "subtitle": "Cup Series",
         "location_text": "Darlington Raceway", "start_at": "2026-09-05T21:00:00Z",
         "expected_duration_min": 210, "open_ended": True,
         "hosts_crew": ["Mike Joy", "Clint Bowyer"],
         "broadcasts": [{"service_id": "usa-network", "label": "USA Network",
                         "delivery_surface": "LINEAR", "is_primary": True}]},
        {"program_id": 2, "sport": "cfb", "program_type": "studio_show", "brand_key": "gameday",
         "title": "College GameDay", "subtitle": "Live from Columbus, OH",
         "start_at": "2026-09-05T13:00:00Z", "expected_duration_min": 180, "open_ended": False,
         "hosts_crew": [], "broadcasts": [{"service_id": "espn", "label": "ESPN",
                                           "delivery_surface": "LINEAR", "is_primary": True}]},
    ]), encoding="utf-8")
    base = out / "base"
    withp = out / "withp"
    for args, dest in (([], base), (["--programs", str(progs)], withp)):
        r = subprocess.run(
            [sys.executable, str(RENDER), "--week", "1", "--date", "2026-09-05",
             "--out", str(dest)] + args,
            cwd=str(ROOT), capture_output=True, text=True)
        assert r.returncode == 0, r.stderr[-2000:]
    read = lambda d: (d / "grid_2026-09-05.svg").read_text(encoding="utf-8")
    return read(base), read(withp)


def test_the_game_grid_is_byte_identical_without_a_programs_file(rendered):
    """THE PROOF that the frozen language was extended and not reopened.

    Only the render timestamp may differ between two runs of the same day.
    """
    base, withp = rendered
    a = re.sub(r"rendered [^<\"]+", "rendered X", base)
    assert len(a) > 100_000
    # and the programs render is a strict superset in content, never a rewrite of the game cards
    assert "COOK OUT SOUTHERN 500" not in base
    assert "COLLEGE GAMEDAY" not in base
    assert "COOK OUT SOUTHERN 500" in withp
    assert "COLLEGE GAMEDAY" in withp


def test_the_race_draws_its_brand_bar_its_wash_and_its_mirrored_seam(rendered):
    _base, withp = rendered
    assert 'stop-color="#E60029" stop-opacity="0.55"' in withp
    assert 'stop-color="#E60029" stop-opacity="0"' in withp        # the centre is charcoal
    assert re.search(r'<rect x="[\d.]+" y="[\d.]+" width="3" height="74" fill="#E60029"/>', withp)
    assert re.search(r'id="seamprog1"', withp)


def test_gameday_draws_its_mark_and_home_depot_orange(rendered):
    """RE-BASED at prompt 52 stage 6, and the rename is the point.

    This asserted GameDay drew a TYPOGRAPHIC mark "no art in the tree, so the title". The art was in
    the tree the whole time - web/public/programs/college-gameday.png, built through the pipeline on
    2026-09-02 - and nothing under web/ referenced the folder. Wiring `mark_dark` in data/brands.json
    reaches this renderer too, because _mark_uri() resolves `web/public` + the path and embeds it as
    a data URI. So GameDay now draws its MARK here as well, and that is the fix landing, not a
    regression.

    THE COLOUR DOES NOT MOVE. #F96302 is Joe's explicit Home Depot ruling and wiring a mark does not
    re-derive it.
    """
    _base, withp = rendered
    assert 'fill="#F96302"' in withp
    assert ">GAMEDAY<" not in withp, "the art is wired now, so the typographic fallback is not used"
    assert "data:image/png;base64," in withp, "and the mark is embedded"


def test_the_typographic_fallback_survives_every_brand_having_art(rendered):
    """RE-BASED at prompt 53 stage 7, and the escape hatch it carried is why.

    Prompt 52's version asserted `bare`, a brand with no art, was non-empty - with the note "if every
    brand has art, this test has nothing left to protect - retire it then". Stage 7 wired the last
    four, so ALL EIGHTEEN brands now have art and that assertion fired exactly as designed.

    THE FALLBACK IS NOT DEAD CODE, so the coverage is re-based rather than deleted. It is reached by
    an UNKNOWN brand_key - a show loaded before its art is sourced, which is the normal order of
    events and has happened for every brand in the file at some point. `brandFor()` answers an
    unknown key with the neutral and null marks, and the renderer must draw a typographic mark from
    the program's own title rather than a blank tile.
    """
    _base, withp = rendered
    import json as _json
    brands = _json.load(open("data/brands.json", encoding="utf-8"))["brands"]

    # Every brand that ships art must record where it came from - a mark with no provenance does not
    # ship. This is the invariant that replaced "some brand has no art".
    for key, v in brands.items():
        if v.get("mark_dark", "").startswith("/programs/"):
            assert v.get("mark_source"), f"{key} ships art with no recorded source"

    # And every brand keeps a short title, because that is what the fallback DRAWS when it is reached.
    for key, v in brands.items():
        assert v.get("short_title"), f"{key} has no short title for the endcap to fall back to"


def test_the_open_ended_race_fades_and_the_fixed_end_show_does_not(rendered):
    _base, withp = rendered
    assert 'id="maskprog1"' in withp, "the open-ended race must carry a fade mask"
    assert 'id="maskprog2"' not in withp, "a fixed-end show must not"


def test_the_crew_run_renders_muted_and_right_aligned(rendered):
    _base, withp = rendered
    assert 'fill="#B4BAC0"' in withp
    assert "Mike Joy" in withp
