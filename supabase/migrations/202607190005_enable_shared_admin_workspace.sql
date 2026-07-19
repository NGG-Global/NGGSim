-- Shared admin workspace.
-- Every permanent authenticated facilitator may read and edit all workspace
-- simulations. owner_id remains the immutable creator/audit identity.
-- This migration changes policies and functions only; it does not modify rows.

begin;

-- Keep creator identity immutable even though updates are shared.
revoke update on table public.simulations from authenticated;
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
  version,
  published_at,
  deleted_at
) on table public.simulations to authenticated;

revoke insert, update on table public.simulation_share_links from authenticated;
grant insert (
  simulation_id,
  owner_id,
  token,
  status,
  expires_at,
  revoked_at
) on table public.simulation_share_links to authenticated;
grant update (
  status,
  expires_at,
  revoked_at
) on table public.simulation_share_links to authenticated;

-- Replace owner-only permissive policies. The restrictive anonymous-user
-- policies from migration 002 remain in force and are ANDed with these rules.
drop policy simulations_select_own on public.simulations;
drop policy simulations_update_own on public.simulations;
create policy simulations_select_shared_admin
on public.simulations
for select
to authenticated
using (
  (select auth.uid()) is not null
  and coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') <> 'true'
);
create policy simulations_update_shared_admin
on public.simulations
for update
to authenticated
using (
  (select auth.uid()) is not null
  and coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') <> 'true'
)
with check (
  (select auth.uid()) is not null
  and coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') <> 'true'
);

drop policy simulation_share_links_select_own on public.simulation_share_links;
drop policy simulation_share_links_insert_own on public.simulation_share_links;
drop policy simulation_share_links_update_own on public.simulation_share_links;
create policy simulation_share_links_select_shared_admin
on public.simulation_share_links
for select
to authenticated
using (
  (select auth.uid()) is not null
  and coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') <> 'true'
);
create policy simulation_share_links_insert_shared_admin
on public.simulation_share_links
for insert
to authenticated
with check (
  (select auth.uid()) is not null
  and coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') <> 'true'
);
create policy simulation_share_links_update_shared_admin
on public.simulation_share_links
for update
to authenticated
using (
  (select auth.uid()) is not null
  and coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') <> 'true'
)
with check (
  (select auth.uid()) is not null
  and coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') <> 'true'
);

drop policy participants_select_own on public.participants;
create policy participants_select_shared_admin
on public.participants
for select
to authenticated
using (
  (select auth.uid()) is not null
  and coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') <> 'true'
);

drop policy simulation_sessions_select_own on public.simulation_sessions;
create policy simulation_sessions_select_shared_admin
on public.simulation_sessions
for select
to authenticated
using (
  (select auth.uid()) is not null
  and coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') <> 'true'
);

drop policy simulation_reports_select_own on public.simulation_reports;
create policy simulation_reports_select_shared_admin
on public.simulation_reports
for select
to authenticated
using (
  (select auth.uid()) is not null
  and coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') <> 'true'
);

-- Recreate the atomic facilitator functions so they operate on the selected
-- simulation's creator owner_id rather than requiring actor = creator.
create or replace function public.publish_simulation(p_simulation_id uuid)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_simulation_owner_id uuid;
  v_token text;
begin
  if v_actor_id is null or coalesce(auth.jwt() ->> 'is_anonymous', 'false') = 'true' then
    raise insufficient_privilege using message = 'Facilitator authentication is required.';
  end if;

  select owner_id into v_simulation_owner_id
  from public.simulations
  where id = p_simulation_id and deleted_at is null
  for update;
  if not found then raise no_data_found using message = 'Simulation not found.'; end if;

  select token into v_token
  from public.simulation_share_links
  where simulation_id = p_simulation_id
    and owner_id = v_simulation_owner_id
    and status = 'active'
    and revoked_at is null
    and (expires_at is null or expires_at > now())
  order by created_at desc
  limit 1;

  if v_token is null then
    insert into public.simulation_share_links (simulation_id, owner_id)
    values (p_simulation_id, v_simulation_owner_id)
    returning token into v_token;
  end if;

  update public.simulations
  set status = 'published', published_at = coalesce(published_at, now()), version = version + 1
  where id = p_simulation_id;

  return jsonb_build_object('simulationId', p_simulation_id, 'token', v_token);
end;
$$;

create or replace function public.unpublish_simulation(p_simulation_id uuid)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_simulation_owner_id uuid;
begin
  if v_actor_id is null or coalesce(auth.jwt() ->> 'is_anonymous', 'false') = 'true' then
    raise insufficient_privilege using message = 'Facilitator authentication is required.';
  end if;

  select owner_id into v_simulation_owner_id
  from public.simulations
  where id = p_simulation_id and deleted_at is null
  for update;
  if not found then raise no_data_found using message = 'Simulation not found.'; end if;

  update public.simulation_share_links
  set status = 'revoked', revoked_at = now()
  where simulation_id = p_simulation_id
    and owner_id = v_simulation_owner_id
    and status = 'active'
    and revoked_at is null;

  update public.simulations
  set status = 'unpublished', version = version + 1
  where id = p_simulation_id;

  return jsonb_build_object('simulationId', p_simulation_id, 'status', 'unpublished');
end;
$$;

create or replace function public.regenerate_simulation_public_token(p_simulation_id uuid)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_simulation_owner_id uuid;
  v_token text;
begin
  if v_actor_id is null or coalesce(auth.jwt() ->> 'is_anonymous', 'false') = 'true' then
    raise insufficient_privilege using message = 'Facilitator authentication is required.';
  end if;

  select owner_id into v_simulation_owner_id
  from public.simulations
  where id = p_simulation_id and deleted_at is null
  for update;
  if not found then raise no_data_found using message = 'Simulation not found.'; end if;

  update public.simulation_share_links
  set status = 'revoked', revoked_at = now()
  where simulation_id = p_simulation_id
    and owner_id = v_simulation_owner_id
    and status = 'active'
    and revoked_at is null;

  insert into public.simulation_share_links (simulation_id, owner_id)
  values (p_simulation_id, v_simulation_owner_id)
  returning token into v_token;

  update public.simulations
  set status = 'published', published_at = coalesce(published_at, now()), version = version + 1
  where id = p_simulation_id;

  return jsonb_build_object('simulationId', p_simulation_id, 'token', v_token);
end;
$$;

create or replace function public.archive_simulation(p_simulation_id uuid)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_simulation_owner_id uuid;
begin
  if v_actor_id is null or coalesce(auth.jwt() ->> 'is_anonymous', 'false') = 'true' then
    raise insufficient_privilege using message = 'Facilitator authentication is required.';
  end if;

  select owner_id into v_simulation_owner_id
  from public.simulations
  where id = p_simulation_id and deleted_at is null
  for update;
  if not found then raise no_data_found using message = 'Simulation not found.'; end if;

  update public.simulation_share_links
  set status = 'revoked', revoked_at = now()
  where simulation_id = p_simulation_id
    and owner_id = v_simulation_owner_id
    and status = 'active'
    and revoked_at is null;

  update public.simulations
  set status = 'unpublished', deleted_at = now(), version = version + 1
  where id = p_simulation_id;

  return jsonb_build_object('simulationId', p_simulation_id, 'archived', true);
end;
$$;

comment on policy simulations_select_shared_admin on public.simulations is
  'All permanent authenticated facilitators share one admin workspace.';
comment on column public.simulations.owner_id is
  'Immutable creator identity for audit and child-row consistency; not an RLS isolation boundary.';

commit;
