# Prompt 79 — pay the owed gate fix, prove the bundle is clean, then finish C and D

Base: `48dc256` pushed (Block A). `1cd2f29` committed and unpushed (Block B). Block C built and
staged-ready, uncommitted. Block D not started. **`qa-shots` is 1 clean in 6 and that is a real
regression, not the documented flake.**

Read gate floors from `docs/handoff-status.md` before each stage (rule 10).

---

## STAGE 1 — the owed fix: wait on the condition, not a duration

`handoff-status.md` has recorded since prompt 66 that `qa-shots` waits a fixed duration and that the
real fix is waiting on the condition. **Block A made that owed debt come due**: client navigation
measured 808, 815, 862, 878, 961, 2597 ms against a fixed **900ms** wait — over budget on 2 of 6.

**Replace the fixed wait with `page.waitForURL` / `expect.poll`** on the condition each site actually
needs. **This is not loosening the gate.** A fixed duration asserts nothing; it guesses. Waiting on
the real condition is strictly stronger, and it is the change the file has been asking for.

**Enumerate every fixed wait in the gate and its probes, not just the one that bit** (rule 32) —
`scripts/qa-shots.mjs`, `smoke.mjs`, `geometry.mjs`, and everything under `scripts/probes/`. Report
each with file and line, say which are sound, and convert the rest. A `waitForTimeout` that happens
to pass today is the same defect not yet triggered.

**Set a timeout that fails, not one that hides.** A `waitForURL` with a 30-second ceiling still fails
when the app genuinely breaks; that is the point. Say what ceiling you chose and why.

**Then prove it.** Run `qa-shots` **nine times** on the current tree and report the series as counts.
Anything short of 9/9 means the fix is incomplete or there is a second cause — report rather than
average it away.

---

## STAGE 2 — prove no server-only module reaches the browser

Block A's first cause was real and is the more serious half: **`Listing` is a client component and
imported `applyOverlay` from `livescores.js`, dragging the provider-fetch module into the browser
bundle.** That is not a gate problem. It ships the ESPN, MLB and NHL fetch logic — timeouts, user
agents, source URLs — to every phone that opens the app.

Moving `applyOverlay` into `livepoll.js` "helped but didn't cure it." **Those are two different
worlds and one inspection separates them:**

- **More contamination** — another server-only module still crossing into the client. A real defect,
  and the residue is its symptom.
- **Ordinary dev overhead** — one more module in an unoptimised `next dev` build, invisible in
  production. Nothing to fix.

**Inspect the actual client bundle** and report every module from `web/lib/` that reaches it. Name
the method. For anything that should not be there, say why it crossed — a client component importing
it, a barrel re-export, a shared constant dragging its file's other exports.

**And measure production, not just dev.** Rule 12 forbids `next build` locally (the apostrophe in the
repo path), so if that blocks a production measurement, **say so and stop rather than reasoning about
what production would do** — a platform behaviour recalled rather than measured is exactly the class
that has been wrong repeatedly here (rule 34).

**Report the navigation series again after stage 1 and stage 2.** If the median has come back down,
say so. If it has not, that is a finding for Joe, not something to absorb.

---

## STAGE 3 — C4 reopened: MLB's AASA claims `/tv/g*`

Block C4 concluded the game-specific tier does not exist because `/gameday/*` is not claimed. **That
is right about `/gameday/` and may be wrong about the conclusion.** The claimed patterns are
`/magiclink`, **`/tv/g*`**, `/news/*` and `/live-stream-games/promotions/*`.

**`/tv/g*` reads like an MLB.TV game route.** If `mlb.com/tv/g<gamePk>` — or whatever shape follows
that `g` — is a real URL for a specific game, then it IS claimed, the app does take it over, and the
ceiling moves from "a game page in a browser" to the thing Joe actually asked for.

**Find out.** Take a real gamePk (block B established both sides genuinely build `mlb-<gamePk>`),
construct candidates against that pattern, **fetch them**, and report status and final URL for each.
If one resolves to that game, say so plainly — it changes what block C's Guardians link should be.

**Report only. Change no link in this stage.** If nothing resolves, the earlier conclusion stands and
should be recorded as tested rather than inferred.

---

## STAGE 4 — commit block C

Once stage 1 has `qa-shots` clean, commit block C as built: the `guardians-tv` URL, the link checker,
and `docs/research/watch-links-2026-09-09.md`.

**C3 already earned its keep** — it found `the-cw` returning 200 after redirecting to
`?sorry-page-not-found`. That is precisely the case a status-only check misses and the reason the
brief asked for the final URL. **Fix that entry too**, or record why it stays.

C2 needed no change and that is a result worth keeping in the commit message: `guardians-tv` is
`linear_cable` / LINEAR / available, and a real Guardians game already renders both links.

---

## STAGE 5 — block D, unchanged

Prompt 78's block D as written: `chronological()` learns the favourite term, the float comes out with
its dead code and its register entries, and the gold **outline** — not a border, for the measured
reason — with the focus-ring collision resolved or reported.

**Its line numbers predate blocks A and B. Locate by content** (rule 22).

---

## STAGE 6 — the process-cleanup rule

A cleanup filter matching `chrom` killed 23 of Joe's Chrome windows alongside Playwright's. It has
been fixed with a path-scoped filter and verified against `ms-playwright` binaries only.

**Write it down as a working rule in `CLAUDE.md`,** in the existing numbered style and with the
incident that earned it: process cleanup is scoped by PATH to the Playwright binaries, never by a
name match. A substring that matches a vendor's process name will match the user's application. This
is the second time a too-broad match has cost real work, and a rule is cheaper than a third.

---

## GATES AND COMMITTING

Five gates before each commit, each its own command, all reported (rule 26). **Stage 1's proof is
nine `qa-shots` runs, not one.**

Tripwire unmoved: CFB `2026-09-05` 64 / {240, 223, 205, 136} / 1273, MLB `2026-09-03` 3 / {228} / 567,
NFL 17 / {264, 98, 73} / 1044.

Rule 23 per stage, not one blanket line — stage 5 changes card decoration and list order, which
`mobile_demo.html` does implement.

Staged by explicit path (rule 4, never `git add -A`; `assets/` stays untracked). Secret-gate each on
ADDED lines only, with `grep` (rule 3).

**Push `1cd2f29` and everything after it only on Joe's word.** Report per stage and wait.
