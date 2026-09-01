# MySports — Spec §11.9 Multi-Sport Day Layout: Options Memo

**Status:** options package for a decision session, written 2026-09-01 (Cowork design session, Prompt A of `claude/parallel-session-prompts.md`). Read-only session: nothing in the repo, database, or rendering contract was touched. Repo state assumed from `claude/handoff-status.md` at `8708817` (contract v1.6; Milestone 3 part 1 — the DB-fed renderer — in flight in another session and explicitly excluding §11.9).

**Wireframes:** `claude/wireframes/opt1_stacked_bands.svg` … `opt5_tabs.svg` (gray boxes, schematic scale, not contract pixels).

---

## 0. Recommendation first

**Build Option 4 — a two-band day: a college band with its own rail, above one merged pro band (NFL + NHL + NBA, later MLB) that shares a single rail and a single timeline.** Ship it as renderer v1.7 in Claude Code once Milestone 3 part 1 lands, with the band split driven by a new `band` attribute in `data/render_policies.json` rather than hard-coded.

Why this and not the "obvious" fully-merged rail (Option 2): the four sports do not overlap the same way. College football's rail is mostly networks no other sport touches on that day (SECN, ACCN, BTN, ESPNU, SECN+, ACCNX, CBSSN-excluded, and the ESPN/ABC/FOX rows saturated 12:00–midnight with 210-minute blocks). The pro leagues, by contrast, overlap each other heavily — ESPN, ABC, NBC, TNT, Prime, Peacock carry NFL, NHL, and NBA on the same evening — and their Cleveland-filtered slates are small (2–4 games each on grid). Merging the pro leagues gives you the one thing a multi-sport day is for: a single 7:00–11:00 PM picture of what is on. Merging college into that same rail buys almost nothing (their networks barely collide with the pro rows except ABC/ESPN/FOX at 7:30) and costs a lot: cross-sport ALT lanes on ESPN, a 210-minute CFB card truncated by a 150-minute NHL card on the same row, and a rail order that has to interleave conference networks with DAZN and CBJ LOCAL.

Two honest caveats up front. First, the stress case in the brief — "68 CFB games + NFL Sunday" — is not a real viewing day; the 03:00 ET cutover puts CFB Saturday and NFL Sunday on different days. The true worst day is a late-December Saturday: bowl-season or Week 15 CFB (say 8–12 games), an NFL Saturday doubleheader (2–4 games), 12+ NHL games, 10+ NBA games. I ran the height math on both the literal brief case and the realistic case (§7). Second, none of the five options makes a 68-game CFB Saturday short; a college Saturday is ~4,300 px tall on its own under my reference scale and every option inherits that. The decision is about what to do with the other 8–12 games that day, not about shrinking college.

---

## 1. What v1.6 does today (the baseline every option extends)

One sport per SVG. `render_policies.json` sets block minutes per sport (cfb 210, nfl 210, nhl 150, nba 150, mlb 180). `row_order.json[sport]` defines the left rail in order, with a `local` group (CARRIER TBA plate, DAZN, WUAB 43, CBJ LOCAL). Collisions on one row (two games, same network, overlapping blocks) spill to an ALT lane (CFB's `alt_lane` policy) or are resolved by the market filter (pro `market_filter` policy: OUT_OF_MARKET/UNVERIFIED media never seat a game). Below the grid: a TBD section, then (pro leagues only) the Around the League strip listing off-grid games with reasons. Output goes to `artifacts/rendering/{sport}/grid_{date}.svg`; the deployment contract already reserves `grids/multi/{date}.svg` in R2 for "contract v1.6+".

Two facts from the handoff that shape every option:

- **Rail identity differs by sport today.** CFB rows are network names (`CBS`, `FOX`, `NBC`); NFL rows are call-sign-plus-network (`WOIO 19 / CBS`, `WJW 8 / FOX`, `WKYC 3 / NBC`), NBA has `WUAB 43` with the call-letters band suppressed. Any option that puts NFL and CFB on one rail must decide which identity the row carries on a day both sports use CBS.
- **Cross-sport collisions on one network are real but few.** On a Saturday, ESPN/ABC are wall-to-wall CFB until ~11:30 PM; an NHL or NBA game on ESPN at 7:00 or 8:00 collides. On Sundays, NBC 8:20 SNF vs a Peacock/NBC NHL or NBA window, and ESPN 7:00 NHL vs 8:15 MNF. On weeknights (the common case) there is no college at all and the collisions are NHL vs NBA on ESPN/TNT, which the existing ALT lane already handles.

---

## 2. Reference scale used for height estimates (ASSUMPTION — steward to substitute)

The handoff records game counts for the acceptance renders (nhl 3·0·5, nfl 2·0·11, cfb 62·0·6) but not pixel dimensions, and this session cannot read `docs/rendering-contract.md`. All heights below use this reference scale; every formula is linear in these constants, so the steward can re-run the arithmetic with the contract's values in a minute:

| Constant | Reference value | Note |
|---|---|---|
| Canvas width | 1920 px | 30-minute columns, 12:00 PM–3:00 AM axis = 30 columns |
| Rail width | 240 px | network logo tile |
| Column width | 56 px | (1920 − 240) / 30 |
| Row (card) height + gutter | 132 px | 120 card + 12 gutter |
| Header | 96 px | date, sport, generated-at |
| Band/section header | 48 px | new for Options 1, 4 |
| TBD section | 132 px per line of stacked cards | |
| Around the League strip | 72 px per line (~8 games per line) | |
| Footer | 64 px | |
| Compact lane (Option 3 only) | 60 px | mini-cards, no endcaps, no tray |

Row-count assumptions per sport on the stress day: CFB Saturday with 68 games → ~22 network rows + ~8 ALT lanes = 30 rows (the Week 1 render seated 62 games; 68 is ~10% more collisions). NFL Sunday Cleveland-filtered → 4 rows (WOIO/CBS, WJW/FOX, WKYC/NBC, plus NFL Network or Prime on the weeks they carry a game). NHL → 4–5 rows (ESPN, ESPN2/ESPN+, TNT, truTV, CBJ LOCAL). NBA → 4–5 rows (ABC/ESPN, NBC/Peacock, Prime, DAZN, WUAB 43). MLB is out of scope for this memo but the pro-band design must leave room for it (~4 rows: FOX/FS1, ESPN, TBS, Apple TV, Guardians local).

---

## 3. The five options

### Option 1 — Stacked sport bands in one tall SVG

**What it is.** Concatenate today's single-sport renders vertically, in a fixed sport order (policy-driven: CFB, NFL, NHL, NBA, MLB), each band keeping its own rail, its own timeline, its own TBD section, and its own Around the League strip. A band header names the sport and its on-grid/TBA/omitted counts. The x-axis is aligned across bands (same column width, same 12:00 PM origin) so a vertical scan at 8:00 PM lines up.

**Rail.** Repeats per band. ESPN appears once per sport that uses it that day. No merging, no new identity rule: CFB rows stay `CBS`, NFL rows stay `WOIO 19 / CBS`.

**Block minutes.** No reconciliation needed; each band uses its own sport's minutes on its own rows. The shared timeline is cosmetic alignment only.

**Local rows.** Stay inside their sport's band, in the band's `local` group, exactly as today (CBJ LOCAL in the NHL band, DAZN/WUAB 43 in the NBA band).

**Around the League.** One strip per pro band, unchanged. The CFB band has none (CFB has no ATL concept; omitted CFB games are simply not on the grid).

**TBD.** Per band, unchanged.

**Height, literal stress case (68 CFB + 13-game NFL Sunday + NHL + NBA):** CFB band 96 + 48 + 30×132 + 132 + 64 ≈ 4,300; NFL band 48 + 4×132 + 132 + 72 ≈ 780; NHL and NBA bands ≈ 780 each → **≈ 6,600 px**. Realistic worst (Dec Saturday, 10 CFB rows): ≈ 1,700 + 780 + 900 + 900 ≈ **4,300 px**. Typical weeknight (NHL + NBA only): ≈ **1,700 px**.

**Pros.** Zero new layout rules; the renderer change is a loop and a band header; every existing acceptance render is preserved byte-for-byte inside its band; the CFB Week 1 byte-identity check survives trivially. Deterministic and cheap to test.

**Cons (honest).** It is not a multi-sport day; it is four days glued together. The question "what's on at 8:00 tonight" requires reading four rails. ESPN appears up to four times. Tallest option on every kind of day, and the tall part is repeated chrome (rails, timelines, headers), not information. It does not settle §11.9 so much as decline to. The web app would almost certainly want something else, so the SVG and the app diverge.

### Option 2 — One merged rail, sport-tagged rows, one shared timeline

**What it is.** One rail for the whole day: the union of every sport's rows, in a single merged `row_order.json["multi"]` order. Every card carries a small sport tag on its logo endcap (a two-letter mark in the team-color band, or a thin sport-colored rule above the card — this is a design-language addition and needs a contract entry). Cards on the same row are placed on the shared timeline; a card's width is its own sport's block minutes.

**Rail.** One ESPN row. The rail order interleaves: broadcast tier (ABC, CBS/WOIO 19, FOX/WJW 8, NBC/WKYC 3, The CW, WUAB 43), then cable (ESPN, ESPN2, ESPNU, FS1, TNT, truTV, USA, BTN, ACCN, SECN, NFL Network), then streaming (ESPN+, Peacock, Prime, Paramount+, HBO Max, DAZN, Apple TV), then `local` (CBJ LOCAL, Guardians local, CARRIER TBA). Rows with no game that day are dropped (today's behavior). Rail identity must be unified: either every CBS row becomes `WOIO 19 / CBS` for every sport, or every row becomes the network mark and the call sign moves into the card's footer tray. Decision D2 below.

**Block minutes.** Per card, from the card's sport policy. The shared axis makes this trivial to draw; the problem is the existing truncate-at-next-game rule: a 7:30 CFB game on ESPN (210 min → 11:00) collides with an NHL game on ESPN at 8:00 (150 min). Today's rule would truncate the CFB card at 8:00, which is false — ESPN cannot carry both, so one of the two claims is wrong or one is actually on ESPN2/ESPN+. In practice this is a data-quality signal, not a layout case, and the ALT lane is the right fallback: the later-starting card goes to `ESPN ALT`. Cross-sport ALT lanes are new (pro leagues use the market filter, not ALT) and need a policy line.

**Local rows.** All in one `local` group at the bottom of the rail, labeled per team. On a night with a Cavs game and a Blue Jackets game this is DAZN + WUAB 43 (if simulcast) + CBJ LOCAL, three rows — fine.

**Around the League.** One strip, grouped by sport with a sport label per group. TBD section likewise grouped by sport.

**Height, literal stress case:** union rail ≈ 22 CFB rows + 6 pro-only rows (NFL Network, Prime, Peacock, DAZN, WUAB 43, CBJ LOCAL) + 8 CFB ALT lanes + ~3 cross-sport ALT lanes = 39 rows → 96 + 39×132 + TBD 132 + ATL 144 + 64 ≈ **5,600 px**. Realistic worst: ≈ 10 + 8 + 3 = 21 rows ≈ **3,200 px**. Typical weeknight: ≈ 9 rows ≈ **1,500 px**.

**Pros.** The only option where one row answers "what's on ESPN tonight." Shortest on the realistic and typical days. Naturally extends to MLB. Maps directly to a web app with sport filters (hide a sport = drop its cards, keep the rail).

**Cons (honest).** Requires two design-language additions (sport tag on the card; unified rail identity) and one policy addition (cross-sport ALT). On a college Saturday the merged rail buries the 3–6 pro games among 30 CFB rows — a reader has to find the NHL card on ESPN at row 7 and the DAZN row at row 36, with 4,000 px between them. The rail order for the merged day is a new artifact that will drift from the per-sport orders unless it is derived from them (recommend: derive, never hand-edit). The CFB Week 1 byte-identity check does not apply to the multi render, so a new acceptance fixture is needed.

### Option 3 — Primary-sport grid with compact lanes for the other sports

**What it is.** Pick the day's primary sport by rule (highest on-grid game count, ties broken by a policy priority list). Render it exactly as today. Below its grid, add one compact 60-px lane per other sport that has games, on the same time axis: mini-cards with two abbreviations and a network chip, no logo endcaps, no footer tray, no team-color bands. Local rows and Around the League belong to the primary sport only; the lanes carry their own tiny "+N off-grid" count at the right edge.

**Rail.** The primary sport's rail, untouched. Lanes are labeled by sport, not network — the network is a chip inside the mini-card. So there is no rail merge and no identity question.

**Block minutes.** Primary sport as today; lane mini-cards use their sport's minutes on the shared axis, but overlaps within a lane stack into a second sub-lane (an NHL night has 3–5 overlapping Cleveland-receivable games, so the "one lane" promise breaks immediately on most nights).

**Local rows.** Primary sport only. If NHL is a lane, CBJ LOCAL is a chip on a mini-card, not a row — the CARRIER TBA plate disappears.

**Around the League.** Primary sport only; lanes show a count.

**TBD.** Primary sport section as today; lane TBD games go to the lane's right edge as a count.

**Height, literal stress case:** CFB grid 4,300 + 3 lanes × (60 + one overflow sub-lane 60) ≈ **4,700 px**. Realistic worst: ≈ 1,700 + 360 ≈ **2,100 px**. Typical weeknight (NHL primary, NBA lane): ≈ 1,000 + 120 ≈ **1,100 px** — the shortest of all.

**Pros.** Cheapest to read: one real grid plus a ticker. Shortest on typical nights. No rail merge, no identity rule. The primary-sport rule is one line of policy.

**Cons (honest).** It demotes real games to a second-class visual. The design language is the product — one-silhouette cards, team-color bands, logo endcaps, footer tray with chips and odds — and lanes throw all of it away for whichever sports lose the primary vote. On an NHL/NBA night the vote is a coin flip (10 vs 12 games), so which sport gets the good treatment changes day to day, which reads as arbitrary. Lanes need their own overflow rule the moment two games overlap, so the "compact" claim is half true. The Around the League strip and the CARRIER TBA plate — both things Joe specifically decided (decisions 3 and 6, and the CBJ acceptance render) — vanish for non-primary sports.

### Option 4 — Two bands: college band + one merged pro band (recommended)

**What it is.** Option 1's band structure with exactly two bands, and Option 2's merged rail inside the pro band. The college band is today's CFB render unchanged (own rail, own timeline, own TBD, no ATL). The pro band is a single merged rail for every pro league with games that day, one shared timeline, sport-tagged cards, per-sport block minutes, one `local` group, one TBD section grouped by sport, one Around the League strip grouped by sport. Band membership comes from `render_policies.json` (`"band": "college"` / `"band": "pro"`), so if a future sport needs its own band it is a data change.

**Rail.** CFB rail as today. Pro rail = derived union of `row_order.json[nfl|nhl|nba|mlb]` in a fixed tier order (broadcast → cable → streaming → local), each row appearing once. Rail identity inside the pro band is easy because the pro sports already agree: NFL and NBA both use call-sign rows for the affiliates (`WOIO 19 / CBS`, `WKYC 3 / NBC`, `WUAB 43`), so the pro band uses call-sign identity and the college band keeps network identity. That sidesteps the hardest part of D2 — the two identities never share a rail. (NHL has no affiliate rows in Cleveland today; if a WBNX-style OTA simulcast ever appears it uses the same convention.)

**Block minutes.** Per card in the pro band. Cross-sport collisions on one pro row (ESPN: NHL 7:00 + MNF 8:15; NBC: NHL/NBA + SNF 8:20; TNT: NHL + NBA doubleheader nights) resolve by the existing ALT lane — genuinely the same case as CFB's ESPN ALT, and it is rare enough (a handful of nights a season) that an ALT lane in the pro band is a feature, not a scaling problem. The pro market filter runs first, as today, so only receivable games ever reach the collision check.

**Local rows.** One `local` group at the bottom of the pro rail: DAZN, WUAB 43 (simulcast nights), CBJ LOCAL / CARRIER TBA, Guardians local when MLB arrives. This is the row a Cleveland viewer looks at first on a normal night, and in the pro band it is at most 5 rows below ESPN, not 36.

**Around the League.** One strip under the pro band, grouped by sport with a sport label per group; reasons text unchanged. The CFB band stays ATL-free (matches today).

**TBD.** CFB band: as today. Pro band: one section grouped by sport, so a flex-pending NFL game and a TBA-time NBA game sit together with their sport tags.

**Height, literal stress case:** CFB band ≈ 4,300; pro band header 48 + rail (4 NFL + 5 NHL + 5 NBA, less shared rows ESPN/ABC/NBC/Prime/Peacock = ~13 rows + 1 ALT) 14×132 = 1,850 + TBD 132 + ATL 144 → **≈ 6,500 px**. Realistic worst (Dec Saturday, 10 CFB rows): ≈ 1,700 + 2,150 ≈ **3,900 px**. Typical weeknight (no college band at all — an empty band is omitted, not drawn): ≈ 96 + 9×132 + 132 + 144 + 64 ≈ **1,600 px**, within 100 px of Option 2.

**Pros.** The pro band delivers the multi-sport promise where it matters (evenings, most days of the year). The college band preserves the Week 1 byte-identity check and every CFB rule. Rail identity is solved by construction. Cross-sport ALT is confined to the small pro rail. Design-language additions are the same two as Option 2 (sport tag, merged pro rail order) but no unification of CFB vs NFL row naming. Empty bands vanish, so most days the output is a single merged pro grid — which is also the shape the web app wants. MLB drops in as three or four more pro rows.

**Cons (honest).** On the literal stress day it is the tallest option after Option 1 — the band header and second timeline cost ~150 px and the pro rail is not shared with college, so ABC/ESPN/FOX/NBC each appear twice. Two timelines on one page invite a reader to misalign them, so the columns must be pixel-aligned across bands (same rail width, same origin) — a hard rule for the contract. The sport tag on the card is still a new design element needing Joe's eye. The pro band's derived rail order is a new artifact; it must be generated from the per-sport orders, never hand-maintained, or it drifts. And it is a judgment that "college is different" — if Joe wants Saturday's prime-time picture (CFB on ABC at 7:30 next to NHL on ESPN at 7:00) in one rail, Option 2 does that and Option 4 does not.

### Option 5 — Tabs/pages: one SVG per sport with a shared header

**What it is.** Keep single-sport renders as the unit. Add a shared header to every page: the date, a tab bar listing each sport with its on-grid/TBA/omitted counts (current sport highlighted), and a one-line "Tonight" summary across all sports (start time · row · matchup for every receivable game after 6:00 PM, in time order). Emit one SVG per sport plus `grids/multi/{date}.svg` = the tab-bar header with the summary strip and nothing else (or the primary sport's page, per D5). The web app renders the tabs as real tabs.

**Rail.** Per sport, unchanged. No merge, no identity question.

**Block minutes.** Unchanged.

**Local rows / ATL / TBD.** Unchanged, per sport.

**Height:** each page = today's single-sport render + ~72 px header. Max page on the stress day ≈ **4,400 px** (CFB). The multi page alone ≈ 200 px.

**Pros.** Smallest renderer change of the real options (a header component and a summary strip). Every page is an existing acceptance render plus a header. Natural for the web app. The "Tonight" strip is the cheapest possible cross-sport view and is useful on every option, not just this one — worth building regardless (see §5).

**Cons (honest).** For the SVG deliverable — the canonical artifact per contract §11 and the thing Joe opens on a TV-side tablet — tabs do not exist. "Multi-sport day" becomes four files and a table of contents. The summary strip is text, not the grid, so the prime-time overlap question (NHL on ESPN vs SNF on NBC vs Cavs on DAZN, all 7:00–8:20) is answered by reading a list, which is what the grid was built to avoid. The contract's `grids/multi/{date}.svg` slot ends up holding a header. It also multiplies the render step's outputs and the R2 upload count by the number of sports.

---

## 4. Side-by-side

| | 1 Stacked bands | 2 Merged rail | 3 Primary + lanes | **4 Two-band** | 5 Tabs |
|---|---|---|---|---|---|
| Height, literal stress (68 CFB + NFL Sun + NHL + NBA) | ≈ 6,600 | ≈ 5,600 | ≈ 4,700 | ≈ 6,500 | 4,400 per page |
| Height, realistic worst (Dec Saturday) | ≈ 4,300 | ≈ 3,200 | ≈ 2,100 | ≈ 3,900 | ≈ 1,800 per page |
| Height, typical weeknight (NHL + NBA) | ≈ 1,700 | ≈ 1,500 | ≈ 1,100 | ≈ 1,600 | ≈ 1,000 per page |
| ESPN rows on a Saturday | up to 4 | 1 (+ALT) | 1 | 2 | 1 per page |
| New design-language elements | band header | sport tag, unified rail identity | mini-card, lane | sport tag, band header | tab header, summary strip |
| New policy rules | sport order | merged rail order, cross-sport ALT, rail identity | primary-sport rule, lane overflow | band membership, pro rail derivation, cross-sport ALT | tab order, summary rule |
| Preserves CFB Week 1 byte-identity | yes | no (new fixture) | yes (when CFB primary) | yes | yes |
| Preserves CARRIER TBA plate + ATL strip for every pro sport | yes | yes | no (primary only) | yes | yes |
| Answers "what's on ESPN at 8?" in one row | no | yes | partly | yes for pro; college separate | no |
| Web-app fit | poor | good | fair | good (band = section) | best |
| Renderer effort (Claude Code) | small | large | medium | medium-large | small |

Heights use §2's reference scale and are ±15% until the steward substitutes contract values.

---

## 5. Things to build regardless of the choice

- **The "Tonight" summary line** from Option 5 (every receivable game after 6:00 PM, time-ordered, with its row name) is cheap and useful on every option. Recommend it as a header element in v1.7 whichever layout wins.
- **A sport tag on pro cards** is needed by Options 2 and 4 and harmless elsewhere. It must be small — the card silhouette is frozen. Candidates: a two-letter mark in the away-team color band's top-left corner, or a 3-px sport-colored rule along the card's top edge. Joe should see both against a real card before the contract entry is written.
- **Derived rail orders.** Whatever merges, the merged order must be generated from `row_order.json[sport]` by a stated tier rule, with a unit test that the derivation is stable. Hand-maintained merged orders will drift — the changelog already records the alias-table lesson.
- **A height ceiling policy.** No option keeps a 68-game Saturday under 4,000 px. Decide now what degrades first if a ceiling is set (D4).

---

## 6. Recommendation, restated with the trade-offs named

Option 4. It keeps the two things that are already proven (the CFB render and the per-sport pro renders' local/ATL/TBD behavior), adds the one thing that is missing (a single evening picture across the pro leagues), confines every new rule to the small pro rail, and degrades gracefully: on a weeknight it *is* Option 2; on a college Saturday it is Option 1 with the pro leagues merged. Its cost relative to Option 2 is ~150–900 px on college Saturdays and the acceptance that college and pro sit in separate rails on the ~15 days a year both have games.

If Joe's instinct is that Saturday prime time (ABC CFB at 7:30, ESPN NHL at 7:00, DAZN Cavs at 7:30) must be one rail, choose Option 2 and accept the rail-identity unification (D2) as the price. If the SVG is secondary and the web app is the real product, Option 5 plus the Tonight strip is defensible and cheap — but it does not settle §11.9 for the SVG, and the contract's `grids/multi/{date}.svg` would need a definition.

Option 3 I would not build: it spends the design language on the wrong axis. Option 1 is a fallback, not a design.

---

## 7. Decision board for Joe (four questions)

Answer these in order; D1 makes the rest concrete.

**D1 — Layout family.** (a) Option 4 two-band [recommended]; (b) Option 2 fully merged; (c) Option 5 tabs + Tonight strip; (d) Option 1 stacked bands as a stopgap until Milestone 4's web app. If (a), confirm band membership: college = cfb; pro = nfl, nhl, nba, mlb.

**D2 — Row identity on a merged rail.** For the pro band under Option 4: call-sign rows for affiliates (`WOIO 19 / CBS`, `WKYC 3 / NBC`, `WUAB 43`) as NFL and NBA do today [recommended], network-mark rows with the call sign in the footer tray, or network-mark rows with the call sign suppressed. Under Option 2 this question also covers CFB (does Saturday's CBS row become `WOIO 19 / CBS`?) and must be answered for both.

**D3 — Cross-sport collision on one row.** When two receivable games from different sports overlap on the same pro row (ESPN NHL 7:00 + MNF 8:15): (a) later-starting card moves to an ALT lane, same rule as CFB [recommended]; (b) sport-priority order decides who keeps the row and the other goes to Around the League with reason "displaced by {sport}"; (c) treat as a data conflict and route both to TBD. Note (a) requires enabling `alt_lane` for pro sports alongside `market_filter`, a `render_policies.json` change.

**D4 — Height ceiling and degradation.** Is there a maximum SVG height (for the tablet, for the PNG raster, for R2)? If yes, name it, and choose what degrades first when it is exceeded: (a) Around the League collapses to a count; (b) ALT lanes beyond N overflow to a stacked "also on {network}" list; (c) the college band's off-grid games are the first to be omitted; (d) no ceiling — the SVG is as tall as the day.

Optional D5 (only if D1 = Option 5): which page occupies `grids/multi/{date}.svg` — the tab header alone, or the primary sport's page by the Option 3 rule.

---

## 8. Assumptions and open items logged this session

1. Pixel constants in §2 are a reference scale, not contract values (this session cannot read `docs/rendering-contract.md`). Steward: substitute and re-run the arithmetic before the decision session.
2. The literal stress case in the brief (68 CFB + NFL Sunday) cannot occur on one viewing day under the 03:00 ET cutover; the realistic worst is a late-December Saturday. Both are estimated.
3. Row counts for pro sports assume Cleveland-filtered slates of 2–5 on-grid games per sport, consistent with the acceptance renders; a national-view mode (not in scope, decision 1 is market-of-one) would roughly double pro row counts.
4. MLB was included in the pro band's design only as "leaves room"; block minutes 180 and a Guardians local row are the only MLB inputs used.
5. Files were written to `/mnt/user-data/outputs/claude/` (memo + `wireframes/`), not into the Project; the steward session files them under `claude/` and, when the decision is made, records D1–D4 in the spec's decision register (§7.23) and opens the contract v1.7 entry.

---

## 9. Filing note (organization steward)

Suggested placement once decided: this memo → `docs/design/multisport-layout-options.md` in the repo (alongside `docs/multisport-plan-v0.4-draft.md`), wireframes → `docs/design/wireframes/`, and the decisions → spec §7.23 as decision set 8 with a one-line pointer here. The renderer work is a Claude Code prompt (v1.7) that Cowork drafts after D1–D4 are answered and after Milestone 3 part 1 has merged, per the "never write while a prompt is in flight" rule.
