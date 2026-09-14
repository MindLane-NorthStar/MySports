#!/usr/bin/env python3
"""scripts/sync_assets.py compares BYTES in both directions (prompt 94, register §43).

    python -m pytest tests/test_sync_assets.py -v     # from the repo root; no network, no credentials

Two things are load-bearing, and each has a test that fails if it breaks:

1. **The free comparison stays free.** A single-part ETag is the MD5 of the bytes and the bucket listing
   already carries it, so a size-matching file is compared with ZERO requests. The push used to spend a
   `head_object` on every such file - 1,533 a night to push nothing. The tests below assert the CALL
   COUNT, because a refactor that brings the round trip back would still return the right answers.
2. **`--pull` retakes a cached file whose bytes differ.** It used to decide by key alone, so a stale
   file survived `--pull` and the next `--push` republished it over the newer object: art reverted,
   silently. `test_pull_retakes_a_cached_file_whose_bytes_differ_from_the_bucket` is that defect.

The s3 client is a stub with a `head_object` method; nothing here touches R2, and `.env` is never read
(importing the module does not load it - only `main()` does).
"""
from __future__ import annotations

import hashlib
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scripts import sync_assets as sa  # noqa: E402

BUCKET = "mysports-assets"


class StubS3:
    """`head_object` answers from a {key: sha256} map and counts every call."""

    def __init__(self, sha_by_key: dict[str, str] | None = None):
        self.sha_by_key = sha_by_key or {}
        self.heads: list[str] = []

    def head_object(self, Bucket, Key):  # noqa: N803 - boto3's own argument names
        self.heads.append(Key)
        sha = self.sha_by_key.get(Key)
        return {"Metadata": {"sha256": sha} if sha else {}}


def md5_of(b: bytes) -> str:
    return hashlib.md5(b, usedforsecurity=False).hexdigest()


def sha_of(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


class TempCache(unittest.TestCase):
    """A throwaway repo root with an `assets/` tree, torn down after each test."""

    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name)

    def tearDown(self):
        self._tmp.cleanup()

    def put(self, rel: str, data: bytes) -> Path:
        p = self.root / "assets" / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(data)
        return p


# --------------------------------------------------------------------------- the helper
class SameBytes(TempCache):
    DATA = b"\x89PNG logo bytes v2"

    def test_etag_equal_to_local_md5_is_the_same_bytes_with_no_request(self):
        p = self.put("logos/a.png", self.DATA)
        s3 = StubS3()
        self.assertTrue(sa.same_bytes(s3, BUCKET, "logos/a.png", p, {"size": len(self.DATA), "etag": md5_of(self.DATA)}))
        self.assertEqual(s3.heads, [])      # THE PERFORMANCE FIX: no head_object for a single-part ETag

    def test_etag_different_from_local_md5_is_different_bytes_with_no_request(self):
        p = self.put("logos/a.png", self.DATA)
        s3 = StubS3()
        other = md5_of(b"\x89PNG logo bytes v1")     # same length, different bytes
        self.assertFalse(sa.same_bytes(s3, BUCKET, "logos/a.png", p, {"size": len(self.DATA), "etag": other}))
        self.assertEqual(s3.heads, [])

    def test_a_quoted_uppercase_etag_still_compares(self):
        p = self.put("logos/a.png", self.DATA)
        s3 = StubS3()
        r = {"size": len(self.DATA), "etag": '"' + md5_of(self.DATA).upper() + '"'}
        self.assertTrue(sa.same_bytes(s3, BUCKET, "logos/a.png", p, r))
        self.assertEqual(s3.heads, [])

    def test_a_different_size_is_different_bytes_with_no_request_and_no_hashing(self):
        p = self.put("logos/a.png", self.DATA)
        s3 = StubS3()
        with mock.patch.object(sa, "md5", wraps=sa.md5) as m, mock.patch.object(sa, "sha256", wraps=sa.sha256) as sh:
            self.assertFalse(sa.same_bytes(s3, BUCKET, "logos/a.png", p, {"size": len(self.DATA) + 1, "etag": md5_of(self.DATA)}))
        self.assertEqual(s3.heads, [])
        self.assertEqual((m.call_count, sh.call_count), (0, 0))

    def test_a_multipart_etag_falls_back_to_one_head_and_the_sha256_decides(self):
        p = self.put("grids/big.png", self.DATA)
        r = {"size": len(self.DATA), "etag": "0f343b0931126a20f133d67c2b018a3b-4"}   # multipart: NOT an MD5
        s3 = StubS3({"grids/big.png": sha_of(self.DATA)})
        self.assertTrue(sa.same_bytes(s3, BUCKET, "grids/big.png", p, r))
        self.assertEqual(s3.heads, ["grids/big.png"])
        s3 = StubS3({"grids/big.png": sha_of(b"something else")})
        self.assertFalse(sa.same_bytes(s3, BUCKET, "grids/big.png", p, r))
        self.assertEqual(s3.heads, ["grids/big.png"])

    def test_a_missing_or_empty_etag_falls_back(self):
        p = self.put("logos/a.png", self.DATA)
        for r in ({"size": len(self.DATA), "etag": ""}, {"size": len(self.DATA)}):
            s3 = StubS3({"logos/a.png": sha_of(self.DATA)})
            self.assertTrue(sa.same_bytes(s3, BUCKET, "logos/a.png", p, r))
            self.assertEqual(s3.heads, ["logos/a.png"])

    def test_a_fallback_with_no_sha256_metadata_is_not_the_same(self):
        p = self.put("logos/a.png", self.DATA)
        s3 = StubS3({})
        self.assertFalse(sa.same_bytes(s3, BUCKET, "logos/a.png", p, {"size": len(self.DATA), "etag": "abc-2"}))


# --------------------------------------------------------------------------- the plan: both directions
def record(data: bytes) -> dict:
    return {"size": len(data), "etag": md5_of(data)}


class Plan(TempCache):
    def plan(self, remote, s3=None, **kw):
        local = sa.local_files(self.root, None)
        return sa.plan(s3 or StubS3(), BUCKET, self.root, local, remote, **kw)

    def test_pull_retakes_a_cached_file_whose_bytes_differ_from_the_bucket(self):
        # THE DEFECT. The cache has the key, same length, different bytes: the old pull decided by key
        # alone and left it; the next --push would then have published this stale copy.
        self.put("logos/team.png", b"OLD-ART-BYTES")
        pl = self.plan({"logos/team.png": record(b"NEW-ART-BYTES")})
        self.assertIn("logos/team.png", pl["to_pull"])
        self.assertIn("logos/team.png", pl["to_push"])       # both lists: the flag is the decision
        self.assertEqual(pl["conflicts"], ["logos/team.png"])
        self.assertEqual(pl["bucket_only"], [])

    def test_identical_bytes_move_in_neither_direction_and_cost_no_request(self):
        data = {f"logos/t{i}.png": f"art {i}".encode() for i in range(40)}
        for k, b in data.items():
            self.put(k, b)
        s3 = StubS3()
        pl = self.plan({k: record(b) for k, b in data.items()}, s3=s3)
        self.assertEqual((pl["to_push"], pl["to_pull"], pl["conflicts"]), ([], [], []))
        self.assertEqual(pl["same"], 40)
        self.assertEqual((s3.heads, pl["heads"]), ([], 0))    # 40 compared, zero round trips

    def test_a_key_outside_folders_on_disk_is_compared_not_blindly_pulled(self):
        # grids/ is in the bucket and not in FOLDERS, so local_files() never sees it.
        self.put("grids/cfb/grid_2026-09-12.svg", b"<svg>same</svg>")
        self.put("grids/cfb/grid_2026-09-13.svg", b"<svg>OLD</svg>")
        remote = {"grids/cfb/grid_2026-09-12.svg": record(b"<svg>same</svg>"),
                  "grids/cfb/grid_2026-09-13.svg": record(b"<svg>NEW</svg>"),
                  "grids/cfb/grid_2026-09-14.svg": record(b"<svg>absent</svg>")}
        pl = self.plan(remote)
        self.assertNotIn("grids/cfb/grid_2026-09-12.svg", pl["to_pull"])
        self.assertIn("grids/cfb/grid_2026-09-13.svg", pl["to_pull"])
        self.assertEqual(pl["stale"], ["grids/cfb/grid_2026-09-13.svg"])   # --push never walks grids/
        self.assertEqual(pl["bucket_only"], ["grids/cfb/grid_2026-09-14.svg"])
        self.assertEqual(pl["to_push"], [])

    def test_a_mixed_case_file_is_compared_through_its_real_path(self):
        # 73 NBA logos are named nba-ATL.png against the lowercase key logos/nba-atl.png.
        self.put("logos/nba-ATL.png", b"hawks")
        pl = self.plan({"logos/nba-atl.png": record(b"hawks")})
        self.assertEqual((pl["to_pull"], pl["same"]), ([], 1))

    def test_local_only_and_bucket_only_are_reported_as_such(self):
        self.put("logos/new.png", b"not yet published")
        pl = self.plan({"logos/gone.png": record(b"only in the bucket")})
        self.assertEqual((pl["local_only"], pl["bucket_only"]), (["logos/new.png"], ["logos/gone.png"]))
        self.assertEqual(pl["conflicts"], [])

    def test_existing_only_still_refuses_to_create_an_object(self):
        self.put("brand/app-icon-v6a-rejected.png", b"never publish this")
        pl = self.plan({}, existing_only=True)
        self.assertEqual((pl["to_push"], pl["unpublished"]), ([], 1))

    def test_force_still_pushes_bytes_that_already_match(self):
        self.put("logos/a.png", b"same")
        pl = self.plan({"logos/a.png": record(b"same")}, force=True)
        self.assertEqual(pl["to_push"], ["logos/a.png"])
        self.assertEqual(pl["to_pull"], [])

    def test_a_key_is_compared_once_even_when_it_needs_the_fallback(self):
        self.put("logos/a.png", b"same")
        s3 = StubS3({"logos/a.png": sha_of(b"same")})
        pl = self.plan({"logos/a.png": {"size": 4, "etag": "abc-3"}}, s3=s3)
        self.assertEqual(s3.heads, ["logos/a.png"])           # one head serves both directions
        self.assertEqual((pl["to_push"], pl["to_pull"], pl["same"]), ([], [], 1))


class ListingS3(StubS3):
    """StubS3 plus a one-page `list_objects_v2`, enough for the real `main()` to plan against."""

    def __init__(self, remote: dict[str, bytes]):
        super().__init__()
        self.remote = remote

    def list_objects_v2(self, Bucket, Prefix=None, **_):  # noqa: N803
        keys = [k for k in sorted(self.remote) if Prefix is None or k.startswith(Prefix)]
        return {"Contents": [{"Key": k, "Size": len(self.remote[k]), "ETag": '"%s"' % md5_of(self.remote[k])}
                             for k in keys], "IsTruncated": False}


class PushGuard(TempCache):
    """PROMPT 95: `--push` refuses to CREATE objects unless `--allow-new` says so, before any upload.

    Driven through the real `main()` - the argument parsing, the plan and the upload loop - with the
    client, the repo root, the `.env` loader and `_put` replaced. `_put` is the only thing that can
    publish, so its call count IS the guard."""

    def push(self, argv, remote):
        s3 = ListingS3(remote)
        with mock.patch.object(sa, "client", lambda: s3), \
             mock.patch.object(sa, "find_repo_root", lambda: self.root), \
             mock.patch.object(sa, "load_dotenv", lambda *_: None), \
             mock.patch.object(sa, "_put") as put, \
             mock.patch("sys.stdout"), mock.patch("sys.stderr"):
            code = sa.main(argv)
        return code, sorted(c.args[2] for c in put.call_args_list)

    def test_a_push_that_would_create_an_object_refuses_and_uploads_nothing(self):
        self.put("brand/app-icon-mysports-tv-v6a-rejected.png", b"never publish this")
        self.put("logos/changed.png", b"new bytes")       # a legitimate rewrite, also held back
        code, puts = self.push(["--push"], {"logos/changed.png": b"old bytes"})
        self.assertEqual(code, 3)
        self.assertEqual(puts, [])          # THE GUARD: not one _put, so no partial publish

    def test_allow_new_publishes_the_new_object(self):
        self.put("logos/new-team.png", b"a new club")
        code, puts = self.push(["--push", "--allow-new"], {})
        self.assertEqual((code, puts), (0, ["logos/new-team.png"]))

    def test_a_push_with_nothing_new_proceeds_without_the_flag(self):
        # the guard must not fire on the ordinary case: rewriting what the bucket already has
        self.put("logos/changed.png", b"new bytes")
        self.put("logos/same.png", b"same")
        code, puts = self.push(["--push"], {"logos/changed.png": b"old bytes", "logos/same.png": b"same"})
        self.assertEqual((code, puts), (0, ["logos/changed.png"]))

    def test_existing_only_proceeds_and_creates_nothing(self):
        self.put("brand/app-icon-mysports-tv-v5-retired.png", b"retired")
        self.put("logos/changed.png", b"new bytes")
        code, puts = self.push(["--push", "--existing-only"], {"logos/changed.png": b"old bytes"})
        self.assertEqual((code, puts), (0, ["logos/changed.png"]))

    def test_force_does_not_bypass_the_guard(self):
        self.put("logos/same.png", b"same")
        self.put("network-logos/hbo-max-wide-2023-retired.svg", b"<svg/>")
        code, puts = self.push(["--push", "--force"], {"logos/same.png": b"same"})
        self.assertEqual((code, puts), (3, []))

    def test_the_nightly_logo_push_opts_in(self):
        wf = (ROOT / ".github" / "workflows" / "schedule_refresh.yml").read_text(encoding="utf-8")
        self.assertEqual(wf.count("--allow-new"), 1)          # exactly once, on the logo push line
        runs = [ln.strip() for ln in wf.splitlines() if ln.strip().startswith("run:") and "--allow-new" in ln]
        self.assertEqual(runs, ["run: python scripts/sync_assets.py --push --prefix logos/ --make-dark --allow-new"])


class NoKeyOnlyPull(unittest.TestCase):
    def test_the_pull_path_no_longer_decides_by_key_alone(self):
        src = (ROOT / "scripts" / "sync_assets.py").read_text(encoding="utf-8")
        self.assertNotIn("if key not in local:", src)


if __name__ == "__main__":
    unittest.main()
