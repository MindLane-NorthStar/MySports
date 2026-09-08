#!/usr/bin/env python3
"""MySports Phase 3B — team metadata + logo asset fetch (spec §3.9 asset caching).

Run from the repo root. Reads CFBD_API_KEY from .env (never printed/written).
1. GET /teams?year=2026 (one API call) -> artifacts/validation/cfbd_2026_teams.json
   (sanitized: id, school, abbreviation, conference, classification, color,
   alternateColor, logos).
2. Downloads a logo for EVERY team in that response -> assets/logos/{teamId}.png (primary) and
   {teamId}_dark.png where the provider offers its own dark art.
   Skips files that already exist (idempotent; no re-scraping per §3.9).

THE TWO-WEEK SAMPLE IS GONE, AND IT WAS THE CAUSE OF A VISIBLE DEFECT. This read "downloads logos
ONLY for teams appearing in the Week 1 and Week 8 fixtures", which is a sample of the season and not
of the LEAGUE: an FBS team plays one FCS opponent a year, at a date of its own choosing, so a
two-week window catches a handful of them and misses the rest. 186 of the 684 teams in the response
had art; East Tennessee State (2193), Howard (47) and Wofford (2747) all sat in the teams file with
working cdn.collegefootballdata.com URLs and no asset, and rendered as broken images the day they
appeared on a card. A sample cannot answer "which teams can appear", because the schedule decides
that later.

THE SKIP-IF-EXISTS IDEMPOTENCE IS UNCHANGED and is what makes the wider net cheap: a second run
downloads nothing. The only thing that grew is the SET considered, not the work per file.

WHAT IT DOES NOT DO IS PICK A SIZE. `logos[0]` and `logos[1]` are the 500px light and dark variants
the provider lists first; the smaller CDN sizes are ignored, exactly as before.

AND `logos[1]` IS NOT ALWAYS DARK ART. ESPN serves that URL for every team whether or not a distinct
dark lockup exists, returning the base bytes where none does - measured 2026-09-07, 449 of 766 files
written here came back byte-identical to their base. Conditioning is
`scripts/build_web_marks.py --team-logos`, which since prompt 61 treats byte-identity with the base
as the ABSENCE of provider art and conditions those, keeping only genuinely distinct art - EXCEPT
for the teams `data/logo_conditioning.json` rules `skip_derive`, where Joe judged the raw art the
better charcoal art and the identity is deliberate. Run it after this; the workflow's push step does
it with --make-dark.
"""
import argparse, json, os, re, sys, time, urllib.request, urllib.error
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

# WHY THERE IS A RETRY AT ALL, since the first version of the wider fetch did not have one and
# needed it: asking the CDN for ~900 files back to back gets a share of them reset. The first full
# run downloaded 451 and lost 461 to `URLError [WinError 10054] An existing connection was forcibly
# closed by the remote host` - and the same URLs answered 200 immediately afterwards, one at a time.
# That is throttling, not absence, and without a retry the script's own output invites the reader to
# "just run it again" several times to converge.
#
# A 404 IS NEVER RETRIED. It is the provider saying the art is not there, which three more requests
# cannot change; retrying it would turn the one genuine sourcing signal into noise and spend the
# backoff on the files least likely to arrive.
ATTEMPTS = 3
BACKOFF = (0.5, 2.0, 5.0)


def get(url: str, timeout: int = 30) -> bytes:
    """Fetch one URL, retrying transient failures. Raises the LAST exception if all attempts fail."""
    last: Exception | None = None
    for i in range(ATTEMPTS):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 mysports-assets/0.1"})
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return resp.read()
        except urllib.error.HTTPError as e:
            raise            # 404 and every other status: definitive, and reported as such
        except Exception as e:  # noqa: BLE001 - reset, timeout, DNS: all worth one more try
            last = e
            if i < ATTEMPTS - 1:
                time.sleep(BACKOFF[i])
    raise last if last else RuntimeError("unreachable")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    # EVERY TEAM BY DEFAULT. The filter exists because the response is not only Division I: of the
    # 684 teams in 2026, 138 are FBS and 128 FCS - the two that can appear on an FBS schedule - and
    # 171 are Division II and 247 Division III, which is 61% of the download for teams a CFBD FBS
    # schedule will not normally name. Fetching them is cheap and idempotent and rules out a future
    # exhibition rendering broken, so it is the default; the flag is here so narrowing is one
    # argument rather than an edit.
    ap.add_argument("--classification", nargs="+", metavar="C",
                    help="only fetch these classifications (e.g. fbs fcs). Default: every team.")
    args = ap.parse_args(argv)

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

    # EVERY TEAM IN THE RESPONSE. This used to be the union of the Week 1 and Week 8 fixtures - see
    # the module docstring for why a two-week sample is the wrong question to ask.
    wanted = {c.lower() for c in args.classification} if args.classification else None
    needed = {t["id"] for t in sanitized
              if t["id"] is not None
              and (wanted is None or str(t.get("classification") or "").lower() in wanted)}
    if wanted:
        print(f"classification filter: {' '.join(sorted(wanted))}")
    print(f"teams considered: {len(needed)} of {len(sanitized)}")

    by_id = {t["id"]: t for t in sanitized}
    logo_dir = root / "assets" / "logos"
    logo_dir.mkdir(parents=True, exist_ok=True)
    ok = missing_meta = no_logo = fail = skipped = 0
    added_bytes = 0
    gone: list[str] = []          # a 404 is a real sourcing gap: the URL is listed and is not there
    errored: list[str] = []       # anything else is this run's problem, not the provider's
    for tid in sorted(needed, key=lambda x: str(x)):
        t = by_id.get(tid)
        if t is None: missing_meta += 1; continue
        logos = t["logos"]
        if not logos: no_logo += 1; print(f"  no logo URL: {t['school']} ({tid})"); continue
        targets = [(logos[0], logo_dir / f"{tid}.png")]
        if len(logos) > 1: targets.append((logos[1], logo_dir / f"{tid}_dark.png"))
        for url, dest in targets:
            if dest.exists(): skipped += 1; continue
            try:
                body = get(url)
                dest.write_bytes(body)
                ok += 1; added_bytes += len(body); time.sleep(0.15)
            # A 404 IS REPORTED SEPARATELY FROM EVERY OTHER FAILURE, because the two mean opposite
            # things. A 404 says the provider lists a URL it does not serve - the only genuine
            # sourcing gap, and nothing a re-run can fix. A timeout or a reset says this machine's
            # network wobbled, and the next run picks it up for free because the file is still
            # absent. Collapsing them into one `fail` count is how a transient looks permanent.
            except urllib.error.HTTPError as e:
                fail += 1
                (gone if e.code == 404 else errored).append(f"{t['school']} ({tid}) {dest.name} HTTP {e.code}")
            except Exception as e:  # noqa: BLE001 - one bad logo must not stop the run
                fail += 1
                # THE REASON, NOT JUST THE CLASS. Every failure in the first full run printed as a
                # bare `URLError`, which named the exception and not the fault; the reason said
                # `[WinError 10054] An existing connection was forcibly closed by the remote host`
                # and that is what identified it as throttling rather than a dead URL.
                why = getattr(e, "reason", None) or e
                errored.append(f"{t['school']} ({tid}) {dest.name} {type(e).__name__}: {why}")
    print(f"logos downloaded: {ok} ({added_bytes:,} bytes), already present: {skipped}, "
          f"failed: {fail}, no-url: {no_logo}, not-in-teams-response: {missing_meta}")
    if gone:
        print(f"\n404 - listed by the provider and not served ({len(gone)}). These are the only "
              f"genuine sourcing gaps; a re-run will not fix them:")
        for g in gone: print(f"  {g}")
    if errored:
        print(f"\ntransient or other failures ({len(errored)}) - re-run to retry, the files are "
              f"still absent so nothing is re-scraped:")
        for g in errored: print(f"  {g}")
    if no_logo:
        print(f"\n{no_logo} teams list no logo URL at all - the provider has no art for them, "
              f"which is a different gap from a 404 and equally unfixable here.")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
