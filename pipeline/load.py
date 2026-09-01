#!/usr/bin/env python3
"""Milestone 1 fixture load — adapter fixtures into mysports.games / game_broadcasts / game_odds / team_records,
with a source_snapshots row per file, source_observations per fact, and a refresh_runs record (spec §6, §7, §16).

    python -m pipeline.load --fixture artifacts/validation/nhl_2026_2026-10-01_fixture.json
    python -m pipeline.load --all                          # every *_fixture.json under artifacts/validation
    python -m pipeline.load --all --emit-sql artifacts/sql/load.sql

Milestone 1 semantics (Milestone 2 replaces the "last fixture wins" rule with the §9 reconciliation engine):
- games are upserted by id; canonical kickoff/network come straight from the fixture, and every value is also
  written as a source_observation so Milestone 2 can re-decide from evidence;
- nothing is deleted: a game absent from today's fixture keeps yesterday's row (spec §15.2);
- viewing_day = ET date shifted by the 03:00 cutover (render_policies.viewing_day_cutover);
- canonical_state / schedule_certainty derive from startTimeTBD, media presence and isTBDFlex.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

from pipeline.db import DB, ROOT, slug
from adapters.common import normalize_outlet   # alias table: CBSSN -> CBS Sports Network, CW -> The CW, USA Net -> USA Network ...

ET = ZoneInfo("America/New_York")
ACCESS = {"AVAILABLE": "available", "UNAVAILABLE": "unavailable", "UNKNOWN": "unknown", "CONDITIONAL/VERIFY": "conditional",
          "OUT_OF_MARKET": "out_of_market", "UNVERIFIED": "unverified"}
SOURCE_ID = {"cfbd.games+media": "cfbd", "espn.scoreboard": "espn.scoreboard", "nhl.schedule": "nhl.schedule", "nba.schedule": "nba.schedule"}
SOURCE_META = {"cfbd": ("structured_provider", 60), "espn.scoreboard": ("structured_provider", 55), "nhl.schedule": ("league_api", 80),
               "nba.schedule": ("league_api", 80), "data/local_rights": ("hand_entered", 90), "data/market_coverage": ("hand_entered", 90)}
STREAM_TYPES = {"ESPN+", "ESPN Unlimited", "Peacock", "Paramount+", "HBO Max", "Prime Video", "Netflix", "Disney+", "Hulu", "Apple TV", "SEC Network+", "YouTube"}


def parse_iso(v: str | None) -> datetime | None:
    if not v:
        return None
    v = v.replace("Z", "+00:00")
    if len(v) == 22:  # 2026-09-13T17:00+00:00 (ESPN, no seconds)
        v = v[:16] + ":00" + v[16:]
    try:
        dt = datetime.fromisoformat(v)
    except ValueError:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def viewing_day(dt_utc: datetime, cutover_hour: int = 3):
    et = dt_utc.astimezone(ET)
    return (et - timedelta(days=1)).date() if et.hour < cutover_hour else et.date()


def row_order_for(sport: str) -> list[str]:
    ro = json.loads((ROOT / "data" / "row_order.json").read_text(encoding="utf-8")).get(sport) or {}
    out = [b["network"] for b in ro.get("broadcast", [])] + ro.get("cable", []) + ro.get("conference", []) + ro.get("local", [])
    return out + ro.get("streaming", [])


def load_fixture(db: DB, path: Path, run_id: int | None) -> dict[str, int]:
    fx = json.loads(path.read_text(encoding="utf-8"))
    meta = fx.get("validation") or {}
    sport = meta.get("sport") or "cfb"
    source_id = SOURCE_ID.get(meta.get("source") or "", "cfbd" if sport == "cfb" else "espn.scoreboard")
    role, score = SOURCE_META.get(source_id, ("structured_provider", 50))
    local_role, local_score = SOURCE_META["data/local_rights"]
    market = json.loads((ROOT / "data" / "markets.json").read_text(encoding="utf-8"))
    local_abbrevs = set(market.get(sport, {}).get("localTeams", []))
    market_id = market["market"]["id"]
    order = row_order_for(sport)
    content_hash = hashlib.sha256(path.read_bytes()).hexdigest()
    counts = {"games": 0, "broadcasts": 0, "odds": 0, "records": 0, "observations": 0, "team_refs": 0, "venues": 0}

    # snapshot row for this fixture file (id retrieved live; in emit mode observations reference it by subquery)
    db.run("insert into source_snapshots (source_id, source_url, http_status, content_hash, content_type, storage_url, parser_version, parse_status) "
           "values (%s, %s, 200, %s, 'application/json', %s, %s, 'ok')",
           (source_id, _rel(path), content_hash, f"fixtures/{sport}/{path.name}", "adapters@0d67eb4"), tag="source_snapshots")
    snap_sub = f"(select id from source_snapshots where content_hash = '{content_hash}' order by id desc limit 1)"

    for g in fx.get("games", []):
        gid = str(g["id"])
        start = parse_iso(g.get("startDate"))
        if start is None:
            continue
        home, away = g["home"], g["away"]
        # team stubs so FKs hold even before bootstrap ran for this sport (bootstrap refreshes the details)
        for side in (home, away):
            db.upsert("teams", [{"id": str(side["id"]), "sport": sport, "canonical_name": side.get("teamFull") or side.get("team"),
                                 "short_name": side.get("team"), "abbreviation": side.get("abbreviation"), "external_ids": {}}], "id", [], tag="teams.stub")
            counts["team_refs"] += 1   # FK-safety upserts attempted (DO NOTHING when the team exists), not new rows
        venue_id_sub = None
        if g.get("venue"):
            db.upsert("venues", [{"name": g["venue"], "city": ""}], "name, city", [], tag="venues")   # city '' not null: the unique key must not contain nulls
            venue_id_sub = g["venue"]
            counts["venues"] += 1
        media = g.get("media") or []
        for m in media:
            m["outlet"] = normalize_outlet(m.get("outlet") or "")
        tbd = bool(g.get("startTimeTBD"))
        flex = bool((g.get("flags") or {}).get("isTBDFlex"))
        available_tv = [m for m in media if m.get("mediaType") == "tv" and m.get("access") == "AVAILABLE"]
        available_web = [m for m in media if m.get("mediaType") == "web" and m.get("access") in ("AVAILABLE", "UNKNOWN")]
        primary = None
        for name in order:
            if any(m["outlet"] == name for m in available_tv):
                primary = name; break
        if primary is None and available_web:
            primary = available_web[0]["outlet"]
        state = ("time_and_network_tbd" if tbd and not media else "time_tbd" if tbd else "network_tbd" if not media and sport == "cfb" else "fully_assigned")
        sched = "FLEX_PENDING" if flex else "TBD" if tbd else "FINAL"
        et = start.astimezone(ET)
        game = {"id": gid, "sport": sport, "external_primary_id": gid.split("-", 1)[-1] if sport != "cfb" else gid, "season": g.get("season") or meta.get("year"),
                "week": g.get("week"), "game_date": et.date(), "viewing_day": viewing_day(start),
                "home_team_id": str(home["id"]), "away_team_id": str(away["id"]), "neutral_site": bool(g.get("neutralSite")),
                "rights_controller_type": "league" if sport != "cfb" else "unknown",
                "canonical_kickoff_at_utc": start, "canonical_kickoff_at_et": et, "kickoff_status": "tbd" if tbd else "set",
                "kickoff_certainty": "tbd" if tbd else "flex" if flex else "definite", "schedule_certainty": sched,
                "primary_network_id": slug(primary) if primary else None, "network_status": "assigned" if primary else ("tbd" if not media else "not_receivable"),
                "network_certainty": "definite" if primary else "tbd", "canonical_state": state, "last_verified_at": datetime.now(timezone.utc)}
        for m in media:   # normalize outlet spellings from older fixtures, then network stubs first: games.primary_network_id and game_broadcasts.service_id reference them
            m["outlet"] = normalize_outlet(m.get("outlet") or "")
            outlet = m["outlet"]
            is_local_tba = (m.get("carriageCertainty") or "CONFIRMED") in ("UNANNOUNCED", "TBA_NO_RIGHTS_HOLDER")
            db.upsert("networks_services", [{"id": slug(outlet), "canonical_name": outlet, "type": "local_tba" if is_local_tba else ("streaming" if (m.get("mediaType") == "web" or outlet in STREAM_TYPES) else "linear_cable")}],
                      "id", [], tag="networks_services.stub")
        db.upsert("games", [game], "id", [k for k in game if k not in ("id", "sport", "external_primary_id")], tag="games")
        if venue_id_sub:
            db.run("update games set venue_id = (select id from venues where name = %s and city = '' limit 1) where id = %s", (venue_id_sub, gid), tag="games.venue")
        counts["games"] += 1
        # observations: kickoff + each media row
        db.run("insert into source_observations (source_id, game_id, snapshot_id, field_name, raw_value, normalized_value, authority_role, authority_score, claim_certainty, source_url_or_key, extraction_method, parser_version) "
               f"values (%s, %s, {snap_sub}, 'kickoff_at', %s, %s, %s, %s, %s, %s, 'adapter', 'adapters@0d67eb4')",
               (source_id, gid, g.get("startDate"), start.isoformat(), role, score, "tbd" if tbd else "flex" if flex else "definite", path.name), tag="source_observations")
        counts["observations"] += 1
        for m in media:
            outlet = m.get("outlet") or ""
            sid = slug(outlet)
            certainty = m.get("carriageCertainty") or "CONFIRMED"
            is_local_tba = certainty in ("UNANNOUNCED", "TBA_NO_RIGHTS_HOLDER")
            mk = m.get("market") or "national"
            feed = "NATIONAL"
            if mk == "local":
                feed = "HOME" if home.get("abbreviation") in local_abbrevs else "AWAY"
            acc = ACCESS.get(m.get("access") or "UNKNOWN", "unknown")
            db.upsert("game_broadcasts", [{
                "game_id": gid, "service_id": sid, "delivery_surface": "STREAMING" if m.get("mediaType") == "web" else "LINEAR",
                "feed_side": feed, "is_primary": bool(primary and outlet == primary), "requires_auth": m.get("mediaType") == "web",
                "access_status": acc, "carriage_certainty": certainty, "suppresses_local_feed": False,
                "blackout_rule": "OUT_OF_MARKET" if acc == "out_of_market" else "NONE",
                "market_id": market_id if mk in ("local", "regional") else None, "label": m.get("label"), "last_seen_at": datetime.now(timezone.utc)}],
                "game_id, service_id, delivery_surface, feed_side", ["is_primary", "access_status", "carriage_certainty", "blackout_rule", "market_id", "label", "last_seen_at"], tag="game_broadcasts")
            counts["broadcasts"] += 1
            src = m.get("source") or ""
            obs_source, (obs_role, obs_score) = (("data/local_rights", SOURCE_META["data/local_rights"]) if src.startswith("data/local_rights")
                                                 else ("data/local_rights", SOURCE_META["data/market_coverage"]) if "market_coverage" in src or src.startswith("market:")
                                                 else (source_id, (role, score)))
            db.run("insert into source_observations (source_id, game_id, snapshot_id, field_name, raw_value, normalized_value, raw_label, authority_role, authority_score, claim_certainty, source_url_or_key, extraction_method, parser_version) "
                   f"values (%s, %s, {snap_sub}, 'broadcast', %s, %s, %s, %s, %s, %s, %s, 'adapter', 'adapters@0d67eb4')",
                   (obs_source, gid, outlet, f"{sid}|{mk}|{certainty}", m.get("label"), obs_role, obs_score, "tbd" if is_local_tba else "definite", src), tag="source_observations")
            counts["observations"] += 1
        od = g.get("odds")
        if od and od.get("spread") is not None:
            db.upsert("game_odds", [{"game_id": gid, "provider": od.get("provider") or "unknown", "spread": od.get("spread"), "total": od.get("overUnder"),
                                     "home_moneyline": _int(od.get("moneylineHome")), "away_moneyline": _int(od.get("moneylineAway")),
                                     "fetched_at": parse_iso(od.get("fetchedAt")) or datetime.now(timezone.utc)}], "game_id, provider, fetched_at", [], tag="game_odds")
            counts["odds"] += 1
        recs = g.get("records") or {}
        for side_k, side in (("home", home), ("away", away)):
            r = recs.get(side_k)
            if r and r != "0-0":
                parts = [int(x) for x in r.split("-") if x.isdigit()]
                if len(parts) >= 2:
                    db.upsert("team_records", [{"team_id": str(side["id"]), "season": game["season"], "as_of": (parse_iso(meta.get("generatedAt")) or start).date(),
                                                "wins": parts[0], "losses": parts[1], "ties": parts[2] if len(parts) > 2 else 0, "source": source_id}],
                              "team_id, season, as_of", ["wins", "losses", "ties"], tag="team_records")
                    counts["records"] += 1
    return counts


def _rel(p: Path) -> str:
    p = p.resolve()
    try:
        return p.relative_to(ROOT.resolve()).as_posix()
    except ValueError:
        return p.as_posix()


def _int(v: Any) -> int | None:
    try:
        return int(str(v).replace("+", "")) if v not in (None, "") else None
    except ValueError:
        return None


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--fixture", action="append", help="fixture file (repeatable)")
    g.add_argument("--all", action="store_true", help="every *_fixture.json under artifacts/validation (samples/ excluded)")
    ap.add_argument("--emit-sql", metavar="FILE")
    ap.add_argument("--workflow", default="cowork")
    args = ap.parse_args(argv)
    files = [Path(f) for f in args.fixture] if args.fixture else sorted((ROOT / "artifacts" / "validation").glob("*_fixture.json"))
    db = DB(args.emit_sql)
    totals: dict[str, int] = {}
    run_id = None
    try:
        rows = db.fetch("insert into refresh_runs (workflow, providers_called) values (%s, %s) returning run_id", (args.workflow, sorted({f.name.split("_")[0] for f in files})))
        run_id = rows[0][0] if rows else None
        for f in files:
            c = load_fixture(db, f, run_id)
            print(f"{f.name}: " + " · ".join(f"{k} {v}" for k, v in c.items()))
            for k, v in c.items():
                totals[k] = totals.get(k, 0) + v
        if run_id is not None:
            db.run("update refresh_runs set completed_at = now(), status = 'succeeded', games_checked = %s, notes = %s where run_id = %s",
                   (totals.get("games", 0), json.dumps(totals), run_id), tag="refresh_runs")
        else:
            db.run("insert into refresh_runs (workflow, completed_at, status, games_checked, notes) values (%s, now(), 'succeeded', %s, %s)",
                   (args.workflow, totals.get("games", 0), json.dumps(totals)), tag="refresh_runs")
        db.commit()
        print("TOTAL: " + " · ".join(f"{k} {v}" for k, v in totals.items()) + (f" · run_id {run_id}" if run_id else "") + ("" if args.emit_sql else " · committed"))
        if args.emit_sql:
            print(f"wrote {args.emit_sql} ({len(db.emitted)} statements)")
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
