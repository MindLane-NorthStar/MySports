"""Loader enum hardening: db/enums.json, and the quarantine that keeps one bad row from killing a run.

THE FAILURE THIS DEFENDS AGAINST. An adapter once wrote `carriageCertainty="UNVERIFIED"` into an
`access_status` slot. Postgres rejected the statement, and because the whole batch went in one
transaction the entire daily refresh died with it - including every good row beside it. The specific
bug was fixed at `64c9764`; the class was not. A value the schema cannot hold is ONE row's problem.

Everything here runs offline. `DB(emit_path)` never opens a connection, so the upsert path can be
exercised end to end against a file.
"""

import json
import subprocess
import sys
from pathlib import Path

import pytest

from pipeline.db import DB, ENUM_COLUMNS, enum_violations

ROOT = Path(__file__).resolve().parents[1]


# --------------------------------------------------------------------------- the generated file
def test_the_checked_in_enums_match_a_fresh_generation():
    """If a migration adds a type or a value and nobody regenerates, this is the red gate."""
    r = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "build_enums.py"), "--check"],
        capture_output=True, text=True, cwd=str(ROOT),
    )
    assert r.returncode == 0, r.stdout + r.stderr


def test_enums_json_carries_types_and_the_column_map():
    with open(ROOT / "db" / "enums.json", encoding="utf-8") as fh:
        d = json.load(fh)
    assert set(d) == {"types", "columns"}
    assert d["types"]["access_status"] == [
        "available", "unavailable", "verify", "conditional", "out_of_market", "unverified", "unknown",
    ]
    # the column map is what tells the validator WHICH column is which type
    assert d["columns"]["game_broadcasts.access_status"] == "access_status"
    assert d["columns"]["games.sport"] == "sport"


def test_a_value_added_by_a_later_ALTER_TYPE_is_present():
    """`sport` is created in 0002 and gains nascar/ufc/wwe by ALTER in 0009. Reading only the CREATE
    would reject every program this pipeline is about to load."""
    with open(ROOT / "db" / "enums.json", encoding="utf-8") as fh:
        types = json.load(fh)["types"]
    for value in ("cfb", "nascar", "ufc", "wwe"):
        assert value in types["sport"], value


# --------------------------------------------------------------------------- the validator
def test_a_good_row_has_no_violations():
    assert enum_violations("game_broadcasts", {
        "game_id": "g1", "access_status": "available", "carriage_certainty": "CONFIRMED",
        "delivery_surface": "LINEAR",
    }) == []


def test_the_original_bug_is_caught():
    bad = enum_violations("game_broadcasts", {"game_id": "g1", "access_status": "UNVERIFIED"})
    assert bad == [("access_status", "access_status", "UNVERIFIED")]


def test_null_is_not_a_violation():
    """A nullable enum column takes NULL, and "I did not find out" is an answer this pipeline
    depends on - see DB.upsert's `preserve`."""
    assert enum_violations("game_broadcasts", {"game_id": "g1", "access_status": None}) == []


def test_a_column_the_map_does_not_know_is_not_a_violation():
    assert enum_violations("game_broadcasts", {"game_id": "g1", "not_a_real_column": "zzz"}) == []


def test_a_value_added_by_ALTER_TYPE_is_accepted():
    assert enum_violations("games", {"id": "x", "sport": "nascar"}) == []


# --------------------------------------------------------------------------- the quarantine
def emit(tmp_path, rows):
    out = tmp_path / "emitted.sql"
    db = DB(str(out))
    n = db.upsert("game_broadcasts", rows, "game_id, service_id",
                  ["access_status", "carriage_certainty"])
    db.commit()
    return n, out.read_text(encoding="utf-8"), db


def row(service_id, access="available", certainty="CONFIRMED"):
    return {"game_id": "g1", "service_id": service_id,
            "access_status": access, "carriage_certainty": certainty}


def test_one_bad_row_is_quarantined_and_the_rest_load(tmp_path, capsys):
    rows = [row("espn"), row("fox", certainty="UNVERIFIED"), row("nbc")]
    n, sql, db = emit(tmp_path, rows)
    assert n == 2, "the two good rows still loaded"
    assert db.quarantined["game_broadcasts"] == 1
    assert "'espn'" in sql and "'nbc'" in sql
    assert "'fox'" not in sql, "the bad row must not reach the statement"
    err = capsys.readouterr().err
    assert "quarantine" in err
    assert "carriage_certainty" in err and "UNVERIFIED" in err
    assert "service_id='fox'" in err, "the warning names the row's natural key"


def test_a_clean_payload_quarantines_nothing(tmp_path, capsys):
    n, sql, db = emit(tmp_path, [row("espn"), row("nbc")])
    assert n == 2
    assert db.quarantined == {}
    assert "quarantine" not in capsys.readouterr().err


def test_a_quarantine_is_a_warning_not_a_failure(tmp_path):
    """The run continues. Nothing raises, and the return value is the count that DID load."""
    n, _, db = emit(tmp_path, [row("fox", access="nonsense")])
    assert n == 0
    assert db.quarantined["game_broadcasts"] == 1


@pytest.mark.parametrize("value", ["CONFIRMED", "AFFILIATE_DISCRETION", "UNANNOUNCED",
                                   "TBA_NO_RIGHTS_HOLDER"])
def test_every_real_carriage_certainty_survives(tmp_path, value):
    n, _, db = emit(tmp_path, [row("espn", certainty=value)])
    assert n == 1 and db.quarantined == {}


def test_the_map_is_not_empty():
    """A silently empty map would validate nothing and pass every test above."""
    assert len(ENUM_COLUMNS) >= 30
    assert ENUM_COLUMNS["game_broadcasts.access_status"]
