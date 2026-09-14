# Rules casebook — the incidents behind the working rules

**The binding working rules are in `CLAUDE.md`, section "Working rules (binding)", and nowhere else.
This file is history — the incidents that produced those rules. It is append-only. It never states a
rule and it is never the authority on one.** Where anything here seems to disagree with `CLAUDE.md`,
`CLAUDE.md` is right and this file is only older.

**Where it came from.** Prompt 89 (2026-09-11, register §38) created it when `CLAUDE.md` took sole
ownership of the rules. Until then `docs/handoff-status.md` carried a second, longer copy of the rules,
and for rules 19, 21–24 and 26–34 that copy held incident detail `CLAUDE.md` does not: the prompt
numbers, the file paths, the measurements, the way each failure hid. That detail is below, moved
**verbatim** from `docs/handoff-status.md` as it stood at `09dcf72` (only the list indentation was
removed). Each entry holds only what `CLAUDE.md` does not carry; where a detail needs its old rule
sentence to make sense, that sentence is quoted (`>`) as it then read — it is not a restatement of the
rule. Rules with no entry had nothing beyond what `CLAUDE.md` says.

**State does not live here either.** An open item mentioned in an entry is tracked in
`docs/handoff-status.md`. **Append-only:** when a rule gains an incident, add to its entry or add an
entry; do not rewrite a past one.

### Rule 19 — Never issue an unbounded PostgREST select

> Pin regression tests to the **call site**, never a row
> count, or the test rots as the season grows.

### Rule 21 — the retired stub

~~`git diff --ignore-cr-at-eol`~~ **RETIRED** — the condition it waited on was met. Kept as a
numbered stub so rules are never renumbered under a session that memorised them.

### Rule 22 — Read the component, never the contract

Prompt 46 found its own brief naming `fitNameAndRecord()` as the grid's fit
function when it belongs to the list card and the grid never calls it.

### Rule 23 — The locked reference changes in the same commit

> A reference that lags the app stops being an authority and becomes
> a second opinion.

### Rule 24 — A Python-side count is no evidence the JS runtime agrees

> Pin the runtime path
> on every kind of input it can receive.

### Rule 26 — The gate and the commit are separate commands

`b1b1d9b` went out red because a commit was
`&&`-chained after a gate whose final command was a `grep` that succeeded.

### Rule 27 — Check the schedule before a bulk database write

Prompt 46's
pre-approved `--all` reconcile started at 13:40:38 and the scheduled daily refresh — already
running since 13:37:02 — died five seconds later with `ERROR: deadlock detected` in its fixture
loader. The cron is `0 11 * * *` and drifts by up to four hours, so "it is the afternoon" is not
an answer; `gh run list --workflow schedule_refresh.yml -L 1` is. The same rule is why prompt
47's NASCAR load waited for its own NHL/NBA bootstrap to finish rather than running beside it.

### Rule 28 — A Python-side parse is no evidence GitHub Actions agrees

PyYAML validated a
`bootstrap_season.yml` that Actions could not parse at all, and prompt 46 shipped it green. An
Actions expression is substituted everywhere in a `run:` block — inside shell comments too — and
an empty one is a syntax error for the whole file.

### Rule 29 — A text write with no `newline=` produces different bytes

Python's text mode translates every `\n` to the platform separator, so
`path.write_text(x, encoding="utf-8")` emitted CRLF on this laptop and LF on Actions - one
adapter, two byte streams, depending on where it ran. `adapters/common.py`'s `dump_json` and
`write_text` did exactly that, and `scripts/build_cap_table.py` did it to two tracked files.

This is rule 1 in a costume; it gets its own number because rule 1 did not stop it.

**`tests/fixtures/*` is `-text` ON PURPOSE** (prompt 48): recorded fetches are asserted as
bytes, four tests pin a `sha256` and one pins a byte count, and normalisation on checkout
would break those on every machine but the recording one. So a recorded page KEEPS its CRs -
`indycar_2026_schedule.html` carries 5,727 of them - and "no CR under `tests/fixtures/`" is
the wrong rule. The right one is **disk bytes == index bytes**, which
`tests/test_fixture_bytes.py` asserts for both fixture directories.

**How it hid.** `.gitattributes` declares `*.json text eol=lf`, which normalises on read, so
git compared an LF blob against a CRLF working copy and reported the tree clean; git's stat
cache then never re-compared them. Prompt 49 stage 0 measured **34 tracked files** whose disk
bytes differ from their blobs - pure line-ending churn, identical payload. Five were restored
(the four `tests/fixtures/*_raw.json` and `web/test/fixtures/team-colours.json`); the other
**29 are an open item**, because renormalising them rewrites 29 files and touches blame, and
that deserves its own commit and Joe's sign-off rather than a ride-along.

*The open item above — the tracked files still to be renormalised — is state, and its status lives in `docs/handoff-status.md` under `## Open`, not here.*

### Rule 30 — A note recording an absence is a timestamp

> Before acting on "missing", "not yet
> filed", "no mark in the tree", "none exists" or "TBD", **check the thing itself** - and when the
> note turns out to be stale, **correct the note in the same commit as the work it misled you
> about**, rather than leaving a corrected repo described by an uncorrected file.

Two instances in one run, prompt 52, which is why this is a rule and not an anecdote:

- **`data/brands.json`'s `bignoon` carried "no mark in the tree; FOX's cached wordmark is
  monochrome, so no colour to derive."** `web/public/programs/big-noon-kickoff.png` had existed
  since 2026-09-02 - four days - built correctly through the pipeline and referenced by nothing.
  The note was true when written and false when read. Stage 6 caught it only because the prompt
  named it; the colour it said could not be derived came out at 70.9 % saturated pixels.
- **`docs/prompts/README.md` carried a deliberate "Prompt 50's own brief is not yet filed",
  naming its exact path in `Claude outputs\`.** Stage 8 read that section, concluded 50 and 51
  were permanently lost, wrote "could not be reconstructed" into `docs/handoff-status.md`, and
  moved on - without opening the path the note had just given it. Both briefs were filed from
  that path minutes later (`cdfae84`) by copying, not reconstructing.

**The failure mode is the same both times: a note about an absence was read as evidence of the
absence.** The two are different ages. A note ages; the tree does not. The check is cheap - one
`ls`, one `git grep`, one `Test-Path` - and both misses cost a stage each.

**The second half of the rule is the half that was missed.** Prompt 52 corrected `bignoon`'s note
in the same commit as the wiring, which is the rule working; it then left its own false claim
standing in `handoff-status.md` for two commits after `cdfae84` had disproved it. Prompt 53
stage 1 is that cleanup, and it should not have needed a stage.

### Rule 31 — A search that finds nothing is evidence about the query

> **Name
> the search you ran** in the report, so the reader can see what was and was not asked.

**THIS IS NOT RULE 30 IN A COSTUME, and the distinction is the remedy.** Rule 30 is about a claim
that was TRUE WHEN WRITTEN and went stale; its fix is "check the thing itself". Here the files
were correct and current, the thing itself WAS checked, and the answer was still wrong - because
the question was asked in the wrong vocabulary. Rule 30's remedy does not catch this one.

**Four instances, three of them in one week:**

- **`nfl-network`, reported absent from `data/access_profile.json` and `data/row_order.json`
  TWICE** (prompt 54's report and the exchange before it). Both files carried it the whole time
  under the label **`NFL Network`**. The search was `'nfl-network' in json.dumps(...)` - the
  SLUG, against files that are LABEL-KEYED. The recommendation built on it was to ask Joe whether
  he even receives the channel, which was a real question made to look like a blocker.
- **`truTV` and `TBS`**, the same shape: `trutv` and `tbs` find nothing, `truTV` and `TBS` find
  both files.
- **`Paramount+` and `Disney+`, prompt 55 stage 2, caught mid-stage.** A slugify that mapped
  non-alphanumerics to `-` turned `Paramount+` into `paramount`, so a count of "access-profile
  networks without a mark" reported three when the answer was one. The published slugs are
  `paramount-plus` and `disney-plus`. **The rule was being written while the mistake was being
  made**, which is the best argument for it.

**The cheap defence is to search for the THING, not your spelling of it** - grep the file for a
distinctive substring (`NFL`, `Paramount`) before concluding, and read what shape came back. One
extra command; the misses above cost a wrong recommendation and a stage of rework.

### Rule 32 — A ruling is not implemented until every renderer obeys it

**THIS IS NOT 22, 30 OR 31 IN A COSTUME.** Rule 22 says read THE component before asserting what
it does; prompt 55's assertion about `Listing` was **correct**, and `Listing` really did obey the
ruling. Rules 30 and 31 are about an absence and about a query's vocabulary. Every fault below is
code that was **present, correct in its own file, and simply not the only file** — so none of the
three catches it.

**Four instances in one run (prompt 56), which is why this is a rule and not an anecdote:**

- **The reveal.** Joe ruled *"I only want list cards on list view and only grids on grid view."*
  Prompt 55 put that into `Listing`. `PageCount`'s reveal button kept opening sport bands, `<h2>`
  titles, matchup and program cards and the detail panel — **20 card and band elements under
  Day · All · GRID, 88 under Week · All · GRID**, measured. The two components never met.
- **The weekday heading**, rendered at two DOM levels by the same file: a `<p>` above the bands
  under ALL SPORTS, a `sectionLabel` inside `.band-headrow` with a tile picked.
- **The provenance line**, rendered on `rows.length` in day mode and on
  `(visible.length || hidden.length)` in week mode — so a day whose games were all off-service
  showed a count with no provenance while the identical week showed both.
- **"Does this day have content?"** — asked as `games.length` by day mode and `grouped[d]?.length`
  by week mode, so a programs-only day rendered an empty container on the laptop in one mode and
  answered properly in the other.

**The cheap defence is to name the OTHER renderer before you start.** Three of the four above are
one component rendering the same thing twice, or two components rendering the same thing
differently — findable in one `git grep` of the class or the prop, and each one shipped and sat
in the app for at least a prompt.

### Rule 33 — A note asserting that something exists is not evidence

> A file can be generated by a tool nobody has any more,
> and the comment will not know.

**THIS IS RULE 30'S MIRROR, AND THAT IS EXACTLY WHY IT NEEDS ITS OWN NUMBER.** Rule 30 fires on
a note recording an ABSENCE — "missing", "not yet filed", "none exists", "TBD" — and every
trigger word in it is a negative. This case is the opposite shape: a note recording a PRESENCE,
stated with total confidence, which nothing had checked. Rule 30 as written would never fire
here, because nothing said anything was missing. The remedy is the same — go and look — but the
prompt to apply it is inverted, and a rule you never think to invoke is not a rule.

**NOR IS IT RULE 22 IN A COSTUME.** 22 says read THE COMPONENT before asserting what it does,
and here the component was read: `web/components/Banner.js:5-7` says plainly that the JSON files
"ship as DOCUMENTATION", that "nothing reads them at build time", and that "if the design moves,
the JSON changes and the component is regenerated from it - coordinates are never hand-edited
here." Reading it was not the problem. Believing its claim about a tool **somewhere else** was.
22 governs what a file does; 33 governs what a file says about the world outside it.

**THE INSTANCE.** Prompt 57 stage 6 went looking for that generator to apply model F.
`git grep` for `banner-mobile-v2` returned docs, `Banner.js`, the JSX and the JSON itself —
nothing under `scripts/`, `pipeline/` or `tests/` read it. The tool had never been in the repo.
So the instruction "edit the JSON and regenerate" was unfollowable, and had been since prompt 42
wrote it: the only edit anyone could actually make was the one the comment forbade. The stage
wrote `scripts/build_banner_mobile.py`, proved it reproduced the committed component
byte-for-byte from the unmodified JSON, and only then moved a coordinate.

**AND THE SAME SHAPE HAD ALREADY BEEN RECORDED TWICE WITHOUT BEING NAMED.** `build_demo.py`,
which `docs/design/mobile_demo.html` says regenerates it, is project-only — prompt 55 noted the
consequence ("the repo copy cannot be regenerated") and annotated the file by hand instead. So
is `app_template.html`, `build_banner.py` and `markkit.py`. **Every one of those is a live
instance of this rule**, and the honest reading is that this repo has a class of documented
tools that do not exist in it, not a one-off.

**The cheap defence is one `git grep` for the tool's own name** before believing a sentence
about how a file is maintained. If it is not there, either write it or write down that it is
missing — and the second is what prompt 55 did, correctly, when writing it was out of scope.

### Rule 34 — A platform behaviour recalled from memory is not evidence

**THE INSTANCE.** Cowork told Joe that a sticky page header "creates a new containing block"
above the mobile grid's sticky rail, called it a serious risk, and shaped a whole risk profile
around it. **It is false.** `position: fixed` and `position: sticky` do not establish containing
blocks for descendants; only `transform`, `filter`, `perspective`, `backdrop-filter`,
`will-change` and `contain` do. The recollection was of a real rule, applied to the wrong
property.

**THE REPO ALREADY HELD THE CORRECT VERSION, on the exact selector it governs.** `globals.css`
on `.mrail-cell` says the rail holds *"only while nothing between this element and
`.mgrid-scroll` carries a transform: a transformed ancestor would become its containing block…
which is exactly the bug prompt 30 fixed. Do not add one."* One `grep` for `mrail-cell` would
have produced it.

**WHAT IT COST, and it is not nothing even though the brief self-corrected.** The false version
reached Joe as a serious risk before a later pass caught it. A risk profile that is wrong in the
direction of caution still spends the reader's attention and can talk a design out of existence.

**DISTINCT FROM 22 AND 33, and the difference is what you go and read.** 22 says read THE
COMPONENT before asserting what it does; 33 says a note asserting something EXISTS is not
evidence it does. Both point at this repository. **This one's object is the platform**, which no
file here is authoritative for — the repo happening to carry the right note this time was luck,
and next time it will not. When the claim is about a language or a runtime, the spec is the
authority and memory is not.

**The cheap defence is that platform claims are the easiest of all to check** — one search, and
the answer is normative rather than a judgement. Anything phrased as "X creates/blocks/prevents
Y" is the shape to distrust.

### Rules 30 and 33 — one brief, three revisions, no change reached the tree (2026-09-11, prompt 93)

On 2026-09-11 a Cowork brief (prompt 93, rev A) asserted that `assets/` was untracked, inferring it
from `assets/` being absent from `.gitignore` and from the standing "clean apart from `assets/`"
precondition. `git ls-files assets/` returns five tracked fonts. **The brief's own stop condition caught
it:** it required the runner's `local cache:` count to be 0, the logs said 5, and the run held before
any change. The inference is rule 30's shape — the label was checked, the thing was not.

The same brief asserted that every file in the gitignored Project mirror under `handoff/` was a copy of
a tracked document, and briefed the directory for deletion with an undo block that relied on it. **One
of fifteen was not:** a 9,684-byte prompt-48 text with no byte-identical blob anywhere in git history
and no copy anywhere under the repo. Deleting the directory as briefed would have destroyed the only
copy. That claim is rule 33's shape — a statement that something exists elsewhere, relied on without
opening the thing it names. The run found it while checking the claim, not because a gate asked.

Rev B corrected both and **stopped again, because its own stop condition could not pass**: it required
a recursive grep for the mirror directory's name to find only `.gitignore:28`, while its stage A mandated writing a provenance
header naming that path, and while the brief itself sat in untracked scratch under the repo, naming it.
The grep also found six closed briefs under `docs/prompts/` that name the path — history, not readers.
Rev C restricted the check to `git grep … -- ':!docs/prompts/'`, dropped the header in favour of the
README's provenance row, and ran.

**What each stop caught:** rev A's, a false premise about the runner (fonts); the check behind rev A's
undo block, an irreplaceable file; rev B's, a condition no run could satisfy. **No change reached the
tree until rev C** — rev B's one staged file was taken back out of the index and deleted when its stop
fired, leaving the tree exactly as it started.

### Rule 30 — a ruling in a data file is not in force until something proves it fires (2026-09-14, prompts 95–96)

On 2026-09-08 Joe ruled by eye that 101 pro teams' charcoal-context logos should be the raw art, and
`data/logo_conditioning.json` recorded it. The tests passed, the laptop's build honoured it, and the file
read as the ruling. **On the nightly runner it never fired for 25 of them:** the file spells NBA ids as the
database does (`nba-BKN`), the runner's logos are lowercase files pulled from R2 (`nba-bkn.png`), and the
membership test compared the two case-sensitively. From run #14 (2026-09-09) the bucket held conditioned
art for 25 teams Joe had ruled raw, the Cavaliers among them.

**The only evidence either way was a counts line, and it looked healthy while doing the opposite of the
ruling:** `dark logo variants: 25 generated, 0 copied raw (ruled skip_derive)`. A reader who knew the
ruling existed could have seen that `copied raw` should not be 0 on a machine holding 25 ruled NBA
teams; nobody was looking, because the ruling was "done". It surfaced five days later only because
prompt 94's byte comparison made the bucket and the laptop disagree out loud, and prompt 95 measured the
disagreement instead of assuming it was compression.

**The shape is rule 30's:** the label — the ruling sitting in the file, the tests green — was checked,
and the thing — what the runner actually wrote — was not. Prompt 96 fixed the comparison and added tests
that run the RUNNER'S spelling, not only the laptop's. No new rule.
