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
import hashlib
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


def key_neutral(im: Image.Image, spread: int = 18, floor: int = 170) -> Image.Image:
    """Knock out a LIGHT NEUTRAL background by flooding inward from every edge.

    THE PROBLEM `key_plate` CANNOT SOLVE. Some sources come from PNG-aggregator sites that FLATTEN
    TRANSPARENCY ONTO A CHECKERBOARD and ship it as opaque pixels - it looks transparent in a
    thumbnail and is not. `nfl-network` measures 0% clear with its two tones at 255 and 204;
    `accnx` the same at 254 and 237. `key_plate` samples an EDGE MEDIAN and keys that, so a two-tone
    checkerboard defeats it: the median sits between the tones and matches neither.

    So the test here is a PREDICATE rather than a sampled colour - "is this pixel light and roughly
    neutral" - which both tones of a checkerboard satisfy and coloured ink does not:

        |R-G| < spread  and  |G-B| < spread  and  mean(RGB) > floor

    FLOODING FROM THE BORDER IS WHAT MAKES IT SAFE, and it is the same reason `key_plate` and
    IndyCar flood rather than testing globally: the NFL shield's interior WHITE STARS pass the
    predicate exactly as the background does, and a global test would eat them. They are not
    connected to any edge, so a flood never reaches them.

    Anything the flood does not reach keeps alpha 255.
    """
    import numpy as np
    from scipy import ndimage

    im = im.convert("RGBA")
    a = np.asarray(im).astype(int)
    r, g, bl = a[:, :, 0], a[:, :, 1], a[:, :, 2]
    eligible = (
        (np.abs(r - g) < spread)
        & (np.abs(g - bl) < spread)
        & (((r + g + bl) / 3.0) > floor)
    )
    lab, _ = ndimage.label(eligible)
    edge = set(lab[0, :]) | set(lab[-1, :]) | set(lab[:, 0]) | set(lab[:, -1])
    edge.discard(0)
    bg = np.isin(lab, list(edge))
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
    # DIRECTV (prompt 72). IDENTITY, like `abc` and `paramount-plus`, and the reason is that this is
    # THE BRAND'S OWN DARK-BACKGROUND LOCKUP - Joe supplied it after ruling "black text goes white,
    # the blue streak goes a little lighter", which is precisely what the official dark lockup
    # already is. Deriving it would be re-deriving a transformation the brand has already made, and
    # measurably worse on the element that matters: on #101214 the official blue reads 4.19:1 and a
    # `whiten_dark` derivation of the LIGHT lockup reads 3.64:1. Both clear the 3.0 floor; one does
    # it with the brand's own values.
    #
    # NO `key_plate` HERE, and that is worth saying because `guardians-tv` above is the same SHAPE of
    # problem. The art supplied to this repo had already had its black plate keyed and been trimmed
    # (902x304 RGBA, ~70% clear). If a future re-supply arrives as an opaque plate, this becomes
    # `("png", lambda im: key_plate(im))` and nothing else changes.
    "directv":          ("png", lambda im: im),
    "mlb-network":      ("png", dark_ready),                          # brand composite

    # ---- added 2026-09-06, prompt 55 stage 2. All four supplied by Joe. -----------------------
    #
    # TWO OF THEM ARRIVED WITH A CHECKERBOARD BAKED IN. `nfl-network` and `accnx` came from a
    # PNG-aggregator that FLATTENS transparency onto a checkerboard and ships it as opaque pixels:
    # both measure 0% clear, at 255/204 and 254/237 respectively. `key_plate` cannot key that - it
    # samples an EDGE MEDIAN, and a two-tone checkerboard puts the median between the tones where it
    # matches neither. `key_neutral` tests a PREDICATE instead and floods from the border, which is
    # what saves the NFL shield's interior white stars: they pass the predicate exactly as the
    # background does, but a flood never reaches them. Keyed 78.1% and 91.4% of their canvases.

    # The NETWORK wordmark is navy TYPE, and that is why the NHL/ABC ruling does NOT transfer here.
    # ABC and nfl-today are legal because a dark BODY carries LIGHT ink - nfl-today's navy measures
    # 1.17:1 on charcoal and is invisible, but its white text is 17.22:1 and that is what reads.
    # Here the navy IS the word: raw it is 1.45:1, and losing it leaves the NFL league shield, which
    # is a different mark. dark_ready takes it to 4.20:1 and leaves the shield's red and white alone.
    "nfl-network":      ("png", lambda im: dark_ready(key_neutral(im))),

    # `dark_ready` is a NO-OP here, measured: the grey swoosh and ESPN wordmark sit at 7.28:1 and
    # pull the mark's mean up, so the chain decides it is already light and leaves the blue at
    # 2.03:1 - below the 3.0 floor, for the brand's own name. floor_l is the treatment the app
    # already uses for exactly this (fs1: "FS1's red stays red - it just stops disappearing"), and
    # 0.45 brings the blue to 4.75:1 while leaving the grey untouched.
    "accnx":            ("png", lambda im: floor_l(key_neutral(im), 0.45)),

    # THE ABC CASE, almost exactly: a black plate carrying white letters, where the black is the
    # logo's own parallelogram and not a background. key_plate lifts the flat white surround; the
    # plate then recedes into the charcoal and the white letters read as designed. dark_ready was
    # tested and inverts it into a WHITE PLATE with grey letters - the backing card v1.3e forbids,
    # which is the same failure ABC's own note describes.
    "tbs":              ("png", key_plate),

    # THE ONE HONEST COMPROMISE IN THIS SET, and it is measured rather than eyeballed. Both inks
    # start black: "tru" needs to lift off the charcoal, and the "TV" inside the green circle needs
    # to stay dark against it. They pull against each other, and there is no row gap for
    # whiten_below_gap to find because the lockup is horizontal.
    #
    #   treatment      "tru" on charcoal   "TV" on green
    #   RAW                    1.22:1  x        14.00:1
    #   whiten_dark .35       15.80:1           1.38:1  x   <- whitens the TV too
    #   dark_ready             4.30:1           2.67:1  x
    #   floor_l .45            3.58:1           3.21:1      <- both clear the 3.0 floor
    #   floor_l .55            5.12:1           1.11:1  x
    #
    # 0.45 is the only value that keeps BOTH above 3.0. There is no plate to grey here - the
    # background is keyed transparent - so this is not the trap prompt 53 hit with floor_l on the
    # FOX shields.
    "trutv":            ("png", lambda im: floor_l(key_plate(im), 0.45)),
}
# ----------------------------------------------------------------------------- composites
# TWO MARKS THAT ARE NOT ARTWORK: each is two ALREADY-PUBLISHED marks stacked (prompt 104, Joe's
# ruling 2026-09-16 - LIST VIEW ONLY). WOIO/WUAB announced the Cavaliers' fifteen over-the-air
# simulcasts on 2026-09-15, and the package puts a game on WOIO (CBS's Cleveland station), on
# WUAB 43, or on both, alongside the DAZN stream it is a simulcast OF.
#
#   cbs-dazn      the nine WOIO-only games        CBS above DAZN
#   cbs-wuab-43   the four both-station games     CBS above WUAB 43
#
# THE TWO WUAB-ONLY GAMES NEED NOTHING NEW - `wuab-43` already exists, and it already carries
# RESN/DAZN inside it, which is also why `cbs-wuab-43` is a TWO-part stack and not a three.
#
# A RECIPE, NOT A HAND-COMPOSITED PNG, for the reason everything else in this file is one: a
# hand-made bitmap cannot be rebuilt when its parts change, and these parts have moved before.
#
# THE HALVES ARE MATCHED BY WIDTH (Joe's ruling, 2026-09-16, prompt 105), AND THAT OVERRIDES THE
# INK-AREA BALANCE THIS RECIPE SHIPPED WITH.
#
#   "the CBS half is too big in both composites. Scale CBS down so its width equals the width of the
#    mark beneath it, and let its height follow proportionally."
#
# THE OVERRIDDEN RULE IS RECORDED RATHER THAN DELETED, because it was not a bug and the distinction
# matters to whoever reads this next. Prompt 104 balanced the halves by INK AREA - each part scaled
# by sqrt(ref/area) against the smallest area in the stack, deliberately scaling the inkier half
# DOWN - on this file's own argument that `ink_area` exists because equal heights let a wide wordmark
# bury a compact one (web/lib/marks.js's "NBC reads smaller than FOX"). CBS is the widest, inkiest
# mark in the suite, so that rule already shrank it: to 0.787 of DAZN's height, and it still read too
# large to Joe at the real list box. **The recipe had already answered this complaint, by measurement,
# and Joe looked at the answer and ruled it insufficient.** Width matching is a DIFFERENT GOVERNING
# RULE, not a correction: it is scoped to COMPOSITES and nothing else in the suite is touched.
#
# THE COST IS ACCEPTED, NOT DESIGNED AROUND (Joe has seen it). Matching widths makes each stack
# taller and narrower, so `object-fit: contain` in the list card's 56x40 box starts fitting by HEIGHT
# instead of width and the mark loses horizontal size - `cbs-wuab-43` lands at roughly two-thirds of
# the box width. The measured before/after fills are in register §52.
COMPOSITES: dict[str, tuple[str, ...]] = {
    "cbs-dazn":    ("cbs", "dazn"),
    "cbs-wuab-43": ("cbs", "wuab-43"),
}
COMPOSITE_GAP = 0.10          # transparent gap between halves, as a fraction of the taller half


def stack(parts: list[Image.Image], gap_frac: float = COMPOSITE_GAP) -> Image.Image:
    """Stack marks vertically, EVERY PART SCALED TO THE WIDTH OF THE BOTTOM ONE, gap between.

    Joe's ruling of 2026-09-16 - see the note above for what it overrides and why that is a ruling
    rather than a fix. Height follows the width proportionally; nothing else decides the size.

    THE BOTTOM PART SETS THE WIDTH, and for a two-part stack - which is what both composites are -
    that is exactly "the mark beneath it" in Joe's words. For a hypothetical three-part stack this
    reads the BOTTOM-MOST part rather than each part's immediate neighbour; that case does not exist
    yet and is not tested, so it is written down rather than left to be discovered.

    NOTHING IS UPSCALED: the bottom part keeps its published pixels and every part above it is only
    ever made smaller, because it is the widest marks that are being brought down to a narrower one.
    """
    target_w = parts[-1].width
    scaled = []
    for p in parts:
        if p.width == target_w:
            scaled.append(p)
        else:
            h = max(1, round(p.height * target_w / p.width))
            scaled.append(p.resize((target_w, h), Image.LANCZOS))
    gap = max(1, round(gap_frac * max(s.height for s in scaled)))
    w = max(s.width for s in scaled)
    h = sum(s.height for s in scaled) + gap * (len(scaled) - 1)
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    y = 0
    for s in scaled:
        out.paste(s, ((w - s.width) // 2, y), s)
        y += s.height + gap
    return trim(out)


# SEC Network+ has no vector of its own: it is the SEC Network lockup plus a '+'.
SVG_ALIAS = {"sec-network-plus": "sec-network"}
# Ink-area normalization override (Joe): the Guardians composite reads small beside the others.
HF_OVERRIDE = {"guardians-tv": 1.25}
HF_MIN, HF_MAX = 0.62, 1.15

# THE INK-AREA TARGET IS FROZEN, AND THIS IS THE NUMBER (prompt 52 stage 7).
#
# It used to be `statistics.median(areas.values())` computed fresh on every run - which meant ANY
# change to the source set silently renormalized all 28 marks. Measured: swapping HBO Max's wide
# wordmark for the stacked 2025 lockup moves the median 11646 -> 10731, -7.9%, which rewrites every
# hf in the suite AND drags build_brand_marks.target() with it, because that function RECOVERS this
# number from the frozen manifest to size program marks against the networks. One art swap, two
# suites moved.
#
# So the median is taken ONCE and recorded. This value is the median over the 2026-09-02 source set
# and it is what every published hf was derived from - verified by rebuilding to a temp directory
# and diffing: the manifest and all 28 PNGs came back byte-identical.
#
# `--recompute-target` re-derives it deliberately. That is a suite-wide renormalization, not a
# routine rebuild: it resizes every mark, so do it on purpose and re-record the number here.
NET_TARGET = 11646.499633789062

# Sentinel for --recompute-target: 'take the median over whatever we just processed'.
RECOMPUTE = object()


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
def build(only: list[str] | None = None, out_dir: Path | None = None,
          pin: Any = None) -> list[dict[str, Any]]:
    """Process every mark and publish it, writing the manifest as [{slug, hf, w, h}].

    `out_dir` exists so a caller can build to a TEMPORARY directory and diff the result against
    the published suite without touching it. That is the only safe way to check for drift between
    assets/network-logos and web/public/marks, because this script has no --check mode.

    DO NOT USE --only FOR A PUBLISHED WRITE. `todo` is filtered by `only`, `areas` is built from
    the subset, `target` is the MEDIAN OF THAT SUBSET, and `manifest` below contains only those
    slugs - so `--only espn2` does not update one entry, it replaces manifest.json with a one-line
    file whose normalization target is a single mark. Prompt 52 stage 5 recorded this as a footgun
    and main() now refuses the combination.
    """
    out_dir = out_dir or OUT_DIR
    out_dir.mkdir(parents=True, exist_ok=True)
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

    # ---- composites, AFTER their parts exist. They have no source file, so `slugs()` cannot see
    # them and they are not in `todo`; they are built from the PROCESSED parts, which means they
    # inherit every conditioning decision those parts carry rather than repeating it.
    for slug, parts in COMPOSITES.items():
        if only and slug not in only:
            continue
        missing = [p for p in parts if p not in processed]
        if missing:
            print(f"  warn: {slug}: parts not built ({', '.join(missing)}) - skipped")
            continue
        processed[slug] = stack([processed[p] for p in parts])

    # ---- ink-area normalization, frozen into the manifest
    areas = {s: ink_area(im) for s, im in processed.items()}
    # THE TARGET IS FROZEN AT NET_TARGET - read the comment there for why. In short: it used to be
    # the median over whatever was just processed, so replacing ONE mark's art silently renormalized
    # all 28 and dragged build_brand_marks.target() along with it. `pin` is a one-off override;
    # RECOMPUTE deliberately re-derives it and renormalizes the suite.
    if pin is RECOMPUTE:
        target = statistics.median(areas.values()) if areas else 1.0
    else:
        target = pin if pin is not None else NET_TARGET
    _median = statistics.median(areas.values()) if areas else 1.0
    print(f"  target {target:.0f}  (median over these {len(areas)} sources: {_median:.0f})")
    manifest: list[dict[str, Any]] = []
    for slug in sorted(processed):
        im = processed[slug]
        hf = HF_OVERRIDE.get(slug)
        if hf is None:
            raw = (target / areas[slug]) ** 0.5 if areas[slug] else 1.0
            hf = round(min(HF_MAX, max(HF_MIN, raw)), 3)
        pub = resize_h(im, PUBLISH_H)
        pub.save(out_dir / f"{slug}.png", "PNG", optimize=True)
        # w and h are the PUBLISHED pixel dimensions, carried so a consumer can fit a mark by
        # ink AREA rather than by height alone (web/lib/marks.js railMark). h is PUBLISH_H by
        # construction; it is written out anyway so nothing downstream has to assume it.
        manifest.append({"slug": slug, "hf": float(hf), "w": int(pub.width), "h": int(pub.height)})
    # newline= is working rule 29: text mode with no newline= translates every \n to the
    # platform separator, so this line emitted CRLF on Windows and LF on the runner - one
    # script, two byte streams, for a TRACKED file.
    (out_dir / "manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf-8", newline="\n")
    return manifest


# ----------------------------------------------------------------------------- team logos, dark context
LOGO_DIR = ROOT / "assets" / "logos"
DARK_MAX = 256        # the dark variant is a LISTINGS asset (<= 40px on screen); the raw stays 500px
CONDITIONING = ROOT / "data" / "logo_conditioning.json"


def _sha(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


def rule_key(team_id: str) -> str:
    """The one spelling a ruling is matched in, applied to BOTH sides: the ids in the rulings file and
    the filename stem being tested against them.

    THE MATCH WAS CASE-SENSITIVE AND IT SILENTLY UNDID 25 RULINGS (prompt 96, register §45). Three
    spellings of a team id are in play - the database's (`nba-BKN`), the local filename's (the same, on
    the machine that fetched it) and the R2 key's (`nba-bkn`, lowercased on upload by sync_assets.py).
    The rulings file keeps Joe's spelling; the nightly runner's bases are the files it PULLED, so they
    carry the key's. `p.stem in skip_derive` therefore missed every NBA team on the runner, the file
    fell through to the conditioning chain, and from run #14 (2026-09-09) the bucket held 256px derived
    art for 25 teams Joe had ruled raw - with a counts line reading `25 generated` as if that were
    normal work. The fix is here and not in the data: lowercasing the file would cure today's 25 and
    leave the next mixed-case id broken, and the file is the record of the ruling as Joe gave it.
    """
    return team_id.lower()


def conditioning_rulings() -> tuple[set[str], set[str]]:
    """Joe's per-team rulings from `data/logo_conditioning.json`: (skip_derive, derive), both in
    `rule_key()` spelling - so a caller must test `rule_key(stem) in ...`, never the raw stem.

    Decided by eye on 2026-09-08 over the 124 pro-league teams, each judged on both grounds the app
    uses. The file is the AUTHORITY over the byte-identity test below, and it has to be, because for
    a `skip_derive` team the two say opposite things about the same bytes: that team's dark file is
    a byte copy of its base ON PURPOSE, and the identity test reads exactly that as "the provider
    shipped no dark art, condition it". Left to run, the identity test would silently undo every
    ruling on the next nightly build and nothing would fail.

    A missing or unparseable file means NO rulings, not a crash: the nightly runner must keep
    conditioning logos even if this file is ever removed. Unruled teams - all 642 college teams as
    of this commit - are untouched by any of it.
    """
    try:
        d = json.loads(CONDITIONING.read_text(encoding="utf-8"))
    except (FileNotFoundError, ValueError) as e:  # noqa: BLE001 - rulings are optional, not required
        print(f"  warn: {CONDITIONING.name}: {e} - no per-team rulings applied")
        return set(), set()
    skip = {rule_key(k) for k in (d.get("skip_derive") or ())}
    der = {rule_key(k) for k in (d.get("derive") or ())}
    both = skip & der          # in the normalized spelling, so two spellings of one team cannot hide a conflict
    if both:
        raise ValueError(f"{CONDITIONING.name}: ruled both ways: {sorted(both)}")
    return skip, der


def team_dark_variants(force: bool = False) -> dict[str, int]:
    """Ensure every team has a `logos/{id}_dark.png` for charcoal-floating contexts (addendum M12).

    Two contexts, two files, and this builds only the second one:
      * grid cap endcaps and light tint plates use the RAW `{id}.png`, never lightness-adjusted (v1.3e);
      * a logo FLOATING on charcoal - listings line 1, the odds slot - uses `{id}_dark.png`.

    **A provider's own dark art always wins - but the FILE'S EXISTENCE IS NOT EVIDENCE OF IT.**

    This used to say `fetch_team_assets.py` "already saves ESPN's `500-dark` variant as
    `{id}_dark.png` where ESPN offers one", and skipped every team that had the file. THE PREMISE WAS
    FALSE for most of them: ESPN serves its `500-dark` URL for every team whether or not a distinct
    dark lockup exists, and where none does it returns THE SAME BYTES as the base. So a `_dark.png`
    identical to its base is not provider art - it is the ABSENCE of provider art wearing the
    filename, and skipping it left a genuinely dark logo sinking into `--panel` #23262B. Measured
    2026-09-07 over 766 teams: 449 identical, 317 distinct, and 416 of the 449 with the majority of
    their ink under `floor_l`'s own line.

    BYTE-IDENTITY IS HOW THE ABSENCE IS DETECTED. A dark file whose bytes differ from the base is
    real provider art, drawn for dark backgrounds by the club's own designers, and still wins -
    overwriting it with a derived approximation would be strictly worse. Everything else gets the
    conditioned chain (guarded derive, then the 0.5 lightness floor).

    Idempotent either way: a conditioned variant is a 256px re-render and can never come back
    byte-identical to its 500px source, so a second run sees it as present and leaves it alone.
    --force still rebuilds everything.

    **JOE'S RULINGS OUTRANK THE IDENTITY TEST** (prompt 64). `conditioning_rulings()` names 101
    teams whose charcoal-context art he judged better as the RAW file - a strong single-colour
    roundel, a logo already light enough, one whose derived version went chalky. For those the dark
    file is a byte copy of the base, and the identity test is not consulted at all: here the
    identity IS the intent, and letting the test see it would recondition all 101 on the next
    nightly run with nothing to show it had happened. That copy is its own idempotence signal - a
    second run finds the bytes already equal and writes nothing. The other 23 ruled teams keep the
    conditioned chain, which is what the code below already does for them, so they need no branch.
    """
    counts = {"present": 0, "generated": 0, "skipped": 0, "reconditioned": 0, "ruled_raw": 0}
    skip_derive, _derive_ruled = conditioning_rulings()
    # `_dark` AND `_cap` ARE DERIVED FILES, NOT BASES. `_cap` joined this in prompt 69: without it
    # the cap silhouette would be read as a team logo and get a `{id}_cap_dark.png` of its own, which
    # nothing renders and every count of the 766 would then be wrong.
    bases = sorted(p for p in LOGO_DIR.glob("*.png")
                   if not (p.stem.endswith("_dark") or p.stem.endswith("_cap")))
    for p in bases:
        dark = p.with_name(f"{p.stem}_dark.png")
        if rule_key(p.stem) in skip_derive:
            # RULED RAW. No identity test - see the note above. --force re-copies; the bytes are the
            # same either way, so it is the write that is skipped, never the ruling. The match is
            # CASE-INSENSITIVE (`rule_key`, prompt 96): the runner's files are lowercase pulled keys
            # (`nba-bkn.png`) and the ruling says `nba-BKN`, and the case-sensitive test missed them.
            if not (dark.exists() and not force and _sha(dark) == _sha(p)):
                shutil.copyfile(p, dark)
                counts["ruled_raw"] += 1
            else:
                counts["present"] += 1
            continue
        if dark.exists() and not force:
            # IDENTICAL BYTES MEAN NO PROVIDER ART - see the note above. `_sha` rather than a size
            # compare: two different lockups can share a byte count, and this decides whether a
            # logo gets conditioned at all.
            if _sha(dark) != _sha(p):
                counts["present"] += 1      # real provider dark art, or an earlier conditioned run
                continue
            counts["reconditioned"] += 1    # the file exists and is the base; treat it as absent
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


CAP_TABLE = ROOT / "web" / "lib" / "cap-table.json"


def team_cap_art(force: bool = False) -> dict[str, int]:
    """Build `logos/{id}_cap.png` for every team the cap table asks for - A THIRD ART CONTEXT.

    THE APP ALREADY HAD TWO, and `web/lib/config.js:151` documents them: the grid's cap endcap and
    the light tint plates take the RAW file, and a logo FLOATING ON CHARCOAL - a listings card's
    line 1, the odds slot, the detail panel - takes `{id}_dark.png`. Prompt 69 added the third
    because Joe ruled the Giants' SF mark should go BLACK on their orange band, and black cannot
    live in either of the existing files.

    MEASURED, WITH build_cap_table.py's OWN `edge_crisp`, at render size on 2026-09-08:

        art                on the band #fd5a1e     on charcoal #101214
        raw                              0.000                   1.000
        dark                             0.000                   1.000
        BLACK silhouette                 1.000                   0.000

    Writing the silhouette into `mlb-137_dark.png` would score 1.000 where it is wanted and 0.000
    where the app renders it four other times - MatchupCard.js:108 and :250, GameDetail.js:98 and
    :102 - so the Giants would vanish from every list card in the app. The two contexts genuinely
    disagree about this team, which is what makes a third file the answer rather than a nicety.

    THE OPERATION IS A SILHOUETTE, NOT A DARKENING. Every visible pixel to #000000 with ALPHA
    UNTOUCHED - so the shape, its holes and its antialiased edge all survive exactly, and only the
    colour goes. It is deliberately NOT the guarded derive + 0.5 lightness floor that
    `logo_conditioning.json`'s `derive` list describes; that chain exists to lift art OFF a dark
    ground, and this one is pushing art onto a bright one.

    THE ROSTER IS THE CAP TABLE, not a list here: a team gets a `_cap.png` exactly when its row says
    `art: "cap"`. One team says so today. Idempotent - an existing file is left alone unless --force.
    """
    counts = {"generated": 0, "present": 0, "missing_base": 0}
    try:
        rows = json.loads(CAP_TABLE.read_text(encoding="utf-8")).get("teams") or {}
    except (FileNotFoundError, ValueError) as e:  # noqa: BLE001
        print(f"  warn: {CAP_TABLE.name}: {e} - no cap art built")
        return counts
    for team_id, row in sorted(rows.items()):
        if row.get("art") != "cap":
            continue
        base = LOGO_DIR / f"{team_id}.png"
        if not base.exists():
            print(f"  warn: {team_id} wants cap art but has no base logo - skipped")
            counts["missing_base"] += 1
            continue
        out = base.with_name(f"{team_id}_cap.png")
        if out.exists() and not force:
            counts["present"] += 1
            continue
        im = Image.open(base).convert("RGBA")
        px = im.load()
        for y in range(im.height):
            for x in range(im.width):
                r, g, b, a = px[x, y]
                if a:
                    px[x, y] = (0, 0, 0, a)
        im.save(out, "PNG", optimize=True)
        counts["generated"] += 1
    return counts


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--only", nargs="+",
                    help="build a subset of slugs. NEVER for a published write: it TRUNCATES "
                         "manifest.json to the subset and takes the ink-area median over it")
    ap.add_argument("--out-dir", help="write here instead of web/public/marks - use a temp dir "
                                      "to check for drift without publishing")
    ap.add_argument("--pin-target", type=float,
                    help="normalize against THIS ink-area target instead of the frozen NET_TARGET. "
                         "A one-off experiment; the frozen value is the default.")
    ap.add_argument("--recompute-target", action="store_true",
                    help="re-derive the ink-area target as the median over the current sources. "
                         "THIS RENORMALIZES THE WHOLE SUITE and resizes every mark - do it on "
                         "purpose, then record the new number in NET_TARGET.")
    ap.add_argument("--list", action="store_true", help="print the recipe per slug and exit")
    ap.add_argument("--team-logos", action="store_true",
                    help="also build assets/logos/{id}_dark.png for charcoal-floating contexts")
    ap.add_argument("--cap-art", action="store_true",
                    help="build assets/logos/{id}_cap.png - a BLACK SILHOUETTE for the grid endcap - "
                         "for every team whose cap-table row says art: \"cap\"")
    ap.add_argument("--force", action="store_true", help="rebuild dark variants that already exist")
    args = ap.parse_args(argv)
    if args.cap_art:
        c = team_cap_art(args.force)
        print(f"team cap art: {c['generated']} generated, {c['present']} already present, "
              f"{c['missing_base']} wanted but had no base logo")
    if args.team_logos:
        c = team_dark_variants(args.force)
        print(f"team dark variants: {c['generated']} generated ({c['reconditioned']} of them files "
              f"that existed but were byte-identical to their base), {c['ruled_raw']} copied raw "
              f"(Joe's skip_derive rulings), {c['present']} already present "
              f"(real provider art kept, or a ruling already satisfied), {c['skipped']} unreadable")
    if args.list:
        for s in slugs():
            kind, _ = RECIPES.get(s, ("png", dark_ready))
            print(f"  {s:20s} {kind:4s} {'recipe' if s in RECIPES else 'dark_ready'}")
        return 0
    out_dir = Path(args.out_dir) if args.out_dir else OUT_DIR
    if args.only and out_dir == OUT_DIR:
        print("refusing: --only truncates the published manifest to that subset and takes the "
              "ink-area median over it. Pass --out-dir to build a subset somewhere safe.")
        return 2
    pin = args.pin_target
    if args.recompute_target:
        if pin is not None:
            print('refusing: --pin-target and --recompute-target contradict each other.')
            return 2
        pin = RECOMPUTE
    manifest = build(args.only, out_dir, pin)
    print(f"marks: {len(manifest)} -> {out_dir}")
    print("  slug                     hf      w    h")
    for m in manifest:
        print(f"  {m['slug']:24s} {m['hf']:.3f} {m['w']:5d} {m['h']:4d}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
