# MySports TV — Enhancement Register (v0.4)

**This file lives in the repo** and is mirrored to the Claude project at `claude/enhancement-register.md`. The repo copy is the source; the project copy is written from it. Edit here.

**Opened:** 2026-09-02 by the Chat architecture session. **Owner:** Joe.

**How to read this file.** §1–§6 are the original architecture assessment and research findings. §7–§14 are the decisions, in the order they were made. **This file records decisions; it does not track status.** Live status — what is built, what is next, what is open — lives in `docs/handoff-status.md` and in the binding decision records it points at, so this file cannot go stale behind them.

**Read with:** `docs/handoff-status.md` (build state), `docs/feature-study/05-home-page-decisions.md` (home page, E5, NETWORK TBD, the count line and the mobile page order — binding), spec v0.5, `docs/rendering-contract.md` v1.6.5, `docs/design/mobile_demo.html` (the locked reference implementation).

---

## 1. Requests (verbatim intent, 2026-09-02)

| # | Request | Distribution as stated by Joe | First-pass verification (see §4) |
|---|---------|-------------------------------|----------------------------------|
| E-01 | NASCAR Cup, O'Reilly Auto Parts and Craftsman Truck Series as a sport | — | Cup: FOX/FS1 → Prime Video → TNT → NBC/USA. O'Reilly: The CW. Truck: FOX/FS1 [UNVERIFIED 2026 split]. |
| E-02 | UFC as a sport | "streams exclusively on Paramount+" | Confirmed: all numbered events + Fight Nights on Paramount+ (through 2033); **select numbered events partially simulcast on CBS in fixed windows.** |
| E-03 | IndyCar Series as a sport | — | Confirmed: every 2026 race on FOX; practice/qualifying on FS1/FS2. Season ends September → 2027 is the first full season MySports would carry. |
| E-04 | WWE televised shows + PLEs | Raw = Netflix; NXT = The CW; SmackDown = USA; PLEs mostly ESPN Unlimited; SNME = Peacock | Confirmed, with the SNME refinement in §8. |
| E-05 | AEW shows + PPVs | TNT / TBS / HBO Max; PPVs on HBO Max | Confirmed: Dynamite Wed 8 PM TBS+HBO Max; Collision Sat 8 PM TNT+HBO Max; **PPVs are a $39.99 purchase, not included.** |
| E-06 | Network pregame/studio shows on the grid | GameDay, Big Noon Kickoff, FOX NFL Sunday, The NFL Today, Football Night in America, MNF Countdown, Prime Video + Netflix NFL pregames; with the network's graphic package, show logo, hosts, and on-site location | No API exists. Press-release sourced, weekly cadence. |

## 2. Recommendation (lead)

**Do not build any of the six as "another sport" in the game-centric model.** Four are not team-vs-team games and two are recurring TV shows with dated specials; bolting each onto `games` would mean six one-off hacks across the renderer, the access engine and the web app.

Instead, **spec v0.5 with a `programs` supertype**: every grid cell is a *program*; a team-sport game is one subtype. One change unlocks all six plus anything later (F1, golf, tennis, boxing, Olympics, postgame shows). Build order after the model lands: **E-06 studio shows** (highest weekly visibility, almost entirely static data, proves the non-game card) → **E-04 + E-05 wrestling** (fixed weekly slots plus a curated PLE calendar) → **E-02 UFC** (needs an adapter and the partial-simulcast feature) → **E-01 NASCAR** (three series, four rotating partners; 2026 value is the playoffs) → **E-03 IndyCar** (trivial rights, but build against the 2027 schedule).

## 3. Architecture assessment — what breaks today

**Entity model.** `games` assumes two teams, one start time, one venue, a score, and `teams` scoped by sport. Motorsport events have a field of drivers and a weekend of sessions; a UFC card is 10–14 bouts in three segments; a wrestling show has no result the grid cares about; a studio show has hosts, a location and a parent slate rather than an opponent.

**Proposed `programs` supertype (draft, for v0.5):** `program_id`, `sport` (new values `nascar`, `indycar`, `ufc`, `wwe`, `aew`; studio shows carry the sport they cover), `program_type` ∈ {`game`, `race_session`, `fight_card`, `weekly_show`, `special_event`, `studio_show`}, `title`, `subtitle`, `start_at`, `expected_duration_min`, `venue`/`location_text`, `on_site`, `parent_program_id`, `series`, `headliners`, `hosts_crew[]`, `brand_mark`, `graphic_package`. `games` becomes the `program_type='game'` subtype, unchanged; migration is additive. `broadcasts` gains `window_start`/`window_end` for partial simulcasts.

**Renderer.** Non-team programs need a **program card**: brand-mark endcap, title line, subtitle line, muted host/crew tray. Same charcoal, same Barlow Condensed — a second silhouette, not a second design language. The frozen design language is **extended, never reopened**.

**Grid time model.** Fixed 30-minute columns are fine; duration is the problem. `expected_duration_min` per program type with an `open_ended` flag that renders a fade-out right edge.

**Access engine.** Partial simulcast windows; purchasable events; FOX One duplicating a broadcast feed Joe already has (suppress like the local-feed rule).

**Data freshness.** Wrestling shows move nights for sports preemptions; GameDay and Big Noon sites are announced ~5 days out. Both belong in the Wednesday research-watch task, with Joe as final authority.

## 4. Rights and source findings (verified 2026-09-02 unless marked)

- **NASCAR Cup 2026:** four partners, FOX → Prime Video → TNT → USA/NBC; USA's 14-race run ends Nov 8 (Homestead), four of those simulcast on NBC + Peacock. O'Reilly Series on The CW. *Sources: nascar.com/tv-schedule; Sports Media Watch.* Truck Series split **[UNVERIFIED]**.
- **UFC 2026:** Paramount+ exclusive for all 13 numbered events and 30 Fight Nights, no PPV, through 2033. Select numbered events simulcast on CBS in a window (UFC 326 precedent: 8–10 PM ET). *Sources: Paramount Press Express; paramountplus.com.*
- **IndyCar 2026:** every race on FOX; practice/qualifying on FS1/FS2. *Sources: indycar.com; fox.com.*
- **WWE 2026:** Raw on Netflix; SmackDown Fridays on USA; NXT on The CW; main-roster PLEs on ESPN Unlimited; SNME on Peacock. *Sources: wwe.com; corporate.wwe.com.*
- **AEW 2026:** Dynamite Wed TBS + HBO Max; Collision Sat TNT + HBO Max with documented preemptions; PPVs a $39.99 HBO Max purchase. *Sources: allelitewrestling.com; WBD monthly schedule.*
- **Studio/pregame shows:** no structured source. ESPN Press Room announces the GameDay site weekly; FOX Sports PR announces Big Noon.
- **ESPN endpoints for the new sports:** `racing/nascar-premier`, `racing/nascar-secondary`, `racing/nascar-truck`, `racing/irl`, `mma/ufc`. *[Closed by prompt 17: all five return 200 from the laptop on an honest UA.]*

## 5. Clarifying questions (all answered — see §7 and §9)

Retained for the reasoning behind each ruling: (1) approve the `programs` supertype; (2) sessions and UFC segments; (3) purchasable events; (4) studio-show scope; (5) host/crew authority; (6) `nascar` sport vs three sports; (7) NXT distribution; (8) a second card silhouette; (9) odds for the new sports.

## 6. Flags

- **ESPN Akamai 403 from the cloud workspace.** *[Closed. The block is specific to the Cowork cloud workspace: Actions runners, the laptop and Vercel `iad1` are all clean. **A bare browser UA makes Akamai worse** and must never be reapplied.]*
- **Wrestling preemptions and GameDay/Big Noon sites** need a weekly watch once E-04/E-06 are in scope.
- **IndyCar** — no adapter effort until the 2027 schedule publishes (typically October).
- **`api-web.nhle.com` connection resets** — laptop-local (Vercel and Actions are clean). Bounded retry landed in `adapters/common.py`.
- **One mistyped enum aborts a whole daily refresh.** `adapters/mlb.py` wrote `carriageCertainty="UNVERIFIED"` — an `access_status` value in a `carriage_certainty` field — and Postgres rejected the insert, killing the run and the render behind it. Fixed at `64c9764`; **the class is not fixed.** Loader enum-validation-and-quarantine is queued on v1.7.
- **PostgREST silently caps an unbounded select at 1,000 rows.** Exposed by the 2026-09-03 season load: at 375 games the week index fitted, at 1,364 it did not, and the Weeks picker quietly offered CFB weeks 1–10 and NFL weeks 1–9 with no error anywhere. Fixed at `b44893e` with a paginating `restAll()`; the regression test pins the call site, not a row count. **The class is a silent wrong answer, and it recurs every time a table crosses 1,000 rows.**

---

## 7. Decisions — 2026-09-02 (Joe, afternoon)

| Q | Decision |
|---|----------|
| 1 | `programs` supertype approved. NASCAR exception clarified in §9. |
| 2 | Motorsport: race only, no practice/qualifying. UFC: one card with a segment timeline; CBS window as a partial bar. **Superseded — see §10.** |
| 3 | **Exclude purchasable content.** AEW PPVs out. No `purchasable` access state in v0.5. |
| 4 | Studio-show scope = **pregame + postgame bookends** on the game's network. No halftime, no daily talk. |
| 5 | Host/crew/location data **sourced from public announcements**, not hand-curated. Joe hand-entry is a last-resort override. |
| 6 | One `nascar` sport with a `series` field (cup / oreilly / truck). |
| 7 | WWE scope = Raw, SmackDown, main-roster PLEs. **NXT dropped entirely.** |
| 8 | Design pass — decided in §9. |
| 9 | Betting lines — decided in §9. |

## 8. SNME classification (confirmed 2026-09-03)

PLEs are on ESPN Unlimited **except Saturday Night's Main Event and Sunday Night's Main Event, which are on Peacock**, 4–6× a year. This explains the wwe.com September 6 Peacock listing.

## 9. Decisions — 2026-09-02 (Joe, follow-up)

> **⚠ SUPERSEDED IN PART, 2026-09-06 (prompt 52 stage 1) — see §20.** Q1's NASCAR **Cup / O'Reilly / Truck sub-filter is RETIRED.** All NASCAR races now render together, selected by sport alone. The rest of Q1 stands: `programs` is still an invisible DB supertype, chips are still driven by `sport`, and `programs.series` is still in the database and load-bearing. The original text below is left as written — a superseded decision is part of the record.

- **Q1 — no NASCAR exception.** The concern was the chip menu, not the data model. `programs` is an invisible DB supertype; chips are driven by `sport`. NASCAR is `sport = nascar` with its own chip and a Cup / O'Reilly / Truck sub-filter. Every new sport gets its own chip. **⚠ AMENDED 2026-09-03 — AEW is now the one exception; see §13.** **Studio shows never get a chip** — they render on the parent sport's grid as bookends. Joe chose **individual chips**, not grouped "Racing"/"Wrestling".
- **Q8 — option (a).** Program card mocked in the prototype artifact first, then implemented as rendering-contract v1.7. **Approved 2026-09-03; spec at `claude/program-card-design-v1.md`.**
- **Q9.** UFC moneylines and NASCAR race odds appear as their books list them, under the existing `show_odds` toggle.

## 10. Brief 2 — complete (2026-09-02)

Seven research deliverables written (six item docs + `research-summary-2.md`); changelog in `research-changelog-2026-09-02.md`. Program model confirmed with three additions: segments, broadcast windows, per-episode network.

**Superseded at design time (conversation wins):** the UFC card renders **PLAIN** — no segment dividers or labels, and **no CBS partial-window overlay.** This supersedes the Q2 ruling in §7. `broadcasts.window_start/end` remain in the schema as detail-panel data only.

## 11. Competitive feature study (2026-09-02)

An unattended competitive feature study ran on the evening of 2026-09-02. Outputs live under `docs/feature-study/`: `00-README.md` (index and Assumptions Log), `01-current-state.md`, `02-comparables.md`, `03-enhancement-specs.md`, `04-home-page-memo.md`, `05-home-page-decisions.md`, `mockups/`, `artifacts/qa/feature-study/`.

The specs it produced are **E1** card state model · **E2** On now / Next up · **E3** access glyph and off-services count · **E4** data-as-of · **E5** market-pending for NFL regional windows · **E6** Tonight snapshot · **E7** program bookends (v0.5) · **E8** A/H feed notation (v0.5) · **E9** last-play line · **E10** empty-state copy · **E11** ICS feed · **E12** change alerts · **E13** announcer crews · **E15** History grouped by day.

**Which of these are ruled, built, or open is not recorded here** — see `docs/feature-study/05-home-page-decisions.md` for the rulings and `docs/handoff-status.md` for build state.

## 12. Home-page decision board and E5 — CLOSED

**The rulings are deliberately not restated here.** Duplicating them is how a register drifts out of step with the decision it indexes. The binding record is:

> **`docs/feature-study/05-home-page-decisions.md`**

It covers **D1–D6** with the reasoning, two corrections to `04-home-page-memo.md` that must not be re-inherited, the **D3 amendment** made after the Vercel egress probe, the settled **deployment facts**, the **E5** ruling, the **§9 NETWORK TBD** ruling, the **§10 count-line amendment** and the **§11 mobile page order**. **Do not re-raise D1–D6 or E5.**

Two consequences that reach beyond the board, and are the register's business:

- **`data/render_policies.json` carries `prime_window_start` per sport (D2).** Rendering-contract v1.7 touches the same file for the `open_ended` reconciliation — **land both in one change** or the file ends up with two competing shapes.
- **The grid "now" marker** is a rendering-contract v1.7 entry, not a web-app change.

## 13. Chips, league marks and the AEW amendment — 2026-09-03 (Joe)

Decided after the "League Marks on Chips" board (artifact `779fd902`). These amend §9's Q1 ruling; §9 is annotated rather than rewritten, so the order in which decisions were made stays readable.

**The AEW amendment — this is the part that changes §9.** §9 read "Every new sport gets its own chip." That is superseded **for AEW only**: **AEW gets no dedicated filter chip.** AEW still loads, still appears under **All**, and still renders on the grid on its networks. **E-05 is not dropped and stays on the roadmap** — this is a chip-row decision, not a scope decision. Every other new sport (`nascar`, `indycar`, `ufc`, `wwe`) keeps its own chip as §9 ruled.

**Chip composition.**

- Sport filter chips carry the **league mark only, no text**. This changes what prompt 22 shipped at `e826d23` (mark + 13 px text).
- The chip row adds **NASCAR, INDYCAR, UFC, WWE**. No AEW chip, per the amendment above.
- **"All" stays text** — it is the one chip that is not a league.
- The **CFB chip uses the CFP mark, logo-only.** Joe overrode the suggestion to keep "CFB" as text. Trade-off on record: CFP is the College Football Playoff brand, so in Week 1 the chip reads "Playoff" to anyone who knows it. Consistent with the banner and the band headers, which already use `cfp` for the college slot.
- **Selected-chip rule.** The active chip sits on a gold plate, so its mark uses the **raw** art, not `_dark` — rendering contract v1.3e, light plate = raw. Inactive chips on charcoal take `_dark`. **⚠ SUPERSEDED 2026-09-03 — see §14.**

**Where marks do and do not go.**

- **Band headers keep mark + league name.** A chip is a *control* you choose between, so a mark alone suffices and the row supplies context; a band header is a *label* for what follows, and on an all-sports day it is what tells you which slate you have scrolled into.
- **The week dropdown stays text.** Not a preference: a native `<option>` renders text only in every browser, so marks there would mean hand-building a custom dropdown and giving back the wrap-safety that made a native `<select>` the right control at 390 px.

**The chip row scrolls; the marks are not squashed.** League marks have wildly different aspect ratios. Rendered width at a 21 px chip height: NBA 9 px · CFP 15 · NFL 15 · NHL 19 · WWE 23 · IndyCar 30 · MLB 40 · UFC 60 · **NASCAR 126 on its own**. Ten chips come to roughly 680 px against a 390 px screen. The locked reference (`docs/design/mobile_demo.html`) sets `overflow-x:auto` on `.chiprow`, so the row becomes **one horizontally scrolling line**. That is reference behaviour and it scales as sports are added.

> **Correction, 2026-09-03.** The shipped `web/app/globals.css` did **not** match the reference — it had `flex-wrap: wrap`, so the row wrapped rather than scrolling and prompt 25 had to write the scroller explicitly. The reference citation above was accurate; the assumption that shipped code matched it was not. This is why the reference now lives in the repo, and why working rule 22 exists.

**The four new chips ship with honest empty states** naming why each is empty and when it arrives — e.g. "NASCAR arrives with the playoffs, September 6"; "IndyCar 2026 ends this month, 2027 schedule publishes in October" — rather than a bare "no games". None of the four has data yet. Build order is unchanged from §2: studio shows → WWE/AEW → UFC → NASCAR → IndyCar.

## 14. THE ACTIVE CHIP INVERTED — 2026-09-03, after prompt 25 measured the marks on gold

§13's selected-chip rule read: the active chip sits on a gold plate, so its mark uses the **raw** art, not `_dark` (contract v1.3e, light plate = raw).

**A consequence nobody priced.** Prompt 25 stage 3 measured every league mark composited on the real gold plate (`--gold` `#f0c850`). The CFP mark — which §13 itself chose for the CFB chip, logo-only — is effectively invisible on it: **100% of its opaque ink below 3:1, best case 1.61:1**, confirmed by eye as a ghost. This is not a `_dark` problem: `cfp_dark` reads 10.05:1 on charcoal. The raw art is light-on-light and no treatment fixes that.

And it is not only CFP. Raw-on-gold, measured: cfp 1.23 · nba 1.50 · nfl 1.83 · indycar 1.91 · mlb 2.08 · nhl 3.35 · ufc 3.40 · aew 8.76 · nascar 10.00 · wwe 10.55. Five of ten below 3:1. Prompt 25's caveat is on record and endorsed: a multi-colour mark always has *some* ink near any ground, and the NFL shield reads clearly on gold by eye at 9.20:1 best ink — it trusted the render over the arithmetic, which is working rule 13 behaving correctly. CFP is the one that genuinely fails.

**Ruling: invert the active chip.** The active chip becomes a **charcoal plate with a gold border**, not a gold fill. Every chip then floats on charcoal in both states and takes `_dark` always.

- One mark state on the chip row instead of two.
- No new art. The CFP problem disappears, and so do the four other weak raw-on-gold marks.
- It scales: every future league mark is only ever asked to read on one ground.
- Contract v1.3e's light-plate context still exists and is unchanged — it governs grid caps and light tint plates (addendum M12). It simply no longer applies to chips.
- **Cost, named:** a bordered chip reads quieter than a filled plate. The active state must stay unmistakable at a glance — gold border *and* gold text, not border alone.

This amends §13's selected-chip rule only. Marks-only chips, the chip roster, the AEW amendment, the CFP choice for the CFB chip, the scrolling row and the band-header rule are all unchanged.

### 14a. Two corrections from the implementation (prompt 26, `ac5b8c9`)

1. **The ground figure.** §14 predicted the active CFP mark would land "near `cfp_dark`'s 10.05:1". That figure was measured against `--spot-2` `#1b1b1b`. The chip's actual ground is `.chip`'s panel gradient, so it lands at **7.41:1 (top) / 9.52:1 (bottom)**. Same conclusion, correct ground. Every `_dark` mark on the chip gradient, top/bottom: cfp 7.41/9.52 · nfl 4.09/5.38 · nba 5.05/6.70 · **nhl 2.25/2.94** · mlb 3.61/4.78 · nascar 7.59/10.04 · indycar 4.99/6.60 · ufc 3.14/4.12 · wwe 8.48/11.06.
2. **"Gold border *and* gold text" is achievable on exactly one chip.** `All` is the only text chip; the nine logo chips carry an `<img>`, and an image takes no colour, so they get the border alone. It reads unmistakably against charcoal neighbours by eye and ships as ruled, but **the safeguard does not reach the chips it was written for.** The locked reference resolves it the same way — `.spbtn.on` is `border-color: gold` plus an inset gold ring, while `.spbtn.all.on` additionally takes gold text — so the shipped asymmetry matches the reference rather than departing from it. Left as shipped. If the active state ever reads as ambiguous on a phone, the reference's **inset gold ring** (`box-shadow: 0 0 0 1px var(--gold) inset`) is the second cue to add, and it costs no layout.

---

## 15. SPORT TILES — 2026-09-03. Fixed soft-cornered squares, marks filling the box.

Joe, after seeing prompt 26's chip screenshots: *"NASCAR button is too wide. Try to standardize
button size as much as possible and make the buttons more of a soft-cornered square than an oval.
The button shapes appear to be determined by the logo — I'd like to fix them all as soft rounded
corner squares."* And: *"All of the major sport logos — NFL, MLB, NBA, CFB — they're rendering too
small within the button. Make them as large as you can without them getting too close to the button
edge."*

**This is contract repair, not new design.** `docs/design/mobile_demo.html` already specifies a fixed
40 × 40 tile with `padding:5px`, a soft radius, and `max-width/max-height:100%; object-fit:contain`
on the mark. The shipped app had grown logo-shaped pills whose width was set by the mark's aspect
ratio, which is what made NASCAR three times wider than its neighbours.

**Ruling.** The sport filter row uses a fixed square tile — 44 × 44 at ≤699 px (preserving prompt
25's tap target), 36 × 36 on desktop — with a soft radius and the mark sized only by the box. The
tile class is `.spbtn`, matching the reference. `.chip` is untouched: it still carries the `/weeks`
View chips and the week `<select>`, which are text and cannot be square.

**The trade-off, named.** In a fixed square, a wide mark fits by its width and renders short. NBA,
CFP, NFL and NHL gain roughly 80% in height — exactly what was asked. **MLB does not:** its mark is
~1.9:1, so a square box caps it and it stays about where it was. It reads fuller only because the
surrounding air is gone. NASCAR at 6:1 is the extreme case, and if the render shows it illegible the
single sanctioned exception is a double-width tile for marks wider than 3:1 — NASCAR and UFC only,
two sizes total, nothing else.

This supersedes §13's implied pill shape and §14a's assumption that mark height is set by a fixed
`height` rule. §14's inverted active state (charcoal plate, gold border) is unchanged and applies to
the tile exactly as it applied to the chip.

### 15a. As built (prompt 28, `25ba786`)

Measured rather than predicted. `box-sizing` is `border-box` globally, so a 44 px tile with 1 px
borders and 4 px padding gives a **34 × 34** mark box, not the 36 × 36 the ruling assumed — every
gain below is therefore about 5.5% under the figure above, and the four named marks gain **+70%**,
not +80%. Directions all hold.

| Mark | rendered in the 34 px box | was 20 px tall |
|---|---|---|
| NBA | 15 × 34 | +70% |
| CFP | 23.5 × 34 | +70% |
| NFL | 24.8 × 34 | +70% |
| NHL | 29.9 × 34 | +70% |
| WWE | 34 × 30.9 | +55% |
| IndyCar | 34 × 23.7 | +19% |
| MLB | 34 × 17.9 | **−2.1 px, unchanged as predicted** |
| UFC | 34 × 11.8 | −41% |
| NASCAR | 34 × 5.7 | −72% |

**Radius 10 px**, chosen by rendering 4, 10 and 14 px: Joe asked for "soft" twice, and at the
reference's 4 px (set for its smaller 40 px tile) the corner reads as a hard square with a chamfer.
**Padding stayed at 4 px** — no mark crowds the border or the corner, checked at 8× on the three
tightest (NASCAR, UFC, MLB), so there was no reason to step up and shrink marks Joe asked to enlarge.

**NASCAR is legible as a strict square and the double-width exception was NOT taken.** It is the
smallest mark on the row, but readable; and at 88 px the exception reintroduces exactly what Joe
objected to — a NASCAR tile visibly wider than its neighbours. Both versions are rendered in
`artifacts/qa/2026-09-03-p28/` (`tiles-390.png` and `tiles-wide-390.png`) so the choice stays his.

The row narrowed from 631 px to **494 px** at every mobile width while the marks got bigger — the
pills were wide, not the art. Squaring also made §14's active state *more* legible, because the gold
border traces the full outline of a square where a pill rounded it away.

---

## 16. RACING — 2026-09-03. One chip over two sports, and the ALL bar takes its own row.

> **⚠ SUPERSEDED IN PART, 2026-09-06 (prompt 52 stage 1) — see §20.** The **second row beneath the tiles is gone**, along with the series sub-filter it carried. What this section got RIGHT is untouched and is the shape prompt 52 followed: a presentation change, no schema change, `nascar` and `indycar` still separate enum values. The original text stands.

**This amends §9's Q1 and §13's chip roster.** §9 recorded Joe choosing individual chips per sport and
explicitly rejecting grouped "Racing" and "Wrestling" chips. Joe reversed that for racing only, and the
contradiction was named before acting: NASCAR and IndyCar now share one chip.

**Presentation only — there is no schema change.** `sport` keeps `nascar` and `indycar` as separate
enum values and the database is untouched. The Racing chip filters on both. Chosen over a true merge
because neither sport has data loaded yet, nothing has to be undone if they are split again, and a
`racing` enum value would make IndyCar a fourth "series" alongside NASCAR's Cup, O'Reilly and Truck —
a shape that describes the chip row rather than the sport.

**The mark** is a new square composite: NASCAR's wordmark across the top, IndyCar's badge below. This
is what makes the chip work at all — §13 measured NASCAR alone at 126 px against a 21 px height, a 6:1
wordmark that a square tile crushes to a few pixels of height. Stacked, both marks read. A double-width
racing tile was built and rejected by measurement: in a 2:1 box NASCAR claims the width and squeezes
IndyCar smaller, so it is worse, not better.

**The ALL bar.** "All" leaves the tile row and becomes a full-width bar directly above it, one tile
tall. Two consequences Joe wanted: All becomes the largest control on the page, and the tile row loses
two members — All itself, and one of the two racing chips.

**The row no longer scrolls, and that is the point.** §13 ruled the row scrolls horizontally because ten
marks could not fit. Eight tiles can, if they share the row's width instead of each claiming a fixed
44 px. **The tiles now flex to fill the row exactly**, so the row fits at every width by construction
and the horizontal scroll is gone — Joe: *"I find [it] very annoying."*

**Cost, named and accepted.** Flexing to fit means the tile is no longer a fixed 44 px. On a 390 px
phone eight tiles land near 40 px, under the 44 px tap target prompt 25 established. That is the trade
Joe chose: a slightly smaller target on every tile, in exchange for never swiping to reach a sport.

## 17. PROGRAMS GO LIVE — 2026-09-05/06, prompt 47

### Joe's two amendments of 2026-09-05

1. **Hosts and crews for College GameDay and Big Noon Kickoff are static, hand-curated data.**
   This amends **§7 Q5** ("sourced, never hand-curated") **for those two shows only**. Every other
   show's crew stays out of the automated path. *Not yet built — see below.*
2. **IndyCar is built now**, against the 2026 season for History, rather than deferred to the 2027
   schedule. This amends **§6** and research-summary-2 §6. *Not yet built — see below.*

### What shipped

- **Migrations 0012 and 0013** (`798251c`): a program can own a broadcast row
  (`game_broadcasts.program_id`, `game_id` nullable, exactly-one-subject check), and every
  `program_type` has a natural key so a re-load updates instead of duplicating. 0013 turned out to be
  small: 0009 had already built the studio-show tables, the broadcast windows and every enum value.
- **NHL and NBA 2026-27 regular seasons** (`34aaef0`): 1,384 → **3,868** games.
- **NASCAR 2026** (`69aaea5`, `042a231`): 98 race sessions with a per-race broadcast each, idempotent.
- **Contract v1.6.15** (`8782f94`): the `vs` marker retired, `(neutral site)` on the venue line.
- **A fail-honest NASCAR refresh step** (`d921576`).

### What did NOT ship, and the single reason

**Stages 4–9 of the brief — the program card (v1.7), IndyCar, WWE, AEW, the studio-show registry and
UFC — were not built, because every document they load data from is absent from the repository.**
`claude/program-card-design-v1.md` and all six `research-*.md` files named in the brief are nowhere in
the tree. The brief requires that every 2026 slot, network, duration and source URL come from those
documents or from a live fetch of a source they verified; without them there is neither the data nor
the list of verified URLs, and the obvious guesses 404 or 403.

Writing those schedules from memory would put invented broadcast facts into a production database
that Joe reads as truth about what he can watch. **§4's standard** — verified sources, cited — is the
whole point of this register, and it is not negotiable for convenience.

**Unblocking is one step:** put those seven documents in the repo, or name their Project paths.

### Consequently still open

- **E-01…E-06 cannot be closed out** as the brief asked: their numbering lives in the register
  sections this repo copy does carry (§7, §9, §10, §13), and the "E-0n" close-out list the brief
  refers to is not in this file. Recorded rather than invented.
- **§9's UFC odds** (The Odds API `mma_mixed_martial_arts`) — no provider key added, nothing loaded.
- **§13's chip amendment** — untouched; the chip set was not changed, because stage 4 did not run.
- **Program eligibility** — `viewer_game_eligibility.game_id` is `NOT NULL`, so a program cannot
  carry one. This gates v1.7: the first surface that shows a race to a reader has to say whether he
  can watch it.

### Close-outs — 2026-09-05/06, prompt 48

**Everything §17 recorded as "not yet built" is built.** Joe put the eleven events & shows documents
in the repo (stage 0, `1b20768`), which was the single blocker, and the rest followed. Each section
below is closed against what shipped; what remains is named, not implied.

| section | shipped | what remains |
|---|---|---|
| **§7 Q2 — motorsport, race only** | NASCAR 98 (prompt 47) and **IndyCar 18** (`5bca121`), races only, no practice or qualifying | the 98 NASCAR rows are **four hours early** — see below |
| **§7 Q3 — purchasable excluded** | AEW PPVs and the HBO Max "Zero Hour" pre-show are not loaded (`3ec3231`) | nothing |
| **§7 Q4 — studio shows, bookends only** | 7 shows, **111 instances** (`83dea25`) | four shows the brief named have no verified slot in the doc and are recorded in `data/studio_shows.json` `_not_loaded` — **three since prompt 86, which registered Sunday NFL Countdown from ESPN's release (§35)** |
| **§7 Q5 / §17 amendment 1 — crews** | GameDay's crew is an **ESPN announcement**, nine seats, each citing the release — stronger than the hand-curation the amendment permits | **Big Noon's seats are `TBA`**: FOX Press Pass is now verified fetch-clean but CONTENT-EMPTY (JS-rendered), so no seat is filled from memory |
| **§7 Q7 — WWE scope, NXT dropped** | Raw 17, SmackDown 16, 3 PLEs (`1d21442`). NXT's slot is in the same Premier Shows block and is dropped, with the drop reported | the wwe.com dual ESPN/Netflix listing on Oct 10 and Nov 28 — ESPN Unlimited only is loaded |
| **§8 — SNME on Peacock** | Sunday Night's Main Event, Sept 6, Atlanta, **Peacock** | nothing |
| **§9 — chips** | The chip roster already matched §16 and was **left alone**. §9's missing half — the **Cup / O'Reilly / Truck sub-filter** — ships as a SECOND row beneath the tiles (`376ef36`) | nothing |
| **§9 — odds** | **not loaded.** The brief forbade adding a provider key tonight | The Odds API `mma_mixed_martial_arts` and `motorsport_nascar_cup` |
| **§10 — the program card** | **rendering-contract v1.7** (`376ef36`): the card on both grids, the list variant, the now marker, studio bookends, `open_ended` reconciled | the archived desktop grid is still game-only — the drawing exists and is tested, the daily job writes it no programs file |
| **§12 — `render_policies` and the now marker** | Both landed **in one change**, as §12 required: the five program sports gained `prime_window_start` beside the `open_ended` reconciliation | nothing |
| **§13 — the AEW amendment** | Honoured: AEW loads, appears under ALL SPORTS, renders on TBS and TNT, and has **no chip** | nothing |
| **§17 amendment 2 — IndyCar now** | Built against **2026**, not deferred to 2027 (`5bca121`) | the 2027 schedule publishes in October; `--year` moves then |

**The one thing a reader will notice.** All 98 NASCAR races are **four hours early**: cf.nascar.com
publishes naive Eastern timestamps and `parse_iso` stamped them UTC. Established against ESPN on six
races. The adapter is fixed; the stored rows are not, because correcting a `start_at` changes the
natural key and a plain re-load would insert 98 duplicates rather than fix 98 rows. A guard now
refuses that (and fired on all 98 on the runner tonight), which is what makes leaving them safe.
**It needs a Joe-approved delete-and-reload or a targeted update.**

### `docs/research/events-summary-2.md` §6 — the open questions this run settled

| question | settled as | where |
|---|---|---|
| FOX NFL Kickoff vs FOX NFL Sunday — one card or two | **two**, the doc's own recommendation | `data/studio_shows.json` |
| studio-city display when not on-site | **road only** — an in-studio show prints no subtitle at all | contract §11.10, `subtitleFor()` |
| WWE/AEW crews — "reported" tier or omit | **omit.** The design of record's crew tier takes announcements; both promotions' crews are reported by trades | `adapters/wwe.py`, `adapters/aew.py` |
| AEW bookends when the PPV is excluded | the doc's recommendation, taken: **linear pre-shows yes** (Tailgate on TNT loads), **HBO Max Zero Hour no** | `data/aew_2026_schedule.json` |
| UFC CBS partial card shown | **superseded.** The card renders plain; the window is detail-panel data. No 2026 card flags a simulcast, so there is none to draw | design of record; `adapters/ufc.py` |
| SNME as PLE-class | **confirmed** — `special_event` on Peacock, per §8 | `adapters/wwe.py` |
| IndyCar deferral to 2027 | **overruled** by §17: built against 2026 | `adapters/indycar.py` |
| Marquee (gold sunburst) lists per sport | **still open.** No program carries a marquee flag; the criterion is Joe's to set | — |

**§17's two amendments are already recorded there and are not restated here.** Both were honoured:
GameDay's crew is hand-curatable and turned out to be announceable, and IndyCar was built now.

---

## 18. THE SCHEDULE HUB'S CONTROLS — 2026-09-06, prompt 50

**Numbered 18, not 17.** Prompt 50's brief asked for a "§17"; §17 was already **PROGRAMS GO LIVE**
(prompt 47), so this takes the next free number rather than overwriting a section three days old.

### 18a. Two active-state treatments on one screen, and they differ on purpose

**The six text toggles take a GOLD FILL when active**, with `--spot-3` text on it: `DAY | WEEK`,
`ALL GAMES | MY TEAMS`, `LIST VIEW | GRID VIEW`. That is what
`docs/ux-reference/schedule-hub-concept.png` shows.

**The eight league tiles keep §14's inverted state** — charcoal plate, gold border, gold text.
**The ALL SPORTS bar keeps it too**; Joe asked to change its height, not its colour.

**This does not reopen §14, and the distinction is the whole entry.** §14 inverted the tile state
because prompt 25 *measured* five of ten league **marks** under 3:1 on gold, with the CFP mark a
ghost at 1.61:1. That is a fact about **artwork** on a light plate. The six toggles are **text**, and
text on gold is not the problem §14 solved.

**Do not harmonise one to the other.** Making the toggles charcoal-and-gold-border would lose the
selection emphasis Joe's rendering asks for; making the tiles gold-filled would re-break the five
marks §14 was written to protect.

### 18b. The 44 px tap-target minimum is AMENDED — one entry, THREE control families

Prompt 25 established a 44 px minimum and prompt 34 restored it after WebKit collapsed the tiles on
Joe's phone. **Joe has since excepted three control families, and they are recorded together here
rather than as separate notes that would rot apart.**

| control | height | ruled in | width at 390 | target area | vs a 44 × 44 tile |
|---|---|---|---|---|---|
| **ALL SPORTS bar** | **24 px** (was 44) | prompt 50 stage 2c | 366 px | **8,784 px²** | **4.5 ×** |
| **the three toggle rows** | **31 px** (was 44) | prompt 51 stage 1 | 182 px two-up, ~90 px four-up | **5,642 / ~2,800 px²** | **2.9 × / 1.4 ×** |
| **the picker arrows** | **31 px** (was 44) | prompt 61 stage 3 | **44 px — width unchanged** | **1,364 px²** | **0.70 ×** |

*(Areas re-measured at 390 in Chromium on 2026-09-07 against the shipped stylesheet; the first two
rows previously carried rounded estimates. A 44 × 44 tile is 1,936 px²; the league tiles themselves
measure 40.5 × 44 = 1,782 px², which is what the "vs a tile" column compares against at 1,936.)*

**Joe's reasoning for the first two, on the record: the rule protects SMALL targets, and a wide short
control is not small.** Both carry more tappable area than a 44 × 44 square the rule considers
compliant — the tightest case, a four-up toggle segment, still carries 1.4 ×.

**THE PICKER ARROWS ARE THE FIRST EXCEPTION THAT ARGUMENT DOES NOT COVER, and that is why they are
listed with the number rather than the reasoning borrowed.** At 1,364 px² they are the SMALLEST of
the three and the only one **below** a compliant tile — 0.70 × — because they are the only excepted
control that did not gain width in exchange for height. Joe ruled it on 2026-09-07 for a reason
about the ROW rather than the control: `.pickrow` is `align-items: stretch`, so the arrows' 44 px was
dragging the date pill up with them and the whole row stood 13 px above the toggles it sits under.

**AND THE ROW DOES NOT REACH 31 EITHER — it lands at 31.39**, measured before and after. Relaxing the
arrows only promotes the pill to tallest thing: a 12 px font at the inherited 1.45 line-height is a
17.4 px line box, plus `.pk-face`'s 6 px padding top and bottom and 1 px of border each side. **Joe
was shown that a true 28 would take that padding down to 4 px, and declined it.** The row went
44 → 31.39 and `.hubctl` 216 → 203.39; nothing else in the stack moved.

**31 px was chosen over 60 %'s 26 px specifically so the toggle rows stay visibly taller than the
ALL SPORTS bar.** Joe asked for "about 60% of the vertical size that they are currently"; 60 % of 44
is 26.4, which lands 2 px from the bar's 24 and would have made the two read as one size — the one
thing he said they must not be. Shown that arithmetic he ruled 70 %. **The 7 px separation is the
point of the ruling, not a by-product of it.**

**Two things not to do.** Do not restore either height. Do not add invisible padding or an `::after`
to fake 44 px of hit area — that returns **zero** vertical space and defeats the entire instruction,
which in both cases was to reclaim height.

**WHAT IS NOT EXCEPTED, and keeps 44 px:**

- the eight **league tiles** (`.spbtn`) — 36 px on desktop, as before;
- the picker's **‹ and › arrows**;
- the count line's **reveal toggle**, which gates access to every hidden game and which prompt 25
  called the most important of the three;
- `.chip` and every other control not named in the table above.

### 18b-ii. The control stack's vertical rhythm is ONE gap

**Prompt 51 stage 2.** Joe's instruction was relative — whatever the `DAY | WEEK` → four-toggle
distance measures, that distance everywhere. **Measured: 8 px**, and it is now a single `gap: 8px` on
`.hubctl` with every child's vertical margin zeroed, rather than four margin pairs that could drift.
`.shell`'s `padding-top` carries the banner→stack gap and `.hubctl`'s `padding-bottom` the
stack→content gap; padding rather than margin below, because `main` is a block container and a
margin there would collapse with the next sibling's.

Five of the six gaps in the stack are now 8 px. **One is not: `ALL SPORTS` → tiles stays 6 px**,
because it is `.sportbar`'s own internal gap and it is what makes the bar and the tiles read as one
control rather than two — §16's intent. **Left alone deliberately and pending Joe's look at it.**

### 18c. MY TEAMS runs on a file, and an in-app team picker is a NAMED FUTURE FEATURE

`?scope=mine` filters on the thirteen ids in `data/favorites.json`, resolved once by exact match
within sport and frozen (D6's trap: "Ohio" is Ohio University, not Ohio State).

**Letting a user choose their own teams in the app needs storage and identity this app does not
have.** Every piece of state is in the URL precisely so there is no hydration mismatch and no
per-user store; a team picker needs a per-user list that survives a reload, which means either
`localStorage` — deliberately absent — or an account. **Scoping it is a project, not a stage.** Until
then MY TEAMS is Joe's list, edited by editing the file, which is what D6 ruled it should be.

### 18d. Five sports are permanently part of MY TEAMS

**NASCAR, IndyCar, UFC, WWE and AEW are always included in `scope=mine`**, whatever the favourites
file says. They have **no rosters to pick from** — a race, a fight card and a wrestling show have no
home and away club — so `isFavorite()` can never match one, and following the sport is following all
of it. Filtering them out of MY TEAMS would mean the scope silently drops every program the app
loads, which is 307 of them.

> **BUILT — prompt 51 stage 4b.** `isMine()` in `web/lib/favorites.js` adds the sport rule beside
> the team rule, and `TEAMLESS_SPORTS` names the five. The sport values were measured against the
> live database rather than assumed: nascar 98, aew 35, wwe 36, indycar 18, ufc 9 — **196 rows that
> the scope had been hiding**.
>
> **`aew` is its own sport value** and is deliberately absent from `config.js`'s `SPORTS` and
> `SPORT_FILTERS` (§13), so the list is written out rather than derived from either.
>
> **STUDIO SHOWS ARE EXCLUDED BY CONSTRUCTION, not by a special case.** They carry the sport they
> bookend — `nfl` (80) or `cfb` (31) — never a sport of their own, so the sport rule cannot reach
> them. That is also why excluding them is right: a GameDay instance is a pregame show attached to a
> sport that *does* have teams, not a thing to follow in its own right.
>
> **`isMine()` and `isFavorite()` stay separate on purpose.** `isFavorite` asks whether a row carries
> one of the thirteen clubs and still drives the band-level YOUR TEAMS marker, because that marker
> means "this is one of your teams" and a race has no team to be one of. `isMine` asks whether a row
> belongs in the scope.

### 18e. History's cross-date search is HELD, not deleted

`?q=` searched team and network names across every completed game (`matchesSearch`, and `v1.7`'s
`matchesProgram`). R8 retires it **from navigation** and holds it as a **MY TEAMS sub-feature**: a
lookup *inside* the favourites scope rather than a search of the whole database.

What it would need: a control that narrows the favourites set client-side over `favoriteIds` — not a
new query, since the thirteen ids are already in memory — and explicitly **not** a reuse of
`matchesSearch`, which searches everything and is the behaviour being retired. The `/history`
redirect deliberately does not forward `?q=`: carrying a parameter with nothing on the other side to
read it is worse than dropping one visibly.

### 18f. The desktop live grid stays queued

R5 is unchanged: `GRID VIEW` above 699 px keeps the archived PC render for one sport and an honest
line for ALL. Sticky axes, the NOW marker and any live desktop grid remain a separate project.

### 18g. MY TEAMS is closed (prompt 51 stage 4)

The two items prompt 50 documented and left unbuilt are both done:

- **The page-level YOUR TEAMS section is retired** and D6's in-band float is back — favourites rise
  to the top of their own sport band under a hairline and a faint uppercase micro-label, at BAND
  level, with the card untouched. Both mechanisms were on screen at once until this stage.
- **The five team-less sports are in scope**, per §18d above.

**Still a named future feature, unchanged:** an in-app team picker. MY TEAMS runs on the thirteen ids
in `data/favorites.json`, resolved once by exact match within sport and frozen. Letting a user choose
their own teams needs storage and identity this app does not have — every piece of state is in the
URL precisely so there is no per-user store — so scoping it is a project, not a stage.

---

## 19. THE METALLIC GOLD — 2026-09-06, prompt 52 stages 3 and 4

**Design of record:** `docs/ux-reference/visual-refinement-handoff-2026-09-06.md`, filed in the repo
by stage 0 along with its rendering `visual-refinement-metallic-gold.png`. **The rendering is a
DIRECTION reference, not a specification** — §18 of the handoff says so explicitly, and it is the
section this work was most likely to violate.

### 19a. The six token values, and where they came from

```
--gold:      #C6AF7A    was #f0c850   handoff §4 "primary metallic gold"
--gold-dim:  #8C7650    was #8a7530   handoff §4 "deep gold"
--gold-hi:   #E0D1A5    new           handoff §4 "highlight gold"
--gold-mid:  #B39A69    new           handoff §4 "mid gold"
--gold-glow: rgba(198, 175, 122, 0.22)   new   handoff §4 "soft gold glow"
--gold-line: rgba(198, 175, 122, 0.55)   new   handoff §4 "gold border / fine accent"
```

These are **the one authorized exception to working rule 16** — colour tokens are read from
`globals.css`, never retyped from a mockup — and the exception was authorized exactly once, for this
transcription. Everything downstream reads the tokens. `globals.css` has 23 `var(--gold)` and 3
`var(--gold-dim)` references and **not one call site was edited**; only the eight
`rgba(240,200,80,α)` literals moved, each to `rgba(198,175,122,α)` at its own alpha.

**One inconsistency inside the handoff itself, resolved and recorded:** §4 gives the gold border as
`rgba(198,175,122,0.55)` while §9 suggests `0.40` for the selected edge. **§4's 0.55 is the token**,
because the eight border and glow literals it replaces already ran at 0.25–0.60 and 0.55 keeps them
where prompts 25 and 34 tuned them.

**Contrast, re-measured against the tokens as read from the file** (rule 13 — the local ground, never
a corner sample). All seven of the brief's figures reproduced exactly: **9.02:1** on `--spot-3`,
8.05 on `--spot-2`, 7.35 on `--spot-1`, 5.24 on `--spot-0`, 7.09 on `--panel`, 5.69 on `--panel-top`,
7.55 on `--panel-bottom`. Dark text on the gold plate is **9.02:1**, down from `#f0c850`'s 12.03 and
far above AA. `--gold-dim` improves to 4.43:1 on `--spot-3` from 4.29.

**A pre-existing shortfall, improved but not fixed:** `--gold-dim` is 3.49:1 on `--panel` and 2.79:1
on `--panel-top` — below AA for text. It was 3.37 and 2.70 before, so the new value is a small
improvement rather than a regression, and it shipped on that basis. Its three sites
(`.mgrid-cut-label`, `.offsvc-pending`, `.pending-row::after`) are small metadata labels.

### 19b. A HEX IS NOT ALWAYS A TOKEN — the AEW carve-out

**`data/brands.json` AEW is `#F0C850`, byte-identical to the OLD `--gold`, and it is NOT a use of
that token.** It is a brand constant, recorded in `docs/design/program-card-design-v1.md` as "the
non-red proof against the all-red cluster", and it paints AEW's card wash, seam and endcap bar.
**A find-and-replace on that hex silently repaints a brand.** AEW keeps `#F0C850`; its
`color_source` now says why. The same constant is asserted three times in
`web/test/programs.test.mjs`, and those assertions correctly still pass.

**The trap was named in advance by the prompt and therefore never sprang.** No working rule was
manufactured for it — see §20e.

### 19c. The banner wordmark was never on the token — THE FINDING OF STAGE 4

`BannerMobileV2.jsx` and `BannerDesktopV2.jsx` paint "MYSPORTS TV" with a four-stop **SVG gradient**,
and the same stops live in `banner-mobile-v2.json` / `banner-desktop-v2.json`. **A token change
reaches none of it.** Left alone, the app would have migrated to metallic gold everywhere *except the
largest, most prominent gold on every screen*. Handoff §4 names SVG fills explicitly in its audit list.

```
#FBE59A -> #E0D1A5  highlight     #E4B646 -> #B39A69  mid
#F2CD62 -> #C6AF7A  primary       #D2A038 -> #8C7650  deep
#F3CC5A -> #C6AF7A  primary  — READ FIRST: it is the wordmark's own blurred glow copy,
                               drawn behind the gradient text at opacity .55, not a separate element.
```

**NOT the wordmark and therefore NOT touched:** the `rgb(255,170,60)` glow ellipses and the
`rgb(255,150,40)` TV halo. Those are handoff **§7's charcoal-spotlight background**, which §7 says to
retain and keep recognizable. They are warm on purpose.

**Geometry is untouched and was measured, not asserted** — artboard, type size, letter-spacing, the
6px safe-area absorption, every coordinate. The control stack at 360/390/430/1440 and the banner
artwork's box at those widths crossed with insets 0/47/59 both diff EMPTY before and after. The
component edit is additionally guarded in code: reversing the five stops reproduces the original file
byte for byte.

**This recolours the app's signature element and is open to Joe's veto.** Reverting is one commit.

### 19d. Segmented controls, and the dimension rule

Handoff §6's restrained gradient `#D8C595 → #C6AF7A → #B39A69` with a 1px inset top highlight,
applied as **`background-image` and `box-shadow: inset` precisely because neither participates in
layout**. §6 says preserve current dimensions; the 31px button inside its 33px box and the 8px gaps
were set by prompt 51 against Joe's explicit instruction. Dark text on the LIGHTEST stop `#D8C595` is
**11.34:1** against `--spot-3` — the contrast case §6 creates, clear of AA.

**Sport tiles (handoff §14) were NOT changed.** `.spbtn[data-active]` already renders a charcoal
plate with a gold border and a gold label, which IS §14's ask, and it migrated for free.
**§14's inversion stays** — prompt 25 measured five of ten league marks failing on a gold plate, and
that finding holds against the new gold. No gold fill was re-introduced and no halo was added: the
quiet active state is a deliberate cost (§14) and adding unrequested weight to it is scope creep.

### 19e. LIVE STAYS GREEN — Cowork's call, open to Joe's veto

Handoff §11 asks for a red LIVE dot and label under the rule *red = event state, gold = user action*.
**This app does not work that way and was not changed to.** `--live` is `#7fd1a3`, a green. `--alert`
is `#e8918d`, a soft red, and **it already means "unavailable / out of market"** on the
broadcast-access line and marks errors. Making LIVE red would collide with the colour that currently
means *you cannot watch this* — the opposite meaning.

`--live` and `--alert` are untouched. **§11's actual intent — that LIVE must not be gold, and that
gold must mean action rather than state — is satisfied as built.** If Joe wants red, it is a
`--live` / `--alert` recolour done together, and that is a separate prompt.

### 19f. The card gradient stays `#31363d → #1e2126` — Cowork's call, open to veto

The rendering flattens the card surface to `#2A2A2A`. **Prompt 25 measured `--dim` and `--faint`
against BOTH ends of that gradient** to land the current three-step contrast ramp, and the `--dim`
comment records exactly how little headroom is left ("the third step dies"). Flattening the gradient
invalidates those measurements. Handoff §8 itself says "do not force these exact values if they
conflict with the existing design system. Audit first."

### 19g. Borders: audited, and NOT changed

§9 asks the normal card edge to move toward `rgba(255,255,255,0.07)`. **The app has no white-alpha
border at all** — its edges are `--line` and `--line-soft`, and `--hairline` turns out to have **zero
consumers**. Measured, `rgba(255,255,255,0.07)` composites to ~1.23:1 on the card grounds while
`--line` already runs 1.43–1.52:1: a 0.014–0.019 luminance delta on a sub-1.5:1 hairline, which is
not "demonstrably heavier". Moving `--line` would drag every border in the app against prompt 25 and
34's tuning, and `--line-grid` exists specifically so the grid can be firmer without that. **No
border was recoloured.** The two gold edges already at exactly 0.55 now read `var(--gold-line)` —
zero pixel change.

`.mtray-pill[data-kind='rivalry']`'s `#3a3218` plate was audited too: recomputed in the new family's
hue and saturation at its own lightness it is `#393019`, under 2/255 per channel. Invisible at 16%
lightness. Kept.

### 19h. `prefers-reduced-motion` — the omission in handoff §16

§16 authorizes restrained motion at 120–220ms and **says nothing about reduced motion. That is not
optional.** The app carried no transition and no animation at all before this, so everything added —
a 160ms selected-state transition, a brightness press on segments, a 0.97 scale press on tiles, a
desktop-only hover brighten — lives inside `@media (prefers-reduced-motion: no-preference)`. The
guard is a WRAPPER rather than a `reduce` block that undoes things, because there is then nothing to
undo. Only non-reflowing properties are touched, so no row height or gap can move.

### 19i. Where gold carries INFORMATION rather than selection — REPORTED, NOT CHANGED

Handoff §5: white = primary sports information, gray = secondary metadata, **gold = selection, action
and emphasis**. Audited against the 23 `var(--gold)` sites; these carry state or information rather
than selection, and **Joe decides each one individually**:

| site | what it paints | reading |
|---|---|---|
| `.pill[data-tone='final']`, `.mslot-state[data-tone='final']` | the word FINAL | event STATE, not selection — the same category §11 assigns to red |
| `.maxis-label` | the grid's hour axis (NOON, 1PM…) | information; also contract M5, amended this run |
| `.daycol li .t` | a time in the day column | information |
| `.mtray-pill[data-kind='rivalry']` | a rivalry badge | arguably emphasis, arguably information |
| `.mgrid-cut-label`, `.offsvc-pending`, `.pending-row::after` | cut / market-pending labels (`--gold-dim`) | state |

**Two sites are settled and did not move:** the **gold kickoff time** (`.mtime`) stays gold, Joe
ruled on it directly; and `.mname .mrank` / `.mname .mat` take the BAND'S ink rather than a token,
because gold is invisible on a gold team band (the C4 rule). Unaffected by the new value.

### 19j. Explicitly out of scope

**The gold migration is WEB APP ONLY.** `scripts/render_day.py` and `docs/rendering-contract.md` use
`#F0C850` for the archived desktop renderer's marquee plate, rivalry pill and mock subtitle. **That is
a separate colour system with its own contract, tuned for a light printed ground.** Re-tuning it is
its own job. `docs/design/banner/banner-and-navbar.css` is archival and was reported, not changed.
`docs/prompts/*`, `docs/feature-study/*` and past measurements were not edited — a filed prompt is
never rewritten to look right in hindsight.

### 19k. What was HELD

- **Watch Live** (handoff §10 and Priority 5) — not built. It needs a launch destination and a card
  affordance, which is a feature rather than a colour pass.
- **Sticky-header styling** (§15) — rides phase 4 with the desktop live grid, per R5.
- **The on-card My Team gold treatment** (§12) — **ruled out.** My Team stays at BAND level; prompt
  51 stage 4a retired the page-level section precisely so there is one mechanism, not two.
- **Translucency / glass** (§17, Priority 8) — not applied. §17 itself says "use sparingly", and
  nothing in the current chrome was measured as needing it.

---

## 20. THE NETWORK RAIL, AND THE END OF THE SERIES SUB-FILTER — 2026-09-06, prompt 52

Both reversals in one section because **both overturn earlier entries in this register.**

### 20a. The series sub-filter is retired — §9 AND §16 ARE SUPERSEDED

> Joe: "Remove the Cup / O'Reilly / Truck buttons that render on some screens to sort NASCAR races.
> Simply allow all NASCAR races to appear when they should instead of having them filtered by series."

**§9** recorded Joe choosing individual sport chips **with** a NASCAR series sub-filter, explicitly in
preference to grouped chips. **§16** then placed that sub-filter as a **second row beneath the tiles**,
specifically so the tile row's frozen geometry would not have to move. Both were deliberate. Both are
now superseded, and forward pointers were added at §9 and §16 so a future reader arriving at the old
sections is not misled. **Neither original text was rewritten.**

**Out:** `SeriesFilter` and its call site, `seriesFilter()` in `queries.js`, the `series` URL
parameter, `NASCAR_SERIES` / `SERIES_LABEL` / `resolveSeriesParam` / `showsNascar`, and the
`.seriesrow` / `.serbtn` CSS.

**`programs.series` STAYS IN THE DATABASE.** No migration, no DML, no schema change. Migration 0015
keys a race session on `(sport, coalesce(series, ''), start_at, title)`; **the `coalesce` exists
because NASCAR carries a series and IndyCar does not**, and prompt 48 measured that without it two
loads of the same 18 IndyCar races produced 36 rows. Dropping or ignoring the column would reopen a
duplication bug that has already been fixed once. The column is still SELECTed in `PROGRAM_SELECT`,
just never filtered on. A read before and after confirms **98 rows with a non-null series, unchanged**.
This is the same shape §16 used: a presentation change with no schema change.

**A stale `?series=cup` link renders, ignored rather than erroring** — verified at
`/?day=2026-02-21&sport=racing&series=cup`, HTTP 200, both races present. Old bookmarks keep working.

**Verified on real multi-series days.** Only **4 of 93** loaded race viewing-days carry more than one
series — the 03:00 ET cutover puts a Friday-night Truck race and a Saturday O'Reilly race on
different viewing days, which is why grouping by the UTC date misleads. On `2026-02-21` (Truck "Fr8
Racing 208" + O'Reilly "Bennett Transportation & Logistics 250") and `2026-05-23`, both series render
in LIST and GRID, under the Racing tile and under ALL SPORTS.

**The tile row is unchanged:** 8 tiles, 6px internal gap, 44px tall at 360/390/430. Removing the
second row shifted nothing above it.

**Tests were re-based, not weakened:** the round-trip case moved from `{sport:'nascar',series:'cup'}`
onto the sport token alone, and two new tests pin the deletion and the stale-link behaviour.

### 20b. The rail — the diagnosis, which is not what the symptom looks like

> Joe: "NBC renders much smaller than FOX."

**NBC was at the rail's MAXIMUM height** — 30px, tied for the tallest thing in the column — while FOX
drew at 61 × 25.8. **The eye weighs ink AREA, not height**, and FOX carried 71% more of it.

**The mechanism was not the one the brief described.** The brief attributed it to `max-width: 100%`
overriding `hf` for eleven of twenty-eight marks. The truth is stronger: **`hf` never reached the rail
at all, for any mark.** `MobileGrid`'s rail cell called `markStyle(row.id, 42).src` and used **only
`.src`** — the `<img>` carried no height attribute — so
`.mrail-mark img { max-width:100%; max-height:100%; object-fit:contain }` fit every mark into a 61 × 30
box on its own. Measured live in Chromium: every rail mark reported `height` = null.

Across the suite the ink-area spread was **3.00×**, HBO Max 590px² to Apple TV 1,772px².

### 20c. The trade, and why Joe's two asks could not both be met

Holding every mark at NBC's ~900px² needs a 75px content box — **a rail of 83px, fourteen pixels
WIDER**, because the widest wordmark sets the ceiling for everyone. Narrowing the rail forces the
uniform size down. Shown the measured trade table, **Joe ruled 60px / 600px² on 2026-09-06.**

| | rail | content box | uniform target | spread | visible schedule at 390 |
|---|---|---|---|---|---|
| before | 69px | 61px | none — CSS fit box | 3.00× | 295px |
| **Joe's ruling** | **60px** | **52px** | **600px²** | **1.40×** | **304px (+9px, +3.1%)** |
| "uniform at NBC's size" | 83px | 75px | 900px² | 1.00× | 281px (−14px) |

`web/lib/marks.js` `railMark()`: `H = min( sqrt(600/a), 52/a, 30 )`, with `a` from the manifest's new
`w`/`h` fields. The manifest went from `[{slug, hf}]` to `[{slug, hf, w, h}]` **without re-running the
build** — every `hf` byte-identical, no slug added or dropped. `markStyle()` is unchanged: its other
two callers are the sport band and `GameDetail`, different surfaces, and Joe scoped this to the GRID.

**The two that could not reach the target** were ESPN2 (aspect 5.23 → 9.9px) and HBO Max (6.30 →
8.2px), both already the smallest marks in the column. **Stage 7 closed HBO Max** with the 2025
stacked lockup (aspect 2.14), bringing it to 600px² **with no code change** — the fit recomputes from
the manifest, which is the point of making it data-driven. **27 of 28 now on target, spread 1.16×.**
**ESPN2 is not closed and there is no compact art to close it with:** its brand IS a wide wordmark,
and the only lockup available carries the same 5.28 aspect. The `52/a` term stops binding at aspect
**4.51** (52²/600), not the 4.3 the brief cited.

### 20d. The tripwire moved by exactly 9px, on purpose

`.mgrid-canvas` is `calc(var(--rail-w) + {scale.width}px)`, so narrowing the rail moves `scrollWidth`
and nothing else:

| | before | after |
|---|---|---|
| CFB `2026-09-05` | 64 blocks / {240, 223, 205, 136} / **1282** | 64 / {240, 223, 205, 136} / **1273** |
| MLB `2026-09-03` | 3 blocks / {228} / **577** | 3 / {228} / **568** |

**Block counts and block widths are unchanged.** Those are the parts that would signal a real
regression; if either ever moves it is a regression, not this re-baseline. Mobile Grid Addendum
**v1.9 → v2.0** amends **M4** with the diagnosis, the ruling and the new baselines, and **M5**'s gold
follows §19's token. M21's own recorded 1282/577 is **left as measured**, with the supersession noted
beside it — a past measurement is not edited to look right in hindsight.

### 20e. Two footguns in the marks pipeline, closed

- **`build_web_marks.py --only` does not update one entry.** It filters `todo`, builds `areas` from
  the subset, takes the ink-area **median over that subset**, and writes a manifest containing only
  those slugs — so `--only espn2` replaces `manifest.json` with a one-line file. `main()` now refuses
  `--only` without `--out-dir`.
- **The ink-area target is now FROZEN at `NET_TARGET = 11646.499633789062`.** It used to be
  `statistics.median` over whatever had just been processed, so replacing ONE mark's art silently
  renormalized all 28 — and dragged `build_brand_marks.target()` with it, because that function
  recovers this number from the frozen manifest to size PROGRAM marks against the networks. Measured:
  the HBO Max swap would have moved the median 11646 → 10731, −7.9%. `--recompute-target` re-derives
  it deliberately and says in its help that doing so renormalizes the suite. The value itself was
  recovered empirically: rebuilding to a temp directory with the ORIGINAL sources returned the
  manifest and all 28 PNGs byte-identical.
- Both scripts' manifest writers now pass `newline="\n"` — they were live **working rule 29**
  violations on tracked files.

**No new working rule was written for the AEW hex.** The candidate was *"a colour that appears in a
token and in a brand constant is not the same colour twice"* — but the trap never sprang, because
prompt 52 named it in advance and the code was written around it from the start. §19b records it as a
hazard rather than a rule, and manufacturing a rule from a trap that was avoided would misrepresent
the run. **If a rule 30 is ever written from this run, the stronger candidate is the frozen-target
one above:** a normalization median computed fresh on every build means any single art change
silently resizes the whole suite.

### 20f. Two studio marks were a WIRING bug, not a sourcing problem

`web/public/programs/` had held `big-noon-kickoff.png` and `college-gameday.png` plus a manifest with
real ink-area factors since 2026-09-02, and **`git grep` found nothing under `web/` referencing the
folder.** Two of the four shows Joe named as "missing logos" only ever needed `mark_dark` set.
**Only `mark_dark` is read** (`ProgramCard.js:73`, `MobileGrid.js:764`); `mark` is read by nothing but
tests, so it stays null — program brands publish one file, already dark-processed, where league brands
publish a raw/`_dark` pair. Wiring reaches `scripts/render_day.py` too, which shares
`data/brands.json` and now embeds the art as a data URI.

`gameday` keeps `#F96302` (Joe's Home Depot ruling); re-deriving from the mark gives `#D11222`, which
is exactly "the mark-derived red" that ruling replaced — a check on the method, not a reason to move.
`bignoon` is **no longer provisional**: its note claimed "no mark in the tree; FOX's cached wordmark
is monochrome, so no colour to derive" and that was **false** — the mark was in the tree and is 70.9%
saturated pixels. Colour derived as `#33B1FF` by the rule that derived `indycar`, with one difference
recorded in the file: `indycar` came from a RAW league mark, while the only Big Noon art is the
DARK-CONTEXT build whose recipe lifts the FOX blue. The hue is FOX's; the lightness is the recipe's.

### 20g. Art sourcing — the standing instruction Joe lifted, FOR ONE RUN ONLY

Prompts 25, 34 and 38 all carry *"if the source art is not in `assets/`, stop and report — sourcing
art is Cowork's job, not this prompt's."* **Joe lifted that for prompt 52 stage 7 only**, so the logos
could land unattended. **It is not a general change; the next prompt inherits the old rule unless it
says otherwise.**

**Five of eight** art-less studio shows landed: `nfltoday`, `fnia`, `nflcountdown`, `mnfcountdown`,
`foxnflsunday`. **Three did not:** `foxnflkickoff` (the only findable art is the generic Fox Sports
wordmark, which is the NETWORK, not the show), `tnfpregame` and `netflixpregame` (no distinct
branding, and zero loaded rows). All went through `scripts/build_brand_marks.py` — never a hand-edited
PNG, never a hand-edited manifest — and **provenance is mandatory and recorded per row**, in the
script's `PROGRAMS` table and in the published manifest's new `source` field.

`fox-nfl-sunday` is a **retired lockup**, shipped and flagged per the sourcing rules. `fnia` has art
but **keeps its provisional colour**: after the dark lift only 1.3% of pixels are saturated, and they
are the NBC peacock, which is multicolour by design. That breaks the old invariant *"every provisional
brand is one with no mark"* for a real reason, and the test was re-based onto what still holds — a
provisional brand carries the neutral.

**A pre-existing drift found while checking, not caused here:** the published program PNGs already
disagreed with their own manifest — `big-noon` ink area re-measures at 10609 against the recorded
10085 (5.2%), `college-gameday` 7975 against 7947. Any rebuild was always going to move those numbers.

---

## 21. THE HUB'S DISPLAY ARCHITECTURE, CORRECTED — 2026-09-06, prompt 53

Prompt 53 implements a read-only analysis of the Schedule Hub done at `61469b6`. Six of its ten
stages fix things that were wrong rather than adding anything, and two of those had been shipping
since prompt 50 built the hub.

### 21a. GRID VIEW means the grid is the primary object

**`gridOnly` was DEAD.** `page.js` passed `gridOnly={P.isGrid}` to `Listing` and **`Listing` never
destructured it** — `git grep gridOnly` returned exactly one line in the whole repo, the call site,
and no CSS compensated. So GRID VIEW never suppressed anything. `bands={!P.isGrid}` merely collapsed
the sport bands into one flat unheaded block, which is a *degraded* list.

Measured before the fix, CFB 2026-09-05:

| | cards | bands | grid |
|---|---|---|---|
| GRID @390 | 64 | 1 | phone grid + the whole list |
| GRID @1440 | 64 | 1 | a degraded list, archived grid at the FOOT |

It was one click from LIST and strictly worse at both widths.

**Now:** on a phone GRID VIEW renders the mobile grid and **zero** cards. On desktop the **archived
PC grid is promoted to the top** and the list is suppressed. With **ALL SPORTS on desktop** there is
no archived grid to promote — it is per `(sport, day)` by construction — so one honest line says the
desktop grid is per league and to pick one, reusing `ArchivedGrid`'s own voice.

**The mobile grid is NOT lifted to desktop.** The Mobile Grid Addendum's deviations are phone-only
and M5 says "PC keeps v1.2 labels". **CSS-gated, not JS-gated:** both grids render and one is hidden
by a media query at the same 699px boundary the rest of the app uses, because a JS width state would
reintroduce the hydration mismatch every breakpoint here is CSS-gated to avoid. `.deskgrid-only` is
the mirror of `.mgrid-only`.

**LIST VIEW is unchanged**, proven by the same probe before and after: 64 cards / 1 band / 3866 DOM
nodes at both widths, 70 / 5 / 4278 under ALL SPORTS.

### 21b. A season week showed every sport's programs

`page.js` had:

```js
const progs = seasonMode
  ? await programsForRange(wk.start, wk.end)          // <- no sport
  : await programsForRange(wk.start, wk.end, P.sport);
```

`seasonMode` is `Boolean(P.sport) && usesSeasonWeeks(P.sport)`, so it is true **only when a sport is
selected** — the branch that knows the sport was the one discarding it.

| | before | after |
|---|---|---|
| CFB week 2026-08-29 | 14 programs: 4 cfb + 10 aew/indycar/nascar/ufc/wwe | 4, all cfb |
| NFL week 2026-09-09 | 14 programs: 5 nfl + 9 aew/cfb/nascar/ufc/wwe | 5, all nfl |

**It loses nothing wanted**, checked against the database rather than assumed: a studio show carries
the sport it BOOKENDS — nfl 80, cfb 31 — never one of its own, so filtering by sport keeps every show
that belongs on the week. The ternary is gone rather than half-fixed: both arms were the same call,
and a two-armed ternary with identical arms invites the bug back.

### 21c. Week mode inherits the empty state and the provenance line

**The empty state.** `emptyFor()` returned the bare "No UFC games loaded for this week." — the dead
end register §13 rules out, and exactly what day mode had already been given bespoke `SPORT_EMPTY`
copy to avoid. One tile, the same absent data, two answers depending on which toggle you were on.
**Only the explanatory half is shared**; week mode keeps its own "loaded for this week" framing,
because the two prisms ask different questions.

**The provenance line.** `DataAsOf` was day-only and so is the live overlay, so a week containing
today rendered today's games with database scores and nothing saying they were not live — the case
`DataAsOf`'s own docstring calls out. **The overlay is deliberately NOT added to week mode:**
`overlayForDay` is a per-day fetch and a week is up to ten days. The line says so instead. One
accurate sentence beats silence, and it beats ten fetches.

### 21d. Sport bands in a week, under ALL SPORTS only

**Joe's ruling:** banding adds information exactly when more than one sport is on screen, and adds
only heading noise when the tiles have already narrowed it to one. Week mode passed no `bands` prop
at all, so an NFL game and an MLB game sat adjacent with nothing between them.

**`bands={!P.sport}`.** With a sport selected the flat shape is retained exactly.

**The nesting is the part that needed care.** Passing `bands` initially dropped the weekday heading
entirely, because `heading` only reached the DOM through the flat branch (where it goes into
`SportBand` as `sectionLabel` so C3's count could share its row). With bands there are several
SportBands and no single one to carry it, so it now renders above them — and nothing is lost by
moving it out, because the per-band count was retired in prompt 50 stage 4.

Then the sizes: `.weekday-head` is 21px and `.band-title` is 22.5/25.5px, so **the day would have
read as subordinate to the sport nested inside it.** The day keeps its size and the sports step DOWN
to 16/17px, scoped to `.weekday` so day mode — where `.band-title` IS the outer level — is untouched.
The band mark comes down with the title, or a 27px logo beside 16px type becomes the heading.

### 21e. MY TEAMS does not label every row as yours

The band float tests `isFavorite`; the scope tests `isMine`. They are deliberately different
questions — a race has no team to be one of — and under `scope=mine` that surfaced as nonsense:

| band | rows | label |
|---|---|---|
| College Football | 4 | "Your teams" — every row in the band |
| MLB | 1 | "Your teams" |
| NASCAR / UFC / AEW | 1 each | none — in scope via `TEAMLESS_SPORTS`, fails `isFavorite` |

One page, some bands entirely labelled and others entirely not, for a reason invisible to the reader.
**`floatFavorites={!P.isMine}`**: under MY TEAMS the *page* is the label. ALL GAMES is untouched and
was re-measured to prove it. Item 9 — the FirstBand double-label — is closed both ways.

### 21f. The logo comes first in the grid — JOE'S RULING

> "I want the pregame/postgame program logos to appear clearly no matter what. Priority should be
> given to the LOGO to render clearly — even if it prevents text from rendering… if it fills the
> entire space that is fine — only if there's enough room to render the logo clearly on the left in
> the logo tile, then open up the text portion of the card to the right, only then should logo AND
> text both render."

**What was backwards:** `cap = max(16, min(blockH, w/3))` gave the mark a third of the block and the
title took the largest ladder step that fitted, **falling through to the smallest when none did** —
so the logo was squeezed and the text always rendered, at 8.8px if that was what it took.

**The rule, as a rule rather than a number:** the mark takes the width it needs to draw at its clear
height — `blockH × 0.62 × aspect ÷ 0.78`, the two fractions being `.pblock .pcap img`'s own
max-height and max-width — and **the title renders only if what remains fits it at 18 × SCALE
(14.4px)**. That floor is the fourth rung of the existing ladder, not a new number: the three below
it were always the "it only just fits" sizes.

**LOGO ONLY** fit-boxes the mark into the whole body at up to 86% × 80%. The **wash stays** — it is
what tells four red-branded shows apart — and moves inside the endcap. The **seam and tray stay**:
the tray carries the start time and venue and a reader needs those whether or not the title
rendered. The 3px brand bar goes (it marks the endcap's edge against a stage that no longer exists)
and the subtitle goes with the title.

**Aspect is read from the manifests, never measured in the DOM** — measuring an `<img>` after load
would reflow every program on the grid when the PNG arrived. Two manifests, because a studio show
points at `/programs/<slug>.png` while a race, fight card or wrestling show shares a league mark;
`dark_w`/`dark_h` were added to the league manifest because its own `aspect` is measured on the RAW
file and these brands render the `_dark` variant.

**Zoom is correct by construction and measured.** `capNeeded` derives from `blockH`, which pinch does
not change, while `w` grows — so the logo holds its size and every extra pixel goes to the text. At
390, zoom 1 → 2 on NFL 2026-09-13, three blocks flip from LOGO ONLY to logo+text with their caps
settling at exactly what each mark needs.

**A brand with no art keeps today's treatment**, so the gap stays visible rather than disguised.

**The consequence worth watching:** the NASCAR-marked brands need **282px** of endcap because the
wordmark is 6:1, and their titles run to 50 characters. Those blocks will be LOGO ONLY at almost
every width. The tray still carries the time and venue. That is the trade the ruling accepts, and it
is the most visible thing it does.

### 21g. Four studio-show marks, and every brand now has art

`foxnflsunday` (replacing the retired lockup prompt 52 shipped and flagged), `foxnflkickoff`,
`netflixpregame` and `tnfpregame`. **All eighteen brands now have art.**

**All four ship RAW or nearly so, and that is a finding.** `whiten_below_gap` — the treatment the
brief expected for the two FOX shields — **is a no-op here**: it locates a band of transparent ROWS
separating a badge from a wordmark, and these shields are one solid stack with no gap. `floor_l` was
the obvious second try and is **wrong**, measured at the real endcap size: lifting the black shield
body produces exactly the grey backing plate contract v1.3e forbids, and drags the yellow NFL band
down with it. Raw is crisper and keeps FOX's own colours; the black body receding while the mark
reads by its white type and yellow band **is** the NHL/ABC ruling working.

`netflix-gameday` did want `alpha_harden` — its soft near-black halo reads as a smudge at card size.

**Two portrait marks, not one.** `fox-nfl-sunday` publishes at **0.656**, more portrait than
`fox-nfl-kickoff`'s 0.688 — the two that demand the most width per unit of height.

**Colours**, all derived by the rule that derived `indycar`, all strong enough to clear provisional:
`#FEC00F` (18.1%), `#FEC00E` (17.8%), `#E60914` (15.4% — within 1/255 of Netflix's published
`#E50914`, a check on the method), `#055BD1` (40.7%).

**One rename, one deliberate non-rename.** `netflixpregame` becomes **Netflix Gameday** — the art
says so and there are zero loaded rows, so the art is the only evidence. `tnfpregame` is **left
alone and reported**: the art is the THURSDAY NIGHT FOOTBALL *game* shield, not a pregame-show
lockup (Amazon's pregame show is "TNF Tonight"), and with zero loaded rows there is no title to
check against. Joe's call, not a guess.

**The normalization hazard runs one way only**, verified by reading and then proven: `target()`
recovers the ink-area target from the FROZEN network manifest and never recomputes it from the
programs. `web/public/marks/manifest.json` diffed before and after — **empty**.

### 21h. Two tests hit the escape hatch they were given

Both the Python and JS "a brand with no art draws a typographic mark" tests asserted that some brand
still had none, each carrying a note saying *"if every brand has art this test is retired, not edited
to pass"*. Stage 7 wired the last four and both fired.

**The fallback is not dead code** — it is reached by an **unknown brand_key**, a show loaded before
its art is sourced, which is the normal order of events and was true of every brand in the file at
some point. Both tests now pin that path, which cannot go stale, plus the two invariants that
replaced the old one: art ships with recorded provenance, and every brand keeps a short title for the
endcap to fall back to.

### 21i. Three stale comments, all naming retired routes

`Listing`'s flat branch said *"/weeks and /history keep their flat structure"* and `SportBand`
carried the same claim twice. **Both routes have been redirects since prompt 50 made the app one
route.** They now say what the arrangements are actually for. `Listing`'s band-order comment also
listed SPORTS as "(cfb, nfl, nba, nhl, mlb)" — three of five in the wrong place, four sports missing;
it now names the constant rather than restating it, so it cannot drift again.

### 21j. The MLB tripwire moved, and NOT because of this run

`MLB 2026-09-03` reads **3 blocks / {226} / 564** against the recorded **3 / {228} / 568**. Measured
at `61469b6` with every file of this run reverted, **it is already 226/564** — the change predates
prompt 53 entirely. **Block count is unchanged**, which is the part that signals a regression.

**The cause is data, not code.** `MobileGrid.js:143-163` derives `pxPerMin` from a **runtime
measurement of the widest rendered team line in the real fonts**, and that line carries the record —
every MLB record on this slate is now five characters wide. **The MLB tripwire figure drifts with the
standings.** CFB's is stable and unchanged at 64 / {240, 223, 205, 136} / 1273.

Recorded rather than silently adopted: whether to re-baseline it, or to pin the tripwire to something
that does not move with the season, is Joe's call.

---

## 22. THE WEEK GRID — 2026-09-06, prompt 54

### 22a. Joe's model, and why a week grid is N grids

> "Choosing 'Week 1 NFL' displays all cards for that week's NFL games — cards from Wednesday,
> Thursday and Sunday — and TV grid from Wednesday, Thursday and Sunday."

**A TV grid's x-axis is one viewing day's minutes.** Seven days cannot share one horizontal ruler —
a single axis spanning a week would either compress a day to nothing or run to tens of thousands of
pixels. So a week grid is **N grids, stacked, one per day that has games**, each under its own day
heading. That is exactly what Joe described, and it is the only shape the existing scale model
permits.

**It depends on prompt 53 stage 3.** GRID VIEW had to mean "the grid is the primary object" before a
week could have one; otherwise this would have been a second answer to a question §21a already
settled.

### 22b. The build was small, because `Listing` was already right

`Listing` renders a grid for whatever day it is handed — `showGrid = Boolean(grid && games.length)` —
and the week branch was already calling it **once per day**. It simply passed none of the grid props.
So the change is `grid={P.isGrid}`, `gridOnly={P.isGrid}` and `nowMinute` per day. `sport` was
already there: prompt 53 stage 5 added it for the bands.

**The now marker is computed on the server**, from the request time, exactly as day mode does it — no
clock reaches the client, so nothing enters the hydration path (the trap prompt 42 fell into twice).
At most one day in a week can be now; every other day is archived and has no "now" to mark. Verified
both directions: the week containing today renders exactly one marker, the week before it renders
none.

**Two defects were introduced and caught while building it**, both worth recording because both were
invisible until measured:

1. **The day headings vanished.** `gridOnly` returns null for the whole bands/flat branch, and that
   branch is where the caller's heading renders — so a first pass produced a column of four
   unlabelled grids. `gridOnly` was meant to suppress the CARDS, never the label above them.
2. **Week + LIST gained a grid.** Passing `grid` unconditionally turned the phone grid on in LIST
   too. `grid={P.isGrid}` scopes it.

### 22c. Day + LIST and week + LIST now disagree — FLAGGED, not fixed

**Day mode's LIST view shows the phone grid at 390** (05 §11's page order puts it between the section
and the bands). Week + LIST does not. The brief's acceptance required week + LIST to be untouched, so
that is what shipped — but the two modes now answer the same question differently, and **Joe's own
sentence above asks for "all cards … AND TV grid"**. His ruling, not a bug to fix unasked.

### 22d. The desktop week, and one line instead of seven

The mobile grid stays phone-only — the Mobile Grid Addendum's deviations are phone-only and M5 says
"PC keeps v1.2 labels" — so the desktop week follows §21a's rule **per day**: each day that has an
archived PC render shows it under that day's heading, with the list suppressed. It never falls back
to the phone grid at desktop width.

**The lookup is hoisted to the week**, and that is the whole of the design. `ArchivedGrid` resolves
its own row and renders an honest one-liner when a day has none — right for ONE day, where the note
*is* the answer. **Seven of those stacked is noise.** So the week resolves all its days up front,
renders the figures it has, and names the misses in a single line. Same queries either way.

`ArchivedGrid` was split rather than duplicated: `ArchivedGridFigure` takes an already-resolved row.
**The ALL SPORTS sentence is now one component** (`DesktopGridPerLeague`) called from both modes —
two copies of a sentence are two things free to drift.

### 22e. The scaling question, settled by measurement

Ruled 2026-09-06 after the comparison: **the sport tiles are the scaling control.** Week mode is not
the expensive axis; ALL SPORTS is, and it is already that expensive in day mode.

Measured at 390 on the heaviest loaded ALL SPORTS week, `2026-11-09`:

| | grids / cards | page height | DOM |
|---|---|---|---|
| week, LIST | 173 cards | 27,252px | 4,239 |
| **week, GRID** | **7 grids** | **12,443px** | **2,937** |
| day `2026-09-05`, LIST | 70 cards | 14,542px | 4,265 |
| day `2026-09-05`, GRID | 70 blocks | 4,092px | 2,499 |

**The grid stack is less than half the height of the same week's list**, and about 3× a single ALL
SPORTS day's grid — far inside the ~35,000px that would have been worth flagging. The scaling worry
was founded for the LIST, not the grid.

**No day sub-picker inside the week**, and that is deliberate. If a seven-day stack ever does prove
unusable, the answer is **per-day lazy rendering**, which applies to the list identically — one job,
not a week-grid special case.

**A far-future week shows fewer blocks than cards** — 52 against 173 on `2026-11-09` — because the
grid can only place a game whose network is known, and November is past the announcement horizon
(05 §9). Each day says so itself: "8 games not on the grid · network TBD". Existing behaviour.

### 22f. THE GEOMETRY CHECK, RESHAPED — the important part of this run

**Prompt 53 found the tripwire firing on data** (§21j). This run fixed the tripwire rather than
adding seven more of them.

`MobileGrid` measures `widest` from the rendered team line — `${at}${rank} ${name} ${record}` — and
`pxPerMin = pxPerMinute(widest / SCALE, scaleSport) * SCALE`. **Every block width and `scrollWidth`
derive from that one number**, so the pixel figures are a function of the schedule (stable), the
**records** (drift all season) and the **CFB poll ranks** (drift every Sunday). The CFB baseline is
the *more* volatile of the two and has held only because early-season records are two characters.

**Re-baselining resets a clock. A tripwire that fires on the standings gets ignored, and an ignored
tripwire catches nothing.**

**HARD STOP — code-derived:** block count per network row; lane count per row; number of network
rows; painted width == laid-out width at zoom 0.6 / 1.0 / 2.5; rail delta 0.0px at every zoom after
panning fully right; no block below the 46px floor; no team name wrapped or truncated.

**REPORTED — data-derived:** block widths and `scrollWidth`, recorded **with `widest` and the ratio**.
`.mgrid-canvas` now carries `data-widest`, `data-pxpermin` and `data-day`, so the next run answers
the question in one step instead of the stash-and-remeasure prompt 53 needed:

> **`widest` moved and `scrollWidth / widest` held → the standings.
> The RATIO moved → CODE, and that is the stop.**

**The derived check that earned its place stays a hard stop:** when `--rail-w` changes by N,
`scrollWidth` must change by exactly N. That is what proved prompt 52's rail narrowing did what it
intended, and it holds at any absolute value.

Lives at `web/scripts/geometry.mjs` — `npm run geometry` — **in `scripts/` rather than `qa/tools/`
because `web/qa/` is gitignored**, and a check meant to replace the tripwire discipline cannot live
somewhere untracked.

### 22g. The week's own check is stronger than any baseline

**A grid inside a week must produce geometry identical to the same day rendered in day mode** — same
component, same data, same everything. **That comparison is completely immune to data drift, because
both sides see the same standings on the same run.** It is the week grid's primary guard: if the two
differ, the week path is handing `MobileGrid` different input, and that is the bug.

Four cases, two weeks, including a day whose slate spans nine networks and more than one sport. Every
field exact:

| day | in week | blocks | rows | widths | scrollWidth | `widest` |
|---|---|---|---|---|---|---|
| `2026-09-05` cfb | `2026-08-31` | 64 | 15 | {240, 223, 205, 136} | 1273 | 98.760 |
| `2026-09-03` mlb | `2026-08-31` | 3 | 2 | {226} | 564 | 84.648 |
| `2026-09-13` nfl | `2026-09-07` | 17 | 3 | {264, 98, 73} | 1044 | 122.724 |
| `2026-09-03` ALL | `2026-08-31` | 14 | 9 | {265, 245, 226} | 846 | 84.648 |

**MLB is re-baselined** to {226} / 564 with its `widest` recorded, and the note says plainly that the
figure is expected to drift.

**One self-inflicted false positive, found and fixed.** A first version tested wrapping as
`height > lineHeight × 1.4` and flagged two CFB names. They are not wrapped: `.mname` is a
**fixed-height 29.1px box** whose line-height moves with the fitted font size, so the ratio varies
while the height does not — "UT RIO GRANDE VALLEY" measured 1.52× and sits on one line. The check is
now `scrollHeight > clientHeight`, which asks the actual question.

**The tests are pinned at the CALL SITE**, not to pixel numbers — rule 19's lesson applied to
rendering, and the only shape that does not rot as the season runs. They pin what the week branch
*hands* the component; `geometry.mjs` proves the runtime.

---

## 23. LIST IS A LIST, GRID IS A GRID — 2026-09-06, prompt 55

### 23a. Joe's ruling, and what it supersedes

> "I only want list cards on list view and only grids on grid view."

**This supersedes 05 §11's phone page order, and the reason is chronology.** §11 put the grid
*inside* the Today list — between the favourites section and the bands, ordered in CSS — and it was
ruled **2026-09-03**. The LIST | GRID toggle did not exist until **prompt 50 on 2026-09-06**. So the
grid-in-the-list was never a design chosen over the toggle; it was the only way to reach a grid when
there was nothing to ask for one with. §11's original text stands as the record.

It also settles what prompt 54 left disagreeing: day mode's LIST showed a grid and week mode's did
not (§22c flagged it as Joe's call). The toggle now means one thing in both modes.

**Measured at 390 and 1440:**

| | before | after |
|---|---|---|
| DAY · LIST @390 | 64 cards, phone grid, PC grid — 13,201px | 64 cards, **no grid** — **9,993px** |
| DAY · LIST @1440 | 64 cards, PC grid — 10,210px | 64 cards, **no grid** — 9,897px |
| DAY · GRID | 0 cards, grid | unchanged |
| WEEK · LIST / GRID | — | unchanged |

**The day page is 3,208px shorter at 390** and its DOM drops 3,862 → 1,653 nodes.

**The archived PC grid left LIST view too**, and this went beyond the brief's "what to build".
Prompt 53 stage 3 had deliberately kept it at the foot of a desktop list. But a PC grid under a
desktop list is still a grid on list view, and the ruling is unambiguous. **Nothing is lost:** it is
exactly what desktop GRID VIEW promotes to the top of the page, one click away — reachable in one
place instead of two.

**FirstBand is untouched.** It is a band of cards, not a grid; it still renders in DAY · LIST and is
still suppressed in GRID.

**The CSS interleaving is retired.** `.listing > .mgrid-only { order: -1 }` existed only to lift the
grid above the bands on a phone; with the grid never sharing a page with the bands it had nothing
left to order. `.yourteams`'s order rule is **kept and reported**: prompt 51 stage 4a retired the
page-level section, so that class now only reaches a SportBand carrying a `sectionLabel` — the flat
arrangement, one child, nothing to order against. Very likely vestigial too, but removing it is a
separate tidy-up nobody asked for.

**`docs/design/mobile_demo.html` is annotated, not restructured** (rule 23). It depicts the grid
above the card sections on one scroll — the arrangement this ruling retires. It is annotated because
`build_demo.py` is project-only so the repo copy cannot be regenerated, and because hand-rebuilding
it would put a hand-made page where a generated authority belongs. **What it is still the authority
for is unchanged:** the card's geometry, the chip row, and the grid's own construction.

**qa-shots was re-based, not weakened:** its M2/M4/M6/M11 block loaded a bare day URL because the
grid used to live in the list; it now loads `&view=grid`. Every assertion is unchanged.

### 23b. Four network marks, and the checkerboard

`nfl-network`, `tbs`, `trutv`, `accnx` — supplied by Joe, 2026-09-06. The suite goes **28 → 32**, and
**ESPN3 is now the only access-profile network without a mark**: 32 of 33 covered, down from five
missing.

**THE CHECKERBOARD IS THE FINDING.** `nfl-network` and `accnx` came from a PNG-aggregator that
**flattens transparency onto a checkerboard and ships it as opaque pixels** — they look transparent
in a thumbnail and are not. Both measure 0% clear; the tones are 255/204 and 254/237. `key_plate`
samples an **edge median**, and a two-tone checkerboard defeats it: the median lands between the
tones and matches neither.

**`key_neutral`** was added to `build_web_marks.py`. It tests a **predicate** — `|R−G| < 18` and
`|G−B| < 18` and `mean(RGB) > 170` — and floods 4-connected from all four edges. **Flooding is what
makes it safe:** the NFL shield's interior white stars satisfy that predicate exactly as the
background does, and a global colour test would have eaten them; a flood never reaches them because
they touch no edge. Same reason `key_plate` and IndyCar flood. Keyed **78.1%** and **91.4%**.

**Four ink judgments, each measured on `--spot-2 #1b1b1b`:**

| slug | treatment | why |
|---|---|---|
| `nfl-network` | `dark_ready(key_neutral)` | navy wordmark **1.45 → 4.20:1** |
| `accnx` | `floor_l(key_neutral, .45)` | blue **2.03 → 4.75:1** |
| `tbs` | `key_plate` | the ABC case |
| `trutv` | `floor_l(key_plate, .45)` | the one honest compromise |

**The NHL/ABC ruling does NOT transfer to `nfl-network`, and the numbers are why.** ABC and
`nfl-today` are legal because a dark **body** carries **light** ink: `nfl-today`'s navy measures
**1.17:1** and is invisible, but its white text is **17.22:1** and that is what reads. Here the navy
**is** the word — raw, "NETWORK" disappears and what survives is the NFL league shield, a different
mark.

**`dark_ready` is a no-op on `accnx`**, measured: the grey swoosh and ESPN wordmark sit at 7.28:1 and
pull the mark's mean up, so the chain leaves the blue at 2.03:1 — below the 3.0 floor, for the
brand's own name. `floor_l` is what the app already uses for this (`fs1`: *"FS1's red stays red — it
just stops disappearing"*).

**`tbs` is the ABC case almost exactly:** a black plate carrying white letters, where the black is
the logo's own parallelogram and not a background. `dark_ready` was tested and **inverts it into a
white plate with grey letters** — the backing card v1.3e forbids, and the failure ABC's own note
describes.

**`trutv` is the compromise, and it is measured rather than eyeballed.** Both inks start black and
pull against each other, and there is no row gap for `whiten_below_gap` to find because the lockup is
horizontal:

| treatment | "tru" on charcoal | "TV" on green |
|---|---|---|
| RAW | 1.22 ✗ | 14.00 |
| `whiten_dark .35` | 15.80 | 1.38 ✗ — whitens the TV too |
| `dark_ready` | 4.30 | 2.67 ✗ |
| **`floor_l .45`** | **3.58** | **3.21** |
| `floor_l .55` | 5.12 | 1.11 ✗ |

0.45 is the only value keeping both above the 3.0 floor. No plate is greyed — the background is keyed
transparent — so this is not prompt 53's `floor_l` trap.

**THE NORMALIZATION HAZARD WAS ALREADY CLOSED.** Prompt 52 stage 7 froze
`NET_TARGET = 11646.499633789062` for exactly this, so no pin was needed. **The manifest diff is the
proof: 4 added, 0 changed, 0 removed**, every existing PNG byte-identical.

**The rail fit:** all four land on **600px² exactly** and the spread is unchanged at **1.16×**, with
`espn2` still the only mark off target. Their published aspects are 2.625 / 1.852 / 2.594 / 4.211 —
these are the **trimmed** dimensions, not the source canvases.

**Wiring.** All four labels were already in `access_profile.json`; NFL Network, TBS and truTV were
already in `row_order.json`. **ACCNX was the only one missing a row**, added to `cfb.streaming`
before SEC Network+ — same kind of service (the database types both `streaming`), and ACC-before-SEC
mirrors the order `cfb.conference` already uses.

**Verified rendering:** `nfl-network` on 2026-10-04 and `tbs` on 2026-09-08 both draw at 599px².
**`truTV` and `ACCNX` do not appear on their loaded days, and that is correct** — they are simulcast
feeds, and those games are eligible via `tnt` and `acc-network`, so they sit on those rows. The marks
are ready for when they are the eligible feed.

### 23c. ESPN3 REJECTED — recorded so it is not re-sourced blind

The art supplied for ESPN3 carries a **"clearpng" watermark baked over the letterforms**. The flood
key clears its checkerboard but **cannot reach the watermark**: it is not connected to the border,
and where it crosses the red it is not neutral. **ESPN3 stays without a mark until clean art exists**
— the typographic fallback is better than bad art.

### 23d. Working rule 31

Added, and **distinct from rule 30**: rule 30 is about a claim that was true when written and went
stale, and its remedy is "check the thing itself". Rule 31 is about a claim where the file was
correct, the thing **was** checked, and the query was asked in the wrong vocabulary — `nfl-network`
the slug against `NFL Network` the label. Rule 30's remedy does not catch it.

Four instances, three in one week, including one **caught mid-stage in this very run**: a slugify
that mapped `Paramount+` to `paramount` reported three unmarked networks when the answer was one.
---

## 24. TEN APPROVED REVISIONS, AND THE VERTICAL RHYTHM — 2026-09-06, prompt 56

Every item here was proposed from a read-only pass at `017d73e`, shown to Joe as paired before/after
mockups, and **approved by him on 2026-09-06**. R11 was shown in the same set and **declined**; it is
recorded below so it is not re-proposed.

### 24a. The ten, with the views each one changed

| R | what changed | views | commit |
|---|---|---|---|
| **R5** | the developer footnote is removed | all eight | `a9b1664` |
| **R7** | the count line says **broadcasts**, not games | all eight | `a9b1664` |
| **R6** | the provenance line takes week mode's condition | all eight | `a9b1664` |
| **R1** | the count line REPORTS in grid view, it does not reveal | the four GRID views | `05711ac` |
| **R2** | MY TEAMS names itself | the four MY TEAMS views | `1875386` |
| **R3** | the week's day heading carries the league mark | the four WEEK views, tile selected | `5dced9a` |
| **R4** | the weekday heading renders at ONE level | the four WEEK views, tile selected | `5dced9a` |
| **R8** | the empty day names the nearest LOADED day | Day · All Games, list and grid | `edb459f` |
| **R9** | the first band's subtext is the clock alone | Day · list, both scopes | `e7a39be` |
| **R10** | the desktop grid answers on a programs-only day | Day · Grid, desktop | `50d4a67` |

**R5.** *"Every game is kept in the database — nothing is deleted. Reads are anon, read-only, live."*
described the data architecture to a reader who came to find out what is on television, and it was
the only copy in the app written from the build's side of the screen. `.footnote-tz` — *"All times
are Eastern · Cleveland market."* — stays and is now the only footnote.

**R7.** `pageCountLine`'s `on` counts every row the page shows, and since v1.7 that includes a NASCAR
race, a UFC card and College GameDay. None of those is a game. **`broadcast` is true of all of them**,
and it is the word D4 used before prompt 26 shortened it to fit a 390px band header; at page level
there is room for the accurate one.

**R6.** Day mode rendered `DataAsOf` on `!error && rows.length`; week mode renders it inside
`(visible.length || hidden.length)`. **A day where every game was off-service showed a count line
with no provenance, and the identical week showed both.** One condition now, in all eight views.

**R1 — the reveal leaves GRID view.** `PageCount`'s `<button class="offsvc-toggle">` opened
`.pagecount-hidden`: sport bands, `<h2>` titles, matchup and program cards and the tap-to-open
`GameDetail` panel. **That is a card list under a grid**, and it is the direct contradiction of Joe's
ruling *"I only want list cards on list view and only grids on grid view."* Prompt 55 implemented
that ruling inside `Listing`; the reveal lives in `PageCount`, so the two never met.

**Measured before the fix:** one press put **20** card and band elements under Day · All · GRID and
**88** under Week · All · GRID. After: all four grid views render **0** elements matching
`.mcard, .pcard, .band-head`, and there is no control that could open one. The count line is
unchanged and a plain clause replaces the button — *"18 not on your services — switch to List to see
them"*. The four LIST views are unchanged bar the request clock.

**R2 — MY TEAMS names itself.** Joe pinned the wording:

> **MY TEAMS · 13 CLUBS + RACING + COMBAT SPORTS**

Small, gold, uppercase, marked by a **left** rule — a different gesture from every heading on the
page, which mark with a bottom one, so it cannot be read as a band title. It renders below the
control stack in the four MY TEAMS views and nowhere else, whether or not the day has games.

**The club count is derived** from `favoriteIds(favoritesDoc).size` and never written down: a line
reading "13 clubs" above fourteen clubs' games is worse than no line. **The two category words cover
all five team-less sports** — `racing` = nascar + indycar, `combat sports` = ufc + wwe + aew — and a
test asserts that coverage against `TEAMLESS_SPORTS` exactly, so a sixth team-less sport fails the
test rather than silently going undescribed. `racing` is **already the app's own filter token** for
those two (`FILTER_EXPANDS`), so the line and the Racing tile agree by construction; **`combat
sports` is a display label only** and a second test refuses to let it become a filter token or a
sport value.

This is the first surface in the app to state that **MY TEAMS includes every race, fight card and
wrestling show**, not just the clubs. §18d ruled it; nothing said it.

**R3 + R4 — one heading, one level, with the league on it.** With a tile selected `bands={!P.sport}`
is false, `Listing` took the flat branch and `SportBand` rendered `showHeader={false}` — no mark, no
title — so three days into WEEK · NFL **nothing on screen said NFL** except a highlighted tile far
above. And the weekday heading was **two different objects**: a `<p>` sibling above the bands under
ALL SPORTS, a `sectionLabel` inside `.band-headrow` with a tile picked. Same text, same class, two
DOM levels. C3 put it in that row so a per-band count could share it; prompt 50 stage 4b retired the
count, and the reason went with it.

**WEEK · ALL SPORTS is byte-identical after the change** — the mark's absence leaves the heading text
as a bare node, so no wrapper was added to a heading that did not need one. The mark's `alt` is the
league NAME, not empty: a band mark sits beside an `<h2>` that already says it, and this one does not.

**THREE dead things fell out, not two.**

- `SportBand`'s `className={sectionLabel ? 'band yourteams' : 'band'}`. The page-level YOUR TEAMS
  section that class belonged to was retired by prompt 51 stage 4a, and prompt 55 reported the CSS
  rule as vestigial. What kept it **alive** rather than merely unused is that the class was still
  being APPLIED — and the only caller passing `sectionLabel` was week mode passing a **weekday**, so
  **every Tuesday was being marked as a page-level favourites section.** `sectionLabel` and
  `headingClass` are removed from `SportBand` outright.
- `globals.css`'s `.listing > .yourteams { order: -2 }` and `.band-headrow > .favlabel`, both of
  which only existed to place or un-style that heading. `git grep yourteams` returns nothing under
  `web/`; this register and `docs/hub/hub-audit-2026-09-05.md` still name it, correctly — they record
  what was.
- **An EMPTY `.band-headrow`**, measured in the first band on 2026-09-06. With `showHeader` false and
  no `sectionLabel` the row rendered with nothing in it and painted a bare hairline plus 14px above
  the cards. The row is now gated on `showHeader`.

**R8 — the empty day stops naming dates that have passed.** The generic empty state hardcoded six
viewing days — *"try 2026-09-03 or 2026-09-04 (MLB), 2026-09-05 (CFB), 2026-09-13 (NFL), 2026-10-01
(NHL) or 2026-10-28 (NBA)"*. **Three were already in the past**, and by November it would have been a
list of dead ends. Week mode's *"try a CFB or NFL week"* does not age because it names no date.

`nearestLoadedDay(day, sport)` is bounded — `select=viewing_day`, ordered, `limit=1`, sport-scoped,
**never an unbounded select** (working rule 19) — and at most two calls, the second only when the
first comes back empty. It runs **only** on a day that is already empty and is not MY TEAMS, so a
populated page makes no extra round trip, and a failure or an empty answer falls back to a line with
**no date in it**, because an empty state must not be able to 500.

    2026-01-15          The next loaded day is Saturday, August 29, 2026.
    2026-01-15 + MLB    The next loaded day is Monday, August 31, 2026.
    2028-01-01          Nothing later is loaded — the most recent loaded day is Sunday, April 11, 2027.

**It reads `games` only,** and that limit is stated rather than hidden: programs have no
`viewing_day` column, so a programs-only day is never OFFERED here. It still renders normally when
reached, because this empty state does not fire there. **`SPORT_EMPTY` is unchanged** — those lines
name external gates ("NASCAR arrives with the playoffs, September 6"), not loaded data, which is why
they are allowed to name a date.

**R9 — the first band states the clock.** The subtext read the day label, then the clock, then " ET".
Prompt 46 recorded Joe reconfirming that, and the reason it gave was true then: the page heading read
the bare word DATE and this band was the one place the viewing day was spelled out. **Prompt 50
retired that heading**, and the picker two rows above now shows the date in exactly those words. So
the day half goes and the clock stays — **`as of 7:12 PM`** — because a band that changes with the
time has to say which time it read. **No " ET"**: prompt 31 took that off every clock in the app and
the footnote carries it once. `dayLabel` is removed from `bandState` with it — it fed nothing else.

**R10 — the desktop grid answers on a day with no games.** The archived PC grid was gated on
`games.length`, so a day carrying only **programs** — a NASCAR Sunday, a studio-show morning — had
zero games, fell through both arms and rendered an **empty `.deskgrid-only` container**: no grid and
no explanation. Week mode asks `grouped[d]?.length`, its visible rows, which counts programs, so the
two modes disagreed about what "has content" means. Day mode now asks week mode's question — `rows`,
the same post-`splitHidden` visible set — and `ArchivedGrid`'s existing one-liner does the rest, so
there is no new copy. Measured at 1440: 2026-09-06 NASCAR, 2026-09-05 UFC and 2026-09-07 WWE all went
from a 0px empty container to the honest line.

### 24b. The three band titles, renamed as a set

Joe asked for one and then ruled that **all three should match** rather than leaving two connectors
doing one job.

| state | was | is |
|---|---|---|
| `tonight` | `Tonight` | `Tonight` *(unchanged)* |
| `live` | `On now · Next up` | **`Live & Upcoming`** |
| `finals` | `Finals · Tomorrow` | **`Finals & Tomorrow`** |

**This supersedes 05 §D1b's wording.** The three STATES are untouched and are still exactly the three
D1b specced — only what they are called. The feature study, its mockups and the prompt archive still
quote the old names, correctly: they record what was decided when, and this section is the
supersession.

### 24c. R11 — CONSIDERED AND DECLINED

Joe weighed adding **"2 of 14 today"** beside the first band's clock on 2026-09-06 and **said no**.
The subtext is the clock alone. **Do not re-propose it.** A test in `bandstate.test.mjs` asserts the
absence of a fraction, so a future improvement trips rather than ships.

### 24d. THE VERTICAL SCALE BELOW THE PICKER — the part a future change must obey

Joe: *"evaluate the vertical spacing between cards and between sections that render below the picker
— make sure they're standardized and not excessive."* Measured **rendered** at 390 in all eight
views, then applied one scale, derived from the control stack's own rhythm, which prompt 51 settled
at 8px:

| role | value |
|---|---|
| card → card, and anything inside one group | **8px** |
| a heading → the content it labels | **16px** |
| one section → the next section | **24px** |

**THREE HARD RULES, and they bind every later change:**

1. **No rendered gap may grow.** A pair already below its target keeps what it has and is reported;
   it is never opened up to hit a number.
2. **Nothing inside a list card or a grid block changes.** The card contract is locked (v1.6.4) and
   the grid's internal geometry — lane gaps, block heights, tray heights, the rail — is frozen by the
   geometry tripwire.
3. **The control stack is out of scope.** Prompt 51 tuned it and Joe confirmed it on the device. The
   scale starts BELOW the picker.

**MEASURE RENDERED, NEVER DECLARED.** `.listing` is `display:flex; flex-direction:column` with no
`gap`, so its children stack on their own margins and nothing collapses out of it; elsewhere on the
page adjacent block margins DO collapse. Two rules declaring 8px can render 8 or 16. A box-to-box gap
also hides a margin that lives INSIDE one of the boxes — a day group's heading clearance is a flex
item's margin and so sits inside `.weekday`, which is why the table below is ink to ink.

**What moved, ink to ink at 390:**

| pair | before | after |
|---|---|---|
| last card → next day heading | 61 *(55 in grid view)* | **24** |
| last content → the count line | 44 *(38 in grid view)* | **18** |
| band → band | 26 | **24** |
| cards → favourites rule → cards | 14 both sides | **8** both sides |
| count line → provenance line | 34 | **24** |
| provenance line → footnote | 34 | **24** |
| picker → first day heading (week) | 29 | **24** |
| scope line → content (week) | 37 | **16** |

**The single largest excess was a trailing margin.** `.listing` is a flex column, so the last band's
26px did not collapse out — it simply made the container taller. `.pagecount-hidden` has carried
`.band:last-child{margin-bottom:0}` since prompt 50; `.listing` now has its twin.

**The day heading's top margin was the UA's `1em`** — 21px at 21px type, a number nobody had chosen.
It is declared at 16px and is now the whole clearance above a day group; the group itself carries
none, and `.weekday + .weekday` adds the 8 that makes 24. The same 16 sits under the control stack's
own 8px padding, so the first group is 24 as well — one number, two places, from two owners that each
mean something.

**HELD BY HARD RULE 1, reported and not changed:** band header → cards **8** (target 16); day
heading → its content **6** (16); first band → the list **22** (24); first band head → its body
**13** (16); last content → count line **18** (24); picker → first content **8 / 22 / 24** by view.

**ONE STATED EXCEPTION.** Day · My Teams · Grid: scope line → grid is **30**, not 24. It is the
caption's 16 plus the grid panel's own 14px top margin — and that 14 is also what makes Day · All ·
Grid's picker → grid 22px, which rule 1 forbids opening up and does not ask to be closed down. A
stated exception is worth more than a forced number.

**The geometry tripwire did not move at all:** block counts, lane counts, network-row counts, block
widths, `scrollWidth` and all three ratios identical (12.8898 / 6.6629 / 8.5069).

**Page height at 390, before → after:** 11077 → 10999, 4012 → 3972, 2156 → 2102, 1533 → 1493,
18512 → 18111, 8739 → 8508, 4710 → 4440, 3627 → 3411.

### 24e. Working rule 32

Added, and **distinct from 22, 30 and 31**: a ruling implemented in one component is not implemented
until every component that renders the same thing obeys it. **Four instances in this one run** — see
`docs/handoff-status.md`.

### 24f. THE LOCKED REFERENCE — rule 23 checked, stage by stage, and NOT edited for the build

`docs/design/mobile_demo.html` declares what it is the authority for: *"the CARD's geometry, the chip
row, and the grid's own construction."* Each stage was checked against that, and **none of them
alters something the reference implements**:

- **Stages 1, 2, 3, 5, 7** touch a page-level footer, a page-level count line and its reveal, a scope
  caption, an empty state and a desktop container. The reference has none of these constructs.
- **Stage 4** is the WEEK's day heading; the reference has no week view. Its `.secthead` renders
  `Fri Sep 4 · MLB` with the league mark beside it — **the same shape stage 4 built**, so the app has
  moved toward the reference rather than away from it.
- **Stage 6** renames the FIRST BAND's three state titles. The reference's `Tonight · MLB` is its own
  sport-section head (`.secthead`), not `BAND_TITLE`, and it carries no clock subtext.
- **Stage 8** is the app's `.band` / `.weekday` / `.footnote` / `.listing` rhythm. The reference lays
  its rows out inside one 390px phone frame with its own idiom (`.mrows{gap:6px; padding:0 12px
  14px}`, `.secthead{padding:10px 14px 6px}`, `.mgwrap{margin:0 12px 14px}`) and none of those
  constructs exists in the app. Its grid-above-the-cards arrangement was already recorded as
  superseded by prompt 55.

**An annotation was added to its header comment anyway**, so a later reader does not take the frame
paddings for the app's scale. That is a note, not a restructure — `build_demo.py` is still
project-only, so the repo copy cannot be regenerated.

### 24g. Citations in prompt 56 that were wrong

**One, and it is small.** The brief cites `offservice.js:306` for the string that builds the count
line; :306 is the `pageCountLine` declaration and the string is on **:309**. Every other citation in
the brief was correct at `017d73e`, including the two most worth re-checking: `globals.css:2040`
really is `.listing > .yourteams { order: -2 }`, and `FirstBand.js:27` really is `band.heading`.
### 24h. THE YOUR TEAMS MICRO-LABEL GOES BACK TO 15px — 2026-09-07, Joe

**Two `@media (max-width:699px)` rules were setting `.favlabel`'s phone size**, both at equal
specificity: `font-size:15px` beside the class itself, and `font-size:22.5px` inside the
`.band-title` media block ~130 lines later. **The later one won, so the 15px rule had been dead** for
as long as both existed. Joe's ruling: keep 15px, delete the 22.5px declaration, leave the desktop
25.5px alone.

**THIS IS NOT A RE-RAISE OF A SETTLED DECISION (working rule 10) — the ruling's PREMISE expired.**
05 §D6's open item *"whether the `YOUR TEAMS` micro-label survives Joe seeing it rendered"* was
**CLOSED on 2026-09-03 by prompt 31**, and the reason it gave was explicit:

> D6 specified it as a faint micro-label separating floated rows *inside* a band; §11's reorder made
> it the **first heading on the page**, which is a different job. It now takes the band-header
> treatment — same family, weight, size, letter-spacing and hairline as `.band-title` / `.band-head`.

**`.favlabel` is not that heading any more.** Prompt 51 stage 4a retired the page-level YOUR TEAMS
section §11 created, and prompt 56 stage 4 removed `sectionLabel` — the last path by which this class
could reach page level at all (§24a). The only thing carrying `.favlabel` at runtime today is D6's
in-band micro-label, `<p class="favlabel">Your teams</p>` inside a sport band. So the job is D6's
again and so is the size. **05 §D6's closure is superseded on the PHONE SIZE only**; everything else
prompt 31 set — family, weight, letter-spacing, uppercase, `--ink`, the hairline — is untouched.

**IT ENDS A DISAGREEMENT RATHER THAN STARTING ONE.** `.fband-title` carries the note *"matched to
`.favlabel` / `.band-title` deliberately: the page has ONE heading system"*, and it is **25.5px
desktop / 15px on a phone**. At 22.5px `.favlabel` was the only one of the three not keeping that
promise. Measured after the change:

| | phone 390 | desktop 1440 |
|---|---|---|
| `.favlabel` | **15px** | 25.5px |
| `.fband-title` | **15px** | 25.5px |
| `.band-title` (day view) | 22.5px | 25.5px |

**`.band-title` is now the outlier on a phone, and that is left alone deliberately** — it is a real
band heading with a mark beside it, not a micro-label, and nobody asked for it to move. Recorded so
the next reader sees it was noticed rather than missed.

**Rules still targeting `.favlabel`, read from the file after the change** — four, and no duplicates:

| where | what it sets |
|---|---|
| `globals.css` `.favlabel{…}` | family, weight, **25.5px**, letter-spacing, uppercase, `--ink`, margin, padding, bottom hairline |
| `globals.css` `@media (max-width:699px){.favlabel{font-size:15px}}` | the phone size — **now the only one** |
| `SportBand.js` `<p className="favlabel">Your teams</p>` | the sole runtime consumer |
| `Listing.js` / `FirstBand.js` `headingClass` default | `'favlabel'`, and both pass no `heading`, so neither renders one |

`.band-headrow > .favlabel` was removed by §24a and did not come back.
---

## 25. THE ODDS PIPELINE, THE THIRD GREY, AND THE BANNER GENERATOR — 2026-09-07, prompt 57

### 25a. The odds pipeline had FOUR defects, and only two of them were the one Joe reported

Joe reported odds failing to render on the right of CFB cards. That was true, and three more sat
beside it — two affecting sports where odds *did* appear.

| # | defect | fixed here | commit |
|---|---|---|---|
| A4 | the embed is unordered and unlimited; every consumer reads `[0]` | **yes** | `538ebcb` |
| A2 | NHL hardcoded `"odds": None` | **yes** | `c73f928` |
| A1 | CFB emits no odds — `fetch_lines()` was never wired in | **yes** | `e73ff21` |
| A3 | the upsert can never match, so rows accumulate | **migration prepared, NOT applied** | `a60c6cf` |

**A4 — and the brief's account of it was wrong in a way worth recording.** `queries.js` embedded
`odds:game_odds(...)` with no `order` and no `limit`, and PostgREST guarantees nothing about the
order of an embedded resource. The brief concluded the card had therefore been showing "the oldest
line ever fetched", frozen since the refresh went daily. **Measured 2026-09-07 it was coming back
NEWEST-first for all seven multi-row games sampled** — `nfl-401872658` (5 rows) and six MLB games.
The cards were right by luck. That is not a reason to leave it: nothing promises that ordering, and
an unordered read that happens to be correct flips silently and raises no error when it does.

`ODDS_NEWEST = '&odds.order=fetched_at.desc&odds.limit=1'` is appended at **all five** `GAME_SELECT`
call sites. The params are top-level and keyed to the embed alias; inside the select parens PostgREST
reads them as a column and answers 400. **Three consumers, not two** — `MatchupCard.js:136`,
`GameDetail.js:40` and **`MobileGrid.js:597`**, which the brief's first draft missed. That is working
rule 32's exact shape, and `test/odds.test.mjs` pins the call site rather than a row count (rule 19),
because a count test passes against a database that simply has no duplicates yet.

**A2 — the NHL join, and the trap one endpoint deep.** ESPN's NHL scoreboard carries the same
DraftKings block `espn.py:_odds()` already parses for the NFL and NBA, and `LEAGUE_PATH` already maps
`nhl`, so this was a join and not a parser. The join is **`(ET date, away abbrev, home abbrev)`** and
deliberately not ids — `nba.py:226` documents in this codebase that ESPN's event ids are not the
league's and that joining on them "would leave every NBA card without a live score and raise no error
at all."

> **THE BRIEF WOULD HAVE SHIPPED A SILENT BUG HERE.** It said to translate through the existing
> `NHL_TO_ESPN`, which has five entries and "covers all five and nothing else". Measured against both
> live APIs, 32 clubs each: **the SCOREBOARD diverges on exactly FOUR** — LAK, NJD, TBL, SJS. ESPN's
> scoreboard spells Utah `UTA`, exactly as the NHL does; only its **TEAMS** endpoint says `UTAH`.
> `NHL_TO_ESPN` is right for the teams join `build_teams()` does and wrong for this one, and applying
> it would have turned `UTA` into `UTAH`, matched no event, and dropped every Utah game with no
> error — the same failure the brief was quoting `nba.py` to prevent, arriving through a different
> door. `NHL_TO_ESPN_SCOREBOARD` is separate, and a test fails if the two are ever tidied into one.

The map records **every** event, priced or not, because a priced-only map cannot tell "the book has
not posted yet" from "the join broke". A missing key is the alarm; a `None` value is ordinary.
Measured at fixture level on the recorded 2026-10-01 window, **no loader run**: 47 games, **47
joined**, 22 priced, 25 not priced yet, **0 unjoined**. Books post NHL lines as the game approaches —
2026-10-15 and 2026-11-10 both returned none.

**A1 — the fetcher nobody connected.** `cfbd.py:55` defined `fetch_lines()` and `git grep` found its
own definition and nothing else. No `odds` key meant `load.py:258` was never true, no `game_odds`
row, `favourite()` null, `format.js:271` unreachable — **the empty slot Joe reported**.

CFBD answers 401 unauthenticated and no `/lines` sample existed, so week 1 2026 was fetched live with
the repo's key (never printed) and the mapping written from the observed payload. **The sign needs no
flip**: CFBD's `spread` is already negative-when-home-is-favoured, verified two independent ways —
92/0 against `formattedSpread`, 82/0 against the moneylines — and `0003_games.sql:139` turns out to
have documented exactly that all along.

**Two data findings the brief did not have.** CFBD returns the same book under **two spellings**:
`"Draft Kings"` with a space appears 170 times on week 1 and **every one carries a null spread and
null moneylines**, and on 12 entries it is the only provider — so `_odds` prefers a book that HAS a
spread before it consults the named order, or those 12 pick an empty book and a real Bovada line
beside them is discarded. And **two Bovada lines contradict themselves** (401864432, a near-pick'em;
401856780, carrying an `awayMoneyline` of -100000, a placeholder not a price). DraftKings is
preferred and never disagrees, which is why the test asserts on the *chosen* book.

**THE PROVIDER PREFERENCE IS DraftKings, THEN Bovada, THEN THE FIRST** — named, never iteration
order, mirroring `mlb.py:165`. DraftKings is first because it is what ESPN returns for the NFL, NBA
and NHL, so one book is now the app's default across all five sports. Week 1: 99 FBS games, 99
priced, 0 without a spread, all DraftKings. Joined on the CFBD game id, safe **here and only here** —
`/games` and `/lines` mint the same id, 171 of 171.

**A3 — prepared, not applied.** `0003_games.sql:146` declares `unique (game_id, provider,
fetched_at)`; `load.py:259-261` upserts against it with an empty update list; `db.py:149` compiles
that to `DO NOTHING`; and every adapter stamps a fresh `fetchedAt`. The target can never match, so
the upsert has **never once updated a row**. Measured over paginated anon reads: **471 rows, 379
distinct games, worst single game 5, 392 distinct (game_id, provider) pairs, 32 of them carrying 79
surplus rows.** The existing data violates the new constraint, so the dedupe ships commented out with
its SELECT-first query (rule 6). `load.py` is **untouched** and must stay so until the migration is
applied — the new target against a database with no such index fails every loader run.

**IT IS NOT URGENT, and A4 is why.** With `order=fetched_at.desc&limit=1` the card already reads the
newest line however many rows sit behind it. A3 is table hygiene.

### 25b. CFB AND NHL ODDS DO NOT APPEAR UNTIL THE NEXT SCHEDULED REFRESH

Stages 2 and 3 changed **adapters** and were proved at the **fixture** level. No loader ran and no
database write happened. The rows arrive with the next `schedule_refresh` at 11:00 UTC. **An empty
odds slot on a CFB card the same evening is expected, not a failed stage.**

### 25c. `--panel-top` darkened, and the criterion that could not be met

`#31363d -> #23262b`, Joe's ruling of 2026-09-07. The `--faint` comment had handed him the choice:
true AA for the card's first line needed `--faint` at `#989fa8`, which is 4.55:1 against `--dim`'s
own 4.62:1 — the two collapse and the third grey step dies. He picked the gradient's top end.

Solved, not chosen by eye: the minimum darkening along the token's own hue and saturation at which
`--faint` reaches 4.5:1, measured against the **local background** (rule 13) with every token read
from `globals.css` (rule 16).

| | top of gradient | | bottom | |
|---|---|---|---|---|
| | **before** | **after** | before | after |
| `--ink` | 10.86 | **13.54** | 14.40 | 14.40 |
| `--dim` | 4.62 | **5.76** | 6.13 | 6.13 |
| `--faint` | 3.63 | **4.53** | 4.82 | 4.82 |

All three now clear AA on the card's top surface; `--faint` did not before. **The arithmetic landed
exactly on `--panel` (#23262b) on its own** — not a typo; the tokens stay separate so the gradient's
top can move again without dragging every flat panel with it. The gradient is now much subtler:
21.57% → 15.29% HSL lightness at the top against a 12.5% bottom.

**ONE CRITERION IN THE BRIEF CANNOT BE MET BY THIS CHANGE AT ALL.** It asked to keep `--dim` "at
least 1.3:1 distinct from `--faint`" while solving. That ratio is a property of two **foreground**
tokens and no background change can alter it: it is **1.272:1 before and after**. It is already under
1.3, and separating those two greys is a different change — on `--dim` or `--faint` — and still Joe's
call.

**Blast radius, read rather than assumed:** 10 consumers, all the identical gradient, so one number
covers them all — `select`, `.chip`, `.mcard`, `.daycol`, `.gridpanel`, `.mtbd-card`, `.spbtn`,
`.picker`, `.seg`, `.pk-arrow`. The active-toggle gold plate (`globals.css:2836`) uses literal
`#D8C595` with `--gold`/`--gold-mid` and no `--panel-top`, confirmed by reading the rule.

### 25d. The banner generator — a documented tool that did not exist

`Banner.js:5-7` has said since prompt 42 that coordinates are "never hand-edited here" and that the
component "is regenerated from" the JSON. **The generator was not in the repository or anywhere
reachable.** The repo held a generated file whose generator nobody had, and a comment forbidding the
only edit anyone could actually make.

`scripts/build_banner_mobile.py` closes it, and was **proved before anything moved**: built from the
unmodified JSON it reproduced the committed component **byte-for-byte below the header comment** —
same viewBox, 24 images, rect, two ellipses, gradient stops and ids, filter primitives, three text
baselines. Two details made byte identity possible: the glow transform is reproduced with `decimal`
(0.73913043478260869565 is twenty digits; float division gives sixteen), and numbers are emitted with
`str()` on the parsed value so `36.0` stays `"36.0"` and `84` stays `"84"`.

**THE BRIEF'S PREMISE WAS WRONG, AND IT INHERITED THAT FROM MY OWN EARLIER READ.** It said the JSON
"cannot express the change even if a generator existed" because there is no `viewBox` key. There is
no key by that **name**, but **`stage: {w, h}` is exactly that fact** and always was. No `viewBox`
key was added — a second copy of a fact is a second thing to get wrong. Only two things were
genuinely prose-only: `headroom_paint.rect` and `filters.svg`, both added through a parser with an
assertion that no other key changed (rule 17). The ground rect's height is **derived** as
`overhang + stage.h`, which is why model F moved it without being told to.

### 25e. Model F

Approved 2026-09-07 after two earlier arrangements were rejected. viewBox `0 0 428 155 -> 0 0 428
135`; **measured 141.2px → 123.0px at a 390 viewport**, the predicted 18.2px, all 24 images present.

A uniform −7 (the artwork ran y=11..141 with 11 units of margin above and 14 below; both become 4) ·
MLB 11→14, floating 10 above the NFL and NHL tops · NASCAR 129→119, base 131, ten below the NBA and
WWE bases · the TV cutout to 70%, 79.9×84 → 55.93×58.8 at x 306.04 on the same centre axis 334.05,
y 43.1 on the array's midpoint 72.5 — it is illustration, not a logo, so it is the one thing allowed
to scale · NFL 24, NHL 25, CFP 60, UFC 66.5, NBA 93, WWE 96 · the 15 network marks up a further 6.5,
closing the gap under the tagline from 12.5 to 6 · wordmark baseline 36.88→29.88, tagline 53→46 ·
the two glows take the same −7 so they stay over the artwork they light.

**32 values changed and every one is a position**, asserted through a parser: no key added or
removed, no logo resized, no mark moved horizontally, all 23 marks plus the TV present.
**G was considered and rejected**: it centred the array inside 127 units for free, at 115.7px, but
landed MLB at y=5 hard against the ceiling, which is precisely what Joe had already turned down. F's
whole 7.3px cost against that alternative is the NASCAR drop, and that was deliberate.

*Arithmetic note:* the brief's own rule (−7 then −6.5) gives 55.75 for fox/espn/cbs and 107.75 for
netflix/peacock; its explicit list says 55.7 and 107.7. The explicit list was used, since that is
what Joe approved in the rendered models. The difference is 0.05 units — 0.045px at 390.

**Rule 23:** `docs/design/mobile_demo.html` does **not** implement this banner — read, not assumed.
Its own header is a plain `.abar` text bar and its single "banner" mention is about the frozen
mark-sizing manifest. No change was required there. The desktop banner is untouched and out of scope.

### 25f. One sheen, and why it is the wordmark and nothing else

Joe, 2026-09-07: *"one time sheen is fine with me."* A `<rect>` inside an SVG `<mask>` cut to the
wordmark's own letterforms, translated by CSS — **what travels is a fill, never a layout box**.
Measured with motion on and off, `.banner`, `.hubctl`, `.pickrow`, `.seg`, the tiles and the first
card are byte-identical rectangles in both.

**It cannot reach any gold that carries state.** Gold means *selected* or *this is the day you are
on* in five places — the active toggle fill, the active tile border, `.scopeline`, `.weekday-head`
and `.pk-arrow:focus-visible` — and a sheen on those turns a signal into decoration. Measured on a MY
TEAMS CFB page, every one computes `animation-name: none`, and **exactly one element in the document
is animated**.

**§16 is not claimed to cover it.** Its 120–220ms is for STATE transitions, where speed is feedback.
This is an identity gesture nobody asked for, so it is slower (1500ms) and late (400ms, after the
marks paint): at §16's speed it reads as a glitch on load, which is worse than no sheen. One
iteration — a banner that shimmers every few seconds is the gloss handoff §6 forbids.

### 25g. Four strings, one of which was a comment

`'Starter TBA'` leaves the **card** — it rendered on every MLB card twice whether or not anything was
known, which is the blank row the card's own rule forbids, wearing a label. Measured: an MLB card
with no starters announced is **132.3px instead of 168.3px**, and one with both is unchanged.
`GameDetail` keeps its own; the panel is where that sentence is the answer.

`'Assignment not entered'` → **`'Not yet confirmed'`** — the build describing its own database state,
the same class as R5's developer footnote.

**The dead search chain was FIVE sites, not three.** `SearchBox`, `matchesSearch` and `networkName`
had zero callers outside each other; **`primaryBroadcast`** was a fourth, exported but reachable only
through `networkName`; and `MatchupCard.js`'s comment describing `'No linear telecast'` as a live
concern was the fifth, corrected in the same commit (rule 30's second half). Deleting the chain is
what retires that string — prompt 24 flagged it as a false certainty, and it was one wiring change
from a card.

### 25h. Working rule 33

Added, and it is **rule 30's mirror rather than rule 30**. See `docs/handoff-status.md`.

### 25i. Citations in prompt 57 that were wrong

The brief said its first draft had five errors and to assume this one had some too. It did — three,
and the first two would have shipped defects:

1. **`NHL_TO_ESPN` has five entries and the scoreboard diverges on four.** Reusing it would have
   dropped every Utah game silently. §25a.
2. **The banner JSON "cannot express" the stage height.** `stage: {w, h}` is the viewBox. §25d.
3. **A4's severity.** The card was showing the newest line, not the oldest. §25a.

Two smaller ones: `nba.py`'s note is at **:226**, not :225, and it says "every **NBA** card", which
the brief quoted as "NHL"; and the mark arithmetic in §25e is 0.05 off its own stated rule.

**And one the brief got right that I had got wrong**: `_safe` does exist at `nhl.py:266`. My earlier
search missed it because a `head -30` truncated the output — which is working rule 31 pointing at the
pipeline rather than the query.
---

## 26. THE COLLAPSING HEADER — 2026-09-07, prompt 58

### 26a. The card gradient, walked halfway back

From the prompt 57 device check. **Joe: *"walk the token change halfway back not all the way back.
Otherwise everything else checks out."*** Prompt 57 solved for AA alone and overshot: it cleared
`--faint`, but it also flattened the card's top-to-bottom gradient from a **1.327** luminance ratio
to **1.064** — near enough to flat that cards, toggles, tiles and picker arrows stopped reading as
raised objects.

`--panel-top` `#23262b` → **`#2A2E34`**, the exact midpoint of prompt 57's change, verified channel
by channel (49/35→42, 54/38→46, 61/43→52). `--faint` `#868d96` → **`#8E959E`**, because halfway alone
drops it to 4.07 and loses the AA the last prompt won.

| | `#31363d` | `#23262b` | **`#2A2E34`** |
|---|---|---|---|
| `--ink` | 10.86 | 13.54 | **12.17** |
| `--dim` | 4.62 | 5.76 | **5.18** |
| `--faint` at `#868d96` | 3.63 | 4.53 | 4.07 — fails AA |
| `--faint` at `#8E959E` | — | — | **4.51 — clears AA** |
| gradient spread | 1.327 | 1.064 | **1.183** |

**THE BLOCKER THE OLD `--faint` COMMENT RECORDS WAS A PROPERTY OF THE GROUND, NOT OF THE TOKENS**,
and that is the part a future reader of that comment needs. It said AA required `#989fa8`, which is
4.55:1 against `--dim`'s own 4.62:1 — the two collapse and the third step dies. True on `#31363d`. On
`#2A2E34`, `--dim` measures 5.18 and the room reopens: a **smaller** lift clears AA and leaves 1.148
of separation, against 1.014 at the value that note rejected.

**A COST THE BRIEF'S TABLE UNDERSTATED.** The lift buys AA for the third grey by **spending
separation between the second and third**: `--dim` vs `--faint` was 1.272 and is now 1.148. The brief
compared 1.148 against the dead 1.014 rather than against today's 1.272. Both greys survive and
neither gap is comfortable. Widening it again means moving `--dim`, which is a separate change and
still Joe's.

Ten `--panel-top` consumers, all the identical gradient; 16 `--faint` sites. The active-toggle gold
plate uses literal `#D8C595` and is untouched — read, and its computed value read back.

### 26b. What Joe approved, and what it is not

Ruled 2026-09-07 across four exchanges: **expanded first, then collapse on scroll** (not
opens-collapsed); the bar carries **the wordmark and the four current choices and nothing else**;
**no tagline, no TV cutout, no artwork**; `DAY`, `ALL GAMES` and `LIST` **flip on tap**; `ALL SPORTS`
**opens the tile row**; and **scroll position alone owns the state** — there is no manual expand.

**WHAT IT DOES NOT BUY, so nobody "improves" it by opening collapsed:** the above-the-fold burden is
unchanged at banner 123 + shell padding 8 + control stack 216 = **347px** before the first card. The
saving is **reachability** — the four choices follow you down a 20,000px day — not first paint.

**WHY THE TAGLINE AND THE TV ARE NOT IN THE BAR, and this is the line most likely to be "restored"
by a future reader: they were MEASURED OUT, not forgotten.** At 390 the wordmark alone is 129.9px and
the four choices are 148.7px against 218.1px of room once padding and gaps come out. There is no
column left for a tagline, and the TV cutout is illustration whose whole job is the expanded
banner's warmth. Both were in Joe's original sketch and both lost to the arithmetic.

### 26c. Ephemeral UI state — the line, drawn now rather than argued later

This is the hub's **first client-side UI state**. `app/page.js` and globals.css both record that
every breakpoint is CSS-gated at 699px *"precisely so there is no server/client hydration
mismatch"*, and the hub is deliberately URL-only with no localStorage.

It is legitimate because it is **post-mount and ephemeral**: the server renders the **expanded**
state (`collapsed` starts false, so the first client render is byte-identical to the server's), the
observer applies the collapse only after hydration, and nothing is persisted or read back.

> **THE LINE.** State that answers a question **about the world** — which day, which sport, which
> view — belongs in the URL: it has to survive a reload and be shareable. State that describes only
> **where the reader is looking right now** is presentation, and putting it in the URL would make
> every scroll a history entry. If a future piece of client state cannot be described by that second
> sentence, it belongs in the URL instead.

Two pieces qualify under it: whether the bar is collapsed, and whether the tile row is open. The URL
still owns `sport` itself.

### 26d. The containing-block risk did not exist, and the real one is smaller

Cowork briefed a sticky page header as creating "a new containing block" above the grid's sticky
rail, and called it a serious risk. **That is false.** `position: fixed` and `position: sticky` do
not establish containing blocks for descendants — only `transform`, `filter`, `perspective`,
`backdrop-filter`, `will-change` and `contain` do. And globals.css already said so on `.mrail-cell`:
the rail holds *"only while nothing between this element and `.mgrid-scroll` carries a transform."*

The header is mounted **beside `Chrome`**, which makes it a sibling of `.shell` and therefore never
an ancestor of `<main>` or of the grid. It cannot reach that chain at all. A test asserts it never
wraps the content, because that is the one edit that would put it there.

**The real risk is touch interception**, and it is why the bar is list-view-only for now — see 26f.

### 26e. A third accessibility pattern, beside §17's two

§17 records that this app deliberately runs two patterns: `role="radiogroup"` + `aria-checked` for
the three toggles (exclusivity announced, not inferred) and `aria-pressed` for the eight tiles (a
filter that can be cleared is not a one-of-N choice).

**A collapsed binary shows only ONE option, so it can be neither.** There is no group to be one of
two within, and nothing is "pressed" — the word on screen is a statement of fact and the tap is a
verb. So: **visible text is the current state, accessible name states the action.**

```
"DAY"        ->  Time range: Day. Switch to Week
"ALL GAMES"  ->  Scope: All games. Switch to My teams
"LIST"       ->  Presentation: List view. Switch to Grid view
```

A full stop between state and action, not a dash — a dash is read as a pause, not a boundary.

**`ALL SPORTS` IS THE EXCEPTION WITHIN THE EXCEPTION.** It is a disclosure, so its name is state only
— *"Sport: All sports"* — and `aria-expanded` carries the verb. A name that also said "show" would
make a reader hear the affordance twice.

### 26f. The grid exclusion — deliberate, temporary, and what has to be true before it lifts

The bar is **absent from the DOM** in all four grid views, proved by eight assertions in the qa-shots
gate (14/14 → **22/22**). Absence rather than invisibility, because a fixed element at only
`opacity: 0` still takes touches in some engines.

**Not because it would break.** 26d settles that. Because `.mgrid-scroll` sets
`touch-action: pan-x pan-y` and runs a pinch handler, and a fixed bar over the top 44px of that
scroller has never been tried on a real device. **Week mode compounds it**: N stacked grids, each
with its own rail and handler, a combination itself unconfirmed on a phone.

**WHAT HAS TO BE TRUE BEFORE IT LIFTS:** the bar confirmed on Joe's phone in list view; the week grid
stack confirmed on a phone at all (still outstanding from prompt 54); and a pinch and a horizontal
pan tried with the bar showing, at the top edge of the scroller, on a real device. Chromium will
never reproduce the failure — prompt 30's rail bug was WebKit-only.

### 26g. Measurements, and the brief's model against them

The brief's width table was modelled at an estimated 0.45em advance because the font host was
blocked, and it said so. Measured with the real font:

| | modelled | measured |
|---|---|---|
| wordmark @22px | 108 | **129.9** |
| run @11.5px | 244 | **142.5** |
| available at 390 | 258 | **218.1** |

They partly cancel, so the conclusion held — but **"14px does not fit" is false**: 14px is 173.4px
against 188.1px of room at 360. Shipped at 12px, the size the brief named, leaving 39.5px spare at
360 and 69.5px at 390.

**`SPORT_LABEL.cfb` WOULD HAVE BROKEN THE ROW** — "College Football" is 93.3px against the ALL SPORTS
target of 57.5px. Every other label fits (IndyCar, next widest, is 40.8px), so only `cfb` differs.
`SPORT_SHORT` in config.js is that fact, and it **replaced** page.js's local `SPORT_TAG` rather than
sitting beside it: same five keys, byte-identical values, and two short-label maps is one to update
and one to forget.

Four 44px targets forced two further changes: the gaps came down (12→8 between wordmark and run, 6→4
between targets, 4→3 padding), and **the wordmark drops to 18px below 390** — at 22px it was 36% of a
360px screen, and the four choices are what the bar is for. Verified at 360, 375, 390 and 430 with
ALL SPORTS and with CFB: no overlap, nothing past the padding, nothing under 44px, nothing squeezed.

**`flex: 0 0 auto` is load-bearing.** Flex items shrink below their content by default, and at 360
that silently clipped ALL GAMES and ALL SPORTS mid-word in a row that still looked like a row.

### 26h. A tap keeps the scroll position, and the one case that cannot

Next's `router.push` jumps to the top. Measured before the fix: a tap threw the reader from 700 back
to 0, the sentinel re-entered the viewport, and **the bar hid itself with the tap that caused it**.
`useSetParam` now takes an options argument; the bar passes `{ scroll: false }` and every other
caller keeps Next's default, which is right for them — changing the day lands you at the top of a
different slate, and the expanded toggles are at the top anyway.

**SWITCHING SCOPE STILL RESETS TO THE TOP AND CANNOT BE FIXED HERE.** The document collapses from
20,432px to 3,021px and the browser abandons the scroll position on a change that large. `mode` and
`view` both hold at 700. Landing at the top of a much shorter filtered page is arguably right anyway.

**Tapping `LIST` is a one-way door from the bar**, by design: it switches to grid, where the bar does
not render, so it vanishes with the tap that caused it. Getting back is the expanded stack, one
scroll up — the same journey as changing the day.

### 26i. Two test defects, one of them prompt 56's

Writing a JS word-boundary through a shell heredoc turns `\b` into a literal **BACKSPACE byte**. It
happened in this run first, and a repository-wide sweep then found **prompt 56 had shipped the same
thing into `bandstate.test.mjs`**: R11's guard was `/<BS>of<BS>/`, which nothing can match, so it has
**passed vacuously since the day it was written**.

**And correcting the escape would not have saved it.** `/\bof\b/` matches the heading's own wording,
*"as of 9:14 PM"*. R11 was never about the word — it was about a **fraction**, which is what the
surviving assertion tests. The guard now also pins that the heading is the clock alone.

No control bytes remain anywhere under `web/`, `tests/`, `adapters/`, `pipeline/` or `scripts/`.

### 26j. Rule 23 — the locked reference is NOT stale

`docs/design/mobile_demo.html` is the authority for *"the CARD's geometry, the chip row, and the
grid's own construction."* A page header that appears on scroll is none of those. Read rather than
assumed: its own `.abar` is a static wordmark-and-day bar inside each phone frame, its `.mswitch` is
the demo's own navigation between mockups, and **the page models no scroll behaviour at all** — each
frame is a fixed-height mock. Nothing the reference implements changed, so nothing there needed to.
It carries a one-line note saying so, because "the app has a header the reference does not" is
exactly the observation a future reader would otherwise file as drift.

### 26k. Working rule 34

Added. See `docs/handoff-status.md`. Distinct from 22 and 33 because its object is **platform
semantics** rather than anything in this repository.

### 26l. Citations in prompt 58 that were wrong

1. **The width model** — wordmark 108 vs 129.9, run 244 vs 142.5, "14px does not fit" vs it fits at
   every width tested. The brief flagged the figures as modelled; the direction of the error was not
   what it expected.
2. **"258px available"** — 218.1px at 390, because the wordmark is wider than modelled.
3. **The tile row at "74px"** — measured **82px**.

The brief's central technical correction — that a fixed or sticky header cannot become the grid
rail's containing block — **was right**, and it was the load-bearing one.
---

## 27. THE FAVOURITES BRACKET, THE PROGRAM PANEL, AND TWO HARVESTS — 2026-09-07, prompt 59

### 27a. The favourites bracket

**Joe, 2026-09-07:** *"On the ALL GAMES views, 'Your Teams' still appears… Because the 'Your Teams'
section isn't noticeably separated from the rest of the content below, it leaves the user confused."*

He offered two fixes — an accent marking his teams, or dropping the label and letting position do
the work. **Neither was taken as written**, because there were **two defects and only one of them
was the one he named**:

- **`.favlabel` was `.band-title` character for character** — 25.5px display, 700, uppercase, `.09em`,
  own bottom hairline. So a band read `COLLEGE FOOTBALL` then `YOUR TEAMS` at equal weight, and
  nothing said where the second heading's scope ended.
- **`.favrule` was imperceptible.** 1px of `--line-soft` on a card-gradient ground. It was the one
  element whose whole job was *your teams end here*. **That was the actual cause** — the group had no
  visible bottom edge, so it bled into the rest of the band.

**A bracket says both things at once** — where the group starts, where it ends, and whose it is — and
it borrows a gesture the app already owns: `.scopeline` marks the MY TEAMS scope with
`border-left: 2px solid var(--gold)`, so a gold left rule already means *this is about your teams*
here. Both the heading and the rule are retired.

**IT RETIRES THE "Your teams" / "My teams" NAMING INCONSISTENCY DELIBERATELY**, not by accident. That
has been an open item since prompt 58's session; the band no longer names the scope at all, so there
is no second word left to disagree with the toggle.

**THE COST WAS MEASURED, AND THE BRIEF PREDICTED THE WRONG ONE.** `.mcard`'s body track is
`minmax(0, 1fr)`, so the inset comes out of the room `fitNameAndRecord` has. Across 26 favourite
cards over seven days:

| inset | body | records lost | name tiers dropped |
|---|---|---|---|
| 2 + 9 = 11px | 103px | 0 | **10 of 26** |
| **2 + 4 = 6px** | **108px** | **0** | **0** |
| 2 + 0 = 2px | 112px | 0 | 0 |

No record is ever lost — that was the predicted cost and it does not happen. What does happen at 9px
is ten cards dropping a name tier (12.5→11, or 15→12.5), the same harm in different clothes and
visible on every one. **At 4px the bracket costs nothing at all.** `.scopeline` keeps its 9px because
it sits above content rather than beside a width-constrained card: same mark, two paddings, one
reason.

Four of eight views — `floatFavorites={!P.isMine}` at all three call sites, so MY TEAMS never floats
and never brackets. Asserted in the qa-shots gate, which goes 22/22 → 25/25.

**Two things fell out.** `headingClass` defaulted to `'favlabel'` and `FirstBand` passed it with no
`heading` to put it on; the default is gone, because defaulting to a dead class would have styled a
future caller's heading as a band title — the exact confusion this stage ends. And two comments
describing `.favlabel` as live were corrected in the same commit (rule 30's second half).

### 27b. The detail panel did not know what a program is

**Joe, 2026-09-07:** *"when you click on the event and the sub-card popup renders, the title bar says
TBD @ TBD."* **Three defects, and he could only see one.**

1. **The head.** Programs reach this panel exactly as games do — `Listing` and `PageCount` wire
   `onOpen` to both card types and render one `<GameDetail>` for whatever was tapped. A program has
   no `home`, no `away` and no team ids, so `cardName` fell through to its `|| 'TBD'` and printed
   **TBD @ TBD**, flanked by two `<img>` whose `src` was built from `undefined`.
2. **The probable-pitcher block** was gated on `sport === 'mlb'` alone, so an MLB studio show would
   render *Probable pitchers* reading TBD / Starter TBA twice. **Verified before fixing, as the brief
   required: this is LATENT, not live.** Zero of the 307 non-game programs carry `sport: 'mlb'` today
   — they are nfl 80, cfb 31, nascar 98, aew 35, wwe 36, indycar 18, ufc 9. Guarded anyway; the day
   an MLB pregame show loads is not the day to discover it.
3. **The venue row read `game.venue?.name`.** A program's place is `location_text` — **130 of 307
   carry one** — so the row was simply absent on every program.

**AND ONE THE BRIEF DID NOT ANTICIPATE.** `subtitleFor` already falls back to `location_text` when a
program has no subtitle of its own, which is every race. A naive Where row printed DARLINGTON
RACEWAY twice in one panel; it now renders only when the head has not already said it.

**The helpers are imported, never reimplemented** — `titleFor`, `subtitleFor`, `brandFor`,
`tintToWhite`, `ENDCAP_GRADIENT` and `isProgram` all come from `lib/programs.js`, the same source
`ProgramCard` and `MobileGrid` read. That is working rule 32's shape: a second title-builder would
drift from the card's within a prompt or two. The **typographic fallback survives** — a brand with no
art renders its short title rather than an empty box or a fabricated logo.

**The game path is untouched.** The close button, Escape, Where to watch, the odds block and the
provenance line already worked for programs and were not restructured.

### 27c. What the `game_odds` surplus actually contains — a decision input, not a decision

Migration `0017` is still unapplied and Joe owes two decisions on it. This answers the second.

Of the 32 `(game_id, provider)` pairs holding more than one row:

| | pairs | surplus rows |
|---|---|---|
| **identical** — only `fetched_at` differs. Pure re-fetch noise. | 12 | 31 |
| **moved** — a real line change. | **20** | **48** |

**Most of the surplus is real**, and some of the movement is large: `mlb-823091` / FanDuel went
`-1.5 / -215 / +180` to `1.5 / +118 / -138` across three fetches — **the favourite changed sides**.

**Which makes it a product question rather than a hygiene one.** A dedupe keeps the newest row, so
the current line is never lost; what is lost is how it got there. Nothing reads that history today —
`queries.js` takes `limit=1` ordered by `fetched_at desc`, `render_feed.py` takes `distinct on
(game_id)` ordered the same way — so it is write-only. If *"opened at −3, now −3.5"* is ever a
feature, this constraint is the wrong shape and a history table is the right one. If it is not, the
48 rows are as disposable as the 31.

Also checked: **there is no unbounded reader of `game_odds`.** Those two are the only consumers and
neither can be truncated by PostgREST's silent 1,000-row cap.

The evidence lives in the migration file itself rather than somewhere Joe would have to go and find.

### 27d. The Universal Link harvest — groundwork

Read-only, and the answer was not in this repo. Full record at
**`docs/research/universal-links-aasa-2026-09-07.md`**; bodies at `artifacts/aasa/`, which is
gitignored, so the document is the committed evidence.

23 hosts built from `WATCH` joined to `access_profile.json` — **a slug-keyed file against a
label-keyed one, which is rule 31's exact hazard**, so the searches are named in the document and
both unmatched sides are reported. **11 of 23 returned a parsable AASA.**

**The ESPN answer, which is the one that matters:** `www.espn.com` claims `/*/game/_/gameId/*` for
the ESPN app, plus recap, boxscore, playbyplay, matchup and video variants. `gameId` is the
identifier this database already holds. **But there is no general `/watch` claim**, so the declared
route opens the app *on the game*, not on a live stream — and `plus.espn.com`, where `WATCH` sends
ESPN+ and ESPN Unlimited, hosts no AASA at all.

**Evidence only.** Nothing evaluated, ranked or recommended: the next question is which patterns
MySports can populate from ids it holds, and the one after that is a tap test.

### 27e. Rule 23 — the locked reference has no favourites group

`docs/design/mobile_demo.html` was read rather than assumed: it contains **no** "Your teams",
`.favlabel`, `.favrule` or favourites float of any kind. It never implemented what 27a changed, so
nothing there needed to change and no annotation was added — unlike prompt 58's collapsing header,
where the *absence* was itself worth a note because a reader might have filed it as drift. A
favourites group the reference never depicted cannot drift from it.

### 27f. No new working rule

Rules stop at **34** and this run does not earn a 35th. The near-miss worth recording without minting
a rule: **two of this run's measurements were wrong because the probe was wrong, not the app** — a
case-sensitive filter against CSS-uppercased text reported an absent `Where` row that was present,
and a hardcoded padding constant reported ten squeezed labels that were not. Both were caught by
disbelieving a result that did not fit the code. That is rule 22's habit applied to one's own
instruments rather than a new rule.

### 27g. Citations in prompt 59 that were wrong

Three, all small and all line-drift from edits made in prompts 57 and 58:

1. **`.band-title` is at `globals.css:2120`**, not `:2094`.
2. **`floatFavorites={!P.isMine}` is at `page.js:392`, `:584`, `:600`**, not `:389`, `:581`, `:597`.
3. **`GameDetail.js`'s head is at `:53-57`**, not `:50-56`.

`.favlabel:1989`, `.favrule:1993`, `.scopeline:2003`, `isProgram` at `programs.js:250`, `brandFor` at
`:130` and `ProgramCard`'s head at `:66-89` were all correct. The brief's own status table said
prompt 58's header was "pushed at stage 1"; it was pushed at the end of the prompt-58 run, which is
why stage 1 here had nothing to do but confirm.
---

## 28. THE NAVBAR JOE DESIGNED, AND MY TEAMS SAID ONCE — 2026-09-07, prompt 60

### 28a. The header collapses one way, and expands only on request

**Joe, 2026-09-07, across four exchanges:**

> *"I'd like the banner to collapse as you scroll up OR by a purposeful tap on the tv ON the banner.
> Then the navbar that replaces it — which shows MySports TV and the Day / All Games / List / All
> Sports text buttons… The navbar would take the place of the banner once a user scrolls past the
> banner, and [it] would remain permanently in place from that point forward until the user taps
> 'MySports TV' in which case the full banner and expanded toggles would appear atop the app."*

| trigger | result |
|---|---|
| first paint | expanded — the full banner and the whole control stack |
| scrolling past the header | **collapses** |
| tapping the TV on the banner | **collapses** |
| tapping `MYSPORTS TV` in the navbar | **expands**, and returns the reader to the top |
| scrolling back to the top while collapsed | **stays collapsed** |

**WHY SCROLL MAY NOT EXPAND — this is the part that looks arbitrary later and is not.** Prompt 58
shipped a two-way binding: the sentinel's callback was
`setCollapsed(!entry.isIntersecting)`, so scroll owned the state in both directions and there was no
manual control at all. The moment a TAP can also set the state, two inputs are writing one boolean —
and the reader's first collapse by tap would be undone by their next scroll to the top, which is
exactly the fight prompt 58's brief predicted and avoided by having no manual control.

**One direction each removes the conflict entirely.** Scroll collapses; the wordmark expands. Neither
can contradict the other because neither can perform the other's move. `collapseHeader` is idempotent
and there is deliberately no scroll path that calls `expandHeader` — the unit gate asserts the
observer's callback contains no `expandHeader` at all, scoped to the callback rather than to the file
(a first attempt hunted for `else` and let
`if (!entry.isIntersecting) collapseHeader(); else expandHeader();` straight through; the regex was
checked against that string rather than trusted).

**THE STATE IS A MODULE, NOT REACT STATE, AND THAT IS FORCED.** Three surfaces share the boolean and
one of them — the page's own control stack in `app/page.js` — is a **server component** that can hold
no client state. A context could serve the bar and the TV button and never reach `.hubctl`. So the
layout change travels as **one attribute on `<html>`**, `data-hdr="collapsed"`, and CSS does the
hiding. Prompt 58's hydration story is unchanged: `headerCollapsedOnServer()` is a constant `false`,
the server writes no attribute, and a reload starts expanded.

**THE SENTINEL MOVED, AND THE MOVE IS WHY THE COLLAPSE DOES NOT JUMP.** It sat in `app/layout.js`
immediately after the banner, which was right when collapsing only ADDED a fixed bar. Collapsing now
REMOVES the banner and the stack from the flow — about 300px — so the trigger has to fire when the
whole collapsible region has gone. It is rendered by `Controls` in `app/page.js`, **after `.hubctl`
and deliberately outside it**: hidden by the collapse, it would have no box left to measure. It lives
in `Controls` rather than in either return because there are two of them, and a sentinel in one only
would give week mode a header that could never collapse.

`collapseHeader` measures the sentinel, writes the attribute, measures again and scrolls by the
difference. **Measured at 0.00px of movement**, sampled per animation frame across the threshold
crossing so the deliberate scroll and the collapse could be told apart — anything coarser measures
both at once and proves nothing.

**THE TV IS A REAL CONTROL.** A `<button>`, in the tab order, with a gold focus ring, `aria-label`
"Collapse the banner", and a target measuring **51.0 × 53.6 CSS px at 390** and **47.0 × 49.5 at
360** — no 44px exception spent. It is an **overlay at the artwork's own percentage coordinates**,
never an edit to `BannerMobileV2.jsx`: that file is generated, and prompt 57 wrote
`build_banner_mobile.py --check` precisely so the committed JSX and the JSON can be proved identical.
A `<button>` wrapped around the `<image>` would break that check on the next regeneration.

**The affordance is the one debatable choice and is called out as such.** On a phone there is no
hover and no cursor, so a control whose only cue is `:hover` has no cue at all — and an illustration
that silently became tappable is worse than no control. It carries a **persistent 1px ring of the
gold token at 26% opacity**, strengthening to 60% on hover and 85% on press, painted on a
pseudo-element so the colour comes from `--gold` at an opacity rather than a retyped rgb (rule 16).
It is trivially removable if Joe reads it as a box around the television.

### 28b. Three vertical slider toggles, and 44px rather than 88

> *"Could these three choices be rendered as VERTICAL slider toggles? Day over Week, All Games over
> My Teams, List View over Grid View. All would render in the navbar with the selected button in
> gold."*

**The order is FIXED, not live-on-top.** "Day over Week" is an arrangement, not a sort: a control
whose two words swap places on every tap is one the eye has to re-read each time. The gold moves; the
words do not.

**ONE TAP TARGET PER CONTROL.** With exactly two states, tapping the control and tapping the inactive
label are the same action, so a second 44px target would double the bar's permanent cost to buy a
duplicate of the tap it already has.

**44px, AND JOE CHOSE IT OVER 88.** He asked whether doubling the bar would let the tagline return
under the wordmark. It fits vertically and it still could not go there: *"Every game. Every channel.
One place."* is **wider than MYSPORTS TV**, so a left column sized to the tagline would push the four
controls into less room than they have now. Two lines fit 44px comfortably — 12px type at 1.05
leading is 12.6px a line, 26.2px for the pair, leaving 8.9px of air.

**THE LABEL LENGTH WAS MEASURED, AND JOE'S WORDING LOST ON EVIDENCE.** Real font metrics, four
viewports, each column sized to the wider of its two labels:

| viewport | wordmark | `LIST VIEW`/`GRID VIEW` | `LIST`/`GRID` |
|---|---|---|---|
| 360 | 106.27 | 233.44 run / 221.73 room — **overflows by 11.71** | 221.58 / 221.73 — **+0.16** |
| 375 | 106.27 | 233.44 / 236.73 — +3.30 | 221.58 / 236.73 — +15.16 |
| 390 | 129.88 | 233.44 / 228.13 — **overflows by 5.31** | 221.58 / 228.13 — **+6.55** |
| 430 | 129.88 | 233.44 / 268.13 — +34.69 | 221.58 / 268.13 — +46.55 |

The long pair fails at 360 **and at 390, which is Joe's own device**, and fits only at 375 and 430 —
it fails at both ends of the range that matters. Shipped short.

**And the noun is less needed here than it was.** Prompt 58 dropped it from a run of four single
words on the argument that "view" was the one droppable word. As a **pair** the case is stronger:
LIST over GRID is self-evidently a choice of presentation, because those two words contrast in that
one dimension and no other.

**THE ACCESSIBLE NAMES ARE PROMPT 58'S, UNCHANGED, AND THE REASON IS THE OPPOSITE OF OBVIOUS.**

- `Time range: Day. Switch to Week` / `Time range: Week. Switch to Day`
- `Scope: All games. Switch to My teams` / `Scope: My teams. Switch to All games`
- `Presentation: List view. Switch to Grid view` / `Presentation: Grid view. Switch to List view`
  (this said "the only state this bar can be in — it does not render in grid view" until §28h lifted
  the exclusion; the toggle is two-way now)

Showing both words did not make the name redundant; it made it **carry more**. `aria-label` REPLACES
the visible text rather than adding to it, and both words are `aria-hidden`, so this sentence is the
only thing a screen reader receives — while the gold, which is what tells a sighted reader which half
is live, is not available to it at all. A name that stopped naming the live half would announce the
pair and never the answer. It is still one control, so it is still neither a radiogroup (§17's
expanded pattern) nor `aria-pressed` (§17's tile pattern).

**NO THIRD EXCEPTION TO THE 44px RULE, and the brief's suspicion of one was wrong.** It read prompt
58's note that "the four words are 148.7px" as a TARGET measurement and inferred the horizontal
minimum was not being applied. 148.7px is the **ink**. The measured targets at 360 are
**44 / 58.13 / 44 / 63.45**, `min-width: 44px` applied, run 221.58px. **§18b still holds exactly
two** exceptions: the 31px segmented toggles and the 24px ALL SPORTS bar.

### 28c. The live tile

> *"a tiny arrow gets embedded under 'All Sports' indicating that a tap will open a submenu, at that
> submenu is the league tiles. In the event the user selects a tile — that tile then takes the place
> of 'All Sports' in the navbar."*

Not a toggle — ALL plus eight leagues is nine states, and cycling them would take eight presses to
get from NFL back to NHL. A disclosure, with `aria-expanded`, `aria-controls`, and a row that is
**absent from the DOM when closed** rather than hidden (prompt 58's ruling, for focus order). It
reuses `SportFilter` with the two props prompt 58 added; picking `ALL SPORTS` in that row puts the
words back, which is the only way back and is asserted in the gate. The caret makes every column a
two-line stack, which is the other half of why it is there — without it the row would read as uneven.

**THE MARK CAP IS THE GUARD, AT 56px AND NOT 58.** This is the one column that changes shape, so it
is the one that can break the row. Measured from the art's intrinsic dimensions at a 20px mark
height: **ufc 57.5**, mlb 38.0, wwe 22.0, racing 20.0, nhl 17.6, nfl 14.6, cfp 13.8, nba 8.8 — and
**NASCAR 119.9**, reachable by a hand-typed `?sport=nascar`, which `CHIP_MARK` answers. At 58 the
widest tile came to 64.0px against ALL SPORTS's 63.45 and ran 0.4px over its box at 360. At 56 the
ceiling is 62px, **under the words it replaces**, so choosing a league can only ever make the row
narrower and the widest state the bar can ever be in is the one it renders by default. The cost is
UFC alone: 57.5px of art becomes 56, a 2.6% reduction.

**One mark table, not two.** `chipMarkUrl` is exported from `Filters.js` — the bar shows the same
tile the row does. It is deliberately **not** `config.js`'s `sportMarkUrl`, whose `SPORT_MARK` is five
leagues and returns null for racing, ufc and wwe: three of the eight.

`.chdr-choice` is retired in the same commit, with no user left in the repo, and the `SPORT_SHORT`
note it carried is corrected rather than left standing.

### 28d. MY TEAMS — R4 finally implemented in the render layer

**This is not a new ruling.** `page.js` has stated it since prompt 51: *"R4: MY TEAMS is a scope —
favourites only, chronological across every sport."* The data layer honoured the intent and the
render layer discarded it three lines later.

**Joe, 2026-09-07:** *"On the MY TEAMS page, My Teams render twice — once in what appears to be
chronological order (although WWE Raw is currently appearing ahead of the Guardians game that airs 7
hours earlier) and a second time divided by sport. This seems unnecessary and repetitive."*

**THREE MECHANISMS, AND WHAT HE CALLED A SORT FAULT WAS NOT ONE.**

1. **The duplication.** `FirstBand` and `#all-today` rendered the same handful of rows. Under ALL
   GAMES the band answers *what is on right now* on a day of eighty; under MY TEAMS the day holds
   five, the band's time-window subset is nearly the whole list, and its "See all today" escape
   points at a list identical to itself.

2. **THE APPARENT SORT FAULT IS THAT DUPLICATION, MEASURED.** On 2026-09-07 the band is TONIGHT,
   which shows the evening from the prime window onward — 8:00 PM MONDAY NIGHT RAW — while the
   1:35 PM Guardians game falls *before* the window and appears only in the list below. **Two
   correctly-ordered sections, stacked, putting a later row above an earlier one.** `byKickoff` in
   `bandstate.js` is correct and always was. Removing the duplicate removes the inversion.

3. **The banding, which is a second and independent cause.** `bands={!P.isGrid}` is true under MY
   TEAMS, and `globals.css` records that bands render in SPORTS order, not kickoff order. Measured on
   2026-09-06 under MY TEAMS: **College Football 7:30 PM printed above MLB 1:40 PM with no first band
   on the page at all.**

4. **A THIRD, REAL ORDERING DEFECT, INVISIBLE UNTIL (3) WAS FIXED.**
   `allRows = [...games, ...programRows]` is a **concatenation of two separately-ordered reads** —
   `queries.js` orders games by `canonical_kickoff_at_utc.asc` and programs by `start_at.asc`, each
   within itself. So R4's own comment — *"`allRows` arrives ordered by kickoff and splitMine keeps
   input order, so 'chronological across every sport' is free"* — was **false, twice**. On 2026-09-06
   the flat order would have been 1:40 PM, 7:30 PM, 2:30 PM, 5:00 PM, 8:00 PM. It survived because
   the bands regrouped before it reached the screen; `chronological()` ships in the same commit as
   the change that exposes it, and lives in `favorites.js` beside the claim it corrects.

**A FOURTH, WHICH JOE DID NOT REPORT.** On 2026-09-06 the first band under MY TEAMS rendered
*"Nothing loaded for this viewing day yet — the rest of the page shows what the database holds"*
above five loaded rows: `live` and `notStarted` were both empty in the LIVE branch, so the band
declared the day empty on a page that was not. It goes with the band.

**BOTH MODES, PER RULE 32.** Week mode's `bands={!P.sport}` is also true under MY TEAMS + ALL SPORTS
and had the same fault; it is now `{!P.sport && !P.isMine}`, and its `rows` — also a concatenation —
also goes through `chronological`.

**ALL GAMES IS UNTOUCHED, AND IT IS PROVEN RATHER THAN ASSERTED.** Eight ALL GAMES views were
snapshotted as rendered DOM before and after the change and are **byte-identical once the first
band's own clock (`as of 1:43 PM`) is normalised**.

**AND THAT PROOF EARNED ITS KEEP IMMEDIATELY.** A blanket `aria-label` fallback had been written into
`SportBand` for the newly-nameless flat section; the snapshot caught it changing ALL GAMES on
2026-09-13, because **the first band renders through the same flat path with `sport={P.sport}`**,
which is null under ALL SPORTS. Chromium's accessibility tree was then read rather than recalled
(rule 34): **an unnamed `<section>` is exposed as `generic`; a named one as `region`.** So the
nameless section inside `.fband` is not a broken landmark — it is not a landmark at all, which is
correct for a plain container, and naming it would have nested a redundant region inside one already
named by its `<h2>`. The fallback came out. The name is supplied by the **caller**, which is the only
place that knows the scope: **"My teams"**. Under MY TEAMS that section IS the page's list, and a
named region is the useful thing to have.

The rest of the flat path was checked for the same assumption rather than only the aria-label:
`sportMarkUrl(sport)` and the `<h2>` are both inside `showHeader`, false on every flat render;
`offServiceSummary`, `splitFavorites` and `rowClass` are per-row and sport-agnostic; and the card
choice is made per row by `isProgram`, never by the band's sport. **The aria-label was the only one.**

### 28e. Rule 23 — what the locked reference does and does not implement

`docs/design/mobile_demo.html` was read, not assumed. It implements **neither** thing this prompt
changed:

- **The page header.** Prompt 58 already recorded why, and the reason holds and is stronger here:
  the file models **no scroll behaviour at all** — each phone frame is a fixed-height mock — and a
  collapsing header is a behaviour over time, which a static mock cannot depict. That note is
  **updated in the same commit**, because it described prompt 58's bar as "the four current choices"
  and the banner as merely "scrolled away", and both are now wrong.
- **MY TEAMS.** The file has no scope toggle, no favourites and no `MY TEAMS` at all — it renders one
  ALL GAMES arrangement with a `.secthead` per day and league. A paragraph was added saying so,
  because a reader comparing its sport-headed sections against the app's single unheaded MY TEAMS
  list could otherwise file the difference as drift.

### 28f. No new working rule

Rules stop at **34**. Nothing here earns a 35th, and three near-misses are each already covered:

- the `<section>`/`region` mapping was checked against the platform rather than recalled — **rule 34
  working exactly as written**, and its first use on something other than CSS;
- the brief's "the horizontal 44px minimum probably is not applied" was an INK figure read as a
  TARGET figure — **rule 22's shape**, resolved by measuring the component rather than trusting a
  note about it;
- the false R4 comment is **rule 33** (a note asserting something exists — here, an ordering — that
  does not), and it is corrected in the same commit as the work it misled.

Two of this run's own instruments were wrong and were caught by disbelieving them, which is the same
habit prompt 59 recorded: a width probe that rewrote only LONG→SHORT and so measured the same DOM
twice once the short pair shipped, printing two identical rows as though they were a comparison; and
a source test that sliced from `.chdr-toggle` to the FIRST `</button>` in the file, which is the
wordmark's — a backwards slice that failed loudly rather than passing vacuously.

### 28g. Citations in prompt 60 that were wrong

**One, and it is the only substantive one.** The brief's stage 2 said the collapsed bar's "measured
four-control run came to 142.5px — less than four 44px targets. So the horizontal minimum probably is
not applied", and asked whether that was a third exception to record. **It is not.** The targets
measure 44 / 58.13 / 44 / 63.45 at 360 with `min-width: 44px` applied and the run is **221.58px**;
prompt 58's 148.7px is the ink of the four words. No third exception exists and none was recorded.

**And one diagnosis, which the brief itself flagged as undiagnosed.** It suggested the ordering fault
would be found in `toRows` — "if a program carries a null or differently-shaped kickoff key it will
not interleave correctly". `toRow` copies `start_at` onto `canonical_kickoff_at_utc` for every
program, so programs sort correctly and always did. The fault is one line further out, in the
concatenation at `page.js:471`.

Everything else checked out: `page.js:583`/`:598`/`:599` for `FirstBand`, `Listing` and `bands`;
`:475-479` for R4's comment; `Listing:47` for the `bands` default, `:194-226` for the two
arrangements and `:224` for the flat branch's props; `SportBand:98` for the `aria-label`.
### 28h. The grid exclusion is lifted — 2026-09-07, later the same day

**The navbar now renders in all eight views.** Prompt 58 shipped it in list view only and prompt 60
kept that; `resetHeader()` existed solely to serve it and is **deleted**, since the lift left it with
no caller in the repo. The state machine is back to exactly two transitions, collapse and expand.

**WHY: THE EXCLUSION COST MORE THAN IT BOUGHT, AND ITS COST FIRED ON EVERY USE.** Tapping GRID in
the bar sets `view=grid` with `{ scroll: false }`, so the reader deliberately does not move — but the
component then returned `null`, `resetHeader()` cleared the collapsed state, and the banner and the
control stack came back into the flow **above** the reader with no compensation. **Measured before
the lift: collapsed at scrollY 904, tapping GRID left scrollY 759 with the grid's top at −335 and the
bar gone.** That is the same failure `KEEP_SCROLL` exists to prevent — a control that deletes itself
with the tap that used it — and §28a records that exact shape as the reason the state machine is
one-way.

**THE VIEW TOGGLE HAD TO BECOME TWO-WAY IN THE SAME CHANGE**, and this is the part that would have
shipped as a lie if it had been missed. It was hardcoded `topIsOn: true` with
`setParam('view', 'grid')`, which was correct only while the bar could not appear in grid view. In
grid view that markup would paint **LIST in gold while the reader is looking at a grid**, and the tap
would set `view=grid` a second time — a control that misreports the state and then does nothing. It
now reads `!P.isGrid` and sets `null` when leaving grid, matching `ScopeViewToggles`: the default is
removed from the URL rather than written into it. §28b's "one-way door from this bar" note is retired
with it.

### WHAT THE EXCLUSION WAS HEDGING AGAINST IS REAL. IT WAS MEASURED, NOT WAVED THROUGH.

The hedge was that `.mgrid-scroll` sets `touch-action: pan-x pan-y` and `MobileGrid` binds
`touchstart`/`touchmove`/`touchend` to it for a two-finger pinch, so a fixed bar over the top of that
scroller would take touches there. It had never been tried. It is true, and the mechanism is plain:
`.chdr` is a **sibling of `.shell`**, not an ancestor of the scroller, so a touch landing on the bar
targets the bar and its events never reach the scroller's listeners at all.

Measured at 390 in grid view with **real touch input** (CDP `Input.dispatchTouchEvent`, so the events
go through the hit test rather than being aimed at an element by script):

| test | result |
|---|---|
| bar over `.mgrid-scroll` | **45px of overlap** — the bar's whole height |
| pinch with **both fingers in the band** | **no zoom** — scrollWidth 1273 → 1273 |
| the same pinch **60px lower** | zooms normally — 1273 → 799 |
| one-finger pan **in the band** | **no pan** — scrollLeft 0 → 0 |
| the same pan **60px lower** | pans normally — 0 → 175 |
| pinch with **one finger in the band, one below** | **no zoom** |

**The mixed case is the one that matters and is worse than the hedge predicted.** A natural pinch
with one thumb near the top edge fails entirely: the first touch point targets the bar, so the
scroller's `touchstart` sees a single finger and never arms `pinch.current`.

**As a share of the visible scroller:** 8.3% in day mode with CFB, 9.0% with ALL SPORTS, and — the
case prompt 58's brief specifically worried about — **26.4% in week mode**, where a stacked day-grid
partly scrolled off has only 171px on screen and 45 of them are under the bar. That share is
transient: it falls to 0 as the reader scrolls that day's grid into full view.

**TWO THINGS MAKE IT ACCEPTABLE, AND BOTH ARE MEASURED RATHER THAN ASSUMED.**

1. **The band is INERT, not hazardous.** A drag beginning on any of the five controls — the wordmark
   and all four columns — changes nothing: no URL change, no header change, no scroll change. A drag
   cancels the click, so a reader trying to pan the grid near the top edge does not accidentally
   expand the header or flip a toggle. Only a deliberate tap acts, which is the control working.
2. **The gesture is recoverable by moving a few pixels.** The same pinch 60px lower works normally.

**THE RULING: ACCEPT IT, AND RECORD THE NUMBER SO IT CANNOT GROW QUIETLY.** A dead band that costs a
reader one repositioned thumb, on the minority of gestures that begin within 45px of the top edge, is
a smaller harm than a control that displaces the page by 340px every single time it is used. Both
figures are in the qa-shots gate: the overlap, the failed pinch, the working pinch 60px lower, and
the inertness of a drag on a control.

**IF THE BAND IS EVER WANTED BACK**, the fix is named rather than left to be rediscovered: bind the
pinch handler at the DOCUMENT level and gate it on whether the gesture's midpoint lies over a
`.mgrid-scroll`, instead of binding it to the scroller. That is a change to `MobileGrid`'s touch
handling and was deliberately out of scope here.

**AND THE `SPORT_SHORT` NOTE IN `CollapsedHeader.js` SAID 58px.** The cap has been 56 since §28c
tightened it; the note is corrected in the same commit as this work (rule 30's second half).

---

## 29. THE PRO GRID COLOURS ARE A TABLE — 2026-09-08, prompt 65

Joe judged all 124 pro-league grid blocks by eye at grid scale on 2026-09-08, choosing the band and
the ink for each. `data/grid_colors_pro.json` holds them; `bandFor()` consults it first and falls
through to its own rule for any team not listed.

**WHY A TABLE AND NOT A RULE.** Four candidate rules were tested against the 124 judgements. None
fits, and the best one still needs 41 overrides:

| rule | agrees with Joe |
|---|---|
| today's — the lighter of the two colours paints | 38 / 124 |
| the darker paints, the lighter inks | 68 / 124 |
| the darker paints, best available ink | 68 / 124 |
| the primary always paints | 83 / 124 |

A rule plus 41 exceptions is bigger than the table and pretends to a generality it does not have.

**THE OPEN QUESTION, RECORDED RATHER THAN ACTED ON.** `bandFor()`'s rule agrees with Joe's taste on
**38 of 124 pro teams — 31%.** "The primary always paints" would agree on 67%. Every one of the 684
college teams still runs on the 31% rule, because nobody has judged a college block and a rule
nobody has checked is not improved by swapping it for another nobody has checked. What this says is
narrower than "the rule is wrong": it says the rule has never been measured against taste on the
teams it still governs. **Do not change the college default without judgements to check it against.**

**ELEVEN OF THE 124 MEASURE UNDER 3:1**, which is `BAND_MIN_RATIO`, the AA floor for large text that
`gridmodel.js` names. Joe chose each with the measured ratio on screen beside it, and they ship as
chosen — verified independently in this run against `contrastRatio()`, all eleven agreeing to the
hundredth: Buccaneers 1.82, Lions 2.56, Chargers 2.65, 49ers 2.82, Falcons 2.82, Timberwolves 2.87,
Blue Jackets 2.87, Panthers 2.92, Islanders 2.92, Guardians 2.97, Blues 2.98. `gridcolors.test.mjs`
pins all eleven BELOW the threshold on purpose: a later change that "rescued" them would be
overriding a judgement, and would look like an improvement while doing it.

**THE TRAP THIS RUN NEARLY SHIPPED.** `bandFor().ink` is never painted. `MobileGrid.js:585` re-derives
the ink through `inkFor()` for whichever surface the team's cap gave it, so teaching `bandFor()` the
table alone would have shipped Joe's 124 BANDS while silently recomputing his INKS from the raw team
colours — half a ruling, with nothing failing to say so. The renderer takes the ruled ink directly and
`inkFor()` still answers for every unruled team.

**COUNT CORRECTED.** The file's `counts.differ_from_shipped` said 109. Measured against the live team
table, **86** of the 124 differ from what shipped — which is what the 38/124 agreement figure in the
same file implies (124 − 38 = 86). The count was corrected in the same commit as the work.

**STILL OPEN, AND MEASURED: 42 OF THE 124 GET A TINTED CAP.** `capFor()` gives 42 of these teams
`tint: 0.72`, so what is painted is `tint(band, 0.72)` and NOT the band Joe chose — his ink lands
exactly, his band lands darkened. Verified in the DOM on 2026-09-08: the Guardians (flat) render
`rgb(227, 25, 55)` / `rgb(0, 43, 92)`, his values to the byte, while the Brewers (tinted) render
`rgb(19, 35, 60)` where his band is `#13294b` = `rgb(19, 41, 75)`.

The tint moves the ratio he was shown. Over the 42 it raises it on 26 and lowers it on 16, and **four
teams he chose ABOVE 3:1 are painted below it** — Bulls 3.78 → 2.51, Phillies 4.11 → 2.61, Raptors
4.12 → 2.68, Thunder 4.76 → 2.98 — while the Lions go 2.56 → **1.46**, the worst block in the app.

**CLOSED BY PROMPT 66 — a ruled team's cap is untinted.** `capFor()` now returns `tint: 1` for any
team in the colour table, so the surface IS the band Joe chose. Measured in the DOM on 2026-09-08
across five days and 44 name rows: every one paints a chosen band exactly, over 40 distinct ruled
teams. The Lions go **1.46 → 2.56**, and Bulls, Phillies, Raptors and Thunder are back above 3:1.

**The other option in this section was impossible, and that is why this one shipped.** Recording a
PRE-TINT value that comes out as the colour he picked cannot work: `tint(c, f)` computes
`c*f + 255*(1-f)*0.08`, so at `f = 0.72` it maps 0–255 onto **5.712–189.312**, and **33 of the 124
ruled bands have a channel above that ceiling** — the Browns' `#ff3c00`, the Flyers' `#fe5823`, the
Warriors' `#fdb927`. A quarter of the table is not an output of that function at any input. The
usual objection to mixing cap levels does not apply here: a grid renders one sport, every pro team
is ruled and no college team is, so no view mixes a tinted cap with an untinted one.

**26 teams gave a ratio back, and that is the point rather than a cost.** The tint had been
flattering them — Colts 13.31 → 11.16, Chiefs 6.58 → 4.21, Brewers 10.09 → 9.30 — and what they now
show is the number Joe chose with it in front of him. Two of the 26 drop under 3:1, the Chargers
(4.08 → 2.65) and the Blue Jackets (3.21 → 2.87), and BOTH were already among his deliberate eleven.
After the change exactly eleven blocks measure under 3:1, and they are his eleven: the app now shows
the ratios he picked, no more and no fewer.

**THE LOOSE END, NOW MEASURED (prompt 67 stage 4b — evidence only, nothing changed).** `cap.art` is
still as the cap table left it, and 16 of the 42 carry `art: 'dark'`, chosen because the dark lockup
read better on the TINTED surface that has gone away under them. Measured with the builder's own
`edge_crisp` (`scripts/build_cap_table.py:152` — share of silhouette pixels at ≥1.5:1 luminance
against the surface, at 138px, which is 46 CSS px at DPR 3), against the band as it NOW paints:

**Only ONE of the 16 was made wrong: the Philadelphia 76ers**, raw **0.599** against dark **0.005**
on `#e01234`. Its dark lockup all but vanishes on the flat band. `art: 'dark'` would need flipping to
`'raw'` — a one-row change to `web/lib/cap-table.json` — and it is Joe's to make.

**Twelve of the other fifteen cannot be wrong, for a reason worth writing down.** Their `_dark.png`
is a BYTE COPY of the raw file, because prompts 64 and 66 put them in `logo_conditioning.json`'s
`skip_derive` list — Joe judged the raw art better on charcoal. So `art: 'dark'` and `art: 'raw'`
select the same pixels and the distinction has quietly stopped existing for them. Two more (Houston
Rockets, and the Athletics-style ties) score identically on both files. Only the Rangers (+0.166) and
the Raptors (+0.308) still earn `dark` by the builder's own >0.05 margin.

**AND THE WIDER FINDING NOBODY ASKED FOR, which matters more than the sixteen.** The builder chooses
`tint: 1` only when the better art reaches `edge_crisp >= 0.85` on the flat band — that threshold IS
what the tint existed to rescue. Prompt 66 gave all 42 ruled teams `tint: 1` without consulting it,
and **19 of the 42 fall below it on their new flat band**: Giants **0.000**, Orioles **0.000**,
Phillies **0.000**, Utah Mammoth 0.092, Lions 0.222, Raptors 0.308, Marlins 0.357, then a tail from
0.535 to 0.741. A 0.000 means the logo's silhouette carries essentially no luminance contrast against
the band it now sits on — it is the shape disappearing into its own colour.

**This is a flag, not a verdict.** `edge_crisp` scores the LOGO against the CAP surface; Joe judged
the band and the ink at grid scale, which is a different question, and his eye is the authority on
his own grid. But nineteen blocks whose endcap art the measurement says has stopped reading is worth
his look before it is called finished — and the fix, if he wants one, is per-team `tint: 0.72` back,
which trades his exact band for a legible logo on those teams only.

---

## 30. TWO PROBES ARE TRACKED AND EIGHTY-ONE ARE NOT — 2026-09-08, prompt 70

`web/scripts/probes/` holds `s0-gaps.mjs`, `s3-spacing.mjs` and the `landmark.mjs` guard they share.
`web/qa/tools/` holds 81 more and stays gitignored. **Two tracked files among eighty-three needs a
stated reason or the next reader reads it as an accident**, so here it is.

**THE DIRECTORY OUTGREW THE RULE THAT IGNORES IT.** `.gitignore` files `web/qa/` under *"generated
validation/rendering artifacts (regenerable)"*, and `docs/prompts/43-night-run.md:16` records what
that meant when it was written: `web/qa/` was *"qa-shots output — 25 files at the time of writing"*.
True then. The hand-written measurement tools arrived afterwards, and they are neither generated nor
regenerable — nobody can re-derive them from anything.

**THE PRECEDENT WAS ALREADY SET AND ALREADY USED.** §: `geometry.mjs` lives at
`web/scripts/geometry.mjs` **"rather than `qa/tools/` because `web/qa/` is gitignored"**, and the
reason given there was that a check meant to replace the tripwire discipline cannot live somewhere a
clone does not have. That is the same argument, one rung down.

**WHY THESE TWO.** They are the two prompt 69 ran, and the two it fixed: both opened with
`querySelector('.fband') || querySelector('.today-split')`, and `.fband` was deleted with the TONIGHT
band in prompt 67. For two prompts the leading selector matched nothing, the `||` swallowed it, and
both probes went on reporting a "picker to content" gap. **They were right by luck** — `.today-split`
is the element that measurement wanted anyway — but nothing in the run could distinguish a correct
fallback from a silent one, and the fixes could not be committed because the files were untracked.

**WHY NOT THE OTHER 81.** A filename search across prompts 55–60, `handoff-status.md`, this register
and both contracts names none of them; the only doc that names probes is the prompt-50-era
`docs/hub/` audit. **That search is a floor and not a ceiling, and prompt 70's brief said so
plainly**: searching docs for `.mjs` names finds probes that got WRITTEN ABOUT, not probes that got
RUN, and a probe invoked mid-run appears in that run's transcript and nowhere else. So the 81 are not
proven dead — they are unproven either way, and the honest position is that the two with a
demonstrated defect were promoted and the rest wait for evidence. **Promote another the day a run
leans on it, not before, and not in a batch.**

**WHAT PROMOTION COST THEM, which is the part worth copying.** Both were hardcoded to
`http://localhost:3100`, a port nothing in this repo starts — so neither could be run from a clone
without editing it first. Being untracked hid a second failure: the file was missing AND the file
that existed did not run. They now take a base argument defaulting to 3000, which is what
`npm run dev` serves.

**THE GUARD.** `landmark.mjs` exports one definition, injected into the page with `addInitScript`
because the lookups happen inside `page.evaluate()` and a module imported on the Node side is not in
that realm. `window.__landmark(sel)` throws naming the selector; `window.__optional(sel)` is the
explicit opt-out for things that may legitimately be absent. Verified firing: `.pickrow` resolves,
`.fband` throws *"probe landmark not found: .fband"*, `__optional('.fband')` returns null, and the
guard survives a navigation. **A probe that keeps producing numbers after its landmark disappears is
worse than one that stops**, because the answer still looks like a measurement and gets quoted.

**THE ORIGINALS WERE DELETED, not left behind.** Two copies of a measurement tool drift, and the
untracked one drifts invisibly, which is the whole defect. `web/qa/tools/` went 83 → 81.

---

## 31. THE SCORE POLLS ITSELF, AND THE WEEK CHECKS LIVE AGAIN — 2026-09-09, prompt 77

**§31a — `router.refresh()` IS RETIRED. Joe's ruling, 2026-09-09.**

`components/Listing.js` refreshed the ROUTE every `REFRESH_SECONDS` while anything was in flight — a
full server re-render, every query, the standings, the rankings, the programs, the header and the
banner, to update three fields on a handful of cards. It is now a client fetch of the live overlay
alone (`GET /api/live?day=…`), patched into the cards already on screen.

**THE STALENESS WAS ENTIRELY THE CLIENT'S, and that is what settled the interval.**
`lib/livescores.js` caches every upstream fetch for 60 seconds, so the server's answer was never more
than a minute old while the phone waited fifteen. **60 seconds, because it IS the cache**: every
fetch crosses a cache boundary and returns genuinely new data, and none is wasted. Going below it
buys nothing without shortening `REVALIDATE_SECONDS` too, which means more calls out to ESPN, the NHL
and MLB — and livescores.js records one of those 403ing an honest bot on 2026-09-03. The two numbers
are a pair; `web/test/livepoll.test.mjs` asserts they are EQUAL rather than asserting each is 60,
because two separate assertions would let them drift apart while both passed.

**THE GATE IS UNCHANGED**: nothing in flight, no interval at all. What is new is that a backgrounded
app stops polling — iOS keeps the document alive across a backgrounding, so without it a phone in a
pocket polls all day.

**THE HAZARD, AND IT IS THE REASON THIS NEEDED MEASURING RATHER THAN REASONING (rule 34).** Prompt 73
pins the banner on mount and on navigation; prompt 71 lands the page on today when the path or query
changes. Both live in `AutoScroll`, keyed on `${pathname}?${params}`. A `router.refresh()` every sixty
seconds under those two is a banner that re-pins and a page that re-scrolls every minute — unusable.
Setting client state changes neither the pathname nor the query, so neither effect re-runs.
**Measured over a full cycle with a fake clock and a stubbed live score**: three cards went live while
scrollY held at 201 across 243 sampled frames, `data-pin` never changed, no navigation, no card
churn. `web/scripts/probes/live-poll.mjs` is that measurement, tracked.

**THE PROP IS SHADOWED, and it is why the change is small.** `Listing` takes `games: serverGames` and
recomputes `games` as `applyOverlay(serverGames, liveMap)`, so its eight downstream readers are
patched by construction rather than by eight renames a ninth reader could later be added beside.

**§31b — PROMPT 53 STAGE 4b IS REVERSED: the WEEK checks live scores.** Joe's ruling, 2026-09-09,
after asking whether week mode would slow the app.

**The recorded reason for switching it off described an implementation nobody had to write.**
`app/page.js` said *"`overlayForDay` is a per-day fetch and a week is up to ten days, so running it
here would be up to ten live calls on one render."* But only TODAY's games can be live — every
earlier day is final and every later one has not started — so a week needs exactly ONE overlay, for
today, which is the same call day mode already makes.

**CONFIRMED BY READING BEFORE IT WAS RELIED ON**, which the brief asked for and which changed one
detail: `sportsWorthFetching` returns `[]` unless `day === today` (`livescores.js:202`) and
`overlayForDay` makes no upstream call when that list is empty — so a week without today was never
going to cost ten calls. But it collects every sport with a NON-FINAL row from the games it is
handed, and it does **not** skip `scheduled` — so handing it the whole week would fetch NHL because a
scheduled game sits on Friday, with no NHL game on today at all. It is therefore handed
`grouped[today]`, not `rows`, which makes the call byte-for-byte day mode's.

**THE FOOTNOTE CHANGED IN THE SAME COMMIT.** It read *"no live check — a week view does not check
live scores, so today's are the database's"*, and **a page that says it is not checking while it is
checking is worse than one that never checked.** A week containing today now prints the same
"live scores checked HH:MM, N games updated" day mode does; a week without today prints
*"no live check — this week does not contain today"*.

**THE GRID IS OUT OF SCOPE and stays so** — it displays no score today, and adding one is a different
feature.

---

## 32. THE FLOAT GOES AND THE CARD CARRIES THE MARK — 2026-09-09, prompt 82 block D2

**THIS SUPERSEDES §27a (prompt 59) AND D6 (prompt 20) BEFORE IT.** Both are recorded rather than
quietly replaced, because the same ground has now been walked three times and the reason it moved
each time is different.

| prompt | what favourites got | why it changed |
|---|---|---|
| 20 (D6) | floated to the top of their band under a faint `YOUR TEAMS` micro-label | — |
| 27 | that label became the FIRST HEADING on the page | Joe: *"renders in small gray text like an afterthought"* |
| 59 (§27a) | `.favlabel` + `.favrule` retired; a gold left-rule BRACKET around the floated group | the label was `.band-title` character for character and the rule was imperceptible |
| **82 (this)** | **the float retired; a gold BORDER on the card** | **the order now carries meaning** |

**WHAT CHANGED IS THE ORDER, NOT THE TASTE, and that is the whole justification.** Joe's ruling of
2026-09-09 — *"Organize qualifying events by TIME… THEN when events start at the same time,
prioritize by: Pregame shows, MyTeams, Other events"* — was implemented in `chronological()` at
prompt 80 (`4e495b8`). `app/page.js` sorts every row through it, and `SportBand` then **split that
correctly ordered list and rendered one group above the other**. The page sorted and the band
un-sorted it. A group floating to the top of a list sorted by the clock contradicts the sort, so the
HOIST is what was wrong; the gesture is fine and survives on the card.

**THE MARK IS A RECOLOURED BORDER AND NOT AN `outline`, WHICH IS WHAT JOE ASKED FOR BY NAME.** His
words were *"make the gold line a gold OUTLINE of the card"*. The meaning is right and the CSS
property is taken: `button.mcard:focus-visible` is `outline: 2px solid var(--gold)` with
`outline-offset: 2px`. **A favourite drawn with `outline` would be the focus ring character for
character** — every favourite card would look permanently focused and a keyboard or switch user
would lose their position on exactly the cards Joe cares about most. `.mcard` already carries
`border: 1px solid var(--line-soft)` with `border-radius: var(--radius)`, so recolouring costs
nothing and follows the radius for free.

**MEASURED, NOT ASSERTED (rule 34).** `qa-shots` reads the body track off a marked and an unmarked
card in the same band: **114px against 114px.** That is the number the retired bracket could not
achieve — prompt 59 measured its 11px inset dropping **10 of 26** name tiers, because `.mcard`'s body
track is `minmax(0, 1fr)` and an inset comes out of what `fitNameAndRecord` has for a name and a
record. **That table is kept in `globals.css` beside the new rule**, because it is the reason for the
shape and deleting a measurement when the element it measured changes is how evidence gets lost.

**THE 2px ESCALATION WAS MEASURED AND DECLINED. Joe ruled 1px on 2026-09-09**, and the reason is
recorded here because the next reader will otherwise assume it was chosen for subtlety:

> **The weights are what make the two tellable apart.** The focus ring is 2px standing off at
> `outline-offset: 2px`; the mark is 1px hugging the card edge. At 2px they become two gold lines of
> EQUAL weight separated only by a gap, which reads as one thick double rule rather than as "focused"
> and "yours". `mobile__favourite-focus-vs-mark.png` is the shot that settles it. The card's leading
> edge already carries the team-colour seam and a gold time label, so the heavier frame also starts
> competing with the content it frames.

The escalation stays a one-line change if it is ever wanted — `box-shadow: 0 0 0 1px var(--gold)`,
which also costs no layout — but **it is not left in the tree as a commented-out alternative.** A
rejected option belongs in the record, not in the stylesheet.

**AND THE MARK SURVIVES THE OFF-SERVICE DIM, MEASURED IN PAINTED PIXELS (prompt 83).** This is the
one combination where it could have vanished: `.offsvc-row` is `opacity: .45; filter: saturate(.7)`,
and BOTH ARE COMPOSITING EFFECTS — a dimmed favourite still reports `border-color: var(--gold)` from
`getComputedStyle`, so the DOM test that proved the classes compose proved nothing about whether a
reader can see it. Rule 13: measured against the local background, with Pillow, on the real case
(Fresno State, 2026-09-12 — one of the six CFB favourites, off-service that day):

| row | painted border | local card ground | max delta |
|---|---|---|---|
| favourite + off-service | rgb(103, 96, 79) | rgb(36, 37, 39) | **67** |
| favourite, undimmed | rgb(198, 175, 122) | rgb(42, 46, 52) | 156 |
| unmarked card | rgb(39, 39, 39) | rgb(42, 46, 52) | 13 |

67 is `156 × 0.45`, exactly what the dim predicts, and it is still **five times the contrast of the
ordinary border it replaces**. It survives legibly and 1px ships unchanged. **The distinction that
cost this a correction is worth keeping: "the classes compose" and "the reader can see it" are
different claims, and only the second needs a rendered shot with a measured delta.**

**IT COMPOSES, and that is new.** The other three row-wrapper classes are mutually exclusive by
`offServiceSummary`'s own if/else; `fav-row` is orthogonal — an off-service game can be a favourite —
so the dim and the gold border both show. Pinned by a test, because "one silently wins" is the
failure this shape invites.

**MY TEAMS SUPPRESSES IT**, on the same `!P.isMine` the float used, so there is one vocabulary rather
than two. Every row there is a favourite, so a border on all of them distinguishes nothing.

**DEAD CODE WENT WITH THE FEATURE**, as prompt 67 did with `FirstBand` and `bandstate.js`:
`splitFavorites`, the `.favgroup` rule, and the `floatFavorites` prop through `page.js` → `Listing` →
`SportBand`. **The tests were INVERTED, not deleted** — `pageorder.test.mjs`'s *"a favourite is
counted in YOUR TEAMS and NOT again in its sport band"* is now *"a favourite STAYS in its sport
band"*, so a float coming back fails a gate. `favoriteIds` and `isFavorite` both stay; the mark is
computed from exactly the second one.

---

## 33. THE ICON IS v8, THE SET IS OFF, AND THE GLOW STOPS AT ZERO — 2026-09-09, prompt 81 block E

**§33a — icon v8 replaces v7 at all five sizes.** `assets/brand/icon-v8/` already held every
destination at exactly the size it had to be — 1024, 512, 192, 180, 48, all RGB — so nothing was
resized and nothing should be. Each destination's pixel size was re-measured before it was
overwritten, because a silent downscale is the one mistake here that ships a degraded icon and looks
like nothing at all. v7 was retired to `app-icon-mysports-tv-v7-retired.png` beside the existing
`-v5-retired` and `-v6A-rejected`, with a plain `mv`: **`assets/` is untracked in its entirety**, and
`git mv` on an untracked path is a fatal error rather than a warning.

`web/app/manifest.js` was read and left alone — its two entries already name `/icon-192.png` and
`/icon-512.png` at the sizes those files still are.

**JOE'S PHONE MAY SHOW v7 AFTER A GREEN DEPLOY, AND THAT IS NOT A FAILURE.** An installed PWA caches
its icon, and the asset-version token that fixed the logo cache does not reach these files at all —
`web/public/icon-*.png` and `web/app/icon.png` are named by the manifest and by iOS, not built by
`config.js`. This session has already spent three false bug reports on exactly that confusion.

**§33b — the television is the blacked-out cutout.** `tv.file` in both JSONs is now
`tv-cutout-dark.png`, and **no coordinate moved**, which is provable rather than assumed: the two
files are both 1110×1167 RGBA and their **alpha channels are byte-identical**
(`ImageChops.difference(...).getbbox()` is `None`), so the silhouette every `x`/`y`/`w`/`h` was fitted
to is unchanged. The RGB difference is confined to `(107, 411)–(722, 911)`, which is the screen going
black and nothing else. **The alpha bounding box alone would have proved nothing** — both images are
opaque to all four edges, so that test returns the full frame either way.

`web/public/banner/tv-cutout.png` stays tracked and becomes unreferenced. That is the way back if Joe
wants the lit screen.

**§33c — the title halo is dark, matching the icon.** Both banners painted a **gold** glow behind
gold type, which reads as a wash rather than as separation; the app icon has always used a dark
two-pass halo. The glow is replaced by a wide pass at `0.306 × cap height` with an `feFuncA` slope of
1.9 and a tight pass at `0.097 × cap height` at slope 2.7, over a `#000000` copy of the wordmark —
7.9/2.5 on the phone (cap 25.92), 12.1/3.8 on the desktop (cap 39.6).

**THE RADII ARE RATIOS OF CAP HEIGHT, NOT OF FONT SIZE**, which is what keeps the two breakpoints the
same halo at two sizes. Both the ratio and the product live in the JSON so the generator computes
neither, and a test checks the arithmetic rather than trusting two copies of one fact.

**THE JSON's OWN PARAMETERS MOVED WITH IT, and the prompt only asked for the prose.** `title.glow`
held `{fill: #C6AF7A, blur_std_dev: 10, opacity: .55}` and the generator read all three. Leaving a key
named `glow` holding the gold glow's numbers, beside a generator that emits a black halo, is the same
defect the prompt correctly catches in `filters.title_glow`'s description — one layer down, in the
data. It is `title.halo` now, and `filters.title_glow` is `filters.title_halo`.

**§33d — the glow tails re-taper to zero, reversing prompt 45.** The two warm radial glows ended at
alpha 0.021 and 0.028 rather than 0, so the fill stopped abruptly at the ellipse boundary and
`overflow: visible` exposed the step in the band. Removing it is worth having and the change stands.

> **THIS WAS NOT THE OUTLINE JOE REPORTED, and §34g is the correction.** He said *"a faint rounded
> outline around the TV"*, this block read that as the glow tails, and the two are different objects
> 98px apart. What he saw is `.bn-tvtap::after`, the television button's resting affordance from
> prompt 60. **It is still on screen and it is deliberately still on screen** — Joe's ruling,
> 2026-09-09. Read §33d as "a real artifact was removed", never as "the reported artifact was fixed".

Prompt 45 kept those tails deliberately, and this is **Joe overriding a recorded ruling in
conversation, not a re-raise of one** (rule 10, checked). What shipped is neither of the two options
prompt 45 weighed: a stop at **95% sitting exactly on the existing 82→100 line**, then zero at 100%,
so every existing stop is untouched and only the last 5% of each radius moves.

| gradient | stops |
|---|---|
| `bnGlow0` / `bdGlow0` | 0% → 0.32, 45.3% → 0.176, 82% → 0.058, **95% → 0.0313**, **100% → 0** |
| `bnGlow1` / `bdGlow1` | 0% → 0.42, 45.3% → 0.231, 82% → 0.076, **95% → 0.0413**, **100% → 0** |

Measured at the mobile breakpoint, rgb(255,170,60) over the stage ground: the edge removed is a step
of **3.0/255** (outer) and **4.1/255** (inner); the re-taper repaints **3.16%** of the visible stage
by at most **3.53/255**. Zeroing the tails outright would have repainted **11.38%** — which
reproduces prompt 45's recorded 10.6% — and that is why the re-taper was chosen over it.

**§33e — three stale notes were corrected in the same commit as the work that stranded them**
(rule 30, and rule 33's shape). The generator's header paragraph said `THE GLOWS' OUTER STOPS ARE LEFT
AS DESIGNED`, and it is **generated output** — it is emitted into `BannerMobileV2.jsx`, so `--check`
round-trips it and leaving it would have shipped a paragraph asserting the opposite of what the
generator had just produced. `banner-mobile-v2.json`'s `headroom_paint.unchanged` pointed the reader
at that same paragraph "for why their outer stops keep their tails".

**The third is the one that cost this block real time.** `BannerDesktopV2.jsx` opened with *"Generated
2026-09-04 from banner-desktop-v2.json"* and *"regenerate from the JSON if the design changes"*, and
**there is no desktop generator** — `scripts/` holds `build_banner_mobile.py` and nothing else. So
E5's step 4 is a hand-edit of a file whose header forbids hand-edits, which is rule 33 verbatim, and
`Banner.js` said the same thing in the plural about both components. Both now say what is true, and
`tests/test_banner_generator.py` grew a **`TheDesktopBannerIsTranscribed`** class so the desktop file
has a guard at all: it pins every value transcribed out of the JSON — the cutout filename, both stop
lists, the whole halo filter, the halo fill — and **deliberately does not pin the 23 mark
coordinates**, which came out of prompt 42 and which no prompt since has had a reason to move. The
byte-for-byte class above it can only exist because a program writes the file it checks; this one
exists because nothing does.

**§33f — and the block lost a gate run to rule 12, through a door nobody knew was there.** After the
icons went in, `qa-shots` died on `locator('.mrail-cell')` with a 30-second timeout — the exact
signature of an app fault, arriving one step after five tracked binaries changed. It was neither.

`/?day=2026-09-03&sport=mlb&view=grid` was returning **500**, and so was every other route:

```
ModuleParseError: Module parse failed: Unexpected token (11:73)
  * next-metadata-route-loader
> throw new Error('Default export is missing in "C:\Users\jlull\Joe's Projects\...\app\manifest.js"')
```

That is **rule 12's apostrophe**, in `next dev` rather than in `next build`. The loader wraps the
absolute path in a **single-quoted** string and `Joe's` closes it, so `app/manifest.js`'s generated
module can never parse in this repo. It is not compiled until something requests
`/manifest.webmanifest` — **and the request that did it was mine**, a curl checking the manifest a
few minutes earlier. Once it fails, the failure is cached in the module graph and every page 500s,
because the manifest `<link>` is part of the document.

**TWO THINGS THIS IS NOT.** It is not the icon swap: after killing the server by path, removing
`web/.next` and restarting, both `/` and the grid route serve 200 **with v8 in place**. And it does
not reach production: Vercel builds at `/vercel/path0`, which has no apostrophe.

**THE PART WORTH KEEPING is how nearly it was misread.** The first run of this gate was piped through
`tail -4`, so `[exited with code 0]` was **`tail`'s** exit code and the `TimeoutError` scrolled past in
four lines that looked like noise — rule 26's trap, in a gate, in a block that had already run four
clean ones. Rule 12 now names the route, and no gate in this block was read through a pipe again.

---

## 34. THE BANNER HAD FIVE GREEN GATES AND NOTHING WATCHING THE PAGE — 2026-09-09, prompt 84

**§34a — the render was not stale, and the comparison that said so was reading the wrong file.**
Cowork found `web/qa/p83final/mobile__today-all.png` byte-identical to `web/qa/p83/…` (sha256
`df1656e4f93d77b5`) and read it as Block E's gate run having photographed the old banner. The
mtimes say otherwise: `p83final` was written **19:38:58** and the first banner source edit landed
**19:54:38**. `p83final` is block **D2**'s run. It is identical to `p83` because at that moment the
banner genuinely had not been touched — the correct result, filed under a misleading name.

The live artifact from the 20:20 post-clear run tells the real story, and it is measured rather than
eyeballed:

| | p83 / p83final | `web/qa/` (20:20) |
|---|---|---|
| TV screen, mean | rgb(127, 113, 116) | **rgb(30, 30, 35)** |
| per-pixel channel spread | **103.0** — a colour test pattern | **5.7** — black |
| whole-image diff vs p83 | — | `(0, 0, 771, 246)`, the banner band and nothing else |

**THE NAMING IS THE DEFECT WORTH FIXING**, not the analysis: a directory called `p83final` that
holds a mid-prompt run invites exactly this. Snapshot directories are named for the BLOCK from now
on, not the prompt.

**§34b — and the criticism underneath it was right, which is the part that mattered.** Block E
changed the banner three ways and every guard it shipped with was in
`tests/test_banner_generator.py`: **Python, reading JSX as text.** That is rule 24 verbatim — a fact
established on the Python side is no evidence the JS runtime agrees. Five gates went green,
`qa-shots` among them at 96/96, and not one assertion anywhere touched the served page. Had the
bundle genuinely been stale, nothing in this repo would have said so.

`web/scripts/lib/bannerdom.mjs` now reads the three facts out of the live document — the `<image
href>`, the halo text's fill and filter, and every stop of both glow gradients — and `qa-shots`
asserts them **at both breakpoints**, 96 → 108. Both halves matter: `Banner.js` mounts both
components at once and CSS chooses which paints, so a fault in the hand-transcribed desktop file is
invisible from a phone.

**§34c — the assertions were then broken on purpose, because an unbroken assertion is a claim.**
`web/scripts/probes/banner-mutation.mjs` reverts one fact at a time in the component source, waits
for the dev server to actually serve the reverted markup, and requires the matching check to go red
**and every other check to stay green** — collateral is reported, because a mutation that reddens
four checks is an alarm rather than a guard. All six caught, no collateral, both files byte-restored.
The probe and the gate import the SAME predicates; a probe with its own copy of the checks proves its
copy works and nothing about the gate.

The six Python tests prompt 83 added were never mutation-checked either, and prompt 83 had asked for
it. Seven mutations, all seven caught, including the rule-32 pair — the same "no desktop generator"
ruling in `BannerDesktopV2.jsx` and in `Banner.js`.

**§34d — the byte-comparison guard was considered and deliberately NOT put in the gate.** "Fail if
`mobile__today-all.png` comes back byte-identical to a frozen reference" would have flagged this,
and it is the wrong instrument. That shot is a full page of live scores, records and rankings: it
differs from any frozen reference on nearly every run, for reasons that have nothing to do with the
banner, so it would pass for the wrong reason approximately always and could never distinguish "the
banner changed" from "a score changed". This repo has already ruled against that shape once — the
geometry section's whole argument is that a tripwire which fires on standings drift gets ignored, and
prompt 74 then lost a real regression into exactly that bucket. It was run **once, as a check**: the
current shot differs from p83 and the difference is confined to the banner band. The DOM assertions
are the layer that belongs in the gate, and they are now mutation-proven.

**§34e — `qa-shots` could not fail its own exit code, which is how prompt 83's pipe hid a crash.**
The runner ended in `process.exit(0)` unconditionally: failures went to `assertions.json` and a
`FAILURES - n/m` line on stdout, and nothing else. So the printed line was the only signal, and when
it was read through `| tail -4` the status reported was **`tail`'s** — 0 — over a node process that
had died on a `TimeoutError`. Rule 26 says the exit code *and* the parsed counts decide; this gate
had no exit code to offer. It is now `process.exit(failed === 0 ? 0 : 1)`.

**§34f — what Joe is being asked to look at.** Block E is entirely visual and nobody had seen it.
`web/qa/banner-e/` holds the banner and the wordmark at both breakpoints, plus a 6× before/after of
the ellipse boundary. The re-taper is a 3.53/255 change and that is easy to claim, so it is measured
at the boundary rather than described: the step across the outer ellipse's edge goes **+1.96 → −1.00**
and the inner **+2.84 → −0.23**. In both cases a discontinuity is replaced by the gradient's own
continuous slope, which is precisely what "the ring is gone" has to mean.

**§34g — AND RENDERING IT FOUND THE THING E4 WAS SUPPOSED TO FIX, STILL THERE.** This is the whole
argument for looking at a visual change rather than asserting it, so it is recorded even though it
makes the block's headline finding smaller.

Joe's words were *"a faint rounded outline around the TV."* Cowork diagnosed that as the two warm
ellipses' hard outer stops, Joe ruled for the re-taper, and E4 shipped it. **The re-taper is real and
measured** — the discontinuity at the outer ellipse boundary goes +1.96 → −1.00 and at the inner
+2.84 → −0.23, in both cases replaced by the gradient's own continuous slope. But the ellipses are
`rx` 138 and 66 around `cx` 346, on a 428-wide stage. **Neither of them is "around the TV"** — the
television is 55.93 wide at x 306, and the outer ellipse's edge is 98px away from it.

What IS around the TV, at exactly its box, is `globals.css:1981`:

```css
.bn-tvtap::after { border-radius: inherit; box-shadow: inset 0 0 0 1px var(--gold); opacity: .26; }
.bn-tvtap--mobile { left: 71.5047%; top: 31.9259%; width: 13.0678%; height: 43.5556%; }
```

`71.5047% × 428 = 306.04`, `13.0678% × 428 = 55.93` — the TV image box to the hundredth. A **1px
gold inset ring at opacity .26 with a 10px radius**: faint, rounded, gold, and around the set. It is
unchanged before and after Block E, because Block E never touched it. `web/qa/banner-e/the-ring-is-
the-tap-target.png` overlays the rect on the render and it lands on the artifact exactly.

**JOE'S RULING, 2026-09-09: LEAVE IT.** Prompt 60 made the television a `<button>` that collapses
the banner, and `BannerTap.js` states the reason in its own header: *"an illustration that silently
became tappable is worse than no control."* That ring is the only resting cue that the TV does
anything. **It read as a rendering artifact only because nothing else in the banner says the
television is tappable** — once it is known to be an affordance, it stays.

**AND THE TWO OBVIOUS ADJUSTMENTS ARE BOTH WORSE, which is why this is a ruling and not a deferral:**

* **Dimming it** makes it worse at BOTH of its jobs at once. Below .26 it is still a rounded
  rectangle sitting on the artwork — visible enough to read as an artifact — while being too faint to
  read as a control. There is no opacity that is "not a smudge" and "still a cue".
* **Gating it on `:hover` / `:focus-visible`** removes the resting cue entirely **on a phone**, which
  is the device this app is built for. There is no hover on a touch screen, and focus arrives only
  *after* the tap — so the cue would appear exclusively to people who had already guessed.

**If it is ever revisited, the question is whether it reads as DESIGNED** — a ring that hugs the
television's own silhouette rather than a 10px-radius box floating around it — **not whether to fade
it toward invisibility.** That is a drawing problem, not an opacity problem.

**THE PROCESS LESSON, and it is the most transferable thing this block produced.**

**THREE SESSIONS REASONED ABOUT A ROUNDED OUTLINE NEAR A TELEVISION AND NONE OF THEM RENDERED IT.**
Cowork measured the gradients and found a real discontinuity; Joe ruled on the re-taper; this session
implemented it, regenerated, gated it five ways and reported it green. The diagnosis was plausible,
arithmetically supported, independently reviewed — and about the wrong element. Nothing in that chain
could have caught it, because every link was reasoning about stop lists and none was looking at the
banner.

**THE GAP IS ONE LAYER EARLIER THAN RULE 13.** That rule says a numeric threshold is measured against
the local background, and every number here was; what nobody established was **WHICH ELEMENT was
being measured**. A correct measurement of the wrong object is indistinguishable from a correct
answer right up until someone looks.

**So: a complaint phrased visually is answered with a crop that has the candidate outlined on it,
before any measurement is taken.** `the-ring-is-the-tap-target.png` took one Pillow call and settled
in a single look what three sessions of arithmetic had got backwards. The gradient's stop list is
what you check *after* you know which thing you are looking at.

**This sits beside rule 34 rather than under it.** Rule 34 says a platform behaviour recalled from
memory is not evidence, and its object is the PLATFORM. This one's object is the ELEMENT: the claim
"X is what you are seeing" is a hypothesis about which DOM node paints the pixels a person pointed
at, and it is checkable in one image.

---

## 35. SUNDAY NFL COUNTDOWN, AND WHAT THE SAME RELEASE SAYS ABOUT ITS MONDAY SIBLING — 2026-09-10, prompt 86

### 35a. Countdown is registered, standalone

ESPN Press Room, *"ESPN unveils Sunday & Monday NFL coverage for Super Bowl LXI season"*, published
2026-08-19 and read 2026-09-10
(<https://espnpressroom.com/press-release/espn-unveils-sunday-monday-nfl-coverage-for-super-bowl-lxi-season/>):
*"Sunday NFL Countdown (10 a.m.–1 p.m., ESPN)"*, season debut Sunday, Sept. 13. That closes the source
gap §7 Q4's row above recorded, and `sundaynflcountdown` is the registry's eighth show.

**It has no anchor, on purpose.** The window is STATED, and ESPN does carry the occasional Sunday NFL
game; an `ANCHORS` entry would let the bookend rule cut a published 10 a.m.–1 p.m. window down to that
game's kickoff. Null `anchor_rule` is 0013's own word for this case.

**It lists above the FOX and CBS pregame shows**, because it starts an hour before any of them.
Joe's ruling, 2026-09-10: time-first wins and `chronological()` is not touched — no network or
show-rank tie-break.

### 35b. Two things the same release contradicts in the tree — RECORDED, NOT CHANGED

- **`mnfcountdown.simulcast` is `null`.** The release: Monday Night Countdown *"for the first time,
  will be available on NFL Network this season."*
- **`mnfcountdown.duration_min` is `null`.** The release: *"the two-hour Monday Night Football
  pregame show (6–8 p.m., ESPN)"*.

Both are real, and prompt 86 left both alone: the bookend rule already produces a correct Monday
Night Countdown from the type default and its anchor, and a changed duration plus a new simulcast row
are behaviour changes nobody asked for. **They are here so the next reader finds them instead of
rediscovering them.** The same release names **NFL Primetime** (Chris Berman, Sundays 7:30 p.m. on
the ESPN App); it is a highlights show on an app, not a bookend on a game's network, so §7 Q4's scope
excludes it.

### 35c. The game link — one destination, three labels, and a column whose name is now imprecise (block B)

Joe's ruling, 2026-09-10: **one link, one destination per sport, and the label follows the state** —
*Preview* before the game, *Live box score* during it, *Box score* after. ESPN's
`/{league}/game/_/gameId/{n}` resolves preview → gamecast → recap on its own, where the
`/boxscore/_/gameId/{n}` the loader used to store does not; MLB's Gameday and the NHL's GameCenter
pages always did, and their templates are unchanged. So `pipeline/load.py` writes the link in every
state (the never-overwrite `coalesce` stays), `web/lib/gamelink.js` picks the label, and migration
0018 rewrites the rows already stored in the old form — **prepared, applied only on Joe's named
approval** (rule 14).

**THE NAMING DEBT, RECORDED AS A FOLLOW-UP.** `games.boxscore_url` now holds a *preview* URL before
kickoff, so its name is imprecise. It was deliberately not renamed in the same block: the rename
reaches `web/lib/queries.js:25`, the PostgREST select list, `web/scripts/smoke.mjs` and every test
that names the field, and a block that changes a template, a write gate AND a column name has three
candidate causes when something fails. A name like `game_url` is the obvious target; it is its own
migration, its own select-list change and its own gate run.

**Programs get nothing, by construction** — `programs` has no such column, and `gameLink()` refuses a
program row outright as well. Adding one is its own piece of work.

**No streaming claim.** ESPN's app-site-association carries no general `/watch` claim; this link opens
a game page, and nothing in its copy may say otherwise.
