# Prompt 76 — the dead Guardians link, a checker for the other 34, and whether MLB can go game-specific

Follows prompt 75. Three stages; stage 3 changes nothing and is a report.

Gate floors from `docs/handoff-status.md` (prompt 75 will have moved `test:unit` — read the file,
do not carry a number from this brief).

---

## STAGE 1 — `guardians-tv` 404s

Joe, 2026-09-09: *"GuardiansTV link needs to be repaired - currently 404's."*

**Verified from outside:** `https://www.mlb.com/guardians/watch` (`web/lib/config.js:296`) returns a
hard 404.

**Replace it with `https://www.mlb.com/guardians/schedule/watch`** — fetched and confirmed live. It
is MLB's official "Where to Watch" page for the club: CLEGUARDIANS.TV through the MLB App or a
pay-TV provider, a provider/channel table, radio affiliates, and the season schedule. **It names
DIRECTV channel 662 explicitly**, which independently corroborates the channel map Cowork built on
2026-09-08.

Two candidates were rejected and the reasons are worth keeping so they are not re-proposed:

- `https://www.mlb.com/live-stream-games/subscribe/cleguardians` — live, but a **sales page**. Joe
  already subscribes; sending him to a checkout is a worse failure than a 404 because it looks
  deliberate.
- `cleguardians.tv` — **certificate hostname mismatch**, so it cannot be linked.

**Do not delete the entry.** `watchUrl()` is `WATCH[id] || DIRECTV_STREAM`, so removing it would fall
through to DIRECTV — which is how Joe watches this channel and was Cowork's first recommendation. It
is the wrong call now that the MLB page is known to be useful: that page itself tells him channel 662,
so keeping the entry gives him both routes and deleting it gives him one.

### AND CONFIRM A GUARDIANS GAME RENDERS **TWO** LINKS, NOT ONE

**Joe's ruling, 2026-09-09:** *"I want to keep that link alive in addition to DirecTV - two separate
links - because the MLBTV feed offers more features."* The MLB route is not a fallback for him; it is
a better feed he chooses deliberately.

Prompt 71's design already produces two links for an accessible LINEAR broadcast — the service's own
mark pointing at `watchUrl()`, plus one DIRECTV-marked link. **But that second link appears only if
the row is classified linear**, and Guardians TV is the awkward case: it is simultaneously a channel
on DIRECTV 662 and a direct-to-consumer product inside the MLB app. If `delivery_surface` files it as
streaming, no DIRECTV link is rendered and Joe gets one link where he asked for two.

**Open a real Guardians game in the detail card and count the links.** Report what
`delivery_surface` and `networks_services.type` actually say for `guardians-tv`, and what renders.

If only one link appears, **stop and report before changing anything** — the fix could be the row's
classification, the linear test, or a deliberate exception for services that are genuinely both, and
which of those is right is Joe's call rather than a detail to settle inside this stage.

---

## STAGE 2 — a checker for the other 34, nightly, that REPORTS

`WATCH` (`config.js:264-298`) holds 35 hand-maintained URLs with nothing checking them. One has
already rotted, and it surfaced because Joe tapped it.

Build a checker that requests every `WATCH` value and reports anything that is not a success, and
**wire it into `schedule_refresh.yml`.**

**IT MUST NOT FAIL THE WORKFLOW.** Joe's ruling. Thirty-five external hosts will produce transient
failures that have nothing to do with this repo, and a nightly job that goes red for someone else's
outage gets ignored — which is exactly how the dead link survived. It reports; the workflow stays
green. Say how you surfaced the report so it is actually seen.

**Design notes, not instructions:**

- Some hosts refuse `HEAD` or bot user-agents. `livescores.js` already learned this — a Chrome UA
  took a 403 from Akamai on 2026-09-03 and the fix was an honest project UA. **Reuse that lesson**
  rather than rediscovering it, and treat a 403 as "could not check" rather than "dead".
- Redirects are normal here; a 301 to a live page is not rot. Follow them and report the final status
  and the final URL, so a silent redirect to a marketing page is visible.
- `tests/test_workflows.py` guards the workflow file (rule 28) — a Python-side parse is not evidence
  GitHub Actions agrees.

### The limit this checker has, and it must be written down

**A status check proves a URL is alive, not that it is correct.** `'wuab-43': 'https://www.fox8.com/'`
returns a clean 200 and points at a different station from channel 43. No checker will ever flag
that.

So **also produce a one-off table for Joe** — every one of the 35 entries with its service id, its
URL, the final URL after redirects, the status, and **what the page actually is** (the service's live
area, a marketing page, a sales page, the wrong property). Change nothing from it; it is for his eye.
Record the limitation beside the checker so the next reader does not mistake green for right.

---

## STAGE 3 — can MLB links be game-specific? Report only, change nothing

Joe is weighing advice that MySports should build a game-specific MLB destination rather than a
landing page. **Cowork checked the load-bearing assumption and it holds — better than the advice
knew.**

`web/lib/livescores.js:214` describes the overlay as *"a Map keyed by games.id"*, and `:234` matches
`r.gameId` — built at `:139` as `` `mlb-${g.gamePk}` `` — against that set by exact string. **For MLB
live scores to work at all, `games.id` must already BE `mlb-<gamePk>`.** So this app holds every MLB
gamePk today; extracting it is a string split, not an integration.

**Verify that inference before anything is built on it** (rule 22 — read the writer, not the
inference): confirm where `games.id` is minted for MLB in `adapters/mlb.py`, and confirm live scores
actually match on real rows rather than appearing to.

Then establish, and report:

1. **The MLB game URL shape.** Take a real gamePk from the database and determine what public MLB URL
   addresses that game — `/gameday/<pk>`, a slugged variant, or something else. **Fetch it. A shape
   that looks right and 404s is what this whole prompt is about.**
2. **Whether MLB's `apple-app-site-association` claims that path.** Cowork's prompt-59 harvest
   recorded *"MLB: paywall pages only — no"*, and a re-fetch just now returned binary this session
   could not parse. **That is standing evidence, not a settled answer.** Re-harvest it and say what
   it claims now. If the game path is not claimed, the "MLB app accepts the universal link" tier does
   not exist and a fallback chain built on it degrades silently.
3. **Whether this generalises.** CLEGUARDIANS.TV is one of several club DTC products inside MLB's
   ecosystem. Say whether one rule would serve every MLB game or only the local club's.

**Change nothing in this stage.** Report the URL shape, the AASA result and the recommendation, and
let Joe rule. If the AASA claims nothing useful, say plainly that the honest ceiling is the MLB game
page in a browser — the same ceiling ESPN has — rather than dressing a landing page as a deep link.

---

## GATES AND COMMITTING

Five gates, each its own command, all reported (rule 26). Tripwire unmoved: CFB `2026-09-05`
64 / {240, 223, 205, 136} / 1273, MLB `2026-09-03` 3 / {228} / 567, NFL 17 / {264, 98, 73} / 1044.

Rule 23: none of this is implemented by `docs/design/mobile_demo.html` — confirm and say so.

Two commits (stages 1 and 2; stage 3 is a report), staged by explicit path (rule 4, never
`git add -A`). Secret-gate on ADDED lines only, with `grep` (rule 3) — **stage 2 touches a workflow
file, so read those added lines carefully.**

**Do not commit or push without Joe's explicit approval.** Report the gates, the 35-entry table and
the stage-3 findings, and wait.
