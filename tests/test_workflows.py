"""GitHub Actions workflow files: the things YAML parsing does not catch.

WHY THIS EXISTS. Prompt 46 validated bootstrap_season.yml with PyYAML, reported it green, and shipped
a file GitHub could not parse. Every push since failed in 0 seconds with

    failed to parse workflow: (Line: 60, Col: 14): An expression was expected

because a shell COMMENT inside a `run:` block contained a literal empty Actions expression. Actions
substitutes expressions everywhere in the block, comments included, and an empty one is a syntax
error. PyYAML sees a perfectly good string.

That is rule 24 in a new costume: a Python-side parse is no evidence the runtime agrees.
"""

import re
from pathlib import Path

import pytest

try:
    import yaml
except ImportError:                                     # pragma: no cover
    yaml = None

ROOT = Path(__file__).resolve().parents[1]
WORKFLOWS = sorted((ROOT / ".github" / "workflows").glob("*.yml"))

# `${{` ... `}}` with nothing but whitespace between them.
EMPTY_EXPR = re.compile(r"\$\{\{\s*\}\}")
# Any expression, so we can check the ones we find are non-empty and balanced.
ANY_EXPR = re.compile(r"\$\{\{(.*?)\}\}", re.DOTALL)


def test_there_are_workflows_to_check():
    assert WORKFLOWS, "no workflow files found - this test would pass vacuously"


@pytest.mark.parametrize("path", WORKFLOWS, ids=lambda p: p.name)
def test_no_empty_actions_expression(path):
    """The exact defect prompt 46 shipped. It is a parse error for the WHOLE file, so one of these
    anywhere - even inside a shell comment - stops every trigger, not just the step it is in."""
    text = path.read_text(encoding="utf-8")
    hits = [
        (i, line) for i, line in enumerate(text.splitlines(), 1) if EMPTY_EXPR.search(line)
    ]
    assert not hits, "empty ${{ }} expression(s) at %s" % (
        ", ".join("line %d: %s" % (i, line.strip()) for i, line in hits)
    )


@pytest.mark.parametrize("path", WORKFLOWS, ids=lambda p: p.name)
def test_every_expression_has_content(path):
    text = path.read_text(encoding="utf-8")
    for m in ANY_EXPR.finditer(text):
        assert m.group(1).strip(), "empty expression at offset %d in %s" % (m.start(), path.name)


@pytest.mark.parametrize("path", WORKFLOWS, ids=lambda p: p.name)
def test_braces_are_balanced(path):
    text = path.read_text(encoding="utf-8")
    assert text.count("${{") == text.count("}}"), (
        "%s: %d opening expressions against %d closes"
        % (path.name, text.count("${{"), text.count("}}"))
    )


@pytest.mark.skipif(yaml is None, reason="PyYAML not installed")
@pytest.mark.parametrize("path", WORKFLOWS, ids=lambda p: p.name)
def test_still_valid_yaml(path):
    """Necessary but NOT sufficient - see this module's docstring."""
    assert yaml.safe_load(path.read_text(encoding="utf-8")) is not None


def test_bootstrap_assigns_every_range_it_reads():
    """The second half of prompt 46's defect: the nhl|nba branch referenced $NHL_FROM and friends
    while nothing assigned them, so the loop would have reported "no date range given" and loaded
    nothing even once the file parsed."""
    text = (ROOT / ".github" / "workflows" / "bootstrap_season.yml").read_text(encoding="utf-8")
    for var in ("NHL_FROM", "NHL_TO", "NBA_FROM", "NBA_TO"):
        assert re.search(r"^\s*%s=" % var, text, re.M) or ('%s="' % var) in text, (
            "%s is read but never assigned" % var
        )


def test_schedule_refresh_is_still_scheduled():
    """Prompt 46 promised this file stays byte-identical; a later run must not quietly unschedule it."""
    text = (ROOT / ".github" / "workflows" / "schedule_refresh.yml").read_text(encoding="utf-8")
    assert "schedule:" in text and "cron:" in text
