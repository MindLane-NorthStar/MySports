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


# CFBD's book order is not stable between calls, so the choice is NAMED rather than left to
# iteration order - the same reason adapters/mlb.py:165 names FanDuel before BetMGM. DraftKings is
# first because it is what ESPN returns for the NFL, NBA and NHL, so preferring it here makes one
# provider the app's default across all five sports instead of four plus an accident.
# Measured on 2026 week 2 (verified 2026-09-07): DraftKings 49 lines, Bovada 43.
#
# "Draft Kings" WITH A SPACE IS A THIRD SPELLING OF THE SAME BOOK and is deliberately absent from
# this list. On the recorded week 1 it appears 170 times and every single one carries a null spread
# and null moneylines, so preferring it would prefer nothing. `_odds` filters on having a spread
# before it consults this order, which handles it without needing a name.
LINE_PROVIDERS = ("DraftKings", "Bovada")


def _odds(entry: dict[str, Any]) -> dict[str, Any] | None:
    """One CFBD /lines entry -> the odds block pipeline/load.py consumes, or None.

    THE CONTRACT IS load.py:259-261: provider, spread, overUnder, moneylineHome, moneylineAway,
    fetchedAt. Nothing else is read, and `load.py:258` writes NO ROW AT ALL when `spread` is None -
    even if moneylines are present - so a book with a total and no spread is silently not odds.

    THE SIGN NEEDS NO FLIP, and that was measured rather than assumed. CFBD's `spread` is already
    negative-when-home-is-favoured, which is exactly what `favourite()` in web/components/
    MatchupCard.js reads (`sp < 0 ? 'home' : 'away'`). Verified on 2026 week 2 two independent ways:
    against `formattedSpread`, which names the favoured team, 92 agree and 0 disagree; against the
    moneylines, which are a separate field entirely, 82 agree and 0 disagree.

    TWO BOVADA LINES IN THE RECORDED WEEK 1 CONTRADICT THEMSELVES - a near-pick'em where the spread
    favours one side and the moneyline the other, and one carrying an `awayMoneyline` of -100000,
    which is a placeholder rather than a price. Neither reaches a card: DraftKings is preferred and
    never disagrees. It is recorded here because "the sign is always consistent" is a claim about
    CFBD that is not quite true, and the next reader should not have to rediscover that.

    OBSERVED SHAPE, fetched live 2026-09-07 and dumped to
    artifacts/validation/cfbd_2026_week1_lines.json:
        entry  : id, season, seasonType, week, startDate, homeTeamId, homeTeam, homeConference,
                 homeClassification, homeScore, awayTeamId, awayTeam, awayConference,
                 awayClassification, awayScore, lines[]
        lines[]: provider, spread, formattedSpread, spreadOpen, overUnder, overUnderOpen,
                 homeMoneyline, awayMoneyline
    `spreadOpen` and `overUnderOpen` are the opening numbers and are deliberately NOT carried: the
    card shows the current line, and prompt 57 stage 1 exists because it was accidentally showing an
    old one.
    """
    books = entry.get("lines") or []
    if not books:
        return None
    # A BOOK WITH NO SPREAD IS NOT A LINE, so one that has one is preferred over a named one that
    # does not. Measured on the recorded week: CFBD returns the SAME book under two spellings -
    # "DraftKings" (159 entries) and "Draft Kings" with a space (170) - and all 170 of the spaced
    # form carry a null spread and null moneylines. On 12 entries the spaced form is the ONLY
    # provider. Without this filter those 12 would pick an empty book, `load.py:258` would refuse to
    # write the row anyway, and a real Bovada line sitting beside it would have been thrown away.
    usable = [b for b in books if b.get("spread") is not None]
    pool = usable or books
    book = next((b for name in LINE_PROVIDERS for b in pool if b.get("provider") == name), pool[0])
    return {"provider": book.get("provider") or "unknown",
            "details": book.get("formattedSpread"),
            "spread": book.get("spread"),
            "overUnder": book.get("overUnder"),
            "moneylineHome": book.get("homeMoneyline"),
            "moneylineAway": book.get("awayMoneyline"),
            "fetchedAt": now_et_iso()}


def is_fbs_involving(game: dict[str, Any]) -> bool:
    return (str(game.get("homeClassification", "")).lower() == "fbs"
            or str(game.get("awayClassification", "")).lower() == "fbs")


def build_fixture(games: list[dict[str, Any]], media: list[dict[str, Any]], root: Path, *, year: int, week: int,
                  season_type: str, lines: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    # DEFAULTS TO NONE so an offline rebuild and every existing test keep producing what they did.
    # THE JOIN IS ON THE CFBD GAME ID, and this is the one adapter where that is safe: /games and
    # /lines are the same endpoint family and mint the same id (they are ESPN ids, which is also why
    # fetch_teams keeps cfb's bare integer id). Verified 2026-09-07 on 2026 week 1 - 171 line entries,
    # 171 of 171 ids present in /games, none unmatched. The stage-2 warning about ESPN event ids does
    # not apply here; it applies where two DIFFERENT providers are being joined.
    odds_by: dict[Any, dict[str, Any]] = {}
    for e in lines or []:
        block = _odds(e)
        if block is not None:
            odds_by[e.get("id")] = block
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
            "odds": odds_by.get(g.get("id")),
        })
    return {"validation": {"generatedAt": now_et_iso(), "sport": "cfb", "year": year, "week": week, "seasonType": season_type,
                           "apiKeyIncluded": False,
                           "fbsDefinitionForFixture": "Either homeClassification or awayClassification == fbs",
                           "source": "cfbd.games+media+lines" if lines else "cfbd.games+media",
                           "oddsProviderPreference": list(LINE_PROVIDERS)},
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
        lp = Path(args.from_file).with_name(Path(args.from_file).name.replace("_games", "_lines"))
        lines = json.loads(lp.read_text(encoding="utf-8")) if lp.exists() else None
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
        # THE FETCHER WAS WRITTEN AND NEVER WIRED IN. `fetch_lines` has existed since this adapter
        # was written and was called from nowhere in the repository, so cfb games reached the loader
        # with no `odds` key at all, `load.py:258` wrote no game_odds row, `favourite()` returned
        # null and the card's right slot rendered empty. That was the blank slot Joe reported.
        lines = provider.fetch_lines(args.year, args.week, args.season_type)
        dump_json(out_dir / f"{prefix}_games.json", games)
        dump_json(out_dir / f"{prefix}_media.json", media)
        dump_json(out_dir / f"{prefix}_lines.json", lines)
    fixture = build_fixture(games, media, root, year=args.year, week=args.week, season_type=args.season_type,
                            lines=lines)
    dump_json(out_dir / f"{prefix}_fixture.json", fixture)
    write_text(out_dir / f"{prefix}_adapter_report.md", report_md(fixture, len(games), len(media)))
    print(f"fixture: {len(fixture['games'])} FBS-involving games -> {prefix}_fixture.json")
    if args.teams and provider is not None:
        teams = provider.fetch_teams(args.year)
        dump_json(out_dir / f"cfbd_{args.year}_teams.json", teams)
        # EVERY TEAM IN THE RESPONSE, not this week's fixture (prompt 61 stage 2). This passed a
        # `needed` set built from `fixture["games"]`, so a team first appearing this week had no art
        # until the night its game loaded - and `assets/` is untracked, so a local backfill lives on
        # one machine and nowhere else. Production reads what the runner pushed to R2, and that step
        # can only push what the runner has. FCS opponents rendered as broken images for exactly
        # this reason; scripts/fetch_team_assets.py lost the same sampling in the same week.
        #
        # IT COSTS ALMOST NOTHING ON AN ORDINARY NIGHT. `fetch_logos` goes through
        # `adapters.common.download`, whose `skip_existing` default returns "cached" for any file
        # already on disk with a non-zero size (common.py:206-209) - and the runner pulls the whole
        # asset cache from R2 in the step above before this one runs. So the wide net is one HEAD-
        # less stat per team, and only a genuinely new team costs a request.
        print(f"teams: {len(teams)}; logos:", fetch_logos(teams, root / "assets" / "logos"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
