#!/usr/bin/env python3
"""Generate db/enums.json from db/migrations/*.sql.

WHY. One mistyped enum once aborted a whole daily refresh: an adapter wrote
`carriageCertainty="UNVERIFIED"` into an `access_status` slot, Postgres rejected the statement, and
the entire run died with it - including every good row in the same batch. The specific bug was fixed
at `64c9764`; the CLASS was not. Validating a value needs the allowed set, and the only honest source
for that set is the migrations that created it.

WHAT IT READS. Every `CREATE TYPE ... AS ENUM (...)` and every later `ALTER TYPE ... ADD VALUE ...`,
in migration order, so a type that gained a value in 0009 has it here. Order matters: a value added
by an ALTER must not be missing just because the CREATE was five files earlier.

    python scripts/build_enums.py            # write db/enums.json
    python scripts/build_enums.py --check    # exit 1 if the checked-in file is stale

`tests/test_enums.py` runs the --check comparison, so the file cannot drift from the migrations
without a red gate.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS = ROOT / "db" / "migrations"
OUT = ROOT / "db" / "enums.json"

# `create type NAME as enum ('a', 'b')` - the schema writes these lower-case and unqualified.
CREATE = re.compile(
    r"create\s+type\s+(?:\w+\.)?(\w+)\s+as\s+enum\s*\((.*?)\)\s*;",
    re.IGNORECASE | re.DOTALL,
)
# `alter type NAME add value 'x'` - optionally IF NOT EXISTS, optionally BEFORE/AFTER another value.
ALTER = re.compile(
    r"alter\s+type\s+(?:\w+\.)?(\w+)\s+add\s+value\s+(?:if\s+not\s+exists\s+)?'([^']*)'",
    re.IGNORECASE,
)
LITERAL = re.compile(r"'([^']*)'")


def strip_comments(sql: str) -> str:
    """Drop -- line comments and /* block */ comments so a commented-out CREATE TYPE is not read."""
    sql = re.sub(r"/\*.*?\*/", " ", sql, flags=re.DOTALL)
    return re.sub(r"--[^\n]*", " ", sql)


TABLE_START = re.compile(r"create\s+table\s+(?:if\s+not\s+exists\s+)?(?:\w+\.)?(\w+)", re.IGNORECASE)
COLUMN = re.compile(r"^([A-Za-z_]\w*)\s+([A-Za-z_]\w*)")
# These parse as `word word` but are constraints, not columns.
NOT_COLUMNS = {"constraint", "primary", "unique", "foreign", "check", "exclude", "like"}


def enum_columns(sql, enums):
    """`{"table.column": "enum_type"}` for every column declared with one of the enum types.

    The validator has to know WHICH columns are enum-typed; the set of legal values on its own cannot
    tell it that `game_broadcasts.access_status` is an `access_status` and `games.sport` is a `sport`.
    Both come from the same migrations, so neither can drift from the schema independently.

    Scanned line by line rather than by matching a whole CREATE TABLE body: a body regex has to find
    the closing paren, and these tables contain `numeric(5,2)`, `default now()` and `check (...)`, so
    every non-greedy attempt truncates at the wrong one. Tracking the current table and reading
    `column type` off each line has nothing to get wrong.
    """
    out = {}
    table = None
    for raw_line in sql.splitlines():
        line = raw_line.strip()
        start = TABLE_START.search(line)
        if start:
            table = start.group(1).lower()
            continue
        if table is None:
            continue
        if line.startswith(")"):
            table = None
            continue
        m = COLUMN.match(line.rstrip(","))
        if not m:
            continue
        col, typ = m.group(1).lower(), m.group(2).lower()
        if col in NOT_COLUMNS:
            continue
        if typ in enums:
            out["%s.%s" % (table, col)] = typ
    return out


def build() -> dict[str, object]:
    enums: dict[str, list[str]] = {}
    columns: dict[str, str] = {}
    for path in sorted(MIGRATIONS.glob("*.sql")):
        with open(path, encoding="utf-8") as fh:
            sql = strip_comments(fh.read())
        for name, body in CREATE.findall(sql):
            enums[name.lower()] = LITERAL.findall(body)
        for name, value in ALTER.findall(sql):
            key = name.lower()
            # An ALTER on a type this file has never seen is a real problem, not something to paper
            # over with an empty list - say so rather than inventing the type.
            if key not in enums:
                raise SystemExit(
                    "ERROR: %s alters enum '%s', which no migration creates" % (path.name, key)
                )
            if value not in enums[key]:
                enums[key].append(value)
    # A second pass, so a table declared before its enum still maps (migration order is not
    # declaration order within a file).
    for path in sorted(MIGRATIONS.glob("*.sql")):
        with open(path, encoding="utf-8") as fh:
            columns.update(enum_columns(strip_comments(fh.read()), enums))
    return {"types": dict(sorted(enums.items())), "columns": dict(sorted(columns.items()))}


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--check", action="store_true",
                    help="compare against the checked-in db/enums.json and exit 1 if it is stale")
    args = ap.parse_args(argv)

    fresh = build()
    if args.check:
        if not OUT.exists():
            print("ERROR: %s does not exist; run scripts/build_enums.py" % OUT, file=sys.stderr)
            return 1
        with open(OUT, encoding="utf-8") as fh:
            have = json.load(fh)
        if have != fresh:
            missing = {k: v for k, v in fresh["types"].items() if have.get("types", {}).get(k) != v}
            extra = [k for k in have.get("types", {}) if k not in fresh["types"]]
            print("ERROR: db/enums.json is stale.", file=sys.stderr)
            for k, v in missing.items():
                print("  %s: migrations say %s, file says %s" % (k, v, have.get(k)), file=sys.stderr)
            for k in extra:
                print("  %s: in the file, in no migration" % k, file=sys.stderr)
            return 1
        print("db/enums.json is current: %d types, %d enum columns"
              % (len(fresh["types"]), len(fresh["columns"])))
        return 0

    with open(OUT, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(fresh, fh, indent=1, ensure_ascii=False)
        fh.write("\n")
    print("wrote %s: %d types, %d values, %d enum columns"
          % (OUT, len(fresh["types"]), sum(len(v) for v in fresh["types"].values()),
             len(fresh["columns"])))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
