# Prompt 120: The Codex copy of CLAUDE.md is identified by its cause and removed on sight

This builds on `3938a57` (prompt 119, pushed and READY on Vercel). Before starting, confirm three things. If any check fails, stop and report.

- `git rev-parse HEAD` equals `git rev-parse origin/main`.
- The log's top commit is `3938a57` (prompt 119, which landed as a single commit).
- `git status --porcelain` shows only untracked `assets/` entries.

Written by Cowork on 2026-09-23 from a read-only look at Joe's `C:\Users\jlull\.codex` folder (granted for this purpose) and a read of the tree. **Verify every file:line you touch.**

---

## What Cowork found: the cause, measured

The stray root `AGENTS.md` (register §49, and `tests/test_agent_instruction_files.py`) is written by **the Codex desktop app's "import from Claude Code" sync**. It is not a stray write from another project, which is what the test's docstring and failure message currently say.

- **The setting is on for every item.** `C:\Users\jlull\.codex\config.toml`, under `[desktop]`, carries `external-agent-import-sync-enabled = true` and `external-agent-import-sync-item-types = "all"`. The app's persisted state (`.codex-global-state.json`, key `external-agent-import-sync-state`) records provider `claude-code` with the selection `projects: true, chats: true`, plus plugin migration.
- **`AGENTS.md` is one of the item types it imports.** The Codex app-server binary, `.codex\plugins\.plugin-appserver\codex.exe`, lists the migration item types as `AGENTS_MD, CONFIG, SKILLS, PLUGINS, MCP_SERVER_CONFIG, SUBAGENTS, HOOKS, COMMANDS, MEMORY, SESSIONS`.
- **The timing matches.** Codex's log (`logs_2.sqlite`) covers 2026-09-14 20:00 UTC to today. It records `externalAgentConfig/import` runs at 2026-09-17 23:47, 2026-09-20 01:34 and **2026-09-23 16:26:17 UTC**. Today's `AGENTS.md` was created at 16:26 UTC, the same minute.
  - **The first arrival (§49) fits too.** It was written at 2026-09-14 20:00:15 UTC, two minutes after the Codex desktop app's `.desktop-created` marker (19:58:19 UTC), which is its first-run import.
  - **The 2026-09-16 arrival has no matching import in the retained log.** Record it as unexplained, not as explained.
  - **The 09-17 and 09-20 imports wrote no new file** because a copy was already there (it stood from 09-16 until 09-22). That is consistent, but inferred.
- **What each copy is.** Each one is `CLAUDE.md` as it stood when the import ran, with `Claude Code` → `Codex` and `Claude.ai` → `Codex.ai` and nothing else (§49 measured this, and prompt 119's report measured today's copy against `5dc2087`).

**Joe's ruling, 2026-09-23:** keep Codex's import of his Claude Code conversations, and stop `AGENTS.md` from blocking runs. Claude Code should handle this on its own.

---

## Block A: remove a verified Codex copy, and nothing else

1. **Add a script, for example `scripts/remove_codex_agents_md.py`.** When a root `AGENTS.md` exists, it compares the file against the Codex rewrite of every `CLAUDE.md` version in the last 50 commits on `HEAD` (`git log -50 --format=%H -- CLAUDE.md`, then `git show <sha>:CLAUDE.md`), plus the working-tree `CLAUDE.md`. The rewrite is: `Claude Code` → `Codex`, then `Claude.ai` → `Codex.ai`. Handle line endings as the bytes actually are, and say what you found.
   - **Byte-identical to one of them:** delete the file. Print one line naming the matching `CLAUDE.md` commit, the file's size, sha256 and mtime. Exit 0.
   - **Not identical to any of them:** do **not** delete. Print what differs, pointing at the nearest candidate, and exit 1. Anything else in that file is unknown, and unknown files are Joe's to judge.
   - **No `AGENTS.md`:** exit 0 silently.
2. **Joe's standing authorization.** Put this in `CLAUDE.md`'s working rules as a one-line amendment to the rule governing the pre-check: *"A root `AGENTS.md` that `scripts/remove_codex_agents_md.py` verifies as the Codex desktop app's copy of `CLAUDE.md` is removed by running that script before the gates; Joe authorized this 2026-09-23 (register §65). An `AGENTS.md` the script does not verify is a stop."*
   - The deletion goes through the script, never a bare `rm`, so the permission classifier sees one named, repeatable command.
   - If the classifier still refuses it, say so, and name the exact allow entry that would permit this one command. **Do not edit any settings file.**
3. **`tests/test_agent_instruction_files.py`: the guard stays red while the file exists.** This prompt does not weaken it. Rewrite the docstring's and failure message's "known cause" to the measured cause above, and tell the reader to run the script first.
   - **No allowlist, and no gitignore** (§49 stands).
   - The other five foreign names stay as they are.
4. **Tests.** Add them for the script, using temp git repos:
   - an exact Codex rewrite of the current `CLAUDE.md` → deleted;
   - an exact rewrite of a `CLAUDE.md` three commits back → deleted;
   - one extra line → kept, exit 1;
   - a rewrite that missed the `Claude.ai` swap → kept, exit 1;
   - no file → exit 0.
5. **Mutation checks:**
   - compare against the working tree only;
   - skip the `Claude.ai` swap;
   - delete on mismatch;
   - exit 0 on mismatch.

   Show each one go red, then restore it.

## Block B: documents

- **Register §65**, after confirming §1–§64 each appear exactly once. Record:
  - the cause and its evidence, including the unexplained 09-16 arrival;
  - Joe's ruling;
  - the script and the rule amendment.
- **Add dated pointers** under §49 and §54.
- **`docs/handoff-status.md`:** update the gate line.
- **File this brief** byte for byte as `docs/prompts/120-codex-agents-md-self-heal.md` from `Claude outputs\`, and update the counts by their own convention.

## Explicitly out of scope

- **Any file outside the repo, including anything under `C:\Users\jlull\.codex`.** Stopping the import at its source is a setting in Joe's Codex app. The only value Cowork has observed for the item-types key is `"all"`, and a guessed value in another app's config is not a fix.
- Removing any other foreign instruction file.

## Gates, commits and push

Run the script first, then all five gates, each as its own command. Read the floors from `docs/handoff-status.md` under "Repo state". For each gate that moves, report which gate, by how much, and why, and move its floor row in the same keystroke.

**Commit on green, then push `main`** (rule 7). Report the Vercel deployment.

End with the undo block:

- the real SHAs;
- what was one-way (a deletion by the script, if one happens during this run, is one-way: record the deleted file's hash);
- the secret gate on added lines.
