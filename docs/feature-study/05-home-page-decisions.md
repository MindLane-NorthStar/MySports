# 05 — Home Page Decision Board: Rulings

**Decided:** 2026-09-03, Cowork decision session with Joe. **Status:** BINDING. Supersedes `04-home-page-memo.md` §7 wherever the two differ, and supersedes two of that memo's recommendations outright (§3 below). **Companions:** `04-home-page-memo.md` (the options), `03-enhancement-specs.md` (E1–E6), `mockups/home-page-candidates.html` (published as artifact `9a01648a-…`), desktop composition board (artifact `f7d0b1fb-…`).

---

## 1. Rulings

| ID | Decision | Ruling |
|----|----------|--------|
| **D1** | Home-page family | **Option E — time-adaptive hybrid.** Today's `/` with a first band that changes with the clock. Reopens no lock; reuses the locked listings card; degrades to Option A when the clock is unknown. |
| **D1b** | Band states | **Three, as specced.** `Tonight` (before the window) → `On now / Next up` (inside the window) → `Finals · Tomorrow` (after the last final). No "starting soon" fourth state. The band header must always state the viewing day and the clock it used, and always offer "See all today". |
| **D2** | Prime window | **Per sport-day.** `prime_window_start` per sport: NFL 13:00, CFB 12:00, all others 18:00 (local ET). The day's window opens at the earliest start among sports that actually have games that day; it closes at the last program end. Rejected the memo's global 18:00 default — it is wrong for the whole first half of a CFB Saturday and an NFL Sunday, the two days the app matters most. |
| **D3** | Live-state cadence | **Window-gated 15-minute poll on GitHub Actions now, plus an egress probe.** Ship the poll gated to the D2 window (≈900–1,750 of 2,000 free minutes/month). Add one probe stage to the deploy prompt: fetch a known-good ESPN endpoint from Vercel and from a Supabase edge function, report status codes. If 200 → v1.1 upgrades to refresh-on-open with the Actions poll dropped to a 30-minute backstop. If 403 → keep the poll unchanged. **This also closes the refresh-economics item on the handoff list.** |
| **D4** | Off-service games on listings | **Filtered by default, with a count line and a "show all" toggle.** Count line is non-negotiable and reads e.g. `62 games · 8 not on your services · ACC Network, NFL+`. Applies to **every** listing surface — the time-aware band, the sport bands, Weeks, and History — not the home page alone. |
| **D5** | Desktop composition | **Band left / grid right at ≥1,600 px; band above / grid below beneath that.** Never grid-first — that arrangement puts the time-aware band below the fold on a laptop and cancels the D1 decision. |
| **D6** | Favorites placement | **Favorites float to the top of their own sport band.** No separate pin band, no duplicated card. See §2 — the scope of this changed at decision time. |

## 2. D6 as actually decided — favorites, not a local pin

Joe's stated list is thirteen teams across five sports, so this is **not** the market-inferred Cleveland pin the memo described. It is a favorites setting, and it is filed as a stated fact rather than an inference.

| Sport | Teams |
|---|---|
| NFL | Cleveland Browns · Carolina Panthers |
| MLB | Cleveland Guardians |
| NBA | Cleveland Cavaliers |
| NHL | Columbus Blue Jackets · Vegas Golden Knights · Pittsburgh Penguins |
| CFB | Ohio State · LSU · Ole Miss · Tennessee · Ohio (Bobcats) · Fresno State |

**Cowork judgment calls made at decision time (Joe may veto either):**

1. **Ordering.** Floated rows keep chronological order among themselves; the remainder of the band keeps chronological order below them. The band never stops reading as a timeline.
2. **Marker.** The floated group is separated by a hairline rule with a faint uppercase `YOUR TEAMS` micro-label. Without it, six floated CFB cards on a Saturday read as a broken sort. **The marker lives at band level, not on the card** — deliberately, so the locked card contract (v1.6.4 + Mobile Grid Addendum v1.0) is not reopened.

**Implementation traps:**

- **"Ohio" is Ohio University (Bobcats, MAC) — a different school from Ohio State.** A name-based resolver will collapse the two. Resolve by CFBD team id and assert both rows exist and differ.
- "Tennessee" = Tennessee Volunteers (CFB), not the Titans.
- Team ids follow the existing convention: `nfl-{espnId}`, `mlb-{id}`, `nba-{TRICODE}`, `nhl-{nhlId}`, CFB keeps CFBD ints. The favorites file stores **ids**, resolved once from names with the resolution table printed in the run report for Joe to verify.
- The list is a **setting**, editable without a code change. It does not belong in the renderer.

## 3. Corrections to the memo (do not re-inherit the old numbers)

1. **D5 threshold: 1,200 px is wrong; use 1,600 px.** The grid draws at ~1,400 px natural width, and the Mobile Grid Addendum's floor analysis put network call letters below the legibility floor under 80% scale — a 1,120 px minimum grid column. With a 400 px band, a 24 px gap and 48 px page padding: `1,120 + 400 + 24 + 48 = 1,592 px`. At the memo's 1,200 px, the grid gets a ~730 px column and renders at 52% scale.
2. **D2: the memo's recommended global 18:00 window is rejected**, for the reason in the table above. The per-sport row is the honest one and was chosen with its maintenance cost named: every new sport added under v0.5 needs a `prime_window_start` row.

## 4. What this obligates

**Build regardless (from memo §5), now confirmed in scope:**

- **E1** card state model (pre / in / post with score and clock) — D1 and D3 both depend on it.
- **E3** access glyph + off-services count — D4 is E3 applied to every listing surface.
- **E4** "data as of" on listings.
- **Grid "now" marker** — vertical hairline at the current time, gold at 40%. This is a **rendering-contract v1.7** entry, not a web-app change.
- **`data/render_policies.json` gains `prime_window_start` per sport.** This is the same file the v1.7 `open_ended` vs per-sport-key reconciliation touches — **land both in the same change** or the file gets two competing shapes.

**New data files:**

- `data/favorites.json` (or an equivalent settings row) — the §2 list, ids not names.
- `prime_window_start` per sport in `data/render_policies.json`.

**Deploy prompt gains one stage:** the D3 egress probe (Vercel + Supabase edge → ESPN, status codes reported, no behavior change either way).

**Sequencing.** The home page is a **web-app** change and does not need to wait for rendering-contract v1.7; the grid now-marker is the only piece that does. E1 is the shared dependency and should land first.

## 5. Open after this board

- The D3 probe result — decides whether v1.1 moves to refresh-on-open.
- **E5 market-pending state for regional NFL windows is still unruled and is due before Sunday September 13.** It is not part of this board.
- E2/E6 derivation and the §11.9 renderer "Tonight summary line" are the same calculation. **Build it once in the web app and have v1.7 import it**, or the two drift within a month.
- ~~Whether the `YOUR TEAMS` micro-label survives Joe seeing it rendered.~~ **CLOSED 2026-09-03 (prompt 31).** It did not. Joe: *"Your Teams renders in small gray text like an afterthought."* D6 specified it as a faint micro-label separating floated rows *inside* a band; §11's reorder made it the **first heading on the page**, which is a different job. It now takes the band-header treatment — same family, weight, size, letter-spacing and hairline as `.band-title` / `.band-head` — so the page has one heading system. **Cowork's call, one token to reverse:** `--ink` rather than gold, because gold would make the first heading louder than every heading under it and D6's surviving instruction is to avoid decorative treatment here.

---

## 6. D3 AMENDED — 2026-09-03, after the Vercel egress probe

**The probe answered.** `/api/egress-probe` from Vercel region `iad1` returned **200 on all four targets** on the honest adapter UA: ESPN NFL 134 ms / 250,817 B, ESPN CFB 121 ms / 350,058 B, MLB statsapi 98 ms, `api-web.nhle.com` 135 ms / 75,124 B. **Akamai does not block Vercel.** D3 closes on this evidence alone — the Supabase edge-function probe named in the original ruling is unnecessary and will not be built.

**An error in the original D3 wording, named rather than left to surface at implementation.** "Refresh on open" as written implied *writing* refreshed scores into the database. Writing needs the `mysports_writer` credential, which the deployment contract deliberately keeps out of the web app, and it would open serverless connections into a free-plan pool shared with BudgetBuddy. That cost was not priced when D3 was written.

**Joe's ruling: live overlay — no poll, no database write.**

| | |
|---|---|
| **Shape** | The page fetches game state, score and clock from the providers when it renders, caches ~60 s, and overlays them on what the database already holds (schedule, teams, networks, finals). |
| **Canonical data** | Unchanged. The daily Actions refresh still writes finals the next morning; the database remains the source of truth for everything except the in-flight score. |
| **In-window Actions poll** | **Never built.** The 900–1,750 minutes/month Actions budget question is void. |
| **Credentials** | No writer credential on Vercel, ever. The deployment-contract rule stands unamended. |
| **Connections** | No serverless connections into the shared free-plan pool. |
| **Supabase edge function** | Not needed, not built. |

**Named cost.** A second, narrow reader of the same provider payloads now exists in JavaScript alongside the Python adapters. It reads **only** state, score and clock — three of the five sports share the identical ESPN shape, so it is roughly 60 lines, not a second adapter. **It must be tested against the same recorded fixtures the Python adapter tests use**, so the two cannot silently disagree. That test is an acceptance item for the home-page implementation prompt.

Mobile Grid Addendum M11's 15-minute in-window client refresh is unaffected: the client re-requests on its own cadence, and each request returns data fresh within 60 seconds.

## 7. Deployment facts settled the same day

- Production: **https://my-sports-xi.vercel.app** — project `my-sports`, Vercel **team** `mindlane-northstar` (Pro), Root Directory `web`, the four `NEXT_PUBLIC_*` variables set explicitly.
- **Deployment protection: leave Vercel Authentication on Standard Protection.** The project settings page offers only two levels — Standard Protection, and All Deployments behind a paid add-on. Standard Protection exempts the production alias (the UI names `my-sports-xi.vercel.app` as the publicly accessible domain) while keeping preview and per-deployment URLs behind Vercel login. That is exactly the intended posture. *(An earlier instruction to select "Only Preview Deployments" was wrong — that option appears in Vercel's knowledge base but not in the project settings page.)*
- **Open privacy item before the Cavs season starts (late October):** a public production URL publishes whatever the app displays. Confirm that no loaded broadcast row exposes the unannounced WUAB/RESN arrangement, or keep those rows suppressed until the public announcement.

---

## 8. E5 RULED — 2026-09-03. Market-pending is a third state

E5 was the last unruled item on the enhancement register. Prompt 20's eligibility census forced it.

**The finding.** Sunday September 13, NFL Week 1: **13 games, 2 eligible, 11 "not on your services" — on FOX and CBS**, networks Joe has. The count is not wrong about how many he can watch; most Sunday NFL games genuinely do not air in Cleveland, and saying so is this app's whole differentiator. But it asserts a certainty the data does not have: **`market_coverage_nfl` is empty**, because the 506sports regional maps do not publish until roughly September 8. Those eleven games are not *unavailable*. They are *not assigned yet*.

**And it recurs every week of the season.** Regional maps publish midweek for the coming Sunday, so every Monday through Wednesday the upcoming Sunday sits in exactly this state. Under D4's filter-by-default, that would hide most of the Sunday slate for the first half of every week.

**Ruling: market-pending is a third state.** A regional game with no market assignment yet is **neither watchable nor off-service**. It is:

- **always shown, never filtered** — in any surface, in any toggle state;
- marked with a **"market TBD"** cue;
- **counted on its own line**, never inside "not on your services";
- **self-resolving** — the moment the 506sports map loads into `market_coverage_nfl` the game becomes eligible or genuinely out-of-market, with no manual step.

**D4 carve-out.** Filter-by-default applies to genuinely ineligible games only. Market-pending games are exempt from it.

**Count line shape:**

```
Sun Sep 13 · 13 games
  2 on your services
  3 market pending · FOX, CBS — map publishes ~Wed
  8 not on your services · FOX, CBS, NFL+
```

**Register note.** With E5 ruled, `enhancement-register.md` §11 no longer states spec status. Status lives only in this record, so the register cannot go stale behind it.

---

## 9. NETWORK TBD RULED — 2026-09-03. The announcement horizon is a fourth state

The 2026-09-03 season load took `games` from 375 to ~1,379 and immediately exposed a state the app had no vocabulary for.

**The finding.** A read-only diagnostic found **529 games with zero `game_broadcasts` rows**. This is not a load failure — it is a **broadcast-announcement horizon**. CFB is fully assigned through week 3 and falls off a cliff at week 4 (0% → 5% → 61% → ~75% bare), which is precisely a two-to-three-week network-announcement window. NFL is fully assigned through week 15 and week 18 is **100% bare because the league deliberately leaves it flex-scheduled**. NHL and NBA are bare because their seasons have not started. MLB is 0% bare because its RSN deals are static.

**What the app said about them.** All 529 were `eligible = false`, `market_pending = false`, and therefore hidden by D4 and counted as off-service. Season-wide that is **737 of 1,379 games hidden (53.4%), of which 529 — three-quarters of everything hidden — were hidden merely for not being announced yet.** The rendered line for `2027-01-10` was `16 games · 16 not on your services` on a completely empty page. Every word of it is false: it is a full NFL slate, most of which Joe will be able to watch, and the app stated he could watch none.

**Why E5 cannot cover it, structurally.** `is_market_pending()` iterates active broadcast rows looking for `access_status = 'unverified'`. An empty list means the loop body never executes, so the answer is `False` **by construction** — confirmed at 0 of 529. No amount of tuning the market-pending access set reaches a game with no rows.

**And it must not be stretched to cover it.** The two states answer different questions:

| | Market pending (§8) | Network TBD |
|---|---|---|
| Known | **Who** is airing it (FOX, CBS) | Nothing |
| Unknown | Whether Cleveland gets that feed | Whether **anyone** is airing it |
| Resolved by | `market_coverage` — 506sports maps, ~Wed | The network announcing a window |

Calling a week-18 NFL game "market pending" would be a **second false certainty**: it asserts a broadcaster exists whose regional split is undecided, when no broadcaster has been named.

**Ruling: NETWORK TBD is a fourth state.** A game with zero active broadcast rows is neither watchable nor off-service. It is:

- **always shown, never filtered** — in any surface, in any toggle state, exactly as market-pending games are;
- marked with a **`NETWORK TBD`** cue, chosen to pair with the existing `MARKET TBD` badge;
- **counted on its own line**, never inside "not on your services";
- **self-resolving** — the moment the network announces and a broadcast row loads, the game becomes eligible, market-pending or genuinely out-of-market with no manual step.

**Mutual exclusivity is guaranteed by construction and must be asserted in a test.** Market-pending requires a broadcast row carrying `access_status = 'unverified'`; network-TBD requires **zero** rows. No game can be both, and no card may ever render both badges.

**D4 carve-out, extended.** Filter-by-default applies to genuinely ineligible games only. Both market-pending and network-TBD games are exempt from it.

**Count line shape:**

```
2026-11-14   56 games · 6 available to you · 42 network TBD · 8 not on your services
2027-01-10   16 games · 16 network TBD
2026-09-03   68 games · 62 available to you · 2 market pending · 4 not on your services
```

Zero-count segments remain omitted.

**Rejected alternatives, on record.** *Horizon collapse* — dropping the availability breakdown entirely on far-future days (`56 games · networks not announced yet`) — was rejected because it suppresses the six games that day that **do** have networks and that Joe can watch. *Hiding them behind "Show all"* was rejected because it guts the calendar half of the product: the Weeks page would show almost nothing for November.

**Grid consequence (Cowork's call, open to veto).** A network-TBD game **cannot be placed on the grid** — the grid is organized into network rows and there is no network — so it would silently vanish from the grid while appearing in the list (14 on the grid against 56 in the list on 2026-11-14). The grid therefore renders one honest line naming the count, e.g. `42 games not on the grid · network TBD`, omitted when zero. A literal "TBD" network row was rejected: a grid row is a channel you can tune to, and inventing one breaks that contract.

**A data-layer bug found alongside it, fixed in the same prompt.** 78 of the 529 read `reason = "no national telecast - out of market"` — `pipeline/reconcile.py`'s non-CFB else-branch asserting an out-of-market **conclusion** from an **empty** broadcast list. The 78 reconcile exactly to nfl 24 + nhl 38 + nba 16; CFB's 451 correctly read `no telecast observed`. The guard belongs in the reconciler, not in the web layer, and its sanity gate is inverted: **if the count of genuinely unavailable games falls, the guard is over-broad and is eating real out-of-market verdicts.**

---

## 10. COUNT LINE AMENDED — 2026-09-03, after prompt 25's 390 px measurement

Prompt 25 measured the §9 count line at 390 px on 2026-11-14. `56 games · 6 available to you · 45
network TBD · 5 not on your services` renders **404 px against 366 px of available width** — two
lines, with the "Show all" toggle pushed to a third. A day carrying both market-pending and
network-TBD games reaches an estimated 427 px even with the total removed, so dropping the total
alone does not close it.

**Joe's ruling: the count line is a summary, not a full accounting.**

    6 airing · 48 TBD · 5 unavailable

Three changes from the §9 shape:

1. **The total is dropped.** It is duplicated one scroll above by the Today page's `<p class="sub">`
   ("56 games on this viewing day"), and the three segments sum to it.
2. **Market-pending and network-TBD are summed into one `TBD` figure.** §9's objection was to
   *labelling* a network-TBD game "market pending" — asserting a broadcaster exists when none has
   been named. A neutral `TBD` asserts neither. The distinction is not lost: it moves to the card,
   which keeps `MARKET TBD` and `NETWORK TBD` as two separate badges, mutually exclusive by
   construction, with prompt 24's test unchanged.
3. **The wording shortens** to `airing` / `TBD` / `unavailable`.

**Cost named at decision time, and accepted.** `airing` is true of all 56 games — six of them are
airing *on services Joe has*. `unavailable` reads as "not on television" rather than "not on your
services". Both amend D4's language, which deliberately said "available to you" and "not on your
services" because this product's differentiator is access, not broadcast. Joe ruled for brevity on a
line that has to survive a 56-game November Saturday at 390 px, with the trade-off on the record.

**This supersedes D4's count-line wording and §9's count-line shape. The four states themselves, the
D4 filter carve-outs for market-pending and network-TBD, and the card badges are untouched.**

Zero-count segments remain omitted.

---

## 11. MOBILE PAGE ORDER RULED — 2026-09-03. This supersedes D6's placement.

**Joe's ruling, and it is the source of truth: the page reads YOUR TEAMS → grid → everything else.**

D6 ruled that favourites float to the top of their own sport band, with no separate pin band and no
duplicated card; the reasoning on record was that the band never stops reading as a timeline. That
placement is superseded. The reasoning that produced it was not wrong — it was answering where
favourites sit *within* a band. This ruling answers where they sit *on the page*, and it wins.

**The shape.**

1. A page-level **YOUR TEAMS** section carrying Joe's favourites across every sport, in chronological
   order among themselves.
2. The **grid**, where one renders.
3. The **sport bands**, in the existing SPORTS order, carrying everything else.

**Structural consequence, named because it is larger than the ruling sounds.** A page-level
favourites section and D6's in-band float cannot both exist without either duplicating the card —
which D6 rejected and this ruling does not revive — or holding a JS width state, which this app
deliberately avoids: every breakpoint in it is CSS-gated at 699 px precisely so there is no
server/client hydration mismatch. **So the favourites section moves to page level at every width and
D6's in-band float is retired.** What stays mobile-only is the *grid's* position — hoisted above the
bands at <=699 px with CSS `order`, left below them above it, so the DOM is written once.

**Counting.** Each section counts what it shows. The YOUR TEAMS section carries its own count line;
each sport band counts only the games still in it. Every number then describes the rows beneath it,
which is the property that made the count line trustworthy in the first place. A band reading
`8 airing · 2 TBD` beside a YOUR TEAMS section reading `3 airing` is correct and adds up; a band
whose count includes rows that are not in it would not be.

**What survives from D6 unchanged:** the favourites list and its thirteen teams; ids not names; the
"Ohio is Ohio University, not Ohio State" trap; chronological order among the floated rows; the
marker living at section level and never on the card, so the locked card contract stays closed; and
the rejection of a duplicated card.

**Consequence for the jump chip.** With the grid second on a phone, `Grid ↓` has almost nothing to
jump past. Retire it at <=699 px.

**Desktop.** D5's band-left / grid-right composition at >=1600 px is untouched by this ruling. What
changes above the breakpoint is only that favourites are a page-level section rather than a float
inside each band.

**STATUS: RULED AND DOCUMENTED, NOT BUILT.** The implementation rides prompt 27 deliberately. It
changes which games each count line covers, and prompt 26 §10 is already changing what that line
says; landing both in one unattended run means a mid-run stop leaves it unclear whether a wrong
number came from the merge or from the reorder.
**Scope clarification (added at implementation).** §11 governs the **Today page (`/`)** only. `/weeks`
and `/history` group rows by day, and hoisting a favourite out of its day would destroy the thing
those pages exist to show — a calendar. They keep the in-band float they have today, which on those
pages floats within a day rather than within a sport. D6's float is therefore retired on `/` and
retained on `/weeks` and `/history`.

## 12. DATE / WEEK HEADERS CARRY THE PICKER — 2026-09-04, Joe's ruling from the installed app

The Today heading no longer prints the viewing day and the Weeks heading no longer reads
"Weeks". Each reads a single word in the heading style — `DATE` on Today, `WEEK` on Weeks,
no colon — and the page's picker sits directly to its right on the same line, centered on the
heading's text box. The row is the first block on the page, above the ALL bar and the tiles.

Three earlier rulings are amended:

1. **Prompt 31 stage 3's Day row is retired.** The `Day` label, the date input's row below the
   tiles, and the `N broadcasts` count text are gone. The count duplicated what the bands
   already say (`6 airing · 48 TBD · 5 unavailable`) and Joe ruled it eliminated.
2. **Prompt 25 §4b's "keep the Day label" no longer applies** — the reason it existed (a
   control whose own text is a date needs a visible name) is now carried by the heading,
   which is the control's `<label>`.
3. **Prompt 36 C1–C3 keeps its week-format rules**; only the position of the picker and the
   heading text change. `WeekSelect`'s real `<label htmlFor="week-select">` survives as the
   heading.

History's heading is deliberately unchanged; Joe will rule on it separately.

## 13. SECOND INSTALLED-APP REVIEW — 2026-09-05, Joe's rulings, shipped in prompt 46 stage 1

1. **Headroom.** The installed-app addition above the banner is 4 px, not 7 (half of prompt 45's
   addition; Joe: "too much space").
2. **Header row breathes evenly.** The space between the tab row's hairline and the DATE / WEEK /
   HISTORY header row equals the space between that row and the ALL SPORTS bar.
3. **One control block.** The space between the tile row and the first section below it equals
   the space between the ALL SPORTS bar and the tile row. Joe's item 6 (use the YOUR TEAMS→card
   distance) was superseded by his item 8; the first-section rule is written so the D1 band
   inherits it.
4. **Pickers.** Both pickers render a styled trigger with the native control invisible on top
   of it, so iOS keeps its wheel and calendar. WEEK: `NFL Week 1` / `CFB Week 1` in gold, the
   date range in the standings-line gray; calendar weeks show only the range in the trigger's
   ink. DATE: `Friday, September 4, 2026`, the same pill and chevron as WEEK.
5. **Season-week block headings** are two lines: the sport-week line, then the range. The
   sport-week line is gold (Cowork's call, matching the picker; open to veto).
6. **Grid cards:** a space before the record; an all-zero record is absent (contract v1.6.14).
7. **List card venue** is one step brighter than the standings lines (token recorded in the
   commit).

---

## 14. THE SCHEDULE HUB — 2026-09-06, prompt 50. One page, and four earlier rulings amended

The app is now **one route**. `TODAY`, `WEEKS` and `HISTORY` are no longer places; they are `?mode=`,
`?day=` and `?w=` on a single page whose entire state is the query string. Joe's ruling **R1**
(`docs/hub/restructure-triage-2026-09-05.md` §6a), built by prompt 50 stage 1.

The controls read downward as a sentence, and the order **is** the ruling:

```
DAY | WEEK                                   the time prism
ALL GAMES | MY TEAMS · LIST VIEW | GRID VIEW scope and presentation, one row
ALL SPORTS bar                               full width, 24px tall
the eight league tiles                       unchanged, 44px
the picker, with ‹ and ›                     BELOW the tiles, which is the change
the schedule
```

### What this supersedes

**§11's page order is superseded — but only partly, and the difference matters.** §11 ruled the page
reads YOUR TEAMS → grid → sport bands, with favourites hoisted into a page-level section. R4 replaces
that section with the **MY TEAMS scope**: `?scope=mine` shows favourites only, chronological across
every sport in DAY mode and per day group in WEEK mode.

> **BUILT — prompt 51 stage 4a (`a2eb11c`).** Prompt 50 built the *scope* only, and left the
> page-level section rendering under ALL GAMES, so both mechanisms were on screen at once; no stage
> of prompt 50 was scoped to remove it. Prompt 51 retired the section and restored **D6's in-band
> float** in its place: favourites rise to the top of their own sport band under a hairline and a
> faint uppercase micro-label, **at band level, with the card untouched** — which is the one part of
> D6 that survived §11 unchanged and is what keeps the locked card contract closed.
>
> Verified on three days: the page-level section renders **0** times, and the band marks and their
> hairlines render 3 / 2 / 1 on 2026-09-05, -09-06 and -09-07.
>
> The other half — the five team-less sports joining the scope — landed in the same commit; see
> `docs/enhancement-register.md` §18d.

**§10's count-line vocabulary is superseded.** `6 airing · 48 TBD · 5 unavailable` — Joe's own
wording from prompt 26 — becomes one line at the **foot of the page**:

```
68 games on your services · 2 TBD    Show 18 not on your services
```

Two of §10's three segments went by consequence rather than preference. `unavailable` became the
reveal control, and `airing` went back to **`on your services`**, which is D4's original phrase;
§10 had shortened it only to fit a 390px band header, and at page level there is room for the
accurate word again. The `· N TBD` segment is **Cowork's call, open to Joe's veto** — his renderings
show one segment, but without a second the line undercounts what is on screen by a factor of six on
a day like 2026-11-14.

**"Every band reports its counts" is retired** with the per-band lines. That was `4250aa9`, carried
on the handoff as do-not-regress since prompt 21. One page-level line replaces it.

**§12's DATE / WEEK headings are retired.** The `DAY | WEEK` toggle sits one row above the picker and
says the same word, so repeating it was noise. Prompt 45's ruling is superseded. The headings were
real `<label htmlFor>` elements, so both pickers are now named by `aria-labelledby` pointing at the
matching segment of that toggle — the name is still visible, still says what the control selects,
and is still said exactly once.

### D4 is restored in full, and R3b is reversed

R3b — *show everything, dim off-service rows in place* — **is reversed and was never built.** Games
on services Joe does not have are **hidden by default**, exactly as D4 ruled.

**The reason is measured, not aesthetic.** `docs/hub/hub-audit-2026-09-05.md` §I rendered the
heaviest loaded week under ALL both ways:

| | hidden (D4) | shown (R3b) |
|---|---|---|
| cards | 109 | **195** |
| DOM nodes | 3,038 | **5,344** |
| page height | 17,971 px | **32,917 px** |

32,917 px is a 39-screen page on a 390 × 844 phone, past the point Chromium will rasterize in one
pass. Prompt 50 stage 4 reproduced both figures exactly. **The day-strip mitigation the audit floated
for WEEK + LIST is therefore not needed and was not built.**

**Three carve-outs are unchanged and are not negotiable**, now enforced in one place
(`splitHidden()`, `web/lib/offservice.js`) instead of per band:

- **NETWORK TBD (§9)** is never hidden. Hiding a game because you cannot watch it, when nobody has
  decided whether you can, is a false statement about 529 of them.
- **MARKET PENDING (§8, E5)** is never hidden.
- **A favourite** is never hidden, even off-service.

Both card badges survive untouched, and prompt 24's mutual-exclusivity test is still green.
`viewer_game_eligibility` remains the sole source of the verdict and is never recomputed in JS.

**D6's in-band favourites float is NOT yet retired on the hub** — see the note above. It still runs
in every `SportBand` that receives `floatFavorites` at its default, which includes the D1 band and
every WEEK day group.

### What is unchanged

**D1's first band stays** (R2), atop DAY + LIST when the selected date is today, with "See all today"
intact. It does not render in GRID VIEW, because there is no list beneath it to jump to.
**D5's 1592 px composition is untouched.** **D2, D3 and the four broadcast/access states are
untouched.** History is retired as *navigation only*: a past `day` renders that day's finals with
their scores and box-score links through the same card, and `/history` still resolves — it redirects.
Its cross-date `?q=` search does **not** survive (R8) and is held as a MY TEAMS sub-feature in
`docs/enhancement-register.md` §17.
