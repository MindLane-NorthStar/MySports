#!/usr/bin/env python3
"""MySports adapter — NBA (Milestone 8 part 2; spec §3.12 backbone `cdn.nba.com` with ESPN as cross-check).

Two sources, one fixture shape:

    python -m adapters.nba --date 2026-10-28                       # ESPN scoreboard (default source; verified live 2026-09-01)
    python -m adapters.nba --date 2026-10-28 --source league --from-file artifacts/validation/nba_scheduleLeagueV2.json

`--source league` reads the NBA's season file `scheduleLeagueV2.json`. The NBA CDN (Akamai) refuses datacenter
clients — Cowork's workspace gets 403 even with the nba.com Referer — so that path is exercised with a file Joe
saves from his own browser (research-nba.md §7 step 2), and its field names are the community-documented ones
(`leagueSchedule.gameDates[].games[]`, `broadcasters.{nationalBroadcasters,homeTvBroadcasters,awayTvBroadcasters}`),
marked UNVERIFIED in research-nba.md. The parser reports unknown shapes instead of guessing.

Team ids are `nba-{TRICODE}` (nba-CLE) so both sources agree on the id and the logo file name; ESPN's odd
abbreviations are mapped (NY→NYK, GS→GSW, SA→SAS, UTAH→UTA, NO→NOP, WSH→WAS).

Late-binding local carriage (spec §3.12): 28 of 30 clubs had no local rows in August. The market team (CLE) gets a
synthesized `CAVS LOCAL` row with carriageCertainty from data/local_rights.json (TBA_NO_RIGHTS_HOLDER as of
2026-08-31). A national exclusive (ESPN/ABC/NBC/Prime) suppresses the local row per spec §7.4 `suppresses_local_feed`.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from adapters.common import (access_lookup, dump_json, et_date, et_display, fetch_logos, find_repo_root, fixture_envelope,
                             http_json, load_data, load_raw_or_fetch, md_table, media_row, normalize_outlet, outlet_access,
                             team_record, write_text, now_et_iso, result_status, score_int)
from adapters.espn import fetch_scoreboard, fetch_teams, _odds, _broadcast_names

ESPN_TO_TRICODE = {"NY": "NYK", "GS": "GSW", "SA": "SAS", "UTAH": "UTA", "NO": "NOP", "WSH": "WAS"}
NATIONAL_EXCLUSIVE = {"ESPN", "ABC", "NBC", "Prime Video", "Peacock"}     # suppresses local feeds (spec §7.4)
NATIONAL_NON_EXCLUSIVE = {"NBA TV"}                                        # co-exists with local feeds
STREAM_ONLY = {"Peacock", "Prime Video", "ESPN+", "Netflix"}
LEAGUE_FILE = "https://cdn.nba.com/static/json/staticData/scheduleLeagueV2.json"


def tricode(espn_abbr: str) -> str:
    return ESPN_TO_TRICODE.get(espn_abbr, espn_abbr)


def build_teams(espn_teams: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out = []
    for e in espn_teams:
        tc = tricode(e["abbreviation"])
        out.append(team_record(f"nba-{tc}", e["school"], tc, None, "nba", e.get("color"), e.get("alternateColor"), e.get("logos") or [],
                               espnId=e.get("espnId"), espnAbbreviation=e["abbreviation"], location=e.get("location"), nickname=e.get("nickname")))
    return sorted(out, key=lambda r: r["school"])


def _local_row(side: dict[str, Any], carriage: dict[str, Any], start: str, tbd: bool,
               available: set[str] | list[str] = (), unavailable: set[str] | list[str] = ()) -> dict[str, Any]:
    ab = side["abbreviation"]
    cs = carriage.get(ab) or {}
    nick = side.get("team") or ab
    if cs.get("status") == "CONFIRMED" and cs.get("outlet"):
        # decision 7 (2026-09-01): Cavaliers on DAZN (RESN production) - a real service row, no CARRIER TBA plate
        return media_row("web" if cs.get("surface") == "web" else "tv", cs["outlet"],
                         outlet_access(cs["outlet"], available, unavailable), market="local", certainty="CONFIRMED",
                         start_time=start, tbd=tbd, source="data/local_rights.json",
                         label=cs.get("label") or f"{nick} on {cs['outlet']}")
    return media_row("tv", cs.get("label") or f"{ab} LOCAL", "AVAILABLE", market="local", certainty=cs.get("status", "UNANNOUNCED"),
                     start_time=start, tbd=tbd, source="data/local_rights.json", label=f"{nick} local TV - carrier TBA")


def simulcast_outlets(carriage: dict[str, Any], abbrev: str, other_ab: str, start: str) -> list[str]:
    """The OTA outlets carrying this game, from data/local_rights.json. Empty list when none.

    MATCHED ON ET DATE **AND** OPPONENT TRICODE, AND THE PAIR IS THE KEY. The 2026-09-15 announcement
    has DAL, DET and CHA twice each, so a matcher keyed on the tricode alone would put the December
    Detroit game's outlets on the March one. The date is what separates them, and the file says so too.

    THE OUTLET IS PER GAME SINCE THE ANNOUNCEMENT (prompt 104). It used to be one field on the package
    - `outlet: "WUAB 43"` - which could not express thirteen WOIO games, two WUAB-only and four on
    both. Nothing here reads that old field any more.
    """
    cs = carriage.get(abbrev) or {}
    sim = cs.get("simulcasts") or {}
    day = et_date(start)
    for g in sim.get("games", []):
        if g.get("date") == day and g.get("opponent") == other_ab:
            return list(g.get("outlets") or [])
    return []


def _simulcast_rows(side: dict[str, Any], carriage: dict[str, Any], other_ab: str, start: str, tbd: bool,
                    available: set[str] | list[str] = (), unavailable: set[str] | list[str] = ()) -> list[dict[str, Any]]:
    """Hand-entered OTA simulcast (decision 7): **ONE ROW PER OUTLET** (prompt 106, Joe 2026-09-16).

    IT EMITTED NOTHING UNTIL NOW, and that was deliberate rather than unfinished - prompt 104 landed
    the fifteen announced games and was scoped to stop before the row, because three things were
    undecided. Joe decided them on 2026-09-16 and this is what he ruled:

      * ONE ROW PER OUTLET, not one row carrying both. "Every network airing a Cavs game shows it on
        the grid", so a both-station game emits a CBS row AND a WUAB 43 row and appears three times on
        one grid with the DAZN lane - deliberate, not duplication. It is also the shape the callers
        already expect: they dedupe on `m["outlet"]`, one outlet at a time.
      * WOIO RESOLVES AS CBS, in `adapters/common.py`'s alias table - see the note there. The row's
        outlet is the resolved one, so `service_id` is CBS and the grid lane, the access lookup and
        the list card's mark all find it under a single name. WOIO stays out of access_profile.json.
      * AVAILABLE IF ANY OUTLET IS, which needs no special case: each row carries its own
        `outlet_access()`, so a game whose CBS row is AVAILABLE is available whatever DAZN says.
        Someone with an antenna and no subscription can watch it, and that falls out of the data
        rather than out of a rule in a component.

    THE LABEL KEEPS THE STATION. The row's service is CBS, but "WOIO simulcast" is what is true of
    the game, and the detail panel is where that sentence belongs.

    NATIONAL EXCLUSIVITY IS THE CALLERS' GATE, not this function's - both sites already compute
    `national_exclusive` for `_local_row` and now pass it here. None of the fifteen should collide,
    since the package IS the DAZN free games; one that does is a finding rather than a row.
    """
    rows = []
    for raw in simulcast_outlets(carriage, side["abbreviation"], other_ab, start):
        outlet = normalize_outlet(raw)
        rows.append(media_row("tv", outlet, outlet_access(outlet, available, unavailable),
                              market="local", certainty="CONFIRMED", start_time=start, tbd=tbd,
                              source="data/local_rights.json simulcasts",
                              label=f"{raw} simulcast"))
    return rows


# ----------------------------------------------------------------------------- ESPN source (verified)

def _status_scores(comp: dict[str, Any], sides: dict[str, Any]) -> dict[str, Any]:
    """ESPN status.type -> result_status + integer scores (competitors send '0' strings before tip)."""
    t = ((comp.get("status") or {}).get("type") or {})
    st = result_status(t.get("state"), detail=t.get("name") or "", context=f"nba {t.get('name')}")
    return {"status": st,
            "homeScore": score_int((sides.get("home") or {}).get("score"), st),
            "awayScore": score_int((sides.get("away") or {}).get("score"), st)}


def _league_status_scores(g: dict[str, Any]) -> dict[str, Any]:
    """cdn.nba.com league file (shape unverified - see the module note): gameStatusText is free text, so
    only the numeric gameStatus 1/2/3 is trusted; anything else leaves status null."""
    code = g.get("gameStatus")
    st = {1: "scheduled", 2: "in_progress", 3: "final"}.get(code)
    if st is None and code is not None:
        print(f"  warn: unrecognized league-file gameStatus {code!r} - result_status left null")
    return {"status": st, "homeScore": score_int((g.get("homeTeam") or {}).get("score"), st),
            "awayScore": score_int((g.get("awayTeam") or {}).get("score"), st)}


def build_from_espn(raw: dict[str, Any], root: Path, *, season: int, day_filter: str | None, teams: list[dict[str, Any]]) -> tuple[dict[str, Any], list[str]]:
    available, unavailable = access_lookup(root)
    local_abbrevs = set(load_data(root, "markets.json", {}).get("nba", {}).get("localTeams", ["CLE"]))
    carriage = load_data(root, "local_rights.json", {}).get("nba", {})
    by_id = {t["id"]: t for t in teams}
    notes, games = [], []
    for ev in raw.get("events", []):
        comp = (ev.get("competitions") or [{}])[0]
        start = comp.get("date") or ev.get("date")
        if day_filter and et_date(start) != day_filter:
            continue
        sides = {c["homeAway"]: c for c in comp.get("competitors", []) if c.get("homeAway")}
        if "home" not in sides or "away" not in sides:
            notes.append(f"event {ev.get('id')}: missing home/away, skipped"); continue

        def side(c):
            t = c["team"]; tc = tricode(t.get("abbreviation", ""))
            return {"id": f"nba-{tc}", "team": t.get("name") or t.get("shortDisplayName"), "teamFull": t.get("displayName"),
                    "location": t.get("location"), "abbreviation": tc, "conference": None, "classification": "nba"}

        home, away = side(sides["home"]), side(sides["away"])
        tbd = not bool(comp.get("timeValid", True))
        media = []
        for outlet, espn_mkt in _broadcast_names(comp):
            acc = outlet_access(outlet, available, unavailable)
            mtype = "web" if outlet in STREAM_ONLY else "tv"
            mk = "national"
            if espn_mkt in ("home", "away"):        # ESPN lists RSN feeds with market type Home/Away when it has them
                mk = "local"
                local_side = home if espn_mkt == "home" else away
                if local_side["abbreviation"] not in local_abbrevs:
                    acc = "OUT_OF_MARKET"
            media.append(media_row(mtype, outlet, acc, market=mk, certainty="CONFIRMED", start_time=start, tbd=tbd, source="espn.scoreboard"))
        national_exclusive = any(m["market"] == "national" and m["outlet"] in NATIONAL_EXCLUSIVE for m in media)
        for s in (home, away):
            if s["abbreviation"] not in local_abbrevs:
                continue
            other = away if s is home else home
            if not national_exclusive and not any(m["market"] == "local" and m["access"] == "AVAILABLE" for m in media):
                media.append(_local_row(s, carriage, start, tbd, available, unavailable))
            # ONE ROW PER OUTLET, and the dedupe is unchanged - it just runs per row now. A game the
            # league has taken exclusively national carries no OTA simulcast, so the gate matches
            # `_local_row`'s above rather than inventing a second rule.
            if not national_exclusive:
                for sim in _simulcast_rows(s, carriage, other["abbreviation"], start, tbd, available, unavailable):
                    if not any(m["outlet"] == sim["outlet"] for m in media):
                        media.append(sim)
        recs = {k: r.get("summary") for k, c in sides.items() for r in (c.get("records") or []) if r.get("type") == "total"}
        # GAME-ID DIVERGENCE (see adapters/nba.py's league-file path below, and
        # tests/test_nba_game_ids.py). This path mints nba-{espnEventId} - the 9-digit ESPN id. THIS
        # IS THE FORM THE DATABASE HOLDS and the form web/lib/livescores.js joins its live-score
        # overlay on. The league-file path uses NBA's own gameId instead; the two cannot be
        # reconciled because neither payload carries the other's id. Change the loader's source and
        # every NBA overlay join fails SILENTLY.
        games.append({"id": f"nba-{ev.get('id')}", "sport": "nba", "season": season, "week": None,
                      "startDate": start, "startTimeET": et_display(start), "startTimeTBD": tbd,
                      "neutralSite": bool(comp.get("neutralSite")), "venue": (comp.get("venue") or {}).get("fullName"),
                      "home": home, "away": away, "media": media, "odds": _odds(comp), "records": recs or None,
                      **_status_scores(comp, sides),
                      "flags": {"nationalExclusive": national_exclusive, "espnBroadcast": comp.get("broadcast"),
                                "seasonType": ((ev.get("season") or {}).get("type"))}})
    games.sort(key=lambda g: (g["startDate"] or "", g["id"]))
    return fixture_envelope("nba", season, None, games, source="espn.scoreboard", dayFilter=day_filter, market="Cleveland (DMA 510)",
                            localTeams=sorted(local_abbrevs)), notes


# ----------------------------------------------------------------------------- league file (UNVERIFIED shape; exercised via --from-file)
def build_from_league(raw: dict[str, Any], root: Path, *, season: int, day_filter: str | None, teams: list[dict[str, Any]]) -> tuple[dict[str, Any], list[str]]:
    available, unavailable = access_lookup(root)
    local_abbrevs = set(load_data(root, "markets.json", {}).get("nba", {}).get("localTeams", ["CLE"]))
    carriage = load_data(root, "local_rights.json", {}).get("nba", {})
    by_tc = {t["abbreviation"]: t for t in teams}
    notes, games = [], []
    ls = raw.get("leagueSchedule") or {}
    dates = ls.get("gameDates")
    if not isinstance(dates, list):
        notes.append(f"UNEXPECTED SHAPE: top-level keys {list(raw.keys())[:10]}; leagueSchedule keys {list(ls.keys())[:10]}")
        return fixture_envelope("nba", season, None, [], source="nba.schedule", dayFilter=day_filter, shapeError=True), notes
    unknown_keys: set[str] = set()
    for day in dates:
        for g in day.get("games", []):
            start = g.get("gameDateTimeUTC") or g.get("gameDateUTC")
            if not start:
                unknown_keys.update(g.keys()); continue
            if day_filter and et_date(start) != day_filter:
                continue

            def side(t):
                tc = t.get("teamTricode") or t.get("teamAbbreviation") or ""
                meta = by_tc.get(tc, {})
                return {"id": f"nba-{tc}", "team": t.get("teamName") or meta.get("nickname") or tc, "teamFull": f"{t.get('teamCity', '')} {t.get('teamName', '')}".strip() or meta.get("school"),
                        "location": t.get("teamCity"), "abbreviation": tc, "conference": None, "classification": "nba", "nbaTeamId": t.get("teamId")}

            home, away = side(g.get("homeTeam") or {}), side(g.get("awayTeam") or {})
            tbd = str(g.get("gameStatusText", "")).upper().find("TBD") >= 0 or g.get("gameStatus") == 0
            bc = g.get("broadcasters") or {}
            media = []
            for key, mk, feed in (("nationalBroadcasters", "national", None), ("nationalOttBroadcasters", "national", None),
                                  ("homeTvBroadcasters", "local", "home"), ("awayTvBroadcasters", "local", "away"),
                                  ("homeOttBroadcasters", "local", "home"), ("awayOttBroadcasters", "local", "away")):
                for b in bc.get(key) or []:
                    outlet = normalize_outlet(b.get("broadcasterDisplay") or b.get("broadcasterAbbreviation") or "")
                    if not outlet:
                        continue
                    acc = outlet_access(outlet, available, unavailable)
                    if mk == "local":
                        local_side = home if feed == "home" else away
                        if local_side["abbreviation"] not in local_abbrevs:
                            acc = "OUT_OF_MARKET"
                    mtype = "web" if ("Ott" in key or outlet in STREAM_ONLY) else "tv"
                    media.append(media_row(mtype, outlet, acc, market=mk, certainty="CONFIRMED", start_time=start, tbd=tbd,
                                           source="nba.schedule", label=b.get("broadcasterScope")))
            national_exclusive = any(m["market"] == "national" and m["outlet"] in NATIONAL_EXCLUSIVE for m in media)
            for s in (home, away):
                if s["abbreviation"] not in local_abbrevs:
                    continue
                other = away if s is home else home
                if not national_exclusive and not any(m["market"] == "local" and m["access"] == "AVAILABLE" for m in media):
                    media.append(_local_row(s, carriage, start, tbd, available, unavailable))
                # one row per outlet, same gate and same dedupe as the ESPN path above
                if not national_exclusive:
                    for sim in _simulcast_rows(s, carriage, other["abbreviation"], start, tbd, available, unavailable):
                        if not any(m["outlet"] == sim["outlet"] for m in media):
                            media.append(sim)
            # GAME-ID DIVERGENCE (see the ESPN path above, and tests/test_nba_game_ids.py). This
            # path mints nba-{nbaGameId} - the league's own 10-digit id, e.g. nba-0022600001 - which
            # is NOT what the database holds and NOT what web/lib/livescores.js joins on. Loading NBA
            # from this path would leave every NBA card without a live score and raise no error at
            # all. If this ever becomes the loader's source, the overlay's id mapping must move with it.
            games.append({"id": f"nba-{g.get('gameId')}", "sport": "nba", "season": season, "week": g.get("weekNumber"),
                          "startDate": start, "startTimeET": et_display(start), "startTimeTBD": tbd,
                          "neutralSite": bool(g.get("neutralSite")) if g.get("neutralSite") is not None else False,
                          "venue": g.get("arenaName"), "home": home, "away": away, "media": media, "odds": None, "records": None,
                          **_league_status_scores(g),
                          "flags": {"nationalExclusive": national_exclusive, "gameLabel": g.get("gameLabel"), "gameSubLabel": g.get("gameSubLabel"),
                                    "seriesText": g.get("seriesText"), "seasonYear": ls.get("seasonYear")}})
    if unknown_keys:
        notes.append(f"UNVERIFIED SHAPE: games without gameDateTimeUTC; keys seen: {sorted(unknown_keys)[:20]}")
    games.sort(key=lambda x: (x["startDate"] or "", x["id"]))
    return fixture_envelope("nba", season, None, games, source="nba.schedule", dayFilter=day_filter, market="Cleveland (DMA 510)",
                            localTeams=sorted(local_abbrevs)), notes


def report_md(fixture: dict[str, Any], notes: list[str]) -> str:
    v = fixture["validation"]; rows = []
    for g in fixture["games"]:
        outs = ", ".join(f"{m['outlet']}[{m['access'][:4]}{'/'+m['market'][:3] if m['market']!='national' else ''}{'/'+m['carriageCertainty'][:3] if m['carriageCertainty']!='CONFIRMED' else ''}]" for m in g["media"]) or "-"
        od = g.get("odds") or {}
        rows.append([f"{g['away']['abbreviation']} @ {g['home']['abbreviation']}", g["startTimeET"], outs, (od.get("details") or "") + (f" / O-U {od['overUnder']}" if od.get("overUnder") else "")])
    lines = [f"# NBA adapter report - {v.get('dayFilter') or 'season'} (source {v['source']})", "", f"- generated {v['generatedAt']}",
             f"- games: **{len(fixture['games'])}**; local teams: {', '.join(v.get('localTeams', []))}", "",
             md_table(["Game", "Start (ET)", "Media rows [access/market/certainty]", "Line"], rows), ""]
    if notes:
        lines += ["## Notes", ""] + [f"- {n}" for n in notes] + [""]
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--date", required=True, help="viewing day YYYY-MM-DD (ET)")
    ap.add_argument("--season", type=int, default=2026, help="season start year (2026 = 2026-27)")
    ap.add_argument("--source", choices=["espn", "league"], default="espn")
    ap.add_argument("--from-file", help="replay a saved raw payload (ESPN scoreboard or the league scheduleLeagueV2 file)")
    ap.add_argument("--no-logos", action="store_true")
    ap.add_argument("--all-logos", action="store_true", help="fetch logos for every team, not only this day's (season bootstrap)")
    ap.add_argument("--output-dir", default="artifacts/validation")
    args = ap.parse_args(argv)
    root = find_repo_root(); out_dir = root / args.output_dir
    espn_path = out_dir / "nba_espn_teams.json"; teams_path = out_dir / f"nba_{args.season}_teams.json"
    offline = bool(args.from_file)
    if offline and espn_path.exists():
        espn_teams = json.loads(espn_path.read_text(encoding="utf-8"))
    else:
        espn_teams = fetch_teams("nba"); dump_json(espn_path, espn_teams)
    teams = build_teams(espn_teams); dump_json(teams_path, teams)
    print(f"nba teams: {len(teams)} -> {teams_path.relative_to(root)}")
    if args.source == "espn":
        raw_path = out_dir / f"nba_{args.season}_{args.date}_raw.json"
        raw = load_raw_or_fetch(args.from_file, lambda: fetch_scoreboard("nba", date=args.date), raw_path)
        fixture, notes = build_from_espn(raw, root, season=args.season, day_filter=args.date, teams=teams)
    else:
        raw = load_raw_or_fetch(args.from_file, lambda: http_json(LEAGUE_FILE, headers={"Referer": "https://www.nba.com/", "Origin": "https://www.nba.com"}),
                                out_dir / "nba_scheduleLeagueV2.json")
        fixture, notes = build_from_league(raw, root, season=args.season, day_filter=args.date, teams=teams)
    fx_path = out_dir / f"nba_{args.season}_{args.date}_fixture.json"
    dump_json(fx_path, fixture); write_text(out_dir / f"nba_{args.season}_{args.date}_report.md", report_md(fixture, notes))
    print(f"fixture: {len(fixture['games'])} games -> {fx_path.relative_to(root)}")
    if not args.no_logos and not offline:
        needed = None if args.all_logos else {g[s]["id"] for g in fixture["games"] for s in ("home", "away")}
        print("logos:", fetch_logos(teams, root / "assets" / "logos", needed))
    for n in notes:
        print("  note:", n)
    return 0


if __name__ == "__main__":
    sys.exit(main())
