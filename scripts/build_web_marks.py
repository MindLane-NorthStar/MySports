#!/usr/bin/env python3
"""Build the web app's processed network marks: assets/network-logos/* -> web/public/marks/*.png.

    python scripts/build_web_marks.py                 # all marks + manifest
    python scripts/build_web_marks.py --only espn-plus apple-tv
    python scripts/build_web_marks.py --list          # show the recipe each slug would use

Outputs (committed, unlike everything else under assets/): one trimmed PNG per network plus
`web/public/marks/manifest.json` = `[{"slug": ..., "hf": ...}]`.

**Why a table and not one clever rule.** A single derive rule cannot serve marks this different: Apple
TV is a solid black glyph whose antialias fringe goes milky on charcoal, the Big Ten and Prime Video
wordmarks are black type that must become white, ESPNU is already a light mark that any "brighten"
step would wreck, and Paramount+ ships a white SVG that needs nothing at all. The recipes below are
Joe's approved per-network decisions (2026-09-02), frozen so the app's marks stop moving between runs.
Anything not named falls to `dark_ready`, which is the conservative general rule.

`hf` is the per-mark display multiplier from ink-area normalization: the app renders every mark at the
same base height and multiplies by `hf`, so a thin wordmark and a fat roundel carry the same visual
weight. It is computed here ONCE and frozen in the manifest - the app never re-derives it.

Windows-portable: no %-strftime, every open() passes encoding=, ASCII console output. SVG sources are
rasterized through Playwright's Chromium (web/scripts/rasterize-svg.mjs) because cairosvg cannot load
the native cairo DLL on this machine; when neither is available the PNG source is used with a warning.
"""
from __future__ import annotations

import argparse
import colorsys
import json
import shutil
import statistics
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any, Callable

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from adapters.common import find_repo_root  # noqa: E402

from PIL import Image, ImageDraw, ImageFont  # noqa: E402

ROOT = find_repo_root()
SRC_DIR = ROOT / "assets" / "network-logos"
OUT_DIR = ROOT / "web" / "public" / "marks"
FONT_DIR = ROOT / "assets" / "fonts"

WORK_H = 512          # every mark is processed at this height, then trimmed and published
PUBLISH_H = 128       # published raster height; the app sizes by height, so width rides along
ALPHA_VISIBLE = 16    # below this a pixel is not part of the mark
GRAY_SPREAD = 46      # max(r,g,b) - min(r,g,b) below this is "gray" (contract's derive_dark_mark rule)


# ----------------------------------------------------------------------------- pixel helpers
def _px(im: Image.Image):
    im = im.convert("RGBA")
    return im, im.load()


def derive(im: Image.Image) -> Image.Image:
    """Gray pixels get luminance-inverted, but ONLY when the mark's gray body is dark (mean < 128).

    The contract's rail rule, with the guard that matters here: a light mark must never be darkened.
    ESPNU and Paramount+ are already white; inverting them would produce a black mark on charcoal.
    Colored pixels keep their brand color either way.
    """
    im, px = _px(im)
    tot = n = 0
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a < ALPHA_VISIBLE or max(r, g, b) - min(r, g, b) >= GRAY_SPREAD:
                continue
            tot += (r + g + b) // 3
            n += 1
    if not n or tot / n >= 128:
        return im
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a < ALPHA_VISIBLE or max(r, g, b) - min(r, g, b) >= GRAY_SPREAD:
                continue
            l = 255 - (r + g + b) // 3
            px[x, y] = (l, l, l, a)
    return im


def floor_l(im: Image.Image, f: float = 0.5) -> Image.Image:
    """HLS lightness FLOOR: l' = f + l*0.25, applied only where that raises the pixel.

    Hue and saturation are untouched, so FS1's red stays red - it just stops disappearing into
    #23262B. Never darkens: a pixel already above the floor is left exactly as it was.
    """
    im, px = _px(im)
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a < ALPHA_VISIBLE:
                continue
            h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
            nl = f + l * 0.25
            if nl > l:
                r2, g2, b2 = colorsys.hls_to_rgb(h, min(1.0, nl), s)
                px[x, y] = (int(r2 * 255), int(g2 * 255), int(b2 * 255), a)
    return im


def whiten_dark(im: Image.Image, cut: float) -> Image.Image:
    """Every visible pixel darker than `cut` (HLS lightness) becomes near-white 245,245,245.

    For black TYPE - the Big Ten and Prime Video wordmarks - where a gradient-preserving derive would
    leave gray mush. Alpha is preserved, so the letterforms keep their antialiasing.
    """
    im, px = _px(im)
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a < ALPHA_VISIBLE:
                continue
            _, l, _ = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
            if l < cut:
                px[x, y] = (245, 245, 245, a)
    return im


def alpha_harden(im: Image.Image, solid: int = 180, mult: float = 1.35, fringe_cut: int = 140) -> Image.Image:
    """Make the body fully opaque and delete the dark low-alpha fringe.

    Apple TV's glyph is black on transparent; its antialiased edge is dark AND semi-transparent, which
    reads as a milky halo on charcoal. Pixels at or above `solid` become opaque, dark pixels below
    `fringe_cut` are dropped outright, and what remains is multiplied toward opacity.
    """
    im, px = _px(im)
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            if a >= solid:
                px[x, y] = (r, g, b, 255)
            elif a < fringe_cut and (r + g + b) / 3 < 128:
                px[x, y] = (r, g, b, 0)
            else:
                px[x, y] = (r, g, b, min(255, int(a * mult)))
    return im


def key_plate(im: Image.Image, tol: int = 34) -> Image.Image:
    """Knock out a flat background PLATE by flooding inward from the border.

    Some brand composites ship as artwork on an opaque rectangle rather than on transparency - the
    Guardians TV mark is a navy plate carrying a red logo and a white wordmark, with no alpha channel
    at all. Left alone, `dark_ready` reads that dark plate's luminance, applies its lightness floor,
    and turns the navy into a conspicuous mid-blue: a BACKING CARD on charcoal, which contract v1.3e
    forbids outright ("every logo floats, no backing").

    FLOOD FROM THE BORDER rather than keying a colour range globally, for the same reason IndyCar
    does in build_brand_marks.py: a global test would also delete any pixel of that colour INSIDE the
    artwork - a dark outline, a shadow, a letter counter. Flooding removes only what is connected to
    the outside, which is the actual definition of a background.
    """
    import numpy as np
    from scipy import ndimage

    im = im.convert("RGBA")
    a = np.asarray(im).astype(int)
    # The plate colour is whatever the border is; sampling it beats hardcoding a hex per network.
    edge = np.concatenate([a[0, :, :3], a[-1, :, :3], a[:, 0, :3], a[:, -1, :3]])
    plate = np.median(edge, axis=0)
    dist = np.sqrt(((a[:, :, :3] - plate) ** 2).sum(axis=2))
    cand = dist <= tol
    lab, _ = ndimage.label(cand)
    touching = set(lab[0, :]) | set(lab[-1, :]) | set(lab[:, 0]) | set(lab[:, -1])
    touching.discard(0)
    bg = np.isin(lab, list(touching))
    alpha = np.where(bg, 0, a[:, :, 3]).astype("uint8")
    return Image.fromarray(np.dstack([a[:, :, :3].astype("uint8"), alpha]), "RGBA")


def dark_ready(im: Image.Image) -> Image.Image:
    """The general rule for every network without a recipe of its own.

    A mark that is genuinely colored (more than 8% of its visible pixels) is left RAW - its brand color
    is the thing that identifies it. A gray/black mark is derived to white. Either way, if the result
    is still too dark to read on charcoal (alpha-weighted luminance < 95) it gets the 0.5 lightness floor.
    """
    im, px = _px(im)
    colored = visible = 0
    lum_w = w = 0.0
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a < ALPHA_VISIBLE:
                continue
            visible += 1
            if max(r, g, b) - min(r, g, b) >= GRAY_SPREAD:
                colored += 1
            lum_w += ((r + g + b) / 3) * (a / 255)
            w += a / 255
    out = im if (visible and colored / visible > 0.08) else derive(im)
    if w and (lum_w / w) < 95:
        out = floor_l(out, 0.5)
    return out


# ----------------------------------------------------------------------------- suffixes
def _font(name: str, size: int):
    p = FONT_DIR / name
    try:
        return ImageFont.truetype(str(p), size)
    except Exception:  # noqa: BLE001 - a missing font must not stop the build
        return ImageFont.load_default()


def with_suffix(im: Image.Image, plus: str | None = None, subline: str | None = None) -> Image.Image:
    """The PC contract's suffix convention, as pixels.

    `plus` draws a white '+' beside the mark at ~62% of its height (ESPN+, SEC Network+).
    `subline` draws a letterspaced uppercase word beneath it (ESPN Unlimited -> 'UNLIMITED').
    The mark itself is never scaled here; ink-area normalization runs afterwards on the composite.
    """
    im = trim(im.convert("RGBA"))
    w, h = im.size
    pad = max(2, h // 16)
    if plus:
        size = max(8, int(h * 0.62))
        font = _font("Inter-Bold.ttf", size)
        probe = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
        box = probe.textbbox((0, 0), plus, font=font)
        pw, ph = box[2] - box[0], box[3] - box[1]
        out = Image.new("RGBA", (w + pad + pw, h), (0, 0, 0, 0))
        out.paste(im, (0, 0), im)
        ImageDraw.Draw(out).text((w + pad - box[0], (h - ph) // 2 - box[1]), plus,
                                 font=font, fill=(245, 245, 245, 255))
        return out
    if subline:
        size = max(7, int(h * 0.30))
        font = _font("Inter-SemiBold.ttf", size)
        track = max(1, size // 6)                       # letterspacing, drawn glyph by glyph
        probe = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
        widths = [probe.textbbox((0, 0), c, font=font)[2] for c in subline]
        tw = sum(widths) + track * (len(subline) - 1)
        th = probe.textbbox((0, 0), subline, font=font)[3]
        out = Image.new("RGBA", (max(w, tw), h + pad + th), (0, 0, 0, 0))
        out.paste(im, ((out.width - w) // 2, 0), im)
        d = ImageDraw.Draw(out)
        x = (out.width - tw) // 2
        for c, cw in zip(subline, widths):
            d.text((x, h + pad), c, font=font, fill=(245, 245, 245, 255))
            x += cw + track
        return out
    return im


# ----------------------------------------------------------------------------- geometry
def trim(im: Image.Image) -> Image.Image:
    """Crop transparent padding. Every measurement downstream assumes the mark touches its own edges."""
    im = im.convert("RGBA")
    box = im.split()[3].point(lambda a: 255 if a >= ALPHA_VISIBLE else 0).getbbox()
    return im.crop(box) if box else im


def ink_area(im: Image.Image) -> float:
    """Visible pixels, normalized to a 100px-tall mark: visible * (100/h)^2.

    Height-normalized so a wide wordmark and a square roundel are compared by how much ink they put on
    the page at the same rendered height - which is what the eye actually weighs.
    """
    a = im.split()[3]
    visible = sum(1 for v in a.tobytes() if v >= ALPHA_VISIBLE)
    return visible * (100.0 / max(1, im.height)) ** 2


def resize_h(im: Image.Image, h: int) -> Image.Image:
    w = max(1, round(im.width * h / max(1, im.height)))
    return im.resize((w, h), Image.LANCZOS)


# ----------------------------------------------------------------------------- recipe table
# Joe-approved 2026-09-02. Every entry is (source kind, callable). Source kind 'svg' means the vector
# is rasterized first; 'png' is the cached bitmap. Anything absent from this table gets dark_ready.
RECIPES: dict[str, tuple[str, Callable[[Image.Image], Image.Image]]] = {
    # ABC is the one mark whose BLACK IS BACKGROUND, not ink: a black roundel carrying a white ring and
    # white letters (72.8% black / 21.5% white in the source). dark_ready reads that black disc as a dark
    # mark and inverts it, producing a WHITE PLATE with 50%-grey letters - the white backing the mobile
    # addendum forbids outright, and unreadable besides. Raw, the disc simply disappears into the
    # charcoal and the white ring and letters read exactly as designed. Added 2026-09-02 during the
    # spec audit; it is a deviation from "everything else -> dark_ready" that the no-plate rule requires.
    "abc":              ("png", lambda im: im),
    "apple-tv":         ("png", lambda im: alpha_harden(im)),
    "big-ten-network":  ("png", lambda im: whiten_dark(im, 0.32)),
    "prime-video":      ("png", lambda im: whiten_dark(im, 0.35)),
    "nbc":              ("png", derive),
    "peacock":          ("png", derive),
    "espnu":            ("png", lambda im: im),                       # already a light mark - RAW
    "fs1":              ("png", lambda im: floor_l(im, 0.58)),
    "disney-plus":      ("svg", lambda im: floor_l(derive(im), 0.5)),
    "hbo-max":          ("svg", derive),                              # white wordmark
    "paramount-plus":   ("svg", lambda im: im),                       # ships white - RAW
    "sec-network":      ("svg", lambda im: im),
    "sec-network-plus": ("svg", lambda im: with_suffix(im, plus="+")),
    "espn-plus":        ("png", lambda im: with_suffix(floor_l(im, 0.5), plus="+")),
    "espn-unlimited":   ("png", lambda im: with_suffix(floor_l(im, 0.5), subline="UNLIMITED")),
    # The source is artwork on an OPAQUE NAVY PLATE (13,34,58 over 60% of the frame, no alpha at
    # all). dark_ready alone read that plate as a dark mark, floored its lightness, and shipped a
    # mid-blue backing card - which is what v1.3e forbids. Key the plate off first, then the
    # normal chain sees only the red logo and white wordmark.
    "guardians-tv":     ("png", lambda im: dark_ready(key_plate(im))),
    "mlb-network":      ("png", dark_ready),                          # brand composite
}
# SEC Network+ has no vector of its own: it is the SEC Network lockup plus a '+'.
SVG_ALIAS = {"sec-network-plus": "sec-network"}
# Ink-area normalization override (Joe): the Guardians composite reads small beside the others.
HF_OVERRIDE = {"guardians-tv": 1.25}
HF_MIN, HF_MAX = 0.62, 1.15


# ----------------------------------------------------------------------------- sources
def slugs() -> list[str]:
    return sorted({p.stem for p in SRC_DIR.glob("*.png")} | {p.stem for p in SRC_DIR.glob("*.svg")})


def rasterize(jobs: list[dict[str, Any]]) -> bool:
    """Batch SVG -> PNG through Playwright's Chromium. Returns False when no rasterizer is available."""
    if not jobs:
        return True
    web = ROOT / "web"
    script = web / "scripts" / "rasterize-svg.mjs"
    node = shutil.which("node")
    if not node or not script.exists() or not (web / "node_modules" / "playwright").exists():
        print("  warn: no SVG rasterizer (node + web/node_modules/playwright required) - "
              "falling back to the PNG source for every svg recipe")
        return False
    with tempfile.TemporaryDirectory() as d:
        jf = Path(d) / "jobs.json"
        jf.write_text(json.dumps(jobs), encoding="utf-8")
        r = subprocess.run([node, str(script), str(jf)], cwd=str(web), capture_output=True, text=True)
    if r.returncode != 0:
        print(f"  warn: rasterizer failed ({r.returncode}): {(r.stderr or '').strip()[:300]} - "
              "falling back to the PNG source")
        return False
    return True


def load_source(slug: str, kind: str, rasters: dict[str, Path]) -> Image.Image | None:
    if kind == "svg" and slug in rasters and rasters[slug].exists():
        return Image.open(rasters[slug]).convert("RGBA")
    p = SRC_DIR / f"{slug}.png"
    if p.exists():
        return Image.open(p).convert("RGBA")
    return None


# ----------------------------------------------------------------------------- build
def build(only: list[str] | None = None) -> list[dict[str, Any]]:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    todo = [s for s in slugs() if not only or s in only]
    raster_dir = Path(tempfile.mkdtemp(prefix="mysports-marks-"))
    jobs, rasters = [], {}
    for slug in todo:
        kind, _ = RECIPES.get(slug, ("png", dark_ready))
        if kind != "svg":
            continue
        src = SRC_DIR / f"{SVG_ALIAS.get(slug, slug)}.svg"
        if src.exists():
            out = raster_dir / f"{slug}.png"
            rasters[slug] = out
            jobs.append({"src": str(src), "out": str(out), "height": WORK_H})
    if not rasterize(jobs):
        rasters = {}

    processed: dict[str, Image.Image] = {}
    for slug in todo:
        kind, recipe = RECIPES.get(slug, ("png", dark_ready))
        im = load_source(slug, kind, rasters)
        if im is None:
            print(f"  warn: {slug}: no source file - skipped")
            continue
        im = resize_h(trim(im), WORK_H)
        processed[slug] = trim(recipe(im))

    # ---- ink-area normalization, frozen into the manifest
    areas = {s: ink_area(im) for s, im in processed.items()}
    target = statistics.median(areas.values()) if areas else 1.0
    manifest: list[dict[str, Any]] = []
    for slug in sorted(processed):
        im = processed[slug]
        hf = HF_OVERRIDE.get(slug)
        if hf is None:
            raw = (target / areas[slug]) ** 0.5 if areas[slug] else 1.0
            hf = round(min(HF_MAX, max(HF_MIN, raw)), 3)
        resize_h(im, PUBLISH_H).save(OUT_DIR / f"{slug}.png", "PNG", optimize=True)
        manifest.append({"slug": slug, "hf": float(hf)})
    (OUT_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return manifest


# ----------------------------------------------------------------------------- team logos, dark context
LOGO_DIR = ROOT / "assets" / "logos"
DARK_MAX = 256        # the dark variant is a LISTINGS asset (<= 40px on screen); the raw stays 500px


def team_dark_variants(force: bool = False) -> dict[str, int]:
    """Ensure every team has a `logos/{id}_dark.png` for charcoal-floating contexts (addendum M12).

    Two contexts, two files, and this builds only the second one:
      * grid cap endcaps and light tint plates use the RAW `{id}.png`, never lightness-adjusted (v1.3e);
      * a logo FLOATING on charcoal - listings line 1, the odds slot - uses `{id}_dark.png`.

    **A provider's own dark art always wins.** `scripts/fetch_team_assets.py` already saves ESPN's
    `500-dark` variant as `{id}_dark.png` where ESPN offers one (186 of 496 files today). Those are
    drawn for dark backgrounds by the club's own designers; overwriting them with a derived
    approximation would be strictly worse. Only teams with no such file get the conditioned chain
    (guarded derive, then the 0.5 lightness floor). Idempotent: an existing variant is left alone
    unless --force.
    """
    counts = {"present": 0, "generated": 0, "skipped": 0}
    bases = sorted(p for p in LOGO_DIR.glob("*.png") if not p.stem.endswith("_dark"))
    for p in bases:
        dark = p.with_name(f"{p.stem}_dark.png")
        if dark.exists() and not force:
            counts["present"] += 1          # provider art or a variant built by an earlier run
            continue
        try:
            im = Image.open(p).convert("RGBA")
        except Exception as e:  # noqa: BLE001 - one unreadable logo must not stop the build
            print(f"  warn: {p.name}: {e} - skipped")
            counts["skipped"] += 1
            continue
        im.thumbnail((DARK_MAX, DARK_MAX), Image.LANCZOS)
        floor_l(derive(im), 0.5).save(dark, "PNG", optimize=True)
        counts["generated"] += 1
    return counts


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--only", nargs="+", help="build a subset of slugs")
    ap.add_argument("--list", action="store_true", help="print the recipe per slug and exit")
    ap.add_argument("--team-logos", action="store_true",
                    help="also build assets/logos/{id}_dark.png for charcoal-floating contexts")
    ap.add_argument("--force", action="store_true", help="rebuild dark variants that already exist")
    args = ap.parse_args(argv)
    if args.team_logos:
        c = team_dark_variants(args.force)
        print(f"team dark variants: {c['generated']} generated, {c['present']} already present "
              f"(provider art kept), {c['skipped']} unreadable")
    if args.list:
        for s in slugs():
            kind, _ = RECIPES.get(s, ("png", dark_ready))
            print(f"  {s:20s} {kind:4s} {'recipe' if s in RECIPES else 'dark_ready'}")
        return 0
    manifest = build(args.only)
    print(f"marks: {len(manifest)} -> {OUT_DIR.relative_to(ROOT).as_posix()}/")
    print("  slug                     hf")
    for m in manifest:
        print(f"  {m['slug']:24s} {m['hf']:.3f}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
