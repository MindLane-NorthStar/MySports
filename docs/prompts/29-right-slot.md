# Claude Code — Prompt 29: the card's right slot

**Repo:** `C:\Users\jlull\Joe's Projects\Apps - Personal\MySports` · **main**

**Preconditions, hard stop if any fail:**

- `git rev-parse HEAD` == `5afb9b3`, and `HEAD == origin/main`.
- Python **200 OK (skipped=1)**, JS unit at whatever prompt 28 left, smoke **30/30**, qa-shots **8/8**.
- Tree clean apart from untracked `assets/` and `artifacts/`.

**This prompt reopens the locked listings card.** Deliberately, with Joe's ruling, and it is the only prompt that may. Contract v1.6.5 → **v1.6.6**, and `docs/design/mobile_demo.html` changes in the same commit as the code — see stage 5.

**Working rule 22 applies.** Line numbers below were read at `5afb9b3`; they have drifted after every prompt this week. Locate by content, report any citation that does not match.

**Standing rules:** rule 3 (secret gate, ADDED lines only, `grep`), rule 4 (stage by explicit path), rule 7 (self-committing stages), rule 13 (measure against the render), rule 20 (no bare repeated string replace).

**No database, no pipeline, no adapters.**

---

## Stage 1 — MEASURE FIRST, and report before you build

Joe explicitly chose "measure first, then ask me" on card height. Stage 2 is written to fit inside today's height so nothing can grow without his say-so, but he wants the real numbers either way. **Do this stage before you change anything.**

At **390 px**, on `/?day=2026-09-03` (MLB, three body lines) and `/?day=2026-09-05` (CFB, two body lines), report:

1. The rendered height of `.mcard` for each sport.
2. The height of each of the card's four columns inside it — which one is currently setting the row height.
3. The height a three-row slot would need at comfortable sizes: a 24 px mark (what `.mslot img` uses today), the 15 px `.mscore`, and the 13 px `.mslot-state`, plus gaps.
4. **How much each sport's card would grow** if the stack were left unconstrained.
5. The largest row-1 mark that fits inside today's height for each sport.

Report all five before proceeding. Then build stage 2 **constrained** — nothing gets taller. If the constrained mark is so small it reads badly, say so plainly with the screenshot and let Joe rule; do not grow the card to fix it on your own.

---

## Stage 2 — the slot's priority ladder

**Read first:** `web/components/MatchupCard.js` lines ~156–184 (the `.mslot` block), `web/lib/format.js` lines ~101–125 (`resultLabel`, `hasScore`, `liveClockLabel`), `web/app/globals.css` `.mslot` (~524), `.mslot img`, `.mslot-ml`, `.mslot-ou`, `.mslot-state`, `.mscore`.

### 2a. The bug — exceptions must outrank odds

Today the branches run: score, then odds, then status, with the odds branch gated only on `!score`.

```js
{score       ? <score/>            : null}
{fav && !score  ? <odds/>          : null}   // ← fires for a postponed game
{!fav && !score ? <state/>         : null}   // ← unreachable when odds exist
```

A postponed or cancelled game has no score, so **when odds are posted the card shows the moneyline and never prints the postponement.** Zero games in the loaded season are postponed today, so this has never fired — it goes live on the first rain-out.

**The locked reference already has the right instinct** (`docs/design/mobile_demo.html`, `rcol()`): it tests `result_status === "final"` *before* odds. The shipped card inverted that order. This is drift, like the nine findings prompt 22 repaired.

### 2b. The ladder, in order

Put the decision in `web/lib/format.js` as a pure function beside `resultLabel` and `hasScore` — not inline in the component — so it can be tested without a DOM.

| # | Condition | Row 1 | Row 2 | Row 3 |
|---|---|---|---|---|
| 1 | `postponed` or `cancelled` | — | — | the word, e.g. `Postponed` |
| 2 | `final` or `in_progress` **with** both scores | winner's mark, or `TIED` | score, **higher number first** | `Final` (gold) or the live clock |
| 3 | `in_progress` **without** scores | — | — | the clock, or `Live` |
| 4 | `scheduled` **with** odds | favourite's mark | moneyline | `O/U <total>` |
| 5 | `scheduled` **without** odds | — | — | an em dash `—`, `var(--faint)` |

Row 1 above row 2 above row 3, always. Rungs 1, 3 and 5 render one row, not three — the slot does not reserve empty rows.

**Rung 5 is the count Joe ruled on:** roughly 1,042 of 1,325 future games, four out of five. The dash replaces the word `Sched`, which restated what the gold time two columns left already said. `Sched` disappears from the app entirely — grep for it and confirm nothing else prints it.

### 2c. The winner, the tie, and the score order

- **Winner = the higher score.** Their mark on row 1, using `teamLogoDarkUrl` — the same helper the odds branch already uses, and correct per contract v1.3e (floating on charcoal takes the derived dark art, not the raw).
- **Score reads higher number first**, whichever side that is. `7 - 14` becomes `14 - 7`. Keep today's separator.
- **Equal scores render the word `TIED` on row 1**, and row 2 keeps the away–home order since order is moot when the numbers match. This includes `0 - 0` at the opening whistle, which is most live games for their first minutes.
  - **Cost named at decision time and accepted by Joe:** `TIED` puts a word where every other card has a mark, so the column stops reading as one shape while a game is level. He chose it over a blank row and over showing both marks.
- **Consequence Joe accepted:** sorting by magnitude means position no longer tells you away from home. The row-1 mark carries that now, and the matchup two columns left still reads `away @ home`.

### 2d. Odds restack to match

Rung 4 today renders the favourite's mark and, beside it, the moneyline with O/U stacked underneath — a two-part cluster. **Restack it to the same three rows:** mark, then moneyline, then `O/U`. One shape in every state, so a mixed Saturday of scores and lines does not alternate between two silhouettes in the same column.

### 2e. Layout

`.mslot` is `display: flex; align-items: center; gap: 9px` — a horizontal row. It becomes a **column**: `flex-direction: column; align-items: flex-end; gap: <small>`. Keep `justify-self: end` and the `minmax(58px, auto)` grid track — **do not remove the 58 px floor.** It is what keeps team names aligned down the page; without it every card's matchup column would be a different width and the list would go ragged, which is a regression the audit itself warned about.

### Tests

Pin the pure function in `web/test/`, fixtures not DOM:

- higher score first when the **away** side leads, and when the **home** side leads;
- equal scores → `TIED`, no mark, away–home order preserved;
- `0 - 0` in progress → `TIED`;
- `postponed` **with** odds → the word, never the moneyline;
- `cancelled` **with** odds → the word;
- `final` **with** odds → the score stack, never the moneyline;
- `in_progress` with null scores → clock only, no mark, no score row;
- `scheduled`, no odds → the dash;
- `result_status` **null** (7 such games in the loaded season) → the dash, no crash.

### Acceptance

- Screenshots at **390 px and 1440 px** of: a final, a live game, a live tie, a scheduled game with odds, a scheduled game without odds. Use real games — `/?day=2026-09-03` has finals and live MLB.
- Card heights before and after, per sport, against stage 1's numbers. **Any growth is a hard stop — report it, do not ship it.**
- Confirm the 58 px floor survives and matchup columns still align down a mixed list.
- Confirm `Sched` no longer appears anywhere in the app.

---

## Stage 3 — the detail panel is out of scope, deliberately

`web/components/GameDetail.js` shows the score with both team names spelled out, away then home. The ambiguity this prompt fixes does not exist there — the names are right beside the numbers. **Leave it as it is.** Joe was offered the choice and Cowork's call was to leave it; if he changes his mind it is a separate, small change.

Same for the mobile grid's block tray: it carries time and odds, never a score. Untouched.

---

## Stage 4 — the contract, and a rule this earns

### 4a. Bump `docs/rendering-contract.md` to v1.6.6

Add a changelog entry at the top of the list, in the file's existing voice and format, covering: the priority ladder in 2b; the winner-first score with the row-1 mark; `TIED`; the odds restack; the dash replacing `Sched`; and **the fix — that exceptions now outrank odds, which they did not before.** Name the trade-off on `TIED` and the loss of positional away/home, both accepted by Joe. Update the version in the file's title line.

### 4b. Update the locked reference in the SAME commit

`docs/design/mobile_demo.html`'s `rcol()` and its `.rcol` CSS still describe the old slot. **Change them to match, in the same commit as the code.** A reference that lags the app is not an authority — it is a second opinion, and that is exactly how the nine findings prompt 22 repaired came about.

The template's `__DATA__` placeholders make it unrenderable here (its builder is still project-only, on the handoff open list). That does not matter: it is being read as a specification, and a specification that contradicts shipped code is worse than none.

### 4c. Propose working rule 23

Add to `docs/handoff-status.md`:

> **23. When a change alters anything the locked reference implements, `docs/design/mobile_demo.html` changes in the same commit.** A reference that lags the app stops being an authority. Prompt 22 repaired nine findings that were all the same failure — shipped code drifting from a reference nobody re-read — and prompt 25 nearly shipped a fifth chip into a wrapping row for the same reason.

---

## Stage 5 — report

Per stage: what changed, the sha, the acceptance evidence, every judgment call. Gates before and after.

Call out specifically:

- **Stage 1's five measurements**, in full, before anything else.
- **Whether the constrained row-1 mark reads acceptably**, with the screenshot. If it is too small, say so and give the number it would need — Joe rules on whether cards may grow.
- **The live tie render.** `TIED` is the one part of this Joe chose against Cowork's recommendation, so he should see it early and in context.
- **Anything in this brief that turned out wrong.** Four reports running have found bad citations in their own briefs; that has been the most useful part of each.

---

## Explicitly out of scope

- `GameDetail.js` and the grid's block tray — stage 3.
- The `minmax(58px, auto)` floor — keep it.
- The matchup column, the time column, the network mark column — this prompt touches the fourth column only.
- The grid zoom question — still waiting on Joe's phone.
- `.favlabel` prominence — Joe's ruling still open.
- The four project-only builders (`build_demo.py`, `app_template.html`, `build_banner.py`, `markkit.py`) — Cowork places those.
- `programs/big-noon-kickoff.png` — its 1.122% builder failure is known and deliberate since prompt 16.
- Anything in `pipeline/`, `adapters/`, or the database.
