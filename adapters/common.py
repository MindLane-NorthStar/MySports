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
# ESPN sits behind Akamai, which can answer with 403 "Access Denied" (errors.edgesuite.net) - seen from
# the Cowork cloud workspace on 2026-09-02 (research changelog, Brief 2 standing gotcha).
#
# **A browser UA is OFF by default, and that is a measured decision, not an oversight.** Sending one was
# tried on the Actions runner on 2026-09-03 and it made things WORSE: the 15:00Z run on the honest
# project UA fetched NFL, NBA and CFB fine, and the very next run - identical except for a Chrome UA -
# got 403 on the first ESPN call (run 33673744218). Akamai's bot manager scores a Chrome User-Agent that
# arrives with none of the headers a real Chrome sends (Accept-Language, Sec-Fetch-*, a plausible
# Referer) as a spoofing client, which is a stronger signal than an honest bot UA. Half a disguise is
# worse than none.
#
# Set MYSPORTS_ESPN_BROWSER_UA=1 to switch it on without a code change if the honest UA ever starts
# getting blocked on its own - but if that day comes, send a COMPLETE header set, not just this line.
BROWSER_UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) "
              "Chrome/140.0.0.0 Safari/537.36")
ESPN_HOSTS = ("espn.com", "espncdn.com")


def ua_for(url: str) -> str:
    """The project UA, unless MYSPORTS_ESPN_BROWSER_UA is set and the host is one of ESPN's."""
    if os.getenv("MYSPORTS_ESPN_BROWSER_UA", "") not in ("1", "true", "yes"):
        return UA
    host = urllib.parse.urlsplit(url).hostname or ""
    return BROWSER_UA if any(host == h or host.endswith("." + h) for h in ESPN_HOSTS) else UA

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
# Bounded retry policy (2026-09-03, patience restored the same day).
#
# ATTEMPTS is the TOTAL number of tries, not the number of extras, and the backoff ESCALATES: a first
# retry after 1.5s, a second after 3.0s. Prompt 19 briefly cut this to 2 attempts at a flat 2s, which
# was specified without knowing the helper already did 3 with escalation - so following it made the
# helper LESS resilient than it was. Restored. Escalation matters more than the attempt count: a host
# that just reset you is more likely to answer after 3s than after another 1.5s, and two evenly spaced
# knocks are the worst of both worlds.
#
# WHAT IS RETRIED: connection-level failures and 5xx. A reset or a 502 is the network or the origin
# having a moment, and a later try usually lands.
#
# WHAT IS NEVER RETRIED: ANY 4xx. A 403 is Akamai's *answer*, not a blip - re-asking makes the bot
# score worse, which is the opposite of helping. Run 33673744218 died on `HTTP Error 403: Forbidden`
# from site.api.espn.com, and a retry loop would have turned one refusal into several.
#
# 429 IS ALSO NOT RETRIED, BUT IT GETS ITS OWN LINE. It is the one 4xx where the server is explicitly
# asking for less traffic, so silently lumping it in with 403 would hide the single signal that should
# change our behaviour. THE ANSWER TO A 429 IS TO SLOW THE OVERLAY DOWN - raise the livescores
# revalidate window - NEVER to retry harder. None has ever been observed; the line exists so the first
# one is impossible to miss.
#
# WHY ConnectionResetError AND TimeoutError ARE CAUGHT SEPARATELY: urllib wraps failures raised while
# CONNECTING in URLError, but a reset arriving mid-body - after the headers, during resp.read() -
# propagates as a bare ConnectionResetError, and a read timeout as a bare TimeoutError. Neither is a
# URLError, so an `except URLError` alone never sees them. That is exactly the failure shape observed
# against api-web.nhle.com on 2026-09-03 (`WinError 10054`, `read ECONNRESET`).
ATTEMPTS = 3
BACKOFF_SECONDS = (1.5, 3.0)      # before attempt 2, before attempt 3
RETRY_STATUS = (500, 502, 503, 504)
RATE_LIMIT_STATUS = 429


def _host(url: str) -> str:
    return urllib.parse.urlsplit(url).hostname or url


def _backoff(attempt: int) -> float:
    """Seconds to wait after `attempt` (1-based). Escalates, then holds at the last value."""
    return BACKOFF_SECONDS[min(attempt, len(BACKOFF_SECONDS)) - 1]


def http_json(url: str, headers: dict[str, str] | None = None, params: dict[str, Any] | None = None,
              timeout: int = 45, attempts: int = ATTEMPTS, sleep=time.sleep) -> Any:
    """GET JSON with a bounded, escalating retry. `sleep` is injectable so tests do not actually wait."""
    if params:
        q = urllib.parse.urlencode({k: v for k, v in params.items() if v is not None}, doseq=True)
        url = f"{url}?{q}"
    hdrs = {"Accept": "application/json", "User-Agent": ua_for(url)}
    hdrs.update(headers or {})
    bare = url.split("?")[0]
    last: Exception | None = None
    for attempt in range(1, max(1, attempts) + 1):
        req = urllib.request.Request(url, headers=hdrs, method="GET")
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:      # MUST stay above URLError - HTTPError subclasses it
            body = e.read().decode("utf-8", errors="replace")[:500]
            last = RuntimeError(f"HTTP {e.code} for {bare}: {body}")
            if e.code == RATE_LIMIT_STATUS:
                print(f"  warn: {_host(url)} HTTP 429 RATE LIMITED - not retried on purpose; "
                      f"slow the caller down (livescores revalidate), do not retry harder")
                raise last from e
            if e.code in RETRY_STATUS and attempt < attempts:
                wait = _backoff(attempt)
                print(f"  warn: {_host(url)} HTTP {e.code}, retry {attempt + 1} of {attempts} "
                      f"in {wait:.1f}s")
                sleep(wait)
                continue
            raise last from e
        except (urllib.error.URLError, ConnectionResetError, TimeoutError) as e:
            reason = getattr(e, "reason", e)
            last = RuntimeError(f"request failed for {bare}: {e}")
            if attempt < attempts:
                wait = _backoff(attempt)
                print(f"  warn: {_host(url)} {type(e).__name__} ({reason}), retry {attempt + 1} "
                      f"of {attempts} in {wait:.1f}s")
                sleep(wait)
                continue
            raise last from e
    raise last  # pragma: no cover


def download(url: str, dest: Path, headers: dict[str, str] | None = None, skip_existing: bool = True) -> str:
    """Fetch a binary asset to `dest`. Returns 'cached' | 'ok' | 'error: ...'. Never re-scrapes (spec §3.9)."""
    if skip_existing and dest.exists() and dest.stat().st_size > 0:
        return "cached"
    dest.parent.mkdir(parents=True, exist_ok=True)
    hdrs = {"User-Agent": ua_for(url)}
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


# The schema's `access_status` enum, keyed by what outlet_access() returns. pipeline/load.py has
# carried this map privately since Milestone 2; it is lifted here so the PROGRAM loader can use the
# same one rather than a second copy that drifts.
ACCESS_STATUS_OF = {
    "AVAILABLE": "available",
    "UNAVAILABLE": "unavailable",
    "UNKNOWN": "unknown",
    "CONDITIONAL/VERIFY": "conditional",
    "OUT_OF_MARKET": "out_of_market",
    "UNVERIFIED": "unverified",
}


def canonical_outlet(outlet: str, available: set[str], unavailable: set[str]) -> str:
    """`normalize_outlet()`, then ONE case-insensitive pass against the alias table and the profile.

    EXACT MATCH WITHIN A KNOWN SET, never substring and never fuzzy (working rule 18) - the only
    thing relaxed is letter case. cf.nascar.com writes `"PRIME VIDEO"`, the alias table keys on
    `"Prime"`/`"Amazon"` and the profile on `"Prime Video"`, so five 2026 Cup races resolved to
    `unknown` under exact matching alone. Case is a spelling difference, not a different network.
    """
    o = normalize_outlet(outlet)
    if o in available or o in unavailable:
        return o
    folded = o.casefold()
    for alias, canon in OUTLET_ALIASES.items():
        if alias.casefold() == folded:
            return canon
    for known in (*available, *unavailable):
        if known.casefold() == folded:
            return known
    return o


def access_status_for(outlet: str, available: set[str], unavailable: set[str]) -> str:
    """`game_broadcasts.access_status` for one outlet label, decided by the viewer's access profile.

    THE PROFILE DECIDES, NEVER THE ADAPTER. `adapters/nascar.py` wrote `access_status: "available"`
    for every broadcaster the feed named, which put two 2026 races - the Clash at Bowman Gray and the
    Black's Tire 250 - on the grid as watchable when they are on **FS2**, which
    `data/access_profile.json` lists under `unavailable`. Telling Joe he can watch something he
    cannot is the same class of error as inventing a network, and it is worse than saying "unknown".

    An outlet the profile does not mention resolves to `unknown`, which is neither eligible nor
    off-service - the honest answer for a service nobody has ruled on.
    """
    return ACCESS_STATUS_OF.get(
        outlet_access(canonical_outlet(outlet, available, unavailable), available, unavailable),
        "unknown")


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
