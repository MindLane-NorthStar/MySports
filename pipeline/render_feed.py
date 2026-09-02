#!/usr/bin/env python3
"""MySports - a viewing day (or CFB week) read out of mysports.* in the adapter fixture shape.

Milestone 3 part 1 (spec 18): scripts/render_day.py stops depending on the adapter fixture files and
renders from the database instead. This module is the bridge - it emits the exact structure the
adapters emit, so the renderer cannot tell the two apart. Run from the repo root:

    python -m pipeline.render_feed --sport nhl --date 2026-10-01
    python -m pipeline.render_feed --sport cfb --week 1 --year 2026
    python -m pipeline.render_feed --sport cfb --latest-week          # prints the week and exits

Reads SUPABASE_DB_URL through pipeline.db.DB (never printed). Output is deterministic: games sort by
(startDate, id), media rows by (market, outlet), and generatedAt carries the newest games.updated_at in
the slice rather than wall-clock now, so two runs over unchanged data are byte-identical.
"""
from __future__ import annotations

import argparse
import sys
from datetime import timezone
from pathlib import Path

from adapters.common import ET, dump_json, et_display, find_repo_root, load_data, parse_iso
from pipeline.db import DB

# access_status (db) -> the adapter vocabulary render_day.py filters on
ACCESS = {
    "available": "AVAILABLE",
    "unavailable": "UNAVAILABLE",
    "unknown": "UNKNOWN",
    "conditional": "CONDITIONAL/VERIFY",
    "verify": "CONDITIONAL/VERIFY",
    "out_of_market": "OUT_OF_MARKET",
    "unverified": "UNVERIFIED",
}
PRO = ("nfl", "nhl", "nba", "mlb")

GAMES_SQL = """
select g.id, g.season, g.week, g.canonical_kickoff_at_utc, g.kickoff_certainty, g.neutral_site,
       v.name,
       h.id, h.short_name, h.canonical_name, h.location, h.abbreviation, hc.name,
       a.id, a.short_name, a.canonical_name, a.location, a.abbreviation, ac.name,
       g.updated_at
from games g
left join venues v on v.id = g.venue_id
left join teams h on h.id = g.home_team_id
left join conferences hc on hc.id = h.conference_id
left join teams a on a.id = g.away_team_id
left join conferences ac on ac.id = a.conference_id
where g.sport = %s and {filter}
"""

MEDIA_SQL = """
select b.game_id, n.canonical_name, b.delivery_surface, b.feed_side, b.market_id,
       b.access_status, b.carriage_certainty, b.label
from game_broadcasts b
join networks_services n on n.id = b.service_id
where b.active and b.game_id = any(%s)
"""

ODDS_SQL = """
select distinct on (game_id) game_id, provider, spread, total, home_moneyline, away_moneyline, fetched_at
from game_odds where game_id = any(%s) order by game_id, fetched_at desc, id desc
"""

RECORDS_SQL = """
select distinct on (team_id) team_id, wins, losses
from team_records where team_id = any(%s) and season = %s order by team_id, as_of desc, id desc
"""


def _iso(dt) -> str | None:
    """UTC ISO-8601 the way the adapters emit it (adapters.common.parse_iso reads it back)."""
    return None if dt is None else dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S") + ".000Z"


def _tid(sport: str, value: str | None):
    """CFB fixtures carry bare integer ids; the pro adapters carry their prefixed text ids."""
    if value is None:
        return None
    return int(value) if sport == "cfb" and value.isdigit() else value


def _details(spread, home_abbr, away_abbr):
    """Rebuild the adapter's odds 'details' string ("JAX -7.5") that render_day.py displays (line ~415).
    game_odds stores no details column, but the spread is home-relative (negative = home favored), so the
    favorite and line are exactly derivable. 0 renders as "PK"."""
    if spread is None or not home_abbr or not away_abbr:
        return None
    s = float(spread)
    if s == 0:
        return "PK"
    fav, line = (home_abbr, s) if s < 0 else (away_abbr, -s)
    return f"{fav} {line:g}"


def _market(feed_side: str | None, market_id: str | None) -> str:
    if feed_side in ("HOME", "AWAY"):
        return "local"
    return "regional" if market_id else "national"


def build(db: DB, sport: str, *, date: str | None, week: int | None, year: int) -> tuple[dict, dict[str, int]]:
    if sport == "cfb":
        where, params = "g.week = %s and g.season = %s", (sport, week, year)
    else:
        where, params = "g.viewing_day = %s", (sport, date)
    rows = db.fetch(GAMES_SQL.format(filter=where), params)
    ids = [r[0] for r in rows]

    media: dict[str, list[dict]] = {}
    for gid, outlet, surface, side, market_id, access, certainty, label in (db.fetch(MEDIA_SQL, (ids,)) if ids else []):
        media.setdefault(gid, []).append({
            "mediaType": "web" if surface == "STREAMING" else "tv",
            "outlet": outlet,
            "access": ACCESS.get(access, "UNKNOWN"),
            "market": _market(side, market_id),
            "carriageCertainty": certainty,
            "label": label,
            "source": "mysports-db",
        })

    odds = {r[0]: r for r in (db.fetch(ODDS_SQL, (ids,)) if ids else [])}
    team_ids = sorted({r[7] for r in rows if r[7]} | {r[13] for r in rows if r[13]})
    records = {r[0]: r for r in (db.fetch(RECORDS_SQL, (team_ids, year)) if team_ids else [])}

    games, newest = [], None
    for r in rows:
        (gid, season, wk, kickoff, certainty, neutral, venue,
         hid, hshort, hfull, hloc, habbr, hconf,
         aid, ashort, afull, aloc, aabbr, aconf, updated) = r
        start = _iso(kickoff)
        tbd = certainty == "tbd"
        newest = updated if newest is None or (updated is not None and updated > newest) else newest

        def side(tid, short, full, loc, abbr, conf):
            if sport == "cfb":
                return {"id": _tid(sport, tid), "team": short, "conference": conf, "classification": "fbs"}
            return {"id": tid, "team": short, "teamFull": full, "location": loc,
                    "abbreviation": abbr, "conference": conf, "classification": sport}

        rows_m = sorted(media.get(gid, []), key=lambda m: (m["market"], m["outlet"]))
        for m in rows_m:
            m["isStartTimeTBD"] = tbd
            m["startTime"] = start
        g = {
            "id": _tid(sport, gid), "sport": sport, "season": season, "week": wk,
            "startDate": start, "startTimeET": et_display(start), "startTimeTBD": tbd,
            "neutralSite": bool(neutral), "venue": venue,
            "home": side(hid, hshort, hfull, hloc, habbr, hconf),
            "away": side(aid, ashort, afull, aloc, aabbr, aconf),
            "media": rows_m,
        }
        if sport != "cfb":
            o = odds.get(gid)
            g["odds"] = None if o is None else {
                "provider": o[1],
                "details": _details(o[2], habbr, aabbr),
                "spread": float(o[2]) if o[2] is not None else None,
                "overUnder": float(o[3]) if o[3] is not None else None,
                "moneylineHome": o[4], "moneylineAway": o[5], "fetchedAt": _iso(o[6]),
            }
            hr, ar = records.get(hid), records.get(aid)
            g["records"] = None if not (hr or ar) else {
                "home": None if hr is None else f"{hr[1]}-{hr[2]}",
                "away": None if ar is None else f"{ar[1]}-{ar[2]}",
            }
        games.append(g)

    games.sort(key=lambda g: (g["startDate"] or "", str(g["id"])))

    root = find_repo_root()
    mk = (load_data(root, "markets.json", {}) or {})
    label = f"{mk.get('market', {}).get('name', 'Cleveland')} (DMA {mk.get('market', {}).get('dma', 510)})"
    env = {
        "generatedAt": _iso(newest) or "1970-01-01T00:00:00.000Z",
        "sport": sport, "year": year, "week": week, "apiKeyIncluded": False,
        "source": "mysports-db", "market": label,
    }
    if sport == "cfb":
        env["seasonType"] = "regular"
    else:
        env["dayFilter"] = date
        env["localTeams"] = list((mk.get(sport) or {}).get("localTeams") or [])

    by_day: dict[str, int] = {}
    for g in games:
        dt = parse_iso(g["startDate"])
        if dt is not None:
            by_day[dt.astimezone(ET).strftime("%Y-%m-%d")] = by_day.get(dt.astimezone(ET).strftime("%Y-%m-%d"), 0) + 1
    return {"validation": env, "games": games}, by_day


def latest_week(db: DB, sport: str, year: int) -> int | None:
    rows = db.fetch("select max(week) from games where sport = %s and season = %s", (sport, year))
    return rows[0][0] if rows and rows[0][0] is not None else None


TEAMS_SQL = """
select t.id, t.canonical_name, t.short_name, t.abbreviation, t.primary_color, t.secondary_color,
       c.name as conference, t.fbs_status
from teams t left join conferences c on c.id = t.conference_id
where t.sport = %s
order by t.id
"""


def teams_rows(db: DB, sport: str) -> list[dict]:
    """The renderer's teams file, straight out of mysports.teams.

    scripts/render_day.py reads exactly two fields from this file - `abbreviation` and `color` - but it
    reads them for every team on the slate, so a missing file is fatal. On a GitHub runner the file IS
    missing: artifacts/ is gitignored, and render_all runs as its OWN job on a FRESH machine, so it
    never sees the adapter output the refresh job produced (that is how render_all failed on
    2026-09-02 and again in run 33674243466 with FileNotFoundError on mlb_2026_teams.json).

    The database already holds everything the file needs, so the renderer can source it from there and
    stop depending on a sibling job's working directory. Shape matches adapters.common.team_record.
    """
    out = []
    for tid, canonical, short, abbr, color, alt, conf, fbs in db.fetch(TEAMS_SQL, (sport,)):
        out.append({
            "id": str(tid),
            "school": canonical or short or str(tid),
            "abbreviation": abbr,
            "conference": conf,
            "classification": fbs or sport,
            "color": color,
            "alternateColor": alt,
            "logos": [],          # render_day reads logos from the local asset cache, not from here
            "nickname": short,
        })
    return out


def teams_default_path(sport: str, year: int) -> str:
    """The path scripts/render_day.py looks for when --teams is not given."""
    return (f"artifacts/validation/cfbd_{year}_teams.json" if sport == "cfb"
            else f"artifacts/validation/{sport}_{year}_teams.json")


def main() -> int:
    ap = argparse.ArgumentParser(description="Emit one viewing day (pro) or week (cfb) from mysports.* "
                                             "in the adapter fixture shape.")
    ap.add_argument("--sport", required=True, choices=["cfb", "nfl", "nhl", "nba", "mlb"])
    ap.add_argument("--date", help="viewing day, YYYY-MM-DD (pro sports)")
    ap.add_argument("--week", type=int, help="cfb week")
    ap.add_argument("--year", type=int, default=2026)
    ap.add_argument("--latest-week", action="store_true", help="print the newest loaded week for --sport and exit")
    ap.add_argument("--out", help="write here instead of the default artifacts/validation path")
    ap.add_argument("--teams-out", nargs="?", const="", metavar="PATH",
                    help="also write the renderer's teams file from the database (default path when "
                         "given no value) - lets a runner render without the adapter working directory")
    args = ap.parse_args()

    db = DB()
    try:
        if args.latest_week:
            w = latest_week(db, args.sport, args.year)
            if w is None:
                print(f"no loaded weeks for {args.sport} {args.year}", file=sys.stderr)
                return 1
            print(w)
            return 0
        if args.sport == "cfb":
            if args.week is None:
                print("ERROR: --week is required for cfb (or use --latest-week)", file=sys.stderr)
                return 2
            default = f"artifacts/validation/db_cfbd_{args.year}_week{args.week}_fixture.json"
        else:
            if not args.date:
                print(f"ERROR: --date is required for {args.sport}", file=sys.stderr)
                return 2
            default = f"artifacts/validation/db_{args.sport}_{args.year}_{args.date}_fixture.json"

        if args.teams_out is not None:
            tpath = Path(args.teams_out or teams_default_path(args.sport, args.year))
            rows = teams_rows(db, args.sport)
            dump_json(tpath, rows)
            print(f"db teams: {len(rows)} -> {tpath.as_posix()}")

        feed, by_day = build(db, args.sport, date=args.date, week=args.week, year=args.year)
        path = Path(args.out or default)
        dump_json(path, feed)
        print(f"db feed: {len(feed['games'])} games -> {path.as_posix()}")
        for day in sorted(by_day):
            print(f"  {day}: {by_day[day]} game(s)")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
