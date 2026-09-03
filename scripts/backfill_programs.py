#!/usr/bin/env python3
"""One-time backfill: a shadow `programs` row for every game that predates migration 0009.

    python scripts/backfill_programs.py --dry-run     # report what it would do, write nothing
    python scripts/backfill_programs.py               # batched, committed
    python scripts/backfill_programs.py --batch 100

Idempotent by construction: it selects only games with `program_id is null`, and the write itself is
`pipeline.programs.sync_shadow_program`, the SAME function `pipeline/load.py` calls on every game
upsert. A backfilled row and a freshly loaded row are therefore identical because they are made by
one implementation, not two that agree today. Re-running creates nothing.

Batched so a 375-row backfill commits in pieces rather than holding one long transaction against a
live database. Nothing here ever deletes a program.

Windows-portable: no %-strftime, every open() passes encoding=, ASCII-only console output.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from pipeline.db import DB  # noqa: E402
from pipeline.programs import sync_shadow_program  # noqa: E402

# short_name is what the grid calls a team ('Padres', 'Ohio State'); canonical_name is the long form.
SELECT_MISSING = """
select g.id, g.sport::text, ta.short_name, th.short_name, g.canonical_kickoff_at_utc
  from games g
  left join teams ta on ta.id = g.away_team_id
  left join teams th on th.id = g.home_team_id
 where g.program_id is null
 order by g.id
 limit %s
"""


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--batch", type=int, default=200, help="rows per committed batch (default 200)")
    ap.add_argument("--dry-run", action="store_true", help="report only; roll back every batch")
    a = ap.parse_args(argv)

    db = DB(None)
    made = batches = 0
    try:
        before = db.fetch("select count(*) from programs")[0][0]
        games, linked = db.fetch("select count(*), count(program_id) from games")[0]
        print("before: games %d (%d linked), programs %d" % (games, linked, before))

        while True:
            rows = db.fetch(SELECT_MISSING, (a.batch,))
            if not rows:
                break
            for gid, sport, away, home, _kick in rows:
                sync_shadow_program(db, gid, away, home, sport, None)
                made += 1
            batches += 1
            if a.dry_run:
                db.conn.rollback()
                print("batch %d: %d games (ROLLED BACK, dry run)" % (batches, len(rows)))
                break                      # without a commit the same rows come back forever
            db.commit()
            print("batch %d: %d games linked (committed)" % (batches, len(rows)))

        after = db.fetch("select count(*) from programs")[0][0]
        games, linked = db.fetch("select count(*), count(program_id) from games")[0]
        print("after:  games %d (%d linked), programs %d" % (games, linked, after))
        print("backfilled %d game(s) in %d batch(es)%s" % (made, batches, " (dry run)" if a.dry_run else ""))
    finally:
        db.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
