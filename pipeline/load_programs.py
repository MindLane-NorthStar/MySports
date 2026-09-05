#!/usr/bin/env python3
"""Load `programs` rows (and their broadcasts) from an adapter's output.

    python -m pipeline.load_programs --input artifacts/programs/nascar_2026.json
    python -m pipeline.load_programs --input ... --emit-sql artifacts/sql/programs.sql

WHY THIS IS NOT pipeline/load.py. That loader is game-shaped end to end: it reads adapter fixtures
keyed by game id, writes `games`, and attaches broadcasts on `game_id, service_id,
delivery_surface, feed_side`. A program has no game id and its broadcast rows conflict on
`program_id, ...` (migration 0012's partial index). Bolting a second subject into that path would
have meant a branch in every step of it.

IDEMPOTENCE COMES FROM 0012/0013's PARTIAL UNIQUE INDEXES, one per program_type, not from a
select-then-insert. `programs` had no natural key at all until this run, which is why prompt 46
declined to load anything: a second run would have inserted 98 duplicate race sessions rather than
updating 98 rows. `--input` twice must report inserts the first time and updates the second, and
tests/test_load_programs.py asserts exactly that against --emit-sql.

ACCESS COMES FROM THE VIEWER'S PROFILE, NEVER FROM THE ADAPTER. An adapter knows who is airing a
race; only `data/access_profile.json` knows whether Joe can receive them. `adapters/nascar.py` wrote
`access_status: "available"` for every broadcaster the feed named, and two 2026 races - the Clash at
Bowman Gray and the Black's Tire 250 - are on **FS2**, which the profile lists as `unavailable`. So
this loader classifies every broadcast row itself, through `adapters.common.access_status_for`, and
an adapter's own `access_status` is accepted only when it is something the profile cannot know
(`out_of_market`, `unverified` - the regional-window states).

BROADCASTS ARE PER PROGRAM, NEVER A PER-SERIES CONSTANT. A NASCAR season is on FOX, FS1, FS2, NBC,
Prime Video, TNT and USA in different weeks; writing "the Cup series is on FOX" would be wrong for
most of the calendar. A broadcaster the network table does not know is loaded as
TBA_NO_RIGHTS_HOLDER with a warning and NEVER dropped: losing the fact that a race is televised is
worse than not knowing which channel.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from adapters.common import access_lookup, access_status_for, normalize_outlet
from pipeline.db import DB, ROOT

# THE DUPLICATE HAZARD, and why this file refuses a write rather than making one.
#
# Every program_type's natural key CONTAINS start_at (see CONFLICT below). That is fine while a
# schedule only gains rows - and it is a trap the moment an adapter CORRECTS a time. Prompt 48 found
# that cf.nascar.com publishes naive Eastern timestamps and adapters/common.parse_iso had been
# stamping them UTC, so all 98 loaded races are four hours early. Fixing the adapter changes
# start_at, which changes the natural key, which means ON CONFLICT matches nothing and the next
# scheduled refresh inserts 98 SECOND COPIES beside the 98 wrong ones.
#
# So a row that looks like a moved twin of a stored row is SKIPPED and REPORTED, never inserted. The
# operator gets a line naming both times and can decide; a loader that quietly doubled a season
# would be discovered by a reader seeing every race twice.
#
# The match is deliberately narrow - same sport, same type, same series, same title, same ET
# CALENDAR DAY, different start_at - so a genuine doubleheader (two different titles, or the same
# title on different days) is unaffected. It cannot fire on an unchanged reload, because there the
# start_at is equal and ON CONFLICT does its job.
MOVED_TWIN_SQL = """
select program_id, start_at from programs
 where sport = %s and program_type = %s and title = %s
   and series is not distinct from %s
   and (start_at at time zone 'America/New_York')::date = (%s::timestamptz at time zone 'America/New_York')::date
   and start_at <> %s
 limit 1"""

# The conflict target per program type, mirroring the partial unique indexes in 0012 and 0013.
CONFLICT = {
    # MIGRATION 0015, and the reason is worth the line. 0012's key was `sport, series, start_at,
    # title`, and `series` is NULLABLE - so for IndyCar, which runs ONE series and therefore carries
    # no series value at all, every row looked new to ON CONFLICT and a second load INSERTED.
    # Measured: two runs of the same 18 races produced 36 rows. `coalesce(series, '')` is what makes
    # a null series a value the index can compare, and 0015 builds the matching expression index.
    "race_session": "sport, (coalesce(series, '')), start_at, title",
    "weekly_show": "sport, title, start_at",
    "studio_show": "sport, title, start_at",
    "fight_card": "sport, start_at, title",
    "special_event": "sport, start_at, title",
}

# EVERY ONE OF THOSE INDEXES IS PARTIAL, and ON CONFLICT inference will not match a partial index
# unless the statement repeats its predicate. `on conflict (sport, series, start_at, title)` alone
# fails with "there is no unique or exclusion constraint matching the ON CONFLICT specification",
# which is exactly what the first attempt at this load hit. db.upsert() builds `on conflict (...)`
# with no room for a WHERE, so program rows are written with a statement of their own.
PREDICATE = {k: "program_type = '%s'" % k for k in CONFLICT}

PROGRAM_COLS = [
    "sport", "program_type", "title", "subtitle", "start_at", "expected_duration_min",
    "open_ended", "location_text", "on_site", "series", "headliners", "hosts_crew",
    "brand_key", "bookend", "anchor_program_id", "segments", "postponed_to",
    "source_url", "source_tier",
]
# Null means "I did not find out", never "erase what is there" - the same rule pipeline/db.py's
# `preserve` documents for teams.
PRESERVE = ["subtitle", "location_text", "headliners", "hosts_crew", "segments", "source_url"]


def normalise_network(key, known):
    """`(service_id, carriage_certainty, warnings)` for one broadcaster string."""
    warn: list[str] = []
    if not key:
        return None, "TBA_NO_RIGHTS_HOLDER", warn
    slug = key.strip().lower().replace(" ", "-")
    aliases = {
        "prime-video": "prime-video", "prime": "prime-video", "amazon": "prime-video",
        "usa": "usa-network", "cw": "the-cw",
        "paramount+": "paramount-plus", "max": "hbo-max",
    }
    slug = aliases.get(slug, slug)
    # `known is None` means the network table could not be read - the offline --emit-sql path. It is
    # NOT the same as "this network is unknown": claiming 40 unknown networks because there was no
    # database to ask would make a dry run look like a data problem.
    if known is None or slug in known:
        return slug, "CONFIRMED", warn
    warn.append(key)
    return None, "TBA_NO_RIGHTS_HOLDER", warn


# The two states the access profile cannot decide, because they are facts about a regional window
# rather than about what the viewer subscribes to. An adapter that knows one of them keeps it.
ADAPTER_OWNED_ACCESS = ("out_of_market", "unverified")


def access_for(broadcast: dict, profile: tuple[set[str], set[str]]) -> str:
    """`access_status` for one broadcast row: the profile decides, unless the row states a window."""
    stated = (broadcast.get("access_status") or "").strip().lower()
    if stated in ADAPTER_OWNED_ACCESS:
        return stated
    label = broadcast.get("label") or broadcast.get("service_id") or ""
    return access_status_for(normalize_outlet(label), *profile)


def moved_twin(db, row, ptype):
    """`(program_id, stored_start)` when a stored row is this row at a different time, else None."""
    if db.conn is None or not row.get("start_at"):
        return None                    # offline --emit-sql has nothing to ask
    found = db.fetch(MOVED_TWIN_SQL, (row.get("sport"), ptype, row.get("title"),
                                      row.get("series"), row.get("start_at"), row.get("start_at")))
    return found[0] if found else None


def load(db, rows, known_networks, profile=None):
    counts: Counter = Counter()
    now = datetime.now(timezone.utc)
    if profile is None:
        profile = access_lookup(ROOT)
    for row in rows:
        ptype = row.get("program_type")
        conflict = CONFLICT.get(ptype)
        if not conflict:
            print("WARN skip: no natural key for program_type %r" % ptype, file=sys.stderr)
            counts["skipped"] += 1
            continue

        twin = moved_twin(db, row, ptype)
        if twin is not None:
            print("WARN moved-twin SKIPPED: %r %s stored at %s, feed says %s - the natural key "
                  "contains start_at, so loading this would ADD a row rather than correct one"
                  % (row.get("title"), ptype, twin[1], row.get("start_at")), file=sys.stderr)
            counts["moved_twin_skipped"] += 1
            continue

        program = {c: row.get(c) for c in PROGRAM_COLS if c in row}
        program.setdefault("program_type", ptype)
        for j in ("headliners", "hosts_crew", "segments"):
            if isinstance(program.get(j), (list, dict)):
                program[j] = json.dumps(program[j])
        cols = list(program)
        updatable = [c for c in cols if c not in ("sport", "program_type")]
        sets = ", ".join(
            ("%s = coalesce(excluded.%s, programs.%s)" % (c, c, c)) if c in PRESERVE
            else ("%s = excluded.%s" % (c, c))
            for c in updatable)
        db.run(
            "insert into programs (%s) values (%s) on conflict (%s) where %s do update set %s"
            % (", ".join(cols), ", ".join("%s" for _ in cols), conflict, PREDICATE[ptype], sets),
            tuple(program[c] for c in cols), tag="programs")
        counts["programs"] += 1

        broadcasts = row.get("broadcasts") or []
        if not broadcasts:
            continue
        # The program's id is not returned by upsert, so the broadcast rows are attached by the same
        # natural key rather than by a round trip - one statement, and correct whether the program
        # was just inserted or already existed.
        for b in broadcasts:
            sid, certainty, warn = normalise_network(b.get("service_id"), known_networks)
            access = access_for(b, profile)
            counts["access:" + access] += 1
            for w in warn:
                print("WARN unknown network %r on %r - loaded as TBA_NO_RIGHTS_HOLDER"
                      % (w, row.get("title")), file=sys.stderr)
                counts["unknown_network"] += 1
            db.run(
                "insert into game_broadcasts (program_id, service_id, delivery_surface, feed_side, "
                "is_primary, requires_auth, access_status, carriage_certainty, suppresses_local_feed, "
                "blackout_rule, label, last_seen_at, active, window_start, window_end) "
                "select p.program_id, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s "
                "from programs p where p.sport = %s and p.program_type = %s and p.title = %s "
                "and p.start_at = %s "
                "on conflict (program_id, service_id, delivery_surface, feed_side) "
                "where program_id is not null do update set "
                "access_status = excluded.access_status, carriage_certainty = excluded.carriage_certainty, "
                "label = excluded.label, last_seen_at = excluded.last_seen_at, active = excluded.active, "
                "window_start = excluded.window_start, window_end = excluded.window_end",
                (sid, b.get("delivery_surface") or "LINEAR", b.get("feed_side") or "NATIONAL",
                 bool(b.get("is_primary")), bool(b.get("requires_auth")),
                 access, certainty, False, "NONE",
                 b.get("label"), now, True, b.get("window_start"), b.get("window_end"),
                 row.get("sport"), ptype, row.get("title"), row.get("start_at")),
                tag="game_broadcasts.program")
            counts["broadcasts"] += 1
    return counts


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--input", required=True, help="adapter output: a JSON list of program rows")
    ap.add_argument("--emit-sql", metavar="FILE", help="write the statements instead of executing")
    args = ap.parse_args(argv)

    with open(args.input, encoding="utf-8") as fh:
        rows = json.load(fh)

    db = DB(args.emit_sql)
    # None, not an empty set: offline the table cannot be read, and an empty set would mark every
    # network unknown. See normalise_network.
    known = {r[0] for r in db.fetch("select id from networks_services")} if db.conn is not None else None

    counts = load(db, rows, known)
    db.commit()
    db.close()
    print("programs %d | broadcasts %d | unknown networks %d | skipped %d"
          % (counts["programs"], counts["broadcasts"], counts["unknown_network"], counts["skipped"]))
    if counts["moved_twin_skipped"]:
        print("MOVED-TWIN SKIPPED %d row(s): a stored program matches on everything but start_at. "
              "Correcting those times is a database decision, not a load - see pipeline/load_programs.py"
              % counts["moved_twin_skipped"])
    split = sorted((k[len("access:"):], v) for k, v in counts.items() if k.startswith("access:"))
    if split:
        print("access: " + " | ".join("%s %d" % kv for kv in split))
    for table, n in sorted(db.quarantined.items()):
        print("QUARANTINED %s: %d row(s)" % (table, n))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
