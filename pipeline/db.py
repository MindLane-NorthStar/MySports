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
class DB:
    """Executes statements against SUPABASE_DB_URL, or collects them into an SQL file when emit_path is set."""

    def __init__(self, emit_path: str | None = None):
        self.emit_path = Path(emit_path) if emit_path else None
        self.emitted: list[str] = []
        self.conn = None
        self.stats: dict[str, int] = {}
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
               tag: str | None = None) -> int:
        """INSERT ... ON CONFLICT (conflict) DO UPDATE SET update-cols (or DO NOTHING when update is empty)."""
        n = 0
        for r in rows:
            cols = list(r.keys())
            placeholders = ", ".join("%s" for _ in cols)
            if update:
                action = "do update set " + ", ".join(f"{c} = excluded.{c}" for c in update if c in cols)
            else:
                action = "do nothing"
            sql = f"insert into {table} ({', '.join(cols)}) values ({placeholders}) on conflict ({conflict}) {action}"
            self.run(sql, tuple(r[c] for c in cols), tag=tag or table)
            n += 1
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
