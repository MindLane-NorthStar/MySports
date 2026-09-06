# MySports TV — how to work in this repo

A personal master sports calendar and TV grid for the Cleveland market. Next.js on Vercel,
Supabase Postgres behind PostgREST, a Python adapter/loader pipeline, and an archived desktop
renderer. Joe Lull directs the build as architect and PM; he is not a developer. Explain technical
trade-offs plainly, never dumb them down, and lead with the recommendation.

**This file is the standing brief. It is read automatically at session start so that a prompt does
not have to restate it.** When it disagrees with `docs/handoff-status.md`, that file wins and this
one is stale — say so.

---

## Read first

| you need | read |
|---|---|
| current repo state, gates, open items, the full working rules | `docs/handoff-status.md` |
| why a decision was made, and whether it is already settled | `docs/enhancement-register.md` |
| what a card, block or grid is supposed to look like | `docs/rendering-contract.md` + `docs/rendering-contract-mobile.md` (the Mobile Grid Addendum) |
| the locked visual reference the app must match | `docs/design/mobile_demo.html` |
| what a past run was actually asked to do | `docs/prompts/` — 55 files covering 01–53, verbatim; 39 and 42 are the only gaps |
| deploy, environment, what is publishable | `docs/deployment-contract.md` |

**Do not re-raise a settled decision** without first checking the register and `handoff-status.md`.
Many things that look like bugs are recorded rulings.

---

## Where work belongs

Three venues, and picking the wrong one is the most common waste.

**Claude Code (here) — the default for anything whose answer is in the repo.** Visual and layout
tweaks, sizes, spacing, colours, weights; bug fixes; tests; refactors; anything Joe can judge by
looking at his phone. He can ask for these conversationally in one sentence. Do not ask for a
written brief before making a small change — read the component, make it, report what moved.

**Cowork — when the answer is not in the repo.** Multi-stage unattended runs; measurement studies
across data the repo does not hold; contract archaeology ("does this contradict prompt 26?");
sourcing outside art or research; and writing the large staged prompts. Cowork can read the
Claude.ai Project and the laptop filesystem; this session cannot.

**Chat — planning and direction only.** It reads the Project but neither the repo nor the database.

If a request arrives here that genuinely needs Cowork, say so in one line rather than guessing.

---

## Working rules (binding)

Full text and the incidents behind each one are in `docs/handoff-status.md`. Numbering is frozen —
never renumber, even around the retired stub.

1. Certify the Python interpreter for Windows before running anything Python.
2. Never write to the repo while another Claude Code prompt is in flight.
3. Secret gate every commit, **ADDED lines only**, with `grep` — never `findstr`.
4. Stage by explicit path. Never `git add -A`.
5. Run the workflow; never Re-run it.
6. Database: additive over destructive; SELECT and paste first; close (`valid_to`), don't delete.
7. Unattended runs: self-committing stages, two-strikes-skip, hard stops only for a secret-gate hit,
   a destructive database operation, or a rejected push.
8. WUAB and RESN sources are never named.
9. Loader-written provider facts never become reconciled observations.
10. Check the register, the home-page decision record and `handoff-status.md` before re-raising a
    settled decision.
11. Cowork's bridge shell calls git with `--no-optional-locks`.
12. **`next build` cannot run locally** — the repo path contains an apostrophe (`Joe's Projects`)
    and Next interpolates it into a single-quoted string. Ruling: do nothing. Never set
    `experimental.useWasmBinary`. Standing caution: that apostrophe will keep breaking any tooling
    that interpolates paths into quoted strings.
13. A numeric threshold is measured against the **local background**, never a global corner sample.
14. The database hard stop is "no direct Postgres connection, no writer credential, no DML."
    PostgREST reads with the publishable anon key are the app's normal read path and always allowed.
15. `npm run test:unit` is `node --test "test/**/*.test.mjs"` — the glob stays quoted.
16. Colour tokens are read from `web/app/globals.css`, never retyped from a mockup.
17. Edit JSON data files **through a parser**, never line-based, and assert nothing but the intended
    key changed.
18. Team-name resolution is **exact match within sport** — never substring, never fuzzy. MLB
    canonical names are nickname-only, so cross-check a second key such as `abbreviation`.
19. Never issue an unbounded PostgREST select — it silently caps at 1,000 rows with no error. Use
    the paginating `restAll()`. Pin regression tests to the **call site**, never a row count.
20. Never edit a source file with a bare repeated string replace. Use line-anchored surgery or a
    parser, and assert only the intended region changed.
21. *(retired stub — kept so rules are never renumbered)*
22. **Before asserting what a component does, read the component and cite file and line — never the
    contract that describes it.** A contract says what a component SHOULD do; only the file says
    what it DOES.
23. When a change alters anything the locked reference implements, **`docs/design/mobile_demo.html`
    changes in the same commit.** A reference that lags the app stops being an authority.
24. A count computed on the Python side is no evidence the JS runtime agrees. Pin the runtime path.
25. **A prompt is done when the deploy is green and the device agrees, not when it commits.**
26. **The gate and the commit are SEPARATE COMMANDS.** The runner's exit code and its parsed counts
    decide — never the last command in an `&&` chain.
27. Check the schedule before a bulk database write, and never run two at once.
    `gh run list --workflow schedule_refresh.yml -L 1` is the answer; "it is the afternoon" is not.
28. A Python-side parse is no evidence GitHub Actions agrees. `tests/test_workflows.py` is the guard.
29. **A text write with no `newline=` produces different bytes on Windows than on the runner.** Any
    writer that can reach a tracked file passes `newline="\n"` or writes bytes.
    `tests/fixtures/*` is `-text` on purpose; the rule there is **disk bytes == index bytes**,
    asserted by `tests/test_fixture_bytes.py`.

30. **A note recording an absence is a timestamp, not a fact.** Before acting on "missing", "not yet
    filed", "no mark in the tree", "none exists" or "TBD", check the thing itself — and when the note
    turns out to be stale, correct the note **in the same commit as the work it misled you about**.
    Two instances in one run: `bignoon`'s "no mark in the tree" when the mark had existed for four
    days, and the prompt archive's deliberate "not yet filed" read as a permanent gap. A note ages;
    the tree does not.

---

## Gates

Four, and all four are run **before** the commit, as their own commands:

```
pytest                       # from the repo root — 466 pass + 1 skipped
npm run test:unit            # from web/ — 367
npm run smoke                # from web/ — 30/30
node scripts/qa-shots.mjs    # from web/ — 14/14
```

Counts are the floor as of `cdfae84`; they may only go up. Report all four with every change, and
never read a gate's result from the exit code of a chained command.

## The phone-grid geometry tripwire

Re-baselined by prompt 52 when `--rail-w` went 69px → 60px:

- CFB `2026-09-05` — 64 blocks / {240, 223, 205, 136} / scrollWidth **1273**
- MLB `2026-09-03` — 3 blocks / {228} / scrollWidth **568**

**Block counts and block widths moving is a hard stop.** scrollWidth moving is only expected when
the rail width itself changes, and then it must move by exactly that amount and be re-baselined here
and in the Mobile Grid Addendum.

---

## Committing

**Never commit or push without Joe's explicit approval**, and never during an unattended run except
where that run's own brief authorizes its stages to self-commit. Preserve intentionally
known-broken states rather than tidying them. `assets/` is always untracked and is not drift.

Commit messages are lower-case, and say what shipped rather than what was touched.
