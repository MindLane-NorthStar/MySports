# Prompt 41 — the tinted-surface ink defect shipped in prompt 40

**Run in Claude Code**, in `C:\Users\jlull\Joe's Projects\Apps - Personal\MySports` on `main`, off HEAD `bf5a297` (prompt 40's stage 4). Two stages, self-committing, the standing gates and rules (explicit-path staging, `grep` secret gate on added lines, push and verify the rev-parse pair). **Nothing is written to the database.**

## The defect, located

`web/lib/gridmodel.js`: `tint()` returns a CSS string — `rgb(126, 133, 137)` — and `rgbOf()` parses only `#rrggbb`. So on every tinted surface `contrastRatio(colour, surface)` returns `null`; in `inkFor()` the team-colour loop never sets `best`, `rInk` and `rChar` are both `null`, `null >= null` is `true`, and the function returns `{ ink: '#f2f2f0', ratio: null, neutral: true }`. Reproduce in one line from `web/`:

```
node --input-type=module -e "import {inkFor,bandFor,tint} from './lib/gridmodel.js'; const b=bandFor('#ba0c2f','#a7b1b7'); console.log(inkFor(tint(b.band,0.72),'#ba0c2f','#a7b1b7'));"
```

Expected by the rule (M15 as written in prompt 40's stage 4): `#101214` at 5.01:1. Actual on `bf5a297`: `#f2f2f0`, `ratio: null`.

**Consequence: all 109 tinted teams render white names**, whatever their colours. Measured against the rule: 76 of them have the wrong ink, 60 of those sit under 3.0:1, and eleven are white on `#bdbdbd` at **1.68:1** — UMass, NC State, Nebraska, Ohio, Ball State, E Michigan, Wisconsin, UAlbany, Northwestern, Colts, Red Wings. `artifacts/qa/2026-09-04/ballstate-ohiostate.png` shows it (white "BALL STATE" on light grey, where the rule gives scarlet at 3.51:1 and charcoal for Ohio State at 5.01:1); `falcons-steelers.png` shows white "@ STEELERS" on dark gold where the rule gives black at 7:1. This is live on main and therefore on Vercel.

**Why the gates missed it.** The JS pin ran `inkFor` only against band surfaces, which are hex; the 191 / 116 / 0 count and the 26-team list were computed on the Python side; the screenshots were read with the expectation that light neutrals were correct. Prompt 40's report withdrew the brief's "Ohio State → charcoal" as a brief error — the brief was right and the runtime was wrong.

## Stage 1 — fix and pin

1. Make `rgbOf()` accept `rgb(r, g, b)` and `rgba(r, g, b, a)` as well as 6-digit hex, so `luminance()`, `contrastRatio()` and everything built on them work on `tint()`'s output. Keep `tint()`'s return type — `gridbands.test.mjs` pins its grey-fallback string, and the CSS consumers are fine with it.
2. `inkFor()` must never return a null ratio. If the surface still does not parse, throw with a message naming the surface — the surface always comes from our own code, so an unparseable one is a programming error and the tests, not the phone, should be where it fails.
3. Tests, `node --test`, no new deps:
   - `inkFor(tint('#a7b1b7', 0.72), '#ba0c2f', '#a7b1b7')` → `#101214`, ratio ≈ 5.01 (Ohio State).
   - `inkFor(tint('#ffffff', 0.72), '#ba0c2f', '#ffffff')` → `#ba0c2f`, ratio ≈ 3.51 (Ball State keeps scarlet).
   - `inkFor(tint('#ffb612', 0.72), '#000000', '#ffb612')` → `#000000` (Steelers keep black).
   - `inkFor('rgb(0, 0, 0)', …)` and an `rgba(...)` form parse; `inkFor('not a colour', …)` throws.
   - **The JS/Python agreement test that was missing.** Have `scripts/build_cap_table.py` also emit `web/test/fixtures/team-colours.json` — `id`, `primary`, `secondary` for every team in the table, from the same SELECT it already makes. A JS test walks every one of the 307 fixture-listed teams through `capFor` → surface → `inkFor` and asserts: 191 team-colour / 116 neutral / 0 under 3.0:1 / minimum ratio ≥ 3.0; on the 109 tinted teams exactly **56 team-colour, 20 charcoal, 33 white**, with the charcoal set equal to: Towson, New Hampshire, New Mexico, Ohio State, Abilene Chrstn, Nicholls, N Dakota St, Norfolk St, VMI, Indiana St, Florida St, South Florida, Iowa State, Angels, Mavericks, Chiefs, Chargers, Lions, Red Wings, Sabres; and the 26 teams that lose a team-colour ink equal to prompt 40's list. Match by team id, not name. Any difference is reported, not tuned away.
4. Gates, commit.

## Stage 2 — re-render and re-look

Re-shoot the same fifteen blocks at 390 px into `artifacts/qa/2026-09-04-ink/` and look at: Ball State @ Ohio State (scarlet on light grey / charcoal on mid grey), Falcons @ Steelers (black on dark gold), W Michigan @ Michigan (brown on dark gold beside navy on maize), Ravens @ Colts (navy on light grey), Louisville vs Ole Miss (white on the 0.72 red, and the marquee plate). Confirm cap background still equals name-row background on all fifteen and the seam is unchanged. Geometry re-measured against the frozen numbers (CFB 62 / 240, 223 / 1073; MLB 3 / 231 / 582). Nothing in the addendum changes — the rule was right — but add one line to the contract changelog under v1.6.11 recording that `bf5a297` deviated from M15 on tinted surfaces and where it was corrected. Commit, push, verify.

## Report

Per stage: what shipped, commit, gates; the one-liner's output before and after; the runtime counts from the JS test; the re-look findings; anything here that turned out wrong.
