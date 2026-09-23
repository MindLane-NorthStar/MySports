#!/usr/bin/env python3
"""MySports adapter — Schedules Direct station listings for the Cleveland CBS and FOX affiliates.

    python -m adapters.sd_listings --out "$RUNNER_TEMP/nfl_listings.json"

WHY (prompt 117, Joe's ruling 2026-09-23, register §62). Every CBS or FOX Sunday-afternoon NFL game
is a REGIONAL feed: what a viewer in Cleveland gets is decided by the station - WOIO 19 for CBS,
WJW 8 for FOX - not by the network. `adapters/espn.py` needed a per-week coverage map hand-entered
from 506sports, and that entry never happened, so every CBS and FOX game sat "Market TBD" all week,
every week. The source that actually answers the question is the stations' own TV listings, and the
listings also answer the question no coverage map can: "there is no late game here."

THE SOURCE. Schedules Direct (https://www.schedulesdirect.org) - the official Gracenote guide data for
personal, open-source use, US$35 a year. JSON API 20141201, documented at
https://github.com/SchedulesDirect/JSON-Service/wiki/API-20141201; about 20 days of US listings.
Its terms allow "individual use only and exclusively to Open Source software"; this repository is
public (Joe, 2026-09-23).

WHAT THIS WRITES: one JSON file naming every airing on each affiliate for yesterday through today +
13 days (Eastern viewing days) - start (UTC), duration, the program's titles, the episode title, the
team names the program metadata carries, and whether the airing is an NFL game. `adapters/espn.py`
reads it through MYSPORTS_NFL_LISTINGS and decides each CBS/FOX row from it.

WHAT THIS NEVER WRITES: the credentials, the postal code, or the lineup id. Joe's postal code is a
personal identifier and the lineup id (`USA-OTA-<postal>`) contains it, so both are redacted from
every log line and appear in no output, fixture or committed file. The station ids are looked up at
run time by callsign (`data/markets.json` nfl.affiliates) and never committed either.

FAILURE NEVER FAILS THE REFRESH. Missing secrets, a 4xx or 5xx, a timeout: one log line, no output
file, exit 0. Downstream then behaves exactly as it did before this step existed.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Callable

from adapters.common import ET, find_repo_root, http_json, load_data

BASE = "https://json.schedulesdirect.org/20141201"
USER_AGENT = "MySports/1.0 (open-source personal sports guide)"
DEFAULT_DAYS_AHEAD = 13

# An NFL GAME airing, as the guide titles it. "NFL Football" is the game; "NFL on FOX Postgame",
# "NFL Kickoff", "The NFL Today" and every other studio show is not. Kept narrow on purpose - a title
# this does not match is "not a game", and adapters/espn.py then treats the window as carrying no
# game, which is the honest reading of a listing that does not say "NFL Football".
NFL_GAME_TITLE = re.compile(r"^NFL Football$", re.IGNORECASE)
TEAM_SPLIT = re.compile(r"\s+(?:at|vs\.?|@)\s+", re.IGNORECASE)


def sha1_hex(password: str) -> str:
    """The API takes the password as its lowercase SHA-1 hex digest, never in clear."""
    return hashlib.sha1(password.encode("utf-8")).hexdigest().lower()


def redact(text: str, secrets: list[str]) -> str:
    """Every log line goes through this: the postal code and the lineup id never reach a log."""
    out = str(text)
    for s in sorted((s for s in secrets if s), key=len, reverse=True):   # longest first: the lineup id contains the postal code
        out = out.replace(s, "<redacted>")
    return out


def is_nfl_game_title(title: str | None) -> bool:
    return bool(title) and bool(NFL_GAME_TITLE.match(str(title).strip()))


def teams_from_program(prog: dict[str, Any]) -> list[str]:
    """Team names the program carries: `eventDetails.teams[].name` when the guide sends them, else
    the episode title split on at / vs. / @. Empty when neither says."""
    ev = prog.get("eventDetails") or {}
    names = [str(t.get("name")).strip() for t in (ev.get("teams") or []) if t.get("name")]
    if names:
        return names
    ep = str(prog.get("episodeTitle150") or "").strip()
    if ep and TEAM_SPLIT.search(ep):
        return [p.strip() for p in TEAM_SPLIT.split(ep, maxsplit=1) if p.strip()]
    return []


def viewing_dates(today: date, days_ahead: int = DEFAULT_DAYS_AHEAD) -> list[str]:
    """Yesterday through today + days_ahead, as YYYY-MM-DD."""
    return [(today + timedelta(days=i)).isoformat() for i in range(-1, days_ahead + 1)]


def default_http(method: str, url: str, body: Any = None, headers: dict[str, str] | None = None) -> Any:
    hdrs = {"User-Agent": USER_AGENT}
    hdrs.update(headers or {})
    return http_json(url, headers=hdrs, method=method, data=body)


class SdClient:
    """The five calls, in order, against an injectable `http(method, url, body, headers)`."""

    def __init__(self, username: str, password: str, postal: str, *, http: Callable | None = None,
                 log: Callable[[str], None] = print, today: date | None = None):
        self.username, self.password, self.postal = username, password, postal
        # resolved at call time, not definition time, so a test can replace the module's helper
        self.http, self.today = (http or default_http), (today or datetime.now(ET).date())
        self.lineup_id: str | None = None
        self.token: str | None = None
        self._log = log

    # -- logging that can never leak the identifiers
    @property
    def secrets(self) -> list[str]:
        return [s for s in (self.postal, self.lineup_id, self.password, self.token) if s]

    def log(self, msg: str) -> None:
        self._log(redact(msg, self.secrets))

    # -- calls
    def _call(self, method: str, path: str, body: Any = None) -> Any:
        headers = {"token": self.token} if self.token else {}
        return self.http(method, f"{BASE}{path}", body, headers)

    def authenticate(self) -> None:
        r = self._call("POST", "/token", {"username": self.username, "password": sha1_hex(self.password)})
        if not isinstance(r, dict) or r.get("code") not in (0, None) or not r.get("token"):
            raise RuntimeError(f"token refused: code {r.get('code') if isinstance(r, dict) else '?'}")
        self.token = r["token"]

    def choose_lineup(self) -> str:
        """The over-the-air lineup for the postal code, added to the account once if it is missing.
        The API allows six adds a day, so an add only happens when the lineup is absent."""
        heads = self._call("GET", f"/headends?country=USA&postalcode={self.postal}")
        ota = None
        for h in heads or []:
            for lu in h.get("lineups") or []:
                lid = str(lu.get("lineup") or "")
                if lid.startswith("USA-OTA-"):
                    ota = lid
                    break
            if ota:
                break
        if not ota:
            raise RuntimeError("no over-the-air lineup for the postal code")
        self.lineup_id = ota
        mine = self._call("GET", "/lineups")
        present = {str(lu.get("lineup")) for lu in ((mine or {}).get("lineups") or [])}
        if ota not in present:
            self.log("adding the over-the-air lineup to the account (once)")
            self._call("PUT", f"/lineups/{ota}")
        return ota

    def station_ids(self, callsigns: dict[str, str]) -> dict[str, str]:
        """{network: stationID} for the affiliates' callsigns, from the lineup's station list."""
        lu = self._call("GET", f"/lineups/{self.lineup_id}")
        by_call = {str(s.get("callsign") or "").upper(): str(s.get("stationID")) for s in (lu or {}).get("stations") or []}
        out = {}
        for network, call in callsigns.items():
            sid = by_call.get(call.upper())
            if not sid:
                raise RuntimeError(f"station {call} is not in the lineup")
            out[network] = sid
        return out

    def schedules(self, station_ids: list[str], dates: list[str]) -> list[dict[str, Any]]:
        return self._call("POST", "/schedules", [{"stationID": sid, "date": dates} for sid in station_ids]) or []

    def programs(self, program_ids: list[str]) -> dict[str, dict[str, Any]]:
        """Each program id fetched ONCE within a run (the API's MD5 guidance), in one request."""
        ids = sorted(set(program_ids))
        if not ids:
            return {}
        rows = self._call("POST", "/programs", ids) or []
        return {str(p.get("programID")): p for p in rows if p.get("programID")}

    def run(self, affiliates: dict[str, str], days_ahead: int = DEFAULT_DAYS_AHEAD) -> dict[str, Any]:
        self.authenticate()
        self.choose_lineup()
        sids = self.station_ids(affiliates)
        dates = viewing_dates(self.today, days_ahead)
        sched = self.schedules(list(sids.values()), dates)
        pids = [str(p.get("programID")) for s in sched for p in s.get("programs") or [] if p.get("programID")]
        progs = self.programs(pids)
        return build_output(sched, progs, sids, affiliates, dates)


def build_output(schedules: list[dict[str, Any]], programs: dict[str, dict[str, Any]],
                 station_ids: dict[str, str], affiliates: dict[str, str], dates: list[str]) -> dict[str, Any]:
    """The listings file: keyed by CALLSIGN, carrying no station id, lineup id or postal code."""
    call_of_sid = {sid: affiliates[net] for net, sid in station_ids.items()}
    net_of_call = {call: net for net, call in affiliates.items()}
    stations: dict[str, dict[str, Any]] = {call: {"network": net_of_call[call], "airings": []} for call in call_of_sid.values()}
    for s in schedules:
        call = call_of_sid.get(str(s.get("stationID")))
        if not call:
            continue
        for p in s.get("programs") or []:
            prog = programs.get(str(p.get("programID"))) or {}
            title = next((t.get("title120") for t in prog.get("titles") or [] if t.get("title120")), None)
            stations[call]["airings"].append({
                "start": p.get("airDateTime"),
                "durationSec": p.get("duration"),
                "title": title,
                "episodeTitle": prog.get("episodeTitle150"),
                "teams": teams_from_program(prog),
                "isNflGame": is_nfl_game_title(title),
            })
        stations[call]["airings"].sort(key=lambda a: a.get("start") or "")
    return {
        "source": "schedulesdirect",
        "generatedAt": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "window": {"from": dates[0], "to": dates[-1]},
        "stations": stations,
    }


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--out", required=True, help="where to write the listings JSON")
    ap.add_argument("--days", type=int, default=DEFAULT_DAYS_AHEAD)
    args = ap.parse_args(argv)
    username, password, postal = os.getenv("SD_USERNAME"), os.getenv("SD_PASSWORD"), os.getenv("SD_POSTAL_CODE")
    if not (username and password and postal):
        print("sd_listings: SD_USERNAME / SD_PASSWORD / SD_POSTAL_CODE not set - no listings written, refresh continues")
        return 0
    root = find_repo_root()
    affiliates = (load_data(root, "markets.json", {}).get("nfl") or {}).get("affiliates") or {}
    if not affiliates:
        print("sd_listings: data/markets.json carries no nfl.affiliates - no listings written, refresh continues")
        return 0
    client = SdClient(username, password, postal)
    try:
        out = client.run(affiliates, args.days)
    except Exception as e:  # noqa: BLE001 - one line, no file, exit 0: the refresh must not fail on listings
        client.log(f"sd_listings: failed ({type(e).__name__}: {e}) - no listings written, refresh continues")
        return 0
    text = json.dumps(out, indent=1) + "\n"
    for s in client.secrets:
        if s and s in text:   # belt and braces: the file must not carry an identifier either
            client.log("sd_listings: refusing to write listings that carry an identifier")
            return 0
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    Path(args.out).write_text(text, encoding="utf-8", newline="\n")
    n = sum(len(st["airings"]) for st in out["stations"].values())
    games = sum(1 for st in out["stations"].values() for a in st["airings"] if a["isNflGame"])
    client.log(f"sd_listings: {n} airings on {', '.join(out['stations'])} ({games} NFL games) -> {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
