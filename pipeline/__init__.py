"""MySports pipeline (Milestone 1: bootstrap + fixture load; Milestone 2 adds reconciliation).

    python -m pipeline.bootstrap            # reference data -> mysports.* (idempotent)
    python -m pipeline.load --fixture artifacts/validation/nhl_2026_2026-10-01_fixture.json
    python -m pipeline.load --all           # every *_fixture.json under artifacts/validation

Every command reads SUPABASE_DB_URL from the environment or .env (deployment contract §4) and connects as
mysports_writer through the Supavisor session pooler. `--emit-sql FILE` writes the statements instead of executing
them, which is how Cowork validates a change against the live schema without holding the credential.
"""
