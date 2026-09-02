#!/usr/bin/env python3
"""MySports adapters — shared plumbing (spec §8.5 provider abstraction, Milestone 8 part 1).

Every adapter writes the SAME sanitized fixture shape the renderer already reads
(`artifacts/validation/cfbd_2026_week1_fixture.json` is the reference), plus a teams file
with the CFBD-style keys the renderer expects (id, school, abbreviation, conference,
classification, color, alternateColor, logos).

Fixture shape (one game):
    {
      "id": <str|int>,            # provider id; pro leagues prefix the sport: "nhl-2026020011"
      "sport": "cfb"|"nfl"|"nhl"|"nba"|"mlb",
      "season": 2026, "week": 1 | null,
      "startDate": "2026-10-01T23:00:00Z",   # ISO-8601 UTC
      "startTimeET": "Thu 2026-10-01 7:00 PM ET",
      "startTimeTBD": false,
      "neutralSite": false,
      "venue": "Nationwide Arena" | null,
      "home": {"id": "nhl-29", "team": "Columbus Blue Jackets", "conference": "Metropolitan", "classification": "nhl"},
      "away": {...},
      "media": [ {"mediaType": "tv"|"web", "outlet": "ESPN", "access": "AVAILABLE"|"UNAVAILABLE"|"UNKNOWN"|"OUT_OF_MARKET"|"UNVERIFIED",
                  "market": "national"|"regional"|"local", "carriageCertainty": "CONFIRMED"|"UNANNOUNCED"|"TBA_NO_RIGHTS_HOLDER",
                  "isStartTimeTBD": false, "startTime": "...", "source": "espn.scoreboard"} ],
      "odds": {"provider": "DraftKings", "spread": -3.5, "favorite": "home", "details": "CIN -3.5", "overUnder": 51.5,
               "moneylineHome": "-192", "moneylineAway": "+160", "fetchedAt": "..."} | null,
      "records": {"home": "0-0", "away": "0-0"} | null,
      "flags": {"isTBDFlex": false}
    }

Team ids are namespaced per sport ("nhl-29", "nfl-4") so `assets/logos/{id}.png` never collides
with CFBD's integer ids. CFB keeps its integer ids (contract v1.4 fixtures stay byte-compatible).

Windows-certified: no `%-I`/`%-d` strftime, every open() passes encoding=, console output is ASCII-safe.
Network: stdlib urllib only (no requests dependency) — the machine that runs these is the one with
egress to the league APIs (Claude Code on Windows per the deploy protocol). `--from-file` replays a
saved raw payload so the transform can be exercised offline.
"""
from __future__ import annotations

import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

ET = ZoneInfo("America/New_York")
UA = "MySports-adapters/0.1 (+https://github.com/MindLane-NorthStar/MySports)"

try:  # Windows consoles default to cp1252
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass


# ----------------------------------------------------------------------------- repo + env
def find_repo_root(start: Path | None = None) -> Path:
    start = (start or Path.cwd()).resolve()
    for p in [start, *start.parents]:
        if (p / ".git").exists() or (p / ".env").exists():
            return p
    return start


def load_dotenv(path: Path) -> None:
    """Minimal .env loader; existing environment wins; values are never printed."""
    if not path.exists():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        if line.startswith("export "):
            line = line[7:].strip()
        k, v = line.split("=", 1)
        k, v = k.strip(), v.strip()
        if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", k):
            continue
        if len(v) >= 2 and v[0] == v[-1] and v[0] in ("'", '"'):
            v = v[1:-1]
        os.environ.setdefault(k, v)


def load_data(root: Path, name: str, default: Any = None) -> Any:
    p = root / "data" / name
    if not p.exists():
        return default
    return json.loads(p.read_text(encoding="utf-8"))


# ----------------------------------------------------------------------------- http
def http_json(url: str, headers: dict[str, str] | None = None, params: dict[str, Any] | None = None,
              timeout: int = 45, retries: int = 2) -> Any:
    if params:
        q = urllib.parse.urlencode({k: v for k, v in params.items() if v is not None}, doseq=True)
        url = f"{url}?{q}"
    hdrs = {"Accept": "application/json", "User-Agent": UA}
    hdrs.update(headers or {})
    last: Exception | None = None
    for attempt in range(retries + 1):
        req = urllib.request.Request(url, headers=hdrs, method="GET")
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", errors="replace")[:500]
            last = RuntimeError(f"HTTP {e.code} for {url.split('?')[0]}: {body}")
            if e.code in (429, 500, 502, 503, 504) and attempt < retries:
                time.sleep(1.5 * (attempt + 1))
                continue
            raise last from e
        except urllib.error.URLError as e:
            last = RuntimeError(f"request failed for {url.split('?')[0]}: {e}")
            if attempt < retries:
                time.sleep(1.5 * (attempt + 1))
                continue
            raise last from e
    raise last  # pragma: no cover


def download(url: str, dest: Path, headers: dict[str, str] | None = None, skip_existing: bool = True) -> str:
    """Fetch a binary asset to `dest`. Returns 'cached' | 'ok' | 'error: ...'. Never re-scrapes (spec §3.9)."""
    if skip_existing and dest.exists() and dest.stat().st_size > 0:
        return "cached"
    dest.parent.mkdir(parents=True, exist_ok=True)
    hdrs = {"User-Agent": UA}
    hdrs.update(headers or {})
    try:
        req = urllib.request.Request(url, headers=hdrs)
        with urllib.request.urlopen(req, timeout=45) as resp:
            data = resp.read()
        if not data:
            return "error: empty body"
        dest.write_bytes(data)
        return "ok"
    except Exception as e:  # noqa: BLE001 — report, never abort a schedule run over a logo
        return f"error: {e}"


# ----------------------------------------------------------------------------- time (Windows-portable)
def parse_iso(value: str | None) -> datetime | None:
    if not value:
        return None
    v = value.strip()
    if v.endswith("Z"):
        v = v[:-1] + "+00:00"
    # ESPN emits "2026-09-13T17:00Z" (no seconds) — fromisoformat needs seconds on older Pythons
    m = re.fullmatch(r"(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})([+-]\d{2}:\d{2})", v)
    if m:
        v = f"{m.group(1)}:00{m.group(2)}"
    try:
        dt = datetime.fromisoformat(v)
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def iso_utc(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S") + ".000Z"


def clock(dt: datetime) -> str:
    """'7:00 PM' — portable (Windows' strftime has no %-I)."""
    return f"{dt.hour % 12 or 12}:{dt.minute:02d} {'AM' if dt.hour < 12 else 'PM'}"


def et_display(value: str | None) -> str:
    dt = parse_iso(value)
    if dt is None:
        return value or "TBD"
    e = dt.astimezone(ET)
    return f"{e.strftime('%a')} {e.strftime('%Y-%m-%d')} {clock(e)} ET"


def et_date(value: str | None) -> str | None:
    dt = parse_iso(value)
    return dt.astimezone(ET).strftime("%Y-%m-%d") if dt else None


def now_et_iso() -> str:
    return datetime.now(tz=ET).isoformat()


# ----------------------------------------------------------------------------- outlets + access
OUTLET_ALIASES = {
    "CW": "The CW", "The CW Network": "The CW", "USA": "USA Network", "USA Net": "USA Network",
    "BTN": "Big Ten Network", "ACCN": "ACC Network", "SECN": "SEC Network", "SECN+": "SEC Network+",
    "ESPN Unlmtd": "ESPN Unlimited", "CBSSN": "CBS Sports Network", "FOX Sports 1": "FS1", "FOX Sports 2": "FS2",
    "ESPN Plus": "ESPN+", "Paramount Plus": "Paramount+", "Max": "HBO Max", "HBO MAX": "HBO Max", "MAX": "HBO Max", "Amazon Prime Video": "Prime Video",
    "Prime": "Prime Video", "Amazon": "Prime Video", "HULU": "Hulu", "NFL Net": "NFL Network", "NFLN": "NFL Network",
    "TruTV": "truTV", "SN": "Sportsnet", "SNP": "Sportsnet", "SNO": "Sportsnet", "SNE": "Sportsnet", "SNW": "Sportsnet",
    "TVAS": "TVA Sports", "CBC": "CBC", "ESPN Deportes": "ESPN Deportes",
    "WUAB": "WUAB 43", "WUAB-43": "WUAB 43", "Cleveland's 43": "WUAB 43", "Cavaliers on DAZN": "DAZN", "DAZN 1": "DAZN",
    # MLB raw spellings (docs/research/mlb-adapter-brief.md 3.1-3.2); opponent RSNs pass through verbatim
    "Guardians.TV Presented by Progressive": "Guardians TV",
    "CLEGuardians.TV": "Guardians TV",
    "MLBN": "MLB Network",
    "ESPN/ESPN App": "ESPN",
    "ABC/ESPN App": "ABC",
    "NBC/Peacock": "NBC",
    "Peacock/NBCSN": "Peacock",
    "Peacock / NBCSN Extra": "Peacock",
    "FOX / FOX ONE": "FOX",
    "TBS (out-of-market only)": "TBS",
    "FOX / FS1": "FOX",
    "WKYC 3": "NBC",
}


def normalize_outlet(outlet: str | None) -> str:
    o = re.sub(r"\s+", " ", (outlet or "").strip())
    return OUTLET_ALIASES.get(o, o)


def access_lookup(root: Path) -> tuple[set[str], set[str]]:
    """Viewer access profile (spec §3.2) from data/access_profile.json; falls back to the Phase 3 label set."""
    prof = load_data(root, "access_profile.json")
    if prof:
        return set(prof.get("available", [])), set(prof.get("unavailable", []))
    available = {"ABC", "CBS", "FOX", "NBC", "The CW", "ESPN", "ESPN2", "ESPNU", "FS1", "Big Ten Network", "ACC Network",
                 "SEC Network", "USA Network", "TNT", "truTV", "TBS", "NFL Network", "ESPN+", "ESPN Unlimited", "Peacock",
                 "Paramount+", "HBO Max", "Prime Video", "Disney+", "Hulu", "Netflix", "YouTube", "Apple TV", "SEC Network+"}
    unavailable = {"CBS Sports Network", "FS2", "MW+", "UConn+", "Sportsnet", "TVA Sports", "CBC", "Sportsnet+"}
    return available, unavailable


def outlet_access(outlet: str, available: set[str], unavailable: set[str]) -> str:
    o = normalize_outlet(outlet)
    if o in unavailable:
        return "UNAVAILABLE"
    if o in available:
        return "AVAILABLE"
    low = o.lower()
    if low in {"accnx", "sec network+", "secn+", "espn3", "espn app"}:
        return "CONDITIONAL/VERIFY"
    if any(k in low for k in ("paramount", "peacock", "espn+", "espn plus")) or low in {"max", "hbo max"}:
        return "AVAILABLE"
    return "UNKNOWN"


def media_row(media_type: str, outlet: str, access: str, *, market: str = "national",
              certainty: str = "CONFIRMED", start_time: str | None = None, tbd: bool = False,
              source: str = "", label: str | None = None) -> dict[str, Any]:
    row = {"mediaType": media_type, "outlet": outlet, "access": access, "market": market,
           "carriageCertainty": certainty, "isStartTimeTBD": bool(tbd), "startTime": start_time, "source": source}
    if label:
        row["label"] = label
    return row


# --------------------------------------------------------------------------- result status (Milestone 4 part 0)
# games.result_status vocabulary; scores are loader-written provider facts, never reconciled observations.
RESULT_STATES = ("scheduled", "in_progress", "final", "postponed", "cancelled")
# every provider word observed in a live payload, mapped to that vocabulary
_PROVIDER_STATE = {
    "pre": "scheduled", "in": "in_progress", "post": "final",                       # ESPN status.type.state
    "FUT": "scheduled", "PRE": "scheduled", "LIVE": "in_progress",                  # NHL gameState
    "CRIT": "in_progress", "FINAL": "final", "OFF": "final",
    "Preview": "scheduled", "Live": "in_progress", "Final": "final",                # MLB abstractGameState
}


def result_status(state: str | None, *, detail: str | None = None, context: str = "") -> str | None:
    """Provider state -> games.result_status. Postponed/cancelled in `detail` wins over `state`.

    Fail honest (Joe, 2026-09-01): a state this table does not know maps to None with one warning line.
    An unknown state is NEVER guessed to 'final' - a wrong final freezes completed_at and boxscore_url,
    and the history it feeds cannot be backfilled.
    """
    d = (detail or "").upper()
    if "POSTPONE" in d:
        return "postponed"
    if "CANCEL" in d:          # ESPN spells it CANCELED, MLB Cancelled
        return "cancelled"
    if state is None:
        return None
    key = str(state).strip()
    mapped = _PROVIDER_STATE.get(key) or _PROVIDER_STATE.get(key.upper()) or _PROVIDER_STATE.get(key.title())
    if mapped is None:
        print(f"  warn: unrecognized provider status {state!r}{' (' + context + ')' if context else ''}"
              f" - result_status left null")
    return mapped


def score_int(value: Any, status: str | None) -> int | None:
    """Scores only exist once a game is under way; ESPN sends the string '0' on scheduled games."""
    if status not in ("in_progress", "final") or value is None or value == "":
        return None
    try:
        return int(str(value))
    except (TypeError, ValueError):
        return None


# ----------------------------------------------------------------------------- output
def dump_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False, sort_keys=False) + "\n", encoding="utf-8")


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def md_table(headers: list[str], rows: list[list[Any]]) -> str:
    def cell(x: Any) -> str:
        return str(x if x is not None else "").replace("|", r"\|").replace("\n", " ")
    out = ["| " + " | ".join(cell(h) for h in headers) + " |", "| " + " | ".join("---" for _ in headers) + " |"]
    out.extend("| " + " | ".join(cell(v) for v in r) + " |" for r in rows)
    return "\n".join(out)


def fixture_envelope(sport: str, season: Any, week: Any, games: list[dict[str, Any]], **meta: Any) -> dict[str, Any]:
    env = {"generatedAt": now_et_iso(), "sport": sport, "year": season, "week": week, "apiKeyIncluded": False}
    env.update(meta)
    return {"validation": env, "games": games}


def team_record(tid: str, school: str, abbreviation: str, conference: str | None, classification: str,
                color: str | None, alt: str | None, logos: list[str], **extra: Any) -> dict[str, Any]:
    rec = {"id": tid, "school": school, "abbreviation": abbreviation, "conference": conference,
           "classification": classification, "color": hex6(color), "alternateColor": hex6(alt), "logos": logos}
    rec.update(extra)
    return rec


def hex6(c: str | None) -> str | None:
    if not c:
        return None
    c = str(c).strip().lstrip("#")
    return f"#{c.lower()}" if re.fullmatch(r"[0-9a-fA-F]{6}", c) else None


def fetch_logos(teams: list[dict[str, Any]], logos_dir: Path, needed_ids: set[str] | None = None) -> dict[str, int]:
    """Download each team's first logo URL to assets/logos/{id}.png (idempotent). Returns counts."""
    counts = {"ok": 0, "cached": 0, "error": 0, "no-url": 0}
    for t in teams:
        if needed_ids is not None and str(t["id"]) not in needed_ids:
            continue
        url = (t.get("logos") or [None])[0]
        if not url:
            counts["no-url"] += 1
            continue
        r = download(url, logos_dir / f"{t['id']}.png")
        counts["ok" if r == "ok" else "cached" if r == "cached" else "error"] += 1
        if r.startswith("error"):
            print(f"  logo {t['id']} ({t.get('school')}): {r}")
    return counts


def load_raw_or_fetch(from_file: str | None, fetcher, save_to: Path | None = None) -> Any:
    """`--from-file` replay support: read a saved raw payload instead of hitting the network."""
    if from_file:
        return json.loads(Path(from_file).read_text(encoding="utf-8"))
    data = fetcher()
    if save_to is not None:
        dump_json(save_to, data)
    return data
