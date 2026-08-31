#!/usr/bin/env python3
"""MySports Phase 3B — rendering-contract prototype v0.2 (Sep 5, 2026). Run from repo root; outputs SVG to artifacts/rendering/.
Applies contract decisions: (1) linear blocks truncate at the next game on the
same network; (2) simultaneous same-network games -> second lane tagged ALT FEED;
(3) streaming groups keep full lanes but in compact card style."""
import json, html
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

ET = ZoneInfo("America/New_York")
TARGET_DATE = "2026-09-05"
ALIASES = {"CW":"The CW","The CW Network":"The CW","USA Net":"USA Network","BTN":"Big Ten Network",
           "ESPN Unlmtd":"ESPN Unlimited","CBSSN":"CBS Sports Network","SECN+":"SEC Network+"}
UNAVAILABLE = {"CBS Sports Network","FS2","MW+","UConn+"}
SIMULCAST_RULES = {"CBS":"Paramount+","NBC":"Peacock","TNT":"HBO Max","ESPN":"Disney+","ABC":"Disney+"}
ROW_ORDER = ["ABC","CBS","FOX","NBC","The CW",
             "ESPN","ESPN2","ESPNU","FS1","TNT","USA Network",
             "Big Ten Network","ACC Network","SEC Network"]
STREAM_GROUPS = ["ESPN+","ESPN Unlimited","SEC Network+","Peacock","HBO Max"]
GAME_MIN = 210

games = json.load(open("artifacts/validation/cfbd_2026_week1_fixture.json"))["games"]
day = []
for g in games:
    dt = datetime.fromisoformat(g["startDate"].replace("Z","+00:00")).astimezone(ET)
    if dt.strftime("%Y-%m-%d") != TARGET_DATE: continue
    seen, media = set(), []
    for m in g["media"]:
        o = ALIASES.get(m["outlet"], m["outlet"]); k = (m["mediaType"], o)
        if k in seen: continue
        seen.add(k); media.append({"type": m["mediaType"], "outlet": o})
    tv = [m["outlet"] for m in media if m["type"]=="tv"]
    web = [m["outlet"] for m in media if m["type"]=="web"]
    primary = next((r for r in ROW_ORDER if r in tv), None)
    if primary is None:
        primary = next((w for w in web if w not in UNAVAILABLE), None)
    if primary is None or primary in UNAVAILABLE: continue
    badges = [w for w in web if w != primary and w not in UNAVAILABLE]
    if primary in SIMULCAST_RULES and SIMULCAST_RULES[primary] not in badges:
        badges.append(SIMULCAST_RULES[primary] + "*")
    day.append({"away": g["away"]["team"], "home": g["home"]["team"], "dt": dt,
                "primary": primary, "badges": badges, "alt": False, "end_min": GAME_MIN})

# --- decision 1: truncate at next distinct start on same linear network ---
for r in ROW_ORDER:
    gs = sorted([g for g in day if g["primary"] == r], key=lambda g: g["dt"])
    for i, g in enumerate(gs):
        nxt = next((h for h in gs[i+1:] if h["dt"] > g["dt"]), None)
        if nxt:
            gap = (nxt["dt"] - g["dt"]).total_seconds()/60
            g["end_min"] = min(GAME_MIN, int(gap))

def assign_lanes(gs, use_end=True, mark_alt=True):
    lanes = []
    for g in sorted(gs, key=lambda g: g["dt"]):
        for lane in lanes:
            last = lane[-1]
            dur = last["end_min"] if use_end else GAME_MIN
            if (g["dt"] - last["dt"]).total_seconds()/60 >= dur:
                lane.append(g); break
        else:
            if lanes and mark_alt: g["alt"] = True   # decision 2: overflow on linear = alternate feed
            lanes.append([g])
    return lanes

final_rows = []
for r in ROW_ORDER:
    gs = [g for g in day if g["primary"] == r]
    if gs: final_rows.append({"name": r, "lanes": assign_lanes(gs), "stream": False})
for s in STREAM_GROUPS:
    gs = [g for g in day if g["primary"] == s]
    if gs:
        for g in gs: g["alt"] = False
        final_rows.append({"name": s, "lanes": assign_lanes(gs, use_end=False, mark_alt=False), "stream": True})

PX_PER_MIN = 3.2; LABEL_W = 170; PAD_T, PAD_B, PAD_X = 120, 40, 24
ROW_H, STREAM_H = 76, 46   # decision 3: compact streaming lanes

t0 = min(g["dt"] for g in day).replace(minute=0, second=0)
t_end = max(g["dt"] + timedelta(minutes=GAME_MIN) for g in day)
total_min = ((int((t_end - t0).total_seconds()//60) + 29)//30)*30
W = LABEL_W + total_min*PX_PER_MIN + PAD_X
H = PAD_T + sum(len(r["lanes"])*(STREAM_H if r["stream"] else ROW_H) for r in final_rows) + PAD_B
x_of = lambda dt: LABEL_W + (dt - t0).total_seconds()/60*PX_PER_MIN

svg = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" font-family="Inter, Helvetica, Arial, sans-serif">',
       f'<rect width="{W}" height="{H}" fill="#FAFAF8"/>',
       f'<text x="{PAD_X}" y="46" font-size="30" font-weight="700" fill="#1E1E1E">College Football — Saturday, September 5, 2026</text>',
       f'<text x="{PAD_X}" y="72" font-size="15" fill="#7C7C7C">MySports wireframe v0.2 · all times ET · * simulcast derived by rule · ALT = alternate/overflow feed</text>']
for m in range(0, total_min+1, 30):
    t = t0 + timedelta(minutes=m); x = LABEL_W + m*PX_PER_MIN; major = t.minute == 0
    svg.append(f'<line x1="{x}" y1="{PAD_T-18}" x2="{x}" y2="{H-PAD_B}" stroke="{"#D9D9D9" if major else "#EDEDEA"}"/>')
    if major: svg.append(f'<text x="{x}" y="{PAD_T-26}" font-size="13" fill="#7C7C7C" text-anchor="middle">{t.strftime("%-I %p")}</text>')

y = PAD_T
for r in final_rows:
    lane_h = STREAM_H if r["stream"] else ROW_H
    row_h = len(r["lanes"])*lane_h
    svg.append(f'<rect x="0" y="{y}" width="{LABEL_W}" height="{row_h}" fill="{"#F1F1EE" if r["stream"] else "#FFFFFF"}" stroke="#D9D9D9" stroke-width="0.5"/>')
    svg.append(f'<text x="{LABEL_W-12}" y="{y+min(row_h/2+5, 40)}" font-size="15" font-weight="700" fill="#1E1E1E" text-anchor="end">{html.escape(r["name"])}</text>')
    svg.append(f'<line x1="0" y1="{y}" x2="{W-PAD_X}" y2="{y}" stroke="#D9D9D9"/>')
    for lane in r["lanes"]:
        for g in lane:
            x = x_of(g["dt"]); w = g["end_min"]*PX_PER_MIN - 2
            trunc = g["end_min"] < GAME_MIN and not r["stream"]
            svg.append(f'<rect x="{x+1}" y="{y+3}" width="{w}" height="{lane_h-6}" rx="7" fill="#FFFFFF" stroke="#B4B4B4" stroke-width="1.2"/>')
            svg.append(f'<rect x="{x+1}" y="{y+3}" width="5" height="{lane_h-6}" rx="2" fill="#1FA98C"/>')
            tx = x + 15
            if r["stream"]:
                svg.append(f'<text x="{tx}" y="{y+21}" font-size="13" font-weight="700" fill="#1E1E1E">{html.escape(g["away"] + " at " + g["home"])}</text>')
                svg.append(f'<text x="{tx}" y="{y+37}" font-size="11" fill="#7C7C7C">{g["dt"].strftime("%-I:%M %p")}</text>')
            else:
                svg.append(f'<text x="{tx}" y="{y+23}" font-size="14" font-weight="700" fill="#1E1E1E">{html.escape(g["away"])}</text>')
                svg.append(f'<text x="{tx}" y="{y+41}" font-size="14" font-weight="700" fill="#1E1E1E">at {html.escape(g["home"])}</text>')
                info = g["dt"].strftime("%-I:%M %p")
                if g["badges"]: info += "  ·  " + ", ".join(g["badges"])
                svg.append(f'<text x="{tx}" y="{y+60}" font-size="12" fill="#7C7C7C">{html.escape(info)}</text>')
            if g["alt"]:
                svg.append(f'<rect x="{x+w-58}" y="{y+8}" width="50" height="18" rx="4" fill="#7C7C7C"/>')
                svg.append(f'<text x="{x+w-33}" y="{y+21}" font-size="11" font-weight="700" fill="#FFFFFF" text-anchor="middle">ALT</text>')
            if trunc:
                svg.append(f'<text x="{x+w-8}" y="{y+lane_h-10}" font-size="11" fill="#B4B4B4" text-anchor="end">›</text>')
        y += lane_h
svg.append(f'<line x1="0" y1="{y}" x2="{W-PAD_X}" y2="{y}" stroke="#D9D9D9"/></svg>')
__import__("pathlib").Path("artifacts/rendering").mkdir(parents=True, exist_ok=True) or open("artifacts/rendering/sep5_wireframe_v02.svg","w").write("\n".join(svg))
print(f"v0.2: {len(day)} games, {H:.0f}px tall (v0.1 was 2820)")
for r in final_rows:
    alt = sum(1 for l in r["lanes"] for g in l if g["alt"])
    print(f"  {r['name']}: {sum(len(l) for l in r['lanes'])} games, {len(r['lanes'])} lanes" + (f", {alt} ALT" if alt else ""))
