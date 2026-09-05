#!/usr/bin/env python3
"""One-time correction: the 98 loaded NASCAR race sessions are stored 4-5 hours early.

    python scripts/fix_nascar_start_times.py                 # dry run, prints the table
    python scripts/fix_nascar_start_times.py --apply         # one transaction
    python scripts/fix_nascar_start_times.py --fixtures      # read the recorded feeds, not the net

THE DEFECT (prompt 48's report). `cf.nascar.com` publishes `race_date` as a NAIVE Eastern wall clock
- `"2026-09-06T17:00:00"` - and `adapters/common.parse_iso` stamps a naive value UTC. So every race
loaded by prompt 47 sits 4 hours early in EDT and 5 in EST, and the Darlington race shows at 1:00 PM
instead of 5:00 PM. Prompt 48 fixed the adapter (`77258ff`) and could NOT fix the rows: `start_at` is
part of the race-session natural key, so a corrected time reads as a different race and the
moved-twin guard skips it - by design, because without that guard the next refresh would have
inserted 98 duplicates.

HOW A ROW IS MATCHED, and why it is not "matching by start_at". The loader stored no race id:
`adapters/nascar.py` carries `race_id` in `_provenance`, and `pipeline/load_programs.py`'s
`PROGRAM_COLS` does not include it, so it never reached the database. `source_url` is per-SERIES,
not per-race. Title plus series is ambiguous - the two Daytona Duels share a title and a day.

So each feed race is matched on `(series, title, THE VALUE THE BUGGY LOADER WOULD HAVE WRITTEN)`,
which is the naive wall clock read as UTC. That is an exact three-part key, it disambiguates the
Duels because their naive times differ, and it does something a fuzzy match cannot: **it proves the
defect's mechanism on every row it touches.** A row that does not match is a row this script does not
understand, and the run stops rather than guessing.

WHAT ELSE MOVES: nothing. `programs` has no column derived from `start_at` - no `viewing_day`, no
stored end; `expected_duration_min` is a duration and `postponed_to` is null on all 98. The viewing
day is derived in the app from `start_at` (`web/lib/programs.js` `viewingDayOf`), so it follows.
None of the 98 attached `game_broadcasts` rows carries a `window_start` or `window_end`. Eligibility
does not depend on time, and the script checksums it before and after to prove that rather than
assert it.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from adapters.common import http_json  # noqa: E402
from adapters.nascar import FEED, SERIES, SERIES_ID, race_start  # noqa: E402
from pipeline.db import DB, ROOT  # noqa: E402

ET = ZoneInfo("America/New_York")
UTC = timezone.utc

FIXTURES = {"cup": "nascar_2026_cup.json", "oreilly": "nascar_2026_oreilly.json",
            "truck": "nascar_2026_truck.json"}


def feed_races(year: int, use_fixtures: bool) -> list[dict]:
    """Every race in all three series, with the two timestamps that matter."""
    out = []
    for series in sorted(SERIES_ID):
        if use_fixtures:
            path = ROOT / "tests" / "fixtures" / FIXTURES[series]
            with open(path, encoding="utf-8") as fh:
                races = json.load(fh)
            origin = "fixture:%s" % FIXTURES[series]
        else:
            races = http_json(FEED.format(year=year, series=SERIES_ID[series]))
            origin = FEED.format(year=year, series=SERIES_ID[series])
        for r in races:
            raw = (r.get("race_date") or "").strip()
            title = (r.get("race_name") or "").strip()
            if not raw or not title:
                continue
            correct = race_start(raw)
            if correct is None:
                continue
            try:
                naive = datetime.fromisoformat(raw)
            except ValueError:
                continue
            if naive.tzinfo is not None:
                continue                      # a zoned feed value was never mis-stamped
            out.append({
                "series": series, "title": title, "race_id": r.get("race_id"),
                # what the buggy loader wrote: the naive wall clock read as UTC
                "stored_expected": naive.replace(tzinfo=UTC),
                # what it should be: the same wall clock read as Eastern
                "correct": correct.astimezone(UTC),
                "origin": origin,
            })
    return out


def stored_rows(db: DB) -> list[dict]:
    rows = db.fetch("select program_id, series, title, start_at from programs "
                    "where sport = 'nascar' and program_type = 'race_session' order by program_id")
    return [{"program_id": r[0], "series": r[1], "title": r[2],
             "start_at": r[3] if r[3].tzinfo else r[3].replace(tzinfo=UTC)} for r in rows]


def checksums(db: DB) -> dict[str, str]:
    """Everything that must NOT move, hashed before and after."""
    one = lambda sql: db.fetch(sql)[0][0]
    return {
        "programs_other": one(
            "select md5(string_agg(program_id || ':' || coalesce(start_at::text, '-'), '|' "
            "order by program_id)) from programs where not (sport = 'nascar' "
            "and program_type = 'race_session')"),
        "viewer_program_eligibility": one(
            "select md5(string_agg(program_id || ':' || eligible::text || ':' "
            "|| coalesce(reason, ''), '|' order by program_id)) from viewer_program_eligibility"),
        "viewer_game_eligibility": one(
            "select md5(string_agg(game_id || ':' || eligible::text || ':' || coalesce(reason, '') "
            "|| ':' || coalesce(market_pending::text, '-'), '|' order by game_id)) "
            "from viewer_game_eligibility"),
        "game_broadcasts": one(
            "select md5(string_agg(id || ':' || coalesce(window_start::text, '-') || ':' "
            "|| coalesce(window_end::text, '-'), '|' order by id)) from game_broadcasts"),
    }


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--year", type=int, default=2026)
    ap.add_argument("--apply", action="store_true", help="write; otherwise this is a dry run")
    ap.add_argument("--fixtures", action="store_true", help="read the recorded feeds")
    args = ap.parse_args(argv)

    db = DB()
    stored = stored_rows(db)
    feed = feed_races(args.year, args.fixtures)
    print("stored race sessions: %d | feed races: %d | source: %s"
          % (len(stored), len(feed), "recorded fixtures" if args.fixtures else "cf.nascar.com"))

    # ---- match on (series, title, the value the buggy loader would have written)
    by_key: dict[tuple, list[dict]] = {}
    for f in feed:
        by_key.setdefault((f["series"], f["title"], f["stored_expected"]), []).append(f)

    plan, unmatched_rows = [], []
    used = set()
    for row in stored:
        key = (row["series"], row["title"], row["start_at"])
        hits = by_key.get(key) or []
        hits = [h for h in hits if id(h) not in used]
        if len(hits) != 1:
            unmatched_rows.append((row, len(hits)))
            continue
        f = hits[0]
        used.add(id(f))
        delta = f["correct"] - row["start_at"]
        plan.append({"program_id": row["program_id"], "series": row["series"], "title": row["title"],
                     "race_id": f["race_id"], "old": row["start_at"], "new": f["correct"],
                     "offset_h": delta.total_seconds() / 3600.0})
    unmatched_feed = [f for f in feed if id(f) not in used]

    print()
    print("| program_id | series | title | stored start_at | corrected start_at | offset |")
    print("|---:|---|---|---|---|---:|")
    for p in sorted(plan, key=lambda x: x["new"]):
        print("| %d | %s | %s | %s | %s | +%gh |"
              % (p["program_id"], p["series"], p["title"][:44],
                 p["old"].astimezone(ET).strftime("%Y-%m-%d %H:%M ET"),
                 p["new"].astimezone(ET).strftime("%Y-%m-%d %H:%M ET"), p["offset_h"]))

    offsets = sorted({p["offset_h"] for p in plan})
    print()
    print("matched %d of %d stored rows | offsets seen: %s" % (len(plan), len(stored), offsets))
    if unmatched_rows:
        print("UNMATCHED STORED ROWS (%d):" % len(unmatched_rows))
        for row, n in unmatched_rows:
            print("   %-8s %-46s %s  (%d feed candidates)"
                  % (row["series"], row["title"][:46], row["start_at"], n))
    if unmatched_feed:
        print("UNMATCHED FEED RACES (%d):" % len(unmatched_feed))
        for f in unmatched_feed:
            print("   %-8s %-46s %s" % (f["series"], f["title"][:46], f["stored_expected"]))

    # ---- gate
    problems = []
    if len(plan) != 98:
        problems.append("expected 98 matched rows, got %d" % len(plan))
    if unmatched_rows or unmatched_feed:
        problems.append("%d stored and %d feed races unmatched"
                        % (len(unmatched_rows), len(unmatched_feed)))
    bad_offset = [p for p in plan if p["offset_h"] not in (4.0, 5.0)]
    if bad_offset:
        problems.append("%d rows with an offset other than +4h/+5h" % len(bad_offset))
        for p in bad_offset[:5]:
            print("   BAD OFFSET %s %s %+gh" % (p["series"], p["title"][:40], p["offset_h"]))
    # EVERY OFFSET MUST BE THE ZONE'S OWN, and the zone database is what says so - not a month.
    # A first pass gated on "January, February, November and December are +5h" and failed two
    # correct rows: DST 2026 runs Sunday March 8 to Sunday November 1, so the DuraMAX Texas Grand
    # Prix (Mar 1) and the GOVX 200 (Mar 7) are genuinely EST and genuinely +5h. Asking zoneinfo
    # what the offset is at that instant cannot be wrong about a transition week.
    for p in plan:
        want = -p["new"].astimezone(ET).utcoffset().total_seconds() / 3600.0
        if p["offset_h"] != want:
            problems.append("%s %s: offset %+gh but %s is UTC%+g, wanting %+gh"
                            % (p["series"], p["title"][:36], p["offset_h"],
                               p["new"].astimezone(ET).strftime("%Y-%m-%d"),
                               p["new"].astimezone(ET).utcoffset().total_seconds() / 3600.0, want))
    if problems:
        print()
        print("GATE FAILED:")
        for x in problems[:10]:
            print("   " + x)
        db.close()
        return 1
    print("GATE PASSED: 98 rows, every offset +4h in EDT and +5h in EST, nothing else touched.")

    if not args.apply:
        print("\ndry run - nothing written. Re-run with --apply.")
        db.close()
        return 0

    before = checksums(db)
    for p in plan:
        db.run("update programs set start_at = %s, updated_at = now() "
               "where program_id = %s and sport = 'nascar' and program_type = 'race_session'",
               (p["new"], p["program_id"]), tag="programs.start_at")
    db.commit()
    after = checksums(db)

    print()
    print("APPLIED %d updates." % len(plan))
    print("| checksum | before | after | unchanged |")
    print("|---|---|---|---|")
    ok = True
    for k in before:
        same = before[k] == after[k]
        ok = ok and same
        print("| %s | `%s` | `%s` | %s |" % (k, (before[k] or "")[:16], (after[k] or "")[:16],
                                             "YES" if same else "**NO**"))
    n = db.fetch("select count(*) from programs where sport='nascar' and program_type='race_session'")[0][0]
    print("\nnascar race sessions still: %d" % n)
    db.close()
    return 0 if ok and n == 98 else 1


if __name__ == "__main__":
    raise SystemExit(main())
