# Prompt 125: One backstop cron, a private archive for failed runs, and the eligibility freshness guard

This builds on `d7a61bb` (prompt 121 rev B). **Stop and report if any of these checks fails:**

- `git rev-parse HEAD` equals `git rev-parse origin/main`, and both are `d7a61bb`.
- `git status --porcelain` shows only untracked `assets/` entries.
- `python scripts/remove_codex_agents_md.py` exits 0.

Written by Cowork on 2026-09-29 from a read of the tree at `d7a61bb`. **Verify every file:line before acting on it.** This brief carries three rulings Joe made on 2026-09-29, plus one queued build whose precondition has now been met.

---

## Joe's rulings, 2026-09-29

1. **The Worker's token has no expiration date. Joe keeps it that way.**
   - The token is fine-grained, scoped to this repo, and limited to Actions read and write. It cannot change code or read secrets.
   - A token that expires would bring back a silent-stop failure: the Worker's dispatch would fail inside Cloudflare, where nothing in this repo can see it.
   - The trade Joe accepted: a leaked token stays valid until he revokes it.
2. **Remove the 07:37 UTC cron.** That is the "3:37 a.m." line, `schedule_refresh.yml:32`.
   - The Worker's 4 a.m. dispatch is now the primary trigger, and the 11:37 UTC cron (`:33`) stays as the single backstop.
   - The Worker has dispatched every day since 2026-09-17. Its one failure (#66) was the minutes cap, not the Worker.
   - With Actions free, the reason to remove the cron is load on the providers and noise in the run list, not cost.
3. **Queue item 17: keep failed runs' payloads, privately, and stop publishing them.** Today the two copies of `artifacts/validation` behave differently:
   - **The private R2 copy** (`schedule_refresh.yml:341-342`) runs only when the job succeeds.
   - **The public `validation-*` artifact** (`:343-348`) runs on `always()`.
   - So on a failed run, the public artifact is the only record of what the providers sent. Joe's ruling: archive failed runs to R2 as well, then remove the public artifact, and delete the ones already published once each is confirmed to have a private copy.
   - **Cowork's read of the code, for the record** (inferred from the code, not measured on an artifact): nothing writes a credential into `artifacts/validation`.
     - `adapters/cfbd.py:13` and `:35` carry the CFBD key only in an `Authorization` header, and never write it.
     - `adapters/sd_listings.py` is dormant, and when active it writes to `runner.temp` (`schedule_refresh.yml` listings step), never to `artifacts/validation`.
     - The folder holds provider payloads, fixtures and reports, plus `render_all.yml:50` and `:64`'s database fixtures, which that job never uploads.

## Block A: the workflow (`.github/workflows/schedule_refresh.yml`, `tests/test_workflows.py`)

1. **Delete the `- cron: "37 7 * * *"` line (`:32`).** Keep `"37 11 * * *"`.
   - `tests/test_workflows.py:85-88` asserts that `schedule:` and `cron:` exist. It must still pass.
2. **Rewrite the comments that describe the triggers, so they match.**
   - The header (`:1-15`) says "The two crons … 07:37 and 11:37 UTC".
   - The block under `on:` (`:19-31`) says "TWO RUNS A DAY". Record Joe's 2026-09-29 ruling there: one backstop cron at 11:37 UTC, which lands at 7:37 a.m. EDT and at 6:37 a.m. EST from 2026-11-01.
   - Also rewrite the header's token sentence ("If its token expires …"): the token has no expiration, by Joe's choice. Say why.
3. **Failed runs archive privately.** Keep the success-path step at `:341-342` exactly as it is. Add a step directly after it that runs only when the job has failed or been cancelled (`if: failure() || cancelled()`). It pushes `artifacts/validation` with `scripts/sync_assets.py --push-data` under its own prefix, `fixtures/<UTC date>/failed-${{ github.run_id }}/`.
   - **Why a separate prefix:** a failed run must never overwrite a good run's archive for the same day. With a separate prefix the step only ever creates new keys, which keeps it clear of stop-list item S7.
   - **Check two edge cases in the code before relying on them, and report both:**
     - `--push-data` (`scripts/sync_assets.py:267-283`) is given a directory that does not exist, because the run failed before any adapter wrote. Say what it does. Cowork expects it to push 0 files and return 0, but has not run it.
     - Whether a step conditioned on `cancelled()` runs after a **job-level timeout**. Check GitHub's documentation (rule 34), and record what it says. Do not claim coverage the platform does not give.
4. **Remove the `actions/upload-artifact@v4` step (`:343-348`).**
   - Cowork searched for any reader of it and found none: no `download-artifact`, and no `gh run download` outside `docs/prompts/`.
   - `pipeline/load.py:187` writes `fixtures/{sport}/…` into `source_snapshots.storage_url` as a label. It does not read R2, and it does not depend on the date prefix.
5. **Tests, in the rule 28 style** (parse the YAML and walk to the step, as `tests/test_workflows.py:91` does):
   - exactly one cron, and it is `37 11 * * *`;
   - no `upload-artifact` step in any job of `schedule_refresh.yml`;
   - the failure-path archive step exists, its `if` covers failure and cancellation, and its prefix contains `failed-` and `github.run_id`;
   - the success-path archive step is unchanged.

   **Mutation checks:** for each new assertion, show it go red, then restore the file byte for byte.
6. Run all five gates, each as its own command. **Commit Block A and push `main` before starting Block B.** That way no later run can publish a new artifact after the old ones are deleted. **Do not dispatch the workflow.** The first run of the new file will be the Worker's, at 08:00 UTC tomorrow.

## Block B: delete the published `validation-*` artifacts, and only after checking each has a private copy (one-way)

1. List the repo's artifacts: `gh api repos/{owner}/{repo}/actions/artifacts --paginate`. Keep those named `validation-*`, and for each one record its id, its name, the run that made it, and whether that run's `refresh` job concluded `success`.
2. **Where the `refresh` job succeeded,** the private archive step ran. Confirm that the R2 data bucket has objects under `fixtures/<that run's UTC date>/`, using a read-only listing through `scripts/sync_assets.py` or its S3 client. Then delete that artifact: `gh api -X DELETE repos/{owner}/{repo}/actions/artifacts/<id>`.
3. **Where the `refresh` job did not succeed,** the public artifact may be the only copy. Download it, push it with `--push-data` under `fixtures/<date>/failed-<run id>/` (new keys only), confirm the upload, and only then delete the artifact. **If any step of that fails, leave the artifact alone and report it.**
4. Report a table with one row per artifact: id, name, run, refresh conclusion, private copy confirmed (yes or no), deleted (yes or no). **The deletions are one-way.** Name them in the undo block.

## Block C: queue item 16, the eligibility freshness guard in `smoke`

The specification is `docs/queue.md` item 16 (`:345`). Its precondition was met on 2026-09-29 (register §68, handoff-status). **Build it as the queue describes:**

- **The rule:** for the next 7 ET viewing days' games, no `viewer_game_eligibility` row (viewer profile 1) may be more than 26 hours older than the newest `last_seen_at` among that game's `game_broadcasts` rows. A game with broadcast rows and no eligibility row also fails.
- **Where it lives:** the reads go in `web/scripts/smoke.mjs`, through `restAll()` (`web/lib/rest.js:56`). Each read states how it is bounded, for rule 19's cap guard (`web/test/restcap.test.mjs`).
- **Confirm the anon role can read `game_broadcasts.last_seen_at` and `viewer_game_eligibility.computed_at` through PostgREST before you build on them.** If either returns 401 or omits the column, stop Block C and report. Do not use another credential.
- **Put the comparison in a pure function** in `web/lib/`, and unit-test it with fixture rows: one fresh game, one stale game, one game with broadcasts but no eligibility row, and one game with no broadcasts, which is out of the check's scope. That test is what makes the guard provable without a database write (S2).
- **Mutation checks:**
  - flip the comparison;
  - set the window to 0 hours, so live data goes red;
  - drop the missing-row branch.

  Each must go red in `test:unit` or `smoke`. Restore each one byte for byte.
- On live data today the guard should pass. Cowork's read-only query for 2026-09-29 to 10-05 returned 0 failing games.

## Block D: the record

- **`docs/deployment-contract.md`: a new version note in the file's style.** The newest note is v1.0.6; confirm that, and take the next number.
  - **The Worker row (`:122`) and the token paragraph (`:131`):** the token has no expiration, by Joe's choice on 2026-09-29, with the trade-off above. Remove "Joe to supply".
  - **The `schedule_refresh.yml` row (`:121`):** one backstop cron, 11:37 UTC.
  - **Record the archive change:** successful runs archive to `fixtures/<date>/`, failed runs to `fixtures/<date>/failed-<run id>/`, and nothing is published.
- **Register: the next free section, expected §69.** First confirm §1–§68 each appear exactly once. Record:
  - the three rulings and their reasons;
  - Block A's two edge-case findings;
  - Block B's table;
  - the guard, with its mutation results.
- **`docs/handoff-status.md`:**
  - Close the OPEN item at `:1183` (the token's expiry date) with the ruling.
  - Keep the 2026-11-01 item at `:1189`, and add that the one remaining cron shifts to 6:37 a.m. EST that day.
  - Record the gate line, and move the `smoke` and `test:unit` floors in the same keystroke, with the reason.
- **`docs/queue.md`:** close items 16 and 17 with dated pointers to the register section.
- **File this brief** byte for byte as `docs/prompts/125-one-backstop-cron-private-archive-freshness-guard.md`, copied from `Claude outputs\prompt-125-one-backstop-cron-private-archive-freshness-guard-2026-09-29.md`. Update the counts by their own convention.

## Out of scope

- The Worker, its token, its schedule and Cloudflare.
- `render_all.yml`, `bootstrap_season.yml` and `backup_schema.yml`, including its minute-0 cron.
- The success-path archive step's prefix and behavior.
- Any R2 deletion (S7). Block B deletes GitHub artifacts only.
- The FOX late-window question. E5 stands.

## Gates, commits, push

- Run the script first, then all five gates, each as its own command, against the floors in `docs/handoff-status.md` under "Repo state". **All five must be green before each push.**
- **Commit per block.** Block A commits and pushes before Block B. Blocks C and D commit separately and push at the end. Report each Vercel deployment.
- End with the undo block:
  - the real SHAs, newest first;
  - **Block B's deletions, as one-way:** the artifacts cannot be restored, and their private copies are the record;
  - the secret gate on the added lines of every commit.
