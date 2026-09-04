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
