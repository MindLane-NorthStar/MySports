# Prompt 65 — the pro grid-card colours

**Venue:** Claude Code. **Shape:** one stage plus its guards.
**COMMIT AND PUSH ARE BOTH AUTHORIZED FOR THIS RUN.** Joe, 2026-09-08, overriding the standing rule
that neither happens without his explicit say-so: run the five gates, **commit**, then **push**. Only
the commit this prompt creates, and only after all five gates are green. A rejected push is a hard
stop — report it and change nothing else. This is a per-run authorization, not a change to the rule.

Joe judged all 124 pro-league grid blocks by eye on 2026-09-08 at grid scale, choosing the band and
the ink for each. His rulings are in the repo already, written by Cowork before this prompt:
**`data/grid_colors_pro.json`** — 124 teams, each with an exact `band` and `ink`.

**109 of the 124 differ from what ships today.** This is not a tweak.

## Rules that bite

Rule 3 (secret gate, ADDED only, `grep`), rule 4 (stage by explicit path), rule 11
(`--no-optional-locks`), rule 13 (**a threshold is measured against the local background**),
rule 16 (colour tokens read from `globals.css`, never retyped), rule 17 (**JSON through a parser**),
rule 20, rule 22 (read the code and cite file and line), rule 23 (`docs/design/mobile_demo.html`
moves in the same commit as anything it implements). Read the gate floors from `CLAUDE.md`.

## The five gates, each its own command, before the commit

```
pytest · npm run test:unit · npm run smoke · node scripts/qa-shots.mjs · npm run geometry
```

---

# Why this is a table and not a rule

Cowork tested four candidate rules against Joe's 124 judgements. **None of them fits:**

| rule | agrees with Joe |
|---|---|
| today's — lighter of the two colours paints | 38 / 124 |
| darker paints, lighter inks | 68 / 124 |
| darker paints, best available ink | 68 / 124 |
| primary always paints | 83 / 124 |

The best candidate still needs 41 overrides, so a rule plus exceptions is bigger and less honest than
the table. **Ship the table.**

**But record the second finding**, because it governs everything not in the table: `bandFor()`'s
current rule agrees with Joe's taste on 31% of pro teams, and "primary always paints" agrees on 67%.
Every college team still runs on the 31% rule. That is not a licence to change it in this run —
nobody has judged a college grid block — but it belongs in the register as the open question it is.

---

# Do

1. **Read `data/grid_colors_pro.json` through a parser** (rule 17). Assert 124 entries, that every
   `band` and `ink` parses as `#rrggbb`, and that every id matches a team the app can actually render.
2. **`bandFor()` consults the table first.** `web/lib/gridmodel.js:263` is the function. A listed team
   returns its exact `band` and `ink`; an unlisted team falls through to today's logic untouched.
   Return the same shape it returns now — `{band, ink, inkIsNeutral, ratio}` — with `ratio` computed
   by the existing `contrastRatio()` rather than read from the file, so the file cannot carry a stale
   number, and `inkIsNeutral` derived by comparing the ink to the two neutral constants.
3. **Every college team comes out unchanged.** Prove it, don't assert it: run `bandFor()` over every
   team the app knows before and after, and report that exactly 124 results moved.
4. **The existing tests stay green on their own terms.** `gridbands.test.mjs` pins the grey fallback
   and the rule's behaviour; a team in the table must not break a test that was written about the
   rule. If one does, say which and why before changing it.
5. **A guard test.** Assert three things: a listed team returns the file's exact pair; an unlisted team
   returns what the rule alone would return; and the table's ids are all resolvable. That last one is
   what catches a team id changing under the file.
6. **Rule 23.** `docs/design/mobile_demo.html` renders grid blocks. If any team in it is in the table,
   it moves in this commit.

**Commit:** `grid: joe's per-team band and ink for the pro leagues`

Then, as separate commands: `git --no-optional-locks push origin main`, then confirm
`git --no-optional-locks log --oneline origin/main..HEAD` returns nothing.

---

# One thing to report, not to fix

**Eleven of Joe's 124 choices fall below 3:1**, which is `BAND_MIN_RATIO` — the AA floor for large
text that `gridmodel.js:207` names. He chose them with the ratio on screen next to each option, so
they are deliberate, and this prompt ships them as chosen. Do not silently correct them and do not
add a floor that overrides the table.

But **verify the ratios independently** and report the list with your own numbers, so Joe is ruling on
measured values rather than Cowork's:

| ratio | team | band | ink |
|---|---|---|---|
| 1.82 | Tampa Bay Buccaneers | `#3e3a35` | `#bd1c36` |
| 2.56 | Detroit Lions | `#bbbbbb` | `#0076b6` |
| 2.65 | Los Angeles Chargers | `#0080c6` | `#ffc20e` |
| 2.82 | Atlanta Falcons | `#000000` | `#a71930` |
| 2.82 | San Francisco 49ers | `#b3995d` | `#aa0000` |
| 2.87 | Minnesota Timberwolves | `#266092` | `#79bc43` |
| 2.87 | Columbus Blue Jackets | `#002d62` | `#e31937` |
| 2.92 | Florida Panthers | `#002d62` | `#e51937` |
| 2.92 | New York Islanders | `#00529b` | `#f47d31` |
| 2.97 | Guardians | `#e31937` | `#002b5c` |
| 2.98 | St. Louis Blues | `#0070b9` | `#fdb71a` |

If your numbers differ from these, yours win — say so.

---

# Deliberately not in this run

- **Changing `bandFor()`'s underlying rule.** The 38/124 finding is recorded, not acted on.
- **College grid colours.** Nobody has judged one. They keep today's behaviour.
- **The logo rulings** — that is prompt 64, and it touches `scripts/` and R2, not `web/`. The two are
  independent and can run in either order.
