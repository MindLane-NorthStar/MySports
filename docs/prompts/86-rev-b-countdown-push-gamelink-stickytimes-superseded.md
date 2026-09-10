# PROMPT 86 (rev. B) — Countdown pushed, the state-aware game link, and the locked time row

**This supersedes the version issued earlier on 2026-09-10. Read this one.** Block A has already been
BUILT and its gates are green, but **it is not committed and not pushed** — so this revision opens
with a block that closes it out, then carries Blocks B and C forward unchanged in substance.

Read `CLAUDE.md` and `docs/handoff-status.md` first — they are the authority and this brief does not
restate them.

---

## THE GATE FLOORS — WHAT CHANGED SINCE THE FIRST ISSUE

The earlier version of this brief opened by reporting that the floor table contradicted the movements
table above it. **Block A fixed that**, and `docs/handoff-status.md` now reads:

| gate | run from | floor |
|---|---|---|
| `pytest` | repo root | 527 passed + 1 skipped |
| `npm run test:unit` | `web/` | 570 |
| `npm run smoke` | `web/` | 33/33 |
| `node scripts/qa-shots.mjs` | `web/` | 108/108 |
| `npm run geometry` | `web/` | all hard stops |

**Read them from the repo anyway** — that table is reproduced here so you can tell at a glance whether
the tree moved under you, not so you can skip the read. If what you find differs from the above,
**stop and report**; do not pick a number.

**Expect `geometry` to go RED after the next nightly load, and that is correct rather than a
regression.** Sept 13 currently spans 11:00–23:50, the 770 minutes geometry pins. Countdown's 10:00
start makes it roughly 830. When it fails, **check the delta is exactly the 60 minutes Countdown adds
at the front of the day** — if the span moved by anything else, that is not the data and it is a stop.
Re-pin with a measured figure, never a predicted one. **Do this before starting Block C**, which moves
the grid's time axis and needs a green geometry gate to be judged against.

---

# BLOCK A′ — COMMIT AND PUSH BLOCK A

## What was measured

Cowork read the git refs directly (the device shell cannot mount the folder this session, so this came
from the ref files rather than from `git`):

- `.git/refs/heads/main` — last written **2026-09-09 21:17:31 ET**
- `.git/refs/remotes/origin/main` — last written **2026-09-09 21:17:34 ET**, three seconds later
- the last reflog entry in `.git/logs/HEAD` is `dcf6281`, *"banner: the set goes dark, the halo
  matches the icon, and the glow stops at zero"* — prompt 85's commit
- Block A's own files were edited **2026-09-10 between 10:09 and 10:41 ET**:
  `data/studio_shows.json` 10:22, `web/scripts/qa-shots.mjs` 10:29, `docs/handoff-status.md` 10:41

Local and remote agree at prompt 85's commit, and Block A's work sits in the tree on top of it. **So
Block A is uncommitted and unpushed.**

## Do this

1. **Verify before you act.** Joe may have committed since that reading. `git log --oneline -3` and
   `git status -s -b`. If Block A is already committed and pushed, say so and skip to Block B — do not
   commit twice.

2. **Run the secret gate — ADDED lines only, with `grep`, never `findstr`** (working rule 3). Cowork
   could not run it without a shell, so it has not been run at all. Note that `.gitignore:1-2` covers
   `.env` and `.env.*`, so the writer credential cannot enter a commit; the gate is for everything
   else.

3. **Commit.** Joe approved this message: `studio: sunday nfl countdown is registered, standalone,
   from espn's own release`

   **The body must name all four things this commit carries**, because the subject names only one and
   the other three are exactly the kind that become invisible six prompts later:

   - the registry entry and the `docs/research/studio-shows.md` §1 line, with the release URL
   - **the gate-floor correction** — `pytest` 515 → 527 and `qa-shots` 96 → 108, and what moved each
     (prompt 83 block E's six banner tests, prompt 84's twelve served-DOM checks) — rule 30, the
     correction landing with the work it misled
   - **the `qa-shots.mjs` change, which was NOT in the brief** — one `await stackSynced(page)` at
     line 997, using a helper that already had four call sites (716, 736, 1014, 1092). It waits on a
     condition rather than sleeping, and no assertion changed. Say why it was needed: two of three
     gate runs failed there on an unmodified tree, and Block C works on this exact machinery.
   - the stale-note corrections in `handoff-status.md`, `db/README.md` and register §7, plus the new
     register §35

4. **Push.** Joe's explicit approval is given for this one. **It needs to be before Friday 2026-09-11
   at 07:00 ET** — that is the next `schedule_refresh.yml` run, and Countdown debuts Sunday the 13th.
   A push is a deploy; report the Vercel result.

5. **Report** the commit SHA, the push result, and whether `origin/main` now matches `main`.

Then continue to Block B — no separate stop here, because the approval to commit and push this block
is already given.

---

# BLOCK A — SUNDAY NFL COUNTDOWN IS LOADED  *(ALREADY BUILT — kept as the record of what was asked and why)*

## What was measured, and why this is smaller than it looks

Countdown is not missing from a renderer. **It has never existed as a row.**
`data/studio_shows.json` carries it in `_not_loaded[0]` with the reason: *"named in the run's brief,
but `docs/research/studio-shows.md` §1 — the 'Verified 2026 slots' list — does NOT carry it. No
weekday, no start, no duration, no network."* `docs/handoff-status.md:2116` and `:2138` record the
same thing as an open **source gap**, not a scope decision.

That gap is now closed. Cowork verified the slot on 2026-09-10:

> **Sunday NFL Countdown (10 a.m.–1 p.m., ESPN)**, Sundays, season debut Sunday, Sept. 13.
> — ESPN Press Room, *"ESPN unveils Sunday & Monday NFL coverage for Super Bowl LXI season"*,
> <https://espnpressroom.com/press-release/espn-unveils-sunday-monday-nfl-coverage-for-super-bowl-lxi-season/>

**Four things this block does NOT have to build, each checked in the tree rather than assumed:**

1. **The brand exists.** `data/brands.json` → `brands.nflcountdown` — title "Sunday NFL Countdown",
   `short_title` "NFL COUNTDOWN", `color` `#F12E31`, `mark_dark`
   `/programs/sunday-nfl-countdown.png`. Colour derived 2026-09-06.
2. **The art exists.** `web/public/programs/sunday-nfl-countdown.png`, 18,491 bytes, mtime
   2026-09-06. Listed on the device, not inferred from the JSON that points at it.
3. **The mark is conditioned.** `web/public/programs/manifest.json` carries the `sunday-nfl-countdown`
   entry with `hf: 1.15` and its ink-area figures, so it renders at equal ink area like the other
   seven.
4. **The missing anchor is already a supported state.** `pipeline/load_studio_shows.py:31`:
   *"WHERE THERE IS NO ANCHOR the show keeps its slot duration and renders on its own network row at
   its slot … That is a real state, not a failure."* `db/migrations/0013:92` says the same in the
   schema: *"Null = standalone, and the show renders at its slot on its own row."*

So Block A is a **data change plus a doc line**. No new component, no migration, no art.

## Do this

1. **`docs/research/studio-shows.md` §1, the "Verified 2026 slots" list.** Add a Countdown line in
   the format the neighbouring entries use — day, start, duration, network, season debut, and the
   press-release URL in brackets. Put it with the other NFL Sunday shows, not at the end.

2. **`data/studio_shows.json`.** Remove the `_not_loaded[0]` Countdown entry and add a registry
   entry to `shows`, ordered next to the other NFL Sunday shows:

   ```json
   {
     "show_key": "sundaynflcountdown",
     "title": "Sunday NFL Countdown",
     "sport": "nfl",
     "network_key": "ESPN",
     "simulcast": null,
     "brand_key": "nflcountdown",
     "bookend": "pre",
     "weekday": 6,
     "slot_start_et": "10:00",
     "duration_min": 180,
     "anchor_rule": null,
     "active_from": "2026-09-13",
     "active_to": "2027-01-03",
     "on_site": false,
     "source_url": "https://espnpressroom.com/press-release/espn-unveils-sunday-monday-nfl-coverage-for-super-bowl-lxi-season/",
     "source_note": "ESPN Press Room, 2026 Super Bowl LXI season release, read 2026-09-10: 'Sunday NFL Countdown (10 a.m.-1 p.m., ESPN)', season debut Sunday, Sept. 13. A STATED three-hour window, so duration_min is a fact rather than a default."
   }
   ```

   **`brand_key` is `nflcountdown`, not `sundaynflcountdown`** — that is the key that exists in
   `brands.json`. Do not rename the brand to match the show key; the art, the manifest entry and the
   derived colour all hang off the existing name.

   **`weekday: 6` is Sunday.** `db/migrations/0013:81` — "ISO weekday, 0=Monday .. 6=Sunday" — and
   `load_studio_shows.py:288` labels with `["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][weekday]`.
   Both were read; neither was assumed from the other shows.

   **`anchor_rule: null` is deliberate and is the schema's own word for this case.** The key must be
   PRESENT because `load_studio_shows.py:291` reads `s["anchor_rule"]` directly; its value is null.

3. **Do NOT add a `sundaynflcountdown` entry to `ANCHORS` in `pipeline/load_studio_shows.py:60-68`.**
   The release states an explicit 10 a.m.–1 p.m. window. An `ANCHORS` entry would let a data
   condition shorten a published window — and ESPN does carry the occasional Sunday NFL game, so it
   would fire. Standalone is both correct and what the schema documents. Record this in the commit
   body.

4. **Re-run the loader** for the season window and report: instances generated, instances linked, and
   the registry count (7 → 8).

## What this does to the list order, stated so it is not read as a bug

Countdown starts at **10:00**. FOX NFL Kickoff is 11:00 and FOX NFL Sunday and The NFL Today are both
12:00 (`data/studio_shows.json`). `chronological()` in `web/lib/favorites.js:194` sorts
**time → studio show → favourite**, so **Countdown will list ABOVE the FOX and CBS pregame shows.**

Joe raised this and ruled on it on 2026-09-10: **time-first wins, `chronological()` is not touched.**
A list that claims to be ordered by the clock and is not is the contradiction prompt 82 removed when
it deleted the favourites float. Do not add a network or show-rank tie-break.

## In scope and NOT in scope

Two things the same ESPN release contradicts in the tree. **Both are real. Neither is this block.**

- **`mnfcountdown.simulcast` is `null`** and the release says Monday Night Countdown is on NFL
  Network for the first time this season.
- **`mnfcountdown.duration_min` is `null`** and the release gives 6–8 p.m.

Leave both alone. The bookend rule already produces a correct Monday Night Countdown from the
default, and changing a working show's duration and adding a simulcast row are behaviour changes
nobody asked for. **Add a line to `docs/enhancement-register.md` naming both, with this release as
the source, so the next reader finds them rather than rediscovering them.** Also out of scope: NFL
Primetime (Sundays 7:30 p.m., ESPN App), which the release names — it is a highlights show on an app
rather than a bookend on a game's network, so register §7 Q4's scope excludes it.

## Assertions

- `tests/` — the registry parses, Countdown is in `shows` and absent from `_not_loaded`, and its
  `brand_key` resolves to a `brands.json` entry that has a `mark_dark` file present on disk.
  **The last clause is the one worth having**: it is the guard that would have caught a brand key
  that pointed at nothing.
- **Mutation check, required:** change `weekday` to 5 and the air-date test must fail; change
  `brand_key` to `sundaynflcountdown` and the brand-resolution test must fail. If either mutation
  passes, the assertion is decorative — say so and fix it.

## Gates, then stop

Run all five as their own commands, from the directories `CLAUDE.md` names, and report all five:

```
pytest                       # repo root
npm run test:unit            # web/
npm run smoke                # web/
node scripts/qa-shots.mjs    # web/
npm run geometry             # web/
```

Report the counts and the exit codes separately (rule 26). Then report the work left in the tree and
**stop for Joe's approval before committing.**

---

# BLOCK B — ONE GAME LINK WHOSE LABEL FOLLOWS THE STATE

## What was measured

**The link already exists.** `web/components/GameDetail.js:142-147` renders it today:

```js
const boxLive = game.result_status === 'in_progress';
const boxScore = (boxLive || game.result_status === 'final') && game.boxscore_url ? (
  <a className="dlink" href={game.boxscore_url} target="_blank" rel="noopener noreferrer">
    {boxLive ? 'Live box score' : 'Box score'}
  </a>
) : null;
```

The URL is derived in one place, `pipeline/load.py:66-80`, from the game's own id, and written by
`SCORES_SQL` at `load.py:91` **only when the state is `final` or `in_progress`**. That gate is prompt
78's and it was measured: 0 of 790 scheduled CFB rows carried a URL, so a pre-game link would have
been a dead tap.

**What is missing is only the pre-game half.** Joe's ruling, 2026-09-10: one link, one destination per
sport, and the label follows the state — Preview, then Live box score, then Box score.

**Why one destination works, checked per sport rather than assumed:**

- `mlb.com/gameday/{pk}` and `nhl.com/gamecenter/{id}` already resolve to a preview before the game
  and to the box score during and after. **No change to those two templates.**
- ESPN's `/{league}/game/_/gameId/{n}` resolves preview → gamecast → recap on its own, where
  `/boxscore/_/gameId/{n}` does not. `docs/handoff-status.md` already records that `www.espn.com`
  claims `/*/game/_/gameId/*` in its apple-app-site-association **and that the database holds those
  ids** — that finding was gathered for streaming and it is what this block spends.

## Do this

1. **`pipeline/load.py:66-72`.** Change the three ESPN templates from `/boxscore/_/gameId/{n}` to
   `/game/_/gameId/{n}` for `cfb`, `nfl` and `nba`. **Leave `nhl` and `mlb` byte-for-byte.** Update
   the comment above the map — it currently says "ESPN box scores", which will no longer be true.

2. **`pipeline/load.py:91`, `SCORES_SQL`.** Remove the state gate, keep the never-overwrite:

   ```sql
   boxscore_url = coalesce(boxscore_url, %s)
   ```

   **`coalesce` stays and is not belt-and-braces.** It is what makes the write idempotent and what
   keeps a row that already has a URL from being rewritten on every refresh. Do not widen it into an
   unconditional assignment.

3. **A migration, `db/migrations/0018_game_url_templates.sql` — WRITTEN in this block, APPLIED after
   the push.** Because of that `coalesce`, rows that already carry a `/boxscore/_/gameId/` URL will
   never be corrected by the loader. Rewrite them in place.

   **THE ORDERING IS CLAUDE CODE'S AND IT IS BETTER THAN THE FIRST ISSUE'S.** The earlier brief had
   the migration applied inside this block. Apply it **after steps 1, 2, 4 and 5 are committed and
   pushed**, so the nightly job has stopped writing the old format before the existing rows are
   rewritten. The window in between leaves new rows on `/game/` and old rows on `/boxscore/` — both
   work, so that is cosmetic and it is shorter than the alternative.

   **The write itself needs Joe's approval by name (rule 14).** Count the matching rows, paste the
   count, and wait. Do not apply it as part of the block's own run.

   **Do not take a row count from this brief.** `pipeline/load.py:108` records "203 of 203 stored
   URLs" as of prompt 78 on 2026-09-09 — that is every sport, including the nhl and mlb rows this
   migration must not touch, and it is a dated snapshot rather than a fact about today. **Count the
   matching rows first, report the number, then run the update and report what it touched.**

   ```sql
   update games
      set boxscore_url = replace(boxscore_url, '/boxscore/_/gameId/', '/game/_/gameId/')
    where boxscore_url like '%/boxscore/_/gameId/%';
   ```

   Report the row count it touched. Migrations run 0001–0017 today, so 0018 is the next number —
   verified by listing `db/migrations/`, not inferred.

4. **`web/components/GameDetail.js:142-147`.** Three labels, and drop the state gate on *rendering*:

   - `in_progress` → `Live box score`
   - `final` → `Box score`
   - anything else → `Preview`

   **`&& game.boxscore_url` MUST STAY.** Rows written before this change and not yet refreshed have
   no URL, and a link to nothing is worse than no link. It fills in rather than rendering broken —
   which is the same argument prompt 78 made for the guard in the first place.

   The link renders in **both** panel branches, exactly as it does now: inside `.dlinks-watch` when
   something accessible exists (`:360`) and inside its own `.dlinks` when nothing does (`:385`).
   Working rule 32 — enumerate the renderers. `git grep boxScore` in `web/` and confirm those are the
   only two, or say what else you found.

5. **`GameDetail.js:422-425`, the footer.** It reads *"Watch links are best effort - they open the
   service, not this game."* That is still true of the watch links and is now **false of this one**,
   which is per-game by construction. Either scope the sentence to the watch links or add a clause.
   Do not delete it.

## In scope and NOT in scope

- **Programs get nothing.** `boxscore_url` is a column on `games`; the `programs` table has no such
  column, so all 4,230 programs are outside this by construction rather than by a filter
  (`GameDetail.js:137-140`). Adding one is its own piece of work.
- **The column is NOT renamed.** `boxscore_url` will hold a preview URL before kickoff, so the name
  is now imprecise. Cowork's call, and the reasoning is stated so it can be overturned: the rename
  reaches `web/lib/queries.js:25`, the PostgREST select list and every test that names the field, and
  a block that changes a template, a write gate and a column name has three candidate causes when
  something fails. **Record the naming debt in `docs/enhancement-register.md`** as a follow-up.
- **No streaming claim is made.** ESPN's manifest carries no general `/watch` claim. This link opens
  a game page. Nothing in the copy may imply otherwise.

## Assertions

- New `web/test/gamelink.test.mjs`: the label for each of `scheduled` / `in_progress` / `final`; no
  element at all when `boxscore_url` is null in every state; a program row never produces one.
- Python-side: `boxscore_url()` returns a `/game/_/gameId/` URL for cfb, nfl and nba, and returns the
  **unchanged** nhl and mlb forms. Pin the cfb id-shape branch — `load.py:80` passes the whole id for
  cfb and the post-hyphen tail for the rest, and that asymmetry is easy to break while editing the
  map above it.
- **Mutation checks, required:** swap the `Preview` and `Box score` labels — the label test must
  fail. Point the nhl template at ESPN — the per-sport test must fail. Rule 24: a count computed on
  the Python side is no evidence the JS runtime agrees, so the label assertions must run in the JS
  gate, not be inferred from the loader's.

## Gates, then stop

The same five, as their own commands, all five reported. Then the work left in the tree, and
**stop for Joe's approval before committing.**

---

# BLOCK C — THE TIME ROW LOCKS UNDER THE PICKER

## What was measured, and the trap that makes this a design change rather than a CSS line

Joe wants the grid's time row to pin beneath the navbar and picker on a downward scroll, the way the
network rail is pinned on the left, so the times stay readable at any scroll depth.

**`position: sticky; top: …` on `.mgrid-axis` will do nothing, and it will fail silently.**

`web/app/globals.css:1092-1098`:

```css
.mgrid-scroll {
  position: relative;
  overflow-x: auto;
  overflow-y: hidden;
  ...
}
```

A box with non-`visible` overflow on either axis is a scroll container in **both**. `.mgrid-axis`
lives inside it (`MobileGrid.js:338` → `:355`), so a sticky offset there resolves against
`.mgrid-scroll` — which never scrolls vertically — and the row does not move. Switching to
`overflow-y: visible` does not rescue it either: CSS computes `visible` to `auto` when the other axis
scrolls.

**Joe chose Route A on 2026-09-10:** hoist the axis out of the scroller and keep its horizontal
position in step with code. Route B — giving the grid its own vertical scroll pane — was rejected
because three behaviours are wired to the *page* scroll and would each need repair:
`CollapsedHeader.js:141` (the sentinel observer), `headerstate.js:136` (`window.scrollBy`
compensation) and `AutoScroll.js:152` (`window.scrollBy` landing).

**The header stack this must sit under, read rather than assumed:**

- `.chdr` — `position: sticky; top: 0; z-index: 40` (`globals.css:3070-3077`)
- `.pickrow` — `position: sticky; top: var(--stack-h, 44px); z-index: 30` (`globals.css:3140-3142`)
- both scoped to `html[data-hdr='collapsed']`
- `--stack-h` is written by a ResizeObserver on `.chdr` in `CollapsedHeader.js:190-196`
- **there is no `--pick-h`.** Cowork read `globals.css` and every file in `web/components/` and
  `web/lib/` and found no occurrence. **Confirm with `git grep -n 'pick-h'` before you add it** — a
  name that already exists somewhere Cowork did not read is exactly the collision rule 32 is about.

## Do this

1. **`MobileGrid.js` — move the `.mgrid-axis` block (currently `:355-376`) out of `.mgrid-canvas` and
   render it as a sibling immediately BEFORE `.mgrid-scroll`.** Keep its two children as they are:
   `.mgrid-axis-rail` (the corner, `var(--rail-w)` wide) and `.mgrid-axis-track` (width
   `scale.width`, carrying the ticks and the labels).

2. **Sync its horizontal offset to the scroller.** A passive `scroll` listener on `scrollRef` that
   sets `transform: translateX(-scrollLeft)` on the **track element only**, coalesced with
   `requestAnimationFrame`. It must also run on mount and whenever `scale.width` changes, so a
   pinch-zoom does not leave the strip behind. Write directly to the node's style in the handler —
   routing this through React state re-renders the grid on every scroll frame.

3. **`.mgrid-axis` needs `overflow: hidden`**, or the translated track spills past the left edge of
   the page.

4. **The M4 assertion, and it is not optional.** `docs/rendering-contract-mobile.md` M4 ends
   *"Nothing between the rail and `.mgrid-scroll` may carry a transform."* After the move,
   `.mgrid-axis-track` is no longer an ancestor of `.mrail-cell` — the rail lives in `.mgrid-row`
   inside the scroller. **Assert that relationship in a test rather than reasoning about it in a
   comment**, because prompt 30's bug is exactly what M4 exists to prevent and the whole point of
   this block is that it adds a transform to this component.

5. **CSS, matching `.pickrow`'s pattern:**

   ```css
   html[data-hdr='collapsed'] .mgrid-axis {
     position: sticky;
     top: calc(var(--stack-h, 44px) + var(--pick-h, 0px));
     z-index: 20;
   }
   ```

   Scoped to collapsed for the same reason `.pickrow` is (`globals.css:3120`): expanded, `.chdr`
   is `display: none` and out of flow. Scroll only ever collapses the header
   (`headerstate.js:17`), so by the time a reader is scrolling the grid it is always collapsed — the
   scoping costs nothing.

   `z-index: 20` sits under the picker's 30 and the bar's 40. **Give it an opaque background from the
   token block** — the page ground is a radial gradient and blocks will scroll visibly through a
   transparent strip. That was a real defect in `.pickrow`'s first build (`globals.css:3144-3147`).

   **The sync from step 2 runs in both header states**, not only when collapsed. Only the stickiness
   is scoped.

6. **`CollapsedHeader.js` — a second ResizeObserver on `.pickrow` writing `--pick-h`**, mirroring the
   `--stack-h` one at `:190-196`. Use `getBoundingClientRect().height`, not a content-box entry — the
   note at `:199-201` records a content-box observer going stale and parking the picker 59px too
   high. One observer per element; do not fold both into one.

7. **`docs/rendering-contract-mobile.md` — amend M5.** The axis is no longer inside the scroller and
   is pinned under the control stack. Write it the way M4's v1.2 correction is written: what it said,
   what is now true, and the measurement that moved it.

## Assertions

- New `web/test/stickytimes.test.mjs`: `.mgrid-axis` is not a descendant of `.mgrid-scroll`; the
  transform is applied to the track and to nothing else; `.mrail-cell` has no transformed ancestor
  up to `.mgrid-scroll`.
- `web/test/collapsedheader.test.mjs`: `--pick-h` is written, and it is written from the bounding
  rect.
- **A qa-shots check, and this is the one that decides it.** At a known vertical scroll offset AND a
  known horizontal pan offset, assert **numerically** that the `NOON` label's left edge equals the
  noon gridline's left edge inside the scroller, and that the axis's top equals
  `--stack-h + --pick-h`. A screenshot alone shows the row is pinned; only the measurement shows the
  times still sit over their own columns. Look at the picture too — but the assertion is the gate.
- **Mutation checks, required:** remove the `translateX` write and the alignment assertion must fail;
  set `top: 0` and the offset assertion must fail. A sticky test that passes with the sync deleted is
  testing nothing.

## In scope and NOT in scope

- **The rail's left-pinning is untouched.** It stays `position: sticky; left: 0` inside the scroller
  (`globals.css:1112-1116`).
- **Page scroll, the header collapse, the sentinel compensation and AutoScroll are untouched.** That
  is the whole reason Route A was chosen. If this block finds itself editing `headerstate.js` or
  `AutoScroll.js`, something has gone wrong — stop and report.
- **Desktop is untouched.** M5 is mobile-only; the PC grid keeps v1.2 labels.

## Gates, then stop

The same five, as their own commands, all five reported. **If `geometry` is red because the nightly
load has landed, re-pin Sept 13 with a measured figure BEFORE you judge this block** — geometry is the
gate that would catch this block breaking the grid, and a block that moves the time axis cannot be
signed off against a gate that was already failing. Then the work left in the tree, and **stop for
Joe's approval before committing.**

---

## Standing rules for this run

- **Never commit or push without Joe's explicit approval.** A push is a deploy; Vercel is the only
  compile check that exists. **Block A′ is the one exception in this brief** — Joe approved that
  commit and that push explicitly on 2026-09-10. Blocks B and C still stop.
- **Block F is CLOSED.** Joe tapped the MLB.TV link from inside the installed PWA on 2026-09-10 and
  the MLB app opened, so `target="_blank"` does not suppress the hand-off and no fix is needed.
  `docs/research/mlb-tv-tap-test.md` still records it as unproven; that correction is deliberately
  held for the close-out prompt rather than bolted onto this one. Do not act on the stale note.
- Gate floors come from `docs/handoff-status.md` under "Repo state" and nowhere else — read them
  there, and see the reconciliation note at the top of this brief before you trust the table.
- `assets/` is untracked on purpose and is not drift.
- No direct Postgres connection and no writer credential from a session; the migration in Block B
  runs through the project's normal migration path.
- WUAB and RESN are never named in the app, the repo or any committed document.
