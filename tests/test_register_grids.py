#!/usr/bin/env python3
"""The grid archive registry's pure half (Milestone 4 part 0, scripts/register_grids.py).

    python -m unittest tests.test_register_grids -v   # from the repo root; stdlib only

Joe's decision 2026-09-01: the history archives ONE final end-of-day rendering per sport per viewing
day, immutable. The registry enforces that with a (sport, game_date, render_hash) conflict key, which
only works because the renderer is byte-deterministic (v1.6.1/v1.6.2): the same day re-rendered from
the same data hashes the same and inserts nothing new; a day whose data actually changed hashes
differently and earns a new archive row.

`grid_rows()` is the whole scan/hash/URL-building half of the script, extracted so it can be tested
without a database. No database, no network, Windows-portable.
"""
from __future__ import annotations

import hashlib
import io
import json
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scripts.register_grids import asset_url, grid_rows, sha256  # noqa: E402

BASE = "https://pub-8373112ac08548d8af79fe58b7c2dcb9.r2.dev"
# row tuple positions, mirroring the INSERT column list
SPORT, SEASON, WEEK, DATE, HASH, SVG, PNG, PNG2X, VERSION, ON_GRID, TBD, OMITTED = range(12)
CONFLICT_KEY = (SPORT, DATE, HASH)


def key_of(row):
    """The (sport, game_date, render_hash) tuple the ON CONFLICT clause dedupes on."""
    return tuple(row[i] for i in CONFLICT_KEY)


def make_grid(root: Path, sport: str | None, date: str, body: str, meta: dict | None = None,
              png: bool = False, png2x: bool = False) -> Path:
    d = root if sport is None else root / sport
    d.mkdir(parents=True, exist_ok=True)
    svg = d / f"grid_{date}.svg"
    svg.write_text(body, encoding="utf-8")
    if meta is not None:
        (d / f"grid_{date}.meta.json").write_text(json.dumps(meta), encoding="utf-8")
    if png:
        (d / f"grid_{date}.png").write_bytes(b"\x89PNG\r\n")
    if png2x:
        (d / f"grid_{date}@2x.png").write_bytes(b"\x89PNG\r\n")
    return svg


def rows_quiet(root: Path, base: str = BASE):
    with redirect_stdout(io.StringIO()) as buf:
        rows = grid_rows(root, base)
    return rows, buf.getvalue()


SVG_A = '<svg xmlns="http://www.w3.org/2000/svg"><text>Guardians at Tigers</text></svg>'
SVG_B = '<svg xmlns="http://www.w3.org/2000/svg"><text>Guardians at Twins</text></svg>'
META = {"sport": "mlb", "season": 2026, "week": None, "generatorVersion": "v1.6.2",
        "gamesOnGrid": 12, "gamesTbd": 0, "gamesOmitted": 1}


# --------------------------------------------------------------------------- hashing
class RenderHash(unittest.TestCase):
    def test_render_hash_is_sha256_of_the_file_bytes(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            svg = make_grid(root, "mlb", "2026-09-04", SVG_A)
            rows, _ = rows_quiet(root)
            self.assertEqual(rows[0][HASH], hashlib.sha256(svg.read_bytes()).hexdigest())
            self.assertEqual(rows[0][HASH], sha256(svg))
            self.assertEqual(len(rows[0][HASH]), 64)

    def test_identical_bytes_hash_identically_across_sports_and_days(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            make_grid(root, "mlb", "2026-09-04", SVG_A)
            make_grid(root, "nba", "2026-10-28", SVG_A)
            rows, _ = rows_quiet(root)
            self.assertEqual(rows[0][HASH], rows[1][HASH])
            # ... but the conflict key still separates them, so both are archived
            self.assertNotEqual(key_of(rows[0]), key_of(rows[1]))

    def test_changed_bytes_change_the_hash(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            make_grid(root, "mlb", "2026-09-04", SVG_A)
            first, _ = rows_quiet(root)
            make_grid(root, "mlb", "2026-09-04", SVG_B)      # re-render with different data
            second, _ = rows_quiet(root)
            self.assertNotEqual(first[0][HASH], second[0][HASH])
            self.assertNotEqual(key_of(first[0]), key_of(second[0]))   # a new archive row

    def test_a_one_byte_difference_is_enough(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            make_grid(root, "mlb", "2026-09-04", SVG_A)
            a, _ = rows_quiet(root)
            make_grid(root, "mlb", "2026-09-04", SVG_A + " ")
            b, _ = rows_quiet(root)
            self.assertNotEqual(a[0][HASH], b[0][HASH])


# --------------------------------------------------------------------------- idempotence
class OneRowPerUnchangedRender(unittest.TestCase):
    def test_the_same_file_scanned_twice_yields_one_insert_intent(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            make_grid(root, "mlb", "2026-09-04", SVG_A, META)
            first, _ = rows_quiet(root)
            second, _ = rows_quiet(root)
            self.assertEqual(first, second)                       # byte-identical row tuples
            self.assertEqual(len({key_of(r) for r in first + second}), 1)   # one conflict key => one row

    def test_rescanning_a_whole_tree_is_a_no_op(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            make_grid(root, "mlb", "2026-09-04", SVG_A, META)
            make_grid(root, "nba", "2026-10-28", SVG_B)
            make_grid(root, None, "2026-09-05", SVG_A)            # legacy flat layout = cfb
            first, _ = rows_quiet(root)
            second, _ = rows_quiet(root)
            self.assertEqual(first, second)
            self.assertEqual(len({key_of(r) for r in first}), 3)
            self.assertEqual(len({key_of(r) for r in first + second}), 3)

    def test_scan_order_is_deterministic(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            for sport, date in (("nhl", "2026-10-01"), ("mlb", "2026-09-04"), ("nba", "2026-10-28")):
                make_grid(root, sport, date, SVG_A + sport)
            rows, _ = rows_quiet(root)
            self.assertEqual([r[SPORT] for r in rows], ["mlb", "nba", "nhl"])


# --------------------------------------------------------------------------- row building
class RowContents(unittest.TestCase):
    def test_meta_json_populates_season_week_version_and_counts(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            make_grid(root, "mlb", "2026-09-04", SVG_A, META)
            row = rows_quiet(root)[0][0]
            self.assertEqual(row[SPORT], "mlb")
            self.assertEqual(row[SEASON], 2026)
            self.assertIsNone(row[WEEK])
            self.assertEqual(row[DATE], "2026-09-04")
            self.assertEqual(row[VERSION], "v1.6.2")
            self.assertEqual((row[ON_GRID], row[TBD], row[OMITTED]), (12, 0, 1))

    def test_missing_meta_leaves_counts_null_and_version_unknown(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            make_grid(root, "nba", "2026-10-28", SVG_A)
            row = rows_quiet(root)[0][0]
            self.assertEqual(row[VERSION], "unknown")
            self.assertIsNone(row[ON_GRID])
            self.assertIsNone(row[SEASON])

    def test_invalid_meta_json_warns_and_leaves_counts_null(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            make_grid(root, "nba", "2026-10-28", SVG_A)
            (root / "nba" / "grid_2026-10-28.meta.json").write_text("{not json", encoding="utf-8")
            rows, warn = rows_quiet(root)
            self.assertIn("not valid JSON", warn)
            self.assertEqual(rows[0][VERSION], "unknown")
            self.assertIsNone(rows[0][ON_GRID])
            self.assertEqual(rows[0][SPORT], "nba")            # falls back to the directory name

    def test_flat_layout_is_cfb_and_a_subdirectory_is_the_sport(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            make_grid(root, None, "2026-09-05", SVG_A)
            make_grid(root, "nhl", "2026-10-01", SVG_B)
            rows, _ = rows_quiet(root)
            by_date = {r[DATE]: r for r in rows}
            self.assertEqual(by_date["2026-09-05"][SPORT], "cfb")
            self.assertEqual(by_date["2026-10-01"][SPORT], "nhl")

    def test_png_columns_are_null_until_the_files_exist(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            make_grid(root, "mlb", "2026-09-04", SVG_A)
            row = rows_quiet(root)[0][0]
            self.assertIsNone(row[PNG])
            self.assertIsNone(row[PNG2X])

    def test_png_columns_are_filled_when_the_files_exist(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            make_grid(root, "nfl", "2026-09-13", SVG_A, png=True, png2x=True)
            row = rows_quiet(root)[0][0]
            self.assertEqual(row[PNG], "grids/nfl/grid_2026-09-13.png")
            self.assertEqual(row[PNG2X], "grids/nfl/grid_2026-09-13@2x.png")

    def test_an_empty_render_tree_produces_no_rows(self):
        with tempfile.TemporaryDirectory() as td:
            self.assertEqual(rows_quiet(Path(td))[0], [])

    def test_non_grid_svgs_are_ignored(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            make_grid(root, "mlb", "2026-09-04", SVG_A)
            (root / "mlb" / "legend.svg").write_text(SVG_B, encoding="utf-8")
            rows, _ = rows_quiet(root)
            self.assertEqual(len(rows), 1)
            self.assertEqual(rows[0][DATE], "2026-09-04")


# --------------------------------------------------------------------------- asset keys
class AssetKeys(unittest.TestCase):
    """generated_grids stores BARE R2 KEYS (2026-09-03), never absolute URLs.

    An absolute URL bakes today's bucket hostname into a row that outlives it - put a custom domain in
    front of R2 and every row already written points at the old host, with nothing to distinguish a
    stale URL from a current one. The key is the stable part; consumers join ASSET_BASE_URL
    (web/lib/config.js gridAssetUrl, web/scripts/smoke.mjs). It also removed the class of bug behind
    the long-standing smoke 29/30: one row was a key while the rest were absolute, so fetching the
    newest row's value raw could not even parse as a URL.
    """

    def test_the_key_scheme_matches_sync_assets_push_grids(self):
        self.assertEqual(asset_url(BASE, "mlb", "grid_2026-09-04.svg"), "grids/mlb/grid_2026-09-04.svg")

    def test_keys_are_lowercased(self):
        # sync_assets.py lowercases every uploaded key; the stored key has to match or it 404s
        self.assertEqual(asset_url(BASE, "MLB", "GRID_2026-09-04.SVG"), "grids/mlb/grid_2026-09-04.svg")

    def test_the_base_is_ignored_however_it_is_passed(self):
        """The signature keeps `base` for its callers, but no base ever reaches the stored value."""
        for base in (BASE, "", "https://cdn.example.test", "https://cdn.example.test/"):
            self.assertEqual(asset_url(base, "nba", "grid_2026-10-28.svg"), "grids/nba/grid_2026-10-28.svg")

    def test_row_urls_are_keys_regardless_of_the_configured_base(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            make_grid(root, "nba", "2026-10-28", SVG_A)
            self.assertEqual(rows_quiet(root)[0][0][SVG], "grids/nba/grid_2026-10-28.svg")
            self.assertEqual(rows_quiet(root, "")[0][0][SVG], "grids/nba/grid_2026-10-28.svg")

    def test_no_stored_value_is_ever_absolute(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            make_grid(root, "nfl", "2026-09-13", SVG_A, png=True, png2x=True)
            for col in (SVG, PNG, PNG2X):
                self.assertNotRegex(rows_quiet(root)[0][0][col], r"^https?://")


# --------------------------------------------------------------------------- the live render tree
class LiveRenderTree(unittest.TestCase):
    def test_the_repo_render_tree_scans_to_stable_unique_rows(self):
        live = ROOT / "artifacts" / "rendering"
        if not live.exists():
            self.skipTest("artifacts/rendering not present")
            return
        rows, _ = rows_quiet(live)
        self.assertTrue(rows, "expected the repo's rendered grids to be found")
        keys = [key_of(r) for r in rows]
        self.assertEqual(len(keys), len(set(keys)), "a render tree must not produce duplicate archive keys")
        self.assertEqual(rows, rows_quiet(live)[0])


if __name__ == "__main__":
    unittest.main()
