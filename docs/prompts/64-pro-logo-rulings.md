# Prompt 64 — ship the pro logo rulings

**Venue:** Claude Code. **Shape:** one stage plus its guard.
**PUSH IS AUTHORIZED FOR THIS RUN.** Joe, 2026-09-08: *"please include in the prompt to commit AND
PUSH once complete."* This is a per-run authorization, not a change to the standing rule that nothing
pushes without his say-so. Push only after all five gates are green and the commit is made, and only
the commit this prompt creates.

Joe judged all 124 pro-league teams by eye on 2026-09-08, each on both grounds the app uses. His
rulings are already in the repo, written by Cowork before this prompt:
**`data/logo_conditioning.json`** — 101 `skip_derive`, 23 `derive`. Read it; do not retype it.

## Rules that bite

Rule 1 (certify Python), rule 2 (nothing else in flight), rule 3 (secret gate, ADDED only, `grep`),
rule 4 (stage by explicit path — `assets/` stays untracked and is not drift), rule 11
(`--no-optional-locks`), rule 17 (**edit JSON through a parser, never line-based**), rule 20,
rule 22 (read the code and cite file and line). Read the gate floors from `CLAUDE.md`.

## The five gates, each its own command, before the commit

```
pytest · npm run test:unit · npm run smoke · node scripts/qa-shots.mjs · npm run geometry
```

---

# The one thing that makes this harder than it looks

`scripts/build_web_marks.py:team_dark_variants()` was taught in prompt 61 that a `{id}_dark.png`
**byte-identical to its base is not provider art** — it is the absence of provider art wearing the
filename — and so it re-derives those. That rule is correct and must stay.

**A `skip_derive` team's dark file will be byte-identical to its base on purpose.** So the identity
test and the new ruling say opposite things about the same bytes, and the ruling has to win. If you
implement this by copying the raw file and leaving the identity test to run, the next build silently
undoes all 101 rulings and nothing fails.

Make the file the authority: a team listed in `skip_derive` is never subject to the identity test.
The mechanism is yours to choose — read the function first and cite what you find — but whatever you
pick has to survive `--make-dark` running on the GitHub runner every night with no arguments.

---

# Do

1. **Certify Python** (rule 1) and confirm the tree is clean apart from untracked `assets/`.
2. **Read `data/logo_conditioning.json` through a parser** (rule 17). Assert it holds 101 + 23 = 124
   ids, that the two sets are disjoint, and that every id has a matching `assets/logos/{id}.png` on
   disk. A ruling for a team whose art is missing is a defect in the file — stop and report rather
   than skipping it quietly.
3. **Teach `team_dark_variants()` the file.** Three behaviours:
   - `skip_derive` → the charcoal-context file is the raw art. Identity test does not apply.
   - `derive` → today's guarded derive plus the 0.5 lightness floor. No change.
   - listed in neither → today's behaviour, identity test included. **All 642 college teams are in
     this third group** and must come out of this run bit-for-bit unchanged. Prove that: hash
     `assets/logos/*_dark.png` before and after, and report that exactly 101 files changed.
4. **Idempotence.** Run it twice. The second run changes nothing. Say so with a number.
5. **A guard test that fails on the real regression.** Not "the file parses" — assert that after a
   build, a `skip_derive` team's dark file matches its base, and that a second build leaves it alone.
   That is the test that would catch the identity rule quietly winning.
6. **Report the visible effect on three teams Joe named as wrong**: Baltimore Orioles, Chicago Bears,
   Jacksonville Jaguars. Their ids are in the file. Say which list each fell into and what changed.

**Commit** the script change, the test, and `data/logo_conditioning.json` itself if it is still
untracked. `assets/` stays out (rule 4).

**Commit message:** `logos: joe's pro rulings decide what gets conditioned`

---

# Then three separate commands, in this order

Each is its own command. Never read any of their results from the exit code of a chain (rule 26).

**1. Push the commit.**

```
git --no-optional-locks push origin main
```

Authorized for this run. **A rejected push is a hard stop** — report it and change nothing else.
Confirm afterwards that `git --no-optional-locks log --oneline origin/main..HEAD` returns nothing.

**2. Push the art to R2.**

```
python scripts/sync_assets.py --push --prefix logos/
```

A write to R2, not a git push, and **this is the step that actually puts the change on Joe's phone** —
the app reads the bucket, and the git push only moves the code and the rulings. Report objects
uploaded and objects skipped as unchanged. **Expect roughly 101 uploads.** A number far from that
means step 3 did something wider than the rulings — say so rather than accepting it.

A transient `ConnectionClosedError` on the first attempt has happened twice before and cleared on a
retry; that is not a failure, but say it happened. If the push genuinely fails, the git commit is
still correct and safe on `main` — the bucket simply keeps the old bytes, nothing breaks, and one
command fixes it later. Report it and stop rather than improvising.

**3. Verify the bucket agrees.** Re-list and report unchanged / local-only / bucket-only. The
local-only count should be zero.

---

# Deliberately not in this run

- **The college rulings.** 634 of them exist and are not in the file yet. Cowork is testing whether a
  measurable property of the raw art predicts Joe's choices well enough to ship a threshold plus a
  short override list instead of a 634-row table. Until that lands, college keeps today's behaviour.
- **Inverting the default.** Cowork's call, and the reason is sequencing rather than preference:
  switching from derive-by-default to derive-by-exception changes behaviour for every team including
  the ones nobody has judged, and it should be decided once with all 766 rulings in hand rather than
  half of them. An explicit 124-team list costs nothing now and keeps the policy question separable.
- **The five undecided college teams** (134, 16, 2107, 2108, 2207) and the three split-by-context
  rulings (Wake Forest 154, Pacific Lutheran 2486, West Virginia 277). The split three need no
  per-team change — `lib/config.js:151` and `MobileGrid.js:631/670` already do raw-on-plate and
  derived-on-charcoal — but that should be verified, not assumed, in a later run.
