# Prompt 74 — three amendments to prompt 73, then commit

**Prompt 73's work is not committed and should not be until these land.** Same tree, same stage,
one commit at the end rather than a fix-up on top.

Gate floors: `pytest` 514 + 1 skipped · `test:unit` **506** (prompt 73 added 12 in
`bannerpin.test.mjs`) · `smoke` 33/33 · `qa-shots` 91/91 · `geometry` all hard stops. Stage 1 changes
the landing figures; **re-baseline them in `docs/handoff-status.md` after the last gate run.**

---

## STAGE 1 — `stackBottom()` counts an element that is not stuck

Prompt 73 reported it plainly and left it, correctly, as not its call:

> *"171.4 = 124 + 31.4 + 16, and the 31.4 is the picker's height — which `stackBottom()` counts even
> though the picker isn't stuck while expanded. So 47px of the previous day's card shows between the
> banner's rule and today's heading … Removing the term is one line and moves every day-mode landing
> with it, so I left it."*

**Remove it. This is a correctness fix, not a taste change, and the number it restores is Joe's own.**

`stackBottom()` exists to clear what the reader cannot scroll past. A picker that is in normal flow is
not that — clearing it reserves space for an obstruction that is not there. And the arithmetic gives
the game away: **124 + 16 = 140 is the landing, and 16px is exactly the buffer Joe ruled in prompt 69**
(`margin-block: 0 16px` on the collapsed picker, after he reported the league logo *"super tight to
the gold line"*). The extra 31.4 is not a design decision anybody made; it is a term that survived
prompt 71 removing the collapse that used to justify it.

**Do not special-case the expanded state.** Make `stackBottom()` count only the elements that are
ACTUALLY STUCK at the moment it measures, whatever `data-hdr` and `data-pin` happen to be. The
collapsed case must keep working — a navigation while the header is already collapsed is reachable —
and a rule written as "if expanded, skip the picker" will be wrong the first time a third state
exists. Say how you determined stuck-ness and verify it in both header states.

**Re-measure and re-baseline every figure prompt 73 reported** — all ten matrix rows, both landing
columns, and the two viewport measurements. `handoff-status.md` is the only home for them (rule 10).
Report the new `cards visible` figure: today's heading rising 31px should give back roughly the
partial card the pin cost.

---

## STAGE 2 — find the other tests that pass on `-1`

Prompt 73 found one, and the mechanism is general:

> *"`autoscroll.test.mjs`'s 'the header is collapsed BEFORE anything is measured' asserted
> `indexOf('collapseHeader();') < indexOf(...)`; prompt 71 deleted that call, `indexOf` returned −1,
> and −1 beats any index. Its guard matched the string inside the comment explaining the deletion."*

**A test that passes because the thing it looks for is absent is worse than a failing one** — it is
the probe fall-through from prompt 69 wearing different clothes, and it means prompt 71's green gate
was partly hollow.

**Sweep the suite (rule 32 — enumerate, do not sample).** Every assertion that reads source text and
compares positions or presence is a candidate: `indexOf` compared to another `indexOf`, `indexOf`
compared to a literal, `search`, `match` used as a boolean, and any guard that would be satisfied by
the string appearing inside a comment. **Report every hit with file and line, say which are sound and
why, and fix the ones that are not.**

**Fix them by making absence fail**, not by deleting them. A source-text assertion that cannot
distinguish "not found" from "found early" should assert the string is present first, then assert the
ordering.

If the sweep finds none beyond the one already fixed, **say so and name the searches you ran**
(rule 31) — a clean result from a query nobody can see is not evidence.

---

## STAGE 3 — settle the `qa-shots` question with matched samples

Prompt 73 was honest and stopped in the right place:

> *"nine runs with the change gave 7 at 91/91, two at 90/91 in the documented header-interaction
> cluster … I stashed the change and ran the gate four more times on the pre-change tree: 4/4. That's
> not a difference I can call."*

It is not callable at 9 against 4, and that is the only reason it is not callable. **Run the
pre-change tree to the same count** so the comparison is balanced, on the same clean machine, and
report both series as counts rather than a verdict.

This matters more than a flake normally would: the pin **re-arms on every navigation**, and one of
the two failures printed `?day=2026-09-05` — the URL had not changed — which is a navigation-timing
symptom. That is a plausible mechanism, not an established one. If the matched comparison still shows
no difference, record it in `handoff-status.md` beside the existing flake note and move on. If it
shows the pin makes it worse, **stop and report rather than tuning the gate.**

---

## THEN COMMIT

Once all three land and all five gates are green on the finished tree:

**One commit** covering prompt 73's eight files plus this prompt's changes, staged by explicit path
(rule 4, never `git add -A`; `assets/` stays untracked). Secret-gate on ADDED lines only, with `grep`
(rule 3). Gate and commit are separate commands (rule 26).

The tripwire must not move: CFB `2026-09-05` 64 / {240, 223, 205, 136} / 1273, MLB `2026-09-03`
3 / {228} / 567, NFL 17 / {264, 98, 73} / 1044.

Rule 23: prompt 73 extended `mobile_demo.html`'s note because a pin is a behaviour over time. Confirm
stage 1 does not change anything else that file implements.

**Report, then push on Joe's word** — he has already approved the direction, so report the
re-baselined figures, the sweep results and the matched `qa-shots` series, and ask once.
