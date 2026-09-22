# Prompt 113 rev C: Joe's review pins, then the push confirmations

This continues prompt 113 on `e9d5ccd` in the **same working tree**. Before starting, confirm `git rev-parse --short HEAD` returns `e9d5ccd`, `origin/main` is `02e3a52`, and `git status --porcelain` shows only the untracked `assets/` entries. If anything differs, stop and report.

Written in Chat from Joe's review of the 21 sheets under `assets/p113-cap-regen/`, read against the Claude Code report and the id list. Chat cannot read the tree; every path and line below comes from prompts 113 and 113 rev B and from your own report. Verify each before acting on it.

---

## Joe's ruling, 2026-09-22: six rows keep the OLD version, fifteen take the new

Joe reviewed every pair at 4x. Fifteen rows stand as regenerated, **including the Rams (`nfl-14`) and the Rockets (`nba-HOU`)**, which were flagged for him and which he accepted as they are. Do not touch them.

Six rows go back to what the left panel showed:

| # | id | team | regenerated (right) | Joe keeps (left) |
|---|---|---|---|---|
| 1 | `197` | Oklahoma St | raw / 0.72 | **dark / 1.0** |
| 2 | `2447` | Nicholls | dark / 1.0 | **raw / 0.72** |
| 3 | `2464` | N Arizona | dark / 1.0 | **raw / 0.72** |
| 5 | `2627` | Tarleton St | dark / 1.0 | **raw / 1.0** |
| 6 | `2655` | Tulane | dark / 0.72 | **raw / 0.72** |
| 20 | `nfl-24` | Chargers | dark / 1.0 | **raw** (see Block B on tint) |

These are Joe's rulings from the pictures. They are not scores, and the build must not re-derive them.

---

## Block A: the five college pins (`197`, `2447`, `2464`, `2627`, `2655`)

1. **Pin them in the build**, the same way `mlb-137`'s cap override lives in `scripts/build_cap_table.py` after prompt 113: an explicit, commented override the script applies, one line per id, reason `Joe's review of the p113 sheets, 2026-09-22: keeps the pre-113 rendering`. Regeneration must reproduce the pinned values without anyone hand-patching the JSON.
2. **Declare them in `web/test/captable.test.mjs`** alongside the existing `OVERRIDES` / `FILE_CHANGED` entries with the same reason. A declared row that stops needing its override must still fail, the same way the existing declarations do. Make the `--check` acceptance in `build_cap_table.py` agree. Where a pinned id is currently in `FILE_CHANGED` / `FILE_CHANGED_SINCE_STUDY`, say what you did with that entry and why; do not leave an id declared twice for two reasons.
3. **Oklahoma State (`197`) is the one that may not be possible as stated.** Rev B's report said its cap "moves from the flat orange band to its 0.72 tint with the same art"; the id list you produced says `dark/1.0 -> raw/0.72`, an art flip. One of those is wrong. Read the row in the `e9d5ccd` table and in the pre-113 backup and report both values. Then: rev B recorded that Oklahoma State's `_dark` file was rebuilt on 2026-09-08 under `skip_derive`. If the current `197_dark.png` in `assets/logos/` is the file the left panel was rendered from, pin `dark / 1.0` and proceed. If the left panel was rendered from a file that no longer exists in that form, or `skip_derive` means there is no usable `_dark` for it, **stop on this row only**, report exactly what pinning could produce, and finish the other five. Do not substitute a "close enough" value.
4. **Regenerate `web/lib/cap-table.json`** with the same input rev B used (the 2026-09-04 fixture colors). Print the change table against `e9d5ccd`: it should be exactly the six rows here (or five, if `197` stopped), and nothing else. Any other row moving is the finding; report it and stop before committing.
5. **The counts move on purpose.** Rev B pinned the unruled acceptance at 104 / 17 / 54 / 11. Five pins change those. Report the new numbers and the arithmetic that gets from the old ones to the new, and re-pin them with a comment naming this ruling. The study-ink counts (191/116, 56/20/33, 26) read from the frozen fixture after rev B and **must not move**; if they do, that is a finding.

## Block B: the Chargers (`nfl-24`), a ruled team

The Chargers are a ruled team, so `capFor()` (`web/lib/gridmodel.js:431` per prompt 113) forces `tint: 1` regardless of the table. The pre-113 row said `raw / 0.72`, but the app never painted it at 0.72; it painted raw on the flat band. So the pin is **`art: raw, tint: 1.0`**, as the override for a ruled team, and the reason line must say why the tint is 1.0 and not the old row's 0.72.

**Check what the left panel was drawn on.** If the `pair__nfl-24` sheet rendered the left panel at the old row's 0.72 rather than on the flat band the app paints, then the panel Joe approved is not what will ship. Re-render the pinned Chargers cap on the flat band at true size and 4x and put it in the review set (Block C). Say which it was.

Register §58 should record the pin and the fact that the `nfl-24` tint in the old row was never what painted.

## Block C: the pictures Joe rules the push from

Save under `assets/p113-cap-regen/pins/` (untracked) and give the path. For each pinned id, render the cap **from the pinned table row as it will ship**, at true grid size (46 CSS px, DPR 3) and at 4x, on the band it paints, side by side with the left panel from the original sheet. Label them `PINNED` and `ORIGINAL LEFT`. State per id whether the two are pixel-identical. Any that are not identical get reported by name; Joe decides those before the push.

## Block D: the four confirmations the rev B report omitted

Report these before the gates. They are conditions of the push, not of this commit.

1. Prompt 113 required the R2 byte-compare for the 24 dark-to-raw ties (prompt 94's method) before calling them "no visible change." Report whether it ran and whether every served `{id}.png` / `{id}_dark.png` pair was identical. If it did not run, run it now. Any pair that differs is a visible change that has never been rendered: render it before and after, add it to Block C, and stop before committing.
2. Block C of prompt 113 required two pixel-identical spot checks from the 24. Name the two ids and the file paths.
3. Block D of prompt 113 required confirming §1–§57 each appear exactly once in `docs/enhancement-register.md` before §58 was written. Report the count now.
4. Confirm `docs/handoff-status.md` carries its Repo state line for 113 and the prompts README lists 113 and rev B. If either is missing, add it in this commit and say so.

## Block E: documents

- **`docs/enhancement-register.md` §58**: append a dated subsection recording Joe's review, the six pins with the reason, the Rams and Rockets accepted as regenerated, the Oklahoma State resolution from Block A.3, and the Chargers tint note from Block B. Do not open §59; this is the same ruling as §58.
- **Rule 23**: none of the six pinned ids is among the twelve MLB rows in `docs/design/mobile_demo.html`'s `CAPTABLE`, so the locked reference should not change. Confirm by reading it; if a pinned id is in it, update that row in this commit and report it.
- **`web/lib/gridmodel.js`**: no change.
- **File this brief** next to 113 and rev B in `docs/prompts/`, using the naming rev B used, and update the README. Report the filename.

## Explicitly out of scope

Any logo file, `data/grid_colors_pro.json`, `data/logo_conditioning.json`, `build_web_marks.py`, any of the fifteen rows Joe accepted, the rim-only class, the iPad banner, and `queue.md` beyond the item-11 corrections already made.

## Mutation checks

On every new or changed assertion: break the thing it guards, show it go red, restore, report. At minimum: remove one pin from the build override and show the JS declaration and the `--check` acceptance both fail; set a declared pinned row back to its regenerated value in the table and show it fail; and confirm the study-ink test still goes red when `renderInk()` is pointed back at the live table (rev B's check, re-run).

## Gates and committing

All five, each as its own command with its own count. Read the floors from `docs/handoff-status.md` under "Repo state" beforehand, never from `CLAUDE.md` or this brief. For each gate that moves, report which, by how much, and why, and edit its floor row in the same keystroke as the movements row. Nothing should move except where Block A adds or rewrites pins.

**Self-commit on green as one commit on top of `e9d5ccd`. DO NOT PUSH.** Joe reviews Block C and Block D, then authorizes the push himself.

Leave the dev server stopped by path. End with the undo block: the exact `git revert` for this commit with the real SHA, whether anything was one-way, and confirmation that nothing was pushed and Vercel production is still on `02e3a52`.
