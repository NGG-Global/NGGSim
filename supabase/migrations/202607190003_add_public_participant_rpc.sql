-- Public capability lookup for ParticipantSimulationView.
-- anon receives EXECUTE on this function only and never SELECT on private tables.
-- Every JSON field is allowlisted here; full JSONB columns are never returned.

begin;

create function public.get_participant_simulation(public_token text)
returns jsonb
language sql
stable
strict
security definer
set search_path = ''
as $$
  select jsonb_strip_nulls(
    jsonb_build_object(
      'publicToken', share_link.token,
      'title', simulation.title,
      'organizationLabel',
        case
          when simulation.organization ->> 'showOrganizationToParticipant' = 'true'
          then coalesce(
            nullif(simulation.organization ->> 'programName', ''),
            nullif(simulation.organization ->> 'clientName', '')
          )
          else null
        end,
      'participantBrief',
        jsonb_build_object(
          'title', coalesce(simulation.participant_brief ->> 'title', ''),
          'shortDescription', coalesce(simulation.participant_brief ->> 'shortDescription', ''),
          'participantRole', coalesce(simulation.participant_brief ->> 'participantRole', ''),
          'situationDescription', coalesce(simulation.participant_brief ->> 'situationDescription', ''),
          'conversationGoal', coalesce(simulation.participant_brief ->> 'conversationGoal', ''),
          'allowedInformation', coalesce(simulation.participant_brief ->> 'allowedInformation', ''),
          'estimatedMinutes',
            case
              when jsonb_typeof(simulation.participant_brief -> 'estimatedMinutes') = 'number'
              then simulation.participant_brief -> 'estimatedMinutes'
              else '8'::jsonb
            end,
          'technicalInstructions', coalesce(simulation.participant_brief ->> 'technicalInstructions', ''),
          'consentText', coalesce(simulation.participant_brief ->> 'consentText', ''),
          'showFeedback', coalesce(simulation.participant_brief ->> 'showFeedback' = 'true', false),
          'allowRetry', coalesce(simulation.participant_brief ->> 'allowRetry' = 'true', false)
        ),
      'participantFields',
        coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'id', coalesce(participant_field.value ->> 'id', ''),
                'type', coalesce(participant_field.value ->> 'type', ''),
                'label', coalesce(participant_field.value ->> 'label', ''),
                'enabled', true,
                'required', coalesce(participant_field.value ->> 'required' = 'true', false)
              )
              order by participant_field.ordinality
            )
            from jsonb_array_elements(simulation.participant_fields)
              with ordinality as participant_field(value, ordinality)
            where participant_field.value ->> 'enabled' = 'true'
          ),
          '[]'::jsonb
        ),
      'character',
        jsonb_build_object(
          'name', coalesce(simulation.character ->> 'name', ''),
          'role', coalesce(simulation.character ->> 'role', '')
        ),
      'scenarioSummary', coalesce(simulation.participant_brief ->> 'situationDescription', '')
    )
  )
  from public.simulation_share_links as share_link
  join public.simulations as simulation
    on simulation.id = share_link.simulation_id
   and simulation.owner_id = share_link.owner_id
  where char_length(public_token) between 32 and 256
    and public_token ~ '^[A-Za-z0-9_-]+$'
    and share_link.token = public_token
    and share_link.status = 'active'
    and share_link.revoked_at is null
    and (share_link.expires_at is null or share_link.expires_at > now())
    and simulation.status = 'published'
    and simulation.deleted_at is null
  limit 1;
$$;

comment on function public.get_participant_simulation(text) is
  'Resolves an active public token to an allowlisted ParticipantSimulationView. Returns null for invalid, revoked, expired or unpublished links.';

-- PostgreSQL grants function execution to PUBLIC by default, so remove it first
-- and then grant only the roles that may resolve a participant link.
revoke execute on function public.get_participant_simulation(text) from public, anon, authenticated;
grant execute on function public.get_participant_simulation(text) to anon, authenticated;

commit;
