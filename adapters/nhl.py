#!/usr/bin/env python3
"""MySports adapter — NHL (api-web.nhle.com, unauthenticated; spec §3.12 backbone for `nhl`).

    python -m adapters.nhl --date 2026-10-01            # the 7-day schedule window starting that date
    python -m adapters.nhl --date 2026-10-01 --from-file artifacts/validation/nhl_2026_2026-10-01_raw.json

Writes artifacts/validation/nhl_2026_{date}_fixture.json (+ _raw.json, _report.md) and
artifacts/validation/nhl_2026_teams.json (NHL ids + names, colors/PNG logos joined from ESPN's team
endpoint — the league API only offers SVG marks and no colors). Logos land in assets/logos/nhl-{id}.png.

Late-binding local carriage (spec §3.12): the league schedule carries no local TV rows in August/September
for almost every team. For the market's territory team (postal-lookup -> Columbus Blue Jackets for the
Cleveland market) every game gets a synthesized local row:
    outlet "Blue Jackets local TV", market "local", access AVAILABLE,
    carriageCertainty TBA_NO_RIGHTS_HOLDER (data/local_rights.json) or UNANNOUNCED
which the renderer draws as a "LOCAL - CARRIER TBA" row. An empty tvBroadcasts list is never "no telecast".

Verified against the live payload 2026-09-01: /v1/schedule/{date} -> {nextStartDate, previousStartDate,
gameWeek[{date, numberOfGames, games[{id, season, gameType, gameDate, venue{default}, neutralSite,
startTimeUTC, easternUTCOffset, gameState, gameScheduleState, tvBroadcasts[{id, market, countryCode,
network, sequenceNumber}], awayTeam{id, abbrev, placeName{default}, commonName{default}, logo, darkLogo},
homeTeam{...}}]}]}; /v1/postal-lookup/{zip} -> [{teamName{default}, county, stateProvince, ...}].
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from adapters.common import (access_lookup, dump_json, et_date, et_display, fetch_logos, find_repo_root, fixture_envelope,
                             http_json, load_data, load_raw_or_fetch, md_table, media_row, normalize_outlet, outlet_access,
                             team_record, write_text, result_status, score_int)

API = "https://api-web.nhle.com/v1"
# NHL abbreviations that differ from ESPN's TEAMS endpoint (/hockey/nhl/teams), which is what
# build_teams() joins against for colours and PNG logos.
NHL_TO_ESPN = {"LAK": "LA", "NJD": "NJ", "TBL": "TB", "SJS": "SJ", "UTA": "UTAH"}

# THE SAME QUESTION ASKED OF A DIFFERENT ENDPOINT, AND IT HAS A DIFFERENT ANSWER (prompt 57 stage 2).
#
# ESPN's SCOREBOARD spells Utah `UTA`; its TEAMS endpoint spells it `UTAH`. The NHL spells it `UTA`.
# So Utah needs translating for the teams join and MUST NOT be translated for the scoreboard join -
# `NHL_TO_ESPN` applied here would turn `UTA` into `UTAH`, match no event, and drop every Utah game
# with no error at all. That is the exact failure `adapters/nba.py`'s game-id note warns about,
# arriving through a different door.
#
# MEASURED 2026-09-07, both sides, 32 clubs each:
#   NHL not in ESPN scoreboard : LAK, NJD, SJS, TBL
#   ESPN scoreboard not in NHL : LA,  NJ,  SJ,  TB
# Four divergences, not five. `UTA` appears in both sets and needs no entry.
#
# The two maps are asserted against each other in tests/test_nhl_odds.py, so if ESPN ever changes
# either spelling the gate fails instead of the schedule quietly losing a club.
NHL_TO_ESPN_SCOREBOARD = {"LAK": "LA", "NJD": "NJ", "TBL": "TB", "SJS": "SJ"}
# NHL broadcast `market` codes: N = national, A = away-team local, H = home-team local
NHL_MARKET = {"N": "national", "A": "local", "H": "local"}
CANADIAN = {"Sportsnet", "SN", "SNP", "SNO", "SNE", "SNW", "TVA Sports", "TVAS", "CBC", "Sportsnet+", "Prime Video (CA)"}
GAME_TYPE = {1: "preseason", 2: "regular", 3: "playoffs"}


def fetch_week(date: str) -> dict[str, Any]:
    return http_json(f"{API}/schedule/{date}")


def fetch_postal(zip_code: str) -> list[dict[str, Any]]:
    return http_json(f"{API}/postal-lookup/{zip_code}")


def fetch_club_season(abbrev: str) -> dict[str, Any]:
    """One club's full-season schedule (/v1/club-schedule-season/{abbrev}/now): 80+ games whose home/away
    objects carry every other club's id, abbrev, placeName, commonName and SVG logos — the only offseason-safe
    way to list all 32 teams with NHL ids on this host (standings/now has names but no ids). Verified 2026-09-01:
    {clubTimezone, clubUTCOffset, currentSeason, previousSeason, games[{id, ..., homeTeam{id, abbrev, placeName,
    commonName, logo, darkLogo, ...}, awayTeam{...}}]}."""
    return http_json(f"{API}/club-schedule-season/{abbrev}/now")


def fetch_standings_teams() -> list[dict[str, Any]]:
    """Team list with divisions from standings/now (works in the offseason too)."""
    data = http_json(f"{API}/standings/now")
    out = []
    for s in data.get("standings", []):
        out.append({"abbrev": s.get("teamAbbrev", {}).get("default"), "name": s.get("teamName", {}).get("default"),
                    "common": s.get("teamCommonName", {}).get("default"), "place": s.get("placeName", {}).get("default"),
                    "division": s.get("divisionName"), "conference": s.get("conferenceName"), "logo": s.get("teamLogo")})
    return out


def build_teams(raw_weeks: list[dict[str, Any]], espn_teams: list[dict[str, Any]], standings: list[dict[str, Any]] | None) -> list[dict[str, Any]]:
    """NHL-id-keyed team records with ESPN colors/PNG logos joined by abbreviation."""
    espn_by = {t["abbreviation"]: t for t in espn_teams}
    div_by = {s["abbrev"]: s for s in (standings or [])}
    seen: dict[str, dict[str, Any]] = {}
    for wk in raw_weeks:
        for day in wk.get("gameWeek", []):
            for g in day.get("games", []):
                for side in ("homeTeam", "awayTeam"):
                    t = g[side]
                    ab = t.get("abbrev")
                    tid = f"nhl-{t['id']}"
                    if tid in seen:
                        continue
                    e = espn_by.get(NHL_TO_ESPN.get(ab, ab)) or {}
                    st = div_by.get(ab) or {}
                    name = f"{(t.get('placeName') or {}).get('default', '')} {(t.get('commonName') or {}).get('default', '')}".strip() or e.get("school") or ab
                    logos = list(e.get("logos") or [])   # ESPN PNGs only — `logos[0]` is what fetch_logos writes to assets/logos/{id}.png
                    if not logos:
                        print(f"  warn: no ESPN color/logo match for {ab} (NHL id {t['id']}) - card renders in gray, no logo")
                    seen[tid] = team_record(tid, name, ab, st.get("division"), "nhl", e.get("color"), e.get("alternateColor"), logos,
                                            nhlId=str(t["id"]), espnId=e.get("espnId"), nhlConference=st.get("conference"),
                                            espnAbbreviation=e.get("abbreviation"),
                                            location=(t.get("placeName") or {}).get("default"), nickname=(t.get("commonName") or {}).get("default"),
                                            svgLogo=t.get("logo"), svgLogoDark=t.get("darkLogo"))   # league SVG marks for the asset pipeline
    return sorted(seen.values(), key=lambda r: r["school"])



def _status_scores(g: dict[str, Any]) -> dict[str, Any]:
    """NHL gameState -> result_status + scores (homeTeam/awayTeam carry them once play starts)."""
    st = result_status(g.get("gameState"), context=f"nhl {g.get('id')}")
    return {"status": st,
            "homeScore": score_int((g.get("homeTeam") or {}).get("score"), st),
            "awayScore": score_int((g.get("awayTeam") or {}).get("score"), st)}

def espn_abbrev(nhl_abbrev: str | None) -> str | None:
    """NHL club abbreviation -> the spelling ESPN's SCOREBOARD uses. Identity for the other 28."""
    if not nhl_abbrev:
        return None
    return NHL_TO_ESPN_SCOREBOARD.get(nhl_abbrev, nhl_abbrev)


def fetch_espn_odds(dates: list[str]) -> dict[tuple[str, str, str], dict[str, Any]]:
    """{(ET date, away ESPN abbrev, home ESPN abbrev): odds} for every priced game on those dates.

    WHY NOT JOIN ON IDS. `adapters/nba.py` documents the trap in this codebase: ESPN's event ids are
    not the league API's, and a loader that joins on them "would leave every NBA card without a live
    score and raise no error at all." The same is true here, so the key is the one thing both APIs
    agree on - who is playing, and when.

    THE KEY IS UNIQUE because no NHL club plays twice in a day, and it is THREE fields rather than
    one because working rule 18 wants a second key cross-checked: a match on one abbreviation is not
    a match. A game is joined only when the date and BOTH clubs agree.

    NO NEW PARSING. `_odds()` in adapters/espn.py already reads the exact DraftKings block ESPN
    returns for the NHL - the same one it reads for the NFL and NBA - and `LEAGUE_PATH` already maps
    "nhl" to "hockey/nhl". Verified live 2026-09-07: dates=20261001 returned 8 events, 8 of 8 priced.

    ZERO ODDS ON A FAR-OUT DATE IS NOT A FAILURE. Books post NHL lines as the game approaches;
    measured the same day, 2026-10-15 (11 events) and 2026-11-10 (7 events) both returned none. The
    rolling 7-day window sits inside the horizon where they do appear, so a line lands on the second
    or third visit to a game rather than the first.
    """
    from adapters.espn import fetch_scoreboard, _odds

    out: dict[tuple[str, str, str], dict[str, Any] | None] = {}
    for d in sorted({x for x in dates if x}):
        board = fetch_scoreboard("nhl", date=d)
        for ev in board.get("events") or []:
            comp = (ev.get("competitions") or [{}])[0]
            sides = {c.get("homeAway"): ((c.get("team") or {}).get("abbreviation"))
                     for c in (comp.get("competitors") or [])}
            away, home = sides.get("away"), sides.get("home")
            # ET on BOTH sides of the join, through the repo's own converter - an ESPN event stamped
            # 2026-10-02T02:00Z is a 2026-10-01 game in Cleveland, and keying it on the UTC date
            # would miss every late start.
            key_date = et_date(ev.get("date"))
            if not (away and home and key_date):
                continue
            # EVERY event is recorded, priced or not, and that is the point. A map of only-priced
            # events cannot tell "ESPN has no line yet" (normal, and the majority - 25 of 47 in the
            # measured window) from "the join broke" (the silent failure this whole stage exists to
            # prevent). With every event present, a MISSING KEY is the alarm and a None VALUE is the
            # ordinary case.
            out[(key_date, away, home)] = _odds(comp)
    return out


def build_fixture(raw: dict[str, Any], root: Path, *, season: int, anchor_date: str,
                  teams: list[dict[str, Any]],
                  espn_odds: dict[tuple[str, str, str], dict[str, Any]] | None = None,
                  ) -> tuple[dict[str, Any], list[str]]:
    # DEFAULTS TO EMPTY, deliberately: an offline run, a fixture rebuilt --from-file, and every
    # existing test all call this without odds and must keep producing exactly what they did.
    espn_odds = espn_odds or {}
    odds_stats = {"priced": 0, "unpriced": 0, "unjoined": []}
    available, unavailable = access_lookup(root)
    market = load_data(root, "markets.json", {}).get("nhl", {})
    local_abbrevs = set(market.get("localTeams", ["CBJ"]))
    carriage = load_data(root, "local_rights.json", {}).get("nhl", {})
    by_id = {t["id"]: t for t in teams}
    notes: list[str] = []
    games: list[dict[str, Any]] = []
    for day in raw.get("gameWeek", []):
        for g in day.get("games", []):
            gid = f"nhl-{g['id']}"
            start = g.get("startTimeUTC")
            tbd = (g.get("gameScheduleState") or "OK") != "OK" or not start

            def side(t: dict[str, Any]) -> dict[str, Any]:
                tid = f"nhl-{t['id']}"
                meta = by_id.get(tid, {})
                # card name = nickname ("Blue Jackets"); the full name rides along for the web app / search
                return {"id": tid, "team": (t.get("commonName") or {}).get("default") or meta.get("school") or t.get("abbrev"),
                        "teamFull": meta.get("school"), "location": (t.get("placeName") or {}).get("default"),
                        "abbreviation": t.get("abbrev"), "conference": meta.get("conference"), "classification": "nhl"}

            home, away = side(g["homeTeam"]), side(g["awayTeam"])
            media = []
            for b in g.get("tvBroadcasts") or []:
                if (b.get("countryCode") or "US") != "US":
                    continue
                outlet = normalize_outlet(b.get("network"))
                if outlet in CANADIAN:
                    continue
                mk = NHL_MARKET.get(b.get("market", "N"), "national")
                acc = outlet_access(outlet, available, unavailable)
                mtype = "web" if outlet in {"ESPN+", "Hulu", "Disney+", "Prime Video", "Peacock", "HBO Max"} else "tv"
                if mk == "local":
                    # the league lists BOTH clubs' RSNs; only the market's own team's local feed is receivable
                    local_side = home if b.get("market") == "H" else away
                    if local_side["abbreviation"] not in local_abbrevs:
                        acc = "OUT_OF_MARKET"
                media.append(media_row(mtype, outlet, acc, market=mk, certainty="CONFIRMED", start_time=start, tbd=tbd,
                                       source="nhl.schedule", label=f"{b.get('network')}"))
            # synthesized late-binding local row for the territory team (spec §3.12)
            for s in (home, away):
                ab = s["abbreviation"]
                if ab in local_abbrevs and not any(m["market"] == "local" and m["access"] == "AVAILABLE" for m in media):
                    cs = carriage.get(ab) or {}
                    cert = cs.get("status", "UNANNOUNCED")
                    nick = by_id.get(s["id"], {}).get("nickname") or s.get("team") or ab
                    # A CONFIRMED CARRIER IS A REAL SERVICE ROW, not a CARRIER TBA plate.
                    #
                    # THIS BRANCH DID NOT EXIST UNTIL PROMPT 72, and its absence was the actual bug.
                    # `adapters/nba.py:_local_row` has had it since decision 7 (the Cavaliers' move to
                    # DAZN), so the NBA side could retire a placeholder and this one could not: whatever
                    # `local_rights.json` said, the NHL row was always minted from `label` and always
                    # came out as the placeholder outlet. Joe reported the Blue Jackets as available on
                    # Prime Video and the file was updated - and without this, the file would have said
                    # CONFIRMED while the adapter kept emitting `CBJ LOCAL`, which is the shape of a
                    # data fix that silently does nothing.
                    #
                    # `outlet_access` decides availability from data/access_profile.json rather than
                    # hardcoding AVAILABLE, which is what the placeholder branch below has to do
                    # because a carrier nobody has named cannot be looked up.
                    if cert == "CONFIRMED" and cs.get("outlet"):
                        media.append(media_row("web" if cs.get("surface") == "web" else "tv", cs["outlet"],
                                               outlet_access(cs["outlet"], available, unavailable),
                                               market="local", certainty="CONFIRMED", start_time=start, tbd=tbd,
                                               source="data/local_rights.json",
                                               label=cs.get("label") or f"{nick} on {cs['outlet']}"))
                        continue
                    media.append(media_row("tv", cs.get("label") or f"{ab} LOCAL", "AVAILABLE", market="local", certainty=cert,
                                           start_time=start, tbd=tbd, source="data/local_rights.json",
                                           label=f"{nick} local TV - carrier TBA"))
            if not media:
                notes.append(f"{et_date(start)}: {away['abbreviation']}@{home['abbreviation']} no US broadcast rows")
            # THE ODDS JOIN. A game with no ESPN match is not an error - it is logged, counted and
            # left alone. `odds` stays None rather than being partially filled, because a half-built
            # line on a card is worse than an empty slot: the slot says "not known", a wrong number
            # says "known" and is believed.
            okey = (et_date(start), espn_abbrev(away["abbreviation"]), espn_abbrev(home["abbreviation"]))
            odds = espn_odds.get(okey)
            if espn_odds:
                if okey not in espn_odds:
                    # THE ALARM. ESPN had no event for this date and this pair of abbreviations at
                    # all, which means the join is wrong - not that the book is slow. Measured
                    # 2026-09-07 on the 2026-10-01 window this was 0 of 47.
                    odds_stats["unjoined"].append(f"{okey[0]} {okey[1]}@{okey[2]}")
                elif odds:
                    odds_stats["priced"] += 1
                else:
                    odds_stats["unpriced"] += 1
            games.append({
                "id": gid, "sport": "nhl", "season": season, "week": None,
                "startDate": start, "startTimeET": et_display(start), "startTimeTBD": tbd,
                "neutralSite": bool(g.get("neutralSite")),
                "venue": (g.get("venue") or {}).get("default"),
                "home": home, "away": away, "media": media,
                **_status_scores(g),
                "odds": odds, "records": None,
                "flags": {"gameType": GAME_TYPE.get(g.get("gameType"), str(g.get("gameType"))),
                          "gameState": g.get("gameState"), "gameScheduleState": g.get("gameScheduleState"),
                          "nhlSeason": g.get("season")},
            })
    games.sort(key=lambda x: (x["startDate"] or "", x["id"]))
    fixture = fixture_envelope("nhl", season, None, games, source="nhl.schedule", anchorDate=anchor_date,
                               window=[d.get("date") for d in raw.get("gameWeek", [])], market="Cleveland (DMA 510)",
                               localTeams=sorted(local_abbrevs))
    if espn_odds:
        joined = odds_stats["priced"] + odds_stats["unpriced"]
        print(f"  odds: {joined}/{len(games)} joined to an ESPN event, "
              f"{odds_stats['priced']} priced, {odds_stats['unpriced']} not priced yet")
        for u in odds_stats["unjoined"]:
            notes.append(f"{u}: NO ESPN EVENT - the abbreviation join may be wrong")
        if odds_stats["unjoined"]:
            print(f"  WARN: {len(odds_stats['unjoined'])} game(s) matched no ESPN event at all - see report")
    return fixture, notes


def report_md(fixture: dict[str, Any], notes: list[str], postal: Any) -> str:
    v = fixture["validation"]
    rows = []
    for g in fixture["games"]:
        outs = ", ".join(f"{m['outlet']}[{m['access'][:4]}{'/'+m['market'][:3] if m['market']!='national' else ''}"
                         f"{'/'+m['carriageCertainty'][:3] if m['carriageCertainty']!='CONFIRMED' else ''}]" for m in g["media"]) or "-"
        rows.append([f"{g['away']['abbreviation']} @ {g['home']['abbreviation']}", g["startTimeET"], g["flags"]["gameType"], outs])
    n_nat = sum(1 for g in fixture["games"] if any(m["market"] == "national" for m in g["media"]))
    lines = [f"# NHL adapter report - window {v['window'][0] if v['window'] else '?'} .. {v['window'][-1] if v['window'] else '?'}", "",
             f"- generated {v['generatedAt']}", f"- games: **{len(fixture['games'])}** ({n_nat} with a US national row)",
             f"- local teams (market {v['market']}): {', '.join(v['localTeams'])}",
             f"- postal-lookup: {json.dumps(postal, ensure_ascii=False)[:300] if postal else 'not run'}", "",
             md_table(["Game", "Start (ET)", "Type", "Media rows [access/market/certainty]"], rows), ""]
    if notes:
        lines += ["## Notes", ""] + [f"- {n}" for n in notes] + [""]
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--date", required=True, help="window start YYYY-MM-DD (the API returns 7 days)")
    ap.add_argument("--season", type=int, default=2026, help="season start year (2026 = 2026-27)")
    ap.add_argument("--from-file", help="replay a saved raw /schedule payload")
    ap.add_argument("--postal", help="ZIP for /postal-lookup territory check (default from data/markets.json)")
    ap.add_argument("--no-logos", action="store_true")
    ap.add_argument("--all-logos", action="store_true", help="fetch logos for every team, not only this window's (season bootstrap)")
    ap.add_argument("--output-dir", default="artifacts/validation")
    args = ap.parse_args(argv)

    root = find_repo_root()
    out_dir = root / args.output_dir
    raw_path = out_dir / f"nhl_{args.season}_{args.date}_raw.json"
    raw = load_raw_or_fetch(args.from_file, lambda: fetch_week(args.date), raw_path)

    espn_path = out_dir / "nhl_espn_teams.json"
    teams_path = out_dir / f"nhl_{args.season}_teams.json"
    offline = bool(args.from_file)
    if offline and espn_path.exists():
        espn_teams = json.loads(espn_path.read_text(encoding="utf-8"))
    elif offline:
        espn_teams = []
    else:
        from adapters.espn import fetch_teams
        espn_teams = fetch_teams("nhl")
        dump_json(espn_path, espn_teams)
    standings = None if offline else _safe(fetch_standings_teams)
    prior = json.loads(teams_path.read_text(encoding="utf-8")) if teams_path.exists() else []
    # full team directory from one club's season schedule, so a fresh runner in the offseason (empty
    # schedule window) still writes all 32 teams; the window's own games are merged on top
    club = (load_data(root, "markets.json", {}).get("nhl", {}).get("localTeams") or ["CBJ"])[0]
    season_sched = None if offline else _safe(lambda: fetch_club_season(club))
    directory = [{"gameWeek": [{"games": season_sched.get("games", [])}]}] if season_sched else []
    if not offline and not season_sched:
        print(f"  warn: club-schedule-season/{club} unavailable - teams file limited to this window's games")
    teams = build_teams(directory + [raw], espn_teams, standings)
    # merge with the prior teams file so ids accumulate across windows
    merged = {t["id"]: t for t in prior}
    merged.update({t["id"]: t for t in teams})
    teams = sorted(merged.values(), key=lambda r: r["school"])
    dump_json(teams_path, teams)
    print(f"nhl teams: {len(teams)} -> {teams_path.relative_to(root)}")

    postal = None
    zip_code = args.postal or (load_data(root, "markets.json", {}).get("nhl", {}).get("postalCode"))
    if zip_code and not offline:
        postal = _safe(lambda: fetch_postal(str(zip_code)))
        if postal:
            print(f"postal-lookup {zip_code}: {postal[0].get('teamName', {}).get('default')} ({postal[0].get('county')} County)")

    # OPTIONAL SIDE-FETCH, through _safe like every other one in this file: if ESPN is unreachable
    # the fixture is built exactly as it was before, with `odds: None`, and the run still succeeds.
    espn_odds = None
    if not offline:
        window = [d.get("date") for d in raw.get("gameWeek", []) if d.get("date")]
        espn_odds = _safe(lambda: fetch_espn_odds(window))
        if espn_odds is None:
            print("  warn: ESPN scoreboard unavailable - fixture built without odds")
    fixture, notes = build_fixture(raw, root, season=args.season, anchor_date=args.date, teams=teams,
                                   espn_odds=espn_odds)
    fx_path = out_dir / f"nhl_{args.season}_{args.date}_fixture.json"
    dump_json(fx_path, fixture)
    write_text(out_dir / f"nhl_{args.season}_{args.date}_report.md", report_md(fixture, notes, postal))
    print(f"fixture: {len(fixture['games'])} games ({', '.join(fixture['validation']['window'])}) -> {fx_path.relative_to(root)}")
    if not args.no_logos and not offline:
        needed = None if args.all_logos else {g[s]["id"] for g in fixture["games"] for s in ("home", "away")}
        print("logos:", fetch_logos(teams, root / "assets" / "logos", needed))
    # console: one line per day; the report keeps every game
    from collections import Counter
    per_day = Counter(n.split(":")[0] for n in notes)
    for d, n in sorted(per_day.items()):
        print(f"  {d}: {n} game(s) with no US broadcast row (national TBA / out of market) - see report")
    return 0


def _safe(fn):
    try:
        return fn()
    except Exception as e:  # noqa: BLE001
        print(f"  warn: {e}")
        return None


if __name__ == "__main__":
    sys.exit(main())
