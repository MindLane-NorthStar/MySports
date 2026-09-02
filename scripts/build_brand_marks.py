#!/usr/bin/env python3
"""Build the app's BRAND art: league marks, program marks and the TV cutout.

    python scripts/build_brand_marks.py                    # everything + both manifests
    python scripts/build_brand_marks.py --only leagues     # leagues | programs | tv
    python scripts/build_brand_marks.py --check            # rebuild to a temp dir, diff, exit 1 on FAIL

Sources live under assets/ and are NEVER committed; the outputs under web/public/ are. That is the
same split build_web_marks.py uses for the network suite, and this script deliberately imports that
module's pixel helpers rather than re-deriving them - `derive`, `floor_l`, `dark_ready`, `trim`,
`ink_area`, `resize_h` and the `HF_MIN`/`HF_MAX` clamp are the frozen 2026-09-02 rules, and a second
copy of them would be a second thing to keep in sync. (`whiten_dark` and `ALPHA_VISIBLE` come across
too: IndyCar needs the identical lightness cut, applied to a row range instead of the whole image.)

THREE CLASSES, THREE DIFFERENT JOBS:

  leagues   256px, published in BOTH a raw and a _dark variant, drawn at their natural height.
            A league mark is an identity, not a service badge; it is not ink-normalized, because the
            NFL shield and the NASCAR wordmark are supposed to look like a shield and a wordmark.
  programs  128px, ink-normalized with an `hf` exactly like a network mark - because a program logo
            sits NEXT TO network marks in the banner. The normalization TARGET is read from the frozen
            network manifest and is never recomputed from the programs themselves (see target()).
  tv        one 700px cutout, the banner's centerpiece.

WHY THE RESAMPLE IS ONE STEP. build_web_marks normalizes every source to WORK_H=512 before its recipe
runs. Here the published raw is resized from the trimmed source STRAIGHT to 256: routing it through
512 first costs a second resample and moves CFP's ink area by 1.17%, outside this script's own 1%
--check tolerance. The 512 working copy is still built where a recipe needs it (the dark derivations),
because those rules were tuned at that size. The TV cutout is not trimmed at all - its transparent
margin is part of the frame the banner layout was measured against.

Windows-portable: no %-strftime, every open() passes encoding=, ASCII-only console output.
"""
from __future__ import annotations

import argparse
import json
import shutil
import statistics
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from adapters.common import find_repo_root  # noqa: E402
from build_web_marks import (  # noqa: E402
    ALPHA_VISIBLE,
    HF_MAX,
    HF_MIN,
    dark_ready,
    derive,  # noqa: F401 - part of the frozen helper set; kept importable for recipe edits
    floor_l,
    ink_area,
    resize_h,
    trim,
    whiten_dark,
)

from PIL import Image  # noqa: E402

ROOT = find_repo_root()
LEAGUE_SRC = ROOT / "assets" / "league-logos"
LEAGUE_OUT = ROOT / "web" / "public" / "leagues"
PROG_SRC = ROOT / "assets" / "program-logos"
PROG_OUT = ROOT / "web" / "public" / "programs"
TV_SRC = ROOT / "assets" / "brand" / "tv-cutout-hires.png"
TV_OUT = ROOT / "web" / "public" / "brand" / "tv-cutout.png"
NET_MANIFEST = ROOT / "web" / "public" / "marks" / "manifest.json"
LAYOUT = ROOT / "web" / "lib" / "banner-layout.json"

WORK_H = 512          # working height for the dark derivations (build_web_marks' convention)
LEAGUE_H = 256        # published league height
PROG_H = 128          # published program height, same as the network marks
TV_H = 700

# Programs rasterize far above their working height. The Big Noon SVG is a stack of thin strokes whose
# TRIMMED aspect keeps growing with raster resolution - 1.568 at 256, 1.613 at 512, 1.637 at 1024 -
# because at low resolution the outermost strokes render too faint to survive the alpha>=16 trim. It
# settles at 212x128 by 3072, which is the shipped geometry; anything smaller publishes a narrower mark
# and moves every `ar` in the banner layout. Leagues do not need this: their sources are already
# bitmaps, and NASCAR's vector is solid bars that trim identically at any size.
PROG_RASTER_H = 3072

# Banner ring order, which is also the manifest order. Not sorted: the ring reads NFL-first.
LEAGUES = ["nfl", "nba", "mlb", "nhl", "cfp", "wwe", "ufc", "aew", "nascar", "indycar"]

DARK_PROVIDER = "provider-dark (ESPN 500-dark)"
DARK_CHAIN = "dark_ready chain"


# ----------------------------------------------------------------------------- helpers
def lum(im: Image.Image) -> float:
    """Alpha-weighted mean luminance over visible pixels - the number both manifests report."""
    im = im.convert("RGBA")
    px = im.load()
    tot = w = 0.0
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a < ALPHA_VISIBLE:
                continue
            tot += ((r + g + b) / 3) * (a / 255)
            w += a / 255
    return round(tot / w, 1) if w else 0.0


def aspect(im: Image.Image) -> float:
    return round(im.width / max(1, im.height), 3)


def rasterize(src: Path, out: Path, height: int) -> bool:
    """SVG -> PNG through the same Chromium rasterizer build_web_marks.py uses."""
    web = ROOT / "web"
    script = web / "scripts" / "rasterize-svg.mjs"
    node = shutil.which("node")
    if not node or not script.exists() or not (web / "node_modules" / "playwright").exists():
        print("  warn: no SVG rasterizer (node + web/node_modules/playwright required)")
        return False
    with tempfile.TemporaryDirectory() as d:
        jf = Path(d) / "jobs.json"
        jf.write_text(json.dumps([{"src": str(src), "out": str(out), "height": height}]), encoding="utf-8")
        r = subprocess.run([node, str(script), str(jf)], cwd=str(web), capture_output=True, text=True)
    if r.returncode != 0:
        print("  warn: rasterizer failed rc=%d: %s" % (r.returncode, (r.stderr or "").strip()[:200]))
        return False
    return True


def key_white(im: Image.Image) -> Image.Image:
    """Knock out the white BACKGROUND of a JPEG by flooding inward from the border.

    A global "white is transparent" test would also delete the white INSIDE the mark - the highlights
    in the IndyCar badge and the wordmark's own counters. Flooding from the border only removes white
    that is connected to the outside, which is the actual definition of background. A pixel is
    floodable when it is bright (mean > 225) and near-neutral (max-min chroma < 30), so the light-grey
    JPEG ringing around the badge goes with it while the brand red and blue stay.
    """
    import numpy as np
    from scipy import ndimage

    rgb = im.convert("RGB")
    a = np.asarray(rgb).astype(np.int16)
    cand = (a.mean(axis=2) > 225) & ((a.max(axis=2) - a.min(axis=2)) < 30)
    lab, _ = ndimage.label(cand)
    edge = set(lab[0, :]) | set(lab[-1, :]) | set(lab[:, 0]) | set(lab[:, -1])
    edge.discard(0)
    bg = np.isin(lab, list(edge))
    alpha = np.where(bg, 0, 255).astype(np.uint8)
    return Image.fromarray(np.dstack([np.asarray(rgb), alpha]), "RGBA")


def whiten_below_gap(im: Image.Image, cut: float = 0.35) -> Image.Image:
    """Whiten dark pixels only in the WORDMARK rows - the block under the badge's empty-row gap.

    IndyCar is a black-is-background plate in the same family as ABC: the badge must stay raw (its
    black is the shape), while the black wordmark beneath it has to go white or it vanishes into the
    charcoal. The two are separated by a band of fully transparent rows, so the split is found rather
    than hardcoded - a re-crop of the source moves the boundary and this still lands on it.
    """
    im = im.convert("RGBA")
    alpha = im.split()[3].load()
    empty = [all(alpha[x, y] < ALPHA_VISIBLE for x in range(im.width)) for y in range(im.height)]
    runs, start = [], None
    for i, e in enumerate(empty):
        if e and start is None:
            start = i
        elif not e and start is not None:
            runs.append((start, i))
            start = None
    if start is not None:
        runs.append((start, len(empty)))
    inner = [r for r in runs if r[0] > 0 and r[1] < len(empty)]
    if not inner:
        return im
    gap = max(inner, key=lambda r: r[1] - r[0])
    out = im.copy()
    out.paste(whiten_dark(im.crop((0, gap[1], im.width, im.height)), cut), (0, gap[1]))
    return out


# ----------------------------------------------------------------------------- leagues
def league_raw(slug: str, tmp: Path) -> Image.Image | None:
    """The untrimmed, full-resolution raw for one league.

    Two sources are not a plain {slug}.png. Cowork left rebuilt intermediates beside them in
    assets/league-logos (nascar.png, indycar.png and their _dark pairs); those are OUTPUTS of these
    recipes, not provider files, and reading them would make this script a copier instead of a builder.
    """
    if slug == "nascar":
        # Vector source: the bitmap beside it is a raster of these same bars, not a provider asset.
        out = tmp / "nascar-raster.png"
        if not rasterize(LEAGUE_SRC / "nascar.svg", out, WORK_H):
            return None
        return Image.open(out).convert("RGBA")
    if slug == "indycar":
        return key_white(Image.open(LEAGUE_SRC / "indycar-source.jpg"))
    p = LEAGUE_SRC / ("%s.png" % slug)
    return Image.open(p).convert("RGBA") if p.exists() else None


def build_leagues(out_dir: Path) -> list[dict[str, Any]]:
    out_dir.mkdir(parents=True, exist_ok=True)
    tmp = Path(tempfile.mkdtemp(prefix="mysports-brand-"))
    rows: list[dict[str, Any]] = []
    for slug in LEAGUES:
        src = league_raw(slug, tmp)
        if src is None:
            print("  warn: %s: no source - skipped" % slug)
            continue
        raw = resize_h(trim(src), LEAGUE_H)
        work = resize_h(trim(src), WORK_H)          # the darks were tuned at this height

        prov = LEAGUE_SRC / ("%s_dark.png" % slug)
        if slug == "indycar":
            dark = resize_h(trim(whiten_below_gap(work)), LEAGUE_H)
            how = "badge raw + wordmark whitened (black-is-background plate, like ABC)"
        elif slug == "nascar":
            dark = resize_h(trim(dark_ready(work)), LEAGUE_H)
            how = "dark_ready chain (derive: black wordmark -> white; bars kept)"
        elif prov.exists():
            dark = resize_h(trim(Image.open(prov).convert("RGBA")), LEAGUE_H)
            how = DARK_PROVIDER
        else:
            dark = resize_h(trim(dark_ready(work)), LEAGUE_H)
            how = DARK_CHAIN

        raw.save(out_dir / ("%s.png" % slug), "PNG", optimize=True)
        dark.save(out_dir / ("%s_dark.png" % slug), "PNG", optimize=True)
        rows.append({"slug": slug, "raw_lum": lum(raw), "dark_lum": lum(dark),
                     "dark_source": how, "aspect": aspect(raw)})
        print("  league %-8s raw %-11s dark %-11s" % (slug, "%dx%d" % raw.size, "%dx%d" % dark.size))
    (out_dir / "leagues-manifest.json").write_text(json.dumps(rows, indent=2) + "\n", encoding="utf-8")
    return rows


# ----------------------------------------------------------------------------- programs
def target() -> float:
    """The ink-area TARGET the network suite was normalized to, recovered from its frozen manifest.

    hf = sqrt(target/area) for every mark the clamp did not bite, so hf^2 * area == target there and
    the median over those marks returns the original number (11734 as of 2026-09-02). Marks sitting ON
    a clamp bound carry no information about the target and are excluded, as is guardians-tv, whose hf
    is a hand override rather than a measurement.

    READ, never recomputed from the programs. A program mark has to weigh the same as the networks it
    sits beside; normalizing the two programs against each other would instead make them weigh the
    same as EACH OTHER - a different and useless invariant. The network manifest is never written here.
    """
    man = json.loads(NET_MANIFEST.read_text(encoding="utf-8"))
    vals = []
    for row in man:
        slug, hf = row["slug"], float(row["hf"])
        if slug == "guardians-tv" or not (HF_MIN < hf < HF_MAX):
            continue
        p = NET_MANIFEST.parent / ("%s.png" % slug)
        if p.exists():
            vals.append(hf * hf * ink_area(trim(Image.open(p).convert("RGBA"))))
    return statistics.median(vals) if vals else 1.0


# Frozen in the 2026-09-02 design session.
PROGRAMS: list[tuple[str, str, str]] = [
    ("big-noon-kickoff", "svg", "floor_l 0.55 (FOX blue lifted; white + yellow untouched)"),
    # The sponsor-free shield was rebuilt by hand; the source PNG IS the deliverable, so any recipe
    # here would only degrade it. Its dark body is legal under the NHL/ABC ruling: it reads by rim
    # and white text, and lifting it would produce the grey plate the no-plate rule forbids.
    ("college-gameday", "png", "RAW — sponsor block removed, shield rebuilt; dark body reads by "
                               "rim + white text (NHL/ABC ruling)"),
]


def build_programs(out_dir: Path) -> list[dict[str, Any]]:
    out_dir.mkdir(parents=True, exist_ok=True)
    tmp = Path(tempfile.mkdtemp(prefix="mysports-prog-"))
    tgt = target()
    rows: list[dict[str, Any]] = []
    for slug, kind, recipe in PROGRAMS:
        if kind == "svg":
            out = tmp / ("%s.png" % slug)
            if not rasterize(PROG_SRC / ("%s.svg" % slug), out, PROG_RASTER_H):
                print("  warn: %s: no rasterizer - skipped" % slug)
                continue
            im = Image.open(out).convert("RGBA")
        else:
            p = PROG_SRC / ("%s.png" % slug)
            if not p.exists():
                print("  warn: %s: no source - skipped" % slug)
                continue
            im = Image.open(p).convert("RGBA")

        work = resize_h(trim(im), WORK_H)
        work = floor_l(work, 0.55) if slug == "big-noon-kickoff" else work
        pub = resize_h(trim(work), PROG_H)
        area = ink_area(pub)
        hf = round(min(HF_MAX, max(HF_MIN, (tgt / area) ** 0.5 if area else 1.0)), 3)
        pub.save(out_dir / ("%s.png" % slug), "PNG", optimize=True)
        rows.append({"slug": slug, "hf": float(hf), "recipe": recipe,
                     "ink_area": round(area), "target": round(tgt), "lum": lum(pub)})
        print("  program %-18s %-9s hf %.3f ink %d (target %d)"
              % (slug, "%dx%d" % pub.size, hf, round(area), round(tgt)))
    (out_dir / "manifest.json").write_text(json.dumps(rows, indent=2) + "\n", encoding="utf-8")
    return rows


# ----------------------------------------------------------------------------- tv
def build_tv(out_path: Path) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    im = Image.open(TV_SRC).convert("RGBA")
    # NOT trimmed: the cutout's transparent margin is part of the frame the banner was measured on.
    out = resize_h(im, TV_H)
    out.save(out_path, "PNG", optimize=True)
    print("  tv       %s" % ("%dx%d" % out.size))


# ----------------------------------------------------------------------------- ar back-fill
def update_layout_ar() -> int:
    """Refresh every banner mark's `ar` (width/height) from the PNG that will actually be drawn.

    The Banner component sizes each <image> as h*ar, so this is the one number the SVG cannot work out
    for itself. Written here rather than measured at request time, so the server component stays a
    pure function of the JSON and needs no image library of its own.
    """
    if not LAYOUT.exists():
        return 0
    d = json.loads(LAYOUT.read_text(encoding="utf-8"))
    n = 0
    for side in ("pc", "mobile"):
        for m in d.get(side, {}).get("marks", []):
            p = ROOT / "web" / "public" / m["href"].lstrip("/")
            if not p.exists():
                continue
            with Image.open(p) as im:
                ar = round(im.width / max(1, im.height), 4)
            if m.get("ar") != ar:
                m["ar"] = ar
                n += 1
    if n:
        LAYOUT.write_text(json.dumps(d, indent=2) + "\n", encoding="utf-8")
    return n


# ----------------------------------------------------------------------------- check
def check() -> int:
    """Rebuild into a temp tree and diff against what is committed.

    Pixel BYTES are not the contract - PNG encoders and libjpeg builds differ between machines, and a
    byte comparison would fail for reasons that have nothing to do with the art. Identical pixel
    dimensions plus ink area within 1% IS the contract, because those are the two properties the
    banner layout actually depends on: `ar` comes from the dimensions, and visual weight from the ink.
    """
    tmp = Path(tempfile.mkdtemp(prefix="mysports-check-"))
    print("rebuilding to a temp tree for --check ...")
    build_leagues(tmp / "leagues")
    build_programs(tmp / "programs")
    build_tv(tmp / "brand" / "tv-cutout.png")

    pairs: list[tuple[str, Path, Path]] = []
    for slug in LEAGUES:
        for suffix in ("", "_dark"):
            name = "%s%s.png" % (slug, suffix)
            pairs.append(("leagues/" + name, LEAGUE_OUT / name, tmp / "leagues" / name))
    for slug, _, _ in PROGRAMS:
        n = "%s.png" % slug
        pairs.append(("programs/" + n, PROG_OUT / n, tmp / "programs" / n))
    pairs.append(("brand/tv-cutout.png", TV_OUT, tmp / "brand" / "tv-cutout.png"))

    print("")
    print("%-30s %-12s %-12s %10s %10s %8s  %s"
          % ("file", "shipped", "rebuilt", "ink ship", "ink new", "delta%", "result"))
    print("-" * 100)
    fails = 0
    for name, ship_p, new_p in pairs:
        if not ship_p.exists() or not new_p.exists():
            print("%-30s %-12s %-12s %10s %10s %8s  %s"
                  % (name, "yes" if ship_p.exists() else "MISSING",
                     "yes" if new_p.exists() else "MISSING", "-", "-", "-", "FAIL"))
            fails += 1
            continue
        a = Image.open(ship_p).convert("RGBA")
        b = Image.open(new_p).convert("RGBA")
        ia, ib = ink_area(a), ink_area(b)
        delta = 100 * abs(ia - ib) / ia if ia else (0.0 if ib == 0 else 100.0)
        ok = a.size == b.size and delta <= 1.0
        fails += 0 if ok else 1
        print("%-30s %-12s %-12s %10.1f %10.1f %8.3f  %s"
              % (name, "%dx%d" % a.size, "%dx%d" % b.size, ia, ib, delta, "PASS" if ok else "FAIL"))
    print("-" * 100)
    print("%d checked, %d PASS, %d FAIL (tolerance: identical size, ink area within 1 pct)"
          % (len(pairs), len(pairs) - fails, fails))
    return 1 if fails else 0


# ----------------------------------------------------------------------------- cli
def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Build league + program marks and the TV cutout.")
    ap.add_argument("--only", choices=["leagues", "programs", "tv"], help="build one class only")
    ap.add_argument("--check", action="store_true", help="rebuild to a temp dir and diff; exit 1 on FAIL")
    a = ap.parse_args(argv)

    if a.check:
        return check()

    if a.only in (None, "leagues"):
        build_leagues(LEAGUE_OUT)
    if a.only in (None, "programs"):
        build_programs(PROG_OUT)
    if a.only in (None, "tv"):
        build_tv(TV_OUT)
    n = update_layout_ar()
    print("banner-layout.json: %d ar value(s) updated" % n)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
