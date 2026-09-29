# Prompt 124: The TBD-badge check runs against fixture rows, not against the postseason standings

This builds on `c561ba2` (prompt 123). Before starting, confirm three things. If any check fails, stop and report.

- `git rev-parse HEAD` equals `git rev-parse origin/main`, and `c561ba2` is the top commit, or the only commit above it is prompt 121's documentation commit. Say which.
- `git status --porcelain` shows only untracked `assets/` entries.
- `python scripts/remove_codex_agents_md.py` exits 0.

Written by Cowork on 2026-09-28 from a read of the tree at `c561ba2` and read-only SELECTs. **Verify every file:line before acting on it.**

**Run this before 2026-10-01.** That is when the Wild Card series finish, the 2026-10-03 Division Series sides resolve to clubs, and today's stopgap turns `qa-shots` red on an app doing exactly what it should. After that, every Claude Code run stops on it.

---

## What Cowork found

**The check depends on who is still playing.** `web/scripts/qa-shots.mjs`, the block headed "THE TBD BADGE, AFTER HYDRATION" (about `:1273-1330`), loads `/?day=2026-10-03&sport=mlb` from live data and requires at least one placeholder side. It has now moved twice in five days (the 7 → 6 count on 2026-09-25, and 2026-09-29 → 2026-10-03 on 2026-09-28), and `docs/queue.md` item 15 predicts the third. The Yankees 404 check on 2026-09-29 has the same dependence on a real game existing that day.

**The repo already has the pattern for this.** `web/app/qa/programs/page.js` is a dev-only harness: it renders the REAL `Listing` component with fixture rows, and `notFound()`s when `NODE_ENV === 'production'` (`:99`), so Vercel serves a 404 at that path. Its header explains why this is not a second implementation: it proves the shipping components, not a mock.

**What the badge depends on** (`web/components/TeamMark.js:26-38`): `isPlaceholderTeam({ ...team, sport })` from `web/lib/placeholders.js`, or an image that failed to load, caught by `onError` or by the mount check `img.complete && img.naturalWidth === 0`. Both paths need a cold load through hydration, which is why the check is in `qa-shots` and not in `test:unit`.

**For scale:** the only live placeholder rows in the database from today on are six NBA Cup knockout games with `nba-TBD` sides (2026-12-04 to -11), and the MLB Division Series rows. Neither lasts. A fixture does.

## Block A: a fixture page, and the check pointed at it

1. **Add `web/app/qa/tbd/page.js`, modeled on `app/qa/programs/page.js`:**
   - the same production guard, first line of the component;
   - the same header style, explaining why it exists and why it is not a second implementation;
   - it renders `Listing` with fixture MLB game rows, **built in the exact shape the Today page passes `Listing`**. Derive that shape from `app/page.js` and the functions it calls, and say which function's output you matched. Do not invent fields.
2. **The fixture rows cover every branch the badge has:**
   - one side for each placeholder form `lib/placeholders.js` recognizes today: `AL|NL Wild Card #N`, `AL|NL #N Seed`, `AL|NL N/M Winner`;
   - one side whose team id ends in `-TBD`;
   - at least one real club on each card, so a card shows a badge beside a real logo;
   - one real club whose logo `qa-shots` will make 404 (the Yankees, `mlb-147`, as today), so the error path is checked on this page too.
3. **Point the TBD block in `qa-shots.mjs` at `/qa/tbd`.** Because the rows are code, the counts are known: assert the exact number of placeholder sides and badges, not "at least one". Keep the three existing assertions' meaning (every placeholder side badged; the badge fills the 20px box from the neutral tokens; the 404 club swaps to the badge with no broken image painted). Rewrite the comment block to say what changed and why. Remove the dependence on 2026-09-29 and 2026-10-03.
4. **Confirm the page is unreachable in production** the way `qa/programs` is, and say how you confirmed it without a local `next build`, which cannot run here.

**Mutation checks** (show each go red in `qa-shots`, then restore):
- delete the `N/M Winner` alternative from `lib/placeholders.js`;
- make `TeamMark` ignore `isPlaceholderTeam`;
- drop the 404 route for the Yankees logo;
- remove one fixture side (the exact count must catch it).

## Out of scope

- The smoke check's placeholder guard and queue item 12. Smoke reads live rows **on purpose** (register §60): a new MLB name form is meant to turn it red. This brief does not touch it.
- The eligibility freshness guard (queue item 16).
- Any other `qa-shots` block.

## Block B: documents

- **Register: the next free section number** (first confirm every earlier section appears exactly once). If prompt 121 has not run, that is §67, and 121 will take the next one after this. Record the finding, the fixture, and why the smoke guard stays live.
- **`docs/queue.md` item 15:** close it with a dated pointer to the register section.
- **`docs/handoff-status.md`:** record the gates, and move the `qa-shots` floor if the assertion count changes, in the same keystroke, with the reason.
- **File this brief** byte for byte as `docs/prompts/124-tbd-badge-check-from-a-fixture.md` from `Claude outputs\`, and update the counts by their own convention.

## Gates, commits, push

Run the script, then all five gates, each as its own command, against the floors in `docs/handoff-status.md` under "Repo state". **All five must be green.** If smoke is red on a new MLB placeholder form (the LCS round), stop and report the form; do not widen the pattern in this run.

**Commit per block (A, then B), then push `main`** (rule 7), and report the Vercel deployment. Do not dispatch the workflow.

End with the undo block: the real SHAs, what was one-way, and the secret gate on added lines.
