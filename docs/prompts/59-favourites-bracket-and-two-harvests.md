# Prompt 59 — push 58, the favourites bracket, the program panel, and two harvests

**Run after prompt 58.** `CLAUDE.md` is the standing brief. **Read it from disk before citing a rule
number** — prompt 58 wrote rule 34, so rules stop at 34 and register at §26.

**This run is meant to go start to finish without Joe.** He is away. Two pushes are authorised in
advance, named at the stages where they happen. Do not stop to ask for either.

## PRECONDITIONS

1. `HEAD == origin/main == c6a423b` — 0 ahead, 0 behind. **Joe pushed prompt 58 himself on
   2026-09-07**, so stage 1 verifies rather than pushes.
2. Tree clean except the six untracked `assets/` directories.
3. Python certified for Windows (rule 1).
4. Baseline recorded: pytest 494 + 1 skipped · unit 419 · smoke 30/30 · qa-shots 22/22 · geometry
   all hard stops (12.8898 / 6.6629 / 8.5069).

**If any is not true, stop and say which.**

## THE UNATTENDED CONTRACT

Stages self-commit. **Hard stops are only:** a secret-gate hit, a destructive database operation, or
a rejected push. Everything else is two-strikes-skip.

**No database writes.** Stage 4 is a `SELECT`-shaped PostgREST anon read and nothing more.

**JOE'S PUSH AUTHORISATION, given 2026-09-07 for this run only:** push once, at the end of stage 6.
It is expected and is not a hard stop. (The stage-1 push in the previous draft is gone — Joe did it
himself while this brief was being written.)

---

## STAGE 1 — confirm prompt 58 is live

**Joe pushed it himself.** `HEAD == origin/main == c6a423b`, 0 ahead and 0 behind, verified from the
tree at the time of writing. Nothing to push here.

**Confirm the Vercel deploy for `c6a423b` reached READY before starting stage 2.** Two of the stages
below change surfaces Joe will look at on his phone, and a queued or failed deploy makes it
impossible to tell which commit produced what he sees. If the deploy is not READY, wait for it; if it
failed, that is a finding — report it and stop, because everything after this ships on top of it.

**Prompt 58's device check is still outstanding** — whether 44px at the top edge feels right under a
thumb while scrolling. It is not a blocker for this run: stage 2 touches `SportBand`, stage 3 touches
`GameDetail`, and neither builds on the collapsed header. Note it in the report so it does not get
lost behind this run's own device items.

**No commit of your own here.**

---

## STAGE 2 — the favourites bracket

### The problem, in Joe's words, 2026-09-07

> "On the ALL GAMES views, 'Your Teams' still appears… Because the 'Your Teams' section isn't
> noticeably separated from the rest of the content below, it leaves the user confused."

He offered two fixes — an accent that marks his teams, or dropping the label entirely and letting
position do the work. **Take neither as written.** There is a third that costs less and reuses
something already in the app.

### Why the current arrangement fails

Two defects, both measurable in `globals.css`:

- **`.favlabel` (`:1989`) is styled as a band title, not a marker.** 25.5px display, 700, uppercase,
  `.09em`, with its own bottom hairline. `.band-title` (`:2094`) is 25.5px display, 700, uppercase,
  `.09em`. They are the same object. So a band renders `COLLEGE FOOTBALL` then `YOUR TEAMS` at equal
  weight, and the second heading's scope is ambiguous — a reader cannot tell whether it governs
  everything below or stops somewhere.
- **`.favrule` (`:1993`) is invisible.** 1px of `--line-soft` (`#2b2f35`) on a card-gradient ground,
  with 8px margins. It is the element that is supposed to say *your teams end here*, and on a phone
  it is not perceptible. **That is the actual cause of Joe's complaint** — the group has no visible
  bottom edge, so it bleeds into the rest of the band.

### The fix — one gesture the app already owns

`.scopeline` (`:2003-2013`) marks the MY TEAMS scope with `border-left: 2px solid var(--gold)` and
`padding-left: 9px`. **Gold left rule already means "this is about your teams" in this app.** Reuse
it rather than inventing a second vocabulary.

1. **Wrap the favourites group** in `SportBand.js` in a single element — the favourite cards only,
   not the rest — carrying `border-left: 2px solid var(--gold)` and a left padding.
2. **Retire `<p className="favlabel">Your teams</p>` and the `<hr className="favrule" />`.** The
   bracket says what the heading said, without competing with the band title and without a divider
   nobody can see.
3. **Delete `.favlabel` and `.favrule` from `globals.css`** once nothing renders them. `git grep`
   both first — `FirstBand.js` passes `headingClass="favlabel"` to `Listing`, so check what that
   still does before assuming the class is orphaned. If it is live on another path, leave the rule
   and say so.

**This retires the "Your teams" / "My teams" naming inconsistency as a side effect**, which has been
an open item since the start of this session. Say so in the register rather than letting it look
accidental.

### The cost, which must be measured rather than assumed

A left border plus padding **insets the favourite cards** by that much — roughly 10px on a 350px
card. Those cards are then narrower than the rest of the band, and `.mcard`'s body track is
`minmax(0, 1fr)`, so `fitNameAndRecord` may drop a record on a favourite that keeps it elsewhere.

**Measure it.** At 390, with a band containing both a favourite and a non-favourite, report the body
width of each and whether any name tier or record visibility changed. **If a record disappears,
reduce the padding to 4px and re-measure** — the rule is the signal, the padding is only comfort.

### Scope

`floatFavorites` is true only under ALL GAMES (`page.js:389`, `:581`, `:597`), so this changes four
of the eight views and nothing under MY TEAMS. Confirm that by reading the props, not by assuming.

**Acceptance:** screenshots at 390 of a band with favourites, before and after; the body-width
measurement for both card kinds; the `git grep` result for `.favlabel` and `.favrule`; confirmation
that MY TEAMS views are untouched.

**Commit:** `hub: a gold bracket where the favourites heading was`

---

## STAGE 3 — the detail panel does not know what a program is

### Joe's report, 2026-09-07

> "Any program/event that isn't a matchup between two teams. A pregame show, NASCAR race, UFC event,
> wrestling show… when you click on the event and the sub-card popup renders, the title bar says
> TBD @ TBD. That needs to be replaced with the logo and text for the program."

Confirmed by reading `GameDetail.js`. **There are three defects, not one.** Programs reach this panel
through `ProgramCard`'s `onOpen` — `PageCount.js` wires `setDetail` to both card types and then
renders one `<GameDetail>` for whatever was tapped — and the panel was written for matchups only.

**1. The head. `GameDetail.js:50-56`.**

```
<img src={teamLogoDarkUrl(away?.id)} alt="" />
<strong>{cardName(away, game.away_team_id)} @ {cardName(home, game.home_team_id)}</strong>
<img src={teamLogoDarkUrl(home?.id)} alt="" />
```

A program has no `home`, no `away`, and no team ids, so `cardName` falls through to its
`|| 'TBD'` and prints **`TBD @ TBD`** — flanked by two `<img>` elements whose `src` was built from
`undefined`.

**2. The probable-pitcher section is not guarded against programs.** It is gated on `sport === 'mlb'`
alone. An MLB pregame or postgame show carries `sport: 'mlb'`, so it renders a Probable pitchers
block reading **TBD / Starter TBA, twice.** Verify this against a real MLB studio row before fixing
it — if programs carry a null sport, this one is theoretical and should be reported as such rather
than silently "fixed".

**3. The venue row reads the wrong field.** The panel prints `game.venue?.name`; a program's place is
`program.location_text`, which `ProgramCard` uses at its own bottom line. So the row is simply absent
on every program.

### The fix — reuse the card's parts, fork nothing

`lib/programs.js` already exports everything needed: `isProgram(row)` (`:250`), `brandFor(key)`
(`:130`) returning `{ mark_dark, color, short_title, title }`, `titleFor`, `subtitleFor` and
`crewNames`. `ProgramCard.js:66-89` shows the assembled head — the `.pcap` endcap over
`ENDCAP_GRADIENT` with `brand.mark_dark` inset and a `.pcap-bar` in the brand colour, beside
`.ptitle` and a `.psub` tinted by `tintToWhite(brand.color)`.

**Branch `GameDetail`'s head on `isProgram(game)`** and render the endcap, the title and the subtitle
in place of the two logos and the `@`. Import the helpers; **do not copy their logic** — rule 32's
shape is that one concept lives in one place, and a second title-builder would drift from the card's
within a prompt or two.

**The typographic fallback must survive.** `ProgramCard` renders `brand.short_title` as a
type mark when a brand has no art in the tree, deliberately, so an unknown brand never blanks a card
and never gets a fabricated logo. The panel must do the same, not render an empty box.

**Guard the probable-pitcher block on `!isProgram(game)`** as well as the sport, and **use
`location_text` for a program's venue row**, keeping the neutral-site parenthetical for games only.

### What must not change

The close button, the Escape handler, `Where to watch`, the odds block and the `.dstamp` provenance
line all work for programs already and are out of scope. **Leave the game path byte-identical** — this
stage adds a branch, it does not restructure the panel.

**Acceptance:** screenshots of the panel at 390 for four program kinds — a studio show, a NASCAR
race, a UFC card and a wrestling show — and one matchup panel proving the game path is unchanged.
The MLB-studio finding, stated either way. A `git grep` proving no title-building logic was
duplicated.

**Commit:** `detail: the panel knows a program from a matchup`

---

## STAGE 4 — how much of the odds pile is real

**Read-only.** This answers the question blocking Joe's decision on migration
`0017_game_odds_one_row_per_book.sql`, which is still unapplied.

Prompt 57 measured 471 rows, 379 distinct games, **392 distinct `(game_id, provider)` pairs, 32
carrying 79 surplus rows.** The open question is whether those 79 are **line movement** — `-3` moving
to `-3.5`, which is real information worth keeping — or **identical re-fetches**, which are noise.

Read `game_odds` through PostgREST with the anon key (rule 14 permits exactly this). **Rule 19: use
the paginating `restAll()`, never an unbounded select** — the table is at 471 against a silent
1,000-row cap.

For each `(game_id, provider)` pair holding more than one row, compare `spread`, `total`,
`home_moneyline` and `away_moneyline` across its rows and classify:

- **identical** — every value the same, differing only by `fetched_at`. Pure noise.
- **moved** — at least one value differs. Real history.

**Report:** the count of each, the surplus rows attributable to each, and two or three worked
examples of a genuine move.

**Also check the dated hazard:** `git grep` for any read of `game_odds` that is not the bounded embed
from prompt 57 stage 1. The table crosses the 1,000-row cap within weeks, and an unbounded reader
would truncate silently.

**Change no code and apply no migration.** This stage produces a finding.

**Commit:** `docs: what the game_odds surplus actually contains`

---

## STAGE 5 — harvest the Universal Link claims

**Read-only, and the answer is not in this repo** — this is groundwork for a later feature.

Joe wants the Watch links to open a live broadcast in the streaming app rather than a landing page.
On iOS that means **Universal Links**: an `https://` URL that the OS routes into an installed app
because the publisher hosts an `apple-app-site-association` file declaring which paths it claims.
**The publisher decides, and the file is public.** Reading it is how we learn what is possible
without guessing.

**Cowork cannot do this** — both its shells are behind egress allowlists that block these domains.
Your machine has ordinary internet, which is why it is here.

### Build the domain list from the repo, not from a list someone typed

1. Read `WATCH` in `web/lib/config.js` — roughly 30 service-to-URL entries.
2. Read `data/access_profile.json` and take the `available` array.
3. **Join them carefully. Rule 31 is exactly this hazard**: `access_profile.json` is *label*-keyed
   ("Big Ten Network", "ESPN Unlimited") and `WATCH` is *slug*-keyed ("big-ten-network"). A naive
   match finds nothing and reports a false absence. **Name the search you ran**, and report any
   service present in one and not the other rather than silently dropping it.

### The fetch

For each domain, try both locations — `https://<host>/.well-known/apple-app-site-association` and
`https://<host>/apple-app-site-association` — following redirects. Record the HTTP status either
way; **a 404 is a finding, not a failure.** Two attempts per location, then move on (two-strikes).

Write each successful body to `artifacts/aasa/<host>.json` verbatim. Rule 29 governs the writes.

**Report per service:** the host tried, the status, and — where a file came back — the app IDs under
`applinks.details` and the **path patterns each claims, quoted verbatim.** Call out any pattern
touching `/watch`, `/live`, `/video`, `/event` or `/game`.

**Do not evaluate, rank or recommend.** This stage collects evidence. Cowork will cross-reference it
against the event ids MySports actually holds, and Joe will tap-test the survivors on his phone.

**One thing worth noticing while you are there:** ten of Joe's available services are ESPN-operated —
ESPN, ESPN2, ESPNU, ESPN+, ESPN Unlimited, ACC Network, ACCNX, SEC Network, SEC Network+, ESPN3 —
plus ABC's sports simulcast. It is also the one family whose event ids the database already carries.
If the ESPN AASA claims a watch path, say so prominently.

**Commit:** `docs: harvest the apple-app-site-association files for every held service`

---

## STAGE 6 — the record, and the push

**Register §27** (last is §26 — verify): stage 2's bracket, with **why** it replaced both a heading
and a rule — the heading duplicated `.band-title`'s weight and the rule was imperceptible — and the
note that this retires the "Your teams" / "My teams" inconsistency deliberately rather than by
accident. Stage 3's program branch, with the two defects Joe did not report — the unguarded
probable-pitcher block and the wrong venue field — named so they are not rediscovered. Stage 4's
finding as a decision input, explicitly **not** a decision. Stage 5 as groundwork, with the AASA harvest location named.

**`docs/handoff-status.md`:** the stage/commit table, the five gate counts, and the open items —
migration 0017 still unapplied and now with evidence attached, and the streaming feature at the
evidence-gathered stage.

**`docs/design/mobile_demo.html`** — rule 23. Stage 2 changes how a favourites group renders. **Read
the file and decide** whether the locked reference implements that; say which and why.

**No new working rule is expected.** Rules stop at 34. If this run earns one, say what and why; if it
does not, say that too rather than reaching.

**File this prompt** at `docs/prompts/59-favourites-bracket-and-two-harvests.md`, verbatim.

**Commit:** `docs: register §27 and the run of record`

**Then push** — Joe authorised it for this run. Confirm `HEAD == origin/main` and that the deploy
reached READY.

---

## THE REPORT

1. **Stage 2:** before/after screenshots at 390, the body-width measurement for a favourite and a
   non-favourite card, and whether any record or name tier changed.
2. **Stage 3:** the four program panels and the one matchup panel, plus the MLB-studio finding.
3. **Stage 4:** identical versus moved counts, surplus attributable to each, worked examples, and the
   unbounded-reader check.
4. **Stage 5:** the per-service table — host, status, claimed paths — and the ESPN answer called out.
5. Stage by stage: sha, all five gate counts, anything skipped under two-strikes.
6. **Every citation in this brief that turned out to be wrong.** Prompt 58's brief carried a width
   model that was wrong in both directions and a contrast comparison that flattered its own proposal.
   Assume this one has some too.
7. **HEAD, whether `HEAD == origin/main`, and the deploy state.**

Then stop. Do not open a browser and do not write to the database.

---

## FOR JOE, WHEN HE IS BACK

Two things need the phone, in this order:

1. **Prompt 58's collapsed header** — pushed at stage 1. Whether 44px at the top edge feels right
   under a thumb while scrolling is the one thing a desktop cannot judge.
2. **Stage 2's gold bracket** — whether the favourites group now reads as separate without the
   heading, and whether the inset looks deliberate or looks like a mistake.
3. **Stage 3's program panels** — tap a NASCAR race, a UFC card and a studio show and check the head
   reads as that programme rather than as a fixture.

Two things need a decision:

4. **Migration 0017**, once stage 4 says how much of the 79-row surplus is real line movement.
5. **`--dim`**, still open from prompt 58: `#A2A8B0` restores the third grey's separation to 1.262
   from today's 1.148, at the cost of `--ink`/`--dim` narrowing 2.351 → 2.138. Cowork's
   recommendation is to leave it unless the two greys look muddy to you on the phone.
