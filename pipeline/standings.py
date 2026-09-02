#!/usr/bin/env python3
"""MySports - standings for all four pro leagues, upserted into mysports.team_records (migration 0008).

    python -m pipeline.standings                                  # all four leagues
    python -m pipeline.standings --league mlb nhl                 # a subset
    python -m pipeline.standings --from-file nba=artifacts/validation/standings_nba_2026-09-02_raw.json
    python -m pipeline.standings --emit-sql artifacts/sql/standings.sql

One row per (team_id, season, as_of) - as_of is today's ET date, so a day's run is idempotent and the
table keeps a daily history. Fields are written EXACTLY as the provider supplies them; a field the league
does not publish stays null (NHL has no games_back, MLB/NBA/NFL have no ot_losses or points).

**Fail honest, per league** (Joe 2026-09-01, same rule as result_status): a league whose fetch or parse
fails is skipped with a warning and the other leagues still commit. A team the payload names but
`teams` does not carry is listed and skipped - never invented, and never allowed to raise an FK error.

Season semantics: `team_records.season` is always the season's START year (2026 = 2026-27 for NHL/NBA).
The provider decides which season a table belongs to, not the calendar:
  - MLB `season` and NHL `seasonId` state it outright;
  - ESPN labels its NBA/NFL response with `season.displayName` ('2025-26' / '2026'), and we ask for a
    specific season and step back one year when the answer is empty, so a table is never filed under a
    season it does not describe (see the NBA note in db/README.md).

**NBA `division_rank` holds the CONFERENCE rank** (Joe's ruling 2026-09-02): the NBA is organized and
displayed by conference seed, so ESPN's `playoffSeed` - 1..15 within the conference - is what the app
shows. Documented in db/README.md; the column name is shared with the other leagues, the meaning is not.

Conventions of pipeline/: stdlib HTTP through adapters.common, Windows-portable (no %-strftime, every
open() passes encoding=), ASCII console output, the DSN is never printed.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

from pipeline.db import DB, ROOT
from adapters.common import dump_json, http_json

ET = ZoneInfo("America/New_York")
LEAGUES = ("mlb", "nhl", "nba", "nfl")
SOURCE = {"mlb": "mlb-statsapi", "nhl": "nhl.standings", "nba": "espn.standings", "nfl": "espn.standings"}

MLB_URL = "https://statsapi.mlb.com/api/v1/standings"
NHL_URL = "https://api-web.nhle.com/v1/standings/now"
ESPN_URL = "https://site.api.espn.com/apis/v2/sports/{path}/standings"
ESPN_PATH = {"nba": "basketball/nba", "nfl": "football/nfl"}
# ESPN's `season.year` for a fall-to-spring league is the END year; NFL's is the season itself.
ESPN_YEAR_OFFSET = {"nba": 1, "nfl": 0}
# ESPN's NBA teams keyed our way: nba-{TRICODE} (adapters/nba.py's map); NFL is nfl-{espnId}
ESPN_TO_TRICODE = {"NY": "NYK", "GS": "GSW", "SA": "SAS", "UTAH": "UTA", "NO": "NOP", "WSH": "WAS"}

# every team_records column this module writes; a league leaves the ones it cannot answer null
FIELDS = ("wins", "losses", "ties", "ot_losses", "points", "division_rank", "games_back")


# ----------------------------------------------------------------------------- small parsers
def _int(v: Any) -> int | None:
    """'2' -> 2, 2.0 -> 2, '-'/''/None -> None. Never raises: a shape we do not know stays null."""
    if v is None or isinstance(v, bool):
        return None
    s = str(v).strip()
    if not s or s in ("-", "--", "E"):
        return None
    try:
        return int(float(s))
    except ValueError:
        return None


def _gb(v: Any) -> float | None:
    """games_back: MLB and ESPN both send '-' for the leader, which is 0.0 games back, not 'unknown'."""
    if v is None:
        return None
    s = str(v).strip()
    if s in ("-", "--"):
        return 0.0
    try:
        return round(float(s), 1)
    except ValueError:
        return None


def start_year(display_name: str | None, fallback: int) -> int:
    """'2025-26' -> 2025, '2026' -> 2026. The provider's own label decides the season we file under."""
    m = re.match(r"\s*(\d{4})", display_name or "")
    return int(m.group(1)) if m else fallback


def today_et() -> str:
    return datetime.now(tz=ET).strftime("%Y-%m-%d")


def row(team_id: str, season: int, **vals: Any) -> dict[str, Any]:
    r = {"team_id": team_id, "season": int(season)}
    r.update({f: vals.get(f) for f in FIELDS})
    return r


# ----------------------------------------------------------------------------- MLB
def fetch_mlb(season: int) -> dict[str, Any]:
    return http_json(MLB_URL, params={"leagueId": "103,104", "season": season})


def parse_mlb(raw: dict[str, Any], season: int) -> tuple[list[dict[str, Any]], list[str]]:
    """statsapi /standings: records[] per division, teamRecords[] per club. divisionRank and gamesBack
    arrive as STRINGS ('2', '3.0', '-'); ties live under leagueRecord."""
    notes: list[str] = []
    out: list[dict[str, Any]] = []
    blocks = raw.get("records") or []
    if not blocks:
        notes.append("mlb: /standings returned no records blocks")
    for b in blocks:
        for t in b.get("teamRecords") or []:
            tid = (t.get("team") or {}).get("id")
            if tid is None:
                notes.append("mlb: a teamRecord has no team.id - skipped")
                continue
            lr = t.get("leagueRecord") or {}
            out.append(row(f"mlb-{tid}", _int(t.get("season")) or season,
                           wins=_int(t.get("wins")), losses=_int(t.get("losses")),
                           ties=_int(lr.get("ties")) or 0,
                           division_rank=_int(t.get("divisionRank")),
                           games_back=_gb(t.get("gamesBack"))))
    return out, notes


# ----------------------------------------------------------------------------- NHL
def fetch_nhl() -> dict[str, Any]:
    """api-web.nhle.com resets the connection on Windows often enough to be routine; retry once (Joe)."""
    try:
        return http_json(NHL_URL)
    except Exception as e:  # noqa: BLE001 - the reset surfaces as URLError or ConnectionResetError alike
        print(f"  nhl: {type(e).__name__} on first attempt - retrying once")
        return http_json(NHL_URL)


def nhl_ids(root: Path, db: DB) -> dict[str, str]:
    """abbrev -> 'nhl-{id}'. The joined NHL/ESPN teams file is authoritative; the DB backs it up so a
    fresh checkout without artifacts/ still resolves."""
    ids: dict[str, str] = {}
    for tid, ab in db.fetch("select id, abbreviation from teams where sport = 'nhl' and abbreviation is not null"):
        ids[str(ab).upper()] = str(tid)
    p = root / "artifacts" / "validation" / "nhl_2026_teams.json"
    if p.exists():
        for t in json.loads(p.read_text(encoding="utf-8")):
            if t.get("abbreviation"):
                ids[str(t["abbreviation"]).upper()] = str(t["id"])
    return ids


def parse_nhl(raw: dict[str, Any], ids: dict[str, str]) -> tuple[list[dict[str, Any]], list[str]]:
    """standings/now: one flat row per club with wins/losses/otLosses/points/divisionSequence.
    seasonId 20252026 -> season 2025. The NHL publishes no games-back figure."""
    notes: list[str] = []
    out: list[dict[str, Any]] = []
    rows = raw.get("standings") or []
    if not rows:
        notes.append("nhl: standings/now returned no rows")
    for s in rows:
        ab = ((s.get("teamAbbrev") or {}).get("default") or "").upper()
        tid = ids.get(ab)
        if not tid:
            notes.append(f"nhl: no team row for abbreviation {ab or '(blank)'} - skipped, never guessed")
            continue
        sid = str(s.get("seasonId") or "")
        season = int(sid[:4]) if len(sid) == 8 and sid.isdigit() else None
        if season is None:
            notes.append(f"nhl: {ab} has no usable seasonId {s.get('seasonId')!r} - skipped")
            continue
        out.append(row(tid, season, wins=_int(s.get("wins")), losses=_int(s.get("losses")),
                       ties=_int(s.get("ties")) or 0, ot_losses=_int(s.get("otLosses")),
                       points=_int(s.get("points")), division_rank=_int(s.get("divisionSequence")),
                       games_back=None))
    return out, notes


# ----------------------------------------------------------------------------- ESPN (NBA + NFL)
def fetch_espn(league: str, season: int) -> dict[str, Any]:
    """Ask for a season by name and step back one year when the answer is empty.

    ESPN serves the PREVIOUS season's final table under the upcoming season's label once the new season
    has been announced (verified 2026-09-02: NBA `season.displayName` '2026-27' carrying the completed
    2025-26 standings, while `?season=2027` is empty). Asking explicitly and reading the label back is
    the only way to know which season a table describes.
    """
    path = ESPN_PATH[league]
    # Grouping level decides what `gamesBehind` MEANS: level=3 groups by division and reports division GB,
    # the default groups by conference and reports conference GB. The NBA is stored conference-wide
    # (Joe's ruling), so it must NOT ask for level=3 or its rank and its games-back would disagree.
    params: dict[str, Any] = {} if league == "nba" else {"level": 3}
    if league == "nfl":
        params["seasontype"] = 2          # regular season; the bare call serves PRESEASON records in September
    year = season + ESPN_YEAR_OFFSET[league]
    data: dict[str, Any] = {}
    for candidate in (year, year - 1):
        data = http_json(ESPN_URL.format(path=path), params={**params, "season": candidate})
        if _espn_entries(data):
            return data
        print(f"  {league}: season {candidate} has no standings entries - stepping back one year")
    return data


def _espn_entries(node: dict[str, Any]) -> list[tuple[str, dict[str, Any]]]:
    """[(group name, entry)] over the whole tree, so `level=3` division groups are reached."""
    found: list[tuple[str, dict[str, Any]]] = []
    for e in ((node.get("standings") or {}).get("entries") or []):
        found.append((node.get("name") or "", e))
    for c in node.get("children") or []:
        found.extend(_espn_entries(c))
    return found


def _stats(entry: dict[str, Any]) -> dict[str, Any]:
    return {s.get("name"): s for s in entry.get("stats") or []}


def parse_espn(raw: dict[str, Any], league: str, fallback_season: int) -> tuple[list[dict[str, Any]], list[str]]:
    notes: list[str] = []
    out: list[dict[str, Any]] = []
    season = start_year((raw.get("season") or {}).get("displayName"), fallback_season)
    entries = _espn_entries(raw)
    if not entries:
        notes.append(f"{league}: ESPN standings returned no entries")
    seen: set[str] = set()
    for _group, e in entries:
        team = e.get("team") or {}
        if league == "nba":
            ab = (team.get("abbreviation") or "").upper()
            if not ab:
                notes.append("nba: an entry has no team abbreviation - skipped")
                continue
            tid = f"nba-{ESPN_TO_TRICODE.get(ab, ab)}"
        else:
            if not team.get("id"):
                notes.append("nfl: an entry has no team id - skipped")
                continue
            tid = f"nfl-{team['id']}"
        if tid in seen:      # level=3 nests divisions under conferences; take each club once
            continue
        seen.add(tid)
        st = _stats(e)

        def val(name: str) -> Any:
            return (st.get(name) or {}).get("value")

        # NBA: division_rank carries the CONFERENCE seed (Joe's ruling). NFL: ESPN's seed is conference-
        # wide, so the club's position inside its `level=3` division group is the division rank.
        rank = _int(val("playoffSeed")) if league == "nba" else _division_rank(raw, tid)
        out.append(row(tid, season, wins=_int(val("wins")), losses=_int(val("losses")),
                       ties=_int(val("ties")) or 0,
                       division_rank=rank or None,      # 0 = 'no seed yet' in ESPN's preseason payloads
                       games_back=_gb((st.get("gamesBehind") or {}).get("displayValue"))))
    return out, notes


def _division_rank(raw: dict[str, Any], team_id: str) -> int | None:
    """Position inside the smallest group that holds the club (a `level=3` division of four).

    ESPN publishes no divisionRank stat for the NFL - the ORDER of a division group is the standing.
    A group in which nobody has played is unordered information, not a rank: before week 1 every club is
    0-0 and ESPN's sequence is arbitrary, so the rank stays null rather than inventing a leader.
    """
    def played(e: dict[str, Any]) -> int:
        st = _stats(e)
        return sum(_int((st.get(k) or {}).get("value")) or 0 for k in ("wins", "losses", "ties"))

    def walk(node: dict[str, Any]) -> int | None:
        for c in node.get("children") or []:
            r = walk(c)
            if r is not None:
                return r
        ents = (node.get("standings") or {}).get("entries") or []
        if 0 < len(ents) <= 8 and any(played(e) for e in ents):
            for i, e in enumerate(ents, start=1):
                if f"nfl-{(e.get('team') or {}).get('id')}" == team_id:
                    return i
        return None
    return walk(raw)


# ----------------------------------------------------------------------------- write
def upsert_rows(db: DB, rows: list[dict[str, Any]], as_of: str, source: str,
                known: set[str]) -> tuple[int, list[str]]:
    """One row per (team_id, season, as_of). A team the `teams` table does not carry is reported and
    skipped, so a provider that renames a club can never raise an FK error mid-run."""
    notes: list[str] = []
    n = 0
    for r in rows:
        if r["team_id"] not in known:
            notes.append(f"no teams row for {r['team_id']} - standings row skipped (never invented)")
            continue
        db.upsert("team_records", [{**r, "as_of": as_of, "source": source}],
                  "team_id, season, as_of", [*FIELDS, "source"], tag="team_records")
        n += 1
    return n, notes


def known_team_ids(db: DB, sport: str) -> set[str]:
    return {str(t[0]) for t in db.fetch("select id from teams where sport = %s", (sport,))}


# ----------------------------------------------------------------------------- CLI
def run_league(db: DB, league: str, *, season: int, as_of: str, root: Path,
               from_file: str | None, save: bool) -> dict[str, Any]:
    """Fetch (or replay), parse, upsert. Any exception is caught by main() so one league cannot end the run."""
    raw_path = root / "artifacts" / "validation" / f"standings_{league}_{as_of}_raw.json"
    if from_file:
        raw = json.loads(Path(from_file).read_text(encoding="utf-8"))
    elif league == "mlb":
        raw = fetch_mlb(season)
    elif league == "nhl":
        raw = fetch_nhl()
    else:
        raw = fetch_espn(league, season)
    if save and not from_file:
        dump_json(raw_path, raw)

    if league == "mlb":
        rows, notes = parse_mlb(raw, season)
    elif league == "nhl":
        rows, notes = parse_nhl(raw, nhl_ids(root, db))
    else:
        rows, notes = parse_espn(raw, league, season)

    written, more = upsert_rows(db, rows, as_of, SOURCE[league], known_team_ids(db, league))
    notes.extend(more)
    seasons = sorted({r["season"] for r in rows})
    return {"league": league, "parsed": len(rows), "written": written, "seasons": seasons, "notes": notes,
            "raw": str(raw_path if (save and not from_file) else (from_file or ""))}


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--league", nargs="+", choices=LEAGUES, default=list(LEAGUES))
    ap.add_argument("--season", type=int, default=2026, help="season START year (2026 = 2026-27 for nhl/nba)")
    ap.add_argument("--from-file", action="append", metavar="LEAGUE=PATH",
                    help="replay a saved raw payload for one league (repeatable)")
    ap.add_argument("--as-of", help="override the ET date the rows are filed under (default: today ET)")
    ap.add_argument("--no-save", action="store_true", help="do not write the raw snapshot")
    ap.add_argument("--emit-sql", metavar="FILE")
    ap.add_argument("--workflow", default="standings")
    args = ap.parse_args(argv)

    replays = dict(kv.split("=", 1) for kv in (args.from_file or []))
    bad = set(replays) - set(LEAGUES)
    if bad:
        print(f"ERROR: --from-file names unknown league(s): {', '.join(sorted(bad))}", file=sys.stderr)
        return 2
    as_of = args.as_of or today_et()
    db = DB(args.emit_sql)
    results: list[dict[str, Any]] = []
    failures: list[str] = []
    print(f"standings as_of {as_of} (ET) - leagues: {', '.join(args.league)}")
    try:
        for league in args.league:
            try:
                r = run_league(db, league, season=args.season, as_of=as_of, root=ROOT,
                               from_file=replays.get(league), save=not args.no_save)
            except Exception as e:  # noqa: BLE001 - fail honest: this league is skipped, the rest commit
                failures.append(f"{league}: {type(e).__name__}: {e}")
                print(f"  WARN {league}: {type(e).__name__}: {e} - league SKIPPED, others continue")
                continue
            results.append(r)
            seasons = ", ".join(str(s) for s in r["seasons"]) or "-"
            print(f"  {league}: parsed {r['parsed']} - written {r['written']} - season(s) {seasons}")
            for n in r["notes"]:
                print(f"    note: {n}")
        total = sum(r["written"] for r in results)
        notes = json.dumps({"as_of": as_of, "written": total,
                            "per_league": {r["league"]: r["written"] for r in results}})
        db.run("insert into refresh_runs (workflow, completed_at, status, providers_called, errors, notes) "
               "values (%s, now(), %s, %s, %s, %s)",
               (args.workflow, "failed" if failures and not results else "succeeded",
                sorted({SOURCE[r["league"]] for r in results}), json.dumps(failures), notes),
               tag="refresh_runs")
        db.commit()
        print(f"TOTAL: {total} team_records row(s) for {as_of}"
              + (f" - {len(failures)} league(s) skipped" if failures else "")
              + ("" if args.emit_sql else " - committed"))
        if args.emit_sql:
            print(f"wrote {args.emit_sql} ({len(db.emitted)} statements)")
    except Exception as e:  # noqa: BLE001
        if db.conn is not None:
            db.conn.rollback()
        print(f"ERROR: {e}", file=sys.stderr)
        return 1
    finally:
        db.close()
    return 1 if failures and not results else 0


if __name__ == "__main__":
    sys.exit(main())
