"""Migration 0012: game_broadcasts.game_id is nullable, and every consumer knows it.

WHY THIS FILE EXISTS. Dropping a NOT NULL is the one non-additive thing this run does, and its risk
is not the DDL - it is the four queries that were written when `game_id` could not be null. Three of
them are game-scoped and exclude program rows for free. The fourth, the reconciler's --all branch,
passed an EMPTY where clause: after 0012 it would have pulled every program's broadcast row back
with a null game_id and grouped them under a game that does not exist.

These assertions read the source rather than the database, for the same reason nav.test.mjs does:
what decides the answer is textual, and a test that needs a live connection would not run in the
gate.
"""

from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]


def src(rel):
    with open(ROOT / rel, encoding="utf-8") as fh:
        return fh.read()


def code(rel):
    """Source with LINE comments stripped only.

    Not docstrings: every SQL statement in pipeline/ lives in a triple-quoted string, so stripping
    those would delete the very queries these tests are about. The first draft did exactly that and
    the render-feed assertion failed against an empty haystack.
    """
    import re
    return re.sub(r"^\s*#.*$", "", src(rel), flags=re.M)


# --------------------------------------------------------------------------- the migration itself
def test_0012_makes_the_subject_exclusive():
    sql = src("db/migrations/0012_programs_own_broadcasts.sql").lower()
    assert "add column if not exists program_id" in sql
    assert "alter column game_id drop not null" in sql
    # NOT "at least one" - a row naming both would be read as a game row by every game-scoped query.
    assert "num_nonnulls(game_id, program_id) = 1" in sql


def test_0012_gives_program_rows_their_own_unique_index():
    """The existing unique (game_id, service_id, delivery_surface, feed_side) cannot serve them:
    NULLs are distinct in a unique constraint, so with game_id null every re-load duplicates."""
    sql = src("db/migrations/0012_programs_own_broadcasts.sql").lower()
    assert "game_broadcasts_program_uq" in sql
    assert "where program_id is not null" in sql


def test_0012_gives_a_race_session_a_natural_key():
    sql = src("db/migrations/0012_programs_own_broadcasts.sql").lower()
    assert "programs_race_session_uq" in sql
    assert "where program_type = 'race_session'" in sql


# --------------------------------------------------------------------------- the consumers
def test_the_reconcilers_all_branch_excludes_program_rows():
    """THE ONE THAT WOULD HAVE BROKEN. --all passed bw = "" before 0012."""
    text = code("pipeline/reconcile.py")
    assert 'bw = "where b.game_id is not null"' in text, (
        "the --all broadcast query must exclude rows whose subject is a program"
    )
    assert 'bw = ""' not in text, "an empty broadcast where-clause is now a bug, not a default"


def test_0014s_program_branch_is_program_scoped_in_its_own_sql():
    """The mirror of the test above, for the query 0014 added.

    The program branch may pass an empty where-clause, because PBC_SQL is scoped in its own text -
    and that is exactly what has to be pinned, or a later edit could widen it to every broadcast row
    in the table and hand a game's telecast to a race.
    """
    text = code("pipeline/reconcile.py")
    assert "PBC_SQL" in text
    body = text.split("PBC_SQL = ", 1)[1].split('"""', 2)[1]
    assert "where b.program_id is not null" in body
    assert "join networks_services" in body


@pytest.mark.parametrize("needle", [
    "where b.game_id = any(%s)",                       # the --game branch
    "where b.game_id in (select g.id from games g ",   # the changed-evidence branch
])
def test_the_other_reconciler_branches_were_already_game_scoped(needle):
    assert needle in code("pipeline/reconcile.py")


def test_the_render_feed_is_game_scoped():
    assert "where b.active and b.game_id = any(%s)" in code("pipeline/render_feed.py")


def test_the_loaders_upsert_key_is_unchanged_for_games():
    """pipeline/load.py still conflicts on the game-side key. Program broadcasts are loaded by the
    program loaders against 0012's partial index, never through this path."""
    assert "game_id, service_id, delivery_surface, feed_side" in code("pipeline/load.py")


def test_0013_adds_no_enum_values():
    """0009 already carries every sport and every program_type this run needs. An ALTER TYPE here
    would have been a no-op at best and a transaction hazard at worst."""
    sql = src("db/migrations/0013_program_fields_and_studio_shows.sql").lower()
    assert "alter type" not in sql


def test_0013_extends_the_studio_tables_rather_than_creating_them():
    """0009 already built both, with its own column names. A `create table if not exists` against an
    existing table is a SILENT no-op - it would have looked like it worked and left the registry
    without one new column."""
    sql = src("db/migrations/0013_program_fields_and_studio_shows.sql").lower()
    assert "create table if not exists studio_shows" not in sql
    assert "alter table studio_shows add column if not exists anchor_rule" in sql
    assert "alter table studio_shows add column if not exists slot_start_et" in sql
