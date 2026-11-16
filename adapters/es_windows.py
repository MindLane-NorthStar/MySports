#!/usr/bin/env python3
"""MySports adapter — Cleveland's Sunday NFL windows (three or four) from EntitledSports' weekly coverage pages.

    python -m adapters.es_windows --out "$RUNNER_TEMP/nfl_windows.json"
    python -m adapters.es_windows --out out.json --week 3 --week 4     # the weeks named, no calendar fetch
    python -m adapters.es_windows --out out.json --date 2026-10-04    # that date's week and the next

WHY (prompt 118, Joe's ruling 2026-09-23, register §63). No paid data: Joe did not buy Schedules Direct
and will not, so `adapters/sd_listings.py` stays in the tree dormant (without its secrets it writes
nothing). The free TV guides are out on their terms. The free source that names, for every market, the
game in each of the four Sunday-afternoon windows is EntitledSports' weekly coverage page,
https://entitledsports.com/schedule/nfl/coverage-map/week-<N>/ - CBS Early, FOX Early, CBS Late and
FOX Late, each with the market's station (WOIO 19 for CBS, WJW 8 for FOX in Cleveland-Akron (Canton)).
Its robots.txt (read 2026-09-23) disallows /api/, /v1/, /details/, /metadata/, /hub/, /coverage/,
/conferences/ and /regular-season-, and does not disallow /schedule/. There is no terms page. It is
UNOFFICIAL: it names no source, the late windows often stay TBD until midweek, and a redesign breaks
this reader - and every one of those fails safe, because a window this cannot read is TBD, and TBD
falls through to "Market TBD" (E5).

THE MARKUP, measured on the live week 3 and week 4 pages, 2026-09-23. Each market is one
    <details class="mkd"><summary><a href="/schedule/markets/cleveland-akron-canton/">Cleveland–Akron (Canton)</a></summary>
      <div class="mkd-body">
        <div class="mw"><span class="lw">CBS Early</span><span class="mg">CIN Bengals @ PIT Steelers<span class="st">WOIO 19 (CBS)</span></span></div>
        ... four of these, then an <a class="xlink"> ...
and the page's stamp is
    <span class="upd"><span class="sep"> · </span>updated Wed Sep 23, 5:30 AM ET</span>
The same data also sits in a <table> row per market; this reads the <details> form because it labels
each window by name rather than by column position. A window's text is either "AAA Nick @ HHH Nick"
or "TBD"; anything else is recorded verbatim, becomes TBD, and is noted in the output. Never guessed.

THREE WINDOWS, FROM WEEK 9 (prompt 131, measured on the live week 9 and week 10 pages 2026-11-14). The
page now gives every market three windows: the doubleheader network keeps "Early" and "Late", and the
network with one game in the market is labelled bare, its kickoff added to the station span -
    <div class="mw"><span class="lw">CBS</span><span class="mg">CLE Browns @ NO Saints<span class="st">WOIO 19 (CBS) · 1:00 PM ET</span></span></div>
All 25 blocks on both pages had that shape; "CBS Early" and "CBS Late" appear nowhere. The four-window
reader parsed two windows, raised PageError, and from 2026-11-01 every regional CBS or FOX game without
the Browns fell to rule 6, unseen for nine days because the step's result reached no ledger. Now a bare
label is that network's `single` window (`time` holds the kickoff, `station` keeps the whole span), and a
block is valid in exactly two shapes: the four windows, or one network's early and late plus the other
network's single. Anything else is still a PageError naming the labels it found. Rule 4b
(adapters/espn.py) reads a single window for either slot. The per-week result is written to the file
MYSPORTS_NFL_WINDOWS_STATUS names, on every exit, and pipeline/load.py copies it into
refresh_runs.notes as `nfl_windows`.

WHICH WEEKS. The NFL week containing today (Eastern) and the next one, at most two pages a run. The
week number comes from ESPN's own calendar - `leagues[0].calendar` on the scoreboard payload the ESPN
adapter already fetches, whose regular-season entries carry `value`, `startDate` and `endDate`
(captured in tests/fixtures/espn_nfl_scoreboard_raw.json) - so the number here is the same number
`adapters/espn.py` writes on every game. `--week` overrides it for a replay.

A PAST DATE READS ITS OWN WEEK (prompt 130, queue item 24). `--date D` puts "today" at NOON ET on D, so
the calendar answers with D's week and the next. Noon because ESPN's weeks turn over on Wednesday at
07:00Z (3 AM ET, the fixture's calendar), so noon ET is never within hours of a turnover, and its ET date
is D under daylight or standard time. Without it, a refresh dispatched for a past Sunday read the week of
the real clock, rule 4b had no windows for that Sunday, and every decided regional CBS or FOX game without
the Browns fell to rule 6 (UNVERIFIED). EntitledSports serves past weeks (week 4 and week 5 read
2026-10-15). The workflow passes the flag only on a dispatch that names a date, so the nightly is as it
was.

EACH WEEK'S PAGE STANDS ALONE (prompt 119, Joe's ruling 2026-09-23, register §64). The two pages are
fetched and parsed independently: a week that fails - an HTTP error, a timeout, no Cleveland block,
a block of neither valid shape - is left out with one note naming the week and the reason, and the file is
written whenever at least one week succeeds. In the season's last regular week the next page does not
exist, and that must not cost the current week its decisions. Prompt 118 wrapped both weeks in one
try, so any failure wrote nothing; that was the brief's "a failure of any kind" and it was wrong here.

FAILURE NEVER FAILS THE REFRESH. Every week failing, or a week the calendar cannot place: one log line,
no file, exit 0, and the NFL step behaves as before.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from datetime import date, datetime, time, timezone
from pathlib import Path
from typing import Any, Callable

from adapters.common import ET, http_json, http_text, parse_iso

PAGE_URL = "https://entitledsports.com/schedule/nfl/coverage-map/week-{week}/"
SCOREBOARD_URL = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard"
USER_AGENT = "MySports/1.0 (open-source personal sports guide; +https://github.com/MindLane-NorthStar/MySports)"
MARKET_SLUG = "cleveland-akron-canton"
WINDOW_LABELS = (("CBS", "early"), ("FOX", "early"), ("CBS", "late"), ("FOX", "late"))
NETWORKS = ("CBS", "FOX")
STATUS_ENV = "MYSPORTS_NFL_WINDOWS_STATUS"   # prompt 131: where the per-week result goes for refresh_runs.notes

BLOCK = re.compile(
    r'<details class="mkd"><summary><a href="/schedule/markets/' + re.escape(MARKET_SLUG) +
    r'/">(?P<name>[^<]*)</a></summary>(?P<body>.*?)</details>', re.S)
# The slot is OPTIONAL (prompt 131): a bare "CBS" or "FOX" label is that network's single window.
WINDOW = re.compile(
    r'<div class="mw"><span class="lw">(?P<net>CBS|FOX)(?: (?P<slot>Early|Late))?</span>'
    r'<span class="mg">(?P<text>.*?)<span class="st">(?P<station>[^<]*)</span></span></div>', re.S)
GAME = re.compile(r"^([A-Z]{2,3}) ([A-Za-z0-9]+) @ ([A-Z]{2,3}) ([A-Za-z0-9]+)$")
STAMP = re.compile(r'<span class="upd">(?:<span class="sep">[^<]*</span>)?\s*updated (?P<when>[^<]+)</span>')
# A single window's station span carries its kickoff: "WOIO 19 (CBS) · 1:00 PM ET" (U+00B7, measured 2026-11-14).
STATION_TIME = re.compile(r"\s·\s(?P<time>.+)$")


class PageError(ValueError):
    """The page did not read as a Cleveland block of one of the two valid shapes."""


def valid_shape(seen: set[tuple[str, str]]) -> bool:
    """The only two blocks this decides: the four windows, or one network's early and late plus the
    other network's single window. Anything else - three windows of one network, two singles, a single
    beside its own network's early or late - is not a page this has seen, and is never guessed at."""
    if seen == set(WINDOW_LABELS):
        return True
    for double, single in (NETWORKS, NETWORKS[::-1]):
        if seen == {(double, "early"), (double, "late"), (single, "single")}:
            return True
    return False


def parse_page(html: str) -> dict[str, Any]:
    """The Cleveland block of one coverage page, or PageError. Only the two forms seen are decided."""
    m = BLOCK.search(html)
    if not m:
        raise PageError("no Cleveland-Akron (Canton) block on the page")
    notes: list[str] = []
    windows: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()
    labels: list[str] = []
    for w in WINDOW.finditer(m.group("body")):
        net, slot = w.group("net"), (w.group("slot") or "single").lower()
        labels.append(f"{net} {w.group('slot')}" if w.group("slot") else net)
        text = re.sub(r"\s+", " ", w.group("text")).strip()
        station = w.group("station").strip()                 # the whole span, kickoff suffix and all
        t = STATION_TIME.search(station)
        row: dict[str, Any] = {"network": net, "slot": slot, "station": station, "time": t.group("time").strip() if t else None,
                               "text": text, "away": None, "home": None, "tbd": True}
        g = GAME.match(text)
        if g:
            row["away"] = {"abbr": g.group(1), "nick": g.group(2)}
            row["home"] = {"abbr": g.group(3), "nick": g.group(4)}
            row["tbd"] = False
        elif text != "TBD":
            notes.append(f"{net} {slot}: unrecognized window text {text!r} treated as TBD")
        if (net, slot) in seen:
            raise PageError(f"the {net} {slot} window appears twice")
        seen.add((net, slot))
        windows.append(row)
    if not valid_shape(seen):
        raise PageError(f"{len(windows)} window(s) parsed ({', '.join(labels) or 'none'}); a block is the four windows, "
                        f"or one network's Early and Late and the other's single window")
    s = STAMP.search(html)
    return {"market": m.group("name").strip(), "updated": s.group("when").strip() if s else None,
            "windows": windows, "notes": notes}


def weeks_from_calendar(scoreboard: dict[str, Any], now: datetime) -> tuple[int, int | None]:
    """(the regular-season week containing `now`, the next one or None) from ESPN's calendar."""
    for cal in ((scoreboard.get("leagues") or [{}])[0].get("calendar") or []):
        if str(cal.get("label", "")).lower() != "regular season":
            continue
        entries = cal.get("entries") or []
        for i, e in enumerate(entries):
            a, b = parse_iso(e.get("startDate")), parse_iso(e.get("endDate"))
            if a and b and a <= now <= b:
                nxt = entries[i + 1].get("value") if i + 1 < len(entries) else None
                return int(e["value"]), (int(nxt) if nxt is not None else None)
    raise PageError("today is not inside a regular-season week on ESPN's calendar")


def anchor_noon(day: str) -> datetime:
    """Noon ET on `day` (YYYY-MM-DD), in UTC: the instant `--date` reads the calendar at."""
    return datetime.combine(date.fromisoformat(day), time(12), tzinfo=ET).astimezone(timezone.utc)


def default_fetch_text(url: str) -> str:
    return http_text(url, headers={"User-Agent": USER_AGENT})


def default_fetch_scoreboard(now: datetime) -> dict[str, Any]:
    return http_json(SCOREBOARD_URL, params={"dates": now.astimezone(ET).strftime("%Y%m%d")})


def build(weeks: list[int], *, fetch_text: Callable[[str], str] = default_fetch_text) -> tuple[dict[str, Any], dict[int, str]]:
    """(the output, {week: result}) - each week fetched and parsed on its own; a failed week is left out
    of `weeks` and named in `notes`, and never costs another week its windows."""
    out: dict[str, Any] = {"source": "entitledsports", "market": None,
                           "fetchedAt": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
                           "weeks": {}, "notes": []}
    results: dict[int, str] = {}
    for wk in weeks:
        url = PAGE_URL.format(week=wk)
        try:
            page = parse_page(fetch_text(url))
        except Exception as e:  # noqa: BLE001 - this week is left out; the others stand
            out["notes"].append(f"week {wk}: left out ({type(e).__name__}: {e})")
            results[wk] = f"failed ({type(e).__name__}: {e})"
            continue
        out["market"] = page["market"]
        out["weeks"][str(wk)] = {"url": url, "updated": page["updated"], "windows": page["windows"]}
        out["notes"] += [f"week {wk}: {n}" for n in page["notes"]]
        named = sum(1 for x in page["windows"] if not x["tbd"])
        results[wk] = f"{named} of {len(page['windows'])} windows named"
    return out, results


def write_status(status: dict[str, Any], path: str | None = None) -> None:
    """The run's per-week result, for the load's refresh_runs.notes (prompt 131). Written on EVERY exit -
    a failure most of all - to the file MYSPORTS_NFL_WINDOWS_STATUS names; nothing when it is unset.
    Never raises: the step's contract is exit 0 whatever happens (prompt 118)."""
    p = path if path is not None else os.getenv(STATUS_ENV)
    if not p:
        return
    try:
        Path(p).parent.mkdir(parents=True, exist_ok=True)
        Path(p).write_text(json.dumps({"source": "entitledsports", **status}, ensure_ascii=False) + "\n",
                           encoding="utf-8", newline="\n")
    except OSError:
        pass


def main(argv: list[str] | None = None, *, fetch_text: Callable[[str], str] | None = None,
         fetch_scoreboard: Callable[[datetime], dict[str, Any]] | None = None,
         now: datetime | None = None, log: Callable[[str], None] = print) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--out", required=True, help="where to write the windows JSON")
    ap.add_argument("--week", type=int, action="append", help="a week to fetch (repeatable); default: this week and the next")
    ap.add_argument("--date", help="anchor day YYYY-MM-DD (ET): that date's week and the next, read at noon ET")
    args = ap.parse_args(argv)
    fetch_text = fetch_text or default_fetch_text
    fetch_scoreboard = fetch_scoreboard or default_fetch_scoreboard
    try:
        if args.date:
            now = anchor_noon(args.date)
    except ValueError as e:   # a bad --date is no week to fetch: one line, no file, exit 0
        log(f"es_windows: failed (ValueError: {e}) - no windows written, refresh continues")
        write_status({"written": False, "weeks": {}, "error": f"ValueError: {e}"})
        return 0
    now = now or datetime.now(timezone.utc)
    try:
        if args.week:
            weeks = list(dict.fromkeys(args.week))[:2]
            how = "weeks named on the command line"
        else:
            cur, nxt = weeks_from_calendar(fetch_scoreboard(now), now)
            weeks = [cur] + ([nxt] if nxt is not None else [])
            how = "ESPN calendar"
    except Exception as e:  # noqa: BLE001 - no week to fetch: one line, no file, exit 0
        log(f"es_windows: failed ({type(e).__name__}: {e}) - no windows written, refresh continues")
        write_status({"written": False, "weeks": {}, "error": f"{type(e).__name__}: {e}"})
        return 0
    out, results = build(weeks, fetch_text=fetch_text)   # each week on its own; never raises
    per_week = "; ".join(f"week {wk} {results[wk]}" for wk in weeks)
    status_weeks = {str(wk): (f"ok: {results[wk]}" if str(wk) in out["weeks"] else results[wk]) for wk in weeks}
    if not out["weeks"]:
        log(f"es_windows: every week failed ({how}: {per_week}) - no windows written, refresh continues")
        write_status({"written": False, "how": how, "weeks": status_weeks})
        return 0
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    Path(args.out).write_text(json.dumps(out, indent=1, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")
    log(f"es_windows: {how}: {per_week}; {len(out['notes'])} note(s) -> {args.out}")
    write_status({"written": True, "how": how, "weeks": status_weeks})
    return 0


if __name__ == "__main__":
    sys.exit(main())
