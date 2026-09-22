# Prompt 108 — IS THE WEEK VIEW'S STANDINGS RESPONSE BEING TRUNCATED?

**Read-only diagnostic. No fix, no gate edit, no commit, no push, no gates run.** This decides
whether the red `geometry` check is a stale gate input or a live production bug, and the two answers
have opposite actions.

*(Numbering: 107 is the iPad tablet-grid measurement, already filed and NOT yet run — see the end of
this brief for why it waits. Preemption is now 109.)*

## The question

`npm run geometry` fails 3 of 45 on the ALL SPORTS case, because the day view and the week view
render different record strings for the same games. The Claude Code report diagnosed it as *"the week
view is frozen at that week's standings"* and proposed moving the pinned case to a current week.

**Cowork could not find that freeze anywhere in the code, and reports a competing hypothesis that
fits better.** Verified in the tree at `322b38f`:

- `web/app/page.js:308` (week) and `web/app/page.js:514` (day) both call `standingsForGames(games)`.
  Same function, same arguments shape.
- `web/lib/queries.js:256-265` — `standingsForGames` collects team ids and seasons and calls
  `standingsFor(ids, seasons)`. Nothing else.
- `web/lib/queries.js:210-218` — `standingsFor` issues one PostgREST request with **no `as_of`
  filter, no date bound, no explicit limit**, ordered **`as_of.asc`** (oldest first).
- `web/lib/standings.js:142-150` — `indexStandings` keeps the newest `as_of` per
  `(team_id, season)`, for both views identically.

**Given the same rows, the two views cannot diverge.** So the row sets differ. The only input that
differs is the team-id list: a day passes one slate, a week passes every sport for seven days.

**The hypothesis: the week request exceeds a PostgREST row cap and is truncated.** Because the order
is `as_of.asc`, a truncated response loses the NEWEST rows, and `indexStandings` then picks the
newest of what survived — which is stale. That predicts the week is always older than the day, never
newer. Both examples in the report are exactly that, and it explains the timing: three more weeks of
drift is three more weeks of `as_of` rows per team, which is what pushes a request over a cap.

**It also re-reads the report's own evidence.** `web/scripts/geometry.mjs:151` pins the MLB case to
`['2026-09-03', 'mlb', '2026-08-31']` and `:153` pins ALL SPORTS to `['2026-09-03', null,
'2026-08-31']` — **the same day and the same week**. The report cited "single-sport checks pass" as
corroboration without noting that one of them is the identical scenario, merely filtered. Under
truncation that fits: an MLB-only week is a small team set that stays under the cap. Under the
"frozen week" reading it is hard to reconcile, because the report's own diverging example —
Brewers @ Cubs — is an MLB game the MLB-only case measures and finds equal.

**Cowork has NOT measured truncation. That is this run's job. Do not assume it is right.**

## Credentials

Read the Supabase URL, anon key and schema from the app's own environment —
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_SCHEMA`
(`web/lib/config.js:11-18`). **Never print the key**, in the report or in any file. PostgREST reads
with the publishable anon key are the app's normal read path and are explicitly allowed; nothing here
needs any other credential.

## Block A — the two team sets

1. From `games`, get the teams and seasons for the **day** `2026-09-03` (the viewing day, as the app
   defines it), and for the **week** `2026-08-31` through `2026-09-06`.
2. Report the count of unique `team_id` values and the season list for each. The ratio between them
   is the whole mechanism if the hypothesis holds.

## Block B — replicate `standingsFor` exactly

3. Build the **same** request `standingsFor` builds — same `select`, same `team_id=in.(…)`, same
   `season=in.(…)`, same `order=as_of.asc`, **same absence of a limit** — once for the day set and
   once for the week set. Do not "improve" it; the point is to reproduce what the app sends.
4. For each response report: the HTTP status, the **`Content-Range` header verbatim**, and the number
   of rows returned.
5. Repeat each request with `Prefer: count=exact` and report the total the header gives. **The
   comparison between rows returned and rows available is the finding.**

## Block C — the decisive comparison

6. For a handful of named teams — at minimum the Brewers, the Cubs, Colorado and Georgia Tech, the
   four the failing report cited — print the **maximum `as_of` present in the day response** beside
   the **maximum `as_of` present in the week response**.
7. State plainly: do the two responses contain the same newest row for the same team, or not?

**If they do not, the week view has been rendering stale records in production**, silently, for
every week view — not only in the gate.

**If they DO contain the same newest row**, the truncation hypothesis is dead, Cowork was wrong, and
the divergence has some other cause. Say so bluntly and report what you found instead of arguing
either story into shape.

## Block D — the cap, and the symptom in the app

8. If the responses are capped, determine the cap: what number the rows land on, and whether it comes
   from a Supabase project setting (`db-max-rows`) rather than anything in this repo. Check whether
   `docs/deployment-contract.md` records it; if it does not, that is a documentation gap to note.
9. Independently, confirm the symptom in the running app: start `npm run dev` from `web/`, load
   `/?day=2026-09-03&view=grid` and `/?mode=week&w=2026-08-31&view=grid`, and read the rendered
   record strings for Brewers @ Cubs from each. Stop the server afterwards and say so.

## Do NOT

- **Do not fix anything.** Not the order, not a `limit`, not pagination, not an `as_of` filter.
- **Do not touch `web/scripts/geometry.mjs`.** Not the pinned case, not a baseline, not a skip.
- **Do not push.** `origin/main` is `192677f` and stays there until Joe rules.
- **Do not correct `CLAUDE.md`'s "immune to drift" claim yet** — it is false and it should be fixed,
  but it belongs in the commit that settles this, not in a read-only run.
- **Do not delete the untracked root `AGENTS.md`.** It is prompt 100's guard and Joe's ruling.

**Name the candidate fixes without implementing them**, so Joe can rule from one place: ordering
`as_of.desc` so a truncated response loses the oldest rather than the newest; paginating; bounding
`as_of` to a window; or requesting fewer rows per team. State the trade-off you see in each.

## Gates — deliberately not run

This run changes no tracked file and adds no assertion. End with `git status --porcelain`,
`git rev-parse --short HEAD` and `git rev-parse --short origin/main`, and confirm the tree is
unchanged at `322b38f`, three ahead of `192677f`, with nothing outstanding but the known-untracked
`assets/` and `AGENTS.md`.

## The report

The two team-set sizes, both `Content-Range` headers verbatim, the rows-returned against
rows-available for each, the per-team newest-`as_of` comparison, the rendered record strings from the
app, a plain verdict on whether the response is truncated, and anything that contradicts Cowork's
reading. Flag disagreements rather than reconciling them.
