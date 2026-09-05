#!/usr/bin/env python3
"""WWE weekly shows and premium live events from wwe.com, as `programs` rows.

    python -m adapters.wwe --through 2026-12-31
    python -m adapters.wwe --premier tests/fixtures/wwe_premier_shows.html \\
                           --events  tests/fixtures/wwe_events.html --through 2026-12-31

SCOPE, register section 7 Q7: **Raw, SmackDown, main-roster PLEs. NXT NEVER.** The Premier Shows
block lists NXT ("Tuesdays at 8 ET/7 CT on The CW") right beside the rest and this adapter drops it,
along with AAA's TripleMania and the WWE/AAA/NXT Worlds Collide crossover - none of them is a
main-roster WWE show and two of them are not WWE at all.

TWO SURFACES, JOINED ON THE DATE. Both were verified fetch-clean in docs/research/wwe.md section 1
and re-verified from this laptop at 200:

  * **The "Premier Shows" block**, present on every show page, is a plain-text season calendar -
    "Monday at 8 ET/5 PT on Netflix", "Fridays at 8 ET/7 CT on USA", "Saturday, Oct. 10 at 6 ET/3 PT
    on ESPN with the Unlimited Plan". It gives the SLOTS and the PLATFORMS, and dates for the PLEs.
  * **wwe.com/events** is the ticketing calendar: `le-card-meta-title` / `-date` / `-venue` triples.
    It gives the NAMES and the VENUES the Premier Shows block does not carry.

THE DUAL LISTING, LOADED AS THE RESEARCH RULED. The block lists each PLE TWICE - once on "ESPN with
the Unlimited Plan" and once on "Netflix", for both Oct 10 and Nov 28. docs/research/wwe.md section 2
reads that as wwe.com being a global page with Netflix as the international carrier, and marks it
UNVERIFIED. **ESPN Unlimited only is loaded**, and both dates are reported as a watch item - the
brief's ruling. If Netflix does carry them in the U.S. it changes nothing about whether Joe can
watch (he has both); it changes which chips the card shows.

CREWS ARE OMITTED, and that is a decision rather than a gap. docs/research/wwe.md section 6 is blunt:
"WWE crews cannot be *sourced* from WWE itself with any regularity" - they are REPORTED by trades,
not announced. The design of record's crew tier takes announcements only, so `hosts_crew` is empty
on every row here. Register section 17's hand-curation amendment covers College GameDay and Big Noon
Kickoff ONLY.
"""

from __future__ import annotations

import argparse
import html as _html
import json
import re
import urllib.request
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

from adapters.common import find_repo_root, iso_utc, ua_for

ROOT = find_repo_root()
ET = ZoneInfo("America/New_York")

PREMIER_URL = "https://www.wwe.com/shows/smackdown"
EVENTS_URL = "https://www.wwe.com/events"

MONTHS = {m: i + 1 for i, m in enumerate(
    ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"])}
WEEKDAYS = {"Monday": 0, "Tuesday": 1, "Wednesday": 2, "Thursday": 3,
            "Friday": 4, "Saturday": 5, "Sunday": 6}

# The two weekly shows in scope, and what the Premier Shows block calls their slot. NXT's line
# ("Tuesdays ... on The CW") is deliberately absent: register section 7 Q7 dropped it entirely.
WEEKLY = {
    "Monday Night Raw": {"weekday": 0, "slot_word": "Monday", "brand_key": "wwe",
                         "duration_key": "wwe-raw"},
    "Friday Night SmackDown": {"weekday": 4, "slot_word": "Friday", "brand_key": "wwe",
                               "duration_key": "wwe-smackdown"},
}

# Platform strings the block writes, mapped to what the access profile calls them.
PLATFORM = {
    "netflix": "Netflix",
    "usa": "USA Network",
    "peacock": "Peacock",
    "espn with the unlimited plan": "ESPN Unlimited",
    "espn": "ESPN Unlimited",
    "youtube": "YouTube",
    "the cw": "The CW",
}

# The block lists every PLE twice, once per carrier. Only this one is loaded; see the docstring.
US_PLE_PLATFORM = "ESPN Unlimited"

# Shows on wwe.com/events that are NOT main-roster WWE. Matched on the title so a new AAA or NXT
# co-production is dropped by the same rule rather than needing a code change.
NOT_MAIN_ROSTER = ("triplemania", "worlds collide", "nxt", "evolve")


def _clean(s: str) -> str:
    return _html.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", s))).strip()


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": ua_for(url),
                                               "Accept": "text/html,*/*;q=0.8"})
    with urllib.request.urlopen(req, timeout=45) as resp:
        return resp.read().decode("utf-8", errors="replace")


# --------------------------------------------------------------------------- the Premier Shows block
def premier_shows(page: str, year: int) -> dict[str, Any]:
    """`{"slots": {word: platform}, "dated": [(date, hour, minute, platform)]}` from the block.

    Parsed from the block's TEXT rather than its markup: it is a run of plain sentences inside a
    carousel whose classes change with the page, and the sentences are the stable part.
    """
    text = _clean(page)
    start = text.find("Premier Shows")
    window = text[start:start + 1200] if start >= 0 else text

    slots: dict[str, str] = {}
    for word, platform in re.findall(
            r"\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)s?"
            r"\s+at\s+\d{1,2}\s+ET/\d{1,2}\s+(?:PT|CT)\s+on\s+([A-Za-z0-9+ ]+?)(?=\s+(?:Watch|[A-Z][a-z]+day|$))",
            window):
        slots.setdefault(word, PLATFORM.get(platform.strip().lower(), platform.strip()))

    dated: list[tuple[date, int, int, str]] = []
    for _wd, mon, day, hour, platform in re.findall(
            r"\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+"
            r"([A-Z][a-z]{2})\w*\.?\s+(\d{1,2}),?\s+at\s+(\d{1,2})\s+ET/\d{1,2}\s+(?:PT|CT)\s+on\s+"
            r"([A-Za-z0-9+ ]+?)(?=\s+(?:Watch|[A-Z][a-z]+day|$))", window):
        if mon not in MONTHS:
            continue
        # The block writes a 12-hour clock with no meridiem: every WWE start is an evening one, so
        # a value under 12 is PM. Asserted rather than assumed - the block's own PT/CT twin proves
        # it (8 ET/5 PT is 8 PM, not 8 AM).
        h = int(hour)
        h = h + 12 if h < 12 else h
        dated.append((date(year, MONTHS[mon], int(day)), h, 0,
                      PLATFORM.get(platform.strip().lower(), platform.strip())))
    return {"slots": slots, "dated": dated}


# --------------------------------------------------------------------------- wwe.com/events
def events(page: str, year: int) -> list[dict[str, Any]]:
    """`[{title, date, venue}]` from the ticketing calendar's `le-card-meta` triples."""
    out = []
    for block in re.findall(r'<div class="le-card-meta">(.*?)</div>', page, re.S):
        title = re.search(r'le-card-meta-title">(.*?)</h3>', block, re.S)
        when = re.search(r'le-card-meta-date">(.*?)</p>', block, re.S)
        where = re.search(r'le-card-meta-venue">(.*?)</p>', block, re.S)
        if not (title and when):
            continue
        m = re.match(r"[A-Za-z]+,\s+([A-Z][a-z]+)\s+(\d{1,2})", _clean(when.group(1)))
        if not m or m.group(1)[:3] not in MONTHS:
            continue
        out.append({"title": _clean(title.group(1)),
                    "date": date(year, MONTHS[m.group(1)[:3]], int(m.group(2))),
                    "venue": _clean(where.group(1)) if where else None})
    return out


def is_main_roster(title: str) -> bool:
    low = (title or "").lower()
    return not any(k in low for k in NOT_MAIN_ROSTER)


# --------------------------------------------------------------------------- rows
def _durations() -> dict[str, Any]:
    with open(ROOT / "data" / "duration_defaults.json", encoding="utf-8") as fh:
        return json.load(fh)


def bcast(service: str, primary: bool = True) -> dict[str, Any]:
    streaming = service in ("Netflix", "Peacock", "ESPN Unlimited", "YouTube")
    return {"service_id": service, "label": service,
            "delivery_surface": "STREAMING" if streaming else "LINEAR",
            "feed_side": "NATIONAL", "is_primary": primary, "requires_auth": streaming}


def weekly_rows(slots: dict[str, str], venues: dict[date, str], start: date, through: date,
                defaults: dict) -> list[dict[str, Any]]:
    """One row per air date for Raw and SmackDown, from the slot the block states."""
    by_show = (defaults.get("weekly_show") or {}).get("by_show") or {}
    rows: list[dict[str, Any]] = []
    for title, cfg in WEEKLY.items():
        platform = slots.get(cfg["slot_word"])
        if not platform:
            continue                       # the block did not state this slot; invent nothing
        minutes = int((by_show.get(cfg["duration_key"]) or {}).get("minutes")
                      or (defaults.get("weekly_show") or {}).get("default") or 180)
        d = start
        while d.weekday() != cfg["weekday"]:
            d += timedelta(days=1)
        while d <= through:
            when = datetime(d.year, d.month, d.day, 20, 0, tzinfo=ET)
            rows.append({
                "sport": "wwe", "program_type": "weekly_show", "series": None,
                "title": title, "subtitle": venues.get(d), "location_text": venues.get(d),
                "start_at": iso_utc(when), "expected_duration_min": minutes,
                # A weekly show has a FIXED end (docs/research/wwe.md section 4). Only the PLEs
                # below are open-ended.
                "open_ended": False,
                "brand_key": cfg["brand_key"], "hosts_crew": [],
                "source_url": PREMIER_URL, "source_tier": "official_league_site",
                "broadcasts": [bcast(platform)],
                "_provenance": {"slot": "%s 8 PM ET on %s" % (cfg["slot_word"], platform),
                                "venue_from": "wwe.com/events" if venues.get(d) else None},
            })
            d += timedelta(days=7)
    return rows


def ple_rows(dated: list[tuple[date, int, int, str]], named: list[dict[str, Any]],
             defaults: dict) -> tuple[list[dict[str, Any]], list[str]]:
    """One `special_event` per dated Premier Shows listing, named and sited from wwe.com/events."""
    minutes = int((defaults.get("special_event") or {}).get("default") or 240)
    open_ended = bool((defaults.get("special_event") or {}).get("open_ended_default"))
    by_date: dict[date, dict[str, Any]] = {}
    for e in named:
        if is_main_roster(e["title"]):
            by_date.setdefault(e["date"], e)
    rows: list[dict[str, Any]] = []
    notes: list[str] = []
    seen: set[date] = set()
    for when, hour, minute, platform in sorted(dated):
        if platform != US_PLE_PLATFORM and platform != "Peacock":
            # The Netflix twin of each PLE, and the international YouTube line. Reported, not loaded.
            notes.append("dual listing on %s: %s (loaded as %s only)"
                         % (when.isoformat(), platform, US_PLE_PLATFORM))
            continue
        if when in seen:
            continue
        seen.add(when)
        meta = by_date.get(when)
        if meta is None:
            notes.append("no name on wwe.com/events for %s - loaded as a generic premium live event"
                         % when.isoformat())
        start = datetime(when.year, when.month, when.day, hour, minute, tzinfo=ET)
        rows.append({
            "sport": "wwe", "program_type": "special_event", "series": None,
            "title": (meta or {}).get("title") or "WWE Premium Live Event",
            "subtitle": (meta or {}).get("venue"), "location_text": (meta or {}).get("venue"),
            "start_at": iso_utc(start), "expected_duration_min": minutes,
            "open_ended": open_ended, "brand_key": "wwe", "hosts_crew": [],
            "source_url": EVENTS_URL if meta else PREMIER_URL,
            "source_tier": "official_league_site",
            "broadcasts": [bcast(platform)],
            "_provenance": {"platform_from": "wwe.com Premier Shows block",
                            "name_from": "wwe.com/events" if meta else None},
        })
    return rows, notes


def build(premier_page: str, events_page: str, year: int, start: date,
          through: date) -> tuple[list[dict[str, Any]], list[str]]:
    defaults = _durations()
    block = premier_shows(premier_page, year)
    named = events(events_page, year)
    venues = {e["date"]: e["venue"] for e in named
              if is_main_roster(e["title"]) and "raw" in e["title"].lower() and e["venue"]}
    rows = weekly_rows(block["slots"], venues, start, through, defaults)
    ples, notes = ple_rows(block["dated"], named, defaults)
    dropped = [e["title"] for e in named if not is_main_roster(e["title"])]
    if dropped:
        notes.append("not main-roster WWE, dropped: " + ", ".join(sorted(set(dropped))))
    if "Tuesday" in block["slots"]:
        notes.append("NXT's slot is in the block (%s) and is dropped - register section 7 Q7"
                     % block["slots"]["Tuesday"])
    return rows + ples, notes


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--year", type=int, default=2026)
    ap.add_argument("--from", dest="start", default=None, help="first air date (default: today ET)")
    ap.add_argument("--through", default="2026-12-31")
    ap.add_argument("--premier", help="recorded Premier Shows page instead of the network")
    ap.add_argument("--events", dest="events_file", help="recorded wwe.com/events page")
    ap.add_argument("--out", help="write the programs as JSON here")
    args = ap.parse_args(argv)

    premier_page = (open(args.premier, encoding="utf-8").read() if args.premier
                    else fetch(PREMIER_URL))
    events_page = (open(args.events_file, encoding="utf-8").read() if args.events_file
                   else fetch(EVENTS_URL))
    start = (date.fromisoformat(args.start) if args.start
             else datetime.now(tz=ET).date())
    through = date.fromisoformat(args.through)

    rows, notes = build(premier_page, events_page, args.year, start, through)
    weekly = [r for r in rows if r["program_type"] == "weekly_show"]
    ples = [r for r in rows if r["program_type"] == "special_event"]
    print("wwe %s..%s: %d weekly shows, %d premium live events"
          % (start, through, len(weekly), len(ples)))
    for t in sorted({r["title"] for r in weekly}):
        print("   %-26s %d episodes" % (t, sum(1 for r in weekly if r["title"] == t)))
    for r in ples:
        print("   PLE %-30s %s on %s" % (r["title"][:30], r["start_at"],
                                         r["broadcasts"][0]["service_id"]))
    for n in notes:
        print("   note: %s" % n)

    if args.out:
        p = Path(args.out)
        p.parent.mkdir(parents=True, exist_ok=True)
        with open(p, "w", encoding="utf-8", newline="\n") as fh:
            json.dump(rows, fh, indent=1, ensure_ascii=False)
            fh.write("\n")
        print("wrote %s" % p)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
