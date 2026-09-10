# Prompt 83 — close Block D2 at 1px, push, then run Block E

**Joe's ruling: 1px. Ship what is staged.** The 2px escalation is not taken and its CSS should not
be left in the tree as a commented-out alternative — the register records that it was measured and
declined, which is where a rejected option belongs.

**Approval scope.** Joe approves committing and pushing Block D2 after §1 below. That approval does
not extend to Block E, which ends with the work in the tree and a diff, uncommitted and unpushed.

**Why 1px, for the record — this is a decision note, not flattery.** Cowork read the three shots at
pixel scale rather than taking the report's word for it. At real size the gold frame is a distinct
edge, not a wash. `mobile__favourite-focus-vs-mark.png` is what settles it: the focus ring is 2px
standing off at `outline-offset: 2px` and the mark is 1px hugging the card edge, and they are
tellable apart *because the weights differ*. At 2px they become two gold lines of equal weight
separated only by a gap, which reads as one thick double rule rather than as "focused" and "yours."
The card's left edge already carries the team-colour bars and a gold time label, so the heavier frame
also starts competing with the content it is framing. Put that reasoning in the register — the next
person to look at this will otherwise assume 1px was chosen for subtlety.

**And the ordering is visibly correct.** `mobile__favourite-mixed-band.png` reads 12:00, 12:30,
12:30, 12:45, 1:00, 1:00, 2:00, 3:00, 3:30, 3:30 with the two marked cards sitting in their own time
slots rather than hoisted. That is the thing Joe asked for, and it is now visible in an artifact
rather than asserted by a test.

---

## 1. Two things before D2 commits

### 1a. The off-service compose is asserted but never SEEN

`.offsvc-row` is `opacity: .45; filter: saturate(.7)` (`globals.css:2046`). A favourite that is also
off-service inherits both, and **a 1px gold border at 45% opacity and 70% saturation may not survive
that** — it is the one combination where the mark could effectively vanish.

The mutation check proved the two classes *compose in the DOM*. It did not prove the mark is still
*visible* once the row is dimmed, and those are different claims. Rule 13 is the habit that applies:
a threshold is measured against the local background, not asserted.

Do this: render a QA shot of a row that is both `fav-row` and `offsvc-row`, and measure the gold
border's delta against the card ground **in that dimmed state**, not in the normal one. If the mark
survives legibly, say so with the figure and ship as-is. If it does not, the fix is a rule that
restores the border's own opacity under the dim — **not** removing the dim, which is a separate
shipped decision, and **not** changing the mark's weight, which Joe has now ruled. Bring the figure
and the proposed rule to Joe rather than choosing for him.

If no favourite in the current data is off-service, say that plainly and construct the case in a
fixture rather than reporting the combination as untestable.

### 1b. Account for the test count out loud

`test:unit` went 568 → 570, a net of **+2**, in a block that rewrote `favbracket.test.mjs` wholesale,
retired assertions in three more files, and added three qa-shots. That arithmetic only works if tests
were removed.

`docs/handoff-status.md`'s floor note says floors may only go up **"with the one exception that a
removed feature takes its tests with it, and that has to be said out loud each time it happens."**
D2 removed a feature. So say it out loud: name which tests went, confirm whether `splitFavorites` was
retired and what went with it, and record the removal in the floor note beside the new number. A
floor that quietly absorbs a removal is exactly the stale-authority problem prompt 82 just fixed.

### 1c. Then re-run and commit

All five gates as their own commands after 1a's shot is added (rule 26). Secret gate on ADDED lines
only, with `grep`. Stage by explicit path — `assets/` and `web/public/banner/tv-cutout-dark.png`
stay unstaged; the latter is Block E's.

Commit, then push `main`. Report the push and hand the deploy check to Joe; there is still no
programmatic Vercel check in this repo and none should be invented.

**Before pushing, confirm Block F's deploy actually went green.** Joe owns that check. If F's deploy
failed, stop and report rather than stacking D2 on top of a broken production build — that is the
whole reason F went out alone.

### What Joe checks on the device after this deploy

- The favourite mark on his own teams, in a mixed band, at real size and in daylight.
- A favourite that is off-service, if 1a found one — the case the shots could not settle.
- Still outstanding from Block F: **tap the MLB.TV link from inside MySports TV.** MLB app means F3
  is closed; Safari means `target="_blank"` is the next one-line test.

---

## 2. Then Block E

Read Block E from `docs/prompts/81-mlbtv-deeplink-favourite-mark-icon-v8-banner.md` and run it as
written — it already carries the three defects Cowork found in the original draft (`git mv` on an
untracked path, the untracked `tv-cutout-dark.png`, the stale `filters.title_glow` prose in both
JSONs) and the two traps (`next build`, rules 17 and 29 on the JSON edits).

Three things carried forward from F and D2 that apply directly:

- **Mutation-check every assertion, including enumerative ones.** F's enumeration test turned out to
  be sound only because it was checked; do not assume the next one is.
- **A DOM assertion is not a visual one.** 1a is the second time in two blocks that "the classes
  compose" and "the reader can see it" have come apart. When a change is about whether something
  reads, the artifact is a rendered shot with a measured delta, not a passing test.
- **`docs/handoff-status.md`'s floor table is correct as of D2's commit.** If E moves a gate, the
  table moves in E's commit.

End Block E with the work in the tree, all five gates reported, the banner routes confirmed by
reading the rendered SVG, and a diff. **Do not commit and do not push.**
