# Prompt 57 — the odds pipeline, the third grey, and the banner generator

**Run after prompt 56.** `CLAUDE.md` is the standing brief. **Read it from disk before citing any
rule number** — there are 32 rules and five gates, and at least one consumer of this brief was
working from a stale copy with 29 and four.

Every finding below was verified against the tree at `07afc52` twice: once by Cowork, once by a
Claude Code review that found five errors in the first draft. Those corrections are folded in and
marked. Where a citation here is still wrong, correct it and report it.

## PRECONDITIONS

1. `HEAD == 07afc52 == origin/main`, **with three files modified and uncommitted** — see stage 0.
2. Tree otherwise clean except the six untracked `assets/` directories.
3. **Rule 1 first.** Certify the Python interpreter for Windows before running anything Python.
4. Record the five baseline gate counts before any edit.

## THE UNATTENDED CONTRACT

Stages self-commit. **Hard stops are only:** a secret-gate hit, a destructive database operation, or
a rejected push. Everything else is two-strikes-skip — attempt, attempt again differently, then
record what you tried and what happened, move on, and never roll back a green stage because a later
one failed.

**No database writes. Not one.** Every database interaction in this run is a `SELECT`-shaped
PostgREST anon read (rule 14 permits exactly that and nothing more). Stage 4 writes a migration
**file** and does not apply it.

**No loader runs.** Stages 2 and 3 change adapters and are proved at the **fixture** level. The
database fills on the next scheduled `schedule_refresh` at 11:00 UTC — which means **CFB and NHL odds
will not appear on the site until the morning after this run.** That is expected, not a failure.

---

## STAGE 0 — commit the pending `.favlabel` work

Three files are modified and uncommitted, the work is done, and the gates were green:

```
 M web/app/globals.css          the 22.5px declaration deleted; 15px now the only phone rule
 M docs/enhancement-register.md §24h
 M docs/handoff-status.md       the D6 supersession pointer
```

**Joe approved this commit on 2026-09-07.** Everything after this stage assumes it landed, so it goes
first or the rest of the run is built on a baseline that does not exist.

Re-run all five gates (they are cheap and rule 26 wants them as their own commands before the
commit), secret-gate the diff on **ADDED lines only** with `grep` — never `findstr` (rule 3) — and
stage by explicit path (rule 4).

Do not re-litigate the change. For the record of why it was safe: 22.5px was **prompt 31's, ruled by
Joe on 2026-09-03**, and reversing it is legitimate only because that ruling's premise expired when
prompts 51 and 56 removed every path by which `.favlabel` could reach page level. **That reasoning is
in register §24h and must stay there** — without it a future reading of spec 05 puts 22.5px back.

**Commit:** `hub: one phone size for the favourites marker`

---

## STAGE 1 — the odds the card shows are the oldest ones ever fetched

**This is the stage that fixes what Joe actually sees, and it needs no database change.**

`web/lib/queries.js:41` embeds:

```
odds:game_odds(provider,spread,total,home_moneyline,away_moneyline,fetched_at)
```

with **no `order` and no `limit`**. PostgREST guarantees no ordering on an embedded resource, so what
comes back is insertion order. Combined with stage 4's finding — that every daily refresh **inserts**
another row rather than updating one — the row at index 0 is the **oldest line ever fetched** for
that game. Every NFL, NBA and MLB card has been showing an opening line, frozen, since the refresh
went daily on 2026-09-03.

**Add `order=fetched_at.desc` and `limit=1` to the embed.** PostgREST takes these as top-level params
keyed to the embed alias (`&odds.order=fetched_at.desc&odds.limit=1`), not inside the `select`
string. Verify the syntax against how `queries.js` actually assembles its URL before assuming; this
file builds the query in more than one place and the params have to reach all of them.

**THREE consumers, not two.** This is rule 32's exact shape, and the first draft of this brief said
"both" and missed the grid:

```
web/components/MatchupCard.js:136   const o = (game.odds || [])[0];
web/components/GameDetail.js:40     const odds = (game.odds || [])[0];
web/components/MobileGrid.js:597    const odds = (game.odds || [])[0];
```

`git grep` the pattern yourself and confirm the list is exactly three before you finish. The
`[0]` reads can stay — with `limit=1` there is only ever one — but **every one of the three must be
verified**, and a test that pins only two is a test that will not catch the next regression.

Rule 19 still governs the top-level select: unbounded selects cap silently at 1,000 rows. Pin the
regression test to the **call site**, never to a row count.

**Acceptance:** the composed query string, printed. A game known to carry multiple `game_odds` rows,
read through the app's own path, returning exactly one — the newest by `fetched_at`. All three call
sites named with their line numbers as they stand after the edit.

**Commit:** `odds: the card reads the newest line, not the first`

---

## STAGE 2 — NHL has never had odds

`adapters/nhl.py:169` sets `"odds": None` literally. It is invisible today only because the season
has not started; it ships a blank right slot on October 1 otherwise. **Joe instructed on 2026-09-07
that this is fixed in this run.**

Both halves already exist in the repository:

1. `adapters/espn.py:40` maps `"nhl": "hockey/nhl"`, so `fetch_scoreboard("nhl", date)` works today.
2. `adapters/espn.py:118 _odds()` parses the exact block ESPN returns. `adapters/nba.py:33` already
   imports both. **Write no new parsing code.**

Verified live on 2026-09-07: `hockey/nhl/scoreboard?dates=20261001` returned 8 events, **8 of 8**
carrying a DraftKings block with `spread`, `overUnder`, `moneyline`, `awayTeamOdds`, `homeTeamOdds`.

### The join, and the trap

**DO NOT JOIN ON IDS.** `adapters/nba.py:226` warns that the league-API path mints ids that are "NOT
what the database holds and NOT what `web/lib/livescores.js` joins on," and that loading from it
"would leave every NBA card without a live score and raise no error at all." The comment is about
NBA; the trap transfers exactly.

**Join on `(ET date, away abbreviation, home abbreviation)`** — unique because no NHL club plays
twice in a day — with the NHL abbreviations translated through the map that already exists at
`adapters/nhl.py:38`:

```
NHL_TO_ESPN = {"LAK": "LA", "NJD": "NJ", "TBL": "TB", "SJS": "SJ", "UTA": "UTAH"}
```

Verified live on 2026-09-07 against both APIs: 32 clubs each, **exactly five** divergences, and this
map covers all five and nothing else. A bare abbreviation join silently drops every game involving
the Kings, Devils, Lightning, Sharks and Mammoth — roughly a third of the schedule, with no error.
That is rule 18's shape: exact match, and cross-check a second key. Here the second and third keys
are the two abbreviations together with the date; a match on one abbreviation alone is not a match.

### What must not happen

- **If the ESPN fetch fails, `odds` stays `None`.** Never invent, never partially fill. `nhl.py`
  already has `_safe` for exactly this shape of optional side-fetch — follow it.
- **A game with no ESPN match is not an error.** Log it, count it, move on.
- **Zero odds on a far-out date is not a failure.** Measured 2026-09-07: `dates=20261015` (11 events)
  and `dates=20261110` (7 events) both returned **zero** odds blocks. Books post NHL lines only as
  the game approaches, so lines land on the second or third visit to a game, not the first. The
  rolling 7-day NHL window sits inside that.

### Acceptance

Run the adapter for a date range that includes 2026-10-01 and report, from the **fixture**:
games in the window, games matched to an ESPN event, games carrying a non-null `odds` block, and
games unmatched with their abbreviations. Confirm at least one of the five mapped clubs appears in
the matched set. **No loader run.**

**Commit:** `nhl: odds from the espn scoreboard, joined on date and abbreviation`

---

## STAGE 3 — CFB has never had odds either, and the fetcher was written and never wired

`adapters/cfbd.py` contains **zero** `"odds"` keys. `adapters/cfbd.py:55` defines
`fetch_lines(year, week, season_type)` calling CFBD `/lines` — and **it is called from nowhere in the
repository.** Somebody wrote the fetcher and never connected it. Downstream,
`pipeline/load.py:258` guards on `if od and od.get("spread") is not None`, so no key means no
`game_odds` row, `favourite()` returns null, and `lib/format.js:271` — `slotContent` rung 4 — is
never reached. **That is the empty slot Joe reported.**

### Do not code against an assumed shape

CFBD returns **401** unauthenticated (verified 2026-09-07) and there is **no saved `/lines` sample
anywhere in `artifacts/validation/`.** So:

1. Read `CFBD_API_KEY` from `.env`. **Never print its value**, not in a log, not in a report, not in
   an error message.
2. Fetch **one** week. Dump the raw response to
   `artifacts/validation/cfbd_2026_w{week}_lines_raw.json`.
3. **Map from what you observe**, not from what you expect. Report the observed shape in the run
   report: the top-level entry keys, and the keys of whatever per-provider structure it carries.
4. That fixture becomes the test's pin. Rule 29 applies to writing it — `newline="\n"` or write
   bytes.

### The mapping

The target contract is what `pipeline/load.py:259-261` consumes: `provider`, `spread`, `overUnder`,
`moneylineHome`, `moneylineAway`, `fetchedAt`.

CFBD returns multiple providers per game. **Choose one deterministically and say which**, mirroring
the pattern `adapters/mlb.py:165` already uses (a named preference, then a named fallback, then the
first). A provider chosen by iteration order is a provider that changes between runs.

**Join on the CFBD game id**, which `cfbd.py` already carries through its fixture — this is the one
adapter where the ids genuinely match, so the stage 2 warning does not apply. Confirm that by reading
the id field in both the `/games` and `/lines` responses before relying on it.

Remember `load.py:258`: a game whose chosen provider has no `spread` produces no row at all, even if
it has moneylines. Count those separately rather than reporting them as failures.

### Acceptance

From the fixture: FBS-involving games in the week, games carrying a non-null `odds` block, games
whose chosen provider had no spread, and the provider distribution. The raw dump committed. **No
loader run.**

**Commit:** `cfb: wire the lines fetcher into the fixture builder`

---

## STAGE 4 — the migration that stops odds accumulating. **PREPARE ONLY. DO NOT APPLY. DO NOT TOUCH THE LOADER.**

`pipeline/load.py:259-261` upserts `game_odds` with conflict target `"game_id, provider, fetched_at"`
and an **empty** update list. `pipeline/db.py:149` compiles an empty update list to
`ON CONFLICT ... DO NOTHING`. And `adapters/espn.py:127` stamps `"fetchedAt": now_et_iso()` fresh on
every run. **The conflict target can therefore never match, and every daily refresh inserts a new row
per priced game.**

The fix is a conflict target of `(game_id, provider)` with an update list of
`["spread", "total", "home_moneyline", "away_moneyline", "fetched_at"]`. **That requires a unique
constraint that does not exist**, which is a migration, which is a database write, which rule 14
makes a hard stop.

**So this stage does three things and stops:**

1. **Read `db/migrations/` and report** which migration created `game_odds` and what constraints it
   carries today. Cite the file and the lines.
2. **Count, via PostgREST anon reads only** (rule 14 permits these; rule 19 governs them — use the
   paginating `restAll()`, never an unbounded select): the total `game_odds` row count, the number of
   distinct `game_id` values, and the worst single game's row count. Those three numbers tell Joe
   the size of the cleanup.
3. **Write the migration file** — additive, following the numbering already in `db/migrations/` —
   creating the unique constraint, and **do not apply it.** Rule 6: additive over destructive, close
   rather than delete. If the existing duplicates would violate the constraint, say so and include
   the dedupe SQL as a **separate, commented, unapplied** block for Joe to review.

**Do not change `pipeline/load.py` in this run.** Shipping the new conflict target before the
constraint exists would break every loader run with an error on a non-existent unique index. The
loader change belongs in a follow-up, after Joe has applied the migration.

**This is not urgent, and stage 1 is why.** With `limit=1` and `order=fetched_at.desc` the card
already shows the newest line regardless of how many rows sit behind it. Stage 4 is table hygiene.

**Commit:** `db: the game_odds uniqueness migration, unapplied`

---

## STAGE 5 — darken `--panel-top` and give the greys back their third step

Approved by Joe on 2026-09-07.

`web/app/globals.css` `:root` — `--panel-top: #31363d`. The comment on `--faint` in the same block
records the problem and hands the decision to Joe: true AA on the card's top surface needs `#989fa8`,
which measures **4.55:1** against `--dim`'s own **4.62:1** — the two collide and the third grey step
dies. *"There is no room for a step above it without moving `--dim` or lightening the gradient's top
end. Both are Joe's call."* He has now made it: **darken the gradient's top end.**

### How

**Rule 13 governs every measurement here: contrast is measured against the local background, never a
global corner sample.** The local background for a card's first line is the top of
`linear-gradient(180deg, var(--panel-top), var(--panel-bottom))`, not `--panel`.

**Rule 16: read the tokens from `globals.css`. Do not retype a hex from anywhere else.**

1. Measure `--ink`, `--dim` and `--faint` against the **current** `#31363d` and record the table.
2. Solve for the darkest `--panel-top` at which `--faint` **at its current value** reaches 4.5:1 on
   that surface, while `--dim` stays at least 1.3:1 distinct from `--faint` so the third step is real
   rather than nominal.
3. **Bound: if that solution requires darkening by more than 10 points of lightness, stop, report the
   number, and ship nothing.** A card that reads as a different colour is not what was approved, and
   it is Joe's call whether to go further.
4. Apply, then re-measure all three against the new value.

### The blast radius

`--panel-top` feeds **10** instances of `linear-gradient(180deg, var(--panel-top),
var(--panel-bottom))` — the matchup card, `.seg`, `.spbtn` and `.pk-arrow`. `git grep` the token and
confirm the count. Re-measure `--ink`, `--dim` and `--faint` on **each** of those four surfaces, not
only the card.

The active-toggle gold plate uses its own literal first stop (`#D8C595`) rather than the token, so it
should be unaffected — **confirm that by reading the rule, do not assume it** (rule 22).

**Acceptance:** the before/after contrast table for all three tokens on all four surfaces, the new
hex, and the count of `--panel-top` consumers.

**Commit:** `theme: darken the card gradient so the third grey survives`

---

## STAGE 6 — the banner generator, then model F

**Read this whole stage before starting. The mechanism in the first draft of this brief was wrong and
the correction is the point of the stage.**

### What is actually true

`web/components/Banner.js:5-7` says the JSON files "ship as DOCUMENTATION of the same values;
nothing reads them at build time," and that the component "is regenerated from it" — coordinates
"never hand-edited here." **The tool that does that regeneration does not exist in the repository, or
anywhere else reachable.** Nothing in `scripts/`, `pipeline/` or `tests/` reads `banner-mobile-v2`;
the only references are docs, `Banner.js`, the JSX and the JSON itself. Cowork's own
`claude/src/build_banner.py` is the 2026-09-02 review-page builder — a different composition
entirely — not this generator.

**And the JSON cannot express the change even if a generator existed.** Its top-level keys are
`name, date, prompt, stage, background, glow, title, tagline, tv, marks, filters, headroom_paint,
_gold`. **There is no `viewBox`** — `0 0 428 155` lives only at `BannerMobileV2.jsx:28` — and
`background` carries `{type, direction, stops}` with no geometry.

So the repository holds a generated file whose generator nobody has, and a source of record that
cannot express the most important change. **Joe approved closing that hole in this stage** rather
than editing around it.

### 6a. Build the generator and prove it before changing anything

Write `scripts/build_banner_mobile.py`. It reads `web/lib/banner-mobile-v2.json` and emits
`web/components/BannerMobileV2.jsx`.

**Extend the JSON, through a parser, asserting nothing but the intended keys changed (rule 17):**

- a `viewBox` object carrying the width and height;
- geometry for the `background` rect.

Everything else the generator needs is already there: each of the 23 marks carries
`{id, file, group, x, y, w, h}`, and `title`, `tagline`, `tv` and `glow` are fully specified.

**Then prove it, before touching a single coordinate.** Generate from the **unmodified** JSON and
compare against the **committed** JSX by parsing both and asserting:

- identical `viewBox`;
- identical element count by type;
- identical `x`, `y`, `width`, `height` for every `<image>`, the rect and both ellipses;
- identical `<defs>` — gradient stops, filter primitives, and the `bn` id namespace;
- identical text baselines, sizes and letter-spacing.

**A one-time reformat of the JSX is expected and acceptable** — whitespace and attribute order may
change once, in this commit, and are stable thereafter. **A geometry difference is not.** If the
generator cannot reproduce the current geometry exactly, stop, report the discrepancy, and ship
nothing from this stage. Do not "fix" the JSON to match a generator you have not verified.

Add a test asserting the committed JSX equals the generator's output. Rule 29 governs how it is
written — `newline="\n"` or bytes — and `tests/test_fixture_bytes.py` is the pattern to follow.

### 6b. Apply model F

Only once 6a is green. Edit the **JSON**, regenerate, commit both.

**viewBox `0 0 428 155` → `0 0 428 135`.** Renders **123.0 px** at a 390px viewport, down from 141.2
— 18.2px saved. Rendered height is `viewport × viewBox height ÷ 428`.

Every value below was verified against the JSON by the Claude Code review of this brief.

1. **A uniform −7 on every element.** Artwork ran y=11→141 with 11 units of margin above and 14
   below; both become 4.
2. **MLB** — y=11 → **14**. Its top now floats **10 units above** the NFL (24) and NHL (25) tops.
   `x`, `w`, `h` unchanged.
3. **NASCAR** — y=129 → **119**, base at 131. **10 units below** the NBA (121) and WWE (118) bases.
   `x`, `w`, `h` unchanged.
4. **TV cutout** — scaled to **70%**: 79.9×84 → **55.93×58.8**. x 294.05 → **306.04** (same centre
   axis, 334.05). y → **43.1**, centred on the array's vertical midpoint of 72.5. *The cutout is
   illustration, not a logo — it is the one element allowed to scale.*
5. **NFL, NHL, CFP, UFC, NBA, WWE** — original y minus 7 only: **24, 25, 60, 66.5, 93, 96.** No other
   change.
6. **The 15 network marks** — three rows, each up **6.5** units from their trimmed position, closing
   the gap under the tagline from 12.5 to 6:
   `nbc 52 · abc-gray 52 · fox 55.7 · espn 55.7 · cbs 55.7 · guardstv 75.5 · dazn 78 · prime 80 ·
   appletv 80.5 · paramount 81.5 · tnt 104 · netflix 107.7 · peacock 107.7 · usa 107.5 · tbs 107.5`
7. **Wordmark** baseline 36.88 → **29.88**. **Tagline** baseline 53 → **46**. Sizes and
   letter-spacing unchanged.
8. **The background rect and both glow ellipses** re-fit to the 135-unit box.

**No logo changes size. All 23 marks remain.** Joe approved this arrangement on 2026-09-07 after
rejecting two earlier ones; the entire 7.3px it costs against the tightest alternative is the NASCAR
drop, and that was a deliberate choice.

**Rule 23:** if `docs/design/mobile_demo.html` implements the banner, it changes in this same commit.
**Read the file and check** — do not assume either way (rule 22).

The **desktop** banner (`BannerDesktopV2.jsx`, 1400×200, from `banner-desktop-v2.json`) is **out of
scope.** Not analysed, not approved, not touched.

**Acceptance:** the 6a parity proof as a table; the rendered height before and after at 390; a
screenshot of the banner at 390; confirmation that the generator round-trips.

**Commits:** `banner: a real generator for the mobile banner` then `banner: model f`

---

## STAGE 7 — one sheen, in the one place it costs nothing

Approved by Joe on 2026-09-07.

A **single, slow, one-time sheen across the banner wordmark on load.** Nowhere else.

**It must not touch any gold that carries state.** Gold is load-bearing in this app: the active
toggle fill (`.seg button[data-active='true']`), the active tile border, `.scopeline`,
`.weekday-head`, and `.pk-arrow:focus-visible` all mean *this is selected* or *this is the day you
are on*. A sheen on those turns a signal into decoration. The wordmark is pure identity and carries
no state, which is the entire reason it is the one safe surface.

**Constraints:**

- Inside `@media (prefers-reduced-motion: no-preference)`, with the existing micro-interaction block
  (`globals.css` ~2926). That block's own comment is explicit that the guard is a wrapper, not a
  `reduce` block that undoes things.
- **Nothing that moves a box.** `transform`, `opacity`, `filter` or a gradient offset only — the same
  constraint prompt 52 stage 2 worked under, and for the same reason.
- Handoff §6 forbids gloss, and §16 authorises 120–220ms for **state** transitions. A one-time
  identity sheen is a different gesture and should be slower than that range. **Justify it in the
  comment rather than claiming §16 covers it** — §16 does not.
- One pass on load, not a loop. A banner that shimmers every few seconds is an advert.

**Acceptance:** the geometry before and after, proving nothing moved; confirmation that no
state-carrying gold site was touched, each named.

**Commit:** `banner: a single sheen across the wordmark`

---

## STAGE 8 — four strings, one of which is a comment

**1. `'Starter TBA'` — `web/components/MatchupCard.js:118`.** `showProbable` renders
`probable || 'Starter TBA'` on every MLB card, twice, whether or not anything is known. The card's own
rule three lines above reads *"Absent means ABSENT, per line: no blank row is reserved for anything
that does not exist."* Drop the placeholder; render the line only when a probable exists.
**`GameDetail.js` keeps its own** — the panel is exactly where a reader goes to find out that the
starter is not announced.

**2. `'Assignment not entered'` — `web/components/GameDetail.js:24`**, `ACCESS_LABEL.unverified`.
*(Corrected from `:25`.)* This is the build describing its own database state to someone who came to
find out what is on television — the same class as the developer footnote R5 removed in prompt 56.
Reword it into the reader's language.

**3. The dead search chain — four sites, all in one commit.** `git grep` each before deleting:

- `SearchBox` — `web/components/Filters.js`. **Zero callers.**
- `matchesSearch` — `web/lib/queries.js:181`. **Zero callers.** Orphaned when `/history` folded into
  the hub.
- `networkName` — `web/lib/queries.js:170`. Reachable **only** through `matchesSearch`
  (`queries.js:192`), and it carries `'No linear telecast'` at `:175` — the string prompt 24 flagged
  as a false certainty on games with no broadcast row.
- **`web/components/MatchupCard.js:131` — a comment describing `'No linear telecast'` as a live
  concern.** It becomes false the moment the chain is deleted, and **rule 30's second half puts the
  correction in this same commit.** *(This fourth site was missed in the first draft of this brief.)*

Deleting the chain retires that string permanently rather than leaving it one wiring change from the
screen.

**Acceptance:** `git grep` proving zero remaining references to each of the four, run after the
deletion.

**Commit:** `hub: retire three dead strings and the search chain that carried one`

---

## STAGE 9 — the record

**Register §25** (last is §24 — verify): the odds pipeline as one entry with all four defects and
which of them this run fixed; the NHL join keyed on date-plus-both-abbreviations and **why not ids**;
the CFBD provider-choice rule; the `--panel-top` ruling with its before/after contrast table; model F
with Joe's approval dated 2026-09-07 and the note that G was considered and rejected for putting MLB
against the ceiling; and the banner generator as the closing of a documented-but-absent tool.

**`docs/handoff-status.md`:** the stage/commit table, the five gate counts, and — prominently — that
**CFB and NHL odds do not appear until the next scheduled refresh**, so nobody reads an empty slot
the same evening as a failed stage.

**Two things for the open-items list**, both still outstanding and neither in this run: the migration
from stage 4 awaiting Joe, and the loader conflict-target change that must not ship before it.

**A working rule 33, only if this run earns one.** Rules stop at 32 — verify. The candidate: *a
comment that describes how a file is generated is not evidence the generator exists.* Stage 6 exists
because a workflow was asserted from `Banner.js:5-7` without checking the tree. Write it only if you
agree it is distinct from **22** (read the component, not the contract) and **30** (a note recording
an absence is a timestamp). If it is one of those in a costume, say so and extend that one instead.

**File this prompt** at `docs/prompts/57-odds-pipeline-third-grey-banner-generator.md`, verbatim.

**Commit:** `docs: register §25 and the run of record`

---

## THE REPORT

1. **Stage 1's composed query string**, and the one-row proof through the app's own path.
2. **Stage 2 and 3 fixture counts** — games in window, matched, carrying odds, unmatched — and the
   observed CFBD `/lines` shape.
3. **Stage 4's three numbers**: total `game_odds` rows, distinct games, worst single game. And the
   migration SQL, unapplied.
4. **Stage 5's contrast table**, before and after, all three tokens on all four surfaces.
5. **Stage 6a's parity proof**, and a screenshot of the banner at 390 after model F.
6. Stage by stage: sha, all five gate counts, anything skipped under two-strikes.
7. **Every citation in this brief that turned out to be wrong**, with the correction. The first draft
   had five; assume this one has some too and go looking rather than waiting to trip over them.
8. **HEAD, and whether `HEAD == origin/main`.**

Then stop. Do not deploy, do not open a browser, do not write to the database.
