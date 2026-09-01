#!/usr/bin/env python3
"""Pure canonical-field resolver — spec §9.6 as a function, no database (Milestone 2).

    decision = resolve_field("kickoff_at", observations, rules, last_known_good)

Everything here is deterministic: the same observations and rules always yield the same Decision (Milestone 2
acceptance). pipeline/reconcile.py feeds it rows from mysports.source_observations; tests/test_reconcile.py feeds it
synthetic fixtures (spec §19). Windows-portable; no third-party imports.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
TENTATIVE = {"window", "choice_set", "flex", "tbd"}


def load_rules(path: Path | None = None) -> dict[str, Any]:
    return json.loads((path or ROOT / "data" / "authority_rules.json").read_text(encoding="utf-8"))


@dataclass
class Observation:
    id: int
    source_id: str
    role: str                     # authority_role enum value
    score: int
    value: str | None             # normalized value (ISO kickoff, or service id for network)
    certainty: str = "definite"   # claim_certainty enum value
    observed_at: datetime | None = None
    published_at: datetime | None = None
    updated_at: datetime | None = None
    valid_to: datetime | None = None
    rights_match: bool | None = None   # None = source is not a rights controller; False = claims rights for another context
    extra: dict[str, Any] = field(default_factory=dict)

    def explicit_ts(self) -> datetime | None:
        """spec 9.13 order: updated_at, published_at; fetch time is never used to rank claims."""
        return self.updated_at or self.published_at

    def freshness_ts(self) -> datetime:
        return self.updated_at or self.published_at or self.observed_at or datetime.min.replace(tzinfo=timezone.utc)


@dataclass
class Decision:
    field_name: str
    status: str                       # accepted | no_change | retained_last_known_good | unresolved_conflict
    value: str | None
    certainty: str | None
    winner_id: int | None
    considered_ids: list[int]
    rejected_ids: list[int]
    reason: str
    conflict: bool = False
    changed: bool = False


def effective_role(o: Observation, rules: dict[str, Any]) -> str:
    if o.role == "rights_controller" and o.rights_match is False:
        return rules["rights_context"].get("demoted_role", "official_aggregator")
    return o.role


def is_stale(o: Observation, staleness_days: int | None, now: datetime) -> bool:
    if staleness_days is None:
        return False
    return (now - o.freshness_ts()) > timedelta(days=staleness_days)


def _cert_rank(o: Observation, rules: dict[str, Any]) -> int:
    return int(rules["certainty_rank"].get(o.certainty, 0))


def resolve_field(field_name: str, observations: list[Observation], rules: dict[str, Any],
                  last_known_good: tuple[str | None, str | None] | None = None, now: datetime | None = None) -> Decision:
    """spec 9.6 steps 1-10 for one game and one field. last_known_good = (value, certainty) currently canonical, or None."""
    now = now or datetime.now(timezone.utc)
    frule = rules["fields"][field_name]
    roles: list[str] = frule["roles"]
    lkg_value, lkg_cert = last_known_good if last_known_good else (None, None)
    considered = [o.id for o in observations]

    # 1 + 5: active (not superseded by its own source) and not stale
    active = [o for o in observations if o.valid_to is None and not is_stale(o, frule.get("staleness_days"), now)]
    # 4 + 6: roles eligible for this field, ranked
    ranked: list[tuple[int, Observation]] = []
    for o in active:
        r = effective_role(o, rules)
        if r in roles:
            ranked.append((roles.index(r), o))
    if not ranked:
        if lkg_value is not None:
            return Decision(field_name, "retained_last_known_good", lkg_value, lkg_cert, None, considered, considered,
                            "no active eligible observations; last-known-good retained (spec 9.14)")
        return Decision(field_name, "no_change", None, None, None, considered, considered, "no active eligible observations and no canonical value")

    top_rank = min(r for r, _ in ranked)
    top = [o for r, o in ranked if r == top_rank]
    lower = [o for r, o in ranked if r != top_rank]

    # 7 + 8: within the top role, order by explicit timestamp (newest first), then certainty, then id (determinism)
    def sort_key(o: Observation):
        ts = o.explicit_ts()
        return (0 if ts else 1, -(ts.timestamp() if ts else 0), -_cert_rank(o, rules), o.id)
    top_sorted = sorted(top, key=sort_key)
    definite_values = {o.value for o in top_sorted if o.certainty not in TENTATIVE}
    all_values = {o.value for o in top_sorted}
    winner: Observation | None = None
    why = ""
    if len(all_values) == 1:
        winner, why = top_sorted[0], f"single value at top role '{effective_role(top_sorted[0], rules)}'"
    elif len(definite_values) == 1:
        winner = next(o for o in top_sorted if o.certainty not in TENTATIVE)
        why = f"definite claim beats tentative claims at top role '{effective_role(winner, rules)}' (spec 9.6 step 8)"
    elif len(definite_values) == 0:
        winner, why = top_sorted[0], "only tentative claims at top role; newest kept as tentative"
    else:
        best = top_sorted[0]
        best_ts = best.explicit_ts()
        others = [o for o in top_sorted if o.value != best.value and o.certainty not in TENTATIVE]
        if best_ts and all((o.explicit_ts() is None) or (o.explicit_ts() < best_ts) for o in others):
            winner, why = best, f"newest explicit publication at top role '{effective_role(best, rules)}' (spec 9.6 step 7)"
    if winner is None:
        srcs = ", ".join(f"{o.source_id}={o.value}" for o in top_sorted if o.certainty not in TENTATIVE)
        rejected = [o.id for o in observations]
        if lkg_value is not None:
            return Decision(field_name, "retained_last_known_good", lkg_value, lkg_cert, None, considered, rejected,
                            f"top-authority conflict ({srcs}); last-known-good retained (spec 9.6 step 9)", conflict=True)
        return Decision(field_name, "unresolved_conflict", None, None, None, considered, rejected,
                        f"top-authority conflict ({srcs}) and no last-known-good (spec 9.6 step 10)", conflict=True)

    rejected = [o.id for o in observations if o.id != winner.id]
    notes = []
    if lower:
        dis = [o for o in lower if o.value != winner.value]
        if dis:
            notes.append("lower-authority disagreement retained as evidence: " + ", ".join(f"{o.source_id}={o.value}" for o in dis) + " (spec 9.7)")
    changed = (winner.value != lkg_value) or (winner.certainty != lkg_cert)
    status = "accepted" if changed else "no_change"
    return Decision(field_name, status, winner.value, winner.certainty, winner.id, considered, rejected, "; ".join([why] + notes), changed=changed)


# ----------------------------------------------------------------------------- primary network from broadcast rows
def primary_candidates(broadcasts: list[Observation], rail_order: list[str], rules: dict[str, Any]) -> tuple[list[Observation], list[int]]:
    """One candidate per source for the 'primary_network' field, built from that source's active 'broadcast' observations.
    extra must carry service_id, surface ('LINEAR'|'STREAMING'), feed ('NATIONAL'|'HOME'|'AWAY'), name (canonical outlet name).
    Linear rows win over streaming rows; among linear rows: feed order, then rail order (spec 9.11, contract 11.3).
    Returns (candidates, alternate_ids) — alternates are the same source's other rows, kept as considered evidence."""
    feed_order = rules["primary_network_tiebreak"]["feed_order"]
    rail = {n: i for i, n in enumerate(rail_order)}
    by_source: dict[str, list[Observation]] = {}
    for o in broadcasts:
        if o.valid_to is None and o.extra.get("service_id"):
            by_source.setdefault(o.source_id, []).append(o)
    cands, alternates = [], []

    def key(o: Observation):
        surf = 0 if o.extra.get("surface") == "LINEAR" else 1
        feed = feed_order.index(o.extra.get("feed")) if o.extra.get("feed") in feed_order else len(feed_order)
        return (surf, feed, rail.get(o.extra.get("name"), len(rail)), o.id)
    for src, rows in by_source.items():
        rows = sorted(rows, key=key)
        best = rows[0]
        cand = Observation(best.id, best.source_id, best.role, best.score, best.extra["service_id"], best.certainty, best.observed_at,
                           best.published_at, best.updated_at, None, best.rights_match,
                           dict(best.extra, stream_exclusive=(best.extra.get("surface") != "LINEAR")))
        cands.append(cand)
        alternates.extend(o.id for o in rows[1:])
    return cands, alternates


def canonical_state(sport: str, kickoff: Decision, network: Decision, network_dec_cert: str | None) -> str:
    if kickoff.status == "unresolved_conflict" or network.status == "unresolved_conflict":
        return "authority_conflict"
    kick_tbd = (kickoff.certainty == "tbd") or kickoff.value is None
    net_missing = network.value is None
    if sport == "cfb":
        if kick_tbd and net_missing:
            return "time_and_network_tbd"
        if kick_tbd:
            return "time_tbd"
        if net_missing:
            return "network_tbd"
        return "fully_assigned"
    return "time_tbd" if kick_tbd else "fully_assigned"


def rights_context(sport: str, neutral_site: bool, home_conference_id: str | None, home_team_id: str, rules: dict[str, Any]) -> tuple[str, str | None, str]:
    """spec 9.2 -> (rights_controller_type, rights_controller_id, reason)."""
    rc = rules["rights_context"]
    if sport != "cfb":
        return "league", sport, f"{sport}: league controls national and local media rights"
    cfg = rc["cfb"]
    if neutral_site:
        return "event_organizer", None, "neutral site: event organizer or designated rights holder (unknown until an official source names it)"
    if home_conference_id in cfg.get("independent_conference_ids", []) or not home_conference_id:
        return "independent_school", home_team_id, "independent home game: school + contracted rights holder"
    return "conference", home_conference_id, "non-neutral: home team's conference media-rights system"
