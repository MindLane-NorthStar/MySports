"""Migration 0019's SQL and `pipeline/load.py`'s `boxscore_url()` must build the SAME link.

Prompt 78 ruled that the per-sport URL mapping has ONE owner, in Python, because a rule kept in two
languages drifts. Migration 0019 has to restate it in SQL to backfill the rows the nightly never
fetched - so this is the guard that makes the second copy safe: it EXECUTES the expression between
the migration file's `-- EXPR-BEGIN` / `-- EXPR-END` markers (the file's own text, never a copy) and
compares it with `boxscore_url()` for every sport and every id shape, including the asymmetry at
`load.py:80` - cfb passes the whole id, every other sport the text after the FIRST hyphen.

THE ENGINE IS SQLITE, AND THE ONE DIFFERENCE IS SHIMMED OUT LOUD. There is no Postgres here (and no
direct connection from a session - working rule 14). The expression uses `CASE`, `||`, `substr` with
a positive start and `strpos`; the first three mean the same in both engines, and `strpos` is not
a SQLite function, so it is registered below with Postgres's contract: 1-based position of the first
match, 0 when there is none.
"""
from __future__ import annotations

import re
import sqlite3
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from pipeline.load import _BOXSCORE, boxscore_url  # noqa: E402

MIGRATION = ROOT / "db" / "migrations" / "0019_backfill_game_urls.sql"


def expression() -> str:
    text = MIGRATION.read_text(encoding="utf-8")
    m = re.search(r"^-- EXPR-BEGIN\n(.*?)^-- EXPR-END$", text, re.S | re.M)
    assert m, "the EXPR markers are gone - the test would otherwise have nothing to execute"
    return m.group(1).strip()


def pg_strpos(s, sub):
    """Postgres `strpos(string, substring)`: 1-based index of the first match, 0 if absent."""
    if s is None or sub is None:
        return None
    return s.find(sub) + 1


@pytest.fixture(scope="module")
def run():
    conn = sqlite3.connect(":memory:")
    conn.create_function("strpos", 2, pg_strpos, deterministic=True)
    expr = expression()

    def evaluate(sport, game_id):
        return conn.execute(f"select {expr} from (select ? as sport, ? as id)", (sport, game_id)).fetchone()[0]
    yield evaluate
    conn.close()


CASES = [
    ("cfb", "401628319"),         # cfb ids are bare ESPN ids
    ("cfb", "cfb-401628319"),     # THE ASYMMETRY: cfb keeps the whole id, hyphen and all
    ("nfl", "nfl-401772510"),
    ("nba", "nba-401810245"),
    ("nhl", "nhl-2026020123"),
    ("mlb", "mlb-778123"),
    ("mlb", "mlb-778123-2"),      # only the FIRST hyphen is a prefix - split_part would drop "-2"
    ("nfl", "401772510"),         # no hyphen at all: split("-", 1)[-1] is the whole id
]


@pytest.mark.parametrize("sport,game_id", CASES)
def test_the_migration_builds_exactly_what_boxscore_url_builds(run, sport, game_id):
    want = boxscore_url(sport, game_id)
    assert want is not None
    assert run(sport, game_id) == want


def test_a_sport_with_no_template_gets_no_link_in_either(run):
    assert boxscore_url("wnba", "wnba-1") is None
    assert run("wnba", "wnba-1") is None, "the update's `url is not null` guard relies on this"


def test_the_expression_covers_every_sport_the_loader_does_and_no_other():
    whens = set(re.findall(r"when '([a-z]+)' then", expression()))
    assert whens == set(_BOXSCORE)


def test_the_update_touches_only_rows_without_a_link():
    text = MIGRATION.read_text(encoding="utf-8")
    assert "where boxscore_url is null" in text, "the candidate rows are the unlinked ones"
    assert "and g.boxscore_url is null" in text, "and the write itself re-checks - never an overwrite"
    assert "and u.url is not null" in text


def test_the_strpos_shim_keeps_postgres_semantics():
    """The shim is the only thing standing between SQLite and Postgres here, so it is pinned too."""
    assert pg_strpos("mlb-778123-2", "-") == 4
    assert pg_strpos("401628319", "-") == 0
    assert pg_strpos(None, "-") is None
