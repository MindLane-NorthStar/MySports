# Prompt 113 rev B: continue from where the run stopped

This continues prompt 113 in the **same working tree**. Do not reset, revert or restage anything. Before starting, confirm the tree is what your report left: `HEAD` is `02e3a52`, the modified files are `scripts/build_cap_table.py`, `web/lib/cap-table.json` and `web/test/fixtures/team-colours.json`, and `docs/prompts/113-cap-table-on-the-ruled-band.md` is untracked. If the tree differs, stop and report.

The stop was correct, and the report checked out against the tree. Cowork re-read the backup and the regenerated table and got the same 38 art changes, the same 27 tint-only rows and the same seven unruled rows.

---

## Joe's ruling on the seven unruled rows: accept them

The seven college rows move because the table now describes the `_dark` files that actually exist. The alternative, pinning them to their shipped values, would keep a table that is wrong about seven files. **These are real visible changes**, though: Oklahoma State's cap moves from the flat band to the 0.72 tint, and six teams switch to their rebuilt dark file. So:

- Keep all seven as regenerated.
- In `web/test/captable.test.mjs`, declare the seven the same way `OVERRIDES` declares its entries: one comment per id saying the `_dark` file was rebuilt after 2026-09-04 (give the date and cause: six on 2026-09-07, Oklahoma State on 2026-09-08 under `skip_derive`). A declared row that stops differing from the study must still fail.
- In `build_cap_table.py --check`, make the acceptance pass the same way: declare the seven as file-changed rows with the same reason. Do not loosen the counts. Report the unruled counts the acceptance now pins.
- **Add all seven to the Block C pictures**, before and after, on the surface each one actually paints (tint per its row). Joe reviews them together with the fourteen before any push. If one reads worse, it gets pinned then. The commit is local, so nothing is lost by deciding at review.

---

## Three things the original brief missed

**1. The study-ink tests read the live table's tint, and 46 study teams' tint just moved.** `renderInk()` (`web/test/captable.test.mjs:218-225`) takes `tint` from `table.teams[id]`. The counts it feeds were computed over the frozen 2026-09-04 study: 191/116 (`:227`), 56/20/33 plus the charcoal list (`:241`), and the 26 (`:278`). Cowork compared the backup against the regenerated table: **46 of the 307 study teams now carry a different tint**. That includes seven ruled teams on the charcoal list (`mlb-108`, `nba-DAL`, `nfl-12`, `nfl-24`, `nfl-8`, `nhl-17`, `nhl-7`), and four of the seven unruled rows.

**Do not re-pin those counts.** The helper's own doc comment (`:207-217`) says those tests pin *"the prompt-40 ink rule over a frozen 307-team fixture"* and deliberately avoid anything that would let a later ruling *"rewrite the study's counts."* A regenerated table is exactly that kind of ruling. So `renderInk()` should take `tint` and `art` from the **study fixture row** (`fixture.teams`, which carries both), not from the live table. The counts then stay exactly where they are. Add a sentence to the comment saying why. Run a mutation check: point it back at `table.teams` and show the counts go red.

**2. The fixture's new timestamp is false.** The regeneration read the 2026-09-04 colors from the fixture itself, so `web/test/fixtures/team-colours.json` differs only in `_generated`, and the new date claims a pull that never happened. Restore it with `git checkout -- web/test/fixtures/team-colours.json`. Then confirm `git diff --stat` no longer lists it and that the fixture-bytes gate passes. Record in §58 that the colors are the 2026-09-04 SELECT, used because the DB path needs the writer credential rule 14 forbids.

**3. Rule 23 applies, and the original brief said the opposite.** `CLAUDE.md:123`: *"When a change alters anything the locked reference implements, `docs/design/mobile_demo.html` changes in the same commit."* The reference embeds its own `CAPTABLE` (`:472`), read by `capOf` (`:671`), and 12 of the 38 art changes are in it. Update those rows to match the regenerated table, in the same commit. Also check how `capOf` handles ruled teams: if it does not force tint 1 the way `capFor()` does, update their `t` values too. Report exactly which rows changed. Change nothing else in the reference.

---

## Then finish the original brief

Complete Blocks B, C and D as written in prompt 113, with the additions above:

- **Block C** now covers 14 + 7 before/after pairs, the Rams next to the Padres, and two pixel-identical spot checks from the 24.
- **§58** also records the seven, the 83 unruled `_dark` files that postdate the table, the `renderInk()` correction, and the rule 23 update.
- **`docs/queue.md` item 11** gets the corrections the original brief asked for.

Run all five gates, each as its own command with its own count. Read the floors from `docs/handoff-status.md` under "Repo state" beforehand. For each gate that moves, report which gate, by how much, and why, and edit its floor row in the same keystroke as the movements row. **The study-ink counts should not move.** If they do, that is a finding.

**Stages self-commit on green. DO NOT PUSH.** Joe reviews the 21 before/after pairs first. Leave the dev server stopped by path when done.

End with the undo block: the exact revert command with the real SHA, whether anything was one-way, and confirmation that nothing was pushed.
