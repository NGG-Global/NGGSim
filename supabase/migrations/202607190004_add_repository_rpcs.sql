-- Atomic repository operations and capability-scoped public sessions.
-- Additive only: no DROP, TRUNCATE, hard delete or rewrite of existing rows.

begin;

create extension if not exists pgcrypto with schema extensions;

alter table public.simulation_sessions
  add column if not exists conversation_state text not null default 'listening',
  add column if not exists access_token_hash text;

alter table public.simulation_sessions
  add constraint simulation_sessions_conversation_state_check
    check (conversation_state in ('listening', 'thinking', 'speaking')),
  add constraint simulation_sessions_access_token_hash_check
    check (access_token_hash is null or access_token_hash ~ '^[a-f0-9]{64}$');

comment on column public.simulation_sessions.access_token_hash is
  'SHA-256 hash of the per-session browser capability. The plaintext token is returned once and never stored.';
comment on column public.simulation_sessions.conversation_state is
  'Last persisted participant conversation UI state.';

-- Authenticated facilitator mutations use SECURITY INVOKER so the existing RLS
-- owner policies remain the authorization boundary.
create function public.publish_simulation(p_simulation_id uuid)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_owner_id uuid := auth.uid();
  v_token text;
begin
  if v_owner_id is null or coalesce(auth.jwt() ->> 'is_anonymous', 'false') = 'true' then
    raise insufficient_privilege using message = 'Facilitator authentication is required.';
  end if;

  perform 1
  from public.simulations
  where id = p_simulation_id
    and owner_id = v_owner_id
    and deleted_at is null
  for update;
  if not found then raise no_data_found using message = 'Simulation not found.'; end if;

  select token into v_token
  from public.simulation_share_links
  where simulation_id = p_simulation_id
    and owner_id = v_owner_id
    and status = 'active'
    and revoked_at is null
    and (expires_at is null or expires_at > now())
  order by created_at desc
  limit 1;

  if v_token is null then
    insert into public.simulation_share_links (simulation_id, owner_id)
    values (p_simulation_id, v_owner_id)
    returning token into v_token;
  end if;

  update public.simulations
  set status = 'published', published_at = coalesce(published_at, now()), version = version + 1
  where id = p_simulation_id and owner_id = v_owner_id;

  return jsonb_build_object('simulationId', p_simulation_id, 'token', v_token);
end;
$$;

create function public.unpublish_simulation(p_simulation_id uuid)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_owner_id uuid := auth.uid();
begin
  if v_owner_id is null or coalesce(auth.jwt() ->> 'is_anonymous', 'false') = 'true' then
    raise insufficient_privilege using message = 'Facilitator authentication is required.';
  end if;

  perform 1
  from public.simulations
  where id = p_simulation_id and owner_id = v_owner_id and deleted_at is null
  for update;
  if not found then raise no_data_found using message = 'Simulation not found.'; end if;

  update public.simulation_share_links
  set status = 'revoked', revoked_at = now()
  where simulation_id = p_simulation_id
    and owner_id = v_owner_id
    and status = 'active'
    and revoked_at is null;

  update public.simulations
  set status = 'unpublished', version = version + 1
  where id = p_simulation_id and owner_id = v_owner_id;

  return jsonb_build_object('simulationId', p_simulation_id, 'status', 'unpublished');
end;
$$;

create function public.regenerate_simulation_public_token(p_simulation_id uuid)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_owner_id uuid := auth.uid();
  v_token text;
begin
  if v_owner_id is null or coalesce(auth.jwt() ->> 'is_anonymous', 'false') = 'true' then
    raise insufficient_privilege using message = 'Facilitator authentication is required.';
  end if;

  perform 1
  from public.simulations
  where id = p_simulation_id and owner_id = v_owner_id and deleted_at is null
  for update;
  if not found then raise no_data_found using message = 'Simulation not found.'; end if;

  update public.simulation_share_links
  set status = 'revoked', revoked_at = now()
  where simulation_id = p_simulation_id
    and owner_id = v_owner_id
    and status = 'active'
    and revoked_at is null;

  insert into public.simulation_share_links (simulation_id, owner_id)
  values (p_simulation_id, v_owner_id)
  returning token into v_token;

  update public.simulations
  set status = 'published', published_at = coalesce(published_at, now()), version = version + 1
  where id = p_simulation_id and owner_id = v_owner_id;

  return jsonb_build_object('simulationId', p_simulation_id, 'token', v_token);
end;
$$;

create function public.archive_simulation(p_simulation_id uuid)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_owner_id uuid := auth.uid();
begin
  if v_owner_id is null or coalesce(auth.jwt() ->> 'is_anonymous', 'false') = 'true' then
    raise insufficient_privilege using message = 'Facilitator authentication is required.';
  end if;

  perform 1
  from public.simulations
  where id = p_simulation_id and owner_id = v_owner_id and deleted_at is null
  for update;
  if not found then raise no_data_found using message = 'Simulation not found.'; end if;

  update public.simulation_share_links
  set status = 'revoked', revoked_at = now()
  where simulation_id = p_simulation_id
    and owner_id = v_owner_id
    and status = 'active'
    and revoked_at is null;

  update public.simulations
  set status = 'unpublished', deleted_at = now(), version = version + 1
  where id = p_simulation_id and owner_id = v_owner_id;

  return jsonb_build_object('simulationId', p_simulation_id, 'archived', true);
end;
$$;

revoke execute on function public.publish_simulation(uuid) from public, anon, authenticated;
revoke execute on function public.unpublish_simulation(uuid) from public, anon, authenticated;
revoke execute on function public.regenerate_simulation_public_token(uuid) from public, anon, authenticated;
revoke execute on function public.archive_simulation(uuid) from public, anon, authenticated;
grant execute on function public.publish_simulation(uuid) to authenticated;
grant execute on function public.unpublish_simulation(uuid) to authenticated;
grant execute on function public.regenerate_simulation_public_token(uuid) to authenticated;
grant execute on function public.archive_simulation(uuid) to authenticated;

-- The helper is private and has no caller privileges. Public functions validate
-- the capability hash before using it.
create function private.public_session_json(p_session_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', session.id,
    'simulation_id', session.simulation_id,
    'status', session.status,
    'transcript', session.transcript,
    'duration_seconds', session.duration_seconds,
    'conversation_state', session.conversation_state,
    'started_at', session.started_at,
    'ended_at', session.ended_at,
    'created_at', session.created_at,
    'participant', jsonb_build_object(
      'id', participant.id,
      'simulation_id', participant.simulation_id,
      'details', participant.details,
      'created_at', participant.created_at
    ),
    'share_link', jsonb_build_object('token', share_link.token)
  )
  from public.simulation_sessions as session
  join public.participants as participant on participant.id = session.participant_id
  join public.simulation_share_links as share_link on share_link.id = session.share_link_id
  where session.id = p_session_id
  limit 1;
$$;

revoke execute on function private.public_session_json(uuid) from public, anon, authenticated;

create function public.start_public_simulation_session(
  p_public_token text,
  p_details jsonb,
  p_consent_version text
)
returns jsonb
language plpgsql
volatile
strict
security definer
set search_path = ''
as $$
declare
  v_simulation public.simulations%rowtype;
  v_share_link public.simulation_share_links%rowtype;
  v_participant_id uuid;
  v_session_id uuid;
  v_filtered_details jsonb;
  v_access_token text;
begin
  if char_length(p_public_token) not between 32 and 256
     or p_public_token !~ '^[A-Za-z0-9_-]+$'
     or jsonb_typeof(p_details) <> 'object'
     or octet_length(p_details::text) > 32768
     or char_length(p_consent_version) not between 1 and 80 then
    return null;
  end if;

  select simulation, share_link
  into v_simulation, v_share_link
  from public.simulation_share_links as share_link
  join public.simulations as simulation
    on simulation.id = share_link.simulation_id and simulation.owner_id = share_link.owner_id
  where share_link.token = p_public_token
    and share_link.status = 'active'
    and share_link.revoked_at is null
    and (share_link.expires_at is null or share_link.expires_at > now())
    and simulation.status = 'published'
    and simulation.deleted_at is null
  limit 1
  for share of simulation, share_link;

  if v_simulation.id is null then return null; end if;

  select coalesce(jsonb_object_agg(detail.key, left(detail.value, 500)), '{}'::jsonb)
  into v_filtered_details
  from jsonb_each_text(p_details) as detail
  where exists (
    select 1
    from jsonb_array_elements(v_simulation.participant_fields) as field
    where field ->> 'enabled' = 'true' and field ->> 'type' = detail.key
  );

  insert into public.participants (
    simulation_id, owner_id, details, consented_at, consent_version
  ) values (
    v_simulation.id, v_simulation.owner_id, v_filtered_details, now(), p_consent_version
  ) returning id into v_participant_id;

  v_access_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.simulation_sessions (
    simulation_id, share_link_id, participant_id, owner_id, status,
    started_at, conversation_state, access_token_hash
  ) values (
    v_simulation.id, v_share_link.id, v_participant_id, v_simulation.owner_id,
    'in_progress', now(), 'listening', encode(extensions.digest(v_access_token, 'sha256'), 'hex')
  ) returning id into v_session_id;

  return jsonb_build_object(
    'accessToken', v_access_token,
    'session', private.public_session_json(v_session_id)
  );
end;
$$;

create function public.get_public_simulation_session(p_session_id uuid, p_access_token text)
returns jsonb
language sql
stable
strict
security definer
set search_path = ''
as $$
  select private.public_session_json(session.id)
  from public.simulation_sessions as session
  where session.id = p_session_id
    and char_length(p_access_token) = 64
    and p_access_token ~ '^[a-f0-9]{64}$'
    and session.access_token_hash = encode(extensions.digest(p_access_token, 'sha256'), 'hex')
  limit 1;
$$;

create function public.update_public_simulation_session(
  p_session_id uuid,
  p_access_token text,
  p_duration_seconds integer default null,
  p_conversation_state text default null,
  p_transcript jsonb default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if char_length(p_access_token) <> 64
     or p_access_token !~ '^[a-f0-9]{64}$'
     or (p_duration_seconds is not null and p_duration_seconds not between 0 and 86400)
     or (p_conversation_state is not null and p_conversation_state not in ('listening', 'thinking', 'speaking'))
     or (p_transcript is not null and (jsonb_typeof(p_transcript) <> 'array' or octet_length(p_transcript::text) > 524288)) then
    return null;
  end if;

  update public.simulation_sessions
  set duration_seconds = coalesce(p_duration_seconds, duration_seconds),
      conversation_state = coalesce(p_conversation_state, conversation_state),
      transcript = coalesce(p_transcript, transcript)
  where id = p_session_id
    and status = 'in_progress'
    and access_token_hash = encode(extensions.digest(p_access_token, 'sha256'), 'hex');

  if not found then return null; end if;
  return private.public_session_json(p_session_id);
end;
$$;

create function public.complete_public_simulation_session(
  p_session_id uuid,
  p_access_token text,
  p_duration_seconds integer,
  p_transcript jsonb
)
returns jsonb
language plpgsql
volatile
strict
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  if char_length(p_access_token) <> 64
     or p_access_token !~ '^[a-f0-9]{64}$'
     or p_duration_seconds not between 0 and 86400
     or jsonb_typeof(p_transcript) <> 'array'
     or octet_length(p_transcript::text) > 524288 then
    return null;
  end if;

  select status into v_status
  from public.simulation_sessions
  where id = p_session_id
    and access_token_hash = encode(extensions.digest(p_access_token, 'sha256'), 'hex')
  for update;
  if v_status is null then return null; end if;
  if v_status = 'completed' then return private.public_session_json(p_session_id); end if;
  if v_status <> 'in_progress' then return null; end if;

  update public.simulation_sessions
  set status = 'completed', ended_at = now(), duration_seconds = p_duration_seconds,
      conversation_state = 'listening', transcript = p_transcript
  where id = p_session_id;

  return private.public_session_json(p_session_id);
end;
$$;

revoke execute on function public.start_public_simulation_session(text, jsonb, text) from public, anon, authenticated;
revoke execute on function public.get_public_simulation_session(uuid, text) from public, anon, authenticated;
revoke execute on function public.update_public_simulation_session(uuid, text, integer, text, jsonb) from public, anon, authenticated;
revoke execute on function public.complete_public_simulation_session(uuid, text, integer, jsonb) from public, anon, authenticated;
grant execute on function public.start_public_simulation_session(text, jsonb, text) to anon, authenticated;
grant execute on function public.get_public_simulation_session(uuid, text) to anon, authenticated;
grant execute on function public.update_public_simulation_session(uuid, text, integer, text, jsonb) to anon, authenticated;
grant execute on function public.complete_public_simulation_session(uuid, text, integer, jsonb) to anon, authenticated;

comment on function public.publish_simulation(uuid) is 'Atomically publishes an owned simulation and creates an active share link when needed.';
comment on function public.archive_simulation(uuid) is 'Soft-deletes an owned simulation and revokes its active public link atomically.';
comment on function public.start_public_simulation_session(text, jsonb, text) is 'Creates a capability-scoped participant and session after validating an active public link.';
comment on function public.get_public_simulation_session(uuid, text) is 'Returns one participant session only when its high-entropy capability is presented.';

commit;
