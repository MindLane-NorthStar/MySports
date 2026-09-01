#!/usr/bin/env python3
"""Dump one or more mysports.* tables to CSV before a migration that rewrites rows (deployment contract section 6).

    python scripts/backup_table.py source_observations game_broadcasts games

Writes artifacts/backups/{table}_{UTC timestamp}.csv through the SUPABASE_DB_URL connection (psycopg COPY).
Never prints the DSN. Windows-portable (encoding= on every open()).
"""
from __future__ import annotations

import os
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from adapters.common import find_repo_root, load_dotenv  # noqa: E402


def main(argv: list[str]) -> int:
    if not argv:
        print("usage: backup_table.py TABLE [TABLE ...]", file=sys.stderr)
        return 2
    root = find_repo_root()
    load_dotenv(root / ".env")
    dsn = os.getenv("SUPABASE_DB_URL")
    if not dsn:
        print("ERROR: SUPABASE_DB_URL missing", file=sys.stderr)
        return 2
    import psycopg
    out_dir = root / "artifacts" / "backups"
    out_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H%M%SZ")
    with psycopg.connect(dsn, application_name="mysports-backup") as conn, conn.cursor() as cur:
        for table in argv:
            if not table.replace("_", "").isalnum():
                print(f"skip {table}: not a plain table name", file=sys.stderr)
                continue
            path = out_dir / f"{table}_{stamp}.csv"
            n = 0
            with open(path, "w", encoding="utf-8", newline="") as f, cur.copy(f"copy (select * from mysports.{table} order by 1) to stdout with (format csv, header)") as cp:
                for chunk in cp:
                    text = bytes(chunk).decode("utf-8")
                    f.write(text)
                    n += text.count("\n")
            print(f"{table}: {max(n - 1, 0)} rows -> {path.relative_to(root).as_posix()}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
