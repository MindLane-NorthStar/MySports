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
| **§7 Q4 — studio shows, bookends only** | 7 shows, **111 instances** (`83dea25`) | four shows the brief named have no verified slot in the doc and are recorded in `data/studio_shows.json` `_not_loaded` |
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

### 18b. The 44 px tap-target minimum is AMENDED — one entry, two control families

Prompt 25 established a 44 px minimum and prompt 34 restored it after WebKit collapsed the tiles on
Joe's phone. **Joe has since excepted two control families, and they are recorded together here
rather than as separate notes that would rot apart.**

| control | height | ruled in | width at 390 | target area | vs a 44 × 44 tile |
|---|---|---|---|---|---|
| **ALL SPORTS bar** | **24 px** (was 44) | prompt 50 stage 2c | 366 px | ~8,800 px² | **4.5 ×** |
| **the three toggle rows** | **31 px** (was 44) | prompt 51 stage 1 | ~185 px two-up, ~90 px four-up | ~5,700 / ~2,800 px² | **2.9 × / 1.4 ×** |

**Joe's reasoning, on the record: the rule protects SMALL targets, and a wide short control is not
small.** Every excepted control carries more tappable area than a 44 × 44 square the rule considers
compliant — the tightest case, a four-up toggle segment, still carries 1.4 ×.

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
