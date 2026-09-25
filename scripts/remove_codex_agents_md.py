#!/usr/bin/env python3
"""Remove a root `AGENTS.md` only when it is verified as the Codex desktop app's copy of `CLAUDE.md`.

    python scripts/remove_codex_agents_md.py [--root PATH]

WHAT WRITES THE FILE (register §65, measured by Cowork on 2026-09-23 from Joe's `.codex` folder). The
Codex desktop app's "import from Claude Code" sync is on for every item type, `AGENTS_MD` is one of the
types it imports, and its log records an import in the same minute each copy appeared. Each copy is
`CLAUDE.md` as it stood when the import ran, with `Claude Code` -> `Codex`, `Claude.ai` -> `Codex.ai` and
`CLAUDE.md` -> `AGENTS.md`, and nothing else (§49, §54 block F and §64 each measured one; the third swap
was first seen 2026-09-24, see `codex_rewrite`). Joe keeps the import on, so the file
will keep arriving, and `tests/test_agent_instruction_files.py` keeps going red while it is there.

WHAT THIS SCRIPT DOES ABOUT IT. It proves that shape before it deletes anything. The file must be
byte-identical to that rewrite of `CLAUDE.md` as it stood in one of the last 50 commits that touched it
(`git log -50 --format=%H -- CLAUDE.md`, then `git show <sha>:CLAUDE.md`), or of the working-tree
`CLAUDE.md`. Line endings are compared as the bytes are, with no normalisation, and the report says
which the file carries. Anything that is not an exact match is kept and described, because an unknown
file is Joe's to judge and not this script's.

    exit 0  no AGENTS.md (silent), or a verified copy removed (one line: the matching CLAUDE.md commit,
            the file's size, sha256 and mtime)
    exit 1  an AGENTS.md that is not a verified copy: kept; the nearest candidate and the diff are printed
    exit 2  git could not be read

Joe's standing authorization for the deletion is working rule 35's amendment in CLAUDE.md (2026-09-23).
The deletion goes through this script and never a bare `rm`, so it is one named, repeatable command.
"""
from __future__ import annotations

import difflib
import hashlib
import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path

HISTORY_DEPTH = 50
DIFF_LINES_SHOWN = 40


def codex_rewrite(claude_md: bytes) -> bytes:
    """The transformation the Codex import applies: `Claude Code` -> `Codex`, `Claude.ai` -> `Codex.ai`,
    then `CLAUDE.md` -> `AGENTS.md`.

    The third swap was invisible until `ab5e4f4`, the first `CLAUDE.md` to contain its own name (rule
    35's amendment, once); the copy of it that arrived 2026-09-24 renamed that one occurrence, and prompt
    122's run kept it as unverified for want of this line.
    """
    return (
        claude_md.replace(b"Claude Code", b"Codex")
        .replace(b"Claude.ai", b"Codex.ai")
        .replace(b"CLAUDE.md", b"AGENTS.md")
    )


def line_endings(data: bytes) -> str:
    crlf = data.count(b"\r\n")
    lf = data.count(b"\n") - crlf
    if crlf and lf:
        return f"mixed ({crlf} CRLF, {lf} LF)"
    if crlf:
        return "CRLF"
    return "LF"


def _git(root: Path, *args: str) -> bytes:
    proc = subprocess.run(
        ["git", "-C", str(root), *args], capture_output=True, check=False
    )
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.decode("utf-8", "replace").strip() or f"git {' '.join(args)} failed")
    return proc.stdout


def candidates(root: Path) -> list[tuple[str, bytes]]:
    """Every CLAUDE.md this script accepts a rewrite of: the last 50 commits that touched it, then the working tree."""
    out: list[tuple[str, bytes]] = []
    log = _git(root, "log", f"-{HISTORY_DEPTH}", "--format=%H", "--", "CLAUDE.md")
    for sha in log.decode("ascii").split():
        out.append((f"CLAUDE.md at {sha[:7]}", _git(root, "show", f"{sha}:CLAUDE.md")))
    working = root / "CLAUDE.md"
    if working.is_file():
        out.append(("CLAUDE.md in the working tree", working.read_bytes()))
    return out


def _nearest(target: bytes, cands: list[tuple[str, bytes]]) -> tuple[str, bytes, list[str]]:
    """The candidate whose rewrite differs from the file on the fewest lines, with that diff."""
    best_changed = -1
    best: tuple[str, bytes, list[str]] = ("", b"", [])
    target_lines = target.decode("utf-8", "replace").splitlines(keepends=True)
    for label, raw in cands:
        rewritten = codex_rewrite(raw)
        diff = list(
            difflib.unified_diff(
                rewritten.decode("utf-8", "replace").splitlines(keepends=True),
                target_lines,
                fromfile=f"codex rewrite of {label}",
                tofile="AGENTS.md",
                n=0,
            )
        )
        changed = sum(1 for line in diff if line[:1] in "+-" and not line.startswith(("+++", "---")))
        if best_changed < 0 or changed < best_changed:
            best_changed = changed
            best = (label, rewritten, diff)
    return best


def main(argv: list[str] | None = None) -> int:
    args = list(sys.argv[1:] if argv is None else argv)
    root = Path(__file__).resolve().parents[1]
    if "--root" in args:
        root = Path(args[args.index("--root") + 1]).resolve()
    agents = root / "AGENTS.md"
    if not agents.is_file():
        return 0

    data = agents.read_bytes()
    size = len(data)
    digest = hashlib.sha256(data).hexdigest()
    mtime = datetime.fromtimestamp(agents.stat().st_mtime).astimezone().isoformat(timespec="seconds")

    try:
        cands = candidates(root)
    except (RuntimeError, OSError) as exc:
        print(f"AGENTS.md kept: could not read CLAUDE.md's history ({exc})", file=sys.stderr)
        return 2
    if not cands:
        print("AGENTS.md kept: no CLAUDE.md to compare against", file=sys.stderr)
        return 2

    for label, raw in cands:
        if codex_rewrite(raw) == data:
            os.remove(agents)
            print(
                f"AGENTS.md removed: the Codex rewrite of {label}; "
                f"{size:,} bytes, sha256 {digest}, mtime {mtime}, {line_endings(data)} line endings"
            )
            return 0

    label, rewritten, diff = _nearest(data, cands)
    print(
        f"AGENTS.md kept: not the Codex rewrite of any CLAUDE.md in the last {HISTORY_DEPTH} commits "
        f"or the working tree ({len(cands)} candidates compared). "
        f"The file is {size:,} bytes, sha256 {digest}, mtime {mtime}, {line_endings(data)} line endings; "
        f"the nearest is {label} ({len(rewritten):,} bytes, {line_endings(rewritten)}). "
        "Something in it is not CLAUDE.md, so it is Joe's to judge - do not delete it by hand."
    )
    for line in diff[:DIFF_LINES_SHOWN]:
        sys.stdout.write(line if line.endswith("\n") else line + "\n")
    if len(diff) > DIFF_LINES_SHOWN:
        print(f"... {len(diff) - DIFF_LINES_SHOWN} more diff lines")
    return 1


if __name__ == "__main__":
    sys.exit(main())
