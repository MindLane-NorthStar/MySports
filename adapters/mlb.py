#!/usr/bin/env python3
"""MySports - MLB adapter (Milestone 8.3), statsapi.mlb.com in one call.

Spec: docs/research/mlb-adapter-brief.md. One GET /api/v1/schedule with
hydrate=broadcasts(all),team,venue,seriesStatus,statusFlags,preGameOdds returns the schedule, every TV
telecast with a feed side and a national/local code, and pre-game odds. Buckets are keyed on
officialDate, which IS the ET viewing day for every regular-season game (brief 7.5), so --date takes a
viewing day directly and no cutover arithmetic is needed. Run from the repo root:

    python -m adapters.mlb --date 2026-09-04
    python -m adapters.mlb --date 2026-09-04 --teams        # refresh mlb_{season}_teams.json + logos
    python -m adapters.mlb --date 2026-09-04 --all-logos    # logos for all 30 (season bootstrap)

National exclusives suppress the local feeds by omission (brief 2.4); the fail-closed guard in
build_fixture refuses to write a fixture when a window returns games but no TV rows at all, so a partial
response can never be mistaken for a league-wide suppression and close every active broadcast row.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from adapters.common import (access_lookup, dump_json, et_display, fetch_logos, find_repo_root, fixture_envelope,
                             http_json, load_data, load_raw_or_fetch, md_table, media_row, normalize_outlet,
                             outlet_access, team_record, write_text)

API = "https://statsapi.mlb.com/api/v1"
HYDRATE = "broadcasts(all),team,venue,seriesStatus,statusFlags,preGameOdds"
# MLB abbreviations that differ from ESPN's (brief 6.1)
MLB_TO_ESPN = {"AZ": "ARI", "CWS": "CHW"}
# gameType: keep the ones that reach a grid; drop spring/exhibition/intrasquad (brief 1.4)
KEEP_TYPES = {"R", "F", "D", "L", "W", "C", "P", "A"}
# status families that are tombstones, not games (brief 1.4 / 7.2)
TOMBSTONE = ("D", "C")
NATIONAL_CODES = {"national", "exclusive"}
# Outlets whose canonical name is a streaming service (brief 9.3 mediaType rule)
STREAMING = {"Apple TV", "Netflix", "Peacock", "HBO Max", "Prime Video", "ESPN+", "Disney+", "Hulu", "Paramount+"}


def fetch_day(date: str, *, hydrate: str = HYDRATE) -> dict[str, Any]:
    return http_json(f"{API}/schedule", params={"sportId": 1, "date": date, "hydrate": hydrate})


def fetch_teams(season: int) -> list[dict[str, Any]]:
    return (http_json(f"{API}/teams", params={"sportId": 1, "season": season}) or {}).get("teams", [])


def build_teams(mlb_teams: list[dict[str, Any]], espn_teams: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_abbr = {}
    for e in espn_teams:
        ab = (e.get("abbreviation") or "").upper()
        if ab:
            by_abbr[ab] = e
    out = []
    for t in mlb_teams:
        ab = (t.get("abbreviation") or "").upper()
        e = by_abbr.get(MLB_TO_ESPN.get(ab, ab), {})
        division = (t.get("division") or {}).get("name")
        out.append(team_record(
            f"mlb-{t['id']}", t.get("teamName") or t.get("name") or "", ab, division, "mlb",
            e.get("color"), e.get("alternateColor"), list(e.get("logos") or []),
            teamFull=t.get("name"), location=t.get("locationName"),
            league=(t.get("league") or {}).get("name"), division=division,
            venueId=(t.get("venue") or {}).get("id"),
        ))
    return sorted(out, key=lambda r: r["school"])


def _odds(game: dict[str, Any]) -> dict[str, Any] | None:
    """preGameOdds -> the fixture odds block. FanDuel (1) preferred, else BetMGM (2). Deep links stripped."""
    books = game.get("preGameOdds") or []
    if not books:
        return None
    book = next((b for b in books if (b.get("provider") or {}).get("id") == 1), books[0])
    team_odds = book.get("teamOdds") or []
    home = next((t for t in team_odds if t.get("homeTeam")), None)
    away = next((t for t in team_odds if not t.get("homeTeam")), None)
    total = (book.get("totalOdds") or {}).get("totalRuns")

    def _f(v):
        try:
            return float(str(v).replace("+", ""))
        except (TypeError, ValueError):
            return None

    def _i(v):
        try:
            return int(str(v).replace("+", ""))
        except (TypeError, ValueError):
            return None

    spread = _f((home or {}).get("runline") if (home or {}).get("runline") is not None else (home or {}).get("runlineValue"))
    return {
        "provider": (book.get("provider") or {}).get("name"),
        "spread": spread,
        "overUnder": _f(total),
        "moneylineHome": _i((home or {}).get("moneyline")),
        "moneylineAway": _i((away or {}).get("moneyline")),
        "fetchedAt": book.get("lastUpdated"),
    }


def _side_team(game: dict[str, Any], side: str) -> dict[str, Any]:
    return ((game.get("teams") or {}).get(side) or {}).get("team") or {}


def build_media(game: dict[str, Any], *, local_abbrevs: set[str], available: set[str], unavailable: set[str],
                start: str | None, tbd: bool, coverage: dict[str, Any], official_date: str,
                notes: list[str]) -> tuple[list[dict[str, Any]], bool, int]:
    """TV rows only. National/exclusive pairs collapse to one NATIONAL row (brief 2.3)."""
    tv = [b for b in (game.get("broadcasts") or []) if (b.get("type") or "").upper() == "TV"]
    seen_tv = len(tv)
    # drop non-English rows when an English row exists for the same feed side (brief 9.3)
    en_sides = {b.get("homeAway") for b in tv if (b.get("language") or "en") == "en"}
    tv = [b for b in tv if (b.get("language") or "en") == "en" or b.get("homeAway") not in en_sides]

    home_abbr = (_side_team(game, "home").get("abbreviation") or "").upper()
    away_abbr = (_side_team(game, "away").get("abbreviation") or "").upper()
    guardians_in_window = bool(local_abbrevs & {home_abbr, away_abbr})

    rows: list[dict[str, Any]] = []
    national_seen: set[str] = set()
    has_national = has_local = False
    for b in tv:
        raw = (b.get("name") or "").strip()
        if not raw:
            continue
        code = ((b.get("availability") or {}).get("availabilityCode") or "").lower()
        outlet = normalize_outlet(raw)
        if code in NATIONAL_CODES:
            has_national = True
            if outlet in national_seen:      # the home/away pair of the same national feed
                continue
            national_seen.add(outlet)
            side = "NATIONAL"
            market = "national"
            access = outlet_access(outlet, available, unavailable)
            certainty = "CONFIRMED"
            # FOX Saturday is regional: 2-3 simultaneous games all labelled FOX (brief 8.1)
            if outlet in ("FOX", "FS1") and raw.upper().startswith("FOX /"):
                if guardians_in_window:
                    market = "regional"
                else:
                    entry = (coverage.get("weeks") or {}).get(official_date) or {}
                    key = f"{away_abbr}@{home_abbr}"
                    pick = entry.get(key, entry.get(str(game.get("gamePk"))))
                    if pick is True:
                        market = "regional"
                    elif pick is False:
                        market, access, certainty = "regional", "OUT_OF_MARKET", "CONFIRMED"
                    else:
                        market, access, certainty = "regional", "UNVERIFIED", "UNVERIFIED"
        else:
            has_local = True
            ha = (b.get("homeAway") or "").lower()
            side = "HOME" if ha == "home" else "AWAY"
            market = "local"
            mine = (home_abbr if side == "HOME" else away_abbr) in local_abbrevs
            access = outlet_access(outlet, available, unavailable) if mine else "OUT_OF_MARKET"
            certainty = "CONFIRMED"
        row = media_row("web" if outlet in STREAMING else "tv", outlet, access, market=market,
                        certainty=certainty, start_time=start, tbd=tbd, source="mlb-statsapi",
                        label=raw if raw != outlet else None)
        row["feedSide"] = side
        row["outletSourceId"] = b.get("id")
        row["streamingAvailability"] = ((b.get("availability") or {}).get("availabilityCode"))
        rows.append(row)

    suppresses = has_national and not has_local
    # fail-closed per game: no TV rows and not a known exclusive -> say so, never guess a local row
    if not tv and (game.get("status") or {}).get("abstractGameState") != "Final":
        notes.append(f"{official_date}: {game.get('gamePk')} {away_abbr}@{home_abbr} has no TV row - "
                     f"not treated as a national exclusive (no national row present)")
    rows.sort(key=lambda r: (r["market"], r["outlet"]))
    return rows, suppresses, seen_tv


def build_fixture(raw: dict[str, Any], root: Path, *, season: int, date: str,
                  teams: list[dict[str, Any]]) -> tuple[dict[str, Any], list[str], dict[str, list]]:
    available, unavailable = access_lookup(root)
    markets = load_data(root, "markets.json", {}) or {}
    local_abbrevs = {a.upper() for a in ((markets.get("mlb") or {}).get("localTeams") or ["CLE"])}
    coverage = load_data(root, "market_coverage_mlb.json", {}) or {}
    venue_of = {t["id"]: t.get("venueId") for t in teams}

    notes: list[str] = []
    tombstones: dict[str, list] = {"postponed": [], "cancelled": [], "suspended": []}
    games: list[dict[str, Any]] = []
    tv_rows_seen = 0
    by_pk: dict[int, dict[str, Any]] = {}

    for bucket in (raw.get("dates") or []):
        official_date = bucket.get("date") or date
        for g in (bucket.get("games") or []):
            if (g.get("gameType") or "") not in KEEP_TYPES:
                continue
            status = g.get("status") or {}
            code = (status.get("statusCode") or "")
            pk = g.get("gamePk")
            if code[:1] in TOMBSTONE:
                bucket_name = "postponed" if code[:1] == "D" else "cancelled"
                tombstones[bucket_name].append({"id": f"mlb-{pk}", "officialDate": official_date,
                                                "rescheduleDate": g.get("rescheduleDate"),
                                                "reason": status.get("detailedState")})
                continue
            if code[:1] in ("T", "U"):
                tombstones["suspended"].append({"id": f"mlb-{pk}", "officialDate": official_date,
                                                "resumeDate": g.get("resumeDate"),
                                                "reason": status.get("detailedState")})
            # a postponed game keeps its gamePk on the makeup date; keep the live/scheduled twin
            if pk in by_pk:
                notes.append(f"{official_date}: duplicate gamePk {pk} - kept the scheduled/live row")
                continue

            flags = g.get("statusFlags") or {}
            dh = g.get("doubleHeader") or "N"
            gnum = g.get("gameNumber")
            placeholder = not (_side_team(g, "home").get("id") and _side_team(g, "away").get("id"))
            tbd = bool(status.get("startTimeTBD") or flags.get("isTBD")
                       or (dh == "Y" and gnum == 2) or placeholder)
            start = g.get("gameDate")

            def side(which: str) -> dict[str, Any]:
                t = _side_team(g, which)
                tid = f"mlb-{t['id']}" if t.get("id") else None
                return {"id": tid, "team": t.get("teamName") or t.get("name"), "teamFull": t.get("name"),
                        "location": t.get("locationName"), "abbreviation": t.get("abbreviation"),
                        "conference": (t.get("division") or {}).get("name"), "classification": "mlb",
                        "league": (t.get("league") or {}).get("name")}

            media, suppresses, seen = build_media(
                g, local_abbrevs=local_abbrevs, available=available, unavailable=unavailable,
                start=start, tbd=tbd, coverage=coverage, official_date=official_date, notes=notes)
            tv_rows_seen += seen

            home, away = side("home"), side("away")
            venue = g.get("venue") or {}
            rec = (g.get("teams") or {})

            def record(which: str) -> str | None:
                lr = ((rec.get(which) or {}).get("leagueRecord") or {})
                return None if lr.get("wins") is None else f"{lr.get('wins')}-{lr.get('losses')}"

            game = {
                "id": f"mlb-{pk}", "sport": "mlb", "season": int(g.get("season") or season), "week": None,
                "startDate": start, "startTimeET": "" if tbd else et_display(start), "startTimeTBD": tbd,
                "neutralSite": bool(venue.get("id") and venue_of.get(home["id"]) not in (None, venue.get("id"))),
                "venue": venue.get("name"),
                "home": home, "away": away, "media": media,
                "odds": _odds(g),
                "records": {"home": record("home"), "away": record("away")},
                "gameType": g.get("gameType"),
                "doubleHeader": dh, "doubleheaderGameNumber": gnum if dh != "N" else None,
                "seriesGameNumber": g.get("seriesGameNumber"), "gamesInSeries": g.get("gamesInSeries"),
                "dayNight": g.get("dayNight"),
                "scheduleCertainty": "TBD_FOLLOWS" if (dh == "Y" and gnum == 2) else ("TBD" if tbd else "FINAL"),
                "status": {"code": code, "detailedState": status.get("detailedState"), "reason": status.get("reason")},
                "rescheduledFrom": g.get("rescheduledFromDate"), "resumedFrom": g.get("resumedFrom"),
                "description": g.get("description"),
                "suppressesLocalFeed": suppresses,
                "officialDate": official_date,
            }
            by_pk[pk] = game
            games.append(game)

    games.sort(key=lambda x: (x["startDate"] or "", x["id"]))
    fixture = fixture_envelope(
        "mlb", season, None, games, source="mlb-statsapi", dayFilter=date,
        window={"start": date, "end": date},
        market=f"{(markets.get('market') or {}).get('name', 'Cleveland')} "
               f"(DMA {(markets.get('market') or {}).get('dma', 510)})",
        localTeams=sorted(local_abbrevs),
        endpoint=f"{API}/schedule?sportId=1&date={date}&hydrate={HYDRATE}",
        broadcastRowsSeen=tv_rows_seen,
        postponed=tombstones["postponed"], cancelled=tombstones["cancelled"], suspended=tombstones["suspended"],
    )
    return fixture, notes, tombstones


def report_md(fixture: dict[str, Any], notes: list[str], tombstones: dict[str, list]) -> str:
    v = fixture["validation"]
    out = [f"# MLB adapter report - {v.get('dayFilter')}", "",
           f"- generated {v.get('generatedAt')}",
           f"- games: **{len(fixture['games'])}**; TV rows seen before filtering: {v.get('broadcastRowsSeen')}",
           f"- market {v.get('market')}; local teams: {', '.join(v.get('localTeams') or [])}", ""]
    rows = []
    for g in fixture["games"]:
        media = "; ".join(f"{m['outlet']}[{m['access'][:4]}/{m['market'][:3]}/{m.get('feedSide','')[:4]}]"
                          for m in g["media"]) or "-"
        rows.append([f"{g['away']['abbreviation']} @ {g['home']['abbreviation']}",
                     g["startTimeET"] or "TBD", g["gameType"], media,
                     "yes" if g["suppressesLocalFeed"] else ""])
    out.append(md_table(["Game", "Start (ET)", "Type", "Media rows [access/market/side]", "Locals suppressed"], rows))
    for name, items in tombstones.items():
        if items:
            out += ["", f"## {name.title()}", ""] + [f"- `{t['id']}` {t['officialDate']} {t.get('reason') or ''}"
                                                     for t in items]
    if notes:
        out += ["", "## Notes", ""] + [f"- {n}" for n in notes]
    return "\n".join(out) + "\n"


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--date", required=True, help="viewing day YYYY-MM-DD (officialDate)")
    ap.add_argument("--season", type=int, default=2026)
    ap.add_argument("--from-file", help="replay a saved raw /schedule payload")
    ap.add_argument("--teams", action="store_true", help="refresh mlb_{season}_teams.json from /teams + ESPN colors")
    ap.add_argument("--no-logos", action="store_true")
    ap.add_argument("--all-logos", action="store_true", help="logos for every team (season bootstrap)")
    ap.add_argument("--output-dir", default="artifacts/validation")
    args = ap.parse_args(argv)

    root = find_repo_root()
    out_dir = root / args.output_dir
    raw_path = out_dir / f"mlb_{args.season}_{args.date}_raw.json"
    raw = load_raw_or_fetch(args.from_file, lambda: fetch_day(args.date), raw_path)
    offline = bool(args.from_file)

    teams_path = out_dir / f"mlb_{args.season}_teams.json"
    prior = json.loads(teams_path.read_text(encoding="utf-8")) if teams_path.exists() else []
    if args.teams and not offline:
        espn_path = out_dir / "mlb_espn_teams.json"
        from adapters.espn import fetch_teams as espn_fetch
        espn_teams = _safe(lambda: espn_fetch("mlb")) or []
        if espn_teams:
            dump_json(espn_path, espn_teams)
        teams = build_teams(_safe(lambda: fetch_teams(args.season)) or [], espn_teams)
        merged = {t["id"]: t for t in prior}
        merged.update({t["id"]: t for t in teams})
        teams = sorted(merged.values(), key=lambda r: r["school"])
        dump_json(teams_path, teams)
    else:
        teams = prior
    print(f"mlb teams: {len(teams)} -> {teams_path.relative_to(root)}")

    fixture, notes, tombstones = build_fixture(raw, root, season=args.season, date=args.date, teams=teams)

    # Fail-closed guard (brief 10.4): games but zero TV rows in the whole window is a fetch failure,
    # not a league-wide suppression - writing the fixture would close every active broadcast row.
    if fixture["games"] and fixture["validation"]["broadcastRowsSeen"] == 0:
        write_text(out_dir / f"mlb_{args.season}_{args.date}_report.md", report_md(fixture, notes, tombstones))
        print("ERROR: games present but zero TV broadcast rows in the window - refusing to write the fixture "
              "(hydration failure would close every active broadcast row). Raw snapshot and report kept.",
              file=sys.stderr)
        return 1

    fx_path = out_dir / f"mlb_{args.season}_{args.date}_fixture.json"
    dump_json(fx_path, fixture)
    write_text(out_dir / f"mlb_{args.season}_{args.date}_report.md", report_md(fixture, notes, tombstones))
    print(f"fixture: {len(fixture['games'])} games ({args.date}) -> {fx_path.relative_to(root)}")
    if not args.no_logos and not offline and teams:
        needed = None if args.all_logos else {g[s]["id"] for g in fixture["games"] for s in ("home", "away") if g[s]["id"]}
        print("logos:", fetch_logos(teams, root / "assets" / "logos", needed))
    for name, items in tombstones.items():
        if items:
            print(f"  {name}: {len(items)} game(s) - see report")
    for n in notes:
        print(f"  warn: {n}")
    return 0


def _safe(fn):
    try:
        return fn()
    except Exception as e:  # noqa: BLE001
        print(f"  warn: {e}")
        return None


if __name__ == "__main__":
    sys.exit(main())
