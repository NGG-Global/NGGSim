// Generates supabase/seeds/management_simulations.sql from src/data/demoData.ts.
//
// The two management simulations are authored once, in demoData.ts, so the local demo
// storage and the Supabase pilot environment can never drift apart. This script loads
// that TypeScript module through Vite (already a dependency, so nothing new to install)
// and renders an idempotent, INSERT-only seed script.
//
// Usage: pnpm seed:sql

import { writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUTPUT = resolve(root, 'supabase/seeds/management_simulations.sql')

// Titles of the simulations that belong in the pilot environment, in insertion order.
const SEEDED_TITLES = ['משוב שנתי בלי הפתעות', 'זה תמיד תלוי באחרים']

/** Dollar-quoted literal: the payloads are Hebrew prose with quotes and newlines. */
function dollarQuoted(value, tag) {
  const body = typeof value === 'string' ? value : JSON.stringify(value)
  if (body.includes(`$${tag}$`)) throw new Error(`payload collides with the $${tag}$ delimiter`)
  return `$${tag}$${body}$${tag}$`
}

function simulationBlock(simulation) {
  const jsonb = (value, tag) => `${dollarQuoted(value, tag)}::jsonb`
  return `  -- ${simulation.title}
  if exists (
    select 1 from public.simulations
    where title = ${dollarQuoted(simulation.title, 'title')} and deleted_at is null
  ) then
    raise notice 'skipping %, already present', ${dollarQuoted(simulation.title, 'title')};
  else
    insert into public.simulations (
      owner_id, status, title, organization, scenario, character, behavior,
      participant_brief, participant_fields, facilitator_configuration,
      learning_objectives, analysis_criteria, published_at
    ) values (
      v_owner,
      'published',
      ${dollarQuoted(simulation.title, 'title')},
      ${jsonb(simulation.organization, 'org')},
      ${jsonb(simulation.scenario, 'scen')},
      ${jsonb(simulation.character, 'char')},
      ${jsonb(simulation.behavior, 'behav')},
      ${jsonb(simulation.participantBrief, 'brief')},
      ${jsonb(simulation.participantFields, 'fields')},
      ${jsonb(simulation.facilitatorConfiguration, 'facil')},
      ${jsonb(simulation.learningObjectives, 'obj')},
      ${jsonb(simulation.analysisCriteria, 'crit')},
      now()
    )
    returning id into v_sim;

    -- Publishing needs an active capability link; the token uses the column default.
    insert into public.simulation_share_links (simulation_id, owner_id, status)
    values (v_sim, v_owner, 'active');

    raise notice 'inserted %', ${dollarQuoted(simulation.title, 'title')};
  end if;
`
}

function buildSql(simulations) {
  return `-- Seed: the two management simulations for the shared facilitator workspace.
--
-- GENERATED FILE — do not edit by hand. Regenerate with: pnpm seed:sql
-- Source of truth: src/data/demoData.ts
--
-- Run this in the Supabase SQL editor of the target project. It is additive only:
-- it INSERTs rows and never updates, truncates or deletes existing data, and it
-- skips any simulation whose title is already present, so re-running is safe.
--
-- Both simulations are inserted as 'published' with an active share link, which
-- makes them immediately reachable by participants holding the link.
--
-- owner_id is the immutable creator/audit identity. Because migration
-- 202607190005 made the workspace shared, every authenticated facilitator can see
-- and edit these rows regardless of which profile owns them.

begin;

do $seed$
declare
  v_owner uuid;
  v_sim uuid;
begin
  -- Attribute ownership to the earliest facilitator profile. To attribute it to a
  -- specific person instead, replace this with their profiles.id.
  select id into v_owner from public.profiles order by created_at, id limit 1;
  if v_owner is null then
    raise exception 'no facilitator profile found; sign in to the admin UI once, then re-run this seed';
  end if;

${simulations.map(simulationBlock).join('\n')}end
$seed$;

commit;
`
}

// configFile:false and noDiscovery keep this to a bare SSR module loader: the data
// module has no external imports, so scanning index.html for deps only races teardown.
const server = await createServer({
  root,
  configFile: false,
  logLevel: 'error',
  appType: 'custom',
  optimizeDeps: { noDiscovery: true },
  server: { middlewareMode: true },
})
try {
  const { createDemoSimulations } = await server.ssrLoadModule('/src/data/demoData.ts')
  const all = createDemoSimulations()
  const selected = SEEDED_TITLES.map((title) => {
    const found = all.find((simulation) => simulation.title === title)
    if (!found) throw new Error(`demoData.ts no longer contains a simulation titled "${title}"`)
    return found
  })
  await mkdir(dirname(OUTPUT), { recursive: true })
  await writeFile(OUTPUT, buildSql(selected), 'utf8')
  console.log(`wrote ${OUTPUT} (${selected.length} simulations)`)
} finally {
  await server.close()
}
