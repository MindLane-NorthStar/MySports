#!/usr/bin/env python3
"""Database layer for the MySports pipeline: one connection, batched upserts, an SQL-emitting dry-run mode.

Windows-portable; every open() passes encoding=; the DSN is never printed.
"""
from __future__ import annotations

import json
import os
import re
import sys
import unicodedata
from datetime import date, datetime
from pathlib import Path
from typing import Any, Iterable

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from adapters.common import find_repo_root, load_dotenv  # noqa: E402

ROOT = find_repo_root()
load_dotenv(ROOT / ".env")


# ----------------------------------------------------------------------------- helpers
def slug(s: str) -> str:
    """'ESPN+' -> 'espn-plus', 'The CW' -> 'the-cw', 'SEC Network+' -> 'sec-network-plus' (matches the renderer's NET_SLUG)."""
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode()
    s = s.replace("+", "-plus").replace("&", "-and-")
    s = re.sub(r"[^A-Za-z0-9]+", "-", s).strip("-").lower()
    return re.sub(r"-{2,}", "-", s)


def qlit(v: Any) -> str:
    """SQL literal for the --emit-sql path (values are our own adapter output, but quote defensively)."""
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return repr(v)
    if isinstance(v, (datetime, date)):
        return "'" + v.isoformat() + "'"
    if isinstance(v, (list, tuple)):
        return "array[" + ", ".join(qlit(x) for x in v) + "]" if v else "'{}'"
    if isinstance(v, dict):
        return "'" + json.dumps(v, ensure_ascii=False).replace("'", "''") + "'::jsonb"
    return "'" + str(v).replace("'", "''") + "'"


# ----------------------------------------------------------------------------- connection
# ----------------------------------------------------------------------------- enum hardening
# db/enums.json is generated from db/migrations/*.sql by scripts/build_enums.py and checked by
# tests/test_enums.py, so this validation cannot drift from the schema it is defending.
_ENUMS_PATH = Path(__file__).resolve().parents[1] / "db" / "enums.json"
try:
    with open(_ENUMS_PATH, encoding="utf-8") as _fh:
        _ENUMS = json.load(_fh)
except (OSError, ValueError):        # never let a missing map stop a load - it only stops the CHECK
    _ENUMS = {"types": {}, "columns": {}}

# `{"table.column": frozenset(values)}`, resolved once.
ENUM_COLUMNS: dict[str, frozenset[str]] = {
    key: frozenset(_ENUMS["types"].get(typ, ()))
    for key, typ in _ENUMS.get("columns", {}).items()
}
ENUM_TYPE_OF: dict[str, str] = dict(_ENUMS.get("columns", {}))

# The column a quarantine warning should name the row by, per table. Falls back to whatever id-ish
# column the row carries, so a table added later still logs something a human can find.
_NATURAL_KEYS = {
    "games": ("id",),
    "game_broadcasts": ("game_id", "service_id"),
    "programs": ("id",),
    "teams": ("id",),
    "observations": ("game_id", "field_name"),
    "viewer_game_eligibility": ("game_id", "viewer_profile_id"),
}


def enum_violations(table: str, row: dict[str, Any]) -> list[tuple[str, str, Any]]:
    """Every `(column, enum_type, value)` in `row` that the schema's enum cannot hold.

    NULL is not a violation - a nullable enum column takes it, and "I did not find out" is a real
    answer this pipeline depends on (see `preserve` above). A column this map does not know is not a
    violation either: the map covers what the migrations declare, and inventing a rule for anything
    else would quarantine good rows.
    """
    out: list[tuple[str, str, Any]] = []
    for col, value in row.items():
        if value is None:
            continue
        allowed = ENUM_COLUMNS.get("%s.%s" % (table, col))
        if allowed is None:
            continue
        if value not in allowed:
            out.append((col, ENUM_TYPE_OF["%s.%s" % (table, col)], value))
    return out


def _natural_key(table: str, row: dict[str, Any]) -> str:
    cols = _NATURAL_KEYS.get(table)
    if not cols:
        cols = tuple(c for c in ("id", "game_id", "program_id", "key") if c in row) or tuple(row)[:1]
    return " ".join("%s=%r" % (c, row.get(c)) for c in cols if c in row) or "<no key>"


class DB:
    """Executes statements against SUPABASE_DB_URL, or collects them into an SQL file when emit_path is set."""

    def __init__(self, emit_path: str | None = None):
        self.emit_path = Path(emit_path) if emit_path else None
        self.emitted: list[str] = []
        self.conn = None
        self.stats: dict[str, int] = {}
        self.quarantined: dict[str, int] = {}
        if self.emit_path is None:
            dsn = os.getenv("SUPABASE_DB_URL")
            if not dsn:
                print("ERROR: SUPABASE_DB_URL missing from environment or .env (deployment contract section 4)", file=sys.stderr)
                sys.exit(2)
            try:
                import psycopg
            except ImportError:
                print("ERROR: psycopg not installed (pip install \"psycopg[binary]\")", file=sys.stderr)
                sys.exit(2)
            self.conn = psycopg.connect(dsn, autocommit=False, application_name="mysports-pipeline")
            with self.conn.cursor() as cur:
                cur.execute("set search_path = mysports")
            # Commit the search_path immediately, because SET IS TRANSACTIONAL: a later rollback()
            # undoes it and every unqualified table name in the session stops resolving - the error
            # then reads "relation \"programs\" does not exist", which looks like a missing migration
            # rather than a lost setting. That is the failure mode that would silently disarm the
            # rollback-then-mark-failed path in load.py's error handler, so the setting is made
            # durable here once instead of being re-applied at each call site.
            self.conn.commit()

    # -- core
    def run(self, sql: str, params: tuple | None = None, tag: str | None = None) -> None:
        if tag:
            self.stats[tag] = self.stats.get(tag, 0) + 1
        if self.conn is None:
            self.emitted.append(sql if params is None else _inline(sql, params))
            return
        with self.conn.cursor() as cur:
            cur.execute(sql, None if params is None else tuple(_pg(v) for v in params))

    def upsert(self, table: str, rows: Iterable[dict[str, Any]], conflict: str, update: list[str] | None = None,
               tag: str | None = None, preserve: Iterable[str] | None = None) -> int:
        """INSERT ... ON CONFLICT (conflict) DO UPDATE SET update-cols (or DO NOTHING when update is empty).

        `preserve` names columns where **NULL MEANS "I DID NOT FIND OUT", NOT "THE VALUE IS GONE"**.
        Those are written as `coalesce(excluded.c, table.c)`, so a loader that could not reach its
        provider cannot erase what a previous successful run established. A real change still lands -
        only a null is refused, and a null is never the fact.

        This exists because a loader silently deleted 94 rows' worth of reference data. `teams` gets
        its conference from each sport's teams file; `adapters/nhl.py` fetches that from a SEPARATE
        call to the one that produces the teams, guarded by a `_safe` that swallows the error and
        returns None. The file was then written with `conference: null` on all 32 clubs, and the next
        bootstrap wrote those nulls straight over the division links - which is exactly what happened
        on 2026-09-01 and is why migration 0011 had to seed them a second time.

        **OPT-IN PER CALL SITE, deliberately.** `pipeline/standings.py` upserts columns where null is
        a real, meaningful answer - the NHL publishes no games_back, MLB no points - and coalescing
        those would freeze a stale number in place the day a league stopped publishing one. The two
        cases look identical in SQL and are opposites in meaning, so the caller has to say which it is.
        """
        preserve = set(preserve or ())
        n = 0
        for r in rows:
            bad = enum_violations(table, r)
            if bad:
                # QUARANTINE THE ROW, NOT THE RUN. One mistyped enum once aborted a whole daily
                # refresh: carriageCertainty="UNVERIFIED" went into an access_status slot, Postgres
                # rejected the statement, and every good row in the batch died with it. A value the
                # schema cannot hold is one row's problem; the other 1,383 are fine and the reader
                # needs them tonight. Same fail-honest-per-unit shape the standings step uses.
                key = _natural_key(table, r)
                for col, typ, value in bad:
                    print("WARN quarantine %s.%s = %r (not a %s) on %s"
                          % (table, col, value, typ, key), file=sys.stderr)
                self.quarantined[table] = self.quarantined.get(table, 0) + 1
                continue
            cols = list(r.keys())
            placeholders = ", ".join("%s" for _ in cols)
            if update:
                action = "do update set " + ", ".join(
                    (f"{c} = coalesce(excluded.{c}, {table}.{c})" if c in preserve else f"{c} = excluded.{c}")
                    for c in update if c in cols)
            else:
                action = "do nothing"
            sql = f"insert into {table} ({', '.join(cols)}) values ({placeholders}) on conflict ({conflict}) {action}"
            self.run(sql, tuple(r[c] for c in cols), tag=tag or table)
            n += 1
        q = self.quarantined.get(table, 0)
        if q:
            # A WARNING, never a failure. The run continues and the step reports what it dropped.
            print("WARN %s: %d row(s) quarantined on an invalid enum value" % (table, q),
                  file=sys.stderr)
        return n

    def fetch(self, sql: str, params: tuple | None = None) -> list[tuple]:
        if self.conn is None:
            return []
        with self.conn.cursor() as cur:
            cur.execute(sql, params)
            return cur.fetchall()

    def commit(self) -> None:
        if self.conn is not None:
            self.conn.commit()
        elif self.emit_path is not None:
            self.emit_path.parent.mkdir(parents=True, exist_ok=True)
            body = "\n".join(s.rstrip(";") + ";" for s in self.emitted)
            self.emit_path.write_text("set search_path = mysports;\n" + body + "\n", encoding="utf-8")

    def close(self) -> None:
        if self.conn is not None:
            self.conn.close()


def _pg(v: Any) -> Any:
    """psycopg parameter adaptation: dicts -> jsonb via Json wrapper; everything else native."""
    if isinstance(v, dict):
        from psycopg.types.json import Jsonb
        return Jsonb(v)
    return v


def _inline(sql: str, params: tuple) -> str:
    """Replace %s placeholders with literals for the emitted-SQL path."""
    out, i = [], 0
    for part in re.split(r"(%s)", sql):
        if part == "%s":
            out.append(qlit(params[i])); i += 1
        else:
            out.append(part)
    return "".join(out)
