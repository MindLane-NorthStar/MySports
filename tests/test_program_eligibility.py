"""Migration 0014 — a program carries an eligibility verdict, decided by the game ladder.

WHAT IS ACTUALLY BEING PINNED. Not "the reconciler ran": that a NASCAR race on FS1 comes out eligible
and the same race on FS2 does not is the whole reason 0014 exists, and it is the first thing a reader
sees when v1.7 puts a race on the grid. These tests exercise the SAME pure functions the production
path calls (`telecast_verdict`, `program_network`, `market_pending_from`) with no database, so they
say something about the decision rather than about the plumbing.

THE ACCESS RULES THEY CITE, so a later reader does not have to guess where a verdict comes from:
  * `data/access_profile.json` `available` - the DIRECTV CHOICE + streaming profile (spec 3.2). It
    lists **The CW** and **FS1**, and lists **FS2** under `unavailable`.
  * `data/authority_rules.json` `eligibility.eligible_access = ["available"]` - only that one
    access_status makes profile 1 eligible.
So an O'Reilly race on The CW is eligible under DIRECTV CHOICE and a Truck race on FS2 is not, and
neither fact is written here: both are read from those two files.
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from adapters.common import access_lookup, access_status_for  # noqa: E402
from pipeline.reconcile import market_pending_from, program_network, telecast_verdict  # noqa: E402
from pipeline.resolver import load_rules  # noqa: E402

RULES = load_rules()
PROFILE = access_lookup(ROOT)


def bc(service_id, surface="LINEAR", access="available", **kw):
    row = {"service_id": service_id, "delivery_surface": surface, "access_status": access,
           "carriage_certainty": "CONFIRMED", "blackout_rule": "NONE", "active": True,
           "is_primary": False, "feed_side": "NATIONAL"}
    row.update(kw)
    return row


def verdict(sport, active):
    network_id, stream_exclusive = program_network(active)
    return telecast_verdict(sport, active, RULES, network_id=network_id,
                            stream_exclusive=stream_exclusive, canonical_state=None)


# --------------------------------------------------------------- the access profile decides, not us
def test_the_profile_and_not_the_adapter_decides_each_outlet():
    """FS2 is the row prompt 48 found loaded as `available` by a hardcoded adapter constant."""
    assert access_status_for("FS1", *PROFILE) == "available"
    assert access_status_for("FS2", *PROFILE) == "unavailable"
    assert access_status_for("The CW", *PROFILE) == "available"
    # cf.nascar.com shouts its broadcaster names; case is a spelling difference, not a network.
    assert access_status_for("PRIME VIDEO", *PROFILE) == "available"
    assert access_status_for("USA", *PROFILE) == "available"          # through the alias table
    assert access_status_for("Channel Nobody Ruled On", *PROFILE) == "unknown"


# --------------------------------------------------------------- the four cases the brief names
def test_a_race_on_fs1_is_eligible():
    reason, status, eligible, via_net, via_srv = verdict("nascar", [bc("fs1")])
    assert eligible is True
    assert status == "assigned"
    assert via_net == "fs1"
    assert reason == "linear fs1"
    assert via_srv == []


def test_a_race_on_the_cw_is_eligible_under_directv_choice():
    """The CW is in data/access_profile.json `available`; eligible_access is ["available"]."""
    assert access_status_for("The CW", *PROFILE) == "available"
    reason, status, eligible, via_net, _ = verdict(
        "nascar", [bc("the-cw", access=access_status_for("The CW", *PROFILE))])
    assert eligible is True
    assert status == "assigned"
    assert via_net == "the-cw"
    assert reason == "linear the-cw"


def test_a_race_on_prime_video_is_stream_exclusive():
    reason, status, eligible, via_net, via_srv = verdict(
        "nascar", [bc("prime-video", surface="STREAMING")])
    assert eligible is True
    assert status == "stream_exclusive"
    assert via_net is None                      # nothing linear to name
    assert via_srv == ["prime-video"]
    assert reason == "stream only: prime-video"


def test_a_program_with_no_broadcast_rows_is_tbd():
    reason, status, eligible, via_net, via_srv = verdict("nascar", [])
    assert status == "tbd"
    assert eligible is False
    assert reason == "no telecast observed"     # NETWORK TBD, never "not on your services"
    assert (via_net, via_srv) == (None, [])


# --------------------------------------------------------------- FS2: the row that was wrong
def test_a_race_on_fs2_is_not_watchable_and_says_so():
    status_from_profile = access_status_for("FS2", *PROFILE)
    assert status_from_profile == "unavailable"
    reason, status, eligible, via_net, _ = verdict("nascar", [bc("fs2", access=status_from_profile)])
    assert eligible is False
    assert via_net is None
    assert reason == "not receivable: fs2=unavailable"
    # There IS a telecast; it is simply not one the viewer receives. Never `tbd`, which would claim
    # nobody has announced a broadcaster.
    assert status == "assigned"


# --------------------------------------------------------------- the pieces program_network decides
def test_the_primary_row_wins_then_the_first_linear_row():
    rows = [bc("hbo-max", surface="STREAMING"), bc("tnt")]
    assert program_network(rows) == ("tnt", False)          # linear beats the streaming simulcast
    rows = [bc("hbo-max", surface="STREAMING"), bc("tnt", is_primary=True)]
    assert program_network(rows) == ("tnt", False)
    rows = [bc("tnt"), bc("hbo-max", surface="STREAMING", is_primary=True)]
    assert program_network(rows) == ("hbo-max", False)      # the loader's own flag outranks order
    assert program_network([]) == (None, False)


def test_stream_exclusive_means_no_linear_row_at_all():
    assert program_network([bc("paramount-plus", surface="STREAMING")]) == ("paramount-plus", True)
    assert program_network([bc("paramount-plus", surface="STREAMING"), bc("cbs")])[1] is False


# --------------------------------------------------------------- market-pending, mirrored honestly
def test_an_unverified_program_row_is_market_pending_because_no_map_can_cover_it():
    """market_coverage is keyed by game_id, so a program's `covered` is always False - and that is
    the honest answer: unassigned AND nothing to assign it with."""
    active = [bc("fox", access="unverified")]
    _reason, _status, eligible, _n, _s = verdict("nfl", active)
    assert eligible is False
    assert market_pending_from(eligible, active, RULES, lambda _sid: False) is True


def test_an_eligible_program_is_never_market_pending():
    active = [bc("fox"), bc("cbs", access="unverified")]
    _reason, _status, eligible, _n, _s = verdict("nfl", active)
    assert eligible is True
    assert market_pending_from(eligible, active, RULES, lambda _sid: False) is False


# --------------------------------------------------------------- the ladder is ONE function
def test_programs_and_games_share_the_verdict_function():
    """If this ever stops being true, a race and a game can disagree about the same network."""
    import inspect

    import pipeline.reconcile as rec

    game_src = inspect.getsource(rec.reconcile_game)
    program_src = inspect.getsource(rec.reconcile_program)
    assert "telecast_verdict(" in game_src
    assert "telecast_verdict(" in program_src
    # and neither one re-implements the access test
    for src in (game_src, program_src):
        assert "eligible_access" not in src
