"""Migration 0016 — a race session's natural key stops depending on the time it starts.

WHY THE OLD KEY WAS NOT A KEY. 0012 keyed a race session on `(sport, series, start_at, title)`. That
holds while a schedule only gains races and breaks the moment one MOVES: a corrected or postponed
time is a different key, `ON CONFLICT` matches nothing, and the loader inserts a second copy of the
same race. Prompt 48 proved it on the runner - the moved-twin guard logged
`MOVED-TWIN SKIPPED 98 row(s)` and refused to load a single one. A guard that has to refuse the work
is a sign the key is wrong, not that the guard is clever.

`docs/research/nascar.md` §5 makes it permanent rather than one-off: rain moves races to Monday, and
"the watch task must catch the move". Under 0012's key every such move is a new race.

WHAT THESE PIN. Not that a load ran - that the KEY is the id, that a keyed row is exempt from the
guard, that a keyless one still is not, and that a pre-0016 row is ADOPTED rather than duplicated.
The adoption is the part with teeth: without it, an adapter that starts emitting an id would insert
a fresh copy of every row it already had, which is the same bug in a new costume.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import pipeline.load_programs as lp  # noqa: E402
from adapters.indycar import parse as parse_indycar  # noqa: E402
from adapters.nascar import build as build_nascar  # noqa: E402

MIGRATION = ROOT / "db" / "migrations" / "0016_programs_external_id.sql"


# --------------------------------------------------------------------------- the DDL
def test_0016_is_additive_and_keeps_the_older_indexes():
    sql = MIGRATION.read_text(encoding="utf-8")
    assert "add column if not exists external_id text" in sql
    assert "programs_race_session_external_uq" in sql
    assert "drop index" not in sql.lower(), "0012's and 0015's indexes are KEPT"
    assert "drop column" not in sql.lower()


def test_the_new_index_is_partial_and_null_safe():
    """`coalesce(series, '')` is 0015's lesson applied rather than relearned: NULLs are distinct in a
    unique index, and IndyCar runs one series and carries none."""
    sql = MIGRATION.read_text(encoding="utf-8")
    assert "(sport, (coalesce(series, '')), external_id)" in sql
    assert "where program_type = 'race_session' and external_id is not null" in sql


def test_the_loader_conflicts_on_the_new_key_and_repeats_its_predicate():
    """Prompt 47's finding: ON CONFLICT cannot infer a PARTIAL index unless the statement repeats
    the predicate. It is an expression index too, so the expression must be repeated as well."""
    assert lp.RACE_EXTERNAL_CONFLICT == "sport, (coalesce(series, '')), external_id"
    assert lp.RACE_EXTERNAL_PREDICATE == "program_type = 'race_session' and external_id is not null"
    src = (ROOT / "pipeline" / "load_programs.py").read_text(encoding="utf-8")
    assert "on conflict (%s) where %s" in src


def test_external_id_actually_reaches_the_database():
    """It was in adapters/nascar.py's `_provenance` since prompt 47 and never landed, because
    PROGRAM_COLS did not list it. That is the whole reason 0016 was needed."""
    assert "external_id" in lp.PROGRAM_COLS


# --------------------------------------------------------------------------- the guard, relaxed
class FakeDB:
    """Just enough of pipeline.db.DB to exercise the guard's decisions."""

    def __init__(self, rows=()):
        self.conn = object()
        self.rows = list(rows)
        self.ran = []

    def fetch(self, sql, params=None):
        return self.rows

    def run(self, sql, params=None, tag=None):
        self.ran.append((sql, params, tag))


def test_a_keyed_race_is_exempt_from_the_moved_twin_guard():
    """A changed time on a keyed race is an UPDATE. Keeping the guard on those rows would refuse the
    very correction 0016 exists to make safe."""
    db = FakeDB([(1, "2026-09-06T17:00:00Z")])
    row = {"sport": "nascar", "series": "cup", "title": "X", "start_at": "2026-09-06T21:00:00Z",
           "external_id": "5624"}
    assert lp.moved_twin(db, row, "race_session") is None


def test_a_keyless_race_still_trips_the_guard():
    """Nothing about 0016 relaxes the old behaviour for rows with no id - they still have no key
    that survives a move, so a moved one is still refused and reported."""
    db = FakeDB([(1, "2026-09-06T17:00:00Z")])
    row = {"sport": "nascar", "series": "cup", "title": "X", "start_at": "2026-09-06T21:00:00Z"}
    assert lp.moved_twin(db, row, "race_session") is not None


def test_the_guard_is_still_inert_offline():
    class NoConn:
        conn = None
    assert lp.moved_twin(NoConn(), {"start_at": "x", "title": "y"}, "race_session") is None


# --------------------------------------------------------------------------- adoption
def test_adoption_matches_on_start_at_too_so_it_cannot_adopt_ambiguously():
    """The two Daytona Duels share a title, a series and a day. Adopting on title alone would stamp
    one id onto both and violate the new unique index; including start_at makes it exact."""
    assert "and start_at = %s and external_id is null" in lp.ADOPT_SQL
    assert "and start_at = %s and external_id is null" in lp.ADOPT_COUNT_SQL
    assert "coalesce(series, '') = coalesce(%s, '')" in lp.ADOPT_SQL


def test_adoption_only_fires_on_exactly_one_match():
    src = (ROOT / "pipeline" / "load_programs.py").read_text(encoding="utf-8")
    body = src.split("keyed = ptype ==")[1].split("twin = moved_twin")[0]
    assert "if n == 1:" in body, "exactly one, or nothing is stamped"
    assert "elif n > 1:" in body, "and an ambiguous match is reported"


def test_a_keyed_row_reports_a_move_rather_than_making_one_silently():
    src = (ROOT / "pipeline" / "load_programs.py").read_text(encoding="utf-8")
    assert "KEYED_MOVE_SQL" in src
    assert "start_at <> %s" in lp.KEYED_MOVE_SQL
    assert 'print("moved:' in src


# --------------------------------------------------------------------------- the adapters supply it
def test_every_nascar_race_carries_the_feeds_race_id():
    with open(ROOT / "tests" / "fixtures" / "nascar_2026_cup.json", encoding="utf-8") as fh:
        races = json.load(fh)
    rows = build_nascar(races, "cup")
    assert rows
    assert all(r["external_id"] for r in rows)
    assert len({r["external_id"] for r in rows}) == len(rows), "one id per race"
    southern = next(r for r in rows if "Southern 500" in r["title"])
    assert southern["external_id"] == "5624"
    assert southern["start_at"] == "2026-09-06T21:00:00.000Z", "5:00 PM ET, corrected"


def test_every_indycar_race_carries_its_schedule_slug():
    """indycar.com has no numeric race id, but the schedule SLUG is stable, survives a time change
    and is already what source_url is built from."""
    page = (ROOT / "tests" / "fixtures" / "indycar_2026_schedule.html").read_text(encoding="utf-8")
    rows = parse_indycar(page, 2026)
    assert len(rows) == 18
    assert all(r["external_id"] for r in rows)
    assert len({r["external_id"] for r in rows}) == 18
    assert {"Laguna-Seca", "Milwaukee-Race1", "Milwaukee-Race2"} <= {r["external_id"] for r in rows}


def test_indycar_still_writes_no_series_so_the_coalesce_is_load_bearing():
    """This is why the new index uses coalesce(series, '') and not series: every IndyCar row would
    otherwise be invisible to its own key."""
    page = (ROOT / "tests" / "fixtures" / "indycar_2026_schedule.html").read_text(encoding="utf-8")
    assert all(r["series"] is None for r in parse_indycar(page, 2026))


# --------------------------------------------------------------------------- end to end, offline
@pytest.fixture
def emitted(tmp_path):
    """Run the loader offline over a keyed race and a moved one, and read the statements."""
    from pipeline.db import DB

    rows = [
        {"sport": "nascar", "program_type": "race_session", "series": "cup", "title": "Race A",
         "start_at": "2026-09-06T21:00:00Z", "external_id": "5624", "expected_duration_min": 210,
         "broadcasts": [{"service_id": "USA", "label": "USA", "delivery_surface": "LINEAR"}]},
        {"sport": "nascar", "program_type": "race_session", "series": "cup", "title": "Race B",
         "start_at": "2026-10-01T20:00:00Z", "expected_duration_min": 210, "broadcasts": []},
    ]
    out = tmp_path / "x.sql"
    db = DB(str(out))
    lp.load(db, rows, None)
    db.commit()
    return out.read_text(encoding="utf-8")


def test_a_keyed_race_upserts_on_the_id_and_a_keyless_one_on_the_old_key(emitted):
    assert "on conflict (sport, (coalesce(series, '')), external_id) where program_type = " \
           "'race_session' and external_id is not null" in emitted
    assert "on conflict (sport, (coalesce(series, '')), start_at, title) where program_type = " \
           "'race_session'" in emitted


def test_the_keyed_insert_actually_carries_the_id(emitted):
    assert "'5624'" in emitted
