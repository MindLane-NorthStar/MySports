#!/usr/bin/env python3
"""Joe's per-team logo rulings outrank the byte-identity test, and stay outranking it.

    python -m pytest tests/test_logo_conditioning.py -v     # from the repo root

WHAT THIS GUARDS. `build_web_marks.team_dark_variants()` was taught in prompt 61 that a
`{id}_dark.png` byte-identical to its base is not provider art - it is the ABSENCE of provider art
wearing the filename - and so it re-derives those. Prompt 64 added the 124 pro-league rulings Joe
made by eye on 2026-09-08, and 101 of them say the charcoal-context file should BE the raw art.

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
    """The prompt-61 behaviour is intact for the 642 college teams nobody has ruled yet."""
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
