#!/usr/bin/env python3
"""One-time reconciliation: close out games stuck in `in_progress` long after they can still be playing.

    python scripts/backfill_stale_finals.py --emit-sql artifacts/stale_finals.sql   # write nothing, emit the SQL
    python scripts/backfill_stale_finals.py                                         # execute it

WHY THIS RE-FETCHES INSTEAD OF JUST FLIPPING THE STATUS. The plan this replaces was to set
`result_status = 'final'` on the stale rows that already carried a plausible score, and to re-fetch only
the ones reading 0 - 0 on the grounds that flipping those would freeze a wrong 0-0 into the record for
good. Asking the provider about all twelve showed the premise was wrong: **every one of the stored
scores was a mid-game snapshot, not a final.** Mariners at Red Sox was stored 9 - 1 and finished 9 - 6;
Tigers at Twins was stored 1 - 1 and finished 2 - 15. A plausible-looking score is not a correct one.

So the rule Joe gave for the 0-0 rows is simply the right rule for all of them: the provider decides.
This script asks statsapi for the final and writes what it says. A row the provider does not call Final
is left exactly as it is and reported as a provider gap - it is never guessed at, and never frozen.

Two smaller consequences of that, both deliberate:

  * THE SCORES ARE REWRITTEN, not just the status. Leaving the snapshot in place while marking the row
    final would publish a wrong score with a Final label on it, which is worse than the stale row was.
  * A TIED SCORE WAS THE TELL. Two rows read 2 - 2 and 1 - 1. MLB does not end regular-season games
    level, so those could not have been finals whatever else was true of them - the same evidence the
    0-0 rows were carrying, only quieter.

ONLY result_status, away_score and home_score ARE WRITTEN, and only on a row that is still
`in_progress`. completed_at and boxscore_url are left as the pipeline wrote them; nothing is inserted
or deleted. Re-running is a no-op.

The staleness cut mirrors web/lib/format.js's STALE_LIVE_HOURS - the display guard (`Final pending`)
and this reconciliation must agree about which rows are stale, so the two constants move together.
Windows-portable: encoding= on every open(), ASCII console output.
"""
from __future__ import annotations

import argparse
import sys
from datetime import timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from adapters.common import result_status  # noqa: E402
from adapters.mlb import fetch_day  # noqa: E402
from pipeline.db import DB  # noqa: E402

# Mirrors STALE_LIVE_HOURS in web/lib/format.js. Longest MLB games run about seven hours; a
# weather-delayed football game reaches six. Eight clears both.
STALE_LIVE_HOURS = 8
ET = ZoneInfo("America/New_York")

SELECT_STALE = """
select g.id, g.sport::text, g.canonical_kickoff_at_utc, g.away_score, g.home_score,
       ta.short_name, th.short_name
  from games g
  left join teams ta on ta.id = g.away_team_id
  left join teams th on th.id = g.home_team_id
 where g.result_status = 'in_progress'
   and g.canonical_kickoff_at_utc < now() - interval '%d hours'
 order by g.canonical_kickoff_at_utc, g.id
""" % STALE_LIVE_HOURS


def provider_finals(kickoffs: list) -> dict[str, dict]:
    """statsapi's verdict for every game on the ET days these kickoffs touch, keyed by our game id.

    The day either side is fetched too: a 00:40 UTC kickoff is the previous evening in ET, and statsapi
    files a game under its own scheduled date, which is not always the date our UTC instant lands on.
    """
    days = set()
    for ko in kickoffs:
        d = ko.astimezone(ET).date()
        days.update({d - timedelta(days=1), d, d + timedelta(days=1)})
    out: dict[str, dict] = {}
    for d in sorted(days):
        raw = fetch_day(d.isoformat())
        for dt in raw.get("dates", []):
            for g in dt.get("games", []):
                st = g.get("status") or {}
                teams = g.get("teams") or {}
                out[f"mlb-{g.get('gamePk')}"] = {
                    "status": result_status(st.get("abstractGameState"), detail=st.get("detailedState"),
                                            context=f"mlb {g.get('gamePk')}"),
                    "detailed": st.get("detailedState"),
                    "away": (teams.get("away") or {}).get("score"),
                    "home": (teams.get("home") or {}).get("score"),
                }
    return out


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--emit-sql", metavar="PATH", default=None,
                    help="collect the statements into PATH instead of executing them")
    a = ap.parse_args(argv)

    reader = DB(None)
    try:
        rows = reader.fetch(SELECT_STALE)
    finally:
        reader.close()

    print("stale in_progress rows more than %d hours past kickoff: %d" % (STALE_LIVE_HOURS, len(rows)))
    if not rows:
        return 0
    other = [r for r in rows if r[1] != "mlb"]
    if other:
        # Only the MLB adapter is wired in here. A stale row in another sport is a real finding and
        # must not be silently skipped.
        print("STOP: %d stale rows are not MLB and this script cannot speak for them: %s"
              % (len(other), ", ".join(r[0] for r in other)), file=sys.stderr)
        return 1

    finals = provider_finals([r[2] for r in rows])

    writes, gaps = [], []
    for gid, sport, ko, away, home, an, hn in rows:
        p = finals.get(gid)
        if not p or p["status"] != "final" or p["away"] is None or p["home"] is None:
            gaps.append((gid, an, hn, away, home, (p or {}).get("detailed", "not returned")))
            continue
        writes.append((gid, an, hn, away, home, p["away"], p["home"]))

    print("  provider says FINAL -> rewrite status and score : %d" % len(writes))
    for gid, an, hn, oa, oh, na, nh in writes:
        flag = "" if (oa, oh) == (na, nh) else "   <- stored score was WRONG"
        print("      %-14s %-11s %s - %s %-11s  stored %s - %s%s" % (gid, an, na, nh, hn, oa, oh, flag))
    print("  provider has no final -> left in_progress : %d" % len(gaps))
    for gid, an, hn, oa, oh, why in gaps:
        print("      %-14s %s %s - %s %s   provider: %s" % (gid, an, oa, oh, hn, why))

    if not writes:
        print("nothing to write")
        return 0

    db = DB(a.emit_sql)
    try:
        for gid, _an, _hn, _oa, _oh, na, nh in writes:
            # The `and result_status = 'in_progress'` guard makes this idempotent and stops it
            # overwriting a status that changed between the read above and this write.
            db.run("update games set result_status = 'final', away_score = %s, home_score = %s "
                   "where id = %s and result_status = 'in_progress'", (na, nh, gid), tag="stale_final")
        db.commit()
    finally:
        db.close()

    if a.emit_sql:
        print("emitted %d statements -> %s (nothing executed)" % (len(writes), a.emit_sql))
    else:
        print("executed %d updates" % len(writes))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
