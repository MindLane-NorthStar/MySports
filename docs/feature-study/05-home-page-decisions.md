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
- Whether the `YOUR TEAMS` micro-label survives Joe seeing it rendered.

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
