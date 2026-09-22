# Prompt 113: The cap table is scored against the band that actually paints

This builds on `02e3a52` (prompt 112). Before starting, check that `git rev-parse --short HEAD` returns `02e3a52` and that the tree is clean apart from the untracked `assets/`. If either check fails, stop and report.

*(Numbering: preemption moves to 115. The measurement run for views, refresh and the iPad banner takes 114.)*

**Joe's ruling, 2026-09-22: option (b) from `docs/queue.md` item 11.** Regenerate `web/lib/cap-table.json` so that every ruled team's art is chosen against the band it actually paints. This run implements that ruling and nothing broader.

---

## What Cowork measured, and where the handoff was wrong

Cowork measured this on the device on 2026-09-22 by importing `scripts/build_cap_table.py`'s own `load_logo`, `measure` and `DARK_MARGIN` and scoring every ruled team's raw and `_dark` file on its band from `data/grid_colors_pro.json`. **Verify these numbers rather than adopting them.**

**1. The handoff said the change produces "exactly the thirteen flips." That is incomplete.** Scoring on the flat ruled band gives **38** rows whose `art` changes:

- **13 raw → dark:** Reds, Royals, Dodgers, Padres, Rays, Twins, Yankees, Jazz, Rams, NY Giants (`nfl-19`), Jets, Chargers, Lightning. This is the visible fix Joe approved.
- **24 dark → raw where the two files are byte-identical in `assets/logos/`.** On the band the scores tie exactly (the Cavaliers 1.000/1.000, the Orioles 0.000/0.000, and so on), and the rule's tie goes to raw. **Locally these are label changes with no visible effect.** The ids are `mlb-110 mlb-121 mlb-133 mlb-136 mlb-146 nba-CHI nba-CLE nba-DET nba-MEM nba-MIA nba-MIN nba-PHX nfl-15 nfl-21 nfl-22 nfl-29 nfl-9 nhl-16 nhl-21 nhl-23 nhl-25 nhl-3 nhl-30 nhl-68`.
- **1 dark → raw where the files differ: the Houston Rockets (`nba-HOU`).** Both files score 1.000 and the tie goes to raw. **This one is a visible change Joe did not see when he ruled.** Render it before and after (see Block C). It follows the rule unless Joe says otherwise at review.

**Byte-identical locally is not byte-identical as served.** The app serves logos from R2. Before calling the 24 "no visible change," confirm that for each one the served `{id}.png` and `{id}_dark.png` are identical, using prompt 94's R2 byte-compare method. Any pair that differs on R2 moves out of the 24 and into the Rockets' category, and must be rendered.

**2. Passing the ruled band into `decide()` is the wrong implementation.** `decide()` (`scripts/build_cap_table.py:169-190`) picks the art on the **tinted** surface whenever the best flat score falls below 0.85. But `capFor()` (`web/lib/gridmodel.js:431`) forces `tint: 1` for every ruled team, so a ruled cap is **always** the flat band. Cowork ran it both ways: through `decide()` there are 39 changes, and the extra one is the 76ers flipping to `dark`. That is the stale-surface error prompt 68 already corrected by override. **For a ruled team, score both files on the flat ruled band only, write `tint: 1.0`, and choose the art with the existing margin rule on those flat scores.**

**3. Unruled rows must not move.** About 186 rows have no entry in `grid_colors_pro.json`. They keep `band_for()` and `decide()` exactly as they are today. **If regenerating changes any unruled row, stop and report it before committing.** A moved unruled row means a logo file changed after 2026-09-04, and that is a separate finding.

**4. `mlb-137` (Giants, SF) carries `art: 'cap'`, which the script cannot produce.** It was hand-set in `b98a696` and declared in `web/test/captable.test.mjs`'s `OVERRIDES` (`:107`). A plain regeneration would overwrite it with `raw`/0.72, and the Giants' orange endcap would lose its black silhouette. **Move that ruling into the build** as an explicit, commented override the script applies, so that regeneration is reproducible and does not depend on someone remembering to hand-patch the output. Keep the reason with it. The `nba-PHI` override (`:99`) should become redundant, because on the flat band raw scores 0.599 against dark's 0.005. Confirm that before removing it.

**5. A likely explanation for the "26 rows that reproduce on neither surface"** (handoff §3). This is a hypothesis to test, not a finding. The table was generated on 2026-09-04. For 24 teams, `_dark` is now a byte copy of raw, which looks like the 2026-09-08 `logo_conditioning.json` ruling rebuilding `_dark` files after the table was scored. Check whether that accounts for the 26. Say what it explains and what it leaves unexplained.

---

## Block A: the build change

1. **Update `scripts/build_cap_table.py`.** It reads `data/grid_colors_pro.json`. For a team listed there, it scores raw and `_dark` on that team's `band`, flat. For every other team, it keeps today's `band_for()` + `decide()` path unchanged. The `mlb-137` cap override from point 4 lives here. Update the module docstring to say which surface each class of team is scored on and why (prompt 66, prompt 112, this ruling). **Leave `LUM_CRISP`, `FLAT_MIN`, `DARK_MARGIN` and `CAP_TINT` unchanged.**
2. **Regenerate `web/lib/cap-table.json`.** The DB SELECT and `--teams-csv` are both acceptable. Say which one you used. If `web/test/fixtures/team-colours.json` changes as a side effect, report the diff. Do not suppress it.
3. **Print a change table** of every row whose `art` or `tint` moved, with its old and new values and both flat scores. It should match point 1 (13 / 24 / 1). If it does not, the difference is the finding.

## Block B: the tests move on purpose, and none is loosened

- `web/test/captable.test.mjs` "the shipped table matches the study field for field" (`:110-129`). The 2026-09-04 study still describes the **unruled** teams and no longer describes the ruled ones. Restrict the study match to unruled ids, with a comment explaining why. Recompute the 170/28/84/25 counts over that set, and pin whatever they actually are. Pin the ruled rows separately against the regenerated table's own counts. Delete or move the `OVERRIDES` entries according to point 4.
- `web/test/gridcolors.test.mjs` "the cap ART is left as the cap table measured it" (`:171-177`). The assertion still holds. Its comment ("chosen … against the tinted surface") is now false, so correct it.
- `tests/test_cap_table.py`. Add a test that pins the new behavior: a ruled team is scored on its flat ruled band, and an unruled team is scored on `band_for()`. The test must fail when the ruled branch is reverted.
- **Run mutation checks on every new or changed assertion.** For each one, break the thing it guards, show the assertion going red, then restore. Report each check.

## Block C: the pictures, which are what Joe rules from

Save these under `assets/p113-cap-regen/` (untracked) and give the path.

- **The 14 visible changes** (the 13 plus the Rockets, and any team that R2 moved out of the 24): each grid endcap before and after, at true grid size (46 CSS px, DPR 3) **and** at 4×, on the band it paints.
- **The Rams, flagged by name.** The Rams' `_dark` file reads but looks soft: lighter blue on navy, at a median ink ratio of 2.57 compared with the Padres' 11.22. Put the two side by side.
- **Two spot checks from the 24,** confirming that the before and after render pixel-identical.

A passing test and a legible block are different claims. Cowork will open these at pixel scale.

## Block D: documents

- **`docs/queue.md` item 11.** First, correct the sentence saying the Blues and Flames "reach neither 50% on either file" and "need new art or a band change." At true size and at 4×, the Blues (`nhl-19`, 24% interior) and the Flames (`nhl-20`, 28%) read well: their gold elements carry the mark. The Rays (`mlb-139`, 25%) does not read, and this run fixes it. The interior-share figure produces false positives. It ranks by the share of contrasting ink, but legibility depends on whether a coherent shape survives. Say that plainly. Then record that option (b) is done. **Item 11 stays open** for the rim-only class (Colts, Guardians, Red Sox, Sabres, Brewers, Commanders, Braves, Pacers), where the file swap does not help. The options for them are still (c) and (d), and they are Joe's to choose.
- **`docs/enhancement-register.md` §58.** Confirm first that §1–§57 each appear exactly once. Record Joe's ruling, the flat-band implementation and why `decide()` was the wrong vehicle, the 13/24/1 split, the Rockets, the `mlb-137` override moving into the build, and what point 5 found.
- **`web/lib/gridmodel.js`, `capFor()` comment (`:427-429`).** The "known loose end" sentence is now closed by §58. Rewrite that sentence to say so. **Do not change any logic.**
- **File this brief** as `docs/prompts/113-cap-table-on-the-ruled-band.md`.

---

## Explicitly out of scope

- Any logo file, `data/grid_colors_pro.json`, `data/logo_conditioning.json`, `build_web_marks.py`.
- A new metric of any kind. The interior-share figure stays a rejected proposal.
- The rim-only class, preemption, the iPad banner, and the `Banner.js:21` "155/428" debt.
- `docs/design/mobile_demo.html` (rule 23). Say whether any team it draws is among the 38.

## Gates and committing

Run all five gates, each as its own command with its own count. Read the floors from `docs/handoff-status.md` under **"Repo state"** beforehand, never from `CLAUDE.md`, a summary, or this brief.

**Counts will move in Block B.** For each gate that moves, report which gate, by how much, and why. Edit its floor row in the same keystroke as the movements row.

**Stages self-commit on green. DO NOT PUSH.** A push is a deploy, and this one changes what 14 or more grid endcaps paint. Joe reviews the Block C pictures and authorizes the push himself.

End with the undo block (`CLAUDE.md` `## Committing`): the exact revert command with the real SHA, whether anything was one-way, and confirmation that nothing was pushed.
