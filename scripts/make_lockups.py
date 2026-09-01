#!/usr/bin/env python3
"""Compose the Cavaliers-on-DAZN rail-tile marks (product decision 7, 2026-09-01; layout approved by Joe same day).

    python scripts/make_lockups.py             # writes assets/network-logos/dazn.png and wuab-43.png
    python scripts/make_lockups.py --preview   # also writes artifacts/brand/rail_tile_preview.png (3x + true size)

Inputs (assets/brand/): dazn_master_white.png (white on transparent, from the DAZN asset kit),
resn_stacked_white_on_black.jpg (team-supplied), clevelands43_horizontal_dark.png (team-supplied).

Outputs resolve by outlet slug, so the renderer needs no change. The rail tile is ~134x100 with art fit into
120x86 (Joe reviewed true-size previews 2026-09-01):
    dazn.png    = RESN | DAZN side by side (RESN first, per Joe)
    wuab-43.png = Cleveland's 43 over an equal-width RESN | DAZN row; the WUAB row_order entry deliberately
                  omits station/channel so no call-letters band shrinks the art.
Windows-portable; requires pillow.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
BRAND = ROOT / "assets" / "brand"
OUT = ROOT / "assets" / "network-logos"
H = 400


def dark_to_alpha(im: Image.Image, floor: int = 24) -> Image.Image:
    """Black-background art -> content-on-transparent. Alpha = max(R,G,B), floor cut for JPEG noise."""
    im = im.convert("RGB")
    px = im.load()
    out = Image.new("RGBA", im.size)
    po = out.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b = px[x, y]
            a = max(r, g, b)
            po[x, y] = (r, g, b, 0 if a < floor else a)
    return out


def autocrop(im: Image.Image, pad: int = 4) -> Image.Image:
    bbox = im.getbbox()
    if not bbox:
        return im
    left, top, right, bottom = bbox
    return im.crop((max(0, left - pad), max(0, top - pad), min(im.width, right + pad), min(im.height, bottom + pad)))


def scaled(im: Image.Image, h: int) -> Image.Image:
    return im.resize((max(1, round(im.width * h / im.height)), h), Image.LANCZOS)


def load_mark(path: Path, h: int) -> Image.Image | None:
    if not path.exists():
        return None
    im = Image.open(path)
    if im.mode != "RGBA" or path.suffix.lower() in (".jpg", ".jpeg"):
        im = dark_to_alpha(im)
    else:
        im = im.convert("RGBA")
    return scaled(autocrop(im), h)


def side_by_side(marks: list[Image.Image], gap: int) -> Image.Image:
    h = max(m.height for m in marks)
    im = Image.new("RGBA", (sum(m.width for m in marks) + gap * (len(marks) - 1), h), (0, 0, 0, 0))
    x = 0
    for m in marks:
        im.alpha_composite(m, (x, (h - m.height) // 2))
        x += m.width + gap
    return im


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--preview", action="store_true")
    args = ap.parse_args(argv)
    dazn = load_mark(BRAND / "dazn_master_white.png", H)
    resn = load_mark(BRAND / "resn_stacked_white_on_black.jpg", H)
    wuab = load_mark(BRAND / "clevelands43_horizontal_dark.png", H)
    if not all((dazn, resn, wuab)):
        print("ERROR: missing source art in assets/brand/ (dazn_master_white.png, resn_stacked_white_on_black.jpg, clevelands43_horizontal_dark.png)", file=sys.stderr)
        return 2
    OUT.mkdir(parents=True, exist_ok=True)

    a = side_by_side([resn, dazn], gap=24)          # RESN first (Joe, 2026-09-01)
    a.save(OUT / "dazn.png")
    print(f"dazn.png: {a.width}x{a.height} (RESN | DAZN)")

    top_w = 900
    top = scaled(wuab, round(top_w / (wuab.width / wuab.height)))
    gap_v, gap_h = 30, 36
    half = (top_w - gap_h) // 2
    row = side_by_side([scaled(resn, half), scaled(dazn, half)], gap=gap_h)
    b = Image.new("RGBA", (max(top.width, row.width), top.height + gap_v + half), (0, 0, 0, 0))
    b.alpha_composite(top, ((b.width - top.width) // 2, 0))
    b.alpha_composite(row, ((b.width - row.width) // 2, top.height + gap_v))
    b.save(OUT / "wuab-43.png")
    print(f"wuab-43.png: {b.width}x{b.height} (Cleveland's 43 over equal-width RESN | DAZN)")

    if args.preview:
        prev = ROOT / "artifacts" / "brand"
        prev.mkdir(parents=True, exist_ok=True)
        tiles = [(a, "DAZN row"), (b, "WUAB 43 row")]
        cards = []
        for S in (3, 1):
            pad = 18 * S
            card = Image.new("RGBA", ((134 * S + pad) * len(tiles) + pad, 100 * S + 2 * pad + 14 * S), (18, 22, 26, 255))
            d = ImageDraw.Draw(card)
            for i, (art, label) in enumerate(tiles):
                x0 = pad + i * (134 * S + pad)
                d.rounded_rectangle([x0, pad, x0 + 134 * S, pad + 100 * S], radius=10 * S, fill=(38, 44, 50, 255))
                sc = min(120 * S / art.width, (100 * S - 14 * S) / art.height)
                art2 = art.resize((int(art.width * sc), int(art.height * sc)), Image.LANCZOS)
                card.alpha_composite(art2, (x0 + (134 * S - art2.width) // 2, pad + (100 * S - art2.height) // 2))
                d.text((x0 + 134 * S / 2, pad + 100 * S + 4 * S), label, fill=(201, 206, 211, 255), anchor="ma")
            cards.append(card)
        comb = Image.new("RGB", (cards[0].width, cards[0].height + cards[1].height + 20), (18, 22, 26))
        comb.paste(cards[0].convert("RGB"), (0, 0))
        comb.paste(cards[1].convert("RGB"), ((cards[0].width - cards[1].width) // 2, cards[0].height + 10))
        comb.save(prev / "rail_tile_preview.png")
        print(f"preview -> {(prev / 'rail_tile_preview.png').relative_to(ROOT).as_posix()}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
