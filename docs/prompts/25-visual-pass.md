# Claude Code — Prompt 25: the visual pass

**Repo:** `C:\Users\jlull\Joe's Projects\Apps - Personal\MySports` · **main**
**Preconditions to verify before stage 1, hard stop if any fail:**

- `git rev-parse HEAD` == `10efae7cd20cf8e3f1d3d2d9a7ada523ed36fa5d`, and `HEAD == origin/main`.
- Python **200 OK (skipped=1)**, JS unit **138/138**, smoke **30/30**, qa-shots **8/8**.
- Tree clean apart from untracked `assets/` and `artifacts/`.

**Authority for this prompt:** `enhancement-register.md` §13 (chips, league marks, AEW amendment), `docs/feature-study/05-home-page-decisions.md` (binding, D1–D6 + §8 + §9), `docs/rendering-contract.md` v1.6.5, `docs/rendering-contract-mobile.md` Addendum v1.1, `docs/handoff-status.md` working rules 1–21, and `claude/audit-triage-2026-09-03.md` (the triage that produced stages 5–9).

**Standing rules that bite in this prompt:** rule 3 (secret gate, ADDED lines only, `grep` never `findstr`), rule 4 (stage by explicit path, never `git add -A`), rule 7 (self-committing stages, 2-strikes-skip, hard stops only for secret-gate / destructive-DB / push-reject), rule 13 (measure a numeric threshold against the local background, not a global corner), rule 16 (colour tokens read from `globals.css`, never quoted from the mockups), rule 17 (edit JSON through a parser), rule 20 (never a bare repeated string replace — line-anchored surgery or a parser, and assert only the intended region changed).

**This prompt touches no database and no pipeline code.** If a stage seems to need either, stop and report.

---

## A rule this prompt exists partly to enforce

Three times now a prompt has asserted what a component does by reading a **contract document** instead of opening the **file**: the `bootstrap_season` workflow that loaded only teams; prompt 24 stage 4's premise that no-broadcast games vanished from the phone grid; and — found in triage — register §13's claim that `.chiprow` already scrolls.

**Stage 1 adds this as working rule 22.** For the rest of this prompt: before you assert what any component does, open it and cite file and line. Every claim below is cited that way. If a citation does not match what you find, **stop and report the discrepancy** rather than implementing around it.

---

## Stage 1 — documentation housekeeping (commit on its own)

Three corrections, all in `docs/handoff-status.md`:

1. **Line 8 still reads `HEAD **b44893e**`.** Prompt 24 committed the doc Cowork had written and then landed four more commits on top of it. Refresh the repo-state paragraph to `10efae7` with the prompt-24 chain (`dff0725` → `f15449f` → `2024c21` → `a1f7364` → `10efae7`) and the current gate numbers (Python 200 OK skipped=1, JS **138/138**, smoke 30/30, qa-shots 8/8).
2. **Retire working rule 21.** It reads "…is the only honest tree check **until** `.gitattributes` covers `.js/.mjs/.jsx/.css/.html`." `f15449f` met that condition — `.gitattributes` now lists all five, and `git diff --name-only` returns empty from a Linux shell. Replace rule 21 with a one-line note that the CRLF hazard is closed and what closed it, so a future session does not keep working around a fixed problem. Delete the "CRLF caution" block under Repo state or reduce it to that one line.
3. **Add working rule 22:** *Before asserting what a component does, read the component and cite file and line — never the contract document that describes it. Three prompts have shipped or nearly shipped a wrong premise this way (`bootstrap_season`, prompt 24 stage 4, register §13's `.chiprow`).*

Mirror nothing to the Claude project — Cowork owns that copy.

---

## Stage 2 — the chip row (register §13) — REBUILD, and the CSS is NOT free

**Read first:** `web/components/Filters.js` (`SportFilter`, lines ~38–78), `web/lib/config.js:26` (`SPORTS`) and `:28` (`SPORT_LABEL`), `web/app/globals.css:231` (`.chiprow`), `:237` (`.chip`), `:249` (`.chip[data-active='true']`), `:1474` (`.chip-league`, `.chip-mark`), `:1476` (the 699 px `.chip-mark` height override).

### 2a. The `.chiprow` correction — do this first, and do not skip it

Register §13 justifies the horizontally scrolling row on the premise that *"the locked reference already sets `overflow-x:auto` on `.chiprow`, so that is reference behaviour."* **That premise is false.** Verify it yourself before proceeding:

```
web/app/globals.css:231   .chiprow { display: flex; flex-wrap: wrap; gap: 6px; }
```

and

```
grep -rn "chiprow" --include=*.css --include=*.html . | grep -v node_modules
```

The only `.chiprow` in the tree carrying `overflow-x:auto` is `docs/feature-study/mockups/home-page-candidates.html:16` — the feature-study mockup, not the locked reference. The ruling's *direction* stands; only its cost was mispriced.

**So the scrolling row is a real change you must write:**

- `.chiprow` → `flex-wrap: nowrap; overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: thin;` and keep the 6 px gap. Follow the pattern already proven at `globals.css:707` (`.mgrid-nav`), which is the same control shape and already works on iOS.
- `.chip` → add `flex: 0 0 auto; white-space: nowrap;` so chips cannot compress or wrap internally.
- The row must not introduce page-level horizontal scrolling. Assert it does not.

**Without 2a, stage 2b makes the observed problem worse**, not better: it adds four chips to a row that still wraps.

### 2b. Marks only, no text

Per §13: sport filter chips carry the **league mark only**. Remove the `<span>{SPORT_LABEL[s] || s.toUpperCase()}</span>` at `Filters.js:74`. **"All" stays text** — it is the one chip that is not a league.

Removing the visible label removes the accessible name, so each league chip needs `aria-label={SPORT_LABEL[s] || s}` on the `<button>`. The `<img>` stays `alt=""` — a screen reader should hear "NFL" once, not twice. This is not optional: without it the chips become unlabelled buttons.

### 2c. Add the four new chips — and no AEW chip

`SPORTS` becomes `['cfb','nfl','nba','nhl','mlb','nascar','indycar','ufc','wwe']`. `SPORT_LABEL` gains `nascar: 'NASCAR'`, `indycar: 'IndyCar'`, `ufc: 'UFC'`, `wwe: 'WWE'`.

**AEW gets no chip** (register §13, amending §9). AEW still loads, still appears under **All**, still renders on the grid on its networks. `public/leagues/aew.png` and `aew_dark.png` exist and stay where they are — do not delete them, and do not add an `aew` entry to `SPORTS`.

`CHIP_MARK` at `Filters.js:37` maps `cfb → cfp`; the four new sports map to themselves. Confirm each file exists in `web/public/leagues/` before wiring it — all eight are present as of `10efae7`.

**Check `SPORTS` for other consumers before changing it.** Grep every import. If `SPORTS` drives a query, a bucket, a route or a test anywhere beyond the chip row, adding four sports with no data could change behaviour on surfaces this prompt is not meant to touch. If it does, **stop and report** rather than working around it.

### 2d. The selected-chip rule and the empty states

- Active chip sits on a gold plate → **raw** art, not `_dark` (contract v1.3e, light plate = raw). Already correct at `Filters.js:70`; confirm the mark still swaps once the text is gone.
- Do **not** filter the dark mark to black to make it work on gold. Prompt 22's first attempt did that and flattened the MLB roundel.
- Each of the four new chips selects to an **honest empty state** naming why it is empty and when data arrives, per §13 — e.g. "NASCAR arrives with the playoffs, September 6"; "IndyCar's 2026 season ends this month; the 2027 schedule publishes in October". Not a bare "no games". `app/page.js:117` holds the current empty-state copy; extend it per sport rather than replacing the general case.

### 2e. Do not squash the marks

§13's measured widths at a 21 px chip height: NBA 9 px · CFP 15 · NFL 15 · NHL 19 · WWE 23 · IndyCar 30 · MLB 40 · UFC 60 · **NASCAR 126**. Ten chips ≈ 680 px against 390 px. That is why the row scrolls. `.chip-mark` is `height: 15px` (13 px at ≤699 px) with `width: auto` — keep aspect ratio, never set a width.

**Acceptance:** no chip wraps at 360, 390 and 430 px; every chip reachable by horizontal swipe; the selected chip is visibly active *and* announced as pressed (stage 4); no page-level horizontal scrollbar at any of the three widths; desktop unchanged above 699 px.

---

## Stage 3 — logo two-state audit

**Confirmed lead:** `web/public/leagues/nfl.png` and `nfl_dark.png` are **both exactly 28,678 bytes**. Every other pair in that directory differs in size. Byte-size equality is suggestive, not proof — **compare pixels**, not sizes.

For all nine league pairs now on chips plus `aew`:

1. Report whether raw and `_dark` are pixel-identical.
2. For any identical pair, apply the `_dark` treatment through the existing builder — `scripts/build_brand_marks.py` / `scripts/build_web_marks.py`, whichever owns `public/leagues/`. **Never hand-edit a PNG and never hand-edit a manifest** (the frozen network-mark manifest is a separate, locked file — this stage touches `leagues/`, not `marks/`).
3. Measure each `_dark` variant's luminance on the charcoal ground (`--spot-2` `#1b1b1b`, read from `globals.css:55` per rule 16) and each raw variant on the gold plate (`--gold` `#f0c850`, `globals.css:69`). Report the numbers. Rule 13: measure against the local background, not a corner sample.
4. `nascar_dark.png` was rebuilt by hand in an earlier session (black letters whitened, coloured bars kept). Verify it still reads correctly on charcoal before assuming it is fine.

**If a mark needs new art rather than a treatment, stop and report it.** Sourcing art is Cowork's job, not this prompt's.

---

## Stage 4 — accessibility: state, labels and targets

Joe's ruling on `YOUR TEAMS` is still open, so **do not change `.favlabel`'s size, weight or letter-spacing** in this stage. Its colour changes only as a side effect of stage 5.

### 4a. Selected state is invisible to assistive technology

Verified absent: no `aria-pressed`, `aria-current`, `aria-selected` or `role` on any chip in `components/Filters.js`, `components/SportBand.js` or `app/weeks/page.js`. Selection is carried entirely by `data-active` + CSS, so a screen reader hears "All, button" with no indication of what is active.

- Sport chips (`Filters.js`): `aria-pressed={sport === s}` on each `<button>`, and `aria-pressed={!sport}` on "All".
- Weeks view chips (`app/weeks/page.js:155,158`): these are `<Link>`s, not buttons — use `aria-current={view === 'calendar' ? 'page' : undefined}` and the same for `'season'`.
- Keep `data-active` — it is the styling hook and stage 2's gold plate depends on it. Add the ARIA alongside; do not replace one with the other.

### 4b. The `Sport` and `View` labels are decoration — delete them

`components/Filters.js` renders `<span className="control-label">Sport</span>` and `<span className="control-label">Day</span>`. Both are **bare spans, not `<label for>`**, wired to nothing. They have zero accessibility value today, and the audit is right that `SPORT` reads as detached from the chips it labels.

- Delete the `Sport` span. Put `role="group" aria-label="Sport"` on the `.chiprow` in its place — that is the accessible name the span was pretending to be.
- Delete the `View` span at `app/weeks/page.js:153` and put `role="group" aria-label="View"` on that `.chiprow`.
- **Keep the `Day` label.** The date `<input>` has `aria-label="Viewing day"` already, but "Day" is doing visible work in front of a control whose own text is a date. Leave it.
- **Do not touch `WeekSelect.js`'s label.** `components/WeekSelect.js:32` is a real `<label htmlFor="week-select">`. It is correct as it stands. This is the one `control-label` in the app that is not decoration — that is exactly why it must be read before being deleted.

### 4c. Tap targets

Measured from the shipped CSS: `.chip` (`globals.css:237`, `padding: 5px 11px`, 12 px) computes to about **26 px**; `.offsvc-toggle` (`:1381`, `padding: 0`, 12 px) to about **15 px**; `.mgrid-nav button` (`:718`, `padding: 3px 10px`, 11 px) to about **22 px**. The guideline is ~44 px.

Raise all three toward 44 px **without changing visible weight** — add height as transparent padding or a `min-height` plus centring, not as visible chrome. The `.offsvc-toggle` matters most: it is a 15 px target gating access to filtered games. Report the computed heights before and after.

---

## Stage 5 — the `--faint` token fails WCAG AA everywhere it is used

Measured at `10efae7` against the local background per rule 13. The card is `linear-gradient(180deg, var(--panel-top) #31363d, var(--panel-bottom) #1e2126)` (`globals.css:304–316`), so both ends matter:

| Token | Hex | vs `#31363d` | vs `#1e2126` | vs `#1b1b1b` |
|---|---|---|---|---|
| `--dim` (`:66`) | `#9aa0a8` | 4.61:1 | 6.12:1 | 6.53:1 |
| `--faint` (`:67`) | `#6a7078` | **2.43:1** | **3.23:1** | **3.45:1** |

`--dim` passes AA (4.5:1) everywhere it lands. **Leave `--dim` alone** — `.tcol-rec` (records, division rank, games back), `.mnet-text` (network text) and `.offsvc-line` all use it and all pass. An outside audit named those four as low-contrast; the measurement clears them.

`--faint` fails AA at every background in the app and fails even the 3:1 non-text floor on the card top. It is used in 16 places, including `.tcol-pitch` (`:422–423`, the MLB probable-pitcher line, at **2.43:1**), `.favlabel` (`:1391`) and — added by prompt 24 at `10efae7` — `.mgrid-note` (`:1065`), which is the grid's only explanation of what happened to network-TBD games.

**Change:** lift `--faint` to approximately `#868d96` — roughly 4.5:1 on the card top — and change nothing else. One token, all 16 sites.

**Then verify the hierarchy survives.** The point of `--faint` is to be a third step below `--dim`, not to be unreadable. Render `?day=2026-09-03` and `?sport=mlb` at 390 px and confirm the probable line still reads as subordinate to the record line above it. If `#868d96` collapses the two steps visually, report the render and propose a value rather than picking one silently — the target is "secondary, not disabled".

Re-measure and report all three ratios after the change.

---

## Stage 6 — the week control and two copy fixes

### 6a. The week control's gold — one attribute

Joe's ruling (a), 2026-09-03: the control renders gold directly beneath the gold "Season week" chip and two stacked gold pills read as two selected chips; it becomes the **inactive** chip style with a caret, because the control is a *trigger*, not a selected state.

The cause is one hardcoded attribute:

```
web/components/WeekSelect.js:35   <span className="chip chip-select" data-active="true">
```

which fires `.chip[data-active='true'] { color:#1b1b1b; background: var(--gold) }` at `globals.css:249`. **Remove `data-active="true"`.** The caret already exists (`.chip-select::after`, `globals.css:1506`) and inherits `currentColor`, so it follows the inactive colour automatically. Confirm the caret is still visible against the inactive `--dim` after the change; if it is not, that is the only additional CSS this sub-stage may add.

### 6b. Contextual `Show all`

`components/SportBand.js:91` renders `{showAll ? 'Hide them' : 'Show all'}`. The toggle only appears when `summary.offCount` is non-zero, and after prompt 24 it reveals **only genuinely off-service games** — market-pending and network-TBD are never hidden. So the count is exact and the label can say it:

- collapsed: `Show {offCount} not on your services`
- expanded: `Hide them` (unchanged)

Match the count line's existing vocabulary exactly — "not on your services", not "unavailable". Singular/plural is not an issue; the phrase does not inflect.

### 6c. The duplicated sentence

"Every game is kept — nothing is deleted" renders **twice on one phone screen**:

```
web/app/layout.js:29          Every game is kept in the database — nothing is deleted. Reads are anon, read-only, live.
web/components/MobileGrid.js:356   <span className="pill">every game is kept - nothing is deleted</span>
```

**Delete the `MobileGrid.js:356` pill.** The global footnote already carries the statement on every page, and inside the grid the sentence competes with `{onGrid} on the grid`, the kickoff-TBA pill and the new `.mgrid-note` — four pieces of chrome under a schedule. Keep `{onGrid} on the grid` and the kickoff-TBA pill; keep `.mgrid-note` exactly as prompt 24 shipped it.

M9 says "footer pills wrap; the omitted pill is never dropped" — that rule is about *conditional* pills being omitted when their count is zero. It does not require this static pill. Confirm `gridnote.test.mjs` and any M9 test still pass; if one asserts on this pill specifically, report it before changing the test.

---

## Stage 7 — MEASURE AND REPORT ONLY. Change nothing in this stage.

Three questions are open with Joe and must not be answered by this prompt. Produce evidence, not edits.

### 7a. The count line at 390 px on a heavy day

Prompt 24 gave the count line a fourth segment. `globals.css:1484` still carries prompt 22 stage 5c's intent — *"One line, so it lays out as a line rather than a stack."*

Render `/?day=2026-11-14` at **390 px** and report:

- the literal rendered count string for every band;
- how many lines `.offsvc-line` occupies, and whether the `Show all` toggle drops below it;
- the measured pixel width of the longest string against the available width.

Cowork's arithmetic predicts the string `56 games · 6 available to you · 45 network TBD · 5 not on your services` runs ≈419 px against ≈278 px available and wraps to two lines plus a third for the toggle. **That is arithmetic, not a render — rule 13 says measure.** Confirm or refute it. Attach the screenshot. **Joe decides after seeing it; do not shorten, truncate or restyle the line.**

### 7b. The 78 px time column

`globals.css:312` — `grid-template-columns: 78px minmax(0, 1fr) auto minmax(58px, auto)` with three 14 px gaps and `padding: 10px 14px 10px 17px`. The comment at `:307–311` records why 78 px rather than the reference's 44 px: this app renders `12:00 PM ET` on one line where the reference renders a stacked `12:35 / ET`.

At 390 px on `/weeks`, `.shell` takes 20 px per side and `.weekblock` (`:596`) 15 px per side. Report:

- the measured content width of `.mcard` on `/` and on `/weeks`;
- how much of it the four columns and three gaps consume before the matchup gets anything;
- the measured width remaining for `.mbody`;
- and the widths at which the `@` wraps and at which the network mark abuts the home team name.

**Do not change the column.** Narrowing it means changing the time format, which is a design decision and Cowork's call.

### 7c. The grid at maximum zoom

`components/MobileGrid.js:248` applies `transform: scale(zoom)` to `.mgrid-canvas` while setting its layout `width` from the unzoomed scale; `zoom` clamps to `[0.6, 2.5]` at `:192`; `.mgrid-canvas` has `transform-origin: 0 0` at `globals.css:743`.

At 390 px on `/?sport=cfb&day=2026-09-05`, report `.mgrid-scroll`'s `scrollWidth` and `clientWidth`, and `.mgrid-canvas`'s `getBoundingClientRect().width`, at `zoom = 1`, `zoom = 2.5` and `zoom = 0.6`. **Report the numbers only.** The fix rides prompt 26; this stage exists so prompt 26 starts from a measurement rather than a theory.

---

## Stage 8 — report

Per stage, in this order: what changed, the commit sha, the acceptance evidence, and every judgment call you made with its reasoning. Then:

- **Gates:** Python, JS unit, smoke, qa-shots — before and after.
- **Chips:** screenshots at 360 / 390 / 430 px showing all ten chips scrolling on one line, plus each of the four new chips selected showing its empty state.
- **Logos:** the pixel-identity table for all ten pairs and the luminance measurements from stage 3.
- **Contrast:** the three `--faint` ratios before and after, and the 390 px MLB card render proving the hierarchy survived.
- **Stage 7:** the three measurement sets and their screenshots, presented as evidence for Joe, not as findings you acted on.
- **Anything you were told and found to be wrong.** Register §13's `.chiprow` claim is already known to be wrong; if any other citation in this prompt does not match the file, say so plainly. Working rule 22 exists because that has happened three times.

---

## Explicitly out of scope

- **The mobile page reorder ("YOUR TEAMS → grid → rest").** It sits on the old prompt-25 queue, but `components/Listing.js:66–100` already renders listings first with a jump chip and the grid after the bands, and hoisting favourites out of their bands to the top of the page contradicts **D6**, which ruled favourites float *within* their own sport band with no separate pin band and no duplicated card. **Cowork has raised the contradiction with Joe. Do not implement it.**
- **The 78 px time column** — measured in 7b, not changed.
- **The count line** — measured in 7a, not changed.
- **`SCHED` in the right slot** — locked card contract; Joe has opened it as a separate design conversation.
- **`.favlabel`'s size or weight** — Joe's ruling still open.
- **The `MobileGrid` zoom fix and the iOS standalone work** — prompt 26.
- **Anything in `pipeline/`, `adapters/` or the database.**
