# Claude Code — prompt 99 rev B: stop iOS 27 washing the top, and measure the follow-up before it is needed

**Run in Claude Code**, in `C:\Users\jlull\Joe's Projects\Apps - Personal\MySports`, on `main`.

**One metadata value, its comment, one measurement, and the record. No CSS changes, no component
changes, no new elements, no database access of any kind.**

**THIS IS AN UNATTENDED RUN** up to the commit. **It is NOT finished when it deploys** — working rule
25's second half applies: this is a visual change to the installed app and only Joe's phone can
confirm it. Self-commit and push under working rule 7's default; stop for the stop list in
`CLAUDE.md`'s `## Committing` and the list at the end.

**Scope this brief may touch:** `web/app/layout.js`, `docs/enhancement-register.md`,
`docs/handoff-status.md`, `docs/rendering-contract-mobile.md`, `docs/prompts/README.md`,
`docs/prompts/99-ios27-status-bar.md`, `CLAUDE.md`. Nothing else — **`web/app/globals.css` and the
banner components are read-only here**, and stages B and C say why.

**Why there is a rev B:** rev A changed the value and left the follow-up unmeasured. Joe asked for
the number in advance so that if he dislikes the result, the next step is a one-line edit with the
figure already in hand rather than another round trip. **Stage D is that measurement, and it is
arithmetic rather than a device test**, so it costs nothing and can be done in the same run.

---

## The symptom, and what Cowork measured in the tree on 2026-09-15

iOS 27 paints a progressive blur over the top edge of an installed PWA. On Joe's phone it muddies
**whatever is at the top** — the banner wordmark scrolled up, the collapsed header scrolled down.

1. **`web/app/layout.js:23` is `statusBarStyle: 'black-translucent'`.** That is what puts the web
   view UNDER the status bar, so the system's treatment of that band lands on the app's own pixels.
2. **`layout.js:18-22` already records that `default` was tried and is wrong here** — verbatim:
   *"iOS fell back to `default` - an opaque LIGHT bar sitting above a #1b1b1b app."* The same comment
   names the right fallback: *"('black' would be the no-layout-consequence fallback: a dark opaque
   bar.)"*
3. **`globals.css:3171-3178` — `.chdr`, the collapsed header — already paints opaque `var(--spot-2)`
   across the whole safe-area band** (`position: sticky; top: 0; z-index: 40;
   padding-top: env(safe-area-inset-top, 0px)`), and **Joe reports the wash appears over it too.**
   A page-painted background does not stop it, so the effect is composited above the web view and no
   CSS the page writes can defeat it. **That is why this brief adds no element and no background.**
4. **`viewport` at `:32-37` carries `viewportFit: 'cover'` and `themeColor: '#1b1b1b'`;
   `app/manifest.js:19-20` carries `background_color` and `theme_color` both `#1b1b1b`.** The ground
   colour is already right and already declared.

**The three top-inset rules need no edit — they guard themselves:**

| line | rule | at inset 0 |
|---|---|---|
| `globals.css:2011` | `padding-top:max(0px, calc(env(safe-area-inset-top,0px) - 14px))` | **0** |
| `globals.css:2034` | `.banner{padding-top:max(0px, calc(env(safe-area-inset-top,0px) + 4px - 14px))}` | **0** |
| `globals.css:3178` | `.chdr{padding-top: env(safe-area-inset-top, 0px)}` | **0** |

---

## What Joe is trading, and the history that makes it less alarming than it sounds

`globals.css:1998-2011` carries a measured table: at inset 59 the wordmark's first ink lands at
**y = 59.0, exactly on the status band's lower edge** — zero clearance, which is why the blur reaches
it. Under `black`, iOS owns the band and the app starts below it, so the clearance becomes the
artwork's own built-in headroom instead of zero.

**`globals.css:1968-1975` records that this distance has been ruled on in BOTH directions.** Joe's
first ruling, installed: *"the tight distance between the bezel and top of the MySports TV text ...
we need to add a smidge of padding"* — **18px of clear space.** Then it reversed twice: prompt 46
halved the addition 7 → 4, prompt 50 absorbed 8 back out, prompt 51 absorbed 6 more.

So the history is **18px judged too tight to start, then walked down to roughly zero.** The `black`
layout lands between the two. Stage D produces the exact figure so Joe can compare it against both
rulings rather than against a feeling.

---

## Preconditions

- `d6cd7b2` in history. `git status` clean apart from `assets/`; report anything else.
- `HEAD == origin/main`; say what it is.
- Five gates as the baseline, each its own command, each against the floor **read from**
  `docs/handoff-status.md` under "Repo state". **This brief quotes no gate number.**
- Working rule 1: certify the Python interpreter for Windows before running anything Python.

---

## Stage A — the change

**`web/app/layout.js:23`: `statusBarStyle: 'black-translucent'` becomes `statusBarStyle: 'black'`.**
The only value that changes in the file.

**Rewrite the comment at `:18-22`.** It currently explains why `black-translucent` is correct and
that will be false. Keep what stays true — **that `default` gives an opaque LIGHT bar over a dark
app** — and add: iOS 27 composites a blur over the band the web view occupies under
`black-translucent`; `.chdr` already paints opaque `--spot-2` there and the wash appears anyway, so
the effect is above the web view; `black` gives iOS its own dark opaque bar and the app starts below
it. **Reference stage D's measured clearance** so the next reader knows what the top now looks like.

**Do NOT change `viewportFit: 'cover'` at `:35`.** `globals.css:204-205` and `:1842-1843` read the
**left, right and bottom** insets, which `:2011`'s comment records Joe confirmed correct. Removing
`cover` zeroes those too and breaks the landscape gutters and home-indicator clearance.

**Do NOT change `themeColor` or the manifest colours.** Both are `#1b1b1b` = `--spot-2`. **If any
suggestion proposes `#101112` or another hex, it is wrong for this app** — the ground is a radial
gradient at `globals.css:179-182` from `--spot-0 #3b3b3b` to `--spot-3 #0e0e0e`, and a flat override
would flatten it.

---

## Stage B — do not add a status-bar background element

The usual remedy is a fixed div pinned to the top with `height: env(safe-area-inset-top)` and a high
`z-index`. **Do not add one, and say in your report that you were told not to and why:** `.chdr` is
already that element in every respect that matters and the wash appears over it. A second one would
be a second copy of something already shown not to work.

If you find any OTHER element painting into the safe-area top, **name it** — Cowork has only seen
`.chdr` and it is evidence about the same question.

---

## Stage C — do not touch globals.css

All three inset rules resolve to 0 on their own guards. **Changing any of them in this run would
confound the device test**: Joe needs to see what `black` alone looks like before deciding whether
the spacing wants tuning. Stage D measures the number; it does not apply it.

---

## Stage D — measure the new top clearance, exactly, without a device

This is arithmetic on the generated artwork, not a pixel hunt and not a device test.

`globals.css:2021-2026` asserts the artwork's own headroom is **"11 STAGE px = 10.0 CSS px at 390,
the SVG scaling 390/428"**. **That is a comment. Read the component and confirm it** — working rule
30, and `Banner.js:8-9` says the phone banner is generated: `scripts/build_banner_mobile.py` writes
`BannerMobileV2.jsx`, `--check` fails on drift, and `tests/test_banner_generator.py` is the guard.
So the true numbers are in the generated component or its source layout, not in the CSS comment.

**Report all four:**

1. **The stage width** of the mobile banner SVG (the comment says 428). Name the file and line you
   read it from.
2. **The stage y of the wordmark's first ink** (the comment says 11). Name the file and line. If the
   artwork makes this ambiguous — a glow, a shadow, an anti-aliased edge — say which definition you
   used and why.
3. **The CSS clearance under `black`**, which is `first_ink_stage_y × (viewport_width / stage_width)`,
   **evaluated at both 390 and 430 CSS px** — Joe's phone is an iPhone 14 Pro Max, so 430 is the one
   that matters, and 390 is what the existing comment's arithmetic used.
4. **The one-line compensation that would restore today's flush look**, written out but **NOT
   applied**: a negative offset of that same figure on `.banner` inside the existing
   `@media (display-mode: standalone)` block. Say plainly that it pulls the artwork's empty headroom
   up behind iOS's now-opaque bar, so nothing visible is clipped.

**Then state the comparison Joe actually needs:** the measured clearance against **18px (his first
ruling, later judged too much)** and against **~0px (today, flush with the band)**. Do not recommend;
give him the three numbers.

**One thing to say plainly in the report:** `npm run smoke` and `node scripts/qa-shots.mjs` run
without a safe-area inset, so **the harness has always rendered the geometry this change produces.**
No gate can detect this change, and no gate can confirm it. Say so rather than letting five green
gates read as a verdict.

---

## Stage E — the record

- **`docs/enhancement-register.md`** — a new section at the next unused number. **Count and say which
  number you used**; prompt 98 took §47, so expect §48 and confirm it. Record: the symptom; the
  trigger; **the `.chdr` evidence that a page-painted background does not stop it**; why `default`
  was rejected, citing the existing comment; **stage D's four figures with the compensation line
  written out and marked NOT APPLIED**; that prompt 45/46/50/51's tuning is now **dormant rather than
  deleted**, with the three line numbers; and the trade — the edge-to-edge top for an unwashed
  header.
- **`docs/rendering-contract-mobile.md`** — **read it first** and update only what this change makes
  untrue about the top of the app. If it says nothing about the status-bar band, add nothing and say
  so.
- **`docs/handoff-status.md`** — an open item: unconfirmed until Joe looks at his phone; iOS caches
  PWA status-bar metadata at install, so a reinstall is required before the result means anything;
  rule 25's second half is outstanding. **Name stage D's figure as the pre-measured follow-up** so
  the tune is a one-line edit if Joe wants it.
- File this brief to `docs/prompts/99-ios27-status-bar.md`, verbatim. Update
  `docs/prompts/README.md` and `CLAUDE.md`'s prompt-count and register rows. **Count; do not
  increment.**

---

## Assertions

- `grep` `web/app/layout.js`: `black-translucent` appears nowhere; `statusBarStyle: 'black'` appears
  once; `viewportFit: 'cover'` still present; `themeColor: '#1b1b1b'` still present.
- `web/app/manifest.js`, `web/app/globals.css` and the banner components are **byte-identical**.
  `git status --short` proves it.
- No fixed status-bar element was added anywhere. `grep` for one.
- Stage D's stage width and first-ink y are each cited to a file and line in a **generated or source
  file**, not to the CSS comment.
- **Mutation check:** state what a reader could change in `layout.js` that would make the grep pass
  while reintroducing translucent behaviour, and confirm the assertion tests the emitted value rather
  than the word.
- The five gates, each its own command, each against the floor read from `docs/handoff-status.md`.

---

## Gates, then commit and push

All five, each its own command. Gate and commit are separate commands (rule 26). Then commit and
push, and report the Vercel result. **This deploy changes what the app emits**, so a green Vercel
build is a real check rather than a no-op rebuild — but see stage D: it is not a check of the fix.

**End with the undo block:** the revert command with the real SHA, and the note that nothing is
one-way — the revert is one word back to `black-translucent`, and no data, asset or bucket object is
touched.

**Then end the report with the reinstall instruction for Joe, written out**, because the change does
not take effect without it: iOS caches the status-bar metadata at install, so the existing
home-screen icon keeps the old behaviour until the app is removed from the Home Screen and re-added
from Safari.

**Do not dispatch any workflow.**

---

## When to actually stop

Only these. Everything else, decide and keep going, and log the call.

1. `git status` is not clean apart from `assets/` at the start.
2. Changing `statusBarStyle` would require touching `globals.css` or any component.
3. `viewportFit: 'cover'` would have to change.
4. **Stage D cannot find the stage width or the first-ink y in a generated or source file** — do not
   fall back to the CSS comment's numbers and present them as measured; report the gap instead.
5. A gate fails and cannot be made to pass.
6. Anything in `CLAUDE.md`'s `## Committing` stop list.

---

## Standing rules

- Working rule 2: never write to the repo while another prompt is in flight.
- Working rule 4: stage by explicit path; never `git add -A`.
- Working rule 3: secret gate on added lines, with `grep`, never `findstr`.
- Working rule 25: a prompt is done when the deploy is green **and the device agrees**. Not at commit.
- Working rule 30: check the thing, not the label — stage D exists because the headroom figure
  currently lives in a CSS comment, and a comment is a label.
- Gate floors: `docs/handoff-status.md` under "Repo state", nowhere else. This brief quotes none.
- WUAB and RESN are never named. Credentials never enter the repo or a committed doc.
