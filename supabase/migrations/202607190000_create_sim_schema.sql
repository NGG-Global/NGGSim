-- App schema in the shared NGG Supabase project.
-- The NGG apps (simulations, boards, quiz, auction) share one Supabase project.
-- Each app keeps its tables, functions and policies in a schema of its own so
-- their names never collide: this app uses `sim` for everything the Data API
-- serves and `sim_private` for internal helpers that it must not serve.
--
-- The grants mirror what Supabase gives the `public` schema: the API roles may
-- use the schema and receive the default privileges on new objects. The later
-- migrations revoke and re-grant exactly as they did when the app had a project
-- of its own, so the effective privileges are unchanged.
--
-- Run before 202607190001. `sim` must also be listed under Project Settings ->
-- Data API -> Exposed schemas (never `sim_private`), or the API answers every
-- request with "Invalid schema: sim".

begin;

create schema if not exists sim;

grant usage on schema sim to anon, authenticated, service_role;

alter default privileges in schema sim grant all on tables to anon, authenticated, service_role;
alter default privileges in schema sim grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema sim grant all on functions to anon, authenticated, service_role;

commit;
