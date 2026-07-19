-- Idempotent public session creation.
-- Additive only: adds an idempotency column plus a scoped unique index and
-- replaces the session-start function with an idempotency-aware version.
-- No table is dropped, truncated or rewritten and no existing row is changed.

begin;

alter table public.simulation_sessions
  add column if not exists idempotency_key text;

alter table public.simulation_sessions
  add constraint simulation_sessions_idempotency_key_format
    check (idempotency_key is null or idempotency_key ~ '^[A-Za-z0-9_-]{8,128}$');

-- A share link scopes idempotency: one key resolves to at most one attempt.
create unique index if not exists simulation_sessions_idempotency_key_idx
  on public.simulation_sessions (share_link_id, idempotency_key)
  where idempotency_key is not null;

comment on column public.simulation_sessions.idempotency_key is
  'Client-supplied key that collapses duplicate session-start submissions for one share link into a single attempt.';

-- Replace the session-start function with a four-argument, idempotency-aware
-- version. The previous three-argument function is dropped so no ambiguous
-- overload remains. The new function is no longer STRICT, so the required
-- arguments are validated explicitly below.
drop function if exists public.start_public_simulation_session(text, jsonb, text);

create function public.start_public_simulation_session(
  p_public_token text,
  p_details jsonb,
  p_consent_version text,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
volatile
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
  if p_public_token is null
     or p_details is null
     or p_consent_version is null
     or char_length(p_public_token) not between 32 and 256
     or p_public_token !~ '^[A-Za-z0-9_-]+$'
     or jsonb_typeof(p_details) <> 'object'
     or octet_length(p_details::text) > 32768
     or char_length(p_consent_version) not between 1 and 80
     or (p_idempotency_key is not null and p_idempotency_key !~ '^[A-Za-z0-9_-]{8,128}$') then
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

  -- Idempotent replay: a repeated submission with the same key returns the
  -- original attempt with a freshly minted capability instead of creating a
  -- duplicate participant and session. The plaintext token is only ever
  -- returned once, so a lost response is recovered by rotating the hash.
  if p_idempotency_key is not null then
    select id into v_session_id
    from public.simulation_sessions
    where share_link_id = v_share_link.id
      and idempotency_key = p_idempotency_key
    limit 1;

    if v_session_id is not null then
      v_access_token := encode(extensions.gen_random_bytes(32), 'hex');
      update public.simulation_sessions
      set access_token_hash = encode(extensions.digest(v_access_token, 'sha256'), 'hex')
      where id = v_session_id;
      return jsonb_build_object(
        'accessToken', v_access_token,
        'session', private.public_session_json(v_session_id)
      );
    end if;
  end if;

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

  begin
    insert into public.simulation_sessions (
      simulation_id, share_link_id, participant_id, owner_id, status,
      started_at, conversation_state, access_token_hash, idempotency_key
    ) values (
      v_simulation.id, v_share_link.id, v_participant_id, v_simulation.owner_id,
      'in_progress', now(), 'listening',
      encode(extensions.digest(v_access_token, 'sha256'), 'hex'), p_idempotency_key
    ) returning id into v_session_id;
  exception when unique_violation then
    -- A concurrent request with the same key won the race. Reuse its session
    -- and rotate the capability so this caller still receives a usable token.
    -- The participant row inserted above is left in place; a scheduled purge,
    -- not this function, is responsible for reclaiming orphaned records.
    select id into v_session_id
    from public.simulation_sessions
    where share_link_id = v_share_link.id
      and idempotency_key = p_idempotency_key
    limit 1;
    if v_session_id is null then raise; end if;
    update public.simulation_sessions
    set access_token_hash = encode(extensions.digest(v_access_token, 'sha256'), 'hex')
    where id = v_session_id;
  end;

  return jsonb_build_object(
    'accessToken', v_access_token,
    'session', private.public_session_json(v_session_id)
  );
end;
$$;

revoke execute on function public.start_public_simulation_session(text, jsonb, text, text)
  from public, anon, authenticated;
grant execute on function public.start_public_simulation_session(text, jsonb, text, text)
  to anon, authenticated;

comment on function public.start_public_simulation_session(text, jsonb, text, text) is
  'Creates a capability-scoped participant and session after validating an active public link. An optional idempotency key collapses duplicate submissions for one share link into a single attempt.';

commit;
