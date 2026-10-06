# Prompt 127: One read-only address that answers with Joe's teams' games for the week

This builds on `cd18385` (prompt 126). **Stop and report if any of these checks fails:**

- `git rev-parse HEAD` equals `git rev-parse origin/main`, and both are `cd18385`.
- `git status --porcelain` shows only untracked `assets/` entries.
- `python scripts/remove_codex_agents_md.py` exits 0.

Written by Cowork on 2026-10-05 from a read of the tree at `cd18385` (a clone of the public repo,
and Joe's folder, which matched it). Nothing was run and no database was read. A separate reviewer
then read this brief against the same tree, also running nothing: two faults that would have
stopped the run or shipped a wrong answer, and nine smaller ones, all corrected here and not read
a second time. **Verify every file:line before acting on it** (rule 22).

Joe may not be at the keyboard for all of this run. Don't wait on a question: where this brief
leaves a choice, make it, keep going, and say what you chose in the report. The stop list, a red
gate you can't make green, and a failed check above are the only stops.

---

## What Joe wants

Another app of Joe's, MyDash, will draw small score boxes for his own teams: who plays, when,
where, on what broadcast, and the live score. Joe's ruling of 2026-10-05: that app reads the games
**from MySports' own read-only address**, and works out nothing for itself. So the address must
say what MySports' own card says, by calling the card's own code (rule 32).

Today the app has no such address. `web/app/page.js` reads the database on the server and draws
the cards; the only game JSON it offers is `GET /api/live?day=…` (`web/app/api/live/route.js`),
the live score for one day.

## The address, Cowork's recommendation (Joe may veto it before the run)

**`GET /api/my-games`** answers with every game one of Joe's favourite teams plays, from the
current viewing day through the next seven, in the order the page shows them.

- **It takes no parameter.** The live route refuses a client's list of games so that what it
  fetches is "a function of the DATABASE and the clock" (`web/app/api/live/route.js:16-22`). This
  one is a function of the database, the clock and `data/favorites.json`. It reads no query
  string.
- **The days, and the one place this address differs from the page on purpose.** The page's
  "today" is the calendar date in ET (`todayET()`, `web/lib/format.js:162-170`), while a game is
  filed under its viewing day, which changes at 3 AM. So on the page, from midnight to 3 AM ET, a
  late game still in progress belongs to yesterday and gets no live score
  (`web/lib/livescores.js:230-240`). A score box would lose a West Coast game at midnight, in
  mid-play. **So this address's first day is the current viewing day,
  `viewingDayOf(new Date())`** (`web/lib/programs.js:276-289`, the app's own 3 AM rule), through
  `addDays(thatDay, 7)` (`web/lib/weeks.js:30`): eight viewing days. The answer calls it `today`.
  The page is not changed.
- **The read.** One call to `gamesForRange(start, end)` with no sport (`web/lib/queries.js:93-97`),
  so the rows are `GAME_SELECT`'s, the card's own. **Add nothing to `GAME_SELECT`**
  (`web/test/qatbd.test.mjs:58` holds a fixture to its exact fields), and add no sixth
  `games?select=${GAME_SELECT}` call site (`web/test/odds.test.mjs:37-53` counts five). It reads
  the whole eight-day slate to keep a handful of rows; that is chosen, for one query the card
  already trusts.
- **Whose games.** `isFavorite(game, favoriteIds(favoritesDoc))` (`web/lib/favorites.js:13-25`),
  over game rows only. Not `isMine`: the address carries no programs and no team-less sports.
- **The live score.** As the week page does it (`web/app/page.js:358-362`, and the note above it):
  hand the overlay only one day's games, then `applyOverlay`. Here the day is this address's
  `today`, passed as both the day and "today" (`overlayForDay(today, rows, { today })`), and the
  rows are only that day's favourites' games, so the upstream fetch is for the sports Joe's teams
  play that day and no others.
- **The order is the page's own.** `chronological(rows, favIds)` (`web/lib/favorites.js:194-217`)
  on rows in the query's order, then a stable sort by viewing day, which is the grouping `byDay`
  makes (`web/app/page.js:232-236`). So a game whose kickoff is TBD leads its day, as it does on
  the page, and two games at the same instant keep the query's id order. Say so in a comment.
- **It is open to anyone,** like the rest of the app (no sign-in, no middleware;
  `docs/deployment-contract.md` D4). It shows which thirteen teams Joe follows, which
  `data/favorites.json` already publishes. It sends `Cache-Control: no-store`, as
  `web/app/api/egress-probe/route.js:111` does, and no CORS header: MyDash reads it from its own
  server, at the production address.
- **How often it will be asked:** about once a minute while one of these games is live, and
  rarely otherwise. Each call is one PostgREST read, plus the live sources, which the repo's own
  notes say are held for 60 seconds (`web/lib/livescores.js:23`, `:204`); nobody has measured that
  under `force-dynamic`.

### What it answers

Status 200, JSON, in the live route's own spelling (camelCase). The first five top-level keys are
always there; `error` is there only when the database read failed.

```
{
  "today": "YYYY-MM-DD",          the current viewing day
  "start": "YYYY-MM-DD",          the same day
  "end": "YYYY-MM-DD",            seven days on
  "fetchedAt": "<when the live scores were read, as the overlay gives it, or null>",
  "games": [
    {
      "id": "<games.id>",
      "sport": "<games.sport>",
      "viewingDay": "<games.viewing_day>",
      "startsAt": "<games.canonical_kickoff_at_utc, or null when the card would print TBD>",
      "kickoffStatus": "<games.kickoff_status>",
      "status": "<result_status after the live overlay; it can be null>",
      "clock": "<live_clock, a string, or null>",
      "period": <live_period, a number, or null>,
      "card": { "kind": "<slotContent(game).kind>", "label": "<slotContent(game).row3>" },
      "neutralSite": <games.neutral_site>,
      "home": {
        "id": "<teams.id>",
        "name": "<what the card prints: cardName(team, team.id)>",
        "abbreviation": "<teams.abbreviation, or null>",
        "logoUrl": "<teamLogoDarkUrl(id), or null for a placeholder team>",
        "primaryColor": "<teams.primary_color as stored, or null>",
        "secondaryColor": "<teams.secondary_color as stored, or null>",
        "score": <home_score after the overlay when card.kind is "score"; otherwise null>
      },
      "away": { the same },
      "venue": { "name": "…", "city": "…", "state": "…" } or null,
      "broadcast": { "name": "… or null", "markUrl": "<absolute address, or null>" } or null
    }
  ],
  "error": "<only when the database read failed>"
}
```

- **`startsAt`** is null when `kickoff_status` is `tbd` or there is no instant: `etTime()`'s own
  test (`web/lib/format.js:57-62`). A TBD game carries a placeholder instant in the database
  (`pipeline/reconcile.py:367-370`), and a reader must never print it as a time.
- **`card`** is the card's own right-slot decision, `slotContent(game)` with no favourite passed
  (`web/lib/format.js:296-366`): `kind` is one of `exception`, `stale`, `score`, `live`, `none`,
  and `label` is the words the card would print ("Final", "Q2 7:12", "Live", "Postponed", "Final
  pending", "—"). It differs from the card in one way, on purpose: the card passes the favourite
  and draws a betting line on a priced scheduled game; the address never carries odds, so that
  game reads `none`.
- **The two scores are null unless `card.kind` is `score`.** The card suppresses a stale live
  row's score on purpose (`web/lib/format.js:311-314`), and a reader must not have to hold that
  rule.
- **`clock` and `period`** are the overlay's own: `period` is a number; `clock` is a string, and
  for baseball it is the inning half. `card.label` is the readable form.
- **`logoUrl`** is `teamLogoDarkUrl(team.id)` (`web/lib/config.js:200-203`), already absolute. For
  a placeholder team it is null: `isPlaceholderTeam({ ...team, sport: game.sport })`
  (`web/lib/placeholders.js:32-36`; the embed carries no sport, and
  `web/components/TeamMark.js:20,27` passes the game's). The address can't know whether a file
  exists; the card falls back to its badge when an image fails to load, and a reader needs the
  same.
- **`broadcast`** is what the card names, and nothing else:
  - the row is `cardBroadcast(game)` (`web/lib/cardbroadcast.js:43-55`); none means `null`;
  - `markUrl` is the mark the card wears, which is today one line in the component
    (`web/components/MatchupCard.js:176-178`): the Cavaliers' composite from `cardMarkSlug(game)`
    when there is one, else the row's own mark when `showsMark(b)`, else none;
  - `markUrl()` returns a path under this site (`web/lib/config.js:254-256`), and the app has no
    setting for its own origin. Make it absolute with the origin of the request itself
    (`new URL(path, request.url)`), keep its `?v=`, and add no setting. Cowork checks the host on
    its first read in production (rule 34: nothing in this tree uses a request's origin);
  - `name` is `b.network?.canonical_name || b.label || b.service_id`, the words
    `web/components/GameDetail.js:345` and `web/components/MobileGrid.js:208` print for a row. The
    card itself prints no network name (`web/lib/marks.js:29-36`), so this is the panel's rule,
    for a reader that has no mark to draw. **When the card wears a composite, `name` is null:**
    the row `cardBroadcast` returns there is one outlet of several, and its name beside a
    composite mark would be wrong.
- **What it doesn't carry, on purpose:** odds; programs; and whether Joe can watch (off-service,
  market pending, network TBD: `web/lib/offservice.js`). The last is Joe's call for another day.
- **Rule 8** as `docs/handoff-status.md:1273-1274` reads it: the payload names call signs and
  services exactly as the card does, and never who told Joe anything. The open privacy gate at
  `docs/handoff-status.md:1266-1274` covers this address as it covers the card; say so in the
  register.
- **If the database read fails:** status 200 with the five keys, `games: []`, and an `error` string
  cut to 200 characters, as the live route does (`web/app/api/live/route.js:63-69`). It never
  throws. A reader checks `error` before it blanks its boxes.

## Block A: the code

1. **One definition of "the mark the card shows," callable from `web/lib/`.**
   `MatchupCard.js:176-178` is JSX-file code that `node --test` can't import, and a second copy in
   the address would be the defect rule 32 names. Move that composition into `web/lib/` beside
   `cardBroadcast` (prompt 126 did the same for `cardBroadcast`, for the same reason:
   `web/lib/cardbroadcast.js:20-23`), have the card call it, and have the address call it. The
   card's markup and what it draws don't change. Three pins hold the card's present text; move
   each to the new single definition and to the card's call of it, and never delete or loosen
   one:
   - `web/test/cardbroadcast.test.mjs:235-236`, the mark line;
   - `web/test/cardbroadcast.test.mjs:241-245`, the `cardBroadcast` import, re-export and call;
   - `web/test/simulcastmark.test.mjs:74-76`, `const collapsed = cardMarkSlug(game);`.
2. **The same for `cardName`** (`MatchupCard.js:39-41`), which `GameDetail.js:18` and
   `MobileGrid.js:55` import from the component. Define it in `web/lib/`, and re-export it from
   `MatchupCard.js` under the same name so every import still works.
   `web/test/programpanel.test.mjs:52` and `web/test/cardbroadcast.test.mjs:247` pin calls and
   imports of it; with the re-export they should need no change.
3. **The broadcast's name, once.** That expression is already written twice, in two components
   this brief doesn't touch. Define it once in `web/lib/`, use it in the address, and add a
   source-text test that `GameDetail.js:345` and `MobileGrid.js:208` still read the same as it,
   so a change to either goes red. Reading those files needs no scope; don't edit them.
4. **Two pure functions in a new `web/lib/mygames.js`.** One returns the rows the overlay is
   handed: favourites' games whose `viewing_day` is `today`. The other builds the answer's
   `games` from the rows, the favourite ids, `today`, the overlay and the origin. Neither reads a
   file or the network, so the gate can run them (`web/lib/favorites.js:7-8` says why a bare JSON
   import fails under `node --test`). The clock is read in one place only, inside `slotContent`
   (`isStaleLive`, `web/lib/format.js:390`), which this brief doesn't change.
5. **The route, `web/app/api/my-games/route.js`,** shaped as `web/app/api/live/route.js` is:
   `dynamic = 'force-dynamic'`, `runtime = 'nodejs'`, one `GET`. It imports
   `data/favorites.json` the way `web/app/qa/tbd/page.js:28` does (the same depth), takes the day
   from `viewingDayOf(new Date())`, calls `gamesForRange`, the two functions and the overlay, and
   holds no rule of its own.
6. **Rule 19.** `gamesForRange` gains a second caller, and its written bound says the week page is
   its only one (`web/test/restcap.test.mjs:55-58`). Rewrite that reason so it is true for both:
   eight viewing days here. The repo's own measurements are 95 games on the heaviest day
   (`restcap.test.mjs:53`), 229 in the heaviest week (`:57`), and 146 in a seven-day window on
   2026-09-29 (`web/scripts/smoke.mjs:246-247`). If you can't write a bound for eight days that
   you believe, page the read with `restAll` and say so. Don't call `rest()` from the route or the
   new lib file: the cap guard walks `lib/queries.js` only.
7. **The notes this change makes false, in the same commit (rule 30):** the stale line references
   to `livescores.js` in `web/app/api/live/route.js:25` and `web/app/page.js:349`, only if you
   touch those files; and `web/README.md` and `docs/app-skeleton.md`, which list the app's routes
   and name no API route, get one line each for `/api/live` and `/api/my-games`.

## Block B: the tests

In a new `web/test/mygames.test.mjs`, with fixture rows in `GAME_SELECT`'s exact shape (the way
`web/test/cardbroadcast.test.mjs:31-56` builds them). **Every `in_progress` fixture's kickoff is
computed from `Date.now()` when the test runs,** as `web/test/slot.test.mjs:157-158` does: a
literal kickoff turns `stale` eight hours later, and `web/test/cardgeometry.test.mjs:133-141`
records the last time that happened.

- only favourites' games come back, and a game with no favourite side doesn't;
- the order: two days; a game with `kickoff_status: 'tbd'` and a placeholder instant, which leads
  its day and whose `startsAt` is null; and two games at the same instant;
- the overlay's rows: only favourites' games on `today`, and none from a later day;
- a team: the card's name, the `_dark` logo address, both colours as stored; a placeholder team
  has no logo;
- a broadcast: a pick with a mark gives an absolute `markUrl` on the origin passed in, with its
  `?v=`; a pick with no mark gives its name and a null `markUrl`; no active row gives `null`; a
  Cavaliers simulcast gives the composite's address, the one the card wears, and a null `name`;
- the state: scheduled; in progress with a clock from the overlay; in progress with numbers;
  final; postponed; and a live row more than eight hours past kickoff, which reads "Final
  pending", whose `card.kind` is `stale`, and whose two scores are null;
- the venue, and a game with none;
- **the contract:** the exact set of keys at the top level and in a game, a team, `card`, `venue`
  and `broadcast`; and the failed read's answer;
- **wiring, as source text** (the way `web/test/livepoll.test.mjs:201-211` tests the live route):
  the route reads no query string, takes its day from `viewingDayOf(`, calls `gamesForRange(`,
  and sends `no-store`; the card and the address import the mark and the name from the same
  place, and the component holds no second copy. Use `web/test/region.mjs` for slices
  (`web/test/region.test.mjs:84-103` fails a bare `.slice(x.indexOf(`).

**Mutation checks.** Each must go red, and each file is restored byte for byte: drop the
favourites filter; hand the overlay the whole range; make the address take the pick's own mark
and skip the collapse; return a placeholder team's logo address; return a stale row's scores.

**One check against the running app.** `node --test` never compiles a route, and `next build`
can't run here (rule 12), so add one check to `web/scripts/qa-shots.mjs`: request
`/api/my-games` from the dev server it already uses, and assert status 200, no `error` key, a
`today` that is a date, and a `games` array whose every entry has an id, two teams and a viewing
day inside `start` to `end`. One `record()` call, in its own block after the device loop, as the
TBD block at `web/scripts/qa-shots.mjs:1300` is, so the count goes up by one. It asserts no number
of games, since the slate moves. Never request `/manifest.webmanifest`, `/icon.png` or
`/apple-icon.png` there.

## Block C: the record

- **Register: the next free section, expected §71.** First confirm §1–§70 each appear exactly
  once. Record: Joe's ruling of 2026-10-05 that another app of his reads this address; what the
  address answers and what it refuses (no parameter, no programs, no odds, no watchability); that
  it is open and what it shows; that its day changes at 3 AM where the page's changes at
  midnight, and why; the rules moved into `web/lib/` and why; and that the privacy gate covers
  it.
- **`docs/handoff-status.md`:** the gate line, with the floors moved in the same keystroke and the
  reason; and under `## DEPLOYED`, the address.
- **`docs/deployment-contract.md`:** one line where it says what is public: the address, and
  what it shows.
- **`docs/queue.md`, a description of a problem, not an approved plan:** the page still counts
  "today" by the calendar, so from midnight to 3 AM ET a late game in progress sits on yesterday's
  page with no live score. This brief gives the new address the viewing day and leaves the page
  as it is. Whether the page should follow is Joe's.
- **Rule 23.** This changes nothing `docs/design/mobile_demo.html` implements. Name the search
  that says so, as §70 did.
- **File this brief** byte for byte as `docs/prompts/127-my-games-address.md`, copied from
  `Claude outputs\prompt-127-my-games-address-2026-10-05.md`. Update the counts by their own
  convention (`docs/prompts/README.md`, `CLAUDE.md:23` and `:26`, `docs/handoff-status.md:13` and
  `:26`).

## The paths this brief may touch (S5)

- new: `web/app/api/my-games/route.js`, `web/lib/mygames.js`, `web/test/mygames.test.mjs`,
  `docs/prompts/127-my-games-address.md`, and one new file under `web/lib/` if the mark, the team
  name or the broadcast's name needs a home of its own
- `web/lib/cardbroadcast.js`, `web/lib/marks.js`, `web/components/MatchupCard.js`
- for the pins that move: `web/test/cardbroadcast.test.mjs`, `web/test/simulcastmark.test.mjs`
  (the one pin at `:76`), and `web/test/programpanel.test.mjs` only if its pin needs it
- `web/test/restcap.test.mjs` (the `gamesForRange` reason), and `web/lib/queries.js` only for
  `gamesForRange`'s own comment or a move to `restAll`
- `web/scripts/qa-shots.mjs` (the one check)
- `web/README.md`, `docs/app-skeleton.md` (one line each); `web/app/api/live/route.js` and
  `web/app/page.js` only for the stale line references, if you find you must open them
- `CLAUDE.md` (the two count lines), `docs/handoff-status.md`, `docs/enhancement-register.md`,
  `docs/queue.md`, `docs/deployment-contract.md`, `docs/prompts/README.md`

If a gate goes red for a file outside this list (as `web/app/qa/tbd/fixture.js` did in prompt
126), that is S5: stop and report, and don't edit it.

## Out of scope

- Any database write, any DDL, any migration, any change to `data/`.
- `GAME_SELECT`, `cardBroadcast()`'s rule, `cardMarkSlug()`, `simulcastLanes()`,
  `programBroadcast()`, `slotContent()`, `todayET()`, and the page's own "today".
- Anything a card, a panel or the grid draws. No existing `qa-shots` check and no geometry hard
  stop may move.
- A game in the page's own address (`?game=…`), CORS, a site-origin setting, sign-in.
- `/api/live`'s behaviour.

## Gates, commit, push

- Run the script first, then all five gates, each as its own command, against the floors in
  `docs/handoff-status.md` under "Repo state". `test:unit` and `qa-shots` go up. **If a geometry
  hard stop moves, stop and report it. Do not edit a hard stop.**
- **Commit per block (A with B, then C), then push `main`** (rule 7). Report the Vercel
  deployment, and the address as it is in production. Don't request it yourself; Cowork reads it.
- End with: what you chose where this brief left a choice; every file:line of this brief that the
  tree contradicted; the undo block with the real SHAs, newest first; anything one-way; and the
  secret gate on the added lines.
- **For Joe, numbered steps:** open the address in a browser and see a page of text that starts
  with `{"today":`; then open MySports TV and confirm a day's cards still show their network marks
  and team names as before.
