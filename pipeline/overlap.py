#!/usr/bin/env python3
"""The overlap rule (Joe, 2026-09-03) - rendering contract v1.6.5.

Two programs on the same network row whose blocks overlap SPLIT THE DIFFERENCE: the earlier one's end
and the later one's start each move by half the overlap, meeting at its midpoint, so they sit side by
side in ONE row instead of forcing a second lane. A 12:30 kickoff ending 4:00 and a 3:30 kickoff
ending 7:00 both become 3:45.

Why it matters: block lengths are POLICY, not measurement - every CFB game is drawn 210 minutes wide
whatever it actually runs. So a 12:30 and a 3:30 on the same network "overlap" by 30 minutes purely as
an artefact of that estimate, and that artefact alone was generating a whole extra row.

THREE LIMITS, each there to stop the rule hiding something real:
  * over 60 minutes of overlap -> second row. That much is not an estimate artefact.
  * three or more mutually overlapping -> lanes. A network airs one thing at a time, so a three-way
    overlap means the estimates are wrong, and three squeezed chips would hide it.
  * either chip would fall under 60 minutes wide -> second row. A chip too narrow to show its matchup
    is worse than an extra row.

PRESENTATIONAL ONLY. It changes the rendered block, never canonical_kickoff_at_utc, never
block_minutes, never anything written to the database. The detail panel still shows real times.

Mirrored exactly by web/lib/overlap.js for the live phone grid, and pinned to it by the shared
fixtures in tests/fixtures/overlap_cases.json.
"""
from __future__ import annotations

MAX_SPLIT_MIN = 60
MIN_CHIP_MIN = 60


def _overlaps(a: dict, b: dict) -> bool:
    return a["start"] < b["end"] and b["start"] < a["end"]


def split_overlaps(items, max_split_min: int = MAX_SPLIT_MIN, min_chip_min: int = MIN_CHIP_MIN):
    """One network row's blocks in, adjusted blocks out.

    Returns (items, split, guarded) where items is a NEW list in the input's order and split/guarded
    are index pairs. Never mutates the input.
    """
    rows = list(items or [])
    out = [dict(it) for it in rows]
    order = sorted(range(len(out)), key=lambda i: (out[i]["start"], out[i]["end"]))

    # Any block overlapping two or more others is out of the pairwise rule entirely, and so is
    # everything it overlaps - a chain of three cannot be resolved two at a time.
    blocked: set[int] = set()
    for i in order:
        partners = [j for j in order if j != i and _overlaps(out[i], out[j])]
        if len(partners) >= 2:
            blocked.add(i)
            blocked.update(partners)

    split: list[tuple[int, int]] = []
    guarded: list[tuple[int, int]] = []
    for k in range(len(order) - 1):
        i, j = order[k], order[k + 1]
        if i in blocked or j in blocked:
            continue
        a, b = out[i], out[j]
        if not a["end"] > b["start"]:
            continue
        if a["end"] - b["start"] > max_split_min:
            continue
        # floor division, so Python and JavaScript's Math.floor land on the same minute
        mid = (a["end"] + b["start"]) // 2
        if mid - a["start"] < min_chip_min or b["end"] - mid < min_chip_min:
            guarded.append((i, j))
            continue
        a["end"] = mid
        b["start"] = mid
        split.append((i, j))
    return out, split, guarded
