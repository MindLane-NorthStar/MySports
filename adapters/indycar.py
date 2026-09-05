#!/usr/bin/env python3
"""IndyCar race sessions from indycar.com, as `programs` rows.

    python -m adapters.indycar --year 2026
    python -m adapters.indycar --fixture tests/fixtures/indycar_2026_schedule.html
    python -m adapters.indycar --year 2026 --verify        # cross-check every start against ESPN

SCOPE: RACES ONLY. Register section 7 Q2 - motorsport is the race, never practice or qualifying.
docs/research/indycar.md section 2 puts every 2026 race on FOX with practice and qualifying on
FS1/FS2, so dropping the support sessions drops nothing the reader can act on.

WHY 2026 AND NOT 2027. The research doc and research-summary-2 section 6 both recommend deferring
this adapter to the 2027 schedule, because the 2026 season ends Sept 6 and only one race is left.
**Joe amended that on 2026-09-05** (register section 17): IndyCar is built now, against 2026, so the
season lands in History. The recommendation is not wrong - it is simply not the ruling.

THE SOURCE. `indycar.com/Schedule` is server-rendered and fetched clean (verified 2026-09-02 in
docs/research/indycar.md section 1, re-verified from this laptop at 200 / 361,003 bytes). Every race
is an `event-card` block carrying its date, its ET start, its network logos, its title, its track and
a `/Schedule/{year}/{slug}` link. The per-year page `/Schedule/2026` shows only the last and next
race; the ROOT page carries the whole season, which is why this reads the root.

THE CROSS-CHECK, AND THE TRAP IN IT. ESPN's `racing/irl` scoreboard - the doc's structured fallback,
marked UNVERIFIED there because it 403'd from the cloud - answers 200 from this laptop. It is NOT the
backbone; indycar.com is the authority the research verified. It is used to VERIFY, which is what
caught cf.nascar.com publishing naive Eastern timestamps.

**DO NOT VERIFY AGAINST `leagues[0].calendar`.** Its `startDate` is a FIXED THREE HOURS LATER than
the race, on 15 of the 18 2026 entries, and ESPN's own `events[].date` for the same race disagrees
with its own calendar by exactly that. Measured: the Monterey finale is `18:30Z` as an event and
`21:30Z` in the calendar. A first pass compared against the calendar, reported 18 races out of 18 as
wrong, and would have "corrected" a correct adapter into a three-hour error across a whole season.
The comparison is against the per-date `events[].date`, which agrees with indycar.com to the minute:

    St. Petersburg   17:00Z = 17:00Z      Long Beach   21:30Z = 21:30Z
    Mid-Ohio         16:30Z = 16:30Z      Monterey     18:30Z = 18:30Z

THE ONE REAL DISAGREEMENT is the INDY 500: indycar.com says 10:00 AM ET and ESPN says 12:00 PM ET.
That is not a zone question - it is the difference between the broadcast window and the green flag.
docs/research/indycar.md section 2 says "Indy 500: six-hour window from 10 AM", so the page's time is
the window and ESPN's is the race. The page wins, because the grid draws what a viewer tunes in to;
the 360-minute duration below is that same window. Recorded here so it is not "fixed" later.

TIMES ARE ET AND SAID SO. The page writes `2:30 PM ET` in the card header - an explicit zone, not a
naive local stamp - so there is nothing to infer. Confirmed against ESPN on every race that appears
in both.
"""

from __future__ import annotations

import argparse
import html as _html
import json
import re
import sys
import urllib.request
from datetime import datetime
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

from adapters.common import find_repo_root, http_json, iso_utc, ua_for

ROOT = find_repo_root()
ET = ZoneInfo("America/New_York")

SCHEDULE_URL = "https://www.indycar.com/Schedule"
RACE_URL = "https://www.indycar.com/Schedule/{year}/{slug}"
ESPN_IRL = "https://site.api.espn.com/apis/site/v2/sports/racing/irl/scoreboard"

MONTHS = {m: i + 1 for i, m in enumerate(
    ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"])}

# The network the card's logo images name. indycar.com serves FOX-Pos.png / FS1-Pos.png /
# FOX-One-Vertical.png and writes a plain-English alt on each.
#
# FOX ONE IS SUPPRESSED, and that is the local-feed rule rather than a new one: it duplicates a
# broadcast the viewer already has (docs/research/indycar.md section 3), so carrying both would put
# two rows on the grid for one telecast.
NETWORK_ALT = {"fox": "FOX", "fox sports": "FOX", "fs1": "FS1", "fs2": "FS2", "fox one": None,
               "fox one logo": None, "nbc": "NBC", "peacock": "Peacock"}

CARD_RE = re.compile(r'<div class="event-card [^"]*">(.*?)(?=<div class="event-card |\Z)', re.S)


def _text(pattern: str, block: str) -> str | None:
    m = re.search(pattern, block, re.S)
    return _html.unescape(re.sub(r"\s+", " ", m.group(1))).strip() if m else None


def parse_start(date_text: str, time_text: str | None, year: int) -> datetime | None:
    """`("Sep 6", "2:30 PM ET", 2026)` -> an aware datetime. None when either part is unusable.

    The page states the zone, so nothing is inferred. A card with no time - an unannounced start -
    returns None and the race is reported rather than placed at midnight.
    """
    dm = re.match(r"([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2})", (date_text or "").strip())
    if not dm or dm.group(1)[:3] not in MONTHS:
        return None
    month, day = MONTHS[dm.group(1)[:3]], int(dm.group(2))
    tm = re.match(r"(\d{1,2}):(\d{2})\s*(AM|PM)\s*ET", (time_text or "").strip(), re.I)
    if not tm:
        return None
    hour, minute = int(tm.group(1)) % 12, int(tm.group(2))
    if tm.group(3).upper() == "PM":
        hour += 12
    return datetime(year, month, day, hour, minute, tzinfo=ET)


def networks(block: str) -> list[str]:
    """The receivable networks a card's logo images name, in page order, duplicates suppressed."""
    out: list[str] = []
    for alt in re.findall(r'class="event-card-header-network".*?</div>', block, re.S)[:1]:
        for a in re.findall(r'alt="([^"]*)"', alt):
            mapped = NETWORK_ALT.get(a.strip().lower(), a.strip() or None)
            if mapped and mapped not in out:
                out.append(mapped)
    return out


def duration_min(slug: str, defaults: dict) -> tuple[int, str]:
    """Minutes and provenance. The Indy 500 is its own case; everything else takes the default."""
    row = defaults.get("race_session") or {}
    by_track = row.get("by_track_type") or {}
    if "indianapolis-500" in slug.lower():
        # docs/research/indycar.md section 2: "Indy 500: six-hour window from 10 AM".
        return 360, "docs/research/indycar.md section 2 (six-hour window)"
    if "milwaukee" in slug.lower() or "wwtr" in slug.lower() or "phoenix" in slug.lower():
        key = "oval_indycar"
    else:
        key = "street_circuit" if any(k in slug.lower() for k in
                                     ("st-petersburg", "long-beach", "detroit", "nashville",
                                      "arlington", "markham", "washington-dc")) else None
    if key and key in by_track:
        return int(by_track[key]["minutes"]), "duration_defaults.json race_session.%s" % key
    # docs/research/indycar.md section 4: ~150 minutes road/street.
    return 150, "docs/research/indycar.md section 4 (road/street ~150)"


def parse(page: str, year: int) -> list[dict[str, Any]]:
    """Every `event-card` on the page for `year`, as adapter rows."""
    with open(ROOT / "data" / "duration_defaults.json", encoding="utf-8") as fh:
        defaults = json.load(fh)
    out: list[dict[str, Any]] = []
    seen: set[str] = set()
    for block in CARD_RE.findall(page):
        link = re.search(r'href="/Schedule/(\d{4})/([A-Za-z0-9\-]+)"', block)
        if not link or int(link.group(1)) != year:
            continue
        slug = link.group(2)
        if slug in seen:
            continue                       # the megamenu repeats the next race; the season list wins
        seen.add(slug)
        title = _text(r'class="event-card-title">(.*?)</h3>', block)
        if not title:
            continue
        start = parse_start(_text(r'class="event-card-header-date">(.*?)</div>', block),
                            _text(r'class="event-card-header-time">(.*?)</div>', block), year)
        track = _text(r'class="event-card-track-name">(.*?)</div>', block)
        nets = networks(block)
        minutes, provenance = duration_min(slug, defaults)
        out.append({
            "sport": "indycar",
            "program_type": "race_session",
            # No `series`: register section 7 Q6 gave NASCAR a series field because it runs three.
            # IndyCar runs one, and inventing a value would make it look like a fourth NASCAR series
            # (register section 16 named that exact trap).
            "series": None,
            "title": title,
            "subtitle": track or None,
            "start_at": iso_utc(start) if start else None,
            "expected_duration_min": minutes,
            "location_text": track or None,
            # A race END moves with cautions and red flags, same as NASCAR. Read from the file
            # rather than restated.
            "open_ended": bool((defaults.get("race_session") or {}).get("open_ended_default")),
            "brand_key": "indycar",
            "source_url": RACE_URL.format(year=year, slug=slug),
            "source_tier": "official_league_site",
            "broadcasts": [{
                "service_id": n,
                "delivery_surface": "STREAMING" if n in ("Peacock",) else "LINEAR",
                "feed_side": "NATIONAL",
                "is_primary": i == 0,
                "requires_auth": n in ("Peacock",),
                "label": n,
            } for i, n in enumerate(nets)],
            "_provenance": {"slug": slug, "duration": provenance, "networks_on_page": nets},
        })
    return out


def fetch(url: str = SCHEDULE_URL) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": ua_for(url),
                                               "Accept": "text/html,*/*;q=0.8"})
    with urllib.request.urlopen(req, timeout=45) as resp:
        return resp.read().decode("utf-8", errors="replace")


def espn_events_on(day_et: str) -> list[str] | str:
    """Every `events[].date` ESPN lists for one ET calendar day, or an "ERROR ..." string.

    THE PER-DATE EVENTS, never `leagues[0].calendar` - see the module docstring for why. ALL of them
    and not the first: Milwaukee is a doubleheader, both races fall on one day, and comparing race 2
    against `events[0]` reported a five-hour disagreement that was the verifier's fault rather than
    the data's.
    """
    try:
        sb = http_json(ESPN_IRL, params={"dates": day_et.replace("-", "")})
    except Exception as exc:                                   # noqa: BLE001 - a probe never fails a run
        return "ERROR %s" % exc
    return [e["date"] for e in (sb.get("events") or []) if e.get("date")]


def verify(rows: list[dict[str, Any]], fetch_day=espn_events_on) -> list[str]:
    """One line per race whose indycar.com start disagrees with the CLOSEST ESPN event that day.

    It never CHANGES a value - it prints, exactly as the NASCAR cross-check did. `fetch_day` is
    injectable so a test can exercise the comparison without the network.

    WHAT A NON-ZERO DELTA MEANS HERE, because it is not what it meant for NASCAR. indycar.com's card
    header carries the BROADCAST start - what a viewer tunes to - and ESPN carries the green flag, so
    a pre-race show shows up as a positive delta. docs/research/indycar.md section 2 names two of
    them by name: "Arlington 30 min" and the finale "pre-race at 2:30". Arlington measures exactly
    1:00 and Washington DC 1:30. The page wins, because a TV grid draws the window a viewer tunes to.
    """
    notes: list[str] = []
    for row in rows:
        if not row.get("start_at"):
            notes.append("NO START on the page: %s" % row["title"])
            continue
        ours = datetime.fromisoformat(row["start_at"].replace("Z", "+00:00"))
        found = fetch_day(ours.astimezone(ET).strftime("%Y-%m-%d"))
        if isinstance(found, str):
            notes.append("%s: %s" % (row["title"], found))
            continue
        if not found:
            notes.append("no ESPN event that day: %s" % row["title"])
            continue
        stamps = [datetime.fromisoformat(d.replace("Z", "+00:00")) for d in found]
        theirs = min(stamps, key=lambda t: abs(t - ours))
        if ours != theirs:
            notes.append("delta %s on %s: indycar.com %s, ESPN %s"
                         % (theirs - ours, row["title"], ours.isoformat(), theirs.isoformat()))
    return notes


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--year", type=int, default=2026)
    ap.add_argument("--fixture", help="read this recorded page instead of the network")
    ap.add_argument("--verify", action="store_true", help="cross-check every start against ESPN")
    ap.add_argument("--out", help="write the programs as JSON here instead of stdout")
    args = ap.parse_args(argv)

    if args.fixture:
        with open(args.fixture, encoding="utf-8") as fh:
            page = fh.read()
    else:
        page = fetch()
    rows = parse(page, args.year)
    placed = [r for r in rows if r["start_at"]]
    print("indycar %d: %d race cards parsed, %d with a start" % (args.year, len(rows), len(placed)))
    nets: dict[str, int] = {}
    for r in rows:
        for b in r["broadcasts"]:
            nets[b["service_id"]] = nets.get(b["service_id"], 0) + 1
    print("networks: " + (" | ".join("%s %d" % kv for kv in sorted(nets.items())) or "none"))

    if args.verify:
        notes = verify(rows)
        print("cross-check against ESPN racing/irl events[].date: %s"
              % ("AGREES on every race" if not notes else "%d note(s)" % len(notes)))
        for n in notes:
            print("  " + n)

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
