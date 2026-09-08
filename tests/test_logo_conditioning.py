#!/usr/bin/env python3
"""Joe's per-team logo rulings outrank the byte-identity test, and stay outranking it.

    python -m pytest tests/test_logo_conditioning.py -v     # from the repo root

WHAT THIS GUARDS. `build_web_marks.team_dark_variants()` was taught in prompt 61 that a
`{id}_dark.png` byte-identical to its base is not provider art - it is the ABSENCE of provider art
wearing the filename - and so it re-derives those. Prompt 64 added the 124 pro-league rulings Joe
made by eye on 2026-09-08, and 101 of them say the charcoal-context file should BE the raw art.
Prompt 66 added the 642 college teams the same way: 463 skip_derive, 300 derive, 3 deliberately
in neither list. The mechanism did not change to take them.

Those two statements describe the same bytes and disagree. If the identity test is ever allowed to
run on a `skip_derive` team, the next nightly `sync_assets.py --push --prefix logos/ --make-dark`
reconditions all 101, pushes them to R2, and NOTHING FAILS - the counts still look healthy, the
build still exits 0, and the only symptom is Joe's phone quietly showing the art he rejected.

So the assertion here is not "the file parses". It is: after a build, a `skip_derive` team's dark
file equals its base byte for byte, and a second build leaves it exactly alone. That is the shape
the regression takes, and it is the shape this test fails on.
"""
from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from PIL import Image  # noqa: E402

import build_web_marks as bwm  # noqa: E402

RULINGS = json.loads((ROOT / "data" / "logo_conditioning.json").read_text(encoding="utf-8"))
SKIP = RULINGS["skip_derive"]
DERIVE = RULINGS["derive"]


def _sha(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


# --------------------------------------------------------------------------- the file itself
def test_counts_match_the_declared_counts():
    """The file states its own counts; a ruling lost to a bad edit shows up here.

    THESE WERE 101 AND 23 WHEN THE FILE HELD THE PRO LEAGUES ALONE, and pinning those literals was a
    mistake: the file's own `scope` said from the first commit that college rulings were coming, and
    they landed the same day. A test that fails when the data grows the way the data said it would
    is testing the snapshot, not the invariant. The invariant is that the file agrees with ITSELF.
    """
    assert len(SKIP) == RULINGS["counts"]["skip_derive"]
    assert len(DERIVE) == RULINGS["counts"]["derive"]
    total = RULINGS["counts"].get("teams_total")
    if total is not None:
        split = RULINGS["counts"].get("split_by_context", 0)
        assert len(SKIP) + len(DERIVE) + split == total, "the lists do not add up to teams_total"


def test_the_two_lists_are_disjoint():
    both = set(SKIP) & set(DERIVE)
    assert not both, f"ruled both ways: {sorted(both)}"


def test_every_ruling_names_a_well_formed_team_id():
    """No junk keys. Pro ids are `{league}-{id}`; college ids are the bare ESPN number."""
    bad = [i for i in list(SKIP) + list(DERIVE)
           if not (i.split("-")[0] in {"nfl", "nhl", "mlb", "nba"} or i.isdigit())]
    assert not bad, f"not a team id: {bad}"


def test_a_split_by_context_team_is_in_neither_list():
    """Three teams are deliberately unruled so they keep raw-on-plate and derived-on-charcoal."""
    split = RULINGS.get("split_by_context") or {}
    for team_id in split:
        assert team_id not in SKIP and team_id not in DERIVE, f"{team_id} is ruled and split"


def test_the_loader_reads_what_the_file_says():
    skip, der = bwm.conditioning_rulings()
    assert skip == set(SKIP) and der == set(DERIVE)


def test_every_ruling_has_art_on_disk():
    """assets/ is untracked (rule 4), so this is a local check - skipped where the art is absent."""
    if not bwm.LOGO_DIR.is_dir() or not any(bwm.LOGO_DIR.glob("*.png")):
        pytest.skip("assets/logos is not populated here")
    missing = [i for i in list(SKIP) + list(DERIVE) if not (bwm.LOGO_DIR / f"{i}.png").exists()]
    assert not missing, f"ruled, but no base art: {missing}"


# --------------------------------------------------------------------------- the real guard
def _base(path: Path, rgb: tuple[int, int, int] = (40, 40, 40)) -> None:
    """A 300px logo dark enough that `derive` + `floor_l` are guaranteed to change its pixels.

    Gray (spread 0 < GRAY_SPREAD) and mean 40 < 128, so the derive guard fires rather than passing
    the image through. If conditioning ever ran on this, the bytes could not come back equal.
    """
    Image.new("RGBA", (300, 300), rgb + (255,)).save(path, "PNG")


@pytest.fixture
def logos(tmp_path, monkeypatch):
    """A temp LOGO_DIR carrying one really-ruled team of each kind plus one unruled team."""
    ruled = next(iter(SKIP))                       # a real skip_derive id, from the real file
    unruled = "zzz-not-a-ruled-team"
    for stem in (ruled, unruled):
        _base(tmp_path / f"{stem}.png")
    monkeypatch.setattr(bwm, "LOGO_DIR", tmp_path)
    return tmp_path, ruled, unruled


def test_ruled_team_gets_the_raw_art_and_a_second_build_leaves_it(logos):
    """THE REGRESSION: identity test wins -> run 1 conditions, and dark != base."""
    d, ruled, _ = logos
    base, dark = d / f"{ruled}.png", d / f"{ruled}_dark.png"

    c1 = bwm.team_dark_variants()
    assert c1["ruled_raw"] == 1
    assert _sha(dark) == _sha(base), "a skip_derive team's dark file must BE its base"

    stamp = _sha(dark)
    c2 = bwm.team_dark_variants()
    assert c2["ruled_raw"] == 0, "the ruling was already satisfied; nothing should be rewritten"
    assert _sha(dark) == stamp, "the second build moved bytes it should not have"


def test_a_ruled_teams_identical_bytes_are_never_reconditioned(logos):
    """The exact collision: bytes that mean 'no provider art' anywhere else mean 'ruled' here."""
    d, ruled, _ = logos
    (d / f"{ruled}_dark.png").write_bytes((d / f"{ruled}.png").read_bytes())
    c = bwm.team_dark_variants()
    assert c["reconditioned"] == 0, "the identity test ran on a ruled team"
    assert _sha(d / f"{ruled}_dark.png") == _sha(d / f"{ruled}.png")


def test_an_unruled_team_still_gets_conditioned(logos):
    """The prompt-61 behaviour is intact for any team nobody has ruled.

    IT SAID "the 642 college teams nobody has ruled yet" until prompt 66, and that stopped being
    true on the same day it was written: Joe ruled all 642 of them and 639 are now in the file. The
    branch this covers is unchanged and still reachable - a split-by-context team, a team that
    arrives before the file is extended - so the test stands and only its reason had gone stale.
    """
    d, _, unruled = logos
    base, dark = d / f"{unruled}.png", d / f"{unruled}_dark.png"

    bwm.team_dark_variants()
    assert dark.exists() and _sha(dark) != _sha(base), "an unruled logo must still be conditioned"

    dark.write_bytes(base.read_bytes())            # the absence of provider art wearing the filename
    c = bwm.team_dark_variants()
    assert c["reconditioned"] == 1
    assert _sha(dark) != _sha(base)


def test_force_re_copies_a_ruled_team_without_conditioning_it(logos):
    """--force rebuilds everything; for a ruled team that must still mean the raw bytes."""
    d, ruled, _ = logos
    bwm.team_dark_variants()
    bwm.team_dark_variants(force=True)
    assert _sha(d / f"{ruled}_dark.png") == _sha(d / f"{ruled}.png")


def test_missing_rulings_file_falls_back_to_prompt_61_behaviour(logos, monkeypatch):
    """The nightly build must keep working if the file is ever absent - no rulings, no crash."""
    d, ruled, _ = logos
    monkeypatch.setattr(bwm, "CONDITIONING", d / "nope.json")
    bwm.team_dark_variants()
    assert _sha(d / f"{ruled}_dark.png") != _sha(d / f"{ruled}.png")


# ------------------------------------------------- the college rulings (prompt 66)
#
# The pro leagues were ruled first (prompt 64) and college followed on the same day. The mechanism
# did not change to take them - the rulings check already sat above the byte-identity branch and the
# reader already took no arguments - so what these add is COVERAGE OF THE OTHER HALF OF THE FILE
# rather than of new code. A college id is a bare ESPN number where a pro id is `{league}-{number}`,
# and that difference is the one thing here that could plausibly break: nothing in the lookup is
# league-aware, and these prove it.


def _one(mapping, digits: bool):
    """A real id from the real file: college ids are bare numbers, pro ids are not."""
    return next(i for i in mapping if i.isdigit() is digits)


@pytest.fixture
def college_logos(tmp_path, monkeypatch):
    """A temp LOGO_DIR with a real college team from each list, plus a real split team."""
    ids = {
        "skip": _one(SKIP, True),
        "derive": _one(DERIVE, True),
        "split": next(iter(RULINGS["split_by_context"])),
    }
    for stem in ids.values():
        _base(tmp_path / f"{stem}.png")
    monkeypatch.setattr(bwm, "LOGO_DIR", tmp_path)
    return tmp_path, ids


def test_a_college_skip_derive_team_takes_the_raw_art(college_logos):
    d, ids = college_logos
    base, dark = d / f'{ids["skip"]}.png', d / f'{ids["skip"]}_dark.png'
    c1 = bwm.team_dark_variants()
    assert _sha(dark) == _sha(base), f'{ids["skip"]} is skip_derive and must take its base bytes'
    stamp = _sha(dark)
    c2 = bwm.team_dark_variants()
    assert c2["ruled_raw"] < c1["ruled_raw"], "the second run must not rewrite a satisfied ruling"
    assert _sha(dark) == stamp


def test_a_college_derive_team_is_conditioned_and_stays_conditioned(college_logos):
    """The other half of the ruling: `derive` keeps the guarded derive and the 0.5 floor."""
    d, ids = college_logos
    base, dark = d / f'{ids["derive"]}.png', d / f'{ids["derive"]}_dark.png'
    bwm.team_dark_variants()
    assert _sha(dark) != _sha(base), f'{ids["derive"]} is ruled derive and must NOT be the raw art'
    stamp = _sha(dark)
    bwm.team_dark_variants()
    assert _sha(dark) == stamp, "a conditioned variant is idempotent - it is a 256px re-render"


def test_a_split_team_is_conditioned_like_an_unruled_one(college_logos):
    """Wake Forest, Pacific Lutheran and West Virginia are in NEITHER list on purpose.

    Joe wants the raw art on the coloured cap plate and the derived art on charcoal. Nothing in this
    module has to do that: the cap reads `capFor(id).art`, which is 'raw' for all three, while this
    function keeps building the derived `_dark.png` the charcoal contexts read. Measured 2026-09-08:
    154 raw/tint 1, 277 raw/tint 1, 2486 raw/tint 0.72. So the split is served by leaving them out,
    and the thing to guard is that they are NOT quietly given the raw bytes here.
    """
    d, ids = college_logos
    base, dark = d / f'{ids["split"]}.png', d / f'{ids["split"]}_dark.png'
    bwm.team_dark_variants()
    assert _sha(dark) != _sha(base), f'{ids["split"]} is split by context and must keep derived art'


def test_the_lookup_is_not_league_aware(college_logos):
    """A bare-number college id and a `{league}-{number}` pro id resolve through the same path."""
    skip, der = bwm.conditioning_rulings()
    assert _one(SKIP, True) in skip and _one(SKIP, False) in skip
    assert _one(DERIVE, True) in der and _one(DERIVE, False) in der


# ------------------------------------------------- the grid's own cap art (prompt 69 stage 3)
#
# A THIRD ART CONTEXT. The app had two - the raw file for the grid endcap and the light plates,
# `{id}_dark.png` for a logo floating on charcoal - and Joe ruled the Giants' SF mark black on their
# orange band. Measured with build_cap_table.py's edge_crisp at render size: on #fd5a1e the raw and
# dark files both score 0.000 and a black silhouette 1.000, while on charcoal the silhouette scores
# 0.000 and the other two 1.000. The two contexts want opposite art, so a third file settles it.


def test_cap_art_is_a_silhouette_not_a_darkening(tmp_path, monkeypatch):
    """Every visible pixel to #000000, ALPHA UNTOUCHED - the shape and its edge survive exactly."""
    monkeypatch.setattr(bwm, "LOGO_DIR", tmp_path)
    table = tmp_path / "cap-table.json"
    table.write_text(json.dumps({"teams": {"zz-1": {"tint": 1, "art": "cap"}}}), encoding="utf-8")
    monkeypatch.setattr(bwm, "CAP_TABLE", table)

    src = tmp_path / "zz-1.png"
    im = Image.new("RGBA", (8, 8), (0, 0, 0, 0))
    im.putpixel((1, 1), (250, 90, 30, 255))     # opaque brand colour
    im.putpixel((2, 2), (250, 90, 30, 128))     # a half-transparent antialiased edge pixel
    im.save(src, "PNG")

    c = bwm.team_cap_art()
    assert c["generated"] == 1
    out = Image.open(tmp_path / "zz-1_cap.png").convert("RGBA")
    assert out.getpixel((1, 1)) == (0, 0, 0, 255), "an opaque pixel goes black and stays opaque"
    assert out.getpixel((2, 2)) == (0, 0, 0, 128), "ALPHA UNTOUCHED - the edge keeps its coverage"
    assert out.getpixel((0, 0))[3] == 0, "and a transparent pixel stays transparent"


def test_cap_art_roster_is_the_cap_table_and_it_is_idempotent(tmp_path, monkeypatch):
    monkeypatch.setattr(bwm, "LOGO_DIR", tmp_path)
    table = tmp_path / "cap-table.json"
    table.write_text(json.dumps({"teams": {
        "zz-1": {"art": "cap"}, "zz-2": {"art": "dark"}, "zz-3": {"art": "raw"},
    }}), encoding="utf-8")
    monkeypatch.setattr(bwm, "CAP_TABLE", table)
    for stem in ("zz-1", "zz-2", "zz-3"):
        Image.new("RGBA", (4, 4), (200, 100, 50, 255)).save(tmp_path / f"{stem}.png", "PNG")

    assert bwm.team_cap_art()["generated"] == 1
    assert (tmp_path / "zz-1_cap.png").exists()
    assert not (tmp_path / "zz-2_cap.png").exists(), "'dark' does not ask for cap art"
    assert not (tmp_path / "zz-3_cap.png").exists(), "'raw' does not either"
    assert bwm.team_cap_art()["generated"] == 0, "a second run writes nothing"


def test_a_cap_file_is_not_a_base_logo(tmp_path, monkeypatch):
    """THE TRAP: `{id}_cap.png` must not be conditioned into `{id}_cap_dark.png`.

    `team_dark_variants()` walks every `*.png` that is not a derived file. `_cap` had to join
    `_dark` in that exclusion, or the new silhouette would be read as a team logo, get a dark variant
    nothing renders, and put every count of the 766 out by one per cap file.
    """
    monkeypatch.setattr(bwm, "LOGO_DIR", tmp_path)
    monkeypatch.setattr(bwm, "CONDITIONING", tmp_path / "none.json")
    _base(tmp_path / "zz-9.png")
    _base(tmp_path / "zz-9_cap.png")
    bwm.team_dark_variants()
    assert (tmp_path / "zz-9_dark.png").exists(), "a real base is still conditioned"
    assert not (tmp_path / "zz-9_cap_dark.png").exists(), "a cap file is not a base"
