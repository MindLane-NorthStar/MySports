# Prompt 80 — push what's banked, settle the tripwire, block D, and icon v8 + the banner

Base: `48dc256` pushed. **`1cd2f29`, `f7af6b1`, `97b4853` committed and unpushed.** Block D never
started. A second Cowork session produced an icon and banner brief plus its art; block E folds it in.

**FIVE BLOCKS, EACH ITS OWN COMMIT.** A stop inside one leaves every earlier block banked — do not
roll back work already committed. Read gate floors from `docs/handoff-status.md` before each block
(rule 10).

---

# BLOCK A — push the three commits

`1cd2f29` (MLB id drift + box-score loader), `f7af6b1` (gate fix, bundle check, rules 35/36),
`97b4853` (block C: the Guardians URL, the link checker, `the-cw`, the `mobile_demo.html` box-score
obligation block B missed).

Joe approves. Push them.

---

# BLOCK B — the tripwire moved, and the fix is not a re-baseline alone

MLB `2026-09-03` went `{228}` / 567 → `{229}` / 569, widest 86.508 → 87.08, because
`schedule_refresh` ran at 14:55Z mid-session and loaded standings — and `widest` is measured off the
team line **including the record**. Hard stops held: 3 blocks, 2 network rows.

**Re-baseline it, and record the cause beside the number.** Joe's call, made: it is documented drift.
The evidence is that this has happened before — `handoff-status.md` already carries
*"227.58 → 228 observed and `scrollWidth` 567.93 → 567 observed. Records drifted; that is all."*
Same mechanism, second instance.

**AND THAT IS THE ACTUAL PROBLEM.** A tripwire that moves every time a team's record gains a digit is
a tripwire that cries wolf, and this session has just paid for what happens next: a recorded flake
becomes the bucket a real regression hides in. Prompt 74's `qa-shots` conclusion was true when
measured and false three prompts later, and block A's genuine regression landed in it.

**So re-express the figure in terms standings cannot move.** `handoff-status.md` already identifies
the invariant that holds — `sw / (widest + 182)` — because `pxPerMinute = (widest + 182) / blockMinutes`
makes `scrollWidth / widest` move by construction. Make the **ratio** the tripwire and the raw
`scrollWidth` a reported observation, or say why that does not work and propose what does.

**The hard stops do not change**: block count and network-row count stay exactly as they are. This is
about the figure that drifts, not the ones that must not.

---

# BLOCK C — Joe's tap test, reported not built

Block C4 established `/tv/g*` **is** claimed in MLB's AASA and `mlb.com/tv/g824791` returns 200 — but
so does `/tv/g999999999`, three bytes apart, because `/tv/` is a client-rendered SPA that 200s on any
path. **A fetch cannot settle it. Only a tap can.**

**Change no link.** Prepare the test and stop: give Joe two URLs — one real gamePk, one bogus — with
exact numbered steps to text them to himself and tap each on the iPhone, and say what each outcome
means. That is the same shape that settled the DIRECTV question, and it is the only instrument that
works here.

---

# BLOCK D — the list order and the favourites marker

**Unchanged from prompt 78's block D. Its line numbers predate blocks A and B of prompt 78 and
everything since — LOCATE BY CONTENT** (rule 22).

**Joe's ruling, 2026-09-09:** *"Organize qualifying events by TIME, including pregame shows and
MyTeams games. THEN when events start at the same time, prioritize by: Pregame shows, MyTeams, Other
events."* Within each sport band; the gold left rule becomes a gold **outline** of the card; any
studio show pre or post — *"so long as the priority is 1) TIME 2) pre/post THEN myteams THEN other
events."*

His worked example, to be pinned as a test — six rows, two favourites, three studio shows, two pairs
tying at 12:00:

```
FOX NFL Kickoff             11:00   FOX
FOX NFL Sunday              12:00   FOX
CBS NFL Today               12:00   CBS
Browns @ Steelers            1:00   CBS
Football Night in America    7:00   NBC
Panthers @ Bucs              8:15   NBC
```

**D1 —** `chronological()` gets a third term after `isProgram`: a favourite outranks a non-favourite.
Order: **time → studio show → favourite → everything else.** It does not know what a favourite is;
both call sites hold `favIds`. Do not restate `isProgram` or the favourite test inside it. Both call
sites (rule 32 — prompt 71's brief named day only and week had the same defect). MY TEAMS should be
inert; **confirm by measurement.**

**D2 —** the float comes out. **This reverses a settled decision (rule 10):** D6 at prompt 20,
reworked at prompt 59 after Joe called the old treatment *"like an afterthought"*, switched off for MY
TEAMS at prompt 53 stage 6. It goes because position is now meaningful. With it gone nothing passes
`floatFavorites={true}`, so the prop and `.favgroup` are dead — dead code goes with the feature, as
prompt 67 did with `FirstBand`. **Enumerate before deleting**, name anything that survives and why,
invert the tests that pinned the render, correct the register and `handoff-status.md`.

**D3 — the gold outline, and it must be `outline`, not `border`.** `.mcard`'s body track is
`minmax(0, 1fr)`, so horizontal space comes out of what `fitNameAndRecord` has for a name and a
record. Prompt 59 measured 11px of inset dropping **10 of 26** name tiers and 6px dropping none. An
`outline` paints outside the border box and takes **no layout space**, so the cost is zero — **verify
by measuring the body track before and after** (rule 34).

**THE COLLISION:** `globals.css:1015` is `outline: 2px solid var(--gold)` as the `:focus-visible`
ring, and `.mcard` is a `button`. Ownership and focus would look identical and a keyboard user loses
their position. Make them unmistakably different, say how and what you measured, **or stop and
report.** Also check clipping under `overflow: hidden`, collision with the neighbouring card,
`border-radius`, and contrast on the card ground. **MY TEAMS outlines every card, which is noise —
report and recommend, do not decide silently.**

Screenshots at 390×844 into `assets/`: the Sunday NFL example in ALL GAMES day/list; a mixed band; a
focused card beside an unfocused favourite; MY TEAMS.

---

# BLOCK E — icon v8 and three banner changes

A second Cowork session wrote a complete brief and its art. **File it verbatim at
`docs/prompts/80-icon-v8-banner-alignment.md`** — it says 72, which is taken.

**Its factual claims were checked from outside and all hold**, so treat them as verified rather than
re-deriving them:

| claim | verified |
|---|---|
| `assets/brand/icon-v8/` holds the 1024 master, 512, 192, 180, 48 | **all five present** |
| the five live destinations are 1024 / 512 / 192 / 180 / 48 | **all five match exactly** |
| `assets/brand/tv-cutout-dark.png` and `web/public/banner/tv-cutout-dark.png` exist | **both present** |
| `tv-cutout-dark.png` is the same box as `tv-cutout.png` | **1110×1167 and alpha bbox (0,0,1110,1167) — identical** |

So **stage 3 is genuinely a file swap and no coordinate moves.** That is the claim everything else
rested on and it is confirmed; the brief's own "verify before you rely on it" is satisfied.

**Follow that brief's five stages as written** — icon install, the dark title halo replacing the gold
glow, the blacked-out cutout, the glow re-taper, and regeneration. Its numbers are measured and its
reasoning is recorded; do not re-derive them, and do not substitute your own filter values.

**Three things it flags that this prompt reinforces:**

1. **Stage 4 reverses a documented decision (rule 10).** Prompt 45 kept those glow tails deliberately
   and `scripts/build_banner_mobile.py`'s header records why. Joe overrode it and chose the re-taper
   over the outright zero. **Rewrite that header comment in the same commit** — a generator that
   documents the opposite of what it generates is the stale-note failure this project keeps paying
   for.
2. **There is no desktop generator.** `BannerDesktopV2.jsx` is hand-maintained. Hand-edit it to match
   the JSON, defs and title passes only, no coordinates.
3. **Verify by reading the rendered SVG**, not by assuming: `<image href>` is
   `/banner/tv-cutout-dark.png`, the halo text is black, each glow gradient has five stops ending
   at 0.

**One correction to that brief:** it says "Do not commit and do not push." **Commit it** — as this
prompt's block E, on Joe's approval with the rest. Do not push it separately.

`web/public/banner/tv-cutout-dark.png` is the untracked file the previous session found and correctly
left alone. **It is block E's, and block E tracks it.**

**Rule 25's second half stays open and say so:** an installed PWA does not refresh its icon until the
tile cache clears, so Joe's phone may show v7 after a green deploy. **That is not a failure.** Prompt
78's asset-version work covers app assets, not the home-screen tile.

---

# GATES AND COMMITTING

Five gates before **each** block's commit, each its own command, all reported (rule 26). `qa-shots`
is now condition-waited and should hold 91/91 — **if it does not, that is a finding, not a flake.**

Tripwire: CFB `2026-09-05` 64 / {240, 223, 205, 136} / 1273, NFL 17 / {264, 98, 73} / 1044, and MLB
`2026-09-03` at whatever block B re-baselines it to. **Hard stops — block counts and network rows —
must not move.**

**Rule 23 per block, not one blanket line.** Block D changes card decoration and list order, which
`mobile_demo.html` does implement. Block E changes the banner and the icon — establish what that file
implements of either.

Staged by explicit path (rule 4, never `git add -A`; `assets/` stays untracked **except block E's
`assets/brand/icon-v8/` and the retired master, which are the deliverable** — name every path).
Secret-gate each on ADDED lines only, with `grep` (rule 3).

**Block A pushes. Nothing else pushes without Joe's word.** Report per block and wait.
