# Prompt 44 — the banner's safe-area constant

**Run in Claude Code**, in `C:\Users\jlull\Joe's Projects\Apps - Personal\MySports` on `main` at `c1d9955` or a descendant (prompt 43's final HEAD; gates there: Python 232 + 1 skip, JS 251, smoke 30/30, qa-shots 14/14). One unit, one commit. Standing rules: stage by explicit path; `grep` secret gate on added lines; the gate is a separate command from the commit (run each runner alone, capture its exit code, parse its counts, then stage and commit in a separate command); push and print `git rev-parse HEAD` and `git rev-parse origin/main`. No `npm ci`. The repo is frozen for Cowork while this runs.

## Why

Prompt 43's report found it and left it alone because its brief said to: `web/app/globals.css:1678` reads `padding-top: max(0px, calc(env(safe-area-inset-top, 0px) - 18px))`. The `- 18px` is prompt 28's absorption constant — the old artwork carried ~18 px of internal headroom, so the inset was shortened by that much to keep the gap from doubling. Banner v2 carries **11 stage px** of headroom above the wordmark's first ink, and that 11 is not slack: it is the gap Joe set in the phone iteration 9 ("top gap between the status bar and the content halved, 22 → 11"), measured with the stage sitting directly under the status bar. The 21.8 % screen figure Joe approved was (47 + 155) / 926 — the full inset plus the stage. So the constant to absorb is **0**: at a 47 px inset the stage must start at y = 47 and the wordmark's first ink at y ≈ 58. Today the stage starts at 29 and the ink lands at 39–40, eight pixels up inside the status bar, on all three routes (prompt 43's 47 px-inset shots). Absorbing 10 instead of 18 would clear the clock by 1 px and throw away the gap Joe chose; it is not the fix.

## The change

1. `globals.css:1678` becomes `padding-top: env(safe-area-inset-top, 0px);` — no `max()`, no subtraction; `env()`'s fallback already yields 0 off-iOS. Rewrite the comment above it (the block ending at 1676 that explains "breathing room reused instead of doubled") to record the new fact: banner v2's 11 px headroom *is* the designed gap, so the wrapper adds the whole inset and absorbs nothing; cite this prompt. Nothing else in the file.
2. Re-shoot with the simulated 47 px inset (prompt 43's harness under `artifacts/qa/2026-09-04-banner/tools/`) on `/`, `/weeks` and `/history` at 390 and 428: the wordmark's first ink at **y = 58 ± 1 at 428 and 57 ± 1 at 390** (47 + the 11.0 / 10.0 px headroom prompt 43 measured), the padding band reading as the stage's top color (`#272727`), the seam with the tab row still 0 px, the banner element still 156.00 / 142.23. Shots into `artifacts/qa/2026-09-04-safe-area/`. With **no** inset (desktop and the plain phone shots) nothing changes — prove it: the five heights from prompt 43 re-measured and identical.
3. Gates: green, no fewer than the baseline above. Commit `banner: absorb nothing of the safe-area inset — v2's 11px headroom is the designed gap`. Push, print the rev-parse pair, report the deployment state for the new HEAD.

## Report

The before/after y of the first ink on each route, the six re-measured heights, the four gate counts, the sha, and anything in this prompt that turned out wrong.

**Then Joe's phone:** force-close the installed app, open Today — the clock and the wordmark should have clear space between them, about the height of the tagline; Weeks and History the same.
