# MySports — Deployment Contract (v1.0)

**Status:** decided by Joe on 2026-09-01 (option A of the deployment-inventory memo); this document closes spec §20.5 and supersedes spec §14 ("final provider selection remains open") and the "do not stage assets" rule from Phase 3. Changes after v1.0 are logged in §12.

**One-line summary:** Postgres = a `mysports` schema inside the existing Supabase project **BudgetBuddy** (JL Personal, Free plan); object storage = Cloudflare R2 buckets **`mysports-assets`** (public read) and **`mysports-data`** (private); web = Vercel (team MindLane-NorthStar, project created at Milestone 4); scheduled work = GitHub Actions. Total recurring cost: **$0**.

---

## 1. Decisions and rationale

| # | Decision | Why |
|---|---|---|
| D1 | Postgres provider is Supabase, **project `ztnppejmdwmhqstqsfks` (BudgetBuddy), region us-east-2, Postgres 17** | Joe's Free-plan quota is two active projects and both are used; a Pro upgrade ($25/mo) was rejected. Postgres schemas give MySports an isolated namespace inside an existing project at no cost. The spec's §7 DDL is Postgres and is unchanged. |
| D2 | All MySports objects live in schema **`mysports`**; nothing is created in `public` | Blast-radius control for BudgetBuddy (36 tables in `public`). Every migration sets `search_path = mysports` and is named `mysports_NNNN_*`. |
| D3 | Two dedicated roles: **`mysports_owner`** (NOLOGIN, owns the schema and every object) and **`mysports_writer`** (LOGIN, member of `mysports_owner`, used by the refresh job) | Verified 2026-09-01 after the migration: `mysports_writer` cannot SELECT, INSERT, UPDATE, or DELETE any of the 36 BudgetBuddy tables, cannot CREATE in `public`, and has no USAGE on `auth` or `storage` (it keeps the Postgres-default USAGE on `public`, which only exposes object names). A bug in the refresh job cannot reach BudgetBuddy's data. Table owners bypass RLS, so the writer needs no policies. |
| D4 | The web app reads through Supabase's Data API with the **publishable (anon) key**, schema `mysports` exposed, **RLS on every table with a read-only `anon` policy** | No user accounts in v1 (spec decision 1, market-of-one). No server secret ships to Vercel. |
| D5 | Object storage is **Cloudflare R2**: bucket **`mysports-assets`** with public read (r2.dev URL in v1, custom domain later) for logos, marks, fonts, and grids; bucket **`mysports-data`**, private, for fixtures, raw snapshots, and backups. R2 public access is a per-bucket switch, so private material needs its own bucket | R2 is enabled on Joe's account (2026-09-01); free tier is 10 GB / 10 M class-B reads per month, no egress fees. Current asset set: 22 MB logos + 0.3 MB network marks + 1.5 MB fonts. |
| D6 | Source of truth for assets is the bucket; the local `assets/` folder is a **cache** synced by `scripts/sync_assets.py`; `assets/` stays git-ignored | Retires the Phase 3 "do not stage assets" rule by giving assets a home instead of a git exception. |
| D7 | Scheduled work runs on **GitHub Actions** in the private repo (2,000 free minutes/month; a refresh run is ~3 minutes) | Spec §15.1. The runner has network to every league API and to Supabase/R2; nothing depends on Joe's laptop or on Cowork's allowlist. |
| D8 | Vercel project **`mysports`** linked to `MindLane-NorthStar/MySports`, **created at Milestone 4** (first Next.js commit), not now | There is nothing to deploy yet; a project linked today would fail every push. |
| D9 | Backups: weekly `pg_dump --schema=mysports` to `mysports-data/backups/` by a GitHub Action, 8 weeks retained | The Free plan has no automated database backups. Everything in `mysports` is also re-derivable from the providers plus `source_snapshots`, so this is belt-and-braces, not the only recovery path. |
| D10 | Migration tooling: SQL files in the repo under `db/migrations/NNNN_name.sql` are the source of truth; applied to Supabase by Cowork (`apply_migration`, connector) or Claude Code (`psql`); the Supabase migration history records the same names | The repo stays authoritative and reviewable; Supabase's history is the applied-state ledger. |

---

## 2. Database layout

```
project  ztnppejmdwmhqstqsfks   (BudgetBuddy · JL Personal · Free · us-east-2 · PG 17.6)
schema   mysports               owner: mysports_owner
roles    mysports_owner         NOLOGIN · owns schema + all objects
         mysports_writer        LOGIN · IN ROLE mysports_owner · password set by Joe (§7) · used by GitHub Actions
         anon / authenticated   Supabase built-ins · SELECT only, via RLS policies (§2.2)
         postgres               Supabase admin · runs migrations
```

### 2.1 Bootstrap migration `mysports_0001_schema_and_roles` (this contract's only DDL)

```sql
create role mysports_owner nologin;
create role mysports_writer login nobypassrls;           -- password: ALTER ROLE ... PASSWORD, by Joe, §7
grant mysports_owner to mysports_writer;
grant mysports_owner to postgres;   -- Supabase's admin is not a superuser; membership is required to assign ownership
create schema mysports authorization mysports_owner;
revoke all on schema mysports from public;
grant usage on schema mysports to anon, authenticated;   -- read path (RLS decides rows)
alter default privileges for role mysports_owner in schema mysports
  grant select on tables to anon, authenticated;
alter default privileges for role mysports_owner in schema mysports
  grant select on sequences to anon, authenticated;
comment on schema mysports is 'MySports (deployment contract v1.0, 2026-09-01). Owner mysports_owner; writer mysports_writer. Never place MySports objects in public.';
```

Milestone 1's DDL (spec §7, 22 tables) is applied as `mysports_0002_*` onward, executed as `postgres` with `set role mysports_owner` so ownership lands on the owner role, and `alter table ... enable row level security` + `create policy anon_read ... for select to anon using (true)` on every table.

### 2.2 Data API

- Joe adds `mysports` to **Project Settings → Data API → Exposed schemas** (§7). The publishable key then reads `mysports.*` subject to RLS.
- Write traffic never goes through the Data API; the refresh job connects as `mysports_writer` through the shared pooler in session mode (host from the Connect dialog, port 5432, username `mysports_writer.ztnppejmdwmhqstqsfks`, SSL required). Direct `db.*.supabase.co` connections are IPv6-only on the Free plan and unreachable from GitHub Actions.

### 2.3 Quotas shared with BudgetBuddy (monitor, do not exceed)

| Quota (Free) | Today | MySports expected |
|---|---|---|
| Database size 500 MB | 15 MB | 30–60 MB after a full multi-sport season (observations dominate) |
| Egress 5 GB/month | small | grid SVGs are served from R2, not the database; API reads are row-level JSON — well under 1 GB |
| Pausing after 7 idle days | BudgetBuddy is used daily | the refresh job also writes 3×/week |

---

## 3. Object storage layout

```
mysports-assets  (public read)
logos/{cfbdId}.png                 CFB team marks (CFBD integer ids — unchanged from Phase 3)
logos/{sport}-{id}.png             pro marks: nhl-{nhlId}, nfl-{espnId}, nba-{…}, mlb-{…}
network-logos/{slug}.png|.svg      network marks + vector wordmarks (27 files)
fonts/*.ttf                        Barlow Condensed (Bold, SemiBold), Inter (Regular, SemiBold, Bold)
grids/{sport}/{YYYY-MM-DD}.svg     canonical render (spec §11, contract §11)
grids/{sport}/{YYYY-MM-DD}.png     1× raster; @2x.png = download raster (contract §8)
grids/multi/{YYYY-MM-DD}.svg       multi-sport day (contract v1.6+)

mysports-data  (private)
fixtures/{sport}/{season}/...      adapter outputs (the artifacts/validation/ files), for audit
snapshots/{provider}/{date}/...    raw provider payloads (spec §7.15 source_snapshots)
backups/mysports_{YYYY-MM-DD}.sql.gz   weekly schema dump (D9)
```

Rules: object keys are lowercase; PNG logos are the ESPN/CFBD 500 px originals (the renderer thumbnails in memory); `content_hash` in `mysports.assets` (spec §7.14) is the SHA-256 of the object. `mysports-assets` has public access enabled (Cloudflare Dashboard → bucket → Settings → Public access, r2.dev subdomain); `mysports-data` never does — the job reads and writes it through the S3 API with the token in §4.

`ASSET_BASE_URL` = the bucket's public URL (r2.dev in v1). The renderer resolves `--logos`/`--network-logos` to the local cache first, then `ASSET_BASE_URL`, so it runs identically on a laptop, in Cowork, and in Actions.

---

## 4. Environment-variable contract

| Variable | Holds | Where it lives | Who sets it |
|---|---|---|---|
| `CFBD_API_KEY` | CollegeFootballData bearer token | laptop `.env`; GitHub Actions secret | Joe |
| `SUPABASE_DB_URL` | `postgresql://mysports_writer.ztnppejmdwmhqstqsfks:<pw>@<session-pooler-host>:5432/postgres?sslmode=require` — the shared pooler in session mode; the username carries the project ref after a dot. **The host must be copied from Dashboard → Connect → Session pooler** (expected `aws-1-us-east-2.pooler.supabase.com`, confirmed in the dialog; the docs' `aws-0` example is a different cluster and answers `tenant/user not found`). (Free-plan direct connections are IPv6-only, and GitHub Actions and Vercel are IPv4-only, so the pooler is mandatory, not a preference.) | laptop `.env`; GitHub Actions secret | Joe (§7) |
| `SUPABASE_URL` | `https://ztnppejmdwmhqstqsfks.supabase.co` | `.env`; Actions; Vercel (`NEXT_PUBLIC_SUPABASE_URL`) | Cowork (public value) |
| `SUPABASE_PUBLISHABLE_KEY` | anon/publishable key | Vercel (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`); `.env` for local web dev | Joe copies from Dashboard → Project Settings → API |
| `R2_ACCOUNT_ID` | Cloudflare account id | `.env`; Actions | Joe |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | R2 API token scoped to `mysports-assets`, Object Read & Write | `.env`; Actions | Joe (§7) |
| `R2_BUCKET_ASSETS` / `R2_BUCKET_DATA` | `mysports-assets` / `mysports-data` | `.env`; Actions | Cowork |
| `ASSET_BASE_URL` | public bucket URL | `.env`; Actions; Vercel (`NEXT_PUBLIC_ASSET_BASE_URL`) | Cowork, once the bucket exists |
| `MYSPORTS_MARKET` | `cleveland` | `.env`; Actions | Cowork |

Rules: no service-role key anywhere in v1 (nothing needs it); `.env` is git-ignored, `.env.example` lists every name with empty values and is committed; the secret gate in every Claude Code commit prompt extends to `SUPABASE_DB_URL=postgresql://mysports_writer.ztnppejmdwmhqstqsfks:[A-Za-z0-9]` and `R2_SECRET_ACCESS_KEY=[A-Za-z0-9]`. Placeholders in committed files must start with a non-alphanumeric character (`<PASSWORD>`, `<pw>`) so the gate stays blunt and never needs a waiver — learned 2026-09-01 when `PASSWORD` tripped it.

---

## 5. Scheduled work (GitHub Actions, private repo)

| Workflow | Trigger | Does |
|---|---|---|
| `schedule_refresh.yml` | Mon/Wed/Fri **11:00 UTC** (07:00 EDT / 06:00 EST) + manual dispatch | runs every in-season adapter, reconciles (Milestone 2), writes `mysports.*`, records `refresh_runs` |
| `render_all.yml` | daily **09:30 UTC** in season (05:30 EDT) + after a successful refresh + manual | renders the viewing day(s), uploads `grids/` to R2, syncs the local cache |
| `bootstrap_season.yml` | manual only | Milestone 1 season load |
| `backup_schema.yml` | Sundays 12:00 UTC | `pg_dump --schema=mysports` → `backups/`, prune to 8 |

Spec §15.2 failure rules apply unchanged: never delete canonical data, never publish an empty schedule, keep last-known-good grids in R2 (the upload is atomic per file; a failed run leaves yesterday's file in place).

Budget: ~4 runs/week × ~3 min + daily renders ≈ 60–90 minutes/month against a 2,000-minute allowance.

---

## 6. Observability and backups

- `mysports.refresh_runs` (spec §16 columns) is written by every job; the web app's admin view (Milestone 4) reads it.
- GitHub Actions emails Joe on any failed run (repository default). Cowork's weekly research task reads the last `refresh_runs` row when it reports.
- Backups: D9 above. Recovery drill (once, at Milestone 1 close): restore the dump into a Neon free project and run the renderer against it.

---

## 7. Joe's steps (the only ones Claude cannot do)

1. **Set the writer password.** Supabase Dashboard → project **BudgetBuddy** → **SQL Editor** → new query → run `alter role mysports_writer password '<paste a generated 32-character password>';` → Run. Store the password in your password manager as "MySports writer".
2. **Expose the schema.** Dashboard → **Project Settings** → **Data API** → **Exposed schemas** → add `mysports` → Save.
3. **Turn on public access for the assets bucket.** Cloudflare Dashboard → **R2 Object Storage** → click **mysports-assets** → **Settings** tab → under **Public access**, find **R2.dev subdomain** → **Allow Access** → type `allow` to confirm. Copy the URL it shows (`https://pub-….r2.dev`); that is `ASSET_BASE_URL`. Leave `mysports-data` untouched.
4. **Create the R2 API token.** Cloudflare Dashboard → **R2 Object Storage** → **Manage R2 API Tokens** → **Create API token** → name `mysports-actions`, permission **Object Read & Write**, buckets **mysports-assets** and **mysports-data** only → Create → copy the Access Key ID, Secret Access Key, and the account id shown on that page.
5. **Local `.env`.** Add the five lines: `SUPABASE_DB_URL=...` (§4 pattern with the password from step 1), `R2_ACCOUNT_ID=`, `R2_ACCESS_KEY_ID=`, `R2_SECRET_ACCESS_KEY=`, `ASSET_BASE_URL=` (from step 3). `.env.example` in the repo lists every name.
6. **GitHub secrets.** github.com/MindLane-NorthStar/MySports → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**, one each: `CFBD_API_KEY`, `SUPABASE_DB_URL`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`.
7. (Milestone 4) Vercel project env vars: the three `NEXT_PUBLIC_*` values.

---

## 8. Rollback

`drop schema mysports cascade; drop role mysports_writer; drop role mysports_owner;` removes every MySports object from the BudgetBuddy project and touches nothing else. Deleting the two R2 buckets and the GitHub secrets completes the teardown. Moving to a dedicated database later (Neon free, or a Supabase project if the quota frees up) is `pg_dump --schema=mysports` + restore; no code change because every connection string is an env var.

---

## 9. What this contract does not decide

- Custom domain for assets and the site (r2.dev and vercel.app URLs in v1).
- Read replicas, PITR, compute add-ons (all paid; none needed at personal scale).
- The multi-market schema (spec §7.17 is wide enough; one `markets` row in v1).

---

## 10. Acceptance for this contract

1. ✅ 2026-09-01 07:56 ET — `mysports` schema (owner `mysports_owner`) and both roles exist in `ztnppejmdwmhqstqsfks`; `public` still holds exactly 36 base tables; isolation checks in D3 passed.
2. ✅ 2026-09-01 07:56 ET — `mysports-assets` and `mysports-data` created (ENAM, Standard). ⏳ Public access on `mysports-assets` is Joe's dashboard step (§7); then a test object `logos/nhl-29.png` is readable at `ASSET_BASE_URL/logos/nhl-29.png`.
3. `python scripts/sync_assets.py --push` uploads the 436 + 27 + 5 files; `--pull` on a clean folder restores them byte-identical.
4. `docs/deployment-contract.md`, `.env.example`, `db/migrations/0001_schema_and_roles.sql` committed and pushed.

---

## 11. Version history

- **v1.0 (2026-09-01)** — first contract; decisions D1–D10.

## 12. Change log

- **v1.0.2 (2026-09-01, ~11:15 ET):** pooler host is no longer hard-coded as `aws-0`; it is whatever Dashboard → Connect → Session pooler shows. Found when the first live load failed with Supavisor `tenant/user … not found` (role verified present via `pg_authid`).
- **v1.0.1 (2026-09-01, 09:00 ET):** `.env.example` placeholder `PASSWORD` → `<PASSWORD>` after the commit secret gate correctly fired on it (Claude Code stopped, reset, nothing pushed); §4 rule added. `.gitattributes` gains `*.yml`, `*.yaml`, `*.sql`.
- **v1.0 (2026-09-01):** applied. Migration `mysports_0001_schema_and_roles` needed one line beyond the draft — `grant mysports_owner to postgres` — because Supabase's `postgres` role is not a superuser and `create schema … authorization` requires membership (first attempt failed cleanly with 42501, nothing partially created). Buckets created via the Cloudflare connector. R2 public access is per bucket, hence the second bucket `mysports-data` for private material.
