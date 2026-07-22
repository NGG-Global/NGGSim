// Supabase Edge Function: elevenlabs-postcall
//
// Receives the ElevenLabs post-call webhook, verifies its signature, matches the
// analysis to our session (via the ngg_session_id dynamic variable we set at call
// start), and stores a report. Built "log-first": the raw payload is logged so we
// can confirm ElevenLabs' exact shape and finalise parsing from real data.
//
// Deploy with "Verify JWT" OFF (ElevenLabs calls this, not a logged-in user).
// Secrets: ELEVENLABS_WEBHOOK_SECRET (from the ElevenLabs webhook config).
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.

function ok(body = { ok: true }, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

async function hmacSha256Hex(secret, message) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Best-effort: pull our session id out of wherever ElevenLabs puts dynamic variables.
function findSessionId(root) {
  const candidates = [
    root?.data?.conversation_initiation_client_data?.dynamic_variables,
    root?.conversation_initiation_client_data?.dynamic_variables,
    root?.data?.dynamic_variables,
    root?.dynamic_variables,
    root?.data?.metadata?.dynamic_variables,
  ];
  for (const c of candidates) {
    if (c && typeof c.ngg_session_id === 'string' && c.ngg_session_id) return c.ngg_session_id;
  }
  return '';
}

// Best-effort: turn ElevenLabs criteria results into strengths / improvements.
function splitCriteria(analysis) {
  const raw = analysis?.evaluation_criteria_results;
  const entries = Array.isArray(raw) ? raw : (raw && typeof raw === 'object' ? Object.values(raw) : []);
  const strengths = [];
  const improvements = [];
  for (const e of entries) {
    if (!e || typeof e !== 'object') continue;
    const label = String(e.criteria_id ?? e.name ?? '').trim();
    const rationale = String(e.rationale ?? '').trim();
    const text = [label, rationale].filter(Boolean).join(' — ');
    if (!text) continue;
    const result = String(e.result ?? '').toLowerCase();
    if (result === 'success' || result === 'pass') strengths.push(text);
    else if (result === 'failure' || result === 'fail') improvements.push(text);
  }
  return { strengths, improvements };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return ok({ error: 'method_not_allowed' }, 405);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const WEBHOOK_SECRET = Deno.env.get('ELEVENLABS_WEBHOOK_SECRET');

  const raw = await req.text();

  // Diagnostics first (logging only; we still verify before acting below): reveal
  // where the session tag lives and the exact analysis shape.
  try {
    const peek = JSON.parse(raw);
    const d = peek?.data ?? peek;
    console.log('postcall data keys', JSON.stringify(Object.keys(d ?? {})));
    console.log('postcall dynvars', JSON.stringify({
      cicd: d?.conversation_initiation_client_data?.dynamic_variables ?? null,
      dv: d?.dynamic_variables ?? null,
      meta: d?.metadata?.dynamic_variables ?? null,
    }));
    console.log('postcall analysis', JSON.stringify(d?.analysis ?? null)?.slice(0, 4000));
  } catch {
    console.log('postcall raw (unparseable)', raw.slice(0, 1000));
  }

  // Verify the ElevenLabs signature: header "t=<ts>,v0=<hmac>", HMAC-SHA256 over `${t}.${raw}`.
  if (WEBHOOK_SECRET) {
    const header = req.headers.get('elevenlabs-signature') ?? '';
    const parts = Object.fromEntries(header.split(',').map((p) => p.split('=').map((s) => s.trim())));
    const t = parts.t, v0 = parts.v0;
    if (!t || !v0) { console.error('missing signature parts', header.slice(0, 120)); return ok({ error: 'bad_signature' }, 401); }
    const expected = await hmacSha256Hex(WEBHOOK_SECRET, `${t}.${raw}`);
    if (!timingSafeEqual(expected, v0)) { console.error('signature mismatch'); return ok({ error: 'bad_signature' }, 401); }
  } else {
    console.warn('ELEVENLABS_WEBHOOK_SECRET not set — skipping signature verification (bring-up only)');
  }

  let body;
  try { body = JSON.parse(raw); } catch { console.error('invalid json'); return ok({ error: 'invalid_json' }, 200); }
  const data = body?.data ?? body;

  const sessionId = findSessionId(body);
  if (!sessionId) { console.warn('no ngg_session_id found in payload — cannot correlate yet'); return ok(); }
  if (!SUPABASE_URL || !SERVICE_ROLE) { console.error('supabase env missing'); return ok(); }

  // Look up the session (service role) to get simulation_id + owner_id for the report FK.
  const sResp = await fetch(`${SUPABASE_URL}/rest/v1/simulation_sessions?id=eq.${sessionId}&select=simulation_id,owner_id&limit=1`,
    { headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` } });
  const sRows = sResp.ok ? await sResp.json().catch(() => []) : [];
  const sess = Array.isArray(sRows) ? sRows[0] : null;
  if (!sess) { console.error('session not found for', sessionId); return ok(); }

  const analysis = data?.analysis ?? {};
  const { strengths, improvements } = splitCriteria(analysis);
  const report = {
    session_id: sessionId,
    simulation_id: sess.simulation_id,
    owner_id: sess.owner_id,
    summary: String(analysis.transcript_summary ?? '').slice(0, 8000),
    scores: {},
    strengths,
    improvements,
    learning_metrics: analysis, // keep the full analysis so nothing is lost while we finalise
  };

  const upsert = await fetch(`${SUPABASE_URL}/rest/v1/simulation_reports?on_conflict=session_id`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}`,
      'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify(report),
  });
  if (!upsert.ok) { console.error('report upsert failed', upsert.status, (await upsert.text().catch(() => '')).slice(0, 300)); return ok(); }

  console.log('report stored for session', sessionId);
  return ok();
});
