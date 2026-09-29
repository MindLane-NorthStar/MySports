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


def _schedule_refresh():
    doc = yaml.safe_load((ROOT / ".github" / "workflows" / "schedule_refresh.yml").read_text(encoding="utf-8"))
    # PyYAML reads the bare key `on` as the boolean True (YAML 1.1); GitHub reads it as "on".
    return doc, doc.get("on", doc.get(True))


def test_schedule_refresh_has_one_backstop_cron():
    """JOE'S RULING 2026-09-29 (prompt 125, register §69): the Worker's 4 a.m. dispatch is the primary
    trigger and ONE cron, 11:37 UTC, is the backstop. The 07:37 run was removed for load on the
    providers and noise in the run list - Actions is free on this public repo, so not for cost.
    Walked by the parsed `on:` block, not by substring, so a cron left in a comment cannot pass."""
    _doc, on = _schedule_refresh()
    assert [c["cron"] for c in on["schedule"]] == ["37 11 * * *"]


def test_schedule_refresh_publishes_no_artifact():
    """JOE'S RULING 2026-09-29 (prompt 125; queue item 17 closed): the `validation-*` artifact is gone.
    Since the repo went public any signed-in GitHub user could download it, and it carried the raw
    provider payloads. Every job is walked, so an upload added to a different job fails too."""
    doc, _on = _schedule_refresh()
    for name, job in doc["jobs"].items():
        for step in job.get("steps") or []:
            assert "upload-artifact" not in str(step.get("uses", "")), f"{name}: {step}"


def _archive_steps():
    doc, _on = _schedule_refresh()
    steps = doc["jobs"]["refresh"]["steps"]
    return steps, [i for i, s in enumerate(steps) if "--push-data artifacts/validation" in str(s.get("run", ""))]


def test_a_failed_run_archives_privately_under_its_own_prefix():
    """JOE'S RULING 2026-09-29 (prompt 125): a failed run's payloads go to the PRIVATE bucket, under
    `fixtures/<UTC date>/failed-<run id>/`. The `if` covers failure AND cancellation. The prefix is
    separate so the step only ever creates keys: a failed run can never overwrite a good run's archive
    for the same day (stop-list S7). It sits directly after the success-path step it complements."""
    steps, idx = _archive_steps()
    failed = [i for i in idx if "failed-" in steps[i]["run"]]
    assert len(failed) == 1, f"exactly one failure-path archive step, found {len(failed)}"
    step = steps[failed[0]]
    cond = str(step.get("if", "")).replace(" ", "")
    assert cond == "failure()||cancelled()", f"the step runs on failure or cancellation, got {step.get('if')!r}"
    run = step["run"]
    assert '--prefix "fixtures/$(date -u +%Y-%m-%d)/failed-$GITHUB_RUN_ID/"' in run, run
    assert "${{" not in run, "the run id is the runner's GITHUB_RUN_ID, not an expression in `run` (rule 28)"
    success = [i for i in idx if "failed-" not in steps[i]["run"]]
    assert success and failed[0] == success[0] + 1, "directly after the success-path archive step"


def test_the_success_path_archive_step_is_unchanged():
    """Prompt 125 left the success path exactly as it was: same name, same command, same prefix,
    and no `if` - so it still runs only when every step before it succeeded."""
    steps, idx = _archive_steps()
    success = [steps[i] for i in idx if "failed-" not in steps[i]["run"]]
    assert success == [{
        "name": "Archive fixtures + raw payloads (private bucket)",
        "run": "python scripts/sync_assets.py --push-data artifacts/validation --prefix fixtures/$(date -u +%Y-%m-%d)/",
    }]


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


def test_nfl_refresh_covers_every_game_day_not_only_sunday():
    """The nightly NFL step fetches a rolling window of dates, and the Sunday-only selector is gone.

    PROMPT 88, Joe's ruling 2026-09-10. The step fetched two dates - yesterday and the coming Sunday,
    `t + timedelta((6 - t.weekday()) % 7)` - and `adapters/espn.py --date` holds ONLY that day's games
    (`espn.py:177`). So every NFL game not on a Sunday was in neither fetch on the day it was played.
    Now it is the NBA/MLB loop: yesterday for the finals, then today and the next six days.

    RULE 28: parse the YAML and walk to the STEP. A substring test would pass with the loop sitting in
    a comment, or with the old two-date form still in the `run` and the loop merely added beside it -
    which is why the second assertion is about the selector being GONE, not the loop being present.

    WHY IT MATTERS ENOUGH TO PIN. The hole drops two game days a week - Thursday and Monday, and
    Saturdays in December - for an entire season, and FAILS NO OTHER GATE: the games still render,
    from whatever kickoff and status the last full load wrote, and no score is stored while they are
    on. It was found by counting stored links on 2026-09-10 (`nfl-401872657` Thu, `nfl-401872931`
    Mon), not by anything that went red.
    """
    doc = yaml.safe_load((ROOT / ".github" / "workflows" / "schedule_refresh.yml").read_text(encoding="utf-8"))
    steps = doc["jobs"]["refresh"]["steps"]
    nfl = [s for s in steps if str(s.get("name", "")).startswith("NFL") and "--date" in str(s.get("run", ""))]
    assert len(nfl) == 1, f"expected exactly one NFL date-driven step, found {len(nfl)}"
    run = nfl[0]["run"]
    assert "for i in -1 0 1 2 3 4 5 6" in run, "yesterday for the finals, then today and six days on"
    assert "--league nfl" in run and "--no-logos" in run
    assert "(6-t.weekday())" not in run, "the Sunday-only selector must be gone, not merely supplemented"

    # AND THE ART THE LOOP SUPPRESSES IS REFRESHED ONCE, BEFORE THE R2 PUSH. NFL is the only league
    # whose logos this adapter writes (`espn.py:290-292`); `--no-logos` on every date would otherwise
    # stop NFL art refreshing at all - a behaviour change riding along with a scheduling fix.
    names = [str(s.get("name", "")) for s in steps]
    art = [i for i, s in enumerate(steps) if "--league nfl --teams-only" in str(s.get("run", ""))]
    assert len(art) == 1, "exactly one NFL teams-only step"
    push = next(i for i, n in enumerate(names) if n.startswith("Push new logos to R2"))
    assert art[0] < push, "the art is fetched before it is pushed"
    assert "--no-logos" not in steps[art[0]]["run"], "the teams-only step is the one that fetches logos"


def test_nfl_listings_step_feeds_the_nfl_step_and_can_never_fail_the_run():
    """PROMPT 117, Joe's ruling 2026-09-23: a CBS/FOX Sunday-afternoon row is decided by what WOIO and
    WJW actually air, read from Schedules Direct by `adapters/sd_listings.py` into one JSON file the NFL
    step reads through MYSPORTS_NFL_LISTINGS. Walked by STEP (rule 28), not by substring.

    What is pinned: the listings step runs BEFORE the NFL date step; both name the same file through
    the same env var; the file lives in the runner's temp dir and nowhere the run archives or commits;
    the three secrets are job env, from `secrets.*`, by name only; no `${{` inside the `run` (rule 28's
    own defect); and the step is `python -m adapters.sd_listings --out ...`, whose contract is one log
    line, no file and exit 0 on every failure - so the step needs no `continue-on-error`, and adding one
    would hide a real crash in the module rather than a listings failure.
    """
    doc = yaml.safe_load((ROOT / ".github" / "workflows" / "schedule_refresh.yml").read_text(encoding="utf-8"))
    job = doc["jobs"]["refresh"]
    steps = job["steps"]
    for name in ("SD_USERNAME", "SD_PASSWORD", "SD_POSTAL_CODE"):
        assert job["env"].get(name) == "${{ secrets." + name + " }}", f"{name} is job env from the secret of the same name"
    listings = [i for i, s in enumerate(steps) if "adapters.sd_listings" in str(s.get("run", ""))]
    assert len(listings) == 1, "exactly one listings step"
    nfl = [i for i, s in enumerate(steps) if str(s.get("name", "")).startswith("NFL") and "--date" in str(s.get("run", ""))]
    assert len(nfl) == 1
    assert listings[0] < nfl[0], "the listings are fetched before the NFL step that reads them"
    lst, nfl_step = steps[listings[0]], steps[nfl[0]]
    path = lst.get("env", {}).get("MYSPORTS_NFL_LISTINGS")
    assert path and path.startswith("${{ runner.temp }}/"), "the file lives in the runner's temp dir"
    assert nfl_step.get("env", {}).get("MYSPORTS_NFL_LISTINGS") == path, "the NFL step reads the same file"
    assert "${{" not in lst["run"], "no Actions expression inside run (rule 28)"
    assert '--out "$MYSPORTS_NFL_LISTINGS"' in lst["run"]
    assert "continue-on-error" not in lst, "exit 0 on failure is the module's contract, not the workflow's"


def test_nfl_windows_step_feeds_the_nfl_step_and_the_listings_step_says_it_is_dormant():
    """PROMPT 118, Joe's ruling 2026-09-23: no paid data. EntitledSports' coverage page is the source
    (`adapters/es_windows.py`), read by the NFL step through MYSPORTS_NFL_WINDOWS; the Schedules Direct
    step stays, named dormant, and its behaviour is unchanged. Walked by STEP (rule 28).

    Pinned: the windows step runs before the NFL step and after the listings step (the order the rules
    consult them in, so a reader sees the precedence in the file); both name the same temp-dir file;
    no secret is added for it; no `${{` inside its `run`; no `continue-on-error`, because exit 0 on
    failure is the module's contract.
    """
    doc = yaml.safe_load((ROOT / ".github" / "workflows" / "schedule_refresh.yml").read_text(encoding="utf-8"))
    job = doc["jobs"]["refresh"]
    steps = job["steps"]
    windows = [i for i, s in enumerate(steps) if "adapters.es_windows" in str(s.get("run", ""))]
    listings = [i for i, s in enumerate(steps) if "adapters.sd_listings" in str(s.get("run", ""))]
    nfl = [i for i, s in enumerate(steps) if str(s.get("name", "")).startswith("NFL") and "--date" in str(s.get("run", ""))]
    assert len(windows) == 1 and len(listings) == 1 and len(nfl) == 1
    assert listings[0] < windows[0] < nfl[0], "listings, then windows, then the NFL step that reads both"
    win, nfl_step = steps[windows[0]], steps[nfl[0]]
    path = win.get("env", {}).get("MYSPORTS_NFL_WINDOWS")
    assert path and path.startswith("${{ runner.temp }}/"), "the file lives in the runner's temp dir"
    assert nfl_step.get("env", {}).get("MYSPORTS_NFL_WINDOWS") == path, "the NFL step reads the same file"
    assert "${{" not in win["run"], "no Actions expression inside run (rule 28)"
    assert '--out "$MYSPORTS_NFL_WINDOWS"' in win["run"]
    assert "continue-on-error" not in win
    assert not any(k.startswith("ES_") or "ENTITLED" in k for k in job["env"]), "no secret for the free source"
    assert "dormant" in str(steps[listings[0]].get("name", "")).lower(), "the Schedules Direct step says it is dormant"


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
