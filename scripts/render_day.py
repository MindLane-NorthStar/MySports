#!/usr/bin/env python3
"""MySports — day grid renderer, design v1.0 (Phase 3B).

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
ARGS = ap.parse_args()
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
ROW_ORDER = ["ABC","CBS","FOX","NBC","The CW","ESPN","ESPN2","ESPNU","FS1","TNT","USA Network",
             "Big Ten Network","ACC Network","SEC Network"]
NET_ABBR = {"ABC":"abc","CBS":"CBS","FOX":"FOX","NBC":"NBC","The CW":"CW","ESPN":"ESPN","ESPN2":"ESPN2",
            "ESPNU":"ESPNU","FS1":"FS1","TNT":"TNT","USA Network":"USA","Big Ten Network":"BTN",
            "ACC Network":"ACCN","SEC Network":"SECN","ESPN+":"ESPN+","ESPN Unlimited":"ESPN UNL",
            "SEC Network+":"SECN+","Peacock":"PCOCK","HBO Max":"MAX"}
STREAMS = ["ESPN+","ESPN Unlimited","SEC Network+","Peacock","HBO Max"]
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
def net_logo(name, dark=False):
    slug = NET_SLUG.get(name)
    if not slug: return None
    key = (slug, dark)
    if key not in NLOGO:
        p = Path(ARGS.network_logos) / f"{slug}.png"
        if p.exists():
            im = _Img.open(p).convert("RGBA")
            if dark: im = derive_dark_mark(im)
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
BLOCK_H, TRAY_H, GAP = 74, 24, 8
ROW_H = BLOCK_H + TRAY_H + GAP   # 106
ST_BLOCK, ST_TRAY = 36, 16
ST_H = ST_BLOCK + ST_TRAY + 6   # 58
# TBD section (contract §10): streaming-scale cards in a wrapping list below the grid
TBD_CARD_W, TBD_CARD_H, TBD_GAP = 320, ST_BLOCK + ST_TRAY, 14
TBD_ROW = TBD_CARD_H + 10
TBD_HEAD, TBD_GROUP_HEAD = 64, 30
E = html.escape
BC = "Barlow Condensed, Inter, sans-serif"
def tw_inter(s, fs): return len(s)*fs*0.55     # width heuristics used for fitting
def tw_barlow(s, fs): return len(s)*fs*0.42

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
title = datetime.strptime(TARGET,"%Y-%m-%d").strftime("COLLEGE FOOTBALL — %A, %B %-d, %Y").upper()
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
legend.append(("gold", "BIG GAME · BOTH RANKED OR TIER-1 RIVALRY"))
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
        svg.append(f'<rect x="{lx+1}" y="{ly-8}" width="{gw-2}" height="16" rx="4" fill="#23282E" stroke="#F0C850" stroke-width="2.5" filter="url(#glow)"/>')
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
for m in range(0, total+1, 30):
    t = t0+timedelta(minutes=m); x = LABEL_W+m*PX; major = t.minute==0
    svg.append(f'<line x1="{x}" y1="{PAD_T-18}" x2="{x}" y2="{GRID_BOTTOM}" stroke="#FFFFFF" stroke-opacity="{"0.10" if major else "0.045"}"/>')
    if major: svg.append(f'<text x="{x}" y="{PAD_T-26}" font-size="13" font-weight="600" fill="#9aa2a8" text-anchor="middle">{t.strftime("%-I %p")}</text>')

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
    ry = y+min(rh/2,58)
    tile_h = min(rh-8, 96)
    svg.append(f'<rect x="8" y="{ry-tile_h/2}" width="{LABEL_W-16}" height="{tile_h}" rx="10" fill="url(#tile)"/>')
    if nl:
        uri, asp, suf = nl
        max_h = tile_h-14
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
            grp_f = 'url(#glow)' if big else 'url(#soft)'
            stroke_c = "#F0C850" if big else "#FFFFFF"
            stroke_o = "1.0" if big else "0.55"
            if big:
                svg.append(f'<ellipse cx="{x+1+w/2}" cy="{y+4+(BLOCK_H+TRAY_H)/2}" rx="{w/2+42}" ry="{(BLOCK_H+TRAY_H)/2+34}" fill="url(#sunburst)"/>')
            svg.append(f'<g filter="{grp_f}"><rect x="{x+1}" y="{y+4}" width="{w}" height="{BLOCK_H+TRAY_H}" rx="9" fill="#23282E"/></g>')
            svg.append(f'<rect x="{x+1}" y="{y+4}" width="{w}" height="{half}" rx="9" fill="{ba}"/><rect x="{x+1}" y="{y+4+half*0.5}" width="{w}" height="{half*0.5}" fill="{ba}"/>')
            svg.append(f'<rect x="{x+1}" y="{y+4+half}" width="{w}" height="{half}" fill="{bh2}"/>')
            CAP = BLOCK_H  # endcap width
            la, lhm = logo_uri(g["a"]["id"]), logo_uri(g["h"]["id"])
            for cap_i,(cx, cc, lg) in enumerate(((x+1, ac, la), (x+1+w-CAP, hc, lhm))):
                if CAP_STYLE == "gradient":
                    gid = f"cap{id(g)}_{cap_i}"
                    svg.append(f'<linearGradient id="{gid}" x1="0%" y1="0%" x2="0%" y2="100%">'
                               f'<stop offset="0%" stop-color="{tint(cc,0.86)}"/>'
                               f'<stop offset="100%" stop-color="{tint(cc,0.58)}"/></linearGradient>')
                    fill = f"url(#{gid})"
                else:
                    fill = cc
                inner = f'<rect x="{cx+CAP-8}" y="{y+4}" width="8" height="{BLOCK_H}" fill="{fill}"/>' if cap_i==0 else f'<rect x="{cx}" y="{y+4}" width="8" height="{BLOCK_H}" fill="{fill}"/>'
                svg.append(f'<rect x="{cx}" y="{y+4}" width="{CAP}" height="{BLOCK_H}" rx="8" fill="{fill}"/>{inner}')
                sep_x = cx+CAP if cap_i==0 else cx
                svg.append(f'<line x1="{sep_x}" y1="{y+4}" x2="{sep_x}" y2="{y+4+BLOCK_H}" stroke="#FFFFFF" stroke-opacity="0.55"/>')
                if lg: svg.append(f'<image x="{cx+7}" y="{y+4+7}" width="{CAP-14}" height="{BLOCK_H-14}" href="{lg}"/>')
            svg.append(f'<line x1="{x+1+CAP}" y1="{y+4+half}" x2="{x+1+w-CAP}" y2="{y+4+half}" stroke="#FFFFFF" stroke-opacity="0.7"/>')
            span_l, span_r = x+1+CAP+10, x+1+w-CAP-10
            mid = (span_l+span_r)/2
            for i,(side,ink,rk) in enumerate(((g["a"],ia,ra),(g["h"],ih,rh_))):
                cy = y+4+half*(i+0.5)
                label = ("" if i==0 else "@ ") + (f"{rk} " if rk else "") + side["team"]
                fs = 26
                if tw_barlow(label, fs) > (span_r-span_l): fs = max(14, (span_r-span_l)/(len(label)*0.42))
                svg.append(f'<text x="{mid}" y="{cy+fs*0.34}" font-size="{fs:.1f}" font-weight="700" font-family="{BC}" fill="{ink}" text-anchor="middle">{E(label.upper())}</text>')
            # tray zone inside silhouette: gradient seam + hierarchy
            ty = y+4+BLOCK_H
            svg.append(f'<linearGradient id="tg{id(g)}" x1="0%" x2="100%"><stop offset="0%" stop-color="{ac}"/><stop offset="100%" stop-color="{hc}"/></linearGradient>')
            svg.append(f'<rect x="{x+1}" y="{ty}" width="{w}" height="2.5" fill="url(#tg{id(g)})"/>')
            v = VENUES.get(g["id"])
            prim = g["dt"].strftime("%-I:%M %p") + (f" · {v}" if v else "")
            fp = 12.5
            if tw_inter(prim, fp) > w*0.45: fp = max(9.5, (w*0.45)/(len(prim)*0.55))
            svg.append(f'<text x="{x+15}" y="{ty+TRAY_H/2+5}" font-size="{fp:.1f}" font-weight="700" fill="#F2F3F4">{E(prim)}</text>')
            # streamer logo micro-chips right after primary text
            chx = x + 15 + len(prim)*fp*0.56 + 12
            for b in g["badges"]:
                derived = b.endswith("*"); bname = b.rstrip("*")
                nl2 = net_logo(bname, dark=True)
                if nl2:
                    uri2, asp2, suf2 = nl2
                    lh3 = 13; lw3 = min(asp2*lh3, 60)
                    sufw2 = (9 if suf2=="+" else 7*len(suf2)+3) if suf2 else 0
                    chw = lw3 + 12 + sufw2
                    svg.append(f'<rect x="{chx}" y="{ty+TRAY_H/2-9.5}" width="{chw}" height="19" rx="4" fill="#31363D"/>')
                    svg.append(f'<image x="{chx+6}" y="{ty+TRAY_H/2-lh3/2}" width="{lw3}" height="{lh3}" href="{uri2}" preserveAspectRatio="xMidYMid meet"/>')
                    if suf2: svg.append(f'<text x="{chx+6+lw3+1}" y="{ty+TRAY_H/2+4}" font-size="{11 if suf2=="+" else 8}" font-weight="700" fill="#F2F3F4">{E(suf2)}</text>')
                    if derived: svg.append(f'<text x="{chx+chw+2}" y="{ty+TRAY_H/2-4}" font-size="9" fill="#848C93">*</text>')
                    chx += chw + (10 if not derived else 14)
                else:
                    svg.append(f'<text x="{chx}" y="{ty+TRAY_H/2+4.5}" font-size="10" fill="#CFD4D9">{E(b)}</text>')
                    chx += len(b)*6 + 10
            sec = tray_secondary(g)
            if sec:
                fs2 = 10
                avail = w - (chx - x) - 30
                if tw_inter(sec, fs2)*0.95 > avail: fs2 = max(7.5, avail/(len(sec)*0.52))
                svg.append(f'<text x="{x+1+w-14}" y="{ty+TRAY_H/2+4.5}" font-size="{fs2:.1f}" fill="#848C93" text-anchor="end">{E(sec)}</text>')
            svg.append(f'<rect x="{x+1}" y="{y+4}" width="{w}" height="{BLOCK_H+TRAY_H}" rx="9" fill="none" stroke="{stroke_c}" stroke-opacity="{stroke_o}" stroke-width="{3.5 if big else 2.5}"/>')
            if g["alt"]:
                svg.append(f'<rect x="{x+1+CAP+6}" y="{y+8}" width="38" height="16" rx="4" fill="#FFFFFF"/>')
                svg.append(f'<text x="{x+1+CAP+25}" y="{y+20}" font-size="10" font-weight="700" fill="#33383c" text-anchor="middle">ALT</text>')
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
print(f"v1.0: {len(day)} on grid · {len(tbd)} TBA · {len(omitted)} omitted · {W:.0f}x{H:.0f} -> {svg_path}"
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
