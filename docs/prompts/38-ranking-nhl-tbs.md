# Claude Code — Prompt 38: the ranking line, the NHL wipe, and TBS

**Repo:** `C:\Users\jlull\Joe's Projects\Apps - Personal\MySports` · **main**

**Preconditions, hard stop if any fail:**

- `git rev-parse HEAD` == `f583910`, and `HEAD == origin/main`.
- Python **209 passed + 1 skipped**, JS **204/204**, smoke **30/30**, qa-shots **14/14**.
- Tree clean apart from untracked `assets/`.

**Run start to finish without stopping.** Four stages, each gated and committed on its own. Small prompt by design — the grid's colour problem is a separate research session and racing is its own prompt.

**Hard-stop policy.** Stop that stage, leave earlier commits alone, record what stopped, continue to anything independent. **No database writes are specified here**, so any DML is a hard stop.

**Working rule 22** — locate by content, and **report any citation in this brief that does not match.** The last three briefs carried six, three and six errors. Also rules 3, 4, 13, 16, 20, 23.

---

## Stage 1 — the CFB ranking line is an either/or and should be a combination

Joe, on the live 2026-09-04 Fresno State at USC card: *"the line below USC should read `AP #14 - Big Ten` - NOT simply `#14`."* Fresno State reading `Pac-12` is already correct.

**The cause, located.** `standingParts()` in `web/lib/standings.js`:

```js
rest = Number.isInteger(rank) && rank > 0 ? `#${rank}` : placed || group || null;
```

A ranked team gets the number **instead of** its conference. The comment above it calls this *"A strict precedence, not a combination"* — a fair reading of Joe's original written spec, so **this is a clarification, not a defect in the implementation.** Say so in the report rather than filing it as a bug.

**There is a second half.** `rankFor()` loops `['CFP', 'AP']` and returns `row.rank` — **a bare integer that has discarded which poll it came from.** The card cannot print `AP` today because the poll identity is thrown away at the lookup.

### Joe's rule, as it must render

The line under a CFB team name is **two parts joined**, each rendered only when it exists:

| team state | renders |
|---|---|
| CFP-ranked, has a conference placement | `CFP #{rank} · {place} {Conference}` |
| AP-ranked, has a placement | `AP #{rank} · {place} {Conference}` |
| AP-ranked, no placement yet (hasn't played) | `AP #{rank} · {Conference}` |
| unranked, no placement | `{Conference}` |
| unranked, has a placement | `{place} {Conference}` |

**CFP wins over AP when both exist** — unchanged precedence, only the label is new. The 2026 CFP does not publish until roughly week 12, so **every ranked card today will read `AP`**; build CFP anyway and prove it with a test rather than waiting for November.

**Change `rankFor()` to return the poll with the rank** — `{ poll, rank }` or null. Keep the existing rule that null means *unranked this week*, never a fall-through to a lower poll or a previous week; that distinction is deliberate and its comment says why.

**This is the LIST CARD only. The grid keeps its bare number** — contract §3 specifies the grid name run as `{rank} TEAM`, M17 fits it per card between 11.2 and 20.8px, and three more characters on every ranked team would push cards toward the floor. **Do not change the grid.**

`standingLine()` — the joined form `GameDetail.js` uses — must pick up the same change, since both surfaces read one set of rules by design.

**Verify against the live slate:** render the Fresno State at USC card for `2026-09-04` and quote both lines. USC must read `AP #14 · Big Ten`. Then report every ranked CFB team on `2026-09-05` with its rendered line. Extend `web/test/standings.test.mjs`: CFP over AP; AP alone; ranked with a placement; ranked without one; unranked with a placement; unranked without one.

## Stage 2 — the NHL division links get wiped, and will wipe again

Prompt 37's A2 found this and it is the reason the division seed had to be applied twice over.

`pipeline/bootstrap.py` created the four NHL division rows on 2026-09-01 and they are live — eight clubs each. What went missing was the **assignment**: `adapters/nhl.py` calls `_safe(fetch_standings_teams)`, **which swallows errors and returns `None`**; the teams file then carries `conference: null` on all 32 clubs; and bootstrap lists `conference_id` among its update columns, so the next run writes those nulls straight back over the links.

**One transient NHL API failure re-wipes all 32 teams.** It has happened once already.

**Fix the class of bug, not the instance.** A loader that cannot reach its provider must not be able to erase what a previous successful run established. The obvious shapes are: never write a null over a non-null for these reference columns; or have `_safe` distinguish "the provider said null" from "the fetch failed" so the caller can skip the column entirely. **Pick one, say why, and check whether the other adapters share the pattern** — `adapters/mlb.py`, `nba.py` and `espn.py` are the ones to look at, and if any has the same shape, fix it too.

**Prove it.** A test that simulates the fetch failing and asserts the existing `conference_id` values survive. Then run the real bootstrap path against the current database and confirm all 94 assignments are still there afterwards — 32 NFL, 32 NHL, 30 NBA, plus MLB's 30 and college football's untouched.

**No DML is authorised in this prompt.** If bootstrap's normal operation writes rows, that is its own behaviour and fine; **do not issue repair statements**. If you find the links already wiped again, **report it and stop** — Joe re-applies the seed.

## Stage 3 — the TBS mark

`networks_services` carries `('tbs','TBS')` with **2 loaded `game_broadcasts` rows**, so this is a live gap. `web/public/marks/` has `tnt.png` and no TBS.

**Check `assets/network-logos/` first.** As of this brief the source art is **not** there — Cowork owns sourcing it and may have placed it by the time you run. **If the art is present**, build the mark through `scripts/build_web_marks.py` with the per-network recipe table and the frozen ink-area normalisation — **never a hand-edited PNG and never a hand-edited manifest.** Report the resulting ink area against its neighbours.

**If the art is absent, report and move on.** That is a soft stop, not a hard one, and it does not block stage 4.

## Stage 4 — two documentation defects from prompt 37

**There are two rules numbered M17** in `docs/rendering-contract-mobile.md` — the fitted name run and the flat endcap. Both were added in the same commit. **Renumber the second to M18**, fix every cross-reference to it (M13's strikethrough note points at one of them), and bump the addendum version.

While in there, **verify M13's superseded-gradient note points at the right rule** after renumbering, and confirm no other rule number is duplicated.

**Rule 23:** if any of the above changes something `docs/design/mobile_demo.html` implements, it changes in the same commit. Prompt 37 found `--body` still declaring Barlow when the app ships Inter — **check the token block again and report any remaining drift.**

---

## Report

Per stage: what changed, the sha, the evidence, judgment calls. Gates before and after.

- **Stage 1: the Fresno State at USC card quoted verbatim**, plus every ranked CFB team on 2026-09-05 with its rendered line. Confirm the grid is untouched.
- **Stage 2: which fix shape you chose and why**, whether any other adapter shares the pattern, and the post-bootstrap assignment count.
- **Stage 3:** whether the art was there.
- **Stage 4:** the renumbering, and any remaining reference drift.
- **Geometry:** nothing here should touch the grid. Confirm CFB 2026-09-05 at 62 blocks / 240,223 / 1073 and MLB 2026-09-03 at 3 / 231 / 582 — **note the dates; prompt 36 nearly called a false hard stop by comparing a different slate.**
- **Anything in this brief that turned out wrong.**

---

## Explicitly out of scope

- **The grid card's colour system** — its own research session, which ships nothing. Do not touch `bandFor`, `CAP_TINT`, `.mcap`, `.mname` backgrounds or the seam.
- **Racing data.** No adapter exists for NASCAR or IndyCar; building them is its own prompt.
- **Current-season NHL and NBA standings.** Their `team_records` are season 2025 while their games are 2026, which is why those cards render a conference name alone. A later pass.
- **The pipeline gap behind the stale finals** — `schedule_refresh` dying on the RENDER job with `FileNotFoundError: artifacts/validation/mlb_2026_teams.json`. Still its own prompt.
- **Any database write.**
- Anything else in `pipeline/` or `adapters/` beyond stage 2's fix.
