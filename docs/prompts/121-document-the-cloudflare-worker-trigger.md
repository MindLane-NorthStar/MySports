# Prompt 121 rev B: The refresh trigger is documented, and the repo is public

**This replaces the 2026-09-23 brief, which was revised on 2026-09-28.** Three things changed on 2026-09-29:

- The repo went public, which let Cowork measure the trigger directly.
- Rev A's daylight-saving paragraph turned out to be wrong for this Worker.
- Prompt 124 took register §67.

This builds on `b8b0ec6` (prompt 124). **Stop and report if any of these checks fails:**

- `git rev-parse HEAD` equals `git rev-parse origin/main`, and both are `b8b0ec6`.
- `git status --porcelain` shows only untracked `assets/` entries.
- `python scripts/remove_codex_agents_md.py` exits 0.

**Scope: documentation and comments only.** Change no workflow step, no code, no schedule and no secret. Written by Cowork on 2026-09-29 from three sources: a read of the tree at `b8b0ec6`, GitHub's public API, and read-only SELECTs. **Verify every file:line before acting on it.**

---

## What Cowork found

### 1. The 4 AM refresh is a `workflow_dispatch`, and it has fired every day since 2026-09-17

Now that the repo is public, GitHub's API answers without a login. Cowork called `GET /repos/MindLane-NorthStar/MySports/actions/runs` on 2026-09-29 and kept only the `schedule_refresh` runs:

- **One `workflow_dispatch` run was created every day from 2026-09-17 (run #28) to 2026-09-29 (#66), each between 08:00:10 and 08:01:26 UTC.** All were triggered by `MindLane-NorthStar`. 08:00 UTC is 4:00 AM EDT.
- **No dispatch appears at 09:00 UTC on any day.**
- The two crons (`schedule_refresh.yml:20-21`, 07:37 and 11:37 UTC) produced `schedule` runs created between 12:02 and 17:10 UTC. That is the lateness §46 measured, unchanged.
- So from 2026-09-17 the refresh ran **three times a day**: the dispatch plus both crons.

### 2. What the Worker is, as Cowork recorded it on 2026-09-22

None of this is visible from the repo.

- **It is Joe's Cloudflare Worker,** in his personal Cloudflare account, which is not the account that holds R2.
- **Cron `0 8,9 * * *` UTC.** The handler reads the Cleveland clock and dispatches only when it is 4 AM there. So it fires **once a day at 4 AM Eastern, year round, with no edit needed at the daylight-saving change.** The measured absence of any 09:00 UTC dispatch during EDT is consistent with that guard. 2026-11-01 is its first real test: from then on, the dispatch should appear at 09:00 UTC.
- **Two Worker secrets:**
  - `GITHUB_TOKEN`: a fine-grained personal access token scoped to this repo, with Actions read and write.
  - `TEST_KEY`: guards a manual-test endpoint that dispatches on demand.
- **Its source is not version-controlled.** It exists only in the Cloudflare dashboard.

**Rev A was wrong here.** It said an 08:00 UTC trigger "fires at 3:00 AM EST after 2026-11-01". That is true of a bare cron, not of this Worker. Do not write it.

**Two things stay out of the repo on purpose, now that it is public:** the Worker's URL (which is also the manual-test endpoint), and the identity of the Cloudflare account. **One thing only Joe can supply:** the token's expiry date.

### 3. The repo was private until 2026-09-29, and that is why the refresh stopped

**It was private.** `docs/deployment-contract.md:115` says "private repo", and it was right. Without a login, GitHub's API returned 404 for the repo at about 11:35 UTC on 2026-09-29. By 15:40 UTC, after Joe switched it, it returned `"visibility": "public"`.

**The account's 2,000 included Actions minutes ran out on 2026-09-28, at about 19:00 UTC.** The runs show it:

- Run #65 (`schedule`, created 18:43 UTC) wrote its refresh rows until 18:59 UTC, then ended `failure` at 19:01.
- Run #66 (the 4 AM dispatch on 09-29) and #67 (`schedule`, 14:18 UTC) each ended `failure` within six seconds of being created. No job started.
- The app's data was frozen from about 3 PM ET on 09-28 until Joe's manual run #68 on 09-29 (15:24–15:43 UTC, `success`).
- #69 (`schedule`, 17:00 UTC) also succeeded.

**Why the minutes ran out.** Since 09-17 the refresh has run three times a day. At §47's recent median of about 22 minutes a run, that is about 66 minutes a day. GitHub's billing page showed MySports at $8.28 gross for September. At GitHub's published rate of $0.006 a minute, that is **about 1,380 minutes, 69 % of the allowance.** That minute count is derived from the dollar figure; GitHub did not publish it. Another private repo on the account used most of the rest.

**What the switch changed.** GitHub documents that Actions on standard GitHub-hosted runners are free for public repositories. So none of these limit this repo any more:

- §5's budget paragraph (`deployment-contract.md:126`)
- D7 (`:19`, "in the private repo (2,000 free minutes/month …)")
- §47's projection

**A new constraint that comes with being public:** GitHub disables scheduled workflows in a public repository after 60 days with no repository activity. The Worker's dispatch is not a schedule, so it is unaffected. The two crons and the Sunday cron in `backup_schema.yml` are affected.

**What any signed-in GitHub user can now see:**

- run logs
- each run's step summary, which includes the watch-links table
- the 14-day `validation-*` artifact that `schedule_refresh.yml:332-337` uploads, which carries raw provider payloads

Secrets stay masked. Before the switch, Cowork ran gitleaks over all 386 commits on every ref. It found no credential of Joe's. The hits were:

- Supabase anon keys, which are publishable by design
- placeholders in `.env.example`
- tokens embedded in public wwe.com and indycar.com pages that were saved as test fixtures

### 4. Prompt 123's OPEN item is answered (`docs/handoff-status.md:1146`)

From read-only SELECTs on 2026-09-29:

- The first refresh after the push (09-28, `github_sha` c561ba2) logged `eligibility_only` **819** and `eligibility_changes` **14** in its reconcile row. The forecast was about 802 and 14.
- `docs/queue.md` item 16's query, run for viewing days 2026-09-29 to 2026-10-05, returns **0** games. It returned 34 before the push.
- 2026-10-04's NFL CBS/FOX rows carry the verdict their access says:
  - `linear cbs|fox` where the row is `available`
  - not eligible where it is `out_of_market`
  - market pending only on the one `unverified` row (MIA @ MIN, 4:05 PM, FOX)

## Block A: measure, then write

1. **Re-measure the trigger with `gh`.**
   - Run `gh run list --workflow schedule_refresh.yml --limit 60 --json databaseId,number,event,createdAt,conclusion`.
   - For two of the 08:00 UTC runs, run `gh api repos/{owner}/{repo}/actions/runs/<id> --jq '.event,.triggering_actor.login,.actor.login'`.
   - Say whether this confirms or corrects Cowork's section 1.
   - **If `gh` is not authenticated, stop Block A and report.** Do not ask for a token.
2. **Measure visibility:** run `gh repo view --json visibility,isPrivate` and record the answer.
3. **Update `docs/deployment-contract.md`, with a new version note in the file's own style.** The newest note Cowork found is v1.0.5 at `:179`; confirm that, and take the next number.
   - **§5's heading** (`:115`) states the visibility `gh` measured, not "private repo".
   - **Add a trigger row for the Worker to §5's table.** It holds:
     - what was measured: the time in UTC, the event and the actor;
     - what Cowork recorded: the `0 8,9 * * *` cron and the Cleveland-clock guard, the two secret names and what the token may do, and the fact that a manual-test endpoint exists;
     - **"Joe to supply: the token's expiry date."**

     State that the Worker's URL and account are deliberately not recorded because the repo is public. **No URL and no email address in any file.**
   - **The `schedule_refresh.yml` row** says the Worker is the primary daily trigger and the crons are the backstop. Keep its daylight-saving note for the crons, and add that the Worker needs no edit.
   - **The token-expiry risk:** if the token expires, the Worker's dispatch fails where the repo cannot see it. Only the crons would remain, and those are measured hours late (§46).
   - **The budget paragraph** (`:126`) and **D7** (`:19`): Actions minutes are free for this repo since 2026-09-29 because it is public. Keep the measured run length, since it still matters for wall-clock time. Say the 2,000-minute projection is now history, and give the 09-28 exhaustion as the reason the repo changed.
   - **The 60-day rule** for scheduled workflows in a public repo, and that the Worker is not affected by it.
4. **Rewrite the header comment of `.github/workflows/schedule_refresh.yml`, comments only.**
   - Lines 1-4 still say "DAILY 11:00 UTC … One refresh a day". That has been false since prompt 97.
   - Rewrite the header to name the Worker's 4 AM dispatch as the primary trigger and the two crons as the backstop.
   - **Prove it is comment-only:** the YAML parses to the same object before and after, the `on:` block is byte-identical, and `tests/test_workflows.py` passes.
5. **Write the register entry at the next free section.** First confirm every earlier section appears exactly once. Prompt 124 took §67, so expect §68, and say which you used. Record sections 1–3 of this brief:
   - the trigger measurements
   - the Worker as Cowork recorded it
   - rev A's daylight-saving error and its correction
   - the minutes running out, with the timeline and the derived share
   - the switch to public, and what it changed and exposed
6. **Update `docs/handoff-status.md`:**
   - Close the OPEN item at `:1146` with section 4's numbers, dated, in the file's usual closed-item style.
   - Add an OPEN item: *Joe supplies the Worker token's expiry date.*
   - Add an OPEN item: *On 2026-11-01, confirm the Worker's dispatch moves to 09:00 UTC.* That is the guard's first run across a time change.
   - Record the gate line in "Repo state" as usual.
7. **Update `docs/queue.md`:**
   - Item 16's "When." (`:379`): say its precondition was met on 2026-09-29 (section 4), so the item can now be built.
   - Add a new item, written as **a description of a problem, not an approved plan.** The `validation-*` artifact (`schedule_refresh.yml:332-337`) duplicates the private-bucket archive at `:330-331`. Since 2026-09-29, any signed-in GitHub user can download it. Whether to keep it is Joe's call.
8. **File this brief** byte for byte as `docs/prompts/121-document-the-cloudflare-worker-trigger.md`, copied from `Claude outputs\prompt-121-rev-B-worker-trigger-and-public-repo-2026-09-29.md`. Update the counts by their own convention.

## Out of scope

- Any change to a schedule, a workflow step, the Worker or a secret. Removing the 3:37 cron and removing the `validation-*` artifact are Joe's calls, and this brief makes neither.
- Any Cloudflare API call, and any claim about the Worker beyond what this brief records.
- The repo's visibility.

## Gates, commit, push

- Run the script first. Then run all five gates, each as its own command, against the floors in `docs/handoff-status.md` under "Repo state".
- **Commit on green, then push `main`** (rule 7), and report the Vercel deployment. Do not dispatch the workflow.
- End with the undo block: the real SHA, what was one-way, and the secret gate on the added lines. **No file may contain a token value, the Worker's URL, or an account email.**
