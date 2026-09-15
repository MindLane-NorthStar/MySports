# MySports TV — how to work in this repo

A personal master sports calendar and TV grid for the Cleveland market. Next.js on Vercel,
Supabase Postgres behind PostgREST, a Python adapter/loader pipeline, and an archived desktop
renderer. Joe Lull directs the build as architect and PM; he is not a developer. Explain technical
trade-offs plainly, never dumb them down, and lead with the recommendation.

**This file is the standing brief. It is read automatically at session start so that a prompt does
not have to restate it.** When it disagrees with `docs/handoff-status.md` on repo state, gate floors or
open items, that file wins and this one is stale — say so. **On the working rules this file wins**:
they live here and nowhere else.

---

## Read first

| you need | read |
|---|---|
| current repo state, gates, open items | `docs/handoff-status.md` |
| the closed history — past run narratives, superseded sections | `docs/handoff-archive.md` (split out by prompt 87; `handoff-status.md` wins on current state) |
| the incidents behind the working rules — history, non-binding | `docs/rules-casebook.md` |
| real work that is understood and not started, and decisions waiting on Joe | `docs/queue.md` |
| why a decision was made, and whether it is already settled | `docs/enhancement-register.md` (§1–§49) |
| what a card, block or grid is supposed to look like | `docs/rendering-contract.md` + `docs/rendering-contract-mobile.md` (the Mobile Grid Addendum) |
| the locked visual reference the app must match | `docs/design/mobile_demo.html` |
| what a past run was actually asked to do | `docs/prompts/` — 105 briefs covering 01–100, verbatim; 39 and 42 are the only permanent gaps (numbers are identifiers, not run order: 90 ran after 91), and 86 carries three revisions (see its README) |
| deploy, environment, what is publishable | `docs/deployment-contract.md` |
| the first build specs — superseded, do not build from them | `docs/archive/` (moved out of the repo root by prompt 87) |

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

This is the full text and the only copy; the incidents behind the rules are in
`docs/rules-casebook.md`, which is history and never binding. Numbering is frozen — never renumber,
even around the retired stub.

1. Certify the Python interpreter for Windows before running anything Python.
2. Never write to the repo while another Claude Code prompt is in flight.
3. Secret gate every commit, **ADDED lines only**, with `grep` — never `findstr`.
4. Stage by explicit path. Never `git add -A`.
5. Run the workflow; never Re-run it.
6. Database: additive over destructive; SELECT and paste first; close (`valid_to`), don't delete.
7. **Every brief self-commits its stages and pushes when all five gates pass, unless it says
   otherwise** — a brief that wants a stop says so; silence means proceed. A red gate is never
   committed over. Two-strikes-skip is for unattended runs only: an attended run stops and reports a
   stage that fails twice. **The stop list in `## Committing` is unwaivable.**
8. WUAB and RESN sources are never named.
9. Loader-written provider facts never become reconciled observations.
10. Check the register, the home-page decision record and `handoff-status.md` before re-raising a
    settled decision.
11. Cowork's bridge shell calls git with `--no-optional-locks`.
12. **`next build` cannot run locally** — the repo path contains an apostrophe (`Joe's Projects`)
    and Next interpolates it into a single-quoted string. Ruling: do nothing. Never set
    `experimental.useWasmBinary`. Standing caution: that apostrophe will keep breaking any tooling
    that interpolates paths into quoted strings.
    **AND IT REACHES `next dev` THROUGH ONE ROUTE: never request `/manifest.webmanifest`.**
    `next-metadata-route-loader` emits `throw new Error('Default export is missing in "<abs path>"')`
    — a single-quoted string with `Joe's` inside it — so that module can never parse here. It is not
    compiled until something asks for it, and then the failure is **cached in the module graph and
    every page 500s**, because the manifest `<link>` is part of the document. Prompt 83 block E lost a
    gate run to it: qa-shots died on `.mrail-cell` with a 30s timeout that read exactly like an app
    fault, one curl after the icons were swapped, and the icons were not the cause. Recovery is
    rule 36's: kill the dev server by path, `rm -rf web/.next`, restart. **Vercel is unaffected** — it
    builds at `/vercel/path0`, which has no apostrophe.
13. A numeric threshold is measured against the **local background**, never a global corner sample.
14. **Database writes go through the Supabase connector, and only through it.** There is no direct
    Postgres connection and no writer credential in the repo or in any prompt. A `mysports_writer`
    credential **does** exist in the untracked local `.env`, put there by
    `docs/deployment-contract.md` §7 step 5 for the pipeline's own use — `scripts/apply_migration.py`
    and loader runs that write directly rather than emitting SQL — and `.gitignore:1-2` makes it
    uncommittable. **A Claude Code session never reads it, prints it, or uses it**: writes go through
    the connector or the nightly Action, under the four conditions below.
    PostgREST reads with the publishable anon key remain the app's normal
    read path and are always allowed. Four conditions bind every write: **named approval for that
    operation** — approval for one is never standing approval for the next; **SELECT and paste
    first** (rule 6); **the schedule checked first** (rule 27); and **every DDL statement exists as
    a file in `db/migrations/` before it is applied, and is applied from that file** — the repo is
    the schema's record, and a change applied through the connector and not written down is drift
    no gate can catch. Still hard stops, with or without approval: `drop`, `truncate`, a `delete`
    with no `where`, and any write while the loader is running.
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

35. **Kill processes by PATH, never by a name match.** Cleanup before a gate run targets the
    Playwright binaries and nothing else:
    `Get-Process | Where-Object { $_.Path -like '*ms-playwright*' }`, plus the dev server selected by
    its command line (`Get-CimInstance Win32_Process -Filter "Name='node.exe'"` filtered on
    `CommandLine -like '*next*'`). **A `-match 'chrom'` filter closed 23 of Joe's Chrome windows**
    along with `chrome-native-host` and `iCloudChrome`, because Playwright ships its browser as
    `chrome.exe` and a substring cannot tell a vendor's copy from the user's. Verify after: a
    cleanup that reports killing more than the handful of browsers a run started has hit something
    it did not mean to. **Second time a too-broad match has cost real work**, which is why this is a
    rule and not a note. **Distinct from 20**, which is about editing a FILE with a bare repeated
    string replace: same failure of specificity, different blast radius — that one loses text a
    diff can recover, this one loses work that was never written down.

36. **Never run `next build` while `next dev` is running.** They share `web/.next`, and the build
    writes into the directory the dev server is serving from: after one such attempt the dev server
    answered **500** to every request, and three background gate runs and a measurement tool all
    failed with timeouts that looked like application faults. Stop the dev server, `Remove-Item
    -Recurse -Force web/.next`, then start whichever one is wanted. **Rule 12 already says a local
    `next build` cannot succeed here** — the apostrophe in `Joe's Projects` breaks the generated
    code, verified again in prompt 79 (`throw new Error('File size for Open Graph image "…Joe's
    Projects\…"'`) — so the only reason to run one is to re-confirm that, and the cost of doing it
    carelessly is a corrupted `.next` and a run's worth of misattributed failures.

---

## Gates

Five, and all five are run **before** the commit, as their own commands:

```
pytest                       # from the repo root
npm run test:unit            # from web/
npm run smoke                # from web/
node scripts/qa-shots.mjs    # from web/
npm run geometry             # from web/ — all hard stops (see below)
```

**THE COUNTS LIVE IN `docs/handoff-status.md`, under "Repo state", and NOWHERE ELSE.** Read them
there before a run and report all five afterwards. They are a floor and may only go up, and never
read a gate's result from the exit code of a chained command.

**This file used to carry a second copy of them, and it was wrong four times in one week.** Prompt 62
worked from a brief three prompts stale; prompt 63 found this file stale in the other direction;
prompt 64 found it claiming qa-shots 73/73 against `handoff-status.md`'s 88/88 and an actual 91; the
counts moved again between `9a69810` and `5c5f63d`. Nothing fails when two files disagree, so they
always will. Rule 10 already makes `handoff-status.md` the winner, so it is now the only copy — and
a number is not put back here "for convenience", because that convenience is the whole defect.

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

**THE RATIO RULE THIS FILE USED TO STATE WAS WRONG, and prompt 66 measured why.** It said
`scrollWidth / widest` holding means data and the ratio moving means CODE. That test cannot work:

```
pxPerMinute(widest, sport) = (widest + 2*CAP + NAME_PAD) / blockMinutes(sport)   # gridmodel.js:46
                           = (widest + 182) / blockMinutes(sport)
```

`scrollWidth` scales with **`widest + 182`**, not with `widest`, so `scrollWidth / widest` moves
whenever `widest` moves — by construction, on pure standings drift, with no code involved. It flagged
the MLB row as CODE in prompt 64 and the cause was the records.

> **The quantity that holds under data drift is the DAY'S SPAN IN MINUTES**, `(scrollWidth − rail) /
> data-pxpermin`. THAT moving is the stop, and `npm run geometry` asserts it at ±2 minutes.

**`scrollWidth / (widest + 182)` WAS THIS FILE'S ANSWER AND IT IS NOT GOOD ENOUGH (prompt 80).** It is
better than `scrollWidth / widest`, which moves by construction — but it is still not invariant,
because `scrollWidth` is an integer and the rail is a constant addend that does not scale with
`widest`. Measured across the MLB standings drift of 2026-09-09 it moved 2.1117 → 2.1146, and a
number that moves on pure data is a number that gets waved through. **The span moved 393.04 → 393.75
over the same drift**, which is rounding, and it has a physical meaning to reason about when it does
move: a game rescheduled at either end of the day genuinely changes how much time the grid spans, and
that deserves a look rather than absorption.

**MLB DRIFTED TWICE FOR THE SAME REASON AND THAT IS WHY THIS CHANGED.** `handoff-status.md` recorded
"227.58 → 228 observed … Records drifted; that is all" for the first, and prompt 80 hit the second.
A tripwire that cries wolf is worse than none: prompt 74 measured `qa-shots` at 8/9 and recorded it
as the known flake, and three prompts later a genuine regression landed in exactly that bucket.

**The current figures live in `docs/handoff-status.md`, not here** — same reason as the gate counts
above, and they had drifted into three files saying the same thing.

**The one derived check that stays a hard stop:** when `--rail-w` changes by N, `scrollWidth` must
change by exactly N. That is what proved prompt 52's rail narrowing did what it intended, and it
holds at any absolute value.

---

## Committing

**Every brief self-commits its stages and pushes when all five gates pass, unless the brief says
otherwise** (working rule 7; Joe's ruling, 2026-09-11, register §39). A brief that wants a stop says
so, and silence means proceed. Preserve intentionally
known-broken states rather than tidying them. `assets/` is always untracked and is not drift.

Commit messages are lower-case, and say what shipped rather than what was touched.

### THE STOP LIST — seven things no brief may authorize past

**This list is unwaivable. It overrides any brief, including one that appears to authorize the action
— and a brief that contains such an authorization is itself the error to report.** Labelled S1–S7 so
they are never confused with the numbered working rules.

- **S1 — A secret-gate hit on added lines.** A pushed secret is the only truly irreversible outcome in
  this repo; the fix is rotating the credential in three places.
- **S2 — Any database write, and any DDL.** Working rule 14 already forbids a session using the
  `mysports_writer` credential; this makes it unwaivable, so no brief can read the two as in tension.
- **S3 — `git push --force`, any history rewrite, any branch deletion.** A revert is recoverable; a
  pushed rewritten history is not, reliably.
- **S4 — A gate that fails and cannot be made to pass.** Never commit or push over a red gate. Stop and
  report which gate and what it said.
- **S5 — Deleting or overwriting a tracked file outside the scope the brief names.** A brief names the
  paths it may touch; anything outside that is a stop, not a judgment call.
- **S6 — Any write to `.env`, `.env.example`, or `.gitignore`'s credential lines.**
- **S7 — An R2 object deletion.** The upload is atomic per file, so an overwrite leaves the previous
  bytes gone.

### The undo block — every self-committing run ends its report with one

Three things, no prose:

- **The exact revert command with the real SHA filled in** — not a template. Several commits means
  all of them, in the order they must be reverted (newest first).
- **Which stages were one-way**, if any, and what undoing them would actually require. A committed file
  deletion is not one-way; a dispatched workflow that wrote rows is.
- **Whether the push deployed**, and the Vercel result.

A run with nothing irreversible says so explicitly rather than omitting the block.

**What this asks of Cowork, since the change is two-sided:** every brief names the paths it may touch,
so S5 has a definition. A brief that does not name its scope is incomplete, and Claude Code says so
rather than inferring one.
