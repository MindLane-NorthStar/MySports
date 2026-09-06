# Claude Code — Prompt 28: square sport tiles, bigger marks, and the banner's top gap

**Repo:** `C:\Users\jlull\Joe's Projects\Apps - Personal\MySports` · **main**

**Preconditions, hard stop if any fail:**

- `git rev-parse HEAD` == `fa0d091`, and `HEAD == origin/main`.
- Python **200 OK (skipped=1)**, JS unit at whatever prompt 27 left, smoke **30/30**, qa-shots **8/8**.
- Tree clean apart from untracked `assets/` and `artifacts/`.

**Where this comes from.** Joe looked at prompt 26's chip screenshots and at the installed app on his phone. Two findings, both his own words:

1. *"NASCAR button is too wide. Try to standardize button size as much as possible and make the buttons more of a soft-cornered square than an oval. The button shapes appear to be determined by the logo — I'd like to fix them all as soft rounded corner squares."*
2. *"All of the major sport logos — NFL, MLB, NBA, CFB — they're rendering too small within the button. Make them as large as you can without them getting too close to the button edge."*

And on the installed app: the status bar is legible, the banner reaches the top edge, nothing is clipped at the bottom, nothing hides behind the notch — **but there is more space above the banner than needed.**

**This is a move toward the locked reference, not away from it.** `docs/design/mobile_demo.html` (committed by prompt 27) specifies exactly what Joe is asking for:

```
.spbtn{flex:0 0 auto; width:40px; height:40px; padding:5px; border-radius:4px;
  border:1px solid var(--line); background:linear-gradient(180deg,var(--panel-hi),var(--panel-lo));
  display:flex; align-items:center; justify-content:center}
.spbtn img{max-height:100%; max-width:100%; object-fit:contain; opacity:.8}
.spbtn.on{border-color:var(--gold); box-shadow:0 0 0 1px var(--gold) inset}
.spbtn.all{font-family:var(--disp); font-weight:700; font-size:13px; color:var(--dim)}
.spbtn.all.on{color:var(--gold)}
```

Fixed square. Soft corners. Mark fills the box. The shipped app grew logo-shaped pills instead. **Treat this as contract repair, the same framing prompt 22 used — moving back into compliance, not new design.**

**Working rule 22 applies.** Line numbers below were read at `fa0d091`, but they have drifted after every recent prompt. Locate by content and report any citation that does not match.

**Standing rules:** rule 3 (secret gate, ADDED lines only, `grep`), rule 4 (stage by explicit path), rule 7 (self-committing stages), rule 13 (measure against the render, not just the number), rule 20 (no bare repeated string replace).

**No database, no pipeline, no adapters.**

---

## Stage 1 — the sport tiles become fixed soft-cornered squares

### 1a. Give them their own class — do not restyle every `.chip`

`.chip` is shared. Squaring it would break three other controls:

- `app/weeks/page.js` — the two **View** chips are text (`Calendar week`, `Season week`, shortened by prompt 26). Text cannot live in a 44 px square.
- `components/WeekSelect.js` — `.chip-select` wraps a native `<select>` and must stay pill-shaped and text-width.
- Any other `.chip` consumer. **Grep for `className="chip` and `class="chip` across `web/` before you change anything, and list what you find in the report.**

So: introduce a tile class for the sport filter row only. **Name it `.spbtn`**, matching the reference, so the two can be diffed by eye forever after. `components/Filters.js`'s `SportFilter` uses it; nothing else does.

### 1b. The tile

Adapting the reference's 40×40 to the 44 px tap target prompt 25 established (that accessibility work stands and is not being undone):

- **44 × 44 fixed** at ≤699 px — `width`, `height`, `min-width`, `min-height` all 44, `flex: 0 0 auto`, `padding: 4px`.
- **`border-radius: 10px`** — a soft-cornered square, not a pill. The reference uses 4px on a 40px tile; 10px on 44px reads softer and matches the app's other rounded surfaces. **Render both and pick by eye, then report which and why.**
- Keep the existing `.chip` background gradient, the 1 px border, and prompt 26's active treatment: `border-color: var(--gold)` on a charcoal ground.
- **Desktop (≥700 px): the same tile, 36 × 36.** Joe said "the buttons", not "the mobile buttons", and one shape at both widths is the whole point. Report desktop before/after.

### 1c. The mark fills the box

Replace `.chip-mark`'s fixed `height: 20px` (`globals.css:1543` + the ≤699 px override at `:1550`) with the reference's rule:

```css
max-width: 100%; max-height: 100%; width: auto; height: auto; object-fit: contain;
```

With `padding: 4px` on a 44 px tile the mark box is **36 × 36**. Do not set an explicit height — that is what has been holding every mark down.

**Start at 4px padding. If any mark visibly crowds the border or the rounded corner, step to 5px and then 6px, and report which you chose with the rendered mark dimensions.** Joe's instruction is "as large as you can without them getting too close to the button edge", so err large and let the render decide.

### 1d. The `All` tile

Same 44 × 44 square, same radius. `All` is text: centre it, and size the type so it fills the tile the way a mark does — the reference uses 13 px Barlow Condensed 700 uppercase. It keeps prompt 26's gold text when active (it is the one tile where gold text is possible).

### 1e. What this does to each mark — and the one place it fails

Aspect ratios from register §13's native pixel table, resolved into a 36 × 36 box:

| Mark | native | w:h | rendered in 36×36 | vs today's 20 px tall |
|---|---|---|---|---|
| NBA | 113×256 | 0.44 | 16 × 36 | **+80% taller** |
| CFP | 177×256 | 0.69 | 25 × 36 | **+80% taller** |
| NFL | 187×256 | 0.73 | 26 × 36 | **+80% taller** |
| NHL | 226×256 | 0.88 | 32 × 36 | **+80% taller** |
| WWE | 282×256 | 1.10 | 36 × 33 | +65% taller |
| IndyCar | 367×256 | 1.43 | 36 × 25 | +25% taller |
| MLB | 486×256 | 1.90 | 36 × 19 | **−1 px. Unchanged.** |
| UFC | 736×256 | 2.88 | 36 × 13 | −35% |
| NASCAR | 1535×256 | 6.00 | 36 × 6 | **−70%** |

Three of the four marks Joe named get 80% taller, which is exactly what he asked for. **MLB cannot grow** — its logo is nearly twice as wide as it is tall, so a square box caps it. It will read fuller because the empty air around it disappears, but it will not get bigger. That is geometry, not a bug: say so plainly in the report rather than fudging the padding to fake it.

**These are predictions from the aspect table. Measure the actual rendered dimensions and report the real numbers** — the table was computed for a different purpose and may not survive contact with the real files.

### 1f. NASCAR — the fallback, only if the render demands it

At 36 × 6 the NASCAR wordmark is very likely illegible. **Do not decide this from the number. Render it and look.**

If it is unreadable, apply **one** exception and nothing more: marks wider than **3:1** get a double-width tile — **88 × 44** at ≤699 px, **72 × 36** on desktop — same radius, same border, same padding. That is NASCAR and UFC only; everything else stays square. NASCAR then renders about 80 × 13, and the row still reads as one system because there are exactly two sizes.

**Report both versions with screenshots — strict squares, and squares plus the double-width exception — and let Joe choose.** Ship the strict-square version by default; his instruction was "standardize as much as possible", and "as much as possible" is the phrase that leaves this open.

### Acceptance

- Screenshots of the whole row at **360, 390, 430 and 1440 px**, in both active and inactive states.
- The measured tile box (identical for every square tile) and each mark's rendered width × height.
- Total row width at each mobile width; confirm one line, still scrolling, **no page-level horizontal scrollbar**.
- The three text controls untouched: the two `/weeks` View chips and the week `<select>`. Screenshot `/weeks` at 390 px.
- Tap target still ≥44 px at ≤699 px.
- Active state still unmistakable — this changes the tile shape, and prompt 26 already flagged the bordered active state as the quieter of the two options. **If squaring makes it harder to spot, say so**, and note that the reference's second cue is available at no layout cost: `box-shadow: 0 0 0 1px var(--gold) inset`.

---

## Stage 2 — the banner's top gap in the installed app

Joe's report from the installed app: *"I can read the clock and banner. There's actually more space than needed above the banner."* The other three checks passed — the banner reaches the top edge, nothing is clipped at the bottom, nothing hides behind the notch. **Do not touch those.**

The cause is at `globals.css:1360`:

```css
.banner{ ... padding-top:env(safe-area-inset-top, 0px); ... }
```

Prompt 26 added that so content clears the status bar under `black-translucent`. But it **adds** to headroom the banner already has — `.bn-mobile .wordmark` carries `padding-top:12px` (`:1374`) and the banner SVG has its own top margin. In Safari the inset is 0 and the total looks right; installed, the inset (about 47–59 px on a modern iPhone) stacks on top of it.

**The fix is to make the inset absorb the existing headroom instead of stacking on it:**

```css
padding-top: max(0px, calc(env(safe-area-inset-top, 0px) - <existing headroom>px));
```

1. **Measure the existing headroom first**: the distance from the top of `.banner`'s box to the top of the wordmark glyphs at 390 px with the inset at 0. Report the number — that is the value to subtract.
2. Apply the `max()`/`calc()` form so a zero inset can never produce negative padding.
3. **Verify in Chromium by simulating the inset**, since Playwright cannot produce a real one: temporarily set `padding-top` to the same expression with a literal 47 px in place of `env(...)`, screenshot at 390 px, then remove the override. Report the before/after gap in pixels.
4. Do not change `.shell`'s left/right/bottom insets or anything else from prompt 26 stage 5.

**Say plainly in the report that this cannot be self-verified** — it needs Joe's phone. Ask him to reopen the installed app and confirm the gap above the wordmark now looks right and the status bar is still legible.

---

## Stage 3 — record the tile ruling

Append to `docs/enhancement-register.md`, verbatim:

```markdown
## 15. SPORT TILES — 2026-09-03. Fixed soft-cornered squares, marks filling the box.

Joe, after seeing prompt 26's chip screenshots: *"NASCAR button is too wide. Try to standardize
button size as much as possible and make the buttons more of a soft-cornered square than an oval.
The button shapes appear to be determined by the logo — I'd like to fix them all as soft rounded
corner squares."* And: *"All of the major sport logos — NFL, MLB, NBA, CFB — they're rendering too
small within the button. Make them as large as you can without them getting too close to the button
edge."*

**This is contract repair, not new design.** `docs/design/mobile_demo.html` already specifies a fixed
40 × 40 tile with `padding:5px`, a soft radius, and `max-width/max-height:100%; object-fit:contain`
on the mark. The shipped app had grown logo-shaped pills whose width was set by the mark's aspect
ratio, which is what made NASCAR three times wider than its neighbours.

**Ruling.** The sport filter row uses a fixed square tile — 44 × 44 at ≤699 px (preserving prompt
25's tap target), 36 × 36 on desktop — with a soft radius and the mark sized only by the box. The
tile class is `.spbtn`, matching the reference. `.chip` is untouched: it still carries the `/weeks`
View chips and the week `<select>`, which are text and cannot be square.

**The trade-off, named.** In a fixed square, a wide mark fits by its width and renders short. NBA,
CFP, NFL and NHL gain roughly 80% in height — exactly what was asked. **MLB does not:** its mark is
~1.9:1, so a square box caps it and it stays about where it was. It reads fuller only because the
surrounding air is gone. NASCAR at 6:1 is the extreme case, and if the render shows it illegible the
single sanctioned exception is a double-width tile for marks wider than 3:1 — NASCAR and UFC only,
two sizes total, nothing else.

This supersedes §13's implied pill shape and §14a's assumption that mark height is set by a fixed
`height` rule. §14's inverted active state (charcoal plate, gold border) is unchanged and applies to
the tile exactly as it applied to the chip.
```

Also add one line to `docs/handoff-status.md`'s open list: **the banner's standalone top gap was corrected in this prompt and needs Joe's phone to confirm.**

---

## Stage 4 — report

Per stage: what changed, the sha, the acceptance evidence, every judgment call. Gates before and after.

Call out specifically:

- **The measured mark dimensions**, against the predicted table in 1e. Where reality differs, say so — the table was computed for a different purpose.
- **Whether NASCAR is legible as a strict square**, with the screenshot, and both versions if you built the exception.
- **The banner gap** before and after, with the simulated-inset screenshot, flagged as needing Joe's phone.
- **Anything in this brief that turned out wrong.** Three reports running have found bad citations in their own briefs, and that has been the most useful part of each.

---

## Explicitly out of scope

- **`.chip`, the `/weeks` View chips, and the week `<select>`** — text controls, untouched.
- **The other three iOS checks** — Joe confirmed the banner reaches the top edge, nothing is clipped at the bottom, nothing hides behind the notch. Leave `.shell`'s insets alone.
- **The grid zoom question** — still waiting on Joe's phone.
- **`SCHED` in the card's right slot** — a separate design conversation Cowork owes Joe.
- **`.favlabel` prominence** — Joe's ruling still open.
- **The four project-only builders** (`build_demo.py`, `app_template.html`, `build_banner.py`, `markkit.py`) — Cowork places those, not this prompt.
- **`programs/big-noon-kickoff.png`** — its 1.122% builder failure is known and deliberate since prompt 16.
- Anything in `pipeline/`, `adapters/`, or the database.
