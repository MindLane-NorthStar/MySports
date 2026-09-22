# Prompt 104 — THE CAVS OTA SIMULCAST: THE SCHEDULE AND THE TWO COMPOSITE MARKS

**Foundation only. This prompt lands the announced data and builds the artwork. It does NOT change
how a card or a grid renders** — that is prompt 105, deliberately held until the marks can be looked
at. Do not anticipate it.

## Why now

WOIO/WUAB announced the over-the-air Cavaliers schedule on 2026-09-15
(https://www.cleveland19.com/2026/09/15/cleveland-cavaliers-games-return-free-over-the-air-television-19-news/).
`data/local_rights.json` has been waiting for exactly this: `nba.CLE.simulcasts` carries
`expectedCount: 15`, an empty `games: []`, and a note reading *"public announcement pending
('communicated at a later date')"*. **The announcement is the gate opening.** The article states the
package is *"a simulcast of the games available for free in front of the Cavaliers on DAZN paid
subscription paywall offering."* Joe confirms this is the complete list, not a first tranche.

**This does not change `CLAUDE.md` rule 8.** That rule protects Joe's human sources at those
stations; it was never about the call signs, which the repo already names freely — including the
user-facing `"label": "Cavaliers on DAZN (RESN)"` in this same file, citing the public Cavaliers
press release of 2026-09-01. Leave rule 8 alone.

## What the tree says — verified 2026-09-16 at `192677f`, before this brief was written

- `data/local_rights.json` → `nba.CLE.simulcasts`: `outlet: "WUAB 43"`, `surface: "tv"`,
  `expectedCount: 15`, `games: []`, `confirmed: "Joe, 2026-09-01 (hand-entered authority; public
  announcement pending)"`.
- `data/access_profile.json` contains `CBS`, `WUAB 43` and `DAZN`. **It does not contain `WOIO`, and
  it should not** — WOIO resolves as CBS. Do not add it.
- `data/row_order.json:22` and `:57` carry `"station": "WOIO"`; `:130` carries
  `"network": "WUAB 43"`; `:147` is the station-ordering note.
- `adapters/nba.py:61` and `:72` carry decision 7's comments.
- `web/lib/marks.js` keys a mark off `broadcast.service_id` (`showsMark`, line ~39) and sizes it at
  two-thirds of the stack height times a frozen ink-area factor `hf`. `scripts/build_web_marks.py`
  publishes `web/public/marks/{slug}.png` plus `manifest.json` = `[{slug, hf, w, h}]`.
- Published marks measured today: `cbs` 461×128 `hf` 0.758; `dazn` 280×128 `hf` 0.964; `wuab-43`
  174×128 `hf` 1.15. **All three are light-conditioned** (mean luminance 254.7, 251.1, 229.2) even
  though the raw CBS source is pure black — `build_web_marks.py` does the conditioning. There is no
  light/dark problem to solve.
- `dazn` already has RESN combined into it, and `wuab-43` already has RESN/DAZN combined into it.
  **Do not source new RESN artwork; it does not exist separately and is not needed.**

## Block A — the fifteen games

**The schema has to change before the data lands.** `simulcasts` has ONE `outlet` field set to
`"WUAB 43"`, and a flat `games` array beneath it. Thirteen of the fifteen games involve WOIO, and
four are on both stations, so a single outlet cannot express the announcement. **Move outlet onto the
game.** Each entry needs the ET date, the opponent tricode, and the outlets that carry it. Keep the
existing `_about` conventions and the `source` / `asOf` discipline the file already uses; cite the
article URL and 2026-09-15.

The announced package, opponent tricodes to be **verified against the loaded team table, not taken
from this brief**:

| ET date | opponent | outlets |
|---|---|---|
| 2026-10-26 | MIN (home) | WUAB 43 |
| 2026-10-29 | ATL (away) | WUAB 43 |
| 2026-11-02 | OKC (home) | WOIO + WUAB 43 |
| 2026-11-14 | DAL (home) | WOIO |
| 2026-12-12 | GSW (home) | WOIO |
| 2026-12-18 | DET (away) | WOIO |
| 2026-12-23 | WAS (away) | WOIO |
| 2027-01-02 | CHA (away) | WOIO |
| 2027-01-23 | DAL (away) | WOIO |
| 2027-01-29 | TOR (away) | WOIO |
| 2027-02-06 | ORL (home) | WOIO |
| 2027-02-14 | PHX (home) | WOIO |
| 2027-03-09 | DET (away) | WOIO + WUAB 43 |
| 2027-03-14 | SAC (away) | WOIO + WUAB 43 |
| 2027-04-04 | CHA (home) | WOIO + WUAB 43 |

**Two corrections to the article, on Joe's authority:** it prints "Cleveland and Phoenix" for
February 14 — it is **Phoenix at Cleveland** — and "Cleveland at DC" is Washington, `WAS`.

**DAL, DET and CHA each appear twice.** Opponent tricode alone is not a key; date plus tricode is.
Whatever matcher you write or touch must not assume uniqueness on the tricode.

**MOST OF THESE GAMES ARE NOT IN THE DATABASE YET, AND THAT IS NOT A FAILURE.**
`docs/handoff-status.md` records NBA holding only a partial, date-driven season of 19 games. The file
matches by ET date plus opponent tricode precisely so entries can wait for their games. **Report how
many of the fifteen currently match a loaded game and how many do not** — the unmatched count is
information, not an error, and nothing should be written to make it smaller.

**Do not emit any broadcast row in this prompt.** Landing the data is the whole of Block A.

## Block B — the two composite marks

Two new marks, both **LIST view only** by Joe's ruling, built as recipes in
`scripts/build_web_marks.py` from the already-conditioned sources — not hand-composited, not CSS:

1. **CBS above `dazn`** — for the nine WOIO-only games. Proposed slug `cbs-dazn`.
2. **CBS above `wuab-43`** — for the four both-station games. Proposed slug `cbs-wuab-43`.
   (`wuab-43` already carries RESN/DAZN inside it, so this is a two-part stack, not three.)

**The two WUAB-only games need nothing new** — they use the existing `wuab-43` mark.

Slug names are Cowork's proposal. **Confirm neither collides with an existing entry in
`web/public/marks/manifest.json` before adopting them**, and say what you checked.

`hf` must be derived by the same ink-area method the table already uses, not chosen. **Report the
published `w`, `h` and `hf` for both new marks beside the three existing ones** (`cbs` 0.758,
`dazn` 0.964, `wuab-43` 1.15) so the comparison is on the record.

**THE RISK THIS BLOCK CARRIES, AND A PASSING TEST WILL NOT CATCH IT.** Every mark publishes at 128px
tall and renders at two-thirds of the line-box stack height. A composite puts two logos into the
vertical space one normally occupies, so **each half renders at roughly half the size it does
anywhere else on the card.** That is the same ink-area effect `marks.js` documents in its "NBC reads
smaller than FOX" note. **Do not assert legibility.** Produce a rendered sample of each composite at
the phone breakpoint's actual line-box height, save it under `assets/` (untracked, not committed),
and say where it is so it can be looked at at pixel scale before prompt 105 builds on it.

**STOP BEFORE THE R2 PUSH.** Both marks are new objects, and `scripts/sync_assets.py`'s guard
(register §44–§45, prompt 95) refuses a bare `--push` that would create one — it exits 3 and lists
them. That guard is working as designed. **Do not pass `--allow-new`**; report that the push is
pending and Joe authorizes publishing new objects himself.

## Block C — the stale notes this creates

Rule 32: a correction is not done until every place saying the same thing obeys.

- `data/row_order.json:147` asserts *"WUAB 43 carries the OTA Cavs simulcasts (decision 7)"*. Thirteen
  of fifteen are on WOIO. Correct it.
- `adapters/nba.py:72` says *"15 Cavs games on WUAB 43, announced in-season"*. The announcement
  happened and the outlet split is now known. Correct it.
- `data/local_rights.json`'s `simulcasts.note` still says the announcement is pending. Correct it and
  keep the superseded text as dated history, the way this file already handles supersession.
- **Search for others.** Three are named here; report what else you found and what you searched, not
  only what you concluded.

## Explicitly out of scope

- **No render changes.** Not the list card, not the grid, not the rail, not the collapse rule, not
  preemption. Prompt 105 owns all of it.
- **No `CLAUDE.md` rule 8 edit** (see above).
- **No `access_profile.json` entry for WOIO.**
- **No R2 push.**
- **Do not close** `docs/handoff-status.md`'s privacy-gate open item. Joe rules on that once the data
  is in and the marks have been seen.

## Gates and committing

All five gates, each reported as its own command with its own count, read from
`docs/handoff-status.md` under "Repo state" beforehand. Any new assertion gets a mutation check, said
out loud. **Stages self-commit on green.**

**DO NOT PUSH.** This overrides rule 7's default. A push is a deploy, and this one changes in-season
broadcast data and publishes new artwork — Joe approves the push himself after seeing the rendered
samples. End with `git status --porcelain`, `git rev-parse --short HEAD`, and the work left in the
tree.
