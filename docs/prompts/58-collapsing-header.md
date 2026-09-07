# Prompt 58 — the collapsing header

**Run after prompt 57.** `CLAUDE.md` is the standing brief. **Read it from disk before citing a rule
number.**

---

## STATUS — verified from the tree, 2026-09-07

| | |
|---|---|
| `HEAD` and `origin/main` | **`2532ac7`** — 0 ahead, 0 behind. Prompt 57 is pushed and the Vercel deploy went READY on that sha |
| Production | running **prompt 57** |
| Device-confirmed | **Prompts 52–57.** Joe checked 52–56 earlier on 2026-09-07, and 57 after the push. Rule 25 is satisfied for all six, including prompt 52's four veto calls — banner wordmark metallic, LIVE green, card gradient, gold-carrying-information sites — recorded as **accepted** |
| Outstanding from the check | **One adjustment. Joe: "walk the token change halfway back, not all the way back."** That is stage 0 below, and it lands before stage 1 |
| Tree | clean apart from the six untracked `assets/` directories |
| Rules | stop at **33** (`handoff-status.md:801`), so a new one would be 34 |
| Register | last section is **§25**, so §26 is correct for this run |

## PRECONDITIONS

1. `HEAD == origin/main == 2532ac7`, tree clean but for the six `assets/` directories.
2. Python certified for Windows (rule 1).
3. The five baseline gate counts recorded: pytest 494 + 1 skipped · unit 401 · smoke 30/30 ·
   qa-shots 14/14 · geometry all hard stops (ratios 12.8898 / 6.6629 / 8.5069).

**If any is not true, stop and say which.** Do not start and report the gap afterwards.

## THE UNATTENDED CONTRACT

Stages self-commit. **Hard stops are only:** a secret-gate hit, a destructive database operation, or
a rejected push. Everything else is two-strikes-skip. Never roll back a green stage because a later
one failed.

**No database writes and no database reads.** Nothing here touches data.

---

## WHAT JOE APPROVED, AND WHAT IT IS NOT

Ruled on 2026-09-07 across four exchanges:

- **Expanded, then collapse on scroll.** Not opens-collapsed. First paint is unchanged.
- The collapsed bar carries **the wordmark and the four current choices. Nothing else.**
- **No tagline. No TV cutout. No artwork.** Both were in his original sketch; both were measured out.
- `DAY`, `ALL GAMES`, `LIST` **flip on tap.**
- `ALL SPORTS` **opens the tile row** — not the full control stack.
- **Scroll position alone owns the banner state.** There is no manual expand control.

**What this does not buy.** Expanded-then-collapse leaves the above-the-fold burden where prompt 57
left it: banner 123 + shell padding 8 + control stack 216 = **347px** before the first card. The
saving is reachability, not first paint. Do not "improve" this by opening collapsed.

---

## THE CORRECTION THAT MAKES THIS SAFER THAN PREVIOUSLY BRIEFED

Cowork told Joe that a sticky page header "creates a new containing block" above the grid's sticky
rail, and called it a serious risk. **That is wrong, and the tree says so.**

`globals.css:1089-1094`, on `.mrail-cell`: the rail's stickiness holds *"only while nothing between
this element and `.mgrid-scroll` carries a transform: a transformed ancestor would become its
containing block… which is exactly the bug prompt 30 fixed. Do not add one."*

The hazard is a **transform on an ancestor**, scoped to the chain between `.mrail-cell` and
`.mgrid-scroll`. `position: fixed` and `position: sticky` do **not** establish containing blocks for
descendants — only `transform`, `filter`, `perspective`, `backdrop-filter`, `will-change` and
`contain` do. A page header is a **sibling** of the grid, never an ancestor, so it cannot reach that
chain. `globals.css:1084-1086` confirms `.mgrid-scroll` carries no transform any more.

**The real risk is smaller and different: touch interception at the top edge.** `.mgrid-scroll` sets
`touch-action: pan-x pan-y` (`:1080`) and the grid runs a pinch handler. A fixed bar over the top
44px of that scroller takes touches there. That is a device question, not an architecture one.

**Two hard rules follow, and they are the whole of the containing-block discipline here:**

1. **The header is a sibling of `<main>`, never an ancestor.** Mount it in `layout.js` beside
   `Chrome`, not wrapping the content.
2. **No transform on any element between `.mrail-cell` and `.mgrid-scroll`.** A transform on the
   header itself is fine — its only descendants are its own controls.

---

## STAGE 0 — walk the card gradient halfway back, and keep the AA win

**Joe's ruling from the prompt 57 device check, 2026-09-07:** *"walk the token change halfway back
not all the way back. Otherwise everything else checks out."*

Prompt 57 stage 5 took `--panel-top` from `#31363d` to `#23262b`. That cleared AA for `--faint` for
the first time, and it also collapsed the card's top-to-bottom gradient from a 1.327 luminance ratio
to **1.064** — near enough to flat that cards, toggles, tiles and picker arrows stopped reading as
raised objects. Joe wants the dimensionality back without losing the legibility.

**Two token changes, both in `web/app/globals.css` `:root`. Rule 16 — read them from that block, never
retype a hex from this brief without checking it against the file.**

```
--panel-top   #23262b  ->  #2A2E34     the exact midpoint of prompt 57's change
--faint       #868d96  ->  #8E959E
```

### Why the second one is not scope creep

Halfway alone drops `--faint` to **4.07** on the card top — better than the original 3.63, still short
of AA's 4.5. The `--faint` comment in that same token block explains why lifting the token was
previously impossible: AA needed `#989fa8`, which measures 4.55 against `--dim`'s own 4.62, so the two
would have become the same colour and the third grey step would die.

**That blocker was a property of the old ground, not of the tokens.** On `#2A2E34`, `--dim` measures
5.18, which reopens the room. A *smaller* lift than the one the comment rejected clears AA and keeps
a real step:

| | on `#31363d` (before 57) | on `#23262b` (after 57) | on `#2A2E34` (this stage) |
|---|---|---|---|
| `--ink` | 10.86 | 13.54 | **12.17** |
| `--dim` | 4.62 | 5.76 | **5.18** |
| `--faint` at `#868d96` | 3.63 | 4.53 | 4.07 — fails AA |
| `--faint` at `#8E959E` | — | — | **4.51 — clears AA** |
| gradient spread to `--panel-bottom` | 1.327 | 1.064 | **1.183** |
| `--dim` vs `--faint` separation | 1.02 if lifted — step dead | — | **1.148 — step alive** |

**Rule 13: every one of those is measured against the local background** — the top of
`linear-gradient(180deg, var(--panel-top), var(--panel-bottom))` — never a global corner sample.
Verify them yourself rather than trusting the table; Cowork computed them and Cowork has been wrong
three times in two prompts.

**Blast radius.** `--panel-top` feeds **10** instances of that gradient — the matchup card, `.seg`,
`.spbtn` and `.pk-arrow`. `git grep` the token and confirm the count. `--faint` carries roughly 16
sites including the MLB probable-pitcher line and `.mgrid-note`. **Re-measure all three tokens on all
four surfaces**, not only the card.

**The gold plate is unaffected** — `.seg button[data-active='true']` uses its own literal first stop
(`#D8C595`), not the token. **Confirm by reading the rule** (rule 22), do not assume.

**If Joe's halfway value and the AA clearance turn out to be incompatible in a way this table does not
show, ship the halfway value and report it.** His instruction is the ruling; the AA lift is Cowork's
proposal for getting both, and it is the part to drop if only one can hold.

**Acceptance:** the before/after contrast table for all three tokens on all four surfaces; the
`--panel-top` consumer count; a screenshot of a card at 390 showing the gradient is visible again.

**Commit:** `theme: half the gradient back, and the third grey lifted to meet it`

---

## STAGE 1 — the mechanism, and nothing else

The smallest thing that can be judged: a fixed bar that appears on scroll and disappears at the top,
**containing only the wordmark.** No controls yet.

**The trigger is an `IntersectionObserver` on a sentinel, never a scroll handler.** A zero-height
sentinel immediately after the banner; when it leaves the viewport the bar shows, when it re-enters
the bar hides. A scroll listener fires every frame and this app has never had one.

**The architecture note, and it belongs in the register rather than arriving as a side effect.**
`web/app/page.js:14` and the CSS both record that every breakpoint is CSS-gated at 699px *"precisely
so there is no server/client hydration mismatch,"* and the hub is deliberately URL-only with no
localStorage. This adds the hub's **first client-side UI state.** It is legitimate because it is
**post-mount and ephemeral** — the server renders the expanded state, the observer applies the
collapse after hydration, and nothing is persisted or read back. **The initial server render must be
the expanded state.** Write that distinction down: the next person who wants client state will cite
this as precedent, and the line between "ephemeral post-mount presentation" and "state the URL should
own" needs drawing now rather than arguing later.

**Position.** `position: fixed; top: 0; left: 0; right: 0`. Fixed rather than sticky because the
expanded banner must scroll away while the bar must not push content when it appears.

**The safe area.** `layout.js` sets `viewportFit: 'cover'`, and `.banner` already handles the top
inset at `globals.css:1799` — `padding-top: max(0px, calc(env(safe-area-inset-top, 0px) - 14px))`,
with a further 4px adjustment at `:1822`. The bar needs the same shape: **background bleeds into the
inset, content sits below it.** Do **not** copy the −14px absorption — that was a banner-specific
ruling from prompts 50 and 51 about dead space above artwork, and there is no artwork here. The bar
takes the plain inset.

**For the height arithmetic:** the inset region was never usable screen, so the bar costs the reader
**44px** even though its painted height is 44 + inset.

**Motion.** Any show/hide transition lives inside `@media (prefers-reduced-motion: no-preference)`
with the existing block at `globals.css` ~2926, whose comment explains the guard is a wrapper rather
than a `reduce` block that undoes things. `transform` and `opacity` only.

**List view only.** Gate it so nothing renders in grid view — stage 5 proves it.

**Acceptance:** the bar appears and disappears at the right scroll position at 390; no content shift
when it appears; nothing in grid view; the observer is the only trigger; screenshots at the top and
mid-scroll.

**Commit:** `hub: a collapsing header, mechanism only`

---

## STAGE 2 — the wordmark and the four choices, read-only

**The width budget at 390px. These are MODELLED at an estimated 0.45em advance for Barlow Condensed
uppercase — the font host was blocked from both the container and the device shell. Confirm every
figure against real metrics before fixing any padding in code.**

| slot | content | width |
|---|---|---|
| left | wordmark `MYSPORTS TV` at 22u | 108 px |
| right | `DAY` `ALL GAMES` `LIST` `ALL SPORTS` | 244 px at 11.5px type |
| — | 12px padding each side, 6px between targets | 24 px |
| | **available** | **258 px** |

Build the run at **11.5px or 12px.** 13px lands at exactly 258 with zero margin; 14px does not fit.
Read `SPORT_LABEL` from `web/lib/config.js` and **check the longest league name against the ALL
SPORTS target** — a label wider than "ALL SPORTS" breaks the row when a league is selected.

The wordmark uses the banner's gold gradient. **Rule 16: read the tokens from `globals.css`, never
retype a hex.**

In this stage the four words are **display only.** Stage 3 makes them controls. Splitting it proves
the layout before the interaction lands on top of it.

**Deliberately absent, so nobody helpfully adds it:** the **date and week picker are not in the
collapsed bar.** There is no room, and the omission is not a regression — changing the viewing day
already requires scrolling to the top today. Tapping `DAY` flips the **mode**, not the date.

**Acceptance:** rendered widths of each element at 390, 360 and 430; the longest `SPORT_LABEL`
measured against its target; no wrap, clip or overflow at any of the three.

**Commit:** `hub: the collapsed bar names the wordmark and the four choices`

---

## STAGE 3 — three binaries that flip on tap

`DAY`, `ALL GAMES` and `LIST` become buttons. One tap switches; the label shows the new state
immediately. This is what justifies paying 44px permanently — a bar that only reports state is worth
far less than one that can be operated.

They set the same URL params the expanded toggles set (`mode`, `scope`, `view` — `useSetParam` in
`web/components/Filters.js`). **Reuse that function; do not write a second one.** The two surfaces
must never be able to disagree about what a toggle does.

### The accessibility pattern — a third pattern, and it goes in the register

`web/components/Filters.js:26-38` records why the expanded toggles are `role="radiogroup"` +
`aria-checked` rather than `aria-pressed`: exclusivity should be announced, not inferred.

**A collapsed binary shows only one option, so it cannot be a radiogroup.** Use a plain button whose
**visible text is the current state** and whose **accessible name states the action**:

```
<button aria-label="Time range: Day. Switch to Week">DAY</button>
```

Register §17 already records that this app deliberately runs two different patterns for the toggles
and the tiles. **This is a third — record it there rather than harmonising one into another.** If you
conclude the accessible-name wording should differ from the example, say why and use yours.

**Tap targets are 44px in both dimensions.** `DAY` and `LIST` are only ~20px of text and must be
padded out. The 44px minimum already carries two recorded exceptions (register §18b: the 31px
segmented toggles, the 24px ALL SPORTS bar). **Do not spend a third here** — a control tapped while
scrolling is the worst place in the app for a small target.

**Acceptance:** each button's rendered box at 390; the accessible name of each in both states; a
keyboard pass proving focus order and a visible focus ring; the URL after each tap.

**Commit:** `hub: the collapsed binaries flip on tap`

---

## STAGE 4 — ALL SPORTS discloses the tile row

**Joe's ruling, 2026-09-07: tapping ALL SPORTS opens the tile row.**

Not binary — ALL plus eight league tiles is nine states, and cycling would take eight taps to get
from NFL back to NHL.

**It opens the tile row only** — the 24px ALL SPORTS bar plus the eight tiles, 74px, the same
`SportFilter` the expanded stack renders. **Not the full 216px control stack.** Picking a league or
ALL closes it.

Reuse `SportFilter` from `web/components/Filters.js`. Do not fork it. If it needs a prop for this
context, add the prop.

This is a **second piece of ephemeral UI state** under stage 1's ruling: not persisted, not in the
URL, gone on reload. The URL still owns `sport` itself — only the open/closed-ness is ephemeral.

**The disclosure needs `aria-expanded` on the ALL SPORTS button and a real relationship to the row it
opens.** A visually hidden row must be genuinely hidden from the accessibility tree, or focus order
breaks the moment it closes.

**Acceptance:** the row opens and closes; picking a league closes it and updates both the URL and the
label; `aria-expanded` correct in both states; focus never enters a closed row; the row overlays like
the bar rather than pushing content.

**Commit:** `hub: all sports opens the tile row from the collapsed bar`

---

## STAGE 5 — the grid exclusion, and proving it

**The collapsed bar does not render in grid view.** Not because it would break — the containing-block
analysis above says it cannot — but because `.mgrid-scroll` sets `touch-action: pan-x pan-y` and runs
a pinch handler, and a fixed bar over the top 44px of that scroller intercepts touches in a way never
tested on a real device. Week mode compounds it: N stacked grids, each with its own rail and handler,
**a combination that is itself unconfirmed on a phone.**

Ship list view, prove it on the device, then extend. That sequencing is the mitigation.

**Prove the exclusion rather than asserting it.** A test that renders all four grid views and asserts
the bar is **absent from the DOM** — not merely hidden, since a hidden fixed element still takes
touches in some engines when it is only `opacity: 0`.

**Then run the geometry gate and read its parsed output, not its exit code** (rule 26). Block, lane
and row counts unchanged; the tripwire ratios were 12.8898 / 6.6629 / 8.5069 at `2532ac7`. Nothing
here should move them at all, so any movement is a finding.

**Acceptance:** the absence test; the geometry gate's parsed output; a statement of which views carry
the bar and which do not.

**Commit:** `hub: the collapsed bar is list view only, for now`

---

## STAGE 6 — the record

**Register §26** (last is §25 — verify): **stage 0's token adjustment first** — Joe's halfway ruling,
the measured table, and the finding that lifting `--faint` was blocked by the old ground rather than
by the tokens, which is the part a future reader of the original `--faint` comment needs. Then the
collapsing header as one entry carrying Joe's six rulings; **why the tagline and the TV are not in the bar** — both measured out, not forgotten, and
this is the line most likely to be "restored" by a future reader; the third accessibility pattern
from stage 3 alongside §17's existing two; the ephemeral-UI-state ruling from stage 1; and the grid
exclusion as **deliberate and temporary**, with what has to be true before it lifts.

**`docs/handoff-status.md`:** the stage/commit table, the five gate counts, **the device confirmation
of prompts 52 through 57 on 2026-09-07, including prompt 52's four veto calls as accepted**, and the
open item that grid view still has no collapsed bar.

**`docs/design/mobile_demo.html`** — rule 23. The locked reference does not currently implement a
collapsed header. **Read it and decide** whether a header that exists in the app but not the
reference makes the reference stale. Say which, and why, rather than assuming either.

**A working rule 34, only if this run earns one.** Rules stop at 33 — verify, and note that 33 was
proposed by prompt 57 and may or may not have been written. The candidate: *a CSS mechanism asserted
from memory is not a mechanism.* Cowork called a sticky header a containing block for the grid's rail,
which is false, and briefed a risk profile around it. Write it only if you agree it is distinct from
**22** (read the component, not the contract) and from 33. If it is one of those in a costume, extend
that one instead.

**File this prompt** at `docs/prompts/58-collapsing-header.md`, verbatim.

**Commit:** `docs: register §26 and the run of record`

---

## THE REPORT

1. **Confirmation that all three preconditions were true before stage 1** — the push, the device
   check, and the clean baseline. Name them individually.
2. **Screenshots at 390**: top of page (expanded), mid-scroll (collapsed), the tile row open, and
   each of the three binaries after a tap.
3. **The measured width table** from stage 2 at 390, 360 and 430, against the modelled figures in
   this brief — and the longest `SPORT_LABEL` measured against its target.
4. **The accessible name of every control in both states**, and the keyboard pass.
5. **The geometry gate's parsed output**, with the three ratios.
6. Stage by stage: sha, all five gate counts, anything skipped under two-strikes.
7. **Every citation in this brief that turned out to be wrong**, with the correction. Prompt 57's
   brief carried three; assume this one has some too and go looking.
8. **HEAD, and whether `HEAD == origin/main`.**

Then stop. Do not deploy, do not open a browser, do not write to the database.
