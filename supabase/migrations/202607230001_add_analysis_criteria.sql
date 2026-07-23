-- Per-simulation analysis criteria.
-- Facilitators pick which universal-rubric criteria a simulation is evaluated on
-- (a subset of the fixed criteria configured on the ElevenLabs agent). The post-call
-- webhook filters the analysis to these ids before storing the report. An empty array
-- means "all criteria" — older rows predate this column and are treated that way.

begin;

alter table public.simulations
  add column if not exists analysis_criteria jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'simulations_analysis_criteria_array'
  ) then
    alter table public.simulations
      add constraint simulations_analysis_criteria_array
      check (jsonb_typeof(analysis_criteria) = 'array');
  end if;
end $$;

comment on column public.simulations.analysis_criteria is
  'Ids of the analysis criteria this simulation is evaluated on; empty means all.';

-- The shared-admin-workspace migration (202607190005) revoked the table-wide UPDATE
-- and re-granted it per column. A new column must be added to that allowlist or
-- facilitator edits to analysis_criteria are denied.
grant update (analysis_criteria) on public.simulations to authenticated;

commit;
