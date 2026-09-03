#!/usr/bin/env python3
"""One-time backfill of viewer_game_eligibility.market_pending (E5, migration 0010).

    python scripts/backfill_market_pending.py --dry-run    # report, write nothing
    python scripts/backfill_market_pending.py              # write, in batches

WHY A BACKFILL IS NEEDED AT ALL: pipeline/reconcile.py only visits games that have new evidence, so
after 0010 the existing rows would keep market_pending = null indefinitely - the reconciler would
never wake for a game whose facts have not moved. One pass fixes that; from then on the reconciler
maintains the column in its own upsert.

It calls is_market_pending() FROM pipeline.reconcile rather than reimplementing the rule. A backfilled
verdict and a reconciled verdict are therefore identical by construction, not by two pieces of code
agreeing today.

ONLY market_pending IS WRITTEN. No other column is touched, no row is inserted, nothing is deleted.
Windows-portable: no %-strftime, encoding= on every open, ASCII console output.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from adapters.common import find_repo_root, load_data  # noqa: E402
from pipeline.db import DB  # noqa: E402
from pipeline.reconcile import is_market_pending  # noqa: E402


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--batch", type=int, default=200)
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args(argv)

    root = find_repo_root()
    rules = load_data(root, "authority_rules.json", {})
    db = DB(None)
    try:
        before = db.fetch("select count(*), count(market_pending) from viewer_game_eligibility")[0]
        print("before: %d rows, %d computed, %d null" % (before[0], before[1], before[0] - before[1]))

        rows = db.fetch("select game_id, eligible from viewer_game_eligibility order by game_id")
        bcs = db.fetch("select game_id, service_id, access_status::text, blackout_rule::text, active "
                       "from game_broadcasts where active")
        by_game: dict[str, list[dict]] = {}
        for gid, sid, acc, black, active in bcs:
            by_game.setdefault(gid, []).append(
                {"service_id": sid, "access_status": acc, "blackout_rule": black, "active": active})

        pending, plain, n = 0, 0, 0
        for gid, eligible in rows:
            mp = is_market_pending(db, gid, bool(eligible), by_game.get(gid, []), rules)
            pending += 1 if mp else 0
            plain += 0 if mp else 1
            if not a.dry_run:
                db.run("update viewer_game_eligibility set market_pending = %s where game_id = %s "
                       "and market_pending is distinct from %s", (mp, gid, mp), tag="backfill")
            n += 1
            if not a.dry_run and n % a.batch == 0:
                db.commit()
                print("  committed %d of %d" % (n, len(rows)))

        if a.dry_run:
            db.conn.rollback()
        else:
            db.commit()

        after = db.fetch("select count(*), count(market_pending), count(*) filter (where market_pending) "
                         "from viewer_game_eligibility")[0]
        print("after:  %d rows, %d computed, %d null, %d market_pending"
              % (after[0], after[1], after[0] - after[1], after[2]))
        print("backfilled %d row(s): %d pending, %d not%s" % (n, pending, plain, " (dry run)" if a.dry_run else ""))
    finally:
        db.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
