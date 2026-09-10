# Prompt 77 — scores update without re-rendering the page, and the box score goes live

Follows prompt 76. Two stages.

Gate floors: read them from `docs/handoff-status.md` — prompts 75 and 76 will have moved them, and a
number carried in from a brief is how this project has been bitten four times.

---

## STAGE 1 — poll the SCORES, not the page

### What is there today, established by reading

- `REFRESH_SECONDS = 900` (`web/lib/config.js:259`).
- `Listing.js:75-79` polls with `router.refresh()`, **but only when `anyInFlight(games)`** — a game
  in progress, or within 15 minutes before kickoff to 4 hours after (`:18-26`). A quiet page never
  polls. **That gate stays; it is already right.**
- `livescores.js:23` caches the upstream fetch for **60 seconds**.

So the scores on the server are never more than a minute old, and the phone waits fifteen minutes to
ask. **The staleness is entirely the client's.**

### What changes

**`router.refresh()` goes.** It re-renders the whole page on the server — every query, the header,
the banner, the lot — to update three fields. Replace it with a client fetch of the live overlay
alone, patched into the cards that are already on screen.

**Interval: 60 seconds** (Joe's ruling). It matches the existing server cache exactly, so every fetch
returns genuinely new data and none is wasted. **Do not go below it** without shortening the server
cache too, which means more calls out to ESPN, the NHL and MLB — and `livescores.js` records one of
those sources already returning a 403 on 2026-09-03.

**Stop polling when the app is not on screen.** A backgrounded PWA asking every minute is pure waste.

### The hazard that decides whether this is safe

**Prompt 73 pinned the banner and prompt 71 made the page land on today.** The pin arms on mount and
on navigation; the landing fires on a change of path or query. **A score patch must do neither.** If
patching remounts `Listing` or re-runs either effect, the banner re-pins and the page re-scrolls
**every sixty seconds**, which is unusable.

**Verify this by measurement, not by reasoning about React** — that is the exact class of claim this
project has been wrong about repeatedly (rule 34). Run a full poll cycle with a live game and assert
that `scrollY` and the pin state are untouched across it.

### Scope: day AND week — and this reverses prompt 53 stage 4b

Joe's ruling, 2026-09-09, after asking whether week mode would slow the app.

**The recorded reason for switching week mode off is worth re-reading before you follow it.**
`page.js:162` says *"`overlayForDay` is a per-day fetch and a week is up to ten days, so running it
here would be up to ten live calls on one render."* But **only today's games can be live** — every
earlier day is final and every later one has not started — so a week needs exactly ONE overlay, for
today, which is the same one day mode already fetches. The note describes an implementation nobody
has to write.

**Confirm that before relying on it.** `overlayForDay` fetches per SPORT, not per day
(`livescores.js:219`, `Promise.all(sports.map(fetchSport))`), and `sportsWorthFetching` skips
final/postponed/cancelled but **not scheduled** — so a future-dated week would fetch for games that
cannot possibly be live. Say what you find and gate it so a week not containing today fetches
nothing at all.

**The footnote must change with the behaviour.** `page.js:166` currently prints *"no live check — a
week view does not check live scores, so today's are the database's."* A page that says it is not
checking while it is checking is worse than one that never checked. Update it in the same commit, and
record the reversal of prompt 53 stage 4b in the register (rule 10) rather than letting the old
reasoning stand.

**The grid is out of scope.** It displays no score today and adding one is a different feature.

---

## STAGE 2 — the box score link works during the game

Joe: a live box score link on every event that has one, in the subcard.

**It already exists and is gated.** `GameDetail.js:121`:
`game.result_status === 'final' && game.boxscore_url`. The field is already selected
(`queries.js:25`), so this may be a one-line change.

**Joe's ruling:** show it **live and final, not before the game starts** — an empty box score is a
dead tap. Label it **"Live box score"** while in progress and **"Box score"** once final.

**THE PREREQUISITE, and check it before writing anything:** is `boxscore_url` populated for games
that are NOT final? If the loader only fills it at finalization, relaxing the gate produces a link
that renders and does nothing, which is worse than no link. **Query real in-progress and scheduled
rows and report the fill rate per sport.** If it is empty for live games, say so and stop — the fix
is then in the loader or in constructing the URL from an id the app already holds, and that is a
different piece of work Joe should rule on.

**"Every event that has one" is a real filter.** Report which sports and event kinds actually carry
a `boxscore_url` — a studio show plainly has none, and a race or a fight card may not either.

---

## GATES AND COMMITTING

Five gates, each its own command, all reported (rule 26). The tripwire must not move: CFB
`2026-09-05` 64 / {240, 223, 205, 136} / 1273, MLB `2026-09-03` 3 / {228} / 567,
NFL 17 / {264, 98, 73} / 1044.

**Stage 1 changes what the page does over time, so the spacing probes and `qa-shots` are not enough
on their own** — pin the no-scroll, no-re-pin assertion as a test, not just a measurement.

Rule 23: `docs/design/mobile_demo.html` models no behaviour over time and shows no live score.
Confirm and say so.

Two commits, staged by explicit path (rule 4, never `git add -A`; `assets/` stays untracked).
Secret-gate on ADDED lines only, with `grep` (rule 3).

**Do not commit or push without Joe's explicit approval.** Report the gates, the scroll/pin
measurement, the week-overlay finding and the `boxscore_url` fill rate, and wait.
