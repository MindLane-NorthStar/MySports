#!/usr/bin/env python3
"""Audit assets/logos/ for dark variants that are the ABSENCE of provider art wearing its filename.

    python scripts/audit_dark_logos.py            # counts + the identical-and-dark id list
    python scripts/audit_dark_logos.py --sample 3 # also name three teams whose dark art is DISTINCT

WHY THIS EXISTS. `build_web_marks.py`'s `team_dark_variants()` skips any team that already has a
`{id}_dark.png`, on the premise that such a file is the provider's own dark lockup. ESPN serves its
`500-dark` URL for every team whether or not a distinct dark lockup exists, returning the base bytes
where none does - so the file's EXISTENCE is not evidence of provider art, and byte-identity with the
base is how the absence is detected.

THE LUMINANCE DEFINITION IS THE MODULE'S OWN, NOT A SECOND ONE. `floor_l` (build_web_marks.py:89-106)
raises a visible pixel whenever `0.5 + l*0.25 > l`, i.e. whenever HLS lightness `l < 2/3`. That
inequality IS the module's line for "too dark to float on charcoal", so it is what this counts -
sharing the constants (ALPHA_VISIBLE) and the helper by import rather than restating them.
"""
from __future__ import annotations

import argparse
import colorsys
import hashlib
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from build_web_marks import ALPHA_VISIBLE, LOGO_DIR  # noqa: E402
from PIL import Image  # noqa: E402

# floor_l(im, 0.5) raises a pixel when 0.5 + l*0.25 > l  ->  l < 0.5 / 0.75 = 2/3.
FLOOR_F = 0.5
TOO_DARK_L = FLOOR_F / (1 - 0.25)


def sha(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


def dark_share(p: Path) -> float:
    """Share of VISIBLE ink whose HLS lightness sits under the floor floor_l would apply."""
    im = Image.open(p).convert("RGBA")
    im.thumbnail((128, 128), Image.LANCZOS)
    px = im.load()
    under = seen = 0
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a < ALPHA_VISIBLE:
                continue
            seen += 1
            if colorsys.rgb_to_hls(r / 255, g / 255, b / 255)[1] < TOO_DARK_L:
                under += 1
    return (under / seen) if seen else 0.0


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--sample", type=int, default=0,
                    help="also print N teams whose dark art is genuinely DISTINCT from the base")
    ap.add_argument("--threshold", type=float, default=0.5,
                    help="a file 'fails to read' when this share of its ink is under the floor")
    args = ap.parse_args(argv)

    bases = sorted(p for p in LOGO_DIR.glob("*.png") if not p.stem.endswith("_dark"))
    darks = sorted(LOGO_DIR.glob("*_dark.png"))
    identical: list[Path] = []
    distinct: list[Path] = []
    for p in bases:
        d = p.with_name(f"{p.stem}_dark.png")
        if not d.exists():
            continue
        (identical if sha(p) == sha(d) else distinct).append(p)

    failing = [(p.stem, round(dark_share(p.with_name(f'{p.stem}_dark.png')), 3))
               for p in identical]
    sink = sorted([x for x in failing if x[1] >= args.threshold], key=lambda z: -z[1])

    print(f"base files                                  {len(bases)}")
    print(f"_dark.png files                             {len(darks)}")
    print(f"_dark.png BYTE-IDENTICAL to its base        {len(identical)}")
    print(f"  of those, ink under floor_l's line        {len(sink)}"
          f"   (>= {args.threshold:.0%} of visible pixels with l < {TOO_DARK_L:.4f})")
    print(f"_dark.png genuinely DISTINCT from its base  {len(distinct)}")
    print()
    print("ids whose dark file is identical AND sinks into --panel #23262B:")
    print("  " + " ".join(s for s, _ in sink))
    if args.sample:
        print()
        print(f"genuinely distinct provider art (first {args.sample}) - these must keep winning:")
        for p in distinct[:args.sample]:
            d = p.with_name(f"{p.stem}_dark.png")
            print(f"  {p.stem:12s} base {p.stat().st_size:7d}B  dark {d.stat().st_size:7d}B")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
