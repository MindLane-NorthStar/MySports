# Prompt 72 — the local-RSN data is wrong, and the text-rendering audit

Follows prompt 71's four commits. **Stage 1 is a data correction, not a display fix** — that is the
finding, and it came from Joe rather than from measurement.

Gate floors from `docs/handoff-status.md`: `pytest` 514 + 1 skipped · `test:unit` 494 ·
`smoke` 33/33 · `qa-shots` 91/91 · `geometry` all hard stops. Clear stray dev servers and chromium
before the first gate and report what you started from.

---

## STAGE 1 — `cavs-local` and `cbj-local` are not real services

Prompt 71 reported 84 active rows rendering as duplicate text links, all `cbj-local`, and 2 services
on accessible rows with no mark: `cavs-local` and `cbj-local`. **It read as a mark-coverage problem.
It is not.**

**Joe, 2026-09-09:** *"FanDuel Sports Network is defunct. Cavs air on DAZN produced by [a regional
producer] and I subscribe. Blue Jackets are available via Prime Video."*

So both ids point at carriage that no longer exists, and **the services they should point at already
have marks and are already in Joe's access profile**:

| wrong id | correct service | slug | mark? | in `access_profile.available`? |
|---|---|---|---|---|
| `cavs-local` | DAZN | `dazn` | **yes** | **yes** |
| `cbj-local` | Prime Video | `prime-video` | **yes** | **yes** |

**Fixing the data closes the display symptom entirely, and probably the duplicate-link case with it**
— both correct services are STREAMERS, so no DIRECTV link accompanies them, and both have their own
`WATCH` entries, so their links resolve to their own paths rather than falling through to DIRECTV.
**Verify that rather than assuming it**; report what actually remains.

### Find the source before changing anything

**Do not assume these are hand-entered database rows.** Establish where `cavs-local` and `cbj-local`
are minted — a repo data file (`data/local_rights.json` is the first place to look), an adapter, the
loader, or `networks_services` itself — and fix them **at the source**, so the next loader run does
not reintroduce them. `git grep` both ids and report every place they appear before editing one.

**The write route matters and may not exist yet.** Rule 14 is a hard stop: *no direct Postgres
connection, no writer credential, no DML* — and `795da6c` established that database writes go through
the Supabase connector, which is not Claude Code's to use. **If the fix turns out to require a
database write rather than a repo change, STOP and say so** with the exact rows and the SQL you would
run. Do not reach for `SUPABASE_DB_URL` in `.env`.

If it IS a repo change: rule 6 still governs the shape — additive over destructive, close rather than
delete, and `SELECT` and paste the current state before and after. Rule 17: edit JSON through a
parser and assert nothing but the intended keys moved.

**Also retire the defunct carrier.** `git grep` the old regional network's name across `data/`,
`docs/` and `web/`, and report every reference. Do not delete history or a dated record — mark it
defunct where it is a live fact, and say which ones you changed and which you left as historical.

---

## STAGE 2 — every service that renders as text, enumerated

Joe, 2026-09-09: *"can you surface ANY service that I have that lists on the grid that renders
anywhere in text?"*

Cowork could give him the mark inventory but not the full answer: the complete list needs a read of
every distinct `service_id` on a broadcast row, and the publishable anon key lives in Vercel's
environment rather than on disk.

**You have that read path. Produce the list.**

What is already established, from the repo — use it as a check on your query, not as the answer:

- `web/public/marks/manifest.json` holds **32 slugs**, and the folder holds exactly those 32 files.
  No drift in either direction.
- `hasMark()` (`web/lib/marks.js:22`) matches the lowercased **`service_id`** against that manifest.
  A service renders as a mark if and only if its id is one of the 32.
- Diffing the manifest against `access_profile.json`'s 33 available labels leaves **`ESPN3`** — Joe
  has it, there is no `espn3` slug, and `scripts/validate_cfbd_week1.py:208` treats it as a real
  service alias. **Confirm whether any row actually carries it.**

**Report a table:** every distinct `service_id` on an active broadcast row, its `access_status`, its
`delivery_surface`, its row count, and whether `hasMark()` resolves. Then say plainly **which
services Joe can access that render as text anywhere in the app** — the subcard, the grid tray pills
and the list cards, not just the subcard (rule 32: enumerate the renderers, do not sample one).

Use `restAll()`; an unbounded PostgREST select silently caps at 1,000 rows (rule 19).

**Change nothing in this stage.** It is a report.

---

## STAGE 3 — the DIRECTV mark, art supplied and measured

Prompt 71 found there is no DIRECTV art anywhere, so the DIRECTV link renders as text on every game.

**Joe supplied the art on 2026-09-09 and ruled the treatment: black text goes white, the blue streak
goes a little lighter.** He then supplied the brand's own dark-background lockup, which already IS
that transformation. **Use it. Do not derive anything.**

The file delivered with this prompt is `directv-stream-dark.png` — the supplied lockup with its black
plate keyed to transparent and trimmed, 902×304. Measured on `#101214`, the charcoal the builder
measures against:

| | white type | blue streak |
|---|---|---|
| **official dark lockup** | `247,247,247` — **17.52:1** | `50,120,203` — **4.19:1** |
| derived from the light lockup (`whiten_dark` 0.35) | `245,245,245` — 17.22:1 | `0,113,186` — 3.64:1 |
| the light lockup raw | `0,0,0` — **1.12:1, invisible** | 3.64:1 |

The official art wins on the element that matters: the blue is the weakest part of this mark on
charcoal and the brand's dark lockup lightens it, gaining 0.55 of ratio. Both clear the repo's 3.0
floor; one does it with the brand's own values rather than a derivation.

### The recipe

**The art is already dark-ready, so it needs no lightness work** — no `whiten_dark`, no `derive`, no
`floor_l`. What it needs is the black plate keyed out, and **this repo already has a recipe for that
shape**: see the entry around `build_web_marks.py:346` for a source that arrives *"on an OPAQUE NAVY
PLATE … no alpha at all"*, and the `key_plate` machinery documented at `:185`. **Follow that
precedent rather than inventing a key.** If `key_plate` handles it, the recipe is that plus identity,
like `abc`'s `("png", lambda im: im)`.

**Do not commit Cowork's keyed copy as source art.** Put the raw supplied lockup in
`assets/network-logos/` and let the pipeline produce the published mark, so `hf`, trim and alpha
hardening are computed the way they are for every other mark.

**Establish the slug from the data, not from this brief** — the id the broadcast rows and the
`WATCH` map actually use, which may not be `directv-stream`.

**Re-measure after the pipeline runs.** Cowork keyed the plate with its own soft threshold and
rendered at an assumed 21px and 42px; the pipeline trims, hardens alpha and computes `hf` from the
median over the source set. Report what `hf` it assigns and what `markStyle(slug, 30)` therefore
paints. If the published mark disagrees with the table above, the published mark is right.

### While you are there

Prompt 71 reported `assets/network-logos/` holds 40 files against 32 published marks. **Report which
local art is unpublished and why** — some will be the retired and rejected variants prompt 68 found
in that folder. Publish nothing without saying what it is.

**Do not hand-draw or approximate any other wordmark.** A missing mark falls back to text, which
works; a wrong mark does not.

## WHAT IS NOT CHANGING

**Joe ruled the duplicate-destination case stays as built** — network link and DIRECTV link, both
present, even when they resolve to the same URL. Do not "fix" it. If stage 1 leaves genuine instances
of it (a LINEAR accessible service with no `WATCH` entry), **list them so Joe can see what he ruled
on**, and leave the behaviour alone.

---

## GATES AND COMMITTING

Five gates, each its own command, all reported, before any commit. Never read a gate's result from
the exit code of a chained command (rule 26). The tripwire must not move — CFB `2026-09-05`
64 / {240, 223, 205, 136} / 1273, MLB `2026-09-03` 3 / {228} / 567.

Rule 23: state explicitly whether `docs/design/mobile_demo.html` implements anything these stages
change, and act accordingly.

One commit per stage that changes anything — stage 2 changes nothing and is a report, so it has no
commit. Stage by explicit path (rule 4, never `git add -A`; `assets/` stays untracked). Secret-gate
on ADDED lines only, with `grep` (rule 3).

**Do not commit or push without Joe's explicit approval.** Report and wait.
