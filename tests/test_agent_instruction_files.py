"""`CLAUDE.md` is the only agent-instruction file this repo has (Joe's ruling, 2026-09-22, prompt 109).

WHY A GATE AND NOT `git status`. A stray root `AGENTS.md` - `CLAUDE.md` with "Claude Code" replaced by
"Codex" and "Claude.ai" by "Codex.ai", byte for byte - appeared on 2026-09-14 and was deleted by prompt
100 (register §49), which chose `git status` visibility as the guard: "if it comes back it shows as
`?? AGENTS.md`". It came back on 2026-09-16 and was not noticed until 2026-09-22 - six days and three
commits later. Visibility is only a guard if someone looks, and a stray write is exactly the case
nobody is looking for. So it is a red gate now.

WHERE IT COMES FROM, MEASURED (prompt 120, register §65). The Codex desktop app's "import from Claude
Code" sync writes it: the sync is on for every item type in Joe's Codex config, `AGENTS_MD` is one of
the types it imports, and its log records an import at 2026-09-23 16:26:17 UTC - the minute that day's
copy was created - with its first-run marker two minutes before the 2026-09-14 copy. It is NOT a stray
write from another project, which is what this docstring said from prompt 109 to prompt 120, and it
is not a second agent working this repo. Joe keeps the import on. THE FIX IS TO RUN
`python scripts/remove_codex_agents_md.py` FIRST: it deletes the file only when it is byte-identical
to that rewrite of a `CLAUDE.md` from the last 50 commits or the working tree, and keeps anything else
for Joe to judge.

WHY IT MATTERS EVEN WHEN NOBODY MEANT IT. The danger does not depend on how the file arrived: a copy of
the working rules drifts (the September copy was two rows behind `CLAUDE.md` within a day), it carries
the unwaivable stop list and the push authorization, and a file that arrives by accident can be read
on purpose. This is the same second-copy failure that made `docs/handoff-status.md` the only home for
the gate floors.

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
        "WHERE IT COMES FROM, so you do not go hunting for an intruder: the Codex desktop app's \"import\n"
        "from Claude Code\" sync writes CLAUDE.md here as AGENTS.md with the agent name swapped (register\n"
        "§65, measured 2026-09-23). Joe keeps that import on. RUN python scripts/remove_codex_agents_md.py\n"
        "FIRST: it deletes the file only when it is byte-identical to that rewrite of a CLAUDE.md this repo\n"
        "has had, and keeps anything else. A file the script keeps is a new finding and Joe wants to know.\n"
    )


@pytest.mark.parametrize("rel", FOREIGN_INSTRUCTION_FILES)
def test_no_agent_instruction_file_other_than_claude_md(rel: str) -> None:
    path = ROOT / rel
    assert not path.exists(), _message(rel, path)


def test_claude_md_is_the_one_that_exists() -> None:
    # The rule is "CLAUDE.md and nothing else", and half of that is that CLAUDE.md is there. A run
    # from a checkout that lost it would otherwise pass the test above vacuously.
    assert (ROOT / "CLAUDE.md").is_file(), "CLAUDE.md is the standing brief and must exist at the root"
