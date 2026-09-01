-- MySports deployment contract v1.0 (docs/deployment-contract.md §2.1)
-- Applied to Supabase project ztnppejmdwmhqstqsfks on 2026-09-01 as migration `mysports_0001_schema_and_roles`.
-- Isolated namespace inside the BudgetBuddy project. Nothing MySports-related is ever created in `public`.
create role mysports_owner nologin;
create role mysports_writer login nobypassrls;           -- password set out-of-band: ALTER ROLE mysports_writer PASSWORD '...'
grant mysports_owner to mysports_writer;
grant mysports_owner to postgres;                        -- Supabase's admin is not a superuser; membership is required to assign ownership
create schema mysports authorization mysports_owner;
revoke all on schema mysports from public;
grant usage on schema mysports to anon, authenticated;   -- read path for the web app; RLS decides rows
alter default privileges for role mysports_owner in schema mysports grant select on tables to anon, authenticated;
alter default privileges for role mysports_owner in schema mysports grant select on sequences to anon, authenticated;
comment on schema mysports is 'MySports (deployment contract v1.0, 2026-09-01). Owner mysports_owner; writer mysports_writer. Never place MySports objects in public.';
