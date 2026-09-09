# Prompt 81 — the MLB.TV deep link, the favourite card mark, and icon v8 + banner

Three independent blocks. Read `docs/handoff-status.md` first; it wins over `CLAUDE.md` wherever
they disagree.

**Do not commit and do not push — any block, at any point.** Each block ends with the work in the
tree, all five gates reported, and a diff for Joe. That is the standing rule, not this prompt's
preference.

File this brief verbatim at `docs/prompts/81-mlbtv-deeplink-favourite-mark-icon-v8-banner.md`.
Note in passing that `docs/prompts/` currently stops at 60 — briefs 61–80 are unfiled. That is a
known filing gap, it is **not** this prompt's job, and it is not a reason to renumber this one.

**The gate floors live in `docs/handoff-status.md` under "Repo state" and nowhere else.** Read them
there before you start and report all five afterwards. At the time this prompt was written that
table read pytest 514+1 skipped / test:unit 552 / smoke 33/33 / qa-shots 91/91 / geometry all hard
stops — treat those as informational only, not as the floor. The floor is whatever that table says
when you read it.

The three blocks touch nothing in common and may be reordered. Suggested order: **F** first (small,
no layout, and Joe can check it on his phone in ten seconds), then **D2** (list layout), then **E**
(art and banner). One commit per block, none of them made without Joe's word.

---

## Block F — the MLB.TV link opens the MLB app, on a per-game address

### F0. What was measured, and by whom

Joe ran the tap test at `docs/research/mlb-tv-tap-test.md` on his iPhone on 2026-09-09. Both links
were tapped from Messages, not typed into Safari. Results, in his words:

- `https://www.mlb.com/tv/g824791` (a real gamePk) → **MLB app, on the Guardians page**
- `https://www.mlb.com/tv/g999999999` (the control, a gamePk that does not exist) → **MLB app, on
  the Guardians page**

**What that licenses and what it does not.** iOS hands `mlb.com/tv/g*` off to the MLB app on Joe's
phone — that is settled, and it is the whole point of the change below. Whether the app *reads* the
game number is NOT settled: the control link, which cannot resolve to a game, landed on the same
screen, so the real link's landing is indistinguishable from a fallback to Joe's favourite club.
Do not write a claim either way into any doc. The URL shipped is the same under both readings.

### F1. The link

`web/lib/config.js:329` currently holds:

```js
'guardians-tv': 'https://www.mlb.com/guardians/schedule/watch',
```

That entry stays as the fallback. Add a per-game builder beside it:

```js
export function mlbAppUrl(game) { … }
```

- It returns `https://www.mlb.com/tv/g<gamePk>` when `game.id` matches `/^mlb-(\d+)$/`, and
  `null` otherwise. Nothing else. No try/catch swallowing, no default.
- **The gamePk is already in the row and needs no data work.** `adapters/mlb.py:302` reads
  `pk = g.get("gamePk")` and `:350` writes `"id": f"mlb-{pk}"`. Confirm that at those two lines
  yourself before you rely on it — Cowork asserted this id scheme once before on bad reasoning and
  was wrong about the reasoning even though the scheme held.
- The regex is the guard, not a comment: `mlb-114` is a TEAM id (`adapters/mlb.py:66`) and shares
  the prefix. A team id will never reach a game row here, but the anchored `\d+` costs nothing and
  removes the question.

### F2. The call site

`web/components/GameDetail.js` renders each accessible broadcast at `:309`:

```jsx
<WatchLink key={…} service={b.service_id}
           name={b.network?.canonical_name || b.label || b.service_id}
           big={i === 0} />
```

`WatchLink` already takes an `href` that overrides `watchUrl(service)` (`:54`, `:62`) — it is how
the DIRECTV link is built at `:327`. So this is one prop, not a new component.

Pass the deep link only where it means something. `guardians-tv` is the service Joe named, and it is
the only key in the `WATCH` map whose destination is the MLB app. **Apply rule 32 before you decide
it is the only one**: `git grep` the service ids, not the concept, and say what you searched. If a
second MLB-app service exists, it takes the same treatment; if it does not, say so and move on.

**The DIRECTV link at `:327` is untouched.** Joe's ruling stands verbatim: *"I want to keep that link
alive in addition to DirecTV — two separate links — because the MLBTV feed offers more features."*
Two links on the card, and the MLB.TV one is the one that changes.

### F3. `target="_blank"` — a hypothesis, deliberately not acted on

`WatchLink` renders `target="_blank" rel="noopener noreferrer"` (`GameDetail.js:64-65`). Joe reported
earlier in this session that DIRECTV links tapped **from inside MySports TV** opened Safari rather
than the DIRECTV app, while the MLB links tapped from Messages opened the MLB app.

There is a plausible explanation — that a `_blank` tap from a standalone home-screen web app lands in
an in-app browser view where iOS does not perform the hand-off — and it is exactly the shape rule 34
says to distrust: a claim of the form "X prevents Y" about a platform, recalled rather than checked.

**So do not change `target` in this block.** Ship the link as it is, and record in
`docs/research/mlb-tv-tap-test.md` that the next instrument is Joe tapping the new MLB.TV link from
inside the app: if it opens the MLB app the question is closed, and if it opens Safari then dropping
`target="_blank"` for deep links is the next thing to test — one line, one commit, measured.

### F4. The research note stops recording a test with no result

`docs/research/mlb-tv-tap-test.md` currently describes a test and an empty outcome table. Rule 30:
a note recording an absence is a timestamp, not a fact, and the correction lands **in the same commit
as the work it misled**. Fill in the outcome table with F0's two results, date it, name the device,
and state plainly what is settled and what is not. Add the in-app tap as the open follow-up.

### F5. Tests

- Unit: `mlbAppUrl` returns the expected URL for `mlb-824791`, `null` for `cfb-…`, `null` for
  `mlb-` with no digits, `null` for `undefined`.
- Call-site pin, not a row count (rule 19's habit applied to render code): assert that
  `GameDetail.js`'s service-row `<WatchLink>` passes an `href` derived from `mlbAppUrl`, and that
  the DIRECTV link at `:327` still passes `DIRECTV_STREAM`.
- **Mutation-check the two assertions before you report them green.** Break the regex, break the
  call site, and confirm each test actually fails. This repo has found seven vacuous assertions of
  the `indexOf(…) < indexOf(…)` shape; do not add an eighth.

### F6. Gates, then stop

Run all five as their own commands (rule 26). Report all five. Secret-gate ADDED lines only with
`grep` (rule 3). Stage by explicit path (rule 4). Then **stop. Do not commit and do not push** —
leave the work in the tree and show Joe the diff.

---

## Block D2 — the float goes, and the card carries the mark

### D2a. Why this is one commit and not two

Removing the float and marking the card are two halves of one change. Land them apart and there is a
commit in between where Joe's teams are ordered correctly and marked by nothing at all. That is not
an "intentionally known-broken state" worth preserving — it is a state nobody chose. One block, one
commit.

### D2b. The defect, stated from the code

`app/page.js:334` and `:561` already sort every row through `chronological(rows, favIds)` — the D1
change in `4e495b8`, which puts a pregame show before its game and a favourite ahead of a stranger at
the same minute. That is the order Joe asked for.

`components/SportBand.js:67-69` then takes those correctly ordered rows and splits them:

```js
const split = useMemo(() => splitFavorites(games || [], favIds), [games, favIds]);
const favorites = floatFavorites ? split.favorites : [];
const rest = floatFavorites ? split.rest : (games || []);
```

and renders `favorites` in a `.favgroup` above `rest` (`:164-168`). **The page sorts and the band
un-sorts it.** Joe's ruling is that a band reads as a timeline with the favourite winning only a tie
— so the hoist is what has to go.

### D2c. What to remove

Rule 32: enumerate the renderers by grepping the CLASS, the COMPONENT and the CONDITION, not the
concept, and name each search you ran. What is known to be in scope:

- `components/SportBand.js` — the `floatFavorites` prop (`:49`), the `split`/`favorites`/`rest`
  block (`:67-69`), the `.favgroup` wrapper (`:164-168`), and the long comment block at `:145-163`
  that explains a bracket which will no longer exist.
- `components/Listing.js` — the prop (`:55`), the two pass-downs (`:273`, `:304`), and the
  explanatory comments at `:35-44`, `:265-268` and `:285`.
- `app/page.js:451` and `:703` — `floatFavorites={!P.isMine}` at both call sites.
- `app/globals.css:2048-2096` — the `.favgroup` rule and the comment block above it. **Keep the
  measured table** (inset vs body width vs name tiers) somewhere it still applies: it is the reason
  D2c chooses what it chooses below, and deleting a measurement because the element it measured
  changed shape is how this repo loses its evidence.
- `lib/favorites.js` — `splitFavorites` (`:33`) becomes unused. Retire it **only if** nothing else
  imports it; `favoriteIds` and `isFavorite` both stay, because the mark below needs them.
- `test/favbracket.test.mjs`, `test/favorites.test.mjs:71-89`, `test/pageorder.test.mjs:37,113-118`,
  `test/rhythm.test.mjs:34`, `scripts/qa-shots.mjs:767-775`.

### D2d. The mark — and why it is NOT `outline`

Joe's words: *"make the gold line a gold OUTLINE of the card."* Take the meaning, not the CSS
property, because the CSS property is already taken:

```
globals.css:1011-1016
button.chip:focus-visible,
a.chip:focus-visible,
button.mcard:focus-visible,
input:focus-visible {
  outline: 2px solid var(--gold);
  outline-offset: 2px;
}
```

The card is a `<button>` and its focus ring is **`2px solid var(--gold)`** — character for character
what a favourite mark drawn with `outline` would be. Ship it as `outline` and every favourite card
looks permanently focused, and the real focus ring becomes invisible on exactly the cards Joe cares
about most. Verify that rule at those line numbers before you accept this reasoning.

**Use the border the card already has.** `.mcard` is `border: 1px solid var(--line-soft)` with
`border-radius: var(--radius)` (`globals.css:473-474`), so recolouring it costs **zero layout** — no
new box, no change to the `minmax(0, 1fr)` body track that `fitNameAndRecord` sizes names against,
which is the exact cost the 2048-block measured for the old bracket.

- The class goes on the **row wrapper**, not on the card. `SportBand.js:81-95` builds every row
  through one `row(g)` whose wrapper already carries `rowClass(g)` (`:74-79`) — that is where
  `offsvc-row`, `pending-row` and `networktbd-row` live, and its comment says outright that
  `MatchupCard` is locked and nothing reaches inside it. Add the favourite to that same
  `rowClass` list, computed from `isFavorite(g, favIds)`.
- CSS: recolour the card's existing border to `var(--gold)` under that wrapper class. Read the token
  from `globals.css`, never retype a hex (rule 16).
- The four existing wrapper classes are mutually exclusive by construction; the favourite class is
  **not** — an off-service game can be a favourite. Make sure the two compose rather than one
  silently winning, and pin that with a test.

**If 1px reads too quiet on the device, the escalation is one line** — add
`box-shadow: 0 0 0 1px var(--gold);` so it reads as 2px while still costing no layout, and the focus
ring still renders outside it at `outline-offset: 2px`. Do not ship the escalation preemptively.
Render it in the QA shot alongside the 1px version so Joe can pick from a picture rather than a
description.

### D2e. MY TEAMS suppresses the mark

Under MY TEAMS every row is a favourite, so marking them all marks nothing and adds a gold border to
every card on the page. Suppress it there, using the same predicate the float used — `!P.isMine` —
so the two behaviours stay in one vocabulary rather than two. This is a judgment call made in the
prompt, not a question for Joe; if you disagree with it after reading the code, say so before
implementing rather than implementing something else.

### D2f. Two things that look like they are in scope and are not

- **`docs/design/mobile_demo.html` does not implement the bracket** — `grep -c favgroup` returns 0.
  Rule 23 does not fire for this block. Confirm that yourself; do not invent a change there.
- **The phone grid does not render `.favgroup`.** The bracket is list-view only, so the geometry
  tripwire should not move at all. **Assert it, do not assume it**: `npm run geometry` is one of the
  five gates and block counts and widths moving is a hard stop.

### D2g. Tests

- `test/favbracket.test.mjs` is written against a bracket that will not exist. Rewrite it against
  the mark: the wrapper class is applied when `isFavorite` is true, not applied when false, not
  applied under MY TEAMS, and composes with `offsvc-row`.
- `test/favorites.test.mjs:71-89` and `test/pageorder.test.mjs:37,113-118` pin `splitFavorites`.
  If the function is retired, those tests go with it — but **replace the property they were
  protecting**, which is that a band reads chronologically. Pin that against `chronological`
  instead, so the coverage moves rather than disappearing.
- `test/rhythm.test.mjs:34` asserts `.favgroup { … margin-bottom: 8px }` — the 8px "inside one
  group" step. Removing the group removes the rule; confirm the vertical rhythm between cards is
  still whatever prompt 56 §24d specifies and pin the surviving rule, not the deleted one.
- `scripts/qa-shots.mjs:767-775` counts `.favgroup` and reads its border. Repoint those three at the
  new mark, and add a shot of a band that mixes favourites and strangers so the ordering itself is
  visible in an artifact.
- **Mutation-check every assertion you write or rewrite here** before reporting the gate green.

### D2h. Records

`docs/enhancement-register.md` and `docs/handoff-status.md` both carry the bracket as a shipped
decision (prompt 59). Record the supersession — what changed, Joe's words, and the measured reason
the mark is a border and not an `outline`. That last one is the part a future run will otherwise
rediscover the hard way.

### D2i. Gates, then stop

All five, as their own commands, reported. Secret gate ADDED lines only. Stage by explicit path.
Then **stop. Do not commit and do not push** — leave the work in the tree and show Joe the diff and
the QA shots.

---

## Block E — icon v8, and three banner changes

Joe's brief, incorporated. **Cowork checked it against the tree before folding it in and found three
defects and two traps.** They are marked ⚠ below. Everything not marked was verified and holds.

### E0. What Cowork measured (2026-09-09, on the file bytes)

Read these as facts about the files, not as a certification of anything that runs. **Rule 1 still
stands: certify the Python interpreter for Windows before you run any Python.** These figures were
taken on Cowork's Linux device shell with Pillow 12.3.0 and say nothing about your interpreter.

**The cutout swap is safe, and here is the actual proof.** The draft asked you to verify that
`tv-cutout.png` and `tv-cutout-dark.png` share a box. They do, and more strongly than the alpha
bounding box shows — both are 1110×1167 RGBA, and their **alpha channels are byte-identical**
(`ImageChops.difference(...).getbbox()` is `None`). The silhouette is unchanged, so no `x`, `y`, `w`
or `h` in either JSON can be wrong. The RGB difference is confined to `(107, 411)–(721, 910)` —
36.24% of opaque pixels, max delta 239/255 — which is the screen going black and nothing else. Note
that the alpha bbox alone would NOT have proved this: both images are opaque to all four edges, so
that test returns the full frame either way. Re-derive it if you want it; do not re-derive the
weaker test.

**Every icon destination already matches its v8 source, exactly.** No resize is needed and none
should be attempted:

| live file | current | v8 source | source |
|---|---|---|---|
| `web/public/brand/app-icon-mysports-tv.png` | 1024×1024 RGB | 1024×1024 RGB | `icon-v8/app-icon-mysports-tv-v8-1024.png` |
| `web/public/icon-512.png` | 512×512 RGB | 512×512 RGB | `icon-v8/icon-512.png` |
| `web/public/icon-192.png` | 192×192 RGB | 192×192 RGB | `icon-v8/icon-192.png` |
| `web/app/apple-icon.png` | 180×180 RGB | 180×180 RGB | `icon-v8/apple-touch-icon-180.png` |
| `web/app/icon.png` | 48×48 RGB | 48×48 RGB | `icon-v8/icon-48.png` |

All five destinations are tracked. Confirm each destination's size yourself before overwriting it
anyway — it is two lines and it is the one mistake here that would silently ship a degraded icon.

### E1. Install icon v8

⚠ **`git mv` will fail. Use a plain `mv`.** The draft's step 1 is
`git mv assets/brand/app-icon-mysports-tv.png assets/brand/app-icon-mysports-tv-v7-retired.png`.
`git ls-files assets/brand/` returns **nothing** — the whole directory is untracked, and `.gitignore`
does not mention it, so these files were simply never added. `git mv` on an untracked path is a fatal
error. `assets/` is untracked and is not drift (standing brief); nothing under it gets staged in this
block at all.

1. `mv assets/brand/app-icon-mysports-tv.png assets/brand/app-icon-mysports-tv-v7-retired.png` —
   plain `mv`, matching the existing convention (`-v5-retired.png`, `-v6A-rejected.png`, both
   present).
2. Copy `assets/brand/icon-v8/app-icon-mysports-tv-v8-1024.png` to
   `assets/brand/app-icon-mysports-tv.png`.
3. Replace the five live files from the table in E0. Confirm each destination's current pixel size
   first. If any destination is not the size that table claims, **stop and report** — do not resize.
4. Read `web/app/manifest.js`, confirm the icon entries still point at those paths with the right
   `sizes` strings, and change nothing unless a size string is now wrong.
5. Leave `assets/handoff/banner-v2/icon/*` alone — that package is the dated v7 handoff record.

### E2. Banner change 1 of 3 — the title halo goes dark

Both banners paint a **gold** glow behind the gold wordmark; the icon uses a **dark** halo. Match the
icon.

Delete `bnTitleGlow` and `bdTitleGlow` and replace each with a two-pass dark halo. Radii are the
icon's own, as a ratio of cap height (Barlow Condensed Bold cap height ≈ 0.72 × font size):

- wide pass `stdDeviation = 0.306 × cap height`, alpha slope 1.9
- tight pass `stdDeviation = 0.097 × cap height`, alpha slope 2.7

| breakpoint | fontSize | cap height | wide | tight |
|---|---|---|---|---|
| mobile | 36 | 25.9 | **7.9** | **2.5** |
| desktop | 55 | 39.6 | **12.1** | **3.8** |

Both font sizes verified: `banner-mobile-v2.json:85` is 36, `banner-desktop-v2.json:85` is 55.

Mobile filter (desktop is identical with the desktop numbers and a `bd` prefix):

```svg
<filter id="bnTitleHalo" x="-25%" y="-140%" width="150%" height="380%"
        colorInterpolationFilters="sRGB">
  <feGaussianBlur in="SourceAlpha" stdDeviation="7.9" result="w"/>
  <feComponentTransfer in="w" result="wide"><feFuncA type="linear" slope="1.9"/></feComponentTransfer>
  <feGaussianBlur in="SourceAlpha" stdDeviation="2.5" result="t"/>
  <feComponentTransfer in="t" result="tight"><feFuncA type="linear" slope="2.7"/></feComponentTransfer>
  <feMerge><feMergeNode in="wide"/><feMergeNode in="tight"/></feMerge>
</filter>
```

The halo text pass changes from

```svg
<text ... fill="#C6AF7A" opacity=".55" filter="url(#bnTitleGlow)">MYSPORTS TV</text>
```

to

```svg
<text ... fill="#000000" filter="url(#bnTitleHalo)">MYSPORTS TV</text>
```

Keep the gold text pass, the `bnGold` / `bdGold` gradient, the sheen mask and the sheen animation
exactly as they are. Only the glow pass beneath the type changes.

**Where each one lives, verified:** the mobile filter is *generated* at
`scripts/build_banner_mobile.py:128` and referenced at `:161`, so it is edited in the generator and
regenerated. The desktop filter is *hand-written* at `web/components/BannerDesktopV2.jsx:13` — the
draft's "there is no desktop generator" is correct; `scripts/` contains `build_banner_mobile.py` and
no desktop equivalent.

⚠ **Both JSONs also carry a prose description of this filter and the draft never updates it.**
`filters.title_glow` reads `"feGaussianBlur sd10 on a #C6AF7A copy at opacity .55"` in
`banner-mobile-v2.json` and `"…sd10.0…"` in `banner-desktop-v2.json`. Leave those and the JSON —
which this repo treats as the source of truth — documents a gold glow the generator no longer emits.
Rewrite both to describe the two-pass dark halo. Same failure the draft correctly catches in the
generator's header comment; it just occurs twice more.

### E3. Banner change 2 of 3 — the blacked-out set

In **both** `web/lib/banner-mobile-v2.json` and `web/lib/banner-desktop-v2.json`, change `tv.file`
from `"tv-cutout.png"` to `"tv-cutout-dark.png"`. Nothing else in that block — `x`, `y`, `w`, `h`
all stay, and E0 is why.

Leave `web/public/banner/tv-cutout.png` in place and tracked. It becomes unreferenced, which is
intentional: it is the way back if Joe wants the lit screen.

⚠ **`web/public/banner/tv-cutout-dark.png` is UNTRACKED and the draft never says to track it.**
`git ls-files --error-unmatch` fails on it today. Point the JSON at a file git does not have and the
deploy serves a 404 where the television should be — green gates, broken banner, and the geometry
tripwire would not notice because it does not render the banner. **Stage it by explicit path**
(rule 4; never `git add -A`). Its bytes are identical to `assets/brand/tv-cutout-dark.png`
(sha256 prefix `d37e5f464552b369` on both), so no copy step is needed — only the staging.

### E4. Banner change 3 of 3 — the faint ring around the set

Joe spotted a faint rounded outline around the TV. It is real: it is the hard outer stop of the two
warm radial glows — `bnGlow0`/`bnGlow1` on mobile, `bdGlow0`/`bdGlow1` on desktop — whose last stop
is 0.021 and 0.028 rather than 0, so the fill ends abruptly at the ellipse boundary. Verified in both
JSONs at `glow[0].alpha_stops` and `glow[1].alpha_stops`, exactly as quoted.

**This reverses a documented decision** (rule 10 — checked, and this is Joe overriding it in
conversation, not a re-raise). Prompt 45 kept those tails deliberately. Joe chose the re-taper over
the outright zero.

Re-taper: keep every existing stop, add a stop at 95% sitting exactly on the current 82→100 line, and
end at zero. Only the last 5% of each radius changes.

| gradient | new stop list |
|---|---|
| `bnGlow0` / `bdGlow0` | 0% → 0.32, 45.3% → 0.176, 82% → 0.058, **95% → 0.0313**, **100% → 0** |
| `bnGlow1` / `bdGlow1` | 0% → 0.42, 45.3% → 0.231, 82% → 0.076, **95% → 0.0413**, **100% → 0** |

Measured at the mobile breakpoint, glow colour rgb(255,170,60) over the stage ground: the edge being
removed is a step of **3.0/255** (outer) and **4.1/255** (inner); the re-taper changes **3.16%** of
the visible stage, max delta **3.53/255**; zeroing the tails outright would have changed **11.38%**,
which reproduces prompt 45's recorded 10.6% and is why the re-taper was chosen.

⚠ **Rule 17 governs both JSON edits.** Edit them through a parser, never line-based, and assert that
nothing but `tv.file`, the two `alpha_stops` arrays and `filters.title_glow` changed. Rule 29 applies
to the write: these are tracked files, so the writer passes `newline="\n"` or writes bytes.

**Rewrite the header comment in `scripts/build_banner_mobile.py`.** The paragraph beginning
`THE GLOWS' OUTER STOPS ARE LEFT AS DESIGNED` is at **lines 69–74**, and it is not an ordinary source
comment — it is inside the string the generator *emits into* `BannerMobileV2.jsx` as a `//` block. So
it is generated output, the `--check` round-trip exercises it, and leaving it means the generator
ships a paragraph asserting the opposite of what it just generated. Record the new decision and E4's
figures.

### E5. Regenerate and verify

1. `python scripts/build_banner_mobile.py --check` — expect **DRIFT** before you regenerate. The
   flag exists (`:184`) and the message is at `:190`.
2. `python scripts/build_banner_mobile.py` — regenerates `web/components/BannerMobileV2.jsx`.
3. `python scripts/build_banner_mobile.py --check` — must now report a match.
4. Hand-edit `web/components/BannerDesktopV2.jsx` to match its JSON. Touch only the defs and the
   title passes. No coordinates.
5. ⚠ **Do not run `next build`.** The draft says "build and check the three banner routes render";
   rule 12 says a local `next build` cannot succeed here at all (the apostrophe in `Joe's Projects`),
   and rule 36 says running one against a live `next dev` corrupts `web/.next` and costs a run's
   worth of misattributed failures. Use the dev server and **read the rendered SVG**, as the draft's
   own wording asks: confirm `<image href>` is `/banner/tv-cutout-dark.png`, the halo text is
   `#000000` behind `#bnTitleHalo` / `#bdTitleHalo`, and each glow gradient has five stops ending
   at 0.
6. Report the diff summary and stop.

### E6. Two things that look like they are in scope and are not

- **`docs/design/mobile_demo.html` does not carry the banner artwork.** `grep -c` for
  `bnTitleGlow|bnGlow0|tv-cutout` returns **0**; the reference governs the banner's 124px height and
  its behaviour, not its internals. Rule 23 does not fire for E — the banner's box does not move.
  Confirm that yourself rather than taking it from here.
- **The geometry tripwire does not render the banner.** It should not move by a pixel. Assert it;
  `npm run geometry` is one of the five gates either way.

### E7. Gates, then stop

All five, as their own commands, reported. Secret gate ADDED lines only with `grep` (rule 3). Stage
by explicit path, including the untracked `tv-cutout-dark.png` (rule 4). Then **stop. Do not commit
and do not push.**

### E8. The known open item, restated

Rule 25's second half is outstanding: Joe confirms on the device. **Icons in particular will not
update on an installed PWA until the icon cache clears**, so his phone may show v7 after a green
deploy — and the asset-version token that fixed the logo cache does not reach `web/public/icon-*.png`
or `web/app/icon.png`, because those are named by the manifest and by iOS, not built by
`config.js`. Say so in your report. A stale tile on Joe's home screen is not a failed deploy, and
this session has already burned three false bug reports on exactly that confusion.

---

## What this prompt deliberately does not do

Nothing is held back. Blocks F, D2 and E are the whole of the outstanding queue as of 2026-09-09.
Still awaiting Joe's word, and not part of this prompt: pushing `dce1948` and `4e495b8`.
