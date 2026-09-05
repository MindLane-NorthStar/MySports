#!/usr/bin/env python3
"""UFC fight cards from the Paramount+ "Sneak Peak" schedule page, as `programs` rows.

    python -m adapters.ufc --year 2026
    python -m adapters.ufc --schedule tests/fixtures/paramountplus_ufc_2026.html \\
                           --press tests/fixtures/paramount_press_cbs.html

THE SOURCE, verified in `docs/research/ufc.md` §1 and re-verified from this laptop at 200 / 175,596
bytes: `paramountplus.com/sneak-peak/ufc-schedule-2026/` is a static WordPress page - not a table, but
a repeating run of labelled lines under an "Upcoming events" heading:

    UFC 331: Van vs. Pantoja 2
    Date: Saturday, Sept. 19
    Venue: Crypto.com Arena (Los Angeles, California)
    Start time: Main Card: 9 PM ET/6 PM PT
    Streaming: Paramount+

so that is what is read. "Past events" below it uses a DIFFERENT shape and is deliberately not
parsed - this adapter loads the schedule, and a card that has already happened is History's business.

THE CARD RENDERS PLAIN. Joe, 2026-09-03, in the design of record: one plain card, **no segment
dividers or labels on the block and NO CBS partial-window overlay** - which supersedes the register's
own Q2. `segments[]` and `broadcasts.window_start/window_end` stay DATA, surfaced in the tap-open
detail panel. This adapter therefore writes them and expects nothing to draw them.

SEGMENT TIMES ARE NOT ON THIS PAGE, and none is invented. The page gives the MAIN CARD start only -
`docs/research/ufc.md` §1 names that as its weakness and §5 warns that early prelims can begin three
hours earlier. So `start_at` is the main card, `segments` is the EMPTY ARRAY, and the run reports it.
Filling in an early-prelims time from a convention would put a wrong start on the grid for every card.
Empty and not null: `programs.segments` is `jsonb NOT NULL default '[]'` (migration 0009), so the
empty array is what the schema already means by "none recorded" - a null fails the whole load, which
is how this was found.

THE CBS WINDOW. Select numbered events are simulcast on CBS in a fixed window (UFC 326's precedent
was 8-10 PM ET), and Paramount Press Express carries the exact windows. **No upcoming 2026 event on
the recorded page flags a CBS simulcast** - the Sept 5 card says so in as many words, "There is no
pay-per-view or CBS simulcast" - so no CBS row is written. `--press` re-reads Press Express and
reports what it finds rather than guessing.

ODDS ARE NOT LOADED. Register §9 puts UFC moneylines under `show_odds` via The Odds API
`mma_mixed_martial_arts`. **No provider key is added by this run** (the brief forbids it), so odds
stay null and the card renders none.
"""

from __future__ import annotations

import argparse
import html as _html
import json
import re
import urllib.request
from datetime import date, datetime
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

from adapters.common import find_repo_root, iso_utc, ua_for

ROOT = find_repo_root()
ET = ZoneInfo("America/New_York")

SCHEDULE_URL = "https://www.paramountplus.com/sneak-peak/ufc-schedule-2026/"
PRESS_URL = "https://www.paramountpressexpress.com/cbs-entertainment/releases/"

MONTHS = {m: i + 1 for i, m in enumerate(
    ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"])}

UPCOMING_START = "UFC 2026 schedule (live list)"
UPCOMING_END = ("Note: Fight cards, dates, and times are subject to change", "Past events")

EVENT_RE = re.compile(r"^(UFC \d+:.*|UFC Fight Night:.*|Noche UFC:.*)$")


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": ua_for(url),
                                               "Accept": "text/html,*/*;q=0.8"})
    with urllib.request.urlopen(req, timeout=45) as resp:
        return resp.read().decode("utf-8", errors="replace")


def lines_of(page: str) -> list[str]:
    """The Upcoming-events section as a list of trimmed text lines."""
    i = page.find(UPCOMING_START)
    body = page[i:] if i >= 0 else page
    text = _html.unescape(re.sub(r"<[^>]+>", "\n", body))
    out: list[str] = []
    for raw in text.splitlines():
        line = re.sub(r"\s+", " ", raw).strip()
        if not line:
            continue
        if any(line.startswith(stop) for stop in UPCOMING_END):
            break
        out.append(line)
    return out


def _value(lines: list[str], i: int) -> str:
    """The value for a label at `i` - on the same line after the colon, or on the next line.

    The page mixes the two: "Date: Sept. 5, 2026" on one line, and "Date" / ": Saturday, Sept. 12"
    split across two. Both are the same fact and neither is a parse error.
    """
    same = lines[i].split(":", 1)
    if len(same) == 2 and same[1].strip():
        return same[1].strip()
    nxt = lines[i + 1] if i + 1 < len(lines) else ""
    return nxt.lstrip(":").strip()


def parse(page: str, year: int) -> list[dict[str, Any]]:
    """Every upcoming card on the page, as adapter rows."""
    lines = lines_of(page)
    events: list[dict[str, Any]] = []
    current: dict[str, Any] | None = None
    for i, line in enumerate(lines):
        if EVENT_RE.match(line):
            if current:
                events.append(current)
            current = {"title": line, "date": None, "venue": None, "main_card": None,
                       "streaming": None, "cbs": False}
            continue
        if current is None:
            continue
        low = line.lower()
        if low.startswith("date"):
            current["date"] = _value(lines, i)
        elif low.startswith("venue"):
            current["venue"] = _value(lines, i)
        elif low.startswith("main card"):
            current["main_card"] = _value(lines, i)
        elif low.startswith("streaming"):
            current["streaming"] = _value(lines, i)
        if "cbs" in low and "no cbs" not in low and "not " not in low:
            current["cbs"] = True
    if current:
        events.append(current)
    return [r for r in (to_program(e, year) for e in events) if r]


def parse_date(text: str, year: int) -> date | None:
    """"Saturday, Sept. 19" or "Sept. 5, 2026" -> a date. None when either part is missing."""
    m = re.search(r"([A-Z][a-z]{2})\w*\.?\s+(\d{1,2})", text or "")
    if not m or m.group(1) not in MONTHS:
        return None
    y = re.search(r"\b(20\d{2})\b", text or "")
    return date(int(y.group(1)) if y else year, MONTHS[m.group(1)], int(m.group(2)))


def parse_time(text: str) -> tuple[int, int] | None:
    """"9 PM ET/6 PM PT" -> (21, 0). The ET half only; the page always states the zone."""
    m = re.search(r"(\d{1,2})(?::(\d{2}))?\s*(AM|PM)\s*ET", text or "", re.I)
    if not m:
        return None
    hour = int(m.group(1)) % 12
    if m.group(3).upper() == "PM":
        hour += 12
    return hour, int(m.group(2) or 0)


def _durations() -> dict[str, Any]:
    with open(ROOT / "data" / "duration_defaults.json", encoding="utf-8") as fh:
        return json.load(fh)


def to_program(ev: dict[str, Any], year: int) -> dict[str, Any] | None:
    when = parse_date(ev.get("date") or "", year)
    clock = parse_time(ev.get("main_card") or "")
    if not (when and clock):
        return None
    defaults = (_durations().get("fight_card") or {})
    title, _, headliner = (ev["title"] or "").partition(":")
    venue = ev.get("venue") or ""
    city = None
    m = re.search(r"\(([^)]+)\)", venue)
    if m:
        city = m.group(1).strip()
    start = datetime(when.year, when.month, when.day, clock[0], clock[1], tzinfo=ET)
    return {
        "sport": "ufc", "program_type": "fight_card", "series": None,
        "title": title.strip() or ev["title"],
        # The design of record's subtitle for a fight card is the HEADLINER.
        "subtitle": headliner.strip() or None,
        "location_text": city or (venue.split("(")[0].strip() or None),
        "start_at": iso_utc(start),
        "expected_duration_min": int(defaults.get("default") or 360),
        "open_ended": bool(defaults.get("open_ended_default")),
        "brand_key": "ufc", "hosts_crew": [],
        # NOT INVENTED, and EMPTY rather than null. The page carries the MAIN CARD start only;
        # early-prelims and prelims times live on ufc.com or ESPN's mma/ufc feed, and neither is
        # parsed here - a convention-derived segment list would put a wrong start on the grid for
        # every card. `programs.segments` is `jsonb NOT NULL default '[]'` (migration 0009), so the
        # honest value for "none recorded" is the empty array the schema already means by it; a null
        # is simply unrepresentable and fails the whole load.
        "segments": [],
        "source_url": SCHEDULE_URL, "source_tier": "official_distributor_page",
        "broadcasts": [{"service_id": "Paramount+", "label": "Paramount+",
                        "delivery_surface": "STREAMING", "feed_side": "NATIONAL",
                        "is_primary": True, "requires_auth": True}],
        "_provenance": {"venue_raw": venue, "main_card_raw": ev.get("main_card"),
                        "cbs_flagged": ev.get("cbs", False)},
    }


def cbs_windows(press_page: str) -> list[str]:
    """Every CBS UFC window Press Express states, as raw text. REPORTED, never inferred.

    Returns the sentences rather than parsed times on purpose: no upcoming 2026 card flags a CBS
    simulcast, so there is nothing to parse yet and a parser written against zero examples would be
    a guess about a format nobody has seen.
    """
    text = re.sub(r"\s+", " ", _html.unescape(re.sub(r"<[^>]+>", " ", press_page)))
    return [m.strip() for m in re.findall(r"[^.]{0,120}UFC[^.]{0,60}CBS[^.]{0,120}\.", text)][:6]


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--year", type=int, default=2026)
    ap.add_argument("--schedule", help="recorded Paramount+ page instead of the network")
    ap.add_argument("--press", help="recorded Paramount Press Express page")
    ap.add_argument("--out")
    args = ap.parse_args(argv)

    page = (open(args.schedule, encoding="utf-8").read() if args.schedule else fetch(SCHEDULE_URL))
    rows = parse(page, args.year)
    print("ufc %d: %d upcoming cards" % (args.year, len(rows)))
    for r in rows:
        print("   %-34s %s  %s" % (r["title"][:34], r["start_at"], r["location_text"] or ""))
    flagged = [r for r in rows if r["_provenance"]["cbs_flagged"]]
    print("   CBS simulcast flagged on the schedule page: %d card(s)" % len(flagged))

    if args.press or not args.schedule:
        press = (open(args.press, encoding="utf-8").read() if args.press else fetch(PRESS_URL))
        found = cbs_windows(press)
        print("   Paramount Press Express: %d UFC/CBS sentence(s)" % len(found))
        for f in found:
            print("      " + f[:150])

    print("   segments: NOT loaded - the page carries the main-card start only "
          "(docs/research/ufc.md section 1)")
    print("   odds: NOT loaded - register section 9 puts them under show_odds via The Odds API, and "
          "no provider key is added by this run")

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
