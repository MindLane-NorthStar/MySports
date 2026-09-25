"""`scripts/remove_codex_agents_md.py` deletes a root `AGENTS.md` only when it is proved to be the Codex
desktop app's rewrite of a `CLAUDE.md` this repo has had (register §65, prompt 120).

Each test builds its own git repository in a temp directory with four commits of `CLAUDE.md`, so the
history the script walks is known exactly. The bytes are written and committed as LF with
`core.autocrlf=false`, so what `git show` returns is what was written, whatever the machine's global
setting is (Joe's is `true`).

Mutation-checked four ways, each red: compare against the working tree only (the three-commits-back
copy is kept); skip the `Claude.ai` swap (the copy that missed it is deleted, and the exact copies no
longer match); delete on mismatch (the extra-line copy is gone); exit 0 on mismatch (the extra-line
copy reports success). A fifth since 2026-09-25: skip the `CLAUDE.md` swap (the three-swaps test fails
on the literal ab5e4f4 line, and the copy that missed the swap is deleted) - the fixture's CLAUDE.md
names itself, as the real one has since `ab5e4f4`, or this swap would go untested exactly as it went
unseen. The exact-copy tests stay green under that mutation because they build their AGENTS.md with
`rm.codex_rewrite` itself; the literal line is what pins the swap.
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from scripts import remove_codex_agents_md as rm  # noqa: E402

V1 = (
    b"# The standing brief\n\nRead this in Claude Code first.\nThe Project lives on Claude.ai.\n"
    b"The Codex desktop app's copy of `CLAUDE.md` is removed by the script.\nrule one\n"
)
V2 = V1.replace(b"rule one", b"rule one\nrule two")
V3 = V2.replace(b"rule two", b"rule two\nrule three")
V4 = V3.replace(b"rule three", b"rule three\nrule four")
VERSIONS = (V1, V2, V3, V4)

GIT = (
    "git", "-c", "user.name=test", "-c", "user.email=test@example.invalid",
    "-c", "commit.gpgsign=false", "-c", "core.autocrlf=false",
)


def _git(root: Path, *args: str) -> str:
    proc = subprocess.run([*GIT, "-C", str(root), *args], capture_output=True, check=True)
    return proc.stdout.decode("utf-8", "replace").strip()


@pytest.fixture
def repo(tmp_path: Path) -> tuple[Path, list[str]]:
    """A repo whose CLAUDE.md has four commits, V1 oldest; returns the root and the four SHAs in order."""
    root = tmp_path / "repo"
    root.mkdir()
    _git(root, "init", "-q")
    shas: list[str] = []
    for i, body in enumerate(VERSIONS, start=1):
        (root / "CLAUDE.md").write_bytes(body)
        _git(root, "add", "CLAUDE.md")
        _git(root, "commit", "-q", "-m", f"claude.md v{i}")
        shas.append(_git(root, "rev-parse", "HEAD"))
    return root, shas


def _run(root: Path, capsys: pytest.CaptureFixture[str]) -> tuple[int, str]:
    code = rm.main(["--root", str(root)])
    out = capsys.readouterr()
    return code, out.out + out.err


def test_the_rewrite_is_the_three_swaps_in_order() -> None:
    assert rm.codex_rewrite(V4) == (
        V4.replace(b"Claude Code", b"Codex").replace(b"Claude.ai", b"Codex.ai").replace(b"CLAUDE.md", b"AGENTS.md")
    )
    assert b"Claude" not in rm.codex_rewrite(V4) and b"CLAUDE" not in rm.codex_rewrite(V4)
    # the one line prompt 122's run found different, as it reads in CLAUDE.md at ab5e4f4
    assert rm.codex_rewrite(b"the Codex desktop app's copy of `CLAUDE.md` is removed") == (
        b"the Codex desktop app's copy of `AGENTS.md` is removed"
    )


def test_an_exact_rewrite_of_the_current_claude_md_is_removed(repo, capsys) -> None:
    root, shas = repo
    (root / "AGENTS.md").write_bytes(rm.codex_rewrite(V4))
    code, out = _run(root, capsys)
    assert code == 0
    assert not (root / "AGENTS.md").exists()
    assert "AGENTS.md removed" in out and shas[3][:7] in out
    assert "LF line endings" in out and "sha256" in out and "mtime" in out


def test_an_exact_rewrite_of_claude_md_three_commits_back_is_removed(repo, capsys) -> None:
    root, shas = repo
    (root / "AGENTS.md").write_bytes(rm.codex_rewrite(V1))
    code, out = _run(root, capsys)
    assert code == 0
    assert not (root / "AGENTS.md").exists()
    assert shas[0][:7] in out, "the match must name the commit whose CLAUDE.md it is, not just say removed"


def test_a_rewrite_of_an_uncommitted_working_tree_claude_md_is_removed(repo, capsys) -> None:
    root, _shas = repo
    edited = V4 + b"rule five, not yet committed\n"
    (root / "CLAUDE.md").write_bytes(edited)
    (root / "AGENTS.md").write_bytes(rm.codex_rewrite(edited))
    code, out = _run(root, capsys)
    assert code == 0
    assert not (root / "AGENTS.md").exists()
    assert "working tree" in out


def test_one_extra_line_is_kept_and_exits_1(repo, capsys) -> None:
    root, shas = repo
    (root / "AGENTS.md").write_bytes(rm.codex_rewrite(V4) + b"an instruction nobody wrote into CLAUDE.md\n")
    code, out = _run(root, capsys)
    assert code == 1
    assert (root / "AGENTS.md").is_file(), "an unverified file is Joe's to judge, never the script's to delete"
    assert "AGENTS.md kept" in out
    assert shas[3][:7] in out, "the report points at the nearest candidate"
    assert "+an instruction nobody wrote into CLAUDE.md" in out


def test_a_rewrite_that_missed_the_claude_ai_swap_is_kept_and_exits_1(repo, capsys) -> None:
    root, _shas = repo
    (root / "AGENTS.md").write_bytes(V4.replace(b"Claude Code", b"Codex"))
    code, out = _run(root, capsys)
    assert code == 1
    assert (root / "AGENTS.md").is_file()
    assert "-The Project lives on Codex.ai." in out and "+The Project lives on Claude.ai." in out


def test_a_rewrite_that_missed_the_claude_md_swap_is_kept_and_exits_1(repo, capsys) -> None:
    root, _shas = repo
    (root / "AGENTS.md").write_bytes(V4.replace(b"Claude Code", b"Codex").replace(b"Claude.ai", b"Codex.ai"))
    code, out = _run(root, capsys)
    assert code == 1
    assert (root / "AGENTS.md").is_file()
    assert "-The Codex desktop app's copy of `AGENTS.md`" in out and "+The Codex desktop app's copy of `CLAUDE.md`" in out


def test_no_agents_md_exits_0_silently(repo, capsys) -> None:
    root, _shas = repo
    code, out = _run(root, capsys)
    assert code == 0
    assert out == ""


def test_crlf_bytes_are_compared_as_they_are(repo, capsys) -> None:
    # A CRLF copy of an LF CLAUDE.md is NOT byte-identical, and the report says which endings it carries.
    root, _shas = repo
    (root / "AGENTS.md").write_bytes(rm.codex_rewrite(V4).replace(b"\n", b"\r\n"))
    code, out = _run(root, capsys)
    assert code == 1
    assert (root / "AGENTS.md").is_file()
    assert "CRLF line endings" in out


def test_claude_md_carries_joes_authorization_for_the_script() -> None:
    # The deletion is authorized by the working rule, not by this script's existence.
    text = (ROOT / "CLAUDE.md").read_text(encoding="utf-8")
    assert "scripts/remove_codex_agents_md.py" in text
    assert "2026-09-23" in text
