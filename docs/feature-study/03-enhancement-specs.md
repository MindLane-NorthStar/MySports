# 03 — Candidate Evaluation and Enhancement Specs

**Set:** `00-README.md` · `01-current-state.md` · `02-comparables.md` · **this doc** · `04-home-page-memo.md`. Scored through the market-of-one lens: Joe, Cleveland, his access profile, his viewing habits as the docs describe them.

## 0. Recommendation first

Build five things before spec v0.5, in this order, because together they close the couch-test gap and they all ride on data the loaders already fetch: **E1 card state model (pre/in/post with score and clock)**, **E2 "On now / Next up" slice**, **E3 access state on every row plus the off-services count**, **E4 "data as of" on listings**, and **E5 market-pending state for NFL regional windows** (needed by September 13). Build **E6 Tonight snapshot** as part of the home-page decision (`04-home-page-memo.md`). Ride **E7 program bookends in the on-now slice** and **E8 A/H feed notation** on v0.5. Defer the calendar, reminder, and crew features to "Later" — they are cheap but they are not what is wrong with the app today. Everything that needs an account, a second market, or a second user goes to the appendix.

## 1. Consolidation

The 23 harvest items collapse to 16 distinct candidates. Removed as already covered:

- Deep link to stream, "watch on" chooser with access verdict (H14) — built: detail panel WATCH map + DIRECTV Stream fallback (M11).
- Odds, probables, box score link, archive, week views — built.
- Off-service games counted — built on the grid (omitted pill, contract v1.4); the *listings* half is candidate E3.
- Weather chip (H23) — decided against, contract §3; appears only in §6.
- Multiview (H21) — out of scope; no video.
- Non-game programs (H-matrix row) — specced, v0.5; only the *display* of them inside E2/E6 is a candidate (E7).

## 2. Scoring

0–3 on value to Joe, purpose fit, data feasibility, design fit (inside the locked language = 3; new element = 1), inverse effort (S=3, M=2, L=1, XL=0). Classification: **Build now** (before v0.5) · **Build with v0.5** · **Later** · **Multi-user appendix** · **Reject**.

| ID | Candidate | Value | Purpose | Data | Design | Inv. effort | Total | Class |
|---|---|---|---|---|---|---|---|---|
| E1 | Card state model: pre / in / post, score + clock in right column | 3 | 3 | 3 | 3 | 2 | 14 | Build now |
| E2 | "On now / Next up" slice above listings | 3 | 3 | 3 | 2 | 2 | 13 | Build now |
| E3 | Access state on every row + "N off your services · outlets" line on Today | 3 | 3 | 3 | 3 | 3 | 15 | Build now |
| E4 | "Data as of" + next-refresh on listings surfaces | 2 | 3 | 3 | 3 | 3 | 14 | Build now |
| E5 | Market-pending state for regional NFL windows | 3 | 3 | 2 | 2 | 2 | 12 | Build now (by Sept 13) |
| E6 | "Tonight" snapshot section (prime window, access-aware, off-grid count) | 3 | 3 | 3 | 2 | 2 | 13 | Build now (home-page decision) |
| E7 | Program bookends inside on-now/tonight (GameDay, pregames) | 2 | 3 | 1 | 1 | 1 | 8 | Build with v0.5 |
| E8 | A/H feed notation for locals in the tray and detail | 2 | 3 | 3 | 2 | 3 | 13 | Build with v0.5 (segments/broadcast windows land then) |
| E9 | Last play / last scoring play line (detail panel first) | 2 | 2 | 3 | 2 | 2 | 11 | Later |
| E10 | Empty-state "next watchable game" | 2 | 3 | 3 | 3 | 3 | 14 | Build now (rides E6) |
| E11 | ICS feed of watchable games | 2 | 2 | 3 | 3 | 3 | 13 | Later (one Actions step) |
| E12 | Kickoff reminders / change alerts (push) | 2 | 2 | 2 | 2 | 1 | 9 | Later (needs a push channel; ntfy or iOS shortcut) |
| E13 | Announcer crew line (detail; tray later) | 2 | 2 | 1 | 2 | 2 | 9 | Later (source is 506 Archive + press rooms; weekly) |
| E14 | Injury / lineup status in detail | 1 | 1 | 2 | 3 | 2 | 9 | Later |
| E15 | History grouped by day with grid thumbnail | 2 | 3 | 3 | 3 | 2 | 13 | Later (after deploy) |
| E16 | Local-teams pin (Cleveland teams first) | 2 | 2 | 3 | 2 | 3 | 12 | Home-page candidate F; see memo |
| E17 | Home-screen widget / Live Activity | 1 | 1 | 1 | 1 | 0 | 4 | Reject for v1 (needs a native app) |
| E18 | XMLTV export | 1 | 1 | 3 | 3 | 3 | 11 | Later, only if a TV-side EPG appears |
| E19 | Notification muting per sport | 1 | 1 | 3 | 3 | 3 | 11 | Rides E12 |
| E20 | Multiview launcher | 1 | 0 | 0 | 0 | 0 | 1 | Reject |
| E21 | Accounts, favorites, sharing, multi-market maps | — | — | — | — | — | — | Multi-user appendix |

## 3. Deep specs

Template per spec: story · surfaces · interaction · data (source, cadence, additive schema, refresh economics) · rendering-contract impact · mobile (M1–M13) · acceptance · effort · sequencing · risks · Claude Code prompt stub. The stubs follow prompt 15's shape: staged, self-committing, secret gate, acceptance, push and verify. Stubs assume HEAD e759e8e and 131 green tests; adjust the preconditions line before running.

### E1 — Card state model (pre / in / post)

**Story.** At 8:05 PM Joe glances at the Guardians card and sees "TOP 6 · 3–2" instead of "SCHED"; at 10:40 it says "FINAL 5–2"; at 11:00 AM it showed the probables and the line. Same card, three states.

**Surfaces.** Listings card right column (all views); detail panel header; renderer tray (state pill, PC and mobile) at a later contract version.

**Interaction.** None new. The right column is read-only; tap still opens the detail panel.

**Data.** Source: ESPN scoreboard `status.type.state` (`pre`/`in`/`post`), `status.displayClock`, `status.period`, competitors' `score`; MLB statsapi `linescore.currentInning`, `inningState`, `outs`; NHL api-web `clock`, `period`. Cadence: the planned 15-minute in-window poll; daily otherwise. Additive schema: `games.live_state text` (`pre`/`in`/`post`), `games.live_clock text`, `games.live_period smallint`, `games.live_detail text` (provider's short detail, e.g. "Top 6th", "2nd 4:12"), `games.live_updated_at timestamptz`. Loader-written provider facts (doctrine 0007/0008); never reconciled. Refresh economics: no new HTTP calls — the fields are in the scoreboard payload already fetched; the cost is the polling cadence itself (~3 min/run × 4 runs/hour × in-window hours; a 12-hour CFB Saturday ≈ 150 Actions minutes, so the in-window cadence must be gated to viewing-day windows, not the clock).

**Rendering-contract impact.** Web card: none to the locked geometry — the right column already switches among odds / SCHED / FINAL; this adds an IN variant (period + clock over score) at the same size. Renderer: a new entry (v1.7 candidate) for a state pill in the tray; not required for the web change.

**Mobile.** Right column width unchanged (M13 inherits the card). Tier shrink unaffected. Score digits use Barlow Condensed 700 at the odds line size.

**Acceptance.** For a live MLB game the card shows inning/half and score; for a live CFB game quarter + clock + score; for finals `FINAL` + score without leaving Today; `pre` shows odds or SCHED exactly as now; a stale `live_updated_at` (> 20 min inside a window) renders the state dim with a "stale" hairline.

**Effort.** M. **Sequencing.** Before Vercel deploy is fine; it is a web + loader change. **Risks.** ESPN clock semantics differ by sport (MLB has no clock); halftime/intermission strings vary; the in-window polling budget is the real constraint and belongs in the refresh-economics decision.

**Prompt stub.**
```
Prompt E1 — Live state on cards (unattended). Preconditions: git status clean; tests 131 green. Rails: each stage commits + pushes; secret gate (findstr for CFBD_API_KEY=, SUPABASE_DB_URL=postgresql://, R2_SECRET_ACCESS_KEY=) before every commit; no schema DDL outside migration 0010; Windows Python; never print .env.
STAGE 1 — migration 0010_live_state.sql: add games.live_state, live_clock, live_period, live_detail, live_updated_at (nullable). Apply via psql. Commit "0010: live state columns".
STAGE 2 — adapters: map ESPN status/linescore/api-web clock into the five columns in load.py (loader-written, never reconciled). Unit tests: pre/in/post mapping per sport, MLB inning string, null-safety. Commit.
STAGE 3 — web card right column: IN variant (period/clock over score), FINAL with score, stale rule (>20 min). Screenshots of one live-simulated fixture per sport to artifacts/qa/<date>/. Commit.
STAGE 4 — refresh_runs: log which window triggered the poll. Acceptance: paste a live row; paste screenshots; tests ≥ 135. Final report; note refresh-economics numbers observed.
```

### E2 — "On now / Next up" slice

**Story.** Inside a game window, Today opens with a short band: every game airing this minute on Joe's services, each with score/clock, network mark, and a Watch button; beneath it "Next up" lists the next two kickoffs. Outside a window the band collapses to "Next up."

**Surfaces.** `/` (top of stage, above sport bands); mobile first screen; TV-side tablet.

**Interaction.** Watch button = the curated WATCH map deep link (same as the detail panel); card tap = detail panel; a "See all today ↓" chip jumps to the bands. Sport chips filter the slice too.

**Data.** Derived from E1 (`live_state = 'in'`) plus `viewer_game_eligibility` and `start_time`. "On now" = `live_state='in'` OR (`pre` and start within 10 min); "Next up" = next two eligible starts after now. No new columns. Clock source = client time in ET with the 3:00 AM cutover rule.

**Rendering-contract impact.** None (web only). The slice uses the locked card; the band header is the existing `secthead` style.

**Mobile.** The slice is above the listings, so listings-first is preserved by construction (it *is* listings). M9 header stacking applies. Cap the slice at 4 cards; overflow = "+N more on now" chip.

**Acceptance.** At a simulated 7:45 PM ET on September 5 with the study fixture, the slice shows the 7:00/7:30 games on ESPN, FS1, ABC, NBC, ESPNU, ACCN, SECN (eligible) and not the SECN+ ones unless eligible; "Next up" shows 8:00 BTN games; at 11:00 AM the slice is "Next up: 12:00 …" only; on an empty day it shows E10's copy.

**Effort.** M. **Sequencing.** After E1; part of the home-page decision. **Risks.** A wrong client clock (tablet in another zone) — pin to ET explicitly; the cutover rule must match the DB's viewing-day derivation.

**Prompt stub.**
```
Prompt E2 — On now / Next up (unattended). Preconditions: E1 merged; tests green.
STAGE 1 — web/lib/onnow.js: pure function (games, nowET) → {onNow[], nextUp[]} with the 10-minute pre-window and 3:00 AM cutover; unit tests with the Sept 5 fixture at 11:00, 19:45, 23:30 ET.
STAGE 2 — `/` renders the slice above bands (max 4 + overflow chip), locked card, Watch button from WATCH map; sport chips filter it. Playwright screenshots at 1440×900 and 390×844 for the three clock values (add a ?now= query param, dev only).
STAGE 3 — empty state per E10. Acceptance: screenshots pasted; build clean; smoke 30/30. Commit, push, report.
```

### E3 — Access state on every row + off-services count

**Story.** Every listing row says whether Joe can watch it; Today's band header says "12 on your services · 33 not on your services (SECN+, MW+, ESPN+ overflow)". The list stays filtered to eligible games by default; a "show all" toggle reveals the rest, dimmed.

**Surfaces.** Listings card (grey network line gets an access glyph), band headers on `/` and `/weeks`, detail panel (already has AVAILABLE / CHECK ACCESS).

**Interaction.** "Show off-service games" toggle in the band header, remembered in session. Dimmed rows still open the detail panel (which explains why).

**Data.** `viewer_game_eligibility` (exists) joined to each game; outlets list for the count from `game_broadcasts`. Additive: none. Cadence: existing.

**Rendering-contract impact.** None for the grid (the omitted pill already exists). Card: the network line gets a leading glyph — a small gold check for included, a dim slash for unavailable. This is a **new micro-element** inside the card's network line, not a new silhouette; it should be shown to Joe on the prototype before the web change (same rule as the program card).

**Mobile.** Glyph is 10 px in the network line; no width impact.

**Acceptance.** Band header counts match the grid footer's pills for the same day/sport; toggle reveals dimmed rows; screenshots both states.

**Effort.** S. **Sequencing.** Now. **Risks.** Rows can carry several outlets with mixed access — the glyph follows the primary (first eligible) outlet; the detail panel lists all.

**Prompt stub.**
```
Prompt E3 — Access on rows (unattended). STAGE 1 — join eligibility into the listing query; add access glyph to the card network line (gold check / dim slash; 10px; recipe in web/lib/marks). STAGE 2 — band header "N on your services · M not on your services · {outlets}" using the same derivation as the renderer's footer pills (import, do not re-implement). STAGE 3 — "Show off-service games" toggle; dimmed rows at 55% ink. Acceptance: counts equal footer pills for 2026-09-05 cfb; Playwright both states; tests +3. Commit/push per stage; secret gate; report.
```

### E4 — "Data as of" on listings

**Story.** A one-line footer under each band: "Data as of 7:32 PM ET · next refresh 7:45" so a 15-minute-old score reads as 15 minutes old.

**Surfaces.** `/`, `/weeks`, `/history` footers; detail panel.

**Data.** `refresh_runs` is intentionally unreadable to anon; expose a `mysports.public_refresh_status` view (workflow, finished_at, next_expected_at) with anon SELECT. Additive; one view. Cadence: written by the refresh job.

**Rendering-contract impact.** None (the PC grid already carries "data as of").

**Mobile.** Footer pill wraps per M9.

**Acceptance.** Line present on all three routes; matches the newest `refresh_runs` row.

**Effort.** S. **Sequencing.** Now. **Risks.** None material.

**Prompt stub.**
```
Prompt E4 — Data-as-of (unattended). STAGE 1 — migration 0011_public_refresh_status.sql: view over refresh_runs (workflow, finished_at, computed next_expected_at from the cron table); grant select to anon via RLS policy. STAGE 2 — web reads it server-side; footer line on /, /weeks, /history and in the detail panel. Acceptance: smoke asserts the view returns ≥1 row; screenshots. Commit/push; secret gate; report.
```

### E5 — Market-pending state for regional NFL windows

**Story.** From Thursday through the 506 map drop, Sunday's 1:00 and 4:25 FOX/CBS games render as "market pending" (all four FOX 1:00 games listed with a dim "one of these on WJW 8 — map posts Wed" note) rather than as certain or absent. When the map lands, `market_coverage_nfl` resolves them.

**Surfaces.** `/` Sunday listing; `/weeks` season week; grid TBD section (network-tbd bucket already exists: "KICKOFF/NETWORK TBA").

**Data.** `schedule_certainty` (planned column) gets a `market_pending` value; `market_coverage_nfl` populated from 506 weekly (already planned; Week 1 maps post September 9). Additive: enum value + the coverage table already specced. Cadence: weekly Wednesday fetch, Sunday-morning re-check.

**Rendering-contract impact.** Grid: reuse the TBD bucket with a new reason label "MARKET PENDING" (contract entry v1.7 candidate, text only). Card: state pill `MARKET TBA` in the right column (same style as SCHED).

**Mobile.** M7 TBD section handles it.

**Acceptance.** September 10 render of viewing day September 13: Browns game certain on WOIO 19 / CBS; four FOX 1:00 games grouped under one MARKET PENDING note; after ingesting a map fixture, exactly one seats on WJW 8 / FOX and the others move to Around the League with reason "out of market".

**Effort.** M. **Sequencing.** Before September 13; needs the 506 egress/parse step that is already on the calendar. **Risks.** 506's HTML changes; parse must be tolerant and fail to "pending," never to "certain."

**Prompt stub.**
```
Prompt E5 — Market pending (unattended, due before Sept 13). STAGE 1 — schedule_certainty adds 'market_pending'; adapters/espn-nfl sets it for regional CBS/FOX games without a coverage row. STAGE 2 — pipeline/market_nfl.py: fetch 506 week map (egress 506sports.com), parse Cleveland DMA cell, write market_coverage_nfl; tolerant parser; unit tests on a saved HTML fixture. STAGE 3 — web + renderer: MARKET PENDING grouping (card pill; grid TBD bucket label). Acceptance as in spec; screenshots; commit/push/report.
```

### E6 — "Tonight" snapshot

**Story.** Any time before 6:00 PM, Today's first band is "Tonight": every eligible game starting 6:00–11:59 PM, time-ordered, with a count of what is off-grid in that window and why. After 6:00 PM the band becomes E2's "On now."

**Surfaces.** `/` first band; TV-side tablet.

**Data.** Same as E2/E3. Window bounds are policy (6:00 PM start; configurable in `data/render_policies.json` as `prime_window`).

**Rendering-contract impact.** None (web). Note the §11.9 memo's "Tonight summary line" for the renderer header is the SVG twin of this band; build the web band first and let v1.7 reuse the derivation.

**Mobile.** As E2.

**Acceptance.** 11:00 AM September 5 fixture: Tonight lists the 7:00–10:30 eligible games in order with the off-services line; 7:45 PM: replaced by On now.

**Effort.** M (shares E2's derivation). **Sequencing.** With the home-page decision. **Risks.** Late-night west-coast games (10:30 PM ESPN) belong to Tonight; the 3:00 AM cutover keeps them on the same viewing day — correct.

**Prompt stub.** Extend E2's `onnow.js` with `tonight(games, nowET, window)`; band render; screenshots at 11:00 and 17:59 ET; commit/push/report.

### E7 — Program bookends inside On now / Tonight (rides v0.5)

**Story.** On a CFB Saturday the 9:00 AM band shows "College GameDay · ESPN · live from Columbus" as a program card above the noon games; on NFL Sunday, "FOX NFL Sunday" precedes the 1:00 window.

**Surfaces.** `/` slices; grid bookends (v0.5 program card).

**Data.** `programs` supertype (migration 0009), `program_type='studio_show'`, `parent_program_id` → slate; hosts/location from public announcements via the weekly watch task (register §7 Q5).

**Rendering-contract impact.** The program card silhouette (register §9 Q8, prototype-first, then v1.7). This spec adds no new element; it places the card in the slice.

**Mobile.** Program card must obey the same tier-shrink and right-column rules; the right column shows the show's window ("9–12") instead of odds.

**Acceptance.** GameDay row appears above the noon games on the Sept 12 fixture once v0.5 data exists.

**Effort.** S once v0.5 and the card exist. **Sequencing.** After prompt 16 + program-card design. **Risks.** None beyond v0.5's own.

**Prompt stub.** After 0009: `onnow.js` treats programs with `on_site` as eligible items; render program card variant in slices; screenshot; commit/push.

### E8 — A/H feed notation (rides v0.5 broadcast windows)

**Story.** For a Guardians game with a national FOX window and a local feed, the tray/detail reads `FOX · A Sportsnet · H Guardians TV` — national first, then away feed, then home feed — and the card's grey line shows the feed Joe will actually watch under `suppresses_local_feed`.

**Surfaces.** Detail panel broadcast list; card network line; renderer tray streamer chips.

**Data.** `game_broadcasts.feed_side` (planned), `broadcasts.window_start/window_end` (v0.5). Additive: none beyond planned.

**Rendering-contract impact.** Tray text rule only (v1.7 note).

**Acceptance.** Detail panel orders outlets national → A → H; suppressed local feed shows dimmed with "suppressed by national feed".

**Effort.** S. **Sequencing.** With 0009. **Risks.** MLB statsapi's `homeAway` on broadcasts is reliable; CFB/NFL rarely have A/H splits.

**Prompt stub.** Order broadcasts by (national, away, home); render notation in detail + tray; tests on the Sept 3 Guardians fixture; commit/push.

### E9 — Last play line (Later)

Detail panel gets one line: the provider's last play text (`situation.lastPlay.text` on ESPN; MLB `liveData.plays.currentPlay` via the game feed, one extra call). Value is real on the couch; deferred because it needs per-game polling beyond the scoreboard for MLB. Stub: add `games.last_play text` + `last_play_at`; ESPN only first; detail panel line; 15-min cadence.

### E10 — Empty-state copy (Build now, rides E6)

"Nothing on your services tonight. Next watchable game: Fri 9:00 PM · Miami @ Stanford · ESPN." Derived from the next eligible game across days (needs the week's data loaded, which `/weeks` already fetches). Acceptance: a fixture day with zero eligible games renders the line; the grid footer's omitted pill still shows the count. Effort S.

### E11 — ICS feed (Later)

Emit `mysports-watchable.ics` to the R2 public bucket from the daily refresh (one Actions step; `icalendar` lib), one VEVENT per eligible game with network and deep link in DESCRIPTION, `SEQUENCE` bumped on time changes. Joe subscribes once from the phone. Effort S; deferred only because it is not the couch problem.

### E12 — Reminders / change alerts (Later)

Kickoff-minus-30 and change alerts (flex, postponement, carrier change) need a push channel; the cheapest unattended path is an ntfy topic posted from the refresh job. Effort M; deferred behind E1–E6 and behind the reminder half of E11 (a calendar alarm gets 80% of the value for free).

### E13 — Announcer crews (Later)

Source: 506 Archive pages for national broadcasts (weekly), network press rooms for the rest. Land in `game_broadcasts.crew text[]`; show in the detail panel first; the tray only if Joe wants it (it competes with the pills' drop priority). Effort M; the watch task already fetches press rooms for v0.5, so the marginal cost is the 506 parser.

### E15 — History grouped by day with grid thumbnail (Later)

Group `/history` by viewing day; each day header carries the archived grid's thumbnail (R2 SVG rasterized at refresh time to a 320-px PNG) and the finals beneath. Unique to MySports; no comparable groups by archived render. Effort M; after deploy.

## 4. Catalog (one line each, the rest)

E14 injury/lineup status — 9 — Later — Apple Sports, ESPN summary · E16 local-teams pin — 12 — home-page candidate F — Apple Sports/LiveSportsOnTV favorites · E17 widget/Live Activity — 4 — Reject v1 — Apple Sports · E18 XMLTV — 11 — Later — iptv-sports-epg · E19 mute per sport — 11 — rides E12 — FotMob/Sofascore complaints · E20 multiview — 1 — Reject — Fubo/YouTube TV · E21 accounts/favorites/sharing — appendix.

## 5. "If ever multi-user" appendix

Not dropped, not specced: accounts and per-user access profiles (deployment contract D4 is deliberately market-of-one); favorites and "my teams" as data rather than assumption (E16 assumes Joe's teams); per-user notifications (E12 becomes a fan-out); multi-market coverage maps (the 506 parser would need every DMA, and RSN attribution per market is the high-staleness category); sharing a day's grid or a card (the archive URL is already shareable; a share sheet is the multi-user version); labeled sport chips and onboarding (a first-time user cannot read five league icons); localization of the 3:00 AM ET cutover to the user's zone.

## 6. Challenges to locked decisions (evidence only; no specs)

1. **Lock:** listings-first on mobile in every view (prompt 15 stage 3). **Evidence:** every comparable that serves the "shape of the day" job (EPGs, Fubo, YouTube TV) leads with the grid, and Joe's own Saturday-morning journey wants the picture, not the list. **Gain from reopening:** the planning case on Saturday mornings. **Loss:** the evening case, which is most days, and the M1–M13 investment in a grid that is one tap away anyway. **Verdict offered:** do not reopen; the time-adaptive default in `04-home-page-memo.md` gets the morning case without touching the lock.
2. **Lock:** weather not shown on cards (contract §3). **Evidence:** ESPN and Apple Sports show it; Consumer Reports' complaint pool does not mention it. **Gain:** small, for outdoor CFB in November. **Loss:** tray pill budget. **Verdict:** leave locked.
3. **Lock:** sport chips are league icons without labels (design lock, v0.2). **Evidence:** App Store complaints about "can't find" in ESPN; no comparable uses unlabeled icons alone. **Gain:** legibility for anyone but Joe. **Loss:** header width on 390 px. **Verdict:** market-of-one says leave it; appendix item.
4. **Lock:** the omitted pill is the only place an off-service game is acknowledged (contract v1.4). **Evidence:** the single most common complaint in every review pool is not knowing a game exists elsewhere. **Gain:** E3 puts the same acknowledgment on Today's listings. **Loss:** none — E3 extends the rule to listings rather than reopening it. **Verdict:** treat E3 as an extension, not a challenge; noted here because it touches a "the only place" wording.
5. **Lock:** 2/3-height network mark on the card (working lock). **Evidence:** none from comparables argues either way. **Verdict:** nothing to reopen.

## 7. Data opportunities (enrichment without a new feature)

- **ESPN scoreboard status fields** (state, clock, period, last play, win probability) — already in the payload; add columns (E1). Egress: none.
- **ESPN `summary?event=`** — injuries, leaders, box score JSON; one call per eligible game after final could replace the external box-score link with an in-app box score later. Egress: none new; verify from the runner.
- **506 Archive** — crews for national broadcasts; weekly. Egress: `506sports.com`.
- **Network press rooms** — already in the watch task for v0.5 hosts/sites; extend to crews.
- **Team ICS feeds** — cross-check for kickoff changes; low marginal value.
- **Sports Media Watch daily page** — a human-curated national/A/H list; a good weekly cross-check for `feed_side` correctness, not a source of record.
- **Outputs, not inputs:** ICS (E11) and XMLTV (E18) exports from the renderer's data are free once the data exists.
