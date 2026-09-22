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

THE TWO-LEVEL RULE (unruled teams):
  * tint = 1.0 when the better of the two files reaches edge_crisp >= 0.85 on the flat band, else 0.72
  * on the chosen surface, art = dark only when the _dark file beats raw by MORE than 0.05, else raw
  * a team with no raw file gets no row; a raw file with no _dark is scored raw-only

WHICH SURFACE EACH TEAM IS SCORED ON (prompt 113, Joe's ruling 2026-09-22, register section 58):
  * A RULED team - one listed in data/grid_colors_pro.json - is scored on the flat band Joe chose
    there, and on nothing else. Prompt 66 made capFor() paint that band UNTINTED for every ruled
    team, so the tinted surface never exists for them and decide()'s tinted branch is the wrong
    vehicle: run through decide(), the 76ers flip to dark on a surface that is never painted, which
    is the stale-surface error prompt 68 corrected by hand. tint is written 1.0 and the art is the
    same margin rule applied to the two FLAT scores (decide_ruled).
    WHY: this script used to score every team on band_for()'s band from the database colours, and
    for 80 of the 124 ruled teams that is a different colour from the band the block paints. The
    Padres' raw file scores 1.000 on the rule's gold and 0.000 on Joe's brown; the Rams' 1.000 on
    gold and 0.000 on navy; both painted raw and were illegible on the device (prompt 112). Re-scored
    on the painted band, 38 ruled rows change art - 13 raw->dark, 24 dark->raw where the two files
    are now byte-identical, and the Rockets - and 27 more change only their tint label to 1.0.
  * An UNRULED team keeps band_for() + decide() exactly as before; the 2026-09-04 study still
    describes those rows and web/test/captable.test.mjs pins them against it.
  * CAP_ART_OVERRIDES holds the rulings no measurement can produce, applied AFTER scoring so a
    regeneration reproduces them instead of depending on someone re-patching the output by hand.

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
RULED_PATH = ROOT / "data" / "grid_colors_pro.json"   # Joe's per-team bands (prompt 66); see the docstring

# Rulings the measurement cannot produce, applied AFTER scoring so a regeneration reproduces them.
# `cap` names a THIRD art file, logos/{id}_cap.png, read only by the grid endcap (teamLogoCapUrl).
# UNRULED rows whose _dark file was rebuilt AFTER the 2026-09-04 study was scored, so the study no
# longer describes them and --check compares them against the values declared here instead (Joe's
# ruling, prompt 113 rev B: the table describes the files that exist, not the files the study saw).
# 83 unruled _dark files postdate the study; these seven are the ones where the new file changes the
# answer. A declared row that stops differing from the study fails the acceptance - delete its entry.
FILE_CHANGED_SINCE_STUDY = {
    "256": {"tint": 0.72, "art": "dark"},   # James Madison: 2026-09-07 20:29, _dark rebuilt
    "326": {"tint": 1.0, "art": "dark"},   # Texas St: 2026-09-07 20:29, _dark rebuilt
    # 197, 2447, 2464, 2627 and 2655 stood here in rev B; Joe's review (rev C) pinned them back to the
    # pre-113 rendering, which is what the study recorded, so they match the study again and are
    # declared ONCE, in REVIEW_PINS below, for the reason that actually holds them.
}

# JOE'S REVIEW PINS (prompt 113 rev C, 2026-09-22). Joe reviewed the 21 before/after pairs the
# regeneration produced, at 4x, and kept the OLD rendering for six rows. These are rulings from the
# pictures, not scores: the build applies them AFTER scoring and never re-derives them. The
# edge_crisp written is the pinned art's own score on the pinned surface, so the number stays honest.
# --check requires every pin to still be load-bearing - the unpinned score must differ from it - so a
# pin that stops changing anything fails the acceptance; delete its entry then.
REVIEW_PINS = {
    # Joe's review of the p113 sheets, 2026-09-22: keeps the pre-113 rendering.
    # Oklahoma St: raw and _dark are byte-identical (skip_derive, 2026-09-08), so what this pin keeps
    # is the FLAT band the left panel showed - the art label is the study's, the pixels are the tint's.
    "197": {"tint": 1.0, "art": "dark"},
    "2447": {"tint": 0.72, "art": "raw"},   # Nicholls
    "2464": {"tint": 0.72, "art": "raw"},   # N Arizona
    "2627": {"tint": 1.0, "art": "raw"},    # Tarleton St
    "2655": {"tint": 0.72, "art": "raw"},   # Tulane
    # The Chargers are RULED: capFor() paints the flat band whatever the table says, so the pin is
    # tint 1.0 and not the pre-113 row's 0.72 - that 0.72 never painted. Only the art is the ruling.
    "nfl-24": {"tint": 1.0, "art": "raw"},
}

CAP_ART_OVERRIDES = {
    # Joe's ruling 2026-09-08 (b98a696): the Giants' SF mark goes BLACK on their orange band #fd5a1e,
    # and the band does not change. Neither existing file can do it - raw and _dark both score
    # edge_crisp 0.000 on that orange, and the black silhouette that scores 1.000 there scores 0.000
    # on the charcoal the listings card floats a logo on - so the endcap got its own file. The table
    # carried `art: 'cap'` by hand from b98a696 until prompt 113 moved the ruling here. The score
    # written is the _cap file's own on the ruled band, measured like everything else.
    "mlb-137": "cap",
}


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


def ruled_bands(path: Path = RULED_PATH) -> dict:
    """{team id: band hex} for every team Joe ruled a band for. No file -> nobody is ruled."""
    p = Path(path)
    if not p.exists():
        return {}
    doc = json.loads(p.read_text(encoding="utf-8"))
    return {tid: row["band"] for tid, row in doc.get("teams", {}).items()
            if hex2rgb(row.get("band")) is not None}


def decide_ruled(raw_path: Path, dark_path: Path | None, band_hex: str):
    """A RULED team (prompt 113): both files scored on the FLAT ruled band, tint 1.0, and the same
    margin rule on those two flat scores. decide()'s tinted branch is never consulted, because
    capFor() never paints a tinted cap for a ruled team. Returns (tint, art, edge_crisp) or None."""
    band_rgb = hex2rgb(band_hex)
    r = measure(load_logo(raw_path), band_rgb)
    if r is None:
        return None
    d = None
    if dark_path is not None and dark_path.exists():
        d = measure(load_logo(dark_path), band_rgb)
    art = "dark" if (d is not None and d - r > DARK_MARGIN) else "raw"
    return 1.0, art, float(d if art == "dark" else r)


def row_for(team_id: str, logo_dir: Path, ruled: dict, primary=None, secondary=None, apply_pins=True):
    """One team's table row, or None when it has no usable art. The ruled/unruled split lives HERE
    and nowhere else: a ruled team is scored on its ruled band by decide_ruled(); an unruled one on
    band_for()'s band by decide(). CAP_ART_OVERRIDES is applied next, then REVIEW_PINS - unless
    `apply_pins` is False, which is how --check learns whether a pin is still load-bearing."""
    raw = logo_dir / ("%s.png" % team_id)
    if not raw.exists():
        return None
    dark = logo_dir / ("%s_dark.png" % team_id)
    dark = dark if dark.exists() else None
    if team_id in ruled:
        got = decide_ruled(raw, dark, ruled[team_id])
    else:
        got = decide(raw, dark, band_for(primary, secondary)["band"])
    if got is None:
        return None
    level, art, crisp = got
    if CAP_ART_OVERRIDES.get(team_id) == "cap":
        cap = logo_dir / ("%s_cap.png" % team_id)
        if cap.exists():
            surface_hex = ruled.get(team_id) or band_for(primary, secondary)["band"]
            surface = hex2rgb(surface_hex) if level == 1.0 else tint(hex2rgb(surface_hex), CAP_TINT)
            s = measure(load_logo(cap), surface)
            art, crisp = "cap", float(s if s is not None else crisp)
        else:
            print("WARNING: %s is ruled art 'cap' but %s is missing - scored art kept" % (team_id, cap))
    pin = REVIEW_PINS.get(team_id) if apply_pins else None
    if pin is not None:
        level, art = pin["tint"], pin["art"]
        f = logo_dir / ("%s.png" % team_id if art == "raw" else "%s_%s.png" % (team_id, art))
        surface_hex = ruled.get(team_id) or band_for(primary, secondary)["band"]
        surface = hex2rgb(surface_hex) if level == 1.0 else tint(hex2rgb(surface_hex), CAP_TINT)
        s = measure(load_logo(f), surface) if f.exists() else None
        crisp = float(s) if s is not None else crisp
    return {"tint": level, "art": art, "edge_crisp": round(crisp, 3)}


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
    ruled = ruled_bands()
    print("teams: %d | logos: %s | ruled bands: %d (%s)" % (len(teams), logo_dir, len(ruled), RULED_PATH.name))

    out = {}
    skipped_no_art = 0
    for t in teams:
        row = row_for(t["id"], logo_dir, ruled, t["primary"], t["secondary"])
        if row is None:
            skipped_no_art += 1
            continue
        out[t["id"]] = row

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
    # newline pinned for the same reason as the fixture below: web/lib/cap-table.json is
    # TRACKED and is read by the runtime, and text mode would emit CRLF here on Windows.
    Path(a.out).write_text(json.dumps(doc, indent=1, sort_keys=False) + "\n",
                           encoding="utf-8", newline="\n")
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
    # newline="\n": this writes a TRACKED test fixture, and Python text mode would emit CRLF here on
    # Windows and LF on the runner - the same generator producing different bytes per machine. See
    # adapters/common.py's dump_json for the four fixtures that cost.
    fixture_path.write_text(
        json.dumps({"_generated": doc["_generated"], "teams": {k: colours[k] for k in sorted(colours)}},
                   indent=1) + "\n", encoding="utf-8", newline="\n")
    print("wrote %s (%d teams)" % (fixture_path, len(colours)))

    if a.check:
        # The study's `teams` is a LIST of rows carrying their own id, not an id-keyed object.
        fixraw = json.loads(Path(a.check).read_text(encoding="utf-8"))["teams"]
        fix = {r["id"]: r for r in fixraw} if isinstance(fixraw, list) else fixraw
        # The 2026-09-04 study scored every team on band_for()'s band. Since prompt 113 a RULED team
        # is scored on Joe's band instead, so the study describes only the unruled rows now.
        fix = {tid: r for tid, r in fix.items() if tid not in ruled}
        print("(study rows for ruled teams excluded from the acceptance: %d of %d remain)"
              % (len(fix), len(fixraw)))
        bad = []
        # Every REVIEW_PIN must still change something: score the team WITHOUT the pin and require
        # the answer to differ. A pin the measurement now agrees with is dead weight, and the
        # acceptance says so rather than letting it sit.
        by_id = {t["id"]: t for t in teams}
        for tid, pin in sorted(REVIEW_PINS.items()):
            t = by_id.get(tid)
            free = row_for(tid, logo_dir, ruled, t["primary"], t["secondary"], apply_pins=False) if t else None
            if free is None:
                bad.append("%s: pinned but has no usable art" % tid)
            elif (free["tint"], free["art"]) == (pin["tint"], pin["art"]):
                bad.append("%s: REVIEW_PIN is no longer load-bearing - the build chooses it unaided; delete the entry" % tid)
            mine = out.get(tid)
            if mine and (mine["tint"], mine["art"]) != (pin["tint"], pin["art"]):
                bad.append("%s: generated tint=%.2f art=%s does not carry its REVIEW_PIN" % (tid, mine["tint"], mine["art"]))
        fcounts = {}
        for tid, row in sorted(fix.items()):
            mine = out.get(tid)
            if mine is None:
                bad.append("%s: missing from generated table" % tid)
                continue
            fcounts[(mine["tint"], mine["art"])] = fcounts.get((mine["tint"], mine["art"]), 0) + 1
            want_row = FILE_CHANGED_SINCE_STUDY.get(tid, row)
            if tid in FILE_CHANGED_SINCE_STUDY and (row["tint"], row["art"]) == (want_row["tint"], want_row["art"]):
                bad.append("%s (%s): declared file-changed but matches the study - delete its entry"
                           % (tid, row.get("name", "?")))
            if mine["tint"] != want_row["tint"] or mine["art"] != want_row["art"]:
                bad.append("%s (%s): expected tint=%.2f art=%s | generated tint=%.2f art=%s"
                           % (tid, row.get("name", "?"), want_row["tint"], want_row["art"], mine["tint"], mine["art"]))
        print("")
        print("ACCEPTANCE against %d fixture rows: %s" % (len(fix), "PASS" if not bad else "FAIL"))
        # Counts are restricted to the fixture's ids. The generated table also carries teams the
        # study left out (they have art but no 2026 game rows), which must not be counted against
        # the ruling's 170 / 28 / 84 / 25.
        # The UNRULED rows as generated today: 105 / 15 / 56 / 10 (Joe's review pins, prompt 113 rev
        # C). Rev B had 104 / 17 / 54 / 11 with seven file-changed rows; the five pins move 197 back
        # from 0.72-raw to 1.0-dark (+1 flat dark, -1 tint raw), 2447 and 2464 from 1.0-dark to
        # 0.72-raw (-2 flat dark, +2 tint raw), 2627 from 1.0-dark to 1.0-raw (-1 flat dark, +1 flat
        # raw) and 2655 from 0.72-dark to 0.72-raw (-1 tint dark, +1 tint raw). The study said
        # 105 / 14 / 58 / 9 over the same 186.
        want = {(1.0, "raw"): 105, (1.0, "dark"): 15, (0.72, "raw"): 56, (0.72, "dark"): 10}
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
