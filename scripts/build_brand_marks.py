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
    alpha_harden,
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
    (out_dir / "leagues-manifest.json").write_text(
        json.dumps(rows, indent=2) + "\n", encoding="utf-8", newline="\n")
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


# THE PROGRAM MARK TABLE.  (slug, source kind, treatment, recipe note, provenance)
#
# The first two were frozen in the 2026-09-02 design session and their sources were supplied. The
# five added on 2026-09-06 (prompt 52 stage 7) were SOURCED FROM THE PUBLIC INTERNET, which prompts
# 25, 34 and 38 forbade ("if the source art is not in assets/, stop and report") and which Joe lifted
# FOR THAT RUN ONLY so the logos could land unattended. The next prompt inherits the old rule unless
# it says otherwise.
#
# PROVENANCE IS MANDATORY - a mark with no recorded source does not ship. The quality floor is on the
# FILE, not the source: >=256px on the long edge (or vector), transparent or a flat background that
# keys cleanly, no watermark, no comp overlay, no JPEG ringing.
#
# `treatment` is a callable applied at WORK_H, replacing the per-slug `if slug == ...` branch that
# build_programs() used to carry for Big Noon alone.
PROGRAMS: list[tuple[str, str, Any, str, str]] = [
    ("big-noon-kickoff", "svg", lambda im: floor_l(im, 0.55),
     "floor_l 0.55 (FOX blue lifted; white + yellow untouched)",
     "supplied 2026-09-02 design session"),
    # The sponsor-free shield was rebuilt by hand; the source PNG IS the deliverable, so any recipe
    # here would only degrade it. Its dark body is legal under the NHL/ABC ruling: it reads by rim
    # and white text, and lifting it would produce the grey plate the no-plate rule forbids.
    ("college-gameday", "png", None,
     "RAW — sponsor block removed, shield rebuilt; dark body reads by rim + white text "
     "(NHL/ABC ruling)",
     "supplied 2026-09-02 design session"),

    # ---- added 2026-09-06, prompt 52 stage 7 -------------------------------------------------
    # Flat WHITE plate, keyed by flooding inward from the border (key_white - the same reason
    # IndyCar floods rather than keying a colour globally: a global test would delete that colour
    # INSIDE the artwork too). What is left is the navy shield with white text, which reads on
    # charcoal by body + text under the NHL/ABC ruling.
    ("nfl-today", "png", key_white,
     "key_white — flat white plate flooded out; navy shield reads by body + white text",
     "en.wikipedia.org File:The NFL Today logo.png, 314x318 PNG, fetched 2026-09-06"),

    # Transparent already, but the wordmark is BLACK - invisible on charcoal. whiten_below_gap lifts
    # the dark ink and leaves the NBC peacock and the NFL shield their own colours.
    ("football-night-in-america", "png", lambda im: whiten_below_gap(im, 0.42),
     "whiten_below_gap 0.42 — black wordmark lifted; peacock and NFL shield keep their colour",
     "en.wikipedia.org File:Football Night in America logo.png, 419x238 PNG, fetched 2026-09-06"),

    # Same shape of problem, from a vector source: black type, ESPN red, NFL shield in colour.
    ("sunday-nfl-countdown", "svg", lambda im: whiten_below_gap(im, 0.42),
     "whiten_below_gap 0.42 — black type lifted; ESPN red and the NFL shield untouched",
     "en.wikipedia.org File:Sunday NFL Countdown logo.svg, vector, fetched 2026-09-06"),

    # RAW. A dark shield with a silver rim and white type - the NHL/ABC case exactly, where lifting
    # would produce the grey backing plate contract v1.3e forbids.
    ("monday-night-countdown", "svg", None,
     "RAW — dark shield reads by silver rim + white type (NHL/ABC ruling)",
     "en.wikipedia.org File:Monday Night Countdown logo.svg, vector, fetched 2026-09-06"),

    # ---- replaced and added 2026-09-06, prompt 53 stage 7 -----------------------------------
    #
    # ALL FOUR ARE RAW OR NEARLY SO, AND THAT IS A FINDING RATHER THAN A SHORTCUT. Prompt 53's brief
    # expected the two FOX shields to need `whiten_below_gap`, the treatment that rescues black type
    # on football-night-in-america and sunday-nfl-countdown. IT IS A NO-OP HERE: that function finds
    # a band of fully transparent ROWS separating a badge from a wordmark beneath it, and these
    # shields are one solid stack with no gap, so it returns the image unchanged.
    #
    # `floor_l` was the obvious second try - it is what Big Noon uses for exactly this - and it is
    # WRONG here, measured at the real endcap size (21px on the card's 34px tile). Lifting the black
    # shield body produces precisely the grey backing plate contract v1.3e forbids, and it drags the
    # yellow NFL band down with it: at 0.40 the yellow is already muted and at 0.55 the whole mark
    # goes pale grey-blue and stops being FOX. Raw is crisper and keeps the brand's own colours.
    #
    # What the raw mark actually does on charcoal is the NHL/ABC ruling working as intended: the
    # black body recedes and the mark reads by its WHITE TYPE and its YELLOW BAND. That is the same
    # reason college-gameday and monday-night-countdown ship raw.

    # REPLACES the retired lockup prompt 52 shipped (a 388x395 Wikimedia file, keyed off a flat black
    # plate). This is Joe's own art: 1280x720, current-era, transparent, and the black here is the
    # SHIELD ITSELF rather than a background rectangle - which is why key_white would be wrong now.
    ("fox-nfl-sunday", "png", None,
     "RAW — current-era shield; black body recedes on charcoal and the mark reads by white FOX "
     "+ yellow NFL band + white SUNDAY (NHL/ABC ruling). floor_l tested and rejected: it greys the "
     "plate and washes the yellow",
     "supplied by Joe, 2026-09-06"),

    # THE FIRST PORTRAIT PROGRAM MARK - aspect 0.692, where every other program mark is landscape or
    # square. Stage 8's logo-priority fit reads the aspect from the manifest, so this needs no special
    # case, but it is the one that will demand the most width per unit of height.
    ("fox-nfl-kickoff", "png", None,
     "RAW — same shield family and same reasoning as fox-nfl-sunday. PORTRAIT, aspect 0.692",
     "supplied by Joe, 2026-09-06"),

    # Soft dark halo around the type, which vanishes on charcoal but reads as a smudge at card size.
    # alpha_harden deletes the low-alpha fringe and makes the body solid; compared side by side at
    # 128px on --spot-2 the hardened version is visibly crisper, which is the test the brief asked for.
    ("netflix-gameday", "png", alpha_harden,
     "alpha_harden — the soft near-black halo (avg RGB 7,6,6) reads as a smudge at card size; "
     "hardening it leaves NETFLIX red, GAMEDAY silver and the NFL shield clean",
     "supplied by Joe, 2026-09-06"),

    # Blue shield with white type - already a dark-context mark, and lifting it would flatten the
    # gradient that separates the prime panel from the body.
    #
    # THE ART IS THE THURSDAY NIGHT FOOTBALL GAME SHIELD, not a pregame-show lockup: it reads
    # "THURSDAY NIGHT FOOTBALL" with the NFL and prime marks. Amazon's pregame show is branded "TNF
    # Tonight". Wired as supplied and REPORTED rather than renamed on a guess - `tnfpregame` has zero
    # loaded rows, so there is no database title to check it against either.
    ("tnf-pregame", "png", None,
     "RAW — blue shield, white type, already dark-ready. NOTE: this is the TNF GAME shield, not "
     "a pregame-show mark",
     "supplied by Joe, 2026-09-06"),
]


def build_programs(out_dir: Path) -> list[dict[str, Any]]:
    out_dir.mkdir(parents=True, exist_ok=True)
    tmp = Path(tempfile.mkdtemp(prefix="mysports-prog-"))
    tgt = target()
    rows: list[dict[str, Any]] = []
    for slug, kind, treatment, recipe, source in PROGRAMS:
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
        # The treatment is per-row now, not a per-slug branch. Big Noon's floor_l 0.55 is
        # unchanged; it just lives in the table beside its note instead of inside an `if`.
        if treatment is not None:
            work = treatment(work)
        pub = resize_h(trim(work), PROG_H)
        area = ink_area(pub)
        hf = round(min(HF_MAX, max(HF_MIN, (tgt / area) ** 0.5 if area else 1.0)), 3)
        pub.save(out_dir / ("%s.png" % slug), "PNG", optimize=True)
        rows.append({"slug": slug, "hf": float(hf), "recipe": recipe, "source": source,
                     "w": int(pub.width), "h": int(pub.height),
                     "ink_area": round(area), "target": round(tgt), "lum": lum(pub)})
        print("  program %-18s %-9s hf %.3f ink %d (target %d)"
              % (slug, "%dx%d" % pub.size, hf, round(area), round(tgt)))
    # newline= is working rule 29 - the same fix build_web_marks.py needed.
    (out_dir / "manifest.json").write_text(
        json.dumps(rows, indent=2) + "\n", encoding="utf-8", newline="\n")
    return rows


# ----------------------------------------------------------------------------- tv
def build_tv(out_path: Path) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    im = Image.open(TV_SRC).convert("RGBA")
    # NOT trimmed: the cutout's transparent margin is part of the frame the banner was measured on.
    out = resize_h(im, TV_H)
    out.save(out_path, "PNG", optimize=True)
    print("  tv       %s" % ("%dx%d" % out.size))


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
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
