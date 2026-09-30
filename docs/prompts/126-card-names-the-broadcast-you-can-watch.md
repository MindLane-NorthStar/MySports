# Prompt 126: The card names the broadcast Joe can watch, not the feed he can't

This builds on `71a819b` (prompt 125). **Stop and report if any of these checks fails:**

- `git rev-parse HEAD` equals `git rev-parse origin/main`, and both are `71a819b`.
- `git status --porcelain` shows only untracked `assets/` entries.
- `python scripts/remove_codex_agents_md.py` exits 0.

Written by Cowork on 2026-09-30 from four sources: Joe's report on his phone, a read of the tree at `71a819b`, read-only SELECTs, and a read of `networks_services`. **Verify every file:line before acting on it.**

---

## What Joe saw

The Blue Jackets opener (BUF @ CBJ, 2026-10-01, 7 PM, `nhl-2026020011`) shows **no network mark on its list card**. The Prime Video mark **does** appear in the game's detail panel.

## What Cowork found

**The data is right.** The game's active broadcast rows:

| service_id | label | surface | primary | access |
|---|---|---|---|---|
| `cbjnhl` | CBJNHL | LINEAR | **true** | unknown |
| `cbjhn` | CBJHN | LINEAR | false | unknown |
| `msg-b` | MSG-B | LINEAR | false | out_of_market |
| `prime-video` | Blue Jackets on Prime Video | STREAMING | false | **available** |

The eligibility verdict is `eligible = true`, `eligible_via_network_id = null`, `eligible_via_service_ids = {prime-video}`, reason "stream only: prime-video".

**The card picks the wrong row.**

- `web/components/MatchupCard.js:132-136` `cardBroadcast()` takes the `is_primary` row first, then a LINEAR row, then the first row. So it names `cbjnhl`.
- `:177` draws a mark only if `showsMark(b)` (`web/lib/marks.js:51`, `hasMark(service_id)`) is true, and `cbjnhl` has none. The card shows an empty mark column, even though the reconciler decided the game is watchable on Prime Video.
- The detail panel lists every row, which is why Prime Video appears there.

**The same function places the game on the mobile grid.** `web/components/MobileGrid.js:148` uses `cardBroadcast(g)` to choose the lane, and `:208` names the rail row from that broadcast. So the opener sits in a rail row for `CBJNHL`, a feed that is on Spectrum cable, not DIRECTV. The lane's label comes from the network's `canonical_name`, which is the raw code "CBJNHL". **Cowork has not looked at the grid; it is inferred from the code.** The "before" screenshot below settles it.

**The query does not fetch what the fix needs.** `web/lib/queries.js:45` embeds `viewer_game_eligibility(eligible,reason,eligible_via_network_id,market_pending)`. It has no `eligible_via_service_ids`.

**It is a class, not one game.** Cowork counted eligible games from 2026-09-30 to 2026-10-31 whose card broadcast, emulated in SQL as primary, then linear, then first, is neither `eligible_via_network_id` nor in `eligible_via_service_ids`. That is 17 games:

| sport | card names | watchable via | games | first |
|---|---|---|---|---|
| nhl | `cbjnhl` | `cbj-local` (the old carrier-TBA row) | 9 | 10-09 |
| nfl | `abc` | `espn` | 3 | 10-12 |
| nhl | `cbjnhl` | `prime-video` | 2 | 10-01 |
| cfb | `acc-extra` | `accnx` | 1 | 10-17 |
| nhl | `carnhl` | `cbj-local` | 1 | 10-29 |
| nba | `nba-tv` | `dazn` | 1 | 10-29 (ATL @ CLE) |

The 9 + 1 Blue Jackets games past the refresh's 7-day window still carry the old `cbj-local` row. They should move to `prime-video` as the window reaches them, as 10-01 and 10-03 already have, and then they fall into this class as well.

## The rule, Cowork's recommendation (Joe may veto it before the run)

**The card keeps its current pick whenever that pick shows a mark.** Only when it does not, and the eligibility verdict names a service that has an active row on the game with a mark, does the card name that row instead. Otherwise nothing changes.

- **Why this shape.** It is keyed to the same `hasMark` test the card already uses (`marks.js:51`), so it cannot change any game whose card shows a mark today. The NFL ABC/ESPN simulcasts keep ABC, provided `abc` has a mark, which Claude Code confirms. The fix touches only cards that currently show nothing, or show a mark for a feed Joe cannot see. It decides by the reconciler's own verdict and derives no second eligibility rule in JavaScript, per the D4/E3 comment at `queries.js:42-44`.
- **Its order.** Take `eligible_via_network_id` first. Then take `eligible_via_service_ids` in array order, keeping only services that have an active row on the game and a mark.
- **It lives in `cardBroadcast()` itself,** so the list card and the mobile grid's lane agree. This is **Cowork's judgment call:** a game shown in a lane for a feed Joe cannot get is the same defect Joe reported on the card.

## Block A: the code

1. **Add `eligible_via_service_ids` to the game eligibility embed** (`queries.js:45`). Leave `:338`, the program eligibility, alone. Confirm the anon role can read the column. If it cannot, stop and report.
2. **Implement the rule in `cardBroadcast()`** (`MatchupCard.js:132-136`).
   - Keep the header comment accurate. The current one says "Primary first, then a linear row, then whatever is left."
   - Do not change `cardMarkSlug()` (`marks.js:82`), the Cavaliers collapse, which runs before it at `MatchupCard.js:175-177`.
   - Do not change `simulcastLanes()` (`marks.js:124`) or `programBroadcast()` (`ProgramCard.js:31`).
3. **Unit tests, with fixture rows in the query's exact shape:**
   - **the CBJ opener's rows** name `prime-video`;
   - **an ABC primary with an ESPN verdict** keeps `abc`, if `abc` has a mark; if it does not, say so and assert what the rule then does;
   - **no eligibility row** keeps the primary;
   - **a verdict naming a service with no row on the game** keeps the primary;
   - **a verdict naming a service with a row but no mark** keeps the primary;
   - **a Cavaliers simulcast game** still collapses exactly as before.

   **Mutation checks:** make the rule ignore the mark test, reverse the order of the two eligibility fields, and delete the new branch. Each must go red. Restore each file byte for byte.
4. **For every game in the 17-game table above, report its card's service before and after, from live data.** Any change other than the CBJ, CFB and NBA rows needs a sentence saying why.

## Block B: look at the picture

Neither Cowork nor the gates can see a missing mark. Take **before and after** screenshots at 390 px and at 1024 px (iPad), using the dev server and Playwright the way `qa-shots` does:

- `/?day=2026-10-01&sport=nhl`, the list view, cropped to the Blue Jackets card;
- the same day's mobile grid, showing the rail row the game sits in.

Save them to `assets/p126-card-broadcast/` (untracked), and name every file's path in the report. Cowork will open them. **If the "after" grid shows the game in a Prime Video row with the Prime Video rail mark, say so; if it shows anything else, say what.**

## Block C: the record

- **`docs/rendering-contract-mobile.md`: a new version note in the file's own style.** Record which broadcast a game card and a grid lane name: the current pick if it shows a mark, else the one the eligibility verdict names, else the current pick. Give Joe's 2026-09-30 report as the reason.
- **Register: the next free section, expected §70.** First confirm §1–§69 each appear exactly once. Record the finding, the 17-game class, the rule and why it is keyed to the mark, and the before/after table.
- **`docs/handoff-status.md`:** the gate line, with floors moved in the same keystroke and the reason.
- **`docs/queue.md`, a description of a problem, not an approved plan:**
  - `cbjnhl` and `cbjhn` carry access `unknown`. The Blue Jackets Hockey Network is carried on Spectrum cable, not DIRECTV (Yahoo Sports, 2026-09-23), so for Joe's profile these are not watchable.
  - The detail panel still lists them as "unknown". Whether to record them as unavailable is a data ruling for Joe.
  - Also note that the archived desktop grid (`rendering-contract.md` §5, rule 4: "primary row (first ROW_ORDER linear outlet …)") follows its own rule, and this brief did not change it.
- **File this brief** byte for byte as `docs/prompts/126-card-names-the-broadcast-you-can-watch.md`, copied from `Claude outputs\prompt-126-card-names-the-broadcast-you-can-watch-2026-09-30.md`. Update the counts by their own convention.

## Out of scope

- Any data change: `local_rights.json`, `access_profile.json`, broadcast rows and access statuses.
- The Python archived-grid renderer, and the desktop grid.
- `programBroadcast()`, the Cavaliers collapse, and `simulcastLanes()`.
- `web/lib/marks.js`'s `hasMark` list and any network logo asset.

## Gates, commit, push

- Run the script first, then all five gates, each as its own command, against the floors in `docs/handoff-status.md` under "Repo state". `geometry`'s hard stops are code-derived and should not move. **If one moves, stop and report it. Do not edit a hard stop.**
- **Commit per block (A, then C; B's screenshots stay untracked), then push `main`** (rule 7). Report the Vercel deployment.
- End with the undo block: the real SHAs, newest first; anything one-way; and the secret gate on the added lines.
