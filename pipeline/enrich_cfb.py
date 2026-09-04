#!/usr/bin/env python3
"""CFB ranks, records and rivalry flags into mysports.games (prompt 15 stage 4; no schema change).

    python -m pipeline.enrich_cfb --week 1
    python -m pipeline.enrich_cfb --week 1 --fetch          # run the probe first (CFBD key from .env)
    python -m pipeline.enrich_cfb --latest-week --fetch
    python -m pipeline.enrich_cfb --rivalries-only          # every loaded week, no enrichment file needed

`games.home_rank / away_rank / home_record / away_record / is_rivalry / rivalry_id` existed but were
null for every game: the PC renderer read them out of `artifacts/validation/cfbd_{year}_week{N}_
enrichment.json` directly, so nothing ever put them in the database and the web app could not draw a
rank prefix or a marquee plate. This gives them a loader path.

**Doctrine (0007 scores, 0008 probables, and now these): loader-written PROVIDER FACTS, not reconciled
observations.** One structured provider states the poll and the records; there is no second source to
weigh, so spec §9.6 does not apply and the reconciler neither reads nor writes these columns.

**Why a separate module rather than a step inside pipeline/load.py** (logged decision, 2026-09-03):
load.py runs on every refresh and consumes adapter FIXTURES; this runs weekly, after the poll drops,
and consumes the ENRICHMENT file. Different cadence, different input, different failure mode - a poll
that has not been published yet must not look like a broken load.

Null-safety, stated precisely because the two halves pull against each other:

  * **Ranks are per-POLL.** If the enrichment file carries a poll, that poll is authoritative for the
    whole slate: every game in the week is set from it, INCLUDING back to null for a team that dropped
    out. That is what "a changed rank overwrites" has to mean - a team leaving the top 25 is news, and
    coalescing would freeze last week's number forever. If the file carries NO poll (week 8 today:
    source null, zero ranked), ranks are not touched at all, so a missing or failed poll can never
    erase a good one.
  * **Records only ever accumulate**, so a team absent from the records block keeps what it has
    (coalesce). A present team is overwritten.

**`away_rank` IS written, and the lopsided counts are the slate, not a bug** (investigated 2026-09-04,
recorded so nobody re-opens it). 2026 week 1 has `home_rank` on 23 of 99 games and `away_rank` on 3,
which looks like a one-sided loader. It is not: RANKS_SQL sets both columns from two symmetric rank_of()
calls, and cross-checking every week-1 game against `mysports.rankings` - a table loaded from a wholly
separate path (pipeline/rankings.py) - gives **exactly 23 AP-ranked home teams and exactly 3 AP-ranked
away teams, with zero games ranked in the poll but null in the column, on either side.** Week 1 is
ranked teams hosting; that is all this is.

The specific counter-example that prompted the check, Clemson at LSU with a null away rank, is also
correct: **Clemson is not in the 2026 AP top 25.** It appears only in the Coaches poll at #23, and
rank_of() deliberately never reads Coaches (Playoff Committee, else AP). A null there is the honest
answer, not a miss.

Windows-portable: no %-strftime, every open() passes encoding=, ASCII console, the DSN is never printed.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path
from typing import Any

from pipeline.db import DB, ROOT

# Kept in step with scripts/render_day.py's CONF_ABBR - that module parses argv at import time, so it
# cannot be imported here. If one changes, change both.
CONF_ABBR = {
    "American Athletic": "AAC", "Conference USA": "CUSA", "Mid-American": "MAC", "Mountain West": "MW",
    "Sun Belt": "SBC", "Big Ten": "BIG TEN", "Big 12": "BIG 12", "Pac-12": "PAC-12", "SEC": "SEC",
    "ACC": "ACC", "FBS Independents": None,
}

# Ranks and records are single-valued provider facts; both statements are null-safe by construction.
RANKS_SQL = """
update games set home_rank = %s, away_rank = %s where id = %s
"""
RECORDS_SQL = """
update games set
  home_record = coalesce(%s, home_record),
  away_record = coalesce(%s, away_record)
where id = %s
"""
RIVALRY_SQL = """
update games g set is_rivalry = true, rivalry_id = r.id
from rivalries r
where g.sport = 'cfb' and r.sport = 'cfb' and r.active
  and ((g.home_team_id = r.team_a_id and g.away_team_id = r.team_b_id)
    or (g.home_team_id = r.team_b_id and g.away_team_id = r.team_a_id))
  and (g.rivalry_id is distinct from r.id or g.is_rivalry is distinct from true)
"""

GAMES_SQL = """
select g.id, g.home_team_id, g.away_team_id, ch.name, ca.name
from games g
left join teams th on th.id = g.home_team_id
left join teams ta on ta.id = g.away_team_id
left join conferences ch on ch.id = th.conference_id
left join conferences ca on ca.id = ta.conference_id
where g.sport = 'cfb' and g.season = %s and g.week = %s
"""


def enrichment_path(year: int, week: int) -> Path:
    return ROOT / "artifacts" / "validation" / f"cfbd_{year}_week{week}_enrichment.json"


def fetch_enrichment(year: int, week: int) -> None:
    """Run the existing probe. It owns the CFBD call and the §6 poll rule; this module never re-implements it."""
    cmd = [sys.executable, str(ROOT / "scripts" / "probe_enrichment.py"), "--year", str(year), "--week", str(week)]
    print(f"  fetching enrichment for {year} week {week} ...")
    r = subprocess.run(cmd, cwd=str(ROOT), capture_output=True, text=True)
    for line in (r.stdout or "").splitlines()[-6:]:
        print(f"    {line}")
    if r.returncode != 0:
        raise RuntimeError(f"probe_enrichment failed ({r.returncode}): {(r.stderr or '').strip()[:300]}")


def rank_of(ranking: dict[str, Any], team_id: str, school: str | None) -> int | None:
    """§6 ranking rule: the probe already chose Playoff Committee over AP and never Coaches; this only
    looks the team up in whichever poll it chose. Id first, school name as the fallback."""
    by_id = ranking.get("byTeamId") or {}
    by_school = ranking.get("bySchool") or {}
    v = by_id.get(str(team_id))
    if v is None and school:
        v = by_school.get(school)
    try:
        return int(v) if v is not None else None
    except (TypeError, ValueError):
        return None


def record_display(rec: dict[str, Any] | None, own_conf: str | None, other_conf: str | None) -> str | None:
    """'1-0' or '1-0, 0-0 ACC' - the renderer's record_label, minus its parentheses.

    Suppressed at 0-0 (contract v1.1: a record run before a team's first game says nothing), and the
    conference form appears only when BOTH teams are in the same conference (Joe, 2026-08-31).
    """
    if not rec:
        return None
    txt = rec.get("display")
    if not txt or txt == "0-0":
        return None
    conf_rec = (rec.get("conf") or {}).get("display")
    if own_conf and own_conf == other_conf and conf_rec:
        abbr = CONF_ABBR.get(own_conf, own_conf.upper())
        if abbr:
            txt = f"{txt}, {conf_rec} {abbr}"
    return txt


def apply_week(db: DB, year: int, week: int, data: dict[str, Any]) -> dict[str, int]:
    ranking = data.get("ranking") or {}
    records = data.get("records") or {}
    has_poll = bool(ranking.get("source")) and bool(ranking.get("byTeamId") or ranking.get("bySchool"))
    counts = {"games": 0, "ranked_sides": 0, "record_sides": 0, "ranks_skipped_no_poll": 0}

    rows = db.fetch(GAMES_SQL, (year, week))
    for gid, home_id, away_id, home_conf, away_conf in rows:
        counts["games"] += 1
        hrec = records.get(str(home_id)) or {}
        arec = records.get(str(away_id)) or {}

        if has_poll:
            hr = rank_of(ranking, home_id, hrec.get("team"))
            ar = rank_of(ranking, away_id, arec.get("team"))
            db.run(RANKS_SQL, (hr, ar, gid), tag="games.ranks")
            counts["ranked_sides"] += sum(1 for v in (hr, ar) if v is not None)
        else:
            counts["ranks_skipped_no_poll"] += 1

        hd = record_display(hrec, home_conf, away_conf)
        ad = record_display(arec, away_conf, home_conf)
        if hd or ad:
            db.run(RECORDS_SQL, (hd, ad, gid), tag="games.records")
            counts["record_sides"] += sum(1 for v in (hd, ad) if v is not None)
    return counts


def apply_rivalries(db: DB) -> int:
    """Flag every CFB game whose two clubs are a known rivalry, in either orientation.

    Both `is_rivalry` AND `rivalry_id` are set. The TIER is not copied onto games and does not need to
    be: `rivalries.tier` is one join away through that FK, so the marquee's tier-1 criterion is fully
    expressible without a new column (logged 2026-09-03 - no schema change in this prompt).
    """
    db.run(RIVALRY_SQL, tag="games.rivalry")
    rows = db.fetch("select count(*) from games where sport = 'cfb' and is_rivalry")
    return int(rows[0][0]) if rows else 0


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--week", type=int, action="append", help="cfb week (repeatable)")
    ap.add_argument("--latest-week", action="store_true", help="use the newest loaded week")
    ap.add_argument("--year", type=int, default=2026)
    ap.add_argument("--fetch", action="store_true", help="refresh the enrichment file from CFBD first")
    ap.add_argument("--rivalries-only", action="store_true", help="only set the rivalry flags")
    ap.add_argument("--emit-sql", metavar="FILE")
    ap.add_argument("--workflow", default="claude-code")
    args = ap.parse_args(argv)

    db = DB(args.emit_sql)
    totals: dict[str, int] = {}
    try:
        weeks: list[int] = list(args.week or [])
        if args.latest_week:
            rows = db.fetch("select max(week) from games where sport = 'cfb' and season = %s", (args.year,))
            if rows and rows[0][0] is not None:
                weeks.append(int(rows[0][0]))
        if not args.rivalries_only and not weeks:
            print("ERROR: give --week N (repeatable), --latest-week, or --rivalries-only", file=sys.stderr)
            return 2

        for week in sorted(set(weeks)):
            if args.fetch:
                try:
                    fetch_enrichment(args.year, week)
                except Exception as e:  # noqa: BLE001 - a fetch failure falls back to the saved file
                    print(f"  warn: {e} - using the saved enrichment file if there is one")
            path = enrichment_path(args.year, week)
            if not path.exists():
                print(f"  week {week}: no {path.name} - skipped")
                continue
            data = json.loads(path.read_text(encoding="utf-8"))
            c = apply_week(db, args.year, week, data)
            src = (data.get("ranking") or {}).get("source")
            print(f"  week {week}: {c['games']} game(s) - poll {src or 'NONE (ranks untouched)'} - "
                  f"{c['ranked_sides']} ranked side(s), {c['record_sides']} record side(s)")
            for k, v in c.items():
                totals[k] = totals.get(k, 0) + v

        flagged = apply_rivalries(db)
        print(f"  rivalries: {flagged} cfb game(s) flagged")
        totals["rivalry_games"] = flagged
        db.commit()
        print("TOTAL: " + " - ".join(f"{k} {v}" for k, v in totals.items()) +
              ("" if args.emit_sql else " - committed"))
        if args.emit_sql:
            print(f"wrote {args.emit_sql} ({len(db.emitted)} statements)")
    except Exception as e:  # noqa: BLE001
        if db.conn is not None:
            db.conn.rollback()
        print(f"ERROR: {e}", file=sys.stderr)
        return 1
    finally:
        db.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
