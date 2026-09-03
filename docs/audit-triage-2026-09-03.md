# MySports TV — Independent Mobile Design Audit: Triage

**Triaged:** 2026-09-03, Cowork, against **HEAD `10efae7`** (post-prompt-24, `origin/main` in sync, tree clean).
**Status:** advisory report. Nothing in the repo was changed. This document reports; Claude Code executes.
**Source audited:** `MySports_TV_Mobile_Design_Audit_and_Modification_Suggestions.md`, dated 2026-09-03.
**Read with:** `docs/handoff-status.md`, `enhancement-register.md` §7–§13, `docs/feature-study/05-home-page-decisions.md` (binding), `docs/rendering-contract-mobile.md` (Addendum v1.1).

---

## 1. Verdict

**Act on it, but on about a fifth of it, and not on any of its three P0s as written.** The audit is a careful, well-mannered document written by someone who could not see the decision record, could not read the code, and — decisively — sampled the app on **September 3, the easiest day of its season**. Its top-priority item is arithmetically wrong (the mobile hero is 280 px, not the "500+ px" it asserts, and the audit's own proposed target of 330–380 px is *taller* than what ships). Two more of its P0s ask for things that were built weeks ago and shipped — the mobile grid's horizontal scroller with a sticky network rail (Addendum M4/M6) and progressive disclosure on dense cards (M11's tap-to-detail panel). Where the audit earns its keep is in a handful of small, checkable observations it made honestly and that nobody here had looked at: the sport-pill row genuinely wraps, and checking why exposed a false premise underneath a ruling made this morning; the "SPORT" label genuinely is decoration with no accessibility function; one text token genuinely fails WCAG AA; and its complaint about the grid being "constrained at the right side" was misdiagnosed but pointed straight at a real clipping bug under pinch-zoom. **The real value is concentrated in the verification, not the recommendations** — three of the four things worth doing came from measuring claims the audit got wrong rather than from adopting claims it got right.

---

## 2. Re-baseline — what changed on the re-check at `10efae7`

I read the decision record while prompt 24 was landing. HEAD moved `b44893e` → `10efae7` mid-read (`dff0725`, `f15449f`, `2024c21`, `a1f7364`, `10efae7`, committed 11:57–12:18 ET). Every code measurement in this document was taken **after** 12:18 ET against a clean tree with `HEAD == origin/main == 10efae7`, so the reads are at 10efae7, not mid-write. The doc reads were the project mirrors, which already carried §9 and rules 19–21; I confirmed the repo copies match.

**Findings that changed bucket on the re-check:**

| Finding | Bucket at `b44893e` | Bucket at `10efae7` | Why |
|---|---|---|---|
| §12 availability signal | C — three states, count line ruled | **C, restated** | `a1f7364` made it four states. The line the audit asked to strengthen is now one segment longer with no change in weight. This is what surfaced Reopener 2. |
| §15 grid footer noise | C — one instance | **C, worse** | `10efae7` added `.mgrid-note` beneath `.mgrid-foot`. The grid footer region now carries three pills plus a note, and the note ships at `--faint`. |
| §18 contrast | C — unmeasured | **C, narrowed and re-widened** | Measurement cleared `--dim` and convicted `--faint`; then `10efae7` added a *new* `--faint` line (`.mgrid-note`), so the defect grew on the same day I measured it. |
| §11 MLB density ("market status") | B — one badge | **B, with a new nit** | `NETWORK TBD` now occupies the identical card corner as `MARKET TBD` (`top:6px; right:8px`). Mutually exclusive with each other and deliberately charcoal rather than gold so they do not read alike — but both sit over the odds cluster. |
| §11 MLB density (card count) | B — 20-game sample day | **B, but the question changed shape** | Prompt 24 took 2026-11-14 from **6 visible cards to 51**. The audit judged density on a day rendering 20 cards; November now renders 51. Its conclusion may still be wrong, but it is no longer being asked the same question. |

No finding moved between A/B/C/D on the re-check. Four moved in severity or scope.

**Two filing items the re-baseline exposed, unrelated to the audit:**

1. `docs/handoff-status.md` line 8 still reads `HEAD **b44893e**`. Prompt 24's stage 1 committed the doc Cowork had written, then landed four more commits on top of it without refreshing that line. Third occurrence of the same pattern (prompt 23's stage 1 was a no-op for the same reason).
2. **Working rule 21 is now obsolete.** `f15449f` extended `.gitattributes` to cover `.js .mjs .jsx .css .html`. Rule 21 reads "…is the only honest tree check **until** `.gitattributes` covers" those types — the condition has been met. Retire it or the next session will keep working around a fixed problem. (I verified: a plain `git diff --name-only` now returns empty.)

---

## 3. Dating the audit

**Written against the app between `e826d23` (08:18 ET) and `dff0725` (11:57 ET) on 2026-09-03.** Confidence high at both bounds.

The decisive upper-bound evidence is §12, which enumerates the availability states as exactly three: "Available; Market Pending; Not on Your Services." Prompt 24 made it four. An auditor looking at the site after 12:15 ET would have had `NETWORK TBD` in front of them and would not have written a three-state list.

The lower bound comes from §10 and §11. §10 proposes `TIME | MATCHUP | NETWORK | SCORE/STATUS` as a "possible structural model" — that *is* the shipped four-column card, restored by `f42c364` at 07:56 ET; before it, the network mark rendered left of the matchup. §11 lists "network logo" as a distinct card element alongside "network." Both describe the post-prompt-22 card. §7 asking to "preserve league icons" on the pills is consistent with `e826d23` (08:18 ET) shipping mark + 13 px text.

**Consequence for triage:** the audit predates prompt 24 entirely and is silent on the announcement horizon, the fourth state, the grid's "not on the grid" note, and the reconciler fix. None of that is auditor carelessness; all of it landed after they finished.

---

## 4. THE REOPENERS

Two bucket-B rulings failed to survive Step 3. Both survive as *decisions*; what failed is a **premise underneath** each. Neither reverses direction — both change what the work costs and when it has to happen.

### Reopener 1 — the chip row's "it's already reference behaviour" premise is false

`enhancement-register.md` §13 rules the chip row becomes one horizontally scrolling line, and justifies the cost as free:

> "the locked reference already sets `overflow-x:auto` on `.chiprow`, so the row becomes **one horizontally scrolling line**. That is reference behaviour and it scales as sports are added."

**Measured at `10efae7`:**

```
web/app/globals.css:231   .chiprow { display: flex; flex-wrap: wrap; gap: 6px; }
```

The shipped rule is `flex-wrap: wrap`. Grepping the whole tree, the only `.chiprow` carrying `overflow-x:auto` is:

```
docs/feature-study/mockups/home-page-candidates.html:16
  .chiprow{display:flex; gap:6px; padding:4px 14px 10px; overflow-x:auto}
```

That is the **feature-study mockup**, not the locked reference. The locked reference is `mobile_demo.html` (artifact `0f1a2469`), which is a project doc and not in the repo at all. The ruling cited the wrong file.

**What this changes.** The ruling stands — the scrolling row is still right, and the reasoning behind it (marks have wildly different aspect ratios, ten chips ≈ 680 px against 390 px, do not squash them) is untouched. What is wrong is the belief that prompt 25 gets it for free by leaving `.chiprow` alone. It is a real CSS change (`flex-wrap: nowrap; overflow-x: auto; -webkit-overflow-scrolling: touch`, plus `white-space: nowrap` on `.chip` and a `flex: 0 0 auto`), and it has to be written into the prompt explicitly or prompt 25 will ship four new chips into a row that still wraps — worse than today, not better.

**And the audit's §7 is the confirming observation.** It reports MLB wrapping to a second line. That is `flex-wrap: wrap` doing exactly what it says, compounded by `.chiprow` being a flex item inside `.controls`, which is *also* `flex-wrap: wrap` and is already carrying `Day`, a date input and `Sport` ahead of it on the same line. The audit agreed with a ruling it had never read, and in doing so caught that the ruling was not going to happen by itself.

**This is the third instance of a pattern prompt 24 already named, and it should settle the proposed rule.** The record from this morning identifies two prior cases where Cowork asserted component behaviour it had not read — telling Joe to "run the existing `bootstrap_season` workflow" when that workflow loaded only teams, and prompt 24's stage 4 premise that no-broadcast games were vanishing from the phone grid when `MobileGrid` had always bucketed them. Both times the assertion was inferred from a **contract document** rather than from opening the file. Register §13's `.chiprow` claim is the same failure a third time, and it is the cleanest example of the three: the document it inferred from (`home-page-candidates.html`) is a real file that really does contain `overflow-x:auto` — it is simply not the file that ships. **The proposed rule — before asserting what a component does, read the component and cite file and line, not the contract that describes it — is worth adopting as a binding working rule (22).** I have cited file and line for every claim in this document for that reason.

### Reopener 2 — "one line, not four" no longer holds, as of this morning

Prompt 22 stage 5c implemented Joe's shortening instruction as one line carrying every count, with the verbose outlet lists deleted. The code comment records the intent:

```
web/app/globals.css:1484   /* 5c. One line, so it lays out as a line rather than a stack. */
web/app/globals.css:1485   .offsvc { flex-direction: row; align-items: baseline; flex-wrap: wrap; gap: 10px; }
```

`a1f7364` added a fourth segment to that line today. The ruled target strings in 05 §9 include:

```
2026-11-14   56 games · 6 available to you · 45 network TBD · 5 not on your services
```

*(45/5, not the 42/8 in the ruling's target — prompt 24's report is right that 42 was that day's `kickoff_status='tbd'` count, a different question. The string length is unchanged either way.)*

**Measured:** at 390 px the shell leaves 350 px of content width. `.offsvc` is a wrapping flex row holding the line and the "Show all" toggle (≈ 62 px) with a 10 px gap, so the line itself gets ≈ 278 px. That string is 71 characters at 12 px Inter — roughly 419 px, about 1.5× the space available. `.offsvc-line` has no `nowrap`, so it wraps internally, and the toggle then drops below it. The "one line" Joe asked for becomes **three** on a heavy November day.

**Why this passes Step 3:** this is a consequence nobody priced, and it arises from a change in the world — the ruling that created it landed four hours ago and after the audit was written. It is not an aesthetic re-raise of the count-line decision, which stands: every count stays, because D4 and E5 and now §9 all turn on counts this line carries.

**What it needs.** A decision from Joe, not a fix from me. The choices are to let it wrap and accept a two-line block on heavy days; to shorten the segment words (`42 network TBD` → `42 TBD`, which risks colliding with the `MARKET TBD` vocabulary); or to keep one line by dropping the noun phrases (`56 · 6 yours · 42 network TBD · 8 off`), which sacrifices the plain-English quality Joe has protected all the way through. **Recommendation: let it wrap, and change nothing.** The line is a statement of fact and its readability matters more than its height; the September case that motivated the shortening is still one line, and the November case is genuinely more information. But it must be *seen* at 390 px on a November day before prompt 25 closes, because right now nobody has looked at it.

*One caveat, honestly: this is arithmetic, not a render. Rule 13 says measure against the render. Prompt 25 should take a 390 px shot of `?day=2026-11-14` and confirm before acting on it.*

---

## 5. The bucketed table

Every finding, one bucket each.

| § | Finding | Bucket | Justification |
|---|---|---|---|
| 5 | **P0** Mobile hero is 500+ px, cut 25–35% to 330–380 px | **D** | Measured 280 px. `lib/banner-layout.json` `mobile.h = 280`; `.bn-mobile .scatter { width:100%; height:auto }` on a 390×280 viewBox. Plus `.homenav` ≈ 42 px = **322 px total**. The audit's *target* is taller than what ships. Also touches a locked asset (banner). |
| 6 | **P2** Compact sticky header after hero scroll | **C** (polish, deferred) | Not previously considered. Verified: exactly one `position: sticky` in the whole stylesheet (line 750, the grid rail). `Chrome.js` already renders a compact bar on non-home routes but never sticks it. Real, but see §7 sequencing. |
| 7 | **P0** Sport pills must never wrap | **B → REOPENER 1** | Ruled in register §13 (scrolling row). Audit confirms the ruling and exposes that its premise about the shipped CSS is false. See §4 above. |
| 8 | **P1** Drop the standalone `SPORT` label | **C** | New. And I can answer the audit's own pushback criteria definitively: it is *not* required for semantics. `Filters.js` renders `<span className="control-label">Sport</span>` — a bare span, not a `<label for>`, wired to nothing. It has zero accessibility value today. |
| 9 | **P1** Remove `SCHED` from normal future games | **B** — locked, flag to Joe | The listings card contract specifies "right slot = favored-team logo + moneyline over O/U, else Sched/Final." Changing it reopens the lock (constraint 4). It does not pass Step 3: no factual error, no measured unpriced cost, no change in the world. **And its own justification is measurably wrong** — the slot is `minmax(58px, auto)`, so the 58 px floor is reserved whether or not the word is there. Removing "Sched" frees **0 px**. |
| 10 | **P1** Standardize matchup geometry to two stacked rows | **B** — locked, and the wrong fix | The card is locked; the `@`-hugging duel is explicit contract. The wrap is real and is already tracked (open item (e), prompt 25). But the audit's fix restructures a locked component to solve a width problem whose actual cause is the 78 px time column — see §8.a. |
| 11 | **P0** Reduce MLB card density / tier the information | **B** — locked | The card contract specifies the MLB probable line verbatim (`"F. Lastname (W-L, ERA)"` / `"Starter TBA"`) and odds already sit behind the ruled `show_odds` toggle. The audit asserts crowding and measures nothing. Does not pass Step 3. |
| 12 | **P1** Make availability a first-class visual signal | **C** (polish) — and see Reopener 2 | D4 ruled the line's *content*, never its *weight*. `.offsvc-line` is `var(--dim)` at 12 px — the same treatment as ordinary card metadata. Genuinely unconsidered. Prompt 24 made the line longer without making it louder. |
| 13 | **B — open, not ruled** `YOUR TEAMS` understated | **B (open)** | 05 §5 lists this as explicitly open: "Whether the `YOUR TEAMS` micro-label survives Joe seeing it rendered." Measured: `.favlabel` is `var(--faint)` 11 px uppercase — the faintest token in the system, by design (D6's call). The audit is an outside vote on a question Joe has not answered. Useful; not a reopener, because nothing was closed. |
| 13b | Product option: reorder bands to YOUR TEAMS → AVAILABLE → OTHER | **B** | D6 ruled favorites float *within* their band and rejected a separate pin band; the Cowork call on record is "the band never stops reading as a timeline." Restatement of a named trade-off. Does not reopen. |
| 14 | **P1** Contextual `Show all` labels | **C** (polish) | New. Shipped label is generic `Show all` / `Hide them` (`SportBand.js:91`); D4 ruled the mechanism, not the wording. Cheap, and **more accurate after prompt 24** — the toggle now hides only genuinely-off games, so "Show 6 not on your services" is now literally true. |
| 15a | **P0** Build a horizontal-scroll mobile timeline with a sticky rail | **B** — already built | Addendum M4/M6, shipped. `.mgrid-scroll { overflow-x:auto; -webkit-overflow-scrolling:touch }`; `.mrail-cell, .mgrid-axis-rail { position:sticky; left:0 }`. The audit asked for the thing that is there. |
| 15b | Optional: right-edge fade / partial next column | **C** (polish) | Absent, and the most likely explanation for why the auditor concluded the grid could not scroll. Cheap. |
| 15c | "Constrained at the right side / cannot present the entire time axis" | **C — CORRECTNESS** | Misdiagnosed but pointed at a real bug. See §6, item 1. |
| 15d | De-emphasize "every game is kept — nothing is deleted" on mobile | **C** (polish) | Real, and worse than the audit knew: the same sentence renders **twice** on one phone screen — `layout.js:29` as the global footnote and `MobileGrid.js:356` as a grid pill. |
| 16 | **P1** Flatten Weeks containers on mobile | **C** (polish) | New. Audit claims 20–30 px returned; **measured exactly 30 px** — `.weekblock` is `1px border + 14px padding` per side. Its number is right, at the top of its stated range. But see §8.a for a bigger, broader win. |
| 17 | **P1** Add a mobile day navigator to Weeks | **C** (polish, deferred) | New and reasonable. But prompt 23 just shipped the week dropdown and register §13 restyles it in prompt 25; adding a third stacked control before that settles is premature. |
| 18 | **P2** Increase secondary-text contrast | **C — CORRECTNESS (a11y)**, but over-scoped by the audit | Measured. See §6, item 2. The audit named five things; four of them pass. |
| 19 | **P2** Progressive disclosure for dense cards | **B** — already built | M11. `MatchupCard` is a `<button onClick={onOpen}>` (line 190) opening `GameDetail.js`. Tap-to-detail already exists on every card. |
| 20 | **P2** Evaluate PWA / iOS standalone | **A/B** — already built | `app/manifest.js` (`display:'standalone'`, `theme_color`, `background_color`, 192/512 icons), `app/apple-icon.png`, `appleWebApp` metadata. Two sub-items genuinely absent — see §6, item 3. |
| 21 | Treat CFB cards as the reference component | **D** | Premise false. There is one `MatchupCard.js` for every sport. CFB cards look cleaner because CFB games carry no probable-pitcher row and usually no odds — fewer optional rows, same component. "Make MLB more like CFB" is not a component change; it is a question about how many optional rows MLB shows, which is the locked card contract. |
| 22 | Responsive tiers 360–390 / 391–480 / tablet / desktop | **D** | No specific claim. The app has one breakpoint at 699 px used consistently; the audit's own advice is not to invent new ones. Nothing to do. |
| 23 | Accessibility / interaction audit | **C — CORRECTNESS (a11y)** | Two of its items verified true and measurable. See §6, items 4 and 5. |
| 24 | Performance considerations | **D** | Generic. No measured claim about this app. |
| 25–28 | Process, sequencing, regression checklist | **D** | Process instructions to the implementer, not findings. Superseded by the venue rule and the working rules. |

---

## 6. The bucket-C set, ranked — correctness, then data, then polish

### CORRECTNESS

**1. The mobile grid clips under pinch-zoom.** *(from §15c — the audit's observation, not its diagnosis)*

`MobileGrid.js:248` sets the canvas as:

```js
style={{ transform: `scale(${zoom})`, width: `calc(var(--rail-w) + ${scale.width}px)` }}
```

with `.mgrid-canvas { transform-origin: 0 0 }` and `zoom` clamped to `[0.6, 2.5]` (line 192). A CSS `transform` does not participate in layout, so the parent `.mgrid-scroll` computes `scrollWidth` from the **unzoomed** box. At `zoom = 2.5` the canvas paints 2.5× wider than its scrollable extent, so roughly **60% of the schedule is painted outside the scroller and cannot be reached by panning** — it is clipped at the right edge, which is precisely what the auditor described. Below 1.0 the inverse: dead scroll space. Height is wrong the same way.

The addendum's M6 promise is "pinned at every zoom level"; what actually happens is that above 1.0 the schedule becomes unreachable. **Fix:** wrap the canvas in a sizer element whose `width`/`height` are the natural dimensions × `zoom`, and keep `transform: scale(zoom)` with `transform-origin: 0 0` on the canvas inside it. This is the canonical pattern and it is a small, contained change. At `zoom = 1` — the default, and where every Playwright shot was taken — there is no symptom, which is why nine months of QA never saw it.

**2. `--faint` fails WCAG AA everywhere it is used, and prompt 24 just added another one.** *(from §18)*

Measured against the local background per working rule 13, not a global corner sample. The card is `linear-gradient(180deg, #31363d, #1e2126)`, so both ends matter:

| Token | Hex | vs card top `#31363d` | vs card bottom `#1e2126` | vs page ground `#1b1b1b` |
|---|---|---|---|---|
| `--dim` | `#9aa0a8` | 4.61:1 | 6.12:1 | 6.53:1 |
| `--faint` | `#6a7078` | **2.43:1** | **3.23:1** | **3.45:1** |

`--dim` passes AA (4.5:1) everywhere it lands. **The audit named five things and four of them are `--dim`:** records, division rank, games-back (`.tcol-rec`), and network text (`.mnet-text`). Those are fine and should not be touched.

The one that fails is `.tcol-pitch` — the MLB probable-pitcher line — at `--faint`, 11.5 px, sitting near the top of the card where the ratio is **2.43:1**. That is below AA *and* below the 3:1 non-text floor. It is used in 16 places overall, including `.favlabel` (the `YOUR TEAMS` micro-label, 11 px uppercase at 3.45:1) and — added at `10efae7` this morning — `.mgrid-note`, the grid's only explanation of what happened to the network-TBD games, at 3.04:1. **Shipping the newest state's sole explanation in the least readable token in the system undercuts the ruling that made it always-visible.**

Recommendation: lift `--faint` toward roughly `#868d96` (≈4.5:1 on the card top) and leave `--dim` alone. That preserves the three-step hierarchy — ink / dim / faint — while moving the bottom step above the floor. It is a one-token change and it fixes all 16 sites at once.

**3. iOS standalone status bar and safe-area handling are absent.** *(from §20 — the sub-items the audit's own P2 buried)*

The PWA is built. What is missing is narrow and specific: `appleWebApp` in `layout.js` carries only `title`, so `apple-mobile-web-app-status-bar-style` is never emitted and iOS defaults to `default` — a light bar above a `#1b1b1b` app. `black-translucent` is the right value here, and it is one property. Separately, there is no `env(safe-area-inset-*)` and no `viewport-fit=cover` anywhere in the app (verified: zero occurrences). The consequence is bounded — without `viewport-fit=cover` iOS keeps content inside the safe area on its own — but it means the banner cannot bleed to the edges in the installed app, which is the whole reason the banner is full-bleed. **These two belong together and are worth doing precisely because the rest of the PWA is already there.**

**4. Selected state is not exposed to assistive technology.** *(from §23)*

Verified absent: there is no `aria-pressed`, `aria-current`, `aria-selected` or `role` on any chip in `Filters.js`, `SportBand.js` or `weeks/page.js`. Selection is carried entirely by `data-active` and CSS. A screen reader hears "All, button" with no indication which sport is active — and the audit's own §23 line "color is not the only method used to communicate important state" is exactly right here. `aria-pressed={sport === s}` on the sport chips and `aria-current="page"` on the Weeks view links. Small, correct, and it also gives the §8 fix its proper form: delete the visible `Sport` span and put `role="group" aria-label="Sport"` on `.chiprow`.

**5. Tap targets are roughly half the recommended size.** *(from §23)*

Measured from the shipped CSS: `.chip { padding: 5px 11px; font-size: 12px }` computes to about **26 px** tall. `.offsvc-toggle { padding: 0 }` on 12 px text is about **15 px**. `.mgrid-nav button { padding: 3px 10px; font-size: 11px }` is about **22 px**. Against the ~44 px guideline these are all short, and the Show-all toggle in particular is a 15 px target that gates access to filtered games. Padding alone fixes it without changing any visual weight if the extra height goes on as transparent padding rather than visible chrome.

### POLISH — in the order I would take them

**6. The `SPORT` label, deleted.** *(§8)* One span, zero semantic cost, buys back a line at 390 px. Pair with item 4's `aria-label`.

**7. Chip row: `nowrap` + `overflow-x:auto`.** *(§7 / Reopener 1)* Must ride prompt 25 with the chip rebuild, not after it.

**8. Contextual `Show all` copy.** *(§14)* `Show 6 not on your services` / `Hide them`. Now literally accurate.

**9. Right-edge fade on the grid scroller.** *(§15b)* The affordance that would have prevented the audit's own misreading.

**10. The duplicate "nothing is deleted" sentence.** *(§15d)* Drop the `.mgrid-foot` pill; the global footnote already says it on every page.

**11. Availability line weight.** *(§12)* `--ink` on the "N available to you" segment only, leaving the rest `--dim`. Do this *after* the Reopener-2 wrap question is settled, not before — they touch the same element.

**12. Weeks container flattening.** *(§16)* +30 px measured. Real, but strictly smaller than item 13 and confined to one route.

**13. Day navigator on Weeks.** *(§17)* Defer past prompt 25.

**14. Sticky compact header.** *(§6)* Defer. It is the highest-risk item on the list for the smallest benefit: a sticky page header above a horizontal scroller that itself depends on `position: sticky` (M4's rail) is exactly the combination iOS Safari handles worst, and M4 is load-bearing.

---

## 7. Proposed sequence

**Nothing here should be written until you confirm no Claude Code prompt is in flight** (working rule 2). HEAD landed at 12:18 ET, ~8 minutes before I started reading — I could not tell from the repo whether prompt 24 had finished or was still running, and the tree being clean is not proof.

**Rides prompt 25 (the visual pass), because it is already opening these exact files:**

- Reopener 1 — the real `.chiprow` change, written explicitly into the prompt rather than assumed. **This one is not optional**: without it, prompt 25 ships four new chips into a wrapping row and makes the observed problem worse.
- The `--faint` token lift (item 2). One token, fixes 16 sites including the `.mgrid-note` that landed this morning.
- `aria-pressed` / `aria-current` and the tap-target padding (items 4 and 5).
- Delete the `SPORT` span, add `role="group" aria-label="Sport"` (item 6).
- Contextual `Show all` copy (item 8).
- Drop the duplicate `.mgrid-foot` pill (item 10).
- A 390 px render of `?day=2026-11-14` to settle Reopener 2 before anything touches `.offsvc`.

**Its own prompt (26), because it is a behavioural fix in a locked component with a real regression surface:**

- The `MobileGrid` zoom/layout clipping fix (item 1), with a test that asserts `scrollWidth` tracks `zoom`. This touches M6 and should not share a run with a logo audit, for the same reason prompt 24 was split from 25.
- The iOS standalone status bar and safe-area work (item 3) can ride here — it is small and independent.

**Waits, deliberately:**

- Weeks flattening (12) and the day navigator (13) — after prompt 25 settles the week control's styling.
- Sticky header (14) — after the mobile page reorder, if ever.
- The 78 px time column (§8.a below) — it is already on the prompt-25 list; the audit's §10 and §16 are both arguments for doing it, and neither auditor nor register connected them.

**Needs a decision from you before anything moves:**

1. **Reopener 2** — let the count line wrap on heavy days, or shorten it? (I recommend: let it wrap, change nothing, but look at it at 390 px first.)
2. **§9 `SCHED`** — the audit wants it gone. It is locked card contract, it does not pass the reopening test, and its stated justification is measurably wrong (it frees 0 px). I am flagging it rather than dismissing it because constraint 4 says lock-touching proposals are your conversation, not mine. My recommendation is to leave it.
3. **§13 `YOUR TEAMS`** — 05 §5 has this open pending your eye. The audit votes "too understated." It renders at `--faint`, 11 px, 3.45:1. Item 2's token lift would raise it to ~4.5:1 without any other change, which may be all it needs.

---

## 8. What the audit missed

**a. The 78 px time column is the real cause of the wrap the audit complains about in §10 — and fixing it is worth more than everything in §16.**

Measured at 390 px: `.shell` takes 20 px per side, `.weekblock` 15 px per side, `.mcard` padding 14/17 px. Card content box on Weeks ≈ **287 px**. The grid is `78px | minmax(0,1fr) | auto | minmax(58px,auto)` with three 14 px gaps — so 178 px is fixed before the matchup gets anything, leaving about **109 px** for the team names and the network mark. That is why the `@` wraps and why the mark lands against "Stanford."

The 78 px is deliberate and documented in the stylesheet: the reference uses 44 px for a stacked `12:35 / ET`, and this app renders `12:00 PM ET` on one line. But **78 px is 27% of the card's usable width spent on the time**, and reclaiming 34 px of it returns more than flattening the entire Weeks container (30 px) — on *every* surface, not one route. It is already on the prompt-25 list as "the 78 px time column." What is new is that §10 and §16 are both arguments for it, and the audit proposed restructuring a locked component instead.

**b. The audit sampled the app on the one day of the season where none of its hard problems exist.**

September 3 is a fully-announced day: MLB is 0% bare because RSN deals are static, and CFB is 0% bare through week 3. So the audit's judgments about card density and count-line length were made against a 20-game day with a three-segment count line and zero `NETWORK TBD` badges. On 2026-11-14 the same page carries 56 games, a four-segment line, and 45 cards wearing a badge the auditor never saw. **53.4% of the loaded season was invisible to this audit** — and prompt 24 took that day from 6 visible cards to 51 four hours after the audit was written, so the density question the audit answered no longer exists in the form it answered it. Any future outside review should be pointed at `?day=2026-11-14` and `?day=2027-01-10`, not at today.

**c. `NETWORK TBD` and `MARKET TBD` share a card corner with the odds cluster.**

Both `::after` rules are `top: 6px; right: 8px`. §9's mutual-exclusivity test guarantees the two badges never collide *with each other* — but the handoff already carries the open nit "the MARKET TBD badge sits tight above the odds cluster at the card's top-right," and prompt 24 has now put a second badge in the same place. The test that shipped does not cover the collision that actually exists.

**d. The Today page still carries the `<p class="sub">` explainer you deleted from Weeks.**

`app/page.js:104` renders "20 games on this viewing day · all sports." You ruled that explainer off the Weeks page this morning; the Today page kept its equivalent, and it now duplicates information the per-band count lines carry more precisely one scroll below it. If the mobile hero really is eating the fold — and it is not, at 322 px — this is the line to take, not the banner.

**e. The audit's process instructions (§25–§28) conflict with your venue rule and should be ignored as such.**

It asks Cowork to inspect the code and then implement in six controlled groups. That is Claude Code's job under the venue ruling; Cowork's half is "what should it be." I have followed your rule, not the document's. Worth saying plainly because a future reader of the audit will hit §25 and may take it as an instruction.

**f. Nothing in the audit touches the privacy item, and nothing needed to.**

Per constraint 5 I checked: no finding, recommendation or example in the audit names WUAB, RESN, or any Cleveland regional carriage arrangement. Its examples are FOX, CBS, ACC Network and NFL+. There is no privacy exposure in the document and none in acting on it. The standing pre-Cavs-season gate is unaffected.

---

## 9. What I need from you

1. **Confirm nothing is running.** Prompt 24 pushed at 12:18 ET. Nothing above should be written to the repo until you confirm Claude Code is idle.
2. **Pick the scope** from §7. I have not written the Claude Code prompt — the seed says wait for you, and the split between prompt 25 and a new prompt 26 is a judgment I would rather you make than inherit.
3. **Answer the three decisions** in §7: the count-line wrap, `SCHED`, and `YOUR TEAMS`.
4. **Consider adopting working rule 22** — "before asserting what a component does, read the component; cite file and line, not the contract that describes it." Prompt 24 proposed it off two instances. Reopener 1 is the third, and it is the one that would have cost real money: prompt 25 was about to ship four new chips into a row everyone believed already scrolled. Related housekeeping in §2: rule 21 is now obsolete and `docs/handoff-status.md` still reports HEAD `b44893e`.
