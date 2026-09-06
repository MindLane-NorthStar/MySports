# Claude Code — Prompt 27: the mobile page order

**Repo:** `C:\Users\jlull\Joe's Projects\Apps - Personal\MySports` · **main**

**Preconditions, hard stop if any fail:**

- `git rev-parse HEAD` == `89614ec`, and `HEAD == origin/main`.
- Python **200 OK (skipped=1)**, JS unit **138/138**, smoke **30/30**, qa-shots **8/8**.
- Three files are present in the working tree and **uncommitted** — Cowork placed them after prompt 26 reported, and stage 1 commits them:
  - `docs/enhancement-register.md` (modified — was prompt 26's INCOMPLETE stub, now §1–§14)
  - `docs/audit-triage-2026-09-03.md` (untracked)
  - `docs/design/mobile_demo.html` (untracked)
  - Otherwise tree clean apart from untracked `assets/` and `artifacts/`.

**Working rule 22 applies throughout.** Line numbers below were taken at `89614ec`, but prompt 26 reported that numbers had drifted on every file prompt 25 edited. **Locate by content, not by line number, and report any citation that does not match.**

**Standing rules that bite here:** rule 3 (secret gate, ADDED lines only, `grep` never `findstr`), rule 4 (stage by explicit path), rule 7 (self-committing stages, 2-strikes-skip), rule 20 (never a bare repeated string replace).

**This prompt touches no database, no pipeline code, and no adapters.**

---

## Stage 1 — commit the authorities, and one clarification

### 1a. Commit what Cowork placed

Prompt 26's stage 1a could not run because all three sources were project-only. Cowork has now written them into the working tree. **Commit them by explicit path; do not edit their content.**

- `docs/enhancement-register.md` — replaces the stub. Now carries §1–§14 plus **§14a**, two corrections from your own prompt-26 report: the CFP-on-gold figure was measured against `--spot-2` and the chip's real ground is the panel gradient (7.41/9.52:1, not 10.05:1), and "gold border *and* gold text" is achievable on one chip only.
- `docs/design/mobile_demo.html` — the locked reference implementation. It is a **template**: `__DATA__`, `__TODAY__`, `__GRIDSVG__` and the rest are filled by `build_demo.py`, which is still project-only. Its header says so.
- `docs/audit-triage-2026-09-03.md` — the triage that produced prompts 25 and 26.

**Two things the reference settles, now that it can be read.** Both are already written into the files; they are here so you know what changed and do not re-derive them:

1. **Register §13's `.chiprow` citation was correct.** The reference sets `overflow-x:auto` on `.chiprow` (line 65). The triage concluded §13 "cited the wrong file" because the only match it could find was a feature-study mockup — the reference was not in the repo to read. The substantive finding stands unchanged: shipped `globals.css` had `flex-wrap: wrap`, so prompt 25's scroller was a real and necessary change. §13 now carries that correction inline.
2. **The active-chip asymmetry you flagged matches the reference.** `.spbtn.on` is `border-color: var(--gold)` plus `box-shadow: 0 0 0 1px var(--gold) inset`; `.spbtn.all.on` additionally takes gold text. So logo chips getting the border alone is reference behaviour, not a departure. **Recorded in §14a and left as shipped** — but if the active state ever reads ambiguous on a phone, the reference's inset gold ring is the second cue, and it costs no layout.

### 1b. Append to `docs/feature-study/05-home-page-decisions.md` §11, verbatim

§11 says "the page reads YOUR TEAMS → grid → everything else" without saying which page. Add this so it cannot be over-applied:

```markdown
**Scope clarification (added at implementation).** §11 governs the **Today page (`/`)** only. `/weeks`
and `/history` group rows by day, and hoisting a favourite out of its day would destroy the thing
those pages exist to show — a calendar. They keep the in-band float they have today, which on those
pages floats within a day rather than within a sport. D6's float is therefore retired on `/` and
retained on `/weeks` and `/history`.
```

### 1c. `docs/handoff-status.md`

Add to the open list: **`build_demo.py`, `app_template.html`, `build_banner.py` and `markkit.py` are still project-only.** They are the builders that produce the locked design references, and they are not under version control. Confirmed absent from the working tree at `89614ec`. Cowork owes them; this is a filing item, not a defect.

---

## Stage 2 — the page order (05 §11)

**Read first, and cite what you find:** `web/components/Listing.js` (the fragment it returns, the `jumpbar`, the band map, `.mgrid-only`), `web/components/SportBand.js` (the favourites float, `.favlabel`, `.favrule`, the count block, the toggle, `rowClass`), `web/lib/offservice.js` (`offServiceSummary`, `countSummary`), and `web/app/globals.css` (`.band`, `.favlabel`, `.favrule`, `.jumpbar`, `.mgrid-only`).

### 2a. The target

On `/`, in DOM order: **the YOUR TEAMS section → the sport bands → the grid.** At ≤699 px, CSS `order` moves the grid above the bands so the *visual* order is **YOUR TEAMS → grid → bands**. Above 699 px the DOM order stands.

`order` needs a flex container, and `Listing.js` currently returns a fragment. Wrap its children in one element with `display: flex; flex-direction: column`. A column flex container lays block children out the way a block does, so desktop should be visually unchanged — **but flex containers do not collapse margins.** `.band` is `margin: 0 0 26px` (bottom only), so there should be nothing to collapse. **Verify that rather than assuming it: measure the vertical gap between two bands, before and after, at 1440 px and at 390 px, and report both.** If spacing moved, fix it in the wrapper rather than by editing `.band`.

### 2b. Build the section out of the component that already exists

Do not write a second implementation of the count line, the toggle or the row wrappers. `Listing.js` already renders `SportBand` with `showHeader={false}` for `/weeks` and `/history` precisely so those have one implementation. Use the same door:

- In `Listing.js`, split the day's games into **favourites** (across every sport, chronological among themselves) and **the rest**, using the same favourites source `SportBand` uses today.
- Render one `SportBand` for the favourites with the section label, then the per-sport bands over the rest.
- Move the `YOUR TEAMS` marker to section level. It stays at section level and **never touches the card** — the card contract is locked and nothing here reaches inside it.

**Omit an empty band.** With favourites hoisted, a sport whose only games were favourites now has zero rows. A header over nothing reads as a bug — omit the whole band. Report which days in the loaded season produce one.

**Omit the section when there are no favourites that day.**

### 2c. Counting — each section counts what it shows

This is the part that must not be got wrong, and it is why this prompt is separate from prompt 26's count-line change.

The YOUR TEAMS section carries **its own count line**, in the §10 vocabulary prompt 26 shipped (`airing` / `TBD` / `unavailable`). Each sport band counts **only the games still in it**. Every number then describes the rows beneath it.

- Do not leave a band counting games that are no longer in it.
- Do not double-count: a favourite MLB game appears in the YOUR TEAMS count and **not** in the MLB band's count.
- The `Show N unavailable` toggle belongs to whichever section is hiding those games.
- **Add a test** pinning that, for any day, the sum of every section's totals equals the day's game count, with no game counted twice.

### 2d. Retire the jump chip at ≤699 px

`.jumpbar` is already mobile-only (`display: flex` inside the ≤699 px block, `display: none` above 700 px). With the grid second there is nothing to jump past. **Remove the jumpbar and its CSS**, and remove the now-unused `gridId` anchor if nothing else references it — grep before deleting.

### 2e. Untouched

`gridGames` still spans every band and is unaffected by the reorder — the grid shows what it showed. D5's ≥1600 px band-left / grid-right composition is untouched. `/weeks` and `/history` keep the in-band float, per §11's scope clarification in stage 1b. `.favlabel`'s size, weight and letter-spacing are untouched — Joe's ruling on its prominence is still open. Its colour is whatever prompt 25's `--faint` lift left it at.

### Acceptance

- Screenshots at **390 px and 1440 px** of `/?day=2026-09-03` (favourites present across two sports) and of a day with no favourites.
- The DOM order and the visual order at both widths, stated explicitly and separately.
- The band-to-band vertical gap before and after, at both widths.
- The count arithmetic for a day with favourites: every section's line, and the sum against the day's total.
- Which days in the loaded season produce an empty band, and proof one is omitted.
- `/weeks` and `/history` unchanged — screenshot each at 390 px against a pre-change shot.

---

## Stage 3 — the doubled sport name in the empty states

Cowork's stage-4 copy in prompt 26 repeats the sport, and so does the NASCAR line that shipped in prompt 25:

```
No games on this viewing day for UFC. UFC is not loaded yet. ...
No games on this viewing day for NASCAR. NASCAR arrives with the playoffs, September 6.
```

IndyCar's phrasing avoids it. Make all four consistent by pronouncing the sport once, in the shared prefix, and referring back to it in the second sentence:

- **NASCAR** — `It arrives with the playoffs, September 6.`
- **IndyCar** — unchanged (`The 2026 season ends this month; the 2027 schedule publishes in October.` or whatever prompt 25 shipped — do not rewrite a line that already reads correctly).
- **WWE** — `It is not loaded yet — Raw, SmackDown and the premium live events are coming.`
- **UFC** — `It is not loaded yet — the numbered events and Fight Nights are coming.`

Report the four rendered strings in full, prefix included, so Joe reads what a user reads.

---

## Stage 4 — report

Per stage: what changed, the sha, the acceptance evidence, every judgment call. Gates before and after.

Call out specifically:

- **The margin question.** Did wrapping `Listing.js`'s children in a flex column change any vertical spacing at either width? Numbers, not an assurance.
- **The count arithmetic**, with the sums.
- **Anything in this brief that turned out wrong.** Two of your last three reports found bad citations in their own briefs, and both times that was the most useful thing in the report.

---

## Explicitly out of scope

- **The grid zoom fix.** Still waiting on Joe's phone. Prompt 26's on-device checklist asks the question; nothing gets designed around a defect until the device confirms one.
- **`SCHED` in the card's right slot** — Joe has opened it as a separate design conversation. Cowork owes him an options board.
- **`.favlabel` prominence** — Joe's ruling still open.
- **The four project-only builders** (`build_demo.py`, `app_template.html`, `build_banner.py`, `markkit.py`) — flagged in stage 1c, placed by Cowork later, not by this prompt.
- **`--faint`** — 3.63:1 on the card top is accepted and documented.
- **`programs/big-noon-kickoff.png`** — its 1.122% builder failure is known and deliberate since prompt 16. Leave it.
- Anything in `pipeline/`, `adapters/`, or the database.
