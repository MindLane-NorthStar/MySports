#!/usr/bin/env python3
"""NASCAR race sessions from cf.nascar.com, as `programs` rows.

    python -m adapters.nascar --year 2026                     # all three series
    python -m adapters.nascar --year 2026 --series cup        # one
    python -m adapters.nascar --fixture tests/fixtures/nascar_2026_cup.json --series cup

KNOW WHAT THIS BUYS BEFORE READING FURTHER. The app renders `games`; a race is a `program` (spec
v0.5, migration 0009: `programs` supertype, `program_type = race_session`, `sport = nascar`,
`series in (cup, oreilly, truck)`) with no `games` row at all, and NOTHING in `web/` renders a
program until rendering-contract v1.7 lands. So this makes the data and the adapter exist; the
Racing chip's empty state stays honest until v1.7. Do not invent a race card on the strength of it.

THE FEED. `https://cf.nascar.com/cacher/{year}/{series_id}/race_list_basic.json` is a flat list of
RACES - 40 / 33 / 25 for 2026 - each carrying `race_id`, `race_name`, `race_date`, `track_name`,
`television_broadcaster` and a NESTED `schedule` of that weekend's sessions (haulers, practice,
qualifying, the race). Prompt 17 probed 113 / 92 / 73 "entries"; those were the nested sessions.
Register section 7 Q2 says RACE SESSIONS ONLY, and a race session is one top-level entry - so this
emits 98 programs for 2026, not 964.

`race_type_id` 1 is a points race and 2 is an exhibition (the Clash, the Duels, the All-Star race).
Both are race sessions and both are emitted; the field is carried through so a later ruling can
separate them without a re-fetch.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from adapters.common import find_repo_root, http_json, parse_iso, iso_utc

ROOT = find_repo_root()

FEED = "https://cf.nascar.com/cacher/{year}/{series}/race_list_basic.json"

# The schema's own vocabulary (migration 0009's programs_series_ck), keyed by the feed's series_id.
SERIES = {1: "cup", 2: "oreilly", 3: "truck"}
SERIES_ID = {v: k for k, v in SERIES.items()}

# Fallback when the feed gives no usable duration. Cup and Xfinity races run long; trucks are
# shorter. These are DEFAULTS, recorded as such in each row's provenance - not measurements.
DEFAULT_MIN = {"cup": 210, "oreilly": 180, "truck": 150}


def duration_min(race: dict[str, Any], series: str) -> tuple[int, str]:
    """`(minutes, provenance)` - the feed's own elapsed time when it has one, else the default.

    `total_race_time` is "2:20:15" for a race that has been run and "0" (or absent) for one that has
    not. A scheduled 2026 race therefore has no elapsed time and takes the default, which is exactly
    why the provenance travels with the number.
    """
    raw = str(race.get("total_race_time") or "").strip()
    parts = raw.split(":")
    if len(parts) == 3 and all(p.isdigit() for p in parts):
        h, m, s = (int(p) for p in parts)
        total = h * 60 + m + (1 if s >= 30 else 0)
        if total > 0:
            return total, "feed:total_race_time"
    return DEFAULT_MIN.get(series, 180), "duration_defaults.json:%s" % series


def to_program(race: dict[str, Any], series: str) -> dict[str, Any] | None:
    """One `programs` row, or None when the entry has no usable start."""
    start = parse_iso(race.get("race_date"))
    if start is None:
        return None
    minutes, provenance = duration_min(race, series)
    title = (race.get("race_name") or "").strip()
    if not title:
        return None
    return {
        "sport": "nascar",
        "program_type": "race_session",
        "series": series,
        "title": title,
        "start_at": iso_utc(start),
        "expected_duration_min": minutes,
        # venue_id is an FK into `venues` and this feed carries a track_id from a different
        # namespace, so the track lands in location_text rather than inventing a mapping.
        "location_text": (race.get("track_name") or "").strip() or None,
        "source_tier": "official_league_feed",
        "_provenance": {
            "race_id": race.get("race_id"),
            "series_id": SERIES_ID[series],
            "race_type_id": race.get("race_type_id"),
            "track_id": race.get("track_id"),
            "duration": provenance,
            # Carried, NOT emitted as a broadcast row: game_broadcasts requires a game_id and has no
            # program_id, so a program cannot own one without DDL. See the module docstring in
            # tests/test_nascar.py and the migration named in the prompt-46 report.
            "television_broadcaster": race.get("television_broadcaster"),
            "radio_broadcaster": race.get("radio_broadcaster"),
        },
    }


def fetch(year: int, series: str) -> list[dict[str, Any]]:
    return http_json(FEED.format(year=year, series=SERIES_ID[series]))


def build(races: list[dict[str, Any]], series: str) -> list[dict[str, Any]]:
    out = []
    for r in races:
        p = to_program(r, series)
        if p is not None:
            out.append(p)
    return out


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--year", type=int, default=2026)
    ap.add_argument("--series", choices=sorted(SERIES_ID), action="append",
                    help="cup | oreilly | truck (repeatable; default all three)")
    ap.add_argument("--fixture", help="read this recorded feed instead of the network")
    ap.add_argument("--out", help="write the programs as JSON here instead of stdout")
    args = ap.parse_args(argv)

    wanted = args.series or sorted(SERIES_ID)
    programs: list[dict[str, Any]] = []
    for s in wanted:
        if args.fixture:
            with open(args.fixture, encoding="utf-8") as fh:
                races = json.load(fh)
        else:
            races = fetch(args.year, s)
        rows = build(races, s)
        programs.extend(rows)
        print("%-8s %3d races -> %3d race-session programs" % (s, len(races), len(rows)))
        if args.fixture:
            break

    print("total: %d programs" % len(programs))
    if args.out:
        p = Path(args.out)
        p.parent.mkdir(parents=True, exist_ok=True)
        with open(p, "w", encoding="utf-8", newline="\n") as fh:
            json.dump(programs, fh, indent=1, ensure_ascii=False)
            fh.write("\n")
        print("wrote %s" % p)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
