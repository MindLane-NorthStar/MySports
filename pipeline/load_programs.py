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

from pipeline.db import DB

# The conflict target per program type, mirroring the partial unique indexes in 0012 and 0013.
CONFLICT = {
    "race_session": "sport, series, start_at, title",
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


def load(db, rows, known_networks):
    counts: Counter = Counter()
    now = datetime.now(timezone.utc)
    for row in rows:
        ptype = row.get("program_type")
        conflict = CONFLICT.get(ptype)
        if not conflict:
            print("WARN skip: no natural key for program_type %r" % ptype, file=sys.stderr)
            counts["skipped"] += 1
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
                 b.get("access_status") or "available", certainty, False, "NONE",
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
    for table, n in sorted(db.quarantined.items()):
        print("QUARANTINED %s: %d row(s)" % (table, n))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
