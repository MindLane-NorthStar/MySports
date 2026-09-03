#!/usr/bin/env python3
"""One-time backfill: generated_grids URL columns -> BARE R2 KEYS.

    python scripts/backfill_grid_keys.py --dry-run    # report, write nothing
    python scripts/backfill_grid_keys.py              # write

WHY KEYS AND NOT ABSOLUTE URLS. An absolute URL bakes today's bucket hostname into a row that outlives
it. The moment a custom domain goes in front of R2, every row already written points at the old host,
and nothing distinguishes a stale URL from a current one. A key is the part that is actually stable;
the base belongs to the consumer, which already joins it for team logos and network marks
(web/lib/config.js). Cowork's recommendation, unoverruled.

It also closes the standing smoke failure: one row was written as a bare key while the rest were
absolute, so `fetch(svg_asset_url)` on the newest row could not even parse as a URL. Standardising
removes the class of bug rather than that one row.

ONLY the three asset URL columns are touched, and only rows that actually hold an absolute URL.
Windows-portable: no %-strftime, encoding= on every open, ASCII console output.
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from adapters.common import find_repo_root, load_dotenv  # noqa: E402
from pipeline.db import DB  # noqa: E402

COLUMNS = ("svg_asset_url", "png_asset_url", "png2x_asset_url")


def to_key(value: str | None) -> str | None:
    """Strip any scheme+host, leaving the R2 key. Non-absolute values are already keys."""
    if not value or not value.lower().startswith(("http://", "https://")):
        return value
    rest = value.split("://", 1)[1]
    slash = rest.find("/")
    return rest[slash + 1:] if slash >= 0 else rest


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args(argv)

    load_dotenv(find_repo_root() / ".env")
    db = DB(None)
    try:
        rows = db.fetch("select id, " + ", ".join(COLUMNS) + " from generated_grids order by id")
        print("generated_grids rows: %d" % len(rows))
        changed = 0
        for row in rows:
            gid, values = row[0], row[1:]
            keys = tuple(to_key(v) for v in values)
            if keys == values:
                continue
            changed += 1
            print("  id %-4s %s" % (gid, values[0]))
            print("        -> %s" % keys[0])
            if not a.dry_run:
                db.run("update generated_grids set " + ", ".join(f"{c} = %s" for c in COLUMNS)
                       + " where id = %s", (*keys, gid), tag="grid_keys")
        if a.dry_run:
            db.conn.rollback()
        else:
            db.commit()

        after = db.fetch("select count(*) filter (where svg_asset_url like 'http%'), count(*) from generated_grids")[0]
        print("after: %d of %d rows still absolute%s" % (after[0], after[1], " (dry run)" if a.dry_run else ""))
        print("rewrote %d row(s)%s" % (changed, " (dry run)" if a.dry_run else ""))
    finally:
        db.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
