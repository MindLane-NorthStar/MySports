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
0018 rewrote the rows already stored in the old form — **applied 2026-09-10 on Joe's named
approval** (rule 14): 99 rows, 0 left in the old form.

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

---

## 36. RULE 14 IS AMENDED; THE LOCAL WRITER CREDENTIAL STAYS — 2026-09-10, prompt 88

**The contradiction.** Working rule 14 said there was *"no writer credential in the repo, in `.env`,
or in any prompt."* The local `.env` — untracked, `.gitignore:1-2` — holds a live `mysports_writer`
connection string, and `docs/deployment-contract.md` §7 step 5 ("Local `.env`") is the instruction
that put it there. Nothing was ever exposed; two documents simply disagreed, and prompt 87 filed it in
`docs/queue.md` as a decision waiting on Joe.

**The two options, as they were put.**

1. **Remove the credential from `.env`**, so rule 14 becomes true as written. Cost: nothing on the
   laptop can write to the database — `scripts/apply_migration.py` and loader runs that write directly
   rather than emitting SQL stop working, and every write goes through the nightly Action or the
   Supabase connector.
2. **Keep it and amend rule 14** to say the credential exists locally for the pipeline's own use and
   that a Claude Code session never uses it. Cost: the rule relies on discipline rather than absence.

**JOE'S RULING: option 2.** The credential stays on the laptop; the rule stops claiming it does not
exist.

**Why this was the smaller change.** The framing at the time was that one of the two documents would
have to change. On reading both, only the rule was wrong. The deployment contract instructs a
legitimate setup step, and the same `.env` holds four R2 credentials that nothing disputes, so removing
one line would have been a behaviour change (no local writes at all) to fix a sentence. Every write
since rule 14's revision has in practice gone through the connector or the Action anyway, and the rule
now says that is where a session's writes go.

**What changed.** Rule 14's false clause, and nothing else of it: the four binding conditions (named
approval per operation, SELECT and paste first, the schedule checked, DDL applied from a file in
`db/migrations/`), the hard stops, and PostgREST anon reads as the normal read path all stand
verbatim. **Amended in BOTH copies** — `CLAUDE.md` and the full text in `docs/handoff-status.md`'s
working rules — because `CLAUDE.md` says `handoff-status.md` wins a disagreement, and a fix to the
losing copy alone would have left the winning one false. `docs/deployment-contract.md`, `.env` and
`.env.example` were not touched.

---

## 37. THE NFL NIGHTLY FETCHES BY DATE, EVERY DAY OF A ROLLING WINDOW — 2026-09-10, prompt 88

**The defect.** `schedule_refresh.yml`'s NFL step fetched two dates, yesterday and the coming Sunday
(`t + timedelta((6 - t.weekday()) % 7)`), and `adapters/espn.py --date` holds only that day's games
(`espn.py:177`). So every NFL game not on a Sunday — Thursday nights, Monday nights, December
Saturdays, the Wednesday opener — was in neither fetch on the day it was played: it kept whatever
kickoff and status the last full load wrote, and no score was stored while it was on. It failed no
gate; prompt 87 found it by counting stored links.

**Three options.**

1. **Patch Thursday and Monday** — add those two days to the existing two-date step. Smallest diff,
   but it encodes today's schedule shape: December Saturdays, flexed windows and a Wednesday opener
   would each need another patch, and a hole of this kind is invisible until someone counts.
2. **Fetch by NFL week number** (`--week N`, which the adapter supports). Rejected: nothing in the
   nightly derives an NFL week, and a date-arithmetic derivation breaks exactly at week 18 and the
   regular-season/playoff boundary — CFB needed a purpose-built `--latest-week` resolver for the same
   reason (`schedule_refresh.yml`, the CFB step).
3. **A rolling date window** — the loop NBA and MLB already use: yesterday for the finals, today, and
   six more days, one `--date` call each.

**JOE'S RULING: option 3.** Date-driven code never has to know what an NFL "week" is, so flex moves,
December Saturdays, international morning games and the January boundary are all covered without
anyone anticipating them. It is also the shape two other sports already run, so there is one pattern
in the nightly rather than three.

**What it cost, measured.** The NFL step went from two calls to eight and takes ~4 seconds; logos moved
to one `--teams-only` step so eight calls do not mean eight logo passes (NFL is the only league whose
art that adapter writes). On the first dispatched run (`34554883837`) the Thursday game was stored
`in_progress`, 17–7, while it was being played — the one line the change existed for. Records:
`docs/handoff-status.md`'s prompt 88 block A entry; guarded by
`tests/test_workflows.py::test_nfl_refresh_covers_every_game_day_not_only_sunday`.

---

## 38. CLAUDE.MD OWNS THE WORKING RULES; THE INCIDENTS MOVE TO A CASEBOOK — 2026-09-11, prompt 89

**JOE'S RULING, two halves, 2026-09-11.**

1. **`CLAUDE.md` owns the working rules outright.** `docs/handoff-status.md` dropped its copy and
   points at `CLAUDE.md`. The precedence line gains one carve-out: `handoff-status.md` still wins on
   **state** — repo state, gate floors, open items — and **`CLAUDE.md` wins on the rules**.
2. **The incident detail behind the long-form rules is kept, in `docs/rules-casebook.md`** —
   append-only history, explicitly non-binding. It was not discarded, and it did not move into
   `CLAUDE.md`.

**Why.** Rules are standing instructions, not state, so they do not belong in the file whose job is to
track what changed. The drift proved where they are actually maintained: rules 35 and 36 were added to
`CLAUDE.md` on 2026-09-09 and never reached `handoff-status.md`, whose copy stopped at 34 — while
`CLAUDE.md`'s own precedence line said `handoff-status.md` won a disagreement, so the losing copy was
the complete one. Prompt 88 nearly shipped the same shape of half-fix to rule 14. And a casebook that
is append-only history cannot misdirect a session the way a stale rule copy can: it never states a
rule, so there is nothing in it to follow. It is the same fix the gate floors got — one copy, and a
pointer from the other.

**The cost, stated honestly.** The precedence rule is now conditional — `handoff-status.md` wins on
state, `CLAUDE.md` wins on rules — and a conditional rule about which file wins is itself a thing to get
wrong, especially where a rule and a piece of state touch (a rule that names a figure; a state entry
that describes a rule). The casebook is a third file a reader has to know exists. And prompt 89 found
one false pointer its own reference search had missed: `CLAUDE.md`'s rules-section intro still said
the full text lived in `handoff-status.md`, in words the search did not look for.

**What moved, measured.** `handoff-status.md` 1,088 → 855 lines (the rules section, `:837–:1088`,
removed); `docs/rules-casebook.md` 245 lines, carrying the text that only `handoff-status.md` held for
rules 19, 21–24 and 26–34 (11,105 bytes of it by a per-rule comparison). The one piece of STATE inside
the old rule text — the line-ending renormalisation open item — moved to `handoff-status.md`'s `## Open`
list, re-measured at 21 files. `CLAUDE.md`'s 36 rule texts are byte-identical before and after. Queue
item 8 is closed by this entry.

---

## 39. SELF-COMMIT IS THE DEFAULT, AND THE STOP LIST IS UNWAIVABLE — 2026-09-11, prompt 91

**JOE'S RULING, 2026-09-11.** Self-committing stages and a push on green gates become the default for
every brief, not the exception. In exchange, a short list of stops becomes unwaivable — no brief may
authorize past it. Two-strikes-skip is **not** extended to attended runs; it stays an unattended-run
behaviour. Working rule 7 carries the default; `CLAUDE.md` `## Committing` carries the stop list and
the undo-block requirement.

**The four reasons, recorded so they are not re-argued.**

- **Gating the commit was close to pure cost.** An uncommitted working tree is not safer than a commit;
  it is less reviewable. A commit gives a stable SHA, a clean diff and `git revert` as a one-command
  undo; a dirty tree gives a diff against a moving baseline and no undo but `checkout --`.
- **The push is cheap here specifically.** A bad deploy on a single-user personal app costs Joe a broken
  page for the minutes until a revert deploys — and Vercel is the only compile check that exists
  (working rule 12), so gating the deploy made the compile check late and rare.
- **The one thing a push makes truly irreversible is a leaked secret**, so the secret gate is a stop no
  brief can authorize past.
- **The undo must be rehearsed, not theoretical**, so every self-committing run ends with an undo block:
  the real revert commands, which stages were one-way, and the deploy result.

**The stop list (S1–S7, in `CLAUDE.md` `## Committing`).** A secret-gate hit on added lines; any
database write or DDL; a force-push, history rewrite or branch deletion; a gate that fails and cannot be
made to pass; deleting or overwriting a tracked file outside the brief's named scope; any write to
`.env`, `.env.example` or `.gitignore`'s credential lines; an R2 object deletion. It overrides any
brief, and a brief that appears to authorize one of them is itself the error to report. Labelled S1–S7
rather than 1–7 so a stop is never mistaken for a numbered working rule.

**The cost Joe accepted.** This trades a pre-commit gate for a post-commit review, and **the review has
to actually happen before the next brief is written** — otherwise the default quietly becomes
"commit and nobody looks". It is also two-sided: every brief must now name the paths it may touch, or
S5 has no definition.

**What came with it.** `.claude/settings.json` (committed, project-level): an allow list for this
project's constant, read-only or locally reversible commands and a deny list for the dangerous ones.
Verified live on Claude Code 2.1.178: a denied command refuses rather than prompts, including a
`--force` placed after the branch and the PowerShell twin of a rule. **It is friction reduction, not a
security boundary** — prefix matching, per-tool prefixes and path rules are all bypassable by a
differently spelled command or a script that opens a file itself. The stop list, which governs intent,
is the real control.

## 40. CFB RECORDS GO INTO TEAM_RECORDS, AND THE NIGHTLY ENRICHES THE WEEK CONTAINING TODAY — 2026-09-11, prompt 90

**Joe's report.** No record rendered beside a college football team on the list card or the grid card.
Cowork measured the database and read the components on 2026-09-11; prompt 90 confirmed both defects
against the tree before changing anything.

**Defect 1 — `mysports.team_records` held no CFB rows at all.** `pipeline/standings.py:46` reads
`LEAGUES = ("mlb", "nhl", "nba", "nfl")`; CFB was never in scope (684 CFB teams, zero records, against
1,146 pro rows, Cowork's count). Both surfaces read that table and nothing else for a record: the list
card through `web/lib/queries.js:215 standingsFor()` → `web/lib/standings.js:155 standingFor()`, and
the grid through `web/components/MobileGrid.js:99-101`, whose `stored` branch is dead because
`GAME_SELECT` (`queries.js:9-46`) selects `home_rank`/`away_rank` but not `home_record`/`away_record`.

**Defect 2 — `--latest-week` means `max(week)`, and the nightly ran it.** `pipeline/enrich_cfb.py:201-204`
(line numbers before this prompt) is `select max(week) from games where sport = 'cfb' and season = %s`
— the newest week LOADED, not the week containing today — and `.github/workflows/schedule_refresh.yml:261`
ran `enrich_cfb --latest-week --fetch` every night. On 2026-09-11 that was week 15 (one game, 2026-12-12)
against the current week 2 (86 games, 2026-09-10 to 09-12). **The step has carried `--latest-week`
since it was added, `e759e8e` on 2026-09-02** — when eight weeks were loaded and week 1 was current —
so the CFB nightly enriched the wrong week from its first run until this prompt, following the schedule
outward as it was built. Weeks 2–7 and 9–13 carry zero game-column records. The same defect is why the
grid showed no CFB rank on week 2 (`MobileGrid.js:98` reads `game.home_rank`); the list card reads
`mysports.rankings`, which was current, and was unaffected.

**JOE'S RULINGS, 2026-09-11 — not to be re-argued.**

1. **CFB records go into `team_records`, written by `pipeline/enrich_cfb.py`**, so CFB uses the read path
   every other sport already uses. Not into `GAME_SELECT`; not by extending `standings.py`.
2. **The CFB nightly enriches the week containing today**, not the newest loaded week.
3. **No backfill.** Joe first approved a one-time backfill of weeks 2 onward. Cowork then measured that
   `team_records` is keyed `(team_id, season, as_of)` and that `standingFor()` reads only the newest
   `as_of` per team (`indexStandings()`, `standings.js:144-153`), so historical rows render nowhere and a
   backfill would add rows nothing reads. **Cowork withdrew it and Joe accepted.** One nightly write of
   every team's current record serves every CFB card in the season, past and future.

**What shipped.**

- **`--current-week`** (`enrich_cfb.py` `current_week()`): the week whose `viewing_day` range contains
  today (ET); else the next week to start after today; else the highest week already ended. The ranges
  come from the database (`WEEK_RANGES_SQL`), never a provider call, and **every run prints the resolved
  week, its range and which of the three clauses chose it** — a step that silently picked a week is how
  this survived every nightly run from 2026-09-02 on. `--latest-week` keeps its meaning for manual runs; only
  `schedule_refresh.yml:261` changed.
- **The `team_records` write** (`write_team_records()`), called in `main()` beside `apply_week()` and
  committed in the same transaction. The overall record is split from the records block's plain `"W-L"`
  display exactly as `pipeline/load.py:324` does, never from `record_display()`'s desktop form; ties only
  from a third component; all-zero records skipped (`realRecord()` and `allZeroRecord()` discard them);
  `conf_wins`/`conf_losses` from the block's `conf` display when it carries one, else null; `season` is
  the enrichment year; **`as_of` is the ET date of the run**, because the block is season to date;
  **`source` is `cfbd.enrich_cfb`**. Ids not in `teams` are skipped and counted — `team_records.team_id`
  is a foreign key, and one unknown id would roll back ranks and rivalry flags with it.
- **Coverage is every team, not the week's slate.** The block is CFBD `/records?year=`, season to date
  for every team (`scripts/probe_enrichment.py:199-215`; the week-1 file holds 683 teams, 146 with a
  record), so one run makes every CFB card in the season correct.
- **The game record columns are still written, and still unread.** They are the archived desktop
  renderer's path and `record_display()` builds that surface's conference form; removing them is a
  separate decision nobody has made.

**Left open on purpose, recorded so each is found rather than rediscovered.**

- The grid takes its CFB rank from `game.home_rank`, the card from `mysports.rankings`; only the card can
  print the `AP`/`CFP` label (`standings.js:103-105`, `:167`). What the compact grid run should show is
  Joe's design question.
- **The same `max(week)` shape lives in `pipeline/render_feed.py:194` `latest_week()`**, called by the CFB
  finals pass (`schedule_refresh.yml:51`, Sunday and Monday) and by `render_all.yml:57` (the Saturday
  desktop render). The finals pass is masked, not correct: the main CFB line fetches the date-derived
  `cfb_week` (`:42`), which on a Sunday or Monday is still the week just played, while the pass itself
  re-fetches December. Reported by prompt 90, not changed.
- A manual `--week N` run WITHOUT `--fetch` writes that saved file's records under today's `as_of`; the
  run prints the block's `generatedAt` beside the row count so a stale file is visible.
- `WEEK_RANGES_SQL` groups by week alone. Only regular-season CFB is loaded today (`adapters/cfbd.py`
  defaults `season_type` to `"regular"`); a postseason load that restarts week numbers would need a
  `season_type`-aware range before `--current-week` can be trusted in January.

**The data had not landed when this was written.** Prompt 90 wrote no row: the nightly Action does,
under working rule 14. Cowork verifies the rows in the database, not from the run's log.

## 41. THE REFRESH JOB GETS 35 MINUTES — 2026-09-11, prompt 92

**What happened.** `schedule_refresh` run #18 (the 07:00 ET schedule, 2026-09-11, on `09dcf72` — before
prompts 89, 90 and 91 were pushed, so entirely on old code) ended with "The job has exceeded the
maximum execution time of 20m0s." The `refresh` job (`.github/workflows/schedule_refresh.yml:16`) had
`timeout-minutes: 20`. `render` declares `needs: refresh` (`:288`, `:289` after this change), so it was
skipped and the grids did not regenerate that morning. **A pre-existing ceiling, not a consequence of
prompts 89–91.**

**Where the job got to — two measurements, and they differ on the tail.** Cowork read the database:
`refresh_runs` 142–146 and the CFB week-15 `games.updated_at` put Standings at 14:51:49 UTC, CFB polls
14:52:02, program eligibility 14:54:24, the loader 14:58:06, **the CFB enrichment step 15:02:31**,
canonical reconcile 15:02:33 — about 18 minutes into a job that started at 14:44. That agrees with the
runner. **The tail does not:** Cowork recorded the unit tests, watch links and archive as never
completing, from their absence in the database — but none of the three writes a row there, so the
database could not have shown them. The runner's own step record (`gh run view 34611905540`, read by
prompt 92) says the unit tests and the watch-link report **succeeded**, and the kill landed in the last
real step, **Archive fixtures + raw payloads**, cancelled at 15:04:21, 20m03s after the job started.
Every canonical write in the run committed; what the timeout cost was the archive upload and, through
`needs: refresh`, the render.

**The durations, job-level.** The brief quoted 18, 22 and 23 minutes for the successful 2026-09-10 runs;
those are whole-run times, `refresh` plus `render`. The `refresh` job alone, by run: #13 8m11s, #14
9m46s, #15 15m31s, #16 10m19s, #17 15m16s, **#18 20m07s (killed)**. Per step, the time is not in the
provider fetches (seconds each): it is the **R2 asset pull (4m → 7m)**, the **R2 logo push (2m → 3m)**
and the **loader (0m55s → 4m25s)**. And #18 was a slow run on top of a grown job: every database-bound
step ran 2–5× slower than in #17 (standings 7s → 12s, studio shows 33s → 1m08s, program eligibility
12s → 26s, the loader 2m20s → 4m25s, the archive 33s → 1m33s) while the R2 pull was flat.

**NOTHING REGRESSED; THE WORK OUTGREW THE BOX.** No code change made a step slow — prompt 88's
eight-date NFL loop costs three seconds, and the CFB enrichment step has run in one to four (on its
pre-prompt-90 code; the new code has not yet run on a runner). The
job roughly doubled in three days as the asset cache and the loaded schedule grew, and a slow morning
put it over a ceiling that had been tight since the start. Prompt 90 adds to that step a week-range
query, a CFBD `/records` fetch and an upsert of roughly 680 rows; dispatching it at 20 minutes would
have been a coin flip.

**THE NUMBER: 35.** Fifteen minutes over the ceiling #18 exhausted and more than double the slowest
successful job (15m31s), and still low enough that a genuinely hung job fails inside the hour instead of
burning a runner. The comment above the line records the old value, the date and run #18, so the next
reader knows it was measured. Nothing else in the workflow changed — not the step order, not the CFB
step's position, not `render`.

**What this does not fix, recorded so it is not mistaken for done.** Raising a ceiling buys headroom; it
does not stop the job growing. **The durable fix is splitting the job** — a design question about
ordering and failure isolation, and queue item 7 (the schedule to April 2027) makes it pressing. It is
`docs/queue.md` item 9, described and not approved.

## 42. THE R2 PULL DOWNLOADS THE WHOLE BUCKET TWICE A NIGHT, AND THE SAME LINE IS A DEFECT — 2026-09-11, prompt 93

**The measurement** (`gh run view --log`, runs #15, #16 and #17, 2026-09-10/11). `refresh`'s "Pull asset
cache from R2" step prints `bucket mysports-assets: 1625 objects; local cache: 5 files`, then
`unchanged 5 · local-only/changed 0 · bucket-only 1620` and `pulled 1620 file(s)`. **`render` prints the
same lines and pulls the same 1,620 again** (`render_all.yml:33`), so the whole bucket crosses the wire
twice a night. The logo push (`schedule_refresh.yml:253`) then compares 1,533 objects and pushes 0:
`sync_assets.py:308` checks sizes and, when they match — always, for a file pulled minutes earlier —
calls `remote_sha()` (`:92-96`), one sequential `head_object` per file. This is where register §41's
"R2 asset pull (4–8m)" and "R2 logo push (2–3m)" went.

**Why:** a checkout materializes only what git tracks, there is no `actions/cache` in the workflow (the
only cache is `cache: pip`, `:35`), `local_files()` (`sync_assets.py:60-72`) returns only what is on disk,
and `:312-314` pulls every remote key the local map lacks.

**THE COST AND THE DEFECT ARE THE SAME LINE.** `:312-314` decides by key alone, so a local file that
exists is never re-downloaded however far its bytes have drifted, and the next `--push` republishes the
stale bytes over the newer object — art that reverts after a nightly, silently. On the runner it cannot
fire, because nothing but the five fonts survives a checkout; on a machine that keeps `assets/` it is
live. **That is why caching `assets/` — the obvious way to buy back the minutes — cannot ship on its
own:** a warm cache is exactly the condition that turns the defect nightly. The correctness fix is the
enabling change, not a nicety.

**The correction to rev A's fact 1, and how it was caught.** Prompt 93's first revision stated that a
checkout materializes nothing under `assets/`. **It does: five tracked fonts under `assets/fonts/`.**
Cowork had inferred "untracked" from `assets/` being absent from `.gitignore` and from every brief's
"clean apart from `assets/`" precondition, and never ran `git ls-files assets/` — the label was
checked and the thing was not (working rule 30). The brief's own stop condition, "local cache: N files
with N not 0", fired on exactly those five and held the run before any change; the diagnosis survived,
since 1,620 of 1,625 is the whole bucket less the files git checks out. Rev A's other unverified claim —
that every file in the gitignored Project mirror under `handoff/` was a copy of a tracked document —
was false for one of fifteen; see `docs/rules-casebook.md` and the prompts README's row for
`48-programs-live-part-2.md`.

**THE RULING: the fix is deferred to its own brief, prompt 94,** because the comparison strategy is a
design choice that was Joe's to make: the ETag `list_objects_v2` already returns for every object, free,
against a `head_object` per file made parallel. **Whoever takes it: a multipart upload's ETag carries a
`-N` suffix and is not an MD5 of the bytes**, so an ETag comparison needs a fallback for those objects,
and the fallback is what has to be tested.

**Also recorded:** the runner's `refresh` job starts with `assets/` holding exactly the five tracked
fonts, so `git ls-files assets/` is the number any future `local cache:` line should equal on a cold
runner. A different number means something is keeping state between runs.

## 43. THE R2 SYNC COMPARES BYTES, WITH THE ETAG IT WAS ALREADY FETCHING — 2026-09-11, prompt 94

**The defect (register §42).** `scripts/sync_assets.py` decided what to pull **by key alone** —
`for key in remote: if key not in local` — so a file the cache already had was never re-downloaded,
however far its bytes had drifted from the bucket. The push half DID compare bytes, so the next
`--push` saw local ≠ remote and uploaded the stale copy over the newer object: art reverted, with no
error. Invisible on the runner (nothing but the five tracked fonts survives a checkout), live on any
machine that keeps an `assets/`.

**The comparator was already in hand and thrown away.** `remote_objects()` has stored
`{"size", "etag"}` for every key since the first version, and nothing read `etag`. For a single-part
upload the ETag is the MD5 of the bytes, so a field the listing already returns answers "are these the
same bytes" with no request at all. That is why the correctness fix and the speed fix are one change:
the push's size-match branch used to fall through to a `head_object` per file — **1,533 a night, to
push 0** (register §42).

**Stage A, measured before anything was built (working rule 34)** — a throwaway read-only probe that
listed and HEADed, and put, copied, deleted and downloaded nothing:

- **A1, the premise holds.** 25 keys sampled from the 1,578 present on both sides; all 25 were
  known byte-identical (`sha256` metadata == sha256 of the local file) and **all 25 had ETag == local
  MD5**. A free pass over all 1,578 (no network) found 1,553 ETag == MD5 and 25 whose sizes differ;
  every one of those 25 was HEADed and **none is known-identical** — they are real byte differences,
  so the stop condition (a known-identical file whose ETag is not its MD5) did not fire. **No object
  in the bucket carries a multipart ETag.**
- **A2, the bucket by top-level prefix** (1,628 objects, 101.5 MB):

  | prefix | objects | MB | in `FOLDERS` |
  |---|---|---|---|
  | `logos/` | 1,533 | 88.73 | yes |
  | `grids/` | 50 | 10.15 | **no** |
  | `network-logos/` | 31 | 0.85 | yes |
  | `fonts/` | 5 | 1.47 | yes |
  | `brand/` | 9 | 0.29 | yes |

  `local_files()` walks only `FOLDERS`, so `grids/` could never be matched locally and would be pulled
  forever even with the comparison fixed; the pull side now finds a cached copy at the path the key
  itself names (`cache_path()`), which is what fixes the bucket rather than four prefixes.
- **A3, sizes.** Local `assets/`: 1,722 files, 130.2 MB — including `handoff/`, `_audit_tmp/`,
  `league-logos/`, `program-logos/` and `p73-banner-pin/`, none of which is in the bucket. Remote:
  1,628 objects, 101.5 MB. Recorded for brief 95; not acted on.

**The change.** One helper, `same_bytes()`: size differs → different, free; a 32-hex ETag with no `-` →
compare with the local MD5, free; anything else → one `head_object` for the `sha256` metadata, which is
the old test and **the case that keeps it correct** — deleting it silently breaks every multipart
(>8 MB) upload. `plan()` computes both directions with one comparison per key: a key is pulled when the
cache has no copy **or its bytes differ**, and a key that differs on both sides is a **CONFLICT** —
`--push` sends the local copy, `--pull` takes the bucket's, the flag is the decision, and `--check`
names it as one. `--force` and `--existing-only` keep their shape; nothing about what is uploaded
changed. 16 tests in `tests/test_sync_assets.py`, and both required mutation checks failed when broken
and passed when restored.

**The live read-only check, 2026-09-11, on Joe's laptop:** `--check` ran in 4.3 s with **0**
`head_object` calls — `unchanged 1553 · conflict (bytes differ) 25 · local-only 29 · bucket-only 50`.
The 25 conflicts are `logos/nba-*_dark.png` (the laptop's copies are 1.5–2× the bucket's size); the 29
local-only files include retired and rejected art that prompts 68–69 refused to publish; the 50
bucket-only keys are all `grids/`. **None was resolved** — which side of each conflict is right is
Joe's call (`docs/handoff-status.md`).

**THE MULTIPART CAVEAT, for whoever touches this next:** a multipart upload's ETag is
`<md5-of-part-md5s>-<N>` and is **not** an MD5 of the bytes. There are none in the bucket today; the
fallback exists for the day there are, and a test pins it.

**THE WORKFLOW IS LEFT ALONE, deliberately, until brief 95.** On the runner the pull is unchanged —
its cache is empty, so every key is still bucket-only and 1,620 files still cross the wire twice a
night — but the logo push should stop paying its 1,533 round trips at once; the next nightly's log will
say so on its `sha256 look-ups (head_object)` line. Caching `assets/`, and whether the nightly should
pull the whole bucket at all when `logos/` is 88.7 of its 101.5 MB and `grids/` sits outside `FOLDERS`,
is brief 95's question, and this section is its evidence.

## 44. `--push` REFUSES TO PUBLISH WHAT NOBODY APPROVED, AND THE 25 CONFLICTS ARE A RULING THE RUNNER IGNORES — 2026-09-14, prompt 95

**The guard.** `scripts/sync_assets.py --push` now **refuses to create objects** the bucket does not
have unless `--allow-new` is given. A push whose plan holds any local-only key exits 3 **before the
first `_put`** — so a partial publish is impossible — and lists every such key with the two ways
forward (`--allow-new`, or `--existing-only`). Rewriting objects the bucket already has is untouched;
`--existing-only` keeps its exact meaning; `--force` does not bypass the guard, because force is about
headers on existing objects. `--push-grids` and `--push-data` are different paths with different
intent and were left alone. **Why:** prompt 94's honest comparison showed 29 local-only files on Joe's
laptop that a bare `--push` would publish, among them the retired and rejected art prompts 68 and 69
stopped by reading a diff — two catches, not a control, and the bucket is public.

**The nightly needed the flag in the same commit**, and the evidence is in its own log: run #21
(2026-09-13) created four objects — `logos/110242.png`, `logos/110242_dark.png`, `logos/2130.png`,
`logos/2130_dark.png` — through exactly this push. `schedule_refresh.yml`'s logo push now passes
`--allow-new`, with a comment saying it is deliberate. **`bootstrap_season.yml:49` also runs a bare
`--push`** (manual-only; outside prompt 95's scope): it fetches provider logos onto a fresh runner and
pushes them, so it will now refuse whenever a fetched logo is new to the bucket, and fail before its
reference-data and season-fetch steps. The refusal names the fix; the flag must be added before its
next dispatch (`docs/handoff-status.md`).

**The 25 conflicts — measured, and not compression.** Brief 95 expected pixel-identical files at
different compression. **Every one differs in dimensions**: the bucket's `logos/nba-*_dark.png` are
256×256, the laptop's 500×500, both RGBA. The rest of the chain, measured read-only:

- the laptop's 25 are **byte-identical to their own 500px bases**, and **all 25 teams are in
  `skip_derive`** in `data/logo_conditioning.json` — Joe's prompt-64 ruling that these teams' dark art
  is the raw file. The laptop holds what the ruling says;
- the bucket's 25 are **pixel-identical to the conditioned derive** (`thumbnail(256)` →
  `derive` → `floor_l(0.5)`) computed from those same bases — the chain the ruling exists to prevent;
- **run #14 (2026-09-09) published them**: its log reads `dark logo variants: 25 generated, 0 copied
  raw (ruled skip_derive)` and `pushed 25 file(s)`, and the bucket's objects are stamped 2026-09-09
  15:04 UTC;
- **why the runner ignored the ruling:** `team_dark_variants()` tests `p.stem in skip_derive`
  (`build_web_marks.py:633`) — a case-sensitive match. The ruling file names the NBA teams in
  uppercase (`nba-BKN`); the laptop's bases carry that case, but the runner's are the files it PULLED,
  and bucket keys are lowercase (`nba-bkn.png`). Of 463 `skip_derive` entries exactly 25 contain
  uppercase, all NBA, and they are exactly the 25 conflicts.

**So the conflict is not an art question after all — the ruling already answers it, and the bucket is
on the wrong side.** Since 2026-09-09 the listings have floated conditioned art for 25 NBA teams Joe
ruled raw. And **pushing the laptop's copies would not stick**: the next nightly would pull them, miss
the ruling again, see a dark file byte-identical to its base, recondition it and push the 256px version
back. The fix is a case-insensitive ruling lookup in `build_web_marks.py`, which is outside prompt 95's
scope; nothing was resolved. **Pillow was measured and ruled out**: the laptop runs 12.2.0, the runner
installed 12.3.0 (`requirements.txt` pins only `pillow>=10`), but an encoder cannot change dimensions.

**Prompt 94's saving, seen in production.** The "Push new logos to R2" step took **2m53s** on run #19
(old code) and **0m02s** on runs #20 and #21, each logging `sha256 look-ups (head_object) 0`. The pull
is unchanged (3–8 minutes; the runner's cache is still empty), and that is brief 96.

## 45. JOE'S RAW-LOGO RULING MATCHES IN ANY CASE, SO IT REACHES THE RUNNER — 2026-09-14, prompt 96

**The chain, each link checked against the tree (prompt 95 found it; Cowork verified it independently;
prompt 96 re-measured the parts it changed).**

- **The data.** `data/logo_conditioning.json`'s `skip_derive` holds 463 ids. Exactly 25 contain an
  uppercase letter, all NBA (`nba-BKN` … `nba-WAS`), spelled as the database spells them. The other 438
  are numeric college ids. `derive` holds five more mixed-case NBA ids (ATL, HOU, PHI, TOR, UTA).
- **The comparison.** `conditioning_rulings()` built its sets from those keys as written, and
  `team_dark_variants()` tested `p.stem in skip_derive` — the filename on whatever machine was running.
- **Two machines, two spellings.** Joe's laptop has `nba-BKN.png`, so the stem matched, the ruled-raw
  branch fired, and his dark files are byte copies of the 500px bases, as ruled. The nightly runner's
  logos are the files it PULLED from R2, whose keys `sync_assets.py` lowercases on upload, so it had
  `nba-bkn.png`, the stem missed, and the file fell through to the conditioning chain: 256px,
  `derive` + `floor_l(0.5)`. **The ruling was silently not applied.**
- **The only trace read as normal work.** Run #14's log said `dark logo variants: 25 generated, 0
  copied raw (ruled skip_derive)`, then `pushed 25 file(s)`. Nothing failed. **The divergence began
  with run #14 on 2026-09-09** and held for five days, on 25 teams including the Cavaliers — the day
  after Joe made the ruling by looking at the art.

**THE FIX IS IN THE COMPARISON, NOT THE DATA — decided, with the reason.** Three spellings of a team id
are in play: the database's, the local filename's and the lowercased R2 key's. Lowercasing the 25 keys
in the JSON would cure today's symptom and leave the next mixed-case id broken, and the JSON is the
record of Joe's ruling in the spelling he gave it. So `build_web_marks.rule_key()` normalizes **both
sides** — the sets `conditioning_rulings()` builds (`skip_derive` AND `derive`, which had the same
exposure) and the stem tested against them — and the both-ways conflict check now runs in the
normalized spelling, so two spellings of one team cannot hide a contradiction.
`data/logo_conditioning.json` is unchanged.

**It self-heals, and prompt 96 proved that rather than trusting it.** In a scratch directory built
from real bytes — the 25 bases under the runner's lowercase names and the 25 conditioned objects exactly
as the bucket holds them (the code's own rebuild matched them 25/25) — the fixed `team_dark_variants()`
reported `0 generated, 25 copied raw (ruled skip_derive)` and left every dark file a byte copy of its
500px base; **a second run reported `25 already present` and rewrote nothing**, so the correction is
one-time, not a 25-file push every night. A read-only `plan()` against the real bucket listing then
showed `--push` would send those 25 as **rewrites of existing objects, 0 new**, so prompt 95's guard does
not stand in the way. **The next nightly corrects the bucket on its own; nothing was pushed by hand.**

**Also in this change:** `bootstrap_season.yml`'s bare `--push` gains `--allow-new` — that workflow
exists to fetch art the bucket does not have yet, and prompt 95's guard would otherwise stop it before
its reference-data load.

**Searched and named, not changed.** `git grep` for `logo_conditioning|skip_derive|conditioning_rulings|
CONDITIONING` outside `docs/`: only `build_web_marks.py` reads the file (`audit_dark_logos.py` imports
`LOGO_DIR` alone; `fetch_team_assets.py`, `sync_assets.py` and `web/lib/config.js` mention it in prose).
The one other id-to-filename construction in the same shape is `team_cap_art()`
(`build_web_marks.py` `LOGO_DIR / f"{team_id}.png"`), which would miss a lowercase runner file for a
mixed-case id; its only cap team today is `mlb-137`, so it is latent. Left alone and recorded.

## 46. TWO REFRESH RUNS A DAY, BOTH OFF THE TOP OF THE HOUR — 2026-09-14, prompt 97

**JOE'S RULING, 2026-09-14: two scheduled runs a day, at 3:37 a.m. and 7:37 a.m. Eastern** —
`schedule_refresh.yml` now carries `37 7 * * *` and `37 11 * * *` (UTC) in place of `0 11 * * *`. The
trigger: on 2026-09-14 the White Sox–Guardians card showed Friday's records, Friday's games-back and no
pitching matchup, because the day's refresh had not run — every row for that game was last written
2026-09-13 14:48:39 UTC.

**The real fire times, measured (`gh run list`, `event == schedule` only).** In every run `startedAt`
equals `createdAt`: the whole delay is GitHub queueing the scheduled event, not a runner waiting.

| scheduled refresh, due 11:00 UTC | created / started (UTC) | delay |
|---|---|---|
| #1 Wed 09-02 | 15:00 | 4h00m |
| #5 Thu 09-03 | 14:49 | 3h49m |
| #6 Fri 09-04 | 14:38 | 3h38m |
| #7 Sat 09-05 | 13:37 | 2h37m |
| #10 Sun 09-06 | 13:51 | 2h51m |
| #11 Mon 09-07 | 16:13 | **5h13m** (worst) |
| #13 Tue 09-08 | 14:50 | 3h50m |
| #14 Wed 09-09 | 14:55 | 3h55m |
| #15 Thu 09-10 | 14:42 | 3h42m |
| #18 Fri 09-11 | 14:44 | 3h44m |
| #20 Sat 09-12 | 13:48 | 2h48m |
| #21 Sun 09-13 | 14:44 | 3h44m |
| Mon 09-14 | — | **not fired at 16:22 UTC, 5h22m after it was due** |

**Median 3h44m, worst 5h13m, best 2h37m over 12 days; no date from 09-02 to 09-13 is missing.** 09-14 is
either the worst delay yet or the first drop — it cannot be called until the day ends; Joe's manual
dispatch (#22, 15:39 UTC) was that day's only refresh. `render_all.yml`'s own schedule (09:30 UTC) shows
the same shape: 13 scheduled runs 09-02..09-14, median 4h15m late, worst 6h27m (09-14), none missing.

**Where Cowork's inferred figures were wrong, and by how much.** Its table read the first step recorded
in `mysports.refresh_runs`, which records steps, never job starts, and assumed ~8 minutes before the
first one. The real gap is ~3 minutes, so the inferred delays were **overstated by 2–6 minutes** —
09-04 ~3h40m vs 3h38m, 09-07 ~5h15m vs 5h13m, 09-09 ~4h vs 3h55m, 09-13 ~3h45m vs 3h44m. **Right in
substance, wrong in the last digits;** the measured table above replaces it.

**Why, and the honest caveat.** GitHub runs scheduled workflows on a best-effort basis and the top of the
hour is the platform's most congested minute. **Moving off `:00` usually helps and is not a guaranteed
cure**; at least one public report describes the delay persisting after a minute change. That is why the
second run matters more than the minute: **one run a day has no backstop, and this change buys
redundancy rather than punctuality.** The loader is idempotent, so the second pass costs runner minutes
and nothing else.

**The cost:** a whole run (refresh + its render) measured 10–28 minutes over the last six successful
runs, median ~21, so two a day is **roughly 40–45 runner-minutes against ~20**.

**The concurrency interaction, stated not solved.** `concurrency: { group: mysports-refresh,
cancel-in-progress: false }` means a run that starts while another holds the group QUEUES. The worst
measured delay (5h13m) is longer than the four-hour gap, but queueing needs the 07:37 run to be delayed
~3.5 hours MORE than the 11:37 run (the gap less a ~20-minute run); the observed spread over 12 days is
2h36m (2h37m to 5h13m). **Possible in principle, not seen in this sample** — and a queued run still runs.

**DAYLIGHT SAVING.** The schedule is UTC with no DST awareness: 07:37 / 11:37 UTC land at 3:37 / 7:37
a.m. EDT until **2026-11-01**, then at 2:37 / 6:37 a.m. EST until March. Keeping the clock times means
shifting both lines by an hour; nothing in the repo will remind anyone. The comment above the lines says
so.

**The `render_all` finding (recorded; that workflow was not changed).** Its header says it runs "after a
successful refresh", but its own schedule, 09:30 UTC, is ninety minutes BEFORE the old 11:00 refresh —
and measured, **the standalone render fired before the refresh on all 12 days, by 42–74 minutes**, so it
has always drawn from the previous day's rows. The refresh already renders through its own
`needs: refresh` job, so the standalone schedule is a second trigger for the same work; on 2026-09-14 the
two collided in `render_all`'s own `concurrency: { group: mysports-render, cancel-in-progress: true }` and
the standalone run was cancelled. What to do with it is Joe's decision (`docs/queue.md` item 10).

## 47. THE STANDALONE RENDER SCHEDULE IS GONE, AND THE CONTRACT CATCHES UP — 2026-09-14, prompt 98

**JOE'S RULING, 2026-09-14: drop it.** Queue item 10 is decided and deleted: `render_all.yml`'s own
`schedule:` block (`30 9 * 9,10,11,12,1,2 *`) is removed. `workflow_dispatch` and `workflow_call` stay —
the first is how Joe renders by hand, the second is how the refresh calls it. The refresh already
triggers a render (`schedule_refresh.yml`'s `render` job: `needs: refresh`, `uses:
./.github/workflows/render_all.yml`), and with two refreshes a day since prompt 97, two correctly ordered
renders follow without it.

**The evidence (prompt 97, `gh run list`):** the standalone run fired **before the refresh on 12 of 12
days**, 2026-09-02..13, by 42–74 minutes. It never once drew current rows; every grid it produced on its
own schedule came from the previous day's data. The file's header had claimed it ran "after a successful
refresh"; that header now says what is true and why the schedule went, so nobody re-adds it as an
apparent omission.

**The backstop argument, and why it lost.** Keeping it would cover a day the refresh fails — but on that
day it renders stale data, so it publishes grids that look current and are not: the same failure shape as
the `25 generated` counts line that hid the logo defect for five days (§45). A failed refresh should leave
yesterday's grids in R2 untouched, which §5 of the deployment contract already provides for (the upload is
atomic per file). And chasing the order with a later time does not work: the two workflows drift by
different amounts (refresh median 3h44m, render 4h15m), so a schedule cannot pin an order that GitHub's
queue decides.

**The contract, corrected — v1.0.4, in v1.0.3's own shape ("the code was right and the contract was
stale, so the contract moved").** `docs/deployment-contract.md` §5 had two wrong rows: `render_all.yml`
"daily 09:30 UTC in season", which this prompt makes false, and **`schedule_refresh.yml` "daily 11:00
UTC", which prompt 97 changed on 2026-09-14 without updating — that brief's miss**, fixed here. Both rows
now say what the workflows say: refresh at 07:37 and 11:37 UTC (3:37 / 7:37 a.m. EDT, 2:37 / 6:37 a.m. EST
after 2026-11-01); render after a successful refresh or by hand, with no schedule of its own.

**D7's "a refresh run is ~3 minutes", measured.** The billing API could not be read — `users/{u}/settings/
billing/*` needs the `user` token scope and this `gh` login carries `gist, read:org, repo`; the
per-workflow `timing` endpoint answers `{"billable":{}}` — so the account's own consumed minutes and
allowance are **outstanding**. What was measured instead is runtime, from every job's start and end time,
each job rounded up to the whole minute as GitHub bills Linux runners:

| 2026-09-01 .. 09-14 | runs | minutes | per successful run |
|---|---|---|---|
| `schedule_refresh` (refresh + its render) | 22 | 323 | median **15** (7–29); refresh job 10, render job 5 |
| `render_all` standalone | 13 | 71 | median **5** (2–12) |
| `bootstrap_season` | 9 | 82 | median 6 (2–48) |
| `backup_schema` | 2 | 2 | 1 |
| **total** | | **478** | |

The run has grown — **the last six refresh runs have a median of 22 minutes** — so D7's premise was off by
roughly five to seven times. **Projection for a 30-day month under the new schedule, standalone render
gone:** two runs a day at 22 minutes ≈ **1,324 minutes, 66 % of the 2,000 allowance**; at the all-run
median of 15, ≈ 904 (45 %). **It clears — but not by the order of magnitude the contract claimed**, and a
season build-out through `bootstrap_season` (one run took 48 minutes) comes out of the same allowance. D7 and
the §5 budget line now carry the measured figures. The schedule is Joe's; nothing here proposes one.

**Also noticed, not changed:** `backup_schema.yml`'s weekly `0 12 * * 0` is the repo's only other schedule,
and it sits at minute 0 — the slot prompt 97 moved the refresh off. It is weekly and a late backup costs
nothing, so it is recorded rather than moved.

## 48. THE STATUS BAR GOES BACK TO iOS — `black`, NOT TRANSLUCENT — 2026-09-15, prompt 99

**Numbered by count:** §1–§47 each appear exactly once and there was no §48.

> **CONFIRMED ON THE DEVICE 2026-09-16 (prompt 102).** Joe reinstalled the PWA, tested, and reported
> *"It works — we're good."*: iOS draws its own dark opaque bar, the banner starts below it, and the
> wash over the wordmark is gone. Rule 25's second half is satisfied and the open item is closed.
> **Two caveats travel with that, both understated rather than rounded up.** First, the evidence is
> asymmetric — every BEFORE figure here is measured at pixel scale, while the AFTER is a person
> looking at a phone, and **there is no post-fix pixel measurement.** Second, this section's criteria
> included *"no wash over the wordmark OR THE COLLAPSED HEADER"*, and **the collapsed header was
> never measured for wash**; the basis for that half is Joe reporting the navbar rendering correctly
> across several screenshots. **The pull-up in item 4 below stays withdrawn** — closing the item does
> not revive it.

**The symptom.** iOS 27 paints a progressive blur over the top edge of an installed PWA. On Joe's phone
it muddies whatever is at the top — the banner wordmark, and the collapsed header once it has taken over.

**The trigger.** `web/app/layout.js` carried `statusBarStyle: 'black-translucent'` from `ba05819`
(2026-09-03). That style lays the web view UNDER the status bar, so whatever iOS does to that band lands on
the app's own pixels.

**Why no CSS can fix it, and why nothing was added.** `.chdr` (`globals.css:3173-3180`: sticky, `top: 0`,
`z-index: 40`, `background: var(--spot-2)`, `padding-top: env(safe-area-inset-top, 0px)`) already paints
opaque ground across the whole band, and **Joe reports the wash over it too.** So the blur is composited
above the web view, and nothing the page paints can defeat it. The usual remedy, a fixed element pinned to
the top with `height: env(safe-area-inset-top)`, would be a second copy of `.chdr`, which has already been
shown not to work, so prompt 99 was told not to add one and did not. **Two more elements paint into the band,
named because they are evidence about the same question:** the banner in its pinned state,
`html[data-pin='banner'] .banner` (`globals.css:3313-3317`, sticky `top: 0`, carrying its own inset
padding), and `.dpanel-scrim` (`globals.css:1557-1561`, `position: fixed; inset: 0`) while a game's detail
panel is open. Neither was changed.

**Why not `default`.** The comment it replaces recorded it: with `statusBarStyle` absent, Next emitted no
status-bar tag and iOS fell back to `default` — *"an opaque LIGHT bar sitting above a #1b1b1b app."* The
same comment named `black` as *"the no-layout-consequence fallback: a dark opaque bar."* That is what
shipped. `viewportFit: 'cover'` stays, because `globals.css:204-205` and `:1842-1843` read the left, right
and bottom insets. `themeColor` and the manifest's two colours stay `#1b1b1b` (= `--spot-2`).

**Evidence that it emits.** The served HTML of `/`, `/weeks` and `/history` carries exactly one
`<meta name="apple-mobile-web-app-status-bar-style" content="black"/>`. That check reads the EMITTED value,
and it was mutation-checked. Adding `other: { 'apple-mobile-web-app-status-bar-style':
['black','translucent'].join('-') }` to `metadata` passes a source grep (the word never appears, and
`statusBarStyle: 'black'` still appears once), but Next then emits two tags, **the translucent one first**.
The emitted check fails that 3/3, and passes the real file 3/3.

### What the top measures now — stage D, four figures, arithmetic on the artwork

1. **Stage width: 428.** `web/components/BannerMobileV2.jsx:34`, `viewBox="0 0 428 135"`, generated from
   `web/lib/banner-mobile-v2.json:6` (`stage.w`).
2. **The wordmark's first ink: stage y = 4.392.** Baseline `29.88` (`banner-mobile-v2.json:91`, emitted at
   `BannerMobileV2.jsx:73-74`), font size `36` (`:93`), and the tallest glyph's outline top read from the
   font the page actually loads, `web/public/fonts/BarlowCondensed-Bold.ttf` (sha256 `e476562e…`): 1000
   units per em, cap height 700, **O and S overshoot to 708**. So 29.88 − 708/1000 × 36 = **4.392**; the flat
   capitals top out at 4.680. **The definition** is the top of the gold glyph outlines. The dark
   `bnTitleHalo` is excluded, because it is darker than the ground and reads as shadow, not shape. The sheen
   cannot count, because it is masked to the glyphs. **The JSON's
   `cap_height: 25.92` (0.72 × 36) is the halo's radius basis, not the ink**, and would give 3.96. The font
   settles it.
   *Corroboration, not the measurement:* the dev server renders at inset 0 (the geometry `black` produces).
   At DPR 3 its first row of gold ink is device row 13, which is 4.333 CSS px at both 390 and 430. That is
   within one device row of the font's figure at each width; the renderer snaps glyphs to whole pixels.
3. **The clearance under `black`:** 4.392 × 390/428 = **4.00 CSS px at 390**, and 4.392 × 430/428 =
   **4.41 CSS px at 430** (Joe's iPhone 14 Pro Max).
4. **The compensation that would pull the wordmark flush under the bar — NOT APPLIED, and since
   2026-09-16 CONTRAINDICATED.**

   > **REVERSED BY MEASUREMENT (prompt 101 block B, §50).** Do not apply this line. The matched
   > screenshot pair of 2026-09-16 found iOS 27 feathering a scrim from the top edge down to about
   > **90 CSS px**, roughly 30 px BELOW iOS's own 59 px bar, with the wordmark's glyph rows inside it
   > at 0.484 of full brightness at the top of the capitals. This pull-up moves the wordmark **4.4 CSS
   > px further UP**, which is deeper into the feather and darker, not better. The figures below stay
   > as the measurement of the artwork they describe; only the recommendation is withdrawn.

   ```css
   @media (display-mode: standalone) and (max-width: 699px){.banner{margin-top:calc(-100% * 4.392 / 428)}}
   ```

   A percentage `margin-top` resolves against the containing block's WIDTH (CSS 2.1 §8.3, which says so of
   `margin-top` explicitly). `.banner`'s containing block is the full-width `body` (`Chrome` returns a bare
   fragment), which is the width the SVG scales to, so the offset tracks the artwork at every phone width:
   −4.00 at 390, −4.41 at 430. It sits **beside** the existing standalone block rather than inside it, for
   one reason: in landscape the phone is wider than 699px and shows the DESKTOP banner, whose headroom this
   does not measure. It moves the whole banner, so the TV's tap target (`BannerTap`, a child of
   `.bn-mobile`, `Banner.js:44-47`) moves with its artwork. **What it removes is the artwork's empty headroom**: 4.392 stage px of ground,
   glow and the upper tail of the dark halo leave through the top of the web view. Under `black` that is
   the bar's lower edge; the strip is not "behind" the bar, it is simply not painted. No gold is cut, and the
   O and S tops land at y = 0.00. If WebKit's pixel snapping shaves a device row off those tops,
   `4.1` in place of `4.392` keeps one row of air.

**The comparison, at 430 CSS px, for Joe to judge — no recommendation:**

| state | wordmark's first ink vs. the bottom of the status band |
|---|---|
| Joe's first installed ruling (prompt 45), later judged too much | **+18 px** |
| **`black`, as shipped by this prompt** | **+4.41 px** (4.00 at 390) |
| with the compensation above | **0.00 px** |
| today, `black-translucent` | **−5.59 px — inside the band** (−6.00 at 390) |

**THE LAST ROW CORRECTS TWO DOCUMENTS AND THE BRIEF.** M22 and `globals.css:1993-2008` say the ink lands
*"EXACTLY at the band's lower edge"*, zero clearance. That was true when prompt 51 measured it: baseline
`36.88`, first ink 36.88 − 25.488 = 11.39 stage px, which is where the "11 stage px of headroom" comes from.
**`d24e8e0` ("banner: model f", 2026-09-07) moved every element up 7 stage px**; its own message says the
artwork had *"11 units of margin above and 14 below; both become 4"*. The inset rules and their comments did not follow. Installed, the
standalone padding is `inset − 10`, so the ink sits at `inset − 10 + 4.41`: **5.59 px inside the band at
any inset**, whichever iPhone it is. Since 2026-09-07 the top of the wordmark has been sitting in exactly
the strip iOS 27 now blurs. M22 is amended in this commit (rule 30). The `globals.css` comments could not
be: the brief made that file read-only. **They were corrected by prompt 102 on 2026-09-16** — the
header no longer claims the banner bleeds under a translucent bar, the headroom reads 4.392 stage px
rather than 11, and the measured table is kept as dated history carrying both of its corrections.
Comments only: with every comment stripped the stylesheet is byte-identical before and after.

**Prompts 45, 46, 50 and 51's tuning is DORMANT, NOT DELETED.** `globals.css:2011` (`max(0px,
calc(env(safe-area-inset-top, 0px) - 14px))`), `:2034` (the standalone `+ 4px - 14px`) and `:3178`
(`.chdr`'s inset padding) all resolve to 0 when the top inset is 0, on their own guards. If the style ever
goes back to translucent they wake exactly as they were, including the 5.59 px overlap above.

**The trade.** The edge-to-edge top goes: the artwork no longer runs up behind the clock and battery. In
return the top is unwashed, because iOS's own dark bar owns the band. That trade is Joe's to confirm on the
device.

**What no gate can say.** `npm run smoke`, `node scripts/qa-shots.mjs` and `npm run geometry` run in
desktop Chromium with no safe-area inset. They have always rendered the geometry this change produces, so
none of them can detect it and none can confirm it. Five green gates here are not a verdict.

**The platform assumption (rule 34), stated.** That `black` puts the web view below the bar with a top
inset of 0 rests on this repo's own record of the non-translucent family: `default` observed as a bar
*"sitting above"* the app, and the old comment's *"no-layout-consequence"*. It does not rest on a spec, and
not on iOS 27. If iOS 27 reported a top inset under `black`, the three rules would add `max(0, inset − 10)`
and the clearance would grow by that much. The phone decides, **after a reinstall**: iOS is taken to read
the status-bar tag at install, so the existing Home Screen icon keeps the old behaviour until it is
removed and re-added from Safari.

**Also noticed, not changed (out of scope):** `web/components/Banner.js:21` and the JSON's own
`stage.units` note still say the phone banner's height is `width x 155/428`. Since `d24e8e0` the viewBox
has been 428 × 135.

## 49. THE STRAY `AGENTS.md` IS DELETED, AND DELIBERATELY NOT IGNORED — 2026-09-15, prompt 100

**Numbered by count:** §1–§48 each appear exactly once and there was no §49.

**Pointer, 2026-09-23 (prompt 120, §65):** the cause is now measured — the Codex desktop app's "import from Claude Code" sync writes the file, not a second agent and not a stray write from another project — and `scripts/remove_codex_agents_md.py` removes a copy it verifies, under Joe's standing authorization in working rule 35's amendment. "Not gitignored" and "no allowlist" below still stand.

**JOE'S RULING, 2026-09-15:** *"Codex got in this repo by accident. Remove the AGENTS.md file — it
doesn't belong there."*

**What it was.** An untracked `AGENTS.md` in the repo root: **22,539 bytes, mtime 2026-09-14 16:00:15
EDT (20:00 UTC)**, sha256 `147c8941…a108`. It was never in any commit on any ref (`git log --all --
AGENTS.md` is empty). Prompt 99 found it at its start and reported it, and nothing in the tree read it.
**It was a machine-made copy of `CLAUDE.md`, measured rather than assumed:** take `CLAUDE.md` as of
`d6cd7b2` (22,564 bytes, the version current when the copy was written), replace its four `Claude Code`
with `Codex` and its one `Claude.ai` with `Codex.ai`, and the result is **byte-identical** to
`AGENTS.md`. Nothing else in it differed, so nothing in it was unique.

**It was already drifting.** Against `CLAUDE.md` at `9faa97b` it differed on exactly the two rows prompt
99 had updated: the register range (`§1–§47` against `§1–§48`) and the brief count (103 covering 01–98
against 104 covering 01–99). It was a second copy of the working rules, which is the failure §38 closed
on 2026-09-11 and the reason recorded at `.gitignore:33`, `CLAUDE.md:215` and `handoff-status.md:57`:
a copy nobody diffs drifts, and nothing fails when it does.

**How it went.** Checked untracked (`git ls-files --error-unmatch` failed) and unreferenced
(`git grep -n AGENTS.md -- ':!docs/prompts/'` was empty before this entry was written; it now finds
only this entry and the handoff line that closes the item, which are the record and not references. A
case-insensitive search found only "user agents" in an MLB research note). It was removed with Python's `os.remove`, and the removal was proved by
a directory listing, not by the absence of an error. **The listing is the proof, not `git grep`:**
`git grep` searches only tracked files, so it returned nothing while the file was still on disk. The
authority for the deletion was Joe's ruling and the brief naming the path in its scope. The settings deny
list is not a boundary. It also does not deny a bare `rm`; it denies `rm -rf *` and `rm -fr *`.

**NOT GITIGNORED, ON PURPOSE.** If Codex, or anything else, writes the file again, an ignore line would
make it invisible, while an untracked file shows up as `?? AGENTS.md` in the next `git status`, where
somebody sees it. Working rule 4 (stage by explicit path) already keeps an untracked file out of a commit,
so ignoring it would buy nothing and cost the only signal. **The `handoff/project-mirror/` line is the
opposite case, for its own stated reason:** `.gitignore:27-33` keeps that line *"so a recreated mirror can
never reach the index"*. There the risk worth guarding was committing it; here it is not noticing it.

**No new working rule.** Rule 2 (one writer at a time) already covers a second agent in the repo, and
`CLAUDE.md` owns the rules (§38).

## 50. THE FIRST SCROLL AFTER A LANDING, AND THE WORDMARK'S RE-ARM — 2026-09-16, prompt 101

**Numbered by count:** §1–§49 each appear exactly once and there was no §50.

> **2026-09-23, prompt 114:** Block B's hypothesis — that an element holding the top edge suppresses
> iOS 27's scroll-edge scrim — is **false on the iPad**, where an opaque sticky `.chdr` holds the edge
> and is scrimmed. The phone confirmation above stands; the mechanism is recorded as unknown. §59.

Two defects in one release path. **Block A is mechanism-proven, in the browser, in both directions.
Block B's wiring is proven and its PREMISE IS A HYPOTHESIS about iOS 27.** It shipped provisional
under rule 25.

> **CONFIRMED ON THE DEVICE 2026-09-16, and the ship is no longer provisional (prompt 102).** Joe
> tested the installed app after this deployed and reported *"It works — we're good."* — the navbar
> appears on the FIRST scroll-down after a switch to WEEK, and the restored wordmark is no longer
> washed. **THE EXPLANATION IS STILL A HYPOTHESIS.** He confirmed the OUTCOME; the MECHANISM below
> is unchanged in status, and a working fix is evidence FOR it rather than a promotion of it to
> fact. **The evidence is also of two kinds** and the difference matters more than it reads: every
> BEFORE figure in this section is measured at pixel scale, and the AFTER is a person looking at a
> phone. **No post-fix pixel measurement exists.**

### Block A — the first scroll after a landing did not collapse the header

**Joe, 2026-09-15:** *"you scroll down and the banner disappears, scroll up and the banner is still
there, scroll down again and THEN the banner disappears and navbar appears."* And 2026-09-16, which
named the cause: *"I can't scroll down on initial open because the DAY / All Games / List view today
is so short there's no scrolldown to perform. When I immediately shift to week and scroll down, there
is no navbar popup."*

**THE MECHANISM: an IntersectionObserver reports CROSSINGS, NOT POSITIONS.** The landing carries the
page past the sentinel while `suppressScrollCollapse()` is in force (prompt 71), so that crossing is
delivered and swallowed and the observer's state then SITS at "not intersecting". The reader's first
scroll down crosses nothing; the scroll back up re-intersects and the machine is one-way; the second
scroll down is the first real crossing. `CollapsedHeader.js`'s observer note has described exactly
this since prompt 71 and called it acceptable. Joe's ruling is that it is not.

**MEASURED IN CHROMIUM at 390×844, driving the app the way Joe does** — open on day, tap WEEK, which
is a client-side navigation and therefore a landing (a `page.goto` is a fresh document and an
ARRIVAL, which scrolls nothing under prompt 68's rule, and the first attempt at this measurement made
exactly that mistake and had to be re-run):

| | after the landing | after ONE scroll down |
|---|---|---|
| **with block A** | scrollY 1545, sentinel top **−1210**, `data-hdr` null, `data-pin` banner | `data-hdr` **collapsed**, navbar visible |
| **without it (control)** | scrollY 1545, sentinel top −1210, `data-hdr` null | `data-hdr` **still null**, no navbar — Joe's bug |

**THE SHAPE.** `installPinRelease(win, onRelease)` captures `win.scrollY` at install time and, after
releasing the pin and removing its own listener, calls back with whether the scroll was DOWNWARD.
`lib/bannerpin.js` does NOT import `collapseHeader`: that file is explicit that *"RELEASE AND COLLAPSE
ARE TWO EVENTS AT TWO MOMENTS, and conflating them is the whole hazard"*, so the policy lives in
`lib/autoscroll.js` as `pinReleaseCollapse(doc, collapse)` and collapses only when **both** the scroll
was downward **and** the sentinel is already above the viewport — the proof that the observer cannot
do this job for this scroll. While the sentinel is on screen the observer still owns the collapse, so
prompts 71 and 73 cannot regress through here, and `lib/headerstate.js`'s promise that **scroll only
ever collapses** is intact: this adds a collapse path and no expand path.

**`collapseHeader` IS PASSED BY REFERENCE, NEVER CALLED IN THE COMPONENT**, and that is not a
stylistic choice: `autoscroll.test.mjs` asserts that `AutoScroll.js`, comments stripped, contains no
call to it — prompt 71's ruling that THE LANDING never collapses the header. Injection keeps that
guard at full force (a `collapseHeader()` inside `land()` still trips it) and makes both halves of the
predicate watchable by a test.

### Block B — the wordmark is half-brightness after a tap-restore (FIXED; the mechanism is still a hypothesis)

**Two screenshots, same iPhone, same install, same minute, both on prompt 99 rev B** (723 × 1568
pixels), measured by Cowork 2026-09-16:

- **fresh open:** the status band is flat `#282828`, uniform across all 723 columns, no gradient.
- **tap-restored:** `#020202` at the top with a continuous downward fade, dying out at y≈152 of 1568
  — about **90 CSS px** from the top, so roughly 30 px BELOW iOS's own 59 px status bar.
- **below that line the two shots are identical**, delta 0.0 on every sampled row from y=150 to
  y=320. There is no banner-wide dimming; artwork, network logos and toggles are pixel-for-pixel the
  same.
- **the wordmark sits inside the feather** (glyph rows y=111–149). Tap-restored brightness as a
  fraction of fresh-open: **0.484** at the top of the capitals, then 0.560, 0.585, 0.634, 0.680,
  0.721, 0.768, 0.816, 0.863, **0.894** at the baseline, and 1.000 below y≈155. An earlier unmatched
  pair gave 92 CSS px and 0.50 → 0.88 over the same span: two independent sets agree.

**A CORRECTION TO THE FIRST READ, recorded rather than quietly dropped.** From the unmatched pair
Cowork concluded the two shots were different BUILDS, a flat grey band and a fading black band looking
like two `apple-mobile-web-app-status-bar-style` values. The matched pair disproves it: one install
produces both bands, and the treatment is STATE-DEPENDENT.

**THE HYPOTHESIS, and it is a hypothesis.** The only structural difference between the two states is
`data-pin`: fresh open has the pin armed and `.banner` resolving to `position: sticky; top: 0`, while
after a scroll the pin is released and `.banner` is `relative`. A third state agrees — `.chdr` is
unconditionally sticky at `top: 0` with opaque `--spot-2`, and Joe reports the navbar renders
correctly in every screenshot. So across three observed states, **an element holding the top edge
appears to suppress iOS 27's scroll-edge scrim, and ordinary in-flow content under the status bar
receives it.** Three consistent data points is good evidence and is NOT proof of the mechanism.

**AND THE 2026-09-16 CONFIRMATION DID NOT CHANGE THAT.** The fix works on the device, which makes a
fourth observation consistent with this explanation — a re-armed pin, and no wash. It still does not
separate this explanation from any other that predicts the same outcome. **If a later change to the
pin brings the scrim back, start here**: the mechanism was never established, so the pin is the first
suspect and not a proven cause, and the thing to get is a matched before/after pixel pair of the kind
that produced the figures above.

**THE CHANGE:** the wordmark's expand re-arms the pin — Joe's prompt-73 ruling (*"make banner STICKY
until the user scrolls"*) reaching the one entry point that never armed. `AutoScroll.js` subscribes to
the header store inside its existing effect and re-arms on a COLLAPSED → EXPANDED transition only.

**IT IS NOT THE REJECTED PERMANENT PIN, measured rather than argued.** `lib/bannerpin.js` records that
a banner which never travels would break the sentinel, the height arithmetic and the route back. In
Chromium: after the tap the pin is armed, `.banner` is `sticky` at top 0 and scrollY is 0 — and after
one scroll the pin releases, `.banner` is `relative` again and its top is −300. **It still travels.**

**THE TIMING HOLE IS REAL, AND WAS PROVEN BY BREAKING IT.** `expandHeader()` calls
`window.scrollTo(0, 0)` BEFORE `notify()`, so the offset has already moved when the subscriber runs
while its `scroll` event is still pending. With the listener installed synchronously, the browser
shows `data-pin` null and `.banner` `relative` immediately after the tap — the fix doing nothing.
Installed one animation frame later, the way `land()` does it, the pin survives.

### What this does not do

- **No headroom was added above the wordmark, and none of prompts 46/50/51's reclaimed space was
  taken back.** That is the fallback if the device says block B failed.
- **§48's pre-measured pull-up is CONTRAINDICATED** — see the line added there.
- The stale `globals.css` comments are still queued and still untouched.

### The gate that moved

`npm run test:unit` **596 → 609**: thirteen tests, four in `bannerpin.test.mjs` (the direction both
ways, the callback ordering, and the one-argument signature still working) and nine in
`autoscroll.test.mjs` (the four policy cases, the no-expand guard, the four transition cases, and the
wiring with its frame). **One existing assertion was REWRITTEN IN PLACE, not weakened:**
bannerpin.test.mjs pinned `installPinRelease(window)`, which stopped matching when the call gained its
policy argument; it now pins the whole call, which is strictly more. **Twelve mutation checks, every
one of them failing the suite** — the direction inverted, the callback dropped, the install-time
offset lost, the sentinel sign flipped, each guard dropped singly, the policy argument dropped, the
transition detector widened to every notify, the initial state not read, the frame removed, the
re-arm reordered after it, and the unsubscribe deleted.

## 51. THE CAVS OTA SIMULCAST: THE SCHEDULE LANDS, AND THE OUTLET IS PER GAME — 2026-09-16, prompt 104

**Numbered by count:** §1–§50 each appear exactly once and there was no §51.

**FOUNDATION ONLY. Nothing about how a card or a grid renders changed**, and no broadcast row is
emitted from this data: `adapters/nba.py`'s simulcast path deliberately returns nothing. Prompt 105
owns the render and the row.

### The announcement, and what it did to the schema

WOIO/WUAB announced the over-the-air Cavaliers schedule on 2026-09-15
(https://www.cleveland19.com/2026/09/15/cleveland-cavaliers-games-return-free-over-the-air-television-19-news/),
which is the gate `data/local_rights.json` had been waiting on since 2026-09-01: `expectedCount: 15`,
`games: []`, and a note saying the announcement was pending. Joe confirms it is the complete list.

**ONE `outlet` FIELD COULD NOT SAY WHAT WAS ANNOUNCED.** The package is split across two stations:

| | games |
|---|---|
| WOIO only | **9** |
| WUAB 43 only | **2** |
| both | **4** |
| **WOIO total / WUAB 43 total** | **13 / 6** |

So `outlet` moved ONTO the game: each entry is `{date, opponent, side, outlets: [...]}`. The old
package-level field is kept under `superseded` with the reason, which is how this file already
handles supersession (`nhl.CBJ`). **`side` is provenance and is NOT part of the match key.**

**WOIO IS NOT AN `access_profile.json` ENTRY AND MUST NOT BECOME ONE.** It is CBS's Cleveland station
— `data/row_order.json` says so in its own vocabulary (network CBS, station WOIO, channel 19) — so it
resolves as CBS. WUAB 43 is its own network there, and its mark already carries RESN/DAZN inside it.

**DAL, DET AND CHA EACH APPEAR TWICE.** Date plus tricode is the key; the tricode alone is not, and
`simulcast_outlets()` says so where a future edit will read it.

### All fifteen match a loaded game — which corrected a note by a factor of sixty

Verified against the database through the anon REST path: every one of the twelve opponent tricodes
resolves as `nba-XXX` in the loaded team table, and **15 of 15 entries match a loaded game** by ET
`viewing_day` + opponent id. Every home/away side agrees with the announcement, **including both
corrections Joe made to the article** — it prints "Cleveland and Phoenix" for February 14, which is
Phoenix AT Cleveland, and "Cleveland at DC", which is WAS.

The brief expected most to be unmatched, on `handoff-status.md`'s note that **"NHL and NBA hold only
date-driven partial seasons (47 and 19 games)"**. Measured: **NBA 1,206 games and NHL 1,376**, both
full seasons. That note was already wrong when prompt 87 backfilled links against 1,206 NBA rows. It
is corrected in place (rule 30).

### The two composite marks (Joe's ruling 2026-09-16, LIST VIEW ONLY)

`cbs-dazn` for the nine WOIO-only games, `cbs-wuab-43` for the four both-station games; the two
WUAB-only games use the existing `wuab-43`. **Recipes in `scripts/build_web_marks.py`, not hand-
composited PNGs and not CSS**, built from the already-conditioned published marks so they inherit
every conditioning decision rather than repeating it. Neither slug collided — checked against all 33
manifest slugs and the published filenames.

**THE HALVES ARE BALANCED BY INK AREA, NOT BY HEIGHT.** That is this file's own normalization argument
one level down: `ink_area` exists because equal heights let a wide wordmark bury a compact roundel,
which is `web/lib/marks.js`'s "NBC reads smaller than FOX". CBS is the inkiest mark in the suite.

| slug | w × h | published hf | raw (derived) hf |
|---|---|---|---|
| `cbs` | 461 × 128 | 0.758 | 0.757 |
| `dazn` | 280 × 128 | 0.964 | 0.938 |
| `wuab-43` | 174 × 128 | 1.150 | 1.252 — clamped |
| **`cbs-dazn`** | **192 × 128** | **1.150** | **1.249 — clamped** |
| **`cbs-wuab-43`** | **158 × 128** | **1.150** | **1.487 — clamped** |

**Both composites want more size than the frozen `HF_MAX` of 1.15 allows**, which is worth knowing
before prompt 105 reasons about legibility — though the LIST CARD READS NO `hf` AT ALL: it fits the
mark into a fixed CSS box (`.mnet-mark`, 56 × 40 on the phone, `object-fit: contain`), the same shape
as the rail finding in `marks.js`.

**THE SUITE DID NOT MOVE.** All 33 existing marks rebuilt **byte-identical**, and
`build_brand_marks.target()` — which recovers the frozen ink-area target from the manifest — reads
11764.455021972657 before and after, so the program marks are untouched.

### What the composites actually cost, measured rather than asserted

The risk named up front was that each half renders at roughly half its usual size. **In the list card
it is less than that, and the reason is the box:** it is 56 wide, so CBS alone is already
WIDTH-limited to 15.5px tall in it.

| | drawn in the 56 × 40 box | each half vs. the same mark alone |
|---|---|---|
| `cbs-dazn` | 56.0 × 37.3 | CBS 15.46px (**0.99×**), DAZN 20.12px (**0.79×**) |
| `cbs-wuab-43` | 49.4 × 40.0 | CBS 13.75px (**0.88×**), WUAB 43 24.06px (**0.60×**) |

**0.60× is the worst case and it is not a verdict** — rendered samples are at
`assets/p104-composite-marks/` (untracked) for Joe to look at at pixel scale.

**THERE IS NO R2 PUSH FOR THESE MARKS, AND THE BRIEF EXPECTED ONE.** It instructed the run to stop
before the push and to leave `--allow-new` unpassed, on the understanding that both composites would
be new bucket objects. Checked rather than assumed (rule 33): `web/lib/config.js:253` calls the
processed marks the ones "the app ships itself (web/public/marks), NOT the raw bucket art",
`markUrl()` returns the app-relative `/marks/{slug}.png`, and `scripts/sync_assets.py`'s `FOLDERS` is
`("logos", "network-logos", "fonts", "brand")` — `web/public/marks/` is not in it. These two PNGs are
TRACKED FILES that reach production with the Vercel deploy, so the only gate on publishing them is
the `git push` this prompt withheld. `--check` agrees: local-only is still 29, prompt 95's set, with
neither composite in it. **No sync command was run in push mode, and the §44–§45 guard was never
reached** — not because it was avoided, because it does not govern this path.

### Not filed as a prompt brief, and why

No prompt-104 text exists in `Claude outputs\`, so there is nothing to copy byte-identically.
`docs/prompts/README.md` is explicit that an invented brief filed beside real ones is worse than an
acknowledged gap, so nothing was filed and the count stands at 107 covering 01–102.

## 52. CBS MATCHES THE WIDTH BENEATH IT, WHICH OVERRIDES THE INK-AREA BALANCE — 2026-09-16, prompt 105

**Numbered by count:** §1–§51 each appear exactly once and there was no §52.

**JOE'S RULING, 2026-09-16**, having looked at the marks §51 shipped, at the real list box: *"the CBS
half is too big in both composites. Scale CBS down so its width equals the width of the mark beneath
it, and let its height follow proportionally."*

### This is an override, not a fix, and the difference is the whole entry

`stack()` balanced the halves by **ink area** — each part scaled by `sqrt(ref/area)` against the
smallest area in the stack, deliberately scaling the inkier half DOWN. That was not an oversight:
`ink_area` exists in this file precisely because equal heights let a wide wordmark bury a compact
one (`web/lib/marks.js`'s "NBC reads smaller than FOX"), and CBS is the widest, inkiest mark in the
suite. **The recipe had already anticipated this exact complaint and answered it by measurement** —
it shrank CBS to 0.787 of DAZN's height — **and Joe looked at that answer and ruled it
insufficient.** Width matching is a different governing rule. It is scoped to `COMPOSITES`; nothing
else in the suite is touched, and the overridden rule is recorded in the code rather than deleted.

### What it produced, measured

| | published | drawn in the 56 × 40 box | fits by |
|---|---|---|---|
| `cbs-dazn` **before** | 192 × 128 | **56.00 × 37.33** | width |
| `cbs-dazn` **after** | 164 × 128 | **51.25 × 40.00** | height |
| `cbs-wuab-43` **before** | 158 × 128 | **49.38 × 40.00** | height |
| `cbs-wuab-43` **after** | 118 × 128 | **36.88 × 40.00** | height |

Cowork's mock of the same recipe predicted ≈164 × 128 → ≈51.3 × 40.0 and ≈120 × 128 → ≈37.3 × 40.0.
The recipe agrees on `cbs-dazn` exactly and lands 2px narrower on `cbs-wuab-43` (118 against 120,
36.88 against 37.3). **Nothing was tuned to hit the mock.**

**"The mark beneath it" is unambiguous, checked rather than assumed:** inside `wuab-43` the
RESN/DAZN block is **174px — the mark's own full width** — and the "Cleveland's 43" row above it is
165px. So the width CBS matches is 174 for `cbs-wuab-43` and 280 for `cbs-dazn`.

**THE COST IS ACCEPTED, NOT DESIGNED AROUND.** Taller and narrower stacks mean `object-fit: contain`
fits by HEIGHT, so both lose horizontal size and `cbs-wuab-43` now fills about two-thirds of the box
width (36.88 of 56). Joe has seen it.

**`hf` moved and still clamps**, which is expected and belongs on the record: raw `cbs-dazn` 1.249 →
**1.259**, raw `cbs-wuab-43` 1.487 → **1.527**, both published at the frozen `HF_MAX` of 1.150. The
clamp is not a defect and does not reach the list card at all — that surface fits by CSS box and
reads no `hf`. `HF_MIN`/`HF_MAX` and `COMPOSITE_GAP` were left alone.

**NOTHING ELSE MOVED.** All 33 non-composite marks rebuilt **byte-identical**;
`build_brand_marks.target()` reads 11764.455021972657 before and after; the manifest is still 35
entries. The composites' rail fit changed and **both still land exactly on the 600px² target** —
30.00 × 20.00 → 27.73 × 21.64 and 27.21 × 22.05 → 23.52 × 25.51 — so `espn2` remains the only
exception and neither was excepted to make a test pass.

**Samples:** `assets/p105-composite-width-match/` (untracked) — both composites before and after at
the real box, with drawn sizes, plus 8× blow-ups.

### The follow-up this is NOT

**"Cleveland's" inside `wuab-43` does not read at any size that fits this box**, at either sizing,
and it costs a tier of height that pushes everything else smaller. If `cbs-wuab-43` reads too small
on the device, **the lever is the 43 artwork, not the stack rule.** Recorded; not acted on.

## 53. THE SIMULCAST ROWS, THE LIST COLLAPSE, AND THE THREE LANES — 2026-09-16, prompt 106

**Numbered by count:** §1–§52 each appear exactly once and there was no §53.

The render prompt §51 and §52 were foundation for. **Preemption is deliberately not here** — see the
end of the prompt-106 brief for why it changed shape; it is prompt 107.

### Joe's three rulings, 2026-09-16

**1. EVERY NETWORK AIRING A CAVS GAME SHOWS IT ON THE GRID** — the WOIO/CBS row, the WUAB 43 lane and
the RESN/DAZN lane, as applicable. A both-station game appears **three times on one grid**, and that
is deliberate rather than duplication: the grid answers "what is on this channel at this hour", and
for all three channels the answer is this game. **Measured in the browser** on 2027-03-14: the same
6:00 PM Cavaliers @ Kings block draws in `cbs`, `wuab-43` and `dazn`.

**THE SCOPE IS LOAD-BEARING.** `MobileGrid` drew one block per game via `cardBroadcast()`. A lane per
broadcast IN GENERAL would split every CFB game across ESPN and ESPN+, double the blocks on a
Saturday, and move the block and lane counts `npm run geometry` holds as HARD STOPS.
`simulcastLanes()` returns `[]` for every game but the fifteen, and the gate's figures are unchanged
after this change: cfb 64 blocks / 15 rows, mlb 3 / 2, nfl 18 / 4.

**2. THE LIST SHOWS ONE CARD PER GAME**, wearing the composite for the services present:
`dazn + cbs` → `cbs-dazn`; `dazn + wuab-43 + cbs` → `cbs-wuab-43`; `dazn + wuab-43` → `wuab-43`;
`dazn` alone → unchanged. **Derived from the game's own rows, never from `data/local_rights.json`** —
the rendering surface has no business knowing which games were hand-entered, and a test forbids both
the library and the card from naming that file.

**3. "SUPPRESS THE GREY NETWORK TEXT ON A COLLAPSED ROW" — THERE IS NO NETWORK TEXT TO SUPPRESS, AND
THIS IS THE ENTRY'S ONE REAL SURPRISE.** The brief cited `web/lib/marks.js:26`, which opened *"A
listings row shows the GREY NETWORK TEXT for every matchup, and additionally the processed mark"*.
**That sentence has been false since ruling A3 (prompt 56).** `networkText()` was deleted from
`MatchupCard.js` with that ruling; the grey line under the matchup is the VENUE, and the network name
is not on the card at all. Verified in the rendered evidence: the `.mnet-text` on the three simulcast
cards reads "Rocket Arena", "Golden 1 Center", "Rocket Arena".

**So the outcome Joe asked for is already the outcome**, and nothing was implemented for it. What was
done instead is the rule-30 correction: `marks.js`'s docstring now says what the card does, and
records that it misled this brief. **Suppressing the venue would have contradicted A3**, which is his
own earlier ruling, so it was not done. If he meant the venue line, that is a new ruling to give.

### What was built

- **`data/row_order.json` gained a CBS lane in the NBA band** — `ABC, NBC, CBS, WUAB 43`, placed
  after the national broadcasters and before WUAB 43, which is the `WOIO 19 → WUAB 43` station order
  the file's own `_ordering_note` sets. **It carries `station`/`channel`, and the WUAB entry still
  does not — a decision, not a default:** `scripts/render_day.py:1231` draws a call-letters band from
  those keys, and the CBS mark does not carry the call letters the Cleveland's 43 art does. The same
  station is spelled identically in four bands now.
- **`_simulcast_row` became `_simulcast_rows`: ONE ROW PER OUTLET.** That is the shape the callers'
  `m["outlet"]` dedupe already expected and the shape the grid needs.
- **WOIO resolves as CBS in `adapters/common.py`'s alias table**, which is where outlet spellings
  already live. The row's `service_id` is `cbs`, so the lane, the access lookup and the card's mark
  find it under one name; `outlet_access("WOIO")` now answers with CBS's access instead of UNKNOWN.
  **WOIO stays out of `data/access_profile.json`**, and a test holds it there. The label keeps the
  station: "WOIO simulcast".
- **Availability is ANY outlet, and it needed no rule.** Each row carries its own `outlet_access()`,
  so a game whose CBS row is AVAILABLE is available whatever DAZN says — the antenna case falls out
  of the data rather than out of a component.
- **`GameDetail` is NOT collapsed** (Cowork's call, stated for Joe to override): the detail view has
  room, and "which service carries this" is the actual question there.

### THE FINDING: two of the fifteen collide with a nationally exclusive row

The brief said none should, since the package is the DAZN free games, and that one which did would be
a finding. **Two do**, in the loaded data today:

| game | announced | the loaded national row |
|---|---|---|
| `nba-401910445` — 2027-01-29 TOR | WOIO | **ESPN** |
| `nba-401910691` — 2027-03-09 DET | **WOIO + WUAB 43** | **NBC** |

Both are in `NATIONAL_EXCLUSIVE`, so today **those two emit no simulcast row at all** and carry no
DAZN row either. The gate is respected as the brief instructed; whether the national selection
supersedes the OTA simulcast, or the 2027 national data is provisional and will move, is **not
decided here**. It is Joe's, and it wants a look before the season.

### Evidence, and what a passing test is not

`assets/p106-simulcast-render/` (untracked): the four list states and the three-lane grid, from the
REAL app at 390 × DPR 3. The rows came from `adapters/nba._simulcast_rows` itself, through a
**read-only proxy** that injects them into the PostgREST response on the way to the dev server — the
loader has not run, and **nothing was written to the database**.

`pytest` 612 → 619, `test:unit` 609 → 624. **Seven mutation checks, each failing the assertion that
guards it** — including one that initially did NOT: dropping the national-exclusive gate left the
whole suite green, so a guard for it was added and the mutation then failed.

## 54. THE WEEK'S STANDINGS WERE TRUNCATED AT 1,000 ROWS, AND THE CAP NOW HAS A GUARD — 2026-09-22, prompt 109

**Numbered by count:** §1–§53 each appear exactly once and there was no §54.

### The measured truncation

`standingsFor` (`web/lib/queries.js`) issued one bare `rest()` read of `team_records` filtered by team
ids and seasons, ordered `as_of.asc`. Prompt 108 measured it and prompt 109 reproduced it exactly
before touching anything:

| | day 2026-09-03 | week 2026-08-31 |
|---|---|---|
| games / unique clubs | 20 / 40 | 187 / 210 |
| rows returned | 660 | **1,000** |
| rows available | 660 | **2,820** |
| newest `as_of` seen | 2026-09-22 | 2026-09-14 |

1,820 rows dropped, and because the order was ascending the rows that fell off were the NEWEST.
`indexStandings` then faithfully picked the newest of what survived, so all forty `(team, season)`
pairs the day and week share carried an older record on the week — up to eight days older — with no
error anywhere. **This was live in production on every week view, not only in the gate.** It was
`npm run geometry`'s day/week equality that noticed (three failing checks on the ALL SPORTS case),
because the day view's 660 rows fitted under the cap and the week's did not.

### The second occurrence of a lesson already written down

`web/lib/rest.js:53-54` had carried the lesson since the Weeks picker lost a third of the season:
*"Use it for any read whose row count grows with the season — a bigger magic limit only moves the
cliff to next year."* `restAll()` existed beside it. `standingsFor` called `rest()` anyway, and the
reason is worth recording: **the read had a filter, so it looked bounded.** `team_id=in.(…)` bounds
the set of clubs; it does not bound the rows, because `team_records` keeps one row per club per day
and the filter's row count grows every night. Rule 19 gained one sentence for exactly this shape, and
the casebook's rule 19 entry carries the incident.

### The four options, and why `restAll` won

| option | verdict |
|---|---|
| **`restAll()`** — page at 1,000 until a short page | **Taken.** The repo's own prescription; correct at any row count; the week costs three round trips |
| `order=as_of.desc` alone | Rejected. Hides the truncation — the newest rows survive, the response is still short, and a club whose rows all sit past the cap loses its record silently |
| a bounded `as_of` window | Rejected. Drops the record line for any club whose newest row predates the window. NHL and NBA `team_records` are season 2025 by design (prompt 37), and the Cavaliers' over-the-air games begin 2026-10-26 with sparse early standings — it would strip records off exactly the cards prompts 104–106 built |
| a `latest_team_records` view or `distinct on` | **The eventual answer, not built here.** About 210 rows for the week instead of 2,820, but it is a migration (rule 14, S2) and is not needed to stop the bleeding. `docs/queue.md` item 10 |

**Measured after the change:** day — 1 round trip, 660 rows; week — **3 round trips, 2,820 rows**;
newest `as_of` 2026-09-22 on both; **0** pairs differ.

**The order gained two tiebreakers, and that is part of the fix rather than a flourish.** `restAll`
pages by `LIMIT`/`OFFSET`, and Postgres promises nothing about the order of ties between one page and
the next — many clubs share an `as_of`, so a paged read over `as_of` alone can return one row twice
and another not at all. `(team_id, season, as_of)` is the table's unique key (migration 0003), so
`order=as_of.asc,team_id.asc,season.asc` is total and every page is stable. The guard pins the order.

### The cap guard — so there is no third time

`web/test/restcap.test.mjs` walks **every** `rest()` and `restAll()` call in `queries.js` (comments
stripped, the enclosing function named) and requires each to be one of: `restAll()`; an explicit
`limit=` (`odds.limit=` does not count — it bounds an embed, not the response); named in **`BOUNDED`**
with a written reason that the filter cannot grow with the season; or named in **`REPORTED`**, which
is a stated list of reads already reported to Joe and awaiting a ruling. Anything else fails, with a
message that names the function and says the fix is `restAll()`, not the allowlist. **The value is in
having to write the reason** — `railmark.test.mjs`'s shape. A stale allowlist entry fails too.

Mutation-checked five ways, each failing the suite: `standingsFor` reverted to bare `rest()`; a new
unbounded call added; the tiebreakers dropped from the order; `gridIndex` removed from `REPORTED`;
and a `BOUNDED` entry naming a function that makes no call.

### The audit (block C), measured 2026-09-22 against the cap

| read | bound | rows today | of 1,000 |
|---|---|---|---|
| `gridIndex` | **none** — `generated_grids` with no filter, `generated_at.desc` | **94** | under; NOT fixed, per the brief — Joe rules |
| `gamesForDay` | one viewing day | 95 (2026-09-12, the heaviest) | under |
| `gamesForRange` | one calendar week (its only caller) | 229 (w/c 2026-09-21) | under |
| `gamesForSeasonWeek` | one (sport, season, week) | 99 (CFB week 1) | under |
| `programsForDay` | one viewing day | 6 | under |
| `rankingsFor` | team ids + season + week + poll | 25 per week; 24 of 24 on a page (prompt 108) | under |
| `standingsFor` | *was* team ids + seasons | 2,820 for the week | **over — fixed** |

`gridIndex` is the one to watch: descending order means it fails benignly (the oldest grids drop
first), but an archived day past the horizon would render as "no grid" with no error. It sits in
`REPORTED` with that measurement and this entry as its reason. The eventual fix is `restAll()` or a
filter; **that is Joe's call and this prompt did not make it.**

### The gate went green on its own (block E)

`npm run geometry` after the change, `geometry.mjs` untouched: **ALL HARD STOPS PASSED.** The ALL
SPORTS case — 14 blocks, 9 rows, widths {268, 249, 229}, `scrollWidth` 855, `widest` 87.48 — identical
on both sides. cfb 64 / 15, mlb 3 / 2 and nfl 18 / 4 unchanged; spans 1040.98, 393.54 and 830.38
minutes against pins of 1042.4, 393.4 and 830.4. **The pinned-week change proposed in the earlier
report was never needed, and would have masked a live production bug** — the gate was right and the
data it was handed was wrong.

### The corrections this commit owed (rule 30)

- **`CLAUDE.md` said day/week equality was "immune to drift, because both sides see the same standings
  on the same run." It is immune to the standings MOVING, not to one side reading fewer of them**, and
  both sides read different standings for eight days. Corrected in `CLAUDE.md` and in the Mobile
  Addendum's copy of the same sentence. **The same claim stands in `geometry.mjs`'s own comment and
  its console line, and is NOT corrected**, because the brief forbids touching that file — rule 32
  says so out loud rather than leaving it to be found. The register's earlier text is history and
  stands as written.
- **`docs/deployment-contract.md` never mentioned `db-max-rows`.** It now records the 1,000-row cap as
  a deployment property under §2.2, with `rest.js`'s prescription and the two defects it has caused,
  and a v1.0.5 change-log line.
- **Rule 19 was sharpened**, by one sentence: a filter bounds a read only when its row count cannot
  grow with the season. The old wording said "unbounded select" and this read had a filter — the rule
  as written did not obviously apply, which is exactly how it was missed.

### `AGENTS.md` came back, and `git status` was not a guard — Joe's ruling, 2026-09-22 (block F)

**Pointer, 2026-09-23 (prompt 120, §65):** "THE CAUSE, CORRECTED" below is corrected again. The file is written by the Codex desktop app's "import from Claude Code" sync, measured from Joe's `.codex` folder; it is not a stray write from another project. The test in item 3 stays and stays red while the file exists; its docstring and message now say the measured cause and tell the reader to run the script first.

**JOE'S RULING, 2026-09-22:** *`CLAUDE.md` is the only agent-instruction file this repo has, and a
reappearance of any other must be a red gate rather than a line in `git status`.*

**This amends §49; it does not contradict it.** §49 deleted the first stray `AGENTS.md` (2026-09-14)
and chose visibility as the protection: *"if it comes back it shows as `?? AGENTS.md`."* It came back
on **2026-09-16 at 23:31 UTC** (19:31 EDT) and was not noticed until **2026-09-22** — six days and
three commits later (`55b946c`, `875a50b`, `322b38f` each ran `git status` with `?? AGENTS.md` in it).
**Visibility is only a guard if someone looks**, and a stray write is exactly the case nobody is
looking for. §49's other two decisions stand: it is still deliberately NOT gitignored (an ignored file
is invisible to both the gate and the eye), and there is still no new working rule.

**THE CAUSE, CORRECTED — record this version.** Cowork first inferred from §49's precedent that a
recreated `AGENTS.md` meant Codex had been run against this repo again. **Joe corrected that on
2026-09-22: the file was Codex output generated for an entirely different project that landed in this
folder.** A stray write, not a second agent working this repo. The register does not record a
deliberate second agent, because that is not what happened.

**What it was, verified by this prompt rather than carried from §49:** untracked (`git ls-files
--error-unmatch` failed; `git log --all -- AGENTS.md` empty), **22,540 bytes**, sha256
`b5f61ffe…51a4`, and **`CLAUDE.md` with "Claude Code" replaced by "Codex" and "Claude.ai" by
"Codex.ai" — the substitution reproduces it byte for byte** (`diff` exit 0). Five mentions of Codex,
zero of Claude Code; its "Read first" table cites the register as `§1–§53`, so it was generated from
a `CLAUDE.md` that already included prompt 106. One byte larger than §49's copy, which is `§48` → `§53`
and the brief count moving.

**Why it is worth guarding even as an accident.** A divergent copy of the rules is dangerous
regardless of how it arrived: the September 14 copy had drifted two rows from `CLAUDE.md` within a day
of being written, and a rules copy includes the unwaivable stop list and the push authorization. This
is the same second-copy failure that made `docs/handoff-status.md` the only home for the gate floors
(§38). A file that arrives by accident can be read on purpose.

**What was done.**

1. **Deleted** (`rm`, proved by a directory listing — `git grep` cannot see an untracked file, §49's
   own lesson).
2. **Not gitignored**, per §49.
3. **`tests/test_agent_instruction_files.py`** — a repo-root `pytest` test, because `test:unit` runs
   from `web/` and cannot see the root. It fails when any agent-instruction file other than `CLAUDE.md`
   exists there, covering the conventions that exist today: `AGENTS.md`, `GEMINI.md`, `.cursorrules`,
   `.windsurfrules`, `.github/copilot-instructions.md`, `CONVENTIONS.md`. **Verified 2026-09-22: none
   of the six existed except `AGENTS.md`**, so it went green the moment that file was gone. A seventh
   test requires `CLAUDE.md` itself to exist, so the rule is not satisfied vacuously by a checkout
   that lost it. **The gate fired on the real file before the deletion** — run with `AGENTS.md`
   present: 1 failed, 6 passed, the message naming it at 22,540 bytes.
4. **The failure message is the deliverable.** It says what was found, that `CLAUDE.md` is the only
   agent-instruction file this repo has, that a copy of the rules is dangerous because it drifts, that
   the fix is to delete the file and find out what created it — **not** to add it to an allowlist,
   of which there is none — and that the known cause is a stray write from another project, so the
   next reader does not go hunting for an intruder.
5. **Mutation-checked six ways:** each of the six files recreated in turn, and the test failed on
   every one; removed, and it passed.

`pytest` 619 → 626 (+ 1 skipped).

## 55. THE MOBILE GRID IS A TOUCH ARTEFACT, AND THE LAST TWO DEBTS CLOSE — 2026-09-22, prompt 110

**Numbered by count:** §1–§54 each appear exactly once and there was no §55.

**JOE'S RULING, 2026-09-22:** *The mobile grid is a TOUCH artefact, not a phone artefact. Gate it on
`pointer: coarse`, in both orientations, with no width ceiling.*

### What it was decided on

Prompt 107 measured the alternative rather than arguing it (`assets/p107-tablet-grid/`, untracked):

| | mobile grid | archived PC grid |
|---|---|---|
| 820 portrait | complete, 77px of pan | **amputated** — headline, game block and every around-the-league row cut mid-line, 508px of pan |
| 1180 / 1366 landscape | complete, ~230px of empty lane to the right | 228px of pan |
| ALL SPORTS, any tablet width | works | **does not exist** — renders the "pick one above" sentence |

Every measured figure was identical at every viewport, because the grid's width derives from the
data and never from the viewport: 14 blocks, 9 rows, rail 60, lane 768.08, day span 613.95, block
widths {268, 249, 229}, shortest block 229 against the 46 floor, zero wrapped names, zero overflow,
axis pinned at every width. **The decisive fact was the PC grid, not the phone grid:** unreadable at
820, and absent at ALL SPORTS by construction (an archived render is per sport). The one-timeline
grid was the only thing on an iPad that showed every sport at all.

**The ~230px of landscape dead space is an accepted cost, not a defect.** Making the grid use the
extra width would change the geometry the Mobile Grid Addendum governs and the hard stops pin; that
is a separate decision and was not taken here.

### Block A — the band

`.mgrid-only` and `.deskgrid-only` in `web/app/globals.css` are keyed off
`@media (max-width: 699px), (pointer: coarse)`. **Both ways in stay:** a phone is narrow AND coarse,
and the 699px breakpoint is load-bearing for the rest of the file. A trackpad reports
`pointer: fine`, so desktops and touch laptops keep the archived grid — that is the intent. Still
CSS-gated, so no JS width state and no hydration mismatch.

**Measured in a browser with no override** (Playwright contexts, `hasTouch` for coarse): 820 and
1366 touch — `.mgrid-only` block, `.deskgrid-only` none, 14 visible blocks, 9 rows, no PC notice;
390 touch — the same; 1440 fine — the reverse, the PC notice visible and zero visible blocks; and
600 fine — the mobile grid, through the width rule alone. Exactly one grid at every surface.

**Pinned in `web/test/nav.test.mjs`** (the file that already counts CSS rules statically): the
condition list is read off each rule and required to be the same SET, and that set is required to
be exactly the phone breakpoint plus the coarse pointer; the two base rules are required to be
opposite. **Mutation-checked:** the coarse condition removed from `.deskgrid-only` alone fails;
removed from `.mgrid-only` alone fails. `weekgrid.test.mjs`'s existing pin on the 699px
`.deskgrid-only` rule still passes as written.

**Deliberately NOT added: a tablet viewport in `qa-shots.mjs`.** It would move a gate count, and
the static mirror test is the cheaper guard. **Named as a follow-on:** if the tablet surface ever
needs browser-level coverage — the axis pin, the pan, the dead space — the shape is prompt 107's
throwaway script promoted into `qa-shots.mjs` as a third device at 820 × 1180 with `hasTouch`.

### Block B — `gridIndex` pages

Joe's ruling: page it now. `gridIndex` reads `generated_grids` through `restAll()`, ordered
`generated_at.desc,id.desc` — the tiebreaker `newestGridFor` already used, so offset paging is
stable. One round trip today (94 rows on 2026-09-22); more only when a bare `rest()` would have
started dropping the oldest archives. **`restcap.test.mjs` now has no exception list at all.** The
`REPORTED` mechanism was REMOVED rather than kept empty: an empty exception list is an invitation,
and a read that needs one in future gets a decision written here and a `restAll()`, not a place to
wait. The file's header says so. **Test accounting, said out loud:** the *"REPORTED list is exactly
gridIndex"* test went with the mechanism (−1); a `gridIndex`-pages-with-`restAll` assertion took its
place (+1); with the nav mirror test, `test:unit` 630 → 631. Mutation-checked: `gridIndex` back to
bare `rest()` fails; the tiebreaker dropped fails.

### Block C — the last place the disproved claim stood

`web/scripts/geometry.mjs`'s comment above the day/week check no longer says the comparison is
*"COMPLETELY IMMUNE to data drift, because both sides see the same standings on the same run"*. It
says the check holds only while both sides READ the same standings, and that prompt 108 found the
week's read truncated and this check is what noticed. The sentence that followed — *"if the two
differ, the week path is handing MobileGrid different input, and that is the bug"* — was correct and
is kept. No case, baseline or check logic moved; the gate's 45 PASS lines are the same 45.

### The contract, which is the real change

**Mobile Grid Addendum v2.4:** M5 is amended from "MOBILE ONLY" to touch surfaces only, with the
scope of the addendum's deviations widened from phones to touch surfaces; "PC keeps v1.2 labels"
still holds, because a fine pointer is what PC means. The two other places in the addendum that
said phone-only are struck and corrected in place. **Rule 32, enumerated:** every live statement of
the phone-only ruling was found by searching for *phone-only*, *phone artefact* and *PC keeps v1.2*
across the repo — `globals.css` (both comments), `page.js` (two comments and the ALL SPORTS notice,
which now says "on a phone or a tablet"), `Listing.js`, `weekgrid.test.mjs`'s comment, and the
addendum three times — and each now says touch. The register's own §21-era entries that said
phone-only are history and stand as written. `docs/design/mobile_demo.html` is untouched: it
implements the grid's look, and nothing about the look changed (rule 23 does not fire).

**Rule 25's second half is open until Joe opens the app on his iPad.** Nothing in this repo can
confirm what a one-timeline grid looks like in his hands; the push is what puts it there.

## 56. THE STALE CLAUSES COME OUT, AND THE PROMPT ARCHIVE CATCHES UP — 2026-09-22, prompt 111

**Numbered by count:** §1–§55 each appear exactly once and there was no §56.

A correction, not a ruling. No code changed and no gate moved.

**The HEAD clause went stale a second time by the identical mechanism.** `docs/handoff-status.md`'s
"Repo state" opened with *"main, HEAD is prompt 101"* while HEAD was prompt 110 (`69616fe`). The block
quote beneath it records that the same clause read *"HEAD is prompt 66"* for thirty-five prompts;
prompt 101 reset it on 2026-09-16, and it was stale again nine prompts and six days later, because
every run appends its dated line below and never touches the sentence above. **Decided: the claim is
deleted, not reset** (Cowork's recommendation, taken). Resetting restarts a clock prompt 101 already
ran; the tree's position is read from `git log`, and the dated measurement lines carry the history
with their prompt numbers attached. The block quote quoting "prompt 66" is untouched — it is history.

**The push state was stated in four places and corrected from a measurement, not an inference.** Three
dated paragraphs and one live OPEN item said the tree was unpushed. Measured: a real `git fetch
origin`, then `HEAD` = `origin/main` = `69616fe`, zero commits ahead; GitHub's commit status for
`69616fe` is `success` from Vercel at 16:21:02 UTC, and the deployment is READY on production. So
prompt 110's `PUSHED` was true; the OPEN item is closed in the file's own struck style with the push
and the Vercel result, and the three dated lines are marked superseded in place rather than erased.

**The prompt archive fell eight behind.** Briefs stopped reaching `Claude outputs\` after prompt 102
on 2026-09-16 and lived only in the Project — the failure `docs/prompts/` exists to prevent, running
for six days. Cowork transcribed 103–111 into the tree; prompt 111 verified all nine by `sha256`,
`stat`, zero CR bytes and no tracked-name collision, and filed them by explicit path. **The provenance
is weaker than every other row and the README says so in those terms:** there is no second copy, so
the hashes prove the container→laptop transfer and nothing about Project→container fidelity. The
count is 116 covering 01–111, counted from the directory; 39 and 42 remain the only gaps; and the
directory count also corrected a smaller stale claim in passing — six numbers carry more than one
file (48 has since prompt 93), not five. *(Prompt 112: `docs/prompts/README.md` "Duplicate numbers"
owns that count and says five, excluding `13-14-combined` with its reason; six is the same arithmetic
with 13 counted. The handoff now points at the README instead of carrying a number.)* Rule 32 sweep for the brief count, the covered range and the
register range: `git grep` over the whole repo excluding `docs/prompts/`, `handoff-archive.md` and
`Claude outputs` found `CLAUDE.md:23` and `:26`, `handoff-status.md:13` and `:26`, and nothing in the
rendering contracts or the casebook; register entries quoting old counts are history and stand.

## 57. THE DARK-BAND LOGO CLASS IS A SURFACE ERROR, NOT A RIM-MEASURE BLIND SPOT — 2026-09-22, prompt 112

**Numbered by count:** §1–§56 each appear exactly once and there was no §57.

**A diagnosis, not a ruling. Nothing that paints a block changed, and the ruling is Joe's.**

**What Joe saw, 2026-09-22, on the device:** the Padres' mark brown on brown and the Rams' mark dark
on dark on the grid, both illegible.

**Where the grid's art comes from.** `capFor()` in `web/lib/gridmodel.js` reads `web/lib/cap-table.json`
and `MobileGrid.js`'s `capArt()` maps the row's `art` to the raw, `_dark` or `_cap` file. Neither path
the 2026-09-22 handoff proposed is involved: `team_dark_variants()` builds `_dark` files for charcoal
contexts and does not choose what a block paints, and `team_cap_art()` is reached by exactly one
team's `art: 'cap'`. Verified in the component, not carried from the brief.

**What `edge_crisp` measures, and what it is silent about.** `scripts/build_cap_table.py:17-20`: ink
within 2 device px of a non-ink pixel, the share of it clearing 1.5:1 luminance against the surface.
It says nothing about the interior mass, and `:24` makes a raw score of 1.000 unbeatable by the dark
file's 0.05 margin. Both statements are true. **Neither is why the Padres and the Rams are illegible.**

**The measurement, and it contradicts the brief's mechanism.** The table scores every logo against
`band_for(primary, secondary)["band"]`, the rule's band from the database colours; prompt 66 then made
every ruled team paint the band Joe chose in `data/grid_colors_pro.json`. For **80 of the 124 ruled
teams that is a different colour**, and the table was never re-measured. The Padres' rule band is
gold `#ffc425` — the raw file genuinely scores 1.000 there; the ruled band is brown `#2f241d`, where it
scores **0.000** and the `_dark` file 1.000. The Rams: rule band gold `#ffd100`, ruled navy `#003594`,
raw **0.000**, dark 1.000. On the painted band the table's number reproduces for **38 of 124** ruled
rows (98 of 124 on the rule's surface, the other 26 unexplained by this run), and the script's own
margin rule, run on the painted band, would flip **13 of the 94 raw-art teams** to `_dark`: Dodgers,
Padres, Rays, Reds, Royals, Twins, Yankees, Jazz, Chargers, Rams, Giants, Jets, Lightning. The
pictures agree: at 4× the Padres' and Rams' raw marks are ghost outlines and their `_dark` files read.

**The rim-only class exists too, and is smaller.** Cowork's proposed interior figures (the share of
all ink pixels clearing 1.5:1; the median ratio of the ink mass) rank the 94 raw-art teams with the
Rams first-worst and the Padres fourth — consistent with, not explanatory of, the surface error. The
teams only an interior measure catches have a bright rim and a dark body: Colts (rim 1.000, interior
29%), Guardians (1.000, 35%), Red Sox (1.000, 39%), Sabres, Brewers, Commanders, Braves, Pacers; for
those the `_dark` file scores the same, and the Blues and Flames reach neither 50% on either file, so
a swap cannot help them. The figures are a proposal, not a decided metric.

**On the "adjacent, not identical" loose end.** `capFor()`'s comment says 16 of 42 dark-art teams
were scored on a tinted surface that moved. The measurement says the surface moved under every ruled
row — flat or tinted — because the band itself moved, so the two are one mechanism at different
scopes. Cowork's brief asked for them not to be conflated; on the evidence this entry conflates them
deliberately and says so.

**What the tests pin, reported and unchanged.** `tests/test_cap_table.py` pins the table's shape, the
margin constant and the two-level rule on synthetic logos — nothing an interior measure would
contradict. `web/test/captable.test.mjs` pins the shipped table field for field against the study
fixture with two named overrides and the 170/28/84/25 counts, and `gridcolors.test.mjs` pins that
`capFor().art` is the table's `art` for every ruled team; **a regeneration against the ruled band
would move both**, and that is the cost of option (b) below, not a reason against it.

**No fix was chosen.** Queue item 11 lays out the four shapes — a per-team re-ruling, a regeneration
against the ruled band, an interior measure in the build, new art or a band change — and Joe rules
from `assets/p112-dark-band-logos/`'s pictures. Nothing in `build_cap_table.py`, `cap-table.json`,
`grid_colors_pro.json`, `logo_conditioning.json`, the tests or any logo file was touched.

## 58. THE CAP TABLE IS SCORED AGAINST THE BAND THAT ACTUALLY PAINTS — 2026-09-22, prompt 113

**Numbered by count:** §1–§57 each appear exactly once and there was no §58.

**JOE'S RULING, 2026-09-22: option (b) of queue item 11.** Regenerate `web/lib/cap-table.json` so that
every ruled team's art is chosen against the band it actually paints. §57 is the diagnosis; this is
the implementation, and nothing broader.

**The implementation, and why `decide()` was the wrong vehicle.** `scripts/build_cap_table.py` reads
`data/grid_colors_pro.json`; a team listed there goes through a new `decide_ruled()`, which scores the
raw and `_dark` files on that band, **flat**, writes `tint: 1.0`, and applies the unchanged 0.05 margin
rule to those two flat scores. `decide()` was not reused because it picks the art on the TINTED
surface whenever the best flat score is under 0.85 — and `capFor()` never paints a tinted cap for a
ruled team, so that surface does not exist for them. Run through `decide()` the 76ers flip to dark on
a surface nobody paints, which is the stale-surface error prompt 68 corrected by hand. Unruled teams
keep `band_for()` + `decide()` exactly as before; the ruled/unruled split lives in one function,
`row_for()`, and `tests/test_cap_table.py` pins both branches with the same synthetic files.
`LUM_CRISP`, `FLAT_MIN`, `DARK_MARGIN` and `CAP_TINT` are untouched.

**The regeneration** used `--teams-csv` fed from `web/test/fixtures/team-colours.json` — **the colours
are the 2026-09-04 SELECT**, re-read from the fixture, because the database path needs the writer
credential rule 14 forbids a session to use. The fixture itself was rewritten with a fresh `_generated`
and restored with `git checkout --`, because that timestamp would have claimed a pull that never
happened. A scratch regeneration reproduces the tracked table's `teams` exactly.

**The change table, verified against Cowork's numbers before the build changed:**

| class | rows | what |
|---|---|---|
| raw → dark | **13** | Reds, Royals, Dodgers, Padres, Rays, Twins, Yankees, Jazz, Rams, Giants (NY), Jets, Chargers, Lightning — the visible fix; on the ruled band raw scores 0.000 for eight of them and the `_dark` file 0.94–1.000 |
| dark → raw, files tie | **24** | the two files are byte-identical in `assets/logos/` **and as served from R2** (24 of 24 checked by sha256 over the public URL), so the scores tie exactly and the rule's tie goes to raw; no pixel changes |
| dark → raw, files differ | **1** | the Rockets (`nba-HOU`): both files score 1.000 on black and the tie goes to raw. **A visible change Joe did not see when he ruled**; pictured, and it follows the rule unless he says otherwise at review |
| tint label only | **27** | ruled rows at `0.72` become `1.0`; `capFor()` already forced this at runtime, so nothing paints differently |
| `mlb-137` | 1 | the Giants' `art: 'cap'`, hand-set in `b98a696`, is now produced by the build's `CAP_ART_OVERRIDES` and scored from the `_cap` file itself on the ruled band (1.000); the `nba-PHI` override is gone because on the flat band raw scores 0.599 against dark's 0.005 and the build chooses raw unaided |

**Seven UNRULED rows moved, the run stopped, and Joe ruled: keep them.** The brief said an unruled row
moving meant a logo file had changed after 2026-09-04, and it had: no unruled raw file postdates the
table, but **83 unruled `_dark` files do** (the 2026-09-07 rebuild and the 2026-09-08
`logo_conditioning.json` ruling), and for seven the new file changes the answer — Oklahoma St (`197`,
dark/1.0 → raw/0.72, its `_dark` now a byte copy of raw under `skip_derive`), Nicholls (`2447`), N
Arizona (`2464`), James Madison (`256`), Tarleton St (`2627`), Tulane (`2655`) and Texas St (`326`), all
raw → dark on their rebuilt files. The table describes the files that exist; the seven are declared
with date and cause in `captable.test.mjs`'s `FILE_CHANGED` and in the build's
`FILE_CHANGED_SINCE_STUDY`, and a declared row that stops differing from the study fails both. The
acceptance now pins the unruled rows at **104 / 17 / 54 / 11** (the study said 105 / 14 / 58 / 9 over
the same 186).

**Point 5, tested:** of the 26 rows whose table score reproduced on neither surface, 24 are dark-art
rows whose `_dark` file is a byte copy of raw today — the file the score described no longer exists —
and the other two are hand-set rows carrying the score of the file they replaced (the Giants,
`b98a696`; the 76ers, prompt 68). Nothing is left unexplained.

**The tests moved on purpose and none was loosened.** `captable.test.mjs`'s study match is restricted
to the 186 unruled ids (the study scored on `band_for()`'s band and cannot describe a ruled row), and a
new test pins the 124 ruled rows against the regenerated table: every tint 1, art 106 raw / 17 dark /
1 cap, the Giants cap, the Padres and Rams dark. **`renderInk()` now takes tint and art from the study
fixture row, not the live table** — the regeneration moved 46 of the 307 study teams' tint, and the
helper's own comment says a later ruling must not rewrite the study's counts; 191/116, 56/20/33 and the
26 stay exactly where they were measured. `gridcolors.test.mjs`'s assertion still holds and its
"chosen against the tinted surface" comment is corrected. `tests/test_cap_table.py` gains six: the
ruled branch takes the dark file its band needs where `band_for()` would refuse it; a ruled team is
never tinted; an unruled team keeps the two-level rule; the cap override is applied by the build and
scored on the ruled band; the override table names the Giants and nothing else; a missing ruled file
rules nobody. **Mutation-checked six ways, each going red:** `renderInk()` pointed back at
`table.teams`; a file-changed row left undeclared; a declared row set to the study's values; the
Padres set back to raw in the table; the ruled branch reverted in `row_for()`; the `--check`
acceptance with a declaration that matches the study.

**Rule 23, which the original brief said did not apply.** `docs/design/mobile_demo.html` embeds its
own `CAPTABLE`, read by `capOf`, which forces `t:1` for a ruled team exactly as `capFor()` does; twelve
of the 38 art changes are in it and those twelve rows now match the regenerated table (`mlb-110`,
`-113`, `-118`, `-119`, `-121`, `-133`, `-135`, `-136`, `-139`, `-142`, `-146`, `-147`). Nothing else in
the reference changed; none of the seven unruled ids is in it.

**The pictures, which are what Joe rules from** (`assets/p113-cap-regen/`, untracked): the 14 visible
ruled changes and the 7 unruled ones before and after, at true grid size and at 4×, on the surface
each paints; the Rams beside the Padres, both after — the Rams' `_dark` reads but is a lighter blue on
navy, softer than the Padres' white on brown; and two of the 24 ties rendered before and after,
pixel-identical by byte comparison (`nba-CLE`, `mlb-110`). **Not pushed:** Joe reviews the 21 pairs
first, and the push is his.

### Joe's review of the 21 pairs — 2026-09-22, prompt 113 rev C (same ruling, six pins)

Joe reviewed every before/after pair at 4× and **kept the old rendering for six rows; the other
fifteen stand as regenerated, the Rams and the Rockets included** — both had been flagged for him and
he accepted them as they are. The six are rulings from the pictures, not scores, and the build never
re-derives them: `scripts/build_cap_table.py`'s `REVIEW_PINS` applies them after scoring, with the
reason *"Joe's review of the p113 sheets, 2026-09-22: keeps the pre-113 rendering"*, and writes the
pinned art's own `edge_crisp` on the pinned surface so the number stays honest. The `--check`
acceptance scores each pinned team WITHOUT its pin and fails if the answer no longer differs, so a
pin that has stopped holding anything is reported rather than left to sit.

| id | team | regenerated | pinned |
|---|---|---|---|
| `197` | Oklahoma St | raw / 0.72 | **dark / 1.0** |
| `2447` | Nicholls | dark / 1.0 | **raw / 0.72** |
| `2464` | N Arizona | dark / 1.0 | **raw / 0.72** |
| `2627` | Tarleton St | dark / 1.0 | **raw / 1.0** |
| `2655` | Tulane | dark / 0.72 | **raw / 0.72** |
| `nfl-24` | Chargers | dark / 1.0 | **raw / 1.0** |

**Oklahoma State, resolved.** Rev B's report said its cap "moves from the flat band to its 0.72 tint
with the same art" and the id list said `dark/1.0 → raw/0.72`; both were true at once. `197.png` and
`197_dark.png` are byte-identical (`skip_derive`, 2026-09-08), so the art label flipped while the
pixels moved only with the tint — and the current `197_dark.png` IS the file the left panel was drawn
from. The pin is `dark / 1.0`, which reproduces that panel exactly; nothing was substituted.

**The Chargers' tint was never what painted.** The pre-113 row said `raw / 0.72`, but the Chargers are
ruled and `capFor()` paints a ruled band untinted whatever the table says, so the app always drew
raw on the flat band. The pin is `art: raw, tint: 1.0`; only the art is the ruling. The rev B sheet
drew the left panel on the flat band (its renderer ignores a ruled row's tint, as `capFor()` does),
so the panel Joe approved is what ships; it was re-rendered from the pinned row anyway.

**The five college pins left `FILE_CHANGED` / `FILE_CHANGED_SINCE_STUDY`** (James Madison and Texas
St remain there): pinned back to the pre-113 rendering they match the study again, so they are
declared once, as pins, for the reason that actually holds them. The unruled acceptance moves from
104 / 17 / 54 / 11 to **105 / 15 / 56 / 10** — 197 back to 1.0-dark (+1 flat dark, −1 tint raw), 2447
and 2464 to 0.72-raw (−2 flat dark, +2 tint raw), 2627 to 1.0-raw (−1 flat dark, +1 flat raw), 2655
to 0.72-raw (−1 tint dark, +1 tint raw) — and the ruled split from 106 / 17 / 1 to 107 / 16 / 1. The
study-ink counts did not move. Regenerated against `e9d5ccd` the change table is exactly these six
rows; the pinned caps rendered from the shipped rows are pixel-identical to the original left panels
(`assets/p113-cap-regen/pins/`). The four rev B omissions, confirmed: the R2 byte-compare ran in rev B
(24 of 24 served pairs identical, `verify_changes.json`); the two spot checks are `nba-CLE` and
`mlb-110`; §1–§57 each appeared exactly once before §58 was written and still do; the handoff and the
README carry 113, and rev B and rev C are now filed beside it.

## 59. THE iPAD'S TOP EDGE GETS HEADROOM BELOW THE SCRIM — 2026-09-23, prompt 114

**Numbered by count:** §1–§58 each appear exactly once and there was no §59.

**What Joe saw, 2026-09-22, on a 2021 iPad Pro 12.9" (iPadOS 27, standalone, landscape):** the
collapsed navbar and the tap-restored banner sit under iOS 27's scroll-edge scrim. Measured by Cowork
from his three shots (2732 × 2048, DPR 2): the navbar wordmark reads at **0.29–0.57** of banner gold
top to bottom, the restored banner's wordmark at 0.55 → 1.00 against the fresh open, and the date
picker beneath the navbar is untouched. The phone is clean on the same build.

**The iPad contradicts §50's hypothesis.** §50 Block B shipped on the premise that an element holding
the top edge suppresses the scrim. `.chdr` holds the edge with an opaque `--spot-2` ground and is
scrimmed regardless. **The mechanism is unknown, is recorded as unknown, and this fix does not
depend on it:** whatever arms the scrim, it is a feather about 36 px deep anchored to the web view's
top edge, and ink placed below it cannot be dimmed by it.

**The web view starts 32 CSS px below the screen top, with `env(safe-area-inset-top)` = 0 — INFERRED,
not read from the device, from two fits that only agree on that geometry.** In shot 2 the navbar's
hairline is the row at y = 75.0 and `.chdr-inner` is 44 px border-box, so the row spans 32.0–76.0. In
shot 1 the desktop wordmark's first ink is at y = 45.0; the 1400 × 200 SVG scales 0.9757 at 1366, the
title baseline is 51.76 at 55 px (`banner-desktop-v2.json`), bold caps top out at 708/1000, so the
first ink sits 12.51 CSS px below the SVG's top, which is therefore at 32.5. If the web view started
at 0 with a 32 px inset, the banner's padding (32 + 4 − 14 = 22) would put its ink at 34.5, 21 device
px off. Only "web view at 32, inset 0" fits both. The status-bar band (0–31) is flat `#272727`, the
page's own top colour sampled by iOS, so `black` does not give the iPad an opaque black bar the way
it gives the phone one — but the web view still starts below it. **The feather is 36–40 px deep
inside the web view:** shot 1 minus shot 3 on empty ground, 1.09 gray at y = 64, 0.49 at 66, 0.07 at
68, 0.01 at 70, 0.00 from 72; the navbar's opaque ground reaches flat at 67. The navbar wordmark's
first ink sat 14 px into the web view, the banner wordmark's 12.5 — both inside the feather.

**The shape chosen: headroom scoped to the tablet, and the opaque strip rejected.** Under `black` the
page's highest paintable row IS the web view's top edge, and `.chdr` already paints opaque there — and
is scrimmed. Reaching above it means `black-translucent`, which reverses prompt 99 (iOS 27 composites
the blur above the web view) and cannot be scoped to tablets, being one install-time meta tag. So:
`--ipad-top-clear: 32px`, spent as a `::before` spacer inside `.chdr` (not padding: the inset token
count nav.test.mjs pins stays at three, and the spacer sits inside the border box so the border-box
`--stack-h` observer carries it into the picker's offset with no arithmetic) and as `padding-top` on
`.bn-pc`, the element that shows at ≥ 700 px. **32, not 24:** 22–24 is the minimum that clears both
wordmarks; 32 puts first ink 44–46 px in, 4–10 px clear of where the difference reaches zero. The
band under the banner's padding shows `.banner`'s gradient, whose first stop is the stage's
`#272727`; measured at DPR 2 the seam steps by 1/255, so the band was not repainted. **What it costs,
plainly:** a 32 px dark band above the navbar and the banner on the iPad in every state, fresh open
included — the navbar 44 → 76 px, about 3% of a 992 px landscape web view. **The phone's "no headroom"
ruling (prompt 102, §50) stands**, and §48's pull-up stays contraindicated: it moves ink UP, into a
feather deeper than the phone's.

**The scope condition, and why it is not prompt 110's.** `(pointer: coarse)` alone matches the phone;
`(min-width: 700px)` with it still matches an iPhone in landscape (932 × 430). The block is
`(min-width: 700px) and (min-height: 600px) and (pointer: coarse)`, which matches the iPad in both
orientations and excludes both phone orientations and the desktop — measured in Chromium at all five,
and Chromium matches `pointer: coarse` under `hasTouch: true` (with or without `isMobile`), so the
geometry is provable in a gate. Not gated on `display-mode: standalone`: Chromium cannot match it,
and the only cost outside the installed app is 32 px of ground in an iPad Safari tab.

**Measured in Chromium, before → after** (`assets/p114-ipad-scrim/`): at 1366 × 1024 coarse, spacer
0 → 32, `.chdr` 44 → 76, `.chdr-inner` top 0 → 32, `--stack-h` 44 → 76, picker top 44 → 76, `.bn-pc`
padding and SVG top 0 → 32, banner wordmark ink and navbar wordmark ink both +32 (the navbar's gold
rows begin at CSS 13.5 → 45.5). At 1024 × 1366 the same +32 on every row (its picker sits 8 px under
the bar for a reason older than this change, 52 → 84). At 390 × 844, 932 × 430 and 1440 × 900:
**zero change on every row**, and the phone's 23 qa-shots PNGs are byte-identical before and after.
The collapse still does not move the first card on the iPad, and the wordmark tap still re-arms the
pin. **Chromium has no scrim: these prove geometry and nothing about legibility.** The acceptance is
Cowork's, from Joe's shots off a preview build; the predictions are the navbar hairline at screen
y ≈ 107, the navbar wordmark's first ink at ≈ 78, the banner wordmark's at ≈ 77, every wordmark row
≥ 0.98 of its reference. If the positions come in elsewhere, the 32 px inference was wrong, and that
finding matters as much as the fix.

**Comment-only elsewhere, proved:** with comments stripped and the token and block removed, the
stylesheet is identical to `ec99819`'s (blank lines where comments were aside), and the delimiters
balance 265/265. The three stale comments corrected: "FIXED, NOT STICKY" (prompt 58's text, sticky
since 62), "`.chdr` stays FIXED", and three dead line references in the navbar's inset note.

## 60. THE PLACEHOLDER RULE WIDENS TO MLB'S POSTSEASON SEEDS — 2026-09-23, prompt 114 rev B

**Numbered by count:** §1–§59 each appear exactly once and there was no §60.

**JOE'S RULING, 2026-09-23: widen the placeholder rule. Do not rule colours for these ids.** The
seven are not teams: MLB replaces them with real clubs as the seeds clinch, then adds new placeholders
for each later round, so a colour ruling per placeholder id would go stale every week of October.

**What went red.** `smoke.mjs`'s *"the only unruled pro rows are TBD placeholders"* required every
unruled pro id to end in `-TBD`. The 2026-09-23 08:00Z refresh (`schedule_refresh` run 35834681015)
loaded seven MLB rows that do not — `mlb-4614` "AL #3 Seed", `mlb-4617` "NL #3 Seed", `mlb-4619`
"NL Wild Card #1", `mlb-4944` "AL Wild Card #2", `mlb-4945` "NL Wild Card #2", `mlb-4946` "AL Wild
Card #3", `mlb-4947` "NL Wild Card #3" — null colours, MLB abbreviations (`AL3`, `NLWC1`…), carried
by four 2026-09-29 Wild Card games: `mlb-849843` (NL WC1 v NL WC2), `mlb-849845` (NL #3 v NL WC3),
`mlb-849849` (AL #3 v AL WC3) and `mlb-849851` (Yankees v AL WC2). Prompt 114's gate run found it;
Cowork confirmed the rows by a read-only SELECT. The only other non-CFB placeholder row is `nba-TBD`.

**The predicate.** `web/lib/placeholders.js` exports `isPlaceholderTeam(team)`: true when the id
ends in `-TBD` (the rule that stood alone), or when `sport === 'mlb'` and `canonical_name` matches
`/^(AL|NL) (#\d+ Seed|Wild Card #\d+)$/`. **The pattern is narrow on purpose:** it covers the two
forms MLB has actually published, and a later round's placeholder with a different name — a Division
Series winner, say — is MEANT to turn the smoke check red so that someone looks at it and widens the
pattern by a ruling. Nothing guesses at forms MLB has not published. `smoke.mjs` reads
`canonical_name` in its teams select, applies the predicate, keeps the check's label, and its detail
now names every row it exempted and why (`suffix` or `mlb-pattern`) and any unruled row that is not
a placeholder, so a green run still shows the reader the seven.

**Pinned in `web/test/placeholders.test.mjs`** (8): the seven names pass with the `mlb` sport and
`nba-TBD` by the suffix; `Cleveland Guardians`, `AL #3 Seeds`, `AL Wild Card` with no number,
`ALDS Winner A`, the name on a non-MLB sport, the id `mlb-TBDX` and a missing row all fail; and
`smoke.mjs` imports the predicate, carries the name in its select and no longer tests the suffix
itself. **Mutation-checked six ways, each red then restored:** the sport guard dropped; the `^`
anchor dropped; the `$` anchor dropped; `#\d+` widened to `.*`; the suffix branch removed; and
`smoke.mjs` pointed back at `endsWith('-TBD')`, which the unit pin catches AND the live smoke
(32/33) catches.

**How the four games render today, reported and not fixed:** see the run report and
`assets/p114-ipad-scrim/placeholders-0929/`. Whatever they show is Joe's next decision; 2026-09-29
is six days out.

**2026-09-28 — JOE'S RULING: THE SERIES-WINNER FORM IS IN (prompt 123's gate run).** The Division
Series rows loaded with sides named `mlb-5528` "AL 3/6 Winner", `mlb-5529` "AL 4/5 Winner", `mlb-5532`
"NL 3/6 Winner" and `mlb-5533` "NL 4/5 Winner", carried by six games on 2026-10-03 and 10-04, and
smoke went red on them (32/33), as this section intended and `docs/queue.md` item 12 predicted. Joe
widened the pattern to that form as published:
`/^(AL|NL) (#\d+ Seed|Wild Card #\d+|\d+\/\d+ Winner)$/`, the winner of the series between seeds N and
M. Pinned in `web/test/placeholders.test.mjs` (+2): the four names pass as `mlb-pattern`, and `AL 3/6
Winners`, `AL 3-6 Winner`, lower-case `winner`, a missing seed, `AL Winner`, `ALCS 1/4 Winner`, both
anchors and a non-MLB sport all fail. `ALDS Winner A` still fails; its message now says why. Two
mutations, each red then restored: dropping the new alternative, and loosening the seeds to `.*`.
The four sides render the TBD badge through `TeamMark`, since the same predicate decides it. **The LCS
and World Series rows will arrive in a form nobody has seen yet**, and are meant to turn the check red
in their turn.

**2026-10-05 — JOE'S RULING: THE HIGHER/LOWER-SEED FORM IS IN (prompt 127's gate run).** The League
Championship Series rows loaded with sides named `mlb-5517` "NL Higher Seed" and `mlb-5525` "NL Lower
Seed", and smoke went red on them (33/34), as item 12 of `docs/queue.md` predicted. Joe ruled the form
in as published, the same way as the Wild Card and Division Series forms:
`/^(AL|NL) (#\d+ Seed|Wild Card #\d+|\d+\/\d+ Winner|Higher Seed|Lower Seed)$/`. Pinned in
`web/test/placeholders.test.mjs` (+2): both names, and the AL spelling of each, pass as
`mlb-pattern`; `NL Higher Seeds`, lower-case `higher seed`, `Highest` and `Middle`, a missing `Seed`,
`NLCS Higher Seed`, both anchors and a non-MLB sport all fail. Two mutations, each red then restored:
dropping the new alternative, and loosening it to any word before `Seed`. `smoke.mjs`'s comment,
which still said "two forms", now names all four. **The World Series form is not guessed**, by
Joe's instruction: it is meant to turn the check red in its turn.

## 61. POSTSEASON GAMES TAKE THEIR REAL TEAMS, AND PLACEHOLDERS SHOW A TBD BADGE — 2026-09-23, prompt 116

**Numbered by count:** §1–§60 each appear exactly once and there was no §61.

**The loader gap.** `pipeline/load.py`'s games upsert updated `season, week, neutral_site` on conflict
and nothing else, so `home_team_id` and `away_team_id` were written ONCE, at the row's first insert,
and never again — nothing else in `pipeline/`, `adapters/`, `scripts/` or the migrations writes them.
`docs/research/mlb-adapter-brief.md` §7.4 said that once MLB fills in the participants "the same
`gamePk` rows update in place"; that was true of the kickoff and the broadcasts, which are
observations the reconciler re-decides every run, and **false of the teams**. When MLB replaces "AL
Wild Card #2" with a club, `adapters/mlb.py`'s `side()` emits the new id and the loader dropped it.
Four 2026-09-29 Wild Card games carry the placeholders today (`mlb-849843`, `-849845`, `-849849`,
`-849851` at the Yankees); the seeds clinch after Sunday 2026-09-27, and the first refresh after that
is 2026-09-28 07:37 UTC — the deadline this shipped against.

**The fix.** The two team columns join the update list, PRESERVED (`coalesce(excluded.c, games.c)`):
a real id lands, placeholder or club; a null — the source gave no id — keeps the stored value rather
than erasing it. The loader reads the stored pair before it writes and logs every flip to the run's
notes as `"<gid>: home <old> -> <new>"` (`refresh_runs.notes.team_changes`), counted under
`team_changes`, so a change is visible in the ledger and never silent. **What a `None` side did
before:** `str(None)` — the stub loop upserted a TEAM with id `"None"` and the game referenced it.
That never happened in production (no such row exists), and it cannot now: a side with no id is
skipped in the stub loop, noted under `team_missing`, and a NEW game with a missing side is skipped
rather than inserted. The adapter is the authority on who plays in a given external game id, as it
already was for every other identity field it emits. Nine tests in `tests/test_postseason_teams.py`
run the two-step load (placeholder, then club) through a DB that remembers its upserts; mutation-
checked five ways, each red: each team column dropped from the update list, the note dropped, the
`None` guard dropped (three tests fail), the new-game skip dropped.

**The badge — Joe's ruling, 2026-09-23: a grey "TBD" badge, in the same box as the logo it replaces,
so names stay aligned with every other card.** A placeholder id has no logo on R2, and every one of
the five team-mark sites — the list row, the slot's favoured mark, the detail panel's two, the grid
endcap — drew the browser's broken-image icon for it. `web/components/TeamMark.js` renders the badge
when `isPlaceholderTeam` (register §60's predicate, with the game's `sport` passed in because the
embed does not carry it) says so, and the `<img>` otherwise; every site goes through it, and a test
forbids a bare team-mark `<img>` in those three files. Fill `--spot-0`, text `--dim`, Barlow
Condensed 700, sized by one rule per box it stands in (20 / 44 / 34 px, and 78% of the endcap).

**The error fallback, and why it exists.** The name pattern is narrow on purpose (§60), so a later
round's placeholder — a Division Series winner — will miss it and still have no logo. So the `<img>`
swaps to the badge on `onError`, and on mount when `img.complete && img.naturalWidth === 0`: a
server-rendered image that errored BEFORE hydration has no handler attached when it fails, and
without the mount check the broken icon would stay. Verified in Chromium on a cold load with the
Yankees' logo made to 404: the badge shows and no broken image is painted (qa-shots, +3). The
locked reference draws no placeholder team and is unchanged.

**Out of scope, deliberately:** `reconcile.py`, the kickoff and broadcast paths, every adapter, and
the seven placeholder rows in `teams`, which stay.

---

## 62. SUNDAY'S CBS AND FOX GAMES ARE DECIDED BY WHAT WOIO AND WJW ACTUALLY AIR — 2026-09-23, prompt 117

**Numbered by count:** §1–§61 each appear exactly once and there was no §62.

**The mechanism, and why it never resolved.** A CBS or FOX Sunday-afternoon NFL game is a REGIONAL
feed: the network sends several games at once and each affiliate picks one, so "on CBS" says nothing
about what a viewer in Cleveland gets. `adapters/espn.py` knew this since spec §3.12 — it marked every
CBS/FOX TV row `regional` and looked up `data/market_coverage_nfl.json` for a `cleveland: true|false`
entry, hand-entered weekly from 506sports' maps. That entry was made once, for week 1, as "not yet
checked", and never again: the file's whole history is one empty week. So every CBS and FOX game
without a Browns side has sat `UNVERIFIED`, shown with the "Market TBD" cue (E5, §11.8), every week
of the season — and Joe's report of 2026-09-23 ("ALL Sunday NFL broadcasts appear as visible to me
on FOX or CBS - even though they're determined by local DMA") is E5 doing exactly what §11.8 rules:
an unverified game is SHOWN, never filtered, and the cue is the honesty. The mechanism was working.
The data it waited for was a weekly chore nobody did, and a chore is not a source.

**Joe's source ruling.** The stations' own listings answer the question the maps answer — and one the
maps cannot: "WJW carries no late game today." Schedules Direct, the Gracenote guide feed licensed for
personal open-source use (US$35 a year; JSON API 20141201, ~20 days of US listings), is the source.
Its terms allow "individual use only and exclusively to Open Source software"; this repository is
public, so the terms are met. `adapters/sd_listings.py` is the client: token (the password as a
lowercase SHA-1 digest), the over-the-air lineup for the postal code chosen from `/headends` and
added to the account ONCE only if absent (the API allows six adds a day), station ids looked up at
run time by callsign from `data/markets.json` `nfl.affiliates` (`{"CBS": "WOIO", "FOX": "WJW"}`),
`/schedules` for yesterday through today + 13 and `/programs` for every program id once, written to
one JSON keyed by callsign. **The postal code and the lineup id appear in no log line, output,
fixture or committed file** — the client redacts both, longest first, and refuses to write an output
that carries either; Joe's postal code is a personal identifier. Credentials are `SD_USERNAME`,
`SD_PASSWORD`, `SD_POSTAL_CODE`, from the environment only. **A failure never fails the refresh:**
missing secrets, a 4xx or 5xx, a timeout — one line, no file, exit 0, and the NFL step behaves as it
did before the step existed. The adapters' `http_json` gained `method` and `data` so a JSON POST rides
the same bounded retry rather than a second helper growing beside the first.

**The six rules.** A CBS or FOX TV row is decided by the FIRST that applies, and `source` names it:

1. **Kickoff outside Sunday 12:00–17:00 ET → `AVAILABLE`, `market: national`, `"national window"`.**
   Thanksgiving, Christmas, a December Saturday, a London morning, Sunday night: all national, all
   were coming out `UNVERIFIED` because the regional rule fired on the network name alone. Independent
   of the listings, which is why a Thanksgiving CBS game with no listings file resolves.
2. **A hand entry in `data/market_coverage_nfl.json` wins.** The file is now a manual override, and
   its `_about` says so; an entry beats a listing that disagrees.
3. **A Browns game → `AVAILABLE`, `"market: local team"`.** Unchanged.
4. **The affiliate has an NFL-game airing within ±30 minutes of kickoff.** The same two teams, matched
   on NICKNAME (Rams/Chargers and Giants/Jets share a city; `at`, `vs.` and `@` all accepted) →
   `AVAILABLE`, `"listings: WJW 2026-09-27 1:00 PM"`. A different game → `OUT_OF_MARKET`, naming what
   the station carries. A game airing with no team names → `UNVERIFIED`.
5. **Listings exist for the station and date, and no game airing sits in the window → `OUT_OF_MARKET`,
   `"listings: WJW carries no game in this window"`.** This is the case no coverage map can state: on
   2026-09-27 WJW airs the Panthers at the Browns at 1:00, the FOX postgame at 4:00 and *Doc* at 4:30.
   There is no FOX late game in Cleveland that day, and the grid now says so.
6. **Otherwise `UNVERIFIED`**, exactly as before — the listings failed, or do not reach the date.

**Why the order is what it is.** The window test comes first because it is a fact about the telecast,
not the market, and needs no data. The hand entry comes before the listings because it is the only
thing Joe can set by hand when a listing is wrong, and an override that loses to the thing it
overrides is not one. The Browns rule sits third only because a hand entry for a Browns game is a
deliberate act.

**Proven, and not.** Thirty-one offline tests (`tests/test_sd_listings.py`, `tests/test_nfl_market_rules.py`)
drive the real client against fixtures in the API docs' shape — the real WJW sequence above, WOIO
carrying Cincinnati at Pittsburgh, one "NFL Football" with no episode title — and the real fixture
builder with a scoreboard payload in ESPN's shape. Six mutations each go red: the ±30-minute bound
dropped, matching on city, rule 1 removed, rule 5 removed, rules 2 and 4 swapped, the client exiting
non-zero on a 5xx. A guard fails any test that reaches `http_json`, so no live call is possible from
the suite. **Unproven until the secrets exist and the workflow runs:** the live API's exact response
shapes (the fixtures follow the docs, not a captured response), whether a bodiless `PUT` is accepted
by the lineup add, and whether the program metadata carries `eventDetails.teams` for NFL games or
only the episode title. `docs/handoff-status.md` carries the OPEN item: Joe adds the three secrets,
dispatches the workflow, and Cowork reads week 4's (2026-10-04) CBS/FOX statuses.

**E5 stands.** An `UNVERIFIED` game is still shown with its cue and never filtered; what changed is
how many games stay `UNVERIFIED` once the listings reach the date — in a normal week, none.

**Out of scope, deliberately:** the display and the E5 cue; NBC, ESPN, ABC, Prime and Netflix rows,
which are national and already `AVAILABLE`; every other sport; any database write outside the
nightly refresh.

---

## 63. THE FREE SOURCE DECIDES CLEVELAND'S CBS AND FOX WINDOWS, AND SCHEDULES DIRECT STAYS DORMANT — 2026-09-23, prompt 118

**Numbered by count:** §1–§62 each appear exactly once and there was no §63.

**Joe's ruling: no paid data.** Joe did not buy Schedules Direct and will not. The US$35 a year was
never his decision — Cowork folded the cost into a source choice in prompt 117's brief instead of
putting it to him separately, and that was Cowork's error. §62's mechanism is unchanged and its client
stays in the tree, **dormant**: without the three `SD_*` secrets the step already writes nothing and
the NFL step behaves as if it did not exist. If Joe ever buys it, it is the stronger source and it
wins when present (rules 4 and 5 run before 4b below). Nothing was removed.

**Why the free guides are out.** TV Passport's terms of service forbid *"any data mining, data
gathering, scraping or extraction method"* and storing their content in any database
(tvpassport.com/tos); the other free guides carry the same shape of term. A source whose terms forbid
the read is not a source, whatever its data.

**The source: EntitledSports' weekly coverage pages.**
`entitledsports.com/schedule/nfl/coverage-map/week-<N>/` names, for each of the 210 markets, the game
in each of the four Sunday-afternoon windows — **CBS Early, FOX Early, CBS Late, FOX Late** — with the
market's station: WOIO 19 (CBS) and WJW 8 (FOX) for Cleveland–Akron (Canton). Its robots.txt (read
2026-09-23) disallows `/api/`, `/v1/`, `/details/`, `/metadata/`, `/hub/`, `/coverage/`,
`/conferences/` and `/regular-season-`, and does **not** disallow `/schedule/`; `/terms` is a 404, so
there are no terms to read. **It is unofficial.** It names no source, the late windows often stay TBD
until midweek (week 3 read 2026-09-23: CBS Early CIN @ PIT, FOX Early CAR @ CLE, both late windows
TBD; week 4 all four TBD), and a redesign breaks the reader. **Every one of those limits fails safe:**
a window the reader cannot decide is TBD, and TBD falls through to `UNVERIFIED` — E5's "Market TBD",
which stands. The reader (`adapters/es_windows.py`) sends an honest User-Agent naming the project,
fetches at most two pages a run — the NFL week containing today (Eastern) and the next — and parses
only the Cleveland block, measured against the live markup: one `<details class="mkd">` per market,
four `<div class="mw">` rows each labelled by window, the game as `AAA Nick @ HHH Nick` or `TBD`. Any
other text is recorded verbatim, becomes TBD, and is noted in the output; nothing is guessed. A page
with no Cleveland block or fewer than four windows is a failure. **Corrected by §64:** this section
first said "a failure of any kind is one log line, no file, exit 0", and the run built exactly that -
one `try` around both weeks, so a next-week page that did not exist cost the current week its
windows. Since prompt 119 each week's page stands alone; only every week failing writes no file. **The week number comes from ESPN's own calendar** — `leagues[0].calendar` on
the scoreboard payload the ESPN adapter already fetches, whose regular-season entries carry `value`,
`startDate` and `endDate` (captured in `tests/fixtures/espn_nfl_scoreboard_raw.json`) — so it is the
same number `adapters/espn.py` writes on every game; the test pins the calendar's number to the
events' number on the captured payload. The committed fixtures are the Cleveland block and the stamp
row only, hand-trimmed; the page itself is not copied into a public repository.

**Rule 4b, and the precedence.** `decide_regional` gains one rule and nothing else in the order
changes: (1) national window; (2) hand entry; (3) Browns; (4–5) the station listings, **which win when
present**; **(4b) the EntitledSports window for the game's week** — the row's window is *early* when
the kickoff is before 3:00 PM ET, *late* otherwise; the same two teams by nickname (the same
`_names_match`, so the Los Angeles and New York pairs resolve) is `AVAILABLE`, named teams that differ
are `OUT_OF_MARKET`, and TBD, an unrecognized marker or no file falls through; (6) `UNVERIFIED`, whose
source now says neither source decided the game. The source string reads
`entitledsports week 3 (updated Wed Sep 23 5:30 AM ET): WOIO CBS early CIN @ PIT`. Proven offline:
week 3's CBS early is the Bengals at the Steelers and every other CBS early game is out; the late
windows and all of week 4 fall through; the cut at 1:00, 2:59, 3:00, 4:05 and 4:25; the two-team
cities; listings beat windows and a hand entry beats both; a garbled block, three windows, an HTTP
500 and a missing block each write nothing and exit 0. Five mutations each go red: the cut moved,
matching by city, TBD deciding `OUT_OF_MARKET`, the four-window check dropped, windows ahead of
listings. The one live call of the run was the Block A fetch of weeks 3 and 4 the fixtures come from;
the suite's guard against reaching the HTTP helper stays.

**What the refresh does next.** The workflow's windows step runs after the dormant listings step and
before the NFL step, with no secret, and the rule applies on the next scheduled run (07:37 or 11:37
UTC). Joe decides any dispatch. If the site goes stale or changes shape the grid falls back to Market
TBD and the options are Joe's (`docs/queue.md` item 13): a hand entry, or buying Schedules Direct.

**Corrected by §66 (prompt 123): "decides" was true of `game_broadcasts`, and until prompt 123 not of
the app.** Rule 4b rewrote a row's `access_status` in place; the broadcast observation's value
(`service|market|certainty`) did not change, so the reconciler never re-judged the game, and
`viewer_game_eligibility` — what the app reads — kept the verdict computed on 2026-09-05. On Sunday
2026-09-27 every CBS/FOX game this rule had decided still showed "Market TBD". Since prompt 123 the
default reconcile re-decides eligibility for every game whose broadcast rows moved.

**Out of scope, deliberately:** the display and E5; removing any Schedules Direct code; every other
sport; any database write outside the refresh.

---

## 64. EACH WEEK'S PAGE STANDS ALONE, AND PLAYOFF GAMES ARE NATIONAL — 2026-09-23, prompt 119

**Numbered by count:** §1–§63 each appear exactly once and there was no §64.

**Ruling 1 — each week's page is judged on its own.** Prompt 118's report flagged that a failed
next-week fetch suppressed the current week too: `build(weeks, …)` and the week list sat in one `try`,
so any exception wrote no file. Cowork's brief had asked for exactly that ("a failure of any kind")
and it was wrong for this case — in the season's last regular week the next page does not exist, and
a rule that fails safe for one week must not fail the other. Now `adapters/es_windows.py` fetches
and parses each week independently: a week that fails (an HTTP error, a missing Cleveland block,
fewer than four windows) is left out with one note naming the week and the reason —
`week 4: left out (RuntimeError: HTTP 404 …)` — the file is written whenever at least one week
succeeds, and no file is written only when every week fails, which is what the run did before. The
log line names each week's result: `week 3 2 of 4 windows named; week 4 failed (RuntimeError)`.
Prompt 118's test that pinned "a 404 on the next page writes nothing" is **replaced**, not kept
beside the new one, because it asserted the behaviour this ruling reverses; four tests take its
place (the next week 404ing, the current week failing, both failing, and a bad week's note beside a
good week's silence). §63 is corrected in place where it described the all-or-nothing write.

**Ruling 2 — NFL playoff games are national.** Rule 1, `sunday_afternoon_window`, looks only at day
and hour, so a Wild Card, Divisional or Conference Championship game on CBS or FOX on a Sunday
afternoon fell into the regional rules and would have shown "Market TBD". Every playoff game airs
nationally. `decide_regional` now returns national for any postseason game **before any other
rule** — rule 0 — so a hand entry cannot override it either; the source reads
`"national window (postseason)"`.

**Corrected by §66 (prompt 123): both rulings reach `game_broadcasts`; before prompt 123, a change to a
row that was already there did not reach the app.** Ruling 1's windows re-decide rows the grid has
held since the schedule loaded, and the new access never reached `viewer_game_eligibility` (§66:
Sunday 2026-09-27 showed "Market TBD" on games decided by Thursday). Ruling 2 was not affected in
practice: a playoff game is new when it first loads, and a new game is reconciled in full, eligibility
included. A playoff row that changed access after that first load would have had the same gap.

**How the adapter knows a game is postseason — measured, not assumed.** Three candidates were
named and the tree was checked for each. (a) **The event's own `season.type`**: present on every
event in the committed fixture (`tests/fixtures/espn_nfl_scoreboard_raw.json`, all `type: 2`,
slug `regular-season`), and on the live scoreboard fetched through the adapter's own
`fetch_scoreboard("nfl", date=…)` for the 2026-01-11 Wild Card Sunday every event carries
`{"year": 2025, "type": 3, "slug": "post-season"}`, while the 2026-01-04 week 18 Sunday carries
`type: 2`. (b) **`leagues[0].season.type`** describes the league's phase at the time of the call, not
the game: the committed fixture's regular-season events sit under a league season typed Preseason,
and the January date fetched today reads "Regular Season". Not evidence about the game. (c) **The
`season_type` parameter of `fetch_scoreboard`** is only sent with `--week` (`espn.py:247-248`); a
`--date` fetch sends no season type at all, and the January call proves ESPN then returns whatever is
played that day, playoff games included. So `is_postseason(ev)` reads the event's `season.type == 3`
and nothing else, and the call site passes it per event. **The date-based refresh therefore does
load playoff games today** — nothing in `build_nfl_fixture` or `pipeline/load.py` filters by season
type — but it loads them with ESPN's postseason `week.number`, which restarts at 1 for the Wild Card
round, and with `competition_context` left at the table default `REGULAR`. That is `docs/queue.md`
item 14, not this prompt: the fetch is unchanged by ruling.

**Proven offline:** a postseason CBS game at Sunday 1:00 PM ET is `AVAILABLE`, national; a
postseason FOX game at 4:30 PM ET is the same with a hand entry saying `cleveland: false`; a
regular-season game at both times is unchanged; the predicate reads `3` and `"3"` and nothing else.
Three mutations each go red: the `try` put back around both weeks, the postseason check dropped, the
check moved after rule 2.

**The pre-check, recorded.** The brief's pre-check failed: an untracked `AGENTS.md` (23,462 bytes,
mtime 2026-09-23 12:26:17 EDT, sha256 `b923b2d7…6b46`) sat in the repo root — `CLAUDE.md` at `5dc2087`
with "Claude Code" → "Codex" and "Claude.ai" → "Codex.ai", nothing unique, the third arrival of the
file §49 and its 2026-09-22 amendment describe. `tests/test_agent_instruction_files.py` fired on it,
as the amendment intended. This session was not permitted to delete it, so the work was completed
and the commit held for Joe; whether the deletion happened is in the run's report, not here.

**Out of scope, deliberately:** loading playoff games any differently (queue item 14); the display;
every other sport.

## 65. THE CODEX COPY OF `CLAUDE.md` IS IDENTIFIED BY ITS CAUSE AND REMOVED ON SIGHT — 2026-09-23, prompt 120

**Numbered by count:** §1–§64 each appear exactly once and there was no §65.

**JOE'S RULING, 2026-09-23:** *keep Codex's import of his Claude Code conversations, and stop
`AGENTS.md` from blocking runs. Claude Code handles it on its own.*

**The cause, measured — this corrects §54 block F's "cause, corrected".** Cowork read Joe's
`C:\Users\jlull\.codex` folder on 2026-09-23 (read-only, granted for the purpose) and the tree at
`3938a57`. The stray root `AGENTS.md` (§49, §54 block F, §64's pre-check) is written by **the Codex
desktop app's "import from Claude Code" sync**. It is not a second agent working this repo (§49's
first inference) and not a stray write from another project (§54's correction, which this test's
docstring carried from prompt 109 until this prompt).

- **The setting is on for every item.** `.codex\config.toml`, under `[desktop]`, carries
  `external-agent-import-sync-enabled = true` and `external-agent-import-sync-item-types = "all"`. The
  app's persisted state (`.codex-global-state.json`, key `external-agent-import-sync-state`) records
  provider `claude-code` with `projects: true, chats: true`, plus plugin migration.
- **`AGENTS.md` is one of the item types it imports.** The app-server binary,
  `.codex\plugins\.plugin-appserver\codex.exe`, lists the migration item types as `AGENTS_MD, CONFIG,
  SKILLS, PLUGINS, MCP_SERVER_CONFIG, SUBAGENTS, HOOKS, COMMANDS, MEMORY, SESSIONS`.
- **The timing matches.** Codex's log (`logs_2.sqlite`, covering 2026-09-14 20:00 UTC to 2026-09-23)
  records `externalAgentConfig/import` runs at 2026-09-17 23:47, 2026-09-20 01:34 and **2026-09-23
  16:26:17 UTC**; the copy §64 found was created at 16:26 UTC that day, the same minute. The first
  arrival (§49) was written at 2026-09-14 20:00:15 UTC, two minutes after the app's `.desktop-created`
  marker (19:58:19 UTC), which is its first-run import.
- **The 2026-09-16 arrival is unexplained.** No import in the retained log matches it. It is recorded
  as unexplained, not as explained.
- **The 09-17 and 09-20 imports wrote no new file**, presumably because a copy already stood there
  (from 09-16 until 09-22). Consistent, but inferred, and recorded as such.
- **What each copy is.** `CLAUDE.md` as it stood when the import ran, with `Claude Code` → `Codex` and
  `Claude.ai` → `Codex.ai` and nothing else — §49 measured the first against `d6cd7b2`, §54 the second,
  and prompt 119's report measured the third against `5dc2087`.

**What was built.**

1. **`scripts/remove_codex_agents_md.py`.** When a root `AGENTS.md` exists it compares the file, byte
   for byte with no line-ending normalisation, against the Codex rewrite of every `CLAUDE.md` in the
   last 50 commits that touched it (`git log -50 --format=%H -- CLAUDE.md`, then `git show
   <sha>:CLAUDE.md`; 48 commits reach back to `61469b6`, the file's creation) and of the working-tree
   `CLAUDE.md`. Identical to one of them: deleted, with one line naming the matching commit, the size,
   sha256, mtime and line endings, exit 0. Identical to none: **kept**, the nearest candidate named
   and the diff printed, exit 1 — anything in that file that is not `CLAUDE.md` is unknown, and unknown
   files are Joe's to judge. No file: exit 0, silent. The deletion is `os.remove` inside the script and
   never a bare `rm`, so the permission classifier sees one named, repeatable command. **This run had
   no `AGENTS.md` to remove** (Joe deleted the third copy by hand before prompt 119's commit), so the
   script's first live run was the silent exit 0; the classifier did not refuse it.
2. **Working rule 35's amendment** in `CLAUDE.md`, Joe's standing authorization: *"A root `AGENTS.md`
   that `scripts/remove_codex_agents_md.py` verifies as the Codex desktop app's copy of `CLAUDE.md` is
   removed by running that script before the gates; Joe authorized this 2026-09-23 (register §65). An
   `AGENTS.md` the script does not verify is a stop."* It sits under rule 35 because that is the rule
   governing what a run cleans up before its gates, and the brief did not name a rule.
3. **`tests/test_agent_instruction_files.py` is not weakened.** It stays red while the file exists;
   no allowlist, no gitignore (§49 stands). Its docstring's and failure message's "known cause" now
   say the measured cause above and tell the reader to run the script first.
4. **`tests/test_remove_codex_agents_md.py`** (9), each in its own temp git repo with four commits of
   `CLAUDE.md` written and committed as LF under `core.autocrlf=false`: an exact rewrite of the current
   `CLAUDE.md` deleted, naming HEAD; an exact rewrite of the copy three commits back deleted, naming
   that commit; a rewrite of an uncommitted working-tree edit deleted; one extra line kept, exit 1, the
   nearest candidate named and the line shown; a rewrite that missed the `Claude.ai` swap kept, exit 1;
   no file exit 0 and silent; a CRLF copy of an LF `CLAUDE.md` kept and reported as CRLF; the rewrite
   is both swaps; and `CLAUDE.md` carries the authorization line. **Four mutations each red:** compare
   against the working tree only (the three-back copy is kept and the nearest candidate is misnamed,
   3 failed); skip the `Claude.ai` swap (the missed-swap copy is deleted, and the rewrite predicate
   itself, 2 failed — the exact-copy tests build their file through the same function, so they follow
   the mutation, which is why the missed-swap case exists); delete on mismatch (3 failed); exit 0 on
   mismatch (3 failed).

**Out of scope, deliberately.** Anything outside the repo, including everything under `.codex`:
stopping the import at its source is a setting in Joe's Codex app, the only value Cowork observed for
the item-types key is `"all"`, and a guessed value in another app's config is not a fix. Removing any
other foreign instruction file: the other five names in the guard stay as they are.

**§65 addendum, 2026-09-25 — THE REWRITE HAS A THIRD SWAP, `CLAUDE.md` → `AGENTS.md`, AND IT WAS
INVISIBLE UNTIL `CLAUDE.md` NAMED ITSELF.** The copy that arrived 2026-09-24 00:26 EDT (23,770 bytes,
sha256 `dc313359…a37e`) was kept by the script and stopped prompt 122's commit: it differed from the
two-swap rewrite of `CLAUDE.md` at `ab5e4f4` on one line, 191, rule 35's own amendment, where "copy of
`CLAUDE.md`" read "copy of `AGENTS.md`". **Measured:** the file is byte-identical to `ab5e4f4`'s
`CLAUDE.md` with `Claude Code` → `Codex`, `Claude.ai` → `Codex.ai` **and** `CLAUDE.md` → `AGENTS.md`;
the literal `CLAUDE.md` occurs once in `ab5e4f4` and **zero times in the other 48 commits of
`CLAUDE.md`, back to its creation**, so the three copies that defined the rewrite (§49, §54, §64)
could not have shown it. The line that authorized the cleanup is
the line that defeated it.

**JOE'S RULING, 2026-09-25:** teach the checker the third swap rather than remove this one copy by
hand. `codex_rewrite` now applies it last; no earlier `CLAUDE.md` changes verdict, since none contains
the string. The script stays fail-safe in the direction that matters: a wrong model keeps a file, and
it can only delete one byte-identical to a `CLAUDE.md` this repo has had. Its fixture `CLAUDE.md` now
names itself, the swap test pins the literal `ab5e4f4` line, and a copy that skipped the third swap is
kept (10 tests, from 9). Mutation-checked: dropping the swap fails those two, and the exact-copy tests
stay green because they build their file through the same function — the literal line is the pin.
Run after the fix, the script removed the copy, naming `ab5e4f4`, under rule 35's standing
authorization.

## 66. A CHANGE IN WHO CAN WATCH A GAME REACHES THE APP, NOT ONLY THE DATABASE — 2026-09-28, prompt 123

**Numbered by count:** §1–§65 each appear exactly once and there was no §66. Prompt 123's brief asked
for §67 on the expectation that prompt 121 (the Worker documentation) would take §66 first; 121 has not
run, so this is §66 by the brief's own fallback. **121's brief names §66, so its run takes the next
free number.**

**Joe's report, 2026-09-28:** *"The TV listings for NFL yesterday never rectified. They showed 'Market
TBD' all day."* That was Sunday 2026-09-27, and prompts 118 and 119 (§63, §64) had decided those games
by Thursday.

**What was measured.** Cowork read the database through the connector (SELECT only); prompt 123 re-read
it through PostgREST with the publishable anon key on 2026-09-28, after the refresh dispatched at 08:01
UTC (run 36394887115).

- **`game_broadcasts` was right.** Of the 13 CBS/FOX rows on 2026-09-27: 3 `available` (Bengals @
  Steelers CBS, Panthers @ Browns FOX, Ravens @ Cowboys CBS), 8 `out_of_market`, 2 `unverified` (the
  two FOX late games).
- **`viewer_game_eligibility`, which the app reads, was not.** All 14 NFL rows for the day carried
  `computed_at` 2026-09-05 18:26:01 UTC. Twelve read `not receivable: cbs=unverified` or
  `fox=unverified` with `market_pending = true`, which is the "Market TBD" cue (`isMarketPending`,
  `web/lib/offservice.js:40-44`). The Browns row had been eligible since 09-05 by the local-team rule,
  and the fourteenth is NBC's Sunday night game.
- **Across sports**, for games within ±7 days, the rows older than 3 days were NFL 33 of 33, MLB 85 of
  109, NHL 75 of 94 and CFB 130 of 130 (Cowork's read: 128).

**The mechanism.** `pipeline/reconcile.py` writes eligibility only for the games `read_input` selects.
The refresh runs default mode, whose set is `CHANGED_WHERE`: games with an observation newer than their
last canonical decision. `pipeline/load.py` writes the broadcast observation as
`service|market|certainty`, with no access in it. When rule 4b turned a row from `unverified` into
`available` or `out_of_market`, the loader updated `game_broadcasts.access_status` in place, and
`observe()` saw the same claim again: a repeat sighting, which bumps `last_seen_at` and supersedes
nothing. The game never entered the changed set, and its eligibility stayed at its first value. The
`local_carriage` observation does carry access, but only when the source names `market_coverage` or
`market:` (rules 2 and 3). Rules 4, 4b, 5 and 6 write none. **Stale is not the same as wrong.** Of the
802 games whose broadcast rows had been seen after their verdict was computed, re-running the same
ladder over all of them changes 14, every one NFL. Ten are on 2026-09-27: Bengals @ Steelers and
Ravens @ Cowboys become `linear cbs`, and eight become `out_of_market`. Four are on 2026-10-04: one
becomes `linear fox` and three `out_of_market`. The mechanism affects every sport; this season, the
measured damage was all NFL.

**The fix: an eligibility pass for every game whose access may have moved (Cowork's option 1).**
Before any write, default mode now also reads every game that has a `game_broadcasts` row seen after
its eligibility's `computed_at`, or that has no eligibility row at all. For each one the canonical pass
did not already reconcile, it re-decides **eligibility and nothing else**. The verdict comes from the
same `telecast_verdict()`, run against the canonical state and network the last decision stored. It is
written by the same `write_eligibility()`, lifted out of `reconcile_game()` so both paths write the row
the same way. No canonical decision is made and the games row is not touched. `CHANGED_WHERE` is
unchanged and still decides kickoff and network alone. The selection names no sport. `--all` and
`--game` read no extra set, because every game they select is reconciled in full. Each changed verdict
is logged (`ELIGIBILITY <game>: <old> -> <new>`), and `refresh_runs.notes` counts `eligibility_only`
and `eligibility_changes`.

**Why this and not option 2**, putting access into the observation's value:

- Eligibility depends on `game_broadcasts` and the rules, not on canonical evidence. Option 2 would
  make every access change re-decide the canonical fields, which turns `CHANGED_WHERE`'s purpose
  inside out.
- It would supersede every broadcast observation in every sport once. That rewrites evidence history
  to carry a judgment about Cleveland, which the loader deliberately keeps apart from the feed's claim
  (that is the `local_carriage` split).
- Its backfill reaches only the games a load touches, so a stale row outside the fixture window would
  stay stale.

Option 1 changes no evidence, and it repairs whatever the table shows is stale.

**The cost, measured.** The 2026-09-28 08:01 UTC load touched the broadcast rows of 168 games (CFB 72,
NHL 34, MLB 32, NFL 30). That is under the 237 games `reconcile.py` records as acceptable for a full
pass. Each costs one upsert, plus a map lookup only when a row is `unverified`. A full reconcile costs
two decision inserts, a games update and a broadcast update.

**The backfill needs no hand DML.** The first refresh after deploy, scheduled or dispatched, selects
every stale row in the table, whenever its game was loaded. Read on 2026-09-28 against the rows as the
08:01 refresh left them: **802 rows rewritten** (CFB 332, MLB 326, NHL 81, NFL 63) and **14 verdicts
changed**, all NFL, as listed above. The load that runs before the reconcile will move both figures a
little: it re-stamps the games it touches and can decide new windows. So they are a forecast, and the
run's `eligibility_only` and `eligibility_changes` counters give the actual numbers. `market_coverage`
returned zero rows to the anon key, so the forecast treats every `unverified` row as unmapped. That is
what the reconciler finds if the table is empty.

**Proven offline** by `tests/test_eligibility_follows_access.py` (10 tests). The real `load_fixture`
and `reconcile.main()` run against an in-memory SQLite that executes the statements they issue.

- A CBS row loaded `unverified` and reconciled is Market TBD. It is then loaded `available` with an
  identical observation value, and the test pins that premise: one broadcast observation, seen twice,
  nothing superseded, and the game absent from `CHANGED_WHERE`'s set. Reconciled again, it is
  `eligible`, not pending, `linear cbs`, with a fresh `computed_at`.
- The `out_of_market` twin is decided, not pending.
- No canonical decision is written, and the games row is untouched.
- The log names the change.
- An MLB FOX row resolves the same way.
- A game the load did not touch keeps its row.
- A new game is written once, not twice.
- `--all` and `--game` read no extra set.

**Four mutations each go red:** removing the pass (6 tests fail), dropping the staleness term so only a
missing verdict counts (7), restricting the selection to NFL in SQL (2), and restricting it to NFL in
Python (1).

**The guard is queued, not built.** The smoke check would fail any game in the next 7 days whose
`computed_at` is more than 26 hours older than its newest broadcast `last_seen_at`. On live data it
would be red until the first refresh after this push, and `CLAUDE.md` forbids committing over a red
gate. Measured on 2026-09-28: **34 games fail it (NHL 18, NFL 16)**, out of 86 with broadcast rows
among the 135 games on 2026-09-28 to 2026-10-04. It is `docs/queue.md` item 16, to be added once a
production run has confirmed fresh rows.

**Corrected in place:** §63's and §64's "decides" described `game_broadcasts`, and until this prompt
not the app.

**Out of scope, deliberately:** the display and E5; the FOX late-window TBD question; prompt 121; any
hand DML.

## 67. THE TBD-BADGE CHECK READS FIXTURE ROWS, NOT THE POSTSEASON STANDINGS — 2026-09-29, prompt 124

**Numbered by count:** §1–§66 each appear exactly once and there was no §67. Prompt 121 has still not
run. Its brief names §66, so its run takes the next free number, which is §68 unless something else
lands first.

**The finding** (Cowork, 2026-09-28). `qa-shots`' TBD-badge check (prompt 116, §61) loaded live
postseason rows and needed placeholder sides on a named day. It moved twice in five days:

- `cards === 4 && badges === 7` went red on 2026-09-25, when the Braves clinched a seed. Joe's call:
  count the sides found, and require at least one.
- "At least one on 2026-09-29" went red on 2026-09-28, when every Wild Card side resolved. Joe's call,
  in prompt 123's gate run: move it to 2026-10-03.

The 2026-10-03 Division Series sides resolve when the Wild Card series finish, by 2026-10-01. From
then on, every run would have stopped on an app doing what it should. The Yankees' 404 check had the
same dependence on a real game existing that day. From today, the only placeholder rows in the
database are six NBA Cup knockout games with `nba-TBD` sides (December) and the Division Series rows,
and neither lasts.

**The fixture.** `web/app/qa/tbd/page.js` is a dev-only page built the way `app/qa/programs/page.js`
is. Its first line is `notFound()` when `NODE_ENV === 'production'`. It renders the real `Listing`,
and through it `MatchupCard` and `TeamMark`, with fixture rows. It runs them through the same
`chronological()` and `splitHidden()` that Today's day mode uses, and passes the props Today passes
for `/?day=…&sport=mlb` in LIST view.

- **The rows have `gamesForDay()`'s output shape** (`lib/queries.js:88-90`: `GAME_SELECT` plus
  `ODDS_NEWEST`). They were copied key for key from a live response for 2026-10-03 (`mlb-849829`), not
  written from the select string.
- They live in `web/app/qa/tbd/fixture.js`, a plain module beside the page, so a unit test can read
  them. The brief named only the page; the module is the one file added beyond it.
- **There are five games:**
  - the three MLB name forms `lib/placeholders.js` recognizes, one side each, as their real rows:
    `mlb-4944` "AL Wild Card #2", `mlb-4617` "NL #3 Seed" and `mlb-5528` "AL 3/6 Winner";
  - an `mlb-TBD` side, on the home side;
  - a real club on every card;
  - the Red Sox at the Yankees, whose logo `qa-shots` makes 404.
- Every game is watchable, so `splitHidden()` hides none of them.

**The check now counts exactly.** `qa-shots` loads `/qa/tbd` and asserts:

- 5 cards and 4 placeholder sides, all 4 badged;
- 5 clubs painting a real logo;
- 5 badges on the page: the four placeholders and the Yankees;
- no broken image;
- the badge's 20px box and neutral tokens.

These are the same three assertions as before, so there are still 145 and the floor does not move.
The placeholder names are typed into `qa-shots` by hand rather than imported from the fixture, because
the count is the check, and a list derived from the fixture would shrink with it.

**One thing was added, because without it two of the brief's four mutations could not go red.** Every
placeholder id's logo 404s on R2 (measured 2026-09-29). So a placeholder the predicate *missed* would
still get a badge, from the error path, and a badge count cannot tell the two apart. The check
therefore records every logo request the page makes, and fails if:

- any placeholder side requested a logo, since the predicate decides from the row before any request
  is made (`TeamMark.js:12-13`); or
- any of the six clubs' logos was not requested, so a recorder that saw nothing fails instead of
  passing.

**Mutation-checked through full `qa-shots` runs, each red and then restored byte for byte:**

- **The `N/M Winner` form deleted from `lib/placeholders.js`:** 144/145. All four sides were still
  badged. Only the request record caught it (`/logos/mlb-5528_dark.png`).
- **`TeamMark` made to ignore `isPlaceholderTeam`:** 144/145. All four placeholder logos were
  requested, and all four sides were still badged, by the error path.
- **The Yankees' 404 route dropped:** 144/145. No Yankees badge, and 4 badges on the page instead of 5.
- **One fixture side removed** (the NL #3 Seed card): 143/145. 4 cards, 3 sides, and 5 of 6 club logos.

The first two are the reason for the request record: a badge count alone stays green on both.

**`web/test/qatbd.test.mjs` (5 tests)** checks the rows themselves:

- every row's keys, embeds included, equal `GAME_SELECT`'s as parsed from `queries.js`; an invented
  `home_team_id` fails it;
- the fixture covers each of the three forms once, plus the suffix, with a placeholder on each side;
- every card has a real club, and the Yankees sit beside one;
- Today's filters hide no fixture game;
- both qa pages have the production guard as the component's first line.

**Unreachable in production, and confirmed without a local `next build`** (rule 12 rules one out
here). Block A was pushed ahead of this section so the production build could be read. Three checks:

- **The route was built.** The Vercel build log for `22a1b30` (`dpl_9zERacj4jRQ7eYEE1YzJuUimGGqW`)
  lists `├ ƒ /qa/tbd` in Next's route table, beside `├ ƒ /qa/programs`.
- **The build is live.** `my-sports-xi.vercel.app` resolved to that deployment, target production,
  READY.
- **Production refuses both pages.** It answered `/` 200, `/qa/programs` 404 and `/qa/tbd` 404, and the
  `/qa/tbd` body carried none of the fixture.

So the page exists in the build and the guard is what refuses it. Before the push, `/qa/tbd` also
answered 404, but only because the route did not exist yet.

**Why smoke's placeholder guard stays live.** Smoke reads live `teams` rows on purpose (§60). Its job
is to catch a placeholder name form nobody has ruled on, and only the database can deliver one. The
badge check's job is to prove the component, and a fixture does that better. Until this prompt they
were one question; now they are two. The LCS round will still turn smoke red, as queue item 12 says.

**Closed:** `docs/queue.md` item 15, with a dated pointer here.

**Out of scope, deliberately:** smoke and queue item 12; queue item 16; every other `qa-shots` block.

## 68. THE REFRESH'S REAL TRIGGER IS DOCUMENTED, AND THE REPO IS PUBLIC — 2026-09-29, prompt 121 rev B

**Numbered by count:** §1–§67 each appear exactly once and there was no §68. Prompt 121's first brief
(2026-09-23, revised 2026-09-28) named §66; prompts 123 and 124 took §66 and §67 while it waited, and
rev B expected this number.

**The trigger, measured with `gh` on 2026-09-29.** `gh run list --workflow schedule_refresh.yml --limit
60` found:

- A `workflow_dispatch` was created every day from 2026-09-17 (run #28) to 2026-09-29 (#66), thirteen
  in all, between 08:00:10 and 08:01:20 UTC. That is 4:00 a.m. EDT.
- `gh api …/actions/runs/<id>` on two of them, #28 and #62, gave `event` `workflow_dispatch`, and
  `triggering_actor` and `actor` `MindLane-NorthStar`.
- No dispatch was created at 09:00 UTC on any day.
- The two crons (`schedule_refresh.yml`, 07:37 and 11:37 UTC) produced `schedule` runs created between
  12:02 and 18:43 UTC. That is §46's lateness, unchanged.
- So from 2026-09-17 the refresh ran at least three times a day, and on 09-23, 09-28 and 09-29 a manual
  dispatch made a fourth.

**This confirms Cowork's section 1, with two corrections:**

- The latest 08:00 creation time is 08:01:20 (#56), not 08:01:26.
- The latest cron run was created at 18:43 (#65, 09-28), not 17:10.

**The Worker, as Cowork recorded it on 2026-09-22.** None of this is visible from the repo, and none of
it was re-measured here, because this brief rules out any Cloudflare call.

- It is Joe's Cloudflare Worker, in his personal Cloudflare account, which is not the account that
  holds R2.
- Its cron is `0 8,9 * * *` UTC, and the handler reads the Cleveland clock and dispatches only when it
  is 4 a.m. there. So it fires once a day at 4 a.m. Eastern, year round, with no edit at the
  daylight-saving change. The measured absence of any 09:00 UTC dispatch during EDT is consistent with
  that guard.
- It has two secrets. `GITHUB_TOKEN` is a fine-grained personal access token scoped to this repo, with
  Actions read and write. `TEST_KEY` guards a manual-test endpoint that dispatches on demand.
- Its source is not version-controlled.

Its URL, which is also that endpoint, and its account are deliberately not recorded, because the repo
is public. **Joe to supply: the token's expiry date.** The token is the one failure this repo cannot
see: an expired token means no run is ever created, so there is nothing to go red.

**Rev A's daylight-saving error.** The 2026-09-23 brief, as revised on 2026-09-28, said an 08:00 UTC
trigger "fires at 3:00 AM EST after 2026-11-01". That is true of a bare cron and false of this Worker:
the `0 8,9` pair plus the Cleveland-clock guard is exactly what keeps it at 4 a.m. It was not written.
2026-11-01 is the guard's first real test: the dispatch should move to 09:00 UTC (an OPEN item in
`docs/handoff-status.md`).

**The minutes ran out, and that is why the repo went public.** The account's 2,000 included Actions
minutes ran out on 2026-09-28 at about 19:01 UTC. Measured with `gh` job timings:

- Run #65 (`schedule`, created 18:43): its refresh job succeeded (18:43:05–19:01:07), so that
  afternoon's data did load. Its render job then failed at 19:01:07–19:01:10 without starting a step.
- Run #66 (the 09-29 4 a.m. dispatch) and #67 (`schedule`, created 14:18) each failed their refresh job
  within five seconds of creation, with no step run, and their render jobs were skipped.
- The app's data was frozen from about 3 p.m. ET on 09-28 until Joe's manual run #68 (15:24–15:43 UTC
  on 09-29, success).
- #69 (`schedule`, created 17:00) succeeded too.

**Why they ran out.** From 2026-09-17 the refresh ran three times a day. At §47's recent median of about
22 minutes a run, that is about 66 minutes a day. GitHub's billing page showed MySports at $8.28 gross
for September. At the $0.006 a minute GitHub publishes for a Linux 2-core runner, that is **about 1,380
minutes, ~69 % of the allowance**. The figure is derived from the dollar amount, not published by
GitHub; another private repo on the account used most of the rest.

**The switch to public, and what it changed.** `gh repo view --json visibility,isPrivate` returned
`PUBLIC` / `false` on 2026-09-29. Cowork observed the API return 404 for the repo, logged out, at about
11:35 UTC, and `"visibility": "public"` by 15:40 UTC, after Joe switched it.

- **Actions is free here now.** GitHub documents Actions usage as free "for public repositories that use
  standard GitHub-hosted runners" (read 2026-09-29). So `docs/deployment-contract.md` §5's budget
  paragraph, D7 and §47's projection no longer limit this repo; the contract (v1.0.6) records them as
  history.
- **A new constraint.** GitHub documents that "in a public repository, scheduled workflows are
  automatically disabled when no repository activity has occurred in 60 days". That reaches the two
  refresh crons and `backup_schema.yml`'s Sunday cron. It does not reach the Worker's dispatch.
- **What is exposed now.** Any signed-in GitHub user can see the run logs and each run's step summary,
  including the watch-links table. They can also download the 14-day `validation-*` artifact
  (`schedule_refresh.yml`, the `upload-artifact` step), which carries raw provider payloads. Whether to
  keep it is Joe's call, filed as `docs/queue.md` item 17.
- **Secrets stay masked.** Before the switch, Cowork ran gitleaks over all 386 commits on every ref and
  found no credential of Joe's. It found only Supabase anon keys (publishable by design), `.env.example`
  placeholders, and tokens embedded in public wwe.com and indycar.com pages saved as test fixtures.

**What was written:**

- `docs/deployment-contract.md` v1.0.6: §5's heading and a Worker row, the crons as backstop, the token
  risk, the 60-day rule, and the budget as history.
- `.github/workflows/schedule_refresh.yml`: a header comment naming the three triggers, proved
  comment-only (the parsed YAML is equal before and after, the `on:` block is byte-identical, and
  `tests/test_workflows.py` passes).
- Prompt 123's OPEN item is closed with the numbers below. Two OPEN items are added, for the token
  expiry and the 2026-11-01 check.
- Queue item 16 is now buildable, and item 17 is filed.

**Prompt 123's OPEN item, answered.**

- Cowork read the first refresh after the push (09-28, `github_sha` `c561ba2`): `eligibility_only` 819
  and `eligibility_changes` 14, against a forecast of about 802 and 14. `refresh_runs` answers 401 to
  the anon key, so these are Cowork's SELECTs and were not re-read here.
- Re-read here through PostgREST: queue item 16's query returns **0** games for viewing days 2026-09-29
  to 10-05 (146 games, 133 with broadcasts). It returned 34 before the push.
- Every 2026-10-04 NFL CBS/FOX row carries the verdict its access says: `linear cbs|fox` where
  `available`, not eligible where `out_of_market`, and market pending only on MIA @ MIN (4:05 p.m.
  ET, FOX, `unverified`).

**Out of scope, deliberately:** any schedule, workflow step, Worker or secret change (removing the 3:37
cron and the `validation-*` artifact are Joe's calls); any Cloudflare call; the repo's visibility.

## 69. ONE BACKSTOP CRON, A PRIVATE ARCHIVE FOR FAILED RUNS, AND THE ELIGIBILITY FRESHNESS GUARD — 2026-09-29, prompt 125

**Numbered by count:** §1–§68 each appear exactly once and there was no §69.

**Joe's three rulings, 2026-09-29.**

1. **The Worker's token has no expiration date, and Joe keeps it that way.** An expiring token would
   bring back a silent-stop failure: the dispatch would fail inside Cloudflare, where nothing in this
   repo can see it (§68). The token is fine-grained, scoped to this repo, and limited to Actions read
   and write, so it cannot change code or read secrets. The trade Joe accepted is that a leaked token
   stays valid until he revokes it.
2. **The 07:37 UTC cron is removed.** The Worker's 4 a.m. dispatch is the primary trigger, and the
   11:37 UTC cron is the single backstop. The Worker has dispatched every day since 2026-09-17; its
   one failure (#66) was the Actions minutes cap, not the Worker. Actions is free on this public repo,
   so the reason is load on the providers and noise in the run list, not cost.
3. **Failed runs' payloads are kept, privately, and nothing is published** (queue item 17). The private
   R2 archive ran only when the job succeeded, while the public `validation-*` artifact ran on
   `always()`, so on a failed run the public artifact was the only record. A failed or cancelled run
   now archives to R2 as well, the artifact step is removed, and the published artifacts are deleted
   once each is confirmed to have a private copy.

**Block A, the workflow (`047b2c0`).**

- The `37 7 * * *` cron is deleted (it was at `:31`; the brief said `:32`).
- The header and the note under `on:` are rewritten for one backstop cron and the token ruling.
- The success-path archive step is unchanged.
- A new step directly after it, `if: failure() || cancelled()`, pushes `artifacts/validation` under
  `fixtures/<UTC date>/failed-$GITHUB_RUN_ID/`. The runner's own variable is used, not an expression
  inside `run`, per rule 28. GitHub documents `GITHUB_RUN_ID` as "a unique number for each workflow
  run" (read 2026-09-29). The separate prefix means the step only ever creates keys, so a failed run
  cannot overwrite a good run's day (S7).
- The `upload-artifact` step is removed; nothing in the repo read it.
- Four tests in `tests/test_workflows.py` walk the parsed YAML: exactly one cron, `37 11 * * *`; no
  `upload-artifact` in any job; the failure step's `if`, its prefix, no `${{` in its `run`, and its
  position directly after the success step; and the success step byte for byte.
- **Eight mutations each go red, each on the intended test:** the 07:37 cron put back; an upload step
  put back; `cancelled()` dropped; `failed-` dropped (which also reddens the success-step test,
  correctly); the run id dropped; the run id written as `${{ github.run_id }}`; the success prefix
  changed; and the success step given `if: always()`.

**The two edge cases, as the brief asked:**

- **A run that failed before any adapter wrote.** `artifacts/validation` does not exist, and
  `--push-data` builds its file list with `src.rglob("*")` and never checks existence
  (`scripts/sync_assets.py:273`). Measured locally with a fake S3 client on Python 3.13: it prints
  "pushed 0 file(s)", returns 0, and uploads nothing. Python 3.14's `rglob` on a missing path returns
  `[]`. **The runner's 3.12 could not be run here**, so its behaviour is inferred. `client()` runs
  first, so a run that failed before `pip install` has no boto3, and this step exits 2 on a job that
  has already failed.
- **A job-level timeout.** GitHub documents `timeout-minutes` as the time before "GitHub automatically
  cancels" the job. Its cancellation reference says that when a run is cancelled, unfinished steps
  whose `if` evaluates true keep running, `cancelled()` included, within a 5-minute window. **It does
  not say in so many words that a job timeout goes through the same step re-evaluation.** So timeout
  coverage is probable and not claimed. It will be known the first time a refresh times out (35
  minutes, §41).

**Block B: the published artifacts, deleted only after a confirmed private copy (one-way).**

`gh api …/actions/artifacts --paginate` listed 43 artifacts, every one `validation-*`, from runs #25
(2026-09-16) to #69, all unexpired. Every run's `refresh` job had concluded `success`, including #65,
whose render job was the one that failed. #66 and #67 never started a step and left no artifact. So
the success-path archive had run for all 43, and the brief's step 3, the failed-run path, applied to
none.

**The brief's check was weaker than the ruling's condition.** "Objects exist under
`fixtures/<date>/`" held for all 43. Each artifact was then downloaded and every file's MD5 compared
with its R2 ETag:

- **14 were byte-identical.** Each was the last successful run of its UTC day.
- **The other 29 had been overwritten** by a later run the same day, with 66–84 of about 100 files
  differing. Their exact bytes existed only in the public artifact.

Asked, **Joe chose to copy the 29 before deleting.** Each went to `fixtures/<date>/run-<run id>/`, a
new prefix checked empty first, so keys were only created. Every file was confirmed by MD5 before its
artifact was deleted. One upload, #68, failed on a closed R2 connection and its artifact was left
alone. A retry that uploads only missing keys, and refuses if an existing key differs, uploaded all
100 of its files, confirmed them, and then deleted it. The artifacts were re-listed just before
deleting (43, none new), and **every deletion was verified with a 404.** None remain.

**Could an artifact carry a credential?** Measured over the 43 downloaded artifacts (4,463 files),
reporting counts only:

- no credential-shaped string (the secret-gate names with a value, a private key, an AWS or GitHub
  token, an `Authorization` header, a bearer token);
- no `postgresql://` DSN, and no `mysports_writer`;
- zero exact matches for the CFBD key, the R2 key id, the R2 secret or the R2 account id, compared in
  memory and never printed.

The database writer credential was not loaded (rule 14), and the Schedules Direct secrets are not set
here. This confirms Cowork's reading of the code with a measurement.

| Artifact id | Name | Run | `refresh` | Private copy confirmed | Deleted |
|---|---|---|---|---|---|
| 10448310066 | validation-2026-09-16 | #25 (schedule) | success | yes: copied to `run-35097943470/`, 103 files identical | yes |
| 10456145482 | validation-2026-09-16 | #26 (schedule) | success | yes: copied to `run-35115958301/`, 103 files identical | yes |
| 10467713014 | validation-2026-09-16 | #27 (workflow_dispatch) | success | yes: `fixtures/2026-09-16/`, 103 of 103 files identical | yes |
| 10487270207 | validation-2026-09-17 | #28 (workflow_dispatch) | success | yes: copied to `run-35197381174/`, 102 files identical | yes |
| 10498812846 | validation-2026-09-17 | #29 (schedule) | success | yes: copied to `run-35222959480/`, 102 files identical | yes |
| 10506885788 | validation-2026-09-17 | #30 (schedule) | success | yes: `fixtures/2026-09-17/`, 102 of 102 files identical | yes |
| 10537849713 | validation-2026-09-18 | #31 (workflow_dispatch) | success | yes: copied to `run-35322158547/`, 102 files identical | yes |
| 10546539548 | validation-2026-09-18 | #32 (schedule) | success | yes: copied to `run-35344185630/`, 102 files identical | yes |
| 10554605380 | validation-2026-09-18 | #33 (schedule) | success | yes: `fixtures/2026-09-18/`, 102 of 102 files identical | yes |
| 10580064457 | validation-2026-09-19 | #34 (workflow_dispatch) | success | yes: copied to `run-35430820382/`, 102 files identical | yes |
| 10583663341 | validation-2026-09-19 | #35 (schedule) | success | yes: copied to `run-35441721374/`, 102 files identical | yes |
| 10585998457 | validation-2026-09-19 | #36 (schedule) | success | yes: `fixtures/2026-09-19/`, 102 of 102 files identical | yes |
| 10600614400 | validation-2026-09-20 | #37 (workflow_dispatch) | success | yes: copied to `run-35498355630/`, 109 files identical | yes |
| 10605172718 | validation-2026-09-20 | #38 (schedule) | success | yes: copied to `run-35511079914/`, 109 files identical | yes |
| 10608030538 | validation-2026-09-20 | #39 (schedule) | success | yes: `fixtures/2026-09-20/`, 109 of 109 files identical | yes |
| 10628392861 | validation-2026-09-21 | #40 (workflow_dispatch) | success | yes: copied to `run-35575642342/`, 111 files identical | yes |
| 10646171184 | validation-2026-09-21 | #41 (schedule) | success | yes: copied to `run-35612635669/`, 111 files identical | yes |
| 10653609632 | validation-2026-09-21 | #42 (schedule) | success | yes: `fixtures/2026-09-21/`, 111 of 111 files identical | yes |
| 10683790002 | validation-2026-09-22 | #43 (workflow_dispatch) | success | yes: copied to `run-35702453954/`, 104 files identical | yes |
| 10695587781 | validation-2026-09-22 | #44 (schedule) | success | yes: copied to `run-35729429874/`, 104 files identical | yes |
| 10704880189 | validation-2026-09-22 | #45 (schedule) | success | yes: `fixtures/2026-09-22/`, 104 of 104 files identical | yes |
| 10739646551 | validation-2026-09-23 | #46 (workflow_dispatch) | success | yes: copied to `run-35834681015/`, 103 files identical | yes |
| 10752383058 | validation-2026-09-23 | #47 (schedule) | success | yes: copied to `run-35863959039/`, 103 files identical | yes |
| 10762330233 | validation-2026-09-23 | #48 (schedule) | success | yes: copied to `run-35882453048/`, 103 files identical | yes |
| 10764411818 | validation-2026-09-23 | #49 (workflow_dispatch) | success | yes: `fixtures/2026-09-23/`, 103 of 103 files identical | yes |
| 10796863025 | validation-2026-09-24 | #50 (workflow_dispatch) | success | yes: copied to `run-35972703829/`, 102 files identical | yes |
| 10808717825 | validation-2026-09-24 | #51 (schedule) | success | yes: copied to `run-36001817834/`, 102 files identical | yes |
| 10819167230 | validation-2026-09-24 | #52 (schedule) | success | yes: `fixtures/2026-09-24/`, 102 of 102 files identical | yes |
| 10853498056 | validation-2026-09-25 | #53 (workflow_dispatch) | success | yes: copied to `run-36110551236/`, 101 files identical | yes |
| 10866505514 | validation-2026-09-25 | #54 (schedule) | success | yes: copied to `run-36137886447/`, 101 files identical | yes |
| 10874866801 | validation-2026-09-25 | #55 (schedule) | success | yes: `fixtures/2026-09-25/`, 101 of 101 files identical | yes |
| 10901597243 | validation-2026-09-26 | #56 (workflow_dispatch) | success | yes: copied to `run-36228530941/`, 100 files identical | yes |
| 10906376412 | validation-2026-09-26 | #57 (schedule) | success | yes: copied to `run-36241817965/`, 100 files identical | yes |
| 10909745203 | validation-2026-09-26 | #58 (schedule) | success | yes: `fixtures/2026-09-26/`, 100 of 100 files identical | yes |
| 10927097712 | validation-2026-09-27 | #59 (workflow_dispatch) | success | yes: copied to `run-36304885098/`, 105 files identical | yes |
| 10932474530 | validation-2026-09-27 | #60 (schedule) | success | yes: copied to `run-36321794013/`, 105 files identical | yes |
| 10935349591 | validation-2026-09-27 | #61 (schedule) | success | yes: `fixtures/2026-09-27/`, 105 of 105 files identical | yes |
| 10958536432 | validation-2026-09-28 | #62 (workflow_dispatch) | success | yes: copied to `run-36394887115/`, 107 files identical | yes |
| 10980928108 | validation-2026-09-28 | #63 (workflow_dispatch) | success | yes: copied to `run-36444497029/`, 107 files identical | yes |
| 10981169207 | validation-2026-09-28 | #64 (schedule) | success | yes: copied to `run-36446873093/`, 107 files identical | yes |
| 10991042419 | validation-2026-09-28 | #65 (schedule) | success | yes: `fixtures/2026-09-28/`, 107 of 107 files identical | yes |
| 11043558095 | validation-2026-09-29 | #68 (workflow_dispatch) | success | yes: copied to `run-36589936472/`, 100 files identical (after a retry) | yes |
| 11049499176 | validation-2026-09-29 | #69 (schedule) | success | yes: `fixtures/2026-09-29/`, 100 of 100 files identical | yes |

**Block C: queue item 16, the eligibility freshness guard.**

- **The rule.** `web/lib/freshness.js` exports `staleEligibility(games, broadcasts, eligibility)`. A game
  fails when its eligibility row (profile 1) is more than 26 hours older than the newest `last_seen_at`
  among its `game_broadcasts` rows, or when it has broadcast rows and no eligibility row. A game with no
  broadcast rows is out of scope.
- **The live check.** `web/scripts/smoke.mjs` section (g) applies the rule to the next 7 ET viewing days.
  It uses three `restAll` reads: the games by `viewing_day` range, then their broadcasts and eligibility
  by chunked id lists. The anon role was confirmed first to read both `game_broadcasts.last_seen_at` and
  `viewer_game_eligibility.computed_at`.
- **Rule 19.** `web/test/restcap.test.mjs` walks `lib/queries.js` only. So the rule-19 pin for these
  reads (every read in section (g) is `restAll`) lives in `web/test/freshness.test.mjs`, beside the
  rule's fixture tests.
- **The fixture tests (6).** One fresh game, deliberately 3 hours behind its broadcasts; one stale game,
  27 hours behind; one game with broadcasts and no eligibility row; and one with no broadcasts. Plus the
  26-hour boundary, which is exact at 26 hours and fails a minute later, and the smoke wiring.
- **First live run: green** on 2026-09-29..10-05: 146 games, 133 with broadcasts, 0 stale. Smoke goes
  33 → 34.
- **Three mutations each go red in `test:unit`:**
  - the comparison flipped (3 tests failed);
  - the window set to 0 hours (4 failed);
  - the missing-row branch dropped (2 failed).
- **The brief expected the 0-hour window to turn live data red. It does not:** live smoke stayed 34/34,
  with 0 stale. Since prompt 123 every eligibility row is computed after its broadcasts' last sighting,
  so live lag is at or below zero. The fixture's fresh game, 3 hours behind, is what catches that
  mutation.

**Also recorded:** the Block A gate run's first `qa-shots` pass was 144/145, on the pinch check "the
same pinch 60px lower" (`scrollWidth` 1355 → 1355), with no web file changed. The single re-run
allowed was 145/145 (1355 → 848). It is recorded as a flake of a gesture test on a slow dev server,
not waved through.

**Out of scope, deliberately:** the Worker, its token and Cloudflare; `render_all.yml`,
`bootstrap_season.yml` and `backup_schema.yml`; the success path's prefix and behaviour; any R2
deletion (S7); the FOX late-window question.

## 70. THE CARD AND THE GRID LANE NAME THE BROADCAST JOE CAN WATCH — 2026-09-30, prompt 126

**Numbered by count:** §1–§69 each appear exactly once and there was no §70.

**What Joe saw, 2026-09-30, on his phone.** The Blue Jackets opener (BUF @ CBJ, 2026-10-01, 7 PM,
`nhl-2026020011`) showed no network mark on its list card, while the Prime Video mark appeared in
the game's detail panel.

**The finding.** The data was right and the card picked the wrong row.

- The game has four active broadcast rows: `cbjnhl` (primary, LINEAR, access `unknown`), `cbjhn`
  (LINEAR, `unknown`), `msg-b` (LINEAR, `out_of_market`) and `prime-video` (STREAMING, `available`).
  Its verdict is eligible, "stream only: prime-video", with `eligible_via_network_id` null and
  `eligible_via_service_ids` `{prime-video}`.
- `cardBroadcast()` took the primary row, then a linear row, then the first row, so it named
  `cbjnhl`. The card draws a mark only when the named service has one (`showsMark`,
  `web/lib/marks.js:51`), and `cbjnhl` has none. So the mark column was empty on a game the
  reconciler had decided is watchable.
- `MobileGrid` chooses a game's lane with the same function (`web/components/MobileGrid.js:148`).
  Cowork inferred from the code that the opener sat in a `CBJNHL` rail row. The "before" screenshots
  confirm it at both widths: a rail row with no mark and the call letters `CBJNHL`.
- The query did not fetch what a fix needs: the game embed had no `eligible_via_service_ids`.

**It is a class, not one game.** Measured by this run with the anon key, 2026-09-30 to 2026-10-31:
690 games, 184 eligible, and 17 whose card broadcast is neither the verdict's network nor one of its
services. That is Cowork's count and its table, row for row. One detail differs: the NBA game is
CLE @ ATL, not ATL @ CLE.

**The rule (Cowork's recommendation; Joe ran the brief without a veto).**

1. The card keeps its current pick whenever that pick shows a mark.
2. Otherwise it names the first row the eligibility verdict names that is active on the game and has
   a mark: `eligible_via_network_id`, then `eligible_via_service_ids` in array order.
3. Otherwise the current pick stands.

**Why it is keyed to the mark.** The test is the one the card already applies, so the rule cannot
change any card that shows a mark today. It only reaches cards that show nothing. The NFL's ABC/ESPN
simulcasts keep ABC although the verdict names ESPN, because `abc` has a mark. It reads the
reconciler's verdict and derives no second eligibility rule in JavaScript (the D4/E3 note on
`GAME_SELECT`). Both fields are empty on a game that is not eligible
(`pipeline/reconcile.py:281-285`), so there is no `eligible` test to repeat.

**One function for the card and the grid (Cowork's judgment call).** A game in a lane for a feed Joe
cannot get is the same defect he reported on the card, so the rule lives in `cardBroadcast()` and
both surfaces call it.

**Where the code is (block A, `0f56eac`), and one departure from the brief.**

- The brief put the rule in `web/components/MatchupCard.js:132-136`. That file is JSX and
  `node --test` cannot import it, so a unit test could not run the rule there. `cardBroadcast()`
  moved to `web/lib/cardbroadcast.js`. `MatchupCard.js` imports it and re-exports it under the same
  name, and `MobileGrid.js` still imports it from `MatchupCard.js` and is not edited.
- `web/lib/queries.js` adds `eligible_via_service_ids` to the game eligibility embed. The anon role
  reads the column, confirmed by the read itself. The program embed is unchanged.
- **One file outside the brief's named paths, approved by Joe in the session (S5).**
  `web/app/qa/tbd/fixture.js` mirrors `GAME_SELECT` key for key, and `web/test/qatbd.test.mjs` went
  red when the query gained a column. Its one eligibility row gained `eligible_via_service_ids: []`.
- `cardMarkSlug()`, `simulcastLanes()`, `programBroadcast()` and the `hasMark` list are not changed.
  `docs/design/mobile_demo.html` implements no broadcast choice, so rule 23 asks nothing of it
  (searched for `is_primary` and `cardBroadcast`: no match).

**The tests (15, `web/test/cardbroadcast.test.mjs`; `test:unit` 663 → 678).** The fixtures are rows
as `gameById()` returned them on 2026-09-30, and the first test holds their keys to `GAME_SELECT`'s
own column lists. The brief's six cases:

- the opener's rows name `prime-video`;
- an ABC primary with an ESPN verdict keeps `abc` (`abc` has a mark);
- no eligibility row keeps the primary;
- a verdict naming a service with no row on the game keeps the primary;
- a verdict naming a service with a row but no mark keeps the primary (the real 10-09 rows, whose
  verdict names `cbj-local`);
- a Cavaliers simulcast collapses exactly as before, in all three states, lanes included. **These
  rows are built, not copied:** no simulcast row was loaded on 2026-09-30 (`wuab-43` had 0 rows).

The rest pin the order of the two fields, the array order, an inactive named row, a verdict that
names nothing, the object form of the embed, the unchanged pick, and the wiring.

**Four mutations, each red, the file restored byte for byte each time (sha256 identical).** The
brief asked for three; the mark is tested in two places, so "ignore the mark test" is two mutations.

| Mutation | Tests that fail |
|---|---|
| the pick's mark test ignored | 3: ABC keeps; a marked pick is never replaced; the Cavaliers collapse |
| the named row's mark test ignored | 2: a row with no mark; the markless service passed over |
| the two eligibility fields reversed | 1: the linear network comes before the streaming services |
| the new branch deleted | 4: the opener; the object form; the field order; the array order |

**The 17 games, before and after, from live data.** Four change. All four are rows the brief
expected to change (CBJ, CFB, NBA).

| Day | Game | Id | Card before | Card after | Verdict names |
|---|---|---|---|---|---|
| 10-01 | BUF @ CBJ | `nhl-2026020011` | `cbjnhl` (no mark) | **`prime-video`** | `prime-video` |
| 10-03 | UTA @ CBJ | `nhl-2026020027` | `cbjnhl` (no mark) | **`prime-video`** | `prime-video` |
| 10-09 | PIT @ CBJ | `nhl-2026020068` | `cbjnhl` (no mark) | `cbjnhl` | `cbj-local` |
| 10-10 | CBJ @ STL | `nhl-2026020079` | `cbjnhl` (no mark) | `cbjnhl` | `cbj-local` |
| 10-12 | BUF @ LAR | `nfl-401872994` | `abc` | `abc` | `espn` |
| 10-13 | FLA @ CBJ | `nhl-2026020091` | `cbjnhl` (no mark) | `cbjnhl` | `cbj-local` |
| 10-17 | ELON @ STAN | `401858262` | `acc-extra` (no mark) | **`accnx`** | `accnx` |
| 10-17 | NYR @ CBJ | `nhl-2026020129` | `cbjnhl` (no mark) | `cbjnhl` | `cbj-local` |
| 10-18 | CBJ @ MIN | `nhl-2026020135` | `cbjnhl` (no mark) | `cbjnhl` | `cbj-local` |
| 10-19 | WSH @ SF | `nfl-401873008` | `abc` | `abc` | `espn` |
| 10-20 | TOR @ CBJ | `nhl-2026020145` | `cbjnhl` (no mark) | `cbjnhl` | `cbj-local` |
| 10-24 | VGK @ CBJ | `nhl-2026020174` | `cbjnhl` (no mark) | `cbjnhl` | `cbj-local` |
| 10-26 | DAL @ PHI | `nfl-401873009` | `abc` | `abc` | `espn` |
| 10-27 | CBJ @ PHI | `nhl-2026020188` | `cbjnhl` (no mark) | `cbjnhl` | `cbj-local` |
| 10-29 | CLE @ ATL | `nba-401909893` | `nba-tv` (no mark) | **`dazn`** | `dazn` |
| 10-29 | CBJ @ CAR | `nhl-2026020206` | `carnhl` (no mark) | `carnhl` | `cbj-local` |
| 10-31 | CBJ @ DAL | `nhl-2026020225` | `cbjnhl` (no mark) | `cbjnhl` | `cbj-local` |

- **The ten Blue Jackets games that do not change** still carry the old `cbj-local` carrier-TBA row,
  which has no mark, so rule 3 applies and their cards still show an empty mark column. They are
  past the refresh's 7-day window. Each should take a `prime-video` row as the window reaches it,
  as 10-01 and 10-03 have, and the card then follows with no code change.
- **The three NFL games** keep ABC, as the rule intends.

**Every loaded game, for the size of the change.** 4,182 games, 1,125 eligible, 102 in the class.
**Twelve cards change and none is outside the class.** Beyond the four above: WIS @ PSU 09-26
(`eradm` → `peacock`), CBJ @ DET 09-26 (`dsn` → `prime-video`), and six more Cavaliers games from
11-02 to 2027-03-29 whose primary row is `nba-tv` or `nbcsn` (→ `dazn`). The 90 that stay: 80
Blue Jackets games waiting on the window, 9 ABC/ESPN simulcasts, and one Guardians game whose card
shows NBC.

**Block B: the pictures** (`assets/p126-card-broadcast/`, untracked; dev server and Playwright, a
390×844 phone and a 1024×1366 coarse-pointer iPad, both at 2×).

- **Before, both widths.** The list card has an empty mark column. The grid has two rail rows,
  ESPN+ and a row with no mark that reads `CBJNHL`, and the opener is in the second.
- **After, both widths.** The list card shows the Prime Video mark (56×40 on the phone, 84×44 on
  the iPad). The grid's second rail row is Prime Video, drawn with the Prime Video mark, and the
  opener is in it. The `CBJNHL` row is gone. The row count is unchanged at two.
- The files are `before__` and `after__`, then `390__` or `1024-ipad__`, then `list-card.png`,
  `grid.png` or `grid-rail-row.png`: twelve pictures, plus `before__facts.json` and
  `after__facts.json`, which hold what the script read from the DOM.

**A correction to the brief (rule 22).** The brief says the detail panel "lists every row, which is
why Prime Video appears there", and that it "still lists" the two Blue Jackets feeds as "unknown".
`web/components/GameDetail.js:310-365` does neither on this game. Once one row is accessible the
panel draws only the accessible watch links and drops the whole "Where to watch" list (prompt 71
stage 4). Prime Video appears because it is the accessible row. The word "Unknown" is not rendered
for `cbjnhl` on any of its 82 games today, since each has an accessible row. Queue item 18 carries
the corrected description.

**Geometry.** All hard stops passed and none moved. The gate's days are 2026-09-03, 09-05 and
09-13, and no game on them changes.

**Left for Joe, in `docs/queue.md` item 18:** whether to record `cbjnhl` and `cbjhn` as
unavailable. The brief's statement that the Blue Jackets Hockey Network is on Spectrum cable and
not DIRECTV was not checked by this run.

**Out of scope, deliberately:** any data change (`local_rights.json`, `access_profile.json`,
broadcast rows, access statuses); the Python archived-grid renderer and the desktop grid, which
follows `docs/rendering-contract.md` §5 rule 4; `programBroadcast()`, the Cavaliers collapse and
`simulcastLanes()`; the `hasMark` list and every network logo.

## 71. ONE READ-ONLY ADDRESS ANSWERS WITH JOE'S TEAMS' GAMES FOR THE WEEK — 2026-10-05, prompt 127

**Numbered by count:** §1–§70 each appear exactly once and there was no §71.

**Joe's ruling, 2026-10-05.** Another app of his, MyDash, draws small score boxes for his own teams:
who plays, when, where, on what broadcast, and the live score. It reads the games **from MySports'
own read-only address** and works out nothing for itself. So the address says what MySports' own card
says, by calling the card's own code (rule 32). Cowork recommended the shape below and Joe ran the
brief without a veto.

**The address: `GET /api/my-games`** (`web/app/api/my-games/route.js`, built by `web/lib/mygames.js`).

- **What it answers.** Every game one of Joe's favourite teams plays (`isFavorite`, over game rows
  only), from the current viewing day through the next seven, in the page's own order. One
  `gamesForRange` read with no sport supplies the rows, and today's favourites' games get the live
  overlay, as the week page applies it.
- **The shape.** Each game carries its id, sport, viewing day, kickoff (null wherever the card prints
  TBD), kickoff status, status, clock and period. It also carries the card's right-slot verdict
  (`slotContent` with no favourite: kind and label), the neutral-site flag, and the venue. Each side
  carries the card's name (`cardName`), abbreviation, `_dark` logo (null for a placeholder),
  both colours as stored, and a score. The score is null unless the card shows one, so a stale live
  row carries none. The broadcast carries the row's name and the absolute address of the mark the
  card wears. The answer's keys are always present, with null where there is no value.
- **What it refuses.** Any parameter, since it reads no query string. It also carries no programs,
  no odds, and no word on whether Joe can watch (off-service, market pending, network TBD). The last
  is Joe's call for another day. Because no odds are carried, a priced scheduled game reads `none`
  where the card draws a line.
- **It is open**, like the rest of the app (no sign-in; deployment contract D4, v1.0.8). It shows
  which teams Joe follows, which `data/favorites.json` in the public repo already publishes. It sends
  `Cache-Control: no-store` and no CORS header: MyDash reads it from its own server.
- **A failed database read** answers 200 with the five keys, no games, and an `error` cut to 200
  characters, as `/api/live` does. It never throws.

**Its day changes at 3 AM; the page's changes at midnight, and that is on purpose.** The first day
is `viewingDayOf(new Date())`, the app's own 03:00 ET cutover, because a game is filed under its
viewing day. Under the page's calendar today (`todayET()`), a West Coast game still in progress at
12:30 AM would drop out of the score boxes mid-play. The page is unchanged; `docs/queue.md` item 20
describes its version of the gap, and whether it should follow is Joe's.

**The rules moved into `web/lib/`, and why.** `MatchupCard.js` is JSX and `node --test` cannot
import it, and a second copy of the card's rules in the route is the defect rule 32 names. So:

- `cardName` moved to `web/lib/cardname.js`. `MatchupCard.js` re-exports it under the same name, so
  GameDetail and MobileGrid import it unchanged.
- The mark the card wears moved into `cardMark()` in `web/lib/cardbroadcast.js`, beside
  `cardBroadcast` (prompt 126's move, for the same reason): the Cavaliers composite first, else the
  named row's own mark. The card calls it; its markup and what it draws do not change. Under a
  composite the address sends no name, because the row `cardBroadcast` names there is one outlet of
  several.
- `broadcastName()` in the same file is the words GameDetail and the grid rail print for a row. The
  card prints no network name. A source-text test holds every copy to it.
- The three pins on the card's old text moved to the new definitions and to the card's call of
  them; none was deleted or loosened.

**Rule 19.** `gamesForRange` now has two callers, and its written bound in
`web/test/restcap.test.mjs` says so. Measured 2026-10-05 over all 4,217 loaded games (2026-08-29 to
2027-04-11): the heaviest eight-day window is 329 games, and eight copies of the heaviest day (95)
is 760, under the cap. So it stays `rest()`.

**The privacy gate covers it.** The open item in `docs/handoff-status.md`, "The privacy gate before
the Cavs season", covers this address as it covers the card. Rule 8 reads as it does there: the
payload names call signs and services exactly as the card does, and never who told Joe anything.

**Rule 23.** `docs/design/mobile_demo.html` implements nothing this changes. Searched for
`cardName`, `cardMark`, `cardBroadcast`, `broadcastName`, `my-games`, `/api/` and `is_primary`: no
match.

**The tests** (`web/test/mygames.test.mjs`, 21). The fixture rows are `GAME_SELECT`'s exact shape,
held to it by the first test. The tests cover the favourites filter, the page's order, the overlay's
rows, a team, a broadcast, every slot state, the venue, the exact keys and the failed read. The
wiring is pinned as source text: the route reads no query string, takes `viewingDayOf(`, calls
`gamesForRange(` once and sends `no-store`. Every `in_progress` kickoff is computed from `Date.now()`.

**Five mutations, each red, the file restored byte for byte:**

| Mutation | Test that fails |
|---|---|
| the favourites filter dropped | only favourites' games come back |
| the overlay handed the whole range | the overlay is handed only today's favourites |
| the pick's own mark, collapse skipped | the Cavaliers simulcast; the same-place wiring |
| a placeholder's logo returned | a placeholder team has no logo address |
| a stale row's scores returned | a stale live row carries no score |

`web/scripts/probes/test-mutation.mjs` reported no problem in the three test files that read source.

**One check against the running app** (`web/scripts/qa-shots.mjs`, 145 → 146). It requests
`/api/my-games` and asserts the shape, not the number of games. On 2026-10-05 it read 200,
`no-store`, today 2026-10-05, 22 games, none malformed.

**Where the tree contradicted the brief (rule 22).**

- The brief said a row's name is written twice. It is written three times: `GameDetail.js:375`, the
  where-to-watch list, is a third copy. The test holds all three to `broadcastName()`.
- `MobileGrid.js:616`, the awaiting-kickoff tray, prints a different rule:
  `cardBroadcast(g)?.network?.canonical_name || 'Network TBA'`. It is not touched.
- `web/README.md` and `docs/app-skeleton.md` still describe `/weeks` and `/history`, retired by
  prompt 50. Each got only the brief's one line per JSON route.

**Two rulings Joe made mid-run, at the gate.** Smoke went red on the LCS placeholders, and Joe
ruled the higher/lower-seed form in (§60, 2026-10-05). The geometry stop moved on MLB 2026-09-03.
Run side by side, the untouched tree at `cd18385` read the same 396.38 minutes, so it was the data.
Joe re-pinned it, and `docs/queue.md` item 19 records why the span moves when only `widest` does.
