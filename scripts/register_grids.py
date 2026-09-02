#!/usr/bin/env python3
"""MySports - register rendered grids in mysports.generated_grids (Milestone 4 part 0).

Joe's decision 2026-09-01: the history archives ONE final end-of-day rendering per sport per viewing
day, immutable. This scans a render directory, hashes each SVG, and inserts a registry row keyed
(sport, game_date, render_hash) - so re-running is a no-op and a re-render of unchanged data does not
create a second archive row (renderer v1.6.1 made the SVG byte-deterministic for exactly this reason).

    python scripts/register_grids.py artifacts/rendering [--workflow claude-code]

Asset URLs use the same grids/{sport}/{name} key scheme scripts/sync_assets.py --push-grids uploads to,
prefixed with ASSET_BASE_URL when one is configured; without a base the bare key is stored (and said so
on the console), so the row is still correct once a base exists.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))   # repo root, as the sibling scripts do

from adapters.common import find_repo_root, load_dotenv
from pipeline.db import DB

INSERT = """
insert into generated_grids
  (sport, season, week, game_date, render_hash, svg_asset_url, png_asset_url, png2x_asset_url,
   generated_at, generator_version, games_on_grid, games_tbd, games_omitted)
values (%s, %s, %s, %s, %s, %s, %s, %s, now(), %s, %s, %s, %s)
on conflict (sport, game_date, render_hash) do nothing
"""


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    h.update(path.read_bytes())
    return h.hexdigest()


def asset_url(base: str, sport: str, name: str) -> str:
    """Same key scheme as sync_assets.py --push-grids: grids/{sport}/{filename}, lowercased."""
    key = f"grids/{sport}/{name}".lower()
    return f"{base}/{key}" if base else key


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("directory", help="render root, e.g. artifacts/rendering")
    ap.add_argument("--workflow", default="claude-code")
    args = ap.parse_args(argv)

    root = find_repo_root()
    load_dotenv(root / ".env")
    base = (os.getenv("ASSET_BASE_URL") or "").rstrip("/")
    if not base:
        print("note: ASSET_BASE_URL not set - storing bare grids/... keys")

    render_root = Path(args.directory)
    if not render_root.exists():
        print(f"ERROR: {render_root} does not exist", file=sys.stderr)
        return 2

    svgs = sorted(p for p in render_root.rglob("grid_*.svg") if p.is_file())
    db = DB()
    registered = already = 0
    try:
        for svg in svgs:
            # pro leagues render into {root}/{sport}/; the legacy flat layout is cfb
            sport = svg.parent.name if svg.parent != render_root else "cfb"
            date = svg.name[len("grid_"):-len(".svg")]
            meta_path = svg.with_suffix(".meta.json")
            meta = {}
            if meta_path.exists():
                try:
                    meta = json.loads(meta_path.read_text(encoding="utf-8"))
                except ValueError:
                    print(f"  warn: {meta_path.name} is not valid JSON - counts left null")
            png = svg.with_suffix(".png")
            png2x = svg.parent / f"grid_{date}@2x.png"
            row = (
                meta.get("sport") or sport,
                meta.get("season"),
                meta.get("week"),
                date,
                sha256(svg),
                asset_url(base, sport, svg.name),
                asset_url(base, sport, png.name) if png.exists() else None,
                asset_url(base, sport, png2x.name) if png2x.exists() else None,
                meta.get("generatorVersion") or "unknown",
                meta.get("gamesOnGrid"),
                meta.get("gamesTbd"),
                meta.get("gamesOmitted"),
            )
            before = db.fetch("select count(*) from generated_grids where sport = %s and game_date = %s "
                              "and render_hash = %s", (row[0], row[3], row[4]))
            exists = bool(before and before[0][0])
            db.run(INSERT, row, tag="generated_grids")
            if exists:
                already += 1
                print(f"  already   {sport}/{svg.name}  {row[4][:12]}")
            else:
                registered += 1
                print(f"  registered {sport}/{svg.name}  {row[4][:12]}  "
                      f"({row[9] if row[9] is not None else '?'} on grid, {row[8]})")
        db.commit()
    finally:
        db.close()
    print(f"TOTAL: {registered} registered, {already} already, {len(svgs)} grid(s) scanned "
          f"[workflow {args.workflow}]")
    return 0


if __name__ == "__main__":
    sys.exit(main())
