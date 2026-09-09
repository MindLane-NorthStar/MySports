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


def test_schedule_refresh_conditions_logos_before_pushing():
    """The nightly push must build dark variants, not just upload whatever was fetched.

    RULE 28: this parses the YAML and walks to the STEP, rather than asserting the flag appears
    somewhere in the file. A substring test would pass if `--make-dark` were sitting in a comment,
    in a different job, or on the `--push-data` archive step at the bottom - none of which would
    condition a single logo. What has to be true is that the step whose name says it pushes logos is
    the step that carries the flag.

    WHY IT MATTERS ENOUGH TO PIN. `fetch_logos` writes only `{id}.png`. A listings card floats the
    logo on charcoal and reads `{id}_dark.png`, so without this step the runner pushes base art and
    the provider's own dark file - which for 449 of 766 teams, measured 2026-09-07, is a byte copy
    of the base. Dropping the flag would not fail any other gate; it would just quietly put dark
    logos back on a dark panel.
    """
    doc = yaml.safe_load((ROOT / ".github" / "workflows" / "schedule_refresh.yml").read_text(encoding="utf-8"))
    steps = doc["jobs"]["refresh"]["steps"]
    pushes = [s for s in steps if "logos" in str(s.get("name", "")).lower()]
    assert len(pushes) == 1, f"expected exactly one logo push step, found {len(pushes)}"
    run = pushes[0]["run"]
    assert "sync_assets.py --push --prefix logos/" in run
    assert "--make-dark" in run, "the logo push step must condition dark variants on the runner"


def test_cfbd_teams_fetch_is_not_restricted_to_the_week():
    """The other half of the same defect, and the half no workflow file can show.

    `adapters/cfbd.py` used to pass a `needed` set built from the current fixture, so `--teams`
    fetched art only for teams playing that week. The workflow calls `--teams` every night, so the
    two together meant a team's logo arrived the night its game loaded and not before. Pinned here
    rather than in a Python unit test because the WORKFLOW is what makes it a nightly promise.
    """
    text = (ROOT / "adapters" / "cfbd.py").read_text(encoding="utf-8")
    assert "fetch_logos(teams, root / \"assets\" / \"logos\")" in text, (
        "the CFBD --teams path must fetch every team, not a fixture subset"
    )
    assert 'for s in ("home", "away")}' not in text.split("if args.teams")[1], (
        "a fixture-derived `needed` set is back on the --teams path"
    )


def test_watch_link_check_reports_and_never_fails_the_run():
    """Joe's ruling, 2026-09-09: the nightly WATCH check must not fail the workflow.

    `WATCH` is 34 hand-maintained URLs at 34 external hosts, and those hosts will have transient
    failures that have nothing to do with this repo. A nightly job that goes red for somebody
    else's outage gets IGNORED — which is exactly how `guardians-tv` sat on a hard 404 until Joe
    tapped it. Two independent guards, both asserted here because either alone can be removed by
    someone who does not know the ruling.
    """
    doc = yaml.safe_load((ROOT / ".github" / "workflows" / "schedule_refresh.yml").read_text(encoding="utf-8"))
    steps = doc["jobs"]["refresh"]["steps"]
    watch = [s for s in steps if "Watch links" in str(s.get("name", ""))]
    assert len(watch) == 1, "exactly one watch-link step"
    assert watch[0].get("continue-on-error") is True, (
        "the step must not fail the run - Joe's ruling, and the reason the dead link survived"
    )
    assert "watch-links.mjs" in watch[0]["run"]

    # AND THE SCRIPT ITSELF EXITS 0 WHATEVER IT FINDS. `continue-on-error` alone would leave a red
    # X on the step, which is the thing that trains a reader to stop looking.
    script = (ROOT / "web" / "scripts" / "probes" / "watch-links.mjs").read_text(encoding="utf-8")
    assert "process.exit(0)" in script
    assert "process.exit(1)" not in script, "this reports, it does not gate"

    # AND IT IS SURFACED WHERE IT WILL BE SEEN - the run summary page, not a log nobody opens.
    assert "GITHUB_STEP_SUMMARY" in script
