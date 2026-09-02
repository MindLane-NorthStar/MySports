# 04 — What the Home Page Should Be: Options Memo

**Status:** options package for a decision session, written unattended 2026-09-02. House style of `claude/multisport-layout-options.md`. Companion mockups: `mockups/home-page-candidates.html` ("MySports TV — Home Page Candidates"), switchable candidates with a simulated clock. **Set:** `00-README.md` · `01-current-state.md` · `02-comparables.md` · `03-enhancement-specs.md` · **this doc**.

---

## 0. Recommendation first

**Build Option E — a time-adaptive hybrid — as the home page, composed from the locked listings card and three bands that already have specs (E2 On now / Next up, E6 Tonight, E3 access counts), with the archived day grid one tap below on mobile and beside the bands on desktop.** Before 6:00 PM the first band is *Tonight*; inside a game window it is *On now / Next up*; after the last final it is *Finals · then Tomorrow*. Everything else on the page is today's `/` unchanged: sport chips, date strip, sport bands, grid.

Why this and not the "obvious" On-now page (Option C): On now is the right answer for perhaps four hours a day and an empty page for the other twenty. Why not Grid-first (Option B): the grid is the canonical *picture of a day* and it is superb for planning, but it is 1,400+ px wide, needs pinch-zoom on a phone, and answers "what's on at 7:40" only after you have found the 7:30 column — the comparables that lead with a grid are TV apps on a TV. Why not the current page (Option A): `01-current-state.md` §7 shows it fails the couch test on the first screen. Option E is A plus a time-aware first band; it reopens no lock, adds no new silhouette, and degrades to A when the clock is unknown.

Two honest caveats. First, E puts logic between Joe and the list: a wrong clock (a tablet left in Pacific time, a 3:00 AM cutover bug) shows the wrong band, so the band header must always say what time it thinks it is and offer "See all today." Second, E's Tonight band and the §11.9 memo's "Tonight summary line" for the SVG are the same derivation; build it once in the web app and let renderer v1.7 import it, or the two will drift.

---

## 1. Evaluating the current `/`

Today = date strip + sport chips + one band per sport (listings-first on mobile; archived grid above on desktop, "Grid ↓" chip on mobile). What it does well: it is complete, correct, and calm; the card is dense without being loud; the two-week model and History are a tap away; on desktop with a rendered grid it is already the best single-screen picture of a CFB Saturday any comparable offers. Where it fails the 7:40 PM couch test: the first screen is the day's earliest games, not its current ones; there is no state on any card except SCHED/FINAL; off-service games are silently absent on the listing; a first-time viewer cannot tell that the sport chips are the only filter; and on mobile the evening games sit several screens below the fold on a 45-game Saturday.

## 2. What comparables do on landing

| Landing category | Who | "What's on tonight" fitness |
|---|---|---|
| Scores feed (favorites first, news mixed in) | ESPN app home, theScore, Yahoo, CBS, FOX, Bleacher Report, Sofascore/FotMob/FlashScore | poor: the job is scores, not TV; channel is secondary |
| Favorites-first game cards with state | Apple Sports, NHL/MLB/NFL apps | good for *your* teams; blind to the rest of the night |
| "On now" first | On TV Tonight ("On Now" highlights), Roku Sports zone, Apple TV sports tab, Fire TV row, LiveSportsOnTV ("what's live") | best reviewed for the exact job; weak once nothing is live |
| Schedule list by day | ESPN Where to Watch, Sports Media Watch, whereisthegame, sportsgamestoday, Live Sport TV Listing Guide | good and honest; needs a time-of-day filter or a "Tonight" button to be great (both exist in the small apps) |
| Guide grid | On TV Tonight EPG, Fubo, YouTube TV, DIRECTV Stream | best on a TV, worst on a phone; only these see channel conflicts |
| Editorial / news | Bleacher Report, ESPN.com | irrelevant here |

The pattern: the praised "tonight" experiences are *time-anchored lists*, and the two small apps closest to MySports' concept both ship a time-of-day control (a "Tonight" button; morning/afternoon/evening filters). Grids win on TV; lists win on phones; nobody serves both from one page except by putting the list first and the grid a tap away — which is exactly where Joe's locks already sit.

## 3. The candidates

### A — Today, all sports, listings (the current page)

**What it is.** Date strip, sport chips, a band per sport, grid where one exists. **Desktop/mobile.** Already split per the lock. **3:00 AM cutover.** Handled by `viewing_day`. **Empty states.** An empty band with a note; cold. **On-now demands.** None; nothing is live-aware. **Two-week model.** Untouched. **v0.5 programs.** Bookend shows would sit as rows inside the sport band at their times — acceptable. **TV-side tablet.** The desktop layout with the grid above is the best tablet view of any option.

**Pros.** Built. Complete. No logic to be wrong. **Cons (honest).** Fails the couch test on the first screen; no access cue on rows; no state; a 45-game Saturday buries the evening.

### B — Grid-first

**What it is.** The archived (or live-rendered) day grid as the landing picture; listings below. **Desktop.** Natural — this is roughly today's desktop when a grid exists. **Mobile.** Contradicts the listings-first lock; would need the M1–M13 grid as the first screen with a pinned rail and pinch-zoom, and the evening column is still off-screen to the right. **Cutover.** Fine. **Empty states.** A grid with only a footer pill. **On-now.** The grid has no "now" line today; adding a vertical now-marker is a contract entry (v1.7) and is worth doing regardless. **Two-week model.** Unaffected. **v0.5.** Program cards land on the grid natively — this is the option that shows bookends best. **Tablet.** Excellent.

**Pros.** The canonical picture is the first thing you see; the only option that shows network conflicts. **Cons (honest).** Reopens the mobile lock (see `03-enhancement-specs.md` §6.1); phone reading requires zoom; "what's on now" still needs a marker and a scroll; the renderer runs on a cadence, so the landing picture can be hours old on a flex-heavy Sunday.

### C — "On now"

**What it is.** Only what is airing this minute, with score, clock/period, network mark, and deep link; then "Next up." **Desktop/mobile.** Identical, short. **Cutover.** Fine. **Empty states.** Most of the day — Next up alone is a thin page. **On-now demands.** Requires E1 live state and the 15-minute in-window poll; ~150 Actions minutes on a full CFB Saturday if polled naïvely, so the poll must be window-gated. **Two-week model.** Weeks becomes the planning page by default, which is a real change in how the app is used. **v0.5.** Bookends appear as "on now" items naturally. **Tablet.** Good in the evening, bare otherwise.

**Pros.** The best possible 7:40 PM answer; the smallest page; every comparable praised for "tonight" leads with something like it. **Cons (honest).** Empty or near-empty for most of the day; hides the day's shape; makes refresh cadence load-bearing for the front door.

### D — "Tonight" snapshot

**What it is.** The prime window (6:00–11:59 PM) as a time-ordered, access-aware list with "N not on your services · outlets" and why. **Desktop/mobile.** Identical. **Cutover.** Late games belong to the same viewing day — correct. **Empty states.** E10's "next watchable game" line. **On-now demands.** None until the window opens; then it wants E1's state or it reads as stale. **Two-week model.** Unaffected. **v0.5.** Pregame bookends before 6:00 fall outside the window unless the window is per-sport (NFL Sunday's window is 1:00 PM). **Tablet.** Good.

**Pros.** Answers the planning question all day; cheap (no live data); the off-services line is the app's differentiator made visible. **Cons (honest).** Wrong for Saturday noon and NFL Sunday afternoon unless the window is policy per sport/day; once games are live it must turn into C or it lies.

### E — Time-adaptive hybrid (recommended)

**What it is.** One page whose first band changes with the clock: morning → *Tonight* (D); inside a window → *On now / Next up* (C); after the last final → *Finals · Tomorrow*. Below the first band: today's `/` as it is (A). **Desktop.** First band left, grid right when one exists (or grid above at ≤1200 px). **Mobile.** First band, then sport bands, then "Grid ↓". **Cutover.** The band header states the viewing day and the clock it used. **Empty states.** E10 copy. **On-now demands.** As C, but only inside windows; outside windows the page costs nothing. **Two-week model.** Unaffected. **v0.5.** Bookends appear in whichever band their time falls in; the per-sport prime window (NFL 1:00 PM) is a policy row. **Tablet.** The desktop layout.

**Pros.** Right answer at every hour; reuses the locked card and today's page; needs only E1/E2/E3/E6, all specced; no new silhouette; degrades to A. **Cons (honest).** Logic between Joe and the list; three band states to test; the window policy per sport/day is a new data file (`data/render_policies.json: prime_window`); the band must always show a "See all today" escape.

### F — Local-teams-first

**What it is.** Browns, Guardians, Cavaliers, Blue Jackets, Ohio State pinned above everything else, then the rest. **Assumption flagged:** "Joe's teams" is an assumption from the market, not a fact from the docs; treat as a setting, not a rule. **Desktop/mobile.** A pinned mini-band above A or E. **Cutover.** Fine. **Empty states.** On most nights only one local team plays; the pin is one card. **On-now.** None required. **Two-week model.** The pin belongs on Weeks too (E17). **v0.5.** Fine. **Tablet.** Fine. **Multi-user implication.** This is the one candidate that only makes sense for a known viewer; it goes to the appendix if the app ever leaves market-of-one.

**Pros.** Cheap; on a Guardians night it is the whole answer. **Cons (honest).** Duplicates a card that is already in the band; on CFB Saturdays it pins one Ohio State card above 44 others and changes nothing about the couch test; it encodes a preference the docs never state.

## 4. Side-by-side

| | A Current | B Grid-first | C On now | D Tonight | **E Hybrid** | F Local-first |
|---|---|---|---|---|---|---|
| 7:40 PM couch test | fails | partial (needs marker + zoom) | best | fails once live | best | partial |
| Saturday-morning planning | good on desktop | best | poor | good | good | poor |
| NFL Sunday (regional windows) | needs E5 | needs E5 | needs E5 | window policy needed | window policy + E5 | Browns only |
| Empty night | cold | cold | empty | E10 copy | E10 copy | one card |
| New data needed | none | now-marker (contract) | E1 + window-gated poll | none | E1 (windows only) | none |
| Refresh cost | none | none | high unless gated | none | medium, gated | none |
| Reopens a lock | no | **yes** (mobile listings-first) | no | no | no | no |
| New design element | none | now-marker | state pill (E1) | band header | band header + state pill | pin band |
| v0.5 program fit | rows | native | native | window-dependent | window policy | n/a |
| TV-side tablet | good | best | evening only | good | good | n/a |
| Effort (Claude Code) | — | L | M | S | M | S |

## 5. Things to build regardless of the choice

- **E1 card state model** — every option except D benefits, and D lies without it once games start.
- **E3 access glyph and off-services count** — the app's differentiator, invisible on listings today.
- **E4 "data as of"** — cheap trust.
- **A grid "now" marker** (vertical hairline at the current time, gold at 40%) as renderer v1.7 — small, and it makes B, E, and the tablet view all better.
- **A per-sport prime-window policy row** — needed by D and E, useful for the §11.9 Tonight line.

## 6. Recommendation, restated with the trade-offs named

Option E. It is Option A with a first band that knows what time it is, built from cards and derivations that are already specced, and it never reopens the mobile lock. Its cost is a window policy file and the discipline to always show the clock it used. If Joe's instinct is that the grid is the product and the phone is secondary, choose B and accept reopening listings-first plus a now-marker in the contract. If Joe wants the smallest possible page and is willing to pay for in-window polling on the front door, choose C and make Weeks the planning page. D alone is a morning page; F is a setting, not a home page.

## 7. Decision board

**D1 — Home-page family.** (a) E hybrid [recommended]; (b) A + E3/E4 only (no time logic); (c) C on-now with Weeks as planning; (d) B grid-first (reopens the mobile lock). If (a), confirm the three band states: Tonight / On now + Next up / Finals + Tomorrow.

**D2 — Prime window policy.** (a) Global 6:00 PM–11:59 PM ET [recommended default]; (b) per sport-day: NFL Sunday 1:00 PM, CFB Saturday 12:00 PM, weeknights 6:00 PM; (c) "next 6 hours" rolling. (b) is the honest one for football; it adds a policy row.

**D3 — Live state cadence.** (a) 15-minute poll only inside eligible-game windows [recommended]; (b) 15-minute all day on game days; (c) no live state (E1 deferred; the On-now band then shows kickoff-based "in progress" without scores). This is the refresh-economics decision already on the handoff list; answer it here.

**D4 — Off-service games on Today.** (a) filtered by default with a count line and a "show all" toggle [recommended]; (b) always shown, dimmed; (c) as today (absent). Sets the policy for every listing surface.

**D5 — Desktop composition.** (a) first band left, grid right ≥1200 px [recommended]; (b) grid above, band below (today's stacking); (c) band above, grid below.

**D6 — Local-teams pin.** (a) no pin; local teams are just rows [recommended for v1]; (b) pin as a setting defaulting on. If (b), name the teams.

Optional D7 (only if D1 = d): whether the mobile grid becomes the first screen (reopens the lock) or the desktop only.
