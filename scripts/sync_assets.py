#!/usr/bin/env python3
"""MySports - sync the local asset cache with the R2 bucket (deployment contract v1.0, D6 / section 3).

The bucket `mysports-assets` is the source of truth; `assets/` on any machine is a cache.

    python scripts/sync_assets.py --check          # list what differs, change nothing
    python scripts/sync_assets.py --push           # upload local files the bucket lacks or that differ
    python scripts/sync_assets.py --pull           # download bucket files the cache lacks or that differ
    python scripts/sync_assets.py --push --prefix logos/   # one prefix only
    python scripts/sync_assets.py --push-grids artifacts/rendering            # grids/{sport}/grid_{date}.svg|.png|@2x.png (public bucket)
    python scripts/sync_assets.py --push-data artifacts/validation --prefix fixtures/2026-09-01/   # private bucket (R2_BUCKET_DATA)
    python scripts/sync_assets.py --push-data backup.sql.gz --prefix backups/ --keep 8            # upload one file, prune oldest beyond 8

Reads R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_ASSETS from the environment or
the repo-root .env (never printed). Requires boto3 (pip install boto3). Windows-portable.

Layout (contract section 3): assets/logos/*  -> logos/*, assets/network-logos/* -> network-logos/*,
assets/fonts/* -> fonts/*, assets/brand/* -> brand/* (lockup source art). Keys are lowercase; comparison is by size + local SHA-256 vs the object's
`sha256` metadata (set on every upload by this script), so unchanged files are skipped.
"""
from __future__ import annotations

import argparse
import hashlib
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from adapters.common import find_repo_root, load_dotenv  # noqa: E402

FOLDERS = ("logos", "network-logos", "fonts", "brand")   # brand/ = lockup source art (decision 7)
CONTENT_TYPES = {".png": "image/png", ".svg": "image/svg+xml", ".ttf": "font/ttf", ".jpg": "image/jpeg", ".webp": "image/webp"}


def sha256(p: Path) -> str:
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def client():
    try:
        import boto3
    except ImportError:
        print("ERROR: boto3 not installed (pip install boto3)", file=sys.stderr)
        sys.exit(2)
    acct, key, secret = (os.getenv(k) for k in ("R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"))
    if not all((acct, key, secret)):
        print("ERROR: R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY missing from environment or .env", file=sys.stderr)
        sys.exit(2)
    return boto3.client("s3", endpoint_url=f"https://{acct}.r2.cloudflarestorage.com", aws_access_key_id=key,
                        aws_secret_access_key=secret, region_name="auto")


def local_files(root: Path, prefix: str | None) -> dict[str, Path]:
    out: dict[str, Path] = {}
    for folder in FOLDERS:
        d = root / "assets" / folder
        if not d.exists():
            continue
        for p in sorted(d.rglob("*")):
            if p.is_file():
                key = f"{folder}/{p.relative_to(d).as_posix()}".lower()
                if prefix is None or key.startswith(prefix):
                    out[key] = p
    return out


def remote_objects(s3, bucket: str, prefix: str | None) -> dict[str, dict]:
    out: dict[str, dict] = {}
    kwargs = {"Bucket": bucket}
    if prefix:
        kwargs["Prefix"] = prefix
    token = None
    while True:
        if token:
            kwargs["ContinuationToken"] = token
        resp = s3.list_objects_v2(**kwargs)
        for o in resp.get("Contents", []):
            out[o["Key"]] = {"size": o["Size"], "etag": o.get("ETag", "").strip('"')}
        if not resp.get("IsTruncated"):
            break
        token = resp.get("NextContinuationToken")
    return out


def remote_sha(s3, bucket: str, key: str) -> str | None:
    try:
        return (s3.head_object(Bucket=bucket, Key=key).get("Metadata") or {}).get("sha256")
    except Exception:  # noqa: BLE001
        return None


# THE ART HAD NO CACHE POLICY AT ALL, and it cost an hour on 2026-09-08.
#
# Joe's phone kept painting the old logos after 9a69810 shipped. The bytes in R2 were right and the
# same URL in Safari showed the new art, but the app - installed to the home screen - kept the old
# one until he re-added it. An hour went into ruling out the art, the contrast, the render scale and
# the CDN. THERE IS NO SERVICE WORKER (no `serviceWorker.register`, no workbox, no sw.js anywhere in
# web/), so nothing in the app was caching it: these uploads carried `ContentType` and nothing else,
# and a response with no `Cache-Control` lets a browser pick its own HEURISTIC freshness - commonly a
# fraction of the object's age, which for a file that has sat in the bucket for days is hours or days.
# `teamLogoDarkUrl()` (web/lib/config.js:156) is a bare path that never changes when the art does, so
# nothing ever told a client to look again.
#
# WHY max-age=300 AND NOT stale-while-revalidate. SWR lets a client serve the STALE copy while it
# refetches in the background, so the first load after a change still paints the old art - exactly
# the symptom this is here to stop, just shorter. Five minutes of free reuse, then a conditional
# request that costs a 304 on a small PNG, buys correctness on the first look. If request count ever
# matters more than that, appending `, stale-while-revalidate=604800` is the one-token change.
#
# ONLY NEW UPLOADS CARRY IT. Objects already in the bucket keep the headers they were written with,
# and the push below skips anything whose bytes match, so the fix reaches an object the first time
# its art changes - or all at once if someone forces a re-upload.
CACHE_CONTROL = "public, max-age=300"


def _extra_args(p: Path) -> dict:
    """The upload metadata, in ONE place. It was duplicated at two call sites, and that is how both
    of them came to be missing a cache policy for as long as they were."""
    return {
        "ContentType": CONTENT_TYPES.get(p.suffix.lower(), "application/octet-stream"),
        "CacheControl": CACHE_CONTROL,
        "Metadata": {"sha256": sha256(p)},
    }


def _put(s3, bucket: str, key: str, p: Path) -> None:
    s3.upload_file(str(p), bucket, key, ExtraArgs=_extra_args(p))


def special_modes(args) -> int:
    root = find_repo_root()
    load_dotenv(root / ".env")
    s3 = client()
    if args.push_grids:
        bucket = os.getenv("R2_BUCKET_ASSETS", "mysports-assets")
        base = Path(args.push_grids)
        n = 0
        for p in sorted(base.rglob("grid_*")):
            if p.suffix.lower() not in (".svg", ".png"):
                continue
            sport = p.parent.name if p.parent != base else "cfb"        # renderer v1.6: pro leagues render into artifacts/rendering/{sport}/
            # The FULL filename is the key (grid_2026-10-01.svg), because that is the key
            # scripts/register_grids.py stores in generated_grids.svg_asset_url. Stripping the "grid_"
            # prefix here - as this did until 2026-09-02 - made every archived grid URL in the database
            # a 404. One key scheme, and the registry's rows are the ones that must keep working.
            key = f"grids/{sport}/{p.name}".lower()
            _put(s3, bucket, key, p); n += 1
            print("  ", key)
        print(f"pushed {n} grid file(s) -> {bucket}")
        return 0
    if args.push_data:
        bucket = os.getenv("R2_BUCKET_DATA", "mysports-data")
        prefix = (args.prefix or "").lstrip("/")
        if prefix and not prefix.endswith("/"):
            prefix += "/"
        src = Path(args.push_data)
        files = [src] if src.is_file() else [p for p in sorted(src.rglob("*")) if p.is_file()]
        n = 0
        for p in files:
            rel = p.name if src.is_file() else p.relative_to(src).as_posix()
            _put(s3, bucket, f"{prefix}{rel}", p); n += 1
        print(f"pushed {n} file(s) -> {bucket}/{prefix}")
        if args.keep:
            objs = sorted(remote_objects(s3, bucket, prefix).keys())
            for key in objs[:-args.keep] if len(objs) > args.keep else []:
                s3.delete_object(Bucket=bucket, Key=key); print("  pruned", key)
        return 0
    return 0


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--check", action="store_true")
    g.add_argument("--push", action="store_true")
    g.add_argument("--pull", action="store_true")
    g.add_argument("--push-grids", metavar="DIR", help="upload grid_*.svg/png from DIR (and DIR/{sport}/) to grids/{sport}/grid_{date}.* - the key register_grids.py stores")
    g.add_argument("--push-data", metavar="PATH", help="upload a file or directory tree to the PRIVATE bucket under --prefix")
    ap.add_argument("--prefix", help="key prefix filter (check/push/pull) or destination prefix (push-data)")
    ap.add_argument("--make-dark", action="store_true",
                    help="before pushing, build any missing assets/logos/{id}_dark.png (charcoal-floating "
                         "contexts, mobile addendum M12). Idempotent; a provider's own dark art is kept.")
    ap.add_argument("--keep", type=int, help="push-data: after upload, delete the oldest objects under --prefix beyond this count")
    args = ap.parse_args(argv)
    if args.push_grids or args.push_data:
        return special_modes(args)

    root = find_repo_root()
    load_dotenv(root / ".env")
    bucket = os.getenv("R2_BUCKET_ASSETS", "mysports-assets")
    if args.make_dark:
        # Two logo contexts ship to the same bucket: the RAW {id}.png that grid cap endcaps use
        # unmodified, and the {id}_dark.png a listings card floats on charcoal. The second is derived
        # here so it can never drift from the first. Pillow only; the push itself is unchanged.
        #
        # Since prompt 64 `data/logo_conditioning.json` overrides that derive for the teams Joe ruled
        # raw: their dark file is a byte copy of the base, and the byte-identity test that normally
        # means "no provider art" is not applied to them. Reported separately below so a run that
        # quietly reconditioned a ruled team would show up as a number that moved.
        sys.path.insert(0, str(Path(__file__).resolve().parent))
        from build_web_marks import team_dark_variants
        c = team_dark_variants()
        print(f"dark logo variants: {c['generated']} generated, {c['ruled_raw']} copied raw "
              f"(ruled skip_derive), {c['present']} already present "
              f"(provider art kept), {c['skipped']} unreadable")
    s3 = client()
    local = local_files(root, args.prefix)
    remote = remote_objects(s3, bucket, args.prefix)
    print(f"bucket {bucket}: {len(remote)} objects; local cache: {len(local)} files" + (f" (prefix {args.prefix})" if args.prefix else ""))

    to_push, to_pull, same = [], [], 0
    for key, p in local.items():
        r = remote.get(key)
        if r is None:
            to_push.append(key)
        elif r["size"] != p.stat().st_size or (remote_sha(s3, bucket, key) or "") != sha256(p):
            to_push.append(key)
        else:
            same += 1
    for key in remote:
        if key not in local:
            to_pull.append(key)
    print(f"  unchanged {same} · local-only/changed {len(to_push)} · bucket-only {len(to_pull)}")

    if args.check:
        for k in to_push[:50]:
            print("  would push:", k)
        for k in to_pull[:50]:
            print("  would pull:", k)
        return 0

    if args.push:
        n = 0
        for key in to_push:
            p = local[key]
            _put(s3, bucket, key, p)
            n += 1
            if n % 50 == 0:
                print(f"  pushed {n}/{len(to_push)}")
        print(f"pushed {n} file(s) -> {bucket}")
        return 0

    if args.pull:
        n = 0
        for key in to_pull:
            folder, _, rest = key.partition("/")
            dest = root / "assets" / folder / rest
            dest.parent.mkdir(parents=True, exist_ok=True)
            s3.download_file(bucket, key, str(dest))
            n += 1
            if n % 50 == 0:
                print(f"  pulled {n}/{len(to_pull)}")
        print(f"pulled {n} file(s) <- {bucket}")
        return 0
    return 0


if __name__ == "__main__":
    sys.exit(main())
