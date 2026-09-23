#!/usr/bin/env python3
"""MySports adapter — ESPN site API (NFL schedule backbone + shared enrichment layer, spec §3.12).

Unauthenticated. Two jobs:

1. NFL schedule for one viewing day / week -> renderer fixture.
       python -m adapters.espn --league nfl --date 2026-09-13
       python -m adapters.espn --league nfl --week 1 --season 2026
   Writes artifacts/validation/nfl_2026_week1_fixture.json (+ _raw.json, _report.md),
   artifacts/validation/nfl_2026_teams.json, assets/logos/nfl-{id}.png for teams in the fixture.

2. Team metadata for any ESPN league (colors, PNG logo URLs) used by the other pro adapters, written as
   {league}_espn_teams.json (adapters/nhl.py fetches this itself when online):
       python -m adapters.espn --league nhl --teams-only

Market-of-one (spec §3.12): ESPN marks nearly every CBS/FOX Sunday game "National", which is not the
truth for a viewer in Cleveland. SINCE PROMPT 117 (register §62) and PROMPT 118 (Joe's ruling
2026-09-23, register §63) a CBS/FOX TV row is decided by the first rule that applies, and `source`
names it: (1) a kickoff outside the Sunday 12:00-17:00 ET window is NATIONAL - Thanksgiving, Christmas,
Saturdays, international mornings, prime time; (2) a hand entry in data/market_coverage_nfl.json wins,
as a manual override; (3) a Browns game is AVAILABLE; (4) the affiliate's own listing (WOIO for CBS,
WJW for FOX, from Schedules Direct via adapters/sd_listings.py, read through MYSPORTS_NFL_LISTINGS -
DORMANT without its secrets, and it wins when present) has an NFL-game airing within 30 minutes of
kickoff - the same two teams is AVAILABLE, a different game is OUT_OF_MARKET, a game with no team
names is UNVERIFIED; (5) the station has listings for the date but no game in the window is
OUT_OF_MARKET; (4b) EntitledSports' weekly coverage page (adapters/es_windows.py, read through
MYSPORTS_NFL_WINDOWS) names the game in the row's window - early before 3:00 PM ET, late otherwise -
and the same two teams by nickname is AVAILABLE, different teams is OUT_OF_MARKET, and TBD or an
unrecognized marker falls through; (6) otherwise UNVERIFIED, and its source says neither source
decided the game. E5 stands: an UNVERIFIED game is always shown, with the "Market TBD" cue, never
filtered.

Verified against the live payload 2026-09-01 (events[].competitions[0].{date,timeValid,neutralSite,
competitors[].{homeAway,team{id,abbreviation,displayName,color,alternateColor,logo}},broadcasts[{market,names}],
geoBroadcasts[{type.shortName,market.type,media.shortName}],status.isTBDFlex,odds[{provider.name,details,
overUnder,spread,moneyline}]}).
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import timedelta
from pathlib import Path
from typing import Any

from adapters.common import (ET, access_lookup, clock, dump_json, et_date, et_display, fetch_logos, fixture_envelope,
                             hex6, http_json, load_data, load_raw_or_fetch, md_table, media_row, normalize_outlet,
                             outlet_access, parse_iso, team_record, write_text, now_et_iso, find_repo_root, result_status, score_int)

SITE = "https://site.api.espn.com/apis/site/v2/sports"
LEAGUE_PATH = {"nfl": "football/nfl", "nhl": "hockey/nhl", "nba": "basketball/nba", "mlb": "baseball/mlb",
               "cfb": "football/college-football"}
# ESPN outlet spellings seen in scoreboard payloads -> canonical names used by data/row_order.json
ESPN_OUTLETS = {"Prime Video": "Prime Video", "Amazon Prime": "Prime Video", "NFL Net": "NFL Network", "NFLN": "NFL Network",
                "ESPN/ABC": "ESPN", "ABC/ESPN": "ABC", "CBS/Paramount+": "CBS", "NBC/Peacock": "NBC", "Netflix": "Netflix",
                "YouTube": "YouTube", "YouTube TV": "YouTube"}
STREAM_ONLY = {"Prime Video", "Netflix", "YouTube", "Peacock", "ESPN+", "Paramount+", "HBO Max", "Disney+", "Hulu", "Apple TV"}
# a "Regional" feed in ESPN's vocabulary; treated as needing a market decision
REGIONAL_NETWORKS = {"CBS", "FOX"}
# the listings decide a row when a game airing starts within this many minutes of the kickoff
LISTING_WINDOW_MINUTES = 30
# the Sunday-afternoon regional window, ET: kickoffs at or after 12:00 and before 17:00
SUNDAY_WINDOW = (12, 17)
# rule 4b: a kickoff before this hour (ET) is in the early window, at or after it the late window
LATE_WINDOW_HOUR = 15


def sunday_afternoon_window(start_iso: str | None) -> bool:
    """Rule 1's test: is this kickoff inside the Sunday 12:00-17:00 ET regional window? Everything
    else a CBS or FOX row carries - Thanksgiving, Christmas, a December Saturday, a London morning,
    Sunday night - is a national telecast the regional rule never applied to."""
    dt = parse_iso(start_iso)
    if dt is None:
        return False
    et = dt.astimezone(ET)
    return et.weekday() == 6 and SUNDAY_WINDOW[0] <= et.hour < SUNDAY_WINDOW[1]


def nickname(name: str | None) -> str:
    """The team's nickname, lower-cased, for matching a listing's team names: "Carolina Panthers" ->
    "panthers". Nicknames are what tell the Los Angeles and New York pairs apart; cities do not."""
    return str(name or "").strip().split(" ")[-1].lower()


def _names_match(listing_teams: list[str], home_nick: str, away_nick: str) -> bool:
    nicks = {nickname(t) for t in listing_teams}
    return bool(home_nick) and bool(away_nick) and home_nick in nicks and away_nick in nicks


def load_listings(path: str | None = None) -> dict[str, Any] | None:
    """The station listings adapters/sd_listings.py wrote, from MYSPORTS_NFL_LISTINGS. None when the
    variable is unset or the file is absent - the listings step failing must leave today's behaviour."""
    p = path if path is not None else os.getenv("MYSPORTS_NFL_LISTINGS")
    if not p or not Path(p).exists():
        return None
    try:
        return json.loads(Path(p).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def listings_decision(listings: dict[str, Any] | None, station: str | None, start_iso: str | None,
                      home_nick: str, away_nick: str) -> tuple[str, str] | None:
    """Rules 4 and 5 against one station's listings. Returns (access, source), or None when the
    listings say nothing about that station on that date (rule 6 then applies)."""
    if not listings or not station:
        return None
    st = (listings.get("stations") or {}).get(station)
    kickoff = parse_iso(start_iso)
    if not st or kickoff is None:
        return None
    day = et_date(start_iso)
    airings = [a for a in st.get("airings") or [] if a.get("start") and et_date(a["start"]) == day]
    if not airings:
        return None   # no listings for that station and date
    window = timedelta(minutes=LISTING_WINDOW_MINUTES)
    games = [a for a in airings if a.get("isNflGame") and parse_iso(a["start"]) is not None
             and abs(parse_iso(a["start"]) - kickoff) <= window]
    if not games:
        return "OUT_OF_MARKET", f"listings: {station} carries no game in this window"
    a = min(games, key=lambda x: abs(parse_iso(x["start"]) - kickoff))
    when = clock(parse_iso(a["start"]).astimezone(ET))
    teams = a.get("teams") or []
    if not teams:
        return "UNVERIFIED", f"listings: {station} {day} {when} NFL game, teams not named"
    if _names_match(teams, home_nick, away_nick):
        return "AVAILABLE", f"listings: {station} {day} {when}"
    return "OUT_OF_MARKET", f"listings: {station} carries {' at '.join(teams[:2])} {day} {when}"


def load_windows(path: str | None = None) -> dict[str, Any] | None:
    """The coverage windows adapters/es_windows.py wrote, from MYSPORTS_NFL_WINDOWS. None when the
    variable is unset or the file is absent - a failed reader must leave today's behaviour."""
    p = path if path is not None else os.getenv("MYSPORTS_NFL_WINDOWS")
    if not p or not Path(p).exists():
        return None
    try:
        return json.loads(Path(p).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def windows_decision(windows: dict[str, Any] | None, network: str | None, week: Any, start_iso: str | None,
                     home_nick: str, away_nick: str) -> tuple[str, str] | None:
    """Rule 4b against EntitledSports' windows for the game's week. (access, source), or None when the
    window is TBD, unrecognized, or the file does not cover the week - rule 6 then applies."""
    if not windows or not network:
        return None
    wk = (windows.get("weeks") or {}).get(str(week))
    kickoff = parse_iso(start_iso)
    if not wk or kickoff is None:
        return None
    slot = "early" if kickoff.astimezone(ET).hour < LATE_WINDOW_HOUR else "late"
    w = next((x for x in wk.get("windows") or [] if x.get("network") == network and x.get("slot") == slot), None)
    if w is None or w.get("tbd") or not (w.get("home") and w.get("away")):
        return None
    away, home = w["away"], w["home"]
    call = str(w.get("station") or "").split(" ")[0] or network
    updated = str(wk.get("updated") or "unstamped").replace(",", "")
    src = f"entitledsports week {week} (updated {updated}): {call} {network} {slot} {away.get('abbr')} @ {home.get('abbr')}"
    teams = [f"{away.get('abbr')} {away.get('nick')}", f"{home.get('abbr')} {home.get('nick')}"]
    return ("AVAILABLE" if _names_match(teams, home_nick, away_nick) else "OUT_OF_MARKET"), src


def decide_regional(*, start_iso: str | None, is_local: bool, cov_game: dict[str, Any] | None, week: Any,
                    listings: dict[str, Any] | None, station: str | None, home_nick: str, away_nick: str,
                    windows: dict[str, Any] | None = None, network: str | None = None
                    ) -> tuple[str, str, str]:
    """A CBS or FOX TV row's (access, market, source), by the first rule that applies."""
    if not sunday_afternoon_window(start_iso):                                   # 1
        return "AVAILABLE", "national", "national window"
    if cov_game is not None:                                                     # 2
        return ("AVAILABLE" if cov_game.get("cleveland") else "OUT_OF_MARKET"), "regional", f"market_coverage_nfl.json week {week}"
    if is_local:                                                                 # 3
        return "AVAILABLE", "regional", "market: local team"
    got = listings_decision(listings, station, start_iso, home_nick, away_nick)  # 4 and 5: the listings win when present
    if got is not None:
        return got[0], "regional", got[1]
    got = windows_decision(windows, network, week, start_iso, home_nick, away_nick)   # 4b
    if got is not None:
        return got[0], "regional", got[1]
    return "UNVERIFIED", "regional", "regional feed - neither the station listing nor the coverage window decided this game"   # 6


# ----------------------------------------------------------------------------- teams
def fetch_teams(league: str, *, groups: tuple[int, ...] = (), limit: int = 100) -> list[dict[str, Any]]:
    """Team directory for one ESPN league.

    College football is the only league that needs paging: the directory is 760 schools and the endpoint
    caps a page at 500. Pages are walked until one comes back short.

    NOTE, verified live 2026-09-02: `/college-football/teams` IGNORES the `groups` parameter - groups 80
    (FBS) and 81 (FCS) return byte-identical payloads containing both. Both are still requested, and the
    union is deduplicated by ESPN id, so the call is correct whether or not ESPN starts honouring it.

    cfb keeps ESPN's bare integer id (CFBD ids ARE ESPN ids, and the rendering contract's fixtures are
    byte-compatible with integer cfb ids); every other league is namespaced `{league}-{id}`.
    """
    by_id: dict[str, dict[str, Any]] = {}
    for grp in (groups or (None,)):
        page = 1
        while True:
            params: dict[str, Any] = {"limit": limit, "page": page}
            if grp is not None:
                params["groups"] = grp
            data = http_json(f"{SITE}/{LEAGUE_PATH[league]}/teams", params=params)
            batch = data["sports"][0]["leagues"][0]["teams"]
            for t in batch:
                by_id[str(t["team"]["id"])] = t["team"]
            if len(batch) < limit:
                break
            page += 1
    out = []
    for team in by_id.values():
        logos = [l.get("href") for l in team.get("logos", []) if l.get("href")]
        out.append(team_record(
            str(team["id"]) if league == "cfb" else f"{league}-{team['id']}",
            team.get("displayName") or team.get("name"), team.get("abbreviation"),
            None, league, team.get("color"), team.get("alternateColor"), logos,
            espnId=str(team["id"]), location=team.get("location"), nickname=team.get("name"),
            shortDisplayName=team.get("shortDisplayName")))
    out.sort(key=lambda r: r["school"])
    return out


# ESPN groups 80 (FBS) and 81 (FCS); see the note in fetch_teams about the parameter being ignored.
CFB_GROUPS = (80, 81)


def fetch_cfb_directory() -> list[dict[str, Any]]:
    return fetch_teams("cfb", groups=CFB_GROUPS, limit=500)


def teams_by_abbrev(teams: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    return {t["abbreviation"]: t for t in teams if t.get("abbreviation")}


# ----------------------------------------------------------------------------- NFL scoreboard
def fetch_scoreboard(league: str, *, date: str | None = None, week: int | None = None, season: int | None = None,
                     season_type: int = 2) -> dict[str, Any]:
    params: dict[str, Any] = {"limit": 100}
    if date:
        params["dates"] = date.replace("-", "")
    if week is not None:
        params["week"] = week
        params["seasontype"] = season_type
        if season:
            params["dates"] = season
    return http_json(f"{SITE}/{LEAGUE_PATH[league]}/scoreboard", params=params)


def _odds(comp: dict[str, Any]) -> dict[str, Any] | None:
    for o in comp.get("odds") or []:
        prov = (o.get("provider") or {}).get("name") or "unknown"
        home_fav = ((o.get("homeTeamOdds") or {}).get("favorite"))
        ml = o.get("moneyline") or {}
        return {"provider": prov, "details": o.get("details"), "spread": o.get("spread"), "overUnder": o.get("overUnder"),
                "favorite": "home" if home_fav else ("away" if (o.get("awayTeamOdds") or {}).get("favorite") else None),
                "moneylineHome": (((ml.get("home") or {}).get("close") or {}).get("odds")),
                "moneylineAway": (((ml.get("away") or {}).get("close") or {}).get("odds")),
                "fetchedAt": now_et_iso()}
    return None


def _broadcast_names(comp: dict[str, Any]) -> list[tuple[str, str]]:
    """[(outlet, espn_market)] — geoBroadcasts first (typed), then the flat broadcasts list."""
    seen: list[tuple[str, str]] = []
    for gb in comp.get("geoBroadcasts") or []:
        if (gb.get("lang") or "en") != "en" or (gb.get("region") or "us") != "us":
            continue
        name = normalize_outlet(ESPN_OUTLETS.get((gb.get("media") or {}).get("shortName", ""), (gb.get("media") or {}).get("shortName", "")))
        mk = ((gb.get("market") or {}).get("type") or "National").lower()
        if name and (name, mk) not in seen:
            seen.append((name, mk))
    for b in comp.get("broadcasts") or []:
        mk = (b.get("market") or "national").lower()
        for n in b.get("names") or []:
            name = normalize_outlet(ESPN_OUTLETS.get(n, n))
            if name and all(name != s[0] for s in seen):
                seen.append((name, mk))
    return seen



def _status_scores(comp: dict[str, Any], sides: dict[str, Any]) -> dict[str, Any]:
    """ESPN status.type -> result_status + integer scores (competitors send '0' strings before kickoff)."""
    t = ((comp.get("status") or {}).get("type") or {})
    state, name, done = t.get("state"), t.get("name") or "", bool(t.get("completed"))
    if state == "post" and not done and "POSTPONE" not in name.upper() and "CANCEL" not in name.upper():
        print(f"  warn: ESPN state 'post' with completed=false ({name}) - result_status left null")
        st = None
    else:
        st = result_status(state, detail=name, context=f"espn {name}")
    return {"status": st,
            "homeScore": score_int((sides.get("home") or {}).get("score"), st),
            "awayScore": score_int((sides.get("away") or {}).get("score"), st)}


def build_nfl_fixture(raw: dict[str, Any], root: Path, *, season: int, week: int | None, day_filter: str | None,
                      teams: list[dict[str, Any]], listings: dict[str, Any] | None = None,
                      listings_path: str | None = None, windows: dict[str, Any] | None = None,
                      windows_path: str | None = None) -> tuple[dict[str, Any], list[str]]:
    available, unavailable = access_lookup(root)
    market = load_data(root, "markets.json", {}).get("nfl", {})
    local_abbrevs = set(market.get("localTeams", ["CLE"]))
    affiliates = market.get("affiliates") or {}           # {"CBS": "WOIO", "FOX": "WJW"}
    coverage = load_data(root, "market_coverage_nfl.json", {})
    if listings is None:
        listings = load_listings(listings_path)
    if windows is None:
        windows = load_windows(windows_path)
    notes: list[str] = []
    games: list[dict[str, Any]] = []
    for ev in raw.get("events", []):
        comp = (ev.get("competitions") or [{}])[0]
        start = comp.get("date") or ev.get("date")
        dt = parse_iso(start)
        if day_filter and (dt is None or et_date(start) != day_filter):
            continue
        sides = {c["homeAway"]: c for c in comp.get("competitors", []) if c.get("homeAway")}
        if "home" not in sides or "away" not in sides:
            notes.append(f"event {ev.get('id')}: missing home/away, skipped")
            continue

        def side(c: dict[str, Any]) -> dict[str, Any]:
            t = c["team"]
            # card name = nickname (contract cards are two lines of Barlow Condensed; "Cincinnati Bengals" does not fit a 1:00 block)
            return {"id": f"nfl-{t['id']}", "team": t.get("name") or t.get("shortDisplayName") or t.get("displayName"),
                    "teamFull": t.get("displayName"), "location": t.get("location"), "abbreviation": t.get("abbreviation"),
                    "conference": None, "classification": "nfl"}

        home, away = side(sides["home"]), side(sides["away"])
        time_tbd = not bool(comp.get("timeValid", True))
        is_local = home["abbreviation"] in local_abbrevs or away["abbreviation"] in local_abbrevs
        gid = str(ev.get("id"))
        cov = (coverage.get(str(week)) if week is not None else None) or {}
        cov_game = cov.get("games", {}).get(gid) or cov.get("games", {}).get(f"{away['abbreviation']}@{home['abbreviation']}")

        media = []
        for outlet, espn_mkt in _broadcast_names(comp):
            acc = outlet_access(outlet, available, unavailable)
            mtype = "web" if outlet in STREAM_ONLY else "tv"
            mk, cert, src = "national", "CONFIRMED", "espn.scoreboard"
            if outlet in REGIONAL_NETWORKS and mtype == "tv":
                # Sunday-afternoon CBS/FOX windows are regional whatever ESPN's market flag says (§3.12);
                # the six rules (prompt 117) decide the row, and `source` says which one did.
                acc, mk, src = decide_regional(
                    start_iso=start, is_local=is_local, cov_game=cov_game, week=(ev.get("week") or {}).get("number", week),
                    listings=listings, station=affiliates.get(outlet), home_nick=nickname(home["team"]), away_nick=nickname(away["team"]),
                    windows=windows, network=outlet)
            media.append(media_row(mtype, outlet, acc, market=mk, certainty=cert, start_time=start, tbd=time_tbd, source=src))
        if not media:
            notes.append(f"{away['abbreviation']}@{home['abbreviation']}: no broadcast rows in payload")

        recs = {}
        for k, c in sides.items():
            for r in c.get("records") or []:
                if r.get("type") == "total":
                    recs[k] = r.get("summary")
        games.append({
            "id": f"nfl-{gid}", "sport": "nfl", "season": season,
            "week": (ev.get("week") or {}).get("number", week),
            "startDate": start, "startTimeET": et_display(start), "startTimeTBD": time_tbd,
            "neutralSite": bool(comp.get("neutralSite")),
            "venue": (comp.get("venue") or {}).get("fullName"),
            "home": home, "away": away, "media": media,
            "odds": _odds(comp), "records": recs or None,
            **_status_scores(comp, sides),
            "flags": {"isTBDFlex": bool((comp.get("status") or {}).get("isTBDFlex")),
                      "espnBroadcast": comp.get("broadcast")},
        })
    games.sort(key=lambda g: (g["startDate"] or "", g["id"]))
    fixture = fixture_envelope("nfl", season, week, games, source="espn.scoreboard", dayFilter=day_filter,
                               market="Cleveland (DMA 510)", coverageFile="data/market_coverage_nfl.json")
    return fixture, notes


def report_md(fixture: dict[str, Any], notes: list[str], teams_missing: list[str]) -> str:
    v = fixture["validation"]
    rows = []
    for g in fixture["games"]:
        outs = ", ".join(f"{m['outlet']}[{m['access'][:4]}{'/'+m['market'][:3] if m['market']!='national' else ''}]" for m in g["media"]) or "-"
        od = g.get("odds") or {}
        rows.append([f"{g['away']['abbreviation']} @ {g['home']['abbreviation']}", g["startTimeET"], "YES" if g["startTimeTBD"] else "",
                     outs, (od.get("details") or "") + (f" / O-U {od['overUnder']}" if od.get("overUnder") else ""),
                     "flex" if g["flags"].get("isTBDFlex") else ""])
    lines = [f"# ESPN NFL adapter report - season {v['year']} week {v['week']} (day filter: {v.get('dayFilter') or 'none'})", "",
             f"- generated {v['generatedAt']}", f"- games in fixture: **{len(fixture['games'])}**",
             f"- market: {v['market']} - regional CBS/FOX rows resolved by `{v['coverageFile']}`", "",
             md_table(["Game", "Start (ET)", "Time TBD", "Media rows [access/market]", "Line", "Flex"], rows), ""]
    unverified = [g for g in fixture["games"] if any(m["access"] == "UNVERIFIED" for m in g["media"])]
    if unverified:
        lines += [f"## Regional games awaiting a Cleveland coverage entry ({len(unverified)})", "",
                  "The station listings (adapters/sd_listings.py) decide these once they cover the date; a hand entry in `data/market_coverage_nfl.json` under this week (`\"cleveland\": true|false`) overrides them.", ""]
        lines += [f"- `{g['id'][4:]}` {g['away']['abbreviation']}@{g['home']['abbreviation']} - {g['startTimeET']}" for g in unverified]
        lines.append("")
    if teams_missing:
        lines += ["## Teams without metadata", ""] + [f"- {t}" for t in teams_missing] + [""]
    if notes:
        lines += ["## Notes", ""] + [f"- {n}" for n in notes] + [""]
    return "\n".join(lines)


# ----------------------------------------------------------------------------- cli
def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--league", default="nfl", choices=sorted(LEAGUE_PATH))
    ap.add_argument("--date", help="viewing day YYYY-MM-DD (ET); fixture holds only that day's games")
    ap.add_argument("--week", type=int, help="NFL week (regular season); fixture holds the whole week")
    ap.add_argument("--season", type=int, default=2026)
    ap.add_argument("--teams-only", action="store_true", help="only refresh {league}_{season}_teams.json and logos")
    ap.add_argument("--from-file", help="replay a saved raw scoreboard payload instead of fetching")
    ap.add_argument("--no-logos", action="store_true")
    ap.add_argument("--output-dir", default="artifacts/validation")
    args = ap.parse_args(argv)

    root = find_repo_root()
    out_dir = root / args.output_dir
    # NFL teams are keyed nfl-{espnId} and are the renderer's teams file. Other leagues key their own ids
    # (nhl-{nhlId}); their ESPN colors/logos are a side file joined by abbreviation, and no logo is written here.
    teams_path = out_dir / (f"nfl_{args.season}_teams.json" if args.league == "nfl" else f"{args.league}_espn_teams.json")
    if args.from_file and teams_path.exists():   # offline replay: reuse the cached teams file
        teams = json.loads(teams_path.read_text(encoding="utf-8"))
    else:
        teams = fetch_cfb_directory() if args.league == "cfb" else fetch_teams(args.league)
        dump_json(teams_path, teams)
    print(f"{args.league} teams: {len(teams)} -> {teams_path.relative_to(root)}")
    if args.teams_only or args.league != "nfl":
        if not args.no_logos and args.league == "nfl":
            print("logos:", fetch_logos(teams, root / "assets" / "logos"))
        return 0

    if not args.date and args.week is None:
        print("ERROR: --date or --week required for the NFL schedule", file=sys.stderr)
        return 2
    week = args.week
    raw_path = out_dir / (f"nfl_{args.season}_week{week}_raw.json" if week is not None else f"nfl_{args.season}_{args.date}_raw.json")
    raw = load_raw_or_fetch(args.from_file, lambda: fetch_scoreboard("nfl", date=args.date if week is None else None, week=week,
                                                                    season=args.season), raw_path)
    if week is None:
        wk = None
        for ev in raw.get("events", []):
            wk = (ev.get("week") or {}).get("number")
            if wk is not None:
                break
        week = wk
    fixture, notes = build_nfl_fixture(raw, root, season=args.season, week=week, day_filter=args.date, teams=teams)
    key = f"week{week}" if args.date is None else args.date
    fx_path = out_dir / f"nfl_{args.season}_{key}_fixture.json"
    dump_json(fx_path, fixture)
    by_id = {t["id"]: t for t in teams}
    needed = {g[s]["id"] for g in fixture["games"] for s in ("home", "away")}
    missing = sorted(i for i in needed if i not in by_id)
    write_text(out_dir / f"nfl_{args.season}_{key}_report.md", report_md(fixture, notes, missing))
    print(f"fixture: {len(fixture['games'])} games -> {fx_path.relative_to(root)}")
    if not args.no_logos:
        print("logos:", fetch_logos(teams, root / "assets" / "logos", needed))
    for n in notes:
        print("  note:", n)
    return 0


if __name__ == "__main__":
    sys.exit(main())
