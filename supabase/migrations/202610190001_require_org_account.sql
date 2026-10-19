-- Facilitator access requires an @nggconsult.com account.
--
-- The simulations now share their Supabase project, and with it auth.users, with
-- the other NGG apps (boards, quiz). Until now every permanent signed-in account
-- was a facilitator, because only invited facilitators had an account at all. In
-- the shared project that no longer holds, so the restrictive policies from
-- 202607190002, which only rejected anonymous sign-ins, are replaced by ones that
-- also require an @nggconsult.com email in the session's JWT.
--
-- Restrictive policies are ANDed with every permissive policy, so this gates all
-- reads and writes on all six facilitator tables, and with them the SECURITY
-- INVOKER facilitator RPCs (publish, unpublish, regenerate, archive). The
-- participant flow runs through SECURITY DEFINER RPCs for anonymous callers and
-- is unaffected. The domain rule matches the boards and quiz apps.

begin;

drop policy if exists profiles_reject_anonymous_auth on sim.profiles;
drop policy if exists simulations_reject_anonymous_auth on sim.simulations;
drop policy if exists simulation_share_links_reject_anonymous_auth on sim.simulation_share_links;
drop policy if exists participants_reject_anonymous_auth on sim.participants;
drop policy if exists simulation_sessions_reject_anonymous_auth on sim.simulation_sessions;
drop policy if exists simulation_reports_reject_anonymous_auth on sim.simulation_reports;

drop policy if exists profiles_require_org_account on sim.profiles;
drop policy if exists simulations_require_org_account on sim.simulations;
drop policy if exists simulation_share_links_require_org_account on sim.simulation_share_links;
drop policy if exists participants_require_org_account on sim.participants;
drop policy if exists simulation_sessions_require_org_account on sim.simulation_sessions;
drop policy if exists simulation_reports_require_org_account on sim.simulation_reports;

create policy profiles_require_org_account
on sim.profiles
as restrictive
for all
to authenticated
using (
  coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') <> 'true'
  and lower(coalesce((select auth.jwt() ->> 'email'), '')) ~ '^[^@[:space:]]+@nggconsult\.com$'
)
with check (
  coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') <> 'true'
  and lower(coalesce((select auth.jwt() ->> 'email'), '')) ~ '^[^@[:space:]]+@nggconsult\.com$'
);

create policy simulations_require_org_account
on sim.simulations
as restrictive
for all
to authenticated
using (
  coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') <> 'true'
  and lower(coalesce((select auth.jwt() ->> 'email'), '')) ~ '^[^@[:space:]]+@nggconsult\.com$'
)
with check (
  coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') <> 'true'
  and lower(coalesce((select auth.jwt() ->> 'email'), '')) ~ '^[^@[:space:]]+@nggconsult\.com$'
);

create policy simulation_share_links_require_org_account
on sim.simulation_share_links
as restrictive
for all
to authenticated
using (
  coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') <> 'true'
  and lower(coalesce((select auth.jwt() ->> 'email'), '')) ~ '^[^@[:space:]]+@nggconsult\.com$'
)
with check (
  coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') <> 'true'
  and lower(coalesce((select auth.jwt() ->> 'email'), '')) ~ '^[^@[:space:]]+@nggconsult\.com$'
);

create policy participants_require_org_account
on sim.participants
as restrictive
for all
to authenticated
using (
  coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') <> 'true'
  and lower(coalesce((select auth.jwt() ->> 'email'), '')) ~ '^[^@[:space:]]+@nggconsult\.com$'
)
with check (
  coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') <> 'true'
  and lower(coalesce((select auth.jwt() ->> 'email'), '')) ~ '^[^@[:space:]]+@nggconsult\.com$'
);

create policy simulation_sessions_require_org_account
on sim.simulation_sessions
as restrictive
for all
to authenticated
using (
  coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') <> 'true'
  and lower(coalesce((select auth.jwt() ->> 'email'), '')) ~ '^[^@[:space:]]+@nggconsult\.com$'
)
with check (
  coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') <> 'true'
  and lower(coalesce((select auth.jwt() ->> 'email'), '')) ~ '^[^@[:space:]]+@nggconsult\.com$'
);

create policy simulation_reports_require_org_account
on sim.simulation_reports
as restrictive
for all
to authenticated
using (
  coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') <> 'true'
  and lower(coalesce((select auth.jwt() ->> 'email'), '')) ~ '^[^@[:space:]]+@nggconsult\.com$'
)
with check (
  coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') <> 'true'
  and lower(coalesce((select auth.jwt() ->> 'email'), '')) ~ '^[^@[:space:]]+@nggconsult\.com$'
);

commit;
