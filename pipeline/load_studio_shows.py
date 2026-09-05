#!/usr/bin/env python3
"""Load the studio-show registry and generate one `studio_show` program per air date.

    python -m pipeline.load_studio_shows --emit-sql artifacts/sql/studio.sql   # dry run
    python -m pipeline.load_studio_shows                                       # live
    python -m pipeline.load_studio_shows --export artifacts/programs/studio_2026.json

SCOPE, register §7 Q4: pregame and postgame **bookends** on the game's network. No halftime, no
daily talk. A studio show never gets a chip (§9); it renders under the sport it covers.

THREE WRITES, and they are different in kind:
  1. `studio_shows`          - the REGISTRY, one row per show, upserted from data/studio_shows.json.
  2. `programs`              - one `studio_show` program per air date, through pipeline/load_programs.
  3. `studio_show_instances` - the OBSERVATION beside each program: the site, its citation and its
                               tier. 0009 made `source_url` NOT NULL on that table on purpose -
                               "hosts and locations are SOURCED, never curated - so an unsourced
                               instance is unrepresentable, not merely discouraged."

THE BOOKEND RULE IS REALISED IN THE DATA, NOT AT RENDER TIME, and this is the one place the
implementation differs from how contract §11.10 first described it. A `pre` bookend ends when its
anchor starts; a `post` one begins when the anchor ends. Doing that here rather than in two renderers
means the DURATION IS A FACT ON THE ROW - the grid draws a studio show exactly as it draws any other
program, and there is no anchor lookup in the phone renderer and a second one in the SVG renderer to
keep in step. It also makes the rule inspectable: `expected_duration_min` on the row is what will be
drawn, and `anchor_program_id` says what shortened it.

`docs/research/studio-shows.md` §2: "Studio shows carry the same distributor as the anchor game
window by construction", so the network comes from the registry and no anchor lookup is needed for
the ROW either.

WHERE THERE IS NO ANCHOR the show keeps its slot duration and renders on its own network row at its
slot - a standalone week, or a game not loaded yet. That is a real state, not a failure.
"""

from __future__ import annotations

import argparse
import html as _html
import json
import re
import sys
from datetime import date, datetime, time, timedelta
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

from pipeline.db import DB, ROOT, slug

ET = ZoneInfo("America/New_York")

REGISTRY = ROOT / "data" / "studio_shows.json"
CREWS = ROOT / "data" / "studio_crews.json"
DURATIONS = ROOT / "data" / "duration_defaults.json"

# How each show's `anchor_rule` resolves against the loaded slate. The rule TEXT lives in
# data/studio_shows.json so a reader can see it; this maps it to the query that answers it.
#
# Every entry is (sport, [service ids], pick) where pick is "earliest" or "latest" among that day's
# games on those networks. A network the day has no game on simply yields no anchor.
ANCHORS: dict[str, tuple[str, tuple[str, ...], str]] = {
    "gameday":       ("cfb", ("espn", "abc"), "earliest"),
    "bignoon":       ("cfb", ("fox",), "earliest"),
    "foxnflkickoff": ("nfl", ("fox",), "earliest"),
    "foxnflsunday":  ("nfl", ("fox",), "earliest"),
    "nfltoday":      ("nfl", ("cbs",), "earliest"),
    "fnia":          ("nfl", ("nbc",), "latest"),
    "mnfcountdown":  ("nfl", ("espn",), "earliest"),
}

ANCHOR_SQL = """
select g.id, g.canonical_kickoff_at_utc
from games g join game_broadcasts b on b.game_id = g.id
where g.sport = %s and g.viewing_day = %s and b.active and b.service_id = any(%s)
  and g.canonical_kickoff_at_utc is not null
order by g.canonical_kickoff_at_utc {order}
limit 1"""

PROGRAM_ID_SQL = """
select program_id from programs
 where sport = %s and program_type = 'studio_show' and title = %s and start_at = %s"""


def registry() -> dict[str, Any]:
    with open(REGISTRY, encoding="utf-8") as fh:
        return json.load(fh)


def crews() -> dict[str, Any]:
    with open(CREWS, encoding="utf-8") as fh:
        return json.load(fh)


# --------------------------------------------------------------------------- the GameDay site
#
# THE PRESS ROOM IS PROSE, NOT A TABLE. docs/research/studio-shows.md section 6 promised an "HTML
# table" of Date / Site / Game, and the show's landing page does carry one - but it is a HISTORICAL
# January bowl-season table, not the weekly one. The weekly site lives in each week's own release,
# written as a sentence: "opens its 40th season live from Baton Rouge, Louisiana ... airs Saturday,
# Sept. 5 from 9 a.m. to noon ET". So this reads the sentence.
#
# ONE RELEASE IS ONE WEEK. There is no page that lists every week's site, so a week with no recorded
# release has NO site - `site_text` stays null, the card renders no subtitle, and the tier says `tba`
# rather than pretending. Big Noon gets the same rule for the same reason.
GAMEDAY_SITE_RE = re.compile(
    r"live from\s+([A-Z][A-Za-z.\- ]+?,\s*[A-Z][A-Za-z.\- ]+?)\s*[,.]", re.S)
GAMEDAY_DATE_RE = re.compile(
    r"airs\s+\w+day,\s+([A-Z][a-z]{2})\w*\.?\s+(\d{1,2})", re.S)
ESPN_RELEASE_URL_RE = re.compile(r'<link rel="canonical" href="([^"]+)"')
GAMEDAY_FALLBACK_URL = "https://espnpressroom.com/us/press-releases/"

STATE_ABBR = {
    "Alabama": "AL", "Arizona": "AZ", "Arkansas": "AR", "California": "CA", "Colorado": "CO",
    "Connecticut": "CT", "Florida": "FL", "Georgia": "GA", "Idaho": "ID", "Illinois": "IL",
    "Indiana": "IN", "Iowa": "IA", "Kansas": "KS", "Kentucky": "KY", "Louisiana": "LA",
    "Maryland": "MD", "Massachusetts": "MA", "Michigan": "MI", "Minnesota": "MN",
    "Mississippi": "MS", "Missouri": "MO", "Nebraska": "NE", "Nevada": "NV", "New Jersey": "NJ",
    "New Mexico": "NM", "New York": "NY", "North Carolina": "NC", "Ohio": "OH", "Oklahoma": "OK",
    "Oregon": "OR", "Pennsylvania": "PA", "South Carolina": "SC", "Tennessee": "TN", "Texas": "TX",
    "Utah": "UT", "Virginia": "VA", "Washington": "WA", "Wisconsin": "WI",
}

MONTH_NUM = {m: i + 1 for i, m in enumerate(
    ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"])}


def gameday_site(release_html: str, year: int):
    """`(air_date, "City, ST")` from one ESPN Press Room GameDay release, or None.

    None rather than a partial answer: a site with no date, or a date with no site, is not something
    to write onto a row.
    """
    text = _html.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", release_html)))
    site = GAMEDAY_SITE_RE.search(text)
    when = GAMEDAY_DATE_RE.search(text)
    if not (site and when and when.group(1) in MONTH_NUM):
        return None
    city, _, state = site.group(1).partition(",")
    state = state.strip()
    return (date(year, MONTH_NUM[when.group(1)], int(when.group(2))),
            "%s, %s" % (city.strip(), STATE_ABBR.get(state, state)))


def gameday_sites(paths, year):
    """`{air_date: (site_text, source_url)}` across every recorded release."""
    out = {}
    for path in paths:
        p = Path(path)
        if not p.exists():
            continue
        raw = p.read_text(encoding="utf-8")
        got = gameday_site(raw, year)
        if got:
            url = ESPN_RELEASE_URL_RE.search(raw)
            out[got[0]] = (got[1], url.group(1) if url else GAMEDAY_FALLBACK_URL)
    return out


DEFAULT_RELEASES = [str(ROOT / "tests" / "fixtures" / "espn_gameday_release.html")]


def default_duration() -> int:
    with open(DURATIONS, encoding="utf-8") as fh:
        return int((json.load(fh).get("studio_show") or {}).get("default") or 120)


def crew_names(show_key: str, doc: dict[str, Any]) -> list[str]:
    """The ordered crew for a show, or `[]`. A "TBA" seat is dropped rather than rendered."""
    row = (doc.get("crews") or {}).get(show_key)
    if not row:
        return []
    return [c["name"] for c in row.get("crew") or []
            if c.get("name") and c["name"].upper() != "TBA"]


def air_dates(show: dict[str, Any], start: date, through: date):
    """Every date in range on the show's weekday, inside its own active window."""
    lo = max(start, date.fromisoformat(show["active_from"]))
    hi = min(through, date.fromisoformat(show["active_to"]))
    d = lo
    while d <= hi and d.weekday() != show["weekday"]:
        d += timedelta(days=1)
    while d <= hi:
        yield d
        d += timedelta(days=7)


def find_anchor(db: DB, show_key: str, day: date):
    """`(game_id, kickoff)` for a show's anchor on one viewing day, or `(None, None)`."""
    rule = ANCHORS.get(show_key)
    if rule is None or db.conn is None:
        return None, None
    sport, services, pick = rule
    sql = ANCHOR_SQL.format(order="asc" if pick == "earliest" else "desc")
    rows = db.fetch(sql, (sport, day, list(services)))
    return (rows[0][0], rows[0][1]) if rows else (None, None)


def build(db: DB, start: date, through: date,
          releases: list[str] | None = None) -> tuple[list[dict[str, Any]], list[str]]:
    doc = registry()
    crew_doc = crews()
    fallback = default_duration()
    sites = gameday_sites(DEFAULT_RELEASES if releases is None else releases, start.year)
    rows: list[dict[str, Any]] = []
    notes: list[str] = []
    anchored = 0

    for show in doc["shows"]:
        key = show["show_key"]
        crew = crew_names(key, crew_doc)
        slot = time.fromisoformat(show["slot_start_et"])
        for day in air_dates(show, start, through):
            when = datetime(day.year, day.month, day.day, slot.hour, slot.minute, tzinfo=ET)
            minutes = show.get("duration_min") or fallback
            provenance = ("data/studio_shows.json" if show.get("duration_min")
                          else "duration_defaults.json studio_show.default")
            anchor_id, kickoff = find_anchor(db, key, day)
            if kickoff is not None:
                # THE BOOKEND RULE. A `pre` show ends when its anchor starts; it never overruns the
                # game it is introducing, and it never claims a slot longer than the gap.
                gap = int((kickoff - when).total_seconds() // 60)
                if show["bookend"] == "pre" and 0 < gap < minutes:
                    minutes = gap
                    provenance = "bookend: shortened to the anchor's kickoff"
                anchored += 1
            elif key in ANCHORS:
                notes.append("no anchor for %s on %s - it renders at its slot on its own row"
                             % (key, day))
            # THE SITE. Only College GameDay has a machine-readable one, and only for the weeks a
            # release was recorded. Everything else is `tba` and renders no subtitle - never a
            # guess. `site_tier` travels with it so a reader can tell an announcement from silence.
            site_text, site_url = (sites.get(day) if key == "gameday" else None) or (None, None)
            site_tier = "announced" if site_text else "tba"
            rows.append({
                "sport": show["sport"], "program_type": "studio_show", "series": None,
                "title": show["title"],
                # A studio show in-studio has NO subtitle: studio-city display is road-only
                # (docs/research/events-summary-2.md section 6). The site fills this in when there
                # is one, and there is one only where a press release stated it.
                "subtitle": ("Live from %s" % site_text) if site_text else None,
                "location_text": site_text,
                "start_at": when.astimezone(ZoneInfo("UTC")).strftime("%Y-%m-%dT%H:%M:%S") + ".000Z",
                "expected_duration_min": minutes,
                "open_ended": show["bookend"] == "post",
                "brand_key": show["brand_key"], "bookend": show["bookend"],
                "hosts_crew": crew,
                "source_url": show["source_url"], "source_tier": "official_press_room",
                "broadcasts": [{"service_id": show["network_key"], "label": show["network_key"],
                                "delivery_surface": "LINEAR", "feed_side": "NATIONAL",
                                "is_primary": True, "requires_auth": False}]
                + ([{"service_id": show["simulcast"], "label": show["simulcast"],
                     "delivery_surface": "STREAMING" if show["simulcast"] in ("Peacock",) else "LINEAR",
                     "feed_side": "NATIONAL", "is_primary": False,
                     "requires_auth": show["simulcast"] in ("Peacock",)}]
                    if show.get("simulcast") else []),
                "_studio": {"show_key": key, "air_date": day.isoformat(),
                            "anchor_game_id": anchor_id,
                            "on_site": bool(show.get("on_site") and site_text),
                            "site_tier": site_tier, "site_source_url": site_url},
                "_provenance": {"duration": provenance, "anchor_rule": show["anchor_rule"]},
            })
    notes.append("%d of %d instances found an anchor" % (anchored, len(rows)))
    for nl in doc["_not_loaded"]:
        notes.append("NOT LOADED - %s: %s" % (nl["show"], nl["why"]))
    rows.sort(key=lambda r: (r["start_at"], r["title"]))
    return rows, notes


def load_registry(db: DB, doc: dict[str, Any]) -> int:
    """Upsert `studio_shows`. 0009 named these columns; 0013 added the slot ones."""
    n = 0
    for s in doc["shows"]:
        db.run(
            "insert into studio_shows (show_id, name, network, sport_covered, default_slot, "
            "bookend, weekday, slot_start_et, duration_min, anchor_rule, active_from, active_to, "
            "source_url, updated_at) values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, now()) "
            "on conflict (show_id) do update set name = excluded.name, network = excluded.network, "
            "sport_covered = excluded.sport_covered, default_slot = excluded.default_slot, "
            "bookend = excluded.bookend, weekday = excluded.weekday, "
            "slot_start_et = excluded.slot_start_et, duration_min = excluded.duration_min, "
            "anchor_rule = excluded.anchor_rule, active_from = excluded.active_from, "
            "active_to = excluded.active_to, source_url = excluded.source_url, updated_at = now()",
            # `studio_shows.network` is an FK into networks_services, whose ids are SLUGS - the
            # registry carries display names ("ESPN", "The CW"), and writing one straight in fails
            # with a foreign-key violation. pipeline/db.slug() is the same function the renderer's
            # NET_SLUG and the program loader both use, so there is one spelling of a network id.
            (s["show_key"], s["title"], slug(s["network_key"]), s["sport"],
             "%s %s ET" % (["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][s["weekday"]],
                           s["slot_start_et"]),
             s["bookend"], s["weekday"], s["slot_start_et"], s.get("duration_min"),
             s["anchor_rule"], s["active_from"], s["active_to"], s["source_url"]),
            tag="studio_shows")
        n += 1
    return n


def load_instances(db: DB, rows: list[dict[str, Any]]) -> tuple[int, int]:
    """One `studio_show_instances` row per generated program, linked to it by its natural key.

    `source_url` is NOT NULL by 0009's design, so an instance with no citation is unrepresentable.
    Every row here carries the registry's source, which is where its slot came from.
    """
    written = linked = 0
    for r in rows:
        meta = r["_studio"]
        pid = None
        if db.conn is not None:
            found = db.fetch(PROGRAM_ID_SQL, (r["sport"], r["title"], r["start_at"]))
            pid = found[0][0] if found else None
            if pid:
                linked += 1
        db.run(
            "insert into studio_show_instances (show_id, program_id, air_date, location_text, "
            "on_site, hosts, source_url, source_tier, observed_at) "
            "values (%s, %s, %s, %s, %s, %s, %s, %s, now()) "
            "on conflict (show_id, air_date) do update set program_id = excluded.program_id, "
            "location_text = excluded.location_text, on_site = excluded.on_site, "
            "hosts = excluded.hosts, source_url = excluded.source_url, "
            "source_tier = excluded.source_tier, observed_at = now()",
            (meta["show_key"], pid, meta["air_date"], r.get("location_text"),
             bool(meta["on_site"]), json.dumps(r["hosts_crew"]),
             # 0009 made this NOT NULL on purpose. A SITE that came from a release cites that
             # release; a row with no site cites the registry entry that produced the slot. Either
             # way there is a URL, which is what "unsourced is unrepresentable" means.
             meta.get("site_source_url") or r["source_url"],
             "announced" if meta.get("site_tier") == "announced" else "reported"),
            tag="studio_show_instances")
        written += 1
    return written, linked


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--from", dest="start", default=None)
    ap.add_argument("--through", default="2026-12-31")
    ap.add_argument("--emit-sql", metavar="FILE")
    ap.add_argument("--export", metavar="FILE", help="write the programs as JSON and exit")
    ap.add_argument("--instances-only", action="store_true",
                    help="registry + instances only; the programs are loaded separately")
    args = ap.parse_args(argv)

    start = date.fromisoformat(args.start) if args.start else datetime.now(tz=ET).date()
    through = date.fromisoformat(args.through)

    db = DB(args.emit_sql)
    rows, notes = build(db, start, through)
    by_show: dict[str, int] = {}
    for r in rows:
        by_show[r["title"]] = by_show.get(r["title"], 0) + 1
    print("studio shows %s..%s: %d instances" % (start, through, len(rows)))
    for k in sorted(by_show):
        print("   %-30s %d" % (k, by_show[k]))
    for n in notes[:8]:
        print("   note: %s" % n)
    if len(notes) > 8:
        print("   ... %d more notes" % (len(notes) - 8))

    if args.export:
        p = Path(args.export)
        p.parent.mkdir(parents=True, exist_ok=True)
        with open(p, "w", encoding="utf-8", newline="\n") as fh:
            json.dump(rows, fh, indent=1, ensure_ascii=False)
            fh.write("\n")
        print("wrote %s" % p)
        db.close()
        return 0

    n_reg = load_registry(db, registry())
    written, linked = load_instances(db, rows)
    db.commit()
    print("registry %d shows | instances %d written, %d linked to a program" % (n_reg, written, linked))
    if db.conn is None and db.emit_path:
        print("wrote %s (%d statements)" % (db.emit_path, len(db.emitted)))
    db.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
