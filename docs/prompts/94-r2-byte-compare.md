# Claude Code — prompt 94: make the R2 sync compare bytes, using the ETag it already fetches

**Run in Claude Code**, in `C:\Users\jlull\Joe's Projects\Apps - Personal\MySports`, on `main`.

**RUN 4 rev C COMMITTED AS `a7a3ffe` AND DEPLOYED, so this brief's precondition is met.** (Revs A
and B stopped at their own stop conditions and never committed; rev C is the one that landed.) Rev C
edited `docs/queue.md`, `docs/handoff-status.md`, `docs/enhancement-register.md` and `CLAUDE.md`, and
so does this — working rule 2, so confirm nothing else is in flight before starting.

**One script, its new tests, and the record. No workflow change, no application code, no database
access of any kind.** The workflow change — caching `assets/` and narrowing what the nightly pulls —
is deliberately **not** here; it is brief 95, and it depends on what stage A measures.

**THIS IS AN UNATTENDED RUN** up to the stop in stage A. Self-commit and push under working rule 7's
default once stage A clears; stop for the stop list in `CLAUDE.md`'s `## Committing` and the list at
the end.

**Scope this brief may touch:** `scripts/sync_assets.py`, `tests/test_sync_assets.py` (new),
`docs/enhancement-register.md`, `docs/handoff-status.md`, `docs/queue.md`, `docs/prompts/README.md`,
`docs/prompts/94-r2-byte-compare.md`, `CLAUDE.md`. Nothing else. **`assets/` is not written by this
brief** — no `--push`, no `--pull`, no `--force`, no `--recache`.

---

## The defect, and why the fix is also the speed-up

`scripts/sync_assets.py:312-314` decides what to pull **by key alone**:

```python
for key in remote:
    if key not in local:
        to_pull.append(key)
```

A file the local cache already has is never re-downloaded, however far its bytes have drifted from
the bucket. The bucket is the source of truth per the deployment contract, so `--pull` is supposed to
make the cache match it and does not. Worse, the push half at `:308` *does* compare bytes, so the
next `--push` sees local ≠ remote and **uploads the stale local bytes over the newer object.** Art
reverts, no error, no gate, no log line that reads as a problem.

**Invisible on the runner today** because the cache is empty every night — measured in runs #15/#16/
#17 as `bucket mysports-assets: 1625 objects; local cache: 5 files … pulled 1620`, where the five are
the tracked fonts under `assets/fonts/`. **Live on any machine that keeps an `assets/`,** which is
Joe's laptop.

**The comparator is already in hand and thrown away.** `remote_objects()` at `:74-89` stores
`{"size": o["Size"], "etag": o.get("ETag", "").strip('"')}` for every key — and **nothing reads
`etag`.** For a single-part S3/R2 upload the ETag is the MD5 of the bytes, so a free field already
being fetched can answer "are these the same bytes" with **zero network calls**. That is why the
correctness fix and the speed fix are one change: `:308` currently falls through to `remote_sha()`
(`:92-96`, a `head_object`) on every size-matching file, which measured as 1,533 round trips to learn
that 0 files needed pushing.

**Working rule 34 applies: verify against R2 before building on it.** That is stage A, and it is a
hard gate.

---

## Preconditions

- RUN 4 rev C committed. `git status` clean apart from `assets/`. Report anything else.
- `HEAD == origin/main`; it was `a7a3ffe`. Say what it is.
- Five gates as the baseline, each its own command, each against the floor in
  `docs/handoff-status.md` under "Repo state" and nowhere else. **This brief quotes no gate number.**
- Working rule 1: certify the Python interpreter for Windows before running anything Python.
- `.env` is never read, printed or opened by you. `sync_assets.py` loads it at runtime through
  `load_dotenv`; that is the only route.

---

## Stage A — a read-only probe, and the gate the rest of the run hangs on

Write a throwaway probe under the scratch directory — **not** in `scripts/`, and do not commit it.
It may **list and HEAD** objects and **read** local files. It must not put, copy, delete or
download anything. State that constraint at the top of the file.

It answers three questions:

**A1. Is the ETag the MD5, on this bucket, for these objects?** Sample 25 keys that exist both in the
bucket and under `assets/` locally. For each, `head_object` gives the `sha256` user-metadata this
script writes on every upload. **Use only the keys where `metadata.sha256 == sha256(local file)`** —
those are the ones you know are byte-identical, so the test is not confounded by a stale cache. For
each of those, report whether `md5(local) == etag`.

- **If every known-identical file matches, the premise holds. Proceed.**
- **If any known-identical file does not match, STOP and report.** Include the key, its size, its
  ETag and the local MD5. The design is wrong and Joe needs to choose the fallback.
- Report separately how many sampled ETags carry a `-N` suffix. Those are multipart and are **not**
  MD5s; boto3's default `multipart_threshold` is 8 MB, so expect them only on large files. They are
  not a failure — they are the fallback case the code must handle.

**A2. What is actually in the bucket, by top-level prefix?** `FOLDERS` at `:36` is
`("logos", "network-logos", "fonts", "brand")`, but the bucket is known to hold at least `grids/`
(the `recache` docstring at `:138-172` says 35 of them), and `assets/` on Joe's machine also has
`league-logos/`, `program-logos/`, `p73-banner-pin/` and `_audit_tmp/`. **Print the object count and
total bytes for every top-level prefix**, and mark which prefixes `FOLDERS` covers.

This matters for the fix, not just for the record: `local_files()` only walks `FOLDERS`, so any key
outside them is **never** in `local` and would be re-pulled forever even after the comparison is
fixed — including grid files the `render` job produces in the first place. Stage B handles it by
deriving the destination path from the key rather than from `local`.

**A3. How big is `assets/`?** Total bytes and file count, local and remote. Brief 95 needs it to
judge whether an `actions/cache` upload costs more than the pull it replaces. **Report it; do not act
on it.**

Report all three before touching `sync_assets.py`.

---

## Stage B — the change

**B1. One helper, one place.** Add a function that answers "do the bucket's bytes match this local
file", taking the s3 client, bucket, key, local `Path`, and the `remote[key]` record. Its order:

1. Size differs → not the same. Free, no network.
2. ETag present, no `-` in it, 32 hex characters → compare it to the local file's MD5. **Free, no
   network.**
3. Otherwise (multipart ETag, or absent) → fall back to `remote_sha()` vs `sha256(local)`, exactly
   what `:308` does today. **One `head_object`, and only here.**

Write the reasoning above it in the register of the comments already in that file — in particular
that step 2 is the whole point and step 3 is the case that keeps it correct, because a reader who
deletes the fallback has silently broken large files.

**B2. The push side.** `:306-311` keeps its shape: `--force` and "not in bucket" still push
unconditionally and **`--existing-only` still refuses to create an object** — do not touch that
branch. Only the `elif` at `:308` changes, to call the helper.

**B3. The pull side, which is the defect.** Replace `:312-314` so a key is pulled when the local file
is missing **or** its bytes differ.

**Derive the destination from the key**, the way the pull loop at `:336-338` already does
(`root / "assets" / key`, which is what its `partition` produces) — **not** from the `local` map,
which `local_files()` limits to `FOLDERS` and which is why stage A2 exists. This is the difference
between fixing four prefixes and fixing the bucket.

**B4. Say what the operator is choosing.** Under the new comparison a key whose bytes differ belongs
in **both** lists: `--pull` takes the bucket's version, `--push` takes local's, and the flag is the
decision. That is correct and it is also newly possible to see, so:

- Keep the counts line at `:315` honest — `unchanged`, `local-only/changed`, `bucket-only` no longer
  describe the sets. Rename what needs renaming and add a **conflict** count for keys present on both
  sides with different bytes.
- In `--check` at `:318-323`, label conflicts distinctly rather than printing the same key under both
  "would push" and "would pull" with no explanation. `--check` is the mode a human runs to decide,
  so this is the output that matters most.

**B5. Do not change** `recache()`, `special_modes()`, `_put()`, `_extra_args()`, `CACHE_CONTROL`,
`--make-dark`, or anything about what gets uploaded. This brief changes **comparison only.**

---

## Stage C — tests, because there are none

**`tests/test_sync_assets.py` does not exist** — the `tests/` directory was listed on 2026-09-11 and
has no sync-assets file. You are creating it. The helper takes its s3 client as an argument, so a
stub object with a `head_object` method is enough; **no network, no credentials, no bucket.**

Cover at least:

- Same size, ETag equals local MD5 → same bytes, **and `head_object` was never called.** Assert the
  call count. That assertion is the performance fix; without it a later refactor can reintroduce the
  round trip and every test still passes.
- Same size, ETag differs from local MD5 → different bytes, no `head_object`.
- Different size → different bytes, no `head_object`, no MD5 computed.
- Multipart ETag (`"<hex>-4"`) → falls back, `head_object` called once, and the sha256 metadata
  decides.
- Missing or empty ETag → falls back.
- **The defect itself, as a regression test:** a local file that exists but whose bytes differ from
  the bucket is in `to_pull`. Name the test so its failure says what broke.
- A key outside `FOLDERS` that exists on disk at the derived path is compared, not blindly pulled.

**Mutation check, required:** for the "never called `head_object`" assertion and the regression test,
break the implementation deliberately, confirm each test fails, restore, confirm it passes. **Report
both directions.** An assertion that has only ever been seen green is not evidence.

---

## Stage D — the record

- **`docs/enhancement-register.md`** — a new section at **the next unused number; count and say which
  number you used.** Record the defect, that the ETag was already being fetched and discarded, stage
  A's measured answer including the prefix table, the multipart caveat, and the decision to leave the
  workflow alone until brief 95.
- **`docs/handoff-status.md`** — the open item rev C filed for this defect is now closed; close it
  rather than leaving it, and say what closed it.
- **`docs/queue.md`** — item 9 keeps its entry, but the sentence saying the cache cannot ship before
  the correctness fix is now satisfied. Update it to say the fix landed and what remains: caching
  `assets/`, and deciding whether the nightly should pull the whole bucket at all given A2.
- File this brief to `docs/prompts/94-r2-byte-compare.md`, verbatim. Update `docs/prompts/README.md`
  and `CLAUDE.md`'s prompt-count and register rows. **Count; do not increment.**

---

## Assertions

- `sync_assets.py` contains no `if key not in local:` in the pull path.
- The word `etag` is now read somewhere, not only written. `grep` it.
- `python -m pytest tests/test_sync_assets.py -v` passes, reported by name with its count.
- **The live read-only check:** run `python scripts/sync_assets.py --check` (no flags that write) and
  report the counts line and the conflict count. Compare the `head_object` volume to the 1,533 the
  nightly logged. **If `--check` now reports conflicts, do not resolve them** — report the keys; a
  conflict is a real finding about Joe's cache and his call to make.
- The five gates, each its own command, each against the floor in `docs/handoff-status.md`.

---

## Gates, then commit and push

All five, each its own command. Gate and commit are separate commands (rule 26). Then commit and
push, and report the Vercel result — this touches no web code, so the deploy should be a no-op
rebuild; say so rather than implying it proved anything.

**End with the undo block:** the revert command with the real SHA, and the honest note that **nothing
here is one-way** — no bucket object was written, no local asset was changed, no database row moved.
If `--check` surfaced conflicts, name them in the block as state that exists independently of this
commit and is not undone by reverting it.

**Do not dispatch any workflow, and do not run `--push`, `--pull`, `--force` or `--recache`.**

---

## When to actually stop

Only these. Everything else, decide and keep going, and log the call.

1. RUN 4 rev C (`a7a3ffe`) is not in the history.
2. `git status` is not clean apart from `assets/` at the start.
3. **Stage A1: any known-byte-identical file whose ETag is not its MD5.**
4. A mutation check does not fail when the implementation is broken.
5. A gate fails and cannot be made to pass.
6. Anything in `CLAUDE.md`'s `## Committing` stop list.

---

## Standing rules

- Working rule 2: never write to the repo while another prompt is in flight.
- Working rule 4: stage by explicit path; never `git add -A`.
- Working rule 3: secret gate on added lines, with `grep`, never `findstr`.
- Working rule 14: no database write; the `mysports_writer` credential is never read, printed or used.
- Working rule 30: check the thing, not the label — stage A exists because rule 34 says the same
  about R2 specifically.
- Gate floors: `docs/handoff-status.md` under "Repo state", nowhere else. This brief quotes none.
- `assets/` is a cache with five tracked fonts in it; R2 is the source of truth, and `assets/` being
  dirty is not drift.
- WUAB and RESN are never named. Credentials never enter the repo or a committed doc.
