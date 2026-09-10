# Prompt 66 — the college logo rulings, and the two record-keeping faults 64 exposed

**Venue:** Claude Code.
**COMMIT AND PUSH ARE BOTH AUTHORIZED FOR THIS RUN**, on prompt 65's terms: five gates green, then
commit, then push, and only the commits this prompt creates. A rejected push is a hard stop.

Prompt 64's report was better than its brief in three places, and two of them are fixed here.

## Rules that bite

Rule 1 (certify Python), rule 3 (secret gate, ADDED only, `grep`), rule 4 (stage by explicit path —
`assets/` stays untracked), rule 10 (**`docs/handoff-status.md` wins over `CLAUDE.md`**), rule 11,
rule 17 (**JSON through a parser**), rule 20, rule 22, rule 26 (gate and commit are separate commands).

## Gates

Five, each its own command. **Read the floors from `docs/handoff-status.md`, not `CLAUDE.md`** — rule 10, and stage 2 exists
because they disagree. As of `5c5f63d` the real counts are **pytest 507 + 1 skipped · unit 469 ·
smoke 33/33 · qa-shots 91/91 · geometry all hard stops**. Note that these moved AGAIN between
`9a69810` and `5c5f63d` — that is the fourth drift in a day and the whole case for stage 2.

**If `qa-shots` fails, check for a squatting dev server before you debug the code.** Prompt 64 lost
time to a `next dev` started 2026-09-04 holding port 3000, answering nothing after 20 s and sharing
`.next` — it produced one to three different failures per run. Kill it and restart clean.

---

# Stage 1 — the 639 college rulings

Joe judged every college team on 2026-09-08. Cowork merged them into **`data/logo_conditioning.json`**
before this prompt; the file is already modified in the working tree and validated on disk:

| | before (`9a69810`) | now |
|---|---|---|
| `skip_derive` | 101 | **463** |
| `derive` | 23 | **300** |
| `split_by_context` | — | **3** |
| total | 124 | **766** |

Verified already: the two lists are disjoint, no split team appears in either, every id has base art
on disk, and every pro id from `9a69810` survives unchanged. **Re-verify anyway** (rule 17) — a claim
in a brief is not a measurement.

**Nothing in `build_web_marks.py` should need to change.** Prompt 64 put the rulings check above the
byte-identity branch and made the reader argument-free, so this is the same mechanism with a longer
list. If you find yourself editing the function, stop and say why — that would mean 64's mechanism
was narrower than its report claimed.

## Do

1. Certify Python. Confirm the tree holds `M data/logo_conditioning.json` and nothing else outside
   untracked `assets/` — prompt 65 committed `data/grid_colors_pro.json` in `5c5f63d`.
2. Re-verify the file through a parser: 463 / 300 / 3, disjoint, split in neither, base art for all.
3. **Hash all 766 `*_dark.png` before and after.** Expected: exactly **362** change — the college
   `skip_derive` teams. The 101 pro ones are already satisfied and must not move. Report the changed
   set and confirm it equals `skip_derive` minus the pro ids.
4. **Idempotence.** Second run copies nothing and changes zero files.
5. **The three split teams — 154 Wake Forest, 2486 Pacific Lutheran, 277 West Virginia — are in
   neither list on purpose.** Joe wants raw on the coloured plate and derived on charcoal, which
   `lib/config.js:151` and `MobileGrid.js:631/670` already do by design. **Verify that rather than
   assume it:** say what `cap.art` resolves to for each of the three, and confirm they keep their
   derived dark file. If any of them resolves `'dark'` on a coloured cap, that is a finding.
6. Extend the guard test to cover a college `skip_derive` team and a `derive` team. **Note that
   prompt 65 already relaxed these tests** in `5c5f63d`: prompt 64 had pinned `101` and `23` as
   literals plus "pro ids only", which went red the moment Cowork extended the file. They now assert
   the real invariant — the file agrees with itself, lists disjoint, ids well-formed, split teams in
   neither. Build on that; do not re-pin a count.

**Commit:** `logos: the college rulings join the pro ones`

Then `git --no-optional-locks push origin main`, then
`python scripts/sync_assets.py --push --prefix logos/` as its own command. **Expect ~362 uploads.**
A transient `ConnectionClosedError` on the first attempt has cleared on retry three times now; say it
happened. Verify the bucket afterwards — local-only should be zero.

---

# Stage 2 — the gate floors live in two places and drift

**Third occurrence this week.** Prompt 62's brief was three prompts stale; prompt 63's `CLAUDE.md`
was stale in the other direction; prompt 64 found `CLAUDE.md` saying qa-shots 73/73 against
`handoff-status.md`'s 88/88 and an actual 91. Nothing fails when they disagree, so they always will.

**The fix is to stop duplicating them, not to correct them again.** `docs/handoff-status.md` already
wins by rule 10, so it should be the only place the numbers live.

1. In `CLAUDE.md`'s **Gates** section, keep the five commands and what each one is, and **replace the
   counts with a pointer** to `docs/handoff-status.md` as the one place the floors are recorded. Do
   not leave a number behind "for convenience" — that is the duplication that caused this.
2. Bring `docs/handoff-status.md`'s floors to the truth measured in this run, and note the date and
   commit they were measured at.
3. Say in your report whether anything else in `CLAUDE.md` duplicates a number that lives elsewhere.
   The phone-grid tripwire table is the obvious candidate and stage 3 is about to touch it.

**Commit:** `docs: the gate floors have one home`

---

# Stage 3 — the geometry MLB row drifted, and nobody knows when

Prompt 64 reported the MLB tripwire row measuring `{228} / 86.51 / 567`, ratio **6.5543**, against
`CLAUDE.md`'s recorded **6.6629** — while `geometry.mjs`'s own day/week equality check passed exactly
and that run changed no JS or CSS. So the drift is real and predates `9a69810`, somewhere in the
commits since `f7fe047`.

**Do not re-baseline it blind.** The tripwire's whole value is that a moving number means something.

1. Find the commit that moved it. `git bisect` with `npm run geometry` is the direct route; reading
   the diffs of the commits since `f7fe047` that touch `web/` may be faster. Name the commit.
2. Say whether the move is **expected** — a deliberate change to something the row measures, in which
   case re-baseline it and record *why* beside the number — or **unexplained**, in which case report
   it and change nothing. An unexplained tripwire movement is a finding, not a chore.
3. While you are there: `CLAUDE.md`'s tripwire figures and the Mobile Grid Addendum's must agree with
   each other and with the runner. Say whether they do.

**Commit** only if step 2 concludes the move was expected: `docs: re-baseline the mlb tripwire row`

---

# Stage 4 — the assets are uploaded with no cache policy, and it cost a real hour

**Found 2026-09-08, after `9a69810` shipped.** Joe's phone kept showing the old logos. The bytes in
R2 were correct, the same URL fetched in Safari showed the new art, and the app — installed to the
home screen as a PWA — kept painting the old one until he re-added it. An hour went into ruling out
the art, the contrast, the render scale and the CDN before the cause turned out to be the HTTP cache.

**There is no service worker.** No `serviceWorker.register`, no workbox, no `sw.js` anywhere in
`web/`. So this is not app code caching — it is the browser doing what it is entitled to do:
`scripts/sync_assets.py` uploads with `ExtraArgs={"ContentType": ...}` and **nothing else**
(`:98` and `:208`), so the responses carry no `Cache-Control` at all. With no explicit policy a
browser applies *heuristic* freshness — commonly a fraction of the object's age — which for files
that have sat in the bucket for days can be hours or days. The URL never changes when the art does
(`teamLogoDarkUrl()` at `web/lib/config.js:156` is a bare path), so nothing ever tells a client to
look again.

**This is not a one-off.** Every future art change has it, and worse, it makes Joe's device pass
untrustworthy: rule 25 says a prompt is done when the device agrees, and the device may be agreeing
with something shipped a week ago.

## Do

1. **Set an explicit `Cache-Control` on upload** in `scripts/sync_assets.py`, at both call sites
   (`:98` and `:208` — verify those line numbers). Recommended:
   `public, max-age=300, stale-while-revalidate=604800` — five minutes of free reuse, then the client
   revalidates in the background and gets a 304 when nothing changed. For a personal app on small
   PNGs the revalidation cost is negligible and the failure mode this prevents is an hour each time.
   **If you think a different policy is better, argue it in the report rather than silently choosing
   one** — this is a trade-off between freshness and requests, and Joe should see the reasoning.
2. **It only applies to newly uploaded objects.** Existing bucket objects keep whatever headers they
   were written with, so the fix does nothing for art already there until it is re-uploaded. Say
   plainly in the report whether a full `--push` re-uploads unchanged objects or skips them — if it
   skips, the existing 766 logos keep no policy and someone has to force a re-upload once.
3. **Do not add a service worker** and do not add cache-busting query strings in this run. Both are
   real options and both are bigger decisions than this stage; name them in the report as
   alternatives if you think either is the better answer.
4. Record the finding in `docs/handoff-status.md` with the diagnosis, so the next person who sees
   "I shipped art and nothing changed" spends five minutes rather than an hour.

**Commit:** `assets: uploads carry a cache policy`

---

# Stage 5 — the cap tint overrides 42 of Joe's bands, and one block is at 1.46:1

**Found by prompt 65 and deliberately left alone there.** `capFor()` gives 42 of the 124 ruled teams
`tint: 0.72`, so what reaches the screen is `tint(band, 0.72)` and not the band Joe chose. His ink
lands exactly; his band lands darkened. Verified in the DOM: the Brewers render `rgb(19, 35, 60)`
where his choice is `#13294b` = `rgb(19, 41, 75)`.

**Four teams he chose above 3:1 are painted below it** — Bulls 3.78 → 2.51, Phillies 4.11 → 2.61,
Raptors 4.12 → 2.68, Thunder 4.76 → 2.98 — and **the Lions go 2.56 → 1.46, the worst block in the
app.** That is live on `main` now.

## Why the fix is `tint: 1` and not a pre-tint value

Register §29 offers two cheap options. **One of them is impossible.** `tint(hex, f)` at
`gridmodel.js:397` computes `c * f + 255 * (1 - f) * 0.08`, so at `f = 0.72` it maps 0–255 onto
**5.7–189.3**. Cowork measured Joe's 124 bands against that ceiling: **33 of them have a channel
above 189.3 and can never be output by that tint at any input** — the Browns' `#ff3c00`, the Flyers'
`#fe5823`, the Warriors' `#fdb927` among them. Storing a pre-tint value cannot work for a quarter of
the table, so it is not a real option.

That leaves giving a ruled team `tint: 1`, which makes `mix(c) = c` and paints the band exactly as
chosen. **The usual objection does not apply here:** a grid renders one sport, and every pro team is
ruled while no college team is, so no single view mixes tinted and untinted caps.

## Do

1. **Verify the ceiling arithmetic yourself** before acting on it — `tint()` at `:397`, `f = 0.72`,
   and the count of ruled bands with a channel above the ceiling. If your number is not 33, yours wins.
2. Make a ruled team's cap paint its band untinted. `capFor()` is the precedent `gridColourFor()` was
   shaped after, so put the change where those two already meet rather than special-casing at the call
   site. Read both and cite them.
3. **Re-measure all 124 painted ratios in the DOM, not in node.** Report the four that were below and
   are now above, and confirm the Lions land at Joe's chosen 2.56 rather than 1.46.
4. **The 26 that the tint was raising will drop back to Joe's chosen ratio.** That is correct — he
   chose those with the number in front of him — but list them, because some may now sit under 3:1
   and he should see which.
5. Amend register §29: the pre-tint option is impossible and why, and what shipped instead.
6. Rule 23 — if `mobile_demo.html` renders a tinted cap for a ruled team, it moves in this commit.

**Commit:** `grid: a ruled team's cap paints the band joe chose`

**If Joe would rather see the 42 before this ships, skip this stage entirely and say so** — the other
four stand alone and nothing else depends on it.

---

# The report

Per stage: what changed, the five gate counts, the commit hash, and every number with the command
that produced it. Then:

- **The 362**, and confirmation that the 101 pro files did not move.
- **`cap.art` for the three split teams**, measured.
- **The commit that moved the MLB row**, and your verdict on whether it was expected.
- **The Lions' painted ratio**, before and after, measured in the DOM.
- **The cache policy you chose and why**, and whether the existing 766 objects need a forced
  re-upload to carry it.
- **Anything in this brief that turned out to be wrong**, including the claim that
  `build_web_marks.py` needs no change.
