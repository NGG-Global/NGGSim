-- Pilot schema for the voice-simulation system.
-- This migration is additive only: it creates new schemas, tables, constraints,
-- indexes and triggers. It does not drop, truncate or rewrite existing data.

begin;

-- Trigger helpers live outside the exposed public API schema.
create schema if not exists private;
comment on schema private is 'Internal database helpers that are not exposed through the Data API.';
revoke all on schema private from public, anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete restrict,
  display_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_length check (char_length(display_name) <= 120)
);

comment on table public.profiles is 'Private facilitator profile; id is the matching auth.users primary key.';
comment on column public.profiles.id is 'The facilitator identity from auth.users.id.';

create table public.simulations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete restrict,
  status text not null default 'draft',
  title text not null default '',
  organization jsonb not null default '{}'::jsonb,
  scenario jsonb not null default '{}'::jsonb,
  character jsonb not null default '{}'::jsonb,
  behavior jsonb not null default '{}'::jsonb,
  participant_brief jsonb not null default '{}'::jsonb,
  participant_fields jsonb not null default '[]'::jsonb,
  facilitator_configuration jsonb not null default '{}'::jsonb,
  learning_objectives jsonb not null default '[]'::jsonb,
  version integer not null default 1,
  published_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint simulations_status_check check (status in ('draft', 'published', 'unpublished')),
  constraint simulations_title_length check (char_length(title) <= 240),
  constraint simulations_organization_object check (jsonb_typeof(organization) = 'object'),
  constraint simulations_scenario_object check (jsonb_typeof(scenario) = 'object'),
  constraint simulations_character_object check (jsonb_typeof(character) = 'object'),
  constraint simulations_behavior_object check (jsonb_typeof(behavior) = 'object'),
  constraint simulations_participant_brief_object check (jsonb_typeof(participant_brief) = 'object'),
  constraint simulations_participant_fields_array check (jsonb_typeof(participant_fields) = 'array'),
  constraint simulations_facilitator_configuration_object check (jsonb_typeof(facilitator_configuration) = 'object'),
  constraint simulations_learning_objectives_array check (jsonb_typeof(learning_objectives) = 'array'),
  constraint simulations_version_positive check (version > 0),
  constraint simulations_published_timestamp check (status <> 'published' or published_at is not null),
  constraint simulations_id_owner_unique unique (id, owner_id)
);

comment on table public.simulations is 'Private simulation definitions, including facilitator-only prompts, hidden scenario data and evaluation configuration.';
comment on column public.simulations.owner_id is 'Facilitator who owns the simulation and is enforced by RLS.';
comment on column public.simulations.scenario is 'Full scenario JSON, including hiddenInfo; never return this object from a public endpoint.';
comment on column public.simulations.character is 'Full character JSON, including secrets and conditional information; never return this object publicly.';
comment on column public.simulations.behavior is 'Internal behavior, success and failure conditions.';
comment on column public.simulations.facilitator_configuration is 'Facilitator-only notes and agent prompts.';
comment on column public.simulations.learning_objectives is 'Internal learning objectives and metrics.';

create table public.simulation_share_links (
  id uuid primary key default gen_random_uuid(),
  simulation_id uuid not null,
  owner_id uuid not null,
  token text not null default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  status text not null default 'active',
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint simulation_share_links_simulation_owner_fk
    foreign key (simulation_id, owner_id)
    references public.simulations (id, owner_id)
    on delete restrict,
  constraint simulation_share_links_status_check check (status in ('active', 'revoked', 'expired')),
  constraint simulation_share_links_token_format
    check (char_length(token) between 32 and 256 and token ~ '^[A-Za-z0-9_-]+$'),
  constraint simulation_share_links_expiry_check check (expires_at is null or expires_at > created_at),
  constraint simulation_share_links_revocation_check check (
    (status = 'active' and revoked_at is null)
    or (status = 'revoked' and revoked_at is not null)
    or status = 'expired'
  ),
  constraint simulation_share_links_token_unique unique (token),
  constraint simulation_share_links_id_simulation_owner_unique unique (id, simulation_id, owner_id)
);

comment on table public.simulation_share_links is 'Private capability links. Public callers may use a token only through the filtered RPC.';
comment on column public.simulation_share_links.token is 'High-entropy public capability token; unique and never exposed by direct anonymous table access.';
comment on constraint simulation_share_links_token_unique on public.simulation_share_links is 'Also provides the B-tree lookup index for public token resolution.';

create table public.participants (
  id uuid primary key default gen_random_uuid(),
  simulation_id uuid not null,
  owner_id uuid not null,
  details jsonb not null default '{}'::jsonb,
  consented_at timestamptz not null,
  consent_version text not null,
  created_at timestamptz not null default now(),
  constraint participants_simulation_owner_fk
    foreign key (simulation_id, owner_id)
    references public.simulations (id, owner_id)
    on delete restrict,
  constraint participants_details_object check (jsonb_typeof(details) = 'object'),
  constraint participants_consent_version_length check (char_length(consent_version) between 1 and 80),
  constraint participants_id_simulation_owner_unique unique (id, simulation_id, owner_id)
);

comment on table public.participants is 'Private participant records containing only fields enabled for the simulation and explicit consent metadata.';
comment on column public.participants.details is 'Potential PII; collect minimally and never return through the public simulation lookup RPC.';

create table public.simulation_sessions (
  id uuid primary key default gen_random_uuid(),
  simulation_id uuid not null,
  share_link_id uuid not null,
  participant_id uuid not null,
  owner_id uuid not null,
  conversation_id text,
  provider text not null default 'elevenlabs',
  status text not null default 'created',
  transcript jsonb not null default '[]'::jsonb,
  duration_seconds integer not null default 0,
  started_at timestamptz,
  ended_at timestamptz,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint simulation_sessions_share_link_owner_fk
    foreign key (share_link_id, simulation_id, owner_id)
    references public.simulation_share_links (id, simulation_id, owner_id)
    on delete restrict,
  constraint simulation_sessions_participant_owner_fk
    foreign key (participant_id, simulation_id, owner_id)
    references public.participants (id, simulation_id, owner_id)
    on delete restrict,
  constraint simulation_sessions_status_check check (
    status in ('created', 'ready', 'in_progress', 'processing', 'completed', 'failed', 'expired')
  ),
  constraint simulation_sessions_provider_length check (char_length(provider) between 1 and 80),
  constraint simulation_sessions_conversation_id_length check (conversation_id is null or char_length(conversation_id) <= 255),
  constraint simulation_sessions_transcript_array check (jsonb_typeof(transcript) = 'array'),
  constraint simulation_sessions_duration_nonnegative check (duration_seconds >= 0),
  constraint simulation_sessions_time_order check (ended_at is null or started_at is null or ended_at >= started_at),
  constraint simulation_sessions_id_simulation_owner_unique unique (id, simulation_id, owner_id)
);

comment on table public.simulation_sessions is 'Private conversation lifecycle and transcript data for one participant attempt.';
comment on column public.simulation_sessions.conversation_id is 'Conversation identifier received from the voice provider; unique when present.';
comment on column public.simulation_sessions.transcript is 'Private transcript; it is never part of ParticipantSimulationView.';

create table public.simulation_reports (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  simulation_id uuid not null,
  owner_id uuid not null,
  summary text not null default '',
  scores jsonb not null default '{}'::jsonb,
  strengths text[] not null default '{}'::text[],
  improvements text[] not null default '{}'::text[],
  learning_metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint simulation_reports_session_owner_fk
    foreign key (session_id, simulation_id, owner_id)
    references public.simulation_sessions (id, simulation_id, owner_id)
    on delete restrict,
  constraint simulation_reports_scores_object check (jsonb_typeof(scores) = 'object'),
  constraint simulation_reports_learning_metrics_object check (jsonb_typeof(learning_metrics) = 'object'),
  constraint simulation_reports_session_unique unique (session_id)
);

comment on table public.simulation_reports is 'Private facilitator report; one report per simulation session.';
comment on column public.simulation_reports.learning_metrics is 'Internal evaluation metrics that must never be returned by the public participant lookup.';

-- Index every ownership and common lookup/filter column used by RLS or list pages.
create index simulations_owner_id_idx on public.simulations (owner_id);
create index simulations_created_at_idx on public.simulations (created_at desc);
create index simulation_share_links_owner_id_idx on public.simulation_share_links (owner_id);
create index simulation_share_links_simulation_id_idx on public.simulation_share_links (simulation_id);
create index simulation_share_links_created_at_idx on public.simulation_share_links (created_at desc);
create unique index simulation_share_links_one_active_per_simulation_idx
  on public.simulation_share_links (simulation_id)
  where status = 'active' and revoked_at is null;
create index participants_owner_id_idx on public.participants (owner_id);
create index participants_simulation_id_idx on public.participants (simulation_id);
create index participants_created_at_idx on public.participants (created_at desc);
create index simulation_sessions_owner_id_idx on public.simulation_sessions (owner_id);
create index simulation_sessions_simulation_id_idx on public.simulation_sessions (simulation_id);
create index simulation_sessions_share_link_id_idx on public.simulation_sessions (share_link_id);
create index simulation_sessions_participant_id_idx on public.simulation_sessions (participant_id);
create unique index simulation_sessions_conversation_id_idx
  on public.simulation_sessions (conversation_id)
  where conversation_id is not null;
create index simulation_sessions_created_at_idx on public.simulation_sessions (created_at desc);
create index simulation_reports_owner_id_idx on public.simulation_reports (owner_id);
create index simulation_reports_simulation_id_idx on public.simulation_reports (simulation_id);
create index simulation_reports_created_at_idx on public.simulation_reports (created_at desc);

-- Keep mutable record timestamps consistent inside the database.
create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.set_updated_at() from public, anon, authenticated;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create trigger simulations_set_updated_at
before update on public.simulations
for each row execute function private.set_updated_at();

create trigger simulation_sessions_set_updated_at
before update on public.simulation_sessions
for each row execute function private.set_updated_at();

create trigger simulation_reports_set_updated_at
before update on public.simulation_reports
for each row execute function private.set_updated_at();

-- Provision a non-authoritative display profile for new Auth users.
-- Authorization always uses auth.uid(), never display_name or user metadata.
create function private.create_facilitator_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(
      coalesce(
        new.raw_user_meta_data ->> 'display_name',
        new.raw_user_meta_data ->> 'full_name',
        ''
      ),
      120
    )
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function private.create_facilitator_profile() from public, anon, authenticated;

create trigger create_facilitator_profile_after_signup
after insert on auth.users
for each row execute function private.create_facilitator_profile();

-- Add profiles for Auth users that existed before this migration. This is additive
-- and does not update or remove any existing profile.
insert into public.profiles (id, display_name)
select
  users.id,
  left(
    coalesce(
      users.raw_user_meta_data ->> 'display_name',
      users.raw_user_meta_data ->> 'full_name',
      ''
    ),
    120
  )
from auth.users as users
on conflict (id) do nothing;

-- Fail closed immediately. The next migration grants authenticated access and
-- adds owner policies; anon never receives direct table privileges.
alter table public.profiles enable row level security;
alter table public.simulations enable row level security;
alter table public.simulation_share_links enable row level security;
alter table public.participants enable row level security;
alter table public.simulation_sessions enable row level security;
alter table public.simulation_reports enable row level security;

revoke all on table public.profiles from public, anon, authenticated;
revoke all on table public.simulations from public, anon, authenticated;
revoke all on table public.simulation_share_links from public, anon, authenticated;
revoke all on table public.participants from public, anon, authenticated;
revoke all on table public.simulation_sessions from public, anon, authenticated;
revoke all on table public.simulation_reports from public, anon, authenticated;

commit;
