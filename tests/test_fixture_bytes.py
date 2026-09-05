"""Recorded fixtures are BYTES, and these prove they still are.

WHY THIS IS A ROUND-TRIP TEST AND NOT A "NO CR" TEST, which is what prompt 49's brief asked for.
A rule of "no fixture may contain a CR byte" would fail immediately and correctly on the recorded
HTML: `indycar_2026_schedule.html` carries 5,727 CR bytes, `wwe_events.html` 1,957,
`wwe_premier_shows.html` 385 and `paramount_press_cbs.html` 24 - because that is what those servers
sent, and four tests pin their sha256. Deleting those CRs would break the assertions the `-text`
rule exists to protect.

The invariant that actually holds, and that the defect violated, is narrower and stronger:

    every tracked fixture's bytes on disk are the bytes in the index

That permits a recorded CRLF page, forbids a locally-corrupted working copy, and is exactly what
went wrong - four JSON fixtures sat CRLF on disk against LF blobs for three prompts while
`git status` reported the tree clean, because `.gitattributes` normalised them on read and git's
stat cache never re-compared them.

THE SECOND TEST IS THE CAUSE. `adapters/common.py`'s `dump_json` and `write_text` used
`Path.write_text(..., encoding="utf-8")` with no `newline=`, so Python's text mode turned every
"\\n" into CRLF on Windows and left it LF on the Actions runner - one adapter, two different byte
streams depending on where it ran. Working rule 1 in a costume; rule 29 names it.
"""
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
FIXTURE_DIRS = ("tests/fixtures", "web/test/fixtures")


def tracked(prefix: str) -> list[str]:
    r = subprocess.run(["git", "ls-files", prefix], cwd=ROOT, capture_output=True, text=True)
    if r.returncode != 0:
        return []
    return [line for line in r.stdout.split() if line]


def index_bytes(path: str) -> bytes | None:
    r = subprocess.run(["git", "show", ":" + path], cwd=ROOT, capture_output=True)
    return r.stdout if r.returncode == 0 else None


def git_available() -> bool:
    return subprocess.run(["git", "rev-parse", "--git-dir"], cwd=ROOT,
                          capture_output=True).returncode == 0


# --------------------------------------------------------------------------- the invariant
@pytest.mark.skipif(not git_available(), reason="not a git checkout")
@pytest.mark.parametrize("prefix", FIXTURE_DIRS)
def test_every_tracked_fixture_round_trips(prefix):
    """Disk bytes == index bytes, for every fixture.

    A failure here means a working copy has drifted from what git holds - which is invisible to
    `git status` when an attribute normalises the file on read, and which is how four fixtures sat
    wrong for three prompts.
    """
    files = tracked(prefix)
    if not files:
        pytest.skip("%s holds no tracked files" % prefix)
    drifted = []
    for f in files:
        p = ROOT / f
        if not p.exists():
            drifted.append("%s: tracked but absent from the working tree" % f)
            continue
        disk = p.read_bytes()
        idx = index_bytes(f)
        if idx is None:
            drifted.append("%s: not readable from the index" % f)
        elif disk != idx:
            drifted.append("%s: disk %d bytes (%d CR) vs index %d bytes (%d CR)"
                           % (f, len(disk), disk.count(b"\r"), len(idx), idx.count(b"\r")))
    assert not drifted, (
        "fixtures have drifted from the index - restore them with `git checkout --` after deleting "
        "them (a plain checkout is a no-op while git's stat cache still trusts them):\n  "
        + "\n  ".join(drifted))


@pytest.mark.skipif(not git_available(), reason="not a git checkout")
def test_the_recorded_pages_still_carry_the_bytes_their_servers_sent():
    """The positive half: CRs in a recorded page are DATA and must survive.

    Four tests pin these by sha256, so a normalisation that stripped their CRs would fail those -
    but only on a fresh clone, which is the worst place to find out. Asserted here directly.
    """
    expected = {
        "tests/fixtures/indycar_2026_schedule.html": 5727,
        "tests/fixtures/wwe_events.html": 1957,
        "tests/fixtures/wwe_premier_shows.html": 385,
        "tests/fixtures/paramount_press_cbs.html": 24,
    }
    for f, crs in expected.items():
        p = ROOT / f
        if not p.exists():
            pytest.skip("%s is not in this checkout" % f)
        assert p.read_bytes().count(b"\r") == crs, (
            "%s lost its CR bytes - `tests/fixtures/*.html -text` in .gitattributes is what keeps "
            "them, and a sha256 assertion depends on it" % f)


# --------------------------------------------------------------------------- the cause
WRITER_FILES = ("adapters/common.py", "scripts/build_cap_table.py")


@pytest.mark.parametrize("rel", WRITER_FILES)
def test_every_fixture_writer_pins_its_line_endings(rel):
    """A text write with no `newline=` emits CRLF on Windows and LF on Linux - the same code
    producing different bytes per machine. Every writer that can reach a TRACKED file pins it."""
    lines = (ROOT / rel).read_text(encoding="utf-8").splitlines()
    bare = []
    for i, line in enumerate(lines, 1):
        if ".write_text(" not in line or line.lstrip().startswith("#"):
            continue
        # A call can span several lines and carry its kwargs on any of them, so the whole call is
        # read - up to the line where the parentheses balance - rather than just the first line.
        # A one-line look-ahead was the first attempt and it reported a correct multi-line call.
        depth, call = 0, []
        for j in range(i - 1, min(i + 6, len(lines))):
            call.append(lines[j])
            depth += lines[j].count("(") - lines[j].count(")")
            if depth <= 0:
                break
        if "newline" not in " ".join(call):
            bare.append("%s:%d %s" % (rel, i, line.strip()[:90]))
    assert not bare, "text writes with no newline= :\n  " + "\n  ".join(bare)


def test_the_shared_writers_actually_emit_lf(tmp_path):
    """The behaviour, not the source. `dump_json` and `write_text` are what every adapter calls."""
    sys.path.insert(0, str(ROOT))
    from adapters.common import dump_json, write_text

    dump_json(tmp_path / "a.json", {"x": [1, 2]})
    write_text(tmp_path / "b.md", "one\ntwo\n")
    for name in ("a.json", "b.md"):
        raw = (tmp_path / name).read_bytes()
        assert b"\r" not in raw, "%s was written with CRLF" % name


# --------------------------------------------------------------------------- the attribute
def test_gitattributes_still_excludes_recorded_fetches_from_normalisation():
    """`-text` is what lets a recorded page keep its CRs. Prompt 48 added it; this keeps it."""
    attrs = (ROOT / ".gitattributes").read_text(encoding="utf-8")
    assert re.search(r"^tests/fixtures/\*\.html\s+-text\s*$", attrs, re.M)
    assert re.search(r"^tests/fixtures/\*\.json\s+-text\s*$", attrs, re.M)
