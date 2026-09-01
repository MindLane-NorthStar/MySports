#!/usr/bin/env python3
"""MySports Phase 3B — network & streamer logo fetch, v3.
v3 adds horizontal SVG wordmarks for the tray chips (VECTOR_MARKS); `--force-svg` re-downloads them.
Sources, in order: (1) known-good Commons file titles, (2) the network's English
Wikipedia article image list (non-free logos live on en.wikipedia, not Commons).
HTTP 429 is retried with backoff (honoring Retry-After) and reported as THROTTLED,
never conflated with MISSING. Idempotent: existing files are skipped.
Run from repo root: python scripts/fetch_network_logos.py"""
import json, re, sys, time, urllib.parse, urllib.request, urllib.error
from pathlib import Path

UA = {"User-Agent": "mysports-network-logos/0.2 (personal project; low volume)"}
COMMONS = "https://commons.wikimedia.org/w/api.php"
ENWIKI = "https://en.wikipedia.org/w/api.php"

# slug -> (commons candidate file titles, en.wikipedia article for image-list fallback)
NETWORKS = {
    "abc": (["American Broadcasting Company Logo.svg"], "American Broadcasting Company"),
    "cbs": (["CBS logo.svg"], "CBS"),
    "fox": (["Fox Broadcasting Company logo (2019).svg"], "Fox Broadcasting Company"),
    "nbc": (["NBC logo.svg"], "NBC"),
    "the-cw": (["The CW logo 2024.svg", "The CW.svg"], "The CW"),
    "espn": (["ESPN wordmark.svg"], "ESPN"),
    "espn2": (["ESPN2 logo.svg"], "ESPN2"),
    "espnu": ([], "ESPNU"),
    "fs1": (["Fox Sports 1 logo.svg", "FS1 logo.svg"], "FS1 (TV channel)"),
    "tnt": (["TNT Logo 2016.svg"], "TNT (American TV network)"),
    "usa-network": (["USA Network logo (2016).svg"], "USA Network"),
    "big-ten-network": ([], "Big Ten Network"),
    "acc-network": ([], "ACC Network"),
    "sec-network": (["SEC Network logo.svg"], "SEC Network"),
    "sec-network-plus": (["SEC Network logo.svg"], "SEC Network"),
    "espn-plus": ([], "ESPN+"),
    "espn-unlimited": ([], "ESPN (streaming service)"),
    "peacock": (["NBCUniversal Peacock Logo.svg", "Peacock logo.svg"], "Peacock (streaming service)"),
    "hbo-max": (["HBO Max Logo.svg", "Max logo.svg"], "HBO Max"),
    "paramount-plus": (["Paramount Plus.svg", "Paramount+ logo.svg"], "Paramount+"),
    "disney-plus": (["Disney+ logo.svg", "Disney Plus logo.svg"], "Disney+"),
}

# v3 (2026-08-31): horizontal VECTOR wordmarks for the tray's streamer chips. Direct Commons file URLs
# (from the imageinfo API); saved as assets/network-logos/{slug}.svg and nested inline by render_day.py.
# Chosen for aspect ratio (all ≥ 4:1 except Disney+, which has no horizontal form): see contract §3.
VECTOR_MARKS = {
    "hbo-max":        "https://upload.wikimedia.org/wikipedia/commons/7/7e/HBO_Max_May_2025_%28Horizontal%29.svg",
    "paramount-plus": "https://upload.wikimedia.org/wikipedia/commons/4/4e/Paramount%2B_logo.svg",
    "peacock":        "https://upload.wikimedia.org/wikipedia/commons/2/20/NBCUniversal_Peacock_Logo_%282026%29.svg",
    "disney-plus":    "https://upload.wikimedia.org/wikipedia/commons/6/64/Disney%2B_2024.svg",
    "espn-plus":      "https://upload.wikimedia.org/wikipedia/commons/8/80/ESPN_Plus.svg",
}

class Throttled(Exception): pass

def api_json(base, params, tries=4):
    q = urllib.parse.urlencode({**params, "format": "json"})
    for attempt in range(tries):
        req = urllib.request.Request(f"{base}?{q}", headers=UA)
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read().decode())
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < tries-1:
                wait = e.headers.get("Retry-After")
                wait = int(wait) if wait and wait.isdigit() else 15*(attempt+1)
                print(f"    429 — backing off {wait}s"); time.sleep(min(wait, 60)); continue
            if e.code == 429: raise Throttled()
            raise
    raise Throttled()

def thumb_from_title(base, title):
    data = api_json(base, {"action":"query","titles":f"File:{title}",
                           "prop":"imageinfo","iiprop":"url","iiurlwidth":300})
    for page in data.get("query",{}).get("pages",{}).values():
        if "missing" in page and not page.get("imageinfo"): return None
        for ii in page.get("imageinfo",[]) or []:
            return ii.get("thumburl") or ii.get("url")
    return None

def article_logo_title(article):
    data = api_json(ENWIKI, {"action":"query","titles":article,"prop":"images","imlimit":"50"})
    cands = []
    for page in data.get("query",{}).get("pages",{}).values():
        for im in page.get("images",[]) or []:
            t = im.get("title","")
            if not t.lower().endswith((".svg",".png")): continue
            if re.search(r"(commons|edit|question|padlock|symbol|icon(?!ic))", t, re.I): continue
            score = ("logo" in t.lower())*2 + (article.split(" (")[0].lower().replace("+"," ") .split()[0] in t.lower())
            cands.append((score, t))
    cands.sort(reverse=True)
    return cands[0][1].removeprefix("File:") if cands and cands[0][0] > 0 else None

def download(url, dest):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        body = r.read()
    if body[:8] == b"\x89PNG\r\n\x1a\n" and len(body) > 500:
        dest.write_bytes(body); return True
    return False

def fetch_vectors(out, force=False):
    """Download the SVG wordmarks. Idempotent unless force. Validates that the body is an SVG document."""
    got, bad = [], []
    for slug, url in VECTOR_MARKS.items():
        dest = out / f"{slug}.svg"
        if dest.exists() and not force: got.append(slug); continue
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=30) as r: body = r.read()
            if b"<svg" in body[:2000]:
                dest.write_bytes(body); got.append(slug); print(f"  {slug}.svg: {len(body)} bytes")
            else:
                bad.append(slug); print(f"  {slug}.svg: not an SVG document")
        except Exception as e:
            bad.append(slug); print(f"  {slug}.svg: FAILED {e}")
        time.sleep(1.0)
    return got, bad

def main():
    out = Path("assets/network-logos"); out.mkdir(parents=True, exist_ok=True)
    force = "--force-svg" in sys.argv
    print("vector wordmarks (SVG):")
    vgot, vbad = fetch_vectors(out, force=force)
    print(f"  svg present: {len(vgot)}/{len(VECTOR_MARKS)}" + (f", failed: {vbad}" if vbad else ""))
    print("raster marks (PNG):")
    ok, missing, throttled = [], [], []
    for slug, (titles, article) in NETWORKS.items():
        dest = out / f"{slug}.png"
        if dest.exists(): ok.append(slug); continue
        try:
            url = None
            for t in titles:
                url = thumb_from_title(COMMONS, t)
                if url: print(f"  {slug}: commons File:{t}"); break
                time.sleep(1.0)
            if not url and article:
                t = article_logo_title(article)
                time.sleep(1.0)
                if t:
                    url = thumb_from_title(ENWIKI, t) or thumb_from_title(COMMONS, t)
                    if url: print(f"  {slug}: enwiki File:{t}")
            if url and download(url, dest): ok.append(slug)
            else: missing.append(slug); print(f"  {slug}: MISSING (all sources exhausted)")
        except Throttled:
            throttled.append(slug); print(f"  {slug}: THROTTLED (retry later; not missing)")
        time.sleep(1.0)
    print(f"\npresent: {len(ok)}/{len(NETWORKS)}")
    print(f"missing (need new source): {missing if missing else 'none'}")
    print(f"throttled (re-run later): {throttled if throttled else 'none'}")
    return 0 if not missing and not throttled and not vbad else 1

if __name__ == "__main__":
    sys.exit(main())
