#!/usr/bin/env python3
"""
CFB TV Grid Agent - Phase 3 CFBD Week Validation

Purpose
-------
Validate CollegeFootballData's /calendar, /games, and /games/media endpoints
against a real season/week without exposing the API key.

Default target:
    season=2026
    week=1
    seasonType=regular

Run from the repository root:
    py scripts/validate_cfbd_week1.py
or:
    python scripts/validate_cfbd_week1.py

Outputs:
    artifacts/validation/cfbd_2026_week1_calendar.json
    artifacts/validation/cfbd_2026_week1_games.json
    artifacts/validation/cfbd_2026_week1_media.json
    artifacts/validation/cfbd_2026_week1_fixture.json
    artifacts/validation/cfbd_2026_week1_report.md
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

API_BASE = "https://api.collegefootballdata.com"
ET = ZoneInfo("America/New_York")

# User's current known access profile.
# This is deliberately label-based for validation only. Production will use IDs.
AVAILABLE_OUTLETS = {
    "ABC",
    "CBS",
    "FOX",
    "NBC",
    "The CW",
    "CW",
    "ESPN",
    "ESPN2",
    "ESPNU",
    "FS1",
    "FOX Sports 1",
    "Big Ten Network",
    "BTN",
    "ACC Network",
    "ACCN",
    "SEC Network",
    "SECN",
    "USA",
    "USA Network",
    "TNT",
    "truTV",
    "TruTV",
    "ESPN+",
    "ESPN Plus",
    "Peacock",
    "Paramount+",
    "Paramount Plus",
    "HBO Max",
    "Max",
    "Amazon Prime Video",
    "Prime Video",
}

UNAVAILABLE_OUTLETS = {
    "CBS Sports Network",
    "CBSSN",
    "FS2",
    "FOX Sports 2",
}


def find_repo_root(start: Path) -> Path:
    """Walk upward looking for .env or .git. Fall back to current directory."""
    current = start.resolve()
    candidates = [current, *current.parents]
    for p in candidates:
        if (p / ".env").exists() or (p / ".git").exists():
            return p
    return current


def load_dotenv(path: Path) -> None:
    """
    Minimal .env loader to avoid adding a dependency.
    Existing environment variables win.
    Supports KEY=value and simple single/double quoted values.
    """
    if not path.exists():
        return

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[7:].strip()
        if "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()

        if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", key):
            continue

        if len(value) >= 2 and value[0] == value[-1] and value[0] in ("'", '"'):
            value = value[1:-1]

        os.environ.setdefault(key, value)


def api_get(path: str, token: str, params: dict[str, Any] | None = None) -> Any:
    params = params or {}
    query = urllib.parse.urlencode(
        {k: v for k, v in params.items() if v is not None},
        doseq=True,
    )
    url = f"{API_BASE}{path}"
    if query:
        url += f"?{query}"

    request = urllib.request.Request(
        url,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
            "User-Agent": "cfb-tv-grid-phase3-validation/0.1",
        },
        method="GET",
    )

    try:
        with urllib.request.urlopen(request, timeout=45) as response:
            body = response.read().decode("utf-8")
            return json.loads(body)
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(
            f"CFBD request failed: HTTP {e.code} for {path}\n"
            f"Response: {error_body[:1000]}"
        ) from e
    except urllib.error.URLError as e:
        raise RuntimeError(f"CFBD request failed for {path}: {e}") from e


def dump_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(data, indent=2, ensure_ascii=False, sort_keys=False),
        encoding="utf-8",
    )


def parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        normalized = value.replace("Z", "+00:00")
        dt = datetime.fromisoformat(normalized)
        if dt.tzinfo is None:
            return dt.replace(tzinfo=ET)
        return dt
    except ValueError:
        return None


def et_display(value: str | None) -> str:
    dt = parse_dt(value)
    if dt is None:
        return value or "TBD"
    return dt.astimezone(ET).strftime("%a %Y-%m-%d %-I:%M %p ET") if os.name != "nt" else dt.astimezone(ET).strftime("%a %Y-%m-%d %#I:%M %p ET")


def normalize_outlet(outlet: str) -> str:
    return re.sub(r"\s+", " ", (outlet or "").strip())


def outlet_access(outlet: str) -> str:
    o = normalize_outlet(outlet)
    if o in UNAVAILABLE_OUTLETS:
        return "UNAVAILABLE"
    if o in AVAILABLE_OUTLETS:
        return "AVAILABLE"

    low = o.lower()

    # Conservative aliases only; unknown remains unknown.
    if low in {"accnx", "sec network+", "secn+", "espn3", "espn app"}:
        return "CONDITIONAL/VERIFY"
    if "paramount" in low:
        return "AVAILABLE"
    if "peacock" in low:
        return "AVAILABLE"
    if low in {"max", "hbo max"}:
        return "AVAILABLE"
    if "espn+" in low or "espn plus" in low:
        return "AVAILABLE"
    if low in {"cbssn", "cbs sports network"}:
        return "UNAVAILABLE"
    if low in {"fs2", "fox sports 2"}:
        return "UNAVAILABLE"

    return "UNKNOWN"


def is_fbs_involving_game(game: dict[str, Any]) -> bool:
    return (
        str(game.get("homeClassification", "")).lower() == "fbs"
        or str(game.get("awayClassification", "")).lower() == "fbs"
    )


def game_label(game: dict[str, Any]) -> str:
    return f'{game.get("awayTeam", "Away")} @ {game.get("homeTeam", "Home")}'


def media_label(media: dict[str, Any]) -> str:
    return f'{media.get("awayTeam", "Away")} @ {media.get("homeTeam", "Home")}'


def format_md_table(headers: list[str], rows: list[list[Any]]) -> str:
    def cell(x: Any) -> str:
        return str(x if x is not None else "").replace("|", r"\|").replace("\n", " ")

    out = [
        "| " + " | ".join(cell(h) for h in headers) + " |",
        "| " + " | ".join("---" for _ in headers) + " |",
    ]
    out.extend("| " + " | ".join(cell(v) for v in row) + " |" for row in rows)
    return "\n".join(out)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--year", type=int, default=2026)
    parser.add_argument("--week", type=int, default=1)
    parser.add_argument("--season-type", default="regular")
    parser.add_argument(
        "--output-dir",
        default="artifacts/validation",
        help="Path relative to repository root unless absolute.",
    )
    args = parser.parse_args()

    repo_root = find_repo_root(Path.cwd())
    dotenv_path = repo_root / ".env"
    load_dotenv(dotenv_path)

    token = os.getenv("CFBD_API_KEY")
    if not token:
        print(
            "ERROR: CFBD_API_KEY was not found.\n"
            f"Expected it in environment or: {dotenv_path}\n"
            "Example .env line: CFBD_API_KEY=your_key_here",
            file=sys.stderr,
        )
        return 2

    # Never print token contents.
    print(f"Repository root: {repo_root}")
    print(f".env found: {'yes' if dotenv_path.exists() else 'no'}")
    print("CFBD_API_KEY: loaded (value intentionally hidden)")
    print(f"Validating season {args.year}, week {args.week}, {args.season_type}...")

    out_dir = Path(args.output_dir)
    if not out_dir.is_absolute():
        out_dir = repo_root / out_dir
    out_dir.mkdir(parents=True, exist_ok=True)

    calendar = api_get("/calendar", token, {"year": args.year})
    games = api_get(
        "/games",
        token,
        {
            "year": args.year,
            "week": args.week,
            "seasonType": args.season_type,
        },
    )
    media = api_get(
        "/games/media",
        token,
        {
            "year": args.year,
            "week": args.week,
            "seasonType": args.season_type,
        },
    )

    prefix = f"cfbd_{args.year}_week{args.week}"
    dump_json(out_dir / f"{prefix}_calendar.json", calendar)
    dump_json(out_dir / f"{prefix}_games.json", games)
    dump_json(out_dir / f"{prefix}_media.json", media)

    fbs_games = [g for g in games if is_fbs_involving_game(g)]
    fbs_game_ids = {g.get("id") for g in fbs_games}
    fbs_media = [m for m in media if m.get("id") in fbs_game_ids]

    game_by_id = {g.get("id"): g for g in fbs_games}
    media_by_game: dict[Any, list[dict[str, Any]]] = defaultdict(list)
    for m in fbs_media:
        media_by_game[m.get("id")].append(m)

    # Date coverage
    games_by_date = Counter()
    for g in fbs_games:
        dt = parse_dt(g.get("startDate"))
        if dt:
            games_by_date[dt.astimezone(ET).date().isoformat()] += 1
        else:
            games_by_date["UNKNOWN"] += 1

    # Media outlet stats
    outlet_counts = Counter()
    media_type_counts = Counter()
    unknown_outlets = Counter()
    inaccessible_outlets = Counter()
    conditional_outlets = Counter()

    for m in fbs_media:
        outlet = normalize_outlet(str(m.get("outlet", "")))
        media_type = str(m.get("mediaType", "")).lower()
        outlet_counts[(media_type, outlet)] += 1
        media_type_counts[media_type] += 1

        status = outlet_access(outlet)
        if status == "UNKNOWN":
            unknown_outlets[outlet] += 1
        elif status == "UNAVAILABLE":
            inaccessible_outlets[outlet] += 1
        elif status == "CONDITIONAL/VERIFY":
            conditional_outlets[outlet] += 1

    # TBD and media coverage diagnostics
    tbd_games = [g for g in fbs_games if bool(g.get("startTimeTBD"))]
    no_media_games = [g for g in fbs_games if not media_by_game.get(g.get("id"))]
    multi_media_games = [
        (game_by_id[gid], rows)
        for gid, rows in media_by_game.items()
        if len(rows) > 1 and gid in game_by_id
    ]

    # Create compact sanitized fixture for us to upload/analyze.
    fixture_games = []
    for g in sorted(
        fbs_games,
        key=lambda x: (x.get("startDate") or "", x.get("id") or 0),
    ):
        rows = media_by_game.get(g.get("id"), [])
        fixture_games.append(
            {
                "id": g.get("id"),
                "season": g.get("season"),
                "week": g.get("week"),
                "startDate": g.get("startDate"),
                "startTimeET": et_display(g.get("startDate")),
                "startTimeTBD": g.get("startTimeTBD"),
                "neutralSite": g.get("neutralSite"),
                "home": {
                    "id": g.get("homeId"),
                    "team": g.get("homeTeam"),
                    "conference": g.get("homeConference"),
                    "classification": g.get("homeClassification"),
                },
                "away": {
                    "id": g.get("awayId"),
                    "team": g.get("awayTeam"),
                    "conference": g.get("awayConference"),
                    "classification": g.get("awayClassification"),
                },
                "media": [
                    {
                        "mediaType": m.get("mediaType"),
                        "outlet": normalize_outlet(str(m.get("outlet", ""))),
                        "access": outlet_access(str(m.get("outlet", ""))),
                        "isStartTimeTBD": m.get("isStartTimeTBD"),
                        "startTime": m.get("startTime"),
                    }
                    for m in rows
                ],
            }
        )

    fixture = {
        "validation": {
            "generatedAt": datetime.now(tz=ET).isoformat(),
            "year": args.year,
            "week": args.week,
            "seasonType": args.season_type,
            "apiKeyIncluded": False,
            "fbsDefinitionForFixture": "Either homeClassification or awayClassification == fbs",
        },
        "games": fixture_games,
    }
    dump_json(out_dir / f"{prefix}_fixture.json", fixture)

    # Useful named fixtures.
    target_names = [
        ("Toledo", "Michigan State"),
        ("Northern Illinois", "Iowa"),
    ]
    named_fixture_rows = []
    for away_target, home_target in target_names:
        matches = [
            g for g in fbs_games
            if str(g.get("awayTeam", "")).lower() == away_target.lower()
            and str(g.get("homeTeam", "")).lower() == home_target.lower()
        ]
        for g in matches:
            media_rows = media_by_game.get(g.get("id"), [])
            named_fixture_rows.append(
                [
                    game_label(g),
                    g.get("id"),
                    et_display(g.get("startDate")),
                    "YES" if g.get("startTimeTBD") else "NO",
                    "; ".join(
                        f'{m.get("mediaType")}:{normalize_outlet(str(m.get("outlet","")))}'
                        for m in media_rows
                    ) or "(none)",
                ]
            )

    # Report
    report_lines = [
        f"# CFBD Validation Report — {args.year} Week {args.week}",
        "",
        f"Generated: {datetime.now(tz=ET).strftime('%Y-%m-%d %I:%M %p ET')}",
        "",
        "## API Probe",
        "",
        f"- `/calendar?year={args.year}`: **{len(calendar)}** calendar rows",
        f"- `/games?year={args.year}&week={args.week}&seasonType={args.season_type}`: **{len(games)}** game rows",
        f"- FBS-involving games after local filtering: **{len(fbs_games)}**",
        f"- `/games/media?...`: **{len(media)}** total media rows",
        f"- Media rows joined to FBS-involving games: **{len(fbs_media)}**",
        f"- FBS games marked `startTimeTBD=true`: **{len(tbd_games)}**",
        f"- FBS games with no media row: **{len(no_media_games)}**",
        f"- FBS games with multiple media rows: **{len(multi_media_games)}**",
        "",
        "> API key was not written to any output file.",
        "",
        "## FBS Games by Eastern Calendar Date",
        "",
        format_md_table(
            ["Date (ET)", "Games"],
            [[d, c] for d, c in sorted(games_by_date.items())],
        ),
        "",
        "## Media Types",
        "",
        format_md_table(
            ["Media type", "Rows"],
            [[k or "(blank)", v] for k, v in sorted(media_type_counts.items())],
        ),
        "",
        "## Outlet Inventory",
        "",
        format_md_table(
            ["Media type", "Outlet", "Rows", "User access classification"],
            [
                [media_type or "(blank)", outlet or "(blank)", count, outlet_access(outlet)]
                for (media_type, outlet), count in sorted(
                    outlet_counts.items(), key=lambda item: (item[0][0], item[0][1])
                )
            ],
        ),
        "",
        "## Named Validation Fixtures",
        "",
        format_md_table(
            ["Game", "CFBD game ID", "Start (ET)", "Time TBD?", "CFBD media rows"],
            named_fixture_rows or [["(target not found)", "", "", "", ""]],
        ),
        "",
        "## Games With Multiple Media Rows",
        "",
    ]

    multi_rows = []
    for g, rows in sorted(
        multi_media_games,
        key=lambda item: (item[0].get("startDate") or "", item[0].get("id") or 0),
    ):
        multi_rows.append(
            [
                game_label(g),
                g.get("id"),
                et_display(g.get("startDate")),
                "; ".join(
                    f'{m.get("mediaType")}:{normalize_outlet(str(m.get("outlet","")))}'
                    for m in rows
                ),
            ]
        )
    report_lines.append(
        format_md_table(
            ["Game", "ID", "Start (ET)", "Media rows"],
            multi_rows or [["(none)", "", "", ""]],
        )
    )

    report_lines += [
        "",
        "## FBS Games With No Media Row",
        "",
        format_md_table(
            ["Game", "ID", "Start (ET)", "Time TBD?"],
            [
                [
                    game_label(g),
                    g.get("id"),
                    et_display(g.get("startDate")),
                    "YES" if g.get("startTimeTBD") else "NO",
                ]
                for g in sorted(
                    no_media_games,
                    key=lambda x: (x.get("startDate") or "", x.get("id") or 0),
                )
            ]
            or [["(none)", "", "", ""]],
        ),
        "",
        "## Unknown Outlet Labels Requiring Normalization Review",
        "",
        format_md_table(
            ["Outlet", "Rows"],
            [[k or "(blank)", v] for k, v in sorted(unknown_outlets.items())]
            or [["(none)", ""]],
        ),
        "",
        "## Explicitly Inaccessible Outlet Labels Observed",
        "",
        format_md_table(
            ["Outlet", "Rows"],
            [[k, v] for k, v in sorted(inaccessible_outlets.items())]
            or [["(none)", ""]],
        ),
        "",
        "## Conditional / Authentication-Dependent Labels",
        "",
        format_md_table(
            ["Outlet", "Rows"],
            [[k, v] for k, v in sorted(conditional_outlets.items())]
            or [["(none)", ""]],
        ),
        "",
        "## Phase 3 Questions This Probe Answers",
        "",
        "1. Does CFBD contain all FBS-involving Week 1 games?",
        "2. Does `/games/media` use one or multiple media rows per game?",
        "3. How are simulcasts and streaming services labeled?",
        "4. Which outlet strings require canonical normalization?",
        "5. Are TBD flags populated as expected?",
        "6. Does the Toledo @ Michigan State conflict fixture agree with the official FS1 assignment or show stale/conflicting data?",
        "7. Are non-half-hour kickoff times preserved exactly?",
        "",
        "## Next Step",
        "",
        "Upload this report and the companion `*_fixture.json` file for architecture review. "
        "Do not upload `.env` or any file containing the API key.",
        "",
    ]

    report_path = out_dir / f"{prefix}_report.md"
    report_path.write_text("\n".join(report_lines), encoding="utf-8")

    print()
    print("Validation completed successfully.")
    print(f"Report:  {report_path}")
    print(f"Fixture: {out_dir / f'{prefix}_fixture.json'}")
    print("Raw API responses were also saved locally for debugging.")
    print()
    print("SAFE TO SHARE:")
    print(f"  - {report_path.name}")
    print(f"  - {prefix}_fixture.json")
    print("DO NOT SHARE:")
    print("  - .env")
    print("  - CFBD_API_KEY")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
