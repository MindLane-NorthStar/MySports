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
| what a past run was actually asked to do | `docs/prompts/` — 61 files covering 01–59, verbatim; 39 and 42 are the only gaps |
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

31. **A search that finds nothing is evidence about the query, not about the repo.** Before reporting
    something absent, check you searched **the representation the file uses** — label vs slug,
    display name vs id, enum vs filter token, `+` vs `-plus` — and **name the search you ran**.
    `nfl-network` finds nothing in `access_profile.json`; `NFL Network` finds it, and did all along.
    **Distinct from 30:** there the note was stale, and "check the thing itself" fixes it; here the
    file was correct, it *was* checked, and the vocabulary was wrong.

32. **A ruling is not implemented until every place that renders the same thing obeys it.** Enumerate
    the renderers — `git grep` the CLASS, the COMPONENT and the CONDITION, not the concept — and make
    each obey or say why not. Prompt 55 put "grids only in grid view" into `Listing` while
    `PageCount`'s reveal kept serving cards under all four grid views; prompt 56 found three more of
    the same shape in one pass. **Distinct from 22** (which says read THE component — and prompt 55's
    reading of `Listing` was correct) **and from 30 and 31** (an absence, and a query's vocabulary):
    here every file was present and correct, and simply not the only file.

33. **A note asserting that something EXISTS is not evidence that it does.** Before relying on a
    workflow a comment describes — "regenerated from", "built by", "validated against" — open the
    thing it names. `Banner.js` said the mobile banner "is regenerated from" its JSON and that
    coordinates are "never hand-edited"; the generator was not in the repo, so that instruction had
    been unfollowable since prompt 42. `build_demo.py`, `app_template.html`, `build_banner.py` and
    `markkit.py` are the same shape — this repo has a CLASS of documented tools it does not contain.
    **Rule 30's mirror:** 30 fires on a note recording an ABSENCE and every trigger word in it is a
    negative, so it would never fire here. **Not rule 22:** the component WAS read; believing its
    claim about a tool somewhere else was the mistake.

34. **A platform behaviour recalled from memory is not evidence.** Before briefing a risk or a
    constraint that rests on what CSS, the DOM or a runtime *does*, check it — against the spec, or
    against a note this repo already wrote beside the code it governs, and say which. Cowork briefed
    a sticky page header as creating a containing block for the grid's sticky rail; it does not —
    only `transform`, `filter`, `perspective`, `backdrop-filter`, `will-change` and `contain` do,
    and `globals.css` said exactly that on `.mrail-cell` already. **Distinct from 22 and 33:** both
    of those point at this repository; this one's object is the PLATFORM, which no file here is
    authoritative for. Anything phrased "X creates/blocks/prevents Y" is the shape to distrust.

---

## Gates

Five, and all five are run **before** the commit, as their own commands:

```
pytest                       # from the repo root — 494 pass + 1 skipped
npm run test:unit            # from web/ — 431
npm run smoke                # from web/ — 30/30
node scripts/qa-shots.mjs    # from web/ — 25/25
npm run geometry             # from web/ — all hard stops (see below)
```

Counts are the floor as of `fa042c0`; they may only go up. Report all five with every change, and
never read a gate's result from the exit code of a chained command.

## The phone-grid geometry check

**Run it: `npm run geometry` from `web/`.** It splits the checks by what they are a function of,
because the old shape — absolute pixel figures as a hard stop — was wrong, and prompt 53 proved it.

**Why.** `MobileGrid` measures `widest` from the rendered team line, `${at}${rank} ${name} ${record}`,
and every block width and `scrollWidth` derive from it. So the pixels are a function of the schedule
(stable), the **records** (drift all season) and the **CFB poll ranks** (drift every Sunday). Prompt
53 found the MLB baseline had moved with *no code change at all*. Re-baselining resets a clock; a
tripwire that fires on the standings gets ignored, and an ignored tripwire catches nothing.

**HARD STOP — code-derived, immune to data:**

- block **count** per network row, **lane** count per row, number of network rows
- painted width == laid-out width at zoom 0.6 / 1.0 / 2.5 (the prompt-30 transform bug)
- rail delta **0.0px** at every zoom after panning fully right (M4)
- no block below the 46px floor; no team name wrapped or truncated
- **day/week equality** — a day inside a week must render geometry identical to that day in day
  mode. Immune to drift, because both sides see the same standings on the same run.

**REPORTED, not asserted — data-derived and legitimately drifting.** Block widths and `scrollWidth`,
recorded **with `widest` and the ratio** beside them. `.mgrid-canvas` carries `data-widest`,
`data-pxpermin` and `data-day` so this is one step:

> **`widest` moved and `scrollWidth / widest` held → that is the standings.
> The RATIO moved → that is CODE, and that is the stop.**

Current figures (2026-09-06, expected to drift):

| day | sport | blocks | rows | widths | `widest` | scrollWidth | ratio |
|---|---|---|---|---|---|---|---|
| `2026-09-05` | cfb | 64 | 15 | {240, 223, 205, 136} | 98.76 | 1273 | 12.8898 |
| `2026-09-03` | mlb | 3 | 2 | {226} | 84.65 | 564 | 6.6629 |
| `2026-09-13` | nfl | 17 | 3 | {264, 98, 73} | 122.72 | 1044 | 8.5069 |

**The one derived check that stays a hard stop:** when `--rail-w` changes by N, `scrollWidth` must
change by exactly N. That is what proved prompt 52's rail narrowing did what it intended, and it
holds at any absolute value.

---

## Committing

**Never commit or push without Joe's explicit approval**, and never during an unattended run except
where that run's own brief authorizes its stages to self-commit. Preserve intentionally
known-broken states rather than tidying them. `assets/` is always untracked and is not drift.

Commit messages are lower-case, and say what shipped rather than what was touched.
