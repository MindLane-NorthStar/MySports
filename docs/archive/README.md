# docs/archive — superseded specifications

**Nothing here is current. Do not build from these files.** They are kept, tracked and unedited,
because they are the record of how the project was first specified. Prompt 87 moved them out of the
repository root on 2026-09-10 (`git mv`, history intact) for one reason: a fresh session landing in
the root would find a file called `MYSPORTS_BUILD_SPEC_v0.5.md` and reasonably take it for the
authority. It is not, and has not been since 2026-09-02.

**What is current instead** is `CLAUDE.md` itself for the working rules, and its Read-first table for
the rest: `docs/handoff-status.md` for state, `docs/enhancement-register.md` for decisions, the two
rendering contracts for what the app draws, `docs/deployment-contract.md` for deploy, and `db/migrations/` as
the schema's own record (working rule 14).

| file | what it was | last changed | superseded by |
|---|---|---|---|
| `CFB_TV_GRID_AGENT_BUILD_SPEC_v0.1.md` | the first build spec — college football only, "pre-build design" | 2026-08-31 | v0.2, the same day |
| `CFB_TV_GRID_AGENT_BUILD_SPEC_v0.2.md` | v0.1 plus the source-authority architecture from the Phase 2 research | 2026-08-31 | v0.3 |
| `CFB_TV_GRID_AGENT_BUILD_SPEC_v0.3.md` | v0.2 after Phase 3A's live CFBD validation | 2026-08-31 | `MYSPORTS_BUILD_SPEC_v0.4.md` — the same spec, renamed when the multi-sport scope became normative |
| `CFB_TV_GRID_AGENT_SOURCE_AUTHORITY_v0.1.md` | the companion: how canonical schedule facts are chosen when sources disagree | 2026-08-31 | folded into v0.2 onward; the running implementation is `pipeline/resolver.py` and `pipeline/reconcile.py`, with the rules in `data/authority_rules.json` |
| `MYSPORTS_BUILD_SPEC_v0.4.md` | the multi-sport base specification (rendering contract v1.4, enrichment live) | 2026-09-01 | the living documents above; v0.5 amended it |
| `MYSPORTS_BUILD_SPEC_v0.5.md` | a DELTA over v0.4: the `programs` supertype and the Events & Shows model, from Joe's 2026-09-02 decisions | 2026-09-02 | the last spec version written. Its decisions live on in register §7–§9, `db/migrations/0009` onward and `docs/research/` |

**Two things still point here by name**, and neither needed changing: the specs cite each other,
and `db/migrations/0009_programs_supertype.sql` names `MYSPORTS_BUILD_SPEC_v0.5.md` in its header. An
applied migration is not edited for a file move; the bare name still finds the file in this
directory. The prompts in `docs/prompts/` that mention them are verbatim history and were not
touched either.
