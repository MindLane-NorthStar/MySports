#!/usr/bin/env python3
"""MySports adapter — Cleveland's four Sunday NFL windows from EntitledSports' weekly coverage pages.

    python -m adapters.es_windows --out "$RUNNER_TEMP/nfl_windows.json"
    python -m adapters.es_windows --out out.json --week 3 --week 4     # the weeks named, no calendar fetch

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

WHICH WEEKS. The NFL week containing today (Eastern) and the next one, at most two pages a run. The
week number comes from ESPN's own calendar - `leagues[0].calendar` on the scoreboard payload the ESPN
adapter already fetches, whose regular-season entries carry `value`, `startDate` and `endDate`
(captured in tests/fixtures/espn_nfl_scoreboard_raw.json) - so the number here is the same number
`adapters/espn.py` writes on every game. `--week` overrides it for a replay.

FAILURE NEVER FAILS THE REFRESH. An HTTP error, a timeout, no Cleveland block, fewer than four windows,
or a week the calendar cannot place: one log line, no file, exit 0, and the NFL step behaves as before.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

from adapters.common import ET, http_json, http_text, parse_iso

PAGE_URL = "https://entitledsports.com/schedule/nfl/coverage-map/week-{week}/"
SCOREBOARD_URL = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard"
USER_AGENT = "MySports/1.0 (open-source personal sports guide; +https://github.com/MindLane-NorthStar/MySports)"
MARKET_SLUG = "cleveland-akron-canton"
WINDOW_LABELS = (("CBS", "early"), ("FOX", "early"), ("CBS", "late"), ("FOX", "late"))

BLOCK = re.compile(
    r'<details class="mkd"><summary><a href="/schedule/markets/' + re.escape(MARKET_SLUG) +
    r'/">(?P<name>[^<]*)</a></summary>(?P<body>.*?)</details>', re.S)
WINDOW = re.compile(
    r'<div class="mw"><span class="lw">(?P<net>CBS|FOX) (?P<slot>Early|Late)</span>'
    r'<span class="mg">(?P<text>.*?)<span class="st">(?P<station>[^<]*)</span></span></div>', re.S)
GAME = re.compile(r"^([A-Z]{2,3}) ([A-Za-z0-9]+) @ ([A-Z]{2,3}) ([A-Za-z0-9]+)$")
STAMP = re.compile(r'<span class="upd">(?:<span class="sep">[^<]*</span>)?\s*updated (?P<when>[^<]+)</span>')


class PageError(ValueError):
    """The page did not read as a Cleveland block with four windows."""


def parse_page(html: str) -> dict[str, Any]:
    """The Cleveland block of one coverage page, or PageError. Only the two forms seen are decided."""
    m = BLOCK.search(html)
    if not m:
        raise PageError("no Cleveland-Akron (Canton) block on the page")
    notes: list[str] = []
    windows: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()
    for w in WINDOW.finditer(m.group("body")):
        net, slot = w.group("net"), w.group("slot").lower()
        text = re.sub(r"\s+", " ", w.group("text")).strip()
        station = w.group("station").strip()
        row: dict[str, Any] = {"network": net, "slot": slot, "station": station, "text": text,
                               "away": None, "home": None, "tbd": True}
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
    if len(windows) < 4 or seen != set(WINDOW_LABELS):
        raise PageError(f"{len(windows)} window(s) parsed; four are required")
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


def default_fetch_text(url: str) -> str:
    return http_text(url, headers={"User-Agent": USER_AGENT})


def default_fetch_scoreboard(now: datetime) -> dict[str, Any]:
    return http_json(SCOREBOARD_URL, params={"dates": now.astimezone(ET).strftime("%Y%m%d")})


def build(weeks: list[int], *, fetch_text: Callable[[str], str] = default_fetch_text) -> dict[str, Any]:
    out: dict[str, Any] = {"source": "entitledsports", "market": None,
                           "fetchedAt": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
                           "weeks": {}, "notes": []}
    for wk in weeks:
        url = PAGE_URL.format(week=wk)
        page = parse_page(fetch_text(url))
        out["market"] = page["market"]
        out["weeks"][str(wk)] = {"url": url, "updated": page["updated"], "windows": page["windows"]}
        out["notes"] += [f"week {wk}: {n}" for n in page["notes"]]
    return out


def main(argv: list[str] | None = None, *, fetch_text: Callable[[str], str] | None = None,
         fetch_scoreboard: Callable[[datetime], dict[str, Any]] | None = None,
         now: datetime | None = None, log: Callable[[str], None] = print) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--out", required=True, help="where to write the windows JSON")
    ap.add_argument("--week", type=int, action="append", help="a week to fetch (repeatable); default: this week and the next")
    args = ap.parse_args(argv)
    fetch_text = fetch_text or default_fetch_text
    fetch_scoreboard = fetch_scoreboard or default_fetch_scoreboard
    now = now or datetime.now(timezone.utc)
    try:
        if args.week:
            weeks = list(dict.fromkeys(args.week))[:2]
            how = "weeks named on the command line"
        else:
            cur, nxt = weeks_from_calendar(fetch_scoreboard(now), now)
            weeks = [cur] + ([nxt] if nxt is not None else [])
            how = "ESPN calendar"
        out = build(weeks, fetch_text=fetch_text)
    except Exception as e:  # noqa: BLE001 - one line, no file, exit 0: the refresh must not fail on windows
        log(f"es_windows: failed ({type(e).__name__}: {e}) - no windows written, refresh continues")
        return 0
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    Path(args.out).write_text(json.dumps(out, indent=1, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")
    named = sum(1 for w in out["weeks"].values() for x in w["windows"] if not x["tbd"])
    log(f"es_windows: weeks {', '.join(out['weeks'])} ({how}), {named} of {4 * len(out['weeks'])} windows named, "
        f"{len(out['notes'])} note(s) -> {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
