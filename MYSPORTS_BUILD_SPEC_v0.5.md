# MySports — Build Specification v0.5 (delta over v0.4)

**Version:** 0.5
**Status:** Delta document. `MYSPORTS_BUILD_SPEC_v0.4.md` remains the base specification and is
**not** superseded — read it first; this file states only what v0.5 adds or changes.
**Scope of this version:** the `programs` supertype and the Events & Shows data model.
**Authority:** Joe's decisions of 2026-09-02, recorded in `enhancement-register.md` §7–§9 and the
Brief 2 research set (`research-brief-2-events-and-shows.md`, `research-summary-2.md`,
`research-nascar.md`, `research-indycar.md`, `research-ufc.md`, `research-wwe.md`,
`research-aew.md`, `research-studio-shows.md`). Those documents live in the claude.ai project
workspace and have no repo copy; `docs/research/research-changelog.md` carries the 2026-09-02
Brief 2 entry, which is the in-repo record of the same decisions.

> **What v0.5 does NOT do.** This version is architecture only. No adapters, no UI, no rendering
> change, no studio-show data. After the v0.5 implementation run the app and the grids look and
> behave identically; the only difference is that the database is now *able* to describe
> programming that is not a game. Every behaviour listed under "Deferred" below is named so that a
> later prompt can pick it up without re-deciding anything.

---

## §P. Programs (new section)

### P.1 The supertype

**Every cell on a grid is a program. A `game` is one subtype of program.**

v0.4 modelled the world as games on networks. That model cannot hold a race, a fight card, a
wrestling show, or a pregame show, and each of those is something Joe wants on a grid. Rather than
bolt a parallel "events" table beside `games` — which would duplicate broadcast, eligibility and
rendering logic and guarantee the two drift — v0.5 introduces a supertype:

```
programs  (program_id, sport, program_type, title, start_at, ...)
   ^
   |  games.program_id  (nullable FK, the "shadow link")
   |
games     (unchanged; every existing column keeps its meaning)
```

`games` is not migrated into `programs`. It keeps its own identity, its own columns and its own
loader path; it gains **one nullable FK**. Every game has a shadow program row carrying the
schedule facts a grid needs (when it starts, how long it draws, what it is called), and the game row
keeps everything a game specifically has (teams, scores, ranks, records, odds, probables).

**Why a shadow row rather than a view.** The grid's future query is "what programs are on this
viewing day", and that must be answerable by one index scan over one table whether the row is a
game, a race or a wrestling show. A view over a union of heterogeneous tables cannot be indexed on
`(sport, start_at)` the way the renderer needs, and would push a type-switch into every consumer.

**Why the FK is nullable.** A program that is *not* a game — a race, a PLE, a studio show — has no
`games` row at all. Nullability is the direction of the relationship, not a data-quality gap.

### P.2 The six program types

`program_type` is an enumerated dimension with exactly these values:

| `program_type` | What it is | Has a `games` row? |
|---|---|---|
| `game` | A contest between two teams. The v0.4 world. | Yes |
| `race_session` | A motorsport race. **Race only** — see P.6. | No |
| `fight_card` | One UFC event, start to finish, with a `segments` timeline. | No |
| `weekly_show` | A recurring episodic show: WWE Raw, SmackDown, AEW Dynamite, Collision. | No |
| `special_event` | A one-off above the weekly cadence: a WWE PLE, an AEW special. | No |
| `studio_show` | A pregame or postgame bookend. See P.7. | No |

### P.3 The three research-driven additions

Brief 2 produced three findings that the v0.4 schema had no place to put. Each is a column or a
table in v0.5, and each exists because a specific real broadcast could not otherwise be described.

**(a) `segments` — a timeline inside one program.** A UFC event is not one block; it is early
prelims, prelims and the main card, frequently on *different services*. Joe's ruling is **one card
per event** with a segment timeline inside it, not three sibling cards. `programs.segments` is
`jsonb`: an ordered list of `{label, start_at, service_id, ...}`. The card stays one object on the
grid; the timeline explains its interior. The same mechanism describes a wrestling show's hour
blocks if that is ever wanted.

**(b) Broadcast windows — a carrier that covers only part of a program.** CBS carries *part* of
some UFC events, not the whole thing. In v0.4 a broadcast row implicitly covered the entire game,
which was true for games and is false for events. v0.5 adds `window_start` / `window_end` to the
broadcast table:

- **A null window means the row carries the WHOLE program.** Every existing broadcast row is
  therefore correct, unchanged, and needs no backfill. This is the single most important semantic
  in the migration: null is not "unknown", it is "all of it".
- **Duplicate-feed suppression must compare windows.** Two rows for the same program on the same
  service are only duplicates when their windows also coincide. A suppression rule written against
  v0.4's implicit whole-program assumption will wrongly collapse a CBS window into the parent
  streaming row, and that is the concrete bug this column prevents.
- `simulcast_linear` marks a linear broadcast running simultaneously with a streaming feed —
  the Cavaliers/DAZN OTA case generalized.

**(c) Per-episode network as data, on every episode and every race.** The v0.4 model treats a
network as reasonably stable per competition. Brief 2 shows this is false for exactly the content
being added: the NASCAR Cup season moves FOX → Prime → TNT → USA/NBC across one season, and AEW
Collision's TNT/HBO Max split is volatile month to month. Therefore the carrying network is a
per-instance broadcast fact for programs, never an attribute of the series or show. `studio_shows`
carries a `network` only as the *default slot* hint for the registry; the authority is always the
per-instance broadcast row.

### P.4 Sport dimension

The `sport` dimension gains **five additive values**: `nascar`, `indycar`, `ufc`, `wwe`, `aew`.
Existing values (`cfb`, `nfl`, `nhl`, `nba`, `mlb`) are untouched, and no existing row changes.

**No NASCAR exception (Joe, 2026-09-02).** NASCAR is **one** sport value, `nascar`, with a `series`
discriminator taking `cup`, `oreilly` or `truck`. It is not three sports. The alternative —
three sport values — would have produced three chips, three rails and three render policies for
what a viewer experiences as one sport with three divisions.

### P.5 Chips are driven by `sport`

The filter chips the app renders are a projection of the `sport` dimension. Adding a sport value
adds a chip; nothing else does. **Studio shows are chipless**: a `studio_show` program carries the
`sport` it covers so it can be filtered *with* that sport, but it never creates a chip of its own
and never appears as a separate filter. A pregame show is an accessory to a sport, not a sport.

### P.6 Motorsport is race only

Practice and qualifying sessions are **out of scope** (Joe, 2026-09-02). `race_session` is named
for the general shape, but the only sessions modelled are races. This is a deliberate scope cut:
practice sessions triple the row count for programming that is not appointment viewing.

### P.7 Studio shows

Pregame and postgame **bookends only**. No daily talk shows, no debate programming.

A studio show is modelled in two tables, because a show and an airing of a show are different
things: `studio_shows` is the registry (College GameDay exists, it covers `cfb`, it has a brand
mark), and `studio_show_instances` is one airing (this Saturday's GameDay, from Tuscaloosa, with
these hosts). The instance is what links to a `programs` row.

**Hosts and locations are SOURCED, never curated** (Joe, 2026-09-02). `studio_show_instances`
requires a `source_url` — the column is `NOT NULL` at the database level, so an unsourced instance
is not merely discouraged, it is unrepresentable. `source_tier` records whether that source is an
official announcement or a trade report; see P.9.

### P.8 Duration defaults and `open_ended`

Programs render at a default duration by type, held in `data/duration_defaults.json` — a repo data
file, not a table, matching the pattern already set by `data/render_policies.json`. It is read by
the renderer and the app later; nothing reads it in v0.5.

Programs whose end time is genuinely unknown — a race under caution, a fight card running long —
set `open_ended = true`. The **design treatment is a fade-right**: the card's right edge dissolves
rather than asserting a false end time, which is the same honesty rule that makes a TBD kickoff
render as `TBD` instead of a plausible guess.

> **Deferred to rendering contract v1.7. NOT implemented in v0.5.** The column exists and defaults
> to `false`; no renderer reads it yet. `data/render_policies.json` already carries an `open_ended`
> key per sport (`nhl: "playoffs"`), and v1.7 must reconcile the two: the per-sport policy says
> *when* a sport can be open-ended, the per-program column says *whether this instance is*.

### P.9 Authority tiers for program facts

Program facts — a host, a location, a start time for a show — come from weaker sources than the
structured providers §9 of v0.4 is built around. v0.5 adds an explicit tier ordering, narrower than
and subordinate to the §9 authority model:

| Tier | Source | Render treatment |
|---|---|---|
| `announced` | An official press room or the promoter's own site | Normal |
| `reported` | A trade publication | **Muted render** — visibly less certain |
| *(league schedule)* | A league's own schedule feed | Below both for *program* facts |

A league schedule feed is authoritative for *when a game is*, and weaker than a press room for *who
is hosting a show*. The tier is about the fact, not the publisher's general reliability. This mirrors
the 2026-09-01 Blue Jackets ruling in `docs/research/research-changelog.md`, where a Sports Business
Journal report was held as RUMOR against an unannounced carrier rather than promoted to fact.

### P.10 Exclusions — decided, not deferred

These were considered and **rejected**. They are recorded so they are not re-proposed:

- **No `purchasable` access state.** Pay-per-view content is out of scope. AEW's scope is
  Dynamite/Collision plus specials **included with a subscription** the viewer already has; the
  $39.99 AEW PPVs are excluded outright. Adding a `purchasable` value to `access_status` would put
  content on the grid that Joe cannot watch without a transaction, which inverts the product's
  purpose — the grid answers "what can I watch", not "what could I buy".
- **No NXT.** WWE scope is Raw, SmackDown and main-roster PLEs.
- **No practice or qualifying sessions.** See P.6.
- **No daily talk or debate shows.** See P.7.

### P.11 Open assumption — SNME

Saturday Night's Main Event is modelled as **PLE-class `special_event`**. It is a WWE special above
the weekly cadence, which makes `special_event` the closest fit, but Joe has not ruled on it
explicitly and it airs on a different service (Peacock) from the PLE tier (ESPN Unlimited).

> **ASSUMPTION PENDING JOE.** If SNME should instead be a `weekly_show` with an irregular cadence,
> or a fourth WWE tier, the change is a `program_type` value on a handful of rows and nothing
> structural.

---

## §7 amendments (schema)

New entities, specified in `db/migrations/0009_programs_supertype.sql`:

- **`7.24 programs`** — the supertype of P.1. Indexed on `(sport, start_at)`.
- **`7.25 studio_shows` / `7.26 studio_show_instances`** — the registry pair of P.7.
  `studio_show_instances.source_url` is `NOT NULL`.
- **`7.3 games`** gains `program_id` — nullable FK to `programs`, the shadow link.
- **`7.4 game_broadcasts`** gains `window_start`, `window_end`, `simulcast_linear`. Null window =
  whole program (P.3b).

All changes are **additive**. No column is dropped, narrowed or rewritten; no enum value is removed;
no existing row is modified by the migration itself.

## §16 amendment — loader doctrine extends to shadow rows

The shadow program row is **loader-written and reconciler-invisible**, exactly as the 0007 scores
and 0008 standings are. `pipeline/load.py` upserts the program alongside the game in the same load;
a changed kickoff updates the program's `start_at`; **nothing in the loader path ever deletes a
program.** There are no database triggers — the loader is the single writer, so the behaviour is
visible in the code that runs rather than hidden in the schema.

## §24 amendment — open product decisions

- SNME classification (P.11).
- The v1.7 reconciliation of per-sport and per-program `open_ended` (P.8).

## Version History

- **v0.5 (2026-09-02):** programs supertype (§P); six program types; segments, broadcast windows and
  per-instance networks (P.3); sport dimension +nascar/indycar/ufc/wwe/aew with no NASCAR exception
  (P.4); chips from `sport`, studio shows chipless (P.5); race-only motorsport (P.6); studio show
  registry with mandatory sourcing (P.7); duration defaults and deferred `open_ended` treatment
  (P.8); announced > reported > league-schedule authority tiers (P.9); exclusions incl. no
  purchasable state (P.10); SNME assumption (P.11). Schema §7.24–7.26 and the §16 loader doctrine
  extension. Architecture only — no adapters, no UI, no rendering change.
- **v0.4 and earlier:** see `MYSPORTS_BUILD_SPEC_v0.4.md` §27.
