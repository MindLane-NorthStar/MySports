# Prompt 85 — correct the ring's record, then commit and push Block E

Block E is approved. One record correction first, then the commit, then the push.

**Joe's explicit approval** covers committing Block E and pushing `main`. The tap-target ring is
**left exactly as it is** — no opacity change, no hover/focus gating. That is a decision, not an
omission, and §1 is where it gets written down.

---

## 1. The one thing that must not go into the record wrong

Block E4 re-tapered the glow tails, and the measurement is real: the ellipse discontinuities go
+1.96 → −1.00 and +2.84 → −0.23, and `ring-before-after.png` shows the boundary genuinely smoothing
at 6×. Keep the change. It removes a real artifact.

**But it is not the artifact Joe complained about, and the record must say so.** The ring he saw is
`.bn-tvtap::after` — `inset 0 0 0 1px var(--gold)` at `opacity: .26`, `border-radius: 10px`, on a rect
whose percentages compute to the TV image box to the hundredth. `the-ring-is-the-tap-target.png`
proves it: the overlay lands on the gold rounded rectangle exactly. Cowork has checked that artifact
and agrees.

So write it plainly, in `docs/enhancement-register.md` and wherever E4 is recorded:

- E4 removed a hard outer stop on the two warm radial glows. Measured, kept, worth having.
- **E4 did NOT remove the outline Joe reported.** That outline is the TV button's resting affordance
  from prompt 60, it is still on screen, and it is deliberately still on screen.
- Joe's ruling: **leave it.** It was read as a rendering artifact only because nothing in the banner
  says the television is tappable. Now that it is known to be an affordance it stays, and if it is
  revisited the question is whether it reads as *designed* — a ring that hugs the artwork rather than
  a 10px-radius box floating around it — not whether to dim it toward invisibility. Lowering the
  opacity makes it worse at both of its jobs, and hover/focus gating removes the resting cue entirely
  on a phone, where there is no hover and focus arrives only after the tap.

Three sessions reasoned about a rounded outline near a television without anyone rendering it and
pointing at pixels. **Put that in the register too** — it is the most transferable thing this block
produced, and it belongs beside rule 34 rather than only in a report.

## 2. One correction to the gate record

`process.exit(0)` was unconditional in the qa-shots runner, so **every prior `NODE EXIT=0` proved
nothing** — 91/91 and 94/94 included. The parsed counts were read in those runs, so no past result is
invalidated, but the record should say that qa-shots' exit code was uninformative until this commit.
Rule 26 says the runner's exit code **and** its parsed counts decide; for that gate, one of the two
was decorative, and the fix belongs in the same note as the discovery.

Add it wherever `docs/handoff-status.md` records the qa-shots history.

## 3. Commit and push

Stage by explicit path. `assets/` stays unstaged; `web/qa/` is gitignored and stays out.

Five gates as their own commands, unpiped, real exit codes, all five reported — the standard this
run set, which is now the standard.

Commit, then push `main`. Report the push and hand the deploy check to Joe; there is still no
programmatic Vercel check and none should be invented.

### What Joe checks on the device

- **The banner**: black screen, dark halo on the wordmark, and the glow edge. He has the shots; the
  device is the arbiter under rule 25.
- **The icon** — and this is the one that will look like a failure and is not. An installed PWA
  caches its icon, and the asset-version token does not reach `web/public/icon-*.png`,
  `web/app/icon.png` or `web/app/apple-icon.png`, because those are named by the manifest and by
  iOS rather than built by `config.js`. A v7 tile after a green deploy is expected. Say it in the
  report so it is not re-reported as a bug for the fourth time this month.
- **Still outstanding from Block F**: tap the MLB.TV link from inside MySports TV. MLB app means F3
  closes; Safari means `target="_blank"` is the next one-line test.

## 4. What Cowork got wrong, for the record

Prompt 84 asserted Block E's render was stale on the basis that `web/qa/p83final/mobile__today-all.png`
was byte-identical to `web/qa/p83/`'s. That was the wrong file: p83final was written at 19:38:58 and
the first banner edit landed at 19:54:38, so it is D2's run and is correctly identical.

**The mtime was in Cowork's own tool output and went uncompared** against the edit time; the run was
identified from a directory name and an assertion count instead. That is reading a label rather than
checking the thing, which is the failure this repo has four rules about. Record it in
`docs/handoff-status.md` beside the other Cowork corrections — the criticism underneath it was sound
and produced `bannerdom.mjs` and the mutation probe, but a right recommendation reached through a
wrong measurement is still a wrong measurement, and the next one may not land as well.
