"""pipeline/load_programs.py — the program loader, offline.

Every test here runs through --emit-sql, so `DB(emit_path)` never opens a connection and the whole
path is exercised against a file. That is the same honest dry-run shape prompt 46 found for the
reconciler (`--export` then `--input`), and it is why these run in the gate.
"""

import json
import subprocess
import sys
from pathlib import Path

import pytest

from pipeline.load_programs import CONFLICT, PRESERVE, normalise_network

ROOT = Path(__file__).resolve().parents[1]


# --------------------------------------------------------------------------- the network mapping
def test_the_feeds_own_spelling_maps_to_the_network_table():
    known = {"fox", "fs1", "fs2", "nbc", "tnt", "prime-video", "usa-network", "the-cw"}
    for raw, want in (("FOX", "fox"), ("FS1", "fs1"), ("FS2", "fs2"), ("NBC", "nbc"),
                      ("TNT", "tnt"), ("PRIME VIDEO", "prime-video"), ("USA", "usa-network"),
                      ("CW", "the-cw")):
        sid, certainty, warn = normalise_network(raw, known)
        assert (sid, certainty, warn) == (want, "CONFIRMED", []), raw


def test_an_unknown_network_is_TBA_and_warned_never_dropped():
    """Losing the fact that a race is televised is worse than not knowing the channel."""
    sid, certainty, warn = normalise_network("Channel 4", {"fox"})
    assert sid is None
    assert certainty == "TBA_NO_RIGHTS_HOLDER"
    assert warn == ["Channel 4"], "the caller needs the raw value to report it"


def test_no_broadcaster_at_all_is_TBA_without_a_warning():
    sid, certainty, warn = normalise_network(None, {"fox"})
    assert (sid, certainty, warn) == (None, "TBA_NO_RIGHTS_HOLDER", [])


def test_offline_cannot_validate_and_says_so_by_not_warning():
    """`known is None` is the --emit-sql path. Reporting 40 unknown networks because there was no
    database to ask would make a dry run look like a data problem; the first draft did exactly that."""
    sid, certainty, warn = normalise_network("FS1", None)
    assert (sid, certainty, warn) == ("fs1", "CONFIRMED", [])


# --------------------------------------------------------------------------- the conflict targets
def test_every_program_type_has_a_natural_key_matching_the_migrations():
    """These must mirror the partial unique indexes in 0012 and 0013, or a re-run duplicates."""
    assert CONFLICT["race_session"] == "sport, series, start_at, title"
    m12 = (ROOT / "db/migrations/0012_programs_own_broadcasts.sql").read_text(encoding="utf-8")
    assert "(sport, series, start_at, title)" in m12
    m13 = (ROOT / "db/migrations/0013_program_fields_and_studio_shows.sql").read_text(encoding="utf-8")
    for ptype in ("weekly_show", "studio_show", "fight_card", "special_event"):
        assert ptype in CONFLICT
        cols = "(%s)" % CONFLICT[ptype]
        assert cols in m13, "%s: %s is not an index in 0013" % (ptype, cols)


def test_a_program_type_with_no_key_is_skipped_loudly_not_inserted(tmp_path, capsys):
    from pipeline.db import DB
    from pipeline.load_programs import load
    out = tmp_path / "x.sql"
    db = DB(str(out))
    counts = load(db, [{"sport": "nascar", "program_type": "made_up", "title": "x",
                        "start_at": "2026-01-01T00:00:00Z"}], None)
    db.commit()
    assert counts["skipped"] == 1 and counts["programs"] == 0
    assert "no natural key" in capsys.readouterr().err


def test_null_never_erases_what_a_previous_run_established():
    """The same rule pipeline/db.py's `preserve` documents for teams: a loader that could not reach
    its source must not blank a column that a better run filled."""
    for col in ("subtitle", "location_text", "headliners", "hosts_crew", "segments", "source_url"):
        assert col in PRESERVE


# --------------------------------------------------------------------------- end to end, offline
@pytest.fixture(scope="module")
def emitted(tmp_path_factory):
    d = tmp_path_factory.mktemp("nascar")
    programs = d / "cup.json"
    sql = d / "cup.sql"
    subprocess.run(
        [sys.executable, "-m", "adapters.nascar", "--fixture",
         str(ROOT / "tests/fixtures/nascar_2026_cup.json"), "--series", "cup", "--out", str(programs)],
        cwd=str(ROOT), check=True, capture_output=True,
    )
    r = subprocess.run(
        [sys.executable, "-m", "pipeline.load_programs", "--input", str(programs),
         "--emit-sql", str(sql)],
        cwd=str(ROOT), check=True, capture_output=True, text=True,
    )
    return json.loads(programs.read_text(encoding="utf-8")), sql.read_text(encoding="utf-8"), r.stdout


def test_the_whole_cup_season_loads_with_one_broadcast_each(emitted):
    rows, sql, stdout = emitted
    assert len(rows) == 40
    assert sql.count("insert into programs") == 40
    assert sql.count("insert into game_broadcasts") == 40
    assert "unknown networks 0" in stdout


def test_broadcasts_are_per_race_not_a_per_series_constant(emitted):
    """The 2026 Cup season is on seven different outlets. A per-series constant would be wrong for
    most of the calendar - which is exactly the trap research-summary-2 1.3 names."""
    rows, _, _ = emitted
    outlets = {b["service_id"] for r in rows for b in r["broadcasts"]}
    assert len(outlets) >= 5, outlets


def test_every_row_is_a_program_with_no_game(emitted):
    rows, sql, _ = emitted
    for r in rows:
        assert "game_id" not in r
        assert r["program_type"] == "race_session"
        assert r["brand_key"] == "nascar"
        assert r["source_url"].startswith("https://cf.nascar.com/")
    assert "program_id" in sql and "game_id" not in sql.split("insert into game_broadcasts")[1][:400]


def test_the_broadcast_insert_targets_0012s_partial_index(emitted):
    _, sql, _ = emitted
    assert "on conflict (program_id, service_id, delivery_surface, feed_side)" in sql
    assert "where program_id is not null do update set" in sql
