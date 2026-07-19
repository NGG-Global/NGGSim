-- Authenticated facilitators can access only rows they own.
-- Policies are split by operation so SELECT, INSERT, UPDATE and DELETE can be
-- reviewed independently. No policy is granted to anon.

begin;

grant select, insert, update, delete on table public.profiles to authenticated;
grant select, insert, update, delete on table public.simulations to authenticated;
grant select, insert, update, delete on table public.simulation_share_links to authenticated;
grant select, insert, update, delete on table public.participants to authenticated;
grant select, insert, update, delete on table public.simulation_sessions to authenticated;
grant select, insert, update, delete on table public.simulation_reports to authenticated;

-- Supabase Anonymous Auth users also assume the authenticated Postgres role.
-- These restrictive policies keep the facilitator API invitation-only even if
-- anonymous sign-in is enabled accidentally. They are ANDed with the owner
-- policies below and apply to every operation.
create policy profiles_reject_anonymous_auth
on public.profiles
as restrictive
for all
to authenticated
using (coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') <> 'true')
with check (coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') <> 'true');

create policy simulations_reject_anonymous_auth
on public.simulations
as restrictive
for all
to authenticated
using (coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') <> 'true')
with check (coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') <> 'true');

create policy simulation_share_links_reject_anonymous_auth
on public.simulation_share_links
as restrictive
for all
to authenticated
using (coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') <> 'true')
with check (coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') <> 'true');

create policy participants_reject_anonymous_auth
on public.participants
as restrictive
for all
to authenticated
using (coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') <> 'true')
with check (coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') <> 'true');

create policy simulation_sessions_reject_anonymous_auth
on public.simulation_sessions
as restrictive
for all
to authenticated
using (coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') <> 'true')
with check (coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') <> 'true');

create policy simulation_reports_reject_anonymous_auth
on public.simulation_reports
as restrictive
for all
to authenticated
using (coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') <> 'true')
with check (coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') <> 'true');

-- profiles: the primary key is the owner identity.
create policy profiles_select_own
on public.profiles
for select
to authenticated
using ((select auth.uid()) is not null and id = (select auth.uid()));

create policy profiles_insert_own
on public.profiles
for insert
to authenticated
with check ((select auth.uid()) is not null and id = (select auth.uid()));

create policy profiles_update_own
on public.profiles
for update
to authenticated
using ((select auth.uid()) is not null and id = (select auth.uid()))
with check ((select auth.uid()) is not null and id = (select auth.uid()));

create policy profiles_delete_own
on public.profiles
for delete
to authenticated
using ((select auth.uid()) is not null and id = (select auth.uid()));

-- simulations: full private definitions remain visible only to their owner.
create policy simulations_select_own
on public.simulations
for select
to authenticated
using ((select auth.uid()) is not null and owner_id = (select auth.uid()));

create policy simulations_insert_own
on public.simulations
for insert
to authenticated
with check ((select auth.uid()) is not null and owner_id = (select auth.uid()));

create policy simulations_update_own
on public.simulations
for update
to authenticated
using ((select auth.uid()) is not null and owner_id = (select auth.uid()))
with check ((select auth.uid()) is not null and owner_id = (select auth.uid()));

create policy simulations_delete_own
on public.simulations
for delete
to authenticated
using ((select auth.uid()) is not null and owner_id = (select auth.uid()));

-- share links: owner_id is also constrained to the simulation owner by a
-- composite foreign key from the first migration.
create policy simulation_share_links_select_own
on public.simulation_share_links
for select
to authenticated
using ((select auth.uid()) is not null and owner_id = (select auth.uid()));

create policy simulation_share_links_insert_own
on public.simulation_share_links
for insert
to authenticated
with check ((select auth.uid()) is not null and owner_id = (select auth.uid()));

create policy simulation_share_links_update_own
on public.simulation_share_links
for update
to authenticated
using ((select auth.uid()) is not null and owner_id = (select auth.uid()))
with check ((select auth.uid()) is not null and owner_id = (select auth.uid()));

create policy simulation_share_links_delete_own
on public.simulation_share_links
for delete
to authenticated
using ((select auth.uid()) is not null and owner_id = (select auth.uid()));

-- participants contain PII and are never accessible directly to anon.
create policy participants_select_own
on public.participants
for select
to authenticated
using ((select auth.uid()) is not null and owner_id = (select auth.uid()));

create policy participants_insert_own
on public.participants
for insert
to authenticated
with check ((select auth.uid()) is not null and owner_id = (select auth.uid()));

create policy participants_update_own
on public.participants
for update
to authenticated
using ((select auth.uid()) is not null and owner_id = (select auth.uid()))
with check ((select auth.uid()) is not null and owner_id = (select auth.uid()));

create policy participants_delete_own
on public.participants
for delete
to authenticated
using ((select auth.uid()) is not null and owner_id = (select auth.uid()));

-- sessions contain provider identifiers and transcripts.
create policy simulation_sessions_select_own
on public.simulation_sessions
for select
to authenticated
using ((select auth.uid()) is not null and owner_id = (select auth.uid()));

create policy simulation_sessions_insert_own
on public.simulation_sessions
for insert
to authenticated
with check ((select auth.uid()) is not null and owner_id = (select auth.uid()));

create policy simulation_sessions_update_own
on public.simulation_sessions
for update
to authenticated
using ((select auth.uid()) is not null and owner_id = (select auth.uid()))
with check ((select auth.uid()) is not null and owner_id = (select auth.uid()));

create policy simulation_sessions_delete_own
on public.simulation_sessions
for delete
to authenticated
using ((select auth.uid()) is not null and owner_id = (select auth.uid()));

-- reports and learning metrics remain facilitator-only.
create policy simulation_reports_select_own
on public.simulation_reports
for select
to authenticated
using ((select auth.uid()) is not null and owner_id = (select auth.uid()));

create policy simulation_reports_insert_own
on public.simulation_reports
for insert
to authenticated
with check ((select auth.uid()) is not null and owner_id = (select auth.uid()));

create policy simulation_reports_update_own
on public.simulation_reports
for update
to authenticated
using ((select auth.uid()) is not null and owner_id = (select auth.uid()))
with check ((select auth.uid()) is not null and owner_id = (select auth.uid()));

create policy simulation_reports_delete_own
on public.simulation_reports
for delete
to authenticated
using ((select auth.uid()) is not null and owner_id = (select auth.uid()));

commit;
