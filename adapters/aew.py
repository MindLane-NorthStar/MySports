#!/usr/bin/env python3
"""AEW Dynamite and Collision as `programs` rows.

    python -m adapters.aew --through 2026-12-31
    python -m adapters.aew --slots tests/fixtures/aew_slots.html --through 2026-12-31

SCOPE: Dynamite and Collision. **PPVs are EXCLUDED** - register §7 Q3, purchasable content is out and
v0.5 has no `purchasable` access state. All Out and the rest do not load, and neither does the HBO
Max "Zero Hour" pre-show that exists only to sell one (`docs/research/aew.md` §10's recommendation,
taken). Linear pre-shows on TNT/TBS ARE in scope by the same recommendation.

**AEW GETS NO CHIP** - register §13's amendment to §9, the one exception among the new sports. It
still loads, still appears under ALL SPORTS, and still renders on its networks. That is a chip-row
decision, not a scope decision, and this adapter is unaffected by it.

WHICH PATH RAN, WHICH IS THE FIRST THING TO KNOW ABOUT THIS DATA. `docs/research/aew.md` §1 and §5
are both emphatic that the **WBD monthly HBO Max schedule is the ONLY authority** for AEW's night and
network, because Collision moves both - it aired on TBS rather than TNT on Aug 22, and moved to
Thursdays twice in July. The brief's fallback order is: the WBD monthly schedule, else the trade
republication the doc names, else the slot default with `source_tier` saying so.

**The third path ran.** Measured on the day: `press.wbd.com` answers 200 (its earlier 403 was
transient) but carries **no AEW content at its root**, and neither `pwmania.com` nor
`ewrestlingnews.com` had republished a monthly schedule. So every generated episode is tiered
`slot_default`, and the known September exceptions come from `data/aew_2026_schedule.json`, each
carrying its own citation.

THE SLOTS ARE SOURCED, NOT REMEMBERED. allelitewrestling.com states both verbatim - "Dynamite airs
every Wednesday night 8e/7c on TBS + Simulcasted on HBO MAX", "AEW Collision airs every Saturday at
8e/7c on TNT + Simulcasted on HBO MAX" - and the page is recorded at `tests/fixtures/aew_slots.html`
and asserted against its bytes.

HBO MAX IS A CHIP, NOT A ROW. `docs/research/aew.md` §2: HBO Max is a simulcast of the linear feed, so
under the local-feed suppression rule the grid shows the **linear** row (TBS or TNT) and chips HBO
Max. Both are written as broadcast rows - the linear one `is_primary` - and the renderer picks the
primary for the row it draws.
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

SLOTS_URL = "https://www.allelitewrestling.com/"
WBD_URL = "https://press.wbd.com/us/"

SCHEDULE_PATH = ROOT / "data" / "aew_2026_schedule.json"


def schedule_doc() -> dict[str, Any]:
    with open(SCHEDULE_PATH, encoding="utf-8") as fh:
        return json.load(fh)


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": ua_for(url),
                                               "Accept": "text/html,*/*;q=0.8"})
    with urllib.request.urlopen(req, timeout=45) as resp:
        return resp.read().decode("utf-8", errors="replace")


def confirm_slots(page: str) -> dict[str, dict[str, str]]:
    """The standing slots as allelitewrestling.com states them, or `{}` when it does not.

    THE POINT IS THE CONFIRMATION, not the parse: `data/aew_2026_schedule.json` already holds the
    slots, and this reads the page to check that the site still says the same thing. A page that has
    stopped saying it returns `{}` and the caller reports a drift rather than silently trusting a
    stale file - which is the failure mode a slot default invites.
    """
    text = re.sub(r"\s+", " ", _html.unescape(re.sub(r"<[^>]+>", " ", page)))
    out: dict[str, dict[str, str]] = {}
    for show, pattern in (
            ("AEW Dynamite",
             r"Dynamite airs every (\w+)[^.]{0,20}?(\d{1,2})e/\d{1,2}c on ([A-Za-z0-9 ]+?)\s*\+"),
            ("AEW Collision",
             r"Collision airs every (\w+) at (\d{1,2})e/\d{1,2}c on ([A-Za-z0-9 ]+?)\s*\+")):
        m = re.search(pattern, text)
        if m:
            out[show] = {"weekday": m.group(1), "hour_et": m.group(2), "linear": m.group(3).strip()}
    return out


WEEKDAY_NAME = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


def bcast(service: str, primary: bool) -> dict[str, Any]:
    streaming = service in ("HBO Max",)
    return {"service_id": service, "label": service,
            "delivery_surface": "STREAMING" if streaming else "LINEAR",
            "feed_side": "NATIONAL", "is_primary": primary, "requires_auth": streaming}


def row(title: str, when: datetime, minutes: int, linear: str, simulcast: str | None,
        tier: str, note: str | None) -> dict[str, Any]:
    return {
        "sport": "aew", "program_type": "weekly_show", "series": None,
        "title": title, "subtitle": None, "location_text": None,
        "start_at": iso_utc(when), "expected_duration_min": minutes,
        # A wrestling show has a fixed end, the same as WWE's weeklies.
        "open_ended": False,
        "brand_key": "aew", "hosts_crew": [],
        "source_url": SLOTS_URL, "source_tier": tier,
        "broadcasts": [bcast(linear, True)] + ([bcast(simulcast, False)] if simulcast else []),
        "_provenance": {"path": tier, "note": note},
    }


def build(start: date, through: date, page: str | None = None) -> tuple[list[dict[str, Any]], list[str]]:
    doc = schedule_doc()
    notes: list[str] = []

    if page is not None:
        seen = confirm_slots(page)
        for show, cfg in doc["slots"].items():
            said = seen.get(show)
            if not said:
                notes.append("allelitewrestling.com no longer states %s's slot - the file's value "
                             "was used and should be re-checked" % show)
                continue
            want_day = WEEKDAY_NAME[cfg["weekday"]]
            want_hour = str(int(cfg["start_et"].split(":")[0]) % 12 or 12)
            if said["weekday"] != want_day or said["hour_et"] != want_hour \
                    or said["linear"].upper() != cfg["linear"].upper():
                notes.append("DRIFT on %s: the site says %s %se on %s, the file says %s %s on %s"
                             % (show, said["weekday"], said["hour_et"], said["linear"],
                                want_day, cfg["start_et"], cfg["linear"]))
    else:
        notes.append("slots not re-confirmed against the site (no page given)")

    # exceptions, keyed by (date, show)
    moves: dict[tuple[date, str], dict[str, Any]] = {}
    suppress: set[tuple[date, str]] = set()
    extra: list[dict[str, Any]] = []
    for ex in doc["exceptions"]:
        d = date.fromisoformat(ex["date"])
        key = (d, ex["show"])
        if ex["action"] == "move":
            moves[key] = ex
            # the regular airing that WEEK is the moved one, so its own slot day is suppressed
            slot_day = d + timedelta(days=(doc["slots"][ex["show"]]["weekday"] - d.weekday()) % 7)
            suppress.add((slot_day, ex["show"]))
        elif ex["action"] == "replace":
            suppress.add(key)
            extra.append(ex)

    rows: list[dict[str, Any]] = []
    for show, cfg in doc["slots"].items():
        hour, minute = (int(x) for x in cfg["start_et"].split(":"))
        d = start
        while d.weekday() != cfg["weekday"]:
            d += timedelta(days=1)
        while d <= through:
            if (d, show) in suppress:
                notes.append("%s on %s suppressed: an exception covers that week" % (show, d))
                d += timedelta(days=7)
                continue
            rows.append(row(show, datetime(d.year, d.month, d.day, hour, minute, tzinfo=ET),
                            cfg["duration_min"], cfg["linear"], cfg.get("simulcast"),
                            "slot_default", None))
            d += timedelta(days=7)

    for key, ex in moves.items():
        d, show = key
        if not (start <= d <= through):
            continue
        h, m = (int(x) for x in ex["start_et"].split(":"))
        rows.append(row(ex.get("title") or show, datetime(d.year, d.month, d.day, h, m, tzinfo=ET),
                        ex["duration_min"], ex["linear"], ex.get("simulcast"),
                        "research_document", ex.get("note")))
    for ex in extra:
        d = date.fromisoformat(ex["date"])
        if not (start <= d <= through):
            continue
        h, m = (int(x) for x in ex["start_et"].split(":"))
        rows.append(row(ex["title"], datetime(d.year, d.month, d.day, h, m, tzinfo=ET),
                        ex["duration_min"], ex["linear"], ex.get("simulcast"),
                        "research_document", ex.get("note")))

    for nl in doc["not_loaded"]:
        notes.append("NOT LOADED - %s: %s" % (nl["what"], nl["why"]))
    rows.sort(key=lambda r: r["start_at"])
    return rows, notes


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--from", dest="start", default=None)
    ap.add_argument("--through", default="2026-12-31")
    ap.add_argument("--slots", help="recorded allelitewrestling.com page instead of the network")
    ap.add_argument("--no-confirm", action="store_true", help="skip the slot re-confirmation fetch")
    ap.add_argument("--out")
    args = ap.parse_args(argv)

    page = None
    if not args.no_confirm:
        page = (open(args.slots, encoding="utf-8").read() if args.slots else fetch(SLOTS_URL))
    start = date.fromisoformat(args.start) if args.start else datetime.now(tz=ET).date()
    through = date.fromisoformat(args.through)

    rows, notes = build(start, through, page)
    print("aew %s..%s: %d episodes" % (start, through, len(rows)))
    for t in sorted({r["title"] for r in rows}):
        print("   %-38s %d" % (t, sum(1 for r in rows if r["title"] == t)))
    tiers: dict[str, int] = {}
    for r in rows:
        tiers[r["source_tier"]] = tiers.get(r["source_tier"], 0) + 1
    print("   source tiers: " + " | ".join("%s %d" % kv for kv in sorted(tiers.items())))
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
