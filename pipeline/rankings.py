#!/usr/bin/env python3
"""MySports - college football polls, upserted into mysports.rankings (table shipped in migration 0003).

    python -m pipeline.rankings                                   # every published week of 2026 to date
    python -m pipeline.rankings --week 1 2                        # a subset
    python -m pipeline.rankings --from-file artifacts/validation/rankings_cfb_2026_2026-09-04_raw.json
    python -m pipeline.rankings --emit-sql artifacts/sql/rankings.sql

The `rankings` table has existed since 0003 and was never populated; `adapters/cfbd.py` has carried
fetch_rankings() just as long and was never wired to a loader. This is that wiring, and nothing else -
no schema change, no enum change.

FETCH, THEN FILE, THEN LOAD - and the middle step is not ceremony. Every raw response is written to
artifacts/validation/rankings_cfb_{season}_{as_of}_raw.json before a single row is parsed, so a load can
be reviewed, replayed with --from-file and re-run without spending another API call on a poll that only
moves once a week. Same pattern as pipeline/standings.py.

**Polls that do not map to the enum are reported and skipped, never coerced.** `poll_type` is
(AP, CFP, Coaches). CFBD publishes five polls in a normal week and three of them describe divisions this
app does not carry:

    AP Top 25                       -> AP
    Coaches Poll                    -> Coaches
    Playoff Committee Rankings      -> CFP      (appears about week 12; the CFP does not exist earlier)
    FCS Coaches Poll                -> skipped, reported
    AFCA Division II Coaches Poll   -> skipped, reported
    AFCA Division III Coaches Poll  -> skipped, reported

Extending the enum is deliberately NOT done here. An FCS or D-II poll ranks schools that are not in
`teams`, so those rows could not satisfy the FK even if the enum allowed them.

`poll_date` is left NULL. The /rankings response carries season, seasonType and week but no publication
date, and the run date is not the poll date - inventing one would make a guess look like a provider
fact. Null means "not published by the source", exactly as it does everywhere else here.

A team the `teams` table does not carry is reported and skipped, never invented - the same rule
pipeline/standings.py follows, and the reason a renamed school cannot raise an FK error mid-run.

Conventions of pipeline/: stdlib HTTP through adapters.common, Windows-portable (no %-strftime, every
open() passes encoding=), ASCII console output, the DSN is never printed.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import date, datetime
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

from adapters.common import dump_json, load_dotenv
from pipeline.db import DB, ROOT

ET = ZoneInfo("America/New_York")
SPORT = "cfb"
SOURCE = "cfbd.rankings"
# Week 1 of the 2026 regular season begins here; the refresh workflow derives its CFBD week the same way.
SEASON_START = date(2026, 9, 1)

# CFBD poll name -> mysports.poll_type. Anything absent from this map is reported and skipped.
POLL_ENUM = {
    "AP Top 25": "AP",
    "Coaches Poll": "Coaches",
    "Playoff Committee Rankings": "CFP",
}


def today_et() -> str:
    return datetime.now(tz=ET).strftime("%Y-%m-%d")


def weeks_to_date(today: str | None = None, *, season_start: date = SEASON_START) -> list[int]:
    """Weeks 1..N of the regular season that have begun as of `today` (ET), capped at a 15-week season."""
    t = date.fromisoformat(today or today_et())
    n = max(1, (t - season_start).days // 7 + 1)
    return list(range(1, min(n, 15) + 1))


def parse(raw: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[str]]:
    """CFBD /rankings payload -> mysports.rankings rows. Pure: no network, no database, no clock."""
    rows: list[dict[str, Any]] = []
    notes: list[str] = []
    unmapped: dict[str, int] = {}
    for entry in raw or []:
        season, week = entry.get("season"), entry.get("week")
        if season is None or week is None:
            notes.append(f"entry with no season/week skipped: {sorted(entry)}")
            continue
        for poll in entry.get("polls") or []:
            name = poll.get("poll")
            enum = POLL_ENUM.get(name)
            if enum is None:
                unmapped[name] = unmapped.get(name, 0) + len(poll.get("ranks") or [])
                continue
            for r in poll.get("ranks") or []:
                tid, rank = r.get("teamId"), r.get("rank")
                if tid is None or rank is None:
                    notes.append(f"{name} week {week}: entry with no teamId/rank skipped")
                    continue
                rows.append({"sport": SPORT, "season": int(season), "week": int(week), "poll_type": enum,
                             "poll_date": None, "team_id": str(tid), "rank": int(rank),
                             "points": r.get("points")})
    for name, n in sorted(unmapped.items()):
        notes.append(f"poll not in the poll_type enum, {n} rank(s) skipped (not coerced): {name}")
    return rows, notes


def upsert_rows(db: DB, rows: list[dict[str, Any]], known: set[str]) -> tuple[int, list[str]]:
    """Keyed on the table's own unique (sport, season, week, poll_type, team_id), so a re-run of a week
    updates that week's poll rather than duplicating it."""
    notes: list[str] = []
    n = 0
    for r in rows:
        if r["team_id"] not in known:
            notes.append(f"no teams row for cfbd id {r['team_id']} - rank skipped (never invented)")
            continue
        db.upsert("rankings", [r], "sport, season, week, poll_type, team_id",
                  ["rank", "points", "poll_date"], tag="rankings")
        n += 1
    return n, notes


def known_team_ids() -> set[str]:
    """Always read over a REAL connection, even during --emit-sql.

    DB.fetch() returns [] when there is no connection, which is exactly what --emit-sql sets up. Reading
    the team list through the emitting DB would therefore hand back an empty set, every rank would look
    like a team we do not carry, and the dry run would emit nothing while cheerfully reporting that it
    had skipped all fifty. A dry run has to emit the SAME statements the real run would execute or it is
    not a dry run, so the lookup gets its own short-lived reader.
    """
    reader = DB(None)
    try:
        return {str(t[0]) for t in reader.fetch("select id from teams where sport = %s", (SPORT,))}
    finally:
        reader.close()


def fetch(season: int, weeks: list[int], season_type: str) -> list[dict[str, Any]]:
    load_dotenv(ROOT / ".env")
    token = os.getenv("CFBD_API_KEY")
    if not token:
        raise RuntimeError("CFBD_API_KEY missing from environment or .env")
    from adapters.cfbd import CFBDProvider
    provider = CFBDProvider(token)
    out: list[dict[str, Any]] = []
    for wk in weeks:
        got = provider.fetch_rankings(season, wk, season_type) or []
        print(f"  week {wk:2}: {len(got)} entry(ies)" + ("" if got else "  (no poll published yet)"))
        out.extend(got)
    return out


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--season", type=int, default=2026)
    ap.add_argument("--week", type=int, nargs="+", help="default: every week of the season to date")
    ap.add_argument("--season-type", default="regular")
    ap.add_argument("--from-file", metavar="PATH", help="replay a saved raw payload instead of fetching")
    ap.add_argument("--no-save", action="store_true", help="do not write the raw snapshot")
    ap.add_argument("--emit-sql", metavar="FILE")
    ap.add_argument("--workflow", default="rankings")
    a = ap.parse_args(argv)

    as_of = today_et()
    weeks = a.week or weeks_to_date(as_of)
    raw_path = ROOT / "artifacts" / "validation" / f"rankings_{SPORT}_{a.season}_{as_of}_raw.json"

    db = DB(a.emit_sql)
    try:
        if a.from_file:
            raw = json.loads(Path(a.from_file).read_text(encoding="utf-8"))
            print(f"rankings {a.season} - replaying {a.from_file}")
        else:
            print(f"rankings {a.season} {a.season_type} - weeks {weeks[0]}-{weeks[-1]}")
            raw = fetch(a.season, weeks, a.season_type)
            if not a.no_save:
                dump_json(raw_path, raw)
                print(f"  raw -> {raw_path.relative_to(ROOT)}")

        rows, notes = parse(raw)
        written, more = upsert_rows(db, rows, known_team_ids())
        notes.extend(more)

        by_poll: dict[str, set[int]] = {}
        for r in rows:
            by_poll.setdefault(r["poll_type"], set()).add(r["week"])
        summary = ", ".join(f"{p} ({len(w)} wk)" for p, w in sorted(by_poll.items())) or "-"
        print(f"parsed {len(rows)} - written {written} - polls: {summary}")
        for n in notes:
            print(f"  note: {n}")

        db.run("insert into refresh_runs (workflow, completed_at, status, providers_called, errors, notes) "
               "values (%s, now(), %s, %s, %s, %s)",
               (a.workflow, "succeeded", [SOURCE], json.dumps([]),
                json.dumps({"as_of": as_of, "season": a.season, "weeks": weeks, "parsed": len(rows),
                            "written": written, "notes": notes})),
               tag="refresh_runs")
        db.commit()
        if a.emit_sql:
            print(f"wrote {a.emit_sql} ({len(db.emitted)} statements) - nothing executed")
        else:
            print(f"TOTAL: {written} rankings row(s) - committed")
    except Exception as e:  # noqa: BLE001
        if db.conn is not None:
            db.conn.rollback()
        print(f"ERROR: {type(e).__name__}: {e}", file=sys.stderr)
        return 1
    finally:
        db.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
