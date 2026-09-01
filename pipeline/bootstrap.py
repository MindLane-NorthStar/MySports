#!/usr/bin/env python3
"""Milestone 1 bootstrap — reference data into mysports.* (spec §17; deployment contract D10).

    python -m pipeline.bootstrap                      # live, idempotent (upserts)
    python -m pipeline.bootstrap --emit-sql artifacts/sql/bootstrap.sql   # write SQL, touch nothing

Loads, in FK order: networks_services (from data/row_order.json + data/access_profile.json + simulcast rules),
viewer_services (profile 1 from data/access_profile.json), conferences + teams (from every
artifacts/validation/*_teams.json present), team_territories (data/markets.json localTeams), rivalries
(data/rivalries.json, ids resolved by school name where possible). Markets, viewer_profiles, render_policies and
sources were seeded by migration 0005. Nothing is deleted; re-running refreshes names/colors/logos only.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from pipeline.db import DB, ROOT, slug

SIMULCAST = {"CBS": "Paramount+", "NBC": "Peacock", "TNT": "HBO Max", "ESPN": "Disney+", "ABC": "Disney+"}   # contract §5 rule
GROUP_TYPE = {"broadcast": "linear_broadcast", "cable": "linear_cable", "conference": "linear_cable", "local": "local_tba", "streaming": "streaming"}
ALIASES = {"CBS": ["CBS Sports"], "The CW": ["CW", "The CW Network"], "USA Network": ["USA", "USA Net"], "Big Ten Network": ["BTN"],
           "ACC Network": ["ACCN"], "SEC Network": ["SECN"], "SEC Network+": ["SECN+"], "ESPN Unlimited": ["ESPN Unlmtd"],
           "CBS Sports Network": ["CBSSN"], "FS1": ["FOX Sports 1"], "FS2": ["FOX Sports 2"], "ESPN+": ["ESPN Plus"],
           "Paramount+": ["Paramount Plus"], "HBO Max": ["Max", "HBO MAX", "MAX"], "Prime Video": ["Amazon Prime Video", "Prime", "Amazon"],
           "Hulu": ["HULU"], "NFL Network": ["NFL Net", "NFLN"], "truTV": ["TruTV"]}


def load_json(p: Path) -> Any:
    return json.loads(p.read_text(encoding="utf-8"))


def networks(db: DB) -> int:
    ro = load_json(ROOT / "data" / "row_order.json")
    ap = load_json(ROOT / "data" / "access_profile.json")
    rows: dict[str, dict[str, Any]] = {}
    order = 0
    for sport, groups in ro.items():
        if sport.startswith("_"):
            continue
        for group, items in groups.items():
            if group not in GROUP_TYPE:
                continue
            for it in items:
                name = it["network"] if isinstance(it, dict) else it
                order += 1
                r = rows.setdefault(slug(name), {"id": slug(name), "canonical_name": name, "short_name": None, "type": GROUP_TYPE[group],
                                                 "default_sort_order": order, "aliases": ALIASES.get(name, [])})
                if group == "local":
                    r["type"] = "local_tba"
    for name in ap.get("available", []) + ap.get("unavailable", []):
        rows.setdefault(slug(name), {"id": slug(name), "canonical_name": name, "short_name": None,
                                     "type": "streaming" if name in {"ESPN+", "ESPN Unlimited", "Peacock", "Paramount+", "HBO Max", "Prime Video", "Netflix", "Disney+", "Apple TV", "SEC Network+", "ACCNX", "ESPN3", "NFL Sunday Ticket", "Sportsnet+", "MW+", "UConn+"} else "linear_cable",
                                     "default_sort_order": None, "aliases": ALIASES.get(name, [])})
    for name in SIMULCAST.values():
        rows.setdefault(slug(name), {"id": slug(name), "canonical_name": name, "short_name": None, "type": "streaming", "default_sort_order": None, "aliases": ALIASES.get(name, [])})
    n = db.upsert("networks_services", rows.values(), "id", ["canonical_name", "type", "default_sort_order", "aliases"])
    for linear, stream in SIMULCAST.items():
        db.run("update networks_services set simulcast_service_id = %s where id = %s", (slug(stream), slug(linear)), tag="networks_services.simulcast")
    return n


def viewer_services(db: DB) -> int:
    ap = load_json(ROOT / "data" / "access_profile.json")
    rows = [{"profile_id": 1, "service_id": slug(n), "access_status": "available", "access_method": "DIRECTV CHOICE / subscription", "notes": "spec 3.2"} for n in ap.get("available", [])]
    rows += [{"profile_id": 1, "service_id": slug(n), "access_status": "unavailable", "access_method": None, "notes": "spec 3.2 exclusion"} for n in ap.get("unavailable", [])]
    return db.upsert("viewer_services", rows, "profile_id, service_id, effective_from", ["access_status", "access_method", "notes"])


def teams_and_conferences(db: DB) -> tuple[int, int]:
    val = ROOT / "artifacts" / "validation"
    files = {"cfb": val / "cfbd_2026_teams.json", "nfl": val / "nfl_2026_teams.json", "nhl": val / "nhl_2026_teams.json",
             "nba": val / "nba_2026_teams.json", "mlb": val / "mlb_2026_teams.json"}
    confs: dict[str, dict[str, Any]] = {}
    teams: list[dict[str, Any]] = []
    for sport, p in files.items():
        if not p.exists():
            print(f"  {sport}: no teams file ({p.name}) - skipped")
            continue
        for t in load_json(p):
            conf_name = t.get("conference")
            conf_id = f"{sport}-{slug(conf_name)}" if conf_name else None
            if conf_id:
                confs.setdefault(conf_id, {"id": conf_id, "sport": sport, "name": conf_name, "abbreviation": None})
            ext = {k: t[k] for k in ("espnId", "nhlId", "espnAbbreviation") if t.get(k)}
            if sport == "cfb":
                ext["cfbd"] = t["id"]
            teams.append({"id": str(t["id"]), "sport": sport, "canonical_name": t.get("school"),
                          "short_name": t.get("nickname") or (t.get("school") if sport == "cfb" else (t.get("school") or "").split(" ")[-1]),
                          "location": t.get("location"), "abbreviation": t.get("abbreviation"), "conference_id": conf_id,
                          "fbs_status": t.get("classification") if sport == "cfb" else None,
                          "primary_color": t.get("color"), "secondary_color": t.get("alternateColor"), "external_ids": ext})
    nc = db.upsert("conferences", confs.values(), "id", ["name"])
    nt = db.upsert("teams", teams, "id", ["canonical_name", "short_name", "location", "abbreviation", "conference_id", "fbs_status", "primary_color", "secondary_color", "external_ids"])
    return nc, nt


def territories(db: DB, team_ids_by_sport_abbr: dict[tuple[str, str], str]) -> int:
    mk = load_json(ROOT / "data" / "markets.json")
    rows = []
    for sport in ("nfl", "nhl", "nba", "mlb"):
        for ab in mk.get(sport, {}).get("localTeams", []):
            tid = team_ids_by_sport_abbr.get((sport, ab))
            if tid:
                rows.append({"team_id": tid, "market_id": mk["market"]["id"], "network_type": "Sphere" if sport == "nhl" else "Inner",
                             "source": mk.get(sport, {}).get("territorySource") or "data/markets.json"})
    return db.upsert("team_territories", rows, "team_id, market_id", ["network_type", "source"])


def rivalries(db: DB, cfb_ids_by_school: dict[str, str]) -> int:
    rv = load_json(ROOT / "data" / "rivalries.json")
    rows = []
    for r in rv.get("rivalries", []):
        a, b = r["teams"][0], r["teams"][1]
        rows.append({"sport": r.get("sport", "cfb"), "name": r["name"], "team_a_id": cfb_ids_by_school.get(a), "team_b_id": cfb_ids_by_school.get(b),
                     "team_a_name": a, "team_b_name": b, "trophy_name": r.get("trophy"), "display_label": r.get("label") or r["name"],
                     "tier": int(r.get("tier", 2)), "active": True})
    return db.upsert("rivalries", rows, "sport, team_a_name, team_b_name", ["name", "team_a_id", "team_b_id", "trophy_name", "display_label", "tier"])


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--emit-sql", metavar="FILE", help="write the statements to FILE instead of executing them")
    args = ap.parse_args(argv)
    db = DB(args.emit_sql)
    try:
        print("networks_services:", networks(db))
        print("viewer_services:", viewer_services(db))
        nc, nt = teams_and_conferences(db)
        print(f"conferences: {nc}; teams: {nt}")
        # id lookups from the same files (works in emit mode too)
        val = ROOT / "artifacts" / "validation"
        by_abbr: dict[tuple[str, str], str] = {}
        cfb_by_school: dict[str, str] = {}
        for sport, name in (("nfl", "nfl_2026_teams.json"), ("nhl", "nhl_2026_teams.json"), ("nba", "nba_2026_teams.json"), ("mlb", "mlb_2026_teams.json")):
            p = val / name
            if p.exists():
                for t in load_json(p):
                    by_abbr[(sport, t.get("abbreviation"))] = str(t["id"])
        p = val / "cfbd_2026_teams.json"
        if p.exists():
            for t in load_json(p):
                cfb_by_school[t["school"]] = str(t["id"])
        print("team_territories:", territories(db, by_abbr))
        print("rivalries:", rivalries(db, cfb_by_school))
        db.commit()
        print("committed" if not args.emit_sql else f"wrote {args.emit_sql} ({len(db.emitted)} statements)")
    finally:
        db.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
