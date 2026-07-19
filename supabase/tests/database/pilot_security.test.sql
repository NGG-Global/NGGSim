begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(15);

-- Deterministic local-only identities. The transaction is rolled back at the end.
insert into auth.users (id, email, raw_user_meta_data, created_at, updated_at)
values
  (
    '10000000-0000-4000-8000-000000000001'::uuid,
    'facilitator-a@example.test',
    '{"display_name":"Facilitator A"}'::jsonb,
    now(),
    now()
  ),
  (
    '20000000-0000-4000-8000-000000000002'::uuid,
    'facilitator-b@example.test',
    '{"display_name":"Facilitator B"}'::jsonb,
    now(),
    now()
  );

insert into public.simulations (
  id,
  owner_id,
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
  published_at
)
values
  (
    'a0000000-0000-4000-8000-000000000001'::uuid,
    '10000000-0000-4000-8000-000000000001'::uuid,
    'published',
    'Simulation A',
    '{"clientName":"Organization A","programName":"Program A","showOrganizationToParticipant":true}'::jsonb,
    '{"conversationType":"feedback","hiddenInfo":"DO_NOT_LEAK_HIDDEN_INFO"}'::jsonb,
    '{"name":"Character A","role":"Employee","conditionalInfo":"DO_NOT_LEAK_CHARACTER_SECRET"}'::jsonb,
    '{"successConditions":"DO_NOT_LEAK_SUCCESS","failureConditions":"DO_NOT_LEAK_FAILURE"}'::jsonb,
    '{
      "title":"Participant brief A",
      "shortDescription":"A short description",
      "participantRole":"Manager",
      "situationDescription":"Visible scenario summary",
      "conversationGoal":"Reach an agreement",
      "allowedInformation":"Only visible information",
      "estimatedMinutes":8,
      "technicalInstructions":"Use a quiet room",
      "consentText":"I consent",
      "showFeedback":true,
      "allowRetry":false
    }'::jsonb,
    '[
      {"id":"full-name","type":"fullName","label":"Full name","enabled":true,"required":true,"internal":"DO_NOT_LEAK_FIELD"},
      {"id":"employee-id","type":"employeeId","label":"Employee ID","enabled":false,"required":false}
    ]'::jsonb,
    '{"internalNotes":"DO_NOT_LEAK_NOTES","futureAgentPrompt":"DO_NOT_LEAK_PROMPT"}'::jsonb,
    '[{"name":"DO_NOT_LEAK_LEARNING_METRIC"}]'::jsonb,
    now()
  ),
  (
    'b0000000-0000-4000-8000-000000000002'::uuid,
    '20000000-0000-4000-8000-000000000002'::uuid,
    'published',
    'Simulation B',
    '{"showOrganizationToParticipant":false}'::jsonb,
    '{}'::jsonb,
    '{"name":"Character B","role":"Employee"}'::jsonb,
    '{}'::jsonb,
    '{"situationDescription":"Visible B"}'::jsonb,
    '[]'::jsonb,
    '{}'::jsonb,
    '[]'::jsonb,
    now()
  );

insert into public.simulation_share_links (
  id,
  simulation_id,
  owner_id,
  token,
  status,
  revoked_at
)
values
  (
    'a1000000-0000-4000-8000-000000000001'::uuid,
    'a0000000-0000-4000-8000-000000000001'::uuid,
    '10000000-0000-4000-8000-000000000001'::uuid,
    'active_public_token_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    'active',
    null
  ),
  (
    'a2000000-0000-4000-8000-000000000002'::uuid,
    'a0000000-0000-4000-8000-000000000001'::uuid,
    '10000000-0000-4000-8000-000000000001'::uuid,
    'revoked_public_token_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    'revoked',
    now()
  ),
  (
    'b1000000-0000-4000-8000-000000000001'::uuid,
    'b0000000-0000-4000-8000-000000000002'::uuid,
    '20000000-0000-4000-8000-000000000002'::uuid,
    'active_public_token_dddddddddddddddddddddddddddddddddddddddddddd',
    'active',
    null
  );

insert into public.participants (
  id,
  simulation_id,
  owner_id,
  details,
  consented_at,
  consent_version
)
values
  (
    'a3000000-0000-4000-8000-000000000001'::uuid,
    'a0000000-0000-4000-8000-000000000001'::uuid,
    '10000000-0000-4000-8000-000000000001'::uuid,
    '{"fullName":"Participant A"}'::jsonb,
    now(),
    'test-v1'
  ),
  (
    'b3000000-0000-4000-8000-000000000002'::uuid,
    'b0000000-0000-4000-8000-000000000002'::uuid,
    '20000000-0000-4000-8000-000000000002'::uuid,
    '{"fullName":"Participant B"}'::jsonb,
    now(),
    'test-v1'
  );

insert into public.simulation_sessions (
  id,
  simulation_id,
  share_link_id,
  participant_id,
  owner_id,
  conversation_id,
  status
)
values
  (
    'a4000000-0000-4000-8000-000000000001'::uuid,
    'a0000000-0000-4000-8000-000000000001'::uuid,
    'a1000000-0000-4000-8000-000000000001'::uuid,
    'a3000000-0000-4000-8000-000000000001'::uuid,
    '10000000-0000-4000-8000-000000000001'::uuid,
    'conversation-a',
    'completed'
  ),
  (
    'b4000000-0000-4000-8000-000000000002'::uuid,
    'b0000000-0000-4000-8000-000000000002'::uuid,
    'b1000000-0000-4000-8000-000000000001'::uuid,
    'b3000000-0000-4000-8000-000000000002'::uuid,
    '20000000-0000-4000-8000-000000000002'::uuid,
    'conversation-b',
    'completed'
  );

insert into public.simulation_reports (
  id,
  session_id,
  simulation_id,
  owner_id,
  summary
)
values
  (
    'a5000000-0000-4000-8000-000000000001'::uuid,
    'a4000000-0000-4000-8000-000000000001'::uuid,
    'a0000000-0000-4000-8000-000000000001'::uuid,
    '10000000-0000-4000-8000-000000000001'::uuid,
    'Report A'
  ),
  (
    'b5000000-0000-4000-8000-000000000002'::uuid,
    'b4000000-0000-4000-8000-000000000002'::uuid,
    'b0000000-0000-4000-8000-000000000002'::uuid,
    '20000000-0000-4000-8000-000000000002'::uuid,
    'Report B'
  );

select results_eq(
  $$
    select count(*)::bigint
    from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname in (
        'profiles',
        'simulations',
        'simulation_share_links',
        'participants',
        'simulation_sessions',
        'simulation_reports'
      )
      and relation.relrowsecurity
  $$,
  array[6::bigint],
  'RLS is enabled on all six private tables'
);

-- Act as facilitator A.
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select results_eq(
  $$
    select
      (select count(*) from public.profiles)::bigint,
      (select count(*) from public.simulations)::bigint,
      (select count(*) from public.simulation_share_links)::bigint,
      (select count(*) from public.participants)::bigint,
      (select count(*) from public.simulation_sessions)::bigint,
      (select count(*) from public.simulation_reports)::bigint
  $$,
  $$values (1::bigint, 2::bigint, 3::bigint, 2::bigint, 2::bigint, 2::bigint)$$,
  'Admin A sees the shared workspace while profiles remain private'
);

select throws_ok(
  $$
    insert into public.simulations (owner_id, title)
    values ('20000000-0000-4000-8000-000000000002'::uuid, 'Forbidden insert')
  $$,
  '42501',
  'new row violates row-level security policy for table "simulations"',
  'Facilitator A cannot insert a simulation owned by facilitator B'
);

select results_eq(
  $$
    update public.simulations
    set title = 'Forbidden update'
    where id = 'b0000000-0000-4000-8000-000000000002'::uuid
    returning id
  $$,
  $$values ('b0000000-0000-4000-8000-000000000002'::uuid)$$,
  'Admin A can update a simulation created by admin B'
);

select results_eq(
  $$
    delete from public.simulations
    where id = 'b0000000-0000-4000-8000-000000000002'::uuid
    returning id
  $$,
  $$select id from public.simulations where false$$,
  'Hard DELETE remains creator-only; shared UI deletion uses archive_simulation'
);

-- Act as facilitator B and verify the other direction as well.
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000002', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);

select results_eq(
  $$
    select
      (select count(*) from public.profiles)::bigint,
      (select count(*) from public.simulations)::bigint,
      (select count(*) from public.simulation_share_links)::bigint,
      (select count(*) from public.participants)::bigint,
      (select count(*) from public.simulation_sessions)::bigint,
      (select count(*) from public.simulation_reports)::bigint
  $$,
  $$values (1::bigint, 2::bigint, 3::bigint, 2::bigint, 2::bigint, 2::bigint)$$,
  'Admin B sees the same shared workspace while profiles remain private'
);

-- An unauthenticated caller has no table privilege, but may execute the one
-- allowlisted public RPC.
reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000000', true);
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select throws_ok(
  $$select * from public.simulations$$,
  '42501',
  'permission denied for table simulations',
  'anon cannot directly select a full simulation'
);

select is(
  public.get_participant_simulation(
    'active_public_token_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
  ) ->> 'title',
  'Simulation A',
  'an active token resolves to its participant view'
);

select is(
  (
    select array_agg(key order by key)
    from jsonb_object_keys(
      public.get_participant_simulation(
        'active_public_token_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
      )
    ) as keys(key)
  ),
  array[
    'character',
    'organizationLabel',
    'participantBrief',
    'participantFields',
    'publicToken',
    'scenarioSummary',
    'title'
  ]::text[],
  'the RPC returns only ParticipantSimulationView top-level fields'
);

select is(
  (
    select array_agg(key order by key)
    from jsonb_object_keys(
      public.get_participant_simulation(
        'active_public_token_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
      ) -> 'participantBrief'
    ) as keys(key)
  ),
  array[
    'allowRetry',
    'allowedInformation',
    'consentText',
    'conversationGoal',
    'estimatedMinutes',
    'participantRole',
    'shortDescription',
    'showFeedback',
    'situationDescription',
    'technicalInstructions',
    'title'
  ]::text[],
  'the participant brief is constructed from an explicit allowlist'
);

select is(
  (
    select array_agg(key order by key)
    from jsonb_object_keys(
      public.get_participant_simulation(
        'active_public_token_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
      ) -> 'character'
    ) as keys(key)
  ),
  array['name', 'role']::text[],
  'character output contains name and role only'
);

select is(
  (
    select array_agg(key order by key)
    from jsonb_object_keys(
      public.get_participant_simulation(
        'active_public_token_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
      ) -> 'participantFields' -> 0
    ) as keys(key)
  ),
  array['enabled', 'id', 'label', 'required', 'type']::text[],
  'enabled participant fields contain only their public properties'
);

select unlike(
  public.get_participant_simulation(
    'active_public_token_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
  )::text,
  '%DO_NOT_LEAK%',
  'hidden info, character secrets, conditions, prompts and learning metrics do not leak'
);

select is(
  public.get_participant_simulation(
    'revoked_public_token_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
  ),
  null::jsonb,
  'a revoked token returns no data'
);

select is(
  public.get_participant_simulation(
    'invalid_public_token_cccccccccccccccccccccccccccccccccccccccccc'
  ),
  null::jsonb,
  'an invalid token returns no data'
);

reset role;
select * from finish();
rollback;
