# Prompt 71 — cache-busting, the banner, pregame ordering, and the watch links

Four stages, in this order. Follows `1e217c1`.

Gate floors from `docs/handoff-status.md` (the only home, rule 10):

```
pytest                       # repo root — 514 passed + 1 skipped
npm run test:unit            # web/ — 483
npm run smoke                # web/ — 33/33
node scripts/qa-shots.mjs    # web/ — 91/91
npm run geometry             # web/ — all hard stops
```

Clear stray dev servers and chromium before the first gate run and report what you started from.

---

## STAGE 1 — an asset URL changes when its bytes change

**Third false bug report from one cause.** 2026-09-08, Joe: *"the logo updates we made for rendering
on dark did not deploy to all dark screens."* They had deployed. His installed home-screen PWA was
serving the old image; private Safari showed the correct art. The two before it were the same shape.

**`Cache-Control` did not and cannot fix this.** Prompts 66, 68 and 70 put `public, max-age=300` on
all 1,613 objects, and that is worth having — but a header only tells a client when to RE-CHECK. An
installed PWA holding a copy it cached before the header existed has no reason to act on it.

**The fix is that a changed file gets a different URL.** `teamLogoDarkUrl()` (`web/lib/config.js:156`)
builds a bare, unversioned path, so new bytes keep the old address and every cache in the chain is
entitled to serve what it has. Read `config.js` and enumerate **every** function that builds an asset
path — `teamLogoUrl`, `teamLogoDarkUrl`, `teamLogoCapUrl`, `markUrl` and any others; **`git grep`
`ASSET_BASE_URL` rather than trusting that list** (rule 32: every place that renders the same thing).

You own the mechanism. Two shapes worth weighing, and say which you chose and why:

- **A build-wide version token** — one value baked at build time, appended to every asset URL. One
  line, invalidates everything on every deploy, and re-downloads art that did not change.
- **A per-file content hash** — a manifest of `path → short sha256`, generated where the assets are
  built or synced, so only changed files get new URLs. More moving parts; it is the correct answer if
  the manifest can be produced without a second source of truth that can drift (rule 30).

Constraints either way: the URL must stay stable for unchanged bytes across two builds — **prove that
by building twice and diffing the emitted URLs** — and `scripts/sync_assets.py` must keep working
unchanged, since the bucket keys do not change, only the URLs the app requests.

---

## STAGE 2 — the banner survives an auto-scroll

Joe, 2026-09-08: *"once you change to week view it closes the banner since the screen auto scrolls to
the current day"*, and he asked whether the header can collapse on manual scroll only. It can.

`AutoScroll.land()` calls `collapseHeader()` deliberately and FIRST, and the reason is in its own
comment: `lib/headerstate.js` applies a scroll compensation when its observer fires, and letting that
land mid-flight puts the reader somewhere nobody chose. Collapsing first spends the compensation
before anything measures.

**Replace pre-spending with suppression.** Suppress the collapse for the duration of the programmatic
scroll, then re-arm.

**THE TRAP, and it is the whole stage:** when the scroll finishes the page is already past the
sentinel, so a re-arm that consults scroll position collapses instantly and nothing changes. **The
re-arm has to be gated on a real user-initiated scroll event.** Verify by measurement, not by
reasoning — this brief's account of what the observer does is a platform-behaviour claim from
outside the code, which is exactly the class rule 34 says to distrust.

Prompt 68's arrival rule is unchanged: no scroll at all until the reader has navigated once.

**Outcome to demonstrate:** open the app (banner visible), switch to week view (lands on today,
header NOT collapsed), scroll up — the full banner is there. Then scroll down by hand and the header
collapses as it does today. Screenshot all four states at 390×844 into `assets/`.

---

## STAGE 3 — a pregame show sorts before the game it precedes

Joe, 2026-09-08: *"please have all pregame shows render in their respective sport at the time they
air. In that window - if the pregame show airs the same time as a game starts, the pregame show is
listed first."*

**THIS IS ALREADY A RECORDED OPEN ITEM AND THE COMMENT NAMES IT EXACTLY.** `web/app/page.js:507`:

> *ALL GAMES IS UNTOUCHED, deliberately: it keeps `allRows` exactly as it was. Its bands regroup by
> sport anyway, so sorting here would change what ships without being asked for — and an NFL band
> that lists its pregame show after the game it precedes is a real question, just not this prompt's.
> Recorded as open rather than fixed in passing.*

Prompt 60 was right to leave it. **Joe has now asked for it, so the question is answered and the
comment must be updated in the same commit** rather than left describing an open item that is closed.

The mechanism is in the same block. `allRows` is `[...games, ...programRows]` — a concatenation of
two separately-ordered reads, every game by kickoff followed by every program by `start_at`. MY TEAMS
already gets `chronological(...)`; **ALL GAMES does not**, so a sport band renders its games, then its
studio shows. That is precisely what Joe is seeing.

Two changes:

1. **ALL GAMES sorts chronologically too**, through the same `chronological()` MY TEAMS uses. Do not
   write a second sort.
2. **The tie-break: at an equal start time, a studio show sorts BEFORE a game.** Apply it inside
   `chronological()` so both scopes get it — MY TEAMS is chronological across every sport and would
   otherwise disagree with ALL GAMES about the same two rows.

**Placement needs nothing.** `data/studio_shows.json`'s registry already states the intent — *"A
studio show never gets a chip; it renders under the sport it covers"* — and `page.js:292` records
that a studio show carries the sport it bookends. **Verify that holds rather than assuming it
(rule 22); if a show is landing in the wrong band, that is a second defect — report it, do not
fold it in silently.**

**GRID VIEW: establish, do not assume.** The grid positions blocks by time, so if programs already
reach it they may need nothing at all. Find out whether `programRows` reach `MobileGrid`, say what
you found, and change the grid only if it is actually mis-ordering. If a studio show renders in the
grid as a block with no two teams, describe what it looks like today before touching it.

---

## STAGE 4 — the watch links carry the mark, and the card stops repeating itself

Joe, 2026-09-08: *"currently the sub card shows 'where to watch' and the network logo, THEN a second
line with 'Watch on' links. We don't want the same image and message to appear back to back."*

He is right, and `web/components/GameDetail.js:200-243` is where it happens: an `<h4>Where to
watch</h4>`, a `<ul>` of every broadcast row (`markStyle(b.service_id, 30)`, the network name, an
access badge), then a `.dlinks` block repeating the AVAILABLE ones as `Watch on {name}` text, then an
**unconditional** `DIRECTV_STREAM` link, then a conditional box-score link.

### JOE'S ACCESS RULE, and it is simpler than the card currently assumes

> *"Any network I've named that I have access to, I have access via DIRECTV. Only streamers like
> Netflix, Peacock and Prime Video are not available on DIRECTV. Some events simulcast on streaming —
> NBC broadcasts on Peacock, CBS on Paramount+, ABC on the ESPN app and Disney+, certain TNT/TBS
> events on HBO Max (and there may be others) — these shouldn't disappear the DIRECTV 'watch live
> on', they should supplement it."*

> *"If a game is airing on a network/streamer I cannot access as well as ones I CAN access, the
> 'Where to watch' can still disappear. If a game is on the Orioles TV network and Guardians TV, I
> don't need to know it's on the Orioles TV network."*

**So the section is all-or-nothing, not per row.**

| the game has… | the card shows |
|---|---|
| at least one accessible broadcast | **the enlarged link(s) only.** The `<h4>` and the whole `<ul>` go — including rows he cannot access. |
| no accessible broadcast at all | **the "Where to watch" list only, no links.** |

That second clause is a correction to an earlier reading of mine that kept inaccessible rows visible
alongside the links. Joe's Orioles/Guardians example rules it out: once he knows he can watch it, the
other broadcaster is noise.

### The link forms — Joe's ruling, amended 2026-09-08

> *"Let's show both the network logo and the DIRECTV logo. If the network has its own streaming path,
> that will be the link for the network. If it doesn't then both links go to DIRECTV's path."*

1. **Text is `Watch Live on` + a mark.** The code says `Watch on` (`:234`); Joe wrote *"Watch Live
   on"* twice. Use his words, and do not let the mismatch send you at the wrong element.

2. **Every accessible broadcast gets a link wearing its own mark, pointing at `watchUrl(service_id)`.**
   **`watchUrl()` ALREADY IMPLEMENTS JOE'S FALLBACK IN ONE LINE** (`web/lib/config.js:231-233`):
   `WATCH[id] || DIRECTV_STREAM`. A service with its own entry gets its own path; one without lands on
   DIRECTV. **Read it and confirm before writing anything new** (rule 22) — this stage may need no
   change to that function at all.

3. **PLUS one DIRECTV-marked link, once per card, whenever at least one accessible broadcast is
   linear.** Not one per broadcast — a simulcast would otherwise stack three DIRECTV links. **Cowork's
   call, and Joe can reverse it with a sentence.** It is omitted entirely when every accessible
   broadcast is a streamer, since DIRECTV does not carry those.

   **The unconditional `DIRECTV_STREAM` link at `:236` is what this replaces.** Today it renders on
   every game whether or not DIRECTV carries it, which Cowork's session established is simply wrong —
   the route cannot tune a channel and only opens the app. It becomes conditional here.

4. **A SIMULCAST → the linear network takes the enlarged slot, streamers sit small beneath it.** They
   supplement, they never replace.

5. **Several accessible services → one enlarged, the rest small beneath**, sized so the enlarged link
   occupies the space the two lines used.

6. **No channel numbers.** The DIRECTV channel map stays parked.

**ONE CONSEQUENCE TO REPORT RATHER THAN DESIGN AROUND.** When a network has no streaming path of its
own, rule 2 and rule 3 produce **two links to the same destination**, differing only by mark. That is
what Joe asked for and it is defensible — the network mark says whose broadcast it is, the DIRECTV
mark says how he gets there. **Build it as ruled.** But screenshot that exact case and show it to
him, because it is the one that looks like a bug and is not. If he wants it tightened, the change is
to render the network mark as a label rather than a link in that case — do not make that call here.

### THE DATA ALREADY ANSWERS THE TWO QUESTIONS I WAS GOING TO ASK — verify, then use it

`web/lib/queries.js:40` selects:

```
game_broadcasts(service_id, delivery_surface, feed_side, is_primary, access_status,
                carriage_certainty, active, label,
                network:networks_services(id, canonical_name, type, default_sort_order))
```

- **`is_primary` decides which service is enlarged**, and `default_sort_order` orders the rest. **Do
  not invent a primary-service rule** — confirm these two behave as their names claim, and say what
  you found. If `is_primary` is unset or multiple on real rows, report that rather than working
  around it.
- **`networks_services.type` and `delivery_surface` are the candidates for linear-vs-streamer.**
  **Read their distinct values from PostgREST before writing the rule** — rule 14 makes anon-key reads
  the normal path, and rule 19 requires `restAll()` rather than an unbounded select. Use whichever
  field actually discriminates.

**Do not hardcode a list of streamer names.** Joe's rule is a category, and a name list drifts the
first time a service is added. If neither field discriminates cleanly, say so and propose the
smallest data change that would — an explicit field, not a list buried in a component.

**Note what `access_profile.json` can and cannot tell you.** It is label-based by its own admission
(*"until networks_services/carriage_status exist"*) and its `available` array mixes linear and
streaming freely — ABC, ESPN and TNT sit beside Peacock, Netflix and Prime Video. **So it answers
"can Joe watch this" and NOT "is this linear", which is exactly the distinction rule 2 turns on.**

### Coverage, and the dark ground

`hasMark(b.service_id)` already guards, so the text fallback is native. Diff the `WATCH` keys
(`config.js:194-230`) against what `hasMark` resolves and **report which services fall back to text**,
so Joe knows what he will actually see.

**These marks sit on charcoal**, and an enlarged mark is not the 30px one scaled. Check whether
network art has a dark variant at all, and if the enlarged mark reads worse on charcoal, **say so
with a measurement** rather than shipping it.

### Screenshots, 390×844, into `assets/`

A single-linear game (network mark + DIRECTV mark, both to DIRECTV if that network has no path of
its own — the case worth Joe's eye); a simulcast (linear enlarged, streamer beneath, one DIRECTV
link); a streamer-only game he can watch (no DIRECTV link at all); a game mixing accessible and
inaccessible broadcasters — Joe's Orioles/Guardians case, proving the list disappears; and a game he
cannot watch at all, proving the list is all that remains.

## GATES AND COMMITTING

Five gates, each its own command, all reported, before any commit. Never read a gate's result from
the exit code of a chained command (rule 26).

Stages 3 and 4 change ordering and card content, not block geometry — **the tripwire must not move**:
CFB `2026-09-05` 64 / {240, 223, 205, 136} / 1273, MLB `2026-09-03` 3 / {228} / 567.
`handoff-status.md` is the home for those figures; do not copy them anywhere else.

**Rule 23:** stages 2 and 4 change things `docs/design/mobile_demo.html` may implement. Establish
whether it does, change it in the same commit if so, and **say explicitly either way**.

Four commits, one per stage, staged by explicit path (rule 4, never `git add -A`; `assets/` stays
untracked). Secret-gate each on ADDED lines only, with `grep`, never `findstr` (rule 3). Gate and
commit are separate commands.

**Do not commit or push without Joe's explicit approval.** Report the gates, the screenshots, the
fallback list and the two stage-4 findings, and wait.

Write the gate floors into `docs/handoff-status.md` after the last gate run, not during it.
