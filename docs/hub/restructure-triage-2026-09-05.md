# Schedule Hub restructure — triage of the ChatGPT spec against the decision record

**Date:** 2026-09-05, ~3:45 PM ET · **Method:** Joe's audit-triage method (docs/audit-triage-2026-09-03.md): bucket every section A (already built) / B (already ruled, reopening test applied) / C (new and valid) / D (new and wrong), measure before believing, locked items flagged not reopened. **Venue:** Cowork triage; Claude Code does the code-level audit and the build.

**Tree read at `1b20768`…`0014` (read-only, 15:44 ET).** A Claude Code prompt was committing while this was written (`db: 0014 eligibility rows for programs` landed at 15:43 ET), so line numbers below are a snapshot. Nothing here wrote to the repo.

**Input:** `MYSPORTS_UI_RESTRUCTURE.md` (ChatGPT, "Schedule Hub UI Restructure & Implementation Specification") plus its §35 kickoff prompt. Note the kickoff says "Read `CLAUDE.md`" — **the repo has no CLAUDE.md**; the equivalent is `docs/handoff-status.md` (working rules 1–28) and the two rendering contracts.

---

## 0. Recommendation

**Do not hand the spec to Claude Code as written.** Rule on the eight forks in §5 first, then run ONE read-only Claude Code audit prompt scoped to the questions only the code can answer (§6), then build in phases (§7).

Why: the spec was written blind to the decision record. Of its 36 sections, roughly a third ask for things that already exist, a third reopen rulings Joe made in the last 72 hours (four of them shipped in the last 36 hours — D1's first band, the DATE/WEEK headers, ALL SPORTS bar, the styled pickers), and its centerpiece — WATCH LIVE — depends on the direct-to-player links, which do not exist and whose decisive phone test (feasibility study §5) has not been run. Handed to Claude Code cold, its own §0 rule would make CC stop on every one of those and hand them back — a full run spent rediscovering what memory already holds. The architecture idea itself is sound and Cowork recommends adopting it.

**What the spec gets right, and it matters:** one route with three orthogonal selectors is the correct model for this app, and it is the ONLY structure under which the sticky two-axis grid (§18) is buildable without JavaScript scroll-syncing — see C-3.

---

## 1. What the tree actually is (verified, file:line)

- **Routes:** `/` Today, `/weeks`, `/history` — `web/lib/routes.js:8–12`, the single definition. Banner v2 + `.homenav` tab row on every route (prompt 43, `c1d9955`). Standalone PWA (`display: standalone`), start_url `/`.
- **State = the URL, nothing else.** `?day=`, `?sport=`, `?q=` via `useSetParam` → `router.push` (`web/components/Filters.js:11–20`); `?w=` on Weeks (`WeekSelect.js:50`). **No `localStorage`/`sessionStorage` anywhere** (grep of `web/`). Back/forward and deep links work by construction.
- **Today (`web/app/page.js`):** `DATE` heading + picker (153–154) → ALL SPORTS bar + 8 tiles (161) → **D1 FirstBand** (three states, "See all today" escape, header states day + clock — 178–180, shipped `569aef0` 2026-09-05) → `#all-today` Listing with `grid bands` (183–184) → DataAsOf → `ArchivedGrid` (desktop, per sport, PNG; honest empty line when none — 57–86). `.today-split` goes two-column at 1592 (D5, `globals.css:1873`).
- **Listing (`web/components/Listing.js`):** YOUR TEAMS section (121–125) → sport bands in `SPORTS` order (126–130) → MobileGrid; CSS `order` lifts the grid to second at ≤699 (109–116; `globals.css:2033`). **MobileGrid is mobile-only** (`.mgrid-only` hidden above 699, `globals.css:2017–2019`). `GameDetail` is one shared `position: fixed` panel (156–158).
- **List card:** the entire card is `<button className="mcard" onClick={() => onOpen(game)}>` — `MatchupCard.js:267`. Tap = detail panel. Contract v1.6.15, locked.
- **Grid block:** `onClick={() => onOpen?.(game)}` — `MobileGrid.js:554`; TBD cards the same (422). Tap = detail panel (Addendum M11).
- **Watch links today:** `GameDetail.js:130–166` "Where to watch" — `watchUrl(service_id)` returns a curated **service home URL** or `DIRECTV_STREAM` (`config.js:193–194`), opened with `target="_blank"`; the panel's own copy: *"Watch links are best effort - they open the service, not this game"* (210). **Every link in the app is HUB rung. No event-level or player-level link exists.**
- **Grid scroll architecture:** `.mgrid-scroll { overflow-x: auto; overflow-y: hidden }` (`globals.css:1113–1117`) — ONE horizontal scroller; the rail is `position: sticky; left: 0` inside it (1133–1135); the time axis `.mgrid-axis` sits inside the canvas (`MobileGrid.js:336`); **the page is the vertical scroller.** Zoom is layout-driven, no transform (prompt 30; M4 v1.2 forbids any transform between rail and scroller). **No NOW marker, no scroll-to-now** (grep).
- **Weeks (`web/app/weeks/page.js`):** the sport chooses the week concept — ISO Mon–Sun for ALL and non-provider sports; provider weeks for NFL/CFB (CFB week 1 = Aug 29 → Sep 7, ten days; NFL weeks run Thu→Mon). `?w=` names the week; grouped `<select>` picker; days grouped through Listing → SportBand with the day heading in the band-header row (47–60). **No prev/next controls.**
- **History (`web/app/history/page.js`):** `finalGames` flat, newest first, PAGE_SIZE 60 (36–38); **a cross-date `SearchBox` (`?q=`, "Team or network…", 49)**; sport filter; cards open the panel, box score is a link inside it (8–9).
- **Date picker:** native `<input type="date">` behind a drawn face (`Filters.js:37–46`) — iOS keeps its wheel. **No ‹ › arrows.**
- **States in data:** `games.result_status ∈ {scheduled, in_progress, final, postponed, cancelled}` (migration 0007); clock/period are overlay-only display values; stale-LIVE guard 8 h. Broadcast/access: `viewer_game_eligibility.eligible`, `market_pending` (E5), network-TBD (zero broadcast rows, §9) — **four states, mutually exclusive by construction, each ruled.** The count line "6 airing · 48 TBD · 5 unavailable" is Joe's own wording (prompt 26), and "every band reports" (`4250aa9`) is a do-not-regress.
- **Data scale since last night:** `games` 1,384 → **3,868** (NHL 1,344 + NBA 1,206 loaded via Actions, `34aaef0`). A mid-season week under ALL now holds roughly 200+ games.

---

## 2. Bucket A — already built (the spec asks for what exists)

| Spec | What exists |
|---|---|
| §12 DAY + LIST for past/today/future | `?day=` on Today; live overlay only when day == today; finals from the DB. |
| §13 DAY + TV GRID | Phone grid, ALL and per-sport (prompt 36 D3). Desktop = archived PC render per sport. |
| §14 WEEK + LIST grouped by day, sport filter, favorites | `/weeks` exactly; favorites float in-band within a day (05 §11 scope). |
| §16's data | `data/favorites.json` (13 teams) + `splitFavorites()`; not page-coupled — Listing does the split (71–75). |
| §22 URL/state model | Already URL-only; nothing to migrate except the route names. |
| §24 event-state audit | Done: five `result_status` values, overlay clock, four broadcast/access states. **`delayed`, `halftime`, `suspended` do not exist and prompt 29 ruled not to add states to satisfy a list.** |
| §19 timezone research | Settled: ET everywhere, 03:00 ET viewing-day cutover (`gridmodel.js`), "All times are Eastern" footnote. No ambiguity to surface. |
| §21 breakpoints | One CSS gate at 699/700 (no JS width state, by design — hydration), plus 1592 for D5. |
| §26 partial | 44 px targets at ≤699 (prompt 25), `aria-pressed` on tiles, real `<button>`s, `aria-expanded` on the count toggle. |
| §27 partial | `restAll()` pagination (rule 19); text measurement memoised; grid lane packing minute-based. No virtualisation anywhere — fine at day scale. |

---

## 3. Bucket B — already ruled (reopening test applied)

**B-1 · §8 horizontal scrolling sports rail.** Joe rejected a scrolling row on 2026-09-03 ("I find it very annoying"); prompt 31 built eight flexed tiles that fit every width under a full-width ALL bar (renamed ALL SPORTS in prompt 45). The spec supplies no new fact → **ruling stands.** The spec's goals (no wrapping tiles, ALL first, unmistakable selected state) are already met by the bar-plus-tiles shape.

**B-2 · §10 remove the count line / status copy.** The spec's premise — "current data structures conflate game state, broadcast state and access state" — is **false**: they are three separate axes in data (§1 above), and the count line is a summary Joe worded himself on 2026-09-03 after seeing the render. D4 ruled the off-service count essential ("without it the page lies by omission"); E5 and §9 added the two TBD states precisely so the line never claims a watchable game is unavailable. "ON NOW" is D1's band title. Reopening test: aesthetic preference, no factual error, no unpriced consequence → **ruling stands** unless Joe reopens it deliberately (decision Q3). The honest version of the spec's ask is *where* the line sits, not whether the facts exist.

**B-3 · §20 "no special Home page" and §11 "content starts immediately after controls" vs D1.** D1 (Option E, time-adaptive first band: Tonight → On now/Next up → Finals·Tomorrow) was ruled 2026-09-03 and **shipped last night (`569aef0`)** with the header stating day + clock, which Joe reconfirmed on 2026-09-05. The spec does not know it exists. This is a real fork, not a misreading: the spec's §12 asks for exactly what D1 delivers ("live events may rise toward the top… investigate stronger ordering") and then §20 argues against having it. **Decision Q2.**

**B-4 · §7 "eliminate redundant DATE/WEEK heading text."** Prompt 45 (`e5ff931`, Joe's ruling 2026-09-04: "the heading is the word DATE and the picker sits on the heading's own line") shipped 36 hours ago. **Legitimate reopen IF the hub is adopted**: the ruling's premise was a page named by its heading; under a DAY|WEEK segmented control the mode is the label and the heading becomes the redundancy the spec describes. Flagged, not reopened here.

**B-5 · §2 LIST|GRID toggle vs "LISTINGS FIRST everywhere on mobile (grid below/behind)" and 05 §11's page order (YOUR TEAMS → grid → bands).** A presentation toggle retires §11's interleaving on the phone — grid becomes its own view, not a section. **Legitimate reopen IF the hub is adopted**, and it is the change that makes C-3 buildable. Flagged.

**B-6 · §4.2 grid body tap launches the broadcast.** Addendum M11 makes the block tap open the detail panel (`MobileGrid.js:554`) — the panel carries box score, odds, every watch option and the standings lines. The spec anticipated this exact conflict. **Decision Q7.**

**B-7 · §15 MON…SUN day strip.** The two-week model (provider weeks CFB/NFL, ISO weeks otherwise) is ruled and shipped; a Monday–Sunday strip cannot represent CFB week 1 (ten days) or an NFL week (Thu→Mon). Not a conflict once the strip is built from the week's real span — `daySpan(w.start, w.end)` already exists (`weeks/page.js:174`) — i.e., 7 to 10 day chips, labelled by weekday+date. **Ruling stands; the strip follows the span.**

**B-8 · §6 default and persistence.** URL-only is the convention; standalone reopens at start_url. Recommend **no persisted preference** — DAY is the default, WEEK rides the URL. Consistent, shareable, nothing new to test.

**B-9 · §19 NOW marker.** Already an open item bound to rendering-contract v1.7 (handoff Open list). Building it in the hub pulls one v1.7 item forward; the timezone research the spec demands is already settled. Fine if Joe agrees it rides the hub rather than v1.7.

**B-10 · §5 utilities.** There are no settings; the only search is History's `?q=`. Nothing else to "audit and preserve."

---

## 4. Bucket C — new and valid

**C-1 · The hub itself.** One route with `?mode=day|week`, `?day=`, `?w=`, `?sport=`, `?scope=all|mine`, `?view=list|grid` (names are CC's to settle; the convention is `useSetParam`). `/weeks` and `/history` become redirects (`next.config.mjs` `redirects()` or route-level `redirect()`); `routes.js` collapses to one entry and `nav.test.mjs`'s route-graph test is re-based, not weakened. Market-of-one: the only inbound link is Joe's home-screen icon at `/`, so redirect risk is nil. `display: standalone`'s "every route must be escapable" becomes trivially true.

**C-2 · Prev/next day and week arrows.** Do not exist (D-3). Small, valuable, and the drawn-face Picker pattern (prompt 46 1C) already gives the face; arrows are two more `setParam` calls. Day arrows step viewing days; week arrows step through the sport's own week list (`all[]` on the Weeks page), so an NFL week steps to the next NFL week, not seven days.

**C-3 · Sticky two-axis grid — requires a structural refactor, and the hub is what makes it possible.** Verified: `.mgrid-scroll` is a scroll container (`overflow-x: auto`), so a `position: sticky; top: 0` axis inside it sticks to *that* container's scrollport — which never scrolls vertically — and never to the viewport. Three options: (a) **the grid owns its vertical scroll** — when `view=grid` the grid is a `height: calc(100dvh − controls)` container scrolling both axes, with the axis sticky-top, the rail sticky-left and the corner sticky-both, z-index corner > axis > rail > blocks, opaque backgrounds; (b) lift the axis out of the scroller and sync `scrollLeft` in JS (jank, and it fights the layout-driven pinch zoom); (c) leave the page as the vertical scroller and give up the sticky axis. **Recommend (a)** — it only works because the grid becomes a view of its own (B-5); interleaved between sections (today's layout) it cannot own the viewport. CC must design it against the pinch handler (`touch-action`, two-finger vs scroll), M4 v1.2's no-transform rule, `dvh` for Safari chrome, and the frozen geometry tripwire.

**C-4 · NOW marker, scroll-to-now on entry, jump-to-now.** New. Time math is `makeScale`/`scale.toX(minute)` in MobileGrid; clock is the server request time (same discipline as D1's `bandState`: computed once, no hydration path).

**C-5 · WEEK + GRID day strip.** New. Default active day: today if inside the selected week, else the first day with games; Cowork's recommendation, one line to change if Joe prefers "last selected."

**C-6 · MY TEAMS as a scope.** Data exists; the UI mechanism is new and interacts with the YOUR TEAMS section — **decision Q4.** Under WEEK, MY TEAMS = the in-band favorites float, filtered. Under GRID, MY TEAMS = grid rows filtered to favorites' games (the rail shrinks to their networks).

**C-7 · WATCH LIVE — valid intent, BLOCKED today.** Every link in the app is HUB rung (§1). Under the spec's own rule (§25: "a UI promising Watch Live must not misrepresent the actual destination") **nothing in the app can honestly carry a WATCH LIVE label until the direct-to-player build exists**, and that build is gated on feasibility §5A (DIRECTV channel IDs) and §5B (the phone test of Universal Link hand-off from the standalone app). Two further facts from the code: (i) the card is a single `<button>` (`MatchupCard.js:267`), so a floating control inside it is a button inside a button — invalid HTML and a screen-reader trap; it has to be a positioned sibling over the card, or the card's button has to become an inner element; (ii) the "upper-right of the network icon area" is **already occupied** — prompt 37 B3 put the MARKET TBD / NETWORK TBD badge at `top: 4px; right: 66px` over the mark column (rendered by the row wrapper's `::after`). A live regional game with an unresolved map can carry both. And (iii) any launch control must be a plain `<a href>` to the provider's final URL with **no `target="_blank"`** — the feasibility study's Gate 1 — which also means the existing panel links (`GameDetail.js:159–166`, `target="_blank"`) need the same fix in the Function 1 build. **Decision Q6.**

**C-8 · Grid WATCH LIVE banner — measure before designing.** The banner sits "above the away/home divider" — that divider is `.mhair` between two **team-colour bands** (prompt 35's lighter-of-the-two rule, 357 teams). A semi-transparent gold strip is invisible on a gold band (Steelers, Michigan, LSU…) and low-contrast on white/yellow ones; the ink rule was measured to 3.0:1 over all 357 and the banner must be too. And block height is **frozen** (prompt 35 hard stop: lanes/widths/scrollWidth identical), so the banner must live inside the existing block, overlaying the hairline, not adding to it.

**C-9 · Desktop TV GRID has no live grid to attach anything to.** Above 699 the grid is `ArchivedGrid` — a PNG from `generated_grids`, per sport, none for ALL. Sticky axes, NOW marker, WATCH LIVE banners and click-to-launch are all impossible on a PNG. **Decision Q5.**

**C-10 · WEEK + LIST performance at 3,868 games.** A mid-season week under ALL is ~200+ cards (NHL ~50, NBA ~55, NFL 16, CFB ~60, MLB in September). Each card runs canvas text measurement (`useTextMeasurer`) and re-tiers on font load (v1.6.13 known cost). The Weeks page already renders that many today, so the baseline exists — CC must measure before/after rather than assume; if it is slow the honest levers are per-day lazy render or a day strip for WEEK+LIST too, never dropping card data.

**C-11 · Segmented controls at 360/390.** Two 2-way controls on one row at 390 leaves ~90 px per segment with 44 px height; "LIST VIEW" and "ALL GAMES" in Barlow Condensed 700 at ~13 px fit, at 360 it is tight. CC measures; if it fails, two rows, not smaller type (the spec agrees).

**C-12 · History's search.** `?q=` team-or-network text search across every completed game (`history/page.js:36–49`) is NOT equivalent to picking a past date — the spec's §17 asks exactly this. Under the hub, "the Guardians' last result" is MY TEAMS + ‹ week. **Decision Q8** on whether `?q=` survives as a utility.

**C-13 · Accessibility of the new controls.** Segmented controls as `role="radiogroup"`/`aria-pressed` buttons, arrow keys optional; WATCH LIVE with an accessible name that states the rung ("Watch live on ESPN — opens the ESPN app"); the sticky grid's axis must remain in the accessibility tree; live state must not be colour-only (E1's clock pill already satisfies this).

---

## 5. Bucket D — new and wrong (false premises in the spec)

- **D-1** "My Teams should no longer require a separate top-level page" — there is no My Teams page; there is a page-level section (05 §11).
- **D-2** "Utility actions such as search/settings may remain" — no settings exist; the only search is History's.
- **D-3** "Previous/next day controls should remain easy to use… week-picker/calendar affordance if supported" — no prev/next controls exist; the pickers are a native date input and a native `<select>` behind drawn faces.
- **D-4** MON–SUN strip — see B-7.
- **D-5** "delayed / halftime / suspended" — not states in this app; do not add (prompt 29 ruling).
- **D-6** "current data structures may conflate…" — they do not (three axes, four ruled broadcast/access states).
- **D-7** "The current design contains… ON NOW" as redundant copy — that is D1's band title, shipped last night by Joe's ruling.
- **D-8** "list virtualization if any" — none; not a defect at day scale.
- **D-9** §29 reference renderings and `/docs/ux-reference/` — not attached, folder does not exist. If they exist, Joe supplies them; if not, the spec's layout descriptions are the only reference and that is fine.
- **D-10** "Read `CLAUDE.md`" — no such file; the working-rules authority is `docs/handoff-status.md`.

---

## 6. Decisions for Joe (only the ones that change the build)

**Q1 · Adopt the hub?** Retire `/`, `/weeks`, `/history` as destinations in favour of one route with DAY|WEEK · ALL GAMES|MY TEAMS · LIST|TV GRID. *Recommend YES.* It is the right model, it is what makes the sticky grid buildable (C-3), and the URL-only state model absorbs it cleanly. Everything below assumes yes.

**Q2 · D1's first band under the hub.** (a) *Recommended:* keep it as the top of DAY + LIST when the date is today — it IS the spec's §12 "live rises to the top" and §20's "10 AM Tuesday / 8 PM Friday" behaviour, already built and clock-tested; the "See all today" escape stays. (b) Retire it (shipped last night; `bandstate.js` fixtures would be deleted). (c) Keep it but only in ALL GAMES scope.

**Q3 · The count line ("6 airing · 48 TBD · 5 unavailable").** (a) *Recommended:* keep as is — it carries D4/E5/§9 and every number is a ruled state. (b) Keep the facts, move the line (it already sits in the band-header row; the spec's complaint is mostly the old Day-row count, which prompt 45 deleted). (c) Retire it — reopens D4, E5 and §9 explicitly.

**Q4 · MY TEAMS mechanism vs the YOUR TEAMS section.** (a) *Recommended:* the toggle REPLACES the section — ALL GAMES shows sport bands only (favorites marked in place, per D6's original hairline + micro-label at band level; card untouched); MY TEAMS shows favorites only, all sports, chronological. One mechanism, one count line per band, no game shown twice. **Named plainly: this retires 05 §11's page-level YOUR TEAMS section on Today, which Joe called "our new source of truth" on 2026-09-03 — the toggle is what supersedes it, and the D6 in-band marker it revives was itself retired by §11.** (b) Keep the section under ALL GAMES *and* add the toggle — two answers to the same question on one screen. (c) Keep the section only; drop the toggle (spec §16 not built).

**Q5 · Desktop TV GRID.** (a) *Recommended:* phone-first — TV GRID above 699 shows the archived PC render for a single sport (as today) and an honest line for ALL; sticky/NOW/WATCH LIVE are phone features until a desktop live grid is its own project. Consistent with the spec's "mobile is the priority" and with Function 1's only ruled surface (the iPhone standalone app). (b) Promote the live JS grid to desktop now — bigger job; the Mobile Grid Addendum's M1–M18 are phone deviations, so a desktop mode needs its own contract work.

**Q6 · WATCH LIVE sequencing and label policy.** (a) *Recommended:* build the hub WITHOUT WATCH LIVE; run feasibility §5A/§5B first; when the rungs exist, WATCH LIVE appears only for PLAYER-rung destinations (DIRECTV channel tune, ESPN `showWatchStream`, Netflix `/watch/`, MLB `/tv/g`), and EVENT/HUB rungs get "OPEN ESPN"/"OPEN DIRECTV" — or no floating control at all, with the panel still listing them. (b) Build WATCH LIVE now pointing at the service home pages — violates §25 and the panel's own honesty copy; Cowork advises against.

**Q7 · Grid body tap.** (a) *Recommended:* keep tap → detail panel (M11); the WATCH LIVE banner itself is the launch target (it is a distinct element, so one block has two targets: banner = watch, body = detail). (b) Spec literal: whole body launches when the banner is present, detail panel reachable only via long-press or a corner affordance.

**Q8 · History's cross-date search (`?q=`).** (a) Retire it — MY TEAMS + ‹ week covers "last result", and the count/filters cover networks. (b) Keep it as a small utility in the header row, on every mode. Cowork has no strong view; Joe uses it or he does not.

**Also needed, not a fork:** do the §29 reference renderings exist? If so, where — they go in `docs/ux-reference/`.

---

## 6a. JOE'S RULINGS — 2026-09-05, ~4:00 PM ET (binding; supersede the options above)

- **R1 (Q1) — HUB ADOPTED.** One route; `/weeks` and `/history` become redirects.
- **R2 (Q2) — D1's first band STAYS**, atop DAY + LIST when the selected date is today. "See all today" stays.
- **R3 (Q3) — THE COUNT LINE IS RETIRED.** Named at decision time and accepted: this reopens D4, E5's count segment and §9's count segment. **R3b (Q3b) — D4's filter-by-default is retired with it: SHOW EVERYTHING, off-service rows DIMMED in place** (the existing revealed-state styling); no toggle, no count, nothing hidden. MARKET TBD / NETWORK TBD badges stay on the card (E5 and §9 survive as card states; only their count segments go). `viewer_game_eligibility` remains the source of the dim state — never recomputed in JS. "Every band reports" (`4250aa9`) is retired with the line.
- **R4 (Q4) — THE MY TEAMS TOGGLE REPLACES THE YOUR TEAMS SECTION.** ALL GAMES = sport bands only, favorites marked in place at band level (D6's hairline + micro-label; the card stays untouched); MY TEAMS = favorites only, every sport, chronological. **05 §11's page-level section on Today is superseded.** On WEEK, ALL GAMES marks favorites within each day group the same way; MY TEAMS shows only favorites per day.
- **R5 (Q5) — PHONE-FIRST.** Desktop TV GRID keeps the archived PC render for one sport and an honest line for ALL; sticky axes, NOW, WATCH LIVE and the ALL grid are phone features. **A desktop mode of the live grid is QUEUED as its own project after the hub ships**, so the hub's grid view must be built with that mode in mind (no throwaway structure). **D5 (≥1592 band-left/grid-right) is kept for LIST view.**
- **R6 (Q6) — HUB FIRST, WATCH LIVE AFTER THE PHONE TEST.** The hub is built without WATCH LIVE. Feasibility §5A/§5B run next. Then WATCH LIVE only for player-rung destinations; event/hub rungs get "OPEN <SERVICE>" labels or no floating control. Label policy finalised when the rungs are known.
- **R7 (Q7) — BANNER LAUNCHES, BODY OPENS THE PANEL** (M11 stands). Deferred with R6.
- **R8 (Q8) — HISTORY'S SEARCH IS RETIRED FROM THE HUB'S CONTROLS and HELD as a sub-feature of MY TEAMS** (a team lookup inside the MY TEAMS scope). Logged, not built.
- **Standing from the triage, unchanged:** B-1 the sports rail (ALL SPORTS bar + eight tiles) stands; B-4 the DATE/WEEK headings retire because DAY|WEEK becomes the label; B-7 the WEEK+GRID day strip follows the week's real span; B-8 no persisted preference, DAY default; B-9 the NOW marker rides the hub, not v1.7.
- **Still owed by Joe:** whether the §29 reference renderings exist (→ `docs/ux-reference/`); confirmation that no Claude Code prompt is in flight before Cowork places files in the repo.

## 7. What Claude Code still has to answer (the read-only audit prompt, after rulings)

Scoped to what the record and this read cannot settle — the §30 A–F deliverable, filed as `docs/hub-audit-<date>.md`, **ships nothing**:

1. C-3's sticky design against `.mgrid-scroll`, the pinch handler, M4 v1.2, `dvh`, Safari chrome collapse, and the frozen-geometry tripwire; a prototype branch measurement at 390 with a simulated 47 px inset.
2. C-10: WEEK + LIST + ALL render cost on the heaviest loaded week now that NHL/NBA are in (count cards, measure paint, name the lever if it is slow).
3. C-11: the two segmented controls at 360/390/430 with 44 px targets; report the width at which one row fails.
4. Redirect mechanics for `/weeks` and `/history` (Next `redirects()` vs route `redirect()`), what `nav.test.mjs` needs, and manifest/start_url.
5. The parameter model (`mode/day/w/scope/view` + the existing `sport`) and which combinations the URL must survive (a `?w=` from another sport already falls back — keep that).
6. D5's 1592 composition under the hub (band left / grid right only makes sense when view=list and the archived render exists) — report, propose, do not decide.
7. **Blast radius of the retirements (R3/R3b/R4/R8):** every file, test and doc that references the count line (`countSummary`, `offServiceSummary`'s reveal, `.offsvc*`, the band-header count, "every band reports" tests), the YOUR TEAMS section (`sectionLabel`, `floatFavorites`, `.favlabel`, 05 §11), the Day-row remnants, and History's `SearchBox`/`matchesSearch`/`?q=` — so the build prompts remove exactly that and nothing beside it. This is the §30 D functionality-preservation audit.
8. C-7/C-8 (WATCH LIVE geometry) is **deferred with R6** — not in this audit.

---

## 8. Phased build (after the audit; each phase its own Claude Code prompt in the merged-unattended shape)

1. **Hub foundation:** one route, parameter model, redirects, `routes.js`, nav tests re-based; DAY|WEEK + prev/next arrows; the three existing pages become render branches of one page (Today's Listing already serves all three). DATE/WEEK headings retired (B-4). No other visual change.
2. **Controls row + the retirements:** ALL GAMES|MY TEAMS + LIST|TV GRID; the count line and D4's filter go (R3/R3b — off-service rows dimmed in place, badges stay); the YOUR TEAMS section becomes the MY TEAMS scope with band-level favorite marks under ALL GAMES (R4); History's search retired and logged under MY TEAMS (R8); ALL SPORTS bar + tiles untouched (B-1).
3. **WEEK under the hub:** WEEK + LIST (already built) with MY TEAMS and the day-group favorite marks; prev/next week arrows step the sport's own week list; History's finals reachable via DAY/WEEK past dates.
4. **TV GRID as a view (phone):** the grid owns its viewport (C-3), sticky axis/rail/corner, NOW marker + scroll-to-now + jump-to-now (C-4), WEEK + GRID day strip (C-5); GRID + MY TEAMS filters the rail. Desktop keeps the archived render (R5). Built so a desktop mode can be added later.
5. **Function 1 (direct-to-player):** feasibility §5A/§5B, then the link pipeline + panel — a separate thread. **WATCH LIVE** lands after it (R6/R7), measured per C-7/C-8 then.
6. **Verification:** iPhone standalone (Joe's phone is the authority), 390/430/1440, Safari + Chromium, keyboard, the frozen grid geometry, the card DOM byte-identical, MARKET TBD / NETWORK TBD badges still rendering, eligibility still read from `viewer_game_eligibility`.

Contract housekeeping that rides these: 05 gains a §14 recording the hub and superseding §11 (page order) and §12 (DATE/WEEK headers), and amending D4 (no filter, dim in place) and D6 (band-level mark under ALL GAMES); the Mobile Grid Addendum gains the sticky-viewport rule; rendering-contract v1.7's "now marker" item moves here (B-9); `docs/design/mobile_demo.html` changes in the same commit as anything it implements (rule 23); `docs/enhancement-register.md` gets a section for the MY TEAMS search sub-feature and the queued desktop live grid.
