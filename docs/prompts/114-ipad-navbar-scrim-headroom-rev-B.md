# Prompt 114 rev B: widen the placeholder rule, then commit 114

This continues prompt 114 in the **same working tree**. Do not reset, revert or restage anything. Before starting, confirm the tree matches the state your report left:

- `git rev-parse --short HEAD` and `git rev-parse --short origin/main` both return `ec99819`.
- `git status --porcelain` shows these nine modified files and nothing else outside `assets/`: `CLAUDE.md`, `docs/enhancement-register.md`, `docs/handoff-status.md`, `docs/prompts/113-cap-table-on-the-ruled-band-rev-B.md`, `docs/prompts/README.md`, `docs/rendering-contract-mobile.md`, `web/app/globals.css`, `web/scripts/qa-shots.mjs` and `web/test/nav.test.mjs`.
- One untracked file is present: `docs/prompts/114-ipad-navbar-scrim-headroom.md`.

If the tree differs, stop and report.

## Cowork's review of your report, checked against the tree

The stop was correct. Cowork checked the report on 2026-09-23 and it holds:

- **The CSS.** The media block and the `--ipad-top-clear: 32px` token are as the brief asked, and `safe-area-inset-top` still appears exactly 3 times.
- **The two filed briefs.** The rev B sha256 is `aef2295c…` and the 114 sha256 is `7672029f…`.
- **The pictures.** Cowork opened `pix-after/ipad-1366x1024-coarse__collapsed.png` and `__fresh.png` at pixel scale. In Chromium, the navbar and banner now sit exactly where the device screenshots showed them sitting below iOS's 32 px bar. That is the predicted result.
- **The red smoke check is real.** Cowork read the database with a read-only SELECT through the Supabase connector. The PostgREST host was blocked by network policy from both of Cowork's shells, so this was the only way in. It returned the seven rows: `mlb-4614` AL #3 Seed, `mlb-4617` NL #3 Seed, `mlb-4619` NL Wild Card #1, `mlb-4944` AL Wild Card #2, `mlb-4945` NL Wild Card #2, `mlb-4946` AL Wild Card #3 and `mlb-4947` NL Wild Card #3. Each has a `-TBD`-free id and an MLB abbreviation (`AL3`, `NLWC1`, and so on). They appear in four games on 2026-09-29: `mlb-849843`, `849845`, `849849` and `849851`, the last one at the Yankees (`mlb-147`). The only other non-CFB placeholder row is `nba-TBD`.

**One item was outside the brief's named paths: `CLAUDE.md`.** It changed the pointer row to `§1–§59`, the brief count to `121 … 01–114`, and the provenance clause. The edit is correct and is the convention's own bookkeeping, so it stays. Name it in the Block D commit message.

---

## Joe's ruling, 2026-09-23: widen the placeholder rule. Do not rule colors for these ids.

The seven are not teams. MLB replaces them with real teams as the seeds clinch, then adds new placeholders for each later round. A color ruling per placeholder id would go stale every week of October.

## Block E: the placeholder predicate

1. **Add one exported predicate, `isPlaceholderTeam(team)`**, in a small module under `web/lib/` (your choice of file; a new `web/lib/placeholders.js` is fine). It is true when either of these holds:
   - `String(team.id)` ends with `-TBD` (today's rule, unchanged), **or**
   - `team.sport === 'mlb'` and `team.canonical_name` matches `/^(AL|NL) (#\d+ Seed|Wild Card #\d+)$/`.

   **Keep the pattern narrow on purpose.** It covers the two forms MLB has actually published. A later round's placeholder with a different name (for example a Division Series winner) is **meant** to turn the smoke check red, so someone looks at it and widens the pattern by ruling. That is not a defect to design around. Do not guess future forms. Put that reasoning in the module's comment.

2. **`web/scripts/smoke.mjs:212` and `:222-224`.** Add `canonical_name` to the teams select, and replace the `endsWith('-TBD')` test with `isPlaceholderTeam`. Keep the check's label. Change its detail string so it names every row it exempted and why (by suffix, or by the MLB pattern), and names any unruled row that is not a placeholder. That way a reader of a green run can see the seven.

3. **Unit test, in a new or existing file under `web/test/`.**
   - It must pass for all seven real names above, with the `mlb` sport, and for `nba-TBD`.
   - It must fail for:
     - `Cleveland Guardians` (`mlb-114`)
     - `AL #3 Seeds`
     - `AL Wild Card`, with no number
     - `ALDS Winner A`
     - the pattern's name on a non-MLB sport
     - an id `mlb-TBDX`

4. **Mutation checks:**
   - drop the sport guard
   - drop the `^` anchor, then the `$` anchor
   - widen `#\d+` to `.*`
   - remove the suffix branch
   - point smoke back at `endsWith('-TBD')`

   Show each one going red, then restore it.

5. **Report only, change nothing: how the four 2026-09-29 games render today.** Placeholder teams have no logo file and no color ruling. Render 2026-09-29 in DAY / ALL GAMES, as LIST and as GRID, at 390 × 844 and at 1366 × 1024 coarse. Crop the four games to `assets/p114-ipad-scrim/placeholders-0929/`. Say plainly whether any broken image, empty endcap, `null` text or wrong name appears. **Do not fix anything you find.** It becomes Joe's next decision, and 2026-09-29 is six days out.

6. **Docs.**
   - **Register:** a new **§60**, after confirming §1–§59 each appear exactly once. Record Joe's ruling, the pattern, why it is narrow, and the seven ids with their four games.
   - **`docs/handoff-status.md`:** close the OPEN item your run added, and record the floor movements as usual.
   - **File this brief** byte for byte as `docs/prompts/114-ipad-navbar-scrim-headroom-rev-B.md`, from `Claude outputs\prompt-114-rev-B-placeholder-rule-then-commit-2026-09-23.md`. Report its sha256, and update the README and `CLAUDE.md` counts by that file's own convention.

---

## Gates, then three commits, then the preview stop

Run **all five** gates, each as its own command. **`npm run geometry` this time too.** Your report skipped it, and the brief asks for five. Read the floors from `docs/handoff-status.md` under "Repo state". Smoke should read 33/33. For each gate that moves, report which gate, by how much, and why, and edit its floor row in the same keystroke as the movements row.

**All five green, then commit in this order,** each as its own `git add` of named paths and its own commit:

1. **Block E** (the predicate, smoke, its test, register §60).
2. **Prompt 114 Blocks A–C1** (`globals.css`, `nav.test.mjs`, `qa-shots.mjs`).
3. **Prompt 114 Block D plus both brief files** (`enhancement-register.md` §59 hunks, `handoff-status.md`, `rendering-contract-mobile.md`, the rev B replacement, the README, `CLAUDE.md`, and `docs/prompts/114-*.md`).

If a file carries hunks from two blocks (the register and `handoff-status.md` will), commit it whole with the later block and say which. Do not split hunks by hand.

**DO NOT PUSH `main`.** Then stop and wait for Joe to type `preview`. From there, follow prompt 114's Block C2 and "Joe's device steps" exactly as filed: push `HEAD:refs/heads/p114-ipad-scrim-preview`, report the preview URL, and print the steps with the URL filled in.

End with the undo block: the exact revert commands with all three real SHAs in reverse order, whether anything was one-way (the preview branch, if pushed, with its delete command), and confirmation that `main` was not pushed. Leave the dev server stopped by path.
