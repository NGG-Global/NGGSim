-- Ensure the shared admin workspace is in force.
--
-- Every permanent (non-anonymous) authenticated facilitator can READ every
-- simulation and all of its data — share links, participants, sessions and
-- reports — and EDIT any simulation. owner_id stays the immutable creator
-- identity. The public participant flow is unaffected: it runs through
-- SECURITY DEFINER RPCs for anonymous users and touches none of these policies.
--
-- This restates migration 202607190005 idempotently, so it is safe to run once
-- on any project regardless of whether 005 was already applied. The restrictive
-- "reject anonymous auth" policies from migration 002 remain and are ANDed in,
-- so anonymous sign-ins still cannot reach the facilitator tables.

begin;

-- Retire the owner-only read/write policies (migration 002) if still present.
drop policy if exists simulations_select_own on public.simulations;
drop policy if exists simulations_update_own on public.simulations;
drop policy if exists simulation_share_links_select_own on public.simulation_share_links;
drop policy if exists simulation_share_links_insert_own on public.simulation_share_links;
drop policy if exists simulation_share_links_update_own on public.simulation_share_links;
drop policy if exists participants_select_own on public.participants;
drop policy if exists simulation_sessions_select_own on public.simulation_sessions;
drop policy if exists simulation_reports_select_own on public.simulation_reports;

-- Recreate the shared policies from a clean slate.
drop policy if exists simulations_select_shared_admin on public.simulations;
drop policy if exists simulations_update_shared_admin on public.simulations;
drop policy if exists simulation_share_links_select_shared_admin on public.simulation_share_links;
drop policy if exists simulation_share_links_insert_shared_admin on public.simulation_share_links;
drop policy if exists simulation_share_links_update_shared_admin on public.simulation_share_links;
drop policy if exists participants_select_shared_admin on public.participants;
drop policy if exists simulation_sessions_select_shared_admin on public.simulation_sessions;
drop policy if exists simulation_reports_select_shared_admin on public.simulation_reports;

create policy simulations_select_shared_admin on public.simulations
  for select to authenticated
  using ((select auth.uid()) is not null and coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') <> 'true');
create policy simulations_update_shared_admin on public.simulations
  for update to authenticated
  using ((select auth.uid()) is not null and coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') <> 'true')
  with check ((select auth.uid()) is not null and coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') <> 'true');

create policy simulation_share_links_select_shared_admin on public.simulation_share_links
  for select to authenticated
  using ((select auth.uid()) is not null and coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') <> 'true');
create policy simulation_share_links_insert_shared_admin on public.simulation_share_links
  for insert to authenticated
  with check ((select auth.uid()) is not null and coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') <> 'true');
create policy simulation_share_links_update_shared_admin on public.simulation_share_links
  for update to authenticated
  using ((select auth.uid()) is not null and coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') <> 'true')
  with check ((select auth.uid()) is not null and coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') <> 'true');

create policy participants_select_shared_admin on public.participants
  for select to authenticated
  using ((select auth.uid()) is not null and coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') <> 'true');

create policy simulation_sessions_select_shared_admin on public.simulation_sessions
  for select to authenticated
  using ((select auth.uid()) is not null and coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') <> 'true');

create policy simulation_reports_select_shared_admin on public.simulation_reports
  for select to authenticated
  using ((select auth.uid()) is not null and coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') <> 'true');

-- Facilitators edit shared simulations, but owner_id / created_at stay creator-owned.
-- (Column-level UPDATE grant; idempotent. Includes analysis_criteria.)
grant update (
  status,
  title,
  organization,
  scenario,
  character,
  behavior,
  participant_brief,
  participant_fields,
  facilitator_configuration,
  learning_objectives,
  analysis_criteria,
  version,
  published_at,
  deleted_at
) on public.simulations to authenticated;

commit;
