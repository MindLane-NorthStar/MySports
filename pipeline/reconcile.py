#!/usr/bin/env python3
"""Milestone 2 reconciliation — the only writer of canonical game facts (spec §6.1, §7.10-§7.11, §9, §10, §16).

    python -m pipeline.reconcile                       # games with evidence newer than their last decision (default)
    python -m pipeline.reconcile --all                 # every game (after a rule change: bump rule_version first)
    python -m pipeline.reconcile --game 401856766 --game nhl-2026020011
    python -m pipeline.reconcile --export artifacts/sql/reconcile_input.json      # live read only, no writes
    python -m pipeline.reconcile --input artifacts/sql/reconcile_input.json --emit-sql artifacts/sql/reconcile.sql   # offline dry run

Reads source_observations (+ sources, networks_services, game_broadcasts), decides kickoff_at and primary_network per
game through pipeline/resolver.py, then writes: games.canonical_* / primary_network_id / canonical_state / rights_*,
canonical_decisions (every evaluation), canonical_change_history (changes only), game_broadcasts.is_primary,
viewer_game_eligibility (profile 1), refresh_runs. Never deletes; never guesses on a top-authority conflict.
"""
from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

from pipeline.db import DB, ROOT
from pipeline.resolver import (Observation, canonical_state, load_rules, primary_candidates, resolve_field,
                               rights_context)

ET = ZoneInfo("America/New_York")
PROFILE_ID = 1

GAMES_SQL = """
select g.id, g.sport::text, g.neutral_site, g.home_team_id, t.conference_id as home_conference_id,
       g.canonical_kickoff_at_utc, g.kickoff_certainty::text, g.primary_network_id, g.network_certainty::text,
       g.canonical_state::text, g.rights_controller_type::text, g.rights_controller_id
from games g join teams t on t.id = g.home_team_id {where} order by g.id"""

OBS_SQL = """
select o.id, o.source_id, o.game_id, o.field_name, o.normalized_value, o.raw_label, o.claim_certainty::text,
       o.observed_at, o.published_at, o.updated_at, o.valid_to, o.authority_role::text, o.authority_score,
       s.rights_scope, n.canonical_name as service_name, n.type::text as service_type
from source_observations o join sources s on s.id = o.source_id
left join networks_services n on o.field_name = 'broadcast' and n.id = split_part(o.normalized_value, '|', 1)
where o.field_name in ('kickoff_at', 'broadcast') {where} order by o.game_id, o.id"""

BC_SQL = """
select b.game_id, b.service_id, b.delivery_surface::text, b.feed_side::text, b.access_status::text, b.carriage_certainty::text,
       b.blackout_rule::text, b.active, n.canonical_name
from game_broadcasts b left join networks_services n on n.id = b.service_id {where} order by b.game_id, b.id"""

# Default mode selects games whose evidence CHANGED since their last decision: a new claim (observed_at) or a
# withdrawn/superseded claim (valid_to). last_seen_at is deliberately excluded - a repeat sighting of the same
# value bumps it on every load but cannot change any decision (found live 2026-09-01: including it made the
# default mode evaluate all 237 games after every load, same cost as --all).
CHANGED_WHERE = """where not exists (select 1 from canonical_decisions d where d.game_id = g.id)
   or exists (select 1 from source_observations o where o.game_id = g.id
              and greatest(o.observed_at, coalesce(o.valid_to, o.observed_at)) >
                  (select max(d.decided_at) from canonical_decisions d where d.game_id = g.id))"""


def _ts(v: Any) -> datetime | None:
    if v is None or v == "":
        return None
    if isinstance(v, datetime):
        return v if v.tzinfo else v.replace(tzinfo=timezone.utc)
    s = str(v).replace("Z", "+00:00")
    if " " in s and "T" not in s:
        s = s.replace(" ", "T", 1)
    try:
        d = datetime.fromisoformat(s)
    except ValueError:
        return None
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


def _rel(p: Path) -> str:
    try:
        return p.resolve().relative_to(ROOT.resolve()).as_posix()
    except ValueError:
        return p.as_posix()


def rail_order(sport: str) -> list[str]:
    ro = json.loads((ROOT / "data" / "row_order.json").read_text(encoding="utf-8")).get(sport) or {}
    return [b["network"] for b in ro.get("broadcast", [])] + ro.get("cable", []) + ro.get("conference", []) + ro.get("local", []) + ro.get("streaming", [])


def viewing_day(dt_utc: datetime, cutover_hour: int = 3):
    et = dt_utc.astimezone(ET)
    return (et - timedelta(days=1)).date() if et.hour < cutover_hour else et.date()


# ----------------------------------------------------------------------------- input (live or file)
def read_input(db: DB, game_ids: list[str] | None, all_games: bool) -> dict[str, list[dict[str, Any]]]:
    if game_ids:
        gw = "where g.id = any(%s)"; ow = "and o.game_id = any(%s)"; bw = "where b.game_id = any(%s)"
        p: tuple = (game_ids,)
    elif all_games:
        gw = ""; ow = ""; bw = ""; p = ()
    else:
        gw = CHANGED_WHERE; ow = "and o.game_id in (select g.id from games g " + CHANGED_WHERE + ")"; bw = "where b.game_id in (select g.id from games g " + CHANGED_WHERE + ")"; p = ()
    cols_g = ["id", "sport", "neutral_site", "home_team_id", "home_conference_id", "canonical_kickoff_at_utc", "kickoff_certainty", "primary_network_id", "network_certainty", "canonical_state", "rights_controller_type", "rights_controller_id"]
    cols_o = ["id", "source_id", "game_id", "field_name", "normalized_value", "raw_label", "claim_certainty", "observed_at", "published_at", "updated_at", "valid_to", "authority_role", "authority_score", "rights_scope", "service_name", "service_type"]
    cols_b = ["game_id", "service_id", "delivery_surface", "feed_side", "access_status", "carriage_certainty", "blackout_rule", "active", "canonical_name"]
    games = [dict(zip(cols_g, r)) for r in db.fetch(GAMES_SQL.format(where=gw), p or None)]
    obs = [dict(zip(cols_o, r)) for r in db.fetch(OBS_SQL.format(where=ow), p or None)]
    bcs = [dict(zip(cols_b, r)) for r in db.fetch(BC_SQL.format(where=bw), p or None)]
    return {"games": games, "observations": obs, "broadcasts": bcs}


def to_observations(rows: list[dict[str, Any]], game: dict[str, Any]) -> tuple[list[Observation], list[Observation]]:
    """Split a game's rows into kickoff observations and broadcast observations (with extra for primary_candidates)."""
    kick, bcast = [], []
    for r in rows:
        rights = None
        if r.get("authority_role") == "rights_controller":
            rights = (r.get("rights_scope") is not None and r.get("rights_scope") == game.get("rights_controller_id"))
        o = Observation(int(r["id"]), r["source_id"], r["authority_role"], int(r.get("authority_score") or 0), r.get("normalized_value"),
                        r.get("claim_certainty") or "definite", _ts(r.get("observed_at")), _ts(r.get("published_at")), _ts(r.get("updated_at")),
                        _ts(r.get("valid_to")), rights, {})
        if r["field_name"] == "kickoff_at":
            kick.append(o)
        else:
            parts = (r.get("normalized_value") or "").split("|")
            sid = parts[0] if parts and parts[0] else None
            market = parts[1] if len(parts) > 1 else "national"
            stype = r.get("service_type") or ""
            o.extra = {"service_id": sid, "name": r.get("service_name") or sid, "market": market,
                       "surface": "STREAMING" if stype in ("streaming", "authenticated_stream") else "LINEAR",
                       "feed": "NATIONAL" if market == "national" else "HOME"}
            bcast.append(o)
    return kick, bcast


# ----------------------------------------------------------------------------- one game
# ----------------------------------------------------------------------------- E5 market-pending
def market_covered(db, game_id: str, network_id: str) -> bool:
    """Does market_coverage hold a row for this (game, network) in the VIEWER's market?

    This is the half of the rule that makes the state self-resolving. While the 506sports map is
    unpublished there is no row, so the game stays pending; the moment the map loads a row exists and
    the game is decided normally - eligible, or genuinely out of market - with no manual step and no
    second visit from anybody.
    """
    if not network_id:
        return False
    rows = db.fetch(
        "select 1 from market_coverage mc join markets m on m.id = mc.market_id "
        "where mc.game_id = %s and mc.network_id = %s and m.is_viewer_market limit 1",
        (game_id, network_id))
    return bool(rows)


def is_market_pending(db, game_id: str, eligible: bool, active: list, rules: dict) -> bool:
    """E5: ineligible ONLY because the regional assignment has not published yet.

    AN ELIGIBLE GAME IS NEVER MARKET PENDING - if there is a way to watch it, nothing is pending.

    The "market-dependent network" test is READ FROM THE DATA rather than from a list of call letters:
    the adapters already write access_status='unverified' at precisely the point where a game sits in
    a regional window with no map entry (adapters/espn.py's NFL regional path, adapters/mlb.py's). A
    hardcoded FOX/CBS list would be a second, weaker copy of that fact, and it would silently miss the
    next network that starts splitting regionally.

    Deliberately NOT gated on a list of sports. The 'unverified' marker is only ever produced by a
    regional-window path, so a sport list would restate the same fact less reliably and could exclude
    a sport that starts using regional windows later.
    """
    if eligible:
        return False
    pending_access = set(rules["eligibility"].get("market_pending_access") or ())
    if not pending_access:
        return False
    for b in active:
        if b.get("access_status") not in pending_access:
            continue
        if not market_covered(db, game_id, b.get("service_id")):
            return True      # unassigned AND no map to assign it - the honest answer is "not yet"
    return False


# ----------------------------------------------------------------------------- the telecast ladder
def telecast_verdict(sport: str, active: list[dict[str, Any]], rules: dict[str, Any], *,
                     network_id: Any, stream_exclusive: bool, canonical_state: str | None,
                     ) -> tuple[str, str, bool, Any, list[str]]:
    """The eligibility `reason` and the `network_status` twin, decided together.

    Pure: no database handle, no writes, no clock. Returns
    `(reason, network_status, eligible, eligible_via_network_id, eligible_via_service_ids)`.

    WHY THIS IS ONE FUNCTION. The two strings are the same conclusion said twice - the reason is what
    the card explains, network_status is what the badge reads - and they were written thirty lines
    apart in reconcile_game(). They have disagreed twice. Prompt 24 fixed `reason` for bare non-CFB
    games; its twin on network_status kept labelling the same games `no_linear_telecast`, so a card
    read "No linear telecast" underneath a NETWORK TBD badge. Deciding both here is what makes that
    class of drift impossible rather than merely fixed.

    THE RULE THE TWIN WAS MISSING: `no_linear_telecast` is a conclusion drawn FROM broadcast rows.
    With zero active rows there is nothing to draw it from, so every sport gets `tbd` - which is what
    `reason = "no telecast observed"` has said since prompt 24. CFB was already `tbd` unconditionally
    and stays so; nothing about a rows-present case changes.
    """
    el = rules["eligibility"]
    ok = [b for b in active if b.get("access_status") in el["eligible_access"] and b.get("blackout_rule") != "OUT_OF_MARKET"]
    cond = [b for b in active if b.get("access_status") in el["conditional_access"]]
    via_net = next((b["service_id"] for b in ok if b.get("delivery_surface") == "LINEAR"), None)
    via_srv = [b["service_id"] for b in ok if b.get("delivery_surface") == "STREAMING" and b.get("service_id")]
    eligible = bool(ok)

    if eligible:
        tba = all(b.get("carriage_certainty") in ("UNANNOUNCED", "TBA_NO_RIGHTS_HOLDER") for b in ok)
        reason = el["local_tba_reason"] if tba else ("linear " + via_net if via_net else "stream only: " + ", ".join(via_srv))
    elif cond:
        reason = "verify access: " + ", ".join(b["service_id"] for b in cond if b.get("service_id"))
    elif canonical_state == "authority_conflict":
        reason = "authority conflict - not placed"
    elif not active:
        # NETWORK TBD (05 section 9). This branch fires only when there are ZERO active broadcast
        # rows, so there is nothing here to draw a market conclusion FROM - and the old non-cfb arm
        # drew one anyway, on 78 rows: nfl 24 + nhl 38 + nba 16, every non-cfb bare game. NFL week 18
        # is 100% bare because the league flex-schedules it, so the app was stating Joe could not
        # receive a full slate that nobody has assigned yet. One honest reason for every sport,
        # matching cfb's existing string rather than inventing a fifth. The web layer derives the
        # network-TBD state from the emptiness itself and must not have to compensate for a wrong
        # string written here.
        reason = "no telecast observed"
    else:
        reason = "not receivable: " + ", ".join(f"{b.get('service_id')}={b.get('access_status')}" for b in active)

    if network_id:
        network_status = "stream_exclusive" if stream_exclusive else "assigned"
    elif not active:
        network_status = "tbd"          # nothing observed, so nothing to conclude - see the docstring
    elif sport == "cfb":
        network_status = "tbd"
    else:
        network_status = "no_linear_telecast"

    return reason, network_status, eligible, via_net, via_srv


def reconcile_game(db: DB, game: dict[str, Any], rows: list[dict[str, Any]], bcs: list[dict[str, Any]], rules: dict[str, Any],
                   rails: dict[str, list[str]], now: datetime, stats: Counter, log: list[str]) -> None:
    gid, sport = game["id"], game["sport"]
    # rights context (spec 9.2) — needed before roles are ranked
    rtype, rid, rreason = rights_context(sport, bool(game.get("neutral_site")), game.get("home_conference_id"), game["home_team_id"], rules)
    if (rtype, rid) != (game.get("rights_controller_type"), game.get("rights_controller_id")):
        db.run("update games set rights_controller_type = %s, rights_controller_id = %s, rights_context_reason = %s where id = %s", (rtype, rid, rreason, gid), tag="games.rights")
    game = dict(game, rights_controller_type=rtype, rights_controller_id=rid)
    kick_obs, bc_obs = to_observations(rows, game)

    lkg_k = (game["canonical_kickoff_at_utc"].isoformat() if isinstance(game.get("canonical_kickoff_at_utc"), datetime) else (_ts(game.get("canonical_kickoff_at_utc")).isoformat() if _ts(game.get("canonical_kickoff_at_utc")) else None), game.get("kickoff_certainty"))
    lkg_n = (game.get("primary_network_id"), game.get("network_certainty"))
    kd = resolve_field("kickoff_at", kick_obs, rules, lkg_k if lkg_k[0] else None, now)
    cands, alternates = primary_candidates(bc_obs, rails.setdefault(sport, rail_order(sport)), rules)
    nd = resolve_field("primary_network", cands, rules, lkg_n if lkg_n[0] else None, now)
    nd.considered_ids = sorted(set(nd.considered_ids) | set(alternates))
    winner_cand = next((c for c in cands if c.id == nd.winner_id), None)
    stream_exclusive = bool(winner_cand and winner_cand.extra.get("stream_exclusive"))

    ctx = f"{rtype}:{rid or '?'}"
    for d in (kd, nd):
        db.run("insert into canonical_decisions (game_id, field_name, rule_version, rights_context, winning_source_observation_id, considered_observation_ids, "
               "rejected_observation_ids, decision_reason, result_value, result_certainty, decision_status) values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)",
               (gid, d.field_name, rules["rule_version"], ctx, d.winner_id, d.considered_ids, d.rejected_ids, d.reason, d.value, d.certainty, d.status), tag="canonical_decisions")
        stats[f"{d.field_name}:{d.status}"] += 1
        if d.conflict:
            stats["conflicts"] += 1
            log.append(f"CONFLICT {gid} {d.field_name}: {d.reason}")
        if d.changed:
            old = lkg_k[0] if d.field_name == "kickoff_at" else lkg_n[0]
            db.run("insert into canonical_change_history (game_id, field_name, old_value, new_value, canonical_decision_id, decision_reason, winning_source_observation_id, conflicting_observation_ids) "
                   "values (%s, %s, %s, %s, (select max(id) from canonical_decisions where game_id = %s and field_name = %s), %s, %s, %s)",
                   (gid, d.field_name, old, d.value, gid, d.field_name, d.reason, d.winner_id, d.rejected_ids), tag="canonical_change_history")
            stats["changes"] += 1
            oldc = lkg_k[1] if d.field_name == "kickoff_at" else lkg_n[1]
            log.append(f"CHANGE {gid} {d.field_name}: {old} ({oldc}) -> {d.value} ({d.certainty})")

    # canonical columns
    state = canonical_state(sport, kd, nd, nd.certainty)
    # ONE ladder, decided once, used by both writers below. See telecast_verdict().
    active = [b for b in bcs if b.get("active", True)]
    reason, network_status, eligible, via_net, via_srv = telecast_verdict(
        sport, active, rules, network_id=nd.value, stream_exclusive=stream_exclusive, canonical_state=state)
    sets: list[str] = ["canonical_state = %s", "last_verified_at = %s"]
    params: list[Any] = [state, now]
    if kd.value is not None and kd.status in ("accepted", "retained_last_known_good", "no_change"):
        k_utc = _ts(kd.value)
        if k_utc:
            sets += ["canonical_kickoff_at_utc = %s", "canonical_kickoff_at_et = %s", "kickoff_certainty = %s", "kickoff_status = %s", "schedule_certainty = %s", "game_date = %s", "viewing_day = %s"]
            params += [k_utc, k_utc.astimezone(ET), kd.certainty, "tbd" if kd.certainty == "tbd" else "set",
                       "FLEX_PENDING" if kd.certainty == "flex" else "TBD" if kd.certainty == "tbd" else "FINAL", k_utc.astimezone(ET).date(),
                       k_utc.astimezone(ET).date() if kd.certainty == "tbd" else viewing_day(k_utc)]   # a TBD placeholder (midnight ET) must not roll to the previous viewing day
    if nd.status in ("accepted", "retained_last_known_good", "no_change"):
        sets += ["primary_network_id = %s", "network_certainty = %s", "network_status = %s"]
        params += [nd.value, nd.certainty if nd.value else "tbd", network_status]
    elif nd.status == "unresolved_conflict":
        sets += ["primary_network_id = null", "network_certainty = null", "network_status = 'authority_conflict'"]
    db.run(f"update games set {', '.join(sets)} where id = %s", tuple(params + [gid]), tag="games.canonical")
    if state != game.get("canonical_state"):
        stats["state_changes"] += 1
    if nd.value is None:   # split so every placeholder has column type context (bare `%s is not null` cannot be typed by the server)
        db.run("update game_broadcasts set is_primary = false where game_id = %s", (gid,), tag="game_broadcasts.primary")
    else:
        db.run("update game_broadcasts set is_primary = (service_id = %s) where game_id = %s", (nd.value, gid), tag="game_broadcasts.primary")

    # viewer eligibility (spec 10) for profile 1 - decided above by telecast_verdict(), beside the
    # network_status it has to agree with.
    # E5 market-pending. Computed HERE, beside eligibility, because it is the same decision seen from
    # the other side - and a second implementation in the app would drift from this one exactly as a
    # JS eligibility rule would have.
    market_pending = is_market_pending(db, gid, eligible, active, rules)
    db.upsert("viewer_game_eligibility", [{"game_id": gid, "viewer_profile_id": PROFILE_ID, "eligible": eligible, "eligible_via_network_id": via_net,
                                          "eligible_via_service_ids": via_srv, "reason": reason, "market_pending": market_pending,
                                          "computed_at": now, "entitlement_version": rules["rule_version"]}],
              "game_id, viewer_profile_id", ["eligible", "eligible_via_network_id", "eligible_via_service_ids", "reason", "market_pending",
                                             "computed_at", "entitlement_version"], tag="viewer_game_eligibility")
    stats["eligible" if eligible else "not_eligible"] += 1
    if market_pending:
        stats["market_pending"] += 1


# ----------------------------------------------------------------------------- main
def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--all", action="store_true", help="every game, not only those with new evidence")
    ap.add_argument("--game", action="append", help="game id (repeatable)")
    ap.add_argument("--export", metavar="FILE", help="write the reconciler's input (games/observations/broadcasts) as JSON and exit; no writes")
    ap.add_argument("--input", metavar="FILE", help="read the input from a JSON export instead of the database (offline dry run)")
    ap.add_argument("--emit-sql", metavar="FILE", help="write the statements to FILE instead of executing them")
    ap.add_argument("--workflow", default="cowork")
    ap.add_argument("--log", metavar="FILE", help="write the change/conflict log (default artifacts/reconcile/reconcile_{date}.md)")
    args = ap.parse_args(argv)
    rules = load_rules()
    now = datetime.now(timezone.utc)

    if args.input:
        data = json.loads(Path(args.input).read_text(encoding="utf-8"))
        db = DB(args.emit_sql or str(ROOT / "artifacts" / "sql" / "reconcile_offline.sql"))
    else:
        db = DB(args.emit_sql)
        data = read_input(db, args.game, args.all)
        if args.export:
            p = Path(args.export); p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(json.dumps(data, default=str, indent=1), encoding="utf-8")
            print(f"exported {len(data['games'])} games, {len(data['observations'])} observations, {len(data['broadcasts'])} broadcast rows -> {args.export}")
            db.close()
            return 0
    obs_by: dict[str, list[dict[str, Any]]] = {}
    for r in data["observations"]:
        obs_by.setdefault(r["game_id"], []).append(r)
    bc_by: dict[str, list[dict[str, Any]]] = {}
    for r in data["broadcasts"]:
        bc_by.setdefault(r["game_id"], []).append(r)
    stats: Counter = Counter()
    log: list[str] = []
    rails: dict[str, list[str]] = {}
    run_id = None
    try:
        rows = db.fetch("insert into refresh_runs (workflow, providers_called) values (%s, %s) returning run_id", (args.workflow, ["reconcile"]))
        run_id = rows[0][0] if rows else None
        for g in data["games"]:
            reconcile_game(db, g, obs_by.get(g["id"], []), bc_by.get(g["id"], []), rules, rails, now, stats, log)
        n = len(data["games"])
        summary = {k: v for k, v in sorted(stats.items())}
        if run_id is not None:
            db.run("update refresh_runs set completed_at = now(), status = 'succeeded', games_checked = %s, games_changed = %s, conflicts_found = %s, notes = %s where run_id = %s",
                   (n, stats["changes"], stats["conflicts"], json.dumps({"rule_version": rules["rule_version"], **summary}), run_id), tag="refresh_runs")
        else:
            db.run("insert into refresh_runs (workflow, completed_at, status, providers_called, games_checked, games_changed, conflicts_found, notes) values (%s, now(), 'succeeded', %s, %s, %s, %s, %s)",
                   (args.workflow, ["reconcile"], n, stats["changes"], stats["conflicts"], json.dumps({"rule_version": rules["rule_version"], **summary})), tag="refresh_runs")
        db.commit()
        print(f"reconciled {n} game(s) under {rules['rule_version']}: " + " · ".join(f"{k} {v}" for k, v in summary.items()) +
              (f" · run_id {run_id}" if run_id else "") + ("" if db.conn is None else " · committed"))
        if db.conn is None and db.emit_path:
            print(f"wrote {db.emit_path} ({len(db.emitted)} statements)")
        logp = Path(args.log) if args.log else ROOT / "artifacts" / "reconcile" / f"reconcile_{now.strftime('%Y-%m-%d_%H%M%S')}.md"
        logp.parent.mkdir(parents=True, exist_ok=True)
        logp.write_text(f"# reconcile {now.isoformat()} - {rules['rule_version']} - {n} games\n\n" + "\n".join(f"- {line}" for line in log) + "\n", encoding="utf-8")
        print(f"log: {_rel(logp)} ({len(log)} line(s))")
    except Exception as e:  # noqa: BLE001
        if db.conn is not None:
            db.conn.rollback()
            if run_id is not None:
                try:
                    with db.conn.cursor() as cur:
                        cur.execute("update refresh_runs set completed_at = now(), status = 'failed', errors = %s where run_id = %s", (json.dumps([str(e)]), run_id))
                    db.conn.commit()
                except Exception:  # noqa: BLE001
                    pass
        print(f"ERROR: {e}", file=sys.stderr)
        return 1
    finally:
        db.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
