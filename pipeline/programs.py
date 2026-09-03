#!/usr/bin/env python3
"""Shadow program rows: the one place that creates and maintains a game's row in `programs`.

Spec v0.5 §P.1 — every grid cell is a program and a game is one subtype, so every game carries a
shadow `programs` row holding the schedule facts a grid needs (when it starts, how long it draws,
what it is called) while the `games` row keeps everything a game specifically has.

**Loader-written, reconciler-invisible** — the 0007/0008 doctrine. `pipeline/load.py` calls
`sync_shadow_program()` in the same load that upserts the game; `pipeline/reconcile.py` never reads
or writes `programs`. There are NO DATABASE TRIGGERS for this: the loader is the single writer, so
the behaviour lives in code that runs rather than hidden in the schema. (`programs` does carry an
`updated_at` trigger, exactly as `games` has since 0004, but that is timestamp maintenance and not
this logic.)

Both writers — the loader and `scripts/backfill_programs.py` — call the SAME function here, so a
backfilled row and a freshly loaded row are byte-identical by construction and cannot drift.

**Nothing here ever deletes a program.** A game that disappears from a fixture keeps its row, which
is spec §15.2 applied one level up.
"""
from __future__ import annotations

import json
from typing import Any

from pipeline.db import DB, ROOT

# The sport's DISPLAY duration, which is what a grid card is drawn at. Read from
# data/render_policies.json rather than data/duration_defaults.json on purpose: render_policies is
# what the renderer itself reads, so taking the number from anywhere else invites the two to drift.
# duration_defaults.json documents that games come from here and says render_policies wins.
_POLICIES: dict[str, Any] | None = None
DEFAULT_BLOCK_MIN = 180          # matches web/lib/gridmodel.js blockMinutes() fallback


def block_minutes(sport: str) -> int:
    global _POLICIES
    if _POLICIES is None:
        _POLICIES = json.loads((ROOT / "data" / "render_policies.json").read_text(encoding="utf-8"))
    pol = _POLICIES.get(sport)
    if isinstance(pol, dict):
        return int(pol.get("block_minutes") or DEFAULT_BLOCK_MIN)
    return DEFAULT_BLOCK_MIN


def game_title(away: str | None, home: str | None) -> str:
    """'AWAY @ HOME' (spec v0.5 backfill rule).

    Deliberately literal, including for neutral-site games, where the grid itself renders 'vs'. This
    string is a convenience label that nothing draws yet; the authoritative teams and the
    `neutral_site` flag are on the games row, so a renderer can compose whatever it wants. Changing
    the rule later is a backfill, not a migration.
    """
    return f"{(away or '?').strip()} @ {(home or '?').strip()}"


# The shadow's start_at tracks the game's CANONICAL kickoff, not the fixture's claim, because that is
# the instant the grid draws. `canonical_kickoff_at_utc` is decided by the reconciler and is null on a
# brand-new game, so the fixture's start is the fallback until reconciliation runs.
_UPDATE_SQL = """
update programs p
   set start_at              = v.start_at,
       title                 = v.title,
       expected_duration_min = v.dur,
       venue_id              = g.venue_id,
       sport                 = g.sport
  from games g,
       lateral (select coalesce(g.canonical_kickoff_at_utc, %s::timestamptz) as start_at,
                       %s::text as title,
                       %s::int  as dur) v
 where g.id = %s
   and p.program_id = g.program_id
   and (p.start_at              is distinct from v.start_at
     or p.title                 is distinct from v.title
     or p.expected_duration_min is distinct from v.dur
     or p.venue_id              is distinct from g.venue_id
     or p.sport                 is distinct from g.sport)
"""

# The `is distinct from` guard above is what makes a re-load a true no-op: without it every load
# would rewrite all 375 rows and the updated_at trigger would fire on every one, turning "nothing
# changed" into 375 modified rows.

_INSERT_SQL = """
with ins as (
  insert into programs (sport, program_type, title, start_at, expected_duration_min, venue_id)
  select g.sport, 'game'::program_type, %s::text,
         coalesce(g.canonical_kickoff_at_utc, %s::timestamptz), %s::int, g.venue_id
    from games g
   where g.id = %s and g.program_id is null
  returning program_id
)
update games set program_id = (select program_id from ins)
 where id = %s and program_id is null and exists (select 1 from ins)
"""


def sync_shadow_program(db: DB, game_id: str, away: str | None, home: str | None,
                        sport: str, start_fallback: Any = None) -> None:
    """Create or update one game's shadow program row. Idempotent: a re-run writes nothing.

    Order matters. The UPDATE runs first and matches only games that already have a shadow; the
    INSERT then matches only games that still do not. Reversing them would have the INSERT create a
    row that the UPDATE immediately rewrites in the same statement pair.
    """
    title = game_title(away, home)
    dur = block_minutes(sport)
    db.run(_UPDATE_SQL, (start_fallback, title, dur, game_id), tag="programs.update")
    db.run(_INSERT_SQL, (title, start_fallback, dur, game_id, game_id), tag="programs.insert")
