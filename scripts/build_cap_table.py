#!/usr/bin/env python3
"""Generate web/lib/cap-table.json - the per-team grid cap surface and art (Joe's ruling, 2026-09-04).

    python scripts/build_cap_table.py                          # read teams from the database
    python scripts/build_cap_table.py --teams-csv teams.csv     # offline
    python scripts/build_cap_table.py --check artifacts/cap-study/cap_table_candidate_C.json

THE RULING (candidate D, project doc claude/grid-cap-study-2026-09-04.md). The grid block's endcap
stops being one global tint. Per team it is either the BAND ITSELF - where that team's logo still
reads on it - or today's tint(band, 0.72). The cap's art is either the raw file or the existing
`_dark` file, whichever reads materially better on the chosen surface. Selecting between two files
that already exist is NOT a v1.3e lightness inversion; that is Joe's ruling. No new art is made here.

THE MEASUREMENT, and why it is done at render size. Every logo is resampled to 138 px - 46 CSS px at
DPR 3, which is what the cap actually draws - and composited over the candidate surface with its real
alpha. Nothing is measured at asset size, because a 4 px outline in a 500 px file is a third of a
pixel on the phone. "Ink" is alpha >= 0.5; "edge" is ink within 2 device px of a non-ink pixel, which
is the outer silhouette and the only place the logo actually meets the surface. `edge_crisp` is the
share of edge pixels whose WCAG luminance ratio against the surface is >= 1.5:1 - luminance contrast
is what makes an edge look sharp, where chroma alone makes a shape visible but soft.

THE TWO-LEVEL RULE:
  * tint = 1.0 when the better of the two files reaches edge_crisp >= 0.85 on the flat band, else 0.72
  * on the chosen surface, art = dark only when the _dark file beats raw by MORE than 0.05, else raw
  * a team with no raw file gets no row; a raw file with no _dark is scored raw-only

The colour maths, band_for() and ink_for() are ports of web/lib/gridmodel.js, kept here rather than
imported so the numbers can be checked against the app independently. `ink_for(band, ...)` MUST equal
`band_for().ink` - tests/test_cap_table.py pins that over every real colour pair.

READ-ONLY against the database: one SELECT through pipeline/db.py. This script writes nothing to it.
Windows-portable: no %-strftime, encoding= on every open(), ASCII-only console output.
"""
from __future__ import annotations

import argparse
import csv
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

INK_HEX = "#f2f2f0"        # --ink
CHARCOAL_HEX = "#101214"   # BAND_CHARCOAL in gridmodel.js
MIN_RATIO = 3.0            # BAND_MIN_RATIO
RENDER_PX = 138            # 46 CSS px * DPR 3
LUM_CRISP = 1.5            # a crisp edge
FLAT_MIN = 0.85            # tint 1.0 when the band itself carries the logo this well
DARK_MARGIN = 0.05         # _dark must beat raw by MORE than this to be chosen
CAP_TINT = 0.72            # the tinted level


# ----------------------------------------------------------------------------- colour maths
def hex2rgb(h):
    h = (h or "").strip().lstrip("#")
    if len(h) != 6:
        return None
    try:
        return np.array([int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)], dtype=np.float64)
    except ValueError:
        return None


def lin(c):
    c = np.asarray(c, dtype=np.float64) / 255.0
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def luminance(rgb):
    l = lin(rgb)
    return 0.2126 * l[..., 0] + 0.7152 * l[..., 1] + 0.0722 * l[..., 2]


def ratio(l1, l2):
    hi = np.maximum(l1, l2)
    lo = np.minimum(l1, l2)
    return (hi + 0.05) / (lo + 0.05)


def ratio_hex(a, b):
    return float(ratio(luminance(hex2rgb(a)), luminance(hex2rgb(b))))


# ----------------------------------------------------------------------------- ports of gridmodel.js
def tint(rgb, f):
    """gridmodel.js tint(): c*f + 255*(1-f)*0.08 - it DARKENS toward near-black."""
    return np.round(np.asarray(rgb, dtype=np.float64) * f + 255.0 * (1 - f) * 0.08)


def band_for(primary, secondary):
    p = primary if hex2rgb(primary) is not None else "#6e747c"
    s = secondary if hex2rgb(secondary) is not None else None
    lp = float(luminance(hex2rgb(p)))
    ls = float(luminance(hex2rgb(s))) if s else None
    if s is not None:
        pair = ratio_hex(p, s)
        if pair >= MIN_RATIO:
            band, ink = (s, p) if ls > lp else (p, s)
            return {"band": band, "ink": ink, "neutral": False, "ratio": pair}
    band = s if (s is not None and ls > lp) else p
    r_ink = ratio_hex(INK_HEX, band)
    r_char = ratio_hex(CHARCOAL_HEX, band)
    use_ink = r_ink >= r_char
    return {"band": band, "ink": INK_HEX if use_ink else CHARCOAL_HEX, "neutral": True,
            "ratio": r_ink if use_ink else r_char}


def ink_for(surface_hex, primary, secondary):
    """The generalised band rule, for ANY surface: of the team's two colours take the one with the
    higher ratio against the surface; use it when that clears 3.0 and is not the surface itself,
    otherwise the better neutral. On surface == band this reproduces band_for() exactly."""
    best = None
    for c in (primary, secondary):
        if hex2rgb(c) is None:
            continue
        r = ratio_hex(c, surface_hex)
        if best is None or r > best[1]:
            best = (c, r)
    if best and best[1] >= MIN_RATIO and best[0].lower() != surface_hex.lower():
        return {"ink": best[0], "ratio": best[1], "neutral": False}
    r_ink = ratio_hex(INK_HEX, surface_hex)
    r_char = ratio_hex(CHARCOAL_HEX, surface_hex)
    return ({"ink": INK_HEX, "ratio": r_ink, "neutral": True} if r_ink >= r_char
            else {"ink": CHARCOAL_HEX, "ratio": r_char, "neutral": True})


# ----------------------------------------------------------------------------- logo loading
def load_logo(path: Path, size: int = RENDER_PX):
    im = Image.open(path).convert("RGBA")
    im.thumbnail((size, size), Image.LANCZOS)
    arr = np.asarray(im).astype(np.float64)
    alpha = arr[..., 3] / 255.0
    ink = alpha >= 0.5
    # outer silhouette: ink within 2 px (Chebyshev) of a non-ink pixel. The frame outside the image
    # counts as non-ink, so a square badge's outer edge is measured too.
    pad = 2
    non = np.pad(~ink, pad, constant_values=True)
    near = np.zeros_like(ink)
    H, W = ink.shape
    for dy in range(-pad, pad + 1):
        for dx in range(-pad, pad + 1):
            near |= non[pad + dy:pad + dy + H, pad + dx:pad + dx + W]
    return {"rgb": arr[..., :3], "alpha": alpha, "ink": ink, "edge": ink & near}


def measure(logo, bg_rgb):
    """edge_crisp for one logo over one flat surface."""
    rgb, alpha, ink, edge = logo["rgb"], logo["alpha"], logo["ink"], logo["edge"]
    H, W, _ = rgb.shape
    bgimg = np.broadcast_to(np.asarray(bg_rgb, dtype=np.float64), (H, W, 3))
    comp = alpha[..., None] * rgb + (1 - alpha[..., None]) * bgimg
    rr = ratio(luminance(comp[ink]), luminance(bgimg[ink]))
    e = edge[ink]
    if float(ink.sum()) == 0 or float(e.sum()) == 0:
        return None
    return float(np.mean(rr[e] >= LUM_CRISP))


# ----------------------------------------------------------------------------- the rule
def decide(raw_path: Path, dark_path: Path | None, band_hex: str):
    """The two-level rule. Returns (tint, art, edge_crisp) or None when there is no usable art."""
    band_rgb = hex2rgb(band_hex)
    tinted_rgb = tint(band_rgb, CAP_TINT)
    raw = load_logo(raw_path)
    dark = load_logo(dark_path) if dark_path and dark_path.exists() else None

    flat = {"raw": measure(raw, band_rgb)}
    tinted = {"raw": measure(raw, tinted_rgb)}
    if dark is not None:
        flat["dark"] = measure(dark, band_rgb)
        tinted["dark"] = measure(dark, tinted_rgb)
    if flat["raw"] is None:
        return None

    best_flat = max(v for v in flat.values() if v is not None)
    level = 1.0 if best_flat >= FLAT_MIN else CAP_TINT
    scores = flat if level == 1.0 else tinted

    r = scores.get("raw")
    d = scores.get("dark")
    art = "dark" if (d is not None and r is not None and d - r > DARK_MARGIN) else "raw"
    return level, art, float(scores[art])


# ----------------------------------------------------------------------------- team sources
def teams_from_db():
    from pipeline.db import DB
    db = DB(None)
    try:
        rows = db.fetch("select id, canonical_name, sport::text, primary_color, secondary_color "
                        "from teams order by id")
    finally:
        db.close()
    return [{"id": str(r[0]), "name": r[1], "sport": r[2], "primary": r[3], "secondary": r[4]}
            for r in rows]


def teams_from_csv(path: Path):
    out = []
    with open(path, newline="", encoding="utf-8") as fh:
        for r in csv.DictReader(fh):
            out.append({"id": str(r["id"]), "name": r.get("canonical_name") or r.get("name"),
                        "sport": r.get("sport"), "primary": r.get("primary_color"),
                        "secondary": r.get("secondary_color")})
    return out


# ----------------------------------------------------------------------------- main
def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--teams-csv", metavar="PATH", help="read teams from CSV instead of the database")
    ap.add_argument("--logos", default=str(ROOT / "assets" / "logos"))
    ap.add_argument("--out", default=str(ROOT / "web" / "lib" / "cap-table.json"))
    ap.add_argument("--check", metavar="FIXTURE", help="compare tint/art against a study fixture")
    a = ap.parse_args(argv)

    teams = teams_from_csv(Path(a.teams_csv)) if a.teams_csv else teams_from_db()
    logo_dir = Path(a.logos)
    print("teams: %d | logos: %s" % (len(teams), logo_dir))

    out = {}
    skipped_no_art = 0
    for t in teams:
        raw = logo_dir / ("%s.png" % t["id"])
        if not raw.exists():
            skipped_no_art += 1
            continue
        dark = logo_dir / ("%s_dark.png" % t["id"])
        band = band_for(t["primary"], t["secondary"])["band"]
        got = decide(raw, dark if dark.exists() else None, band)
        if got is None:
            skipped_no_art += 1
            continue
        level, art, crisp = got
        out[t["id"]] = {"tint": level, "art": art, "edge_crisp": round(crisp, 3)}

    counts = {}
    for v in out.values():
        counts[(v["tint"], v["art"])] = counts.get((v["tint"], v["art"]), 0) + 1
    print("rows: %d (skipped %d with no usable art)" % (len(out), skipped_no_art))
    for k in sorted(counts, key=lambda x: (-x[0], x[1])):
        print("  tint %.2f %-4s : %d" % (k[0], k[1], counts[k]))

    doc = {
        "_generated": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "_rule": {"render_px": RENDER_PX, "lum_crisp": LUM_CRISP, "flat_min": FLAT_MIN,
                  "dark_margin": DARK_MARGIN, "cap_tint": CAP_TINT, "min_ratio": MIN_RATIO},
        "teams": {k: out[k] for k in sorted(out)},
    }
    Path(a.out).write_text(json.dumps(doc, indent=1, sort_keys=False) + "\n", encoding="utf-8")
    print("wrote %s" % a.out)

    # The colours the JS side needs to check ITSELF against this rule, from the same SELECT.
    #
    # Prompt 40 computed the 191/116/0 counts and the 26-team list in Python and pinned inkFor() in JS
    # only against BAND surfaces, which are hex. Nothing ever walked a TINTED surface through the
    # JavaScript, so a JS-only parsing defect sat under a green suite and shipped. The fixture closes
    # that: web/test/captable.test.mjs now recomputes every count in the runtime that actually renders.
    colours = {t["id"]: {"primary": t["primary"], "secondary": t["secondary"]}
               for t in teams if t["id"] in out}
    fixture_path = ROOT / "web" / "test" / "fixtures" / "team-colours.json"
    fixture_path.parent.mkdir(parents=True, exist_ok=True)
    fixture_path.write_text(
        json.dumps({"_generated": doc["_generated"], "teams": {k: colours[k] for k in sorted(colours)}},
                   indent=1) + "\n", encoding="utf-8")
    print("wrote %s (%d teams)" % (fixture_path, len(colours)))

    if a.check:
        # The study's `teams` is a LIST of rows carrying their own id, not an id-keyed object.
        fixraw = json.loads(Path(a.check).read_text(encoding="utf-8"))["teams"]
        fix = {r["id"]: r for r in fixraw} if isinstance(fixraw, list) else fixraw
        bad = []
        fcounts = {}
        for tid, row in sorted(fix.items()):
            mine = out.get(tid)
            if mine is None:
                bad.append("%s: missing from generated table" % tid)
                continue
            fcounts[(mine["tint"], mine["art"])] = fcounts.get((mine["tint"], mine["art"]), 0) + 1
            if mine["tint"] != row["tint"] or mine["art"] != row["art"]:
                bad.append("%s (%s): fixture tint=%.2f art=%s | generated tint=%.2f art=%s"
                           % (tid, row.get("name", "?"), row["tint"], row["art"], mine["tint"], mine["art"]))
        print("")
        print("ACCEPTANCE against %d fixture rows: %s" % (len(fix), "PASS" if not bad else "FAIL"))
        # Counts are restricted to the fixture's ids. The generated table also carries teams the
        # study left out (they have art but no 2026 game rows), which must not be counted against
        # the ruling's 170 / 28 / 84 / 25.
        want = {(1.0, "raw"): 170, (1.0, "dark"): 28, (0.72, "raw"): 84, (0.72, "dark"): 25}
        for k in sorted(want, key=lambda x: (-x[0], x[1])):
            got = fcounts.get(k, 0)
            ok = "OK" if got == want[k] else "MISMATCH (want %d)" % want[k]
            print("  tint %.2f %-4s : %d  %s" % (k[0], k[1], got, ok))
            if got != want[k]:
                bad.append("count tint=%.2f art=%s: got %d want %d" % (k[0], k[1], got, want[k]))
        extra = sorted(set(out) - set(fix))
        print("  generated-only ids (art, but no 2026 game rows): %d  %s"
              % (len(extra), ", ".join(extra)))
        for b in bad[:40]:
            print("  " + b)
        if bad:
            print("  ... %d problem(s) total" % len(bad))
            return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
