# Prompt 61 — the split header, and the logo art that never shipped

**Venue:** Claude Code, in the repo. Everything here is answerable from the files.
**Shape:** staged, self-committing, unattended-safe. Two strikes on a stage and you skip it and
report; do not improvise a third approach.
**Approval:** stages commit. **Nothing pushes.** Joe pushes when he has read the report.

## Hard stops — the only four

1. A secret-gate hit on ADDED lines.
2. A destructive database operation. *(This prompt performs none. Rule 27's schedule check does not
   apply — there are no database writes anywhere in it. Do not run one "to be safe".)*
3. A rejected push. *(There is no push in this prompt.)*
4. Stage 4 discovering that the picker's data cannot reach the header without a change larger than
   the one described there. **Stop and report rather than inventing a data path.**

## Standing rules that bite in this run

- **Rule 1** — certify the Python interpreter for Windows before running anything Python.
- **Rule 2** — no other Claude Code prompt may be in flight. Confirm before writing.
- **Rule 3** — secret gate every commit, **ADDED lines only**, with `grep`. Never `findstr`.
- **Rule 4** — stage by explicit path. Never `git add -A`. `assets/` stays untracked; it is not drift.
- **Rule 11** — call git with `--no-optional-locks`.
- **Rule 16** — colour tokens are read from `web/app/globals.css`, never retyped.
- **Rule 20** — no bare repeated string replace on a source file. Line-anchored surgery or a parser,
  and assert only the intended region changed.
- **Rule 22** — before asserting what a component does, read it and cite file and line.
- **Rule 23** — `docs/design/mobile_demo.html` changes in the same commit as anything it implements.
  **Stage 6 owes this.**
- **Rule 26** — the gate and the commit are SEPARATE COMMANDS. Never read a gate from an `&&` chain.
- **Rule 28** — a Python-side YAML parse is no evidence GitHub Actions agrees; `tests/test_workflows.py`
  is the guard. **Stage 2 owes this.**
- **Rule 29** — any writer that can reach a tracked file passes `newline="\n"` or writes bytes.

## The five gates

Run all five, each as its own command, before each stage's commit. Report all five counts every time.

```
pytest                       # repo root — 466 pass + 1 skipped is the floor
npm run test:unit            # web/ — 367 is the floor
npm run smoke                # web/ — 30/30
node scripts/qa-shots.mjs    # web/ — 14/14
npm run geometry             # web/ — the phone-grid tripwire
```

Floors may only go up. The geometry tripwire is re-baselined only in stage 6, and only if the run
proves it moved for the reason stage 6 names.

---

# Stage 0 — preflight

1. Certify Python (rule 1). Record the interpreter you certified.
2. `git --no-optional-locks status --porcelain=v1`. **Expected:** exactly one modified file,
   `scripts/fetch_team_assets.py`, plus untracked `assets/**`. Anything else, stop and report.
3. Record the five gate counts as the run's baseline.
4. Record today's phone-grid tripwire figures verbatim from `CLAUDE.md` so stage 6 has a before.
5. Read rule 14 as it stands today and paste it into the report. Stage 0b rewrites it, and the
   before-and-after belongs in the record.

Commit nothing.

---

# Stage 0b — working rule 14 is revised: writes to Supabase are allowed

**Joe's ruling, 2026-09-07, in conversation:** *"revise that rule so that you are allowed to write to
supabase."* The conversation overrides the standing rule, and this stage writes that override down so
the next session inherits it rather than re-deriving it.

## What rule 14 was protecting, and why the protections survive without it

The old rule — *"no direct Postgres connection, no writer credential, no DML"* — was a blunt stand-in
for three real risks at a time when there was no safe write path. All three are now covered elsewhere,
which is why the rule can narrow rather than simply disappear:

- **Accidental destructive writes** → rule 6 (additive over destructive; SELECT and paste first;
  close, don't delete).
- **Colliding with the nightly loader** → rule 27 (check the schedule; never two at once).
- **A writer credential leaking into the repo** → the Supabase connector holds the credential outside
  the repo entirely. There is no `.env` value and no string for rule 3's gate to catch, which is
  strictly safer than the alternative it replaces.

**The one risk the change genuinely introduces is new:** DDL applied through a connector and never
written down as a migration file. The repo's `db/migrations/` is the schema's record; nothing in the
five gates can detect a database that has drifted from it. The revised rule closes that explicitly.

## Do

Replace rule 14 at **`CLAUDE.md:73-74`** with the text below, verbatim. Keep the numbering — rule
numbering is frozen and this is a revision, not a new rule.

> 14. **Database writes go through the Supabase connector, and only through it.** There is still no
>     direct Postgres connection and no writer credential in the repo, in `.env`, or in any prompt —
>     the connector holds it. PostgREST reads with the publishable anon key remain the app's normal
>     read path and are always allowed. Four conditions bind every write: **named approval for that
>     operation** — approval for one is never standing approval for the next; **SELECT and paste
>     first** (rule 6); **the schedule checked first** (rule 27); and **every DDL statement exists as
>     a file in `db/migrations/` before it is applied, and is applied from that file** — the repo is
>     the schema's record, and a change applied through the connector and not written down is drift
>     no gate can catch. Still hard stops, with or without approval: `drop`, `truncate`, a `delete`
>     with no `where`, and any write while the loader is running.

Then bring the other **live** copies into line. Cowork found four sites; verify the list yourself
before editing, because a copy it missed is exactly the stale note this repo keeps paying for.

1. **`CLAUDE.md:73-74`** — the text above.
2. **`docs/handoff-status.md:878-879`** — the rules list. Same substance, matched to that list's
   tighter house style.
3. **`docs/handoff-status.md:748`** — the prompt 57 open item currently reads *"Rule 14's hard stop is
   no connection, no writer credential, no DML, so applying it is Joe's call."* Applying it is still
   Joe's call, but for a different reason now: named approval per operation, not a blanket bar.
   Rewrite it to say that, and note that the connector lives in **Cowork**, not here — Claude Code
   cannot apply this migration and should not try.
4. **`db/migrations/0017_game_odds_one_row_per_book.sql:5`** — the header quotes the old rule. Same
   correction.
5. **`handoff/project-mirror/claude_handoff-status.md:242`** — determine whether this mirror is
   generated or hand-maintained before touching it. If generated, regenerate it; if hand-maintained,
   edit it; if you cannot tell, leave it and say so in the report rather than guessing.

## Do NOT touch

- **`docs/prompts/22-contract-repair.md`** and **`Claude outputs/phase4-claude-code-prompt-22-contract-repair.md`.**
  Both contain the old wording, and both are **verbatim archives of what a past run was asked to do**.
  `CLAUDE.md` describes `docs/prompts/` as exactly that. Editing them would falsify the archive.
  A historical brief is allowed to quote a rule that has since changed — that is what an archive is.

## Method

Rule 20: line-anchored surgery, not a bare repeated string replace — the phrase "no writer credential"
appears in seven files and a global replace would hit the two archives above. Rule 29: any writer that
can reach a tracked file passes `newline="\n"` or writes bytes. After the edit, `grep` every site
again and paste the result, so the report shows what changed and what deliberately did not.

**Run all five gates** — this is a docs-only change and none should move, which is itself the thing
worth proving.

**Commit:** `rules: database writes go through the supabase connector`

---

# Stage 1 — the dark logo variants that were never conditioned

**This is the bug behind the "?" marks Joe saw on the 2026-09-12 CFB slate (ETSU, Howard, Wofford),
and it is two separate faults stacked. Fix the conditioning one here; stage 2 fixes the delivery one.**

## What is wrong

`scripts/build_web_marks.py:543` `team_dark_variants()` skips any team that already has a
`{id}_dark.png`:

```python
dark = p.with_name(f"{p.stem}_dark.png")
if dark.exists() and not force:
    counts["present"] += 1          # provider art or a variant built by an earlier run
    continue
```

The docstring above it (`:550-555`) states the premise: *"A provider's own dark art always wins …
`scripts/fetch_team_assets.py` already saves ESPN's `500-dark` variant as `{id}_dark.png` where ESPN
offers one."*

**The premise is false for most of the files.** ESPN serves its `500-dark` URL for every team whether
or not a distinct dark lockup exists; where none exists it returns the same bytes as the base. So a
`_dark.png` that is **byte-identical to its base** is not provider art — it is the absence of provider
art wearing the filename. `team_dark_variants()` counts it "present", skips the conditioning chain,
and a logo that is genuinely dark stays dark and sinks into `--panel` `#23262B`.

**Do not take the 449-of-642 and 172-sink figures from this brief as fact.** They came from Cowork
and are the reason to look, not the finding. Measure them yourself in step 1 below and report your
own numbers.

## Do

1. **Measure first, change nothing.** Over `assets/logos/`, count: base files; `_dark.png` files;
   `_dark.png` files byte-identical to their base (compare bytes, not size); and of that identical
   set, how many have an alpha-weighted luminance that fails to read on `#23262B`. Use the same
   luminance definition `build_web_marks.py` already uses — read it, cite the line, do not invent a
   second one. Print the four counts and the id list for the third.
2. **Fix the skip condition** at `build_web_marks.py:561` so a `_dark.png` byte-identical to its base
   is treated as **absent** and gets the conditioning chain. Keep `--force` working as it does.
   Genuinely distinct provider art must still win — verify that on at least three teams whose
   `_dark.png` differs from its base, and name them.
3. **Correct the docstring** at `:550-555` in the same edit. It currently asserts the false premise
   and will mislead the next reader. Say what is actually true: the file's existence is not evidence
   of provider art, and identity with the base is how the absence is detected.
4. Re-run the variant build. Report generated / present / skipped, and re-measure the sink count.
5. **Commit `scripts/fetch_team_assets.py` in this stage too.** It has been sitting modified since the
   backfill: the docstring at line 8 said *"Downloads logos ONLY for teams appearing in the Week 1 and
   Week 8 fixtures"* and no longer matches the behaviour. Read the diff, confirm that is all it is, and
   commit it here rather than leaving it to drift into an unrelated stage.

`assets/` is untracked (rule 4) — the regenerated PNGs are not committed and are not drift. Only the
two scripts are staged.

**Commit:** `logos: a byte-identical dark file is no provider art`

---

# Stage 2 — the nightly run only ever fetched the week's logos

The second half of the "?" fault, and the reason Joe's local backfill never reached the phone.

`adapters/cfbd.py:238-239`:

```python
needed = {str(g[s]["id"]) for g in fixture["games"] for s in ("home", "away")}
print(f"teams: {len(teams)}; logos:", fetch_logos(teams, root / "assets" / "logos", needed))
```

The nightly job fetches art only for teams in the current fixture, so a team first appearing this
week has no logo until the night its game loads — and `assets/` is untracked, so Joe's local backfill
of the rest exists on his disk and nowhere else. Production reads what
`scripts/sync_assets.py --push --prefix logos/` pushed to R2, and that step can only push what the
runner has.

## Do

1. Drop the `needed` restriction so `--teams` fetches art for every team in the response. Keep
   `fetch_logos`'s own skip-if-present behaviour — read it and confirm it has one before relying on
   it; if it does not, this stage re-downloads everything nightly and you should stop and report
   rather than shipping that.
2. Add `--make-dark` to the "Push new logos to R2" step in `.github/workflows/schedule_refresh.yml`
   so the conditioning from stage 1 runs on the runner, not only on Joe's machine.
   `scripts/sync_assets.py:152` documents the flag as idempotent.
3. **Rule 28.** Extend `tests/test_workflows.py` to pin the flag on that step. A Python-side parse is
   not evidence Actions agrees — pin it the way the existing tests in that file pin their steps.
4. Report the expected first-run cost: how many teams the unfiltered fetch covers, and roughly how
   long that adds to a nightly run.

**Commit:** `logos: nightly fetches every team and conditions on the runner`

---

# Stage 3 — the picker arrows come down to 31px

Joe's ruling, 2026-09-07, with the measurement behind it.

The picker row is 44px **because of the arrows**, not the picker. `.pk-arrow` carries
`min-height: 44px` (`globals.css:3005`) and `.pickrow` is `align-items: stretch` (`:2988`), so the
pill is dragged up to the arrows. Measured in Chromium against the shipped stylesheet at 390px: row
44, arrow 44, pill stretched to 44, **pill measured alone 31.39** — a 12px font at the inherited
1.45 line-height gives a 17.4px line box, plus 6px of `.pk-face` padding top and bottom (`:2528`) plus
1px of border each side.

**Relaxing the arrows to 28 does not give a 28px row — it gives 31.39**, because the pill becomes the
tallest thing. Joe was shown that and ruled 31. Reaching a true 28 would take `.pk-face` padding down
to 4px, and he declined it.

## Do

1. `.pk-arrow`: `min-height: 44px` → `min-height: 31px`. **Width stays 44px.** Do not touch
   `.pk-face` padding, `.picker`'s font-size, or the pill in any way.
2. Measure `.pickrow` before and after and report both. Expected 44 → 31.39, set by the pill.
3. **The comment at `globals.css:2359` is now false.** It reads *"The 44px rule still governs
   everywhere else - the tiles, the toggles, the picker arrows all keep it."* Correct it here. A note
   that misdescribes the code is worse than no note.
4. **Amend `docs/enhancement-register.md` §18b** to hold three exceptions rather than two, with the
   measured areas so the next reader can weigh them the way Joe did:
   - ALL SPORTS bar — 24px tall, full width, ~8,400px²
   - segmented toggles — 31px tall, ~3,720px²
   - **picker arrows — 44 × 31 = 1,364px²**, the smallest of the three, spent on Joe's ruling that
     the arrows should sit level with the toggles rather than stand 13px above them.
5. Check `test/collapsedheader.test.mjs` and `test/pagehead.test.mjs` for anything asserting
   `.pk-arrow`'s height. Cowork read both and believes nothing does — the "no third exception" guards
   at `:226` and `:337` cover `.chdr-toggle` and `.chdr-tile` only — **verify rather than accept that.**

**Commit:** `picker: the arrows come down to 31px`

---

# Stage 4 — the split

The structural stage. Read this whole section before touching anything.

## What Joe asked for

The picker renders directly beneath the navbar and stays there. When the ALL SPORTS tile is tapped,
the league row opens **between the navbar and the picker** — pushing the picker and the schedule
down, not covering them. His reasoning: a dropdown belongs immediately below the control that opened
it, and a picker sitting between the tile and its own menu reads as disjointed.

## What is already right

`.chdr-sports` renders **inside** `.chdr`, immediately after `.chdr-inner`
(`components/CollapsedHeader.js:341`). The row is already a sibling of the bar. The picker only has to
become the sibling **after** it. The adjacency needs no new structure.

## The four hazards, all verified in the code

1. **The picker's data does not reach the layout.** `CollapsedHeader` mounts at `app/layout.js:61`;
   the picker renders from `app/page.js:724`; and the **week** picker needs `choices`, which the page
   computes server-side. The layout cannot see it. Solve this, and if the only solution you can find
   is larger than moving one component or threading one prop, **stop and report** (hard stop 4).
2. **`.chdr` is `position: fixed`, and a fixed element pushes nothing.** The stack has to become
   sticky and sit in normal flow.
3. **The current hide mechanism reserves space once it is in flow.** The expanded state is
   `visibility: hidden; opacity: 0; transform: translateY(-100%)` (`globals.css:3037-3054`), and
   `html[data-hdr='collapsed'] .chdr` restores it (`:3067`). A transformed in-flow element still
   occupies its box, so the expanded state would leave ~77px of empty ground above the banner. The
   expanded state must remove `.chdr` from flow. **This probably costs the 160ms slide-in at
   `:3379-3381`** — you cannot transition out of `display: none`. Losing it is acceptable; say so in
   the report so Joe is not surprised by a motion change he did not ask for.
4. **The sticky offset has to move when the row opens.** With navbar and picker both sticky, the
   picker sticks at the navbar's height; open the row and it slides underneath. The offset must track
   the open height. `CollapsedHeader` already knows `sportsOpen` — a CSS custom property written from
   there is the obvious route, but choose after reading.

## The finding that makes this safer than it looks

`app/layout.js:55-59` records that `CollapsedHeader`'s mount position is **load-bearing**: being a
sibling of `.shell` keeps it off `<main>`'s ancestor chain, so `.chdr`'s `transform` can never become
a containing block for the mobile grid's sticky rail — *"the one thing globals.css tells you not to do
to `.mrail-cell`."*

**Sticky preserves that.** `.chdr` stays a sibling of `.shell` and stays ahead of it in flow, so
growing it pushes `.shell` down while it remains off the grid's ancestor chain. **Do not wrap the
content to achieve the push.** If the approach you reach for requires `.chdr` to become an ancestor of
`<main>`, it is the wrong approach — stop and report.

Sticky also **deletes** `html[data-hdr='collapsed'] .shell { padding-top: calc(44px + 8px + inset) }`
(`:3091-3093`). That rule exists only to clear a fixed bar, and its hardcoded `44px` would otherwise
have to track the whole stack height. Removing it is part of this stage, not a separate tidy-up.

## Do

1. Read `CollapsedHeader.js`, `app/page.js`'s `Controls`, `lib/headerstate.js` and the `.chdr` CSS
   block before writing anything. Cite file and line for each claim you make about them (rule 22).
2. Move the picker so it renders as the last child of `.chdr`, after `.chdr-sports`.
3. **There must be exactly one picker in the DOM at a time.** The expanded stack renders its own at
   `page.js:724`. Two would mean two `<input type="date">` with the same id and the same
   `aria-labelledby`, which is the duplicate-render class of bug prompt 60 already paid for once with
   MY TEAMS. Assert it in a test, both collapsed and expanded, both day and week mode.
4. `.chdr` → sticky, in flow, with the expanded state removed from flow.
5. Make the sticky offset track the open row.
6. Remove the `.shell` clearance padding.
7. **Both modes.** Week mode has its own picker and its own data path. A change that works in day mode
   and silently drops the week picker is the failure to watch for here.

**Commit:** `header: the picker joins the bar and the league row splits them`

---

# Stage 5 — the three gold lines, tiered

Joe's ruling: a thin gold line under the navbar, under the picker, and under the league row when it is
open. He chose the **tiered** weighting from Cowork's renderings.

- Navbar line: `rgba(198, 175, 122, 0.28)`
- League row line, when open: `rgba(198, 175, 122, 0.28)`
- Picker line — the outer edge of the fixed block: the existing `--gold-line`, `rgba(198,175,122,.55)`
  (`globals.css:134`)

The reason for the tier: closed, the navbar line and the picker line sit ~31px apart with only the
date between them, and two rules at equal weight read as stripes rather than as boundaries. The outer
edge leads; the internal division stays a division.

## Do

1. `.chdr` already carries `border-bottom: 1px solid var(--line-soft)` (`:3044`). This is a value
   change on an existing border, not a new one.
2. Add the token for 0.28 to the `:root` block beside `--gold-line` rather than writing the rgba
   inline in three places (rule 16 — one definition, read from the token block).
3. All three lines are **1px**. Cowork's renderings drew them at 2px so they would read at that size
   and said so on the page; do not take 2px from those frames.
4. The league row's line only exists while the row is open. Do not leave a border on a collapsed
   element.
5. Contrast is not the question here — these are decorative rules, not text. Do not "fix" them to
   meet a text ratio.

**Commit:** `header: gold hairlines under the bar, the row and the picker`

---

# Stage 5b — the wordmark's optical centring in the navbar

Joe, 2026-09-07: *"measure the vertical space between the bottom of the MySports TV text and the
horizontal line at the bottom of the navbar. Whatever distance that is, we can take that amount and
reduce the space ABOVE MySports TV by that amount … there's twice as much padding between the top of
the text and bottom of bezel than there is between the bottom of the text and the bottom of the
navbar."*

## What Cowork measured, and where the premise breaks

Rendered at 390px, deviceScaleFactor 4, with the repo's own self-hosted `BarlowCondensed-Bold.ttf`
and the exact `.chdr-inner` / `.chdr-wm` declarations from `globals.css` — ink found by **scanning
rendered pixels**, which is the method `globals.css:1841` already establishes for this wordmark
because *"a `<text>` element's bounding box is its em box and not its ink"*:

```
row height                  44.00
ink top                     15.25   <- gap ABOVE
ink bottom                  31.25
gap BELOW (44 - 31.25)      12.75
ink height                  16.00
ratio above:below            1.20
```

**The asymmetry inside the navbar is 2.5px, not 2:1.** It is the line-box centring artefact: all-caps
Barlow Condensed sits low in its em box, so `align-items: center` centres the box and leaves the ink
2.5px off-centre. That much is ours and is worth correcting.

**The 2:1 Joe is seeing is the safe-area band, and that space is not the navbar's.** `.chdr` takes the
**full** inset — `padding-top: env(safe-area-inset-top, 0px)` at `globals.css:3045` — while `.banner`
absorbs 14px of it through `max(0px, calc(env(safe-area-inset-top, 0px) - 14px))` at `:1859`, with the
standalone rule at `:1882` adding 4 back for a **net absorption of 10px**. The banner was tuned; the
navbar never was. From the bottom of the visible clock and battery glyphs there is unused status-bar
band, and then 15.25px — which is what reads as double.

## Do

1. **Reproduce the measurement before changing anything.** Same method: render `.chdr-inner` with the
   real font at 390 and at 360, scan the pixels, and report ink top, ink bottom and both gaps. If your
   numbers differ from the table above, **yours win** — say so and carry on from them.
2. **Equalise inside the bar.** Move the ink down by half the difference so the gaps match at
   `(15.25 + 12.75) / 2 = 14.00` each — this is what Joe asked for, applied to the part of the space
   that actually belongs to the navbar. Do it optically, not by breaking the 44px box: the button
   still fills the row's full height, because `.chdr-wm`'s comment at `:3290` records that the 44px
   height is what makes the tap target the row rather than the letterforms. **Do not change
   `font-size`, `height`, or `align-items`.** Re-measure and prove both gaps.
3. **Then measure the inset question and stop.** With the equalisation in, render at the two insets
   the banner note uses — **47 and 59** — and report, for each, how far the ink sits below the inset's
   lower edge. Then state what absorbing 2, 4 and 6px of inset would do to that distance.
   **Do not pick a value.** The banner's wordmark lands *exactly* on the inset's lower edge and Joe
   approved that; the navbar has no artwork headroom to spend, so the same treatment here would put
   the caps flush against the status bar. That is a look Joe has to see on the phone, not a number
   this prompt should choose.
4. **Do not touch `.banner`'s padding, the `+4` standalone rule, or the left, right and bottom
   insets** — `globals.css:1857` records that Joe confirmed those correct.

**Report:** both gaps before and after, and the inset table from step 3, so Joe can rule on the
absorption with numbers in front of him.

**Commit:** `header: the wordmark sits optically centred in the bar`

---

# Stage 6 — the reference, the tripwire, and the new dead band

1. **Rule 23.** `docs/design/mobile_demo.html` implements the header. Stages 3, 4 and 5 all changed it.
   Update it in this commit. A reference that lags the app stops being an authority.
2. **The tripwire.** Re-run `npm run geometry`. Block counts and block widths must not move — the rail
   width is untouched by this run, so a move there is a hard stop, not a re-baseline. `scrollWidth`
   should also hold for the same reason. If any figure moved, report it and stop; do not re-baseline a
   number you cannot explain.
3. **Measure the new dead band, and do not assume it.** The only measured figure in the record is
   **45px against today's 44px navbar**, from prompt 60's CDP touch runs. Everything Cowork projected
   from it — ~78px for the closed 31px-picker stack — is arithmetic, not measurement. Re-run that
   measurement against the new stack, closed, in **week mode grid view**, and report:
   - the measured dead band in px
   - the visible grid height at that scroll position
   - the dead band as a share of it
   Report the open-row state separately if you can measure it, and label it transient.
4. **Do not touch `MobileGrid`'s touch handling.** The document-level pinch rebind stays shelved. Joe's
   call is to measure the new band first so causes stay separable. If the measured band is worse than
   the projection, that is a finding to report, not a licence to fix it in this run.
5. Update `docs/handoff-status.md`: close what this run closed, and record the new measured band.

**Commit:** `docs: the reference, the tripwire and the measured dead band`

---

# Stage 7 — the ALL GAMES ordering: measure only, change nothing

The open item from prompt 60, recorded at `docs/handoff-status.md:121`. `allRows` at `app/page.js:471`
is `[...games, ...programRows]` — a concatenation of two separately-ordered reads — so within an NFL
band a pregame show can still list after the game it precedes. It was deliberately not fixed because
sorting `allRows` outright reorders ALL GAMES without being asked.

**Joe rules this with data, not from a description.** So:

1. Snapshot ALL GAMES as it renders today across the eight views the prompt 60 run used.
2. Apply the sort **in a scratch working copy that you do not commit**, and snapshot the same eight.
3. Report the diff: how many rows move, in which views, and what the worst single reordering looks
   like in reader terms — not as a row count.
4. **Revert the scratch change.** Nothing from this stage is committed.

If the diff is empty outside the pregame case, say so plainly — that is the answer that makes this a
one-line fix in a later prompt.

---

# The report Joe needs

Per stage: what changed, the five gate counts, the commit hash, and every number you measured with the
command that produced it. Then, at the end:

- **The measured dead band**, against the 45px baseline, with the share of the visible week grid.
- **`.pickrow` before and after**, and whether anything else in the control stack moved.
- **The wordmark's two gaps**, before and after, plus the inset table stage 5b owes.
- **Whether the 160ms header slide-in survived** stage 4, and what it looks like if it did not.
- **Stage 7's diff**, stated in reader terms.
- **Anything in this brief that turned out to be wrong.** Cowork's figures for the dark-logo counts,
  the 31.39px pill and the ~78px projected band are all stated above as claims to check, not as
  findings. Say which ones held.

Nothing pushes. Joe reads the report, then decides.

---

## Deliberately not in this run

- **Migration 0017 itself.** Stage 0b changes the RULE; it does not apply the migration. The Supabase
  connector is attached to **Cowork**, not to this session, so Cowork applies it once Joe rules on the
  second decision (delete the 79 surplus rows, or keep them). Do not attempt it from here, and do not
  touch `pipeline/load.py:259-261` — its conflict target must keep naming the OLD constraint until the
  new one exists, or every loader run fails on a missing ON CONFLICT target.
- **The `MobileGrid` pinch rebind.** Shelved by Joe's ruling, pending stage 6's measurement.
- **The streaming tap test.** Evidence stage, and it needs a phone, not a repo.
- **The `--hairline` dead token.** Zero consumers, recorded, harmless. Removing it is a tidy-up nobody
  asked for.
