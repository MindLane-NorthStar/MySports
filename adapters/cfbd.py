#!/usr/bin/env python3
"""MySports adapter — CollegeFootballData (spec §8, provider interface §8.5).

Extracted from scripts/validate_cfbd_week1.py (Phase 3A) and scripts/fetch_team_assets.py so the CFB
backbone lives behind the same interface as the pro-league adapters. Output is byte-compatible with the
Phase 3 fixtures the renderer reads (`cfbd_2026_week{N}_fixture.json`); each game additionally carries
`"sport": "cfb"` and `"venue"`, and the envelope keeps the Phase 3 keys.

    python -m adapters.cfbd --week 1                 # calendar + games + media + fixture + report
    python -m adapters.cfbd --week 1 --teams         # also refresh cfbd_2026_teams.json + logos for the week
    python -m adapters.cfbd --week 1 --from-file artifacts/validation/cfbd_2026_week1_games.json

Reads CFBD_API_KEY from the environment or .env at the repo root. The key is never printed or written.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any

from adapters.common import (access_lookup, dump_json, et_display, fetch_logos, find_repo_root, http_json,
                             load_dotenv, md_table, normalize_outlet, now_et_iso, outlet_access, team_record, write_text, score_int)

API_BASE = "https://api.collegefootballdata.com"


class CFBDProvider:
    """ScheduleProvider (spec §8.5) for CFBD."""

    def __init__(self, token: str):
        self._h = {"Authorization": f"Bearer {token}"}

    def fetch_calendar(self, year: int) -> list[dict[str, Any]]:
        return http_json(f"{API_BASE}/calendar", self._h, {"year": year})

    def fetch_games(self, year: int, week: int, season_type: str = "regular") -> list[dict[str, Any]]:
        return http_json(f"{API_BASE}/games", self._h, {"year": year, "week": week, "seasonType": season_type})

    def fetch_media(self, year: int, week: int, season_type: str = "regular") -> list[dict[str, Any]]:
        return http_json(f"{API_BASE}/games/media", self._h, {"year": year, "week": week, "seasonType": season_type})

    def fetch_teams(self, year: int) -> list[dict[str, Any]]:
        raw = http_json(f"{API_BASE}/teams", self._h, {"year": year})
        return [team_record(t.get("id"), t.get("school"), t.get("abbreviation"), t.get("conference"),
                            t.get("classification"), t.get("color"), t.get("alternateColor"), t.get("logos") or [])
                for t in raw]

    def fetch_rankings(self, year: int, week: int, season_type: str = "regular") -> list[dict[str, Any]]:
        return http_json(f"{API_BASE}/rankings", self._h, {"year": year, "week": week, "seasonType": season_type})

    def fetch_lines(self, year: int, week: int, season_type: str = "regular") -> list[dict[str, Any]]:
        return http_json(f"{API_BASE}/lines", self._h, {"year": year, "week": week, "seasonType": season_type})


def is_fbs_involving(game: dict[str, Any]) -> bool:
    return (str(game.get("homeClassification", "")).lower() == "fbs"
            or str(game.get("awayClassification", "")).lower() == "fbs")


def build_fixture(games: list[dict[str, Any]], media: list[dict[str, Any]], root: Path, *, year: int, week: int,
                  season_type: str) -> dict[str, Any]:
    available, unavailable = access_lookup(root)
    fbs = [g for g in games if is_fbs_involving(g)]
    ids = {g.get("id") for g in fbs}
    media_by: dict[Any, list[dict[str, Any]]] = defaultdict(list)
    for m in media:
        if m.get("id") in ids:
            media_by[m["id"]].append(m)
    out = []
    for g in sorted(fbs, key=lambda x: (x.get("startDate") or "", x.get("id") or 0)):
        out.append({
            "id": g.get("id"), "sport": "cfb", "season": g.get("season"), "week": g.get("week"),
            "startDate": g.get("startDate"), "startTimeET": et_display(g.get("startDate")),
            "startTimeTBD": g.get("startTimeTBD"), "neutralSite": g.get("neutralSite"), "venue": g.get("venue"),
            "status": "final" if g.get("completed") else "scheduled",
            "homeScore": score_int(g.get("homePoints"), "final" if g.get("completed") else "scheduled"),
            "awayScore": score_int(g.get("awayPoints"), "final" if g.get("completed") else "scheduled"),
            "home": {"id": g.get("homeId"), "team": g.get("homeTeam"), "conference": g.get("homeConference"),
                     "classification": g.get("homeClassification")},
            "away": {"id": g.get("awayId"), "team": g.get("awayTeam"), "conference": g.get("awayConference"),
                     "classification": g.get("awayClassification")},
            "media": [{"mediaType": m.get("mediaType"), "outlet": normalize_outlet(str(m.get("outlet", ""))),
                       "access": outlet_access(str(m.get("outlet", "")), available, unavailable),
                       "isStartTimeTBD": m.get("isStartTimeTBD"), "startTime": m.get("startTime")}
                      for m in media_by.get(g.get("id"), [])],
        })
    return {"validation": {"generatedAt": now_et_iso(), "sport": "cfb", "year": year, "week": week, "seasonType": season_type,
                           "apiKeyIncluded": False,
                           "fbsDefinitionForFixture": "Either homeClassification or awayClassification == fbs",
                           "source": "cfbd.games+media"},
            "games": out}


def report_md(fixture: dict[str, Any], n_games_raw: int, n_media_raw: int) -> str:
    v = fixture["validation"]
    gs = fixture["games"]
    tbd = [g for g in gs if g.get("startTimeTBD")]
    no_media = [g for g in gs if not g["media"]]
    outlets: dict[tuple[str, str], int] = defaultdict(int)
    for g in gs:
        for m in g["media"]:
            outlets[(m["mediaType"], m["outlet"])] += 1
    lines = [f"# CFBD adapter report - {v['year']} week {v['week']} ({v['seasonType']})", "", f"- generated {v['generatedAt']}",
             f"- /games rows: {n_games_raw}; FBS-involving: **{len(gs)}**", f"- /games/media rows: {n_media_raw}",
             f"- startTimeTBD: {len(tbd)}; no media row: {len(no_media)}", "",
             md_table(["Type", "Outlet", "Rows"], [[k[0], k[1], n] for k, n in sorted(outlets.items(), key=lambda kv: (-kv[1], kv[0]))]), ""]
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--year", type=int, default=2026)
    ap.add_argument("--week", type=int, required=True)
    ap.add_argument("--season-type", default="regular")
    ap.add_argument("--teams", action="store_true", help="refresh cfbd_{year}_teams.json and fetch logos for this week's teams")
    ap.add_argument("--from-file", help="replay saved raw games json (media replayed from the sibling _media.json)")
    ap.add_argument("--output-dir", default="artifacts/validation")
    args = ap.parse_args(argv)

    root = find_repo_root()
    load_dotenv(root / ".env")
    out_dir = root / args.output_dir
    prefix = f"cfbd_{args.year}_week{args.week}"
    if args.from_file:
        games = json.loads(Path(args.from_file).read_text(encoding="utf-8"))
        mp = Path(args.from_file).with_name(Path(args.from_file).name.replace("_games", "_media"))
        media = json.loads(mp.read_text(encoding="utf-8")) if mp.exists() else []
        provider = None
    else:
        token = os.getenv("CFBD_API_KEY")
        if not token:
            print("ERROR: CFBD_API_KEY not found in environment or .env", file=sys.stderr)
            return 2
        print("CFBD_API_KEY: loaded (value intentionally hidden)")
        provider = CFBDProvider(token)
        dump_json(out_dir / f"{prefix}_calendar.json", provider.fetch_calendar(args.year))
        games = provider.fetch_games(args.year, args.week, args.season_type)
        media = provider.fetch_media(args.year, args.week, args.season_type)
        dump_json(out_dir / f"{prefix}_games.json", games)
        dump_json(out_dir / f"{prefix}_media.json", media)
    fixture = build_fixture(games, media, root, year=args.year, week=args.week, season_type=args.season_type)
    dump_json(out_dir / f"{prefix}_fixture.json", fixture)
    write_text(out_dir / f"{prefix}_adapter_report.md", report_md(fixture, len(games), len(media)))
    print(f"fixture: {len(fixture['games'])} FBS-involving games -> {prefix}_fixture.json")
    if args.teams and provider is not None:
        teams = provider.fetch_teams(args.year)
        dump_json(out_dir / f"cfbd_{args.year}_teams.json", teams)
        needed = {str(g[s]["id"]) for g in fixture["games"] for s in ("home", "away")}
        print(f"teams: {len(teams)}; logos:", fetch_logos(teams, root / "assets" / "logos", needed))
    return 0


if __name__ == "__main__":
    sys.exit(main())
