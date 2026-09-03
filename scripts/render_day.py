#!/usr/bin/env python3
"""MySports — day grid renderer, design v1.6 (Phase 4: multi-sport plumbing + Around the League strip on the v1.4 contract).

Renders one calendar day of college football as SVG (canonical) and optionally PNG,
from the CFBD validation fixture + enrichment probe + cached assets. Run from the repo root:

    python scripts/render_day.py --week 1 --date 2026-09-05 --png
    python scripts/render_day.py --week 8 --date 2026-10-24 --png      # TBD-state fixture
    python scripts/render_day.py --week 1 --date 2026-09-05 --export   # 2x PNG for download
    python scripts/render_day.py --sport nhl --date 2026-10-01           # v1.5: pro-league fixture from adapters/nhl.py
    python scripts/render_day.py --sport nfl --date 2026-09-13           # v1.5: adapters/espn.py, Cleveland market filter

Inputs (defaults derive from --week; override individually if needed):
  artifacts/validation/cfbd_2026_week{N}_fixture.json      games + media (sanitized)
  artifacts/validation/cfbd_2026_week{N}_games.json        raw /games (venue names)
  artifacts/validation/cfbd_2026_week{N}_enrichment.json   rankings / lines / records / weather
                                                           (scripts/probe_enrichment.py; optional)
  artifacts/validation/cfbd_2026_teams.json                team colors + abbreviations
  data/rivalries.json                                      curated rivalry / trophy names
  assets/logos/{teamId}.png                                team logos (fetch_team_assets.py)
  assets/network-logos/{slug}.png                          network marks (fetch_network_logos.py)
Team logos are thumbnailed and network marks are dark-adapted IN MEMORY (see
derive_dark_mark) — no extra asset folders required.

Fonts: Barlow Condensed (block names) + Inter (metadata) must be installed on the
rasterizing machine for PNG output; the SVG references them by name.

Data honesty: when the enrichment file is absent, ranks/spreads/records/weather are simply
omitted and the header says so. `--mock` re-enables the layout-only MOCK values and stamps
the header with a MOCK warning; it is never the default.
"""
import argparse, json, html, base64, io, colorsys, math, re
import sys
try:  # Windows consoles default to cp1252; the output lines carry "·" and team names like Hawai'i
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))   # repo root, for pipeline.overlap
from pipeline.overlap import split_overlaps   # the overlap rule, shared with the phone grid
from PIL import Image as _Img

ap = argparse.ArgumentParser()
ap.add_argument("--date", default="2026-09-05")
ap.add_argument("--week", type=int, default=1, help="fixture week; sets the default input paths")
ap.add_argument("--sport", choices=["cfb", "nfl", "nhl", "nba", "mlb"],
                help="v1.5: selects data/render_policies.json + data/row_order.json[sport] and the default fixture path "
                     "({sport}_{year}_week{N} or {sport}_{year}_{date}); default = the fixture's validation.sport, else cfb")
ap.add_argument("--year", type=int, default=2026, help="season year used in default fixture/teams paths")
ap.add_argument("--fixture")
ap.add_argument("--games-raw")
ap.add_argument("--enrichment")
ap.add_argument("--teams", help="default: artifacts/validation/cfbd_{year}_teams.json (cfb) or {sport}_{year}_teams.json")
ap.add_argument("--rivalries", default="data/rivalries.json")
ap.add_argument("--logos", default="assets/logos")
ap.add_argument("--network-logos", default="assets/network-logos")
ap.add_argument("--out", default="artifacts/rendering")
ap.add_argument("--png", action="store_true", help="also rasterize PNG via cairosvg at --scale")
ap.add_argument("--export", action="store_true", help="also rasterize the download PNG at EXPORT_SCALE (@2x)")
ap.add_argument("--scale", type=float, default=1.0)
ap.add_argument("--mock", action="store_true", help="layout-only MOCK ranks/tray when no enrichment exists")
ap.add_argument("--style", action="append", default=[], metavar="KEY=VALUE",
                help="design variant override (silhouette=outline|bezel|quiet, tray=single|cells|chipsright|pills, marquee=sunburst|halo|tag|plate, weather=on|off, records=name|tray, chipbg=tile|none|light, favlogo=disc|plain|invert)")
ARGS = ap.parse_args()
STYLE = {"silhouette": "outline", "tray": "pills", "marquee": "plate", "weather": "off", "records": "name",
         "chipbg": "tile", "favlogo": "disc", "trayh": "28"}   # v1.3 defaults (Joe, 2026-08-31)
DROP_LOG = []   # (game, dropped items) — reported at the end so density decisions rest on counts, not impressions
for kv in ARGS.style:
    k, _, v = kv.partition("="); STYLE[k.strip()] = v.strip()
TARGET = ARGS.date
WK = ARGS.week
YR = ARGS.year
# ----------------------------------------------------------------------------- v1.5 sport + policy
# Sport resolution: --sport wins; else an explicit --fixture's validation.sport; else cfb (Phase 3 behavior).
SPORT = ARGS.sport
if SPORT is None and ARGS.fixture and Path(ARGS.fixture).exists():
    SPORT = (json.load(open(ARGS.fixture, encoding="utf-8")).get("validation") or {}).get("sport")
SPORT = SPORT or "cfb"
_POL_PATH = Path("data/render_policies.json")
_POLICIES = json.load(open(_POL_PATH, encoding="utf-8")) if _POL_PATH.exists() else {}
POLICY = _POLICIES.get(SPORT) or {"title": "COLLEGE FOOTBALL", "block_minutes": 210, "lane_policy": "alt_lane",
                                  "week_label": True, "data_label": "CFBD"}
PRO = POLICY.get("lane_policy") == "market_filter"      # pro leagues: no-media games are off-grid, never "network TBA"
if SPORT == "cfb":
    _PFX = f"artifacts/validation/cfbd_{YR}_week{WK}"
    ARGS.teams = ARGS.teams or f"artifacts/validation/cfbd_{YR}_teams.json"
    ARGS.games_raw = ARGS.games_raw or f"{_PFX}_games.json"
else:
    _by_day = f"artifacts/validation/{SPORT}_{YR}_{TARGET}"
    _PFX = _by_day if (ARGS.fixture is None and Path(_by_day + "_fixture.json").exists()) else f"artifacts/validation/{SPORT}_{YR}_week{WK}"
    ARGS.teams = ARGS.teams or f"artifacts/validation/{SPORT}_{YR}_teams.json"
    ARGS.games_raw = ARGS.games_raw or "/nonexistent"     # pro fixtures carry the venue inline
ARGS.fixture = ARGS.fixture or f"{_PFX}_fixture.json"
ARGS.enrichment = ARGS.enrichment or f"{_PFX}_enrichment.json"
if SPORT != "cfb" and ARGS.out == "artifacts/rendering":      # v1.6: one folder per sport so grid_{date}.svg never collides across leagues
    ARGS.out = f"artifacts/rendering/{SPORT}"
# v1.6: asset fallback — a logo/mark missing from the local cache is fetched once from the R2 bucket (deployment contract §3)
import os as _os, urllib.request as _ur
def _load_dotenv_value(key):
    if _os.getenv(key): return _os.getenv(key)
    p = Path(".env")
    if p.exists():
        for line in p.read_text(encoding="utf-8").splitlines():
            if line.strip().startswith(key + "="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    return None
ASSET_BASE_URL = (_load_dotenv_value("ASSET_BASE_URL") or "").rstrip("/")
def asset_fallback(local_path, key):
    """Fetch {ASSET_BASE_URL}/{key} into the cache when the local file is missing. Silent on failure (render proceeds without the mark)."""
    if local_path.exists() or not ASSET_BASE_URL: return local_path.exists()
    try:
        local_path.parent.mkdir(parents=True, exist_ok=True)
        with _ur.urlopen(_ur.Request(f"{ASSET_BASE_URL}/{key}", headers={"User-Agent": "MySports-renderer"}), timeout=20) as r:
            data = r.read()
        if data: local_path.write_bytes(data); return True
    except Exception:
        pass
    return False
CAP_STYLE = "gradient"  # contract: gradient endcaps (solid rejected 2026-08-31)
EXPORT_SCALE = 2.0      # contract §8: download PNG is @2x of the SVG coordinate space
ET = ZoneInfo("America/New_York")
def clock(dt):
    """'3:45 PM' — portable (Windows' strftime has no %-I)."""
    return f"{dt.hour % 12 or 12}:{dt.minute:02d} {'AM' if dt.hour < 12 else 'PM'}"
def longdate(dt):
    """'Saturday, September 5, 2026' — portable (no %-d)."""
    return f"{dt.strftime('%A')}, {dt.strftime('%B')} {dt.day}, {dt.year}"

_raw = json.load(open(ARGS.games_raw, encoding="utf-8")) if Path(ARGS.games_raw).exists() else []
VENUES = {str(g["id"]): g.get("venue") for g in _raw if g.get("venue")}
ALIASES = {"CW":"The CW","The CW Network":"The CW","USA Net":"USA Network","BTN":"Big Ten Network",
           "ESPN Unlmtd":"ESPN Unlimited","CBSSN":"CBS Sports Network","SECN+":"SEC Network+"}
UNAVAILABLE = {"CBS Sports Network","FS2","MW+","UConn+"}
SIMULCAST = {"CBS":"Paramount+","NBC":"Peacock","TNT":"HBO Max","ESPN":"Disney+","ABC":"Disney+"}
_RO_PATH = Path("data/row_order.json")
LOCAL_ROWS = set()
if _RO_PATH.exists() and SPORT in json.load(open(_RO_PATH, encoding="utf-8")):
    _ro = json.load(open(_RO_PATH, encoding="utf-8"))[SPORT]
    ROW_ORDER = [b["network"] for b in _ro["broadcast"]] + _ro.get("cable", []) + _ro.get("conference", []) + _ro.get("local", [])
    LOCAL_ROWS = set(_ro.get("local", []))
    STATIONS = {b["network"]: (b.get("station"), b.get("channel")) for b in _ro["broadcast"] if b.get("station")}
    _STREAMS_FROM_FILE = _ro["streaming"]
else:  # fallback = spec §11.3 order
    ROW_ORDER = ["ABC","CBS","FOX","NBC","The CW","ESPN","ESPN2","ESPNU","FS1","TNT","USA Network",
                 "Big Ten Network","ACC Network","SEC Network"]
    STATIONS = {}; _STREAMS_FROM_FILE = None
OMIT_ACCESS = {"OUT_OF_MARKET", "UNVERIFIED"}   # v1.5: regional rows Cleveland does not (or is not yet known to) receive
NET_ABBR = {"ABC":"abc","CBS":"CBS","FOX":"FOX","NBC":"NBC","The CW":"CW","ESPN":"ESPN","ESPN2":"ESPN2",
            "ESPNU":"ESPNU","FS1":"FS1","TNT":"TNT","USA Network":"USA","Big Ten Network":"BTN",
            "ACC Network":"ACCN","SEC Network":"SECN","ESPN+":"ESPN+","ESPN Unlimited":"ESPN UNL",
            "SEC Network+":"SECN+","Peacock":"PCOCK","HBO Max":"MAX"}
STREAMS = _STREAMS_FROM_FILE or ["ESPN+","ESPN Unlimited","SEC Network+","Peacock","HBO Max"]
GAME_MIN = int(POLICY.get("block_minutes", 210))
NET_SLUG_EXTRA = {"NFL Network": "nfl-network", "Prime Video": "prime-video", "Netflix": "netflix", "TBS": "tbs",
                  "truTV": "trutv", "Hulu": "hulu", "YouTube": "youtube", "Apple TV": "apple-tv"}
NET_ABBR.update({"NFL Network": "NFL NET", "Prime Video": "PRIME", "Netflix": "NETFLIX", "TBS": "TBS", "truTV": "truTV",
                 "Hulu": "HULU", "Disney+": "DISNEY+", "Paramount+": "PARA+", "YouTube": "YOUTUBE", "Apple TV": "APPLE TV"})

# ----------------------------------------------------------------------------- enrichment
ENR = json.load(open(ARGS.enrichment, encoding="utf-8")) if Path(ARGS.enrichment).exists() else None
RANK_BY_ID = {int(k): v for k, v in ((ENR or {}).get("ranking", {}).get("byTeamId", {}) or {}).items()}
RANK_BY_SCHOOL = (ENR or {}).get("ranking", {}).get("bySchool", {}) or {}
RANK_SOURCE = (ENR or {}).get("ranking", {}).get("source")
RANK_WEEK = (ENR or {}).get("ranking", {}).get("pollWeek")
LINES = (ENR or {}).get("lines", {}) or {}
RECORDS = (ENR or {}).get("records", {}) or {}
WEATHER = (ENR or {}).get("weather", {}) or {}
USE_MOCK = ARGS.mock and ENR is None
MOCK_RANKS = {"Ohio State":1,"Penn State":2,"Oregon":3,"Alabama":4,"Clemson":6,"Michigan":7,
              "LSU":9,"Texas A&M":11,"Iowa":18,"Auburn":22,"Baylor":25} if USE_MOCK else {}
MOCK_TRAY = {  # (crew, spread, extra) — layout only, never default
 ("Clemson","LSU"): ("Fowler · Herbstreit · Rowe", "LSU -2.5 · O/U 54.5", "Death Valley Showdown"),
 ("Baylor","Auburn"): ("Tessitore · Riddick", "AUB -6.5 · O/U 51.0", None),
 ("East Carolina","Alabama"): ("Ansley · Stinchcomb", "ALA -28.5 · O/U 55.5", None),
 ("Boise State","Oregon"): ("Levy · Griese", "ORE -13.5 · O/U 57.0", None),
 ("Western Michigan","Michigan"): ("Brando · Franklin", "MICH -24.0 · O/U 47.5", "78°F · Wind 8 mph"),
 ("Ball State","Ohio State"): ("Davis · McElroy", "OSU -34.5 · O/U 49.0", None),
} if USE_MOCK else {}
RIV = {}
if Path(ARGS.rivalries).exists():
    for r in json.load(open(ARGS.rivalries, encoding="utf-8"))["rivalries"]:
        RIV[frozenset(r["teams"])] = (r["name"], int(r.get("tier", 2)))

teams = {t["id"]: t for t in json.load(open(ARGS.teams, encoding="utf-8"))}
def abbr(tid, fallback):
    a = (teams.get(tid) or {}).get("abbreviation")
    return a or fallback[:4].upper()
def rank_of(side):
    if USE_MOCK: return MOCK_RANKS.get(side["team"])
    return RANK_BY_ID.get(side["id"]) or RANK_BY_SCHOOL.get(side["team"])
CONF_ABBR = {"American Athletic":"AAC","Conference USA":"CUSA","Mid-American":"MAC","Mountain West":"MW","Sun Belt":"SBC",
             "Big Ten":"BIG TEN","Big 12":"BIG 12","Pac-12":"PAC-12","SEC":"SEC","ACC":"ACC","FBS Independents":None}
def record_label(g, side):
    """'(1-0)' or '(1-0, 0-0 BIG 12)' — None before a team's first game or when no record is loaded.
    Conference record shows only when both teams share a conference (Joe, 2026-08-31)."""
    r = record_of(side)
    if not r or r["display"] == "0-0": return None
    txt = r["display"]
    conf = side.get("conference"); other = (g["h"] if side is g["a"] else g["a"]).get("conference")
    cr = r.get("conf")
    if conf and conf == other and cr and CONF_ABBR.get(conf, conf.upper()):
        txt += f", {cr['display']} {CONF_ABBR.get(conf, conf.upper())}"
    return f"({txt})"
def record_of(side):
    r = RECORDS.get(str(side["id"])) or RECORDS.get(side["team"])
    return r
def rivalry_of(g):
    return RIV.get(frozenset((g["a"]["team"], g["h"]["team"])))

# ----------------------------------------------------------------------------- color helpers
def color(tid):
    c = (teams.get(tid) or {}).get("color") or ""
    c = c if str(c).startswith("#") else "#"+str(c)
    return c if re.fullmatch(r"#[0-9a-fA-F]{6}", c) else "#666666"
def lum(hexc):
    h = hexc.lstrip("#")
    def ch(c):
        c = c/255
        return c/12.92 if c <= 0.03928 else ((c+0.055)/1.055)**2.4
    r,g,b = (ch(int(h[i:i+2],16)) for i in (0,2,4))
    return 0.2126*r+0.7152*g+0.0722*b
def contrast(a,b):
    la, lb = sorted((lum(a),lum(b)), reverse=True)
    return (la+0.05)/(lb+0.05)
def darken(hexc,f):
    h = hexc.lstrip("#")
    return "#"+"".join(f"{int(int(h[i:i+2],16)*f):02x}" for i in (0,2,4))
def tint(hexc,f):
    """mix toward white by factor f (0..1)"""
    h = hexc.lstrip("#")
    return "#"+"".join(f"{int(int(h[i:i+2],16)+(255-int(h[i:i+2],16))*f):02x}" for i in (0,2,4))
def legible(bg):
    for _ in range(6):
        cw, cd = contrast("#FFFFFF",bg), contrast("#101214",bg)
        if max(cw,cd) >= 4.0: return bg, ("#FFFFFF" if cw >= cd else "#101214")
        bg = darken(bg,0.82)
    return bg, "#FFFFFF"

# ----------------------------------------------------------------------------- assets
NET_SLUG = {"ABC":"abc","CBS":"cbs","FOX":"fox","NBC":"nbc","The CW":"the-cw","ESPN":"espn",
 "ESPN2":"espn2","ESPNU":"espnu","FS1":"fs1","TNT":"tnt","USA Network":"usa-network",
 "Big Ten Network":"big-ten-network","ACC Network":"acc-network","SEC Network":"sec-network",
 "ESPN+":"espn-plus","ESPN Unlimited":"espn-unlimited","SEC Network+":"sec-network-plus",
 "Peacock":"peacock","HBO Max":"hbo-max","Paramount+":"paramount-plus","Disney+":"disney-plus"}
NET_SLUG.update(NET_SLUG_EXTRA)   # v1.5 pro-league marks; a missing file falls back to the NET_ABBR text label
NET_SUFFIX = {"espn-plus":"+","espn-unlimited":"UNL","sec-network-plus":"+"}
def _lift_hex(hexc, floor=0.80):
    """Chip rule applied to one CSS hex color: grayscale → luminance-inverted; saturated → HLS lightness ≥ floor."""
    h = hexc.lstrip("#")
    if len(h) == 3: h = "".join(c*2 for c in h)
    r,g,b = (int(h[i:i+2],16) for i in (0,2,4))
    if max(r,g,b)-min(r,g,b) < 46:
        l = 255-(r+g+b)//3; return f"#{l:02x}{l:02x}{l:02x}"
    hh,l,sat = colorsys.rgb_to_hls(r/255,g/255,b/255)
    if l >= floor: return "#"+h
    r2,g2,b2 = colorsys.hls_to_rgb(hh,floor,sat)
    return f"#{int(r2*255):02x}{int(g2*255):02x}{int(b2*255):02x}"
def svg_chip_mark(path, slug):
    """Load an SVG wordmark and prepare it for INLINE nesting (a nested <svg> element, not an <image>
    data URI — cairosvg renders some marks blank through <image>). Recolors every hex color with the
    chip rule, gives fill-less paths a light default, prefixes ids so several marks can share the
    document. Returns (template, aspect); template takes x, y, w, h. Pure text — Windows-safe."""
    txt = path.read_text(encoding="utf-8")
    txt = re.sub(r"<\?xml.*?\?>", "", txt, flags=re.S); txt = re.sub(r"<!DOCTYPE[^>]*>", "", txt); txt = re.sub(r"<!--.*?-->", "", txt, flags=re.S)
    txt = re.sub(r"#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b", lambda m: _lift_hex(m.group(0)), txt)
    m = re.search(r'<svg\b[^>]*>', txt); root = m.group(0)
    vb = re.search(r'viewBox="([^"]+)"', root)
    if vb: vbv = vb.group(1)
    else:
        w_ = re.search(r'\bwidth="([\d.]+)', root); h_ = re.search(r'\bheight="([\d.]+)', root)
        vbv = f"0 0 {w_.group(1)} {h_.group(1)}" if w_ and h_ else "0 0 300 100"
    nums = [float(v) for v in re.split(r"[ ,]+", vbv.strip())]
    asp = nums[2]/nums[3]
    fill = "" if " fill=" in root else ' fill="#E8EAEC"'
    pre = slug.replace("-", "_")
    body = txt[m.end():]
    body = re.sub(r'\bid="([^"]+)"', lambda mm: f'id="{pre}_{mm.group(1)}"', body)
    body = re.sub(r'url\(#([^)]+)\)', lambda mm: f'url(#{pre}_{mm.group(1)})', body)
    body = re.sub(r'href="#([^"]+)"', lambda mm: f'href="#{pre}_{mm.group(1)}"', body)
    body = re.sub(r'\.([a-zA-Z]\w*)\{', lambda mm: f'.{pre}_{mm.group(1)}{{', body)          # scope <style> classes
    body = re.sub(r'class="([^"]+)"', lambda mm: 'class="' + " ".join(f"{pre}_{c}" for c in mm.group(1).split()) + '"', body)
    tmpl = '<svg x="__X__" y="__Y__" width="__W__" height="__H__" viewBox="' + vbv + '" preserveAspectRatio="xMidYMid meet"' + fill + '>' + body
    return tmpl, asp
RAIL_SVG = {"sec-network"}   # rail marks that ship as self-contained vector lockups (own plate colors; no recolor)
def svg_rail_mark(path, slug):
    """Inline-nest an SVG as-is for the rail (ids prefixed). Returns (template, aspect)."""
    txt = path.read_text(encoding="utf-8")
    txt = re.sub(r"<\?xml.*?\?>", "", txt, flags=re.S); txt = re.sub(r"<!DOCTYPE[^>]*>", "", txt); txt = re.sub(r"<!--.*?-->", "", txt, flags=re.S)
    m = re.search(r'<svg\b[^>]*>', txt); root = m.group(0)
    vb = re.search(r'viewBox="([^"]+)"', root)
    vbv = vb.group(1) if vb else "0 0 300 100"
    nums = [float(v) for v in re.split(r"[ ,]+", vbv.strip())]
    pre = "rail_" + slug.replace("-", "_")
    body = txt[m.end():]
    body = re.sub(r'\bid="([^"]+)"', lambda mm: f'id="{pre}_{mm.group(1)}"', body)
    body = re.sub(r'url\(#([^)]+)\)', lambda mm: f'url(#{pre}_{mm.group(1)})', body)
    body = re.sub(r'\.([a-zA-Z]\w*)\{', lambda mm: f'.{pre}_{mm.group(1)}{{', body)          # scope <style> classes
    body = re.sub(r'class="([^"]+)"', lambda mm: 'class="' + " ".join(f"{pre}_{c}" for c in mm.group(1).split()) + '"', body)
    tmpl = '<svg x="__X__" y="__Y__" width="__W__" height="__H__" viewBox="' + vbv + '" preserveAspectRatio="xMidYMid meet">' + body
    return tmpl, nums[2]/nums[3]
NLOGO = {}
def net_logo(name, dark=False, chip=False):
    slug = NET_SLUG.get(name)
    if not slug: return None
    key = (slug, dark, chip)
    if key not in NLOGO:
        p = Path(ARGS.network_logos) / f"{slug}.png"
        psvg = Path(ARGS.network_logos) / f"{slug}.svg"
        if not (p.exists() or psvg.exists()):
            asset_fallback(p, f"network-logos/{slug}.png"); asset_fallback(psvg, f"network-logos/{slug}.svg")
        if chip and psvg.exists():          # v1.3: vector wordmarks for chips when available (inline nested <svg>)
            tmpl, asp = svg_chip_mark(psvg, slug)
            NLOGO[key] = ("svg:" + tmpl, asp, "" if slug in ("espn-plus",) else NET_SUFFIX.get(slug, ""))
        elif (not chip) and slug in RAIL_SVG and psvg.exists():   # v1.4: vector rail lockup, as designed
            tmpl, asp = svg_rail_mark(psvg, slug)
            NLOGO[key] = ("svg:" + tmpl, asp, NET_SUFFIX.get(slug, ""))
        elif p.exists():
            im = _Img.open(p).convert("RGBA")
            if chip: im = derive_chip_mark(im)
            elif dark: im = derive_dark_mark(im)
            buf = io.BytesIO(); im.save(buf, "PNG")
            NLOGO[key] = ("data:image/png;base64,"+base64.b64encode(buf.getvalue()).decode(), im.width/im.height, NET_SUFFIX.get(slug,""))
        else: NLOGO[key] = None
    return NLOGO[key]
LOGO = {}
def logo_uri(tid):
    if tid not in LOGO:
        p = Path(ARGS.logos) / f"{tid}.png"
        asset_fallback(p, f"logos/{tid}.png")
        if p.exists():
            im = _Img.open(p).convert("RGBA"); im.thumbnail((64,64))
            buf = io.BytesIO(); im.save(buf, "PNG")
            LOGO[tid] = "data:image/png;base64,"+base64.b64encode(buf.getvalue()).decode()
        else: LOGO[tid] = None
    return LOGO[tid]

LOGO_LIGHT = {}
def logo_uri_light(tid):
    """Team logo with HLS lightness inverted per pixel (hue kept) — the 'invert for dark backgrounds' idea."""
    if tid not in LOGO_LIGHT:
        p = Path(ARGS.logos) / f"{tid}.png"
        if p.exists():
            im = _Img.open(p).convert("RGBA"); im.thumbnail((64,64)); px = im.load()
            for yy in range(im.height):
                for xx in range(im.width):
                    r,g,b,a = px[xx,yy]
                    if a < 16: continue
                    h,l,sat = colorsys.rgb_to_hls(r/255,g/255,b/255)
                    r2,g2,b2 = colorsys.hls_to_rgb(h,1-l,sat)
                    px[xx,yy] = (int(r2*255),int(g2*255),int(b2*255),a)
            buf = io.BytesIO(); im.save(buf, "PNG")
            LOGO_LIGHT[tid] = "data:image/png;base64,"+base64.b64encode(buf.getvalue()).decode()
        else: LOGO_LIGHT[tid] = None
    return LOGO_LIGHT[tid]

def derive_chip_mark(im, floor=0.80):
    """Tray chips are 14px tall; brand blues (Disney+, Paramount+) vanish on #31363D. Apply the
    rail rule (derive_dark_mark) and then raise every opaque pixel's HLS lightness to >= floor,
    hue preserved — the mark stays recognizably its brand color, just bright enough to read."""
    im = derive_dark_mark(im); px = im.load()
    for yy in range(im.height):
        for xx in range(im.width):
            r,g,b,a = px[xx,yy]
            if a < 16: continue
            h,l,sat = colorsys.rgb_to_hls(r/255,g/255,b/255)
            if l < floor:
                r2,g2,b2 = colorsys.hls_to_rgb(h,floor,sat)
                px[xx,yy] = (int(r2*255),int(g2*255),int(b2*255),a)
    return im

def derive_dark_mark(im):
    """Contract rule: grayscale pixels get luminance-inverted (black marks -> white),
    saturated pixels keep brand color; if the mark is still dark (mean < 80),
    invert HLS lightness for all pixels (hue preserved). Deterministic."""
    im = im.convert("RGBA"); px = im.load(); tot = n = 0
    for yy in range(im.height):
        for xx in range(im.width):
            r,g,b,a = px[xx,yy]
            if a < 16: continue
            if max(r,g,b)-min(r,g,b) < 46:
                l = 255-(r+g+b)//3; px[xx,yy] = (l,l,l,a); tot += l
            else: tot += (r+g+b)//3
            n += 1
    if n and tot//n < 80:
        for yy in range(im.height):
            for xx in range(im.width):
                r,g,b,a = px[xx,yy]
                if a < 16: continue
                h,l,sat = colorsys.rgb_to_hls(r/255,g/255,b/255)
                r2,g2,b2 = colorsys.hls_to_rgb(h,1-l,sat)
                px[xx,yy] = (int(r2*255),int(g2*255),int(b2*255),a)
    return im

# ----------------------------------------------------------------------------- day selection
_FX = json.load(open(ARGS.fixture, encoding="utf-8"))
games = _FX["games"]
FX_META = _FX.get("validation") or {}
day, tbd, omitted = [], [], []   # grid games / TBD-section games / not-on-your-services
for g in games:
    if g.get("startDate") is None: continue   # pro leagues: a game with no time at all is not a viewing-day event yet
    dt = datetime.fromisoformat(g["startDate"].replace("Z","+00:00")).astimezone(ET)
    if dt.strftime("%Y-%m-%d") != TARGET: continue
    seen, tv, web, blocked = set(), [], [], []
    for m in g["media"]:
        o = ALIASES.get(m["outlet"], m["outlet"]); k = (m["mediaType"],o)
        if k in seen: continue
        seen.add(k)
        if m.get("access") in OMIT_ACCESS:                      # v1.5 market filter (adapter-stated reason)
            blocked.append((o, m.get("access"), m.get("market"))); continue
        (tv if m["mediaType"]=="tv" else web).append(o)
    rec = {"id":str(g["id"]),"a":g["away"],"h":g["home"],"dt":dt,"alt":False,"end_min":GAME_MIN,
           "outlets": tv+web+[b[0] for b in blocked], "time_tbd": bool(g.get("startTimeTBD")),
           "blocked": blocked, "venue": g.get("venue")}
    # v1.5: pro fixtures carry odds/records inline (spec §3.11) — same shape the CFB enrichment file feeds
    if PRO and g.get("odds") and g["odds"].get("spread") is not None and str(g["id"]) not in LINES:
        od = g["odds"]; LINES[str(g["id"])] = {"spread": od["spread"], "overUnder": od.get("overUnder"),
                                                "display": (od.get("details") or "") + (f" · O/U {od['overUnder']:g}" if od.get("overUnder") is not None else "")}
    if PRO and g.get("records"):
        for side_k, side in (("home", g["home"]), ("away", g["away"])):
            if g["records"].get(side_k) and str(side["id"]) not in RECORDS: RECORDS[str(side["id"])] = {"display": g["records"][side_k]}
    primary = next((r for r in ROW_ORDER if r in tv), None) or next((w for w in web if w not in UNAVAILABLE), None)
    # §11.2 gating: a TBD kickoff never takes a grid position, whatever the media rows say.
    if rec["time_tbd"]:
        rec["state"] = "time_tbd" if (tv or web) else "time_and_network_tbd"; tbd.append(rec); continue
    if not tv and not web:
        if blocked or PRO:               # pro leagues: nothing receivable is "not on your services", never "network TBA"
            rec["reason"] = ("regional feed — Cleveland assignment not entered" if any(b[1]=="UNVERIFIED" for b in blocked)
                             else "out of market" if blocked else "no national telecast · out of market")
            omitted.append(rec); continue
        rec["state"] = "network_tbd"; tbd.append(rec); continue
    if primary is None or primary in UNAVAILABLE:
        rec["reason"] = "not on your services"; omitted.append(rec); continue
    badges = [w for w in web if w != primary and w not in UNAVAILABLE]
    if primary in SIMULCAST and SIMULCAST[primary] not in badges: badges.append(SIMULCAST[primary]+"*")
    rec.update({"primary":primary,"badges":badges}); day.append(rec)

# OVERLAP RULE (Joe, 2026-09-03; contract v1.6.5). Two programs on one network row whose blocks
# overlap SPLIT THE DIFFERENCE - the earlier one's end and the later one's start each move by half the
# overlap, meeting at its midpoint, so they share one row instead of forcing a second lane.
#
# This REPLACES a cruder rule that shortened only the earlier block to the next kickoff, handing it
# 100% of the loss. Block lengths are policy, not measurement (every CFB game is drawn 210 minutes
# wide), so an overlap is an artefact of the estimate and the cost belongs to both sides equally.
#
# PRESENTATIONAL ONLY: `dt` is untouched. `rs` is a render-only start, and the detail panel and every
# written record still carry the real kickoff. The rule is shared with the phone grid through
# pipeline/overlap.py and pinned to it by tests/fixtures/overlap_cases.json.
GUARD_HITS = 0
SPLIT_HITS = 0
for r in ROW_ORDER:
    gs = sorted([g for g in day if g["primary"] == r], key=lambda g: g["dt"])
    if not gs:
        continue
    origin = gs[0]["dt"]
    mins = [int((g["dt"] - origin).total_seconds() / 60) for g in gs]
    items = [{"start": m, "end": m + GAME_MIN} for m in mins]
    adjusted, _split, guarded = split_overlaps(items)
    GUARD_HITS += len(guarded); SPLIT_HITS += len(_split)
    for g, it in zip(gs, adjusted):
        g["rs"] = origin + timedelta(minutes=it["start"])     # render start (may sit after the kickoff)
        g["end_min"] = it["end"] - it["start"]                # rendered width, in minutes

def lanes(gs, use_end=True, mark=True):
    L = []
    for g in sorted(gs, key=lambda g: g.get("rs") or g["dt"]):
        for l in L:
            prev = l[-1]
            dur = prev["end_min"] if use_end else GAME_MIN
            # compare RENDERED starts, so a pair that split the difference packs into one lane
            if ((g.get("rs") or g["dt"]) - (prev.get("rs") or prev["dt"])).total_seconds()/60 >= dur:
                l.append(g); break
        else:
            if L and mark: g["alt"] = True
            L.append([g])
    return L

rows = [{"name":r,"lanes":lanes([g for g in day if g["primary"]==r]),"stream":False} for r in ROW_ORDER if any(g["primary"]==r for g in day)]
rows += [{"name":s,"lanes":lanes([g for g in day if g["primary"]==s],use_end=False,mark=False),"stream":True} for s in STREAMS if any(g["primary"]==s for g in day)]

# ----------------------------------------------------------------------------- geometry
PX = 3.2; LABEL_W = 150; PAD_T, PAD_B, PAD_X = 136, 48, 24
BLOCK_H, TRAY_H, GAP = 74, int(STYLE["trayh"]), 8
CHIP_H = 16 if TRAY_H >= 28 else 14          # chip mark height; tile = CHIP_H + 5; pills = CHIP_H + 3 — leaves ≥ 3.5px clear of the seam
ROW_H = BLOCK_H + TRAY_H + GAP   # 106
ST_BLOCK, ST_TRAY = 36, 16
ST_H = ST_BLOCK + ST_TRAY + 6   # 58
# TBD section (contract §10): streaming-scale cards in a wrapping list below the grid
TBD_CARD_W, TBD_CARD_H, TBD_GAP = GAME_MIN*PX - 4, BLOCK_H + TRAY_H, 14   # = a 3.5 h grid block (668 × 98)
TBD_ROW = ROW_H
TBD_HEAD, TBD_GROUP_HEAD = 64, 30
E = html.escape
BC = "Barlow Condensed, Inter, sans-serif"
# Text measurement: exact when the repo fonts are present (assets/fonts), heuristic otherwise.
from PIL import ImageFont as _IF
_FONT_FILES = {"barlow": "assets/fonts/BarlowCondensed-Bold.ttf", "inter": "assets/fonts/Inter-Regular.ttf", "inter-bold": "assets/fonts/Inter-Bold.ttf"}
_FONT_CACHE = {}
def _font(kind, fs):
    key = (kind, round(fs*4))
    if key not in _FONT_CACHE:
        fp = Path(_FONT_FILES[kind])
        _FONT_CACHE[key] = _IF.truetype(str(fp), max(1, round(fs*4))) if fp.exists() else None
    return _FONT_CACHE[key]
def tw(kind, s, fs, fallback):
    f = _font(kind, fs)
    return f.getlength(s)/4 if f else len(s)*fs*fallback
def tw_inter(s, fs): return tw("inter", s, fs, 0.55)
def tw_barlow(s, fs): return tw("barlow", s, fs, 0.42)

if day:
    t0 = min(g["dt"] for g in day).replace(minute=0)
    tend = max(g["dt"]+timedelta(minutes=GAME_MIN) for g in day)
    total = ((int((tend-t0).total_seconds()//60)+29)//30)*30
else:  # a TBD-only day still gets a page
    t0 = datetime.strptime(TARGET, "%Y-%m-%d").replace(hour=12, tzinfo=ET); total = 360
W = LABEL_W + total*PX + PAD_X
W = max(W, PAD_X*2 + 2*TBD_CARD_W + TBD_GAP)              # never narrower than two full-size TBD columns
GRID_H = sum(len(r["lanes"])*ROW_H for r in rows)

TBD_ORDER = [("network_tbd", "KICKOFF SET · NETWORK TBA"), ("time_tbd", "NETWORK SET · KICKOFF TBA"),
             ("time_and_network_tbd", "KICKOFF AND NETWORK TBA")]
tbd_groups = [(k, lbl, sorted([g for g in tbd if g["state"]==k], key=lambda g: (g["dt"] if k=="network_tbd" else datetime.min.replace(tzinfo=ET), g["h"].get("conference") or "", g["h"]["team"])))
              for k, lbl in TBD_ORDER]
tbd_groups = [t for t in tbd_groups if t[2]]
TBD_COLS = max(1, int((W - 2*PAD_X + TBD_GAP) // (TBD_CARD_W + TBD_GAP)))
TBD_H = 0
if tbd_groups:
    TBD_H = TBD_HEAD + sum(TBD_GROUP_HEAD + math.ceil(len(gs)/TBD_COLS)*TBD_ROW + 12 for _,_,gs in tbd_groups)
# v1.6 — Around the League strip (contract §11.8 / spec §3.12): pro-league games the market does not receive,
# one muted line each below the TBD section. Never for CFB (its omitted games keep the footer pill).
ATL = sorted(omitted, key=lambda g: (g["dt"], g["h"]["team"])) if PRO else []
ATL_HEAD, ATL_LINE = 54, 20
ATL_H = (ATL_HEAD + len(ATL)*ATL_LINE + 14) if ATL else 0
FOOT_H = 34
H = PAD_T + GRID_H + TBD_H + ATL_H + FOOT_H + PAD_B
xof = lambda dt: LABEL_W + (dt-t0).total_seconds()/60*PX

# ----------------------------------------------------------------------------- header + legend
def week_label():
    """CFBD's week 1 window (Aug 29 – Sep 7 in 2026) contains two Saturdays; the first weekend is
    colloquially Week 0. Rule: if the fixture week's calendar window holds two Saturdays and the
    target date falls on or before the first Sunday, label it Week 0. Otherwise the CFBD week."""
    cal_p = Path(f"artifacts/validation/cfbd_2026_week{WK}_calendar.json")
    tgt = datetime.strptime(TARGET, "%Y-%m-%d").date()
    if cal_p.exists():
        for wkrow in json.load(open(cal_p, encoding="utf-8")):
            if wkrow.get("week") == WK and wkrow.get("seasonType", "regular") == "regular":
                a = datetime.fromisoformat(wkrow["startDate"].replace("Z","+00:00")).astimezone(ET).date()
                b = datetime.fromisoformat(wkrow["endDate"].replace("Z","+00:00")).astimezone(ET).date()
                sats = [a+timedelta(d) for d in range((b-a).days+1) if (a+timedelta(d)).weekday() == 5]
                if len(sats) >= 2 and tgt <= sats[0] + timedelta(days=1): return 0
    return WK
WEEK_LABEL = week_label() if SPORT == "cfb" else (FX_META.get("week") if FX_META.get("week") is not None else WK)
_wk_txt = f" WEEK {WEEK_LABEL}" if POLICY.get("week_label", True) else ""
title = f"{POLICY.get('title', 'COLLEGE FOOTBALL')}{_wk_txt} — " + longdate(datetime.strptime(TARGET,"%Y-%m-%d")).upper()
if USE_MOCK: rank_note = "ranks/spreads/records MOCK — layout only"
elif RANK_SOURCE: rank_note = f"{RANK_SOURCE} (wk {RANK_WEEK})"
elif PRO: rank_note = (f"lines: {next((g['odds']['provider'] for g in games if g.get('odds')), '')}" if any(g.get("odds") for g in games) else "no lines in fixture")
else: rank_note = "no ranking snapshot in enrichment"
# v1.6.2: the displayed time is the FEED's generatedAt, not the wall clock. Two renders of one fixture are
# byte-identical whenever they run, which is what keeps generated_grids.render_hash stable - one archive row
# per data state, not one per render minute. Label says 'data as of' because that is now what it means.
def _feed_asof():
    raw = FX_META.get("generatedAt")
    if raw:
        try:
            return datetime.fromisoformat(str(raw).replace("Z", "+00:00")).astimezone(ET)
        except ValueError:
            pass
    ts = datetime.fromtimestamp(Path(ARGS.fixture).stat().st_mtime, ET)
    print(f"  note: fixture has no usable validation.generatedAt - using its file mtime "
          f"({ts.strftime('%Y-%m-%d %H:%M')} ET) as 'data as of'")
    return ts
_asof = _feed_asof(); gen = f"{_asof.strftime('%b')} {_asof.day}, {_asof.year} {clock(_asof)} ET"
DATA_LABEL = POLICY.get("data_label", "CFBD")
# v1.6.3: the fixture-date prefix comes from the SAME ET datetime as "data as of". It used to slice
# validation.generatedAt raw, i.e. UTC, so a feed generated after 20:00 ET printed tomorrow's date beside
# tonight's time - "fixture 2026-09-02 ... data as of Sep 1, 2026 8:40 PM ET", two calendar days for one instant.
_fx_desc = f"{DATA_LABEL} fixture week {WK}" if SPORT == "cfb" else f"{DATA_LABEL} fixture {_asof.strftime('%Y-%m-%d')} ({FX_META.get('source', '')})"
if FX_META.get("sample"): _fx_desc += " · SAMPLE DATA"
sub = f"all times ET · {rank_note} · data: {_fx_desc}" + (f" + enrichment {ENR['generatedAt'][:10]}" if ENR else (" · no enrichment file" if SPORT == "cfb" else "")) + f" · data as of {gen}"

svg = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W:.0f}" height="{H:.0f}" font-family="Inter, DejaVu Sans, sans-serif">',
f'''<defs>
<radialGradient id="spot" cx="50%" cy="-8%" r="130%">
<stop offset="0%" stop-color="#3B3B3B"/><stop offset="42%" stop-color="#232323"/>
<stop offset="64%" stop-color="#1B1B1B"/><stop offset="100%" stop-color="#0E0E0E"/>
</radialGradient>
<filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
<feDropShadow dx="0" dy="2" stdDeviation="2.4" flood-color="#000000" flood-opacity="0.55"/>
</filter>
<filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
<feDropShadow dx="0" dy="0" stdDeviation="5" flood-color="#F0C850" flood-opacity="0.8"/>
<feDropShadow dx="0" dy="0" stdDeviation="14" flood-color="#F0C850" flood-opacity="0.45"/>
</filter>
<radialGradient id="sunburst" cx="50%" cy="50%" r="50%">
<stop offset="55%" stop-color="#F0C850" stop-opacity="0"/>
<stop offset="78%" stop-color="#F0C850" stop-opacity="0.28"/>
<stop offset="92%" stop-color="#F0C850" stop-opacity="0.10"/>
<stop offset="100%" stop-color="#F0C850" stop-opacity="0"/>
</radialGradient>
<linearGradient id="tile" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#31363D"/><stop offset="100%" stop-color="#1E2126"/></linearGradient>
<filter id="glow1" x="-30%" y="-30%" width="160%" height="160%">
<feDropShadow dx="0" dy="0" stdDeviation="5" flood-color="#F0C850" flood-opacity="0.85"/>
</filter>
<filter id="softer" x="-20%" y="-20%" width="140%" height="150%">
<feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#000000" flood-opacity="0.7"/>
</filter>
<filter id="blur10" x="-20%" y="-60%" width="140%" height="220%"><feGaussianBlur stdDeviation="10"/></filter>
<radialGradient id="halo" cx="50%" cy="50%" r="50%">
<stop offset="0%" stop-color="#F0C850" stop-opacity="0.42"/>
<stop offset="70%" stop-color="#F0C850" stop-opacity="0.22"/>
<stop offset="100%" stop-color="#F0C850" stop-opacity="0"/>
</radialGradient>
</defs>''',
f'<rect width="{W:.0f}" height="{H:.0f}" fill="url(#spot)"/>',
f'<text x="{PAD_X}" y="50" font-size="34" font-weight="700" font-family="{BC}" fill="#F2F3F4">{E(title)}</text>',
f'<text x="{PAD_X}" y="76" font-size="14" fill="{"#F0C850" if USE_MOCK else "#9aa2a8"}">{E(sub)}</text>']

# Legend (contract §9): glyph + label pairs. Right-aligned in the header band when they fit
# beside the title; otherwise they flow left-to-right under the subtitle and wrap.
LEG_FS = 11
def tw_caps(s, fs): return len(s)*fs*0.65 + len(s)*0.3   # Inter 600 uppercase + letter-spacing
legend = []   # (glyph_kind, label)
if not PRO:   # v1.5: polls and the ranked-marquee rule are college-only; pro legends carry the market line instead
    legend.append(("rank", (f"{RANK_SOURCE.upper()} · WEEK {RANK_WEEK}" if RANK_SOURCE and not USE_MOCK else ("RANKS: MOCK" if USE_MOCK else "RANKS: NONE LOADED"))))
    legend.append(("gold", "MARQUEE · BOTH RANKED OR TIER-1 RIVALRY"))
else:
    legend.append(("gold", "MARQUEE · TIER-1 RIVALRY"))
    if LOCAL_ROWS and any(r["name"] in LOCAL_ROWS for r in rows): legend.append(("tba", f"LOCAL ROW · CARRIER TBA ({', '.join(sorted(LOCAL_ROWS))})"))
legend.append(("star", "STREAMING SIMULCAST BY RULE"))
if not PRO or any(g.get("alt") for g in day): legend.append(("alt", "SECOND GAME, SAME NETWORK, SAME SLOT"))
if tbd_groups: legend.append(("tbd", f"{len(tbd)} KICKOFF/NETWORK TBA · LISTED BELOW GRID"))
if omitted and not PRO: legend.append(("omit", f"{len(omitted)} NOT ON YOUR SERVICES · OMITTED"))
elif omitted: legend.append(("omit", f"{len(omitted)} AROUND THE LEAGUE · NOT RECEIVED IN {str(FX_META.get('market', 'CLEVELAND')).split(' (')[0].upper()}"))
GLYPH_W = {"rank":22,"gold":30,"star":14,"alt":34,"tbd":34,"omit":22,"tba":34}
ITEM_GAP = 28
item_w = [GLYPH_W[k] + 8 + tw_caps(l, LEG_FS) for k,l in legend]
leg_w = sum(item_w) + ITEM_GAP*(len(legend)-1)
title_w = tw_barlow(title, 34) + PAD_X + 40
positions = []
if leg_w + title_w < W - PAD_X:
    lx = W - PAD_X - leg_w
    for (k,l),iw in zip(legend,item_w): positions.append((k,l,lx,44)); lx += iw + ITEM_GAP
else:  # narrow day: flow under the subtitle, wrapping as needed
    lx, ly, lines_used = PAD_X, 100, 1
    for (k,l),iw in zip(legend,item_w):
        if lx > PAD_X and lx + iw > W - PAD_X: lx, ly, lines_used = PAD_X, ly+24, lines_used+1
        positions.append((k,l,lx,ly)); lx += iw + ITEM_GAP
    extra = 30 + 24*(lines_used-1); PAD_T += extra; H += extra
    svg[0] = f'<svg xmlns="http://www.w3.org/2000/svg" width="{W:.0f}" height="{H:.0f}" font-family="Inter, DejaVu Sans, sans-serif">'
    svg[2] = f'<rect width="{W:.0f}" height="{H:.0f}" fill="url(#spot)"/>'
for k,l,lx,ly in positions:
    gw = GLYPH_W[k]
    if k == "rank":
        svg.append(f'<text x="{lx+gw/2}" y="{ly+7}" font-size="20" font-weight="700" font-family="{BC}" fill="#F2F3F4" text-anchor="middle">12</text>')
    elif k == "gold":
        svg.append(f'<rect x="{lx+1}" y="{ly-8}" width="{gw-2}" height="16" rx="4" fill="#3A3218" stroke="#F0C850" stroke-width="2.5" filter="url(#glow1)"/>')
    elif k == "star":
        svg.append(f'<text x="{lx+gw/2}" y="{ly+8}" font-size="20" font-weight="700" fill="#F2F3F4" text-anchor="middle">*</text>')
    elif k == "alt":
        svg.append(f'<rect x="{lx}" y="{ly-8}" width="{gw}" height="16" rx="4" fill="#FFFFFF"/><text x="{lx+gw/2}" y="{ly+4}" font-size="10" font-weight="700" fill="#33383c" text-anchor="middle">ALT</text>')
    elif k == "tbd":
        svg.append(f'<rect x="{lx}" y="{ly-8}" width="{gw}" height="16" rx="4" fill="url(#tile)" stroke="#FFFFFF" stroke-opacity="0.35"/><text x="{lx+gw/2}" y="{ly+4}" font-size="9.5" font-weight="700" fill="#F2F3F4" text-anchor="middle">TBA</text>')
    elif k == "omit":
        svg.append(f'<rect x="{lx}" y="{ly-8}" width="{gw}" height="16" rx="4" fill="url(#tile)" stroke="#848C93" stroke-opacity="0.6"/><line x1="{lx+4}" y1="{ly+5}" x2="{lx+gw-4}" y2="{ly-5}" stroke="#848C93" stroke-width="1.5"/>')
    elif k == "tba":   # v1.5 local-row glyph mirrors the rail plate
        svg.append(f'<rect x="{lx}" y="{ly-8}" width="{gw}" height="16" rx="4" fill="url(#tile)" stroke="#FFFFFF" stroke-opacity="0.35"/><text x="{lx+gw/2}" y="{ly+4}" font-size="8" font-weight="700" fill="#C9CED3" text-anchor="middle" letter-spacing="0.6">TBA</text>')
    svg.append(f'<text x="{lx+gw+8}" y="{ly+4}" font-size="{LEG_FS}" font-weight="600" fill="#9aa2a8" letter-spacing="0.3">{E(l)}</text>')

# ----------------------------------------------------------------------------- time grid
event_min = sorted({int((g["dt"]-t0).total_seconds()//60) for g in day} | {int((g["dt"]-t0).total_seconds()//60)+g["end_min"] for g in day})
kick_min = {int((g["dt"]-t0).total_seconds()//60) for g in day}
AX_FS = 14
# Place axis labels on up to two lines: a label that would collide on line 0 drops to line 1 (v1.4 staggering)
# instead of being skipped; kickoffs still outrank block ends when even line 1 is taken.
placed = []   # (m, x, lbl, line)
last_right = {0: -1e9, 1: -1e9}
for m in event_min:
    t = t0+timedelta(minutes=m); x = LABEL_W+m*PX
    lbl = clock(t); wdt = tw("inter-bold", lbl, AX_FS, 0.6)
    for line in (0, 1):
        if x - wdt/2 >= last_right[line] + 10:
            placed.append((m, x, lbl, line)); last_right[line] = x + wdt/2; break
    else:
        if m in kick_min:   # displace the most recent block-end label on line 1, if any
            for i in range(len(placed)-1, -1, -1):
                if placed[i][3] == 1 and placed[i][0] not in kick_min:
                    placed.pop(i); placed.append((m, x, lbl, 1)); last_right[1] = x + wdt/2; break
STAGGER = any(pl[3] == 1 for pl in placed)
if STAGGER:                       # second label line needs 16px more header
    PAD_T += 16; H += 16
    svg[0] = f'<svg xmlns="http://www.w3.org/2000/svg" width="{W:.0f}" height="{H:.0f}" font-family="Inter, DejaVu Sans, sans-serif">'
    svg[2] = f'<rect width="{W:.0f}" height="{H:.0f}" fill="url(#spot)"/>'
GRID_BOTTOM = PAD_T + GRID_H
for m in range(0, total, 30):
    if (m//30) % 2 == 0:
        svg.append(f'<rect x="{LABEL_W+m*PX}" y="{PAD_T-18}" width="{30*PX}" height="{GRID_H+18}" fill="#FFFFFF" fill-opacity="0.035"/>')
for m in range(0, total+1, 30):
    x = LABEL_W+m*PX
    svg.append(f'<line x1="{x}" y1="{PAD_T-18}" x2="{x}" y2="{GRID_BOTTOM}" stroke="#FFFFFF" stroke-opacity="{"0.10" if m % 60 == 0 else "0.045"}"/>')
for m, x, lbl, line in placed:
    svg.append(f'<line x1="{x}" y1="{PAD_T-18}" x2="{x}" y2="{GRID_BOTTOM}" stroke="#FFFFFF" stroke-opacity="0.16"/>')
    svg.append(f'<text x="{x}" y="{PAD_T-25-(16 if line == 1 else 0)}" font-size="{AX_FS}" font-weight="700" fill="#E8EAEC" text-anchor="middle">{E(lbl)}</text>')

# ----------------------------------------------------------------------------- shared card pieces

def gkey(g):
    """Stable SVG-id fragment from the game's own fixture id (v1.6.1).

    Previously these ids came from id(g) - a memory address, different every process - which made two
    renders of identical data differ byte for byte and defeated generated_grids.render_hash. The fixture
    id is unique within a render and stable across runs.
    """
    return re.sub(r"[^A-Za-z0-9_-]", "", str(g.get("id", "")))


def mini_card(x, y, w, g, tray_text, tray_right=None, ranks=True):
    """Streaming-scale silhouette (contract §4) used by streaming rows and the TBD section."""
    ac, hc = color(g["a"]["id"]), color(g["h"]["id"])
    mh = ST_BLOCK/2; MC = ST_BLOCK
    (sba, sia), (sbh, sih) = legible(ac), legible(hc)
    svg.append(f'<g filter="url(#soft)"><rect x="{x}" y="{y}" width="{w}" height="{ST_BLOCK+ST_TRAY}" rx="7" fill="#23282E" stroke="#FFFFFF" stroke-opacity="0.42" stroke-width="1.5"/></g>')
    svg.append(f'<rect x="{x}" y="{y}" width="{w}" height="{mh}" rx="7" fill="{sba}"/><rect x="{x}" y="{y+mh*0.5}" width="{w}" height="{mh*0.5}" fill="{sba}"/>')
    svg.append(f'<rect x="{x}" y="{y+mh}" width="{w}" height="{mh}" fill="{sbh}"/>')
    for ci,(cx2, cc2, lg2) in enumerate(((x, ac, logo_uri(g["a"]["id"])), (x+w-MC, hc, logo_uri(g["h"]["id"])))):
        gid2 = f"scap{gkey(g)}_{ci}"
        svg.append(f'<linearGradient id="{gid2}" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="{tint(cc2,0.86)}"/><stop offset="100%" stop-color="{tint(cc2,0.58)}"/></linearGradient>')
        svg.append(f'<rect x="{cx2}" y="{y}" width="{MC}" height="{ST_BLOCK}" rx="7" fill="url(#{gid2})"/>')
        fx2 = cx2+MC-7 if ci==0 else cx2
        svg.append(f'<rect x="{fx2}" y="{y}" width="7" height="{ST_BLOCK}" fill="url(#{gid2})"/>')
        if lg2: svg.append(f'<image x="{cx2+4}" y="{y+4}" width="{MC-8}" height="{ST_BLOCK-8}" href="{lg2}"/>')
    svg.append(f'<line x1="{x+MC}" y1="{y+mh}" x2="{x+w-MC}" y2="{y+mh}" stroke="#FFFFFF" stroke-opacity="0.5"/>')
    smid = x+w/2
    for si,(side2, ink2) in enumerate(((g["a"],sia),(g["h"],sih))):
        cy2 = y+mh*(si+0.5)
        rk = rank_of(side2) if ranks else None
        lbl = ("" if si==0 else "@ ") + (f"{rk} " if rk else "") + side2["team"]
        fs3 = 13.5
        if tw_barlow(lbl, fs3) > w-2*MC-16: fs3 = max(9, (w-2*MC-16)/(len(lbl)*0.42))
        svg.append(f'<text x="{smid}" y="{cy2+fs3*0.34}" font-size="{fs3:.1f}" font-weight="700" font-family="{BC}" fill="{ink2}" text-anchor="middle">{E(lbl.upper())}</text>')
    sty = y+ST_BLOCK
    svg.append(f'<linearGradient id="stg{gkey(g)}" x1="0%" x2="100%"><stop offset="0%" stop-color="{ac}"/><stop offset="100%" stop-color="{hc}"/></linearGradient>')
    svg.append(f'<rect x="{x}" y="{sty}" width="{w}" height="1.8" fill="url(#stg{gkey(g)})"/>')
    fsp = 9.5; avail = w-20 - (tw_inter(tray_right, 8.5)+14 if tray_right else 0)
    if tw_inter(tray_text, fsp) > avail: fsp = max(7.5, avail/(len(tray_text)*0.55))
    svg.append(f'<text x="{x+11}" y="{sty+ST_TRAY/2+3.5}" font-size="{fsp:.1f}" font-weight="700" fill="#E8EAEC">{E(tray_text)}</text>')
    if tray_right:
        svg.append(f'<text x="{x+w-10}" y="{sty+ST_TRAY/2+3.5}" font-size="8.5" fill="#848C93" text-anchor="end">{E(tray_right)}</text>')

def tray_parts(g):
    """Secondary tray items in display-priority order: spread/O-U, rivalry, records, weather."""
    parts = []
    mock = MOCK_TRAY.get((g["a"]["team"], g["h"]["team"]))
    if mock: parts += [mock[1], mock[0]] + ([mock[2]] if mock[2] else [])
    ln = LINES.get(g["id"])
    if ln and ln.get("display"): parts.append(ln["display"])
    rv = rivalry_of(g)
    if rv: parts.append(rv[0])
    ra_, rh_ = record_of(g["a"]), record_of(g["h"])
    if STYLE["records"] == "tray" and ra_ and rh_ and not (ra_["display"]=="0-0" and rh_["display"]=="0-0"):
        parts.append(f"{abbr(g['a']['id'], g['a']['team'])} {ra_['display']} · {abbr(g['h']['id'], g['h']['team'])} {rh_['display']}")
    wx = WEATHER.get(g["id"])
    if STYLE["weather"] == "on" and wx and wx.get("display"): parts.append(wx["display"])
    return parts

def tray_secondary(g):
    """Right-aligned muted tray text: spread/O-U · records · weather · rivalry (contract §3)."""
    parts = []
    mock = MOCK_TRAY.get((g["a"]["team"], g["h"]["team"]))
    if mock:
        parts += [mock[0], mock[1]] + ([mock[2]] if mock[2] else [])
    ln = LINES.get(g["id"])
    if ln and ln.get("display"): parts.append(ln["display"])
    ra_, rh_ = record_of(g["a"]), record_of(g["h"])
    if ra_ and rh_ and not (ra_["display"]=="0-0" and rh_["display"]=="0-0"):
        parts.append(f"{abbr(g['a']['id'], g['a']['team'])} {ra_['display']} · {abbr(g['h']['id'], g['h']['team'])} {rh_['display']}")
    wx = WEATHER.get(g["id"])
    if wx and wx.get("display"): parts.append(wx["display"])
    rv = rivalry_of(g)
    if rv: parts.append(rv[0])
    return " · ".join(parts)

def draw_card(g, x, y, w, lh, prim_text=None):
    """The one game card (contract §3). Used for linear rows, streaming rows and the TBD section —
    v1.3: every game renders at the same size (Joe, 2026-08-31)."""
    cx0, cy0 = x+1, y+4                      # card origin
    half = BLOCK_H/2
    (ba, ia), (bh2, ih) = legible(ac), legible(hc)
    ra, rh_ = rank_of(g["a"]), rank_of(g["h"])
    rv = rivalry_of(g)
    big = bool(ra and rh_) or bool(rv and rv[1] == 1) or bool(MOCK_TRAY.get((g["a"]["team"], g["h"]["team"])) and "Showdown" in (MOCK_TRAY[(g["a"]["team"], g["h"]["team"])][2] or ""))
    SIL, TRAY, MARQ = STYLE["silhouette"], STYLE["tray"], STYLE["marquee"]
    CARD_H = BLOCK_H + TRAY_H
    # --- marquee back-layer (behind the card) -------------------------------------
    lane_clip = f"lane{int(y)}"
    if big and MARQ == "halo" and f'id="{lane_clip}"' not in "".join(svg[-40:]):
        svg.append(f'<clipPath id="{lane_clip}"><rect x="0" y="{y+1}" width="{W}" height="{lh-2}"/></clipPath>')
    if big:
        if MARQ == "sunburst":
            svg.append(f'<ellipse cx="{cx0+w/2}" cy="{cy0+CARD_H/2}" rx="{w/2+42}" ry="{CARD_H/2+34}" fill="url(#sunburst)"/>')
        elif MARQ == "halo":   # gold wash on the row background, extending past both ends of the card
            svg.append(f'<g clip-path="url(#{lane_clip})"><ellipse cx="{cx0+w/2}" cy="{cy0+CARD_H/2}" rx="{w/2+95}" ry="{lh*0.85}" fill="url(#halo)"/></g>')
    # --- card plate ---------------------------------------------------------------
    if big:
        grp_f = 'url(#glow)' if MARQ == "sunburst" else ('url(#soft)' if MARQ == "tag" else 'url(#glow1)')
    else:
        grp_f = 'url(#softer)' if SIL == "quiet" else 'url(#soft)'
    plate = "#3A3218" if (big and MARQ == "plate") else "#23282E"
    svg.append(f'<g filter="{grp_f}"><rect x="{cx0}" y="{cy0}" width="{w}" height="{CARD_H}" rx="9" fill="{plate}"/></g>')
    ins = 3 if SIL == "bezel" else 0          # bezel: bands sit inside a charcoal frame
    bx, bw, by = cx0+ins, w-2*ins, cy0+ins
    bh_top = half - ins
    svg.append(f'<rect x="{bx}" y="{by}" width="{bw}" height="{bh_top}" rx="{9-ins}" fill="{ba}"/><rect x="{bx}" y="{by+bh_top*0.5}" width="{bw}" height="{bh_top*0.5}" fill="{ba}"/>')
    svg.append(f'<rect x="{bx}" y="{cy0+half}" width="{bw}" height="{half-ins}" fill="{bh2}"/>')
    CAP = BLOCK_H - ins  # endcap width
    la, lhm = logo_uri(g["a"]["id"]), logo_uri(g["h"]["id"])
    for cap_i,(cx, cc, lg) in enumerate(((bx, ac, la), (bx+bw-CAP, hc, lhm))):
        gid = f"cap{gkey(g)}_{cap_i}"
        svg.append(f'<linearGradient id="{gid}" x1="0%" y1="0%" x2="0%" y2="100%">'
                   f'<stop offset="0%" stop-color="{tint(cc,0.86)}"/>'
                   f'<stop offset="100%" stop-color="{tint(cc,0.58)}"/></linearGradient>')
        fill = f"url(#{gid})"
        cap_h = BLOCK_H - 2*ins
        inner = f'<rect x="{cx+CAP-8}" y="{by}" width="8" height="{cap_h}" fill="{fill}"/>' if cap_i==0 else f'<rect x="{cx}" y="{by}" width="8" height="{cap_h}" fill="{fill}"/>'
        svg.append(f'<rect x="{cx}" y="{by}" width="{CAP}" height="{cap_h}" rx="{8-ins}" fill="{fill}"/>{inner}')
        sep_x = cx+CAP if cap_i==0 else cx
        svg.append(f'<line x1="{sep_x}" y1="{by}" x2="{sep_x}" y2="{by+cap_h}" stroke="#FFFFFF" stroke-opacity="0.55"/>')
        if lg: svg.append(f'<image x="{cx+7}" y="{by+7}" width="{CAP-14}" height="{cap_h-14}" href="{lg}"/>')
    svg.append(f'<line x1="{bx+CAP}" y1="{cy0+half}" x2="{bx+bw-CAP}" y2="{cy0+half}" stroke="#FFFFFF" stroke-opacity="0.7"/>')
    span_l, span_r = bx+CAP+10, bx+bw-CAP-10
    mid = (span_l+span_r)/2
    for i,(side,ink,rk) in enumerate(((g["a"],ia,ra),(g["h"],ih,rh_))):
        cy = cy0+half*(i+0.5)
        label = (("" if i==0 else "@ ") + (f"{rk} " if rk else "") + side["team"]).upper()
        rec = record_label(g, side) if STYLE["records"] == "name" else None
        rec = rec.upper() if rec else None
        fs = 26; span = span_r-span_l; GAP_R = 0.32
        def parts_w(fs, rec):
            nw = tw_barlow(label, fs); rw = tw_barlow(rec, fs*0.6) if rec else 0
            return nw, rw, nw + ((fs*GAP_R + rw) if rec else 0)
        nw, rw, total = parts_w(fs, rec)
        if rec and total > span:
            fs = max(18, fs*span/total)                        # shrink a little to keep the record...
            nw, rw, total = parts_w(fs, rec)
            if total > span: rec = None; fs = 26; nw, rw, total = parts_w(fs, rec)   # ...then drop it
        if total > span: fs = max(14, fs*span/total); nw, rw, total = parts_w(fs, rec)
        x0 = mid - total/2            # centering uses the measured width; adjacency is left to the renderer
        run = f'<tspan font-size="{fs*0.6:.1f}" fill-opacity="0.82" dx="{fs*GAP_R:.1f}">{E(rec)}</tspan>' if rec else ""
        svg.append(f'<text x="{x0:.1f}" y="{cy+fs*0.34:.1f}" font-size="{fs:.1f}" font-weight="700" font-family="{BC}" fill="{ink}">{E(label)}{run}</text>')
    # --- tray ---------------------------------------------------------------------
    ty = cy0+BLOCK_H
    seam_fill = "#F0C850" if (big and MARQ in ("tag", "plate")) else f"url(#tg{gkey(g)})"
    SEC_INK = "#F0C850" if (big and MARQ == "plate") else "#B4BAC0"   # v1.2: lighter than #848C93, still below the primary
    svg.append(f'<linearGradient id="tg{gkey(g)}" x1="0%" x2="100%"><stop offset="0%" stop-color="{ac}"/><stop offset="100%" stop-color="{hc}"/></linearGradient>')
    svg.append(f'<rect x="{bx}" y="{ty-ins}" width="{bw}" height="2.5" fill="{seam_fill}"/>')
    v = VENUES.get(g["id"]) or g.get("venue")
    prim = prim_text if prim_text is not None else clock(g["dt"]) + (f" · {v}" if v else "")
    line_h = TRAY_H                            # tray line height
    seam = 2.5; ty_c = ty + seam + (TRAY_H - seam)/2   # content centerline, below the seam
    fp = 12.5
    if tw_inter(prim, fp) > w*0.45: fp = max(9.5, (w*0.45)/(len(prim)*0.55))
    svg.append(f'<text x="{x+15}" y="{ty_c+4.5}" font-size="{fp:.1f}" font-weight="700" fill="#F2F3F4">{E(prim)}</text>')
    def draw_chips(chx, right_edge=None):
        """streamer micro-chips; returns x after the last chip. right_edge → right-aligned."""
        items = []
        for b in g.get("badges", []):
            derived = b.endswith("*"); bname = b.rstrip("*"); nl2 = net_logo(bname, chip=True)
            if nl2:
                uri2, asp2, suf2 = nl2; lh3 = CHIP_H; lw3 = min(asp2*lh3, 64 if CHIP_H == 14 else 84)
                sufw2 = (9 if suf2=="+" else 7*len(suf2)+3) if suf2 else 0
                items.append(("img", lw3 + 12 + sufw2 + (14 if derived else 10), uri2, lw3, suf2, derived))
            else:
                items.append(("txt", len(b)*6 + 10, b, 0, "", derived))
        if right_edge is not None: chx = right_edge - sum(it[1] for it in items)
        start_x = chx
        for kind, adv, a1, lw3, suf2, derived in items:
            if kind == "img":
                chw = adv - (14 if derived else 10)
                th = CHIP_H + 5
                if STYLE["chipbg"] == "tile":
                    svg.append(f'<rect x="{chx}" y="{ty_c-th/2}" width="{chw}" height="{th}" rx="4" fill="#31363D"/>')
                elif STYLE["chipbg"] == "light":
                    svg.append(f'<rect x="{chx}" y="{ty_c-th/2}" width="{chw}" height="{th}" rx="4" fill="#3A4048" stroke="#FFFFFF" stroke-opacity="0.14"/>')
                if a1.startswith("svg:"):
                    svg.append(a1[4:].replace("__X__", f"{chx+6}").replace("__Y__", f"{ty_c-CHIP_H/2}").replace("__W__", f"{lw3}").replace("__H__", f"{CHIP_H}"))
                else:
                    svg.append(f'<image x="{chx+6}" y="{ty_c-CHIP_H/2}" width="{lw3}" height="{CHIP_H}" href="{a1}" preserveAspectRatio="xMidYMid meet"/>')
                if suf2: svg.append(f'<text x="{chx+6+lw3+1}" y="{ty_c+4}" font-size="{11 if suf2=="+" else 8}" font-weight="700" fill="#F2F3F4">{E(suf2)}</text>')
                if derived: svg.append(f'<text x="{chx+chw+2}" y="{ty_c-4}" font-size="9" fill="#848C93">*</text>')
            else:
                svg.append(f'<text x="{chx}" y="{ty_c+4.5}" font-size="10" fill="#CFD4D9">{E(a1)}</text>')
            chx += adv
        return start_x if right_edge is not None else chx
    sec_parts = tray_parts(g)               # ordered by display priority (spread first)
    def fit_parts(parts, fs, avail):
        parts = list(parts)
        while parts and tw_inter(" · ".join(parts), fs)*0.95 > avail: parts = parts[:-1]
        return parts
    if TRAY == "single":                    # v1.2: kickoff · venue → chips → secondary right
        chx = draw_chips(x + 15 + len(prim)*fp*0.56 + 12)
        fs2 = 10; avail = w - (chx - x) - 30; full = list(sec_parts)
        sec_parts = fit_parts(sec_parts, fs2, avail)
        if len(sec_parts) < len(full): DROP_LOG.append((f'{g["a"]["team"]} @ {g["h"]["team"]} ({g["end_min"]}m)', full[len(sec_parts):]))
        if sec_parts:
            svg.append(f'<text x="{cx0+w-14}" y="{ty_c+4.5}" font-size="{fs2}" font-weight="600" fill="{SEC_INK}" text-anchor="end">{E(" · ".join(sec_parts))}</text>')
    elif TRAY == "cells":                   # option 1: segmented cells with hairline dividers
        # cells: kickoff | venue | chips | (flex) | secondary
        kick = clock(g["dt"]) if prim_text is None else prim
        ven = v if (prim_text is None and v) else None
        cxp = x + 15
        svg.pop()                            # replace the combined primary text drawn above
        svg.append(f'<text x="{cxp}" y="{ty_c+5}" font-size="12.5" font-weight="700" fill="#F2F3F4">{E(kick)}</text>')
        cxp += tw("inter-bold", kick, 12.5, 0.6) + 12
        def divider(xx): svg.append(f'<line x1="{xx}" y1="{ty+6}" x2="{xx}" y2="{ty+line_h-6}" stroke="#FFFFFF" stroke-opacity="0.16"/>')
        if ven:
            divider(cxp); cxp += 12
            fv = 11.5
            if tw_inter(ven, fv) > w*0.38: fv = max(9.5, w*0.38/(len(ven)*0.55))
            svg.append(f'<text x="{cxp}" y="{ty_c+4.5}" font-size="{fv:.1f}" font-weight="500" fill="#C9CED3">{E(ven)}</text>')
            cxp += tw_inter(ven, fv) + 12
        if g.get("badges"):
            divider(cxp); cxp = draw_chips(cxp + 12)
        fs2 = 10.5; avail = w - (cxp - x) - 40
        sec_parts = fit_parts(sec_parts, fs2, avail)
        if sec_parts:
            sec = " · ".join(sec_parts); sw = tw_inter(sec, fs2)
            divider(cx0 + w - 14 - sw - 12)
            svg.append(f'<text x="{cx0+w-14}" y="{ty_c+4.5}" font-size="{fs2}" font-weight="600" fill="{SEC_INK}" text-anchor="end">{E(sec)}</text>')
    elif TRAY == "chipsright":              # option 2: kickoff · venue | secondary … chips pinned right
        chip_left = draw_chips(0, right_edge=cx0+w-12) if g.get("badges") else cx0+w-12
        sec_x = x + 15 + tw("inter-bold", prim, fp, 0.6) + 16
        fs2 = 10.5; avail = chip_left - 14 - sec_x
        sec_parts = fit_parts(sec_parts, fs2, avail)
        if sec_parts:
            svg.append(f'<line x1="{sec_x-8}" y1="{ty+6}" x2="{sec_x-8}" y2="{ty+line_h-6}" stroke="#FFFFFF" stroke-opacity="0.16"/>')
            svg.append(f'<text x="{sec_x}" y="{ty_c+4.5}" font-size="{fs2}" font-weight="600" fill="{SEC_INK}">{E(" · ".join(sec_parts))}</text>')
    elif TRAY == "pills":                   # v1.3 tray: kickoff · venue … [rivalry] [O/U] [fav-logo spread] [chips]
        ln = LINES.get(g["id"]); toks = []
        if ln and ln.get("spread") is not None:
            fav = g["h"] if ln["spread"] < 0 else g["a"]
            toks.append(("spread", f"{-abs(ln['spread']):g}", fav))
        if ln and ln.get("overUnder") is not None: toks.append(("ou", f"O/U {ln['overUnder']:g}", None))
        rv = rivalry_of(g)
        if rv: toks.append(("riv", rv[0], None))
        right = cx0 + w - 10
        chips_left = draw_chips(0, right_edge=right) if g.get("badges") else right + 8
        right = chips_left - 8
        fs2 = 10 if TRAY_H < 28 else 11; ph = CHIP_H + 3; drawn = []; left_limit = x + 15 + tw("inter-bold", prim, fp, 0.6) + 14
        for kind, txt, fav in toks:
            tw_ = tw_inter(txt, fs2) + 12 + ((ph+4) if fav else 0)
            if right - sum(d[1]+6 for d in drawn) - tw_ < left_limit: break
            drawn.append(((kind, txt, fav), tw_))
        px_ = right
        for (kind, txt, fav), tw_ in drawn:
            px_ -= tw_
            gold = kind == "riv"
            plate_c = "#3A3218" if gold else ("#4A4020" if (big and MARQ == "plate") else "#2E333A")
            svg.append(f'<rect x="{px_}" y="{ty_c-ph/2}" width="{tw_}" height="{ph}" rx="3.5" fill="{plate_c}" stroke="{"#F0C850" if gold else "#FFFFFF"}" stroke-opacity="{0.9 if gold else 0.16}"/>')
            tx = px_ + 6
            if fav:
                lg = logo_uri(fav["id"]); fc = color(fav["id"]); r_ = (ph-1)/2; li = ph-3
                if STYLE["favlogo"] == "disc":     # light team-tinted disc behind the logo (the endcap idea, miniature)
                    did = f"fd{gkey(g)}{kind}"
                    svg.append(f'<linearGradient id="{did}" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="{tint(fc,0.86)}"/><stop offset="100%" stop-color="{tint(fc,0.58)}"/></linearGradient>')
                    svg.append(f'<circle cx="{tx+r_}" cy="{ty_c}" r="{r_}" fill="url(#{did})"/>')
                if lg:
                    href = logo_uri_light(fav["id"]) if STYLE["favlogo"] == "invert" else lg
                    svg.append(f'<image x="{tx+r_-li/2}" y="{ty_c-li/2}" width="{li}" height="{li}" href="{href}" preserveAspectRatio="xMidYMid meet"/>')
                tx += ph + 4
            svg.append(f'<text x="{tx}" y="{ty_c+fs2*0.36}" font-size="{fs2}" font-weight="600" fill="{"#F0C850" if gold else SEC_INK}">{E(txt)}</text>')
            px_ -= 6
    # --- outline (top layer) --------------------------------------------------------
    if big:
        svg.append(f'<rect x="{cx0}" y="{cy0}" width="{w}" height="{CARD_H}" rx="9" fill="none" stroke="#F0C850" stroke-width="3.5"/>')
    elif SIL == "outline":
        svg.append(f'<rect x="{cx0}" y="{cy0}" width="{w}" height="{CARD_H}" rx="9" fill="none" stroke="#FFFFFF" stroke-opacity="0.55" stroke-width="2.5"/>')
    elif SIL == "bezel":
        svg.append(f'<rect x="{cx0-0.75}" y="{cy0-0.75}" width="{w+1.5}" height="{CARD_H+1.5}" rx="9.5" fill="none" stroke="#05070A" stroke-opacity="0.85" stroke-width="1.5"/>')
        svg.append(f'<rect x="{cx0+1}" y="{cy0+1}" width="{w-2}" height="{CARD_H-2}" rx="8" fill="none" stroke="#FFFFFF" stroke-opacity="0.22" stroke-width="1"/>')
    elif SIL == "quiet":
        svg.append(f'<rect x="{cx0}" y="{cy0}" width="{w}" height="{CARD_H}" rx="9" fill="none" stroke="#FFFFFF" stroke-opacity="0.28" stroke-width="1.5"/>')
    tag_x = bx+CAP+6
    if g.get("alt"):
        svg.append(f'<rect x="{tag_x}" y="{y+8}" width="38" height="16" rx="4" fill="#FFFFFF"/>')
        svg.append(f'<text x="{tag_x+19}" y="{y+20}" font-size="10" font-weight="700" fill="#33383c" text-anchor="middle">ALT</text>')
        tag_x += 44
    if big and MARQ in ("tag", "plate"):
        svg.append(f'<rect x="{tag_x}" y="{y+8}" width="64" height="16" rx="4" fill="#F0C850"/>')
        svg.append(f'<text x="{tag_x+32}" y="{y+20}" font-size="9.5" font-weight="700" fill="#2A2410" text-anchor="middle" letter-spacing="0.6">MARQUEE</text>')

# ----------------------------------------------------------------------------- network rows
y = PAD_T
for row in rows:
    lh = ROW_H
    rh = len(row["lanes"])*lh
    svg.append(f'<rect x="0" y="{y}" width="{LABEL_W}" height="{rh}" fill="#FFFFFF" fill-opacity="0.05"/>')
    nl = net_logo(row["name"], dark=True)
    station = STATIONS.get(row["name"]) if not row["stream"] else None
    tile_h = min(rh-6, 100)
    tile_y = y + (min(rh, ROW_H) - tile_h)/2          # tile centered on the first lane
    svg.append(f'<rect x="8" y="{tile_y}" width="{LABEL_W-16}" height="{tile_h}" rx="10" fill="url(#tile)"/>')
    band = 0
    if station:                                        # local affiliate call letters above the mark
        band = 13
        svg.append(f'<text x="{LABEL_W/2}" y="{tile_y+11.5}" font-size="10" font-weight="700" fill="#C9CED3" text-anchor="middle" letter-spacing="1.4">{E(f"{station[0]} {station[1]}")}</text>')
    ry = tile_y + band + (tile_h - band)/2             # logo center in the remaining region
    if nl:
        uri, asp, suf = nl
        max_h = tile_h - band - (10 if station else 14)
        sufw = (16 if suf=="+" else 11*len(suf)+8) if suf else 0
        lh2 = max_h; lw2 = asp*lh2
        if lw2 + sufw > LABEL_W-30:
            lw2 = LABEL_W-30-sufw; lh2 = lw2/asp
        cx0 = (LABEL_W - lw2 - sufw)/2
        if uri.startswith("svg:"):
            svg.append(uri[4:].replace("__X__", f"{cx0}").replace("__Y__", f"{ry-lh2/2}").replace("__W__", f"{lw2}").replace("__H__", f"{lh2}"))
        else:
            svg.append(f'<image x="{cx0}" y="{ry-lh2/2}" width="{lw2}" height="{lh2}" href="{uri}" preserveAspectRatio="xMidYMid meet"/>')
        if suf: svg.append(f'<text x="{cx0+lw2+3}" y="{ry+7}" font-size="{19 if suf=="+" else 12}" font-weight="700" fill="#F2F3F4">{E(suf)}</text>')
    elif row["name"] in LOCAL_ROWS:                     # v1.5: synthesized local row — carrier not yet announced (spec §3.12)
        svg.append(f'<text x="{LABEL_W/2}" y="{ry}" font-size="15" font-weight="700" fill="#F2F3F4" text-anchor="middle" letter-spacing="0.6">{E(row["name"])}</text>')
        svg.append(f'<rect x="{LABEL_W/2-34}" y="{ry+8}" width="68" height="15" rx="3" fill="url(#tile)" stroke="#FFFFFF" stroke-opacity="0.35"/>')
        svg.append(f'<text x="{LABEL_W/2}" y="{ry+19}" font-size="8.5" font-weight="700" fill="#C9CED3" text-anchor="middle" letter-spacing="1">{E(POLICY.get("local_row_label", "CARRIER TBA"))}</text>')
    else:
        svg.append(f'<text x="{LABEL_W/2}" y="{ry+6}" font-size="17" font-weight="700" fill="#F2F3F4" text-anchor="middle">{E(NET_ABBR.get(row["name"], row["name"]))}</text>')
    svg.append(f'<line x1="0" y1="{y}" x2="{W-PAD_X}" y2="{y}" stroke="#FFFFFF" stroke-opacity="0.24" stroke-width="1.5"/>')
    for lane in row["lanes"]:
        for g in lane:
            x = xof(g.get("rs") or g["dt"]); w = g["end_min"]*PX-4
            ac, hc = color(g["a"]["id"]), color(g["h"]["id"])
            draw_card(g, x, y, w, lh)
        y += lh
svg.append(f'<line x1="0" y1="{y}" x2="{W-PAD_X}" y2="{y}" stroke="#FFFFFF" stroke-opacity="0.24" stroke-width="1.5"/>')

# ----------------------------------------------------------------------------- TBD section (§11.6)
if tbd_groups:
    y += 30
    svg.append(f'<text x="{PAD_X}" y="{y+8}" font-size="22" font-weight="700" font-family="{BC}" fill="#F2F3F4">{E(f"KICKOFF OR NETWORK TBA — {len(tbd)} GAMES")}</text>')
    svg.append(f'<text x="{PAD_X}" y="{y+28}" font-size="12" fill="#9aa2a8">date confirmed by {E(DATA_LABEL)} · kickoff and/or television assignment not yet announced · a game moves onto the grid the day it is assigned</text>')
    y += TBD_HEAD
    for key, lbl, gs in tbd_groups:
        svg.append(f'<text x="{PAD_X}" y="{y+12}" font-size="11.5" font-weight="600" fill="#9aa2a8" letter-spacing="0.6">{E(lbl)} · {len(gs)}</text>')
        svg.append(f'<line x1="{PAD_X+tw_inter(lbl,11.5)+34}" y1="{y+8}" x2="{W-PAD_X}" y2="{y+8}" stroke="#FFFFFF" stroke-opacity="0.12"/>')
        y += TBD_GROUP_HEAD
        for i, g in enumerate(gs):
            cx = PAD_X + (i % TBD_COLS)*(TBD_CARD_W+TBD_GAP)
            cy = y + (i // TBD_COLS)*TBD_ROW
            nets = [o for o in g["outlets"]]
            if key == "network_tbd":
                txt = clock(g["dt"]) + " · TV TBA"
            elif key == "time_tbd":
                txt = "KICKOFF TBA · " + " / ".join(nets) + (" (not carried)" if all(n in UNAVAILABLE for n in nets) else "")
            else:
                txt = "KICKOFF AND TV TBA"
            draw_card(g, cx-1, cy-4, TBD_CARD_W, TBD_ROW, prim_text=txt)
        y += math.ceil(len(gs)/TBD_COLS)*TBD_ROW + 12

# ----------------------------------------------------------------------------- Around the League strip (v1.6, contract §11.8)
if ATL:
    y += 26
    mk_name = str(FX_META.get("market", "Cleveland")).split(" (")[0]
    svg.append(f'<text x="{PAD_X}" y="{y+8}" font-size="18" font-weight="700" font-family="{BC}" fill="#9aa2a8" letter-spacing="0.4">{E(f"AROUND THE LEAGUE — {len(ATL)} GAMES NOT RECEIVED IN {mk_name.upper()}")}</text>')
    svg.append(f'<text x="{PAD_X}" y="{y+26}" font-size="11" fill="#6F767D">every game the league scheduled today is listed · the reason is a stated fact from the adapter, never a guess · expandable in the web app</text>')
    svg.append(f'<line x1="{PAD_X}" y1="{y+34}" x2="{W-PAD_X}" y2="{y+34}" stroke="#FFFFFF" stroke-opacity="0.10"/>')
    y += ATL_HEAD
    col_time, col_game, col_outlet = PAD_X, PAD_X + 72, PAD_X + 72 + 300
    for g in ATL:
        outs = " / ".join(o for o in g["outlets"]) or "no U.S. telecast listed"
        svg.append(f'<text x="{col_time}" y="{y+12}" font-size="11" font-weight="600" fill="#848C93">{E(clock(g["dt"]))}</text>')
        svg.append(f'<text x="{col_game}" y="{y+12}" font-size="11.5" font-weight="600" fill="#B4BAC0">{E(g["a"]["team"] + " @ " + g["h"]["team"])}</text>')
        svg.append(f'<text x="{col_outlet}" y="{y+12}" font-size="11" fill="#848C93">{E(outs)}</text>')
        svg.append(f'<text x="{W-PAD_X}" y="{y+12}" font-size="10.5" fill="#6F767D" text-anchor="end">{E(g.get("reason", "not on your services"))}</text>')
        y += ATL_LINE
    y += 14

# ----------------------------------------------------------------------------- footer (v1.4 status bar)
y += 10
fx = PAD_X
def foot_pill(txt, ink="#C9CED3", plate="#2E333A", stroke_o=0.16, glyph=None):
    global fx
    fs_ = 10.5; tw_ = tw_inter(txt, fs_)*1.02 + 16 + (16 if glyph else 0)
    svg.append(f'<rect x="{fx}" y="{y}" width="{tw_:.1f}" height="20" rx="4" fill="{plate}" stroke="#FFFFFF" stroke-opacity="{stroke_o}"/>')
    tx = fx + 8
    if glyph == "tba":
        svg.append(f'<rect x="{tx}" y="{y+4}" width="12" height="12" rx="2.5" fill="url(#tile)" stroke="#FFFFFF" stroke-opacity="0.35"/>'); tx += 16
    elif glyph == "omit":
        svg.append(f'<rect x="{tx}" y="{y+4}" width="12" height="12" rx="2.5" fill="url(#tile)" stroke="#848C93" stroke-opacity="0.6"/><line x1="{tx+2.5}" y1="{y+13.5}" x2="{tx+9.5}" y2="{y+6.5}" stroke="#848C93" stroke-width="1.4"/>'); tx += 16
    svg.append(f'<text x="{tx}" y="{y+14}" font-size="{fs_}" font-weight="600" fill="{ink}">{E(txt)}</text>')
    fx += tw_ + 8
foot_pill(f"{len(day)} ON THE GRID", ink="#F2F3F4")
if tbd: foot_pill(f"{len(tbd)} KICKOFF / NETWORK TBA", glyph="tba")
if omitted and not PRO:
    outs = sorted({o for g in omitted for o in g["outlets"]})
    foot_pill(f"{len(omitted)} NOT ON YOUR SERVICES · {', '.join(outs)}", ink="#9aa2a8", glyph="omit")
elif omitted:   # v1.6 pro leagues: the strip above carries the reasons; the pill is the count
    foot_pill(f"{len(omitted)} AROUND THE LEAGUE · LISTED ABOVE", ink="#9aa2a8", glyph="omit")
svg.append(f'<text x="{fx+6}" y="{y+14}" font-size="10.5" fill="#6F767D">every game is kept in the database — nothing is deleted · {E(sub.split(" · data: ")[1]) if " · data: " in sub else ""}</text>')
svg.append('</svg>')

# ----------------------------------------------------------------------------- output
out_dir = Path(ARGS.out); out_dir.mkdir(parents=True, exist_ok=True)
svg_path = out_dir / f"grid_{TARGET}.svg"
svg_path.write_text("\n".join(svg), encoding="utf-8")
# v1.6.1 sidecar: the counts this run actually produced, so scripts/register_grids.py can archive a grid
# without re-deriving them from the SVG. Truthful by construction - same variables the console line prints.
GENERATOR_VERSION = "v1.6.5"
meta_path = out_dir / f"grid_{TARGET}.meta.json"
meta_path.write_text(json.dumps({
    "sport": SPORT, "date": TARGET,
    "season": YR, "week": (WEEK_LABEL if SPORT == "cfb" else FX_META.get("week")),
    "gamesOnGrid": len(day), "gamesTbd": len(tbd), "gamesOmitted": len(omitted),
    "generatorVersion": GENERATOR_VERSION,
}, indent=2) + chr(10), encoding="utf-8")
for gname, dropped in DROP_LOG: print(f"  tray drop: {gname}: {dropped}")
print(f"{GENERATOR_VERSION} [{SPORT}]: {len(day)} on grid · {len(tbd)} TBA · {len(omitted)} omitted · {SPLIT_HITS} split/{GUARD_HITS} guarded · {W:.0f}x{H:.0f} -> {svg_path}"
      + (" · enrichment loaded" if ENR else " · NO enrichment") + (" · MOCK" if USE_MOCK else ""))
if ARGS.png or ARGS.export:
    try:
        import cairosvg
        if ARGS.png:
            png_path = out_dir / f"grid_{TARGET}.png"
            cairosvg.svg2png(url=str(svg_path), write_to=str(png_path), scale=ARGS.scale)
            print(f"PNG @{ARGS.scale:g}x -> {png_path}")
        if ARGS.export:
            png_path = out_dir / f"grid_{TARGET}@2x.png"
            cairosvg.svg2png(url=str(svg_path), write_to=str(png_path), scale=EXPORT_SCALE)
            print(f"PNG @{EXPORT_SCALE:g}x -> {png_path} ({W*EXPORT_SCALE:.0f}x{H*EXPORT_SCALE:.0f})")
    except ImportError:
        print("cairosvg not installed; SVG only (pip install cairosvg)")
