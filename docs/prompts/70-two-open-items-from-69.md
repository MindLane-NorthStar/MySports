# Prompt 70 — the two open items from prompt 69

Small run. Two stages, independent of each other. Follows prompt 69's five commits.

Gate floors from `docs/handoff-status.md` (the only home, rule 10):

```
pytest                       # repo root — 514 passed + 1 skipped
npm run test:unit            # web/ — 483
npm run smoke                # web/ — 33/33
node scripts/qa-shots.mjs    # web/ — 91/91
npm run geometry             # web/ — all hard stops
```

Clear stray dev servers and chromium before the first gate run, and report what you started from.

---

## STAGE 1 — `grids/` gets its cache policy, and neither option in prompt 69's note works

Prompt 69 left `grids/` open and named two ways to close it: widen `FOLDERS`, or `--push-grids
--force`. **Verify this before you build anything, because I believe both are dead ends** —

- `local_files()` (`scripts/sync_assets.py:59`) walks `FOLDERS` (`:33`) over a local root, and the
  upload path is `s3.upload_file(...)` at `:134`. **Every route to an object needs a local file.**
- Prompt 69's own table says `grids/` is **35 in the bucket, 0 local**. Grids are rendered by
  `render_all.yml` on the runner, not on this machine, so `artifacts/rendering` is empty here.

So widening `FOLDERS` would walk a folder with nothing in it, and `--push-grids --force` would push
nothing. **Confirm both of those from the code and the disk rather than from this brief (rule 22),
and say what you found — if I am wrong about either, take the simpler route and skip the rest.**

### The mechanism that does work

**Setting a header on an object that already exists does not require the bytes to come from here.**
Add a mode that never reads a local file at all: list the bucket under a prefix, and for each key
already present, rewrite its `Cache-Control` in place. It works for any prefix, uploads no new bytes,
touches no local folder list, and **structurally cannot publish** — it only ever writes keys the
bucket already returned. That is a stronger guarantee than `--existing-only` has today, which gets
there by skipping.

Two implementations, in order of preference:

1. **`copy_object` onto the same key with `MetadataDirective="REPLACE"`.** One request per object, no
   data transfer. **DO NOT ASSUME R2 SUPPORTS THIS (rule 34).** I checked Cloudflare's S3
   compatibility page and could not confirm `CopyObject`'s feature status for metadata replacement.
   Verify it against `https://developers.cloudflare.com/r2/api/s3/api/` **and** with one real call on
   one object before building the loop.
2. **If (1) is unsupported: round-trip the bytes.** `get_object` the key to a temp path outside the
   repo, `upload_file` it back to the same key with the cache `ExtraArgs`, delete the temp. Slower,
   35 objects, and equally incapable of creating anything new.

Say which one you used and why.

### Then run it and report

Over `grids/` — and re-run it over `logos/`, `network-logos/`, `brand/` and `fonts/` as a
verification pass, since it should find those already correct and report zero changes. Per prefix:
objects seen, objects rewritten, objects already correct. Spot-check one `grids/` object's
`CacheControl` before and after.

**Nothing may be created.** Prove it: the object count under each prefix is identical before and
after.

---

## STAGE 2 — the probes are untracked, and that is the actual finding

Prompt 69 fixed `s0-gaps.mjs` and `s3-spacing.mjs` — both still led with `.fband`, deleted in prompt
67, **falling through silently** — and then discovered the fixes could not be committed: `.gitignore:7`
ignores `web/qa/`, so all 84 probe tools in `web/qa/tools/` are untracked. Those two fixes exist on
Joe's disk and nowhere else.

**Read `.gitignore` lines 5–7 before deciding anything here.** The pattern sits under the comment
*"generated validation/rendering artifacts (regenerable; fixtures promoted to tests/ when needed)"* —
and that is a correct reason for screenshots and dumps. It is not a correct reason for 84
hand-written measurement tools, which are neither generated nor regenerable. **The directory's
contents outgrew the rule that ignores it.** That comment also names the remedy the repo already
uses: promotion.

### 2a — promote the probes that are still reached

`web/scripts/` is tracked and already holds the four gates. A probe whose numbers get quoted into
`handoff-status.md` or a contract has to be reproducible from a clone; one that lives only on one
laptop is not.

**Enumerate rather than judge (rule 32).** `git grep` the probe filenames across `docs/prompts/`,
`docs/handoff-status.md`, `docs/rendering-contract*.md` and the register, and promote into a tracked
`web/scripts/probes/` every probe **any prompt from 55 onward actually names**. Report the
enumeration — the search you ran (rule 31) and the list it returned — before moving anything.
Everything it does not return stays where it is: closed-prompt archaeology, correctly ignored.

Then narrow `.gitignore` so `web/qa/` still ignores generated output, and fix that comment so it
describes what the directory now holds.

**Move with `git mv`-equivalent care: the files are untracked, so this is an add, and the originals
should not be left behind as duplicates that can drift.**

### 2b — a probe that cannot find its landmark must fail loudly

One shared helper in the promoted directory: takes a selector, returns the element, **throws naming
the selector** when nothing matches. Export it; no inlined copies. Apply it to the promoted probes.

A probe that keeps producing numbers after its landmark disappears is worse than one that fails,
because prompts quote those numbers into contracts — which is exactly what `.fband` did between
prompt 67 and prompt 69.

### 2c — the stale-selector sweep

Prompts 55–69 deleted classes. **Enumerate what was actually removed from `web/app/globals.css` in
that commit range by reading the diffs** — do not work from a remembered list. Then grep every probe,
promoted or not, for each one and report file and line for every hit. Fix the hits in promoted
probes; for hits left in untracked archaeology, say which and why.

Carry prompt 69's two `.fband` fixes into the promoted copies so they finally land in the repo.

No test pins these; they are tools, not gates. **If the guard makes a probe throw, that is the bug
being found — report it rather than softening the guard.**

## GATES AND COMMITTING

Five gates, each its own command, all five reported, before any commit. Never read a gate's result
from the exit code of a chained command (rule 26).

Neither stage touches rendering, so the phone-grid tripwire must not move: CFB `2026-09-05`
64 / {240, 223, 205, 136} / 1273, MLB `2026-09-03` 3 / {228} / **567** (`handoff-status.md` is the
home for these; do not copy them anywhere else). If anything moves, stop and report.

Rule 23: neither stage changes anything `docs/design/mobile_demo.html` implements. Say so explicitly
in the commit rather than leaving the check unmentioned.

Two commits, one per stage, staged by explicit path (stage 2 adds previously untracked files — name every path) (rule 4, never `git add -A`; `assets/` stays
untracked). Secret-gate each on ADDED lines only, with `grep`, never `findstr` (rule 3). Gate and
commit are separate commands.

**Do not commit or push without Joe's explicit approval.** Report and wait.

Write the gate floors into `docs/handoff-status.md` after the last gate run, not during it.
