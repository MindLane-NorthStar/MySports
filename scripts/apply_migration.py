#!/usr/bin/env python3
"""Apply one db/migrations/*.sql file through SUPABASE_DB_URL in a single transaction (deployment contract D10, psql path).

    python scripts/apply_migration.py db/migrations/0006_reconciliation.sql [--dry-run]

--dry-run executes the file and rolls back (the SQL still runs, so its own verification can be checked). Prints nothing
from the environment. The Supabase migration-history entry is recorded separately by Cowork (db/README.md is the ledger).
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from adapters.common import find_repo_root, load_dotenv  # noqa: E402


def main(argv: list[str]) -> int:
    if not argv:
        print("usage: apply_migration.py FILE [--dry-run]", file=sys.stderr)
        return 2
    dry = "--dry-run" in argv
    path = Path([a for a in argv if not a.startswith("--")][0])
    root = find_repo_root()
    load_dotenv(root / ".env")
    dsn = os.getenv("SUPABASE_DB_URL")
    if not dsn:
        print("ERROR: SUPABASE_DB_URL missing", file=sys.stderr)
        return 2
    sql = path.read_text(encoding="utf-8")
    import psycopg
    with psycopg.connect(dsn, autocommit=False, application_name="mysports-migrate") as conn:
        with conn.cursor() as cur:
            cur.execute(sql)
        if dry:
            conn.rollback()
            print(f"{path.name}: executed and ROLLED BACK (dry run)")
        else:
            conn.commit()
            print(f"{path.name}: applied and committed")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
