"""The reason / network_status ladder (pipeline.reconcile.telecast_verdict).

WHY THIS FILE EXISTS. The two strings are one conclusion said twice - `reason` is what the card
explains, `network_status` is what the badge reads - and they were written thirty lines apart in
reconcile_game(). They have disagreed twice:

  * prompt 24 fixed `reason` for bare non-CFB games (78 rows: nfl 24 + nhl 38 + nba 16);
  * its twin on `network_status` was left, so those same games kept `no_linear_telecast` and a card
    read "No linear telecast" underneath a NETWORK TBD badge.

The function is pure - no database handle, no clock - so every rung is testable here. Every
rows-present case must keep producing the strings the database already holds; the database carries 94
distinct reason strings and this change is not allowed to rewrite any of them.
"""

import json
from pathlib import Path

import pytest

from pipeline.reconcile import telecast_verdict

ROOT = Path(__file__).resolve().parents[1]

with open(ROOT / "data" / "authority_rules.json", encoding="utf-8") as fh:
    RULES = json.load(fh)

PRO = ("nfl", "nhl", "nba", "mlb")


def bc(service_id="espn", access="available", surface="LINEAR", blackout=None,
       certainty="ANNOUNCED", active=True):
    return {
        "service_id": service_id,
        "access_status": access,
        "delivery_surface": surface,
        "blackout_rule": blackout,
        "carriage_certainty": certainty,
        "active": active,
    }


def verdict(sport, active, **kw):
    kw.setdefault("network_id", None)
    kw.setdefault("stream_exclusive", False)
    kw.setdefault("canonical_state", None)
    return telecast_verdict(sport, active, RULES, **kw)


# --------------------------------------------------------------------------- the bare list
def test_bare_cfb_is_tbd_and_says_so():
    reason, status, eligible, via_net, via_srv = verdict("cfb", [])
    assert reason == "no telecast observed"
    assert status == "tbd"
    assert eligible is False
    assert via_net is None and via_srv == []


@pytest.mark.parametrize("sport", PRO)
def test_bare_pro_game_is_tbd_TOO(sport):
    """The twin bug. `no_linear_telecast` is a conclusion drawn FROM rows; with none there is
    nothing to draw it from, and the reason has said exactly that since prompt 24."""
    reason, status, *_ = verdict(sport, [])
    assert reason == "no telecast observed"
    assert status == "tbd", f"{sport}: a bare game cannot conclude no_linear_telecast"


def test_the_pair_agrees_for_every_sport_when_bare():
    seen = {sport: verdict(sport, [])[:2] for sport in ("cfb",) + PRO}
    assert len(set(seen.values())) == 1, seen


# --------------------------------------------------------------------------- rows present
@pytest.mark.parametrize("sport", ("cfb",) + PRO)
def test_rows_present_but_no_resolved_network_keeps_its_old_answer(sport):
    """The regression guard. With rows present, nothing about this ladder changes: CFB stays tbd,
    every other sport still concludes no_linear_telecast."""
    _, status, *_ = verdict(sport, [bc(access="unavailable")])
    assert status == ("tbd" if sport == "cfb" else "no_linear_telecast")


def test_a_resolved_network_is_assigned():
    _, status, *_ = verdict("nfl", [bc()], network_id="nbc")
    assert status == "assigned"


def test_a_stream_exclusive_winner_says_so():
    _, status, *_ = verdict("nfl", [bc(service_id="peacock", surface="STREAMING")],
                            network_id="peacock", stream_exclusive=True)
    assert status == "stream_exclusive"


# --------------------------------------------------------------------------- the reason rungs
def test_linear_available():
    reason, _, eligible, via_net, _ = verdict("nfl", [bc(service_id="nbc")])
    assert eligible is True
    assert via_net == "nbc"
    assert reason == "linear nbc"


def test_stream_only():
    reason, _, eligible, via_net, via_srv = verdict("nfl", [bc(service_id="peacock", surface="STREAMING")])
    assert eligible is True
    assert via_net is None
    assert via_srv == ["peacock"]
    assert reason == "stream only: peacock"


def test_local_feed_carrier_tba():
    """Every eligible row unannounced - the rules file supplies the sentence, not this module."""
    reason, _, eligible, *_ = verdict("mlb", [bc(service_id="wkyc", certainty="UNANNOUNCED")])
    assert eligible is True
    assert reason == RULES["eligibility"]["local_tba_reason"]


def test_conditional_access_asks_the_viewer_to_verify():
    cond = RULES["eligibility"]["conditional_access"][0]
    reason, _, eligible, *_ = verdict("nba", [bc(service_id="nbatv", access=cond)])
    assert eligible is False
    assert reason == "verify access: nbatv"


def test_unavailable_names_what_it_saw():
    reason, _, eligible, *_ = verdict("nhl", [bc(service_id="rsn", access="unavailable")])
    assert eligible is False
    assert reason.startswith("not receivable: ")
    assert "rsn=unavailable" in reason


def test_out_of_market_blackout_is_not_eligible_even_on_an_eligible_access_status():
    ok_access = RULES["eligibility"]["eligible_access"][0]
    reason, _, eligible, *_ = verdict("nhl", [bc(service_id="rsn", access=ok_access,
                                                 blackout="OUT_OF_MARKET")])
    assert eligible is False
    assert reason.startswith("not receivable: ")


def test_authority_conflict_outranks_the_bare_list():
    reason, _, eligible, *_ = verdict("cfb", [], canonical_state="authority_conflict")
    assert eligible is False
    assert reason == "authority conflict - not placed"


# --------------------------------------------------------------------------- shape
def test_inactive_rows_are_the_callers_problem_not_this_functions():
    """reconcile_game filters `active` before calling. Passing a row here means it IS active, so an
    empty list is the only thing that means "nothing observed"."""
    reason, status, *_ = verdict("nfl", [])
    assert (reason, status) == ("no telecast observed", "tbd")


def test_it_is_pure():
    rows = [bc()]
    snapshot = json.dumps(rows, sort_keys=True)
    verdict("nfl", rows)
    assert json.dumps(rows, sort_keys=True) == snapshot, "the input was mutated"
