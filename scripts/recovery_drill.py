#!/usr/bin/env python3
"""Prove a backup CSV actually restores, without touching the live table (deployment contract section 6).

    python scripts/recovery_drill.py games game_broadcasts
    python scripts/recovery_drill.py games --csv artifacts/backups/games_2026-09-02T040653Z.csv

For each table it opens ONE session and, inside it:

    create temp table drill_{table} (like {table} including all)
    copy drill_{table} from the newest artifacts/backups/{table}_*.csv
    assert count(drill) == count(live)
    assert (drill except live) and (live except drill) are both empty   -- exact content, not just a count

Temp tables are writer-safe by construction: they live in a per-session pg_temp schema, are invisible
to every other connection, and vanish the moment this process disconnects. Nothing in the mysports
schema is created, altered or deleted. A backup that does not round-trip is a backup you do not have.

Never prints the DSN. Windows-portable (encoding= on every open()).
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from adapters.common import find_repo_root, load_dotenv  # noqa: E402


def newest_backup(backup_dir: Path, table: str) -> Path | None:
    files = sorted(backup_dir.glob(f"{table}_*.csv"))
    return files[-1] if files else None


def drill(cur, table: str, csv_path: Path) -> dict:
    tmp = f"drill_{table}"
    cur.execute(f"create temp table {tmp} (like mysports.{table} including all)")
    with open(csv_path, "r", encoding="utf-8", newline="") as f, \
            cur.copy(f"copy {tmp} from stdin with (format csv, header)") as cp:
        while True:
            chunk = f.read(1 << 20)
            if not chunk:
                break
            cp.write(chunk)
    cur.execute(f"select count(*) from {tmp}")
    restored = cur.fetchone()[0]
    cur.execute(f"select count(*) from mysports.{table}")
    live = cur.fetchone()[0]
    try:
        cur.execute(f"select count(*) from (select * from {tmp} except select * from mysports.{table}) d")
        only_restored = cur.fetchone()[0]
        cur.execute(f"select count(*) from (select * from mysports.{table} except select * from {tmp}) d")
        only_live = cur.fetchone()[0]
        content = "exact" if only_restored == 0 and only_live == 0 else f"DIFFERS (+{only_restored}/-{only_live})"
    except Exception as e:  # noqa: BLE001 - some column types have no equality operator; the count still stands
        cur.connection.rollback()
        content = f"not comparable ({type(e).__name__})"
        only_restored = only_live = None
    return {"table": table, "csv": csv_path.name, "restored": restored, "live": live,
            "match": restored == live, "content": content}


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("tables", nargs="+")
    ap.add_argument("--csv", help="use this CSV instead of the newest backup (single table only)")
    args = ap.parse_args(argv)

    root = find_repo_root()
    load_dotenv(root / ".env")
    dsn = os.getenv("SUPABASE_DB_URL")
    if not dsn:
        print("ERROR: SUPABASE_DB_URL missing", file=sys.stderr)
        return 2
    if args.csv and len(args.tables) != 1:
        print("ERROR: --csv takes exactly one table", file=sys.stderr)
        return 2

    import psycopg
    backup_dir = root / "artifacts" / "backups"
    results = []
    failures = 0
    # one session; every temp table dies with it
    with psycopg.connect(dsn, application_name="mysports-recovery-drill") as conn, conn.cursor() as cur:
        for table in args.tables:
            if not table.replace("_", "").isalnum():
                print(f"skip {table}: not a plain table name", file=sys.stderr)
                continue
            csv_path = Path(args.csv) if args.csv else newest_backup(backup_dir, table)
            if csv_path is None or not csv_path.exists():
                print(f"{table}: NO BACKUP FOUND in {backup_dir.name}/", file=sys.stderr)
                failures += 1
                continue
            r = drill(cur, table, csv_path)
            results.append(r)
            ok = r["match"] and r["content"] == "exact"
            failures += 0 if ok else 1
            print(f"{'OK  ' if ok else 'FAIL'} {r['table']}: restored {r['restored']} rows, live {r['live']} rows, "
                  f"content {r['content']}  <- {r['csv']}")
        conn.rollback()   # nothing was written to mysports.*, but leave no open transaction behind

    print(f"\n{len(results)} table(s) drilled, {failures} failure(s). Temp tables dropped on disconnect.")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
