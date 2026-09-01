#!/usr/bin/env python3
"""
MySports — Phase 3B enrichment probe (replaces every MOCK in the renderer).

Pulls the four CFBD endpoints the day grid's tray needs and writes ONE sanitized
enrichment file per week that scripts/render_day.py consumes:

    /rankings        -> ranking badges (AP Top 25 until a CFP poll exists for the week, then CFP)
    /lines           -> point spread + over/under (spec §21 amended 2026-08-31: in v1 scope)
    /records         -> season records to date
    /games/weather   -> kickoff-hour weather (may be Patreon-tier gated; recorded, never fatal)

Run from the repository root (the API key comes from .env, exactly like validate_cfbd_week1.py):

    python scripts/probe_enrichment.py --week 1
    python scripts/probe_enrichment.py --week 8

Output:
    artifacts/validation/cfbd_2026_week{N}_enrichment.json
    artifacts/validation/cfbd_2026_week{N}_enrichment_report.md

The API key is never written to any output file. Every endpoint failure is recorded in the
report under "Endpoint status" and the probe still writes whatever it did get — the renderer
treats every enrichment block as optional.

Unit assumption (flagged for the first live run): CFBD documents /games/weather values as
imperial (°F, mph). If September temperatures come back in the 15–35 range they are Celsius;
flip WEATHER_IS_IMPERIAL below and re-run.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

API_BASE = "https://api.collegefootballdata.com"
ET = ZoneInfo("America/New_York")
WEATHER_IS_IMPERIAL = True
# Spec §3.7: AP until an official CFP ranking exists for that football week, then CFP.
CFP_POLL = "Playoff Committee Rankings"
AP_POLL = "AP Top 25"
# Sportsbook preference for the single line shown in the tray. First match wins.
LINE_PROVIDERS = ["DraftKings", "ESPN Bet", "Bovada", "consensus", "numberfire", "teamrankings"]


# ----------------------------------------------------------------------------- env / http
def find_repo_root(start: Path) -> Path:
    for p in [start, *start.parents]:
        if (p / ".env").exists() or (p / ".git").exists():
            return p
    return start


def load_dotenv(path: Path) -> None:
    if not path.exists():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def api_get(path: str, token: str, params: dict[str, Any]) -> tuple[int, Any]:
    """Returns (http_status, parsed_json_or_error_text). Never raises."""
    url = f"{API_BASE}{path}?{urllib.parse.urlencode({k: v for k, v in params.items() if v is not None})}"
    req = urllib.request.Request(
        url,
        headers={"Authorization": f"Bearer {token}", "Accept": "application/json",
                 "User-Agent": "mysports-phase3b-enrichment/0.1"},
        method="GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=45) as r:
            return r.status, json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", errors="replace")[:300]
    except Exception as e:  # network, timeout, JSON
        return 0, f"{type(e).__name__}: {e}"


# ----------------------------------------------------------------------------- shaping
def pick_line(lines: list[dict]) -> dict | None:
    for prov in LINE_PROVIDERS:
        for ln in lines:
            if (ln.get("provider") or "").lower() == prov.lower() and (ln.get("spread") is not None or ln.get("overUnder") is not None):
                return ln
    return next((ln for ln in lines if ln.get("spread") is not None or ln.get("overUnder") is not None), None)


def weather_display(w: dict) -> str | None:
    parts = []
    if w.get("gameIndoors"):
        parts.append("Indoors")
    t = w.get("temperature")
    if t is not None:
        parts.append(f"{round(t)}°F" if WEATHER_IS_IMPERIAL else f"{round(t)}°C")
    cond = (w.get("weatherCondition") or "").strip()
    if cond and not w.get("gameIndoors"):
        parts.append(cond)
    ws = w.get("windSpeed")
    if ws is not None and not w.get("gameIndoors") and ws >= 5:
        parts.append(f"Wind {round(ws)} mph" if WEATHER_IS_IMPERIAL else f"Wind {round(ws)} km/h")
    p = w.get("precipitation")
    if p and p > 0 and not w.get("gameIndoors"):
        parts.append("Precip")
    return " · ".join(parts) or None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--year", type=int, default=2026)
    ap.add_argument("--week", type=int, default=1)
    ap.add_argument("--season-type", default="regular")
    ap.add_argument("--out-dir", default="artifacts/validation")
    args = ap.parse_args()

    root = find_repo_root(Path.cwd())
    load_dotenv(root / ".env")
    token = os.environ.get("CFBD_API_KEY")
    if not token:
        print("CFBD_API_KEY not found in environment or .env", file=sys.stderr)
        return 2

    out_dir = root / args.out_dir
    out_dir.mkdir(parents=True, exist_ok=True)
    tag = f"cfbd_{args.year}_week{args.week}"
    status: dict[str, dict] = {}
    now = datetime.now(ET)

    # Team abbreviations for the records line ("ECU 1-0 · ALA 1-0").
    teams_path = out_dir / f"cfbd_{args.year}_teams.json"
    abbr: dict[int, str] = {}
    if teams_path.exists():
        for t in json.loads(teams_path.read_text(encoding="utf-8")):
            if t.get("id") and t.get("abbreviation"):
                abbr[int(t["id"])] = t["abbreviation"]

    # ---- rankings
    code, data = api_get("/rankings", token, {"year": args.year, "week": args.week, "seasonType": args.season_type})
    ranking = {"source": None, "pollWeek": None, "isFinal": None, "byTeamId": {}, "bySchool": {}}
    status["/rankings"] = {"http": code, "rows": len(data) if isinstance(data, list) else 0,
                           "note": None if isinstance(data, list) else str(data)}
    if isinstance(data, list) and data:
        pw = data[0]
        polls = {p.get("poll"): p for p in pw.get("polls", [])}
        chosen = polls.get(CFP_POLL) or polls.get(AP_POLL)
        if chosen:
            ranking["source"] = chosen.get("poll")
            ranking["pollWeek"] = pw.get("week")
            ranking["isFinal"] = chosen.get("isFinal")
            for r in chosen.get("ranks", []):
                if r.get("rank") is None:
                    continue
                if r.get("teamId") is not None:
                    ranking["byTeamId"][str(r["teamId"])] = r["rank"]
                if r.get("school"):
                    ranking["bySchool"][r["school"]] = r["rank"]
        status["/rankings"]["pollsPresent"] = sorted(polls)

    # ---- lines
    code, data = api_get("/lines", token, {"year": args.year, "week": args.week, "seasonType": args.season_type})
    lines: dict[str, dict] = {}
    providers_seen: dict[str, int] = {}
    status["/lines"] = {"http": code, "rows": len(data) if isinstance(data, list) else 0,
                        "note": None if isinstance(data, list) else str(data)}
    if isinstance(data, list):
        for g in data:
            for ln in g.get("lines", []) or []:
                providers_seen[ln.get("provider") or "?"] = providers_seen.get(ln.get("provider") or "?", 0) + 1
            ln = pick_line(g.get("lines", []) or [])
            if not ln:
                continue
            ou = ln.get("overUnder")
            fs = ln.get("formattedSpread") or ""
            disp = " · ".join(x for x in [fs.strip() or None, f"O/U {ou:g}" if ou is not None else None] if x)
            lines[str(g["id"])] = {
                "provider": ln.get("provider"), "spread": ln.get("spread"), "formattedSpread": fs,
                "overUnder": ou, "homeMoneyline": ln.get("homeMoneyline"), "awayMoneyline": ln.get("awayMoneyline"),
                "display": disp or None,
            }
        status["/lines"]["providers"] = providers_seen
        status["/lines"]["gamesWithLine"] = len(lines)

    # ---- records (season to date; the renderer suppresses 0-0 · 0-0 for openers)
    code, data = api_get("/records", token, {"year": args.year})
    records: dict[str, dict] = {}
    status["/records"] = {"http": code, "rows": len(data) if isinstance(data, list) else 0,
                          "note": None if isinstance(data, list) else str(data)}
    if isinstance(data, list):
        for t in data:
            tot = t.get("total") or {}
            w, l, ti = tot.get("wins", 0) or 0, tot.get("losses", 0) or 0, tot.get("ties", 0) or 0
            disp = f"{w}-{l}" + (f"-{ti}" if ti else "")
            tid = t.get("teamId")
            rec = {"team": t.get("team"), "wins": w, "losses": l, "ties": ti, "display": disp,
                   "abbr": abbr.get(int(tid)) if tid is not None else None}
            if tid is not None:
                records[str(tid)] = rec
            elif t.get("team"):
                records[t["team"]] = rec

    # ---- weather (tier-gated on some CFBD plans; a 401/403 is recorded, not fatal)
    code, data = api_get("/games/weather", token, {"year": args.year, "week": args.week, "seasonType": args.season_type})
    weather: dict[str, dict] = {}
    status["/games/weather"] = {"http": code, "rows": len(data) if isinstance(data, list) else 0,
                                "note": None if isinstance(data, list) else str(data)}
    if isinstance(data, list):
        temps = [w.get("temperature") for w in data if w.get("temperature") is not None]
        if temps:
            status["/games/weather"]["temperatureRange"] = [min(temps), max(temps)]
        for w in data:
            weather[str(w["id"])] = {
                "gameIndoors": w.get("gameIndoors"), "temperature": w.get("temperature"),
                "windSpeed": w.get("windSpeed"), "precipitation": w.get("precipitation"),
                "weatherCondition": w.get("weatherCondition"), "display": weather_display(w),
            }

    enrichment = {
        "generatedAt": now.isoformat(), "season": args.year, "week": args.week, "seasonType": args.season_type,
        "apiKeyIncluded": False, "weatherUnits": "imperial" if WEATHER_IS_IMPERIAL else "metric",
        "ranking": ranking, "lines": lines, "records": records, "weather": weather, "endpoints": status,
    }
    out = out_dir / f"{tag}_enrichment.json"
    out.write_text(json.dumps(enrichment, indent=2, ensure_ascii=False), encoding="utf-8")

    rep = [f"# CFBD Enrichment Probe — {args.year} Week {args.week}", "",
           f"Generated: {now.strftime('%Y-%m-%d %I:%M %p ET')}", "", "## Endpoint status", "",
           "| Endpoint | HTTP | Rows | Note |", "| --- | --- | --- | --- |"]
    for ep, s in status.items():
        rep.append(f"| `{ep}` | {s['http']} | {s['rows']} | {s.get('note') or ''} |")
    rep += ["", "## Ranking", "",
            f"- Source used: **{ranking['source'] or 'none'}** (poll week {ranking['pollWeek']}, isFinal={ranking['isFinal']})",
            f"- Polls present in response: {', '.join(status['/rankings'].get('pollsPresent', [])) or 'n/a'}",
            f"- Ranked teams captured: {len(ranking['byTeamId'])} by teamId, {len(ranking['bySchool'])} by school",
            "", "## Lines", "",
            f"- Games with a usable line: {len(lines)}",
            f"- Providers seen: {json.dumps(status['/lines'].get('providers', {}))}",
            f"- Provider preference order: {', '.join(LINE_PROVIDERS)}",
            "", "## Records", "", f"- Teams with records: {len(records)}",
            "", "## Weather", "", f"- Games with weather rows: {len(weather)}",
            f"- Temperature range observed: {status['/games/weather'].get('temperatureRange', 'n/a')} "
            f"(units assumed {'°F' if WEATHER_IS_IMPERIAL else '°C'} — if a September range reads 15–35, flip WEATHER_IS_IMPERIAL)",
            "", "> API key was not written to any output file.", ""]
    (out_dir / f"{tag}_enrichment_report.md").write_text("\n".join(rep), encoding="utf-8")
    print(f"wrote {out} and {tag}_enrichment_report.md")
    for ep, s in status.items():
        print(f"  {ep:16s} HTTP {s['http']:>3}  rows {s['rows']}" + (f"  ({s['note']})" if s.get("note") else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main())
