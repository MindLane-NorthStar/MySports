# Prompt 78 — four blocks: push what is built, fix the MLB id drift, the watch links, the list order

Base is `392d08b` (prompt 74), `origin/main == HEAD`, with **prompt 77 stage 1 built and uncommitted
in the tree**. Prompts 75 and 76 were never run; their content is blocks C and D here.

**FOUR BLOCKS, EACH ITS OWN COMMIT, IN THIS ORDER.** A stop inside one block leaves every earlier
block committed — do not roll back or hold work already banked. Run the five gates before each
block's commit, not once at the end.

**Read the gate floors from `docs/handoff-status.md` before each block** (rule 10). They move as
blocks land, and a number carried from a brief is how this project has been bitten repeatedly.

---

# BLOCK A — commit and push prompt 77 stage 1

Already built, already gated: `test:unit` 537, all five green, tripwire unmoved, probe
`live-poll.mjs` measuring `scrollY` and `data-pin` unchanged across a full 60-second cycle.

Stage it by explicit path, secret-gate on ADDED lines only with `grep`, commit, **and push.** Joe
approved this one on its own.

Nothing else in this prompt is pushed without his word.

---

# BLOCK B — MLB live scores have never worked, and the box score URL

## B1 — the id drift

`/api/live` reports `mlb: { returned: 15, joined: 0 }`. MLB's source returns fifteen games and **not
one id matches ours.** Day mode reports the same, so it predates prompt 77. `overlay.stats` exists to
surface exactly this and it is surfacing it.

**COWORK ASSERTED THE OPPOSITE AND WAS WRONG.** Prompt 76's stage 3 argued that because
`livescores.js:214` matches `r.gameId` — built as `` `mlb-${g.gamePk}` `` — against `games.id`, then
`games.id` *must already be* `mlb-<gamePk>`. That inference assumed MLB live scores work. They do
not. **Treat nothing in that argument as established.**

**Find out what `games.id` actually is for an MLB game.** Read where it is minted in
`adapters/mlb.py` and `pipeline/load.py`, print real ids from the database beside the ids
`fetchSport('mlb')` returns, and **show the two strings side by side.** Name the searches you ran
(rule 31).

**Then fix it, with a strong preference for the matcher over the data.** Rule 6 is additive over
destructive: if the two schemes can be reconciled inside `livescores.js` — a normaliser, a second
key, whatever the shapes actually call for — do that. **Do NOT rewrite stored `games.id` values.**
That is a primary key, other tables and the app's own overlay key point at it, and rule 14 forbids
the DML anyway. **If the only fix is a data change, STOP and report** with the exact rows and what
you would run.

**Check the other sports while you are there** (rule 32). `stats` is per-sport; report `returned`,
`joined` and `unjoined` for every sport with a live source, not just MLB. A second drifting scheme
that nobody has looked at is the likeliest thing this run finds.

**Pin the fix so it cannot rot back:** a test that fails when `joined` is 0 while `returned` is
non-zero, for any sport. That is the condition that was true and invisible.

## B2 — the box score URL is written for a game in progress

Prompt 77 stage 2 stopped at its prerequisite and was right to. `pipeline/load.py:91`:

```
boxscore_url = case when coalesce(%s, result_status) = 'final'
               then coalesce(boxscore_url, %s) else boxscore_url end
```

So the field is **never populated while a game is in progress** — 0 of 790 scheduled CFB rows, 0 of
2,822 across the unstarted leagues. Relaxing the UI gate alone would render a link that does nothing
in exactly the window Joe wants it.

**Joe's ruling: option (a), the loader — with a refinement.** Do not drop the condition, **widen
it**: `final` becomes `final or in_progress`. The gate exists because a box score for a game that has
not started is meaningless, which is also Joe's ruling — live and final, never scheduled. One more
state, same intent.

Option (b), deriving the URL in JS, was rejected for the reason this repo keeps paying for: it would
put the same per-sport URL mapping in two languages that must agree, and a rule kept in two places
drifts. `load.py:75` stays the single owner.

**Then relax the UI gate** at `GameDetail.js:121`, and label it **"Live box score"** while in
progress, **"Box score"** when final.

**Scope, established and narrower than expected:** programs have no `boxscore_url` column at all —
4,230 rows including races, fight cards and studio shows. Only matchup rows in `games` can carry one.
Say so where the link is rendered so the next reader does not go looking.

**The three stale MLB rows** that reverted from final to scheduled and kept a URL are stale data, not
evidence. Leave them; note them.

---

# BLOCK C — the watch links (was prompt 76)

## C1 — `guardians-tv` 404s

`config.js:296` is `https://www.mlb.com/guardians/watch` and it returns a hard 404, verified from
outside.

**Replace it with `https://www.mlb.com/guardians/schedule/watch`** — fetched and confirmed live. It is
MLB's official "Where to Watch" page for the club, and **it names DIRECTV channel 662 explicitly**,
which independently corroborates the channel map Cowork built on 2026-09-08.

Rejected, with reasons worth keeping so they are not re-proposed: the
`live-stream-games/subscribe/cleguardians` page is live but is a **sales page** — Joe already
subscribes, and a checkout is a worse failure than a 404 because it looks deliberate; and
`cleguardians.tv` has a **certificate hostname mismatch** and cannot be linked.

**Do not delete the entry.** `watchUrl()` is `WATCH[id] || DIRECTV_STREAM`, so removing it would fall
through to DIRECTV — Cowork's first recommendation, and wrong now that the MLB page is known useful:
that page tells him channel 662 itself, so keeping the entry gives him both routes.

## C2 — a Guardians game must render TWO links

**Joe, 2026-09-09:** *"I want to keep that link alive in addition to DirecTV - two separate links -
because the MLBTV feed offers more features."* The MLB route is a better feed he chooses, not a
fallback.

Prompt 71's design gives two links for an accessible **linear** broadcast — the service's mark
pointing at `watchUrl()`, plus one DIRECTV-marked link. Guardians TV is the awkward case: a channel on
DIRECTV 662 **and** a direct-to-consumer product in the MLB app. If `delivery_surface` files it as
streaming, no DIRECTV link renders and he gets one link where he asked for two.

**Open a real Guardians game and count the links.** Report what `delivery_surface` and
`networks_services.type` say for `guardians-tv`, and what renders. **If only one appears, stop and
report** — the fix could be the row's classification, the linear test, or a deliberate exception for
services that are genuinely both, and choosing between those is Joe's call.

## C3 — a checker for the other 34, nightly, that REPORTS

`WATCH` holds 35 hand-maintained URLs with nothing checking them. One rotted and it surfaced because
Joe tapped it.

Build a checker that requests every value and reports anything not successful, wired into
`schedule_refresh.yml`. **IT MUST NOT FAIL THE WORKFLOW** — Joe's ruling. Thirty-five external hosts
will produce transient failures that have nothing to do with this repo, and a nightly job that goes
red for someone else's outage gets ignored, which is how the dead link survived. Say how the report
is surfaced so it is actually seen.

Notes rather than instructions: some hosts refuse `HEAD` or bot agents — `livescores.js` already
learned this when a Chrome UA took a 403 from Akamai on 2026-09-03, so **reuse that lesson** and treat
a 403 as *could not check* rather than *dead*. Follow redirects and report the final status and final
URL, so a silent redirect to a marketing page is visible. `tests/test_workflows.py` guards the
workflow file (rule 28).

**Write down what the checker cannot do.** A status check proves a URL is alive, not that it is
right: `'wuab-43': 'https://www.fox8.com/'` returns a clean 200 and points at a different station.
**Also produce a one-off table for Joe** — all 35 with service id, URL, final URL after redirects,
status, and *what the page actually is* (live area, marketing, sales, wrong property). Change nothing
from it.

## C4 — can MLB links be game-specific? REPORT ONLY

**This depends on B1 and its premise was wrong — see above.** If B1 establishes what `games.id` is
and whether MLB's `gamePk` is recoverable from it, then and only then:

1. **The MLB game URL shape.** Take a real gamePk and determine what public MLB URL addresses that
   game. **Fetch it.** A shape that looks right and 404s is what block C is about.
2. **Whether MLB's `apple-app-site-association` claims that path.** Prompt 59's harvest recorded
   *"MLB: paywall pages only"*; a re-fetch returned binary Cowork could not parse. That is standing
   evidence, not an answer. Re-harvest and say what it claims. **If the game path is not claimed, the
   "MLB app opens on the game" tier does not exist** and a fallback chain built on it degrades
   silently.
3. **Whether one rule serves every MLB game or only the local club's.**

**Change nothing here.** If the AASA claims nothing useful, say plainly that the ceiling is the MLB
game page in a browser — the same ceiling ESPN has — rather than dressing a landing page as a deep
link.

---

# BLOCK D — the list order and the favourites marker (was prompt 75)

**Block A changed `Listing.js` and `page.js`. Every line number below predates it — LOCATE BY
CONTENT, not by line** (rule 22), and say what you found.

## Joe's ruling, 2026-09-09

> *"Organize qualifying events by TIME, including pregame shows and MyTeams games. THEN when events
> start at the same time, prioritize by: Pregame shows, MyTeams, Other events."*

His worked example — Sunday NFL, day/list, Browns and Panthers among his teams:

```
FOX NFL Kickoff             11:00   FOX
FOX NFL Sunday              12:00   FOX
CBS NFL Today               12:00   CBS
Browns @ Steelers            1:00   CBS
Football Night in America    7:00   NBC
Panthers @ Bucs              8:15   NBC
```

And his three answers: **within each sport band**, not one flat list; **the gold left rule becomes a
gold OUTLINE of the card**; **any studio show, pre or post** — *"so long as the priority is 1) TIME
2) pre/post THEN myteams THEN other events."*

## D1 — `chronological()` learns a third term

`chronological()` (`web/lib/favorites.js`) already sorts by time and breaks a tie with `isProgram`.
Add one more term after it: **a favourite outranks a non-favourite.** Final order:
**time → studio show → favourite → everything else.**

It does not know what a favourite is; both call sites already hold `favIds`. Decide how the
comparator learns it and say why. **Do not restate `isProgram` or the favourite test inside it** —
its own comment says why.

Both call sites, and rule 32 applies: prompt 71's brief named day mode only and week had the same
defect. In MY TEAMS every row is a favourite so the term is inert — **confirm by measurement, because
"inert" is the assumption most likely to be wrong.**

Pin Joe's example as a test: six rows, two favourites, three studio shows, two pairs tying at 12:00.

## D2 — the float comes out

**This reverses a settled decision and must be recorded as one (rule 10).** D6 ruled it at prompt 20;
prompt 59 reworked it into the gold bracket after Joe said the old treatment read *"like an
afterthought"*; prompt 53 stage 6 gave MY TEAMS the switch. It goes because Joe's ordering makes
position meaningful, and a group floating to the top contradicts a list sorted by clock.

`floatFavorites` threads from `page.js` through `Listing.js` into `SportBand`. With the float gone
**nothing passes `true`**, so the prop and the `.favgroup` rule are dead — and dead code goes with the
feature, as prompt 67 did with `FirstBand` and `bandstate.js`.

**Enumerate before deleting.** `git grep` `floatFavorites`, `favgroup`, and whatever `SportBand` calls
the group internally; report every hit; name anything that survives and why. Tests that pinned the
float's render are **inverted, not deleted**, so a float coming back fails a gate. Correct
`enhancement-register.md` and `handoff-status.md` in the same commit.

## D3 — the gold outline, and it must not be a border

### Use CSS `outline`, and the reason is measured

`.mcard` is `grid-template-columns: 78px minmax(0, 1fr) 92px 100px`. The body track is
`minmax(0, 1fr)`, so anything taking horizontal space comes out of what `fitNameAndRecord` has for a
name and a record. Prompt 59 measured this across 26 favourite cards over seven days: **11px of inset
dropped 10 of 26 name tiers; 6px dropped none.** A 2px border on four sides spends 4px of that budget
on every favourite card.

**`outline` is painted outside the border box and takes no layout space**, so the cost is zero and
prompt 59's finding is preserved rather than re-litigated. **Verify it — measure the body track on a
favourite card before and after and show it unchanged** rather than trusting this brief (rule 34).

### THE COLLISION YOU MUST RESOLVE — gold outline already means focus

`globals.css:1015` is `outline: 2px solid var(--gold)` as a **`:focus-visible`** indicator, and
`.mcard` is a `button`. **A gold outline marking ownership would be indistinguishable from the focus
ring**, and a keyboard or switch user loses the ability to see where they are.

Make the two unmistakably different and **say how and what you measured** — width, `outline-offset`,
a different token, or a change to the focus ring. **If nothing reads clearly at 390px, stop and
report** rather than shipping two golds that mean different things.

### The rest

Check clipping (an outline paints outside the box; an `overflow: hidden` ancestor crops it) and
collision with the neighbouring card; set `outline-offset` deliberately. Follow `border-radius`.
Measure the gold's contrast on the card ground. **And MY TEAMS outlines every card, which is noise —
report what it looks like and recommend; do not decide silently.**

Screenshots at 390×844 into `assets/`: Joe's Sunday NFL example in ALL GAMES day/list; a mixed band;
a focused card beside an unfocused favourite; MY TEAMS.

---

# GATES AND COMMITTING

Five gates before **each** block's commit, each its own command, all reported (rule 26). Clear stray
dev servers and chromium before the first run and say what you started from. Run all four probes.

Tripwire unmoved throughout: CFB `2026-09-05` 64 / {240, 223, 205, 136} / 1273, MLB `2026-09-03`
3 / {228} / 567, NFL 17 / {264, 98, 73} / 1044. **Block D changes list ordering and card decoration,
not block geometry** — if a count or width moves, stop.

**Rule 23, and it is not the same answer each time.** Prompt 77 found `mobile_demo.html` does depict a
live card from static fixture data. Block D changes card decoration and list order, which that file
**does** implement — establish it and change it in the same commit if so. Say the answer for every
block rather than one blanket line.

Staged by explicit path (rule 4, never `git add -A`; `assets/` stays untracked). Secret-gate each on
ADDED lines only, with `grep`, never `findstr` (rule 3).

**Block A pushes. Nothing else pushes without Joe's word.** Report per block: gates, the enumerations,
the measurements, the stop-and-report items, and the screenshots.

Write the gate floors into `docs/handoff-status.md` after the last gate run of each block, not during.
