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
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

from pipeline.db import DB, ROOT, slug
from pipeline.programs import sync_shadow_program
from adapters.common import normalize_outlet   # alias table: CBSSN -> CBS Sports Network, CW -> The CW, USA Net -> USA Network ...

ET = ZoneInfo("America/New_York")
ACCESS = {"AVAILABLE": "available", "UNAVAILABLE": "unavailable", "UNKNOWN": "unknown", "CONDITIONAL/VERIFY": "conditional",
          "OUT_OF_MARKET": "out_of_market", "UNVERIFIED": "unverified"}
SOURCE_ID = {"cfbd.games+media": "cfbd", "espn.scoreboard": "espn.scoreboard", "nhl.schedule": "nhl.schedule", "nba.schedule": "nba.schedule"}
SOURCE_META = {"cfbd": ("structured_provider", 60), "espn.scoreboard": ("structured_provider", 55), "nhl.schedule": ("league_api", 80),
               "nba.schedule": ("league_api", 80), "data/local_rights": ("hand_entered", 90), "506sports": ("official_aggregator", 70)}
PARSER_VERSION = "adapters@b69f4f8"
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


# every counter load_fixture reports; the mysports-db skip path returns this zeroed so TOTAL still prints in full
ZERO_COUNTS = {"games": 0, "broadcasts": 0, "odds": 0, "records": 0, "records_on_game": 0,
               "probables": 0, "observations": 0, "observations_seen": 0, "observations_closed": 0,
               "team_refs": 0, "venues": 0, "programs": 0}
# Joe 2026-09-01: ESPN box scores for cfb/nfl/nba (our ids ARE ESPN ids), league-native for nhl/mlb.
# Raw URLs are never displayed - the completed event card is the click target.
_BOXSCORE = {
    "cfb": "https://www.espn.com/college-football/boxscore/_/gameId/{n}",
    "nfl": "https://www.espn.com/nfl/boxscore/_/gameId/{n}",
    "nba": "https://www.espn.com/nba/boxscore/_/gameId/{n}",
    "nhl": "https://www.nhl.com/gamecenter/{n}",
    "mlb": "https://www.mlb.com/gameday/{n}",
}


def boxscore_url(sport: str, game_id: str) -> str | None:
    """Computed once, at the first load that sees result_status 'final'; never overwritten."""
    tmpl = _BOXSCORE.get(sport)
    if not tmpl:
        return None
    return tmpl.format(n=game_id.split("-", 1)[-1] if sport != "cfb" else game_id)


# Scores are loader-written provider facts (db/migrations/0007 header), not reconciled observations.
# Null-safe by construction: an incoming null never erases a stored score, status, completion or link.
SCORES_SQL = """
update games set
  home_score    = coalesce(%s, home_score),
  away_score    = coalesce(%s, away_score),
  result_status = coalesce(%s, result_status),
  completed_at  = case when coalesce(%s, result_status) = 'final' then coalesce(completed_at, now()) else completed_at end,
  boxscore_url  = case when coalesce(%s, result_status) = 'final' then coalesce(boxscore_url, %s) else boxscore_url end
where id = %s
"""


# Probable pitchers are loader-written provider facts too (migration 0008), and null-safe the same way:
# an incoming null NEVER erases a stored starter (the schedule stops naming one for a game already under
# way, and for game 2 of a doubleheader it never named one), while a CHANGED name overwrites - a scratch
# two hours before first pitch has to reach the card.
PROBABLES_SQL = """
update games set
  probable_home_pitcher = coalesce(%s, probable_home_pitcher),
  probable_away_pitcher = coalesce(%s, probable_away_pitcher)
where id = %s
"""

# Pro records onto the game row, null-safe the same way: a fixture that stops carrying a record never
# erases one. Suppressed at 0-0, matching the contract's record run (v1.1). CFB records come from the
# weekly enrichment file instead - see pipeline/enrich_cfb.py, which owns the same two columns for cfb.
RECORDS_SQL = """
update games set
  home_record = coalesce(%s, home_record),
  away_record = coalesce(%s, away_record)
where id = %s
"""


def load_fixture(db: DB, path: Path, run_id: int | None) -> dict[str, int]:
    fx = json.loads(path.read_text(encoding="utf-8"))
    meta = fx.get("validation") or {}
    if (meta.get("source") or "") == "mysports-db":
        # render_feed output is the database speaking, not evidence; loading it would rank the DB against itself
        print(f"{path.name}: skipped (mysports-db feed is renderer output, not evidence)")
        return dict(ZERO_COUNTS)
    sport = meta.get("sport") or "cfb"
    source_id = SOURCE_ID.get(meta.get("source") or "", "cfbd" if sport == "cfb" else "espn.scoreboard")
    role, score = SOURCE_META.get(source_id, ("structured_provider", 50))
    local_role, local_score = SOURCE_META["data/local_rights"]
    market = json.loads((ROOT / "data" / "markets.json").read_text(encoding="utf-8"))
    local_abbrevs = set(market.get(sport, {}).get("localTeams", []))
    market_id = market["market"]["id"]
    content_hash = hashlib.sha256(path.read_bytes()).hexdigest()
    counts = dict(ZERO_COUNTS)

    # snapshot row for this fixture file (id retrieved live; in emit mode observations reference it by subquery)
    db.run("insert into source_snapshots (source_id, source_url, http_status, content_hash, content_type, storage_url, parser_version, parse_status) "
           "values (%s, %s, 200, %s, 'application/json', %s, %s, 'ok')",
           (source_id, _rel(path), content_hash, f"fixtures/{sport}/{path.name}", PARSER_VERSION), tag="source_snapshots")
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
        et = start.astimezone(ET)
        # Milestone 2: the loader writes game IDENTITY only. Canonical kickoff/network/state and rights context are
        # decided by pipeline/reconcile.py from the observations below (spec 6.1); a new game stays
        # time_and_network_tbd until reconciled. game_date/viewing_day are seeded on insert and moved by the reconciler.
        game = {"id": gid, "sport": sport, "external_primary_id": gid.split("-", 1)[-1] if sport != "cfb" else gid, "season": g.get("season") or meta.get("year"),
                "week": g.get("week"), "game_date": et.date(), "viewing_day": viewing_day(start),
                "home_team_id": str(home["id"]), "away_team_id": str(away["id"]), "neutral_site": bool(g.get("neutralSite"))}
        for m in media:   # network stubs first: game_broadcasts.service_id references them
            outlet = m["outlet"]
            is_local_tba = (m.get("carriageCertainty") or "CONFIRMED") in ("UNANNOUNCED", "TBA_NO_RIGHTS_HOLDER")
            db.upsert("networks_services", [{"id": slug(outlet), "canonical_name": outlet, "type": "local_tba" if is_local_tba else ("streaming" if (m.get("mediaType") == "web" or outlet in STREAM_TYPES) else "linear_cable")}],
                      "id", [], tag="networks_services.stub")
        db.upsert("games", [game], "id", ["season", "week", "neutral_site"], tag="games")
        if venue_id_sub:
            db.run("update games set venue_id = (select id from venues where name = %s and city = '' limit 1) where id = %s", (venue_id_sub, gid), tag="games.venue")
        counts["games"] += 1
        # Spec v0.5 P.1: the game's shadow program row, maintained in the same load that upserts the
        # game (loader-written, reconciler-invisible - the 0007/0008 doctrine). AFTER the venue link
        # above, so the shadow copies a venue_id that is already set rather than one load behind.
        # Idempotent: pipeline/programs.py writes nothing when nothing changed.
        sync_shadow_program(db, gid, away.get("team"), home.get("team"), sport, start)
        counts["programs"] += 1
        _st = g.get("status")
        if _st is not None and not isinstance(_st, str):   # an adapter sending the wrong type must not
            print(f"  warn: {gid} status is {type(_st).__name__}, not str - result_status left null")
            _st = None                                      # poison the score write (coalesce needs text)
        db.run(SCORES_SQL, (g.get("homeScore"), g.get("awayScore"), _st, _st, _st,
                            boxscore_url(sport, gid), gid), tag="games.result")
        pr = g.get("probables")
        if isinstance(pr, dict):
            db.run(PROBABLES_SQL, (_text(pr.get("home")), _text(pr.get("away")), gid), tag="games.probables")
            counts["probables"] += sum(1 for s in ("home", "away") if _text(pr.get(s)))

        # ---- observations with supersession (spec 9.6 step 5, 9.13): a source that repeats itself bumps last_seen_at;
        # a source that changes its claim gets a new row and valid_to on its old one; a broadcast row a source no longer
        # lists is closed (valid_to) and its game_broadcasts row goes inactive. Nothing is deleted (spec 15.2).
        active_rows = db.fetch("select id, source_id, field_name, normalized_value, claim_certainty from source_observations where game_id = %s and valid_to is null and field_name in ('kickoff_at', 'broadcast', 'local_carriage')", (gid,))
        active: dict[tuple[str, str], dict[str, tuple[int, str]]] = {}     # (source, field) -> normalized_value -> (id, certainty)
        for oid, osrc, ofield, oval, ocert in active_rows:
            active.setdefault((osrc, ofield), {})[oval] = (int(oid), ocert)
        seen_now: dict[tuple[str, str], set[str]] = {}

        def observe(src: str, fieldn: str, raw: str | None, norm: str, label: str | None, orole: str, oscore: int, cert: str, key: str) -> None:
            seen_now.setdefault((src, fieldn), set()).add(norm)
            prior = active.get((src, fieldn), {}).get(norm)
            if prior and prior[1] == cert:
                db.run("update source_observations set last_seen_at = now(), seen_count = seen_count + 1 where id = %s", (prior[0],), tag="source_observations.seen")
                counts["observations_seen"] += 1
                return
            if fieldn == "kickoff_at":   # single-valued field: every earlier active claim from this source is superseded
                for oid, _ in active.get((src, fieldn), {}).values():
                    db.run("update source_observations set valid_to = now() where id = %s and valid_to is null", (oid,), tag="source_observations.supersede")
                    counts["observations_closed"] += 1
            db.run("insert into source_observations (source_id, game_id, snapshot_id, field_name, raw_value, normalized_value, raw_label, authority_role, authority_score, claim_certainty, source_url_or_key, extraction_method, parser_version) "
                   f"values (%s, %s, {snap_sub}, %s, %s, %s, %s, %s, %s, %s, %s, 'adapter', %s)",
                   (src, gid, fieldn, raw, norm, label, orole, oscore, cert, key, PARSER_VERSION), tag="source_observations")
            counts["observations"] += 1

        observe(source_id, "kickoff_at", g.get("startDate"), start.isoformat(), None, role, score, "tbd" if tbd else "flex" if flex else "definite", path.name)
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
                "feed_side": feed, "is_primary": False, "requires_auth": m.get("mediaType") == "web",
                "access_status": acc, "carriage_certainty": certainty, "suppresses_local_feed": False,
                "blackout_rule": "OUT_OF_MARKET" if acc == "out_of_market" else "NONE",
                "market_id": market_id if mk in ("local", "regional") else None, "label": m.get("label"), "last_seen_at": datetime.now(timezone.utc), "active": True}],
                "game_id, service_id, delivery_surface, feed_side", ["access_status", "carriage_certainty", "blackout_rule", "market_id", "label", "last_seen_at", "active"], tag="game_broadcasts")
            counts["broadcasts"] += 1
            src = m.get("source") or ""
            if src.startswith("data/local_rights"):          # synthesized local row: the outlet itself is hand-entered (spec 3.12)
                observe("data/local_rights", "broadcast", outlet, f"{sid}|{mk}|{certainty}", m.get("label"), *SOURCE_META["data/local_rights"], "tbd" if is_local_tba else "definite", src)
            else:                                             # the outlet claim belongs to the feed ...
                observe(source_id, "broadcast", outlet, f"{sid}|{mk}|{certainty}", m.get("label"), role, score, "tbd" if is_local_tba else "definite", src)
                if "market_coverage" in src or src.startswith("market:"):   # ... and the Cleveland-receives-it judgment is its own hand-entered claim (spec 9.13: 14-day horizon)
                    cov_src = "506sports" if "market_coverage" in src else "data/local_rights"
                    observe(cov_src, "local_carriage", outlet, f"{sid}|{market_id}|{acc}", None, *SOURCE_META[cov_src], "definite", src)
        # close broadcast claims this source no longer makes, then deactivate broadcast rows with no active claim left
        for (osrc, ofield), vals in active.items():
            if ofield not in ("broadcast", "local_carriage") or (osrc, ofield) not in seen_now:
                continue
            for oval, (oid, _) in vals.items():
                if oval not in seen_now[(osrc, ofield)]:
                    db.run("update source_observations set valid_to = now() where id = %s and valid_to is null", (oid,), tag="source_observations.close")
                    counts["observations_closed"] += 1
        db.run("update game_broadcasts b set active = exists (select 1 from source_observations o where o.game_id = b.game_id and o.field_name = 'broadcast' and o.valid_to is null "
               "and split_part(o.normalized_value, '|', 1) = b.service_id) where b.game_id = %s", (gid,), tag="game_broadcasts.active")
        od = g.get("odds")
        if od and od.get("spread") is not None:
            db.upsert("game_odds", [{"game_id": gid, "provider": od.get("provider") or "unknown", "spread": od.get("spread"), "total": od.get("overUnder"),
                                     "home_moneyline": _int(od.get("moneylineHome")), "away_moneyline": _int(od.get("moneylineAway")),
                                     "fetched_at": parse_iso(od.get("fetchedAt")) or datetime.now(timezone.utc)}], "game_id, provider, fetched_at", [], tag="game_odds")
            counts["odds"] += 1
        recs = g.get("records") or {}
        # The same adapter records that feed team_records also go on the GAME, so the grid's record run
        # and the listings card read one consistent source instead of two. Pro RANKS stay null - these
        # leagues run no polls, and inventing one would be worse than an empty prefix.
        if recs:
            hr = _text(recs.get("home")) if _text(recs.get("home")) != "0-0" else None
            ar = _text(recs.get("away")) if _text(recs.get("away")) != "0-0" else None
            if hr or ar:
                db.run(RECORDS_SQL, (hr, ar, gid), tag="games.records")
                counts["records_on_game"] += sum(1 for v in (hr, ar) if v)
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


def run_context() -> dict[str, Any]:
    """Where this run happened, for the refresh_runs ledger.

    A GitHub Actions run carries GITHUB_RUN_ID; a laptop run does not. Recording it means the ledger
    answers "did the runner refresh, or did Joe?" without anyone having to remember.
    """
    run_id = os.getenv("GITHUB_RUN_ID")
    if not run_id:
        return {"host": "local"}
    return {"host": "github-actions", "github_run_id": run_id,
            "github_workflow": os.getenv("GITHUB_WORKFLOW"),
            "github_sha": (os.getenv("GITHUB_SHA") or "")[:12]}


def fixture_files(validation_dir: Path) -> list[Path]:
    """The `--all` file set: every *_fixture.json directly under validation_dir, minus the renderer's own
    db_* feeds (which are the database speaking, not evidence - see load_fixture's mysports-db guard).
    samples/ is excluded by construction: glob() does not descend into subdirectories."""
    return sorted(f for f in Path(validation_dir).glob("*_fixture.json") if not f.name.startswith("db_"))


def _rel(p: Path) -> str:
    p = p.resolve()
    try:
        return p.relative_to(ROOT.resolve()).as_posix()
    except ValueError:
        return p.as_posix()


def _text(v: Any) -> str | None:
    """A probable-pitcher cell is a display string or nothing; '' and non-strings are nothing."""
    return v.strip() if isinstance(v, str) and v.strip() else None


def _int(v: Any) -> int | None:
    try:
        return int(str(v).replace("+", "")) if v not in (None, "") else None
    except ValueError:
        return None


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--fixture", action="append", help="fixture file (repeatable)")
    g.add_argument("--all", action="store_true", help="every *_fixture.json under artifacts/validation (samples/ and db_* renderer feeds excluded)")
    ap.add_argument("--emit-sql", metavar="FILE")
    ap.add_argument("--workflow", default="cowork")
    args = ap.parse_args(argv)
    files = [Path(f) for f in args.fixture] if args.fixture else fixture_files(ROOT / "artifacts" / "validation")
    db = DB(args.emit_sql)
    totals: dict[str, int] = {}
    run_id = None
    try:
        rows = db.fetch("insert into refresh_runs (workflow, providers_called) values (%s, %s) returning run_id", (args.workflow, sorted({f.name.split("_")[0] for f in files})))
        run_id = rows[0][0] if rows else None
        # Land the ledger row in its OWN transaction, immediately.
        #
        # It used to ride along in the same uncommitted transaction as the whole load, so the
        # `rollback()` in the failure path below discarded it - and the "mark it failed" UPDATE then
        # matched zero rows and committed happily. A run that failed therefore left NO TRACE AT ALL,
        # which is why refresh_runs showed no `schedule_refresh` row on 2026-09-03 even though the
        # runner had dispatched and failed on 2026-09-02 (Actions run 33645776411). A run log that
        # only records successes cannot tell "never ran" from "ran and broke".
        if db.conn is not None and run_id is not None:
            db.conn.commit()
        for f in files:
            c = load_fixture(db, f, run_id)
            print(f"{f.name}: " + " · ".join(f"{k} {v}" for k, v in c.items()))
            for k, v in c.items():
                totals[k] = totals.get(k, 0) + v
        notes = json.dumps({**totals, **run_context()})
        if run_id is not None:
            db.run("update refresh_runs set completed_at = now(), status = 'succeeded', games_checked = %s, notes = %s where run_id = %s",
                   (totals.get("games", 0), notes, run_id), tag="refresh_runs")
        else:
            db.run("insert into refresh_runs (workflow, completed_at, status, games_checked, notes) values (%s, now(), 'succeeded', %s, %s)",
                   (args.workflow, totals.get("games", 0), notes), tag="refresh_runs")
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
                        cur.execute("update refresh_runs set completed_at = now(), status = 'failed', errors = %s, notes = %s where run_id = %s",
                                    (json.dumps([str(e)]), json.dumps(run_context()), run_id))
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
