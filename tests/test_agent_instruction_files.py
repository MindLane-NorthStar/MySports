"""`CLAUDE.md` is the only agent-instruction file this repo has (Joe's ruling, 2026-09-22, prompt 109).

WHY A GATE AND NOT `git status`. A stray root `AGENTS.md` - `CLAUDE.md` with "Claude Code" replaced by
"Codex", byte for byte - appeared on 2026-09-14 and was deleted by prompt 100 (register §49), which
chose `git status` visibility as the guard: "if it comes back it shows as `?? AGENTS.md`". It came
back on 2026-09-16 and was not noticed until 2026-09-22 - six days and three commits later. Visibility
is only a guard if someone looks, and a stray write is exactly the case nobody is looking for. So it
is a red gate now.

WHY IT MATTERS EVEN WHEN NOBODY MEANT IT. The known cause is a STRAY WRITE FROM ANOTHER PROJECT - Codex
output generated for something else that landed in this folder - not a second agent working this
repo. The danger does not depend on intent: a copy of the working rules drifts (the September copy
was two rows behind `CLAUDE.md` within a day), it carries the unwaivable stop list and the push
authorization, and a file that arrives by accident can be read on purpose. This is the same
second-copy failure that made `docs/handoff-status.md` the only home for the gate floors.

THE FAILURE MESSAGE IS THE DELIVERABLE. Someone hitting this in four months has none of this context,
so the assertion text says what was found, why it is dangerous, and what to do - delete it and find
what wrote it - rather than pointing at an allowlist. There is no allowlist.

The conventions listed are the ones that exist today; add to the list when a new one appears, never
remove from it to make a run go green.
"""
from __future__ import annotations

from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]

# Root-level instruction files other agents read, by convention name. `CLAUDE.md` is the one this
# repo has and is deliberately NOT here.
FOREIGN_INSTRUCTION_FILES = (
    "AGENTS.md",                        # Codex, and a growing number of others
    "GEMINI.md",                        # Gemini CLI
    ".cursorrules",                     # Cursor
    ".windsurfrules",                   # Windsurf
    ".github/copilot-instructions.md",  # GitHub Copilot
    "CONVENTIONS.md",                   # aider
)


def _message(rel: str, path: Path) -> str:
    size = path.stat().st_size if path.is_file() else 0
    return (
        f"\n\nFOUND {rel} at the repo root ({size:,} bytes).\n"
        "\n"
        "CLAUDE.md is the ONLY agent-instruction file this repository has (Joe's ruling, 2026-09-22,\n"
        "register §54). Any other is a copy of the working rules, and a copy is dangerous whatever\n"
        "put it there: it drifts from CLAUDE.md within days, nothing fails when it does, and it\n"
        "carries the unwaivable stop list and the push authorization - a file that arrives by\n"
        "accident can be read on purpose.\n"
        "\n"
        "THE FIX IS TO DELETE THE FILE AND FIND OUT WHAT CREATED IT. It is not to add the name to a\n"
        "list in this test - there is no allowlist, on purpose - and it is not to gitignore it, which\n"
        "would hide it from both this gate and the eye (register §49).\n"
        "\n"
        "THE KNOWN CAUSE, so you do not go hunting for an intruder: on 2026-09-16 the file was Codex\n"
        "output generated for an ENTIRELY DIFFERENT PROJECT that landed in this folder - a stray\n"
        "write, not a second agent working this repo. Check for that first. If this file is not that\n"
        "shape (diff it against CLAUDE.md with the agent name swapped), it is a new finding and Joe\n"
        "wants to know.\n"
    )


@pytest.mark.parametrize("rel", FOREIGN_INSTRUCTION_FILES)
def test_no_agent_instruction_file_other_than_claude_md(rel: str) -> None:
    path = ROOT / rel
    assert not path.exists(), _message(rel, path)


def test_claude_md_is_the_one_that_exists() -> None:
    # The rule is "CLAUDE.md and nothing else", and half of that is that CLAUDE.md is there. A run
    # from a checkout that lost it would otherwise pass the test above vacuously.
    assert (ROOT / "CLAUDE.md").is_file(), "CLAUDE.md is the standing brief and must exist at the root"
