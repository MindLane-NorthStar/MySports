#!/usr/bin/env python3
"""MySports Phase 3B — team metadata + logo asset fetch (spec §3.9 asset caching).

Run from the repo root. Reads CFBD_API_KEY from .env (never printed/written).
1. GET /teams?year=2026 (one API call) -> artifacts/validation/cfbd_2026_teams.json
   (sanitized: id, school, abbreviation, conference, classification, color,
   alternateColor, logos).
2. Downloads logos ONLY for teams appearing in the Week 1 and Week 8 fixtures
   -> assets/logos/{teamId}.png (primary) and {teamId}_dark.png when offered.
   Skips files that already exist (idempotent; no re-scraping per §3.9).
"""
import json, os, re, sys, time, urllib.request, urllib.error
from pathlib import Path

API_BASE = "https://api.collegefootballdata.com"

def find_repo_root(start: Path) -> Path:
    for p in [start.resolve(), *start.resolve().parents]:
        if (p / ".env").exists() or (p / ".git").exists():
            return p
    return start.resolve()

def load_dotenv(path: Path) -> None:
    if not path.exists(): return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line: continue
        if line.startswith("export "): line = line[7:].strip()
        k, v = line.split("=", 1)
        k, v = k.strip(), v.strip()
        if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", k): continue
        if len(v) >= 2 and v[0] == v[-1] and v[0] in ("'", '"'): v = v[1:-1]
        os.environ.setdefault(k, v)

def main() -> int:
    root = find_repo_root(Path.cwd())
    load_dotenv(root / ".env")
    token = os.getenv("CFBD_API_KEY")
    if not token:
        print("ERROR: CFBD_API_KEY not found in environment or .env", file=sys.stderr)
        return 2
    print("CFBD_API_KEY: loaded (value hidden)")

    req = urllib.request.Request(
        f"{API_BASE}/teams?year=2026",
        headers={"Authorization": f"Bearer {token}", "Accept": "application/json",
                 "User-Agent": "mysports-phase3b-assets/0.1"})
    with urllib.request.urlopen(req, timeout=60) as r:
        teams = json.loads(r.read().decode("utf-8"))
    print(f"/teams?year=2026: {len(teams)} teams")

    sanitized = [{
        "id": t.get("id"), "school": t.get("school"), "abbreviation": t.get("abbreviation"),
        "conference": t.get("conference"), "classification": t.get("classification"),
        "color": t.get("color"), "alternateColor": t.get("alternateColor"),
        "logos": t.get("logos") or [],
    } for t in teams]
    out = root / "artifacts" / "validation" / "cfbd_2026_teams.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(sanitized, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"wrote {out}")

    needed = set()
    for fx in ["cfbd_2026_week1_fixture.json", "cfbd_2026_week8_fixture.json"]:
        p = root / "artifacts" / "validation" / fx
        if not p.exists():
            print(f"WARNING: {fx} missing; skipping"); continue
        for g in json.load(open(p, encoding="utf-8"))["games"]:
            for side in ("home", "away"):
                if g[side].get("id") is not None: needed.add(g[side]["id"])
    print(f"teams needing logos: {len(needed)}")

    by_id = {t["id"]: t for t in sanitized}
    logo_dir = root / "assets" / "logos"
    logo_dir.mkdir(parents=True, exist_ok=True)
    ok = missing_meta = no_logo = fail = skipped = 0
    for tid in sorted(needed):
        t = by_id.get(tid)
        if t is None: missing_meta += 1; continue
        logos = t["logos"]
        if not logos: no_logo += 1; print(f"  no logo URL: {t['school']} ({tid})"); continue
        targets = [(logos[0], logo_dir / f"{tid}.png")]
        if len(logos) > 1: targets.append((logos[1], logo_dir / f"{tid}_dark.png"))
        for url, dest in targets:
            if dest.exists(): skipped += 1; continue
            try:
                r2 = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 mysports-assets/0.1"})
                with urllib.request.urlopen(r2, timeout=30) as resp:
                    dest.write_bytes(resp.read())
                ok += 1; time.sleep(0.15)
            except Exception as e:
                fail += 1; print(f"  FAILED {t['school']} ({tid}): {type(e).__name__}")
    print(f"logos downloaded: {ok}, already present: {skipped}, failed: {fail}, "
          f"no-url: {no_logo}, not-in-teams-response: {missing_meta}")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
