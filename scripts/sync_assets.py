#!/usr/bin/env python3
"""MySports - sync the local asset cache with the R2 bucket (deployment contract v1.0, D6 / section 3).

The bucket `mysports-assets` is the source of truth; `assets/` on any machine is a cache.

    python scripts/sync_assets.py --check          # list what differs, change nothing
    python scripts/sync_assets.py --push           # upload local files the bucket lacks or that differ
    python scripts/sync_assets.py --pull           # download bucket files the cache lacks or that differ
    python scripts/sync_assets.py --push --prefix logos/   # one prefix only
    python scripts/sync_assets.py --push --prefix logos/ --force   # rewrite even unchanged bytes (headers)
    python scripts/sync_assets.py --recache --prefix grids/        # set Cache-Control in place, no local file needed
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
# its art changes. `--force` rewrites them all at once and is the only way to set a header on an
# object that already exists; prompt 67 ran it over `logos/` to close the 1,145 that had none.
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


def recache(args) -> int:
    """Rewrite `Cache-Control` on objects the bucket ALREADY holds. Reads no local file at all.

    WHY THIS EXISTS RATHER THAN A WIDER `--push`. Every other route to an object needs a local file:
    `local_files()` walks `assets/{folder}` for the folders in FOLDERS, and `_put()` calls
    `upload_file(str(p), ...)`. `grids/` has no local cache directory - `assets/grids/` does not
    exist - so widening FOLDERS walks nothing. `--push-grids artifacts/rendering` DOES find grids
    here, 13 of them, but the bucket holds 35: it fixes a third and leaves the rest, and it is an
    upload path, so a stray file under the directory it is pointed at becomes a published object.

    THIS CANNOT PUBLISH, and not by remembering to skip. It iterates the keys `list_objects_v2`
    just returned and writes only those, so creating an object is not something it declines to do -
    it is something it has no expression for. `--existing-only` reaches the same result by skipping
    local files, which is a weaker guarantee for the same outcome.

    `copy_object` ONTO THE SAME KEY, verified against R2 before it was built (rule 34). Cloudflare's
    S3 compatibility page lists `x-amz-metadata-directive` and `Cache-Control` as implemented, and
    one real call on `grids/cfb/grid_2026-08-29.svg` confirmed it: the header was set, ContentType
    and the `sha256` user metadata survived, and the ETag and byte count did not move. No data
    transfer - one request per object, whatever the object weighs.

    METADATA IS REPLACED WHOLESALE, which is what REPLACE means, so ContentType and the sha256 this
    script writes on every upload are read first and passed back. Dropping the sha256 would make the
    next `--push` see every object as changed and re-upload the bucket.
    """
    root = find_repo_root()
    load_dotenv(root / ".env")
    s3 = client()
    bucket = os.getenv("R2_BUCKET_ASSETS", "mysports-assets")
    remote = remote_objects(s3, bucket, args.prefix)
    seen = len(remote)
    rewritten = already = 0
    for key in sorted(remote):
        h = s3.head_object(Bucket=bucket, Key=key)
        if h.get("CacheControl") == CACHE_CONTROL:
            already += 1
            continue
        ctype = h.get("ContentType") or CONTENT_TYPES.get(
            Path(key).suffix.lower(), "application/octet-stream")
        s3.copy_object(
            Bucket=bucket, Key=key, CopySource={"Bucket": bucket, "Key": key},
            MetadataDirective="REPLACE", CacheControl=CACHE_CONTROL,
            ContentType=ctype, Metadata=h.get("Metadata") or {},
        )
        rewritten += 1
        if rewritten % 50 == 0:
            print(f"  rewritten {rewritten}")
    after = len(remote_objects(s3, bucket, args.prefix))
    print(f"{args.prefix or '(whole bucket)'}: {seen} seen · {rewritten} rewritten · "
          f"{already} already correct")
    print(f"  objects under the prefix before {seen}, after {after}"
          + ("" if after == seen else "  <-- COUNT MOVED, WHICH THIS MODE CANNOT DO"))
    return 0 if after == seen else 1


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
    g.add_argument("--recache", action="store_true",
                   help="rewrite Cache-Control on objects the bucket ALREADY has, in place, reading "
                        "no local file. The only route to a prefix with no local cache, such as "
                        "grids/. Cannot create an object.")
    ap.add_argument("--prefix", help="key prefix filter (check/push/pull) or destination prefix (push-data)")
    ap.add_argument("--make-dark", action="store_true",
                    help="before pushing, build any missing assets/logos/{id}_dark.png (charcoal-floating "
                         "contexts, mobile addendum M12). Idempotent; a provider's own dark art is kept.")
    ap.add_argument("--existing-only", action="store_true",
                    help="never create an object: rewrite only keys the bucket ALREADY has, and skip "
                         "every local file it does not. Pair with --force to reset METADATA (the "
                         "cache header) without publishing anything new.")
    ap.add_argument("--force", action="store_true",
                    help="push every local file under --prefix even where the bytes already match. "
                         "For rewriting METADATA on objects that are otherwise unchanged - a header "
                         "cannot be set on an existing object any other way. Use --prefix.")
    ap.add_argument("--keep", type=int, help="push-data: after upload, delete the oldest objects under --prefix beyond this count")
    args = ap.parse_args(argv)
    if args.recache:
        return recache(args)
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

    to_push, to_pull, same, unpublished = [], [], 0, 0
    for key, p in local.items():
        r = remote.get(key)
        # --existing-only NEVER CREATES AN OBJECT (prompt 69). --force alone would have closed the
        # remaining cache-header gap in one command, and prompt 68 stopped because of what else it
        # would have done: 9 new objects under `network-logos/` and 12 under `brand/`, among them
        # `hbo-max-wide-2023-retired.svg`, `app-icon-mysports-tv-v5-retired.png` and
        # `...-v6a-rejected.png`. Publishing retired and rejected art is not a header fix. With this
        # flag the local cache decides only WHICH bytes to rewrite, never what the bucket contains.
        if args.existing_only and r is None:
            unpublished += 1
            continue
        # --force PUSHES BYTES THAT ALREADY MATCH, and the only reason it exists is HEADERS.
        # A normal push compares size then sha256 and skips anything identical, which is right for
        # bytes and wrong for metadata: prompt 66 added `Cache-Control: public, max-age=300` to
        # uploads and it reached only the 387 objects whose art happened to change that day, leaving
        # 1,145 answering with no policy at all - the behaviour that cost an hour on 2026-09-08.
        # There is no way to set a header on an existing R2 object except by writing it again.
        if args.force or r is None:
            to_push.append(key)
        elif r["size"] != p.stat().st_size or (remote_sha(s3, bucket, key) or "") != sha256(p):
            to_push.append(key)
        else:
            same += 1
    for key in remote:
        if key not in local:
            to_pull.append(key)
    print(f"  unchanged {same} · local-only/changed {len(to_push)} · bucket-only {len(to_pull)}"
          + (f" · not in bucket, SKIPPED {unpublished}" if args.existing_only else ""))

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
