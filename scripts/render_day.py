#!/usr/bin/env python3
"""MySports — day grid renderer, design v1.1 (Phase 3B).

Renders one calendar day of college football as SVG (canonical) and optionally PNG,
from the CFBD validation fixture + enrichment probe + cached assets. Run from the repo root:

    python scripts/render_day.py --week 1 --date 2026-09-05 --png
    python scripts/render_day.py --week 8 --date 2026-10-24 --png      # TBD-state fixture
    python scripts/render_day.py --week 1 --date 2026-09-05 --export   # 2x PNG for download

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
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from pathlib import Path
from PIL import Image as _Img

ap = argparse.ArgumentParser()
ap.add_argument("--date", default="2026-09-05")
ap.add_argument("--week", type=int, default=1, help="fixture week; sets the default input paths")
ap.add_argument("--fixture")
ap.add_argument("--games-raw")
ap.add_argument("--enrichment")
ap.add_argument("--teams", default="artifacts/validation/cfbd_2026_teams.json")
ap.add_argument("--rivalries", default="data/rivalries.json")
ap.add_argument("--logos", default="assets/logos")
ap.add_argument("--network-logos", default="assets/network-logos")
ap.add_argument("--out", default="artifacts/rendering")
ap.add_argument("--png", action="store_true", help="also rasterize PNG via cairosvg at --scale")
ap.add_argument("--export", action="store_true", help="also rasterize the download PNG at EXPORT_SCALE (@2x)")
ap.add_argument("--scale", type=float, default=1.0)
ap.add_argument("--mock", action="store_true", help="layout-only MOCK ranks/tray when no enrichment exists")
ap.add_argument("--style", action="append", default=[], metavar="KEY=VALUE",
                help="design variant override (silhouette=outline|bezel|quiet, tray=single|twoline|priority|tokens, marquee=sunburst|halo|tag|plate, weather=on|off, records=name|tray)")
ARGS = ap.parse_args()
STYLE = {"silhouette": "outline", "tray": "single", "marquee": "plate", "weather": "off", "records": "name"}   # v1.1 defaults (Joe, 2026-08-31)
DROP_LOG = []   # (game, dropped items) — reported at the end so density decisions rest on counts, not impressions
for kv in ARGS.style:
    k, _, v = kv.partition("="); STYLE[k.strip()] = v.strip()
TARGET = ARGS.date
WK = ARGS.week
ARGS.fixture = ARGS.fixture or f"artifacts/validation/cfbd_2026_week{WK}_fixture.json"
ARGS.games_raw = ARGS.games_raw or f"artifacts/validation/cfbd_2026_week{WK}_games.json"
ARGS.enrichment = ARGS.enrichment or f"artifacts/validation/cfbd_2026_week{WK}_enrichment.json"
CAP_STYLE = "gradient"  # contract: gradient endcaps (solid rejected 2026-08-31)
EXPORT_SCALE = 2.0      # contract §8: download PNG is @2x of the SVG coordinate space
ET = ZoneInfo("America/New_York")

_raw = json.load(open(ARGS.games_raw, encoding="utf-8")) if Path(ARGS.games_raw).exists() else []
VENUES = {str(g["id"]): g.get("venue") for g in _raw if g.get("venue")}
ALIASES = {"CW":"The CW","The CW Network":"The CW","USA Net":"USA Network","BTN":"Big Ten Network",
           "ESPN Unlmtd":"ESPN Unlimited","CBSSN":"CBS Sports Network","SECN+":"SEC Network+"}
UNAVAILABLE = {"CBS Sports Network","FS2","MW+","UConn+"}
SIMULCAST = {"CBS":"Paramount+","NBC":"Peacock","TNT":"HBO Max","ESPN":"Disney+","ABC":"Disney+"}
_RO_PATH = Path("data/row_order.json")
if _RO_PATH.exists():
    _ro = json.load(open(_RO_PATH, encoding="utf-8"))["cfb"]
    ROW_ORDER = [b["network"] for b in _ro["broadcast"]] + _ro["cable"] + _ro["conference"]
    STATIONS = {b["network"]: (b.get("station"), b.get("channel")) for b in _ro["broadcast"] if b.get("station")}
    _STREAMS_FROM_FILE = _ro["streaming"]
else:  # fallback = spec §11.3 order
    ROW_ORDER = ["ABC","CBS","FOX","NBC","The CW","ESPN","ESPN2","ESPNU","FS1","TNT","USA Network",
                 "Big Ten Network","ACC Network","SEC Network"]
    STATIONS = {}; _STREAMS_FROM_FILE = None
NET_ABBR = {"ABC":"abc","CBS":"CBS","FOX":"FOX","NBC":"NBC","The CW":"CW","ESPN":"ESPN","ESPN2":"ESPN2",
            "ESPNU":"ESPNU","FS1":"FS1","TNT":"TNT","USA Network":"USA","Big Ten Network":"BTN",
            "ACC Network":"ACCN","SEC Network":"SECN","ESPN+":"ESPN+","ESPN Unlimited":"ESPN UNL",
            "SEC Network+":"SECN+","Peacock":"PCOCK","HBO Max":"MAX"}
STREAMS = _STREAMS_FROM_FILE or ["ESPN+","ESPN Unlimited","SEC Network+","Peacock","HBO Max"]
GAME_MIN = 210

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
NET_SUFFIX = {"espn-plus":"+","espn-unlimited":"UNL","sec-network-plus":"+"}
NLOGO = {}
def net_logo(name, dark=False, chip=False):
    slug = NET_SLUG.get(name)
    if not slug: return None
    key = (slug, dark, chip)
    if key not in NLOGO:
        p = Path(ARGS.network_logos) / f"{slug}.png"
        if p.exists():
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
        if p.exists():
            im = _Img.open(p).convert("RGBA"); im.thumbnail((64,64))
            buf = io.BytesIO(); im.save(buf, "PNG")
            LOGO[tid] = "data:image/png;base64,"+base64.b64encode(buf.getvalue()).decode()
        else: LOGO[tid] = None
    return LOGO[tid]

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
games = json.load(open(ARGS.fixture, encoding="utf-8"))["games"]
day, tbd, omitted = [], [], []   # grid games / TBD-section games / not-on-your-services
for g in games:
    dt = datetime.fromisoformat(g["startDate"].replace("Z","+00:00")).astimezone(ET)
    if dt.strftime("%Y-%m-%d") != TARGET: continue
    seen, tv, web = set(), [], []
    for m in g["media"]:
        o = ALIASES.get(m["outlet"], m["outlet"]); k = (m["mediaType"],o)
        if k in seen: continue
        seen.add(k); (tv if m["mediaType"]=="tv" else web).append(o)
    rec = {"id":str(g["id"]),"a":g["away"],"h":g["home"],"dt":dt,"alt":False,"end_min":GAME_MIN,
           "outlets": tv+web, "time_tbd": bool(g.get("startTimeTBD"))}
    primary = next((r for r in ROW_ORDER if r in tv), None) or next((w for w in web if w not in UNAVAILABLE), None)
    # §11.2 gating: a TBD kickoff never takes a grid position, whatever the media rows say.
    if rec["time_tbd"]:
        rec["state"] = "time_tbd" if (tv or web) else "time_and_network_tbd"; tbd.append(rec); continue
    if not tv and not web:
        rec["state"] = "network_tbd"; tbd.append(rec); continue
    if primary is None or primary in UNAVAILABLE:
        omitted.append(rec); continue
    badges = [w for w in web if w != primary and w not in UNAVAILABLE]
    if primary in SIMULCAST and SIMULCAST[primary] not in badges: badges.append(SIMULCAST[primary]+"*")
    rec.update({"primary":primary,"badges":badges}); day.append(rec)

for r in ROW_ORDER:
    gs = sorted([g for g in day if g["primary"]==r], key=lambda g: g["dt"])
    for i,g in enumerate(gs):
        nxt = next((h for h in gs[i+1:] if h["dt"]>g["dt"]), None)
        if nxt: g["end_min"] = min(GAME_MIN, int((nxt["dt"]-g["dt"]).total_seconds()/60))

def lanes(gs, use_end=True, mark=True):
    L = []
    for g in sorted(gs, key=lambda g: g["dt"]):
        for l in L:
            dur = l[-1]["end_min"] if use_end else GAME_MIN
            if (g["dt"]-l[-1]["dt"]).total_seconds()/60 >= dur: l.append(g); break
        else:
            if L and mark: g["alt"] = True
            L.append([g])
    return L

rows = [{"name":r,"lanes":lanes([g for g in day if g["primary"]==r]),"stream":False} for r in ROW_ORDER if any(g["primary"]==r for g in day)]
rows += [{"name":s,"lanes":lanes([g for g in day if g["primary"]==s],use_end=False,mark=False),"stream":True} for s in STREAMS if any(g["primary"]==s for g in day)]

# ----------------------------------------------------------------------------- geometry
PX = 3.2; LABEL_W = 150; PAD_T, PAD_B, PAD_X = 136, 48, 24
BLOCK_H, TRAY_H, GAP = 74, (36 if STYLE["tray"] == "twoline" else 24), 8
ROW_H = BLOCK_H + TRAY_H + GAP   # 106
ST_BLOCK, ST_TRAY = 36, 16
ST_H = ST_BLOCK + ST_TRAY + 6   # 58
# TBD section (contract §10): streaming-scale cards in a wrapping list below the grid
TBD_CARD_W, TBD_CARD_H, TBD_GAP = 320, ST_BLOCK + ST_TRAY, 14
TBD_ROW = TBD_CARD_H + 10
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
W = max(W, PAD_X*2 + 3*TBD_CARD_W + 2*TBD_GAP + LABEL_W)  # never narrower than the header + 3 TBD columns
GRID_H = sum(len(r["lanes"])*(ST_H if r["stream"] else ROW_H) for r in rows)

TBD_ORDER = [("network_tbd", "KICKOFF SET · NETWORK TBA"), ("time_tbd", "NETWORK SET · KICKOFF TBA"),
             ("time_and_network_tbd", "KICKOFF AND NETWORK TBA")]
tbd_groups = [(k, lbl, sorted([g for g in tbd if g["state"]==k], key=lambda g: (g["dt"] if k=="network_tbd" else datetime.min.replace(tzinfo=ET), g["h"].get("conference") or "", g["h"]["team"])))
              for k, lbl in TBD_ORDER]
tbd_groups = [t for t in tbd_groups if t[2]]
TBD_COLS = max(1, int((W - 2*PAD_X + TBD_GAP) // (TBD_CARD_W + TBD_GAP)))
TBD_H = 0
if tbd_groups:
    TBD_H = TBD_HEAD + sum(TBD_GROUP_HEAD + math.ceil(len(gs)/TBD_COLS)*TBD_ROW + 12 for _,_,gs in tbd_groups)
FOOT_H = 26
H = PAD_T + GRID_H + TBD_H + FOOT_H + PAD_B
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
WEEK_LABEL = week_label()
title = f"COLLEGE FOOTBALL WEEK {WEEK_LABEL} — " + datetime.strptime(TARGET,"%Y-%m-%d").strftime("%A, %B %-d, %Y").upper()
if USE_MOCK: rank_note = "ranks/spreads/records MOCK — layout only"
elif RANK_SOURCE: rank_note = f"{RANK_SOURCE} (wk {RANK_WEEK})"
else: rank_note = "no ranking snapshot in enrichment"
gen = datetime.now(ET).strftime("%b %-d, %Y %-I:%M %p ET")
sub = f"all times ET · {rank_note} · data: CFBD fixture week {WK}" + (f" + enrichment {ENR['generatedAt'][:10]}" if ENR else " · no enrichment file") + f" · rendered {gen}"

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
legend.append(("rank", (f"{RANK_SOURCE.upper()} · WEEK {RANK_WEEK}" if RANK_SOURCE and not USE_MOCK else ("RANKS: MOCK" if USE_MOCK else "RANKS: NONE LOADED"))))
legend.append(("gold", "MARQUEE · BOTH RANKED OR TIER-1 RIVALRY"))
legend.append(("star", "STREAMING SIMULCAST BY RULE"))
legend.append(("alt", "SECOND GAME, SAME NETWORK, SAME SLOT"))
if tbd_groups: legend.append(("tbd", f"{len(tbd)} KICKOFF/NETWORK TBA · LISTED BELOW GRID"))
if omitted: legend.append(("omit", f"{len(omitted)} NOT ON YOUR SERVICES · OMITTED"))
GLYPH_W = {"rank":22,"gold":30,"star":14,"alt":34,"tbd":34,"omit":22}
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
    svg.append(f'<text x="{lx+gw+8}" y="{ly+4}" font-size="{LEG_FS}" font-weight="600" fill="#9aa2a8" letter-spacing="0.3">{E(l)}</text>')

# ----------------------------------------------------------------------------- time grid
GRID_BOTTOM = PAD_T + GRID_H
for m in range(0, total, 30):
    if (m//30) % 2 == 0:
        svg.append(f'<rect x="{LABEL_W+m*PX}" y="{PAD_T-18}" width="{30*PX}" height="{GRID_H+18}" fill="#FFFFFF" fill-opacity="0.035"/>')
event_min = sorted({int((g["dt"]-t0).total_seconds()//60) for g in day} | {int((g["dt"]-t0).total_seconds()//60)+g["end_min"] for g in day})
kick_min = {int((g["dt"]-t0).total_seconds()//60) for g in day}
for m in range(0, total+1, 30):
    x = LABEL_W+m*PX
    svg.append(f'<line x1="{x}" y1="{PAD_T-18}" x2="{x}" y2="{GRID_BOTTOM}" stroke="#FFFFFF" stroke-opacity="{"0.10" if m % 60 == 0 else "0.045"}"/>')
AX_FS = 14; last_right = -1e9; last_was_end = False
for m in event_min:                       # kickoffs and block ends only (Joe, 2026-08-31)
    t = t0+timedelta(minutes=m); x = LABEL_W+m*PX
    lbl = t.strftime("%-I:%M %p"); wdt = tw("inter-bold", lbl, AX_FS, 0.6)
    if x - wdt/2 < last_right + 10:       # would collide with the previous label: kickoffs win over block ends
        if m in kick_min and last_was_end: svg.pop(); svg.pop()
        else: continue
    svg.append(f'<line x1="{x}" y1="{PAD_T-18}" x2="{x}" y2="{GRID_BOTTOM}" stroke="#FFFFFF" stroke-opacity="0.16"/>')
    svg.append(f'<text x="{x}" y="{PAD_T-25}" font-size="{AX_FS}" font-weight="700" fill="#E8EAEC" text-anchor="middle">{E(lbl)}</text>')
    last_right = x + wdt/2; last_was_end = m not in kick_min

# ----------------------------------------------------------------------------- shared card pieces
def mini_card(x, y, w, g, tray_text, tray_right=None, ranks=True):
    """Streaming-scale silhouette (contract §4) used by streaming rows and the TBD section."""
    ac, hc = color(g["a"]["id"]), color(g["h"]["id"])
    mh = ST_BLOCK/2; MC = ST_BLOCK
    (sba, sia), (sbh, sih) = legible(ac), legible(hc)
    svg.append(f'<g filter="url(#soft)"><rect x="{x}" y="{y}" width="{w}" height="{ST_BLOCK+ST_TRAY}" rx="7" fill="#23282E" stroke="#FFFFFF" stroke-opacity="0.42" stroke-width="1.5"/></g>')
    svg.append(f'<rect x="{x}" y="{y}" width="{w}" height="{mh}" rx="7" fill="{sba}"/><rect x="{x}" y="{y+mh*0.5}" width="{w}" height="{mh*0.5}" fill="{sba}"/>')
    svg.append(f'<rect x="{x}" y="{y+mh}" width="{w}" height="{mh}" fill="{sbh}"/>')
    for ci,(cx2, cc2, lg2) in enumerate(((x, ac, logo_uri(g["a"]["id"])), (x+w-MC, hc, logo_uri(g["h"]["id"])))):
        gid2 = f"scap{id(g)}_{ci}"
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
    svg.append(f'<linearGradient id="stg{id(g)}" x1="0%" x2="100%"><stop offset="0%" stop-color="{ac}"/><stop offset="100%" stop-color="{hc}"/></linearGradient>')
    svg.append(f'<rect x="{x}" y="{sty}" width="{w}" height="1.8" fill="url(#stg{id(g)})"/>')
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

# ----------------------------------------------------------------------------- network rows
y = PAD_T
for row in rows:
    lh = ST_H if row["stream"] else ROW_H
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
        svg.append(f'<image x="{cx0}" y="{ry-lh2/2}" width="{lw2}" height="{lh2}" href="{uri}" preserveAspectRatio="xMidYMid meet"/>')
        if suf: svg.append(f'<text x="{cx0+lw2+3}" y="{ry+7}" font-size="{19 if suf=="+" else 12}" font-weight="700" fill="#F2F3F4">{E(suf)}</text>')
    else:
        svg.append(f'<text x="{LABEL_W/2}" y="{ry+6}" font-size="17" font-weight="700" fill="#F2F3F4" text-anchor="middle">{E(NET_ABBR.get(row["name"], row["name"]))}</text>')
    svg.append(f'<line x1="0" y1="{y}" x2="{W-PAD_X}" y2="{y}" stroke="#FFFFFF" stroke-opacity="0.24" stroke-width="1.5"/>')
    for lane in row["lanes"]:
        for g in lane:
            x = xof(g["dt"]); w = g["end_min"]*PX-4
            ac, hc = color(g["a"]["id"]), color(g["h"]["id"])
            if row["stream"]:
                sv = VENUES.get(g["id"])
                mini_card(x+1, y+3, w, g, g["dt"].strftime("%-I:%M %p") + (f" · {sv}" if sv else ""))
                continue
            half = BLOCK_H/2
            (ba, ia), (bh2, ih) = legible(ac), legible(hc)
            ra, rh_ = rank_of(g["a"]), rank_of(g["h"])
            rv = rivalry_of(g)
            big = bool(ra and rh_) or bool(rv and rv[1] == 1) or bool(MOCK_TRAY.get((g["a"]["team"], g["h"]["team"])) and "Showdown" in (MOCK_TRAY[(g["a"]["team"], g["h"]["team"])][2] or ""))
            SIL, TRAY, MARQ = STYLE["silhouette"], STYLE["tray"], STYLE["marquee"]
            CARD_H = BLOCK_H + TRAY_H
            cx0, cy0 = x+1, y+4                      # card origin
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
                gid = f"cap{id(g)}_{cap_i}"
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
            seam_fill = "#F0C850" if (big and MARQ in ("tag", "plate")) else f"url(#tg{id(g)})"
            SEC_INK = "#F0C850" if (big and MARQ == "plate") else "#B4BAC0"   # v1.2: lighter than #848C93, still below the primary
            svg.append(f'<linearGradient id="tg{id(g)}" x1="0%" x2="100%"><stop offset="0%" stop-color="{ac}"/><stop offset="100%" stop-color="{hc}"/></linearGradient>')
            svg.append(f'<rect x="{bx}" y="{ty-ins}" width="{bw}" height="2.5" fill="{seam_fill}"/>')
            v = VENUES.get(g["id"])
            prim = g["dt"].strftime("%-I:%M %p") + (f" · {v}" if v else "")
            line_h = 24                                # first tray line is always 24 tall
            fp = 12.5
            if tw_inter(prim, fp) > w*0.45: fp = max(9.5, (w*0.45)/(len(prim)*0.55))
            svg.append(f'<text x="{x+15}" y="{ty+line_h/2+5}" font-size="{fp:.1f}" font-weight="700" fill="#F2F3F4">{E(prim)}</text>')
            def draw_chips(chx, right_edge=None):
                """streamer micro-chips; returns x after the last chip. right_edge → right-aligned."""
                items = []
                for b in g["badges"]:
                    derived = b.endswith("*"); bname = b.rstrip("*"); nl2 = net_logo(bname, chip=True)
                    if nl2:
                        uri2, asp2, suf2 = nl2; lh3 = 14; lw3 = min(asp2*lh3, 64)
                        sufw2 = (9 if suf2=="+" else 7*len(suf2)+3) if suf2 else 0
                        items.append(("img", lw3 + 12 + sufw2 + (14 if derived else 10), uri2, lw3, suf2, derived))
                    else:
                        items.append(("txt", len(b)*6 + 10, b, 0, "", derived))
                if right_edge is not None: chx = right_edge - sum(it[1] for it in items)
                for kind, adv, a1, lw3, suf2, derived in items:
                    if kind == "img":
                        chw = adv - (14 if derived else 10)
                        svg.append(f'<rect x="{chx}" y="{ty+line_h/2-9.5}" width="{chw}" height="19" rx="4" fill="#31363D"/>')
                        svg.append(f'<image x="{chx+6}" y="{ty+line_h/2-7}" width="{lw3}" height="14" href="{a1}" preserveAspectRatio="xMidYMid meet"/>')
                        if suf2: svg.append(f'<text x="{chx+6+lw3+1}" y="{ty+line_h/2+4}" font-size="{11 if suf2=="+" else 8}" font-weight="700" fill="#F2F3F4">{E(suf2)}</text>')
                        if derived: svg.append(f'<text x="{chx+chw+2}" y="{ty+line_h/2-4}" font-size="9" fill="#848C93">*</text>')
                    else:
                        svg.append(f'<text x="{chx}" y="{ty+line_h/2+4.5}" font-size="10" fill="#CFD4D9">{E(a1)}</text>')
                    chx += adv
                return chx
            sec_parts = tray_parts(g)               # ordered by display priority (spread first)
            if TRAY == "single":
                chx = draw_chips(x + 15 + len(prim)*fp*0.56 + 12)
                fs2 = 10; avail = w - (chx - x) - 30; full = list(sec_parts)
                while sec_parts and tw_inter(" · ".join(sec_parts), fs2)*0.95 > avail: sec_parts = sec_parts[:-1]
                if len(sec_parts) < len(full): DROP_LOG.append((f'{g["a"]["team"]} @ {g["h"]["team"]} ({g["end_min"]}m)', full[len(sec_parts):]))
                if sec_parts:
                    svg.append(f'<text x="{cx0+w-14}" y="{ty+line_h/2+4.5}" font-size="{fs2}" font-weight="600" fill="{SEC_INK}" text-anchor="end">{E(" · ".join(sec_parts))}</text>')
            elif TRAY == "twoline":
                draw_chips(x + 15 + len(prim)*fp*0.56 + 12)
                sec = " · ".join(sec_parts)
                if sec:
                    fs2 = 10; avail = w - 30
                    while sec_parts and tw_inter(" · ".join(sec_parts), fs2)*0.95 > avail: sec_parts = sec_parts[:-1]   # drop lowest-priority first
                    svg.append(f'<text x="{x+15}" y="{ty+line_h+7.5}" font-size="{fs2}" fill="#9aa2a8">{E(" · ".join(sec_parts))}</text>')
            elif TRAY == "priority":
                chip_left = draw_chips(0, right_edge=cx0+w-12)
                sec_x = x + 15 + len(prim)*fp*0.56 + 16
                avail = chip_left - 12 - sec_x
                fs2 = 10
                while sec_parts and tw_inter(" · ".join(sec_parts), fs2)*0.95 > avail: sec_parts = sec_parts[:-1]
                if sec_parts:
                    svg.append(f'<line x1="{sec_x-8}" y1="{ty+7}" x2="{sec_x-8}" y2="{ty+line_h-7}" stroke="#FFFFFF" stroke-opacity="0.18"/>')
                    svg.append(f'<text x="{sec_x}" y="{ty+line_h/2+4.5}" font-size="{fs2}" fill="#9aa2a8">{E(" · ".join(sec_parts))}</text>')
            elif TRAY == "tokens":
                chx = draw_chips(x + 15 + len(prim)*fp*0.56 + 12)
                fs2 = 9.5; right = cx0+w-10; toks = []
                for part in sec_parts:                # keep in priority order, drop when out of room
                    tw = tw_inter(part, fs2)*0.92 + 12
                    if right - sum(t[1]+6 for t in toks) - tw < chx + 8: break
                    toks.append((part, tw))
                px_ = right
                for part, tw in toks:                 # draw right-to-left so priority sits nearest the edge
                    px_ -= tw
                    gold = rv and part == rv[0]
                    svg.append(f'<rect x="{px_}" y="{ty+line_h/2-8.5}" width="{tw}" height="17" rx="3.5" fill="{"#3A3218" if gold else "#2C3138"}" stroke="{"#F0C850" if gold else "#FFFFFF"}" stroke-opacity="{0.9 if gold else 0.14}"/>')
                    svg.append(f'<text x="{px_+tw/2}" y="{ty+line_h/2+3.5}" font-size="{fs2}" font-weight="600" fill="{"#F0C850" if gold else "#C9CED3"}" text-anchor="middle">{E(part)}</text>')
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
            if g["alt"]:
                svg.append(f'<rect x="{tag_x}" y="{y+8}" width="38" height="16" rx="4" fill="#FFFFFF"/>')
                svg.append(f'<text x="{tag_x+19}" y="{y+20}" font-size="10" font-weight="700" fill="#33383c" text-anchor="middle">ALT</text>')
                tag_x += 44
            if big and MARQ in ("tag", "plate"):
                svg.append(f'<rect x="{tag_x}" y="{y+8}" width="64" height="16" rx="4" fill="#F0C850"/>')
                svg.append(f'<text x="{tag_x+32}" y="{y+20}" font-size="9.5" font-weight="700" fill="#2A2410" text-anchor="middle" letter-spacing="0.6">MARQUEE</text>')
        y += lh
svg.append(f'<line x1="0" y1="{y}" x2="{W-PAD_X}" y2="{y}" stroke="#FFFFFF" stroke-opacity="0.24" stroke-width="1.5"/>')

# ----------------------------------------------------------------------------- TBD section (§11.6)
if tbd_groups:
    y += 30
    svg.append(f'<text x="{PAD_X}" y="{y+8}" font-size="22" font-weight="700" font-family="{BC}" fill="#F2F3F4">{E(f"KICKOFF OR NETWORK TBA — {len(tbd)} GAMES")}</text>')
    svg.append(f'<text x="{PAD_X}" y="{y+28}" font-size="12" fill="#9aa2a8">date confirmed by CFBD · kickoff and/or television assignment not yet announced · a game moves onto the grid the day it is assigned</text>')
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
                txt = g["dt"].strftime("%-I:%M %p") + " · TV TBA"
            elif key == "time_tbd":
                txt = "KICKOFF TBA · " + " / ".join(nets) + (" (not carried)" if all(n in UNAVAILABLE for n in nets) else "")
            else:
                txt = "KICKOFF AND TV TBA"
            rv = rivalry_of(g); ln = LINES.get(g["id"])
            right = rv[0] if rv else (ln["display"] if ln and ln.get("display") else None)
            mini_card(cx, cy, TBD_CARD_W, g, txt, right)
        y += math.ceil(len(gs)/TBD_COLS)*TBD_ROW + 12

# ----------------------------------------------------------------------------- footer
y += 8
foot = f"{len(day)} games on the grid"
if tbd: foot += f" · {len(tbd)} awaiting kickoff/network"
if omitted:
    outs = sorted({o for g in omitted for o in g["outlets"]})
    foot += f" · {len(omitted)} not on your services and omitted ({', '.join(outs)})"
foot += " · kept in the database; nothing is deleted"
svg.append(f'<text x="{PAD_X}" y="{y+12}" font-size="11" fill="#848C93">{E(foot)}</text>')
svg.append('</svg>')

# ----------------------------------------------------------------------------- output
out_dir = Path(ARGS.out); out_dir.mkdir(parents=True, exist_ok=True)
svg_path = out_dir / f"grid_{TARGET}.svg"
svg_path.write_text("\n".join(svg), encoding="utf-8")
for gname, dropped in DROP_LOG: print(f"  tray drop: {gname}: {dropped}")
print(f"v1.2: {len(day)} on grid · {len(tbd)} TBA · {len(omitted)} omitted · {W:.0f}x{H:.0f} -> {svg_path}"
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
